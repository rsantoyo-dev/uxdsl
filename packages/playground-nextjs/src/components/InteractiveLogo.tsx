'use client'

import React, { useId, useRef, useEffect, useState } from 'react'

interface InteractiveLogoProps {
  className?: string;
  primaryMain?: string;
  primaryDark?: string;
  primaryLight?: string;
  secondaryMain?: string;
  secondaryLight?: string;
  infoMain?: string;
  mouseX?: number | null;
  mouseY?: number | null;
}

export const InteractiveLogo = ({ 
  className,
  primaryMain = 'var(--ds__palette__primary-main)',
  primaryDark = 'var(--ds__palette__primary-dark)',
  primaryLight = 'var(--ds__palette__primary-light)',
  secondaryMain = 'var(--ds__palette__secondary-main)',
  secondaryLight = 'var(--ds__palette__secondary-light)',
  infoMain = 'var(--ds__palette__info-main)',
  mouseX,
  mouseY
}: InteractiveLogoProps) => {
  const uniqueId = useId().replace(/:/g, '')
  const gradD = `gradD-${uniqueId}`
  const gradU = `gradU-${uniqueId}`
  const dropShadow = `dropShadow-${uniqueId}`
  const glow = `glow-${uniqueId}`
  
  const svgRef = useRef<SVGSVGElement>(null)
  const [internalMousePos, setInternalMousePos] = useState({ x: 0, y: 0 })
  const [internalIsHovering, setInternalIsHovering] = useState(false)
  const [isIdle, setIsIdle] = useState(false)

  // Use external props if provided, otherwise fall back to internal state
  const isControlled = mouseX !== undefined && mouseY !== undefined
  
  // Particle positions (relative to their original positions)
  const [particles, setParticles] = useState([
    { x: 0, y: 0, ox: 25, oy: 28, speed: 0.15 }, // Pixel 1
    { x: 0, y: 0, ox: 58, oy: 14, speed: 0.1 },  // Pixel 2
    { x: 0, y: 0, ox: 54, oy: 10, speed: 0.12 }  // Pixel 3
  ])

  // Handle idle state - reset particles if mouse stops moving for 2 seconds
  useEffect(() => {
    setIsIdle(false)
    // Only set timer if we have active mouse input
    if (isControlled && (mouseX === null || mouseY === null)) return
    if (!isControlled && !internalIsHovering) return

    const timer = setTimeout(() => {
      setIsIdle(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [mouseX, mouseY, internalMousePos, isControlled, internalIsHovering])

  useEffect(() => {
    let animationFrameId: number

    const animate = () => {
      // Calculate target position based on controlled or uncontrolled state
      let targetMouseX = 0
      let targetMouseY = 0
      let isActive = false

      if (isControlled) {
        if (mouseX !== null && mouseY !== null && svgRef.current) {
          const rect = svgRef.current.getBoundingClientRect()
          targetMouseX = ((mouseX - rect.left) / rect.width) * 64
          targetMouseY = ((mouseY - rect.top) / rect.height) * 64
          isActive = true
        }
      } else {
        targetMouseX = internalMousePos.x
        targetMouseY = internalMousePos.y
        isActive = internalIsHovering
      }

      setParticles(prevParticles => {
        return prevParticles.map(p => {
          let targetX = 0
          let targetY = 0

          if (isActive && !isIdle) {
            // Calculate vector to mouse
            // Mouse pos is in SVG coordinates (0-64)
            // Move in opposite direction for a "trail" effect
            targetX = -(targetMouseX - p.ox) * 0.15 
            targetY = -(targetMouseY - p.oy) * 0.15
          }

          // Smooth interpolation (lerp)
          const newX = p.x + (targetX - p.x) * p.speed
          const newY = p.y + (targetY - p.y) * p.speed

          return { ...p, x: newX, y: newY }
        })
      })
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animationFrameId)
  }, [isControlled, mouseX, mouseY, internalIsHovering, internalMousePos, isIdle])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isControlled) return
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    
    // Map mouse position to SVG coordinate space (0-64)
    const x = ((e.clientX - rect.left) / rect.width) * 64
    const y = ((e.clientY - rect.top) / rect.height) * 64
    
    setInternalMousePos({ x, y })
    setInternalIsHovering(true)
  }

  const handleMouseLeave = () => {
    if (isControlled) return
    setInternalIsHovering(false)
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ overflow: 'visible' }} // Allow particles to move slightly outside if needed
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
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="4"
            floodColor={infoMain}
          />
        </filter>
      </defs>

      {/* D Shape (Background) */}
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
      <path
        d="M 34 16 H 44 C 56 16 56 48 44 48 H 34 Z"
        stroke={`url(#${gradD})`}
        strokeWidth="8"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />

      {/* U Shape (Foreground) */}
      <path
        d="M 10 12 L 18 24 L 18 38 A 6 6 0 0 0 30 38 L 30 20 L 38 32 L 38 38 A 14 14 0 0 1 10 38 Z"
        fill={`url(#${gradU})`}
        filter={`url(#${dropShadow})`}
      />

      {/* Interactive Pixels */}
      {/* Pixel 1 */}
      <rect
        x={25}
        y={28}
        width="3"
        height="3"
        fill={infoMain}
        opacity="0.7"
        rx="1"
        style={{ transform: `translate(${particles[0].x}px, ${particles[0].y}px)` }}
        filter={!isIdle ? `url(#${glow})` : undefined}
      />
      {/* Pixel 2 */}
      <rect 
        x={58} 
        y={14} 
        width="4" 
        height="4" 
        fill={infoMain} 
        rx="1" 
        style={{ transform: `translate(${particles[1].x}px, ${particles[1].y}px)` }}
        filter={!isIdle ? `url(#${glow})` : undefined}
      />
      {/* Pixel 3 */}
      <rect
        x={54}
        y={10}
        width="3"
        height="3"
        fill={infoMain}
        opacity="0.5"
        rx="1"
        style={{ transform: `translate(${particles[2].x}px, ${particles[2].y}px)` }}
        filter={!isIdle ? `url(#${glow})` : undefined}
      />

      {/* Bottom Left Lines */}
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
