'use client'

import React, { createContext, useContext, useState } from 'react'

interface NavContextType {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  toggle: () => void
}

const NavContext = createContext<NavContextType | undefined>(undefined)

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = () => setIsOpen(!isOpen)

  return (
    <NavContext.Provider value={{ isOpen, setIsOpen, toggle }}>
      {children}
    </NavContext.Provider>
  )
}

export function useNav() {
  const context = useContext(NavContext)
  if (context === undefined) {
    throw new Error('useNav must be used within a NavProvider')
  }
  return context
}
