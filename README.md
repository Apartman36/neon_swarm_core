# Neon Swarm Core

An autoplay neon colony-defense simulation built with React, TypeScript, Vite, and HTML5 Canvas.

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
- `P` or `Escape` - pause/resume
- `R` - restart current seed
- `N` - random new seed
- `C` - toggle Cinematic Mode
- `D` - toggle debug overlay
- Click/tap the board - place a temporary energy beacon

## Notes

The simulation uses a deterministic seeded PRNG, no external art assets, no audio files, and code-generated canvas visuals only.
