#!/usr/bin/env python3
"""Pack baked atlases into game/index.html between the @atlas markers.

usage: python3 pack.py <key>:<k>[:<eye rgb>] ...   e.g.  python3 pack.py ghoul:3.2:255,170,90 lord:2.6
Reads out/<key>.png + out/<key>.json, writes a WebP copy to game/assets/<key>_atlas.webp and embeds it as base64.
k is the body length in enemy radii (how large the model is drawn)."""
import base64, io, json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
INDEX = os.path.join(ROOT, 'game', 'index.html')
lines = []
for spec in sys.argv[1:]:
    parts = spec.split(':'); key, k = parts[0], float(parts[1]); eye = parts[2] if len(parts) > 2 else None
    m = json.load(open(os.path.join(HERE, 'out', key + '.json')))
    im = Image.open(os.path.join(HERE, 'out', key + '.png'))
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=88, method=6); data = buf.getvalue()
    os.makedirs(os.path.join(ROOT, 'game', 'assets'), exist_ok=True); open(os.path.join(ROOT, 'game', 'assets', key + '_atlas.webp'), 'wb').write(data)
    c = {'fw': m['fw'], 'fh': m['fh'], 'g': [round(v, 1) for v in m['ground']], 'u': round(m['unit'], 2), 'l': m['len'], 'a': {}}
    for name, a in m['anims'].items():
        c['a'][name] = {'r': a['row'], 'n': a['n']}
        if all('eye' in f for f in a['fr']): c['a'][name]['e'] = [[round(v) for v in f['eye']] for f in a['fr']]
    args = [json.dumps(key), json.dumps('data:image/webp;base64,' + base64.b64encode(data).decode()), json.dumps(c, separators=(',', ':')), repr(k)] + ([json.dumps(eye)] if eye else [])
    lines.append('regAtlas(' + ', '.join(args) + ');')
    print(key, im.size, f'{len(data) // 1024} KB')
h = open(INDEX).read()
old = re.search(r'// @atlas-begin\n(.*?)// @atlas-end', h, re.S)
keep = [l for l in old.group(1).splitlines() if l.strip() and not any(l.startswith('regAtlas(' + json.dumps(s.split(':')[0])) for s in sys.argv[1:])]
h = h[:old.start()] + '// @atlas-begin\n' + ''.join(l + '\n' for l in keep + lines) + '// @atlas-end' + h[old.end():]
open(INDEX, 'w').write(h)
