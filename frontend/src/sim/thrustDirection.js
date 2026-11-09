import {add,cross,norm,scale} from './vec';

// Rocket meshes use +Y as their axis; the physics frame maps renderer (x,y,z)
// to inertial (x,-z,y). Rotate in that same mesh frame before converting back.
export function thrustDirection(axis,force){
 const d=[axis[0],axis[2],-axis[1]],v=force;
 const w=1+d[1];let rotated;
 if(w<Number.EPSILON)rotated=[-v[0],-v[1],v[2]];
 else{const m=Math.hypot(d[2],d[0],w),q=[d[2]/m,0,-d[0]/m],t=scale(cross(q,v),2);rotated=add(add(v,scale(t,w/m)),cross(q,t));}
 return norm([rotated[0],-rotated[2],rotated[1]]);
}
