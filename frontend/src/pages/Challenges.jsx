import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { seededChallenge, installChallenge } from '../features/challenges';
import { presetFalconLike } from '../sim/presets';
import { DEFAULT_PROFILE } from '../sim/guidance';
import { localData } from '../persistence/localData';
export default function Challenges() {
  const g = useGame(),
    [seed, setSeed] = useState('astroverse-2026'),
    [challenge, setChallenge] = useState(() => seededChallenge('astroverse-2026')),
    [message, setMessage] = useState('');
  return <main className="local-tools h-full overflow-y-auto p-4 md:p-8" data-testid="challenges-page"><div className="max-w-3xl mx-auto space-y-4"><button className="ui-button" onClick={() => g.go('menu')}>← Home</button><h1 className="text-3xl font-bold">Seeded engineering challenges</h1><p>The same seed and generator version produce the same orbit and budget on every device. These are locally generated learning missions, not historical NASA flights.</p><label className="block">Challenge seed<input className="ui-input block w-full" maxLength={80} data-testid="challenge-seed" value={seed} onChange={e => setSeed(e.target.value)} /></label><button className="ui-button" data-testid="challenge-generate" onClick={() => {
        try {
          setChallenge(seededChallenge(seed));
          setMessage('');
        } catch (e) {
          setMessage(e.message);
        }
      }}>Generate challenge</button><section className="ui-panel p-4 space-y-3" data-testid="challenge-preview"><h2 className="text-xl">{challenge.mission.name}</h2><p>Orbit: {challenge.mission.altitude / 1000} km · inclination {challenge.mission.inclination}° · base budget {challenge.mission.budget} M</p><p>Use the Orbiter-9 preset, then edit the rocket or guidance to improve your score. Difficulty scales the budget normally.</p><p>Generator {challenge.version} · {challenge.algorithm}</p><button className="ui-button" data-testid="challenge-fly" onClick={async () => {
          try {
            const mission = installChallenge(challenge);
            await localData.flush();
            g.loadDesign(presetFalconLike());
            g.setMissionId(mission.id);
            g.setDifficulty('amateur');
            g.setProfile({
              ...DEFAULT_PROFILE,
              targetAltitude: mission.altitude,
              targetInclination: mission.inclination
            });
            g.setPendingCheckpoint(null);
            g.setLearningPrediction(null);
            g.go('review');
          } catch (e) {
            setMessage(e.message);
          }
        }}>Install and review launch</button><p>Uses one of eight local mission slots. Existing challenges and authored missions are retained so their saves remain recoverable.</p></section><p role="status">{message}</p></div></main>;
}
