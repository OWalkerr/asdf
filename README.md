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

URL parametreleri: `?webgl` WebGL2 backend'ini zorlar, `?debug=0` tweak panelini gizler.

## Paketler
| Paket | İçerik |
|---|---|
| `packages/shared` | Q16.16 fixed-point matematik, deterministik RNG, durum hash'i |
| `packages/sim` | bitECS deterministik simülasyon (three.js import edemez) |
| `packages/client` | Renderer, RTS kamera, toon shader, harita, debug paneli |

## Kamera kontrolleri
WASD / ok tuşları / ekran kenarı: kaydır · Orta tuş sürükle: kaydır · Q/E veya Alt+sol sürükle: döndür ·
Tekerlek: imlece doğru zoom · Space/Home: başlangıç görünümü. Sağ tık birim emirleri için ayrılmıştır.
