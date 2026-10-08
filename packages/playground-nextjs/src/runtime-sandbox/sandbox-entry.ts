// MIG-B7-17 (FEAT-009), phase C: the script of the runtime sandbox.
//
// Some runtime functions change global state — the theme a document has applied. Called
// on the site itself they would fight ThemeContext, which manages that state for the whole
// playground. So the /docs/runtime page runs them here: this file is bundled on its own
// (scripts/build-runtime-sandbox.js) and loaded in an iframe, which is a separate document
// AND a separate JavaScript realm, with its own copy of the runtime's module state. Nothing
// done in the sandbox reaches the site; reloading the iframe undoes it.
//
// The functions are the real exports of uxdsl/runtime; the page drives them
// through `window.__uxdslLab` and reads back what the sandbox's own computed styles say.
import {
  applyTheme,
  getAppliedTheme,
  resetTheme,
  loadPersistedTheme,
  subscribeTheme,
} from 'uxdsl/runtime'
import { themes } from '../../themes'

/** The key this lab persists under. Never the default `uxdsl:theme`, so a saved lab
 * override cannot be mistaken for the site's own. */
export const LAB_STORAGE_KEY = 'uxdsl-playground:runtime-lab'

type LogEntry = { source: 'subscribeTheme'; detail: string }

const events: LogEntry[] = []
subscribeTheme((override) => {
  events.push({ source: 'subscribeTheme', detail: `applied; palette.primary.main = ${override?.palette?.primary?.main ?? '(inherited)'}` })
})

function probe() {
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element)
  return {
    width: window.innerWidth,
    primaryMain: cs.getPropertyValue('--uxdsl__palette__primary-main').trim(),
    paletteSwatch: style('.lab-swatch--palette').backgroundColor,
    colorSwatch: style('.lab-swatch--color').backgroundColor,
    spacePadding: style('.lab-box--space').paddingTop,
    densityPadding: style('.lab-box--density').paddingTop,
    layoutDirection: style('.lab-layout').flexDirection,
    appliedPrimary: getAppliedTheme()?.palette?.primary?.main ?? null,
    appliedMd: getAppliedTheme()?.breakpoints?.md ?? null,
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
  },
  probe,
  /** Events the subscription received since the last call. */
  drainEvents(): LogEntry[] { return events.splice(0) },
}

declare global {
  interface Window { __uxdslLab?: typeof lab }
}

window.__uxdslLab = lab

export type UxdslLab = typeof lab
