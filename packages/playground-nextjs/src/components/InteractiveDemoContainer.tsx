import React from 'react';

interface InteractiveDemoContainerProps {
  title: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  action?: React.ReactNode;
}

export function InteractiveDemoContainer({ title, children, toolbar, action }: InteractiveDemoContainerProps) {
  return (
    <div style={{
      background: 'var(--ds__palette__surface-light)',
      borderRadius: '8px',
      border: '1px solid var(--ds__palette__neutral-light)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%', // Ensure it fills grid cell
      overflow: 'hidden' // Prevent content from spilling out
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--ds__palette__neutral-light)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        background: 'var(--ds__palette__surface-main)',
        borderRadius: '8px 8px 0 0',
        flexShrink: 0 // Prevent header crushing
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '0.7rem', 
            fontWeight: 700, 
            letterSpacing: '0.05em', 
            color: 'var(--ds__palette__text-secondary)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
          }}>
            {title}
          </div>
          
        </div>

        {action && (
            <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
                {action}
            </div>
        )}
      </div>

      {toolbar && (
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--ds__palette__neutral-light)',
          background: 'var(--ds__palette__surface-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          flexShrink: 0
        }}>
          {toolbar}
        </div>
      )}
      
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <div style={{ padding: '1rem', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
