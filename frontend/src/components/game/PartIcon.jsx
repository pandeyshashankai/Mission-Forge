import {useId} from 'react';
export function PartIcon({part}){
  const id='metal'+useId().replace(/:/g,'');
  const engine=!!part.engine, cone=['fairing','capsule','nose'].some(s=>(part.look||'').includes(s));
  return <svg viewBox="0 0 64 86" className="part-thumbnail" aria-hidden="true">
    <defs><linearGradient id={id}><stop stopColor="#8a9bad"/><stop offset=".25" stopColor="#eef4f8"/><stop offset=".5" stopColor="#fff"/><stop offset=".8" stopColor="#a7b3be"/><stop offset="1" stopColor="#637386"/></linearGradient></defs>
    {engine?<><path d="M23 12H41V32H23Z" fill={`url(#${id})`}/><path d="M25 29H39L49 73Q32 81 15 73Z" fill="#394452" stroke="#c6d2db" strokeWidth="2"/>{[42,50,58,66].map(y=><path key={y} d={`M${25-(y-29)/4} ${y}H${39+(y-29)/4}`} stroke="#9daeb9"/>)}</>:cone?<path d="M10 75Q15 35 32 8Q49 35 54 75Q32 82 10 75Z" fill={`url(#${id})`} stroke="#62768a"/>:part.category==='power'?<><path d="M25 20H39V69H25Z" fill={`url(#${id})`}/><path d="M2 29H23V61H2ZM41 29H62V61H41Z" fill="#27476d" stroke="#91bbde"/>{[10,17,48,55].map(x=><path key={x} d={`M${x} 29V61`} stroke="#6d91b8"/>)}</>:<><rect x="14" y={part.height<1?34:12} width="36" height={part.height<1?18:64} rx="4" fill={`url(#${id})`} stroke="#74889a"/><path d={part.height<1?'M14 39H50M14 47H50':'M14 21H50M14 66H50'} stroke="#53697c" strokeWidth="2"/>{part.control&&<rect x="25" y="30" width="14" height="17" rx="3" fill="#193b56"/>}</>}
  </svg>;
}
