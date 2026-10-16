# Sprite atlas üretici (3B model → oyun kareleri)

Meshy'den gelen rigli GLB modelleri oyunun kamera açısıyla (yandan, 22° yukarıdan) işler ve animasyon atlasına çevirir. Kamera her modele kendiliğinden oturur.

## Yeni düşman eklemek

1. GLB'leri `assets/<ad>/` altına koy (ör. `assets/ghoul/ghoul_walk.glb`, `assets/ghoul/ghoul_attack.glb`).
2. `configs.js` içine bir giriş ekle (şablon dosyanın sonunda). Anahtar oyundaki düşman türüdür:
   `ghoul, frost, brute, knight, archer, spitter, bat, bomb, chest, mimic, wisp`; muhafızlar için `lord, rider, queen, cardinal`.
   Animasyon adları: `walk` (zorunlu), `attack` (nişan / hücum hazırlığı), `die` (yalnız muhafızlar).
3. İşle ve oyuna göm:

```
npm install three@0.160.0 playwright
mkdir -p models && cp ../../assets/ghoul/*.glb models/
python3 -m http.server 8765 &
node render.js ghoul          # out/ghoul.png + out/ghoul.json, kemik ve klip adlarını da yazar
python3 pack.py ghoul:3.2     # game/index.html içine gömer; 3.2 = gövde uzunluğu (düşman yarıçapı cinsinden)
```

`pack.py anahtar:boy:göz_rengi` ile göz ışıltısının rengi de verilebilir (ör. `ghoul:3.2:255,170,90`). Göz noktası için configs'te `points: { eye: '<baş kemiği>' }` yaz.

## Tilki

`fox` girişi kahramanın atlasını üretir. Modelde yalnızca yürüme olduğu için bekleme, koşu, sekme ve fırlatma hazırlığı kemik dönüşleriyle kurulur. Çıktı `game/index.html` içindeki `FOXI` / `FOXM` değerlerine elle konur.
