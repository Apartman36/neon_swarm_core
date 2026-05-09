# Neon Swarm Core v2 Player Guide

## Objective

Keep the Core alive as long as possible. The colony runs on its own: workers collect energy, defense nodes shoot virus particles, and the circuit network slowly fights infection. Your job is to spend Upgrade Points, control simulation speed, and fire Shock when the Core is under pressure.

## Colony Basics

- Workers collect cyan and gold energy particles automatically, then deliver them to the Core.
- Energy powers Core repair, Shock charge, automatic defense node construction, and automatic node upgrades.
- Defense nodes fire lasers at nearby viruses. Infected or damaged nodes become less reliable.
- Circuit lines and nodes can become infected. High infection damages nodes and raises collapse pressure.
- Click or tap inside the board to place a temporary energy beacon that pulls workers toward that area.

## Shock

Shock is the emergency Core pulse. Press `Space` or use the Shock button when it reaches 100%. It damages and repels nearby viruses, cleans infection from nearby nodes and lines, adds a strong ring effect, and briefly pulses the screen. Each Shock used increases future Shock power by +10%, capped at +150%.

## Upgrade Points

You gain +1 Upgrade Point every 5 seconds while the Core is alive. Costs are simple: `1 + current level`, with a max level of 8.

- `1` Swarm Speed: workers move faster and deliver slightly more energy.
- `2` Node Fire Rate: defense nodes shoot more often.
- `3` Core Shield: Core damage and infection pressure are reduced.
- `4` Repair Power: workers clean infected nodes and lines faster.

## Controls

- `Space`: trigger Shock when charged.
- `1`, `2`, `3`, `4`: buy upgrades.
- `F`: cycle Speed `1x -> 2x -> 3x -> 4x -> 1x`.
- `M`: mute or unmute procedural audio.
- `P` or `Escape`: pause or resume.
- `R`: restart current seed.
- `N`: random new seed.
- `C`: toggle Cinematic Mode.
- `D`: debug overlay.
- Click or tap board: place an energy beacon.

## Normal vs Cinematic Mode

Normal Mode shows the full HUD, upgrades, controls, run summary, and mute/speed controls.

Cinematic Mode keeps the view clean for background footage or short recordings. It hides heavy upgrade UI, shows only minimal status, auto-restarts after collapse, and auto-spends Upgrade Points in a balanced order.

## Survival Tips

- Buy Swarm Speed early if energy delivery feels slow.
- Use Node Fire Rate when waves begin to overlap.
- Save Shock for clusters near the Core or infected inner lines.
- Core Shield is strongest in longer runs because it reduces repeated damage and infection pressure.
- Repair Power matters once infection regularly reaches the inner network.
- Higher speed is useful once the colony is stable, but `4x` makes threats arrive quickly.

## Background Footage Tips

- Start Cinematic Mode for clean vertical 9:16 capture.
- Use `F` to adjust pacing without changing render frame rate.
- Leave audio muted for editing workflows, or unmute after Start for subtle procedural pulses.
