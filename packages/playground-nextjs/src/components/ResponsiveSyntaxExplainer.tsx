'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { useTypographyDemo } from './TypographyDemoContext';
import { Edit2, Trash2 } from 'lucide-react';
import { BreakpointEditor } from './BreakpointEditor';

const TAGS = ['default', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'body', 'caption'];

export function ResponsiveSyntaxExplainer() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme();
  const { textMap, updateText, editingTag, setEditingTag } = useTypographyDemo();
  const [selectedTag, setSelectedTag] = useState('default');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFontFamilyEditorOpen, setIsFontFamilyEditorOpen] = useState(false);
  const [isFontWeightEditorOpen, setIsFontWeightEditorOpen] = useState(false);
  const [isLineHeightEditorOpen, setIsLineHeightEditorOpen] = useState(false);
  const [isLetterSpacingEditorOpen, setIsLetterSpacingEditorOpen] = useState(false);
  const editableRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div 
      ref={containerRef}
      style={{
      background: 'var(--ds__palette__surface-light)',
      padding: '1.5rem',
      borderRadius: '8px',
      border: '1px solid var(--ds__palette__neutral-light)',
      marginBottom: '3rem'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <div style={{ 
          fontSize: '0.75rem', 
          fontWeight: 700, 
          letterSpacing: '0.05em', 
          color: 'var(--ds__palette__text-secondary)',
          textTransform: 'uppercase'
        }}>
          Interactive Demo
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
      </div>

      {/* Live Preview Section */}
      <div style={{ 
        marginBottom: '1.5rem', 
        paddingBottom: '1.5rem', 
        borderBottom: '1px solid var(--ds__palette__neutral-light)' 
      }}>
        
        <div className="live-preview-box">
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
                border: '1px dashed rgba(0,0,0,0.1)',
                // Explicitly bind to CSS variables to ensure 'default' tag works and updates live
                fontSize: `var(--${selectedTag}-size)`,
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
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontSize&quot;</span>: <span style={{ color: 'var(--ds__palette__info-main)' }}>&quot;{fontSizeString}&quot;</span>,
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
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontFamily&quot;</span>: <span style={{ color: isFontFamilyInherited ? 'var(--ds__palette__text-disabled)' : 'var(--ds__palette__info-main)' }}>&quot;{fontFamilyString}&quot;</span>
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
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontWeight&quot;</span>: <span style={{ color: isFontWeightInherited ? 'var(--ds__palette__text-disabled)' : 'var(--ds__palette__info-main)' }}>&quot;{fontWeightString}&quot;</span>
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
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;lineHeight&quot;</span>: <span style={{ color: isLineHeightInherited ? 'var(--ds__palette__text-disabled)' : 'var(--ds__palette__info-main)' }}>&quot;{lineHeightString}&quot;</span>
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
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;letterSpacing&quot;</span>: <span style={{ color: isLetterSpacingInherited ? 'var(--ds__palette__text-disabled)' : 'var(--ds__palette__info-main)' }}>&quot;{letterSpacingString}&quot;</span>
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