import { enforceReferences, ReferenceOptions } from './reference-integrity';
import { renderThemeCss } from './ds-runtime/theme-generator';
import { validateTheme, themeValidationError } from './ds-runtime/theme-validate';
import { getInputTokens, inputComponentCss, parseInputArguments } from './inputs';
import { getButtonTokens, buttonComponentCss, parseButtonArguments } from './buttons';
import { getSurfaceTokens, surfaceDeclarations, parseSurfaceArguments } from './surfaces';
import { getShadowTokens } from './shadows';
import { getEdgeTokens, DEFAULT_BORDER_COLORS, RADIUS_KEYWORDS } from './edges';
import { directiveInner, parseTypoArguments } from './directives';
import { buildVarName } from './naming';
import { resolveTheme } from './default-theme';
import { diagnostic, locateError, missingKeyMessage, closestKey, formatKeyList, editDistance } from './diagnostics';
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
import { resolveResponsiveValue, analyzeResponsiveValue, getDensityTokens, removedSyntaxMessage, parseTokenReference, tokenReferenceToCss, TOKEN_FUNCTIONS, REMOVED_RADIUS_FULL, LANGUAGE_COMPLETIONS, KNOWN_CSS_FUNCTIONS } from './language';
import type { TokenReference } from './language';
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
      const KNOWN_FUNCTION_NAMES = new Set((KNOWN_CSS_FUNCTIONS as readonly string[]).map((name) => name.toLowerCase()));
      /** The top-level, comma-separated arguments of a function node, as written. */
      const tokenArguments = (node: any): string[] => {
        const groups: any[][] = [[]];
        for (const child of node.nodes) {
          if (child.type === 'div' && child.value === ',') groups.push([]);
          else groups[groups.length - 1].push(child);
        }
        const args = groups.map((group) => valueParser.stringify(group).trim());
        return args.length === 1 && args[0] === '' ? [] : args;
      };
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

      // Directives: one grammar (src/directives.ts), one pass, in source
      // order. Each directive must be a direct child of the rule it styles —
      // anything else is left for the final UXD_DIRECTIVE_CONTEXT pass — and a
      // rule takes each of them once: a second @ds-button, or a @ds-button
      // next to a @ds-input, would emit two competing sets of states, so it
      // is UXD_DIRECTIVE_DUPLICATE at the second occurrence.
      const expandTypo = (rule: Rule, at: AtRule) => {
        const role = parseTypoArguments(directiveInner('ds-typo', at.params, at.raws.afterName));
        // Exactly the fields the effective theme defines for this role, and
        // nothing else: no literal fallbacks the theme never asked for.
        const details = (effectiveTheme.typography_details || {}) as Record<string, Record<string, string>>;
        const style = resolveTypographyRole(details, role);
        if (!style) throw diagnostic(missingKeyMessage('UXD_TYPO_REFERENCE', 'ds-typo', role, Object.keys(details)));
        // Consumer side of typography.ts's compileTypographyRules, which emits
        // `--uxdsl__typography__<role>-<field>`; the same builder composes the
        // name so definition and reference always match. Iterating the property
        // map keeps the emitted order canonical whatever the JSON's own order.
        for (const [field, cssProperty] of Object.entries(TYPOGRAPHY_CSS_PROPERTIES)) {
          if (!Object.prototype.hasOwnProperty.call(style, field)) continue;
          rule.insertBefore(at, { prop: cssProperty, value: `var(${buildVarName('typography', `${role}-${TYPOGRAPHY_PROPERTIES[field as keyof typeof TYPOGRAPHY_PROPERTIES]}`)})`, source: at.source });
        }
      };
      const expandSurface = (rule: Rule, at: AtRule) => {
        const { role, tone, size, radius, shadow } = parseSurfaceArguments(effectiveTheme, directiveInner('ds-surface', at.params, at.raws.afterName));
        const props = surfaceDeclarations(effectiveTheme, role, tone, size, radius, shadow);
        for (const [prop, value] of Object.entries(props)) rule.insertBefore(at, { prop, value, source: at.source });
      };
      const expandControl = (rule: Rule, at: AtRule, name: 'ds-button' | 'ds-input') => {
        const inner = directiveInner(name, at.params, at.raws.afterName);
        const { role, tone, size, radius, shadow } = name === 'ds-button' ? parseButtonArguments(effectiveTheme, inner) : parseInputArguments(effectiveTheme, inner);
        const componentCss = name === 'ds-button' ? buttonComponentCss : inputComponentCss;
        const generated = postcss.parse(componentCss(effectiveTheme, rule.selector, role, tone, size, radius, shadow));
        const base = generated.nodes.shift() as Rule;
        for (const declaration of [...(base.nodes || [])]) rule.insertBefore(at, inheritSource(declaration, at.source));
        let anchor: ChildNode = rule;
        for (const state of [...generated.nodes]) { rule.parent!.insertAfter(anchor, inheritSource(state, at.source)); anchor = state; }
      };
      root.walkRules((rule) => {
        const seen = new Map<string, AtRule>();
        for (const node of [...rule.nodes]) {
          if (node.type !== 'atrule' || !/^ds-(surface|button|input|typo)$/i.test(node.name)) continue;
          const at = node as AtRule;
          const name = at.name.toLowerCase() as 'ds-surface' | 'ds-button' | 'ds-input' | 'ds-typo';
          // A second control directive would emit a second, competing set of
          // states; a surface or typography directive repeated, or followed by
          // a declaration, is ordinary cascade (the later one wins).
          if (name === 'ds-button' || name === 'ds-input') {
            const earlier = seen.get('control');
            if (earlier) {
              throw locateError(diagnostic(
                `UXD_DIRECTIVE_DUPLICATE: @${name}${at.params} repeats @${earlier.name}${earlier.params} in the same rule; a rule takes one @ds-button or @ds-input. ` +
                'Choose one role, or split the selectors into two rules.'
              ), at);
            }
            seen.set('control', at);
          }
          try {
            if (name === 'ds-typo') expandTypo(rule, at);
            else if (name === 'ds-surface') expandSurface(rule, at);
            else expandControl(rule, at, name);
          } catch (error) {
            throw locateError(error, at);
          }
          at.remove();
        }
      });

      // The standalone plugin resolves root-level $variables only. A `$var`
      // declared inside a rule is the SCSS subset's block scope, which
      // uxdsl-core (the CLI and the adapters) resolves before this plugin runs;
      // here it would reach CSS as an invalid declaration, so it is an error
      // naming that pipeline. Collect the root-level ones and remove them.
      root.walkDecls((decl) => {
        if (decl.prop.startsWith('$') && decl.parent !== root) {
          throw locateError(diagnostic(
            `UXD_VARIABLE_CONTEXT: ${decl.prop} is declared inside a rule; the PostCSS plugin on its own resolves $variables declared at the root of the file. ` +
            'Move it to the root, or compile through uxdsl-core / uxdsl build, whose SCSS subset has block scope.'
          ), decl);
        }
      });
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
      const varRefRE = /\$([a-zA-Z_][\w-]*)/g;
      root.walkDecls((decl) => {
        if (typeof decl.value !== "string" || generated.has(decl)) return;
        if (Object.keys(vars).length > 0) {
          decl.value = decl.value.replace(varRefRE, (_m, name) => {
            return Object.prototype.hasOwnProperty.call(vars, name)
              ? vars[name]
              : _m;
          });
        }
        // A `$name` still in the value names a variable nothing declared
        // (strings are left alone: `content: "$5"` is text).
        for (const node of valueParser(decl.value).nodes) {
          if (node.type === 'word' && /^\$[a-zA-Z_][\w-]*$/.test(node.value)) {
            throw locateError(diagnostic(
              `UXD_VARIABLE_UNDEFINED: ${node.value} is not defined; declare it at the root of the file (${node.value}: …;) before this rule.`, node.value
            ), decl);
          }
        }
      });

      function resolveValueForBp(input: string, targetBp: string): string {
        return resolveResponsiveValue(input, targetBp, bps);
      }

      // The author-side pass of the one value grammar: every token function
      // is parsed by language.ts (count, key shape, alpha, dotted path) and
      // its reference checked here against the effective theme — with the
      // family's own code and a "did you mean" — before it is serialized. The
      // reference-integrity pass over the emitted stylesheet stays the second
      // net, for `var()` an author wrote by hand and for theme values.
      const effectiveColors: Record<string, unknown> = { ...effectiveTheme.colors, gray: { ...DEFAULT_BORDER_COLORS.gray, ...effectiveTheme.colors?.gray } };
      const effectivePalette: Record<string, unknown> = effectiveTheme.palette || {};
      const effectiveSpacing: Record<string, unknown> = effectiveTheme.spacing || {};
      const tokenContext = { palette: effectivePalette, colors: effectiveColors };
      // A token the host guarantees (`references.externalTokens`) or another
      // compiled entry declares (`references.css`) is as good as one the theme
      // defines; the reference pass checks the same set, once, at the end.
      let externalNames: Set<string> | undefined;
      const declaredExternally = (name: string) => {
        if (!externalNames) {
          externalNames = new Set(effectiveReferences?.externalTokens || []);
          for (const css of effectiveReferences?.css || []) {
            try { postcss.parse(css).walkDecls((declaration) => { if (declaration.prop.startsWith('--')) externalNames!.add(declaration.prop); }); } catch { /* an unparsable dependency is the reference pass's own error */ }
          }
        }
        return externalNames.has(name);
      };
      const checkReference = (reference: TokenReference, call: string) => {
        const { kind, key } = reference;
        if (declaredExternally(buildVarName(kind, key))) return;
        if (kind === 'space' && !Object.prototype.hasOwnProperty.call(effectiveSpacing, key)) throw diagnostic(missingKeyMessage('UXD_SPACE_REFERENCE', 'space', key, Object.keys(effectiveSpacing)), call);
        if (kind === 'density' && !Object.prototype.hasOwnProperty.call(effectiveDensities, key)) throw diagnostic(missingKeyMessage('UXD_DENSITY_REFERENCE', 'density', key, Object.keys(effectiveDensities)), call);
        if (kind === 'radius' && !RADIUS_KEYWORDS[key] && !Object.prototype.hasOwnProperty.call(edgeTokens.radii, key)) {
          // `full` was an alias of `pill`; a theme that defines its own `radii.full` passed above.
          throw diagnostic(key === 'full' ? REMOVED_RADIUS_FULL : missingKeyMessage('UXD_EDGE_REFERENCE', 'radius', key, [...Object.keys(edgeTokens.radii), ...Object.keys(RADIUS_KEYWORDS)]), call);
        }
        if (kind === 'border' && !Object.prototype.hasOwnProperty.call(edgeTokens.borders, key)) throw diagnostic(missingKeyMessage('UXD_EDGE_REFERENCE', 'border', key, Object.keys(edgeTokens.borders)), call);
        if (kind === 'shadow' && !Object.prototype.hasOwnProperty.call(effectiveShadows, key)) throw diagnostic(missingKeyMessage('UXD_SHADOW_REFERENCE', 'shadow', key, Object.keys(effectiveShadows)), call);
        if (kind === 'palette' || kind === 'color') {
          const map = kind === 'palette' ? effectivePalette : effectiveColors;
          const code = kind === 'palette' ? 'UXD_PALETTE_REFERENCE' : 'UXD_COLOR_REFERENCE';
          const family = reference.family!;
          const entry = map[family];
          const path = reference.written;
          if (entry === undefined) {
            const suggestion = closestKey(family, Object.keys(map));
            throw diagnostic(`${code}: ${kind}(${path}) does not exist; available families: ${formatKeyList(Object.keys(map))}.${suggestion ? ` Did you mean "${suggestion}"?` : ''}`, call);
          }
          if (typeof entry !== 'object' || entry === null) {
            if (reference.variant) throw diagnostic(`${code}: ${kind}(${path}) does not exist; ${family} is a standalone color, written ${kind}(${family}).`, call);
            return;
          }
          if (!Object.prototype.hasOwnProperty.call(entry, reference.variant!)) {
            const variants = Object.keys(entry as Record<string, unknown>);
            const suggestion = closestKey(reference.variant!, variants);
            throw diagnostic(`${code}: ${kind}(${path}) does not exist; ${family} has: ${variants.join(', ')}.${suggestion ? ` Did you mean "${suggestion}"?` : ''}`, call);
          }
        }
      };
      function rewriteFuncs(input: string): string {
        const p = valueParser(input);
        p.walk((node: any) => {
          if (node.type !== 'function') return;
          const name = String(node.value).toLowerCase();
          const call = valueParser.stringify(node);
          // A spelling the language no longer has: fail, naming the replacement.
          const removed = removedSyntaxMessage(name, valueParser.stringify(node.nodes));
          if (removed) throw diagnostic(removed, call);
          if (name === 'tone') {
            throw diagnostic('UXD_TONE_CONTEXT: tone() is only valid inside a theme\'s buttons/inputs values, where a requested tone can supply it; a stylesheet names the tone through @ds-button(role tone) or @ds-input(role tone).', call);
          }
          if (!Object.prototype.hasOwnProperty.call(TOKEN_FUNCTIONS, name)) return;
          const kind = TOKEN_FUNCTIONS[name];
          const args = tokenArguments(node);
          // A native `color(display-p3 …)`/`color(from …)` is not a token.
          if (kind === 'color' && args.length && !/^[\w.-]+$/.test(args[0])) return;
          let reference: TokenReference;
          try { reference = parseTokenReference(kind, args, tokenContext); } catch (error) { throw diagnostic((error as Error).message, call); }
          checkReference(reference, call);
          node.type = 'word';
          node.value = tokenReferenceToCss(reference);
          return false;
        });
        return p.toString().trim();
      }

      // Walk the author's declarations to handle palette()/space() and responsive bp(...) values
      const emptied = new Set<Rule>();
      root.walkDecls((decl) => {
        try {
          if (typeof decl.value !== "string" || generated.has(decl)) return;
        // The structure of the responsive expression, before anything is
        // rewritten: a breakpoint function nested in another function, an
        // empty argument, `!important` inside a group, or a group without a
        // base next to other content would all reach CSS as text (or as a
        // value whose shape changes between breakpoints); each is an error.
        const structure = analyzeResponsiveValue(decl.value, bps);
        if (structure.nested) {
          const { name, parent, names, inner } = structure.nested;
          const hint = bpNames.has(parent)
            ? `a breakpoint function cannot nest in another (${parent}(${name}(…)))`
            : `write the breakpoint functions at the top level of the value and ${parent}() inside each group: ${names.map((bp) => `${bp}(${parent}(${resolveResponsiveValue(inner, bp, bps)}))`).join(' ')}`;
          throw diagnostic(`UXD_BREAKPOINT_CONTEXT: ${name}(…) is nested inside ${parent}(…); ${hint}.`, `${name}(`);
        }
        if (structure.groups.length) {
          for (let ancestor: any = decl.parent; ancestor; ancestor = ancestor.parent) {
            if (ancestor.type !== 'atrule') continue;
            const atName = String(ancestor.name).toLowerCase().replace(/^-\w+-/, '');
            if (['keyframes', 'font-face', 'page', 'counter-style'].includes(atName)) {
              throw diagnostic(`UXD_BREAKPOINT_CONTEXT: a responsive value cannot live inside @${ancestor.name}: a media query cannot be nested there. Set the responsive value on a custom property outside it and read var() here, or write the block once per breakpoint.`);
            }
          }
          const baseName = ordered[0].name;
          for (const group of structure.groups) {
            if (group.empty.length) throw diagnostic(`UXD_BREAKPOINT_EMPTY: ${group.empty[0]}() has no value; write the value inside the parentheses, or remove the breakpoint.`, `${group.empty[0]}(`);
            if (group.important) throw diagnostic(`UXD_BREAKPOINT_IMPORTANT: !important belongs after the groups, not inside one; write ${decl.prop}: ${decl.value.replace(/\s*!important/gi, '')} !important, which applies it at every breakpoint.`);
            if (!structure.standalone && !group.hasBase) {
              const first = `${group.names[0]}(`;
              throw diagnostic(`UXD_BREAKPOINT_BASE: ${group.text} has no ${baseName}() value, so "${decl.prop}" would have a different number of parts below ${group.names[0]}; give the group a ${baseName}() base, or make the whole value one responsive expression.`, first);
            }
          }
        }
        // Phase 1: replace palette()/space() so nested calls inside xs()/md() are resolved
        const phase1Text = rewriteFuncs(decl.value);

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
          const fn = node.value.toLowerCase();
          if (bpNames.has(fn)) { hasResponsive = true; continue; }
          if (!KNOWN_FUNCTION_NAMES.has(fn)) suspiciousFunctions.push(node.value);
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
        const emptiedRules = emptied;
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
        if (!baseOut) {
          decl.remove();
          // A rule the split emptied is removed with its last declaration: an
          // empty `.a {}` is not what the author wrote.
          if (parentRule.nodes.length === 0) emptiedRules.add(parentRule);
        }
        } catch (error) {
          throw locateError(error, decl);
        }
      });
      for (const rule of emptied) rule.remove();

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
        const name = at.name.toLowerCase();
        if (name !== 'ds' && !name.startsWith('ds-')) return;
        if (knownDirectives.includes(name)) {
          throw locateError(diagnostic(
            'UXD_DIRECTIVE_CONTEXT: Directives apply to a whole rule and are not responsive; ' +
            'use responsive values on the properties instead, e.g. padding: xs(…) md(…).'
          ), at);
        }
        const suggestion = closestKey(name, knownDirectives);
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
