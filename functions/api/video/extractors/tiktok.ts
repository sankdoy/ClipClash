import type { ExtractionResult } from './index'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

function extractPostId(url: string): { postId?: string; shortLink?: string } {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    /\/video\/(\d+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return { postId: match[1] }
  }

  // Short links: vt.tiktok.com/XXX or vm.tiktok.com/XXX
  const shortMatch = url.match(/(?:vt|vm)\.tiktok\.com\/(\w+)/)
  if (shortMatch?.[1]) return { shortLink: shortMatch[1] }

  return {}
}

async function resolveShortLink(shortLink: string): Promise<string | null> {
  try {
    const res = await fetch(`https://vt.tiktok.com/${shortLink}`, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT.split(' Chrome/1')[0] }
    })
    const html = await res.text()
    if (html.startsWith('<a href="https://')) {
      const extracted = html.split('<a href="')[1].split('?')[0]
      const idMatch = extracted.match(/video\/(\d+)/)
      return idMatch?.[1] ?? null
    }
    // Check Location header for redirects
    const location = res.headers.get('location')
    if (location) {
      const idMatch = location.match(/video\/(\d+)/)
      return idMatch?.[1] ?? null
    }
    return null
  } catch {
    return null
  }
}

export async function extractTikTok(url: string): Promise<ExtractionResult> {
  let { postId, shortLink } = extractPostId(url)

  if (!postId && shortLink) {
    postId = await resolveShortLink(shortLink) ?? undefined
  }

  if (!postId) {
    return { ok: false, error: 'Could not extract TikTok post ID.' }
  }

  try {
    const res = await fetch(`https://www.tiktok.com/@i/video/${postId}`, {
      headers: { 'user-agent': USER_AGENT }
    })
    const html = await res.text()

    const scriptSplit = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')
    if (scriptSplit.length < 2) {
      return { ok: false, error: 'TikTok page structure changed — could not find data script.' }
    }

    const jsonStr = scriptSplit[1].split('</script>')[0]
    const data = JSON.parse(jsonStr)
    const videoDetail = data?.['__DEFAULT_SCOPE__']?.['webapp.video-detail']

    if (!videoDetail) {
      return { ok: false, error: 'No video detail found in TikTok response.' }
    }

    if (videoDetail.statusMsg) {
      return { ok: false, error: `TikTok: ${videoDetail.statusMsg}` }
    }

    const detail = videoDetail?.itemInfo?.itemStruct
    if (!detail?.video?.playAddr) {
      return { ok: false, error: 'No video playAddr found.' }
    }

    return { ok: true, downloadUrl: detail.video.playAddr }
  } catch (err) {
    return { ok: false, error: `TikTok extraction failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}
