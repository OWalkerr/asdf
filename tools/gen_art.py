# Gemini ile oyun görselleri üretir (ikonlar, armalar, arka planlar).
# Kullanım: SSL_CERT_FILE=... GEMINI_KEY=<anahtar> python3 tools/gen_art.py <çıktı-klasörü> [ad ...]
# Anahtar yalnızca ortam değişkeninden okunur; repoya yazılmaz. Görsel modelleri faturalandırma ister.
import base64, json, os, sys, time, urllib.request, concurrent.futures as cf
KEY = os.environ['GEMINI_KEY']
OUT = sys.argv[1]
MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash-image')
ICON = ("Square painted fantasy strategy-game ability icon in the style of a high-quality medieval fantasy RTS, "
        "rich saturated colors, dramatic lighting, painterly brush strokes, centered single subject filling the frame, "
        "dark vignette background, no text, no letters, no frame, no border. Subject: ")
CREST = ("Square heraldic emblem icon for a fantasy army, painted metal and enamel crest centered on a dark background, "
         "ornate but readable at small size, no text, no letters. Emblem: ")
JOBS = {
  # Ana menü arka planı (16:9)
  'menu-bg': ('16:9', "Epic wide fantasy matte painting at dusk: a mighty stone fortress on a cliff above a misty valley, "
              "a huge army with banners and torches marching across the plain toward it, distant snowy mountains, "
              "warm orange sunset light breaking through dark clouds, cinematic, painterly, no text, no logo. "
              "Leave the right third of the image calmer and darker for menu buttons."),
  'campaign-good': ('16:9', "Fantasy matte painting: white stone city of men on a mountain at sunrise, banners with a white tree, "
                    "knights in silver armor, hopeful golden light, painterly, no text."),
  'campaign-evil': ('16:9', "Fantasy matte painting: a black volcanic fortress tower under a red sky, orc armies with torches "
                    "and siege engines, ominous, painterly, no text."),
  # Güçler
  'spell-heal': ('1:1', ICON + "glowing green healing light and leaves spiraling around open hands"),
  'spell-rally': ('1:1', ICON + "a war horn blown under a waving battle banner, golden aura"),
  'spell-arrow_volley': ('1:1', ICON + "a dense volley of arrows raining down from a stormy sky"),
  'spell-elven_allies': ('1:1', ICON + "elven archers with golden hair drawing long bows in a glowing forest"),
  'spell-sun_flare': ('1:1', ICON + "a blinding sun burst breaking through dark clouds with radiant rays"),
  'spell-rohirrim': ('1:1', ICON + "charging cavalry riders with spears on galloping horses, dust and green banners"),
  'spell-earthquake': ('1:1', ICON + "the ground cracking open with glowing fissures and flying rocks"),
  'spell-tom_bombadil': ('1:1', ICON + "a jolly old man with a bright blue coat, yellow boots and a feathered hat dancing in a meadow"),
  'spell-ent_moot': ('1:1', ICON + "giant walking tree creatures with glowing green eyes striding through a forest"),
  'spell-army_of_dead': ('1:1', ICON + "an army of glowing green ghost soldiers with spectral swords emerging from mist"),
  'spell-eagles': ('1:1', ICON + "a giant golden eagle diving with talons outstretched against a bright sky"),
  'spell-flood': ('1:1', ICON + "a colossal river wave with white foaming horse-shaped crests crashing forward"),
  # Binalar
  'b-arrow_tower': ('1:1', ICON + "a tall stone archer tower with wooden hoarding and a flag"),
  'b-barracks': ('1:1', ICON + "a medieval stone barracks hall with shields and spears racked outside"),
  'b-forge': ('1:1', ICON + "a blacksmith forge with an anvil, glowing hot metal and sparks"),
  'b-catapult': ('1:1', ICON + "a wooden siege catapult launching a flaming boulder"),
  'b-farm': ('1:1', ICON + "a small farmhouse with golden wheat fields and a windmill"),
  'b-fortress': ('1:1', ICON + "a grand stone citadel keep with towers and banners"),
  # Kale yükseltmeleri
  'f-stone': ('1:1', ICON + "massive reinforced stone wall blocks being raised with iron braces"),
  'f-arrows': ('1:1', ICON + "arrow slits in a castle wall with archers shooting out"),
  'f-catapult': ('1:1', ICON + "a trebuchet on a castle terrace"),
  'f-heal': ('1:1', ICON + "a glowing healing banner on a castle tower radiating warm light"),
  'f-treasury': ('1:1', ICON + "a treasure chest overflowing with gold coins inside a vault"),
  # Demirhane
  'u-blades': ('1:1', ICON + "freshly forged gleaming steel swords crossed over an anvil"),
  'u-armor': ('1:1', ICON + "a heavy steel breastplate and helmet on a stand"),
  'u-fire': ('1:1', ICON + "flaming arrows nocked on a bow"),
  # Taraf armaları
  'crest-gondor': ('1:1', CREST + "a white flowering tree with seven stars on a black field with silver border"),
  'crest-rohan': ('1:1', CREST + "a white running horse on a green field with gold border"),
  'crest-elves': ('1:1', CREST + "a silver leaf and golden mallorn tree on a teal field"),
  'crest-isengard': ('1:1', CREST + "a white hand print on a black field with red accents"),
  'crest-mordor': ('1:1', CREST + "a fiery red lidless eye on a black field with iron spikes"),
  'crest-goblins': ('1:1', CREST + "a crude goblin skull with a jagged crown on a brown field with rusty iron"),
}

def gen(name, ratio, prompt):
  path = os.path.join(OUT, name + '.png')
  if os.path.exists(path): return name, 'cached'
  body = {"contents": [{"parts": [{"text": prompt}]}],
          "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": ratio}}}
  for attempt in range(4):
    try:
      req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
      with urllib.request.urlopen(req, timeout=180) as r:
        d = json.load(r)
      for c in d.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
          if 'inlineData' in p:
            open(path, 'wb').write(base64.b64decode(p['inlineData']['data']))
            return name, 'ok'
      return name, 'noimage ' + json.dumps(d)[:300]
    except urllib.error.HTTPError as e:
      msg = e.read().decode()[:300]
      if e.code in (429, 500, 503): time.sleep(8 * (attempt + 1)); continue
      return name, f'http {e.code} {msg}'
    except Exception as e:
      time.sleep(5); print(name, 'err', e, file=sys.stderr)
  return name, 'failed'

only = sys.argv[2:] 
jobs = {k: v for k, v in JOBS.items() if not only or k in only}
with cf.ThreadPoolExecutor(4) as ex:
  for name, st in ex.map(lambda kv: gen(kv[0], *kv[1]), jobs.items()):
    print(name, st, flush=True)
