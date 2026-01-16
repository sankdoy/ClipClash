import type {
  ChatMessage,
  Category,
  ClientMessage,
  DraftsByCategory,
  Phase,
  Player,
  RpsChoice,
  RoundEntry,
  RoundHistoryEntry,
  RoundResult,
  RoundState,
  ScoreboardEntry,
  ServerMessage,
  Settings,
  Submission,
  TieBreakState,
  TimerState
} from '../../../src/types'
import { z } from 'zod'

export interface Env {
  ROOMS_DO: DurableObjectNamespace
}

type Session = {
  playerId: string | null
  sessionToken: string | null
  displayName: string
  joinedAt: number
  lastChatAt: number
  lastVoteAt: number
  lastReportAt: number
  replacedByNew: boolean
}

type PlayerRecord = {
  id: string
  displayName: string
  joinedAt: number
  isConnected: boolean
  lastSeenAt?: number
}

type ReportEntry = {
  id: string
  messageId: string
  reporterId: string
  reportedAt: number
}

type PersistedState = {
  phase: Phase
  settings: Settings
  timer: TimerState
  chat: ChatMessage[]
  players: PlayerRecord[]
  categories: Category[]
  draftsByPlayer: Record<string, DraftsByCategory>
  submissions: Record<string, Submission[]>
  categoryIndex: number
  round: RoundState | null
  tiebreak: TieBreakState | null
  votesByPlayer: Record<string, string>
  scoreboard: ScoreboardEntry[]
  history: RoundHistoryEntry[]
  hostId?: string
  sessionTokens: Record<string, string>
  reports: ReportEntry[]
}

const defaultSettings: Settings = {
  minTime: 3,
  maxTime: 20,
  defaultTime: 10,
  voteTickSeconds: 5,
  voteThreshold: 0.8
}

const defaultCategories = [
  { id: 'cutest', name: 'Cutest' },
  { id: 'funniest', name: 'Funniest' },
  { id: 'out-of-pocket', name: 'Most out of pocket' },
  { id: 'cringe', name: 'Cringiest' },
  { id: 'satisfying', name: 'Most satisfying' },
  { id: 'weirdest', name: 'Weirdest' }
]

const bannedWords = ['slur', 'hate', 'abuse']
const chatCooldownMs = 800
const voteCooldownMs = 400
const reportCooldownMs = 3000

const helloSchema = z.object({
  type: z.literal('hello'),
  sessionToken: z.string().min(1).optional()
})

const updateNameSchema = z.object({
  type: z.literal('update_name'),
  name: z.string().min(1).max(24)
})

const chatSchema = z.object({
  type: z.literal('chat'),
  message: z.string().min(1).max(240)
})

const voteTimeSchema = z.object({
  type: z.literal('vote_time'),
  direction: z.enum(['higher', 'lower', 'neutral'])
})

const startHuntSchema = z.object({ type: z.literal('start_hunt') })
const resetMatchSchema = z.object({ type: z.literal('reset_match') })

const updateCategoriesSchema = z.object({
  type: z.literal('update_categories'),
  categories: z.array(z.object({ id: z.string().optional(), name: z.string() }))
})

const saveDraftSchema = z.object({
  type: z.literal('save_draft'),
  categoryId: z.string().min(1),
  url: z.string().max(400)
})

const submitSubmissionSchema = z.object({
  type: z.literal('submit_submission'),
  categoryId: z.string().min(1),
  url: z.string().min(1).max(400)
})

const voteSubmissionSchema = z.object({
  type: z.literal('vote_submission'),
  entryId: z.string().min(1)
})

const rpsSchema = z.object({
  type: z.literal('rps_choice'),
  choice: z.enum(['rock', 'paper', 'scissors'])
})

const reportSchema = z.object({
  type: z.literal('report'),
  messageId: z.string().min(1)
})

const clientMessageSchema = z.union([
  helloSchema,
  updateNameSchema,
  chatSchema,
  voteTimeSchema,
  startHuntSchema,
  resetMatchSchema,
  updateCategoriesSchema,
  saveDraftSchema,
  submitSubmissionSchema,
  voteSubmissionSchema,
  rpsSchema,
  reportSchema
])

function containsBannedWord(text: string) {
  const lowered = text.toLowerCase()
  return bannedWords.some((word) => lowered.includes(word))
}

function safeJsonParse(value: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(value)
    const result = clientMessageSchema.safeParse(parsed)
    return result.success ? (result.data as ClientMessage) : null
  } catch {
    return null
  }
}

function toServerMessage(message: ServerMessage) {
  return JSON.stringify(message)
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateSessionToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export function resolveSessionToken(
  tokenToPlayerId: Map<string, string>,
  token: string | undefined,
  createPlayerId: () => string,
  createToken: () => string
) {
  if (token && tokenToPlayerId.has(token)) {
    return { playerId: tokenToPlayerId.get(token)!, sessionToken: token, isNew: false }
  }
  const playerId = createPlayerId()
  const sessionToken = createToken()
  tokenToPlayerId.set(sessionToken, playerId)
  return { playerId, sessionToken, isNew: true }
}

export function replaceSocketForToken(
  tokenToSocket: Map<string, WebSocket>,
  sessionToken: string,
  socket: WebSocket
) {
  const existing = tokenToSocket.get(sessionToken)
  if (existing && existing !== socket) {
    tokenToSocket.set(sessionToken, socket)
    return existing
  }
  tokenToSocket.set(sessionToken, socket)
  return null
}

export function selectHost(currentHostId: string | null, candidateId: string) {
  return currentHostId ?? candidateId
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
  players: Map<string, PlayerRecord>
  chat: ChatMessage[]
  phase: Phase
  settings: Settings
  timer: TimerState
  voteIntent: Map<string, 'higher' | 'lower' | 'neutral'>
  categories: Category[]
  draftsByPlayer: Map<string, DraftsByCategory>
  round: RoundState | null
  categoryIndex: number
  votesByPlayer: Map<string, string>
  submissions: Map<string, Map<string, Submission>>
  tiebreak: TieBreakState | null
  scoreboard: Map<string, ScoreboardEntry>
  history: RoundHistoryEntry[]
  reports: ReportEntry[]
  hostId: string | null
  tokenToPlayerId: Map<string, string>
  tokenToSocket: Map<string, WebSocket>

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Map()
    this.players = new Map()
    this.chat = []
    this.phase = 'lobby'
    this.settings = { ...defaultSettings }
    this.timer = {
      targetMinutes: this.settings.defaultTime,
      huntRemainingSeconds: null,
      intermissionRemainingSeconds: null,
      voteHigherCount: 0,
      voteLowerCount: 0,
      playerCount: 0,
      lastTickAt: Date.now()
    }
    this.voteIntent = new Map()
    this.categories = [...defaultCategories]
    this.round = null
    this.categoryIndex = 0
    this.votesByPlayer = new Map()
    this.submissions = new Map()
    this.draftsByPlayer = new Map()
    this.tiebreak = null
    this.scoreboard = new Map()
    this.history = []
    this.reports = []
    this.hostId = null
    this.tokenToPlayerId = new Map()
    this.tokenToSocket = new Map()

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<PersistedState>('room_state')
      if (!stored) return
      this.phase = stored.phase
      this.settings = stored.settings
      this.timer = stored.timer
      this.chat = stored.chat ?? []
      this.players = new Map((stored.players ?? []).map((player) => [player.id, player]))
      this.categories = stored.categories ?? [...defaultCategories]
      this.draftsByPlayer = new Map(
        Object.entries(stored.draftsByPlayer ?? {}).map(([playerId, drafts]) => [playerId, drafts])
      )
      this.categoryIndex = stored.categoryIndex ?? 0
      this.round = stored.round
      this.tiebreak = stored.tiebreak
      this.votesByPlayer = new Map(Object.entries(stored.votesByPlayer ?? {}))
      this.scoreboard = new Map((stored.scoreboard ?? []).map((entry) => [entry.entryId, entry]))
      this.history = stored.history ?? []
      this.hostId = stored.hostId ?? null
      this.tokenToPlayerId = new Map(Object.entries(stored.sessionTokens ?? {}))
      this.reports = stored.reports ?? []
      this.submissions = new Map(
        Object.entries(stored.submissions ?? {}).map(([categoryId, items]) => [
          categoryId,
          new Map(items.map((item) => [item.playerId, item]))
        ])
      )
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const session: Session = {
      playerId: null,
      sessionToken: null,
      displayName: 'Player',
      joinedAt: Date.now(),
      lastChatAt: 0,
      lastVoteAt: 0,
      lastReportAt: 0,
      replacedByNew: false
    }

    this.state.acceptWebSocket(server)
    this.sessions.set(server, session)

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

    if (parsed.type !== 'hello' && !session.playerId) {
      ws.send(toServerMessage({ type: 'error', message: 'Not authenticated.' }))
      return
    }

    if (parsed.type === 'hello') {
      if (session.playerId && session.sessionToken) {
        return
      }

      const token = parsed.sessionToken?.trim()
      const resolved = resolveSessionToken(
        this.tokenToPlayerId,
        token,
        () => crypto.randomUUID(),
        generateSessionToken
      )
      const playerId = resolved.playerId
      const sessionToken = resolved.sessionToken

      const existingRecord = this.players.get(playerId)
      if (existingRecord) {
        this.players.set(playerId, { ...existingRecord, isConnected: true })
        session.displayName = existingRecord.displayName
        session.joinedAt = existingRecord.joinedAt
      } else {
        this.players.set(playerId, {
          id: playerId,
          displayName: session.displayName,
          joinedAt: session.joinedAt,
          isConnected: true
        })
      }

      this.hostId = selectHost(this.hostId, playerId)

      const existingSocket = replaceSocketForToken(this.tokenToSocket, sessionToken, ws)
      if (existingSocket) {
        const existingSession = this.sessions.get(existingSocket)
        if (existingSession) {
          existingSession.replacedByNew = true
          this.sessions.set(existingSocket, existingSession)
        }
        existingSocket.close(1000, 'Replaced by new connection')
        this.sessions.delete(existingSocket)
      }

      session.playerId = playerId
      session.sessionToken = sessionToken
      this.sessions.set(ws, session)
      this.tokenToSocket.set(sessionToken, ws)

      ws.send(
        toServerMessage({
          type: 'welcome',
          sessionToken,
          playerId,
          roomId: this.state.id.toString(),
          phase: this.phase,
          players: this.getPlayers(),
          chat: this.chat,
          settings: this.settings,
          timer: this.timer,
          categories: this.categories,
          scoreboard: this.getScoreboard(),
          history: this.history,
          drafts: this.getDrafts(playerId),
          reportCount: this.reports.length
        })
      )

      this.broadcast({ type: 'presence', players: this.getPlayers() })
      this.persistState()
      return
    }

    if (parsed.type === 'update_name') {
      if (!session.playerId) return
      session.displayName = parsed.name.trim().slice(0, 24)
      this.sessions.set(ws, session)
      const record = this.players.get(session.playerId)
      if (record) {
        this.players.set(session.playerId, {
          ...record,
          displayName: session.displayName,
          isConnected: true
        })
      }
      this.broadcast({ type: 'presence', players: this.getPlayers() })
      this.persistState()
      return
    }

    if (parsed.type === 'chat') {
      if (Date.now() - session.lastChatAt < chatCooldownMs) {
        ws.send(toServerMessage({ type: 'error', message: 'Slow down.' }))
        return
      }
      const text = parsed.message.trim()
      if (!text) return
      if (containsBannedWord(text)) {
        ws.send(toServerMessage({ type: 'error', message: 'Message blocked by moderation.' }))
        return
      }
      const chat: ChatMessage = {
        id: crypto.randomUUID(),
        playerId: session.playerId!,
        name: session.displayName,
        message: text.slice(0, 240),
        sentAt: Date.now()
      }
      session.lastChatAt = Date.now()
      this.chat.push(chat)
      this.broadcast({ type: 'chat', chat })
      this.persistState()
    }

    if (parsed.type === 'vote_time') {
      if (this.phase !== 'lobby') return
      if (Date.now() - session.lastVoteAt < voteCooldownMs) return
      this.voteIntent.set(session.playerId!, parsed.direction)
      session.lastVoteAt = Date.now()
      return
    }

    if (parsed.type === 'start_hunt') {
      if (this.phase !== 'lobby') return
      if (this.hostId !== session.playerId) return
      this.phase = 'hunt'
      this.timer.huntRemainingSeconds = this.timer.targetMinutes * 60
      this.timer.intermissionRemainingSeconds = null
      this.timer.lastTickAt = Date.now()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      await this.ensureAlarm()
    }

    if (parsed.type === 'reset_match') {
      if (this.hostId !== session.playerId) return
      this.resetMatch()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      this.broadcast({ type: 'scoreboard', scoreboard: this.getScoreboard(), history: this.history })
      this.persistState()
      await this.ensureAlarm()
    }

    if (parsed.type === 'update_categories') {
      if (this.hostId !== session.playerId) return
      if (this.phase !== 'lobby') return
      const cleaned = this.cleanCategories(parsed.categories)
      if (!cleaned) {
        ws.send(toServerMessage({ type: 'error', message: 'Invalid categories.' }))
        return
      }
      this.categories = cleaned
      this.categoryIndex = 0
      this.pruneSubmissions(cleaned)
      this.pruneDrafts(cleaned)
      this.broadcast({ type: 'categories', categories: this.categories })
      this.persistState()
    }

    if (parsed.type === 'vote_submission') {
      if (this.phase !== 'rounds' || !this.round) return
      if (this.tiebreak) return
      if (Date.now() - session.lastVoteAt < voteCooldownMs) return
      const entry = this.round.entries.find((item) => item.id === parsed.entryId)
      if (!entry) return
      this.votesByPlayer.set(session.playerId!, parsed.entryId)
      session.lastVoteAt = Date.now()
      this.round.votesByEntryId = this.tallyVotes()
      this.broadcast({ type: 'round_start', round: this.round })
      this.persistState()
    }

    if (parsed.type === 'rps_choice') {
      if (this.phase !== 'rounds' || !this.tiebreak) return
      if (!this.tiebreak.entryIds.includes(session.playerId!)) return
      this.tiebreak.choicesByEntryId[session.playerId!] = parsed.choice
      const winner = this.resolveRpsWinner(this.tiebreak)
      if (winner) {
        this.tiebreak.winnerEntryId = winner
        this.broadcast({ type: 'tiebreak_result', tiebreak: this.tiebreak })
        this.concludeRoundWithWinner(winner)
      } else {
        this.broadcast({ type: 'tiebreak_start', tiebreak: this.tiebreak })
      }
      this.persistState()
    }

    if (parsed.type === 'report') {
      if (Date.now() - session.lastReportAt < reportCooldownMs) return
      this.reports.push({
        id: crypto.randomUUID(),
        messageId: parsed.messageId,
        reporterId: session.playerId!,
        reportedAt: Date.now()
      })
      session.lastReportAt = Date.now()
      ws.send(toServerMessage({ type: 'report_received', messageId: parsed.messageId }))
    }

    if (parsed.type === 'save_draft') {
      const url = parsed.url.trim()
      if (!this.categories.find((category) => category.id === parsed.categoryId)) {
        ws.send(toServerMessage({ type: 'error', message: 'Unknown category.' }))
        return
      }
      const drafts = this.draftsByPlayer.get(session.playerId!) ?? {}
      const next = { ...drafts, [parsed.categoryId]: url.slice(0, 400) }
      this.draftsByPlayer.set(session.playerId!, next)
      ws.send(toServerMessage({ type: 'drafts', drafts: next }))
      this.persistState()
    }

    if (parsed.type === 'submit_submission') {
      if (this.phase !== 'hunt') {
        ws.send(toServerMessage({ type: 'error', message: 'Submissions are closed.' }))
        return
      }
      const url = parsed.url.trim()
      if (!this.categories.find((category) => category.id === parsed.categoryId)) {
        ws.send(toServerMessage({ type: 'error', message: 'Unknown category.' }))
        return
      }
      if (!url.toLowerCase().includes('tiktok.com')) {
        ws.send(toServerMessage({ type: 'error', message: 'Only TikTok URLs are allowed.' }))
        return
      }
      const now = Date.now()
      const entry: Submission = {
        playerId: session.playerId!,
        categoryId: parsed.categoryId,
        url,
        createdAt: now,
        updatedAt: now
      }
      const categoryMap = this.submissions.get(parsed.categoryId) ?? new Map()
      const existing = categoryMap.get(session.playerId!)
      if (existing) {
        entry.createdAt = existing.createdAt
      }
      categoryMap.set(session.playerId!, entry)
      this.submissions.set(parsed.categoryId, categoryMap)
      ws.send(
        toServerMessage({
          type: 'submission_saved',
          categoryId: parsed.categoryId,
          url,
          updatedAt: now
        })
      )
      const drafts = this.draftsByPlayer.get(session.playerId!) ?? {}
      if (drafts[parsed.categoryId]) {
        const next = { ...drafts }
        delete next[parsed.categoryId]
        this.draftsByPlayer.set(session.playerId!, next)
        ws.send(toServerMessage({ type: 'drafts', drafts: next }))
      }
      this.persistState()
    }
  }

  webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws)
    if (session?.sessionToken) {
      const current = this.tokenToSocket.get(session.sessionToken)
      if (current === ws) {
        this.tokenToSocket.delete(session.sessionToken)
      }
    }
    if (session?.playerId && !session.replacedByNew) {
      this.voteIntent.delete(session.playerId)
      const record = this.players.get(session.playerId)
      if (record) {
        this.players.set(session.playerId, {
          ...record,
          isConnected: false,
          lastSeenAt: Date.now()
        })
      }
    }
    this.sessions.delete(ws)
    if (session?.playerId === this.hostId) {
      this.hostId = this.pickNewHost()
    }
    this.broadcast({ type: 'presence', players: this.getPlayers() })
    this.persistState()
  }

  webSocketError(ws: WebSocket) {
    const session = this.sessions.get(ws)
    if (session?.sessionToken) {
      const current = this.tokenToSocket.get(session.sessionToken)
      if (current === ws) {
        this.tokenToSocket.delete(session.sessionToken)
      }
    }
    if (session?.playerId && !session.replacedByNew) {
      this.voteIntent.delete(session.playerId)
      const record = this.players.get(session.playerId)
      if (record) {
        this.players.set(session.playerId, {
          ...record,
          isConnected: false,
          lastSeenAt: Date.now()
        })
      }
    }
    this.sessions.delete(ws)
    if (session?.playerId === this.hostId) {
      this.hostId = this.pickNewHost()
    }
    this.broadcast({ type: 'presence', players: this.getPlayers() })
    this.persistState()
  }

  broadcast(message: ServerMessage) {
    const payload = toServerMessage(message)
    for (const socket of this.sessions.keys()) {
      socket.send(payload)
    }
  }

  getPlayers(): Player[] {
    const players: Player[] = []
    for (const record of this.players.values()) {
      players.push({
        id: record.id,
        displayName: record.displayName,
        joinedAt: record.joinedAt,
        isHost: record.id === this.hostId,
        isConnected: record.isConnected,
        lastSeenAt: record.lastSeenAt
      })
    }
    return players.sort((a, b) => a.joinedAt - b.joinedAt)
  }

  async alarm() {
    if (this.phase === 'lobby') {
      this.applyVoteTick()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      await this.ensureAlarm()
      return
    }

    if (this.phase === 'hunt') {
      if (this.timer.huntRemainingSeconds !== null) {
        this.timer.huntRemainingSeconds = Math.max(0, this.timer.huntRemainingSeconds - 1)
      }
      if (this.timer.huntRemainingSeconds === 0) {
        this.phase = 'intermission'
        this.timer.intermissionRemainingSeconds = 30
        this.timer.huntRemainingSeconds = null
      }
      this.timer.lastTickAt = Date.now()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      await this.ensureAlarm()
      return
    }

    if (this.phase === 'intermission') {
      if (this.timer.intermissionRemainingSeconds !== null) {
        this.timer.intermissionRemainingSeconds = Math.max(0, this.timer.intermissionRemainingSeconds - 1)
      }
      if (this.timer.intermissionRemainingSeconds === 0) {
        this.timer.intermissionRemainingSeconds = null
        this.phase = 'rounds'
        this.startNextRound()
      }
      this.timer.lastTickAt = Date.now()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      await this.ensureAlarm()
      return
    }

    if (this.phase === 'rounds') {
      if (this.tiebreak) {
        if (this.tiebreak.remainingSeconds !== null) {
          this.tiebreak.remainingSeconds = Math.max(0, this.tiebreak.remainingSeconds - 1)
        }
        if (this.tiebreak.remainingSeconds === 0) {
          const fallbackWinner = this.pickRandom(this.tiebreak.entryIds)
          this.tiebreak.winnerEntryId = fallbackWinner
          this.broadcast({ type: 'tiebreak_result', tiebreak: this.tiebreak })
          this.concludeRoundWithWinner(fallbackWinner)
          return
        }
        this.broadcast({ type: 'tiebreak_start', tiebreak: this.tiebreak })
        await this.ensureAlarm()
        await this.persistState()
        return
      }

      if (!this.round || this.round.remainingSeconds === null) {
        this.startNextRound()
      } else {
        this.round.remainingSeconds = Math.max(0, this.round.remainingSeconds - 1)
        if (this.round.remainingSeconds === 0) {
          this.finishRound()
        } else {
          this.broadcast({ type: 'round_start', round: this.round })
        }
      }
      await this.persistState()
      await this.ensureAlarm()
    }
  }

  applyVoteTick() {
    const playerCount = this.sessions.size
    const higherVotes = Array.from(this.voteIntent.values()).filter((v) => v === 'higher').length
    const lowerVotes = Array.from(this.voteIntent.values()).filter((v) => v === 'lower').length
    this.timer.playerCount = playerCount
    this.timer.voteHigherCount = higherVotes
    this.timer.voteLowerCount = lowerVotes
    this.timer.lastTickAt = Date.now()

    if (playerCount === 0) return
    const threshold = this.settings.voteThreshold
    if (higherVotes / playerCount >= threshold) {
      this.timer.targetMinutes = Math.min(this.settings.maxTime, this.timer.targetMinutes + 1)
    } else if (lowerVotes / playerCount >= threshold) {
      this.timer.targetMinutes = Math.max(this.settings.minTime, this.timer.targetMinutes - 1)
    }
    this.persistState()
  }

  async ensureAlarm() {
    if (this.phase === 'lobby') {
      await this.state.storage.setAlarm(Date.now() + this.settings.voteTickSeconds * 1000)
      return
    }
    if (this.phase === 'hunt' || this.phase === 'intermission') {
      await this.state.storage.setAlarm(Date.now() + 1000)
      return
    }
    if (this.phase === 'rounds') {
      await this.state.storage.setAlarm(Date.now() + 1000)
    }
  }

  startNextRound() {
    if (this.categoryIndex >= this.categories.length) {
      this.phase = 'results'
      this.round = null
      this.tiebreak = null
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      this.broadcast({ type: 'scoreboard', scoreboard: this.getScoreboard(), history: this.history })
      this.persistState()
      return
    }
    const category = this.categories[this.categoryIndex]
    this.categoryIndex += 1
    const entries = this.buildRoundEntries(category.id)
    this.round = {
      categoryId: category.id,
      categoryName: category.name,
      entries,
      votesByEntryId: {},
      remainingSeconds: entries.length > 0 ? 20 : 3
    }
    this.votesByPlayer.clear()
    this.tiebreak = null
    this.broadcast({ type: 'round_start', round: this.round })
    this.persistState()
  }

  finishRound() {
    if (!this.round) return
    const votes = this.round.votesByEntryId
    const topEntries = this.pickTopEntries(votes)
    if (topEntries.length === 0) {
      this.round = null
      this.persistState()
      return
    }
    if (topEntries.length === 1) {
      this.concludeRoundWithWinner(topEntries[0])
      return
    }
    this.startTiebreak(topEntries)
  }

  buildRoundEntries(categoryId: string): RoundEntry[] {
    const entries: RoundEntry[] = []
    let index = 1
    const categoryMap = categoryId ? this.submissions.get(categoryId) : undefined
    if (!categoryMap) return entries
    for (const submission of categoryMap.values()) {
      entries.push({
        id: submission.playerId,
        label: `TikTok ${index}`,
        url: submission.url
      })
      index += 1
    }
    return entries
  }

  tallyVotes(): Record<string, number> {
    const tally: Record<string, number> = {}
    for (const entry of this.votesByPlayer.values()) {
      tally[entry] = (tally[entry] ?? 0) + 1
    }
    return tally
  }

  pickWinner(votes: Record<string, number>) {
    let winnerId: string | null = null
    let top = -1
    for (const [entryId, count] of Object.entries(votes)) {
      if (count > top) {
        top = count
        winnerId = entryId
      }
    }
    return winnerId
  }

  pickTopEntries(votes: Record<string, number>) {
    let top = -1
    const entries: string[] = []
    for (const [entryId, count] of Object.entries(votes)) {
      if (count > top) {
        top = count
        entries.length = 0
        entries.push(entryId)
      } else if (count === top) {
        entries.push(entryId)
      }
    }
    return entries
  }

  startTiebreak(entryIds: string[]) {
    this.tiebreak = {
      entryIds,
      choicesByEntryId: {},
      remainingSeconds: 10
    }
    this.broadcast({ type: 'tiebreak_start', tiebreak: this.tiebreak })
    this.persistState()
  }

  resolveRpsWinner(tiebreak: TieBreakState) {
    const choices = tiebreak.choicesByEntryId
    const entries = tiebreak.entryIds.filter((entryId) => choices[entryId])
    if (entries.length < tiebreak.entryIds.length) {
      return null
    }
    const byChoice: Record<RpsChoice, string[]> = {
      rock: [],
      paper: [],
      scissors: []
    }
    for (const entryId of entries) {
      const choice = choices[entryId]
      byChoice[choice].push(entryId)
    }
    const nonEmpty = Object.entries(byChoice).filter(([, list]) => list.length > 0)
    if (nonEmpty.length === 1) {
      return this.pickRandom(nonEmpty[0][1])
    }
    if (nonEmpty.length === 3) {
      return this.pickRandom(entries)
    }
    const [first, second] = nonEmpty.map(([choice]) => choice as RpsChoice)
    const winningChoice = this.pickWinningChoice(first, second)
    const winners = byChoice[winningChoice]
    if (winners.length === 0) {
      return this.pickRandom(entries)
    }
    return this.pickRandom(winners)
  }

  pickWinningChoice(a: RpsChoice, b: RpsChoice): RpsChoice {
    if (a === b) return a
    if (a === 'rock' && b === 'scissors') return 'rock'
    if (a === 'scissors' && b === 'paper') return 'scissors'
    if (a === 'paper' && b === 'rock') return 'paper'
    return b
  }

  pickRandom(entries: string[]) {
    const idx = Math.floor(Math.random() * entries.length)
    return entries[idx]
  }

  concludeRoundWithWinner(winnerId: string) {
    if (!this.round) return
    const result: RoundResult = {
      categoryId: this.round.categoryId,
      winnerSubmissionId: winnerId,
      votesBySubmissionId: this.round.votesByEntryId
    }
    this.broadcast({ type: 'round_result', result })
    this.updateScoreboard(winnerId, this.round.categoryId, this.round.categoryName)
    this.broadcast({ type: 'scoreboard', scoreboard: this.getScoreboard(), history: this.history })
    this.round = null
    this.tiebreak = null
    this.persistState()
  }

  async persistState() {
    const submissions: Record<string, Submission[]> = {}
    for (const [categoryId, items] of this.submissions.entries()) {
      submissions[categoryId] = Array.from(items.values())
    }
    const votesByPlayer = Object.fromEntries(this.votesByPlayer.entries())
    const payload: PersistedState = {
      phase: this.phase,
      settings: this.settings,
      timer: this.timer,
      chat: this.chat,
      players: Array.from(this.players.values()),
      categories: this.categories,
      draftsByPlayer: Object.fromEntries(this.draftsByPlayer.entries()),
      submissions,
      categoryIndex: this.categoryIndex,
      round: this.round,
      tiebreak: this.tiebreak,
      votesByPlayer,
      scoreboard: this.getScoreboard(),
      history: this.history,
      hostId: this.hostId ?? undefined,
      sessionTokens: Object.fromEntries(this.tokenToPlayerId.entries()),
      reports: this.reports
    }
    await this.state.storage.put('room_state', payload)
  }

  resetMatch() {
    this.phase = 'lobby'
    this.timer = {
      targetMinutes: this.settings.defaultTime,
      huntRemainingSeconds: null,
      intermissionRemainingSeconds: null,
      voteHigherCount: 0,
      voteLowerCount: 0,
      playerCount: 0,
      lastTickAt: Date.now()
    }
    this.categoryIndex = 0
    this.round = null
    this.tiebreak = null
    this.votesByPlayer.clear()
    this.scoreboard.clear()
    this.history = []
  }

  pickNewHost() {
    const connected = Array.from(this.players.values()).filter((player) => player.isConnected)
    if (connected.length === 0) return null
    connected.sort((a, b) => a.joinedAt - b.joinedAt)
    return connected[0].id
  }

  updateScoreboard(winnerId: string, categoryId: string, categoryName: string) {
    const winnerRecord = this.players.get(winnerId)
    const winnerName = winnerRecord?.displayName ?? 'Player'
    const entry = this.scoreboard.get(winnerId)
    if (entry) {
      entry.wins += 1
      entry.displayName = winnerName
      this.scoreboard.set(winnerId, entry)
    } else {
      this.scoreboard.set(winnerId, { entryId: winnerId, displayName: winnerName, wins: 1 })
    }
    this.history.push({
      categoryId,
      categoryName,
      winnerEntryId: winnerId,
      winnerName
    })
  }

  getScoreboard() {
    return Array.from(this.scoreboard.values()).sort((a, b) => b.wins - a.wins)
  }

  getDrafts(playerId: string): DraftsByCategory {
    return this.draftsByPlayer.get(playerId) ?? {}
  }

  cleanCategories(categories: Category[]) {
    if (!Array.isArray(categories)) return null
    const cleaned: Category[] = []
    const seen = new Set<string>()
    for (const category of categories) {
      const name = category?.name?.trim()
      if (!name) continue
      const id = category.id?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)
      if (seen.has(id)) continue
      seen.add(id)
      cleaned.push({ id, name: name.slice(0, 32) })
    }
    if (cleaned.length < 3 || cleaned.length > 12) return null
    return cleaned
  }

  pruneSubmissions(categories: Category[]) {
    const allowed = new Set(categories.map((category) => category.id))
    for (const key of Array.from(this.submissions.keys())) {
      if (!allowed.has(key)) {
        this.submissions.delete(key)
      }
    }
  }

  pruneDrafts(categories: Category[]) {
    const allowed = new Set(categories.map((category) => category.id))
    for (const [playerId, drafts] of this.draftsByPlayer.entries()) {
      const next: DraftsByCategory = {}
      for (const [categoryId, url] of Object.entries(drafts)) {
        if (allowed.has(categoryId)) {
          next[categoryId] = url
        }
      }
      this.draftsByPlayer.set(playerId, next)
    }
  }
}
