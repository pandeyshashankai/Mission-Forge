import { cross, dot, len, sub } from "./vec";
export function coastInvariants(r,v,mu){
  if(![...r,...v,mu].every(Number.isFinite)||len(r)<=0||mu<=0) throw new Error("Invalid orbital state");
  return {energy:dot(v,v)/2-mu/len(r),h:cross(r,v),radius:len(r)};
}
export function invariantDrift(initial,current){
  return {energyRelative:Math.abs(current.energy-initial.energy)/Math.max(1,Math.abs(initial.energy)),
    angularMomentumRelative:len(sub(current.h,initial.h))/Math.max(1,len(initial.h))};
}
export function seededRandom(seed){
  let state=seed>>>0;
  return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
}
