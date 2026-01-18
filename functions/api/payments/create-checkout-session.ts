import { jsonError, jsonOk } from '../../_lib/responses'

type Env = {
  PAYMENTS_ENABLED?: string
}

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'POST') {
    return jsonError('Method Not Allowed', 405)
  }
  const enabled = env.PAYMENTS_ENABLED === 'true'
  if (!enabled) {
    return jsonError('Payments disabled', 501)
  }
  return jsonOk({ error: 'Not implemented' }, { status: 501 })
}
