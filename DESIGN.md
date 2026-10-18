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

Phase 5 is done. Plants that regrow now lose their modifiers with each harvest, so every crop starts plain. Weather is a little more likely to change plants, and when a weather ends a message says how many plants it changed. Blueberry got cheaper, Pumpkin sells for more, and Golden Spray costs less now that it only boosts one harvest. There are 20 goals with rewards in a new Goals tab, and the game says when one is ready to claim.

Phase 6 is mostly done. Sound effects are made in code, so there are no audio files to load. Options moved behind a gear button and has a volume slider and a setting for fewer effects. New players get a six step tutorial that they can skip or replay. The store page description is still to do, and you will write that one.

Phase 7 is done. The tool shop restocks every 4 minutes and the worker shop every 6, so tools and workers can sell out. A day and night clock runs alongside the weather, and a full day takes 24 real minutes. The farm turns warm at dawn and dusk, gets dark at night, and fireflies come out. Moonlight is no longer a weather. Instead, any plant can become Moonlit at night. Each weather can only start at certain times, so Sunny happens in the day and Blood Moon only at midnight.

Phase 8 is done. The farm has a level from 1 to 20, and harvesting earns XP, with rarer crops giving more. Levels unlock seed rarities, tools, workers, farm expansions, the weather, and the rarest weathers, and the shops show what is still locked. Farms from before this update got a level based on what they had already harvested. At level 12 you can rebirth: the farm spins into a black hole and you get GMO Points, more of them the more coins you earned that run. The black hole screen has a skill tree with four branches (Growth, Market, Luck, and Workers) and twelve skills. The guide, goals, lifetime stats, and skills carry over between runs.

Phase 9 is done. A second after you leave the black hole for the first time, a little guy walks in from the left, puts up a TOWN sign, and walks off, leaving a dirt path behind him. The farm moves right to make room. Clicking the sign opens the Town, a street that follows the time of day. The Casino has Coin Flip, Rock Paper Scissors, Blackjack, and Slots. Each crop can be bet once, a win multiplies its value, and a loss halves it. Every game is close to an even bet over many plays. At the Weather Station the weatherman takes a crop and sets the next weather, and better crops make rare weathers more likely. The Town is a round stone plaza with a fountain in the middle and eight buildings around the edge. The Casino and the Weather Station are open, and six more are boarded up for later updates. Clicking the fountain shows the player from behind, tossing one coin at a time. Each toss lands somewhere different, splashes, and sinks, and now and then a coin clinks off the rim first. The game counts the coins and keeps the count through rebirths, but never shows it. The helpers you place on the farm are called buildings in the game now, and the shop tab for them is called Buildings.

Phase 10 is done. The skill tree has a fifth branch, Land. Wide Fields raises the biggest farm size from 8 by 6 up to 10 by 7, and the extra expansions still cost coins and need levels 17, 19, and 20. Second Floor and Third Floor add whole new layers of plots, and the arrows on the right side of the farm switch between them, with a badge counting ripe plants on the floors above and below. Page Up and Page Down switch floors too. Every floor is the same size, weather and night reach every floor, and buildings keep working on floors you aren't looking at.

## Later phases

| Phase | What gets added |
|---|---|
| 2 | The visual pass with growth stages, the UI theme, and animations |
| 3 | Weather, modifiers, fusions, tools, and the rest of the upgrades |
| 4 | Workers and buildings, rebuilt from scratch (see below) |
| 5 | The economy curve, offline growth, and goals to work toward |
| 6 | Sound, settings, a tutorial, the store page, and release |

### Phases 7 to 9

| Phase | What gets added |
|---|---|
| 7 | The tool and worker shops restock on timers. A day and night clock runs alongside the weather, and each weather can only start at certain times of day. |
| 8 | Farm levels that unlock seeds, tools, and workers. Rebirth resets the farm for GMO Points, which are spent on a skill tree around a black hole labeled "Fancy Plants!" |
| 9 | After the first rebirth, a little guy walks in and plants a sign that leads to the Town. The Town has a Casino and a Weather Station to start with. |

**Casino.** You bet a harvested plant on a game such as Blackjack, Rock Paper Scissors (best of 3), or Slots. Winning raises the plant's value. Losing cuts its value in half, but you keep the plant.

**Weather Station.** You hand the weatherman a harvested plant, and he picks the next weather. A rarer, more valuable plant makes a rare weather more likely, but he decides which one.

### Phases 10 to 12

| Phase | What gets added |
|---|---|
| 10 | GMO skills for a bigger max farm, and farm floors. Floor 2 and Floor 3 are GMO skills, up and down arrows beside the farm switch between them, and each floor is a full layer of plots the same size as the farm. Buildings only help plants on their own floor, and weather reaches every floor. |
| 11 | The Seed Shop in Town. Each special seed has its own quest, and finishing the quest puts that seed on sale. Special seeds include plants that need a certain tile, plants that need fertilizer, plants that take several tiles, and plants that need a set temperature or humidity. The Seed Shop also sells tile kits that turn a plot into a special tile wherever you choose. This phase also adds the Green House, a building that takes one tile and opens a 3 by 3 grid with temperature and humidity controls, and the Picket Fence, which stops the Picker from harvesting the plant it surrounds and wraps the whole plant when that plant takes several tiles. |
| 12 | The Request Board in Town. Townsfolk ask for specific crops, and handing one over pays the crop's value times a multiplier. Harder requests, such as a crop with a certain modifier, have bigger multipliers. |

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
