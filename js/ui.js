// The HTML menus: top bar, side menu tabs, seed bar, and messages.
(function (FP) {
  const $ = sel => document.querySelector(sel);

  const ui = FP.ui = {
    tab: "shop",
    shopView: "seeds", // the shop shows seeds or tools
    tool: null,        // { type: "seed", seedId }, { type: "tool", toolId }, { type: "building", workerId }, { type: "shovel" }, or null
    selected: null,    // uid of the building whose popup is open
    shownCoins: 0,     // the number on screen, which counts toward the real total
    els: null,
    lastRipe: -1,
    lastBasket: -1,
    lastWeather: "",
    holdCoinsUntil: 0, // the coin counter waits while coins are still flying toward it
  };

  ui.init = function (game) {
    ui.game = game;
    ui.els = {
      coins: $("#coins"),
      coinCount: $("#coin-count"),
      panel: $("#panel"),
      tabs: $("#tabs"),
      slots: $("#slots"),
      harvestAll: $("#harvest-all"),
      toasts: $("#toasts"),
      basketCount: $("#basket-count"),
      weather: $("#weather"),
      weatherIcon: $("#weather img"),
      weatherName: $("#weather-name"),
      weatherTime: $("#weather-time"),
      clockIcon: $("#clock-icon"),
      clockName: $("#clock-name"),
      clockTime: $("#clock-time"),
      popup: $("#popup"),
      goalCount: $("#goal-count"),
      floors: $("#floors"),
      floorLabel: $("#floor-label"),
      levelChip: $("#level"),
      levelNum: $("#level-num"),
      levelLabel: $("#level-label"),
      xpBar: $("#xp-bar"),
    };
    ui.shownCoins = game.state.coins;
    ui.els.coinCount.textContent = FP.formatCoins(ui.shownCoins);

    ui.els.tabs.addEventListener("click", e => {
      const b = e.target.closest("button[data-tab]");
      if (b) ui.setTab(b.dataset.tab);
    });
    ui.els.panel.addEventListener("click", e => {
      const b = e.target.closest("[data-action]");
      if (!b || b.disabled) return;
      if (settingsClick(b)) return;
      if (b.dataset.action === "shopView") {
        ui.shopView = b.dataset.view;
        ui.renderPanel();
        ui.els.panel.scrollTop = 0;
        return;
      }
      game.action(b.dataset.action, b.dataset, b);
    });
    ui.els.slots.addEventListener("click", e => {
      const b = e.target.closest(".slot");
      if (b) ui.selectSlot(b.dataset.type, b.dataset.id);
    });
    // The bar only scrolls sideways. The mouse wheel and trackpad swipes both move it left and right.
    ui.els.slots.addEventListener("wheel", e => {
      ui.els.slots.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      e.preventDefault();
    }, { passive: false });
    ui.els.harvestAll.addEventListener("click", () => game.action("harvestAll", {}));
    ui.els.weather.addEventListener("click", () => ui.setTab("guide"));
    ui.els.levelChip.addEventListener("click", () => ui.setTab("goals"));
    ui.els.floors.addEventListener("click", e => {
      const b = e.target.closest("button[data-dir]");
      if (b && !b.disabled) game.action("floor", { dir: b.dataset.dir });
    });
    $("#options-btn").addEventListener("click", () => ui.setTab(ui.tab === "options" ? "shop" : "options"));
    // Sliders and switches in the options change settings right away.
    ui.els.panel.addEventListener("input", e => {
      if (e.target.dataset.setting === "volume") {
        FP.setVolume(Number(e.target.value) / 100);
        FP.sfx("click");
      }
    });
    ui.els.panel.addEventListener("change", e => {
      if (e.target.dataset.setting === "calm") {
        FP.settings.calm = e.target.checked;
        FP.saveSettings();
      }
    });
    ui.els.popup.addEventListener("click", e => {
      const b = e.target.closest("[data-action]");
      if (b && !b.disabled) game.action(b.dataset.action, b.dataset, b);
    });

    ui.refresh();
  };

  // Buttons in Settings and Controls that only change settings, so the game never hears about them.
  function settingsClick(b) {
    const d = b.dataset;
    switch (d.action) {
      case "controls": ui.capturing = null; ui.setTab("controls"); return true;
      case "backToOptions": ui.capturing = null; ui.setTab("options"); return true;
      case "bindKey": ui.capturing = ui.capturing === d.id ? null : d.id; ui.renderPanel(); return true;
      case "clearKey": FP.setKey(d.id, null); ui.capturing = null; ui.renderPanel(); return true;
      case "resetKeys": FP.resetKeys(); ui.capturing = null; ui.renderPanel(); ui.game.toast("Every key is back to how it started."); return true;
      case "notation":
        FP.settings.notation = d.value;
        FP.saveSettings();
        ui.els.coinCount.textContent = FP.formatCoins(Math.round(ui.shownCoins));
        ui.refresh();
        return true;
    }
    return false;
  }

  ui.refresh = function () {
    ui.renderPanel();
    ui.renderHotbar();
  };

  ui.setTab = function (tab) {
    ui.tab = tab;
    [...ui.els.tabs.children].forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $("#options-btn").classList.toggle("active", tab === "options" || tab === "controls");
    ui.renderPanel();
    ui.els.panel.scrollTop = 0;
  };

  // Re-render only the tab that shows this kind of change.
  ui.refreshTab = function (tab) {
    if (ui.tab === tab) ui.renderPanel();
  };

  // ---------- Seed bar ----------

  ui.setTool = function (tool) {
    ui.tool = tool;
    ui.renderHotbar();
    if (ui.game.onToolChange) ui.game.onToolChange();
  };

  const isHeld = (type, id) => {
    const t = ui.tool;
    if (!t || t.type !== type) return false;
    if (type === "shovel" || type === "fence") return true;
    if (type === "tile" || type === "attachment") return t.id === id;
    return (type === "seed" ? t.seedId : type === "tool" ? t.toolId : t.workerId) === id;
  };

  // Clicking the selected slot again puts it away.
  ui.selectSlot = function (type, id) {
    if (isHeld(type, id)) return ui.setTool(null);
    if (type === "shovel") ui.setTool({ type: "shovel" });
    else if (type === "seed") ui.setTool({ type: "seed", seedId: id });
    else if (type === "building") ui.setTool({ type: "building", workerId: id });
    else if (type === "tile") ui.setTool({ type: "tile", id });
    else if (type === "fence") ui.setTool({ type: "fence" });
    else if (type === "attachment") ui.setTool({ type: "attachment", id });
    else ui.setTool({ type: "tool", toolId: id });
  };

  // Everything in the bar after the shovel: buildings, then tools, then seeds. Keys 1 to 9 follow this order.
  ui.hotbarItems = function () {
    const state = ui.game.state;
    return [
      ...FP.WORKERS.filter(w => state.workerBag.some(b => b.workerId === w.id)).map(w => ({ type: "building", id: w.id })),
      ...FP.TOOLS.filter(t => state.tools[t.id] > 0).map(t => ({ type: "tool", id: t.id })),
      ...Object.keys(FP.TILES).filter(k => state.tileKits[k] > 0).map(k => ({ type: "tile", id: k })),
      ...FP.ATTACHMENT_IDS.filter(id => state.attachmentBag[id] > 0).map(id => ({ type: "attachment", id })),
      // The fence stays in the bar while any are standing, so they can be picked back up.
      ...(state.fences > 0 || FP.fencesPlaced(state) ? [{ type: "fence", id: "fence" }] : []),
      ...FP.ALL_SEEDS.filter(s => state.seeds[s.id] > 0).map(s => ({ type: "seed", id: s.id })),
    ];
  };

  function slotInfo(state, item) {
    if (item.type === "building") {
      const def = FP.WORKER_BY_ID[item.id];
      return { name: def.building, icon: FP.buildingIconURL(def), count: state.workerBag.filter(b => b.workerId === item.id).length,
        title: `${def.building}. Click an empty plot to place it.` };
    }
    if (item.type === "tile") {
      const t = FP.TILES[item.id];
      return { name: t.kit, icon: FP.tileIconURL(item.id), count: state.tileKits[item.id], title: `${t.kit}. ${t.desc}` };
    }
    if (item.type === "attachment") {
      const a = FP.ATTACHMENTS[item.id];
      return { name: a.name, icon: FP.attachmentIconURL(item.id), count: state.attachmentBag[item.id], title: `${a.name}. ${a.desc} Click a corner between plots to place it.` };
    }
    if (item.type === "fence") {
      return { name: "Picket Fence", icon: FP.fenceIconURL(), count: state.fences, title: "Picket Fence. Click a plant to put a fence around it, or click a fenced plant to pick the fence back up." };
    }
    if (item.type === "tool") {
      const def = FP.TOOL_BY_ID[item.id];
      return { name: def.name, icon: FP.toolIconURL(def), count: state.tools[item.id], title: `${def.name}. ${def.desc}` };
    }
    const def = FP.SEED_BY_ID[item.id];
    return { name: def.name, icon: FP.seedIconURL(def), count: state.seeds[item.id], title: `${def.name} seed` };
  }

  ui.renderHotbar = function () {
    const state = ui.game.state;
    const items = ui.hotbarItems();
    let html = `<button class="slot ${isHeld("shovel") ? "selected" : ""}" data-type="shovel" title="Shovel (Q). Digs up a plant.">
      <img src="${FP.shovelIconURL()}" alt="Shovel"><span class="key">Q</span></button>
      <div class="slot-divider"></div>`;
    if (items.length === 0) {
      html += `<div class="hint">You have no seeds. Buy some from the shop.</div>`;
    }
    items.forEach((item, i) => {
      const info = slotInfo(state, item);
      html += `<button class="slot ${item.type === "seed" ? "" : item.type} ${isHeld(item.type, item.id) ? "selected" : ""}" data-type="${item.type}" data-id="${item.id}" title="${info.title}">
        <img src="${info.icon}" alt="${info.name}">
        ${i < 9 ? `<span class="key">${i + 1}</span>` : ""}
        <span class="count">${info.count}</span></button>`;
      if (items[i + 1] && items[i + 1].type !== item.type) html += `<div class="slot-divider"></div>`;
    });
    ui.els.slots.innerHTML = html;
  };

  // ---------- Side menu ----------

  const coin = `<span class="coin-icon small"></span>`;

  function growText(seed) {
    let text = "Grows in " + FP.formatTime(seed.grow * 1000);
    if (seed.regrow) text += ", then regrows";
    return text;
  }

  // A small colored label for a modifier. Prismatic gets a rainbow and Monochrome gets black and white.
  function modTag(id, hidden) {
    if (hidden) return `<span class="mod unknown">???</span>`;
    const mod = FP.MODS[id];
    const special = mod.color === "rainbow" || mod.color === "mono";
    const style = special ? "" : `style="--mod:${mod.color}"`;
    return `<span class="mod ${special ? mod.color : ""}" ${style}>${mod.name}</span>`;
  }
  ui.modTag = modTag;

  const mult = id => "x" + (Number.isInteger(FP.MODS[id].mult) ? FP.formatCoins(FP.MODS[id].mult) : FP.MODS[id].mult);

  // Grayed out rows that show what a level unlocks.
  const lockedRow = (icon, name, note) => `<li class="row locked">
      <img class="icon" src="${icon}" alt="">
      <div class="info"><div class="name">${name}</div></div>
      <span class="lock-note">${note}</span>
    </li>`;

  function seedRows(state) {
    const level = FP.level(state);
    const locked = FP.RARITIES.map((r, i) => ({ r, i, need: FP.RARITY_LEVEL[i] })).filter(x => x.need > level)
      .map(x => lockedRow(FP.seedIconURL(FP.SEEDS.find(s => s.rarity === x.i)), x.r.name + " seeds", "Level " + x.need)).join("");
    return seedStockRows(state) + locked;
  }

  function seedStockRows(state) {
    return state.shop.stock.map((slot, i) => {
      const seed = FP.SEED_BY_ID[slot.seedId];
      const rarity = FP.RARITIES[seed.rarity];
      const sold = slot.left <= 0;
      const poor = state.coins < seed.price;
      return `<li class="row ${sold ? "sold" : ""}" style="--rarity:${rarity.color}">
        <img class="icon" src="${FP.seedIconURL(seed)}" alt="">
        <div class="info">
          <div class="name">${seed.name}</div>
          <div class="meta"><span class="tag">${rarity.name}</span>Sells for ${FP.formatCoins(seed.value)}</div>
          <div class="meta">${growText(seed)}</div>
        </div>
        <div class="buy">
          <button class="btn btn-gold ${poor ? "poor" : ""}" data-action="buy" data-index="${i}" ${sold ? "disabled" : ""}>${coin}${FP.formatCoins(seed.price)}</button>
          <div class="stock">${sold ? "Sold out" : slot.left + " left"}</div>
        </div>
      </li>`;
    }).join("");
  }

  const soldOutRow = text => `<p class="empty">${text}</p>`;

  function toolRows(state) {
    const locked = FP.TOOLS.filter(t => !FP.toolUnlocked(state, t.id))
      .map(t => lockedRow(FP.toolIconURL(t), t.name, "Level " + FP.TOOL_LEVEL[t.id])).join("");
    return toolStockRows(state) + locked;
  }

  function toolStockRows(state) {
    if (!state.toolShop.stock.length) return soldOutRow("The tool shop is empty until the next restock.");
    return state.toolShop.stock.map(slot => {
      const tool = FP.TOOL_BY_ID[slot.id];
      const rarity = FP.RARITIES[tool.rarity];
      const poor = state.coins < tool.price;
      const sold = slot.left <= 0;
      const owned = state.tools[tool.id] || 0;
      return `<li class="row ${sold ? "sold" : ""}" style="--rarity:${rarity.color}">
        <img class="icon" src="${FP.toolIconURL(tool)}" alt="">
        <div class="info">
          <div class="name">${tool.name}</div>
          <div class="meta"><span class="tag">${rarity.name}</span>${tool.uses === 1 ? "1 use" : tool.uses + " uses"}</div>
          <div class="meta">${tool.desc}</div>
        </div>
        <div class="buy">
          <button class="btn btn-gold ${poor ? "poor" : ""}" data-action="buyTool" data-id="${tool.id}" ${sold ? "disabled" : ""}>${coin}${FP.formatCoins(tool.price)}</button>
          <div class="stock">${sold ? "Sold out" : slot.left + " left"}${owned ? ", " + owned + " uses owned" : ""}</div>
        </div>
      </li>`;
    }).join("");
  }

  const plots = n => n === 1 ? "1 plot" : n + " plots";

  // One line that sums up a worker at a given level.
  function workerStats(def, level) {
    const i = level - 1;
    let text = `Works every ${def.every[i]}s and reaches plants up to ${plots(def.range[i])} away.`;
    if (def.bees) text += ` Keeps ${def.bees[i]} bees.`;
    if (def.chance) text += ` ${Math.round(def.chance[i] * 100)}% chance of ${FP.MODS[def.mod].name} each time.`;
    return text;
  }
  ui.workerStats = workerStats;

  function workerRows(state) {
    const locked = FP.WORKERS.filter(w => !w.noShop && !FP.workerUnlocked(state, w.id))
      .map(w => lockedRow(FP.buildingIconURL(w), w.building, "Level " + FP.WORKER_LEVEL[w.id])).join("");
    if (!FP.WORKERS.some(w => !w.noShop && FP.workerUnlocked(state, w.id))) return soldOutRow("Buildings go on sale once your farm reaches level 5.") + locked;
    return workerStockRows(state) + locked;
  }

  function workerStockRows(state) {
    if (!state.workerShop.stock.length) return soldOutRow("No buildings are for sale right now. Check back after the next restock.");
    return state.workerShop.stock.map(slot => {
      const def = FP.WORKER_BY_ID[slot.id];
      const sold = slot.left <= 0;
      const rarity = FP.RARITIES[def.rarity];
      const price = FP.workerPrice(state, def.id);
      const owned = state.buildings.filter(b => b.workerId === def.id).length + state.workerBag.filter(b => b.workerId === def.id).length;
      return `<li class="row ${sold ? "sold" : ""}" style="--rarity:${rarity.color}">
        <img class="icon" src="${FP.buildingIconURL(def)}" alt="">
        <div class="info">
          <div class="name">${def.building}</div>
          <div class="meta"><span class="tag">${rarity.name}</span>Home of the ${def.name}</div>
          <div class="meta">${def.desc}</div>
        </div>
        <div class="buy">
          <button class="btn btn-gold ${state.coins < price ? "poor" : ""}" data-action="hire" data-id="${def.id}" ${sold ? "disabled" : ""}>${coin}${FP.formatCoins(price)}</button>
          <div class="stock">${sold ? "Sold out" : owned ? owned + " owned" : ""}</div>
        </div>
      </li>`;
    }).join("");
  }

  // Building new floors. It shows up once the player has been to the black hole.
  function floorCard(state) {
    const allowed = FP.floorsAllowed(state), have = state.floors.length;
    if (allowed <= 1 && !state.rebirth.count) return "";
    const title = `<div class="card-title">Farm Floors<span class="level">${have} of ${FP.MAX_FLOORS}</span></div>`;
    if (have >= FP.MAX_FLOORS) {
      return `<div class="card">${title}<p>Your farm has all ${FP.MAX_FLOORS} floors. The arrows under the Town sign switch between them.</p></div>`;
    }
    if (have >= allowed) {
      return `<div class="card">${title}<p>Your farm has ${have === 1 ? "one floor" : have + " floors"}. The Farm Floors skill in the black hole lets you build ${["", "a second one", "a third one", "a fourth one"][have]}.</p>
        <button class="btn wide" disabled>Needs the Farm Floors skill</button></div>`;
    }
    const cost = FP.floorCost(state);
    return `<div class="card">${title}
      <p>Building a ${["", "second", "third", "fourth"][have]} floor adds a whole new layer of plots the same size as your farm. Weather reaches every floor, and buildings keep working on floors you aren't looking at.</p>
      <button class="btn btn-gold wide ${state.coins < cost ? "poor" : ""}" data-action="buyFloor">${coin}${FP.formatCoins(cost)}</button>
    </div>`;
  }

  function rebirthCard(state) {
    const gmo = FP.gmoForRebirth(state);
    const visit = state.rebirth.count > 0 ? `<button class="btn wide" data-action="openVoid" style="margin-top:8px">Visit the black hole</button>` : "";
    if (!FP.canRebirth(state)) {
      return `<div class="card rebirth">
        <div class="card-title">Rebirth</div>
        <p>At level ${FP.REBIRTH_LEVEL} you can send this farm into a black hole for GMO Points, then start over stronger. Your farm is level ${FP.level(state)}.</p>
        ${visit}
      </div>`;
    }
    return `<div class="card rebirth">
      <div class="card-title">Rebirth</div>
      <p>Your farm, coins, seeds, tools, upgrades, and buildings will be pulled into a black hole. You keep the guide, your goals, and your skills, and you get <b>${gmo} GMO ${gmo === 1 ? "Point" : "Points"}</b> to spend on the skill tree. Earning more coins before you rebirth gives more points.</p>
      <button class="btn btn-void wide" data-action="rebirth">Rebirth for ${gmo} GMO ${gmo === 1 ? "Point" : "Points"}</button>
      ${visit}
    </div>`;
  }

  const SHOP_VIEWS = {
    seeds: state => ({ head: `<h2>Seed Shop</h2><p class="sub">New stock arrives in <b id="shop-timer">${FP.formatClock(state.shop.nextRefresh - Date.now())}</b></p>`, rows: seedRows(state) }),
    tools: state => ({ head: `<h2>Tool Shop</h2><p class="sub">New stock arrives in <b id="shop-timer">${FP.formatClock(state.toolShop.nextRefresh - Date.now())}</b></p>`, rows: toolRows(state) }),
    workers: state => ({ head: `<h2>Buildings</h2><p class="sub">New buildings arrive in <b id="shop-timer">${FP.formatClock(state.workerShop.nextRefresh - Date.now())}</b>. Each one takes up one plot and has someone inside who helps the farm. A second of the same kind costs more.</p>`, rows: workerRows(state) }),
  };

  const PANELS = {
    shop(state) {
      const view = SHOP_VIEWS[ui.shopView](state);
      const tab = (id, label) => `<button data-action="shopView" data-view="${id}" class="${ui.shopView === id ? "on" : ""}">${label}</button>`;
      return `<div class="seg">${tab("seeds", "Seeds")}${tab("tools", "Tools")}${tab("workers", "Buildings")}</div>
        <div class="panel-head">${view.head}</div>
        <ul class="list">${view.rows}</ul>`;
    },

    sell(state) {
      const groups = FP.harvestGroups(state);
      if (groups.length === 0) {
        return `<div class="panel-head"><h2>Basket</h2></div>
          <p class="empty">Your basket is empty. Click a ripe plant to harvest it, and it will show up here.</p>`;
      }
      const total = groups.reduce((sum, g) => sum + g.total, 0);
      const rows = groups.map(g => {
        const rarity = FP.RARITIES[g.seed.rarity];
        return `<li class="row" style="--rarity:${rarity.color}">
          <img class="icon" src="${FP.seedIconURL(g.seed)}" alt="">
          <div class="info">
            <div class="name">${g.count} ${g.count === 1 ? g.seed.name : g.seed.plural}</div>
            ${g.mods.length ? `<div class="mods">${g.mods.map(id => modTag(id)).join("")}</div>` : ""}
            <div class="meta">Worth ${FP.formatCoins(g.total)} coins</div>
          </div>
          <button class="btn" data-action="sell" data-key="${g.key}">Sell</button>
        </li>`;
      });
      const stall = FP.upgradeLevel(state, "stall");
      return `<div class="panel-head"><h2>Basket</h2><p class="sub">${stall ? `Your market stall adds ${stall * 5}% to every sale.` : "Everything you've harvested so far."}</p></div>
        <div class="card"><button class="btn wide" data-action="sellAll">Sell everything for ${coin}${FP.formatCoins(total)}</button></div>
        <ul class="list">${rows.join("")}</ul>`;
    },

    upgrades(state) {
      const next = FP.nextFarmSize(state);
      let html = `<div class="panel-head"><h2>Upgrades</h2><p class="sub">Spend coins to grow your farm.</p></div>`;
      if (next && FP.level(state) < FP.expandLevel(state)) {
        html += `<div class="card">
          <div class="card-title">Bigger Farm</div>
          <p>Your farm is ${state.cols} by ${state.rows}. The next expansion unlocks at level ${FP.expandLevel(state)}.</p>
          <button class="btn wide" disabled>Unlocks at level ${FP.expandLevel(state)}</button>
        </div>`;
      } else if (next) {
        const cost = FP.expansionCost(state);
        html += `<div class="card">
          <div class="card-title">Bigger Farm</div>
          <p>Your farm is ${state.cols} by ${state.rows}. Expanding it makes it ${next.cols} by ${next.rows}.</p>
          <button class="btn btn-gold wide ${state.coins < cost ? "poor" : ""}" data-action="expand">${coin}${FP.formatCoins(cost)}</button>
        </div>`;
      } else {
        html += `<div class="card">
          <div class="card-title">Bigger Farm</div>
          <p>Your farm is ${state.cols} by ${state.rows}, which is as big as it can get right now.${FP.skillLevel(state, "wide") < 3 ? " The Wide Fields skill in the black hole lets it grow bigger." : ""}</p>
        </div>`;
      }
      html += floorCard(state);
      html += rebirthCard(state);
      FP.UPGRADES.forEach(u => {
        const level = FP.upgradeLevel(state, u.id);
        const maxed = level >= u.max;
        const cost = FP.upgradeCost(state, u.id);
        const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("");
        html += `<div class="card">
          <div class="card-title">${u.name}<span class="level">Level ${level} of ${u.max}</span></div>
          <div class="pips">${pips}</div>
          <p>${u.desc}</p>
          ${maxed
            ? `<button class="btn wide" disabled>Fully upgraded</button>`
            : `<button class="btn btn-gold wide ${state.coins < cost ? "poor" : ""}" data-action="upgrade" data-id="${u.id}">${coin}${FP.formatCoins(cost)}</button>`}
        </div>`;
      });
      return html;
    },

    guide(state) {
      const now = FP.currentWeather(state);
      const nowMods = now.mod ? [now.mod, ...(now.also || [])] : [];
      const upgradeText = w => Object.entries(w.upgrade).map(([a, b]) => `Plants that are already ${modTag(a)} become ${modTag(b)} ${mult(b)}.`).join(" ");
      const nowText = now.strip
        ? "While it lasts, the wind can blow weather modifiers off your plants. Plants with a Picket Fence are safe, and so is a sealed modifier."
        : now.event
          ? `This event is short. Plants can become ${modTag(now.mod)} ${mult(now.mod)}. ${upgradeText(now)}`
        : nowMods.length
          ? `While it lasts, plants can become ${nowMods.map(id => modTag(id) + " " + mult(id)).join(" and ")}.`
          : "Plants grow normally until the weather changes.";
      const whenText = w => w.times === "all" ? "Any time of day" : w.times.map(id => FP.TIME_BY_ID[id].name).join(", ");
      const eventRows = FP.WEATHER.filter(w => w.event).map(w => `<li class="row slim">
          <img class="icon small" src="${FP.weatherIconURL(w.id)}" alt="">
          <div class="info"><div class="name">${w.name}</div><div class="meta">Makes plants ${modTag(w.mod)} ${mult(w.mod)}. ${upgradeText(w)}</div>
          <div class="meta">Lasts under half a minute, any time of day.</div></div>
        </li>`).join("");
      const weatherRows = FP.WEATHER.filter(w => (w.mod || w.strip) && !w.event).map(w => `<li class="row slim">
          <img class="icon small" src="${FP.weatherIconURL(w.id)}" alt="">
          <div class="info"><div class="name">${w.name}</div><div class="meta">${w.strip
            ? "Blows weather modifiers off plants. Fenced plants are safe."
            : "Makes plants " + [w.mod, ...(w.also || [])].map(id => modTag(id) + " " + mult(id)).join(" and ")}</div>
          <div class="meta">Can start: ${whenText(w)}</div></div>
        </li>`).join("");
      const time = FP.timeOfDay(Date.now());
      const luckyRows = FP.LUCKY_MODS.slice().reverse().map(id => `<li class="row slim">
          <div class="info"><div class="name">${modTag(id)} ${mult(id)}</div>
          <div class="meta">About 1 in ${FP.formatCoins(Math.round(1 / FP.MODS[id].chance))} plants grows ${FP.MODS[id].name}.</div></div>
        </li>`).join("");
      const fusionRows = FP.FUSIONS.map(([a, b, out]) => {
        const known = state.discovered[out];
        return `<li class="row slim">
          <div class="info"><div class="mods">${modTag(a, !state.discovered[a] && FP.MODS[a].kind === "fusion")} and
            ${modTag(b, !state.discovered[b] && FP.MODS[b].kind === "fusion")} make ${modTag(out, !known)}${known ? " " + mult(out) : ""}</div></div>
        </li>`;
      }).join("");
      const found = FP.FUSIONS.filter(f => state.discovered[f[2]]).length;
      return `<div class="panel-head"><h2>Guide</h2><p class="sub">How weather changes your plants.</p></div>
        <div class="card now">
          <img class="icon small" src="${FP.weatherIconURL(now.id)}" alt="">
          <div><div class="card-title">Right now: ${now.name}</div><p>${nowText}</p></div>
        </div>
        <p class="guide-note">A modifier stays on a plant until you harvest it. Plants that regrow start each new crop without modifiers, unless one is sealed with a Wax Seal. Modifiers multiply together.</p>
        <h3 class="section">Day and night</h3>
        <div class="card now">
          <img class="icon small" src="${FP.weatherIconURL(time.night ? "moonlight" : "sunny")}" alt="">
          <div><div class="card-title">It's ${time.name.toLowerCase()} now</div>
          <p>A full day lasts 24 minutes. From Evening until Dawn, any plant can become ${modTag("moonlit")} ${mult("moonlit")}, whatever the weather is doing. Each weather can only start at certain times of day.</p></div>
        </div>
        <h3 class="section">Weather</h3><ul class="list">${weatherRows}</ul>
        <h3 class="section">Events</h3>
        <p class="guide-note">Events are short bursts of weather that can strengthen a modifier a plant already has.</p>
        <ul class="list">${eventRows}</ul>
        <h3 class="section">Lucky finds</h3><ul class="list">${luckyRows}</ul>
        <h3 class="section">Building gifts</h3>
        <ul class="list">${["aura", "pollinated", "risen"].map(id => `<li class="row slim">
          <div class="info"><div class="name">${modTag(id)} ${mult(id)}</div>
          <div class="meta">Given by the ${FP.WORKERS.find(w => w.mod === id).building}.</div></div>
        </li>`).join("")}</ul>
        <h3 class="section">Fusions <span class="count-note">${found} of ${FP.FUSIONS.length} found</span></h3>
        <p class="guide-note">When a plant has both modifiers on the left, they combine into a stronger one.</p>
        <ul class="list">${fusionRows}</ul>`;
    },

    goals(state) {
      const row = g => {
        const progress = FP.goalProgress(state, g);
        const claimed = state.goalsClaimed[g.id];
        const ready = !claimed && progress >= g.target;
        const showCount = g.target > 1;
        return `<li class="goal ${claimed ? "claimed" : ""} ${ready ? "ready" : ""}">
          <div class="goal-text">${g.text}</div>
          ${claimed ? "" : `<div class="bar"><i style="width:${progress / g.target * 100}%"></i></div>`}
          <div class="goal-foot">
            <span class="reward">${claimed ? "Claimed" : "Reward: " + FP.rewardText(g.reward)}</span>
            ${ready ? `<button class="btn btn-gold" data-action="claim" data-id="${g.id}">Claim</button>`
              : (!claimed && showCount ? `<span class="goal-count">${FP.formatCoins(progress)} of ${FP.formatCoins(g.target)}</span>` : "")}
          </div>
        </li>`;
      };
      const open = FP.GOALS.filter(g => !state.goalsClaimed[g.id]);
      const ready = open.filter(g => FP.goalDone(state, g));
      const waiting = open.filter(g => !FP.goalDone(state, g));
      const done = FP.GOALS.filter(g => state.goalsClaimed[g.id]);
      const info = FP.levelFromXp(state.xp);
      const upcoming = FP.UNLOCKS.filter(u => u.level > info.level).slice(0, 4);
      const levelCard = `<div class="card">
          <div class="card-title">Farm level ${info.level}<span class="level">${info.level < FP.MAX_LEVEL ? Math.floor(info.into) + " of " + info.need + " XP" : "Highest level"}</span></div>
          ${info.level < FP.MAX_LEVEL ? `<div class="bar"><i style="width:${info.into / info.need * 100}%"></i></div>` : ""}
          <p>You earn XP by harvesting. Rarer crops give more.</p>
          ${upcoming.length ? `<ul class="unlock-list">${upcoming.map(u => `<li><b>Level ${u.level}</b><span>${u.text.charAt(0).toUpperCase() + u.text.slice(1)}</span></li>`).join("")}</ul>` : ""}
        </div>`;
      return `${levelCard}<div class="panel-head"><h2>Goals</h2><p class="sub">${done.length} of ${FP.GOALS.length} done. Finish goals to earn rewards.</p></div>
        <ul class="goals">${[...ready, ...waiting].map(row).join("")}</ul>
        ${done.length ? `<h3 class="section">Done</h3><ul class="goals">${done.map(row).join("")}</ul>` : ""}`;
    },

    options(state) {
      const s = state.stats;
      return `<div class="panel-head"><h2>Options</h2></div>
        <div class="card">
          <div class="card-title">Sound</div>
          <label class="setting">Volume
            <input type="range" min="0" max="100" value="${Math.round(FP.settings.volume * 100)}" data-setting="volume">
          </label>
          <label class="setting check">
            <input type="checkbox" data-setting="calm" ${FP.settings.calm ? "checked" : ""}>
            Fewer effects, with less sparkle and no butterflies or clouds
          </label>
        </div>
        <div class="card">
          <div class="card-title">Numbers</div>
          <p>How big numbers are shortened. Numbers under a million always show in full.</p>
          <div class="seg">${Object.entries(FP.NOTATIONS).map(([id, name]) =>
            `<button data-action="notation" data-value="${id}" class="${FP.settings.notation === id ? "on" : ""}">${name}</button>`).join("")}</div>
          <p class="notation-sample">1,234,567 shows as <b>${FP.formatCoins(1234567)}</b></p>
        </div>
        <div class="card">
          <div class="card-title">Controls</div>
          <p>Set the keys for harvesting, switching floors, opening menus, and more.</p>
          <button class="btn wide" data-action="controls">Change controls</button>
        </div>
        <div class="card">
          <div class="card-title">Tutorial</div>
          <p>Shows the first time tips again from the start.</p>
          <button class="btn wide" data-action="tutorial">Show the tutorial</button>
        </div>
        <div class="card">
          <div class="card-title">Saving</div>
          <p>The game saves by itself every 15 seconds and when you close the tab.</p>
          <button class="btn wide" data-action="save">Save now</button>
        </div>
        <div class="card">
          <div class="card-title">Farm stats</div>
          <dl class="stats">
            <dt>Seeds planted</dt><dd>${FP.formatCoins(s.planted)}</dd>
            <dt>Crops harvested</dt><dd>${FP.formatCoins(s.harvested)}</dd>
            <dt>Coins earned</dt><dd>${FP.formatCoins(s.earned)}</dd>
            <dt>Best single sale</dt><dd>${FP.formatCoins(s.best)}</dd>
            <dt>Buildings bought</dt><dd>${FP.formatCoins(s.hired)}</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-title">Start over</div>
          <p>This erases your farm, your coins, and your seeds.</p>
          <button class="btn btn-red wide" data-action="reset">Reset farm</button>
        </div>
        <p class="version">Fancy Plants v0.17</p>`;
    },

    controls() {
      const rows = FP.KEY_ACTIONS.map(a => {
        const key = FP.settings.keys[a.id];
        const waiting = ui.capturing === a.id;
        return `<li class="key-row">
          <span class="key-name">${a.name}</span>
          <button class="keycap ${waiting ? "waiting" : ""} ${key ? "" : "none"}" data-action="bindKey" data-id="${a.id}">${waiting ? "Press a key" : FP.keyName(key)}</button>
          <button class="key-clear" data-action="clearKey" data-id="${a.id}" ${key ? "" : "disabled"} title="Remove this key">Clear</button>
        </li>`;
      }).join("");
      return `<div class="panel-head"><button class="btn small-back" data-action="backToOptions">Back</button><h2>Controls</h2>
          <p class="sub">Click a key, then press the key you want. Escape cancels. Keys 1 to 9 always pick from the bar, and Escape always puts things away.</p></div>
        <ul class="key-list">${rows}</ul>
        <div class="card"><button class="btn wide" data-action="resetKeys">Reset every key</button></div>`;
    },
  };

  // ---------- Building popup ----------

  ui.openBuilding = function (uid) {
    ui.selected = uid;
    ui.renderPopup();
  };

  ui.closeBuilding = function () {
    ui.selected = null;
    ui.els.popup.hidden = true;
  };

  // Attachments use the building popup too. Their id is "att:cx:cy".
  ui.openAttachment = (cx, cy) => ui.openBuilding("att:" + cx + ":" + cy);

  function renderAttachmentPopup(state) {
    const [, cx, cy] = ui.selected.split(":").map(Number);
    const a = FP.attachmentAt(state, cx, cy);
    if (!a) return ui.closeBuilding();
    const def = FP.ATTACHMENTS[a.id];
    const pop = ui.els.popup;
    pop.style.setProperty("--rarity", def.color);
    pop.innerHTML = `<div class="popup-head"><b>${def.name}</b><span>Attachment</span></div>
      <p>${def.desc}</p>
      <div class="popup-actions"><button class="btn btn-plain" data-action="pickUpAttachment" data-cx="${cx}" data-cy="${cy}">Pick up</button></div>`;
    pop.hidden = false;
    placePopup(state, { x: Math.min(cx, state.cols - 1), y: Math.min(cy, state.rows - 1) }, pop);
  }

  ui.renderPopup = function () {
    const state = ui.game.state;
    if (String(ui.selected).startsWith("att:")) return renderAttachmentPopup(state);
    const b = state.buildings.find(other => other.uid === ui.selected);
    if (!b) return ui.closeBuilding();
    const def = FP.WORKER_BY_ID[b.workerId];
    const maxed = b.level >= FP.WORKER_MAX_LEVEL;
    const cost = FP.buildingUpgradeCost(b);
    const pop = ui.els.popup;
    pop.style.setProperty("--rarity", FP.RARITIES[def.rarity].color);
    pop.innerHTML = `<div class="popup-head"><b>${def.building}</b><span>Level ${b.level} of ${FP.WORKER_MAX_LEVEL}</span></div>
      <p>${def.desc}</p>
      <p class="meta">${workerStats(def, b.level)}</p>
      ${maxed ? "" : `<p class="meta next">At level ${b.level + 1}: ${workerStats(def, b.level + 1)}</p>`}
      <div class="popup-actions">
        ${maxed
          ? `<button class="btn" disabled>Fully upgraded</button>`
          : `<button class="btn btn-gold ${state.coins < cost ? "poor" : ""}" data-action="upgradeBuilding" data-uid="${b.uid}">Upgrade ${coin}${FP.formatCoins(cost)}</button>`}
        <button class="btn btn-plain" data-action="pickUp" data-uid="${b.uid}">Pick up</button>
      </div>`;
    pop.hidden = false;
    placePopup(state, b, pop);
  };

  // Puts the popup next to the building, on whichever side has room.
  function placePopup(state, b, pop) {
    const r = FP.plotRect(FP.layout(state), b.x, b.y);
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = r.x + r.s + 12;
    if (x + w > 900) x = r.x - w - 12;
    const y = FP.clamp(r.y - 10, 72, 625 - h);
    pop.style.transform = `translate(${x}px, ${y}px)`;
  }

  ui.renderPanel = function () {
    const scroll = ui.els.panel.scrollTop;
    ui.els.panel.innerHTML = PANELS[ui.tab](ui.game.state);
    ui.els.panel.scrollTop = scroll;
  };

  // ---------- Every frame ----------

  ui.tick = function (now, dt) {
    const state = ui.game.state;

    // Count the coin display toward the real number.
    if (ui.shownCoins !== state.coins && now >= ui.holdCoinsUntil) {
      const diff = state.coins - ui.shownCoins;
      ui.shownCoins = Math.abs(diff) < 1 ? state.coins : ui.shownCoins + diff * Math.min(1, dt * 10);
      ui.els.coinCount.textContent = FP.formatCoins(Math.round(ui.shownCoins));
    }

    if (ui.tab === "shop") {
      const timer = document.getElementById("shop-timer");
      if (timer) {
        const shop = ui.shopView === "tools" ? state.toolShop : ui.shopView === "workers" ? state.workerShop : state.shop;
        const text = FP.formatClock(shop.nextRefresh - now);
        if (timer.textContent !== text) timer.textContent = text;
      }
    }

    const weather = FP.currentWeather(state);
    if (weather.id !== ui.lastWeather) {
      ui.lastWeather = weather.id;
      ui.els.weatherIcon.src = FP.weatherIconURL(weather.id);
      ui.els.weatherName.textContent = weather.name;
      ui.els.weather.title = weather.strip ? "The wind may blow modifiers off plants without a fence. Click for the guide."
        : weather.mod ? "Plants may become " + FP.weatherMods(weather).map(id => FP.MODS[id].name).join(" or ") + ". Click for the guide." : "Click for the guide.";
      ui.refreshTab("guide");
    }
    const left = FP.formatClock(state.weather.endsAt - now);
    const timeText = weather.id !== "clear" ? "Ends in " + left : "Changes in " + left;
    if (ui.els.weatherTime.textContent !== timeText) ui.els.weatherTime.textContent = timeText;

    const claimable = FP.claimableGoals(state).length;
    if (claimable !== ui.lastGoals) {
      ui.lastGoals = claimable;
      ui.els.goalCount.hidden = claimable === 0;
      ui.els.goalCount.textContent = claimable;
    }

    const info = FP.levelFromXp(state.xp);
    const xpWidth = info.need ? Math.floor(info.into / info.need * 100) + "%" : "100%";
    if (info.level !== ui.lastLevel) {
      ui.lastLevel = info.level;
      ui.els.levelNum.textContent = info.level;
      ui.els.levelLabel.textContent = "Level " + info.level;
    }
    if (ui.els.xpBar.style.width !== xpWidth) {
      ui.els.xpBar.style.width = xpWidth;
      ui.els.levelChip.title = info.need ? Math.floor(info.into) + " of " + info.need + " XP to level " + (info.level + 1) : "Highest level";
    }

    const time = FP.timeOfDay(now);
    if (time.id !== ui.lastTimeId) {
      ui.lastTimeId = time.id;
      ui.els.clockIcon.src = FP.weatherIconURL(time.night ? "moonlight" : time.id === "dawn" || time.id === "dusk" ? "clear" : "sunny");
      ui.els.clockName.textContent = time.name;
    }
    const clock = FP.clockText(now);
    if (ui.els.clockTime.textContent !== clock) ui.els.clockTime.textContent = clock;

    // Floor arrows, with a count of ripe plants waiting on the floors above and below.
    const many = state.floors.length > 1;
    ui.els.floors.hidden = !many;
    if (many) {
      const label = "Floor " + (state.floor + 1);
      if (ui.els.floorLabel.textContent !== label) ui.els.floorLabel.textContent = label;
      const [up, down] = ui.els.floors.querySelectorAll("button");
      up.disabled = state.floor >= state.floors.length - 1;
      down.disabled = state.floor <= 0;
      const ripe = i => (i >= 0 && i < state.floors.length ? FP.ripeOnFloor(state, i, now) : 0);
      for (const [btn, n] of [[up, ripe(state.floor + 1)], [down, ripe(state.floor - 1)]]) {
        const badge = btn.querySelector(".badge");
        badge.hidden = n === 0;
        if (n) badge.textContent = n > 99 ? "99+" : n;
      }
    }

    if (state.harvest.length !== ui.lastBasket) {
      ui.lastBasket = state.harvest.length;
      ui.els.basketCount.hidden = ui.lastBasket === 0;
      ui.els.basketCount.textContent = ui.lastBasket > 99 ? "99+" : ui.lastBasket;
    }

    const ripe = FP.ripeCells(state, now).length;
    if (ripe !== ui.lastRipe) {
      ui.lastRipe = ripe;
      ui.els.harvestAll.textContent = ripe > 0 ? "Harvest all (" + ripe + ")" : "Harvest all";
      ui.els.harvestAll.disabled = ripe === 0;
    }
  };

  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
  }

  ui.bumpCoins = () => replay(ui.els.coins, "bump");
  ui.pulseLevel = () => replay(ui.els.levelChip, "bump");
  ui.pulseTab = tab => replay(ui.els.tabs.querySelector(`[data-tab="${tab}"]`), "pulse");
  ui.pulseWeather = () => replay(ui.els.weather, "bump");
  ui.slotFor = (type, id) => ui.els.slots.querySelector(`.slot[data-type="${type}"][data-id="${id}"]`);
  ui.pulseSlot = (type, id) => replay(ui.slotFor(type, id), "pulse");
  ui.coinTarget = () => FP.renderer.centerOf(ui.els.coins.querySelector(".coin-icon"));

  ui.toast = function (message, special) {
    const el = document.createElement("div");
    el.className = "toast" + (special ? " special" : "");
    el.textContent = message;
    ui.els.toasts.appendChild(el);
    while (ui.els.toasts.children.length > 3) ui.els.toasts.firstChild.remove();
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 400);
    }, special ? 4200 : 2800);
  };
})(window.FP);
