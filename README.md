# Neon Swarm Core

An autoplay neon colony-defense simulation turned into a light playable survival game with React, TypeScript, Vite, Web Audio, and HTML5 Canvas.

## Run

```bash
npm install
npm run dev
```

On Windows, if PowerShell `Start-Process` reports a `Path`/`PATH` environment issue, just run the commands above manually from a normal terminal in this project folder.

Build check:

```bash
npm run build
```

## Controls

- `Space` - trigger Core shockwave when charged
- `1` - upgrade Swarm Speed
- `2` - upgrade Node Fire Rate
- `3` - upgrade Core Shield
- `4` - upgrade Repair Power
- `F` - cycle simulation speed, 1x to 4x
- `M` - mute/unmute procedural audio
- `P` or `Escape` - pause/resume
- `R` - restart current seed
- `N` - random new seed
- `C` - toggle Cinematic Mode
- `D` - toggle debug overlay
- Click/tap the board - place a temporary energy beacon

## Guides

- [GAME_GUIDE.md](./GAME_GUIDE.md) - short player guide
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - mechanics guide and implementation audit

## Notes

The simulation uses a deterministic seeded PRNG, no external art assets, no audio files, procedural Web Audio, and code-generated canvas visuals only.
