import {PARTS} from './parts';
import {attachedNodes} from './crew';
import {stagnationFlux} from './entry';
import {dot,norm,scale,sub,cross} from './vec';

// Educational skin-temperature limits, not certified spacecraft material data.
// Celsius is presentation only; radiation and heat capacity use kelvin/SI.
export function thermalMaterial(part){
 if(part.heatShield)return {limitC:2800,cp:1200,emissivity:.8,skinFraction:.3};
 if(part.engine)return {limitC:1200,cp:600,emissivity:.8,skinFraction:.15};
 if(part.look==='solar')return {limitC:180,cp:900,emissivity:.85,skinFraction:.15};
 if(part.control||part.payload)return {limitC:250,cp:900,emissivity:.8,skinFraction:.12};
 if(part.parachute)return {limitC:220,cp:1000,emissivity:.8,skinFraction:.15};
 return {limitC:650,cp:900,emissivity:.8,skinFraction:.08};
}
export function thermalNodes(sim){return [...attachedNodes(sim).filter(n=>!PARTS[n.partId].fairing||sim.rt.sections.some(s=>s.attached&&s.fairings.some(f=>f.uid===n.uid&&f.attached))),...sim.rt.radials.filter(r=>r.attached).map(r=>({uid:r.uid,partId:r.partId}))];}
export function flightThermalStep(sim,nav,seconds){
 const e=sim.entry,t=e.thermal||(e.thermal={parts:{},shieldRemaining:1,failure:null});
 if(t.failure||!(seconds>0))return;
 if(sim.isEnded()&&!/heat shield|burned up|ablator/i.test(sim.endReason||''))return;
 const nodes=thermalNodes(sim),shieldNode=nodes.find(n=>PARTS[n.partId].heatShield),shield=shieldNode&&PARTS[shieldNode.partId];
 const flux=nav.body==='earth'&&nav.atm.rho>0?stagnationFlux(nav.atm.rho,nav.surfSpeed,Math.max(.5,sim.aero.noseRadius)):0;
 t.flux=flux;e.flux=flux;
 t.shieldRemaining=shield?Math.max(0,1-e.heatLoad/shield.heatShield.capacity):0;
 const relative=nav.vRel||sub(sim.v,cross([0,0,7.292115e-5],sim.r));
 const aligned=dot(sim.dir,scale(norm(relative),-1))>.65;
 const fairing=nodes.some(n=>PARTS[n.partId].fairing);
 const ambient=nav.atm.rho>0?Math.max(150,Math.min(293.15,nav.atm.T||288.15)):220;
 for(const n of nodes){
  const p=PARTS[n.partId],m=thermalMaterial(p);
  let s=Object.hasOwn(t.parts,n.uid)?t.parts[n.uid]:null;
  if(!s){s={temperature:293.15,peak:293.15,warned:false};Object.defineProperty(t.parts,n.uid,{value:s,enumerable:true,writable:true,configurable:true});}
  const protectedPart=shield&&n.uid!==shieldNode.uid&&aligned&&t.shieldRemaining>0&&p.diameter<=shield.diameter*1.05;
  const exposure=p.heatShield?1:protectedPart ? .003 : fairing&&(p.control||p.payload) ? .015 : .12;
  const area=Math.PI*(p.diameter/2)**2,capacity=Math.max(3000,Math.min(250,p.dryMass*m.skinFraction)*m.cp);
  if(flux===0&&Math.abs(s.temperature-ambient)<.1){s.temperature=ambient;continue;}
  let left=seconds;
  while(left>1e-9){const dt=Math.min(.1,left),radiated=m.emissivity*5.670374419e-8*area*(s.temperature**4-ambient**4);
   let incoming=flux*area*exposure;
   // Ablation carries most of the surface heat away while capacity remains.
   if(p.heatShield&&t.shieldRemaining>0&&s.temperature>1100)incoming*=.15;
   s.temperature=Math.max(ambient,Math.min(6000,s.temperature+(incoming-radiated)*dt/capacity));left-=dt;
  }
  s.peak=Math.max(s.peak,s.temperature);const c=s.temperature-273.15;
  if(c>=m.limitC*.8&&!s.warned){s.warned=true;sim.addLog('warn',`${p.name} hot: ${c.toFixed(0)} °C / ${m.limitC} °C limit`);}
  if(c>=m.limitC){t.failure={uid:n.uid,partId:n.partId,temperature:c,limit:m.limitC,t:sim.t};sim.throttle=0;sim.crewLost=!!sim.aero.crew;sim.end('crashed',`${p.name} overheated at ${c.toFixed(0)} °C (limit ${m.limitC} °C) — thermal breakup`);break;}
 }
 // Legacy flux/ablator failures also receive the same visible breakup.
 if(sim.isEnded()&&!t.failure&&/heat shield|burned up|ablator/i.test(sim.endReason||''))t.failure={uid:shieldNode?.uid||nodes[0]?.uid,temperature:thermalSummary(sim)?.celsius||20,limit:shield?2800:250,t:sim.t};
}
export function thermalSummary(sim){
 const t=sim.entry?.thermal;if(!t)return null;let worst=null;
 for(const n of thermalNodes(sim)){const s=Object.hasOwn(t.parts,n.uid)?t.parts[n.uid]:null;if(!s)continue;const p=PARTS[n.partId],limit=thermalMaterial(p).limitC,celsius=s.temperature-273.15,pct=Math.max(0,Math.min(100,100*(celsius-20)/(limit-20)));
  if(!worst||pct>worst.pct)worst={name:p.name,celsius,limit,pct,uid:n.uid};}
 return worst?{...worst,shield:thermalNodes(sim).some(n=>PARTS[n.partId].heatShield)?t.shieldRemaining:null,failed:!!t.failure}:null;
}
export function validateFlightThermal(value,design){
 if(value===undefined)return;
 const ids=new Set([...design.stack,...(design.radials||[])].map(n=>n.uid));
 if(!value||!value.parts||typeof value.parts!=='object'||Array.isArray(value.parts)||Object.keys(value.parts).length>ids.size||!Number.isFinite(value.shieldRemaining)||value.shieldRemaining<0||value.shieldRemaining>1)throw Error('Invalid thermal save');
 for(const [uid,s]of Object.entries(value.parts))if(!ids.has(uid)||!s||!Number.isFinite(s.temperature)||s.temperature<1||s.temperature>6000||!Number.isFinite(s.peak)||s.peak<s.temperature||s.peak>6000||typeof s.warned!=='boolean')throw Error('Invalid saved part temperature');
 if(value.failure&&(!ids.has(value.failure.uid)||!Number.isFinite(value.failure.temperature)||!Number.isFinite(value.failure.limit)||value.failure.limit<=0))throw Error('Invalid thermal failure');
}
export function explorationThermalSummary(sim){
 if(!sim.physics.damage)return null;
 const backing=['pica-virgin','avcoat-virgin','avcoat-char'].includes(sim.physics.thermalMaterial),temperature=backing?sim.damage.backTemperature:sim.damage.temperature,limit=sim.physics.thermalMaterial==='aluminium'?933.61:1000;
 return {name:backing?'Hull backing':'Hull',celsius:temperature-273.15,limit:Math.round((limit-273.15)*10)/10,pct:Math.max(0,Math.min(100,100*(temperature-293.15)/(limit-293.15))),shield:sim.damage.shieldKg/120,failed:sim.damage.integrity<=0};
}
