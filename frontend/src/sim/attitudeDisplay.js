import {norm,cross,dot,scale,sub} from "./vec";
export function attitudeMarkers(r,v,direction){
  const forward=norm(direction), radial=norm(r), normal=norm(cross(r,v)),prograde=norm(v);
  let right=norm(cross(forward,radial));
  if(dot(right,right)<0.5)right=norm(cross(forward,Math.abs(forward[2])<0.9?[0,0,1]:[0,1,0]));
  const up=norm(cross(right,forward));
  const tangent=norm(sub(prograde,scale(radial,dot(prograde,radial))));
  return {pitch:Math.asin(Math.max(-1,Math.min(1,dot(forward,radial))))*180/Math.PI,
    markers:[['prograde','P',prograde],['retrograde','R',scale(prograde,-1)],['normal','N',normal],['antinormal','−N',scale(normal,-1)],['radialOut','↑',radial],['radialIn','↓',scale(radial,-1)]].map(([id,label,d])=>({id,label,x:dot(d,right),y:dot(d,up),front:dot(d,forward)>=0})),
    tangent};
}
