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
  const {
    theme,
    mode,
    setTheme,
    customCss,
    setCustomCss,
    backgroundImage,
    setBackgroundImage
  } = useContext(ThemeContext)
  const [customDraft, setCustomDraft] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [previousTheme, setPreviousTheme] = useState<string | null>(null)
  const [previousMode, setPreviousMode] = useState<string | null>(null)
  const [previousCss, setPreviousCss] = useState<string | null>(null)
  const [bgDragOver, setBgDragOver] = useState(false)
  const baseTemplate = `:root {
  --bg: #0f1116;
  --bg-end: #0b0d12;
  --panel: #171a22;
  --card: #1f2430;
  --card-2: #252c3a;
  --border: #2f3a4f;
  --text: #f4f6fb;
  --text-muted: #c5ccda;
  --text-dim: #8f98ad;
  --accent: #ff7a1a;
  --accent-hover: #ff9a43;
  --accent-contrast: #1a0f08;
  --danger: #ef4444;
  --focus-ring: rgba(255, 154, 67, 0.45);
  --disabled-bg: #232a38;
  --disabled-text: #7f8a99;
  --disabled-border: #2f3a4f;
  --bg-dots: radial-gradient(circle, rgba(255, 255, 255, 0.18) 1px, transparent 1px);
}

/* Tips:
- --bg / --bg-end control page background
- --panel / --card / --card-2 control surfaces
- --text / --text-muted / --text-dim control readability
- --accent / --accent-hover control buttons + highlights */`

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
    setBackgroundImage('')
    window.localStorage.removeItem('cc_custom_theme')
    window.localStorage.removeItem('cc_theme')
    window.localStorage.removeItem('cc_mode')
    window.localStorage.removeItem('cc_bg_image')
    setStatus('Theme reset to default.')
  }

  const readBackgroundFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setStatus('Image too large. Max 4MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setBackgroundImage(result)
      setStatus('Background loaded.')
    }
    reader.readAsDataURL(file)
  }

  const onBackgroundDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setBgDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) readBackgroundFile(file)
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
        {user && (
          <button className="btn outline" onClick={saveTheme}>
            Save theme to account
          </button>
        )}
        {!user && <p className="muted">Theme saves locally unless you sign in.</p>}
      </div>
      <div className="card">
        <h3>Background image</h3>
        <label className="field">
          Image URL
          <input
            type="text"
            placeholder="https://example.com/background.jpg"
            value={backgroundImage}
            onChange={(e) => setBackgroundImage(e.target.value.trim())}
          />
        </label>
        <div
          className={`upload-drop ${bgDragOver ? 'active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setBgDragOver(true)
          }}
          onDragLeave={() => setBgDragOver(false)}
          onDrop={onBackgroundDrop}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) readBackgroundFile(file)
            }}
          />
          <p className="muted">Drag an image here or click to choose a file.</p>
        </div>
        {backgroundImage && (
          <div className="bg-preview">
            <div className="bg-preview-image" style={{ backgroundImage: `url("${backgroundImage}")` }} />
            <button className="btn ghost" onClick={() => setBackgroundImage('')}>
              Clear background
            </button>
          </div>
        )}
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
