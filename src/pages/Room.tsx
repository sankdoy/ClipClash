import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const defaultCategories = [
  'Cutest',
  'Funniest',
  'Most out of pocket',
  'Cringiest',
  'Most satisfying',
  'Weirdest'
]

const mockPlayers = [
  { id: 'p1', name: 'Nova', status: 'ready' },
  { id: 'p2', name: 'Jax', status: 'voting' },
  { id: 'p3', name: 'Mina', status: 'hunting' }
]

export default function Room() {
  const { roomId } = useParams()
  const [message, setMessage] = useState('')
  const categories = useMemo(() => defaultCategories, [])

  return (
    <div className="page room">
      <header className="room-header">
        <div>
          <p className="eyebrow">Room</p>
          <h2>{roomId ?? 'unknown-room'}</h2>
          <p className="muted">Public room • 3/10 players • Host: Nova</p>
        </div>
        <div className="room-actions">
          <button className="btn ghost">Invite link</button>
          <Link className="btn outline" to="/">Leave</Link>
        </div>
      </header>

      <section className="room-grid">
        <div className="card reveal" style={{ ['--delay' as string]: '0.1s' }}>
          <h3>Lobby</h3>
          <ul className="player-list">
            {mockPlayers.map((player) => (
              <li key={player.id}>
                <span>{player.name}</span>
                <span className="pill">{player.status}</span>
              </li>
            ))}
          </ul>
          <div className="room-controls">
            <button className="btn primary">Start hunt</button>
            <button className="btn ghost">Edit categories</button>
          </div>
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.2s' }}>
          <h3>Hunt timer</h3>
          <div className="timer">
            <span className="timer-value">10:00</span>
            <span className="timer-label">Current target</span>
          </div>
          <div className="vote-strip">
            <button className="btn outline">Higher</button>
            <button className="btn outline">Lower</button>
          </div>
          <p className="muted">Vote recalculates every 5 seconds.</p>
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.3s' }}>
          <h3>Categories</h3>
          <div className="category-grid">
            {categories.map((category) => (
              <div key={category} className="category-card">
                <span>{category}</span>
                <button className="btn ghost">Add TikTok</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.4s' }}>
          <h3>Chat</h3>
          <div className="chat-window">
            <p className="muted">Chat is always on. MVP stub.</p>
            <div className="chat-line">
              <span>Nova:</span> We go on green.
            </div>
            <div className="chat-line">
              <span>Mina:</span> My feed is chaos.
            </div>
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault()
              setMessage('')
            }}
          >
            <input
              type="text"
              placeholder="Type message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={!message.trim()}>
              Send
            </button>
          </form>
        </div>

        <div className="card reveal" style={{ ['--delay' as string]: '0.5s' }}>
          <h3>Sponsor</h3>
          <div className="sponsor-slot">Buy this slot</div>
          <p className="muted">One sponsor per match. No popups.</p>
        </div>
      </section>
    </div>
  )
}
