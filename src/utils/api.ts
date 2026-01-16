export async function getHealth() {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}
