# Neon Swarm Core v2.1 Developer Mechanics Guide

This guide reflects the implemented v2.1 code in `src/`. It is an audit of the actual mechanics, not a design target.

## Project Structure

- `src/App.tsx`: React shell, screen state, HUD, controls, fixed-step loop, speed multiplier, run summary, audio event routing.
- `src/App.css`: vertical 9:16 layout, HUD, upgrade panel, menu, controls, cinematic styling.
- `src/game/simulation.ts`: deterministic simulation state, entity updates, upgrades, waves, infection, Shock, economy, run stats.
- `src/game/render.ts`: Canvas renderer for background, traces, lines, workers, nodes, viruses, beams, particles, Shock rings, Core, event labels.
- `src/game/audio.ts`: lazy Web Audio procedural sound layer.
- `src/game/types.ts`: entity, snapshot, upgrade, and render option types.
- `src/game/constants.ts`: world size, gameplay bounds, initial counts, caps, seed, storage key.
- `src/game/math.ts`, `src/game/random.ts`, `src/game/input.ts`: helpers.

## Main Loop

`App.tsx` runs `requestAnimationFrame`, accumulates elapsed real time, and advances `Simulation.update()` in fixed `FIXED_DT = 1 / 60` steps. Render still happens once per animation frame. Pause stops simulation updates but not rendering.

When the Core collapses, `destroyCore()` stores `survivedTime`. The simulation `time` keeps advancing for collapse animation, but snapshots report the frozen survived time for high score and run summary.

The speed button multiplies accumulated simulation time by `1`, `2`, `3`, or `4`. Substeps are capped per rendered frame:

- `1x` and `2x`: max 5 fixed steps
- `3x`: max 7 fixed steps
- `4x`: max 8 fixed steps

If the cap is reached, the leftover accumulator is dropped to avoid runaway catch-up.

## HUD And Layout

The frame remains a vertical 900x1600 world rendered into a 9:16 shell. The bottom HUD is a five-stat row: Energy, Infection, Workers, Nodes, and Shock. Workers display current/capacity. Shock displays charge and current Shock power.

The normal-mode event label is rendered at `GAMEPLAY_BOUNDS.minY - 42`, below the upgrade panel and above the main gameplay field. Cinematic event labels stay near the top.

Important activity is kept away from the bottom HUD by `GAMEPLAY_BOUNDS`:

- `minX = 54`
- `maxX = WORLD_WIDTH - 54`
- `minY = 330`
- `maxY = WORLD_HEIGHT - 225`

Energy, beacons, node placement, bloom centers, and worker movement are clamped into or near these bounds. This keeps nodes and worker activity from sitting behind the lower stat cards.

## Upgrade System

Upgrade Points are earned in `updateUpgradePoints()`: +1 point every 5 simulated seconds while not on the menu and while the Core is alive. Cost is `1 + currentLevel`. All six upgrades have max level 10.

Cinematic Mode auto-spends one affordable upgrade every 4.2 seconds using this priority: Speed, Fire, Workers, Shield, Repair, Shock, preferring the lowest level.

Upgrade card values are generated from the same helper methods used by gameplay:

- Speed: worker movement multiplier `1 + level * 0.045`; delivered energy multiplier `1 + level * 0.025`. UI shows movement multiplier.
- Fire: node fire-rate multiplier `1 + level * 0.075`; node spin and beam width also increase, and high Fire levels brighten beam/node color.
- Shield: Core damage multiplier `1 - min(0.44, level * 0.055)`; infection resistance multiplier `1 - min(0.34, level * 0.04)`. UI shows `1 / damageMultiplier`.
- Repair: worker repair multiplier `1 + level * 0.12`; higher levels emit more repair particles.
- Workers: rebuild/growth multiplier `1 + level * 0.1`; capacity rises by `level * 5` in Normal Mode and `level * 3` in Cinematic Mode, clamped by `MAX_WORKERS`.
- Shock: damage multiplier `1 + level * 0.12`; radius multiplier `1 + level * 0.035`; cleaning multiplier `1 + level * 0.08`; repel multiplier `1 + level * 0.06`.

Keyboard shortcuts remain `1` through `6`, but the visible upgrade cards do not show number badges.

## Worker Lifecycle

Initial worker count equals current capacity at reset. Base capacity is `INITIAL_WORKERS = 118` in Normal Mode and `CINEMATIC_WORKERS = 138` in Cinematic Mode. `MAX_WORKERS = 168`.

Workers can be lost only outside the menu. Loss is globally rate-limited by `workerLossCooldown`, and the simulation will not drop below `max(46, capacity * 0.46)` workers.

Loss sources:

- Direct virus contact: distance below `virus.radius + 7` for normal viruses or `virus.radius + 10` for elites. Per-frame chance is `dt * 0.66` for normal viruses or `dt * 1.05` for elites, capped at `0.16`.
- General danger: `avoidanceStrength * 0.45 + infection * 0.9` must exceed `0.7`, then loss chance is `dt * 0.018 * danger`.

When a worker is lost, cooldown is `1.25-2.1s` for normal danger or `0.9-1.45s` for elite contact. Carrying workers may drop a replacement energy pickup at their position with 45% normal or 75% rare chance.

The Core rebuilds workers automatically in `updateWorkerRebuild()` when below capacity:

- Rebuilding does not run in the menu.
- Timer drains by `dt * workerGrowthMultiplier * lerp(1, 1.65, missingRatio)`.
- Spawn interval after a rebuild is `1.55-2.45s / workerGrowthMultiplier`.
- Rebuild cost is `max(7.5, 9.5 + max(0, workers - 90) * 0.035 - workerLevel * 0.18)`.
- The Core keeps an energy reserve of `14`, or `4` if more than 22% of workers are missing.

## Shock

`triggerShockwave(force = false)` stays Core-centered. Manual Shock requires full charge. Forced Shock is used by the director/auto-defense and consumes most charge.

Current Shock formulas:

- `charge = force ? max(core.shockCharge, 0.65) : core.shockCharge`
- `damagePower = 1 + shockLevel * 0.12`
- `radiusPower = 1 + shockLevel * 0.035`
- `cleanPower = 1 + shockLevel * 0.08`
- `repelPower = 1 + shockLevel * 0.06`
- radius: `(280 + charge * 145) * radiusPower`
- damage: `(54 + charge * 94) * damagePower`
- repel velocity: `180 * repelPower * distanceFalloff`
- particles: `52 + shockLevel * 2`

Successful Shock increments `shocksUsed`, consumes charge, pulses the Core, damages and repels viruses inside radius, reduces node and line infection near the Core, heals nearby nodes slightly through the cleaning effect, spawns two expanding rings, adds particles, and increases screen shake.

There is no passive per-use Shock power scaling in v2.1. Shock growth comes only from the Shock upgrade.

## Wave And Threat Scaling

Virus pacing is unchanged from v2:

- First wave starts at about `7.2s` in Normal Mode and `5.4s` in Cinematic Mode.
- New waves spawn every `25-30s` before 120 seconds, then every `21-27s`.
- Wave count formula: `round(clamp((9 + min(3, waveIndex)) * 1.1^waveIndex, 9, earlyCapOr42))`.
- Before 120 seconds, max wave count is `18 + wave`; after that the count cap is 42.
- Elite chance is `0.02` for waves 1-2, then `min(0.05 + wave * 0.012, 0.24)`.
- HP scale is `1 + min(waveIndex * 0.045, 1.1)`.
- Speed scale is `1 + min(waveIndex * 0.032, 0.55)`.
- Infect scale is `1 + min(waveIndex * 0.025, 0.45)`.

Base virus HP is `34 + min(time * 0.035, 30)`. Base elite HP is `118 + min(time * 0.08, 70)`. Base speed is `72` normal and `52` elite, multiplied by wave speed scale. Elite infect power starts at `1.7`, normal at `1.0`, then uses wave infect scale.

## Infection Calculation

`calculateInfection()` returns:

`nodeScore * 0.42 + lineScore * 0.36 + virusPressure * 0.22`, clamped to `0..1`.

- `nodeScore` averages node infection plus damaged-health contribution `(1 - health / maxHealth) * 0.25`.
- `lineScore` averages line infection.
- `virusPressure` is active viruses within 320 world units of the Core divided by 28, clamped to `0..1`.

Line infection passively decays by `dt * 0.006`. Node infection receives connected line pressure and decays by `dt * 0.004`. Nodes above `0.82` infection lose health. Core Shield reduces virus-applied node/line infection, line-pressure spread, and outbreak infection.

## Energy Economy

Ambient energy spawns every `0.22-0.62s` outside the menu, capped by `MAX_ENERGY = 96`. Normal energy is worth about `4-7.5`; rare energy is worth about `13-20`. Workers deliver energy to the Core, increment `energyCollected`, and charge Shock by `value / 120` or `value / 70` for rare energy.

Core energy is spent automatically on Core repair, worker rebuilding, node construction, and node upgrades:

- Worker rebuild cost: see Worker Lifecycle.
- Node cost: `36 + nodes.length * 12`.
- Automatic node upgrade cost: `34 + node.level * 24`.
- Node max level for auto upgrades is 4.

## Render Pipeline

`renderSimulation()` clears the canvas, maps world coordinates to the vertical 900x1600 world, applies screen shake and optional cinematic pan/zoom, then draws in this order:

background, circuit lines, beacons, energy, workers, nodes, viruses, beams, particles, Shockwaves, Core, screen pulse, event label, debug overlay.

The renderer uses generated canvas shapes only. There are no external art assets.

## Audio

`GameAudio` does not create an `AudioContext` until `resume()` is called after Start or another in-game interaction. Sounds are procedural oscillators only, no audio files. Audio events are derived from snapshot deltas in `App.tsx` and rate-limited in `audio.ts`.

Events: energy delivered, node laser tick, wave warning, upgrade chime, Shock bass pulse, Core damage impact. `M` and visible Mute buttons toggle audio.

## Performance Notes

- World and entity counts are capped: workers 168, energy 96, viruses 88, particles 720, beams 60, Shockwaves 12, nodes 15.
- Cleanup slices arrays back to caps after each update.
- Fixed-step simulation avoids frame-rate dependent physics.
- Speed mode drops excess accumulated time after substep caps, which favors stability over exact catch-up.
- Canvas DPR is capped to 2.5.

## Known Limitations

- There is no manual node placement or tower shop; node construction remains automatic.
- There is no save file for upgrade progress because each run is self-contained.
- High score uses localStorage only.
- Cinematic auto-spending is simple and does not adapt deeply to threat state.
- Worker deaths are intentionally soft and rate-limited; they add colony motion, not harsh attrition.
- Audio is intentionally minimal and depends on browser autoplay/user-gesture policies.

## Safe Balance Tuning

- Keep `MAX_VIRUS`, `MAX_PARTICLES`, `MAX_WORKERS`, and substep caps conservative before raising visual density.
- Tune wave count, elite chance, HP scale, speed scale, and infect scale in `spawnNextWave()` together; changing only one can create unreadable difficulty spikes.
- Adjust upgrade multipliers in their helper methods rather than scattering numbers through update code.
- Keep Shock radius growth lower than damage growth. Radius affects readability and can wipe too much of the board.
- Preserve early wave gaps and early caps if the first two minutes should stay meditative.
