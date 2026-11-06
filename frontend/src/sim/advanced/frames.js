import { cross, sub, add } from "../vec";
export function rotateZ(v, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
}
export function toBodyFixed(r, v, time, body) {
  const omega = (2 * Math.PI) / body.rotation,
    theta = omega * time;
  return {
    r: rotateZ(r, -theta),
    v: rotateZ(sub(v, cross([0, 0, omega], r)), -theta),
  };
}
export function fromBodyFixed(r, v, time, body) {
  const omega = (2 * Math.PI) / body.rotation,
    position = rotateZ(r, omega * time);
  return {
    r: position,
    v: add(rotateZ(v, omega * time), cross([0, 0, omega], position)),
  };
}
