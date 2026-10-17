// One entry per character. glb paths are relative to this folder (copy or symlink the files from assets/).
// anims: { name, n, clip, from, to } plays a GLB clip between fractions from..to; { name, n, pose(H, u) } builds a pose by hand.
const TAIL = ['tailstart', 'tail1', 'tail2', 'tail3'];
const LEGS = ['frontleg', 'R_frontleg', 'backleg', 'R_backleg', 'frontleg0', 'R_frontleg0', 'backleg0', 'R_backleg0', 'frontleg1', 'R_frontleg1', 'backleg1', 'R_backleg1'];
import { buildBomb, buildBat, buildChest, buildMimic, buildThorn, buildSporer, buildTreant, buildMoon } from './models.js';
const T2 = 2 * Math.PI, DIRS5 = [0, 45, 90, -45, -90];
// Meshy humanoids (Mixamo skeleton): clips play in place, size is measured by height
const HUM = { fw: 200, fh: 224, elev: 51, dirs: DIRS5, byHeight: true, inPlace: 'mixamorigHips', points: { eye: 'mixamorigHead' }, emissive: .18, emissiveColor: 0xffffff, exposure: 1.05 };
export const CFG = {
  fox: {
    glb: 'models/frostlight_fox_walk.glb', fw: 224, fh: 200, emissive: .12, emissiveColor: 0xdff4ff, margin: 1.02, elev: 51, dirs: [0, 45, 90, -45, -90], len: .0062,
    points: { eye: 'head', tail: 'tail3', back: 'chest' },
    anims: [
      { name: 'idle', n: 8, pose: (H, u) => { H.reset(); TAIL.forEach((t, i) => { H.rotW(t, H.Y, .16 * Math.sin(u * T2 - i * .7)); H.rotW(t, H.X, .05 * Math.sin(u * T2 * 2 - i)); }); H.rotW('head', H.X, -.05 * Math.sin(u * T2)); } },
      { name: 'walk', n: 10, pose: (H, u) => { H.clip(0, u); TAIL.forEach((t, i) => H.rotW(t, H.Y, .1 * Math.sin(u * 2 * T2 - i * .7))); } },
      { name: 'run', n: 8, pose: (H, u) => { H.clip(0, u); H.exaggerate(LEGS, 1.75); const c = Math.sin(u * 2 * T2); H.rotW('Hips', H.X, .07 * c); TAIL.forEach((t, i) => H.rotW(t, H.X, .12 + .08 * Math.sin(u * 2 * T2 - i * .8))); H.rotW('head', H.X, -.06 * c); return Math.abs(Math.cos(u * T2)) * .00012; } },
      { name: 'hop', n: 6, pose: (H, u) => { H.reset(); const s = Math.sin(Math.PI * u), early = Math.max(0, 1 - u * 5), land = Math.max(0, u * 5 - 4);
        H.rotW('Hips', H.X, -.32 * (1 - 2 * u) * s); ['frontleg', 'R_frontleg'].forEach(n => H.rotW(n, H.X, -1.15 * s + .35 * early - .2 * land)); ['backleg', 'R_backleg'].forEach(n => H.rotW(n, H.X, 1.05 * s - .3 * early));
        ['frontleg1', 'R_frontleg1'].forEach(n => H.rotW(n, H.X, -.3 * s)); ['backleg1', 'R_backleg1'].forEach(n => H.rotW(n, H.X, .35 * s)); TAIL.forEach((t, i) => H.rotW(t, H.X, .15 * s + .05 * i * s)); H.rotW('head', H.X, .12 * (1 - 2 * u) * s); } },
      { name: 'cast', n: 4, pose: (H, u) => { H.reset(); const e = u * u * (3 - 2 * u); H.rotW('Hips', H.X, -.12 * e); H.rotW('chest', H.X, -.14 * e); H.rotW('head', H.X, -.38 * e); TAIL.forEach(t => H.rotW(t, H.X, .22 * e)); ['frontleg', 'R_frontleg'].forEach(n => H.rotW(n, H.X, .12 * e)); } },
    ],
  },
  // ---------- enemies (assets/enemies); humanoids come with Meshy clips, the rest are posed by hand ----------
  archer: { ...HUM, len: 1.7, glb: 'models/archer.glb', weapons: [{ bone: 'mixamorigLeftHand', type: 'bow', off: [.04, 0, 0], r: .5, rot: [90, 0, 0] }],
    anims: [{ name: 'walk', n: 10, pose: (H, u) => H.clip('Walking', u) }, { name: 'attack', n: 8, pose: (H, u) => H.clip('Archery', u) }] },
  knight: { ...HUM, len: 1.7, glb: 'models/knight.glb', weapons: [{ bone: 'mixamorigRightHand', type: 'sword', off: [-.05, -.02, 0], len: .85, rot: [35, 0, 0] }, { bone: 'mixamorigLeftHand', type: 'shield', off: [-.12, 0, .07] }],
    anims: [{ name: 'walk', n: 10, pose: (H, u) => H.clip('Walking', u) }, { name: 'attack', n: 8, pose: (H, u) => H.clip('Double_Combo', u, 0, .5) }] },
  brute: { ...HUM, len: 1.91, glb: 'models/brute.glb', anims: [{ name: 'walk', n: 10, pose: (H, u) => H.clip('Walking', u) }, { name: 'attack', n: 8, pose: (H, u) => H.clip('Charged_Slash', u) }] },
  cardinal: { ...HUM, fw: 320, fh: 340, len: 1.7, glb: 'models/cardinal.glb', weapons: [{ bone: 'mixamorigRightHand', type: 'staff', off: [-.05, 0, 0], len: 1.45, rot: [90, 0, 0] }],
    anims: [{ name: 'walk', n: 10, pose: (H, u) => { H.clip('Walking', u); H.rotW('mixamorigRightForeArm', H.X, -1.35); } }, { name: 'attack', n: 8, pose: (H, u) => H.clip('Attack', u) }, { name: 'die', n: 8, pose: (H, u) => H.clip('Dead', u) }] },
  lord: { ...HUM, fw: 320, fh: 340, len: 1.7, glb: 'models/lord.glb', weapons: [{ bone: 'mixamorigRightHand', type: 'sword', off: [-.05, -.02, 0], len: 1.05, width: .09, color: 0x8a94b0, glow: 0x3fa0ff, rot: [35, 0, 0] }],
    anims: [{ name: 'walk', n: 10, pose: (H, u) => H.clip('Walking', u) }, { name: 'attack', n: 8, pose: (H, u) => H.clip('Attack', u) }, { name: 'die', n: 8, pose: (H, u) => H.clip('Dead', u) }] },
  ghoul: { glb: 'models/ghoul_rig.glb', fw: 208, fh: 176, len: 2.45, elev: 51, dirs: DIRS5, points: { eye: 'Bone_016' },
    anims: [
      { name: 'walk', n: 10, pose: (H, u) => { H.reset(); const a = u * T2, s = Math.sin(a), c = Math.cos(a);
        // diagonal gait: front-left with hind-right, then the other pair; forward swing is a negative turn about the side axis
        H.rotW('Bone_023', H.X, -.45 * s); H.rotW('Bone_014', H.X, -.4 * s); H.rotW('Bone_027', H.X, .45 * s); H.rotW('Bone_009', H.X, .4 * s);
        H.rotW('Bone_022', H.X, -.35 * Math.max(0, c)); H.rotW('Bone_026', H.X, -.35 * Math.max(0, -c)); H.rotW('Bone_013', H.X, .3 * Math.max(0, -c)); H.rotW('Bone_008', H.X, .3 * Math.max(0, c));
        H.rotW('Bone_003', H.Y, .08 * s); H.rotW('Bone_002', H.Y, -.08 * s); H.rotW('Bone_018', H.X, .06 * Math.sin(2 * a)); return .02 * Math.abs(Math.sin(2 * a)); } },
      { name: 'attack', n: 8, pose: (H, u) => { H.reset(); const back = Math.sin(Math.PI * Math.min(1, u / .55)), lunge = Math.max(0, Math.sin(Math.PI * (u - .45) / .55));
        H.rotW('Bone_004', H.X, .25 * back - .2 * lunge); H.rotW('Bone_023', H.X, .3 * back - .9 * lunge); H.rotW('Bone_027', H.X, .3 * back - .9 * lunge);
        H.rotW('Bone_018', H.X, -.25 * back + .2 * lunge); H.rotW('Bone_017', H.X, -.3 * lunge); return .05 * lunge; } },
    ] },
  spitter: { glb: 'models/spitter_rig.glb', fw: 208, fh: 176, elev: 51, dirs: DIRS5, len: 1.6,
    anims: [
      { name: 'walk', n: 10, pose: (H, u) => { H.reset(); const a = u * T2, s = Math.sin(a), c = Math.cos(a);
        // spider gait: legs swing about the vertical axis at the hip and lift outward; pairs FR+BL / FL+BR
        H.rotW('Bone_008', H.Y, .3 * s); H.rotW('Bone_027', H.Y, -.3 * s); H.rotW('Bone_015', H.Y, .3 * s); H.rotW('Bone_021', H.Y, -.3 * s);
        H.rotW('Bone_008', H.Z, .25 * Math.max(0, c)); H.rotW('Bone_027', H.Z, -.25 * Math.max(0, c)); H.rotW('Bone_015', H.Z, -.25 * Math.max(0, -c)); H.rotW('Bone_021', H.Z, .25 * Math.max(0, -c));
        H.rotW('Bone_001', H.Z, .04 * s); return .03 * Math.abs(Math.sin(2 * a)); } },
      { name: 'attack', n: 8, pose: (H, u) => { H.reset(); const k = Math.sin(Math.PI * u), b = H.bones.Bone_001; b.scale.setScalar(1 + .14 * k); H.rotW('Bone_001', H.X, -.25 * k); return .04 * k; } },
    ] },
  queen: { glb: 'models/queen_rig.glb', fw: 320, fh: 340, len: 1.7, elev: 51, dirs: DIRS5, byHeight: true, tiltX: -24, emissive: .25, emissiveColor: 0xb8d8ff,
    anims: [
      { name: 'walk', n: 10, pose: (H, u) => { H.reset(); const a = u * T2, s = Math.sin(a);
        ['Bone_010', 'Bone_015'].forEach((b, i) => H.rotW(b, H.X, .2 + .12 * Math.sin(a + i * 2))); ['Bone_009', 'Bone_014'].forEach((b, i) => H.rotW(b, H.X, .15 * Math.sin(a + 1 + i * 2)));
        H.rotW('Bone_023', H.Z, -.15 * s); H.rotW('Bone_028', H.Z, .15 * s); H.rotW('Bone_018', H.Z, .05 * s); return .08 + .04 * s; } },
      { name: 'attack', n: 8, pose: (H, u) => { H.reset(); const k = Math.sin(Math.PI * Math.min(1, u * 1.3));
        H.rotW('Bone_023', H.X, -1.4 * k); H.rotW('Bone_028', H.X, -1.4 * k); H.rotW('Bone_023', H.Z, -.5 * k); H.rotW('Bone_028', H.Z, .5 * k); H.rotW('Bone_018', H.X, -.4 * k); H.rotW('Bone_004', H.X, -.2 * k); return .1 + .06 * k; } },
      { name: 'die', n: 8, pose: (H, u) => { H.reset(); const e = u * u; H.rotW('Bone_005', H.X, .9 * e); H.rotW('Bone_018', H.X, .5 * e); H.rotW('Bone_023', H.X, .6 * e); H.rotW('Bone_028', H.X, .6 * e); return .08 - .5 * e; } },
    ] },
  rider: { glb: 'models/rider_rig.glb', fw: 340, fh: 320, elev: 51, dirs: DIRS5, len: 1.55, emissive: .22, emissiveColor: 0xffffff, exposure: 1.1, fix: -25, anchor: 'bbox',
    // the horse's front legs had no bones: add a chain per leg and move their vertices onto it
    addLegs: [{ name: 'FL', parent: 'Bone_000', side: 1, cx: .22, zMin: .15, xMax: .62, yTop: .62 }, { name: 'FR', parent: 'Bone_000', side: -1, cx: .22, zMin: .15, xMin: -.2, yTop: .62 }],
    anims: [
      { name: 'walk', n: 10, pose: (H, u) => { H.reset(); const a = u * T2, s = Math.sin(a), c = Math.cos(a);
        H.rotW('FL', H.X, -.3 * s); H.rotW('Bone_014', H.X, -.4 * s); H.rotW('FR', H.X, .3 * s); H.rotW('Bone_009', H.X, .4 * s);
        H.rotW('FL_lo', H.X, .45 * Math.max(0, c)); H.rotW('FR_lo', H.X, .45 * Math.max(0, -c)); H.rotW('Bone_008', H.X, -.4 * Math.max(0, -c)); H.rotW('Bone_013', H.X, -.4 * Math.max(0, c));
        H.rotW('Bone_019', H.X, .15 + .1 * Math.sin(2 * a)); H.rotW('Bone_026', H.X, .06 * Math.sin(2 * a)); return .03 * Math.abs(Math.sin(2 * a)); } },
      { name: 'attack', n: 8, pose: (H, u) => { H.reset(); const rear = Math.sin(Math.PI * Math.min(1, u / .6)), slash = Math.max(0, Math.sin(Math.PI * (u - .3) / .7));
        H.rotW('Bone_000', H.X, -.45 * rear); H.rotW('FL', H.X, -.9 * rear); H.rotW('FR', H.X, -.7 * rear); H.rotW('FL_lo', H.X, 1.1 * rear); H.rotW('FR_lo', H.X, 1.2 * rear);
        H.rotW('Bone_023', H.X, -1.6 * slash + .6 * rear); H.rotW('Bone_022', H.X, -.5 * slash); return 0; } },
      { name: 'die', n: 8, pose: (H, u) => { H.reset(); const e = u * u * (3 - 2 * u);
        ['FL', 'FR', 'Bone_009', 'Bone_014'].forEach((b, i) => H.rotW(b, H.X, (i < 2 ? -.6 : .6) * e)); ['FL_lo', 'FR_lo'].forEach(b => H.rotW(b, H.X, 1.4 * e)); ['Bone_008', 'Bone_013'].forEach(b => H.rotW(b, H.X, -1.2 * e));
        H.rotW('Bone_000', H.Z, .5 * e); return -.38 * e; } },
    ] },
  // ---------- small enemies built in code (models.js) ----------
  bomb: { build: buildBomb, fw: 176, fh: 176, elev: 51, dirs: DIRS5, len: 1, exposure: 1.1,
    anims: [
      { name: 'walk', n: 8, pose: (H, u) => { H.reset(); const a = u * T2; for (let i = 0; i < 4; i++) { const ph = a + (i % 3 ? Math.PI : 0); H.rotW('leg' + i, H.X, .45 * Math.sin(ph)); H.rotW('knee' + i, H.X, -.3 * Math.max(0, Math.cos(ph))); }
        H.bones.body.position.y = .55 + .04 * Math.abs(Math.sin(2 * a)); H.bones.spark.scale.setScalar(.8 + .4 * Math.abs(Math.sin(3 * a))); H.bones.shell.material.emissiveIntensity = 0; } },
      { name: 'attack', n: 6, pose: (H, u) => { H.reset(); const k = u; H.bones.body.scale.setScalar(1 + .3 * k); H.bones.body.position.y = .55 + .1 * k; H.bones.shell.material.emissive.setHex(0xff3010); H.bones.shell.material.emissiveIntensity = .2 + 1.4 * k * k;
        H.bones.spark.scale.setScalar(1.5 + 2 * k); for (let i = 0; i < 4; i++) H.rotW('knee' + i, H.X, .3 * Math.sin(u * 30 + i)); } },
    ] },
  bat: { build: buildBat, fw: 192, fh: 192, elev: 51, dirs: DIRS5, len: .5, exposure: 1.1,
    anims: [
      { name: 'walk', n: 8, pose: (H, u) => { H.reset(); const f = Math.sin(u * T2); H.rotW('wingL', H.Z, .9 * f); H.rotW('wingR', H.Z, -.9 * f); H.bones.body.position.y = .9 - .06 * f; } },
      { name: 'attack', n: 4, pose: (H, u) => { H.reset(); const f = Math.sin(u * T2); H.rotW('wingL', H.Z, .3 + .2 * f); H.rotW('wingR', H.Z, -.3 - .2 * f); H.rotW('wingL', H.Y, .9); H.rotW('wingR', H.Y, -.9); H.rotW('body', H.X, .5); H.bones.body.position.y = .7; } },
    ] },
  chest: { build: buildChest, fw: 176, fh: 160, elev: 51, dirs: [90], len: .9, exposure: 1.1,
    anims: [{ name: 'walk', n: 4, pose: (H, u) => { H.reset(); H.bones.gleam.material.emissiveIntensity = 1.6 + .9 * Math.sin(u * T2); H.rotW('lid', H.X, -.04 - .03 * Math.sin(u * T2)); } }] },
  mimic: { build: buildMimic, fw: 176, fh: 176, elev: 51, dirs: DIRS5, len: .9, exposure: 1.1,
    anims: [
      { name: 'walk', n: 8, pose: (H, u) => { H.reset(); const a = u * T2; H.rotW('lid', H.X, -.25 - .35 * Math.max(0, Math.sin(2 * a))); return .08 * Math.abs(Math.sin(a)); } },
      { name: 'attack', n: 6, pose: (H, u) => { H.reset(); H.rotW('lid', H.X, -.4 - .9 * Math.sin(Math.PI * Math.min(1, u * 1.4))); H.bones.tongue.scale.set(1.3, .35 + .3 * u, 1.4 + .6 * u); return .05; } },
    ] },
  // ---------- Spirit Forest ----------
  thorn: { build: buildThorn, fw: 176, fh: 208, elev: 51, dirs: [0, 90, -90], len: 1.4, exposure: 1.1, points: { eye: 'core' },
    anims: [
      { name: 'walk', n: 8, pose: (H, u) => { H.reset(); const a = u * T2; for (let i = 0; i < 4; i++) { H.rotW('seg' + i, H.Z, .1 * Math.sin(a - i * .6)); H.rotW('seg' + i, H.X, .06 * Math.cos(a - i * .6)); }
        for (let k = 0; k < 6; k++) H.bones['petal' + k].rotation.x = -.9 + .1 * Math.sin(a); } },
      { name: 'attack', n: 6, pose: (H, u) => { H.reset(); const back = Math.sin(Math.PI * Math.min(1, u / .6)), whip = Math.max(0, Math.sin(Math.PI * (u - .5) / .5));
        for (let i = 1; i < 4; i++) H.rotW('seg' + i, H.X, .28 * back - .4 * whip); for (let k = 0; k < 6; k++) H.bones['petal' + k].rotation.x = -.9 + 1.25 * Math.min(1, u * 1.6);
        H.bones.core.scale.setScalar(1 + .8 * u); } },
    ] },
  sporer: { build: buildSporer, fw: 192, fh: 192, elev: 51, dirs: DIRS5, len: 1, exposure: 1.1, points: { eye: 'face' },
    anims: [
      { name: 'walk', n: 8, pose: (H, u) => { H.reset(); const a = u * T2; for (let i = 0; i < 4; i++) H.rotW('leg' + i, H.X, .45 * Math.sin(a + (i % 2) * Math.PI)); H.rotW('body', H.Z, .1 * Math.sin(a)); H.bones.cap.rotation.z = .06 * Math.sin(a + 1); H.bones.cap.rotation.x = -.35; return .03 * Math.abs(Math.sin(a)); } },
      { name: 'attack', n: 6, pose: (H, u) => { H.reset(); const k = Math.sin(Math.PI * u); H.bones.cap.scale.set(1 + .25 * k, 1 - .3 * k + .4 * Math.max(0, u - .6), 1 + .25 * k); H.bones.body.scale.set(1 + .1 * k, 1 - .12 * k, 1 + .1 * k); } },
    ] },
  wolf: { glb: 'models/frostlight_fox_walk.glb', fw: 224, fh: 200, margin: 1.02, elev: 51, dirs: DIRS5, len: .0062, exposure: 1.2, points: { eye: 'head' },
    recolor: { color: 0x6a5a9a, emissive: 0x4a2a8a, emissiveIntensity: .45 }, rimColor: 0xc890ff, rim: 5,
    anims: [
      { name: 'walk', n: 8, pose: (H, u) => { H.clip(0, u); H.exaggerate(LEGS, 1.75); const c = Math.sin(u * 2 * T2); H.rotW('Hips', H.X, .07 * c); TAIL.forEach((t, i) => H.rotW(t, H.X, -.1 + .08 * Math.sin(u * 2 * T2 - i * .8))); H.rotW('head', H.X, .12); return Math.abs(Math.cos(u * T2)) * .00012; } },
      { name: 'attack', n: 6, pose: (H, u) => { H.reset(); const s = Math.sin(Math.PI * u), early = Math.max(0, 1 - u * 5);
        H.rotW('Hips', H.X, -.25 * (1 - 2 * u) * s); ['frontleg', 'R_frontleg'].forEach(n => H.rotW(n, H.X, -1.15 * s + .35 * early)); ['backleg', 'R_backleg'].forEach(n => H.rotW(n, H.X, 1.05 * s - .3 * early));
        TAIL.forEach(t => H.rotW(t, H.X, -.1)); H.rotW('head', H.X, .25 - .2 * s); } },
    ] },
  treant: { build: buildTreant, fw: 320, fh: 340, elev: 51, dirs: DIRS5, len: 2.2, byHeight: true, exposure: 1.1, points: { eye: 'face' },
    anims: [
      { name: 'walk', n: 10, pose: (H, u) => { H.reset(); const a = u * T2, s = Math.sin(a); H.rotW('legL', H.X, .4 * s); H.rotW('legR', H.X, -.4 * s); H.rotW('body', H.Z, .05 * s); H.rotW('armL', H.X, -.25 * s); H.rotW('armR', H.X, .25 * s);
        H.rotW('crown', H.Z, .04 * Math.sin(a + 1)); return .03 * Math.abs(Math.sin(a)); } },
      { name: 'attack', n: 8, pose: (H, u) => { H.reset(); const up = Math.sin(Math.PI * Math.min(1, u / .55)), slam = Math.max(0, Math.sin(Math.PI * (u - .45) / .55));
        for (const n of ['armL', 'armR']) H.rotW(n, H.X, -2.2 * up + 1.2 * slam); H.rotW('body', H.X, -.15 * up + .3 * slam); H.rotW('crown', H.X, .1 * up); } },
      { name: 'die', n: 8, pose: (H, u) => { H.reset(); const e = u * u * (3 - 2 * u); H.rotW('body', H.X, 1.2 * e); H.rotW('legL', H.X, -.5 * e); H.rotW('legR', H.X, -.3 * e); H.rotW('armL', H.Z, .6 * e); H.rotW('armR', H.Z, -.6 * e); return -.35 * e; } },
    ] },
  moon: { build: buildMoon, fw: 340, fh: 360, elev: 51, dirs: [90], len: 2.4, byHeight: true, exposure: 1.15, rimColor: 0xc8b8ff, rim: 4, points: { eye: 'eye' },
    anims: [
      { name: 'walk', n: 12, pose: (H, u) => { H.reset(); const a = u * T2; H.bones.body.position.y = 1.35 + .08 * Math.sin(a); H.bones.ring.rotation.y = a / 3; H.rotW('body', H.Z, .05 * Math.sin(a)); H.bones.shell.rotation.y = a * .1; H.bones.shell.material.emissiveIntensity = .7; } },
      { name: 'attack', n: 8, pose: (H, u) => { H.reset(); const k = Math.sin(Math.PI * u); H.bones.body.position.y = 1.45; H.bones.ring.rotation.y = u * 2; H.bones.ring.scale.setScalar(1 + .25 * k); H.bones.eye.scale.set(1 + .6 * k, 1 + 1.2 * k, 1); H.bones.shell.material.emissiveIntensity = .5 + 1.5 * k; } },
      { name: 'die', n: 8, pose: (H, u) => { H.reset(); const e = u * u; H.bones.body.position.y = 1.35 - .9 * e; H.bones.ring.scale.setScalar(1 + .5 * e); H.bones.shell.scale.setScalar(1 - .25 * e); H.bones.eye.scale.setScalar(1 - e * .9); H.bones.shell.material.emissiveIntensity = .5 + 4 * e; } },
    ] },
  // Enemy template: Meshy exports one GLB per animation; list the walk clip as glb and the others in extraClips.
  // Every enemy needs 'walk'; 'attack' (wind-up / shot) and 'die' are optional and used when present.
  // ghoul: { glb: 'models/ghoul_walk.glb', extraClips: ['models/ghoul_attack.glb'], fw: 192, fh: 160, points: { eye: 'Head' },
  //   anims: [{ name: 'walk', n: 10, clip: 0, from: 0, to: 1 }, { name: 'attack', n: 8, clip: 1, from: 0, to: 1 }] },
};
