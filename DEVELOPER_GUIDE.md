# Neon Swarm Core v2 Developer Mechanics Guide

This guide reflects the implemented v2 code in `src/`. It is an audit of the actual mechanics, not a design target.

## Project Structure

- `src/App.tsx`: React shell, screen state, HUD, controls, fixed-step loop, speed multiplier, run summary, audio event routing.
- `src/App.css`: vertical 9:16 layout, HUD, upgrade panel, menu, controls, cinematic styling.
- `src/game/simulation.ts`: deterministic simulation state, entity updates, upgrades, waves, infection, Shock, economy, run stats.
- `src/game/render.ts`: Canvas renderer for background, traces, lines, workers, nodes, viruses, beams, particles, Shock rings, Core, event labels.
- `src/game/audio.ts`: lazy Web Audio procedural sound layer.
- `src/game/types.ts`: entity, snapshot, upgrade, and render option types.
- `src/game/constants.ts`: world size, initial counts, caps, seed, storage key.
- `src/game/math.ts`, `src/game/random.ts`, `src/game/input.ts`: helpers.

## Main Loop

`App.tsx` runs `requestAnimationFrame`, accumulates elapsed real time, and advances `Simulation.update()` in fixed `FIXED_DT = 1 / 60` steps. Render still happens once per animation frame. Pause stops simulation updates but not rendering.

When the Core collapses, `destroyCore()` stores `survivedTime`. The simulation `time` keeps advancing for collapse animation, but snapshots report the frozen survived time for high score and run summary.

The speed button multiplies accumulated simulation time by `1`, `2`, `3`, or `4`. Substeps are capped per rendered frame:

- `1x` and `2x`: max 5 fixed steps
- `3x`: max 7 fixed steps
- `4x`: max 8 fixed steps

If the cap is reached, the leftover accumulator is dropped to avoid runaway catch-up.

## Entities

- Core: health, energy, Shock charge, pulse, damage flash, collapse timer.
- Workers: search, carry, repair, flee, or beacon states; collect energy and repair infection.
- Energy particles: normal or rare pickups with value and lifetime.
- Defense nodes: auto-built and auto-upgraded using Core energy; fire beams at viruses.
- Circuit lines: connect Core/nodes and store infection.
- Viruses: spawned by waves; target Core or nodes; damage, infect, and can be elite.
- Beams, particles, Shockwaves, beacons, traces, event labels: visual systems.

## Upgrade System

Upgrade Points are earned in `updateUpgradePoints()`: +1 point every 5 simulated seconds while not on the menu and while the Core is alive. Cinematic Mode auto-spends one affordable upgrade every 4.2 seconds using this priority: Swarm Speed, Node Fire Rate, Core Shield, Repair Power, preferring the lowest level.

All four upgrades have max level 8. Cost is `1 + currentLevel`.

- Swarm Speed: worker movement multiplier is `1 + level * 0.045`; delivered energy multiplier is `1 + level * 0.025`.
- Node Fire Rate: node cooldown uses fire-rate multiplier `1 + level * 0.075`; node spin, beam width, and node color get subtle visual boosts.
- Core Shield: Core damage multiplier is `1 - min(0.44, level * 0.055)`; infection pressure multiplier is `1 - min(0.34, level * 0.04)`.
- Repair Power: worker repair multiplier is `1 + level * 0.12`; higher levels emit more visible repair particles.

Upgrade purchases increment `upgradesPurchased`, pulse the Core, and emit a small Core-centered effect.

## Shock

`triggerShockwave(force = false)` stays Core-centered. Manual Shock requires full charge. Forced Shock is used by the director/auto-defense and consumes most charge.

Current Shock formulas:

- `charge = force ? max(core.shockCharge, 0.65) : core.shockCharge`
- `currentBonus = shockPowerBonus`
- radius: `(280 + charge * 145) * (1 + currentBonus * 0.34)`
- damage: `(54 + charge * 94) * (1 + currentBonus)`
- infection cleaning multiplier: `1 + currentBonus * 0.8`
- repel velocity: `180 * (1 + currentBonus * 0.45) * distanceFalloff`

Each successful Shock increments `shocksUsed` and raises `shockPowerBonus` by `0.1`, capped at `1.5` (+150%). Shock damages and repels viruses inside radius, reduces node and line infection near the Core, heals nearby nodes slightly, spawns two expanding rings, adds particles, increases Core pulse, and increases screen shake.

## Wave And Threat Scaling

Virus pacing is explicit in `spawnNextWave()`:

- First wave starts at about `7.2s` in Normal Mode and `5.4s` in Cinematic Mode.
- New waves spawn every `25-30s` before 120 seconds, then every `21-27s`.
- Wave count formula: `round(clamp((9 + min(3, waveIndex)) * 1.1^waveIndex, 9, earlyCapOr42))`.
- Before 120 seconds, max wave count is `18 + wave`; after that the count cap is 42.
- Elite chance is `0.02` for waves 1-2, then `min(0.05 + wave * 0.012, 0.24)`.
- HP scale is `1 + min(waveIndex * 0.045, 1.1)`.
- Speed scale is `1 + min(waveIndex * 0.032, 0.55)`.
- Infect scale is `1 + min(waveIndex * 0.025, 0.45)`.

Base virus HP is `34 + min(time * 0.035, 30)`. Base elite HP is `118 + min(time * 0.08, 70)`. Base speed is `72` normal and `52` elite, multiplied by wave speed scale. Elite infect power starts at `1.7`, normal at `1.0`, then uses wave infect scale.

The secondary director no longer spawns random virus waves. It handles energy blooms, forced Shock, auto node construction, auto node upgrades, infection outbreaks, and laser overdrive.

## Infection Calculation

`calculateInfection()` returns:

`nodeScore * 0.42 + lineScore * 0.36 + virusPressure * 0.22`, clamped to `0..1`.

- `nodeScore` averages node infection plus damaged-health contribution `(1 - health / maxHealth) * 0.25`.
- `lineScore` averages line infection.
- `virusPressure` is active viruses within 320 world units of the Core divided by 28, clamped to `0..1`.

Line infection passively decays by `dt * 0.006`. Node infection receives connected line pressure and decays by `dt * 0.004`. Nodes above `0.82` infection lose health. Core Shield reduces virus-applied node/line infection, line-pressure spread, and outbreak infection.

## Energy Economy

Ambient energy spawns every `0.22-0.62s` outside the menu, capped by `MAX_ENERGY = 96`. Normal energy is worth about `4-7.5`; rare energy is worth about `13-20`. Workers deliver energy to the Core, increment `energyCollected`, and charge Shock by `value / 120` or `value / 70` for rare energy.

Core energy is spent automatically on Core repair, node construction, and node upgrades:

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

- World and entity counts are capped: workers 150, energy 96, viruses 88, particles 720, beams 60, Shockwaves 12, nodes 15.
- Cleanup slices arrays back to caps after each update.
- Fixed-step simulation avoids frame-rate dependent physics.
- Speed mode drops excess accumulated time after substep caps, which favors stability over exact catch-up.
- Canvas DPR is capped to 2.5.

## Known Limitations

- There is no manual node placement or tower shop; node construction remains automatic.
- There is no save file for upgrade progress because each run is self-contained.
- High score uses localStorage only.
- Cinematic auto-spending is simple and does not adapt deeply to threat state.
- Audio is intentionally minimal and depends on browser autoplay/user-gesture policies.

## Safe Balance Tuning

- Keep `MAX_VIRUS`, `MAX_PARTICLES`, and substep caps conservative before raising visual density.
- Tune wave count, elite chance, HP scale, speed scale, and infect scale in `spawnNextWave()` together; changing only one can create unreadable difficulty spikes.
- Adjust upgrade multipliers in their helper methods rather than scattering numbers through update code.
- Keep Shock radius growth lower than damage growth. Radius affects readability and can wipe too much of the board.
- Preserve early wave gaps and early caps if the first two minutes should stay meditative.
