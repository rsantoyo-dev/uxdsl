const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');

// MIG-B6-29 (FEAT-008), phase 2/4 — regression test for a real bug this
// story's own review found: contrast.ts (like every other file reachable
// through `postcss-uxdsl/ds-runtime`) is not only ever compiled by this
// package's own tsconfig.json (target ES2019). The Next.js playground's
// own next.config.js/tsconfig.json alias `postcss-uxdsl/ds-runtime` (and
// `/language`) straight to this package's TypeScript *source* — "to
// consume current engine source, not a stale local dist" — and compiles
// it under the playground's own, much lower target (`es5`, no
// `downlevelIteration`). A bare `for (const x of someMap)` compiles fine
// under this package's own tsconfig but fails a real build under that
// one ("Type 'Map<string, number>' can only be iterated through when
// using the '--downlevelIteration' flag or with a '--target' of 'es2015'
// or higher"). `npm test` never caught this, since it only ever runs this
// package's own `tsc`; only `packages/playground-nextjs`'s own production
// build did. This test makes that specific constraint a fast, local
// regression instead of something only a full downstream build catches.
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'src', 'ds-runtime.ts');

function compileWithPlaygroundLikeTarget() {
  const program = ts.createProgram([target], {
    target: ts.ScriptTarget.ES5, // the exact setting that broke: packages/playground-nextjs/tsconfig.json.
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.es6.d.ts'],
    strict: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    isolatedModules: true,
    skipLibCheck: true, // matches the playground's own tsconfig; this test is about *this file*, not @types packages.
    noEmit: true,
  });
  return ts.getPreEmitDiagnostics(program);
}

test('ds-runtime.ts (and everything it re-exports, including contrast.ts) compiles under the playground\'s real ES5 target', () => {
  const diagnostics = compileWithPlaygroundLikeTarget();
  const relevant = diagnostics.filter((d) => {
    const file = d.file?.fileName || '';
    return file.includes(`${path.sep}postcss-uxdsl${path.sep}src${path.sep}`);
  });
  const messages = relevant.map((d) => {
    const text = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const loc = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    return `${d.file ? path.relative(root, d.file.fileName) : '?'}${loc ? `:${loc.line + 1}:${loc.character + 1}` : ''} — ${text}`;
  });
  assert.deepEqual(messages, [], `postcss-uxdsl source is not compatible with a real ES5 consumer target:\n${messages.join('\n')}`);
});

test('sanity check: this test actually detects the real bug it pins (a bare for-of over a Map, under ES5)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-es5-check-'));
  const file = path.join(dir, 'bad.ts');
  fs.writeFileSync(file, 'const m = new Map<string, number>();\nfor (const [k, v] of m) { console.log(k, v); }\n');
  const program = ts.createProgram([file], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS, noEmit: true });
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName === file);
  assert.ok(diagnostics.length > 0, 'a bare for-of over a Map under ES5 must produce a real diagnostic — otherwise the test above proves nothing');
  assert.match(ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n'), /downlevelIteration|iterated/);
});
