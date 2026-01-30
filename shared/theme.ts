export type ThemeMode = 'light' | 'dark' | 'system'

export type ThemePack = {
  id: string
  label: string
}

export const themePacks: ThemePack[] = [
  { id: 'clash', label: 'Default' },
  { id: 'neonTikTok', label: 'Neon' },
  { id: 'neon', label: 'Mint' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' },
  { id: 'royal', label: 'Royal' },
  { id: 'mono', label: 'Monochrome' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'discord', label: 'Discord' },
  { id: 'ableton', label: 'Ableton' },
  { id: 'flstudio', label: 'FL Studio' },
  { id: 'terminalClassic', label: 'Terminal Classic' },
  { id: 'terminalSolarized', label: 'Terminal Solarized' },
  { id: 'snapchat', label: 'Snapchat' },
  { id: 'custom', label: 'Custom' }
]
