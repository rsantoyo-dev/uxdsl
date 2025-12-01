'use client'

import { useEffect, useRef } from 'react'

interface HeroBackgroundProps {
  mouseX: number | null
  mouseY: number | null
  isPressed?: boolean
}

export const HeroBackground = ({ mouseX, mouseY, isPressed = false }: HeroBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const blob1Ref = useRef<HTMLDivElement>(null)
  const blob2Ref = useRef<HTMLDivElement>(null)
  
  // Use refs for positions to avoid re-renders
  const pos1 = useRef({ x: 0, y: 0 })
  const pos2 = useRef({ x: 0, y: 0 })
  const target = useRef({ x: 0, y: 0 })
  const time = useRef(0)
  const activity = useRef(0)
  const pressure = useRef(0)

  useEffect(() => {
    if (mouseX !== null && mouseY !== null) {
      target.current = { x: mouseX, y: mouseY }
    }
  }, [mouseX, mouseY])

  // Trigger impulse on click
  useEffect(() => {
    if (isPressed) {
      pressure.current = 1.5 // Initial splash intensity
    }
  }, [isPressed])

  useEffect(() => {
    let animationFrameId: number

    const animate = () => {
      // Calculate distance from blob to target (lag) as a proxy for movement intensity
      const dist = Math.hypot(target.current.x - pos1.current.x, target.current.y - pos1.current.y)
      // Map distance to activity (0 to 1), smoothed
      const targetActivity = Math.min(dist / 100, 1)
      activity.current += (targetActivity - activity.current) * 0.05
      
      // Decay pressure (impulse effect)
      pressure.current = Math.max(0, pressure.current * 0.92)

      // Increase time based on activity and pressure (faster waves when moving or pressed)
      time.current += 0.02 + (activity.current * 0.05) + (pressure.current * 0.3)

      // Blob 1 - Primary - Faster
      pos1.current.x += (target.current.x - pos1.current.x) * 0.08
      pos1.current.y += (target.current.y - pos1.current.y) * 0.08

      // Blob 2 - Secondary - Slower (Watery drag)
      pos2.current.x += (target.current.x - pos2.current.x) * 0.04
      pos2.current.y += (target.current.y - pos2.current.y) * 0.04

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        
        // Update opacity based on activity (lighter on movement) and pressure (darker center)
        // Base opacity is handled in CSS, we add to it
        // Activity makes it visible (0.4 boost), Pressure makes it intense (0.2 boost)
        const opacityBoost = 0.02 + (activity.current * 0.4) + (pressure.current * 0.2)
        containerRef.current.style.setProperty('--blob-opacity', opacityBoost.toFixed(3))
        
        if (blob1Ref.current) {
          const x = pos1.current.x - rect.left
          const y = pos1.current.y - rect.top
          // Add wave effect (scale) - Pressure increases amplitude
          const waveAmp = 0.1 + (pressure.current * 0.1)
          const scale = 1 + Math.sin(time.current) * waveAmp
          blob1Ref.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`
        }

        if (blob2Ref.current) {
          const x = pos2.current.x - rect.left
          const y = pos2.current.y - rect.top
          // Add wave effect (scale, offset phase)
          const waveAmp = 0.15 + (pressure.current * 0.1)
          const scale = 1 + Math.sin(time.current + 2) * waveAmp
          blob2Ref.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`
        }
      }
      
      animationFrameId = requestAnimationFrame(animate)
    }
    
    animate()
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  return (
    <div 
      ref={containerRef} 
      className="hero-background"
    >
      {/* Secondary Blob (Behind) */}
      <div 
        ref={blob2Ref}
        className="hero-background__blob hero-background__blob--secondary"
      />
      
      {/* Primary Blob (Front) */}
      <div 
        ref={blob1Ref}
        className="hero-background__blob hero-background__blob--primary"
      />
      
      {/* Overlay for texture/noise if desired, or just to smooth things out */}
      <div 
        className="hero-background__overlay"
      />
    </div>
  )
}
