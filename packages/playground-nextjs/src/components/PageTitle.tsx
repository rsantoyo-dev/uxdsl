import React from 'react'

interface PageTitleProps {
  title: string
  subtitle?: string
  subtext?: string
  className?: string
}

export const PageTitle = ({ title, subtitle, subtext, className = '' }: PageTitleProps) => {
  return (
    <div className={`page-title ${className}`}>
      <h1 className="page-title__text">{title}</h1>
      {subtitle && (
        <p className="page-title__subtitle">
          {subtitle}
          {subtext && (
            <>
              <br />
              <span className="page-title__subtext">{subtext}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
