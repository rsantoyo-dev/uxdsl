'use client';

import { TypographyDemoProvider, useTypographyDemo, initialTypographyItems } from './TypographyDemoContext';
import { ResponsiveSyntaxExplainer } from './ResponsiveSyntaxExplainer';
import DemoTypography from './DemoTypography';
import { EditDialog } from './EditTypographyDialog';

function TypographyDemosContent() {
  const { editingTag, setEditingTag } = useTypographyDemo();
  const editingItem = editingTag ? initialTypographyItems.find(i => i.tag === editingTag) : null;

  return (
    <>
      <ResponsiveSyntaxExplainer />
      <DemoTypography />
      {editingItem && (
        <EditDialog item={editingItem} onClose={() => setEditingTag(null)} />
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