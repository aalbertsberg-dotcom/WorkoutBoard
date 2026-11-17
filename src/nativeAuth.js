// Email confirmation and password recovery should open the hosted WorkSet
// website, not capacitor://localhost in the iOS/Android WebView.
export function emailRedirectUrl({native=false,publicWebUrl='',baseUrl='/',origin=''}={}){
  if(native){
    try{
      const url=new URL(publicWebUrl)
      if(url.protocol==='https:')return url.toString()
    }catch{}
    // Omitting the option lets Supabase use its configured Site URL.
    return undefined
  }
  return new URL(baseUrl||'/',origin).toString()
}
