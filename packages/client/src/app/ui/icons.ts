/**
 * Arayüz ikonları (GDD §11): 24×24 tek renkli SVG siluetleri (currentColor). BFME2 ikonlarının
 * yerine low-poly dile uygun, okunaklı semboller.
 */
const P: Record<string, string> = {
  sword: '<path d="M18 2l4 0 0 4-9 9-2-2zM6 14l4 4-2 2-1-1-2 2-2-2 2-2-1-1z"/>',
  spear: '<path d="M20 2l2 2-2.5 1L9 15.5 8.5 15 19 4.5zM3 13a6 7 0 0 0 8 8l-3-5z"/>',
  bow: '<path d="M5 3c9 2 14 7 16 16" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 3l16 16M3 9l6-6M15 21l6-6" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  tower: '<path d="M7 22V9H5V3h3v2h2V3h4v2h2V3h3v6h-2v13zM11 14h2v3h-2z"/>',
  hall: '<path d="M2 11l10-7 10 7v2H2zM4 13h16v9H4zM10 16h4v6h-4z"/>',
  anvil: '<path d="M3 7h13c0 3 2 4 5 4v2h-6l-2 3h2v3H7v-3h2l-2-3c-2 0-4-2-4-6z"/>',
  catapult: '<path d="M3 20h18v2H3zM6 16h12v3H6zM8 16l8-11 2 1-7 10zM16 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>',
  up: '<path d="M12 2l8 9h-5v5H9v-5H4zM6 18h12v2H6zM8 21h8v1H8z"/>',
  wolf: '<path d="M2 18l3-6 3-2 2-5 2 3h3l3-4 1 5 3 3-2 1-3-1-2 3 1 3h-2l-2-3-4 1-2 3H6l1-3-3 1z"/>',
  club: '<path d="M14 2a5 5 0 0 1 6 6l-3 3-6-6zM10 6l6 6-9 9-3 1-1-1 1-3zM18 3l1-1 1 2zM21 7l1 1-2 0z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  blade: '<path d="M18 2l4 0 0 4-10 10-3-3zM5 15l4 4-2 2-1-1-2 2-2-2 2-2-1-1z"/>',
  armor: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 2 4 0-3-1-6 1-9z"/>',
  heal: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
  leaf: '<path d="M12 2c3 4 6 8 6 12a6 6 0 0 1-12 0c0-4 3-8 6-12z"/>',
  rally: '<path d="M5 2h2v20H5zM8 3h11l-3 4 3 4H8z"/>',
  volley:
    '<path d="M3 21l7-7M7 21l7-7M11 21l7-7" stroke="currentColor" stroke-width="2"/><path d="M10 14l1-5 4 3zM14 14l1-5 4 3zM18 14l1-5 4 3z"/>',
  horse: '<path d="M4 20l3-7 2-1 1-4 4-3 3 1 3 4-2 1-2-2-2 3 1 3-2 1v4h-2v-4l-3-1-2 5z"/>',
  ghost:
    '<path d="M12 2a7 7 0 0 0-7 7v11l2-2 2 2 2-2 2 2 2-2 2 2 2-2V9a7 7 0 0 0-7-7zM9 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>',
  hero: '<path d="M12 2l2 3h-4zM11 5h2v9h-2zM8 14h8v2h-3v6h-2v-6H8z"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5zM5 20h14v2H5z"/>',
  castle: '<path d="M2 22V10h3V7h2v3h2V4h2v2h2V4h2v6h2V7h2v3h3v12h-8v-5a2 2 0 0 0-4 0v5z"/>',
  wall: '<path d="M2 20V9h3v3h3V9h3v3h2V9h3v3h3V9h3v11z"/>',
  slits: '<path d="M4 3h16v19H4zM8 7v6h2V7zM14 7v6h2V7z" fill-rule="evenodd"/>',
  coin: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm-1 2h2v8h-2z"/>',
  banner: '<path d="M6 2h2v20H6zM9 3h10v10l-5-3-5 3z"/>',
  repair: '<path d="M14 3a5 5 0 0 0-4 7l-7 7 3 3 7-7a5 5 0 0 0 7-4l-3 1-2-2 1-3a5 5 0 0 0-2 0z"/>',
  lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h2v12H5V10zm2 0h6V7a3 3 0 0 0-6 0z"/>',
  heart: '<path d="M12 21l-9-9a5 5 0 0 1 9-6 5 5 0 0 1 9 6z"/>',
  power: '<path d="M12 2l3 7h7l-6 4 2 8-6-5-6 5 2-8-6-4h7z"/>',
  army: '<path d="M4 20l2-9h3l1 9zM10 20l2-12h3l1 12zM16 20l2-9h3l1 9z"/>',
  help: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 14v2h2v-2zm1-10a4 4 0 0 0-4 4h2a2 2 0 1 1 3 1.7c-1 .6-2 1.4-2 3.3h2c0-1 .4-1.4 1.2-2A4 4 0 0 0 12 6z"/>',
  sound:
    '<path d="M3 9h4l5-5v16l-5-5H3zM15 8a5 5 0 0 1 0 8M17.5 5.5a8.5 8.5 0 0 1 0 13" stroke="currentColor" stroke-width="1.6" fill-rule="evenodd"/>',
  eye: '<path d="M12 5c5 0 9 4 10 7-1 3-5 7-10 7S3 15 2 12c1-3 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
};

export const icon = (name: string): string =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P[name] ?? P.power}</svg>`;
