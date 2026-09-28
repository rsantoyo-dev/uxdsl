'use client';

import React from 'react';
import { TypographyDemoProvider } from './TypographyDemoContext';
import { ResponsiveSyntaxExplainer } from './ResponsiveSyntaxExplainer';

// MIG-B7-17 phase B (5): this used to mount EditTypographyDialog whenever the context had
// an `editingTag`, but only DemoTypography (imported by no route) ever set one, so the dialog
// could not open. Both were removed; ResponsiveSyntaxExplainer is the typography editor.
type TypographyInteractivePlaygroundProps = {
  action?: React.ReactNode;
};

export function TypographyInteractivePlayground({ action }: TypographyInteractivePlaygroundProps) {
  return (
    <TypographyDemoProvider>
      <ResponsiveSyntaxExplainer action={action} />
    </TypographyDemoProvider>
  );
}
