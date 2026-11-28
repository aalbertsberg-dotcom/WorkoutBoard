import {useState} from 'react'
import {supabase} from './supabase'
import {inspectProgramFile,validateReviewedProgram,normalizeReviewedProgram,normalizeProgramAuthor} from './importedPrograms.js'

const SHOW_FIRST=40
const templateText=[
  'Week,Day,Exercise,Sets,Reps,Percent,Basis,Weight,Notes',
  '1,Day 1,Squat,3,5,65,TM,,Warm up first',
  '1,Day 1,Bench Press,3,5,65,TM,,',
  '1,Day 2,Deadlift,3,5,70,TM,,',
  '2,Day 1,Squat,3,5,70,TM,,'
].join('\r\n')
export default function ProgramUpload({session,displayName,onSaved,onClose}){
  const [file,setFile]=useState(null)
  const [title,setTitle]=useState('')
  const [author,setAuthor]=useState(()=>normalizeProgramAuthor(displayName))
  const [defaultBasis,setDefaultBasis]=useState('')
  const [parsed,setParsed]=useState(null)
  const [error,setError]=useState('')
  const [reviewed,setReviewed]=useState(false)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState('')
  const [expanded,setExpanded]=useState({})
  const inspect=async()=>{
    if(!file)return
    setBusy(true);setError('');setParsed(null);setReviewed(false);setStatus('')
    try{
      const result=await inspectProgramFile(file,{
        name:title||file.name.replace(/\.(csv|xlsx)$/i,'').replace(/[_-]+/g,' '),
        defaultBasis
      })
      setTitle(result.name)
      setParsed(result)
      setExpanded({})
    }catch(e){setError(e?.message||'Could not inspect file.')}
    finally{setBusy(false)}
  }
  const renameExercise=(w,d,i,field,value)=>{
    setReviewed(false)
    setParsed(prev=>{
      if(!prev)return prev
      const weeks=prev.weeks.map((week,wi)=>wi!==w?week:{
        ...week,days:week.days.map((day,di)=>di!==d?day:{
          ...day,exercises:day.exercises.map((exercise,ei)=>ei!==i?exercise:
            field==='name'||field==='note'?{...exercise,[field]:value}:
            {...exercise,imported:{...exercise.imported,
              [field]:value===''&&['pct','weight'].includes(field)?null:
                ['sets','pct','weight','tm_offset'].includes(field)?Number(value):value
            }}
          )
        })
      })
      return {...prev,weeks}
    })
  }
  const save=async()=>{
    if(!session?.user?.id||!parsed||busy||!reviewed)return
    const authorName=normalizeProgramAuthor(author)
    if(!authorName){setError('Enter a program author name, not an email address.');return}
    const invalid=validateReviewedProgram({...parsed,name:title})
    if(!parsed.canSave||invalid.length){
      setError(invalid[0]||'Resolve source formula or parsing errors before saving.')
      return
    }
    setBusy(true);setError('');setStatus('Saving reviewed program…')
    try{
      const normalized=normalizeReviewedProgram(parsed)
      const {data,error:dbError}=await supabase.from('program_library')
        .insert({
          owner_user_id:session.user.id,
          name:title.trim(),
          description:'Imported from '+parsed.sourceFile+' · reviewed in WorkSet',
          source_type:'manual',status:'active',visibility:'private',
          weeks_count:normalized.weekCount,
          plan:{schema_version:1,reviewed:true,import_source:'spreadsheet',author_name:authorName,
            source_format:parsed.sourceFormat,source_file:parsed.sourceFile,
            weeks:normalized.weeks,
            import_warnings:parsed.issues.filter(x=>x.level==='warning').map(x=>x.text)}
        }).select('id,name').single()
      if(dbError)throw dbError
      setStatus('Saved. You can now preview, track, schedule or share this program.')
      await onSaved?.(data)
    }catch(e){setError('Could not save program: '+(e?.message||'Unknown error'))}
    finally{setBusy(false)}
  }
  const weekList=parsed?.weeks||[]
  const problems=parsed?.issues||[]
  const canSave=Boolean(parsed?.canSave)&&Boolean(normalizeProgramAuthor(author))&&
    validateReviewedProgram({...parsed,name:title}).length===0
  return <section className="simple-card program-importer" aria-label="Upload a workout program">
    <div className="section-heading"><div><span className="card-label">IMPORT PROGRAM</span><h3>Excel / CSV → Trackable program</h3></div><button type="button" className="secondary-action" onClick={onClose}>Close</button></div>
    <p className="helper-text">Upload an .xlsx or .csv with Week, Day, Exercise, Sets, Reps and optional Percent, Basis (TM/1RM), Weight, and Notes columns. Your original file stays on your device; WorkSet saves only the reviewed workout plan.</p>
    <a className="program-import-template" href={'data:text/csv;charset=utf-8,'+encodeURIComponent(templateText)} download="WorkSet-Program-Template.csv">Get sample CSV template</a>
    <label className="program-upload-file">
      <span>Choose spreadsheet (.xlsx or .csv, 8 MB max)</span>
      <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={e=>{
          const selected=e.target.files?.[0]||null
          setFile(selected);setParsed(null);setError('');setReviewed(false)
          setTitle(selected?selected.name.replace(/\.(xlsx|csv)$/i,'').replace(/[_-]+/g,' '):'')
        }}/>
    </label>
    <div className="builder-two program-upload-fields">
      <label>Program name<input type="text" maxLength="140" value={title} onChange={e=>{setTitle(e.target.value);setReviewed(false)}} placeholder="Program name"/></label>
      <label>Program author<input type="text" maxLength={100} value={author} onChange={e=>{setAuthor(e.target.value);setReviewed(false)}} placeholder="Name to show beneath the program" autoComplete="off"/><small className="helper-text">Defaults to your display name. Change it if someone else wrote the program.</small></label>
      <label>For percentages without a Basis column
        <select value={defaultBasis} onChange={e=>{setDefaultBasis(e.target.value);setParsed(null);setReviewed(false)}}>
          <option value="">Choose after checking the source</option>
          <option value="tm">Training max (85% of 1RM)</option>
          <option value="e1rm">Full 1RM</option>
        </select>
      </label>
    </div>
    <button type="button" className="primary-action" disabled={!file||busy} onClick={inspect}>{busy?'Working…':'Analyze spreadsheet'}</button>
    <p className="helper-text">Complex formulas, macros and linked cycle calculations are not executed. Unsupported rows must be corrected in the source before saving; WorkSet will not guess their weights.</p>
    {error&&<p role="alert" className="status-message">{error}</p>}
    {status&&<p role="status" className="status-message">{status}</p>}
    {parsed&&<>
      <div className="program-import-summary">
        <strong>{parsed.weeksCount} weeks</strong><strong>{parsed.workoutCount} workouts</strong><strong>{parsed.exerciseCount} exercises</strong>
      </div>
      {problems.length>0&&<div className="program-import-issues" aria-label="Import validation results">
        <strong>Review the import results</strong>
        {problems.slice(0,SHOW_FIRST).map((issue,i)=><p key={i} className={issue.level==='error'?'program-import-error':''}>{issue.level==='error'?'Needs correction: ':'Check: '}{issue.text}</p>)}
        {problems.length>SHOW_FIRST&&<p>{problems.length-SHOW_FIRST} additional issues. Fix the source before re-importing.</p>}
      </div>}
      <div className="program-import-review">
        <h4>Review every week and workout</h4>
        <p className="helper-text">You can correct exercise names, sets, reps and loads below. For unrecognized Excel formulas, correct the spreadsheet and analyze it again.</p>
        {weekList.map((week,wi)=><details key={week.week} open={expanded[wi]===true}
          onToggle={e=>setExpanded(p=>({...p,[wi]:e.currentTarget.open}))}>
          <summary>Week {week.week} · {week.days.length} workout{week.days.length===1?'':'s'}</summary>
          {week.days.map((day,di)=><section key={di} className="program-import-day">
            <strong>{day.title}</strong>
            {day.exercises.map((exercise,ei)=><div key={ei} className="program-import-exercise">
              <label>Exercise<input value={exercise.name} maxLength="120" onChange={e=>renameExercise(wi,di,ei,'name',e.target.value)}/></label>
              <div className="program-import-exercise-fields">
                <label>Sets<input type="number" min="1" max="30" value={exercise.imported?.sets??''} onChange={e=>renameExercise(wi,di,ei,'sets',e.target.value)}/></label>
                <label>Reps<input value={exercise.imported?.reps??''} onChange={e=>renameExercise(wi,di,ei,'reps',e.target.value)}/></label>
                <label>%<input type="number" min="1" max="150" step="any" value={exercise.imported?.pct??''} onChange={e=>renameExercise(wi,di,ei,'pct',e.target.value)}/></label>
                <label>Basis<select value={exercise.imported?.basis||''} onChange={e=>renameExercise(wi,di,ei,'basis',e.target.value)}>
                  <option value="">None</option><option value="tm">TM (85%)</option><option value="e1rm">1RM</option>
                </select></label>
                {exercise.imported?.pct!=null&&<label>Saved 1RM used<select value={exercise.imported?.maxLift||''} onChange={e=>renameExercise(wi,di,ei,'maxLift',e.target.value)}>
                  <option value="">Choose reference lift</option>
                  {['Squat','Bench','Deadlift','Press'].map(lift=><option key={lift} value={lift}>{lift}</option>)}
                </select></label>}
                <label>Fixed lb<input type="number" min="0" max="2000" step="any" value={exercise.imported?.weight??''} onChange={e=>renameExercise(wi,di,ei,'weight',e.target.value)}/></label>
                <label>TM +lb<input type="number" min="-250" max="250" value={exercise.imported?.tm_offset??0} onChange={e=>renameExercise(wi,di,ei,'tm_offset',e.target.value)}/></label>
              </div>
              <label>Notes<input value={exercise.note||''} maxLength="500" onChange={e=>renameExercise(wi,di,ei,'note',e.target.value)}/></label>
            </div>)}
          </section>)}
        </details>)}
      </div>
      {!normalizeProgramAuthor(author)&&<p className="helper-text">Enter an author name (not an email address) before saving.</p>}
      {!canSave&&parsed.canSave&&<div className="program-import-issues" role="status">
        {validateReviewedProgram({...parsed,name:title}).slice(0,8).map((item,i)=><p className="program-import-error" key={i}>{item}</p>)}
      </div>}
      {canSave?<label className="program-import-confirm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>
        <span>I reviewed the exercises, training weeks and weight formulas. Save this program privately.</span></label>:
        <p className="program-import-blocked">This import needs corrections before it can become a trackable program.</p>}
      <button type="button" className="primary-action" disabled={!canSave||!reviewed||busy} onClick={save}>
        {busy?'Saving…':'Save to My Programs'}
      </button>
    </>}
  </section>
}
