/** Sequential saving of dependent user values.
 * No optimistic commit: if a save fails, the displayed persisted values stay
 * unchanged. Consecutive patches always build on the last successful save.
 */
export function createQueuedPatchSaver({initial={},persist,onCommit=()=>{}}={}){
  if(typeof persist!=='function')throw new Error('Missing save function')
  let committed={...initial}
  let chain=Promise.resolve()
  const save=patch=>{
    const job=chain.catch(()=>{}).then(async()=>{
      const next={...committed,...patch}
      let result
      try{result=await persist(next)}catch(error){return {error}}
      if(result?.error)return result
      committed=next
      onCommit({...next},result)
      return result??{error:null}
    })
    chain=job
    return job
  }
  const rebase=value=>{committed={...value}}
  const values=()=>({...committed})
  return {save,rebase,values}
}
