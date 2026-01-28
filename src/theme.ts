import type { ThemeMode } from '../shared/theme'
import { themePacks } from '../shared/theme'

export type { ThemeMode }
export { themePacks }

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
