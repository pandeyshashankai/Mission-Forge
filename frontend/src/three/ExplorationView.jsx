import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildExplorer, disposeExplorer } from "./explorerMeshes";
import { planetTexture } from "./planetTexture";
import { BODIES } from "../sim/solarSystem";
import { cross, norm, len, scale, add } from "../sim/vec";

const point = (v) => new THREE.Vector3(v[0] / 1000, v[2] / 1000, -v[1] / 1000);

export function ExplorationView({
  simRef,
  fleetRef,
  formation = false,
  overview,
  quality = "medium",
  active = true,
  reduceMotion = false,
}) {
  const capture = useRef(null);
  const [captureStatus, setCaptureStatus] = useState("");
  const mount = useRef(null),
    mode = useRef(overview);
  mode.current = overview;
  const formationRef = useRef(formation);
  formationRef.current = formation;
  const activeRef = useRef(active);
  activeRef.current = active;
  const motionRef = useRef(reduceMotion);
  motionRef.current = reduceMotion;
  useEffect(() => {
    const host = mount.current;
    const renderer = new THREE.WebGLRenderer({
      antialias: quality !== "low",
      logarithmicDepthBuffer: true,
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, quality === "low" ? 0.75 : 1.25),
    );
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#030711");
    const camera = new THREE.PerspectiveCamera(
      48,
      host.clientWidth / host.clientHeight,
      0.001,
      1e9,
    );
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const light = new THREE.DirectionalLight("#fff6e0", 3);
    scene.add(light, light.target, new THREE.AmbientLight("#8aa4cf", 0.32));
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshStandardMaterial({ roughness: 0.93 }),
    );
    scene.add(planet);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 2.3, 128),
      new THREE.MeshStandardMaterial({
        color: "#b9a77f",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      }),
    );
    ring.rotation.x = -Math.PI / 2.4;
    scene.add(ring);
    const loader = new THREE.TextureLoader();
    const textures = {
      earth: loader.load("/textures/earth_atmos_2048.jpg"),
      moon: loader.load("/textures/moon_1024.jpg"),
    };
    for (const body of BODIES)
      if (!textures[body.id]) textures[body.id] = planetTexture(body);
    Object.values(textures).forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
    });
    let ship = buildExplorer(simRef.current.craft.id, quality, simRef.current.baseCraft?.design);
    scene.add(ship);
    const companions=new Map();
    const makeFragment=()=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.0005,0),new THREE.MeshStandardMaterial({color:'#f59e0b'}));m.visible=false;scene.add(m);return m;};const fragmentModels=Array.from({length:32},makeFragment);
    // A short-range inspection light keeps the craft readable on the night side.
    // It illuminates only nearby geometry and does not relight the planet.
    const inspectionLight = new THREE.PointLight("#c8e4ff", 3, 0.2, 0);
    inspectionLight.position.set(0.025, 0.03, 0.025);
    scene.add(inspectionLight);
    const labels = [];
    for (const [name, color] of [["Pe", "#fbbf24"], ["Ap", "#67e8f9"]]) {
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#091426"; ctx.fillRect(0, 0, 128, 64);
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 124, 60);
      ctx.fillStyle = color; ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center"; ctx.fillText(name, 64, 45);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
      label.userData.texture = texture; scene.add(label); labels.push(label);
    }
    const path = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#42cce2",
        transparent: true,
        opacity: 0.65,
      }),
    );
    path.frustumCulled = false;
    scene.add(path);
    const stars = [];
    for (let i = 0; i < 1800; i++) {
      const d = new THREE.Vector3().randomDirection().multiplyScalar(1e7);
      stars.push(d.x, d.y, d.z);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(stars, 3),
    );
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: "#d9e9ff",
          size: 1.2,
          sizeAttenuation: false,
        }),
      ),
    );
    capture.current = () => {
      renderer.render(scene, camera);
      renderer.domElement.toBlob((blob) => {
        if (!blob) { setCaptureStatus("Image unavailable. Try again."); return; }
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url;
        link.download = `mission-forge-${simRef.current.craft.id}-${simRef.current.navigation().body.id}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setCaptureStatus("View saved as PNG");
      }, "image/png");
    };
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    const diagnostic = debug ? document.createElement("output") : null;
    if(diagnostic){ diagnostic.className="dev-performance"; diagnostic.dataset.testid="dev-performance"; host.appendChild(diagnostic); }
    let frames=0, sampleAt=performance.now();
    let raf,
      lastMode,
      lastBody,
      lastCraft,
      timer = 0,
      then = performance.now();
    const observer = new ResizeObserver(() => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    });
    observer.observe(host);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!activeRef.current) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - then) / 1000);
      timer -= dt;
      then = now;
      const sim = simRef.current,
        nav = sim.navigation(),
        b = nav.body;
      const reduced = motionRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (ship.name !== sim.craft.id || (sim.craft.id==='hangar' && ship.userData.design!==sim.baseCraft.design)) {
        scene.remove(ship); disposeExplorer(ship);
        ship = buildExplorer(sim.craft.id, quality, sim.baseCraft?.design); scene.add(ship);
      }
      ship.visible=!(sim.debris?.length);
      const debrisWorld=fleetRef?.current;const debris=debrisWorld?.entries.some(e=>e.sim.debris?.some(f=>f.mesh))?debrisWorld.entries.flatMap(e=>e.sim.debris||[]).slice(0,64):sim.debris||[];while(fragmentModels.length<debris.length)fragmentModels.push(makeFragment());fragmentModels.forEach((m,i)=>{const f=debris[i];m.visible=!!f&&!mode.current;if(f){if(f.mesh&&m.userData.fragmentMesh!==f.mesh){m.geometry.dispose();const positions=[];for(const face of f.mesh.faces)for(const k of face)positions.push(...f.mesh.vertices[k].map(x=>x/1000));m.geometry=new THREE.BufferGeometry();m.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));m.geometry.computeVertexNormals();m.userData.fragmentMesh=f.mesh;}if(!f.mesh&&m.userData.fragmentMesh){m.geometry.dispose();m.geometry=new THREE.IcosahedronGeometry(.0005,0);m.userData.fragmentMesh=null;}m.position.copy(point(f.r.map((x,k)=>x-sim.r[k])));if(f.q)m.quaternion.set(...f.q);else m.quaternion.identity();}});
      const world=fleetRef?.current;
      const nearby=[];
      for(const model of companions.values())model.visible=false;
      for(const entry of world?.entries||[]){
        if(entry.sim===sim||world.hostIds.has(entry.id)||entry.sim.debris?.length)continue;
        const delta=entry.sim.r.map((x,i)=>x-sim.r[i]),separation=Math.hypot(...delta);
        if(separation<2000&&entry.sim.primary===sim.primary){
          let model=companions.get(entry.id);
          if(!model||model.name!==entry.sim.craft.id||(entry.sim.craft.id==='hangar'&&model.userData.design!==entry.sim.baseCraft.design)){if(model){scene.remove(model);disposeExplorer(model);}model=buildExplorer(entry.sim.craft.id,quality,entry.sim.baseCraft?.design);companions.set(entry.id,model);scene.add(model);}
          model.visible=!mode.current;model.scale.setScalar(0.001);model.position.copy(point(delta));
          model.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),point(entry.sim.navigation().direction).normalize());
          nearby.push({model,separation});
        }else if(companions.has(entry.id))companions.get(entry.id).visible=false;
      }
      for(const [id,model]of companions)if(!world?.entries.some(e=>e.id===id)){scene.remove(model);disposeExplorer(model);companions.delete(id);}
      host.dataset.craft = sim.craft.id;
      host.dataset.camera = mode.current ? "orbit" : "craft";
      const offset = point(nav.r);
      planet.position.copy(offset).multiplyScalar(-1);
      planet.scale.setScalar(b.radius / 1000);
      planet.rotation.y = Number.isFinite(b.rotation) ? 2 * Math.PI * sim.t / b.rotation : 0;
      ring.position.copy(planet.position);
      ring.scale.copy(planet.scale);
      ring.visible = b.id === "saturn";
      if (b.id !== lastBody) {
        planet.material.map = textures[b.id] || null;
        planet.material.color.set(textures[b.id] ? "#ffffff" : b.color);
        planet.material.needsUpdate = true;
      }
      const up = offset.clone().normalize(),
        direction = point(nav.direction).normalize();
      if(sim.rigidEnabled){const q=sim.rigid.q;ship.quaternion.set(q[0],q[1],q[2],q[3]).premultiply(new THREE.Quaternion(-Math.SQRT1_2,0,0,Math.SQRT1_2));}
      else ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      ship.scale.setScalar(mode.current ? Math.max(0.001, b.radius / 150000) : 0.001);
      const plume = ship.userData.plume;
      plume.visible =
        sim.throttle > 0 && sim.fuel > 0 && sim.status === "flying";
      plume.scale.y = 0.2 + 0.8 * sim.throttle;
      plume.scale.x = plume.scale.z = 0.5 + 0.5 * sim.throttle;
      light.position.copy(point(sim.r).normalize().multiplyScalar(-100000));
      const cameraChanged = mode.current !== lastMode || b.id !== lastBody || sim.craft.id !== lastCraft;
      if (cameraChanged) {
        if (lastMode !== undefined && !reduced)
          host.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
        controls.enabled = mode.current;
        camera.up.copy(up);
        if (mode.current) {
          controls.target.copy(planet.position);
          camera.position
            .copy(planet.position)
            .add(
              new THREE.Vector3(
                0,
                (b.radius / 1000) * 1.2,
                (b.radius / 1000) * 3.8,
              ),
            );
          camera.lookAt(planet.position);
        }
        lastMode = mode.current;
        lastBody = b.id;
        lastCraft = sim.craft.id;
      }
      if (!mode.current) {
        let side = new THREE.Vector3().crossVectors(up, direction).normalize();
        if (side.lengthSq() < 0.1)
          side = new THREE.Vector3(0, 1, 0).cross(up).normalize();
        camera.up.copy(up);
        const partner=formationRef.current?nearby.sort((a,b)=>a.separation-b.separation)[0]:null;
        const focus=partner?partner.model.position.clone().multiplyScalar(0.5):new THREE.Vector3();
        const distance = Math.max(ship.userData.length * 0.003,partner?partner.separation/1000*1.4:0);
        const desired = side.multiplyScalar(distance)
          .addScaledVector(direction, -distance * 0.65)
          .addScaledVector(up, distance * 0.32).add(focus);
        camera.position.lerp(desired, cameraChanged || reduced ? 1 : 1 - Math.exp(-dt * 8));
        camera.lookAt(focus);
      } else {
        controls.target.copy(planet.position);
        controls.update();
      }
      if (timer <= 0) {
        timer = 0.5;
        const e = nav.el.e,
          h = len(cross(nav.r, nav.v)),
          p = (h * h) / b.mu;
        const P = e > 1e-5 ? norm(nav.el.eVec) : norm(nav.r),
          Q = norm(cross(norm(cross(nav.r, nav.v)), P));
        const max = e < 1 ? Math.PI : Math.acos(-1 / e) * 0.97;
        const pts = [];
        for (let j = 0; j <= 240; j++) {
          const f = -max + (j * 2 * max) / 240,
            radius = p / (1 + e * Math.cos(f));
          if (radius > 0 && Number.isFinite(radius))
            pts.push(
              point(
                add(
                  scale(P, radius * Math.cos(f)),
                  scale(Q, radius * Math.sin(f)),
                ),
              ),
            );
        }
        path.geometry.dispose();
        path.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      }
      const validOrbit = nav.el.e < 1 && nav.el.e >= 0 && nav.el.a > b.radius;
      labels.forEach((label, index) => {
        label.visible = mode.current && validOrbit && nav.el.e > 0.001;
        if (label.visible) {
          const radius = nav.el.a * (index ? 1 + nav.el.e : 1 - nav.el.e);
          label.position.copy(point(scale(norm(nav.el.eVec), index ? -radius : radius))).add(planet.position);
          const size = camera.position.distanceTo(label.position) * 0.035;
          label.scale.set(size * 2, size, 1);
        }
      });
      path.position.copy(planet.position);
      path.visible = mode.current;
      renderer.render(scene, camera);
      if(diagnostic){
        frames++;
        if(now-sampleAt>=1000){
          diagnostic.textContent=`Developer diagnostics\nFPS ${(frames*1000/(now-sampleAt)).toFixed(0)}\nFrame ${((now-sampleAt)/frames).toFixed(1)} ms\nPhysics ${(sim.lastPhysicsMs||0).toFixed(2)} ms/frame\nDraw calls ${renderer.info.render.calls} · triangles ${renderer.info.render.triangles}\nGPU geometries ${renderer.info.memory.geometries} · textures ${renderer.info.memory.textures}\n${sim.lastPhysicsMs>8?"Physics frame exceeds 8 ms desktop target":"8 ms desktop target · hardware dependent"}`;
          frames=0;sampleAt=now;
        }
      }
    };
    loop();
    return () => {
      capture.current = null;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      for(const model of companions.values()){scene.remove(model);disposeExplorer(model);}
      scene.remove(ship);
      disposeExplorer(ship);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) o.material.dispose();
      });
      labels.forEach((label) => label.userData.texture.dispose());
      Object.values(textures).forEach((t) => t.dispose());
      renderer.dispose();
      diagnostic?.remove();
      host.removeChild(renderer.domElement);
    };
  }, [simRef, quality, fleetRef]);
  return (
    <>
      <div ref={mount} className="absolute inset-0" data-testid="exploration-viewport" />
      {active && <div className="exploration-capture">
        <button className="ui-button" data-testid="explore-capture" onClick={() => {
          try { capture.current?.(); } catch { setCaptureStatus("Image unavailable. Try again."); }
        }}>Save view</button>
        <span role="status">{captureStatus}</span>
      </div>}
    </>
  );
}
