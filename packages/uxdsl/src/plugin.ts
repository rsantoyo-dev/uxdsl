// The UXDSL PostCSS plugin.
//
//   Sass        A stylesheet this plugin compiles alone is CSS plus UXDSL:
//               Sass syntax in it fails as UXD_SASS_CONTEXT, naming uxdsl
//               build, compile() or an adapter, where Dart Sass runs first.
//               Behind compile(), the same check catches a $variable Dart
//               Sass kept as written (a custom property, a plain-CSS
//               at-rule's prelude), whose fix is #{$variable}. In a PostCSS
//               chain, a construct UXDSL's own steps leave alone is held
//               until OnceExit and fails only if it is still there, so a
//               plugin that resolves it (a nesting plugin's `&_title`, a
//               variables plugin's `$gap`) may be listed before or after
//               this one.
//   Values      the token functions space(), density(), color(), palette(),
//               radius(), border(), shadow(); responsive functions named after
//               the theme's breakpoints (xs() md() …), `!important` preserved
//               at every breakpoint.
//   Media       `(--<bp>)` in an @media prelude is the query <bp>() emits:
//               `@media (--lg) { … }` applies from the theme's lg up.
//   Directives  @ds-surface, @ds-button, @ds-input, @ds-typo — each expanding
//               to the declarations its role defines, states and
//               pseudo-elements included. A directive is a direct child of the
//               rule it styles, or it fails as UXD_DIRECTIVE_CONTEXT rather
//               than passing through untouched.
//   Theme       The effective theme comes from the `theme` option or, when it
//               is omitted, from conventional theme-file discovery
//               (`discoverTheme`/`configRoot`). `@uxdsl theme;` emits the
//               theme where it is written, and only there: a stylesheet
//               without it only consumes tokens another stylesheet defines.
//   Integrity   Every emitted var() is checked against a real definition
//               (`references`), failing the build by default rather than
//               shipping a dangling token.
//   Diagnostics Errors carry a UXD_* code from the catalog (./diagnostics)
//               and a source position; generated theme globals deliberately
//               carry no source, so a source map lists only files the author
//               actually wrote.
//
// One compilation is one `Compilation` object, built by `validateOptions` and
// handed through the Sass check (`holdSassSyntax`), `rewriteBreakpointMedia`,
// `emitTheme`, `expandDirectives`, `expandResponsive`,
// `rejectLeftoverDirectives`, `checkReferences` and `reportThemeEmission`, in
// that order, all in the plugin's `Once`. A Sass construct none of the steps read or changed is held,
// with what the steps report, in a map `prepare()` creates for each PostCSS
// run, and checked again in `OnceExit` (`releaseSassSyntax`). The theme's
// engines run once per compilation, inside `validateTheme`: the Compilation
// keeps their outputs and serializes the theme stylesheet from them when a
// step first needs it. Nothing is stored on the PostCSS root or on the plugin
// instance.

import type { AtRule, ChildNode, Declaration, Node as PostcssNode, Result, Root, Rule } from 'postcss';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { enforceReferences, ReferenceOptions } from './reference-integrity';
import { renderThemeCssFromOutputs, THEME_ENGINE_OUTPUTS, ThemeEngineOutputs } from './ds-runtime/theme-generator';
import { validateTheme, themeValidationError, ValidateThemeOptions } from './ds-runtime/theme-validate';
import { inputComponentCss, parseInputArguments } from './inputs';
import { buttonComponentCss, parseButtonArguments } from './buttons';
import { surfaceDeclarations, parseSurfaceArguments } from './surfaces';
import { getShadowTokens } from './shadows';
import { getEdgeTokens, DEFAULT_BORDER_COLORS, RADIUS_KEYWORDS } from './edges';
import { directiveInner, parseTypoArguments } from './directives';
import { buildVarName } from './naming';
import { resolveTheme } from './default-theme';
import { diagnostic, locateError, missingKeyMessage, closestKey, suggestKeys, didYouMean, formatKeyList, editDistance, DIAGNOSTIC_CATALOG as CATALOG } from './diagnostics';
import { discoverThemeSync, removedOptionWarnings } from './config';
import {
  resolveResponsiveValue, analyzeResponsiveValue, getDensityTokens, removedSyntaxMessage, unknownFunctionMessage, parseTokenReference, tokenReferenceToCss,
  TOKEN_FUNCTIONS, REMOVED_RADIUS_FULL, LANGUAGE_COMPLETIONS, KNOWN_CSS_FUNCTIONS, DEFAULT_BREAKPOINTS,
} from './language';
import type { TokenReference, TokenContext } from './language';
import { TYPOGRAPHY_PROPERTIES, resolveTypographyRole } from './typography';
import type { UxdslOptions } from './types';

const PLUGIN = 'uxdsl';

const KNOWN_FUNCTION_NAMES = new Set((KNOWN_CSS_FUNCTIONS as readonly string[]).map((name) => name.toLowerCase()));
const DIRECTIVE_NAMES: string[] = LANGUAGE_COMPLETIONS.directives.filter((name) => name.startsWith('ds-'));
const UNSPLITTABLE_AT_RULES = ['keyframes', 'font-face', 'page', 'counter-style'];

/** Everything one compilation knows, built by `validateOptions` and read by every later step. */
interface Compilation {
  root: Root;
  result: Result;
  /** `@uxdsl theme;` in this stylesheet, when written: the theme goes there. */
  themeMarker: AtRule | null;
  /** Whether this compilation emitted the theme: it carried the marker. */
  themeEmitted: boolean;
  /** The effective theme: DEFAULT_THEME with the override deep-merged on top, validated. */
  theme: Record<string, any>;
  /** The theme stylesheet, the bytes `renderThemeCss` returns for `theme`,
   * serialized on the first call from the outputs of the validator's engines. */
  themeCss: () => string;
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
  /** While a Sass construct or an unknown `(--name)` is held for OnceExit, what the steps report (`report`), in order; null reports at once. */
  held: Array<() => void> | null;
  /** The Sass constructs `holdSassSyntax` holds for OnceExit (none when the stylesheet has no Sass). */
  constructs: SassConstruct[];
  /** The `@media` and `@custom-media` at-rules whose prelude holds `--`, in document order: all `rewriteBreakpointMedia` reads. */
  breakpointAtRules: AtRule[];
  /** The `@media` at-rules whose prelude `rewriteBreakpointMedia` rewrote, with the prelude the author wrote. */
  rewrittenMedia: WeakSet<AtRule>;
  originalPrelude: WeakMap<AtRule, string>;
  /** Each `(--name)` in an `@media` prelude that is neither a breakpoint of the theme nor a top-level `@custom-media`, judged at OnceExit. */
  unknownMedia: UnknownMedia[];
}

/** A `(--name)` left for OnceExit: its at-rule, the token as written, the name with its dashes, and the "did you mean" computed when it was found. */
interface UnknownMedia {
  node: AtRule;
  token: string;
  name: string;
  suggestion: string;
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
  // checked once, at the end, on the stylesheet actually emitted. The
  // validator's engine run is the compilation's only one: it hands over each
  // engine's output, and the theme stylesheet is serialized from them.
  let outputs: ThemeEngineOutputs | undefined;
  const options = { references: false, [THEME_ENGINE_OUTPUTS]: (kept: ThemeEngineOutputs) => { outputs = kept; } };
  const validated = validateTheme(theme, options as ValidateThemeOptions);
  if (!validated.ok) throw themeValidationError(validated.errors);
  let rendered: string | undefined;
  const themeCss = () => {
    if (rendered === undefined) rendered = renderThemeCssFromOutputs(theme, outputs!);
    return rendered;
  };
  for (const warning of validated.warnings) result.warn(warning.message, { plugin: PLUGIN });
  // A removed option is reported and ignored, never thrown on.
  for (const text of removedOptionWarnings(opts)) result.warn(text, { plugin: PLUGIN });
  // The one breakpoint map of this compilation: the effective theme's.
  const bps: Record<string, number> = { ...DEFAULT_BREAKPOINTS, ...theme.breakpoints };
  const ordered = Object.entries(bps).map(([name, px]) => ({ name, px })).sort((a, b) => a.px - b.px);
  const originalSources = new Set<Declaration['source']>();
  const dslSources = new Set<Declaration['source']>();
  const breakpointAtRules: AtRule[] = [];
  // One traversal of the author's stylesheet: the declarations it wrote, and
  // the at-rules whose prelude may name a breakpoint (`--` in an @media or a
  // @custom-media prelude), the only ones `rewriteBreakpointMedia` reads.
  root.walk((node) => {
    if (node.type === 'decl') {
      originalSources.add(node.source);
      if (/\b(space|density|radius|border|shadow|palette|color)\(/.test(node.value)) dslSources.add(node.source);
    } else if (node.type === 'atrule' && node.params.includes('--')) {
      const name = node.name.toLowerCase();
      if (name === 'media' || name === 'custom-media') breakpointAtRules.push(node);
    }
  });
  const colors = { ...theme.colors, gray: { ...DEFAULT_BORDER_COLORS.gray, ...theme.colors?.gray } };
  const palette = theme.palette || {};
  return {
    root, result, theme, themeCss, bps, ordered, originalSources, dslSources,
    themeMarker: findThemeMarker(root),
    themeEmitted: false,
    references: (opts.references ?? {}) as ReferenceOptions,
    bpNames: new Set(Object.keys(bps)),
    // Token maps are always computed so references keep validating against
    // the effective theme; only the `:root` definitions depend on the marker.
    densities: getDensityTokens(theme),
    edges: getEdgeTokens(theme),
    shadows: getShadowTokens(theme),
    spacing: theme.spacing || {},
    palette, colors,
    tokenContext: { palette, colors, breakpoints: bps },
    generated: new WeakSet<ChildNode>(),
    held: null,
    constructs: [],
    breakpointAtRules,
    rewrittenMedia: new WeakSet<AtRule>(),
    originalPrelude: new WeakMap<AtRule, string>(),
    unknownMedia: [],
  };
}

/** Reports now, or, while a Sass construct is held, when OnceExit finds it gone: a compilation that fails reports nothing its steps found. */
function report(c: Compilation, emit: () => void) {
  if (c.held) c.held.push(emit);
  else emit();
}

// --- rejectSassSyntax --------------------------------------------------------

/** The at-rules only Sass defines. `@else` always follows an `@if`, and `@when … @else` is CSS. */
const SASS_AT_RULES = new Set(['use', 'forward', 'mixin', 'include', 'function', 'return', 'extend', 'if', 'each', 'for', 'while', 'at-root', 'content', 'debug', 'warn', 'error']);
/** A Sass variable: `$name`, `ns.$name`, `$-name`, `$--name`; never `$5`, `a$b` or an escaped `\$`. */
const SASS_VARIABLE = /(?<![\w\\$.])(?:[a-zA-Z_][\w-]*\.)?\$(?:-?[a-zA-Z_]|--)[\w-]*/;
/** A call through a Sass module's namespace: `math.div(…)`. */
const NAMESPACED_CALL = /^[a-zA-Z_][\w-]*\.[a-zA-Z_][\w-]*$/;
/** Text that may hold a variable, an interpolation or a namespaced call; anything else is not parsed. */
const SASS_HINT = /\$|#\{|[\w-]\.[a-zA-Z_][\w-]*\(/;
const QUOTED = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g;
const SELECTOR_ESCAPE = /\\(?:[0-9a-fA-F]{1,6}\s?|[\s\S])/g;
const SELECTOR_ATTRIBUTE = /\[[^\]]*\]/g;
/** The selector PostCSS reads from a Sass nested property (`font: { … }`, `margin: 1px { … }`): a property name, a colon that does not start `::`, and what follows it. */
const NESTED_PROPERTY = /^(-?[a-zA-Z_\u0080-\uFFFF][\w\u0080-\uFFFF-]*)\s*:(?!:)(\s*)([\s\S]*)$/;
/** What starts an identifier for Dart Sass: a name character, an escape or an interpolation, after at most one `-`, or `--`. */
const IDENTIFIER_START = /^(?:-?(?:[a-zA-Z_\u0080-\uFFFF\\]|#\{)|--)/;
/** The at-rules whose blocks Dart Sass reads as rules only; every other block (a style rule's, an unknown at-rule's) holds declarations, nested properties included. */
const RULE_BLOCKS = new Set(['media', 'supports', '-moz-document']);
/**
 * A function whose arguments Dart Sass keeps as written, as it keeps a custom
 * property's value: `element()` and `expression()` with at most one vendor
 * prefix (`-moz-element()`), `calc()` with one (`-webkit-calc()`), and
 * `type()`, in any case. Sass evaluates the arguments of every other function,
 * `calc()` itself included.
 */
const KEPT_FUNCTION = /^(?:(?:-[^-]+-)?(?:element|expression)|-[^-]+-calc|type)$/i;
/** `expression()`, whose argument is script: a dotted call there (`document.getElementById(…)`) is not a Sass call, nor a `//` a Sass comment. */
const SCRIPT_FUNCTION = /^(?:-[^-]+-)?expression$/i;
/** A Sass placeholder in a masked selector: `%` and an identifier, anywhere in a compound (`%base`, `a%primary`); a keyframe's `50%` is followed by no name. */
const PLACEHOLDER = /%(?:-?[a-zA-Z_\u0080-\uFFFF\u0001]|--)[\w\u0080-\uFFFF\u0001-]*/;

/** A Sass construct in a value or a prelude: the node holding it, and the functions and parentheses it sits in, outermost first. */
interface SassFinding {
  kind: 'variable' | 'interpolation' | 'call';
  text: string;
  node: valueParser.Node;
  within: valueParser.FunctionNode[];
  /** The outermost function holding the construct whose arguments Dart Sass keeps as written (`KEPT_FUNCTION`). */
  keptIn?: valueParser.FunctionNode;
  /** A variable in an unquoted `url(…)`, which Dart Sass reads as a call it evaluates, except where it keeps the text as written. */
  inUrl?: boolean;
}

const sassContext = (construct: string) =>
  `UXD_SASS_CONTEXT: ${construct} is Sass; the PostCSS plugin compiles CSS plus UXDSL. Name the file .uxdsl and compile it with uxdsl build, compile() or an adapter, or remove the Sass.`;
const keptBySass = (construct: string, where: string) =>
  `UXD_SASS_CONTEXT: Sass keeps ${construct} literally in ${where}; write #{${construct}} (in a .uxdsl file compiled by uxdsl build, compile() or an adapter).`;

/** The first `#{…}` written in `text`, for a message. */
function interpolationIn(text: string): string {
  const start = text.indexOf('#{');
  const end = text.indexOf('}', start);
  return end === -1 ? '#{…}' : text.slice(start, end + 1);
}

/**
 * The Sass variables, interpolations and namespaced calls in a value or an
 * at-rule's prelude, in order. Strings and comments are text. Each finding
 * records the function holding it whose arguments Dart Sass keeps as written,
 * if any; in `expression()` a dotted call is script, not a Sass call. A
 * variable in an unquoted `url(…)` is marked `inUrl`: where Sass evaluates the
 * value it reads `url($img)` as a call, so the plugin alone sees a file name,
 * and only where Sass keeps the text is the variable Sass (the caller
 * decides). An interpolation in `url(…)` is Sass anywhere.
 */
function findSass(text: string): SassFinding[] {
  const found: SassFinding[] = [];
  if (!SASS_HINT.test(text)) return found;
  const visit = (nodes: valueParser.Node[], within: valueParser.FunctionNode[], keptIn?: valueParser.FunctionNode, script = false) => {
    for (const node of nodes) {
      if (node.type === 'function') {
        if (node.value.toLowerCase() === 'url') {
          // A quoted URL is a string; an unquoted one is read whole (the parser
          // splits `URL(a/$v.png)`, which it does not take for a URL).
          const inner = valueParser.stringify(node.nodes);
          const quoted = node.nodes.some((part) => part.type === 'string');
          const variable = quoted ? null : SASS_VARIABLE.exec(valueParser.stringify(node.nodes.filter((part) => part.type !== 'comment')));
          if (inner.includes('#{')) found.push({ kind: 'interpolation', text: interpolationIn(inner), node, within, keptIn });
          else if (variable) found.push({ kind: 'variable', text: variable[0], node, within, keptIn, inUrl: true });
        } else if (NAMESPACED_CALL.test(node.value) && !script) {
          found.push({ kind: 'call', text: valueParser.stringify(node), node, within, keptIn });
        } else {
          visit(node.nodes, [...within, node], keptIn ?? (KEPT_FUNCTION.test(node.value) ? node : undefined), script || SCRIPT_FUNCTION.test(node.value));
        }
      } else if (node.type === 'word') {
        const variable = SASS_VARIABLE.exec(node.value);
        if (node.value.includes('#{')) found.push({ kind: 'interpolation', text: interpolationIn(node.value), node, within, keptIn });
        else if (variable) found.push({ kind: 'variable', text: variable[0], node, within, keptIn });
      }
    }
  };
  visit(valueParser(text).nodes, []);
  return found;
}

/** Where Dart Sass keeps a declaration's value as written (a custom property, a CSS `@function` body), or null where it evaluates it. */
function keptPlaceOfDeclaration(decl: Declaration): string | null {
  if (decl.prop.startsWith('--')) return `the custom property ${decl.prop}`;
  for (let ancestor: PostcssNode | undefined = decl.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type === 'atrule' && (ancestor as AtRule).name.toLowerCase() === 'function' && /^\s*--/.test((ancestor as AtRule).params)) {
      return `the CSS @function ${(ancestor as AtRule).params.trim().split(/[\s(]/)[0]}`;
    }
  }
  return null;
}

/** A node of a value that is written: not whitespace, not a comment. */
const isWritten = (node: valueParser.Node) => node.type !== 'space' && node.type !== 'comment';

/**
 * Whether Dart Sass keeps `finding` as written inside a supports condition:
 * `nodes` is the condition (the content of a parenthesized group, or of an
 * `@import`'s `supports(…)`), `inner` the groups and functions within it that
 * hold the finding, outermost first. A declaration (`name: value`) has its
 * name evaluated, and its value too unless the name is a custom property's
 * (`--x: $v` is kept, `width: $v` evaluated); `not (…)` and `(…) and (…)`
 * leave it to the condition that holds the finding; a function's arguments
 * and any other group (`foo $v`) are kept.
 */
function keptInSupportsCondition(nodes: valueParser.Node[], inner: valueParser.FunctionNode[], finding: SassFinding): boolean {
  const colon = nodes.findIndex((node) => node.type === 'div' && node.value === ':');
  if (colon !== -1) {
    const name = nodes.find(isWritten);
    return nodes.indexOf(inner[0] ?? finding.node) > colon && name?.type === 'word' && name.value.startsWith('--');
  }
  const first = nodes.find(isWritten);
  const condition = first?.type === 'word' ? first.value.toLowerCase() === 'not' : first?.type === 'function' && first.value === '';
  if (!condition) return true;
  const [next, ...rest] = inner;
  if (!next) return false;
  return next.value !== '' || keptInSupportsCondition(next.nodes, rest, finding);
}

/**
 * Where Dart Sass keeps an at-rule's prelude as written, or null where it
 * evaluates it. It evaluates `@media`, an `@import`'s URL and media query,
 * UXDSL's own directives (whose `$variables` compile() serves to Sass) and, in
 * a supports condition, what `keptInSupportsCondition` says it evaluates; it
 * keeps the arguments of a `@supports` function (`selector()`, `font-tech()`)
 * and of an `@import` function other than `supports()` (`layer()`), and every
 * other prelude.
 */
function keptPlaceOfPrelude(at: AtRule, finding: SassFinding): string | null {
  const name = at.name.toLowerCase();
  if (name === 'media' || name.startsWith('ds-')) return null;
  const [outer, ...inner] = finding.within;
  if (name === 'supports') {
    if (!outer) return null;
    return outer.value !== '' || keptInSupportsCondition(outer.nodes, inner, finding) ? 'the @supports prelude' : null;
  }
  if (name === 'import') {
    if (!outer || outer.value === '') return null;
    if (outer.value.toLowerCase() !== 'supports') return `the @import ${outer.value}()`;
    return keptInSupportsCondition(outer.nodes, inner, finding) ? 'the @import supports()' : null;
  }
  return `the @${at.name} prelude`;
}

/** Where Dart Sass keeps `finding` as written: the place the value is in (`place`), else the function holding it whose arguments Sass keeps; null where Sass evaluates it. */
const keptWhere = (finding: SassFinding, place: string | null) => place ?? (finding.keptIn ? `${finding.keptIn.value}()` : null);

/** The message for a finding: the kept one where Dart Sass keeps the text as written, the generic one otherwise (always for an interpolation). */
function sassFindingMessage(finding: SassFinding, where: string | null): string {
  return finding.kind !== 'interpolation' && where ? keptBySass(finding.text, where) : sassContext(finding.text);
}

/** The word that locates a finding in its node's text. */
const findingWord = (finding: SassFinding) => (finding.kind === 'interpolation' ? '#{' : finding.kind === 'call' ? finding.text.slice(0, finding.text.indexOf('(')) : finding.text);

/**
 * Throws for the first finding in `text` that is Sass, at `node`. `placeOf`
 * names where Dart Sass keeps a finding as written, or null where it
 * evaluates it; there a variable in `url(…)` is a file name, and passes.
 */
function rejectFindings(text: string, node: Declaration | AtRule, placeOf: (finding: SassFinding) => string | null) {
  for (const finding of findSass(text)) {
    const where = keptWhere(finding, placeOf(finding));
    if (finding.inUrl && !where) continue;
    throw locateError(diagnostic(sassFindingMessage(finding, where), findingWord(finding)), node);
  }
}

function rejectSassInDeclaration(decl: Declaration) {
  if (decl.prop.startsWith('$')) throw locateError(diagnostic(sassContext(decl.prop), decl.prop), decl);
  if (decl.prop.includes('#{')) throw locateError(diagnostic(sassContext(interpolationIn(decl.prop)), '#{'), decl);
  if (/^\s*progid:/i.test(decl.value)) {
    // Dart Sass keeps a progid: value as written, interpolation aside; its
    // dotted filter names are not Sass calls.
    const text = decl.value.replace(QUOTED, '');
    const variable = SASS_VARIABLE.exec(text);
    if (text.includes('#{')) throw locateError(diagnostic(sassContext(interpolationIn(text)), '#{'), decl);
    if (variable) throw locateError(diagnostic(keptBySass(variable[0], 'a progid: value'), variable[0]), decl);
    return;
  }
  const place = keptPlaceOfDeclaration(decl);
  rejectFindings(decl.value, decl, () => place);
  if (!place) rejectLineComment(decl);
}

/** The offset of the `/` a value node writes (a division, or a word inside `calc()`), or -1. */
const slashAt = (node: valueParser.Node) =>
  node.type === 'div' && node.value === '/' ? node.sourceIndex + node.before.length : node.type === 'word' && node.value === '/' ? node.sourceIndex : -1;

/**
 * A `//` comment PostCSS read into a declaration's value, as it does after a
 * block's last declaration (`padding: 1px // note` and then `}`): Dart Sass
 * drops the comment, a browser drops the whole declaration. Called only where
 * Dart Sass evaluates the value (a custom property or a CSS `@function` body
 * keeps a `//` as written); strings, comments, `url(…)` and the script of
 * `expression(…)` are not read.
 */
function rejectLineComment(decl: Declaration) {
  if (!decl.value.includes('//')) return;
  let at = -1;
  valueParser(decl.value).walk((node, index, nodes) => {
    if (at !== -1) return false;
    if (node.type === 'function' && (node.value.toLowerCase() === 'url' || SCRIPT_FUNCTION.test(node.value))) return false;
    if (node.type === 'word' && node.value.includes('//')) at = node.sourceIndex + node.value.indexOf('//');
    const slash = slashAt(node);
    if (at === -1 && slash !== -1 && index + 1 < nodes.length && slashAt(nodes[index + 1]) === slash + 1) at = slash;
    return undefined;
  });
  // The comment's own text, up to the end of its line, locates it.
  if (at !== -1) throw locateError(diagnostic(sassContext('a // comment'), decl.value.slice(at).split('\n')[0].trimEnd()), decl);
}

function rejectSassInAtRule(at: AtRule) {
  const name = at.name.toLowerCase();
  // CSS's own @function and @mixin take a --dashed name.
  if (SASS_AT_RULES.has(name) && !((name === 'function' || name === 'mixin') && /^\s*--/.test(at.params))) {
    throw locateError(diagnostic(sassContext(`@${at.name}`), `@${at.name}`), at);
  }
  rejectFindings(at.params, at, (finding) => keptPlaceOfPrelude(at, finding));
}

/**
 * The property name of a Sass nested property PostCSS read as `rule`
 * (`font: { family: x; }`, `margin: 1px { top: 2px; }`), or null. Dart Sass
 * reads one where it reads declarations, inside a style rule or an at-rule it
 * does not know; after the colon comes nothing, whitespace, or a value that
 * does not start like an identifier. An identifier right after the colon is a
 * selector to Dart Sass, as to CSS: `a:hover`, `li:nth-child(2)`, `a :hover`.
 * Inside `@theme`, the same shape is a pack of UXDSL's removed token blocks
 * (`@theme { surface-contained: { … } }`), which UXD_THEME_BLOCK_REMOVED
 * reports with where its tokens go.
 */
function nestedPropertyName(rule: Rule): string | null {
  const shape = NESTED_PROPERTY.exec(rule.selector);
  if (!shape) return null;
  const [, name, space, rest] = shape;
  if (rest !== '' && space === '' && IDENTIFIER_START.test(rest)) return null;
  let declarations = false;
  for (let ancestor: PostcssNode | undefined = rule.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type === 'rule') declarations = true;
    if (ancestor.type !== 'atrule') continue;
    const at = (ancestor as AtRule).name.toLowerCase();
    if (at === 'theme') return null;
    if (!RULE_BLOCKS.has(at)) declarations = true;
  }
  return declarations ? name : null;
}

/**
 * Sass in a selector: an interpolation, an `&` followed by an identifier
 * character (`&__title`, `&-x`; CSS nesting writes `&:hover`, `& .x`, `&.y`),
 * a `%placeholder` anywhere in a compound (`%base`, `a%primary`), a `//`
 * comment PostCSS read into the selector, or a nested property PostCSS read
 * as a rule. Escapes, strings and
 * attribute selectors are masked first, so `.a\&b`, `[data-x="a&b"]` and
 * `a[href^="//"]` are CSS.
 */
function rejectSassInSelector(rule: Rule) {
  const { selector } = rule;
  const masked = selector
    .replace(SELECTOR_ESCAPE, (escape) => '\u0001'.repeat(escape.length))
    .replace(QUOTED, (quoted) => '\u0002'.repeat(quoted.length))
    .replace(SELECTOR_ATTRIBUTE, (attribute) => '\u0002'.repeat(attribute.length));
  const interpolation = masked.indexOf('#{');
  if (interpolation !== -1) throw locateError(diagnostic(sassContext(interpolationIn(selector.slice(interpolation))), '#{'), rule);
  const suffix = /&[a-zA-Z0-9_\u0001-]+/.exec(masked);
  if (suffix) {
    const text = selector.slice(suffix.index, suffix.index + suffix[0].length);
    throw locateError(diagnostic(sassContext(text), text), rule);
  }
  const placeholder = PLACEHOLDER.exec(masked);
  if (placeholder) {
    const text = selector.slice(placeholder.index, placeholder.index + placeholder[0].length);
    throw locateError(diagnostic(sassContext(text), text), rule);
  }
  if (masked.includes('//')) throw locateError(diagnostic(sassContext('a // comment'), '//'), rule);
  const nested = nestedPropertyName(rule);
  if (nested) throw locateError(diagnostic(sassContext(`the nested property ${nested}:`), nested), rule);
}

/** Throws UXD_SASS_CONTEXT for the first Sass construct `node` itself holds (its descendants aside). */
function rejectSassIn(node: ChildNode) {
  if (node.type === 'decl') rejectSassInDeclaration(node);
  else if (node.type === 'atrule') rejectSassInAtRule(node);
  else if (node.type === 'rule' && /[&%#/:]/.test(node.selector)) rejectSassInSelector(node);
}

/**
 * Sass that reaches this plugin is never CSS a browser can use: compile() runs
 * Dart Sass first, so here it is either a stylesheet the plugin compiles alone
 * or text Dart Sass kept as written. The first construct found fails as
 * UXD_SASS_CONTEXT at its own line and column. Runs before the theme is
 * emitted, so every node is the author's. A root of a PostCSS Document is
 * checked this way, before its steps run, so a construct in an earlier root
 * fails before a later root's steps run or warn.
 */
function rejectSassSyntax(c: Compilation) {
  c.root.walk(rejectSassIn);
}

/** A Sass construct the check found: its node, the node's own text then, and the error the check built for it. */
interface SassConstruct {
  node: ChildNode;
  text: string;
  error: unknown;
}

/** What another plugin rewrites when it resolves a construct in a node: a declaration's property and value, a rule's selector, an at-rule's name and prelude. */
function ownText(node: ChildNode): string {
  if (node.type === 'decl') return `${node.prop}:${node.value}${node.important ? '!important' : ''}`;
  if (node.type === 'rule') return node.selector;
  if (node.type === 'atrule') return `@${node.name} ${node.params}`;
  return '';
}

const isSassContext = (error: unknown) => /^UXD_SASS_CONTEXT:/.test(String((error as any)?.reason ?? (error as any)?.message ?? ''));

/**
 * The Sass check as a list: every node `rejectSassIn` rejects, in the order
 * `rejectSassSyntax` walks them, each with the error it throws, built now, so
 * the first one is the plugin alone's error whatever runs afterwards.
 * `skipGenerated` leaves out the theme's nodes, which hold no author text.
 */
function findSassConstructs(c: Compilation, skipGenerated: boolean): SassConstruct[] {
  const found: SassConstruct[] = [];
  c.root.walk((node) => {
    if (skipGenerated && c.generated.has(node)) return;
    try {
      rejectSassIn(node);
    } catch (error) {
      if (!isSassContext(error)) throw found.length ? found[0].error : error;
      found.push({ node, text: ownText(node), error });
    }
  });
  return found;
}

/** A held construct is still there: its node is in `root`, with the text it was found with. */
const stillThere = (construct: SassConstruct, root: Root) => construct.node.root() === root && ownText(construct.node) === construct.text;

// --- rewriteBreakpointMedia --------------------------------------------------

/** The media query `<bp>()` emits and `(--<bp>)` compiles to: the one form the reference pass reads as a min-width condition. */
const minWidthQuery = (px: number) => `(min-width: ${px}px)`;

/** A custom media feature in a media query, `(--name)`, with spaces allowed inside the parentheses; `(--lg: 1)` is not one. */
const BREAKPOINT_FEATURE = /\(\s*--([A-Za-z0-9_-]+)\s*\)/g;
/** A dashed name outside parentheses: not a media feature. */
const BARE_DASHED_NAME = /(?<![\w-])--([\w-]+)(?![\w-])/g;

/** `text` with every balanced parenthesized group blanked out, offsets kept. */
function outsideParentheses(text: string): string {
  let depth = 0;
  let out = '';
  for (const char of text) {
    if (char === '(') depth++;
    out += depth > 0 ? ' ' : char;
    if (char === ')' && depth > 0) depth--;
  }
  return out;
}

/** The nearest ancestor of `node` that cannot hold a media query (@keyframes and the like, vendor prefix stripped), or undefined. */
function unsplittableAncestor(node: PostcssNode): AtRule | undefined {
  for (let ancestor: any = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type === 'atrule' && UNSPLITTABLE_AT_RULES.includes(String(ancestor.name).toLowerCase().replace(/^-\w+-/, ''))) return ancestor;
  }
  return undefined;
}

/** A `@custom-media` definition's prelude: the name, with its dashes, and the query. */
const CUSTOM_MEDIA_DEFINITION = /^\s*(--[A-Za-z0-9_-]+)\s+([\s\S]*\S)\s*$/;

/** Whether `query` is one parenthesized group: `(min-width: 900px)`, `((a) or (b))`. */
function isParenGroup(query: string): boolean {
  if (!query.startsWith('(')) return false;
  let depth = 0;
  for (let index = 0; index < query.length; index++) {
    if (query[index] === '(') depth++;
    else if (query[index] === ')' && --depth === 0) return index === query.length - 1;
  }
  return false;
}

/** Whether `query` is a media condition (no media type, keyword or list), which can stand in parentheses inside another query. */
function isMediaCondition(query: string): boolean {
  if (!/^(?:\(|not\s*\()/i.test(query)) return false;
  return !outsideParentheses(query).includes(',');
}

/** Whether the token at `offset` is a whole item of the media query list `text`. */
function standsAlone(text: string, offset: number, length: number): boolean {
  const before = text.slice(0, offset);
  let depth = 0;
  for (const char of before) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
  }
  return depth === 0 && /(?:^|,)\s*$/.test(before) && /^\s*(?:,|$)/.test(text.slice(offset + length));
}

/**
 * `(--<bp>)` in an `@media` prelude names a breakpoint of the effective theme
 * and compiles to the query `<bp>()` emits, wherever the at-rule sits and
 * whatever else its prelude says: only that token changes, and the rest of
 * the prelude, its comments and the at-rule's raws stay as written. Names
 * compare case-insensitively, as the functions do.
 *
 * What is written by hand wins: a top-level `@custom-media --<bp> <query>;`,
 * wherever it is in the stylesheet, replaces the theme's `<bp>` in every
 * `(--<bp>)` of this compilation, with one UXD_BREAKPOINT_SHADOWED warning per
 * definition, and stays in the output; the last definition of a name wins.
 * Its query replaces a token that is a whole item of the prelude's list as
 * written, and one inside a compound item when it is a condition. A
 * `@custom-media` for any other name is the author's, and is left, with its
 * uses, as written.
 *
 * The base breakpoint has no query, a breakpoint under an at-rule that cannot
 * hold a media query has nowhere to go, a breakpoint name outside parentheses
 * is not a media feature, a definition inside a rule does not define a custom
 * media query, and a query with a media type cannot be combined inside
 * another: each is UXD_BREAKPOINT_CONTEXT. Every other at-rule's prelude is
 * left as written. Only the at-rules `validateOptions` collected are read, so
 * a stylesheet whose preludes hold no `--` costs nothing here. A held Sass
 * construct in a rewritten prelude is judged on the prelude as rewritten.
 */
function rewriteBreakpointMedia(c: Compilation) {
  if (!c.breakpointAtRules.length) return;
  const base = c.ordered[0].name;
  const breakpointOf = (name: string) => {
    const lower = name.toLowerCase();
    return c.bpNames.has(lower) ? lower : undefined;
  };
  // The project's definitions, collected before any prelude is read: custom
  // media are global, so one written after its use, or in a partial Sass
  // emitted into this stylesheet, counts.
  const defined = new Map<string, string>();
  const shadowing = new Map<string, { name: string; query: string }>();
  const nested = new Map<string, AtRule>();
  const warnings: Array<() => void> = [];
  for (const at of c.breakpointAtRules) {
    if (at.name.toLowerCase() !== 'custom-media') continue;
    const definition = CUSTOM_MEDIA_DEFINITION.exec(at.params);
    if (!definition) continue;
    const [, name, query] = definition;
    const bp = breakpointOf(name.slice(2));
    if (at.parent !== c.root) {
      if (bp && !nested.has(bp)) nested.set(bp, at);
      continue;
    }
    defined.set(name, query);
    if (!bp) continue;
    shadowing.set(bp, { name, query });
    const theirs = bp === base ? 'no media query (the base breakpoint)' : minWidthQuery(c.bps[bp]);
    const text = diagnostic(`UXD_BREAKPOINT_SHADOWED: @custom-media ${name} ${query} replaces the theme's ${bp}, ${theirs}, in this stylesheet: (--${bp}) compiles to ${query} here, while ${bp}() and stylesheets compiled apart keep the theme's. Remove it to use the theme's ${bp}, or change breakpoints.${bp} in the theme to move it everywhere.`).message;
    warnings.push(() => c.result.warn(text, { node: at, word: name, plugin: PLUGIN }));
  }
  const usable = c.ordered.filter(({ name }) => name !== base).map(({ name }) => name);
  for (const at of c.breakpointAtRules) {
    if (at.name.toLowerCase() !== 'media') continue;
    const params = at.params;
    // `@media --lg` (what Sass prints for an unquoted `$q: (--lg)`) is not a media feature.
    for (const bare of outsideParentheses(params).matchAll(BARE_DASHED_NAME)) {
      const bp = breakpointOf(bare[1]);
      if (!bp) continue;
      throw locateError(diagnostic(`UXD_BREAKPOINT_CONTEXT: ${bare[0]} in @media ${params} is not in parentheses, so it is not a media feature and the block never applies; write (${bare[0]}). In Sass, quote a query held in a variable: $query: "(${bare[0]})".`, bare[0]), at);
    }
    const resolve = (token: string, name: string, offset: number): string => {
      const bp = breakpointOf(name);
      if (!bp) {
        // Neither a breakpoint nor a definition: judged at OnceExit, so a plugin that resolves custom media may still do it.
        if (!defined.has(`--${name}`)) {
          const suggestion = closestKey(name, [...usable, ...Array.from(defined.keys(), (key) => key.slice(2))]);
          c.unknownMedia.push({ node: at, token, name: `--${name}`, suggestion: didYouMean(suggestion ? [`(--${suggestion})`] : []) });
        }
        return token;
      }
      const outer = unsplittableAncestor(at);
      if (outer) {
        throw diagnostic(`UXD_BREAKPOINT_CONTEXT: @media ${params} cannot live inside @${outer.name}: a media query cannot be nested there; write @media ${params} around the @${outer.name} instead.`, token);
      }
      const project = shadowing.get(bp);
      if (project) {
        const { query } = project;
        if (standsAlone(params, offset, token.length)) return /^true$/i.test(query) ? 'all' : /^false$/i.test(query) ? 'not all' : query;
        if (isParenGroup(query)) return query;
        if (isMediaCondition(query)) return `(${query})`;
        throw diagnostic(`UXD_BREAKPOINT_CONTEXT: (--${name}) stands for ${query} in this stylesheet (@custom-media ${project.name}), a query with a media type, a list or a keyword, which cannot be combined inside @media ${params}; write the definition as a condition such as (min-width: 900px), or use (--${name}) on its own.`, token);
      }
      const definition = nested.get(bp);
      if (definition) {
        const parent = definition.parent as AtRule | Rule;
        throw locateError(diagnostic(`UXD_BREAKPOINT_CONTEXT: @custom-media ${CUSTOM_MEDIA_DEFINITION.exec(definition.params)![1]} is not at the top level of the stylesheet, where a custom media query is defined; move it out of the ${parent.type === 'rule' ? 'rule' : `@${parent.name}`} to replace the theme's ${bp}.`, '@custom-media'), definition);
      }
      if (bp === base) {
        throw diagnostic(`UXD_BREAKPOINT_CONTEXT: (--${name}) is the base breakpoint: it has no media query, because its values apply at every width; write these rules outside @media, or remove (--${name}) from the condition.`, token);
      }
      return minWidthQuery(c.bps[bp]);
    };
    // Each token's replacement, in order; the raw text with comments gets the same ones.
    const replacements: string[] = [];
    let next: string;
    try {
      next = params.replace(BREAKPOINT_FEATURE, (token: string, name: string, offset: number) => {
        const replacement = resolve(token, name, offset);
        replacements.push(replacement);
        return replacement;
      });
    } catch (error) {
      throw locateError(error, at);
    }
    if (next === params) continue;
    c.originalPrelude.set(at, params);
    c.rewrittenMedia.add(at);
    // A comment inside the prelude keeps the author's raw text, given the same rewrite.
    const raw = (at.raws as any).params;
    at.params = next;
    if (raw && typeof raw.raw === 'string' && raw.value === params) {
      let index = 0;
      const rawNext = raw.raw.replace(BREAKPOINT_FEATURE, (token: string) => replacements[index++] ?? token);
      if (index === replacements.length && commentsOf(rawNext) === commentsOf(raw.raw) && withoutComments(rawNext) === withoutComments(next)) (at.raws as any).params = { value: next, raw: rawNext };
      else delete (at.raws as any).params;
    }
    for (const construct of c.constructs) if (construct.node === at) construct.text = ownText(at);
  }
  // While an unknown name waits for OnceExit, what the steps report waits with it.
  if (c.unknownMedia.length > 0 && c.held === null) c.held = [];
  for (const warning of warnings) report(c, warning);
}

/** The error of a `(--name)` no breakpoint and no definition accounts for, at its token. */
function unknownMediaError(c: Compilation, record: UnknownMedia): unknown {
  const base = c.ordered[0].name;
  const usable = c.ordered.filter(({ name }) => name !== base).map(({ name }) => `(--${name})`).join(', ') || 'none';
  return locateError(diagnostic(`UXD_BREAKPOINT_UNKNOWN: (${record.name}) is not a breakpoint of the theme or a @custom-media of this stylesheet; breakpoints usable in @media: ${usable}.${record.suggestion}`, record.token), record.node);
}

/**
 * At OnceExit, each `(--name)` that was neither a breakpoint nor a definition
 * in Once fails if it is still there: its at-rule still in the stylesheet,
 * its prelude still holding the name, and no top-level `@custom-media` of
 * that name now. Another plugin in the run that resolved it, or added its
 * definition, has been heard.
 */
function rejectUnknownMedia(c: Compilation, root: Root) {
  for (const record of c.unknownMedia) {
    if (record.node.root() !== root) continue;
    if (!new RegExp(`\\(\\s*${record.name}\\s*\\)`).test(record.node.params)) continue;
    const definedNow = root.nodes.some((node) => node.type === 'atrule' && node.name.toLowerCase() === 'custom-media' && CUSTOM_MEDIA_DEFINITION.exec(node.params)?.[1] === record.name);
    if (!definedNow) throw unknownMediaError(c, record);
  }
}

// --- emitTheme ---------------------------------------------------------------

/**
 * `@uxdsl theme;` — the statement that puts the theme in this stylesheet, at
 * this position. One form, once, at the top level: a stylesheet carries the
 * theme at most once, and a theme inside a rule or an at-rule would not be the
 * global `:root` every other file reads.
 */
function findThemeMarker(root: Root): AtRule | null {
  let marker: AtRule | null = null;
  root.walkAtRules(/^uxdsl$/i, (at) => {
    if (at.params.trim().toLowerCase() !== 'theme' || at.nodes !== undefined) {
      throw locateError(diagnostic(`UXD_THEME_MARKER: @uxdsl ${at.params.trim()} is not a UXDSL at-rule; the one form is \`@uxdsl theme;\`, which emits the theme where it is written.`), at);
    }
    if (at.parent !== root) {
      throw locateError(diagnostic('UXD_THEME_MARKER: `@uxdsl theme;` belongs at the top level of a global stylesheet, outside any rule or at-rule.'), at);
    }
    if (marker) {
      throw locateError(diagnostic('UXD_THEME_MARKER: `@uxdsl theme;` appears twice; a stylesheet carries the theme once. Keep the first.'), at);
    }
    marker = at;
  });
  return marker;
}

const atRuleName = (node: ChildNode) => (node.type === 'atrule' ? node.name.toLowerCase() : '');
const isCharsetOrComment = (node: ChildNode) => node.type === 'comment' || atRuleName(node) === 'charset';

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
 * Inserts the whole theme — the bytes `renderThemeCss` and `generateThemeCss`
 * return — where `@uxdsl theme;` is written, and nowhere when it is not: its
 * `@import`s right after the author's `@charset` and leading comments, since
 * CSS honors an `@import` only before every other rule and `@charset` only
 * first, and every other block in the marker's place. An author's own
 * `:root { --uxdsl__… }` written after the marker follows the theme's
 * declaration and wins the cascade. Nothing the author wrote is reordered.
 */
function emitTheme(c: Compilation) {
  const marker = c.themeMarker;
  if (!marker) return;
  c.themeEmitted = true;
  const parsed = inheritSource(postcss.parse(c.themeCss()), undefined);
  for (const node of parsed.nodes) { c.generated.add(node); (node as any).walk?.((child: ChildNode) => { c.generated.add(child); }); }
  const nodes = [...parsed.nodes];
  const imports = nodes.filter((node) => node.type === 'atrule' && node.name === 'import');
  const blocks = nodes.filter((node) => !imports.includes(node));
  // A parsed string's first node has no leading raw; after the author's
  // `@charset` and leading comments it gets a newline so it never glues onto
  // the previous node. Every other node keeps the raw it was parsed with:
  // PostCSS's `Root.normalize` would otherwise rewrite the `before` of a node
  // inserted after a sibling to that sibling's own and break byte-identity
  // with `generateThemeCss`.
  if (imports.length) {
    const parsedBefore = new Map(imports.map((node) => [node, node.raws.before]));
    if (c.root.nodes.some(isCharsetOrComment) && !imports[0].raws.before) parsedBefore.set(imports[0], '\n');
    insertAfterLeading(c.root, isCharsetOrComment, imports);
    for (const node of imports) node.raws.before = parsedBefore.get(node);
  }
  // `@uxdsl theme;`: the blocks take the marker's place. The @imports stay
  // first (above), since CSS honors one only before every other rule. The
  // first block keeps the marker's leading raw, or a newline when the marker
  // had none and a node now precedes it (the imports above, or a rule written
  // right before it), so it never glues onto that node.
  if (blocks.length) {
    const parsedBefore = new Map(blocks.map((node) => [node, node.raws.before]));
    parsedBefore.set(blocks[0], marker.raws.before || (marker.prev() ? '\n' : marker.raws.before));
    marker.parent!.insertBefore(marker, blocks);
    for (const node of blocks) node.raws.before = parsedBefore.get(node);
  }
  marker.remove();
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
    throw diagnostic(`${code}: ${kind}(${path}) does not exist; available families: ${formatKeyList(Object.keys(map))}.${didYouMean(suggestKeys(family, Object.keys(map)))}`, call);
  }
  if (typeof entry !== 'object' || entry === null) {
    if (reference.variant) throw diagnostic(`${code}: ${kind}(${path}) does not exist; ${family} is a standalone color, written ${kind}(${family}).`, call);
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(entry, reference.variant!)) {
    // A numeric shade is offered by its neighbours on the scale (`350` → 340 or 400), a named variant by spelling.
    const variants = Object.keys(entry as Record<string, unknown>);
    throw diagnostic(`${code}: ${kind}(${path}) does not exist; ${family} has: ${variants.join(', ')}.${didYouMean(suggestKeys(reference.variant!, variants))}`, call);
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
    if (!Object.prototype.hasOwnProperty.call(TOKEN_FUNCTIONS, name)) {
      // A near-miss of a UXDSL name fails here, naming the function meant; a
      // top-level name one edit from a breakpoint is left to the breakpoint
      // check in expandResponsive, which lists the configured names.
      const unknown = unknownFunctionMessage(node.value, { breakpoints: c.bps, topLevel: parsed.nodes.includes(node) });
      if (unknown) throw diagnostic(unknown, call);
      return;
    }
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

const COMMENT = /\/\*[\s\S]*?\*\//g;
const withoutComments = (text: string) => text.replace(COMMENT, ' ').replace(/\s+/g, ' ').trim();
const commentsOf = (text: string) => (text.match(COMMENT) || []).join('\n');

/**
 * Sets a declaration's value only when the grammar changed it. PostCSS prints
 * the author's raw text (`raws.value.raw`, with its comments and spacing) only
 * while `raws.value.value` equals `decl.value`, so assigning a value that is
 * merely re-serialized or trimmed would drop that text from CSS the grammar
 * had nothing to say about. When the value does change and the author's raw
 * text carried comments, `rewriteRaw` applies the same rewrite to the raw text;
 * the result is kept only if it holds exactly the same comments and, without
 * them, the new value.
 */
function assignValue(decl: Declaration, next: string, rewriteRaw?: (raw: string) => string): void {
  if (next.trim() === decl.value.trim()) return;
  const raw = (decl.raws as any).value;
  const rawInSync = raw && typeof raw.raw === 'string' && raw.value === decl.value;
  decl.value = next;
  if (!rawInSync || !rewriteRaw) return;
  let rawNext: string;
  try {
    rawNext = rewriteRaw(raw.raw);
  } catch {
    return;
  }
  if (commentsOf(rawNext) === commentsOf(raw.raw) && withoutComments(rawNext) === withoutComments(next)) {
    (decl.raws as any).value = { value: next, raw: rawNext };
  }
}

/** A value with no `(` holds no function: no token, breakpoint group or
 * near-miss for the responsive pass to read, so neither of its walks parses it
 * and its bytes stay as written. */
const holdsNoFunction = (value: string) => !value.includes('(');

/**
 * A responsive value directly in an `@media (--bp)` block nested in a rule:
 * with uxdsl/postcss alone, CSS nesting keeps the block inside the rule, and
 * the media block each breakpoint would get could not carry the rule's
 * selector. It is UXD_BREAKPOINT_CONTEXT, naming the prelude as written.
 * Through compile(), Dart Sass has already moved such a block out of its rule.
 */
function rejectValueInRewrittenBlock(c: Compilation, decl: Declaration) {
  let block: AtRule | undefined;
  for (let ancestor: any = decl.parent; ancestor && ancestor.type !== 'root'; ancestor = ancestor.parent) {
    if (ancestor.type === 'rule') {
      if (!block) return;
      const prelude = c.originalPrelude.get(block)!;
      const names = Array.from(prelude.matchAll(BREAKPOINT_FEATURE), (match) => match[1].toLowerCase()).filter((name) => c.bpNames.has(name));
      const bp = names[0] ?? c.ordered[c.ordered.length - 1].name;
      throw diagnostic(`UXD_BREAKPOINT_CONTEXT: a responsive value cannot sit in @media ${prelude} nested in a rule with uxdsl/postcss alone: CSS nesting cannot move the block out of the rule. Write the value on the rule (${decl.prop}: ${c.ordered[0].name}(…) ${bp}(…)), put the rule inside a top-level @media ${prelude}, or compile the file with compile() (a .uxdsl file).`);
    }
    if (!block && ancestor.type === 'atrule' && c.rewrittenMedia.has(ancestor)) block = ancestor;
  }
}

/**
 * Rewrites the token functions of every author declaration and splits a
 * responsive value into its base value plus one `@media (min-width)` clone of
 * the rule per breakpoint whose value differs from the previous one. A clone
 * keeps the author's `!important` and formatting (`raws`). A rule the split
 * emptied is removed: an empty `.a {}` is not what the author wrote. A value
 * with no `(` is left as it is (`holdsNoFunction`).
 */
function expandResponsive(c: Compilation) {
  const { root, bps, ordered, bpNames } = c;
  const mediaRuleCache = new WeakMap<Rule, Map<string, Rule>>();
  const lastMediaByRule = new WeakMap<Rule, AtRule>();
  const emptied = new Set<Rule>();
  root.walkDecls((decl) => {
    try {
      if (typeof decl.value !== 'string' || c.generated.has(decl) || holdsNoFunction(decl.value)) return;
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
      if (!hasResponsive) { assignValue(decl, parsed.toString().trim(), (raw) => rewriteTokens(c, raw)); return; }
      const resolved = ordered.map(({ name }) => ({ bp: name, text: rewriteTokens(c, resolveResponsiveValue(rewritten, name, bps)) }));
      const baseOut = resolved[0]?.text || '';
      const others = resolved.filter((entry, index) => index > 0 && entry.text && entry.text !== resolved[index - 1].text);
      decl.value = baseOut;
      const parent = decl.parent;
      const clone = (text: string) => ({ prop: decl.prop, value: text, important: decl.important, source: decl.source, raws: { ...decl.raws } });
      if (!parent || parent.type !== 'rule') {
        rejectValueInRewrittenBlock(c, decl);
        // A declaration directly under an at-rule (or the root): each
        // breakpoint gets a media block holding a clone of the parent.
        const container: any = parent;
        const target = typeof container?.root === 'function' ? container.root() : root;
        for (const { bp, text } of others) {
          const at = postcss.atRule({ name: 'media', params: minWidthQuery(bps[bp]) });
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
          const at = postcss.atRule({ name: 'media', params: minWidthQuery(bps[bp]) });
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
  // The same rewriter once more over the author's nodes, after the split and
  // its clones; the generated theme is already resolved.
  root.walkDecls((decl) => {
    try {
      if (typeof decl.value === 'string' && !c.generated.has(decl) && !holdsNoFunction(decl.value)) assignValue(decl, rewriteTokens(c, decl.value), (raw) => rewriteTokens(c, raw));
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
 * token function. A compilation without the marker validates against the
 * rendered theme without emitting it; dependency CSS stays validation-only.
 * With no such declaration, no `references.css` entry and no
 * `references.externalTokens` entry, the check could report nothing, and no
 * declaration is inspected; the rendered theme is still parsed, so a theme
 * value PostCSS cannot parse fails here either way.
 */
function checkReferences(c: Compilation) {
  const consumers: Declaration[] = [];
  c.root.walkDecls((node) => {
    if (!c.originalSources.has(node.source) || c.dslSources.has(node.source)) consumers.push(node);
  });
  const css = [...(c.references.css || [])];
  const nothingToCheck = c.references.mode !== 'off' && !consumers.length && !css.length;
  if (!c.themeEmitted && c.references.mode !== 'off') css.push(c.themeCss());
  if (nothingToCheck) {
    // The rendered theme is parsed before `externalTokens` is read, as the
    // inspection reads them.
    for (const text of css) postcss.parse(text);
    if (!new Set(c.references.externalTokens || []).size) return;
  }
  enforceReferences(c.root, consumers, {
    ...c.references, css,
    onWarning: (issue) => report(c, () => { c.result.warn(issue.message, { node: (issue as any).node, plugin: PLUGIN }); c.references.onWarning?.(issue); }),
  });
}

// --- reportThemeEmission -----------------------------------------------------

/**
 * One result message per compilation, `{ type: 'uxdsl-theme', emitted }`,
 * saying whether it emitted the theme: compile() returns it as
 * `themeEmitted`, and a build host counts its stylesheets from it.
 */
function reportThemeEmission(c: Compilation) {
  report(c, () => c.result.messages.push({ type: 'uxdsl-theme', plugin: PLUGIN, emitted: c.themeEmitted }));
}

// --- the plugin --------------------------------------------------------------

/**
 * The Sass check in `Once`, over the author's stylesheet: the constructs to
 * hold for `OnceExit`, none when the stylesheet has no Sass. A root of a
 * PostCSS Document throws for its first construct here, before its steps run,
 * so a construct in an earlier root fails before a later root's steps run or
 * warn. Holding a construct also holds what the steps report (`report`).
 */
function holdSassSyntax(c: Compilation): SassConstruct[] {
  if (c.root.parent?.type === 'document') {
    rejectSassSyntax(c);
    return [];
  }
  const constructs = findSassConstructs(c, false);
  c.constructs = constructs;
  if (constructs.length > 0) c.held = [];
  return constructs;
}

/**
 * UXDSL's own steps, in order. While Sass constructs are held, a step that
 * throws, or one that changes or removes a node holding a construct (a token's
 * `$variable` argument, a `$variable` holding a token or a responsive value),
 * gives the first construct's error instead, as the plugin alone gives it.
 */
function runSteps(c: Compilation, constructs: SassConstruct[]) {
  try {
    rewriteBreakpointMedia(c);
    emitTheme(c);
    expandDirectives(c);
    expandResponsive(c);
    rejectLeftoverDirectives(c);
    checkReferences(c);
    reportThemeEmission(c);
  } catch (error) {
    throw constructs.length > 0 ? constructs[0].error : error;
  }
  if (!constructs.every((construct) => stillThere(construct, c.root))) throw constructs[0].error;
}

/**
 * The held constructs in `OnceExit`, which PostCSS runs after every plugin's
 * `Once` and visitors: the first construct still there fails, then any Sass
 * construct now in the stylesheet that the theme did not generate, then any
 * unknown `(--name)` still there (`rejectUnknownMedia`); when none is left,
 * the held reports are given. A root another plugin replaced cannot be
 * looked in, so its first construct fails, as the plugin alone fails, or,
 * with none, its first unknown `(--name)`.
 */
function releaseSassSyntax(root: Root, pending: Map<Root, { compilation: Compilation; constructs: SassConstruct[] }>) {
  const entry = pending.get(root);
  if (!entry) {
    const [replaced] = pending.values();
    pending.clear();
    if (replaced) throw replaced.constructs.length > 0 ? replaced.constructs[0].error : unknownMediaError(replaced.compilation, replaced.compilation.unknownMedia[0]);
    return;
  }
  pending.delete(root);
  const left = entry.constructs.find((construct) => stillThere(construct, root));
  if (left) throw left.error;
  if (entry.constructs.length > 0) {
    const added = findSassConstructs(entry.compilation, true);
    if (added.length > 0) throw added[0].error;
  }
  rejectUnknownMedia(entry.compilation, root);
  const reports = entry.compilation.held ?? [];
  entry.compilation.held = null;
  for (const emit of reports) emit();
}

/**
 * The Sass check runs over the author's stylesheet in `Once`, before the
 * steps. A construct the steps leave alone, or an unknown `(--name)` in an
 * `@media` prelude, waits, in a map this PostCSS run's `prepare()` creates,
 * for `OnceExit`, so a plugin that resolves it in a visitor or in its own
 * `Once` may be listed before or after this one; the plugin alone fails on
 * its first construct, with none of the steps' reports.
 */
function uxdslPlugin(opts: UxdslOptions = {}) {
  return {
    postcssPlugin: PLUGIN,
    prepare() {
      const pending = new Map<Root, { compilation: Compilation; constructs: SassConstruct[] }>();
      return {
        Once(root: Root, { result }: { result: Result }) {
          const compilation = validateOptions(root, result, opts);
          const constructs = holdSassSyntax(compilation);
          runSteps(compilation, constructs);
          if (constructs.length > 0 || compilation.unknownMedia.length > 0) pending.set(root, { compilation, constructs });
        },
        OnceExit(root: Root) {
          releaseSassSyntax(root, pending);
        },
      };
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
