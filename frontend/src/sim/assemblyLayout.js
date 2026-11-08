import {PARTS} from "./parts";

const ENCLOSABLE = new Set(["payload", "command"]);

// Positions for every part: stack from the bottom up; fairings enclose payload/command parts beneath them.
export function layoutDesign(design) {
  const stack = design.stack.filter(n => !n.mount);
  const items = new Array(stack.length);
  const enclosedBy = {};
  stack.forEach((n, i) => {
    if (!PARTS[n.partId].fairing) return;
    let j = i + 1;
    while (j < stack.length && ENCLOSABLE.has(PARTS[stack[j].partId].category))
      j++;
    enclosedBy[i] = j - 1;
  });
  const bottomOf = {};
  let y = 0;
  for (let i = stack.length - 1; i >= 0; i--) {
    const p = PARTS[stack[i].partId];
    if (p.fairing) {
      const lastEnclosed = enclosedBy[i];
      const baseY = lastEnclosed > i ? bottomOf[lastEnclosed] : y;
      const h = y - baseY + p.height;
      items[i] = {
        uid: stack[i].uid,
        partId: stack[i].partId,
        y: baseY,
        height: h,
      };
      y = baseY + h;
    } else {
      items[i] = {
        uid: stack[i].uid,
        partId: stack[i].partId,
        y,
        height: p.height,
      };
      bottomOf[i] = y;
      y += p.height;
    }
  }
  const byUid = Object.fromEntries(items.map((it) => [it.uid, it]));
  let pending = design.stack.filter(n => n.mount);
  while (pending.length) {
    let progress = false;
    pending = pending.filter(n => {
      const parent = byUid[n.mount.parentUid];
      if (!parent) return true;
      const item = {uid:n.uid, partId:n.partId, height:PARTS[n.partId].height,
        x:(parent.x || 0) + n.mount.x, y:parent.y + n.mount.y, z:(parent.z || 0) + n.mount.z};
      items.push(item); byUid[n.uid] = item; progress = true; return false;
    });
    if (!progress) throw Error('Unconnected or cyclic side assembly');
  }
  const minY = Math.min(0, ...items.map(i => i.y));
  for (const item of items) item.y -= minY;
  y = Math.max(y, ...items.map(i => i.y + i.height));
  const radials = [];
  for (const r of design.radials || []) {
    const parent = byUid[r.parentUid];
    if (!parent) continue;
    const pp = PARTS[parent.partId];
    const bp = PARTS[r.partId];
    const rad = pp.diameter / 2 + bp.diameter / 2 + 0.05;
    for (let k = 0; k < r.symmetry; k++) {
      const a = (k / r.symmetry) * Math.PI * 2 + Math.PI / 2;
      radials.push({
        uid: r.uid,
        partId: r.partId,
        y: Math.max(0, parent.y - 1.5),
        height: bp.height,
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
      });
    }
  }
  return { items, radials, height: y };
}


// Mounts are stage-connected parts, with offsets in metres from the parent's base.
export function validMounts(design, lookup = id => PARTS[id]) {
  const nodes = new Map(design.stack.map(n => [n.uid, n]));
  if (!design.stack.some(n => !n.mount)) return false;
  for (const node of design.stack) {
    if (!node.mount) continue;
    const m = node.mount;
    if (lookup(node.partId)?.decoupler || !m || typeof m !== 'object' || Array.isArray(m) ||
      !['x','y','z'].every(k => Number.isFinite(m[k]) && Math.abs(m[k]) <= 2000) ||
      typeof m.parentUid !== 'string') return false;
    const seen = new Set([node.uid]);
    let current = node;
    while (current.mount) {
      const uid = current.mount.parentUid;
      if (seen.has(uid) || !nodes.has(uid)) return false;
      seen.add(uid); current = nodes.get(uid);
      if(lookup(current.partId)?.fairing)return false;
    }
  }
  return true;
}
