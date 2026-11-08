import * as THREE from 'three';

function surfaceTexture(grass,quality){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas'),size=quality==='low'?128:256;canvas.width=size;canvas.height=size;
 const context=canvas.getContext('2d'),pixels=context.createImageData(size,size),base=grass?[101,120,82]:[197,201,191];
 let seed=9271;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  seed=(1664525*seed+1013904223)>>>0;
  const grain=(seed/4294967296-.5)*14+Math.sin(x*.09)*Math.cos(y*.11)*(grass?11:3),i=(y*size+x)*4;
  for(let c=0;c<3;c++)pixels.data[i+c]=base[c]+grain;pixels.data[i+3]=255;
 }
 context.putImageData(pixels,0,0);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 if(grass)texture.repeat.set(45,45);texture.anisotropy=4;return texture;
}

// Static scenery is instanced by material/primitive so a detailed station stays
// inexpensive on phones. These objects do not alter the flight/contact model.
export function buildLaunchStation(height=90,quality='medium'){
 const root=new THREE.Group();root.name='Launch station';
 const segments=quality==='low'?12:24;
 const geometry={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,segments),sphere:new THREE.SphereGeometry(1,segments,8)};
 const materials={
  concrete:new THREE.MeshStandardMaterial({color:'#a3aaa6',roughness:.95}),
  dark:new THREE.MeshStandardMaterial({color:'#253039',roughness:.85}),
  steel:new THREE.MeshStandardMaterial({color:'#89979e',metalness:.65,roughness:.42}),
  red:new THREE.MeshStandardMaterial({color:'#b94d36',metalness:.4,roughness:.55}),
  white:new THREE.MeshStandardMaterial({color:'#e3e5de',metalness:.25,roughness:.55}),
  yellow:new THREE.MeshStandardMaterial({color:'#efb936',roughness:.7}),
  light:new THREE.MeshStandardMaterial({color:'#f7e9be',emissive:'#f4d59a',emissiveIntensity:.6}),
 };
 const batches=new Map(),dummy=new THREE.Object3D();
 const add=(primitive,material,position,scale,quaternion)=>{
  const key=primitive+':'+material;if(!batches.has(key))batches.set(key,{primitive,material,matrices:[]});
  dummy.position.set(...position);dummy.scale.set(...scale);dummy.quaternion.copy(quaternion||new THREE.Quaternion());dummy.updateMatrix();batches.get(key).matrices.push(dummy.matrix.clone());
 };
 const box=(material,x,y,z,w,h,d)=>add('box',material,[x,y,z],[w,h,d]);
 const pipe=(material,a,b,r=.15)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),direction=to.clone().sub(from);add('cylinder',material,from.clone().add(to).multiplyScalar(.5).toArray(),[r,direction.length(),r],new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));};
 const grassTexture=surfaceTexture(true,quality),concreteTexture=surfaceTexture(false,quality);root.userData.textures=[grassTexture,concreteTexture].filter(Boolean);
 materials.concrete.map=concreteTexture;
 const land=new THREE.Mesh(new THREE.CircleGeometry(2500,48),new THREE.MeshStandardMaterial({color:'#a7b59d',roughness:1,map:grassTexture}));land.rotation.x=-Math.PI/2;land.position.y=.4;root.add(land);
 add('cylinder','concrete',[0,.9,0],[76,1.4,76]);
 box('dark',0,1.65,0,15,.1,112);
 for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)if(Math.abs(x)>0)box('concrete',x*17,1.64,z*17,16.8,.12,16.8);
 // Flame deflector and the open exhaust channel, below the rocket's base.
 box('steel',0,1.76,-37,13,.16,25);box('dark',0,1.7,53,14,.12,24);
 for(const x of [-9,9])box('yellow',x,1.82,0,.35,.08,100);
 for(const side of [-1,1])for(let i=0;i<9;i++)box('yellow',side*11,1.82,-46+i*11,2,.08,.55);
 box('dark',0,.65,490,24,.3,830);
 for(let z=110;z<870;z+=28)box('yellow',0,.82,z,.3,.02,12);
 for(const x of [-12,12])box('white',x,.82,490,.25,.02,820);
 // Open steel service gantry: columns, cross bracing and floor landings.
 const h=Math.max(55,Math.min(140,height+8)),tx=25,tz=-10;
 for(const x of [tx-5,tx+5])for(const z of [tz-5,tz+5])pipe('steel',[x,2,z],[x,h,z],.38);
 for(let y=3;y<h;y+=9){
  box('dark',tx,y,tz,12,.35,12);
  for(const z of [tz-5,tz+5]){pipe('red',[tx-5,y,z],[tx+5,Math.min(h,y+9),z],.16);pipe('red',[tx+5,y,z],[tx-5,Math.min(h,y+9),z],.16);}
  for(const x of [tx-5,tx+5])pipe('steel',[x,y,tz-5],[x,Math.min(h,y+9),tz+5],.16);
  pipe('yellow',[tx-6,y+1.3,tz-6],[tx+6,y+1.3,tz-6],.08);
 }
 box('red',tx,h+1,tz,14,2.5,14);
 for(const fraction of [.34,.62,.84]){
  const y=h*fraction;box('steel',13,y,tz,16,.65,3);pipe('yellow',[5,y+1.3,tz-1.5],[21,y+1.3,tz-1.5],.08);pipe('white',[6,y-.6,tz],[24,y-.6,tz],.25);
 }
 pipe('steel',[tx,h+2,tz],[tx,h+17,tz],.14);
 // Cryogenic storage, deluge reservoir, feed lines and floodlight heads.
 for(const x of [-68,-92]){
  add('cylinder','white',[x,9,-35],[7,16,7]);add('sphere','white',[x,17,-35],[7,3,7]);
  box('dark',x,1.7,-35,17,1.8,17);pipe('steel',[x,2.8,-35],[x,2.8,10],.45);pipe('steel',[x,2.8,10],[-15,2.8,10],.45);
 }
 for(const x of [60,72])for(const z of [-48,-36])pipe('steel',[x,1,z],[x,29,z],.3);
 add('sphere','white',[66,32,-42],[9,6,9]);pipe('steel',[66,27,-42],[66,2,-42],.55);pipe('steel',[66,2,-42],[10,2,-42],.55);
 for(const x of [-66,66])for(const z of [-70,70]){pipe('steel',[x,1,z],[x,27,z],.28);box('dark',x,27,z,7,1.7,2);box('light',x,26.9,z+1.03,6,1.2,.1);}
 for(const batch of batches.values()){
  const mesh=new THREE.InstancedMesh(geometry[batch.primitive],materials[batch.material],batch.matrices.length);
  batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
 }
 root.userData.instancedBatches=batches.size;
 return root;
}
