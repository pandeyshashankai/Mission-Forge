/* global BigInt */
import { readLocalContent, writeLocalContent, validateLocalMissions } from '../sim/advanced/localContent';
import { installLocalMissions } from '../sim/missions';
export const CHALLENGE_VERSION = 1;
export function seededChallenge(input) {
  const seed = String(input).normalize('NFC').trim();
  if (!seed || seed.length > 80) throw Error('Use a seed between 1 and 80 characters.');
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(seed)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  let state = Number(hash & 0xffffffffn) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const altitude = [200000, 250000, 350000, 500000][Math.floor(next() * 4)],
    inclination = [28.6, 45, 65, 98][Math.floor(next() * 4)],
    budget = 60 + Math.floor(next() * 21);
  return {
    version: 1,
    seed,
    algorithm: 'fnv1a64-xorshift32-v1',
    mission: {
      id: 'local-seed-' + hash.toString(16).padStart(16, '0'),
      name: 'Seed ' + seed.slice(0, 45),
      altitude,
      inclination,
      budget
    }
  };
}
export function installChallenge(challenge) {
  if (challenge?.version !== CHALLENGE_VERSION) throw Error('Unsupported challenge version');
  const expected = seededChallenge(challenge.seed);
  if (JSON.stringify(expected) !== JSON.stringify(challenge)) throw Error('Challenge does not match its seed');
  const pack = readLocalContent(),
    missions = [...(pack.missions || [])],
    existing = missions.find(m => m.id === challenge.mission.id);
  if (existing && ['name', 'altitude', 'inclination', 'budget'].some(k => existing[k] !== challenge.mission[k])) throw Error('This mission ID is already used by different local content.');
  if (!existing) missions.push(challenge.mission);
  validateLocalMissions(missions);
  writeLocalContent({
    ...pack,
    missions
  });
  installLocalMissions(missions);
  return challenge.mission;
}
