import { useEffect, useState } from "react";
import {
  Check,
  Monitor,
  Palette,
  Type,
  Eye,
  Sparkles,
  Settings2,
  Keyboard,
} from "lucide-react";
import { ControlSettings } from "./ControlSettings";
import { useGame } from "../../game/GameContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

export const THEMES = [
  {
    id: "orbital",
    name: "Orbital",
    desc: "Deep blue · bright cyan",
    colors: ["#0b1425", "#43cbe7", "#fecc76"],
  },
  {
    id: "nebula",
    name: "Nebula",
    desc: "Midnight violet · lavender",
    colors: ["#18132d", "#baa1ff", "#78dec4"],
  },
  {
    id: "daylight",
    name: "Daylight",
    desc: "Soft white · ocean blue",
    colors: ["#eef3fa", "#1667ad", "#985209"],
  },
];

export function Appearance() {
  const { settings } = useGame();
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.dataset.motion = settings.reduceMotion
      ? "reduced"
      : "full";
    document.documentElement.style.colorScheme =
      settings.theme === "daylight" ? "light" : "dark";
  }, [settings.theme, settings.textSize, settings.reduceMotion]);
  return null;
}

export function DisplayButton({ compact = false }) {
  const { setSettingsOpen } = useGame();
  return (
    <button
      className="ui-button ui-button-quiet"
      data-testid="display-settings-btn"
      aria-label="Open settings"
      onClick={() => setSettingsOpen(true)}
    >
      <Settings2 size={16} />
      {!compact && <span>Settings</span>}
    </button>
  );
}

export function SettingsDialog() {
  const g = useGame();
  const [tab, setTab] = useState("appearance");
  const change = (patch) => g.setSettings({ ...g.settings, ...patch });
  return (
    <Dialog open={g.settingsOpen} onOpenChange={g.setSettingsOpen}>
      <DialogContent className="settings-surface" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="!text-2xl">Settings</DialogTitle>
          <DialogDescription>
            Appearance, touch controls, and keyboard bindings. Your preferences
            stay on this device.
          </DialogDescription>
        </DialogHeader>
        <div
          className="settings-tabs"
          role="tablist"
          aria-label="Settings categories"
        >
          <button
            role="tab"
            id="settings-appearance-tab"
            aria-controls="settings-appearance-panel"
            aria-selected={tab === "appearance"}
            onClick={() => setTab("appearance")}
            data-testid="settings-tab-appearance"
          >
            <Palette size={15} /> Appearance
          </button>
          <button
            role="tab"
            id="settings-controls-tab"
            aria-controls="settings-controls-panel"
            aria-selected={tab === "controls"}
            onClick={() => setTab("controls")}
            data-testid="settings-tab-controls"
          >
            <Keyboard size={15} /> Controls
          </button>
        </div>
        {tab === "controls" ? (
          <div
            role="tabpanel"
            aria-labelledby="settings-controls-tab"
            id="settings-controls-panel"
          >
            <ControlSettings />
          </div>
        ) : (
          <div
            role="tabpanel"
            aria-labelledby="settings-appearance-tab"
            id="settings-appearance-panel"
            className="appearance-sections"
          >
            <section>
              <h3 className="settings-heading">
                <Palette size={16} /> Colour theme
              </h3>
              <div className="theme-options">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`theme-option ${g.settings.theme === t.id ? "is-selected" : ""}`}
                    data-testid={`theme-${t.id}`}
                    aria-pressed={g.settings.theme === t.id}
                    onClick={() => change({ theme: t.id })}
                  >
                    <span
                      className="theme-swatch"
                      style={{ background: t.colors[0] }}
                    >
                      {t.colors.slice(1).map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))}
                      {g.settings.theme === t.id && <Check size={15} />}
                    </span>
                    <strong>{t.name}</strong>
                    <small>{t.desc}</small>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3 className="settings-heading">
                <Type size={16} /> Reading & movement
              </h3>
              <div className="settings-option-row">
                <div>
                  <strong>Larger interface text</strong>
                  <p>More readable labels, buttons, and instruments.</p>
                </div>
                <input
                  aria-label="Larger interface text"
                  data-testid="large-text-toggle"
                  type="checkbox"
                  checked={g.settings.textSize === "large"}
                  onChange={(e) =>
                    change({
                      textSize: e.target.checked ? "large" : "standard",
                    })
                  }
                />
              </div>
              <div className="settings-option-row">
                <div>
                  <strong>Reduce motion</strong>
                  <p>Keep menus still and turn off decorative animations.</p>
                </div>
                <input
                  aria-label="Reduce motion"
                  data-testid="reduce-motion-toggle"
                  type="checkbox"
                  checked={g.settings.reduceMotion}
                  onChange={(e) => change({ reduceMotion: e.target.checked })}
                />
              </div>
            </section>
            <section>
              <h3 className="settings-heading">
                <Monitor size={16} /> 3D graphics
              </h3>
              <div className="settings-graphics">
                {[
                  ["auto", Sparkles, "Auto"],
                  ["low", Eye, "Low"],
                  ["medium", Monitor, "Balanced"],
                  ["high", Monitor, "High"],
                ].map(([q, Icon, label]) => (
                  <button
                    key={q}
                    data-testid={`graphics-${q}-btn`}
                    aria-pressed={g.settings.graphics === q}
                    onClick={() => change({ graphics: q })}
                    className={`ui-button ${g.settings.graphics === q ? "ui-button-selected" : ""}`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
              <p className="ui-help">
                Auto adapts the flight resolution. Choose Low for slower
                devices.
              </p>
            </section>
          </div>
        )}
        <button
          className="ui-button ui-button-primary settings-done"
          data-testid="settings-done"
          onClick={() => g.setSettingsOpen(false)}
        >
          <Check size={16} /> Done
        </button>
      </DialogContent>
    </Dialog>
  );
}
