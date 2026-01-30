const ITERATIONS = 100_000
const KEY_LENGTH = 32
const HASH_ALGO = 'SHA-256'
const SALT_LENGTH = 16

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALGO },
    key,
    KEY_LENGTH * 8
  )
  return `${toHex(salt)}:${toHex(new Uint8Array(hash))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, expectedHashHex] = stored.split(':')
  if (!saltHex || !expectedHashHex) return false
  const salt = fromHex(saltHex)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALGO },
    key,
    KEY_LENGTH * 8
  )
  return toHex(new Uint8Array(hash)) === expectedHashHex
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}
