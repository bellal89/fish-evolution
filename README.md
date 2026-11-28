# Fish evolution

**Live demo:** https://bellal89.github.io/fish-evolution/

A 2D aquarium in the browser where fish evolve on their own. Each fish has a NEAT neural network for a brain and genes for body (size, speed, vision, lifespan, mating threshold) and color (hue, brightness, pattern, separate for males and females). There is no fitness function and no generations: fish eat algae, plankton and eggs, mate with partners whose color they like (females also like large males), and get eaten by a scripted predator that spots fish more easily when they contrast with the background. Nutrients go round a closed cycle (fish, waste, fertilizer, algae and plankton, back to fish), so the tank holds only as many fish as the nutrients allow. A spot of light sweeps the tank from wall to wall every two sim minutes, and plankton grows mostly under it and dies off in the dark. A large fish spends more energy, but it can store much more (the store grows with the square of its size), so it lasts longer without food. A full fish does not eat. Fish smell waste and dead bodies. A fish that touches waste ages faster. A dead body has three times that effect. A fish that dies of hunger or old age sinks as a gray body, lies on the sand and dissolves into fertilizer. Sometimes the population dies out; press **⟲ Restart** then. Whatever survives and breeds is what you see.

The simulation runs in your browser. Each visitor has a separate world. The browser saves the world every 30 seconds (IndexedDB), and the next visit continues it. **⟲ Restart** starts a new world.

## Run locally

```sh
npm ci
npm run dev      # open the printed URL
npm test
npm run build    # static site in dist/
```

Headless run, without the UI (seed defaults to 1, ticks to 500 000; prints stats every 18 000 ticks, then a summary):

```sh
npx tsx scripts/headless.ts [seed] [ticks]
```

## What the panels show

- **Population**: all fish, males and females.
- **Eggs**: eggs waiting to hatch.
- **Avg lifespan**: average age of the fish that died between samples.
- **Offspring per fish**: average children of living fish.
- **Size**, **Speed**: average body genes.
- **Hidden neurons**, **Connections**: average brain size.
- **Escapes**: share of predator chases that ended without a kill.
- **Food per fish**: food eaten per fish between samples.
- **Matings per fish**: matings per fish between samples.
- **Most common male hue**, **Most common female hue**, **Top pattern**: the most common expressed hue (in 15° steps) over time and the most common pattern now, per sex.
- **Stats** tab: the brain of the leader (the ancestor with the most living descendants) with its living descendants, hidden neurons and links, then the charts.
- **Fish** tab (click a fish; it opens by itself): sex, age, energy, children, how much waste aged it, both color variants, body and mating genes, and its brain with live activations. Click the empty water or press Esc to close it.

## Brain arena

Press **Arena** to compare two brains side by side. The arena shows two copies of the tank with the same start: the same food, rocks, fish positions and predators. Each side has 5 fish that share one brain and 1 predator; change these numbers on the arena bar. All arena fish have the same standard body (each body gene at the middle of its range), so only the brain is different. The fish show the colors of the brain's owner. There is no mating in the arena.

Choose the brain of each side in its list:

- **Random**: a new brain, as in the first generation, with random colors.
- **Leader**: the current leader.
- **Selected fish**: the fish you selected in the aquarium.
- **Leader history**: the world stores the leader every 5 sim minutes. Each row shows the leader's colors, the time, its living descendants then and the size of its brain.

Under each side you see the fish alive, the food they ate, the time since the start, and the live brain of one fish. Click a fish to see its brain. **Same start again** runs both sides again from the same start. **New start** makes a new start and new random brains. The arena has its own speed (⏸, x1, x10). The main world pauses while the arena is open and continues after **← Back**.

## Export and Import

**Export** downloads the main world as `fish-evolution-<time>.json.gz`: the world, its charts and the leader history. **Import** replaces the current world with the world from such a file, after a confirmation. A file from another version of the app does not open, and the current world does not change.

Print a summary of an exported world (population, genes, most common hues, top lineages, leader history):

```sh
npx tsx scripts/inspect.ts <file>
```

To continue an exported world in your own script, use `loadSave(path)` from `scripts/saveTools.ts`. It returns the save and a `World` that you can step.
