import type { ArenaSnapshot, BrainChoice, LeaderRow, Side, ToWorker } from '../protocol';
import { makeCanvas } from './charts';
import { simTime } from './controls';
import { drawFishIcon } from './render';

function label(c: BrainChoice, history: LeaderRow[]): string {
  switch (c.kind) {
    case 'random': return 'Random';
    case 'leader': return 'Leader';
    case 'selected': return 'Selected fish';
    case 'history': return `Leader at ${simTime(history[c.index].tick)}`;
  }
}

/** A button with the brain of one arena side and a list to choose another. */
export function mountBrainPicker(root: HTMLElement, side: Side, send: (m: ToWorker) => void): { update(a: ArenaSnapshot): void } {
  root.className = 'picker';
  root.innerHTML = '<button class="pick-btn" title="Choose the brain of this side"></button><div class="pick-list" hidden></div>';
  const btn = root.querySelector<HTMLButtonElement>('.pick-btn')!;
  const list = root.querySelector<HTMLElement>('.pick-list')!;
  btn.onclick = () => (list.hidden = !list.hidden);
  document.addEventListener('click', e => {
    if (!root.contains(e.target as Node)) list.hidden = true;
  });

  function row(choice: BrainChoice, disabled: boolean, ...content: (Node | string)[]): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'pick-row';
    b.disabled = disabled;
    b.append(...content);
    b.onclick = () => {
      list.hidden = true;
      send({ type: 'arenaBrain', side, choice });
    };
    return b;
  }

  function historyRow(r: LeaderRow, index: number): HTMLButtonElement {
    const icons = [r.colorM, r.colorF].map(c => {
      const icon = makeCanvas(28, 14);
      drawFishIcon(icon, c);
      return icon;
    });
    const text = `${simTime(r.tick)} · ${r.living} descendants · ${r.hidden} hidden · ${r.conns} links`;
    return row({ kind: 'history', index }, false, ...icons, text);
  }

  let rowsKey = '';
  return {
    update(a) {
      btn.textContent = `${label(a.choices[side], a.history)} ▾`;
      const key = `${a.history.length} ${a.hasLeader} ${a.hasSelected}`;
      if (key === rowsKey) return;
      rowsKey = key;
      list.replaceChildren(
        row({ kind: 'random' }, false, 'Random'),
        row({ kind: 'leader' }, !a.hasLeader, 'Leader'),
        row({ kind: 'selected' }, !a.hasSelected, 'Selected fish'),
        ...a.history.map(historyRow).reverse(),
      );
    },
  };
}
