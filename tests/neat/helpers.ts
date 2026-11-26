import type { Genome } from '../../src/neat/genome';

/** True if the connection graph (enabled or not) has a directed cycle. */
export function hasCycle(g: Genome): boolean {
  const out = new Map<number, number[]>();
  for (const c of g.conns) out.set(c.from, [...(out.get(c.from) ?? []), c.to]);
  const state = new Map<number, 1 | 2>(); // 1 = on stack, 2 = done
  const visit = (id: number): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const to of out.get(id) ?? []) if (visit(to)) return true;
    state.set(id, 2);
    return false;
  };
  return g.nodes.some(n => visit(n.id));
}
