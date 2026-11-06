import { Check, ChevronRight } from "lucide-react";

export function MissionSteps({ current }) {
  return (
    <nav className="mission-steps" aria-label="Mission progress">
      {["Choose mission", "Build rocket", "Preflight check", "Fly"].map(
        (label, i) => (
          <span
            key={label}
            className={
              i === current ? "is-current" : i < current ? "is-complete" : ""
            }
            aria-current={i === current ? "step" : undefined}
          >
            <i>{i < current ? <Check size={12} /> : i + 1}</i>
            <span>{label}</span>
            {i < 3 && <ChevronRight size={13} />}
          </span>
        ),
      )}
    </nav>
  );
}
