// Creating, saving, and loading the game state.
(function (FP) {
  const SAVE_KEY = "fancyPlants.save";
  const SAVE_VERSION = 5;

  const newStats = () => ({ planted: 0, harvested: 0, earned: 0, modsGained: 0, hired: 0, best: 0, byRarity: [0, 0, 0, 0, 0] });

  FP.newState = function () {
    return {
      version: SAVE_VERSION,
      coins: FP.START.coins,
      cols: FP.START.cols,
      rows: FP.START.rows,
      plots: FP.makeGrid(FP.START.cols, FP.START.rows), // plots[y][x] is a plant or null
      seeds: Object.assign({}, FP.START.seeds),         // seed id to count
      harvest: [],                                      // { seedId, value, mods } waiting to be sold
      shop: { stock: [], nextRefresh: 0 },
      toolShop: { stock: [], nextRefresh: 0 },          // { id, left }
      workerShop: { stock: [], nextRefresh: 0 },        // { id, left }
      tools: {},                                        // tool id to uses left
      upgrades: {},                                     // upgrade id to level
      weather: { id: "clear", endsAt: Date.now() + FP.WEATHER_TIMES.firstClear * 1000 },
      discovered: {},                                   // modifier ids the player has seen
      buildings: [],                                    // placed worker buildings { uid, workerId, x, y, level, lastWork }
      workerBag: [],                                    // bought or picked up buildings { workerId, level }
      stats: newStats(),
      goalsClaimed: {},                                 // goal id to true
      tutorial: 0,                                      // step of the first time tutorial, or -1 when done
    };
  };

  FP.save = function (state) {
    try {
      state.savedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.warn("Saving failed", err);
      return false;
    }
  };

  // Returns null when there is no save or it can't be read, so the caller starts fresh.
  FP.load = function () {
    let raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (err) { return null; }
    if (!raw) return null;
    try {
      return sanitize(migrate(JSON.parse(raw)));
    } catch (err) {
      console.warn("Save could not be read", err);
      return null;
    }
  };

  FP.clearSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* nothing to clear */ }
  };

  // Each save format change gets a step here that upgrades the old data.
  // Version 2 added modifiers, tools, upgrades, and weather. Version 3 added workers.
  // Version 4 added goals, more stats, and the tutorial. Version 5 added tool and worker restocks.
  // sanitize fills new fields in with defaults, so older saves need nothing extra.
  function migrate(data) {
    if (!data || typeof data !== "object") throw new Error("Save is not an object");
    data.version = SAVE_VERSION;
    return data;
  }

  const cleanMods = mods => (Array.isArray(mods) ? mods.filter(id => FP.MODS[id]) : []);

  function cleanCounts(obj, valid, max) {
    const out = {};
    for (const id in obj || {}) {
      const n = Math.floor(num(obj[id], 0));
      if (valid[id] && n > 0) out[id] = max ? Math.min(n, max(id)) : n;
    }
    return out;
  }

  const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
  const intIn = (v, lo, hi, fallback) => FP.clamp(Math.round(num(v, fallback)), lo, hi);

  function cleanPlant(p) {
    if (!p || !FP.SEED_BY_ID[p.seedId]) return null;
    if (!Number.isFinite(p.plantedAt) || !Number.isFinite(p.growMs) || p.growMs <= 0) return null;
    return { seedId: p.seedId, plantedAt: p.plantedAt, growMs: p.growMs, harvests: num(p.harvests, 0), mods: cleanMods(p.mods) };
  }

  // Rebuilds the state from scratch and copies over only values that make sense.
  // A broken or hand edited save can't crash the game this way.
  function sanitize(d) {
    const s = FP.newState();
    s.coins = Math.max(0, num(d.coins, s.coins));
    s.cols = intIn(d.cols, FP.START.cols, FP.MAX_COLS, FP.START.cols);
    s.rows = intIn(d.rows, FP.START.rows, FP.MAX_ROWS, FP.START.rows);
    s.plots = FP.makeGrid(s.cols, s.rows, (x, y) => cleanPlant(d.plots && d.plots[y] && d.plots[y][x]));

    s.seeds = cleanCounts(d.seeds, FP.SEED_BY_ID);
    s.tools = cleanCounts(d.tools, FP.TOOL_BY_ID);
    s.upgrades = cleanCounts(d.upgrades, FP.UPGRADE_BY_ID, id => FP.UPGRADE_BY_ID[id].max);
    s.discovered = {};
    for (const id in d.discovered || {}) if (FP.MODS[id]) s.discovered[id] = true;
    if (d.weather && FP.WEATHER_BY_ID[d.weather.id] && Number.isFinite(d.weather.endsAt)) {
      s.weather = { id: d.weather.id, endsAt: d.weather.endsAt };
    }

    s.harvest = (Array.isArray(d.harvest) ? d.harvest : [])
      .filter(item => item && FP.SEED_BY_ID[item.seedId] && Number.isFinite(item.value) && item.value >= 0)
      .map(item => ({ seedId: item.seedId, value: item.value, mods: cleanMods(item.mods) }));

    if (d.shop && Array.isArray(d.shop.stock)) {
      s.shop.stock = d.shop.stock
        .filter(slot => slot && FP.SEED_BY_ID[slot.seedId])
        .map(slot => ({ seedId: slot.seedId, left: Math.max(0, Math.floor(num(slot.left, 0))) }));
      s.shop.nextRefresh = num(d.shop.nextRefresh, 0);
    }

    const level = v => intIn(v, 1, FP.WORKER_MAX_LEVEL, 1);
    const now = Date.now();
    (Array.isArray(d.buildings) ? d.buildings : []).forEach(b => {
      if (!b || !FP.WORKER_BY_ID[b.workerId]) return;
      const x = Math.round(num(b.x, -1)), y = Math.round(num(b.y, -1));
      // Skip buildings that are off the farm or on top of a plant or another building.
      if (x < 0 || y < 0 || x >= s.cols || y >= s.rows || s.plots[y][x]) return;
      if (s.buildings.some(o => o.x === x && o.y === y)) return;
      s.buildings.push({ uid: String(b.uid || Math.random().toString(36).slice(2, 10)), workerId: b.workerId, x, y, level: level(b.level), lastWork: now });
    });
    s.workerBag = (Array.isArray(d.workerBag) ? d.workerBag : [])
      .filter(w => w && FP.WORKER_BY_ID[w.workerId])
      .map(w => ({ workerId: w.workerId, level: level(w.level) }));

    for (const [key, valid] of [["toolShop", FP.TOOL_BY_ID], ["workerShop", FP.WORKER_BY_ID]]) {
      const shop = d[key];
      if (!shop || !Array.isArray(shop.stock)) continue;
      s[key].stock = shop.stock.filter(x => x && valid[x.id]).map(x => ({ id: x.id, left: Math.max(0, Math.floor(num(x.left, 0))) }));
      s[key].nextRefresh = num(shop.nextRefresh, 0);
    }

    const st = d.stats || {};
    for (const key in s.stats) {
      if (key === "byRarity") s.stats.byRarity = s.stats.byRarity.map((n, i) => num(st.byRarity && st.byRarity[i], 0));
      else s.stats[key] = num(st[key], 0);
    }
    // Older saves didn't count hires, so count the buildings they already have.
    if (!st.hired) s.stats.hired = s.buildings.length + s.workerBag.length;
    s.goalsClaimed = {};
    for (const id in d.goalsClaimed || {}) s.goalsClaimed[id] = true;
    // Saves from before the tutorial existed skip it.
    s.tutorial = Math.round(num(d.tutorial, -1));
    s.savedAt = num(d.savedAt, 0);
    return s;
  }
})(window.FP);
