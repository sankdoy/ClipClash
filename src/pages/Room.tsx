import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ChatMessage, Player, ServerMessage, Settings } from '../types'

const defaultCategories = [
  'Cutest',
  'Funniest',
  'Most out of pocket',
  'Cringiest',
  'Most satisfying',
  'Weirdest'
]

function getWsBase() {
  const override = import.meta.env.VITE_ROOMS_WS_URL as string | undefined
  if (override && override.trim().length > 0) {
    return override.replace(/\/$/, '')
  }
  return window.location.origin.replace(/^http/, 'ws')
}

function safeParseMessage(raw: string): ServerMessage | null {
  try {
    return JSON.parse(raw) as ServerMessage
  } catch {
    return null
  }
}

export default function Room() {
  const { roomId } = useParams()
  const [isConnected, setIsConnected] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const categories = useMemo(() => defaultCategories, [])
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!roomId) return
    const ws = new WebSocket(`${getWsBase()}/room/${roomId}`)
    socketRef.current = ws

    ws.addEventListener('open', () => setIsConnected(true))
    ws.addEventListener('close', () => setIsConnected(false))
    ws.addEventListener('message', (event) => {
      const data = safeParseMessage(event.data)
      if (!data) return
      if (data.type === 'welcome') {
        setPlayers(data.players)
        setChat(data.chat)
        setSettings(data.settings)
      }
      if (data.type === 'presence') {
        setPlayers(data.players)
      }
      if (data.type === 'chat') {
        setChat((prev) => [...prev, data.chat])
      }
    })

    return () => {
      ws.close()
    }
  }, [roomId])

  const sendHello = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'hello', name: displayName }))
  }

  const sendChat = () => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'chat', message }))
    setMessage('')
  }

  return (
    <div className="page room">
      <header className="room-header">
        <div>
          <p className="eyebrow">Room</p>
          <h2>{roomId ?? 'unknown-room'}</h2>
          <p className="muted">
            {isConnected ? 'Connected' : 'Connecting...'} • {players.length}/10 players
          </p>
        </div>
        <div className="room-actions">
          <button className="btn ghost">Invite link</button>
          <Link className="btn outline" to="/">Leave</Link>
        </div>
      </header>

      <section className="room-grid">
        <div className="card reveal" style={{ ['--delay' as string]: '0.1s' }}>
          <h3>Lobby</h3>
          <label className="field">
            Display name
            <input
              type="text"
              placeholder="Pick a name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <button className="btn outline" onClick={sendHello} disabled={!displayName.trim()}>
            Update name
          </button>
          <ul className="player-list">
            {players.map((player) => (
              <li key={player.id}>
                <span>{player.displayName}</span>
                <span className="pill">{player.isConnected ? 'online' : 'offline'}</span>
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
            <span className="timer-value">{settings?.defaultTime ?? 10}:00</span>
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
            {chat.length === 0 ? (
              <p className="muted">Chat is always on. Say hi.</p>
            ) : (
              chat.map((line) => (
                <div className="chat-line" key={line.id}>
                  <span>{line.name}:</span> {line.message}
                </div>
              ))
            )}
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault()
              sendChat()
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
