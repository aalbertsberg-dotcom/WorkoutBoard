/** One compact, accessible status button shared by the cardio timer and GPS tests. */
export default function GpsStatusBadge({status,onClick}){
  if(!status)return null
  return <button type="button"
    className={'quick-cardio-gps-badge gps-tone-'+status.tone}
    data-gps-phase={status.phase}
    aria-label={'GPS status: '+status.label+'. View GPS details'}
    title={status.detail}
    onClick={onClick}>
    <span className="quick-cardio-gps-dot" aria-hidden="true">●</span>
    <span className="quick-cardio-gps-label">{status.label}</span>
    <span className="quick-cardio-gps-chevron" aria-hidden="true">›</span>
  </button>
}
