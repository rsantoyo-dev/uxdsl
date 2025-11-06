const assert = require('assert');
const path = require('path');
const processUxdsl = require('../index');

async function testCircularImport() {
  const entry = path.resolve(__dirname, 'fixtures/cycle-a.uxdsl');
  const source = require('fs').readFileSync(entry, 'utf-8');
  let error = null;
  try {
    await processUxdsl(source, { fileId: entry });
  } catch (err) {
    error = err;
  }
  assert(error, 'Expected circular import to throw');
  assert(
    typeof error.message === 'string' && error.message.includes('Circular import detected'),
    `Expected circular import message, received: ${error && error.message}`
  );
}

async function testDuplicateImportDeduped() {
  const entry = path.resolve(__dirname, 'fixtures/duplicate-root.uxdsl');
  const source = require('fs').readFileSync(entry, 'utf-8');
  const css = await processUxdsl(source, { fileId: entry });
  const occurrences = css.split('--dup-test').length - 1;
  assert.strictEqual(occurrences, 1, 'Duplicate partial should be inlined only once');
}

(async () => {
  await testCircularImport();
  await testDuplicateImportDeduped();
  console.log('inline-imports tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
