import { getSessionUser, json, Env } from './_helpers'

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const row = await env.DB.prepare('SELECT has_audience_mode FROM entitlements WHERE user_id = ?')
    .bind(user.id)
    .first()
  return json({ ok: true, hasAudienceMode: row?.has_audience_mode === 1 })
}
