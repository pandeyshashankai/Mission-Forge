import { useEffect, useState } from 'react';
import { useGame } from '../../game/GameContext';
import { searchCommands } from '../../features/navigation';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
export function CommandPalette() {
  const g = useGame(),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0),
    commands = searchCommands(query);
  useEffect(() => {
    const key = e => {
      if(g.settingsOpen)return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopImmediatePropagation();
        g.setOverlayOpen(v => !v);
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [g.setOverlayOpen,g.settingsOpen]);
  const choose = c => {
    if (!c) return;
    g.setOverlayOpen(false);
    setQuery('');
    setActive(0);
    g.go(c.id);
  };
  return <Dialog open={g.overlayOpen} onOpenChange={g.setOverlayOpen}><DialogContent className="command-palette" data-testid="command-palette"><DialogTitle>Go to…</DialogTitle><DialogDescription>Search the workspace. Flight pauses while this menu is open.</DialogDescription><input autoFocus aria-label="Search commands" data-testid="command-search" value={query} onChange={e => {
        setQuery(e.target.value);
        setActive(0);
      }} onKeyDown={e => {
        if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
          e.preventDefault();
          if (e.key === 'Enter') choose(commands[active]);else setActive(i => commands.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length : 0);
        }
      }} /><div className="command-results">{commands.map((c, i) => <button key={c.id} className="ui-button" data-active={i === active} data-testid={'command-' + c.id} onClick={() => choose(c)}><strong>{c.label}</strong><small>{c.hint}</small></button>)}{!commands.length && <p role="status">No matching workspace.</p>}</div></DialogContent></Dialog>;
}
