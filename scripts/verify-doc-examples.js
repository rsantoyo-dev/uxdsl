#!/usr/bin/env node
'use strict';

// MIG-B7-16 (FEAT-009): compiles every UXDSL example in the documentation with the
// real compiler and reports the ones that no longer hold. `npm test` runs the same
// check through scripts/doc-examples.test.js; this prints the report.
const { discoverSurfaces, verifySurfaces, validateThemes } = require('./lib/doc-examples');

(async () => {
  const surfaces = discoverSurfaces();
  const { examples, themes, problems } = await verifySurfaces(surfaces);
  const all = [...problems, ...validateThemes(themes)];
  console.log(`${examples.length} examples and ${themes.length} theme excerpts checked across ${surfaces.length} documentation files.`);
  for (const { file, line, problem } of all) console.log(`  FAIL  ${file}:${line}\n        ${problem}`);
  console.log(all.length ? `\n${all.length} problem(s).` : 'All documentation examples hold.');
  process.exitCode = all.length ? 1 : 0;
})();
