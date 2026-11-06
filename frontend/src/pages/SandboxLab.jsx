import {OceanLoadingLab} from '../components/milestones/OceanLoadingLab';
import {FractureLab} from '../components/milestones/FractureLab';
import {FullEngineLab} from '../components/milestones/FullEngineLab';
import {PerformanceLab} from "../components/sandbox/PerformanceLab";
import { ThermalBench } from "../components/sandbox/ThermalBench";
import { useState } from "react";
import { useGame } from "../game/GameContext";
import { TransferWindows } from "../components/sandbox/TransferWindows";
import { ThreeBodyLab } from "../components/sandbox/ThreeBodyLab";
import { FrameLab } from "../components/sandbox/FrameLab";
import { LocalContentEditor } from "../components/sandbox/LocalContentEditor";
export default function SandboxLab() {
  const g = useGame(),
    [tab, setTab] = useState("transfers");
  return (
    <div className="science-screen" data-testid="sandbox-lab">
      <header className="workflow-header">
        <button className="ui-button" onClick={() => g.go("menu")}>
          ← Home
        </button>
        <strong>MissionForge · Sandbox laboratory</strong>
      </header>
      <main className="showcase-layout">
        <span className="science-kicker">Your own mission laboratory</span>
        <h1>Plan, investigate, and build new worlds.</h1>
        <nav className="sandbox-tabs" aria-label="Sandbox tools">
          {[
            ["transfers", "Transfer windows"],
            ["loading","Station ocean loading"],
            ["fracture","Mesh fracture"],
            ["engine","Full Wasm engine"],
            ["threebody", "Three-body flight"],
            ["frames", "Reference frames"],
            ["thermal", "Arc-jet materials"],
            ["performance","Compute & rendering"],
            ["worlds", "Worlds & data packs"],
          ].map(([id, label]) => (
            <button
              key={id}
              className="ui-button"
              data-testid={`sandbox-tab-${id}`}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sandbox-surface">
          {tab === "transfers" && <TransferWindows />}
          {tab === "loading" && <OceanLoadingLab/>}
          {tab === "fracture" && <FractureLab/>}
          {tab === "engine" && <FullEngineLab/>}
          {tab === "threebody" && <ThreeBodyLab />}
          {tab === "frames" && <FrameLab />}
          {tab === "thermal" && <ThermalBench />}
        {tab === "performance" && <PerformanceLab/>}
          {tab === "worlds" && (
            <LocalContentEditor onExplore={() => g.go("explore")} />
          )}
        </div>
      </main>
    </div>
  );
}
