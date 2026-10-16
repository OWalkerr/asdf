#!/usr/bin/env python3
"""Pack baked atlases into game/index.html between the @atlas markers.

usage: python3 pack.py <key>:<k>[:<eye rgb>] ...   e.g.  python3 pack.py fox:1 ghoul:3.2:255,170,90
Reads out/<key>.png + out/<key>.json (render.js output). Every frame is trimmed to its pixels and shelf-packed into one
WebP sheet (copied to game/assets/<key>_atlas.webp) that is embedded as base64. k is the drawn body length in enemy
radii (for the fox: a multiplier on its fixed size)."""
import base64, io, json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
INDEX = os.path.join(ROOT, 'game', 'index.html'); SHEET_W = 2048; PAD = 2
lines = []
for spec in sys.argv[1:]:
    parts = spec.split(':'); key, k = parts[0], float(parts[1]); eye = parts[2] if len(parts) > 2 else None
    m = json.load(open(os.path.join(HERE, 'out', key + '.json'))); src = Image.open(os.path.join(HERE, 'out', key + '.png')).convert('RGBA')
    fw, fh, dirs = m['fw'], m['fh'], m.get('dirs', [0]); nrows = len(m['anims'])
    crops = []  # (anim, dir, i, image, ox, oy)
    for name, a in m['anims'].items():
        for di in range(len(dirs)):
            row = di * nrows + a['row']
            for i in range(a['n']):
                cell = src.crop((i * fw, row * fh, (i + 1) * fw, (row + 1) * fh)); bb = cell.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox() or (0, 0, 1, 1)
                bb = (max(0, bb[0] - PAD), max(0, bb[1] - PAD), min(fw, bb[2] + PAD), min(fh, bb[3] + PAD))
                crops.append((name, di, i, cell.crop(bb), bb[0], bb[1]))
    # shelf packing, tallest first
    order = sorted(range(len(crops)), key=lambda j: -crops[j][3].height); x = y = shelf = 0; pos = {}
    for j in order:
        im = crops[j][3]
        if x + im.width > SHEET_W: x = 0; y += shelf; shelf = 0
        pos[j] = (x, y); x += im.width; shelf = max(shelf, im.height)
    sheet = Image.new('RGBA', (SHEET_W, y + shelf), (0, 0, 0, 0))
    for j, (sx, sy) in pos.items(): sheet.paste(crops[j][3], (sx, sy))
    buf = io.BytesIO(); sheet.save(buf, 'WEBP', quality=88, method=6); data = buf.getvalue()
    os.makedirs(os.path.join(ROOT, 'game', 'assets'), exist_ok=True); open(os.path.join(ROOT, 'game', 'assets', key + '_atlas.webp'), 'wb').write(data)
    # meta: f[dir][i] = [sx, sy, w, h, ox, oy] (ox/oy = crop offset inside the original cell); p[name][dir][i] = cell-space points
    c = {'g': [round(v, 1) for v in m['ground']], 'u': round(m['unit'], 2), 'l': m['len'], 'd': dirs, 'a': {}}
    for j, (name, di, i, im, ox, oy) in enumerate(crops):
        a = c['a'].setdefault(name, {'n': m['anims'][name]['n'], 'f': [[None] * m['anims'][name]['n'] for _ in dirs]})
        a['f'][di][i] = [pos[j][0], pos[j][1], im.width, im.height, ox, oy]
    for name, a in m['anims'].items():
        pts = a['fr']  # [dir][i] -> {eye: [x, y], ...}
        for pk in (pts[0][0].keys() if pts and pts[0] else []):
            c['a'][name][pk[0]] = [[[round(v) for v in f[pk]] for f in d] for d in pts]
    args = [json.dumps(key), json.dumps('data:image/webp;base64,' + base64.b64encode(data).decode()), json.dumps(c, separators=(',', ':')), repr(k)] + ([json.dumps(eye)] if eye else [])
    lines.append('regAtlas(' + ', '.join(args) + ');')
    print(key, sheet.size, f'{len(data) // 1024} KB', f'{sheet.size[0] * sheet.size[1] / 1e6:.1f} Mpx')
h = open(INDEX).read()
old = re.search(r'// @atlas-begin\n(.*?)// @atlas-end', h, re.S)
keys = [s.split(':')[0] for s in sys.argv[1:]]
keep = [l for l in old.group(1).splitlines() if l.strip() and not any(l.startswith('regAtlas(' + json.dumps(kk) + ',') for kk in keys)]
h = h[:old.start()] + '// @atlas-begin\n' + ''.join(l + '\n' for l in keep + lines) + '// @atlas-end' + h[old.end():]
open(INDEX, 'w').write(h)
