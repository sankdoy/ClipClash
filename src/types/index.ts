export interface Player {
  id: string
  name: string
}

export interface Room {
  id: string
  name: string
  players: Player[]
}

export interface Category {
  id: string
  name: string
}

export interface Submission {
  id: string
  playerId: string
  categoryId: string
  url?: string
}

export interface Vote {
  voterId: string
  submissionId: string
}
