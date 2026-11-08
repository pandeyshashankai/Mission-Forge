"""Render a clearly labelled recorded example from an actual exported FlightSim result."""
import argparse
import html
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Render a private recorded-flight handout.')
parser.add_argument('--directory', type=Path, required=True)
args = parser.parse_args()
folder = args.directory.expanduser().resolve()
if folder.is_relative_to(ROOT):
    parser.error('Keep submission handouts outside the public repository.')
data = json.loads((folder / 'showcase-result.json').read_text())
result = data['result']
if data['kind'] != 'recorded-simulation-example' or result['outcome'] != 'success':
    raise ValueError('Expected a successful, explicitly labelled simulation export')
samples = result['telemetry']
def chart(key, color, label):
    maximum = max(row[key] for row in samples)
    points = ' '.join(f"{35+row['t']/result['summary']['flightTime']*730:.2f},{200-row[key]/maximum*170:.2f}" for row in samples)
    return f'<section><h2>{label}</h2><svg viewBox="0 0 800 230" role="img" aria-label="{html.escape(label)} over recorded flight time"><path d="M35 25V200H775" fill="none" stroke="#69829c"/><polyline points="{points}" fill="none" stroke="{color}" stroke-width="3"/><text x="35" y="222">T+0</text><text x="650" y="222">T+{result["summary"]["flightTime"]:.0f} s</text><text x="40" y="22">Maximum {maximum:.1f}</text></svg></section>'
summary = result['summary']
body = f'''<span class="tag">Recorded simulation example</span><h1>First Orbit · successful guided flight</h1><p>{html.escape(data['notice'])}</p><dl><div><dt>Outcome</dt><dd>{result['outcome']}</dd></div><div><dt>Periapsis</dt><dd>{summary['peri']/1000:.1f} km</dd></div><div><dt>Apoapsis</dt><dd>{summary['apo']/1000:.1f} km</dd></div><div><dt>Flight time</dt><dd>{summary['flightTime']:.0f} s</dd></div></dl>{chart('alt','#65e2ee','Altitude (km)')}{chart('speed','#ffcf7b','Inertial speed (m/s)')}<section><h2>Recorded events</h2><ol>'''
for event in result['log']:
    body += f"<li><strong>T+{event['t']:.0f} s</strong> {html.escape(event['text'])}</li>"
body += '</ol></section><p><a href="showcase-result.json" download>Download the full recorded result and telemetry</a> · <a href="presentation.html">Presentation</a> · <a href="/">Open the live game</a></p><p>This illustrates a successful simulation. It does not establish educational effectiveness or measured spacecraft accuracy.</p>'
css = '''body{margin:30px auto;padding:0 20px;max-width:1000px;background:#0a1423;color:#eff7ff;font:16px/1.75 system-ui,sans-serif}h1{font-size:36px;line-height:1.2}p,li,dt{color:#b9cadd}.tag{color:#79ebef;font-weight:750}dl{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}dl>div,section{padding:20px;border:1px solid #30465f;background:#14243a;border-radius:14px;margin:18px 0}dd{margin:7px 0;font-size:22px;font-weight:700}dt{font-size:12px}svg{width:100%;height:auto}text{font:13px system-ui;fill:#bfd0e1}a{color:#79ebef}li{margin:8px 0}@media(max-width:600px){dl{grid-template-columns:1fr 1fr}h1{font-size:28px}}'''
(folder / 'showcase-replay.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mission Forge · Recorded showcase</title><style>{css}</style><main>{body}</main></html>')
print('Built labelled showcase-replay.html from real simulator telemetry')
