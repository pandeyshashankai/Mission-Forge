import { useState } from "react";
import {
  loadingDisplacement,
  parseBLQ,
  loadingModel,
  validateLoadingStation,
} from "../../sim/advanced/oceanLoading";
import bundled from "../../science/data/loading-stations.json";
import { downloadJSON } from "../../sim/storage";
const epoch = Date.UTC(2000, 0, 1, 12);
export function OceanLoadingLab() {
  const [stations, setStations] = useState(bundled.stations),
    [selected, setSelected] = useState(0),
    [date, setDate] = useState("2009-06-25T01:10:45"),
    [offset, setOffset] = useState(66.184),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  const station = stations[selected];
  const run = () => {
    try {
      if (!date) throw Error("Enter a UT1 calendar value.");
      const seconds = (Date.parse(date + "Z") - epoch) / 1000;
      const rows = Array.from({ length: 25 }, (_, i) =>
        loadingDisplacement(station, seconds + i * 3600, Number(offset)),
      );
      setResult({
        kind: "missionforge-station-ocean-loading",
        version: 1,
        station: validateLoadingStation(station),
        startUt1: date,
        ttMinusUt1: Number(offset),
        rows,
        source: loadingModel.sourceUrl,
        sourceCommit: loadingModel.commit,
        notice:
          "Complete 342-constituent station admittance response for the supplied BLQ coefficients. This is not a global ocean-height atlas, live EOP service or a higher-degree gravity coefficient pack.",
      });
      setError("");
    } catch (e) {
      setResult(null);
      setError(e.message);
    }
  };
  return (
    <section data-testid="ocean-loading-lab">
      <h2>Ocean loading · 342 constituents</h2>
      <p>
        Predict station displacement from the eleven BLQ main tides and
        342-constituent frequency-dependent admittance model. This is separate
        from the degree-eight ocean-gravity option.
      </p>
      <div className="education-inputs">
        <label>
          Station
          <select
            data-testid="loading-station"
            value={selected}
            onChange={(e) => {
              setSelected(Number(e.target.value));
              setResult(null);
            }}
          >
            {stations.map((s, i) => (
              <option key={i} value={i}>
                {s.name}
                {s.geographyWarning ? " · reference coordinates only" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          UT1 calendar value
          <input
            data-testid="loading-date"
            type="datetime-local"
            step="1"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setResult(null);
            }}
          />
        </label>
        <label>
          TT minus UT1 (seconds)
          <input
            data-testid="loading-offset"
            type="number"
            value={offset}
            onChange={(e) => {
              setOffset(e.target.value);
              setResult(null);
            }}
          />
        </label>
      </div>
      <p>
        Time inputs are explicit assumptions; the application does not fetch
        live Earth-orientation observations. BLQ amplitudes are metres and
        positive lag phases are degrees; outputs use up, south and west.
      </p>
      {station.geographyWarning && (
        <p role="note">{station.geographyWarning}</p>
      )}
      <div className="showcase-actions">
        <button
          className="ui-button ui-button-primary"
          data-testid="loading-run"
          onClick={run}
        >
          Compute one day of loading
        </button>
        <label className="ui-button">
          Import BLQ stations
          <input
            data-testid="loading-import"
            type="file"
            accept=".blq,.txt"
            onChange={async (e) => {
              const f = e.target.files[0];
              e.target.value = "";
              if (!f) return;
              try {
                if (f.size > 250000) throw Error("BLQ file exceeds 250 kB.");
                setStations(parseBLQ(await f.text()));
                setSelected(0);
                setResult(null);
                setError("");
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        </label>
        <a className="ui-button" href="/science/ocean-loading.blq" download>
          Reference BLQ
        </a>
      </div>
      <p role="alert">{error}</p>
      {result && (
        <div className="science-card" data-testid="loading-result">
          <p>
            At the first epoch: up {(result.rows[0].up * 1000).toFixed(4)} mm ·
            south {(result.rows[0].south * 1000).toFixed(4)} mm · west{" "}
            {(result.rows[0].west * 1000).toFixed(4)} mm. All 342 constituents
            included.
          </p>
          <div className="education-table">
            <table>
              <thead>
                <tr>
                  <th>Hours</th>
                  <th>Up (mm)</th>
                  <th>South (mm)</th>
                  <th>West (mm)</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{i}</td>
                    <td>{(r.up * 1000).toFixed(4)}</td>
                    <td>{(r.south * 1000).toFixed(4)}</td>
                    <td>{(r.west * 1000).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{result.notice}</p>
          <a href={loadingModel.sourceUrl} target="_blank" rel="noreferrer">
            Pinned source and original notices
          </a>
          <button
            className="ui-button"
            data-testid="loading-export"
            onClick={() =>
              downloadJSON("missionforge-ocean-loading.json", result)
            }
          >
            Export station, coefficients & results
          </button>
        </div>
      )}
    </section>
  );
}
