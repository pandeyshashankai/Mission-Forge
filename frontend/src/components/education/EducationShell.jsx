import { useGame } from "../../game/GameContext";
import { DisplayButton } from "../app/Appearance";
export function EducationShell({ title, children, testId }) {
  const g = useGame();
  return (
    <div className="science-screen education-screen" data-testid={testId}>
      <header className="workflow-header">
        <button className="ui-button" onClick={() => g.go("menu")}>
          ← Home
        </button>
        <strong>{title}</strong>
        <DisplayButton compact />
      </header>
      <main className="education-layout">{children}</main>
    </div>
  );
}
