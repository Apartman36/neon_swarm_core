import { CORE_RADIUS, GAMEPLAY_BOUNDS, SAFE_AREA, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { TAU, clamp, distance, fromAngle, pointAlongPolyline, wrap01 } from "./math";
import type { Simulation } from "./simulation";
import type { CircuitLine, RenderOptions, Vec2 } from "./types";

const DARK = "#02050a";
const CYAN = "#45eaff";
const BLUE = "#438cff";
const GREEN = "#42ff9b";
const GOLD = "#ffe27a";
const MAGENTA = "#ff3df2";
const RED = "#ff315f";
const WHITE = "#f5fbff";

export function renderSimulation(ctx: CanvasRenderingContext2D, sim: Simulation, options: RenderOptions): void {
  const canvas = ctx.canvas;
  const pixelWidth = canvas.width;
  const pixelHeight = canvas.height;
  if (pixelWidth <= 0 || pixelHeight <= 0) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);

  const baseScale = Math.min(pixelWidth / WORLD_WIDTH, pixelHeight / WORLD_HEIGHT);
  const shake = sim.screenShake;
  const shakeX = Math.sin(sim.time * 73.1) * shake * 9 * baseScale;
  const shakeY = Math.cos(sim.time * 67.7) * shake * 9 * baseScale;
  const cinematicZoom = options.cinematic && options.screen !== "menu" ? 1.018 + Math.sin(sim.time * 0.12) * 0.012 : 1;
  const panX = options.cinematic ? Math.sin(sim.time * 0.07) * 18 * baseScale : 0;
  const panY = options.cinematic ? Math.cos(sim.time * 0.06) * 16 * baseScale : 0;

  ctx.save();
  ctx.translate(pixelWidth / 2 + shakeX + panX, pixelHeight / 2 + shakeY + panY);
  ctx.scale(baseScale * cinematicZoom, baseScale * cinematicZoom);
  ctx.translate(-WORLD_WIDTH / 2, -WORLD_HEIGHT / 2);

  drawBackground(ctx, sim);
  drawCircuitLines(ctx, sim);
  drawBeacons(ctx, sim);
  drawEnergy(ctx, sim);
  drawWorkers(ctx, sim);
  drawNodes(ctx, sim);
  drawViruses(ctx, sim);
  drawBeams(ctx, sim);
  drawParticles(ctx, sim);
  drawShockwaves(ctx, sim);
  drawCore(ctx, sim);
  drawScreenPulse(ctx, sim);
  drawEventLabel(ctx, sim, options);
  if (options.debug) drawDebug(ctx, sim);

  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, "#01030a");
  gradient.addColorStop(0.45, "#04101a");
  gradient.addColorStop(1, "#020409");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  for (let x = 0; x <= WORLD_WIDTH; x += 60) {
    const alpha = x % 180 === 0 ? 0.075 : 0.035;
    ctx.strokeStyle = `rgba(68, 236, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += 60) {
    const alpha = y % 180 === 0 ? 0.07 : 0.03;
    ctx.strokeStyle = `rgba(69, 255, 166, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }

  for (const trace of sim.traces) {
    const pulse = 0.5 + Math.sin(sim.time * 1.2 + trace.phase * TAU) * 0.5;
    ctx.strokeStyle = `rgba(78, 255, 176, ${0.04 + trace.strength * 0.11 + pulse * 0.03})`;
    ctx.lineWidth = 1 + trace.strength * 1.1;
    ctx.beginPath();
    ctx.moveTo(trace.a.x, trace.a.y);
    ctx.lineTo(trace.b.x, trace.b.y);
    ctx.stroke();

    if (pulse > 0.86) {
      const p = {
        x: trace.a.x + (trace.b.x - trace.a.x) * pulse,
        y: trace.a.y + (trace.b.y - trace.a.y) * pulse,
      };
      glowCircle(ctx, p, 2.2, GREEN, 0.22, 12);
    }
  }

  const scanOffset = (sim.time * 26) % 42;
  for (let y = -42 + scanOffset; y < WORLD_HEIGHT; y += 42) {
    ctx.fillStyle = "rgba(130, 240, 255, 0.018)";
    ctx.fillRect(0, y, WORLD_WIDTH, 2);
  }

  const safeGradient = ctx.createRadialGradient(
    SAFE_AREA.x + SAFE_AREA.width / 2,
    SAFE_AREA.y + SAFE_AREA.height / 2,
    30,
    SAFE_AREA.x + SAFE_AREA.width / 2,
    SAFE_AREA.y + SAFE_AREA.height / 2,
    360,
  );
  safeGradient.addColorStop(0, "rgba(2, 5, 10, 0.26)");
  safeGradient.addColorStop(1, "rgba(2, 5, 10, 0)");
  ctx.fillStyle = safeGradient;
  ctx.fillRect(SAFE_AREA.x - 160, SAFE_AREA.y - 140, SAFE_AREA.width + 320, SAFE_AREA.height + 280);

  const vignette = ctx.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 360, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 930);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.62)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.restore();
}

function drawCircuitLines(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const line of sim.lines) {
    const points = sim.getLinePoints(line);
    if (points.length < 2) continue;
    const infection = line.infection;
    const color = infection > 0.5 ? RED : infection > 0.18 ? MAGENTA : GREEN;
    const cyanMix = infection < 0.12 ? CYAN : color;
    const alpha = 0.28 + (1 - infection) * 0.22;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + infection * 18;
    ctx.strokeStyle = colorWithAlpha(cyanMix, alpha);
    ctx.lineWidth = 3.6 + infection * 2.4;
    strokePolyline(ctx, points);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = colorWithAlpha(infection > 0.2 ? MAGENTA : CYAN, infection > 0.2 ? 0.18 : 0.12);
    ctx.lineWidth = 1.1;
    strokePolyline(ctx, points);

    const pulseCount = line.fromNodeId === undefined ? 3 : 2;
    for (let i = 0; i < pulseCount; i += 1) {
      const t = wrap01(line.pulse + sim.time * (0.16 + infection * 0.05) + i / pulseCount);
      const p = pointAlongPolyline(points, t);
      glowCircle(ctx, p, infection > 0.25 ? 3.6 : 2.8, infection > 0.25 ? MAGENTA : CYAN, infection > 0.25 ? 0.42 : 0.32, infection > 0.25 ? 22 : 16);
    }
  }
  ctx.restore();
}

function drawBeacons(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const beacon of sim.beacons) {
    const alpha = clamp(beacon.life / beacon.maxLife, 0, 1);
    ctx.strokeStyle = `rgba(69, 234, 255, ${0.16 * alpha})`;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 20;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(beacon.pos.x, beacon.pos.y, beacon.radius * (1 - alpha * 0.18), 0, TAU);
    ctx.stroke();
    glowCircle(ctx, beacon.pos, 8 + Math.sin(sim.time * 8) * 2, CYAN, 0.42 * alpha, 30);
  }
  ctx.restore();
}

function drawEnergy(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const energy of sim.energy) {
    const alpha = clamp(Math.min(energy.life / 2.4, 1), 0, 1);
    const pulse = 0.5 + Math.sin(energy.pulse) * 0.5;
    const color = energy.rare ? GOLD : energy.value > 6 ? GREEN : CYAN;
    glowCircle(ctx, energy.pos, energy.rare ? 5.2 + pulse * 2.2 : 3.2 + pulse * 1.2, color, alpha * (energy.rare ? 0.72 : 0.48), energy.rare ? 30 : 18);
    ctx.fillStyle = colorWithAlpha(WHITE, energy.rare ? 0.6 * alpha : 0.26 * alpha);
    ctx.beginPath();
    ctx.arc(energy.pos.x, energy.pos.y, energy.rare ? 1.8 : 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorkers(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const worker of sim.workers) {
    const color = worker.carryRare ? GOLD : worker.carry > 0 ? WHITE : worker.state === "repair" ? GREEN : worker.state === "flee" ? "#a6f7ff" : CYAN;

    if (worker.trail.length > 1) {
      ctx.lineCap = "round";
      ctx.lineWidth = worker.carry > 0 ? 1.8 : 1.2;
      for (let i = 1; i < worker.trail.length; i += 1) {
        const a = worker.trail[i - 1];
        const b = worker.trail[i];
        const alpha = clamp((a.life + b.life) * 0.08, 0, 0.22);
        ctx.strokeStyle = colorWithAlpha(color, alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(worker.pos.x, worker.pos.y);
    ctx.rotate(worker.angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = worker.carry > 0 ? 12 : 8;
    ctx.fillStyle = colorWithAlpha(color, worker.state === "flee" ? 0.9 : 0.78);
    const size = worker.carry > 0 ? 5.1 : 3.6;
    ctx.beginPath();
    ctx.moveTo(size * 1.45, 0);
    ctx.lineTo(-size, size * 0.72);
    ctx.lineTo(-size * 0.56, 0);
    ctx.lineTo(-size, -size * 0.72);
    ctx.closePath();
    ctx.fill();
    if (worker.carry > 0) {
      ctx.fillStyle = worker.carryRare ? GOLD : WHITE;
      ctx.beginPath();
      ctx.arc(-size * 1.45, 0, worker.carryRare ? 2.2 : 1.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawNodes(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const fireUpgrade = sim.upgradeLevels.nodeFireRate;
  for (const node of sim.nodes) {
    const built = clamp(node.buildProgress, 0, 1);
    const infection = node.infection;
    const disabled = node.health <= 1 || infection > 0.88;
    const baseColor = disabled ? MAGENTA : infection > 0.32 ? MAGENTA : node.overdrive > 0 ? WHITE : fireUpgrade >= 5 ? CYAN : GREEN;
    const radius = 15 + node.level * 3.2 + fireUpgrade * 0.35;

    ctx.strokeStyle = colorWithAlpha(infection > 0.25 ? MAGENTA : CYAN, (0.045 + fireUpgrade * 0.003) * built);
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(node.pos.x, node.pos.y, node.range, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.translate(node.pos.x, node.pos.y);
    ctx.rotate(node.spin);
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 18 + node.level * 5 + infection * 12;
    ctx.strokeStyle = colorWithAlpha(baseColor, 0.7 * built);
    ctx.lineWidth = 2.5 + node.level * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + TAU * built);
    ctx.stroke();

    for (let i = 0; i < node.level; i += 1) {
      const angle = (i / node.level) * TAU;
      ctx.fillStyle = colorWithAlpha(baseColor, 0.75 * built);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * (radius + 5), Math.sin(angle) * (radius + 5), 2.2, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = colorWithAlpha(baseColor, 0.3 + built * 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.48, 0, TAU);
    ctx.fill();

    if (infection > 0.05) {
      ctx.strokeStyle = colorWithAlpha(RED, infection * 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 7, 0, TAU * infection);
      ctx.stroke();
    }

    const health = node.health / node.maxHealth;
    if (health < 0.98) {
      ctx.strokeStyle = colorWithAlpha(WHITE, 0.35);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 12, -Math.PI / 2, -Math.PI / 2 + TAU * health);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawViruses(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const virus of sim.viruses) {
    if (virus.hp <= 0) continue;
    const flicker = 0.72 + Math.sin(sim.time * 13 + virus.phase) * 0.28;
    const color = virus.elite ? MAGENTA : RED;
    const radius = virus.radius * (virus.elite ? 1.05 : 1) * (0.92 + flicker * 0.12);

    ctx.save();
    ctx.translate(virus.pos.x, virus.pos.y);
    ctx.rotate(virus.phase + sim.time * (virus.elite ? 1.4 : 2.2));
    ctx.shadowColor = color;
    ctx.shadowBlur = virus.elite ? 28 : 16;
    ctx.fillStyle = colorWithAlpha(color, virus.elite ? 0.78 : 0.68);
    ctx.strokeStyle = colorWithAlpha(WHITE, virus.elite ? 0.35 : 0.18);
    ctx.lineWidth = virus.elite ? 1.4 : 1;
    const spikes = virus.elite ? 9 : 7;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = (i / (spikes * 2)) * TAU;
      const r = i % 2 === 0 ? radius * 1.28 : radius * 0.58;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorWithAlpha(DARK, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.32, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBeams(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const beam of sim.beams) {
    const alpha = clamp(beam.life / beam.maxLife, 0, 1);
    ctx.shadowColor = beam.color;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = colorWithAlpha(beam.color, 0.26 * alpha);
    ctx.lineWidth = beam.width * 4.5;
    ctx.beginPath();
    ctx.moveTo(beam.from.x, beam.from.y);
    ctx.lineTo(beam.to.x, beam.to.y);
    ctx.stroke();
    ctx.shadowBlur = 10;
    ctx.strokeStyle = colorWithAlpha(WHITE, 0.78 * alpha);
    ctx.lineWidth = beam.width;
    ctx.beginPath();
    ctx.moveTo(beam.from.x, beam.from.y);
    ctx.lineTo(beam.to.x, beam.to.y);
    ctx.stroke();
    glowCircle(ctx, beam.to, 3 + beam.width, beam.color, 0.32 * alpha, 16);
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const particle of sim.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    const radius = particle.size * (0.35 + alpha * 0.65);
    glowCircle(ctx, particle.pos, radius, particle.color, alpha * 0.58, particle.glow);
  }
  ctx.restore();
}

function drawShockwaves(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const shockwave of sim.shockwaves) {
    const alpha = clamp(shockwave.life / shockwave.maxLife, 0, 1);
    ctx.strokeStyle = colorWithAlpha(shockwave.color, 0.48 * alpha);
    ctx.shadowColor = shockwave.color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 2.5 + alpha * 2;
    ctx.beginPath();
    ctx.arc(shockwave.pos.x, shockwave.pos.y, shockwave.radius, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCore(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  const core = sim.core;
  const health = clamp(core.health / core.maxHealth, 0, 1);
  const pulse = core.pulse;
  const collapse = sim.destroyed ? clamp(core.collapseTimer / 2.4, 0, 1) : 0;
  const coreColor = sim.destroyed ? RED : health < 0.35 ? MAGENTA : CYAN;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(core.pos.x, core.pos.y);

  const glow = 36 + pulse * 28 + core.damageFlash * 22;
  ctx.shadowColor = coreColor;
  ctx.shadowBlur = glow;
  ctx.fillStyle = colorWithAlpha(coreColor, sim.destroyed ? 0.3 : 0.28 + pulse * 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, CORE_RADIUS + pulse * 10 + collapse * 30, 0, TAU);
  ctx.fill();

  ctx.rotate(sim.time * 0.32);
  ctx.strokeStyle = colorWithAlpha(coreColor, 0.78 * (1 - collapse));
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_RADIUS + 8, 0, TAU);
  ctx.stroke();

  ctx.rotate(-sim.time * 0.76);
  ctx.strokeStyle = colorWithAlpha(WHITE, 0.52 * (1 - collapse));
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 23, Math.sin(a) * 23);
    ctx.lineTo(Math.cos(a) * (CORE_RADIUS + 17), Math.sin(a) * (CORE_RADIUS + 17));
    ctx.stroke();
  }

  ctx.fillStyle = colorWithAlpha(DARK, 0.8);
  ctx.beginPath();
  ctx.arc(0, 0, CORE_RADIUS * 0.54, 0, TAU);
  ctx.fill();

  ctx.fillStyle = colorWithAlpha(WHITE, 0.8 * (1 - collapse));
  ctx.beginPath();
  ctx.arc(0, 0, 9 + pulse * 4, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = colorWithAlpha(health > 0.5 ? GREEN : health > 0.25 ? GOLD : RED, 0.86);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_RADIUS + 20, -Math.PI / 2, -Math.PI / 2 + TAU * health);
  ctx.stroke();

  ctx.strokeStyle = colorWithAlpha(WHITE, 0.68);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_RADIUS + 29, -Math.PI / 2, -Math.PI / 2 + TAU * core.shockCharge);
  ctx.stroke();

  if (sim.destroyed) {
    ctx.strokeStyle = colorWithAlpha(RED, 0.8);
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const a = i * 0.8 + sim.time;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a + 0.3) * (CORE_RADIUS + collapse * 90), Math.sin(a + 0.3) * (CORE_RADIUS + collapse * 90));
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawScreenPulse(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  const pulse = clamp(sim.core.pulse - 0.72, 0, 0.55);
  if (pulse <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(sim.core.pos.x, sim.core.pos.y, 80, sim.core.pos.x, sim.core.pos.y, 780);
  gradient.addColorStop(0, `rgba(245, 251, 255, ${0.07 * pulse})`);
  gradient.addColorStop(0.45, `rgba(69, 234, 255, ${0.055 * pulse})`);
  gradient.addColorStop(1, "rgba(69, 234, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.restore();
}

function drawEventLabel(ctx: CanvasRenderingContext2D, sim: Simulation, options: RenderOptions): void {
  if (sim.eventLabel.life <= 0) return;
  const alpha = clamp(sim.eventLabel.life / Math.min(sim.eventLabel.maxLife, 0.8), 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = options.cinematic ? "600 19px Inter, system-ui, sans-serif" : "700 23px Inter, system-ui, sans-serif";
  ctx.shadowColor = sim.eventLabel.color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = colorWithAlpha(sim.eventLabel.color, 0.82 * alpha);
  ctx.fillText(sim.eventLabel.text.toUpperCase(), WORLD_WIDTH / 2, options.cinematic ? 96 : GAMEPLAY_BOUNDS.minY - 42);
  ctx.restore();
}

function drawDebug(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  const snapshot = sim.getSnapshot();
  const rows = [
    `seed ${snapshot.seed}`,
    `t ${snapshot.time.toFixed(1)} virus ${snapshot.viruses}`,
    `energy ${snapshot.coreEnergy.toFixed(0)} shock ${(snapshot.shockCharge * 100).toFixed(0)}%`,
    `infection ${(snapshot.infection * 100).toFixed(1)}% particles ${sim.particles.length}`,
    `nodes ${sim.nodes.length} lines ${sim.lines.length} beams ${sim.beams.length}`,
  ];
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(22, WORLD_HEIGHT - 154, 318, 118);
  ctx.font = "16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(205, 245, 255, 0.82)";
  rows.forEach((row, index) => {
    ctx.fillText(row, 36, WORLD_HEIGHT - 142 + index * 21);
  });
  ctx.restore();
}

function strokePolyline(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function glowCircle(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, color: string, alpha: number, blur: number): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = colorWithAlpha(color, alpha);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, Math.max(0.1, radius), 0, TAU);
  ctx.fill();
  ctx.restore();
}

function colorWithAlpha(color: string, alpha: number): string {
  const clamped = clamp(alpha, 0, 1);
  if (!color.startsWith("#") || color.length !== 7) return color;
  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
