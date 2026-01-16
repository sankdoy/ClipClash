export function isTikTokUrl(url: string) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('tiktok.com')
  } catch {
    return url.toLowerCase().includes('tiktok.com')
  }
}
