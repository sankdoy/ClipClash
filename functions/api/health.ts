export async function onRequest(context: any) {
  const payload = {
    ok: true,
    name: 'tiktokolympics',
    timestamp: new Date().toISOString(),
  }
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  })
}
