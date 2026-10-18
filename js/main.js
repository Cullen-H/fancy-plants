// Starts the game, handles input, and runs the loop.
(function (FP) {
  const AUTOSAVE_MS = 15000;

  let state = FP.load();
  const firstVisit = !state;
  if (!state) state = FP.newState();

  // carrying is the plot a trowel lifted a plant from, while you pick where it goes.
  const view = { hover: null, mouse: null, tool: null, pendingDig: null, carrying: null };
  const ui = FP.ui;
  const toast = (msg, special) => ui.toast(msg, special);
  const fail = msg => {
    FP.sfx("error");
    toast(msg);
  };
  const tutorial = FP.tutorial;

  const game = FP.game = {
    get state() { return state; },
    action(name, data, el) {
      if (actions[name]) actions[name](data || {}, el);
    },
    toast: msg => toast(msg),
    // Putting the trowel away drops whatever it was carrying back where it was.
    onToolChange() {
      view.carrying = null;
    },
  };

  // ---------- Actions from the menus ----------

  function coinsChanged() {
    ui.bumpCoins();
    ui.renderPanel(); // prices turn gray or gold depending on what you can afford
    if (ui.selected) ui.renderPopup();
  }

  // Sends a handful of coins from a button up to the coin counter.
  function flyCoins(el, count) {
    const from = el ? FP.renderer.centerOf(el) : { x: 1090, y: 200 };
    const to = ui.coinTarget();
    const n = FP.clamp(count, 3, 14);
    ui.holdCoinsUntil = Date.now() + 550;
    for (let i = 0; i < n; i++) {
      FP.fx.fly({
        from: { x: from.x + (Math.random() - 0.5) * 60, y: from.y + (Math.random() - 0.5) * 16 },
        to, delay: i * 0.045, dur: 0.55, lift: 60 + Math.random() * 60,
        draw: FP.drawCoin, size: 1.1, endSize: 0.8,
        onArrive: () => {
          ui.bumpCoins();
          FP.sfx("coin");
        },
      });
    }
  }

  // A bought item drops from the shop into its slot in the seed bar.
  function flyToSlot(from, type, id, draw) {
    const slotEl = ui.slotFor(type, id);
    if (!from || !slotEl) return;
    FP.fx.fly({
      from, to: FP.renderer.centerOf(slotEl), dur: 0.6, lift: 80,
      draw, size: 0.9, endSize: 0.7,
      onArrive: () => ui.pulseSlot(type, id),
    });
  }

  const actions = {
    buy(d, el) {
      const slot = state.shop.stock[Number(d.index)];
      const err = FP.buySeed(state, Number(d.index));
      if (err) return fail(err);
      const seed = FP.SEED_BY_ID[slot.seedId];
      const from = el && FP.renderer.centerOf(el); // measured now, because the menu is about to redraw
      toast("You bought " + FP.withArticle(seed.name) + " seed.");
      FP.sfx("buy");
      tutorial.on("buySeed");
      if (!ui.tool) ui.tool = { type: "seed", seedId: seed.id };
      coinsChanged();
      ui.renderHotbar();
      flyToSlot(from, "seed", seed.id, FP.drawIcon(seed));
    },

    buyTool(d, el) {
      const tool = FP.TOOL_BY_ID[d.id];
      const err = FP.buyTool(state, d.id);
      if (err) return fail(err);
      const from = el && FP.renderer.centerOf(el);
      toast("You bought " + FP.withArticle(tool.name) + ".");
      FP.sfx("buy");
      coinsChanged();
      ui.renderHotbar();
      const img = new Image();
      img.src = FP.toolIconURL(tool);
      flyToSlot(from, "tool", tool.id, (ctx, x, y, size) => ctx.drawImage(img, x - 26 * size, y - 26 * size, 52 * size, 52 * size));
    },

    hire(d, el) {
      const def = FP.WORKER_BY_ID[d.id];
      const err = FP.buyWorker(state, d.id);
      if (err) return fail(err);
      const from = el && FP.renderer.centerOf(el);
      FP.sfx("buy");
      toast("You bought " + FP.withArticle(def.building) + ". Place it on an empty plot.");
      ui.tool = { type: "building", workerId: def.id };
      coinsChanged();
      ui.renderHotbar();
      const img = new Image();
      img.src = FP.buildingIconURL(def);
      flyToSlot(from, "building", def.id, (ctx, x, y, size) => ctx.drawImage(img, x - 26 * size, y - 26 * size, 52 * size, 52 * size));
    },

    upgradeBuilding(d) {
      const b = state.buildings.find(other => other.uid === d.uid);
      if (!b) return;
      const err = FP.upgradeBuilding(state, b);
      if (err) return fail(err);
      const r = FP.plotRect(FP.layout(state), b.x, b.y);
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.4, "#ffd23f", 16, 0.9);
      toast("The " + FP.WORKER_BY_ID[b.workerId].building + " is now level " + b.level + ".");
      FP.sfx("goal");
      coinsChanged();
    },

    pickUp(d) {
      const b = state.buildings.find(other => other.uid === d.uid);
      if (!b) return;
      FP.pickUpBuilding(state, b);
      ui.closeBuilding();
      toast("The " + FP.WORKER_BY_ID[b.workerId].building + " is back in your bar. It kept its level.");
      ui.renderHotbar();
    },

    upgrade(d) {
      const u = FP.UPGRADE_BY_ID[d.id];
      const err = FP.buyUpgrade(state, d.id);
      if (err) return fail(err);
      toast(u.name + " is now level " + FP.upgradeLevel(state, d.id) + ".");
      FP.sfx("buy");
      coinsChanged();
    },

    sell(d, el) {
      const group = FP.harvestGroups(state).find(g => g.key === d.key);
      if (!group) return;
      const res = FP.sellGroup(state, d.key);
      flyCoins(el, res.count);
      tutorial.on("sell");
      toast("You sold " + FP.countOf(group.seed, res.count) + " for " + FP.formatCoins(res.coins) + " coins.");
      coinsChanged();
    },

    sellAll(d, el) {
      const res = FP.sellHarvest(state, null);
      if (!res.count) return;
      flyCoins(el, res.count);
      tutorial.on("sell");
      toast("You sold everything for " + FP.formatCoins(res.coins) + " coins.");
      coinsChanged();
    },

    expand() {
      const err = FP.expand(state);
      if (err) return fail(err);
      toast("Your farm is now " + state.cols + " by " + state.rows + ".");
      FP.sfx("goal");
      coinsChanged();
    },

    harvestAll() {
      const now = Date.now();
      const cells = FP.ripeCells(state, now);
      if (cells.length === 0) return fail("Nothing is ready to harvest yet.");
      cells.forEach((c, i) => harvestAt(c.x, c.y, now, i * 0.05, true));
      toast("You harvested " + cells.length + (cells.length === 1 ? " plant." : " plants."));
      tutorial.on("harvest");
      ui.refreshTab("sell");
    },

    claim(d, el) {
      const g = FP.GOAL_BY_ID[d.id];
      const from = el && FP.renderer.centerOf(el);
      const err = FP.claimGoal(state, d.id);
      if (err) return fail(err);
      FP.sfx("goal");
      toast("Goal reward: " + FP.rewardText(g.reward) + ".", true);
      if (g.reward.coins) flyCoins(el && el.isConnected ? el : null, 10);
      if (from) FP.fx.burst(from.x, from.y, "#ffd23f", 18, 0.9);
      coinsChanged();
      ui.renderHotbar();
    },

    tutorial() {
      tutorial.restart();
      toast("The tutorial will walk you through the basics again.");
    },

    save() {
      if (FP.save(state)) toast("Your farm has been saved.");
      else toast("The game couldn't save. Your browser might be blocking storage.");
    },

    reset() {
      if (!window.confirm("Start a new farm? Your current farm, coins, seeds, and skills will be erased.")) return;
      FP.clearSave();
      adoptState(FP.newState());
      toast("You have a brand new farm.");
    },

    rebirth() {
      if (!FP.canRebirth(state)) return fail("Rebirth unlocks at level " + FP.REBIRTH_LEVEL + ".");
      const gmo = FP.gmoForRebirth(state);
      if (!window.confirm("Rebirth now? Your farm, coins, seeds, tools, upgrades, and buildings will be lost, and you will get " +
        gmo + " GMO " + (gmo === 1 ? "Point" : "Points") + ".")) return;
      // Copy the farm as it looks right now, so it can spin into the hole.
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d").drawImage(canvas, 0, 0);
      FP.sfx("rebirth");
      const result = FP.rebirth(state, Date.now());
      adoptState(result.state);
      FP.blackHole.show(snapshot, result.gmo);
    },

    voidArrived(d) {
      FP.sfx("goal");
      toast("You got " + d.gmo + " GMO " + (d.gmo === 1 ? "Point" : "Points") + ". Spend them on skills around the black hole.", true);
    },

    openVoid() {
      FP.blackHole.show(null, 0);
    },

    closeVoid() {
      FP.blackHole.hide();
      ui.refresh();
      maybeStartTownIntro(1000);
    },

    // Test tools only: puts the sign away so the cutscene can play again.
    replayTownIntro() {
      if (FP.town.open) actions.closeTown();
      state.rebirth.townSeen = false;
      state.rebirth.townVisited = false;
      maybeStartTownIntro(800);
    },

    // dir is 1 to go up a floor and -1 to go down.
    floor(d) {
      const dir = Number(d.dir);
      const next = state.floor + dir;
      if (next < 0 || next >= state.floors.length) return;
      FP.setFloor(state, next);
      FP.renderer.forget();
      FP.renderer.floorSlide(dir);
      ui.closeBuilding();
      view.carrying = null;
      view.pendingDig = null;
      FP.sfx("click");
      ui.refresh();
    },

    // A crop harvested somewhere other than a farm plot, like the Green House.
    cropHarvested(d) {
      const seed = FP.SEED_BY_ID[d.seedId];
      FP.sfx("harvest");
      FP.fx.burst(Number(d.x), Number(d.y), seed.color, 10);
      FP.fx.fly({
        from: { x: Number(d.x), y: Number(d.y) }, to: FP.renderer.centerOf(document.querySelector('#tabs [data-tab="sell"]')),
        dur: 0.75, lift: 120, draw: FP.drawIcon(seed), size: 1, endSize: 0.45,
        onArrive: () => { ui.pulseTab("sell"); ui.refreshTab("sell"); },
      });
      tutorial.on("harvest");
    },

    openGreenhouse(d) {
      ui.closeBuilding();
      FP.greenhouseMenu.show(d.uid);
      FP.sfx("click");
    },

    openTown() {
      if (FP.renderer.introRunning()) return;
      state.rebirth.townVisited = true;
      ui.closeBuilding();
      FP.town.show();
      FP.sfx("click");
    },

    closeTown() {
      FP.town.hide();
      ui.refresh();
    },

    // A Town building changed the basket or the weather.
    townChanged() {
      ui.refreshTab("sell");
      ui.refreshTab("guide");
      FP.save(state);
    },

    buySkill(d) {
      const skill = FP.SKILL_BY_ID[d.id];
      const err = FP.buySkill(state, d.id);
      if (err) return fail(err);
      FP.sfx("fusion");
      toast(skill.name + " is now level " + FP.skillLevel(state, d.id) + ".");
      FP.blackHole.render();
      FP.save(state);
    },
  };

  // ---------- Clicking on the farm ----------

  // The crop jumps out of the plot and flies into the Sell tab.
  function harvestAt(x, y, now, delay = 0, quiet = false) {
    const item = FP.harvestPlot(state, x, y, now);
    if (!item) return false;
    FP.sfx("harvest");
    const seed = FP.SEED_BY_ID[item.seedId];
    const r = FP.plotRect(FP.layout(state), x, y);
    FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.5, seed.color, 10);
    // Bulk harvests skip the label, since a dozen of them at once just pile up.
    if (!quiet) FP.fx.text(r.x + r.s / 2, r.y + r.s * 0.3, "+1 " + seed.name, FP.shade(FP.RARITIES[seed.rarity].color, 0.45));
    const tab = document.querySelector('#tabs [data-tab="sell"]');
    FP.fx.fly({
      from: { x: r.x + r.s / 2, y: r.y + r.s * 0.45 }, to: FP.renderer.centerOf(tab),
      delay, dur: 0.75, lift: 120, draw: FP.drawIcon(seed), size: 1, endSize: 0.45,
      onArrive: () => ui.pulseTab("sell"),
    });
    return true;
  }

  let lastHint = 0;

  function useCell(cell, isDrag) {
    const now = Date.now();
    const { x, y } = cell;
    // Big plants cover several plots, so any of them counts as clicking the plant.
    // ax and ay are the plot the plant is stored on.
    const occ = FP.occupantAt(state, x, y);
    const plant = occ ? occ.plant : null;
    const ax = occ ? occ.x : x, ay = occ ? occ.y : y;
    const tool = ui.tool;
    const building = FP.buildingAt(state, x, y);

    if (tool && tool.type === "building" && !building) {
      if (isDrag) return;
      const def = FP.WORKER_BY_ID[tool.workerId];
      const err = FP.placeBuilding(state, tool.workerId, x, y, now);
      if (err) return fail(err);
      const r = FP.plotRect(FP.layout(state), x, y);
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.7, "#c9a26b", 14, 0.8);
      toast("The " + def.name + " moved into the " + def.building + ".");
      if (!state.workerBag.some(w => w.workerId === tool.workerId)) ui.tool = null;
      ui.renderHotbar();
      ui.openBuilding(FP.buildingAt(state, x, y).uid);
      return;
    }

    // Clicking a building opens its menu. Clicking it again closes it.
    if (building) {
      if (isDrag) return;
      if (ui.selected === building.uid) ui.closeBuilding();
      else ui.openBuilding(building.uid);
      return;
    }
    if (ui.selected && !isDrag) ui.closeBuilding();

    if (tool && tool.type === "tile") {
      if (isDrag && !FP.isFree(state, x, y)) return;
      const err = FP.applyTile(state, tool.id, x, y);
      if (err) return isDrag ? null : fail(err);
      const r = FP.plotRect(FP.layout(state), x, y);
      FP.fx.burst(r.x + r.s / 2, r.y + r.s / 2, FP.TILES[tool.id].color, 12, 0.7);
      FP.sfx(tool.id === "water" ? "splash" : "dig");
      if (!state.tileKits[tool.id]) ui.tool = null;
      ui.renderHotbar();
      return;
    }

    if (tool && tool.type === "fence") {
      if (isDrag) return;
      const err = FP.placeFence(state, x, y);
      if (err) return fail(err);
      FP.sfx("dig");
      toast("The Picker will leave this " + FP.SEED_BY_ID[plant.seedId].name + " alone now.");
      if (!state.fences) ui.tool = null;
      ui.renderHotbar();
      return;
    }

    if (tool && tool.type === "shovel") {
      if (!isDrag) dig(ax, ay, plant, now);
      return;
    }

    if (tool && tool.type === "tool") {
      useTool(tool.toolId, ax, ay, plant, now, isDrag);
      return;
    }

    if (plant) {
      if (harvestAt(ax, ay, now)) {
        ui.refreshTab("sell");
        tutorial.on("harvest");
      }
      return;
    }

    if (tool && tool.type === "seed") {
      const err = FP.plantSeed(state, x, y, tool.seedId, now);
      if (err) {
        if (!isDrag) fail(err);
        return;
      }
      const r = FP.plotRect(FP.layout(state), x, y);
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.72, "#7a4e2d", 6);
      FP.sfx("plant");
      tutorial.on("plant");
      if (!state.seeds[tool.seedId]) {
        ui.tool = null;
        toast("That was your last " + FP.SEED_BY_ID[tool.seedId].name + " seed.");
      }
      ui.renderHotbar();
      return;
    }

    // Clicked an empty plot with nothing in hand.
    if (!isDrag && now - lastHint > 4000) {
      lastHint = now;
      toast(Object.keys(state.seeds).length
        ? "Pick a seed from the bar below, then click an empty plot."
        : "You need seeds first. The shop on the right sells them.");
    }
  }

  function useTool(id, x, y, plant, now, isDrag) {
    const def = FP.TOOL_BY_ID[id];
    const r = FP.plotRect(FP.layout(state), x, y);

    if (id === "trowel") {
      if (isDrag) return;
      const from = view.carrying;
      if (!from) {
        if (!plant) return toast("Click a plant to lift it with the Trowel.");
        view.carrying = { x, y };
        return toast("Now click an empty plot to move the " + FP.SEED_BY_ID[plant.seedId].name + ".");
      }
      if (from.x === x && from.y === y) {
        view.carrying = null;
        return toast("You put the plant back.");
      }
      const moving = state.plots[from.y][from.x];
      const err = FP.movePlant(state, from, { x, y });
      if (err) return fail(err);
      view.carrying = null;
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.72, "#7a4e2d", 8);
      toast("You moved the " + FP.SEED_BY_ID[moving.seedId].name + ".");
      afterToolUse(id);
      return;
    }

    // The watering can and fertilizer can be dragged across a row. The others take one click each.
    if (isDrag && !def.grow) return;
    const res = FP.useTool(state, id, x, y, now);
    if (res.error) {
      if (!isDrag) fail(res.error);
      return;
    }
    if (res.fed) {
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.5, "#c9a26b", 14, 0.8);
      toast("The " + FP.SEED_BY_ID[plant.seedId].name + " has what it needs and started growing.");
    } else if (def.grow) {
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.4, id === "can" ? "#6fb7ff" : "#c9a26b", 9, 0.7);
    } else {
      celebrateMod(x, y, plant, res.modId, res.result);
    }
    afterToolUse(id);
  }

  function afterToolUse(id) {
    if (!state.tools[id]) {
      ui.tool = null;
      view.carrying = null;
      toast("That was the last use of your " + FP.TOOL_BY_ID[id].name + ".");
    }
    ui.renderHotbar();
  }

  // Sparkles and messages when a plant gains a modifier, a fusion, or a first time discovery.
  function celebrateMod(x, y, plant, modId, result) {
    const r = FP.plotRect(FP.layout(state), x, y);
    const cx = r.x + r.s / 2, cy = r.y + r.s * 0.4;
    const seed = FP.SEED_BY_ID[plant.seedId];
    const t = Date.now() / 1000;
    FP.fx.burst(cx, cy, FP.modColor(modId, t), 10, 0.7);
    FP.sfx(result.fused.length ? "fusion" : "mod");
    if (result.fused.length) {
      const top = result.fused[result.fused.length - 1];
      FP.fx.burst(cx, cy, FP.modColor(top, t), 22, 1.1);
      FP.fx.burst(cx, cy, "#ffffff", 10, 1.1);
      FP.fx.text(cx, cy - 10, FP.MODS[top].name + "!", FP.shade(FP.modColor(top, t), 0.3));
      const isNew = result.newFinds.includes(top);
      toast(isNew
        ? "New fusion found. Your " + seed.name + " became " + FP.MODS[top].name + "."
        : "Your " + seed.name + " became " + FP.MODS[top].name + ".", isNew);
      ui.refreshTab("guide");
    } else {
      FP.fx.text(cx, cy - 10, FP.MODS[modId].name, FP.shade(FP.modColor(modId, t), 0.3));
    }
  }

  // The shovel asks for a second click so a misclick can't destroy a plant.
  function dig(x, y, plant, now) {
    if (!plant) return toast("There's nothing planted here.");
    const seed = FP.SEED_BY_ID[plant.seedId];
    // A fence comes down first, and goes back in the bar.
    if (FP.removeFence(state, plant)) {
      FP.sfx("dig");
      ui.renderHotbar();
      return toast("You took the fence down. Click again with the shovel to dig up the " + seed.name + ".");
    }
    const p = view.pendingDig;
    if (p && p.x === x && p.y === y && now < p.until) {
      FP.digUp(state, x, y);
      FP.sfx("dig");
      view.pendingDig = null;
      const r = FP.plotRect(FP.layout(state), x, y);
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.72, "#7a4e2d", 10);
      toast("You dug up the " + seed.name + ".");
      return;
    }
    view.pendingDig = { x, y, until: now + 2500 };
    toast("Click again to dig up the " + seed.name + ".");
  }

  // ---------- Input ----------

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("farm");
  const held = document.getElementById("held");
  let heldSrc = "";
  let dragging = false;
  let touching = false;
  let dragCell = null;

  const toGame = e => FP.renderer.toGame(e.clientX, e.clientY);

  // Shows what you're holding next to the mouse while it's over the farm.
  // A trowel carrying a plant shows the plant instead.
  function updateHeld() {
    const tool = ui.tool;
    if (!tool || !view.mouse) {
      held.style.display = "none";
      return;
    }
    let src;
    if (view.carrying) {
      const plant = state.plots[view.carrying.y][view.carrying.x];
      src = FP.seedIconURL(FP.SEED_BY_ID[plant.seedId]);
    } else if (tool.type === "shovel") src = FP.shovelIconURL();
    else if (tool.type === "tool") src = FP.toolIconURL(FP.TOOL_BY_ID[tool.toolId]);
    else if (tool.type === "building") src = FP.buildingIconURL(FP.WORKER_BY_ID[tool.workerId]);
    else if (tool.type === "tile") src = FP.tileIconURL(tool.id);
    else if (tool.type === "fence") src = FP.fenceIconURL();
    else src = FP.seedIconURL(FP.SEED_BY_ID[tool.seedId]);
    if (src !== heldSrc) {
      held.src = src;
      heldSrc = src;
    }
    held.style.display = "block";
    held.style.transform = `translate(${view.mouse.x + 8}px, ${view.mouse.y + 6}px)`;
  }

  const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y;

  canvas.addEventListener("pointerdown", e => {
    if (e.button === 2) {
      ui.setTool(null);
      return;
    }
    view.mouse = toGame(e);
    if (FP.renderer.signAt(state, view.mouse.x, view.mouse.y)) return actions.openTown();
    const cell = FP.plotAt(state, view.mouse.x, view.mouse.y);
    view.hover = cell;
    touching = e.pointerType === "touch";
    dragging = true;
    dragCell = cell;
    if (cell) useCell(cell, false);
  });

  // Holding the mouse down and dragging plants or harvests a whole row at once.
  canvas.addEventListener("pointermove", e => {
    view.mouse = toGame(e);
    view.hover = FP.plotAt(state, view.mouse.x, view.mouse.y);
    if (dragging && view.hover && !sameCell(view.hover, dragCell)) {
      dragCell = view.hover;
      useCell(view.hover, true);
    }
  });

  // On a touch screen the finger lifting counts as leaving, so the tooltip stays until the next tap.
  canvas.addEventListener("pointerleave", () => {
    if (touching) return;
    view.hover = null;
    view.mouse = null;
  });

  window.addEventListener("pointerup", () => {
    dragging = false;
    dragCell = null;
  });

  canvas.addEventListener("contextmenu", e => e.preventDefault());

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (FP.greenhouseMenu.open) FP.greenhouseMenu.hide();
      else if (FP.town.modal) FP.town.closeModal();
      else if (FP.town.open) actions.closeTown();
      ui.setTool(null);
      ui.closeBuilding();
    }
    else if (e.key === "q" || e.key === "Q") ui.selectSlot("shovel");
    else if (e.key === "h" || e.key === "H") actions.harvestAll();
    else if (e.key === "PageUp") actions.floor({ dir: 1 });
    else if (e.key === "PageDown") actions.floor({ dir: -1 });
    else if (/^[1-9]$/.test(e.key)) {
      const item = ui.hotbarItems()[Number(e.key) - 1];
      if (item) ui.selectSlot(item.type, item.id);
    }
  });

  function fit() {
    // A tab opened in the background can report a size of 0, which would break the canvas.
    if (window.innerWidth < 10 || window.innerHeight < 10) return;
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    const offX = (window.innerWidth - 1280 * scale) / 2;
    const offY = (window.innerHeight - 720 * scale) / 2;
    stage.style.transform = `translate(${offX}px, ${offY}px) scale(${scale})`;
    FP.renderer.resize(scale * (window.devicePixelRatio || 1));
    FP.blackHole.resize(scale * (window.devicePixelRatio || 1));
    FP.town.resize(scale * (window.devicePixelRatio || 1));
  }

  // ---------- Saving ----------

  setInterval(() => FP.save(state), AUTOSAVE_MS);
  window.addEventListener("pagehide", () => FP.save(state));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") FP.save(state);
  });

  // ---------- Loop ----------

  let last = performance.now();
  let nextCheck = 0;
  let nextWeatherTick = 0;
  let nextGreenhouse = 0;
  let weatherChanged = 0; // plants the current weather has changed, for the message when it ends

  function updateWeather(now) {
    if (now >= state.weather.endsAt) {
      const ending = FP.currentWeather(state);
      if (ending.mod) {
        const mod = FP.MODS[ending.mod].name;
        toast(weatherChanged === 0
          ? "The " + ending.noun + " ended without changing any plants."
          : "The " + ending.noun + " left " + (weatherChanged === 1 ? "1 plant " : weatherChanged + " plants ") + mod + ".");
      }
      weatherChanged = 0;
      const next = FP.nextWeather(state, now);
      toast(next.start);
      FP.sfx("weather");
      ui.pulseWeather();
      ui.refreshTab("guide");
    }
    if (now >= nextWeatherTick) {
      nextWeatherTick = now + FP.WEATHER_TICK_MS;
      // Weather and night reach every floor, but only the floor on screen shows sparkles.
      FP.eachFloor(state, (i, showing) => {
        FP.weatherTick(state, (x, y, plant, modId, result) => {
          weatherChanged++;
          if (showing) celebrateMod(x, y, plant, modId, result);
        });
        FP.nightTick(state, now, showing ? celebrateMod : () => {});
      });
    }
  }

  // Announces each new time of day.
  let lastTime = null;
  function updateTime(now) {
    const time = FP.timeOfDay(now);
    if (lastTime && lastTime !== time.id) {
      if (time.id === "evening") toast("Night is falling. Plants can become Moonlit until dawn.");
      else if (time.id === "dawn") toast("The sun is coming up.");
      ui.refreshTab("guide");
    }
    lastTime = time.id;
  }

  // After the first rebirth, a little guy walks in and puts up the sign to the Town.
  function maybeStartTownIntro(delay) {
    if (state.rebirth.count < 1 || state.rebirth.townSeen) return;
    state.rebirth.townSeen = true; // the farm slides right to make room for the path
    FP.renderer.startTownIntro(performance.now() + delay, () => {
      toast("Someone put up a sign next to your farm. Click it to visit the Town.", true);
      FP.sfx("goal");
    });
    FP.save(state);
  }

  // Swaps in a new state, after a reset or a rebirth, and clears everything tied to the old one.
  function adoptState(next) {
    const now = Date.now();
    state = next;
    FP.refreshShop(state, now);
    FP.refreshToolShop(state, now);
    FP.refreshWorkerShop(state, now);
    FP.fx.clear();
    FP.renderer.forget();
    FP.renderer.clearWorkers();
    ui.closeBuilding();
    FP.greenhouseMenu.hide();
    ui.tool = null;
    view.carrying = null;
    view.pendingDig = null;
    lastClaimable = -1;
    lastLevel = FP.level(state);
    ui.shownCoins = state.coins;
    ui.els.coinCount.textContent = FP.formatCoins(state.coins);
    ui.refresh();
    tutorial.render();
    FP.save(state);
  }

  // Celebrates each new farm level and says what it unlocked.
  let lastLevel = 0;
  function checkLevel() {
    const level = FP.level(state);
    if (lastLevel && level > lastLevel) {
      const unlocked = FP.UNLOCKS.filter(u => u.level > lastLevel && u.level <= level).map(u => u.text);
      toast("Level " + level + "!" + (unlocked.length ? " You unlocked " + unlocked.join(", and ") + "." : ""), true);
      FP.sfx("goal");
      ui.pulseLevel();
      ui.refresh();
      // New unlocks show up in the shops right away.
      FP.refreshShop(state, Date.now());
      FP.refreshToolShop(state, Date.now());
      FP.refreshWorkerShop(state, Date.now());
    }
    lastLevel = level;
  }

  // Lets the player know when a goal is ready to claim.
  let lastClaimable = -1;
  function checkGoals() {
    const ready = FP.claimableGoals(state);
    if (lastClaimable >= 0 && ready.length > lastClaimable) {
      toast("Goal finished: " + ready[ready.length - 1].text + ". Claim it in the Goals tab.", true);
      FP.sfx("goal");
      ui.pulseTab("goals");
      ui.refreshTab("goals");
    }
    lastClaimable = ready.length;
  }

  // Plays what a worker did once they or their bee get to the plot.
  function onWorkerEvent(b, event) {
    FP.renderer.workerEvent(state, b, event, () => {
      const L = FP.layout(state);
      if (event.kind === "walk") {
        const r = FP.plotRect(L, event.x, event.y);
        if (event.action === "water") {
          FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.45, "#6fb7ff", 8, 0.6);
        } else {
          const seed = FP.SEED_BY_ID[event.seedId];
          FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.5, seed.color, 8, 0.7);
          const tab = document.querySelector('#tabs [data-tab="sell"]');
          FP.fx.fly({
            from: { x: r.x + r.s / 2, y: r.y + r.s * 0.45 }, to: FP.renderer.centerOf(tab),
            dur: 0.75, lift: 120, draw: FP.drawIcon(seed), size: 0.8, endSize: 0.45,
            onArrive: () => { ui.pulseTab("sell"); ui.refreshTab("sell"); },
          });
        }
      } else if (event.kind === "pulse") {
        event.gains.forEach(g => {
          const plant = state.plots[g.y][g.x];
          if (plant) celebrateMod(g.x, g.y, plant, g.modId, g.result);
        });
      } else if (event.kind === "bee") {
        const r = FP.plotRect(L, event.x, event.y);
        FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.4, "#ffcf3a", 4, 0.4);
        const plant = state.plots[event.y][event.x];
        if (event.gain && plant) celebrateMod(event.x, event.y, plant, event.gain.modId, event.gain.result);
      }
    });
  }

  // Golden and Prismatic plants get announced once, when they first show up.
  function announceLucky() {
    state.plots.forEach((row, y) => row.forEach((plant, x) => {
      if (!plant || !plant.luckyNew) return;
      const id = plant.luckyNew;
      delete plant.luckyNew;
      const seed = FP.SEED_BY_ID[plant.seedId];
      const r = FP.plotRect(FP.layout(state), x, y);
      FP.fx.burst(r.x + r.s / 2, r.y + r.s * 0.4, id === "golden" ? "#ffd23f" : "#e07cff", 18, 1);
      toast("Lucky! Your " + seed.name + " is growing " + FP.MODS[id].name + ".", true);
      ui.refreshTab("guide");
    }));
  }

  function frame(ts) {
    // One bad frame shouldn't freeze the game, so errors get logged and the loop keeps going.
    try {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const now = Date.now();

      // Tools and workers restock quietly, except that rare ones get a message.
      if (now >= state.toolShop.nextRefresh) {
        FP.refreshToolShop(state, now);
        const rare = state.toolShop.stock.map(s => FP.TOOL_BY_ID[s.id]).filter(t => t.rarity >= 2).pop();
        if (rare) toast("The tool shop has " + FP.withArticle(rare.name) + " in stock.");
        ui.refreshTab("shop");
      }
      if (now >= state.workerShop.nextRefresh) {
        FP.refreshWorkerShop(state, now);
        const rare = state.workerShop.stock.map(s => FP.WORKER_BY_ID[s.id]).filter(w => w.rarity >= 2).pop();
        if (rare) toast("The shop has " + FP.withArticle(rare.building) + " for sale.");
        ui.refreshTab("shop");
      }
      if (now >= state.shop.nextRefresh) {
        FP.refreshShop(state, now);
        toast("The seed shop has new stock.");
        ui.refreshTab("shop");
      }

      if (now >= nextCheck) {
        nextCheck = now + 2000;
        if (view.pendingDig && now > view.pendingDig.until) view.pendingDig = null;
        if (FP.isStuck(state)) {
          state.seeds.carrot = 1;
          toast("A neighbor saw your empty farm and left you a Carrot seed.");
          ui.renderHotbar();
        }
      }

      updateWeather(now);
      updateTime(now);
      if (now >= nextGreenhouse) {
        nextGreenhouse = now + 1000;
        FP.greenhouseTick(state, now);
        FP.greenhouseMenu.tick();
      }
      tutorial.tick(now);
      checkGoals();
      checkLevel();
      // Buildings work on every floor. Only the floor on screen animates.
      FP.eachFloor(state, (i, showing) => FP.runWorkers(state, now, showing ? onWorkerEvent : () => {}));
      announceLucky();
      if (view.carrying && !state.plots[view.carrying.y][view.carrying.x]) view.carrying = null;

      view.tool = ui.tool;
      view.selected = ui.selected;
      updateHeld();
      ui.tick(now, dt);
      FP.renderer.draw(state, now, dt, view);
      FP.blackHole.draw(now);
      FP.town.draw(now);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Start ----------

  FP.renderer.init(canvas, document.getElementById("fx"));
  FP.SEEDS.forEach(FP.seedIconImage); // load the flying crop pictures ahead of time
  fit();
  window.addEventListener("resize", fit);

  const startNow = Date.now();
  if (startNow >= state.shop.nextRefresh) FP.refreshShop(state, startNow);
  if (startNow >= state.toolShop.nextRefresh) FP.refreshToolShop(state, startNow);
  if (startNow >= state.workerShop.nextRefresh) FP.refreshWorkerShop(state, startNow);
  // Weather doesn't happen while the game is closed, so a returning player starts fresh.
  if (startNow >= state.weather.endsAt) FP.nextWeather(state, startNow);
  nextWeatherTick = startNow + FP.WEATHER_TICK_MS;
  ui.init(game);
  tutorial.init(game);
  FP.blackHole.init(game);
  FP.town.init(game);
  FP.greenhouseMenu.init(game);
  maybeStartTownIntro(2500); // for farms that rebirthed before the Town existed
  lastLevel = FP.level(state);

  if (firstVisit) {
    ui.tool = { type: "seed", seedId: "carrot" };
    ui.renderHotbar();
    toast("Welcome to Fancy Plants.");
  } else {
    const ripe = FP.ripeCells(state, startNow).length;
    toast(ripe > 0
      ? "Welcome back. " + (ripe === 1 ? "1 plant is" : ripe + " plants are") + " ready to harvest."
      : "Welcome back to your farm.");
  }

  requestAnimationFrame(frame);
})(window.FP);
