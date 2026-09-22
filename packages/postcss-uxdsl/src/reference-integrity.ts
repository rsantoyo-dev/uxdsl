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
function conditionsApply(definition: string[], consumer: string[]) {
  return definition.every(condition => consumer.includes(condition) || (() => {
    const min = condition.match(/^@media \(min-width:\s*([\d.]+)px\)$/);
    return !!min && consumer.some(value => {
      const current = value.match(/^@media \(min-width:\s*([\d.]+)px\)$/);
      return !!current && Number(current[1]) >= Number(min[1]);
    });
  })());
}

/** Check the generated consumers, following dependencies through user CSS when reached.
 * Scope is conservative: unconditional :root or an identical selector. Arbitrary
 * selector ancestry cannot be proven without a DOM; declare host tokens explicitly.
 */
export function inspectReferences(root: Root, consumers: Declaration[], options: ReferenceOptions = {}): ReferenceIssue[] {
  if (options.mode === 'off') return [];
  const externals = new Set(options.externalTokens || []);
  externals.forEach(token => { if (!/^--[\w-]+$/.test(token)) throw new Error(`UXD_REFERENCE_CONTEXT: Invalid external token ${token}.`); });
  const entries: Entry[] = [];
  for (const css of options.css || []) {
    postcss.parse(css).walkDecls(node => { entries.push({ node, context: contextOf(node), order: entries.length }); });
  }
  root.walkDecls(node => { entries.push({ node, context: contextOf(node), order: entries.length }); });
  const definitions = new Map<string, Entry[]>();
  for (const entry of entries) if (entry.node.prop.startsWith('--')) {
    definitions.set(entry.node.prop, [...(definitions.get(entry.node.prop) || []), entry]);
  }
  const issues: ReferenceIssue[] = [];
  const seen = new Set<string>();
  const report = (code: ReferenceIssue['code'], node: Declaration, chain: string[]) => {
    const reference = chain[chain.length - 1];
    const referenceHint = code === 'UXD_REFERENCE_MISSING' && /^--uxdsl__space__\d+$/.test(reference)
      ? ` Available space() keys: ${formatKeyList(Array.from(definitions.keys()).filter(name => name.startsWith('--uxdsl__space__')).map(name => name.slice('--uxdsl__space__'.length)))}.`
      : code === 'UXD_REFERENCE_MISSING' ? missingTokenHint(reference, Array.from(definitions.keys()).concat(Array.from(externals))) : '';
    const message = `${code}: ${chain.join(' -> ')}${code === 'UXD_REFERENCE_MISSING' ? ` has no definition in the active theme/scope. Define it or declare its external provider.${referenceHint}` : ' is a cyclic token dependency.'}`;
    const key = `${message}:${node.source?.input.file}:${node.source?.start?.line}:${contextOf(node).selector}`;
    if (seen.has(key)) return;
    seen.add(key);
    const issue: ReferenceIssue = { code, message, consumer: node.prop, reference, chain,
      source: node.source?.input.file, line: node.source?.start?.line, column: node.source?.start?.column };
    Object.defineProperty(issue, 'node', { value: node, enumerable: false });
    issues.push(issue);
  };
  function resolve(name: string, context: Context): Entry | undefined {
    return (definitions.get(name) || []).filter(entry =>
      (entry.context.selector === ':root' || entry.context.selector === context.selector) &&
      conditionsApply(entry.context.conditions, context.conditions)
    ).sort((a, b) => Number(a.node.important) - Number(b.node.important) ||
      Number(a.context.selector === context.selector) - Number(b.context.selector === context.selector) || a.order - b.order).pop();
  }
  type Failure = { code: ReferenceIssue['code']; chain: string[] };
  function checkValue(value: string, context: Context, chain: string[], stack: Entry[]): Failure[] {
    const failures: Failure[] = [];
    function visit(nodes: any[]) {
      for (const node of nodes) {
        if (node.type !== 'function') continue;
        if (node.value !== 'var') { visit(node.nodes); continue; }
        const comma = node.nodes.findIndex((item: any) => item.type === 'div' && item.value === ',');
        const name = valueParser.stringify(comma < 0 ? node.nodes : node.nodes.slice(0, comma)).trim();
        if (!name.startsWith('--')) continue;
        const nextChain = [...chain, name];
        const entry = resolve(name, context);
        let dependency: Failure[] = [];
        if (!entry) {
          if (!externals.has(name)) dependency = [{ code: 'UXD_REFERENCE_MISSING', chain: nextChain }];
        } else if (stack.includes(entry)) {
          dependency = [{ code: 'UXD_REFERENCE_CYCLE', chain: nextChain }];
        } else {
          dependency = checkValue(entry.node.value, { selector: entry.context.selector, conditions: context.conditions }, nextChain, [...stack, entry]);
        }
        if (dependency.length && comma >= 0) {
          // A fallback can recover an absent/invalid primary token. A cycle
          // inside a custom property still invalidates that property in CSS.
          const fallback = checkValue(valueParser.stringify(node.nodes.slice(comma + 1)), context, chain, stack);
          failures.push(...(dependency.some(issue => issue.code === 'UXD_REFERENCE_CYCLE') && stack.length ? dependency : fallback));
        } else failures.push(...dependency);
      }
    }
    visit(valueParser(value).nodes);
    return failures;
  }
  for (const node of consumers) {
    const base = contextOf(node);
    // Also inspect overrides at declared media/mode contexts so an otherwise
    // valid base cannot hide a dependency that fails at another breakpoint.
    const contexts = [base, ...entries.map(entry => entry.context).filter(context =>
      (context.selector === base.selector || (base.selector === ':root' && context.selector.startsWith(':root'))) &&
      conditionsApply(base.conditions, context.conditions))];
    const unique = new Map(contexts.map(context => [JSON.stringify(context), context]));
    for (const context of Array.from(unique.values())) {
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
