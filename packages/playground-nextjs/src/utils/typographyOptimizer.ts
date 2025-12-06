
interface TypographyStyle {
  size?: string;
  line?: string;
  weight?: string;
  spacing?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Helper to parse "xs(32px) md(40px)" into a map of numbers
const parseResponsiveSize = (value: string | undefined): Record<string, number> => {
  if (!value) return { xs: 16, md: 16, xl: 16 }; // Default fallback
  
  const breakpoints: Record<string, number> = {};
  const regex = /(xs|sm|md|lg|xl)\(([\d.]+)px\)/g;
  let match;
  let found = false;
  
  while ((match = regex.exec(value)) !== null) {
    breakpoints[match[1]] = parseFloat(match[2]);
    found = true;
  }
  
  if (!found) {
    // Try parsing single value
    const single = parseFloat(value);
    if (!isNaN(single)) return { xs: single, md: single, xl: single };
  }
  
  return breakpoints;
};

// Helper to reconstruct the string
const formatResponsiveSize = (bps: Record<string, number>): string => {
  // Generate all breakpoints for smooth scaling
  const xs = Math.round(bps.xs || bps.sm || 16);
  const md = Math.round(bps.md || bps.lg || xs * 1.2);
  const xl = Math.round(bps.xl || md * 1.2);
  
  // Interpolate intermediate breakpoints
  const sm = Math.round(xs + (md - xs) * 0.33);
  const lg = Math.round(md + (xl - md) * 0.5);
  
  return `xs(${xs}px) sm(${sm}px) md(${md}px) lg(${lg}px) xl(${xl}px)`;
};

const TAG_HIERARCHY = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'small'];

export const optimizeTypography = (
  targetTag: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentTheme: any,
  mode: 'single' | 'all',
  themeName: string
) => {
  const typography = currentTheme.typography_details || {};
  const updates: Record<string, TypographyStyle> = {};

  // 1. Determine Scale Ratio based on Theme Name
  let ratio = 1.2; // Minor Third (Default)
  if (themeName === 'purple') ratio = 1.333; // Perfect Fourth (Dramatic/Playful)
  if (themeName === 'green') ratio = 1.25; // Major Third (Balanced/Nature)
  if (themeName === 'custom') ratio = 1.25; // Major Third (Safe default for custom)

  // 2. Identify Base Size (Anchor)
  // We usually anchor on 'p' or 'body' at 16px
  const baseSizeMap = parseResponsiveSize(typography.p?.size || typography.body?.size || '16px');
  const basePx = baseSizeMap.md || 16;

  // 3. Calculate Ideal Sizes for all tags based on the anchor
  const idealSizes: Record<string, number> = {};
  
  // p is index 0 for calculation relative to itself
  idealSizes['p'] = basePx;
  idealSizes['body'] = basePx;
  idealSizes['span'] = basePx;
  idealSizes['default'] = basePx;

  // Headings go up
  idealSizes['h6'] = basePx * Math.pow(ratio, 1);
  idealSizes['h5'] = basePx * Math.pow(ratio, 2);
  idealSizes['h4'] = basePx * Math.pow(ratio, 3);
  idealSizes['h3'] = basePx * Math.pow(ratio, 4);
  idealSizes['h2'] = basePx * Math.pow(ratio, 5);
  idealSizes['h1'] = basePx * Math.pow(ratio, 6);

  // Small goes down
  idealSizes['small'] = basePx / ratio;
  idealSizes['caption'] = basePx / ratio;

  // 4. Logic for "Single" vs "All"
  const tagsToProcess = mode === 'all' ? TAG_HIERARCHY : [targetTag];

  tagsToProcess.forEach(tag => {
    // If mode is single, we try to be smarter about neighbors
    if (mode === 'single' && TAG_HIERARCHY.includes(tag)) {
      const index = TAG_HIERARCHY.indexOf(tag);
      const prevTag = TAG_HIERARCHY[index - 1]; // e.g., h1 if tag is h2
      const nextTag = TAG_HIERARCHY[index + 1]; // e.g., h3 if tag is h2

      const prevSize = prevTag ? parseResponsiveSize(typography[prevTag]?.size).md : null;
      const nextSize = nextTag ? parseResponsiveSize(typography[nextTag]?.size).md : null;

      let calculatedSize = idealSizes[tag];

      // Smart Interpolation: If we have both neighbors, fit perfectly between them
      if (prevSize && nextSize) {
        // Geometric mean for smooth visual steps
        calculatedSize = Math.sqrt(prevSize * nextSize);
      } else if (prevSize) {
        calculatedSize = prevSize / ratio;
      } else if (nextSize) {
        calculatedSize = nextSize * ratio;
      }
      
      // Generate full responsive string
      const size = calculatedSize;
      
      // Smart Line Height Calculation
      // Larger text needs tighter line height, and responsive adjustment
      let lineHeight = '1.5';
      if (tag === 'h1') lineHeight = 'xs(1.15) md(1.05) xl(1.0)'; // Very tight on large screens
      else if (tag === 'h2') lineHeight = 'xs(1.2) md(1.1) xl(1.05)';
      else if (tag === 'h3') lineHeight = 'xs(1.25) md(1.15) xl(1.1)';
      else if (tag === 'h4') lineHeight = 'xs(1.3) md(1.2) xl(1.15)';
      else if (tag === 'h5') lineHeight = 'xs(1.35) md(1.25) xl(1.2)';
      else if (tag === 'h6') lineHeight = 'xs(1.4) md(1.3) xl(1.25)';
      else if (tag === 'p' || tag === 'body') lineHeight = 'xs(1.6) md(1.55) xl(1.5)'; // Standard reading

      // Smart Letter Spacing
      // Larger text needs tighter tracking
      let spacing = 'normal';
      if (tag === 'h1') spacing = 'xs(-0.01em) md(-0.02em) xl(-0.03em)';
      else if (tag === 'h2') spacing = 'xs(0em) md(-0.01em) xl(-0.02em)';
      else if (tag === 'small' || tag === 'caption') spacing = '0.01em';

      // Smart Margins (Breathing Room)
      // Headings need space above to separate sections
      let marginStart = 'auto';
      let marginEnd = 'auto';
      if (tag.startsWith('h')) {
        // Responsive margins? Maybe just ems are fine as they scale with font size
        marginStart = '1.25em'; 
        marginEnd = '0.5em';
      } else if (tag === 'p') {
        marginEnd = '1.15em';
      }

      updates[tag] = {
        ...typography[tag],
        size: formatResponsiveSize({
          xs: size * 0.75, // Mobile reduction (more aggressive)
          md: size,       // Base
          xl: size * 1.25  // Large screen expansion
        }),
        line: lineHeight,
        spacing: spacing,
        marginBlockStart: marginStart,
        marginBlockEnd: marginEnd
      };

    } else {
      // "All" mode or non-hierarchy tag: Use the ideal scale
      const size = idealSizes[tag] || basePx;
      
      // Smart Line Height
      let lineHeight = '1.5';
      if (tag === 'h1') lineHeight = 'xs(1.15) md(1.05) xl(1.0)';
      else if (tag === 'h2') lineHeight = 'xs(1.2) md(1.1) xl(1.05)';
      else if (tag === 'h3') lineHeight = 'xs(1.25) md(1.15) xl(1.1)';
      else if (tag === 'h4') lineHeight = 'xs(1.3) md(1.2) xl(1.15)';
      else if (tag === 'h5') lineHeight = 'xs(1.35) md(1.25) xl(1.2)';
      else if (tag === 'h6') lineHeight = 'xs(1.4) md(1.3) xl(1.25)';
      else if (tag === 'p' || tag === 'body') lineHeight = 'xs(1.6) md(1.55) xl(1.5)';

      // Smart Letter Spacing
      let spacing = 'normal';
      if (tag === 'h1') spacing = 'xs(-0.01em) md(-0.02em) xl(-0.03em)';
      else if (tag === 'h2') spacing = 'xs(0em) md(-0.01em) xl(-0.02em)';
      else if (tag === 'small' || tag === 'caption') spacing = '0.01em';

      // Smart Margins
      let marginStart = 'auto';
      let marginEnd = 'auto';
      if (tag.startsWith('h')) {
        marginStart = '1.25em';
        marginEnd = '0.5em';
      } else if (tag === 'p') {
        marginEnd = '1.15em';
      }

      updates[tag] = {
        ...typography[tag],
        size: formatResponsiveSize({
          xs: size * 0.75,
          md: size,
          xl: size * 1.25
        }),
        line: lineHeight,
        spacing: spacing,
        marginBlockStart: marginStart,
        marginBlockEnd: marginEnd
      };
    }
  });

  return updates;
};
