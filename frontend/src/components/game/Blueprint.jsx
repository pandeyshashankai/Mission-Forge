import {useEffect,useRef,useState} from 'react';
import {PARTS} from '../../sim/parts';
import {editorLayout} from '../../sim/assemblyLayout';
import {expandSelection,snapPosition,magneticTranslation} from '../../game/studioOps';
import {PartDrawing,MetalGradient} from './PartDrawing';

function bounds(item,design,nodeMap){
 const node=nodeMap?.get(item.uid)||design.stack.find(n=>n.uid===item.uid),p=PARTS[item.partId];
 const sideways=Math.abs(node?.rotation||0)%180===90;
 const halfWidth=(sideways?item.height:p.diameter)/2,halfHeight=(sideways?p.diameter:item.height)/2;
 return {left:(item.x||0)-halfWidth,right:(item.x||0)+halfWidth,low:item.y+item.height/2-halfHeight,high:item.y+item.height/2+halfHeight};
}

export function Blueprint({design,selectedUid,selectedUids=[],onSelect,onSelectMany,onMoveGroup,heldPart,cursor,mirror=false,snap=true,areaMode=false,onAreaDone,viewCommand}){
 const mount=useRef(null),svg=useRef(null),pointers=useRef(new Map()),gesture=useRef(null),frameRef=useRef(null),measured=useRef(false),designRef=useRef(design);
 const [size,setSize]=useState({width:0,height:0}),[frame,setFrame]=useState(null),[drag,setDrag]=useState(null),[box,setBox]=useState(null);
 designRef.current=design;
 const lay=editorLayout(design),all=[...lay.items,...lay.radials],nodes=new Map(design.stack.map(n=>[n.uid,n]));
 const fit=(d=design,s=size)=>{
  const l=editorLayout(d),items=l.items,w=s.width||390,h=s.height||700;
  if(!items.length)return {x:-1,y:8,zoom:Math.min(26,(w-100)/10)};
  const extents=items.map(n=>bounds(n,d));
  const left=Math.min(...extents.map(n=>n.left)),right=Math.max(...extents.map(n=>n.right));
  const low=Math.min(...extents.map(n=>n.low)),high=Math.max(...extents.map(n=>n.high));
  const z=Math.max(.08,Math.min((w-140)/(right-left+3),(h-160)/(high-low+5),40)*.9);
  return {x:(left+right)/2-16/z,y:(low+high)/2-8/z,zoom:z};
 };
 const view=frame||fit(),width=size.width||390,height=size.height||700;
 const put=next=>{frameRef.current=next;setFrame(next);};
 const world=e=>{const p=svg.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.current.getScreenCTM().inverse());return {x:q.x,y:-q.y};};
 const zoom=(factor,screen)=>{
  const v=frameRef.current||view,z=Math.max(.08,Math.min(160,v.zoom*factor));
  if(screen){const r=svg.current.getBoundingClientRect(),px=screen.x-r.left-width/2,py=screen.y-r.top-height/2;put({x:v.x+px/v.zoom-px/z,y:v.y-py/v.zoom+py/z,zoom:z});}
  else put({...v,zoom:z});
 };
 useEffect(()=>{const ro=new ResizeObserver(([e])=>{const s={width:e.contentRect.width,height:e.contentRect.height};setSize(s);if(!measured.current&&s.width&&s.height){measured.current=true;const f=fit(designRef.current,s);frameRef.current=f;setFrame(f);}});ro.observe(mount.current);return()=>ro.disconnect();},[]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!viewCommand)return;if(viewCommand.action==='fit')put(fit());else if(viewCommand.action==='in')zoom(1.25);else if(viewCommand.action==='out')zoom(.8);},[viewCommand]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const el=mount.current;const wheel=e=>{e.preventDefault();const v=frameRef.current||view;if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.003),{x:e.clientX,y:e.clientY});else put({...v,x:v.x+e.deltaX/v.zoom,y:v.y-e.deltaY/v.zoom});};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);});
 const finish=e=>{
  const g=gesture.current;pointers.current.delete(e.pointerId);
  const r=svg.current.getBoundingClientRect(),inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  if(g&&!g.multi&&inside&&e.type==='pointerup'){
   const p=world(e),moved=Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>g.slop;
   if(heldPart){ /* Palette drops are committed by the active drag handler. */ }
   else if(g.area){const a=g.start,b=p;const ids=all.filter(n=>{const r=bounds(n,design);return r.right>=Math.min(a.x,b.x)&&r.left<=Math.max(a.x,b.x)&&r.high>=Math.min(a.y,b.y)&&r.low<=Math.max(a.y,b.y);}).map(n=>n.uid);onSelectMany?.([...new Set(ids)]);}
   else if(g.uid&&moved)onMoveGroup?.(g.ids,(e.clientX-g.startX)/g.zoom,-(e.clientY-g.startY)/g.zoom);
   else if(g.uid)onSelect(g.uid,e.shiftKey);
   else if(!moved)onSelectMany?.([]);
  }
  if(g&&!g.multi&&(e.type==='pointercancel'||!inside))onSelectMany?.(g.previousIds||[]);
  if(g?.area&&(e.type==='pointercancel'||!pointers.current.size))onAreaDone?.();
  if(!pointers.current.size)gesture.current=null;setDrag(null);setBox(null);
 };
 const selected=new Set(selectedUids.length?selectedUids:selectedUid?[selectedUid]:[]);
 let ghost=null;
 if(heldPart&&cursor&&svg.current){const r=svg.current.getBoundingClientRect();if(cursor.x>r.left&&cursor.x<r.right&&cursor.y>r.top&&cursor.y<r.bottom)ghost=snapPosition(design,heldPart,world({clientX:cursor.x,clientY:cursor.y}),snap);}
 return <div ref={mount} className="blueprint-canvas studio-grid absolute inset-0" data-testid="blueprint-workspace" onContextMenu={e=>e.preventDefault()}>
  <svg ref={svg} data-testid="assembly-placement-grid" aria-label="Rocket build grid: drag parts, drag empty space to pan, pinch to zoom" className="h-full w-full" style={{touchAction:'none'}}
   viewBox={`${view.x-width/(2*view.zoom)} ${-view.y-height/(2*view.zoom)} ${width/view.zoom} ${height/view.zoom}`}
   onPointerDown={e=>{if(e.button>0)return;e.preventDefault();document.activeElement?.blur?.();svg.current.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size>1){const g=gesture.current;if(g&&!g.multi){g.multi=true;onSelectMany?.(g.previousIds||[]);if(g.area)onAreaDone?.();setDrag(null);setBox(null);}return;}
    let uid=e.target.closest('[data-assembly-uid]')?.dataset.assemblyUid;
    if(!uid&&e.pointerType==='touch'&&!heldPart&&!areaMode){const p=world(e),near=all.map(n=>{const r=bounds(n,design,nodes);return {uid:n.uid,distance:Math.hypot(Math.max(r.left-p.x,0,p.x-r.right),Math.max(r.low-p.y,0,p.y-r.high))};}).filter(n=>n.distance<=12/view.zoom).sort((a,b)=>a.distance-b.distance);uid=near[0]?.uid;}
    const ids=uid&&selected.has(uid)?[...selected]:uid?[uid]:[];
    if(uid&&!heldPart&&!areaMode&&!e.shiftKey&&!selected.has(uid))onSelect(uid);
    gesture.current={uid,slop:e.pointerType==='touch'?10:5,previousIds:[...selected],ids:[...expandSelection(design,ids)],zoom:view.zoom,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,start:world(e),area:!heldPart&&(areaMode||(e.shiftKey&&!uid)),multi:false};}}
   onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;const before=[...pointers.current.values()];pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=[...pointers.current.values()],g=gesture.current;
    if(after.length===2){const dist=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mid=a=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2});const old=mid(before),next=mid(after);zoom(dist(after)/Math.max(1,dist(before)),next);const v=frameRef.current;put({...v,x:v.x-(next.x-old.x)/v.zoom,y:v.y+(next.y-old.y)/v.zoom});if(g)g.multi=true;return;}
    if(!g||g.multi)return;
    if(g.area)setBox({a:g.start,b:world(e)});
    else if(g.uid&&!heldPart){if(Math.hypot(e.clientX-g.startX,e.clientY-g.startY)<=g.slop){setDrag(null);return;}const d=magneticTranslation(design,g.ids,(e.clientX-g.startX)/g.zoom,-(e.clientY-g.startY)/g.zoom,snap);setDrag({ids:new Set(g.ids),x:d.dx,y:d.dy});}
    else if(!heldPart){const v=frameRef.current||view;put({...v,x:v.x-(e.clientX-g.lastX)/v.zoom,y:v.y+(e.clientY-g.lastY)/v.zoom});}
    g.lastX=e.clientX;g.lastY=e.clientY;
   }} onPointerUp={finish} onPointerCancel={finish}>
   <defs><MetalGradient/><pattern id="studio-grid-fine" width={view.zoom<3?5:1} height={view.zoom<3?5:1} patternUnits="userSpaceOnUse"><path d={view.zoom<3?'M5 0H0V5':'M1 0H0V1'} fill="none" stroke="#86a2c4" strokeWidth=".04" opacity=".4"/></pattern><pattern id="studio-grid-major" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#173f70" strokeWidth=".08" opacity=".65"/></pattern></defs>
   <rect x={view.x-width/view.zoom} y={-view.y-height/view.zoom} width={2*width/view.zoom} height={2*height/view.zoom} fill="url(#studio-grid-fine)"/><rect x={view.x-width/view.zoom} y={-view.y-height/view.zoom} width={2*width/view.zoom} height={2*height/view.zoom} fill="url(#studio-grid-major)" pointerEvents="none"/>
   {all.map((n,i)=>{const p=PARTS[n.partId],node=nodes.get(n.uid)||{},dx=drag?.ids.has(n.uid)?drag.x:0,dy=drag?.ids.has(n.uid)?drag.y:0,w=p.diameter,h=n.height;
    return <g key={`${n.uid}-${i}`} role="button" tabIndex="0" aria-label={`Select ${p.name}`} data-assembly-uid={n.uid} data-testid={`${i<lay.items.length?'blueprint-part':'blueprint-radial'}-${n.uid}`}
     transform={`translate(${(n.x||0)+dx} ${-n.y-dy-h/2}) rotate(${-(node.rotation||0)}) translate(0 ${h/2})`}
     onFocus={e=>{if(e.currentTarget.matches(':focus-visible'))onSelect(n.uid);}}
     onClick={e=>{if(e.detail===0)onSelect(n.uid);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.uid,e.shiftKey);}}} style={{cursor:'grab'}}>
     <rect x={-w/2} y={-h} width={w} height={h} fill="transparent"/>
     <PartDrawing part={p} height={h} deployed={node.deployed} flipX={node.flipX}/>
     {selected.has(n.uid)&&<rect data-testid="part-selection-border" x={-w/2} y={-h} width={w} height={h} fill="none" stroke="#111" strokeWidth="1" vectorEffect="non-scaling-stroke"/>}
    </g>;
   })}
   {ghost&&<g data-testid="assembly-drag-preview" pointerEvents="none" opacity=".65" transform={`translate(${ghost.x} ${-ghost.y})`}><PartDrawing part={PARTS[heldPart]}/><rect x={-PARTS[heldPart].diameter/2} y={-PARTS[heldPart].height} width={PARTS[heldPart].diameter} height={PARTS[heldPart].height} fill="none" stroke="#111" strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>}
   {ghost&&mirror&&Math.abs(ghost.x-lay.anchorX)>1&&<g pointerEvents="none" opacity=".35" transform={`translate(${2*lay.anchorX-ghost.x} ${-ghost.y})`}><PartDrawing part={PARTS[heldPart]} flipX/></g>}
   {box&&<rect x={Math.min(box.a.x,box.b.x)} y={-Math.max(box.a.y,box.b.y)} width={Math.abs(box.a.x-box.b.x)} height={Math.abs(box.a.y-box.b.y)} fill="none" stroke="#111" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
  </svg>
  {!design.stack.length&&<div className="studio-empty" data-testid="empty-build-grid"><strong>Build your rocket</strong><span>Drag a part from the left onto the grid.</span><small>Pinch or scroll to explore the workspace.</small></div>}
 </div>;
}
