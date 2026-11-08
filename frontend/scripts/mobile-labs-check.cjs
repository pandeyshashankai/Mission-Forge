const assert = require('node:assert/strict');
const {browserSession}=require('./browser-session.cjs');
(async()=>{
  const b=await browserSession();const results=[];
  async function dimensions(selector){return b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,client:e.clientHeight,content:e.scrollHeight,scroll:e.scrollTop,width:innerWidth,height:innerHeight};})()`);}
  async function gesture(selector,direction,touch){
    const m=await dimensions(selector);const distance=Math.floor(Math.max(60,(m.bottom-m.top)*.65));
    const x=m.right-6,y=direction<0?Math.min(m.height-35,m.bottom-35):m.top+35;
    if(touch){
      await b.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      for(let i=1;i<=12;i++){
        await b.call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+direction*distance*i/12,id:1}]});
        await b.pause(16);
      }
      await b.pause(100);
      await b.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }else{
      await b.call('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:-direction*distance});
    }
    await b.pause(150);
  }
  async function check(label,selector,touch){
    await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollTop=0`);
    const first=await dimensions(selector);
    assert.ok(first.bottom<=first.height+1,`${label}: content container outside viewport`);
    assert.ok(await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),`${label}: horizontal overflow`);
    if(first.content>first.client+8){
      await gesture(selector,-1,touch);
      assert.ok((await dimensions(selector)).scroll>0,`${label}: real ${touch?'touch':'wheel'} gesture did not scroll`);
      let current=await dimensions(selector);
      for(let i=0;current.content-current.client-current.scroll>3 && i<45;i++){await gesture(selector,-1,touch);current=await dimensions(selector);}
      assert.ok(current.content-current.client-current.scroll<=3,`${label}: bottom cannot be reached`);
      const atBottom=current.scroll;await gesture(selector,1,touch);
      assert.ok((await dimensions(selector)).scroll<atBottom,`${label}: cannot scroll back`);
    }
    results.push(label);console.log('PASS:',label);
  }
  try{
    await b.call('Network.enable');
    await b.call('Network.clearBrowserCache');
    await b.call('Network.setCacheDisabled',{cacheDisabled:true});
    for(const [width,height,touch] of [[320,568,true],[390,844,true],[844,390,true],[768,1024,true],[1366,768,false]]){
      await b.viewport(width,height,2);await b.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:touch});await b.call('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:5});
      await b.home();await b.click('menu-showcase-btn');
      await check(`${width}x${height} guided showcase`,'.showcase-layout',touch);
      await b.click('showcase-begin');await b.wait(b.exists('science-lab'));
      await check(`${width}x${height} mission lab`,'.science-layout',touch);
      await b.home();await b.click('menu-sandbox-btn');
      for(const tab of ['transfers','loading','fracture','engine','threebody','frames','thermal','performance','worlds']){
        await b.click('sandbox-tab-'+tab);
        await check(`${width}x${height} sandbox ${tab}`,'.showcase-layout',touch);
      }
      if(width===390)await b.screenshot('mobile-labs-scroll-fixed');
    }
    assert.deepEqual(b.errors,[]);console.log(`PASS: ${results.length} lab/profile scroll cases; actual gestures, both directions, bottom reachability and horizontal bounds`);
  }finally{b.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
