import { generateFoundationCss } from './foundations';
import { enforceReferences, ReferenceOptions } from './reference-integrity';
import { generateThemeCss } from './ds-runtime/theme-generator';
import { getInputTokens, generateInputCss, inputComponentCss, parseInputArguments } from './inputs';
import { getButtonTokens, generateButtonCss, buttonComponentCss, parseButtonArguments } from './buttons';
import { generateSurfaceCss, getSurfaceTokens, surfaceDeclarations, parseSurfaceArguments } from './surfaces';
import { generateShadowCss, getShadowTokens } from './shadows';
import { generateEdgeCss, getEdgeTokens, RADIUS_KEYWORDS } from './edges';
import { buildVarName, buildNamespacedVarName } from './naming';
import { resolveTheme } from './default-theme';
import { diagnostic, locateError, missingKeyMessage, closestKey, editDistance } from './diagnostics';
import { discoverThemeSync } from './config';
// PostCSS plugin for a tiny UX DSL (TypeScript)
// Features:
// - Root-level "$var: value;" variable declarations
// - $var substitutions inside declaration values
// - palette(path-to-token) -> CSS var mapping
// - Responsive value functions: xs(...), sm(...), md(...), lg(...), xl(...)

import type { AtRule, Declaration, Result, Root, Rule } from "postcss";
import postcss from "postcss";
import valueParser from "postcss-value-parser";
import { presetValueToCss } from './preset-engine';
import { compileDensityRules, resolveResponsiveValue, getDensityTokens, LANGUAGE_COMPLETIONS, KNOWN_CSS_FUNCTIONS } from './language';
import { generateTypographyCss, TYPOGRAPHY_DEFAULTS } from './typography';
import { DEFAULT_BREAKPOINTS as DEFAULT_BPS } from "./ds-runtime/breakpoints";

type BreakpointSpec =
  | Record<string, number>
  | Array<[string, number]>
  | Array<{ name: string; min?: number; px?: number }>;

interface UxDslOptions {
  breakpoints?: BreakpointSpec;
  themeVar?: (path: string) => string;
  spaceVar?: (index: string) => string;
  colorVar?: (path: string) => string;
  theme?: Record<string, any>;
  /**
   * Whether this compilation emits the global `:root` token definitions
   * (foundations, typography, density, shadows, edges, surfaces, buttons,
   * inputs). Defaults to `true`, matching the historical single-entry
   * behavior where one compiled file both defines and consumes tokens.
   *
   * Set to `false` for a component/CSS-Module entry that only consumes
   * tokens a separate `includeTheme: true` entry already defines — for
   * example, one shared theme import plus several CSS Module files. This
   * avoids re-emitting duplicate global declarations and the bare `:root`
   * selector that CSS Modules loaders reject as impure. Token references
   * (`space()`, `palette()`, `density()`, `@ds-surface`, `@ds-button`,
   * `@ds-input`, ...) still resolve and validate normally either way —
   * only the definitions themselves are skipped.
   */
  includeTheme?: boolean;
  references?: ReferenceOptions;
  /**
   * When `theme` is omitted (and this isn't `false`), the plugin looks for
   * a conventional `uxdsl.theme.config.{cjs,js,json}`/`uxdsl.theme.json` in
   * `configRoot` (default `process.cwd()`) and validates/compiles against
   * it instead of the built-in default theme — the same discovery
   * uxdsl-cli has always done, now available with the plugin used
   * directly (e.g. from a project's own `postcss.config.js`). An explicit
   * `theme` always wins outright; this has no effect when one is given.
   * Set to `false` to keep the old always-default-theme behavior.
   */
  discoverTheme?: boolean;
  /** Directory theme discovery searches from. Defaults to `process.cwd()`.
   * Ignored when `theme` is explicit or `discoverTheme` is `false`. */
  configRoot?: string;
}

// Map palette(foo.bar|foo-bar) -> resolve to --uxdsl__palette__*
const defaultThemeVar = (path: string) => {
  const key = String(path).trim().replace(/\./g, "-");
  return `var(${buildNamespacedVarName('palette', key)})`;
};

// Map space(2) -> var(--uxdsl__space__2)
const defaultSpaceVar = (index: string) =>
  `var(${buildVarName('space', String(index).trim())})`;

// Map color(blue.500|blue-500) -> resolve to --uxdsl__color__*
const defaultColorVar = (path: string) => {
  const key = String(path).trim().replace(/\./g, "-");
  return `var(${buildNamespacedVarName('color', key)})`;
};

function normalizeBreakpoints(input?: BreakpointSpec) {
  if (!input) {
    const ordered = Object.entries(DEFAULT_BPS).map(([n, px]) => ({
      name: n,
      px,
    }));
    return { map: { ...DEFAULT_BPS }, ordered };
  }
  if (Array.isArray(input)) {
    const entries = input.map((it) =>
      Array.isArray(it)
        ? { name: it[0], px: Number(it[1]) }
        : { name: it.name, px: Number(it.min ?? (it as any).px) }
    );
    const map: Record<string, number> = {};
    entries.forEach(({ name, px }) => {
      if (name) map[name] = px;
    });
    const ordered = entries.slice().sort((a, b) => a.px - b.px);
    return { map, ordered };
  }
  const map: Record<string, number> = { ...(input as Record<string, number>) };
  const ordered = Object.keys(map)
    .map((k) => ({ name: k, px: Number(map[k]) }))
    .sort((a, b) => a.px - b.px);
  return { map, ordered };
}

function uxdslPlugin(opts: UxDslOptions = {}) {
  const toVar =
    typeof opts.themeVar === "function" ? opts.themeVar : defaultThemeVar;
  const toSpaceVar =
    typeof opts.spaceVar === "function" ? opts.spaceVar : defaultSpaceVar;
  const toColorVar =
    typeof opts.colorVar === "function" ? opts.colorVar : defaultColorVar;
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
      // MIG-B2-02: the effective theme — DEFAULT_THEME with whatever the
      // caller provided (or, absent that, whatever discovery found) deep-
      // merged on top — is resolved once here and used everywhere
      // `opts.theme` used to be read directly below, so an omitted or
      // partial theme (`{}`, or just `{ palette: { primary: { main: ... } } }`)
      // still produces a fully-defined, strictly-valid effective theme
      // instead of leaving whichever families the caller didn't mention
      // undefined.
      // MIG-B6-29 (FEAT-008): the *unresolved* caller/discovered theme, kept
      // separate from `effectiveTheme` below. Once DEFAULT_THEME started
      // carrying its own shadows/borders/radii/surfaces/buttons/inputs
      // (previously all absent from it), every `effectiveTheme?.<family>`
      // read further down silently stopped meaning "what the caller
      // explicitly asked for" and started meaning "that, or the default if
      // they didn't" — which made a legacy `@theme { shadow-2: ... }`
      // declaration always lose to DEFAULT_THEME's own shadow-2, even
      // though the caller never touched shadows.2 at all. `rawTheme` is
      // used everywhere a legacy `@theme{}` block needs to know whether a
      // field was genuinely overridden, so "defaults < legacy < explicit
      // override" (this story's own required precedence) holds regardless
      // of how populated DEFAULT_THEME is.
      const rawTheme = (opts.theme ?? discovered?.theme) as Record<string, any> | undefined;
      const effectiveTheme = resolveTheme(rawTheme);
      const effectiveReferences = opts.references ?? discovered?.references as ReferenceOptions | undefined;
      const { map: bps, ordered } = normalizeBreakpoints(opts.breakpoints ?? (effectiveTheme.breakpoints ? { ...DEFAULT_BPS, ...effectiveTheme.breakpoints } : undefined));
      const bpNames = new Set(Object.keys(bps));
      const inheritSource = (node: any, source: any) => {
        node.source = source;
        for (const child of node.nodes || []) inheritSource(child, source);
        return node;
      };
      const originalSources = new Set<Declaration['source']>();
      const dslSources = new Set<Declaration['source']>();
      root.walkDecls(node => {
        originalSources.add(node.source);
        if (/\b(space|density|radius|rounded|border|shadow|elevation|palette|color)\(/.test(node.value)) dslSources.add(node.source);
      });
      if (effectiveTheme && includeTheme) {
        root.append(postcss.parse(generateFoundationCss(effectiveTheme)).nodes);
        root.append(postcss.parse(generateTypographyCss(effectiveTheme, bps)).nodes);

        if (effectiveTheme.fonts) {
            if (effectiveTheme.fonts.google && Array.isArray(effectiveTheme.fonts.google)) {
                // Reverse order so they end up in correct order when prepended
                [...effectiveTheme.fonts.google].reverse().forEach((font: string) => {
                    const url = `https://fonts.googleapis.com/css2?family=${font}&display=swap`;
                    const importRule = postcss.atRule({ name: 'import', params: `url('${url}')` });
                    root.prepend(importRule);
                });
            }
        }
      }
      const vars: Record<string, string> = Object.create(null);
      // Selector-scoped typography directives.
      // MIG-B6-14 (FEAT-008): only @ds-typo(h1) is supported — @ds(h1) and
      // @ds-h1 were never implemented despite an older comment claiming
      // otherwise; both now fall through to the final pass below and fail
      // as UXD_DIRECTIVE_UNKNOWN instead of reaching CSS untouched.
      root.walkRules((rule) => {
        const applyTypo = (at: any, variantRaw: string) => {
          let tag = String(variantRaw || "").trim();
          if (
            (tag.startsWith('"') && tag.endsWith('"')) ||
            (tag.startsWith("'") && tag.endsWith("'"))
          ) {
            tag = tag.slice(1, -1);
          }
          if (tag.startsWith("(") && tag.endsWith(")")) {
            tag = tag.slice(1, -1).trim();
          }
          tag = tag.toLowerCase();

          const insert = (prop: string, value: string) => {
            at.parent.insertBefore(at, { prop, value, source: at.source });
          };

          // Typography Configuration Data
          // Defines defaults for each known variant. 
          // If a variant isn't here, we can still attempt to generate generic vars for it (future proofing).
          const defaults = TYPOGRAPHY_DEFAULTS;

          const config = defaults[tag] || { weight: "400", family: "ui", line: "1.5", spacing: "normal" };
          const isCode = tag === "pre" || tag === "code";

          // Consumer side of typography.ts's compileTypographyRules, which
          // emits `--uxdsl__typography__<tag>-<field>` (MIG-08: one shared
          // "typography" family, not the tag itself); `typo` composes that
          // name the same way so definition and reference always match.
          const typo = (field: string) => buildVarName('typography', `${tag}-${field}`);

          // 1. Font Family
          // Logic: var(--uxdsl__typography__tag-font-family, var(--uxdsl__font__configFamily))
          const fontRef = config.family === "code" ? `var(${buildVarName('font', 'code')})` : (config.family === "ui-2" ? `var(${buildVarName('font', 'ui-2')}, var(${buildVarName('font', 'ui')}))` : `var(${buildVarName('font', 'ui')})`);
          // Special case: code/pre often append 'monospace' directly in fallback
          const familyFallback = isCode ? `${fontRef}, monospace` : fontRef;
          insert("font-family", `var(${typo('font-family')}, ${familyFallback})`);

          // 2. Font Size
          insert("font-size", `var(${typo('size')})`);

          // 3. Line Height
          if (config.line) {
             insert("line-height", `var(${typo('line')}, ${config.line})`);
          }

          // 4. Font Weight (Skip for code usually, but consistent to add)
          if (config.weight) {
             insert("font-weight", `var(${typo('weight')}, ${config.weight})`);
          }

          // 5. Letter Spacing
          if (config.spacing) {
             insert("letter-spacing", `var(${typo('spacing')}, ${config.spacing})`);
          }

          // 6. Text Transform
          insert("text-transform", `var(${typo('transform')}, none)`);

          // 7. Text Decoration
          insert("text-decoration", `var(${typo('decoration')}, none)`);

          // 8. Font Style
          insert("font-style", `var(${typo('style')}, normal)`);

          // 9. Margin Block Start
          insert("margin-block-start", `var(${typo('margin-block-start')}, auto)`);

          // 10. Margin Block End
          insert("margin-block-end", `var(${typo('margin-block-end')}, auto)`);

          // 11. Opacity (Special for caption/small)
          if (config.opacity) {
             insert("opacity", `var(${typo('opacity')}, ${config.opacity})`);
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
      const densityTokens: Record<string, string> = Object.create(null);
      const radiusTokens: Record<string, string> = Object.create(null);
      const shadowTokens: Record<string, string> = Object.create(null);
      const borderTokens: Record<string, string> = Object.create(null);

      // Parse a button pack body "{ ... }" into base + states maps
      function parseButtonPack(rawVal: string): {
        base: Record<string, string>;
        states: Record<string, Record<string, string>>;
      } {
        const outBase: Record<string, string> = Object.create(null);
        const outStates: Record<string, Record<string, string>> = Object.create(
          null
        );
        let s = String(rawVal || "").trim();
        if (s.startsWith("{") && s.endsWith("}")) s = s.slice(1, -1);
        let i = 0;
        const N = s.length;
        const isWs = (ch: string) => /\s/.test(ch);
        function skipWs() {
          while (i < N && isWs(s[i]!)) i++;
        }
        function readUntilTopLevelSemi(): string {
          let depth = 0;
          let buf = "";
          while (i < N) {
            const ch = s[i]!;
            if (ch === "{") {
              depth++;
              buf += ch;
              i++;
              continue;
            }
            if (ch === "}" && depth > 0) {
              depth--;
              buf += ch;
              i++;
              continue;
            }
            if (ch === ";" && depth === 0) {
              i++;
              break;
            }
            buf += ch;
            i++;
          }
          return buf.trim();
        }
        while (i < N) {
          skipWs();
          if (i >= N) break;
          if (s[i] === "&" || s[i] === ":") {
            // Read state key up to '{'
            let key = "";
            while (i < N && s[i] !== "{") {
              key += s[i];
              i++;
            }
            key = key.trim();
            if (i < N && s[i] === "{") {
              i++; // skip '{'
              let depth = 1;
              let inner = "";
              while (i < N && depth > 0) {
                const ch = s[i]!;
                if (ch === "{") {
                  depth++;
                  inner += ch;
                  i++;
                  continue;
                }
                if (ch === "}") {
                  depth--;
                  if (depth === 0) {
                    i++;
                    break;
                  }
                  inner += ch;
                  i++;
                  continue;
                }
                inner += ch;
                i++;
              }
              const norm = key
                .replace(/^&/, "")
                .replace(/^:/, "")
                .trim()
                .toLowerCase();
              const stateDecls: Record<string, string> = Object.create(null);
              // Split inner by top-level ';'
              let j = 0;
              const M = inner.length;
              function readInnerUntilSemi(): string {
                let d = 0,
                  b = "";
                while (j < M) {
                  const ch2 = inner[j]!;
                  if (ch2 === "{") {
                    d++;
                    b += ch2;
                    j++;
                    continue;
                  }
                  if (ch2 === "}" && d > 0) {
                    d--;
                    b += ch2;
                    j++;
                    continue;
                  }
                  if (ch2 === ";" && d === 0) {
                    j++;
                    break;
                  }
                  b += ch2;
                  j++;
                }
                return b.trim();
              }
              while (j < M) {
                while (j < M && /\s/.test(inner[j]!)) j++;
                const line = readInnerUntilSemi();
                if (!line) break;
                const idx = line.indexOf(":");
                if (idx > 0) {
                  const k = line.slice(0, idx).trim().toLowerCase();
                  const v = line.slice(idx + 1).trim();
                  if (k) stateDecls[k] = v;
                }
              }
              if (Object.keys(stateDecls).length) outStates[norm] = stateDecls;
            }
            continue;
          }
          const chunk = readUntilTopLevelSemi();
          if (!chunk) break;
          const idx = chunk.indexOf(":");
          if (idx > 0) {
            const k = chunk.slice(0, idx).trim().toLowerCase();
            const v = chunk.slice(idx + 1).trim();
            if (k) outBase[k] = v;
          }
        }
        return { base: outBase, states: outStates };
      }

      // Collect theme-driven density tokens (generic only) and store globally
      root.walkAtRules("theme", (at) => {
        at.walkDecls((decl) => {
          const prop = String((decl as any).prop || "").trim();
          // Accept only generic: density-<n>
          const m = prop.match(/^density-([\w-]+)$/);
          if (m) {
            const n = m[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            densityTokens[key] = val;
          }
          // radius-<n>
          const r = prop.match(/^radius-(\d+)$/);
          if (r) {
            const n = r[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            radiusTokens[key] = val;

          }
          // shadow-<n>
          const s = prop.match(/^shadow-(\d+)$/);
          if (s) {
            const n = s[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            shadowTokens[key] = val;

          }
          // border-<n> (composite)
          const b = prop.match(/^border-(\d+)$/);
          if (b) {
            const n = b[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            borderTokens[key] = val;

          }
          // button packs: button-<variant>: { padding:..; radius:..; bg:..; color:..; border:..; }
          const pack = prop.match(/^button-([a-zA-Z][\w-]*)$/);
          if (pack) {
            const vname = pack[1].toLowerCase();
            const rawVal = String((decl as any).value || "").trim();
            if (rawVal.startsWith("{") && rawVal.endsWith("}")) {
              const parsed: any = parseButtonPack(rawVal);
              const surface = rawVal.match(/@ds-surface\s*\(\s*([a-z][a-z0-9-]*)\s*\)\s*;/);
              if (surface) parsed.surface = surface[1];
              (root as any).__btnPacks =
                (root as any).__btnPacks || Object.create(null);
              (root as any).__btnPacks[vname] = parsed;
            }
          }
          // surface packs: surface-<variant>: { padding:..; radius:..; bg:..; color:..; border:..; shadow:.. }
          const surf = prop.match(/^surface-([a-zA-Z][\w-]*)$/);
          if (surf) {
            const vname = surf[1].toLowerCase();
            const rawVal = String((decl as any).value || "").trim();
            if (rawVal.startsWith("{") && rawVal.endsWith("}")) {
              const parsed = parseButtonPack(rawVal);
              (root as any).__surfacePacks =
                (root as any).__surfacePacks || Object.create(null);
              (root as any).__surfacePacks[vname] = parsed.base;
            }
          }
          // input packs: input-<variant>: { padding.., radius.., bg.., color.., border.., shadow.., caret.., placeholder.. }
          const inp = prop.match(/^input-([a-zA-Z][\w-]*)$/);
          if (inp) {
            const vname = inp[1].toLowerCase();
            const rawVal = String((decl as any).value || "").trim();
            if (rawVal.startsWith("{") && rawVal.endsWith("}")) {
              const parsed = parseButtonPack(rawVal);
              (root as any).__inputPacks =
                (root as any).__inputPacks || Object.create(null);
              (root as any).__inputPacks[vname] = {
                base: parsed.base,
                states: parsed.states,
                ...(rawVal.match(/@ds-surface\s*\(\s*([a-z][a-z0-9-]*)\s*\)\s*;/) ? { surface: rawVal.match(/@ds-surface\s*\(\s*([a-z][a-z0-9-]*)\s*\)\s*;/)![1] } : {}),
              };

            }
          }
        });

        // Also support rule-form packs: `button-contained: { ... }`, `surface-contained: { ... }`, `input-contained: { ... }`
        at.walkRules((r) => {
          const sel = String((r as any).selector || "").trim();
          const mBtn = sel.match(/^button-([a-zA-Z][\w-]*):?$/);
          const mSurf = sel.match(/^surface-([a-zA-Z][\w-]*):?$/);
          const mInp = sel.match(/^input-([a-zA-Z][\w-]*):?$/);
          if (!mBtn && !mSurf && !mInp) return;
          const isSurface = !!mSurf;
          const isInput = !!mInp;
          const vname = (
            mBtn ? mBtn[1] : mSurf ? mSurf[1] : mInp![1]
          ).toLowerCase();
          const base: Record<string, string> = Object.create(null);
          const states: Record<string, Record<string, string>> = Object.create(
            null
          );
          (r.nodes || []).forEach((n: any) => {
            if (!n) return;
            if (n.type === "decl") {
              const k = String(n.prop || "")
                .trim()
                .toLowerCase();
              const v = String(n.value || "").trim();
              if (k) base[k] = v;
            } else if ((mBtn || mInp) && n.type === 'atrule' && n.name === 'ds-surface') {
              base.__surface = String(n.params).trim().replace(/^\((.*)\)$/, '$1').trim();
            } else if (!isSurface && n.type === "rule") {
              // Selector can be ':hover' or '&:hover'
              let st = String(n.selector || "").trim();
              st = st.replace(/^&/, "").replace(/^:/, "").toLowerCase();
              const sd: Record<string, string> = Object.create(null);
              (n.nodes || []).forEach((dn: any) => {
                if (dn && dn.type === "decl") {
                  const k = String(dn.prop || "")
                    .trim()
                    .toLowerCase();
                  const v = String(dn.value || "").trim();
                  if (k) sd[k] = v;
                }
              });
              if (st && Object.keys(sd).length) states[st] = sd;
            }
          });
          if (isSurface) {
            (root as any).__surfacePacks =
              (root as any).__surfacePacks || Object.create(null);
            (root as any).__surfacePacks[vname] = base;
          } else if (isInput) {
            (root as any).__inputPacks =
              (root as any).__inputPacks || Object.create(null);
            const surface = base.__surface;
            delete base.__surface;
            (root as any).__inputPacks[vname] = { base, states, ...(surface ? { surface } : {}) };
          } else {
            const surface = base.__surface;
            delete base.__surface;
            const parsed = { base, states, ...(surface ? { surface } : {}) };
            (root as any).__btnPacks =
              (root as any).__btnPacks || Object.create(null);
            (root as any).__btnPacks[vname] = parsed;
          }
        });
        // Remove @theme blocks from output
        at.remove();
      });

      // Token maps are always computed so references (`shadow()`, `radius()`,
      // `density()`, `@ds-surface`/`@ds-button`/`@ds-input`) keep validating
      // and resolving against the effective theme. Only the `:root`
      // definitions themselves are gated by includeTheme.
      const shadowTheme = { shadows: { ...shadowTokens, ...rawTheme?.shadows } };
      const effectiveShadows = getShadowTokens(shadowTheme);
      if (includeTheme) root.append(postcss.parse(generateShadowCss(shadowTheme, bps)).nodes);

      const edgeTheme = { borders: { ...borderTokens, ...rawTheme?.borders }, radii: { ...radiusTokens, ...rawTheme?.radii } };
      const edgeTokens = getEdgeTokens(edgeTheme);
      if (includeTheme) root.append(postcss.parse(generateEdgeCss(edgeTheme, bps)).nodes);

      // MIG-B6-29: same rawTheme reasoning as shadows/edges/surfaces/buttons/
      // inputs above — getDensityTokens's own `{...DEFAULT_DENSITIES,
      // ...legacy, ...theme.densities}` already gives `theme.densities`
      // top precedence, which is only correct when `theme` is the
      // *unresolved* override, not `effectiveTheme` (which now always
      // carries DEFAULT_THEME's own densities too).
      const effectiveDensities = getDensityTokens(rawTheme, densityTokens);
      // Generate CSS variables for density tokens
      if (includeTheme) {
        for (const compiled of compileDensityRules(effectiveDensities, bps)) {
          const rule = postcss.rule({ selector: ':root' });
          for (const [prop, value] of Object.entries(compiled.values)) rule.append({ prop, value });
          if (compiled.minWidth === null) root.prepend(rule);
          else {
            const media = postcss.atRule({ name: 'media', params: `(min-width: ${compiled.minWidth}px)` });
            media.append(rule);
            root.append(media);
          }
        }
      }

      getSurfaceTokens({ surfaces: effectiveTheme?.surfaces }); // Validate JSON before merging legacy fields.
      const legacySurfaces = (root as any).__surfacePacks || {};
      const surfaceOverrides: Record<string, any> = { ...legacySurfaces };
      for (const [role, style] of Object.entries(rawTheme?.surfaces || {})) surfaceOverrides[role] = { ...legacySurfaces[role], ...(style as any) };
      const effectiveSurfaceTheme = { ...effectiveTheme, ...edgeTheme, ...shadowTheme, surfaces: surfaceOverrides, densities: effectiveDensities };
      if (includeTheme) root.append(postcss.parse(generateSurfaceCss(effectiveSurfaceTheme, bps)).nodes);
      getButtonTokens({ ...effectiveSurfaceTheme, buttons: effectiveTheme?.buttons });
      const buttonOverrides: Record<string, any> = { ...((root as any).__btnPacks || {}) };
      for (const [role, pack] of Object.entries(rawTheme?.buttons || {}) as [string, any][]) {
        const legacy = buttonOverrides[role] || {};
        const states = { ...legacy.states };
        for (const [state, fields] of Object.entries(pack.states || {})) states[state] = { ...states[state], ...(fields as any) };
        buttonOverrides[role] = { ...legacy, ...pack, base: { ...legacy.base, ...pack.base }, states };
      }
      const effectiveButtonTheme = { ...effectiveSurfaceTheme, buttons: buttonOverrides };
      if (includeTheme) root.append(postcss.parse(generateButtonCss(effectiveButtonTheme, bps)).nodes);
      getInputTokens({ ...effectiveSurfaceTheme, inputs: effectiveTheme?.inputs });
      const inputOverrides: Record<string, any> = { ...((root as any).__inputPacks || {}) };
      for (const [role, pack] of Object.entries(rawTheme?.inputs || {}) as [string, any][]) {
        const legacy = inputOverrides[role] || {};
        const states = { ...legacy.states };
        for (const [state, fields] of Object.entries(pack.states || {})) states[state] = { ...states[state], ...(fields as any) };
        inputOverrides[role] = { ...legacy, ...pack, base: { ...legacy.base, ...pack.base }, states };
      }
      const effectiveInputTheme = { ...effectiveSurfaceTheme, inputs: inputOverrides };
      if (includeTheme) root.append(postcss.parse(generateInputCss(effectiveInputTheme, bps)).nodes);

      // After tokens are known, expand @ds-surface and @ds-button using packs
      root.walkRules((rule) => {
        rule.walkAtRules('ds-input', at => {
          if (at.parent !== rule) return;
          try {
            const { role, tone, size, radius, shadow } = parseInputArguments(effectiveInputTheme, at.params);
            const generated = postcss.parse(inputComponentCss(effectiveInputTheme, rule.selector, role, tone, size, radius, shadow));
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
            let inner = String((at.params || "").trim());
            if (
              (inner.startsWith('"') && inner.endsWith('"')) ||
              (inner.startsWith("'") && inner.endsWith("'"))
            )
              inner = inner.slice(1, -1);
            if (inner.startsWith("(") && inner.endsWith(")"))
              inner = inner.slice(1, -1).trim();
            const { role: variant, tone: toneFamily, size: sizeToken, radius: radiusOverride, shadow: shadowOverride } = parseSurfaceArguments(effectiveSurfaceTheme, inner);
            const props = surfaceDeclarations(effectiveSurfaceTheme, variant, toneFamily, sizeToken, radiusOverride, shadowOverride);
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
            const { role, tone, size, radius, shadow } = parseButtonArguments(effectiveButtonTheme, at.params);
            const generated = postcss.parse(buttonComponentCss(effectiveButtonTheme, rule.selector, role, tone, size, radius, shadow));
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
          if (typeof decl.value !== "string") return;
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
          // Token-aware density helpers
          if (
            node.type === "function" &&
            (node.value === "density" || node.value === "densities")
          ) {
            const ordered = Object.keys(bps)
              .map((name) => ({ name, px: (bps as any)[name] as number }))
              .filter((it) => typeof it.px === "number" && !Number.isNaN(it.px))
              .sort((a, b) => a.px - b.px);

            const innerText = valueParser.stringify(node.nodes).trim();

            if (node.value === "density") {
              const key = innerText.trim().replace(/^(['"])(.*)\1$/, '$2');
              if (!/^[\w-]+$/.test(key) || !Object.prototype.hasOwnProperty.call(effectiveDensities, key)) {
                throw diagnostic(missingKeyMessage('UXD_DENSITY_REFERENCE', 'density', key, Object.keys(effectiveDensities)), valueParser.stringify(node));
              }
              node.type = 'word'; node.value = `var(${buildVarName('density', key)})`; return;
            } else {
              const rawVals = innerText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const steps: number[] = rawVals
                .map((s) => parseInt(s.replace(/[^-\d]/g, ""), 10))
                .filter((n) => !Number.isNaN(n));
              if (steps.length > 0 && ordered.length > 0) {
                const parts = ordered.map((bp, i) => {
                  const step =
                    typeof steps[i] === "number"
                      ? steps[i]
                      : steps[steps.length - 1];
                  return `${bp.name}(space(${step}))`;
                });
                node.type = "word";
                node.value = parts.join(" ");
                return;
              }
            }
            return;
          }
          // Radius helpers: radius(n) or rounded(n)
          if (
            node.type === "function" &&
            (node.value === "radius" || node.value === "rounded")
          ) {
            const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
            if (RADIUS_KEYWORDS[key] || Object.prototype.hasOwnProperty.call(edgeTokens.radii, key)) {
              node.type = 'word';
              node.value = RADIUS_KEYWORDS[key] || `var(${buildVarName('radius', key)})`;
              return;
            }
            throw diagnostic(missingKeyMessage('UXD_EDGE_REFERENCE', node.value, key, [...Object.keys(edgeTokens.radii), ...Object.keys(RADIUS_KEYWORDS)]), valueParser.stringify(node));
          }
          // Shadow helpers: shadow(n) or elevation(n)
          if (
            node.type === "function" &&
            (node.value === "shadow" || node.value === "elevation")
          ) {
            const key = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
            if (!Object.prototype.hasOwnProperty.call(effectiveShadows, key)) throw diagnostic(missingKeyMessage('UXD_SHADOW_REFERENCE', node.value, key, Object.keys(effectiveShadows)), valueParser.stringify(node));
            node.type = 'word';
            node.value = `var(${buildVarName('shadow', key)})`;
            return;
          }
          // Border helper: border(n[, color][, style])
          if (node.type === "function" && node.value === "border") {
            const key = valueParser.stringify(node.nodes).split(',')[0].trim().replace(/^(['"])(.*)\1$/, '$2');
            if (!Object.prototype.hasOwnProperty.call(edgeTokens.borders, key)) throw diagnostic(missingKeyMessage('UXD_EDGE_REFERENCE', 'border', key, Object.keys(edgeTokens.borders)), valueParser.stringify(node));
            node.type = 'word';
            node.value = `var(${buildVarName('border', key)})`;
            return;
          }
          if (node.type === 'function' && ['palette', 'color', 'space'].includes(node.value)) {
            node.type = 'word';
            node.value = presetValueToCss(`${node.value}(${valueParser.stringify(node.nodes)})`, 'UXD_TOKEN', { palette: toVar, color: toColorVar, space: toSpaceVar });
            return false;
          }
        });
        return p.toString().trim();
      }

      // Walk declarations to handle palette()/space() and responsive bp(...) values
      root.walkDecls((decl) => {
        try {
          if (typeof decl.value !== "string") return;
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
            cloned.append({ prop: decl.prop, value: text, important: decl.important, source: decl.source });
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
          targetRule.append({ prop: decl.prop, value: rewriteFuncs(text), important: decl.important, source: decl.source });
        });
        if (!baseOut) decl.remove();
        } catch (error) {
          throw locateError(error, decl);
        }
      });

      // Reuse the same resolver after substitutions and media cloning.
      root.walkDecls(decl => {
        try {
          if (typeof decl.value === 'string') decl.value = rewriteFuncs(decl.value);
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
        css.push(generateThemeCss({ ...effectiveInputTheme, buttons: buttonOverrides, breakpoints: bps }, { mode: 'off' }));
      }
      enforceReferences(root, consumers, { ...references, css,
        onWarning: issue => { result.warn(issue.message, { node: (issue as any).node, plugin: 'postcss-uxdsl' }); references.onWarning?.(issue); },
      });
    },
  };
}

(uxdslPlugin as any).postcss = true;

export = uxdslPlugin;
