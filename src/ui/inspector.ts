import type { Snapshot } from '../protocol';
import { CONFIG } from '../sim/config';
import { INPUT_LABELS } from '../sim/senses';
import type { StatPoint } from '../sim/stats';
import { expressedColor } from '../sim/traits';
import { drawBrain } from './brainView';
import { drawFishIcon, sparkline } from './charts';

function brainCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 420;
  c.height = 340;
  c.className = 'brain';
  return c;
}

export interface Inspector {
  update(snap: Snapshot): void;
  /** Tell the inspector which fish the UI asked for (null = none). Clears "Fish died". */
  setWanted(id: number | null): void;
  /** Stats history for the leader tab's sparkline; call only when it changed. */
  setHistory(history: StatPoint[]): void;
}

export function mountInspector(root: HTMLElement): Inspector {
  root.innerHTML = `
    <div class="tabs"><button data-tab="fish" class="active">Fish</button><button data-tab="leader">Leader brain</button></div>
    <div id="tab-fish">
      <div id="fish-msg" class="msg">Click a fish to inspect it</div>
      <div id="fish-body" hidden>
        <div id="fish-info"></div>
        <div class="bar"><div id="energy-fill"></div></div>
        <div class="swatches"></div>
        <div id="fish-genes"></div>
      </div>
    </div>
    <div id="tab-leader" hidden>
      <div id="leader-info" class="msg">No leader yet</div>
      <div class="chart-head"><span>Brain size: avg vs leader</span></div>
    </div>`;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const fishTab = root.querySelector<HTMLElement>('#tab-fish')!;
  const leaderTab = root.querySelector<HTMLElement>('#tab-leader')!;
  const msg = root.querySelector<HTMLElement>('#fish-msg')!;
  const body = root.querySelector<HTMLElement>('#fish-body')!;
  const info = root.querySelector<HTMLElement>('#fish-info')!;
  const fill = root.querySelector<HTMLElement>('#energy-fill')!;
  const swatches = root.querySelector<HTMLElement>('.swatches')!;
  const genes = root.querySelector<HTMLElement>('#fish-genes')!;
  const leaderInfo = root.querySelector<HTMLElement>('#leader-info')!;

  const fishBrain = brainCanvas();
  body.append(fishBrain);
  const leaderBrain = brainCanvas();
  const sizeSpark = document.createElement('canvas');
  sizeSpark.width = 220;
  sizeSpark.height = 36;
  leaderTab.append(sizeSpark, leaderBrain);

  const swatchCanvases = [0, 1].map(() => {
    const c = document.createElement('canvas');
    c.width = 56;
    c.height = 28;
    const label = document.createElement('div');
    const cell = document.createElement('div');
    cell.append(c, label);
    swatches.append(cell);
    return { c, label, cell };
  });

  let tab: 'fish' | 'leader' = 'fish';
  tabs.forEach(b => {
    b.onclick = () => {
      tab = b.dataset.tab as 'fish' | 'leader';
      tabs.forEach(t => t.classList.toggle('active', t === b));
      fishTab.hidden = tab !== 'fish';
      leaderTab.hidden = tab !== 'leader';
    };
  });

  let wanted: number | null = null;
  let gotFish = false;
  let died = false;
  let history: StatPoint[] = [];

  function drawSizeSpark(): void {
    sparkline(sizeSpark, [
      { values: history.map(p => p.avgHidden + p.avgConns), color: '#9ad' },
      { values: history.map(p => p.leaderHidden + p.leaderConns), color: '#fc6' },
    ]);
  }

  return {
    setWanted(id) {
      wanted = id;
      gotFish = false;
      died = false;
    },
    setHistory(h) {
      history = h;
      drawSizeSpark();
    },
    update(snap) {
      const sel = snap.selected?.fish;
      if (sel && sel.id === wanted) gotFish = true;
      if (!sel && gotFish) { died = true; gotFish = false; }
      const show = !!sel && sel.id === wanted;

      body.hidden = !show;
      msg.hidden = show;
      msg.textContent = died ? 'Fish died' : 'Click a fish to inspect it';

      if (show && sel && tab === 'fish') {
        const t = sel.traits;
        info.textContent =
          `${sel.sex === 'M' ? '♂ male' : '♀ female'} · age ${Math.round(sel.age / CONFIG.TICKS_PER_SEC)}s · ` +
          `energy ${sel.energy.toFixed(0)} · children ${sel.children}`;
        fill.style.width = `${Math.min(100, (sel.energy / (t.mateThreshold * 1.5)) * 100)}%`;
        const shown = expressedColor(t, sel.sex);
        [t.colorM, t.colorF].forEach((c, i) => {
          const s = swatchCanvases[i];
          drawFishIcon(s.c, c);
          s.label.textContent = `${i === 0 ? '♂' : '♀'} ${c.pattern}`;
          s.cell.classList.toggle('expressed', c === shown);
        });
        genes.textContent =
          `size ${t.size.toFixed(1)} · speed ${t.maxSpeed.toFixed(1)} · view ${Math.round((t.viewAngle * 180) / Math.PI)}° / ${Math.round(t.viewRange)} · ` +
          `mate at ${t.mateThreshold.toFixed(0)} · invest ${Math.round(t.investFraction * 100)}% · ` +
          `lifespan ${Math.round(t.lifespanTicks / CONFIG.TICKS_PER_SEC)}s · ` +
          `prefers hue ${Math.round(t.prefHue * 360)}° ${t.prefPattern} · choosiness ${t.choosiness.toFixed(2)}`;
        drawBrain(fishBrain.getContext('2d')!, sel.genome, new Map(sel.activations), INPUT_LABELS);
      }

      if (tab === 'leader') {
        if (snap.leader) {
          leaderInfo.textContent = `Living descendants: ${snap.leader.living}`;
          drawBrain(leaderBrain.getContext('2d')!, snap.leader.genome, undefined, INPUT_LABELS);
        } else {
          leaderInfo.textContent = 'No leader yet';
        }
      }
    },
  };
}
