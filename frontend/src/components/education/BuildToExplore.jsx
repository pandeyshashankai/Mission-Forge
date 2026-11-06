import { useMemo, useState } from "react";
import { useGame } from "../../game/GameContext";
import { hangarCraft, explorationStarter } from "../../sim/hangarCraft";
import { ExplorationSim } from "../../sim/exploration";
import { FleetWorld } from "../../sim/advanced/fleetWorld";
import { localData } from "../../persistence/localData";
export function BuildToExplore() {
  const g = useGame(),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const compatibility = useMemo(() => {
    try {
      return { profile: hangarCraft(g.design) };
    } catch (e) {
      return { error: e.message };
    }
  }, [g.design]);
  const transfer = async () => {
    setBusy(true);
    try {
      const sim = new ExplorationSim("earth", "hangar", 0, 200000, {
        hangarDesign: compatibility.profile.design,
        power: true,
      });
      const world = new FleetWorld(sim);
      // Both records must replace the expedition together; a failed transaction
      // leaves the previous fleet and active state intact.
      await localData.importEntries([
        ["mf.exploration", JSON.stringify(sim.serialize())],
        ["mf.fleet-world", JSON.stringify(world.serialize())],
      ]);
      g.go("explore");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  const p = compatibility.profile;
  return (
    <details
      className="engineering-inspector"
      data-testid="build-to-exploration"
    >
      <summary>Fly this build in Exploration</summary>
      <p>
        Restricted single-stage adapter: uncrewed built-in parts, one liquid
        propellant, matching tanks and a battery. Your design stays editable in
        the Hangar.
      </p>
      {p ? (
        <>
          <dl>
            <div>
              <dt>Dry mass / fuel</dt>
              <dd data-testid="bridge-mass">
                {p.dryMass.toFixed(1)} / {p.fuel.toFixed(1)} kg
              </dd>
            </div>
            <div>
              <dt>Vacuum thrust / effective Isp</dt>
              <dd>
                {(p.thrust / 1000).toFixed(1)} kN / {p.isp.toFixed(2)} s
              </dd>
            </div>
            <div>
              <dt>Solar / battery</dt>
              <dd>
                {p.power.solarWatts} W / {p.power.batteryWh} Wh
              </dd>
            </div>
          </dl>
          <p>{p.notice}</p>
          <button
            className="ui-button"
            data-testid="bridge-prepare"
            onClick={() => setConfirm(true)}
          >
            Prepare Earth-orbit placement
          </button>
          {confirm && (
            <div role="group" aria-label="Confirm expedition replacement">
              <p>
                This replaces the saved exploration fleet with this full-fuel
                craft, paused at 200 km above Earth. Export the current
                expedition first if you need it. Placement is not a flown
                launch.
              </p>
              <button
                className="ui-button ui-button-primary"
                disabled={busy}
                data-testid="bridge-confirm"
                onClick={transfer}
              >
                Replace expedition & enter Exploration
              </button>
              <button className="ui-button" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p role="status" data-testid="bridge-incompatible">
            {compatibility.error}
          </p>
          <button
            className="ui-button"
            data-testid="bridge-starter"
            onClick={() => {
              g.setDesign(explorationStarter());
              setConfirm(false);
              setError("");
            }}
          >
            Load compatible single-stage example (undo available)
          </button>
        </>
      )}
      <p role="alert">{error}</p>
    </details>
  );
}
