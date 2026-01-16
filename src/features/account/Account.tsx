import React, { useContext, useEffect, useState } from 'react'
import { getMe, logout, requestLogin, updateProfile, verifyLogin } from '../../utils/auth'
import { ThemeContext } from '../../ThemeProvider'
import { themePacks } from '../../theme'

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
  const { theme, mode, setTheme, setMode } = useContext(ThemeContext)

  useEffect(() => {
    getMe().then((data) => {
      if (data?.user) {
        setUser(data.user)
        setUsername(data.user.username)
        setAvatarUrl(data.user.avatar_url ?? '')
      }
    })
  }, [])

  const requestCode = async () => {
    const ok = await requestLogin(email)
    setStatus(ok ? 'Check your email for the code.' : 'Unable to send code.')
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

  const saveTheme = async () => {
    if (!user) return
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme, mode })
    })
    setStatus(res.ok ? 'Theme saved.' : 'Theme save failed.')
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
        </div>
      ) : (
        <div className="card">
          <h3>Profile</h3>
          <p className="muted">Signed in as {user.email}</p>
          <label className="field">
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            Profile picture URL
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          </label>
          <div className="room-controls">
            <button className="btn primary" onClick={saveProfile}>
              Save profile
            </button>
            <button className="btn ghost" onClick={doLogout}>
              Log out
            </button>
          </div>
        </div>
      <div className="card">
        <h3>Theme</h3>
        <label className="field">
          Theme pack
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {themePacks.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.label}</option>
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
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
