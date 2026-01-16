import { getSessionUser, json, Env } from '../_helpers'

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: true, user: null })
  }
  return json({ ok: true, user })
}
