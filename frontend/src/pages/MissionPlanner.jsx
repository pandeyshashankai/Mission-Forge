import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Rocket,
  Target,
  Users,
  Wallet,
  Clock,
  CheckCircle2,
  ChevronDown,
  Orbit,
  Moon,
  Satellite,
} from "lucide-react";
import { useGame } from "../game/GameContext";
import {
  MISSIONS,
  getMission,
  missionBudget,
  requiredDeltaV,
  DIFFICULTIES,
} from "../sim/missions";
import { LAUNCH_SITES } from "../sim/constants";
import { DEFAULT_PROFILE } from "../sim/guidance";
import { designStats } from "../sim/design";
import { PRESETS } from "../sim/presets";
import { MissionSteps } from "../components/app/MissionSteps";
import { DisplayButton } from "../components/app/Appearance";

const PRESENTATION = {
  first_orbit: {
    icon: Orbit,
    color: "cyan",
    level: "First flight",
    summary: "Turn a launch into a stable orbit around Earth.",
    time: "About 10 minutes",
    steps: [
      "Launch from Cape Canaveral",
      "Let guidance build your orbit",
      "Review your first flight report",
    ],
  },
  earth_observer: {
    icon: Satellite,
    color: "blue",
    level: "Next challenge",
    summary: "Deliver a satellite to its working orbit, 700 km above Earth.",
    time: "About 1–2 hours",
    steps: [
      "Reach a 200 km parking orbit",
      "Raise your orbit with two planned burns",
      "Deliver the observation satellite",
    ],
  },
  lunar_orbiter: {
    icon: Moon,
    color: "violet",
    level: "Deep space",
    summary:
      "Leave Earth behind and place a mapping spacecraft around the Moon.",
    time: "4–5 simulated days",
    steps: [
      "Launch into Earth parking orbit",
      "Plan a transfer and correct your course",
      "Brake into lunar orbit",
    ],
  },
  crewed_lunar_flyby: {
    icon: Users,
    color: "amber",
    level: "Crewed expedition",
    summary: "Take three explorers past the Moon and bring them safely home.",
    time: "8–10 simulated days",
    steps: [
      "Reach orbit with your crew",
      "Fly a lunar free-return trajectory",
      "Separate, re-enter, and splash down",
    ],
  },
};
const missionPresentation = (m) =>
  m.custom
    ? {
        ...PRESENTATION.first_orbit,
        level: "Custom challenge",
        summary: `Reach a ${m.target.altitude / 1000} km Earth orbit at ${m.target.inclination}° inclination.`,
        time: "Timing depends on your design",
        steps: [
          "Inspect the starting rocket and staging",
          `Reach the ${m.target.altitude / 1000} km target orbit`,
          "Check inclination and budget in your report",
        ],
      }
    : PRESENTATION[m.id] || PRESENTATION.first_orbit;
export default function MissionPlanner() {
  const g = useGame();
  const [sel, setSel] = useState(g.missionId);
  const m = getMission(sel) || getMission("first_orbit");
  const recommended = m.preset || (m.payload ? "orbiter9eo" : "orbiter9");
  const [preset, setPreset] = useState(recommended);
  const p = missionPresentation(m),
    Icon = p.icon;
  const req = requiredDeltaV(m);
  const selectedRocket = PRESETS.find((p) => p.id === preset);
  const rocketStats = useMemo(
    () => designStats(selectedRocket.make()),
    [selectedRocket],
  );
  const budget = missionBudget(m, g.difficulty);
  const overBudget = rocketStats.cost > budget;
  const start = () => {
    g.setMissionId(m.id);
    g.loadDesign(selectedRocket.make());
    g.setProfile({
      ...DEFAULT_PROFILE,
      targetAltitude: m.target.parkingAltitude ?? m.target.altitude,
      targetInclination: m.target.inclination,
    });
    g.go("hangar");
  };
  return (
    <div className="planner-screen">
      <header className="workflow-header">
        <button
          className="ui-button ui-button-quiet"
          data-testid="planner-back-btn"
          onClick={() => g.go("menu")}
        >
          <ArrowLeft size={16} /> Home
        </button>
        <MissionSteps current={0} />
        <DisplayButton compact />
      </header>
      <div className="planner-layout">
        <aside className="mission-picker">
          <div className="section-kicker">Choose your adventure</div>
          <h1>Where to next?</h1>
          <p>
            Every mission includes a starting rocket and optional flight
            guidance.
          </p>
          <div className="mission-cards">
            {MISSIONS.map((x, i) => {
              const c = missionPresentation(x),
                CardIcon = c.icon;
              return (
                <button
                  key={x.id}
                  className={`mission-card mission-${c.color} ${sel === x.id ? "is-selected" : ""}`}
                  data-testid={`mission-card-${x.id}`}
                  aria-pressed={sel === x.id}
                  disabled={!x.available}
                  onClick={() => {
                    setSel(x.id);
                    setPreset(
                      x.preset || (x.payload ? "orbiter9eo" : "orbiter9"),
                    );
                  }}
                >
                  <span className="mission-card-icon">
                    <CardIcon size={23} />
                  </span>
                  <span className="mission-card-copy">
                    <span>{c.level}</span>
                    <strong>{x.name}</strong>
                    <small>
                      {x.crewed ? "3 crew" : "Uncrewed"} · {c.time}
                    </small>
                  </span>
                  {sel === x.id ? (
                    <CheckCircle2 size={19} />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="planner-tip">
            <Clock size={16} />
            <p>
              Long trips do not mean long waits. Use time warp while coasting.
            </p>
          </div>
        </aside>
        <section className="mission-brief" data-testid="mission-details-panel">
          <div className={`mission-brief-hero mission-${p.color}`}>
            <span className="brief-orbit" aria-hidden="true" />
            <span className="mission-brief-icon">
              <Icon size={30} />
            </span>
            <span className="section-kicker">
              {p.level} · {DIFFICULTIES[g.difficulty].label}
            </span>
            <h2>{m.name}</h2>
            <p>{p.summary}</p>
          </div>
          <div className="mission-brief-body scroll-thin">
            <div className="mission-quickfacts">
              <div>
                <Target size={17} />
                <span>
                  {m.moon ? "Parking orbit" : "Target orbit"}
                  <strong data-testid="mission-target-orbit">
                    {(m.target.parkingAltitude ?? m.target.altitude) / 1000} km
                    · {m.target.inclination}°
                  </strong>
                </span>
              </div>
              <div>
                <Wallet size={17} />
                <span>
                  Mission budget
                  <strong data-testid="mission-budget">
                    ${missionBudget(m, g.difficulty)}M
                  </strong>
                </span>
              </div>
              <div>
                <Users size={17} />
                <span>
                  Flight crew
                  <strong>
                    {m.crewed ? "3 explorers" : "Remote spacecraft"}
                  </strong>
                </span>
              </div>
            </div>
            <h3>Your flight, in three steps</h3>
            <ol className="mission-flight-steps">
              {p.steps.map((step, i) => (
                <li key={step}>
                  <span>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="recommended-rocket">
              <Rocket size={24} />
              <div>
                <span className="section-kicker">
                  {preset === recommended
                    ? "Recommended rocket"
                    : "Your starting rocket"}
                </span>
                <strong>{selectedRocket.label.split(" — ")[0]}</strong>
                <p>
                  {preset === "empty"
                    ? "Start from a probe core and build your own vehicle."
                    : overBudget
                      ? `This rocket is $${(rocketStats.cost - budget).toFixed(1)}M over your ${DIFFICULTIES[g.difficulty].label} budget. Reduce its cost in the builder before launch.`
                      : "You can fly this design or customise it in the builder."}
                </p>
              </div>
              {preset === recommended && (
                <span
                  className={`ready-chip ${overBudget ? "is-over-budget" : ""}`}
                >
                  {overBudget ? "Over budget" : "Ready to customise"}
                </span>
              )}
            </div>
            <details className="ui-disclosure" data-testid="rocket-choices">
              <summary>
                Choose a different rocket <ChevronDown size={15} />
              </summary>
              <div className="rocket-options">
                {PRESETS.map((r) => (
                  <button
                    key={r.id}
                    data-testid={`preset-${r.id}-btn`}
                    aria-pressed={preset === r.id}
                    className={`ui-button ${preset === r.id ? "ui-button-selected" : ""}`}
                    onClick={() => setPreset(r.id)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </details>
            <details className="ui-disclosure">
              <summary>
                Mission objectives & engineering details{" "}
                <ChevronDown size={15} />
              </summary>
              <ol className="detailed-objectives">
                {m.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ol>
              <p data-testid="mission-dv-estimate">
                Required velocity change (Δv):{" "}
                {Math.round(req.value).toLocaleString()} m/s + {m.reserve * 100}
                % reserve.
              </p>
              <p>Launch site: {LAUNCH_SITES[m.site].name}</p>
              <ul>
                {m.constraints.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="ui-help">
                {m.inspiredBy}. Not affiliated with NASA.
              </p>
            </details>
          </div>
          <footer className="mission-brief-footer">
            <p>Next: make it yours in the rocket builder.</p>
            <button
              className="ui-button ui-button-primary"
              data-testid="planner-open-hangar-btn"
              onClick={start}
            >
              Build this rocket <ArrowRight size={17} />
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
