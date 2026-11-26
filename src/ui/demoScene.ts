// A hand-made static scene for previewing the visuals before the simulation exists.
import { CONFIG } from '../sim/config';
import { Rng } from '../sim/rng';
import { PATTERNS, type ColorGenes } from '../sim/traits';
import type { FishView, Rock, SceneView } from '../protocol';

export function makeDemoScene(seed: number): SceneView {
  const rng = new Rng(seed);
  const W = CONFIG.TANK_W, H = CONFIG.TANK_H;
  const ground = H - CONFIG.SAND_H;

  const rocks: Rock[] = [];
  for (let i = 0; i < 4; i++) {
    rocks.push({ x: rng.range(150, W - 150), y: ground + 8, rx: rng.range(60, 130), ry: rng.range(40, 90) });
  }

  const algae: SceneView['food']['algae'] = [];
  for (let i = 0; i < 60; i++) {
    algae.push({ x: rng.range(10, W - 10), y: ground + 4 + rng.range(-3, 3), biomass: rng.next() });
  }
  for (const r of rocks) {
    for (let i = 0; i < 6; i++) {
      const a = rng.range(Math.PI * 1.15, Math.PI * 1.85);
      algae.push({ x: r.x + Math.cos(a) * r.rx * 0.9, y: r.y + Math.sin(a) * r.ry * 0.9, biomass: rng.next() });
    }
  }

  const plankton = Array.from({ length: 160 }, () => ({ x: rng.range(0, W), y: rng.range(20, ground - 20) }));
  const waste = Array.from({ length: 30 }, () => ({ x: rng.range(0, W), y: rng.range(100, ground), amount: rng.next() }));
  const eggs: { x: number; y: number }[] = [];
  for (let c = 0; c < 3; c++) {
    const cx = rng.range(100, W - 100);
    for (let i = 0; i < 5; i++) eggs.push({ x: cx + rng.range(-10, 10), y: ground - rng.range(0, 6) });
  }

  // A few "families" of colors so the scene looks like a population, not noise.
  const families = Array.from({ length: 5 }, () => randomColor(rng));
  const fish: FishView[] = [];
  for (let i = 0; i < 45; i++) {
    const fam = families[i % families.length];
    const sex = rng.chance(0.5) ? 'M' : 'F';
    const color: ColorGenes = {
      ...fam,
      hue: (fam.hue + rng.range(-0.03, 0.03) + 1) % 1,
      // Females in the demo are duller to preview the guppy-like contrast.
      brightness: sex === 'M' ? Math.min(1, fam.brightness + 0.2) : fam.brightness * 0.45,
      pattern: sex === 'M' ? fam.pattern : rng.chance(0.7) ? 'solid' : fam.pattern,
    };
    fish.push({
      id: i + 1,
      x: rng.range(60, W - 60),
      y: rng.range(60, ground - 40),
      heading: rng.range(-Math.PI, Math.PI) * 0.35 + (rng.chance(0.5) ? 0 : Math.PI),
      size: rng.range(7, 13),
      sex,
      color,
    });
  }

  return {
    tankW: W,
    tankH: H,
    rocks,
    fish,
    predators: [
      { x: W * 0.7, y: H * 0.45, heading: Math.PI * 0.95, size: 34, state: 'chase' },
    ],
    food: { algae, plankton, waste, eggs },
  };
}

function randomColor(rng: Rng): ColorGenes {
  return {
    hue: rng.next(),
    brightness: rng.range(0.4, 0.8),
    pattern: rng.pick(PATTERNS),
    patternCount: 1 + rng.int(6),
    hue2: rng.next(),
  };
}
