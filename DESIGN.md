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
   | Ruh Tüccarı | Savaş yok | Bu avın ruh parçalarıyla alışveriş: 3 güç (Sıradan 15, Nadir 25, Destansı 40, Efsanevi 55), Ruh İksiri (%50 can, 12), Kehanet Kartı (+1 yeniden çekme, 10). Unutuş Ritüeli (15): bir gücün bir seviyesini siler; tüm istatistikler baştan hesaplanır. Harcanan parçalar kalıcı birikime eklenmez. |

4. Her 5. oda **Muhafız** odası; muhafızlar sırayla Kemik Lordu, Gölge Atlı ve Yas Kraliçesi.
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

## 7. Kalıcı ilerleme (Ruh Sunağı)

| Güç | Etki | Seviye |
|---|---|---|
| Ruh Kalkanı | +12 başlangıç canı | 5 |
| Kadim Uç | +%6 mızrak hasarı | 5 |
| Ruh Adımı | +%6 sekme mesafesi | 3 |
| Kehanet | +1 yeniden çekme | 3 |

Kayıt tarayıcının yerel depolamasında tutulur.

## 8. Sıradaki adımlar (yol haritası)

Tamamlananlar: 4 mızrakçı, Unutuş Ritüeli (güç silme), Yükselmiş muhafızlar, PWA (ana ekrana ekleme + çevrimdışı önbellek), Ruh Tüccarı kapısı, üçüncü muhafız Yas Kraliçesi, üretken müzik (dron + minör pentatonik arpej; savaşta davul, muhafızda hızlanır), Kader Çağrısı (R), kapı seçimi (Savaş/Elit/Lanetli/Ruh Pınarı), elit düşmanlar, ikinci muhafız Gölge Atlı, 5 efsanevi sinerji, vuruş durması (hit-stop) ve titreşim.

Sıradakiler:
1. Dengeleme için oda başına istatistik kaydı ve zorluk eğrisi ayarı.
2. Mızrakçılara özel efsanevi kartlar.
3. Günlük meydan okuma (sabit tohumlu av).

## 9. Oyun hissi (Metal Slug esinli)

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

## 10. Görsel yön

Tema: **ruhani mezar arenası**. Karanlık taş zemin, turkuaz ruh ışığı, yıpranmış altın süslemeler.

- **Işık:** Sahne yarı çözünürlüklü bir ışık haritasıyla karartılır; oyuncu, mızraklar, mermiler, meşaleler, patlamalar ve doğma çemberleri bu karanlığı oyar. Ardından gözler, mızrak uçları, alevler ve mermiler toplamalı (additive) parıltıyla karanlığın üstüne çizilir.
- **Zemin:** Oyun başında bir kez çizilip önbelleğe alınır: halkalar halinde döşenmiş taşlar, çatlaklar, yosun, ortada üç mızraklı rün mührü, kenarda blok duvar ve 10 turkuaz meşale.
- **Karakterler:** 3/4 bakış; her varlığın yerde gölgesi var ve derinlik sırasına göre çizilir. Mızrakçı pelerinli, başlıklı; sekerken havaya kalkar, inişte ezilir, pelerini harekete göre savrulur. Düşmanlar vuruşta esner ve beyaz yanar, yerden yükselerek doğar.
- **Okunabilirlik:** Tehlike bölgeleri dolan kırmızı/mor şeritlerle; sökümle ölecek düşmanlar altın dönen halkayla; elitler taç ve altın ışıltıyla; kalkanlar mavi baloncukla gösterilir.
- **Kamera:** Bakış yönüne hafif önden bakar; büyük öldürmelerde ve Kader inişinde kısa bir zoom vuruşu yapar.
- **Ekran sonrası:** Vinyet, film greni, hasar alınca ve can %30'un altındayken kırmızı kenar.
- **Arayüz:** İkonlu yetenek düğmeleri (dairesel bekleme süresi), gecikmeli (beyaz iz bırakan) can barı, muhafız barı ve sinematik siyah şeritli giriş, seri sayacı, ikonlu ve nadirliğe göre renklenen kartlar.

## 11. Telefona kurulum (PWA)

`game/` klasörü herhangi bir statik sunucuda (ör. GitHub Pages) yayınlanınca tarayıcının "Ana ekrana ekle" seçeneğiyle tam ekran uygulama gibi kurulur; `sw.js` dosyaları önbelleğe alır, oyun çevrimdışı açılır. Claude artifact sürümünde servis çalışanı devre dışıdır.

## 12. Teknik

- Tek dosya HTML5 Canvas + saf JavaScript, kütüphane yok.
- Dünya: 820 birim yarıçaplı dairesel arena, kamera oyuncuyu takip eder, zoom ekran boyutuna göre ölçeklenir.
- Oyuncu durum makinesi: `idle → windup → (hop | post → idle)`, `qcast` aynı akışı kullanır; R için `rise → fling → idle`.
- Vuruş hissi: Söküm öldürmesi, Kader inişi ve muhafız ölümünde kısa zaman yavaşlaması (hit-stop) ve `navigator.vibrate` (destekleyen cihazlarda).
