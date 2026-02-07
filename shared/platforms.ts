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

/**
 * Extract the creator handle from a clip URL.
 * Returns the handle (e.g. "@username") or null if not extractable.
 */
export function extractCreatorHandle(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    const path = parsed.pathname

    // TikTok: /@username/video/...
    if (/tiktok\.com$/.test(host)) {
      const match = path.match(/\/@([^/]+)/)
      return match ? `@${match[1]}` : null
    }

    // YouTube: /@channel/shorts/... or /shorts/ID (no channel in short URLs)
    if (/youtube\.com$/.test(host) || /youtu\.be$/.test(host)) {
      const channelMatch = path.match(/\/@([^/]+)/)
      return channelMatch ? `@${channelMatch[1]}` : null
    }

    // Instagram: /username/reel/... or /p/...
    if (/instagram\.com$/.test(host)) {
      const match = path.match(/^\/([^/]+)\/(?:reel|p)/)
      return match ? `@${match[1]}` : null
    }

    // Twitter/X: /username/status/...
    if (/twitter\.com$/.test(host) || /x\.com$/.test(host)) {
      const match = path.match(/^\/([^/]+)\/status/)
      return match ? `@${match[1]}` : null
    }

    // Reddit: /r/subreddit or /u/user
    if (/reddit\.com$/.test(host)) {
      const match = path.match(/^\/(r|u|user)\/([^/]+)/)
      return match ? `${match[1] === 'r' ? 'r/' : 'u/'}${match[2]}` : null
    }

    // Twitch: /channel/clip/...
    if (/twitch\.tv$/.test(host)) {
      const match = path.match(/^\/([^/]+)/)
      return match && match[1] !== 'clip' && match[1] !== 'videos' ? match[1] : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * Build a profile URL for a creator given their platform and handle.
 */
export function getCreatorProfileUrl(platform: string, handle: string): string | null {
  if (!handle) return null
  const clean = handle.replace(/^@/, '')

  switch (platform) {
    case 'TikTok': return `https://www.tiktok.com/@${clean}`
    case 'YouTube Shorts': return `https://www.youtube.com/@${clean}`
    case 'Instagram Reels': return `https://www.instagram.com/${clean}`
    case 'Twitter/X': return `https://x.com/${clean}`
    case 'Reddit': return `https://www.reddit.com/${handle}`
    case 'Twitch Clips': return `https://www.twitch.tv/${clean}`
    default: return null
  }
}
