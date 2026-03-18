'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, RefreshCcw } from 'lucide-react'
import { validateAndNormalizeTheme } from 'postcss-uxdsl/ds-runtime'
import { useTheme } from './ThemeContext'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

export default function ThemeConfigJsonEditor() {
  const { activeThemeData, setCustomTheme, customThemeName } = useTheme()
  const [jsonText, setJsonText] = useState(() => prettyJson(activeThemeData))
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'synced' | 'invalid'>('idle')

  const lastAppliedRef = useRef<string>('')
  const syncTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const next = prettyJson(activeThemeData)
    setJsonText(next)
    lastAppliedRef.current = next
    setError(null)
    setStatus('synced')
  }, [activeThemeData])

  useEffect(() => {
    if (jsonText === lastAppliedRef.current) return

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonText)
        const validated = validateAndNormalizeTheme(parsed, { requireXsForResponsive: true })

        if (!validated.ok) {
          const first = validated.errors[0]
          const firstMessage =
            typeof first === 'string'
              ? first
              : first
                ? `${first.path}: ${first.message}`
                : 'Invalid theme JSON.'
          setStatus('invalid')
          setError(firstMessage)
          return
        }

        const nextPretty = prettyJson(validated.theme)
        lastAppliedRef.current = nextPretty
        setError(null)
        setStatus('synced')
        setCustomTheme(customThemeName || 'Custom Theme', validated.theme)
      } catch {
        setStatus('invalid')
        setError('Invalid JSON syntax. Fix the JSON to apply changes.')
      }
    }, 500)

    return () => {
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current)
    }
  }, [jsonText, setCustomTheme, customThemeName])

  const handleReset = () => {
    const next = prettyJson(activeThemeData)
    setJsonText(next)
    setError(null)
    setStatus('synced')
  }

  const handleExport = () => {
    const fallback = prettyJson(activeThemeData)
    const content = (() => {
      try {
        return prettyJson(JSON.parse(jsonText))
      } catch {
        return fallback
      }
    })()

    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'uxdsl.theme.runtime.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <InteractiveDemoContainer
      title="Runtime Config JSON"
      toolbar={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--ds__palette__text-secondary)' }}>
            Edit JSON to update UI live. UI changes also sync back here.
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                border: '1px solid var(--ds__palette__neutral-light)',
                background: 'var(--ds__palette__surface-light)',
                color: 'var(--ds__palette__text-primary)',
                borderRadius: 'var(--radius-1, 6px)',
                padding: 'var(--space-2) var(--space-3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <RefreshCcw size={14} /> Reset
            </button>
            <button
              type="button"
              onClick={handleExport}
              style={{
                border: '1px solid var(--ds__palette__primary-main)',
                background: 'var(--ds__palette__primary-main)',
                color: 'var(--ds__palette__primary-contrast)',
                borderRadius: 'var(--radius-1, 6px)',
                padding: 'var(--space-2) var(--space-3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          aria-label="Theme runtime JSON editor"
          style={{
            width: '100%',
            minHeight: '460px',
            resize: 'vertical',
            fontFamily: 'var(--font-code, ui-monospace, SFMono-Regular, Menlo, monospace)',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            border: `1px solid ${error ? 'var(--ds__palette__error-main)' : 'var(--ds__palette__neutral-light)'}`,
            borderRadius: 'var(--radius-1, 8px)',
            padding: 'var(--space-3)',
            background: 'var(--ds__palette__surface-main)',
            color: 'var(--ds__palette__text-primary)'
          }}
        />
        <div style={{ fontSize: '0.75rem', color: error ? 'var(--ds__palette__error-main)' : 'var(--ds__palette__text-secondary)' }}>
          {error
            ? error
            : status === 'synced'
              ? 'Synced with runtime theme.'
              : 'Waiting for valid JSON...'}
        </div>
      </div>
    </InteractiveDemoContainer>
  )
}
