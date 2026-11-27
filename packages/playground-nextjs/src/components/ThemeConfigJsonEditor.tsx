'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { validateTheme } from 'uxdsl/theme'
import schema from 'uxdsl/schema/theme.schema.json'
import type { Content, OnChangeStatus, createJSONEditor as CreateJSONEditor } from 'vanilla-jsoneditor'
import { useTheme } from './ThemeContext'
import { useBreakpoints } from './BreakpointsProvider'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { splitThemeEdit, withBreakpoints } from '../lib/breakpoint-preview'
import UsageExample from './UsageExample'
import { projectUsage } from '../lib/usage-snippets'

type JSONEditor = ReturnType<typeof CreateJSONEditor>

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

/** The JSON a Content holds, or a SyntaxError for text that does not parse. */
function jsonOf(content: Content): unknown {
  return 'json' in content && content.json !== undefined ? content.json : JSON.parse((content as { text: string }).text)
}

/**
 * The active theme as a JSON tree (vanilla-jsoneditor): every family expands and collapses,
 * values are edited in place, and the editor checks each edit against the packaged theme
 * schema as you type. A valid edit is applied through `setCustomTheme` (ThemeContext →
 * applyTheme), the same path as the other tabs, so they and the page follow it.
 *
 * The download above the tabs (ThemeDownload) saves what this tree shows as a project's
 * uxdsl.theme.json.
 *
 * Breakpoints are the exception: applyTheme refuses them, so the tree shows the Breakpoints
 * tab's preview, and a moved width here moves that preview (BreakpointsProvider) instead.
 */
export default function ThemeConfigJsonEditor() {
  const { activeThemeData: appliedTheme, setCustomTheme, customThemeName } = useTheme()
  const { breakpoints, compiled, preview, setPreview } = useBreakpoints()
  // What the page uses: the applied theme with the previewed breakpoints, if any.
  const activeThemeData = useMemo(() => withBreakpoints(appliedTheme, breakpoints), [appliedTheme, breakpoints])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'synced' | 'invalid'>('loading')

  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<JSONEditor | null>(null)
  const lastAppliedRef = useRef<string>('')
  const syncTimeoutRef = useRef<number | null>(null)
  // The latest values for the editor's callbacks, which are created once.
  const latest = useRef({ setCustomTheme, customThemeName, activeThemeData, appliedTheme, compiled, setPreview })
  latest.current = { setCustomTheme, customThemeName, activeThemeData, appliedTheme, compiled, setPreview }

  // Apply an edit 500ms after the last keystroke, if it parses and the validator accepts it.
  const scheduleApply = (content: Content, contentErrors: OnChangeStatus['contentErrors']) => {
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current)
    if (contentErrors && 'parseError' in contentErrors) {
      setStatus('invalid')
      setError(`Invalid JSON: ${contentErrors.parseError.message}`)
      return
    }
    syncTimeoutRef.current = window.setTimeout(() => {
      try {
        const validated = validateTheme(jsonOf(content) as never)
        if (!validated.ok) {
          const first = validated.errors[0]
          setStatus('invalid')
          setError(typeof first === 'string' ? first : first ? `${first.path}: ${first.message}` : 'Invalid theme JSON.')
          return
        }
        // The breakpoints go to the preview; the rest, with the compiled breakpoints, to applyTheme.
        const { compiled: built, appliedTheme: applied } = latest.current
        const split = splitThemeEdit(built, validated.theme)
        if (split.error || !split.theme) {
          setStatus('invalid')
          setError(split.error ?? 'Invalid breakpoints.')
          return
        }
        lastAppliedRef.current = prettyJson(validated.theme)
        setError(null)
        setStatus('synced')
        if (prettyJson(split.theme) !== prettyJson(applied)) {
          latest.current.setCustomTheme(latest.current.customThemeName || 'Custom Theme', split.theme)
        }
        latest.current.setPreview(split.preview)
      } catch (cause) {
        // setCustomTheme throws with the real reason (an unknown family, a structural change
        // that needs a rebuild); keep it rather than calling everything a syntax error.
        setStatus('invalid')
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    }, 500)
  }

  // Create the editor once, in the browser only: it is loaded with the tab, not with the page.
  useEffect(() => {
    let cancelled = false
    let editor: JSONEditor | null = null
    import('vanilla-jsoneditor').then(({ createJSONEditor, createAjvValidator, Mode }) => {
      if (cancelled || !hostRef.current) return
      const theme = latest.current.activeThemeData
      lastAppliedRef.current = prettyJson(theme)
      editor = createJSONEditor({
        target: hostRef.current,
        props: {
          content: { json: theme },
          mode: Mode.tree,
          validator: createAjvValidator({ schema: schema as never }),
          onChange: (content: Content, _previous: Content, { contentErrors }: OnChangeStatus) => scheduleApply(content, contentErrors),
        },
      })
      // Open on the families, each collapsed: expand one to edit it.
      editor.expand([], (path: readonly unknown[]) => path.length < 1)
      editorRef.current = editor
      setStatus('synced')
    })
    return () => {
      cancelled = true
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current)
      editorRef.current = null
      editor?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A change made elsewhere (the Palette tab, another theme, a reset) shows here. MIG-B6-30
  // (FEAT-008): an edit still waiting on the debounce is dropped first, so it cannot land on
  // the theme the user just switched to.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const next = prettyJson(activeThemeData)
    if (next === lastAppliedRef.current) return
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current)
      syncTimeoutRef.current = null
    }
    lastAppliedRef.current = next
    editor.update({ json: activeThemeData })
    setError(null)
    setStatus('synced')
  }, [activeThemeData])

  const handleReset = () => {
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current)
    lastAppliedRef.current = prettyJson(activeThemeData)
    editorRef.current?.update({ json: activeThemeData })
    setError(null)
    setStatus('synced')
  }

  const usage = useMemo(() => projectUsage(activeThemeData), [activeThemeData])
  return (
    <InteractiveDemoContainer
      title="Runtime Config JSON"
      toolbar={
        <div className="config-editor__toolbar">
          <div className="config-editor__hint">
            Expand a family to edit it; the page follows each valid edit. Tree, text and table views are in the editor’s menu.
          </div>
          <div className="config-editor__buttons">
            <button type="button" onClick={handleReset} className="config-editor__button">
              <RefreshCcw size={14} /> Reset
            </button>
          </div>
        </div>
      }
    >
      <div className="config-editor">
        <div ref={hostRef} className={`config-editor__tree${error ? ' is-invalid' : ''}`} aria-label="Theme runtime JSON editor" />
        <div className={`config-editor__status${error ? ' is-invalid' : ''}`} role="status">
          {error
            ? error
            : status === 'loading'
              ? 'Loading the editor…'
              : preview
                ? 'Synced with runtime theme. Its breakpoints are a preview on this page (Breakpoints tab).'
                : 'Synced with runtime theme.'}
        </div>
      </div>
      <UsageExample
        note={<>From this page to your project in three steps: save the theme (the download bar above writes this file), write the marker once in your global stylesheet, build. Components never change when the theme does.</>}
        blocks={[
          { label: '1 · uxdsl.theme.json, next to uxdsl.config.cjs', code: usage.file },
          { label: '2 · Your global stylesheet', code: usage.stylesheet },
          { label: '3 · Build', code: usage.build },
          { label: 'Or apply it in the browser', code: usage.runtime },
        ]}
      />
    </InteractiveDemoContainer>
  )
}
