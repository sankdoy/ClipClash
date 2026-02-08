import type { ExtractionResult } from './index'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

function extractPostId(url: string): string | null {
  // /comments/ID or /r/sub/comments/ID/title
  const match = url.match(/\/comments\/(\w+)/)
  return match?.[1] ?? null
}

function isShortLink(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'v.redd.it' || parsed.hostname === 'redd.it'
  } catch {
    return false
  }
}

function isShareLink(url: string): boolean {
  return /reddit\.com\/r\/\w+\/s\/\w+/.test(url)
}

async function resolveRedirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT }
    })
    const location = res.headers.get('location')
    if (location) return location
    // Some redirects return HTML with meta refresh
    const html = await res.text()
    const metaMatch = html.match(/url=([^"]+)/)
    return metaMatch?.[1] ?? null
  } catch {
    return null
  }
}

export async function extractReddit(url: string): Promise<ExtractionResult> {
  let postId = extractPostId(url)

  // Resolve short/share links
  if (!postId && (isShortLink(url) || isShareLink(url))) {
    const resolved = await resolveRedirect(url)
    if (resolved) {
      postId = extractPostId(resolved)
    }
  }

  if (!postId) {
    return { ok: false, error: 'Could not extract Reddit post ID.' }
  }

  try {
    const res = await fetch(`https://www.reddit.com/comments/${postId}.json`, {
      headers: {
        'user-agent': USER_AGENT,
        'accept': 'application/json'
      }
    })
    if (!res.ok) {
      return { ok: false, error: `Reddit returned ${res.status}` }
    }

    const data: any = await res.json()
    if (!Array.isArray(data)) {
      return { ok: false, error: 'Unexpected Reddit response format.' }
    }

    const post = data[0]?.data?.children?.[0]?.data
    if (!post) {
      return { ok: false, error: 'No post data found.' }
    }

    // Direct GIF link
    if (post.url?.endsWith('.gif')) {
      return { ok: true, downloadUrl: post.url }
    }

    const redditVideo = post.secure_media?.reddit_video
    if (!redditVideo?.fallback_url) {
      return { ok: false, error: 'No video found in Reddit post.' }
    }

    // fallback_url is a direct MP4 link (video-only, which is fine for our use)
    const videoUrl = redditVideo.fallback_url.split('?')[0]
    return { ok: true, downloadUrl: videoUrl }
  } catch (err) {
    return { ok: false, error: `Reddit extraction failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}
