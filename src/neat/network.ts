import type { Genome } from './genome';

/**
 * Feed-forward network for a genome. The constructor computes the evaluation
 * order once and flattens it into typed arrays. Hidden and output nodes use tanh.
 */
export class Network {
  private readonly nIn: number;
  private readonly nOut: number;
  /** Node id per value slot: inputs, bias, then hidden and output nodes in evaluation order. */
  private readonly ids: number[];
  /** Node values from the last activate() call, by slot. */
  private readonly values: Float64Array;
  /** Incoming connections of slot nIn+1+k are connFrom/connWeight[connStart[k]..connStart[k+1]). */
  private readonly connStart: Int32Array;
  private readonly connFrom: Int32Array;
  private readonly connWeight: Float64Array;
  /** Value slot of each output node. */
  private readonly outSlot: Int32Array;

  constructor(g: Genome) {
    this.nIn = g.nodes.filter(n => n.kind === 'input').length;
    this.nOut = g.nodes.filter(n => n.kind === 'output').length;

    const incoming = new Map<number, { from: number; weight: number }[]>();
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

    // Input and bias ids equal their slots; the rest follow in evaluation order.
    this.ids = Array.from({ length: this.nIn + 1 }, (_, i) => i);
    for (const id of queue) if (id > this.nIn) this.ids.push(id);
    const slot = new Map(this.ids.map((id, s) => [id, s]));

    const evaluated = this.ids.slice(this.nIn + 1);
    this.connStart = new Int32Array(evaluated.length + 1);
    const from: number[] = [];
    const weight: number[] = [];
    evaluated.forEach((id, k) => {
      for (const c of incoming.get(id)!) {
        from.push(slot.get(c.from)!);
        weight.push(c.weight);
      }
      this.connStart[k + 1] = from.length;
    });
    this.connFrom = Int32Array.from(from);
    this.connWeight = Float64Array.from(weight);
    this.values = new Float64Array(this.ids.length);
    this.outSlot = Int32Array.from({ length: this.nOut }, (_, o) => slot.get(this.nIn + 1 + o)!);
  }

  /** Node values from the last activate() call, by node id. */
  get activations(): Map<number, number> {
    return new Map(this.ids.map((id, s) => [id, this.values[s]!]));
  }

  activate(inputs: Float32Array): Float32Array {
    const v = this.values;
    const nIn = this.nIn;
    for (let i = 0; i < nIn; i++) v[i] = inputs[i]!;
    v[nIn] = 1;

    const start = this.connStart, from = this.connFrom, weight = this.connWeight;
    for (let k = 0; k + 1 < start.length; k++) {
      let sum = 0;
      for (let j = start[k]!; j < start[k + 1]!; j++) sum += weight[j]! * v[from[j]!]!;
      v[nIn + 1 + k] = Math.tanh(sum);
    }

    const out = new Float32Array(this.nOut);
    for (let o = 0; o < this.nOut; o++) out[o] = v[this.outSlot[o]!]!;
    return out;
  }
}
