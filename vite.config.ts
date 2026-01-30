import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function isLikelyLocalWsUrl(value: string) {
  const trimmed = value.trim()
  return /^(ws|wss):\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(trimmed)
}

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    // Safety: production builds must not rely on .env files (especially .env.local).
    // Cloudflare Pages should inject this as an environment variable.
    const wsUrl = process.env.VITE_ROOMS_WS_URL
    if (!wsUrl || wsUrl.trim().length === 0) {
      throw new Error(
        'Missing VITE_ROOMS_WS_URL. Set it as an environment variable in Cloudflare Pages (not via .env files).'
      )
    }
    if (!/^(ws|wss):\/\//i.test(wsUrl.trim())) {
      throw new Error('Invalid VITE_ROOMS_WS_URL. Expected a ws:// or wss:// URL.')
    }
    if (isLikelyLocalWsUrl(wsUrl)) {
      throw new Error('Refusing to build with a local VITE_ROOMS_WS_URL in production.')
    }
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0')
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8788',
          changeOrigin: true
        }
      }
    }
  }
})
