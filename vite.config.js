import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {execFileSync} from 'node:child_process'
import pkg from './package.json' with { type:'json' }

const buildId = process.env.GITHUB_SHA || `dev-${Date.now()}`
const builtAt = new Date().toISOString()

// Public source history is bundled with the build, not fetched at runtime.
function changeHistory(){
  try{
    const shallow=execFileSync('git',['rev-parse','--is-shallow-repository'],{encoding:'utf8'}).trim()==='true'
    const raw=execFileSync('git',['log','--format=%H%x09%cI%x09%s','HEAD'],{encoding:'utf8',maxBuffer:32*1024*1024})
    const entries=raw.trim().split('\n').filter(Boolean).map(line=>{
      const [sha,date,...subject]=line.split('\t')
      return {sha,date,subject:subject.join(' ')}
    }).filter(row=>/^[a-f0-9]{40}$/.test(row.sha)&&row.subject)
    return {entries,complete:!shallow}
  }catch{return {entries:[],complete:false}}
}
const changes=changeHistory()

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
    __WORKSET_CHANGE_HISTORY__:JSON.stringify(changes),
  },
  base: process.env.WORKSET_NATIVE_BUILD==='true' ? './' : process.env.GITHUB_ACTIONS ? '/WorkoutBoard/' : '/',
})
