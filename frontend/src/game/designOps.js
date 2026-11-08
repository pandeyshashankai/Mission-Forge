import {layoutDesign, validMounts} from "../sim/assemblyLayout";
import { PARTS } from "../sim/parts";
import { newUid } from "../sim/design";

export function addPart(design, partId, selectedUid, mode, symmetry) {
  const part = PARTS[partId];
  const idx = design.stack.findIndex((n) => n.uid === selectedUid);
  if (part.radialOnly) {
    if (idx < 0)
      return {
        error: "Select a stack part first — boosters attach radially to it.",
      };
    if (PARTS[design.stack[idx].partId].diameter < 1.8)
      return { error: "Boosters need a parent at least 1.8 m wide." };
    const uid = newUid();
    return {
      design: {
        ...design,
        radials: [
          ...(design.radials || []),
          { uid, parentUid: selectedUid, partId, symmetry },
        ],
        events: null,
      },
      uid,
      radial: true,
    };
  }
  if (mode === "radial")
    return {
      error: "Only solid boosters attach radially. Switch to Above/Below.",
    };
  if (mode === 'side') {
    const parent = design.stack.find(n => n.uid === selectedUid) || design.stack.find(n => !n.mount);
    if (!parent) return {error:'Add a core part first.'};
    const item = layoutDesign(design).items.find(n => n.uid === parent.uid);
    return placePart(design, partId, parent.uid, {x:(item.x || 0)+(PARTS[parent.partId].diameter+part.diameter)/2+0.1,y:item.y,z:item.z || 0});
  }
  if (idx >= 0 && design.stack[idx].mount) {
    const item = layoutDesign(design).items.find(n => n.uid === selectedUid);
    return placePart(design, partId, selectedUid, {x:item.x || 0,y:mode==='above'?item.y+item.height:item.y-part.height,z:item.z || 0});
  }
  const node = { uid: newUid(), partId };
  const stack = [...design.stack];
  if (idx < 0) mode === "above" ? stack.unshift(node) : stack.push(node);
  else stack.splice(mode === "above" ? idx : idx + 1, 0, node);
  return { design: { ...design, stack, events: null }, uid: node.uid };
}

export function removePart(design, uid) {
  if ((design.radials || []).some((r) => r.uid === uid))
    return {
      ...design,
      radials: design.radials.filter((r) => r.uid !== uid),
      events: null,
    };
  if (design.stack.length === 1 && design.stack[0].uid === uid) return design;
  const removed = new Set([uid]);
  let added = true;
  while (added) { added=false; for(const n of design.stack) if(n.mount && removed.has(n.mount.parentUid) && !removed.has(n.uid)){removed.add(n.uid);added=true;} }
  if (design.stack.filter(n => !removed.has(n.uid) && !n.mount).length === 0) return design;
  return {
    ...design,
    stack: design.stack.filter((n) => !removed.has(n.uid)),
    radials: (design.radials || []).filter((r) => !removed.has(r.parentUid)),
    events: null,
  };
}

export function movePart(design, uid, dir) {
  const i = design.stack.findIndex((n) => n.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= design.stack.length) return design;
  const stack = [...design.stack];
  [stack[i], stack[j]] = [stack[j], stack[i]];
  return { ...design, stack, events: null };
}

export function setSymmetry(design, uid, symmetry) {
  return {
    ...design,
    radials: design.radials.map((r) =>
      r.uid === uid ? { ...r, symmetry } : r,
    ),
    events: null,
  };
}

export function findNode(design, uid) {
  return (
    design.stack.find((n) => n.uid === uid) ||
    (design.radials || []).find((r) => r.uid === uid)
  );
}

export function duplicatePart(design, uid) {
  const original = findNode(design, uid);
  if (!original) return { design, uid };
  const copy = { ...original, uid: newUid(), ...(original.mount ? {mount:{...original.mount,x:original.mount.x+PARTS[original.partId].diameter+.25}} : {}) };
  if (original.parentUid)
    return {
      design: { ...design, radials: [...design.radials, copy], events: null },
      uid: copy.uid,
    };
  const stack = [...design.stack];
  stack.splice(stack.findIndex((n) => n.uid === uid) + 1, 0, copy);
  return { design: { ...design, stack, events: null }, uid: copy.uid };
}

export function placePart(design, partId, parentUid, position, uid = null) {
  const part = PARTS[partId];
  if (!part || part.radialOnly || part.decoupler) return {error:'This part needs a core connection. Drop separators and solid boosters onto the central stack.'};
  const layout = layoutDesign(design);
  const parent = layout.items.find(n => n.uid === parentUid);
  if (!parent) return {error:'Select a parent part first.'};
  if(PARTS[parent.partId].fairing)return {error:'Attach side equipment to a tank or structural body, not a removable fairing.'};
  const snap = v => Math.round(v * 4) / 4;
  const node = {uid:uid || newUid(),partId,mount:{parentUid,
    x:snap(position.x-(parent.x || 0)),y:snap(position.y-parent.y),z:snap((position.z || 0)-(parent.z || 0))}};
  const stack = uid ? design.stack.map(n => n.uid === uid ? node : n) : [...design.stack,node];
  const next = {...design,stack,events:null};
  if (!validMounts(next)) return {error:'Keep a connected core anchor; an attachment cannot be its own parent.'};
  return {design:next,uid:node.uid};
}

export function movePlacedPart(design, uid, position) {
  const node = design.stack.find(n => n.uid === uid);
  if (!node) return {error:'Select a liquid/structural assembly part to move.'};
  const layout = layoutDesign(design);
  const descendants = new Set([uid]);
  let changed = true;
  while(changed){changed=false;for(const n of design.stack)if(n.mount&&descendants.has(n.mount.parentUid)&&!descendants.has(n.uid)){descendants.add(n.uid);changed=true;}}
  const parent = node.mount ? design.stack.find(n => n.uid === node.mount.parentUid) :
    layout.items.filter(n => !descendants.has(n.uid)).sort((a,b)=>Math.hypot((a.x||0)-position.x,a.y-position.y)-Math.hypot((b.x||0)-position.x,b.y-position.y))[0];
  return placePart(design,node.partId,parent?.uid,position,uid);
}

// Infer the attachment from the drop location; no placement-mode choice is needed.
export function dropPart(design, partId, position, symmetry = 2) {
  const part = PARTS[partId];
  if (!part) return {error:'Unknown part'};
  if (!design.stack.length) return addPart(design,partId,null,'below',symmetry);
  const layout = layoutDesign(design);
  const targets = layout.items.filter(n=>!PARTS[n.partId].fairing).flatMap(n => {
    const x=n.x || 0, p=PARTS[n.partId], gap=(p.diameter+part.diameter)/2;
    return [{n,edge:'above',x,y:n.y+n.height},{n,edge:'below',x,y:n.y-part.height},
      {n,edge:'side',x:x+gap,y:n.y},{n,edge:'side',x:x-gap,y:n.y}];
  }).sort((a,b)=>Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y));
  if(!targets.length)return addPart(design,partId,design.stack[0].uid,position.y>layout.height/2?'above':'below',symmetry);
  const target=targets[0],distance=Math.hypot(target.x-position.x,target.y-position.y);
  if(part.radialOnly)return addPart(design,partId,target.n.uid,'below',symmetry);
  const node=design.stack.find(n=>n.uid===target.n.uid);
  if(!node.mount && distance<Math.max(1,part.height*.2) && ['above','below'].includes(target.edge) && Math.abs(position.x-(target.n.x||0))<Math.max(.75,PARTS[node.partId].diameter/2))
    return addPart(design,partId,node.uid,target.edge,symmetry);
  if(part.decoupler)return {error:'Drop a stage separator on the central stack. Side parts separate with their parent stage.'};
  return placePart(design,partId,node.uid,distance<1?{x:target.x,y:target.y,z:target.n.z||0}:position);
}
