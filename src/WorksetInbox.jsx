import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {supabase} from './supabase'

// Web-first inbox. The badge polls while the tab is open; browser alerts are
// optional and are never advertised as background push notifications.
export default function WorksetInbox({session,profile,friends=[],onOpenTogether,onAcceptLive}){
  const userId=session?.user?.id
  const [open,setOpen]=useState(false)
  const [view,setView]=useState('notifications')
  const [notifications,setNotifications]=useState([])
  const [chats,setChats]=useState([])
  const [chatMembers,setChatMembers]=useState([])
  const [activeChat,setActiveChat]=useState('')
  const [messages,setMessages]=useState([])
  const [groupNames,setGroupNames]=useState({})
  const [draft,setDraft]=useState('')
  const [newChat,setNewChat]=useState('')
  const [groupTitle,setGroupTitle]=useState('')
  const [groupFriends,setGroupFriends]=useState([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [status,setStatus]=useState('')
  const [emailEnabled,setEmailEnabled]=useState(profile?.workset_email_invites!==false)
  const initialized=useRef(false)
  const known=useRef(new Set())
  const activeChatRef=useRef('')
  const inboxRef=useRef(null)
  const unread=notifications.filter(n=>!n.read_at).length
  useEffect(()=>setEmailEnabled(profile?.workset_email_invites!==false),[profile?.workset_email_invites])
  const ownName=profile?.display_name||'You'
  const friendName=id=>friends.find(f=>f.user_id===id)?.display_name||'Member'

  const loadNotifications=useCallback(async()=>{
    if(!userId)return
    const {data,error:loadError}=await supabase.from('workset_notifications')
      .select('id,actor_user_id,kind,title,body,related_id,created_at,read_at,resolved_at')
      .eq('recipient_user_id',userId).order('created_at',{ascending:false}).limit(100)
    if(loadError){setError('Notifications: '+loadError.message);return}
    const rows=data||[]
    if(initialized.current && typeof Notification!=='undefined' &&
      Notification.permission==='granted' && document.visibilityState==='hidden'){
      const incoming=rows.filter(row=>!row.read_at&&!known.current.has(row.id))
      incoming.slice(0,2).forEach(row=>new Notification(row.title,{body:row.body,tag:row.id}))
    }
    known.current=new Set(rows.map(row=>row.id))
    initialized.current=true
    setNotifications(rows)
  },[userId])

  const loadChats=useCallback(async()=>{
    if(!userId)return
    const {data:joined,error:joinError}=await supabase.from('workset_chat_members')
      .select('chat_id,last_read_at').eq('user_id',userId).limit(100)
    if(joinError){setError('Messages: '+joinError.message);return}
    const ids=(joined||[]).map(row=>row.chat_id)
    if(!ids.length){setChats([]);setChatMembers([]);return}
    const [found,allMembers]=await Promise.all([
      supabase.from('workset_chats')
        .select('id,kind,title,created_by,program_group_id,updated_at').in('id',ids)
        .order('updated_at',{ascending:false}),
      supabase.from('workset_chat_members').select('chat_id,user_id,last_read_at').in('chat_id',ids)
    ])
    if(found.error||allMembers.error){setError((found.error||allMembers.error).message);return}
    setChats(found.data||[])
    setChatMembers(allMembers.data||[])
  },[userId])

  const loadMessages=useCallback(async(id)=>{
    if(!id||!userId)return
    const {data,error:loadError}=await supabase.from('workset_chat_messages')
      .select('id,chat_id,sender_user_id,body,created_at').eq('chat_id',id)
      .order('created_at',{ascending:false}).limit(100)
    if(loadError){setError('Messages: '+loadError.message);return}
    if(activeChatRef.current===id)setMessages((data||[]).reverse())
  },[userId])

  useEffect(()=>{
    initialized.current=false; known.current=new Set()
    setNotifications([]);setChats([]);setActiveChat('');setMessages([])
    if(!userId)return
    loadNotifications()
    const interval=setInterval(()=>loadNotifications(),12000)
    const focus=()=>loadNotifications()
    window.addEventListener('focus',focus)
    return()=>{clearInterval(interval);window.removeEventListener('focus',focus)}
  },[userId,loadNotifications])

  useEffect(()=>{
    if(!open||!userId)return
    loadNotifications()
    if(view==='messages')loadChats()
    const interval=setInterval(()=>{
      if(document.visibilityState==='hidden')return
      loadNotifications()
      if(view==='messages'){
        loadChats()
        if(activeChatRef.current)loadMessages(activeChatRef.current)
      }
    },10000)
    return()=>clearInterval(interval)
  },[open,userId,view,loadNotifications,loadChats,loadMessages])

  useEffect(()=>{
    const onEscape=event=>{if(event.key==='Escape')setOpen(false)}
    window.addEventListener('keydown',onEscape)
    return()=>window.removeEventListener('keydown',onEscape)
  },[])

  const markRead=async id=>{
    const {error:saveError}=await supabase.rpc('mark_workset_notifications_read',{target_ids:id?[id]:null})
    if(saveError)setError(saveError.message)
    else await loadNotifications()
  }

  const selectChat=async id=>{
    if(!id)return
    activeChatRef.current=id
    setActiveChat(id);setMessages([]);setNewChat('');setView('messages')
    await Promise.all([
      loadMessages(id),
      supabase.rpc('mark_workset_chat_read',{target_chat:id})
    ])
    await loadNotifications()
    const chat=chats.find(c=>c.id===id)
    if(chat?.program_group_id){
      const {data}=await supabase.from('program_group_members')
        .select('user_id,display_name').eq('group_id',chat.program_group_id)
      setGroupNames(Object.fromEntries((data||[]).map(row=>[row.user_id,row.display_name])))
    }
  }

  const openFromNotification=async row=>{
    setError('');setStatus('')
    if(row.kind==='message'||row.kind==='chat_added'){
      setView('messages');setOpen(true)
      await loadChats()
      await selectChat(row.related_id)
    }else{
      await markRead(row.id)
      onOpenTogether?.(row.kind==='program_invite'?'community':'live')
      setOpen(false)
    }
  }

  const respond=async(row,response)=>{
    if(busy)return
    setBusy(true);setError('')
    try{
      let request
      if(row.kind==='friend_request')request=supabase.rpc('respond_workset_friend_request',
        {target_friendship:row.related_id,response})
      else if(row.kind==='live_invite')request=supabase.rpc('respond_to_together_invite',
        {target_invite:row.related_id,response})
      else request=supabase.rpc('respond_workset_program_group_invite',
        {target_invite:row.related_id,response})
      const {data,error:actionError}=await request
      if(actionError){setError(actionError.message);return}
      await markRead(row.id)
      if(response==='accepted'){
        if(row.kind==='live_invite')await onAcceptLive?.(data?.[0]?.session_id)
        else {
          onOpenTogether?.(row.kind==='program_invite'?'community':'live')
          if(row.kind==='program_invite')window.dispatchEvent(new Event('workset:groups-updated'))
        }
        setOpen(false)
      }else setStatus('Invitation dismissed.')
    }catch(e){setError(e?.message||'Could not respond.')}
    finally{setBusy(false)}
  }

  const startDirect=async friend=>{
    if(busy)return
    setBusy(true);setError('')
    const {data,error:chatError}=await supabase.rpc('start_workset_direct_chat',{friend_user_id:friend.user_id})
    setBusy(false)
    if(chatError){setError(chatError.message);return}
    await loadChats()
    await selectChat(data)
  }

  const startGroup=async()=>{
    if(busy||groupFriends.length<2||!groupTitle.trim())return
    setBusy(true);setError('')
    const {data,error:chatError}=await supabase.rpc('start_workset_group_chat',{
      group_title:groupTitle.trim(),friend_ids:groupFriends
    })
    setBusy(false)
    if(chatError){setError(chatError.message);return}
    setGroupTitle('');setGroupFriends([])
    await loadChats();await selectChat(data)
  }

  const send=async event=>{
    event?.preventDefault()
    if(busy||!activeChat||!draft.trim())return
    const content=draft.trim()
    setBusy(true);setError('')
    const {error:sendError}=await supabase.rpc('send_workset_message',{
      target_chat:activeChat,message_body:content
    })
    setBusy(false)
    if(sendError){setError(sendError.message);return}
    setDraft('')
    await Promise.all([loadMessages(activeChat),loadChats()])
  }

  const enableAlerts=async()=>{
    if(typeof Notification==='undefined'){setStatus('Browser alerts are unavailable here.');return}
    const permission=await Notification.requestPermission()
    setStatus(permission==='granted'?'Browser alerts enabled while WorkSet is open.':
      'Browser alerts were not enabled.')
  }
  const changeEmail=async()=>{
    if(!userId)return
    const next=!emailEnabled
    const {error:saveError}=await supabase.from('profiles')
      .update({workset_email_invites:next}).eq('id',userId)
    if(saveError){setError(saveError.message);return}
    setEmailEnabled(next)
    setStatus(next?'Email invitations enabled, when mail delivery is configured.':'Email invitations disabled.')
  }

  useEffect(()=>{
    const handle=async e=>{
      if(!userId)return
      setOpen(true);setView('messages');setError('')
      const target=e.detail?.programGroupId
      if(!target){await loadChats();return}
      setBusy(true)
      const {data,error:rpcError}=await supabase.rpc('start_workset_program_chat',{target_group:target})
      setBusy(false)
      if(rpcError){setError(rpcError.message);return}
      await loadChats()
      await selectChat(data)
    }
    window.addEventListener('workset:open-messages',handle)
    return()=>window.removeEventListener('workset:open-messages',handle)
  },[userId,loadChats])

  const current=chats.find(c=>c.id===activeChat)
  const chatLabel=chat=>{
    if(!chat)return 'Messages'
    if(chat.kind!=='direct')return chat.title
    const other=chatMembers.find(m=>m.chat_id===chat.id&&m.user_id!==userId)
    return friendName(other?.user_id)
  }
  const displaySender=id=>id===userId?ownName:(groupNames[id]||friendName(id))
  const formatTime=value=>{
    const date=new Date(value)
    return Number.isNaN(date.getTime())?'':date.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
  }

  return <div className="ws-inbox" ref={inboxRef}>
    <button type="button" className="ws-bell" title="Notifications and messages" aria-label={'Notifications and messages, '+unread+' unread'}
      aria-expanded={open} onClick={()=>{setOpen(v=>!v);setView('notifications');setError('');setStatus('')}}>
      <svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/>
        <path d="M10 21h4"/>
      </svg>
      {unread>0&&<span className="ws-bell-badge">{unread>99?'99+':unread}</span>}
    </button>
    {open&&<div className="ws-inbox-backdrop" onClick={()=>setOpen(false)}/>}
    {open&&<aside className="ws-inbox-panel" role="dialog" aria-label="WorkSet inbox">
      <div className="ws-inbox-top"><strong>WorkSet inbox</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close inbox">×</button></div>
      <div className="ws-inbox-tabs">
        <button type="button" className={view==='notifications'?'selected':''} onClick={()=>setView('notifications')}>Notifications{unread>0?' ('+unread+')':''}</button>
        <button type="button" className={view==='messages'?'selected':''} onClick={()=>{setView('messages');loadChats()}}>Messages</button>
      </div>
      {error&&<p className="ws-inbox-error" role="alert">{error}</p>}
      {status&&<p className="ws-inbox-status" role="status">{status}</p>}
      {view==='notifications'?<>
        <div className="ws-inbox-toolbar">
          <small>{unread?unread+' unread':'All caught up'}</small>
          {unread>0&&<button type="button" onClick={()=>markRead(null)}>Mark all read</button>}
        </div>
        <div className="ws-inbox-scroll">
          {!notifications.length&&<p className="ws-inbox-empty">No notifications yet.</p>}
          {notifications.map(row=><article className={'ws-notification '+(!row.read_at?'unread':'')} key={row.id}>
            <button type="button" className="ws-notification-content" onClick={()=>openFromNotification(row)}>
              <strong>{row.title}</strong><span>{row.body}</span><small>{formatTime(row.created_at)}</small>
            </button>
            {!row.resolved_at&&(row.kind==='friend_request'||row.kind==='live_invite'||row.kind==='program_invite')&&
              <div className="ws-notification-actions">
                <button type="button" disabled={busy} onClick={()=>respond(row,'accepted')}>Accept</button>
                <button type="button" disabled={busy} onClick={()=>respond(row,'declined')}>Decline</button>
              </div>}
            {!row.read_at&&<button type="button" className="ws-mark-read" onClick={()=>markRead(row.id)}>Mark read</button>}
          </article>)}
        </div>
        <div className="ws-inbox-settings">
          <button type="button" onClick={enableAlerts}>Enable browser alerts</button>
          <label><input type="checkbox" checked={emailEnabled} onChange={changeEmail}/> Email invitations</label>
          <small>Browser alerts work while WorkSet is open. Emails require a configured sender.</small>
        </div>
      </>:<>
        {activeChat?<div className="ws-chat-thread">
          <div className="ws-chat-thread-head"><button type="button" onClick={()=>{activeChatRef.current='';setActiveChat('');setMessages([])}}>←</button><strong>{chatLabel(current)}</strong></div>
          <div className="ws-chat-messages" aria-live="polite">
            {!messages.length&&<p className="ws-inbox-empty">Start the conversation.</p>}
            {messages.map(m=><div className={'ws-chat-bubble '+(m.sender_user_id===userId?'mine':'theirs')} key={m.id}>
              <small>{displaySender(m.sender_user_id)} · {formatTime(m.created_at)}</small>
              <div>{m.body}</div>
            </div>)}
          </div>
          <form className="ws-chat-composer" onSubmit={send}>
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} rows={2} placeholder="Write a message…"/>
            <button type="submit" disabled={busy||!draft.trim()}>Send</button>
          </form>
        </div>:<div className="ws-inbox-scroll">
          <div className="ws-inbox-toolbar"><strong>Conversations</strong><button type="button" onClick={()=>setNewChat(v=>v?'':'choose')}>+ New</button></div>
          {newChat&&<div className="ws-chat-create">
            <strong>New conversation</strong>
            <p className="helper-text">Message an accepted friend or create a group with 2–20 friends.</p>
            <div className="ws-chat-friend-list">
              {friends.map(friend=><div key={friend.user_id}>
                <button type="button" onClick={()=>startDirect(friend)} disabled={busy}>Message {friend.display_name}</button>
                <label><input type="checkbox" checked={groupFriends.includes(friend.user_id)}
                  onChange={e=>setGroupFriends(ids=>e.target.checked?[...ids,friend.user_id]:ids.filter(id=>id!==friend.user_id))}/> Group</label>
              </div>)}
            </div>
            {!friends.length&&<small>Add a friend from Together → Live first.</small>}
            <input value={groupTitle} onChange={e=>setGroupTitle(e.target.value)} maxLength={80} placeholder="Group conversation name"/>
            <button type="button" onClick={startGroup} disabled={busy||groupFriends.length<2||groupTitle.trim().length<2}>Create group chat ({groupFriends.length})</button>
          </div>}
          {!chats.length&&<p className="ws-inbox-empty">No conversations yet. Start with a friend or a program group.</p>}
          {chats.map(chat=><button type="button" className="ws-chat-list-row" key={chat.id} onClick={()=>selectChat(chat.id)}>
            <strong>{chatLabel(chat)}</strong><span>{chat.kind==='direct'?'Private message':chat.kind==='program'?'Program group':'Group chat'}</span>
            <small>{formatTime(chat.updated_at)}</small>
          </button>)}
        </div>}
      </>}
    </aside>}
  </div>
}
