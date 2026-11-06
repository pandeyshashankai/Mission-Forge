require('./register.cjs');
const fs=require('node:fs'),path=require('node:path'),{ExplorationSim}=require('../src/sim/exploration');
const all={j2:true,harmonicDegree:8,thirdBody:true,srp:true,tides:true,advancedTides:true,oceanTides:true,relativity:true,power:true,communications:true,damage:true};
const specs=[['earth',{}],['earth',{harmonicDegree:8}],['earth',{oceanTides:true}],['earth',all],['earth',{...all,integrator:'accurate'}],['earth',{...all,ephemeris:'de421',tideLag:60}],['moon',all],['mars',all],['titan',all]];
const records=specs.map(([body,options])=>{const sim=new ExplorationSim(body,'pathfinder',600,undefined,options);for(let i=0;i<6;i++)sim.advance(1000);return {body,options,initialTime:600,requests:6,seconds:1000,state:JSON.parse(JSON.stringify(sim.serialize()))}});
const file=path.resolve(__dirname,'../tests/fixtures/pre-optimization.json');fs.writeFileSync(file,JSON.stringify({scope:'Pre-optimization serialized-state equivalence fixtures; not independent physical reference data.',records},null,2)+'\n',{flag:'wx'});console.log('Saved '+records.length+' baseline trajectories');
