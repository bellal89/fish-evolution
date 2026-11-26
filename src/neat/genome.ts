import type { Rng } from '../sim/rng';

export type NodeKind = 'input' | 'bias' | 'hidden' | 'output';

export interface NodeGene {
  id: number;
  kind: NodeKind;
}

export interface ConnGene {
  innov: number;
  from: number;
  to: number;
  weight: number;
  enabled: boolean;
}

/** Node ids: inputs 0..nIn-1, bias nIn, outputs nIn+1..nIn+nOut, hidden from the tracker. */
export interface Genome {
  nodes: NodeGene[];
  conns: ConnGene[];
}

/**
 * Run-wide registry of structural innovations: the same connection or
 * the same split anywhere in the run gets the same number.
 */
export class InnovationTracker {
  private nextInnov = 0;
  private nextNodeId: number;
  private readonly conns = new Map<string, number>();
  private readonly splits = new Map<number, number>();

  constructor(firstNodeId: number) {
    this.nextNodeId = firstNodeId;
  }

  connInnov(from: number, to: number): number {
    const key = `${from}-${to}`;
    let innov = this.conns.get(key);
    if (innov === undefined) {
      innov = this.nextInnov++;
      this.conns.set(key, innov);
    }
    return innov;
  }

  /** Id of the hidden node created by splitting connection `connInnov`. */
  splitNode(connInnov: number): number {
    let id = this.splits.get(connInnov);
    if (id === undefined) {
      id = this.nextNodeId++;
      this.splits.set(connInnov, id);
    }
    return id;
  }
}

export function createMinimalGenome(nIn: number, nOut: number, rng: Rng, tracker: InnovationTracker): Genome {
  const nodes: NodeGene[] = [];
  for (let i = 0; i < nIn; i++) nodes.push({ id: i, kind: 'input' });
  nodes.push({ id: nIn, kind: 'bias' });
  for (let o = 0; o < nOut; o++) nodes.push({ id: nIn + 1 + o, kind: 'output' });

  const conns: ConnGene[] = [];
  for (let from = 0; from <= nIn; from++) {
    for (let o = 0; o < nOut; o++) {
      const to = nIn + 1 + o;
      conns.push({ innov: tracker.connInnov(from, to), from, to, weight: rng.range(-1, 1), enabled: true });
    }
  }
  return { nodes, conns };
}

export function genomeSize(g: Genome): { hidden: number; enabledConns: number } {
  return {
    hidden: g.nodes.filter(n => n.kind === 'hidden').length,
    enabledConns: g.conns.filter(c => c.enabled).length,
  };
}
