export const NAV_COMMANDS = [{
  id: 'menu',
  label: 'Home',
  hint: 'Start or recover a flight'
}, {
  id: 'planner',
  label: 'Mission planner',
  hint: 'Choose a scored mission'
}, {
  id: 'hangar',
  label: 'Rocket builder',
  hint: 'Edit parts, staging and engineering'
}, {
  id: 'explore',
  label: 'Solar system explorer',
  hint: 'Fly, plan and manage a fleet'
}, {
  id: 'science',
  label: 'NASA data and science',
  hint: 'Sources, checks and predict–fly–explain'
}, {
  id: 'sandbox',
  label: 'Sandbox laboratory',
  hint: 'Transfer windows, materials and reference frames'
}, {
  id: 'showcase',
  label: 'Guided showcase',
  hint: 'Presentation route and replay'
}, {
  id: 'evidence',
  label: 'Mission evidence',
  hint: 'Build identity, report and limitations'
}, {
  id: 'storage',
  label: 'Data and recovery',
  hint: 'Verified backups and local files'
}, {
  id: 'challenges',
  label: 'Seeded challenges',
  hint: 'Repeatable locally generated missions'
}, {
  id: 'logbook',
  label: 'Flight logbook',
  hint: 'Compare flights and review achievements'
},{id:'academy',label:'Mission Control Academy',hint:'First flight, lessons and reflections'},{id:'data',label:'NASA Data Explorer',hint:'Compare sourced worlds and their gameplay effects'},{id:'comparison',label:'Scientific Model Comparison',hint:'Identical initial states, basic and advanced forces'}];
export function searchCommands(query) {
  const terms = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return NAV_COMMANDS.filter(c => terms.every(t => (c.label + ' ' + c.hint).toLowerCase().includes(t)));
}
