'use client'

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  language?: string
  children?: React.ReactNode
  code?: string
}

export default function CodeBlock({ language = 'bash', children, code }: CodeBlockProps) {
  const content = code || String(children || '').trim()
  const [isDark, setIsDark] = useState(true) // Default to dark for consistency until hydration

  useEffect(() => {
    // Function to check theme
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(theme === 'dark' || (!theme && prefersDark))
    }

    // Initial check
    checkTheme()

    // Watch for attribute changes on <html>
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          checkTheme()
        }
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div style={{ 
      borderRadius: 'var(--radius-2)', 
      overflow: 'hidden',
      border: '1px solid var(--ds__palette__neutral-light)',
      fontSize: '0.9rem'
    }}>
      <SyntaxHighlighter
        language={language}
        style={isDark ? vscDarkPlus : vs}
        customStyle={{ margin: 0, padding: '1.5rem' }}
        wrapLines={true}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  )
}