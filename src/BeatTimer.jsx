import {useEffect,useRef,useState} from 'react'
import {beatIntervalMs,beatIsAccent,clampBeatBpm,tappedBpm} from './beatTimer.js'

const readSetting=(key,fallback)=>{
  try{return localStorage.getItem(key)??fallback}catch{return fallback}
}
const saveSetting=(key,value)=>{
  try{localStorage.setItem(key,String(value))}catch{}
}

// Original synthesized click, not prerecorded music. Audio is enabled by a tap.
function scheduleClick(context,time,accent,oscillators){
  const osc=context.createOscillator()
  const gain=context.createGain()
  osc.type='sine'
  osc.frequency.setValueAtTime(accent?950:640,time)
  gain.gain.setValueAtTime(0.0001,time)
  gain.gain.exponentialRampToValueAtTime(accent?0.14:0.095,time+0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001,time+0.075)
  osc.connect(gain)
  gain.connect(context.destination)
  oscillators.add(osc)
  osc.onended=()=>{
    oscillators.delete(osc)
    try{osc.disconnect();gain.disconnect()}catch{}
  }
  osc.start(time)
  osc.stop(time+0.085)
}

export default function BeatTimer({compact=false,onActiveChange,onTempoChange}){
  const [bpm,setBpm]=useState(()=>clampBeatBpm(readSetting('workset-beats-bpm',120)))
  const [draft,setDraft]=useState(()=>String(clampBeatBpm(readSetting('workset-beats-bpm',120))))
  const [playing,setPlaying]=useState(false)
  const [sound,setSound]=useState(()=>readSetting('workset-beats-sound','true')!=='false')
  const [visualBeat,setVisualBeat]=useState(0)
  const [warning,setWarning]=useState('')
  const contextRef=useRef(null)
  const oscillatorsRef=useRef(new Set())
  const tapTimesRef=useRef([])

  useEffect(()=>{onActiveChange?.(playing)},[playing,onActiveChange])
  useEffect(()=>{onTempoChange?.(bpm)},[bpm,onTempoChange])

  const commitTempo=value=>{
    const next=clampBeatBpm(value,bpm)
    setBpm(next)
    setDraft(String(next))
    saveSetting('workset-beats-bpm',next)
  }
  const prepareAudio=()=>{
    try{
      const Audio=window.AudioContext||window.webkitAudioContext
      if(!Audio){setWarning('Audio unavailable in this browser · visual beat only');return}
      if(!contextRef.current||contextRef.current.state==='closed')contextRef.current=new Audio()
      // Called synchronously from Start/Audio tap so mobile browsers allow sound.
      void contextRef.current.resume?.().catch(()=>setWarning('Tap Start again to enable audio'))
      setWarning('')
    }catch{
      setWarning('Audio unavailable · visual beat only')
    }
  }
  const tapTempo=()=>{
    const now=performance.now()
    const last=tapTimesRef.current.at(-1)
    tapTimesRef.current=last!=null&&now-last<=1500?[...tapTimesRef.current.slice(-4),now]:[now]
    const value=tappedBpm(tapTimesRef.current)
    if(value!=null)commitTempo(value)
  }
  const stop=()=>{setPlaying(false);setVisualBeat(0)}
  const start=()=>{
    commitTempo(draft)
    if(sound)prepareAudio()
    setVisualBeat(0)
    setPlaying(true)
  }

  useEffect(()=>{
    if(!playing)return
    let nextTime=performance.now()+50
    let count=0
    const activeOscillators=oscillatorsRef.current
    const run=()=>{
      const now=performance.now()
      if(nextTime<now-1000)nextTime=now+50 // Browser was suspended; never replay missed beats.
      let scheduled=0
      while(nextTime<=now+85&&scheduled<3){
        count++
        const ctx=contextRef.current
        if(sound&&ctx?.state==='running'){
          try{
            const time=ctx.currentTime+Math.max(0.008,(nextTime-now)/1000)
            scheduleClick(ctx,time,beatIsAccent(count),activeOscillators)
          }catch{}
        }
        setVisualBeat((count-1)%4+1)
        nextTime+=beatIntervalMs(bpm)
        scheduled++
      }
    }
    run()
    const interval=setInterval(run,25)
    return()=>{
      clearInterval(interval)
      for(const osc of [...activeOscillators])try{osc.stop()}catch{}
      activeOscillators.clear()
    }
  },[playing,bpm,sound])

  useEffect(()=>()=>{
    for(const osc of [...oscillatorsRef.current])try{osc.stop()}catch{}
    oscillatorsRef.current.clear()
    void contextRef.current?.close?.().catch(()=>{})
  },[])

  const controls=<div className="beats-body">
    <p className="beats-explainer"><strong>BPM = beats per minute.</strong> At 60 BPM, the timer clicks once per second; at 120 BPM, twice per second. Follow one click per step if using it for walking cadence. This is a pace guide, not a heart-rate reading.</p>
    <div className="beats-hero">
      <div><strong>{bpm}</strong><span>BPM</span></div>
      <div className="beats-pulses" aria-label={playing?'Metronome running':'Metronome stopped'}>
        {[1,2,3,4].map(n=><span key={n} className={playing&&visualBeat===n?'active':''} aria-hidden="true"/>)}
      </div>
    </div>
    <label className="beats-bpm-label" htmlFor={compact?'cardio-beats-bpm':'timer-beats-bpm'}>Tempo (beats per minute)</label>
    <div className="beats-adjust">
      <button type="button" aria-label="Decrease BPM by five" onClick={()=>commitTempo(bpm-5)}>−5</button>
      <input id={compact?'cardio-beats-bpm':'timer-beats-bpm'} type="number" inputMode="numeric"
        min="40" max="220" step="1" value={draft}
        onChange={event=>setDraft(event.target.value)}
        onBlur={()=>commitTempo(draft)} aria-label="Beats per minute"/>
      <button type="button" aria-label="Increase BPM by five" onClick={()=>commitTempo(bpm+5)}>+5</button>
      <button type="button" className="beats-tap" onClick={tapTempo}>Tap BPM</button>
    </div>
    <div className="beats-presets">
      {[60,90,120,150,180].map(value=><button type="button" key={value}
        className={bpm===value?'active':''} onClick={()=>commitTempo(value)}>{value}</button>)}
    </div>
    <div className="beats-actions">
      <button type="button" className="primary-action" onClick={playing?stop:start}>{playing?'Stop beats':'Start beats'}</button>
      <label><input type="checkbox" checked={sound} onChange={event=>{
        setSound(event.target.checked)
        saveSetting('workset-beats-sound',event.target.checked)
        if(event.target.checked)prepareAudio()
      }}/> Sound</label>
    </div>
    {!sound&&<small role="status">Sound is off. Enable Sound to hear the beats.</small>}
    {warning&&<small role="status">{warning}</small>}
    <p className="helper-text">Each click is one beat; every fourth is accented. Playback while the screen is locked depends on your browser.</p>
  </div>

  if(!compact)return <section className="beats-timer" aria-label="Beats timer">{controls}</section>
  return <details className="beats-timer beats-compact">
    <summary><span>♪ Beat timer <small>{bpm} BPM · {playing?'Playing':'Optional cadence'}</small></span>{playing&&<b>LIVE</b>}</summary>
    {controls}
  </details>
}
