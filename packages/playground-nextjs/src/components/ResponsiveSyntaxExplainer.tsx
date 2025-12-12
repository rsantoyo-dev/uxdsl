'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { useTypographyDemo, initialTypographyItems } from './TypographyDemoContext';
import { Edit2, Trash2, Monitor, Sparkles, Loader2 } from 'lucide-react';
import { BreakpointEditor } from './BreakpointEditor';
import { InteractiveDemoContainer } from './InteractiveDemoContainer';
// import { optimizeTypography } from '../utils/typographyOptimizer';

const TAGS = ['default', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'body', 'caption'];
const BPS = [
  { label: 'XS', width: 30 },
  { label: 'SM', width: 45 },
  { label: 'MD', width: 65 },
  { label: 'LG', width: 86 },
  { label: 'XL', width: 100 },
  { label: 'Default', width: 100 }
];

const SAMPLE_TEXT_PRESETS: Array<{ id: string; label: string; text: string }> = [
  { id: 'uxdsl', label: 'UXDSL — Responsive intelligent styles', text: 'UXDSL — Responsive intelligent styles' },
  { id: 'lorem', label: 'Lorem ipsum', text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
  { id: 'quick-brown', label: 'The quick brown fox', text: 'The quick brown fox jumps over the lazy dog.' },
  { id: 'pangram', label: 'Sphinx of black quartz', text: 'Sphinx of black quartz, judge my vow.' },
  { id: 'numbers', label: 'Numbers & symbols', text: '0123456789 — $19.99 · 50% off · (123) 456-7890' }
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SyntaxHighlighter = ({ value, widthPercent, isAutoMode, windowWidth, themeBreakpoints, baseColor }: { value: string, widthPercent: number, isAutoMode?: boolean, windowWidth?: number, themeBreakpoints?: any, baseColor?: string }) => {
  const color = baseColor || 'var(--ds__palette__info-main)';
  if (!value) return <span style={{ color }}>&quot;&quot;</span>;

  // Determine active breakpoint
  const getActiveBreakpoint = () => {
    let effectivePx;
    
    if (isAutoMode && windowWidth !== undefined && windowWidth > 0) {
      effectivePx = windowWidth;
    } else {
      const px = (widthPercent / 100) * 1200; 
      effectivePx = widthPercent === 100 ? 1280 : px;
    }
    
    const breakpoints: Record<string, boolean> = {};
    const regex = /(xs|sm|md|lg|xl)\(/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      breakpoints[match[1]] = true;
    }
    
    if (Object.keys(breakpoints).length === 0) return 'static';

    const bpValues = themeBreakpoints || { sm: 480, md: 768, lg: 1024, xl: 1280 };

    if (effectivePx >= bpValues.xl && breakpoints.xl) return 'xl';
    if (effectivePx >= bpValues.lg && breakpoints.lg) return 'lg';
    if (effectivePx >= bpValues.md && breakpoints.md) return 'md';
    if (effectivePx >= bpValues.sm && breakpoints.sm) return 'sm';
    if (breakpoints.xs) return 'xs';
    if (breakpoints.sm) return 'sm';
    return 'static';
  };

  const activeBp = getActiveBreakpoint();

  if (activeBp === 'static') {
    return <span style={{ color }}>&quot;{value}&quot;</span>;
  }

  // Parse string into segments
  const parts: { text: string, type: 'text' | 'bp', bp?: string }[] = [];
  const regex = /(xs|sm|md|lg|xl)\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: value.slice(lastIndex, match.index), type: 'text' });
    }
    parts.push({ text: match[0], type: 'bp', bp: match[1] });
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < value.length) {
    parts.push({ text: value.slice(lastIndex), type: 'text' });
  }

  return (
    <span style={{ color }}>
      &quot;
      {parts.map((part, i) => {
        if (part.type === 'bp') {
          const isActive = part.bp === activeBp;
          return (
            <span 
              key={i} 
              style={isActive ? { 
                color: '#ff4d4d', 
                textShadow: '0 0 8px rgba(255, 77, 77, 0.4)',
                fontWeight: 600
              } : {}}
            >
              {part.text}
            </span>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
      &quot;
    </span>
  );
};

export function ResponsiveSyntaxExplainer({ action }: { action?: React.ReactNode }) {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme();
  const { textMap, updateText, editingTag, setEditingTag } = useTypographyDemo();
  const [selectedTag, setSelectedTag] = useState('h1');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFontFamilyEditorOpen, setIsFontFamilyEditorOpen] = useState(false);
  const [isFontWeightEditorOpen, setIsFontWeightEditorOpen] = useState(false);
  const [isLineHeightEditorOpen, setIsLineHeightEditorOpen] = useState(false);
  const [isLetterSpacingEditorOpen, setIsLetterSpacingEditorOpen] = useState(false);
  const [isTextTransformEditorOpen, setIsTextTransformEditorOpen] = useState(false);
  const [isTextDecorationEditorOpen, setIsTextDecorationEditorOpen] = useState(false);
  const [isFontStyleEditorOpen, setIsFontStyleEditorOpen] = useState(false);
  const [isMarginBlockStartEditorOpen, setIsMarginBlockStartEditorOpen] = useState(false);
  const [isMarginBlockEndEditorOpen, setIsMarginBlockEndEditorOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(100); // Percentage
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [windowWidth, setWindowWidth] = useState(0);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const editableRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const getInitialTextForTag = (tag: string) => {
    const fallback = initialTypographyItems.find((i) => i.tag === tag)?.text;
    return fallback || '';
  };

  // Track window width for auto mode
  useEffect(() => {
    // Initialize immediately on mount
    setWindowWidth(window.innerWidth);
    
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper to resolve responsive value based on width
  const resolveResponsiveValue = (val: string, widthPercent: number) => {
    if (!val) return '';
    // Approximate width in pixels based on a standard 1200px container
    const px = (widthPercent / 100) * 1200; 
    // Hack for demo: if width is 100%, treat as XL (1280+) to ensure XL breakpoint is reachable
    const effectivePx = widthPercent === 100 ? 1280 : px;
    
    // Parse breakpoints
    const breakpoints: Record<string, string> = {};
    const regex = /(xs|sm|md|lg|xl)\(([^)]+)\)/g;
    let match;
    let hasMatches = false;
    
    while ((match = regex.exec(val)) !== null) {
      hasMatches = true;
      breakpoints[match[1]] = match[2];
    }
    
    if (!hasMatches) return val; // Static value

    // Resolve based on breakpoints (xs:0, sm:480, md:768, lg:1024, xl:1280)
    if (effectivePx >= 1280 && breakpoints.xl) return breakpoints.xl;
    if (effectivePx >= 1024 && breakpoints.lg) return breakpoints.lg;
    if (effectivePx >= 768 && breakpoints.md) return breakpoints.md;
    if (effectivePx >= 480 && breakpoints.sm) return breakpoints.sm;
    return breakpoints.xs || breakpoints.sm || val;
  };

  // Sync with external edit requests (from the list below)
  useEffect(() => {
    if (editingTag && TAGS.includes(editingTag)) {
      setSelectedTag(editingTag);
      // Scroll to editor when triggered from outside
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [editingTag]);

  // Safe access to the typography details
  const defaultDetails = activeThemeData?.typography_details?.default || {
    fontSize: 'xs(16px)',
    fontFamily: 'Inter',
    fontWeight: '400',
    lineHeight: '1.5',
    letterSpacing: 'normal'
  };
  
  const tagDetails = activeThemeData?.typography_details?.[selectedTag] || {};
  
  // Resolve values (Inheritance logic)
  const isDefault = selectedTag === 'default';
  
  const fontSizeString = isDefault 
    ? (tagDetails.fontSize || defaultDetails.fontSize) 
    : (tagDetails.fontSize || defaultDetails.fontSize); // Font size usually specific, but fallback to default if missing

  const fontFamilyString = tagDetails.fontFamily || defaultDetails.fontFamily || 'Inter';
  const fontWeightString = tagDetails.fontWeight || defaultDetails.fontWeight || '400';
  const lineHeightString = tagDetails.lineHeight || defaultDetails.lineHeight || '1.5';
  const letterSpacingString = tagDetails.letterSpacing || defaultDetails.letterSpacing || 'normal';
  const textTransformString = tagDetails.textTransform || defaultDetails.textTransform || 'none';
  const textDecorationString = tagDetails.textDecoration || defaultDetails.textDecoration || 'none';
  const fontStyleString = tagDetails.fontStyle || defaultDetails.fontStyle || 'normal';
  const marginBlockStartString = tagDetails.marginBlockStart || defaultDetails.marginBlockStart || 'auto';
  const marginBlockEndString = tagDetails.marginBlockEnd || defaultDetails.marginBlockEnd || 'auto';

  // Check inheritance status
  const isFontFamilyInherited = !isDefault && !tagDetails.fontFamily;
  const isFontWeightInherited = !isDefault && !tagDetails.fontWeight;
  const isLineHeightInherited = !isDefault && !tagDetails.lineHeight;
  const isLetterSpacingInherited = !isDefault && !tagDetails.letterSpacing;
  const isTextTransformInherited = !isDefault && !tagDetails.textTransform;
  const isTextDecorationInherited = !isDefault && !tagDetails.textDecoration;
  const isFontStyleInherited = !isDefault && !tagDetails.fontStyle;
  const isMarginBlockStartInherited = !isDefault && !tagDetails.marginBlockStart;
  const isMarginBlockEndInherited = !isDefault && !tagDetails.marginBlockEnd;

  // Sync ref content when tag changes (or text updates externally)
  useEffect(() => {
    if (editableRef.current && editableRef.current.innerText !== textMap[selectedTag]) {
      editableRef.current.innerText = textMap[selectedTag] || '';
    }
  }, [selectedTag, textMap]);

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    updateText(selectedTag, e.currentTarget.innerText);
  };

  const currentTagText = textMap[selectedTag] || '';
  const currentSampleId =
    SAMPLE_TEXT_PRESETS.find((p) => p.text === currentTagText)?.id || 'custom';

  const handleSave = (newValue: string) => {
    const newTheme = JSON.parse(JSON.stringify(activeThemeData));
    if (!newTheme.typography_details) newTheme.typography_details = {};
    if (!newTheme.typography_details[selectedTag]) newTheme.typography_details[selectedTag] = {};
    newTheme.typography_details[selectedTag].fontSize = newValue;
    setCustomTheme(customThemeName || 'Custom Theme', newTheme);
  };

  const handleSaveFontFamily = (newValue: string) => {
    const newTheme = JSON.parse(JSON.stringify(activeThemeData));
    if (!newTheme.typography_details) newTheme.typography_details = {};
    if (!newTheme.typography_details[selectedTag]) newTheme.typography_details[selectedTag] = {};

    const rawSelection = (newValue || '').trim();
    const systemFontMap: Record<string, string> = {
      'System UI': 'var(--font-ui)',
      'Monospace': 'var(--font-code)',
      'Serif': 'serif',
      'Sans-Serif': 'sans-serif',
      Arial: 'Arial, sans-serif',
      Helvetica: 'Helvetica, Arial, sans-serif',
      'Times New Roman': '"Times New Roman", Times, serif',
      'Courier New': '"Courier New", Courier, monospace'
    };

    const normalizePrimaryFontName = (fontFamily: string) => {
      return (fontFamily || '')
        .split(',')[0]
        .replace(/['"]/g, '')
        .trim();
    };

    const primaryFont = normalizePrimaryFontName(rawSelection);
    const cssFontFamily =
      systemFontMap[rawSelection] ||
      (primaryFont.includes(' ') ? `"${primaryFont}"` : primaryFont);

    newTheme.typography_details[selectedTag].fontFamily = cssFontFamily;

    // Add to Google Fonts list logic...
    const systemFonts = ["System UI", "Monospace", "Serif", "Sans-Serif", "Arial", "Helvetica", "Times New Roman", "Courier New"];
    const singleWeightFonts = ["Pacifico", "Creepster", "Rye", "Spirax", "Lobster", "Abril Fatface", "Fredoka One"];
    
    if (!systemFonts.includes(rawSelection) && primaryFont) {
      if (!newTheme.fonts) newTheme.fonts = {};
      if (!newTheme.fonts.google) newTheme.fonts.google = [];
      const exists = newTheme.fonts.google.some((f: string) => f.startsWith(primaryFont));
      if (!exists) {
        // Prefer loading italic + weights so fontStyle=italic works without synthetic italics.
        const googleSpecifier = singleWeightFonts.includes(primaryFont)
          ? `${primaryFont}:wght@400`
          : `${primaryFont}:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700`;
        newTheme.fonts.google.push(googleSpecifier);
      }
    }

    setCustomTheme(customThemeName || 'Custom Theme', newTheme);
  };

  const handleSaveProperty = (property: string, newValue: string) => {
    const newTheme = JSON.parse(JSON.stringify(activeThemeData));
    if (!newTheme.typography_details) newTheme.typography_details = {};
    if (!newTheme.typography_details[selectedTag]) newTheme.typography_details[selectedTag] = {};
    newTheme.typography_details[selectedTag][property] = newValue;
    setCustomTheme(customThemeName || 'Custom Theme', newTheme);
  };

  const handleRemoveProperty = (property: string) => {
    if (isDefault) return; // Cannot remove from default
    const newTheme = JSON.parse(JSON.stringify(activeThemeData));
    if (newTheme.typography_details?.[selectedTag]) {
      delete newTheme.typography_details[selectedTag][property];
      setCustomTheme(customThemeName || 'Custom Theme', newTheme);
    }
  };

  const handleOptimize = async (mode: 'single' | 'all') => {
    setIsOptimizing(true);

    type TypographyTagPatch = Record<string, unknown>;
    type TypographyDetailsPatch = Record<string, TypographyTagPatch>;

    const normalizePrimaryFontName = (fontFamily: string) => {
      return (fontFamily || '')
        .split(',')[0]
        .replace(/['"]/g, '')
        .trim();
    };

    const extractResponsiveValue = (value: string, bp: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
      const regex = new RegExp(`${bp}\\(([^)]+)\\)`);
      const match = value.match(regex);
      return match?.[1]?.trim();
    };

    const parsePx = (raw: string | undefined) => {
      if (!raw) return undefined;
      const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
      if (!match) return undefined;
      return Number(match[1]);
    };

    const isResponsiveSyntaxValid = (value: string, requiredBps: Array<'xs' | 'md'>) => {
      if (typeof value !== 'string' || value.trim().length === 0) return false;
      return requiredBps.every((bp) => value.includes(`${bp}(`));
    };

    const getStringField = (obj: unknown, key: string) => {
      if (!obj || typeof obj !== 'object') return undefined;
      const record = obj as Record<string, unknown>;
      return typeof record[key] === 'string' ? (record[key] as string) : undefined;
    };

    const validateTypographyDetailsPatch = (
      detailsPatch: TypographyDetailsPatch,
      validateMode: 'single' | 'all'
    ): { ok: true } | { ok: false; reason: string } => {
      if (!detailsPatch || typeof detailsPatch !== 'object') {
        return { ok: false, reason: 'Missing typography_details object.' };
      }

      const requiredTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'body', 'caption'];
      if (validateMode === 'all') {
        const missing = requiredTags.filter((t) => !detailsPatch[t]);
        if (missing.length) return { ok: false, reason: `Missing tags: ${missing.join(', ')}` };
      }

      const tagsToValidate = validateMode === 'all' ? requiredTags : [selectedTag];
      for (const tag of tagsToValidate) {
        const tagValue = detailsPatch[tag];
        if (!tagValue || typeof tagValue !== 'object') {
          return { ok: false, reason: `Missing object for tag '${tag}'.` };
        }

        const requiredFields = ['fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight'];
        for (const field of requiredFields) {
          const v = getStringField(tagValue, field);
          if (!v || v.trim().length === 0) {
            return { ok: false, reason: `Missing '${field}' for tag '${tag}'.` };
          }
        }

        const fontSize = getStringField(tagValue, 'fontSize') || '';
        const lineHeight = getStringField(tagValue, 'lineHeight') || '';
        const fontWeightStr = getStringField(tagValue, 'fontWeight') || '';

        if (!isResponsiveSyntaxValid(fontSize, ['xs', 'md'])) {
          return { ok: false, reason: `fontSize for '${tag}' must include at least xs(...) and md(...).` };
        }

        if (!isResponsiveSyntaxValid(lineHeight, ['xs', 'md'])) {
          return { ok: false, reason: `lineHeight for '${tag}' must include at least xs(...) and md(...).` };
        }

        const fontWeight = Number(fontWeightStr);
        if (!Number.isFinite(fontWeight) || fontWeight < 100 || fontWeight > 900) {
          return { ok: false, reason: `fontWeight for '${tag}' must be a number 100-900 (string).` };
        }
      }

      if (selectedTag === 'h1' && detailsPatch.h1 && activeThemeData?.typography_details?.h1?.fontSize) {
        const prevXs = parsePx(extractResponsiveValue(activeThemeData.typography_details.h1.fontSize, 'xs') || '');
        const nextFontSize = getStringField(detailsPatch.h1, 'fontSize') || '';
        const nextXs = parsePx(extractResponsiveValue(nextFontSize, 'xs') || '');
        if (prevXs !== undefined && nextXs !== undefined && nextXs < prevXs) {
          return { ok: false, reason: `h1 xs fontSize should not shrink (prev ${prevXs}px, got ${nextXs}px).` };
        }
      }

      if (validateMode === 'all') {
        const pxAt = (tag: string, bp: 'xs' | 'md') => {
          const fontSize = getStringField(detailsPatch[tag], 'fontSize') || '';
          const raw = extractResponsiveValue(fontSize, bp);
          return parsePx(raw);
        };
        const xs = {
          h1: pxAt('h1', 'xs'),
          h2: pxAt('h2', 'xs'),
          h3: pxAt('h3', 'xs'),
          h4: pxAt('h4', 'xs'),
          h5: pxAt('h5', 'xs'),
          h6: pxAt('h6', 'xs')
        };
        const pairs: Array<[keyof typeof xs, keyof typeof xs]> = [
          ['h1', 'h2'],
          ['h2', 'h3'],
          ['h3', 'h4'],
          ['h4', 'h5'],
          ['h5', 'h6']
        ];
        for (const [a, b] of pairs) {
          if (xs[a] !== undefined && xs[b] !== undefined && (xs[a] as number) < (xs[b] as number)) {
            return { ok: false, reason: `Hierarchy violated at xs: ${String(a)} (${xs[a]}px) < ${String(b)} (${xs[b]}px).` };
          }
        }
      }

      // Validate chosen font is consistent with current theme fonts (or user prompt explicitly asks otherwise).
      const currentUiFamily = activeThemeData?.fonts?.families?.ui || '';
      const currentUiPrimary = normalizePrimaryFontName(currentUiFamily);
      const allowedPrimaryFonts = new Set<string>([
        currentUiPrimary,
        normalizePrimaryFontName(activeThemeData?.fonts?.families?.code || ''),
        ...((activeThemeData?.fonts?.google || [])
          .map((g: string) => normalizePrimaryFontName(g.split(':')[0]))
          .filter(Boolean))
      ].filter(Boolean));

      const primaryFromPatch = normalizePrimaryFontName(getStringField(detailsPatch[selectedTag], 'fontFamily') || '');
      if (primaryFromPatch && allowedPrimaryFonts.size > 0 && !allowedPrimaryFonts.has(primaryFromPatch)) {
        // Allow changing fonts if the user explicitly asked for it.
        const userAskedForNewFont = /font|typeface|inter|roboto|serif|sans|mono/i.test(aiPrompt || '');
        if (!userAskedForNewFont) {
          return { ok: false, reason: `fontFamily '${primaryFromPatch}' is not in current theme fonts. Ask explicitly to change fonts if desired.` };
        }
      }

      return { ok: true };
    };

    const availableFonts = [
      // Sans Serif
      "Inter", "Roboto", "Poppins", "Open Sans", "Montserrat", "Lato", "Raleway", "Noto Sans", "Oswald", "Quicksand",
      // Serif
      "Merriweather", "Playfair Display", "Lora", "PT Serif", "Roboto Slab", "Cinzel", "Cormorant Garamond",
      // Monospace
      "Roboto Mono", "Source Code Pro", "JetBrains Mono", "Fira Code", "Space Mono",
      // Display / Handwriting / Creative
      "Dancing Script", "Pacifico", "Lobster", "Abril Fatface", "Righteous", "Fredoka One", "Press Start 2P", "Creepster", "Rye", "Spirax", "Bangers", "Permanent Marker"
    ].join(", ");

    const themeName = customThemeName || 'Custom Theme';
    const currentFonts = activeThemeData?.fonts || {};
    const currentTypographyDetails = activeThemeData?.typography_details || {};
    const userInstruction = aiPrompt.trim()
      ? aiPrompt.trim()
      : `Improve typography for theme "${themeName}".`;

    const prompt = `TYPOGRAPHY_PATCH MODE

    THEME NAME: ${themeName}

    USER INSTRUCTION:
    ${userInstruction}

    CURRENT THEME FONTS (use these unless user explicitly requests a different font):
    ${JSON.stringify(currentFonts, null, 2)}

    CURRENT typography_details (baseline to improve; preserve intent and only adjust what's needed):
    ${JSON.stringify(currentTypographyDetails, null, 2)}
    
    SYSTEM CONTEXT & RULES:
    1. You MUST return ONLY JSON (no markdown).
    2. Return a JSON object with this shape:
       {
         "typography_details": {
           "h1": { ... }, ...
         }
       }
    3. For every tag you modify, include ALL of these fields: fontSize, fontFamily, fontWeight, letterSpacing, lineHeight, textTransform, textDecoration, fontStyle, marginBlockStart, marginBlockEnd.
    4. fontSize MUST be responsive and include at least xs(...) and md(...). Prefer including sm/lg/xl too.
    5. lineHeight MUST be responsive and include at least xs(...) and md(...).
    6. Keep hierarchy sane (h1 >= h2 >= ... >= h6) and never shrink h1 unless explicitly asked.
    7. Available Fonts: ${availableFonts}.
    
    CRITICAL INSTRUCTION:
    You are an expert typographer. Based on the USER INSTRUCTION (e.g., "crazy", "elegant", "brutal", "minimal"), you MUST:
    - Choose the most appropriate font from the Available Fonts list.
    - Adjust 'fontWeight' (100-900).
    - Adjust 'letterSpacing' (e.g., -0.05em for tight display, 0.2em for elegant caps).
    - Adjust 'textTransform' (uppercase, lowercase, none).
    - Adjust 'fontStyle' (italic, normal).
    - Adjust 'textDecoration' (underline, line-through, none).
    - Adjust 'lineHeight'. CRITICAL: Ensure line height is sufficient to prevent clipping. Script/Display fonts (like Pacifico, Lobster) often need larger line heights (1.3-1.5) even for headings to accommodate ascenders/descenders. Standard fonts can be tighter (1.1-1.2).
    
    If the user asks for a "crazy" font, pick something like Creepster, Rye, or Bangers.
    If the user asks for "elegant", pick Playfair Display, Cinzel, or Cormorant Garamond.
    
    TASK:
    ${mode === 'single' 
      ? `Optimize ONLY the '${selectedTag}' element. Return typography_details with ONLY '${selectedTag}'.`
      : 'Optimize ALL typography elements (h1-h6, p, body, caption). Return the full typography_details object.'}

    Return ONLY valid JSON.`;

    console.log("Sending Prompt to API:", prompt);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'typography_patch' })
      });

      const data = await res.json();
      console.log("API Response:", data);

      if (data.error) {
        console.error("API Error:", data.error);
        alert("AI Optimization failed: " + data.error);
        return;
      }

      if (data.text) {
        try {
          const generatedTheme = JSON.parse(data.text);
          const newTheme = JSON.parse(JSON.stringify(activeThemeData));
          
          if (!newTheme.typography_details) newTheme.typography_details = {};

          const detailsPatch = generatedTheme?.typography_details || generatedTheme;
          const validation = validateTypographyDetailsPatch(detailsPatch, mode);
          if (!validation.ok) {
            alert(`AI output rejected: ${validation.reason}`);
            return;
          }

          if (mode === 'all') {
            // Apply all typography from response
            Object.assign(newTheme.typography_details, detailsPatch);
          } else {
            // Apply only selected tag
            if (!detailsPatch[selectedTag]) {
              alert(`AI output rejected: missing '${selectedTag}' in typography_details.`);
              return;
            }
            if (!newTheme.typography_details[selectedTag]) newTheme.typography_details[selectedTag] = {};
            Object.assign(newTheme.typography_details[selectedTag], detailsPatch[selectedTag]);
          }
          
          setCustomTheme(customThemeName || 'Custom Theme', newTheme);
        } catch (parseError) {
          console.error("Failed to parse AI response:", parseError);
          alert("Failed to apply AI changes.");
        }
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Network error during AI optimization.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const aiToolbar = (
    <div className="ai-prompt-group">
      <div className="input-wrapper">
        <button
          className="ai-icon-btn"
          type="button"
          title="AI Assistant"
          onClick={() => aiInputRef.current?.focus()}
        >
          <Sparkles size={14} />
        </button>
        <input
          type="text"
          ref={aiInputRef}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Describe typography style..."
        />
      </div>

      {isOptimizing ? (
        <div className="loading">
          <Loader2 className="animate-spin" size={16} />
        </div>
      ) : (
        <div className="actions">
          <button
            onClick={() => handleOptimize('single')}
            title={`AI Fix ${selectedTag.toUpperCase()}`}
            className="fix-single"
          >
            AI {selectedTag.toUpperCase()}
          </button>
          <button onClick={() => handleOptimize('all')} title="AI Fix All" className="fix-all">
            AI All
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <InteractiveDemoContainer
        title="Interactive Demo: Typography"
        action={action}
        toolbar={aiToolbar}
      >
        <div className="controls-section">
            <div className="controls-row-bottom">
              <div className="controls-group">
                {BPS.map((bp) => {
                  const isDefault = bp.label === 'Default';
                  const isActive = isDefault ? isAutoMode : (!isAutoMode && previewWidth === bp.width);
                  
                  return (
                    <button
                      key={bp.label}
                      onClick={() => {
                        if (isDefault) {
                          setIsAutoMode(true);
                          setPreviewWidth(100);
                        } else {
                          setIsAutoMode(false);
                          setPreviewWidth(bp.width);
                        }
                      }}
                      title={isDefault ? "Current Screen Size" : `${bp.label} View`}
                      className={`control-button ${isActive ? 'active' : ''} ${isDefault ? 'is-default' : ''}`}
                    >
                      {isDefault ? <Monitor size={14} /> : bp.label}
                    </button>
                  );
                })}
              </div>

              <div className="element-select-group">
                <label htmlFor="tag-select">Element:</label>
                <select 
                  id="tag-select"
                  value={selectedTag}
                  onChange={(e) => {
                    setSelectedTag(e.target.value);
                    if (editingTag) setEditingTag(null);
                  }}
                >
                  {TAGS.map(tag => <option key={tag} value={tag}>{tag.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="element-select-group">
                <label htmlFor="sample-text-select">Text:</label>
                <select
                  id="sample-text-select"
                  value={currentSampleId}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'custom') return;
                    if (next === 'reset') {
                      updateText(selectedTag, getInitialTextForTag(selectedTag));
                      return;
                    }
                    const preset = SAMPLE_TEXT_PRESETS.find((p) => p.id === next);
                    if (preset) updateText(selectedTag, preset.text);
                  }}
                  title="Choose sample text"
                >
                  <option value="custom">Custom (editable)</option>
                  <option value="reset">Reset to default</option>
                  {SAMPLE_TEXT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
        </div>

        {/* Live Preview Section */}
        <div className="live-preview-section">
        
        <div 
          className="live-preview-box" 
          ref={previewBoxRef}
          style={{ 
            width: `${previewWidth}%`
          }}
        >
          {/* Architectural Guides */}
          <div className="architectural-guide-center" />
          
          {/* Text Container with Architectural Bounds */}
          <div className="text-container-wrapper">
            
            {/* Line Height Indicator (Left) */}
            <div className="line-height-indicator" />

            {/* Content Bounds (Dashed Box) */}
            <div className="content-bounds-indicator" />

            {React.createElement(
              selectedTag === 'body' || selectedTag === 'caption' || selectedTag === 'span' || selectedTag === 'small' || selectedTag === 'pre' || selectedTag === 'default' ? 'p' : selectedTag,
              { 
                className: `ds-typo ${selectedTag} editable-typography-element`,
                'data-typo': selectedTag,
                ref: editableRef,
                contentEditable: true,
                suppressContentEditableWarning: true,
                spellCheck: false,
                onInput: handleInput,
                style: !isAutoMode ? { 
                  fontSize: resolveResponsiveValue(fontSizeString, previewWidth)
                } : undefined 
              }
            )}
          </div>
        </div>
      </div>

      <div className="demo-layout-grid">
        <div className="demo-logic-column">


      <div className="json-preview-container">
        <div>{selectedTag}: {'{'}</div>
        
        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;fontSize&quot;</span>: <SyntaxHighlighter value={fontSizeString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />,
          </div>
          <button 
            onClick={() => setIsEditorOpen(true)}
            title="Edit Font Size"
            className="json-action-button"
          >
            <Edit2 size={16} />
          </button>
        </div>

        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;fontFamily&quot;</span>: {isFontFamilyInherited ? <span className="json-value-inherited">&quot;{fontFamilyString}&quot;</span> : <SyntaxHighlighter value={fontFamilyString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isFontFamilyInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isFontFamilyInherited && (
              <button
                onClick={() => handleRemoveProperty('fontFamily')}
                title="Reset to Default"
                className="json-action-button delete-button"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsFontFamilyEditorOpen(true)}
              title="Edit Font Family"
              className="json-action-button"
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;fontWeight&quot;</span>: {isFontWeightInherited ? <span className="json-value-inherited">&quot;{fontWeightString}&quot;</span> : <SyntaxHighlighter value={fontWeightString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isFontWeightInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isFontWeightInherited && (
              <button
                onClick={() => handleRemoveProperty('fontWeight')}
                title="Reset to Default"
                className="json-action-button delete-button"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsFontWeightEditorOpen(true)}
              title="Edit Font Weight"
              className="json-action-button"
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;lineHeight&quot;</span>: {isLineHeightInherited ? <span className="json-value-inherited">&quot;{lineHeightString}&quot;</span> : <SyntaxHighlighter value={lineHeightString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isLineHeightInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isLineHeightInherited && (
              <button
                onClick={() => handleRemoveProperty('lineHeight')}
                title="Reset to Default"
                className="json-action-button delete-button"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsLineHeightEditorOpen(true)}
              title="Edit Line Height"
              className="json-action-button"
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;letterSpacing&quot;</span>: {isLetterSpacingInherited ? <span className="json-value-inherited">&quot;{letterSpacingString}&quot;</span> : <SyntaxHighlighter value={letterSpacingString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isLetterSpacingInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isLetterSpacingInherited && (
              <button
                onClick={() => handleRemoveProperty('letterSpacing')}
                title="Reset to Default"
                className="json-action-button delete-button"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsLetterSpacingEditorOpen(true)}
              title="Edit Letter Spacing"
              className="json-action-button"
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        {/* Text Transform */}
        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;textTransform&quot;</span>: {isTextTransformInherited ? <span className="json-value-inherited">&quot;{textTransformString}&quot;</span> : <SyntaxHighlighter value={textTransformString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isTextTransformInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isTextTransformInherited && (
              <button onClick={() => handleRemoveProperty('textTransform')} title="Reset to Default" className="json-action-button delete-button"><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsTextTransformEditorOpen(true)} title="Edit Text Transform" className="json-action-button"><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Text Decoration */}
        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;textDecoration&quot;</span>: {isTextDecorationInherited ? <span className="json-value-inherited">&quot;{textDecorationString}&quot;</span> : <SyntaxHighlighter value={textDecorationString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isTextDecorationInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isTextDecorationInherited && (
              <button onClick={() => handleRemoveProperty('textDecoration')} title="Reset to Default" className="json-action-button delete-button"><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsTextDecorationEditorOpen(true)} title="Edit Text Decoration" className="json-action-button"><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Font Style */}
        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;fontStyle&quot;</span>: {isFontStyleInherited ? <span className="json-value-inherited">&quot;{fontStyleString}&quot;</span> : <SyntaxHighlighter value={fontStyleString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isFontStyleInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isFontStyleInherited && (
              <button onClick={() => handleRemoveProperty('fontStyle')} title="Reset to Default" className="json-action-button delete-button"><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsFontStyleEditorOpen(true)} title="Edit Font Style" className="json-action-button"><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Margin Block Start */}
        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;marginBlockStart&quot;</span>: {isMarginBlockStartInherited ? <span className="json-value-inherited">&quot;{marginBlockStartString}&quot;</span> : <SyntaxHighlighter value={marginBlockStartString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isMarginBlockStartInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isMarginBlockStartInherited && (
              <button onClick={() => handleRemoveProperty('marginBlockStart')} title="Reset to Default" className="json-action-button delete-button"><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsMarginBlockStartEditorOpen(true)} title="Edit Margin Block Start" className="json-action-button"><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Margin Block End */}
        <div className="json-property-row">
          <div>
            <span className="json-key">&quot;marginBlockEnd&quot;</span>: {isMarginBlockEndInherited ? <span className="json-value-inherited">&quot;{marginBlockEndString}&quot;</span> : <SyntaxHighlighter value={marginBlockEndString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isMarginBlockEndInherited && <span className="json-comment">{`// inherited`}</span>}
          </div>
          <div className="json-action-group">
            {!isDefault && !isMarginBlockEndInherited && (
              <button onClick={() => handleRemoveProperty('marginBlockEnd')} title="Reset to Default" className="json-action-button delete-button"><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsMarginBlockEndEditorOpen(true)} title="Edit Margin Block End" className="json-action-button"><Edit2 size={16} /></button>
          </div>
        </div>
        
        <div>{'}'}</div>
      </div>

      <div className="css-usage-container">
          <div className="css-usage-header">
            <span>
                CSS Usage
            </span>
          </div>
          <div className="css-code-block">
              <span className="selector">.any-class</span>
              <span className="bracket">{`{`}</span>
              <span className="mixin">@ds-typo</span>
              <span className="paren">(</span>
              <span className="argument">{selectedTag}</span>
              <span className="paren">)</span>
              <span className="semicolon">;</span>
              <span className="bracket">{`}`}</span>
          </div>
          <p className="css-usage-description">
              <strong>Theme Configuration:</strong> The settings below define your JSON theme. 
              Once configured in <code>uxdsl.theme.json</code>, the mixin above applies these responsive rules automatically.
          </p>
      </div>
        </div>
      </div>

      {/* Typography Showcase */}
      <div className="typography-showcase">
        <div className="showcase-title">Typography Showcase</div>
        <div className="showcase-grid">
          {TAGS.filter(tag => tag !== 'default').map(tag => (
            <div key={tag} className="showcase-item">
              <span className="showcase-tag">{tag}</span>
              {React.createElement(
                tag === 'body' || tag === 'caption' ? 'p' : tag,
                { 
                  className: `showcase-text sample-${tag}`
                },
                textMap[tag] || initialTypographyItems.find(i => i.tag === tag)?.text
              )}
            </div>
          ))}
        </div>
      </div>
      </InteractiveDemoContainer>

      <BreakpointEditor 
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialValue={fontSizeString}
        onSave={handleSave}
        tagName={selectedTag}
        editorType="numeric"
      />

      <BreakpointEditor 
        isOpen={isFontFamilyEditorOpen}
        onClose={() => setIsFontFamilyEditorOpen(false)}
        initialValue={fontFamilyString}
        onSave={handleSaveFontFamily}
        tagName={selectedTag}
        editorType="font"
      />

      <BreakpointEditor 
        isOpen={isFontWeightEditorOpen}
        onClose={() => setIsFontWeightEditorOpen(false)}
        initialValue={fontWeightString}
        onSave={(val) => handleSaveProperty('fontWeight', val)}
        tagName={selectedTag}
        editorType="text"
      />

      <BreakpointEditor 
        isOpen={isLineHeightEditorOpen}
        onClose={() => setIsLineHeightEditorOpen(false)}
        initialValue={lineHeightString}
        onSave={(val) => handleSaveProperty('lineHeight', val)}
        tagName={selectedTag}
        editorType="text"
      />

      <BreakpointEditor 
        isOpen={isLetterSpacingEditorOpen}
        onClose={() => setIsLetterSpacingEditorOpen(false)}
        initialValue={letterSpacingString}
        onSave={(val) => handleSaveProperty('letterSpacing', val)}
        tagName={selectedTag}
        editorType="text"
      />

      <BreakpointEditor 
        isOpen={isTextTransformEditorOpen}
        onClose={() => setIsTextTransformEditorOpen(false)}
        initialValue={textTransformString}
        onSave={(val) => handleSaveProperty('textTransform', val)}
        tagName={selectedTag}
        editorType="select"
        options={['none', 'capitalize', 'uppercase', 'lowercase']}
      />

      <BreakpointEditor 
        isOpen={isTextDecorationEditorOpen}
        onClose={() => setIsTextDecorationEditorOpen(false)}
        initialValue={textDecorationString}
        onSave={(val) => handleSaveProperty('textDecoration', val)}
        tagName={selectedTag}
        editorType="select"
        options={['none', 'underline', 'line-through', 'overline']}
      />

      <BreakpointEditor 
        isOpen={isFontStyleEditorOpen}
        onClose={() => setIsFontStyleEditorOpen(false)}
        initialValue={fontStyleString}
        onSave={(val) => handleSaveProperty('fontStyle', val)}
        tagName={selectedTag}
        editorType="select"
        options={['normal', 'italic', 'oblique']}
      />

      <BreakpointEditor 
        isOpen={isMarginBlockStartEditorOpen}
        onClose={() => setIsMarginBlockStartEditorOpen(false)}
        initialValue={marginBlockStartString}
        onSave={(val) => handleSaveProperty('marginBlockStart', val)}
        tagName={selectedTag}
        editorType="numeric"
      />

      <BreakpointEditor 
        isOpen={isMarginBlockEndEditorOpen}
        onClose={() => setIsMarginBlockEndEditorOpen(false)}
        initialValue={marginBlockEndString}
        onSave={(val) => handleSaveProperty('marginBlockEnd', val)}
        tagName={selectedTag}
        editorType="numeric"
      />
    </div>
  );
}