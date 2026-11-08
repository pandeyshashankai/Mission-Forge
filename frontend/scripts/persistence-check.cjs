require('./register.cjs');
const assert = require('node:assert/strict'),
  fs = require('node:fs');
const {
  browserSession
} = require('./browser-session.cjs');
const {
  makeBackup
} = require('../src/persistence/backup');
const {
    FlightSim
  } = require('../src/sim/flight'),
  {
    presetFalconLike
  } = require('../src/sim/presets'),
  {
    getMission
  } = require('../src/sim/missions'),
  {
    DEFAULT_PROFILE
  } = require('../src/sim/guidance');
(async () => {
  const b = await browserSession();
  try {
    await b.home();
    await b.viewport(390, 844);
    const original = await b.evaluate('window.missionForgeData.entries()');
    fs.writeFileSync('/tmp/missionforge-before-persistence-audit.json', JSON.stringify(original));
    await b.evaluate(`window.missionForgeData.removeItem('mf.audit-legacy');window.missionForgeData.flush()`);
    await b.evaluate(`window.localStorage.setItem('mf.audit-legacy',JSON.stringify({migrated:true}))`);
    await b.home();
    assert.equal(await b.evaluate(`window.localStorage.getItem('mf.audit-legacy')`), null);
    assert.deepEqual(await b.evaluate(`JSON.parse(window.missionForgeData.getItem('mf.audit-legacy'))`), {
      migrated: true
    });
    const disk = `(key)=>new Promise((resolve,reject)=>{const r=indexedDB.open('missionforge',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('entries'),q=tx.objectStore('entries').get(key);q.onsuccess=()=>{resolve(q.result?.value);db.close()};q.onerror=()=>reject(q.error)}})`;
    assert.equal(await b.evaluate(`(${disk})('mf.audit-legacy')`), '{"migrated":true}');
    await b.click('menu-storage-btn');
    await b.wait(b.exists('storage-screen'));
    assert.match(await b.evaluate(`document.querySelector('[data-testid=storage-status]').textContent`), /indexeddb/);
    const good = await makeBackup([['mf.audit-legacy', '{"restored":true}']]);
    fs.writeFileSync('/tmp/missionforge-valid-backup.json', JSON.stringify(good));
    await b.upload('[data-testid=storage-import]', ['/tmp/missionforge-valid-backup.json']);
    await b.wait(b.exists('backup-preview'));
    await b.click('backup-apply');
    await b.wait(b.exists('main-title'));
    assert.deepEqual(await b.evaluate(`JSON.parse(window.missionForgeData.getItem('mf.audit-legacy'))`), {
      restored: true
    });
    good.payload.entries[0][1] = '{}';
    fs.writeFileSync('/tmp/missionforge-tampered-backup.json', JSON.stringify(good));
    await b.click('menu-storage-btn');
    await b.upload('[data-testid=storage-import]', ['/tmp/missionforge-tampered-backup.json']);
    await b.wait(`document.body.textContent.includes('checksum mismatch')`);
    assert.equal(await b.evaluate(b.exists('backup-preview')), false);
    assert.equal(await b.evaluate(`window.missionForgeData.getItem('mf.audit-legacy')`), '{"restored":true}');
    const failed = await b.evaluate(`(async()=>{const old=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){if(this.name==='entries')throw new DOMException('Audit quota pressure','QuotaExceededError');return old.apply(this,arguments)};try{window.missionForgeData.setItem('mf.audit-legacy','{"unsaved":true}');try{await window.missionForgeData.flush();return false}catch{return true}}finally{IDBObjectStore.prototype.put=old}})()`);
    assert.equal(failed, true);
    assert.equal(await b.evaluate(`(${disk})('mf.audit-legacy')`), '{"restored":true}');
    await b.wait(`document.querySelector('[role=alert]')?.textContent.includes('Save failed')`);
    await b.evaluate(`window.missionForgeData.setItem('mf.audit-unrelated','{}');window.missionForgeData.flush().catch(()=>{})`);
    assert.match(await b.evaluate(`document.querySelector('[role=alert]').textContent`), /Save failed/);
    await b.evaluate(`window.missionForgeData.setItem('mf.audit-legacy','{"restored":true}');window.missionForgeData.flush()`);
    await b.evaluate(`window.missionForgeData.setItem('mf.audit-unrelated','{}');window.missionForgeData.flush()`);
    const other = await b.call('Target.createTarget', {
      url: 'http://127.0.0.1:8080/'
    });
    try {
      const tabs = await (await fetch('http://127.0.0.1:9222/json')).json(),
        socket = new WebSocket(tabs.find(t => t.id === other.targetId).webSocketDebuggerUrl);
      await new Promise(resolve => socket.onopen = resolve);
      let seq = 0;
      const jobs = new Map();
      socket.onmessage = e => {
        const r = JSON.parse(e.data);
        if (r.id) {
          jobs.get(r.id)?.(r);
          jobs.delete(r.id);
        }
      };
      const evaluate = expression => new Promise((resolve, reject) => {
        const id = ++seq;
        jobs.set(id, r => r.result?.exceptionDetails ? reject(Error(r.result.exceptionDetails.text)) : resolve(r.result?.result?.value));
        socket.send(JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true
          }
        }));
      });
      for (let i = 0; i < 100 && !(await evaluate("!!document.querySelector('[data-testid=main-title]')")); i++) await b.pause(100);
      assert.match(await evaluate('document.body.textContent'), /Another MissionForge tab owns local saves/);
      assert.equal(await evaluate("(()=>{try{window.missionForgeData.setItem('mf.audit-legacy','{}');return false}catch{return true}})()"), true);
      socket.close();
    } finally {
      await b.call('Target.closeTarget', {
        targetId: other.targetId
      });
    }
    const sim = new FlightSim({
      design: presetFalconLike(),
      mission: getMission('first_orbit'),
      difficulty: 'amateur',
      profile: DEFAULT_PROFILE
    });
    sim.launch();
    sim.advance(5);
    const ck = {
      id: 'audit-recovery',
      label: 'Audit recovery',
      at: new Date().toISOString(),
      missionId: 'first_orbit',
      difficulty: 'amateur',
      design: sim.design,
      profile: DEFAULT_PROFILE,
      state: sim.serialize(),
      simT: sim.t
    };
    await b.evaluate(`window.missionForgeData.setItem('mf.recovery-flight',${JSON.stringify(JSON.stringify(ck))});window.missionForgeData.flush()`);
    await b.evaluate(`(async()=>{const ck=JSON.parse(window.missionForgeData.getItem('mf.recovery-flight'));for(let i=0;i<8;i++)window.missionForgeData.setItem('mf.recovery-flight',JSON.stringify({...ck,label:'Recovery '+i}));await window.missionForgeData.flush();})()`);
    const versions = await b.evaluate("window.missionForgeData.recoveries().then(rows=>rows.filter(r=>r.key==='mf.recovery-flight'))");
    assert.equal(versions.length, 6);
    assert.equal(JSON.parse(versions[0].value).label, 'Recovery 7');
    await b.home();
    await b.click('resume-recovery');
    await b.wait(b.exists('flight-pause-btn'));
    assert.match(await b.evaluate(`document.querySelector('[data-testid=flight-pause-btn]').textContent`), /Resume/i);
    await b.home();
    await b.click('menu-storage-btn');
    await b.wait(`document.body.textContent.includes('mf.recovery-flight')`);
    await b.screenshot('local-recovery-phone');
    await b.home();
    assert.equal(await b.evaluate("Boolean(document.querySelector('[data-testid=menu-evidence-btn]'))"), false);
    assert.deepEqual(b.errors, []);
    console.log('PASS: native-to-IndexedDB migration, actual disk persistence, backup preview/merge, tamper rejection, quota failure atomicity, recovery resumed paused, no public submission entry point');
  } finally {
    b.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
