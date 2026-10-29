import { PARTS } from "../sim/parts";
import { newUid } from "../sim/design";

export function addPart(design, partId, selectedUid, mode, symmetry) {
  const part = PARTS[partId];
  const idx = design.stack.findIndex((n) => n.uid === selectedUid);
  if (part.radialOnly) {
    if (idx < 0) return { error: "Select a stack part first — boosters attach radially to it." };
    if (PARTS[design.stack[idx].partId].diameter < 1.8) return { error: "Boosters need a parent at least 1.8 m wide." };
    const uid = newUid();
    return { design: { ...design, radials: [...(design.radials || []), { uid, parentUid: selectedUid, partId, symmetry }], events: null }, uid, radial: true };
  }
  if (mode === "radial") return { error: "Only solid boosters attach radially. Switch to Above/Below." };
  const node = { uid: newUid(), partId };
  const stack = [...design.stack];
  if (idx < 0) mode === "above" ? stack.unshift(node) : stack.push(node);
  else stack.splice(mode === "above" ? idx : idx + 1, 0, node);
  return { design: { ...design, stack, events: null }, uid: node.uid };
}

export function removePart(design, uid) {
  if ((design.radials || []).some((r) => r.uid === uid)) return { ...design, radials: design.radials.filter((r) => r.uid !== uid), events: null };
  return { ...design, stack: design.stack.filter((n) => n.uid !== uid), radials: (design.radials || []).filter((r) => r.parentUid !== uid), events: null };
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
  return { ...design, radials: design.radials.map((r) => (r.uid === uid ? { ...r, symmetry } : r)), events: null };
}

export function findNode(design, uid) {
  return design.stack.find((n) => n.uid === uid) || (design.radials || []).find((r) => r.uid === uid);
}
