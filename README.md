# Bulwark

BFME2 tarzı, stilize low-poly 3D RTS / Tower & Fortress Defense — Three.js (WebGPU) + TypeScript + Vite.
Tasarım ve mimari: [`GDD.md`](GDD.md).

## Gereksinimler
- Node.js ≥ 22.12, pnpm 12

## Komutlar
| Komut | Açıklama |
|---|---|
| `pnpm install` | Bağımlılıkları kur |
| `pnpm dev` | Geliştirme sunucusu → http://localhost:5173 |
| `pnpm build` / `pnpm preview` | Production build / önizleme |
| `pnpm test` | Vitest (fixed-point, RNG, determinizm, sim saflık kuralları) |
| `pnpm typecheck` | TypeScript (tüm paketler + testler) |
| `pnpm lint` | Biome lint + format kontrolü |
| `pnpm check` | lint + typecheck + test |
| `pnpm shot <url> <png> [zoom\|rotate\|pan]` | Playwright ile ekran görüntüsü + konsol hata raporu |

URL parametreleri: `?map=helms_deep` (varsayılan) veya `?map=lookdev`, `?gallery` birim galerisi
(her birim tipi × boşta/yürüme/saldırı/ölüm × iki takım), `?webgl` WebGL2 backend'ini zorlar,
`?debug` tweak panelini ve teknik HUD'u açar, `?nosab` SharedArrayBuffer yerine postMessage yedek yolunu zorlar. Debug panelindeki "Koridor/spawn katmanı" düşman rotalarını gösterir.

## Paketler
| Paket | İçerik |
|---|---|
| `packages/shared` | Q16.16 fixed-point matematik, deterministik RNG, durum hash'i, harita şeması + Helm's Deep verisi |
| `packages/sim` | bitECS deterministik simülasyon: komut kuyruğu, sistemler, snapshot yazıcı (three.js import edemez) |
| `packages/client` | Renderer, RTS kamera, toon shader, harita oluşturucular, BVH zemin/slot seçimi, sim worker köprüsü, debug paneli |

## Kamera kontrolleri
WASD / ok tuşları / ekran kenarı: kaydır · Orta tuş sürükle: kaydır · Q/E veya Alt+sol sürükle: döndür ·
Tekerlek: imlece doğru zoom · Space/Home: başlangıç görünümü.

## Nasıl oynanır (Helm's Deep, Phase 1)
Beş düşman dalgası fırtınalı gecede güneyden gelir; Orc ve Uruk-hai taburları causeway'den **Hornburg
kapısına**, ovadan **Deeping Wall menfezine** saldırır. Kapılardan biri düşerse yenilirsiniz, tüm dalgaları
temizlerseniz kazanırsınız. Kapılar yalnızca sizin birliklerinize açıktır (arka kapı): piyadeyi dışarı çıkarıp
saldıranları dağıtın. Okçular ve kuleler menzildeki düşmana kendiliğinden ateş eder.

**Ekonomi ve inşa:** 700 altınla başlarsınız, saniyede +5 gelir ve öldürülen her düşman için ödül alırsınız.
Altın halkalı alana tıklayın: sur soketlerine ve Hornburg platformlarına **Okçu Kulesi** (250), vadideki
arsalara **Kışla** (400) kurulur. Kışlayı seçip Gondor Askerleri, Okçuları ve Kule Muhafızları yetiştirin
(kuyruk en fazla 5). Arsalara **Demirhane** (500) kurup takım çapında yükseltme araştırın: Dövme Kılıçlar
(+%25 yakın dövüş), Ağır Zırh (−%25 alınan hasar), Ateşli Oklar (okçu ve kule okları ateş hasarı verir).
Alt paneldeki düğmeler Z X C V kısayollarıyla da çalışır.

**Koçbaşı:** 3. dalgadan itibaren Isengard koçbaşıları kapılara yürür. Oklara dayanıklıdır (Ateşli Oklar hariç),
kılıca açıktır — piyadeyle kapının önüne çıkın. Hasar alan kapıyı üst şeritteki **Onar** düğmesiyle
(300 altın, 10 sn'de +%25) onarabilirsiniz. Sağ alttaki mini haritaya tıklayınca kamera oraya kayar.
Sesler prosedürel olarak üretilir (ilk tıklamada açılır, **M** ile sessize alınır).

**Zorluk ve boss:** Maç öncesi ekranda Kolay / Normal / Zor seçilir (düşman canı, dalga büyüklüğü, başlangıç
altını; `?difficulty=hard` ekranı atlar). Son dalgada **Lurtz** gelir: yanındaki Uruk'lara liderlik aurası
verir, ekranın üstünde can çubuğu görünür.

**Kahraman ve Spellbook (Phase 3):** Panelin üstündeki çubuktan **Aragorn**'u çağırın (1200 altın, **F**).
20 m içindeki taburlara +%25 hasar aurası verir; seçiliyken *Elendil'in Kılıcı* (10 sn çift hasar) ve
rütbe 3'te *Athelas* (alan iyileştirme) yeteneklerini kullanır. Ölürse 45 sn sonra yeniden çağrılabilir.
Düşman öldürmek ve dalga başları **Güç Puanı** verir: **1–6** ile büyüleri açın/kullanın (hedefli büyülerde
zeminde nokta seçilir, Esc iptal). Kademe 1: *Şifa*, *Toplanma Çağrısı*; kademe 2: *Ok Yağmuru*,
*Elf Müttefikleri* (60 sn Lórien okçuları); kademe 3: *Rohirrim'i Çağır* (yoldaki düşmanı ezen süvari hücumu);
kademe 4: *Ölüler Ordusu* (45 sn, hasar almayan hayalet taburlar). Üst kademe, bir alt kademe büyüsü ister. Taburlar
öldürdükçe deneyim kazanır ve 5 rütbeye kadar yükselir (rütbe başına +%10 hasar ve dayanıklılık;
rütbe 3'ten itibaren sancak altına döner).

## Birim kontrolleri
Sol tık: tabur seç (Shift ile ekle/çıkar) · Sol sürükle: kutu seçimi · Sağ tık: seçili taburları yürüt
(düşman askerinin üstünde: saldır) ·
Esc: seçimi temizle · H: seçili taburları durdur · Asker olmayan yere sol tık: inşa slotu / yapı seç. Taburlar akış alanıyla (flow field)
engellerin etrafından dolaşır, dar geçitte formasyonu daraltır. `?debug` panelinde "Nav ızgarası sınırı"
ve sim hızı ayarı var.
