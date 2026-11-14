require('./register.cjs');
const assert = require('node:assert/strict');
const { browserSession } = require('./browser-session.cjs');
(async () => {
  const b = await browserSession();
  try {
    await b.viewport(1440,1000); await b.home(); await b.click('menu-mission-design');
    await b.wait(b.exists('mission-design-studio'));
    await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=mission-name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await b.wait("Boolean(document.querySelector('[data-testid=mission-design-studio]'))");
    await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=mission-name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Browser science survey');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await b.select('mission-players','4');
    assert.equal(await b.evaluate("document.querySelector('[data-testid=mission-launch]').disabled"),true);
    for(let i=0;i<4;i++) await b.click('mission-approve-'+i);
    assert.equal(await b.evaluate("document.querySelector('[data-testid=mission-launch]').disabled"),false);
    await b.select('mission-storage','large');
    assert.equal(await b.evaluate("document.querySelector('[data-testid=mission-launch]').disabled"),true,'Editing resets team approvals');
    await b.select('mission-players','1');
    await b.click('mission-save'); await b.click('mission-share');
    const url=await b.evaluate("document.querySelector('[aria-label=\"Mission share link\"]').value");
    assert.match(url,/#mission=/);
    await b.click('mission-launch'); await b.wait(b.exists('mission-operations'));
    assert.equal(await b.evaluate("document.querySelector('[data-testid=mission-instrument]').matches(':disabled')"),true);
    await b.click('mission-finish');
    await b.wait("document.querySelector('[data-testid=mission-result]').textContent.includes('Science objective achieved')");
    const exported=await b.evaluate(`(()=>{window.__missionExports=[];const original=URL.createObjectURL;URL.createObjectURL=b=>{window.__missionExports.push(b);return original(b)};return true})()`);
    assert.equal(exported,true);
    await b.click('mission-export'); await b.click('mission-export-report');
    const files=await b.evaluate('Promise.all(window.__missionExports.map(b=>b.text().then(JSON.parse)))');
    assert.equal(files[0].version,1);assert.equal(files[0].name,'Browser science survey');
    assert.equal(files[1].complete,true);assert.ok(files[1].telemetry.length===24);assert.equal(files[1].sources.length,4);
    await b.click('mission-compare-saved'); await b.wait(b.exists('mission-comparison'));
    const imported=await b.evaluate(`(()=>{const input=document.querySelector('input[type=file]'),transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(${JSON.stringify({...require('../src/features/missionDesign/model').DEFAULT_DESIGN,name:'Imported lunar plan',target:'moon',instrument:'spectrometer',launcher:'heavy',budget:300})})],'design.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    void imported;
    await b.wait(b.exists('mission-apply-import'));await b.click('mission-apply-import');
    assert.equal(await b.evaluate("document.querySelector('[data-testid=mission-target]').value"),'moon');
    await b.click('mission-launch');await b.click('mission-finish');
    await b.wait("document.querySelector('[data-testid=mission-result]').textContent.includes('Science objective achieved')");
    await b.call('Page.navigate',{url});await b.wait(b.exists('mission-apply-import'));await b.click('mission-apply-import');
    assert.equal(await b.evaluate("document.querySelector('[data-testid=mission-name]').value"),'Browser science survey');
    await b.select('mission-target','mars');
    assert.equal(await b.evaluate("document.querySelector('[data-testid=mission-launch]').disabled"),true);
    await b.select('mission-launcher','heavy');await b.select('mission-panel','large');await b.select('mission-instrument','hires');
    await b.click('mission-launch');await b.click('mission-finish');
    await b.wait("document.querySelector('[data-testid=mission-result]').textContent.includes('Science objective achieved')");
    for(const [w,h] of [[390,844],[844,390]]) {
      await b.viewport(w,h);
      assert.equal(await b.evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'No viewport overflow');
      await b.screenshot('mission-design-'+w);
    }
    assert.deepEqual(b.errors,[]);
    console.log('PASS: Earth/Moon/Mars operations, four-player review reset, save, compare, file import/export, reports, shared-link routing, readiness gates and mobile layouts; no browser exceptions');
  } finally { b.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
