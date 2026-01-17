import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHealth, getRooms } from '../../utils/api'

function makeRoomId() {
  return `room-${Math.random().toString(36).slice(2, 8)}`
}

export default function Home() {
  const [status, setStatus] = useState<string>('loading')
  const [roomCode, setRoomCode] = useState('')
  const [publicRooms, setPublicRooms] = useState<Array<{ id: string; name: string; players: number; capacity: number }>>([])
  const [roomsStatus, setRoomsStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('public')
  const navigate = useNavigate()

  const startRoom = () => {
    const newRoomId = makeRoomId()
    setRoomCode(newRoomId)
    if (roomVisibility === 'public') {
      saveLocalPublicRoom(newRoomId)
    }
    navigate(`/room/${newRoomId}`)
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
          const localRooms = loadLocalPublicRooms()
          setPublicRooms([...localRooms, ...data.rooms])
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
            <div className="help-graphic" />
            <p className="muted">Vote the timer, hunt clips, then crown a winner each round.</p>
            <div className="help-dots">
              <span className="dot active" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
          <div className="panel-card">
            <h3>Public rooms</h3>
            <div className="room-list">
              {roomsStatus === 'loading' && <p className="muted">Loading rooms...</p>}
              {roomsStatus === 'error' && <p className="muted">Rooms unavailable.</p>}
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

function loadLocalPublicRooms() {
  try {
    const raw = window.localStorage.getItem('cc_public_rooms')
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{ id: string; name: string; createdAt: number }>
    return parsed.map((room) => ({
      id: room.id,
      name: room.name,
      players: 0,
      capacity: 10
    }))
  } catch {
    return []
  }
}

function saveLocalPublicRoom(roomId: string) {
  try {
    const raw = window.localStorage.getItem('cc_public_rooms')
    const existing = raw ? (JSON.parse(raw) as Array<{ id: string; name: string; createdAt: number }>) : []
    const next = [
      { id: roomId, name: `Room ${roomId}`, createdAt: Date.now() },
      ...existing.filter((room) => room.id !== roomId)
    ].slice(0, 12)
    window.localStorage.setItem('cc_public_rooms', JSON.stringify(next))
  } catch {
    return
  }
}
