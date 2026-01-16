const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCode(length = 6) {
  let result = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < length; i += 1) {
    result += alphabet[bytes[i] % alphabet.length]
  }
  return result
}

export async function generateUniqueCode(
  isAvailable: (code: string) => Promise<boolean>,
  length = 6,
  maxAttempts = 10,
  generator: (len: number) => string = generateCode
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generator(length)
    if (await isAvailable(code)) return code
  }
  throw new Error('Unable to generate unique code')
}
