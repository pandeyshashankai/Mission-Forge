import { burnStatus } from "../../sim/burnStatus";
import { useEffect, useState } from "react";
import { planOrbitTransfer } from "../../sim/orbitPlanning";
const f = (n, d = 0) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
const phases = {
  burn1: "1 · First burn",
  coast: "2 · Coast to the far apsis",
  ready: "3 · Ready to circularize",
  burn2: "3 · Circularization burn",
  complete: "Transfer complete",
  cancelled: "Assistance cancelled",
};
export function ExplorationTransfer({
  sim,
  nav,
  onStart,
  onCircularize,
  onCancel,
}) {
  const [target, setTarget] = useState(400),
    [message, setMessage] = useState("");
  useEffect(() => {
    setTarget(
      Math.max(400, Math.round(sim.navigation().altitude / 1000 + 200)),
    );
    setMessage("");
  }, [nav.body.id, sim]);
  let plan = null,
    error = "";
  try {
    plan = planOrbitTransfer(sim, Number(target) * 1000);
  } catch (e) {
    error = e.message;
  }
  const active =
      sim.transfer &&
      ["burn1", "coast", "ready", "burn2"].includes(sim.transfer.phase),
    t = sim.transfer;
  const execution = burnStatus(sim);
  return (
    <details
      className="exploration-transfer"
      data-testid="explore-transfer-panel"
      open={Boolean(t) || undefined}
    >
      <summary>Orbit transfer · two-burn assistant</summary>
      <div className="transfer-content">
        {active ? (
          <>
            <strong data-testid="transfer-phase">{phases[t.phase]}</strong>
            {["burn1", "burn2"].includes(t.phase) && (
              <div className="burn-execution" data-testid="burn-execution">
                <label>Delivered {f(execution.delivered,1)} m/s<progress aria-label="Burn delivered" max="100" value={execution.progress} /></label>
                <dl><div><dt>Remaining Δv</dt><dd>{f(execution.remaining,1)} m/s</dd></div>
                <div><dt>Estimated time left</dt><dd>{f(execution.seconds,1)} s</dd></div>
                <div><dt>Fuel for this burn</dt><dd>{f(execution.burnFuel,1)} kg</dd></div>
                <div><dt>Fuel after this burn</dt><dd>{f(execution.fuelAfter,1)} kg</dd></div></dl>
                <small>Current burn only · full thrust · finite-burn estimate</small>
              </div>
            )}
            {t.phase === "coast" && (
              <p data-testid="transfer-coast-countdown">
                Circularization window in {f(Math.max(0, t.readyAt - sim.t))} s.
                Increase coast time speed to get there sooner; the simulation
                will hold at the window.
              </p>
            )}
            {t.phase === "ready" && (
              <>
                <p>
                  Time is held at the planned burn window. Confirm the second
                  burn, or cancel assistance and press Play for manual flight.
                </p>
                <button
                  className="ui-button ui-button-primary"
                  data-testid="transfer-circularize"
                  onClick={onCircularize}
                >
                  Start circularization burn
                </button>
              </>
            )}
            <button
              className="ui-button"
              data-testid="transfer-cancel"
              onClick={onCancel}
            >
              Cancel assistance · cut thrust
            </button>
          </>
        ) : (
          <>
            {t?.phase === "complete" && (
              <p className="transfer-complete" data-testid="transfer-complete">
                Achieved {f(t.actualPeriapsis / 1000, 1)} ×{" "}
                {f(t.actualApoapsis / 1000, 1)} km. This is the simulated
                result, not a guaranteed exact target.
              </p>
            )}
            <label htmlFor="transfer-target">Target orbit altitude (km)</label>
            <input
              id="transfer-target"
              data-testid="transfer-target"
              type="number"
              min="20"
              max="1000000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            {plan ? (
              <dl>
                <div><dt>Burn duration 1 / 2</dt><dd>{f(plan.burn1Seconds,1)} / {f(plan.burn2Seconds,1)} s</dd></div>
                <div><dt>Fuel after both burns</dt><dd>{f(sim.fuel-plan.fuel,1)} kg · 2% minimum reserve</dd></div>
                <div>
                  <dt>Burn 1 / burn 2</dt>
                  <dd>
                    {f(plan.burn1, 1)} / {f(plan.burn2, 1)} m/s
                  </dd>
                </div>
                <div>
                  <dt>Coast / propellant</dt>
                  <dd>
                    {f(plan.coastTime / 60, 1)} min / {f(plan.fuel, 1)} kg
                  </dd>
                </div>
              </dl>
            ) : (
              <p role="status">{error}</p>
            )}
            <button
              className="ui-button ui-button-primary"
              data-testid="transfer-start"
              disabled={!plan}
              onClick={() => {
                try {
                  onStart(Number(target) * 1000);
                  setMessage("");
                } catch (e) {
                  setMessage(e.message);
                }
              }}
            >
              Start first burn
            </button>
            <p role="alert">{message}</p>
          </>
        )}
        <p className="transfer-help">
          NASA GMAT’s two-burn workflow, using the current world’s μ.
          Near-circular, coplanar starts only. Estimates are impulsive; actual
          burns take time. Starting a burn enables attitude control. Steering,
          throttle, RCS, or burn-direction changes cancel assistance. Restoring
          a save disarms it.
        </p>
      </div>
    </details>
  );
}
