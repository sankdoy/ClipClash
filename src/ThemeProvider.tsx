import React, { createContext, useEffect, useMemo, useState } from 'react'
import { applyCustomTheme, applyTheme, clearCustomTheme, ThemeMode, themePacks } from './theme'
import { getMe } from './utils/auth'

const STORAGE_THEME = 'cc_theme'
const STORAGE_CUSTOM = 'cc_custom_theme'
const STORAGE_BG_IMAGE = 'cc_bg_image'

type ThemeContextValue = {
  theme: string
  mode: ThemeMode
  setTheme: (theme: string) => void
  setMode: (mode: ThemeMode) => void
  customCss: string
  setCustomCss: (css: string) => void
  backgroundImage: string
  setBackgroundImage: (url: string) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'clash',
  mode: 'system',
  setTheme: () => undefined,
  setMode: () => undefined,
  customCss: '',
  setCustomCss: () => undefined,
  backgroundImage: '',
  setBackgroundImage: () => undefined
})

type SettingsResponse = {
  theme?: string
  mode?: ThemeMode
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_THEME)
    return storedTheme ?? 'clash'
  })
  const [mode, setMode] = useState<ThemeMode>(() => {
    return 'system'
  })
  const [customCss, setCustomCss] = useState(() => {
    const storedCustom = window.localStorage.getItem(STORAGE_CUSTOM)
    return storedCustom ?? ''
  })
  const [backgroundImage, setBackgroundImage] = useState(() => {
    const storedImage = window.localStorage.getItem(STORAGE_BG_IMAGE)
    return storedImage ?? ''
  })

  useEffect(() => {
    applyTheme(theme, mode)
    if (theme == 'custom' && customCss) {
      applyCustomTheme(customCss)
    } else {
      clearCustomTheme()
    }
    if (backgroundImage) {
      document.documentElement.style.setProperty('--bg-image', `url("${backgroundImage}")`)
    } else {
      document.documentElement.style.setProperty('--bg-image', 'none')
    }
    window.localStorage.setItem(STORAGE_THEME, theme)
    window.localStorage.setItem(STORAGE_CUSTOM, customCss)
    window.localStorage.setItem(STORAGE_BG_IMAGE, backgroundImage)
  }, [theme, mode, customCss, backgroundImage])

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
    backgroundImage,
    setTheme: (next: string) => {
      if (themePacks.find((pack) => pack.id === next)) setTheme(next)
    },
    setMode,
    setCustomCss,
    setBackgroundImage
  }), [theme, mode, customCss, backgroundImage])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
