import styles from './PageTitle.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'

import React from 'react'

interface PageTitleProps {
  title: string
  subtitle?: string
  subtext?: string
  className?: string
}

export const PageTitle = ({ title, subtitle, subtext, className = '' }: PageTitleProps) => {
  return (
    <div id="PageTitle" className={scopedClasses('module-root', styles) + ' ' + scopedClasses(`page-title ${className}`, styles)}>
      <h1 className={scopedClasses("page-title__text", styles)}>{title}</h1>
      {subtitle && (
        <div className={scopedClasses("page-title__subtitle", styles)}>
          {subtitle}
          {subtext && (
            <>
              <br />
              <span className={scopedClasses("page-title__subtext", styles)}>{subtext}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
