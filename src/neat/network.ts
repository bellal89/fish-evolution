import type { ConnGene, Genome } from './genome';

/**
 * Feed-forward network built from a genome. Evaluation order is computed
 * once (Kahn's topological sort over enabled connections). Hidden and output
 * nodes use tanh, so a node with no enabled incoming connections outputs 0.
 * Nodes caught in a cycle are never evaluated and stay 0.
 */
export class Network {
  /** Last value of every node, keyed by node id. */
  readonly activations = new Map<number, number>();

  private readonly inputIds: number[];
  private readonly biasIds: number[];
  private readonly outputIds: number[];
  /** Non-input nodes in evaluation order, with their enabled incoming connections. */
  private readonly order: { id: number; incoming: ConnGene[] }[] = [];

  constructor(g: Genome) {
    const byId = (a: number, b: number) => a - b;
    this.inputIds = g.nodes.filter(n => n.kind === 'input').map(n => n.id).sort(byId);
    this.biasIds = g.nodes.filter(n => n.kind === 'bias').map(n => n.id);
    this.outputIds = g.nodes.filter(n => n.kind === 'output').map(n => n.id).sort(byId);

    const incoming = new Map<number, ConnGene[]>();
    const outgoing = new Map<number, number[]>();
    const indegree = new Map<number, number>();
    for (const n of g.nodes) {
      incoming.set(n.id, []);
      outgoing.set(n.id, []);
      indegree.set(n.id, 0);
    }
    for (const c of g.conns) {
      if (!c.enabled || !incoming.has(c.from) || !incoming.has(c.to)) continue;
      incoming.get(c.to)!.push(c);
      outgoing.get(c.from)!.push(c.to);
      indegree.set(c.to, indegree.get(c.to)! + 1);
    }

    const queue = g.nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id);
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      for (const to of outgoing.get(id)!) {
        const d = indegree.get(to)! - 1;
        indegree.set(to, d);
        if (d === 0) queue.push(to);
      }
    }

    const sources = new Set([...this.inputIds, ...this.biasIds]);
    for (const id of queue) {
      if (!sources.has(id)) this.order.push({ id, incoming: incoming.get(id)! });
    }
    for (const n of g.nodes) this.activations.set(n.id, 0);
  }

  activate(inputs: Float32Array): Float32Array {
    const act = this.activations;
    for (let i = 0; i < this.inputIds.length; i++) act.set(this.inputIds[i], inputs[i] ?? 0);
    for (const id of this.biasIds) act.set(id, 1);

    for (const { id, incoming } of this.order) {
      let sum = 0;
      for (const c of incoming) sum += c.weight * act.get(c.from)!;
      act.set(id, Math.tanh(sum));
    }

    const out = new Float32Array(this.outputIds.length);
    for (let o = 0; o < out.length; o++) out[o] = act.get(this.outputIds[o])!;
    return out;
  }
}
