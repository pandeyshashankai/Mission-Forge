import { installLocalMissions } from "../../sim/missions";
import { useRef, useState } from "react";
import { BODY_BY_ID, installLocalBodies, AU } from "../../sim/solarSystem";
import { installLocalParts } from "../../sim/parts";
import {
  readLocalContent,
  writeLocalContent,
  validateLocalBodies,
  validateLocalParts,
  validateLocalMissions,
} from "../../sim/advanced/localContent";
import { downloadJSON, readJSONFile } from "../../sim/storage";
const examples = {
  version: 1,
  bodies: [
    {
      id: "local-aurora",
      name: "Aurora",
      parent: "sun",
      radius: 3000000,
      mu: 2.7e13,
      rotation: 90000,
      a: 1.8 * AU,
      e: 0.03,
      inc: 2,
      node: 0,
      peri: 0,
      L: 210,
      color: "#8ad1c2",
    },
  ],
  parts: [
    {
      id: "local-survey-tank",
      name: "Survey methalox tank",
      category: "tank",
      diameter: 1.8,
      height: 4,
      dryMass: 500,
      cost: 0.8,
      propellant: { type: "methalox", mass: 8000 },
    },
  ],
};
export function LocalContentEditor({ onExplore }) {
  const [missionName, setMissionName] = useState("Custom orbit"),
    [missionAltitude, setMissionAltitude] = useState(350),
    [missionInc, setMissionInc] = useState(45);
  const [content, setContent] = useState(readLocalContent),
    [name, setName] = useState("Aurora"),
    [radius, setRadius] = useState(3000),
    [gravity, setGravity] = useState(3),
    [orbit, setOrbit] = useState(1.8),
    [message, setMessage] = useState(""),
    input = useRef(null);
  const install = (data) => {
    if (data?.version !== 1) throw Error("Unsupported content version");
    const builtin = Object.fromEntries(
      Object.values(BODY_BY_ID)
        .filter((b) => !b.custom)
        .map((b) => [b.id, b]),
    );
    const bodies = validateLocalBodies(data.bodies, builtin),
      parts = validateLocalParts(data.parts),
      missions = validateLocalMissions(data.missions || []);
    // Validate the whole package and persist before changing either registry.
    const checked = { version: 1, bodies, parts, missions };
    writeLocalContent(checked);
    installLocalBodies(bodies);
    installLocalParts(parts);
    installLocalMissions(missions);
    setContent(checked);
    setMessage(
      "Local content installed. Worlds appear in Explore; parts appear in the builder.",
    );
  };
  const create = () => {
    try {
      const id =
        "local-" +
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 30) +
        "-" +
        Date.now().toString(36);
      install({
        ...content,
        bodies: [
          ...content.bodies,
          {
            ...examples.bodies[0],
            id,
            name,
            radius: radius * 1000,
            mu: gravity * (radius * 1000) ** 2,
            a: orbit * AU,
          },
        ],
      });
    } catch (e) {
      setMessage(e.message);
    }
  };
  return (
    <section data-testid="local-content-editor">
      <h2>Local worlds & data packs</h2>
      <p>
        Create planets for the playable solar system. All entered values are
        custom model inputs, kept separate from NASA measurements. Packages may
        add bounded planet/moon and part data; executable code and remote assets
        are never loaded.
      </p>
      <div className="sandbox-form">
        <label>
          World name
          <input
            data-testid="world-name"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Radius (km)
          <input
            type="number"
            min="1"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>
        <label>
          Surface gravity (m/s²)
          <input
            type="number"
            min="0.01"
            step="0.1"
            value={gravity}
            onChange={(e) => setGravity(Number(e.target.value))}
          />
        </label>
        <label>
          Solar orbit (AU)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={orbit}
            onChange={(e) => setOrbit(Number(e.target.value))}
          />
        </label>
      </div>
      <button
        className="ui-button ui-button-primary"
        data-testid="world-create"
        onClick={create}
      >
        Create playable planet
      </button>
      <div className="showcase-actions">
        <button
          className="ui-button"
          onClick={() =>
            downloadJSON("mission-forge-content-example.json", examples)
          }
        >
          Download example package
        </button>
        <button
          className="ui-button"
          onClick={() =>
            downloadJSON("mission-forge-local-content.json", content)
          }
        >
          Export local content
        </button>
        <button className="ui-button" onClick={() => input.current.click()}>
          Import content package
        </button>
        <button className="ui-button" onClick={onExplore}>
          Open exploration
        </button>
      </div>
      <input
        hidden
        ref={input}
        type="file"
        accept=".json,application/json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 200000)
              throw Error("Content package exceeds 200 KB");
            const pack = await readJSONFile(file);
            const duplicates =
              (pack.bodies || []).some((b) =>
                content.bodies.some((c) => c.id === b.id),
              ) ||
              (pack.parts || []).some((p) =>
                content.parts.some((c) => c.id === p.id),
              );
            if (duplicates)
              throw Error(
                "Package IDs already installed; use unique local IDs.",
              );
            install({
              version: pack.version,
              bodies: [...content.bodies, ...(pack.bodies || [])],
              parts: [...content.parts, ...(pack.parts || [])],
              missions: [...(content.missions || []), ...(pack.missions || [])],
            });
          } catch (error) {
            setMessage(error.message);
          }
        }}
      />
      <h3>Build a local Earth-orbit mission</h3>
      <div className="sandbox-form">
        <label>
          Challenge name
          <input
            value={missionName}
            maxLength="50"
            onChange={(e) => setMissionName(e.target.value)}
          />
        </label>
        <label>
          Target altitude (km)
          <input
            type="number"
            min="160"
            max="1000"
            value={missionAltitude}
            onChange={(e) => setMissionAltitude(Number(e.target.value))}
          />
        </label>
        <label>
          Inclination (degrees)
          <input
            type="number"
            min="28.6"
            max="151.4"
            value={missionInc}
            onChange={(e) => setMissionInc(Number(e.target.value))}
          />
        </label>
      </div>
      <button
        className="ui-button"
        data-testid="mission-create"
        onClick={() => {
          try {
            install({
              ...content,
              missions: [
                ...(content.missions || []),
                {
                  id: "local-mission-" + Date.now().toString(36),
                  name: missionName,
                  altitude: missionAltitude * 1000,
                  inclination: missionInc,
                  budget: 100,
                },
              ],
            });
          } catch (e) {
            setMessage(e.message);
          }
        }}
      >
        Create campaign challenge
      </button>
      <p role="status" data-testid="world-status">
        {message}
      </p>
      <ul>
        {content.bodies.map((b) => (
          <li key={b.id}>
            {b.name} · {(b.radius / 1000).toFixed(0)} km · custom{" "}
            {b.parent === "sun" ? "planet" : "moon"}
          </li>
        ))}
        {content.parts.map((p) => (
          <li key={p.id}>
            {p.name} · custom {p.category}
          </li>
        ))}
      </ul>
      <ul>
        {(content.missions || []).map((m) => (
          <li key={m.id}>
            {m.name} · {m.altitude / 1000} km · local mission
          </li>
        ))}
      </ul>
      <p>
        Installed content is append-only in this editor to protect saved designs
        and fleets. A package is portable as a local JSON file, with no hosted
        gallery. Cross-device craft saves need their content package installed
        first.
      </p>
    </section>
  );
}
