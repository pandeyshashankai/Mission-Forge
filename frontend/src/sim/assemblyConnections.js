import {PARTS} from './parts';
import {editorLayout} from './assemblyLayout';

// Authoring links describe staging, not physical contact. Free-grid craft need
// a separate contact graph so a distant engine cannot burn the core's fuel.
export function assemblyConnections(design){
 const nodes=design.stack,all=new Set(nodes.map(n=>n.uid));
 if(!design.editorLayout&&!nodes.some(n=>n.position))return {connected:all,neighbors:null,loose:[]};
 const poses=editorLayout(design).items,byId=new Map(nodes.map(n=>[n.uid,n]));
 const boxes=poses.map(p=>{const n=byId.get(p.uid),d=PARTS[p.partId],a=(n.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));return {uid:p.uid,x:p.x||0,y:p.y+p.height/2,z:p.z||0,w:(d.diameter*c+p.height*s)/2,h:(p.height*c+d.diameter*s)/2,r:d.diameter/2};});
 const neighbors=new Map(nodes.map(n=>[n.uid,new Set()]));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];
  if(Math.abs(a.x-b.x)<=a.w+b.w+.15&&Math.abs(a.y-b.y)<=a.h+b.h+.15&&Math.abs(a.z-b.z)<=a.r+b.r+.15){neighbors.get(a.uid).add(b.uid);neighbors.get(b.uid).add(a.uid);}
 }
 const anchor=nodes.find(n=>PARTS[n.partId].control)||nodes.find(n=>!n.mount)||nodes[0];
 const connected=contactReachable(neighbors,anchor?.uid,all);
 return {connected,neighbors,loose:nodes.filter(n=>!connected.has(n.uid))};
}
export function contactReachable(neighbors,start,allowed){
 if(!neighbors)return new Set(allowed);
 const reached=new Set(),queue=start&&allowed.has(start)?[start]:[];
 for(let i=0;i<queue.length;i++){const uid=queue[i];if(reached.has(uid))continue;reached.add(uid);for(const next of neighbors.get(uid)||[])if(allowed.has(next)&&!reached.has(next))queue.push(next);}
 return reached;
}

// A launch owns only the component containing the command part. The editor's
// original blueprint is retained by the caller; parked equipment stays on Earth.
export function launchAssembly(blueprint){
 const {connected,loose}=assemblyConnections(blueprint);
 if(!loose.length)return {design:blueprint,leftBehind:null};
 const stack=blueprint.stack.filter(n=>connected.has(n.uid)).map(n=>n.mount&&!connected.has(n.mount.parentUid)?Object.fromEntries(Object.entries(n).filter(([k])=>k!=='mount')):n);
 return {design:{...blueprint,stack,radials:(blueprint.radials||[]).filter(r=>connected.has(r.parentUid)),events:null},leftBehind:{...blueprint,stack:loose.map(n=>Object.fromEntries(Object.entries(n).filter(([k])=>k!=='mount'))),radials:(blueprint.radials||[]).filter(r=>!connected.has(r.parentUid)),events:null}};
}
