import { compileDensityRules, getDensityTokens } from '../language';
import { compileInputRules } from '../inputs';
import { compileButtonRules } from '../buttons';
import { compileSurfaceRules } from '../surfaces';
import { compileShadowRules } from '../shadows';
import { compileEdgeRules } from '../edges';
import { compileTypographyRules, TYPOGRAPHY_PROPERTIES } from '../typography';
import { DEFAULT_BREAKPOINTS } from './breakpoints';
import { generateThemeCss } from './theme-generator';
import { ReferenceIntegrityError, ReferenceOptions } from '../reference-integrity';

export type ThemeValidationIssue = {
  path: string;
  message: string;
};

export type ThemeValidationResult<TTheme extends Record<string, any>> = {
  ok: boolean;
  theme: TTheme;
  errors: ThemeValidationIssue[];
  warnings: ThemeValidationIssue[];
};

// MIG-B3-03 (FEAT-004): every top-level theme family this validator (or the
// compiler/generator it wraps) actually reads. A family outside this list
// is either a typo (`color` instead of `colors`) or a stray field left over
// from copy-pasting a build config into a theme file — both currently pass
// through silently and end up nowhere, since nothing consumes an unknown
// key. Kept in one place so a new family added elsewhere doesn't need a
// second edit here to stop warning about itself.
const KNOWN_THEME_FAMILIES = new Set([
  'breakpoints', 'spacing', 'palette', 'fonts', 'colors', 'typography_details',
  'densities', 'inputs', 'buttons', 'surfaces', 'shadows', 'borders', 'radii',
]);

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function isLikelyCssColorValue(value: string): boolean {
  const v = String(value || '').trim();
  if (!v) return false;
  return (
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
    /^rgb\(/i.test(v) ||
    /^rgba\(/i.test(v) ||
    /^hsl\(/i.test(v) ||
    /^hsla\(/i.test(v) ||
    /^color\(/i.test(v) ||
    /^var\(/i.test(v) ||
    /^[a-z]+$/i.test(v)
  );
}

function normalizeFontFamily(raw: string): string {
  const v = String(raw || '').trim();
  if (!v) return v;

  // If user is explicitly using variables/functions, don't rewrite.
  if (v.includes('var(') || v.includes('calc(')) return v;

  // Quote only the primary family if it's multi-word and not already quoted.
  const parts = v.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return v;

  const primary = parts[0];
  const alreadyQuoted =
    (primary.startsWith('"') && primary.endsWith('"')) ||
    (primary.startsWith("'") && primary.endsWith("'"));

  const needsQuotes = !alreadyQuoted && /\s/.test(primary) && !primary.startsWith('var(');
  const normalizedPrimary = needsQuotes ? `"${primary.replace(/\"/g, '').trim()}"` : primary;

  const rest = parts.slice(1);
  return [normalizedPrimary, ...rest].join(', ');
}

export function deepMergeTheme<TBase extends Record<string, any>, TOverride extends Record<string, any>>(
  base: TBase,
  override: TOverride
): TBase & TOverride {
  if (!isPlainObject(base)) return override as any;
  if (!isPlainObject(override)) return base as any;

  const out: Record<string, any> = { ...base };
  Object.keys(override).forEach((key) => {
    const nextVal = (override as any)[key];
    if (nextVal === undefined) return;

    const prevVal = (base as any)[key];
    if (Array.isArray(nextVal)) {
      out[key] = nextVal.slice();
      return;
    }
    if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
      out[key] = deepMergeTheme(prevVal, nextVal);
      return;
    }
    out[key] = nextVal;
  });
  return out as any;
}

export function validateAndNormalizeTheme<TTheme extends Record<string, any>>(
  input: unknown,
  opts?: {
    requireXsForResponsive?: boolean;
    references?: ReferenceOptions;
  }
): ThemeValidationResult<TTheme> {
  const errors: ThemeValidationIssue[] = [];
  const warnings: ThemeValidationIssue[] = [];

  // Kept in the public options for compatibility; Typography now always needs a base.

  const theme: Record<string, any> = isPlainObject(input) ? deepMergeTheme({}, input) : {};
  if (!isPlainObject(input)) {
    errors.push({ path: 'theme', message: 'Theme must be an object.' });
  }

  // Breakpoints
  const bpRaw = theme.breakpoints;
  const bps: Record<string, number> = { ...DEFAULT_BREAKPOINTS };
  if (bpRaw !== undefined) {
    if (!isPlainObject(bpRaw)) {
      errors.push({ path: 'breakpoints', message: 'breakpoints must be an object of numbers.' });
    } else {
      Object.keys(bpRaw).forEach((k) => {
        const n = toNumberOrUndefined(bpRaw[k]);
        if (n === undefined) {
          if (bpRaw[k] !== undefined) {
            errors.push({ path: `breakpoints.${k}`, message: 'Breakpoint must be a number.' });
          }
          return;
        }
        bps[k] = n;
      });

      // sanity ordering (warn only; we keep provided values)
      const ordered = [bps.sm, bps.md, bps.lg, bps.xl];
      for (let i = 1; i < ordered.length; i++) {
        if (ordered[i] < ordered[i - 1]) {
          warnings.push({
            path: 'breakpoints',
            message: 'Breakpoints are not ascending (sm <= md <= lg <= xl).',
          });
          break;
        }
      }
    }
  }
  theme.breakpoints = bps;

  // Fonts
  if (theme.fonts !== undefined && !isPlainObject(theme.fonts)) {
    errors.push({ path: 'fonts', message: 'fonts must be an object.' });
    theme.fonts = undefined;
  }
  if (isPlainObject(theme.fonts) && theme.fonts.families !== undefined && !isPlainObject(theme.fonts.families)) {
    errors.push({ path: 'fonts.families', message: 'fonts.families must be an object of strings.' });
    theme.fonts.families = undefined;
  }
  if (isPlainObject(theme.fonts) && isPlainObject(theme.fonts.families)) {
    Object.keys(theme.fonts.families).forEach((k) => {
      const v = theme.fonts.families[k];
      if (typeof v !== 'string') {
        errors.push({ path: `fonts.families.${k}`, message: 'Font family must be a string.' });
        return;
      }
      theme.fonts.families[k] = normalizeFontFamily(v);
    });
  }
  if (isPlainObject(theme.fonts) && theme.fonts.google !== undefined) {
    if (!Array.isArray(theme.fonts.google)) {
      errors.push({ path: 'fonts.google', message: 'fonts.google must be an array of strings.' });
      theme.fonts.google = undefined;
    } else {
      theme.fonts.google = theme.fonts.google
        .filter((v: unknown) => typeof v === 'string' && v.trim().length > 0)
        .map((v: string) => v.trim());
    }
  }

  // Color scales for color(token) -> --uxdsl__color__token
  if (theme.colors !== undefined && !isPlainObject(theme.colors)) {
    errors.push({ path: 'colors', message: 'colors must be an object.' });
    theme.colors = undefined;
  }
  if (isPlainObject(theme.colors)) {
    Object.keys(theme.colors).forEach((familyKey) => {
      const familyVal = theme.colors[familyKey];
      const familyPath = `colors.${familyKey}`;

      if (typeof familyVal === 'string') {
        const trimmed = familyVal.trim();
        if (!trimmed) {
          errors.push({ path: familyPath, message: 'Color value cannot be empty.' });
          delete theme.colors[familyKey];
          return;
        }
        theme.colors[familyKey] = trimmed;
        if (!isLikelyCssColorValue(trimmed)) {
          warnings.push({
            path: familyPath,
            message: 'Value does not look like a common CSS color format.',
          });
        }
        return;
      }

      if (!isPlainObject(familyVal)) {
        errors.push({
          path: familyPath,
          message: 'Color family must be either a string or an object of shade/value pairs.',
        });
        delete theme.colors[familyKey];
        return;
      }

      Object.keys(familyVal).forEach((shadeKey) => {
        const shadePath = `${familyPath}.${shadeKey}`;
        const raw = familyVal[shadeKey];

        if (typeof raw !== 'string') {
          errors.push({ path: shadePath, message: 'Color shade value must be a string.' });
          delete familyVal[shadeKey];
          return;
        }

        const trimmed = raw.trim();
        if (!trimmed) {
          errors.push({ path: shadePath, message: 'Color shade value cannot be empty.' });
          delete familyVal[shadeKey];
          return;
        }

        familyVal[shadeKey] = trimmed;
        if (!isLikelyCssColorValue(trimmed)) {
          warnings.push({
            path: shadePath,
            message: 'Value does not look like a common CSS color format.',
          });
        }
      });

      if (Object.keys(familyVal).length === 0) {
        warnings.push({ path: familyPath, message: 'Color family has no valid shade values.' });
      }
    });
  }

  // Typography details (partial allowed)
  if (theme.typography_details !== undefined && !isPlainObject(theme.typography_details)) {
    errors.push({ path: 'typography_details', message: 'typography_details must be an object.' });
    theme.typography_details = undefined;
  }

  if (isPlainObject(theme.typography_details)) {
    const details = theme.typography_details;
    const defaultTag = isPlainObject(details.default) ? details.default : {};
    if (details.default !== undefined && !isPlainObject(details.default)) {
      errors.push({ path: 'typography_details.default', message: 'default must be an object.' });
    }

    const normalizeTagObject = (tag: string, obj: Record<string, any>) => {
      const next: Record<string, any> = { ...obj };

      const ensureStringOrUndefined = (path: string, key: string) => {
        if (next[key] === undefined) return;
        const v = next[key];
        if (typeof v === 'string') {
          next[key] = v.trim();
          return;
        }
        if (typeof v === 'number' && Number.isFinite(v)) {
          next[key] = String(v);
          return;
        }
        errors.push({ path, message: 'Must be a string.' });
        delete next[key];
      };

      Object.keys(TYPOGRAPHY_PROPERTIES).forEach(key => ensureStringOrUndefined(`typography_details.${tag}.${key}`, key));
      // Preserve configured expressions; generation and validation share one contract.

      return next;
    };

    // Normalize default first
    const normalizedDefault = normalizeTagObject('default', defaultTag);
    details.default = normalizedDefault;

    Object.keys(details).forEach((tag) => {
      if (tag === 'default') return;
      const raw = details[tag];
      if (!isPlainObject(raw)) {
        errors.push({ path: `typography_details.${tag}`, message: 'Tag entry must be an object.' });
        delete details[tag];
        return;
      }

      // Partial override: merge default -> tag
      const merged = deepMergeTheme(normalizedDefault, raw);
      details[tag] = normalizeTagObject(tag, merged);
    });
  }

  if (theme.typography_details) {
    try { compileTypographyRules(theme.typography_details, bps); }
    catch (cause) { errors.push({ path: 'typography_details', message: cause instanceof Error ? cause.message : String(cause) }); }
  }

  try { compileDensityRules(getDensityTokens(theme), bps); }
  catch (cause) { errors.push({ path: 'densities', message: cause instanceof Error ? cause.message : String(cause) }); }
  try { compileInputRules(theme, bps); }
  catch (cause) { errors.push({ path: 'inputs', message: cause instanceof Error ? cause.message : String(cause) }); }
  try { compileButtonRules(theme, bps); }
  catch (cause) { errors.push({ path: 'buttons', message: cause instanceof Error ? cause.message : String(cause) }); }
  try { compileSurfaceRules(theme, bps); }
  catch (cause) { errors.push({ path: 'surfaces', message: cause instanceof Error ? cause.message : String(cause) }); }

  try { compileShadowRules(theme, bps); }
  catch (cause) { errors.push({ path: 'shadows', message: cause instanceof Error ? cause.message : String(cause) }); }

  try { compileEdgeRules(theme, bps); }
  catch (cause) { errors.push({ path: 'borders/radii', message: cause instanceof Error ? cause.message : String(cause) }); }

  if (!errors.length) {
    try {
      generateThemeCss(theme, { ...opts?.references, onWarning: issue => {
        warnings.push({ path: issue.chain.join(' -> '), message: issue.message });
        opts?.references?.onWarning?.(issue);
      } });
    } catch (cause) {
      if (cause instanceof ReferenceIntegrityError) {
        for (const issue of cause.issues) errors.push({ path: issue.chain.join(' -> '), message: issue.message });
      } else errors.push({ path: 'theme', message: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  // MIG-B3-03: an unknown top-level family is exactly the "silent fallback"
  // gap that lets a theme-file/build-config collision (or a plain typo like
  // `color` for `colors`) go unnoticed — nothing consumes the key, so it
  // neither errors nor visibly does anything. A warning, not an error: this
  // validator has no way to distinguish "typo" from "a family this version
  // doesn't know about yet" from "genuinely unused scratch data".
  if (isPlainObject(input)) {
    Object.keys(input).forEach((key) => {
      if (!KNOWN_THEME_FAMILIES.has(key)) {
        warnings.push({ path: key, message: `Unknown theme family "${key}" — it will not be compiled into any CSS.` });
      }
    });
  }

  // MIG-B6-01 (FEAT-007): MIG-B5-02 added a parallel "Unknown <family> key"
  // warning one level deeper, for typography_details/palette/fonts.families,
  // reusing DEFAULT_THEME's own key sets as the "known" list. That's wrong:
  // DEFAULT_THEME is a deliberately minimal, zero-crash fallback (see its
  // own doc comment), not a catalog of every valid key — and unlike the
  // top-level family check above, none of these three families actually
  // has a closed set anywhere in the compiler to compare against.
  // `foundations.ts`'s `namespacedVars()` turns every key a theme provides
  // into a CSS var for `palette`/`fonts.families` with no restriction at
  // all, and `typography.ts`'s tag-name validation only checks *shape*
  // (`/^[a-z][a-z0-9-]*$/`), not membership in any fixed list — so any
  // project with a richer palette (or a custom font role, or a custom
  // typography tag) than DEFAULT_THEME's 4/3/1 entries got incorrect
  // "won't be compiled" warnings on every build, unconditionally, since
  // this ships with no opt-in flag (unlike `--strict-theme`). Removed
  // rather than repointed at a bigger list, because no such list exists to
  // point at: "known key" isn't a well-defined question for a family whose
  // whole design is an open, per-project namespace. Field names *within* a
  // typography tag remain validated for real, as a hard compiler error —
  // see `TYPOGRAPHY_PROPERTIES` above and `compileTypographyRules`'s
  // `UXD_TYPO_FIELD`.

  return {
    ok: errors.length === 0,
    theme: theme as TTheme,
    errors,
    warnings,
  };
}
