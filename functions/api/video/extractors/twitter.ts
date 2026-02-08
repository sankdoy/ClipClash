import type { ExtractionResult } from './index'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

const GRAPHQL_URL = 'https://api.x.com/graphql/4Siu98E55GquhG52zHdY5w/TweetDetail'

const TWEET_FEATURES = JSON.stringify({
  rweb_video_screen_enabled: false,
  payments_enabled: false,
  rweb_xchat_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false
})

const TWEET_FIELD_TOGGLES = JSON.stringify({
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false
})

const COMMON_HEADERS = {
  'user-agent': USER_AGENT,
  'authorization': `Bearer ${BEARER_TOKEN}`,
  'x-twitter-client-language': 'en',
  'x-twitter-active-user': 'yes',
  'accept-language': 'en'
}

function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return match?.[1] ?? null
}

function bestQuality(variants: any[]): string | null {
  const mp4s = variants.filter((v: any) => v.content_type === 'video/mp4')
  if (!mp4s.length) return null
  return mp4s.reduce((a: any, b: any) =>
    Number(a?.bitrate ?? 0) > Number(b?.bitrate ?? 0) ? a : b
  ).url
}

async function getGuestToken(): Promise<string | null> {
  try {
    const res = await fetch('https://api.x.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: COMMON_HEADERS
    })
    if (res.status !== 200) return null
    const data: any = await res.json()
    return data?.guest_token ?? null
  } catch {
    return null
  }
}

async function fetchTweetGraphQL(tweetId: string, guestToken: string): Promise<any> {
  const graphqlUrl = new URL(GRAPHQL_URL)
  graphqlUrl.searchParams.set('variables', JSON.stringify({
    focalTweetId: tweetId,
    with_rux_injections: false,
    rankingMode: 'Relevance',
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true
  }))
  graphqlUrl.searchParams.set('features', TWEET_FEATURES)
  graphqlUrl.searchParams.set('fieldToggles', TWEET_FIELD_TOGGLES)

  const res = await fetch(graphqlUrl.toString(), {
    headers: {
      ...COMMON_HEADERS,
      'content-type': 'application/json',
      'x-guest-token': guestToken,
      'cookie': `guest_id=${encodeURIComponent(`v1:${guestToken}`)}`
    }
  })
  if (!res.ok) return null
  return res.json()
}

function extractMediaFromGraphQL(tweet: any, tweetId: string): any[] | null {
  const addInsn = tweet?.data?.threaded_conversation_with_injections_v2?.instructions?.find(
    (insn: any) => insn.type === 'TimelineAddEntries'
  )
  const tweetResult = addInsn?.entries?.find(
    (entry: any) => entry.entryId === `tweet-${tweetId}`
  )?.content?.itemContent?.tweet_results?.result

  if (!tweetResult) return null

  const typename = tweetResult.__typename
  if (!typename || typename === 'TweetUnavailable' || typename === 'TweetTombstone') return null

  let baseTweet = tweetResult.legacy
  if (typename === 'TweetWithVisibilityResults') {
    baseTweet = tweetResult.tweet?.legacy
  }

  const repostedMedia = typename === 'TweetWithVisibilityResults'
    ? baseTweet?.retweeted_status_result?.result?.tweet?.legacy?.extended_entities?.media
    : baseTweet?.retweeted_status_result?.result?.legacy?.extended_entities?.media

  return repostedMedia || baseTweet?.extended_entities?.media || null
}

async function fetchSyndication(tweetId: string): Promise<any> {
  const token = ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
  const url = new URL('https://cdn.syndication.twimg.com/tweet-result')
  url.searchParams.set('id', tweetId)
  url.searchParams.set('token', token)

  try {
    const res = await fetch(url.toString(), {
      headers: { 'user-agent': USER_AGENT }
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function extractTwitter(url: string): Promise<ExtractionResult> {
  const tweetId = extractTweetId(url)
  if (!tweetId) {
    return { ok: false, error: 'Could not extract tweet ID.' }
  }

  try {
    // Try GraphQL first
    let guestToken = await getGuestToken()
    if (guestToken) {
      const tweet = await fetchTweetGraphQL(tweetId, guestToken)
      if (tweet) {
        const media = extractMediaFromGraphQL(tweet, tweetId)
        if (media?.length) {
          const videoItem = media.find((m: any) => m.type === 'video' || m.type === 'animated_gif')
          if (videoItem?.video_info?.variants) {
            const videoUrl = bestQuality(videoItem.video_info.variants)
            if (videoUrl) return { ok: true, downloadUrl: videoUrl, fetchHeaders: { 'user-agent': USER_AGENT } }
          }
        }
      }
    }

    // Fallback: syndication API
    const syndication = await fetchSyndication(tweetId)
    if (syndication) {
      const media = syndication.mediaDetails
      if (media?.length) {
        const videoItem = media.find((m: any) => m.type === 'video' || m.type === 'animated_gif')
        if (videoItem?.video_info?.variants) {
          const videoUrl = bestQuality(videoItem.video_info.variants)
          if (videoUrl) return { ok: true, downloadUrl: videoUrl }
        }
      }
    }

    return { ok: false, error: 'No video found in tweet.' }
  } catch (err) {
    return { ok: false, error: `Twitter extraction failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}
