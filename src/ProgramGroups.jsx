import {useCallback,useEffect,useMemo,useState} from 'react'
import {supabase} from './supabase'

// Program groups are private. Joining explicitly opts in to sharing completed
// summaries with that group; members can switch it off and delete old summaries.
export default function ProgramGroups({session,profile,programOptions=[]}){
  const userId=session?.user?.id
  const [groups,setGroups]=useState([])
  const [selectedId,setSelectedId]=useState('')
  const [members,setMembers]=useState([])
  const [posts,setPosts]=useState([])
  const [results,setResults]=useState([])
  const [name,setName]=useState('')
  const [program,setProgram]=useState('')
  const [code,setCode]=useState('')
  const [form,setForm]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const selected=groups.find(group=>group.id===selectedId)
  const me=members.find(member=>member.user_id===userId)
  const options=useMemo(()=>[...new Set(programOptions.map(choice=>choice.name).filter(Boolean))],[programOptions])

  const loadGroups=useCallback(async(preferId='')=>{
    if(!userId)return
    const {data,error:loadError}=await supabase.from('program_groups')
      .select('id,owner_user_id,name,program_name,join_code,created_at')
      .order('created_at',{ascending:false})
    if(loadError){setError('Could not load program groups: '+loadError.message);return}
    const next=data||[]
    setGroups(next)
    setSelectedId(previous=>{
      if(preferId&&next.some(row=>row.id===preferId))return preferId
      return next.some(row=>row.id===previous)?previous:(next[0]?.id||'')
    })
  },[userId])

  const loadRecaps=useCallback(async()=>{
    if(!selectedId||!userId)return
    const [{data:memberRows,error:memberError},{data:postRows,error:postError}]=await Promise.all([
      supabase.from('program_group_members').select('user_id,display_name,share_workouts,joined_at')
        .eq('group_id',selectedId).order('joined_at',{ascending:true}),
      supabase.from('program_group_posts').select('id,group_id,week,workout_key,title,first_completed_at,updated_at')
        .eq('group_id',selectedId).order('updated_at',{ascending:false}).limit(80)
    ])
    if(memberError||postError){setError('Could not load group activity: '+(memberError||postError).message);return}
    const nextPosts=postRows||[]
    const ids=nextPosts.map(row=>row.id)
    let resultRows=[]
    if(ids.length){
      const {data,error:resultError}=await supabase.from('program_group_results')
        .select('post_id,user_id,display_name,total_volume,estimated_1rm,completed_at').in('post_id',ids)
      if(resultError){setError('Could not load group results: '+resultError.message);return}
      resultRows=data||[]
    }
    setMembers(memberRows||[])
    setPosts(nextPosts)
    setResults(resultRows)
    setError('')
  },[selectedId,userId])

  useEffect(()=>{if(userId)loadGroups()},[userId,loadGroups])
  useEffect(()=>{
    if(!userId||!selectedId){setMembers([]);setPosts([]);setResults([]);return}
    setLoading(true)
    loadRecaps().finally(()=>setLoading(false))
    const interval=setInterval(()=>{if(document.visibilityState!=='hidden')loadRecaps()},12000)
    const onFocus=()=>loadRecaps()
    window.addEventListener('focus',onFocus)
    return()=>{clearInterval(interval);window.removeEventListener('focus',onFocus)}
  },[userId,selectedId,loadRecaps])

  const execute=async(action,success,preferId='')=>{
    if(busy||!userId)return
    setBusy(true);setError('');setMessage('')
    try{
      const {data,error:actionError}=await action()
      if(actionError){setError(actionError.message);return}
      await loadGroups(preferId||(typeof data==='string'?data:''))
      setMessage(success)
      return data
    }catch(e){setError(e?.message||'Could not complete this action.')}
    finally{setBusy(false)}
  }

  const create=async()=>{
    if(!name.trim()||!program){setError('Choose a program and enter a group name.');return}
    const id=await execute(()=>supabase.rpc('create_program_group',{
      group_name:name.trim(),group_program:program,
      member_name:profile?.display_name||session.user.email?.split('@')[0]||'Member'
    }),'Group created. Share its private join code.')
    if(id){setName('');setForm('')}
  }
  const join=async()=>{
    const joinCode=code.trim().toUpperCase()
    if(!joinCode){setError('Enter the group join code.');return}
    const id=await execute(()=>supabase.rpc('join_program_group',{
      group_code:joinCode,
      member_name:profile?.display_name||session.user.email?.split('@')[0]||'Member'
    }),'Joined. Your future completed workouts for this program will appear in the private group.')
    if(id){setCode('');setForm('')}
  }
  const toggleSharing=async()=>{
    if(!selected||!me)return
    await execute(()=>supabase.rpc('set_program_group_sharing',{
      target_group:selected.id,enabled:!me.share_workouts
    }),me.share_workouts?'Sharing stopped. Your previously shared group results were removed.':'Sharing enabled for future completed workouts.',selected.id)
    await loadRecaps()
  }
  const leave=async()=>{
    if(!selected||!window.confirm('Leave this group and remove your shared results?'))return
    await execute(()=>supabase.rpc('leave_program_group',{target_group:selected.id}),
      'You left the group.')
  }
  const deleteGroup=async()=>{
    if(!selected||!window.confirm('Delete this group and its shared recaps for everyone?'))return
    await execute(()=>supabase.rpc('delete_program_group',{target_group:selected.id}),
      'Group deleted.')
  }
  const shareCode=async()=>{
    if(!selected)return
    const invitation='Join '+selected.name+' ('+selected.program_name+') in WorkSet Together → Community. Group code: '+selected.join_code
    try{
      if(navigator.share)await navigator.share({title:selected.name,text:invitation})
      else if(navigator.clipboard){await navigator.clipboard.writeText(invitation);setMessage('Invitation copied.')}
      else setMessage(invitation)
    }catch(e){if(e?.name!=='AbortError')setMessage(invitation)}
  }

  const totals=postId=>results.filter(row=>row.post_id===postId)
  const sharingCount=members.filter(row=>row.share_workouts).length
  return <section className="simple-card program-groups">
    <div className="section-heading">
      <div><span className="card-label">TRAIN THE SAME PROGRAM</span><h3>Program groups</h3></div>
    </div>
    <p className="helper-text">Join a private 12-week challenge or create your own. Everyone can train on their own schedule. A workout recap appears after the first finisher and updates as others finish.</p>
    <p className="helper-text">Group sharing is visible only to group members. Your separate Together → Community sharing setting still controls posts to the wider WorkSet Community.</p>
    <div className="program-group-actions">
      <button type="button" className="secondary-action" onClick={()=>{setForm(form==='create'?'':'create');setError('')}}>+ Create group</button>
      <button type="button" className="secondary-action" onClick={()=>{setForm(form==='join'?'':'join');setError('')}}>Join by code</button>
    </div>
    {form==='create'&&<div className="program-group-form">
      <label>Group name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="December 5/3/1 Crew"/></label>
      <label>Program<select value={program} onChange={e=>setProgram(e.target.value)}>
        <option value="">Choose a program</option>
        {options.map(option=><option key={option} value={option}>{option}</option>)}
      </select></label>
      {!options.length&&<small>First choose or track a program under Plan.</small>}
      <p className="helper-text">Creating the group opts you in to sharing completed workout summaries with members only.</p>
      <button type="button" className="primary-action" onClick={create} disabled={busy||!program||!name.trim()}>Create private group</button>
    </div>}
    {form==='join'&&<div className="program-group-form">
      <label>Group code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))} maxLength={12} placeholder="12-character code"/></label>
      <p className="helper-text">Joining opts you in to sharing future completed summaries for this program with group members. You can turn sharing off at any time.</p>
      <button type="button" className="primary-action" onClick={join} disabled={busy||!code.trim()}>Join private group</button>
    </div>}
    {error&&<p className="status-message" role="alert">{error}</p>}
    {message&&<p className="status-message" role="status">{message}</p>}
    {groups.length>0&&<>
      <label className="program-group-picker">My groups
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
          {groups.map(group=><option key={group.id} value={group.id}>{group.name} · {group.program_name}</option>)}
        </select>
      </label>
      {selected&&<div className="program-group-current">
        <div className="program-group-code"><span>Private invite code</span><strong>{selected.join_code}</strong><button type="button" onClick={shareCode}>Share</button></div>
        <div className="program-group-members">
          <strong>Members ({members.length})</strong>
          <div>{members.map(member=><span key={member.user_id}>{member.display_name}{member.user_id===userId?' (You)':''}{!member.share_workouts?' · Private':''}</span>)}</div>
        </div>
        <div className="program-group-privacy">
          <span><strong>Share my completed workouts</strong><small>{me?.share_workouts?'On · Group members only':'Off · Previous group results removed'}</small></span>
          <button type="button" className="secondary-action" onClick={toggleSharing} disabled={busy||!me}>{me?.share_workouts?'Turn off':'Turn on'}</button>
        </div>
        <div className="program-group-feed-head"><strong>Group workout recaps</strong><button type="button" className="mini-action" disabled={loading} onClick={loadRecaps}>Refresh</button></div>
        {loading&&!posts.length&&<p className="helper-text">Loading group activity…</p>}
        {!loading&&!posts.length&&<p className="helper-text">No completed workouts shared yet. The first member to finish starts a group recap.</p>}
        <div className="program-group-feed">
          {posts.map(post=>{
            const finishers=totals(post.id)
            const complete=sharingCount>0&&finishers.length>=sharingCount
            return <article key={post.id} className="program-group-post">
              <div className="program-group-post-head"><strong>Week {post.week} · {post.title}</strong><small>{complete?'Everyone shared':'Awaiting results'}</small></div>
              <div className="program-group-progress"><span>{finishers.length} of {sharingCount} sharing members shared</span><div><i style={{width:((sharingCount?finishers.length/sharingCount:0)*100)+'%'}}/></div></div>
              <div className="program-group-finishers">{finishers
                .sort((a,b)=>String(a.completed_at).localeCompare(String(b.completed_at)))
                .map(row=><div key={row.user_id}><span>✓ {row.display_name}</span><small>{Number(row.total_volume||0).toLocaleString()} lb volume{Number(row.estimated_1rm)>0?' · e1RM '+Math.round(Number(row.estimated_1rm))+' lb':''} · {new Date(row.completed_at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></div>)}
                {members.filter(member=>member.share_workouts&&!finishers.some(row=>row.user_id===member.user_id))
                  .map(member=><div key={member.user_id}><span>○ {member.display_name}</span><small>No shared result yet</small></div>)}
              </div>
            </article>
          })}
        </div>
        <button type="button" className="danger-lite program-group-leave" onClick={selected.owner_user_id===userId?deleteGroup:leave} disabled={busy}>{selected.owner_user_id===userId?'Delete group':'Leave group'}</button>
      </div>}
    </>}
  </section>
}
