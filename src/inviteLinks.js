// Public invite links only. Never claims a message was sent automatically.
export const validFriendEmail=value=>{
  const email=String(value||'').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254
}

export function friendInviteMailto(email,signupUrl){
  if(!validFriendEmail(email))return ''
  const subject=encodeURIComponent('Join me on WorkSet')
  const body=encodeURIComponent("I'd like to connect and train together on WorkSet. Create your account here:\n\n"+String(signupUrl||'')+"\n\nOnce you're signed up, we can add each other as friends.")
  return 'mailto:'+encodeURIComponent(String(email).trim())+'?subject='+subject+'&body='+body
}
