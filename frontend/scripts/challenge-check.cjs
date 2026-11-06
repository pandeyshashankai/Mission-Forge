require('./register.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {FlightSim}=require('../src/sim/flight'),{installLocalMissions,getMission}=require('../src/sim/missions'),{presetFalconLike}=require('../src/sim/presets'),{DEFAULT_PROFILE}=require('../src/sim/guidance'),{evaluateFlight}=require('../src/sim/scoring');
const cases=[];
for(const altitude of [200000,250000,350000,500000])for(const inclination of [28.6,45,65,98]){
 const c={id:'local-seed-feasibility',name:'Seed feasibility',altitude,inclination,budget:60};installLocalMissions([c]);const mission=getMission(c.id),sim=new FlightSim({design:presetFalconLike(),mission,difficulty:'expert',profile:{...DEFAULT_PROFILE,targetAltitude:altitude,targetInclination:inclination}});sim.launch();while(sim.t<7200&&!sim.isEnded()&&!sim.guidance?.done){sim.advance(10);sim.checkpointQueue=[];}
 const result=evaluateFlight(sim,sim.design,mission,'expert');cases.push({altitude,inclination,outcome:result.outcome,objectives:result.objectives,time:sim.t});
}
const report={status:cases.every(c=>c.outcome==='success')?'PASS':'FAIL',scope:'All 16 generated target pairs, minimum base budget 60, Expert difficulty, stock Orbiter-9.',cases};fs.writeFileSync(path.resolve(__dirname,'../../docs/submission/challenge-validation.json'),JSON.stringify(report,null,2)+'\n');assert.equal(report.status,'PASS',JSON.stringify(cases.filter(c=>c.outcome!=='success')));console.log('PASS: all 16 seeded target pairs succeed at minimum budget on Expert');
