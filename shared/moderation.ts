const blocklist = ['slur', 'hate', 'abuse']

export function normalizeText(input: string) {
  const lowered = input.toLowerCase()
  const collapsed = lowered.replace(/(.)\1{2,}/g, '$1$1')
  const noSpaces = collapsed.replace(/\s+/g, '')
  return noSpaces.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

export function isBlocked(input: string) {
  const normalized = normalizeText(input)
  return blocklist.some((word) => normalized.includes(word))
}
