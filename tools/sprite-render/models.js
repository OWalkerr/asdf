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

// ---------- Spirit Forest ----------
// Thorn vine: a root mound, a four-segment stalk (seg0..seg3, each bends) and a flower head whose petals open to fire.
export function buildThorn(T) {
  const root = new T.Group(), bark = mat(T, 0x3a2a1a, 0x000000, 0, .9), stem = mat(T, 0x3f6a24, 0x0a1a04, .3, .75), thornM = mat(T, 0xd8e8a0, 0x203010, .2, .5);
  const mound = new T.Mesh(new T.SphereGeometry(.42, 20, 12), bark); mound.scale.set(1, .32, 1); root.add(mound);
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + .3, c = new T.CatmullRomCurve3([new T.Vector3(Math.cos(a) * .25, .08, Math.sin(a) * .25), new T.Vector3(Math.cos(a) * .5, .03, Math.sin(a) * .5), new T.Vector3(Math.cos(a + .2) * .72, 0, Math.sin(a + .2) * .72)]);
    root.add(new T.Mesh(new T.TubeGeometry(c, 10, .045, 6), bark)); }
  let parent = root, y0 = .1;
  for (let i = 0; i < 4; i++) {
    const seg = grp(T, 'seg' + i), L = .32 - i * .02, rr = .085 - i * .014, cyl = at(new T.Mesh(new T.CylinderGeometry(rr * .85, rr, L, 10), stem), 0, L / 2, 0); seg.add(cyl);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + i, th = at(new T.Mesh(new T.ConeGeometry(.025, .12, 5), thornM), Math.cos(a) * rr, L * (.3 + .25 * k), Math.sin(a) * rr); th.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); seg.add(th); }
    if (i === 1 || i === 2) { const lf = new T.Mesh(new T.SphereGeometry(.12, 10, 6), mat(T, 0x5a9a34, 0x10300a, .3, .7)); lf.scale.set(1.6, .15, .7); lf.position.set(i === 1 ? .16 : -.16, L * .6, 0); lf.rotation.z = i === 1 ? .4 : -.4; seg.add(lf); }
    seg.position.y = y0; parent.add(seg); parent = seg; y0 = L;
  }
  const head = grp(T, 'head'); head.position.y = y0; parent.add(head);
  const bulb = new T.Mesh(new T.SphereGeometry(.15, 16, 12), mat(T, 0x5a1a3a, 0x200010, .3, .6)); bulb.scale.set(1, .8, 1); head.add(bulb);
  const petalG = new T.SphereGeometry(.16, 12, 8); petalG.scale(.55, .12, 1); petalG.translate(0, 0, .14);
  for (let k = 0; k < 6; k++) { const pg = grp(T, 'petal' + k), pm = new T.Mesh(petalG, mat(T, k % 2 ? 0x8a2a5a : 0xa83a6a, 0x300818, .4, .6)); pg.add(pm); pg.rotation.order = 'YXZ'; pg.rotation.y = k * Math.PI / 3; pg.rotation.x = -.9; pg.position.y = .05; head.add(pg); }
  const core = at(new T.Mesh(new T.SphereGeometry(.075, 14, 10), mat(T, 0xe8ff9a, 0xb8ff50, 2.4)), 0, .1, 0); core.name = 'core'; head.add(core);
  return root;
}
// Spore mushroom: a stubby pale body on root feet under a wide cap dotted with glowing spots.
export function buildSporer(T) {
  const root = new T.Group(), body = grp(T, 'body'), flesh = mat(T, 0xd8c8a8, 0x201810, .15, .85);
  const stalk = at(new T.Mesh(new T.CylinderGeometry(.21, .28, .62, 16), flesh), 0, .31, 0); body.add(stalk);
  const eyeM = mat(T, 0xd8ff8a, 0xa8ff40, 2.6); for (const s of [-1, 1]) body.add(at(new T.Mesh(new T.SphereGeometry(.045, 8, 6), eyeM), s * .09, .4, .235));
  const mouth = at(new T.Mesh(new T.TorusGeometry(.05, .012, 6, 12, Math.PI), mat(T, 0x2a1a10)), 0, .3, .26); mouth.rotation.z = Math.PI; body.add(mouth);
  const face = grp(T, 'face'); face.position.set(0, .4, .25); body.add(face);
  const cap = grp(T, 'cap'), capM = new T.Mesh(new T.SphereGeometry(.4, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(T, 0xa83a6a, 0x30081a, .3, .7)); capM.scale.set(1, .7, 1); cap.add(capM);
  const gill = new T.Mesh(new T.CircleGeometry(.4, 24), mat(T, 0x6a3a3a, 0x000000, 0, .9)); gill.rotation.x = Math.PI / 2; cap.add(gill);
  const spotM = mat(T, 0xe8ffa0, 0xb0ff50, 1.8);
  for (let k = 0; k < 9; k++) { const a = k * 2.4, el = .35 + (k % 3) * .3, sp = new T.Mesh(new T.SphereGeometry(.05 + (k % 2) * .025, 10, 8), spotM);
    sp.position.set(Math.cos(a) * Math.cos(el) * .4, Math.sin(el) * .28, Math.sin(a) * Math.cos(el) * .4); sp.scale.set(1, .5, 1); cap.add(sp); }
  cap.position.y = .6; cap.rotation.x = -.35; body.add(cap); body.position.y = .12; root.add(body);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, leg = grp(T, 'leg' + i), f = new T.Mesh(new T.CylinderGeometry(.05, .03, .2, 6), mat(T, 0x5a4a32, 0, 0, .9)); f.position.y = -.08; f.rotation.z = .3; leg.add(f); leg.position.set(Math.cos(a) * .18, .16, Math.sin(a) * .18); leg.rotation.y = -a; root.add(leg); }
  return root;
}
// Elder Treant (guardian): a tapering trunk on two root legs, branch arms with twig fingers, a glowing face and a
// leafy crown with spirit blossoms. Parts: body, face, crown, armL/armR (+ elbowL/elbowR), legL/legR.
export function buildTreant(T) {
  const root = new T.Group(), bark = mat(T, 0x5a4230, 0x120a04, .2, .95), dark = mat(T, 0x2e2018, 0, 0, .95), moss = mat(T, 0x5a8a34, 0x10280a, .35, .8);
  const body = grp(T, 'body'); body.position.y = .62; root.add(body);
  const trunk = at(new T.Mesh(new T.CylinderGeometry(.3, .4, 1.25, 14, 4), bark), 0, .55, 0); body.add(trunk);
  for (let i = 0; i < 7; i++) { const a = i * .9, r = new T.Mesh(new T.BoxGeometry(.05, .9 + (i % 3) * .15, .04), dark); r.position.set(Math.cos(a) * .36, .5, Math.sin(a) * .36); r.rotation.y = -a; body.add(r); }
  for (let i = 0; i < 4; i++) { const m = new T.Mesh(new T.SphereGeometry(.16, 10, 8), moss); m.scale.set(1.2, .5, .8); const a = i * 1.7 + .4; m.position.set(Math.cos(a) * .34, .2 + i * .25, Math.sin(a) * .34); body.add(m); }
  const face = grp(T, 'face'); face.position.set(0, .78, .33); body.add(face);
  const eyeM = mat(T, 0xd8ff9a, 0x9aff40, 3);
  for (const s of [-1, 1]) { const sock = at(new T.Mesh(new T.SphereGeometry(.09, 10, 8), dark), s * .12, 0, -.02); sock.scale.set(1.3, .8, .6); face.add(sock); face.add(at(new T.Mesh(new T.SphereGeometry(.06, 10, 8), eyeM), s * .12, 0, .03)); }
  const mouth = at(new T.Mesh(new T.BoxGeometry(.24, .06, .06), mat(T, 0x1a0e06, 0x80ff40, 1.4)), 0, -.2, 0); face.add(mouth);
  const crown = grp(T, 'crown'); crown.position.set(0, 1.42, -.12); crown.scale.set(1.1, .7, 1); body.add(crown);
  const leafA = mat(T, 0x2e6a2a, 0x0a2a08, .3, .8), leafB = mat(T, 0x4a8a34, 0x143a0a, .35, .8), bloom = mat(T, 0xffe8a0, 0xffc860, 2.2);
  for (let i = 0; i < 9; i++) { const a = i * 2.3, rr = i ? .32 : 0, b = new T.Mesh(new T.IcosahedronGeometry(.28 + (i % 3) * .06, 1), i % 2 ? leafA : leafB); b.position.set(Math.cos(a) * rr, .12 + (i % 3) * .12, Math.sin(a) * rr); b.scale.y = .75; crown.add(b); }
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + .2, f = new T.Mesh(new T.SphereGeometry(.05, 8, 6), bloom); f.position.set(Math.cos(a) * .48, .2 + (i % 2) * .18, Math.sin(a) * .48); crown.add(f); }
  for (const s of [-1, 1]) {
    const arm = grp(T, s > 0 ? 'armL' : 'armR'); arm.position.set(s * .32, 1.0, 0); body.add(arm);
    const up = new T.Mesh(new T.CylinderGeometry(.07, .1, .55, 8), bark); up.rotation.z = s * 1.0; up.position.set(s * .22, -.12, 0); arm.add(up);
    const elbow = grp(T, s > 0 ? 'elbowL' : 'elbowR'); elbow.position.set(s * .45, -.28, 0); arm.add(elbow);
    const lo = new T.Mesh(new T.CylinderGeometry(.05, .07, .5, 8), bark); lo.position.set(0, -.24, .05); lo.rotation.x = .2; elbow.add(lo);
    for (let k = 0; k < 3; k++) { const tw = new T.Mesh(new T.ConeGeometry(.025, .22, 5), dark); tw.position.set((k - 1) * .05, -.52, .1); tw.rotation.set(Math.PI + .3, 0, (k - 1) * .4); elbow.add(tw); }
    const lf = new T.Mesh(new T.IcosahedronGeometry(.12, 0), leafB); lf.position.set(s * .12, -.05, 0); elbow.add(lf);
    const leg = grp(T, s > 0 ? 'legL' : 'legR'); leg.position.set(s * .18, .66, 0); root.add(leg);
    const th = new T.Mesh(new T.CylinderGeometry(.12, .16, .62, 8), bark); th.position.y = -.31; leg.add(th);
    for (let k = 0; k < 3; k++) { const a = (k - 1) * .7, toe = new T.Mesh(new T.ConeGeometry(.06, .3, 5), dark); toe.position.set(Math.sin(a) * .14, -.62, Math.cos(a) * .14); toe.rotation.set(Math.PI / 2 * Math.cos(a) + .3, 0, -Math.PI / 2 * Math.sin(a)); leg.add(toe); }
  }
  return root;
}
// Sönmüş Ay (final guardian): a cracked, dimmed moon floating over the ground, light leaking from its cracks, a
// slit eye in the middle and a ring of shards orbiting it. Parts: body, ring, eye, shell, shard0..shard9.
export function buildMoon(T) {
  const root = new T.Group(), body = grp(T, 'body');
  const geo = new T.IcosahedronGeometry(.62, 4), pos = geo.attributes.position, v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = Math.sin(v.x * 9) * Math.sin(v.y * 7 + 1) * Math.sin(v.z * 8 + 2); v.multiplyScalar(1 + .035 * n); pos.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const shell = new T.Mesh(geo, mat(T, 0x8a86b0, 0x2a2350, .7, .85)); shell.name = 'shell'; body.add(shell);
  const crack = mat(T, 0xe8e0ff, 0xb8a8ff, 2.6);
  for (let i = 0; i < 9; i++) { const a = i * 1.7, b = (i % 3 - 1) * .5, c = new T.Mesh(new T.BoxGeometry(.03, .5 + (i % 3) * .15, .03), crack);
    c.position.set(Math.cos(a) * .6 * Math.cos(b), Math.sin(b) * .6, Math.sin(a) * .6 * Math.cos(b)); c.lookAt(0, 0, 0); c.rotateX(Math.PI / 2); c.rotateZ(i); body.add(c); }
  for (let i = 0; i < 6; i++) { const a = i * 2.3 + .5, cr = new T.Mesh(new T.SphereGeometry(.09 + (i % 2) * .05, 10, 8), mat(T, 0x3a3652, 0, 0, .95)); cr.scale.set(1, 1, .3); cr.position.set(Math.cos(a) * .58, (i % 3 - 1) * .3, Math.sin(a) * .58); cr.lookAt(0, 0, 0); body.add(cr); }
  const eye = grp(T, 'eye'); eye.position.set(0, .05, .6); body.add(eye);
  const iris = new T.Mesh(new T.SphereGeometry(.17, 16, 12), mat(T, 0xf4f0ff, 0xd0c4ff, 3.2)); iris.scale.set(1.5, .55, .5); eye.add(iris);
  const pupil = new T.Mesh(new T.SphereGeometry(.06, 10, 8), mat(T, 0x140a28, 0x000000, 0)); pupil.scale.set(.5, 1.3, .5); pupil.position.z = .05; eye.add(pupil);
  const ring = grp(T, 'ring'); body.add(ring);
  for (let i = 0; i < 10; i++) { const sh = grp(T, 'shard' + i), m = new T.Mesh(new T.OctahedronGeometry(.07 + (i % 3) * .025, 0), mat(T, 0xc8c0ff, 0x8a7aff, 1.6, .3)); m.scale.set(.6, 1.6, .6); sh.add(m); const a = i * TAU10;
    sh.position.set(Math.cos(a) * 1.0, Math.sin(i * 1.3) * .12, Math.sin(a) * 1.0); sh.rotation.z = a; ring.add(sh); }
  ring.rotation.x = .35;
  // trailing tendrils of shadow under the moon
  const tm = mat(T, 0x2a2048, 0x1a0a3a, .6, .9);
  for (let i = 0; i < 5; i++) { const a = i * 1.26, c = new T.CatmullRomCurve3([new T.Vector3(Math.cos(a) * .3, -.45, Math.sin(a) * .3), new T.Vector3(Math.cos(a) * .45, -.8, Math.sin(a) * .45), new T.Vector3(Math.cos(a + .4) * .35, -1.05, Math.sin(a + .4) * .35)]);
    const t = new T.Mesh(new T.TubeGeometry(c, 10, .05, 6), tm); t.name = 'tendril' + i; body.add(t); }
  body.position.y = 1.35; root.add(body);
  return root;
}
const TAU10 = Math.PI * 2 / 10;
