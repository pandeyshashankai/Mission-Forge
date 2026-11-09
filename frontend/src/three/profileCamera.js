import * as THREE from 'three';

// A narrow perspective keeps the side profile almost parallel while retaining
// the logarithmic depth precision required by the real-size planetary scene.
export function profileFraming(height,width,viewportWidth,viewportHeight,zoom=1){
 const w=Math.max(160,viewportWidth||390),h=Math.max(160,viewportHeight||700);
 const usableW=Math.max(w*.45,w-150),usableH=Math.max(h*.5,h-240);
 const span=Math.max(2,Math.max(0,height)*h/usableH,Math.max(0,width)*h/usableW)*Math.max(.25,Math.min(40,zoom));
 const fov=1;
 return {span,fov,distance:span/(2*Math.tan(fov*Math.PI/360))};
}
export function profileBasis(up,heading=90){
 const vertical=up.clone().normalize();
 if(vertical.lengthSq()<.1)vertical.set(0,1,0);
 const east=new THREE.Vector3(0,1,0).cross(vertical);
 if(east.lengthSq()<1e-8)east.set(0,0,1).cross(vertical);
 east.normalize();
 const north=vertical.clone().cross(east).normalize(),angle=heading*Math.PI/180;
 const right=east.multiplyScalar(Math.sin(angle)).addScaledVector(north,Math.cos(angle)).normalize();
 return {up:vertical,right,normal:right.clone().cross(vertical).normalize()};
}
