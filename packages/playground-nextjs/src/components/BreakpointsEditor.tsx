'use client'

import { useEffect, useState } from 'react'
import { Copy, RefreshCcw } from 'lucide-react'
import { useBreakpoints, type Breakpoints } from './BreakpointsProvider'
import { InteractiveDemoContainer } from './InteractiveDemoContainer'
import { checkPreview, changedBreakpoints } from '../lib/breakpoint-preview'

// Every slider shares one scale, so the thumbs line up like a ruler of the breakpoints.
const SCALE_MAX = 1920

/** The breakpoint a width falls in: the widest one at or below it. */
function activeAt(map: Breakpoints, width: number) {
  return Object.keys(map).sort((a, b) => map[a] - map[b]).filter((name) => map[name] <= width).pop() ?? null
}

/**
 * Moves the page's breakpoints live, as a preview of a theme edit (BreakpointsProvider rewrites
 * the compiled media rules). The theme file is not changed: the JSON below is what to write in it.
 */
export default function BreakpointsEditor() {
  const { breakpoints, compiled, preview, setPreview, movedRules } = useBreakpoints()
  const names = Object.keys(compiled).sort((a, b) => compiled[a] - compiled[b])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const read = () => setViewport(window.innerWidth)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  // A slider stops at its neighbours; a typed width that crosses one is refused with the reason.
  const move = (name: string, requested: number, clamp = false) => {
    const index = names.indexOf(name)
    const low = index > 0 ? breakpoints[names[index - 1]] + 1 : 0
    const high = index < names.length - 1 ? breakpoints[names[index + 1]] - 1 : Infinity
    const width = clamp ? Math.min(Math.max(requested, low), high) : requested
    const next = { ...breakpoints, [name]: width }
    const problem = checkPreview(compiled, next)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setDrafts((d) => ({ ...d, [name]: String(width) }))
    const changed = changedBreakpoints(compiled, next)
    setPreview(Object.keys(changed).length ? next : null)
  }

  const reset = () => {
    setPreview(null)
    setDrafts({})
    setError(null)
  }

  const changed = changedBreakpoints(compiled, breakpoints)
  const json = JSON.stringify({ breakpoints: changed }, null, 2)
  const hasChanges = Object.keys(changed).length > 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('The browser did not allow copying; select the JSON and copy it.')
    }
  }

  const active = viewport === null ? null : activeAt(breakpoints, viewport)

  return (
    <InteractiveDemoContainer
      title="Breakpoints"
      toolbar={
        <div className="bpe__toolbar">
          <span className="bpe__status" role="status">
            {preview
              ? `Previewing on this page: ${movedRules} media rule${movedRules === 1 ? '' : 's'} moved.`
              : 'The page uses the breakpoints it was compiled with.'}
          </span>
          <button type="button" className="bpe__button" onClick={reset} disabled={!preview}>
            <RefreshCcw size={14} /> Reset
          </button>
        </div>
      }
    >
      <div className="bpe">
        <p className="bpe__viewport">
          Your window: <strong>{viewport ?? '…'}px</strong>
          {active && <> → <code>{active}</code></>}. Resize it, or move a breakpoint past it, and the page switches.
        </p>

        <div className="bpe__rows">
          {names.map((name, index) => {
            const width = breakpoints[name]
            const isBase = compiled[name] === 0
            return (
              <div key={name} className={`bpe__row${active === name ? ' is-active' : ''}`}>
                <span className={`bpe__key bpe__key--${index % 5}`} aria-hidden="true" />
                <code className="bpe__name">{name}</code>
                {isBase ? (
                  <span className="bpe__base">0px: the base, always 0</span>
                ) : (
                  <>
                    <input
                      type="range"
                      className="bpe__slider"
                      aria-label={`${name} width in px`}
                      min={0}
                      max={Math.max(SCALE_MAX, width)}
                      step={1}
                      value={width}
                      onChange={(event) => move(name, Number(event.target.value), true)}
                    />
                    <span className="bpe__number">
                      <input
                        type="number"
                        className="bpe__input"
                        aria-label={`${name} width in px, typed`}
                        value={drafts[name] ?? String(width)}
                        onChange={(event) => setDrafts((d) => ({ ...d, [name]: event.target.value }))}
                        onBlur={(event) => move(name, Number(event.target.value))}
                        onKeyDown={(event) => { if (event.key === 'Enter') move(name, Number((event.target as HTMLInputElement).value)) }}
                      />
                      px
                    </span>
                    <span className={`bpe__compiled${width !== compiled[name] ? ' is-moved' : ''}`}>
                      {width !== compiled[name] ? `compiled ${compiled[name]}px` : 'as compiled'}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="bpe__error" role="alert">{error}</p>}

        <div className="bpe__result">
          <div className="bpe__result-head">
            <span>For your <code>uxdsl.theme.json</code>, then rebuild:</span>
            <button type="button" className="bpe__button" onClick={copy} disabled={!hasChanges}>
              <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {hasChanges
            ? <pre className="bpe__json"><code>{json}</code></pre>
            : <p className="bpe__empty">No change yet: move a breakpoint and its JSON appears here.</p>}
        </div>

        <p className="bpe__note">
          A preview, not a theme change: the theme cannot move a breakpoint at run time, because every <code>md()</code> and{' '}
          <code>@media (--md)</code> is already compiled to a <code>min-width</code> query. The preview moves those compiled rules on
          this page. A hand-written <code>min-width</code> equal to a breakpoint’s compiled width moves with it, and a reload brings back
          the compiled widths.
        </p>
      </div>
    </InteractiveDemoContainer>
  )
}
