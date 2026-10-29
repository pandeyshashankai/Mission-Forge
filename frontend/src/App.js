import { Toaster } from "./components/ui/sonner";
import { GameProvider, useGame } from "./game/GameContext";
import MainMenu from "./pages/MainMenu";
import MissionPlanner from "./pages/MissionPlanner";
import Hangar from "./pages/Hangar";
import Readiness from "./pages/Readiness";
import Flight from "./pages/Flight";
import Results from "./pages/Results";
import { TutorialOverlay } from "./components/game/Tutorial";

const SCREENS = { menu: MainMenu, planner: MissionPlanner, hangar: Hangar, review: Readiness, flight: Flight, results: Results };

function Router() {
  const { screen } = useGame();
  const Screen = SCREENS[screen] || MainMenu;
  return <Screen />;
}

export default function App() {
  return (
    <GameProvider>
      <div className="dark h-screen w-screen overflow-hidden bg-[#07090e] text-slate-100">
        <Router />
      </div>
      <TutorialOverlay />
      <Toaster theme="dark" position="bottom-right" />
    </GameProvider>
  );
}
