import React, { useEffect, useRef, useState } from 'react'
import { getMe, logout, requestLogin, updateProfile, verifyLogin } from '../../utils/auth'

type User = {
  id: string
  email: string
  username: string
  avatar_url?: string
}

export default function Account() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarDragOver, setAvatarDragOver] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [hasAudienceMode, setHasAudienceMode] = useState(false)
  const [audienceLoading, setAudienceLoading] = useState(false)
  const [audienceStatus, setAudienceStatus] = useState<string | null>(null)

  useEffect(() => {
    getMe().then((data) => {
      if (data?.user) {
        setUser(data.user)
        setUsername(data.user.username)
        setAvatarUrl(data.user.avatar_url ?? '')
        fetchEntitlements()
      }
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('audience') === 'success') {
      fetchEntitlements()
      setAudienceStatus('Purchase confirmed. Audience Mode unlocked.')
      params.delete('audience')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
    if (params.get('audience') === 'cancel') {
      setAudienceStatus('Purchase cancelled.')
      params.delete('audience')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
  }, [])

  const requestCode = async () => {
    const ok = await requestLogin(email)
    setStatus(ok ? 'Check your email for the code.' : 'Unable to send code.')
  }

  const devLogin = () => {
    const fakeUser = {
      id: 'dev-user',
      email: 'edjarv03@gmail.com',
      username: 'edjarv03'
    }
    setUser(fakeUser)
    setUsername(fakeUser.username)
    setAvatarUrl('')
    setStatus('Dev login enabled (local only).')
  }

  const verifyCode = async () => {
    const data = await verifyLogin(email, code)
    if (!data?.user) {
      setStatus('Invalid code.')
      return
    }
    setUser(data.user)
    setUsername(data.user.username)
    setAvatarUrl(data.user.avatar_url ?? '')
    setStatus('Logged in.')
  }

  const saveProfile = async () => {
    const ok = await updateProfile(username, avatarUrl)
    setStatus(ok ? 'Profile updated.' : 'Profile update failed.')
  }

  const fetchEntitlements = async () => {
    const res = await fetch('/api/entitlements')
    if (!res.ok) return
    const data = await res.json()
    setHasAudienceMode(Boolean(data?.hasAudienceMode))
  }

  const purchaseAudienceMode = async () => {
    setAudienceLoading(true)
    setAudienceStatus(null)
    try {
      const res = await fetch('/api/audience', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setAudienceStatus(data?.error ?? 'Unable to start checkout.')
        return
      }
      window.location.assign(data.url)
    } catch {
      setAudienceStatus('Unable to start checkout.')
    } finally {
      setAudienceLoading(false)
    }
  }

  const readAvatarFile = (file: File) => {
    if (file.type && !file.type.startsWith('image/')) {
      setStatus('Please choose an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        setStatus('Image load failed. Try a different file.')
        return
      }
      const img = new Image()
      img.onload = () => {
        const maxSize = 256
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setStatus('Image resize failed. Try again.')
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        const outputType = file.type === 'image/png' || file.type === 'image/webp' ? 'image/png' : 'image/jpeg'
        canvas.toBlob((blob) => {
          if (!blob) {
            setStatus('Image conversion failed. Try again.')
            return
          }
          const blobReader = new FileReader()
          blobReader.onload = () => {
            const compressed = typeof blobReader.result === 'string' ? blobReader.result : ''
            if (!compressed) {
              setStatus('Image conversion failed. Try again.')
              return
            }
            setAvatarUrl(compressed)
            setStatus('Avatar loaded. Save profile to apply.')
            if (avatarInputRef.current) {
              avatarInputRef.current.value = ''
            }
          }
          blobReader.readAsDataURL(blob)
        }, outputType, 0.85)
      }
      img.onerror = () => {
        setStatus('This image format is not supported. Try PNG or JPG.')
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }

  const onAvatarDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setAvatarDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) readAvatarFile(file)
  }

  const doLogout = async () => {
    await logout()
    setUser(null)
    setStatus('Logged out.')
  }

  return (
    <div className="page">
      <h2>Account</h2>
      {!user ? (
        <div className="card">
          <h3>Email sign-in</h3>
          <label className="field">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn primary" onClick={requestCode} disabled={!email.trim()}>
            Send code
          </button>
          <label className="field">
            Verification code
            <input
              type="text"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="btn outline" onClick={verifyCode} disabled={code.length < 6}>
            Verify
          </button>
          {import.meta.env.DEV && (
            <button className="btn ghost" onClick={devLogin}>
              Dev login (local only)
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Profile</h3>
            <label className="field">
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="field">
              Email
              <input value={user.email} disabled style={{opacity: 0.6, cursor: 'not-allowed'}} />
            </label>
            <div className="field">
              <label style={{marginBottom: '8px'}}>Profile picture</label>
              <div style={{display: 'flex', gap: '16px', alignItems: 'flex-start'}}>
                {avatarUrl && (
                  <div style={{flexShrink: 0}}>
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--border)'
                      }}
                    />
                  </div>
                )}
                <div style={{flex: 1}}>
                  <div
                    className={`upload-drop ${avatarDragOver ? 'active' : ''}`}
                    style={{minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setAvatarDragOver(true)
                    }}
                    onDragLeave={() => setAvatarDragOver(false)}
                    onDrop={onAvatarDrop}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      ref={avatarInputRef}
                      onClick={() => {
                        if (avatarInputRef.current) {
                          avatarInputRef.current.value = ''
                        }
                      }}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) readAvatarFile(file)
                        if (avatarInputRef.current) {
                          avatarInputRef.current.value = ''
                        }
                      }}
                    />
                    <p className="muted" style={{margin: 0}}>
                      {avatarUrl ? 'Click to change' : 'Click or drag image here'}
                    </p>
                  </div>
                  {avatarUrl && (
                    <button
                      className="btn ghost"
                      onClick={() => setAvatarUrl('')}
                      style={{marginTop: '8px', width: '100%'}}
                    >
                      Remove avatar
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{display: 'flex', gap: '12px', marginTop: '16px'}}>
              <button className="btn primary" onClick={saveProfile} style={{flex: 1}}>
                Save changes
              </button>
              <button className="btn outline" onClick={doLogout}>
                Log out
              </button>
            </div>
          </div>
          <div className="card">
            <h3>Audience Mode</h3>
            <p className="muted">Unlock spectator features for all your rooms.</p>
            <div className="room-controls">
              {hasAudienceMode ? (
                <span className="muted">Owned</span>
              ) : (
                <button className="btn primary" onClick={purchaseAudienceMode} disabled={audienceLoading}>
                  {audienceLoading ? 'Checkout...' : 'Purchase ($30)'}
                </button>
              )}
            </div>
            {audienceStatus && <p className="muted">{audienceStatus}</p>}
          </div>
        </>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
