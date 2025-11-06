#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const processUxdsl = require('uxdsl-core');

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: uxdsl <input.uxdsl> <output.css>');
    process.exit(1);
  }

  try {
    const source = fs.readFileSync(input, 'utf-8');
    const css = await processUxdsl(source, { fileId: path.resolve(input) });
    fs.writeFileSync(output, css);
    console.log(`Processed ${input} -> ${output}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();