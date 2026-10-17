// Exports everything a port needs from the web build (game/index.html), which stays the reference implementation:
//   export/data/*.json   game data (powers, heroes, enemies, guardians, biomes, rooms, events, story, vows...),
//                        effects kept as their JavaScript source so formulas are not lost
//   export/audio/*.wav   every synthesized sound effect, death voice and biome ambience, rendered offline
//   export/sprites/      sprite atlases (WebP, already in game/assets) + their frame metadata as JSON
// Usage: node tools/export-data.js   (needs Playwright with Chromium: npm i -D playwright)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'export');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  pg.on('pageerror', e => console.log('PE', e.message));
  await pg.goto('file://' + path.join(ROOT, 'game/index.html'), { waitUntil: 'load' }); await pg.waitForTimeout(800);
  // ---- data
  const data = await pg.evaluate(() => {
    const fn = f => typeof f === 'function' ? f.toString() : f;
    const plain = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'function' ? v.toString() : v));
    return {
      constants: { ARENA, TK, FEVER_T, CAMERA_ELEVATION_DEG: 51, baseStats: plain(baseStats()), note: 'World units: arena radius ARENA. The screen squashes world y by TK (sin 51°) for the three-quarter view; upright things are drawn unsquashed.' },
      powers: UPS.map(u => ({ id: u.id, name: u.n, rarity: u.r, max: u.max, tag: u.tag, patron: u.pat || null, desc: u.d, requires: u.req ? fn(u.req) : null, effect: fn(u.a) })),
      rarityWeights: RW, rarityNames: RN,
      heroes: HEROES.map(h => ({ id: h.id, name: h.n, desc: h.d, lockedBy: h.lock || null, fur: h.cloak, rim: h.rim, effect: fn(h.a) })),
      forms: FORMS, patrons: PATRONS,
      enemies: Object.fromEntries(Object.entries(EDEF).map(([k, v]) => [k, Object.assign({ name: k === 'boss' ? 'guardian base' : ENAME({ type: k }) }, v)])),
      enemyScaling: fn(makeEnemy), enemyFull: fn(makeEnemyFull), roomWaves: fn(roomWaves), bossWaves: fn(bossWaves),
      guardians: { order: fn(bossKind), names: { lord: 'Kemik Lordu', rider: 'Gölge Atlı', queen: 'Yas Kraliçesi', cardinal: 'Kan Kardinali', treant: 'Kadim Ağaç', moon: 'Sönmüş Ay' }, epithets: BOSS_EPI, glow: BOSS_GLOW, ascendedExtras: EXTRA,
        ai: { lord: fn(bossAI), rider: fn(riderAI), queen: fn(queenAI), cardinal: fn(cardinalAI), treant: fn(treantAI), moon: fn(moonAI), extras: fn(bossExtra), startExtra: fn(startExtra) } },
      biomes: plain(THEMES), biomeFor: fn(themeFor), lore: LORE, grade: GRADE, particleField: FIELD, lighting: GLT,
      ambience: AMBT, music: plain(MTHEME), musicScale: MSCALE,
      doors: DOORS, objectives: { names: OBJN, desc: OBJD, roll: fn(rollRoomMods), setup: fn(setupRoomMods), update: fn(updObjective) }, layouts: { names: LAYN, make: fn(makeLayout), inVoid: fn(inVoid) },
      events: EVENTS.map(e => ({ id: e.id, title: e.t, text: e.x, choices: e.c.map(c => ({ name: c.n, desc: c.d, effect: fn(c.go) })) })),
      story: STORY.map(s => ({ id: s.id, who: s.who, when: fn(s.when), lines: s.t })), advice: ADVICE,
      vows: VOWS.map(v => ({ id: v.id, name: v.n, max: v.max, desc1: v.d(1), desc2: v.max > 1 ? v.d(2) : null })),
      achievements: ACH, trails: plain(TRAILS), dailyMods: DAILY_MODS.map(m => ({ id: m.id, name: m.n, desc: m.d })), shop: SHOP.map(s => ({ id: s.id, name: s.n, desc: s.d, max: s.max, cost: fn(s.cost) })),
      tutorial: TUT.map(t => ({ id: t.id, html: t.h, when: fn(t.when), done: fn(t.done) })),
      combat: { fireSpear: fn(fireSpear), attackThrow: fn(attackThrow), startHop: fn(startHop), endHop: fn(endHop), castRend: fn(castRend), rendDmg: fn(rendDmg), rImpact: fn(rImpact), dmgEnemy: fn(dmgEnemy), killEnemy: fn(killEnemy), hurt: fn(hurt),
        perfectHop: fn(perfectHop), threatened: fn(threatened), addFervor: fn(addFervor), patronHit: fn(patronHit), chainFrom: fn(chainFrom), rollDraft: fn(rollDraft), update: fn(update), updEnemy: fn(updEnemy), finishEnemy: fn(finishEnemy) },
    };
  });
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  for (const [k, v] of Object.entries(data)) fs.writeFileSync(path.join(OUT, 'data', k + '.json'), JSON.stringify(v, null, 2));
  console.log('data:', Object.keys(data).length, 'files');
  // ---- sprite atlas metadata
  const atl = await pg.evaluate(() => Object.fromEntries(Object.entries(EATLAS).map(([k, A]) => [k, { meta: A.m, scale: A.k, eye: A.eye || null }])));
  fs.mkdirSync(path.join(OUT, 'sprites'), { recursive: true });
  for (const [k, v] of Object.entries(atl)) { fs.writeFileSync(path.join(OUT, 'sprites', k + '.json'), JSON.stringify(v)); const src = path.join(ROOT, 'game/assets', k + '_atlas.webp'); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, 'sprites', k + '_atlas.webp')); }
  console.log('sprites:', Object.keys(atl).join(' '));
  // ---- audio: render every recipe offline through the game's own mix bus (reverb, compressor, limiter)
  const names = await pg.evaluate(() => [...Object.keys(SND).map(n => 'sfx_' + n), ...Object.keys(DIE).map(n => 'die_' + n), ...Object.keys(AMBT).map(n => 'amb_' + n)]);
  fs.mkdirSync(path.join(OUT, 'audio'), { recursive: true });
  for (const n of names) {
    const b64 = await pg.evaluate(async n => {
      const amb = n.startsWith('amb_'), len = amb ? 20 : n === 'sfx_victory' ? 5 : 3.2, sr = 44100;
      const off = new OfflineAudioContext(2, sr * len, sr); const saved = [AC, MG]; AC = off; muted = false; buildAudio(); G = null;
      if (amb) { const a = startAmb(n.slice(4)); for (let t = 1; t < len - 2; t += 2.5) { const tt = t; setTimeout(() => {}, 0); } }
      else if (n.startsWith('die_')) { const k = n.slice(4), o = out(undefined, .3, AU.sfx, DVOL[k] ?? 2); DIE[k](o, .05); crunch(o, .05, .7); }
      else { const k = n.slice(4), o = out(undefined, SENDS[k] ?? .2, AU.sfx, VOL[k] ?? 1); SND[k](o, .05); }
      const buf = await off.startRendering(); [AC, MG] = saved;
      // 16-bit WAV
      const ch = [buf.getChannelData(0), buf.getChannelData(1)], N = buf.length, ab = new ArrayBuffer(44 + N * 4), v = new DataView(ab), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + N * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, N * 4, true);
      let last = 0; for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) { const x = Math.max(-1, Math.min(1, ch[c][i])); v.setInt16(44 + i * 4 + c * 2, x * 32767, true); if (Math.abs(x) > .002) last = i; }
      // trim trailing silence (keep reverb tails)
      const keep = Math.min(N, last + sr * .15), ab2 = ab.slice(0, 44 + keep * 4), v2 = new DataView(ab2); v2.setUint32(4, 36 + keep * 4, true); v2.setUint32(40, keep * 4, true);
      let s = ''; const u8 = new Uint8Array(ab2); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
    }, n);
    fs.writeFileSync(path.join(OUT, 'audio', n + '.wav'), Buffer.from(b64, 'base64'));
  }
  console.log('audio:', names.length, 'wav files');
  // ---- music: the generative score rendered offline as loops (mono 32 kHz); room calm/fight and each guardian
  const tracks = [['room_calm', null, .15, 'witch'], ['room_fight', null, .75, 'witch'], ['boss_lord', 'lord', 1, 'witch'], ['boss_rider', 'rider', 1, 'ice'], ['boss_queen', 'queen', 1, 'ice'], ['boss_cardinal', 'cardinal', 1, 'blood'], ['boss_treant', 'treant', 1, 'forest'], ['boss_moon', 'moon', 1, 'forest']];
  for (const [name, kind, inten, biome] of tracks) {
    const b64 = await pg.evaluate(async ([kind, inten, biome]) => {
      const sr = 32000, len = 46, off = new OfflineAudioContext(1, sr * len, sr), saved = [AC, MG, G];
      // the scheduler looks a little ahead of currentTime: a proxy walks a fake clock through the loop
      frame = () => {}; draw = () => {}; let now = 0;
      AC = off; muted = false; buildAudio(); AC = new Proxy(off, { get: (t, k) => k === 'currentTime' ? now : k === 'state' ? 'running' : typeof t[k] === 'function' ? t[k].bind(t) : t[k] });
      const room = { witch: 3, ice: 12, blood: 22, forest: 32 }[biome];
      G = { phase: kind || inten > .3 ? 'fight' : 'draft', isBoss: !!kind, room, feverT: 0, cam: { x: 0, y: 0 }, p: { x: 0, y: 0 }, enemies: kind ? [{ boss: true, kind, hp: 2, maxHp: 2 }] : Array.from({ length: 6 }, () => ({})) };
      AU.intensity = inten; musicT = .05; musicStep = 0; AU.ambTheme = biome; AU.amb = { A: AMBT[biome] }; paused = false;
      for (now = 0; now < len - .4; now += .2) schedMusic();
      const buf = await off.startRendering(); [AC, MG, G] = saved;
      const ch = buf.getChannelData(0), N = Math.min(buf.length, sr * 44), ab = new ArrayBuffer(44 + N * 2), v = new DataView(ab), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + N * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, N * 2, true);
      let pk = 1e-6; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(ch[i])); const gain = .9 / pk; // normalise each loop to -1 dB
      for (let i = 0; i < N; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, ch[i] * gain)) * 32767, true);
      let s = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
    }, [kind, inten, biome]);
    fs.writeFileSync(path.join(OUT, 'audio', 'music_' + name + '.wav'), Buffer.from(b64, 'base64'));
  }
  console.log('music:', tracks.length, 'loops');
  await b.close();
})();
