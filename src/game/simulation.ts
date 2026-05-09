import {
  CINEMATIC_WORKERS,
  CORE_POSITION,
  CORE_RADIUS,
  DEFAULT_SEED,
  GAMEPLAY_BOUNDS,
  INITIAL_WORKERS,
  MAX_BEAMS,
  MAX_ENERGY,
  MAX_NODES,
  MAX_PARTICLES,
  MAX_SHOCKWAVES,
  MAX_VIRUS,
  MAX_WORKERS,
  SAFE_AREA,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import {
  TAU,
  add,
  angleOf,
  clamp,
  distToSegment,
  distance,
  distanceSq,
  fromAngle,
  lerp,
  lerpVec,
  mul,
  normalize,
  pointAlongPolyline,
  smoothstep,
  sub,
} from "./math";
import { Random } from "./random";
import type {
  BackgroundTrace,
  Beacon,
  Beam,
  CircuitLine,
  CoreState,
  DefenseNode,
  EnergyParticle,
  EventLabel,
  Particle,
  RepairTarget,
  ScreenState,
  Shockwave,
  SimulationSnapshot,
  UpgradeDefinition,
  UpgradeId,
  UpgradeLevels,
  UpgradeView,
  Vec2,
  Virus,
  Worker,
  WorkerState,
} from "./types";

interface UpdateOptions {
  cinematic: boolean;
  screen: ScreenState;
}

const CYAN = "#45eaff";
const GREEN = "#42ff9b";
const GOLD = "#ffe27a";
const MAGENTA = "#ff3df2";
const RED = "#ff315f";
const WHITE = "#f5fbff";

const UPGRADE_MAX_LEVEL = 8;

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: "swarmSpeed",
    label: "Swarm Speed",
    shortLabel: "Speed",
    description: "Workers move faster and deliver slightly more energy.",
    shortcut: "1",
    maxLevel: UPGRADE_MAX_LEVEL,
  },
  {
    id: "nodeFireRate",
    label: "Node Fire Rate",
    shortLabel: "Fire",
    description: "Defense nodes shoot more frequently.",
    shortcut: "2",
    maxLevel: UPGRADE_MAX_LEVEL,
  },
  {
    id: "coreShield",
    label: "Core Shield",
    shortLabel: "Shield",
    description: "Core damage and infection pressure are reduced.",
    shortcut: "3",
    maxLevel: UPGRADE_MAX_LEVEL,
  },
  {
    id: "repairPower",
    label: "Repair Power",
    shortLabel: "Repair",
    description: "Workers clean infected nodes and lines faster.",
    shortcut: "4",
    maxLevel: UPGRADE_MAX_LEVEL,
  },
];

function createUpgradeLevels(): UpgradeLevels {
  return {
    swarmSpeed: 0,
    nodeFireRate: 0,
    coreShield: 0,
    repairPower: 0,
  };
}

export class Simulation {
  seed = DEFAULT_SEED;
  rng = new Random(DEFAULT_SEED);
  time = 0;
  survivedTime = 0;
  cinematic = false;
  destroyed = false;
  screenShake = 0;
  core: CoreState = this.createCore();
  workers: Worker[] = [];
  energy: EnergyParticle[] = [];
  nodes: DefenseNode[] = [];
  lines: CircuitLine[] = [];
  viruses: Virus[] = [];
  particles: Particle[] = [];
  beams: Beam[] = [];
  shockwaves: Shockwave[] = [];
  beacons: Beacon[] = [];
  traces: BackgroundTrace[] = [];
  eventLabel: EventLabel = { text: "", life: 0, maxLife: 1, color: WHITE };
  upgradePoints = 0;
  upgradeLevels: UpgradeLevels = createUpgradeLevels();
  upgradesPurchased = 0;
  shockPowerBonus = 0;
  wave = 0;
  maxInfection = 0;
  nodesBuilt = 0;
  energyCollected = 0;
  shocksUsed = 0;
  shotsFired = 0;

  private nextId = 1;
  private energySpawnTimer = 0;
  private upgradePointTimer = 0;
  private cinematicUpgradeTimer = 2.5;
  private directorTimer = 2.4;
  private nodeBuildCooldown = 4.5;
  private nodeUpgradeCooldown = 8;
  private workerRebuildTimer = 1.8;
  private workerLossCooldown = 0;
  private workerEventCooldown = 0;
  private introWaveSpawned = false;
  private introBloomSpawned = false;
  private nextWaveAt = 7.2;
  private overdriveTimer = 0;
  private menuPulseTimer = 0;
  private repairEventCooldown = 0;

  constructor(seed = DEFAULT_SEED, cinematic = false) {
    this.reset(seed, cinematic);
  }

  reset(seed = this.seed, cinematic = this.cinematic): void {
    this.seed = seed;
    this.cinematic = cinematic;
    this.rng = new Random(seed);
    this.nextId = 1;
    this.time = 0;
    this.survivedTime = 0;
    this.destroyed = false;
    this.screenShake = 0;
    this.core = this.createCore();
    this.workers = [];
    this.energy = [];
    this.nodes = [];
    this.lines = [];
    this.viruses = [];
    this.particles = [];
    this.beams = [];
    this.shockwaves = [];
    this.beacons = [];
    this.traces = this.createBackgroundTraces();
    this.upgradePoints = 0;
    this.upgradeLevels = createUpgradeLevels();
    this.upgradesPurchased = 0;
    this.shockPowerBonus = 0;
    this.wave = 0;
    this.maxInfection = 0;
    this.nodesBuilt = 0;
    this.energyCollected = 0;
    this.shocksUsed = 0;
    this.shotsFired = 0;
    this.eventLabel = { text: cinematic ? "Cinematic colony online" : "Colony core online", life: 2.8, maxLife: 2.8, color: CYAN };
    this.energySpawnTimer = 0.2;
    this.upgradePointTimer = 0;
    this.cinematicUpgradeTimer = 2.5;
    this.directorTimer = cinematic ? 2.8 : 3.4;
    this.nodeBuildCooldown = 5.2;
    this.nodeUpgradeCooldown = 8.5;
    this.workerRebuildTimer = 1.8;
    this.workerLossCooldown = 0;
    this.workerEventCooldown = 0;
    this.introWaveSpawned = false;
    this.introBloomSpawned = false;
    this.nextWaveAt = cinematic ? 5.4 : 7.2;
    this.overdriveTimer = 0;
    this.menuPulseTimer = 0;
    this.repairEventCooldown = 0;

    const workerCount = this.getWorkerCapacity();
    for (let i = 0; i < workerCount; i += 1) {
      this.workers.push(this.createWorker());
    }

    this.addDefenseNode({ x: CORE_POSITION.x - 180, y: CORE_POSITION.y - 58 }, true);
    this.addDefenseNode({ x: CORE_POSITION.x + 188, y: CORE_POSITION.y - 38 }, true);
    this.addDefenseNode({ x: CORE_POSITION.x - 86, y: CORE_POSITION.y + 200 }, true);
    this.addDefenseNode({ x: CORE_POSITION.x + 96, y: CORE_POSITION.y + 218 }, true);

    for (let i = 0; i < 58; i += 1) {
      this.spawnEnergy(this.rng.chance(0.08));
    }

    for (let i = 0; i < 90; i += 1) {
      const angle = this.rng.range(0, TAU);
      const radius = this.rng.range(12, 130);
      this.addParticle(
        add(CORE_POSITION, fromAngle(angle, radius)),
        fromAngle(angle, this.rng.range(18, 70)),
        this.rng.pick([CYAN, GREEN, WHITE]),
        this.rng.range(0.45, 1.2),
        this.rng.range(1.3, 3.2),
        16,
      );
    }
  }

  update(dt: number, options: UpdateOptions): void {
    this.cinematic = options.cinematic;

    if (this.destroyed) {
      this.updateDestroyed(dt);
      return;
    }

    this.time += dt;
    this.screenShake = Math.max(0, this.screenShake - dt * 5.6);
    this.menuPulseTimer += dt;
    this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
    this.core.pulse = Math.max(0, this.core.pulse - dt * 1.8);
    this.core.damageFlash = Math.max(0, this.core.damageFlash - dt * 2.4);
    this.eventLabel.life = Math.max(0, this.eventLabel.life - dt);
    this.repairEventCooldown = Math.max(0, this.repairEventCooldown - dt);
    this.workerLossCooldown = Math.max(0, this.workerLossCooldown - dt);
    this.workerEventCooldown = Math.max(0, this.workerEventCooldown - dt);

    this.updateUpgradePoints(dt, options.screen);
    this.updateAmbientEnergy(dt, options.screen);
    this.updateWorkerRebuild(dt, options.screen);
    this.updateWorkers(dt, options.screen);
    this.updateNodes(dt);
    this.updateViruses(dt, options.screen);
    this.updateInfection(dt);
    this.maxInfection = Math.max(this.maxInfection, this.calculateInfection());
    this.updateCore(dt, options.screen);
    this.updateParticles(dt);
    this.updateDirector(dt, options.screen);
    this.autoBuildAndUpgrade(dt, options.screen);
    this.autoSpendCinematicUpgrades(dt, options.screen);
    this.cleanup();
  }

  getSnapshot(): SimulationSnapshot {
    return {
      seed: this.seed,
      time: this.destroyed ? this.survivedTime : this.time,
      coreHealth: this.core.health,
      coreEnergy: this.core.energy,
      shockCharge: this.core.shockCharge,
      shockPowerBonus: this.shockPowerBonus,
      upgradePoints: this.upgradePoints,
      upgrades: { ...this.upgradeLevels },
      upgradesPurchased: this.upgradesPurchased,
      workers: this.workers.length,
      workerCapacity: this.getWorkerCapacity(),
      infection: this.calculateInfection(),
      maxInfection: this.maxInfection,
      nodes: this.nodes.filter((node) => node.buildProgress >= 1).length,
      nodesBuilt: this.nodesBuilt,
      viruses: this.viruses.filter((virus) => virus.hp > 0).length,
      wave: this.wave,
      energyCollected: this.energyCollected,
      shocksUsed: this.shocksUsed,
      shotsFired: this.shotsFired,
      eventText: this.eventLabel.life > 0 ? this.eventLabel.text : "",
      destroyed: this.destroyed,
      cinematic: this.cinematic,
    };
  }

  getUpgradeViews(): UpgradeView[] {
    return UPGRADE_DEFINITIONS.map((upgrade) => {
      const level = this.upgradeLevels[upgrade.id];
      const maxed = level >= upgrade.maxLevel;
      const cost = maxed ? Number.POSITIVE_INFINITY : this.getUpgradeCost(upgrade.id);
      return {
        ...upgrade,
        level,
        cost,
        canBuy: !maxed && this.upgradePoints >= cost,
        maxed,
      };
    });
  }

  getUpgradeCost(id: UpgradeId): number {
    const level = this.upgradeLevels[id];
    const maxLevel = UPGRADE_DEFINITIONS.find((upgrade) => upgrade.id === id)?.maxLevel ?? UPGRADE_MAX_LEVEL;
    return level >= maxLevel ? Number.POSITIVE_INFINITY : 1 + level;
  }

  buyUpgrade(id: UpgradeId): boolean {
    const definition = UPGRADE_DEFINITIONS.find((upgrade) => upgrade.id === id);
    if (!definition) return false;
    const level = this.upgradeLevels[id];
    if (level >= definition.maxLevel) return false;
    const cost = this.getUpgradeCost(id);
    if (this.upgradePoints < cost) return false;

    this.upgradePoints -= cost;
    this.upgradeLevels[id] = level + 1;
    this.upgradesPurchased += 1;
    this.core.pulse = Math.max(this.core.pulse, 0.8);

    if (id === "nodeFireRate") {
      for (const node of this.nodes) node.overdrive = Math.max(node.overdrive, 0.72);
    }
    if (id === "coreShield") {
      this.core.health = clamp(this.core.health + 3.5, 0, this.core.maxHealth);
    }

    this.setEvent(`${definition.shortLabel} upgraded`, CYAN, 1.8);
    this.addShockwave(this.core.pos, 150 + this.upgradesPurchased * 2, 0.72, CYAN);
    for (let i = 0; i < 22; i += 1) {
      this.addParticle(this.core.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(28, 118)), this.rng.pick([CYAN, GREEN, WHITE]), 0.48, this.rng.range(1, 2.5), 18);
    }
    return true;
  }

  private updateUpgradePoints(dt: number, screen: ScreenState): void {
    if (screen === "menu") return;
    this.upgradePointTimer += dt;
    while (this.upgradePointTimer >= 5) {
      this.upgradePointTimer -= 5;
      this.upgradePoints += 1;
    }
  }

  private autoSpendCinematicUpgrades(dt: number, screen: ScreenState): void {
    if (!this.cinematic || screen === "menu") return;
    this.cinematicUpgradeTimer -= dt;
    if (this.cinematicUpgradeTimer > 0 || this.upgradePoints <= 0) return;

    this.cinematicUpgradeTimer = 4.2;
    const priority: UpgradeId[] = ["swarmSpeed", "nodeFireRate", "coreShield", "repairPower"];
    const affordable = priority
      .map((id) => ({ id, level: this.upgradeLevels[id], cost: this.getUpgradeCost(id) }))
      .filter((upgrade) => this.upgradePoints >= upgrade.cost)
      .sort((a, b) => a.level - b.level || priority.indexOf(a.id) - priority.indexOf(b.id))[0];

    if (affordable) this.buyUpgrade(affordable.id);
  }

  private getWorkerSpeedMultiplier(): number {
    return 1 + this.upgradeLevels.swarmSpeed * 0.045;
  }

  private getEnergyEfficiencyMultiplier(): number {
    return 1 + this.upgradeLevels.swarmSpeed * 0.025;
  }

  private getNodeFireRateMultiplier(): number {
    return 1 + this.upgradeLevels.nodeFireRate * 0.075;
  }

  private getCoreDamageMultiplier(): number {
    return 1 - Math.min(0.44, this.upgradeLevels.coreShield * 0.055);
  }

  private getInfectionResistanceMultiplier(): number {
    return 1 - Math.min(0.34, this.upgradeLevels.coreShield * 0.04);
  }

  private getRepairMultiplier(): number {
    return 1 + this.upgradeLevels.repairPower * 0.12;
  }

  private getWorkerGrowthMultiplier(): number {
    return 1;
  }

  private getWorkerCapacity(): number {
    return clamp(this.cinematic ? CINEMATIC_WORKERS : INITIAL_WORKERS, 80, MAX_WORKERS);
  }

  private getWorkerRebuildCost(): number {
    return 9.5 + Math.max(0, this.workers.length - 90) * 0.035;
  }

  addBeacon(pos: Vec2): void {
    const clamped = this.clampToGameplay(pos, 0);
    this.beacons.push({
      id: this.id(),
      pos: clamped,
      life: 5.8,
      maxLife: 5.8,
      radius: 190,
    });
    this.setEvent("Energy beacon planted", CYAN, 1.8);
    this.core.pulse = 1;
    this.addShockwave(clamped, 135, 0.8, CYAN);
    for (let i = 0; i < 24; i += 1) {
      this.addParticle(clamped, fromAngle(this.rng.range(0, TAU), this.rng.range(30, 130)), this.rng.pick([CYAN, GREEN, WHITE]), 0.7, this.rng.range(1, 2.4), 22);
    }
  }

  triggerShockwave(force = false): boolean {
    if (!force && this.core.shockCharge < 1) return false;

    const charge = force ? Math.max(this.core.shockCharge, 0.65) : this.core.shockCharge;
    const currentBonus = this.shockPowerBonus;
    const damagePower = 1 + currentBonus;
    const cleanPower = 1 + currentBonus * 0.8;
    const radius = (280 + charge * 145) * (1 + currentBonus * 0.34);
    const damage = (54 + charge * 94) * damagePower;
    this.core.shockCharge = force ? Math.max(0, this.core.shockCharge - 0.82) : 0;
    this.core.pulse = 1.25;
    this.shocksUsed += 1;
    this.shockPowerBonus = clamp(this.shockPowerBonus + 0.1, 0, 1.5);
    this.screenShake = Math.max(this.screenShake, 0.55 + currentBonus * 0.16);
    this.setEvent("Core shockwave", WHITE, 2.1);
    this.addShockwave(this.core.pos, radius, 1.05, WHITE);
    this.addShockwave(this.core.pos, radius * 0.62, 0.78, CYAN);

    for (const virus of this.viruses) {
      const d = distance(virus.pos, this.core.pos);
      if (d < radius) {
        virus.hp -= damage * (1 - d / radius) + 18;
        virus.vel = add(virus.vel, mul(normalize(sub(virus.pos, this.core.pos)), 180 * (1 + currentBonus * 0.45) * (1 - d / radius)));
        if (virus.hp <= 0) this.killVirus(virus);
      }
    }

    for (const node of this.nodes) {
      const amount = 0.16 * cleanPower * (1 - smoothstep(100, radius, distance(node.pos, this.core.pos)));
      node.infection = clamp(node.infection - amount, 0, 1);
      node.health = clamp(node.health + 12 * amount, 0, node.maxHealth);
    }
    for (const line of this.lines) {
      const midpoint = this.getLinePoint(line, 0.5);
      const amount = 0.22 * cleanPower * (1 - smoothstep(120, radius, distance(midpoint, this.core.pos)));
      line.infection = clamp(line.infection - amount, 0, 1);
    }
    for (let i = 0; i < 52; i += 1) {
      const angle = this.rng.range(0, TAU);
      const speed = this.rng.range(55, 230) * (1 + currentBonus * 0.28);
      this.addParticle(this.core.pos, fromAngle(angle, speed), this.rng.pick([WHITE, CYAN, GREEN]), this.rng.range(0.38, 0.9), this.rng.range(1.2, 3.3), 26);
    }
    return true;
  }

  getLinePoints(line: CircuitLine): Vec2[] {
    const from = line.fromNodeId === undefined ? this.core.pos : this.getNode(line.fromNodeId)?.pos;
    const to = this.getNode(line.toNodeId)?.pos;
    if (!from || !to) return [];
    if (line.route === "hv") {
      return [from, { x: to.x, y: from.y }, to];
    }
    return [from, { x: from.x, y: to.y }, to];
  }

  getLinePoint(line: CircuitLine, t: number): Vec2 {
    return pointAlongPolyline(this.getLinePoints(line), t);
  }

  private createCore(): CoreState {
    return {
      pos: { ...CORE_POSITION },
      health: 100,
      maxHealth: 100,
      energy: 46,
      shockCharge: 0.35,
      pulse: 0.8,
      damageFlash: 0,
      collapseTimer: 0,
    };
  }

  private id(): number {
    const value = this.nextId;
    this.nextId += 1;
    return value;
  }

  private createBackgroundTraces(): BackgroundTrace[] {
    const traces: BackgroundTrace[] = [];
    const columns = [72, 150, 236, 328, 450, 572, 664, 750, 828];
    const rows = [120, 210, 315, 430, 575, 700, 835, 980, 1125, 1265, 1410, 1510];

    for (const x of columns) {
      const y1 = this.rng.pick(rows);
      const y2 = this.rng.pick(rows);
      traces.push({
        a: { x, y: Math.min(y1, y2) },
        b: { x, y: Math.max(y1, y2) + this.rng.range(80, 220) },
        phase: this.rng.next(),
        strength: this.rng.range(0.25, 0.72),
      });
    }
    for (const y of rows) {
      const x1 = this.rng.pick(columns);
      const x2 = this.rng.pick(columns);
      traces.push({
        a: { x: Math.min(x1, x2), y },
        b: { x: Math.max(x1, x2) + this.rng.range(60, 180), y },
        phase: this.rng.next(),
        strength: this.rng.range(0.22, 0.62),
      });
    }
    for (let i = 0; i < 34; i += 1) {
      const start = {
        x: this.rng.range(35, WORLD_WIDTH - 35),
        y: this.rng.range(80, WORLD_HEIGHT - 80),
      };
      const horizontal = this.rng.chance(0.55);
      traces.push({
        a: start,
        b: horizontal
          ? { x: clamp(start.x + this.rng.range(-230, 230), 30, WORLD_WIDTH - 30), y: start.y }
          : { x: start.x, y: clamp(start.y + this.rng.range(-260, 260), 50, WORLD_HEIGHT - 50) },
        phase: this.rng.next(),
        strength: this.rng.range(0.15, 0.45),
      });
    }
    return traces;
  }

  private createWorker(): Worker {
    const angle = this.rng.range(0, TAU);
    const radius = this.rng.range(26, 180);
    const pos = this.clampToGameplay(add(CORE_POSITION, fromAngle(angle, radius)), 0);
    return {
      id: this.id(),
      pos: {
        x: pos.x,
        y: pos.y,
      },
      vel: fromAngle(angle + Math.PI / 2, this.rng.range(12, 44)),
      angle,
      state: "search",
      carry: 0,
      carryRare: false,
      speed: this.rng.range(86, 124),
      phase: this.rng.range(0, TAU),
      trail: [],
    };
  }

  private spawnEnergy(rare = false, position?: Vec2): void {
    if (this.energy.length >= MAX_ENERGY) return;
    const pos = position ?? this.randomEnergyPosition();
    this.energy.push({
      id: this.id(),
      pos,
      value: rare ? this.rng.range(13, 20) : this.rng.range(4, 7.5),
      rare,
      life: rare ? 28 : this.rng.range(18, 34),
      pulse: this.rng.range(0, TAU),
    });
  }

  private randomEnergyPosition(): Vec2 {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const angle = this.rng.range(0, TAU);
      const radius = this.rng.range(175, 640);
      const pos = add(CORE_POSITION, fromAngle(angle, radius));
      const clamped = this.clampToGameplay(pos, 0);
      const inSafeCenter =
        clamped.x > SAFE_AREA.x &&
        clamped.x < SAFE_AREA.x + SAFE_AREA.width &&
        clamped.y > SAFE_AREA.y &&
        clamped.y < SAFE_AREA.y + SAFE_AREA.height;
      if (!inSafeCenter || this.rng.chance(0.18)) return clamped;
    }
    return {
      x: this.rng.range(GAMEPLAY_BOUNDS.minX + 6, GAMEPLAY_BOUNDS.maxX - 6),
      y: this.rng.range(Math.max(600, GAMEPLAY_BOUNDS.minY), GAMEPLAY_BOUNDS.maxY - 16),
    };
  }

  private updateAmbientEnergy(dt: number, screen: ScreenState): void {
    this.energySpawnTimer -= dt;
    const menuMultiplier = screen === "menu" ? 0.72 : 1;
    if (this.energySpawnTimer <= 0) {
      this.energySpawnTimer = this.rng.range(0.22, 0.62) / menuMultiplier;
      if (this.energy.length < MAX_ENERGY) {
        this.spawnEnergy(this.rng.chance(screen === "menu" ? 0.05 : 0.075));
      }
    }

    for (const energy of this.energy) {
      energy.life -= dt;
      energy.pulse += dt * (energy.rare ? 4.2 : 2.7);
      if (energy.life < 2.4) {
        energy.pos.y += Math.sin(this.time * 3 + energy.id) * dt * 4;
      }
    }
  }

  private updateWorkerRebuild(dt: number, screen: ScreenState): void {
    if (screen === "menu") return;
    const capacity = this.getWorkerCapacity();
    if (this.workers.length >= capacity) {
      this.workerRebuildTimer = Math.min(this.workerRebuildTimer, 1.4);
      return;
    }

    const missingRatio = clamp((capacity - this.workers.length) / capacity, 0, 1);
    this.workerRebuildTimer -= dt * this.getWorkerGrowthMultiplier() * lerp(1, 1.65, missingRatio);
    if (this.workerRebuildTimer > 0) return;

    const cost = this.getWorkerRebuildCost();
    const reserve = missingRatio > 0.22 ? 4 : 14;
    if (this.core.energy < cost + reserve) {
      this.workerRebuildTimer = 0.7;
      return;
    }

    this.core.energy = Math.max(0, this.core.energy - cost);
    const worker = this.createWorker();
    worker.state = "search";
    worker.vel = fromAngle(this.rng.range(0, TAU), this.rng.range(35, 74));
    this.workers.push(worker);
    this.core.pulse = Math.max(this.core.pulse, 0.58);
    this.workerRebuildTimer = this.rng.range(1.55, 2.45) / this.getWorkerGrowthMultiplier();
    if (this.workerEventCooldown <= 0) {
      this.workerEventCooldown = 9;
      this.setEvent("Worker rebuilt", GREEN, 1.7);
    }
    for (let i = 0; i < 12; i += 1) {
      this.addParticle(worker.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(20, 96)), this.rng.pick([CYAN, GREEN, WHITE]), 0.42, this.rng.range(0.9, 2.2), 14);
    }
  }

  private updateWorkers(dt: number, screen: ScreenState): void {
    for (const energy of this.energy) {
      energy.claimedBy = undefined;
    }

    const infection = this.calculateInfection();
    const workerSpeedMultiplier = this.getWorkerSpeedMultiplier();
    const lostWorkers = new Set<number>();
    const activeBeacon = this.beacons.reduce<Beacon | undefined>((best, beacon) => {
      if (beacon.life <= 0) return best;
      return !best || beacon.life > best.life ? beacon : best;
    }, undefined);

    if (infection > 0.16 && this.repairEventCooldown <= 0) {
      this.repairEventCooldown = 12;
      this.setEvent("Repair swarm mobilized", GREEN, 2.1);
    }

    for (const worker of this.workers) {
      const previous = { ...worker.pos };
      worker.trail = worker.trail
        .map((point) => ({ ...point, life: point.life - dt * 1.8 }))
        .filter((point) => point.life > 0)
        .slice(-10);

      const lastTrail = worker.trail[worker.trail.length - 1];
      if (!lastTrail || distanceSq(lastTrail, worker.pos) > 20) {
        worker.trail.push({ x: worker.pos.x, y: worker.pos.y, life: 1 });
      }

      let target: Vec2 | undefined;
      let desiredSpeed = worker.speed * workerSpeedMultiplier;
      let state: WorkerState = worker.carry > 0 ? "carry" : "search";

      const avoidance = this.getVirusAvoidance(worker.pos);
      if (screen !== "menu" && this.shouldLoseWorker(worker, dt, infection, avoidance.strength)) {
        lostWorkers.add(worker.id);
        continue;
      }
      if (avoidance.strength > 0.1 && worker.carry <= 0) {
        state = "flee";
        desiredSpeed *= 1.18;
      }

      if (worker.carry > 0) {
        target = this.core.pos;
        if (distance(worker.pos, this.core.pos) < CORE_RADIUS + 16) {
          this.deliverEnergy(worker);
          state = "search";
          target = undefined;
        }
      }

      if (!target && worker.carry <= 0) {
        const shouldRepair = infection > 0.055 && (worker.id % 3 !== 0 || infection > 0.18);
        if (shouldRepair) {
          const repair = this.getRepairTarget(worker);
          if (repair) {
            worker.repairTarget = repair;
            target = this.getRepairTargetPosition(repair);
            state = "repair";
            desiredSpeed *= 0.78;
            if (target && distance(worker.pos, target) < 18) {
              this.repairAtTarget(worker, repair, dt);
            }
          } else {
            worker.repairTarget = undefined;
          }
        }
      }

      if (!target && worker.carry <= 0 && activeBeacon && (worker.id + Math.floor(this.time * 2)) % 4 !== 0) {
        target = activeBeacon.pos;
        state = "beacon";
        desiredSpeed *= 1.05;
      }

      if (!target && worker.carry <= 0) {
        const energy = this.getEnergyTarget(worker);
        if (energy) {
          worker.targetEnergyId = energy.id;
          energy.claimedBy = worker.id;
          target = energy.pos;
          if (distance(worker.pos, energy.pos) < (energy.rare ? 18 : 14)) {
            this.collectEnergy(worker, energy);
            target = this.core.pos;
            state = "carry";
          }
        } else {
          worker.targetEnergyId = undefined;
        }
      }

      let desiredVelocity: Vec2;
      if (target) {
        const toTarget = sub(target, worker.pos);
        const dist = Math.max(0.001, Math.hypot(toTarget.x, toTarget.y));
        const slow = dist < 58 ? lerp(0.46, 1, dist / 58) : 1;
        desiredVelocity = mul(normalize(toTarget), desiredSpeed * slow);
      } else {
        const coreDelta = sub(worker.pos, this.core.pos);
        const orbit = fromAngle(angleOf(coreDelta) + Math.PI / 2, desiredSpeed * 0.34);
        const drift = fromAngle(worker.phase + this.time * (0.58 + (worker.id % 9) * 0.02), desiredSpeed * 0.28);
        const centerPull = mul(normalize(sub(this.core.pos, worker.pos)), smoothstep(260, 720, distance(worker.pos, this.core.pos)) * desiredSpeed * 0.42);
        desiredVelocity = add(add(orbit, drift), centerPull);
      }

      const wander = fromAngle(worker.phase + Math.sin(this.time * 1.7 + worker.id) * 1.2 + this.time * 0.9, 17);
      desiredVelocity = add(add(desiredVelocity, wander), avoidance.vector);
      worker.vel = lerpVec(worker.vel, desiredVelocity, clamp(dt * 4.4, 0, 1));
      const maxSpeed = desiredSpeed * (state === "flee" ? 1.7 : 1.35);
      const speed = Math.hypot(worker.vel.x, worker.vel.y);
      if (speed > maxSpeed) worker.vel = mul(normalize(worker.vel), maxSpeed);

      worker.pos = add(worker.pos, mul(worker.vel, dt));
      this.constrainAgent(worker.pos, worker.vel, 24);
      if (distanceSq(previous, worker.pos) > 0.01) {
        worker.angle = angleOf(sub(worker.pos, previous));
      }
      worker.state = state;
    }

    if (lostWorkers.size > 0) {
      this.workers = this.workers.filter((worker) => !lostWorkers.has(worker.id));
    }
  }

  private shouldLoseWorker(worker: Worker, dt: number, infection: number, avoidanceStrength: number): boolean {
    if (this.workerLossCooldown > 0) return false;
    const capacity = this.getWorkerCapacity();
    if (this.workers.length <= Math.max(46, Math.floor(capacity * 0.46))) return false;

    for (const virus of this.viruses) {
      if (virus.hp <= 0) continue;
      const d = distance(worker.pos, virus.pos);
      if (d < virus.radius + (virus.elite ? 10 : 7)) {
        const chance = clamp(dt * (virus.elite ? 1.05 : 0.66), 0, 0.16);
        if (this.rng.chance(chance)) {
          this.loseWorker(worker, virus.elite);
          return true;
        }
      }
    }

    const danger = avoidanceStrength * 0.45 + infection * 0.9;
    if (danger > 0.7 && this.rng.chance(dt * 0.018 * danger)) {
      this.loseWorker(worker, false);
      return true;
    }
    return false;
  }

  private loseWorker(worker: Worker, eliteContact: boolean): void {
    this.workerLossCooldown = this.rng.range(eliteContact ? 0.9 : 1.25, eliteContact ? 1.45 : 2.1);
    if (worker.carry > 0 && this.energy.length < MAX_ENERGY && this.rng.chance(worker.carryRare ? 0.75 : 0.45)) {
      this.spawnEnergy(worker.carryRare, worker.pos);
    }
    if (this.workerEventCooldown <= 0) {
      this.workerEventCooldown = 8.5;
      this.setEvent("Worker lost", RED, 1.6);
    }
    for (let i = 0; i < (eliteContact ? 18 : 11); i += 1) {
      this.addParticle(worker.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(24, eliteContact ? 135 : 96)), this.rng.pick([CYAN, RED, WHITE]), 0.46, this.rng.range(0.8, 2.2), 15);
    }
  }

  private getVirusAvoidance(pos: Vec2): { vector: Vec2; strength: number } {
    let vector = { x: 0, y: 0 };
    let strength = 0;
    for (const virus of this.viruses) {
      if (virus.hp <= 0) continue;
      const d = distance(pos, virus.pos);
      const avoidRadius = virus.elite ? 132 : 96;
      if (d < avoidRadius) {
        const amount = (1 - d / avoidRadius) * (virus.elite ? 210 : 150);
        vector = add(vector, mul(normalize(sub(pos, virus.pos)), amount));
        strength += amount / 180;
      }
    }
    return { vector, strength };
  }

  private getEnergyTarget(worker: Worker): EnergyParticle | undefined {
    const current = this.energy.find((energy) => energy.id === worker.targetEnergyId && energy.life > 0 && (energy.claimedBy === undefined || energy.claimedBy === worker.id));
    if (current) return current;

    let best: EnergyParticle | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const energy of this.energy) {
      if (energy.life <= 0 || energy.claimedBy !== undefined) continue;
      const score = distance(worker.pos, energy.pos) - (energy.rare ? 190 : 0) + Math.sin(worker.id + energy.id) * 16;
      if (score < bestScore) {
        best = energy;
        bestScore = score;
      }
    }
    return best;
  }

  private collectEnergy(worker: Worker, energy: EnergyParticle): void {
    worker.carry = energy.value;
    worker.carryRare = energy.rare;
    worker.targetEnergyId = undefined;
    energy.life = -1;
    const color = energy.rare ? GOLD : CYAN;
    for (let i = 0; i < (energy.rare ? 22 : 10); i += 1) {
      this.addParticle(energy.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(25, energy.rare ? 120 : 80)), color, this.rng.range(0.35, 0.8), this.rng.range(1.1, energy.rare ? 3.1 : 2.1), energy.rare ? 24 : 14);
    }
  }

  private deliverEnergy(worker: Worker): void {
    const value = worker.carry * this.getEnergyEfficiencyMultiplier();
    this.core.energy = clamp(this.core.energy + value, 0, 260);
    this.energyCollected += value;
    this.core.shockCharge = clamp(this.core.shockCharge + value / (worker.carryRare ? 70 : 120), 0, 1);
    this.core.pulse = Math.max(this.core.pulse, worker.carryRare ? 1.2 : 0.72);
    const color = worker.carryRare ? GOLD : CYAN;
    for (let i = 0; i < (worker.carryRare ? 20 : 8); i += 1) {
      this.addParticle(worker.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(35, worker.carryRare ? 140 : 90)), color, this.rng.range(0.35, 0.9), this.rng.range(1, worker.carryRare ? 3.2 : 2), worker.carryRare ? 24 : 14);
    }
    worker.carry = 0;
    worker.carryRare = false;
  }

  private getRepairTarget(worker: Worker): RepairTarget | undefined {
    if (worker.repairTarget) {
      const position = this.getRepairTargetPosition(worker.repairTarget);
      const stillValid =
        worker.repairTarget.kind === "node"
          ? (this.getNode(worker.repairTarget.id)?.infection ?? 0) > 0.025
          : (this.lines.find((line) => line.id === worker.repairTarget?.id)?.infection ?? 0) > 0.025;
      if (position && stillValid) return worker.repairTarget;
    }

    let best: RepairTarget | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const node of this.nodes) {
      if (node.infection < 0.08 && node.health > node.maxHealth * 0.78) continue;
      const score = distance(worker.pos, node.pos) - node.infection * 260 - (1 - node.health / node.maxHealth) * 180;
      if (score < bestScore) {
        bestScore = score;
        best = { kind: "node", id: node.id };
      }
    }
    for (const line of this.lines) {
      if (line.infection < 0.1) continue;
      const midpoint = this.getLinePoint(line, 0.5);
      const score = distance(worker.pos, midpoint) - line.infection * 240;
      if (score < bestScore) {
        bestScore = score;
        best = { kind: "line", id: line.id };
      }
    }
    return best;
  }

  private getRepairTargetPosition(target: RepairTarget): Vec2 | undefined {
    if (target.kind === "node") return this.getNode(target.id)?.pos;
    const line = this.lines.find((item) => item.id === target.id);
    return line ? this.getLinePoint(line, 0.5 + Math.sin(this.time + target.id) * 0.22) : undefined;
  }

  private repairAtTarget(worker: Worker, target: RepairTarget, dt: number): void {
    const repairMultiplier = this.getRepairMultiplier();
    if (target.kind === "node") {
      const node = this.getNode(target.id);
      if (!node) return;
      node.infection = clamp(node.infection - dt * 0.52 * repairMultiplier, 0, 1);
      node.health = clamp(node.health + dt * 10 * repairMultiplier, 0, node.maxHealth);
      if (node.infection <= 0.02 && node.health >= node.maxHealth * 0.95) worker.repairTarget = undefined;
    } else {
      const line = this.lines.find((item) => item.id === target.id);
      if (!line) return;
      line.infection = clamp(line.infection - dt * 0.68 * repairMultiplier, 0, 1);
      if (line.infection <= 0.02) worker.repairTarget = undefined;
    }

    const repairLevel = this.upgradeLevels.repairPower;
    if ((worker.id + Math.floor(this.time * (26 + repairLevel * 2))) % Math.max(9, 17 - repairLevel) === 0) {
      const count = repairLevel >= 5 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        this.addParticle(worker.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(10, 58 + repairLevel * 3)), GREEN, 0.42, this.rng.range(0.9, 1.9), 12 + repairLevel * 1.5);
      }
    }
  }

  private updateNodes(dt: number): void {
    const fireRateLevel = this.upgradeLevels.nodeFireRate;
    for (const node of this.nodes) {
      node.spin += dt * (0.8 + node.level * 0.16 + fireRateLevel * 0.035);
      node.overdrive = this.overdriveTimer > 0 ? 1 : Math.max(0, node.overdrive - dt * 1.5);
      node.buildProgress = clamp(node.buildProgress + dt * 0.7, 0, 1);
      node.cooldown -= dt * (node.overdrive > 0 ? 2.1 : 1) * clamp(1.2 - node.infection * 0.7, 0.25, 1.2);

      if (node.infection < 0.12 && this.core.energy > 6) {
        node.health = clamp(node.health + dt * 1.4, 0, node.maxHealth);
      }

      if (node.buildProgress < 1 || node.health <= 1) continue;
      const target = this.getNearestVirus(node.pos, node.range * (node.infection > 0.75 ? 0.55 : 1));
      if (target && node.cooldown <= 0) {
        this.fireNode(node, target);
      }
    }
  }

  private fireNode(node: DefenseNode, virus: Virus): void {
    const overdrive = node.overdrive > 0 ? 1.55 : 1;
    const fireRateMultiplier = this.getNodeFireRateMultiplier();
    const damage = (17 + node.level * 10) * overdrive * clamp(1.15 - node.infection * 0.55, 0.35, 1.15);
    const color = node.overdrive > 0 ? WHITE : this.upgradeLevels.nodeFireRate >= 6 ? "#9af8ff" : node.level >= 3 ? "#9af8ff" : CYAN;
    virus.hp -= damage;
    node.cooldown = 1 / (node.fireRate * overdrive * fireRateMultiplier);
    this.shotsFired += 1;
    this.beams.push({
      id: this.id(),
      from: { ...node.pos },
      to: { ...virus.pos },
      life: 0.16,
      maxLife: 0.16,
      color,
      width: 1.5 + node.level * 0.6 + this.upgradeLevels.nodeFireRate * 0.07 + (node.overdrive > 0 ? 1.3 : 0),
    });
    if (this.beams.length > MAX_BEAMS) this.beams.splice(0, this.beams.length - MAX_BEAMS);

    for (let i = 0; i < 3 + node.level; i += 1) {
      this.addParticle(virus.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(20, 95)), color, 0.22, this.rng.range(0.8, 1.7), 10);
    }
    if (virus.hp <= 0) this.killVirus(virus);
  }

  private updateViruses(dt: number, screen: ScreenState): void {
    if (screen === "menu") return;

    const coreDamageMultiplier = this.getCoreDamageMultiplier();
    const infectionResistance = this.getInfectionResistanceMultiplier();
    for (const virus of this.viruses) {
      if (virus.hp <= 0) continue;
      const target = this.getVirusTarget(virus);
      const toTarget = sub(target, virus.pos);
      const targetDir = normalize(toTarget);
      const wobble = fromAngle(virus.phase + this.time * (virus.elite ? 2.1 : 3.4), virus.elite ? 0.38 : 0.52);
      const desired = normalize(add(targetDir, wobble));
      const desiredSpeed = virus.speed;
      virus.vel = lerpVec(virus.vel, mul(desired, desiredSpeed), clamp(dt * (virus.elite ? 1.9 : 2.6), 0, 1));
      virus.pos = add(virus.pos, mul(virus.vel, dt));

      if (distance(virus.pos, this.core.pos) < CORE_RADIUS + virus.radius) {
        const damageScale = (this.cinematic ? 0.58 : 1) * coreDamageMultiplier;
        this.core.health -= dt * (virus.elite ? 18 : 8.5) * damageScale;
        this.core.energy = Math.max(0, this.core.energy - dt * 2.4 * coreDamageMultiplier);
        this.core.damageFlash = 1;
        this.screenShake = Math.max(this.screenShake, virus.elite ? 0.8 : 0.38);
        virus.hp -= dt * 95;
        if ((virus.id + Math.floor(this.time * 30)) % 7 === 0) {
          this.addParticle(virus.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(20, 88)), RED, 0.42, this.rng.range(1, 2.5), 18);
        }
        if (virus.hp <= 0) this.killVirus(virus);
      }

      for (const node of this.nodes) {
        if (node.buildProgress < 0.55) continue;
        const d = distance(virus.pos, node.pos);
        if (d < virus.radius + 23) {
          node.infection = clamp(node.infection + dt * virus.infectPower * (virus.elite ? 0.36 : 0.22) * infectionResistance, 0, 1);
          node.health = clamp(node.health - dt * (virus.elite ? 7 : 3.5), 0, node.maxHealth);
          virus.hp -= dt * (virus.elite ? 1.5 : 2.8);
          if (virus.hp <= 0) this.killVirus(virus);
        }
      }

      for (const line of this.lines) {
        const d = this.distanceToLine(virus.pos, line);
        if (d < virus.radius + 15) {
          line.infection = clamp(line.infection + dt * virus.infectPower * 0.07 * infectionResistance, 0, 1);
        }
      }
    }

    if (this.core.health <= 0) {
      this.destroyCore();
    }
  }

  private updateInfection(dt: number): void {
    const infectionResistance = this.getInfectionResistanceMultiplier();
    for (const line of this.lines) {
      line.pulse = (line.pulse + dt * (0.1 + line.infection * 0.08)) % 1;
      line.infection = clamp(line.infection - dt * 0.006, 0, 1);
    }
    for (const node of this.nodes) {
      const connectedLines = this.lines.filter((line) => line.toNodeId === node.id || line.fromNodeId === node.id);
      if (connectedLines.length > 0) {
        const linePressure = connectedLines.reduce((sum, line) => sum + line.infection, 0) / connectedLines.length;
        node.infection = clamp(node.infection + linePressure * dt * 0.018 * infectionResistance - dt * 0.004, 0, 1);
      } else {
        node.infection = clamp(node.infection - dt * 0.004, 0, 1);
      }
      if (node.infection > 0.82) {
        node.health = clamp(node.health - dt * 1.2, 0, node.maxHealth);
      }
    }
  }

  private updateCore(dt: number, screen: ScreenState): void {
    if (screen === "menu") {
      this.core.shockCharge = clamp(this.core.shockCharge + dt * 0.018, 0, 1);
      if (this.menuPulseTimer > 3.8) {
        this.menuPulseTimer = 0;
        this.core.pulse = 1;
        this.addShockwave(this.core.pos, 220, 1, CYAN);
      }
      return;
    }

    if (this.core.energy > 16 && this.core.health < this.core.maxHealth) {
      const repair = Math.min(dt * 1.15, this.core.energy * 0.02);
      this.core.health = clamp(this.core.health + repair, 0, this.core.maxHealth);
      this.core.energy = Math.max(0, this.core.energy - repair * 0.7);
    }

    this.core.shockCharge = clamp(this.core.shockCharge + dt * 0.012, 0, 1);
    const nearbyViruses = this.viruses.filter((virus) => virus.hp > 0 && distance(virus.pos, this.core.pos) < 230).length;
    if ((this.cinematic && nearbyViruses >= 7 && this.core.shockCharge > 0.62) || (nearbyViruses >= 13 && this.core.shockCharge > 0.86)) {
      this.triggerShockwave(true);
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.pos = add(particle.pos, mul(particle.vel, dt));
      particle.vel = mul(particle.vel, Math.pow(0.04, dt));
    }
    for (const beam of this.beams) {
      beam.life -= dt;
    }
    for (const shockwave of this.shockwaves) {
      shockwave.life -= dt;
      const t = 1 - shockwave.life / shockwave.maxLife;
      shockwave.radius = lerp(18, shockwave.maxRadius, clamp(t, 0, 1));
    }
    for (const beacon of this.beacons) {
      beacon.life -= dt;
    }
  }

  private updateDirector(dt: number, screen: ScreenState): void {
    if (screen === "menu") {
      this.directorTimer -= dt;
      if (this.directorTimer <= 0) {
        this.directorTimer = this.rng.range(4.2, 6.8);
        this.spawnEnergyBloom(false);
        this.setEvent("Synthetic colony idling", GREEN, 2.2);
      }
      return;
    }

    if (!this.introWaveSpawned && this.time >= this.nextWaveAt) {
      this.introWaveSpawned = true;
      this.spawnNextWave();
    }
    if (this.introWaveSpawned && this.time >= this.nextWaveAt) {
      this.spawnNextWave();
    }
    if (!this.introBloomSpawned && this.time > 11.5) {
      this.introBloomSpawned = true;
      this.spawnEnergyBloom(true);
      this.setEvent("Rare energy bloom", GOLD, 2.4);
    }

    this.directorTimer -= dt;
    if (this.directorTimer > 0) return;
    this.directorTimer = this.rng.range(6.2, 9.2);

    const infection = this.calculateInfection();
    const roll = this.rng.next();

    if (roll < 0.3) {
      this.spawnEnergyBloom(this.rng.chance(0.55));
      this.setEvent("Rare energy bloom", GOLD, 2.3);
    } else if (roll < 0.43 && this.core.shockCharge > 0.55) {
      this.triggerShockwave(true);
    } else if (roll < 0.62 && this.nodes.length < MAX_NODES && this.core.energy > this.nodeCost() * 0.72) {
      if (this.addDefenseNode(undefined, this.core.energy < this.nodeCost())) {
        this.setEvent("New defense node constructed", GREEN, 2.3);
      }
    } else if (roll < 0.74 && this.nodes.some((node) => node.level < 4)) {
      this.upgradeNode(true);
    } else if (roll < 0.88 && infection > 0.035) {
      this.triggerInfectionOutbreak();
    } else {
      this.triggerLaserOverdrive();
    }
  }

  private autoBuildAndUpgrade(dt: number, screen: ScreenState): void {
    if (screen === "menu") return;
    this.nodeBuildCooldown -= dt;
    this.nodeUpgradeCooldown -= dt;

    if (this.nodeBuildCooldown <= 0 && this.nodes.length < MAX_NODES && this.core.energy >= this.nodeCost()) {
      this.nodeBuildCooldown = this.rng.range(5.0, 8.2);
      if (this.addDefenseNode()) {
        this.setEvent("New defense node constructed", GREEN, 2.2);
      }
    }

    if (this.nodeUpgradeCooldown <= 0 && this.core.energy >= this.upgradeCost()) {
      this.nodeUpgradeCooldown = this.rng.range(7.0, 10.5);
      this.upgradeNode(false);
    }
  }

  private addDefenseNode(position?: Vec2, free = false): boolean {
    if (this.nodes.length >= MAX_NODES) return false;
    const cost = this.nodeCost();
    if (!free && this.core.energy < cost) return false;
    if (!free) this.core.energy -= cost;

    const pos = position ?? this.chooseNodePosition();
    const node: DefenseNode = {
      id: this.id(),
      pos,
      level: 1,
      range: 168,
      cooldown: this.rng.range(0.05, 0.45),
      fireRate: 1.28,
      health: 56,
      maxHealth: 56,
      infection: 0,
      buildProgress: free ? 1 : 0.02,
      spin: this.rng.range(0, TAU),
      overdrive: this.overdriveTimer > 0 ? 1 : 0,
    };

    const previousNodes = [...this.nodes];
    this.nodes.push(node);
    this.nodesBuilt += 1;
    this.lines.push({
      id: this.id(),
      toNodeId: node.id,
      infection: 0,
      pulse: this.rng.next(),
      route: this.rng.chance(0.5) ? "hv" : "vh",
    });

    if (previousNodes.length > 0 && (free || this.rng.chance(0.8))) {
      const nearest = previousNodes.reduce((best, candidate) => {
        return distance(candidate.pos, node.pos) < distance(best.pos, node.pos) ? candidate : best;
      }, previousNodes[0]);
      this.lines.push({
        id: this.id(),
        fromNodeId: nearest.id,
        toNodeId: node.id,
        infection: 0,
        pulse: this.rng.next(),
        route: this.rng.chance(0.5) ? "hv" : "vh",
      });
    }

    this.core.pulse = 1;
    this.addShockwave(pos, 150, 0.82, GREEN);
    for (let i = 0; i < 42; i += 1) {
      this.addParticle(pos, fromAngle(this.rng.range(0, TAU), this.rng.range(28, 150)), this.rng.pick([GREEN, CYAN, WHITE]), this.rng.range(0.45, 1.05), this.rng.range(1.2, 3.2), 18);
    }
    return true;
  }

  private chooseNodePosition(): Vec2 {
    const rings = [176, 255, 336, 426, 515];
    for (let attempt = 0; attempt < 42; attempt += 1) {
      const ring = rings[Math.min(rings.length - 1, Math.floor(this.nodes.length / 3))];
      const angle = -Math.PI / 2 + this.nodes.length * 2.399 + this.rng.range(-0.75, 0.75) + attempt * 0.19;
      const pos = add(this.core.pos, fromAngle(angle, ring + this.rng.range(-38, 42)));
      const clamped = this.clampToGameplay(pos, 16);
      const tooClose = this.nodes.some((node) => distance(node.pos, clamped) < 112);
      if (!tooClose) return clamped;
    }
    return {
      x: this.rng.range(GAMEPLAY_BOUNDS.minX + 46, GAMEPLAY_BOUNDS.maxX - 46),
      y: this.rng.range(640, GAMEPLAY_BOUNDS.maxY - 35),
    };
  }

  private nodeCost(): number {
    return 36 + this.nodes.length * 12;
  }

  private upgradeCost(): number {
    const next = this.nodes.filter((node) => node.level < 4).sort((a, b) => a.level - b.level)[0];
    return next ? 34 + next.level * 24 : Number.POSITIVE_INFINITY;
  }

  private upgradeNode(fromDirector: boolean): boolean {
    const candidates = this.nodes.filter((node) => node.level < 4 && node.buildProgress >= 1);
    if (candidates.length === 0) return false;
    const node = candidates.sort((a, b) => a.level - b.level || a.infection - b.infection)[0];
    const cost = 34 + node.level * 24;
    if (this.core.energy < cost && !fromDirector) return false;
    if (this.core.energy >= cost) this.core.energy -= cost;
    node.level += 1;
    node.maxHealth += 18;
    node.health = node.maxHealth;
    node.range += 24;
    node.fireRate += 0.34;
    node.infection = clamp(node.infection - 0.24, 0, 1);
    node.overdrive = Math.max(node.overdrive, 0.6);
    this.setEvent("Node upgraded", CYAN, 2.1);
    this.addShockwave(node.pos, 132 + node.level * 18, 0.75, CYAN);
    for (let i = 0; i < 36; i += 1) {
      this.addParticle(node.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(22, 135)), this.rng.pick([CYAN, WHITE, GREEN]), this.rng.range(0.4, 0.9), this.rng.range(1, 2.6), 18);
    }
    return true;
  }

  private spawnNextWave(): void {
    this.wave += 1;
    const waveIndex = Math.max(0, this.wave - 1);
    const count = Math.round(clamp((9 + Math.min(3, waveIndex)) * Math.pow(1.1, waveIndex), 9, this.time < 120 ? 18 + this.wave : 42));
    const scaling = {
      eliteChance: this.wave <= 2 ? 0.02 : Math.min(0.05 + this.wave * 0.012, 0.24),
      hpScale: 1 + Math.min(waveIndex * 0.045, 1.1),
      speedScale: 1 + Math.min(waveIndex * 0.032, 0.55),
      infectScale: 1 + Math.min(waveIndex * 0.025, 0.45),
    };

    const eliteSpawned = this.spawnVirusWave(undefined, count, scaling);
    const waveGap = this.time < 120 ? this.rng.range(25, 30) : this.rng.range(21, 27);
    this.nextWaveAt = this.time + waveGap;
    this.setEvent(eliteSpawned ? "Elite virus detected" : `Wave ${this.wave}`, eliteSpawned ? MAGENTA : RED, 2.4);
  }

  private spawnEnergyBloom(rare: boolean): void {
    const angle = this.rng.range(0, TAU);
    const center = this.clampToGameplay(
      {
        x: this.core.pos.x + Math.cos(angle) * this.rng.range(180, 420),
        y: this.core.pos.y + Math.sin(angle) * this.rng.range(180, 470),
      },
      36,
    );
    const count = rare ? 18 : 13;
    for (let i = 0; i < count; i += 1) {
      this.spawnEnergy(rare && i % 3 === 0, add(center, fromAngle(this.rng.range(0, TAU), this.rng.range(12, rare ? 108 : 78))));
    }
    this.addShockwave(center, rare ? 180 : 130, 1, rare ? GOLD : GREEN);
  }

  private spawnVirusWave(
    edge?: "top" | "right" | "bottom" | "left",
    count = 12,
    scaling: { eliteChance: number; hpScale: number; speedScale: number; infectScale: number } = {
      eliteChance: 0.08,
      hpScale: 1,
      speedScale: 1,
      infectScale: 1,
    },
  ): boolean {
    const chosenEdge = edge ?? this.rng.pick(["top", "right", "bottom", "left"] as const);
    const waveCount = Math.min(MAX_VIRUS - this.viruses.length, Math.max(0, count));
    let eliteSpawned = false;
    for (let i = 0; i < waveCount; i += 1) {
      let pos: Vec2;
      if (chosenEdge === "top") pos = { x: this.rng.range(40, WORLD_WIDTH - 40), y: -28 - i * 3 };
      else if (chosenEdge === "bottom") pos = { x: this.rng.range(40, WORLD_WIDTH - 40), y: WORLD_HEIGHT + 28 + i * 3 };
      else if (chosenEdge === "left") pos = { x: -28 - i * 3, y: this.rng.range(120, WORLD_HEIGHT - 90) };
      else pos = { x: WORLD_WIDTH + 28 + i * 3, y: this.rng.range(120, WORLD_HEIGHT - 90) };

      const elite =
        this.rng.chance(scaling.eliteChance) ||
        (this.wave >= 5 && i === waveCount - 1 && waveCount > 13 && this.rng.chance(Math.min(0.5, scaling.eliteChance * 2)));
      eliteSpawned ||= elite;
      const baseHp = elite ? 118 + Math.min(this.time * 0.08, 70) : 34 + Math.min(this.time * 0.035, 30);
      this.viruses.push({
        id: this.id(),
        pos,
        vel: fromAngle(this.rng.range(0, TAU), this.rng.range(8, 30)),
        speed: (elite ? 52 : 72) * scaling.speedScale,
        hp: baseHp * scaling.hpScale,
        maxHp: baseHp * scaling.hpScale,
        radius: elite ? this.rng.range(15, 21) : this.rng.range(6, 10),
        elite,
        phase: this.rng.range(0, TAU),
        infectPower: (elite ? 1.7 : 1) * scaling.infectScale,
      });
    }
    return eliteSpawned;
  }

  private triggerInfectionOutbreak(): void {
    const infectionResistance = this.getInfectionResistanceMultiplier();
    const line = this.rng.pick(this.lines);
    if (line) {
      line.infection = clamp(line.infection + this.rng.range(0.28, 0.48) * infectionResistance, 0, 1);
      const origin = this.getLinePoint(line, this.rng.range(0.2, 0.8));
      this.addShockwave(origin, 125, 0.9, MAGENTA);
      for (let i = 0; i < 34; i += 1) {
        this.addParticle(origin, fromAngle(this.rng.range(0, TAU), this.rng.range(22, 112)), this.rng.pick([MAGENTA, RED]), this.rng.range(0.45, 1), this.rng.range(1.2, 3.2), 20);
      }
    }
    if (this.rng.chance(0.45)) {
      const node = this.rng.pick(this.nodes);
      if (node) node.infection = clamp(node.infection + this.rng.range(0.18, 0.36) * infectionResistance, 0, 1);
    }
    this.setEvent("Outbreak", MAGENTA, 2.3);
  }

  private triggerLaserOverdrive(): void {
    this.overdriveTimer = 5.6;
    for (const node of this.nodes) node.overdrive = 1;
    this.setEvent("Laser overdrive", WHITE, 2.2);
    for (const node of this.nodes) {
      if (node.buildProgress >= 1) this.addShockwave(node.pos, 110, 0.65, WHITE);
    }
  }

  private updateDestroyed(dt: number): void {
    this.time += dt;
    this.core.collapseTimer += dt;
    this.eventLabel.life = Math.max(0, this.eventLabel.life - dt);
    this.screenShake = Math.max(0, this.screenShake - dt * 2.2);
    this.updateParticles(dt);

    if (this.core.collapseTimer < 2.6 && Math.floor(this.core.collapseTimer * 24) % 3 === 0) {
      this.addParticle(this.core.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(60, 240)), this.rng.pick([RED, MAGENTA, WHITE]), 0.48, this.rng.range(1.4, 4.2), 34);
    }
  }

  private destroyCore(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.survivedTime = this.time;
    this.core.health = 0;
    this.core.collapseTimer = 0;
    this.screenShake = 1.2;
    this.setEvent("Core collapse", RED, 3);
    this.addShockwave(this.core.pos, 520, 1.4, RED);
    for (let i = 0; i < 150; i += 1) {
      this.addParticle(this.core.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(80, 320)), this.rng.pick([RED, MAGENTA, WHITE, CYAN]), this.rng.range(0.8, 1.8), this.rng.range(1.2, 5.2), 40);
    }
  }

  private getVirusTarget(virus: Virus): Vec2 {
    let best = this.core.pos;
    let bestScore = distance(virus.pos, this.core.pos) - 95;
    for (const node of this.nodes) {
      if (node.buildProgress < 0.4) continue;
      const score = distance(virus.pos, node.pos) - node.infection * 85 + (node.health <= 0 ? 80 : 0);
      if (score < bestScore) {
        best = node.pos;
        bestScore = score;
      }
    }
    return best;
  }

  private getNearestVirus(pos: Vec2, range: number): Virus | undefined {
    let best: Virus | undefined;
    let bestDistance = range;
    for (const virus of this.viruses) {
      if (virus.hp <= 0) continue;
      const d = distance(pos, virus.pos);
      if (d < bestDistance) {
        best = virus;
        bestDistance = d;
      }
    }
    return best;
  }

  private killVirus(virus: Virus): void {
    if (virus.hp <= -900) return;
    virus.hp = -999;
    const color = virus.elite ? MAGENTA : RED;
    const count = virus.elite ? 34 : 16;
    for (let i = 0; i < count; i += 1) {
      this.addParticle(virus.pos, fromAngle(this.rng.range(0, TAU), this.rng.range(35, virus.elite ? 180 : 125)), this.rng.pick([color, MAGENTA, RED]), this.rng.range(0.45, virus.elite ? 1.3 : 0.9), this.rng.range(1.1, virus.elite ? 3.8 : 2.5), virus.elite ? 28 : 18);
    }
    if (virus.elite) this.addShockwave(virus.pos, 135, 0.8, MAGENTA);
  }

  private distanceToLine(point: Vec2, line: CircuitLine): number {
    const points = this.getLinePoints(line);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < points.length - 1; i += 1) {
      best = Math.min(best, distToSegment(point, points[i], points[i + 1]));
    }
    return best;
  }

  private getNode(id: number): DefenseNode | undefined {
    return this.nodes.find((node) => node.id === id);
  }

  private addShockwave(pos: Vec2, maxRadius: number, maxLife: number, color: string): void {
    this.shockwaves.push({
      id: this.id(),
      pos: { ...pos },
      radius: 4,
      maxRadius,
      life: maxLife,
      maxLife,
      color,
    });
    if (this.shockwaves.length > MAX_SHOCKWAVES) this.shockwaves.splice(0, this.shockwaves.length - MAX_SHOCKWAVES);
  }

  private addParticle(pos: Vec2, vel: Vec2, color: string, life: number, size: number, glow: number): void {
    this.particles.push({
      id: this.id(),
      pos: { ...pos },
      vel,
      life,
      maxLife: life,
      size,
      color,
      glow,
    });
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
  }

  private setEvent(text: string, color: string, life: number): void {
    this.eventLabel = { text, color, life, maxLife: life };
  }

  private calculateInfection(): number {
    const nodeScore = this.nodes.length
      ? this.nodes.reduce((sum, node) => sum + node.infection + (1 - node.health / node.maxHealth) * 0.25, 0) / this.nodes.length
      : 0;
    const lineScore = this.lines.length ? this.lines.reduce((sum, line) => sum + line.infection, 0) / this.lines.length : 0;
    const virusPressure = clamp(
      this.viruses.filter((virus) => virus.hp > 0 && distance(virus.pos, this.core.pos) < 320).length / 28,
      0,
      1,
    );
    return clamp(nodeScore * 0.42 + lineScore * 0.36 + virusPressure * 0.22, 0, 1);
  }

  private constrainAgent(pos: Vec2, vel: Vec2, padding: number): void {
    const minX = GAMEPLAY_BOUNDS.minX - 30 + padding;
    const maxX = GAMEPLAY_BOUNDS.maxX + 30 - padding;
    const minY = GAMEPLAY_BOUNDS.minY - 48 + padding;
    const maxY = GAMEPLAY_BOUNDS.maxY - padding;
    if (pos.x < minX) {
      pos.x = minX;
      vel.x = Math.abs(vel.x) * 0.45;
    } else if (pos.x > maxX) {
      pos.x = maxX;
      vel.x = -Math.abs(vel.x) * 0.45;
    }
    if (pos.y < minY) {
      pos.y = minY;
      vel.y = Math.abs(vel.y) * 0.45;
    } else if (pos.y > maxY) {
      pos.y = maxY;
      vel.y = -Math.abs(vel.y) * 0.45;
    }
  }

  private clampToGameplay(pos: Vec2, padding: number): Vec2 {
    return {
      x: clamp(pos.x, GAMEPLAY_BOUNDS.minX + padding, GAMEPLAY_BOUNDS.maxX - padding),
      y: clamp(pos.y, GAMEPLAY_BOUNDS.minY + padding, GAMEPLAY_BOUNDS.maxY - padding),
    };
  }

  private cleanup(): void {
    this.energy = this.energy.filter((energy) => energy.life > 0).slice(-MAX_ENERGY);
    this.viruses = this.viruses.filter((virus) => virus.hp > 0).slice(-MAX_VIRUS);
    this.particles = this.particles.filter((particle) => particle.life > 0).slice(-MAX_PARTICLES);
    this.beams = this.beams.filter((beam) => beam.life > 0).slice(-MAX_BEAMS);
    this.shockwaves = this.shockwaves.filter((shockwave) => shockwave.life > 0).slice(-MAX_SHOCKWAVES);
    this.beacons = this.beacons.filter((beacon) => beacon.life > 0).slice(-4);
  }
}
