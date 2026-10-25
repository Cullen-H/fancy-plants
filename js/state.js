// Creating, saving, and loading the game state.
(function (FP) {
  const SAVE_KEY = "fancyPlants.save";
  const SAVE_VERSION = 11;

  const newStats = () => ({ planted: 0, harvested: 0, earned: 0, runEarned: 0, modsGained: 0, hired: 0, best: 0, byRarity: [0, 0, 0, 0, 0] });

  FP.newState = function () {
    const state = {
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
      xp: 0,                                            // total XP this run; the farm level comes from it
      rebirth: { count: 0, gmo: 0, earnedGmo: 0, skills: {}, townSeen: false, townVisited: false },
      fountain: { coins: 0, tosses: 0 },                // coins tossed into the Town fountain, kept forever
      floor: 0,                                         // which floor of the farm is showing
      tiles: FP.makeGrid(FP.START.cols, FP.START.rows), // special tiles, like sand or water, or null
      special: { unlocked: {} },                        // special seeds unlocked through Seed Shop quests
      tileKits: {},                                     // tile kind to count
      fences: 0,                                        // Picket Fences waiting to be placed
      requests: [],                                     // Request Board notes, or { emptyUntil } for an empty spot
      attachments: [],                                  // attachments on corners of the floor that is showing { id, cx, cy }
      attachmentBag: {},                                // attachment id to count waiting to be placed
    };
    // Every floor has its own plots, buildings, and tiles. state.plots, state.buildings, and
    // state.tiles always point at the floor that is showing.
    state.floors = [{ plots: state.plots, buildings: state.buildings, tiles: state.tiles, attachments: state.attachments }];
    return state;
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
  // Version 6 added farm levels and rebirth. Version 7 added farm floors.
  // Version 8 added special seeds, tiles, the Green House, and Picket Fences.
  // Version 9 added the Request Board.
  // Version 10 turned the Second Floor and Third Floor skills into one Farm Floors skill.
  // Version 11 added heat, humidity, and attachments, and took out the Green House.
  // sanitize fills new fields in with defaults, so older saves need nothing extra.
  function migrate(data) {
    if (!data || typeof data !== "object") throw new Error("Save is not an object");
    const skills = data.rebirth && data.rebirth.skills;
    if (skills && (skills.floor2 || skills.floor3)) {
      skills.floors = (skills.floor2 ? 1 : 0) + (skills.floor3 ? 1 : 0);
      delete skills.floor2;
      delete skills.floor3;
    }
    data.version = SAVE_VERSION;
    return data;
  }

  // The Green House was taken out in version 11. Each one is refunded, and each plant
  // that was growing inside comes back as a seed.
  const OLD_GREENHOUSE_PRICE = 25000;
  function refundGreenhouse(refund, b) {
    refund.count++;
    ((b.inner && b.inner.plots) || []).forEach(p => { if (p && FP.SEED_BY_ID[p.seedId]) refund.seeds.push(p.seedId); });
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
    const plant = { seedId: p.seedId, plantedAt: p.plantedAt, growMs: p.growMs, harvests: num(p.harvests, 0), mods: cleanMods(p.mods) };
    if (Number.isFinite(p.pausedAt)) plant.pausedAt = p.pausedAt;
    if (p.needsFeed === true) plant.needsFeed = true;
    if (p.fenced === true) plant.fenced = true;
    if (plant.mods.includes(p.sealed)) plant.sealed = p.sealed;
    if (Number.isInteger(p.variant) && FP.BERRY_COLORS[p.variant]) plant.variant = p.variant;
    return plant;
  }

  // Rebuilds the state from scratch and copies over only values that make sense.
  // A broken or hand edited save can't crash the game this way.
  function sanitize(d) {
    const s = FP.newState();
    s.coins = Math.max(0, num(d.coins, s.coins));
    const biggest = FP.FARM_SIZES[FP.FARM_SIZES.length - 1];
    s.cols = intIn(d.cols, FP.START.cols, biggest[0], FP.START.cols);
    s.rows = intIn(d.rows, FP.START.rows, biggest[1], FP.START.rows);

    s.seeds = cleanCounts(d.seeds, FP.SEED_BY_ID);
    s.tools = cleanCounts(d.tools, FP.TOOL_BY_ID);
    s.upgrades = cleanCounts(d.upgrades, FP.UPGRADE_BY_ID, id => FP.UPGRADE_BY_ID[id].max);
    s.discovered = {};
    for (const id in d.discovered || {}) if (FP.MODS[id]) s.discovered[id] = true;
    if (d.weather && FP.WEATHER_BY_ID[d.weather.id] && Number.isFinite(d.weather.endsAt)) {
      s.weather = { id: d.weather.id, endsAt: d.weather.endsAt };
      if (FP.WEATHER_BY_ID[d.weather.forecast]) s.weather.forecast = d.weather.forecast;
    }

    s.harvest = (Array.isArray(d.harvest) ? d.harvest : [])
      .filter(item => item && FP.SEED_BY_ID[item.seedId] && Number.isFinite(item.value) && item.value >= 0)
      .map(item => {
        const clean = { seedId: item.seedId, value: item.value, mods: cleanMods(item.mods), bet: item.bet === true };
        if (Number.isInteger(item.variant) && FP.BERRY_COLORS[item.variant]) clean.variant = item.variant;
        return clean;
      });

    if (d.shop && Array.isArray(d.shop.stock)) {
      s.shop.stock = d.shop.stock
        .filter(slot => slot && FP.SEED_BY_ID[slot.seedId])
        .map(slot => ({ seedId: slot.seedId, left: Math.max(0, Math.floor(num(slot.left, 0))) }));
      s.shop.nextRefresh = num(d.shop.nextRefresh, 0);
    }

    const level = v => intIn(v, 1, FP.WORKER_MAX_LEVEL, 1);
    const now = Date.now();
    const cleanFloor = f => {
      const plots = FP.makeGrid(s.cols, s.rows, (x, y) => cleanPlant(f.plots && f.plots[y] && f.plots[y][x]));
      const tiles = FP.makeGrid(s.cols, s.rows, (x, y) => {
        const t = f.tiles && f.tiles[y] && f.tiles[y][x];
        return FP.TILES[t] ? t : null;
      });
      const buildings = [];
      (Array.isArray(f.buildings) ? f.buildings : []).forEach(b => {
        if (b && b.workerId === "greenhouse") return refundGreenhouse(refund, b);
        if (!b || !FP.WORKER_BY_ID[b.workerId]) return;
        const x = Math.round(num(b.x, -1)), y = Math.round(num(b.y, -1));
        // Skip buildings that are off the farm or on top of a plant or another building.
        if (x < 0 || y < 0 || x >= s.cols || y >= s.rows || plots[y][x]) return;
        if (buildings.some(o => o.x === x && o.y === y)) return;
        const clean = { uid: String(b.uid || Math.random().toString(36).slice(2, 10)), workerId: b.workerId, x, y, level: level(b.level), lastWork: now };
        buildings.push(clean);
      });
      const attachments = [];
      (Array.isArray(f.attachments) ? f.attachments : []).forEach(a => {
        if (!a || !FP.ATTACHMENTS[a.id]) return;
        const cx = Math.round(num(a.cx, -1)), cy = Math.round(num(a.cy, -1));
        if (cx < 0 || cy < 0 || cx > s.cols || cy > s.rows || attachments.some(o => o.cx === cx && o.cy === cy)) return;
        attachments.push({ id: a.id, cx, cy });
      });
      return { plots, buildings, tiles, attachments };
    };
    const refund = { count: 0, seeds: [] };
    // Saves from before floors had one set of plots and buildings at the top level.
    const floors = Array.isArray(d.floors) && d.floors.length ? d.floors.slice(0, FP.MAX_FLOORS) : [{ plots: d.plots, buildings: d.buildings }];
    s.floors = floors.map(f => cleanFloor(f || {}));
    FP.setFloor(s, intIn(d.floor, 0, s.floors.length - 1, 0));
    s.workerBag = (Array.isArray(d.workerBag) ? d.workerBag : [])
      .filter(w => {
        if (w && w.workerId === "greenhouse") refundGreenhouse(refund, w);
        return w && FP.WORKER_BY_ID[w.workerId];
      })
      .map(w => ({ workerId: w.workerId, level: level(w.level) }));
    s.attachmentBag = cleanCounts(d.attachmentBag, FP.ATTACHMENTS);
    s.special = { unlocked: {} };
    for (const id in (d.special && d.special.unlocked) || {}) if (FP.QUESTS[id]) s.special.unlocked[id] = true;
    s.tileKits = cleanCounts(d.tileKits, FP.TILES);
    s.fences = Math.max(0, Math.floor(num(d.fences, 0)));
    s.requests = (Array.isArray(d.requests) ? d.requests : []).slice(0, 4).map(r => {
      if (!r) return null;
      if (Number.isFinite(r.emptyUntil)) return { emptyUntil: r.emptyUntil };
      const okSeed = r.seedId === null || FP.SEED_BY_ID[r.seedId];
      const okMod = r.mod === null || FP.MODS[r.mod];
      if (typeof r.who !== "string" || !okSeed || !okMod || (!r.seedId && !r.mod) || !Number.isFinite(r.mult) || !Number.isFinite(r.expiresAt)) return null;
      return { who: r.who, why: String(r.why || "just because"), seedId: r.seedId, mod: r.mod, mult: r.mult, expiresAt: r.expiresAt };
    });

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
    if (!st.hired) s.stats.hired = s.floors.reduce((n, f) => n + f.buildings.length, 0) + s.workerBag.length;
    s.goalsClaimed = {};
    for (const id in d.goalsClaimed || {}) s.goalsClaimed[id] = true;
    // Saves from before the tutorial existed skip it.
    s.tutorial = Math.round(num(d.tutorial, -1));

    // Version 6 added levels. Older farms get XP for the crops they already harvested,
    // so nobody gets locked out of things they had.
    if (Number.isFinite(d.xp)) {
      s.xp = Math.max(0, d.xp);
    } else {
      const byRarity = s.stats.byRarity.reduce((sum, n, i) => sum + n * FP.HARVEST_XP[i], 0);
      s.xp = Math.max(byRarity, s.stats.harvested, s.stats.earned / 20);
    }
    if (!st.runEarned) s.stats.runEarned = s.stats.earned;
    const rb = d.rebirth || {};
    s.rebirth = {
      count: Math.max(0, Math.floor(num(rb.count, 0))),
      gmo: Math.max(0, Math.floor(num(rb.gmo, 0))),
      earnedGmo: Math.max(0, Math.floor(num(rb.earnedGmo, 0))),
      skills: {},
      townSeen: rb.townSeen === true,
      townVisited: rb.townVisited === true,
    };
    const fountain = d.fountain || {};
    s.fountain = { coins: Math.max(0, num(fountain.coins, 0)), tosses: Math.max(0, Math.floor(num(fountain.tosses, 0))) };
    for (const id in rb.skills || {}) {
      if (FP.SKILL_BY_ID[id]) s.rebirth.skills[id] = FP.clamp(Math.floor(num(rb.skills[id], 0)), 0, FP.SKILL_BY_ID[id].max);
    }
    s.savedAt = num(d.savedAt, 0);
    if (refund.count) {
      s.coins += refund.count * OLD_GREENHOUSE_PRICE;
      refund.seeds.forEach(id => { s.seeds[id] = (s.seeds[id] || 0) + 1; });
      // Shown once when the game starts. It isn't part of the save.
      s.loadNotice = "The Green House is gone. Frost Orchids and Ember Peppers now grow on the farm when the plot has the right heat and humidity. You got " +
        FP.formatCoins(refund.count * OLD_GREENHOUSE_PRICE) + " coins back" + (refund.seeds.length ? " and a seed for each plant that was inside." : ".");
    }
    return s;
  }
})(window.FP);
