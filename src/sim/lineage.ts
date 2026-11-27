import type { Genome } from '../neat/genome';
import { CONFIG } from './config';
import type { Traits } from './traits';

interface LineageRecord {
  id: number;
  genome: Genome;
  traits: Traits;
  parents: [number, number] | null;
  alive: boolean;
  /** Living descendants within LINEAGE_DEPTH generations. */
  living: number;
}

/** The leader at one moment, for the arena to pick later. */
export interface LeaderEntry {
  tick: number;
  living: number;
  genome: Genome;
  traits: Traits;
}

/** Tracks how many living descendants each ancestor has, to find the dominant line. */
export class Lineage {
  private readonly records = new Map<number, LineageRecord>();

  born(id: number, parents: [number, number] | null, genome: Genome, traits: Traits): void {
    this.records.set(id, { id, genome, traits, parents, alive: true, living: 0 });
    for (const a of this.ancestors(id)) a.living += 1;
  }

  died(id: number): void {
    const rec = this.records.get(id)!;
    rec.alive = false;
    const ancestors = this.ancestors(id);
    for (const a of ancestors) a.living -= 1;
    for (const r of [rec, ...ancestors]) {
      if (!r.alive && r.living === 0) this.records.delete(r.id);
    }
  }

  /** Living descendants of `id`; 0 for unknown ids. */
  living(id: number): number {
    return this.records.get(id)?.living ?? 0;
  }

  /** Up to `n` records with living descendants: most living first, ties by lowest id. */
  top(n: number): { id: number; genome: Genome; traits: Traits; living: number }[] {
    return [...this.records.values()]
      .filter(r => r.living > 0)
      .sort((a, b) => b.living - a.living || a.id - b.id)
      .slice(0, n)
      .map(({ id, genome, traits, living }) => ({ id, genome, traits, living }));
  }

  /** Record with the most living descendants (ties: lowest id), or null. */
  leader(): { id: number; genome: Genome; traits: Traits; living: number } | null {
    return this.top(1)[0] ?? null;
  }

  /** Distinct ancestors of `id` up to LINEAGE_DEPTH generations back. */
  private ancestors(id: number): LineageRecord[] {
    const seen = new Set<number>([id]);
    const out: LineageRecord[] = [];
    let frontier = [id];
    for (let gen = 0; gen < CONFIG.LINEAGE_DEPTH && frontier.length > 0; gen++) {
      const next: number[] = [];
      for (const cur of frontier) {
        for (const pid of this.records.get(cur)?.parents ?? []) {
          const p = this.records.get(pid);
          if (!p || seen.has(pid)) continue;
          seen.add(pid);
          out.push(p);
          next.push(pid);
        }
      }
      frontier = next;
    }
    return out;
  }
}
