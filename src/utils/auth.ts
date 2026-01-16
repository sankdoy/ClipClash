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
  return await res.json()
}

export async function getMe() {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  return await res.json()
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
