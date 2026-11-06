import { downloadJSON } from "../../sim/storage";
import { useState } from "react";
import { PLANETS, BODY_BY_ID, bodyState, DAY } from "../../sim/solarSystem";
import { lambert } from "../../sim/advanced/lambert";
import { len, sub } from "../../sim/vec";
export function TransferWindows() {
  const [from, setFrom] = useState("earth"),
    [to, setTo] = useState("mars"),
    [start, setStart] = useState(0),
    [grid, setGrid] = useState(null),
    [selected, setSelected] = useState(null),
    [error, setError] = useState("");
  const calculate = () => {
    try {
      if (from === to) throw Error("Choose different planets.");
      const a = BODY_BY_ID[from],
        b = BODY_BY_ID[to],
        mu = BODY_BY_ID.sun.mu,
        hohmann = (Math.PI * Math.sqrt(((a.a + b.a) / 2) ** 3 / mu)) / DAY;
      const cells = [];
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 12; col++) {
          const departureDay = Number(start) + col * 30,
            duration = hohmann * (0.65 + row * 0.14),
            first = bodyState(from, departureDay * DAY),
            last = bodyState(to, (departureDay + duration) * DAY);
          try {
            const solution = lambert(first.r, last.r, duration * DAY, mu),
              departure = len(sub(solution.departureVelocity, first.v)),
              arrival = len(sub(last.v, solution.arrivalVelocity));
            cells.push({
              row,
              col,
              departureDay,
              duration,
              departure,
              arrival,
              cost: departure + arrival,
            });
          } catch {
            cells.push({ row, col, departureDay, duration, cost: null });
          }
        }
      const feasible = cells.filter((c) => c.cost !== null);
      if (!feasible.length) throw Error("No feasible cells in this grid.");
      const best = feasible.reduce((a, b) => (a.cost < b.cost ? a : b));
      setGrid({
        cells,
        best,
        min: best.cost,
        max: Math.max(...feasible.map((c) => c.cost)),
      });
      setSelected(best);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section data-testid="transfer-windows">
      <h2>Interplanetary transfer windows</h2>
      <p>
        A zero-revolution Lambert solver compares heliocentric departure and
        arrival velocity changes. Fixed Kepler planet positions; no launch,
        parking-orbit escape, capture, drag or fuel losses included.
      </p>
      <div className="sandbox-form">
        <label>
          Departure
          <select
            data-testid="window-from"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setGrid(null);
            }}
          >
            {PLANETS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Arrival
          <select
            data-testid="window-to"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setGrid(null);
            }}
          >
            {PLANETS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start day after J2000
          <input
            type="number"
            min="0"
            max="365250"
            value={start}
            onChange={(e) => {
              setStart(
                Math.max(0, Math.min(365250, Number(e.target.value) || 0)),
              );
              setGrid(null);
            }}
          />
        </label>
      </div>
      <button
        className="ui-button ui-button-primary"
        data-testid="window-calculate"
        onClick={calculate}
      >
        Calculate 84 transfer options
      </button>
      <p role="status">{error}</p>
      {grid && (
        <>
          <p>
            Columns: departure in 30-day increments. Rows: flight time, shortest
            at top. Lower cost is brighter. Choose a cell for the two burns.
          </p>
          <div
            className="transfer-heatmap"
            role="group"
            aria-label="Departure date and flight time grid"
          >
            {grid.cells.map((c) => (
              <button
                key={`${c.row}-${c.col}`}
                disabled={c.cost === null}
                style={{
                  background:
                    c.cost === null
                      ? "#30343d"
                      : `hsl(${190 - ((c.cost - grid.min) / Math.max(1, grid.max - grid.min)) * 160} 65% ${c === selected ? 30 : 28 - ((c.cost - grid.min) / Math.max(1, grid.max - grid.min)) * 14}%)`,
                }}
                aria-label={`Day ${c.departureDay}, ${c.duration.toFixed(0)} day flight, ${c.cost === null ? "no solution" : `${(c.cost / 1000).toFixed(2)} kilometres per second`}`}
                onClick={() => setSelected(c)}
              >
                {c.cost === null ? "—" : (c.cost / 1000).toFixed(1)}
              </button>
            ))}
          </div>
          <button
            className="ui-button"
            onClick={() =>
              downloadJSON("mission-forge-transfer-grid.json", {
                model: "zero-revolution heliocentric Lambert",
                departure: from,
                arrival: to,
                units: { days: "since J2000", velocity: "m/s" },
                ...grid,
              })
            }
          >
            Export transfer grid
          </button>
          <p data-testid="window-result">
            Day {selected.departureDay} → day{" "}
            {(selected.departureDay + selected.duration).toFixed(1)} ·{" "}
            {selected.duration.toFixed(1)} day coast · departure{" "}
            {(selected.departure / 1000).toFixed(3)} km/s · arrival{" "}
            {(selected.arrival / 1000).toFixed(3)} km/s.
          </p>
        </>
      )}
    </section>
  );
}
