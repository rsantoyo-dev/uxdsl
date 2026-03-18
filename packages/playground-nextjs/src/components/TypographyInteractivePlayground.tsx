'use client';

import React from 'react';
import { TypographyDemoProvider, initialTypographyItems, useTypographyDemo } from './TypographyDemoContext';
import { ResponsiveSyntaxExplainer } from './ResponsiveSyntaxExplainer';
import { EditDialog } from './EditTypographyDialog';

type TypographyInteractivePlaygroundProps = {
  action?: React.ReactNode;
  showEditDialog?: boolean;
};

function TypographyInteractivePlaygroundContent({
  action,
  showEditDialog,
}: TypographyInteractivePlaygroundProps) {
  const { editingTag, setEditingTag } = useTypographyDemo();
  const editingItem = initialTypographyItems.find((i) => i.tag === editingTag);

  return (
    <>
      <ResponsiveSyntaxExplainer action={action} />
      {showEditDialog && editingItem && (
        <EditDialog item={editingItem} onClose={() => setEditingTag(null)} />
      )}
    </>
  );
}

export function TypographyInteractivePlayground({
  action,
  showEditDialog = true,
}: TypographyInteractivePlaygroundProps) {
  return (
    <TypographyDemoProvider>
      <TypographyInteractivePlaygroundContent
        action={action}
        showEditDialog={showEditDialog}
      />
    </TypographyDemoProvider>
  );
}
