// Worker rules. A worker lives inside its building, and the building sits on one plot.
// Every worker type has one work function that gets the same inputs: (state, building, now).
// Work happens on grid positions, so it doesn't matter what is on screen.
// Work functions return events that only tell the renderer what to animate.
(function (FP) {
  // ---------- Where things are ----------

  FP.buildingAt = (state, x, y) => state.buildings.find(b => b.x === x && b.y === y) || null;

  FP.isFree = (state, x, y) => !state.plots[y][x] && !FP.buildingAt(state, x, y);

  const workerDef = b => FP.WORKER_BY_ID[b.workerId];
  const stat = (b, list) => list[b.level - 1];

  // Plants within range plots of the building, counting diagonals.
  FP.plantsInRange = function (state, b, range) {
    const found = [];
    for (let y = Math.max(0, b.y - range); y <= Math.min(state.rows - 1, b.y + range); y++) {
      for (let x = Math.max(0, b.x - range); x <= Math.min(state.cols - 1, b.x + range); x++) {
        const plant = state.plots[y][x];
        if (plant) found.push({ x, y, plant });
      }
    }
    return found;
  };

  FP.workerRange = b => stat(b, workerDef(b).range);
  FP.workerEvery = b => stat(b, workerDef(b).every);

  // Pushes a growing plant closer to ripe. Returns false if it was already ripe.
  FP.growBy = function (plant, share, now) {
    if (FP.isRipe(plant, now)) return false;
    plant.plantedAt = Math.max(plant.plantedAt - plant.growMs * share, now - plant.growMs);
    return true;
  };

  // ---------- Buying and placing ----------

  const ownedCount = (state, id) =>
    state.buildings.filter(b => b.workerId === id).length + state.workerBag.filter(w => w.workerId === id).length;

  // Each extra copy of the same worker costs more than the last.
  FP.workerPrice = (state, id) => Math.round(FP.WORKER_BY_ID[id].price * Math.pow(1.6, ownedCount(state, id)) / 10) * 10;

  FP.buyWorker = function (state, id) {
    const def = FP.WORKER_BY_ID[id];
    if (!def) return "That worker doesn't exist.";
    const price = FP.workerPrice(state, id);
    if (state.coins < price) return "You need " + FP.formatCoins(price - state.coins) + " more coins to hire them.";
    state.coins -= price;
    state.workerBag.push({ workerId: id, level: 1 });
    return null;
  };

  // Places the highest level building of this kind from the bag.
  FP.placeBuilding = function (state, workerId, x, y, now) {
    const options = state.workerBag.filter(w => w.workerId === workerId).sort((a, b) => b.level - a.level);
    if (!options.length) return "You don't have a " + FP.WORKER_BY_ID[workerId].building + " to place.";
    if (!FP.isFree(state, x, y)) return "Buildings need an empty plot.";
    const chosen = options[0];
    state.workerBag.splice(state.workerBag.indexOf(chosen), 1);
    state.buildings.push({
      uid: Math.random().toString(36).slice(2, 10),
      workerId, x, y, level: chosen.level, lastWork: now,
    });
    return null;
  };

  // Puts a building back in the bag. It keeps its level.
  FP.pickUpBuilding = function (state, b) {
    state.buildings = state.buildings.filter(other => other !== b);
    state.workerBag.push({ workerId: b.workerId, level: b.level });
  };

  FP.buildingUpgradeCost = b => Math.round(workerDef(b).price * 0.8 * b.level / 10) * 10;

  FP.upgradeBuilding = function (state, b) {
    if (b.level >= FP.WORKER_MAX_LEVEL) return "This building is already at its highest level.";
    const cost = FP.buildingUpgradeCost(b);
    if (state.coins < cost) return "You need " + FP.formatCoins(cost - state.coins) + " more coins for that.";
    state.coins -= cost;
    b.level++;
    return null;
  };

  // ---------- Jobs ----------

  function tryMod(state, plant, modId, chance) {
    if (Math.random() >= chance) return null;
    return FP.addMod(state, plant, modId);
  }

  const WORK = {
    // Waters the growing plant in range that is furthest from ripe.
    waterer(state, b, now) {
      const def = workerDef(b);
      const growing = FP.plantsInRange(state, b, FP.workerRange(b)).filter(p => !FP.isRipe(p.plant, now));
      if (!growing.length) return [];
      growing.sort((p, q) => FP.growPercent(p.plant, now) - FP.growPercent(q.plant, now));
      const target = growing[0];
      FP.growBy(target.plant, def.grow, now);
      return [{ kind: "walk", x: target.x, y: target.y, action: "water" }];
    },

    // Harvests one ripe plant in range.
    picker(state, b, now) {
      const ripe = FP.plantsInRange(state, b, FP.workerRange(b)).filter(p => FP.isRipe(p.plant, now));
      if (!ripe.length) return [];
      const target = ripe[Math.floor(Math.random() * ripe.length)];
      const item = FP.harvestPlot(state, target.x, target.y, now);
      return [{ kind: "walk", x: target.x, y: target.y, action: "pick", seedId: item.seedId }];
    },

    // Grows every plant in range a little and may give each one the worker's modifier.
    cultivator(state, b, now) {
      const def = workerDef(b);
      const touched = FP.plantsInRange(state, b, FP.workerRange(b));
      if (!touched.length) return [];
      const gains = [];
      touched.forEach(p => {
        FP.growBy(p.plant, def.grow, now);
        const result = tryMod(state, p.plant, def.mod, stat(b, def.chance));
        if (result) gains.push({ x: p.x, y: p.y, modId: def.mod, result });
      });
      return [{ kind: "pulse", gains }];
    },

    // One bee visits one plant in range.
    beekeeper(state, b, now) {
      const def = workerDef(b);
      const plants = FP.plantsInRange(state, b, FP.workerRange(b));
      if (!plants.length) return [];
      const growing = plants.filter(p => !FP.isRipe(p.plant, now));
      const pool = growing.length ? growing : plants;
      const target = pool[Math.floor(Math.random() * pool.length)];
      FP.growBy(target.plant, def.grow, now);
      const result = tryMod(state, target.plant, def.mod, stat(b, def.chance));
      return [{ kind: "bee", x: target.x, y: target.y, gain: result ? { modId: def.mod, result } : null }];
    },
  };
  WORK.shadow = WORK.cultivator; // same job, stronger numbers and a different modifier

  // Runs every building whose timer is up. Workers only work while the game is open,
  // so a building that was waiting a long time does one job, not hundreds.
  FP.runWorkers = function (state, now, onEvent) {
    for (const b of state.buildings) {
      if (now - b.lastWork < FP.workerEvery(b) * 1000) continue;
      b.lastWork = now;
      WORK[b.workerId](state, b, now).forEach(event => onEvent(b, event));
    }
  };
})(window.FP);
