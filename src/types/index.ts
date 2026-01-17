export type Phase = 'lobby' | 'hunt' | 'intermission' | 'rounds' | 'results'

export interface Category {
  id: string
  name: string
}

export interface Player {
  id: string
  displayName: string
  joinedAt: number
  isHost: boolean
  isConnected: boolean
  isReady?: boolean
  isDone?: boolean
  lastSeenAt?: number
}

export interface Settings {
  minTime: number
  maxTime: number
  defaultTime: number
  voteTickSeconds: number
  voteThreshold: number
  audienceModeEnabled: boolean
}

export interface Room {
  id: string
  type: 'public' | 'private'
  code?: string
  createdAt: number
  phase: Phase
  players: Player[]
  categories: Category[]
  settings: Settings
}

export interface Submission {
  playerId: string
  categoryId: string
  url: string
  createdAt: number
  updatedAt: number
}

export interface RoundEntry {
  id: string
  label: string
  url?: string
}

export interface RoundState {
  categoryId: string
  categoryName: string
  entries: RoundEntry[]
  votesByEntryId: Record<string, number>
  remainingSeconds: number | null
}

export type RpsChoice = 'rock' | 'paper' | 'scissors'

export interface TieBreakState {
  entryIds: string[]
  choicesByEntryId: Record<string, RpsChoice>
  remainingSeconds: number | null
  winnerEntryId?: string
}

export interface Vote {
  playerId: string
  categoryId: string
  submissionId: string
}

export interface RoundResult {
  categoryId: string
  winnerSubmissionId: string
  votesBySubmissionId: Record<string, number>
}

export interface ScoreboardEntry {
  entryId: string
  displayName: string
  wins: number
}

export interface RoundHistoryEntry {
  categoryId: string
  categoryName: string
  winnerEntryId: string
  winnerName: string
}

export type DraftsByCategory = Record<string, string>

export interface SponsorSlot {
  status: 'empty' | 'filled'
  label: string
  imageUrl?: string
  linkUrl?: string
}

export interface ChatMessage {
  id: string
  playerId: string
  name: string
  message: string
  sentAt: number
}

export interface TimerState {
  targetMinutes: number
  huntRemainingSeconds: number | null
  intermissionRemainingSeconds: number | null
  voteHigherCount: number
  voteLowerCount: number
  playerCount: number
  lastTickAt: number
}

export type ClientMessage =
  | { type: 'hello'; sessionToken?: string; inviteCode?: string; audienceCode?: string; role?: 'player' | 'audience' }
  | { type: 'chat'; message: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'set_done'; done: boolean }
  | { type: 'set_timer'; minutes: number }
  | { type: 'start_hunt' }
  | { type: 'reset_match' }
  | { type: 'close_room' }
  | { type: 'rotate_invite' }
  | { type: 'assign_host'; playerId: string }
  | { type: 'kick_player'; playerId: string }
  | { type: 'update_categories'; categories: Category[] }
  | { type: 'update_name'; name: string }
  | { type: 'save_draft'; categoryId: string; url: string }
  | { type: 'submit_submission'; categoryId: string; url: string }
  | { type: 'vote_submission'; entryId: string }
  | { type: 'rps_choice'; choice: RpsChoice }
  | { type: 'report'; messageId: string }
  | { type: 'set_audience_mode'; enabled: boolean }

export type ServerMessage =
  | { type: 'welcome'; sessionToken: string; playerId: string; roomId: string; phase: Phase; players: Player[]; chat: ChatMessage[]; settings: Settings; timer: TimerState; categories: Category[]; scoreboard: ScoreboardEntry[]; history: RoundHistoryEntry[]; drafts: DraftsByCategory; reportCount: number; inviteCode?: string; audienceCode?: string }
  | { type: 'room_state'; phase: Phase; players: Player[]; chat: ChatMessage[]; settings: Settings; timer: TimerState; categories: Category[]; scoreboard: ScoreboardEntry[]; history: RoundHistoryEntry[]; reportCount: number; inviteCode?: string; audienceCode?: string }
  | { type: 'presence'; players: Player[] }
  | { type: 'chat'; chat: ChatMessage }
  | { type: 'invite_code'; code: string }
  | { type: 'room_closed'; message: string }
  | { type: 'timer'; phase: Phase; timer: TimerState }
  | { type: 'round_start'; round: RoundState }
  | { type: 'round_result'; result: RoundResult }
  | { type: 'tiebreak_start'; tiebreak: TieBreakState }
  | { type: 'tiebreak_result'; tiebreak: TieBreakState }
  | { type: 'scoreboard'; scoreboard: ScoreboardEntry[]; history: RoundHistoryEntry[] }
  | { type: 'categories'; categories: Category[] }
  | { type: 'drafts'; drafts: DraftsByCategory }
  | { type: 'settings'; settings: Settings }
  | { type: 'report_received'; messageId: string }
  | { type: 'submission_saved'; categoryId: string; url: string; updatedAt: number }
  | { type: 'error'; message: string }
