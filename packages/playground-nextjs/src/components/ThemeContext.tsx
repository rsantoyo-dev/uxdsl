'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { applyTheme, deepMergeTheme, validateAndNormalizeTheme } from 'postcss-uxdsl/ds-runtime'
import { createThemeScheduler } from '../lib/theme-scheduler'
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

interface ThemeContextType {
  isDark: boolean
  currentTheme: ThemeName
  customThemeName: string | null
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

/**
 * Clears the inline custom properties the *old* per-token setters wrote on
 * `<html>`.
 *
 * `updatePalette`/`updateColor`/`updateSpacing` set them with
 * `documentElement.style.setProperty`, and an inline declaration beats any
 * `:root` rule — so a value left over from one theme would keep covering the
 * stylesheet after switching to another. Only `--uxdsl__*` properties are
 * removed, because those are the ones this runtime owns; anything else the app
 * or a demo put inline is left exactly where it is.
 */
function clearRuntimeInlineTokens() {
  const style = document.documentElement.style
  const owned: string[] = []
  for (let i = 0; i < style.length; i++) {
    const property = style.item(i)
    if (property.startsWith('--uxdsl__')) owned.push(property)
  }
  owned.forEach((property) => style.removeProperty(property))
}

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('default')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customThemeData, setCustomThemeData] = useState<any>(null)
  const [customThemeName, setCustomThemeName] = useState<string | null>(null)
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
      clearRuntimeInlineTokens()
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
  const pendingCustomRef = useRef<{ name: string; theme: unknown } | null>(null)

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
    return () => { scheduler?.cancel() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchTheme = (themeName: ThemeName) => {
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
      case 'custom':
        themeToApply = customThemeData;
        if (customThemeData?.backgroundImage) nextBackground = customThemeData.backgroundImage;
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
    setCurrentTheme(themeName)
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

    const checked = validateAndNormalizeTheme(merged)
    if (!checked.ok) throw new Error(checked.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))

    pendingCustomRef.current = { name, theme: merged }
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
      if (themeData?.backgroundImage) setBackgroundImage(themeData.backgroundImage)
      setCurrentTheme('custom')
    }
    // `schedule` applies immediately when there is no frame scheduler, so the
    // commit has to follow the same rule rather than assume a frame exists.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(commit)
    else commit()
  }

  const toggleDarkMode = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    document.documentElement.setAttribute('data-theme', newIsDark ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ isDark, currentTheme, customThemeName, backgroundImage, activeThemeData, switchTheme, setCustomTheme, toggleDarkMode }}>
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
