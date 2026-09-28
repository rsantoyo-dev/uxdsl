// MIG-B7-17 (FEAT-009), phase C: the script of the runtime sandbox.
//
// Some runtime functions change global state — the theme a document has applied, inline
// custom properties on <html>, the compiled media queries of every tagged stylesheet. Called
// on the site itself they would fight ThemeContext and the breakpoint adapter, which manage
// that state for the whole playground. So the /docs/runtime page runs them here: this file is
// bundled on its own (scripts/build-runtime-sandbox.js) and loaded in an iframe, which is a
// separate document AND a separate JavaScript realm, with its own copy of the runtime's
// module state. Nothing done in the sandbox reaches the site; reloading the iframe undoes it.
//
// The functions are the real exports of postcss-uxdsl/ds-runtime; the page drives them
// through `window.__uxdslLab` and reads back what the sandbox's own computed styles say.
import {
  applyTheme,
  getAppliedTheme,
  resetTheme,
  loadPersistedTheme,
  subscribeTheme,
  updatePalette,
  getPalette,
  resetPalette,
  updateColor,
  updateSpacing,
  subscribe,
  updateBreakpoint,
  getBreakpoints,
} from 'postcss-uxdsl/ds-runtime'
import { themes } from '../../themes'

/** The key this lab persists under. Never the default `uxdsl:theme`, and the legacy
 * migration is always turned off: the site's own demos still write the four pre-beta.6
 * keys, and a default `loadPersistedTheme()` would migrate — and then delete — them. */
export const LAB_STORAGE_KEY = 'uxdsl-playground:runtime-lab'

type LogEntry = { source: 'subscribeTheme' | 'subscribe'; detail: string }

const events: LogEntry[] = []
subscribeTheme((override) => {
  events.push({ source: 'subscribeTheme', detail: `applied; palette.primary.main = ${override?.palette?.primary?.main ?? '(inherited)'}` })
})
subscribe((event) => {
  events.push({ source: 'subscribe', detail: `${event.type}: ${JSON.stringify(event.detail)}` })
})

function probe() {
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element)
  const inline: string[] = []
  for (let i = 0; i < root.style.length; i++) inline.push(`${root.style.item(i)}: ${root.style.getPropertyValue(root.style.item(i)).trim()}`)
  return {
    width: window.innerWidth,
    primaryMain: cs.getPropertyValue('--uxdsl__palette__primary-main').trim(),
    paletteSwatch: style('.lab-swatch--palette').backgroundColor,
    colorSwatch: style('.lab-swatch--color').backgroundColor,
    spacePadding: style('.lab-box--space').paddingTop,
    densityPadding: style('.lab-box--density').paddingTop,
    layoutDirection: style('.lab-layout').flexDirection,
    legacyBreakpoints: getBreakpoints(),
    appliedPrimary: getAppliedTheme()?.palette?.primary?.main ?? null,
    appliedMd: getAppliedTheme()?.breakpoints?.md ?? null,
    inline,
  }
}

const lab = {
  projectOverride: themes.default,
  storageKey: LAB_STORAGE_KEY,
  api: {
    applyTheme,
    getAppliedTheme,
    resetTheme,
    loadPersistedTheme,
    updatePalette,
    getPalette,
    resetPalette,
    updateColor,
    updateSpacing,
    updateBreakpoint,
    getBreakpoints,
  },
  probe,
  /** Events the two subscriptions received since the last call. */
  drainEvents(): LogEntry[] { return events.splice(0) },
}

declare global {
  interface Window { __uxdslLab?: typeof lab }
}

window.__uxdslLab = lab

export type UxdslLab = typeof lab
