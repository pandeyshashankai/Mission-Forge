import {useEffect, useRef, useState} from 'react';
import {PARTS} from '../../sim/parts';
import {layoutDesign} from '../../sim/assemblyLayout';

export function Blueprint({design, selectedUid, onSelect, onPlace, onMove, heldPart}) {
  const mount = useRef(null), svg = useRef(null), pointers = useRef(new Map()), gesture = useRef(null);
  const [size,setSize] = useState({width:300,height:500});
  const [camera,setCamera] = useState(null), [preview,setPreview] = useState(null);
  const layout = layoutDesign(design);
  const all = [...layout.items, ...layout.radials];
  const fit = () => {
    const left=Math.min(-4,...all.map(n=>(n.x||0)-PARTS[n.partId].diameter/2));
    const right=Math.max(4,...all.map(n=>(n.x||0)+PARTS[n.partId].diameter/2));
    const low=Math.min(0,...all.map(n=>n.y)), high=Math.max(8,...all.map(n=>n.y+n.height));
    return {x:(left+right)/2,y:-(low+high)/2,zoom:Math.max(.1,Math.min(size.width/(right-left+4),size.height/(high-low+6))*.85)};
  };
  const view=camera || fit();
  const point=e=>{const p=svg.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.current.getScreenCTM().inverse());};
  const zoom=f=>setCamera(v=>({...view,...v,zoom:Math.max(.1,Math.min(200,(v||view).zoom*f))}));
  useEffect(()=>{const ro=new ResizeObserver(([e])=>setSize({width:e.contentRect.width,height:e.contentRect.height}));ro.observe(mount.current);return()=>ro.disconnect();},[]);
  useEffect(()=>{const el=mount.current;const wheel=e=>{e.preventDefault();if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.003));else setCamera(v=>({...view,...v,x:(v||view).x+e.deltaX/view.zoom,y:(v||view).y+e.deltaY/view.zoom}));};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);});
  const finish=e=>{
    const g=gesture.current; pointers.current.delete(e.pointerId);
    const bounds=svg.current.getBoundingClientRect(),inside=e.clientX>=bounds.left&&e.clientX<=bounds.right&&e.clientY>=bounds.top&&e.clientY<=bounds.bottom;
    if(g && !g.multi && inside && e.type==='pointerup') {
      const p=point(e), moved=Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>5;
      if(heldPart)onPlace?.({x:p.x,y:-p.y});
      else if(g.uid && moved)onMove?.(g.uid,{x:g.baseX+(e.clientX-g.startX)/view.zoom,y:g.baseY-(e.clientY-g.startY)/view.zoom});
      else if(g.uid)onSelect(g.uid);
    }
    if(!pointers.current.size)gesture.current=null;
    setPreview(null);
  };
  return <div ref={mount} className="blueprint-canvas absolute inset-0" data-testid="blueprint-workspace">
    <div className="assembly-navigation" aria-label="Assembly view controls">
      <button type="button" data-testid="assembly-zoom-out" aria-label="Zoom out" onClick={()=>zoom(1/1.25)}>−</button>
      <button type="button" data-testid="assembly-fit" onClick={()=>{setCamera(null);setPreview(null);}}>Fit</button>
      <button type="button" data-testid="assembly-zoom-in" aria-label="Zoom in" onClick={()=>zoom(1.25)}>+</button>
      <span>Drag parts to move · drag grid / scroll to pan · pinch to zoom</span>
    </div>
    <svg ref={svg} data-testid="assembly-placement-grid" aria-label="Rocket assembly placement grid" className="h-full w-full" style={{touchAction:'none'}}
      viewBox={`${view.x-size.width/(2*view.zoom)} ${view.y-size.height/(2*view.zoom)} ${size.width/view.zoom} ${size.height/view.zoom}`}
      onPointerDown={e=>{
        if(e.button>0)return;
        svg.current.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const uid=e.target.closest('[data-assembly-uid]')?.dataset.assemblyUid, n=all.find(n=>n.uid===uid);
        if(pointers.current.size>1){if(gesture.current)gesture.current.multi=true;return;}
        gesture.current={uid:n?.uid,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,baseX:n?.x||0,baseY:n?.y||0,multi:false};
      }}
      onPointerMove={e=>{
        if(!pointers.current.has(e.pointerId))return;
        const before=[...pointers.current.values()];pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const after=[...pointers.current.values()],g=gesture.current;
        if(after.length===2){const distance=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);zoom(distance(after)/Math.max(1,distance(before)));if(g)g.multi=true;return;}
        if(!g||g.multi)return;
        if(g.uid&&!heldPart)setPreview({uid:g.uid,x:(e.clientX-g.startX)/view.zoom,y:(e.clientY-g.startY)/view.zoom});
        else if(!heldPart){const dx=e.clientX-g.lastX,dy=e.clientY-g.lastY;setCamera(v=>({...view,...v,x:(v||view).x-dx/view.zoom,y:(v||view).y-dy/view.zoom}));}
        g.lastX=e.clientX;g.lastY=e.clientY;
      }} onPointerUp={finish} onPointerCancel={finish}>
      <defs><pattern id="assembly-grid" width={view.zoom<3?10:1} height={view.zoom<3?10:1} patternUnits="userSpaceOnUse"><path d={view.zoom<3?"M10 0H0V10":"M1 0H0V1"} stroke="#7598b0" strokeWidth=".025" fill="none" opacity=".45"/></pattern><linearGradient id="assembly-metal"><stop stopColor="#8198aa"/><stop offset=".35" stopColor="#eef5f8"/><stop offset=".6" stopColor="#fff"/><stop offset="1" stopColor="#688398"/></linearGradient></defs>
      <rect x={view.x-size.width/view.zoom} y={view.y-size.height/view.zoom} width={2*size.width/view.zoom} height={2*size.height/view.zoom} fill="url(#assembly-grid)"/>
      {all.map((n,i)=>{
        const p=PARTS[n.partId],w=Math.max(.25,p.diameter),h=Math.max(.2,n.height),x=(n.x||0)-w/2,y=-n.y-h;
        let carried=preview?.uid===n.uid, ancestor=design.stack.find(v=>v.uid===n.uid);
        for(let k=0;preview&&ancestor?.mount&&k<512;k++){if(ancestor.mount.parentUid===preview.uid){carried=true;break;}const parentUid=ancestor.mount.parentUid;ancestor=design.stack.find(v=>v.uid===parentUid);}
        const cone=['fairing','capsule','nose'].some(k=>(p.look||'').includes(k));
        return <g key={`${n.uid}-${i}`} role="button" tabIndex="0" aria-label={`Select ${p.name}`} data-assembly-uid={n.uid} data-testid={`${i<layout.items.length?'blueprint-part':'blueprint-radial'}-${n.uid}`} transform={carried?`translate(${preview.x} ${preview.y})`:undefined}
          onClick={e=>{if(e.detail===0)onSelect(n.uid);}}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.uid);}}} style={{cursor:'grab'}}>
          {cone?<path d={`M${x} ${y+h}Q${x+w*.05} ${y+h*.35} ${x+w/2} ${y}Q${x+w*.95} ${y+h*.35} ${x+w} ${y+h}Z`} fill="url(#assembly-metal)" stroke="#173047" strokeWidth=".07"/>:<rect x={x} y={y} width={w} height={h} rx=".12" fill="url(#assembly-metal)" stroke="#173047" strokeWidth=".07"/>}
          {p.engine&&<path d={`M${x+w*.3} ${y+h*.2}H${x+w*.7}L${x+w} ${y+h}H${x}Z`} fill="#34414c" stroke="#bca487" strokeWidth=".06"/>}
          {selectedUid===n.uid&&<rect x={x-.12} y={y-.12} width={w+.24} height={h+.24} fill="none" stroke="#5de2ff" strokeWidth=".1" strokeDasharray=".3 .2"/>}
        </g>;
      })}
    </svg>
  </div>;
}
