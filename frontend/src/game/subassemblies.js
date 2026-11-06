import { localData } from "../persistence/localData";
import { buildSections,newUid } from "../sim/design";
import { isValidDesign } from "../sim/storage";
export function captureStage(design,selectedUid,name){
 const section=buildSections(design).find(s=>s.uids.has(selectedUid));
 if(!section)throw Error("Select a stack part in the stage you want to save.");
 if(!name.trim())throw Error("Name this stage first.");
 const uids=section.uids;
 return {version:1,id:newUid(),name:name.trim().slice(0,60),stack:design.stack.filter(n=>uids.has(n.uid)).map(n=>({...n})),radials:(design.radials||[]).filter(n=>uids.has(n.parentUid)).map(n=>({...n}))};
}
export function validSubassembly(s){return s?.version===1&&typeof s.id==='string'&&s.stack?.length<=100&&s.radials?.length<=50&&isValidDesign(s)&&new Set([...s.stack,...s.radials].map(n=>n.uid)).size===s.stack.length+s.radials.length;}
export function appendSubassembly(design,assembly){
 if(!validSubassembly(assembly))throw Error("This saved stage is invalid.");
 const occupied=new Set([...design.stack,...(design.radials||[])].map(n=>n.uid));
 const remap=new Map();
 for(const n of [...assembly.stack,...assembly.radials]){
   let uid;do{uid=newUid();}while(occupied.has(uid));occupied.add(uid);remap.set(n.uid,uid);
 }
 return {...design,events:undefined,
  stack:[...design.stack,...assembly.stack.map(n=>({...n,uid:remap.get(n.uid)}))],
  radials:[...(design.radials||[]),...assembly.radials.map(n=>({...n,uid:remap.get(n.uid),parentUid:remap.get(n.parentUid)}))]};
}
export function readSubassemblies(){try{const list=JSON.parse(localData.getItem('mf.subassemblies')||'[]');return Array.isArray(list)?list.filter(validSubassembly).slice(0,12):[];}catch{return [];}}
