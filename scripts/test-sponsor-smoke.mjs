const baseUrl = process.env.SPONSOR_SMOKE_BASE_URL || 'http://localhost:5173'
const tiersUrl = `${baseUrl}/api/sponsor/tiers`
const submitUrl = `${baseUrl}/api/sponsor/submit`

async function run() {
  console.log(`Sponsor smoke test: ${baseUrl}`)

  try {
    const tiersRes = await fetch(tiersUrl)
    if (!tiersRes.ok) {
      throw new Error(`tiers failed: ${tiersRes.status}`)
    }
    const tiersData = await tiersRes.json()
    const count = Array.isArray(tiersData?.tiers) ? tiersData.tiers.length : 0
    console.log(`tiers ok (${count} tiers)`)
  } catch (error) {
    console.error('tiers error', error.message)
    process.exitCode = 1
    return
  }

  const form = new FormData()
  form.append('inventory_type', 'Streamer Games')
  form.append('tier_key', 'top5')
  form.append('brand_name', 'Smoke Test Brand')
  form.append('contact_email', 'smoke@example.com')
  form.append('destination_url', 'https://example.com')
  form.append('tagline', 'Sponsor smoke test')
  form.append('image_url', 'https://example.com/logo.png')
  form.append('notes', 'Automated smoke test')

  try {
    const submitRes = await fetch(submitUrl, { method: 'POST', body: form })
    if (!submitRes.ok) {
      throw new Error(`submit failed: ${submitRes.status}`)
    }
    console.log('submit ok')
  } catch (error) {
    console.error('submit error', error.message)
    process.exitCode = 1
  }
}

run()
