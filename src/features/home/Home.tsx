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
    <div className="page home">
      <section className="home-grid">
        <div className="home-main">
          <div className="mode-card">
            <p className="eyebrow">Play</p>
            <h2>Start a room or join with a code.</h2>
            <p className="muted">2–10 players. One shared timer. Vote in secret.</p>
            <div className="mode-actions">
              <button className="btn primary" onClick={() => navigate(`/room/${makeRoomId()}`)}>
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
