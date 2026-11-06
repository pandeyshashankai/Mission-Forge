/* global globalThis */
import { drawOrbit } from './plot';
globalThis.onmessage = event => {
  try {
    drawOrbit(event.data.canvas, event.data.trace);
    globalThis.postMessage({
      done: true
    });
  } catch (e) {
    globalThis.postMessage({
      error: e.message
    });
  }
};
