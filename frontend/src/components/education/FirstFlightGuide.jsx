import { useState } from "react";
import { useGame } from "../../game/GameContext";
import { activeAcademyFlight } from "../../features/education/academy";
import { localData } from "../../persistence/localData";
export function FirstFlightGuide() {
  const g = useGame(),
    [hidden, setHidden] = useState(false),
    session = activeAcademyFlight();
  if (
    hidden ||
    !session ||
    g.learningPrediction?.id !== session.predictionId ||
    g.missionId !== "first_orbit" ||
    !["review", "flight", "results"].includes(g.screen)
  )
    return null;
  const hint =
    g.screen === "review"
      ? "1 · Check the rocket. Review passed/advisory items, then proceed to the launch pad."
      : g.screen === "flight"
        ? "2 · Launch with guidance. After countdown, use ×10. Watch periapsis on the map, then complete the mission."
        : "3 · Inspect the debrief. Compare your prediction with the flight evidence and save an explanation.";
  return (
    <aside
      className="first-flight-guide"
      data-testid="first-flight-guide"
      aria-label="Optional first-flight guide"
    >
      <span>{hint}</span>
      <button
        className="ui-button ui-button-quiet"
        data-testid="first-flight-dismiss"
        onClick={() => {
          localData.removeItem("mf.academy-flight");
          setHidden(true);
        }}
      >
        Leave guide
      </button>
    </aside>
  );
}
