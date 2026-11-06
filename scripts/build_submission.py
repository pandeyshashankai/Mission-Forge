"""Build standalone submission HTML and printable PDFs from the reviewed Markdown.

Uses the environment's ReportLab package for PDF output; no runtime game dependency.
"""
import html
import re
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'frontend/public/submission'
OUT.mkdir(parents=True, exist_ok=True)
font = Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('ReportSans', str(font / 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('ReportSans-Bold', str(font / 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFontFamily('ReportSans', normal='ReportSans', bold='ReportSans-Bold', italic='ReportSans', boldItalic='ReportSans-Bold')

def inline(text):
    escaped = html.escape(text)
    escaped = re.sub(r'https?://[^\s<>]+', lambda match: '<a href="'+match.group(0)+'">'+match.group(0)+'</a>', escaped)
    escaped = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', escaped)
    return re.sub(r'`(.+?)`', r'<font name="ReportSans">\1</font>', escaped)

def blocks(text):
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            i += 1
            code = []
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i]); i += 1
            i += 1
            yield 'code', '\n'.join(code)
            continue
        if line.startswith('#'):
            level = len(line) - len(line.lstrip('#'))
            yield f'h{level}', line[level:].strip(); i += 1
            continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [s.strip() for s in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[:\- ]+', c) for c in cells): rows.append(cells)
                i += 1
            yield 'table', rows
            continue
        if line.startswith('- ') or re.match(r'^\d+\. ', line):
            ordered = not line.startswith('- ')
            items = []
            while i < len(lines) and (lines[i].startswith('- ') or re.match(r'^\d+\. ', lines[i])):
                items.append(re.sub(r'^(- |\d+\. )', '', lines[i])); i += 1
            yield 'ol' if ordered else 'ul', items
            continue
        para = []
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','```','- ')):
            para.append(lines[i].strip()); i += 1
        yield 'p', ' '.join(para)

styles = getSampleStyleSheet()
for name in ['Normal','Title','Heading1','Heading2','Heading3','BodyText']:
    styles[name].fontName = 'ReportSans'
styles.add(ParagraphStyle(name='ReportBody',fontName='ReportSans',fontSize=9,leading=14,spaceAfter=9,splitLongWords=True))
styles.add(ParagraphStyle(name='ReportCell',fontName='ReportSans',fontSize=8,leading=12,splitLongWords=True))
styles.add(ParagraphStyle(name='ReportHeadCell',fontName='ReportSans-Bold',fontSize=8,leading=12,textColor=colors.white,splitLongWords=True))
styles['Heading1'].fontName='ReportSans-Bold'; styles['Heading2'].fontName='ReportSans-Bold'

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont('ReportSans',8);canvas.setFillColor(colors.HexColor('#53647a'))
    canvas.drawString(18*mm,12*mm,'Mission Forge · Shashank Pandey · 5 November 2026')
    canvas.drawRightString(192*mm,12*mm,str(doc.page));canvas.restoreState()

CSS = '''body{font:16px/1.75 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 22px;color:#15273d;background:#f6f8fb}h1{font-size:42px;line-height:1.15;color:#0b5362}h2{margin-top:35px;line-height:1.35}p,li{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px;margin:20px 0}th,td{padding:12px;text-align:left;vertical-align:top;border:1px solid #c9d4e0}th{background:#17354b;color:white}pre{padding:18px;background:#e5edf3;overflow:auto;font-size:13px}a{color:#006b86}nav{display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid #c9d4e0;padding-bottom:15px}.table-wrap{overflow:auto}@media print{body{background:white;margin:0;font-size:11pt}nav{display:none}h2{break-after:avoid}tr{break-inside:avoid}a{color:inherit}}'''
for stem in ['project-report','demo-script','user-testing-protocol']:
    text = (ROOT / 'docs/submission' / f'{stem}.md').read_text()
    parsed = list(blocks(text))
    html_parts=[]; story=[]
    for kind,value in parsed:
        if kind.startswith('h'):
            html_parts.append(f'<{kind}>{inline(value)}</{kind}>')
            style = styles['Title'] if kind=='h1' else styles['Heading1'] if kind=='h2' else styles['Heading2']
            story.append(Paragraph(inline(value),style))
        elif kind=='p':
            html_parts.append(f'<p>{inline(value)}</p>');story.append(Paragraph(inline(value),styles['ReportBody']))
        elif kind in ['ul','ol']:
            html_parts.append(f'<{kind}>'+''.join(f'<li>{inline(x)}</li>' for x in value)+f'</{kind}>')
            for index,item in enumerate(value):
                story.append(Paragraph((f'{index+1}. ' if kind=='ol' else '• ')+inline(item),styles['ReportBody']))
        elif kind=='code':
            html_parts.append(f'<pre>{html.escape(value)}</pre>');story.append(Preformatted(value,ParagraphStyle(name='Code',fontName='Courier',fontSize=7,leading=11)))
        elif kind=='table':
            html_parts.append('<div class="table-wrap"><table>'+''.join('<tr>'+''.join(f'<{"th" if n==0 else "td"}>{inline(c)}</{"th" if n==0 else "td"}>' for c in row)+'</tr>' for n,row in enumerate(value))+'</table></div>')
            rows=[[Paragraph(inline(c),styles['ReportHeadCell' if n==0 else 'ReportCell']) for c in row] for n,row in enumerate(value)]
            table=Table(rows,colWidths=[174*mm/len(value[0])]*len(value[0]),repeatRows=1,hAlign='LEFT')
            table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#17354b')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#ccd6e0')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
            story.extend([table,Spacer(1,12)])
    # ReportLab's inline font tags are harmless in HTML, but remove them from the web copy.
    body='\n'.join(html_parts);body=re.sub(r'</?font[^>]*>','',body)
    title=stem.replace('-',' ').title()
    (OUT / f'{stem}.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mission Forge · {title}</title><style>{CSS}</style><nav><a href="/">Open Mission Forge</a><a href="presentation.html">Presentation</a><a href="{stem}.pdf" download>Download PDF</a></nav><main>{body}</main></html>')
    SimpleDocTemplate(str(OUT/f'{stem}.pdf'),pagesize=(210*mm,297*mm),rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=20*mm,title=f'Mission Forge — {title}',author='Shashank Pandey').build(story,onFirstPage=footer,onLaterPages=footer)
    print(f'Built {stem}.html and {stem}.pdf')

(OUT / "presentation.html").write_bytes((ROOT / "docs/submission/presentation.html").read_bytes())

(OUT / "validation-results.json").write_bytes((ROOT / "docs/submission/validation-results.json").read_bytes())
