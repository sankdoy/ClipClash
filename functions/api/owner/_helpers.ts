import { json, Env, getSessionUser, isOwner } from '../_helpers'

export async function requireOwner(env: Env, request: Request) {
  const user = await getSessionUser(env, request)
  if (!isOwner(user)) {
    return { ok: false as const, response: json({ ok: false, error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true as const, user }
}
