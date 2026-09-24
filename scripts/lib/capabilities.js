'use strict';

// MIG-B7-17 (FEAT-009), phase A: what UXDSL can do, derived — and where the
// playground shows each thing.
//
// The list of capabilities is NOT written by hand. It is read from the sources
// that already define them: the language metadata (directives, functions,
// breakpoints), the theme-family registry, the default roles and states each
// engine declares, the runtime's exports that the package's own documentation
// names, the CLI's own `--help`, and the package's `exports` map. A capability
// that is added to UXDSL therefore appears here by itself, and a test fails
// until the playground shows it or the gap is recorded on purpose.
//
// "Shown" is graded, because text cannot tell a working demo from a sentence:
//   live        executed on the page: compiled `.uxdsl`, a call to the runtime API,
//               or output produced by the real tool
//   documented  appears as example code or prose only
//   none        not mentioned at all
// The detection is text-based and a LOWER BOUND on what the playground shows: it
// reads source files, not rendered pages. It finds the two ways the playground
// makes something live — a directive/function in a `.uxdsl` file, and a call to
// the runtime's own generators (buttonComponentCss, inputComponentCss, …), which is
// how the Button and Input demos render, with no `@ds-button` in any `.uxdsl`.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const PLAYGROUND = 'packages/playground-nextjs';

const runtime = () => require(path.join(ROOT, 'packages/postcss-uxdsl/dist/ds-runtime'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// --- the playground's own source, as three views of it -------------------------

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['node_modules', '.next', 'out'].includes(entry.name) || entry.name.startsWith('.')) continue;
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out); else out.push(rel);
  }
  return out;
}

const stripBlockComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const stripLineComments = (text) => text.replace(/(^|[^:\w"'`])\/\/[^\n]*/g, '$1');

/** `.uxdsl` sources (executed: compiled and rendered), `code` (ts/tsx/js), and every text a reader sees (`docs`). */
function playgroundSources() {
  const files = [...walk(`${PLAYGROUND}/src`), `${PLAYGROUND}/themes.js`, `${PLAYGROUND}/uxdsl.config.cjs`, `${PLAYGROUND}/postcss.config.js`, ...fs.readdirSync(path.join(ROOT, PLAYGROUND)).filter((f) => /^uxdsl\.theme\..*\.json$/.test(f)).map((f) => `${PLAYGROUND}/${f}`)];
  const sources = { uxdsl: [], code: [], docs: [] };
  for (const file of files) {
    let text;
    try { text = read(file); } catch { continue; }
    if (file.endsWith('.uxdsl')) sources.uxdsl.push({ file, text: stripLineComments(stripBlockComments(text)) });
    else if (/\.(tsx?|jsx?)$/.test(file)) { const t = stripLineComments(stripBlockComments(text)); sources.code.push({ file, text: t }); if (file.endsWith('.tsx')) sources.docs.push({ file, text }); }
    else if (file.endsWith('.mdx')) sources.docs.push({ file, text });
    else if (file.endsWith('.json')) sources.code.push({ file, text });
  }
  for (const key of Object.keys(sources)) sources[key].sort((a, b) => a.file.localeCompare(b.file));
  return sources;
}

const matching = (list, test) => list.filter(({ text }) => (test instanceof RegExp ? test.test(text) : text.includes(test))).map(({ file }) => file.replace(`${PLAYGROUND}/`, ''));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- manual evidence -----------------------------------------------------------

/**
 * Evidence a text search cannot find — for example that the site's own stylesheet is
 * produced by `uxdsl build` — written down as a file and a string that must be in
 * it. Each entry is checked (the file exists and contains the string), so this is a
 * pointer a test can hold to, not a claim.
 */
const EVIDENCE_FILE = `${PLAYGROUND}/capability-evidence.json`;
function manualEvidence() {
  try { return JSON.parse(read(EVIDENCE_FILE)); } catch { return { manual: [], knownGaps: [] }; }
}

// --- derivation ---------------------------------------------------------------

/** Names the package's own docs put between backticks — the public runtime API. */
function documentedRuntimeFunctions() {
  const docs = ['packages/postcss-uxdsl/README.md', 'AGENTS.md'].map(read).join('\n');
  const exported = runtime();
  return Object.keys(exported)
    .filter((name) => name !== 'default' && typeof exported[name] === 'function' && /^[a-z]/.test(name) && new RegExp(`\`${escapeRe(name)}\\b`).test(docs))
    .sort();
}

function cliSurface() {
  const help = execFileSync(process.execPath, [path.join(ROOT, 'packages/uxdsl-cli/bin/uxdsl.js'), '--help'], { encoding: 'utf8' });
  const commands = [...help.matchAll(/^ {2}([a-z][a-z-]+) {2,}\S/gm)].map((m) => m[1]);
  const flags = [...help.matchAll(/^ {2}(--[a-z][a-z-]*)/gm)].map((m) => m[1]);
  return { commands: [...new Set(commands)].sort(), flags: [...new Set(flags)].sort() };
}

function packageExports() {
  const exportsMap = JSON.parse(read('packages/postcss-uxdsl/package.json')).exports;
  return Object.keys(exportsMap).filter((key) => key !== './package.json' && !key.includes('*')).sort();
}

/**
 * How a family shows up on a page when it is consumed. The family list itself comes
 * from KNOWN_THEME_FAMILIES; this table only says what "using it" looks like, and a
 * test fails when a family has no entry, so a new one cannot be skipped silently.
 */
const FAMILY_CONSUMERS = {
  breakpoints: { uxdsl: /\b(?:xs|sm|md|lg|xl)\(/ },
  spacing: { uxdsl: /\bspace\(/ },
  palette: { uxdsl: /\bpalette\(/ },
  colors: { uxdsl: /\bcolor\(/ },
  densities: { uxdsl: /\bdensity\(/ },
  borders: { uxdsl: /\bborder\(/ },
  radii: { uxdsl: /\b(?:radius|rounded)\(/ },
  shadows: { uxdsl: /\b(?:shadow|elevation)\(/ },
  fonts: { uxdsl: /--uxdsl__font__|@ds-typo\(/ },
  typography_details: { uxdsl: /@ds-typo\(/ },
  surfaces: { directive: 'ds-surface' },
  buttons: { directive: 'ds-button' },
  inputs: { directive: 'ds-input' },
  modes: { code: /data-theme/ },
  typography: { documentedOnly: /"typography"\s*:/ },
};

/** Directives can also be live through the runtime generator a demo calls. */
const DIRECTIVE_RUNTIME = {
  'ds-surface': ['surfaceDeclarations', 'generateSurfaceCss'],
  'ds-button': ['buttonComponentCss', 'buttonDeclarations'],
  'ds-input': ['inputComponentCss', 'inputDeclarations'],
  'ds-typo': ['resolveTypographyRole', 'generateTypographyCss', 'inspectTypographyTheme'],
};

/** What a CLI flag does that a page can produce by calling the same engine. */
const FLAG_RUNTIME_EQUIVALENT = { '--contrast': 'checkThemeContrast' };

/** Where a role or a state is exercised: a file using the family's generator that names it. */
const FAMILY_GENERATOR = {
  surface: { directive: 'ds-surface', runtime: DIRECTIVE_RUNTIME['ds-surface'] },
  button: { directive: 'ds-button', runtime: DIRECTIVE_RUNTIME['ds-button'] },
  input: { directive: 'ds-input', runtime: DIRECTIVE_RUNTIME['ds-input'] },
};

const importedFromRuntime = (name) => new RegExp(`import\\s*(?:type\\s*)?\\{[^}]*\\b${escapeRe(name)}\\b[^}]*\\}\\s*from\\s*['"]postcss-uxdsl(?:/ds-runtime)?['"]`);

function liveFilesForDirective(sources, directive) {
  const inUxdsl = matching(sources.uxdsl, new RegExp(`@${escapeRe(directive)}\\(`));
  const viaRuntime = DIRECTIVE_RUNTIME[directive] ? matching(sources.code, new RegExp(`\\b(?:${DIRECTIVE_RUNTIME[directive].join('|')})\\b`)) : [];
  return [...new Set([...inUxdsl, ...viaRuntime])].sort();
}

function levelOf(live, documented, required) {
  const level = live.length ? 'live' : documented.length ? 'documented' : 'none';
  const met = required === 'documented' ? level !== 'none' : level === 'live';
  return { level, met, files: (live.length ? live : documented).slice(0, 3) };
}

/** Every capability, with the evidence found for it. */
function deriveCapabilities() {
  const sources = playgroundSources();
  const rt = runtime();
  const L = require(path.join(ROOT, 'packages/postcss-uxdsl/dist/language')).LANGUAGE_COMPLETIONS;
  const rows = [];
  const add = (kind, name, required, live, documented, note = '') => rows.push({ id: `${kind}:${name}`, kind, name, required, note, ...levelOf(live, documented, required) });
  const docsMention = (needle) => matching(sources.docs, needle);

  for (const directive of L.directives) {
    add('directive', directive, directive === 'theme' ? 'documented' : 'live', liveFilesForDirective(sources, directive), docsMention(directive === 'theme' ? /@theme\b/ : `@${directive}`), directive === 'theme' ? 'deprecated legacy pack syntax' : '');
  }
  const BREAKPOINTS = new Set(Object.keys(rt.DEFAULT_BREAKPOINTS));
  for (const fn of L.functions) {
    add(BREAKPOINTS.has(fn) ? 'breakpoint-function' : 'function', fn, 'live', matching(sources.uxdsl, new RegExp(`\\b${fn}\\(`)), docsMention(new RegExp(`\\b${fn}\\(`)));
  }
  for (const family of [...rt.KNOWN_THEME_FAMILIES].sort()) {
    const spec = FAMILY_CONSUMERS[family];
    if (!spec) { rows.push({ id: `family:${family}`, kind: 'family', name: family, required: 'live', level: 'none', met: false, files: [], note: 'NO CONSUMER RULE — add one to FAMILY_CONSUMERS' }); continue; }
    const live = spec.uxdsl ? matching(sources.uxdsl, spec.uxdsl) : spec.directive ? liveFilesForDirective(sources, spec.directive) : spec.code ? matching(sources.code, spec.code) : [];
    const documented = matching(sources.docs, spec.documentedOnly || new RegExp(`["'\`]${family}["'\`]|\\b${family}\\b`));
    add('family', family, spec.documentedOnly ? 'documented' : 'live', live, documented, spec.documentedOnly ? 'deprecated legacy family' : '');
  }
  const roleSources = { surface: rt.DEFAULT_SURFACES, button: rt.DEFAULT_BUTTONS, input: rt.DEFAULT_INPUTS };
  const stateSources = { button: rt.BUTTON_STATES, input: rt.INPUT_STATES };
  // States that need no markup — the reader hovers or tabs to them — and the markup
  // the others need before a page can show them.
  const INTERACTION_STATES = new Set(['hover', 'active', 'focus', 'focusvisible']);
  const STATE_MARKUP = { disabled: /\bdisabled\b/, selected: /aria-pressed|aria-selected|is-selected/, readonly: /readOnly|\breadonly\b/, invalid: /aria-invalid|:invalid/ };
  for (const [family, generator] of Object.entries(FAMILY_GENERATOR)) {
    const generatorPattern = new RegExp(`@${generator.directive}\\(|\\b(?:${generator.runtime.join('|')})\\b`);
    const generatorCode = sources.code.filter(({ text }) => generatorPattern.test(text));
    // A demo that lists roles with Object.keys(get<Family>Tokens(…)) renders every role
    // the theme has, custom ones included — none of them appears as a literal.
    const enumerating = new RegExp(`Object\\.keys\\(\\s*get${family[0].toUpperCase()}${family.slice(1)}Tokens\\(`);
    const enumerated = generatorCode.filter(({ text }) => enumerating.test(text)).map(({ file }) => file.replace(`${PLAYGROUND}/`, ''));
    for (const role of Object.keys(roleSources[family])) {
      const live = [
        ...matching(sources.uxdsl, new RegExp(`@${generator.directive}\\(\\s*${role}\\b`)),
        ...matching(generatorCode, new RegExp(`['"\`]${role}['"\`]`)),
        ...enumerated,
      ];
      add('role', `${family}.${role}`, 'live', [...new Set(live)].sort(), matching(sources.docs, new RegExp(`\\b${role}\\b`)));
    }
    for (const state of Object.keys(stateSources[family] || {})) {
      const word = state === 'focusvisible' ? 'focus-?visible' : state;
      const live = INTERACTION_STATES.has(state)
        ? generatorCode.map(({ file }) => file.replace(`${PLAYGROUND}/`, ''))
        : matching(generatorCode, STATE_MARKUP[state] || new RegExp(`\\b${word}\\b`));
      add('state', `${family}.${state}`, 'live', live, matching(sources.docs, new RegExp(`\\b${word}\\b`)));
    }
  }
  for (const name of documentedRuntimeFunctions()) {
    add('runtime', name, 'live', matching(sources.code, importedFromRuntime(name)), docsMention(new RegExp(`\\b${name}\\b`)));
  }
  const cli = cliSurface();
  for (const command of cli.commands) add('cli-command', command, 'documented', [], docsMention(new RegExp(`uxdsl\\s+${command}\\b`)));
  for (const flag of cli.flags) {
    const equivalent = FLAG_RUNTIME_EQUIVALENT[flag];
    const live = equivalent ? matching(sources.code, importedFromRuntime(equivalent)) : [];
    add('cli-flag', flag, equivalent ? 'live' : 'documented', live, docsMention(flag), equivalent ? `same engine as ${equivalent}` : '');
  }
  for (const subpath of packageExports()) {
    const importSpecifier = subpath === '.' ? 'postcss-uxdsl' : `postcss-uxdsl/${subpath.slice(2)}`;
    const live = subpath === './schema/theme.schema.json' ? [] : matching(sources.code, new RegExp(`from\\s*['"]${escapeRe(importSpecifier)}['"]|require\\(\\s*['"]${escapeRe(importSpecifier)}['"]\\s*\\)`));
    add('package-export', subpath, 'live', live, docsMention(importSpecifier) .concat(subpath.includes('schema') ? docsMention('theme.schema.json') : []));
  }
  add('diagnostics', 'UXD_* error codes', 'live', [], docsMention(/\bUXD_[A-Z]/), 'a page that shows a real code from the compiler');
  const { manual } = manualEvidence();
  for (const entry of manual) {
    const row = rows.find((r) => r.id === entry.id);
    if (!row) continue;
    const holds = fs.existsSync(path.join(ROOT, entry.file)) && read(entry.file).includes(entry.needle);
    if (holds) Object.assign(row, levelOf([entry.file.replace(`${PLAYGROUND}/`, '')], [], row.required), { note: row.note || `manual: ${entry.why}` });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// --- dogfooding: how much of the playground's own styling bypasses UXDSL ---------

/** Counted on comment-stripped source. These are candidates to classify, not defects. */
function dogfoodingCounts() {
  const sources = playgroundSources();
  const count = (list, re) => list.reduce((sum, { text }) => sum + (text.match(re) || []).length, 0);
  const cssModules = walk(`${PLAYGROUND}/src`).filter((f) => f.endsWith('.module.css')).length;
  return {
    handWrittenMediaQueries: count(sources.uxdsl, /@media[^{]*\(\s*min-width/g),
    hexColorsInUxdsl: count(sources.uxdsl, /#[0-9a-fA-F]{3,8}\b/g),
    rgbHslInUxdsl: count(sources.uxdsl, /\b(?:rgba?|hsla?)\(/g),
    cssModuleFiles: cssModules,
    inlineStyleObjects: count(sources.code.filter((f) => f.file.endsWith('.tsx')), /style=\{\{/g),
    hexColorsInTsx: count(sources.code.filter((f) => f.file.endsWith('.tsx')), /#[0-9a-fA-F]{6}\b/g),
  };
}

module.exports = { ROOT, PLAYGROUND, EVIDENCE_FILE, manualEvidence, deriveCapabilities, dogfoodingCounts, playgroundSources, FAMILY_CONSUMERS };
