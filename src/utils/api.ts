import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
// ... other imports

export function Account() {
  const location = useLocation()
  const [user, setUser] = useState(null)
  // ... other state hooks

  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    // Keep preview in sync with saved avatar url when user loads
    if (user?.avatar_url) setAvatarPreviewUrl(user.avatar_url)
  }, [user?.avatar_url])

  useEffect(() => {
    async function loadUser() {
      await getMe()
    }
    loadUser()
  }, [location.key])

  function handleAvatarFile(file: File) {
    // Basic guardrails (feel free to tweak numbers)
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    const url = URL.createObjectURL(file)
    setAvatarPreviewUrl(url)

    // If you already have an upload function, call it here.
    // Try these common existing names first and keep whichever exists in your file:
    // - uploadAvatar(file)
    // - saveAvatar(file)
    // - onAvatarChange(file)
    // - updateAvatar(file)
    // If none exist, DO NOT invent API calls here — wire it to your existing profile save flow.
    if (typeof (globalThis as any).uploadAvatar === 'function') {
      ;(globalThis as any).uploadAvatar(file)
    }
  }

  // ... other component code

  return (
    <div>
      {/* other JSX */}

      {/* Avatar */}
      <div className="profile-avatar-row">
        <button
          type="button"
          className="profile-avatar-btn"
          onClick={() => avatarInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) handleAvatarFile(f)
          }}
          aria-label="Change avatar"
        >
          {avatarPreviewUrl ? (
            <img className="profile-avatar-img" src={avatarPreviewUrl} alt="Avatar" />
          ) : (
            <div className="profile-avatar-fallback">
              {(user?.username || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="profile-avatar-overlay" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M9 3l-1.8 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2.2L15 3H9zm3 16a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z" />
            </svg>
            <span className="profile-avatar-overlay-text">Change</span>
          </span>
        </button>

        <input
          ref={avatarInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleAvatarFile(f)
          }}
        />

        <div className="profile-avatar-meta">
          <div className="profile-avatar-title">Profile picture</div>
          <div className="profile-avatar-hint">Click to upload, or drag an image onto the circle.</div>
        </div>
      </div>

      {/* other JSX */}
    </div>
  )
}
