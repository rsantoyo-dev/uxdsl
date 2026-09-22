import postcss, { Declaration, Root } from 'postcss';
import valueParser from 'postcss-value-parser';
import { closestKey, formatKeyList } from './diagnostics';

export interface ReferenceOptions {
  /** Strict by default. Warnings support an explicit migration period. */
  mode?: 'error' | 'warn' | 'off';
  /** Already compiled CSS from declared theme/dependency entries. Never emitted again. */
  css?: string[];
  /** Exact custom properties guaranteed by the host; no inferred default tokens. */
  externalTokens?: string[];
  onWarning?: (issue: ReferenceIssue) => void;
}
export interface ReferenceIssue {
  code: 'UXD_REFERENCE_MISSING' | 'UXD_REFERENCE_CYCLE';
  message: string;
  consumer: string;
  reference: string;
  chain: string[];
  source?: string;
  line?: number;
  column?: number;
  node?: Declaration;
}

// MIG-B6-13 (FEAT-008) architecture decision, recorded on code review:
// `issue.source` is whatever PostCSS's `from` option resolved to (absolute,
// relative, or undefined) — never made relative to the working directory
// here. This engine is browser-safe (no Node-only globals, see the guard
// test below); working-directory-relative display is a CLI-only concern,
// already handled by `formatCliDiagnostic` in
// packages/uxdsl-cli/bin/uxdsl.js, which strips that prefix for terminal
// output. Do not reintroduce Node's path/cwd APIs here.
export function formatReferenceIssue(issue: ReferenceIssue): string {
  if (!issue.source) return issue.message;
  const position = issue.line === undefined ? '' : `:${issue.line}${issue.column === undefined ? '' : `:${issue.column}`}`;
  return `${issue.source}${position}: ${issue.message}`;
}

function missingTokenHint(reference: string, definitions: Iterable<string>): string {
  const match = reference.match(/^--uxdsl__(palette|color)__(.+)$/);
  if (!match) return '';
  const [, family, key] = match;
  const prefix = `--uxdsl__${family}__`;
  const candidates = Array.from(definitions).filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length));
  const candidate = closestKey(key, candidates);
  if (!candidate) return '';
  const written = family === 'palette' && key.endsWith('-main') && candidate.endsWith('-main')
    ? candidate.slice(0, -'-main'.length)
    : candidate;
  return ` Did you mean "${written}"?`;
}

export class ReferenceIntegrityError extends Error {
  constructor(public readonly issues: ReferenceIssue[]) {
    super(issues.map(formatReferenceIssue).join('\n'));
    this.name = 'ReferenceIntegrityError';
    const located = issues.find(issue => issue.source);
    if (located) {
      (this as any).file = located.source;
      (this as any).line = located.line;
      (this as any).column = located.column;
    }
  }
}

type Context = { selector: string; conditions: string[] };
type Entry = { node: Declaration; context: Context; order: number };
function contextOf(node: Declaration): Context {
  let selector = ':root';
  const conditions: string[] = [];
  for (let parent: any = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'rule') selector = parent.selector;
    if (parent.type === 'atrule') conditions.unshift(`@${parent.name} ${parent.params}`);
  }
  return { selector, conditions };
}
function parseMinWidth(condition: string): number | null {
  const match = condition.match(/^@media \(min-width:\s*([\d.]+)px\)$/);
  return match ? Number(match[1]) : null;
}
// MIG-B6-25 (FEAT-008): the min-width regex used to run on every condition of
// every pair compared, which at 24k lines meant millions of identical matches
// against a handful of distinct strings. The caller passes a memoized reader
// so the parse happens once per condition *per pass* — deliberately not a
// module-level cache, which would be exactly the cross-build process-global
// state the engine audit forbids.
function conditionsApply(definition: string[], consumer: string[], minWidthOf: (condition: string) => number | null = parseMinWidth) {
  return definition.every(condition => {
    if (consumer.includes(condition)) return true;
    const min = minWidthOf(condition);
    if (min === null) return false;
    return consumer.some(value => {
      const current = minWidthOf(value);
      return current !== null && current >= min;
    });
  });
}

/** Check the generated consumers, following dependencies through user CSS when reached.
 * Scope is conservative: unconditional :root or an identical selector. Arbitrary
 * selector ancestry cannot be proven without a DOM; declare host tokens explicitly.
 */
export function inspectReferences(root: Root, consumers: Declaration[], options: ReferenceOptions = {}): ReferenceIssue[] {
  if (options.mode === 'off') return [];
  const externals = new Set(options.externalTokens || []);
  externals.forEach(token => { if (!/^--[\w-]+$/.test(token)) throw new Error(`UXD_REFERENCE_CONTEXT: Invalid external token ${token}.`); });
  // MIG-B6-25 (FEAT-008): every index below is built once per call and thrown
  // away with it. None of them changes what counts as an issue — they only
  // stop the same answer from being recomputed per consumer. See the frozen
  // oracle in test/fixtures/reference-integrity-oracle.js, which the
  // equivalence test runs against this one.
  const minWidths = new Map<string, number | null>();
  const minWidthOf = (condition: string): number | null => {
    let width = minWidths.get(condition);
    if (width === undefined) { width = parseMinWidth(condition); minWidths.set(condition, width); }
    return width;
  };
  const applies = (definition: string[], consumer: string[]) => conditionsApply(definition, consumer, minWidthOf);

  // `contextOf` walks a declaration's ancestors; the consumer loop and the
  // report key both used to redo that walk for nodes already indexed here.
  const contextsByNode = new Map<Declaration, Context>();
  const contextFor = (node: Declaration): Context => {
    let context = contextsByNode.get(node);
    if (!context) { context = contextOf(node); contextsByNode.set(node, context); }
    return context;
  };
  // Contexts are compared by their JSON form, so each distinct object's key is
  // computed once. `checkValue` builds `{ selector, conditions }` objects as it
  // descends; interning them by (conditions array, selector) keeps those keys
  // cached too instead of re-stringifying per `var()`.
  const contextKeys = new WeakMap<Context, string>();
  const keyOf = (context: Context): string => {
    let key = contextKeys.get(context);
    if (key === undefined) { key = JSON.stringify(context); contextKeys.set(context, key); }
    return key;
  };
  const internedContexts = new WeakMap<string[], Map<string, Context>>();
  const contextIn = (selector: string, conditions: string[]): Context => {
    let bySelector = internedContexts.get(conditions);
    if (!bySelector) { bySelector = new Map(); internedContexts.set(conditions, bySelector); }
    let context = bySelector.get(selector);
    if (!context) { context = { selector, conditions }; bySelector.set(selector, context); }
    return context;
  };

  const entries: Entry[] = [];
  const index = (node: Declaration) => { entries.push({ node, context: contextFor(node), order: entries.length }); };
  for (const css of options.css || []) postcss.parse(css).walkDecls(index);
  root.walkDecls(index);
  const definitions = new Map<string, Entry[]>();
  for (const entry of entries) if (entry.node.prop.startsWith('--')) {
    // Appending in place: the previous `[...existing, entry]` rebuilt the whole
    // array per definition, which is quadratic on its own for a token the theme
    // overrides at many breakpoints.
    const existing = definitions.get(entry.node.prop);
    if (existing) existing.push(entry); else definitions.set(entry.node.prop, [entry]);
  }
  // The consumer loop only ever needs the *distinct* contexts, and always in
  // the order they first appear — the previous code rebuilt and re-deduplicated
  // the full per-entry list for every consumer, which is the O(consumers x
  // entries) term this story is about.
  //
  // Deduplicating alone is not enough: a stylesheet of N components declares
  // O(N) distinct selectors, so scanning every distinct context per consumer
  // stays quadratic, just with a smaller constant. A consumer only ever
  // matches contexts that share its selector — or, for a `:root` consumer, the
  // `:root`-prefixed mode scopes — so the distinct contexts are bucketed by
  // selector here, in first-appearance order within each bucket. Iterating a
  // bucket visits the same contexts in the same order the full scan did.
  const contextsBySelector = new Map<string, Context[]>();
  const rootScopedContexts: Context[] = [];
  const seenContexts = new Set<string>();
  for (const entry of entries) {
    const key = keyOf(entry.context);
    if (seenContexts.has(key)) continue;
    seenContexts.add(key);
    const selector = entry.context.selector;
    const bucket = contextsBySelector.get(selector);
    if (bucket) bucket.push(entry.context); else contextsBySelector.set(selector, [entry.context]);
    if (selector.startsWith(':root')) rootScopedContexts.push(entry.context);
  }
  const contextsByBase = new Map<string, Context[]>();
  function contextsFor(base: Context): Context[] {
    const baseKey = keyOf(base);
    const cached = contextsByBase.get(baseKey);
    if (cached) return cached;
    // Also inspect overrides at declared media/mode contexts so an otherwise
    // valid base cannot hide a dependency that fails at another breakpoint.
    // `:root` reaches every `:root`-prefixed scope, which is how a dark-mode
    // override gets inspected; any other selector matches only itself.
    const unique = new Map<string, Context>([[baseKey, base]]);
    const candidates = base.selector === ':root' ? rootScopedContexts : (contextsBySelector.get(base.selector) || []);
    for (const context of candidates) {
      if (!applies(base.conditions, context.conditions)) continue;
      unique.set(keyOf(context), context);
    }
    const result = Array.from(unique.values());
    contextsByBase.set(baseKey, result);
    return result;
  }

  const issues: ReferenceIssue[] = [];
  const seen = new Set<string>();
  // `definitions` is complete before the first report and never changes after,
  // so both hint lists are built at most once instead of once per issue — a
  // file with thousands of missing tokens used to rebuild them thousands of
  // times.
  let spaceKeyHint: string | undefined;
  let hintNames: string[] | undefined;
  const report = (code: ReferenceIssue['code'], node: Declaration, chain: string[]) => {
    const reference = chain[chain.length - 1];
    const referenceHint = code === 'UXD_REFERENCE_MISSING' && /^--uxdsl__space__\d+$/.test(reference)
      ? ` Available space() keys: ${spaceKeyHint ??= formatKeyList(Array.from(definitions.keys()).filter(name => name.startsWith('--uxdsl__space__')).map(name => name.slice('--uxdsl__space__'.length)))}.`
      : code === 'UXD_REFERENCE_MISSING' ? missingTokenHint(reference, hintNames ??= Array.from(definitions.keys()).concat(Array.from(externals))) : '';
    const message = `${code}: ${chain.join(' -> ')}${code === 'UXD_REFERENCE_MISSING' ? ` has no definition in the active theme/scope. Define it or declare its external provider.${referenceHint}` : ' is a cyclic token dependency.'}`;
    const key = `${message}:${node.source?.input.file}:${node.source?.start?.line}:${contextFor(node).selector}`;
    if (seen.has(key)) return;
    seen.add(key);
    const issue: ReferenceIssue = { code, message, consumer: node.prop, reference, chain,
      source: node.source?.input.file, line: node.source?.start?.line, column: node.source?.start?.column };
    Object.defineProperty(issue, 'node', { value: node, enumerable: false });
    issues.push(issue);
  };
  // A resolution depends on the name and on the context's selector/conditions —
  // nothing else — and `definitions` is immutable here, so the answer is
  // memoized per (name, context). The sort comparator is kept verbatim,
  // including `Number(undefined)` being NaN for a declaration without an
  // `important` flag: that quirk decides real orderings today.
  const resolutions = new Map<string, Entry | undefined>();
  function resolve(name: string, context: Context): Entry | undefined {
    const key = `${name}\u0000${keyOf(context)}`;
    if (resolutions.has(key)) return resolutions.get(key);
    const resolved = (definitions.get(name) || []).filter(entry =>
      (entry.context.selector === ':root' || entry.context.selector === context.selector) &&
      applies(entry.context.conditions, context.conditions)
    ).sort((a, b) => Number(a.node.important) - Number(b.node.important) ||
      Number(a.context.selector === context.selector) - Number(b.context.selector === context.selector) || a.order - b.order).pop();
    resolutions.set(key, resolved);
    return resolved;
  }
  // Which `var()` references a value contains is a property of the text alone,
  // so it is parsed once and reused across every context and every path that
  // reaches it. The *results* are deliberately not cached: they depend on
  // `chain` and `stack`, and the recursion below is kept as it was so cycles
  // and fallbacks keep behaving identically.
  type VarReference = { name: string; fallback: string | null };
  const varReferences = new Map<string, VarReference[]>();
  function referencesIn(value: string): VarReference[] {
    const cached = varReferences.get(value);
    if (cached) return cached;
    const references: VarReference[] = [];
    function visit(nodes: any[]) {
      for (const node of nodes) {
        if (node.type !== 'function') continue;
        if (node.value !== 'var') { visit(node.nodes); continue; }
        const comma = node.nodes.findIndex((item: any) => item.type === 'div' && item.value === ',');
        const name = valueParser.stringify(comma < 0 ? node.nodes : node.nodes.slice(0, comma)).trim();
        if (!name.startsWith('--')) continue;
        references.push({ name, fallback: comma < 0 ? null : valueParser.stringify(node.nodes.slice(comma + 1)) });
      }
    }
    visit(valueParser(value).nodes);
    varReferences.set(value, references);
    return references;
  }
  type Failure = { code: ReferenceIssue['code']; chain: string[] };
  function checkValue(value: string, context: Context, chain: string[], stack: Entry[]): Failure[] {
    const failures: Failure[] = [];
    for (const { name, fallback: fallbackValue } of referencesIn(value)) {
      const nextChain = [...chain, name];
      const entry = resolve(name, context);
      let dependency: Failure[] = [];
      if (!entry) {
        if (!externals.has(name)) dependency = [{ code: 'UXD_REFERENCE_MISSING', chain: nextChain }];
      } else if (stack.includes(entry)) {
        dependency = [{ code: 'UXD_REFERENCE_CYCLE', chain: nextChain }];
      } else {
        dependency = checkValue(entry.node.value, contextIn(entry.context.selector, context.conditions), nextChain, [...stack, entry]);
      }
      if (dependency.length && fallbackValue !== null) {
        // A fallback can recover an absent/invalid primary token. A cycle
        // inside a custom property still invalidates that property in CSS.
        const fallback = checkValue(fallbackValue, context, chain, stack);
        failures.push(...(dependency.some(issue => issue.code === 'UXD_REFERENCE_CYCLE') && stack.length ? dependency : fallback));
      } else failures.push(...dependency);
    }
    return failures;
  }
  for (const node of consumers) {
    const base = contextFor(node);
    for (const context of contextsFor(base)) {
      const effective = node.prop.startsWith('--') ? resolve(node.prop, context)?.node : node;
      if (effective !== node) continue;
      for (const failure of checkValue(node.value, context, [node.prop], [])) report(failure.code, node, failure.chain);
    }
  }
  return issues;
}

export function enforceReferences(root: Root, consumers: Declaration[], options: ReferenceOptions = {}): ReferenceIssue[] {
  const issues = inspectReferences(root, consumers, options);
  if (issues.length && options.mode !== 'warn') throw new ReferenceIntegrityError(issues);
  for (const issue of issues) (options.onWarning || ((item: ReferenceIssue) => console.warn(item.message)))(issue);
  return issues;
}
