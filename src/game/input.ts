import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import type { Vec2 } from "./types";

export function canvasPointerToWorld(canvas: HTMLCanvasElement, clientX: number, clientY: number): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * WORLD_WIDTH,
    y: ((clientY - rect.top) / rect.height) * WORLD_HEIGHT,
  };
}
