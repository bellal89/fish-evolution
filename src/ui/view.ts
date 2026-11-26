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
