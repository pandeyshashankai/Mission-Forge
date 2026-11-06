/* global globalThis */
import { replayHeader, REPLAY_FILE_LIMIT } from './replayFile';
globalThis.onmessage = async event => {
  try {
    const bytes = event.data;
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > REPLAY_FILE_LIMIT) throw Error('Replay exceeds 50 MiB');
    const header = replayHeader(new TextDecoder().decode(bytes));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    globalThis.postMessage({
      header,
      hash
    });
  } catch (error) {
    globalThis.postMessage({
      error: error.message
    });
  }
};
