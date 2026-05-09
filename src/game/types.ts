export interface Vec2 {
  x: number;
  y: number;
}

export type WorkerState = "search" | "carry" | "repair" | "flee" | "beacon";
export type ScreenState = "menu" | "playing" | "paused" | "coreDestroyed" | "cinematicAutoRestart";
export type UpgradeId = "swarmSpeed" | "nodeFireRate" | "coreShield" | "repairPower";

export type UpgradeLevels = Record<UpgradeId, number>;

export interface UpgradeDefinition {
  id: UpgradeId;
  label: string;
  shortLabel: string;
  description: string;
  shortcut: string;
  maxLevel: number;
}

export interface UpgradeView extends UpgradeDefinition {
  level: number;
  cost: number;
  canBuy: boolean;
  maxed: boolean;
}

export interface TrailPoint extends Vec2 {
  life: number;
}

export interface CoreState {
  pos: Vec2;
  health: number;
  maxHealth: number;
  energy: number;
  shockCharge: number;
  pulse: number;
  damageFlash: number;
  collapseTimer: number;
}

export interface Worker {
  id: number;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  state: WorkerState;
  carry: number;
  carryRare: boolean;
  speed: number;
  phase: number;
  targetEnergyId?: number;
  repairTarget?: RepairTarget;
  trail: TrailPoint[];
}

export interface EnergyParticle {
  id: number;
  pos: Vec2;
  value: number;
  rare: boolean;
  life: number;
  pulse: number;
  claimedBy?: number;
}

export interface DefenseNode {
  id: number;
  pos: Vec2;
  level: number;
  range: number;
  cooldown: number;
  fireRate: number;
  health: number;
  maxHealth: number;
  infection: number;
  buildProgress: number;
  spin: number;
  overdrive: number;
}

export interface CircuitLine {
  id: number;
  fromNodeId?: number;
  toNodeId: number;
  infection: number;
  pulse: number;
  route: "hv" | "vh";
}

export interface Virus {
  id: number;
  pos: Vec2;
  vel: Vec2;
  speed: number;
  hp: number;
  maxHp: number;
  radius: number;
  elite: boolean;
  phase: number;
  infectPower: number;
}

export interface Particle {
  id: number;
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  glow: number;
}

export interface Beam {
  id: number;
  from: Vec2;
  to: Vec2;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface Shockwave {
  id: number;
  pos: Vec2;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface Beacon {
  id: number;
  pos: Vec2;
  life: number;
  maxLife: number;
  radius: number;
}

export interface BackgroundTrace {
  a: Vec2;
  b: Vec2;
  phase: number;
  strength: number;
}

export interface EventLabel {
  text: string;
  life: number;
  maxLife: number;
  color: string;
}

export interface RepairTarget {
  kind: "node" | "line";
  id: number;
}

export interface SimulationSnapshot {
  seed: string;
  time: number;
  coreHealth: number;
  coreEnergy: number;
  shockCharge: number;
  shockPowerBonus: number;
  upgradePoints: number;
  upgrades: UpgradeLevels;
  upgradesPurchased: number;
  workers: number;
  infection: number;
  maxInfection: number;
  nodes: number;
  nodesBuilt: number;
  viruses: number;
  wave: number;
  energyCollected: number;
  shocksUsed: number;
  shotsFired: number;
  eventText: string;
  destroyed: boolean;
  cinematic: boolean;
}

export interface RenderOptions {
  screen: ScreenState;
  cinematic: boolean;
  debug: boolean;
  highScore: number;
}
