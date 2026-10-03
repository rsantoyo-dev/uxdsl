import { enforceReferences, ReferenceOptions } from './reference-integrity';
import { renderThemeCss } from './ds-runtime/theme-generator';
import { validateTheme, themeValidationError } from './ds-runtime/theme-validate';
import { getInputTokens, inputComponentCss, parseInputArguments } from './inputs';
import { getButtonTokens, buttonComponentCss, parseButtonArguments } from './buttons';
import { getSurfaceTokens, surfaceDeclarations, parseSurfaceArguments } from './surfaces';
import { getShadowTokens } from './shadows';
import { getEdgeTokens, RADIUS_KEYWORDS } from './edges';
import { buildVarName, buildNamespacedVarName } from './naming';
import { resolveTheme } from './default-theme';
import { diagnostic, locateError, missingKeyMessage, closestKey, editDistance } from './diagnostics';
import { discoverThemeSync } from './config';
// The UXDSL PostCSS plugin.
//
// MIG-B6-28 (FEAT-008): this header described a five-line prototype — "$var
// declarations, palette(), responsive functions" — for several releases after
// the plugin had grown most of what it actually does. Rewritten to the real
// surface, which is:
//
//   Values      $var declarations and substitutions; space(), density(),
//               color(), palette(), radius(), border(), shadow();
//               responsive functions xs() sm() md() lg() xl()
//               over the theme's own breakpoint map, `!important` preserved
//               at every breakpoint.
//   Directives  @ds-surface, @ds-button, @ds-input, @ds-typo — each expanding
//               to the declarations its role defines, states and
//               pseudo-elements included. Must be a direct child of the rule
//               they style, or they fail as UXD_DIRECTIVE_CONTEXT rather than
//               passing through untouched.
//   Theme       The effective theme comes from the `theme` option or, when it
//               is omitted, from conventional theme-file discovery
//               (`discoverTheme`/`configRoot`). `includeTheme: false` compiles
//               an entry that only consumes tokens another entry defines.
//               A theme's `fonts.google` becomes `@import` lines through the
//               one shared encoder in ./fonts — never a second encoding here.
//   Integrity   Every emitted var() is checked against a real definition
//               (`references`), failing the build by default rather than
//               shipping a dangling token.
//   Diagnostics Errors carry a UXD_* code and a source position; generated
//               theme globals deliberately carry no source, so a source map
//               lists only files the author actually wrote.

import type { AtRule, ChildNode, Declaration, Result, Root, Rule } from "postcss";
import postcss from "postcss";
import valueParser from "postcss-value-parser";
import { resolveResponsiveValue, getDensityTokens, tokenValueToCss, removedSyntaxMessage, REMOVED_RADIUS_FULL, LANGUAGE_COMPLETIONS, KNOWN_CSS_FUNCTIONS } from './language';
import { TYPOGRAPHY_PROPERTIES, TYPOGRAPHY_CSS_PROPERTIES, resolveTypographyRole } from './typography';
import { DEFAULT_BREAKPOINTS as DEFAULT_BPS } from "./ds-runtime/breakpoints";
import type { UxdslOptions } from './types';

// MIG-B6-27 (FEAT-008): the options interface lives in `./types` now, the
// public type surface consumers import. It is re-exported from the namespace
// merged at the bottom of this file, so `import type { UxdslOptions } from
// 'postcss-uxdsl'` resolves even though this module uses `export =`.
// Stability phase 1: the plugin options `breakpoints`, `themeVar`, `spaceVar`
// and `colorVar` are gone. Thresholds are the theme's own `breakpoints` family
// (one source, validated once by `validateTheme`), and the emitted names are
// the `--uxdsl__<family>__<key>` contract. A caller that still passes one is
// told so and the option is ignored — the CLI, `uxdsl-core` and the adapters
// forwarded `breakpoints` until their own phase lands, so this must not throw.
const REMOVED_OPTIONS: Record<string, string> = {
  breakpoints: 'breakpoints are configured in the theme (`theme.breakpoints`)',
  themeVar: 'palette() always compiles to var(--uxdsl__palette__<key>)',
  spaceVar: 'space() always compiles to var(--uxdsl__space__<key>)',
  colorVar: 'color() always compiles to var(--uxdsl__color__<key>)',
};

// MIG-B7-14 (FEAT-009): CSS honors an `@import` only when it precedes every
// other rule, and `@charset` only when it is the very first thing in the
// sheet; a browser silently discards either one otherwise. Theme emission used
// to `root.prepend` its own nodes (the `fonts.google` imports, then the density
// `:root` block, which ran last and so ended up on top), which put a `:root`
// above every import — the theme's and the author's — and above the author's
// `@charset`. The theme now inserts *after* the author's leading prelude
// (`@charset`, body-less `@layer` statements, `@import`s, and comments), so
// nothing the author wrote is ever reordered: not their imports relative to
// each other, and not an `@import ... layer(x)` relative to the `@layer` order
// statement that precedes it. Moving author nodes was the alternative and was
// rejected because that last case changes the cascade.
const atRuleName = (node: ChildNode) => (node.type === "atrule" ? node.name.toLowerCase() : "");
const isCharsetOrComment = (node: ChildNode) => node.type === "comment" || atRuleName(node) === "charset";
const isPrelude = (node: ChildNode) =>
  isCharsetOrComment(node) || atRuleName(node) === "import" || (atRuleName(node) === "layer" && !(node as AtRule).nodes);

/** Inserts `nodes`, in order, after the leading run of nodes satisfying `keep`. */
function insertAfterLeading(root: Root, keep: (node: ChildNode) => boolean, nodes: ChildNode[]) {
  let end = 0;
  while (end < root.nodes.length && keep(root.nodes[end])) end++;
  let anchor: ChildNode | undefined = end > 0 ? root.nodes[end - 1] : undefined;
  for (const node of nodes) {
    if (anchor) anchor.after(node);
    else root.prepend(node);
    anchor = node;
  }
}

function uxdslPlugin(opts: UxdslOptions = {}) {
  const mediaRuleCache = new WeakMap<Rule, Map<string, Rule>>();
  const lastMediaByRule = new WeakMap<Rule, AtRule>();
  // Historical single-entry behavior: one compiled file both defines and
  // consumes tokens. A component/CSS-Module entry opts out with `false` to
  // consume tokens a separate theme entry already defines, instead of
  // re-emitting duplicate `:root` blocks (see includeTheme docs above).
  const includeTheme = opts.includeTheme !== false;

  return {
    postcssPlugin: "postcss-uxdsl",
    Once(root: Root, { result }: { result: Result }) {
      // MIG-B6-19 (FEAT-008): resolved per compilation (here), not frozen
      // once when the plugin factory runs — a reused plugin instance
      // (a long-running dev server, or two projects compiled in the same
      // process) must not keep serving the first project's discovered
      // theme, or a stale copy from before an edit to
      // uxdsl.theme.config.* on disk.
      const configRoot = opts.configRoot ?? process.cwd();
      let discovered: ReturnType<typeof discoverThemeSync> = null;
      if (opts.theme === undefined && opts.discoverTheme !== false) {
        discovered = discoverThemeSync(configRoot);
        if (discovered) {
          for (const file of discovered.dependencies) {
            result.messages.push({ type: 'dependency', plugin: 'postcss-uxdsl', file, parent: result.opts.from });
          }
        }
      }
      // The effective theme — DEFAULT_THEME with whatever the caller provided
      // (or, absent that, whatever discovery found) deep-merged on top — is
      // resolved once here and is the only theme every step below reads, so an
      // omitted or partial theme (`{}`, or just `{ palette: { primary: { main:
      // … } } }`) still produces a fully-defined, strictly-valid effective theme.
      // It is the exact object `generateThemeCss` resolves for the same input:
      // the theme JSON is the only source of a token.
      const rawTheme = (opts.theme ?? discovered?.theme) as Record<string, any> | undefined;
      const effectiveTheme = resolveTheme(rawTheme);
      // Stability phase 1: the one validator, on the effective theme, before
      // any engine reads it — the same call `generateThemeCss` and
      // `applyTheme` make, so a numeric leaf, a `"768"` breakpoint or an
      // unknown `fonts` key is refused here with the same code and key path.
      // References are checked once, at the end, on the stylesheet actually
      // emitted, not here.
      const validated = validateTheme(effectiveTheme, { references: false });
      if (!validated.ok) throw themeValidationError(validated.errors);
      for (const warning of validated.warnings) result.warn(warning.message, { plugin: 'postcss-uxdsl' });
      const effectiveReferences = opts.references ?? discovered?.references as ReferenceOptions | undefined;
      for (const [name, instead] of Object.entries(REMOVED_OPTIONS)) {
        if ((opts as Record<string, unknown>)[name] !== undefined) {
          result.warn(`UXD_OPTION_REMOVED: the "${name}" plugin option was removed and is ignored; ${instead}.`, { plugin: 'postcss-uxdsl' });
        }
      }
      // The one breakpoint map of this compilation: the effective theme's.
      const bps: Record<string, number> = { ...DEFAULT_BPS, ...effectiveTheme.breakpoints };
      const ordered = Object.entries(bps).map(([name, px]) => ({ name, px })).sort((a, b) => a.px - b.px);
      const bpNames = new Set(Object.keys(bps));
      const inheritSource = (node: any, source: any) => {
        node.source = source;
        for (const child of node.nodes || []) inheritSource(child, source);
        return node;
      };
      // MIG-B6-21 (FEAT-008): CSS built purely from the theme has no origin in
      // any `.uxdsl` file. Running it through `postcss.parse()` gives every
      // node a source pointing at a fresh anonymous `<input css …>` Input,
      // which PostCSS then lists in a sourcemap's `sources` — with its whole
      // body in `sourcesContent` — so a small stylesheet ended up advertising
      // eight source files the user never wrote. Dropping the source leaves
      // these bytes unmapped, which is the honest answer for generated
      // globals, and keeps `sources` to files that actually exist. Reference
      // diagnostics are unaffected: an anonymous Input already has no
      // `input.file`, so `issue.source` was undefined for these nodes anyway.
      // Stability phase 1 (audit T1): every generated theme node is marked, and
      // the value passes below (`$var` substitution, responsive expansion,
      // token rewriting) run over the author's nodes only. The engines resolve
      // the one value grammar themselves now, so the same `renderThemeCss`
      // string `generateThemeCss` returns is what this plugin inserts — a
      // final pass that also rewrote the generated `:root` blocks is what made
      // the two paths differ (`radius(2)` resolved at build time only).
      const generated = new WeakSet<ChildNode>();
      const markGenerated = (nodes: ChildNode[]) => {
        for (const node of nodes) { generated.add(node); (node as any).walk?.((child: ChildNode) => { generated.add(child); }); }
        return nodes;
      };
      const themeGenerated = (css: string) => markGenerated(inheritSource(postcss.parse(css), undefined).nodes);
      const originalSources = new Set<Declaration['source']>();
      const dslSources = new Set<Declaration['source']>();
      root.walkDecls(node => {
        originalSources.add(node.source);
        if (/\b(space|density|radius|border|shadow|palette|color)\(/.test(node.value)) dslSources.add(node.source);
      });
      const vars: Record<string, string> = Object.create(null);
      // `@theme { … }` token packs are not part of the language: the theme
      // JSON is the only place a token is defined. A block is an error naming
      // where its contents go, never silently dropped or passed through.
      root.walkAtRules(/^theme$/i, (at) => {
        throw locateError(diagnostic(
          'UXD_THEME_BLOCK_REMOVED: @theme blocks were removed; define these tokens in the theme JSON ' +
          '(uxdsl.theme.json): density-<k> under "densities", radius-<k> under "radii", border-<k> under "borders", ' +
          'shadow-<k> under "shadows", and surface-/button-/input-<role> packs under "surfaces", "buttons" and "inputs".'
        ), at);
      });
      // Directive arguments are bare words. A quoted argument is an error
      // rather than something to unwrap: `@ds-typo("h1")` is not `@ds-typo(h1)`.
      const DIRECTIVE_ARGUMENT_CODES: Record<string, string> = { 'ds-typo': 'UXD_TYPO_ARGUMENT', 'ds-surface': 'UXD_SURFACE_ARGUMENT', 'ds-button': 'UXD_BUTTON_ARGUMENT', 'ds-input': 'UXD_INPUT_ARGUMENT' };
      const rejectQuotedArguments = (at: AtRule) => {
        if (!/["']/.test(at.params)) return;
        throw locateError(diagnostic(
          `${DIRECTIVE_ARGUMENT_CODES[at.name.toLowerCase()]}: quoted arguments are not part of the directive grammar; ` +
          `write @${at.name}${at.params.replace(/["']/g, '')} without quotes.`
        ), at);
      };
      // Selector-scoped typography directives.
      // MIG-B6-14 (FEAT-008): only @ds-typo(h1) is supported — @ds(h1) and
      // @ds-h1 were never implemented despite an older comment claiming
      // otherwise; both now fall through to the final pass below and fail
      // as UXD_DIRECTIVE_UNKNOWN instead of reaching CSS untouched.
      root.walkRules((rule) => {
        const applyTypo = (at: any, variantRaw: string) => {
          rejectQuotedArguments(at);
          let tag = String(variantRaw || "").trim();
          if (tag.startsWith("(") && tag.endsWith(")")) {
            tag = tag.slice(1, -1).trim();
          }
          tag = tag.toLowerCase();

          const insert = (prop: string, value: string) => {
            at.parent.insertBefore(at, { prop, value, source: at.source });
          };

          // MIG-B6-17 (FEAT-008): emit exactly the fields the effective theme
          // defines for this role, and nothing else. This used to emit a fixed
          // list of 10-11 declarations whose fallbacks the theme never asked
          // for — `margin-block-*: auto` (which absorbs free space in a flex or
          // grid container instead of the 0 it collapses to in normal flow),
          // `text-decoration: none` (which stripped the underline off any link
          // it was applied to, WCAG 1.4.1), `text-transform`/`font-style`
          // resets, and an `opacity` that could not be overridden from the
          // theme at all, since `opacity` is not one of TYPOGRAPHY_PROPERTIES'
          // fields. Whatever is worth keeping now lives in theme/base.json.
          const details = (effectiveTheme?.typography_details || {}) as Record<string, Record<string, string>>;
          const style = resolveTypographyRole(details, tag);
          if (!style) {
            throw locateError(
              diagnostic(missingKeyMessage('UXD_TYPO_REFERENCE', 'ds-typo', tag, Object.keys(details))),
              at,
            );
          }

          // Consumer side of typography.ts's compileTypographyRules, which
          // emits `--uxdsl__typography__<tag>-<field>` (MIG-08: one shared
          // "typography" family, not the tag itself); `typo` composes that
          // name the same way so definition and reference always match.
          const typo = (field: string) => buildVarName('typography', `${tag}-${field}`);

          // Iterating the property map (not the resolved style's own keys)
          // keeps the emitted order canonical and independent of how the JSON
          // happened to be authored, and of `default`-vs-role merge order.
          // No literal fallback: compileTypographyRules defines a variable for
          // every field of this same resolved set, so the reference always
          // resolves.
          for (const [field, cssProperty] of Object.entries(TYPOGRAPHY_CSS_PROPERTIES)) {
            if (!Object.prototype.hasOwnProperty.call(style, field)) continue;
            insert(cssProperty, `var(${typo(TYPOGRAPHY_PROPERTIES[field as keyof typeof TYPOGRAPHY_PROPERTIES])})`);
          }

          at.remove();
        };

        // @ds-typo(h1). MIG-B6-14 (FEAT-008): only a direct child of `rule`,
        // matching @ds-surface/@ds-button/@ds-input below — otherwise a
        // @ds-typo nested inside a @media/@supports under this rule would
        // be silently applied as if it were responsive, instead of being
        // left for the final UXD_DIRECTIVE_CONTEXT pass to reject.
        rule.walkAtRules("ds-typo", (at) => { if (at.parent === rule) applyTypo(at, at.params || ""); });
      });
      // Token maps are always computed so references (`shadow()`, `radius()`,
      // `density()`, `@ds-surface`/`@ds-button`/`@ds-input`) keep validating
      // and resolving against the effective theme. Only the `:root`
      // definitions themselves are gated by includeTheme. The theme JSON is the
      // only source of a token: there is no in-stylesheet pack to merge.
      const effectiveShadows = getShadowTokens(effectiveTheme);
      const edgeTokens = getEdgeTokens(effectiveTheme);
      const effectiveDensities = getDensityTokens(effectiveTheme);

      // Stability phase 1 (audit T10): the whole theme is one string —
      // `renderThemeCss`, the exact bytes `generateThemeCss` returns — inserted
      // at one place. Its `@import`s go right after the author's `@charset` and
      // leading comments (MIG-B7-14: the theme's imports first, then the
      // author's, in written order); every other block goes after the author's
      // whole prelude (`@charset`, body-less `@layer`, `@import`s, comments)
      // and *before* the author's rules. Until now only the imports and the
      // density block went there and every other family was appended after
      // the author's rules, so an author's own `:root { --uxdsl__… }` override
      // silently lost to the theme's later declaration of the same name.
      if (includeTheme) {
        const nodes = [...themeGenerated(renderThemeCss(effectiveTheme, bps))];
        const imports = nodes.filter((node) => node.type === 'atrule' && node.name === 'import');
        const blocks = nodes.filter((node) => !imports.includes(node));
        // A parsed string's first node has no leading raw; after an author's
        // prelude it gets a newline so it never glues onto the previous node.
        // Every other node keeps the raw it was parsed with: PostCSS's
        // `Root.normalize` rewrites the `before` of a node inserted after a
        // sibling to that sibling's own, which would turn the renderer's
        // ` @media` into `\n@media` and break byte-identity with
        // `generateThemeCss`.
        const inserted = (keep: (node: ChildNode) => boolean, group: ChildNode[]) => {
          if (!group.length) return;
          const parsedBefore = new Map(group.map((node) => [node, node.raws.before]));
          if (root.nodes.some(keep) && !group[0].raws.before) parsedBefore.set(group[0], '\n');
          insertAfterLeading(root, keep, group);
          for (const node of group) node.raws.before = parsedBefore.get(node);
        };
        inserted(isCharsetOrComment, imports);
        inserted(isPrelude, blocks);
      }

      // After tokens are known, expand @ds-surface and @ds-button using packs
      root.walkRules((rule) => {
        rule.walkAtRules('ds-input', at => {
          if (at.parent !== rule) return;
          try {
            rejectQuotedArguments(at);
            const { role, tone, size, radius, shadow } = parseInputArguments(effectiveTheme, at.params);
            const generated = postcss.parse(inputComponentCss(effectiveTheme, rule.selector, role, tone, size, radius, shadow));
            const base = generated.nodes.shift() as Rule;
            for (const declaration of [...(base.nodes || [])]) rule.insertBefore(at, inheritSource(declaration, at.source));
            let anchor: any = rule;
            for (const state of [...generated.nodes]) { rule.parent!.insertAfter(anchor, inheritSource(state, at.source)); anchor = state; }
            at.remove();
          } catch (error) {
            throw locateError(error, at);
          }
        });
        // @ds-surface(variant [tone])
        rule.walkAtRules("ds-surface", (at) => {
          if (at.parent !== rule) return;
          try {
            rejectQuotedArguments(at);
            let inner = String((at.params || "").trim());
            if (inner.startsWith("(") && inner.endsWith(")"))
              inner = inner.slice(1, -1).trim();
            const { role: variant, tone: toneFamily, size: sizeToken, radius: radiusOverride, shadow: shadowOverride } = parseSurfaceArguments(effectiveTheme, inner);
            const props = surfaceDeclarations(effectiveTheme, variant, toneFamily, sizeToken, radiusOverride, shadowOverride);
            const insert = (prop: string, value: string) => {
              (rule as any).insertBefore(at, { prop, value, source: at.source });
            };
            Object.keys(props).forEach((k) => insert(k, props[k]!));
            at.remove();
          } catch (error) {
            throw locateError(error, at);
          }
        });

        rule.walkAtRules('ds-button', at => {
          if (at.parent !== rule) return;
          try {
            rejectQuotedArguments(at);
            const { role, tone, size, radius, shadow } = parseButtonArguments(effectiveTheme, at.params);
            const generated = postcss.parse(buttonComponentCss(effectiveTheme, rule.selector, role, tone, size, radius, shadow));
            const base = generated.nodes.shift() as Rule;
            for (const declaration of [...(base.nodes || [])]) rule.insertBefore(at, inheritSource(declaration, at.source));
            let anchor: any = rule;
            for (const state of [...generated.nodes]) { rule.parent!.insertAfter(anchor, inheritSource(state, at.source)); anchor = state; }
            at.remove();
          } catch (error) {
            throw locateError(error, at);
          }
        });
      });

      // Collect root-level $vars and remove the declarations
      root.each((node) => {
        if (
          node.type === "decl" &&
          typeof (node as Declaration).prop === "string" &&
          (node as Declaration).prop.startsWith("$")
        ) {
          const d = node as Declaration;
          const name = d.prop.slice(1);
          vars[name] = d.value as string;
          d.remove();
        }
      });

      // MIG-B6-14 (FEAT-008): $var substitutions must happen BEFORE the
      // responsive-expansion walk below, not after it. That walk decides
      // whether a declaration is responsive by looking for a breakpoint
      // function in its CURRENT value — a declaration whose value is still
      // the literal string "$gap" never matches, so a $var holding a
      // responsive expression (`$gap: xs(1rem) md(2rem);`) used to reach
      // output as the literal, invalid text `gap: xs(1rem) md(2rem);`
      // instead of being split into media queries the way the CLI (which
      // resolves $vars via postcss-advanced-variables before this plugin
      // ever runs) already does.
      const varNames = Object.keys(vars);
      if (varNames.length > 0) {
        const varRefRE = /\$([a-zA-Z_][\w-]*)/g;
        root.walkDecls((decl) => {
          if (typeof decl.value !== "string" || generated.has(decl)) return;
          decl.value = decl.value.replace(varRefRE, (_m, name) => {
            return Object.prototype.hasOwnProperty.call(vars, name)
              ? vars[name]
              : _m;
          });
        });
      }

      function resolveValueForBp(input: string, targetBp: string): string {
        return resolveResponsiveValue(input, targetBp, bps);
      }

      function rewriteFuncs(input: string, _forProp?: string): string {
        const p = valueParser(input);
        p.walk((node: any) => {
          if (node.type !== 'function') return;
          // A spelling the language no longer has: fail, naming the replacement.
          const removed = removedSyntaxMessage(node.value, valueParser.stringify(node.nodes));
          if (removed) throw diagnostic(removed, valueParser.stringify(node));
          if (node.value === 'density') {
            const key = valueParser.stringify(node.nodes).trim();
            if (!/^[\w-]+$/.test(key) || !Object.prototype.hasOwnProperty.call(effectiveDensities, key)) {
              throw diagnostic(missingKeyMessage('UXD_DENSITY_REFERENCE', 'density', key, Object.keys(effectiveDensities)), valueParser.stringify(node));
            }
            node.type = 'word'; node.value = `var(${buildVarName('density', key)})`; return;
          }
          if (node.value === 'radius') {
            const key = valueParser.stringify(node.nodes).trim();
            if (RADIUS_KEYWORDS[key] || Object.prototype.hasOwnProperty.call(edgeTokens.radii, key)) {
              node.type = 'word';
              node.value = RADIUS_KEYWORDS[key] || `var(${buildVarName('radius', key)})`;
              return;
            }
            // `full` was an alias of `pill`; a theme that defines its own
            // `radii.full` took the branch above.
            if (key === 'full') throw diagnostic(REMOVED_RADIUS_FULL, valueParser.stringify(node));
            throw diagnostic(missingKeyMessage('UXD_EDGE_REFERENCE', node.value, key, [...Object.keys(edgeTokens.radii), ...Object.keys(RADIUS_KEYWORDS)]), valueParser.stringify(node));
          }
          if (node.value === 'shadow') {
            const key = valueParser.stringify(node.nodes).trim();
            if (!Object.prototype.hasOwnProperty.call(effectiveShadows, key)) throw diagnostic(missingKeyMessage('UXD_SHADOW_REFERENCE', node.value, key, Object.keys(effectiveShadows)), valueParser.stringify(node));
            node.type = 'word';
            node.value = `var(${buildVarName('shadow', key)})`;
            return;
          }
          // Border helper: border(n[, color][, style])
          if (node.value === 'border') {
            const key = valueParser.stringify(node.nodes).split(',')[0].trim();
            if (!Object.prototype.hasOwnProperty.call(edgeTokens.borders, key)) throw diagnostic(missingKeyMessage('UXD_EDGE_REFERENCE', 'border', key, Object.keys(edgeTokens.borders)), valueParser.stringify(node));
            node.type = 'word';
            node.value = `var(${buildVarName('border', key)})`;
            return;
          }
          if (node.value === 'tone') {
            throw diagnostic('UXD_TONE_CONTEXT: tone() is only valid inside a theme\'s buttons/inputs values, where a requested tone can supply it; a stylesheet names the tone through @ds-button(role tone) or @ds-input(role tone).', valueParser.stringify(node));
          }
          if (['palette', 'color', 'space'].includes(node.value)) {
            node.type = 'word';
            node.value = tokenValueToCss(`${node.value}(${valueParser.stringify(node.nodes)})`);
            return false;
          }
        });
        return p.toString().trim();
      }

      // Walk the author's declarations to handle palette()/space() and responsive bp(...) values
      root.walkDecls((decl) => {
        try {
          if (typeof decl.value !== "string" || generated.has(decl)) return;
        // Phase 1: replace palette()/space() so nested calls inside xs()/md() are resolved
        const phase1Text = rewriteFuncs(decl.value, (decl as any).prop);

        // Phase 2: extract responsive values
        const parsed = valueParser(phase1Text);
        let hasResponsive = false;
        // MIG-B6-14 (FEAT-008): a top-level function that is neither a
        // configured breakpoint nor a known CSS function used to reach CSS
        // untouched (e.g. `padding: xs(1rem) xxl(2rem);` -> literal,
        // invalid `xxl(2rem)` in the output). Only the top-level of the
        // value counts — a function nested inside e.g. calc(...) is that
        // function's own argument, never a breakpoint candidate. Collected
        // in the same pass that finds real breakpoint functions so
        // `hasResponsive` below is fully known before either condition
        // (co-occurrence, edit distance) is evaluated for any of them.
        const suspiciousFunctions: string[] = [];
        for (const node of parsed.nodes) {
          if (node.type !== 'function') continue;
          if (bpNames.has(node.value)) { hasResponsive = true; continue; }
          if (!(KNOWN_CSS_FUNCTIONS as readonly string[]).includes(node.value)) suspiciousFunctions.push(node.value);
        }
        for (const name of suspiciousFunctions) {
          const distanceOne = Array.from(bpNames).some(bp => editDistance(name.toLowerCase(), bp.toLowerCase()) === 1);
          if (hasResponsive || distanceOne) {
            throw diagnostic(
              `UXD_BREAKPOINT_UNKNOWN: ${name}(...) is not a configured breakpoint or a known CSS function; ` +
              `configured breakpoints: ${Array.from(bpNames).join(', ')}.`
            );
          }
        }
        if (!hasResponsive) { decl.value = parsed.toString().trim(); return; }
        const resolved = ordered.map(({name: bp}) => ({ bp, text: rewriteFuncs(resolveResponsiveValue(phase1Text, bp, bps)) }));
        const baseOut = resolved[0]?.text || '';
        const others = resolved.filter((entry, index) => index > 0 && entry.text && entry.text !== resolved[index - 1].text);
        decl.value = baseOut;

        const parentNode = decl.parent;
        if (!parentNode || parentNode.type !== "rule") {
          const parentFallback: any = parentNode;
          const rootFallback =
            typeof parentFallback?.root === "function"
              ? parentFallback.root()
              : root;
          others.forEach(({ bp, text }) => {
            const bpPx = bps[bp];
            if (typeof bpPx !== "number" || Number.isNaN(bpPx)) return;
            const at = postcss.atRule({
              name: "media",
              params: `(min-width: ${bpPx}px)`,
            });
            const cloned = parentFallback?.clone
              ? parentFallback.clone({ nodes: [] })
              : postcss.rule();
            // MIG-B6-15 (FEAT-008): `decl.important` is a separate flag from
            // `decl.value` (PostCSS already strips the literal `!important`
            // text out when parsing) — omitting it here silently dropped
            // `!important` from every breakpoint but the base one, so a
            // competing, non-responsive `!important` declaration elsewhere
            // in the cascade could still win at md/lg/xl.
            // Stability phase 1: a declaration derived from the author's keeps
            // the author's own formatting (`raws`). Without them PostCSS infers
            // the style from the first formatted node in the tree — a generated
            // one-line `:root` block now — and the author's media clones would
            // silently follow the theme's layout instead of the author's.
            cloned.append({ prop: decl.prop, value: text, important: decl.important, source: decl.source, raws: { ...decl.raws } });
            (at as any).append(cloned);
            if (
              parentFallback &&
              parentFallback !== rootFallback &&
              typeof rootFallback?.insertAfter === "function"
            ) {
              rootFallback.insertAfter(parentFallback, at as any);
            } else if (typeof rootFallback?.append === "function") {
              rootFallback.append(at as any);
            }
          });
          if (!baseOut) decl.remove();
          return;
        }

        const parentRule = parentNode as Rule;
        const rootNode = parentRule.root();
        let bucket = mediaRuleCache.get(parentRule);
        if (!bucket) {
          bucket = new Map<string, Rule>();
          mediaRuleCache.set(parentRule, bucket);
        }

        others.forEach(({ bp, text }) => {
          const bpPx = bps[bp];
          if (typeof bpPx !== "number" || Number.isNaN(bpPx)) return;
          let targetRule = bucket.get(bp);
          if (!targetRule) {
            const at = postcss.atRule({
              name: "media",
              params: `(min-width: ${bpPx}px)`,
            });
            const cloned = parentRule.clone({ nodes: [] });
            at.append(cloned);
            const lastInserted = lastMediaByRule.get(parentRule);
            const parentContainer = parentRule.parent || rootNode;
            
            if (lastInserted) {
              parentContainer.insertAfter(lastInserted, at);
            } else {
              parentContainer.insertAfter(parentRule, at);
            }
            lastMediaByRule.set(parentRule, at);
            bucket.set(bp, cloned);
            targetRule = cloned;
          }
          targetRule.append({ prop: decl.prop, value: rewriteFuncs(text), important: decl.important, source: decl.source, raws: { ...decl.raws } });
        });
        if (!baseOut) decl.remove();
        } catch (error) {
          throw locateError(error, decl);
        }
      });

      // Reuse the same resolver after substitutions and media cloning — over
      // the author's nodes only; the generated theme is already resolved.
      root.walkDecls(decl => {
        try {
          if (typeof decl.value === 'string' && !generated.has(decl)) decl.value = rewriteFuncs(decl.value);
        } catch (error) {
          throw locateError(error, decl);
        }
      });
      // MIG-B6-14 (FEAT-008): a final, generic pass over every reserved-namespace
      // at-rule (`ds` or `ds-*`) still left in the tree. Every directive handler
      // above only consumes an occurrence that is a *direct* child of the rule
      // it's walked from (`if (at.parent !== rule) return;`, or the equivalent
      // for @ds-typo above) — anything still here is either misspelled/nonexistent
      // (UXD_DIRECTIVE_UNKNOWN) or a real directive used at the document root or
      // nested inside another at-rule such as @media/@supports
      // (UXD_DIRECTIVE_CONTEXT: directives style a whole rule and are not
      // responsive — D-3). One rule, no per-directive special-casing, so a
      // browser never silently discards an at-rule this plugin never processed.
      const knownDirectives: string[] = LANGUAGE_COMPLETIONS.directives.filter(name => name.startsWith('ds-'));
      root.walkAtRules(at => {
        if (at.name !== 'ds' && !at.name.startsWith('ds-')) return;
        if (knownDirectives.includes(at.name)) {
          throw locateError(diagnostic(
            'UXD_DIRECTIVE_CONTEXT: Directives apply to a whole rule and are not responsive; ' +
            'use responsive values on the properties instead, e.g. padding: xs(…) md(…).'
          ), at);
        }
        const suggestion = closestKey(at.name, knownDirectives);
        throw locateError(diagnostic(
          `UXD_DIRECTIVE_UNKNOWN: Unknown directive @${at.name}.${suggestion ? ` Did you mean @${suggestion}?` : ''}`
        ), at);
      });

      const consumers: Declaration[] = [];
      root.walkDecls(node => {
        if (!originalSources.has(node.source) || dslSources.has(node.source)) consumers.push(node);
      });
      const references = effectiveReferences || {};
      // A component validates against its explicitly configured theme without
      // emitting globals. Dependency CSS remains validation-only as well.
      const css = [...(references.css || [])];
      if (!includeTheme && effectiveTheme && references.mode !== 'off') {
        css.push(renderThemeCss(effectiveTheme, bps));
      }
      enforceReferences(root, consumers, { ...references, css,
        onWarning: issue => { result.warn(issue.message, { node: (issue as any).node, plugin: 'postcss-uxdsl' }); references.onWarning?.(issue); },
      });
    },
  };
}

(uxdslPlugin as any).postcss = true;

// MIG-B6-27 (FEAT-008): this module is `export =` — a PostCSS plugin is a
// callable, and that cannot change without breaking every existing
// `require('postcss-uxdsl')` — so the public types are merged into the
// function's own namespace instead. That is what makes `import type {
// UxdslTheme } from 'postcss-uxdsl'` resolve for a consumer, under both
// `require` and `import`, without inventing a second entry point for types.
// A namespace cannot re-export with `export ... from`, hence the import types.
declare namespace uxdslPlugin {
  export type UxdslOptions = import('./types').UxdslOptions;
  export type UxdslTheme = import('./types').UxdslTheme;
  export type UxdslThemeOverride = import('./types').UxdslThemeOverride;
  export type UxdslDeepPartial<T> = import('./types').UxdslDeepPartial<T>;
  export type UxdslTokenValue = import('./types').UxdslTokenValue;
  export type UxdslPaletteFamily = import('./types').UxdslPaletteFamily;
  export type UxdslColorFamily = import('./types').UxdslColorFamily;
  export type UxdslFonts = import('./types').UxdslFonts;
  export type UxdslMode = import('./types').UxdslMode;
  export type UxdslTypographyRole = import('./types').UxdslTypographyRole;
  export type UxdslTypographyField = import('./types').UxdslTypographyField;
  export type UxdslSurfaceRole = import('./types').UxdslSurfaceRole;
  export type UxdslSurfaceField = import('./types').UxdslSurfaceField;
  export type UxdslButtonRole = import('./types').UxdslButtonRole;
  export type UxdslButtonField = import('./types').UxdslButtonField;
  export type UxdslButtonState = import('./types').UxdslButtonState;
  export type UxdslInputRole = import('./types').UxdslInputRole;
  export type UxdslInputField = import('./types').UxdslInputField;
  export type UxdslInputState = import('./types').UxdslInputState;
  export type UxdslConfig = import('./types').UxdslConfig;
  export type UxdslConfigShared = import('./types').UxdslConfigShared;
  export type UxdslBuild = import('./types').UxdslBuild;
}

export = uxdslPlugin;
