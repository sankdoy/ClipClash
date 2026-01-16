import React from 'react'
import readme from '../../../README.md?raw'

function extractSummary(md: string) {
  const lines = md.split('\n').map(l => l.trim())
  const paras = [] as string[]
  let cur = [] as string[]
  for (const l of lines) {
    if (l === '') {
      if (cur.length) { paras.push(cur.join(' ')); cur = [] }
    } else cur.push(l)
  }
  if (cur.length) paras.push(cur.join(' '))
  return paras[0] ?? 'TikTok Olympics'
}

export default function About() {
  const summary = extractSummary(readme)
  return (
    <div className="page">
      <h2>About</h2>
      <p>{summary}</p>
      <section>
        <h3>Game summary</h3>
        <p>See the README for full roadmap and details.</p>
      </section>
    </div>
  )
}
