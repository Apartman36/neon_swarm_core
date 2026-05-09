export const WORLD_WIDTH = 900;
export const WORLD_HEIGHT = 1600;
export const FIXED_DT = 1 / 60;

export const CORE_RADIUS = 46;
export const CORE_POSITION = { x: WORLD_WIDTH / 2, y: 880 };
export const SAFE_AREA = {
  x: 160,
  y: 170,
  width: WORLD_WIDTH - 320,
  height: 360,
};
export const GAMEPLAY_BOUNDS = {
  minX: 54,
  maxX: WORLD_WIDTH - 54,
  minY: 330,
  maxY: WORLD_HEIGHT - 225,
};

export const INITIAL_WORKERS = 118;
export const CINEMATIC_WORKERS = 138;
export const MAX_WORKERS = 150;
export const MAX_ENERGY = 96;
export const MAX_VIRUS = 88;
export const MAX_PARTICLES = 720;
export const MAX_BEAMS = 60;
export const MAX_SHOCKWAVES = 12;
export const MAX_NODES = 15;
export const DEFAULT_SEED = "NEON-0427";

export const STORAGE_HIGH_SCORE = "neon-swarm-core-high-score";
