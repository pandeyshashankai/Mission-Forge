import {profileFraming,profileBasis} from './profileCamera';
import {createRecoveryVisuals,updateRecoveryVisuals} from './recoveryVisuals';
import {PARTS} from "../sim/parts";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {buildLaunchStation} from "./launchStation";
import { buildRocket, disposeObject,layoutDesign } from "./partMeshes";
import { EARTH, DEG } from "../sim/constants";
import { predictPath, nodePrediction } from "../sim/maneuver";
import { moonState, MOON } from "../sim/bodies";

const R = EARTH.radius;
const QUALITY = {
  auto: { px: 1, seg: 160, cap: 160 },
  low: { px: 0.75, seg: 96, cap: 96 },
  medium: { px: 1, seg: 160, cap: 160 },
  high: { px: 1.5, seg: 256, cap: 256 },
};
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
  const attachedRadials = new Set(
    rt.radials.filter((r) => r.attached).map((r) => r.uid),
  );
  return {
    editorLayout: sim.design.editorLayout,
    stack: sim.design.stack.filter((n) => uids.has(n.uid) && !gone.has(n.uid)),
    radials: (sim.design.radials || []).filter((r) =>
      attachedRadials.has(r.uid),
    ),
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
      const a = i * (seg + 1) + j,
        b = a + 1,
        c = a + seg + 1,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  m.position.copy(center);
  return m;
}

function ecef(latDeg, lonDeg, r) {
  const la = latDeg * DEG,
    lo = lonDeg * DEG;
  return new THREE.Vector3(
    r * Math.cos(la) * Math.cos(lo),
    r * Math.sin(la),
    -r * Math.cos(la) * Math.sin(lo),
  );
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

const norm3 = (a) => {
  const l = Math.hypot(...a);
  return a.map((x) => x / l);
};
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
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      depthTest: false,
      sizeAttenuation: false,
      transparent: true,
    }),
  );
  sp.scale.set(0.07, 0.035, 1);
  sp.center.set(0.5, cy);
  sp.renderOrder = 10;
  return sp;
}

function makePlume() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#ff8a3c",
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.7, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#fff1c4",
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  outer.rotation.x = Math.PI;
  inner.rotation.x = Math.PI;
  outer.position.y = -0.5;
  inner.position.y = -0.35;
  g.add(outer, inner);
  return g;
}

export const FlightView = ({
  simRef,
  cameraMode,
  viewCommand,
  quality = "medium",
  onFrame,
}) => {
  const mountRef = useRef(null);
  const camModeRef = useRef(cameraMode);
  const frameRef = useRef(onFrame);
  const commandRef=useRef(viewCommand);commandRef.current=viewCommand;
  camModeRef.current = cameraMode;
  frameRef.current = onFrame;

  useEffect(() => {
    const q = QUALITY[quality] || QUALITY.medium;
    const el = mountRef.current;
    const renderer = new THREE.WebGLRenderer({
      antialias: quality !== "low",
      logarithmicDepthBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.px));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    const camera = new THREE.PerspectiveCamera(
      50,
      el.clientWidth / el.clientHeight,
      0.5,
      2e9,
    );
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
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(R - 1500, q.seg, q.seg / 2),
      new THREE.MeshStandardMaterial({
        map: earthTex,
        roughness: 0.92,
        metalness: 0,
      }),
    );
    earthSpin.add(earth);
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(R + 9000, q.seg, q.seg / 2),
      new THREE.MeshStandardMaterial({
        map: cloudTex,
        alphaMap: cloudTex,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    earthSpin.add(clouds);
    const atmo = atmosphereShell();
    earthCenter.add(atmo);
    const moonCenter = new THREE.Group();
    scene.add(moonCenter);
    const moonTex = loader.load("/textures/moon_1024.jpg");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MOON.radius, q.seg, q.seg / 2),
      new THREE.MeshStandardMaterial({
        map: moonTex,
        roughness: 1,
        metalness: 0,
      }),
    );
    moonCenter.add(moonMesh);
    moonCenter.visible = !!simRef.current.eph;
    let fpsAcc = 0,
      fpsN = 0,
      px = Math.min(window.devicePixelRatio, q.px);
    const sim0 = simRef.current;
    const { lat, lon } = sim0.site;
    const cap = groundCap(earthTex, lat, lon, 5, q.cap);
    earthSpin.add(cap);
    const padUp = ecef(lat, lon, 1).normalize();
    const padSite = buildLaunchStation(layoutDesign(sim0.design).height,quality);
    padSite.position.copy(ecef(lat, lon, R));
    padSite.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), padUp);
    earthSpin.add(padSite);
    const parkedParts=[];
    if(sim0.leftBehindDesign){
      const parked=buildRocket(sim0.leftBehindDesign),left=layoutDesign(sim0.leftBehindDesign),main=layoutDesign(sim0.design);
      parked.position.set(left.anchorX-main.anchorX,left.minY-main.minY+2,0);
      for(const mesh of parked.children){const box=new THREE.Box3().setFromObject(mesh),floor=Math.hypot(mesh.position.x+parked.position.x,mesh.position.z)<76?1.85:.45;
        parkedParts.push({mesh,y:mesh.position.y,drop:Math.max(0,box.min.y+parked.position.y-floor)});}
      parked.name="Equipment left at launch site";padSite.add(parked);
    }
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 4000; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.5e9);
      sp.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: "#dbeafe",
        size: 1.4,
        sizeAttenuation: false,
        transparent: true,
      }),
    );
    scene.add(stars);
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#38bdf8",
        transparent: true,
        opacity: 0.8,
      }),
    );
    orbitLine.frustumCulled = false;
    earthCenter.add(orbitLine);
    const nodeLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: "#f59e0b",
        dashSize: 2e5,
        gapSize: 1.2e5,
      }),
    );
    nodeLine.frustumCulled = false;
    earthCenter.add(nodeLine);
    const apoM = marker("Ap", "#38bdf8"),
      periM = marker("Pe", "#10b981"),
      nodeM = marker("Node", "#f59e0b", 0.95),
      vesselM = marker("◆", "#e2e8f0");
    earthCenter.add(apoM, periM, nodeM);
    scene.add(vesselM);
    const soiMarkers = Array.from({length:4},()=>marker("SOI", "#c4b5fd"));
    soiMarkers.forEach(m=>{m.visible=false;earthCenter.add(m);});
    const soiShell = new THREE.Mesh(new THREE.SphereGeometry(MOON.soi,24,12),new THREE.MeshBasicMaterial({color:"#a78bfa",wireframe:true,transparent:true,opacity:0.12,depthWrite:false}));
    moonCenter.add(soiShell);
    const mapPrev = new THREE.Vector3();
    let logSeen = 0;
    let shot = null;
    const mode0 = () => camModeRef.current;
    const rocketHolder = new THREE.Group();
    scene.add(rocketHolder);
    const sidePlumes = [];
    const plume = makePlume();
    rocketHolder.add(plume);
    const recovery=createRecoveryVisuals();rocketHolder.add(recovery);
    let bounds={top:30,bottom:0,width:4,minX:-2,maxX:2,minZ:-2,maxZ:2};
    let rocket = null;
    let visKey = "";
    const debris = [];
    const skyLow = new THREE.Color("#5b8fc7"),
      skyHigh = new THREE.Color("#000000"),
      sky = new THREE.Color();
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
    let commandSeen=null;
    const pan=new THREE.Vector2(),pointers=new Map();
    let pinch=0;
    renderer.domElement.style.touchAction="none";
    const pointerDown=e=>{if(camModeRef.current!=="side")return;e.preventDefault();renderer.domElement.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;};
    const pointerMove=e=>{const old=pointers.get(e.pointerId);if(!old||camModeRef.current!=="side")return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0)chaseDist=Math.max(.25,Math.min(40,(chaseDist||1)*pinch/d));pinch=d;}else if(pointers.size===1){const span=profileFraming(bounds.top-bounds.bottom,bounds.width,el.clientWidth,el.clientHeight,chaseDist||1).span;pan.x-=(e.clientX-old.x)*span/el.clientHeight;pan.y+=(e.clientY-old.y)*span/el.clientHeight;}};
    const pointerUp=e=>{pointers.delete(e.pointerId);pinch=0;};
    for(const [type,fn]of [["pointerdown",pointerDown],["pointermove",pointerMove],["pointerup",pointerUp],["pointercancel",pointerUp]])renderer.domElement.addEventListener(type,fn);
    let lastBody = "earth";
    const frameOf = (body) => (body === "moon" ? moonCenter : earthCenter);
    const onWheel = (e) => {
      if (["chase","side"].includes(camModeRef.current)){
        e.preventDefault();
        chaseDist = Math.max(
          0.5,
          Math.min(40, (chaseDist || 1) * (e.deltaY > 0 ? 1.1 : 0.9)),
        );
      }
    };
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    const debug=new URLSearchParams(window.location.search).get('debug')==='1';
    const diagnostics=debug?document.createElement('output'):null;
    if(diagnostics){diagnostics.className='dev-performance';diagnostics.dataset.testid='dev-performance';el.appendChild(diagnostics);}
    let diagnosticFrames=0,diagnosticAt=performance.now(),lastPhysicsMs=0;
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dtReal = Math.min(0.1, (now - last) / 1000);
      // Dynamic quality: adapt the render resolution to hold ~40-55 fps.
      if (quality === "auto") {
        fpsAcc += dtReal;
        fpsN++;
        if (fpsAcc > 2) {
          const fps = fpsN / fpsAcc;
          const np =
            fps < 40
              ? Math.max(0.5, px - 0.15)
              : fps > 55
                ? Math.min(window.devicePixelRatio, 1.5, px + 0.1)
                : px;
          if (np !== px) renderer.setPixelRatio((px = np));
          fpsAcc = fpsN = 0;
        }
      }
      last = now;
      const sim = simRef.current;
      const physicsStarted=debug?performance.now():0;
      const simDt = frameRef.current ? frameRef.current(dtReal) : 0;
      if(debug)lastPhysicsMs=performance.now()-physicsStarted;
      const nowVis = visibleDesign(sim);
      const key =
        nowVis.stack.map((n) => n.uid).join(",") +
        "|" +
        nowVis.radials.map((r) => r.uid).join(",");
      if (key !== visKey) {
        let offset = 0;
        if (rocket) {
          const bottomUid = nowVis.stack.filter(n=>!n.mount).at(-1)?.uid;
          const child = rocket.children.find(
            (c) => c.userData.uid === bottomUid,
          );
          offset = rocket.position.y + (child ? child.position.y : 0);
          const keep = new Set([
            ...nowVis.stack.map((n) => n.uid),
            ...nowVis.radials.map((r) => r.uid),
          ]);
          rocketHolder.remove(rocket);
          rocket.children
            .filter((c) => keep.has(c.userData.uid))
            .forEach((c) => {
              rocket.remove(c);
              disposeObject(c);
            });
          if (rocket.children.length) {
            const wrap = new THREE.Group();
            wrap.quaternion.copy(rocketHolder.quaternion);
            wrap.add(rocket);
            const dv = new THREE.Vector3(0, 1, 0).applyQuaternion(
              rocketHolder.quaternion,
            );
            debris.push({
              obj: wrap,
              r: [...sim.r],
              v: [
                sim.v[0] - dv.x * 3,
                sim.v[1] + dv.z * 3,
                sim.v[2] - dv.y * 3,
              ],
              spin: new THREE.Vector3(
                Math.random(),
                Math.random(),
                Math.random(),
              ).normalize(),
              age: 0,
            });
            scene.add(wrap);
          } else disposeObject(rocket);
        }
        rocket = buildRocket(nowVis);
        const box=new THREE.Box3().setFromObject(rocket);bounds={top:box.max.y,bottom:box.min.y,width:Math.max(box.max.x-box.min.x,box.max.z-box.min.z),minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z};
        rocket.position.y = offset;
        plume.position.y = offset;
        rocketHolder.add(rocket);
        for(const p of sidePlumes){rocketHolder.remove(p.mesh);disposeObject(p.mesh);}sidePlumes.length=0;
        for(const n of nowVis.stack)if((nowVis.editorLayout||n.mount||n.rotation)&&PARTS[n.partId].engine){const mesh=makePlume();rocketHolder.add(mesh);sidePlumes.push({uid:n.uid,def:PARTS[n.partId].engine,rotation:n.rotation||0,height:PARTS[n.partId].height,mesh});}
        visKey = key;
      }
      const rPos = toThree(sim.r);
      earthCenter.position.copy(rPos).multiplyScalar(-1);
      if (sim.eph) {
        moonCenter.visible = true;
        moonCenter.position
          .copy(toThree(moonState(sim.t, sim.eph).r))
          .sub(rPos);
        moonMesh.rotation.y = MOON.n * sim.t;
      }
      sunDir.copy(toThree(sim.sunDir)).normalize();
      earthSpin.rotation.y = EARTH.rotationRate * sim.t;
      clouds.rotation.y = sim.t * 1e-6;
      const nav = sim.nav;
      const dir = toThree(sim.dir).normalize();
      const up = rPos.clone().normalize();
      rocketHolder.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir,
      );
      const thr = nav.F > 0 ? Math.max(0.15, nav.F / Math.max(1, nav.Fmax)) : 0;
      let sideForce=0;
      for(const p of sidePlumes){
        const stage=sim.rt.sections.find(s=>s.attached&&s.ignited&&s.engines.some(e=>e.uid===p.uid&&e.connected!==false));
        const burning=stage&&(stage.tanks[p.def.propellant]||0)>0&&sim.throttle>0;
        p.mesh.visible=!!burning;
        if(burning){const child=rocket.children.find(c=>c.userData.uid===p.uid);p.mesh.position.copy(child.position);p.mesh.position.y+=rocket.position.y;
          const angle=p.rotation*Math.PI/180;p.mesh.rotation.z=angle;
          p.mesh.position.x+=Math.sin(angle)*p.height/2;p.mesh.position.y+=(1-Math.cos(angle))*p.height/2;
          const force=p.def.thrustVac*Math.max(p.def.minThrottle||0,sim.throttle)*(p.def.ispVac-(p.def.ispVac-p.def.ispSL)*nav.pRatio)/p.def.ispVac;sideForce+=force;
          const factor=Math.sqrt(force/1e6);p.mesh.scale.set(.4+.4*factor,(8+12*factor)*(.95+Math.random()*.1),.4+.4*factor);}
      }
      plume.visible = !nowVis.editorLayout && thr > 0 && nav.F>sideForce;
      const vac = 1 - Math.min(1, nav.pRatio);
      const fmn = Math.sqrt(Math.max(0, nav.F-sideForce) / 1e6);
      const pr = (0.4 + 0.4 * fmn) * (1 + vac);
      plume.scale.set(
        pr,
        (8 + 12 * fmn) * (0.8 + 0.4 * vac) * (0.95 + Math.random() * 0.1),
        pr,
      );
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.age += simDt;
        const steps = Math.ceil(simDt / 0.5) || 0;
        for (let s = 0; s < steps; s++) {
          const h = simDt / steps;
          const rm = Math.hypot(...d.r);
          const k = -EARTH.mu / (rm * rm * rm);
          d.v = [
            d.v[0] + k * d.r[0] * h,
            d.v[1] + k * d.r[1] * h,
            d.v[2] + k * d.r[2] * h,
          ];
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
      for(const part of parkedParts)part.mesh.position.y=part.y-Math.min(part.drop,.5*9.80665*sim.t*sim.t);
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
        soiMarkers.forEach(m=>m.visible=false);
        if (show) {
          const pred = predictPath(sim.r, sim.v, {
            points: 240,
            ctx: sim.ctx(),
          });
          const grp = frameOf(pred.body);
          grp.add(orbitLine, apoM, periM);
          setLine(orbitLine, pred.pts);
          (pred.soi||[]).slice(0,4).forEach((entry,i)=>{
            const m=soiMarkers[i];grp.add(m);m.position.copy(toThree(entry.r));m.visible=mode0()==="map";
          });
          if (pred.el.e < 1) {
            const ap = scaleV(norm3(pred.el.eVec), -pred.el.ra);
            const pe = scaleV(norm3(pred.el.eVec), pred.el.rp);
            apoM.position.copy(toThree(ap));
            periM.position.copy(toThree(pe));
            apoM.visible = pred.el.ra < (pred.body === "moon" ? MOON.soi : 4e8);
            periM.visible =
              pred.el.rp > (pred.body === "moon" ? MOON.radius : R);
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
          nodeM.position.copy(
            toThree(
              np.body === "moon"
                ? np.at.r.map((x, i) => x - moonState(node.t, sim.eph).r[i])
                : np.at.r,
            ),
          );
          setLine(nodeLine, pp.pts);
        }
      }
      vesselM.visible = mode0() === "map";
      soiShell.visible = mode0() === "map" && !!sim.eph;
      if(mode0()!=="map")soiMarkers.forEach(m=>m.visible=false);
      recovery.position.y=rocket?rocket.position.y:0;
      const visual=updateRecoveryVisuals(recovery,{state:sim.entry?.chute,time:sim.t,chuteTime:sim.entry?.chuteT??sim.t,drogueCdA:sim.aero?.chute?.drogueCdA,mainCdA:sim.aero?.chute?.mainCdA,top:bounds.top,bottom:bounds.bottom,bodyWidth:bounds.width,flux:sim.entry?.flux});
      const h = visual.top-bounds.bottom;
      const radius=visual.chute?visual.width/2:0;
      const minX=Math.min(bounds.minX,-radius),maxX=Math.max(bounds.maxX,radius),minZ=Math.min(bounds.minZ,-radius),maxZ=Math.max(bounds.maxZ,radius);
      const visualWidth=Math.max(maxX-minX,maxZ-minZ);
      const center = new THREE.Vector3((minX+maxX)/2,(rocket ? rocket.position.y : 0)+bounds.bottom+h/2,(minZ+maxZ)/2).applyQuaternion(rocketHolder.quaternion);
      const mode = camModeRef.current;
      if(commandRef.current!==commandSeen){commandSeen=commandRef.current;chaseDist=1;pan.set(0,0);lastMode=null;}
      el.dataset.zoom=String(chaseDist||1);el.dataset.camera=mode;el.dataset.chute=sim.entry?.chute||"stowed";el.dataset.heat=String(visual.heat);
      const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
      const north = up.clone().cross(east);
      let side = new THREE.Vector3().crossVectors(up, dir);
      if (side.lengthSq() < 1e-4) side = east.clone();
      side.normalize();
      const scaleKey = `${nav.body}|${nav.el.e < 1 && nav.el.ra > 1e8 ? "far" : "near"}`;
      if (mode === "map" && scaleKey !== lastBody) lastMode = null;
      lastBody = scaleKey;
      const mapTarget = frameOf(nav.body);
      if (mode !== lastMode) {
        camera.fov=mode==="side"?1:50;camera.updateProjectionMatrix();
        controls.enabled = mode === "free" || mode === "map";
        if (mode === "free") {
          camera.up.copy(up);
          controls.target.copy(center);
          camera.position
            .copy(center)
            .add(up.clone().multiplyScalar(h * 0.3))
            .add(east.clone().multiplyScalar(h * 2.2 + 10));
        }
        if (mode === "map") {
          camera.up.set(0, 1, 0);
          const el0 = nav.el;
          const D =
            nav.body === "moon"
              ? MOON.radius * 7
              : el0.ra && el0.ra < 1e9 && el0.e < 1
                ? Math.max(R * 3.2, el0.ra * 1.8)
                : R * 3.2;
          const off = toThree(
            nav.body === "moon" ? sim.prim.r : sim.r,
          ).normalize();
          controls.target.copy(mapTarget.position);
          camera.position
            .copy(mapTarget.position)
            .addScaledVector(off, D)
            .add(new THREE.Vector3(0, D * 0.38, 0));
          mapPrev.copy(mapTarget.position);
        }
        lastMode = mode;
      }
      scene.background = mode === "map" ? skyHigh : sky;
      if(mode==="side"){
        const basis=profileBasis(up,sim.azimuth??90),vertical=Math.abs(dir.dot(basis.up)),horizontal=Math.abs(dir.dot(basis.right)),framing=profileFraming(h*vertical+visualWidth*Math.sqrt(Math.max(0,1-vertical*vertical)),h*horizontal+visualWidth*Math.sqrt(Math.max(0,1-horizontal*horizontal)),el.clientWidth,el.clientHeight,chaseDist||1);
        const target=center.clone().addScaledVector(basis.right,pan.x).addScaledVector(basis.up,pan.y);
        camera.up.copy(basis.up);camera.position.copy(target).addScaledVector(basis.normal,framing.distance);camera.lookAt(target);
      } else if (mode === "chase") {
        if (!chaseDist) chaseDist = 1;
        const d = (h * 1.6 + 12) * chaseDist;
        const off = new THREE.Vector3();
        if (alt < 3000)
          off
            .addScaledVector(east, -0.8)
            .addScaledVector(north, -0.45)
            .addScaledVector(up, 0.08);
        else
          off
            .addScaledVector(dir, -0.6)
            .addScaledVector(side, 0.6)
            .addScaledVector(up, 0.3);
        camera.up.copy(up);
        camera.position.copy(center).addScaledVector(off.normalize(), d);
        camera.lookAt(center);
      } else if (mode === "cinematic") {
        const log = sim.log;
        for (; logSeen < log.length; logSeen++) {
          const e = log[logSeen];
          const kind = /Liftoff/.test(e.text)
            ? "pad"
            : /fairing/i.test(e.text)
              ? "fairing"
              : e.type === "stage" && /Separate|Jettison/.test(e.text)
                ? "sep"
                : /burn start/.test(e.text)
                  ? "burn"
                  : null;
          if (kind)
            shot = {
              kind,
              t0: now,
              simT0: sim.t,
              r0: [...sim.r],
              v0: [...sim.v],
              w0: side
                .clone()
                .multiplyScalar(kind === "fairing" ? h * 0.5 + 8 : h * 0.6 + 15)
                .addScaledVector(dir, kind === "fairing" ? h * 0.9 : -h * 0.1)
                .addScaledVector(up, 4),
            };
        }
        const el = shot ? (now - shot.t0) / 1000 : 99;
        const dur = shot
          ? { pad: 9, sep: 8, fairing: 7, burn: 10 }[shot.kind]
          : 0;
        camera.up.copy(up);
        if (shot && el < dur && shot.kind === "pad" && alt < 20000) {
          camera.position.copy(
            padSite.localToWorld(new THREE.Vector3(-220, 14, 300)),
          );
          camera.lookAt(center);
        } else if (
          shot &&
          el < dur &&
          (shot.kind === "sep" || shot.kind === "fairing")
        ) {
          const dt = sim.t - shot.simT0;
          const p = toThree([
            shot.r0[0] + shot.v0[0] * dt,
            shot.r0[1] + shot.v0[1] * dt,
            shot.r0[2] + shot.v0[2] * dt,
          ])
            .sub(rPos)
            .add(shot.w0);
          camera.position.copy(p);
          camera.lookAt(center);
        } else {
          const a =
            (shot && el < dur && shot.kind === "burn" ? 0.35 : 0.06) *
            (now / 1000);
          const d = h * 2.2 + 25;
          const back = dir.clone().multiplyScalar(-1);
          camera.position
            .copy(center)
            .addScaledVector(side, Math.cos(a) * d)
            .addScaledVector(back, Math.sin(a) * d * 0.7)
            .addScaledVector(alt < 3000 ? north : up, d * 0.25);
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
      if(diagnostics){diagnosticFrames++;if(now-diagnosticAt>1000){const heap=performance.memory;diagnostics.textContent=`Developer diagnostics\nFPS ${(diagnosticFrames*1000/(now-diagnosticAt)).toFixed(0)}\nFrame ${((now-diagnosticAt)/diagnosticFrames).toFixed(1)} ms\nPhysics ${lastPhysicsMs.toFixed(2)} ms/frame\nDraw calls ${renderer.info.render.calls} · triangles ${renderer.info.render.triangles}\nGeometries ${renderer.info.memory.geometries} · textures ${renderer.info.memory.textures}${heap?'\nJS heap '+(heap.usedJSHeapSize/1048576).toFixed(0)+' MB':''}${heap&&heap.usedJSHeapSize>heap.jsHeapSizeLimit*0.8?' · high heap use':''}`;diagnosticFrames=0;diagnosticAt=now;}}
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("wheel", onWheel);
      for(const [type,fn]of [["pointerdown",pointerDown],["pointermove",pointerMove],["pointerup",pointerUp],["pointercancel",pointerUp]])renderer.domElement.removeEventListener(type,fn);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if(o.isSprite)o.material.map?.dispose();
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
      });
      padSite.userData.textures?.forEach(texture=>texture.dispose());
      scene.environment?.dispose();
      pm.dispose();
      earthTex.dispose();
      moonTex.dispose();
      cloudTex.dispose();
      renderer.dispose();
      diagnostics?.remove();
      el.removeChild(renderer.domElement);
    };
  }, [quality, simRef]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      data-testid="flight-3d-viewport"
    />
  );
};
