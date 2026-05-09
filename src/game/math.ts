import type { Vec2 } from "./types";

export const TAU = Math.PI * 2;

export function vec(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(v: Vec2, n: number): Vec2 {
  return { x: v.x * n, y: v.y * n };
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

export function fromAngle(angle: number, radius = 1): Vec2 {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

export function pointOnSegment(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function distToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const denom = ab.x * ab.x + ab.y * ab.y;
  if (denom <= 0.0001) return distance(point, a);
  const t = clamp(((point.x - a.x) * ab.x + (point.y - a.y) * ab.y) / denom, 0, 1);
  return distance(point, pointOnSegment(a, b, t));
}

export function pointAlongPolyline(points: Vec2[], t: number): Vec2 {
  if (points.length === 0) return vec();
  if (points.length === 1) return points[0];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const segmentLength = distance(points[i], points[i + 1]);
    lengths.push(segmentLength);
    total += segmentLength;
  }

  let remaining = clamp(t, 0, 1) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i]) {
      return pointOnSegment(points[i], points[i + 1], remaining / Math.max(lengths[i], 0.0001));
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1];
}
