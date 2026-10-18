// Game rules. Nothing in here draws anything or touches the page.
// Functions that can fail return a message for the player, or null when they worked.
(function (FP) {
  // ---------- Growing ----------

  // Plants store when they were planted and how long they take, so they keep
  // growing while the game is closed.
  FP.growPercent = (plant, now) => FP.clamp((now - plant.plantedAt) / plant.growMs, 0, 1);
  FP.isRipe = (plant, now) => now - plant.plantedAt >= plant.growMs;
  FP.timeLeft = (plant, now) => Math.max(0, plant.plantedAt + plant.growMs - now);

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
    if (state.plots[y][x]) return "Something is already growing there.";
    if (!state.seeds[seedId]) return "You're out of " + seed.name + " seeds.";
    state.seeds[seedId]--;
    if (state.seeds[seedId] <= 0) delete state.seeds[seedId];
    const plant = { seedId, plantedAt: now, growMs: seed.grow * 1000 * FP.growthFactor(state), harvests: 0, mods: [] };
    state.plots[y][x] = plant;
    state.stats.planted++;
    FP.rollLucky(state, plant);
    return null;
  };

  // Returns the harvested item, or null if nothing was ready.
  FP.harvestPlot = function (state, x, y, now) {
    const plant = state.plots[y][x];
    if (!plant || !FP.isRipe(plant, now)) return null;
    const seed = FP.SEED_BY_ID[plant.seedId];
    const item = { seedId: seed.id, value: Math.round(seed.value * FP.modMultiplier(plant.mods)), mods: plant.mods.slice() };
    FP.addXp(state, FP.HARVEST_XP[seed.rarity]);
    state.harvest.push(item);
    state.stats.harvested++;
    state.stats.byRarity[seed.rarity]++;
    if (seed.regrow > 0) {
      // The modifiers leave with the harvest, so each new crop starts plain.
      plant.mods = [];
      plant.plantedAt = now;
      plant.growMs = seed.regrow * 1000 * FP.growthFactor(state);
      plant.harvests++;
      FP.rollLucky(state, plant);
    } else {
      state.plots[y][x] = null;
    }
    return item;
  };

  FP.ripeCells = function (state, now) {
    const cells = [];
    state.plots.forEach((row, y) => row.forEach((plant, x) => {
      if (plant && FP.isRipe(plant, now)) cells.push({ x, y });
    }));
    return cells;
  };

  FP.digUp = function (state, x, y) {
    const plant = state.plots[y][x];
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
    return { count, coins };
  };

  // ---------- Floors ----------

  FP.setFloor = function (state, i) {
    state.floor = i;
    state.plots = state.floors[i].plots;
    state.buildings = state.floors[i].buildings;
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

  FP.floorsUnlocked = state => 1 + FP.skillLevel(state, "floor2") + FP.skillLevel(state, "floor3");

  // Adds empty floors the player has unlocked but doesn't have yet.
  FP.ensureFloors = function (state) {
    while (state.floors.length < Math.min(FP.MAX_FLOORS, FP.floorsUnlocked(state))) {
      state.floors.push({ plots: FP.makeGrid(state.cols, state.rows), buildings: [] });
    }
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
      while (f.plots[0].length < size.cols) f.plots.forEach(row => row.push(null));
      while (f.plots.length < size.rows) f.plots.push(new Array(size.cols).fill(null));
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
    return state.coins < Math.min(...FP.SEEDS.map(s => s.price));
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

  // Each new growing cycle has a small chance to turn out Golden or Prismatic.
  // The plant remembers which one so the game can celebrate it once.
  FP.rollLucky = function (state, plant) {
    for (const id of ["prismatic", "golden"]) {
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

  // Only weathers that can start at this time of day are in the running.
  function pickWeather(state, now) {
    const time = FP.timeOfDay(now).id;
    const options = FP.WEATHER.filter(w => w.weight > 0 && FP.weatherUnlocked(state, w.id) && (w.times === "all" || w.times.includes(time)));
    if (!options.length) return FP.WEATHER_BY_ID.clear;
    let roll = Math.random() * options.reduce((sum, w) => sum + w.weight, 0);
    for (const w of options) {
      roll -= w.weight;
      if (roll < 0) return w;
    }
    return options[0];
  }

  // Clear skies come between every other kind of weather.
  // A forecast from the Weather Station replaces the next weather, whatever the time of day.
  FP.nextWeather = function (state, now) {
    const wasClear = state.weather.id === "clear";
    const forecast = state.weather.forecast;
    let next;
    if (wasClear && forecast) next = FP.WEATHER_BY_ID[forecast];
    else next = wasClear ? pickWeather(state, now) : FP.WEATHER_BY_ID.clear;
    const [lo, hi] = next.mod ? FP.WEATHER_TIMES.active : FP.WEATHER_TIMES.clear;
    state.weather = { id: next.id, endsAt: now + FP.randInt(lo, hi) * 1000 };
    if (forecast && !(wasClear && forecast)) state.weather.forecast = forecast; // still waiting its turn
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

  // Gives some plants the current weather's modifier.
  // onChange(x, y, plant, modId, result) runs for each plant that changed.
  FP.weatherTick = function (state, onChange) {
    const weather = FP.currentWeather(state);
    if (!weather.mod) return;
    const chance = FP.WEATHER_CHANCE * (1 + 0.25 * FP.upgradeLevel(state, "vane")) * (1 + 0.2 * FP.skillLevel(state, "storm"));
    state.plots.forEach((row, y) => row.forEach((plant, x) => {
      if (!plant || Math.random() >= chance) return;
      const result = FP.addMod(state, plant, weather.mod);
      if (result) onChange(x, y, plant, weather.mod, result);
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

    if (tool.grow) {
      if (FP.isRipe(plant, now)) return { error: "The " + seed.name + " is already ripe." };
      // Moving the planted time back makes the plant act as if it has been growing longer.
      plant.plantedAt = Math.max(plant.plantedAt - plant.growMs * tool.grow, now - plant.growMs);
      spendTool(state, id);
      return { ok: true };
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

  FP.movePlant = function (state, from, to) {
    if (!state.tools.trowel) return "You're out of Trowel uses.";
    if (!FP.isFree(state, to.x, to.y)) return "That plot isn't empty.";
    state.plots[to.y][to.x] = state.plots[from.y][from.x];
    state.plots[from.y][from.x] = null;
    spendTool(state, "trowel");
    return null;
  };
})(window.FP);
