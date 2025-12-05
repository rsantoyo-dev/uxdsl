import React from 'react';

interface InteractiveDemoContainerProps {
  title: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}

export function InteractiveDemoContainer({ title, children, toolbar }: InteractiveDemoContainerProps) {
  return (
    <div style={{
      background: 'var(--ds__palette__surface-light)',
      borderRadius: '8px',
      border: '1px solid var(--ds__palette__neutral-light)',
      marginBottom: '3rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--ds__palette__neutral-light)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ 
          fontSize: '0.75rem', 
          fontWeight: 700, 
          letterSpacing: '0.05em', 
          color: 'var(--ds__palette__text-secondary)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap'
        }}>
          {title}
        </div>
        
        {toolbar && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            {toolbar}
          </div>
        )}
      </div>
      
      <div style={{ padding: '1.5rem' }}>
        {children}
      </div>
    </div>
  );
}
