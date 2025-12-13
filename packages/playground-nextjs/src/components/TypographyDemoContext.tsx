'use client';

import React, { createContext, useContext, useState } from 'react';

// Initial Data
export const initialTypographyItems = [
  { tag: 'h1', label: 'H1', text: 'UXDSL: The Design System Language', className: 'sample-h1' },
  { tag: 'h2', label: 'H2', text: 'The Evolution of Styling', className: 'sample-h2' },
  { tag: 'h3', label: 'H3', text: 'Atomic vs Semantic', className: 'sample-h3' },
  { tag: 'h4', label: 'H4', text: 'The rise of design tokens', className: 'sample-h4' },
  { tag: 'h5', label: 'H5', text: 'Runtime adaptability', className: 'sample-h5' },
  { tag: 'h6', label: 'H6', text: 'Future of CSS generation', className: 'sample-h6' },
  { tag: 'p', label: 'P', text: 'UXDSL bridges the gap between design tokens and CSS generation, allowing for a truly semantic and adaptable design system that scales with your application.', className: 'sample-p' },
  { tag: 'body', label: 'BODY', text: 'UXDSL provides a type-safe, token-aware styling experience that integrates seamlessly with modern frameworks.', className: 'sample-body' },
  { tag: 'span', label: 'SPAN', text: 'Inline token usage', className: 'sample-span' },
  { tag: 'caption', label: 'CAPTION', text: 'Figure 1: Token dependency graph', className: 'sample-caption' },
  { tag: 'small', label: 'SMALL', text: 'v1.0.0-beta', className: 'sample-small' },
  { tag: 'code', label: 'CODE', text: 'const answer = 42;', className: 'sample-code' },
  { tag: 'pre', label: 'PRE', text: 'const theme = { colors: { primary: \'blue\' } };', className: 'sample-pre' },
  { tag: 'default', label: 'Default', text: 'The quick brown fox jumps over the lazy dog.', className: 'sample-default' },
];

interface TypographyDemoContextType {
  textMap: Record<string, string>;
  updateText: (tag: string, newText: string) => void;
  editingTag: string | null;
  setEditingTag: (tag: string | null) => void;
}

const TypographyDemoContext = createContext<TypographyDemoContextType | undefined>(undefined);

export function TypographyDemoProvider({ children }: { children: React.ReactNode }) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  // Initialize map from the array
  const [textMap, setTextMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialTypographyItems.forEach(item => {
      map[item.tag] = item.text;
    });
    return map;
  });

  const updateText = (tag: string, newText: string) => {
    setTextMap(prev => ({
      ...prev,
      [tag]: newText
    }));
  };

  return (
    <TypographyDemoContext.Provider value={{ textMap, updateText, editingTag, setEditingTag }}>
      {children}
    </TypographyDemoContext.Provider>
  );
}

export function useTypographyDemo() {
  const context = useContext(TypographyDemoContext);
  if (!context) {
    throw new Error('useTypographyDemo must be used within a TypographyDemoProvider');
  }
  return context;
}
