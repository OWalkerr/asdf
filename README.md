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
`?debug=0` tweak panelini gizler, `?nosab` SharedArrayBuffer yerine postMessage yedek yolunu zorlar. Debug panelindeki "Koridor/spawn katmanı" düşman rotalarını gösterir.

## Paketler
| Paket | İçerik |
|---|---|
| `packages/shared` | Q16.16 fixed-point matematik, deterministik RNG, durum hash'i, harita şeması + Helm's Deep verisi |
| `packages/sim` | bitECS deterministik simülasyon: komut kuyruğu, sistemler, snapshot yazıcı (three.js import edemez) |
| `packages/client` | Renderer, RTS kamera, toon shader, harita oluşturucular, BVH zemin/slot seçimi, sim worker köprüsü, debug paneli |

## Kamera kontrolleri
WASD / ok tuşları / ekran kenarı: kaydır · Orta tuş sürükle: kaydır · Q/E veya Alt+sol sürükle: döndür ·
Tekerlek: imlece doğru zoom · Space/Home: başlangıç görünümü.

## Birim kontrolleri
Sol tık: tabur seç (Shift ile ekle/çıkar) · Sol sürükle: kutu seçimi · Sağ tık: seçili taburları yürüt ·
Esc: seçimi temizle · Asker olmayan yere sol tık: inşa slotu seç. Taburlar akış alanıyla (flow field)
engellerin etrafından dolaşır, dar geçitte formasyonu daraltır. Debug panelinde "Nav ızgarası sınırı",
sim hızı ve düşman dalgası / stres testi düğmeleri var.
