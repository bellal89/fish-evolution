import type { ConnGene, Genome } from './genome';

/**
 * Feed-forward network for a genome. The constructor computes the evaluation
 * order once. Hidden and output nodes use tanh.
 */
export class Network {
  /** Node values from the last activate() call, by node id. */
  readonly activations = new Map<number, number>();

  private readonly nIn: number;
  private readonly nOut: number;
  /** Hidden and output nodes in evaluation order, with their enabled incoming connections. */
  private readonly order: { id: number; incoming: ConnGene[] }[] = [];

  constructor(g: Genome) {
    this.nIn = g.nodes.filter(n => n.kind === 'input').length;
    this.nOut = g.nodes.filter(n => n.kind === 'output').length;

    const incoming = new Map<number, ConnGene[]>();
    const outgoing = new Map<number, number[]>();
    const indegree = new Map<number, number>();
    for (const n of g.nodes) {
      incoming.set(n.id, []);
      outgoing.set(n.id, []);
      indegree.set(n.id, 0);
    }
    for (const c of g.conns) {
      if (!c.enabled) continue;
      incoming.get(c.to)!.push(c);
      outgoing.get(c.from)!.push(c.to);
      indegree.set(c.to, indegree.get(c.to)! + 1);
    }

    const queue = g.nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id);
    for (let i = 0; i < queue.length; i++) {
      for (const to of outgoing.get(queue[i])!) {
        const d = indegree.get(to)! - 1;
        indegree.set(to, d);
        if (d === 0) queue.push(to);
      }
    }

    for (const id of queue) {
      if (id > this.nIn) this.order.push({ id, incoming: incoming.get(id)! });
    }
  }

  activate(inputs: Float32Array): Float32Array {
    const act = this.activations;
    for (let i = 0; i < this.nIn; i++) act.set(i, inputs[i]);
    act.set(this.nIn, 1);

    for (const { id, incoming } of this.order) {
      let sum = 0;
      for (const c of incoming) sum += c.weight * act.get(c.from)!;
      act.set(id, Math.tanh(sum));
    }

    const out = new Float32Array(this.nOut);
    for (let o = 0; o < this.nOut; o++) out[o] = act.get(this.nIn + 1 + o)!;
    return out;
  }
}
