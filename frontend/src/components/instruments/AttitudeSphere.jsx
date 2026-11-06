import { attitudeMarkers } from "../../sim/attitudeDisplay";
export function AttitudeSphere({nav,onMode}){
 const display=attitudeMarkers(nav.r,nav.v,nav.direction);
 return <details className="engineering-inspector" data-testid="attitude-sphere"><summary>Attitude sphere · flight directions</summary>
  <svg viewBox="0 0 200 200" role="img" aria-label={`Flight direction sphere. Pitch ${display.pitch.toFixed(1)} degrees above local horizon.`} className="attitude-sphere">
   <defs><clipPath id="attitude-disc"><circle cx="100" cy="100" r="88"/></clipPath></defs>
   <circle cx="100" cy="100" r="88" fill="#14283f" stroke="#7195ba" strokeWidth="2"/>
   <g clipPath="url(#attitude-disc)"><path d="M12 100H188M100 12V188" stroke="#6685a2" strokeDasharray="3 5"/><circle cx="100" cy="100" r="44" fill="none" stroke="#375575"/>
   {display.markers.map(m=><g key={m.id} transform={`translate(${100+m.x*76},${100-m.y*76})`} opacity={m.front?1:0.42}><circle r="12" fill="#07131f" stroke={m.id.startsWith('radial')?'#c4b5fd':'#67e8f9'} strokeDasharray={m.front?undefined:'2 2'}/><text textAnchor="middle" y="4" fill="#fff" fontSize="10">{m.label}</text></g>)}</g>
   <path d="M81 100H94L100 106L106 100H119" fill="none" stroke="#fbbf24" strokeWidth="3"/>
  </svg><p>Centre = thrust direction. Bright markers are ahead; dim dashed markers are behind. Pitch {display.pitch.toFixed(1)}° above the local horizon. P prograde · R retrograde · N orbit normal · arrows radial.</p>
  <div className="attitude-actions">{[['prograde','Prograde'],['retrograde','Retrograde'],['normal','Normal'],['antinormal','Anti-normal'],['radialOut','Radial out'],['radialIn','Radial in']].map(([id,label])=><button className="ui-button" key={id} onClick={()=>onMode(id)}>{label}</button>)}</div>
 </details>;
}
