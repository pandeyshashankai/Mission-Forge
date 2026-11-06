import { FlightSim } from "./flight";
import { presetFalconLike } from "./presets";
import { getMission } from "./missions";
import { DEFAULT_PROFILE } from "./guidance";
import { evaluateFlight } from "./scoring";
import { NASA_DATA } from "../science/catalog";

export const REPLAY_MODEL = "mission-forge-guided-v1";
// Canonical numeric state excludes wall-clock dates and UI-only notifications.
export function replayCheckpoint(sim) {
  return {t:sim.t,r:[...sim.r],v:[...sim.v],mass:sim.nav.mass,
    apoapsis:sim.nav.el.apoapsis,periapsis:sim.nav.el.periapsis,
    eventIndex:sim.rt.eventIndex,status:sim.status};
}
export function stateHash(value) {
  const text=JSON.stringify(value,(_,v)=>typeof v==="number"&&Number.isFinite(v)?Number(v.toPrecision(12)):v);
  let hash=2166136261;
  for(let i=0;i<text.length;i++){ hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619); }
  return (hash>>>0).toString(16).padStart(8,"0");
}
export function showcaseReplaySpec() {
  const mission=getMission("first_orbit");
  return {version:1,model:REPLAY_MODEL,sourceCommit:NASA_DATA.commit,
    initial:{design:presetFalconLike(),missionId:"first_orbit",difficulty:"amateur",
      profile:{...DEFAULT_PROFILE,targetAltitude:mission.target.altitude,targetInclination:mission.target.inclination}},
    commands:[{action:"launch"},...Array.from({length:150},()=>({action:"advance",seconds:10}))],
    stopAtGuidanceComplete:true};
}
export function runMissionReplay(spec) {
  if(spec?.version!==1||spec.model!==REPLAY_MODEL||spec.sourceCommit!==NASA_DATA.commit||
    !Array.isArray(spec.commands)||spec.commands.length>2000||spec.initial?.missionId!=="first_orbit"||
    spec.initial?.difficulty!=="amateur") throw new Error("Unsupported replay model, dataset or mission.");
  for(const c of spec.commands) if(c.action!=="launch" && !(c.action==="advance"&&Number.isFinite(c.seconds)&&c.seconds>0&&c.seconds<=10))
    throw new Error("Invalid replay command.");
  const mission=getMission(spec.initial.missionId), sim=new FlightSim({...spec.initial,mission});
  const checkpoints=[];
  for(const command of spec.commands){
    if(command.action==="launch")sim.launch(); else sim.advance(command.seconds);
    sim.checkpointQueue=[];
    if([sim.t,...sim.r,...sim.v,sim.nav.mass].some(x=>!Number.isFinite(x)))throw new Error("Non-finite replay state");
    checkpoints.push(replayCheckpoint(sim));
    if(sim.isEnded()||(spec.stopAtGuidanceComplete&&sim.orbitAt&&sim.guidance.done))break;
  }
  const result=evaluateFlight(sim,spec.initial.design,mission,spec.initial.difficulty);
  return {hash:stateHash(checkpoints),checkpoints,outcome:result.outcome,
    final:replayCheckpoint(sim),commandsExecuted:checkpoints.length};
}
export function compareReplay(actual,reference) {
  // 12 significant figures allows harmless last-bit platform rounding, not changed physics.
  return actual.hash===reference.hash&&actual.outcome===reference.outcome&&actual.commandsExecuted===reference.commandsExecuted;
}
