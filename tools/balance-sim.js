// Balance simulation: a scripted bot plays N runs per spearman headlessly and reports the room reached
// plus average time and damage taken per room. Usage: node tools/balance-sim.js [runsPerHero]
// Needs Playwright with a Chromium build (npm i -D playwright).
const { chromium } = require('playwright');
const RUNS = +process.argv[2] || 4;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../game/index.html'), { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(300);
  const out = await pg.evaluate(async (RUNS) => {
    // freeze rendering so only the simulation runs
    window.draw = () => {}; buzz = () => {}; puff = () => {};
    let bot = { x: 0, y: 0, m: 0 };
    inputDir = () => bot;
    const res = [];
    for (const hero of ['oath', 'shade', 'heavy', 'caller']) for (let run = 0; run < RUNS; run++) {
      meta.hero = hero; meta.hp = meta.dmg = meta.hop = meta.reroll = 0; newRun(); show(null);
      const roomLog = []; let roomStart = 0, hpStart = G.p.hp, lastRoom = 1, steps = 0;
      while (G.phase !== 'over' && steps < 60 * 60 * 25 && G.room <= 30) {
        steps++;
        const p = G.p, s = G.s;
        if (G.phase === 'draft') { const PR = ['dmg', 'as', 'multi', 'rend', 'pierce', 'heavy', 'crit', 'hp', 'leech', 'spirit', 'rendcd', 'exec', 'shadow', 'ghost', 'qup']; const sc = u => (u.r === 'leg' ? 100 : u.r === 'epic' ? 60 : 0) + (PR.includes(u.id) ? 40 - PR.indexOf(u.id) * 2 : 0); pick(draftOpts.slice().sort((a, b) => sc(b) - sc(a))[0]); continue; }
        if (G.phase === 'path') { chooseDoor('fight'); continue; }
        if (G.phase === 'shop') { showPath(); continue; }
        // steering: flee threats, keep off the wall, otherwise approach to range
        let fx = 0, fy = 0;
        for (const e of G.enemies) { if (e.dead) continue; const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < 260 + e.r) { const w = 1 / (d * d) * 1e4; fx += dx / d * w; fy += dy / d * w; } }
        for (const sh of G.eshots) { const dx = p.x - sh.x, dy = p.y - sh.y, d = Math.hypot(dx, dy) || 1; if (d < 160) { const w = 4e3 / (d * d); fx += -sh.vy / 300 * w * Math.sign(dx * -sh.vy + dy * sh.vx || 1); fy += sh.vx / 300 * w * Math.sign(dx * -sh.vy + dy * sh.vx || 1); } }
        const pl = Math.hypot(p.x, p.y); if (pl > ARENA - 180) { fx -= p.x / pl * 2; fy -= p.y / pl * 2; }
        let m = Math.hypot(fx, fy);
        if (m < .15) { const t = nearestEnemy(p.x, p.y, 2000); if (t && Math.hypot(t.x - p.x, t.y - p.y) > s.range * .85) { fx = t.x - p.x; fy = t.y - p.y; m = Math.hypot(fx, fy); } }
        bot = m > .15 ? { x: fx / m, y: fy / m, m: 1 } : { x: 0, y: 0, m: 0 };
        if (p.rendCd <= 0 && G.enemies.some(e => !e.dead && !e.dying && e.stacks > 0 && (rendDmg(e) >= e.hp || e.stacks >= 7))) castRend();
        if (p.qCd <= 0 && G.enemies.length) queueQ();
        if (p.rCd <= 0 && (p.hp < s.maxHp * .4 || G.enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 130).length >= 3)) castR();
        update(1 / 60);
        if (G.room !== lastRoom) { roomLog.push({ room: lastRoom, t: +(G.time - roomStart).toFixed(1), dmg: Math.round(hpStart - G.p.hp) }); lastRoom = G.room; roomStart = G.time; hpStart = G.p.hp; }
      }
      res.push({ hero, room: G.room, time: Math.round(G.time), ups: Object.keys(G.ups).length, rooms: roomLog });
      if (G.phase !== 'over') gameOver();
    }
    return res;
  }, RUNS);
  const byHero = {};
  for (const r of out) (byHero[r.hero] = byHero[r.hero] || []).push(r.room);
  for (const [h, rs] of Object.entries(byHero)) { rs.sort((a, b) => a - b); console.log(h.padEnd(7), 'rooms', rs.join(','), 'median', rs[rs.length >> 1]); }
  // average time and damage per room index
  const agg = {}; for (const r of out) for (const x of r.rooms) { const a = agg[x.room] = agg[x.room] || { n: 0, t: 0, d: 0 }; a.n++; a.t += x.t; a.d += x.dmg; }
  console.log('room: avgTime(s) avgDmgTaken (n)'); for (const [k, a] of Object.entries(agg)) console.log(String(k).padStart(2), (a.t / a.n).toFixed(1).padStart(6), (a.d / a.n).toFixed(0).padStart(5), `(${a.n})`);
  console.log('ERR', errs); await b.close();
})();
