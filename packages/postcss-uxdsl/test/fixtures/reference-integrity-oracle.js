// MIG-B6-25 (FEAT-008) — FROZEN ORACLE. DO NOT EDIT, DO NOT REGENERATE.
//
// This is the compiled `src/reference-integrity.ts` exactly as it stood
// *before* this story's optimization, copied from
// `packages/postcss-uxdsl/dist/reference-integrity.js` at commit 511da96
// (2026-09-22) — the state of the file after MIG-B6-13 introduced located
// diagnostics and before any indexing work.
//
// It exists so the equivalence test can compare the new implementation against
// the old one's actual output instead of against hand-written expectations,
// which would only re-encode whatever the author believed the old behavior
// was. Its content hash is asserted in
// `test/reference-integrity-equivalence.test.js`: regenerating this file to
// make a failing comparison pass is exactly the mistake the hash is there to
// catch. If the two implementations disagree, the new one is wrong until
// proven otherwise.
//
// The only edit applied to the copy is the `./diagnostics` require below,
// repointed at dist so the fixture resolves from this directory. That module
// only supplies `closestKey`/`formatKeyList` for hint text, and sharing the
// current one keeps the comparison focused on the algorithm under test.
//
// Delete this fixture when 0.5.0-beta.6 ships; it is release-scoped.

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceIntegrityError = void 0;
exports.formatReferenceIssue = formatReferenceIssue;
exports.inspectReferences = inspectReferences;
exports.enforceReferences = enforceReferences;
const postcss_1 = __importDefault(require("postcss"));
const postcss_value_parser_1 = __importDefault(require("postcss-value-parser"));
const diagnostics_1 = require("../../dist/diagnostics");
// MIG-B6-13 (FEAT-008) architecture decision, recorded on code review:
// `issue.source` is whatever PostCSS's `from` option resolved to (absolute,
// relative, or undefined) — never made relative to the working directory
// here. This engine is browser-safe (no Node-only globals, see the guard
// test below); working-directory-relative display is a CLI-only concern,
// already handled by `formatCliDiagnostic` in
// packages/uxdsl-cli/bin/uxdsl.js, which strips that prefix for terminal
// output. Do not reintroduce Node's path/cwd APIs here.
function formatReferenceIssue(issue) {
    if (!issue.source)
        return issue.message;
    const position = issue.line === undefined ? '' : `:${issue.line}${issue.column === undefined ? '' : `:${issue.column}`}`;
    return `${issue.source}${position}: ${issue.message}`;
}
function missingTokenHint(reference, definitions) {
    const match = reference.match(/^--uxdsl__(palette|color)__(.+)$/);
    if (!match)
        return '';
    const [, family, key] = match;
    const prefix = `--uxdsl__${family}__`;
    const candidates = Array.from(definitions).filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length));
    const candidate = (0, diagnostics_1.closestKey)(key, candidates);
    if (!candidate)
        return '';
    const written = family === 'palette' && key.endsWith('-main') && candidate.endsWith('-main')
        ? candidate.slice(0, -'-main'.length)
        : candidate;
    return ` Did you mean "${written}"?`;
}
class ReferenceIntegrityError extends Error {
    constructor(issues) {
        super(issues.map(formatReferenceIssue).join('\n'));
        this.issues = issues;
        this.name = 'ReferenceIntegrityError';
        const located = issues.find(issue => issue.source);
        if (located) {
            this.file = located.source;
            this.line = located.line;
            this.column = located.column;
        }
    }
}
exports.ReferenceIntegrityError = ReferenceIntegrityError;
function contextOf(node) {
    let selector = ':root';
    const conditions = [];
    for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
        if (parent.type === 'rule')
            selector = parent.selector;
        if (parent.type === 'atrule')
            conditions.unshift(`@${parent.name} ${parent.params}`);
    }
    return { selector, conditions };
}
function conditionsApply(definition, consumer) {
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
function inspectReferences(root, consumers, options = {}) {
    var _a;
    if (options.mode === 'off')
        return [];
    const externals = new Set(options.externalTokens || []);
    externals.forEach(token => { if (!/^--[\w-]+$/.test(token))
        throw new Error(`UXD_REFERENCE_CONTEXT: Invalid external token ${token}.`); });
    const entries = [];
    for (const css of options.css || []) {
        postcss_1.default.parse(css).walkDecls(node => { entries.push({ node, context: contextOf(node), order: entries.length }); });
    }
    root.walkDecls(node => { entries.push({ node, context: contextOf(node), order: entries.length }); });
    const definitions = new Map();
    for (const entry of entries)
        if (entry.node.prop.startsWith('--')) {
            definitions.set(entry.node.prop, [...(definitions.get(entry.node.prop) || []), entry]);
        }
    const issues = [];
    const seen = new Set();
    const report = (code, node, chain) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const reference = chain[chain.length - 1];
        const referenceHint = code === 'UXD_REFERENCE_MISSING' && /^--uxdsl__space__\d+$/.test(reference)
            ? ` Available space() keys: ${(0, diagnostics_1.formatKeyList)(Array.from(definitions.keys()).filter(name => name.startsWith('--uxdsl__space__')).map(name => name.slice('--uxdsl__space__'.length)))}.`
            : code === 'UXD_REFERENCE_MISSING' ? missingTokenHint(reference, Array.from(definitions.keys()).concat(Array.from(externals))) : '';
        const message = `${code}: ${chain.join(' -> ')}${code === 'UXD_REFERENCE_MISSING' ? ` has no definition in the active theme/scope. Define it or declare its external provider.${referenceHint}` : ' is a cyclic token dependency.'}`;
        const key = `${message}:${(_a = node.source) === null || _a === void 0 ? void 0 : _a.input.file}:${(_c = (_b = node.source) === null || _b === void 0 ? void 0 : _b.start) === null || _c === void 0 ? void 0 : _c.line}:${contextOf(node).selector}`;
        if (seen.has(key))
            return;
        seen.add(key);
        const issue = { code, message, consumer: node.prop, reference, chain,
            source: (_d = node.source) === null || _d === void 0 ? void 0 : _d.input.file, line: (_f = (_e = node.source) === null || _e === void 0 ? void 0 : _e.start) === null || _f === void 0 ? void 0 : _f.line, column: (_h = (_g = node.source) === null || _g === void 0 ? void 0 : _g.start) === null || _h === void 0 ? void 0 : _h.column };
        Object.defineProperty(issue, 'node', { value: node, enumerable: false });
        issues.push(issue);
    };
    function resolve(name, context) {
        return (definitions.get(name) || []).filter(entry => (entry.context.selector === ':root' || entry.context.selector === context.selector) &&
            conditionsApply(entry.context.conditions, context.conditions)).sort((a, b) => Number(a.node.important) - Number(b.node.important) ||
            Number(a.context.selector === context.selector) - Number(b.context.selector === context.selector) || a.order - b.order).pop();
    }
    function checkValue(value, context, chain, stack) {
        const failures = [];
        function visit(nodes) {
            for (const node of nodes) {
                if (node.type !== 'function')
                    continue;
                if (node.value !== 'var') {
                    visit(node.nodes);
                    continue;
                }
                const comma = node.nodes.findIndex((item) => item.type === 'div' && item.value === ',');
                const name = postcss_value_parser_1.default.stringify(comma < 0 ? node.nodes : node.nodes.slice(0, comma)).trim();
                if (!name.startsWith('--'))
                    continue;
                const nextChain = [...chain, name];
                const entry = resolve(name, context);
                let dependency = [];
                if (!entry) {
                    if (!externals.has(name))
                        dependency = [{ code: 'UXD_REFERENCE_MISSING', chain: nextChain }];
                }
                else if (stack.includes(entry)) {
                    dependency = [{ code: 'UXD_REFERENCE_CYCLE', chain: nextChain }];
                }
                else {
                    dependency = checkValue(entry.node.value, { selector: entry.context.selector, conditions: context.conditions }, nextChain, [...stack, entry]);
                }
                if (dependency.length && comma >= 0) {
                    // A fallback can recover an absent/invalid primary token. A cycle
                    // inside a custom property still invalidates that property in CSS.
                    const fallback = checkValue(postcss_value_parser_1.default.stringify(node.nodes.slice(comma + 1)), context, chain, stack);
                    failures.push(...(dependency.some(issue => issue.code === 'UXD_REFERENCE_CYCLE') && stack.length ? dependency : fallback));
                }
                else
                    failures.push(...dependency);
            }
        }
        visit((0, postcss_value_parser_1.default)(value).nodes);
        return failures;
    }
    for (const node of consumers) {
        const base = contextOf(node);
        // Also inspect overrides at declared media/mode contexts so an otherwise
        // valid base cannot hide a dependency that fails at another breakpoint.
        const contexts = [base, ...entries.map(entry => entry.context).filter(context => (context.selector === base.selector || (base.selector === ':root' && context.selector.startsWith(':root'))) &&
                conditionsApply(base.conditions, context.conditions))];
        const unique = new Map(contexts.map(context => [JSON.stringify(context), context]));
        for (const context of Array.from(unique.values())) {
            const effective = node.prop.startsWith('--') ? (_a = resolve(node.prop, context)) === null || _a === void 0 ? void 0 : _a.node : node;
            if (effective !== node)
                continue;
            for (const failure of checkValue(node.value, context, [node.prop], []))
                report(failure.code, node, failure.chain);
        }
    }
    return issues;
}
function enforceReferences(root, consumers, options = {}) {
    const issues = inspectReferences(root, consumers, options);
    if (issues.length && options.mode !== 'warn')
        throw new ReferenceIntegrityError(issues);
    for (const issue of issues)
        (options.onWarning || ((item) => console.warn(item.message)))(issue);
    return issues;
}
