import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}

const escapeHtml=(value='')=>String(value)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;")

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const auth=req.headers.get('Authorization')||''
    const url=Deno.env.get('SUPABASE_URL')!
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}})
    const {data:{user}}=await userClient.auth.getUser()
    if(!user)return new Response('Unauthorized',{status:401,headers:corsHeaders})

    const {feedback_id}=await req.json()
    const admin=createClient(url,service)
    const {data:feedback,error}=await admin.from('feedback_submissions').select('*')
      .eq('id',feedback_id).eq('user_id',user.id).single()
    if(error||!feedback)return new Response('Feedback not found',{status:404,headers:corsHeaders})

    const resendKey=Deno.env.get('RESEND_API_KEY')
    const notifyEmail=Deno.env.get('FEEDBACK_NOTIFY_EMAIL')
    const fromEmail=Deno.env.get('FEEDBACK_FROM_EMAIL')||'WorkoutBoard <onboarding@resend.dev>'
    if(!resendKey||!notifyEmail){
      return new Response(JSON.stringify({sent:false,configured:false}),{
        status:200,headers:{...corsHeaders,'Content-Type':'application/json'}
      })
    }

    const subject='WorkoutBoard feedback: '+feedback.category
    const html=`
      <h2>New WorkoutBoard feedback</h2>
      <p><strong>Type:</strong> ${escapeHtml(feedback.category)}</p>
      <p><strong>From:</strong> ${escapeHtml(feedback.display_name||feedback.email||'WorkoutBoard user')}</p>
      <p><strong>Email:</strong> ${escapeHtml(feedback.email||'')}</p>
      <p><strong>Page:</strong> ${escapeHtml(feedback.page||'')}</p>
      <hr>
      <p style="white-space:pre-wrap">${escapeHtml(feedback.message)}</p>
    `

    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':'Bearer '+resendKey,'Content-Type':'application/json'},
      body:JSON.stringify({from:fromEmail,to:[notifyEmail],subject,html}),
    })
    const body=await response.text()
    return new Response(body,{status:response.status,headers:{...corsHeaders,'Content-Type':'application/json'}})
  }catch(error){
    return new Response(JSON.stringify({error:String(error)}),{
      status:500,headers:{...corsHeaders,'Content-Type':'application/json'}
    })
  }
})
