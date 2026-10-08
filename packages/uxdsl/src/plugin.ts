// The UXDSL PostCSS plugin.
//
//   Values      root-level `$var` declarations and substitutions; the token
//               functions space(), density(), color(), palette(), radius(),
//               border(), shadow(); responsive functions named after the
//               theme's breakpoints (xs() md() …), `!important` preserved at
//               every breakpoint.
//   Directives  @ds-surface, @ds-button, @ds-input, @ds-typo — each expanding
//               to the declarations its role defines, states and
//               pseudo-elements included. A directive is a direct child of the
//               rule it styles, or it fails as UXD_DIRECTIVE_CONTEXT rather
//               than passing through untouched.
//   Theme       The effective theme comes from the `theme` option or, when it
//               is omitted, from conventional theme-file discovery
//               (`discoverTheme`/`configRoot`). `includeTheme: false` compiles
//               an entry that only consumes tokens another entry defines.
//   Integrity   Every emitted var() is checked against a real definition
//               (`references`), failing the build by default rather than
//               shipping a dangling token.
//   Diagnostics Errors carry a UXD_* code from the catalog (./diagnostics)
//               and a source position; generated theme globals deliberately
//               carry no source, so a source map lists only files the author
//               actually wrote.
//
// One compilation is one `Compilation` object, built by `validateOptions` and
// handed through `emitTheme`, `expandDirectives`, `resolveVariables`,
// `expandResponsive`, `rejectLeftoverDirectives` and `checkReferences`, in that
// order. Nothing is stored on the PostCSS root or on the plugin instance.

import type { AtRule, ChildNode, Declaration, Result, Root, Rule } from 'postcss';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { enforceReferences, ReferenceOptions } from './reference-integrity';
import { renderThemeCss } from './ds-runtime/theme-generator';
import { validateTheme, themeValidationError } from './ds-runtime/theme-validate';
import { inputComponentCss, parseInputArguments } from './inputs';
import { buttonComponentCss, parseButtonArguments } from './buttons';
import { surfaceDeclarations, parseSurfaceArguments } from './surfaces';
import { getShadowTokens } from './shadows';
import { getEdgeTokens, DEFAULT_BORDER_COLORS, RADIUS_KEYWORDS } from './edges';
import { directiveInner, parseTypoArguments } from './directives';
import { buildVarName } from './naming';
import { resolveTheme } from './default-theme';
import { diagnostic, locateError, missingKeyMessage, closestKey, formatKeyList, editDistance, DIAGNOSTIC_CATALOG as CATALOG } from './diagnostics';
import { discoverThemeSync } from './config';
import {
  resolveResponsiveValue, analyzeResponsiveValue, getDensityTokens, removedSyntaxMessage, parseTokenReference, tokenReferenceToCss,
  TOKEN_FUNCTIONS, REMOVED_RADIUS_FULL, LANGUAGE_COMPLETIONS, KNOWN_CSS_FUNCTIONS,
} from './language';
import type { TokenReference, TokenContext } from './language';
import { TYPOGRAPHY_PROPERTIES, resolveTypographyRole } from './typography';
import { DEFAULT_BREAKPOINTS } from './ds-runtime/breakpoints';
import type { UxdslOptions } from './types';

const PLUGIN = 'uxdsl';

// The plugin options `breakpoints`, `themeVar`, `spaceVar` and `colorVar` are
// gone: thresholds are the theme's own `breakpoints` family and the emitted
// names are the `--uxdsl__<family>__<key>` contract. A caller that still
// passes one is told so and the option is ignored, never thrown on.
const REMOVED_OPTIONS: Record<string, string> = {
  breakpoints: 'breakpoints are configured in the theme (`theme.breakpoints`)',
  themeVar: 'palette() always compiles to var(--uxdsl__palette__<key>)',
  spaceVar: 'space() always compiles to var(--uxdsl__space__<key>)',
  colorVar: 'color() always compiles to var(--uxdsl__color__<key>)',
};

const KNOWN_FUNCTION_NAMES = new Set((KNOWN_CSS_FUNCTIONS as readonly string[]).map((name) => name.toLowerCase()));
const DIRECTIVE_NAMES: string[] = LANGUAGE_COMPLETIONS.directives.filter((name) => name.startsWith('ds-'));
const UNSPLITTABLE_AT_RULES = ['keyframes', 'font-face', 'page', 'counter-style'];

/** Everything one compilation knows, built by `validateOptions` and read by every later step. */
interface Compilation {
  root: Root;
  result: Result;
  includeTheme: boolean;
  /** The effective theme: DEFAULT_THEME with the override deep-merged on top, validated. */
  theme: Record<string, any>;
  references: ReferenceOptions;
  bps: Record<string, number>;
  ordered: Array<{ name: string; px: number }>;
  bpNames: Set<string>;
  /** Token maps of the effective theme, for the author-side reference checks. */
  densities: Record<string, string>;
  edges: ReturnType<typeof getEdgeTokens>;
  shadows: Record<string, string>;
  spacing: Record<string, unknown>;
  palette: Record<string, unknown>;
  colors: Record<string, unknown>;
  tokenContext: TokenContext;
  /** Nodes the theme emitted; the value passes skip them. */
  generated: WeakSet<ChildNode>;
  /** Declarations the author wrote, and those among them that use a token function. */
  originalSources: Set<Declaration['source']>;
  dslSources: Set<Declaration['source']>;
  /** Custom properties the host guarantees or another entry declares, read lazily. */
  externalNames?: Set<string>;
}

// --- validateOptions ---------------------------------------------------------

/** Resolves and validates the theme and options; the result is the only state every later step reads. */
function validateOptions(root: Root, result: Result, opts: UxdslOptions): Compilation {
  // Discovery runs per compilation, not once when the plugin factory runs: a
  // reused plugin instance (a dev server, two projects in one process) must
  // not keep serving the first project's theme, or a stale copy from before an
  // edit to the theme file on disk.
  const configRoot = opts.configRoot ?? process.cwd();
  let discovered: ReturnType<typeof discoverThemeSync> = null;
  if (opts.theme === undefined && opts.discoverTheme !== false) {
    discovered = discoverThemeSync(configRoot);
    if (discovered) {
      for (const file of discovered.dependencies) {
        result.messages.push({ type: 'dependency', plugin: PLUGIN, file, parent: result.opts.from });
      }
    }
  }
  // The effective theme — DEFAULT_THEME with whatever the caller provided (or,
  // absent that, whatever discovery found) deep-merged on top — is the only
  // theme every step reads, and the exact object `generateThemeCss` resolves
  // for the same input: the theme JSON is the only source of a token.
  const theme = resolveTheme(opts.theme ?? discovered?.theme);
  // The one validator, on the effective theme, before any engine reads it —
  // the same call `generateThemeCss` and `applyTheme` make. References are
  // checked once, at the end, on the stylesheet actually emitted.
  const validated = validateTheme(theme, { references: false });
  if (!validated.ok) throw themeValidationError(validated.errors);
  for (const warning of validated.warnings) result.warn(warning.message, { plugin: PLUGIN });
  for (const [name, instead] of Object.entries(REMOVED_OPTIONS)) {
    if ((opts as Record<string, unknown>)[name] !== undefined) {
      result.warn(`UXD_OPTION_REMOVED: the "${name}" plugin option was removed and is ignored; ${instead}.`, { plugin: PLUGIN });
    }
  }
  // The one breakpoint map of this compilation: the effective theme's.
  const bps: Record<string, number> = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints };
  const ordered = Object.entries(bps).map(([name, px]) => ({ name, px })).sort((a, b) => a.px - b.px);
  const originalSources = new Set<Declaration['source']>();
  const dslSources = new Set<Declaration['source']>();
  root.walkDecls((node) => {
    originalSources.add(node.source);
    if (/\b(space|density|radius|border|shadow|palette|color)\(/.test(node.value)) dslSources.add(node.source);
  });
  const colors = { ...theme.colors, gray: { ...DEFAULT_BORDER_COLORS.gray, ...theme.colors?.gray } };
  const palette = theme.palette || {};
  return {
    root, result, theme, bps, ordered, originalSources, dslSources,
    includeTheme: opts.includeTheme !== false,
    references: (opts.references ?? discovered?.references ?? {}) as ReferenceOptions,
    bpNames: new Set(Object.keys(bps)),
    // Token maps are always computed so references keep validating against
    // the effective theme; only the `:root` definitions are gated by includeTheme.
    densities: getDensityTokens(theme),
    edges: getEdgeTokens(theme),
    shadows: getShadowTokens(theme),
    spacing: theme.spacing || {},
    palette, colors,
    tokenContext: { palette, colors },
    generated: new WeakSet<ChildNode>(),
  };
}

// --- emitTheme ---------------------------------------------------------------

const atRuleName = (node: ChildNode) => (node.type === 'atrule' ? node.name.toLowerCase() : '');
const isCharsetOrComment = (node: ChildNode) => node.type === 'comment' || atRuleName(node) === 'charset';
const isPrelude = (node: ChildNode) =>
  isCharsetOrComment(node) || atRuleName(node) === 'import' || (atRuleName(node) === 'layer' && !(node as AtRule).nodes);

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

/** Gives `node` and its descendants `source` (a generated node gets `undefined`, so a source map lists only real files). */
function inheritSource<T extends { source?: unknown; nodes?: any[] }>(node: T, source: unknown): T {
  node.source = source as any;
  for (const child of node.nodes || []) inheritSource(child, source);
  return node;
}

/**
 * Inserts the whole theme — `renderThemeCss`, the exact bytes `generateThemeCss`
 * returns — at one place: its `@import`s right after the author's `@charset`
 * and leading comments, every other block after the author's whole prelude
 * (`@charset`, body-less `@layer`, `@import`s, comments) and before the
 * author's rules. CSS honors an `@import` only before every other rule and
 * `@charset` only first, and an author's own `:root { --uxdsl__… }` then
 * follows the theme's declaration and wins the cascade. Nothing the author
 * wrote is reordered.
 */
function emitTheme(c: Compilation) {
  if (!c.includeTheme) return;
  const parsed = inheritSource(postcss.parse(renderThemeCss(c.theme, c.bps)), undefined);
  for (const node of parsed.nodes) { c.generated.add(node); (node as any).walk?.((child: ChildNode) => { c.generated.add(child); }); }
  const nodes = [...parsed.nodes];
  const imports = nodes.filter((node) => node.type === 'atrule' && node.name === 'import');
  const blocks = nodes.filter((node) => !imports.includes(node));
  // A parsed string's first node has no leading raw; after an author's prelude
  // it gets a newline so it never glues onto the previous node. Every other
  // node keeps the raw it was parsed with: PostCSS's `Root.normalize` would
  // otherwise rewrite the `before` of a node inserted after a sibling to that
  // sibling's own and break byte-identity with `generateThemeCss`.
  const inserted = (keep: (node: ChildNode) => boolean, group: ChildNode[]) => {
    if (!group.length) return;
    const parsedBefore = new Map(group.map((node) => [node, node.raws.before]));
    if (c.root.nodes.some(keep) && !group[0].raws.before) parsedBefore.set(group[0], '\n');
    insertAfterLeading(c.root, keep, group);
    for (const node of group) node.raws.before = parsedBefore.get(node);
  };
  inserted(isCharsetOrComment, imports);
  inserted(isPrelude, blocks);
}

// --- expandDirectives --------------------------------------------------------

/**
 * One grammar (./directives), one pass, in source order. `@theme { … }` packs
 * are not part of the language (the theme JSON is the only place a token is
 * defined) and fail naming where their contents go. Each directive must be a
 * direct child of the rule it styles — anything else is left for
 * `rejectLeftoverDirectives` — and a rule takes one control directive: a second
 * @ds-button, or a @ds-button next to a @ds-input, would emit two competing
 * sets of states. A repeated @ds-surface or @ds-typo is ordinary cascade.
 */
function expandDirectives(c: Compilation) {
  c.root.walkAtRules(/^theme$/i, (at) => {
    throw locateError(diagnostic(
      'UXD_THEME_BLOCK_REMOVED: @theme blocks were removed; define these tokens in the theme JSON ' +
      '(uxdsl.theme.json): density-<k> under "densities", radius-<k> under "radii", border-<k> under "borders", ' +
      'shadow-<k> under "shadows", and surface-/button-/input-<role> packs under "surfaces", "buttons" and "inputs".'
    ), at);
  });
  const expandTypo = (rule: Rule, at: AtRule) => {
    const role = parseTypoArguments(directiveInner('ds-typo', at.params, at.raws.afterName));
    // Exactly the fields the effective theme defines for this role, nothing
    // else: no literal fallbacks the theme never asked for. The variable name
    // is composed the way typography.ts defines it, so definition and
    // reference always match; iterating the property map keeps the emitted
    // order canonical whatever the JSON's own order.
    const details = (c.theme.typography_details || {}) as Record<string, Record<string, string>>;
    const style = resolveTypographyRole(details, role);
    if (!style) throw diagnostic(missingKeyMessage('UXD_TYPO_REFERENCE', 'ds-typo', role, Object.keys(details)));
    for (const [field, property] of Object.entries(TYPOGRAPHY_PROPERTIES)) {
      if (!Object.prototype.hasOwnProperty.call(style, field)) continue;
      rule.insertBefore(at, { prop: property, value: `var(${buildVarName('typography', `${role}-${property}`)})`, source: at.source });
    }
  };
  const expandSurface = (rule: Rule, at: AtRule) => {
    const { role, tone, size, radius, shadow } = parseSurfaceArguments(c.theme, directiveInner('ds-surface', at.params, at.raws.afterName));
    const props = surfaceDeclarations(c.theme, role, tone, size, radius, shadow);
    for (const [prop, value] of Object.entries(props)) rule.insertBefore(at, { prop, value, source: at.source });
  };
  const expandControl = (rule: Rule, at: AtRule, name: 'ds-button' | 'ds-input') => {
    const inner = directiveInner(name, at.params, at.raws.afterName);
    const { role, tone, size, radius, shadow } = name === 'ds-button' ? parseButtonArguments(c.theme, inner) : parseInputArguments(c.theme, inner);
    const componentCss = name === 'ds-button' ? buttonComponentCss : inputComponentCss;
    const generated = postcss.parse(componentCss(c.theme, rule.selector, role, tone, size, radius, shadow));
    const base = generated.nodes.shift() as Rule;
    for (const declaration of [...(base.nodes || [])]) rule.insertBefore(at, inheritSource(declaration, at.source));
    let anchor: ChildNode = rule;
    for (const state of [...generated.nodes]) { rule.parent!.insertAfter(anchor, inheritSource(state, at.source)); anchor = state; }
  };
  c.root.walkRules((rule) => {
    let control: AtRule | undefined;
    for (const node of [...rule.nodes]) {
      if (node.type !== 'atrule' || !/^ds-(surface|button|input|typo)$/i.test(node.name)) continue;
      const at = node as AtRule;
      const name = at.name.toLowerCase() as 'ds-surface' | 'ds-button' | 'ds-input' | 'ds-typo';
      if (name === 'ds-button' || name === 'ds-input') {
        if (control) {
          throw locateError(diagnostic(
            `UXD_DIRECTIVE_DUPLICATE: @${name}${at.params} repeats @${control.name}${control.params} in the same rule; a rule takes one @ds-button or @ds-input. ` +
            'Choose one role, or split the selectors into two rules.'
          ), at);
        }
        control = at;
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
}

// --- resolveVariables --------------------------------------------------------

/**
 * Root-level `$var` declarations are collected, removed and substituted into
 * every author declaration — before the responsive pass, which decides whether
 * a declaration is responsive by looking at its current value, so a `$var`
 * holding `xs(…) md(…)` splits into media queries like an inline expression.
 * A `$var` declared inside a rule is the SCSS subset's block scope, which
 * compile() (the CLI and the adapters) resolves before this plugin runs; here
 * it would reach CSS as an invalid declaration, so it is an error naming that
 * pipeline. A `$name` nothing declared is an error too.
 */
function resolveVariables(c: Compilation) {
  const { root } = c;
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('$') && decl.parent !== root) {
      throw locateError(diagnostic(
        `UXD_VARIABLE_CONTEXT: ${decl.prop} is declared inside a rule; the PostCSS plugin on its own resolves $variables declared at the root of the file. ` +
        'Move it to the root, or compile through compile() / uxdsl build, whose SCSS subset has block scope.'
      ), decl);
    }
  });
  const vars: Record<string, string> = Object.create(null);
  root.each((node) => {
    if (node.type === 'decl' && node.prop.startsWith('$')) {
      vars[node.prop.slice(1)] = node.value;
      node.remove();
    }
  });
  const reference = /\$([a-zA-Z_][\w-]*)/g;
  root.walkDecls((decl) => {
    if (typeof decl.value !== 'string' || c.generated.has(decl)) return;
    if (Object.keys(vars).length > 0) {
      decl.value = decl.value.replace(reference, (match, name) => (Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match));
    }
    // Strings are left alone: `content: "$5"` is text.
    for (const node of valueParser(decl.value).nodes) {
      if (node.type === 'word' && /^\$[a-zA-Z_][\w-]*$/.test(node.value)) {
        throw locateError(diagnostic(
          `UXD_VARIABLE_UNDEFINED: ${node.value} is not defined; declare it at the root of the file (${node.value}: …;) before this rule.`, node.value
        ), decl);
      }
    }
  });
}

// --- expandResponsive --------------------------------------------------------

/** The top-level, comma-separated arguments of a function node, as written. */
function tokenArguments(node: valueParser.FunctionNode): string[] {
  const groups: valueParser.Node[][] = [[]];
  for (const child of node.nodes) {
    if (child.type === 'div' && child.value === ',') groups.push([]);
    else groups[groups.length - 1].push(child);
  }
  const args = groups.map((group) => valueParser.stringify(group).trim());
  return args.length === 1 && args[0] === '' ? [] : args;
}

/** A token the host guarantees (`references.externalTokens`) or another compiled entry declares (`references.css`). */
function declaredExternally(c: Compilation, name: string): boolean {
  if (!c.externalNames) {
    c.externalNames = new Set(c.references.externalTokens || []);
    for (const css of c.references.css || []) {
      try { postcss.parse(css).walkDecls((declaration) => { if (declaration.prop.startsWith('--')) c.externalNames!.add(declaration.prop); }); } catch { /* an unparsable dependency is the reference pass's own error */ }
    }
  }
  return c.externalNames.has(name);
}

/** The reference of one token function must exist in the effective theme (or be declared externally); the error carries the family's code and a "did you mean". */
function checkReference(c: Compilation, reference: TokenReference, call: string) {
  const { kind, key } = reference;
  if (declaredExternally(c, buildVarName(kind, key))) return;
  if (kind === 'space' && !Object.prototype.hasOwnProperty.call(c.spacing, key)) throw diagnostic(missingKeyMessage('UXD_SPACE_REFERENCE', 'space', key, Object.keys(c.spacing)), call);
  if (kind === 'density' && !Object.prototype.hasOwnProperty.call(c.densities, key)) throw diagnostic(missingKeyMessage('UXD_DENSITY_REFERENCE', 'density', key, Object.keys(c.densities)), call);
  if (kind === 'radius' && !RADIUS_KEYWORDS[key] && !Object.prototype.hasOwnProperty.call(c.edges.radii, key)) {
    // `full` was an alias of `pill`; a theme that defines its own `radii.full` passed above.
    throw diagnostic(key === 'full' ? REMOVED_RADIUS_FULL : missingKeyMessage('UXD_EDGE_REFERENCE', 'radius', key, [...Object.keys(c.edges.radii), ...Object.keys(RADIUS_KEYWORDS)]), call);
  }
  if (kind === 'border' && !Object.prototype.hasOwnProperty.call(c.edges.borders, key)) throw diagnostic(missingKeyMessage('UXD_EDGE_REFERENCE', 'border', key, Object.keys(c.edges.borders)), call);
  if (kind === 'shadow' && !Object.prototype.hasOwnProperty.call(c.shadows, key)) throw diagnostic(missingKeyMessage('UXD_SHADOW_REFERENCE', 'shadow', key, Object.keys(c.shadows)), call);
  if (kind !== 'palette' && kind !== 'color') return;
  const map = kind === 'palette' ? c.palette : c.colors;
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

/**
 * The author-side pass of the one value grammar: every token function is
 * parsed by language.ts (count, key shape, alpha, dotted path) and its
 * reference checked against the effective theme before it is serialized. The
 * reference-integrity pass over the emitted stylesheet stays the second net,
 * for a `var()` the author wrote by hand and for theme values.
 */
function rewriteTokens(c: Compilation, input: string): string {
  const parsed = valueParser(input);
  parsed.walk((node) => {
    if (node.type !== 'function') return;
    const name = node.value.toLowerCase();
    const call = valueParser.stringify(node);
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
    try { reference = parseTokenReference(kind, args, c.tokenContext); } catch (error) { throw diagnostic((error as Error).message, call); }
    checkReference(c, reference, call);
    Object.assign(node, { type: 'word', value: tokenReferenceToCss(reference) });
    return false;
  });
  return parsed.toString().trim();
}

/**
 * The structure of a responsive expression, before anything is rewritten: a
 * breakpoint function nested in another function (or in another breakpoint),
 * a responsive value under an at-rule that cannot hold a media query, an empty
 * argument, `!important` inside a group, or a group without a base next to
 * other content would all reach CSS as text (or as a value whose shape changes
 * between breakpoints); each is an error.
 */
function checkResponsiveStructure(c: Compilation, decl: Declaration) {
  const structure = analyzeResponsiveValue(decl.value, c.bps);
  if (structure.nested) {
    const { name, parent, names, inner } = structure.nested;
    const hint = c.bpNames.has(parent)
      ? `a breakpoint function cannot nest in another (${parent}(${name}(…)))`
      : `write the breakpoint functions at the top level of the value and ${parent}() inside each group: ${names.map((bp) => `${bp}(${parent}(${resolveResponsiveValue(inner, bp, c.bps)}))`).join(' ')}`;
    throw diagnostic(`UXD_BREAKPOINT_CONTEXT: ${name}(…) is nested inside ${parent}(…); ${hint}.`, `${name}(`);
  }
  if (!structure.groups.length) return;
  for (let ancestor: any = decl.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type !== 'atrule') continue;
    if (UNSPLITTABLE_AT_RULES.includes(String(ancestor.name).toLowerCase().replace(/^-\w+-/, ''))) {
      throw diagnostic(`UXD_BREAKPOINT_CONTEXT: a responsive value cannot live inside @${ancestor.name}: a media query cannot be nested there. Set the responsive value on a custom property outside it and read var() here, or write the block once per breakpoint.`);
    }
  }
  const base = c.ordered[0].name;
  for (const group of structure.groups) {
    if (group.empty.length) throw diagnostic(`UXD_BREAKPOINT_EMPTY: ${group.empty[0]}() has no value; write the value inside the parentheses, or remove the breakpoint.`, `${group.empty[0]}(`);
    if (group.important) throw diagnostic(`UXD_BREAKPOINT_IMPORTANT: !important belongs after the groups, not inside one; write ${decl.prop}: ${decl.value.replace(/\s*!important/gi, '')} !important, which applies it at every breakpoint.`);
    if (!structure.standalone && !group.hasBase) {
      throw diagnostic(`UXD_BREAKPOINT_BASE: ${group.text} has no ${base}() value, so "${decl.prop}" would have a different number of parts below ${group.names[0]}; give the group a ${base}() base, or make the whole value one responsive expression.`, `${group.names[0]}(`);
    }
  }
}

/**
 * Rewrites the token functions of every author declaration and splits a
 * responsive value into its base value plus one `@media (min-width)` clone of
 * the rule per breakpoint whose value differs from the previous one. A clone
 * keeps the author's `!important` and formatting (`raws`). A rule the split
 * emptied is removed: an empty `.a {}` is not what the author wrote.
 */
function expandResponsive(c: Compilation) {
  const { root, bps, ordered, bpNames } = c;
  const mediaRuleCache = new WeakMap<Rule, Map<string, Rule>>();
  const lastMediaByRule = new WeakMap<Rule, AtRule>();
  const emptied = new Set<Rule>();
  root.walkDecls((decl) => {
    try {
      if (typeof decl.value !== 'string' || c.generated.has(decl)) return;
      checkResponsiveStructure(c, decl);
      const rewritten = rewriteTokens(c, decl.value);
      const parsed = valueParser(rewritten);
      // A top-level function that is neither a configured breakpoint nor a
      // known CSS function would reach CSS untouched: it is an error when it
      // sits next to a real breakpoint function or is one edit away from a
      // breakpoint name. Only the top level counts — a function nested in
      // calc(…) is that function's own argument.
      let hasResponsive = false;
      const suspicious: string[] = [];
      for (const node of parsed.nodes) {
        if (node.type !== 'function') continue;
        const fn = node.value.toLowerCase();
        if (bpNames.has(fn)) { hasResponsive = true; continue; }
        if (!KNOWN_FUNCTION_NAMES.has(fn)) suspicious.push(node.value);
      }
      for (const name of suspicious) {
        const distanceOne = Array.from(bpNames).some((bp) => editDistance(name.toLowerCase(), bp.toLowerCase()) === 1);
        if (hasResponsive || distanceOne) {
          throw diagnostic(`UXD_BREAKPOINT_UNKNOWN: ${name}(...) is not a configured breakpoint or a known CSS function; configured breakpoints: ${Array.from(bpNames).join(', ')}.`);
        }
      }
      if (!hasResponsive) { decl.value = parsed.toString().trim(); return; }
      const resolved = ordered.map(({ name }) => ({ bp: name, text: rewriteTokens(c, resolveResponsiveValue(rewritten, name, bps)) }));
      const baseOut = resolved[0]?.text || '';
      const others = resolved.filter((entry, index) => index > 0 && entry.text && entry.text !== resolved[index - 1].text);
      decl.value = baseOut;
      const parent = decl.parent;
      const clone = (text: string) => ({ prop: decl.prop, value: text, important: decl.important, source: decl.source, raws: { ...decl.raws } });
      if (!parent || parent.type !== 'rule') {
        // A declaration directly under an at-rule (or the root): each
        // breakpoint gets a media block holding a clone of the parent.
        const container: any = parent;
        const target = typeof container?.root === 'function' ? container.root() : root;
        for (const { bp, text } of others) {
          const at = postcss.atRule({ name: 'media', params: `(min-width: ${bps[bp]}px)` });
          const cloned = container?.clone ? container.clone({ nodes: [] }) : postcss.rule();
          cloned.append(clone(text));
          at.append(cloned);
          if (container && container !== target && typeof target?.insertAfter === 'function') target.insertAfter(container, at);
          else if (typeof target?.append === 'function') target.append(at);
        }
        if (!baseOut) decl.remove();
        return;
      }
      const rule = parent as Rule;
      let bucket = mediaRuleCache.get(rule);
      if (!bucket) { bucket = new Map<string, Rule>(); mediaRuleCache.set(rule, bucket); }
      for (const { bp, text } of others) {
        let target = bucket.get(bp);
        if (!target) {
          const at = postcss.atRule({ name: 'media', params: `(min-width: ${bps[bp]}px)` });
          target = rule.clone({ nodes: [] });
          at.append(target);
          const previous = lastMediaByRule.get(rule);
          const container = rule.parent || rule.root();
          container.insertAfter(previous || rule, at);
          lastMediaByRule.set(rule, at);
          bucket.set(bp, target);
        }
        target.append(clone(rewriteTokens(c, text)));
      }
      if (!baseOut) {
        decl.remove();
        if (rule.nodes.length === 0) emptied.add(rule);
      }
    } catch (error) {
      throw locateError(error, decl);
    }
  });
  for (const rule of emptied) rule.remove();
  // The same rewriter once more over the author's nodes, after substitution
  // and cloning; the generated theme is already resolved.
  root.walkDecls((decl) => {
    try {
      if (typeof decl.value === 'string' && !c.generated.has(decl)) decl.value = rewriteTokens(c, decl.value);
    } catch (error) {
      throw locateError(error, decl);
    }
  });
}

// --- rejectLeftoverDirectives ------------------------------------------------

/**
 * Every reserved-namespace at-rule (`ds` or `ds-*`) still in the tree is
 * either misspelled (UXD_DIRECTIVE_UNKNOWN) or a real directive used where it
 * cannot apply — the document root, or under @media/@supports
 * (UXD_DIRECTIVE_CONTEXT: directives style a whole rule and are not
 * responsive). A browser would otherwise silently discard it.
 */
function rejectLeftoverDirectives(c: Compilation) {
  c.root.walkAtRules((at) => {
    const name = at.name.toLowerCase();
    if (name !== 'ds' && !name.startsWith('ds-')) return;
    if (DIRECTIVE_NAMES.includes(name)) {
      throw locateError(diagnostic(
        'UXD_DIRECTIVE_CONTEXT: Directives apply to a whole rule and are not responsive; use responsive values on the properties instead, e.g. padding: xs(…) md(…).'
      ), at);
    }
    const suggestion = closestKey(name, DIRECTIVE_NAMES);
    throw locateError(diagnostic(`UXD_DIRECTIVE_UNKNOWN: Unknown directive @${at.name}.${suggestion ? ` Did you mean @${suggestion}?` : ''}`), at);
  });
}

// --- checkReferences ---------------------------------------------------------

/**
 * The reference-integrity pass over the stylesheet actually emitted: every
 * declaration the theme generated, and every author declaration that used a
 * token function. A component entry (`includeTheme: false`) validates against
 * the rendered theme without emitting it; dependency CSS stays validation-only.
 */
function checkReferences(c: Compilation) {
  const consumers: Declaration[] = [];
  c.root.walkDecls((node) => {
    if (!c.originalSources.has(node.source) || c.dslSources.has(node.source)) consumers.push(node);
  });
  const css = [...(c.references.css || [])];
  if (!c.includeTheme && c.references.mode !== 'off') css.push(renderThemeCss(c.theme, c.bps));
  enforceReferences(c.root, consumers, {
    ...c.references, css,
    onWarning: (issue) => { c.result.warn(issue.message, { node: (issue as any).node, plugin: PLUGIN }); c.references.onWarning?.(issue); },
  });
}

// --- the plugin --------------------------------------------------------------

function uxdslPlugin(opts: UxdslOptions = {}) {
  return {
    postcssPlugin: PLUGIN,
    Once(root: Root, { result }: { result: Result }) {
      const compilation = validateOptions(root, result, opts);
      emitTheme(compilation);
      expandDirectives(compilation);
      resolveVariables(compilation);
      expandResponsive(compilation);
      rejectLeftoverDirectives(compilation);
      checkReferences(compilation);
    },
  };
}

(uxdslPlugin as any).postcss = true;

// This module is `export =` — a PostCSS plugin is a callable — so the public
// types and the diagnostics catalog are merged into the function's own
// namespace: `import type { UxdslTheme } from 'uxdsl'` and
// `require('uxdsl/postcss').DIAGNOSTIC_CATALOG` both resolve without a second
// entry point. A namespace cannot re-export with `export … from`, hence the
// import types.
namespace uxdslPlugin {
  /** The frozen catalog of every UXD_* code: meaning, fix and owner. */
  export const DIAGNOSTIC_CATALOG = CATALOG;
  export type DiagnosticEntry = import('./diagnostics').DiagnosticEntry;
  export type DiagnosticOwner = import('./diagnostics').DiagnosticOwner;
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
