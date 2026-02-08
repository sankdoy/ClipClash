import type { ExtractionResult } from './index'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MOBILE_USER_AGENT = 'Instagram 275.0.0.27.98 Android (33/13; 280dpi; 720x1423; Xiaomi; Redmi 7; onclite; qcom; en_US; 458229237)'

const MOBILE_HEADERS: Record<string, string> = {
  'x-ig-app-locale': 'en_US',
  'x-ig-device-locale': 'en_US',
  'x-ig-mapped-locale': 'en_US',
  'user-agent': MOBILE_USER_AGENT,
  'accept-language': 'en-US',
  'x-fb-http-engine': 'Liger',
  'x-fb-client-ip': 'True',
  'x-fb-server-cluster': 'True',
  'content-length': '0'
}

const EMBED_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cache-Control': 'max-age=0',
  'Dnt': '1',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': USER_AGENT
}

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p|tv|reels)\/([A-Za-z0-9_-]+)/)
  return match?.[1] ?? null
}

function isShareLink(url: string): boolean {
  return /instagram\.com\/share\/\w+/.test(url)
}

async function resolveShareLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'curl/7.88.1' }
    })
    return res.headers.get('location')
  } catch {
    return null
  }
}

/** Method 1: HTML embed page (no auth required) */
async function tryEmbedMethod(shortcode: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
      headers: EMBED_HEADERS
    })
    const html = await res.text()

    // Try the init pattern first
    const embedMatch = html.match(/"init",\[\],\[(.*?)\]\],/)
    if (embedMatch?.[1]) {
      try {
        const embedData = JSON.parse(embedMatch[1])
        if (embedData?.contextJSON) {
          const context = JSON.parse(embedData.contextJSON)
          const media = context?.gql_data?.shortcode_media ?? context?.gql_data?.xdt_shortcode_media
          if (media?.video_url) return media.video_url
        }
      } catch { /* parse failed, try next pattern */ }
    }

    // Try direct video URL patterns in embed HTML
    const videoMatch = html.match(/"video_url":"(https?:[^"]+)"/)
    if (videoMatch?.[1]) {
      return videoMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
    }

    // Try og:video in embed HTML
    const ogMatch = html.match(/property="og:video"\s+content="(https?:[^"]+)"/)
    if (ogMatch?.[1]) {
      return ogMatch[1].replace(/&amp;/g, '&')
    }

    return null
  } catch {
    return null
  }
}

/** Method 2: oEmbed → mobile API */
async function tryMobileApiMethod(shortcode: string): Promise<string | null> {
  try {
    const oembedUrl = new URL('https://i.instagram.com/api/v1/oembed/')
    oembedUrl.searchParams.set('url', `https://www.instagram.com/p/${shortcode}/`)

    const oembedRes = await fetch(oembedUrl.toString(), { headers: MOBILE_HEADERS })
    const oembedData: any = await oembedRes.json()
    const mediaId = oembedData?.media_id
    if (!mediaId) return null

    const infoRes = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
      headers: MOBILE_HEADERS
    })
    const infoData: any = await infoRes.json()
    const item = infoData?.items?.[0]
    if (!item) return null

    if (item.video_versions?.length) {
      const best = item.video_versions.reduce((a: any, b: any) =>
        (a.width * a.height) < (b.width * b.height) ? b : a
      )
      return best.url
    }

    return null
  } catch {
    return null
  }
}

/** Method 3: Direct page scrape — look for video URL in the main page HTML */
async function tryPageScrapeMethod(shortcode: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
      headers: {
        ...EMBED_HEADERS,
        'x-ig-app-id': '936619743392459'
      }
    })
    const html = await res.text()

    // Look for video_url in page scripts
    const videoMatch = html.match(/"video_url":"(https?:[^"]+)"/)
    if (videoMatch?.[1]) {
      return videoMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
    }

    // Look for contentUrl in JSON-LD
    const ldMatch = html.match(/"contentUrl"\s*:\s*"(https?:[^"]+)"/)
    if (ldMatch?.[1]) {
      return ldMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
    }

    return null
  } catch {
    return null
  }
}

const FETCH_HEADERS: Record<string, string> = {
  'referer': 'https://www.instagram.com/',
  'user-agent': USER_AGENT,
  'origin': 'https://www.instagram.com'
}

export async function extractInstagram(url: string): Promise<ExtractionResult> {
  let shortcode = extractShortcode(url)

  if (!shortcode && isShareLink(url)) {
    const resolved = await resolveShareLink(url)
    if (resolved) {
      shortcode = extractShortcode(resolved)
    }
  }

  if (!shortcode) {
    return { ok: false, error: 'Could not extract Instagram shortcode.' }
  }

  try {
    // Try embed method first (most reliable, no auth)
    let videoUrl = await tryEmbedMethod(shortcode)
    if (videoUrl) return { ok: true, downloadUrl: videoUrl, fetchHeaders: FETCH_HEADERS }

    // Fallback: mobile API
    videoUrl = await tryMobileApiMethod(shortcode)
    if (videoUrl) return { ok: true, downloadUrl: videoUrl, fetchHeaders: FETCH_HEADERS }

    // Fallback: page scrape
    videoUrl = await tryPageScrapeMethod(shortcode)
    if (videoUrl) return { ok: true, downloadUrl: videoUrl, fetchHeaders: FETCH_HEADERS }

    return { ok: false, error: 'Could not extract Instagram video URL.' }
  } catch (err) {
    return { ok: false, error: `Instagram extraction failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}
