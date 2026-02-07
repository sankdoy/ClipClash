import React, { useEffect, useRef, useState } from 'react'
import { getMe, login, logout, register, forgotPassword, resetPassword, updateProfile } from '../../utils/auth'

type User = {
  id: string
  email: string
  username: string
  avatar_url?: string
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

type Stats = {
  games_played: number
  wins: number
  category_wins: number
  updated_at: string | null
}

const BLOCKED_KEY = 'cd:blocked_players'
const FAVOURITES_KEY = 'cd:favourite_players'

function getStoredList(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}

export default function Account() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarDragOver, setAvatarDragOver] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [hasAudienceMode, setHasAudienceMode] = useState(false)
  const [audienceLoading, setAudienceLoading] = useState(false)
  const [audienceStatus, setAudienceStatus] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [blockedPlayers, setBlockedPlayers] = useState<Record<string, string>>(getStoredList(BLOCKED_KEY))
  const [favouritePlayers, setFavouritePlayers] = useState<Record<string, string>>(getStoredList(FAVOURITES_KEY))

  useEffect(() => {
    getMe().then((data) => {
      if (data?.user) {
        setUser(data.user)
        setUsername(data.user.username)
        setAvatarUrl(data.user.avatar_url ?? '')
        fetchEntitlements()
        fetchStats()
      }
    })
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (data?.stats) setStats(data.stats)
    } catch { /* ignore */ }
  }

  const removeBlocked = (pid: string) => {
    setBlockedPlayers((prev) => {
      const next = { ...prev }
      delete next[pid]
      localStorage.setItem(BLOCKED_KEY, JSON.stringify(next))
      return next
    })
  }

  const removeFavourite = (pid: string) => {
    setFavouritePlayers((prev) => {
      const next = { ...prev }
      delete next[pid]
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset')
    if (token) {
      setResetToken(token)
      setAuthMode('reset')
      params.delete('reset')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
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

  const handleLogin = async () => {
    setStatus(null)
    const data = await login(email, password)
    if (data?.user) {
      setUser(data.user)
      setUsername(data.user.username)
      setAvatarUrl(data.user.avatar_url ?? '')
      setStatus('Logged in.')
      setPassword('')
      fetchEntitlements()
    } else {
      setStatus(data?.error ?? 'Login failed.')
    }
  }

  const handleRegister = async () => {
    setStatus(null)
    if (password !== confirmPassword) {
      setStatus('Passwords do not match.')
      return
    }
    const data = await register(email, password)
    if (data?.user) {
      setUser(data.user)
      setUsername(data.user.username)
      setAvatarUrl(data.user.avatar_url ?? '')
      setStatus('Account created.')
      setPassword('')
      setConfirmPassword('')
    } else {
      setStatus(data?.error ?? 'Registration failed.')
    }
  }

  const handleForgotPassword = async () => {
    setStatus(null)
    const ok = await forgotPassword(email)
    setStatus(ok ? 'If an account exists with that email, a reset link has been sent.' : 'Unable to send reset email.')
  }

  const handleResetPassword = async () => {
    setStatus(null)
    if (password !== confirmPassword) {
      setStatus('Passwords do not match.')
      return
    }
    const data = await resetPassword(resetToken, password)
    if (data?.ok) {
      setStatus('Password reset. You can now sign in.')
      setAuthMode('login')
      setPassword('')
      setConfirmPassword('')
      setResetToken('')
    } else {
      setStatus(data?.error ?? 'Reset failed.')
    }
  }

  const saveProfile = async () => {
    const ok = await updateProfile(username, avatarUrl)
    setStatus(ok ? 'Profile updated.' : 'Profile update failed.')
  }

  const fetchEntitlements = async () => {
    const res = await fetch('/api/entitlements', { credentials: 'include' })
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
        credentials: 'include',
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
      if (!result) { setStatus('Image load failed.'); return }
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
        if (!ctx) { setStatus('Image resize failed.'); return }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        const outputType = file.type === 'image/png' || file.type === 'image/webp' ? 'image/png' : 'image/jpeg'
        canvas.toBlob((blob) => {
          if (!blob) { setStatus('Image conversion failed.'); return }
          const blobReader = new FileReader()
          blobReader.onload = () => {
            const compressed = typeof blobReader.result === 'string' ? blobReader.result : ''
            if (!compressed) { setStatus('Image conversion failed.'); return }
            setAvatarUrl(compressed)
            setStatus('Avatar loaded. Save profile to apply.')
            if (avatarInputRef.current) avatarInputRef.current.value = ''
          }
          blobReader.readAsDataURL(blob)
        }, outputType, 0.85)
      }
      img.onerror = () => setStatus('Image format not supported. Try PNG or JPG.')
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

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') action()
  }

  return (
    <div className="page">
      <h2>Account</h2>
      {!user ? (
        <>
          {authMode === 'login' && (
            <div className="card">
              <h3>Sign in</h3>
              <label className="field">
                Email
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                />
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                />
              </label>
              <button className="btn primary" onClick={handleLogin} disabled={!email.trim() || !password}>
                Sign in
              </button>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn ghost" onClick={() => { setAuthMode('register'); setStatus(null) }}>
                  Create account
                </button>
                <button className="btn ghost" onClick={() => { setAuthMode('forgot'); setStatus(null) }}>
                  Forgot password?
                </button>
              </div>
            </div>
          )}

          {authMode === 'register' && (
            <div className="card">
              <h3>Create account</h3>
              <label className="field">
                Email
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="field">
                Confirm password
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleRegister)}
                />
              </label>
              <button
                className="btn primary"
                onClick={handleRegister}
                disabled={!email.trim() || password.length < 8 || password !== confirmPassword}
              >
                Create account
              </button>
              <button className="btn ghost" onClick={() => { setAuthMode('login'); setStatus(null) }} style={{ marginTop: '8px' }}>
                Already have an account? Sign in
              </button>
            </div>
          )}

          {authMode === 'forgot' && (
            <div className="card">
              <h3>Reset password</h3>
              <p className="muted">Enter your email and we'll send a reset link.</p>
              <label className="field">
                Email
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleForgotPassword)}
                />
              </label>
              <button className="btn primary" onClick={handleForgotPassword} disabled={!email.trim()}>
                Send reset link
              </button>
              <button className="btn ghost" onClick={() => { setAuthMode('login'); setStatus(null) }} style={{ marginTop: '8px' }}>
                Back to sign in
              </button>
            </div>
          )}

          {authMode === 'reset' && (
            <div className="card">
              <h3>Set new password</h3>
              <label className="field">
                New password
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="field">
                Confirm password
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleResetPassword)}
                />
              </label>
              <button
                className="btn primary"
                onClick={handleResetPassword}
                disabled={password.length < 8 || password !== confirmPassword}
              >
                Reset password
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card">
            <h3>Profile</h3>
            <div className="profile-avatar-section">
              <div
                className={`avatar-upload ${avatarDragOver ? 'active' : ''}`}
                onClick={() => avatarInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setAvatarDragOver(true) }}
                onDragLeave={() => setAvatarDragOver(false)}
                onDrop={onAvatarDrop}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" />
                ) : (
                  <span className="avatar-upload-placeholder">
                    {(user.username || user.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="avatar-upload-overlay">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M9 3l-1.8 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2.2L15 3H9zm3 16a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z" />
                  </svg>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={avatarInputRef}
                  style={{ display: 'none' }}
                  onClick={() => { if (avatarInputRef.current) avatarInputRef.current.value = '' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) readAvatarFile(file)
                    if (avatarInputRef.current) avatarInputRef.current.value = ''
                  }}
                />
              </div>
              <div className="avatar-upload-info">
                <span className="muted" style={{ fontSize: '0.85rem' }}>Click or drag to upload</span>
                {avatarUrl && (
                  <button className="btn ghost" onClick={() => setAvatarUrl('')} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            <label className="field">
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="field">
              Email
              <input value={user.email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </label>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn primary" onClick={saveProfile} style={{ flex: 1 }}>
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

          {stats && (
            <div className="card">
              <h3>Your stats</h3>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-value">{stats.games_played}</span>
                  <span className="stat-label">Games played</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.wins}</span>
                  <span className="stat-label">Wins</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.category_wins}</span>
                  <span className="stat-label">Category wins</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {stats.games_played > 0 ? Math.round((stats.wins / stats.games_played) * 100) : 0}%
                  </span>
                  <span className="stat-label">Win rate</span>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3>Favourite players</h3>
            {Object.keys(favouritePlayers).length === 0 ? (
              <p className="muted">No favourite players yet. Star players in the room to add them.</p>
            ) : (
              <div className="people-list">
                {Object.entries(favouritePlayers).map(([pid, name]) => (
                  <div key={pid} className="people-row">
                    <span>{name}</span>
                    <button className="btn ghost" onClick={() => removeFavourite(pid)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Blocked players</h3>
            {Object.keys(blockedPlayers).length === 0 ? (
              <p className="muted">No blocked players. Block players in the room to add them here.</p>
            ) : (
              <div className="people-list">
                {Object.entries(blockedPlayers).map(([pid, name]) => (
                  <div key={pid} className="people-row">
                    <span>{name}</span>
                    <button className="btn ghost" onClick={() => removeBlocked(pid)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
