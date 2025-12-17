import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

const THEME_FILES = [
  'uxdsl.theme.default.json',
  'uxdsl.theme.green.json',
  'uxdsl.theme.purple.json',
  'uxdsl.theme.slate.json'
];

const BPS_ORDER = ['xs', 'sm', 'md', 'lg', 'xl'];

const TYPO_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'body',
  'span',
  'caption',
  'small',
  'code',
  'pre',
  'default'
];

function readJson(rel) {
  const abs = path.join(ROOT, rel);
  const raw = fs.readFileSync(abs, 'utf8');
  return JSON.parse(raw);
}

function deepMerge(base, override) {
  if (override === undefined) return base;
  if (override === null) return base;
  if (typeof override !== 'object') return override;

  if (base === undefined || base === null) return override;
  if (typeof base !== 'object') return override;

  if (Array.isArray(base) || Array.isArray(override)) return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out;
}

function hexToRgb(hex) {
  const h = String(hex || '').trim();
  const m = h.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const s = m[1];
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const n = parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
}

function srgbToLin(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relLuminance(rgb) {
  const r = srgbToLin(rgb.r);
  const g = srgbToLin(rgb.g);
  const b = srgbToLin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex, bgHex) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function get(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function parseResponsive(value) {
  const val = String(value || '').trim();
  if (!val) return { kind: 'missing' };

  const re = /(xs|sm|md|lg|xl)\(([^)]+)\)/g;
  const map = {};
  let m;
  let has = false;
  while ((m = re.exec(val)) !== null) {
    has = true;
    map[m[1]] = m[2].trim();
  }
  if (!has) return { kind: 'static', value: val };
  return { kind: 'responsive', map };
}

function resolveResponsive(parsed, bp) {
  if (parsed.kind === 'missing') return undefined;
  if (parsed.kind === 'static') return parsed.value;
  const idx = BPS_ORDER.indexOf(bp);
  for (let i = idx; i >= 0; i--) {
    const key = BPS_ORDER[i];
    if (parsed.map[key] !== undefined) return parsed.map[key];
  }
  // fallback to any defined
  return parsed.map.xs ?? parsed.map.sm ?? parsed.map.md ?? parsed.map.lg ?? parsed.map.xl;
}

function parsePx(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  const m = v.match(/^(-?\d+(?:\.\d+)?)(px|rem)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] || 'px';
  if (unit === 'px') return n;
  if (unit === 'rem') return n * 16;
  return null;
}

function fmt(r) {
  if (r === null || r === undefined) return 'n/a';
  return r.toFixed(2);
}

function auditPalette(themeName, modeName, palette) {
  const checks = [
    { name: 'surface.main vs surface.contrast', fg: 'surface.contrast', bg: 'surface.main', min: 4.5 },
    { name: 'surface.light vs surface.contrast', fg: 'surface.contrast', bg: 'surface.light', min: 4.5 },
    { name: 'surface.dark vs surface.contrast', fg: 'surface.contrast', bg: 'surface.dark', min: 4.5 },

    { name: 'primary.main vs primary.contrast', fg: 'primary.contrast', bg: 'primary.main', min: 4.5 },
    { name: 'secondary.main vs secondary.contrast', fg: 'secondary.contrast', bg: 'secondary.main', min: 4.5 },
    { name: 'success.main vs success.contrast', fg: 'success.contrast', bg: 'success.main', min: 4.5 },
    { name: 'info.main vs info.contrast', fg: 'info.contrast', bg: 'info.main', min: 4.5 },
    { name: 'warning.main vs warning.contrast', fg: 'warning.contrast', bg: 'warning.main', min: 4.5 },
    { name: 'error.main vs error.contrast', fg: 'error.contrast', bg: 'error.main', min: 4.5 },

    { name: 'dark.main vs dark.contrast', fg: 'dark.contrast', bg: 'dark.main', min: 4.5 },
    { name: 'light.main vs light.contrast', fg: 'light.contrast', bg: 'light.main', min: 4.5 }
  ];

  const failures = [];
  const warnings = [];

  for (const c of checks) {
    const fg = get(palette, c.fg);
    const bg = get(palette, c.bg);
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) {
      warnings.push(`WARN ${modeName}: ${c.name} (non-hex colors?) fg=${fg} bg=${bg}`);
      continue;
    }
    if (ratio < c.min) {
      failures.push(`FAIL ${modeName}: ${c.name} contrast=${fmt(ratio)} (<${c.min}) fg=${fg} bg=${bg}`);
    }
  }

  return { failures, warnings };
}

function auditTypography(themeName, theme) {
  const details = theme.typography_details || {};

  const warnings = [];

  // Tag coverage
  for (const tag of TYPO_TAGS) {
    if (tag === 'default') continue;
    if (!details[tag]) {
      warnings.push(`WARN typography: missing typography_details.${tag} (will fall back to CSS defaults)`);
    }
  }

  // Harmony across breakpoints (sizes + hierarchy)
  const pxByTagBp = {};
  for (const tag of TYPO_TAGS) {
    const d = details[tag] || {};
    const fontSize = parseResponsive(d.fontSize);
    const lineHeight = parseResponsive(d.lineHeight);

    for (const bp of BPS_ORDER) {
      const sizeRaw = resolveResponsive(fontSize, bp);
      const lhRaw = resolveResponsive(lineHeight, bp);
      const px = parsePx(sizeRaw);

      if (!pxByTagBp[tag]) pxByTagBp[tag] = {};
      pxByTagBp[tag][bp] = px;

      if (sizeRaw !== undefined && px === null) {
        warnings.push(`WARN typography: ${tag}.fontSize at ${bp} is not a px/rem length (${sizeRaw})`);
      }

      const lhNum = lhRaw !== undefined ? Number(String(lhRaw).trim()) : NaN;
      if (lhRaw !== undefined && !Number.isFinite(lhNum)) {
        warnings.push(`WARN typography: ${tag}.lineHeight at ${bp} is not numeric (${lhRaw})`);
      } else if (Number.isFinite(lhNum)) {
        if (lhNum < 1.05 || lhNum > 2.2) {
          warnings.push(`WARN typography: ${tag}.lineHeight at ${bp} looks odd (${lhNum})`);
        }
      }
    }

    // Non-decreasing size across bps
    const seq = BPS_ORDER.map((bp) => pxByTagBp[tag]?.[bp]).filter((n) => typeof n === 'number');
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] < seq[i - 1]) {
        warnings.push(`WARN typography: ${tag}.fontSize decreases across breakpoints (${seq[i - 1]}px -> ${seq[i]}px)`);
        break;
      }
    }
  }

  // Heading hierarchy per breakpoint
  const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  for (const bp of BPS_ORDER) {
    const vals = headings.map((h) => ({ h, px: pxByTagBp[h]?.[bp] }));
    const haveAll = vals.every((v) => typeof v.px === 'number');
    if (!haveAll) continue;
    for (let i = 0; i < vals.length - 1; i++) {
      if (vals[i].px < vals[i + 1].px) {
        warnings.push(`WARN typography: hierarchy violated at ${bp}: ${vals[i].h} (${vals[i].px}px) < ${vals[i + 1].h} (${vals[i + 1].px}px)`);
        break;
      }
    }
  }

  return { warnings };
}

function main() {
  let totalFailures = 0;

  for (const file of THEME_FILES) {
    const theme = readJson(file);
    const name = file.replace(/^uxdsl\.theme\./, '').replace(/\.json$/, '');

    const basePalette = theme.palette || {};
    const lightRes = auditPalette(name, 'light', basePalette);

    const darkPaletteOverride = theme.modes?.dark?.palette || {};
    const darkPalette = deepMerge(basePalette, darkPaletteOverride);
    const darkRes = auditPalette(name, 'dark', darkPalette);

    const typoRes = auditTypography(name, theme);

    const failures = [...lightRes.failures, ...darkRes.failures];
    const warnings = [...lightRes.warnings, ...darkRes.warnings, ...typoRes.warnings];

    console.log(`\n=== Theme: ${name} ===`);
    if (failures.length === 0) {
      console.log('Palette contrast: OK');
    } else {
      console.log('Palette contrast: FAIL');
      for (const f of failures) console.log(`- ${f}`);
      totalFailures += failures.length;
    }

    if (warnings.length) {
      console.log('Warnings:');
      for (const w of warnings) console.log(`- ${w}`);
    }
  }

  if (totalFailures > 0) {
    console.error(`\nAccessibility audit FAILED with ${totalFailures} contrast issues.`);
    process.exitCode = 1;
  } else {
    console.log('\nAccessibility audit PASSED (no contrast failures).');
  }
}

main();
