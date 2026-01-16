import React, { createContext, useEffect, useMemo, useState } from 'react'
import { applyCustomTheme, applyTheme, clearCustomTheme, ThemeMode, themePacks } from './theme'
import { getMe } from './utils/auth'

const STORAGE_THEME = 'cc_theme'
const STORAGE_MODE = 'cc_mode'
const STORAGE_CUSTOM = 'cc_custom_theme'

type ThemeContextValue = {
  theme: string
  mode: ThemeMode
  setTheme: (theme: string) => void
  setMode: (mode: ThemeMode) => void
  customCss: string
  setCustomCss: (css: string) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'clash',
  mode: 'system',
  setTheme: () => undefined,
  setMode: () => undefined,
  customCss: '',
  setCustomCss: () => undefined
})

type SettingsResponse = {
  theme?: string
  mode?: ThemeMode
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('clash')
  const [mode, setMode] = useState<ThemeMode>('system')
  const [customCss, setCustomCss] = useState('')

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_THEME)
    const storedMode = window.localStorage.getItem(STORAGE_MODE) as ThemeMode | null
    const storedCustom = window.localStorage.getItem(STORAGE_CUSTOM)
    if (storedTheme) setTheme(storedTheme)
    if (storedMode) setMode(storedMode)
    if (storedCustom) setCustomCss(storedCustom)
  }, [])

  useEffect(() => {
    applyTheme(theme, mode)
    if (theme == 'custom' && customCss) {
      applyCustomTheme(customCss)
    } else {
      clearCustomTheme()
    }
    window.localStorage.setItem(STORAGE_THEME, theme)
    window.localStorage.setItem(STORAGE_MODE, mode)
    window.localStorage.setItem(STORAGE_CUSTOM, customCss)
  }, [theme, mode, customCss])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(theme, mode)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme, mode])

  useEffect(() => {
    getMe().then((data) => {
      if (!data?.user) return
      fetch('/api/settings')
        .then((res) => res.ok ? res.json() : null)
        .then((settings: SettingsResponse | null) => {
          if (!settings) return
          if (settings.theme) setTheme(settings.theme)
          if (settings.mode) setMode(settings.mode)
        })
        .catch(() => undefined)
    })
  }, [])

  const value = useMemo(() => ({
    theme,
    mode,
    customCss,
    setTheme: (next: string) => {
      if (themePacks.find((pack) => pack.id === next)) setTheme(next)
    },
    setMode,
    setCustomCss
  }), [theme, mode, customCss])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
