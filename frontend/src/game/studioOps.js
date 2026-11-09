import {PARTS} from '../sim/parts';
import {newUid} from '../sim/design';
import {editorLayout,validMounts} from '../sim/assemblyLayout';
import {dropPart,removePart} from './designOps';

export const newBlueprint=()=>({name:'Untitled rocket',stack:[],radials:[],events:null,editorDraft:true,editorLayout:true});
export function freezeLayout(design){
  if(design.editorLayout&&design.stack.every(n=>n.position))return design;
  const byId=new Map(editorLayout(design).items.map(n=>[n.uid,n]));
  return {...design,editorLayout:true,stack:design.stack.map(n=>{const p=byId.get(n.uid);return {...n,position:{x:p.x||0,y:p.y,z:p.z||0}};})};
}
export function snapPosition(design,partId,point,enabled=true){
 if(!enabled)return point;
 const p=PARTS[partId],l=editorLayout(design);
 const targets=l.items.filter(n=>!PARTS[n.partId].fairing).flatMap(n=>[{x:n.x,y:n.y+n.height},{x:n.x,y:n.y-p.height},...[-1,1].flatMap(side=>[n.y,n.y+(n.height-p.height)/2,n.y+n.height-p.height].map(y=>({x:n.x+side*(PARTS[n.partId].diameter+p.diameter)/2,y}))) ]).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y));
 return targets[0]&&Math.hypot(targets[0].x-point.x,targets[0].y-point.y)<Math.max(1.1,Math.min(2.5,p.diameter*.5))?targets[0]:{x:Math.round(point.x*4)/4,y:Math.round(point.y*4)/4};
}
export function paletteAnchor(partId,point){return {...point,y:point.y-PARTS[partId].height/2};}
export function studioDrop(design,partId,point,mirror=false,boosterCount=2,snap=true){
 point=snapPosition(design,partId,point,snap);
  const d=freezeLayout(design);
  if(!d.stack.length){
    if(PARTS[partId].radialOnly)return {error:'Start with a capsule, probe or tank, then add boosters.'};
    return {design:{...d,editorDraft:false,stack:[{uid:newUid(),partId,position:{x:point.x,y:point.y,z:0}}]},uid:null};
  }
  const before=editorLayout(d),physical={x:point.x-before.anchorX,y:point.y-before.minY};
  const result=dropPart(d,partId,physical,boosterCount);
  if(result.error||result.radial)return result;
  const n=result.design.stack.find(n=>n.uid===result.uid);
  // Central drops use the nearest connection; positions of existing parts never shift.
  const pos={x:point.x,y:point.y,z:0};
  let next={...result.design,editorDraft:false,stack:result.design.stack.map(v=>v.uid===n.uid?{...v,position:pos}:v)};
  const axis=before.anchorX;
  if(mirror&&n.mount&&Math.abs(pos.x-axis)>PARTS[partId].diameter*.3){
    const reflected={x:2*axis-pos.x,y:pos.y};
    const q=editorLayout(next),other=dropPart(next,partId,{x:reflected.x-q.anchorX,y:reflected.y-q.minY},boosterCount);
    if(!other.error){const group=newUid();next={...other.design,stack:other.design.stack.map(v=>v.uid===n.uid?{...v,mirrorGroup:group}:v.uid===other.uid?{...v,mirrorGroup:group,flipX:true,position:{...reflected,z:0}}:v)};}
  }
  return {...result,design:next,uid:n.uid};
}
export function expandSelection(design,ids,children=true){
 const set=new Set(ids);
 if(children){let more=true;while(more){more=false;for(const n of design.stack)if(n.mount&&set.has(n.mount.parentUid)&&!set.has(n.uid)){set.add(n.uid);more=true;}}}
 return set;
}
export function moveSelection(design,ids,dx,dy,children=true){
 const d=freezeLayout(design),selected=expandSelection(d,ids,children);
 return {...d,stack:d.stack.map(n=>selected.has(n.uid)?{...n,position:{...n.position,x:n.position.x+dx,y:n.position.y+dy}}:n)};
}
// Translate a whole assembly onto the nearest outside connection, without
// snapping its children against each other or changing their relative spacing.
export function magneticTranslation(design,ids,dx,dy,enabled=true){
 if(!enabled)return {dx,dy};
 const selected=expandSelection(design,ids),items=editorLayout(design).items,nodes=new Map(design.stack.map(n=>[n.uid,n]));
 const bounds=n=>{const p=PARTS[n.partId],sideways=(nodes.get(n.uid)?.rotation||0)%180!==0,w=sideways?n.height:p.diameter,h=sideways?p.diameter:n.height,cx=n.x,cy=n.y+n.height/2;return {left:cx-w/2,right:cx+w/2,bottom:cy-h/2,top:cy+h/2,cx,cy};};
 const fixed=items.filter(n=>!selected.has(n.uid)&&!PARTS[n.partId].fairing);
 let best=null;
 for(const moving of items.filter(n=>selected.has(n.uid))){
  const p=PARTS[moving.partId],m=bounds(moving),radius=Math.max(1.1,Math.min(2.5,p.diameter*.5));
  for(const target of fixed){
   const t=bounds(target),vertical=[{x:t.cx-m.cx,y:t.top-m.bottom},{x:t.cx-m.cx,y:t.bottom-m.top}];
   const sides=[t.right-m.left,t.left-m.right].flatMap(x=>[t.bottom-m.bottom,t.cy-m.cy,t.top-m.top].map(y=>({x,y})));
   for(const point of [...vertical,...sides]){const distance=Math.hypot(point.x-dx,point.y-dy);
    if(distance<radius&&(!best||distance<best.distance))best={dx:point.x,dy:point.y,distance,movingUid:moving.uid,targetUid:target.uid};
   }
  }
 }
 return best||{dx,dy};
}
export function magnetMove(design,ids,dx,dy,enabled=true){
 const snap=magneticTranslation(design,ids,dx,dy,enabled),next=moveSelection(design,ids,snap.dx,snap.dy);
 const moving=next.stack.find(n=>n.uid===snap.movingUid),selected=expandSelection(next,ids);
 if(moving?.mount&&!selected.has(moving.mount.parentUid)&&snap.targetUid){
  const target=next.stack.find(n=>n.uid===snap.targetUid);
  const changed={...next,stack:next.stack.map(n=>n.uid===moving.uid?{...n,mount:{parentUid:target.uid,x:n.position.x-target.position.x,y:n.position.y-target.position.y,z:n.position.z-target.position.z}}:n)};
  if(validMounts(changed))return changed;
 }
 return next;
}
export function copySelection(design,ids){
 const d=freezeLayout(design),set=expandSelection(d,ids),nodes=d.stack.filter(n=>set.has(n.uid));
 if(!nodes.length)return {design:d,ids:[]};
 const remap=new Map(nodes.map(n=>[n.uid,newUid()]));
 const width=Math.max(3,...nodes.map(n=>PARTS[n.partId].diameter));
 const copies=nodes.map(n=>({...n,uid:remap.get(n.uid),mirrorGroup:undefined,position:{...n.position,x:n.position.x+width+1},...(n.mount?{mount:{...n.mount,parentUid:remap.get(n.mount.parentUid)||n.mount.parentUid}}:{})}));
 const radials=(d.radials||[]).filter(r=>set.has(r.parentUid)||set.has(r.uid)).map(r=>({...r,uid:newUid(),parentUid:remap.get(r.parentUid)||r.parentUid}));
 const next={...d,stack:[...d.stack,...copies],radials:[...(d.radials||[]),...radials],events:null};
 return validMounts(next)?{design:next,ids:copies.map(n=>n.uid)}:{design:d,ids:[]};
}
export function deleteSelection(design,ids){let d=design;const selected=expandSelection(d,ids);if(d.stack.every(n=>selected.has(n.uid)))return {...newBlueprint(),name:d.name};for(const id of selected)d=removePart(d,id);return d;}
export function transformSelection(design,ids,kind){
 const d=freezeLayout(design),set=expandSelection(d,ids),nodes=d.stack.filter(n=>set.has(n.uid));if(!nodes.length)return d;
 const x=nodes.reduce((s,n)=>s+n.position.x,0)/nodes.length,y=nodes.reduce((s,n)=>s+n.position.y+PARTS[n.partId].height/2,0)/nodes.length;
 return {...d,stack:d.stack.map(n=>{if(!set.has(n.uid))return n;const h=PARTS[n.partId].height,cx=n.position.x,cy=n.position.y+h/2;let px=cx,py=cy,a=n.rotation||0,flip=!!n.flipX;
  if(kind==='rotate'){px=x+(cy-y);py=y-(cx-x);a-=90;}
  if(kind==='horizontal'){px=2*x-cx;a=-a;flip=!flip;}
  if(kind==='vertical'){py=2*y-cy;a=180-a;flip=!flip;}
  return {...n,rotation:((a%360)+360)%360,flipX:flip,position:{...n.position,x:px,y:py-h/2}};
 })};
}
