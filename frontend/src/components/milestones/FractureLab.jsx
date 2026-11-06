import { useState } from "react";
import { fractureHull, validateMesh } from "../../sim/advanced/meshFracture";
import { downloadJSON, readJSONFile } from "../../sim/storage";
import { add, scale, cross } from "../../sim/vec";
export function FractureLab() {
  const [count, setCount] = useState(8),
    [energy, setEnergy] = useState(200),
    [hull, setHull] = useState(null),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  const run = () => {
    try {
      const initial = {
          r: [0, 0, 0],
          v: [0, 0, 0],
          mass: 100,
          q: [0, 0, 0, 1],
          L: [10, 20, 30],
          half: [1.5, 3, 1.5],
          count: Number(count),
          energy: Number(energy),
          ...(hull ? { hull } : {}),
        },
        fragments = fractureHull(initial),
        mass = fragments.reduce((s, f) => s + f.mass, 0),
        momentum = fragments.reduce(
          (s, f) => add(s, scale(f.v, f.mass)),
          [0, 0, 0],
        ),
        angular = fragments.reduce(
          (s, f) => add(s, add(f.L, cross(f.r, scale(f.v, f.mass)))),
          [0, 0, 0],
        );
      setResult({
        version: 1,
        kind: "missionforge-convex-fracture",
        initial,
        fragments,
        mass,
        momentum,
        angularMomentum: angular,
        notice:
          "Closed convex physical hull, uniform density, prescribed fracture energy. This is not part-level material calibration, crack propagation or arbitrary concave mesh fracture.",
      });
      setError("");
    } catch (e) {
      setResult(null);
      setError(e.message);
    }
  };
  const project = (v) => [
    280 + 36 * (v[0] + v[2] * 0.4),
    140 - 25 * (v[1] + v[2] * 0.25),
  ];
  return (
    <section data-testid="fracture-lab">
      <h2>Convex mesh fracture & contacts</h2>
      <p>
        Split the physical hull with deterministic cut planes. Closed caps, mass
        centroids and full inertia tensors determine the resulting pieces.
        Gameplay enables this under Fleet → Convex mesh fracture.
      </p>
      <div className="education-inputs">
        <label>
          Pieces
          <select
            data-testid="fracture-count"
            value={count}
            onChange={(e) => {
              setCount(e.target.value);
              setResult(null);
            }}
          >
            {[2, 4, 8].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Prescribed separation energy (J)
          <input
            data-testid="fracture-energy"
            type="number"
            min="0"
            max="10000"
            value={energy}
            onChange={(e) => {
              setEnergy(e.target.value);
              setResult(null);
            }}
          />
        </label>
      </div>
      <label className="ui-button">
        Import a closed convex triangle hull
        <input
          data-testid="fracture-import"
          type="file"
          accept=".json"
          onChange={async (e) => {
            const f = e.target.files[0];
            e.target.value = "";
            if (!f) return;
            try {
              if (f.size > 250000) throw Error("Hull exceeds 250 kB.");
              const mesh = await readJSONFile(f);
              validateMesh(mesh);
              setHull(mesh);
              setResult(null);
              setError("");
            } catch (e) {
              setError(e.message);
            }
          }}
        />
      </label>
      {hull && (
        <button
          className="ui-button"
          onClick={() => {
            setHull(null);
            setResult(null);
          }}
        >
          Use default hull
        </button>
      )}
      <button
        className="ui-button ui-button-primary"
        data-testid="fracture-run"
        onClick={run}
      >
        Fracture hull & check conservation
      </button>
      <p role="alert">{error}</p>
      {result && (
        <div className="science-card" data-testid="fracture-result">
          <p>
            {result.fragments.length} closed convex pieces · total mass{" "}
            {result.mass.toFixed(9)} kg. Net momentum:{" "}
            {result.momentum.map((v) => v.toExponential(2)).join(", ")} kg·m/s.
            Angular momentum:{" "}
            {result.angularMomentum.map((v) => v.toFixed(6)).join(", ")}{" "}
            kg·m²/s.
          </p>
          <svg
            viewBox="0 0 560 300"
            className="education-plot"
            role="img"
            aria-label="Exploded convex fracture hull geometry"
          >
            {result.fragments.map((f, i) => {
              const vertices = f.mesh.vertices.map((v) =>
                project(add(v, scale(f.r, 1.5))),
              );
              return (
                <g key={i}>
                  {f.mesh.faces.map((face, j) => (
                    <polygon
                      key={j}
                      points={face.map((k) => vertices[k].join(",")).join(" ")}
                      fill={["#22d3ee", "#a78bfa", "#fbbf24", "#34d399"][i % 4]}
                      fillOpacity=".2"
                      stroke="currentColor"
                      strokeWidth=".5"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          <p>{result.notice}</p>
          <button
            className="ui-button"
            data-testid="fracture-export"
            onClick={() =>
              downloadJSON("missionforge-convex-fracture.json", result)
            }
          >
            Export meshes, state & diagnostics
          </button>
        </div>
      )}
    </section>
  );
}
