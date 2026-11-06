import { PHYSICS_REVISION } from "./forces";
import { BODIES } from "../solarSystem";
import { NASA_DATA } from "../../science/catalog";
export function controlState(sim) {
  return {
    t: sim.t,
    r: [...sim.r],
    v: [...sim.v],
    fuel: sim.fuel,
    batteryWh: sim.batteryWh,
    damage: sim.damage,
    rigid: sim.rigid,
    rigidEnabled: sim.rigidEnabled,
    primary: sim.primary,
    status: sim.status,
  };
}
export function controlHash(value) {
  const s = JSON.stringify(value, (_, v) =>
    typeof v === "number" && Number.isFinite(v) ? Number(v.toPrecision(12)) : v,
  );
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function beginRecording(sim) {
  if (sim.meshFracture || sim.debris?.some(d => d.mesh)) throw Error("Mesh debris requires full-engine state exports; single-vessel control traces do not include fleet contacts.");
  if (
    sim.transfer &&
    ["burn1", "coast", "ready", "burn2"].includes(sim.transfer.phase)
  )
    throw Error("Cancel assistance before recording manual flight.");
  sim.cancelTransfer("Manual recording started");
  sim.throttle = 0;
  sim.recording = {
    version: 1,
    physicsRevision: PHYSICS_REVISION,
    kind: "exploration-control-trace",
    sourceCommit: NASA_DATA.commit,
    customBodies: BODIES.filter((b) => b.custom).map((b) => ({ ...b })),
    initial: sim.serialize(),
    drag: sim.dragEnabled,
    commands: [],
    active: true,
    totalSteps: 0,
    reference: controlState(sim),
  };
  return sim.recording;
}
export function controlInput(sim) {
  return {
    dragEnabled: sim.dragEnabled,
    throttle: sim.throttle,
    mode: sim.mode,
    pitch: sim.pitch,
    yaw: sim.yaw,
    rcsEnabled: sim.rcsEnabled,
    heldDirection: sim.heldDirection ? [...sim.heldDirection] : null,
    physics: { ...sim.physics },
  };
}
export function finishRecordingStep(sim, command, steps) {
  const record = sim.recording;
  if (!record?.active) return;
  record.commands.push({ ...command, maxSteps: steps });
  record.totalSteps += steps;
  record.reference = controlState(sim);
  if (record.commands.length >= 12000 || record.totalSteps >= 200000) {
    record.active = false;
    record.notice = "Recording stopped at the bounded work limit.";
  }
}
