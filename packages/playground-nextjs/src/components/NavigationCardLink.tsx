'use client'

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
      className={`navigation-card-link variant-${variant} ${className}`}
    >
      <div className="nav-card-content">
        {icon && (
          <div className={`nav-card-icon ${variant}`}>
            {icon}
          </div>
        )}
        <div className="nav-card-text">
          <h3 className="nav-card-title">{title}</h3>
          {description && <p className="nav-card-desc">{description}</p>}
        </div>
      </div>
      <div className="nav-card-arrow">
        <ArrowRight size={20} />
      </div>
    </Link>
  )
}
