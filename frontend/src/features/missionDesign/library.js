import { localData } from '../../persistence/localData';
import { DEFAULT_DESIGN, validateDesign } from './model';
export const LIBRARY_KEY = 'mf.mission-design';
export function validateLibrary(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.designs) || value.designs.length > 20 || Object.keys(value).some(k => !['version', 'draft', 'designs'].includes(k))) throw Error('Invalid mission library');
  return { version: 1, draft: validateDesign(value.draft), designs: value.designs.map(validateDesign) };
}
export function readLibrary() {
  try { const raw = localData.getItem(LIBRARY_KEY); if (raw) return validateLibrary(JSON.parse(raw)); } catch { /* Keep malformed saved data untouched until explicitly saving. */ }
  return { version: 1, draft: { ...DEFAULT_DESIGN }, designs: [] };
}
export function writeLibrary(value) { localData.setItem(LIBRARY_KEY, JSON.stringify(validateLibrary(value))); }
