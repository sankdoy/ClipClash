export type ThemeMode = 'light' | 'dark' | 'system'

export type ThemePack = {
  id: string
  label: string
}

export const themePacks: ThemePack[] = [
  { id: 'clash', label: 'Clash Orange' },
  { id: 'neon', label: 'Neon Mint' },
  { id: 'sunset', label: 'Sunset Coral' },
  { id: 'mono', label: 'Mono Ink' }
]

export function resolveMode(mode: ThemeMode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function applyTheme(theme: string, mode: ThemeMode) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.mode = resolveMode(mode)
}
