import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildRocket, disposeObject } from "./partMeshes";
import { EARTH, DEG } from "../sim/constants";
import { predictPath, nodePrediction } from "../sim/maneuver";
import { moonState, MOON } from "../sim/bodies";

const R = EARTH.radius;
const QUALITY = { low: { px: 0.75, seg: 96, cap: 96 }, medium: { px: 1, seg: 160, cap: 160 }, high: { px: 1.5, seg: 256, cap: 256 } };
const toThree = (v) => new THREE.Vector3(v[0], v[2], -v[1]);

function visibleDesign(sim) {
  const rt = sim.rt;
  const uids = new Set();
  const gone = new Set();
  rt.sections.forEach((s, i) => {
    if (!s.attached) return;
    sim.sections[i].uids.forEach((u) => uids.add(u));
    s.fairings.forEach((f) => !f.attached && gone.add(f.uid));
  });
  const attachedRadials = new Set(rt.radials.filter((r) => r.attached).map((r) => r.uid));
  return {
    stack: sim.design.stack.filter((n) => uids.has(n.uid) && !gone.has(n.uid)),
    radials: (sim.design.radials || []).filter((r) => attachedRadials.has(r.uid)),
  };
}

// Spherical cap mesh around the launch site, built in double precision relative to its centre.
function groundCap(texture, latC, lonC, span, seg) {
  const center = ecef(latC, lonC, R);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    for (let j = 0; j <= seg; j++) {
      const lat = latC - span + (2 * span * i) / seg;
      const lon = lonC - span + (2 * span * j) / seg;
      const p = ecef(lat, lon, R);
      pos.push(p.x - center.x, p.y - center.y, p.z - center.z);
      uv.push((lon + 180) / 360 + 0.0, (lat + 90) / 180);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, side: THREE.DoubleSide }));
  m.position.copy(center);
  return m;
}

function ecef(latDeg, lonDeg, r) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

function atmosphereShell() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { sunDir: { value: new THREE.Vector3(1, 0, 0) } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(V, vN)), 3.0); float day = clamp(dot(vN, sunDir)*0.8+0.4, 0.05, 1.0); gl_FragColor = vec4(vec3(0.3,0.6,1.0)*rim*1.6*day, rim*day); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(R * 1.022, 96, 48), mat);
}

const norm3 = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const scaleV = (a, k) => a.map((x) => x * k);

function setLine(line, pts) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(pts.map(toThree));
  if (line.material.isLineDashedMaterial) line.computeLineDistances();
}

function marker(text, color, cy = 0.25) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.font = "bold 30px JetBrains Mono, monospace";
  g.textAlign = "center";
  g.fillText(text, 64, 30);
  g.beginPath();
  g.arc(64, 48, 7, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true }));
  sp.scale.set(0.07, 0.035, 1);
  sp.center.set(0.5, cy);
  sp.renderOrder = 10;
  return sp;
}

function makePlume() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: "#ff8a3c", transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 16, 1, true), new THREE.MeshBasicMaterial({ color: "#fff1c4", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  outer.rotation.x = Math.PI;
  inner.rotation.x = Math.PI;
  outer.position.y = -0.5;
  inner.position.y = -0.35;
  g.add(outer, inner);
  return g;
}

export const FlightView = ({ simRef, cameraMode, quality = "medium", onFrame }) => {
  const mountRef = useRef(null);
  const camModeRef = useRef(cameraMode);
  const frameRef = useRef(onFrame);
  camModeRef.current = cameraMode;
  frameRef.current = onFrame;

  useEffect(() => {
    const q = QUALITY[quality] || QUALITY.medium;
    const el = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.px));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.5, 2e9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enabled = false;
    controls.maxDistance = 2e9;
    const sunDir = new THREE.Vector3();
    const sun = new THREE.DirectionalLight("#fff6e8", 3.0);
    scene.add(sun, sun.target);
    scene.add(new THREE.AmbientLight("#334155", 0.25));
    const loader = new THREE.TextureLoader();
    const earthTex = loader.load("/textures/earth_atmos_2048.jpg");
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthTex.anisotropy = 8;
    const cloudTex = loader.load("/textures/earth_clouds_1024.png");
    const earthCenter = new THREE.Group();
    scene.add(earthCenter);
    const earthSpin = new THREE.Group();
    earthCenter.add(earthSpin);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R - 1500, q.seg, q.seg / 2), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.92, metalness: 0 }));
    earthSpin.add(earth);
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R + 9000, q.seg, q.seg / 2), new THREE.MeshStandardMaterial({ map: cloudTex, alphaMap: cloudTex, transparent: true, opacity: 0.8, depthWrite: false }));
    earthSpin.add(clouds);
    const atmo = atmosphereShell();
    earthCenter.add(atmo);
    const moonCenter = new THREE.Group();
    scene.add(moonCenter);
    const moonTex = loader.load("/textures/moon_1024.jpg");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON.radius, q.seg, q.seg / 2), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 }));
    moonCenter.add(moonMesh);
    moonCenter.visible = !!simRef.current.eph;
    const sim0 = simRef.current;
    const { lat, lon } = sim0.site;
    const cap = groundCap(earthTex, lat, lon, 5, q.cap);
    earthSpin.add(cap);
    const padUp = ecef(lat, lon, 1).normalize();
    const padSite = new THREE.Group();
    padSite.position.copy(ecef(lat, lon, R));
    padSite.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), padUp);
    const land = new THREE.Mesh(new THREE.CircleGeometry(2500, 64), new THREE.MeshStandardMaterial({ color: "#46553a", roughness: 1 }));
    land.rotation.x = -Math.PI / 2;
    land.position.y = 0.5;
    const concrete = new THREE.Mesh(new THREE.CylinderGeometry(70, 80, 2, 48), new THREE.MeshStandardMaterial({ color: "#8b8a84", roughness: 0.9 }));
    concrete.position.y = 1;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 95, 8), new THREE.MeshStandardMaterial({ color: "#6b2f22", roughness: 0.7, metalness: 0.4, wireframe: false }));
    tower.position.set(16, 2 + 47.5, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 3), tower.material);
    arm.position.set(9, 70, 0);
    padSite.add(land, concrete, tower, arm);
    earthSpin.add(padSite);
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 4000; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.5e9);
      sp.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#dbeafe", size: 1.4, sizeAttenuation: false, transparent: true }));
    scene.add(stars);
    const orbitLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.8 }));
    orbitLine.frustumCulled = false;
    earthCenter.add(orbitLine);
    const nodeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: "#f59e0b", dashSize: 2e5, gapSize: 1.2e5 }));
    nodeLine.frustumCulled = false;
    earthCenter.add(nodeLine);
    const apoM = marker("Ap", "#38bdf8"), periM = marker("Pe", "#10b981"), nodeM = marker("Node", "#f59e0b", 0.95), vesselM = marker("◆", "#e2e8f0");
    earthCenter.add(apoM, periM, nodeM);
    scene.add(vesselM);
    const mapPrev = new THREE.Vector3();
    let logSeen = 0;
    let shot = null;
    const mode0 = () => camModeRef.current;
    const rocketHolder = new THREE.Group();
    scene.add(rocketHolder);
    const plume = makePlume();
    rocketHolder.add(plume);
    let rocket = null;
    let visKey = "";
    const debris = [];
    const skyLow = new THREE.Color("#5b8fc7"), skyHigh = new THREE.Color("#000000"), sky = new THREE.Color();
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
    let last = performance.now();
    let orbitTimer = 0;
    let chaseDist = 0;
    let lastMode = null;
    let lastBody = "earth";
    const frameOf = (body) => (body === "moon" ? moonCenter : earthCenter);
    const onWheel = (e) => {
      if (camModeRef.current === "chase") chaseDist = Math.max(0.5, Math.min(40, (chaseDist || 1) * (e.deltaY > 0 ? 1.1 : 0.9)));
    };
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      const simDt = frameRef.current ? frameRef.current(dtReal) : 0;
      const nowVis = visibleDesign(sim);
      const key = nowVis.stack.map((n) => n.uid).join(",") + "|" + nowVis.radials.map((r) => r.uid).join(",");
      if (key !== visKey) {
        let offset = 0;
        if (rocket) {
          const bottomUid = nowVis.stack[nowVis.stack.length - 1]?.uid;
          const child = rocket.children.find((c) => c.userData.uid === bottomUid);
          offset = rocket.position.y + (child ? child.position.y : 0);
          const keep = new Set([...nowVis.stack.map((n) => n.uid), ...nowVis.radials.map((r) => r.uid)]);
          rocketHolder.remove(rocket);
          rocket.children.filter((c) => keep.has(c.userData.uid)).forEach((c) => {
            rocket.remove(c);
            disposeObject(c);
          });
          if (rocket.children.length) {
            const wrap = new THREE.Group();
            wrap.quaternion.copy(rocketHolder.quaternion);
            wrap.add(rocket);
            const dv = new THREE.Vector3(0, 1, 0).applyQuaternion(rocketHolder.quaternion);
            debris.push({ obj: wrap, r: [...sim.r], v: [sim.v[0] - dv.x * 3, sim.v[1] + dv.z * 3, sim.v[2] - dv.y * 3], spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), age: 0 });
            scene.add(wrap);
          } else disposeObject(rocket);
        }
        rocket = buildRocket(nowVis);
        rocket.position.y = offset;
        plume.position.y = offset;
        rocketHolder.add(rocket);
        visKey = key;
      }
      const rPos = toThree(sim.r);
      earthCenter.position.copy(rPos).multiplyScalar(-1);
      if (sim.eph) {
        moonCenter.visible = true;
        moonCenter.position.copy(toThree(moonState(sim.t, sim.eph).r)).sub(rPos);
        moonMesh.rotation.y = MOON.n * sim.t;
      }
      sunDir.copy(toThree(sim.sunDir)).normalize();
      earthSpin.rotation.y = EARTH.rotationRate * sim.t;
      clouds.rotation.y = sim.t * 1e-6;
      const nav = sim.nav;
      const dir = toThree(sim.dirFromAtt(sim.att, nav)).normalize();
      const up = rPos.clone().normalize();
      rocketHolder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const thr = nav.F > 0 ? Math.max(0.15, nav.F / Math.max(1, nav.Fmax)) : 0;
      plume.visible = thr > 0;
      const vac = 1 - Math.min(1, nav.pRatio);
      const fmn = Math.sqrt(Math.max(0, nav.F) / 1e6);
      const pr = (0.4 + 0.4 * fmn) * (1 + vac);
      plume.scale.set(pr, (8 + 12 * fmn) * (0.8 + 0.4 * vac) * (0.95 + Math.random() * 0.1), pr);
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.age += simDt;
        const steps = Math.ceil(simDt / 0.5) || 0;
        for (let s = 0; s < steps; s++) {
          const h = simDt / steps;
          const rm = Math.hypot(...d.r);
          const k = -EARTH.mu / (rm * rm * rm);
          d.v = [d.v[0] + k * d.r[0] * h, d.v[1] + k * d.r[1] * h, d.v[2] + k * d.r[2] * h];
          d.r = [d.r[0] + d.v[0] * h, d.r[1] + d.v[1] * h, d.r[2] + d.v[2] * h];
        }
        d.obj.position.copy(toThree(d.r)).sub(rPos);
        d.obj.rotateOnAxis(d.spin, 0.3 * simDt);
        if (d.age > 120 || Math.hypot(...d.r) < R) {
          scene.remove(d.obj);
          disposeObject(d.obj);
          debris.splice(i, 1);
        }
      }
      const alt = Math.hypot(...sim.r) - R;
      sky.copy(skyLow).lerp(skyHigh, Math.min(1, Math.max(0, alt / 60000)));
      scene.background = sky;
      cap.visible = alt < 200000;
      padSite.visible = alt < 80000;
      clouds.visible = alt > 15000;
      stars.material.opacity = Math.min(1, Math.max(0, (alt - 20000) / 40000));
      stars.visible = stars.material.opacity > 0.01;
      sun.position.copy(sunDir).multiplyScalar(1e8);
      sun.target.position.set(0, 0, 0);
      atmo.material.uniforms.sunDir.value.copy(sunDir);
      orbitTimer -= dtReal;
      if (orbitTimer <= 0) {
        orbitTimer = sim.eph ? 1 : 0.25;
        const show = alt > 25000 || mode0() === "map";
        orbitLine.visible = show;
        apoM.visible = periM.visible = false;
        if (show) {
          const pred = predictPath(sim.r, sim.v, { points: 240, ctx: sim.ctx() });
          const grp = frameOf(pred.body);
          grp.add(orbitLine, apoM, periM);
          setLine(orbitLine, pred.pts);
          if (pred.el.e < 1) {
            const ap = scaleV(norm3(pred.el.eVec), -pred.el.ra);
            const pe = scaleV(norm3(pred.el.eVec), pred.el.rp);
            apoM.position.copy(toThree(ap));
            periM.position.copy(toThree(pe));
            apoM.visible = pred.el.ra < (pred.body === "moon" ? MOON.soi : 4e8);
            periM.visible = pred.el.rp > (pred.body === "moon" ? MOON.radius : R);
          }
        }
        const node = sim.node;
        nodeLine.visible = nodeM.visible = !!node && show;
        if (node && show) {
          const np = nodePrediction(sim, node);
          const ctx = { t0: node.t, eph: sim.eph };
          const pp = predictPath(np.at.r, np.v2, { points: 240, ctx });
          frameOf(np.body).add(nodeM);
          frameOf(pp.body).add(nodeLine);
          nodeM.position.copy(toThree(np.body === "moon" ? np.at.r.map((x, i) => x - moonState(node.t, sim.eph).r[i]) : np.at.r));
          setLine(nodeLine, pp.pts);
        }
      }
      vesselM.visible = mode0() === "map";
      const h = rocket ? rocket.userData.height : 30;
      const center = dir.clone().multiplyScalar((rocket ? rocket.position.y : 0) + h / 2);
      const mode = camModeRef.current;
      const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
      const north = up.clone().cross(east);
      let side = new THREE.Vector3().crossVectors(up, dir);
      if (side.lengthSq() < 1e-4) side = east.clone();
      side.normalize();
      if (mode === "map" && nav.body !== lastBody) lastMode = null;
      lastBody = nav.body;
      const mapTarget = frameOf(nav.body);
      if (mode !== lastMode) {
        controls.enabled = mode === "free" || mode === "map";
        if (mode === "free") {
          camera.up.copy(up);
          controls.target.copy(center);
          camera.position.copy(center).add(up.clone().multiplyScalar(h * 0.3)).add(east.clone().multiplyScalar(h * 2.2 + 10));
        }
        if (mode === "map") {
          camera.up.set(0, 1, 0);
          const el0 = nav.el;
          const D = nav.body === "moon" ? MOON.radius * 7 : el0.ra && el0.ra < 1e9 && el0.e < 1 ? Math.max(R * 3.2, el0.ra * 1.8) : R * 3.2;
          const off = toThree(nav.body === "moon" ? sim.prim.r : sim.r).normalize();
          controls.target.copy(mapTarget.position);
          camera.position.copy(mapTarget.position).addScaledVector(off, D).add(new THREE.Vector3(0, D * 0.38, 0));
          mapPrev.copy(mapTarget.position);
        }
        lastMode = mode;
      }
      scene.background = mode === "map" ? skyHigh : sky;
      if (mode === "chase") {
        if (!chaseDist) chaseDist = 1;
        const d = (h * 1.6 + 12) * chaseDist;
        const off = new THREE.Vector3();
        if (alt < 3000) off.addScaledVector(east, -0.8).addScaledVector(north, -0.45).addScaledVector(up, 0.08);
        else off.addScaledVector(dir, -0.6).addScaledVector(side, 0.6).addScaledVector(up, 0.3);
        camera.up.copy(up);
        camera.position.copy(center).addScaledVector(off.normalize(), d);
        camera.lookAt(center);
      } else if (mode === "cinematic") {
        const log = sim.log;
        for (; logSeen < log.length; logSeen++) {
          const e = log[logSeen];
          const kind = /Liftoff/.test(e.text) ? "pad" : /fairing/i.test(e.text) ? "fairing" : e.type === "stage" && /Separate|Jettison/.test(e.text) ? "sep" : /burn start/.test(e.text) ? "burn" : null;
          if (kind) shot = { kind, t0: now, simT0: sim.t, r0: [...sim.r], v0: [...sim.v], w0: side.clone().multiplyScalar(kind === "fairing" ? h * 0.5 + 8 : h * 0.6 + 15).addScaledVector(dir, kind === "fairing" ? h * 0.9 : -h * 0.1).addScaledVector(up, 4) };
        }
        const el = shot ? (now - shot.t0) / 1000 : 99;
        const dur = shot ? { pad: 9, sep: 8, fairing: 7, burn: 10 }[shot.kind] : 0;
        camera.up.copy(up);
        if (shot && el < dur && shot.kind === "pad" && alt < 20000) {
          camera.position.copy(padSite.localToWorld(new THREE.Vector3(-220, 14, 300)));
          camera.lookAt(center);
        } else if (shot && el < dur && (shot.kind === "sep" || shot.kind === "fairing")) {
          const dt = sim.t - shot.simT0;
          const p = toThree([shot.r0[0] + shot.v0[0] * dt, shot.r0[1] + shot.v0[1] * dt, shot.r0[2] + shot.v0[2] * dt]).sub(rPos).add(shot.w0);
          camera.position.copy(p);
          camera.lookAt(center);
        } else {
          const a = (shot && el < dur && shot.kind === "burn" ? 0.35 : 0.06) * (now / 1000);
          const d = h * 2.2 + 25;
          const back = dir.clone().multiplyScalar(-1);
          camera.position.copy(center).addScaledVector(side, Math.cos(a) * d).addScaledVector(back, Math.sin(a) * d * 0.7).addScaledVector(alt < 3000 ? north : up, d * 0.25);
          camera.lookAt(center);
        }
      } else if (mode === "map") {
        const delta = mapTarget.position.clone().sub(mapPrev);
        camera.position.add(delta);
        mapPrev.copy(mapTarget.position);
        controls.target.copy(mapTarget.position);
        controls.update();
      } else {
        controls.target.copy(center);
        controls.update();
      }
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      earthTex.dispose();
      moonTex.dispose();
      cloudTex.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [quality, simRef]);

  return <div ref={mountRef} className="absolute inset-0" data-testid="flight-3d-viewport" />;
};
