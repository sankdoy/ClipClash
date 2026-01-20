import React, { useEffect, useMemo, useState } from 'react'
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
  const [publicRooms, setPublicRooms] = useState<Array<{ id: string; name: string; players: number; capacity: number }>>([])
  const [roomsStatus, setRoomsStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('public')
  const [helpIndex, setHelpIndex] = useState(0)
  const navigate = useNavigate()
  const helpSlides = useMemo(() => ([
    {
      title: 'Set the pace',
      copy: 'Vote on the timer, then lock in categories before the hunt starts.'
    },
    {
      title: 'Hunt the clip',
      copy: 'Find a TikTok that fits the prompt and submit before time runs out.'
    },
    {
      title: 'Vote + crown',
      copy: 'Everyone votes each round. The top clip wins and the scoreboard updates.'
    }
  ]), [])

  const startRoom = () => {
    const newRoomId = makeRoomId()
    const hostKey = makeHostKey()
    setRoomCode(newRoomId)
    navigate(`/room/${newRoomId}?hostKey=${hostKey}`)
  }

  const joinRoom = () => {
    const trimmed = roomCode.trim()
    if (!trimmed) return
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      window.location.assign(trimmed)
      return
    }
    if (trimmed.startsWith('/room/')) {
      window.location.assign(trimmed)
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
      <section className="home-grid">
        <div className="home-main">
          <div className="mode-card">
            <p className="eyebrow">Play</p>
            <h2>Start a room.</h2>
            <p className="muted">2–10 players. One shared timer. Invite friends with the code in the room.</p>
            <div className="mode-actions">
              <button className="btn primary" onClick={startRoom}>
                Start a room
              </button>
            </div>
            <div className="segment-tabs">
              <button
                className={`segment ${roomVisibility === 'public' ? 'active' : ''}`}
                onClick={() => setRoomVisibility('public')}
              >
                Public room
              </button>
              <button
                className={`segment ${roomVisibility === 'private' ? 'active' : ''}`}
                onClick={() => setRoomVisibility('private')}
              >
                Private room
              </button>
            </div>
            <p className="muted">
              {roomVisibility === 'public'
                ? 'Public rooms appear in the lobby list on this device.'
                : 'Private rooms are joinable only with a code.'}
            </p>
          </div>

          <div className="mode-card">
            <p className="eyebrow">Join</p>
            <h2>Join with a code.</h2>
            <p className="muted">Use the room code your host shared.</p>
            <div className="mode-actions">
              <button
                className="btn ghost"
                onClick={joinRoom}
                disabled={!roomCode.trim()}
              >
                Join with code
              </button>
            </div>
            <label className="field">
              Room code
              <input
                type="text"
                placeholder="e.g. glow-3"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
            </label>
          </div>

          <div className="mode-card">
            <p className="eyebrow">Login</p>
            <h2>Save your profile and unlock premium features.</h2>
            <p className="muted">Audience Mode purchases live on your account.</p>
            <button className="btn outline" onClick={() => navigate('/account')}>
              Go to account
            </button>
          </div>
        </div>

        <aside className="home-side">
          <div className="panel-card">
            <h3>How to play</h3>
            <div className="help-graphic">
              <span>{helpSlides[helpIndex].title}</span>
            </div>
            <p className="muted">{helpSlides[helpIndex].copy}</p>
            <div className="help-nav">
              <button
                className="btn ghost"
                type="button"
                onClick={() => setHelpIndex((prev) => (prev - 1 + helpSlides.length) % helpSlides.length)}
              >
                ←
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setHelpIndex((prev) => (prev + 1) % helpSlides.length)}
              >
                →
              </button>
            </div>
            <div className="help-dots">
              {helpSlides.map((_, index) => (
                <span key={`help-dot-${index}`} className={`dot ${index === helpIndex ? 'active' : ''}`} />
              ))}
            </div>
          </div>
          <div className="panel-card">
            <h3>Public rooms</h3>
            <div className="room-list">
              {roomsStatus === 'loading' && <p className="muted">Loading rooms...</p>}
              {roomsStatus === 'error' && <p className="muted">Rooms unavailable.</p>}
              {roomsStatus === 'ok' && publicRooms.length === 0 && (
                <p className="muted">No public rooms yet.</p>
              )}
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
            <p className="muted">Status: {status}</p>
          </div>
        </aside>
      </section>
    </div>
  )
}
