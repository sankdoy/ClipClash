import { json, type Env } from './_helpers'

export async function onRequestGet({ env }: { request: Request; env: Env }) {
  try {
    // Platform usage breakdown
    const platformRows = await env.DB.prepare(
      `SELECT platform, COUNT(*) as count FROM global_submissions
       GROUP BY platform ORDER BY count DESC`
    ).all<{ platform: string; count: number }>()

    // Top 20 most shared creators
    const creatorRows = await env.DB.prepare(
      `SELECT platform, creator_handle, COUNT(*) as count FROM global_submissions
       WHERE creator_handle IS NOT NULL AND creator_handle != ''
       GROUP BY platform, creator_handle
       ORDER BY count DESC LIMIT 20`
    ).all<{ platform: string; creator_handle: string; count: number }>()

    // Total submissions
    const totalRow = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM global_submissions`
    ).first<{ total: number }>()

    return json({
      ok: true,
      totalSubmissions: totalRow?.total ?? 0,
      platforms: platformRows.results ?? [],
      topCreators: creatorRows.results ?? []
    })
  } catch {
    return json({ ok: true, totalSubmissions: 0, platforms: [], topCreators: [] })
  }
}
