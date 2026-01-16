import { clearCookie, json, Env, getCookie } from '../_helpers'

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const token = getCookie(request.headers, 'cc_session')
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  }
  const headers = new Headers()
  headers.append('Set-Cookie', clearCookie('cc_session'))
  return json({ ok: true }, { headers })
}
