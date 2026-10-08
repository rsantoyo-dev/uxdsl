'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

// The home page's proof: an iframe whose width you drag across the theme's breakpoints.
//
// The page inside (public/paradigm-frame/, built by scripts/build-paradigm-frame.js) is the
// home page's example compiled by uxdsl. It is an iframe on purpose: UXDSL's breakpoints are
// viewport media queries, and an iframe is a viewport, so its rules follow the frame's width.
// It is drawn scaled down to fit the page; the scale does not change its layout width.
//
// The readout is read out of the frame's own computed style, not computed here: the value of
// --uxdsl__density__4 on its :root, the card's padding, the title's font size, and which of
// the theme's breakpoints match (the frame's matchMedia).

const MIN = 320
const MAX = 1440
const HEIGHT = 260
const SRC = '/paradigm-frame/index.html'

type Reading = { density: string; padding: string; fontSize: string; breakpoint: string }

export default function ParadigmFrame({ breakpoints, initialWidth = 390 }: { breakpoints: Record<string, number>; initialWidth?: number }) {
  const [width, setWidth] = useState(initialWidth)
  const [stage, setStage] = useState(0)
  const [reading, setReading] = useState<Reading | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const dragging = useRef(false)

  const ordered = useMemo(() => Object.entries(breakpoints).sort((a, b) => a[1] - b[1]), [breakpoints])
  const scale = stage ? Math.min(1, stage / MAX) : 0

  const read = useCallback(() => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    const win = frame?.contentWindow
    const card = doc?.querySelector('.card')
    const title = doc?.querySelector('.card h2')
    if (!doc || !win || !card || !title) return
    const matching = ordered.filter(([, px]) => win.matchMedia(`(min-width: ${px}px)`).matches)
    setReading({
      density: win.getComputedStyle(doc.documentElement).getPropertyValue('--uxdsl__density__4').trim(),
      padding: win.getComputedStyle(card).paddingTop,
      fontSize: win.getComputedStyle(title).fontSize,
      breakpoint: matching.length ? matching[matching.length - 1][0] : '',
    })
  }, [ordered])

  // The frame shows the site's current theme and mode: the managed theme stylesheet and the
  // data-theme attribute are mirrored into it whenever the header changes either.
  const syncTheme = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc || !doc.head) return
    const mode = document.documentElement.getAttribute('data-theme')
    if (mode) doc.documentElement.setAttribute('data-theme', mode)
    else doc.documentElement.removeAttribute('data-theme')
    const site = document.getElementById('uxdsl-ssr-theme')
    let mirror = doc.getElementById('site-theme')
    if (!mirror) {
      mirror = doc.createElement('style')
      mirror.id = 'site-theme'
      doc.head.appendChild(mirror)
    }
    mirror.textContent = site?.textContent || ''
    read()
  }, [read])

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setStage(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const site = document.getElementById('uxdsl-ssr-theme')
    if (site) observer.observe(site, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [syncTheme])

  // A width change re-lays out the frame; read once it has.
  useEffect(() => {
    const id = requestAnimationFrame(read)
    return () => cancelAnimationFrame(id)
  }, [width, scale, read])

  const widthAt = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || !scale) return width
    return Math.round(Math.min(MAX, Math.max(MIN, (clientX - rect.left) / scale)))
  }

  const active = reading?.breakpoint
  // The frame's geometry is the one dynamic thing here; it reaches the stylesheet as three
  // custom properties (ParadigmFrame.uxdsl does the arithmetic).
  const geometry = { '--frame-width': `${width}px`, '--frame-height': `${HEIGHT}px`, '--frame-scale': String(scale) } as CSSProperties
  return (
    <div className="paradigm-frame" style={geometry}>
      <div className="paradigm-frame__main">
      <div
        className="paradigm-frame__stage"
        ref={stageRef}
        onPointerMove={(event) => { if (dragging.current) setWidth(widthAt(event.clientX)) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerLeave={() => { dragging.current = false }}
      >
        <div className="paradigm-frame__viewport">
          <iframe
            ref={frameRef}
            src={SRC}
            title="A card compiled by UXDSL, inside a frame whose width you can drag"
            tabIndex={-1}
            className="paradigm-frame__iframe"
            onLoad={syncTheme}
          />
          <div
            className="paradigm-frame__handle"
            role="presentation"
            onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId) }}
            onPointerMove={(event) => { if (dragging.current) setWidth(widthAt(event.clientX)) }}
            onPointerUp={(event) => { dragging.current = false; event.currentTarget.releasePointerCapture(event.pointerId) }}
          />
        </div>
        <svg className="paradigm-frame__ticks" width={stage || 0} height={28} aria-hidden="true">
          {ordered.map(([name, px]) => (
            <g key={name} className={`paradigm-frame__tick ${active === name ? 'is-active' : ''}`}>
              <line x1={px * scale + 0.5} x2={px * scale + 0.5} y1={0} y2={8} />
              <text x={px * scale + 3} y={22}>{name} {px}</text>
            </g>
          ))}
        </svg>
      </div>
      <label className="paradigm-frame__control">
        <span className="paradigm-frame__control-label">Frame width</span>
        <input type="range" min={MIN} max={MAX} step={1} value={width} onChange={(event) => setWidth(Number(event.target.value))} aria-valuetext={`${width} pixels`} />
      </label>
      </div>
      <dl className="paradigm-frame__readout" data-testid="paradigm-readout" data-width={width} data-breakpoint={active || ''} data-density={reading?.density || ''} data-padding={reading?.padding || ''} data-font-size={reading?.fontSize || ''}>
        <div><dt>frame</dt><dd>{width}px</dd></div>
        <div><dt>breakpoint</dt><dd>{active ? `${active} (≥ ${breakpoints[active]}px)` : '…'}</dd></div>
        <div><dt><code>--uxdsl__density__4</code></dt><dd>{reading ? `${reading.density} = ${reading.padding}` : '…'}</dd></div>
        <div><dt><code>h2</code> font-size</dt><dd>{reading?.fontSize || '…'}</dd></div>
      </dl>
    </div>
  )
}
