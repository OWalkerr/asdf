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

## Nasıl oynanır
Başlangıç ekranında bir **harita** ve **zorluk** seçilir (`?map=…&difficulty=easy|normal|hard` ekranı atlar).

**Kule Savaşı (Tower Wars)** — BFME2 topluluğunun klasik özel harita türü: tek yol kuzeyden iner, çatalda
dört şeride ayrılır ve güneydeki **uç bölgede** birleşir. 30 dalga (5: Warg akını, 10/20: kuşatma, 15: trol
sürüsü, 25: ok yağmuru, 28: Trol Kralları, 30: Lurtz); her dalga başında altın. Uç bölgeye varan düşman
kaybolmaz: bölge güç vuruşlarıyla onları eritir, içeride bekleyen her tabur 4 sn'de bir can götürür (40 can).

**Kale Savunması (Fortress Defence)** — klasik tür: kale yolun tam ortasında, kare surun dört kapısı; 20 dalga
dört yönden aynı anda gelir, her 5. dalga özel (trol sürüsü, kuşatma, warg akını, Lurtz); dalga başı altın.

**Kale Savunması (FD)** — *Taşkalkan Kalesi*, *İkiz Köprü Geçidi*, *Helm's Deep*: düşman dalgaları
koridorlarından kapılara yürür. Kapılar yalnızca engeldir: kırılan kapıdan (gedik) düşman içeri akar ve
koridorundaki sıradaki kapıya, en sonda **kaleye** saldırır. **Kale düşerse savaş biter**; tüm dalgaları
püskürtürseniz kazanırsınız. Kale seçilince (**K**, portre veya tıklama) yükseltmeleri satın alınır:
Taş Takviye (+%50 can), Ok Mazgalları, Kale Mancınığı, Şifa Sancağı, Hazine (+4 altın/sn). Kahramanlar
kalenin kapısından çıkar; kapılar kale panelinden onarılır.

**Kule Savunması (TD)** — *Yılan Vadisi*, *Çatal Yol*: düşman sabit yolu izleyip çıkışa yürür; çıkışa
ulaşan her tabur **can** götürür (Uruk 2, koçbaşı 3, trol 3, Lurtz 10). Yol kenarındaki yuvalara **okçu kulesi**
(250) ve alan hasarlı **mancınık** (450) kurun; üssün yanındaki arsalara kışla/demirhane.

**Ekonomi:** saniyede +5 altın ve öldürülen her düşman için ödül. Sur soketleri ve kule platformlarına okçu
kulesi veya mancınık, arsalara **Kışla** (400) ve **Demirhane** (500: Dövme Kılıçlar, Ağır Zırh, Ateşli Oklar).
Koçbaşları oklara dayanıklıdır — mancınık, Ateşli Oklar veya piyadeyle durdurun.

**Bina seviyeleri ve satış:** okçu kulesi, mancınık ve kışla **3 seviyeye** kadar yükseltilir (seviye başına
+%25 dayanıklılık; kule +%40 hasar, +1 ok, +4 m menzil; mancınık +%40 hasar, −%15 atış aralığı; kışla −%20
yetiştirme süresi). Yükseltme 8 sn sürer ve bu sırada bina çalışmaz. Her yapı **satılabilir** (yatırılan
altının %50'si); yıkılan veya satılan yapının yuvası yeniden inşaya açılır.

**Düşmanlar:** Mordor Orkları, Uruk-hai, **Ork Okçuları** (binalara ateşli ok atar — kulelerinizi korur
gibi okçularla avlayın), hızlı **Warg Biniciler**, saflarınızı yarma vuruşuyla dağıtan dev **Mağara Trolü**,
koçbaşı ve Lurtz. Kale haritalarında yakın dövüşçüler kapı yerine yakındaki arsa binalarınıza da saldırır.

**Kahramanlar (BFME2 kadrosu):** sol üstteki portrelerden veya kale panelinden çağrılır, kalenin kapısından
çıkar; hepsi liderlik aurası verir, ikinci yetenek rütbe 3'te açılır, ölünce 45 sn sonra geri çağrılır.
**F Aragorn** (1200): Elendil'in Kılıcı, Athelas. **G Beyaz Gandalf** (2000): Asa Patlaması (10 m, 160 büyü
hasarı), Kudret Sözü (30 m, 450). **J Legolas** (1000): uzun menzilli okçu; Ok Rüzgârı (30 ok), Okçu Eğitimi
(yakın okçu taburları bir rütbe atlar).

**Balrog:** Kule Savaşı'nın 28. dalgasında iki, Kale Savunması'nın final dalgasında bir Balrog gelir — dev, alev
kılıçlı, yarma vuruşlu ve çevresini her saniye yakan ateş aurasıyla; ona yakın dövüşle değil Gandalf ve okçularla
karşılık verin.

**Güçler:** Düşman öldürmek ve dalga başları **Güç Puanı** verir; ekranın solundaki **Güçler** sütunundan (**1–6**)
kademe kademe açılır: Şifa, Toplanma Çağrısı → Ok Yağmuru, Elf Müttefikleri → Rohirrim'i Çağır →
Ölüler Ordusu. Taburlar öldürdükçe 5 rütbeye kadar yükselir. Son dalgada boss **Lurtz** gelir.

**Halka menü ve sayaçlar:** bir yapıya, inşa yuvasına veya kaleye tıklayınca BFME'deki gibi etrafında yuvarlak
komut halkası açılır (aynı komutlar alttaki çubukta da). İnşa, yükseltme, eğitim, araştırma, onarım, kahraman
yetenekleri, kahramanın dönüşü ve güçlerin beklemeleri düğme üzerinde karanlık saat dilimi ve kalan saniye ile
gösterilir. Kale her yükseltmede görsel olarak gelişir (burçlu sur, mazgal çıkmaları, mancınıklar, şifa
sancakları, altın başlıklar; 3+ yükseltmede Gondor sancakları ve taç, 5'te işaret ateşi).

**Arayüz (BFME2 düzeni):** sol altta palantír mini harita (tıkla: kamera), altta madalyon portre ve
yuvarlak komut düğmeleri (**Z X C V B N**, ipucu için üzerine gelin), solda güçler, sol üstte kahraman ve
kale portreleri, üstte dalga/kale/kapı durumu, sağ üstte kaynaklar. **?** yardım, **M** ses.

## Birim kontrolleri
Sol tık: tabur seç (Shift ile ekle/çıkar) · Sol sürükle: kutu seçimi · Sağ tık: seçili taburları yürüt
(düşman askerinin üstünde: saldır) ·
Esc: seçimi temizle · H: seçili taburları durdur · Asker olmayan yere sol tık: inşa slotu / yapı seç. Taburlar akış alanıyla (flow field)
engellerin etrafından dolaşır, dar geçitte formasyonu daraltır. `?debug` panelinde "Nav ızgarası sınırı"
ve sim hızı ayarı var.
