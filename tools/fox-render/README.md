# Tilki atlası üretici

Meshy'den gelen rigli tilki modelini (`assets/fox/frostlight_fox_walk.glb`) yandan, oyunun kamera açısıyla işler ve animasyon atlasına çevirir.

- `idle`, `run`, `hop`, `cast` animasyonları yürüme kaydından ve iskelet kemiklerine uygulanan dönüşlerden üretilir (modelde yalnızca yürüme vardı).
- Çıktı: `<ad>.png` (satır başına bir animasyon) ve `<ad>.json` (kare boyutu, yer noktası, her karede göz / kuyruk ucu / sırt konumu).

Kullanım:

```
npm install three@0.160.0
cp ../../assets/fox/frostlight_fox_walk.glb .
python3 -m http.server 8765 &
node render.js fox_atlas "?fw=288&fh=216"
```

Sonra PNG'yi WebP'ye çevirip `game/index.html` içindeki `FOXI.src` (base64) ve `FOXM` (JSON) değerlerini güncelle.
