import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHealth, getRooms } from '../../utils/api'

function makeRoomId() {
  return `room-${Math.random().toString(36).slice(2, 8)}`
}

export default function Home() {
  const [status, setStatus] = useState<string>('loading')
  const [displayName, setDisplayName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [publicRooms, setPublicRooms] = useState<Array<{ id: string; name: string; players: number; capacity: number }>>([])
  const [roomsStatus, setRoomsStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const navigate = useNavigate()

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
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Room-based party game</p>
          <h2>Submit TikToks. Vote in secret. Crown the category champion.</h2>
          <p className="subhead">
            2–10 players. One shared timer. Categories that get progressively unhinged.
          </p>
          <div className="hero-actions">
            <button
              className="btn primary"
              onClick={() => navigate(`/room/${makeRoomId()}`)}
            >
              Start a room
            </button>
            <button
              className="btn ghost"
              onClick={() => roomCode && navigate(`/room/${roomCode.trim()}`)}
              disabled={!roomCode.trim()}
            >
              Join with code
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-card reveal" style={{ ['--delay' as string]: '0.1s' }}>
            <h3>Quick join</h3>
            <label className="field">
              Display name
              <input
                type="text"
                placeholder="Your nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="field">
              Room code
              <input
                type="text"
                placeholder="e.g. glow-3"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
            </label>
            <button
              className="btn primary"
              onClick={() => roomCode && navigate(`/room/${roomCode.trim()}`)}
              disabled={!roomCode.trim()}
            >
              Enter room
            </button>
            <p className="helper">
              No code? Start a room and invite friends.
            </p>
          </div>
          <div className="panel-card reveal" style={{ ['--delay' as string]: '0.2s' }}>
            <h3>Public rooms live now</h3>
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
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="card reveal" style={{ ['--delay' as string]: '0.15s' }}>
          <h3>How it works</h3>
          <ol>
            <li>Vote the timer up or down.</li>
            <li>Hunt TikToks for each category.</li>
            <li>Vote anonymously each round.</li>
          </ol>
        </div>
        <div className="card reveal" style={{ ['--delay' as string]: '0.25s' }}>
          <h3>Game status</h3>
          <p className="status">{status}</p>
          <p className="muted">Cloudflare Pages Functions health check.</p>
        </div>
        <div className="card reveal" style={{ ['--delay' as string]: '0.35s' }}>
          <h3>Sponsor slot</h3>
          <p className="muted">This game is sponsored by</p>
          <div className="sponsor-slot">Buy this slot</div>
        </div>
      </section>
    </div>
  )
}
