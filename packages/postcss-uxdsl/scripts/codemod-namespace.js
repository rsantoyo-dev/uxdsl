#!/usr/bin/env node
'use strict';

// Explicit migration of selected files. These legacy prefixes must belong to
// UXDSL in the consumer; arbitrary --primary-main aliases are never inferred.
const fs = require('node:fs');
function migrate(source, explicit = {}) {
  const changes = [];
  const output = source.replace(/--[a-zA-Z0-9_-]+/g, (token, offset) => {
    // Quoted object keys are host-owned logical names, not CSS references.
    if (/^["']\s*:/.test(source.slice(offset + token.length)) && /["']/.test(source[offset - 1] || '')) return token;
    let next = explicit[token];
    let match;
    if (Object.hasOwnProperty.call(explicit, token)) {
      if (typeof next !== 'string' || !/^--[\w-]+$/.test(next)) throw new Error(`Invalid mapping for ${token}`);
      if (next !== token) changes.push({ before: token, after: next });
      return next;
    }
    if ((match = token.match(/^--ds__(palette|color)__(.+)$/))) next = `--uxdsl__${match[1]}__${match[2]}`;
    else if ((match = token.match(/^--font-(ui|ui-2|code)$/))) next = `--uxdsl__font__${match[1]}`;
    else if ((match = token.match(/^--(space|density|radius|border|shadow|surface|button|input)-(.+)$/))) next = `--uxdsl__${match[1]}__${match[2]}`;
    else if ((match = token.match(/^--(h[1-6]|p|span|body|small|code|pre|caption|default|tag|body-sm|subtitle2)-(font-family|size|line|weight|spacing|transform|decoration|style|margin-block-start|margin-block-end)$/))) next = `--uxdsl__typography__${match[1]}-${match[2]}`;
    if (!next || token.startsWith('--uxdsl__')) return token;
    changes.push({ before: token, after: next });
    return next;
  });
  return { output, changes };
}
function main(args) {
  const mapIndex = args.indexOf('--map');
  const explicit = mapIndex < 0 ? {} : JSON.parse(fs.readFileSync(args[mapIndex + 1], 'utf8'));
  if (mapIndex >= 0) args.splice(mapIndex, 2);
  const write = args.includes('--write');
  const files = args.filter(arg => arg !== '--write');
  if (!files.length) throw new Error('Usage: codemod-namespace.js [--write] <explicit files...>');
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const { output, changes } = migrate(source, explicit);
    console.log(`${file}: ${changes.length} replacements${write ? ' (write)' : ' (preview)'}`);
    const before = source.split('\n'), after = output.split('\n');
    before.forEach((line, i) => { if (line !== after[i]) console.log(`@@ ${i + 1}\n-${line}\n+${after[i]}`); });
    if (write && output !== source) fs.writeFileSync(file, output);
  }
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { migrate };
