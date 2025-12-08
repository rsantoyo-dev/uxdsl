'use client';

import { TypographyDemoProvider } from './TypographyDemoContext';
import { ResponsiveSyntaxExplainer } from './ResponsiveSyntaxExplainer';
import DemoTypography from './DemoTypography';

import { EditDialog } from './EditTypographyDialog';
import { initialTypographyItems, useTypographyDemo } from './TypographyDemoContext';

function TypographyDemosContent() {
  const { editingTag, setEditingTag } = useTypographyDemo();
  const editingItem = initialTypographyItems.find(i => i.tag === editingTag);

  return (
    <>
      <ResponsiveSyntaxExplainer />
      <DemoTypography />
      {editingItem && (
        <EditDialog 
          item={editingItem} 
          onClose={() => setEditingTag(null)} 
        />
      )}
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