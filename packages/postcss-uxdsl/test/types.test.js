// MIG-B6-27 (FEAT-008): type-checks the public type surface the way a consumer
// does — through the package's own `exports` map, from a project that has
// `postcss-uxdsl` in its `node_modules`, under the resolution modes real
// projects use. A `paths` alias pointing straight at `dist/*.d.ts` would test
// the declaration files while skipping the thing most likely to be wrong: the
// exports map, and whether its `types` condition is ever reached.
//
// `test/types/valid.ts` must compile clean. `test/types/typos.ts` is the
// negative corpus, written entirely with `@ts-expect-error`: TypeScript reports
// an *unused* one as error TS2578, so a type that stops catching a typo fails
// this test instead of silently passing it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageDir = path.resolve(__dirname, '..');
const fixtures = path.join(__dirname, 'types');
const tsc = path.join(packageDir, 'node_modules', 'typescript', 'bin', 'tsc');

/** Builds a throwaway project that resolves `postcss-uxdsl` the way an
 * installed consumer would, and type-checks the fixtures inside it. */
function checkTypes(name, { compilerOptions, files }) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), `uxdsl-types-${name}-`));
  try {
    fs.mkdirSync(path.join(project, 'node_modules'), { recursive: true });
    // A directory symlink, so module resolution walks the real package —
    // package.json, exports map, dist and all.
    fs.symlinkSync(packageDir, path.join(project, 'node_modules', 'postcss-uxdsl'), 'dir');
    fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'uxdsl-types-fixture', version: '0.0.0', private: true, type: 'commonjs' }, null, 2));
    for (const file of files) fs.copyFileSync(path.join(fixtures, file), path.join(project, file));
    fs.writeFileSync(path.join(project, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { noEmit: true, strict: true, skipLibCheck: true, ...compilerOptions },
      files,
    }, null, 2));

    const result = spawnSync(process.execPath, [tsc, '--project', project], { cwd: project, encoding: 'utf8' });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
}

test('MIG-B6-27: valid configs and themes compile under Node16 resolution', () => {
  const { status, output } = checkTypes('node16-valid', {
    compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'es2022' },
    files: ['valid.ts'],
  });
  assert.equal(status, 0, `expected a clean type-check:\n${output}`);
});

test('MIG-B6-27: valid configs and themes compile under bundler resolution', () => {
  const { status, output } = checkTypes('bundler-valid', {
    compilerOptions: { module: 'esnext', moduleResolution: 'bundler', target: 'es2022' },
    files: ['valid.ts'],
  });
  assert.equal(status, 0, `expected a clean type-check:\n${output}`);
});

test('MIG-B6-27: every typo is caught, and no @ts-expect-error goes unused', () => {
  // Passing means each directive suppressed a real error. An unused one is
  // TS2578, which fails this same assertion — so "the type stopped catching
  // this" and "the typo file is out of date" both surface here.
  const { status, output } = checkTypes('node16-typos', {
    compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'es2022' },
    files: ['typos.ts'],
  });
  assert.equal(status, 0,
    'every @ts-expect-error in test/types/typos.ts must suppress a real error ' +
    `(TS2578 here means a typo is no longer caught):\n${output}`);
});

test('MIG-B6-27: a plain .cjs config is type-checked through JSDoc', () => {
  const { status, output } = checkTypes('jsdoc', {
    compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'es2022', allowJs: true, checkJs: true },
    files: ['jsdoc.cjs', 'jsdoc-typo.cjs'],
  });
  assert.equal(status, 0, `expected the JSDoc form to check clean:\n${output}`);
});

test('MIG-B6-27: the negative corpus really fails without its directives', () => {
  // Without this, every assertion above would still pass if `UxdslTheme` were
  // secretly `Record<string, any>` and every directive were unused — because
  // that file would then be full of TS2578 errors, which is a failure, but the
  // *reason* would be invisible. Here the directives are stripped and the
  // compilation is required to fail with real type errors on the same lines.
  const source = fs.readFileSync(path.join(fixtures, 'typos.ts'), 'utf8');
  const stripped = source.replace(/^\s*\/\/ @ts-expect-error.*$/gm, '');
  assert.notEqual(stripped, source, 'expected @ts-expect-error directives to strip');

  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-types-strip-'));
  try {
    fs.mkdirSync(path.join(project, 'node_modules'), { recursive: true });
    fs.symlinkSync(packageDir, path.join(project, 'node_modules', 'postcss-uxdsl'), 'dir');
    fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0', private: true, type: 'commonjs' }));
    fs.writeFileSync(path.join(project, 'typos.ts'), stripped);
    fs.writeFileSync(path.join(project, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { noEmit: true, strict: true, skipLibCheck: true, module: 'node16', moduleResolution: 'node16', target: 'es2022' },
      files: ['typos.ts'],
    }));
    const result = spawnSync(process.execPath, [tsc, '--project', project], { cwd: project, encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'the typo corpus must not compile once the directives are removed');
    const errors = `${result.stdout}${result.stderr}`;
    // Object-literal excess property checks and assignability failures, not
    // "cannot find module" — which would also be a non-zero exit.
    assert.doesNotMatch(errors, /TS2307/, `the fixtures must resolve the package:\n${errors}`);
    const reported = (errors.match(/error TS\d+/g) || []).length;
    assert.ok(reported >= 15, `expected one error per typo, saw ${reported}:\n${errors}`);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
