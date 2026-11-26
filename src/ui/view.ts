export interface View {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fit a tank of tankW×tankH into a canvas, keeping aspect ratio and centering. */
export function fitView(canvasW: number, canvasH: number, tankW: number, tankH: number): View {
  const scale = Math.min(canvasW / tankW, canvasH / tankH);
  return {
    scale,
    offsetX: (canvasW - tankW * scale) / 2,
    offsetY: (canvasH - tankH * scale) / 2,
  };
}

export function screenToWorld(v: View, px: number, py: number): { x: number; y: number } {
  return { x: (px - v.offsetX) / v.scale, y: (py - v.offsetY) / v.scale };
}
