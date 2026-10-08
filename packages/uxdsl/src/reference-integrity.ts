import postcss, { Declaration, Root } from 'postcss';
import {
  inspectDeclarationReferences, reportReferenceIssues,
  ReferenceDeclaration, ReferenceIssue, ReferenceOptions,
} from './reference-core';

// The reference check on a PostCSS stylesheet: the plugin's half of the
// engine in reference-core.ts. It turns the root (and the compiled CSS in
// `options.css`, parsed here) into the engine's declaration records, in
// document order, and hands back each issue with its PostCSS node. This is the
// only part of the check that needs a CSS parser, which is why the theme paths
// and the browser runtime use reference-core.ts directly.

export { ReferenceIntegrityError, formatReferenceIssue, formatReferenceIssues } from './reference-core';
export type { ReferenceOptions, ReferenceIssue, ReferenceDeclaration } from './reference-core';

/** Where a declaration sits, the way the engine compares scopes: the selector
 * of the outermost rule around it (`:root` when none) and every at-rule,
 * outermost first. */
function declarationRecord(node: Declaration): ReferenceDeclaration {
  let selector = ':root';
  const conditions: string[] = [];
  for (let parent: any = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'rule') selector = parent.selector;
    if (parent.type === 'atrule') conditions.unshift(`@${parent.name} ${parent.params}`);
  }
  return {
    prop: node.prop,
    value: node.value,
    important: node.important,
    selector,
    conditions,
    source: node.source ? { file: node.source.input?.file, line: node.source.start?.line, column: node.source.start?.column } : undefined,
    node,
  };
}

/** Check the generated consumers, following dependencies through user CSS when reached.
 * Scope is conservative: unconditional :root or an identical selector. Arbitrary
 * selector ancestry cannot be proven without a DOM; declare host tokens explicitly.
 */
export function inspectReferences(root: Root, consumers: Declaration[], options: ReferenceOptions = {}): ReferenceIssue[] {
  if (options.mode === 'off') return [];
  // One record per node, so a consumer is the very record the definitions hold.
  const records = new Map<Declaration, ReferenceDeclaration>();
  const recordOf = (node: Declaration) => {
    let record = records.get(node);
    if (!record) { record = declarationRecord(node); records.set(node, record); }
    return record;
  };
  const definitions: ReferenceDeclaration[] = [];
  for (const css of options.css || []) postcss.parse(css).walkDecls((node) => { definitions.push(recordOf(node)); });
  root.walkDecls((node) => { definitions.push(recordOf(node)); });
  return inspectDeclarationReferences(definitions, consumers.map(recordOf), options);
}

export function enforceReferences(root: Root, consumers: Declaration[], options: ReferenceOptions = {}): ReferenceIssue[] {
  return reportReferenceIssues(inspectReferences(root, consumers, options), options);
}
