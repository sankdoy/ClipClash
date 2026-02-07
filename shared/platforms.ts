/**
 * Supported short-form video platforms and their URL patterns.
 * ClipDuel accepts clips from any of these platforms.
 */

const SUPPORTED_HOSTS: { name: string; hostPatterns: RegExp[] }[] = [
  {
    name: 'TikTok',
    hostPatterns: [/tiktok\.com$/, /vm\.tiktok\.com$/, /vt\.tiktok\.com$/]
  },
  {
    name: 'YouTube Shorts',
    hostPatterns: [/youtube\.com$/, /youtu\.be$/, /m\.youtube\.com$/]
  },
  {
    name: 'Instagram Reels',
    hostPatterns: [/instagram\.com$/, /instagr\.am$/]
  },
  {
    name: 'Facebook Reels',
    hostPatterns: [/facebook\.com$/, /fb\.watch$/, /fb\.com$/]
  },
  {
    name: 'Snapchat Spotlight',
    hostPatterns: [/snapchat\.com$/, /t\.snapchat\.com$/]
  },
  {
    name: 'Twitter/X',
    hostPatterns: [/twitter\.com$/, /x\.com$/]
  },
  {
    name: 'Reddit',
    hostPatterns: [/reddit\.com$/, /v\.redd\.it$/]
  },
  {
    name: 'Twitch Clips',
    hostPatterns: [/twitch\.tv$/, /clips\.twitch\.tv$/]
  }
]

export const PLATFORM_NAMES = SUPPORTED_HOSTS.map((h) => h.name)

/**
 * Returns the platform name if the URL is from a supported short-form video host,
 * or null if not recognized.
 */
export function detectPlatform(url: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    for (const platform of SUPPORTED_HOSTS) {
      for (const pattern of platform.hostPatterns) {
        if (pattern.test(host)) return platform.name
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Check if a URL is from any supported clip platform.
 * Also exported as isTikTokUrl for backward compatibility.
 */
export function isClipUrl(url: string): boolean {
  return detectPlatform(url) !== null
}

/** @deprecated Use isClipUrl instead — kept for backward compat */
export function isTikTokUrl(url: string): boolean {
  return isClipUrl(url)
}
