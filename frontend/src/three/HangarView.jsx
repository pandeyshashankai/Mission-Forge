import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { geometryAnalysis } from "../sim/advanced/geometry";
import { buildRocket, disposeObject, setHighlight, layoutDesign } from "./partMeshes";

const PIXEL = { low: 0.75, medium: 1, high: 1.5 };

export const HangarView = ({
  design,
  selectedUid,
  onSelect,
  xray,
  overlays=false,
  quality = "medium",
}) => {
  const mountRef = useRef(null);
  const ctx = useRef({});

  useEffect(() => {
    const el = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: quality !== "low" });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, PIXEL[quality] || 1),
    );
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = quality !== "low";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#315379");
    scene.fog = new THREE.Fog("#315379", 90, 260);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(
      40,
      el.clientWidth / el.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(38, 22, 38);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 4;
    controls.maxDistance = 180;
    scene.add(new THREE.HemisphereLight("#bcd4ff", "#1a1410", 0.55));
    const key = new THREE.DirectionalLight("#fff4e0", 2.2);
    key.position.set(30, 60, 25);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -40,
      right: 40,
      top: 80,
      bottom: -10,
      far: 200,
    });
    scene.add(key);
    const rim = new THREE.DirectionalLight("#38bdf8", 0.8);
    rim.position.set(-40, 20, -30);
    scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(140, 64),
      new THREE.MeshStandardMaterial({
        color: "#294a70",
        roughness: 0.85,
        metalness: 0.2,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(120, 60, "#7196b7", "#40658b");
    grid.position.y = 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    scene.add(grid);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.5, 0.4, 48),
      new THREE.MeshStandardMaterial({
        color: "#2b313b",
        roughness: 0.6,
        metalness: 0.5,
      }),
    );
    pad.position.y = -0.2;
    pad.receiveShadow = true;
    scene.add(pad);
    const ray = new THREE.Raycaster();
    let down = null;
    let multiTouch = false;
    const pointers = new Set();
    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) {
        down = null;
        return;
      }
      pointers.add(e.pointerId);
      if (pointers.size > 1) {
        multiTouch = true;
        down = null;
      } else down = [e.clientX, e.clientY];
    };
    const onUp = (e) => {
      pointers.delete(e.pointerId);
      if (multiTouch) {
        if (!pointers.size) multiTouch = false;
        down = null;
        return;
      }
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4)
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit =
        ctx.current.rocket &&
        ray
          .intersectObject(ctx.current.rocket, true)
          .find((h) => h.object.userData.uid);
      ctx.current.onSelect?.(hit ? hit.object.userData.uid : null);
    };
    const cancel = (e) => {
      pointers.delete(e.pointerId);
      down = null;
      if (!pointers.size) multiTouch = false;
    };
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    ctx.current = { ...ctx.current, scene, camera, controls, renderer };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      disposeObject(scene);
      scene.environment?.dispose();
      pm.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctx.current.rocket = null;
      ctx.current.overlay = null;
      ctx.current.lastHeight = undefined;
    };
  }, [quality]);

  useEffect(() => {
    ctx.current.onSelect = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const c = ctx.current;
    if (!c.scene) return;
    if (c.rocket) {
      c.scene.remove(c.rocket);
      disposeObject(c.rocket);
    }
    const rocket = buildRocket(design, { xray });
    c.scene.add(rocket);
    c.rocket = rocket;
    if(c.overlay){c.scene.remove(c.overlay);disposeObject(c.overlay);c.overlay=null;}
    if(overlays){
      const analysis=geometryAnalysis(design,layoutDesign(design)),group=new THREE.Group();
      for(const [point,color]of [[analysis.wetCOM,"#67e8f9"],[analysis.dryCOM,"#c4b5fd"],[analysis.sideAreaCenter,"#fbbf24"]]){
        const m=new THREE.Mesh(new THREE.SphereGeometry(0.65,12,8),new THREE.MeshBasicMaterial({color,depthTest:false}));m.position.set(...point);m.renderOrder=20;group.add(m);
      }
      if(analysis.thrust>0)group.add(new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(...analysis.thrustOrigin),Math.max(6,rocket.userData.height*0.3),"#4ade80",2,0.7));
      c.scene.add(group);c.overlay=group;
    }
    const h = rocket.userData.height;
    if (c.lastHeight === undefined || Math.abs(c.lastHeight - h) > 4) {
      c.controls.target.set(0, h / 2, 0);
      const d = Math.max(22, h * 1.9);
      c.camera.position.set(d * 0.7, h * 0.55 + 4, d * 0.7);
    }
    c.lastHeight = h;
    setHighlight(rocket, selectedUid);
  }, [design, xray, quality, overlays]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ctx.current.rocket) setHighlight(ctx.current.rocket, selectedUid);
  }, [selectedUid]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      data-testid="hangar-3d-viewport"
    />
  );
};
