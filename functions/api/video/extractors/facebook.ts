import type { ExtractionResult } from './index'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

async function resolveShareUrl(url: string): Promise<string> {
  // Facebook share URLs (/share/r/XXX/) redirect to the real reel URL
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT }
    })
    return res.headers.get('location') ?? url
  } catch {
    return url
  }
}

export async function extractFacebook(url: string): Promise<ExtractionResult> {
  try {
    // Resolve share links
    let targetUrl = url
    if (/facebook\.com\/share\//.test(url)) {
      targetUrl = await resolveShareUrl(url)
    }

    // Fetch the page HTML — Facebook embeds video URLs in the page source
    const res = await fetch(targetUrl, {
      headers: {
        'user-agent': USER_AGENT,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.5',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none'
      }
    })
    const html = await res.text()

    // Method 1: Look for hd_src or sd_src in the page (common for reels/videos)
    let videoUrl: string | null = null

    // Try HD source first
    const hdMatch = html.match(/"hd_src":"(https?:[^"]+)"/) ??
                    html.match(/hd_src\s*:\s*"(https?:[^"]+)"/)
    if (hdMatch?.[1]) {
      videoUrl = hdMatch[1].replace(/\\\//g, '/')
    }

    // Fallback to SD source
    if (!videoUrl) {
      const sdMatch = html.match(/"sd_src":"(https?:[^"]+)"/) ??
                      html.match(/sd_src\s*:\s*"(https?:[^"]+)"/)
      if (sdMatch?.[1]) {
        videoUrl = sdMatch[1].replace(/\\\//g, '/')
      }
    }

    // Method 2: og:video meta tag
    if (!videoUrl) {
      const ogMatch = html.match(/<meta\s+property="og:video"\s+content="(https?:[^"]+)"/) ??
                      html.match(/<meta\s+content="(https?:[^"]+)"\s+property="og:video"/)
      if (ogMatch?.[1]) {
        videoUrl = ogMatch[1].replace(/&amp;/g, '&')
      }
    }

    // Method 3: Look for playable_url in JSON data
    if (!videoUrl) {
      const playableMatch = html.match(/"playable_url(?:_quality_hd)?":"(https?:[^"]+)"/)
      if (playableMatch?.[1]) {
        videoUrl = playableMatch[1].replace(/\\\//g, '/')
      }
    }

    if (!videoUrl) {
      return { ok: false, error: 'Could not find video URL in Facebook page.' }
    }

    return {
      ok: true,
      downloadUrl: videoUrl,
      fetchHeaders: {
        'referer': 'https://www.facebook.com/',
        'user-agent': USER_AGENT
      }
    }
  } catch (err) {
    return { ok: false, error: `Facebook extraction failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}
