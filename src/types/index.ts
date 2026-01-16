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

export type ClientMessage =
  | { type: 'hello'; name?: string }
  | { type: 'chat'; message: string }

export type ServerMessage =
  | { type: 'welcome'; sessionId: string; roomId: string; phase: Phase; players: Player[]; chat: ChatMessage[]; settings: Settings }
  | { type: 'presence'; players: Player[] }
  | { type: 'chat'; chat: ChatMessage }
  | { type: 'error'; message: string }
