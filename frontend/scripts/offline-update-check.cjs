const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {browserSession}=require('./browser-session.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),base=fs.mkdtempSync('/tmp/mf-update-audit-'),builds={};
 for(const version of ['A','B']){
  const dir=path.join(base,version);fs.cpSync(path.join(root,'build'),dir,{recursive:true});
  const index=path.join(dir,'index.html');fs.appendFileSync(index,'\n<!-- upgrade fixture '+version+' -->');
  execFileSync(process.execPath,[path.join(__dirname,'build-identity.cjs')],{env:{...process.env,BUILD_PATH:dir},stdio:'pipe'});
  builds[version]={dir,id:JSON.parse(fs.readFileSync(path.join(dir,'build-info.json'))).id};
 }
 let version='A';const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml'};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),file=path.resolve(builds[version].dir,name);
  if(!file.startsWith(builds[version].dir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Service-Worker-Allowed':'/'});fs.createReadStream(file).pipe(res);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,b=await browserSession(),home=async()=>{await b.call('Page.navigate',{url:'http://127.0.0.1:'+port+'/'});await b.wait(b.exists('menu-new-mission-btn'));await b.pause(200);};
 try{
  await b.call('Network.enable');await b.call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await b.viewport(390,844);await home();
  await b.click('menu-new-mission-btn');await b.click('mission-card-first_orbit');await b.click('planner-open-hangar-btn');await b.pause(250);
  const saved=await b.evaluate("(()=>{window.missionForgeData.flush();return localStorage.getItem('mf.autosave')})()");await home();
  await b.click('offline-prepare');await b.wait("document.querySelector('[data-testid=offline-status]').textContent.includes('ready')",60000);
  assert.equal(await b.evaluate("fetch('/build-info.json').then(r=>r.json()).then(r=>r.id)"),builds.A.id);
  version='B';await home();await b.wait("document.querySelector('[data-testid=offline-prepare]').textContent.includes('Update game')",60000);
  assert.equal(await b.evaluate("fetch('/build-info.json').then(r=>r.json()).then(r=>r.id)"),builds.A.id,'Installed build must remain consistent before user applies update');
  const oldPage=await b.evaluate('performance.timeOrigin');await b.click('offline-prepare');await b.wait('performance.timeOrigin!=='+oldPage,60000);await b.wait(b.exists('menu-new-mission-btn'));
  assert.equal(await b.evaluate("fetch('/build-info.json').then(r=>r.json()).then(r=>r.id)"),builds.B.id);
  assert.equal(await b.evaluate("localStorage.getItem('mf.autosave')"),saved,'Update must preserve the saved rocket');
  const keys=await b.evaluate('caches.keys()');assert.deepEqual(keys.filter(k=>k.startsWith('mission-forge-offline-')),['mission-forge-offline-'+builds.B.id]);
  assert.deepEqual(b.errors,[]);console.log('PASS: real two-build offline update shows Update game, retains installed assets until the update is applied, reloads the new build, removes the old cache and preserves the saved rocket');
 }finally{b.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(base,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
