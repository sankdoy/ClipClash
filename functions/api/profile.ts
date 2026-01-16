import { getSessionUser, isValidUsername, json, Env } from './_helpers'
import { isBlocked } from '../../shared/moderation'

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return json({ ok: true, user })
}

export async function onRequestPut({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const avatarUrl = typeof body?.avatarUrl === 'string' ? body.avatarUrl.trim() : ''

  if (username && (!isValidUsername(username) || isBlocked(username))) {
    return json({ ok: false, error: 'Invalid username.' }, { status: 400 })
  }

  if (avatarUrl && isBlocked(avatarUrl)) {
    return json({ ok: false, error: 'Invalid avatar URL.' }, { status: 400 })
  }

  if (username) {
    const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?')
      .bind(username, user.id)
      .first()
    if (exists) {
      return json({ ok: false, error: 'Username taken.' }, { status: 400 })
    }
  }

  await env.DB.prepare('UPDATE users SET username = ?, avatar_url = ?, updated_at = ? WHERE id = ?')
    .bind(
      username || user.username,
      avatarUrl || user.avatar_url,
      new Date().toISOString(),
      user.id
    )
    .run()

  return json({ ok: true })
}
