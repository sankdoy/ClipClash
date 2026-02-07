import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHealth, getRooms } from '../../utils/api'

function makeRoomId() {
  return `room-${Math.random().toString(36).slice(2, 8)}`
}

function makeHostKey() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

export default function Home() {
  const [status, setStatus] = useState<string>('loading')
  const [roomCode, setRoomCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [publicRooms, setPublicRooms] = useState<Array<{ id: string; name: string; players: number; capacity: number }>>([])
  const [roomsStatus, setRoomsStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('public')
  const navigate = useNavigate()

  const startRoom = () => {
    const newRoomId = makeRoomId()
    const hostKey = makeHostKey()
    setRoomCode(newRoomId)
    const visibility = roomVisibility === 'public' ? '&public=1' : ''
    navigate(`/room/${newRoomId}?hostKey=${hostKey}${visibility}`)
  }

  const joinRoom = () => {
    const trimmed = roomCode.trim()
    if (!trimmed) return

    setJoinError(null)

    const toRoomPath = (raw: string) => {
      try {
        const url = raw.startsWith('/') ? new URL(raw, window.location.origin) : new URL(raw)
        const match = url.pathname.match(/^\/room\/(room-[a-z0-9]{6})(?:\/)?$/i)
        if (!match) return null
        const params = new URLSearchParams(url.search)
        // Never allow pasting a hostKey into the join box to accidentally grant host powers.
        params.delete('hostKey')
        const search = params.toString()
        return `/room/${match[1]}${search ? `?${search}` : ''}${url.hash}`
      } catch {
        return null
      }
    }

    // Accept a full invite URL or a site-relative room path (but validate format).
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/room/')) {
      const next = toRoomPath(trimmed)
      if (!next) {
        setJoinError('Paste a full invite link, or a room code like "room-abc123".')
        return
      }
      navigate(next)
      return
    }

    // IMPORTANT:
    // The backend will happily create a new room for *any* string.
    // If we allow arbitrary input here, users will accidentally create "random rooms".
    // So we only accept known room id format.
    const isRoomId = /^room-[a-z0-9]{6}$/i.test(trimmed)
    if (!isRoomId) {
      setJoinError('Paste a full invite link, or a room code like "room-abc123".')
      return
    }

    navigate(`/room/${trimmed}`)
  }

  useEffect(() => {
    let mounted = true
    getHealth().then((d) => {
      if (!mounted) return
      setStatus(d?.ok ? 'API ok' : 'API unavailable')
    }).catch(() => setStatus('API unavailable'))
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    getRooms()
      .then((data) => {
        if (!mounted) return
        if (data?.rooms) {
          setPublicRooms(data.rooms)
          setRoomsStatus('ok')
        } else {
          setRoomsStatus('error')
        }
      })
      .catch(() => setRoomsStatus('error'))
    return () => { mounted = false }
  }, [])

  return (
    <div className="page home">
      {/* Top row: Start + Join side by side */}
      <div className="home-top">
        <div className="mode-card" style={{ flex: 1 }}>
          <h2>Start a Room</h2>
          <div className="mode-actions">
            <button className="btn primary" onClick={startRoom}>
              Start a room
            </button>
            <div className="segment-tabs">
              <button
                className={`segment ${roomVisibility === 'public' ? 'active' : ''}`}
                onClick={() => setRoomVisibility('public')}
              >
                Public
              </button>
              <button
                className={`segment ${roomVisibility === 'private' ? 'active' : ''}`}
                onClick={() => setRoomVisibility('private')}
              >
                Private
              </button>
            </div>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            {roomVisibility === 'public'
              ? 'Public rooms appear in the lobby list below.'
              : 'Private rooms are joinable only with a code.'}
          </p>
        </div>

        <div className="mode-card" style={{ flex: 1 }}>
          <h2>Join by Code</h2>
          <label className="field">
            Room code
            <input
              type="text"
              placeholder="e.g. room-abc123"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value)
                if (joinError) setJoinError(null)
              }}
            />
          </label>
          <div className="mode-actions">
            <button
              className="btn ghost"
              onClick={joinRoom}
              disabled={!roomCode.trim()}
            >
              Join with code
            </button>
          </div>
          {joinError && <p className="muted">{joinError}</p>}
        </div>
      </div>

      {/* Public Rooms */}
      <div className="card">
        <h3>Public Rooms</h3>
        <div className="room-list" style={{ marginTop: '12px' }}>
          {roomsStatus === 'loading' && <p className="muted">Loading rooms...</p>}
          {roomsStatus === 'error' && <p className="muted">Rooms unavailable.</p>}
          {roomsStatus === 'ok' && publicRooms.length === 0 && <p className="muted">No public rooms right now. Start one!</p>}
          {roomsStatus === 'ok' && publicRooms.map((room) => (
            <button
              key={room.id}
              className="room-chip"
              onClick={() => navigate(`/room/${room.id}`)}
            >
              <span>{room.name}</span>
              <span>{room.players}/{room.capacity}</span>
            </button>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ background: 'var(--card-2)' }}>
        <h3>How it works</h3>
        <div className="how-to-steps">
          <div className="how-step">
            <div className="how-step-icon">
              <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="20" height="24" rx="3" />
                <line x1="10" y1="10" x2="22" y2="10" />
                <line x1="10" y1="15" x2="22" y2="15" />
                <line x1="10" y1="20" x2="17" y2="20" />
              </svg>
            </div>
            <div>
              <strong>Get categories</strong>
              <p className="muted">The host picks categories and sets a timer.</p>
            </div>
          </div>
          <div className="how-step">
            <div className="how-step-icon">
              <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="14" cy="14" r="8" />
                <line x1="20" y1="20" x2="28" y2="28" />
                <path d="M11 12l4 4-4 4" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <strong>Hunt clips</strong>
              <p className="muted">Find the best short clips from any platform and submit them.</p>
            </div>
          </div>
          <div className="how-step">
            <div className="how-step-icon">
              <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4l3.5 7 7.5 1-5.5 5.2 1.3 7.8L16 21.5 9.2 25l1.3-7.8L5 12l7.5-1z" />
              </svg>
            </div>
            <div>
              <strong>Vote + crown</strong>
              <p className="muted">Everyone votes on the best clip. Most wins takes the crown.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
