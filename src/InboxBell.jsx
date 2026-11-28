import {useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from './supabase'

// Lightweight header preview. The complete inbox lives in Me, not in a modal.
export default function InboxBell({session,onOpenInbox}){
  const userId=session?.user?.id
  const [open,setOpen]=useState(false)
  const [rows,setRows]=useState([])
  const [error,setError]=useState('')
  const root=useRef(null)
  const previouslySeen=useRef(new Set())
  const initialized=useRef(false)
  const unread=rows.filter(row=>!row.read_at).length

  const load=useCallback(async()=>{
    if(!userId)return
    const {data,error:loadError}=await supabase.from('workset_notifications')
      .select('id,kind,title,body,created_at,read_at,related_id')
      .eq('recipient_user_id',userId).order('created_at',{ascending:false}).limit(100)
    if(loadError){setError('Could not load notifications');return}
    const incoming=data||[]
    if(initialized.current && typeof Notification!=='undefined' &&
      Notification.permission==='granted' && document.visibilityState==='hidden'){
      incoming.filter(row=>!row.read_at&&!previouslySeen.current.has(row.id)).slice(0,2)
        .forEach(row=>{try{new Notification(row.title,{body:row.body,tag:row.id})}catch{}})
    }
    previouslySeen.current=new Set(incoming.map(row=>row.id))
    initialized.current=true
    setRows(incoming)
    setError('')
  },[userId])

  useEffect(()=>{
    initialized.current=false
    previouslySeen.current=new Set()
    setRows([])
    if(!userId)return
    load()
    const interval=window.setInterval(load,12000)
    const focus=()=>load()
    window.addEventListener('focus',focus)
    return()=>{window.clearInterval(interval);window.removeEventListener('focus',focus)}
  },[userId,load])

  useEffect(()=>{
    if(!open)return
    const outside=event=>{if(root.current&&!root.current.contains(event.target))setOpen(false)}
    const escape=event=>{if(event.key==='Escape')setOpen(false)}
    document.addEventListener('pointerdown',outside)
    document.addEventListener('keydown',escape)
    return()=>{
      document.removeEventListener('pointerdown',outside)
      document.removeEventListener('keydown',escape)
    }
  },[open])

  const navigate=(view='notifications',chatId=null)=>{
    setOpen(false)
    onOpenInbox?.({view,chatId})
  }
  return <div className="ws-bell-wrap" ref={root}>
    <button type="button" className="ws-bell" aria-expanded={open}
      aria-haspopup="true" aria-label={unread+' unread WorkSet notifications'}
      title="Notifications" onClick={()=>{setOpen(value=>!value);load()}}>
      <svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" fill="none"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/>
        <path d="M10 21h4"/>
      </svg>
      {unread>0&&<span className="ws-bell-badge">{unread>99?'99+':unread}</span>}
    </button>
    {open&&<div className="ws-bell-popover" role="region" aria-label="Recent notifications">
      <div className="ws-bell-popover-head">
        <strong>Notifications</strong><small>{unread?unread+' unread':'All caught up'}</small>
      </div>
      {error&&<p role="alert" className="ws-inbox-error">{error}</p>}
      {!rows.length&&!error&&<p className="ws-bell-empty">You're all caught up.</p>}
      {rows.slice(0,5).map(row=><button type="button" key={row.id}
        className={'ws-bell-preview '+(!row.read_at?'unread':'')}
        onClick={()=>navigate(row.kind==='message'||row.kind==='chat_added'?'messages':'notifications',
          row.kind==='message'||row.kind==='chat_added'?row.related_id:null)}>
        <strong>{row.title}</strong><span>{row.body}</span>
      </button>)}
      <div className="ws-bell-preview-actions">
        <button type="button" onClick={()=>navigate('notifications')}>View all in Me</button>
        <button type="button" onClick={()=>navigate('messages')}>Messages</button>
      </div>
    </div>}
  </div>
}
