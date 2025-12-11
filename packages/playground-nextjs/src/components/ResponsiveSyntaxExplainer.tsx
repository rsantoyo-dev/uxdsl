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
  const [selectedTag, setSelectedTag] = useState('default');
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
    newTheme.typography_details[selectedTag].fontFamily = newValue;

    // Add to Google Fonts list logic...
    const systemFonts = ["System UI", "Monospace", "Serif", "Sans-Serif", "Arial", "Helvetica", "Times New Roman", "Courier New"];
    const singleWeightFonts = ["Pacifico", "Creepster", "Rye", "Spirax", "Lobster", "Abril Fatface", "Fredoka One"];
    const primaryFont = newValue.split(',')[0].replace(/['"]/g, '').trim();
    
    if (!systemFonts.includes(primaryFont) && primaryFont) {
      if (!newTheme.fonts) newTheme.fonts = {};
      if (!newTheme.fonts.google) newTheme.fonts.google = [];
      const exists = newTheme.fonts.google.some((f: string) => f.startsWith(primaryFont));
      if (!exists) {
        const weights = singleWeightFonts.includes(primaryFont) ? '400' : '400;500;600;700';
        newTheme.fonts.google.push(`${primaryFont}:wght@${weights}`);
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

    const userInstruction = aiPrompt.trim() 
      ? `USER INSTRUCTION: ${aiPrompt}` 
      : `Generate a UXDSL theme named "${customThemeName || 'Modern'}". The style should be "${customThemeName || 'Modern Professional'}".`;

    const prompt = `${userInstruction}
    
    SYSTEM CONTEXT & RULES:
    1. The system uses a specific JSON structure. Here is the GOLD STANDARD example of how the output should look:
    {
      "typography": {
        "font-code": "\\"JetBrains Mono\\", \\"SF Mono\\", Menlo, monospace"
      },
      "typography_details": {
        "h1": { "fontSize": "xs(32px) sm(36px) md(44px) lg(52px) xl(60px)", "fontWeight": "700", "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontFamily": "Inter", "textTransform": "none" },
        "h2": { "fontSize": "xs(28px) sm(30px) md(36px) lg(44px) xl(52px)", "fontWeight": "700", "lineHeight": "1.2", "letterSpacing": "-0.01em", "fontFamily": "Inter" },
        "h3": { "fontSize": "xs(24px) sm(26px) md(30px) lg(34px) xl(38px)", "fontWeight": "600", "lineHeight": "1.3", "letterSpacing": "normal" },
        "p": { "fontSize": "xs(15px) md(16px)", "fontWeight": "400", "lineHeight": "1.6", "letterSpacing": "normal" }
      }
    }

    2. "fontSize" MUST use the responsive syntax 'xs(val) sm(val) md(val) lg(val) xl(val)'.
    3. "lineHeight" can also be responsive (e.g., 'xs(1.4) md(1.2)') or static. Tighter line heights for headings (1.1-1.3), looser for body (1.5-1.6).
    4. Available Fonts: ${availableFonts}. 
    
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
      ? `Optimize ONLY the '${selectedTag}' element. Consider the context of the other tags but only return the update for '${selectedTag}'.` 
      : 'Optimize ALL typography elements (h1-h6, p, body, caption). Return the full typography_details object.'}

    CURRENT CONTEXT (Use as baseline):
    ${JSON.stringify(activeThemeData?.typography_details || {}, null, 2)}

    Return ONLY valid JSON.`;

    console.log("Sending Prompt to API:", prompt);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
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

          if (mode === 'all') {
            // Apply all typography from response
            if (generatedTheme.typography_details) {
              Object.assign(newTheme.typography_details, generatedTheme.typography_details);
            }
          } else {
            // Apply only selected tag
            if (generatedTheme.typography_details && generatedTheme.typography_details[selectedTag]) {
              if (!newTheme.typography_details[selectedTag]) newTheme.typography_details[selectedTag] = {};
              Object.assign(newTheme.typography_details[selectedTag], generatedTheme.typography_details[selectedTag]);
            }
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

  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <InteractiveDemoContainer
        title="Interactive Demo: Typography"
        action={action}
        toolbar={
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, marginRight: '1rem' }}>
               <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                 <Sparkles size={14} style={{ position: 'absolute', left: '8px', color: 'var(--ds__palette__text-secondary)', opacity: 0.5 }} />
                 <input 
                   type="text" 
                   value={aiPrompt}
                   onChange={(e) => setAiPrompt(e.target.value)}
                   placeholder="Describe typography style..."
                   style={{
                     width: '100%',
                     padding: '4px 8px 4px 28px',
                     borderRadius: '6px',
                     border: '1px solid var(--ds__palette__neutral-main)',
                     background: 'var(--ds__palette__surface-main)',
                     fontSize: '0.8rem',
                     color: 'var(--ds__palette__text-primary)'
                   }}
                 />
               </div>

               {isOptimizing ? (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ds__palette__primary-main)', fontSize: '0.8rem' }}>
                   <Loader2 className="animate-spin" size={16} />
                 </div>
               ) : (
                 <div style={{ display: 'flex', gap: '0.25rem' }}>
                   <button
                     onClick={() => handleOptimize('single')}
                     title={`AI Fix ${selectedTag.toUpperCase()}`}
                     style={{
                       background: 'var(--ds__palette__primary-main)',
                       color: 'var(--ds__palette__primary-contrast)',
                       border: 'none',
                       borderRadius: '6px',
                       padding: '4px 8px',
                       cursor: 'pointer',
                       fontSize: '0.75rem',
                       fontWeight: 600,
                       whiteSpace: 'nowrap'
                     }}
                   >
                     Fix {selectedTag.toUpperCase()}
                   </button>
                   <button
                     onClick={() => handleOptimize('all')}
                     title="AI Fix All"
                     style={{
                       background: 'transparent',
                       color: 'var(--ds__palette__primary-main)',
                       border: '1px solid var(--ds__palette__primary-main)',
                       borderRadius: '6px',
                       padding: '4px 8px',
                       cursor: 'pointer',
                       fontSize: '0.75rem',
                       fontWeight: 600,
                       whiteSpace: 'nowrap'
                     }}
                   >
                     Fix All
                   </button>
                 </div>
               )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--ds__palette__surface-main)', padding: '2px', borderRadius: '6px', border: '1px solid var(--ds__palette__neutral-main)' }}>
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
                    style={{
                      padding: isDefault ? '4px 8px' : '4px 12px',
                      background: isActive ? 'var(--ds__palette__primary-light)' : 'transparent',
                      color: isActive ? 'var(--ds__palette__primary-contrast)' : 'var(--ds__palette__text-secondary)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isDefault ? <Monitor size={14} /> : bp.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="tag-select" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Element:</label>
              <select 
                id="tag-select"
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  if (editingTag) setEditingTag(null);
                }}
                style={{ 
                  padding: '0.25rem 0.5rem',  
                  borderRadius: '4px', 
                  border: '1px solid var(--ds__palette__neutral-main)',
                  background: 'var(--ds__palette__surface-main)',
                  color: 'var(--ds__palette__surface-contrast)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {TAGS.map(tag => <option key={tag} value={tag}>{tag.toUpperCase()}</option>)}
              </select>
            </div>
          </>
        }
      >
      <div className="demo-layout-grid">
        <div className="demo-logic-column">
          {/* Live Preview Section */}
          <div style={{ 
            marginBottom: '1.5rem', 
            paddingBottom: '1.5rem', 
            borderBottom: '1px solid var(--ds__palette__neutral-light)',
            display: 'flex',
            justifyContent: 'center',
            background: 'var(--ds__palette__surface-dark)', // Darker background to simulate "void"
            borderRadius: '8px',
            padding: '2rem 1rem',
            overflow: 'hidden'
          }}>
        
        <div 
          className="live-preview-box" 
          ref={previewBoxRef}
          style={{ 
            width: `${previewWidth}%`, 
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
            margin: '0 auto',
            background: 'transparent',
            borderLeft: '1px solid var(--ds__palette__divider)',
            borderRight: '1px solid var(--ds__palette__divider)',
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: 0
          }}
        >
          {/* Architectural Guides */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'var(--ds__palette__divider)', opacity: 0.1, pointerEvents: 'none' }} />
          
          {/* Text Container with Architectural Bounds */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
            
            {/* Line Height Indicator (Left) */}
            <div style={{ 
              position: 'absolute', 
              left: '-8px', 
              top: 0, 
              bottom: 0, 
              width: '4px', 
              borderLeft: '1px solid var(--ds__palette__primary-main)',
              borderTop: '1px solid var(--ds__palette__primary-main)',
              borderBottom: '1px solid var(--ds__palette__primary-main)',
              opacity: 0.3,
              pointerEvents: 'none'
            }} />

            {/* Content Bounds (Dashed Box) */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              border: '1px dashed var(--ds__palette__primary-light)',
              opacity: 0.15,
              pointerEvents: 'none'
            }} />

            {React.createElement(
              selectedTag === 'body' || selectedTag === 'caption' || selectedTag === 'span' || selectedTag === 'small' || selectedTag === 'pre' || selectedTag === 'default' ? 'p' : selectedTag,
              { 
                className: `ds-typo ${selectedTag}`,
                'data-typo': selectedTag,
                ref: editableRef,
                contentEditable: true,
                suppressContentEditableWarning: true,
                spellCheck: false,
                onInput: handleInput,
                style: { 
                  margin: 0, 
                  transition: 'all 0.2s ease', 
                  outline: 'none', 
                  minWidth: '10px',
                  cursor: 'text',
                  textAlign: 'center',
                  width: '100%',
                  position: 'relative',
                  zIndex: 2,
                  fontSize: isAutoMode ? `var(--${selectedTag}-size)` : resolveResponsiveValue(fontSizeString, previewWidth),
                  fontFamily: `var(--${selectedTag}-font-family)`,
                  fontWeight: `var(--${selectedTag}-weight)`,
                  lineHeight: `var(--${selectedTag}-line)`,
                  letterSpacing: `var(--${selectedTag}-spacing)`,
                  textTransform: `var(--${selectedTag}-transform)` as React.CSSProperties['textTransform'],
                  textDecoration: `var(--${selectedTag}-decoration)`,
                  fontStyle: `var(--${selectedTag}-style)`,
                  marginBlockStart: `var(--${selectedTag}-margin-block-start)`,
                  marginBlockEnd: `var(--${selectedTag}-margin-block-end)`
                } 
              }
            )}
          </div>
        </div>
      </div>

      <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          background: 'var(--ds__palette__surface-light)',
          border: '1px solid var(--ds__palette__neutral-light)',
          borderRadius: '6px'
      }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ 
                fontSize: '0.8rem', 
                color: 'var(--ds__palette__text-secondary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                CSS Usage
            </span>
          </div>
          <div style={{
              background: 'var(--ds__palette__surface-dark)',
              padding: '0.75rem',
              borderRadius: '6px',
              fontFamily: 'var(--font-code)',
              fontSize: '0.85rem',
              color: 'var(--ds__palette__text-primary)',
              display: 'flex',
              alignItems: 'center',
              overflowX: 'auto',
              border: '1px solid var(--ds__palette__neutral-dark)'
          }}>
              <span style={{ color: 'var(--ds__palette__secondary-light)' }}>.any-class</span>
              <span style={{ marginLeft: '0.5rem', color: 'var(--ds__palette__text-disabled)' }}>{`{`}</span>
              <span style={{ marginLeft: '0.5rem', color: 'var(--ds__palette__primary-light)' }}>@ds-typo</span>
              <span style={{ color: 'var(--ds__palette__text-primary)' }}>(</span>
              <span style={{ color: 'var(--ds__palette__warning-light)' }}>{selectedTag}</span>
              <span style={{ color: 'var(--ds__palette__text-primary)' }}>)</span>
              <span style={{ color: 'var(--ds__palette__text-disabled)' }}>;</span>
              <span style={{ marginLeft: '0.5rem', color: 'var(--ds__palette__text-disabled)' }}>{`}`}</span>
          </div>
          <p style={{ 
              marginTop: '0.75rem', 
              fontSize: '0.8rem', 
              color: 'var(--ds__palette__text-secondary)',
              lineHeight: 1.5
          }}>
              <strong style={{ color: 'var(--ds__palette__text-primary)' }}>Theme Configuration:</strong> The settings below define your JSON theme. 
              Once configured in <code>uxdsl.theme.json</code>, the mixin above applies these responsive rules automatically.
          </p>
      </div>

      <div style={{
        background: 'var(--ds__palette__surface-main)',
        padding: '1rem',
        borderRadius: '6px',
        marginBottom: '1.5rem',
        border: '1px dashed var(--ds__palette__neutral-main)',
        fontFamily: 'var(--font-code)',
        fontSize: '0.9rem',
        color: 'var(--ds__palette__primary-dark)',
        overflowX: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem'
      }}>
        <div>{selectedTag}: {'{'}</div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontSize&quot;</span>: <SyntaxHighlighter value={fontSizeString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />,
          </div>
          <button 
            onClick={() => setIsEditorOpen(true)}
            title="Edit Font Size"
            style={{
              background: 'transparent',
              border: '1px solid var(--ds__palette__divider)',
              borderRadius: '4px',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--ds__palette__text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ds__palette__primary-main)';
              e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ds__palette__text-secondary)';
              e.currentTarget.style.borderColor = 'var(--ds__palette__divider)';
            }}
          >
            <Edit2 size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontFamily&quot;</span>: {isFontFamilyInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{fontFamilyString}&quot;</span> : <SyntaxHighlighter value={fontFamilyString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isFontFamilyInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isFontFamilyInherited && (
              <button
                onClick={() => handleRemoveProperty('fontFamily')}
                title="Reset to Default"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--ds__palette__text-disabled)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsFontFamilyEditorOpen(true)}
              title="Edit Font Family"
              style={{
                background: 'transparent',
                border: '1px solid var(--ds__palette__divider)',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--ds__palette__text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__primary-main)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__text-secondary)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__divider)';
              }}
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontWeight&quot;</span>: {isFontWeightInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{fontWeightString}&quot;</span> : <SyntaxHighlighter value={fontWeightString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isFontWeightInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isFontWeightInherited && (
              <button
                onClick={() => handleRemoveProperty('fontWeight')}
                title="Reset to Default"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--ds__palette__text-disabled)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsFontWeightEditorOpen(true)}
              title="Edit Font Weight"
              style={{
                background: 'transparent',
                border: '1px solid var(--ds__palette__divider)',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--ds__palette__text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__primary-main)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__text-secondary)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__divider)';
              }}
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;lineHeight&quot;</span>: {isLineHeightInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{lineHeightString}&quot;</span> : <SyntaxHighlighter value={lineHeightString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isLineHeightInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isLineHeightInherited && (
              <button
                onClick={() => handleRemoveProperty('lineHeight')}
                title="Reset to Default"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--ds__palette__text-disabled)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsLineHeightEditorOpen(true)}
              title="Edit Line Height"
              style={{
                background: 'transparent',
                border: '1px solid var(--ds__palette__divider)',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--ds__palette__text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__primary-main)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__text-secondary)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__divider)';
              }}
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;letterSpacing&quot;</span>: {isLetterSpacingInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{letterSpacingString}&quot;</span> : <SyntaxHighlighter value={letterSpacingString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isLetterSpacingInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isLetterSpacingInherited && (
              <button
                onClick={() => handleRemoveProperty('letterSpacing')}
                title="Reset to Default"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--ds__palette__text-disabled)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              onClick={() => setIsLetterSpacingEditorOpen(true)}
              title="Edit Letter Spacing"
              style={{
                background: 'transparent',
                border: '1px solid var(--ds__palette__divider)',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--ds__palette__text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__primary-main)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ds__palette__text-secondary)';
                e.currentTarget.style.borderColor = 'var(--ds__palette__divider)';
              }}
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        {/* Text Transform */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;textTransform&quot;</span>: {isTextTransformInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{textTransformString}&quot;</span> : <SyntaxHighlighter value={textTransformString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isTextTransformInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isTextTransformInherited && (
              <button onClick={() => handleRemoveProperty('textTransform')} title="Reset to Default" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsTextTransformEditorOpen(true)} title="Edit Text Transform" style={{ background: 'transparent', border: '1px solid var(--ds__palette__divider)', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ds__palette__primary-main)'; e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ds__palette__text-secondary)'; e.currentTarget.style.borderColor = 'var(--ds__palette__divider)'; }}><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Text Decoration */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;textDecoration&quot;</span>: {isTextDecorationInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{textDecorationString}&quot;</span> : <SyntaxHighlighter value={textDecorationString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isTextDecorationInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isTextDecorationInherited && (
              <button onClick={() => handleRemoveProperty('textDecoration')} title="Reset to Default" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsTextDecorationEditorOpen(true)} title="Edit Text Decoration" style={{ background: 'transparent', border: '1px solid var(--ds__palette__divider)', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ds__palette__primary-main)'; e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ds__palette__text-secondary)'; e.currentTarget.style.borderColor = 'var(--ds__palette__divider)'; }}><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Font Style */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontStyle&quot;</span>: {isFontStyleInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{fontStyleString}&quot;</span> : <SyntaxHighlighter value={fontStyleString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isFontStyleInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isFontStyleInherited && (
              <button onClick={() => handleRemoveProperty('fontStyle')} title="Reset to Default" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsFontStyleEditorOpen(true)} title="Edit Font Style" style={{ background: 'transparent', border: '1px solid var(--ds__palette__divider)', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ds__palette__primary-main)'; e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ds__palette__text-secondary)'; e.currentTarget.style.borderColor = 'var(--ds__palette__divider)'; }}><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Margin Block Start */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;marginBlockStart&quot;</span>: {isMarginBlockStartInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{marginBlockStartString}&quot;</span> : <SyntaxHighlighter value={marginBlockStartString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isMarginBlockStartInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isMarginBlockStartInherited && (
              <button onClick={() => handleRemoveProperty('marginBlockStart')} title="Reset to Default" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsMarginBlockStartEditorOpen(true)} title="Edit Margin Block Start" style={{ background: 'transparent', border: '1px solid var(--ds__palette__divider)', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ds__palette__primary-main)'; e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ds__palette__text-secondary)'; e.currentTarget.style.borderColor = 'var(--ds__palette__divider)'; }}><Edit2 size={16} /></button>
          </div>
        </div>

        {/* Margin Block End */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '2ch' }}>
          <div>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;marginBlockEnd&quot;</span>: {isMarginBlockEndInherited ? <span style={{ color: 'var(--ds__palette__text-disabled)' }}>&quot;{marginBlockEndString}&quot;</span> : <SyntaxHighlighter value={marginBlockEndString} widthPercent={previewWidth} isAutoMode={isAutoMode} windowWidth={windowWidth} themeBreakpoints={activeThemeData?.breakpoints} />}
            {isMarginBlockEndInherited && <span style={{ fontSize: '0.75rem', color: 'var(--ds__palette__text-disabled)', marginLeft: '0.5rem' }}>{`// inherited`}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {!isDefault && !isMarginBlockEndInherited && (
              <button onClick={() => handleRemoveProperty('marginBlockEnd')} title="Reset to Default" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ds__palette__error-main)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ds__palette__text-disabled)'}><Trash2 size={14} /></button>
            )}
            <button onClick={() => setIsMarginBlockEndEditorOpen(true)} title="Edit Margin Block End" style={{ background: 'transparent', border: '1px solid var(--ds__palette__divider)', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: 'var(--ds__palette__text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ds__palette__primary-main)'; e.currentTarget.style.borderColor = 'var(--ds__palette__primary-main)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ds__palette__text-secondary)'; e.currentTarget.style.borderColor = 'var(--ds__palette__divider)'; }}><Edit2 size={16} /></button>
          </div>
        </div>
        
        <div>{'}'}</div>
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
                  className: `showcase-text sample-${tag}`,
                  style: {
                    fontSize: `var(--${tag}-size)`,
                    fontFamily: `var(--${tag}-font-family)`,
                    fontWeight: `var(--${tag}-weight)`,
                    lineHeight: `var(--${tag}-line)`,
                    letterSpacing: `var(--${tag}-spacing)`,
                    textTransform: `var(--${tag}-transform)` as React.CSSProperties['textTransform'],
                    textDecoration: `var(--${tag}-decoration)`,
                    fontStyle: `var(--${tag}-style)`,
                    marginBlockStart: `var(--${tag}-margin-block-start)`,
                    marginBlockEnd: `var(--${tag}-margin-block-end)`
                  }
                },
                textMap[tag] || initialTypographyItems.find(i => i.tag === tag)?.text
              )}
            </div>
          ))}
        </div>
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
        editorType="text"
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