import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
          source:JSON.stringify({buildId,builtAt})
        })
      },
    },
  ],
  define:{
    __WORKSET_BUILD_ID__:JSON.stringify(buildId),
  },
  base: process.env.GITHUB_ACTIONS ? '/WorkoutBoard/' : '/',
})
