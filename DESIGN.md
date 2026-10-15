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

## 3. Çekirdek döngü

1. Odaya gir → 2–4 dalga düşman (dalga, kalan düşman ≤2 olunca ya da 16 sn sonra gelir).
2. Oda temizlenince %15 can yenilenir, 3 güç kartından birini seçersin (yeniden çekme hakkı Ruh Sunağı'ndan).
3. Sonra sıradaki **kapıyı** seçersin (her zaman Savaş + rastgele 2 seçenek):

   | Kapı | Risk | Ödül |
   |---|---|---|
   | Savaş Odası | Düşük | 1 güç |
   | Elit Oda | Orta: düşmanların %35'i elit | Nadir ağırlıklı güçler, +5 ruh parçası |
   | Lanetli Oda | Yüksek: %60 elit, düşmanlar %15 hızlı | 2 güç seçimi, +8 ruh parçası |
   | Ruh Pınarı | Savaş yok | %40 can, +1 yeniden çekme; güç yok |

4. Her 5. oda **Muhafız** odası; muhafızlar sırayla Kemik Lordu ve Gölge Atlı.
5. Ölünce topladığın **ruh parçaları** kalıcı olarak saklanır; Ruh Sunağı'ndan kalıcı güç alırsın.
6. Oyun sonsuz; amaç en iyi oda rekorunu kırmak.

## 4. Düşmanlar

| Düşman | Davranış | Karşı strateji |
|---|---|---|
| Hortlak | Doğrudan kovalar | Geriye sekerek kite |
| Ateş Ruhu | Hızlı, zikzak, üçlü sürü | Çatallı/delici mızrak, İniş Şoku |
| Okçu | 320 birim mesafe korur, nişan alıp atış yapar (sarı kenar = nişan) | Yana sekerek mermiden kaç |
| Dev | Yavaş; kırmızı çizgiyle işaret verip hücum eder | Çizginin dışına sek |
| Tükürgen | Durur, çevresine halka halinde mermi saçar (çekirdek dolunca) | Halkalar arasındaki boşluğa sek |
| **Kemik Lordu** (5., 15., 25. oda) | Hücum, mermi novası, çağırma; %50 canın altında öfke (çift hücum, yoğun nova) | Mızrak biriktir, Söküm ile büyük hasar |
| **Gölge Atlı** (10., 20. oda) | Arka arkaya 3–4 dörtnala hücum ve arkasında yakan mor iz; çift kollu spiral mermi; yelpaze şeklinde mızrak hatları (önce çizgiyle uyarır) | Hatların arasına sek, Kader Çağrısı ile sersemlet |

**Elit düşmanlar** (altın kesikli halka): can ×1.8, hasar ×1.2 ve bir özellik: *Kalkanlı* (canın %40'ı kadar mavi kalkan), *Hızlı* (+%35 hız), *Patlayan* (ölünce 8 mermi saçar). Elit başına 3 ruh parçası.

Zorluk: oda başına düşman canı +%20, hasar +%8, hız +%1.5. Altın halka = düşman sökümle ölür (Kalista'daki öldürme göstergesi gibi).

## 5. Güçler (26 adet, 3 nadirlik)

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

## 6. Kalıcı ilerleme (Ruh Sunağı)

| Güç | Etki | Seviye |
|---|---|---|
| Ruh Kalkanı | +12 başlangıç canı | 5 |
| Kadim Uç | +%6 mızrak hasarı | 5 |
| Ruh Adımı | +%6 sekme mesafesi | 3 |
| Kehanet | +1 yeniden çekme | 3 |

Kayıt tarayıcının yerel depolamasında tutulur.

## 7. Sıradaki adımlar (yol haritası)

Tamamlananlar: Kader Çağrısı (R), kapı seçimi (Savaş/Elit/Lanetli/Ruh Pınarı), elit düşmanlar, ikinci muhafız Gölge Atlı, 5 efsanevi sinerji, vuruş durması (hit-stop) ve titreşim.

Sıradakiler:
1. **Dükkan kapısı:** av içi para birimi ile güç satın alma / güç silme.
2. **Üçüncü muhafız** ve 15. odadan sonra muhafızların birleşik saldırı desenleri.
3. **Karakter seçimi:** farklı başlangıç gücüyle 2–3 mızrakçı varyantı.
4. **Ses:** sentez efektlerine basit bir müzik döngüsü.
5. **PWA:** ana ekrana eklenip çevrimdışı oynanabilmesi.
6. Dengeleme için oda başına istatistik kaydı.

## 8. Teknik

- Tek dosya HTML5 Canvas + saf JavaScript, kütüphane yok.
- Dünya: 820 birim yarıçaplı dairesel arena, kamera oyuncuyu takip eder, zoom ekran boyutuna göre ölçeklenir.
- Oyuncu durum makinesi: `idle → windup → (hop | post → idle)`, `qcast` aynı akışı kullanır; R için `rise → fling → idle`.
- Vuruş hissi: Söküm öldürmesi, Kader inişi ve muhafız ölümünde kısa zaman yavaşlaması (hit-stop) ve `navigator.vibrate` (destekleyen cihazlarda).
