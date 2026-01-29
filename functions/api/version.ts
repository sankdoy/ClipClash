import pkg from '../../package.json'

type Env = {
  COMMIT?: string
}

export async function onRequest({ env }: { env: Env }) {
  const commit = env?.COMMIT ?? null
  const payload = {
    version: pkg.version || null,
    commit,
  }
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  })
}
