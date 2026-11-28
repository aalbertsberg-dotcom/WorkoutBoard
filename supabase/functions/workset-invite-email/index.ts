import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json",
};
const output=(body:Record<string,unknown>,status=200)=>
  new Response(JSON.stringify(body),{status,headers:cors});
const esc=(str:string)=>str.replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]||c));

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return output({status:"invalid_request"},405);
  const authorization=req.headers.get("authorization")||"";
  const jwt=authorization.replace(/^Bearer\s+/i,"");
  if(!jwt)return output({status:"unauthorized"},401);

  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!service)return output({status:"unconfigured"});
  const publicClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:authError}=await publicClient.auth.getUser(jwt);
  const caller=userData?.user?.id;
  if(authError||!caller)return output({status:"unauthorized"},401);

  let payload:Record<string,unknown>;
  try{payload=await req.json()}catch{return output({status:"invalid_request"},400)}
  const kind=String(payload.kind||"");
  const relatedId=String(payload.related_id||"");
  if(!["friend_request","live_invite","program_invite"].includes(kind)||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(relatedId)){
    return output({status:"invalid_request"},400);
  }

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:notif,error:lookupError}=await admin.from("workset_notifications")
    .select("id,recipient_user_id,actor_user_id,kind,related_id,title,body,created_at,email_sent_at,email_claimed_at")
    .eq("actor_user_id",caller).eq("kind",kind).eq("related_id",relatedId).maybeSingle();
  if(lookupError||!notif)return output({status:"not_found"},404);
  if(notif.email_sent_at)return output({status:"already_sent"});
  if(Date.now()-new Date(notif.created_at).getTime()>15*60*1000)return output({status:"expired"},400);

  const {data:recipientProfile}=await admin.from("profiles")
    .select("workset_email_invites").eq("id",notif.recipient_user_id).maybeSingle();
  if(recipientProfile?.workset_email_invites===false)return output({status:"opted_out"});

  const apiKey=Deno.env.get("RESEND_API_KEY");
  const from=Deno.env.get("WORKSET_EMAIL_FROM");
  const site=Deno.env.get("WORKSET_APP_URL")||"https://aalbertsberg-dotcom.github.io/WorkoutBoard/";
  if(!apiKey||!from)return output({status:"unconfigured"});
  let page:string;
  try{
    const parsed=new URL(site);
    if(parsed.protocol!=="https:")return output({status:"unconfigured"});
    page=parsed.toString();
  }catch{return output({status:"unconfigured"})}

  const claimed=notif.email_claimed_at?
    Date.now()-new Date(notif.email_claimed_at).getTime()<10*60*1000:false;
  if(claimed)return output({status:"already_processing"});
  let update=admin.from("workset_notifications")
    .update({email_claimed_at:new Date().toISOString()})
    .eq("id",notif.id).is("email_sent_at",null);
  update=notif.email_claimed_at?
    update.eq("email_claimed_at",notif.email_claimed_at):
    update.is("email_claimed_at",null);
  const {data:claim,error:claimError}=await update.select("id").maybeSingle();
  if(claimError||!claim)return output({status:"already_processing"});

  try{
    const {data:userInfo,error:userError}=await admin.auth.admin.getUserById(notif.recipient_user_id);
    const email=userInfo?.user?.email;
    if(userError||!email)throw Error("No eligible recipient email");
    const subject="WorkSet: "+notif.title;
    const html='<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;">'+
      '<h2>WorkSet</h2><p>'+esc(notif.body)+'</p>'+
      '<p><a style="display:inline-block;background:#135c4b;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none" href="'+esc(page)+'">Open WorkSet</a></p>'+
      '<p style="color:#667;font-size:12px">Invitation alerts can be disabled in your WorkSet inbox.</p></div>';
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
      body:JSON.stringify({from,to:[email],subject,html})
    });
    if(!response.ok)throw Error("Mail service rejected the message");
    await admin.from("workset_notifications").update({
      email_sent_at:new Date().toISOString(),email_claimed_at:null
    }).eq("id",notif.id);
    return output({status:"sent"});
  }catch{
    await admin.from("workset_notifications").update({email_claimed_at:null}).eq("id",notif.id);
    return output({status:"unavailable"});
  }
});
