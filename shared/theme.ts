export type ThemeMode = 'light' | 'dark' | 'system'

export type ThemePack = {
  id: string
  label: string
}

export const themePacks: ThemePack[] = [
  { id: 'neonTikTok', label: 'Neon TikTok' },
  { id: 'clash', label: 'Classic' },
  { id: 'neon', label: 'Neon Mint' },
  { id: 'sunset', label: 'Sunset Coral' },
  { id: 'mono', label: 'Mono Ink' },
  { id: 'custom', label: 'Custom CSS' }
]
