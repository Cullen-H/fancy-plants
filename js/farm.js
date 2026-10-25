// Game rules. Nothing in here draws anything or touches the page.
// Functions that can fail return a message for the player, or null when they worked.
(function (FP) {
  // ---------- Growing ----------

  // Plants store when they were planted and how long they take, so they keep
  // growing while the game is closed.
  // A paused plant is frozen at the moment it paused (see special.js).
  const clock = (plant, now) => plant.pausedAt || now;
  FP.growPercent = (plant, now) => FP.clamp((clock(plant, now) - plant.plantedAt) / plant.growMs, 0, 1);
  FP.isRipe = (plant, now) => clock(plant, now) - plant.plantedAt >= plant.growMs;
  FP.timeLeft = (plant, now) => Math.max(0, plant.plantedAt + plant.growMs - clock(plant, now));

  const STAGE_START = [0, 0.25, 0.6, 1];

  // 0 sprout, 1 young, 2 budding, 3 ripe. sub is the progress inside the current stage.
  FP.growStage = function (plant, now) {
    const p = FP.growPercent(plant, now);
    let stage = p >= 1 ? 3 : p >= 0.6 ? 2 : p >= 0.25 ? 1 : 0;
    // A plant that regrows keeps its leaves after a harvest instead of going back to a sprout.
    if (plant.harvests > 0 && stage === 0) stage = 1;
    const lo = STAGE_START[stage], hi = STAGE_START[stage + 1] ?? 1;
    const sub = stage === 3 ? 1 : FP.clamp((p - lo) / (hi - lo), 0, 1);
    return { stage, sub, percent: p };
  };

  FP.plantSeed = function (state, x, y, seedId, now) {
    const seed = FP.SEED_BY_ID[seedId];
    if (!seed) return "That seed doesn't exist.";
    if (FP.buildingAt(state, x, y)) return "There's a building on that plot.";
    if (FP.occupantAt(state, x, y)) return "Something is already growing there.";
    if (!state.seeds[seedId]) return "You're out of " + seed.name + " seeds.";
    const fit = FP.fitSeed(state, seed, x, y);
    if (fit.error) return fit.error;
    state.seeds[seedId]--;
    if (state.seeds[seedId] <= 0) delete state.seeds[seedId];
    const plant = FP.newPlant(state, seed, now);
    state.plots[fit.y][fit.x] = plant;
    state.stats.planted++;
    FP.rollLucky(state, plant);
    return null;
  };

  // Returns the harvested item, or null if nothing was ready.
  FP.harvestPlot = function (state, x, y, now) {
    const plant = state.plots[y][x];
    if (!plant || !FP.isRipe(plant, now)) return null;
    const result = FP.harvestPlant(state, plant, now);
    if (result.gone) {
      FP.removeFence(state, plant); // a fence around a plant that's gone goes back in the bar
      state.plots[y][x] = null;
    }
    return result.item;
  };

  // Harvests a ripe plant wherever it is. gone is true when it doesn't regrow and should be removed.
  FP.harvestPlant = function (state, plant, now) {
    const seed = FP.SEED_BY_ID[plant.seedId];
    const item = { seedId: seed.id, value: Math.round(seed.value * FP.modMultiplier(plant.mods)), mods: plant.mods.slice() };
    FP.addXp(state, FP.HARVEST_XP[seed.rarity]);
    state.harvest.push(item);
    state.stats.harvested++;
    state.stats.byRarity[seed.rarity]++;
    if (seed.regrow > 0) {
      // The modifiers leave with the harvest, so each new crop starts plain except for a sealed one.
      plant.mods = plant.sealed ? [plant.sealed] : [];
      plant.plantedAt = now;
      plant.growMs = seed.regrow * 1000 * FP.growthFactor(state);
      plant.harvests++;
      FP.rollLucky(state, plant);
      return { item, gone: false };
    }
    return { item, gone: true };
  };

  // Ripe plants for Harvest All. Plants with a Picket Fence are left for you to pick by hand.
  FP.ripeCells = function (state, now) {
    const cells = [];
    state.plots.forEach((row, y) => row.forEach((plant, x) => {
      if (plant && !plant.fenced && FP.isRipe(plant, now)) cells.push({ x, y });
    }));
    return cells;
  };

  FP.digUp = function (state, x, y) {
    const plant = state.plots[y][x];
    if (plant) FP.removeFence(state, plant);
    state.plots[y][x] = null;
    return plant;
  };

  // ---------- Selling ----------

  // Sells every harvested item, or only one kind when seedId is given.
  FP.sellHarvest = function (state, seedId) {
    let count = 0, coins = 0;
    state.harvest = state.harvest.filter(item => {
      if (seedId && item.seedId !== seedId) return true;
      count++;
      const price = FP.sellPrice(state, item);
      coins += price;
      state.stats.best = Math.max(state.stats.best, price);
      return false;
    });
    state.coins += coins;
    state.stats.earned += coins;
    state.stats.runEarned += coins;
    return { count, coins };
  };

  FP.sellPrice = (state, item) => Math.round(item.value * (1 + 0.05 * FP.upgradeLevel(state, "stall")) * (1 + 0.1 * FP.skillLevel(state, "haggler")));

  const groupKey = item => item.seedId + "|" + item.mods.slice().sort().join(",");

  // Groups the basket by seed and modifiers for the sell menu, most valuable first.
  FP.harvestGroups = function (state) {
    const groups = {};
    state.harvest.forEach(item => {
      const key = groupKey(item);
      const g = groups[key] || (groups[key] = { key, seed: FP.SEED_BY_ID[item.seedId], mods: item.mods, count: 0, total: 0 });
      g.count++;
      g.total += FP.sellPrice(state, item);
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  };

  // Sells one group from harvestGroups.
  FP.sellGroup = function (state, key) {
    let count = 0, coins = 0;
    state.harvest = state.harvest.filter(item => {
      if (groupKey(item) !== key) return true;
      count++;
      const price = FP.sellPrice(state, item);
      coins += price;
      state.stats.best = Math.max(state.stats.best, price);
      return false;
    });
    state.coins += coins;
    state.stats.earned += coins;
    state.stats.runEarned += coins;
    return { count, coins };
  };

  // ---------- Floors ----------

  FP.setFloor = function (state, i) {
    state.floor = i;
    state.plots = state.floors[i].plots;
    state.buildings = state.floors[i].buildings;
    state.tiles = state.floors[i].tiles;
  };

  // Runs fn once for every floor, with that floor showing, then puts the original floor back.
  FP.eachFloor = function (state, fn) {
    const home = state.floor;
    try {
      state.floors.forEach((f, i) => {
        FP.setFloor(state, i);
        fn(i, i === home);
      });
    } finally {
      FP.setFloor(state, home);
    }
  };

  // The Farm Floors skill decides how many floors can be built. Building them costs coins.
  FP.floorsAllowed = state => Math.min(FP.MAX_FLOORS, 1 + FP.skillLevel(state, "floors"));
  FP.floorCost = state => FP.FLOOR_PRICES[state.floors.length - 1];

  const emptyFloor = state => ({ plots: FP.makeGrid(state.cols, state.rows), buildings: [], tiles: FP.makeGrid(state.cols, state.rows) });

  FP.buyFloor = function (state) {
    if (state.floors.length >= FP.MAX_FLOORS) return "Your farm already has every floor.";
    if (state.floors.length >= FP.floorsAllowed(state)) return "The Farm Floors skill in the black hole lets you build another floor.";
    const cost = FP.floorCost(state);
    if (state.coins < cost) return "You need " + FP.formatCoins(cost - state.coins) + " more coins for that.";
    state.coins -= cost;
    state.floors.push(emptyFloor(state));
    return null;
  };

  // Adds every floor the skill allows for free. Only the test panel uses this.
  FP.ensureFloors = function (state) {
    while (state.floors.length < FP.floorsAllowed(state)) state.floors.push(emptyFloor(state));
  };

  // Ripe plants on one floor, for the badges on the floor arrows.
  FP.ripeOnFloor = (state, i, now) => state.floors[i].plots.reduce((n, row) => n + row.filter(p => p && FP.isRipe(p, now)).length, 0);

  // ---------- Farm size ----------

  // The Wide Fields skill raises the biggest size the farm can reach.
  FP.maxFarmSize = state => {
    const [cols, rows] = FP.FARM_SIZES[Math.min(FP.FARM_SIZES.length - 1, FP.skillLevel(state, "wide"))];
    return { cols, rows };
  };

  FP.canExpand = state => {
    const max = FP.maxFarmSize(state);
    return state.cols < max.cols || state.rows < max.rows;
  };

  // Alternates between adding a column and a row: 6x4, 7x4, 7x5, 8x5, 8x6, and on with Wide Fields.
  FP.nextFarmSize = function (state) {
    if (!FP.canExpand(state)) return null;
    const max = FP.maxFarmSize(state);
    const addCol = state.cols < max.cols && (state.cols - state.rows <= 2 || state.rows >= max.rows);
    return addCol ? { cols: state.cols + 1, rows: state.rows } : { cols: state.cols, rows: state.rows + 1 };
  };

  // Grows every floor to the new size.
  FP.growFarm = function (state, size) {
    state.floors.forEach(f => {
      for (const grid of [f.plots, f.tiles]) {
        while (grid[0].length < size.cols) grid.forEach(row => row.push(null));
        while (grid.length < size.rows) grid.push(new Array(size.cols).fill(null));
      }
    });
    state.cols = size.cols;
    state.rows = size.rows;
  };

  FP.expansionCost = function (state) {
    const done = (state.cols - FP.START.cols) + (state.rows - FP.START.rows);
    return Math.round(400 * Math.pow(2.4, done) / 10) * 10;
  };

  FP.expansionsDone = state => (state.cols - FP.START.cols) + (state.rows - FP.START.rows);
  FP.expandLevel = state => FP.EXPAND_LEVEL[FP.expansionsDone(state)] || 1;

  FP.expand = function (state) {
    if (FP.level(state) < FP.expandLevel(state)) return "The next expansion unlocks at level " + FP.expandLevel(state) + ".";
    const next = FP.nextFarmSize(state);
    if (!next) return "Your farm is already as big as it can get.";
    const cost = FP.expansionCost(state);
    if (state.coins < cost) return "You need " + FP.formatCoins(cost - state.coins) + " more coins to expand.";
    state.coins -= cost;
    FP.growFarm(state, next);
    return null;
  };

  // ---------- Shop ----------

  FP.refreshShop = function (state, now) {
    state.shop.stock = [];
    FP.SEEDS.forEach(seed => {
      const rarity = FP.RARITIES[seed.rarity];
      const shelf = FP.upgradeLevel(state, "shelf");
      const chance = Math.min(1, rarity.stockChance * (1 + 0.15 * shelf));
      if (!FP.seedUnlocked(state, seed)) return;
      // Carrots are always in stock so a player can never get stuck without anything to buy.
      if (seed.id === "carrot" || Math.random() < chance) {
        state.shop.stock.push({ seedId: seed.id, left: FP.randInt(rarity.stock[0], rarity.stock[1]) + shelf + FP.skillLevel(state, "bulk") });
      }
    });
    state.shop.nextRefresh = now + FP.SHOP_REFRESH_MS;
  };

  // Tools restock on their own timer. The Watering Can is always there.
  FP.refreshToolShop = function (state, now) {
    state.toolShop.stock = FP.TOOLS
      .filter(t => FP.toolUnlocked(state, t.id) && Math.random() < t.stockChance)
      .map(t => ({ id: t.id, left: FP.randInt(t.stockMin, t.stockMax) + FP.skillLevel(state, "bulk") }));
    state.toolShop.nextRefresh = now + FP.TOOL_REFRESH_MS;
  };

  FP.buySeed = function (state, index) {
    const slot = state.shop.stock[index];
    if (!slot) return "That seed isn't in the shop anymore.";
    const seed = FP.SEED_BY_ID[slot.seedId];
    if (slot.left <= 0) return "The " + seed.name + " seeds are sold out.";
    if (state.coins < seed.price) return "You need " + FP.formatCoins(seed.price - state.coins) + " more coins for that.";
    state.coins -= seed.price;
    slot.left--;
    state.seeds[seed.id] = (state.seeds[seed.id] || 0) + 1;
    return null;
  };

  // True when the player has no seeds, no plants, nothing to sell, and can't afford a seed.
  FP.isStuck = function (state) {
    if (Object.keys(state.seeds).length > 0 || state.harvest.length > 0 || state.buildings.length > 0) return false;
    if (state.floors.some(f => f.buildings.length || f.plots.some(row => row.some(Boolean)))) return false;
    return state.coins < Math.min(...FP.SEEDS.map(s => s.price)); // regular seeds only
  };

  // ---------- Upgrades ----------

  FP.upgradeLevel = (state, id) => state.upgrades[id] || 0;

  FP.upgradeCost = function (state, id) {
    const u = FP.UPGRADE_BY_ID[id];
    return Math.round(u.base * Math.pow(u.scale, FP.upgradeLevel(state, id)) / 10) * 10;
  };

  FP.buyUpgrade = function (state, id) {
    const u = FP.UPGRADE_BY_ID[id];
    if (!u) return "That upgrade doesn't exist.";
    if (FP.upgradeLevel(state, id) >= u.max) return u.name + " is already at its highest level.";
    const cost = FP.upgradeCost(state, id);
    if (state.coins < cost) return "You need " + FP.formatCoins(cost - state.coins) + " more coins for that.";
    state.coins -= cost;
    state.upgrades[id] = FP.upgradeLevel(state, id) + 1;
    return null;
  };

  // Grow times are multiplied by this when a seed is planted or regrows.
  FP.growthFactor = state => (1 - 0.05 * FP.upgradeLevel(state, "soil")) * (1 - 0.05 * FP.skillLevel(state, "thumb"));

  // ---------- Modifiers ----------

  FP.modMultiplier = mods => mods.reduce((m, id) => m * (FP.MODS[id] ? FP.MODS[id].mult : 1), 1);

  // Combines modifiers that fuse, over and over, so one new modifier can set off a chain.
  // Returns the fusion results that were made.
  function resolveFusions(plant) {
    const made = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const [a, b, out] of FP.FUSIONS) {
        const mods = plant.mods;
        if (mods.includes(a) && mods.includes(b) && !mods.includes(out)) {
          plant.mods = mods.filter(id => id !== a && id !== b);
          if (plant.sealed === a || plant.sealed === b) plant.sealed = out; // the seal moves to what they became
          plant.mods.push(out);
          made.push(out);
          changed = true;
        }
      }
    }
    return made;
  }

  // Adds a modifier to a plant. Returns null if it already had it, or
  // { fused, newFinds } where fused lists fusion results and newFinds lists first time discoveries.
  FP.addMod = function (state, plant, modId) {
    if (plant.mods.includes(modId)) return null;
    plant.mods.push(modId);
    state.stats.modsGained++;
    const fused = resolveFusions(plant);
    const newFinds = [modId, ...fused].filter(id => !state.discovered[id]);
    newFinds.forEach(id => { state.discovered[id] = true; });
    return { fused, newFinds };
  };

  // Each new growing cycle has a small chance to turn out Golden, Diamond, Prismatic, or Monochrome.
  // The plant remembers which one so the game can celebrate it once.
  FP.rollLucky = function (state, plant) {
    for (const id of FP.LUCKY_MODS) {
      if (!plant.mods.includes(id) && Math.random() < FP.MODS[id].chance * (1 + 0.5 * FP.skillLevel(state, "lucky"))) {
        FP.addMod(state, plant, id);
        plant.luckyNew = id;
        return id;
      }
    }
    return null;
  };

  // ---------- Weather ----------

  FP.currentWeather = state => FP.WEATHER_BY_ID[state.weather.id];

  // Only weathers that can start at this time of day are in the running, and never the one that just ended.
  function pickWeather(state, now) {
    const time = FP.timeOfDay(now).id;
    const options = FP.WEATHER.filter(w => w.weight > 0 && w.id !== state.weather.id &&
      (w.id === "clear" || FP.weatherUnlocked(state, w.id)) && (w.times === "all" || w.times.includes(time)));
    if (!options.length) return FP.WEATHER_BY_ID.clear;
    let roll = Math.random() * options.reduce((sum, w) => sum + w.weight, 0);
    for (const w of options) {
      roll -= w.weight;
      if (roll < 0) return w;
    }
    return options[0];
  }

  // The next weather starts the moment the last one ends.
  // A forecast from the Weather Station becomes the next weather, whatever the time of day.
  FP.nextWeather = function (state, now) {
    const forecast = state.weather.forecast;
    const next = forecast ? FP.WEATHER_BY_ID[forecast] : pickWeather(state, now);
    const [lo, hi] = next.id === "clear" ? FP.WEATHER_TIMES.clear : next.event ? FP.WEATHER_TIMES.event : FP.WEATHER_TIMES.active;
    state.weather = { id: next.id, endsAt: now + FP.randInt(lo, hi) * 1000 };
    return next;
  };

  // At night, plants can become Moonlit no matter what the weather is doing.
  FP.nightTick = function (state, now, onChange) {
    if (!FP.isNight(now)) return;
    state.plots.forEach((row, y) => row.forEach((plant, x) => {
      if (!plant || Math.random() >= FP.NIGHT_CHANCE * (1 + FP.skillLevel(state, "owl"))) return;
      const result = FP.addMod(state, plant, "moonlit");
      if (result) onChange(x, y, plant, "moonlit", result);
    }));
  };

  // Modifiers a hurricane can blow away: weather ones that aren't sealed.
  FP.loseableMods = plant => plant.mods.filter(id => FP.MODS[id].kind === "weather" && id !== plant.sealed);

  // Gives some plants the current weather's modifiers, or blows some off during a hurricane.
  // onChange(x, y, plant, modId, result) runs for each plant that gained one, and
  // onStrip(x, y, plant, modId) for each plant that lost one.
  FP.weatherTick = function (state, onChange, onStrip) {
    const weather = FP.currentWeather(state);
    if (weather.strip) {
      state.plots.forEach((row, y) => row.forEach((plant, x) => {
        if (!plant || plant.fenced || Math.random() >= FP.WEATHER_CHANCE) return;
        const loseable = FP.loseableMods(plant);
        if (!loseable.length) return;
        const modId = loseable[Math.floor(Math.random() * loseable.length)];
        plant.mods = plant.mods.filter(id => id !== modId);
        if (onStrip) onStrip(x, y, plant, modId);
      }));
      return;
    }
    if (!weather.mod) return;
    const base = weather.event ? FP.EVENT_CHANCE : FP.WEATHER_CHANCE;
    const chance = base * (1 + 0.25 * FP.upgradeLevel(state, "vane")) * (1 + 0.2 * FP.skillLevel(state, "storm"));
    const mods = [weather.mod, ...(weather.also || [])];
    state.plots.forEach((row, y) => row.forEach((plant, x) => {
      if (!plant) return;
      // An event turns a modifier the plant already has into a stronger one, like Wet into Soaked.
      const from = Object.keys(weather.upgrade || {}).find(id => plant.mods.includes(id));
      if (from) {
        if (Math.random() >= chance) return;
        const to = weather.upgrade[from];
        if (plant.mods.includes(to)) return;
        plant.mods = plant.mods.filter(id => id !== from);
        if (plant.sealed === from) plant.sealed = to;
        const result = FP.addMod(state, plant, to);
        if (result) onChange(x, y, plant, to, result);
        return;
      }
      for (const modId of mods) {
        if (Math.random() >= chance) continue;
        const result = FP.addMod(state, plant, modId);
        if (result) onChange(x, y, plant, modId, result);
      }
    }));
  };

  // ---------- Tools ----------

  FP.buyTool = function (state, id) {
    const tool = FP.TOOL_BY_ID[id];
    if (!tool) return "That tool doesn't exist.";
    const slot = state.toolShop.stock.find(s => s.id === id);
    if (!slot || slot.left <= 0) return "The " + tool.name + " is sold out until the next restock.";
    if (state.coins < tool.price) return "You need " + FP.formatCoins(tool.price - state.coins) + " more coins for that.";
    state.coins -= tool.price;
    slot.left--;
    state.tools[id] = (state.tools[id] || 0) + tool.uses;
    return null;
  };

  function spendTool(state, id) {
    state.tools[id]--;
    if (state.tools[id] <= 0) delete state.tools[id];
  }

  // Uses a tool on the plant at (x, y). The trowel is handled by movePlant instead.
  // Returns { error } or { ok: true, modId, result } where result comes from addMod.
  FP.useTool = function (state, id, x, y, now) {
    const tool = FP.TOOL_BY_ID[id];
    const plant = state.plots[y][x];
    if (!state.tools[id]) return { error: "You're out of " + tool.name + " uses." };
    if (!plant) return { error: "There's no plant here to use the " + tool.name + " on." };
    const seed = FP.SEED_BY_ID[plant.seedId];

    if (plant.needsFeed) {
      if (id !== "fertilizer") return { error: "The " + seed.name + " needs Fertilizer before it will grow." };
      FP.feedPlant(plant, now);
      spendTool(state, id);
      return { ok: true, fed: true };
    }

    if (tool.grow) {
      if (FP.isRipe(plant, now)) return { error: "The " + seed.name + " is already ripe." };
      // Moving the planted time back makes the plant act as if it has been growing longer.
      plant.plantedAt = Math.max(plant.plantedAt - plant.growMs * tool.grow, now - plant.growMs);
      spendTool(state, id);
      return { ok: true };
    }

    if (id === "seal") {
      const next = FP.nextSeal(plant);
      if (next.error) return next;
      plant.sealed = next.modId;
      spendTool(state, id);
      return { ok: true, sealed: next.modId };
    }

    let modId = null;
    if (id === "jar") {
      modId = FP.currentWeather(state).mod;
      if (!modId) return { error: "The sky is clear, so there's no weather to put in the jar." };
    } else if (id === "spray") {
      modId = "golden";
    }
    if (plant.mods.includes(modId)) return { error: "The " + seed.name + " is already " + FP.MODS[modId].name + "." };
    const result = FP.addMod(state, plant, modId);
    spendTool(state, id);
    return { ok: true, modId, result };
  };

  // Which modifier a Wax Seal would seal on this plant. The first seal takes the most valuable
  // modifier, and each seal after that moves on to the next one down, starting over at the top.
  FP.nextSeal = function (plant) {
    const seed = FP.SEED_BY_ID[plant.seedId];
    if (!seed.regrow) return { error: "The " + seed.name + " doesn't regrow, so a seal would be lost when you harvest it." };
    if (!plant.mods.length) return { error: "The " + seed.name + " has no modifiers to seal yet." };
    const order = plant.mods.slice().sort((a, b) => FP.MODS[b].mult - FP.MODS[a].mult);
    if (!plant.sealed || !order.includes(plant.sealed)) return { modId: order[0] };
    if (order.length === 1) return { error: "The " + seed.name + "'s only modifier is already sealed." };
    return { modId: order[(order.indexOf(plant.sealed) + 1) % order.length] };
  };

  // from and to are { x, y, floor }. A plant can move to another floor.
  FP.movePlant = function (state, from, to) {
    if (!state.tools.trowel) return "You're out of Trowel uses.";
    const fromPlots = state.floors[from.floor].plots;
    const plant = fromPlots[from.y][from.x];
    const seed = FP.SEED_BY_ID[plant.seedId];
    if (FP.plantSize(plant) > 1) return "The " + seed.name + " is too big to move.";
    if (!FP.isFree(state, to.x, to.y)) return "That plot isn't empty.";
    const tile = FP.tileAt(state, to.x, to.y);
    const needs = seed.needs || {};
    if (needs.tile && tile !== needs.tile) return "The " + seed.name + " has to stay on " + FP.TILES[needs.tile].name.toLowerCase() + ".";
    if (!needs.tile && tile === "water") return "Only water plants can grow in a pond.";
    state.plots[to.y][to.x] = plant;
    fromPlots[from.y][from.x] = null;
    spendTool(state, "trowel");
    return null;
  };
})(window.FP);
