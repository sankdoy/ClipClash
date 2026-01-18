import React, { useContext, useEffect, useState } from 'react'
import { ThemeContext } from '../../ThemeProvider'
import { themePacks } from '../../theme'
import { getMe } from '../../utils/auth'

type User = {
  id: string
  email: string
  username: string
  avatar_url?: string
}

export default function Settings() {
  const [status, setStatus] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const { theme, mode, setTheme, setMode, customCss, setCustomCss } = useContext(ThemeContext)
  const [customDraft, setCustomDraft] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [previousTheme, setPreviousTheme] = useState<string | null>(null)
  const [previousMode, setPreviousMode] = useState<string | null>(null)
  const [previousCss, setPreviousCss] = useState<string | null>(null)
  const baseTemplate = `:root {
  --accent: #ff5c00;
  --accent-2: #3b82f6;
  --bg: #f3f1eb;
  --card: #ffffff;
  --ink: #15151f;
  --muted: #5c5f73;
  --stroke: rgba(21, 21, 31, 0.12);
  --shadow: 0 18px 40px rgba(21, 21, 31, 0.12);
}

/* Tips:
- --accent + --accent-2 control buttons and highlights
- --bg controls page background
- --card controls card surfaces
- --ink + --muted control text
- --stroke + --shadow control borders/shadows */`

  useEffect(() => {
    setCustomDraft(customCss)
  }, [customCss])

  useEffect(() => {
    getMe().then((data) => {
      if (data?.user) {
        setUser(data.user)
      }
    })
  }, [])

  const saveTheme = async () => {
    if (!user) return
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme, mode })
    })
    setStatus(res.ok ? 'Theme saved.' : 'Theme save failed.')
  }

  const loadTemplate = () => {
    setCustomDraft(baseTemplate)
    setStatus('Template loaded. Preview before applying.')
  }

  const startPreview = () => {
    if (previewing) return
    setPreviousTheme(theme)
    setPreviousMode(mode)
    setPreviousCss(customCss)
    setTheme('custom')
    setCustomCss(customDraft)
    setPreviewing(true)
  }

  const cancelPreview = () => {
    if (!previewing) return
    setTheme(previousTheme ?? 'clash')
    setMode((previousMode as any) ?? 'system')
    setCustomCss(previousCss ?? '')
    setPreviewing(false)
  }

  const applyCustomTheme = () => {
    setTheme('custom')
    setCustomCss(customDraft)
    setPreviewing(false)
    setStatus('Custom theme applied.')
  }

  const resetTheme = () => {
    setTheme('clash')
    setMode('system')
    setCustomCss('')
    setCustomDraft('')
    window.localStorage.removeItem('cc_custom_theme')
    window.localStorage.removeItem('cc_theme')
    window.localStorage.removeItem('cc_mode')
    setStatus('Theme reset to default.')
  }

  return (
    <div className="page">
      <h2>Settings</h2>
      <div className="card">
        <h3>Theme</h3>
        <label className="field">
          Theme pack
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {themePacks.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        {user && (
          <button className="btn outline" onClick={saveTheme}>
            Save theme to account
          </button>
        )}
        {!user && <p className="muted">Theme saves locally unless you sign in.</p>}
      </div>
      <div className="card">
        <h3>Custom theme (advanced)</h3>
        <p className="muted">
          Warning: only edit this if you know what you are doing. Bad CSS can make the UI unreadable.
          Preview before applying. If you break things, click Reset Theme or clear site data.
        </p>
        <p className="muted">
          Custom CSS is stored locally in this browser. To recover if the page is broken, open DevTools and run:{' '}
          <code>
            localStorage.removeItem('cc_custom_theme'); localStorage.removeItem('cc_theme');
            localStorage.removeItem('cc_mode');
          </code>{' '}
          then refresh.
        </p>
        <label className="field">
          Custom CSS (edit variables only)
          <textarea
            className="theme-editor"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            placeholder={baseTemplate}
          />
        </label>
        <div className="room-controls">
          <button className="btn ghost" onClick={loadTemplate}>
            Load base template
          </button>
          {!previewing ? (
            <button className="btn outline" onClick={startPreview}>
              Preview
            </button>
          ) : (
            <button className="btn outline" onClick={cancelPreview}>
              Cancel preview
            </button>
          )}
          <button className="btn primary" onClick={applyCustomTheme}>
            Apply custom theme
          </button>
          <button className="btn ghost" onClick={resetTheme}>
            Reset theme
          </button>
        </div>
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
