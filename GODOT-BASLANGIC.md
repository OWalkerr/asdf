# Ruh Tilkisi: Godot'ya geçiş (bilgisayarında başlangıç)

Bu depo, tarayıcı sürümünün tamamını ve Godot'ya taşımak için gereken her şeyi içerir.

## Pakette ne var?

| Klasör | İçerik |
|---|---|
| `game/index.html` | Oyunun çalışan, eksiksiz web sürümü. Kurallar, sayılar ve his için başvuru kaynağı (çift tıklayıp tarayıcıda oynayabilirsin). |
| `export/models/` | 19 animasyonlu 3B model (`.glb`): tilki, bütün düşmanlar ve muhafızlar. Yürüme, saldırı, ölüm (tilkide bekleme, koşu, sekme, fırlatma) animasyonları içinde. Godot'ya sürükle-bırak ile girer. |
| `export/audio/` | 49 ses efekti ve ölüm sesi, 4 biyom ortam sesi, 8 müzik döngüsü (oda müziği ve her muhafızın teması). |
| `export/data/` | Oyunun bütün verisi JSON olarak: güçler, tilkiler, düşmanlar, muhafızlar, biyomlar, kapılar, görevler, olaylar, hikâye, yeminler, başarımlar. |
| `export/sprites/` | 2B sprite atlasları (gerekirse yedek olarak). |
| `DESIGN.md` | Bütün tasarım belgesi (Türkçe). |
| `docs/GODOT-PORT.md` | Claude Code için geçiş rehberi: mimari, koordinatlar, kilometre taşları. |
| `CLAUDE.md` | Claude Code'un her oturumda okuduğu proje notu. |
| `tools/` | Model/atlas işleme, veri dışa aktarma ve denge botu araçları. |

## Kurulum

1. **Godot 4.4 veya üstü:** https://godotengine.org/download (standart sürüm, GDScript).
2. **Git:** https://git-scm.com
3. **Claude Code:** https://docs.claude.com/en/docs/claude-code (terminalde `claude` komutu).
4. Projeyi indir:
   ```
   git clone https://github.com/OWalkerr/asdf.git ruh-tilkisi
   cd ruh-tilkisi
   claude
   ```
   Git kullanmak istemezsen GitHub sayfasındaki **Code → Download ZIP** ile de indirebilirsin.
5. Godot'nun komut satırından çalışabilmesi için `godot` komutunu PATH'e ekle. Windows'ta `Godot_v4.x.exe`
   dosyasının yolunu Claude Code'a söylemen de yeterli.

## Claude Code'a yapıştıracağın ilk mesaj

```
Merhaba! Ruh Tilkisi'ni tarayıcıdan Godot 4'e taşıyoruz. Önce CLAUDE.md, docs/GODOT-PORT.md ve DESIGN.md dosyalarını oku.
Web sürümü (game/index.html) kuralların ve sayıların kaynağı; hazır modeller export/models, sesler export/audio,
veriler export/data içinde.

Bugünkü hedef M1 (dikey dilim):
1. Bilgisayarımdaki Godot sürümünü kontrol et (godot --version); bulamazsan bana yolunu sor.
2. godot/ klasöründe yeni bir Godot 4 projesi kur (Forward+, autoload'lar: Game, Meta, Audio, Data).
3. 51° eğik ortografik kamera, yuvarlak arena (8.2 m yarıçap), kenarda 4 mangal ışığı.
4. export/models/fox.glb ile tilki: WASD/joystick ile yürüme, menzildeki en yakın düşmana otomatik ışık mızrağı,
   her atıştan sonra tutulan yöne sekme (web sürümündeki attackThrow, startHop, endHop mantığıyla).
5. Mızrakların düşmana saplanması ve E ile Söküm (castRend, rendDmg).
6. export/models/ghoul.glb ile dalgalar halinde gelen Hortlaklar (roomWaves'in basit hali), vurulunca parlama, ölüm.
7. Basit HUD: can ve oda.
8. Başsız (headless) bir duman testi yaz ve çalıştır, sonra commit et.

Her adımda bana ne yaptığını ve oyunda neyi denemem gerektiğini Türkçe anlat.
```

## Sonraki adımlar

`docs/GODOT-PORT.md` içinde M1'den M10'a kadar sıralı bir yol var:
- savaş hissi;
- oda yapısı;
- düşmanlar ve muhafızlar;
- görevler ve Ruh Biçimleri;
- biyomlar ve resimsi görünüm;
- kalıcı ilerleme ve hikâye;
- ses;
- telefon kontrolleri ve dışa aktarma.

Her oturumda Claude Code'a "sıradaki kilometre taşına geç" demen yeterli.
