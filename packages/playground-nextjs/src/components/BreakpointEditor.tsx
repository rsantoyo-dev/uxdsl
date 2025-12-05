'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff } from 'lucide-react';

interface BreakpointEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  onSave: (newValue: string) => void;
  tagName: string;
  editorType?: 'numeric' | 'text' | 'font';
}

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl'];
const FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat",
  "Oswald", "Raleway", "Merriweather", "Nunito", "Poppins",
  "Playfair Display", "Ubuntu", "PT Sans", "Droid Sans", "Lora",
  "Work Sans", "Fira Sans", "Quicksand", "Barlow", "Mulish",
  "System UI", "Monospace", "Serif", "Sans-Serif"
];

type Unit = 'px' | 'rem';

interface BreakpointState {
  value: string | number;
  unit: Unit;
  enabled: boolean;
}

export function BreakpointEditor({ isOpen, onClose, initialValue, onSave, tagName, editorType = 'numeric' }: BreakpointEditorProps) {
  const [states, setStates] = useState<Record<string, BreakpointState>>({});
  const [singleValue, setSingleValue] = useState<string>('');

  // Load font for preview
  useEffect(() => {
    if (editorType === 'font' && singleValue) {
      const systemFonts = ["System UI", "Monospace", "Serif", "Sans-Serif", "Arial", "Helvetica", "Times New Roman", "Courier New"];
      if (!systemFonts.includes(singleValue)) {
        const linkId = 'uxdsl-editor-preview-font';
        let link = document.getElementById(linkId) as HTMLLinkElement;
        
        if (!link) {
          link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
        
        link.href = `https://fonts.googleapis.com/css2?family=${singleValue.replace(/ /g, '+')}:wght@400;700&display=swap`;
      }
    }
  }, [singleValue, editorType]);

  // Parse initial value string into state
  useEffect(() => {
    if (isOpen) {
      if (editorType === 'font') {
        // Extract the first valid font name found, or use the whole string if no parens
        let val = initialValue;
        if (val.includes('(')) {
          const match = val.match(/\(([^)]+)\)/);
          if (match) val = match[1];
        }
        // Handle comma separated fallbacks
        if (val.includes(',')) {
            val = val.split(',')[0];
        }
        // Clean up if it has quotes and trim
        val = val.replace(/['"]/g, '').trim();
        
        setSingleValue(val || 'Inter');
        return;
      }

      const newStates: Record<string, BreakpointState> = {};
      
      // Initialize all as disabled first
      BREAKPOINTS.forEach(bp => {
        newStates[bp] = { 
          value: editorType === 'numeric' ? 16 : '', 
          unit: 'px', 
          enabled: bp === 'xs' 
        };
      });

      const parseVal = (val: string, bp: string) => {
        if (editorType === 'numeric') {
          const match = val.match(/^([\d.]+)(px|rem)$/);
          if (match) {
            newStates[bp] = {
              value: parseFloat(match[1]),
              unit: match[2] as Unit,
              enabled: true
            };
          } else {
            const num = parseFloat(val);
            if (!isNaN(num)) {
               newStates[bp] = {
                 value: num,
                 unit: val.includes('rem') ? 'rem' : 'px',
                 enabled: true
               };
            }
          }
        } else {
          // Text mode
          newStates[bp] = {
            value: val,
            unit: 'px', // ignored
            enabled: true
          };
        }
      };

      if (!initialValue.includes('(')) {
        // Single value applies to xs (base)
        parseVal(initialValue, 'xs');
      } else {
        const regex = /(xs|sm|md|lg|xl)\(([^)]+)\)/g;
        let match;
        while ((match = regex.exec(initialValue)) !== null) {
          parseVal(match[2], match[1]);
        }
      }
      setStates(newStates);
    }
  }, [isOpen, initialValue, editorType]);

  const handleSave = () => {
    if (editorType === 'font') {
      onSave(singleValue);
      onClose();
      return;
    }

    const parts: string[] = [];
    
    BREAKPOINTS.forEach(bp => {
      const state = states[bp];
      if (state && state.enabled) {
        if (editorType === 'numeric') {
          parts.push(`${bp}(${state.value}${state.unit})`);
        } else {
          parts.push(`${bp}(${state.value})`);
        }
      }
    });

    if (parts.length === 0) {
      // Fallback
      onSave(editorType === 'numeric' ? '1rem' : 'sans-serif'); 
    } else {
      onSave(parts.join(' '));
    }
    onClose();
  };

  const updateState = (bp: string, updates: Partial<BreakpointState>) => {
    setStates(prev => ({
      ...prev,
      [bp]: { ...prev[bp], ...updates }
    }));
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--ds__palette__surface-main, #ffffff)',
        width: '100%',
        maxWidth: '500px',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        border: '1px solid var(--ds__palette__divider)'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--ds__palette__divider)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--ds__palette__surface-light)'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            Edit Typography: <span style={{ color: 'var(--ds__palette__primary-main)' }}>{tagName}</span>
          </h3>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              color: 'var(--ds__palette__text-secondary)'
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
          {editorType === 'font' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 600, color: 'var(--ds__palette__text-secondary)' }}>
                Select Font Family
              </label>
              <select
                value={singleValue}
                onChange={(e) => setSingleValue(e.target.value)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--ds__palette__divider)',
                  background: 'var(--ds__palette__surface-light)',
                  color: 'var(--ds__palette__text-primary)',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                {!FONTS.includes(singleValue) && singleValue && (
                   <option value={singleValue} style={{ fontFamily: singleValue }}>
                     {singleValue} (Current)
                   </option>
                )}
                {FONTS.map(font => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: 'var(--ds__palette__surface-light)', 
                borderRadius: '6px',
                border: '1px dashed var(--ds__palette__divider)',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, fontFamily: singleValue, fontSize: '1.5rem' }}>
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </div>
          ) : (
            BREAKPOINTS.map(bp => {
            const state = states[bp] || { value: 16, unit: 'px', enabled: false };
            
            return (
              <div key={bp} style={{ 
                display: 'grid', 
                gridTemplateColumns: '40px 1fr auto', 
                alignItems: 'center', 
                gap: '1rem',
                opacity: state.enabled ? 1 : 0.6
              }}>
                <label style={{ fontWeight: 600, color: 'var(--ds__palette__text-secondary)' }}>
                  {bp}
                </label>

                {state.enabled ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={editorType === 'numeric' ? "number" : "text"}
                        value={state.value}
                        step={editorType === 'numeric' && state.unit === 'rem' ? 0.125 : 1}
                        onChange={(e) => updateState(bp, { value: editorType === 'numeric' ? parseFloat(e.target.value) : e.target.value })}
                        style={{
                          padding: '0.5rem',
                          paddingRight: editorType === 'numeric' ? '2rem' : '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--ds__palette__divider)',
                          background: 'var(--ds__palette__surface-light)',
                          color: 'var(--ds__palette__text-primary)',
                          fontFamily: 'var(--font-code)',
                          width: '100%'
                        }}
                      />
                      {editorType === 'numeric' && (
                        <div style={{ 
                          position: 'absolute', 
                          right: '4px', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          {/* Custom spinners could go here, but native ones appear on hover usually. 
                              User asked for arrows, native input type=number provides them. */}
                        </div>
                      )}
                    </div>
                    
                    {editorType === 'numeric' && (
                      <select
                        value={state.unit}
                        onChange={(e) => updateState(bp, { unit: e.target.value as Unit })}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--ds__palette__divider)',
                          background: 'var(--ds__palette__surface-light)',
                          color: 'var(--ds__palette__text-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="px">px</option>
                        <option value="rem">rem</option>
                      </select>
                    )}
                  </div>
                ) : (
                  <div style={{ 
                    fontStyle: 'italic', 
                    color: 'var(--ds__palette__text-disabled)',
                    fontSize: '0.9rem'
                  }}>
                    Not set (inherits)
                  </div>
                )}

                {bp !== 'xs' ? (
                  <button
                    onClick={() => updateState(bp, { enabled: !state.enabled })}
                    title={state.enabled ? "Disable breakpoint" : "Enable breakpoint"}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: state.enabled ? 'var(--ds__palette__secondary-main)' : 'var(--ds__palette__text-disabled)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {state.enabled ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                ) : (
                  <div style={{ width: 36 }} />
                )}
              </div>
            );
          })
          )}
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'var(--ds__palette__surface-light)',
          borderTop: '1px solid var(--ds__palette__divider)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--ds__palette__divider)',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: 500,
              color: 'var(--ds__palette__text-primary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--ds__palette__primary-main)',
              color: 'var(--ds__palette__primary-contrast)',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
