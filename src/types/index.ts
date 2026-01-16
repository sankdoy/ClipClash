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
}

export interface Settings {
  minTime: number
  maxTime: number
  defaultTime: number
  voteTickSeconds: number
  voteThreshold: number
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
  | { type: 'hello'; name?: string }
  | { type: 'chat'; message: string }
  | { type: 'vote_time'; direction: 'higher' | 'lower' | 'neutral' }
  | { type: 'start_hunt' }
  | { type: 'reset_match' }
  | { type: 'submit_submission'; categoryId: string; url: string }
  | { type: 'vote_submission'; entryId: string }
  | { type: 'rps_choice'; choice: RpsChoice }

export type ServerMessage =
  | { type: 'welcome'; sessionId: string; roomId: string; phase: Phase; players: Player[]; chat: ChatMessage[]; settings: Settings; timer: TimerState; scoreboard: ScoreboardEntry[]; history: RoundHistoryEntry[] }
  | { type: 'presence'; players: Player[] }
  | { type: 'chat'; chat: ChatMessage }
  | { type: 'timer'; phase: Phase; timer: TimerState }
  | { type: 'round_start'; round: RoundState }
  | { type: 'round_result'; result: RoundResult }
  | { type: 'tiebreak_start'; tiebreak: TieBreakState }
  | { type: 'tiebreak_result'; tiebreak: TieBreakState }
  | { type: 'scoreboard'; scoreboard: ScoreboardEntry[]; history: RoundHistoryEntry[] }
  | { type: 'submission_saved'; categoryId: string; url: string; updatedAt: number }
  | { type: 'error'; message: string }
