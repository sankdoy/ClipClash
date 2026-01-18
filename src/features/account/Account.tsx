import React, { useEffect, useState } from 'react'
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
        </>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
