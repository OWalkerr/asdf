# Sprite atlas üretici (3B model → oyun kareleri)

Meshy'den gelen rigli GLB modelleri oyunun kamera açısıyla (51° yukarıdan, `dirs` ile 5 yönde: doğu, güneydoğu, güney, kuzeydoğu, kuzey) işler; batı yarısını oyun aynalar. Kamera her modele kendiliğinden oturur, `pack.py` kareleri kırpıp tek sayfaya dizer.

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

`fox` girişi kahramanın atlasını üretir (`python3 pack.py fox:1`). Modelde yalnızca yürüme olduğu için bekleme, koşu, sekme ve fırlatma hazırlığı kemik dönüşleriyle kurulur.

Rigli ama animasyonsuz modeller için de `pose(H, u)` ile hareket yazılabilir: `H.rotW(kemik, eksen, açı)` dünya ekseninde döndürür, `H.clip(i, u)` klip oynatır, `H.exaggerate(kemikler, k)` hareketi büyütür.

## Ayarlar (configs.js)

- `fix` / `tiltX`: model çapraz ya da eğik dışa aktarıldıysa düzeltme açıları (derece). `anchor: 'bbox'`: yer noktası gövdenin altına alınır.
- `addLegs`: kemiği olmayan bacaklara iki kemiklik zincir ekler ve bölgedeki köşeleri onlara bağlar (`side`/`cx`, `xMin`…`zMax`, `yTop`).
- `weapons`: `sword`, `shield`, `bow`, `staff`; el kemiğine bağlanır. `off` (bağlama pozunda dünya ekseninde kaydırma), `rot` (derece), boyut ve renk ayarları.
- `inPlace`: kliplerdeki ileri yürüme hareketini sıfırlar (Mixamo'da `mixamorigHips`; three.js kemik adlarındaki `:` işaretini siler).
- `byHeight` / `len`: ölçek için kullanılan model boyu.

Hata ayıklama: `probe.html?f=models/x.glb` kemik ağacı ve üç yönden önizleme, `grid.html?f=x&fix=..&anchor=1` ızgaralı yan ve ön görünüm. `QUICK=1 node render.js x` iki yön ve dört kareyle hızlı önizleme yapar.
