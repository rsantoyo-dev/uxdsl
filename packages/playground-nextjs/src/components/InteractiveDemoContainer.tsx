import styles from './InteractiveDemoContainer.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'

import React from 'react';

interface InteractiveDemoContainerProps {
  title: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  action?: React.ReactNode;
}

export function InteractiveDemoContainer({ title, children, toolbar, action }: InteractiveDemoContainerProps) {
  return (
    <div className={scopedClasses("InteractiveDemoContainer", styles)}>
      <div className={scopedClasses("InteractiveDemoContainer__header", styles)}>
        <div className={scopedClasses("InteractiveDemoContainer__headerLeft", styles)}>
          <div className={scopedClasses("InteractiveDemoContainer__title ds-typo", styles)} data-typo="caption">
            {title}
          </div>
        </div>

        {action && <div className={scopedClasses("InteractiveDemoContainer__action", styles)}>{action}</div>}
      </div>

      {toolbar && <div className={scopedClasses("InteractiveDemoContainer__toolbar", styles)}>{toolbar}</div>}
      
      <div className={scopedClasses("InteractiveDemoContainer__bodyScroll", styles)}>
        <div className={scopedClasses("InteractiveDemoContainer__bodyInner", styles)}>{children}</div>
      </div>
    </div>
  );
}
