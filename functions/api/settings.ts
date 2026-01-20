import { getSessionUser, json, logEvent, Env } from './_helpers'
import { ThemeMode, themePacks } from '../../src/theme'

const allowedThemes = new Set(themePacks.map((pack) => pack.id))

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const row = await env.DB.prepare('SELECT theme, mode FROM user_settings WHERE user_id = ?')
    .bind(user.id)
    .first()
  return json({ ok: true, theme: row?.theme ?? 'clash', mode: row?.mode ?? 'system' })
}

export async function onRequestPut({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const theme = typeof body?.theme === 'string' ? body.theme.trim() : 'clash'
  const mode = typeof body?.mode === 'string' ? body.mode : 'system'

  if (!allowedThemes.has(theme)) {
    return json({ ok: false, error: 'Invalid theme.' }, { status: 400 })
  }
  if (!['light', 'dark', 'system'].includes(mode)) {
    return json({ ok: false, error: 'Invalid mode.' }, { status: 400 })
  }

  await env.DB.prepare(
    'INSERT INTO user_settings (user_id, theme, mode, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme, mode = excluded.mode, updated_at = excluded.updated_at'
  )
    .bind(user.id, theme, mode as ThemeMode, new Date().toISOString())
    .run()

  await logEvent(env, {
    level: 'info',
    eventType: 'settings_update',
    accountId: user.id,
    meta: { theme, mode }
  })
  return json({ ok: true })
}
