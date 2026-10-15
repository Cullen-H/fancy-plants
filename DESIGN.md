# Fancy Plants: Design Doc

This is the plan for rebuilding Fancy Plants. The first version was a CodeHS Graphics assignment. This version runs in a web browser and is meant to be shared.

## The pitch

You start with a small patch of dirt and a handful of coins. You plant seeds, wait for them to grow, and sell what you harvest. Weather can change your crops while they grow, and some changes combine into rarer ones that are worth far more. Later on you hire workers who help run the farm while you're away.

## Platform

The game is plain HTML and JavaScript drawn on a canvas. There is no build step, so opening `index.html` runs it. Scripts load as normal `<script>` tags, not modules, because modules don't load from a double-clicked file.

The farm is drawn on a canvas, and the menus are regular HTML laid over it, because scrolling lists were the hardest part of the CodeHS version. Everything works at a fixed size of 1280 by 720 and scales to fit the window. Saves go to localStorage with a version number so old saves can be upgraded when the format changes.

## Art direction

The style is clean cartoon, drawn entirely in code. Shapes are smooth, colors are bold, and everything gets a soft shadow and a darker outline. Every plant has four growth stages (sprout, young, budding, ripe) so you can tell how close it is to harvest without reading a bar.

Movement should make the farm feel alive. Plants sway a little, ripe plants bounce, harvesting pops the crop into the air, and coins count up when you sell.

## Core loop

1. Buy seeds from the shop. Its stock rotates every few minutes.
2. Plant them on empty plots.
3. Wait. Weather may add modifiers while they grow.
4. Harvest when ripe. Single harvest plants leave the plot. Multi harvest plants regrow.
5. Sell the harvest and spend the coins on seeds, tools, or upgrades.

## First playable (Phase 1)

The first version is small on purpose. It has 12 seeds, the shop, selling, one expansion upgrade, and saving. It has no weather, tools, or workers.

| Rarity | Seeds |
|---|---|
| Common | Carrot, Radish, Lettuce, Potato |
| Rare | Tomato, Strawberry, Blueberry |
| Epic | Pumpkin, Corn |
| Legendary | Starfruit, Golden Apple |
| Mythic | Moonflower |

You start with 100 coins, three carrot seeds, and a 6 by 4 farm. Each expansion adds a row or a column, up to 8 by 6.

## Progress

Phase 1 is done. The core loop works, with planting, harvesting, selling, the rotating shop, farm expansion, the shovel, and saving.

Phase 2 is done. The farm has a wooden frame with corner posts and textured soil. Plants bounce when they reach a new stage, and ripe plants of Epic rarity or higher glow. Harvested crops fly into the Sell tab, coins fly up to the counter when you sell, and bought seeds fly down to the seed bar. Cloud shadows drift over the farm, butterflies wander around, and the seed you are holding follows the mouse.

Phase 3 is done. Nine kinds of weather take turns with clear skies, and each one can give plants its modifier. Seven fusions combine modifiers into stronger ones, and Golden and Prismatic plants show up by luck. The Guide tab lists everything and hides fusions until you find them. There are five tools (Watering Can, Fertilizer, Trowel, Storm in a Jar, Golden Spray) and four upgrades (Rich Soil, Weather Vane, Market Stall, Bigger Shop). Saves from earlier versions upgrade on their own.

Phase 4 is done. There are five workers, and each one lives in a building on its own plot. The Waterer walks over and waters plants, and the Picker harvests ripe ones into the basket. The Aura Cultivator and the Shadow Gardener send out pulses that grow nearby plants and can leave Aura or Risen on them. The Beekeeper's bees fly out to plants, and their visits can leave plants Pollinated. Aura and Risen fuse into Monarch. Buildings level up to 3, and a building that gets picked up keeps its level. Workers only work while the game is open. Phones held sideways can play, and phones held upright are asked to turn.

**Balance note for Phase 5:** Plants that regrow keep their modifiers forever. A Supernova Moonflower would earn about 19 million coins every harvest, so this needs a cap or a decay once the economy gets tuned.

## Later phases

| Phase | What gets added |
|---|---|
| 2 | The visual pass with growth stages, the UI theme, and animations |
| 3 | Weather, modifiers, fusions, tools, and the rest of the upgrades |
| 4 | Workers and buildings, rebuilt from scratch (see below) |
| 5 | The economy curve, offline growth, and goals to work toward |
| 6 | Sound, settings, a tutorial, the store page, and release |

Fusions will live in one table that lists two inputs and a result. That replaces the long chain of if statements from the original, and adding a fusion becomes one new line.

## Workers (Phase 4)

The original employee system never worked. Each worker expected different inputs, and the game guessed which one it had by counting function parameters. Workers also stopped acting once their building scrolled off screen, and every worker was stored in two places that drifted apart.

The new rules:

1. A worker lives inside its building. There is no separate list of employees.
2. Every worker type has one `work(farm, building)` function, and it always receives the same thing.
3. Work runs on grid positions, so it doesn't matter what is on screen.
4. Walking around is animation and has no effect on the game.

Workers ship one at a time. Each one gets tested on its own before the next is added.

## Renamed references

These replace names the game doesn't own. Each one still hints at where it came from.

| Original | New name | Nod |
|---|---|---|
| Senzu Bean | Cat Tower Bean | The cat who grows them on his tower |
| Devil Fruit | Swirlfruit | The swirl pattern and the bad swimming |
| Sakuna Rice | Goddess Rice | The harvest goddess who farms it |
| Pokeblock Berry | Pocket Berry | Pocket monsters |
| Sung Jin Woo (worker) | The Shadow Gardener | Arise |
| World Tree Sapling | Keep as is | Myth, nobody owns it |
| Philosopher's Bloom | Keep as is | Old alchemy, nobody owns it |

**Open question:** The Forsaken references (c00l Apple, 1-Egg-1-Egg-1-Egg-1-Egg, and codes like SPOOKYSCARYSKIBIDIS) came from when that game was popular and may feel dated now. The suggestion is to cut most of them and keep one as a hidden easter egg.

## Things not carried over

1. Starting with 1,000,000 coins
2. Codes that give Infinity coins
3. Sprinklers changing grow times while the screen draws
4. All plant drawings living in one giant function. Each plant gets its own small draw function instead.

## Writing rules

These apply to every piece of text players see, including the store page.

1. Write full sentences and don't use fragments.
2. Don't use dashes to join clauses.
3. Say the plain thing. A tomato is a tomato and not "a vibrant burst of summer."
4. The store description gets written by you and edited together, not generated.
