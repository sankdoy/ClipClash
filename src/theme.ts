export type ThemeMode = 'light' | 'dark' | 'system'

export type ThemePack = {
  id: string
  label: string
}

export const themePacks: ThemePack[] = [
  { id: 'clash', label: 'Clash Orange' },
  { id: 'neon', label: 'Neon Mint' },
  { id: 'sunset', label: 'Sunset Coral' },
  { id: 'mono', label: 'Mono Ink' },
  { id: 'custom', label: 'Custom CSS' }
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


export function applyCustomTheme(css: string) {
  const id = 'cc-custom-theme'
  let style = document.getElementById(id) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.appendChild(style)
  }
  style.textContent = css
}

export function clearCustomTheme() {
  const style = document.getElementById('cc-custom-theme')
  if (style) style.remove()
}
