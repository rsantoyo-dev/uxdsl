'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { applyTheme } from 'uxdsl/runtime'
import { deepMergeTheme, validateTheme } from 'uxdsl/theme'
import { createThemeScheduler } from '../lib/theme-scheduler'
import { themeDiff, themeFamilies } from '../lib/theme-download'
import { emptyStore, isGenericName, latestTheme, loadStore, nextId, nextName, persistStore, removeTheme, saveTheme, setActive } from '../lib/saved-themes'
import { baseTheme, themes } from '../../themes'

const { default: defaultTheme, green: greenTheme, purple: purpleTheme, slate: slateTheme } = themes

// The id `ThemeScript` renders server-side. `applyTheme` *adopts* an existing
// `<style>` with this id rather than creating a second one, which is what keeps
// hydration from ending up with two competing theme stylesheets.
const THEME_STYLE_ID = 'uxdsl-ssr-theme'

// MIG-B6-30 (FEAT-008): elements this provider used to manage and no longer
// does. `generateThemeCss` emits the Google Fonts `@import` itself (MIG-B6-29),
// so the hand-rolled <link> here was loading every family a second time, with
// its own weaker encoding. Only these exact ids are removed — a font link or
// style the rest of the app owns is left alone.
const RETIRED_ELEMENT_IDS = ['uxdsl-google-fonts', 'uxdsl-typography-theme', 'uxdsl-typo-overrides']

export type ThemeName = 'default' | 'green' | 'purple' | 'slate' | 'custom'
export type NamedTheme = Exclude<ThemeName, 'custom'>

/** A theme the visitor made, kept in this browser (src/lib/saved-themes.js). */
export interface SavedTheme {
  id: string
  name: string
  /** The named theme its first edit was made on. */
  origin: NamedTheme
  updatedAt: number
}

type SavedRecord = SavedTheme & { override: Record<string, unknown>; backgroundImage?: string }
type SavedStore = { version: number; active: string | null; themes: SavedRecord[] }

interface ThemeContextType {
  isDark: boolean
  currentTheme: ThemeName
  customThemeName: string | null
  /** The named theme the theme on the page started from: itself, or a saved theme's origin. */
  customThemeOrigin: NamedTheme
  /** Every theme made by editing, saved as it was edited. */
  savedThemes: SavedTheme[]
  /** The saved theme on the page, or null while a named theme is. */
  savedThemeId: string | null
  /** Puts a saved theme back on the page; false when it could not be applied (it is then removed). */
  openSavedTheme: (id: string) => boolean
  /** Forgets a saved theme; when it is on the page, the page goes back to the theme it started from. */
  removeSavedTheme: (id: string) => void
  backgroundImage: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeThemeData: any
  switchTheme: (theme: ThemeName) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCustomTheme: (name: string, themeData: any, options?: { replace?: boolean }) => void
  toggleDarkMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function retireOldManagedElements() {
  for (const id of RETIRED_ELEMENT_IDS) document.getElementById(id)?.remove()
}

/** The browser's storage, or null where it is refused (a private window, blocked site data). */
function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** A saved theme as the page applies it: its override over the base, as when it was edited. */
function savedThemeData(record: SavedRecord) {
  const theme = deepMergeTheme(baseTheme, record.override)
  return record.backgroundImage ? { ...theme, backgroundImage: record.backgroundImage } : theme
}

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('default')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customThemeData, setCustomThemeData] = useState<any>(null)
  const [customThemeName, setCustomThemeName] = useState<string | null>(null)
  // The saved themes. The ref is what an edit reads and writes at once; the state is what renders.
  const storeRef = useRef<SavedStore>(emptyStore())
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([])
  const [savedThemeId, setSavedThemeId] = useState<string | null>(null)
  // The saved theme last on the page: where the header's button returns to.
  const lastSavedRef = useRef<string | null>(null)
  const commitStore = (next: SavedStore) => {
    if (next === storeRef.current) return
    storeRef.current = next
    setSavedThemes(next.themes)
    const storage = browserStorage()
    if (storage) persistStore(storage, next)
  }
  const [backgroundImage, setBackgroundImage] = useState<string | null>('abstract purple curves')

  const activeThemeData = React.useMemo(() => {
    switch (currentTheme) {
      case 'purple': return purpleTheme;
      case 'green': return greenTheme;
      case 'slate': return slateTheme;
      case 'custom': return customThemeData || defaultTheme;
      case 'default': default: return defaultTheme;
    }
  }, [currentTheme, customThemeData]);

  /**
   * Applies a theme through the runtime and reports the outcome.
   *
   * `applyTheme` validates, generates, checks that the patch does not change
   * what the compiler would emit for already-compiled components, and only then
   * swaps the managed stylesheet. A failure leaves the previous CSS in place,
   * so there is no "last valid theme" to re-apply by hand any more — the
   * runtime simply never moved.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyThemeNow = React.useCallback((theme: any) => {
    const result = applyTheme(theme, { replace: true, styleId: THEME_STYLE_ID })
    if (result.ok) {
      retireOldManagedElements()
      if (result.warnings.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('UXDSL theme warnings:', result.warnings)
      }
    } else {
      // eslint-disable-next-line no-console
      console.error('UXDSL theme rejected; the applied theme was kept:', result.error.message)
    }
    return result
  }, [])

  // Rapid editors — a dragged colour picker, a spacing slider — call
  // `setCustomTheme` on every input event. Coalescing those into one
  // application per frame happens here, deliberately outside `applyTheme`,
  // which stays synchronous and un-batched. React state is updated from the
  // scheduler's callback, *after* the CSS commit succeeded.
  // MIG-B7-09 (FEAT-009): the outcome of the last application. The frame callback
  // below reads it to decide whether the edit may reach React state at all.
  const lastApplyRef = useRef<{ ok: boolean } | null>(null)
  const schedulerRef = useRef<ReturnType<typeof createThemeScheduler> | null>(null)
  if (schedulerRef.current === null) {
    schedulerRef.current = createThemeScheduler({
      apply: applyThemeNow,
      merge: deepMergeTheme,
      onResult: (result: { ok: boolean }) => { lastApplyRef.current = result },
    })
  }
  const pendingCustomRef = useRef<{ id: string; name: string; origin: NamedTheme; theme: unknown } | null>(null)

  useEffect(() => {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' ||
                       (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
  }, [])

  // Initialization: hand the runtime the theme this project was built and
  // server-rendered with, once, before anything can patch it. That call also
  // establishes the structure every later patch is checked against.
  const scheduler = schedulerRef.current
  useEffect(() => {
    applyThemeNow(defaultTheme)
    // Then what this browser saved: the list, and the saved theme that was on the page.
    const storage = browserStorage()
    if (storage) {
      const stored = loadStore(storage) as SavedStore
      storeRef.current = stored
      setSavedThemes(stored.themes)
      if (stored.active) openSavedTheme(stored.active)
    }
    return () => { scheduler?.cancel() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openSavedTheme = (id: string) => {
    // A queued edit from the theme being left must not land on this one.
    scheduler?.cancel()
    pendingCustomRef.current = null
    const record = storeRef.current.themes.find((theme) => theme.id === id)
    if (!record) return false
    const theme = savedThemeData(record)
    // Saved by an earlier build of the site, a theme may no longer be one it can apply.
    if (!validateTheme(themeFamilies(theme)).ok || !applyThemeNow(theme).ok) {
      commitStore(removeTheme(storeRef.current, id))
      return false
    }
    setCustomThemeData(theme)
    setCustomThemeName(record.name)
    setSavedThemeId(id)
    lastSavedRef.current = id
    if (record.backgroundImage) setBackgroundImage(record.backgroundImage)
    setCurrentTheme('custom')
    commitStore(setActive(storeRef.current, id))
    return true
  }

  const removeSavedTheme = (id: string) => {
    const record = storeRef.current.themes.find((theme) => theme.id === id)
    if (!record) return
    if (savedThemeId === id) switchTheme(record.origin)
    if (lastSavedRef.current === id) lastSavedRef.current = null
    commitStore(removeTheme(storeRef.current, id))
  }

  const switchTheme = (themeName: ThemeName) => {
    if (themeName === 'custom') {
      // Back to the saved theme last on the page, or the one edited last.
      const stored = storeRef.current.themes
      const back = stored.find((theme) => theme.id === lastSavedRef.current) ?? latestTheme(stored)
      if (back && currentTheme !== 'custom') openSavedTheme(back.id)
      return
    }
    // A queued edit from the theme being left must not land on the new one.
    scheduler?.cancel()
    pendingCustomRef.current = null

    let themeToApply;
    let nextBackground: string | null = null
    switch (themeName) {
      case 'purple':
        themeToApply = purpleTheme;
        nextBackground = 'abstract purple curves';
        break;
      case 'green':
        themeToApply = greenTheme;
        nextBackground = 'nature forest texture';
        break;
      case 'slate':
        themeToApply = slateTheme;
        nextBackground = 'abstract geometric shapes';
        break;
      case 'default': default:
        themeToApply = defaultTheme;
        nextBackground = 'abstract purple curves';
        break;
    }

    if (!themeToApply) return
    // Apply first, reflect in React only once it really landed: a rejected
    // theme must not leave the UI claiming a theme that is not on the page.
    if (!applyThemeNow(themeToApply).ok) return
    if (nextBackground) setBackgroundImage(nextBackground)
    // Leaving a saved theme keeps it saved, and forgets its name here, so a later edit is
    // not filed under it: an edit on a named theme starts a new saved theme.
    setCustomThemeName(null)
    setSavedThemeId(null)
    setCurrentTheme(themeName)
    commitStore(setActive(storeRef.current, null))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setCustomTheme = (name: string, themeData: any, options?: { replace?: boolean }) => {
    // Edits layer over the active theme; replace resets overrides to the common base.
    // MIG-B7-09: an edit still waiting for its frame is part of what this one layers
    // over. `activeThemeData` only catches up when the frame commits, so two
    // independent edits inside one frame (a colour and a spacing value) were each
    // built from the same stale theme and the first one was lost.
    const base = options?.replace ? baseTheme : (pendingCustomRef.current?.theme || activeThemeData || defaultTheme)
    const merged = deepMergeTheme(base, themeData || {})

    const checked = validateTheme(merged)
    if (!checked.ok) throw new Error(checked.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))

    // Which saved theme this edit belongs to. The one on the page (an edit still waiting
    // for its frame included) when the editor passes no name of its own, or its name; a
    // saved theme of that name otherwise; and a new one when there is neither, which is
    // what an edit on a named theme makes.
    const stored = storeRef.current.themes
    const onPage = pendingCustomRef.current
      ?? (currentTheme === 'custom' && savedThemeId ? { id: savedThemeId, name: customThemeName, origin: customThemeOrigin } : null)
    const generic = isGenericName(name)
    const target = generic || onPage?.name === name ? onPage : (stored.find((theme) => theme.name === name) ?? null)
    const origin: NamedTheme = options?.replace && !generic
      ? 'default'
      : (onPage?.origin ?? (currentTheme === 'custom' ? 'default' : currentTheme))

    pendingCustomRef.current = {
      id: target?.id ?? nextId(stored),
      name: target?.name ?? (generic ? nextName(stored) : name),
      origin,
      theme: merged,
    }
    // Queued rather than applied inline, so sixty picker events in a second
    // generate one stylesheet instead of sixty. The React state below is set
    // from the frame callback, after the commit.
    scheduler?.schedule(merged)
    const commit = () => {
      const pending = pendingCustomRef.current
      if (!pending) return
      pendingCustomRef.current = null
      // MIG-B7-09: reflect an edit in React only once the runtime accepted it. A
      // refused edit leaves the previous CSS on the page (applyTheme guarantees
      // it), so claiming "custom" here made the UI disagree with the page — and
      // stored the refused theme as the base every later edit layered over, so
      // one refusal made all the following edits refuse too.
      if (lastApplyRef.current && !lastApplyRef.current.ok) return
      setCustomThemeData(pending.theme)
      setCustomThemeName(pending.name)
      setSavedThemeId(pending.id)
      lastSavedRef.current = pending.id
      if (themeData?.backgroundImage) setBackgroundImage(themeData.backgroundImage)
      setCurrentTheme('custom')
      // Saved the moment it is on the page, as what differs from the base theme.
      commitStore(saveTheme(storeRef.current, {
        id: pending.id,
        name: pending.name,
        origin: pending.origin,
        override: themeDiff(themeFamilies(baseTheme), themeFamilies(pending.theme)),
        backgroundImage: (pending.theme as { backgroundImage?: string }).backgroundImage,
        now: Date.now(),
      }) as SavedStore)
    }
    // `schedule` applies immediately when there is no frame scheduler, so the
    // commit has to follow the same rule rather than assume a frame exists.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(commit)
    else commit()
  }

  const customThemeOrigin: NamedTheme = currentTheme === 'custom'
    ? (savedThemes.find((theme) => theme.id === savedThemeId)?.origin ?? 'default')
    : currentTheme

  const toggleDarkMode = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    document.documentElement.setAttribute('data-theme', newIsDark ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ isDark, currentTheme, customThemeName, customThemeOrigin, savedThemes, savedThemeId, openSavedTheme, removeSavedTheme, backgroundImage, activeThemeData, switchTheme, setCustomTheme, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeContextProvider')
  }
  return context
}
