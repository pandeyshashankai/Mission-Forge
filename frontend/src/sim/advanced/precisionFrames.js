let library = null,
  pending = null;
export function initializePrecisionFrames(module) {
  library = module.TSOFA;
  return library;
}
export function loadPrecisionFrames() {
  if (library) return Promise.resolve(library);
  if (!pending)
    pending = import(/* webpackIgnore: true */ "/science/models/tsofa/TSOFA.js")
      .then(initializePrecisionFrames)
      .catch((e) => {
        pending = null;
        throw e;
      });
  return pending;
}
export function standardsRotation({ tta, ttb, uta, utb, xp, yp }) {
  if (!library) throw Error("Load the local standards-frame library first.");
  if (
    ![tta, ttb, uta, utb, xp, yp].every(Number.isFinite) ||
    tta + ttb < 2400000 ||
    tta + ttb > 2600000 ||
    uta + utb < 2400000 ||
    uta + utb > 2600000 ||
    Math.abs(xp) > 0.001 ||
    Math.abs(yp) > 0.001
  )
    throw Error("Invalid TT/UT1 dates or polar motion.");
  return library.jauC2t06a(tta, ttb, uta, utb, xp, yp);
}
export function applyMatrix(matrix, vector) {
  return matrix.map((row) => row.reduce((s, x, i) => s + x * vector[i], 0));
}
export function transpose(matrix) {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]));
}
