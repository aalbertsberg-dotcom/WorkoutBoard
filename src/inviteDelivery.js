import {supabase} from './supabase'

// Email delivery is best-effort: no invitation depends on a mail provider.
// The Edge Function validates recipient and caller from the stored invitation.
export async function attemptWorksetInviteEmail(kind,relatedId){
  if(!relatedId)return 'In-app invitation sent.'
  try{
    const {data,error}=await supabase.functions.invoke('workset-invite-email',{
      body:{kind,related_id:relatedId}
    })
    if(error||!data)return 'In-app invitation sent. Email delivery is not configured yet.'
    if(data.status==='sent'||data.status==='already_sent')return 'In-app and email invitations sent.'
    if(data.status==='opted_out')return 'In-app invitation sent. Recipient has disabled invitation emails.'
    return 'In-app invitation sent. Email delivery is not configured yet.'
  }catch{
    return 'In-app invitation sent. Email delivery is not configured yet.'
  }
}
