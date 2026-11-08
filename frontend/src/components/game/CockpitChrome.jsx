import {Menu,Map,Pause,Play,SlidersHorizontal,ChevronsLeft,ChevronsRight} from 'lucide-react';

export function CockpitChrome({visible,menuOpen,onMenu,onMap,onPause,onInstruments,paused,warp,onWarp,altitude,speed,exploration=false}) {
  if(!visible)return null;
  return <>
    <nav className="cockpit-corners" aria-label="Flight shortcuts" data-testid="cockpit-shortcuts">
      <div className="cockpit-corner-left">
        <button type="button" aria-label="Flight menu" aria-expanded={menuOpen} data-testid="cockpit-menu" onClick={onMenu}><Menu size={20}/></button>
        <button type="button" aria-label="Toggle orbit map" data-testid="cockpit-map" onClick={onMap}><Map size={17}/><span>Map</span></button>
        <button type="button" aria-label={paused?'Resume flight':'Pause flight'} data-testid="cockpit-pause" onClick={onPause}>{paused?<Play size={18}/>:<Pause size={18}/>}</button>
        <button type="button" aria-label="Open flight instruments" data-testid={exploration?'explore-instruments-toggle':'cockpit-instruments'} onClick={onInstruments}><SlidersHorizontal size={19}/></button>
      </div>
      <div className="cockpit-corner-right" aria-label="Simulation speed">
        <button type="button" aria-label="Decrease time speed" data-testid="cockpit-warp-down" onClick={()=>onWarp('warpDown')}><ChevronsLeft size={22}/></button>
        <button type="button" aria-label="Increase time speed" data-testid="cockpit-warp-up" onClick={()=>onWarp('warpUp')}><ChevronsRight size={22}/></button>
        <output data-testid="cockpit-warp">{warp.toLocaleString()}×</output>
      </div>
    </nav>
    <div className="cockpit-readings" data-testid="cockpit-readings"><span>Altitude <strong>{altitude>=10000?(altitude/1000).toFixed(1)+' km':Math.max(0,altitude).toFixed(0)+' m'}</strong></span><span>Velocity <strong>{Math.round(speed).toLocaleString()} m/s</strong></span></div>
  </>;
}
