import { useState } from "react";
import {
  PREDICTIONS,
  readJournal,
  saveLearningReview,
} from "../../science/learning";

export function LearningReview({ review, onSave }) {
  const [reflection, setReflection] = useState(
    () =>
      readJournal().find((e) => e.prediction.id === review.prediction.id)
        ?.reflection || "",
  );
  const [saved, setSaved] = useState("");
  return (
    <section
      className="science-card learning-review"
      data-testid="learning-review"
    >
      <span className="science-kicker">Predict → fly → explain</span>
      <h2>What did your mission teach you?</h2>
      <p>
        <strong>Your prediction:</strong>{" "}
        {PREDICTIONS.find((p) => p.id === review.prediction.choice)?.label};{" "}
        {Math.round(review.prediction.expectedSpeed).toLocaleString()} m/s.
      </p>
      <p>
        <strong>Two-body reference:</strong>{" "}
        {Math.round(review.targetSpeed).toLocaleString()} m/s at 200 km. Your
        estimate differs by{" "}
        {Math.round(review.predictionError).toLocaleString()} m/s.{" "}
        {review.conceptCorrect
          ? "Your explanation identified sideways motion."
          : "Compare your explanation with the recorded orbit below."}
      </p>
      <p data-testid="learning-flight-explanation">{review.explanation}</p>
      {review.nearestSample ? (
        <p>
          Nearest recorded sample to 200 km:{" "}
          {review.nearestSample.altitudeKm.toFixed(1)} km,{" "}
          {Math.round(review.nearestSample.speed).toLocaleString()} m/s at T+
          {Math.round(review.nearestSample.t)} s. This is a sampled inertial
          speed, not necessarily a circular orbit or a purely horizontal speed.
        </p>
      ) : (
        <p>
          No usable flight samples were recorded; no measured speed comparison
          is available.
        </p>
      )}
      <label htmlFor="learning-reflection">
        What would you change on your next flight?
      </label>
      <textarea
        id="learning-reflection"
        data-testid="learning-reflection"
        maxLength={2000}
        value={reflection}
        onChange={(e) => {
          setReflection(e.target.value);
          setSaved("");
        }}
        placeholder="Use a flight observation to explain your next decision."
      />
      <button
        className="ui-button"
        data-testid="learning-save-reflection"
        onClick={() => {
          const success = saveLearningReview(review, reflection);
          onSave?.({ ...review, reflection });
          setSaved(
            success
              ? "Saved to your local learning journal."
              : "Could not save locally. Export your results to keep a copy.",
          );
        }}
      >
        Save reflection
      </button>
      <p role="status">{saved}</p>
    </section>
  );
}
