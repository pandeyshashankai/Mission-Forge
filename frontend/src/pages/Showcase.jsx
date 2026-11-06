import { useState } from "react";
import { useGame } from "../game/GameContext";
import { runMissionReplay,compareReplay } from "../sim/missionReplay";
import { downloadJSON } from "../sim/storage";
import { PhysicsBadge } from "../components/instruments/PhysicsBadge";
export default function Showcase(){
  const g=useGame(),[status,setStatus]=useState(""),[busy,setBusy]=useState(false),[replay,setReplay]=useState(null);
  const verify=async()=>{
    setBusy(true);setStatus("Running the recorded command sequence through the flight simulator…");
    await new Promise(resolve=>setTimeout(resolve,30));
    try{
      const response=await fetch("/science/showcase-replay.json");if(!response.ok)throw Error("Replay file unavailable");
      const record=await response.json(),actual=runMissionReplay(record.spec);
      setReplay({...record,actual});
      setStatus(compareReplay(actual,record.reference)?`Verified · ${actual.outcome} · ${actual.commandsExecuted} commands · hash ${actual.hash}`:"Reference mismatch. Review model changes before presenting this recording.");
    }catch(e){setStatus(e.message);}finally{setBusy(false);}
  };
  return <div className="science-screen" data-testid="showcase-page"><header className="workflow-header"><button className="ui-button" onClick={()=>g.go("menu")}>← Home</button><strong>MissionForge · Guided showcase</strong></header>
    <main className="showcase-layout"><span className="science-kicker">A 5–7 minute presentation route</span><h1>Why reaching space is only half the job.</h1><p>Predict the speed needed for orbit, launch a real simulated rocket, and connect the result to NASA-derived gravity data.</p>
      <ol className="showcase-steps"><li><strong>1 · Predict</strong><p>Mission Lab → Predict & fly. Choose what holds a spacecraft in orbit and estimate its speed.</p></li><li><strong>2 · Fly</strong><p>Use the prepared First Orbit rocket, inspect readiness, launch with guidance and observe staging. Explain why sideways speed matters.</p></li><li><strong>3 · Explain</strong><p>Open the mission report, compare your prediction, then trace Earth’s μ to its pinned source.</p></li><li><strong>4 · Extend</strong><p>Flight engineering: double airspeed to demonstrate four times the dynamic pressure. Explore: plan and execute a two-burn transfer.</p></li></ol>
      <div className="showcase-actions"><button className="ui-button ui-button-primary" data-testid="showcase-begin" onClick={()=>g.go("science")}>Begin predict & fly</button><button className="ui-button" data-testid="showcase-verify" disabled={busy} onClick={verify}>{busy?"Replaying…":"Verify recorded First Orbit"}</button></div>
      <p role="status" data-testid="showcase-verification">{status}</p>{replay&&<button className="ui-button" onClick={()=>downloadJSON("mission-forge-replay.json",replay)}>Download commands & checkpoints</button>}
      <p>The verification reruns saved commands with the real FlightSim and compares canonical numerical checkpoints. It is an automated example, not a student flight or learning result.</p><PhysicsBadge />
      <div className="showcase-actions"><a className="ui-button" href="/submission/project-report.pdf" target="_blank" rel="noreferrer">Project report</a><a className="ui-button" href="/submission/presentation.html" target="_blank" rel="noreferrer">Presentation</a><a className="ui-button" href="/submission/showcase-replay.html" target="_blank" rel="noreferrer">Recorded flight graphs</a></div>
    </main></div>;
}
