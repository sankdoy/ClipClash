export async function requestLogin(email: string) {
  const res = await fetch('/api/auth/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email })
  })
  return res.ok
}

export async function verifyLogin(email: string, code: string) {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code })
  })
  if (!res.ok) return null
  return (await res.json()) as { user?: { id: string; email: string; username: string; avatar_url?: string } }
}

export async function getMe(): Promise<{ user?: { id: string; email: string; username: string; avatar_url?: string } } | null> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  return (await res.json()) as { user?: { id: string; email: string; username: string; avatar_url?: string } }
}

export async function updateProfile(username: string, avatarUrl?: string) {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, avatarUrl })
  })
  return res.ok
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
}
