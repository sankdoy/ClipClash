import type {
  ChatMessage,
  ClientMessage,
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

export interface Env {
  ROOMS_DO: DurableObjectNamespace
}

type Session = {
  id: string
  displayName: string
  joinedAt: number
}

type PersistedState = {
  phase: Phase
  settings: Settings
  timer: TimerState
  chat: ChatMessage[]
  submissions: Record<string, Submission[]>
  categoryIndex: number
  round: RoundState | null
  tiebreak: TieBreakState | null
  votesByPlayer: Record<string, string>
  scoreboard: ScoreboardEntry[]
  history: RoundHistoryEntry[]
  hostId?: string
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
  timer: TimerState
  voteIntent: Map<string, 'higher' | 'lower' | 'neutral'>
  round: RoundState | null
  categoryIndex: number
  votesByPlayer: Map<string, string>
  submissions: Map<string, Map<string, Submission>>
  tiebreak: TieBreakState | null
  scoreboard: Map<string, ScoreboardEntry>
  history: RoundHistoryEntry[]
  hostId: string | null

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Map()
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
    this.round = null
    this.categoryIndex = 0
    this.votesByPlayer = new Map()
    this.submissions = new Map()
    this.tiebreak = null
    this.scoreboard = new Map()
    this.history = []
    this.hostId = null

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<PersistedState>('room_state')
      if (!stored) return
      this.phase = stored.phase
      this.settings = stored.settings
      this.timer = stored.timer
      this.chat = stored.chat ?? []
      this.categoryIndex = stored.categoryIndex ?? 0
      this.round = stored.round
      this.tiebreak = stored.tiebreak
      this.votesByPlayer = new Map(Object.entries(stored.votesByPlayer ?? {}))
      this.scoreboard = new Map((stored.scoreboard ?? []).map((entry) => [entry.entryId, entry]))
      this.history = stored.history ?? []
      this.hostId = stored.hostId ?? null
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
      id: crypto.randomUUID(),
      displayName: 'Player',
      joinedAt: Date.now()
    }

    this.state.acceptWebSocket(server)
    this.sessions.set(server, session)
    if (!this.hostId) {
      this.hostId = session.id
    }

    server.send(
      toServerMessage({
        type: 'welcome',
        sessionId: session.id,
        roomId: this.state.id.toString(),
        phase: this.phase,
        players: this.getPlayers(),
        chat: this.chat,
        settings: this.settings,
        timer: this.timer,
        scoreboard: this.getScoreboard(),
        history: this.history
      })
    )
    this.broadcast({ type: 'presence', players: this.getPlayers() })
    await this.ensureAlarm()
    await this.persistState()

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

    if (parsed.type === 'vote_time') {
      if (this.phase !== 'lobby') return
      this.voteIntent.set(session.id, parsed.direction)
      return
    }

    if (parsed.type === 'start_hunt') {
      if (this.phase !== 'lobby') return
      if (this.hostId !== session.id) return
      this.phase = 'hunt'
      this.timer.huntRemainingSeconds = this.timer.targetMinutes * 60
      this.timer.intermissionRemainingSeconds = null
      this.timer.lastTickAt = Date.now()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      await this.ensureAlarm()
    }

    if (parsed.type === 'reset_match') {
      if (this.hostId !== session.id) return
      this.resetMatch()
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      this.broadcast({ type: 'scoreboard', scoreboard: this.getScoreboard(), history: this.history })
      this.persistState()
      await this.ensureAlarm()
    }

    if (parsed.type === 'vote_submission') {
      if (this.phase !== 'rounds' || !this.round) return
      if (this.tiebreak) return
      const entry = this.round.entries.find((item) => item.id === parsed.entryId)
      if (!entry) return
      this.votesByPlayer.set(session.id, parsed.entryId)
      this.round.votesByEntryId = this.tallyVotes()
      this.broadcast({ type: 'round_start', round: this.round })
      this.persistState()
    }

    if (parsed.type === 'rps_choice') {
      if (this.phase !== 'rounds' || !this.tiebreak) return
      if (!this.tiebreak.entryIds.includes(session.id)) return
      this.tiebreak.choicesByEntryId[session.id] = parsed.choice
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

    if (parsed.type === 'submit_submission') {
      const url = parsed.url.trim()
      if (!url.toLowerCase().includes('tiktok.com')) {
        ws.send(toServerMessage({ type: 'error', message: 'Only TikTok URLs are allowed.' }))
        return
      }
      const now = Date.now()
      const entry: Submission = {
        playerId: session.id,
        categoryId: parsed.categoryId,
        url,
        createdAt: now,
        updatedAt: now
      }
      const categoryMap = this.submissions.get(parsed.categoryId) ?? new Map()
      const existing = categoryMap.get(session.id)
      if (existing) {
        entry.createdAt = existing.createdAt
      }
      categoryMap.set(session.id, entry)
      this.submissions.set(parsed.categoryId, categoryMap)
      ws.send(
        toServerMessage({
          type: 'submission_saved',
          categoryId: parsed.categoryId,
          url,
          updatedAt: now
        })
      )
      this.persistState()
    }
  }

  webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws)
    if (session) {
      this.voteIntent.delete(session.id)
    }
    this.sessions.delete(ws)
    if (session?.id === this.hostId) {
      this.hostId = this.pickNewHost()
    }
    this.broadcast({ type: 'presence', players: this.getPlayers() })
    this.persistState()
  }

  webSocketError(ws: WebSocket) {
    const session = this.sessions.get(ws)
    if (session) {
      this.voteIntent.delete(session.id)
    }
    this.sessions.delete(ws)
    if (session?.id === this.hostId) {
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
    for (const session of this.sessions.values()) {
      players.push({
        id: session.id,
        displayName: session.displayName,
        joinedAt: session.joinedAt,
        isHost: session.id === this.hostId,
        isConnected: true
      })
    }
    return players
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
    if (this.categoryIndex >= defaultCategories.length) {
      this.phase = 'results'
      this.round = null
      this.tiebreak = null
      this.broadcast({ type: 'timer', phase: this.phase, timer: this.timer })
      this.broadcast({ type: 'scoreboard', scoreboard: this.getScoreboard(), history: this.history })
      this.persistState()
      return
    }
    const category = defaultCategories[this.categoryIndex]
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
    for (const session of this.sessions.values()) {
      const submission = categoryMap?.get(session.id)
      if (!submission) {
        continue
      }
      entries.push({
        id: session.id,
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
      submissions,
      categoryIndex: this.categoryIndex,
      round: this.round,
      tiebreak: this.tiebreak,
      votesByPlayer,
      scoreboard: this.getScoreboard(),
      history: this.history,
      hostId: this.hostId ?? undefined
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
    const first = this.sessions.values().next()
    if (first.done) return null
    return first.value.id
  }

  updateScoreboard(winnerId: string, categoryId: string, categoryName: string) {
    const winnerSession = Array.from(this.sessions.values()).find((session) => session.id === winnerId)
    const winnerName = winnerSession?.displayName ?? 'Player'
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
}
