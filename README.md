# Fish evolution

A 2D aquarium in the browser where fish evolve on their own. Each fish has a NEAT neural network for a brain and genes for body (size, speed, vision, lifespan, mating threshold) and color (hue, brightness, pattern, separate for males and females). There is no fitness function and no generations: fish eat algae, plankton and eggs, mate with partners whose color they like, and get eaten by a scripted predator that spots bright, contrasting fish more easily. Nutrients go round a closed cycle (fish, waste, fertilizer, algae and plankton, back to fish), so the tank holds only as many fish as the nutrients allow. Whatever survives and breeds is what you see.

## Run locally

```sh
npm ci
npm run dev      # open the printed URL
npm test
npm run build    # static site in dist/
```

Headless run, without the UI (prints stats every 18 000 ticks, then a summary):

```sh
npx tsx scripts/headless.ts [seed] [ticks]
```

## What the panels show

- **Population**: all fish, males and females.
- **Eggs**: eggs waiting to hatch.
- **Avg lifespan**: age at death of the fish that died recently.
- **Offspring per fish**: average children of living fish.
- **Size**, **Speed**: average body genes.
- **Hidden neurons**, **Connections**: brain size, the population average and the leader (the ancestor with the most living descendants).
- **Escapes**: share of predator chases that ended without a kill.
- **Food per fish**: food eaten per fish between samples.
- **Matings per fish**: matings per fish between samples.
- **Male hue**, **Female hue**, **Top pattern**: the average expressed hue over time and the most common pattern now, per sex.
- **Inspector** (click a fish): sex, age, energy, children, both color variants, body and mating genes, and its brain with live activations. The leader tab shows the leader's brain.
