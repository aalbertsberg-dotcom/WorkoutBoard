import {Component} from 'react'

// An unexpected screen error must not strand users on a blank page.
export default class WorksetErrorBoundary extends Component {
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  componentDidCatch(error,info){
    console.error('WorkSet screen failed',error,info?.componentStack)
  }
  exportRecovery=()=>{
    const data={format:'WorkSet local recovery',version:1,exported_at:new Date().toISOString(),entries:{}}
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)
        if(/^(wb-planned-draft-|wb-planned-draft-ts-|workset-offline-queue-|workset-offline-state-v1:)/.test(key))
          data.entries[key]=localStorage.getItem(key)
      }
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
      const url=URL.createObjectURL(blob)
      const link=document.createElement('a')
      link.href=url;link.download='WorkSet-local-recovery-'+new Date().toISOString().slice(0,10)+'.json'
      document.body.appendChild(link);link.click();link.remove()
      setTimeout(()=>URL.revokeObjectURL(url),3000)
    }catch(error){console.error('Recovery export failed',error)}
  }
  render(){
    if(!this.state.error)return this.props.children
    return <main className="workset-crash-screen" role="alert">
      <h1>WorkSet needs to reload</h1>
      <p>Something interrupted this screen. Reloading does not intentionally delete saved workouts or pending offline changes.</p>
      <button type="button" onClick={()=>window.location.reload()}>Reload WorkSet</button>
      <button type="button" className="secondary-action" onClick={this.exportRecovery}>Export local recovery copy</button>
      <small>If the issue repeats, keep the recovery file and report what you were doing. This file contains personal workout data; keep it private.</small>
    </main>
  }
}
