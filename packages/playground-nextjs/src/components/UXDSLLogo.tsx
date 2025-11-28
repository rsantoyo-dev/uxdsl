import React, { useId } from 'react'

export const UXDSLLogo = ({ 
  className,
  primaryMain = 'var(--ds__palette__primary-main)',
  primaryDark = 'var(--ds__palette__primary-dark)',
  primaryLight = 'var(--ds__palette__primary-light)',
  secondaryMain = 'var(--ds__palette__secondary-main)',
  secondaryLight = 'var(--ds__palette__secondary-light)',
  infoMain = 'var(--ds__palette__info-main)'
}: { 
  className?: string;
  primaryMain?: string;
  primaryDark?: string;
  primaryLight?: string;
  secondaryMain?: string;
  secondaryLight?: string;
  infoMain?: string;
}) => {
  const uniqueId = useId().replace(/:/g, '')
  const gradD = `gradD-${uniqueId}`
  const gradU = `gradU-${uniqueId}`
  const dropShadow = `dropShadow-${uniqueId}`

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradD} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primaryDark} />
          <stop offset="60%" stopColor={primaryMain} />
          <stop offset="100%" stopColor={primaryLight} />
        </linearGradient>
        <linearGradient id={gradU} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor={primaryLight} />
          <stop offset="100%" stopColor={primaryMain} />
        </linearGradient>
        <filter id={dropShadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="2"
            dy="2"
            stdDeviation="2"
            floodColor="rgba(0,0,0,0.7)"
          />
        </filter>
      </defs>

      {/* D Shape (Background) */}
      {/* Contrast Layers for Visibility */}
      <path
        d="M 34 16 H 44 C 56 16 56 48 44 48 H 34 Z"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="8"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path
        d="M 34 16 H 44 C 56 16 56 48 44 48 H 34 Z"
        stroke={primaryLight}
        strokeWidth=""
        strokeLinecap="butt"
        strokeLinejoin="miter"
        opacity="0.75"
      />
      {/* Main Shape */}
      <path
        d="M 34 16 H 44 C 56 16 56 48 44 48 H 34 Z"
        stroke={`url(#${gradD})`}
        strokeWidth="8"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />

      {/* U Shape (Foreground) */}
      {/* Constructed with fill to allow custom diagonal cut on top-left */}
      {/* Left Stick: x=10..18. Right Stick: x=30..38. */}
      {/* Diagonal Cut: Top-Left to Bottom-Right (\) on both sticks */}
      {/* Right stick cut lowered to y=32 (half of D height) */}
      <path
        d="M 10 12 L 18 24 L 18 38 A 6 6 0 0 0 30 38 L 30 20 L 38 32 L 38 38 A 14 14 0 0 1 10 38 Z"
        fill={`url(#${gradU})`}
        filter={`url(#${dropShadow})`}
       
      />

    {/* 3 Pixels Top Right - "Modernism and Balance" */}
    <rect
      x="25"
      y="28"
      width="3"
      height="3"
      fill={infoMain}
      opacity="0.7"
      rx="1"
    />
    <rect x="58" y="14" width="4" height="4" fill={infoMain} rx="1" />
    <rect
      x="54"
      y="10"
      width="3"
      height="3"
      fill={infoMain}
      opacity="0.5"
      rx="1"
    />

    {/* Bottom Left */}
    <path
      d="M 2 12 L 2 38 A 22 22 0 0 0 24 60"
      stroke={secondaryMain}
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.3"
    />
    <path
      d="M 5 12 L 5 38 A 19 19 0 0 0 24 57"
      stroke={secondaryLight}
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.6"
    />
    <path
      d="M 8 12 L 8 38 A 16 16 0 0 0 24 54"
      stroke={secondaryLight}
      strokeWidth="1"
      strokeLinecap="round"
    />
   
  </svg>
  )
}
