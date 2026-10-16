// One entry per character. glb paths are relative to this folder (copy or symlink the files from assets/).
// anims: { name, n, clip, from, to } plays a GLB clip between fractions from..to; { name, n, pose(H, u) } builds a pose by hand.
const TAIL = ['tailstart', 'tail1', 'tail2', 'tail3'];
const LEGS = ['frontleg', 'R_frontleg', 'backleg', 'R_backleg', 'frontleg0', 'R_frontleg0', 'backleg0', 'R_backleg0', 'frontleg1', 'R_frontleg1', 'backleg1', 'R_backleg1'];
const T2 = 2 * Math.PI;
export const CFG = {
  fox: {
    glb: 'models/frostlight_fox_walk.glb', fw: 288, fh: 216, emissive: .12, emissiveColor: 0xdff4ff, margin: 1.02,
    points: { eye: 'head', tail: 'tail3', back: 'chest' },
    anims: [
      { name: 'idle', n: 12, pose: (H, u) => { H.reset(); TAIL.forEach((t, i) => { H.rotW(t, H.Y, .16 * Math.sin(u * T2 - i * .7)); H.rotW(t, H.X, .05 * Math.sin(u * T2 * 2 - i)); }); H.rotW('head', H.X, -.05 * Math.sin(u * T2)); } },
      { name: 'walk', n: 12, pose: (H, u) => { H.clip(0, u); TAIL.forEach((t, i) => H.rotW(t, H.Y, .1 * Math.sin(u * 2 * T2 - i * .7))); } },
      { name: 'run', n: 10, pose: (H, u) => { H.clip(0, u); H.exaggerate(LEGS, 1.75); const c = Math.sin(u * 2 * T2); H.rotW('Hips', H.X, .07 * c); TAIL.forEach((t, i) => H.rotW(t, H.X, .12 + .08 * Math.sin(u * 2 * T2 - i * .8))); H.rotW('head', H.X, -.06 * c); return Math.abs(Math.cos(u * T2)) * .00012; } },
      { name: 'hop', n: 8, pose: (H, u) => { H.reset(); const s = Math.sin(Math.PI * u), early = Math.max(0, 1 - u * 5), land = Math.max(0, u * 5 - 4);
        H.rotW('Hips', H.X, -.32 * (1 - 2 * u) * s); ['frontleg', 'R_frontleg'].forEach(n => H.rotW(n, H.X, -1.15 * s + .35 * early - .2 * land)); ['backleg', 'R_backleg'].forEach(n => H.rotW(n, H.X, 1.05 * s - .3 * early));
        ['frontleg1', 'R_frontleg1'].forEach(n => H.rotW(n, H.X, -.3 * s)); ['backleg1', 'R_backleg1'].forEach(n => H.rotW(n, H.X, .35 * s)); TAIL.forEach((t, i) => H.rotW(t, H.X, .15 * s + .05 * i * s)); H.rotW('head', H.X, .12 * (1 - 2 * u) * s); } },
      { name: 'cast', n: 6, pose: (H, u) => { H.reset(); const e = u * u * (3 - 2 * u); H.rotW('Hips', H.X, -.12 * e); H.rotW('chest', H.X, -.14 * e); H.rotW('head', H.X, -.38 * e); TAIL.forEach(t => H.rotW(t, H.X, .22 * e)); ['frontleg', 'R_frontleg'].forEach(n => H.rotW(n, H.X, .12 * e)); } },
    ],
  },
  // Enemy template: Meshy exports one GLB per animation; list the walk clip as glb and the others in extraClips.
  // Every enemy needs 'walk'; 'attack' (wind-up / shot) and 'die' are optional and used when present.
  // ghoul: { glb: 'models/ghoul_walk.glb', extraClips: ['models/ghoul_attack.glb'], fw: 192, fh: 160, points: { eye: 'Head' },
  //   anims: [{ name: 'walk', n: 12, clip: 0, from: 0, to: 1 }, { name: 'attack', n: 8, clip: 1, from: 0, to: 1 }] },
};
