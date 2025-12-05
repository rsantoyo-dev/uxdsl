'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { useTypographyDemo } from './TypographyDemoContext';
import { Edit2, Trash2, Monitor } from 'lucide-react';
import { BreakpointEditor } from './BreakpointEditor';
import { InteractiveDemoContainer } from './InteractiveDemoContainer';

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

export function ResponsiveSyntaxExplainer() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme();
  const { textMap, updateText, editingTag, setEditingTag } = useTypographyDemo();
  const [selectedTag, setSelectedTag] = useState('default');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFontFamilyEditorOpen, setIsFontFamilyEditorOpen] = useState(false);
  const [isFontWeightEditorOpen, setIsFontWeightEditorOpen] = useState(false);
  const [isLineHeightEditorOpen, setIsLineHeightEditorOpen] = useState(false);
  const [isLetterSpacingEditorOpen, setIsLetterSpacingEditorOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(100); // Percentage
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [windowWidth, setWindowWidth] = useState(0);
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

  // Check inheritance status
  const isFontFamilyInherited = !isDefault && !tagDetails.fontFamily;
  const isFontWeightInherited = !isDefault && !tagDetails.fontWeight;
  const isLineHeightInherited = !isDefault && !tagDetails.lineHeight;
  const isLetterSpacingInherited = !isDefault && !tagDetails.letterSpacing;

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
    const primaryFont = newValue.split(',')[0].replace(/['"]/g, '').trim();
    
    if (!systemFonts.includes(primaryFont) && primaryFont) {
      if (!newTheme.fonts) newTheme.fonts = {};
      if (!newTheme.fonts.google) newTheme.fonts.google = [];
      const exists = newTheme.fonts.google.some((f: string) => f.startsWith(primaryFont));
      if (!exists) {
        newTheme.fonts.google.push(`${primaryFont}:wght@400;500;600;700`);
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

  return (
    <div ref={containerRef}>
      <InteractiveDemoContainer
        title="Interactive Demo"
        toolbar={
          <>
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
            background: 'var(--ds__palette__surface-main)',
            border: '1px dashed var(--ds__palette__neutral-dark)', // Simple dotted border
            borderRadius: '4px',
            padding: '1rem',
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
          }}
        >
          <div className="top-right-corner" />
          <div className="bottom-left-corner" />
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
                textAlign: 'center', // Center text as requested
                width: '100%',
                // Explicitly bind to CSS variables to ensure 'default' tag works and updates live
                // If in Auto Mode (Default), use the CSS variable so it responds to the viewport media queries
                // If in Manual Mode (XS-XL), use the simulated value based on the preview container width
                fontSize: isAutoMode ? `var(--${selectedTag}-size)` : resolveResponsiveValue(fontSizeString, previewWidth),
                fontFamily: `var(--${selectedTag}-font-family)`,
                fontWeight: `var(--${selectedTag}-weight)`,
                lineHeight: `var(--${selectedTag}-line)`,
                letterSpacing: `var(--${selectedTag}-spacing)`
              } 
            }
          )}
        </div>
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
        
        <div>{'}'}</div>
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
    </div>
  );
}