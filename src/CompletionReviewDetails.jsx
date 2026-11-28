import {completionCounts} from './completionReview.js'
import {effectiveCardioDurationSeconds,workoutDistancePresentation} from './trackingRules.js'
import {formatOutdoorDuration} from './outdoorTracking'
export default function CompletionReviewDetails({summary,showNotes=true}){
 const workout=summary.workout||{}
 const counts=completionCounts(workout)
 const mobility=workout.mobility
 const cardio=Boolean(workout.quick_cardio)
 const note=workout.note||workout.notes
 return <>
 {mobility?<section className="completion-review-section"><h3>Movements</h3>
   <div className="completion-stats"><div><span>Movements</span><strong>{(mobility.items||[]).filter(x=>x.done).length}/{(mobility.items||[]).length}</strong></div><div><span>Time</span><strong>{formatOutdoorDuration(mobility.duration_seconds||0)}</strong></div></div>
   <div className="completion-review-list">{(mobility.items||[]).map((x,i)=><div key={i}><strong>{x.title}</strong><small>{x.done?'Completed':'Not completed'}</small></div>)}</div>
 </section>:cardio&&!summary.outdoor?<section className="completion-review-section"><h3>Activity summary</h3>
   <div className="completion-stats"><div><span>Time</span><strong>{effectiveCardioDurationSeconds(workout)>0?formatOutdoorDuration(effectiveCardioDurationSeconds(workout)):'—'}</strong></div><div><span>Distance</span><strong>{workoutDistancePresentation(workout).meters>0?workoutDistancePresentation(workout).label:'—'}</strong></div>{workout.metcon?.calories&&<div><span>Recorded calories</span><strong>{workout.metcon.calories}</strong></div>}</div>
 </section>:null}
 {!mobility&&!cardio&&!summary.outdoor&&counts.rows.length>0&&<section className="completion-review-section"><h3>Exercise breakdown</h3>
   {(counts.skipped>0||counts.unfinished>0)&&<p className="completion-review-warning">{counts.skipped} skipped · {counts.unfinished} not completed. These do not count toward completed sets.</p>}
   <div className="completion-review-list">{counts.rows.map((row,i)=><details key={i} className="completion-exercise"><summary>
     <span><strong>{row.name}</strong><small>{row.sets.length||row.skipped||row.unfinished?row.completed+' completed set'+(row.completed===1?'':'s')+(row.skipped?' · '+row.skipped+' skipped':'')+(row.unfinished?' · '+row.unfinished+' unfinished':''):row.logged?'Logged':'Not recorded'}</small></span>
     <span><b>{row.volume>0?Math.round(row.volume).toLocaleString()+' lb':row.result||'—'}</b>{row.best&&<small>Heaviest: {row.best.weight} × {row.best.reps}</small>}</span>
   </summary>{row.allSets?.length>0?<div className="completion-review-sets">{row.allSets.map((s,j)=><div key={j}><span>{s.label}</span><strong>{s.status!=='Completed'?s.status:row.distance?'Completed':(s.weight?s.weight+' lb':'No load recorded')+(s.reps?' × '+s.reps+' reps':'')}</strong></div>)}</div>:<p>{row.result||'No individual set details recorded.'}</p>}</details>)}</div>
 </section>}
 {showNotes&&(note||workout.rpe||workout.energy||workout.bodyweight)&&<section className="completion-review-section"><h3>Session notes</h3>
   <div className="completion-review-list">{workout.rpe&&<div><strong>Workout RPE</strong><small>{workout.rpe}/10</small></div>}{workout.energy&&<div><strong>Energy</strong><small>{workout.energy}/10</small></div>}{workout.bodyweight&&<div><strong>Bodyweight</strong><small>{workout.bodyweight} lb</small></div>}</div>{note&&<p className="completion-review-note">{note}</p>}
 </section>}
 </>
}
