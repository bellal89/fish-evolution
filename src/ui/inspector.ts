import type { Snapshot } from '../protocol';
import { genomeSize } from '../neat/genome';
import { maxEnergy } from '../sim/fish';
import { expressedColor } from '../sim/traits';
import { drawBrain } from './brainView';
import { makeCanvas, secs } from './charts';
import { drawFishIcon } from './render';

interface Inspector {
  update(snap: Snapshot): void;
  /** Tell the inspector which fish the UI asked for (null = none). A fish opens the Fish tab; none removes it. */
  setWanted(id: number | null): void;
}

function legend(nodes: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'legend';
  el.innerHTML =
    'Links: <span style="color:#5ac878">━</span> excites · <span style="color:#e65a5a">━</span> inhibits · thicker = stronger' +
    `<br>Nodes: ${nodes}`;
  return el;
}

export function mountInspector(root: HTMLElement): Inspector {
  root.innerHTML = `
    <div class="tabs"><button data-tab="stats" class="active">Stats</button><button data-tab="fish" hidden>Fish</button></div>
    <div id="tab-stats">
      <div class="section">Leader brain</div>
      <div id="leader-info" class="msg">No leader yet</div>
      <div id="charts"></div>
    </div>
    <div id="tab-fish" hidden>
      <div id="fish-msg" class="msg"></div>
      <div id="fish-body" hidden>
        <div id="fish-info"></div>
        <div id="fish-waste"></div>
        <div class="bar"><div id="energy-fill"></div></div>
        <div class="swatches"></div>
        <div id="fish-genes"></div>
      </div>
    </div>
`;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const fishButton = tabs[1];
  const fishTab = root.querySelector<HTMLElement>('#tab-fish')!;
  const statsTab = root.querySelector<HTMLElement>('#tab-stats')!;
  const msg = root.querySelector<HTMLElement>('#fish-msg')!;
  const body = root.querySelector<HTMLElement>('#fish-body')!;
  const info = root.querySelector<HTMLElement>('#fish-info')!;
  const wasteInfo = root.querySelector<HTMLElement>('#fish-waste')!;
  const fill = root.querySelector<HTMLElement>('#energy-fill')!;
  const swatches = root.querySelector<HTMLElement>('.swatches')!;
  const genes = root.querySelector<HTMLElement>('#fish-genes')!;
  const leaderInfo = root.querySelector<HTMLElement>('#leader-info')!;

  const fishBrain = makeCanvas(420, 340);
  fishBrain.className = 'brain';
  body.append(fishBrain, legend(
    '<span style="color:#ffdc5a">●</span> positive · <span style="color:#5aaaff">●</span> negative · brighter = stronger',
  ));
  const leaderBrain = makeCanvas(420, 340);
  leaderBrain.className = 'brain';
  leaderInfo.after(leaderBrain, legend('no live values, the leader may be dead'));

  const swatchCanvases = [0, 1].map(() => {
    const c = makeCanvas(56, 28);
    const label = document.createElement('div');
    const cell = document.createElement('div');
    cell.append(c, label);
    swatches.append(cell);
    return { c, label, cell };
  });

  function open(b: HTMLButtonElement): void {
    tabs.forEach(t => t.classList.toggle('active', t === b));
    fishTab.hidden = b !== fishButton;
    statsTab.hidden = b === fishButton;
  }
  tabs.forEach(b => (b.onclick = () => open(b)));

  let wanted: number | null = null;
  /** The wanted fish has appeared in a snapshot, so its absence means it died. */
  let seen = false;

  return {
    setWanted(id) {
      wanted = id;
      seen = false;
      fishButton.hidden = id === null;
      open(tabs[id === null ? 0 : 1]);
    },
    update(snap) {
      const sel = snap.selected;
      const show = !!sel && sel.id === wanted;
      if (show) seen = true;

      body.hidden = !show;
      msg.hidden = show;
      msg.textContent = seen ? 'Fish died' : '';

      if (show && sel && !fishTab.hidden) {
        const t = sel.traits;
        info.textContent =
          `${sel.sex === 'M' ? '♂ male' : '♀ female'} · age ${secs(sel.age)} · ` +
          `energy ${sel.energy.toFixed(0)} · children ${sel.children}`;
        wasteInfo.textContent = `aged by waste: ${secs(sel.wasteAge)}`;
        fill.style.width = `${Math.min(100, (sel.energy / maxEnergy(t)) * 100)}%`;
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
          `lifespan ${secs(t.lifespanTicks)} · ` +
          `prefers hue ${Math.round(t.prefHue * 360)}° ${t.prefPattern} · choosiness ${t.choosiness.toFixed(2)}`;
        drawBrain(fishBrain.getContext('2d')!, sel.genome, sel.activations);
      }

      if (!statsTab.hidden) {
        if (snap.leader) {
          const { hidden, enabledConns } = genomeSize(snap.leader.genome);
          leaderInfo.textContent = `${snap.leader.living} descendants · ${hidden} hidden · ${enabledConns} links`;
          drawBrain(leaderBrain.getContext('2d')!, snap.leader.genome);
        } else {
          leaderInfo.textContent = 'No leader yet';
        }
      }
    },
  };
}
