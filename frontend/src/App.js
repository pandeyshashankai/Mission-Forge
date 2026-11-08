import Academy from './pages/Academy';
import NASADataExplorer from './pages/NASADataExplorer';
import ModelComparison from './pages/ModelComparison';
import {FirstFlightGuide} from './components/education/FirstFlightGuide';
import {DeviceSupport} from "./components/app/DeviceSupport";
import Challenges from "./pages/Challenges";
import Logbook from "./pages/Logbook";
import {CommandPalette} from "./components/app/CommandPalette";
import LocalStorage from "./pages/LocalStorage";
import {StorageHealth} from "./components/app/StorageHealth";
import SandboxLab from "./pages/SandboxLab";
import Showcase from "./pages/Showcase";
import {Notifications} from "./components/app/Notifications";
import { GameProvider, useGame } from "./game/GameContext";
import MainMenu from "./pages/MainMenu";
import MissionPlanner from "./pages/MissionPlanner";
import Hangar from "./pages/Hangar";
import Readiness from "./pages/Readiness";
import Flight from "./pages/Flight";
import Results from "./pages/Results";
import Explore from "./pages/Explore";
import ScienceLab from "./pages/ScienceLab";
import { Appearance, SettingsDialog } from "./components/app/Appearance";
import { TutorialOverlay } from "./components/game/Tutorial";

import "./interface.css";
import "./cockpit.css";

const SCREENS = {
  academy:Academy, data:NASADataExplorer, comparison:ModelComparison,
  challenges:Challenges,
  logbook:Logbook,
  storage: LocalStorage,
  sandbox: SandboxLab,
  showcase: Showcase,
  menu: MainMenu,
  planner: MissionPlanner,
  hangar: Hangar,
  review: Readiness,
  flight: Flight,
  results: Results,
  explore: Explore,
  science: ScienceLab,
};

function Router() {
  const { screen } = useGame();
  const Screen = SCREENS[screen] || MainMenu;
  return <div key={screen} className="screen-arrival h-full w-full flex flex-col"><FirstFlightGuide/><div className="min-h-0 flex-1"><Screen /></div></div>;
}

export default function App() {
  return (
    <GameProvider>
      <Appearance />
      <DeviceSupport/>
      <div className="app-shell h-screen w-screen overflow-hidden">
        <Router />
      </div>
      <SettingsDialog />
      <TutorialOverlay />
      <CommandPalette />
      <Notifications />
      <StorageHealth />
    </GameProvider>
  );
}
