'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { useTypographyDemo } from './TypographyDemoContext';
import { Edit2 } from 'lucide-react';
import { BreakpointEditor } from './BreakpointEditor';

const TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'body', 'caption'];

export function ResponsiveSyntaxExplainer() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme();
  const { textMap, updateText } = useTypographyDemo();
  const [selectedTag, setSelectedTag] = useState('h1');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFontFamilyEditorOpen, setIsFontFamilyEditorOpen] = useState(false);
  const editableRef = useRef<HTMLElement>(null);

  // Safe access to the typography details
  const details = activeThemeData?.typography_details?.[selectedTag] || {};
  const fontSizeString = details.fontSize || 'xs(16px)'; // Fallback
  const fontFamilyString = details.fontFamily || 'xs(Inter)'; // Fallback

  // Sync ref content when tag changes (or text updates externally)
  useEffect(() => {
    if (editableRef.current && editableRef.current.innerText !== textMap[selectedTag]) {
      editableRef.current.innerText = textMap[selectedTag] || '';
    }
  }, [selectedTag, textMap]);

  // Simple parser for the responsive syntax (Non-Regex version to avoid escaping issues)
  const parseValue = (str: string, prefix: string) => {
    if (!str) return null;
    const token = `${prefix}(`;
    const start = str.indexOf(token);
    if (start === -1) return null;
    
    const valueStart = start + token.length;
    const end = str.indexOf(')', valueStart);
    if (end === -1) return null;
    
    return str.substring(valueStart, end);
  };

  // Extract values for key breakpoints
  const mobileVal = parseValue(fontSizeString, 'xs') || parseValue(fontSizeString, 'sm') || fontSizeString;
  const tabletVal = parseValue(fontSizeString, 'md') || mobileVal;
  const desktopVal = parseValue(fontSizeString, 'xl') || parseValue(fontSizeString, 'lg') || tabletVal;

  const isResponsive = fontSizeString.includes('(');

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    updateText(selectedTag, e.currentTarget.innerText);
  };

  const handleSave = (newValue: string) => {
    // Clone current theme data to avoid mutating state directly
    const newTheme = JSON.parse(JSON.stringify(activeThemeData));
    
    // Ensure structure exists
    if (!newTheme.typography_details) newTheme.typography_details = {};
    if (!newTheme.typography_details[selectedTag]) newTheme.typography_details[selectedTag] = {};
    
    // Update value
    newTheme.typography_details[selectedTag].fontSize = newValue;
    
    // Update theme context
    setCustomTheme(customThemeName || 'Custom Theme', newTheme);
  };

  const handleSaveFontFamily = (newValue: string) => {
    const newTheme = JSON.parse(JSON.stringify(activeThemeData));
    if (!newTheme.typography_details) newTheme.typography_details = {};
    if (!newTheme.typography_details[selectedTag]) newTheme.typography_details[selectedTag] = {};
    newTheme.typography_details[selectedTag].fontFamily = newValue;

    // Add to Google Fonts list if it's likely a Google Font (not a system font)
    const systemFonts = ["System UI", "Monospace", "Serif", "Sans-Serif", "Arial", "Helvetica", "Times New Roman", "Courier New"];
    // Extract the primary font family name (before comma)
    const primaryFont = newValue.split(',')[0].replace(/['"]/g, '').trim();
    
    if (!systemFonts.includes(primaryFont) && primaryFont) {
      if (!newTheme.fonts) newTheme.fonts = {};
      if (!newTheme.fonts.google) newTheme.fonts.google = [];
      
      // Check if already exists (ignoring weights for simplicity check)
      const exists = newTheme.fonts.google.some((f: string) => f.startsWith(primaryFont));
      if (!exists) {
        // Add with default weights
        newTheme.fonts.google.push(`${primaryFont}:wght@400;500;600;700`);
      }
    }

    setCustomTheme(customThemeName || 'Custom Theme', newTheme);
  };

  return (
    <div style={{
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
            onChange={(e) => setSelectedTag(e.target.value)}
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
        <div style={{ 
          fontSize: '0.65rem', 
          textTransform: 'uppercase', 
          opacity: 0.6, 
          marginBottom: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>Live Preview</span>
          <span style={{ opacity: 0.5, fontWeight: 400 }}>Click to edit</span>
        </div>
        
        <div className="live-preview-box">
          <div className="top-right-corner" />
          <div className="bottom-left-corner" />
          {React.createElement(
            selectedTag === 'body' || selectedTag === 'caption' || selectedTag === 'span' || selectedTag === 'small' || selectedTag === 'pre' ? 'p' : selectedTag,
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
                cursor: 'text'
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
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {selectedTag}: {'{'} <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontSize&quot;</span>: <span style={{ color: 'var(--ds__palette__info-main)' }}>&quot;{fontSizeString}&quot;</span>,
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ paddingLeft: '2ch' }}>
            <span style={{ color: 'var(--ds__palette__secondary-main)' }}>&quot;fontFamily&quot;</span>: <span style={{ color: 'var(--ds__palette__info-main)' }}>&quot;{fontFamilyString}&quot;</span> {'}'}
          </div>
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

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        fontSize: '0.875rem', 
        color: 'var(--ds__palette__text-secondary)' 
      }}>
        <div style={{ opacity: isResponsive ? 1 : 0.5 }}>
          <strong style={{ display: 'block', color: 'var(--ds__palette__text-primary)', marginBottom: '0.25rem' }}>
            📱 Mobile First {isResponsive && '(xs)'}
          </strong>
          <div style={{ fontSize: '1.2rem', fontWeight: 500 }}>{mobileVal}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Base size on small screens</div>
        </div>
        
        {isResponsive && (
          <>
            <div>
              <strong style={{ display: 'block', color: 'var(--ds__palette__text-primary)', marginBottom: '0.25rem' }}>
                📖 Tablet (md)
              </strong>
              <div style={{ fontSize: '1.2rem', fontWeight: 500 }}>{tabletVal}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Updates at 768px</div>
            </div>
            <div>
              <strong style={{ display: 'block', color: 'var(--ds__palette__text-primary)', marginBottom: '0.25rem' }}>
                🖥️ Desktop (xl)
              </strong>
              <div style={{ fontSize: '1.2rem', fontWeight: 500 }}>{desktopVal}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Max scale at 1280px</div>
            </div>
          </>
        )}

        {!isResponsive && (
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', opacity: 0.7 }}>
            <em>Fixed size. Use <code>xs() md()</code> syntax to make it responsive.</em>
          </div>
        )}
      </div>
    </div>
  );
}