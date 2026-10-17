# Ruh Tilkisi — Oyun Tasarım Dokümanı

Telefonda oynanan, sekerek hareket eden beyaz bir ruh tilkisiyle oynanan roguelike arena oyunu.

Oynamak için: `game/index.html` dosyasını tarayıcıda aç (tek dosya, kurulum gerekmez).

## 1. Ana mekanik: fırlat ve sek

Tilki silah taşımaz: her saldırıda sırtının üstünde bir ışık mızrağı belirir, gerilir ve menzildeki en yakın düşmana uçar. Mızrak çıkarken yön tutarsan tilki o yöne seker.

| Kural | Ayrıntı |
|---|---|
| Sekme tamponu | Mızrak hazırlanırken ya da çıktıktan sonraki 0.13 sn içinde yön tutarsan o yöne **sekersin**. |
| Saldırı kesilmez | Hazırlık sırasında yürüyemezsin; yön girdisi sadece sekmeyi tamponlar. |
| Açıya bağlı mesafe | Hedefe doğru ×0.6, yana ×1.0, geriye ×1.25 mesafe. |
| Delici Işık (Q) | Hattaki her düşmanı deler, ölenin içinden geçip saplı ışıkları sonrakine taşır; sonrasında da sekebilirsin. |
| Söküm (E) | Saplı ışık mızraklarını söker, mızrak başına hasar artar; öldürürse bekleme 0.5 sn'ye düşer. |
| Ay Sıçrayışı (R) | Ay ışığı tilkiyi 0.4 sn kaldırır (hasarsız), sonra tuttuğun yöne ya da en yakın düşmana fırlatır. İnişte sersemletme, itme, 2 mızrak saplama. Bekleme 20 sn. |

Sonuç olarak ritim şu: **fırlat → sek → fırlat → sek**. Yürümek yavaş (140 birim/sn), sekme ise 0.15 sn'de ~160 birim. Ustalık, sekmeyi doğru yöne zamanlamakta.

## 2. Kontroller

- **Telefon:** Ekranda herhangi bir yerde parmağını sürükle → sanal joystick (yön). Sağ altta Söküm (E), Delici Işık (Q) ve Ay Sıçrayışı (R) düğmeleri.
- **Klavye:** WASD/oklar yön, `E` veya boşluk Söküm, `Q` Delici Işık, `R` Ay Sıçrayışı, `Esc`/`P` duraklat.
- Saldırı otomatik: menzildeki en yakın düşmana atar. Bu, telefonda tek başparmakla kite yapmayı mümkün kılıyor.

## 3. Tilkiler

"Ava başla" sonrası karakter seçilir (son seçim hatırlanır). Her birinin pelerin rengi farklıdır.

| Mızrakçı | Artı | Eksi |
|---|---|---|
| Ak Tilki | Dengeli | — |
| Gölge Tilki | Sekme +%35, sekerken hasar almaz | Mızrak hasarı -%15, can -20 |
| Kor Tilki | Mızrak hasarı +%30, %25 şansla çift saplanma | Saldırı hızı -%15, sekme -%10 |
| Ruh Çağıran | 1 Ruh Yavrusu ile başlar, Ay Sıçrayışı bekleme -%30 | Mızrak hasarı -%10 |
| Orman Tilkisi (kilitli: bir avda Kadim Ağaç'ı yen) | 1 Tilki Ateşi ile başlar; ateşler +1 mızrak atar, inişte de ateş bırakır. Özel efsanevi: Koru Bekçisi (ateş mızrakları tam hasar ve yavaşlatır) | Mızrak hasarı -%10 |

Günün Avı ve "Dört Tilki" başarımı ilk dört tilkiyle sınırlıdır. Deneme Odası'nda kilitli tilkiler de seçilebilir.

### Mızrakçıya özel efsanevi kartlar

| Kart | Mızrakçı | Ön koşul | Etki |
|---|---|---|---|
| Sadakat | Ak Tilki | Yırtıcı veya Acımasız | Söküm hasarı +%20; Söküm öldürmesi başına Ay Sıçrayışı bekleme -3 sn |
| Gölge Dansı | Gölge Tilki | Uzun Sekme veya Hızlı El | Her sekmeden sonra 0.8 sn saldırı hızı +%45 |
| Kemik Patlaması | Kor Tilki | Ağır Mızrak veya Keskin Uç | 5+ mızraklı düşman ölünce çevresine 6 mızrak saçar |
| Ruh Korosu | Ruh Çağıran | Ruh Yavrusu veya Ay Işığı | Ruhlar iki mızrak atar, ruh mızrakları %80 hasar |

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
| **Yas Kraliçesi** (15., 30. oda) | Süzülen hayalet kraliçe. Çığlık dalgası (genişleyen mor halka: yerdeyken vurur, **üstünden sekerek atlanır**), oyuncuyu takip eden ruh mermileri, mor halkayla işaretlenen ışınlanma, ateş ruhu çağırma; %50 altında 3'lü çığlık | Dalga yaklaşınca sek, Ay Sıçrayışı ile havada kal |
| **Yükselmiş muhafızlar** (20. oda ve sonrası) | Can +%20, altın aura; saldırılarının %40'ında diğer muhafızlardan ödünç bir saldırı kullanır: Lord → çığlık dalgası / mızrak hatları, Atlı → çığlık / ruh mermileri, Kraliçe → mızrak hatları / mermi halkası | Altın parlama = ödünç saldırı geliyor |
| **Gölge Atlı** (10., 25. oda) | Arka arkaya 3–4 dörtnala hücum ve arkasında yakan mor iz; çift kollu spiral mermi; yelpaze şeklinde mızrak hatları (önce çizgiyle uyarır) | Hatların arasına sek, Ay Sıçrayışı ile sersemlet |

| **Buz Hortlağı** (Buz Mezarlığı, 10–19) | Hortlak gibi kovalar; dokununca ve 3'lü buz nefesiyle seni 1.6 sn **yavaşlatır** (yürüme %60, sekme mesafesi %80) | Yakın mesafeye girmeden mızrakla; yavaşlamışken Ay Sıçrayışı ile kaç |
| **Kan Yarasası** (Kan Katedrali, 20+, üçlü gelir) | Etrafında daire çizip uçar, kısa uyarıyla dalış yapar; vurursa hasarın 3 katı **can emer** | Dalış anında yana sek; Söküm ile toplu temizle |
| **Kan Kardinali** (20. oda, sonra her 20 odada) | Mitralı kızıl rahip, sallanan buhurdan. Etrafında dönerek açılan kan bıçakları; ayağının altında uyarılı kan fışkırmaları (4, öfkede 6); haç biçimli mermi yağmuru (iki dalga, 45° dönük); kan yarasası çağırma | Bıçak halkası açılırken dışarı sek, kırmızı dairelerden çık |
| **Kalkanlı Şövalye** (7. oda+) | Kalkanını yavaşça oyuncuya çevirir; önden gelen mızrakları engeller (BLOK). Yakındayken kısa kalkan hamlesi yapar (kırmızı şeritle uyarır) | Sekerek yanına/arkasına geç; Delici Mızrak kalkanı deler; Ay Sıçrayışı ile sersemletilmişken engelleyemez |
| **Kemik Bombası** (6. oda+, ikili gelir) | Hızla koşar, yaklaşınca fitili yanar (turuncu daire dolar), 0.8 sn sonra 95 birim alanda patlar | Fitil bitmeden öldür: erken patlama sadece düşmanlara hasar verir; ya da dairenin dışına sek |

**İkinci form (10. oda ve sonrası):** Muhafızın canı ilk bittiğinde ölmek yerine 1.4 sn hasar almayan bir dirilişe girer (mor duman, ekran parlaması, "İkinci form" yazısı), canının yarısıyla "Öfke" adıyla döner: %20 hızlı, %10 daha sert, Yükselmiş muhafızlar gibi diğer muhafızların saldırılarını da kullanır.

**Elit düşmanlar** (altın kesikli halka): can ×1.8, hasar ×1.2 ve bir özellik: *Kalkanlı* (canın %40'ı kadar mavi kalkan), *Hızlı* (+%35 hız), *Patlayan* (ölünce 8 mermi saçar). Elit başına 3 ruh parçası.

Zorluk: oda başına düşman canı +%20, hasar +%8, hız +%1.5. Altın halka = düşman sökümle ölür.

## 6. Güçler (37 adet, 3 nadirlik + efsanevi)

- **Mızrak:** Keskin Uç, Hızlı El, Uzak Hedef, Ölümcül Göz, Çatallı Mızrak, Delip Geçen, Ağır Mızrak, Buz Uç, Mızrak Fırtınası, Seken Işık (isabette %35 şansla en yakın başka düşmana seker), Av İşareti (3+ mızraklı düşmana +%15 hasar)
- **Sekme:** Uzun Sekme, Hayalet Adım (sekmede hasarsızlık), Ruh İzi (yakan iz), İniş Şoku, Ritim (art arda sekme hasar çarpanı), Gölge Mızrak (sekmede bedava mızrak), Hafif Ayak, Akış (inişte sonraki atışın beklemesi -%30), Yankı Sekmesi (her 3. inişte gecikmeli ışık patlaması, %150 hasar + 1 mızrak), Tilki Ateşi (sekmenin başladığı yerde kalan ateş az sonra yakındaki düşmanlara mızrak atar)
- **Söküm:** Yırtıcı, Acımasız, İnfaz, Bulaşıcı Işık (ölenin mızrakları yayılır), Ruh Hasadı, Söküm Novası (Sökümle ölen düşman patlar)
- **Delici / Ay:** Delici Işık, Ay Işığı, Yıldız Yağmuru (Ay inişinde 10 yıldız mızrağı)
- **Ruh:** Sağlam Ruh, Yenilenme, Kan Bağı, Ruh Yavrusu (etrafında dönüp ışık mızrağı atan küçük ruh), Ruh Kalkanı (12 sn'de bir gelen hasarı tamamen engeller)

- **Efsanevi sinerjiler** (iki ön koşul güç alınınca havuza girer):
  - Hayalet Ordusu = Hayalet Adım + Gölge Mızrak → +2 gölge mızrak, inişte 0.4 sn hasarsızlık
  - Kemik Kıran = Ağır Mızrak + Yırtıcı → Söküm'de ek mızrak başına %95 hasar
  - Ruh Yangını = Ruh İzi + İniş Şoku → iz hasarı ×2, şok yarıçapı +40
  - Lejyon = 2+ Ruh Yavrusu + Hızlı El → ruhlar iki kat sık atar
  - Ay Tutulması = Ay Işığı + Acımasız → Ay Sıçrayışı inişi bedava Söküm
  - Işık Zinciri = Seken Işık + Çatallı Mızrak → sekme şansı +%20, seken mızraklar bir kez daha seker
  - Kuyruklu Yıldız = Yankı Sekmesi + İniş Şoku → yankı her inişte ve daha geniş
  - Ay Kalkanı = Ruh Kalkanı + Ay Işığı ya da Yıldız Yağmuru → kalkan 8 sn'de dolar, Ay inişi kalkanı anında yeniler ve 1 sn hasarsızlık verir

Nadirlik ağırlıkları: Sıradan 10, Nadir 5, Destansı 2, Efsanevi 6 (yalnızca ön koşullar tamamsa). Elit/Lanetli/Muhafız ödüllerinde sıradan kartların ağırlığı 2'ye düşer.

Örnek build'ler:
- **Sekme ustası:** Hayalet Adım + Gölge Mızrak + Ruh İzi + İniş Şoku + Hızlı El → her saldırı bir hasar patlaması.
- **Söküm infazcısı:** Ağır Mızrak + Çatallı Mızrak + Yırtıcı + İnfaz + Bulaşıcı Işık → zincirleme Söküm sıfırlamaları.
- **Ruh ordusu:** Ruh Yavrusu ×3 + Hızlı El + Kan Bağı.
- **Işık tilkisi:** Tilki Ateşi ×3 + Akış + Yankı Sekmesi + İniş Şoku → her sekme bir mızrak yağmuru ve patlama.
- **Zincir avcı:** Seken Işık ×2 + Çatallı Mızrak + Av İşareti → kalabalıkta mızraklar düşmandan düşmana atlar.

## 7. Başarımlar, pelerinler ve mızrak izleri

Mızrak izleri başarım sayısıyla açılır: Ruh (0), Alev (2, turuncu kurdele + kıvılcım + turuncu duman), Buz (4, beyaz kıvılcım), Kan (6, koyu kızıl duman), Gölge (8, mor duman), Yıldız (11, iz boyunca renk değiştiren yıldızlar). Seçim Ruh Dolabı ekranından yapılır.

Her düşman türünün kendi ölüm sesi vardır: Hortlak hırlar, Ateş Ruhu söner, Okçu'nun kemikleri takırdar, Dev gümler, Tükürgen patlar, Şövalye çınlar, Buz Hortlağı kırılır, Yarasa çığlık atar, Mimik ısırıp altın saçar.

## 8. Başarım listesi

12 başarım, her biri bir pelerin rengi açar (Başarımlar ekranından giyilir, tüm mızrakçılarda geçerli; açılınca üstte bildirim çıkar):
Kemik Yıkan (Kemik Lordu), Atlıyı Düşüren, Yası Bitiren, Durdurulamaz (50 seri), Toplu Söküm (tek Sökümle 5 öldürme), Rüzgâr Adım (bir avda 500 sekme), Derinlere (20. oda), Sandık Avcısı (Mimik), Dokunulmaz (5. odadan sonra hasarsız oda), Günün Avcısı (Günün Avı'nda 10. oda), Kurban (Ruh Bağışı), Dört Tilki (dört tilkiyle Kemik Lordu).

## 9. Kalıcı ilerleme (Ruh Sunağı)

| Güç | Etki | Seviye |
|---|---|---|
| Ruh Kalkanı | +12 başlangıç canı | 5 |
| Kadim Uç | +%6 mızrak hasarı | 5 |
| Ruh Adımı | +%6 sekme mesafesi | 3 |
| Kehanet | +1 yeniden çekme | 3 |

Kayıt tarayıcının yerel depolamasında tutulur.

## 10. Denge ölçümü

`tools/balance-sim.js` oyunu tarayıcıda kendi kendine oynatır: bot tehditlerden kaçar, mermilere dik kaçar, duvardan uzak durur, uygun anda Söküm / Delici / Ay Sıçrayışı kullanır, her zaman ilk kartı ve Savaş kapısını seçer. Her tilkiyle N av yapıp ulaşılan odayı, oda başına süreyi ve alınan hasarı raporlar.

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

### Dördüncü ölçüm (yeni güçler ve Ruh Ormanı)

`node tools/balance-sim.js 3 meta`: yükseltmeli bot medyan 9–15. oda (önceki 10–11 ile uyumlu; yeni güçler dengeyi bozmadı). `node tools/balance-sim.js 2 meta 30` (Deneme Odası gibi 30. odadan, o derinliğe uygun güçlerle): Kadim Ağaç iki ölçümde 16 avın ~9'unda geçildi (%56); ölümlerin çoğu 35. odadaki Yükselmiş Yas Kraliçesi'nin çığlık dalgalarından. Orman odalarında alınan hasarın kaynakları: kökler, Gölge Kurt, Diken Sarmaşığı, spor bulutu. Simülasyon artık hasar kaynaklarını da raporlar ve üçüncü argümanla istenen odadan başlar. Değişiklik gerekmedi.

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
- Şok dalgası kırılması: patlama, Ay Sıçrayışı inişi ve Söküm halkalarında ekranın dalgalanması.
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
- [x] Adım 1: WebGL altyapısı ve son işlem. 2D tuval her kare dokuya aktarılır; parlak geçiş + yarım ve çeyrek çözünürlükte ayrılabilir Gauss bulanıklığı (bloom), 8 eşzamanlı şok dalgası kırılması (yıldız patlamaları, Ay Sıçrayışı inişi, Söküm, dev parlamalar), hasar ve darbe karelerinde renk ayrışması, biyom başına doygunluk/kontrast/renk tonu ve yumuşak film eğrisi. WebGL yoksa, bağlam kaybolursa ya da düşük kalitede eski çizim gösterilir; otomatik kalite yavaşlıkta önce bu katmanı kapatır ("orta"), sonra düşük kaliteye iner.
- [x] Adım 2: diyar GPU'da çizilir. Bulutsu paralaksla, biyom tonu ve üç katman titreşen prosedürel yıldız tek gölgelendiricide; ay, yüzen adalar, kaya parçaları ve uçurum doku olarak. Zemin, ekranda görünen en güçlü 32 renkli nokta ışıkla (mangallar biyom ateşi rengi, mumlar, mızraklar iz rengi, düşman mermileri türüne göre, oyuncu, patlamalar) piksel başına aydınlatılır; normal haritası zemin dokusunun parlaklık eğiminden çıkarılır, biyom başına ortam rengi, yayınık kazanç ve speküler parlaklık (buzda daha parlak) vardır. Taneli film dokusu ve darbe karesindeki renk tersine çevirme de gölgelendiriciye taşındı. 2D tuval artık yalnızca ön planı (karakterler, efektler, yazılar) taşır ve sahnenin üstüne bindirilir; ışık haritası sadece tuvalde çizili olanları karartır. Işık sayısı cihazın uniform sınırına göre ayarlanır. GPU yoksa ya da otomatik kalite "orta"ya inerse eski 2D çizim aynen kullanılır.
- [x] Adım 3: sıradan düşmanlar (gulyabani, buz gulyabanisi, dev, şövalye, okçu, tükürgen, yarasa, bomba, sandık) ilk göründükleri anda ekran çözünürlüğünde animasyon karelerine pişirilir (türüne göre 16–36 kare; durum çeşitleri: devin hücum hazırlığı, tükürgenin dört dolum seviyesi, yarasanın dalış ve nişan hali). Her kare bir kez koyu kontur, sol üstten soğuk anahtar ışık kenarı ve ayaklara doğru form gölgesiyle bitirilir; vuruş parlaması karenin beyaz silüetidir. Oyunda her düşmanın en güçlü yakın ışığa (oyuncunun ruh ışığı, mangallar, mızraklar, patlamalar) bakan kenarı o ışığın renginde parlar. Döngülerin dikişsiz olması için ikincil hareketler ana döngünün harmoniklerine ayarlandı. Oyuncuya nişan alan parçalar (okçunun yayı, şövalyenin kalkanı) ve hareketli kısımlar (alev ruhu, açılan taklitçi sandık, fitili yanan bomba, muhafızlar) prosedürel kalır. Parıltı, ışık ve duman çağrıları sahte bir bağlam üzerinden aynen sürer. Kare başına pişirme bütçesi 6, önbellek sınırı yaklaşık 7 milyon piksel; masaüstü testinde düşman çizimi yaklaşık 4–5 kat hızlandı.
- [x] Adım 4: duman ve parıltılar GPU'da örneklemeli dörtgenlerle (ANGLE_instanced_arrays) çizilir. Duman iki oktav döşenebilir gürültü dokusuyla kabarık görünür, yaşlandıkça kenarlarından aşınarak dağılır, kendi etrafında yavaşça döner; koyu katman sahnenin en güçlü 8 renkli ışığıyla aydınlanır (mangal yanındaki duman ateş rengini alır), parlak katman ekran karışımıyla çizilir. Duman sınırı GPU'da 460'tan 1400'e çıktı. Tüm parıltılar artık gerçekten toplamalı ekleniyor (saydam ön plan tuvalindeki yarı karışma sorunu bitti). Her biyomun prosedürel parçacık alanı tek tam ekran geçişte binlerce zerre üretir: buzda üç derinlik katmanında rüzgârla savrulan kar (eski 90 tanelik CPU karının yerini alır), kan katedralinde titreşerek yükselen korlar, cadı zindanında yavaşça süzülen turkuaz ve mor ruh zerreleri; zerreler dünyaya bağlıdır ve kamerayla paralaks yapar. Eklenti yoksa ya da GPU yolu kapalıysa eski 2D duman, parıltı ve kar aynen kullanılır.

**Resimsi görünüm (Ori'den esinli, kodla):**
- [x] Tilki kahraman: beyaz ruh tilkisi; dört bacaklı koşu döngüsü, sekmede gerilip uzanan gövde ve burun açısı, gür ve yükselen ruh kuyruğu (üst üste binen yumuşak loblar), parlayan göz, sırtının üstünde süzülen ışık küresi. Saldırıda küre gerilip bir ışık mızrağına dönüşür ve düşmana uçar. Kahraman çeşitleri kulak içi, pati ve kuyruk ışığı rengini değiştirir.
- [x] Kuwahara yağlı boya filtresi: sahne yarım çözünürlükte 4 çeyrekli Kuwahara'dan geçer (36 örnek), son görüntüye %82 oranında karışır; kenarlar korunur, yüzeyler fırça lekelerine döner. Üstüne iki oktav gürültüden tuval dokusu.
- [x] Düşman sprite'larındaki sert koyu kontur kaldırıldı, yerine yumuşak hafif gölge.
- [x] Parlama yalnızca gerçek ışık kaynaklarından gelir (eşik 0.8), ama daha güçlü; beyaz tilki ışıkta erimez.
- [x] Ekran köşelerinde odak dışı koyu ön plan dalları, yaprakları ve sarkan sarmaşıklar (biyom renginde, ışık alan kenarlı, parlayan tomurcuklu), kamerayla hafif kayar ve rüzgârda salınır.
- [x] Yukarıdan inen eğik ışık hüzmeleri, biyom renginde, yavaşça kayar.
- [x] Zemin kenarında biyolüminesan mantar ve filizler (34 adet), nefes alır gibi parlar.
- [x] 3B tilki: Meshy'de üretilen rigli "Frostlight Fox" modeli (`assets/fox/`, 27 kemik, yalnızca yürüme kaydı vardı) `tools/sprite-render` ile three.js'te yandan, 22° yukarıdan, anahtar + mavi arka ışık + mor dolgu ve hafif ışıma ile işlenir. Eksik animasyonlar kemiklerle üretildi: bekleme (kuyruk salınımı, baş hareketi), koşu (yürüme bacak açıları ×1.75, gövde sallanması, kalkık kuyruk), sekme (çömelme → uzanma → havada süzülme → iniş), fırlatma hazırlığı (baş ve kuyruk kalkar). 48 kare, 288×216 kare boyutu, WebP atlas (≈300 KB) HTML'e gömülü. Yürüme/koşu kareleri katedilen mesafeyle ilerler, sekme karesi sekme ilerlemesine, hazırlık karesi mızrağın dolumuna bağlıdır. Göz, kuyruk ucu ve sırt noktaları her kare için kayıtlıdır (ışıma, duman ve ışık mızrağı küresi oradan çıkar). GPU yolunda tilki resimsi filtrenin dışında, net üst katmanda çizilir: dünya boyalı, karakter keskin. Atlas yüklenmezse kodla çizilen tilki kullanılır.
- [x] Düşmanlar için 3B hattı hazır: `tools/sprite-render` herhangi bir rigli GLB'yi (Meshy'nin animasyon başına ayrı dosyaları dahil) kamera kendiliğinden oturarak atlasa çevirir; `pack.py` WebP'ye dönüştürüp `game/index.html` içindeki `@atlas` bölümüne gömer. Oyun, atlası olan düşmanı onunla çizer: yürüme kareleri zamanla, `attack` kareleri nişan / hücum / fitil hallerinde, `die` muhafız ölümünde; oyuncuya döner, vurulunca beyaz silüet, göz ışıltısı modelin baş kemiğinden. Atlası olmayan türler bugünkü kodla çizilen sprite'larla kalır.
- [x] Üçte dört görünüm: zemin ~51° yukarıdan görülür; dünya y ekseni ekranda 0.78 (sin 51°) ile basılır (2D dünya dönüşümü, ışık haritası, GPU sprite / zemin / parçacık gölgelendiricileri, şok dalgaları, ışık ayıklama). Oyun mantığı düz dünya koordinatlarında kalır. Dik duran şeyler (düşmanlar, tilki, mangal alevleri, hasar yazıları, mızrak sayaçları) basıklığı yerelde geri alır; gölgeler ekranda aynı oranda kalır. Joystick yönü ekrandaki parmak yönüne karşılık gelen dünya yönüne çevrilir.
- [x] 8 yönlü karakterler: `tools/sprite-render` modelleri aynı 51° açıdan doğu, güneydoğu, güney, kuzeydoğu, kuzey yönlerinde işler; batı yarısı aynalanır. `pack.py` her kareyi içeriğine kırpıp tek sayfaya dizer (tilki: 180 kare, 2048×680, ~340 KB). Tilki koşarken gittiği yöne, sekerken sekme yönüne, nişan alırken hedefe bakar; düşmanlar oyuncuya döner.
- [x] Düşman modelleri (Meshy, `assets/enemies`, dokular 1024 px WebP'ye küçültüldü: 190 MB → 20 MB):
  - Animasyonlu insan iskeletliler (Meshy klipleri, yerinde oynatılır): Ruh Okçusu (yürüme, ok atışı), Kalkanlı Şövalye (yürüme, ikili saldırının ilk yarısı), Kemik Dev (yürüme, yüklü savuruş), Kemik Lordu ve Kan Kardinali (yürüme, saldırı, ölüm).
  - Yalnız rigli olanlara kemik dönüşleriyle hareket yazıldı: Hortlak (çapraz adımlı sürünme, geri çekilip atılma), Tükürgen (örümcek yürüyüşü, kesesi şişerek tükürme), Yas Kraliçesi (süzülme, peçe salınımı, kolları kalkarak çığlık, çöküş; model 24° öne eğikti, doğrultuldu), Gölge Atlı (yürüyüş, şahlanıp kılıç savurma, yere yığılma; model 25° çapraz duruyordu, döndürüldü).
  - Gölge Atlı'nın atının ön bacaklarında kemik yoktu: her bacağa omuz–diz zinciri eklendi, bacak bölgesindeki köşeler (≈1500) yeni kemiklere ağırlıklandırıldı.
  - Eksik silahlar kodla modellenip el kemiklerine bağlandı (animasyonla hareket eder): Okçuya parlayan mor yay, Şövalyeye kılıç ve haçlı kalkan, Lord'a mavi ışıklı büyük kılıç, Kardinal'e kızıl küreli asa (yürürken dirsek bükülü, asa dik).
  - Buz Hortlağı, Hortlak atlasının buz tonlu kopyasıyla çizilir. Muhafızlar `walk`, `rest` ve `appear` dışındaki her durumda saldırı karelerini kullanır.
  - Atlaslar ilk kullanımda açılır (muhafızlarınki ancak o muhafız gelince). Ateş Ruhu, Kan Yarasası, Kemik Bombası ve sandıklar kod çizimiyle kalır.
  - GPU yolunda yağlı boya karışımı %82'den %55'e, varlıklar üzerindeki karanlık .52'den .34'e indi ki modeller okunsun.
- [x] Üçte dört görünüm için düzenleme:
  - Arka plan: uçurumun üst kenarı eğik arena kenarını izler, kaya yüzü dik sarkar; yüzen adalar ve kaya parçaları yerde eğik konumlanır ama dik çizilir.
  - Tepeden bakış için önceden basık çizilen yer şekilleri (lekeler, tehlike alanları, kan fışkırması, doğma çemberi, ışınlanma ve sıçrama uyarıları) artık gerçek daire; eğim onları kendiliğinden elips yapar.
  - Yetenek ve vuruş halkaları (sekme, Söküm, Ay Sıçrayışı inişi ve yükselişi, Delici, ölümler, toplama, yıldız patlaması, Kraliçe çığlık dalgaları) 1–4 piksellik çizgi yerine yumuşak, renkli, kenarı beyaz parlayan, yavaşlayarak genişleyen ışık dalgaları; başta kısa bir parlama.
  - Menzil göstergesi kesik çizgi yerine soluk, nefes alan bir ışık halkası. Söküm infaz işareti kesik çizgi yerine nabız gibi atan altın halka ve etrafında dönen üç kıvılcım.
  - Kıvılcımlar ince çizgi yerine toplamalı, beyaz çekirdekli ışık izleri. Mızrak izleri titreşen çizgiler yerine mızraktan kuyruğa incelen ışık şeridi. Düşmana saplı mızraklar çubuk yerine beyaz çekirdekli ışık kıymıkları.
- [x] Küçük düşmanlar için kodla kurulan 3B modeller (`tools/sprite-render/models.js`, aynı 51° ve 5 yönlü işleme): Kemik Bombası (çatlaklarından kor sızan kemik küre, dört örümcek bacağı, kıvılcımlı fitil; fitil yanınca şişip kızarır), Kan Yarasası (kanat zarı şekilleri omuzdan çırpar, dalışta kanatlar geriye katlanır), Sandık (yarım silindir kapak, altın bantlar, kapak aralığından ışık; yalnız önden), Mimik (diş sıraları, dil, kırmızı gözler; yürürken çene çırpar, saldırıda ağzını açar, sıçrayınca havalanır). Ateş Ruhu bir alev olduğu için kod çizimiyle kalır.
- [x] Kahraman çeşitleri ve kürkler beyaz tilki atlasının renklendirilmiş kopyasıyla çizilir (gölgeler korunur, ton ve doygunluk kürk renginden): Gölge Tilki lavanta, Kor Tilki kehribar, Ruh Çağıran mavi; başarım kürkleri de aynı yolla.
- [x] Boyanmış arka planlar: zemin, uçurum ve yüzen adalar kodla çizildikten sonra kendi renklerinden örneklenen yönlü fırça darbeleriyle yeniden boyanır (dört kat: geniş taban darbeleri → orta → yalnız ayrıntılı yerlerde ince darbeler; darbeler kenar boyunca, düz alanlarda yumuşak bir akış alanı boyunca uzanır, açık ve koyu kıl izleri taşır). Taş araları yumuşatıldı, zemine biyom renginde geniş ışık ve gölge lekeleri eklendi; mühür, boyamanın üstüne net olarak yeniden kazınır. Boyama arka planda küçük zaman dilimleriyle yapılır (oyun sırasında kare başına en çok 4 ms); hazır olana kadar düz doku görünür, bitince aynı tuvale kopyalanıp GPU dokusu yenilenir. Diğer biyomların zeminleri açılış ekranındayken önceden boyanır, açılış süresi değişmez.
- [ ] Elle boyanmış arka plan görselleri eklenirse kodla üretilenlerin yerini alacak.

## Aksiyon ve çeşitlilik (Aşama 1)

Oyuncu geri bildirimi: oynanış bir süre sonra "hep aynı oda" gibi hissettiriyordu. Teşhis: her oda aynı görev ve aynı yuvarlak arena, odalar 60–100 sn sürüyordu, güçlerin çoğu sayısal, hareket kabiliyeti büyümüyor, ustalık anı yok. Üç aşamalı plan: (1) aksiyon paketi, (2) Ruh Biçimleri (avda büyüyen hareket yetenekleri), (3) Ruh Ataları ve hikâye.

- **Tempo:** sıradan düşmanların canı %28 az, dalga bütçesi %30 fazla, yeni dalga 3 düşman kalınca ya da 9 sn'de gelir, doğma süresi kısaldı. Odalar 60–100 sn'den 25–55 sn'ye indi.
- **Coşku göstergesi** (can çubuğunun altında): öldürme (+8, elit +14, muhafız +30), isabet (+0.8) ve Mükemmel Sekme (+25) doldurur; 2.5 sn boş kalınca boşalır, hasar almak 35 düşürür. Dolunca 7 sn **Coşku**: saldırı hızı ×1.35, yürüme ×1.25, sekme ×1.15, mızraklar +1 delip geçer, tilki altın parlar, müzik tam yoğunluğa çıkar; bu sırada öldürmeler süreyi uzatır.
- **Mükemmel Sekme:** bir mermi, atılma, çığlık halkası, patlama ya da fitil çarpmadan hemen önce sekersen zaman yavaşlar, yakındaki mermiler söner, 3 bedava mızrak fırlar, 0.45 sn hasarsızlık ve Coşku +25. İlk seferde ve 2. odada ipucu çıkar.
- **Oda görevleri** (Savaş, Elit ve Lanetli kapılarında %70 şansla, kapı kartında yazar):
  - Kuşatma: 25 sn boyunca kenarlardan durmadan düşman gelir; süre bitince kalanlar dağılır (+8 parça).
  - Av: kaçan altın bir ruh; 20 sn içinde yakalarsan +12 parça, %15 can, büyük Coşku. Yakalanmazsa kaçar.
  - Fener: ortada canı olan bir Ruh Feneri; yakın dövüşçülerin yarısı fenere saldırır. Ayakta kalırsa %25 can ve +6 parça.
  - Tuzaklı Geçit: merkezden dönen 2 (15. odadan sonra 3) ışık kolu (üstünden sekilir; değince itilirsin) ve ayağının altında beliren tuzaklar (+10 parça).
- **Arena şekilleri** (%65 şansla): Sütunlu salon (7 taş sütun; mızrakları ve mermileri keser, siper olur), Yarık halkası (dört köprülü boşluk halkası; yürüyerek geçilmez, sekerek atlanır; düşersen son durduğun yere dönersin), Çöken merkez (6. saniyeden sonra ortası büyüyen bir uçuruma döner; önce çatlaklar uyarır). Düşmanlar boşluğa giremez (uçanlar hariç).
- Deneme Odası'nda görev ve arena da seçilebilir. Denge botu kapılardaki görevleri gerçek oyundaki gibi alır, ışık kollarından ve uçurumdan kaçınır; yükseltmeli bot medyan 7–15. oda (öncekiyle benzer).

## Ruh Ormanı (30. oda ve sonrası)

Dördüncü biyom. Yosunlu taş zemin, kenardan sürünen kökler, çimen öbekleri ve düşmüş yapraklar; mum yerine üstünde parlayan mantarlar olan kütükler; altın-yeşil ruh ateşi; ateş böcekleri ve güçlü ışık hüzmeleri. Ortamda kuş cıvıltısı, baykuş, yaprak hışırtısı ve uzak çanlar.

| Düşman | Davranış | Model |
|---|---|---|
| Diken Sarmaşığı | Köklü; nişan alıp yelpaze halinde 3 diken atar (elitte 5). Uzak durursan toprağa batar ve yakınında yeniden çıkar. | Kodla: kök tümseği, dört eklemli diken saplı gövde, ateş ederken açılan çiçek başı |
| Spor Mantarı | Yavaş yürür; yaklaşınca 3 sn kalan zehirli spor bulutu bırakır, ölünce daha büyüğünü. Yakın dövüşü cezalandırır. | Kodla: kök ayaklı gövde, parlayan benekli şapka |
| Gölge Kurt | Çift gelir, ulur; tilkinin etrafında döner, sonra düz bir hatta atılır. | Tilki modelinin koyu mor kürklü kopyası, kırmızı gözler |

**Kadim Ağaç** (30., 40., 50. … oda muhafızı; diğer muhafız odaları sırayla devam eder): yavaşça yürür. Kök hatları (oyuncuya doğru 3, öfkede 5 sıra; toprak çatlar, kökler sırayla fırlar), yaprak sarmalı (dönerek açılan 3–4 halka), Diken Sarmaşığı çağırma. Kendi müzik teması (88 bpm, koro ve tok davullar), giriş unvanı "Ormanın Kalbi", başarımı "Kökleri Kesen" (Yosun kürkü). Model kodla: kök bacaklar, dal kollar, parlayan yüz, çiçekli taç; yürüme, kolları kaldırıp yere vurma, devrilme.

## Sahne yönetimi

- **Muhafız girişi:** muhafızın kapısı açılınca savaş durur; siyah şeritler iner, kamera kapıya kayıp yakınlaşır, kapıdan mor kıvılcımlar dökülür ve yükselen bir uğultu duyulur. Muhafız çıktığı anda kükrer (saldırı kareleri), yıldız patlaması, sarsıntı, titreşim; alt bas düşüşü + gong + bakır akoru. Ekranın alt üçte birinde adı ve unvanı belirir (Kemik Lordu — Mezarların Efendisi, Gölge Atlı — Gecenin Süvarisi, Yas Kraliçesi — Yasın Sesi, Kan Kardinali — Kanın Rahibi), her biri kendi renginde parlar. Sonra kamera tilkiye döner ve savaş başlar. Toplam ~3,5 sn; açıklamadan sonra dokunmak geri kalanı atlar.
- **Müzikle nabız:** müziğin bas davulu ve trampeti zamanlanırken kaydedilir; mangal alevleri ve ışıkları, zemin mührü ve dönen rün çemberi her vuruşta ses çıkışının gecikmesi hesaba katılarak parlar. "Hareketi azalt" açıkken etki %40.
- **Sarsıntı:** beyaz gürültü yerine üç katmanlı yumuşak dalga; büyük vuruşlar titremek yerine yuvarlanır, küçük sarsıntılar daha hafif.

## Ses tasarımı

Tamamı Web Audio ile kodda üretilir (dosya yok).
- **Sinyal yolu:** efekt, müzik ve ortam kanalları → ana kanal → alçak geçiren "boğuklaştırma" filtresi → kompresör → kazanç → sınırlayıcı → yumuşak kırpıcı. Müzik ve ortam ayrı bir "duck" kazancından geçer.
- **Yankı:** kodla üretilen 2,9 sn'lik zindan yankısı (erken yansımalar + kararan kuyruk); her ses kendi oranında gönderir (vuruş az, Ay Sıçrayışı ve çanlar çok).
- **Stereo:** vuruş, ölüm, patlama ve çığlık sesleri kaynağın ekrandaki yatay konumundan gelir.
- **Sinematik tepkiler:** büyük patlama, iniş, Söküm ve hasar müziği kısa süre kısar; büyük patlama ve hasar dünyayı bir an boğuklaştırır, ağır çekimde tüm ses derinden duyulur.
- **Efektler katmanlıdır:** fırlatma (hava süpürmesi + cam tını + parlak çınlama), vuruş (tık + gövde + metalik çan), sekme (yumuşak hava + ruh çanı), Delici (yükselen testere + ışın + çan), Söküm (art arda yırtılma + derin darbe), Ay Sıçrayışı (yükselen akor ve parıltı), iniş ve patlamalar (alt bas düşüşü + gürültü + kıvılcım + kemik kırılması), hasar (boğuk darbe + iki kalp atışı), ödüller FM çanlarıyla. Her düşmanın kendi ölüm sesi + ortak kemik kırılması.
- **Ortam (biyom başına):** nefes alan akor pedi (yavaş filtre dalgası) ve rüzgâr; rastgele olaylar. Cadı zindanı: damla, uzak çan, fısıltı. Buz mezarlığı: kristal çınlama, rüzgâr esintisi. Kan katedrali: kalp atışı, hırıltı, damla. Savaşta mangal çıtırtıları. Biyom değişince 4 sn'de çapraz geçiş.
- **Dinamik müzik:** her ölçüde akor pedi, yankılı (noktalı sekizlik gecikme) pluck arpej, savaşta bas, bas davul, yoğunluk arttıkça trampet ve hi-hat. Yoğunluk düşman sayısına göre yumuşakça değişir. Muhafızlarda tam yoğunluk, Lord / Kardinal / Kraliçe'de "aah" korosu, Lord / Atlı / Kardinal'de tok davullar.
- **Seviyeler çevrimdışı ölçülerek ayarlandı:** sık sesler (vuruş, ölüm) ~0,3 tepe, büyük vuruşlar 0,75–0,93, müzik ortalaması ~0,06.

**Önerilen sıra:** Aşama 2 (en çok "vay" etkisi, en az risk) → Aşama 1'in kamera ve fizik maddeleri → Aşama 3. Her aşamada grafik kalitesi ayarına bağlı kademeler ve telefonda 60 fps hedefi korunur.

## 12. Sıradaki adımlar (yol haritası)

Tamamlananlar: düşman başına ölüm sesleri, 6 kozmetik mızrak izi, Buz Hortlağı, Kan Yarasası, dördüncü muhafız Kan Kardinali (kendi müzik teması ve 'Kanı Durduran' başarımı), üç biyom (Cadı Zindanı, Buz Mezarlığı, Kan Katedrali), av sonu istatistikleri ve ölüm nedeni, sabit joystick ve sol el modu, muhafız müzik temaları (Lord: ağır yürüyüş, Atlı: dörtnala, Kraliçe: tam-ton ağıt; öfkede hızlanır), 12 başarım ve pelerin renkleri, 15+ oda dengesi, Ruh Sandığı ve Mimik, Kan Sunağı, muhafız ikinci formu, Kalkanlı Şövalye ve Kemik Bombası, grafik kalitesi ayarı (otomatik / yüksek / düşük), Günün Avı sonuç paylaşımı, akıllı bot ile denge ayarı, mızrakçıya özel efsanevi kartlar, Günün Avı (tohumlu), son avlar listesi, bot ile denge ölçümü ve ayarı, 4 mızrakçı, Unutuş Ritüeli (güç silme), Yükselmiş muhafızlar, PWA (ana ekrana ekleme + çevrimdışı önbellek), Ruh Tüccarı kapısı, üçüncü muhafız Yas Kraliçesi, üretken müzik (dron + minör pentatonik arpej; savaşta davul, muhafızda hızlanır), Ay Sıçrayışı (R), kapı seçimi (Savaş/Elit/Lanetli/Ruh Pınarı), elit düşmanlar, ikinci muhafız Gölge Atlı, 5 efsanevi sinerji, vuruş durması (hit-stop) ve titreşim.

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
| **Yıldız parlaması** (çizgi film "ding") | Delici Mızrak, Ay Sıçrayışı inişi, İniş Şoku, 5+ mızraklı Söküm ile ölüm; kritik öldürmelerin %35'i; elitlerin %50'si | Düşman öldüğü yerde parçalanır; aynı noktada "ding" sesiyle minik bir yıldız belirir, ardından ekranı boydan boya kesen dev bir parlama: yatay ışık şeridi, dönen 8 ışın, beyaz ve renkli halkalar, ekranın ortasına doğru mercek yansımaları. |
| Vuruş yıldızı | Her mızrak isabetinde | Çarpma noktasında anlık beyaz 4 köşeli yıldız (kritikte altın, daha büyük). |
| Söküm ruhları | Söküm kullanılınca | Sökülen mızraklar parlayan ruh izleri olarak oyuncuya akar; oyuncudan büyük bir şok halkası yayılır. 3+ öldürmede siyah-beyaz darbe karesi, hız çizgileri ve parlama. |
| Ruh parçası mıknatısı | Her öldürmede | Altın elmaslar sekerek düşer, sonra oyuncuya çekilir; toplanınca tını sesi (seri arttıkça incelir) ve sayaç zıplar. |
| Seri övgüsü | 10, 20, 35, 50, 75, 100 seri | Ekranın ortasında eğik altın yazı (Harika, Müthiş, Efsane, Durdurulamaz, Tanrısal, Ruh uyandı) ve parlama. |
| Son vuruş | Odanın son düşmanı | Ağır çekim, zoom ve son düşmanın yerinde dev parlama. |
| Darbe karesi | Muhafız ölümü, çoklu Söküm | Bir anlığına renkler tersine döner (anime "impact frame"). |
| Hız çizgileri | Ay Sıçrayışı uçuşu, muhafız ölümü | Ekran kenarlarından merkeze doğru beyaz çizgiler. |
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
- **Kamera:** Bakış yönüne hafif önden bakar; büyük öldürmelerde ve Ay Sıçrayışı inişinde kısa bir zoom vuruşu yapar.
- **Ekran sonrası:** Vinyet, film greni, hasar alınca ve can %30'un altındayken kırmızı kenar.
- **Arayüz:** İkonlu yetenek düğmeleri (dairesel bekleme süresi), gecikmeli (beyaz iz bırakan) can barı, muhafız barı ve sinematik siyah şeritli giriş, seri sayacı, ikonlu ve nadirliğe göre renklenen kartlar.

## 15. Av sonu istatistikleri

Ölüm ekranında: seni deviren düşman ya da saldırı ("Seni deviren: Kemik Dev (elit)", "Çığlık dalgası", "Ruh Okçusu mermisi"...) ve en çok hasar veren 6 kaynağın yüzdelik çubukları (Mızrak, Söküm, Delici Mızrak, Ay Sıçrayışı, İniş Şoku, Ruh İzi, Ruh Yavrusu, Kemik Bombası).

## 16. Dokunmatik seçenekler

Duraklat menüsünde: **Joystick: serbest / sabit** (sabitte taban ekranın alt köşesinde durur ve hep görünür) ve **Butonlar: sağda / solda** (sol el modu; sabit joystick bu modda sağ alta geçer).

Ayrıca: **Hassasiyet: normal / yüksek / düşük** (tam eğim için gereken parmak çekişi 56 / 40 / 72 piksel), **Buton boyu: normal / büyük** (yetenek düğmeleri %22 büyür, köşeye yaslı kalır), **Titreşim: açık / kapalı**. Seçenekler iki sütunlu düzende telefona sığar.

## 16b. Deneme Odası

Başlangıç ekranındaki **Deneme Odası** ile ava doğrudan bir biyomdan (Cadı Zindanı 1, Buz Mezarlığı 11, Kan Katedrali 21, Ruh Ormanı 31) ya da bir muhafızın karşısından (Kemik Lordu 5, Gölge Atlı 10, Yas Kraliçesi 15, Kan Kardinali 20, Kadim Ağaç 30) başlanır. **Güçler: odaya göre / bol / yok** (odaya göre ≈ o odaya kadar seçilecek kadar rastgele güç; bolda efsanevi sinerjiler de eklenir) ve **Ölümsüz: açık / kapalı**. Deneme avları en iyi odayı, ruh parçalarını, son avlar listesini ve başarımları etkilemez.

## 17. Telefona kurulum (PWA)

`game/` klasörü herhangi bir statik sunucuda (ör. GitHub Pages) yayınlanınca tarayıcının "Ana ekrana ekle" seçeneğiyle tam ekran uygulama gibi kurulur; `sw.js` dosyaları önbelleğe alır, oyun çevrimdışı açılır. Claude artifact sürümünde servis çalışanı devre dışıdır.

## 18. Performans

Duraklat menüsünde **Grafik: otomatik / yüksek / düşük**. **Kare hızı: 60 / 30 (pil)**: 30'da her ikinci ekran karesi atlanır (telefon daha az ısınır, pil daha uzun gider); otomatik kalite eşiği bu modda 45 ms'dir. Otomatikte savaş sırasında 3 sn boyunca ortalama kare süresi 26 ms'yi (≈38 fps) aşarsa düşük kaliteye geçer. Düşük kalite: piksel yoğunluğu en fazla 1.25, uzak adalar, sis ve film greni kapalı, sıradan düşman dumanı kapalı, duman sınırı 130 parçacık.

## 19. Teknik

- Tek dosya HTML5 Canvas + saf JavaScript, kütüphane yok.
- Dünya: 820 birim yarıçaplı dairesel arena, kamera oyuncuyu takip eder, zoom ekran boyutuna göre ölçeklenir.
- Oyuncu durum makinesi: `idle → windup → (hop | post → idle)`, `qcast` aynı akışı kullanır; R için `rise → fling → idle`.
- Vuruş hissi: Söküm öldürmesi, Ay Sıçrayışı inişi ve muhafız ölümünde kısa zaman yavaşlaması (hit-stop) ve `navigator.vibrate` (destekleyen cihazlarda).
