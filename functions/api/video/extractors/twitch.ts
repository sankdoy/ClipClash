import type { ExtractionResult } from './index'

const GQL_URL = 'https://gql.twitch.tv/gql'
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

function extractClipSlug(url: string): string | null {
  // clips.twitch.tv/SlugName
  const clipMatch = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/)
  if (clipMatch?.[1]) return clipMatch[1]

  // twitch.tv/channel/clip/SlugName
  const channelClipMatch = url.match(/twitch\.tv\/\w+\/clip\/([A-Za-z0-9_-]+)/)
  return channelClipMatch?.[1] ?? null
}

export async function extractTwitch(url: string): Promise<ExtractionResult> {
  const clipId = extractClipSlug(url)
  if (!clipId) {
    return { ok: false, error: 'Could not extract Twitch clip slug.' }
  }

  try {
    // Step 1: Get clip metadata
    const metaRes = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'client-id': CLIENT_ID, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `{
          clip(slug: "${clipId}") {
            broadcaster { login }
            createdAt
            durationSeconds
            id
            title
            videoQualities { quality sourceURL }
          }
        }`
      })
    })
    if (!metaRes.ok) {
      return { ok: false, error: `Twitch metadata request failed: ${metaRes.status}` }
    }

    const metaData: any = await metaRes.json()
    const clip = metaData?.data?.clip
    if (!clip?.videoQualities?.length || !clip?.broadcaster) {
      return { ok: false, error: 'Twitch clip not found or has no video.' }
    }

    // Step 2: Get playback access token
    const tokenRes = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'client-id': CLIENT_ID, 'content-type': 'application/json' },
      body: JSON.stringify([{
        operationName: 'VideoAccessToken_Clip',
        variables: { slug: clipId },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: '36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11'
          }
        }
      }])
    })
    if (!tokenRes.ok) {
      return { ok: false, error: `Twitch token request failed: ${tokenRes.status}` }
    }

    const tokenData: any = await tokenRes.json()
    const accessToken = tokenData?.[0]?.data?.clip?.playbackAccessToken
    if (!accessToken) {
      return { ok: false, error: 'Could not get Twitch playback token.' }
    }

    // Pick best quality
    const format = clip.videoQualities[0] // Already sorted best-first by Twitch
    const downloadUrl = `${format.sourceURL}?${new URLSearchParams({
      sig: accessToken.signature,
      token: accessToken.value
    })}`

    return { ok: true, downloadUrl }
  } catch (err) {
    return { ok: false, error: `Twitch extraction failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}
