# Ruh Tilkisi: Godot port

**Talk to the user in Turkish.** The user is a game developer moving this project from the browser to Godot on
their own computer. They test on PC first and then on phones (Android and iOS). Explain choices briefly. Ask before
large, irreversible changes. Commit often, with clear messages.

## What this project is

*Ruh Tilkisi* ("Spirit Fox") is a fast, mobile-first action roguelite with a three-quarter top-down camera. You play
a white spirit fox in a sunken dungeon whose moon has gone dark.

- **Core loop:** the fox auto-throws a light spear at the nearest enemy. Holding a direction while it throws makes
  the fox **hop** that way. Spears **stick** in enemies; **Söküm (E)** rips every stuck spear out at once for damage
  that grows with the stack count.
- **Other skills:** Delici Işık (Q) is a piercing beam. Ay Sıçrayışı (R) is a leap and slam.
- **A run:** 40 rooms across four biomes, guardians every 5 rooms, ending with **Sönmüş Ay** in room 40. After the
  win the run can continue as an endless hunt.
- **Between rooms:** card drafts, doors with objectives, movement forms and patron spirits.
- **Between runs:** meta-progression, story told in a den, and optional difficulty vows.

The **complete, playable reference implementation** is the web build: `game/index.html`, about 4,500 lines of vanilla
JS plus embedded sprite atlases.

- It is the source of truth for rules, numbers and feel.
- When porting a system, read the matching JS function and reproduce its behaviour.
- Keep the web build untouched unless the user asks.

## Where things are

| Path | What |
|---|---|
| `game/index.html` | Reference game. Search by function name (see `docs/GODOT-PORT.md` for the map of systems). |
| `DESIGN.md` | Full design document in Turkish: every mechanic, number, enemy, guardian, card, room type and the history of balance changes. |
| `docs/GODOT-PORT.md` | **Porting guide: start here.** Architecture plan, coordinate mapping, milestone order, system-by-system notes. |
| `export/data/*.json` | All game data as JSON: powers, heroes, enemies, guardians, biomes, doors, objectives, events, story, vows, achievements, music themes. Effects and AI are kept as JS source strings (`effect`, `ai`, `requires`) so formulas are exact. |
| `export/models/*.glb` | 19 animated models, ready for Godot (fox, all enemies and guardians). Every animation (`walk`, `attack`, `die`, fox `idle/walk/run/hop/cast`) is baked in as a real clip. `models.json` gives scale and eye-glow per model. |
| `export/audio/*.wav` | 49 sound effects / death voices / biome ambiences and 8 music loops, rendered from the web build's synth. |
| `export/sprites/` | The 2D sprite atlases (WebP) and frame metadata, if a sprite fallback is ever wanted. |
| `assets/` | Original Meshy GLBs (raw, before animation baking). |
| `tools/sprite-render/` | three.js + Playwright pipeline: `render.js` bakes sprite atlases; `export.js` bakes animated GLBs (`configs.js` holds every hand-written animation; `models.js` the code-built models). |
| `tools/export-data.js` | Regenerates `export/data`, `export/audio`, `export/sprites` from the web build. |
| `tools/balance-sim.js` | Headless bot that plays the web build and reports room reached and damage sources (use it to compare balance). |
| `godot/` | **The Godot project (to be created).** |

## Godot conventions

- **Engine and language:** Godot **4.4+**, GDScript with static typing. Use the Forward+ renderer on desktop and Mobile
  on phones; the visuals must degrade gracefully.
- **Code style:**
  - Files and nodes in `snake_case.gd` / `PascalCase` node names.
  - One script per scene where possible.
  - Data-driven: load the JSON in `export/data` (or `.tres` converted from it) instead of hard-coding tables.
- **Autoloads:** `Game` (current run state), `Meta` (save data: `user://save.json`), `Audio` (buses, sfx and music).
- **Units:** 1 Godot metre = 100 web units (arena radius 820 → 8.2 m). Gameplay happens on the XZ plane: web `x` →
  `X`, web `y` → `Z`. All speeds, ranges and radii in the JSON are in web units: divide by 100.
- **Camera:** orthographic, pitched 51° down (matches the baked art and the web build's `TK = sin 51° ≈ 0.78`).
- **Tests:** keep a headless smoke test runnable with `godot --headless --path godot -s res://tests/smoke.gd` and run it
  before every commit.
- **Mobile:** touch joystick plus E/Q/R buttons (sizes and options as in the web build's pause menu). Target 60 fps on
  mid-range phones.

## Working rhythm

1. Read `docs/GODOT-PORT.md`, then the milestone you are on.
2. For each system, open the matching function in `game/index.html` and port it faithfully. Numbers come from the
   JS, not from memory.
3. Make it run, show the user (screenshots or a short description of what to try), commit.
4. Update `docs/GODOT-PORT.md` milestone checkboxes as you go.
