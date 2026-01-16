import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // expose package version at build time if needed
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0')
  }
})
