export function requireBearerToken(request: Request, token?: string) {
  const auth = request.headers.get('Authorization')
  if (!token || !auth) return false
  return auth === `Bearer ${token}`
}
