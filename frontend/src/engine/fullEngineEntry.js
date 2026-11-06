/* global globalThis */
import { FlightSim } from "../sim/flight";
import { ExplorationSim, FLIGHT_MODES, EXPLORERS } from "../sim/exploration";
import { FleetWorld } from "../sim/advanced/fleetWorld";
import { getMission, DIFFICULTIES } from "../sim/missions";
import { DEFAULT_PROFILE, AscentGuidance } from "../sim/guidance";
import { isValidDesign } from "../sim/storage";
import { evaluateFlight } from "../sim/scoring";
import { armProgram } from "../sim/advanced/automation";
import { beginRecording } from "../sim/advanced/controlRecording";
import { replayControls } from "../sim/advanced/controlReplay";
import { initializeWeatherModel } from "../sim/advanced/weatherAtmosphere";
import { ManeuverExec } from "../sim/maneuver";
import { validateArchive } from "../persistence/domain";
import { installLocalBodies } from "../sim/solarSystem";
import { installLocalParts } from "../sim/parts";
import { installLocalMissions } from "../sim/missions";
const finite = (x, min, max) => Number.isFinite(x) && x >= min && x <= max;
export function createEngine() {
  let campaign = null,
    world = null,
    configuration = null,
    catalogue = { version: 1, bodies: [], parts: [], missions: [] };
  if (typeof globalThis.__mfNrl === "function")
    initializeWeatherModel({
      NrlmsiseModel: class {
        run_model(...args) {
          const r = JSON.parse(globalThis.__mfNrl(JSON.stringify(args)));
          this.TotalMassDensity = r.density;
          this.TemperatureAtAlt = r.temperature;
          this.ExosphericTemp = r.exosphericTemperature;
        }
      },
    });
  function snapshot() {
    if (campaign)
      return {
        version: 1,
        kind: "missionforge-engine-save",
        mode: "campaign",
        configuration,
        catalogue,
        state: campaign.serialize(),
      };
    if (world)
      return {
        version: 1,
        kind: "missionforge-engine-save",
        mode: "fleet",
        catalogue,
        state: world.serialize(),
      };
    throw Error("Initialize a campaign or fleet first.");
  }
  function view() {
    if (campaign) {
      const n = campaign.nav;
      return {
        mode: "campaign",
        t: campaign.t,
        status: campaign.status,
        r: [...campaign.r],
        v: [...campaign.v],
        mass: n.mass,
        fuel: campaign.totalProp(),
        remainingDeltaV: campaign.remainingDeltaV(),
        altitude: n.alt,
        pressure: n.q,
        thermal: campaign.entry,
        power: campaign.sys,
        stages: campaign.rt.eventIndex,
        log: campaign.log.slice(-12),
      };
    }
    const s = world.active,
      n = s.navigation();
    return {
      mode: "fleet",
      t: s.t,
      status: s.status,
      r: [...s.r],
      v: [...s.v],
      mass: s.dryMass + s.fuel,
      fuel: s.fuel,
      remainingDeltaV: n.deltaV,
      altitude: n.altitude,
      resources: s.resources(),
      vessels: world.entries.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.sim.status,
        fuel: e.sim.fuel,
      })),
      log: s.log.slice(-12),
    };
  }
  function dispatch(m) {
    if (!m || typeof m.type !== "string") throw Error("Use an engine command.");
    if (m.type === "catalogue") {
      const pack = {
        version: 1,
        bodies: m.pack?.bodies || [],
        parts: m.pack?.parts || [],
        missions: m.pack?.missions || [],
      };
      validateArchive([["mf.local-content", JSON.stringify(pack)]]);
      catalogue = JSON.parse(JSON.stringify(pack));
      installLocalBodies(m.pack?.bodies || []);
      installLocalParts(m.pack?.parts || []);
      installLocalMissions(m.pack?.missions || []);
      return { installed: true };
    }
    if (m.type === "initCampaign") {
      const c = m.saved?.configuration || m,
        mission = getMission(c.missionId || "first_orbit");
      if (
        !mission ||
        !DIFFICULTIES[c.difficulty || "amateur"] ||
        !isValidDesign(c.design)
      )
        throw Error("Use a valid campaign design/mission/difficulty.");
      const profile = { ...DEFAULT_PROFILE, ...c.profile };
      for (const [key, value] of Object.entries(profile))
        if (
          key !== "autoStage" &&
          (!Number.isFinite(value) || Math.abs(value) > 1e9)
        )
          throw Error("Invalid guidance profile.");
      const nextConfiguration = {
        design: c.design,
        missionId: mission.id,
        difficulty: c.difficulty || "amateur",
        profile,
      };
      const nextCampaign = new FlightSim({
        design: c.design,
        mission,
        profile,
        difficulty: nextConfiguration.difficulty,
        guidanceOn: c.guidanceOn !== false,
      });
      if (m.saved) {
        validateArchive([
          [
            "mf.checkpoints",
            JSON.stringify([{ ...nextConfiguration, state: m.saved.state }]),
          ],
        ]);
        nextCampaign.restore(m.saved.state);
      }
      campaign = nextCampaign;
      configuration = nextConfiguration;
      world = null;
      return view();
    }
    if (m.type === "initFleet") {
      if (
        !m.saved &&
        (!finite(m.t ?? 0, 0, 36525 * 86400) ||
          !["hangar", ...EXPLORERS.map((c) => c.id)].includes(
            m.craftId || "pathfinder",
          ))
      )
        throw Error("Invalid fleet epoch or craft.");
      const next = m.saved
        ? FleetWorld.restore(m.saved.state)
        : new FleetWorld(
            new ExplorationSim(
              m.body || "earth",
              m.craftId || "pathfinder",
              m.t ?? 0,
              m.altitude,
              m.physics || {},
            ),
          );
      campaign = null;
      configuration = null;
      world = next;
      return view();
    }
    if (m.type === "restore") {
      if (
        m.saved?.version !== 1 ||
        m.saved.kind !== "missionforge-engine-save" ||
        !["campaign", "fleet"].includes(m.saved.mode)
      )
        throw Error("Invalid engine save.");
      const previousCatalogue = catalogue;
      try {
        if (m.saved.catalogue) dispatch({ type: "catalogue", pack: m.saved.catalogue });
        return dispatch({ ...m, type: m.saved.mode === "campaign" ? "initCampaign" : "initFleet" });
      } catch (error) {
        dispatch({ type: "catalogue", pack: previousCatalogue });
        throw error;
      }
    }
    if (m.type === "snapshot") return snapshot();
    if (m.type === "view") return view();
    if (m.type === "replay") return replayControls(m.record);
    if (!campaign && !world) throw Error("Initialize an engine session.");
    if (m.type === "advance") {
      if (!finite(m.seconds, 0.000001, 1000))
        throw Error("Advance 0–1,000 seconds per request.");
      if (campaign) campaign.advance(m.seconds, 4000);
      else world.advance(m.seconds);
      return view();
    }
    if (m.type === "launch") {
      if (!campaign) throw Error("Launch is a campaign action.");
      campaign.launch();
      return view();
    }
    if (m.type === "stage") {
      if (!campaign) throw Error("Exploration craft are single-stage.");
      campaign.stage();
      return view();
    }
    if (m.type === "control") {
      if (
        m.input &&
        (!finite(m.input.pitch, -1, 1) || !finite(m.input.yaw, -1, 1))
      )
        throw Error("Invalid input axes.");
      for (const key of ["guidance", "autoStage", "rcs", "drag"])
        if (m[key] !== undefined && typeof m[key] !== "boolean")
          throw Error("Control switches must be boolean.");
      if (m.throttle !== undefined && !finite(m.throttle, 0, 1)) throw Error("Throttle is 0–1.");
      if (!campaign) {
        if (m.mode !== undefined && !FLIGHT_MODES.includes(m.mode)) throw Error("Invalid attitude mode.");
        for (const key of ["pitch", "yaw"]) if (m[key] !== undefined && !finite(m[key], key === "pitch" ? -90 : -180, key === "pitch" ? 90 : 180)) throw Error("Invalid steering trim.");
        if (m.physics) world.active.setPhysics(m.physics);
      }
      const manual = m.throttle !== undefined || (m.input && (m.input.pitch || m.input.yaw)) || m.pitch !== undefined || m.yaw !== undefined;
      const s = campaign || world.active;
      if (manual) {
        if (campaign) campaign.guidance = null;
        else s.cancelTransfer("Manual engine control");
      }
      if (m.throttle !== undefined) {
        if (!finite(m.throttle, 0, 1)) throw Error("Throttle is 0–1.");
        s.throttle = m.throttle;
      }
      if (campaign) {
        if (m.guidance !== undefined)
          campaign.guidance = m.guidance
            ? new AscentGuidance(configuration.profile)
            : null;
        if (m.autoStage !== undefined) campaign.autoStage = !!m.autoStage;
        if (m.rcs !== undefined) campaign.rcsEnabled = m.rcs;
        if (m.input) {
          if (!finite(m.input.pitch, -1, 1) || !finite(m.input.yaw, -1, 1))
            throw Error("Input axes must be −1–1.");
          campaign.input = { pitch: m.input.pitch, yaw: m.input.yaw };
          campaign.inputActive = !!(m.input.pitch || m.input.yaw);
        }
      } else {
        if (m.mode !== undefined) {
          if (!FLIGHT_MODES.includes(m.mode))
            throw Error("Invalid attitude mode.");
          s.mode = m.mode;
        }
        for (const key of ["pitch", "yaw"])
          if (m[key] !== undefined) {
            if (
              !finite(
                m[key],
                key === "pitch" ? -90 : -180,
                key === "pitch" ? 90 : 180,
              )
            )
              throw Error("Invalid steering trim.");
            s[key] = m[key];
          }
        if (m.physics) s.setPhysics(m.physics);
        if (m.drag !== undefined) s.dragEnabled = !!m.drag;
        if (m.rcs !== undefined && s.rcsEnabled !== !!m.rcs) s.toggleRcs();
      }
      return view();
    }
    if (m.type === "maneuver") {
      if (
        !campaign ||
        !m.node ||
        !finite(m.node.t, campaign.t, 1e8) ||
        !Array.isArray(m.node.dv) ||
        m.node.dv.length !== 3 ||
        !m.node.dv.every((v) => finite(v, -20000, 20000))
      )
        throw Error("Use a bounded campaign maneuver node.");
      campaign.maneuver = new ManeuverExec(campaign, m.node);
      return view();
    }
    if (m.type === "report") {
      if (!campaign) throw Error("Campaign report unavailable for a fleet.");
      return evaluateFlight(
        campaign,
        configuration.design,
        getMission(configuration.missionId),
        configuration.difficulty,
      );
    }
    if (!world) throw Error("This action requires a fleet.");
    if (m.type === "program") {
      armProgram(world.active, m.blocks);
      return view();
    }
    if (m.type === "record") {
      if (m.active) beginRecording(world.active);
      else if (world.active.recording) world.active.recording.active = false;
      return world.active.recording || null;
    }
    if (m.type === "transfer") {
      world.active.startTransfer(m.altitude);
      return view();
    }
    if (m.type === "cancelTransfer") {
      world.active.cancelTransfer();
      return view();
    }
    if (m.type === "confirmTransfer") {
      world.active.circularizeTransfer();
      return view();
    }
    const methods = {
      create: "create",
      remove: "remove",
      switch: "switchTo",
      dock: "dock",
      undock: "undock",
      rendezvous: "startApproach",
      fuel: "transferFuel",
      rigid: "setRigidContacts",
      collisions: "setCollisions",
      fracture: "setMeshFracture",
    };
    if (Object.prototype.hasOwnProperty.call(methods, m.type)) {
      if (
        ["rigid", "collisions", "fracture"].includes(m.type) &&
        typeof m.enabled !== "boolean"
      )
        throw Error("Mode switches must be boolean.");
      if (m.type === "create" && !EXPLORERS.some((c) => c.id === m.id))
        throw Error("Choose a built-in companion craft.");
      if (m.type === "fuel") world.transferFuel(m.id, m.amount);
      else world[methods[m.type]](m.id ?? m.enabled);
      return view();
    }
    throw Error("Unsupported engine command.");
  }
  return { dispatch };
}
