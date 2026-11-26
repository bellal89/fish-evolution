import type { NodeGene } from '../../src/neat/genome';

/** Fresh smallest node set: input 0, bias 1, output 2. */
export const io = (): NodeGene[] => [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }];
