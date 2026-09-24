#!/usr/bin/env node
'use strict';

// Compares two playground snapshots (snapshot.js). Prints what differs, per route and
// width, as `element path : property  before -> after`. With --noise <third snapshot of
// the SAME build as <before>> it subtracts every difference that appears between those
// two identical builds, which is nondeterminism in the page rather than a change.
//
//   node fixtures/playground-browser/compare.js before.json.gz after.json.gz [--noise before-again.json.gz] [--max 40]

const fs = require('node:fs');
const zlib = require('node:zlib');

const load = (file) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));
const opt = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1]; };

function diff(a, b) {
  const found = new Map(); // "route|width|path|prop" -> [before, after]
  const props = a.props;
  // Only what both snapshots cover, so a snapshot of a few routes can be compared with a full one.
  const commonWidths = a.widths.filter((w) => b.widths.includes(w));
  for (const route of Object.keys(a.routes).filter((r) => r in b.routes)) {
    for (const width of commonWidths) {
      const A = (a.routes[route] || {})[width] || {}, B = ((b.routes[route] || {})[width]) || {};
      for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
        if (A[key] === B[key]) continue;
        if (A[key] === undefined || B[key] === undefined) { found.set(`${route}|${width}|${key}|(element)`, [A[key] === undefined ? 'absent' : 'present', B[key] === undefined ? 'absent' : 'present']); continue; }
        const [, ra, ...pa] = A[key].split('|'); const [, rb, ...pb] = B[key].split('|');
        if (ra !== rb) found.set(`${route}|${width}|${key}|box`, [ra, rb]);
        pa.forEach((v, i) => { if (v !== pb[i]) found.set(`${route}|${width}|${key}|${props[i]}`, [v, pb[i]]); });
      }
    }
  }
  return found;
}

const [beforeFile, afterFile] = args;
const before = load(beforeFile), after = load(afterFile);
let differences = diff(before, after);
let noise = 0;
if (opt('noise')) {
  const same = diff(before, load(opt('noise')));
  noise = same.size;
  for (const key of same.keys()) differences.delete(key);
}
const max = Number(opt('max', 40));
const rows = [...differences.entries()];
const shared = (before.widths || []).filter((w) => after.widths.includes(w));
const records = Object.keys(before.routes).filter((r) => r in after.routes).reduce((n, r) => n + shared.reduce((m, w) => m + Object.keys(before.routes[r][w] || {}).length, 0), 0);
console.log(`compared ${records} element records; ${rows.length} property differences${opt('noise') ? ` (after removing ${noise} that the same build also shows against itself)` : ''}.`);
const byRoute = {};
for (const [key] of rows) { const [route, width] = key.split('|'); (byRoute[route] = byRoute[route] || new Set()).add(width); }
for (const [route, widths] of Object.entries(byRoute)) console.log(`  ${route}: widths ${[...widths].join(', ')}`);
for (const [key, [was, now]] of rows.slice(0, max)) { const [route, width, elPath, prop] = key.split('|'); console.log(`  ${route} @${width}  ${elPath.slice(-60)} : ${prop}  ${String(was).slice(0, 50)} -> ${String(now).slice(0, 50)}`); }
if (rows.length > max) console.log(`  … ${rows.length - max} more`);
process.exitCode = rows.length ? 1 : 0;
