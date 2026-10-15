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
dört yönden aynı anda gelir, her 5. dalga özel (trol sürüsü, kuşatma, warg akını, Lurtz); Sojuz'un haritalarındaki
gibi 7. dalgada **Su Gözcüsü** (dokunaçlarıyla geniş alana vuran göl canavarı), 12. dalgada iki **Ateş Ejderi**
(uzaktan alan hasarlı alev topu püskürtür, binaları yakar), 17. dalgada ikisi birden; dalga başı altın.

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

**Çiftlik (kaynak binası):** arsalara kurulur (300), seviye başına saniyede +1 altın üretir (3 seviye). BFME2'deki
gibi düşman onu hedef alır — koruyun.

**Portreler ve ikonlar:** kahraman portreleri, komut çubuğu madalyonu ve eğitim düğmeleri birimlerin 3B
modellerinden render edilen portreleri kullanır; güç, yetenek, yükseltme ve bina düğmeleri renkli disk üzerinde
parlak, konturlu BFME2 tarzı ikonlardır. Kalkanlarda armalar: Gondor'un Beyaz Ağacı, Mordor'un Gözü, Isengard'ın
Ak Eli, Rohan'ın atı.

**Bina seviyeleri ve satış:** okçu kulesi, mancınık ve kışla **3 seviyeye** kadar yükseltilir (seviye başına
+%25 dayanıklılık; kule +%40 hasar, +1 ok, +4 m menzil; mancınık +%40 hasar, −%15 atış aralığı; kışla −%20
yetiştirme süresi). Yükseltme 8 sn sürer ve bu sırada bina çalışmaz. Her yapı **satılabilir** (yatırılan
altının %50'si); yıkılan veya satılan yapının yuvası yeniden inşaya açılır.

**Düşmanlar:** Mordor Orkları, Uruk-hai, **Ork Okçuları** (binalara ateşli ok atar — kulelerinizi korur
gibi okçularla avlayın), hızlı **Warg Biniciler**, saflarınızı yarma vuruşuyla dağıtan dev **Mağara Trolü**,
koçbaşı ve Lurtz. Kale haritalarında yakın dövüşçüler kapı yerine yakındaki arsa binalarınıza da saldırır.

**Taraflar:** başlangıç ekranında **Gondor** veya **Rohan** seçilir (`?faction=rohan`). Rohan'ın kışlası
**Rohan Mızrakçıları**, **Rohan Okçuları** ve ezen **Rohirrim** süvarisi yetiştirir; kalesi taş kaide üstünde
ahşap Altın Salon'dur, sancakları yeşildir. Rohan kahramanları: **F Kral Théoden** (1100; Kralın Şanı — 15 sn ordu
+%25 hasar, rütbe 3'te Éored Çağır — 40 sn Rohirrim bölüğü), **G Éowyn** (900; Kalkan Kızı — çift hasar ve
iyileşme, rütbe 3'te "Ben Erkek Değilim!" — yakındaki en güçlü düşmana, önce boss'a 700 hasar), **J Gandalf**.

**Lothlórien** (`?faction=elves`): kışla az ama keskin **Galadhrim Savaşçıları** ve en uzun menzilli **Lórien
Okçuları** yetiştirir; kale, gümüş gövdeli dev bir mallorn (Caras Galadhon), sancaklar gümüş-yeşil. Kahramanlar:
**F Haldir** (1000; menzilli — Lórien Ok Yağmuru, rütbe 3'te Galadhrim Öfkesi), **G Elrond** (1500; Elf Şifası,
rütbe 3'te Imladris Selleri — 30 m, 450 hasar), **J Legolas**.

**Kahramanlar (BFME2 kadrosu):** sol üstteki portrelerden veya kale panelinden çağrılır, kalenin kapısından
çıkar; hepsi liderlik aurası verir, ikinci yetenek rütbe 3'te açılır, ölünce 45 sn sonra geri çağrılır.
**F Aragorn** (1200): Elendil'in Kılıcı, Athelas. **G Beyaz Gandalf** (2000): Asa Patlaması (10 m, 160 büyü
hasarı), Kudret Sözü (30 m, 450). **J Legolas** (1000): uzun menzilli okçu; Ok Rüzgârı (30 ok), Okçu Eğitimi
(yakın okçu taburları bir rütbe atlar).

**Kuşatma merdivenleri:** kale haritalarında (Helm's Deep, Taşkalkan, Kale Savunması) Uruk merdiven takımları
kapının yanındaki sur kesimine merdiven dayar; merdiven ayaktayken o koldaki düşman ilk kapıyı atlayıp surun
üstünden tırmanarak içeri akar. Sur soketindeki okçu kuleleri yakındaki merdiveni iter (seviye başına daha güçlü),
yakındaki askerleriniz merdivene saldırıp yıkar, boştaki kuleler merdivene ok atar; merdiven 90 sn sonra kendiliğinden
çöker.

**Kuşatma kuleleri:** Isengard'ın tekerlekli ahşap kuleleri (oklara dayanıklı) sura yanaşınca köprüsünü indirir,
içindeki Uruk taburu iner ve geniş geçitten surun üstüne akar. Kule itilemez ve kendiliğinden çökmez: mancınık
taşları ve askerlerinizle yıkın (mancınıklar boşta kalınca kuşatma yapılarını hedefler).

**Maç sonu ve rekorlar:** maç bitince istatistik ekranı açılır — dalga, öldürülen düşman, kayıp, kazanılan altın,
kale canı / kalan can, süre — ve puan (öldürülen ×2, temizlenen dalga ×100, zaferde 1000 + sağlık ×1000, kayıp −1;
zorluk çarpanı 0.75 / 1 / 1.5). Zaferde sağlığa göre 1–3 yıldız. Harita × zorluk × taraf başına en iyi puan tarayıcıda
saklanır; başlangıç ekranındaki harita kartlarında en iyi yıldız ve puan görünür.

**Oyun hızı:** sağ üstteki düğmeler ya da kısayollar — **P** duraklat/devam, **+ / −** hız (1×, 2×, 3×).

**Balrog:** Kule Savaşı'nın 28. dalgasında iki, Kale Savunması'nın final dalgasında bir Balrog gelir — dev, alev
kılıçlı, yarma vuruşlu ve çevresini her saniye yakan ateş aurasıyla; ona yakın dövüşle değil Gandalf ve okçularla
karşılık verin.

**Güçler:** Düşman öldürmek ve dalga başları **Güç Puanı** verir; ekranın solundaki **Güçler** sütunundan (**1–9, 0**)
kademe kademe açılır (10 güç):
- I: Şifa, Toplanma Çağrısı
- II: Ok Yağmuru, Elf Müttefikleri, **Güneş Parlaması** (alandaki düşmanlar kamaşır: 15 sn −%40 hasar verir,
  +%25 hasar alır)
- III: Rohirrim'i Çağır, **Deprem** (4 sn sarsıntı: askerlere ezme hasarı, merdiven ve kuşatma kulelerine ağır
  hasar; yarılan toprak, fırlayan kayalar, kamera sarsıntısı)
- IV: Ölüler Ordusu, **Kartallar Geliyor!** (üç kartal dalışı, dalış başına 220 ezme hasarı),
  **Bruinen Seli** (hedeften dışa yayılan sel dalgası düşmanı yaralar ve sürükler)

Taburlar öldürdükçe 5 rütbeye kadar yükselir. Son dalgada boss **Lurtz** gelir.

**İşçiler ve serbest inşa (BFME2):** sabit zemin arsaları yok. Kale maçın başında **2 işçi** verir; kaleden
yenisi yetiştirilir (100 altın, 8 sn bekleme, en fazla 6). İşçiyi seç → komut çubuğundan yapıyı seç (kule, kışla,
demirhane, mancınık, çiftlik) → haritada yeri seç: yarı saydam hayalet bina ve halka yeşilse uygun, kırmızıysa değil
(düşman yolu, doğuş bölgesi, kapı/kale yakını, başka yapı, engebeli zemin). Shift ile art arda yerleştir, sağ tık /
Esc iptal. İnşaat yalnızca başında işçi varken ilerler (2 işçi daha hızlı); boştaki işçiler yakındaki yarım inşaata
kendiliğinden gider. Kule Savaşı haritalarında yolun dışındaki arazinin her yerine kurulur. Sur üstündeki altın
halkalı kule soketleri yerinde kalır.

**Demirhane donanımı (tabur başına, BFME2 gibi):** demirhanedeki araştırma yükseltmeyi **açar**; sonra her tabur
kendi donanımını komut çubuğundan alır — Dövme Kılıçlar (yakın dövüş, 120 altın, +%25 hasar), Ağır Zırh (her tabur,
120 altın, −%25 alınan hasar), Ateşli Oklar (okçular, 100 altın; kuleler araştırmayla doğrudan alır). Alınan
donanım taburun sancağının altında küçük işaretler olarak görünür (kılıç, kalkan, alev).

**Birleşik ordu:** yakın dövüş taburu ile okçu taburu 18 m içinde birlikte durursa piyade %15 daha az hasar alır,
okçular %15 daha fazla verir (sancakta altın elmas; komut çubuğunda yeşil "Birleşik ordu" satırı).

**Isengard (oynanabilir kötü taraf):** başlangıç ekranından seçilir (`?faction=isengard`). Kale Orthanc'tır
(kara kule, dört boynuzlu taç, Beyaz El sancakları); kışla Uruk-hai, Uruk Arbaletçileri ve Warg Binicileri
yetiştirir; kahramanlar Saruman (Ateş Topu, Söz Ustalığı, Ak Divan'ın Laneti, Orthanc Yıldırımı), Lurtz (Uruk Öfkesi,
Kara Ok Yağmuru, Biçen Kılıç, Kral Avcısı) ve Sharku (Warg Uluması, Warg Sürüsü, Boğaz Avcısı, Kurt Ordusu).
Dalgalar bu kez iyi taraflardan gelir: orklar yerine Gondor askerleri, Uruklar yerine Kule Muhafızları, ork okçuları
yerine Gondor okçuları, warglar yerine Rohirrim, troller yerine Galadhrim; Lurtz yerine Su Gözcüsü. Güç kitabı aynı
etkilerle Isengard'a uyarlanır: Ateşleri Körükle, Savaş Davulları, Arbalet Yaylımı, Uruk Takviyesi, Kara Duman,
Warg Akını, Uruk Barutu, Balrog'u Uyandır, Crebain Sürüsü, Kara Fırtına.

**Mordor (oynanabilir kötü taraf):** `?faction=mordor`. Kale Barad-dûr'dur (dikenli kademeli kara kule, tepede iki
çatal arasında Göz, kızıl Göz sancakları); kışla Mordor orkları, ork okçuları ve mağara trolleri yetiştirir;
kahramanlar Cadı Kral (Morgul Bıçağı, Kara Nefes, Ateş Topuzu, Angmar'ın Gazabı), Gothmog (Savaşa!, Ork Takviyesi,
Kasap, Trolleri Getirin) ve Sauron'un Ağzı (Sauron'un Sesi, Karanlık Lütuf, Ölümcül Söz, Kanatlı Nazgûl). Dalgalar
Isengard'daki gibi iyi taraflardan gelir. Güçler: Ork Ziyafeti, Mordor Davulları, Kara Oklar, Ork Sürüsü (3 tabur),
Karanlık, Warg Akını, Yer Yarılır, Balrog'u Uyandır, Fell Beast Dalışı, Lav Dalgası.

**Kötü taraf ayrıntıları:** Isengard veya Mordor oynarken saldıran kuşatma araçları Gondor'undur (insan taşıyıcılı,
çelik başlıklı koçbaşı; Gondor askerlerinin taşıdığı merdiven; mavi örtülü kuşatma kulesi). Kale yükseltme parçaları
tarafa göre temalanır: Gondor Beyaz Ağaç, Rohan altın at, Lórien altın yaprak sancakları ve altın süsler; Isengard
Beyaz El, Mordor kızıl Göz sancakları, kara taş, demir diken taç ve kor uçlar, şifa sancakları ateş renginde.

**Müzik ve birim sesleri:** prosedürel, savaşa göre yoğunlaşan müzik (dosya yok): sakinken yaylı pad, düşman
kaleye yaklaştıkça yaylı ostinato, taiko savaş davulları ve koro; dalga başında boru çağrısı, zaferde majör, yenilgide
karanlık kapanış. Kötü taraflarda frig (karanlık) akor dizisi. Birimler seçilince ve emir alınca Türkçe konuşur
(tarayıcının konuşma sentezi; Gondor "Gondor için!", Uruklar "Et geri döndü!", Gandalf "Geçemezsin!", Cadı Kral…).
**F7** müzik, **F8** birim sesleri, **M** tüm sesler.

**Kahraman seviyeleri (1–10):** kahramanlar öldürdükçe ve savaş alanında kaldıkça (saniyede +2 XP) deneyim kazanır;
her seviye +%10 hasar ve dayanıklılık verir. Her kahramanın 4 yeteneği 1., 3., 6. ve 10. seviyede açılır — ör.
Aragorn: Elendil'in Kılıcı, Athelas, Andúril Savuruşu, **Yeminbozanlar** (Ölüleri çağırır); Gandalf: Asa Patlaması,
Kudret Sözü, Beyaz Işık, **Kartalları Çağır**; Legolas: Ok Rüzgârı, Okçu Eğitimi, Öldürücü Atış, Elf Yayı Fırtınası;
Théoden: … **Rohan'ın Bütün Atlıları**; Éowyn: … **Cadı Kral Katili**; Haldir: … **Lórien Muhafızları**; Elrond: …
Vilya'nın Işığı, **Bruinen Taşkını**. Seviye atlayınca altın halka, çan ve ekranda duyuru (yeni yetenekle); komut
çubuğunda "Sv N" rozeti ve sonraki seviyeye XP çubuğu.

**Tabur duruşları ve sancaktar:** bir tabur seçince komut çubuğunda BFME2 duruşları çıkar — **Normal**,
**Saldırgan** (+%25 hasar verir, +%25 alır, düşmanı uzağa kovalar), **Mevzi Tut** (kalkan duvarı: %35 daha az hasar
alır, %15 daha az verir, yerinden kopmaz). **Sancaktar** (150 altın / tabur) taburun bir askerine armalı uzun savaş
sancağı taşıtır: çatışma dışındaki askerler saniyede %3 iyileşir, tabur %50 daha hızlı deneyim kazanır.

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

## BFME2 ile karşılaştırma (yol haritası)

**Var:** Kale (FD) ve Kule (TD) savunması, klasik Tower Wars / Fortress Defence haritaları, işlevsel ve gelişen kale,
kale yükseltmeleri, bina seviyeleri ve satış, çiftlik, kışla / demirhane, 3 iyi taraf (Gondor, Rohan, Lothlórien) + 2 kötü taraf (Isengard, Mordor) ve
9 kahraman (10 seviye, 4 yetenek), 4 kademeli 10 güç (Kartallar, Sel, Deprem, Güneş Parlaması dahil), tabur duruşları, sancaktar ve tabur başına donanım, birleşik ordu bonusu, rütbe sistemi, kuşatma (koçbaşı, merdiven, kule), boss'lar (Lurtz, Balrog, Su Gözcüsü,
Ateş Ejderi), halka menü, bekleme sayaçları, palantír mini harita, portreler, oyun hızı, istatistik ve rekorlar.

**Eksik (BFME2'de olup henüz olmayan):**
1. Goblinler'in oynanabilir olması (Isengard ve Mordor var) ve çok oyunculu / PvP (deterministik lockstep
   altyapısı hazır, ağ katmanı yok).
2. Güç kitabının kalanı (Tom Bombadil, Kale Kuşatması, Ölülerin Çağrısı…; BFME2'de ~15, burada 10).
3. Birim türüne özgü sürü kombinasyonları (BFME2'deki ör. Gondor askeri + Kule Muhafızı) — burada genel yakın
   dövüş + okçu bonusu var.
4. Kahraman Yarat (Create-a-Hero), binekli kahramanlar (seviye 1–10 ve 4 yetenek var).
5. Sur inşası, komuta noktası (nüfus) sınırı, deniz birimleri (işçiyle serbest inşa var).
6. Kayıtlı seslendirme ve orkestra müziği (burada prosedürel müzik + konuşma sentezi var), War of the Ring kampanya
   modu, harita editörü.
