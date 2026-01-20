/// <reference types="@cloudflare/workers-types" />
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
  SponsorSlot,
  TieBreakState,
  TimerState
} from '../../../src/types'
import { z } from 'zod'
import { isBlocked } from '../../../shared/moderation'
import { isTikTokUrl } from '../../../shared/tiktok'

export interface Env {
  ROOMS_DO: DurableObjectNamespace
  DB?: D1Database
  TWITCH_CLIENT_ID?: string
  TWITCH_CLIENT_SECRET?: string
}

type Session = {
  playerId: string | null
  sessionToken: string | null
  role: 'player' | 'audience'
  audienceId: string | null
  hostKeyVerified: boolean
  accountId: string | null
  accountUsername: string | null
  displayName: string
  joinedAt: number
  lastChatAt: number
  lastVoteAt: number
  lastReportAt: number
  lastReadyAt: number
  replacedByNew: boolean
}

type PlayerRecord = {
  id: string
  displayName: string
  joinedAt: number
  isConnected: boolean
  lastSeenAt?: number
  accountId?: string
}

type ReportEntry = {
  id: string
  messageId: string
  reporterId: string
  reportedAt: number
}

type TokenRecord = {
  playerId: string
  accountId?: string | null
}

type PersistedState = {
  phase: Phase
  settings: Settings
  timer: TimerState
  chat: ChatMessage[]
  players: PlayerRecord[]
  readyByPlayer: Record<string, boolean>
  doneByPlayer: Record<string, boolean>
  requiredDoneIds: string[]
  sponsorSlot?: SponsorSlot | null
  categories: Category[]
  draftsByPlayer: Record<string, DraftsByCategory>
  submissions: Record<string, Submission[]>
  categoryIndex: number
  round: RoundState | null
  tiebreak: TieBreakState | null
  votesByPlayer: Record<string, string>
  votesByAudience: Record<string, string>
  scoreboard: ScoreboardEntry[]
  history: RoundHistoryEntry[]
  hostId?: string
  sessionTokens: Record<string, TokenRecord | string>
  reports: ReportEntry[]
  playerAccounts: Record<string, string>
  resultsRecorded?: boolean
  inviteCode?: string
  isClosed?: boolean
  audienceCode?: string
  hostKeyHash?: string
  roomVisibility?: 'public' | 'private'
  roomCreatedAt?: number
  roomName?: string | null
}

const defaultSettings: Settings = {
  minTime: 3,
  maxTime: 20,
  defaultTime: 10,
  voteTickSeconds: 5,
  voteThreshold: 0.8,
  audienceModeEnabled: false,
  twitchLogin: ''
}

const defaultCategories = [
  { id: 'cutest', name: 'Cutest' },
  { id: 'funniest', name: 'Funniest' },
  { id: 'out-of-pocket', name: 'Most out of pocket' },
  { id: 'cringe', name: 'Cringiest' },
  { id: 'satisfying', name: 'Most satisfying' },
  { id: 'weirdest', name: 'Weirdest' }
]

const chatCooldownMs = 800
const voteCooldownMs = 400
const readyCooldownMs = 2000
const reportCooldownMs = 3000
const maxUrlLength = 4096
const roomCapacity = 10

const helloSchema = z.object({
  type: z.literal('hello'),
  sessionToken: z.string().min(1).optional(),
  inviteCode: z.string().min(1).optional(),
  audienceCode: z.string().min(1).optional(),
  hostKey: z.string().min(1).optional(),
  visibility: z.enum(['public', 'private']).optional()
})

const setRoomVisibilitySchema = z.object({
  type: z.literal('set_room_visibility'),
  visibility: z.enum(['public', 'private'])
})

const setRoomNameSchema = z.object({
  type: z.literal('set_room_name'),
  name: z.string().min(1).max(32)
})

const updateNameSchema = z.object({
  type: z.literal('update_name'),
  name: z.string().min(1).max(24)
})

const chatSchema = z.object({
  type: z.literal('chat'),
  message: z.string().min(1).max(200)
})

const setTimerSchema = z.object({
  type: z.literal('set_timer'),
  minutes: z.number().int().min(1)
})

const setReadySchema = z.object({
  type: z.literal('set_ready'),
  ready: z.boolean()
})

const setDoneSchema = z.object({
  type: z.literal('set_done'),
  done: z.boolean()
})

const startHuntSchema = z.object({ type: z.literal('start_hunt') })
const resetMatchSchema = z.object({ type: z.literal('reset_match') })
const closeRoomSchema = z.object({ type: z.literal('close_room') })
const rotateInviteSchema = z.object({ type: z.literal('rotate_invite') })
const assignHostSchema = z.object({ type: z.literal('assign_host'), playerId: z.string().min(1) })
const kickPlayerSchema = z.object({ type: z.literal('kick_player'), playerId: z.string().min(1) })

const updateCategoriesSchema = z.object({
  type: z.literal('update_categories'),
  categories: z.array(z.object({ id: z.string().optional(), name: z.string() }))
})

const saveDraftSchema = z.object({
  type: z.literal('save_draft'),
  categoryId: z.string().min(1),
  url: z.string().max(maxUrlLength)
})

const submitSubmissionSchema = z.object({
  type: z.literal('submit_submission'),
  categoryId: z.string().min(1),
  url: z.string().min(1).max(maxUrlLength)
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

const setAudienceModeSchema = z.object({
  type: z.literal('set_audience_mode'),
  enabled: z.boolean()
})

const setTwitchLoginSchema = z.object({
  type: z.literal('set_twitch_login'),
  login: z.string().optional()
})

const clientMessageSchema = z.union([
  helloSchema,
  updateNameSchema,
  chatSchema,
  setTimerSchema,
  setReadySchema,
  setDoneSchema,
  startHuntSchema,
  resetMatchSchema,
  closeRoomSchema,
  rotateInviteSchema,
  assignHostSchema,
  kickPlayerSchema,
  updateCategoriesSchema,
  saveDraftSchema,
  submitSubmissionSchema,
  voteSubmissionSchema,
  rpsSchema,
  reportSchema,
  setAudienceModeSchema,
  setRoomVisibilitySchema,
  setRoomNameSchema,
  setTwitchLoginSchema
])


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

function generateInviteCode() {
  return `room-${Math.random().toString(36).slice(2, 8)}`
}

async function hashHostKey(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function getCookie(headers: Headers, name: string) {
  const raw = headers.get('Cookie') ?? ''
  const parts = raw.split(';').map((part) => part.trim())
  const prefix = `${name}=`
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length))
    }
  }
  return null
}

async function resolveAccount(env: Env, request: Request) {
  if (!env.DB) return null
  const token = getCookie(request.headers, 'cc_session')
  if (!token) return null
  const result = await env.DB.prepare(
    'SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?'
  )
    .bind(token, new Date().toISOString())
    .first()
  return result ? { id: result.id as string, username: result.username as string } : null
}

export function resolveSessionToken(
  tokenToPlayerId: Map<string, TokenRecord>,
  token: string | undefined,
  accountId: string | null,
  createPlayerId: () => string,
  createToken: () => string
) {
  if (token && tokenToPlayerId.has(token)) {
    const record = tokenToPlayerId.get(token)!
    return { playerId: record.playerId, sessionToken: token, isNew: false, accountId: record.accountId ?? null }
  }
  const playerId = createPlayerId()
  const sessionToken = createToken()
  tokenToPlayerId.set(sessionToken, { playerId, accountId })
  return { playerId, sessionToken, isNew: true, accountId }
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

export class RoomsDOv2 implements DurableObject {
  state: DurableObjectState
  env: Env
  sessions: Map<WebSocket, Session>
  players: Map<string, PlayerRecord>
  readyByPlayer: Map<string, boolean>
  doneByPlayer: Map<string, boolean>
  requiredDoneIds: Set<string>
  votesByAudience: Map<string, string>
  sponsorSlot: SponsorSlot | null
  chat: ChatMessage[]
  phase: Phase
  settings: Settings
  timer: TimerState
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
  tokenToPlayerId: Map<string, TokenRecord>
  tokenToSocket: Map<string, WebSocket>
  playerAccounts: Map<string, string>
  resultsRecorded: boolean
  inviteCode: string | null
  isClosed: boolean
  audienceCode: string | null
  hostKeyHash: string | null
  roomVisibility: 'public' | 'private'
  roomCreatedAt: number
  roomName: string | null
  lastPublicSyncAt: number

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Map()
    this.players = new Map()
    this.readyByPlayer = new Map()
    this.doneByPlayer = new Map()
    this.requiredDoneIds = new Set()
    this.votesByAudience = new Map()
    this.sponsorSlot = null
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
    this.playerAccounts = new Map()
    this.resultsRecorded = false
    this.inviteCode = null
    this.isClosed = false
    this.audienceCode = null
    this.hostKeyHash = null
    this.roomVisibility = 'private'
    this.roomCreatedAt = Date.now()
    this.roomName = null
    this.lastPublicSyncAt = 0

    this.state.blockConcurrencyWhile(async () => {
      const stored = (await this.state.storage.get<PersistedState>('room_state')) ?? null
      if (!stored) return
      this.phase = stored.phase
      this.settings = { ...defaultSettings, ...(stored.settings ?? {}) }
      this.timer = stored.timer
      this.chat = stored.chat ?? []
      this.players = new Map((stored.players ?? []).map((player: PlayerRecord) => [player.id, player]))
      const readyRaw = stored.readyByPlayer ?? {}
      this.readyByPlayer = new Map(
        Object.entries(readyRaw as Record<string, boolean>).map(([id, ready]) => [id, ready])
      )
      const doneRaw = stored.doneByPlayer ?? {}
      this.doneByPlayer = new Map(
        Object.entries(doneRaw as Record<string, boolean>).map(([id, done]) => [id, done])
      )
      this.requiredDoneIds = new Set(stored.requiredDoneIds ?? [])
      const votesAudienceRaw = stored.votesByAudience ?? {}
      this.votesByAudience = new Map(
        Object.entries(votesAudienceRaw as Record<string, string>).map(([id, vote]) => [id, vote])
      )
      this.sponsorSlot = stored.sponsorSlot ?? null
      this.categories = stored.categories ?? [...defaultCategories]
      const draftsRaw = stored.draftsByPlayer ?? {}
      this.draftsByPlayer = new Map(
        Object.entries(draftsRaw as Record<string, DraftsByCategory>).map(([playerId, drafts]) => [
          playerId,
          drafts as DraftsByCategory
        ])
      )
      this.categoryIndex = stored.categoryIndex ?? 0
      this.round = stored.round
      this.tiebreak = stored.tiebreak
      const votesPlayerRaw = stored.votesByPlayer ?? {}
      this.votesByPlayer = new Map(
        Object.entries(votesPlayerRaw as Record<string, string>).map(([id, vote]) => [id, vote])
      )
      this.scoreboard = new Map(
        (stored.scoreboard ?? []).map((entry: ScoreboardEntry) => [entry.entryId, entry])
      )
      this.history = stored.history ?? []
      this.hostId = stored.hostId ?? null
      const storedTokens = stored.sessionTokens ?? {}
      this.tokenToPlayerId = new Map(
        Object.entries(storedTokens).map(([token, record]) => {
          if (typeof record === 'string') {
            return [token, { playerId: record, accountId: null }]
          }
          return [token, { playerId: record.playerId, accountId: record.accountId ?? null }]
        })
      )
      this.reports = stored.reports ?? []
      this.playerAccounts = new Map(Object.entries(stored.playerAccounts ?? {}))
      this.resultsRecorded = stored.resultsRecorded ?? false
      this.inviteCode = stored.inviteCode ?? null
      this.isClosed = stored.isClosed ?? false
      this.audienceCode = stored.audienceCode ?? null
      this.hostKeyHash = stored.hostKeyHash ?? null
      this.roomVisibility = stored.roomVisibility ?? 'private'
      this.roomCreatedAt = stored.roomCreatedAt ?? Date.now()
      this.roomName = stored.roomName ?? null
      const submissionsRaw = stored.submissions ?? {}
      this.submissions = new Map(
        Object.entries(submissionsRaw as Record<string, Submission[]>).map(([categoryId, items]) => [
          categoryId,
          new Map(
            (Array.isArray(items) ? (items as Submission[]) : []).map((item: Submission) => [item.playerId, item])
          )
        ])
      )
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const account = await resolveAccount(this.env, request)
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const session: Session = {
      playerId: null,
      sessionToken: null,
      role: 'player',
      audienceId: null,
      hostKeyVerified: false,
      accountId: account?.id ?? null,
      accountUsername: account?.username ?? null,
      displayName: 'Player',
      joinedAt: Date.now(),
      lastChatAt: 0,
      lastVoteAt: 0,
      lastReportAt: 0,
      lastReadyAt: 0,
      replacedByNew: false
    }

    this.state.acceptWebSocket(server)
    this.sessions.set(server, session)

    return new Response(null, { status: 101, webSocket: client })
  }

  isHost(session: Session) {
    return session.role === 'player' && session.playerId !== null && this.hostId === session.playerId
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const parsed = safeJsonParse(message)
    if (!parsed) {
      ws.send(toServerMessage({ type: 'error', message: 'Invalid message payload.' }))
      void this.logEvent({
        level: 'warn',
        eventType: 'ws_invalid_payload',
        message: 'Invalid message payload.'
      })
      return
    }

    const session = this.sessions.get(ws)
    if (!session) return

    if (parsed.type !== 'hello' && session.role === 'player' && !session.playerId) {
      ws.send(toServerMessage({ type: 'error', message: 'Not authenticated.' }))
      return
    }

    if (parsed.type === 'hello') {
      if (session.playerId && session.sessionToken) {
        return
      }
      if (this.isClosed) {
        ws.send(toServerMessage({ type: 'room_closed', message: 'Room closed by host.' }))
        ws.close(1000, 'Room closed')
        void this.logEvent({
          level: 'warn',
          eventType: 'room_closed_reject',
          message: 'Room closed by host.'
        })
        return
      }

      const audienceCode = parsed.audienceCode?.trim()
      if (audienceCode) {
        if (!this.settings.audienceModeEnabled) {
          ws.send(toServerMessage({ type: 'error', message: 'Audience Mode not enabled.' }))
          ws.close(1000, 'Audience disabled')
          void this.logEvent({
            level: 'warn',
            eventType: 'audience_reject_disabled',
            message: 'Audience Mode not enabled.'
          })
          return
        }
        if (!this.audienceCode || audienceCode !== this.audienceCode) {
          ws.send(toServerMessage({ type: 'error', message: 'Invalid audience code.' }))
          ws.close(1000, 'Invalid audience code')
          void this.logEvent({
            level: 'warn',
            eventType: 'audience_reject_code',
            message: 'Invalid audience code.'
          })
          return
        }
        session.role = 'audience'
        session.audienceId = crypto.randomUUID()
        session.sessionToken = generateSessionToken()
        this.sessions.set(ws, session)
        ws.send(
          toServerMessage({
            type: 'welcome',
            sessionToken: session.sessionToken,
            playerId: session.audienceId,
            roomId: this.state.id.toString(),
            phase: this.phase,
            players: this.getPlayers(),
            chat: this.chat,
            settings: this.settings,
            timer: this.timer,
            categories: this.categories,
            scoreboard: this.getScoreboard(),
            history: this.history,
            drafts: {},
            reportCount: this.reports.length,
            inviteCode: this.inviteCode ?? undefined,
            audienceCode: this.audienceCode ?? undefined,
            sponsorSlot: this.sponsorSlot,
            roomVisibility: this.roomVisibility,
            roomName: this.roomName ?? undefined
          })
        )
        this.broadcastRoomState()
        this.persistState()
        void this.logEvent({
          level: 'info',
          eventType: 'audience_join',
          playerId: session.audienceId,
          accountId: session.accountId ?? null
        })
        return
      }

      const incomingHostKey = parsed.hostKey?.trim() ?? null
      let hostKeyVerified = false
      if (incomingHostKey) {
        if (!this.hostKeyHash) {
          this.hostKeyHash = await hashHostKey(incomingHostKey)
          hostKeyVerified = true
        } else {
          const candidateHash = await hashHostKey(incomingHostKey)
          if (candidateHash !== this.hostKeyHash) {
            ws.send(toServerMessage({ type: 'error', message: 'Invalid host key.' }))
            ws.close(1000, 'Invalid host key')
            void this.logEvent({
              level: 'warn',
              eventType: 'hostkey_reject',
              message: 'Invalid host key.'
            })
            return
          }
          hostKeyVerified = true
        }
      }

      if (hostKeyVerified && this.players.size === 0 && !this.hostId) {
        const visibility = parsed.visibility === 'public' ? 'public' : 'private'
        this.roomVisibility = visibility
      }

      const token = parsed.sessionToken?.trim()
      const resolved = resolveSessionToken(
        this.tokenToPlayerId,
        token,
        session.accountId,
        () => crypto.randomUUID(),
        generateSessionToken
      )
      const playerId = resolved.playerId
      const sessionToken = resolved.sessionToken

      if (resolved.accountId && session.accountId && resolved.accountId !== session.accountId) {
        ws.send(toServerMessage({ type: 'error', message: 'Session token does not match this account.' }))
        ws.close(1000, 'Invalid session token')
        void this.logEvent({
          level: 'warn',
          eventType: 'session_token_mismatch',
          message: 'Session token does not match this account.'
        })
        return
      }

      if (session.accountId && !resolved.accountId && !resolved.isNew) {
        this.tokenToPlayerId.set(sessionToken, { playerId, accountId: session.accountId })
      }

      if (!this.inviteCode) {
        this.inviteCode = generateInviteCode()
      }
      if (
        resolved.isNew &&
        this.inviteCode &&
        parsed.inviteCode?.trim() !== this.inviteCode &&
        this.players.size > 0 &&
        !hostKeyVerified
      ) {
        ws.send(toServerMessage({ type: 'error', message: 'Invalid room code.' }))
        ws.close(1000, 'Invalid room code')
        void this.logEvent({
          level: 'warn',
          eventType: 'invite_reject',
          message: 'Invalid room code.'
        })
        return
      }

      const existingRecord = this.players.get(playerId)
      if (existingRecord) {
        this.players.set(playerId, { ...existingRecord, isConnected: true, accountId: session.accountId ?? existingRecord.accountId })
        session.displayName = existingRecord.displayName
        session.joinedAt = existingRecord.joinedAt
        if (!this.readyByPlayer.has(playerId)) {
          this.readyByPlayer.set(playerId, false)
        }
        if (!this.doneByPlayer.has(playerId)) {
          this.doneByPlayer.set(playerId, false)
        }
      } else {
        this.players.set(playerId, {
          id: playerId,
          displayName: session.displayName,
          joinedAt: session.joinedAt,
          isConnected: true,
          accountId: session.accountId ?? undefined
        })
        this.readyByPlayer.set(playerId, false)
        this.doneByPlayer.set(playerId, false)
      }

      if (session.accountId) {
        this.playerAccounts.set(playerId, session.accountId)
        if (session.accountUsername) {
          session.displayName = session.accountUsername
          const record = this.players.get(playerId)
          if (record) {
            this.players.set(playerId, { ...record, displayName: session.accountUsername })
          }
        }
      }

      if (hostKeyVerified) {
        this.hostId = playerId
      } else if (!this.hostId || this.players.size === 0) {
        this.hostId = playerId
      }

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
      session.hostKeyVerified = hostKeyVerified
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
          reportCount: this.reports.length,
          inviteCode: this.inviteCode ?? undefined,
          audienceCode: this.audienceCode ?? undefined,
          sponsorSlot: this.sponsorSlot,
          roomVisibility: this.roomVisibility,
          roomName: this.roomName ?? undefined
        })
      )

      this.broadcastRoomState()
      this.persistState()
      if (this.roomVisibility === 'public') {
        void this.syncPublicRoom(true)
      }
      void this.logEvent({
        level: 'info',
        eventType: 'player_join',
        playerId,
        accountId: session.accountId ?? null,
        meta: { host: this.hostId === playerId }
      })
      return
    }

    if (parsed.type === 'update_name') {
      if (session.role !== 'player') return
      if (!session.playerId) return
      if (session.accountUsername && parsed.name.trim() !== session.accountUsername) {
        ws.send(toServerMessage({ type: 'error', message: 'Use your account profile to change username.' }))
        return
      }
      if (isBlocked(parsed.name)) {
        ws.send(toServerMessage({ type: 'error', message: 'Display name blocked by moderation.' }))
        return
      }
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
      this.broadcastRoomState()
      this.persistState()
      return
    }

    if (parsed.type === 'chat') {
      if (session.role !== 'player') return
      if (Date.now() - session.lastChatAt < chatCooldownMs) {
        ws.send(toServerMessage({ type: 'error', message: 'Slow down.' }))
        return
      }
      const text = parsed.message.trim()
      if (!text) return
      if (isBlocked(text)) {
        ws.send(toServerMessage({ type: 'error', message: 'Message blocked by moderation.' }))
        return
      }
      const chat: ChatMessage = {
        id: crypto.randomUUID(),
        playerId: session.playerId!,
        name: session.displayName,
        message: text.slice(0, 200),
        sentAt: Date.now()
      }
      session.lastChatAt = Date.now()
      this.chat.push(chat)
      this.broadcast({ type: 'chat', chat })
      this.persistState()
    }

    if (parsed.type === 'set_timer') {
      if (session.role !== 'player') return
      if (this.phase !== 'lobby') return
      if (!this.isHost(session)) return
      const minutes = Math.min(this.settings.maxTime, Math.max(this.settings.minTime, parsed.minutes))
      this.timer.targetMinutes = minutes
      this.timer.huntRemainingSeconds = null
      this.timer.intermissionRemainingSeconds = null
      this.timer.voteHigherCount = 0
      this.timer.voteLowerCount = 0
      this.timer.playerCount = this.players.size
      this.timer.lastTickAt = Date.now()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      this.persistState()
      return
    }

    if (parsed.type === 'set_ready') {
      if (session.role !== 'player') return
      if (this.phase !== 'lobby') return
      if (Date.now() - session.lastReadyAt < readyCooldownMs) return
      this.readyByPlayer.set(session.playerId!, parsed.ready)
      session.lastReadyAt = Date.now()
      this.sessions.set(ws, session)
      this.broadcastRoomState()
      this.persistState()
      return
    }

    if (parsed.type === 'set_done') {
      if (session.role !== 'player') return
      if (this.phase !== 'hunt') return
      this.doneByPlayer.set(session.playerId!, parsed.done)
      this.broadcastRoomState()
      if (this.allRequiredDone()) {
        this.endHuntEarly()
      } else {
        this.persistState()
      }
      return
    }

    if (parsed.type === 'start_hunt') {
      if (session.role !== 'player') return
      if (this.phase !== 'lobby') return
      if (!this.isHost(session)) return
      if (!this.allPlayersReady()) {
        ws.send(toServerMessage({ type: 'error', message: 'Waiting for players to ready up.' }))
        return
      }
      if (!this.sponsorSlot) {
        this.sponsorSlot = await this.assignSponsorSlot()
      }
      this.requiredDoneIds = new Set(
        Array.from(this.players.values())
          .filter((player) => player.isConnected && player.id !== this.hostId)
          .map((player) => player.id)
      )
      for (const id of this.players.keys()) {
        this.doneByPlayer.set(id, false)
      }
      this.phase = 'hunt'
      this.timer.huntRemainingSeconds = this.timer.targetMinutes * 60
      this.timer.intermissionRemainingSeconds = null
      this.timer.lastTickAt = Date.now()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      await this.ensureAlarm()
    }

    if (parsed.type === 'reset_match') {
      if (session.role !== 'player') return
      if (!this.isHost(session)) return
      this.resetMatch()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      this.broadcast({ type: 'scoreboard', scoreboard: this.getScoreboard(), history: this.history })
      this.persistState()
      await this.ensureAlarm()
    }

    if (parsed.type === 'assign_host') {
      if (session.role !== 'player') return
      if (!this.isHost(session)) return
      const target = this.players.get(parsed.playerId)
      if (!target || !target.isConnected) return
      this.hostId = target.id
      void this.logEvent({
        level: 'info',
        eventType: 'assign_host',
        playerId: target.id,
        accountId: session.accountId ?? null
      })
      this.broadcastRoomState()
      this.persistState()
      return
    }

    if (parsed.type === 'kick_player') {
      if (session.role !== 'player') return
      if (!this.isHost(session)) return
      if (parsed.playerId === session.playerId) return
      void this.logEvent({
        level: 'info',
        eventType: 'kick_player',
        playerId: parsed.playerId,
        accountId: session.accountId ?? null
      })
      this.kickPlayer(parsed.playerId)
      this.broadcastRoomState()
      this.persistState()
      return
    }

    if (parsed.type === 'close_room') {
      if (!this.isHost(session)) return
      this.isClosed = true
      this.broadcast({ type: 'room_closed', message: 'Room closed by host.' })
      for (const socket of this.sessions.keys()) {
        socket.close(1000, 'Room closed')
      }
      void this.removePublicRoom()
      this.persistState()
      return
    }

    if (parsed.type === 'rotate_invite') {
      if (!this.isHost(session)) return
      this.inviteCode = generateInviteCode()
      this.broadcast({ type: 'invite_code', code: this.inviteCode })
      this.persistState()
      return
    }

    if (parsed.type === 'update_categories') {
      if (session.role !== 'player') return
      if (!this.isHost(session)) return
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

    if (parsed.type === 'set_audience_mode') {
      if (session.role !== 'player') return
      if (!this.isHost(session)) return
      if (!session.accountId) {
        ws.send(toServerMessage({ type: 'error', message: 'Sign in to enable Audience Mode.' }))
        return
      }
      const allowed = await this.hasAudienceEntitlement(session.accountId)
      if (!allowed) {
        ws.send(toServerMessage({ type: 'error', message: 'Audience Mode not owned.' }))
        return
      }
      this.settings = { ...this.settings, audienceModeEnabled: parsed.enabled }
      if (parsed.enabled && !this.audienceCode) {
        this.audienceCode = `aud-${Math.random().toString(36).slice(2, 8)}`
      }
      this.broadcast({ type: 'settings', settings: this.settings })
      this.broadcastRoomState()
      this.persistState()
    }

    if (parsed.type === 'set_room_visibility') {
      if (session.role !== 'player') return
      if (!this.isHost(session)) return
      this.roomVisibility = parsed.visibility
      if (this.roomVisibility === 'public') {
        void this.syncPublicRoom(true)
      } else {
        void this.removePublicRoom()
      }
      this.broadcastRoomState()
      this.persistState()
      return
    }

    if (parsed.type === 'set_room_name') {
      if (session.role !== 'player') return
      if (!this.isHost(session)) return
      this.roomName = parsed.name.trim().slice(0, 32)
      if (this.roomVisibility === 'public') {
        void this.syncPublicRoom(true)
      }
      this.broadcastRoomState()
      this.persistState()
      return
    }

    if (parsed.type === 'vote_submission') {
      if (this.phase !== 'rounds' || !this.round) return
      if (this.tiebreak) return
      if (Date.now() - session.lastVoteAt < voteCooldownMs) return
      const entry = this.round.entries.find((item) => item.id === parsed.entryId)
      if (!entry) return
      if (session.role === 'audience') {
        if (!session.audienceId) return
        this.votesByAudience.set(session.audienceId, parsed.entryId)
      } else {
        this.votesByPlayer.set(session.playerId!, parsed.entryId)
      }
      session.lastVoteAt = Date.now()
      this.round.votesByEntryId = this.tallyVotes()
      this.broadcast({ type: 'round_start', round: this.round })
      if (this.allConnectedPlayersVoted()) {
        this.finishRound()
      } else {
        this.persistState()
      }
    }

    if (parsed.type === 'rps_choice') {
      if (session.role !== 'player') return
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
      if (session.role !== 'player') return
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
      if (session.role !== 'player') return
      const url = parsed.url.trim()
      if (!this.categories.find((category) => category.id === parsed.categoryId)) {
        ws.send(toServerMessage({ type: 'error', message: 'Unknown category.' }))
        return
      }
      const drafts = this.draftsByPlayer.get(session.playerId!) ?? {}
      const next = { ...drafts, [parsed.categoryId]: url.slice(0, maxUrlLength) }
      this.draftsByPlayer.set(session.playerId!, next)
      ws.send(toServerMessage({ type: 'drafts', drafts: next }))
      this.persistState()
    }

    if (parsed.type === 'submit_submission') {
      if (session.role !== 'player') return
      if (this.phase !== 'hunt') {
        ws.send(toServerMessage({ type: 'error', message: 'Submissions are closed.' }))
        return
      }
      const url = parsed.url.trim()
      if (!this.categories.find((category) => category.id === parsed.categoryId)) {
        ws.send(toServerMessage({ type: 'error', message: 'Unknown category.' }))
        return
      }
      if (!isTikTokUrl(url)) {
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
      const record = this.players.get(session.playerId)
      if (record) {
        this.players.set(session.playerId, {
          ...record,
          isConnected: false,
          lastSeenAt: Date.now()
        })
      }
      this.readyByPlayer.set(session.playerId, false)
      this.doneByPlayer.set(session.playerId, false)
    }
    this.sessions.delete(ws)
    if (session?.playerId) {
      void this.logEvent({
        level: 'info',
        eventType: 'player_disconnect',
        playerId: session.playerId,
        accountId: session.accountId ?? null
      })
    }
    if (session?.playerId === this.hostId) {
      this.hostId = this.pickNewHost()
    }
    this.broadcastRoomState()
    if (this.roomVisibility === 'public') {
      void this.syncPublicRoom()
    }
    if (this.phase === 'hunt' && this.allRequiredDone()) {
      this.endHuntEarly()
      return
    }
    if (this.phase === 'rounds' && this.allConnectedPlayersVoted()) {
      this.finishRound()
      return
    }
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
      const record = this.players.get(session.playerId)
      if (record) {
        this.players.set(session.playerId, {
          ...record,
          isConnected: false,
          lastSeenAt: Date.now()
        })
      }
      this.readyByPlayer.set(session.playerId, false)
      this.doneByPlayer.set(session.playerId, false)
    }
    this.sessions.delete(ws)
    if (session?.playerId) {
      void this.logEvent({
        level: 'error',
        eventType: 'socket_error',
        playerId: session.playerId,
        accountId: session.accountId ?? null
      })
    }
    if (session?.playerId === this.hostId) {
      this.hostId = this.pickNewHost()
    }
    this.broadcastRoomState()
    if (this.roomVisibility === 'public') {
      void this.syncPublicRoom()
    }
    if (this.phase === 'hunt' && this.allRequiredDone()) {
      this.endHuntEarly()
      return
    }
    if (this.phase === 'rounds' && this.allConnectedPlayersVoted()) {
      this.finishRound()
      return
    }
    this.persistState()
  }

  broadcast(message: ServerMessage) {
    const payload = toServerMessage(message)
    for (const socket of this.sessions.keys()) {
      socket.send(payload)
    }
  }

  broadcastRoomState() {
    this.broadcast({
      type: 'room_state',
      phase: this.phase,
      players: this.getPlayers(),
      chat: this.chat,
      settings: this.settings,
      timer: this.timer,
      categories: this.categories,
      scoreboard: this.getScoreboard(),
      history: this.history,
      reportCount: this.reports.length,
      inviteCode: this.inviteCode ?? undefined,
      audienceCode: this.audienceCode ?? undefined,
      sponsorSlot: this.sponsorSlot,
      roomVisibility: this.roomVisibility,
      roomName: this.roomName ?? undefined
    })
    if (this.roomVisibility === 'public') {
      void this.syncPublicRoom()
    }
  }

  getConnectedPlayerCount() {
    return Array.from(this.players.values()).filter((player) => player.isConnected).length
  }

  getPublicRoomName() {
    if (this.roomName && this.roomName.trim().length > 0) {
      return this.roomName.trim()
    }
    const code = this.inviteCode ?? this.state.id.toString()
    return `Room ${code}`
  }

  async syncPublicRoom(force = false) {
    if (!this.env.DB) return
    if (this.roomVisibility !== 'public') {
      await this.removePublicRoom()
      return
    }
    const now = Date.now()
    if (!force && now - this.lastPublicSyncAt < 4000) return
    this.lastPublicSyncAt = now
    const playersCount = this.getConnectedPlayerCount()
    const name = this.getPublicRoomName()
    await this.env.DB.prepare(
      `INSERT INTO public_rooms (room_id, name, players, capacity, visibility, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(room_id) DO UPDATE SET
         name=excluded.name,
         players=excluded.players,
         capacity=excluded.capacity,
         visibility=excluded.visibility,
         last_seen_at=excluded.last_seen_at`
    )
      .bind(
        this.state.id.toString(),
        name,
        playersCount,
        roomCapacity,
        this.roomVisibility,
        now,
        this.roomCreatedAt
      )
      .run()
  }

  async removePublicRoom() {
    if (!this.env.DB) return
    await this.env.DB.prepare('DELETE FROM public_rooms WHERE room_id = ?')
      .bind(this.state.id.toString())
      .run()
  }

  async logEvent(options: {
    level: 'info' | 'warn' | 'error'
    eventType: string
    message?: string
    playerId?: string | null
    accountId?: string | null
    meta?: Record<string, unknown>
  }) {
    if (!this.env.DB) return
    const payload = {
      id: crypto.randomUUID(),
      level: options.level,
      event_type: options.eventType,
      message: options.message ?? null,
      room_id: this.state.id.toString(),
      player_id: options.playerId ?? null,
      account_id: options.accountId ?? null,
      meta_json: options.meta ? JSON.stringify(options.meta) : null,
      created_at: Date.now()
    }
    try {
      await this.env.DB
        .prepare(
          `INSERT INTO event_logs (id, level, event_type, message, room_id, player_id, account_id, meta_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          payload.id,
          payload.level,
          payload.event_type,
          payload.message,
          payload.room_id,
          payload.player_id,
          payload.account_id,
          payload.meta_json,
          payload.created_at
        )
        .run()
    } catch {
      return
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
        isReady: record.id === this.hostId ? true : this.readyByPlayer.get(record.id) ?? false,
        isDone: this.doneByPlayer.get(record.id) ?? false,
        lastSeenAt: record.lastSeenAt
      })
    }
    return players.sort((a, b) => a.joinedAt - b.joinedAt)
  }

  allRequiredDone() {
    if (this.requiredDoneIds.size === 0) return false
    const hostRecord = this.hostId ? this.players.get(this.hostId) : null
    if (!hostRecord?.isConnected) return false
    for (const id of this.requiredDoneIds.values()) {
      const record = this.players.get(id)
      if (!record?.isConnected) continue
      if (!this.doneByPlayer.get(id)) {
        return false
      }
    }
    return true
  }

  allConnectedPlayersVoted() {
    if (!this.round) return false
    const connected = Array.from(this.players.values()).filter((player) => player.isConnected)
    if (connected.length === 0) return false
    return connected.every((player) => this.votesByPlayer.has(player.id))
  }

  kickPlayer(playerId: string) {
    const record = this.players.get(playerId)
    if (!record) return
    this.players.delete(playerId)
    this.readyByPlayer.delete(playerId)
    this.doneByPlayer.delete(playerId)
    this.requiredDoneIds.delete(playerId)
    this.votesByPlayer.delete(playerId)
    this.playerAccounts.delete(playerId)
    this.scoreboard.delete(playerId)

    for (const [categoryId, submissions] of this.submissions.entries()) {
      submissions.delete(playerId)
      if (submissions.size === 0) {
        this.submissions.delete(categoryId)
      }
    }

    const drafts = this.draftsByPlayer.get(playerId)
    if (drafts) {
      this.draftsByPlayer.delete(playerId)
    }

    if (this.round) {
      this.round.entries = this.round.entries.filter((entry) => entry.id !== playerId)
      if (this.round.votesByEntryId[playerId]) {
        delete this.round.votesByEntryId[playerId]
      }
    }

    if (this.tiebreak) {
      this.tiebreak.entryIds = this.tiebreak.entryIds.filter((id) => id !== playerId)
      delete this.tiebreak.choicesByEntryId[playerId]
      if (this.tiebreak.entryIds.length === 1) {
        const winnerId = this.tiebreak.entryIds[0]
        this.tiebreak.winnerEntryId = winnerId
        this.broadcast({ type: 'tiebreak_result', tiebreak: this.tiebreak })
        this.concludeRoundWithWinner(winnerId)
      }
    }

    const tokensToRemove = Array.from(this.tokenToPlayerId.entries())
      .filter(([, value]) => value.playerId === playerId)
      .map(([token]) => token)
    for (const token of tokensToRemove) {
      this.tokenToPlayerId.delete(token)
      const socket = this.tokenToSocket.get(token)
      if (socket) {
        socket.close(1000, 'Kicked')
        this.tokenToSocket.delete(token)
        this.sessions.delete(socket)
      }
    }

    if (this.hostId === playerId) {
      this.hostId = this.pickNewHost()
    }
  }

  endHuntEarly() {
    if (this.phase !== 'hunt') return
    this.phase = 'intermission'
    this.timer.intermissionRemainingSeconds = 30
    this.timer.huntRemainingSeconds = null
    this.timer.lastTickAt = Date.now()
    this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
    this.persistState()
    this.ensureAlarm()
  }

  allPlayersReady() {
    for (const record of this.players.values()) {
      if (!record.isConnected) continue
      if (record.id === this.hostId) continue
      if (!this.readyByPlayer.get(record.id)) {
        return false
      }
    }
    return true
  }

  async alarm() {
    if (this.phase === 'lobby') {
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

  async ensureAlarm() {
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
      this.recordMatchStats()
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
    this.votesByAudience.clear()
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
    for (const entry of this.votesByAudience.values()) {
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
    const votesByAudience = Object.fromEntries(this.votesByAudience.entries())
    const payload: PersistedState = {
      phase: this.phase,
      settings: this.settings,
      timer: this.timer,
      chat: this.chat,
      players: Array.from(this.players.values()),
      readyByPlayer: Object.fromEntries(this.readyByPlayer.entries()),
      doneByPlayer: Object.fromEntries(this.doneByPlayer.entries()),
      requiredDoneIds: Array.from(this.requiredDoneIds.values()),
      sponsorSlot: this.sponsorSlot,
      categories: this.categories,
      draftsByPlayer: Object.fromEntries(this.draftsByPlayer.entries()),
      submissions,
      categoryIndex: this.categoryIndex,
      round: this.round,
      tiebreak: this.tiebreak,
      votesByPlayer,
      votesByAudience,
      scoreboard: this.getScoreboard(),
      history: this.history,
      hostId: this.hostId ?? undefined,
      sessionTokens: Object.fromEntries(this.tokenToPlayerId.entries()),
      reports: this.reports,
      playerAccounts: Object.fromEntries(this.playerAccounts.entries()),
      resultsRecorded: this.resultsRecorded,
      inviteCode: this.inviteCode ?? undefined,
      isClosed: this.isClosed,
      audienceCode: this.audienceCode ?? undefined,
      hostKeyHash: this.hostKeyHash ?? undefined,
      roomVisibility: this.roomVisibility,
      roomCreatedAt: this.roomCreatedAt,
      roomName: this.roomName ?? undefined
    }
    await this.state.storage.put('room_state', payload)
  }

  resetMatch() {
    this.phase = 'lobby'
    for (const key of this.readyByPlayer.keys()) {
      this.readyByPlayer.set(key, false)
    }
    for (const key of this.doneByPlayer.keys()) {
      this.doneByPlayer.set(key, false)
    }
    this.requiredDoneIds.clear()
    this.sponsorSlot = null
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
    this.votesByAudience.clear()
    this.scoreboard.clear()
    this.history = []
    this.resultsRecorded = false
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

  async recordMatchStats() {
    if (this.resultsRecorded) return
    if (!this.env.DB) return
    const accountIds = Array.from(new Set(this.playerAccounts.values()))
    if (accountIds.length === 0) return

    const winsByAccount = new Map<string, number>()
    for (const [playerId, entry] of this.scoreboard.entries()) {
      const accountId = this.playerAccounts.get(playerId)
      if (!accountId) continue
      winsByAccount.set(accountId, (winsByAccount.get(accountId) ?? 0) + entry.wins)
    }
    const topWins = Math.max(0, ...Array.from(winsByAccount.values()))
    const now = new Date().toISOString()

    for (const accountId of accountIds) {
      await this.env.DB.prepare(
        'UPDATE stats SET games_played = games_played + 1, updated_at = ? WHERE user_id = ?'
      )
        .bind(now, accountId)
        .run()
    }
    for (const [accountId, wins] of winsByAccount.entries()) {
      if (wins > 0) {
        await this.env.DB.prepare(
          'UPDATE stats SET category_wins = category_wins + ?, updated_at = ? WHERE user_id = ?'
        )
          .bind(wins, now, accountId)
          .run()
      }
    }
    if (topWins > 0) {
      for (const [accountId, wins] of winsByAccount.entries()) {
        if (wins === topWins) {
          await this.env.DB.prepare(
            'UPDATE stats SET wins = wins + 1, updated_at = ? WHERE user_id = ?'
          )
            .bind(now, accountId)
            .run()
        }
      }
    }
    this.resultsRecorded = true
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

  async hasAudienceEntitlement(accountId: string | null) {
    if (!accountId || !this.env.DB) return false
    const row = await this.env.DB.prepare(
      'SELECT has_audience_mode FROM entitlements WHERE user_id = ?'
    )
      .bind(accountId)
      .first()
    return row?.has_audience_mode === 1
  }

  async assignSponsorSlot() {
    if (!this.env.DB) return buildDefaultSponsorSlot()

    const WEIGHT_CAP = 5000
    const GUARANTEE_GAMES = 200
    const now = Date.now()
    const roomId = this.state.id.toString()
    const playerCount = this.getConnectedPlayerCount()
    const isStreamer = Boolean(this.settings.twitchLogin?.trim())
    const impressions = playerCount + (isStreamer ? 1 : 0)
    const minCredits = impressions <= 1 ? 1 : 2

    await this.env.DB.prepare(
      `UPDATE sponsor_balances
       SET games_since_last_placement = games_since_last_placement + 1
       WHERE credits_remaining > 0`
    ).run()

    const candidates = await this.env.DB.prepare(
      `SELECT s.id as sponsor_id,
              s.name as sponsor_name,
              c.id as campaign_id,
              c.creative_url,
              c.click_url,
              c.tagline,
              b.credits_remaining,
              b.current_weight,
              b.games_since_last_placement
       FROM sponsors s
       JOIN sponsor_campaigns_v2 c ON c.sponsor_id = s.id AND c.status = 'active'
       JOIN sponsor_balances b ON b.sponsor_id = s.id
       WHERE s.status = 'active' AND b.credits_remaining > 0`
    ).all()

    const eligible = (candidates.results ?? [])
      .map((row) => ({
        sponsorId: String(row.sponsor_id),
        sponsorName: String(row.sponsor_name ?? 'Sponsor'),
        campaignId: String(row.campaign_id),
        creativeUrl: String(row.creative_url ?? ''),
        clickUrl: String(row.click_url ?? '/sponsor'),
        tagline: String(row.tagline ?? ''),
        creditsRemaining: Number(row.credits_remaining ?? 0),
        currentWeight: Number(row.current_weight ?? 0),
        gamesSinceLast: Number(row.games_since_last_placement ?? 0)
      }))
      .filter((row) => row.creditsRemaining >= Math.max(minCredits, impressions))

    if (eligible.length === 0) {
      return buildDefaultSponsorSlot()
    }

    const lastRow = await this.env.DB.prepare(
      'SELECT sponsor_id_selected FROM games WHERE sponsor_id_selected IS NOT NULL ORDER BY created_at DESC LIMIT 1'
    ).first()
    const lastSponsorId = typeof lastRow?.sponsor_id_selected === 'string' ? lastRow.sponsor_id_selected : null

    const filterNoBackToBack = (list: typeof eligible) => {
      if (!lastSponsorId) return list
      const filtered = list.filter((row) => row.sponsorId !== lastSponsorId)
      return filtered.length > 0 ? filtered : list
    }

    const guaranteeEligible = filterNoBackToBack(
      eligible.filter((row) => row.gamesSinceLast >= GUARANTEE_GAMES)
    )

    let selected: typeof eligible[number] | null = null

    if (guaranteeEligible.length > 0) {
      guaranteeEligible.sort((a, b) => b.gamesSinceLast - a.gamesSinceLast)
      selected = guaranteeEligible[0]
    } else {
      const swrrPool = filterNoBackToBack(eligible)
      let totalWeight = 0
      const scored = swrrPool.map((row) => {
        const weight = Math.min(row.creditsRemaining, WEIGHT_CAP)
        totalWeight += weight
        return { ...row, weight, nextWeight: row.currentWeight + weight }
      })
      scored.sort((a, b) => b.nextWeight - a.nextWeight)
      selected = scored[0] ?? null

      if (selected) {
        for (const row of scored) {
          const nextWeight = row.sponsorId === selected.sponsorId
            ? row.nextWeight - totalWeight
            : row.nextWeight
          await this.env.DB.prepare(
            `UPDATE sponsor_balances
             SET current_weight = ?, updated_at = ?
             WHERE sponsor_id = ?`
          )
            .bind(nextWeight, now, row.sponsorId)
            .run()
        }
      }
    }

    if (!selected) {
      return buildDefaultSponsorSlot()
    }

    const nextRemaining = Math.max(selected.creditsRemaining - impressions, 0)
    await this.env.DB.prepare(
      `UPDATE sponsor_balances
       SET credits_remaining = ?,
           credits_spent_total = credits_spent_total + ?,
           games_since_last_placement = 0,
           last_shown_at = ?,
           updated_at = ?
       WHERE sponsor_id = ?`
    )
      .bind(nextRemaining, impressions, now, now, selected.sponsorId)
      .run()

    const gameId = crypto.randomUUID()
    await this.env.DB.prepare(
      `INSERT INTO games
        (id, created_at, is_streamer, player_count, sponsor_id_selected, sponsor_placement_shown)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(gameId, now, isStreamer ? 1 : 0, playerCount, selected.sponsorId, 1)
      .run()

    await this.env.DB.prepare(
      `INSERT INTO impression_ledger
        (id, sponsor_id, game_id, impressions_debited, players_count, streamer_mode, timestamp, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        selected.sponsorId,
        gameId,
        impressions,
        playerCount,
        isStreamer ? 1 : 0,
        now,
        'sponsor_placement'
      )
      .run()

    return {
      status: 'filled',
      sponsorName: selected.sponsorName,
      imageUrl: selected.creativeUrl,
      clickUrl: selected.clickUrl,
      tagline: selected.tagline
    } as SponsorSlot
  }
}

function buildDefaultSponsorSlot(): SponsorSlot {
  return {
    status: 'empty',
    sponsorName: 'me myself and i',
    imageUrl: '',
    clickUrl: '/sponsor',
    tagline: 'Sponsored by me myself and i, im awesome :)'
  }
}
