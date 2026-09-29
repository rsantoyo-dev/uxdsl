'use client'


import styles from './NavigationCardLink.module.css'
import { scopedClasses } from '../lib/uxdsl-module-classes'
import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface NavigationCardLinkProps {
  href: string
  title: string
  description?: string
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}

export default function NavigationCardLink({
  href,
  title,
  description,
  icon,
  variant = 'primary',
  className = ''
}: NavigationCardLinkProps) {
  return (
    <Link 
      href={href} 
      className={scopedClasses(`navigation-card-link variant-${variant} ${className}`, styles)}
    >
      <div className={scopedClasses("nav-card-content", styles)}>
        {icon && (
          <div className={scopedClasses(`nav-card-icon ${variant}`, styles)}>
            {icon}
          </div>
        )}
        <div className={scopedClasses("nav-card-text", styles)}>
          <h3 className={scopedClasses("nav-card-title", styles)}>{title}</h3>
          {description && <p className={scopedClasses("nav-card-desc", styles)}>{description}</p>}
        </div>
      </div>
      <div className={scopedClasses("nav-card-arrow", styles)}>
        <ArrowRight size={20} />
      </div>
    </Link>
  )
}
