import { detectPlatform } from '../../../../shared/platforms'
import { extractTikTok } from './tiktok'
import { extractTwitter } from './twitter'
import { extractReddit } from './reddit'
import { extractInstagram } from './instagram'
import { extractTwitch } from './twitch'
import { extractFacebook } from './facebook'

export type ExtractionResult =
  | { ok: true; downloadUrl: string; fetchHeaders?: Record<string, string> }
  | { ok: false; error: string }

export async function extractVideoUrl(url: string): Promise<ExtractionResult> {
  const platform = detectPlatform(url)
  switch (platform) {
    case 'TikTok':              return extractTikTok(url)
    case 'Twitter/X':           return extractTwitter(url)
    case 'Reddit':              return extractReddit(url)
    case 'Instagram Reels':     return extractInstagram(url)
    case 'Twitch Clips':        return extractTwitch(url)
    case 'Facebook Reels':      return extractFacebook(url)
    default:
      return { ok: false, error: `Unsupported platform: ${platform ?? 'unknown'}` }
  }
}
