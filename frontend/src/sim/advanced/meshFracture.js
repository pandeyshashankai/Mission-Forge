import { add, sub, scale, dot, cross, len, norm } from "../vec";
import { rotate, quaternion, multiply } from "./rigidBody";
const EPS = 1e-9,
  validVector = (v) =>
    Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

const zero = () => Array.from({ length: 3 }, () => [0, 0, 0]);
export function boxMesh(half = [1.5, 3, 1.5]) {
  if (!validVector(half) || half.some((x) => x < 0.05 || x > 20))
    throw Error("Hull half extents must be 0.05–20 m.");
  const vertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ].map((v) => v.map((x, i) => x * half[i]));
  return {
    vertices,
    faces: [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ].flatMap((f) => [
      [f[0], f[1], f[2]],
      [f[0], f[2], f[3]],
    ]),
  };
}
export function meshProperties(mesh) {
  let volume = 0,
    first = [0, 0, 0];
  const second = zero();
  for (const f of mesh.faces) {
    const [a, b, c] = f.map((i) => mesh.vertices[i]),
      v = dot(a, cross(b, c)) / 6,
      s = add(add(a, b), c);
    volume += v;
    first = add(first, scale(s, v / 4));
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        second[i][j] +=
          (v * (s[i] * s[j] + a[i] * a[j] + b[i] * b[j] + c[i] * c[j])) / 20;
  }
  if (!(volume > 1e-10))
    throw Error("Mesh must enclose a positive oriented volume.");
  const center = scale(first, 1 / volume),
    cov = second.map((row, i) =>
      row.map((x, j) => x / volume - center[i] * center[j]),
    ),
    trace = cov[0][0] + cov[1][1] + cov[2][2];
  return {
    volume,
    center,
    inertia: cov.map((row, i) => row.map((x, j) => (i === j ? trace : 0) - x)),
  };
}
export function validateMesh(mesh) {
  if (
    !mesh ||
    !Array.isArray(mesh.vertices) ||
    mesh.vertices.length < 4 ||
    mesh.vertices.length > 256 ||
    !Array.isArray(mesh.faces) ||
    mesh.faces.length < 4 ||
    mesh.faces.length > 512 ||
    mesh.vertices.some((v) => !validVector(v) || len(v) > 100) ||
    mesh.faces.some(
      (f) =>
        !Array.isArray(f) ||
        f.length !== 3 ||
        new Set(f).size !== 3 ||
        f.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= mesh.vertices.length,
        ),
    )
  )
    throw Error("Use a bounded closed triangle hull.");
  const edges = new Map();
  for (const f of mesh.faces) {
    const [a, b, c] = f.map((i) => mesh.vertices[i]);
    if (len(cross(sub(b, a), sub(c, a))) < 1e-12)
      throw Error("Degenerate triangle.");
    for (let k = 0; k < 3; k++) {
      const a = f[k],
        b = f[(k + 1) % 3],
        key = Math.min(a, b) + ":" + Math.max(a, b),
        e = edges.get(key) || { count: 0, sign: 0 };
      e.count++;
      e.sign += a < b ? 1 : -1;
      edges.set(key, e);
    }
  }
  if ([...edges.values()].some((e) => e.count !== 2 || e.sign !== 0))
    throw Error("Hull must be closed with consistently oriented edges.");
  const properties = meshProperties(mesh);
  for (const f of mesh.faces) {
    const [a, b, c] = f.map((i) => mesh.vertices[i]),
      n = norm(cross(sub(b, a), sub(c, a)));
    if (mesh.vertices.some((v) => dot(n, sub(v, a)) > 1e-7))
      throw Error("Contact hull must be convex.");
  }
  return properties;
}
function assemble(polygons) {
  const vertices = [],
    faces = [];
  const index = (v) => {
    let i = vertices.findIndex((p) => len(sub(p, v)) < 1e-8);
    if (i < 0) {
      i = vertices.length;
      vertices.push(v);
    }
    return i;
  };
  for (const p of polygons) {
    if (p.length < 3) continue;
    for (let i = 1; i < p.length - 1; i++) {
      if (len(cross(sub(p[i], p[0]), sub(p[i + 1], p[0]))) > 1e-12)
        faces.push([index(p[0]), index(p[i]), index(p[i + 1])]);
    }
  }
  return { vertices, faces };
}
function clipped(mesh, normal, offset) {
  const polygons = [],
    cap = [];
  for (const face of mesh.faces) {
    const source = face.map((i) => mesh.vertices[i]),
      out = [];
    for (let i = 0; i < source.length; i++) {
      const a = source[i],
        b = source[(i + 1) % source.length],
        da = dot(normal, a) - offset,
        db = dot(normal, b) - offset;
      if (da <= EPS) out.push(a);
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const p = add(a, scale(sub(b, a), da / (da - db)));
        out.push(p);
        cap.push(p);
      }
      if (Math.abs(da) <= EPS) cap.push(a);
    }
    const clean = out.filter((v, i) => !i || len(sub(v, out[i - 1])) > 1e-8);
    if (clean.length > 1 && len(sub(clean[0], clean.at(-1))) < 1e-8)
      clean.pop();
    if (clean.length >= 3) polygons.push(clean);
  }
  const unique = cap.filter(
    (v, i) => cap.findIndex((p) => len(sub(p, v)) < 1e-8) === i,
  );
  if (unique.length < 3)
    throw Error("Cut plane must intersect the hull interior.");
  const center = scale(unique.reduce(add, [0, 0, 0]), 1 / unique.length),
    u = norm(cross(normal, Math.abs(normal[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(normal, u);
  unique.sort(
    (a, b) =>
      Math.atan2(dot(sub(a, center), v), dot(sub(a, center), u)) -
      Math.atan2(dot(sub(b, center), v), dot(sub(b, center), u)),
  );
  for (let i = 0; i < unique.length; i++)
    polygons.push([center, unique[i], unique[(i + 1) % unique.length]]);
  return assemble(polygons);
}
export function splitHull(mesh, normal, offset) {
  validateMesh(mesh);
  if (!validVector(normal) || len(normal) < 1e-9 || !Number.isFinite(offset))
    throw Error("Invalid fracture plane.");
  const n = norm(normal),
    d = offset / len(normal),
    pieces = [clipped(mesh, n, d), clipped(mesh, scale(n, -1), -d)];
  pieces.forEach(validateMesh);
  return pieces;
}
const tensorCache = new WeakMap();
function unitInertia(mesh) {
  let value = tensorCache.get(mesh);
  if (!value) {
    value = validateMesh(mesh).inertia;
    tensorCache.set(mesh, value);
  }
  return value;
}
function matVec(m, v) {
  return m.map((r) => dot(r, v));
}
function inverseMatrix(a) {
  const c = [cross(a[1], a[2]), cross(a[2], a[0]), cross(a[0], a[1])],
    det = dot(a[0], c[0]);
  if (Math.abs(det) < 1e-15) throw Error("Degenerate hull inertia.");
  return [0, 1, 2].map((i) => c.map((r) => r[i] / det));
}
export function meshAngularVelocity(body) {
  const invQ = [-body.q[0], -body.q[1], -body.q[2], body.q[3]],
    local = rotate(invQ, body.L);
  return rotate(
    body.q,
    scale(matVec(inverseMatrix(unitInertia(body.mesh)), local), 1 / body.mass),
  );
}
function momentumFromOmega(mesh, mass, q, omega) {
  return rotate(
    q,
    scale(
      matVec(unitInertia(mesh), rotate([-q[0], -q[1], -q[2], q[3]], omega)),
      mass,
    ),
  );
}
export function fractureHull({
  r,
  v,
  mass,
  q = [0, 0, 0, 1],
  L = [0, 0, 0],
  half = [1.5, 3, 1.5],
  count = 8,
  energy = 0,
  hull = null,
}) {
  if (
    !validVector(r) ||
    !validVector(v) ||
    !validVector(L) ||
    !Number.isFinite(mass) ||
    mass <= 0 ||
    mass > 1e9 ||
    ![2, 4, 8].includes(count) ||
    !Number.isFinite(energy) ||
    energy < 0 ||
    energy > mass * 100
  )
    throw Error("Invalid bounded fracture state.");
  q = quaternion(q);
  let original = hull || boxMesh(half);
  const inputProps = validateMesh(original);
  if (hull)
    original = {
      vertices: hull.vertices.map((v) => sub(v, inputProps.center)),
      faces: hull.faces.map((f) => [...f]),
    };
  const parentProps = validateMesh(original);
  let pieces = [original];
  for (let level = 0; 2 ** level < count; level++)
    pieces = pieces.flatMap((mesh, index) => {
      const p = meshProperties(mesh),
        ranges = [0, 1, 2].map(
          (i) =>
            Math.max(...mesh.vertices.map((v) => v[i])) -
            Math.min(...mesh.vertices.map((v) => v[i])),
        ),
        axis = ranges.indexOf(Math.max(...ranges)),
        n = [0, 0, 0];
      n[axis] = 1;
      n[(axis + 1) % 3] = 0.13 * Math.sin(index + level + 1);
      n[(axis + 2) % 3] = 0.1 * Math.cos(index - level);
      return splitHull(mesh, n, dot(n, p.center));
    });
  const omega = meshAngularVelocity({ mesh: original, mass, q, L }),
    fragments = pieces.map((mesh) => {
      const p = validateMesh(mesh),
        center = p.center,
        local = {
          vertices: mesh.vertices.map((v) => sub(v, center)),
          faces: mesh.faces.map((f) => [...f]),
        },
        m = (mass * p.volume) / parentProps.volume,
        offset = rotate(q, center);
      return {
        mesh: local,
        mass: m,
        r: add(r, offset),
        v: add(v, cross(omega, offset)),
        q: [...q],
        L: momentumFromOmega(local, m, q, omega),
        radius: Math.max(...local.vertices.map(len)),
        offset,
      };
    });
  const denominator = fragments.reduce(
      (s, f) => s + f.mass * dot(f.offset, f.offset),
      0,
    ),
    rate = denominator > 0 ? Math.sqrt((2 * energy) / denominator) : 0;
  for (const f of fragments) {
    f.v = add(f.v, scale(f.offset, rate));
    delete f.offset;
  }
  return fragments;
}
export function restoreMeshFragment(f) {
  const mesh = {
    vertices: f.mesh?.vertices?.map((v) => [...v]),
    faces: f.mesh?.faces?.map((v) => [...v]),
  };
  validateMesh(mesh);
  if (
    !validVector(f.r) ||
    !validVector(f.v) ||
    !validVector(f.L) ||
    !Number.isFinite(f.mass) ||
    f.mass <= 0 ||
    f.mass > 1e9 ||
    len(f.L) > 1e12
  )
    throw Error("Invalid mesh fragment state.");
  return {
    mesh,
    mass: f.mass,
    r: [...f.r],
    v: [...f.v],
    q: quaternion(f.q),
    L: [...f.L],
    radius: Math.max(...mesh.vertices.map(len)),
  };
}
export function spinMesh(body, dt) {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.1)
    throw Error("Mesh rotational step must be at most 0.1 s.");
  const count = Math.max(1, Math.ceil(dt / 0.005)),
    h = dt / count;
  const turn = (q, w, seconds) => {
    const a = len(w) * seconds;
    return a
      ? quaternion(
          multiply([...scale(w, Math.sin(a / 2) / len(w)), Math.cos(a / 2)], q),
        )
      : [...q];
  };
  for (let i = 0; i < count; i++) {
    const mid = turn(body.q, meshAngularVelocity(body), h / 2);
    body.q = turn(body.q, meshAngularVelocity({ ...body, q: mid }), h);
  }
}

function inverseInertia(body, v) {
  const q = [-body.q[0], -body.q[1], -body.q[2], body.q[3]];
  return rotate(
    body.q,
    scale(
      matVec(inverseMatrix(unitInertia(body.mesh)), rotate(q, v)),
      1 / body.mass,
    ),
  );
}
const topologyCache = new WeakMap();
function topology(mesh) {
  let cached = topologyCache.get(mesh);
  if (cached) return cached;
  const normals = [],
    edges = [],
    used = new Map();
  const push = (list, v) => {
    const n = norm(v);
    if (!list.some((x) => Math.abs(dot(x, n)) > 1 - 1e-10)) list.push(n);
  };
  for (const f of mesh.faces) {
    const [a, b, c] = f.map((i) => mesh.vertices[i]),
      n = norm(cross(sub(b, a), sub(c, a)));
    push(normals, n);
    for (let i = 0; i < 3; i++) {
      const a = f[i],
        b = f[(i + 1) % 3],
        key = Math.min(a, b) + ":" + Math.max(a, b),
        e = used.get(key) || { a, b, normals: [] };
      e.normals.push(n);
      used.set(key, e);
    }
  }
  for (const e of used.values())
    if (
      e.normals.length === 2 &&
      Math.abs(dot(e.normals[0], e.normals[1])) < 1 - 1e-10
    )
      push(edges, sub(mesh.vertices[e.b], mesh.vertices[e.a]));
  cached = { normals, edges };
  topologyCache.set(mesh, cached);
  return cached;
}
export function convexContact(a, b) {
  if (len(sub(a.r, b.r)) > (a.radius ?? 100) + (b.radius ?? 100)) return null;
  const origin = a.r,
    vertsA = a.mesh.vertices.map((v) => rotate(a.q, v)),
    delta = sub(b.r, origin),
    vertsB = b.mesh.vertices.map((v) => add(delta, rotate(b.q, v)));
  for (let k = 0; k < 3; k++) {
    let amin = Infinity,
      amax = -Infinity,
      bmin = Infinity,
      bmax = -Infinity;
    for (const v of vertsA) {
      amin = Math.min(amin, v[k]);
      amax = Math.max(amax, v[k]);
    }
    for (const v of vertsB) {
      bmin = Math.min(bmin, v[k]);
      bmax = Math.max(bmax, v[k]);
    }
    if (amax < bmin - EPS || bmax < amin - EPS) return null;
  }
  const A = topology(a.mesh),
    B = topology(b.mesh),
    seen = new Set();
  let depth = Infinity,
    normal;
  const testAxis = (raw) => {
    const length = len(raw);
    if (length < 1e-10) return true;
    let axis = scale(raw, 1 / length);
    const first = axis.find((x) => Math.abs(x) > 1e-8);
    if (first < 0) axis = scale(axis, -1);
    const key = axis.map((x) => x.toFixed(8)).join(",");
    if (seen.has(key)) return true;
    seen.add(key);
    let amin = Infinity,
      amax = -Infinity,
      bmin = Infinity,
      bmax = -Infinity;
    for (const v of vertsA) {
      const x = dot(v, axis);
      amin = Math.min(amin, x);
      amax = Math.max(amax, x);
    }
    for (const v of vertsB) {
      const x = dot(v, axis);
      bmin = Math.min(bmin, x);
      bmax = Math.max(bmax, x);
    }
    if (amax < bmin - EPS || bmax < amin - EPS) return false;
    const overlap = Math.min(amax - bmin, bmax - amin);
    if (overlap < depth) {
      depth = overlap;
      normal = dot(axis, delta) >= 0 ? axis : scale(axis, -1);
    }
    return true;
  };
  for (const n of A.normals) if (!testAxis(rotate(a.q, n))) return null;
  for (const n of B.normals) if (!testAxis(rotate(b.q, n))) return null;
  const edgeA = A.edges.map((e) => rotate(a.q, e)),
    edgeB = B.edges.map((e) => rotate(b.q, e));
  for (const x of edgeA)
    for (const y of edgeB) if (!testAxis(cross(x, y))) return null;
  const support = (vs, n) => {
      let maximum = -Infinity,
        points = [];
      for (const v of vs) {
        const d = dot(v, n);
        if (d > maximum + 1e-8) {
          maximum = d;
          points = [v];
        } else if (Math.abs(d - maximum) < 1e-8) points.push(v);
      }
      return scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
    },
    point = add(
      origin,
      scale(
        add(support(vertsA, normal), support(vertsB, scale(normal, -1))),
        0.5,
      ),
    );
  return { normal, depth: Math.max(0, depth), point };
}

export function resolveMeshContact(a, b, c, restitution = 0.1, friction = 0.4) {
  if (!c) return;
  const ra = sub(c.point, a.r),
    rb = sub(c.point, b.r),
    va = add(a.v, cross(meshAngularVelocity(a), ra)),
    vb = add(b.v, cross(meshAngularVelocity(b), rb)),
    relative = sub(vb, va),
    vn = dot(relative, c.normal);
  const denominator = (n) =>
    1 / a.mass +
    1 / b.mass +
    dot(
      n,
      add(
        cross(inverseInertia(a, cross(ra, n)), ra),
        cross(inverseInertia(b, cross(rb, n)), rb),
      ),
    );
  const apply = (impulse) => {
    a.v = sub(a.v, scale(impulse, 1 / a.mass));
    b.v = add(b.v, scale(impulse, 1 / b.mass));
    a.L = sub(a.L, cross(ra, impulse));
    b.L = add(b.L, cross(rb, impulse));
  };
  if (vn < 0) {
    const normalImpulse = (-(1 + restitution) * vn) / denominator(c.normal);
    apply(scale(c.normal, normalImpulse));
    const tangent = sub(relative, scale(c.normal, vn));
    if (len(tangent) > 1e-10) {
      const t = norm(tangent),
        jt = Math.max(
          -friction * normalImpulse,
          Math.min(
            friction * normalImpulse,
            -dot(relative, t) / denominator(t),
          ),
        );
      apply(scale(t, jt));
    }
  }
  const correction =
    (Math.max(0, c.depth - 1e-5) * 0.25) / (1 / a.mass + 1 / b.mass);
  a.r = sub(a.r, scale(c.normal, correction / a.mass));
  b.r = add(b.r, scale(c.normal, correction / b.mass));
}
export function vehicleFragments(sim) {
  return sim.meshFracture
    ? fractureHull({
        r: sim.r,
        v: sim.v,
        mass: sim.dryMass + sim.fuel,
        q: sim.rigid.q,
        L: sim.rigid.L,
        half: sim.rigid.half,
        count: 8,
        energy: (sim.dryMass + sim.fuel) * 2,
      })
    : null;
}
export function resolveDebrisMeshes(entries) {
  const bodies = [];
  for (const e of entries)
    for (const f of e.sim.debris || []) if (f.mesh) bodies.push(f);
  for (const f of bodies)
    for (const e of entries) {
      if (e.sim.status !== "flying") continue;
      const s = e.sim,
        half = s.rigid.half,
        body = {
          r: s.r,
          v: s.v,
          q: s.rigid.q,
          L: s.rigid.L,
          mass: s.dryMass + s.fuel,
          mesh: boxMesh(half),
          radius: len(half),
        };
      if (len(sub(f.r, body.r)) > f.radius + body.radius) continue;
      const contact = convexContact(f, body);
      if (contact) {
        resolveMeshContact(f, body, contact);
        s.r = body.r;
        s.v = body.v;
        s.rigid.q = body.q;
        s.rigid.L = body.L;
        s.record("Convex debris contact: impulse and friction applied");
      }
    }
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i],
        b = bodies[j];
      if (len(sub(a.r, b.r)) > a.radius + b.radius) continue;
      const contact = convexContact(a, b);
      if (contact) resolveMeshContact(a, b, contact);
    }
}
