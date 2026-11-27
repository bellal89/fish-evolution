import { expect, test } from 'vitest';
import { randomBrain } from '../../src/sim/arena';
import type { World } from '../../src/sim/world';
import { Arena, type ArenaPick } from '../../src/worker/arena';

const leaderPick: ArenaPick = { choice: { kind: 'leader' }, brain: randomBrain(77, 0) };
const randomPick: ArenaPick = { choice: { kind: 'random' }, brain: null };
const fishAt = (w: World) => w.fish.map(f => [f.x, f.y, f.heading]);
const kill = (w: World) => { for (const f of w.fish) f.age = f.traits.lifespanTicks; };

test('Random sides use randomBrain of the seed; a picked brain is used as given', () => {
  const a = new Arena(3, [randomPick, leaderPick]);
  expect(a.worlds[0].fish[0].genome).toEqual(randomBrain(3, 0).genome);
  expect(a.worlds[1].fish[0].genome).toBe(leaderPick.brain!.genome);
});

test('Same start again repeats the start; New start changes it and the random brains', () => {
  const a = new Arena(3, [randomPick, leaderPick]);
  const start = fishAt(a.worlds[0]);
  const genome = a.worlds[0].fish[0].genome;
  for (let i = 0; i < 200; i++) a.step();
  expect(fishAt(a.worlds[0])).not.toEqual(start);
  a.restart();
  expect(a.worlds[0].tick).toBe(0);
  expect(fishAt(a.worlds[0])).toEqual(start);
  expect(a.worlds[0].fish[0].genome).toEqual(genome);
  a.restart(4);
  expect(fishAt(a.worlds[0])).not.toEqual(start);
  expect(a.worlds[0].fish[0].genome).toEqual(randomBrain(4, 0).genome);
});

test('picking a brain restarts both halves with the current seed', () => {
  const a = new Arena(3, [randomPick, randomPick]);
  const start = fishAt(a.worlds[1]);
  for (let i = 0; i < 100; i++) a.step();
  a.setPick(0, leaderPick);
  expect(a.worlds.map(w => w.tick)).toEqual([0, 0]);
  expect(fishAt(a.worlds[0])).toEqual(start);
  expect(fishAt(a.worlds[1])).toEqual(start);
  expect(a.worlds[0].fish[0].genome).toBe(leaderPick.brain!.genome);
});

test('a dead side stops while the other side runs', () => {
  const a = new Arena(3, [randomPick, leaderPick]);
  kill(a.worlds[0]);
  a.step();
  expect(a.worlds[0].extinct).toBe(true);
  const t = a.worlds[0].tick;
  a.step();
  a.step();
  expect(a.worlds[0].tick).toBe(t);
  expect(a.worlds[1].tick).toBe(3);
  expect(a.done).toBe(false);
  kill(a.worlds[1]);
  a.step();
  expect(a.done).toBe(true);
});

test('the view shows the first living fish, or the selected one', () => {
  const a = new Arena(3, [randomPick, leaderPick]);
  const fish = a.worlds[0].fish;
  expect(a.view().sides[0].scene.selected!.id).toBe(fish[0].id);
  a.select(0, fish[3].id);
  expect(a.view().sides[0].scene.selected!.id).toBe(fish[3].id);
  expect(a.view().sides[1].scene.selected!.id).toBe(a.worlds[1].fish[0].id);
  fish[3].age = fish[3].traits.lifespanTicks;
  a.step();
  expect(a.view().sides[0].scene.selected!.id).toBe(a.worlds[0].fish[0].id);
  const genome = a.worlds[0].fish[0].genome;
  kill(a.worlds[0]);
  a.step();
  const side = a.view().sides[0];
  expect(side.scene.selected).toBeNull();
  expect(side.genome).toBe(genome);
});

test('the view carries the speed, the choices and the food eaten', () => {
  const a = new Arena(3, [randomPick, leaderPick]);
  a.speed = 10;
  a.worlds[1].events.foodEaten = 7;
  const v = a.view();
  expect(v.speed).toBe(10);
  expect(v.choices).toEqual([{ kind: 'random' }, { kind: 'leader' }]);
  expect(v.sides[1].foodEaten).toBe(7);
});
