import dns from 'node:dns/promises'
import net from 'node:net'

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number)
    return p[0] === 10 ||
      p[0] === 127 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      p[0] === 0
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:')
  }
  return true
}

async function validateUrl(raw) {
  const url = new URL(raw)
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Only http/https URLs are supported.')
  if (['localhost','localhost.localdomain'].includes(url.hostname.toLowerCase())) throw new Error('Local URLs are not allowed.')

  const records = await dns.lookup(url.hostname,{all:true})
  if (!records.length || records.some(r => privateIp(r.address))) throw new Error('Private/internal URLs are not allowed.')
  return url
}

function decode(text) {
  return text
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,n) => String.fromCharCode(Number(n)))
}

function extractPage(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = decode((titleMatch?.[1] || '').replace(/\s+/g,' ').trim()).slice(0,300)

  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6|section|article)>/gi,'\n')
    .replace(/<[^>]+>/g,' ')

  const lines = decode(cleaned)
    .split(/\n+/)
    .map(x => x.replace(/\s+/g,' ').trim())
    .filter(Boolean)

  const workoutPattern = /\b(\d+\s*[x×]\s*\d+|\d+\s*sets?|\d+\s*reps?|rpe\s*\d|amrap|emom|deadlift|squat|bench|press|row|pull[- ]?up|dip|curl|lunge|carry|sled|burpee|kettlebell)\b/i
  const detected = []
  for (const line of lines) {
    if (line.length <= 260 && workoutPattern.test(line) && !detected.includes(line)) {
      detected.push(line)
      if (detected.length >= 100) break
    }
  }

  return { title, detected_lines:detected }
}

async function authenticate(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return false
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !apiKey) return false

  const response = await fetch(supabaseUrl + '/auth/v1/user',{
    headers:{
      apikey:apiKey,
      Authorization:authHeader
    }
  })
  return response.ok
}

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'content-type':'application/json'}})
  }

  if (!await authenticate(request.headers.get('authorization'))) {
    return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{'content-type':'application/json'}})
  }

  try {
    const body = await request.json()
    const url = await validateUrl(body?.url)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(),12000)

    const response = await fetch(url,{
      redirect:'follow',
      signal:controller.signal,
      headers:{'user-agent':'WorkoutBoard Program Importer/1.0'}
    })
    clearTimeout(timeout)

    if (!response.ok) throw new Error('Source site returned HTTP ' + response.status)

    const type = response.headers.get('content-type') || ''
    if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('That URL is not a readable web page.')

    const html = (await response.text()).slice(0,1500000)
    const extracted = extractPage(html)

    return new Response(JSON.stringify({
      source_url:url.toString(),
      title:extracted.title,
      detected_lines:extracted.detected_lines,
      note:'Review imported lines before turning them into a runnable plan.'
    }),{status:200,headers:{'content-type':'application/json'}})
  } catch (error) {
    return new Response(JSON.stringify({error:error?.message || 'Import failed'}),{status:400,headers:{'content-type':'application/json'}})
  }
}
