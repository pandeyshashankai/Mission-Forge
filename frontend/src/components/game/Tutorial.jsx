import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Interactive tutorials: each step points at a real control and advances when the player uses it.
export const TUTORIALS = {
  first_orbit: {
    title: "First Orbit",
    steps: [
      { target: "menu-new-mission-btn", text: "Start here: open the Mission Planner." },
      { target: "mission-card-first_orbit", text: "Pick the First Orbit mission — a 200 km orbit from Cape Canaveral." },
      { target: "planner-open-hangar-btn", text: "Open the hangar with the suggested preset rocket." },
      { target: "hangar-stats-bar", text: "These numbers are computed live from the parts: total Δv (rocket equation) and liftoff thrust-to-weight. Click the bar to continue.", passive: true },
      { target: "open-readiness-btn", text: "Run the Readiness Review — every check shows its formula and inputs." },
      { target: "proceed-to-launch-btn", text: "If the review says GO, proceed to the launch pad." },
      { target: "start-countdown-btn", text: "Start the countdown. The guidance computer flies the ascent; watch apoapsis and periapsis rise in the Orbit panel." },
    ],
  },
  maneuvers: {
    title: "Orbital maneuvers",
    steps: [
      { target: "camera-map-btn", text: "In orbit, open the Map view (or press M) to see your orbit and plan burns." },
      { target: "node-suggest-raise-btn", text: "Ask for a suggested burn: the vis-viva equation gives the Δv to raise the opposite side of the orbit." },
      { target: "node-execute-btn", text: "Execute: the craft turns to the burn direction and fires, centred on the node time." },
      { target: "time-warp-100", text: "Use time warp to reach the node — warp drops automatically before the burn." },
    ],
  },
};

const KEY = "mf.tutorial";
export const startTutorial = (id) => {
  localStorage.setItem(KEY, JSON.stringify({ id, step: 0 }));
  window.dispatchEvent(new Event("mf-tutorial"));
};

export function TutorialOverlay() {
  const [st, setSt] = useState(() => JSON.parse(localStorage.getItem(KEY) || "null"));
  const [rect, setRect] = useState(null);
  const tut = st && TUTORIALS[st.id];
  const step = tut && tut.steps[st.step];
  const save = (v) => {
    setSt(v);
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  };
  useEffect(() => {
    const on = () => setSt(JSON.parse(localStorage.getItem(KEY) || "null"));
    window.addEventListener("mf-tutorial", on);
    return () => window.removeEventListener("mf-tutorial", on);
  }, []);
  useEffect(() => {
    if (!step) return undefined;
    const iv = setInterval(() => {
      const el = document.querySelector(`[data-testid="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    }, 250);
    const click = (e) => {
      if (e.target.closest && e.target.closest(`[data-testid="${step.target}"]`)) {
        const next = st.step + 1;
        save(next >= tut.steps.length ? null : { ...st, step: next });
      }
    };
    document.addEventListener("click", click, true);
    return () => {
      clearInterval(iv);
      document.removeEventListener("click", click, true);
    };
  }, [st, step, tut]);
  if (!step) return null;
  const pos = rect ? { left: Math.min(window.innerWidth - 340, Math.max(8, rect.left)), top: rect.bottom + 10 > window.innerHeight - 140 ? Math.max(8, rect.top - 130) : rect.bottom + 10 } : { right: 16, top: 70 };
  return (
    <>
      {rect && <div className="pointer-events-none fixed z-[60] rounded-sm border-2 border-amber-400 shadow-[0_0_0_4000px_rgba(0,0,0,0.35)] transition-all" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} data-testid="tutorial-highlight" />}
      <div className="panel fixed z-[61] w-80 rounded-sm border-amber-500/60 p-3" style={pos} data-testid="tutorial-hint">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-amber-300">Tutorial · {tut.title} · {st.step + 1}/{tut.steps.length}</span>
          <button data-testid="tutorial-close-btn" onClick={() => save(null)} className="text-slate-500 hover:text-white"><X size={14} /></button>
        </div>
        <p className="mt-1 text-sm text-slate-200" data-testid="tutorial-text">{step.text}</p>
        {!rect && <p className="mt-1 text-[11px] text-slate-500">Go to the screen that shows this control to continue.</p>}
        <button data-testid="tutorial-skip-btn" onClick={() => save(st.step + 1 >= tut.steps.length ? null : { ...st, step: st.step + 1 })} className="mt-2 font-mono text-[10px] uppercase text-slate-400 hover:text-white">Skip step →</button>
      </div>
    </>
  );
}
