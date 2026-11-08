import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ArrowRight,
  Rocket,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import { useGame } from "../game/GameContext";
import { runReadiness } from "../sim/readiness";
import { adviseDesign } from "../sim/advisor";
import { getMission } from "../sim/missions";
import { AdvisorPanel } from "../components/game/AdvisorPanel";
import { CalcDetail } from "../components/game/CalcDetail";
import { StatusBadge } from "../components/game/Status";
import { MissionSteps } from "../components/app/MissionSteps";
import { BodyScience } from "../components/science/BodyScience";
import { EARTH } from "../sim/constants";
import { PREDICTIONS } from "../science/learning";
import { DisplayButton } from "../components/app/Appearance";

export default function Readiness() {
  const g = useGame(),
    mission = getMission(g.missionId);
  const review = useMemo(
    () => runReadiness(g.design, mission, g.difficulty),
    [g.design, mission, g.difficulty],
  );
  const advice = useMemo(
    () => adviseDesign(g.design, review),
    [g.design, review],
  );
  const [open, setOpen] = useState(new Set());
  const [filter, setFilter] = useState("attention");
  const [confirm, setConfirm] = useState(false);
  const fail = review.checks.filter((c) => c.status === "fail").length,
    warn = review.checks.filter((c) => c.status === "warn").length,
    pass = review.checks.filter((c) => c.status === "pass").length;
  const nogo = fail > 0;
  const checks = (
    filter === "all" || (!fail && !warn)
      ? review.checks
      : review.checks.filter((c) => c.status === "fail" || c.status === "warn")
  )
    .slice()
    .sort(
      (a, b) =>
        ({ fail: 0, warn: 1, pass: 2, info: 3 })[a.status] -
        { fail: 0, warn: 1, pass: 2, info: 3 }[b.status],
    );
  const toggle = (id) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const reveal = (id) => {
    setFilter("all");
    setOpen((s) => new Set([...s, id]));
    setTimeout(
      () =>
        document
          .getElementById(`check-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  };
  return (
    <div className="review-screen">
      <header className="workflow-header">
        <button
          className="ui-button ui-button-quiet"
          data-testid="review-back-btn"
          onClick={() => g.go("hangar")}
        >
          <ArrowLeft size={16} /> Builder
        </button>
        <MissionSteps current={2} />
        <DisplayButton compact />
      </header>
      <main className="review-layout">
        <section className="review-main">
          <div
            className={`review-verdict ${nogo ? "has-blockers" : ""}`}
            data-testid="readiness-go-nogo-badge"
            data-status={review.overall}
          >
            <span className="review-verdict-icon">
              {nogo ? <Wrench size={28} /> : <ShieldCheck size={28} />}
            </span>
            <div>
              <span className="section-kicker">
                Preflight check · {mission.name}
              </span>
              <h1>{nogo ? "A few things to fix." : "Your rocket is ready."}</h1>
              <p>
                {nogo
                  ? `${fail} ${fail === 1 ? "issue needs" : "issues need"} attention before a safe launch.`
                  : warn
                    ? `${warn} ${warn === 1 ? "advisory" : "advisories"} to review. Nothing is blocking your flight.`
                    : "All checks passed. Guidance can handle your ascent."}
              </p>
            </div>
          </div>
          <div className="review-summary">
            <span>
              <CheckCircle2 size={16} />
              <strong>{pass}</strong> Passed
            </span>
            <span>
              <AlertTriangle size={16} />
              <strong>{warn}</strong> Advisories
            </span>
            <span>
              <Wrench size={16} />
              <strong>{fail}</strong> To fix
            </span>
          </div>
          <div className="review-filter">
            <h2>Rocket checks</h2>
            <div>
              <button
                aria-pressed={filter === "attention"}
                data-testid="checks-attention"
                onClick={() => setFilter("attention")}
              >
                Needs attention
              </button>
              <button
                aria-pressed={filter === "all"}
                data-testid="checks-all"
                onClick={() => setFilter("all")}
              >
                All checks ({review.checks.length})
              </button>
            </div>
          </div>
          <div
            className="readiness-list scroll-thin"
            data-testid="readiness-checks"
          >
            {checks.map((c) => (
              <article
                key={c.id}
                id={`check-${c.id}`}
                className={`readiness-check status-${c.status}`}
              >
                <div className="readiness-check-top">
                  <h3>{c.subsystem}</h3>
                  <StatusBadge
                    status={c.status}
                    testId={`check-status-${c.id}`}
                  />
                </div>
                <p data-testid={`check-summary-${c.id}`}>{c.summary}</p>
                {c.calc && (
                  <>
                    <button
                      className="calculation-toggle"
                      data-testid={`check-row-${c.id}`}
                      aria-expanded={open.has(c.id)}
                      onClick={() => toggle(c.id)}
                    >
                      {open.has(c.id)
                        ? "Hide calculation"
                        : "How is this calculated?"}
                      <ChevronDown size={14} />
                    </button>
                    {open.has(c.id) && (
                      <div className="check-calculation">
                        <CalcDetail
                          calc={c.calc}
                          testId={`check-calc-${c.id}`}
                        />
                      </div>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
        <aside className="review-next">
          {g.learningPrediction?.missionId === mission.id && (
            <div
              className="learning-brief"
              data-testid="learning-prediction-saved"
            >
              <strong>Your prediction is saved</strong>
              <p>
                {
                  PREDICTIONS.find((p) => p.id === g.learningPrediction.choice)
                    ?.label
                }{" "}
                · {g.learningPrediction.expectedSpeed.toLocaleString()} m/s.
              </p>
              <p>
                Launch, reach orbit, then complete the mission to compare your
                estimate with flight evidence.
              </p>
            </div>
          )}
          <div className="review-launch-card">
            <span className="section-kicker">Next stop: launch pad</span>
            <h2>{g.design.name}</h2>
            <p>
              Check your guidance settings, then start the countdown when you
              are ready.
            </p>
            <button
              data-testid="proceed-to-launch-btn"
              className="ui-button ui-button-primary"
              disabled={nogo}
              onClick={() => g.go("flight")}
            >
              <Rocket size={17} /> Go to launch pad <ArrowRight size={17} />
            </button>
            {nogo && (
              <>
                <button
                  data-testid="launch-anyway-btn"
                  disabled={!g.design.stack.length}
                  className="test-flight-link"
                  onClick={() => setConfirm((v) => !v)}
                >
                  I want to test-fly this design anyway
                </button>
                {confirm && (
                  <div className="test-flight-confirm">
                    <p>
                      The highlighted issues may prevent liftoff or a successful
                      mission.
                    </p>
                    <button
                      className="ui-button"
                      data-testid="launch-anyway-confirm-btn"
                      disabled={!g.design.stack.length}
                      onClick={() => g.go("flight")}
                    >
                      Launch with known issues
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <BodyScience body={{ ...EARTH, id: "earth" }} />
          <div className="review-advice">
            <AdvisorPanel items={advice} onRef={reveal} />
          </div>
        </aside>
      </main>
    </div>
  );
}
