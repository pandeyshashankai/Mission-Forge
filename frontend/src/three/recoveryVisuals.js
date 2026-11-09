import * as THREE from 'three';

export function createRecoveryVisuals(){
 const root=new THREE.Group();root.name='Recovery visuals';
 const chute=new THREE.Group();chute.visible=false;root.add(chute);
 const geometry=new THREE.SphereGeometry(1,36,12,0,Math.PI*2,0,Math.PI/2),positions=geometry.attributes.position,colors=[];
 const cream=new THREE.Color('#ece4d3'),copper=new THREE.Color('#d77f4b');
 for(let i=0;i<positions.count;i++){const angle=Math.atan2(positions.getZ(i),positions.getX(i))+Math.PI,color=Math.floor(angle/(Math.PI*2)*12)%2?cream:copper;colors.push(color.r,color.g,color.b);}
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const canopy=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.9}));chute.add(canopy);
 const riggingGeometry=new THREE.BufferGeometry();riggingGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12*6),3));
 const rigging=new THREE.LineSegments(riggingGeometry,new THREE.LineBasicMaterial({color:'#e9e4d7',transparent:true,opacity:.8}));rigging.frustumCulled=false;chute.add(rigging);
 const glow=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshBasicMaterial({color:'#f29049',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));glow.visible=false;root.add(glow);
 const wake=new THREE.Mesh(new THREE.ConeGeometry(1,2,24,1,true),new THREE.MeshBasicMaterial({color:"#ff9a4d",transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));wake.visible=false;root.add(wake);
 root.userData={chute,canopy,rigging,glow,wake};return root;
}
// Existing chute state/CdA, inflation time and heat flux drive appearance only.
// This function never adds aerodynamic forces or changes the simulation.
export function updateRecoveryVisuals(root,{state='stowed',time=0,chuteTime=0,drogueCdA=22,mainCdA=1200,top=4,bottom=0,bodyWidth=3,flux=0}){
 const {chute,canopy,rigging,glow,wake}=root.userData,active=state==='drogue'||state==='main';
 chute.visible=active;
 let extraHeight=0,width=bodyWidth;
 if(active){
  const inflation=Math.max(0,Math.min(1,(time-chuteTime)/(state==='main'?8:2)));
  // One equivalent canopy represents the pack's total drag area.
  const area=state==='main'?drogueCdA+(mainCdA-drogueCdA)*inflation:drogueCdA*Math.max(.03,inflation);
  const r=Math.sqrt(area/(Math.PI*1.5)),lines=r*1.25;
  chute.position.y=top;canopy.position.y=lines;canopy.scale.set(r,r*.5,r);
  const a=rigging.geometry.attributes.position.array;
  if(rigging.userData.radius!==r){
  for(let i=0;i<12;i++){const angle=i*Math.PI/6,k=i*6;a[k]=0;a[k+1]=0;a[k+2]=0;a[k+3]=Math.cos(angle)*r;a[k+4]=lines;a[k+5]=Math.sin(angle)*r;}
  rigging.geometry.attributes.position.needsUpdate=true;rigging.userData.radius=r;
  }
  extraHeight=lines+r*.5;width=Math.max(width,2*r);
 }
 const heat=Math.max(0,Math.min(.38,Math.log10(1+Math.max(0,flux)/50000)*.18));
 glow.visible=heat>.015;glow.material.opacity=heat;glow.position.y=bottom+.1;glow.scale.set(Math.max(.6,bodyWidth*.56),Math.max(.15,bodyWidth*.17),Math.max(.6,bodyWidth*.56));
 wake.visible=glow.visible;wake.material.opacity=heat*.4;wake.position.y=bottom+bodyWidth*.7;wake.scale.set(bodyWidth*.65,bodyWidth*.9,bodyWidth*.65);
 return {top:top+extraHeight,width,chute:active,heat:glow.visible};
}
