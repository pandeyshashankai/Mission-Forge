import { rotate, angularVelocity } from "./rigidBody";
import { cross } from "../vec";
import { add, sub, scale, len, dot, norm } from "../vec";
import { directionFor } from "../exploration";
export function portPose(sim) {
  const n = sim.navigation();
  const axis = sim.rigidEnabled
    ? rotate(sim.rigid.q, [0, 1, 0])
    : sim.rcsEnabled
      ? directionFor(sim.mode, n.r, n.v, sim.pitch, sim.yaw)
      : sim.heldDirection || norm(n.v);
  return {
    axis,
    position: add(sim.r, scale(axis, 3)),
    velocity: sim.rigidEnabled
      ? add(
          sim.v,
          cross(
            angularVelocity({ ...sim.rigid, mass: sim.dryMass + sim.fuel }),
            scale(axis, 3),
          ),
        )
      : sim.v,
  };
}
export function dockingGeometry(a, b) {
  const p = portPose(a),
    q = portPose(b),
    delta = sub(q.position, p.position),
    axisGap = Math.acos(Math.max(-1, Math.min(1, -dot(p.axis, q.axis))));
  const axial = dot(delta, p.axis),
    lateral = len(sub(delta, scale(p.axis, axial)));
  return {
    gap: len(delta),
    axisDegrees: (axisGap * 180) / Math.PI,
    lateral,
    axial,
    speed: len(sub(p.velocity, q.velocity)),
    ready:
      len(delta) <= 0.5 &&
      axisGap <= (5 * Math.PI) / 180 &&
      lateral <= 0.2 &&
      len(sub(p.velocity, q.velocity)) <= 0.1,
  };
}
