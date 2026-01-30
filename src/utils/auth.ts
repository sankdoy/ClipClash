export type User = {
  id: string
  email: string
  username: string
  avatar_url?: string
  is_owner?: number
}

export async function register(email: string, password: string): Promise<{ ok?: boolean; user?: User; error?: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  })
  return res.json()
}

export async function login(email: string, password: string): Promise<{ ok?: boolean; user?: User; error?: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  })
  return res.json()
}

export async function forgotPassword(email: string): Promise<boolean> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email })
  })
  return res.ok
}

export async function resetPassword(token: string, password: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, password })
  })
  return res.json()
}

export async function getMe(): Promise<{ user?: User } | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (!res.ok) return null
  return (await res.json()) as { user?: User }
}

export async function updateProfile(username: string, avatarUrl?: string) {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, avatarUrl })
  })
  return res.ok
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}
