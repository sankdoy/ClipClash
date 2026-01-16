import type {
  ChatMessage,
  ClientMessage,
  Phase,
  Player,
  ServerMessage,
  Settings
} from '../../../src/types'

export interface Env {
  ROOMS_DO: DurableObjectNamespace
}

type Session = {
  id: string
  displayName: string
  joinedAt: number
}

const defaultSettings: Settings = {
  minTime: 3,
  maxTime: 20,
  defaultTime: 10,
  voteTickSeconds: 5,
  voteThreshold: 0.8
}

function safeJsonParse(value: string): ClientMessage | null {
  try {
    return JSON.parse(value) as ClientMessage
  } catch {
    return null
  }
}

function toServerMessage(message: ServerMessage) {
  return JSON.stringify(message)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const roomId = parts[0] === 'room' ? parts[1] : parts[0]
    if (!roomId) {
      return new Response('Missing room id', { status: 400 })
    }
    const id = env.ROOMS_DO.idFromName(roomId)
    const stub = env.ROOMS_DO.get(id)
    return stub.fetch(request)
  }
}

export class RoomsDO implements DurableObject {
  state: DurableObjectState
  env: Env
  sessions: Map<WebSocket, Session>
  chat: ChatMessage[]
  phase: Phase
  settings: Settings

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Map()
    this.chat = []
    this.phase = 'lobby'
    this.settings = { ...defaultSettings }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const session: Session = {
      id: crypto.randomUUID(),
      displayName: 'Player',
      joinedAt: Date.now()
    }

    this.state.acceptWebSocket(server)
    this.sessions.set(server, session)

    server.send(
      toServerMessage({
        type: 'welcome',
        sessionId: session.id,
        roomId: this.state.id.toString(),
        phase: this.phase,
        players: this.getPlayers(),
        chat: this.chat,
        settings: this.settings
      })
    )
    this.broadcast({ type: 'presence', players: this.getPlayers() })

    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(ws: WebSocket, message: string) {
    const parsed = safeJsonParse(message)
    if (!parsed) {
      ws.send(toServerMessage({ type: 'error', message: 'Invalid message payload.' }))
      return
    }

    const session = this.sessions.get(ws)
    if (!session) return

    if (parsed.type === 'hello') {
      if (parsed.name && parsed.name.trim().length > 0) {
        session.displayName = parsed.name.trim().slice(0, 24)
      }
      this.sessions.set(ws, session)
      this.broadcast({ type: 'presence', players: this.getPlayers() })
      return
    }

    if (parsed.type === 'chat') {
      const text = parsed.message.trim()
      if (!text) return
      const chat: ChatMessage = {
        id: crypto.randomUUID(),
        playerId: session.id,
        name: session.displayName,
        message: text.slice(0, 240),
        sentAt: Date.now()
      }
      this.chat.push(chat)
      this.broadcast({ type: 'chat', chat })
    }
  }

  webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws)
    this.broadcast({ type: 'presence', players: this.getPlayers() })
  }

  webSocketError(ws: WebSocket) {
    this.sessions.delete(ws)
    this.broadcast({ type: 'presence', players: this.getPlayers() })
  }

  broadcast(message: ServerMessage) {
    const payload = toServerMessage(message)
    for (const socket of this.sessions.keys()) {
      socket.send(payload)
    }
  }

  getPlayers(): Player[] {
    const players: Player[] = []
    for (const session of this.sessions.values()) {
      players.push({
        id: session.id,
        displayName: session.displayName,
        joinedAt: session.joinedAt,
        isHost: false,
        isConnected: true
      })
    }
    return players
  }
}
