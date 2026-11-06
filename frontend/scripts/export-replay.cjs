require('./register.cjs');
const fs=require('node:fs');
const {showcaseReplaySpec,runMissionReplay}=require('../src/sim/missionReplay');
const spec=showcaseReplaySpec(), reference=runMissionReplay(spec);
if(reference.outcome!=='success')throw Error('Showcase failed');
fs.writeFileSync(require('node:path').resolve(__dirname,'../public/science/showcase-replay.json'),JSON.stringify({spec,reference},null,2)+'\n');
console.log(reference.hash,reference.outcome,reference.commandsExecuted);
