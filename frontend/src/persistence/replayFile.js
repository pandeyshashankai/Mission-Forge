export const REPLAY_FILE_LIMIT = 50 * 1024 * 1024;
export function replayHeader(text) {
  if (typeof text !== 'string') throw Error('Replay must be JSON text');
  const data = JSON.parse(text);
  if (data?.kind === 'exploration-control-trace' && data.version === 1 && Array.isArray(data.commands) && data.commands.length <= 12000) return {
    kind: data.kind,
    version: 1,
    commands: data.commands.length
  };
  if (data?.spec?.model === 'mission-forge-guided-v1' && data.spec.version === 1 && Array.isArray(data.spec.commands) && data.spec.commands.length <= 1000) return {
    kind: data.spec.model,
    version: 1,
    commands: data.spec.commands.length
  };
  throw Error('Unsupported replay header. Use a recorded control trace or guided mission replay.');
}
