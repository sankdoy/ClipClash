type Env = {
  PAYMENTS_ENABLED?: string
}

export async function onRequestPost({ env }: { env: Env }) {
  const enabled = env.PAYMENTS_ENABLED === 'true'
  if (!enabled) {
    return new Response('Payments disabled', { status: 501 })
  }
  return new Response('Not implemented', { status: 501 })
}
