import { localData } from "../persistence/localData";
import { EARTH } from "../sim/constants";
import { orbitFacts } from "./catalog";

export const LEARNING_QUESTION =
  "At 200 km above Earth, what keeps a spacecraft in orbit?";
export const PREDICTIONS = [
  {
    id: "sideways",
    label: "Enough sideways speed to keep falling around Earth",
  },
  { id: "height", label: "Reaching the right height is enough" },
  { id: "engine", label: "Keeping the engine on continuously" },
];
const KEY = "mf.learning-journal";
export function validPrediction(value) {
  return (
    !!value &&
    value.missionId === "first_orbit" &&
    typeof value.id === "string" &&
    value.id.length < 100 &&
    PREDICTIONS.some((p) => p.id === value.choice) &&
    Number.isFinite(value.expectedSpeed) &&
    value.expectedSpeed >= 0 &&
    value.expectedSpeed <= 20000
  );
}
export function makePrediction(choice, speed) {
  const prediction = {
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    missionId: "first_orbit",
    choice,
    expectedSpeed: Number(speed),
    at: new Date().toISOString(),
  };
  if (!validPrediction(prediction))
    throw new Error(
      "Choose an explanation and enter a speed between 0 and 20,000 m/s.",
    );
  return prediction;
}
export function buildLearningReview(result, prediction) {
  if (!validPrediction(prediction) || result.missionId !== prediction.missionId)
    return null;
  const targetSpeed = orbitFacts(EARTH, 200000).circularSpeed;
  const samples = (result.telemetry || []).filter(
    (row) => Number.isFinite(row.alt) && Number.isFinite(row.speed),
  );
  const nearest = samples.reduce(
    (best, row) =>
      !best || Math.abs(row.alt - 200) < Math.abs(best.alt - 200) ? row : best,
    null,
  );
  const reachedOrbit = result.summary?.peri >= 140000;
  const peak = samples.length ? Math.max(...samples.map((s) => s.alt)) : 0;
  const explanation = reachedOrbit
    ? "Your recorded periapsis stayed above the dense atmosphere: the spacecraft had enough sideways motion to keep falling around Earth. An unpowered spacecraft can coast in an ideal orbit."
    : peak >= 100
      ? "You reached space, but the recorded periapsis did not clear the atmosphere. Altitude alone was insufficient; build sideways speed and check periapsis before cutting thrust."
      : "This flight did not reach space. First address liftoff and staging using the report, then test how sideways speed changes the orbit.";
  return {
    prediction,
    question: LEARNING_QUESTION,
    targetSpeed,
    predictionError: Math.abs(prediction.expectedSpeed - targetSpeed),
    conceptCorrect: prediction.choice === "sideways",
    nearestSample: nearest
      ? { t: nearest.t, altitudeKm: nearest.alt, speed: nearest.speed }
      : null,
    reachedOrbit,
    explanation,
    reflection: "",
    recordedAt: result.at,
  };
}
export function readJournal() {
  try {
    const entries = JSON.parse(localData.getItem(KEY) || "[]");
    return Array.isArray(entries)
      ? entries
          .filter(
            (e) =>
              validPrediction(e?.prediction) &&
              typeof e?.explanation === "string",
          )
          .slice(0, 20)
          .map((entry) => ({
            ...entry,
            reflection:
              typeof entry.reflection === "string"
                ? entry.reflection.slice(0, 2000)
                : "",
          }))
      : [];
  } catch {
    return [];
  }
}
export function saveLearningReview(review, reflection = "") {
  if (!review || !validPrediction(review.prediction)) return false;
  try {
    const entry = { ...review, reflection: String(reflection).slice(0, 2000) };
    localData.setItem(
      KEY,
      JSON.stringify(
        [
          entry,
          ...readJournal().filter(
            (e) => e.prediction.id !== entry.prediction.id,
          ),
        ].slice(0, 20),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
