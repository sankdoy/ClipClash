import { isBlocked } from '../../shared/moderation'

export function sanitizeUsername(email: string): string {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]+/g, '').slice(0, 12) || 'player'
  return base.toLowerCase()
}

export async function findAvailableUsername(db: D1Database, base: string): Promise<string> {
  if (isBlocked(base)) {
    return `player${Math.floor(Math.random() * 9999)}`
  }
  let candidate = base
  let suffix = 0
  while (suffix < 1000) {
    const exists = await db.prepare('SELECT 1 FROM users WHERE username = ?')
      .bind(candidate)
      .first()
    if (!exists) return candidate
    suffix += 1
    candidate = `${base}${suffix}`
  }
  return `player${Math.floor(Math.random() * 9999)}`
}
