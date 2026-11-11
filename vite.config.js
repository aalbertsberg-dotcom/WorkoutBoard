import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type:'json' }

const buildId = process.env.GITHUB_SHA || `dev-${Date.now()}`
const builtAt = new Date().toISOString()

export default defineConfig({
  plugins: [
    react(),
    {
      name:'workset-release-info',
      generateBundle() {
        this.emitFile({
          type:'asset',
          fileName:'version.json',
          source:JSON.stringify({appVersion:pkg.version,buildId,builtAt})
        })
      },
    },
  ],
  define:{
    __WORKSET_BUILD_ID__:JSON.stringify(buildId),
    __WORKSET_APP_VERSION__:JSON.stringify(pkg.version),
  },
  base: process.env.GITHUB_ACTIONS ? '/WorkoutBoard/' : '/',
})
