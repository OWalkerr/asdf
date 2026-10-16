// Small enemies built from primitives (no Meshy model): bone bomb, blood bat, chest and mimic.
// Named parts are posed by the configs like bones. Units ~ metres, +z forward, feet at y = 0.
const mat = (T, c, e = 0x000000, ei = 0, r = .7, m = .1) => new T.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, roughness: r, metalness: m });
const grp = (T, name, ...kids) => { const g = new T.Group(); g.name = name; kids.forEach(k => g.add(k)); return g; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

export function buildBomb(T) {
  const root = new T.Group(), body = grp(T, 'body');
  const shell = new T.Mesh(new T.SphereGeometry(.42, 24, 18), mat(T, 0xb8a47a, 0x000000, 0, .85)); shell.name = 'shell'; shell.scale.set(1, .9, 1.05);
  const crack = mat(T, 0xff7a3a, 0xff5020, 1.6);
  for (let i = 0; i < 5; i++) { const c = new T.Mesh(new T.BoxGeometry(.035, .32, .035), crack); const a = i * 1.3; c.position.set(Math.cos(a) * .4, .05 * i - .1, Math.sin(a) * .4); c.rotation.set(.4 * i, a, .6); body.add(c); }
  const eyeM = mat(T, 0x1a0a06), glowM = mat(T, 0xffaa60, 0xff8a40, 2.2);
  for (const s of [-1, 1]) { body.add(at(new T.Mesh(new T.SphereGeometry(.09, 10, 8), eyeM), s * .13, .08, .36)); body.add(at(new T.Mesh(new T.SphereGeometry(.035, 8, 6), glowM), s * .13, .08, .42)); }
  const fuseCurve = new T.CatmullRomCurve3([new T.Vector3(0, .36, -.05), new T.Vector3(-.08, .5, -.1), new T.Vector3(.02, .62, -.12)]);
  const fuse = new T.Mesh(new T.TubeGeometry(fuseCurve, 12, .02, 6), mat(T, 0x3a2a18)); const spark = at(new T.Mesh(new T.SphereGeometry(.05, 10, 8), mat(T, 0xffd890, 0xffb050, 3)), .02, .63, -.12); spark.name = 'spark';
  body.add(shell, fuse, spark); body.position.y = .55; root.add(body);
  const legM = mat(T, 0xcdbf9a, 0x000000, 0, .8);
  [[.25, .2], [-.25, .2], [.25, -.2], [-.25, -.2]].forEach(([x, z], i) => {
    const hip = grp(T, 'leg' + i), up = new T.Mesh(new T.CylinderGeometry(.03, .025, .32, 6), legM); up.position.set(Math.sign(x) * .12, -.1, 0); up.rotation.z = Math.sign(x) * 1.0;
    const knee = grp(T, 'knee' + i), lo = new T.Mesh(new T.CylinderGeometry(.025, .012, .36, 6), legM); lo.position.y = -.18; knee.add(lo); knee.position.set(Math.sign(x) * .26, -.2, 0); knee.rotation.z = Math.sign(x) * -.25;
    hip.add(up, knee); hip.position.set(x * .8, .5, z); root.add(hip);
  });
  return root;
}

export function buildBat(T) {
  const root = new T.Group(), body = grp(T, 'body'), skin = mat(T, 0x5a1420, 0x2a0408, .4, .8), wingM = mat(T, 0x7a1a2a, 0x3a0610, .5, .9);
  wingM.side = T.DoubleSide;
  const torso = new T.Mesh(new T.SphereGeometry(.16, 16, 12), skin); torso.scale.set(1, .9, 1.4);
  const head = at(new T.Mesh(new T.SphereGeometry(.11, 14, 10), skin), 0, .06, .2);
  const earG = new T.ConeGeometry(.045, .14, 6);
  for (const s of [-1, 1]) { const e = at(new T.Mesh(earG, skin), s * .06, .17, .19); e.rotation.z = -s * .3; head.add(e); head.add(at(new T.Mesh(new T.SphereGeometry(.022, 8, 6), mat(T, 0xff4060, 0xff2040, 3)), s * .045, .02, .1)); }
  head.position.set(0, .06, .2); body.add(torso, head);
  // wings: membrane shape in the xz plane hinged at the shoulder; the arm bone runs along the leading edge
  const sh = new T.Shape(); sh.moveTo(0, .08); sh.lineTo(.35, .12); sh.lineTo(.62, .02); sh.quadraticCurveTo(.5, -.06, .46, -.16); sh.quadraticCurveTo(.36, -.08, .3, -.2); sh.quadraticCurveTo(.2, -.1, .12, -.18); sh.quadraticCurveTo(.06, -.05, 0, -.08);
  const wg = new T.ShapeGeometry(sh); wg.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) { const w = grp(T, s > 0 ? 'wingL' : 'wingR'), m = new T.Mesh(wg, wingM); m.scale.x = s; w.add(m); const bone = at(new T.Mesh(new T.CylinderGeometry(.012, .008, .62, 5), skin), s * .31, .005, -.05); bone.rotation.z = Math.PI / 2; w.add(bone); w.position.set(s * .1, .03, 0); body.add(w); }
  body.position.y = .9; root.add(body);
  return root;
}

function buildBox(T, mimic) {
  const root = new T.Group(), wood = mat(T, 0x8a5a2e, 0x000000, 0, .85), band = mat(T, 0xd8b25a, 0x4a3410, .3, .4, .7), W = .9, D = .6, Hh = .45;
  const base = grp(T, 'base'), box = at(new T.Mesh(new T.BoxGeometry(W, Hh, D), wood), 0, Hh / 2, 0); base.add(box);
  for (const x of [-.3, .3]) base.add(at(new T.Mesh(new T.BoxGeometry(.07, Hh + .01, D + .01), band), x, Hh / 2, 0));
  const lid = grp(T, 'lid'), lidM = new T.Mesh(new T.CylinderGeometry(D / 2, D / 2, W, 20, 1, false, 0, Math.PI), wood); lidM.rotation.z = Math.PI / 2; lidM.position.z = D / 2;
  lid.add(lidM); for (const x of [-.3, .3]) { const b = new T.Mesh(new T.CylinderGeometry(D / 2 + .01, D / 2 + .01, .07, 20, 1, false, 0, Math.PI), band); b.rotation.z = Math.PI / 2; b.position.set(x, 0, D / 2); lid.add(b); }
  const lock = at(new T.Mesh(new T.BoxGeometry(.12, .14, .04), mat(T, 0xf0d27a, 0xa07a20, .6, .3, .8)), 0, .02, D + .01); lid.add(lock);
  lid.position.set(0, Hh, -D / 2); root.add(base, lid);
  if (mimic) {
    const tooth = mat(T, 0xf2ead4, 0x000000, 0, .5), tg = new T.ConeGeometry(.035, .12, 5);
    for (let i = -4; i <= 4; i++) { const t = at(new T.Mesh(tg, tooth), i * .095, Hh + .05, D / 2 - .02); base.add(t); const t2 = at(new T.Mesh(tg, tooth), i * .095, -.05, D - .02); t2.rotation.x = Math.PI; lid.add(t2); }
    const tongue = at(new T.Mesh(new T.SphereGeometry(.22, 14, 10), mat(T, 0xc43a4a, 0x601018, .4, .6)), .05, Hh - .02, .05); tongue.scale.set(1.3, .35, 1.4); tongue.name = 'tongue'; base.add(tongue);
    for (const s of [-1, 1]) lid.add(at(new T.Mesh(new T.SphereGeometry(.05, 10, 8), mat(T, 0xff5050, 0xff2020, 3)), s * .25, .14, D * .85));
  } else {
    const glow = at(new T.Mesh(new T.BoxGeometry(W - .06, .02, D - .06), mat(T, 0xffd27a, 0xffb040, 2.5)), 0, Hh + .005, 0); glow.name = 'gleam'; base.add(glow);
  }
  return root;
}
export const buildChest = T => buildBox(T, false);
export const buildMimic = T => buildBox(T, true);
