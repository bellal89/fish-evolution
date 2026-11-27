import type { Snapshot } from '../protocol';
import { CONFIG } from './config';
import type { Stats } from './stats';
import { expressedColor } from './traits';
import type { World } from './world';

export function makeSnapshot(w: World, stats: Stats, selectedId: number | null, includeStats: boolean): Snapshot {
  const sel = w.fish.find(f => f.id === selectedId);
  const lead = w.lineage.leader();
  return {
    tankW: CONFIG.TANK_W,
    tankH: CONFIG.TANK_H,
    rocks: w.food.rocks,
    fish: w.fish.map(f => ({
      id: f.id, x: f.x, y: f.y, heading: f.heading, size: f.traits.size, sex: f.sex,
      color: expressedColor(f.traits, f.sex),
    })),
    predators: w.predators.map(p => ({ x: p.x, y: p.y, heading: p.heading, size: p.size, state: p.state })),
    food: {
      algae: w.food.algae.map(a => ({ x: a.x, y: a.y, biomass: a.biomass / CONFIG.ALGAE_MAX })),
      plankton: w.food.plankton.map(p => ({ x: p.x, y: p.y })),
      waste: w.food.waste.map(x => ({ x: x.x, y: x.y, amount: x.amount })),
      eggs: w.eggs.map(e => ({ x: e.x, y: e.y })),
    },
    tick: w.tick,
    extinct: w.extinct,
    selected: sel
      ? {
          id: sel.id, sex: sel.sex, age: sel.age, energy: sel.energy, children: sel.children,
          traits: sel.traits,
          genome: sel.genome,
          inputs: Array.from(sel.lastInputs),
          activations: sel.brain.activations,
        }
      : null,
    leader: lead ? { genome: lead.genome, living: lead.living } : null,
    ...(includeStats ? { stats: stats.history } : {}),
  };
}
