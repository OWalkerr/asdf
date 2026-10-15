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
  staff: '<path d="M15 2l2 2-1 1 1 3-2 1-1-3-9 15-2-1L12 5l-1-1 2-2z"/><circle cx="16" cy="4" r="2.2"/>',
  blast: '<path d="M12 2l2 6 6-3-3 6 6 2-6 2 3 6-6-3-2 6-2-6-6 3 3-6-6-2 6-2-3-6 6 3z"/>',
  ladder: '<path d="M7 2h2v3h6V2h2v20h-2v-3H9v3H7zm2 5v3h6V7zm0 5v3h6v-3z"/>',
  wheat:
    '<path d="M11 22V12h2v10zM12 2c2 2 2 4 0 6-2-2-2-4 0-6zM7 6c2.5.5 4 2 4 4.5C8.5 10 7 8.5 7 6zm10 0c0 2.5-1.5 4-4 4.5 0-2.5 1.5-4 4-4.5zM7 11c2.5.5 4 2 4 4.5C8.5 15 7 13.5 7 11zm10 0c0 2.5-1.5 4-4 4.5 0-2.5 1.5-4 4-4.5z"/>',
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
  sun: '<circle cx="12" cy="12" r="5"/><path d="M11 1h2v4h-2zM11 19h2v4h-2zM1 11h4v2H1zM19 11h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8-1.4 1.4zM15.6 17l1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4l2.8-2.8 1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4-2.8 2.8z"/>',
  quake:
    '<path d="M2 14h7l2-3 2 4 2-3 1 2h6v8H2zM11 15l-1 3 2 1-1 3h1l1-3-2-1 1-3z" fill-rule="evenodd"/><path d="M5 10l2-3 2 2zM15 9l3-4 2 4z"/>',
  eagle:
    '<path d="M12 6c1 0 2 1 2 2l8-3-3 5h2l-4 3h-3l1 3-1 4-2-2-2 2-1-4 1-3H7l-4-3h2L2 5l8 3c0-1 1-2 2-2z"/>',
  wave: '<path d="M2 15c3 0 4-6 9-6 3 0 4 2 4 4-1-1-3-1-4 0 2 0 4 1 5 3 2-1 4-1 6-1v7H2z"/>',
  charge:
    '<path d="M3 2l7 7-1.5 1.5L2 4.5V2zM21 2v2.5l-6.5 6L13 9l7-7zM8.5 12l3.5 3.5-5 5 1 1-1.5 1.5-4-4L4 17.5l1 1zM15.5 12l5 5 1-1 1.5 1.5-4 4L17.5 22l1-1-5-5z"/>',
  eye: '<path d="M12 5c5 0 9 4 10 7-1 3-5 7-10 7S3 15 2 12c1-3 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
};

export const icon = (name: string): string =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P[name] ?? P.power}</svg>`;

/**
 * BFME2 tarzı renkli ikon: temaya göre renkli degrade disk, üstünde açık renkten temaya doğru
 * degrade dolgulu, koyu konturlu sembol ve üstten parlama. Güçler, yetenekler, yükseltmeler ve
 * bina düğmelerinde kullanılır.
 */
const THEME: Record<string, [string, string, string]> = {
  // [disk açık, disk koyu, sembol rengi]
  heal: ['#3fa36a', '#0e3320', '#d8ffe4'],
  leaf: ['#5fae5a', '#173a1a', '#f2ffd8'],
  rally: ['#c9782e', '#3e1d08', '#ffe9c0'],
  volley: ['#b89a3a', '#3a2c0c', '#fff3c4'],
  horse: ['#b07a3a', '#3a220c', '#fff0d4'],
  ghost: ['#3fbf8a', '#0b2e22', '#d8fff0'],
  blade: ['#6f8fc0', '#121e36', '#eef4ff'],
  armor: ['#7d8a9a', '#1a2028', '#f0f4f8'],
  flame: ['#e0662a', '#3a1206', '#ffe2a0'],
  blast: ['#8fb8ff', '#16224a', '#ffffff'],
  power: ['#b48cff', '#22124a', '#fff4ff'],
  staff: ['#d8dde6', '#2a2e38', '#ffffff'],
  bow: ['#7ea64a', '#1e2c10', '#f4ffd8'],
  crown: ['#d6b04a', '#3a2a08', '#fff6cc'],
  hero: ['#c9a23a', '#3a2a08', '#fff6cc'],
  wall: ['#9a8e7a', '#2a241a', '#f4ecdc'],
  slits: ['#8a7a5a', '#241c10', '#f4ecdc'],
  catapult: ['#9a6a3a', '#2a1808', '#ffe8c8'],
  banner: ['#4fa080', '#0e2a20', '#e8fff4'],
  coin: ['#e0b43a', '#3a2a06', '#fff6c8'],
  wheat: ['#d0a83a', '#3a2c08', '#fff4c0'],
  up: ['#5aa0d0', '#0e2438', '#e8f6ff'],
  repair: ['#9a9aa6', '#22222a', '#f4f4fa'],
  tower: ['#8a96a8', '#1c2230', '#f2f6fc'],
  hall: ['#a07a50', '#2a1a0c', '#fff0dc'],
  anvil: ['#7a7f88', '#1a1c20', '#f0f2f6'],
  spear: ['#8a9ab0', '#1c2230', '#f2f6fc'],
  sword: ['#8a9ab0', '#1c2230', '#f2f6fc'],
  eye: ['#d04a3a', '#3a0c08', '#ffd8c8'],
  club: ['#8a7a6a', '#241c14', '#f4ece0'],
  wolf: ['#8a8a8a', '#202020', '#f4f4f4'],
  ladder: ['#9a7a4a', '#2a1c0c', '#fff0d4'],
  castle: ['#c9a23a', '#3a2a08', '#fff6cc'],
  lock: ['#6a6a6a', '#1a1a1a', '#d0d0d0'],
  sun: ['#ffd25a', '#5a3a06', '#fffbe0'],
  quake: ['#9a7448', '#2a1a0a', '#ffe8c8'],
  eagle: ['#c08a3a', '#2e1a06', '#fff0d0'],
  wave: ['#3a8ad0', '#08203a', '#e0f6ff'],
  charge: ['#d0503a', '#3a0e08', '#ffe0d8'],
  army: ['#8a9ab0', '#1c2230', '#f2f6fc'],
};

export const richIcon = (name: string): string => {
  const [a, b, f] = THEME[name] ?? ['#9a8a6a', '#2a2418', '#fff4dc'];
  const id = `ri-${name}`;
  return `<svg class="rich" viewBox="0 0 24 24" aria-hidden="true"><defs>
    <radialGradient id="${id}-bg" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
    <linearGradient id="${id}-fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${f}"/></linearGradient>
    <radialGradient id="${id}-gl" cx="50%" cy="10%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="12" cy="12" r="11.6" fill="url(#${id}-bg)"/>
  <g transform="translate(3.6 3.6) scale(0.7)" fill="url(#${id}-fg)" color="${f}" stroke="#120c06" stroke-width="0.9" paint-order="stroke" stroke-linejoin="round">${P[name] ?? P.power}</g>
  <ellipse cx="12" cy="7" rx="9" ry="5.5" fill="url(#${id}-gl)"/>
  <circle cx="12" cy="12" r="11.3" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="0.8"/>
</svg>`;
};
