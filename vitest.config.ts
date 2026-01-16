import { defineConfig } from 'vitest/config'

process.env.VITE_CJS_IGNORE_WARNING = '1'

export default defineConfig({
  cacheDir: '/tmp/vitest-cache',
  test: {
    environment: 'node'
  }
})
