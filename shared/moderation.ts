/**
 * Blocklist of slurs, hate speech, and explicitly offensive terms.
 * Normalisation collapses repeats and strips accents, so attempts
 * like "fuuuck" or "shît" are still caught.
 */
const blocklist = [
  'slur', 'hate', 'abuse',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy',
  'ass', 'damn', 'bastard', 'whore', 'slut', 'piss',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'spic',
  'chink', 'kike', 'tranny', 'dyke', 'cracker',
  'nazi', 'hitler', 'genocide',
  'porn', 'hentai', 'xxx', 'nude', 'naked', 'nsfw', 'onlyfans',
  'penis', 'vagina', 'blowjob', 'handjob',
  'killself', 'suicide', 'kys'
]

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
