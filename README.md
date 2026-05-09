# Neon Swarm Core

An autoplay neon colony-defense survival game built with React, TypeScript, Vite, Web Audio, and HTML5 Canvas.

The v2.1 update keeps the vertical 9:16 neon simulation style while refining the HUD, making Workers dynamic, expanding upgrades to six categories, and moving Shock progression into an explicit upgrade.

## Run

```bash
npm install
npm run dev
```

On Windows, if PowerShell `Start-Process` reports a `Path`/`PATH` environment issue, run the commands above manually from a normal terminal in this project folder.

Build check:

```bash
npm run build
```

## Controls

- `Space` - trigger Core Shock when charged
- `1` - upgrade Speed
- `2` - upgrade Fire
- `3` - upgrade Shield
- `4` - upgrade Repair
- `5` - upgrade Workers
- `6` - upgrade Shock
- `F` - cycle simulation speed, 1x to 4x
- `M` - mute/unmute procedural audio
- `P` or `Escape` - pause/resume
- `R` - restart current seed
- `N` - random new seed
- `C` - toggle Cinematic Mode
- `D` - toggle debug overlay
- Click/tap the board - place a temporary energy beacon

## Gameplay Notes

- The lower HUD now tracks Energy, Infection, Workers, Nodes, and Shock.
- Workers are shown as current/capacity, can be lost near virus danger, and are rebuilt automatically by the Core using energy.
- Upgrade cards show level, cost or `MAX`, and the current effective power percentage.
- Shock no longer gains passive power from repeated use. Shock strength now comes from the Shock upgrade.

## Guides

- [GAME_GUIDE.md](./GAME_GUIDE.md) - short player guide
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - mechanics guide and implementation audit

## Notes

The simulation uses a deterministic seeded PRNG, no external art assets, no audio files, procedural Web Audio, and code-generated canvas visuals only.
