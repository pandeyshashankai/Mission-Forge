require('../scripts/register.cjs');
const test = require('node:test'), assert = require('node:assert/strict');
const { DEFAULT_DESIGN: D, TARGETS, designStats, startMission, stepMission, runMission, missionReport, validateDesign, encodeDesign, decodeDesign } = require('../src/features/missionDesign/model');
const { validateLibrary } = require('../src/features/missionDesign/library');
test('circular periods, sunlight and eclipse obey physical relationships', () => {
  const earth = designStats(D), high = designStats({...D, orbit:'high', launcher:'medium'}), mars = designStats({...D,target:'mars'});
  assert.ok(earth.period > 90 && earth.period < 100);
  assert.ok(high.period > earth.period); assert.ok(high.eclipse < earth.eclipse);
  assert.ok(Math.abs(mars.solar / earth.solar - 1 / 1.524 ** 2) < 1e-12);
});
test('launch checks enforce budget, target delivery and orbit compatibility', () => {
  assert.throws(() => startMission({...D,budget:50}), /budget/);
  assert.throws(() => startMission({...D,target:'mars'}), /mass/);
  assert.throws(() => startMission({...D,orbit:'high'}), /altitude/);
  assert.equal(designStats(D).issues.length,0);
});
test('operations conserve data, bound batteries and match stepped and full simulation', () => {
  const full=runMission(D); let stepped=startMission(D);
  for(let n=0;n<24;n++) stepped=stepMission(D,stepped,60);
  assert.deepEqual(stepped,full); assert.equal(full.minute,1440); assert.equal(full.history.length,24);
  assert.ok(Math.abs(full.generated-full.returned-full.stored-full.lost)<1e-8);
  assert.ok(full.history.every(s=>s.battery>=0&&s.battery<=50&&s.stored<=100));
  assert.deepEqual(stepMission(D,full),full); assert.equal(startMission(D).minute,0);
});
test('storage and radio decisions change the science returned, not just a dashboard', () => {
  const small=runMission(D), big=runMission({...D,storage:'large'}), dish=runMission({...D,storage:'large',antenna:'dish'});
  assert.ok(big.lost<small.lost); assert.ok(dish.returned>big.returned);
  assert.equal(startMission(D).science,0);
  const mismatch=runMission({...D,instrument:'spectrometer'});
  assert.ok(mismatch.science<small.science);
});
test('power shortages interrupt actual tasks; improved arrays restore observation', () => {
  const poor={...D,target:'mars',instrument:'hires',launcher:'heavy',budget:300};
  const a=runMission(poor),b=runMission({...poor,panel:'large',battery:'large'});
  assert.ok(a.powerMinutes>b.powerMinutes);assert.ok(a.observedMinutes<b.observedMinutes);
});
test('each scenario has attainable objectives and multiple successful Earth designs', () => {
  for(const target of Object.keys(TARGETS)) {
    const d={...D,target,instrument:TARGETS[target].instrument,launcher:target==='earth'?'light':'heavy',panel:target==='mars'?'large':'compact',budget:300};
    const r=missionReport(d,runMission(d)); assert.equal(r.success,true,target); assert.ok(r.score<=100&&r.score>=0);
  }
  assert.equal(missionReport({...D,antenna:'dish'},runMission({...D,antenna:'dish'})).success,true);
  assert.equal(missionReport(D,startMission(D)).success,false);
  const r=missionReport(D,runMission(D)); assert.equal(r.explanations.length,6);assert.match(r.assumptions,/Fictional/);
});
test('duration drives operations cost and gives a bounded 30-day run', () => {
  assert.equal(designStats({...D,days:30}).cost-designStats(D).cost,14.5);
  const s=runMission({...D,days:30}); assert.equal(s.minute,43200); assert.equal(s.history.length,720);
});
test('portable mission designs round trip Unicode and reject malformed or hostile input', () => {
  const d={...D,name:'Lune 🌙 – science'};assert.deepEqual(decodeDesign(encodeDesign(d)),d);
  for(const patch of [{version:2},{target:'constructor'},{panel:'__proto__'},{days:0},{days:Infinity},{days:31},{budget:NaN},{name:''},{extra:true}])assert.throws(()=>validateDesign({...D,...patch}));
  assert.throws(()=>decodeDesign('x'.repeat(6001))); assert.throws(()=>decodeDesign('%broken'));
  assert.throws(()=>validateLibrary({version:1,draft:D,designs:Array(21).fill(D)}));
  assert.deepEqual(validateLibrary({version:1,draft:D,designs:[d]}).designs,[d]);
});
