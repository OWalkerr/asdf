# Godot porting guide

The web build (`game/index.html`) is finished and playable, and it is the reference for every rule and number. This
guide maps it onto a Godot 4 project, gives the order to build things in, and names the JS functions to read for each
system. Design intent and every number in Turkish: `DESIGN.md`.

## 1. Big decisions

| Topic | Decision | Why |
|---|---|---|
| Engine | Godot 4.4+, GDScript (typed) | Desktop and mobile exports, good 3D at low cost. |
| World | **3D scene, gameplay on the XZ plane**, orthographic `Camera3D` pitched 51°, follows the fox with a small lead in the facing direction | Matches the art direction; the baked GLBs render natively, with real lighting. |
| Scale | 1 m = 100 web units. Arena radius 8.2 m. | All JSON values are web units. |
| Characters | `export/models/*.glb`; every animation is a clip (`walk`, `attack`, `die`; fox `idle`, `walk`, `run`, `hop`, `cast`). | Godot's importer creates an `AnimationPlayer`. |
| Look | Ori-like painterly. A `WorldEnvironment` with glow (bloom threshold high, so only real lights bloom); a full-screen Kuwahara / brush post-shader at ~55% mix; GPU particles for smoke, embers, snow and fireflies; soft coloured point lights from braziers, spears and bolts. The fox and the UI stay crisp (render them after the paint pass or on a separate viewport layer). | Reproduces `glPost`, `glScene` and `glParticles` in the web build. |
| Data | Load `export/data/*.json` at start (or convert to `.tres`). Effects listed as JS source strings become GDScript functions keyed by id. | One source of truth for the numbers. |
| Audio | `export/audio`: sfx and voices (one-shots, pan by screen x), biome ambience loops and music loops. Buses: Master ← Music (ducked), Ambience (ducked), SFX; a reverb send; a low-pass on Master for slow motion and heavy hits. | Matches `buildAudio`. The music in the web build is generative; the exported loops are a stand-in. A later step can port `schedMusic` (pad, pluck, bass and drums driven by intensity), scheduled from the audio clock. |
| Save | `user://save.json`, same fields as the web `meta` object (shards, best, upgrades, achievements, story flags, vows, wins). | |

## 2. Scene and node layout (suggested)

```
godot/
  project.godot
  autoload/   game.gd (run state)   meta.gd (save)   audio.gd   data.gd (loads export/data JSON)
  scenes/
    main.tscn            screens + arena viewport
    arena/arena.tscn     floor, wall rim, braziers, decor per biome, layouts (pillars, chasm, collapse)
    player/fox.tscn      CharacterBody3D-less: kinematic Node3D; fox.glb; state machine idle/windup/post/hop/rise/fling
    combat/spear.tscn    light spear (pooled), sticking, return (Ay Mızrağı), bounce
    enemies/enemy.tscn   shared base (hp, stacks, slow, stun, burn, freeze, knockback, elite) + one script per AI type
    bosses/*.tscn        lord, rider, queen, cardinal, treant, moon
    fx/                  hit star, star burst, shock ring, numbers, gibs, smoke, light shafts
    ui/                  hud, draft, doors, forms, events, den, pause, run over, end, vows, test room
  tests/smoke.gd
```

Keep game logic in plain scripts that update in `_physics_process` (fixed 60 Hz), the way the web `update(dt)` does.
Hit-stop and slow motion scale the delta like `frame()` does; use `Engine.time_scale` or your own scale.

## 3. Where each system lives in the web build

Search `game/index.html` for these function names (`grep -n "function NAME"`).

| System | Functions |
|---|---|
| Run state, stats | `newRun`, `baseStats`, `recomputeStats`, `G` object (fields in `newRun`) |
| Player | `update` (the `switch (p.state)` block), `attackThrow`, `fireSpear`, `spearDmg`, `startHop`, `endHop`, `castR` and `rImpact` (Ay Sıçrayışı), `queueQ`, `castRend` and `rendDmg` (Söküm), `invuln`, `hurt`, `heal` |
| Coşku and perfect hop | `addFervor`, `updFervor`, `asMul`, `threatened`, `perfectHop` |
| Ruh Biçimleri | `FORMS`, `showForms`; mechanics inside `startHop`, `endHop` and the `hop` state (`hook`, `bolt`, `wall`, `double`, `time`) |
| Patrons | `patronHit`, `ignite`, `thermalBlast`, `chillHit`, `chainFrom`, `updPatron`; spear return in the spear loop in `update` (`sp.ret`) |
| Enemies | `EDEF`, `makeEnemy` (scaling per room), `makeEnemyFull` (elites, guardian tweaks), `updEnemy` (one `case` per type), `finishEnemy` (movement, contact damage), `eshot`, `spores`, `bombBlast`, `dmgEnemy`, `killEnemy`, `shatter` |
| Guardians | `bossKind`, `bossName`, `bossAI` (lord), `riderAI`, `queenAI`, `cardinalAI`, `treantAI`, `moonAI`, `startExtra` and `bossExtra` (ascended), second form in `killEnemy` and `updEnemy` (`reform`) |
| Entrance | `startIntro`, `updIntro`, `BOSS_EPI` |
| Rooms and waves | `roomWaves`, `chestWaves`, `bossWaves`, `nextRoom`, `spawnWave`, `tickSpawns`; clearing in `update` (`// waves`) |
| Objectives and layouts | `rollRoomMods`, `setupRoomMods`, `updObjective`, `objCleared`, `makeLayout`, `inVoid`, `pushOut`, `enemyLayout`, `drawLayout` |
| Between rooms | `showDraft`, `rollDraft`, `pick`, `showPath` (doors), `chooseDoor`, `showMerchant`, `renderAltar`, `showEvent` and `EVENTS` |
| Meta | `meta`, `SHOP`, `ACH` and `unlock`, `TRAILS`, `HEROES` (+ locks), `VOWS`, `dailyInfo` and `DAILY_MODS`, `startTest` (test room) |
| Story | `STORY`, `ADVICE`, `showDen`, `drawDen`, `LORE` |
| End | `victory`, `gameOver` |
| Tutorial | `TUT`, `updTutorial` |
| Look | `THEMES` (biome colours), `buildFloor` and `paintLater` (painted floor), `glScene`, `glPost`, `glParticles`, `FIELD`, `GRADE`, `GLT`, `drawFxLit`, `drawStacks`, `twinkle`, `starBoom`, `shock` |
| Audio | `buildAudio`, `SND`, `DIE`, `SENDS`, `VOL`, `DVOL`, `AMBT` and `startAmb`, `MTHEME` and `schedMusic`, `beatPulse` (lights pulse on drum hits) |
| Input | `inputDir` (joystick and keys; screen direction → world direction divides y by `TK`), `bindBtn`, options in `syncTouch` |

`export/data/combat.json`, `guardians.json` and `objectives.json` already contain the source of the most important
functions, so they can be read without opening the HTML.

## 4. Milestones

Tick these as they land. Each milestone ends runnable, tested and committed.

- [ ] **M1 Vertical slice:**
  - Arena (floor disc, rim, 4 braziers with lights), orthographic camera at 51°.
  - Fox from `fox.glb`, joystick and WASD movement, auto-throw at the nearest ghoul in range, hop in the held
    direction after each throw, spears sticking (stack counter), Söküm on E.
  - Ghouls spawning in waves, hit flash, death.
  - Basic HUD (HP, room).
- [ ] **M2 Combat feel:**
  - Q and R skills, crits, damage numbers, hit-stop, screen shake (layered sines), slow motion.
  - Shock-wave rings, star bursts, gibs.
  - Coşku meter and frenzy, Mükemmel Sekme.
- [ ] **M3 Run structure:**
  - Rooms 1–40, waves and budgets (`roomWaves`), room clear, 3-card draft with rarity weights and synergies.
  - Doors (fight, elite, cursed, chest/mimic, rest, shop, altar, patron, event).
  - Game over screen with damage sources.
- [ ] **M4 Enemies:** all 15 types with their AI and telegraphs; elites (shield, fast, explosive); ice and forest
  variants.
- [ ] **M5 Guardians:** intro cinematic, lord, rider, queen, cardinal, treant, then moon (three phases, shrinking
  arena) and the ending screen and endless mode. Ascended extras and second form.
- [ ] **M6 Objectives, layouts, forms, patrons:** siege, hunt, lantern, gauntlet; pillars, chasm, collapse; 5 movement
  forms; 4 patrons and duo powers.
- [ ] **M7 Biomes and look:**
  - The four biomes (colours from `biomes.json`; floor, walls, decor, fog, particles, light shafts, foreground
    silhouettes).
  - Painterly post-process and glow, beat-synced brazier pulse.
- [ ] **M8 Meta:** save, Ruh Sunağı shop, achievements and furs, trails, heroes and the locked Forest Fox, daily hunt,
  vows, den and story, test room, tutorial.
- [ ] **M9 Audio:** buses, pan, ducking, slow-motion low-pass, ambience per biome, music per theme (loops first;
  generative later).
- [ ] **M10 Mobile:** touch controls (floating or fixed joystick, left-handed mode, big buttons, sensitivity), quality
  levels, 30 fps battery mode, Android and iOS export, safe areas.

## 5. Gotchas from the web build

- **Three-quarter view:** the web build squashes world y by `TK` on screen. In Godot 3D with a 51° camera this happens
  naturally. Do not squash anything yourself.
- **Hop:**
  - The distance depends on the angle to the facing direction: toward the target ×0.6, sideways ×1, backwards ×1.25.
  - It lasts `hopTime` = 0.15 s.
  - It is invulnerable only with Hayalet Adım, Yıldırım Adım or Gölge Tilki.
  - Scream rings and light arms are dodged by being airborne (`hop`, `rise`, `fling` states).
- **Söküm damage:** `dmg × (1 + rendPer × (stacks − 1)) × rendMul`; a kill makes the cooldown short (0.5 s).
- **Enemies and guardians:**
  - Enemy health per room: `makeEnemy` (frailer ×0.72 since the action pass).
  - Guardian health grows per tier.
  - Second form returns with 35% health from room 10 on (not the moon).
- **Balance:** `tools/balance-sim.js` (headless bot) reached median room 10–16 with maxed meta. Keep the port within
  that range.
- **Seeded runs:** the daily hunt uses `mulberry32(seed)` through `crand()` for every random choice that shapes the run
  (doors, waves, drafts). Combat randomness uses `Math.random`. Mirror this split so daily runs match across players.
