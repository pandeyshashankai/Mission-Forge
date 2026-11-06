import { dockingGeometry } from "../../sim/advanced/docking";
import { useState } from "react";
import { EXPLORERS } from "../../sim/exploration";
import { downloadJSON } from "../../sim/storage";
export function FleetPanel({ world, onSwitch, onCreate, onUpdate }) {
  const [craft, setCraft] = useState("pathfinder"),
    [target, setTarget] = useState(""),
    [fuel, setFuel] = useState(100),
    [error, setError] = useState("");
  const relative = world.relative(target),
    linked = world.links.find((l) => l[0] === world.activeId);
  const run = (fn) => {
    try {
      fn();
      setError("");
      onUpdate();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <details className="engineering-inspector" data-testid="fleet-panel">
      <summary>Local fleet · rendezvous & docking</summary>
      <p>
        Up to six persistent vessels, all stored on this device. Parked vessels
        coast with synchronized simulation time.
      </p>
      <label className="simulation-option">Convex mesh fracture & debris contacts<input data-testid="mesh-fracture-toggle" type="checkbox" checked={world.meshFracture===true} onChange={e=>run(()=>world.setMeshFracture(e.target.checked))}/></label><p>Splits the assumed closed hull into eight convex pieces; conserves mass and initial momentum with prescribed fracture energy. This is not a calibrated material/fracture law. Close contacts limit achieved warp.</p>
      <label className="simulation-option">
        Port geometry docking
        <input
          type="checkbox"
          checked={world.strictDocking}
          onChange={(e) =>
            run(() => {
              world.strictDocking = e.target.checked;
            })
          }
        />
      </label>
      <label className="simulation-option">
        Vessel collision damage
        <input
          type="checkbox"
          checked={world.collisions}
          onChange={(e) =>
            run(() => {
              world.setCollisions(e.target.checked);
            })
          }
        />
      </label>
      {world.strictDocking &&
        target &&
        world.entries.some((e) => e.id === target) && (
          <p>
            Port gap{" "}
            {dockingGeometry(
              world.active,
              world.entries.find((e) => e.id === target).sim,
            ).gap.toFixed(2)}{" "}
            m · axes{" "}
            {dockingGeometry(
              world.active,
              world.entries.find((e) => e.id === target).sim,
            ).axisDegrees.toFixed(1)}
            °. Ports are 3 m along each craft's nose; manually oppose their
            axes. Hull collision uses a swept 2 m radius sphere per vehicle.
          </p>
        )}
      <label className="simulation-option">
        Rigid-body hull contacts
        <input
          type="checkbox"
          checked={world.rigidContacts}
          onChange={(e) =>
            run(() => {
              world.setRigidContacts(e.target.checked);
            })
          }
        />
      </label>
      {world.rigidContacts && (
        <p>
          Oriented box hulls; finite inertia, spin, normal impulses and Coulomb
          friction. Attitude control applies bounded 200 Nm torque. Contact mode
          limits each world advance to 0.02 s. Disable RCS to observe free
          rotation. Structural hull deformation is not simulated.
        </p>
      )}
      <div className="fleet-list">
        {world.entries.map((e) => (
          <button
            key={e.id}
            className="ui-button"
            aria-pressed={e.id === world.activeId}
            disabled={world.hostIds.has(e.id)}
            onClick={() => run(() => onSwitch(e.id))}
          >
            {e.name}
            {world.hostIds.has(e.id) ? " · docked" : ""}
          </button>
        ))}
      </div>
      <label className="simulation-option">
        Companion
        <select
          data-testid="fleet-craft"
          value={craft}
          onChange={(e) => setCraft(e.target.value)}
        >
          {EXPLORERS.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="ui-button"
        data-testid="fleet-create"
        disabled={world.entries.length >= 6}
        onClick={() =>
          run(() => {
            const entry = onCreate(craft);
            if (entry) setTarget(entry.id);
          })
        }
      >
        Create nearby companion
      </button>
      <p>
        Companions are sandbox placements 100 m away with matching inertial
        velocity; no fuel or time is granted to existing vessels.
      </p>
      <label className="simulation-option">
        Target
        <select
          aria-label="Fleet target"
          data-testid="fleet-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Choose vessel</option>
          {world.entries
            .filter((e) => e.id !== world.activeId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      {relative && (
        <p data-testid="fleet-relative">
          Separation {relative.distance.toFixed(1)} m · relative speed{" "}
          {relative.speed.toFixed(3)} m/s · time lag {relative.lag.toFixed(2)} s
        </p>
      )}
      <div className="showcase-actions">
        <button
          className="ui-button"
          data-testid="fleet-approach"
          disabled={!target}
          onClick={() => run(() => world.startApproach(target))}
        >
          Assist rendezvous
        </button>
        <button
          className="ui-button"
          data-testid="fleet-dock"
          disabled={!target}
          onClick={() => run(() => world.dock(target))}
        >
          Dock
        </button>
        <button
          className="ui-button"
          data-testid="fleet-undock"
          disabled={!linked}
          onClick={() => run(() => world.undock())}
        >
          Undock
        </button>
      </div>
      {linked && (
        <>
          <label>
            Fuel amount (kg)
            <input
              className="subassembly-name"
              aria-label="Fuel transfer kilograms"
              type="number"
              min="1"
              value={fuel}
              onChange={(e) => setFuel(Number(e.target.value))}
            />
          </label>
          <div className="showcase-actions">
            <button
              className="ui-button"
              data-testid="fleet-receive"
              onClick={() => run(() => world.transferFuel(linked[1], fuel))}
            >
              Receive fuel
            </button>
            <button
              className="ui-button"
              data-testid="fleet-send"
              onClick={() => run(() => world.transferFuel(linked[1], -fuel))}
            >
              Send fuel
            </button>
          </div>
        </>
      )}
      <button
        className="ui-button"
        disabled={!target || world.links.some((l) => l.includes(target))}
        onClick={() =>
          run(() => {
            world.remove(target);
            setTarget("");
          })
        }
      >
        Remove selected parked vessel
      </button>
      <p role="status">{error || world.message}</p>
      <p>
        Docking captures free vessels within 25 m and 0.5 m/s; orientation and
        collision geometry are simplified. Joined dry/cargo mass and momentum
        affect flight. Rendezvous assistance uses real thrust and propellant;
        manual input cancels it.
      </p>
      <button
        className="ui-button"
        onClick={() =>
          downloadJSON("mission-forge-fleet.json", world.serialize())
        }
      >
        Export local fleet
      </button>
    </details>
  );
}
