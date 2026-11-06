import {buildRocket} from './partMeshes';
import * as THREE from "three";

// Original illustrative craft, in metres. Geometry never changes flight parameters.
export function buildExplorer(id = "pathfinder", quality = "medium", design) {
  if(id === 'hangar' && design){const root=buildRocket(design);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.children.forEach(c=>c.position.sub(center));root.name=id;root.userData.design=design;root.userData.length=box.max.y-box.min.y;const plume=new THREE.Group();plume.position.y=-root.userData.length/2;const flame=new THREE.Mesh(new THREE.ConeGeometry(.7,5,12),new THREE.MeshBasicMaterial({color:'#67e8f9',transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));flame.rotation.z=Math.PI;flame.position.y=-2.5;plume.add(flame);plume.visible=false;root.add(plume);root.userData.plume=plume;return root;}

  const root = new THREE.Group();
  root.name = id;
  const segments = quality === "low" ? 12 : 24;
  const ownedMaterials = new Set();
  const material = (color, metalness = 0.4, roughness = 0.4) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    ownedMaterials.add(m); return m;
  };
  root.userData.materials = ownedMaterials;
  const white = material("#e4eaf2", 0.25), metal = material("#727f94", 0.8),
    dark = material("#202b40"), gold = material("#dba756", 0.75),
    blue = material("#153b78", 0.65, 0.23), glass = material("#5ed6ee", 0.65, 0.16);
  const mesh = (geometry, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };
  const cylinder = (top, bottom, height, mat, x, y, z) =>
    mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat, x, y, z);
  const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const strut = (a, b, radius = 0.07) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const m = cylinder(radius, radius, start.distanceTo(end), metal);
    m.position.copy(start).add(end).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  };
  const bell = (x, y, z, size = 1) => {
    const points = Array.from({ length: 12 }, (_, i) => {
      const f = i / 11;
      return new THREE.Vector2(size * (0.2 + 0.7 * f ** 0.65), -size * f * 1.5);
    });
    const m = mesh(new THREE.LatheGeometry(points, segments), dark, x, y, z);
    m.material = dark.clone();
    m.material.side = THREE.DoubleSide;
  };
  const wings = (y, span) => {
    for (const side of [-1, 1]) {
      strut([side, y, 0], [side * (span + 1), y, 0]);
      box(span, 0.12, 3.1, metal, side * (span / 2 + 2), y, 0);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++)
          box(span / 4 - 0.08, 0.15, 0.93, blue,
            side * (2 + (i + 0.5) * span / 4), y + 0.04, (j - 1) * 1.02);
    }
  };
  const dish = (y) => {
    strut([0, y - 0.8, 0], [0, y, 0]);
    const m = mesh(new THREE.SphereGeometry(1.25, segments, 8, 0, Math.PI * 2, 0, 1.0), white, 0, y, 0);
    m.rotation.x = Math.PI;
    strut([0, y - 0.4, 0], [0, y + 0.5, 0], 0.04);
  };
  let nozzleY;
  if (id === "lander") {
    cylinder(1.5, 2.2, 2.4, gold, 0, -0.5, 0);
    cylinder(1.05, 1.5, 1.8, white, 0, 1.6, 0);
    box(1.0, 0.5, 0.08, glass, 0, 1.9, 1.3);
    cylinder(0.55, 0.55, 0.25, metal, 0, 2.65, 0);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a), z = Math.sin(a);
      strut([x * 1.6, 0.3, z * 1.6], [x * 3.8, -3.4, z * 3.8], 0.13);
      strut([x * 1.8, -1.4, z * 1.8], [x * 3.4, -2.8, z * 3.4]);
      cylinder(0.65, 0.7, 0.16, dark, x * 3.8, -3.5, z * 3.8);
    }
    bell(0, -1.7, 0, 0.8);
    nozzleY = -2.9;
  } else if (id === "voyager") {
    cylinder(1.7, 1.7, 8, white, 0, -0.6, 0);
    for (const y of [-4.5, -1, 3.3]) cylinder(1.74, 1.74, 0.18, gold, 0, y, 0);
    for (const side of [-1, 1]) {
      cylinder(0.65, 0.65, 5, metal, side * 2.25, -1, 0);
      mesh(new THREE.SphereGeometry(0.65, segments, 10), metal, side * 2.25, 1.5, 0);
      mesh(new THREE.SphereGeometry(0.65, segments, 10), metal, side * 2.25, -3.5, 0);
      strut([side * 1.5, -2, 0], [side * 2.2, -2, 0], 0.12);
    }
    cylinder(1.1, 1.7, 1.6, gold, 0, 4.2, 0);
    dish(6);
    wings(2.4, 6.5);
    bell(0, -4.6, 0, 1.45);
    nozzleY = -6.775;
  } else {
    cylinder(1.3, 1.3, 4.4, white);
    cylinder(1.34, 1.34, 0.25, gold, 0, -1.8, 0);
    cylinder(0.75, 1.3, 1.8, dark, 0, 3, 0);
    box(0.9, 0.5, 0.1, glass, 0, 2.5, 1.05);
    dish(4.8);
    wings(0.5, 5);
    bell(0, -2.2, 0);
    nozzleY = -3.7;
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    box(0.3, 0.35, 0.3, dark, Math.cos(a) * 1.55, 0.7, Math.sin(a) * 1.55);
  }
  const plume = new THREE.Group();
  plume.position.y = nozzleY;
  for (const [radius, height, color, opacity] of [[0.7, 8, "#46a9ff", 0.25], [0.35, 5, "#dbf6ff", 0.85]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false,
        blending: THREE.AdditiveBlending }));
    // The wide end begins at the bell; the narrow tip points aft.
    m.rotation.z = Math.PI;
    m.position.y = -height / 2;
    plume.add(m);
  }
  plume.visible = false;
  root.add(plume);
  root.userData.plume = plume;
  root.userData.length = id === "voyager" ? 14 : 10;
  return root;
}

export function disposeExplorer(root) {
  const geometries = new Set(), materials = new Set(root.userData.materials || []);
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) materials.add(o.material);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
