"use client";


import styles from './BreakpointEditor.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import React, { useEffect, useState } from 'react';
import { compileTypographyRules, DEFAULT_BREAKPOINTS } from 'postcss-uxdsl/ds-runtime';
import { useTheme } from './ThemeContext';

interface BreakpointEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue?: string;
  onSave: (newValue: string) => void;
  tagName: string;
  editorType?: 'numeric' | 'text' | 'font' | 'select';
  options?: string[];
}

/** Edits the source expression without converting tokens or native CSS to pixels. */
export function BreakpointEditor({ isOpen, onClose, initialValue = '', onSave, tagName, options = [] }: BreakpointEditorProps) {
  const { activeThemeData } = useTheme();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  useEffect(() => { setValue(initialValue); setError(''); }, [isOpen, initialValue]);
  if (!isOpen) return null;
  const bps = { ...DEFAULT_BREAKPOINTS, ...activeThemeData?.breakpoints };
  const save = () => {
    try {
      compileTypographyRules({ preview: { fontSize: value } }, bps);
      onSave(value.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return <div role="presentation" onClick={onClose} className={scopedClasses("breakpoint-editor__backdrop", styles)}>
    <section role="dialog" aria-modal="true" aria-labelledby="typography-expression-title" onClick={event => event.stopPropagation()} className={scopedClasses("breakpoint-editor__dialog", styles)}>
      <h3 id="typography-expression-title">Edit {tagName}</h3>
      <p>Edit the theme expression. Tokens and native CSS remain intact.</p>
      <label htmlFor="typography-expression">Value or responsive progression</label>
      <textarea id="typography-expression" value={value} onChange={event => setValue(event.target.value)} rows={4} className={scopedClasses("code-textarea", styles)} />
      <p>Configured breakpoints: {Object.entries(bps).sort((a, b) => Number(a[1]) - Number(b[1])).map(([name, width]) => `${name}: ${width}px`).join(' · ')}</p>
      <p>A rule remains active until another breakpoint overrides it.</p>
      {options.length > 0 && <select aria-label="Suggested value" value="" onChange={event => setValue(event.target.value)}><option value="">Choose a value</option>{options.map(option => <option key={option}>{option}</option>)}</select>}
      {error && <p role="alert">{error}</p>}
      <div className={scopedClasses("breakpoint-editor__actions", styles)}><button onClick={onClose}>Cancel</button><button onClick={save}>Save to theme</button></div>
    </section>
  </div>;
}
