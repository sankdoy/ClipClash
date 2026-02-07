import { getSessionUser, json, type Env } from '../_helpers'

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const user = await getSessionUser(env, request)
  if (!user) {
    return json({ ok: false, error: 'Sign in to view analytics.' }, { status: 401 })
  }

  const sponsors = await env.DB.prepare(
    `SELECT s.id, s.name, s.status, s.created_at,
            b.credits_remaining, b.credits_purchased_total, b.credits_spent_total,
            b.last_shown_at
     FROM sponsors s
     LEFT JOIN sponsor_balances b ON b.sponsor_id = s.id
     WHERE s.account_id = ?
     ORDER BY s.created_at DESC`
  )
    .bind(user.id)
    .all()

  const results = []
  for (const sponsor of sponsors.results ?? []) {
    const sponsorId = String(sponsor.id)

    // Get campaign details
    const campaign = await env.DB.prepare(
      `SELECT id, creative_url, click_url, tagline, status
       FROM sponsor_campaigns_v2
       WHERE sponsor_id = ?
       ORDER BY rowid DESC LIMIT 1`
    )
      .bind(sponsorId)
      .first()

    // Get impression summary
    const impressions = await env.DB.prepare(
      `SELECT COUNT(*) as games_shown,
              COALESCE(SUM(impressions_debited), 0) as total_impressions,
              MIN(timestamp) as first_shown,
              MAX(timestamp) as last_shown
       FROM impression_ledger
       WHERE sponsor_id = ?`
    )
      .bind(sponsorId)
      .first()

    // Get click count
    const clicks = await env.DB.prepare(
      `SELECT COUNT(*) as total_clicks
       FROM sponsor_clicks
       WHERE sponsor_id = ?`
    )
      .bind(sponsorId)
      .first()

    // Get recent impressions (last 30 days, grouped by day)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const dailyImpressions = await env.DB.prepare(
      `SELECT
         CAST(timestamp / 86400000 AS INTEGER) as day_bucket,
         SUM(impressions_debited) as impressions,
         COUNT(*) as games
       FROM impression_ledger
       WHERE sponsor_id = ? AND timestamp >= ?
       GROUP BY day_bucket
       ORDER BY day_bucket ASC`
    )
      .bind(sponsorId, thirtyDaysAgo)
      .all()

    const totalImpressions = Number(impressions?.total_impressions ?? 0)
    const totalClicks = Number(clicks?.total_clicks ?? 0)

    results.push({
      sponsorId,
      name: String(sponsor.name),
      status: String(sponsor.status),
      createdAt: Number(sponsor.created_at),
      creditsRemaining: Number(sponsor.credits_remaining ?? 0),
      creditsPurchased: Number(sponsor.credits_purchased_total ?? 0),
      creditsSpent: Number(sponsor.credits_spent_total ?? 0),
      lastShownAt: sponsor.last_shown_at ? Number(sponsor.last_shown_at) : null,
      campaign: campaign ? {
        id: String(campaign.id),
        creativeUrl: String(campaign.creative_url),
        clickUrl: String(campaign.click_url),
        tagline: String(campaign.tagline),
        status: String(campaign.status)
      } : null,
      stats: {
        gamesShown: Number(impressions?.games_shown ?? 0),
        totalImpressions,
        totalClicks,
        clickRate: totalImpressions > 0 ? Number((totalClicks / totalImpressions * 100).toFixed(2)) : 0,
        firstShown: impressions?.first_shown ? Number(impressions.first_shown) : null,
        lastShown: impressions?.last_shown ? Number(impressions.last_shown) : null,
        dailyImpressions: (dailyImpressions.results ?? []).map((row) => ({
          date: Number(row.day_bucket) * 86400000,
          impressions: Number(row.impressions),
          games: Number(row.games)
        }))
      }
    })
  }

  return json({ ok: true, sponsors: results })
}
