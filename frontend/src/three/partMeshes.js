import * as THREE from "three";
import { PARTS } from "../sim/parts";

const texCache = {};
function panelTexture(key, base, line, bands = 6, stripe) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 512);
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.05)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.04)");
  grad.addColorStop(1, "rgba(0,0,0,0.05)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  g.strokeStyle = line;
  g.lineWidth = 2;
  for (let i = 1; i < bands; i++) {
    g.beginPath();
    g.moveTo(0, (512 * i) / bands);
    g.lineTo(256, (512 * i) / bands);
    g.stroke();
  }
  g.lineWidth = 1;
  for (let x = 0; x < 256; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  if (stripe) {
    g.fillStyle = stripe;
    g.fillRect(0, 20, 256, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache[key] = t;
  return t;
}

const M = {
  white: () => new THREE.MeshStandardMaterial({ map: panelTexture("white", "#e8e9ea", "rgba(60,60,70,0.35)"), roughness: 0.55, metalness: 0.08 }),
  orange: () => new THREE.MeshStandardMaterial({ map: panelTexture("orange", "#c8692e", "rgba(70,30,10,0.35)", 8), roughness: 0.92, metalness: 0 }),
  srb: () => new THREE.MeshStandardMaterial({ map: panelTexture("srb", "#e9e7e1", "rgba(40,40,40,0.5)", 4), roughness: 0.6, metalness: 0.05 }),
  dark: () => new THREE.MeshStandardMaterial({ color: "#26292f", roughness: 0.38, metalness: 0.85 }),
  bell: () => new THREE.MeshStandardMaterial({ color: "#3b3532", roughness: 0.42, metalness: 0.75, side: THREE.DoubleSide }),
  bellVac: () => new THREE.MeshStandardMaterial({ color: "#4a3d33", roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide }),
  gray: () => new THREE.MeshStandardMaterial({ color: "#8d939c", roughness: 0.45, metalness: 0.7 }),
  gold: () => new THREE.MeshStandardMaterial({ color: "#d4a23c", roughness: 0.32, metalness: 1 }),
  black: () => new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.7, metalness: 0.2 }),
  solar: () => new THREE.MeshStandardMaterial({ color: "#1c2f5c", roughness: 0.25, metalness: 0.6 }),
  glass: () => new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 0.1, metalness: 0.9 }),
};

const cyl = (rt, rb, h, mat, seg = 48, y = 0) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), mat);
  m.position.y = y + h / 2;
  return m;
};

function bell(throat, exit, h, mat) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    pts.push(new THREE.Vector2(throat + (exit - throat) * Math.pow(f, 0.6), h * (1 - f)));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat);
}

function ring(r, y, h = 0.12) {
  return cyl(r * 1.012, r * 1.012, h, M.dark(), 48, y);
}

function ogive(radius, cylH, noseH, mat) {
  const pts = [new THREE.Vector2(0.001, 0)];
  pts.push(new THREE.Vector2(radius, 0), new THREE.Vector2(radius, cylH));
  for (let i = 1; i <= 20; i++) {
    const f = i / 20;
    pts.push(new THREE.Vector2(Math.max(0.02, radius * Math.sqrt(1 - f * f)), cylH + noseH * f));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat);
}

export function buildPartMesh(part, height = part.height) {
  const g = new THREE.Group();
  const r = part.diameter / 2;
  const h = height;
  switch (part.look) {
    case "tank_white":
    case "tank_orange": {
      g.add(cyl(r, r, h, part.look === "tank_white" ? M.white() : M.orange()));
      g.add(ring(r, 0), ring(r, h - 0.12));
      if (h > 8) g.add(ring(r, h / 2, 0.08));
      break;
    }
    case "engine":
    case "engine_vac": {
      const vac = part.look === "engine_vac";
      g.add(cyl(r * 0.45, r * 0.5, h * 0.12, M.dark(), 32, h * 0.88));
      g.add(cyl(r * 0.16, r * 0.2, h * 0.16, M.gray(), 24, h * 0.72));
      const b = bell(r * 0.15, vac ? r * 0.95 : r * 0.6, h * 0.72, vac ? M.bellVac() : M.bell());
      g.add(b);
      break;
    }
    case "cluster": {
      g.add(cyl(r, r, h * 0.2, M.dark(), 48, h * 0.8));
      const bh = h * 0.8;
      const add = (x, z) => {
        const b = bell(r * 0.05, r * 0.15, bh, M.bell());
        b.position.set(x, 0, z);
        g.add(b);
      };
      add(0, 0);
      for (let i = 0; i < 8; i++) add(Math.cos((i / 8) * Math.PI * 2) * r * 0.66, Math.sin((i / 8) * Math.PI * 2) * r * 0.66);
      break;
    }
    case "capsule": {
      g.add(cyl(r * 0.98, r * 0.98, 0.18, M.black(), 48, 0));
      g.add(cyl(r * 0.32, r * 0.95, h * 0.78, M.gray(), 48, 0.18));
      g.add(cyl(r * 0.22, r * 0.25, h * 0.18, M.dark(), 32, 0.18 + h * 0.78));
      for (let i = 0; i < 2; i++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(r * 0.25, r * 0.22, 0.05), M.glass());
        const a = (i - 0.5) * 0.7;
        w.position.set(Math.sin(a) * r * 0.62, h * 0.5, Math.cos(a) * r * 0.62);
        w.rotation.y = a;
        w.rotation.x = -0.45;
        g.add(w);
      }
      break;
    }
    case "probe": {
      g.add(cyl(r * 0.92, r * 0.92, h, M.gold(), 8));
      g.add(ring(r * 0.92, h - 0.08, 0.08));
      const ant = cyl(0.03, 0.03, 0.8, M.gray(), 8, h);
      ant.position.x = r * 0.4;
      g.add(ant);
      break;
    }
    case "satellite": {
      g.add(cyl(r * 0.45, r * 0.5, 0.25, M.dark(), 32, 0));
      const bus = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, h - 0.25, r * 1.1), M.gold());
      bus.position.y = 0.25 + (h - 0.25) / 2;
      g.add(bus);
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.8, r * 0.9), M.solar());
        p.position.set(s * r * 0.6, 0.25 + (h - 0.25) / 2, 0);
        g.add(p);
      }
      const dish = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 24, 8, 0, Math.PI * 2, 0, 1.1), M.white());
      dish.position.y = h + 0.05;
      dish.rotation.x = Math.PI;
      g.add(dish);
      break;
    }
    case "decoupler":
      g.add(cyl(r, r, h, M.dark()));
      g.add(cyl(r * 1.01, r * 1.01, h * 0.25, M.gray(), 48, h * 0.38));
      break;
    case "adapter":
      g.add(cyl(part.diameterTop / 2, r, h, M.white()));
      g.add(ring(r, 0, 0.1));
      break;
    case "fairing": {
      const nose = Math.min(part.height, h);
      g.add(ogive(r, Math.max(0, h - nose), nose, M.white()));
      g.add(ring(r, 0, 0.15));
      break;
    }
    case "srb": {
      g.add(cyl(r, r, h * 0.84, M.srb(), 32, h * 0.04));
      for (let i = 1; i < 4; i++) g.add(ring(r, h * 0.04 + (h * 0.84 * i) / 4, 0.1));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.12, 32), M.srb());
      cone.position.y = h * 0.88 + h * 0.06;
      g.add(cone);
      g.add(bell(r * 0.3, r * 0.75, h * 0.05, M.bell()));
      break;
    }
    default:
      g.add(cyl(r, r, h, M.gray()));
  }
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

const ENCLOSABLE = new Set(["payload", "command"]);

// Positions for every part: stack from the bottom up; fairings enclose payload/command parts beneath them.
export function layoutDesign(design) {
  const stack = design.stack;
  const items = new Array(stack.length);
  const enclosedBy = {};
  stack.forEach((n, i) => {
    if (!PARTS[n.partId].fairing) return;
    let j = i + 1;
    while (j < stack.length && ENCLOSABLE.has(PARTS[stack[j].partId].category)) j++;
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
      items[i] = { uid: stack[i].uid, partId: stack[i].partId, y: baseY, height: h };
      y = baseY + h;
    } else {
      items[i] = { uid: stack[i].uid, partId: stack[i].partId, y, height: p.height };
      bottomOf[i] = y;
      y += p.height;
    }
  }
  const byUid = Object.fromEntries(items.map((it) => [it.uid, it]));
  const radials = [];
  for (const r of design.radials || []) {
    const parent = byUid[r.parentUid];
    if (!parent) continue;
    const pp = PARTS[parent.partId];
    const bp = PARTS[r.partId];
    const rad = pp.diameter / 2 + bp.diameter / 2 + 0.05;
    for (let k = 0; k < r.symmetry; k++) {
      const a = (k / r.symmetry) * Math.PI * 2 + Math.PI / 2;
      radials.push({ uid: r.uid, partId: r.partId, y: Math.max(0, parent.y - 1.5), height: bp.height, x: Math.cos(a) * rad, z: Math.sin(a) * rad });
    }
  }
  return { items, radials, height: y };
}

export function buildRocket(design, { xray = false } = {}) {
  const root = new THREE.Group();
  const lay = layoutDesign(design);
  for (const it of lay.items) {
    const p = PARTS[it.partId];
    const m = buildPartMesh(p, it.height);
    m.position.y = it.y;
    m.userData.uid = it.uid;
    m.traverse((o) => {
      o.userData.uid = it.uid;
      if (p.fairing && xray && o.isMesh) {
        o.material.transparent = true;
        o.material.opacity = 0.22;
        o.material.depthWrite = false;
      }
    });
    root.add(m);
  }
  for (const it of lay.radials) {
    const m = buildPartMesh(PARTS[it.partId], it.height);
    m.position.set(it.x, it.y, it.z);
    m.traverse((o) => (o.userData.uid = it.uid));
    root.add(m);
  }
  root.userData.height = lay.height;
  return root;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.isMesh || o.isLine || o.isPoints) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  });
}

export function setHighlight(root, uid) {
  root.traverse((o) => {
    if (o.isMesh && o.material.emissive) {
      o.material.emissive.set(o.userData.uid === uid ? "#0e7490" : "#000000");
      o.material.emissiveIntensity = o.userData.uid === uid ? 0.9 : 0;
    }
  });
}
