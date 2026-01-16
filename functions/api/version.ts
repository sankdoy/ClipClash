import pkg from '../../package.json'

export async function onRequest(context: any) {
  const commit = context.env?.COMMIT ?? null
  const payload = {
    version: pkg.version || null,
    commit,
  }
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  })
}
