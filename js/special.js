// Special plants and the things they need: special tiles, fertilizer, room for big plants,
// and the Green House. Also the Seed Shop quests that unlock them, and the Picket Fence.
(function (FP) {
  // ---------- Data ----------

  // needs says what a seed needs to grow:
  //   tile: it can only be planted on that special tile
  //   feed: it waits as a sprout until it gets Fertilizer
  //   size: it covers size by size plots
  //   temp and humid: it only grows in a Green House set to those
  FP.SPECIAL_SEEDS = [
    { id: "cactus",  name: "Cactus Pear",  plural: "Cactus Pears",  rarity: 1, price: 600,   value: 140,   grow: 60,  regrow: 45,  shape: "cactus", color: "#e2557a",
      needs: { tile: "sand" }, special: true },
    { id: "lotus",   name: "Lotus",        plural: "Lotuses",       rarity: 2, price: 3000,  value: 520,   grow: 90,  regrow: 60,  shape: "lotus",  color: "#f59ac0",
      needs: { tile: "water" }, special: true },
    { id: "truffle", name: "Truffle Root", plural: "Truffle Roots", rarity: 2, price: 2500,  value: 2400,  grow: 100, regrow: 0,   shape: "truffle", color: "#6b4a32",
      needs: { feed: true }, special: true },
    { id: "giantpumpkin", name: "Giant Pumpkin", plural: "Giant Pumpkins", rarity: 3, price: 12000, value: 30000, grow: 300, regrow: 0, shape: "pumpkin", color: "#f07f1a",
      needs: { size: 2 }, special: true },
    { id: "orchid",  name: "Frost Orchid", plural: "Frost Orchids", rarity: 3, price: 15000, value: 4200,  grow: 180, regrow: 120, shape: "flower", color: "#a8e0ff",
      needs: { temp: 0, humid: 2 }, special: true },
    { id: "ember",   name: "Ember Pepper", plural: "Ember Peppers", rarity: 3, price: 15000, value: 4600,  grow: 170, regrow: 120, shape: "pepper", color: "#ff5a1f",
      needs: { temp: 3, humid: 0 }, special: true },
  ];
  FP.SPECIAL_SEEDS.forEach(seed => { FP.SEED_BY_ID[seed.id] = seed; });
  FP.ALL_SEEDS = FP.SEEDS.concat(FP.SPECIAL_SEEDS);

  // The Seed Shop owner asks for a delivery before each special seed goes on sale.
  // seed is the crop wanted (or null for any crop), and mods lists modifiers that count.
  FP.QUESTS = {
    cactus:       { text: "Bring me 15 Carrots.",                     seed: "carrot",  mods: null,                 count: 15 },
    lotus:        { text: "Bring me 5 crops that are Wet.",           seed: null,      mods: ["wet"],              count: 5 },
    truffle:      { text: "Bring me 10 Potatoes.",                    seed: "potato",  mods: null,                 count: 10 },
    giantpumpkin: { text: "Bring me 3 Pumpkins.",                     seed: "pumpkin", mods: null,                 count: 3 },
    orchid:       { text: "Bring me 3 crops that are Chilled or Frozen.", seed: null,  mods: ["chilled", "frozen"], count: 3 },
    ember:        { text: "Bring me 5 crops that are Heated.",        seed: null,      mods: ["heated"],           count: 5 },
  };

  FP.TILES = {
    sand:  { name: "Sand",  kit: "Sand Kit",  price: 2000, color: "#ecd59a", desc: "Turns a plot into sand. Cactus Pears need it, and other plants grow there too." },
    water: { name: "Water", kit: "Water Kit", price: 4000, color: "#5aa9e6", desc: "Turns a plot into a little pond. Only water plants like the Lotus can grow there." },
  };

  FP.FENCE_PRICE = 600;
  FP.GREENHOUSE_PRICE = 25000;
  FP.TEMPS = ["Cold", "Cool", "Warm", "Hot"];
  FP.HUMIDS = ["Dry", "Normal", "Humid"];

  // The Green House is a building with no worker inside, so it never does a job.
  FP.WORKERS.push({
    id: "greenhouse", name: "Green House", building: "Green House", rarity: 2, price: FP.GREENHOUSE_PRICE,
    every: [3600, 3600, 3600], range: [0, 0, 0], noShop: true, noUpgrade: true,
    desc: "Has room for 9 plants inside, sheltered from the weather. You can set the temperature and humidity, which some plants need.",
  });
  FP.WORKER_BY_ID.greenhouse = FP.WORKERS[FP.WORKERS.length - 1];
  FP.WORKER_LEVEL.greenhouse = 1;

  // ---------- Growing that can pause ----------

  // A paused plant stops growing. Plants that need fertilizer start paused, and Green House
  // plants pause when the temperature or humidity is wrong for them.
  FP.pausePlant = function (plant, now) {
    if (!plant.pausedAt) plant.pausedAt = now;
  };
  FP.resumePlant = function (plant, now) {
    if (!plant.pausedAt) return;
    plant.plantedAt += now - plant.pausedAt;
    plant.pausedAt = null;
  };

  FP.feedPlant = function (plant, now) {
    if (!plant.needsFeed) return false;
    plant.needsFeed = false;
    FP.resumePlant(plant, now);
    return true;
  };

  // ---------- Where things are ----------

  FP.plantSize = plant => (FP.SEED_BY_ID[plant.seedId].needs || {}).size || 1;

  FP.tileAt = (state, x, y) => (state.tiles && state.tiles[y] ? state.tiles[y][x] : null);

  // The plant covering a plot, and the plot its top left corner is on.
  // Big plants are stored once, at their top left corner.
  FP.occupantAt = function (state, x, y) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const ax = x - dx, ay = y - dy;
        if (ax < 0 || ay < 0) continue;
        const plant = state.plots[ay] && state.plots[ay][ax];
        if (!plant) continue;
        const size = FP.plantSize(plant);
        if (dx < size && dy < size) return { plant, x: ax, y: ay };
      }
    }
    return null;
  };

  // Checks whether a seed fits here. Returns { error } or { x, y } for its top left corner.
  // Big plants slide up and left to fit when clicked near the edge of the farm.
  FP.fitSeed = function (state, seed, x, y) {
    const needs = seed.needs || {};
    if (needs.temp !== undefined) return { error: "The " + seed.name + " only grows inside a Green House." };
    const size = needs.size || 1;
    const ax = Math.min(x, state.cols - size), ay = Math.min(y, state.rows - size);
    if (ax < 0 || ay < 0) return { error: "The farm is too small for a " + seed.name + "." };
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = ax + dx, cy = ay + dy;
        if (!FP.isFree(state, cx, cy)) return { error: size > 1 ? "The " + seed.name + " needs " + size + " by " + size + " empty plots." : "Something is already there." };
        const tile = FP.tileAt(state, cx, cy);
        if (needs.tile && tile !== needs.tile) return { error: "The " + seed.name + " has to be planted on " + FP.TILES[needs.tile].name.toLowerCase() + "." };
        if (!needs.tile && tile === "water") return { error: "Only water plants can grow in a pond." };
        if (size > 1 && tile) return { error: "The " + seed.name + " needs plain soil." };
      }
    }
    return { x: ax, y: ay };
  };

  FP.newPlant = function (state, seed, now) {
    const plant = { seedId: seed.id, plantedAt: now, growMs: seed.grow * 1000 * FP.growthFactor(state), harvests: 0, mods: [] };
    if (seed.needs && seed.needs.feed) {
      plant.needsFeed = true;
      plant.pausedAt = now;
    }
    return plant;
  };

  // ---------- Tiles and fences ----------

  FP.applyTile = function (state, kind, x, y) {
    if (!state.tileKits[kind]) return "You're out of " + FP.TILES[kind].kit + "s.";
    if (!FP.isFree(state, x, y)) return "Tiles can only go on an empty plot.";
    if (FP.tileAt(state, x, y) === kind) return "That plot is already " + FP.TILES[kind].name.toLowerCase() + ".";
    state.tiles[y][x] = kind;
    state.tileKits[kind]--;
    if (!state.tileKits[kind]) delete state.tileKits[kind];
    return null;
  };

  // A fence goes around a plant so the Picker leaves it alone.
  FP.placeFence = function (state, x, y) {
    if (!state.fences) return "You're out of Picket Fences.";
    const occ = FP.occupantAt(state, x, y);
    if (!occ) return "Picket Fences go around a plant.";
    if (occ.plant.fenced) return "That plant already has a fence.";
    occ.plant.fenced = true;
    state.fences--;
    return null;
  };

  FP.removeFence = function (state, plant) {
    if (!plant.fenced) return false;
    plant.fenced = false;
    state.fences++;
    return true;
  };

  // ---------- Seed Shop ----------

  FP.specialUnlocked = (state, id) => !!state.special.unlocked[id];

  // Crops in the basket that count toward a quest. Crops that were bet at the Casino count too.
  FP.questItems = function (state, id) {
    const q = FP.QUESTS[id];
    return state.harvest.filter(item => (!q.seed || item.seedId === q.seed) && (!q.mods || item.mods.some(m => q.mods.includes(m))));
  };

  FP.turnInQuest = function (state, id) {
    const q = FP.QUESTS[id];
    if (FP.specialUnlocked(state, id)) return "You already finished that quest.";
    const items = FP.questItems(state, id).sort((a, b) => a.value - b.value).slice(0, q.count); // the cheapest ones go first
    if (items.length < q.count) return "You need " + (q.count - items.length) + " more for that quest.";
    state.harvest = state.harvest.filter(item => !items.includes(item));
    state.special.unlocked[id] = true;
    return null;
  };

  function pay(state, price) {
    if (state.coins < price) return "You need " + FP.formatCoins(price - state.coins) + " more coins for that.";
    state.coins -= price;
    return null;
  }

  FP.buySpecialSeed = function (state, id) {
    if (!FP.specialUnlocked(state, id)) return "Finish the quest for that seed first.";
    const err = pay(state, FP.SEED_BY_ID[id].price);
    if (err) return err;
    state.seeds[id] = (state.seeds[id] || 0) + 1;
    return null;
  };

  FP.buyTileKit = function (state, kind) {
    const err = pay(state, FP.TILES[kind].price);
    if (err) return err;
    state.tileKits[kind] = (state.tileKits[kind] || 0) + 1;
    return null;
  };

  FP.buyFence = function (state) {
    const err = pay(state, FP.FENCE_PRICE);
    if (err) return err;
    state.fences++;
    return null;
  };

  FP.buyGreenhouse = function (state) {
    const err = pay(state, FP.GREENHOUSE_PRICE);
    if (err) return err;
    state.workerBag.push({ workerId: "greenhouse", level: 1 });
    return null;
  };

  // ---------- Green House ----------

  FP.newGreenhouse = () => ({ plots: new Array(9).fill(null), temp: 2, humid: 1 });

  // True when a plant can grow with this Green House's settings. Ordinary plants grow in any setting.
  FP.ghSuits = function (gh, seed) {
    const n = seed.needs || {};
    return (n.temp === undefined || n.temp === gh.temp) && (n.humid === undefined || n.humid === gh.humid);
  };

  FP.ghPlant = function (state, b, i, seedId, now) {
    const seed = FP.SEED_BY_ID[seedId];
    const needs = seed.needs || {};
    if (!state.seeds[seedId]) return "You're out of " + seed.name + " seeds.";
    if (b.inner.plots[i]) return "Something is already growing there.";
    if (needs.tile || needs.size) return "The " + seed.name + " can't grow in a Green House.";
    state.seeds[seedId]--;
    if (state.seeds[seedId] <= 0) delete state.seeds[seedId];
    b.inner.plots[i] = FP.newPlant(state, seed, now);
    state.stats.planted++;
    FP.ghCheck(b, now);
    return null;
  };

  // Pauses or restarts each plant inside depending on the settings.
  FP.ghCheck = function (b, now) {
    b.inner.plots.forEach(plant => {
      if (!plant || plant.needsFeed) return;
      if (FP.ghSuits(b.inner, FP.SEED_BY_ID[plant.seedId])) FP.resumePlant(plant, now);
      else FP.pausePlant(plant, now);
    });
  };

  FP.greenhouseTick = function (state, now) {
    state.floors.forEach(f => f.buildings.forEach(b => { if (b.inner) FP.ghCheck(b, now); }));
  };
})(window.FP);
