import {useMemo,useState} from 'react'
import {WORKSET_UPDATE_NOTES} from './worksetUpdateNotes.js'
const REPO='https://github.com/aalbertsberg-dotcom/WorkoutBoard'
const history=__WORKSET_CHANGE_HISTORY__
const dateLabel=value=>String(value||'').slice(0,10)
const PAGE_SIZE=50
export default function WhatsNewPage({onBack}){
  const [query,setQuery]=useState('')
  const [limit,setLimit]=useState(PAGE_SIZE)
  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase()
    return history.entries.filter(row=>!q||[row.subject,row.sha,dateLabel(row.date)].some(value=>value.toLowerCase().includes(q)))
  },[query])
  return <section className="whats-new-page">
    <div className="me-subpage-header">
      <button type="button" className="me-subpage-back" aria-label="Back to Settings" onClick={onBack}><span aria-hidden="true">←</span> Settings</button>
      <h2>What's New</h2>
      <p>What's changed in WorkSet, from major features to small fixes.</p>
    </div>
    <section className="simple-card" aria-label="Installed version">
      <h3>WorkSet v{__WORKSET_APP_VERSION__}</h3>
      <p className="whats-new-meta">Installed build {String(__WORKSET_BUILD_ID__).slice(0,12)}</p>
      <p className="whats-new-meta">Changes included in this build. Service availability and native releases may differ.</p>
    </section>
    {WORKSET_UPDATE_NOTES.map(note=><article className="simple-card" key={note.id}>
      <small className="whats-new-meta">{note.date}{note.version?' · '+note.version:''}</small>
      <h3>{note.title}</h3>
      <ul className="whats-new-notes">{note.items.map(([kind,description],i)=><li key={i}><span className="whats-new-kind">{kind}</span>{description}</li>)}</ul>
    </article>)}
    <section className="simple-card">
      <details>
        <summary>Complete technical history ({history.entries.length.toLocaleString()} commits)</summary>
        <p className="whats-new-meta">{history.complete?'All commits reachable from this source revision at build time.':'This build has partial or unavailable Git history. See GitHub for the complete repository log.'} Includes minor changes, tests and maintenance.</p>
        <label className="whats-new-search">Search changes<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(PAGE_SIZE)}} placeholder="Feature, date or commit…"/></label>
        <div className="whats-new-log">
          {matches.slice(0,limit).map(row=><a className="whats-new-entry" key={row.sha} href={REPO+'/commit/'+row.sha} target="_blank" rel="noreferrer"><span>{row.subject}<small>{dateLabel(row.date)}</small></span><code>{row.sha.slice(0,8)}</code></a>)}
          {!matches.length&&<p role="status">No matching changes.</p>}
        </div>
        <p className="whats-new-meta">Showing {Math.min(limit,matches.length)} of {matches.length} matching commits.</p>
        {limit<matches.length&&<button type="button" className="secondary-action" onClick={()=>setLimit(n=>n+PAGE_SIZE)}>Show older changes</button>}
      </details>
      <a href={REPO+'/commits/main/'} target="_blank" rel="noreferrer">View latest source changes on GitHub</a>
    </section>
  </section>
}
