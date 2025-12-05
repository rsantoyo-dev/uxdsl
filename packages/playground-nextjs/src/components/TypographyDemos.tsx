'use client';

import { TypographyDemoProvider } from './TypographyDemoContext';
import { ResponsiveSyntaxExplainer } from './ResponsiveSyntaxExplainer';
import DemoTypography from './DemoTypography';

function TypographyDemosContent() {
  return (
    <>
      <ResponsiveSyntaxExplainer />
      <DemoTypography />
    </>
  );
}

export function TypographyDemos() {
  return (
    <TypographyDemoProvider>
      <TypographyDemosContent />
    </TypographyDemoProvider>
  );
}