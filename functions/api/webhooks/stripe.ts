import { jsonOk } from '../../_lib/responses'

type Env = {
  PAYMENTS_ENABLED?: string
}

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'POST') {
    return jsonOk({ error: 'Method Not Allowed' }, { status: 405 })
  }
  const enabled = env.PAYMENTS_ENABLED === 'true'
  if (!enabled) {
    return jsonOk({ status: 'disabled' }, { status: 200 })
  }
  return jsonOk({ error: 'Not implemented' }, { status: 501 })
}
