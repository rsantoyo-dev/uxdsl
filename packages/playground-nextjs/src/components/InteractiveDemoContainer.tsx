import React from 'react';

interface InteractiveDemoContainerProps {
  title: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  action?: React.ReactNode;
}

export function InteractiveDemoContainer({ title, children, toolbar, action }: InteractiveDemoContainerProps) {
  return (
    <div className="InteractiveDemoContainer">
      <div className="InteractiveDemoContainer__header">
        <div className="InteractiveDemoContainer__headerLeft">
          <div className="InteractiveDemoContainer__title ds-typo" data-typo="caption">
            {title}
          </div>
        </div>

        {action && <div className="InteractiveDemoContainer__action">{action}</div>}
      </div>

      {toolbar && <div className="InteractiveDemoContainer__toolbar">{toolbar}</div>}
      
      <div className="InteractiveDemoContainer__bodyScroll">
        <div className="InteractiveDemoContainer__bodyInner">{children}</div>
      </div>
    </div>
  );
}
