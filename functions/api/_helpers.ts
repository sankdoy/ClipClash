import { isBlocked } from '../../shared/moderation'
import { logEvent } from '../_lib/db'

export type Env = {
  DB: D1Database
  MAIL_FROM_EMAIL?: string
  MAIL_FROM_NAME?: string
  SITE_URL?: string
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {})
    }
  })
}

export function getCookie(headers: Headers, name: string) {
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

export function setCookie(name: string, value: string, options: { maxAge?: number } = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (options.maxAge) {
    attrs.push(`Max-Age=${options.maxAge}`)
  }
  return attrs.join('; ')
}

export function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
}

export function isValidUsername(name: string) {
  if (!name) return false
  if (name.length < 3 || name.length > 20) return false
  if (isBlocked(name)) return false
  return /^[a-zA-Z0-9 _-]+$/.test(name)
}

export type SessionUser = {
  id: string
  email: string
  username: string
  avatar_url?: string | null
  is_owner?: number | null
}

export function isOwner(user: SessionUser | null | undefined) {
  return Boolean(user && Number(user.is_owner ?? 0) === 1)
}

export async function getSessionUser(env: Env, request: Request): Promise<SessionUser | null> {
  const token = getCookie(request.headers, 'cc_session')
  if (!token) return null
  const result = await env.DB.prepare(
    'SELECT users.id, users.email, users.username, users.avatar_url, users.is_owner FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?'
  )
    .bind(token, new Date().toISOString())
    .first()
  return (result ?? null) as SessionUser | null
}

export { logEvent }
