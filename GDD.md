# MIDDLE-EARTH: BULWARK — Game Design Document & Technical Architecture

> **Çalışma adı:** *Bulwark* (BFME2 TD/FD ruhunun tarayıcıya taşınmış hali)
> **Tür:** 3D RTS / Tower Defense (TD) & Fortress Defense (FD) — Solo, Co-op, PvP
> **Platform:** Masaüstü tarayıcı (Chrome/Edge/Firefox/Safari 17+), WebGPU öncelikli, WebGL2 fallback
> **Teknoloji:** Three.js r186 + TypeScript + Vite 8 + bitECS 0.4 + Colyseus 0.18
> **Doküman sürümü:** v0.1 (2026-10-14) — onay bekliyor
> **Not:** Bu bir hayran/ilham projesi tasarımıdır. Tolkien/BFME2 isimleri tasarım referansıdır; dağıtım öncesi IP durumu (isimler, logolar, ses) ayrıca değerlendirilmelidir (bkz. §15 Riskler).

---

## İçindekiler

1. [Vizyon ve Tasarım Sütunları](#1-vizyon-ve-tasarım-sütunları)
2. [Teknoloji Araştırması ve Kütüphane Seçimi](#2-teknoloji-araştırması-ve-kütüphane-seçimi)
3. [Low-Poly Sanat Rehberi (Art Bible)](#3-low-poly-sanat-rehberi-art-bible)
4. [Oyun Modları](#4-oyun-modları)
5. [Temel Oynanış Döngüsü ve Ekonomi](#5-temel-oynanış-döngüsü-ve-ekonomi)
6. [Tabur (Battalion/Horde) Sistemi ve Savaş Kuralları](#6-tabur-battalionhorde-sistemi-ve-savaş-kuralları)
7. [Faction'lar, Birimler, Kuleler ve Binalar](#7-factionlar-birimler-kuleler-ve-binalar)
8. [Kahramanlar](#8-kahramanlar)
9. [Spellbook (Güç Ağacı)](#9-spellbook-güç-ağacı)
10. [Haritalar](#10-haritalar)
11. [UI/UX — Palantír Arayüzü](#11-uiux--palantír-arayüzü)
12. [Ses Tasarımı](#12-ses-tasarımı)
13. [Teknik Mimari](#13-teknik-mimari)
14. [Performans Bütçeleri](#14-performans-bütçeleri)
15. [Riskler ve Açık Sorular](#15-riskler-ve-açık-sorular)
16. [Yol Haritası — Phase 1 (MVP) ve Sonrası](#16-yol-haritası--phase-1-mvp-ve-sonrası)

---

## 1. Vizyon ve Tasarım Sütunları

**Tek cümle:** BFME2'nin taburlarla akan kuşatma savaşlarını, kahramanlarını ve Spellbook'unu; *Thronefall / Bad North* netliğinde, tarayıcıda binlerce askerle 60 FPS çalışan, arkadaşlarla birlikte savunulan low-poly dioramalara taşımak.

| # | Sütun | Anlamı | Ölçüt |
|---|-------|--------|-------|
| P1 | **Anında Okunabilirlik** | İzometrik kameradan her taburun kim olduğu (ırk, sınıf, takım) 0.5 sn'de anlaşılır. | Playtest: 10 birimlik siluet testinde ≥ %90 doğru tanıma |
| P2 | **Destansı Ölçek** | Ekranda aynı anda 2.000–3.000 asker, ok yağmurları, mancınık kayaları. | Orta seviye donanımda 60 FPS (bkz. §14) |
| P3 | **BFME2 Sadakati** | Tabur, counter sistemi, kahraman rank'ları, Spellbook, kale yükseltmeleri BFME2'deki gibi hissettirir. | BFME2 oyuncusu tutorial'sız temel kontrolleri kullanabilir |
| P4 | **Birlikte Savunma** | Co-op birinci sınıf vatandaştır; PvP kuşatma modu sonradan eklenir. | 4 oyuncuya kadar deterministik lockstep |
| P5 | **Web-Native** | Link tıkla, 10 sn içinde oyna. | İlk yükleme < 15 MB, oyun içi akış ile harita yükleme |

**Referanslar:** BFME2 (mekanik, birim tipleri), BFME2 custom TD/FD haritaları, *Thronefall* (sade low-poly, okunabilirlik), *Bad North* (diorama ada, renk paleti), *Kingdom Rush* (TD tempo), *Totally Accurate Battle Simulator* (kalabalık fiziği hissi — ama daha ciddi tonda).

---

## 2. Teknoloji Araştırması ve Kütüphane Seçimi

> Sürümler **2026-10-14** tarihinde `npm view` ile npm registry'den doğrulanmıştır. "Durum" sütunu son yayın tarihine göredir.

### 2.1 Seçilen Yığın (Stack)

| Alan | Seçim | Sürüm | Durum | Gerekçe |
|------|-------|-------|-------|---------|
| Render | **three** (`WebGPURenderer` + TSL, otomatik WebGL2 backend) | 0.186.1 | Aktif (2026-09) | `InstancedMesh`, `BatchedMesh`, TSL node materyalleri ile custom toon shader, compute shader (GPU culling/partikül). Tek materyal kodu hem WebGPU hem WebGL2'de çalışır. |
| Tipler | `@types/three` | 0.186.0 | Aktif | three ile aynı minor. |
| Build | **vite** | 8.3.4 | Aktif | Rolldown tabanlı hızlı HMR; worker, WASM ve `?raw` shader import desteği. |
| Dil | **typescript** | 7.0.x (native) | Aktif | Go tabanlı native derleyici ile ~10× hızlı typecheck. Eklenti uyumsuzluğu olursa 5.9 LTS'e düşülür. |
| ECS | **bitecs** | 0.4.0 | Aktif (2025-12) | Struct-of-Arrays (TypedArray) bileşenler → cache-dostu, binlerce entity, **deterministik sim** için ideal; bileşen dizileri doğrudan instance buffer'lara kopyalanabilir. 0.4 ile relations + esnek bileşen depolama. |
| Navmesh | **recast-navigation** + `@recast-navigation/three` | 0.43.1 | Aktif | Recast/Detour'un WASM portu: haritadan navmesh üretimi, kahraman/serbest birim yol bulma, `DetourCrowd` (local avoidance), tile cache ile dinamik engel (yıkılan duvar, inşa edilen kule). |
| Akış alanı | **Custom Flow Field** (kendi kodumuz) | — | — | TD/FD dalgaları binlerce birimin aynı hedefe gittiği senaryo: tek bir Dijkstra/Eikonal flow field tüm dalgaya hizmet eder; A* × N'den 100× ucuz. Integer grid → deterministik. |
| Uzaysal indeks | **Custom Spatial Hash** (+ `flatbush` statik yapılar için) | 4.6.2 | Aktif | Hedef bulma / boids komşuluk sorguları O(1). Statik binalar için `flatbush` (packed R-tree). |
| Picking | **three-mesh-bvh** | 0.9.16 | Aktif | Arazi/bina raycast (mouse picking, inşa slotu, AoE hedefleme) için BVH hızlandırma. *Not: animasyon için değil, raycast içindir.* |
| Multiplayer | **colyseus** + `@colyseus/sdk` + `@colyseus/schema` | 0.18.9 / 0.18.5 / 5.0.39 | Aktif | Oda/lobi/matchmaking, reconnection, oda başına authoritative process. Biz onu **lockstep komut röle sunucusu + lobi state** olarak kullanırız (bkz. §13.6). |
| Serileştirme | **msgpackr** | 2.1.0 | Aktif | Komut paketleri ve save/replay dosyaları için hızlı binary codec. |
| UI | **solid-js** | 1.9.17 | Aktif | VDOM'suz ince taneli reaktivite; her frame değişen HUD (kaynak, PP, cooldown halkaları) için React'tan çok daha ucuz. JSX ile hızlı geliştirme. |
| UI state köprüsü | Solid `createStore` / signals | — | — | ECS → UI tek yönlü, frame başına batch'lenmiş snapshot. |
| Ses | **howler** + WebAudio `PannerNode` havuzu | 2.2.4 | Stabil (bakımda) | Müzik, UI, audio sprite; spatial plugin ile 3D pozisyon. Ses sesi limiti (voice pooling) bizim katmanımızda. |
| Partikül | **Custom GPU instanced partiküller** (TSL compute) | — | — | Low-poly partiküller = küçük mesh'ler (tetrahedron, kıvılcım quad). Compute shader ile 50k partikül. Yedek: `three.quarks` 0.17.1 (WebGL backend'de). |
| Post-process | **three TSL PostProcessing** (bloom, outline, AO, tonemap) | r186 | — | `postprocessing` (pmndrs) WebGL-only olduğu için WebGPU yolunda TSL yerleşik pass'ları kullanılır. |
| Asset pipeline | **@gltf-transform/core,functions** + **meshoptimizer** (gltfpack) | 4.5.1 / 1.3.0 | Aktif | Blender glTF → dedup, quantize, meshopt sıkıştırma, palette atlas bake, VAT texture paketleme (CLI scripts). |
| Kozmetik fizik (opsiyonel) | `@dimforge/rapier3d-compat` | 0.21.0 | Aktif | **Sadece görsel** enkaz/duvar yıkımı parçaları (sim'e etki etmez → determinizmi bozmaz). Phase 3+. |
| Debug | **lil-gui** 0.21.0, **stats-gl** 4.2.3 | — | Aktif | Tweak paneli, GPU/CPU frame ölçümü (WebGPU uyumlu). |
| Test | **vitest** 5.0.4, **@playwright/test** 1.64.0 | — | Aktif | Sim birim testleri + determinizm testleri (aynı seed/komut → aynı hash); Playwright ile görsel smoke test. |
| Lint/Format | **@biomejs/biome** 2.5.15 | — | Aktif | Tek araç: lint + format, ESLint+Prettier'dan çok hızlı. |

### 2.2 Değerlendirilip Elenen / İkincil Alternatifler

| Kütüphane | Sürüm / Son yayın | Karar | Neden |
|-----------|-------------------|-------|-------|
| **miniplex** | 2.0.0 / 2023-07 | ❌ | 3 yıldır yayın yok; object-based (AoS) yapı, binlerce entity'de GC baskısı; determinizm/serileştirme bitECS kadar kolay değil. |
| **koota** (pmndrs) | 0.6.6 / 2026-10 | 🟡 Yedek | Aktif ve modern (traits, relations), ama 1.0 öncesi API değişkenliği ve React odaklı ekosistem. bitECS'te ciddi engel çıkarsa geçiş adayı. |
| **yuka** | 0.7.8 / 2022-09 | ❌ (referans) | Steering behaviors için iyi bir referans ama 4 yıldır güncellenmiyor, float tabanlı ve OOP; algoritmalarını (separation/cohesion/alignment, arrive, pursue) kendi deterministik ECS sistemlerimize port edeceğiz. |
| **three-pathfinding** | 1.3.0 / 2024-05 | ❌ | Sadece navmesh üzerinde A*; navmesh üretimi ve crowd yok. recast-navigation bunun üst kümesi. |
| **socket.io** | 4.8.4 | ❌ | Ham transport; oda/matchmaking/reconnect'i yeniden yazmak gerekir. Colyseus bunları hazır sunar. |
| **geckos.io** | 3.1.0 / 2026-03 | 🟡 Phase 4 | WebRTC UDP (unreliable) — **state-sync** FPS/aksiyon oyunları için ideal, ama lockstep *güvenilir sıralı* teslimat ister. Gecikme sorunları ölçülürse komut kanalı için değerlendirilir. |
| **peerjs** | 1.5.5 | ❌ | P2P lockstep mümkün ama NAT/host-migration/hile önleme zor; Colyseus relay daha sağlam. |
| **postprocessing** (pmndrs) | 6.39.5 | 🟡 WebGL fallback | WebGL yolunda olgun ve hızlı; WebGPU yolunda kullanılamaz. Tek kod yolu için TSL tercih edildi. |
| **@react-three/fiber** | 9.8.1 | ❌ | React reconciler render döngüsüne overhead ekler; ECS → InstancedMesh doğrudan yazımında ihtiyaç yok. Vanilla three + ECS. |
| **@three.ez/instanced-mesh** | 0.3.16 | 🟡 İnceleme | Per-instance frustum culling, LOD, BVH sunan InstancedMesh2. Kendi GPU culling'imize kıyasla Phase 2'de benchmark edilecek. |
| **three-instanced-uniforms-mesh** | 0.52.5 | 🟡 | Per-instance uniform kolaylığı; TSL `instancedBufferAttribute` ile aynısını doğrudan yapabiliyoruz. |
| **camera-controls** | 3.1.2 | ❌ | Orbit/dolly odaklı; RTS kamerası (edge-pan, sabit pitch, zoom eğrisi, harita sınırı) ~200 satır custom kod. |
| **three-nebula** | 13.3.0 | ❌ | CPU tabanlı partikül, ölçek için yetersiz. |

### 2.3 Animasyon Stratejisi (Araştırma Sonucu)

Binlerce iskeletli (`SkinnedMesh`) karakter CPU'da kemik güncellemesi ve draw call yüzünden **imkansız**. Üç yaklaşım değerlendirildi:

| Yaklaşım | Maliyet | Kalite | Kullanım |
|----------|---------|--------|----------|
| **A. Segmentli Prosedürel Animasyon (SPA)** — model rijit parçalardan oluşur (gövde, baş, sağ kol+silah, sol kol+kalkan, bacaklar); her vertex'in `partId`'si vardır; vertex shader instance başına `animState`, `animPhase`, `hitTime` ile parçaları döndürür/öteler (yürüme sallanması, kılıç savurma, mızrak itme, ok çekme, ölüm devrilmesi). | Çok düşük (texture yok, ~10 ALU/vertex) | Low-poly stil ile **mükemmel uyum** (Thronefall/Bad North bu tarzda) | **Tüm piyade/okçu taburları** (Phase 1) |
| **B. Vertex Animation Textures (VAT)** — Blender'da iskeletli animasyon, vertex pozisyonları (veya kemik matrisleri = "Bone Animation Texture") texture'a bake edilir; shader instance başına frame okur. | Düşük (1–2 texture fetch/vertex) | Organik hareket (trol, mûmak, Ent, at) | **Büyük yaratıklar, süvari, kahramanlar** (Phase 2) |
| **C. GPU Skinning + BatchedMesh** — gerçek iskelet, kemik matrisleri DataTexture'da. | Orta | En yüksek | Sadece yakın plan / kahraman portreleri (opsiyonel) |

**Karar:** A + B hibrit. Tek bir TSL "UnitMaterial" iki yolu da destekler (`USE_VAT` define'ı). Knockback/trample "ragdoll" hissi: sim tarafında deterministik itme vektörü + uçuş yayı (parabola), render tarafında gövdenin `hitTime`'a bağlı devrilme/yuvarlanma rotasyonu — gerçek fizik motoru kullanılmaz.

### 2.4 Yol Bulma & Kalabalık Stratejisi (Araştırma Sonucu)

Üç katmanlı hareket:

1. **Global (strateji):** Flow Field (dalgalar, ortak hedefler) + Detour navmesh A* (oyuncu emirleri, kahramanlar). Flow field'lar hedef başına cache'lenir; bina inşa/yıkımında sadece etkilenen sektörler (16×16 hücre) yeniden hesaplanır.
2. **Tabur (taktik):** Taburun **lideri/sancaktarı** path'i takip eder; askerler formasyon slotlarına (lider uzayında offset) "arrive" steering ile gider. Dar koridorda formasyon otomatik daralır (genişlik = koridor clearance'ı, navmesh'ten örneklenir).
3. **Yerel (fizik):** Spatial hash üzerinde separation + itme (soft collision), kütle oranına göre yer değiştirme (troll > uruk > orc), **trample**: kütle × hız eşiği aşılırsa hedef `Knockback` bileşeni alır.

`DetourCrowd` birkaç yüz ajan için iyidir ama binlerce askerde ve deterministik lockstep'te riskli → crowd'u **tabur liderleri** için kullanırız (≤ 300 ajan), askerler kendi boids sistemimizde.

### 2.5 Multiplayer Stratejisi (Araştırma Sonucu)

| Model | Bant genişliği (3.000 birim) | Uygunluk |
|-------|------------------------------|----------|
| State Sync (snapshot + delta) | ~3.000 × 12 B × 20 Hz ≈ **720 KB/s** / oyuncu | ❌ Çok pahalı |
| **Deterministik Lockstep** (sadece komutlar) | ~**1–3 KB/s** | ✅ RTS standardı (BFME2'nin kendisi de lockstep) |

**Karar:** Deterministik lockstep, Colyseus oda sunucusu komut rölesi + turn zamanlayıcı olarak. Gereklilikler: sabit adımlı sim (20 Hz), **fixed-point matematik (Q16.16, Int32)**, seed'li PRNG (xoshiro128**), sıralı entity iterasyonu, `Math.sin/cos` yerine LUT, float yok. Her 10 tick'te **state hash** (CRC32) karşılaştırması → desync tespiti. Detay §13.6.

---

## 3. Low-Poly Sanat Rehberi (Art Bible)

### 3.1 Genel Kurallar

| Kural | Değer |
|-------|-------|
| Shading | **Flat shading** (vertex normal'leri yüz başına) + 3 kademeli **stilize toon ramp** + yumuşak rim light. Normal map YOK. |
| Doku | Tek **palette atlas** (256×256, 16×16 renk hücresi). UV'ler hücre merkezine "çivilenir". Vertex color sadece AO/gradient için. |
| Takım rengi | Atlas'ta 4 "team" satırı; shader `teamIndex` ile satır kaydırır (pelerin, sancak, kalkan kenarı). |
| Işık | 1 directional (güneş, gölge cascade'li değil → tek shadow map, harita boyutuna sabit), hemisphere ambient, bölge başına ışık sıcaklığı. |
| Kontur | Ekran-uzayı **outline pass** (derinlik + normal kenar) — sadece seçili/hover birimlerde ve binalarda kalın; piyadede ince. |
| Ölçek | 1 birim = 1 metre. İnsan 1.8 m, ama okunabilirlik için **kafa %20 büyük, silahlar %30 büyük** (chibi değil, "heroic proportion lite"). |
| Siluet testi | Her birim, **sadece siyah siluet** olarak 64 px yükseklikte tanınabilmeli. Ayırt edici öğe = başlık + silah + kalkan formu. |

### 3.2 Poligon Bütçeleri (üçgen)

| Varlık | LOD0 | LOD1 (orta) | LOD2 (uzak / impostor) |
|--------|------|-------------|------------------------|
| Piyade (orc, soldier) | 180–300 | 90 | 24 (billboard-cross veya kutu) |
| Elit piyade (Tower Guard, Uruk) | 300–450 | 120 | 24 |
| Süvari (at + binici) | 600–900 | 250 | 40 |
| Büyük yaratık (Troll, Ent) | 1.200–1.800 | 500 | 80 |
| Mûmak | 3.000 | 1.000 | 150 |
| Kahraman | 800–1.500 | 400 | 60 |
| Kule / bina | 500–3.000 | %40 | — |
| Kale (modüler parçalar) | parça başı 200–1.500 | — | — |

### 3.3 Faction Paletleri ve Siluet Anahtarları

| Faction | Ana palet | Vurgu | Siluet anahtarları |
|---------|-----------|-------|--------------------|
| **Gondor** | Kırık beyaz `#E8E4D8`, çelik gri `#8C96A0`, gece mavisi `#1E2A44` | Gümüş, Beyaz Ağaç | **Martı kanatlı yüksek miğfer** (Tower Guard), uzun mızrak + damla kalkan; askerlerde yuvarlak kask + kılıç; Ithilien Rangers'ta yeşil kapüşon + uzun yay. |
| **Rohan** | Toprak yeşili `#4E6B3A`, deri kahve `#7A5534`, altın `#C9A23A` | Beyaz at sancağı | At kuyruklu sivri miğfer, yuvarlak kalkan, mızrak; süvari ağırlıklı yatay siluet. |
| **Lórien / Rivendell** | Altın-yaprak `#D9B44A`, sis yeşili `#9BB59A`, gümüş `#C8D0D8` | Mavi-gümüş (Rivendell) | Uzun ince gövde, **sivri yaprak miğfer**, ince uzun pelerin (Mirkwood: koyu yeşil, kapüşon), hilal glaive (Lórien Warriors), uzun mızrak + at (Rivendell Lancers). |
| **Erebor (Dwarves)** | Pas kırmızısı `#8A3B2B`, bronz `#A7773A`, taş gri `#6E6A63` | Altın rün | Kısa-geniş kare gövde, **çatallı uzun sakal**, boynuzlu/kapaklı miğfer, büyük kare kalkan (Phalanx), çift balta. |
| **Mordor** | Kurum siyahı `#24211F`, pas `#6B3A26`, kirli deri `#5A4A3A` | Kızıl Göz `#C2281E` | Kambur, öne eğik gövde, düzensiz dikenli miğfer, eğri pala, yamalı kalkan. Orc taburları **düzensiz** formasyon. |
| **Isengard** | Demir siyahı `#2B2D30`, kömür `#3A3A3A`, Uruk derisi `#4A3B32` | **Beyaz El** `#F2F2F2` | Uruk-hai: dik, geniş omuz, **Beyaz El boyalı yüz**, kalkan üstünde beyaz el, keskin kenarlı kapalı miğfer; Pikemen'de çok uzun pike; Berserker: çıplak gövde + beyaz el + büyük kılıç. **Disiplinli** kare formasyon. |
| **Nazgûl / Witch-king** | Siyah `#0E0E10`, soluk mavi `#7FA2C2` | Glow | Yırtık pelerin (alpha-cut değil, low-poly parçalı), boş kapüşon içinde soğuk glow. |

### 3.4 Mimari Rehber

* **Minas Tirith:** 7 kat beyaz halka, her kat bir öncekinden ~%15 küçük; Beyaz Kule ince, en üstte. Kesik koni + prizma modüllerden oluşur; çatılar mavi-gri kurşun.
* **Helm's Deep:** Kayaya gömülü Hornburg, eğimli **Deeping Wall** (kalın, tek kemerli culvert), rampalı yol. Kahve-gri taş.
* **Osgiliath:** Yıkık kemer köprüler, yarım kubbeler, beyaz taş üzerinde yosun yeşili vertex gradient.
* **Isengard:** Siyah Orthanc (4 diken taçlı obsidyen prizma), çukurlar, demir iskele, kızıl ocak ışıkları.
* **Modülerlik:** Tüm duvar/kule/kapı parçaları 4 m grid'e oturur (snap). Duvar segmentleri: düz, köşe, T, kapı, yıkık-1/2/3 (hasar aşamaları).

### 3.5 Efekt Dili

* Oklar: tek çizgi + üçgen uç, instance'lanmış; ateşli ok = turuncu emissive + kısa trail.
* Mancınık kayaları: 12-üçgen ikosahedron, çarpmada 6–10 low-poly parça + toz halkası (genişleyen düz disk).
* Büyüler: **Bloom** sadece emissive > 1.0 olan yüzeylerde (seçici). Heal = yeşil-altın yükselen tetrahedronlar; Sunflare = beyaz flaş + yer halkası.
* Ölüm: birim devrilir, 3 sn sonra yere batar (dissolve yok — ucuz ve okunur).
* Fog of War: düşük çözünürlüklü visibility texture (harita 1 px/2 m), shader'da desatüre + karartma, yumuşak kenar.

---

## 4. Oyun Modları

### 4.1 Tower Defense (TD)

* **Hedef:** N dalgayı (varsayılan 30) atlat; "sızan" (leak) düşman başına **Can (Lives)** kaybı (orc = 1, troll = 5, mûmak = 20). Varsayılan can: 50 (solo), 75 (co-op paylaşımlı).
* **Harita:** 1–3 sabit koridor (lane), yanlarda **inşa platformları** (önceden tanımlı slotlar — BFME2 "build plot" mantığı; serbest yerleşim yok → okunabilirlik ve denge).
* **Kule + Garnizon:** Kuleler otomatik saldırır; **Garnizon binaları** (kışla) tabur üretir ve taburlar oyuncu kontrolündedir — bu bizi klasik TD'den ayıran BFME2 farkıdır.
* **Dalga yapısı:** Her 5. dalga **boss/kuşatma dalgası** (Troll, Mûmak, Witch-king). Dalga arası 20 sn hazırlık (co-op'ta "Hazırım" oylaması ile atlanabilir).
* **Co-op:** Her oyuncunun kendi slot bölgesi + ortak merkez slotlar; kaynaklar ayrı, can paylaşımlı.

### 4.2 Fortress Defense (FD)

* **Merkez:** Bir **Citadel** (HP 10.000). Citadel düşerse oyun biter.
* **Duvar soketleri (Wall Hardpoints):** Duvar segmentlerinde soketler — her biri: *Archer Tower*, *Catapult/Trebuchet*, *Burning Oil (Sıcak Yağ)*, *Ballista*, *Flame Brazier*.
* **Kapı yükseltmeleri:** Wooden Gate → **Iron Gate** (+%100 HP, ram'e karşı direnç) → **Postern Gate** (kendi birimlerin çıkış yapabilir, düşman giremez).
* **İç slotlar:** Kışla, Ahır, Okçuluk Alanı, Demirci (yükseltmeler), Çiftlik/Değirmen (ekonomi), Sur Onarım Atölyesi.
* **Düşman kuşatma araçları:** Battering Ram (kapı hasarı ×10), Siege Tower (duvarı aşar, mürettebatını bırakır), Siege Ladder (Uruk taburu), Attack Troll (duvar hasarı), **Explosive Mine** (Isengard — duvarda gedik açar; gedik = yeni navmesh yolu ve flow field yeniden hesaplanır).
* **Gedik mekaniği:** Duvar segmenti HP'si 0 → "yıkık" mesh'e geçer, navmesh tile'ı güncellenir, düşmanlar akışı oraya yönlendirir. Onarım Atölyesi ile (ücret + süre) onarılabilir.

### 4.3 PvP (Phase 4+)

* **Siege PvP:** Bir taraf FD savunucusu (Good), diğeri kuşatan (Evil) — saldıran dalgaları kendisi satın alıp gönderir ("send units" mekaniği, BFME2 custom haritalarındaki gibi).
* **Lane PvP:** 2v2, her takımın kendi TD koridoru; öldürülen düşmanlar rakibe "gönderilecek" ekstra birim kredisi kazandırır.

### 4.4 Zorluk Seviyeleri

| Seviye | Düşman HP | Düşman sayısı | Başlangıç kaynak | Not |
|--------|-----------|---------------|------------------|-----|
| Easy | ×0.75 | ×0.8 | 1.500 | Dalga arası 30 sn |
| Normal | ×1.0 | ×1.0 | 1.000 | — |
| Hard | ×1.3 | ×1.25 | 800 | Boss'lar ekstra yetenekli |
| Brutal | ×1.6 | ×1.5 | 600 | Spellbook maliyeti ×1.25 |

---

## 5. Temel Oynanış Döngüsü ve Ekonomi

```
 ┌──────────────┐   kaynak    ┌──────────────┐  üret / inşa  ┌──────────────┐
 │  Ekonomi     │ ──────────▶ │ Kararlar     │ ────────────▶ │ Savunma      │
 │ (pasif gelir,│             │ (slot, kule, │               │ (kuleler,    │
 │  çiftlik,    │ ◀────────── │  tabur, spell│ ◀──────────── │  taburlar,   │
 │  kill bounty)│   bounty    │  yükseltme)  │  XP / PP      │  kahraman)   │
 └──────────────┘             └──────────────┘               └──────────────┘
                                     ▲                               │
                                     └────── Dalga sonucu ◀──────────┘
```

### 5.1 Kaynaklar

| Kaynak | Kaynağı | Kullanım |
|--------|---------|----------|
| **Resources (Altın)** | Pasif gelir (+10/sn baz), Çiftlik/Değirmen/Maden (+X/sn), kill bounty (birim maliyetinin %15'i), dalga tamamlama bonusu | Bina, tabur, kule, yükseltme |
| **Command Points (CP)** | Citadel + her Çiftlik/Ev (+20 CP) | Ordu tavanı (BFME2 mantığı; taburların CP maliyeti var) |
| **Power Points (PP)** | Düşman öldürme (öldürülen birimin **seviyesi/değeri** ile orantılı), kahraman rank atlaması, dalga bonusu | Spellbook |
| **Hero XP** | Kahramanın yakınında ölen düşmanlar | Rank 1–10 |

### 5.2 Birim XP ve Rank (Tabur)

Taburlar da BFME2'deki gibi seviye atlar: **Rank 1 → 5** (her rank +%10 HP, +%10 hasar; Rank 3'te sancak altın, Rank 5'te tabur glow). Yükseltmeler (Forged Blades, Heavy Armor, Fire Arrows, Banner Carrier) taburda **görsel olarak** görünür (kılıç rengi, zırh parçası, ateş efekti, ekstra sancaktar).

---

## 6. Tabur (Battalion/Horde) Sistemi ve Savaş Kuralları

### 6.1 Tabur Yapısı

| Özellik | Değer |
|---------|-------|
| Asker sayısı | Faction/birime göre 5–20 (Gondor Soldiers 15, Uruk-hai 10, Orc Warriors 20, Rohirrim 5, Trolls 1) |
| Sancaktar | Banner Carrier yükseltmesiyle: ölen askerleri zamanla yeniler (dalga dışında hızlı) |
| Formasyonlar | **Line** (varsayılan), **Wedge** (süvari / Uruk saldırı), **Porcupine/Pike Wall** (mızrakçı: süvariye ×3 hasar, hareketsiz), **Shield Wall** (Phalanx, Gondor: ok hasarı ‑%60, yavaş), **Loose** (okçu, AoE'ye dayanıklı) |
| Kontrol | Tabur tek entity olarak seçilir; komutlar taburadır, askerler slot takip eder |
| Moral (opsiyonel, Phase 3) | Lider/kahraman yakınlığı, kayıp oranı; düşükse Fear (BFME2 "Terror" efekti: Nazgûl çığlığı) |

### 6.2 Hasar Tipleri ve Zırh Matrisi (BFME2 tarzı counter)

Hasar çarpanları (`hasarTipi × zırhTipi`):

| Hasar ↓ / Zırh → | Light (orc, okçu) | Medium (piyade) | Heavy (Uruk, Tower Guard) | Cavalry | Monster (Troll, Ent) | Structure |
|------------------|------|------|------|------|------|------|
| **Slash** (kılıç) | 1.25 | 1.0 | 0.75 | 1.0 | 0.5 | 0.25 |
| **Pierce** (ok) | 1.5 | 1.0 | 0.5 | 1.0 | 0.6 | 0.1 |
| **Spear** (mızrak/pike) | 1.0 | 1.0 | 0.9 | **3.0** | 1.0 | 0.25 |
| **Crush** (troll, balyoz) | 1.25 | 1.25 | 1.0 | 1.0 | 1.0 | 1.5 |
| **Siege** (mancınık, ram) | 0.75 (AoE) | 0.75 | 0.75 | 0.75 | 1.0 | **4.0** |
| **Fire** | 1.5 | 1.25 | 0.75 | 1.0 | 1.0 | 1.5 |
| **Magic** | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.5 |

**Counter üçgeni:** Mızrakçı > Süvari > Okçu > Mızrakçı; Kuşatma > Bina; Kahraman > Tabur (ama tabur sürüsü > kahraman).

### 6.3 Trample / Knockback (Ezilme)

* Saldırı (veya hareket eden süvari/troll) `kütle × hız ≥ eşik` ve hedef `kütle < saldıranın %40'ı` ise: hedef `Knockback{dir, power, airborneTicks}` bileşeni alır.
* Knockback'teki birim: hareketsiz, savunmasız, parabolik yay (fixed-point), yere düşünce 1 sn "yerde" durumu.
* Render: gövde `hitTime`'a göre devrilme rotasyonu + yay yüksekliği → "ragdoll" hissi, sıfır fizik motoru.
* Pike Wall formasyonu trample'a bağışık; süvari pike'a çarparsa süvari knockback alır.

### 6.4 Hedefleme ve Saldırı

* Hedef seçimi: spatial hash'te yarıçap sorgusu, öncelik: (1) oyuncunun verdiği hedef, (2) bana saldıran, (3) counter avantajlı en yakın, (4) en yakın.
* Menzilli: mermi entity'si (ok/kaya) — **sim'de analitik balistik** (uçuş süresi hesaplanır, isabet tick'i önceden bilinir), render'da yay görselleştirilir. Ok yağmuru = tek "volley" entity'si + N görsel ok (sim ucuz).
* Yakın dövüş: askerler hedef taburun askerleriyle eşleşir (slot eşleme), kendi `attackCooldown` döngüsü.

---

## 7. Faction'lar, Birimler, Kuleler ve Binalar

> Değerler **ilk denge taslağıdır** (BFME2'den esinlenmiş, birebir kopya değil). Sütunlar: Maliyet (Altın) / CP / Asker / HP (asker başı) / Hasar (asker başı, tip) / Menzil (m) / Hız (m/s) / Zırh.

### 7.1 Men of the West — Gondor & Rohan

| Birim | Maliyet | CP | Asker | HP | Hasar | Menzil | Hız | Zırh | Rol / Not |
|-------|---------|----|-------|----|-------|--------|-----|------|-----------|
| Soldiers of Gondor | 200 | 15 | 15 | 100 | 12 Slash | 1.5 | 4.5 | Medium | Çekirdek piyade; **Shield Wall** |
| Gondor Archers | 300 | 15 | 15 | 70 | 10 Pierce | 30 | 4.5 | Light | Fire Arrows yükseltmesi |
| Tower Guards | 400 | 20 | 15 | 140 | 14 Spear | 2.5 | 4.0 | Heavy | Anti-süvari, **Pike Wall**; kanatlı miğfer |
| Ithilien Rangers | 600 | 20 | 10 | 90 | 18 Pierce | 40 | 5.0 | Light | Kamuflaj (hareketsizken görünmez), uzun menzil |
| Knights of Dol Amroth | 1.000 | 30 | 5 | 400 | 30 Slash | 2 | 9.0 | Cavalry | Ağır süvari, trample |
| Rohirrim | 900 | 30 | 5 | 320 | 24 Spear | 2 | 10.0 | Cavalry | Hızlı süvari, Wedge charge |
| Trebuchet | 800 | 40 | 1 (+4 mürettebat) | 1.200 | 400 Siege (AoE 6 m) | 120 | 2.0 | Structure | Min. menzil 25 m |

**Kuleler (Gondor/Rohan):**

| Kule | Maliyet | HP | Hasar | Menzil | Saldırı hızı | Yükseltmeler |
|------|---------|----|-------|--------|--------------|--------------|
| Gondor Arrow Tower | 400 | 1.500 | 3 × 15 Pierce | 40 | 1.2 sn | Fire Arrows, Watchtower (görüş +%50), Masonry (+%50 HP) |
| Trebuchet Emplacement (duvar) | 900 | 2.500 | 450 Siege AoE | 140 | 6 sn | Fire Stones, Hardened Frame |
| Rohan Horse-Lord Outpost | 600 | 1.800 | — (her 30 sn 1 Rohirrim spawn, max 2) | — | — | Elite Horses |
| Burning Oil Cauldron | 500 | 800 | 60/sn Fire (koni, kapı önü) | 10 | sürekli, 8 sn aktif / 15 sn cd | Hot Pitch |

### 7.2 Elves — Lórien & Rivendell

| Birim | Maliyet | CP | Asker | HP | Hasar | Menzil | Hız | Zırh | Rol / Not |
|-------|---------|----|-------|----|-------|--------|-----|------|-----------|
| Lórien Warriors | 400 | 20 | 10 | 120 | 18 Slash | 1.5 | 5.0 | Medium | Glaive, Lórien okçusu yükseltmesi ile menzilli/yakın geçiş |
| Mirkwood Archers | 500 | 20 | 10 | 80 | 16 Pierce | 45 | 5.0 | Light | Yüksek menzil, Silverthorn Arrows |
| Rivendell Lancers | 1.100 | 30 | 5 | 380 | 28 Spear | 2.5 | 10.0 | Cavalry | Ağır mızraklı süvari |
| Lórien Archers | 400 | 20 | 10 | 75 | 14 Pierce | 40 | 5.0 | Light | Hızlı atış |
| **Ent** | 1.800 | 60 | 1 | 4.000 | 120 Crush (+kaya atar, 300 Siege) | 3 / 50 | 4.0 | Monster | Ateşe zayıf (×2), binalara ×4 |

**Kuleler (Elves):** *Mallorn Flet* (okçu platformu, 3 elf garnizon, 450), *Elven Gate Ward* (yavaşlatma aurası, 600), *Fountain of Lórien* (iyileştirme alanı, 700).

### 7.3 Dwarves — Erebor

| Birim | Maliyet | CP | Asker | HP | Hasar | Menzil | Hız | Zırh | Rol / Not |
|-------|---------|----|-------|----|-------|--------|-----|------|-----------|
| Dwarven Guardians | 300 | 15 | 10 | 160 | 16 Slash | 1.5 | 3.8 | Heavy | Dayanıklı ön hat |
| Phalanx | 450 | 20 | 10 | 180 | 18 Spear | 2.5 | 3.5 | Heavy | Anti-süvari + Shield Wall |
| Axe Throwers | 400 | 15 | 10 | 120 | 20 Slash (menzilli) | 25 | 3.8 | Medium | Zırh delici |
| Battlewagon | 1.000 | 40 | 1 (+3) | 1.500 | 40 Pierce / trample | 30 | 7.0 | Cavalry | Taşıyıcı, ezme |
| Dwarven Catapult | 900 | 40 | 1 (+4) | 1.300 | 380 Siege AoE | 130 | 2.0 | Structure | Fire Stones / Splitting Stones |

**Kuleler (Dwarves):** *Dwarven Stone Tower* (Axe thrower garnizon, 500), *Forge Hall* (tüm cüce birimlere +%10 zırh aurası, 900), *Mine Shaft* (ekonomi + tünel ağı, 600).

### 7.4 Mordor & Isengard (Düşman / PvP Evil)

| Birim | Maliyet | CP | Asker | HP | Hasar | Menzil | Hız | Zırh | Rol / Not |
|-------|---------|----|-------|----|-------|--------|-----|------|-----------|
| Mordor Orc Warriors | 100 | 10 | 20 | 60 | 8 Slash | 1.5 | 5.0 | Light | Ucuz sürü, düzensiz formasyon |
| Orc Archers | 150 | 10 | 20 | 50 | 7 Pierce | 30 | 5.0 | Light | — |
| **Uruk-hai** (Swordsmen) | 300 | 15 | 10 | 160 | 18 Slash | 1.5 | 4.5 | Heavy | Beyaz El kalkanı |
| **Uruk Pikemen** | 400 | 20 | 10 | 150 | 16 Spear | 3 | 4.2 | Heavy | Pike Wall |
| **Uruk Crossbowmen** | 450 | 20 | 10 | 110 | 26 Pierce | 35 | 4.2 | Medium | Zırh delici, Fire Bolts |
| **Berserkers** | 300 | 15 | 1 | 600 | 60 Slash (AoE swing) | 2 | 6.0 | Medium | Trample, kapı/duvar üstüne Explosive Mine taşır |
| **Ballista** (Isengard) | 700 | 40 | 1 (+3) | 1.000 | 220 Siege (+ çizgi pierce) | 110 | 2.0 | Structure | — |
| Siege Ladder (Uruk) | 300 | 20 | 1 (+5) | 600 | — | — | 3.0 | Structure | Duvar aşma |
| Battering Ram | 500 | 30 | 1 | 2.000 | 400 Siege (sadece kapı/bina) | 2 | 2.5 | Structure | Oklara dirençli |
| Siege Tower | 800 | 40 | 1 (+Uruk taburu) | 3.000 | — | — | 2.0 | Structure | Duvar üstüne asker bırakır |
| **Attack Troll** | 1.000 | 40 | 1 | 2.500 | 90 Crush AoE / taş atma | 3 / 40 | 4.5 | Monster | Ağaç gövdesi silah; trample |
| Mountain/Drummer Troll | 1.400 | 50 | 1 | 3.200 | 110 Crush | 3 | 4.0 | Monster | Davul: yakın orc'lara hız/moral |
| **Mûmakil** (Haradrim) | 2.500 | 80 | 1 (+okçular) | 8.000 | 200 Crush trample | 4 | 6.0 | Monster | Sırtında okçular; ateşe panik |
| **Nazgûl** (Fell Beast) | 2.000 (veya boss) | — | 1 | 3.000 | 150 Slash + Screech (Terror AoE) | 3 | 14 (uçan) | Monster | Uçan; sadece okçu/kule vurabilir |

**Dalga kompozisyon örneği (FD Normal, Helm's Deep):**

| Dalga | İçerik |
|-------|--------|
| 1–2 | 4× Orc Warriors |
| 3 | 3× Orc Warriors + 2× Orc Archers |
| 5 (boss) | 4× Uruk-hai + 1× Battering Ram + Lurtz |
| 8 | 4× Uruk Pikemen + 2× Crossbowmen + 2× Siege Ladder |
| 10 (boss) | 6× Uruk-hai + 2× Berserker (mine) + 1× Siege Tower + Saruman (uzaktan büyü) |
| 15 (boss) | 2× Attack Troll + 8× Orc + Witch-king (Fell Beast) |
| 20 (final) | Karışık 24 tabur + 2× Mûmak + 2× Siege Tower + Explosive Mine |

### 7.5 Ortak Binalar (Slot)

| Bina | Maliyet | Etki | Faction varyantı |
|------|---------|------|------------------|
| Barracks | 300 | Piyade üretimi | Gondor Barracks / Elven Hall / Dwarven Hall |
| Archery Range | 300 | Okçu üretimi | — |
| Stable | 500 | Süvari üretimi | Rohan Stable / Rivendell Stable |
| Forge / Armory | 600 | Global yükseltmeler (Forged Blades +%25 hasar, Heavy Armor ‑%25 hasar alır, Fire Arrows) | — |
| Farm / Mill / Mine | 200–300 | +12–20 altın/sn, +20 CP | Seviye 1–3 |
| Siege Workshop | 700 | Trebuchet/Catapult | — |
| Well / Healing Fountain | 400 | Alan iyileştirme | — |
| Wall Repair Yard (FD) | 500 | Duvar onarımı | — |

---

## 8. Kahramanlar

### 8.1 Genel Kurallar

* Oyuncu başına aynı anda **1 aktif kahraman** (Co-op'ta farklı kahramanlar seçilmeli). Ölürse Citadel'de yeniden canlandırma (maliyet = %50 temel fiyat, süre 45 sn).
* **Rank 1–10:** XP eşikleri `xp(r) = 100 × r^1.6`. Her rank +%8 HP/hasar; 2, 4, 7, 10. rank'larda yetenek açılır.
* **Leadership:** Pasif aura (yarıçap 20 m) — dost taburlara buff.
* Yetenek tipleri: Hedefli (birim), Alan (zemin), Self-buff, Toggle (silah değiştirme — Legolas/Aragorn yakın/uzak).

### 8.2 Kahraman Tablosu

| Kahraman | Faction | Maliyet | Leadership | Rank 2 | Rank 4 | Rank 7 | Rank 10 |
|----------|---------|---------|------------|--------|--------|--------|---------|
| **Gandalf the White** | Good | 3.000 | +%25 zırh (yakın taburlar) | Istar Light (kör etme) | Word of Power (AoE knockback) | Shadowfax (hız) | **Blinding Light** (alan sersemletme + nazgûl korkutma) |
| **Aragorn** | Gondor | 2.500 | +%25 hasar, +%50 XP | Blade Master | Elendil'in Kılıcı (yakın hasar ×2) | Athelas (heal) | **Army of the Dead** (ölüler ordusu çağır) |
| **Legolas** | Elves | 2.200 | +%25 ok isabeti (okçu taburlar) | Hawk Strike | Train Archers (tabur rank +1) | Arrow Wind (koni çoklu ok) | **Knife Fighter** toggle + Rapid Fire |
| **Gimli** | Dwarves | 2.000 | +%25 hasar (cüce) | Leap Attack | Axe Throw | Elven Wood'da gizlenme bağışıklığı | **Lord of the Glittering Caves** (yer sarsıntısı) |
| **Witch-king** | Mordor | 3.500 | Orc'lara +%50 moral, Terror | Morgul Blade | Screech (AoE fear) | Fell Beast mount | **Wail of the Nazgûl** |
| **Saruman** | Isengard | 3.000 | Uruk'lara +%25 hasar | Fireball | Wormtongue (düşman yavaşlat) | Speech-craft (düşman taburu dondur) | **Wizard Blast** (dev knockback) |
| **Lurtz** | Isengard | 1.800 | Uruk'lara +%20 hız | Uruk Fury | Cleave | Captain of Isengard | **Crippling Shot** |

Kahramanlar kampanya/TD'de AI boss olarak da kullanılır (ör. Lurtz dalga 5 boss'u).

---

## 9. Spellbook (Güç Ağacı)

### 9.1 Kurallar

* 4 kademe, **her kademe en az 1 önceki kademe spell'i açılmadan erişilemez.** Toplam 13 düğüm; bir maçta ~8–9 tanesi açılabilir (seçim baskısı).
* PP kazanımı: öldürülen birimin **değeri / 50** (orc ≈ 0.1, troll ≈ 1.0), dalga bonusu +2, kahraman rank atlama +1.
* Açma maliyeti (PP) → **açtıktan sonra** spell kendi cooldown'u ile tekrar tekrar kullanılabilir (BFME2 mantığı; tek kullanım değil).

### 9.2 Forces of Good (Men/Elves/Dwarves ortak)

```
TIER 1 (5 PP)       [Heal]──────────[Elven Wood]──────────[Rallying Call]
                       │                  │                      │
TIER 2 (10 PP)     [Arrow Volley]   [Elven Allies]         [Barricade]
                       │      ╲          │      ╱                │
TIER 3 (15 PP)     [Summon Rohirrim]  [Cloak of Lórien]   [Earthquake]
                             ╲            │            ╱
TIER 4 (25 PP)          [Army of the Dead]   [Sunflare]   [Summon Eagles]
```

| Spell | Tier | PP | Cooldown | Etki |
|-------|------|----|----------|------|
| Heal | 1 | 5 | 90 sn | 20 m alanda dost birimlere %60 HP |
| Elven Wood | 1 | 5 | 120 sn | 30 sn orman alanı: dostlara +%25 zırh/gizlenme, düşmana yavaşlama |
| Rallying Call | 1 | 5 | 120 sn | 30 sn tüm dostlara +%25 hasar ve korku bağışıklığı |
| Arrow Volley | 2 | 10 | 120 sn | Hedef alana 3 dalga ok yağmuru (görsel: 300 ok instance) |
| Elven Allies | 2 | 10 | 180 sn | 2 tabur Lórien okçusu, 60 sn |
| Barricade | 2 | 10 | 150 sn | Geçici taş duvar (navmesh'e dinamik engel) |
| Summon Rohirrim | 3 | 15 | 240 sn | Haritanın kenarından düz çizgide geçen 6 tabur Rohirrim (trample) |
| Cloak of Lórien | 3 | 15 | 180 sn | Tüm ordu 30 sn görünmez |
| Earthquake | 3 | 15 | 240 sn | Alanda bina/duvar hasarı + düşman knockback |
| Army of the Dead | 4 | 25 | 420 sn | 60 sn hayalet ordu (sadece düşman birimine hasar, ölümsüz) |
| Sunflare | 4 | 25 | 360 sn | Büyük alanda Nazgûl/troll/orc'lara ağır hasar + kör |
| Summon Eagles | 4 | 25 | 360 sn | Kartallar 45 sn uçan birimleri ve trolleri avlar |

### 9.3 Forces of Darkness (PvP / AI)

| Tier | Spell'ler |
|------|-----------|
| 1 (5) | Tainted Land (düşmanı zayıflat), Eye of Sauron (+hasar & görüş), Untamed Allegiance (wargs çağır) |
| 2 (10) | Freeze (alan dondurma), Call the Horde (orc taburları), Watcher in the Water |
| 3 (15) | Darkness (düşman ‑%25 hasar), Dragon Strike, Fuel the Fires (bina hasarı) |
| 4 (25) | **Summon Balrog**, Earthquake (Evil), Rain of Fire |

---

## 10. Haritalar

Tüm haritalar **diorama** tarzı: sınırlı alan, kenarları kayalık/kesilmiş ada (Bad North gibi), uzaktan "masa üstü maket" hissi. Harita boyutu 256×256 m (küçük) – 512×512 m (büyük).

### 10.1 Helm's Deep — *FD, asimetrik* (MVP haritası adayı)

* **Düzen:** Kuzeyde kayaya gömülü Hornburg + Glittering Caves (Citadel = mağara ağzı). Güneyde Deeping Wall (duvar 6 segment + culvert). Rampadan Hornburg kapısına çıkan yol.
* **Saldırı yolları:** (1) Ana rampa → Hornburg Kapısı (Ram hedefi), (2) Deeping Wall merdiven/kule noktaları, (3) **Culvert** (Explosive Mine hedefi — patlarsa gedik).
* **Slotlar:** Duvar soketleri ×10, iç slot ×6, Hornburg kulesi ×2 (trebuchet).
* **Özel mekanik:** Dalga 15'te "**Dawn Event**" — Gandalf + Rohirrim doğu sırtından iner (Spellbook dışı scripted yardım, Normal ve altında).

### 10.2 Minas Tirith — *FD, katmanlı*

* **Düzen:** 7 kat; oyuncu **Kat 1–3**'ü savunur (Phase 3'te 7 kat). Her kat kendi kapısı ve sur soketlerine sahip. Kat düşerse savunma bir üst kata çekilir (geri çekilme mekaniği — kaybedilen katın binaları yok olur, %25 iade).
* **Saldırı:** Pelennor Çayırları'ndan geniş cephe, Grond (boss ram), Siege Tower'lar, Mûmakil, Nazgûl.
* **Özel mekanik:** Trebuchet'ler Pelennor'daki düşman mancınıklarına karşı **karşı-batarya** düellosu.

### 10.3 Osgiliath & Cair Andros — *TD, dar koridor*

* **Osgiliath:** Nehir haritayı ikiye böler; 3 yıkık köprü = 3 koridor. Köprüler yıkılabilir/onarılabilir (TD'de yolu kapatmak = diğer köprülere yük bindirmek). Yüzen sallarla gelen bonus dalgalar.
* **Cair Andros:** Nehir ortasında ada kalesi; düşman hem kuzey hem güney kıyıdan, Corsair gemileri nehirden (gemi = hareketli spawn).

### 10.4 Isengard — *TD/FD varyant (Evil savunma veya Good saldırı PvP)*

* Orthanc merkezde, çukurlar (pit) = üretim slotları (Isengard ekonomisi). Entler (Good) dalga halinde saldırır; **Baraj** mekaniği: dalga 20'de baraj patlar, sel alt katmanları temizler (her iki taraf için risk).

### 10.5 Black Gate (Morannon) — *FD finali*

* Good kuşatan, Evil savunan PvP haritası; Kara Kapı devasa bir "gate" entity'si (3 aşamalı hasar). Çorak, volkanik kül partikülleri, kızıl gökyüzü.

### 10.6 Harita Veri Formatı

Haritalar Blender'da modüler parçalarla kurulur, export'ta özel isimli empty'ler/koleksiyonlar okunur:

```
map.glb                   # görsel geometri (statik, BatchedMesh'e yüklenir)
map.nav.bin               # önceden bake edilmiş recast navmesh (tile cache)
map.json                  # meta: slotlar, spawn noktaları, lane'ler, dalga tablosu, script olayları
  {
    "id": "helms_deep", "mode": "FD", "size": [384, 384],
    "citadel": { "pos": [0, 12, -140], "hp": 10000 },
    "slots": [{ "id": "W1", "kind": "wall_socket", "pos": [...], "allowed": ["arrow_tower","catapult","oil"] }],
    "spawns": [{ "id": "S_main", "pos": [...], "lane": "ramp" }],
    "waves": "waves/helms_deep_normal.json",
    "scripts": [{ "atWave": 15, "event": "dawn_rohirrim" }]
  }
```

---

## 11. UI/UX — Palantír Arayüzü

### 11.1 Ekran Düzeni

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [Kaynak 1.240] [CP 145/300] [PP 12]        Dalga 7/30  ▸ 00:14   [⚙] [≡] │  ← Üst şerit
│                                                                           │
│                                                                           │
│                         3D SAHNE (RTS kamera)                             │
│                                                                           │
│ [Kahraman portreleri]                                         [Spellbook] │
│  ◉ Aragorn R4  ▓▓▓▓░                                           (kitap ⧉)  │
│                                                                           │
├──────────────┬────────────────────────────────────────────┬──────────────┤
│   MİNİ-HARİTA │  ╭──────────╮   Komut Paneli (seçime göre)  │  Seçim Bilgisi│
│   (fog dahil) │  │ PALANTÍR │   [Üret][Üret][Yükselt][..]   │  Tabur: 12/15 │
│               │  │ (portre) │   [Formasyon ▸ Line/Wedge/..] │  Rank ★★☆☆☆  │
│               │  ╰──────────╯   [Yetenek 1][2][3][4]        │  HP ▓▓▓▓▓░░  │
└──────────────┴────────────────────────────────────────────┴──────────────┘
```

* **Palantír:** Alt-ortada dairesel küre; seçili birimin/kahramanın döner 3D portresini gösterir (ayrı küçük render target, 128×128, 10 FPS güncelleme). Etrafında halka şeklinde yetenek butonları + cooldown "saat" maskesi (BFME2 ikonik).
* **Spellbook:** Kitap ikonu → tam ekran yarı saydam parşömen; ağaç düğümleri, kilitli/açık/hazır/cooldown durumları.
* **Dünya içi:** Tabur sağlık barı (tek bar, tabur toplamı), rank yıldızları, sancak ikonu; inşa slotlarında hover'da hayalet önizleme (yeşil/kırmızı).

### 11.2 Kontroller (BFME2 uyumlu)

| Eylem | Girdi |
|-------|-------|
| Seç / kutu seçim | Sol tık / sürükle |
| Hareket / saldırı | Sağ tık (BFME2 varsayılanı) — ayarlarda "klasik sol tık" seçeneği |
| Kamera kaydırma | WASD / ok tuşları / kenar kaydırma / orta tuş sürükle |
| Kamera döndür / zoom | Alt + sürükle (veya Q/E) / tekerlek |
| Kontrol grupları | Ctrl+1..9, 1..9, çift tık = odakla |
| Formasyon | F (döngü) |
| Saldırgan hareket / Dur / Tut | A / S / H |
| Spellbook | Tab |
| Kahramana odaklan | Space / Home |
| Duraklat (solo) | P |

### 11.3 UI Teknik

* Solid.js bileşenleri, three canvas'ın üstünde ayrı DOM katmanı. **ECS → UI köprüsü:** her render frame'de değil, 10 Hz'de "UISnapshot" (kaynaklar, seçim, cooldown'lar) Solid store'a `batch()` ile yazılır. Cooldown halkaları CSS `conic-gradient` + CSS değişkeni (frame başı DOM yazımı yok, `requestAnimationFrame`'de sadece custom property).
* Erişilebilirlik: renk körü modu (takım renkleri için desen/ikon), UI ölçek 75–150%, tüm tuşlar yeniden atanabilir.

---

## 12. Ses Tasarımı

| Katman | Teknoloji | Detay |
|--------|-----------|-------|
| Müzik | Howler (HTML5 stream) | Dinamik katmanlar: Hazırlık (sakin) → Dalga (davullar) → Boss (koro). Crossfade 2 sn. |
| UI | Howler audio sprite | Tek dosyada tüm tıklama/bildirim sesleri. |
| Birim yanıtları | Howler sprite (faction başına) | Seçim/emir sesleri ("For Gondor!" tarzı — orijinal kayıtlar, IP'ye dikkat). |
| 3D Dünya | WebAudio `PannerNode` havuzu (32 ses) | **Ses kümeleme:** 100 asker çarpışırken 100 ses değil, spatial hash hücresi başına 1 "savaş ambiyansı" emitter'ı, yoğunluğa göre volume/katman. Öncelik: Spell > Kahraman > Kuşatma > Ok > Kılıç. |
| Ambiyans | Bölge başına loop | Rüzgar, nehir, ocak (Isengard). |

Ses dinleyici kamera hedef noktasına (yere) bağlanır, kameraya değil (RTS standardı: zoom'da ses mesafesi tutarlı).

---

## 13. Teknik Mimari

### 13.1 Mimari İlkeler

1. **Simülasyon ve render tamamen ayrık.** `@bulwark/sim` paketi three.js'i **import edemez** (lint kuralı ile zorlanır). Sim saf TypeScript + bitECS + fixed-point.
2. **Sim, Web Worker'da çalışır** (20 Hz sabit tick). Ana thread sadece input, render, UI, ses.
3. **Determinizm birinci kural:** Sim'de `Math.random`, `Date.now`, `Math.sin`, float aritmetik, `Map` iterasyon sırasına bağlı mantık **yasak**.
4. **Her şey veri:** Birimler, kuleler, spell'ler, dalgalar JSON/TS data tanımları — kod değişmeden denge yapılabilir.
5. **InstancedMesh / BatchedMesh zorunlu:** Hiçbir birim/mermi/partikül tekil `Mesh` değildir. Statik harita = `BatchedMesh`; birimler = tip + LOD başına `InstancedMesh`.

### 13.2 Monorepo Klasör Yapısı (pnpm workspaces)

```
bulwark/
├── GDD.md
├── package.json                  # pnpm workspaces, root scripts
├── pnpm-workspace.yaml
├── biome.json
├── tsconfig.base.json
├── packages/
│   ├── shared/                   # sim + client + server ortak
│   │   └── src/
│   │       ├── math/fixed.ts     # Q16.16 fixed-point, trig LUT, sqrt
│   │       ├── math/vec2fx.ts
│   │       ├── rng/xoshiro.ts    # seed'li deterministik PRNG
│   │       ├── protocol/         # Command tipleri, msgpack codec, lockstep mesajları
│   │       └── data/             # birim/kule/spell/kahraman tanımları (typed)
│   │           ├── factions/gondor.ts, isengard.ts, ...
│   │           ├── spells.ts, heroes.ts, armor.ts (hasar matrisi)
│   │           └── waves/*.json
│   ├── sim/                      # deterministik oyun simülasyonu (three YOK)
│   │   └── src/
│   │       ├── world.ts          # bitECS world oluşturma, tick()
│   │       ├── components/       # Transform, Velocity, Health, Battalion, Soldier, Weapon,
│   │       │                     # Target, Projectile, Knockback, Building, Slot, Hero, Team ...
│   │       ├── systems/          # (tick sırasına göre) aşağıdaki §13.4
│   │       ├── nav/
│   │       │   ├── flowfield.ts  # sektörlü integer flow field
│   │       │   ├── spatialHash.ts
│   │       │   └── navmesh.ts    # recast-navigation sarmalayıcı (query only)
│   │       ├── commands.ts       # Command → ECS mutasyonu
│   │       ├── hash.ts           # state CRC32 (desync tespiti)
│   │       └── snapshot.ts       # render için SharedArrayBuffer yazımı
│   ├── client/                   # Vite uygulaması
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app/              # boot, loader, scene yönetimi
│   │       ├── render/
│   │       │   ├── renderer.ts   # WebGPURenderer (+WebGL2 fallback), PostProcessing
│   │       │   ├── camera/RTSCamera.ts
│   │       │   ├── materials/    # TSL: ToonMaterial, UnitMaterial (SPA+VAT), Water, Fog
│   │       │   ├── units/UnitRenderer.ts   # tip×LOD InstancedMesh, snapshot → instance attr
│   │       │   ├── map/MapRenderer.ts      # BatchedMesh statik geometri
│   │       │   ├── fx/           # GPU partiküller, projectile renderer, decal'lar
│   │       │   ├── fog/FogOfWar.ts
│   │       │   └── interp.ts     # iki sim snapshot'ı arası interpolasyon
│   │       ├── input/            # mouse/keyboard → Command
│   │       ├── net/              # LocalTransport (solo) | ColyseusTransport (MP), lockstep scheduler
│   │       ├── sim-host/         # Worker başlatma, SAB yönetimi
│   │       ├── ui/               # Solid.js: HUD, Palantír, Spellbook, Lobby, Menüler
│   │       ├── audio/
│   │       └── debug/            # lil-gui, stats-gl, nav/flowfield görselleştirici
│   └── server/                   # Colyseus
│       └── src/
│           ├── index.ts
│           ├── rooms/LobbyRoom.ts
│           ├── rooms/MatchRoom.ts   # lockstep relay, turn clock, desync hakemliği
│           └── replay/              # komut kaydı → replay dosyası
├── assets/
│   ├── source/                   # .blend dosyaları (git LFS)
│   ├── palette/palette.png       # 256×256 renk atlası
│   └── export/                   # pipeline çıktıları (glb, vat.png, nav.bin) — build artefaktı
├── tools/
│   ├── asset-pipeline/           # gltf-transform scriptleri: optimize, palette check, VAT bake paketleme
│   ├── blender/                  # Blender Python: part-id bake, VAT export, map export
│   └── navbake/                  # map.glb → map.nav.bin (recast, node)
└── tests/
    ├── determinism/              # aynı seed+komut → aynı hash (Node'da 2 kez + tarayıcıda)
    └── e2e/                      # Playwright smoke
```

### 13.3 Çalışma Zamanı Veri Akışı

```
 ┌─────────────── MAIN THREAD ────────────────┐            ┌──────── SIM WORKER ────────┐
 │                                            │            │                            │
 │ Input ─▶ CommandBuilder ─▶ Transport ──────┼── cmds ──▶ │ Lockstep Scheduler          │
 │                             │  (Local |    │            │   ↓ (turn N komutları)     │
 │                             │   Colyseus)  │            │ applyCommands()            │
 │                             ▼              │            │   ↓                        │
 │                     [Colyseus Server]      │            │ systems pipeline (20 Hz)   │
 │                      turn relay + hash     │            │   ↓                        │
 │                                            │            │ writeSnapshot(SAB A/B)     │
 │  rAF (60–144 Hz)                           │ ◀── SAB ── │ stateHash every 10 ticks ──┼─▶ Transport
 │   ├─ read snapshot prev/curr (double buf)  │            └────────────────────────────┘
 │   ├─ interpolate α = t_since_tick / 50ms   │
 │   ├─ UnitRenderer: instance attr yazımı    │
 │   ├─ FX, Fog, Camera, PostProcessing       │
 │   ├─ renderer.render()                     │
 │   └─ (10 Hz) UISnapshot → Solid store      │
 └────────────────────────────────────────────┘
```

* **SharedArrayBuffer** iki tampon (double buffer) + `Atomics` sayaç. SAB için sunucu `Cross-Origin-Opener-Policy: same-origin` ve `Cross-Origin-Embedder-Policy: require-corp` header'larını vermeli (Vite dev server'da da ayarlanır). SAB yoksa fallback: `postMessage` + transferable `ArrayBuffer`.
* **Snapshot formatı (asker başı 16 byte):** `x:f32, z:f32, yaw:u16, unitType:u8, team:u8, animState:u8, flags:u8, animT:u8, hp8:u8` (y yükseklik render tarafında heightmap'ten örneklenir). 3.000 asker = 48 KB/tick.
* **Sim sabit-nokta → render float:** Snapshot yazarken Q16.16 → f32 dönüşümü yapılır; render hiçbir zaman sim state'ine geri yazmaz.

### 13.4 ECS — Bileşenler ve Sistem Sırası

**Ana bileşenler (bitECS SoA, hepsi TypedArray):**

| Bileşen | Alanlar |
|---------|---------|
| `Position` | `x, z: Int32 (Q16.16)` |
| `Velocity` | `x, z: Int32` |
| `Facing` | `angle: Uint16` (0–65535 = 0–2π) |
| `Health` | `hp, max: Int32` |
| `Team` | `id: Uint8, player: Uint8` |
| `UnitDef` | `defId: Uint16` (data tablosuna indeks) |
| `Soldier` | `battalion: eid, slot: Uint8` |
| `Battalion` | `leader: eid, formation: Uint8, count: Uint8, rank: Uint8, xp: Int32, orderType, orderTarget` |
| `Weapon` | `cooldown: Int32, target: eid` |
| `Projectile` | `from, to, impactTick, dmg, dmgType, aoe` |
| `Knockback` | `dirX, dirZ, power, ticksLeft` |
| `Building` | `defId, slotId, buildProgress, queue…` |
| `Hero` | `rank, xp, abilityCooldowns[4]` |
| `FlowFollower` | `fieldId: Uint16` |
| `Anim` | `state: Uint8, startTick: Uint32` (render'a giden) |
| Tag'ler | `Dead`, `Selected` (sadece client), `Flying`, `Stealthed`, `Garrisoned` |

**Tick pipeline (sabit sıra, deterministik):**

```
 1. CommandSystem          — turn komutlarını uygula (playerId, sonra seq sırası)
 2. WaveSpawnSystem        — dalga zamanlayıcı, spawn
 3. EconomySystem          — gelir, üretim kuyrukları, inşa ilerlemesi
 4. FlowFieldSystem        — kirli sektörleri yeniden hesapla (tick başına bütçeli)
 5. BattalionOrderSystem   — tabur hedefleri, lider path takibi, formasyon slotları
 6. TargetingSystem        — spatial hash ile hedef seçimi (her tick değil, birime göre 4 tick'te bir, kademeli)
 7. SteeringSystem         — slot arrive + separation + flow → velocity
 8. KnockbackSystem        — trample tespiti, uçuş yayları
 9. MovementSystem         — integrate, navmesh/sınır clamp, spatial hash güncelle
10. CombatSystem           — yakın dövüş, menzilli atış → Projectile spawn
11. ProjectileSystem       — impactTick'e gelenleri çöz (analitik)
12. DamageSystem           — hasar matrisi, ölüm, bounty, XP, PP
13. AbilitySpellSystem     — kahraman yetenekleri, spell efektleri, buff süreleri
14. StructureSystem        — duvar hasar aşamaları, gedik → navmesh/flowfield kirlet
15. VisionSystem           — fog of war grid (4 tick'te bir)
16. CleanupSystem          — Dead entity'leri (gecikmeli) sil
17. HashSystem / Snapshot  — state hash, render snapshot
```

### 13.5 Render Mimarisi

| Katman | Teknik |
|--------|--------|
| **Birimler** | `unitType × LOD` başına 1 `InstancedMesh` (kapasite önceden ayrılmış, `count` ile kırpılır). Instance attribute'ları: `iPosYaw (vec4)`, `iAnim (vec4: state, t, hitT, team)`. Matris yerine pos+yaw → instance başı 32 byte. TSL vertex shader: `partId` (vertex attr) + anim state → SPA dönüşümü; büyük yaratıklarda VAT fetch. |
| **LOD** | CPU'da kamera mesafesine göre 3 kova; Phase 2'de compute shader ile GPU culling + indirect draw (WebGPU). |
| **Statik harita** | `BatchedMesh` (tüm duvar/kaya/ağaç parçaları tek draw call grubunda, per-object görünürlük). Yıkılabilir duvar segmentleri BatchedMesh içinde geometri ID değiştirilerek aşama aşama yıkılır. |
| **Mermiler** | Tip başına tek `InstancedMesh` (ok, kaya, cıvata); pozisyon render tarafında analitik yaydan hesaplanır (sim sadece başlangıç/bitiş/impactTick gönderir). |
| **Partiküller** | TSL compute ile GPU partikül havuzu (storage buffer), low-poly mesh partiküller instanced. |
| **Materyal** | Tek `ToonMaterial` (TSL): palette atlas + 3 kademeli ramp + rim + fog + team color swap + hit flash. |
| **Gölge** | Tek directional shadow map (2048², harita sınırına sığdırılmış ortho), birimler LOD0/1'de gölge düşürür, LOD2 düşürmez; Phase 2: birimler için ucuz blob shadow seçeneği. |
| **Post** | TSL PostProcessing: seçici Bloom → Outline (seçim) → hafif renk derecelendirme (LUT) → FXAA/SMAA. Düşük kalitede tamamen kapatılabilir. |
| **Fog of War** | 256² `R8` texture, CPU (sim VisionSystem) → GPU upload 5 Hz, shader'da bilinear + zaman yumuşatma. |

### 13.6 Network Mimarisi — Deterministik Lockstep

```
   Client A                 Colyseus MatchRoom                 Client B
      │  cmd(turn=N+2) ──────────▶ │ ◀────────── cmd(turn=N+2)  │
      │                            │  turn N+2 kapandı (tüm     │
      │                            │  oyuncular veya timeout)   │
      │ ◀──── TurnBundle(N+2) ─────┼───── TurnBundle(N+2) ────▶ │
      │  sim tick'leri N+2 için    │                            │
      │  hash(N) ─────────────────▶│ ◀───────────────── hash(N) │  eşleşmezse → desync
```

* **Turn uzunluğu:** 100 ms (= 2 sim tick). **Input delay:** 2 turn (200 ms) varsayılan, RTT'ye göre dinamik (1–4 turn). BFME2 de benzer gecikmeyle çalışıyordu; RTS için kabul edilebilir, emir anında görsel/ses geri bildirimi ile maskelenir.
* **Sunucu rolü:** Turn saati (tek otorite), komut toplama + yayın, hash karşılaştırma, geç kalan oyuncu için boş turn ("no-op") ile ilerleme veya bekletme, reconnect'te **snapshot + komut geçmişi** ile catch-up.
* **Solo:** `LocalTransport` aynı API'yi uygular, gecikme 0, sunucu yok. Böylece solo ve MP aynı kod yolu.
* **Desync:** Hash farkı → her iki istemci son 50 tick'in komut logu + state dump'ını sunucuya yollar (debug build), oyun "resync" (host snapshot'ı yeniden yüklenir).
* **Hile:** Lockstep'te tüm istemciler tam state'e sahiptir (maphack mümkün). Co-op için sorun değil; PvP rekabetçi modda Phase 5'te sunucu-tarafı sim (Node'da aynı `@bulwark/sim` paketi headless çalışır) ile authoritative doğrulama seçeneği.
* **Replay:** Komut logu + seed = tam replay (birkaç KB).

### 13.7 Fixed-Point Matematik Kuralları

| Konu | Kural |
|------|-------|
| Format | Q16.16, `Int32Array` içinde; çarpma `Math.imul` + 64-bit ara sonuç için `(a * b) / 65536` güvenli aralık kontrollü yardımcılar (veya BigInt'siz split-multiply) |
| Trig | 4096 girişlik sin/cos LUT, açılar `Uint16` |
| Karekök | Integer Newton-Raphson; uzaklık karşılaştırmalarında kare uzaklık kullan |
| Rastgele | xoshiro128** (seed maç başında sunucudan), sistem başına ayrı stream |
| İterasyon | Entity'ler artan `eid` sırasıyla; bitECS query sonuçları sıralanır (veya ekleme sırası garantili) |
| Test | CI'da: 10.000 tick'lik senaryo Node + Chromium + Firefox'ta aynı hash'i üretmeli |

### 13.8 Asset Pipeline

```
Blender (.blend)
  ├─ Model: low-poly, palette UV, parça başına "part_*" isimli objeler
  ├─ blender/export_unit.py ─▶ parçaları birleştir, partId'yi vertex attr (_PARTID) olarak yaz,
  │                            pivot'ları (omuz, kalça, boyun) JSON'a yaz
  ├─ blender/bake_vat.py    ─▶ (büyük yaratıklar) animasyon → VAT EXR/PNG + meta
  └─ glTF export
        ▼
tools/asset-pipeline (gltf-transform)
  ├─ dedup, weld, flatten, quantize (pos 14-bit, normal 8-bit)
  ├─ palette doğrulama (UV'ler hücre merkezinde mi)
  ├─ LOD üretimi (meshoptimizer simplify) LOD1/LOD2
  └─ meshopt sıkıştırma ─▶ assets/export/*.glb (+ *.parts.json, *.vat.png)
        ▼
tools/navbake ─▶ map.nav.bin
```

Hedef: piyade glb ≤ 8 KB, tüm Phase 1 asset'leri ≤ 3 MB.

### 13.9 Kalite Ayarları

| Ayar | Low | Medium | High | Ultra |
|------|-----|--------|------|-------|
| Render ölçeği | 0.75 | 1.0 | 1.0 | DPR (max 2) |
| Gölge | Kapalı (blob) | 1024² | 2048² | 4096² |
| Post (bloom/outline) | Kapalı | Outline | +Bloom | +AO (GTAO/N8AO) |
| LOD mesafeleri | ×0.6 | ×1.0 | ×1.3 | ×1.6 |
| Partikül limiti | 5k | 15k | 30k | 50k |
| Max görünür asker (render) | 1.500 | 3.000 | 5.000 | 8.000 |

---

## 14. Performans Bütçeleri

**Hedef donanım (Medium @ 1080p 60 FPS):** GTX 1660 / RX 580 / Apple M1 / Intel Iris Xe (Low'da 60 FPS), 4 çekirdek CPU.

| Bütçe | Hedef |
|-------|-------|
| Aynı anda simüle edilen asker | **3.000** (stres testi hedefi 5.000) |
| Sim tick (worker, 20 Hz) | ≤ 8 ms (bütçe 50 ms; MP hash/catch-up için marj) |
| Main thread frame (render hazırlık + UI) | ≤ 6 ms |
| GPU frame | ≤ 10 ms |
| Draw call | ≤ 150 (harita BatchedMesh ~10–20, birim tipi×LOD ~60, FX ~20, UI/post ~10) |
| Görünür üçgen | ≤ 1.5 M |
| Bellek (JS heap) | ≤ 300 MB; oyun içi frame başına **sıfır** allocation (object pool, TypedArray) |
| Ağ | ≤ 4 KB/s/oyuncu (lockstep) |
| İlk yükleme | ≤ 15 MB (Phase 1: ≤ 5 MB) |

Profil araçları: `stats-gl` (GPU timer query), Chrome Performance, sim içi sistem başına `performance.now()` histogramları (debug build), headless `vitest bench` ile sim benchmark.

---

## 15. Riskler ve Açık Sorular

| Risk | Etki | Olasılık | Azaltma |
|------|------|----------|---------|
| **Determinizm kırılması** (float sızıntısı, WASM navmesh farkı) | Yüksek | Orta | Sim'de float yasağı + lint; navmesh sadece **sorgu** (path üretimi komut anında yapılıp sonuç fixed-point'e çevrilir) ve aynı WASM binary; CI cross-browser hash testi. |
| WebGPU tarayıcı desteği/hataları | Orta | Orta | three'nin WebGL2 backend fallback'i; tüm materyaller TSL (iki backend'de çalışır); Phase 1'de iki backend'de de smoke test. |
| SharedArrayBuffer için COOP/COEP header zorunluluğu (bazı hosting'ler) | Orta | Düşük | `postMessage` transferable fallback; hosting: Cloudflare Pages / Netlify header config. |
| 3.000 askerde boids/targeting CPU maliyeti | Yüksek | Orta | Spatial hash, kademeli (staggered) hedefleme, tabur-seviyesi kaba hedefleme + asker-seviyesi ince eşleme; gerekirse sim'i Rust→WASM'a taşıma opsiyonu (Phase 4+). |
| **IP / Telif** (Tolkien Estate, Middle-earth Enterprises, EA) | Yüksek (ticari) | Yüksek (ticari ise) | Non-commercial hayran projesi olarak konumlanma **veya** isim/terim katmanını (`data/` lokalizasyon) "orijinal fantazi" temaya çevirebilecek şekilde soyutlama; orijinal ses/müzik/logo **kullanılmaz**. |
| Kapsam şişmesi (5 faction, 6 harita, PvP) | Yüksek | Yüksek | Sıkı faz kapsamı (§16): MVP = 1 harita, 1 good faction (Gondor), 1 düşman (Isengard). |
| Low-poly ama "BFME2'ye sadık" siluet üretimi için 3D sanat kapasitesi | Orta | Yüksek | Prosedürel "kit-bash" sistem: ortak gövde + değiştirilebilir miğfer/silah/kalkan parçaları → 1 rig'siz baz ile 20+ birim varyantı. Phase 1'de programatik (kodla üretilen) placeholder geometri. |

**Açık sorular (onayınız gerekli):**

1. **İlk faction çifti:** MVP için *Gondor vs Isengard* öneriyorum (Helm's Deep'e en uygun — teknik olarak Helm's Deep'te Rohan savunur; Rohan + Gondor'u "Men of the West" olarak tek faction'da birleştirdik). Onay?
2. **MVP haritası:** Helm's Deep (FD) mi, yoksa daha basit bir Osgiliath (TD) mi? Öneri: **Helm's Deep'in sadeleştirilmiş versiyonu** (Deeping Wall + 1 kapı + culvert yok).
3. **UI framework:** Solid.js öneriyorum. React deneyiminiz/tercihiniz varsa React 19 + signals de kabul edilebilir (overhead'i biraz daha yüksek).
4. **Ticari hedef var mı?** Varsa IP soyutlama katmanını baştan tasarlarız.

---

## 16. Yol Haritası — Phase 1 (MVP) ve Sonrası

### 16.1 Faz Özeti

| Faz | Süre (tahmini, 1 geliştirici) | Kapsam |
|-----|------|--------|
| **Phase 1 — Vertical Slice Çekirdeği** | 3–4 hafta | Proje iskeleti, render + RTS kamera + toon shader, sadeleştirilmiş Helm's Deep, prosedürel tabur hareketi (1.000+ asker), temel savaş, determinizm temeli |
| Phase 2 — Oynanabilir FD Döngüsü | 4–6 hafta | Ekonomi, slotlar/binalar, kuleler, duvar soketleri, kapı, dalgalar, kuşatma araçları (Ram, Ladder), VAT (Troll), Palantír UI v1, ses v1 |
| Phase 3 — BFME2 Derinliği | 4–6 hafta | Kahramanlar (Aragorn, Gandalf, Lurtz, Saruman), Spellbook Tier 1–4, rank/XP, yükseltmeler, formasyonlar, trample, fog of war |
| Phase 4 — Co-op Multiplayer | 3–4 hafta | Colyseus lobi + MatchRoom, lockstep transport, desync tespiti, reconnect, replay |
| Phase 5 — İçerik & PvP | sürekli | Elves, Dwarves, Mordor; Minas Tirith, Osgiliath, Isengard, Black Gate; PvP modları |

### 16.2 Phase 1 — Adım Adım Plan

Her adım bağımsız olarak çalıştırılabilir/doğrulanabilir bir çıktı üretir.

**Adım 1 — Proje İskeleti (Gün 1–2)**
- pnpm monorepo: `packages/{shared,sim,client,server}`, `tools/`, `tests/`.
- Vite 8 + TypeScript (strict) + Biome + Vitest; COOP/COEP header'ları dev server'da.
- Lint kuralı: `packages/sim` ve `packages/shared` içinde `three` import'u ve `Math.random` yasak.
- ✅ Çıktı: `pnpm dev` boş sahne açar, `pnpm test` geçer.

**Adım 2 — Renderer + RTS Kamera (Gün 3–4)**
- `WebGPURenderer` (WebGL2 fallback, `?webgl` query param ile zorlanabilir), resize/DPR yönetimi, `stats-gl` + `lil-gui`.
- `RTSCamera`: sabit pitch (~55°), zoom eğrisi (yakında pitch hafif azalır), WASD/edge-pan/orta tuş sürükleme, Q/E döndürme, harita sınırı clamp, yumuşatma (critically-damped spring).
- ✅ Çıktı: Düz zemin üzerinde akıcı BFME2 hissiyatlı kamera.

**Adım 3 — Low-Poly Işık & Toon Shader (Gün 5–6)**
- `palette.png` (ilk 64 renk: Gondor, Isengard, taş, toprak, çimen).
- TSL `ToonMaterial`: flat normal, 3-kademe ramp, rim light, hemisphere ambient, mesafe sisi, team color satır kaydırma.
- Directional ışık + ortho shadow map, renk derecelendirme, (opsiyonel) seçici bloom.
- ✅ Çıktı: Işık/gölge tweak paneli olan "look-dev" sahnesi; low-poly test objeleri.

**Adım 4 — Sadeleştirilmiş Helm's Deep (Gün 7–9)**
- Placeholder harita **kodla üretilir** (prosedürel): heightmap arazi (flat-shaded, vertex color gradient), Deeping Wall segmentleri, Hornburg kapısı + kule, rampa, kayalar, birkaç low-poly ağaç → tümü **BatchedMesh**.
- `map.json` şeması: Citadel, slotlar, spawn noktaları, lane'ler.
- three-mesh-bvh ile zemin picking.
- ✅ Çıktı: Kamera ile gezilebilen, tanınabilir Helm's Deep dioraması.

**Adım 5 — Deterministik Sim Çekirdeği (Gün 10–12)**
- `shared/math/fixed.ts` (Q16.16, LUT trig, isqrt) + `rng/xoshiro.ts` + birim testleri.
- bitECS world, bileşenler (Position, Velocity, Facing, Team, UnitDef, Soldier, Battalion, Health), sabit 20 Hz tick döngüsü.
- Sim Web Worker'da; SAB double-buffer snapshot; `LocalTransport` + Command protokolü (move, attack, stop).
- Determinizm testi: aynı seed + komut listesi → 2 çalıştırmada aynı CRC32.
- ✅ Çıktı: Headless 1.000 entity sim'i, vitest + determinizm testi yeşil.

**Adım 6 — Low-Poly Birimler + SPA Animasyon (Gün 13–15)**
- Kodla üretilen (procedural) low-poly askerler: *Gondor Soldier* (yuvarlak kask, damla kalkan, kılıç), *Tower Guard* (kanatlı yüksek miğfer, uzun mızrak), *Uruk-hai* (Beyaz El kalkanı, sivri miğfer), *Orc* (kambur, eğri pala) — parça başına `partId` attribute'u.
- `UnitRenderer`: tip başına `InstancedMesh`, instance attr (`iPosYaw`, `iAnim`), snapshot interpolasyonu.
- TSL `UnitMaterial` SPA: idle nefes, yürüme (bacak/kol salınımı + gövde bob), saldırı (kol savurma / mızrak itme), ölüm (devrilme + batma), hit flash.
- ✅ Çıktı: 2.000 animasyonlu asker, ≤ 20 draw call, 60 FPS (Medium hedef donanım).

**Adım 7 — Tabur Hareketi: Flow Field + Formasyon + Boids (Gün 16–19)**
- Grid (1 m hücre) maliyet alanı haritadan üretilir; sektörlü flow field (Dijkstra, integer).
- Spatial hash; `BattalionOrderSystem` (lider path + Line/Wedge slot offset'leri, koridor genişliğine göre formasyon daralma), `SteeringSystem` (arrive + separation + flow), `MovementSystem`.
- Oyuncu: seçim (kutu/tık), sağ tık hareket, sancak gösterimi, hareket hedef işareti.
- Düşman: spawn noktasından Hornburg kapısına flow field ile akan Uruk/Orc taburları.
- ✅ Çıktı: 40+ tabur (~1.000 asker) dar rampada sıkışmadan, birbirinin içinden geçmeden akar.

**Adım 8 — Temel Savaş (Gün 20–23)**
- `TargetingSystem` (staggered), `CombatSystem` (yakın dövüş eşleme), okçular için analitik `Projectile` + instanced ok renderer, `DamageSystem` (hasar matrisi §6.2), ölüm ve cleanup.
- Basit Citadel/Kapı HP'si: düşman kapıya ulaşırsa hasar verir; kapı düşerse "Defeat" ekranı.
- Basit HUD (Solid.js): seçili tabur bilgisi, asker sayısı, FPS/entity sayacı.
- ✅ Çıktı: **Oynanabilir mini kuşatma:** oyuncu 4–6 Gondor taburu ile Deeping Wall önünde 3 Isengard dalgasını püskürtür.

**Adım 9 — Performans Doğrulama & Stres Testi (Gün 24–25)**
- Stres sahnesi: 3.000 / 5.000 asker; sim tick, main-thread, GPU süreleri raporlanır.
- WebGPU vs WebGL2 karşılaştırması; darboğaz analizi ve Phase 2 için optimizasyon listesi.
- ✅ Çıktı: `docs/perf-phase1.md` benchmark raporu.

### 16.3 Phase 1 Kabul Kriterleri (Definition of Done)

- [ ] `pnpm dev` ile tarayıcıda açılır; WebGPU ve WebGL2 backend'lerinde çalışır.
- [ ] RTS kamera BFME2 hissiyatında (pan/zoom/rotate/sınır).
- [ ] Low-poly toon görünüm; Gondor ve Isengard birimleri siluetten ayırt edilebilir.
- [ ] Sadeleştirilmiş Helm's Deep, tüm statik geometri BatchedMesh.
- [ ] ≥ 1.000 asker formasyonlu hareket + savaş, Medium donanımda 60 FPS; 3.000 askerde ≥ 45 FPS.
- [ ] Hiçbir birim/mermi tekil `Mesh` değil (InstancedMesh/BatchedMesh).
- [ ] Sim, worker'da, fixed-point; determinizm testi CI'da yeşil.
- [ ] 3 dalgalık oynanabilir savunma + zafer/yenilgi.

---

*Sonraki adım: Bu doküman onaylandığında Phase 1 / Adım 1 (Proje İskeleti) ile kodlamaya başlanacaktır. §15'teki açık sorulara verilecek yanıtlar Phase 1 kapsamını netleştirecektir.*
