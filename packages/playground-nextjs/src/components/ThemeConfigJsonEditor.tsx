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
    // MIG-B6-30 (FEAT-008): drop any edit still waiting on the debounce before
    // adopting the new theme's JSON. Without this, switching themes (or
    // resetting) while a keystroke was pending let that keystroke fire ~500ms
    // later and re-apply an edit belonging to the theme the user just left.
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current)
      syncTimeoutRef.current = null
    }
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
      } catch (cause) {
        // A parse failure and a rejected theme are different problems, and
        // labelling both "Invalid JSON syntax" sent people hunting for a comma
        // that was not there — `setCustomTheme` throws with the real reason
        // (an unknown family, a structural change that needs a rebuild).
        setStatus('invalid')
        const message = cause instanceof Error ? cause.message : ''
        setError(
          message && !(cause instanceof SyntaxError)
            ? message
            : 'Invalid JSON syntax. Fix the JSON to apply changes.')
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
        <div className="config-editor__toolbar">
          <div className="config-editor__hint">
            Edit JSON to update UI live. UI changes also sync back here.
          </div>
          <div className="config-editor__buttons">
            <button
              type="button"
              onClick={handleReset}
              className="config-editor__button"
            >
              <RefreshCcw size={14} /> Reset
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="config-editor__button config-editor__button--primary"
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      }
    >
      <div className="config-editor">
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          aria-label="Theme runtime JSON editor"
          className={`config-editor__textarea${error ? ' is-invalid' : ''}`}
        />
        <div className={`config-editor__status${error ? ' is-invalid' : ''}`}>
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
