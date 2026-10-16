# Yeminli Mızrak — Oyun Tasarım Dokümanı

Telefonda oynanan, sekerek hareket eden bir mızrakçıyla oynanan roguelike arena oyunu.
Ana hareket mekaniği League of Legends'taki Kalista'nın **Martial Poise** pasifinden esinlenmiştir.

Oynamak için: `game/index.html` dosyasını tarayıcıda aç (tek dosya, kurulum gerekmez).

## 1. Esin kaynağı: Kalista'nın sekmesi (Martial Poise)

Araştırmada doğrulanan kurallar:

| Kalista (LoL) | Yeminli Mızrak'taki karşılığı |
|---|---|
| Saldırı hazırlanırken (windup) ya da hemen sonrasında verilen hareket komutu, o yöne kısa bir atılma yaptırır. | Mızrak hazırlanırken ya da çıktıktan sonraki 0.13 sn içinde yön tutarsan o yöne **sekersin**. |
| Saldırılar iptal edilemez. | Hazırlık sırasında yürüyemezsin; yön girdisi sadece sekmeyi tamponlar. |
| Sekme mesafesi açıya bağlıdır: hedefe doğru en kısa, yana daha uzun; geriye ~%25 daha uzun. | Hedefe doğru ×0.6, yana ×1.0, geriye ×1.25 mesafe. |
| Pierce (Q) atışı sırasında da sekebilir. | Delici Mızrak'tan sonra da sekebilirsin. |
| Rend (E): saplı mızrakları söker, mızrak başına hasar artar, öldürürse bekleme yenilenir. | **Söküm**: aynı mantık; öldürürse bekleme 0.5 sn'ye düşer. |
| Pierce öldürdüğü hedefin içinden geçer, mızraklarını sonrakine aktarır. | Aynısı. |
| Fate's Call (R): yeminli müttefiki çeker, sonra hedef bölgeye fırlatır; indiği yerde düşmanları havaya kaldırır. | **Kader Çağrısı**: ruhun seni 0.4 sn kaldırır (hasarsız), sonra tuttuğun yöne ya da en yakın düşmana fırlatır. İnişte sersemletme, itme, 2 mızrak saplama. Bekleme 20 sn. |

Sonuç olarak ritim şu: **saldır → sek → saldır → sek**. Yürümek yavaş (140 birim/sn), sekme ise 0.15 sn'de ~160 birim. Ustalık, sekmeyi doğru yöne zamanlamakta.

## 2. Kontroller

- **Telefon:** Ekranda herhangi bir yerde parmağını sürükle → sanal joystick (yön). Sağ altta **SÖK (E)**, **DEL (Q)** ve **KADER (R)** düğmeleri.
- **Klavye:** WASD/oklar yön, `E` veya boşluk Söküm, `Q` Delici Mızrak, `R` Kader Çağrısı, `Esc`/`P` duraklat.
- Saldırı otomatik: menzildeki en yakın düşmana atar. Bu, telefonda tek başparmakla kite yapmayı mümkün kılıyor.

## 3. Mızrakçılar

"Ava başla" sonrası karakter seçilir (son seçim hatırlanır). Her birinin pelerin rengi farklıdır.

| Mızrakçı | Artı | Eksi |
|---|---|---|
| Yeminli | Dengeli | — |
| Gölge Koşucu | Sekme +%35, sekerken hasar almaz | Mızrak hasarı -%15, can -20 |
| Kemik Kıran | Mızrak hasarı +%30, %25 şansla çift saplanma | Saldırı hızı -%15, sekme -%10 |
| Ruh Çağıran | 1 Yeminli Ruh ile başlar, Kader bekleme -%30 | Mızrak hasarı -%10 |

### Mızrakçıya özel efsanevi kartlar

| Kart | Mızrakçı | Ön koşul | Etki |
|---|---|---|---|
| Sadakat | Yeminli | Yırtıcı veya Acımasız | Söküm hasarı +%20; Söküm öldürmesi başına Kader bekleme -3 sn |
| Gölge Dansı | Gölge Koşucu | Uzun Sekme veya Hızlı El | Her sekmeden sonra 0.8 sn saldırı hızı +%45 |
| Kemik Patlaması | Kemik Kıran | Ağır Mızrak veya Keskin Uç | 5+ mızraklı düşman ölünce çevresine 6 mızrak saçar |
| Ruh Korosu | Ruh Çağıran | Yeminli Ruh veya Kader Yemini | Ruhlar iki mızrak atar, ruh mızrakları %80 hasar |

### Günün Avı

Her gün için tarihten üretilen sabit bir tohum: herkes aynı mızrakçıyla, aynı günlük kuralla, aynı oda dizilimi, düşman yerleri, elitler, kart teklifleri ve kapı seçenekleriyle oynar. Günün en iyi odası ve son 10 av ana ekranda tutulur.

| Günlük kural | Etki |
|---|---|
| Kanlı Ay | Düşmanlar %25 hızlı, ruh parçası ×2 |
| Cam Kalp | Azami can yarıya iner, Söküm hasarı +%60 |
| Elit Gecesi | +%30 elit oranı, elitler ×2 parça |
| Kehanet Armağanı | 2 rastgele destansı güçle başla, yeniden çekme yok |

## 4. Çekirdek döngü

1. Odaya gir → 2–4 dalga düşman (dalga, kalan düşman ≤2 olunca ya da 16 sn sonra gelir).
2. Oda temizlenince %15 can yenilenir, 3 güç kartından birini seçersin (yeniden çekme hakkı Ruh Sunağı'ndan).
3. Sonra sıradaki **kapıyı** seçersin (her zaman Savaş + rastgele 2 seçenek):

   | Kapı | Risk | Ödül |
   |---|---|---|
   | Savaş Odası | Düşük | 1 güç |
   | Elit Oda | Orta: düşmanların %35'i elit | Nadir ağırlıklı güçler, +5 ruh parçası |
   | Lanetli Oda | Yüksek: %60 elit, düşmanlar %15 hızlı | 2 güç seçimi, +8 ruh parçası |
   | Ruh Pınarı | Savaş yok | %40 can, +1 yeniden çekme; güç yok |
   | Ruh Sandığı | Düşük: az düşman ve ortada bir sandık | Sandığı kır: 12 parça ve yalnızca nadir+ güç teklifleri. %30 ihtimalle sandık **Mimik** çıkar: zıplayarak üstüne atlayan (kırmızı daireyle uyarır) güçlü bir canavar; yenince 20 parça |
   | Kan Sunağı | Bedeli can | Kan Bağışı: canının %30'u → 1 nadir+ güç. Ruh Bağışı: azami can kalıcı -20 → 2 nadir+ güç. İstersen geçebilirsin |
   | Ruh Tüccarı | Savaş yok | Bu avın ruh parçalarıyla alışveriş: 3 güç (Sıradan 15, Nadir 25, Destansı 40, Efsanevi 55), Ruh İksiri (%50 can, 12), Kehanet Kartı (+1 yeniden çekme, 10). Unutuş Ritüeli (15): bir gücün bir seviyesini siler; tüm istatistikler baştan hesaplanır. Harcanan parçalar kalıcı birikime eklenmez. |

4. Her 5. oda **Muhafız** odası; muhafızlar sırayla Kemik Lordu, Gölge Atlı, Yas Kraliçesi ve Kan Kardinali.
5. Ölünce topladığın **ruh parçaları** kalıcı olarak saklanır; Ruh Sunağı'ndan kalıcı güç alırsın.
6. Oyun sonsuz; amaç en iyi oda rekorunu kırmak.

## 5. Düşmanlar

| Düşman | Davranış | Karşı strateji |
|---|---|---|
| Hortlak | Doğrudan kovalar | Geriye sekerek kite |
| Ateş Ruhu | Hızlı, zikzak, üçlü sürü | Çatallı/delici mızrak, İniş Şoku |
| Okçu | 320 birim mesafe korur, nişan alıp atış yapar (sarı kenar = nişan) | Yana sekerek mermiden kaç |
| Dev | Yavaş; kırmızı çizgiyle işaret verip hücum eder | Çizginin dışına sek |
| Tükürgen | Durur, çevresine halka halinde mermi saçar (çekirdek dolunca) | Halkalar arasındaki boşluğa sek |
| **Kemik Lordu** (5., 20. oda) | Hücum, mermi novası, çağırma; %50 canın altında öfke (çift hücum, yoğun nova) | Mızrak biriktir, Söküm ile büyük hasar |
| **Yas Kraliçesi** (15., 30. oda) | Süzülen hayalet kraliçe. Çığlık dalgası (genişleyen mor halka: yerdeyken vurur, **üstünden sekerek atlanır**), oyuncuyu takip eden ruh mermileri, mor halkayla işaretlenen ışınlanma, ateş ruhu çağırma; %50 altında 3'lü çığlık | Dalga yaklaşınca sek, Kader Çağrısı ile havada kal |
| **Yükselmiş muhafızlar** (20. oda ve sonrası) | Can +%20, altın aura; saldırılarının %40'ında diğer muhafızlardan ödünç bir saldırı kullanır: Lord → çığlık dalgası / mızrak hatları, Atlı → çığlık / ruh mermileri, Kraliçe → mızrak hatları / mermi halkası | Altın parlama = ödünç saldırı geliyor |
| **Gölge Atlı** (10., 25. oda) | Arka arkaya 3–4 dörtnala hücum ve arkasında yakan mor iz; çift kollu spiral mermi; yelpaze şeklinde mızrak hatları (önce çizgiyle uyarır) | Hatların arasına sek, Kader Çağrısı ile sersemlet |

| **Buz Hortlağı** (Buz Mezarlığı, 10–19) | Hortlak gibi kovalar; dokununca ve 3'lü buz nefesiyle seni 1.6 sn **yavaşlatır** (yürüme %60, sekme mesafesi %80) | Yakın mesafeye girmeden mızrakla; yavaşlamışken Kader Çağrısı ile kaç |
| **Kan Yarasası** (Kan Katedrali, 20+, üçlü gelir) | Etrafında daire çizip uçar, kısa uyarıyla dalış yapar; vurursa hasarın 3 katı **can emer** | Dalış anında yana sek; Söküm ile toplu temizle |
| **Kan Kardinali** (20. oda, sonra her 20 odada) | Mitralı kızıl rahip, sallanan buhurdan. Etrafında dönerek açılan kan bıçakları; ayağının altında uyarılı kan fışkırmaları (4, öfkede 6); haç biçimli mermi yağmuru (iki dalga, 45° dönük); kan yarasası çağırma | Bıçak halkası açılırken dışarı sek, kırmızı dairelerden çık |
| **Kalkanlı Şövalye** (7. oda+) | Kalkanını yavaşça oyuncuya çevirir; önden gelen mızrakları engeller (BLOK). Yakındayken kısa kalkan hamlesi yapar (kırmızı şeritle uyarır) | Sekerek yanına/arkasına geç; Delici Mızrak kalkanı deler; Kader ile sersemletilmişken engelleyemez |
| **Kemik Bombası** (6. oda+, ikili gelir) | Hızla koşar, yaklaşınca fitili yanar (turuncu daire dolar), 0.8 sn sonra 95 birim alanda patlar | Fitil bitmeden öldür: erken patlama sadece düşmanlara hasar verir; ya da dairenin dışına sek |

**İkinci form (10. oda ve sonrası):** Muhafızın canı ilk bittiğinde ölmek yerine 1.4 sn hasar almayan bir dirilişe girer (mor duman, ekran parlaması, "İkinci form" yazısı), canının yarısıyla "Öfke" adıyla döner: %20 hızlı, %10 daha sert, Yükselmiş muhafızlar gibi diğer muhafızların saldırılarını da kullanır.

**Elit düşmanlar** (altın kesikli halka): can ×1.8, hasar ×1.2 ve bir özellik: *Kalkanlı* (canın %40'ı kadar mavi kalkan), *Hızlı* (+%35 hız), *Patlayan* (ölünce 8 mermi saçar). Elit başına 3 ruh parçası.

Zorluk: oda başına düşman canı +%20, hasar +%8, hız +%1.5. Altın halka = düşman sökümle ölür (Kalista'daki öldürme göstergesi gibi).

## 6. Güçler (26 adet, 3 nadirlik)

- **Mızrak:** Keskin Uç, Hızlı El, Uzak Hedef, Ölümcül Göz, Çatallı Mızrak, Delip Geçen, Ağır Mızrak, Buz Uç, Mızrak Fırtınası
- **Sekme:** Uzun Sekme, Hayalet Adım (sekmede hasarsızlık), Ruh İzi (yakan iz), İniş Şoku, Ritim (art arda sekme hasar çarpanı), Gölge Mızrak (sekmede bedava mızrak), Hafif Ayak
- **Söküm:** Yırtıcı, Acımasız, İnfaz, Bulaşıcı Yemin (ölenin mızrakları yayılır), Ruh Hasadı
- **Delici / Kader:** Delici Yemin, Kader Yemini
- **Ruh:** Sağlam Ruh, Yenilenme, Kan Yemini, Yeminli Ruh (dönen müttefik ruh — Kalista'nın Oathsworn'una gönderme)

- **Efsanevi sinerjiler** (iki ön koşul güç alınınca havuza girer):
  - Hayalet Ordusu = Hayalet Adım + Gölge Mızrak → +2 gölge mızrak, inişte 0.4 sn hasarsızlık
  - Kemik Kıran = Ağır Mızrak + Yırtıcı → Söküm'de ek mızrak başına %95 hasar
  - Ruh Yangını = Ruh İzi + İniş Şoku → iz hasarı ×2, şok yarıçapı +40
  - Lejyon = 2+ Yeminli Ruh + Hızlı El → ruhlar iki kat sık atar
  - Kadere Bağlı = Kader Yemini + Acımasız → Kader Çağrısı inişi bedava Söküm

Nadirlik ağırlıkları: Sıradan 10, Nadir 5, Destansı 2, Efsanevi 6 (yalnızca ön koşullar tamamsa). Elit/Lanetli/Muhafız ödüllerinde sıradan kartların ağırlığı 2'ye düşer.

Örnek build'ler:
- **Sekme ustası:** Hayalet Adım + Gölge Mızrak + Ruh İzi + İniş Şoku + Hızlı El → her saldırı bir hasar patlaması.
- **Söküm infazcısı:** Ağır Mızrak + Çatallı Mızrak + Yırtıcı + İnfaz + Bulaşıcı Yemin → zincirleme Söküm sıfırlamaları.
- **Ruh ordusu:** Yeminli Ruh ×3 + Hızlı El + Kan Yemini.

## 7. Başarımlar, pelerinler ve mızrak izleri

Mızrak izleri başarım sayısıyla açılır: Ruh (0), Alev (2, turuncu kurdele + kıvılcım + turuncu duman), Buz (4, beyaz kıvılcım), Kan (6, koyu kızıl duman), Gölge (8, mor duman), Yıldız (11, iz boyunca renk değiştiren yıldızlar). Seçim Ruh Dolabı ekranından yapılır.

Her düşman türünün kendi ölüm sesi vardır: Hortlak hırlar, Ateş Ruhu söner, Okçu'nun kemikleri takırdar, Dev gümler, Tükürgen patlar, Şövalye çınlar, Buz Hortlağı kırılır, Yarasa çığlık atar, Mimik ısırıp altın saçar.

## 8. Başarım listesi

12 başarım, her biri bir pelerin rengi açar (Başarımlar ekranından giyilir, tüm mızrakçılarda geçerli; açılınca üstte bildirim çıkar):
Kemik Yıkan (Kemik Lordu), Atlıyı Düşüren, Yası Bitiren, Durdurulamaz (50 seri), Toplu Söküm (tek Sökümle 5 öldürme), Rüzgâr Adım (bir avda 500 sekme), Derinlere (20. oda), Sandık Avcısı (Mimik), Dokunulmaz (5. odadan sonra hasarsız oda), Günün Avcısı (Günün Avı'nda 10. oda), Kurban (Ruh Bağışı), Dört Yemin (dört mızrakçıyla Kemik Lordu).

## 9. Kalıcı ilerleme (Ruh Sunağı)

| Güç | Etki | Seviye |
|---|---|---|
| Ruh Kalkanı | +12 başlangıç canı | 5 |
| Kadim Uç | +%6 mızrak hasarı | 5 |
| Ruh Adımı | +%6 sekme mesafesi | 3 |
| Kehanet | +1 yeniden çekme | 3 |

Kayıt tarayıcının yerel depolamasında tutulur.

## 10. Denge ölçümü

`tools/balance-sim.js` oyunu tarayıcıda kendi kendine oynatır: bot tehditlerden kaçar, mermilere dik kaçar, duvardan uzak durur, uygun anda Söküm / Delici / Kader kullanır, her zaman ilk kartı ve Savaş kapısını seçer. Her mızrakçıyla N av yapıp ulaşılan odayı, oda başına süreyi ve alınan hasarı raporlar.

İlk ölçümde bot 1–4. odalarda neredeyse hiç hasar almıyor, 16 avın 12'sinde 5. odadaki Kemik Lordu'nda ölüyordu (temas başına ~29 hasar, 55 sn'ye varan dövüş). Yapılan ayarlar:

- Muhafız tabanı: can 1250 → 1050, hız 88 → 74, temas hasarı 22 → 15
- Oda bütçesi: `4 + 1.4·oda` → `4.5 + 1.5·oda` (ilk odalar biraz daha dolu)
- Düşman canı artışı oda başına %20 → %17
- Kemik Kıran cezaları: saldırı hızı -%15 → -%10, sekme -%10 → -%5

Sonuç (24 bot avı): ilk muhafız ~%55–65 geçiliyor, ölümler 4. ile 14. oda arasına yayılıyor. Bot kart seçmediği için geç odalar uzun sürüyor; gerçek oyuncuda daha kısa olması beklenir.

### İkinci ölçüm (akıllı kart seçen bot, yeni düşmanlarla)

Bot artık kartları öncelik sırasıyla seçiyor (efsanevi > destansı > hasar, saldırı hızı, çatallı mızrak, Söküm...). Yeni düşmanlar 4. odadan başlayınca ilk muhafızı geçme oranı ~%48'e düştü; ayarlar:

- Kemik Bombası 6. odadan, Kalkanlı Şövalye 7. odadan başlıyor; bomba hasarı 18 → 14
- Dördüncü dalga 8. oda yerine 11. odadan itibaren

Sonuç (32 bot avı): medyan ölüm odası 6–7, ilk muhafız ~%62 geçiliyor, 6–9. odalar 60–100 sn sürüyor.

### Üçüncü ölçüm (15+ oda, Ruh Sunağı tam yükseltilmiş bot)

Bot artık canı %50'nin altındaysa Ruh Pınarı'nı, değilse Savaş kapısını seçiyor; `node tools/balance-sim.js 5 meta` ile Ruh Sunağı yükseltmeleri tam açık oynuyor.

İlk ölçümde 10. odaya ulaşan 16 avın 15'i ikinci formlu Gölge Atlı'da bitiyordu. Ayarlar:

- Muhafız canının kademe artışı %90 → %60; ikinci form canın %50'si yerine %35'iyle döner
- Gölge Atlı: hücum sayısı 3/4 → 2/3, hücum hızı 900 → 820, nişan süresi biraz daha uzun
- Düşman canı: 10. odaya kadar oda başına %17, sonra %10, 20. odadan sonra ek %12
- Dördüncü dalga 14. odadan itibaren

Sonuç: yükseltmesiz bot medyan 7–8. oda; yükseltmeli bot medyan 10–11. oda, 10. odadaki ikinci muhafız yaklaşık %40 geçiliyor, 11–21. odalar 55–100 sn sürüyor.

## 11. Görsel yol haritası: üst düzeye çıkış

Mevcut durum: Canvas 2D, her kare vektör çizim + yarı çözünürlüklü ışık haritası + toplamalı parıltılar. Bu yaklaşım sınırına yaklaştı; bundan sonraki büyük sıçrama GPU tarafında.

**Aşama 1 — Canvas içinde hızlı kazanımlar (1 oturum)**
- Pelerin ve alev saç için Verlet ip fiziği (gerçek dalgalanma, rüzgâr, sekmede savrulma).
- Perlin gürültülü "travma" sarsıntısı + büyük vuruşlarda hafif kamera dönmesi; muhafız girişinde kameranın muhafıza kayıp yakınlaşması.
- Müziğe senkron atım: davul vuruşunda rün çemberi ve mangalların parlaması.
- Muhafız giriş ekranı: siyah şeritler + büyük yazı + muhafız silüeti.
- Kart seçiminde 3B çevirme animasyonu ve seçilen kartın parçacıklara dağılması.

**Aşama 2 — Hibrit WebGL son işleme (1–2 oturum, en yüksek getiri)**
Mevcut 2D tuval her kare bir WebGL dokusuna aktarılır ve tek bir shader zinciri uygulanır; oyun ve çizim kodu değişmez.
- Gerçek bloom (parlak geçiş + çok kademeli Gauss bulanıklığı).
- Şok dalgası kırılması: patlama, Kader inişi ve Söküm halkalarında ekranın dalgalanması.
- Renk sapması (chromatic aberration) vuruşlarda, ısı dalgalanması mangallarda.
- Biyom başına renk derecelendirme (LUT) ve ACES ton eşleme.
- Ay ve mangallardan ekran uzayı ışık hüzmeleri (god rays).
- Düşük kalite modunda tamamen kapatılabilir.

**Aşama 3 — Tam GPU oluşturma (2–3 oturum)**
- Karakterler yükleme anında yüksek çözünürlüklü sprite atlaslarına çizilir (çok kareli yürüme, saldırı hazırlığı, ölüm animasyonları).
- Normal haritalı 2D ışıklandırma: mangallar ve mızraklar karakterlere yönlü ışık ve yumuşak gölge düşürür.
- GPU örnekleme ile binlerce parçacık: yoğun duman, kıvılcım, kar.
- Akış dokulu kurdele izleri, flipbook patlamalar, gürültü dokulu hacimsel sis.

**Durum (Aşama 3 yolu seçildi):**
- [x] Adım 1: WebGL altyapısı ve son işlem. 2D tuval her kare dokuya aktarılır; parlak geçiş + yarım ve çeyrek çözünürlükte ayrılabilir Gauss bulanıklığı (bloom), 8 eşzamanlı şok dalgası kırılması (yıldız patlamaları, Kader inişi, Söküm, dev parlamalar), hasar ve darbe karelerinde renk ayrışması, biyom başına doygunluk/kontrast/renk tonu ve yumuşak film eğrisi. WebGL yoksa, bağlam kaybolursa ya da düşük kalitede eski çizim gösterilir; otomatik kalite yavaşlıkta önce bu katmanı kapatır ("orta"), sonra düşük kaliteye iner.
- [x] Adım 2: diyar GPU'da çizilir. Bulutsu paralaksla, biyom tonu ve üç katman titreşen prosedürel yıldız tek gölgelendiricide; ay, yüzen adalar, kaya parçaları ve uçurum doku olarak. Zemin, ekranda görünen en güçlü 32 renkli nokta ışıkla (mangallar biyom ateşi rengi, mumlar, mızraklar iz rengi, düşman mermileri türüne göre, oyuncu, patlamalar) piksel başına aydınlatılır; normal haritası zemin dokusunun parlaklık eğiminden çıkarılır, biyom başına ortam rengi, yayınık kazanç ve speküler parlaklık (buzda daha parlak) vardır. Taneli film dokusu ve darbe karesindeki renk tersine çevirme de gölgelendiriciye taşındı. 2D tuval artık yalnızca ön planı (karakterler, efektler, yazılar) taşır ve sahnenin üstüne bindirilir; ışık haritası sadece tuvalde çizili olanları karartır. Işık sayısı cihazın uniform sınırına göre ayarlanır. GPU yoksa ya da otomatik kalite "orta"ya inerse eski 2D çizim aynen kullanılır.
- [x] Adım 3: sıradan düşmanlar (gulyabani, buz gulyabanisi, dev, şövalye, okçu, tükürgen, yarasa, bomba, sandık) ilk göründükleri anda ekran çözünürlüğünde animasyon karelerine pişirilir (türüne göre 16–36 kare; durum çeşitleri: devin hücum hazırlığı, tükürgenin dört dolum seviyesi, yarasanın dalış ve nişan hali). Her kare bir kez koyu kontur, sol üstten soğuk anahtar ışık kenarı ve ayaklara doğru form gölgesiyle bitirilir; vuruş parlaması karenin beyaz silüetidir. Oyunda her düşmanın en güçlü yakın ışığa (oyuncunun ruh ışığı, mangallar, mızraklar, patlamalar) bakan kenarı o ışığın renginde parlar. Döngülerin dikişsiz olması için ikincil hareketler ana döngünün harmoniklerine ayarlandı. Oyuncuya nişan alan parçalar (okçunun yayı, şövalyenin kalkanı) ve hareketli kısımlar (alev ruhu, açılan taklitçi sandık, fitili yanan bomba, muhafızlar) prosedürel kalır. Parıltı, ışık ve duman çağrıları sahte bir bağlam üzerinden aynen sürer. Kare başına pişirme bütçesi 6, önbellek sınırı yaklaşık 7 milyon piksel; masaüstü testinde düşman çizimi yaklaşık 4–5 kat hızlandı.
- [ ] Adım 4: parçacık ve duman sisteminin GPU'ya taşınması.

**Önerilen sıra:** Aşama 2 (en çok "vay" etkisi, en az risk) → Aşama 1'in kamera ve fizik maddeleri → Aşama 3. Her aşamada grafik kalitesi ayarına bağlı kademeler ve telefonda 60 fps hedefi korunur.

## 12. Sıradaki adımlar (yol haritası)

Tamamlananlar: düşman başına ölüm sesleri, 6 kozmetik mızrak izi, Buz Hortlağı, Kan Yarasası, dördüncü muhafız Kan Kardinali (kendi müzik teması ve 'Kanı Durduran' başarımı), üç biyom (Cadı Zindanı, Buz Mezarlığı, Kan Katedrali), av sonu istatistikleri ve ölüm nedeni, sabit joystick ve sol el modu, muhafız müzik temaları (Lord: ağır yürüyüş, Atlı: dörtnala, Kraliçe: tam-ton ağıt; öfkede hızlanır), 12 başarım ve pelerin renkleri, 15+ oda dengesi, Ruh Sandığı ve Mimik, Kan Sunağı, muhafız ikinci formu, Kalkanlı Şövalye ve Kemik Bombası, grafik kalitesi ayarı (otomatik / yüksek / düşük), Günün Avı sonuç paylaşımı, akıllı bot ile denge ayarı, mızrakçıya özel efsanevi kartlar, Günün Avı (tohumlu), son avlar listesi, bot ile denge ölçümü ve ayarı, 4 mızrakçı, Unutuş Ritüeli (güç silme), Yükselmiş muhafızlar, PWA (ana ekrana ekleme + çevrimdışı önbellek), Ruh Tüccarı kapısı, üçüncü muhafız Yas Kraliçesi, üretken müzik (dron + minör pentatonik arpej; savaşta davul, muhafızda hızlanır), Kader Çağrısı (R), kapı seçimi (Savaş/Elit/Lanetli/Ruh Pınarı), elit düşmanlar, ikinci muhafız Gölge Atlı, 5 efsanevi sinerji, vuruş durması (hit-stop) ve titreşim.

Sıradakiler:
1. Görsel yol haritası Aşama 2: WebGL son işleme (bloom, şok dalgası kırılması, renk sapması, LUT).
2. Aşama 1: Verlet pelerin/saç, Perlin sarsıntı, muhafız giriş sinematiği, müziğe senkron parlama.
3. Gerçek oyun geri bildirimiyle zorluk ince ayarı.

## 13. Oyun hissi (Metal Slug esinli)

Hedef: eski arcade oyunlarındaki gibi her öldürmenin "tatmin edici" hissettirmesi.

| Olay | Efekt |
|---|---|
| Sıradan düşman ölümü | Gövde 6–10 parçaya ayrılır; parçalar dönerek havaya fırlar, yere düşüp seker, gölgeleri yerde görünür. Saplı mızraklar da fırlar. Yerde birkaç saniye kalan leke. Küçük ekran titremesi ve gürültülü "çatırtı" sesi. |
| Dev / elit düşman ölümü | Daha çok parça, **beyaz yıldız patlaması** (4/6 köşeli yıldız + çapraz parıltı + genişleyen halka), kısa **beyaz ekran parlaması**, 0.35 sn **ağır çekim** (×0.25), güçlü titreme ve derin patlama sesi. |
| Muhafız ölümü | Muhafız yerinde donar ve beyaz yanıp söner; 1.8 sn boyunca gövdesinde art arda küçük yıldız patlamaları; sonunda 8 köşeli dev yıldız patlaması, tam ekran beyaz parlama, ağır çekim ve parçalanma. Kalan tüm düşmanlar da parçalanır. |
| Oyuncu ölümü | Mızrakçı ruh renginde parçalanır, sahne ağır çekimde söner. |

### Çizgi film parlamaları ve diğer tatmin efektleri

| Efekt | Ne zaman | Nasıl görünür |
|---|---|---|
| **Yıldız parlaması** (çizgi film "ding") | Delici Mızrak, Kader inişi, İniş Şoku, 5+ mızraklı Söküm ile ölüm; kritik öldürmelerin %35'i; elitlerin %50'si | Düşman öldüğü yerde parçalanır; aynı noktada "ding" sesiyle minik bir yıldız belirir, ardından ekranı boydan boya kesen dev bir parlama: yatay ışık şeridi, dönen 8 ışın, beyaz ve renkli halkalar, ekranın ortasına doğru mercek yansımaları. |
| Vuruş yıldızı | Her mızrak isabetinde | Çarpma noktasında anlık beyaz 4 köşeli yıldız (kritikte altın, daha büyük). |
| Söküm ruhları | Söküm kullanılınca | Sökülen mızraklar parlayan ruh izleri olarak oyuncuya akar; oyuncudan büyük bir şok halkası yayılır. 3+ öldürmede siyah-beyaz darbe karesi, hız çizgileri ve parlama. |
| Ruh parçası mıknatısı | Her öldürmede | Altın elmaslar sekerek düşer, sonra oyuncuya çekilir; toplanınca tını sesi (seri arttıkça incelir) ve sayaç zıplar. |
| Seri övgüsü | 10, 20, 35, 50, 75, 100 seri | Ekranın ortasında eğik altın yazı (Harika, Müthiş, Efsane, Durdurulamaz, Tanrısal, Yemin tutuldu) ve parlama. |
| Son vuruş | Odanın son düşmanı | Ağır çekim, zoom ve son düşmanın yerinde dev parlama. |
| Darbe karesi | Muhafız ölümü, çoklu Söküm | Bir anlığına renkler tersine döner (anime "impact frame"). |
| Hız çizgileri | Kader uçuşu, muhafız ölümü | Ekran kenarlarından merkeze doğru beyaz çizgiler. |
| Güç ışını | Güç seçildikten sonra odaya girişte | Oyuncunun üstüne inen ruh ışığı sütunu. |

Erişilebilirlik: cihazda "hareketi azalt" açıksa titreme %30'a, ekran parlaması %25'e düşer.

## 14. Görsel yön

### Biyomlar

| Odalar | Biyom | Görünüm |
|---|---|---|
| 1–9 | Cadı Zindanı | Mor taş, mor rün çemberi, mor-turkuaz cadı ateşi, mumlar |
| 10–19 | Buz Mezarlığı | Buzlu mavi-gri taş, kırağı lekeleri, kenarda karla kaplı mezar taşları ve mavi ruh ışıkları, mavi ateş, ekranda kar yağışı, mavi tonlu boşluk |
| 20+ | Kan Katedrali | Kızıl taş, kan gölleri, kırmızı rün çemberi, kırmızı mumlar ve ateş, hızla yükselen közler, kızıl tonlu boşluk |

Her biyomun zemini ve rün çemberi ilk kullanımda bir kez çizilip önbelleğe alınır. Yeni biyoma girerken üstte "Yeni bölge" bildirimi çıkar.

### Ruh evreni (görsel güncelleme 2)

- **Boşluk:** Arena, ruh boşluğunda süzülen bir ada. Arkada mor/turkuaz bulutsu, göz kırpan yıldızlar ve hilal biçimli soluk bir ay (kamera ile yavaş paralaks).
- **Uzak adalar:** Yıkık sütunlu, kristalli ve fenerli kuru ağaçlı 10 yüzen ada; derinliğe göre küçülür, ağır ağır salınır.
- **Uçurum:** Adanın altı görünür: katmanlı kaya, sarkıtlar, turkuaz ve mor parlayan kristal damarları; çevresinde dönen kaya parçaları.
- **Cadı zindanı:** Mor taş döşeme, dönen iki mor rün çemberi (yedi köşeli yıldız ve rünler), zeminde sürünen sis, duvarda 20 mum kümesi, mor-turkuaz cadı ateşli mangallardan yükselen duman.
- **Gümüş ruh dumanı:** Ortak bir duman sistemi (en fazla 460 parçacık): mızrakçı, uçan mızraklar, ruh müttefikleri ve mangallar gümüş; düşmanlar koyu; muhafızlar mor; elitler altın duman salar. Ölümlerde duman patlaması.
- **Ruh mızrağı:** Saydam sap, bağlı kabza, yaprak biçimli parlayan uç ve geri kancalar; uçarken arkasında dalgalanan iki ruh kurdelesi ve duman izi. Düşmana saplı mızraklar da ruh ucu taşır.
- **Mızrakçı:** Havada süzülen hayalet savaşçı: alt gövdesi dumana karışır, harekete göre savrulan yırtık pelerin, gümüş zırh ve altın işleme, omuzluk, maskeli başlık, arkada alev saç ve büyük ruh mızrağı. Mızrakçının rengine göre parlar.
- **Düşmanlar:** Kare ve üçgen şekiller kaldırıldı. Okçu: dalgalı cüppesi dumana karışan kapüşonlu iskelet, mor ruh yayı. Dev: kambur, kemik sırtlı, boynuzlu kafatası, kavisli kollar ve kemik yumruklar.
- **Işık:** Karanlık mor tonlu; adanın dışı daha açık bırakılır ki boşluk görünsün.


Tema: **ruhani mezar arenası**. Karanlık taş zemin, turkuaz ruh ışığı, yıpranmış altın süslemeler.

- **Işık:** Sahne yarı çözünürlüklü bir ışık haritasıyla karartılır; oyuncu, mızraklar, mermiler, meşaleler, patlamalar ve doğma çemberleri bu karanlığı oyar. Ardından gözler, mızrak uçları, alevler ve mermiler toplamalı (additive) parıltıyla karanlığın üstüne çizilir.
- **Zemin:** Oyun başında bir kez çizilip önbelleğe alınır: halkalar halinde döşenmiş taşlar, çatlaklar, yosun, ortada üç mızraklı rün mührü, kenarda blok duvar ve 10 turkuaz meşale.
- **Karakterler:** 3/4 bakış; her varlığın yerde gölgesi var ve derinlik sırasına göre çizilir. Mızrakçı pelerinli, başlıklı; sekerken havaya kalkar, inişte ezilir, pelerini harekete göre savrulur. Düşmanlar vuruşta esner ve beyaz yanar, yerden yükselerek doğar.
- **Okunabilirlik:** Tehlike bölgeleri dolan kırmızı/mor şeritlerle; sökümle ölecek düşmanlar altın dönen halkayla; elitler taç ve altın ışıltıyla; kalkanlar mavi baloncukla gösterilir.
- **Kamera:** Bakış yönüne hafif önden bakar; büyük öldürmelerde ve Kader inişinde kısa bir zoom vuruşu yapar.
- **Ekran sonrası:** Vinyet, film greni, hasar alınca ve can %30'un altındayken kırmızı kenar.
- **Arayüz:** İkonlu yetenek düğmeleri (dairesel bekleme süresi), gecikmeli (beyaz iz bırakan) can barı, muhafız barı ve sinematik siyah şeritli giriş, seri sayacı, ikonlu ve nadirliğe göre renklenen kartlar.

## 15. Av sonu istatistikleri

Ölüm ekranında: seni deviren düşman ya da saldırı ("Seni deviren: Kemik Dev (elit)", "Çığlık dalgası", "Ruh Okçusu mermisi"...) ve en çok hasar veren 6 kaynağın yüzdelik çubukları (Mızrak, Söküm, Delici Mızrak, Kader Çağrısı, İniş Şoku, Ruh İzi, Yeminli Ruh, Kemik Bombası).

## 16. Dokunmatik seçenekler

Duraklat menüsünde: **Joystick: serbest / sabit** (sabitte taban ekranın alt köşesinde durur ve hep görünür) ve **Butonlar: sağda / solda** (sol el modu; sabit joystick bu modda sağ alta geçer).

## 17. Telefona kurulum (PWA)

`game/` klasörü herhangi bir statik sunucuda (ör. GitHub Pages) yayınlanınca tarayıcının "Ana ekrana ekle" seçeneğiyle tam ekran uygulama gibi kurulur; `sw.js` dosyaları önbelleğe alır, oyun çevrimdışı açılır. Claude artifact sürümünde servis çalışanı devre dışıdır.

## 18. Performans

Duraklat menüsünde **Grafik: otomatik / yüksek / düşük**. Otomatikte savaş sırasında 3 sn boyunca ortalama kare süresi 26 ms'yi (≈38 fps) aşarsa düşük kaliteye geçer. Düşük kalite: piksel yoğunluğu en fazla 1.25, uzak adalar, sis ve film greni kapalı, sıradan düşman dumanı kapalı, duman sınırı 130 parçacık.

## 19. Teknik

- Tek dosya HTML5 Canvas + saf JavaScript, kütüphane yok.
- Dünya: 820 birim yarıçaplı dairesel arena, kamera oyuncuyu takip eder, zoom ekran boyutuna göre ölçeklenir.
- Oyuncu durum makinesi: `idle → windup → (hop | post → idle)`, `qcast` aynı akışı kullanır; R için `rise → fling → idle`.
- Vuruş hissi: Söküm öldürmesi, Kader inişi ve muhafız ölümünde kısa zaman yavaşlaması (hit-stop) ve `navigator.vibrate` (destekleyen cihazlarda).
