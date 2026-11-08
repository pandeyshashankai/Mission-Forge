import {useId} from 'react';
import {PartDrawing,MetalGradient} from './PartDrawing';
export function PartIcon({part}){
 const id='part-'+useId().replace(/:/g,''),w=part.diameter,h=part.height,pad=Math.max(w*.12,.15);
 return <svg viewBox={`${-w/2-pad} ${-h-pad} ${w+pad*2} ${h+pad*2}`} className="part-thumbnail" aria-hidden="true"><defs><MetalGradient id={id}/></defs><PartDrawing part={part} metal={id}/></svg>;
}
