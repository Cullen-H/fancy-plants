// Special plants and the things they need: special tiles, fertilizer, room for big plants,
// Also the Seed Shop quests that unlock them, and the Picket Fence.
(function (FP) {
  // ---------- Data ----------

  // needs says what a seed needs to grow:
  //   tile: it can only be planted on that special tile
  //   feed: it waits as a sprout until it gets Fertilizer
  //   size: it covers size by size plots
  //   heat and humid: it only grows on a plot with that heat and humidity (see climate.js)
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
      needs: { heat: -2, humid: 1 }, special: true },
    { id: "rice",    name: "Goddess Rice", plural: "Goddess Rice",  rarity: 3, price: 9000,  value: 1400,  grow: 150, regrow: 100, shape: "rice",   color: "#f2d16b",
      needs: { tile: "water", heat: 1 }, rowBonus: 0.15, special: true, rebirth: 3 },
    { id: "swirlfruit", name: "Swirlfruit", plural: "Swirlfruits",  rarity: 3, price: 20000, value: 6500,  grow: 220, regrow: 160, shape: "tree",   color: "#9b59f0", fruit: "swirl",
      needs: { heat: 2, humid: 1 }, noMods: ["wet", "soaked"], luckBoost: 3, special: true, rebirth: 3 },
    { id: "worldtree", name: "World Tree Sapling", plural: "World Tree Saplings", rarity: 4, price: 300000, value: 150000, grow: 900, regrow: 600, shape: "worldtree", color: "#6fd17a",
      needs: { size: 3 }, special: true, rebirth: 3 },
    { id: "bloom",   name: "Philosopher's Bloom", plural: "Philosopher's Blooms", rarity: 4, price: 120000, value: 1500, grow: 300, regrow: 200, shape: "bloom", color: "#c0392b",
      transmute: true, special: true, rebirth: 3 },
    { id: "ember",   name: "Ember Pepper", plural: "Ember Peppers", rarity: 3, price: 15000, value: 4600,  grow: 170, regrow: 120, shape: "pepper", color: "#ff5a1f",
      needs: { heat: 2, humid: -1 }, special: true },
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
    rice:         { text: "Bring me 5 Lotuses.",                      seed: "lotus",   mods: null,                 count: 5 },
    swirlfruit:   { text: "Bring me 5 Ember Peppers.",                seed: "ember",   mods: null,                 count: 5 },
    worldtree:    { text: "Bring me 3 Giant Pumpkins.",               seed: "giantpumpkin", mods: null,            count: 3 },
    bloom:        { text: "Bring me 3 crops that are Golden.",        seed: null,      mods: ["golden"],           count: 3 },
  };

  FP.TILES = {
    sand:  { name: "Sand",  kit: "Sand Kit",  price: 2000, color: "#ecd59a", desc: "Turns a plot into sand. Cactus Pears need it, and other plants grow there too." },
    water: { name: "Water", kit: "Water Kit", price: 4000, color: "#5aa9e6", desc: "Turns a plot into a little pond. Only water plants like the Lotus can grow there." },
  };

  FP.FENCE_PRICE = 600;

  // ---------- Growing that can pause ----------

  // A paused plant stops growing. Plants that need fertilizer start paused, and plants
  // pause when their plot is the wrong heat or humidity for them.
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
    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
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
    if (seed.variants) plant.variant = FP.randInt(0, FP.BERRY_COLORS.length - 1);
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

  // True when a Picket Fence is standing anywhere on the farm.
  FP.fencesPlaced = state => state.floors.some(f => f.plots.some(row => row.some(p => p && p.fenced)));

  // A fence goes around a plant so the Picker and Harvest All leave it alone.
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

  // Seeds that need a few rebirths before the Seed Shop owner will talk about them.
  FP.rebirthReady = (state, seed) => !seed.rebirth || state.rebirth.count >= seed.rebirth;

  FP.turnInQuest = function (state, id) {
    const q = FP.QUESTS[id];
    if (FP.specialUnlocked(state, id)) return "You already finished that quest.";
    if (!FP.rebirthReady(state, FP.SEED_BY_ID[id])) return "That seed isn't ready yet.";
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

})(window.FP);
