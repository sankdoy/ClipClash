import type { Env } from '../_helpers'

type TierRow = {
  tier_key: string
  tier_label: string
  max_rank: number
  min_avg_viewers: number
  baseline_cpm_usd: number
  discount_rate: number
  last_updated_iso: string
}

type TierView = TierRow & {
  effective_cpm_usd: string
  price_per_game_usd: string
  display_price: number
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function onRequest({ env, request }: { env: Env; request: Request }) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const results = await env.DB.prepare('SELECT * FROM sponsor_tiers ORDER BY max_rank ASC').all()
  const tiers = (results.results ?? []) as TierRow[]

  const tierData: TierView[] = tiers.map((tier) => {
    const effectiveCpm = tier.baseline_cpm_usd * (1 - tier.discount_rate)
    const price = (tier.min_avg_viewers / 1000) * effectiveCpm
    return {
      ...tier,
      effective_cpm_usd: effectiveCpm.toFixed(2),
      price_per_game_usd: price.toFixed(2),
      display_price: Math.round(price)
    }
  })

  const exampleTier = tierData[0]

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sponsor a ClipClash Game</title>
    <style>
      body { font-family: ui-sans-serif, system-ui; background: #0f1218; color: #f8fafc; margin: 0; padding: 24px; }
      .wrap { max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
      .card { background: #1d2330; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 20px; }
      h1, h2, h3 { margin: 0 0 10px; }
      p { margin: 0 0 12px; color: #c7d0de; }
      ul { margin: 0 0 12px 20px; color: #c7d0de; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; color: #f8fafc; }
      th, td { border-bottom: 1px solid rgba(255,255,255,0.12); padding: 8px; text-align: left; font-size: 0.9rem; }
      label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      input, select, textarea { background: #242c3a; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 12px; color: #f8fafc; }
      button { background: #ff9a1f; color: #1a1205; border: none; border-radius: 999px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
      .counter { font-size: 0.85rem; color: #9aa6b2; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Sponsor a ClipClash Game</h1>
        <p>A clean sponsor stinger — not a messy banner ad.</p>
        <h2>What you get</h2>
        <ul>
          <li>Your sponsor appears once per game in an unskippable 3.5 second “Sponsored by …” stinger at the start.</li>
          <li>Your sponsor also appears on the Results screen with a “Visit sponsor” button.</li>
          <li>No popups. No mid-game banners. No spam.</li>
        </ul>

        <h2>Streamer Games (Top 250 only)</h2>
        <p>Streamer Games only run when the host is inside the Top 250 streamers list. We price per game by tier, using the FLOOR (minimum) average viewers of that tier. This keeps pricing predictable and fair.</p>
        ${
          exampleTier
            ? `
        <p>Formula:</p>
        <ul>
          <li>Baseline CPM: $${exampleTier.baseline_cpm_usd}</li>
          <li>Discount: ${exampleTier.discount_rate * 100}%</li>
          <li>Effective CPM: $${exampleTier.effective_cpm_usd}</li>
          <li>Price per game: (min_avg_viewers / 1000) * effective_cpm_usd</li>
        </ul>
        `
            : ''
        }

        <table>
          <thead>
            <tr><th>Tier</th><th>Eligibility</th><th>Tier floor avg viewers</th><th>Effective CPM</th><th>Price per streamer game</th></tr>
          </thead>
          <tbody>
            ${
              tierData.length > 0
                ? tierData
                    .map(
                      (t) => `
              <tr>
                <td>${escapeHtml(t.tier_label)}</td>
                <td>Rank 1–${t.max_rank}</td>
                <td>${t.min_avg_viewers}</td>
                <td>$${t.effective_cpm_usd}</td>
                <td>$${t.price_per_game_usd} ${t.min_avg_viewers === 0 ? '(Updating)' : ''}</td>
              </tr>
            `
                    )
                    .join('')
                : '<tr><td colspan="5">No tier data yet.</td></tr>'
            }
          </tbody>
        </table>

        ${
          exampleTier
            ? `
        <p>Example (Top 5): We use the lowest average viewers in Top 5: ${exampleTier.min_avg_viewers}. Effective CPM: $${exampleTier.effective_cpm_usd} (20% cheaper than typical $${exampleTier.baseline_cpm_usd}). Price: (${exampleTier.min_avg_viewers}/1000) × ${exampleTier.effective_cpm_usd} = $${exampleTier.price_per_game_usd} per streamer game.</p>
        <p>Last updated: ${escapeHtml(exampleTier.last_updated_iso)} | Source: TwitchMetrics</p>
        `
            : ''
        }

        <h2>Standard Games</h2>
        <p>Standard inventory coming soon.</p>
      </div>

      <div class="card">
        <h2>Sponsor Inquiry</h2>
        <form method="POST" action="/sponsor/submit">
          <label>
            Inventory type
            <select name="inventory_type">
              <option>Streamer Games</option>
              <option>Standard Games</option>
            </select>
          </label>
          <label>
            Tier (for Streamer Games)
            <select name="tier_key">
              ${tierData.map((t) => `<option value="${escapeHtml(t.tier_key)}">${escapeHtml(t.tier_label)}</option>`).join('')}
            </select>
          </label>
          <label>
            Brand name
            <input name="brand_name" maxlength="40" required>
          </label>
          <label>
            Tagline
            <input id="tagline" name="tagline" maxlength="80" required>
            <span id="char-count" class="counter">0/80</span>
          </label>
          <label>
            Destination URL
            <input name="destination_url" type="url" pattern="https://.*" required>
          </label>
          <label>
            Image URL (PNG/JPG, 1200x600, max 500 KB)
            <input name="image_url" required>
          </label>
          <label>
            Contact email
            <input name="contact_email" type="email" required>
          </label>
          <label>
            Notes
            <textarea name="notes"></textarea>
          </label>
          <button type="submit">Submit</button>
        </form>
      </div>
    </div>
    <script>
      const input = document.getElementById('tagline');
      const counter = document.getElementById('char-count');
      const update = () => { counter.textContent = input.value.length + '/80'; };
      input.addEventListener('input', update);
      update();
    </script>
  </body>
</html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
