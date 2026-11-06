// Reproducible encoding of central-gravity.wat; no build-time compiler download.
const fs=require('node:fs'),path=require('node:path');
const unsigned=n=>{const bytes=[];do{let b=n&127;n>>>=7;if(n)b|=128;bytes.push(b)}while(n);return bytes};
const section=(id,bytes)=>[id,...unsigned(bytes.length),...bytes];
const name=[...Buffer.from('accel')];
const get=i=>[0x20,i];
// r = sqrt(x*x+y*y+z*z); return -mu*x/(r*r*r).
const body=[1,1,0x7c,...get(1),...get(1),0xa2,...get(2),...get(2),0xa2,0xa0,...get(3),...get(3),0xa2,0xa0,0x9f,0x21,4,...get(0),0x9a,...get(1),0xa2,...get(4),...get(4),0xa2,...get(4),0xa2,0xa3,0x0b];
const bytes=[0,97,115,109,1,0,0,0,...section(1,[1,0x60,4,0x7c,0x7c,0x7c,0x7c,1,0x7c]),...section(3,[1,0]),...section(7,[1,name.length,...name,0,0]),...section(10,[1,...unsigned(body.length),...body])];
const output=path.resolve(__dirname,'../public/science/models/central-gravity.wasm');fs.writeFileSync(output,Buffer.from(bytes));console.log('Built central-gravity.wasm ('+bytes.length+' bytes)');
