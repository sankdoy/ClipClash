import React, { useContext, useEffect, useRef, useState } from 'react'
import { ThemeContext } from '../../ThemeProvider'
import { themePacks, ThemeMode } from '../../theme'
import { getMe } from '../../utils/auth'
import ThemeBuilder from './ThemeBuilder'

type User = {
  id: string
  email: string
  username: string
  avatar_url?: string
}

const backgroundAnimations = [
  { id: 'wave', label: 'Wave (Default)' },
  { id: 'spiral', label: 'Spiral' },
  { id: 'ripple', label: 'Ripple' },
  { id: 'drift', label: 'Drift' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'flow', label: 'Flow' },
  { id: 'none', label: 'None' }
]

export default function Settings() {
  const [status, setStatus] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [performanceMode, setPerformanceMode] = useState(() => {
    return localStorage.getItem('performance-mode') === 'true'
  })
  const [bgAnimation, setBgAnimation] = useState(() => {
    return localStorage.getItem('bg-animation') || 'wave'
  })
  const {
    theme,
    mode,
    setTheme,
    setMode,
    customCss,
    setCustomCss,
    backgroundImage,
    setBackgroundImage
  } = useContext(ThemeContext)
  const [customDraft, setCustomDraft] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [previousTheme, setPreviousTheme] = useState<string | null>(null)
  const [previousMode, setPreviousMode] = useState<ThemeMode | null>(null)
  const [previousCss, setPreviousCss] = useState<string | null>(null)
  const [bgDragOver, setBgDragOver] = useState(false)
  const [showVisualBuilder, setShowVisualBuilder] = useState(false)
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false)
  const bgInputRef = useRef<HTMLInputElement | null>(null)
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
- --bg / --bg-end: Page background gradient
- --panel / --card / --card-2: Surface colors
- --text / --text-muted / --text-dim: Text hierarchy
- --accent / --accent-hover: Interactive elements

Background Animation Variables (optional):
- --ball-speed: Animation duration (default: 10s)
- --ball-opacity: Orb opacity (default: 0.35)
- --ball-blur: Blur intensity (default: 0.6px)
- --ball-size: Orb size (default: 120px)

Example custom animation:
.scene__glass {
  --ball-speed: 15s;
  --ball-opacity: 0.5;
  --ball-blur: 1px;
  --ball-size: 200px;
}
*/`

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

  useEffect(() => {
    if (performanceMode) {
      document.body.classList.add('performance-mode')
      localStorage.setItem('performance-mode', 'true')
    } else {
      document.body.classList.remove('performance-mode')
      localStorage.setItem('performance-mode', 'false')
    }
  }, [performanceMode])

  useEffect(() => {
    // Remove all animation classes first
    backgroundAnimations.forEach(anim => {
      document.body.classList.remove(`bg-anim-${anim.id}`)
    })
    // Add the selected animation class
    if (bgAnimation && bgAnimation !== 'wave') {
      document.body.classList.add(`bg-anim-${bgAnimation}`)
    }
    localStorage.setItem('bg-animation', bgAnimation)
  }, [bgAnimation])

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
    setMode(previousMode ?? 'system')
    setCustomCss(previousCss ?? '')
    setPreviewing(false)
  }

  const applyCustomTheme = () => {
    setTheme('custom')
    setCustomCss(customDraft)
    setPreviewing(false)
    setStatus('Custom theme applied.')
  }

  const applyBuilderTheme = (css: string) => {
    setTheme('custom')
    setCustomCss(css)
    setCustomDraft(css)
    setPreviewing(false)
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
    if (file.type && !file.type.startsWith('image/')) {
      setStatus('Please choose an image file.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setStatus('Image too large. Max 12MB.')
      return
    }
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const encodeToBlob = (maxSize: number, quality: number) => new Promise<Blob | null>((resolve) => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#0b0d12'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
      })

      const attempts = [
        { maxSize: 1920, quality: 0.82 },
        { maxSize: 1920, quality: 0.7 },
        { maxSize: 1920, quality: 0.55 },
        { maxSize: 1440, quality: 0.7 }
      ]

      const run = async () => {
        for (const attempt of attempts) {
          const blob = await encodeToBlob(attempt.maxSize, attempt.quality)
          if (!blob) continue
          if (blob.size > 1_200_000 && attempt !== attempts[attempts.length - 1]) {
            continue
          }
          const reader = new FileReader()
          reader.onerror = () => {
            setStatus('Image read failed. Try again.')
          }
          reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : ''
            if (!result) {
              setStatus('Image conversion failed. Try again.')
              return
            }
            setBackgroundImage(result)
            setStatus('Background loaded.')
            if (bgInputRef.current) {
              bgInputRef.current.value = ''
            }
          }
          reader.readAsDataURL(blob)
          return
        }
        setStatus('Image conversion failed. Try a smaller image.')
      }

      run().catch(() => setStatus('Image conversion failed. Try again.'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setStatus('This image format is not supported in your browser. Try PNG or JPG.')
    }
    img.src = objectUrl
  }

  const onBackgroundDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setBgDragOver(true)
  }

  const onBackgroundDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setBgDragOver(true)
  }

  const onBackgroundDragLeave = () => {
    setBgDragOver(false)
  }

  const onBackgroundDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setBgDragOver(false)
    const dataTransfer = event.dataTransfer
    const item = dataTransfer.items?.[0]
    const file = dataTransfer.files?.[0] ?? (item?.kind === 'file' ? item.getAsFile() : null)
    if (file) {
      readBackgroundFile(file)
    } else {
      setStatus('Drop an image file (not a link).')
    }
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
        <h3>Background Animation</h3>
        <label className="field">
          Animation Style
          <select value={bgAnimation} onChange={(e) => setBgAnimation(e.target.value)}>
            {backgroundAnimations.map((anim) => (
              <option key={anim.id} value={anim.id}>
                {anim.label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Choose an animated background effect. Select "None" or enable Performance Mode below to disable animations.
        </p>
        <label className="field" style={{flexDirection: 'row', alignItems: 'center', gap: '12px', marginTop: '12px'}}>
          <input
            type="checkbox"
            checked={performanceMode}
            onChange={(e) => setPerformanceMode(e.target.checked)}
          />
          <span>Performance Mode (disables all animations)</span>
        </label>
        <p className="muted">
          Enable this if you experience lag, especially when running other apps like YouTube.
        </p>
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
          onDragOver={onBackgroundDragOver}
          onDragEnter={onBackgroundDragEnter}
          onDragLeave={onBackgroundDragLeave}
          onDrop={onBackgroundDrop}
        >
          <input
            type="file"
            accept="image/*"
            ref={bgInputRef}
            onClick={() => {
              if (bgInputRef.current) {
                bgInputRef.current.value = ''
              }
            }}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) readBackgroundFile(file)
              if (bgInputRef.current) {
                bgInputRef.current.value = ''
              }
            }}
          />
          <p className="muted">Drag an image here or click to choose a file.</p>
        </div>
        {backgroundImage && (
          <div className="bg-preview">
            <div className="bg-preview-image" style={{ backgroundImage: `url("${backgroundImage}")` }} />
            <button
              className="btn ghost"
              onClick={() => {
                setBackgroundImage('')
                if (bgInputRef.current) {
                  bgInputRef.current.value = ''
                }
              }}
            >
              Clear background
            </button>
          </div>
        )}
      </div>
      <div className="card">
        <h3>Custom Theme</h3>
        <p className="muted">
          Create your own theme by customizing colors and animations. Choose between a visual builder or advanced CSS editor.
        </p>

        {!showVisualBuilder && !showAdvancedEditor && (
          <div className="room-controls">
            <button className="btn primary" onClick={() => setShowVisualBuilder(true)}>
              Open Visual Builder (Recommended)
            </button>
            <button className="btn outline" onClick={() => setShowAdvancedEditor(true)}>
              Advanced CSS Editor
            </button>
          </div>
        )}

        {showVisualBuilder && (
          <ThemeBuilder
            onApply={(css) => {
              applyBuilderTheme(css)
              setShowVisualBuilder(false)
              setStatus('Custom theme applied from visual builder.')
            }}
            onCancel={() => setShowVisualBuilder(false)}
          />
        )}

        {showAdvancedEditor && (
          <>
            <p className="muted">
              <strong>⚠️ Warning:</strong> Invalid CSS can break the UI. If things break, run this in DevTools:{' '}
              <code>localStorage.removeItem('cc_custom_theme'); location.reload();</code>
            </p>
            <label className="field">
              Custom CSS
              <textarea
                className="theme-editor"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder={baseTemplate}
                spellCheck={false}
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
              <button className="btn ghost" onClick={() => setShowAdvancedEditor(false)}>
                Close editor
              </button>
            </div>
          </>
        )}

        {(showVisualBuilder || showAdvancedEditor) && (
          <button className="btn ghost" onClick={resetTheme} style={{ marginTop: '12px' }}>
            Reset to Default Theme
          </button>
        )}
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
