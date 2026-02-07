import React from 'react'

export default function About() {
  return (
    <div className="page">
      <h2>About ClipDuel</h2>
      <div className="card">
        <h3>What is ClipDuel?</h3>
        <p className="muted">
          ClipDuel is a competitive clip-hunting game. Players are given categories and a timer,
          then race to find the best short clips from TikTok, YouTube Shorts, Instagram Reels,
          and other platforms. When the timer ends, everyone votes on the best submissions.
        </p>
      </div>

      <div className="card">
        <h3>Cookies &amp; data</h3>
        <p className="muted">
          ClipDuel uses only essential cookies required for the service to function:
        </p>
        <ul className="muted" style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li><strong>cc_session</strong> &mdash; Session cookie for authentication. HttpOnly, expires after 30 days.</li>
          <li><strong>localStorage</strong> &mdash; Display name, game drafts, theme preference, blocked/favourite player lists. Stored locally in your browser only.</li>
        </ul>
        <p className="muted">
          We do not use tracking cookies, analytics cookies, or any third-party advertising cookies.
          Essential cookies are exempt from consent under UK PECR Regulation 6(4) as they are strictly
          necessary for the service.
        </p>
      </div>

      <div className="card">
        <h3>Sponsoring &amp; advertising</h3>
        <p className="muted">
          ClipDuel sponsor slots are subject to automatic content moderation. All advertisements
          must comply with:
        </p>
        <ul className="muted" style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>UK Advertising Standards Authority (ASA) CAP Code</li>
          <li>Consumer Rights Act 2015</li>
          <li>UK Data Protection Act 2018 / UK GDPR</li>
          <li>Privacy and Electronic Communications Regulations (PECR) 2003</li>
        </ul>
        <p className="muted">
          Sponsors purchase impression credits. 1 credit = 1 player impression per game.
          Sponsor creatives are moderated for inappropriate content including profanity,
          slurs, and explicit imagery. Rejected creatives are not shown.
        </p>
      </div>

      <div className="card">
        <h3>Your rights</h3>
        <p className="muted">
          Under UK GDPR, you have the right to access, rectify, and delete your personal data.
          Account holders can manage their data from the Account page. To request data deletion,
          contact us through the site.
        </p>
      </div>
    </div>
  )
}
