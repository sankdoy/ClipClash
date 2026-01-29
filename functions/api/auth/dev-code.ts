import { json, Env } from '../_helpers'
import { isDevMode } from '../../_lib/email'

/**
 * DEV MODE ONLY: Retrieve auth code for testing
 *
 * This endpoint is ONLY available when:
 * - DEV_MODE=true OR
 * - MAIL_FROM_EMAIL is not configured
 *
 * Usage: GET /api/auth/dev-code?email=user@example.com
 *
 * Returns the plaintext auth code so you can test the login flow
 * without actually sending emails.
 *
 * In production (when MAIL_FROM_EMAIL is set), this returns 403.
 */
export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  // Security: Only allow in dev mode
  if (!isDevMode(env)) {
    return json(
      {
        ok: false,
        error: 'This endpoint is only available in development mode.'
      },
      { status: 403 }
    )
  }

  const url = new URL(request.url)
  const email = url.searchParams.get('email')?.trim().toLowerCase()

  if (!email) {
    return json({ ok: false, error: 'Missing email parameter.' }, { status: 400 })
  }

  // Retrieve the code from the database
  const result = await env.DB.prepare(
    'SELECT code_plaintext, expires_at FROM auth_codes WHERE email = ? AND code_plaintext IS NOT NULL'
  )
    .bind(email)
    .first()

  if (!result) {
    return json(
      {
        ok: false,
        error: 'No auth code found for this email. Request a new code first.'
      },
      { status: 404 }
    )
  }

  const expiresAt = result.expires_at as string
  const now = new Date()
  const expires = new Date(expiresAt)

  if (now > expires) {
    return json(
      {
        ok: false,
        error: 'Auth code has expired. Request a new code.'
      },
      { status: 410 }
    )
  }

  return json({
    ok: true,
    email,
    code: result.code_plaintext,
    expires_at: expiresAt,
    note: 'DEV MODE: Use this code to complete login. This endpoint will not work in production.'
  })
}
