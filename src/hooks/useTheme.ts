import { useCallback, useEffect, useRef, useState } from 'react'
import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { getStoredThemePref, setStoredThemePref, type ThemePref } from '../theme/theme'
import { writeColorVars, type ResolvedTheme } from '../theme/categories'

const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#F4F1EA',
  dark: '#14120F',
}

function resolveTheme(pref: ThemePref, prefersDarkOS: boolean): ResolvedTheme {
  if (pref === 'auto') return prefersDarkOS ? 'dark' : 'light'
  return pref
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = resolved
  writeColorVars(root, resolved)

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = THEME_COLOR[resolved]

  // SystemBarsPluginWeb.setStyle() throw systématiquement (plugin natif-only,
  // cf. CLAUDE.md) — sans .catch() ça remonte en unhandled rejection sous
  // `npm run dev`.
  SystemBars.setStyle({ style: resolved === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
}

export interface UseThemeResult {
  themePref: ThemePref
  resolvedTheme: ResolvedTheme
  setThemePref: (pref: ThemePref) => Promise<void>
}

export function useTheme(): UseThemeResult {
  const [themePref, setThemePrefState] = useState<ThemePref>('auto')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const themePrefRef = useRef(themePref)
  themePrefRef.current = themePref

  useEffect(() => {
    let cancelled = false
    getStoredThemePref().then((pref) => {
      if (cancelled) return
      setThemePrefState(pref)
      const prefersDarkOS = window.matchMedia('(prefers-color-scheme: dark)').matches
      const resolved = resolveTheme(pref, prefersDarkOS)
      setResolvedTheme(resolved)
      applyTheme(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (themePrefRef.current !== 'auto') return
      const resolved = resolveTheme('auto', e.matches)
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setThemePref = useCallback(async (pref: ThemePref) => {
    setThemePrefState(pref)
    await setStoredThemePref(pref)
    const prefersDarkOS = window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolved = resolveTheme(pref, prefersDarkOS)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  return { themePref, resolvedTheme, setThemePref }
}
