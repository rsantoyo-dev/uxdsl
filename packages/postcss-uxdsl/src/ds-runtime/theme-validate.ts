import { DEFAULT_BREAKPOINTS } from './breakpoints';

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

function hasAnyResponsiveMarkers(raw: string): boolean {
  return /(xs|sm|md|lg|xl)\(/.test(raw);
}

function hasXsMarker(raw: string): boolean {
  return /xs\(/.test(raw);
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
  }
): ThemeValidationResult<TTheme> {
  const errors: ThemeValidationIssue[] = [];
  const warnings: ThemeValidationIssue[] = [];

  const requireXsForResponsive = opts?.requireXsForResponsive ?? true;

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
      (['sm', 'md', 'lg', 'xl'] as const).forEach((k) => {
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
  theme.breakpoints = { sm: bps.sm, md: bps.md, lg: bps.lg, xl: bps.xl };

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

  // Color scales for color(token) -> --ds__color__token
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

      ensureStringOrUndefined(`typography_details.${tag}.fontSize`, 'fontSize');
      ensureStringOrUndefined(`typography_details.${tag}.lineHeight`, 'lineHeight');
      ensureStringOrUndefined(`typography_details.${tag}.fontWeight`, 'fontWeight');
      ensureStringOrUndefined(`typography_details.${tag}.letterSpacing`, 'letterSpacing');
      ensureStringOrUndefined(`typography_details.${tag}.fontFamily`, 'fontFamily');
      ensureStringOrUndefined(`typography_details.${tag}.textTransform`, 'textTransform');
      ensureStringOrUndefined(`typography_details.${tag}.textDecoration`, 'textDecoration');
      ensureStringOrUndefined(`typography_details.${tag}.fontStyle`, 'fontStyle');
      ensureStringOrUndefined(`typography_details.${tag}.marginBlockStart`, 'marginBlockStart');
      ensureStringOrUndefined(`typography_details.${tag}.marginBlockEnd`, 'marginBlockEnd');

      if (typeof next.fontFamily === 'string') {
        next.fontFamily = normalizeFontFamily(next.fontFamily);
      }

      const checkResponsive = (key: 'fontSize' | 'lineHeight') => {
        const v = next[key];
        if (typeof v !== 'string' || v.trim().length === 0) return;
        if (hasAnyResponsiveMarkers(v) && requireXsForResponsive && !hasXsMarker(v)) {
          errors.push({
            path: `typography_details.${tag}.${key}`,
            message: `Responsive syntax requires xs(...) as the base value.`,
          });
        }
      };
      checkResponsive('fontSize');
      checkResponsive('lineHeight');

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

  return {
    ok: errors.length === 0,
    theme: theme as TTheme,
    errors,
    warnings,
  };
}
