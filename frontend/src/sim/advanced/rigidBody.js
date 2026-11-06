import { add, sub, scale, dot, cross, len, norm } from "../vec";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const identityQuaternion = () => [0, 0, 0, 1];
export function quaternion(q) {
  if (
    !Array.isArray(q) ||
    q.length !== 4 ||
    !q.every(Number.isFinite) ||
    Math.hypot(...q) < 1e-10
  )
    throw Error("Invalid orientation");
  const d = Math.hypot(...q);
  if(!Number.isFinite(d))throw Error("Invalid orientation magnitude");
  return q.map((x) => x / d);
}
export function multiply(a, b) {
  return [
    ...add(
      add(scale(b.slice(0, 3), a[3]), scale(a.slice(0, 3), b[3])),
      cross(a.slice(0, 3), b.slice(0, 3)),
    ),
    a[3] * b[3] - dot(a.slice(0, 3), b.slice(0, 3)),
  ];
}
export function rotate(q, v) {
  const u = q.slice(0, 3);
  return add(v, scale(add(scale(cross(u, v), q[3]), cross(u, cross(u, v))), 2));
}
const inverse = (q) => [-q[0], -q[1], -q[2], q[3]];
export function bodyInertia(m, h) {
  return [
    (m * (h[1] ** 2 + h[2] ** 2)) / 3,
    (m * (h[0] ** 2 + h[2] ** 2)) / 3,
    (m * (h[0] ** 2 + h[1] ** 2)) / 3,
  ];
}
export function rigidState(s = {}) {
  const q = quaternion(s.q || identityQuaternion()),
    L = s.L || [0, 0, 0],
    half = s.half || [1.5, 3, 1.5];
  if (
    ![L, half].every(
      (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite),
    ) ||
    half.some((x) => x < 0.1 || x > 20) ||
    len(L) > 1e10
  )
    throw Error("Invalid rigid body");
  return { q, L: [...L], half: [...half] };
}
export function inverseInertia(b, v) {
  const local = rotate(inverse(b.q), v),
    I = bodyInertia(b.mass, b.half);
  return rotate(
    b.q,
    local.map((x, i) => x / I[i]),
  );
}
export const angularVelocity = (b) => inverseInertia(b, b.L);
function turn(q, w, dt) {
  const a = len(w) * dt;
  if (a < 1e-14) return [...q];
  const axis = scale(w, 1 / len(w));
  return quaternion(
    multiply([...scale(axis, Math.sin(a / 2)), Math.cos(a / 2)], q),
  );
}
export function spin(b, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10)
    throw Error("Invalid rotational interval");
  const steps = Math.max(1, Math.ceil(seconds / 0.01)),
    dt = seconds / steps;
  for (let i = 0; i < steps; i++) {
    const mid = { ...b, q: turn(b.q, angularVelocity(b), dt / 2) };
    b.q = turn(b.q, angularVelocity(mid), dt);
  }
  return b;
}
const basis = (b) =>
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map((v) => rotate(b.q, v));
export function boxContact(a, b) {
  const A = basis(a),
    B = basis(b),
    delta = sub(b.r, a.r),
    axes = [...A, ...B, ...A.flatMap((x) => B.map((y) => cross(x, y)))];
  let depth = Infinity,
    normal = null;
  for (const raw of axes) {
    if (len(raw) < 1e-9) continue;
    const n = norm(raw),
      extent = (body, axes) =>
        axes.reduce((s, v, i) => s + Math.abs(dot(v, n)) * body.half[i], 0),
      overlap = extent(a, A) + extent(b, B) - Math.abs(dot(delta, n));
    if (overlap < 0) return null;
    if (overlap < depth) {
      depth = overlap;
      normal = scale(n, dot(delta, n) >= 0 ? 1 : -1);
    }
  }
  if (!normal) return null;
  // Closest points to the opposing centre, projected onto the separating faces.
  const support = (body, axes, other, n) => {
    const relative = sub(other.r, body.r);
    let p = [...body.r];
    axes.forEach((axis, i) => {
      const projection = dot(n, axis),
        x =
          Math.abs(projection) > 0.999
            ? Math.sign(projection) * body.half[i]
            : clamp(dot(relative, axis) / 2, -body.half[i], body.half[i]);
      p = add(p, scale(axis, x));
    });
    return p;
  };
  return {
    normal,
    depth,
    point: scale(
      add(support(a, A, b, normal), support(b, B, a, scale(normal, -1))),
      0.5,
    ),
  };
}
export const pointVelocity = (b, p) =>
  add(b.v, cross(angularVelocity(b), sub(p, b.r)));
function impulse(b, p, J) {
  b.v = add(b.v, scale(J, 1 / b.mass));
  b.L = add(b.L, cross(sub(p, b.r), J));
}
export function resolveContact(
  a,
  b,
  contact,
  { restitution = 0.1, friction = 0.4 } = {},
) {
  if (
    !Number.isFinite(restitution) ||
    restitution < 0 ||
    restitution > 1 ||
    !Number.isFinite(friction) ||
    friction < 0 ||
    friction > 2
  )
    throw Error("Invalid contact material");
  const n = contact.normal,
    p = contact.point,
    ra = sub(p, a.r),
    rb = sub(p, b.r),
    relative = sub(pointVelocity(b, p), pointVelocity(a, p));
  const denominator = (axis) =>
    1 / a.mass +
    1 / b.mass +
    dot(
      axis,
      add(
        cross(inverseInertia(a, cross(ra, axis)), ra),
        cross(inverseInertia(b, cross(rb, axis)), rb),
      ),
    );
  const closing = dot(relative, n);
  let magnitude = 0;
  if (closing < 0) {
    magnitude = (-(1 + restitution) * closing) / denominator(n);
    const J = scale(n, magnitude);
    impulse(a, p, scale(J, -1));
    impulse(b, p, J);
    const after = sub(pointVelocity(b, p), pointVelocity(a, p)),
      tangent = sub(after, scale(n, dot(after, n)));
    if (len(tangent) > 1e-12) {
      const t = norm(tangent),
        jt = clamp(
          -dot(after, t) / denominator(t),
          -friction * magnitude,
          friction * magnitude,
        );
      impulse(a, p, scale(t, -jt));
      impulse(b, p, scale(t, jt));
    }
  }
  const correction =
    (Math.max(0, contact.depth - 1e-5) * 0.6) / (1 / a.mass + 1 / b.mass);
  a.r = sub(a.r, scale(n, correction / a.mass));
  b.r = add(b.r, scale(n, correction / b.mass));
  return { normalImpulse: magnitude, closingSpeed: Math.max(0, -closing) };
}
export function kineticEnergy(b) {
  return 0.5 * b.mass * dot(b.v, b.v) + 0.5 * dot(b.L, angularVelocity(b));
}
export function alignRigidBody(sim) {
  if (sim.rigidEnabled) return;
  const desired = sim.navigation().direction,
    from = [0, 1, 0],
    cosine = clamp(dot(from, desired), -1, 1);
  const q =
    cosine < -0.999999
      ? [1, 0, 0, 0]
      : quaternion([...cross(from, desired), 1 + cosine]);
  sim.rigid = { ...rigidState(sim.rigid), q };
  sim.rigidEnabled = true;
}
