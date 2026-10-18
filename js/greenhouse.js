// The Green House menu: a 3 by 3 grid of plants with temperature and humidity controls.
// Plants are put in with whatever seed is held in the bar, the same way as on the farm.
(function (FP) {
  const gh = FP.greenhouseMenu = { open: false, uid: null };
  const coin = `<span class="coin-icon small"></span>`;

  gh.init = function (game) {
    gh.game = game;
    gh.el = document.getElementById("gh-modal");
    gh.el.addEventListener("click", onClick);
  };

  // The Green House building being shown, wherever it is.
  function building() {
    const state = gh.game.state;
    return state.buildings.find(b => b.uid === gh.uid) || null;
  }

  gh.show = function (uid) {
    gh.open = true;
    gh.uid = uid;
    gh.el.hidden = false;
    gh.render();
  };

  gh.hide = function () {
    gh.open = false;
    gh.uid = null;
    gh.el.hidden = true;
  };

  function cellStatus(b, plant, now) {
    const seed = FP.SEED_BY_ID[plant.seedId];
    if (plant.needsFeed) return { text: "Needs Fertilizer", kind: "wait" };
    if (!FP.ghSuits(b.inner, seed)) {
      const n = seed.needs;
      const want = [n.temp !== undefined && n.temp !== b.inner.temp ? FP.TEMPS[n.temp].toLowerCase() : null,
                    n.humid !== undefined && n.humid !== b.inner.humid ? FP.HUMIDS[n.humid].toLowerCase() : null].filter(Boolean);
      return { text: "Wants " + want.join(" and "), kind: "wait" };
    }
    if (FP.isRipe(plant, now)) return { text: "Ripe", kind: "ripe" };
    return { text: FP.formatTime(FP.timeLeft(plant, now)), kind: "grow" };
  }

  gh.render = function () {
    const b = building();
    if (!b) return gh.hide();
    const now = Date.now();
    const seg = (key, labels, current) => `<div class="seg gh-seg">${labels.map((l, i) =>
      `<button data-set="${key}" data-value="${i}" class="${i === current ? "on" : ""}">${l}</button>`).join("")}</div>`;
    const cells = b.inner.plots.map((plant, i) => {
      if (!plant) return `<button class="gh-cell empty" data-cell="${i}"><span>Empty</span></button>`;
      const seed = FP.SEED_BY_ID[plant.seedId];
      const st = cellStatus(b, plant, now);
      return `<button class="gh-cell ${st.kind}" data-cell="${i}" title="${seed.name}">
        <img src="${FP.seedIconURL(seed)}" alt="">
        <span class="gh-bar"><i style="width:${Math.floor(FP.growPercent(plant, now) * 100)}%"></i></span>
        <span>${st.text}</span></button>`;
    }).join("");
    gh.el.innerHTML = `<div class="modal-box modal-greenhouse">
        <div class="modal-head"><h2>Green House</h2><button class="modal-close" data-close>Close</button></div>
        <p class="modal-sub">Pick a seed from the bar below, then click an empty spot. Click a ripe plant to harvest it. Plants in here are sheltered from the weather.</p>
        <div class="gh-layout">
          <div class="gh-grid">${cells}</div>
          <div class="gh-controls">
            <b>Temperature</b>${seg("temp", FP.TEMPS, b.inner.temp)}
            <b>Humidity</b>${seg("humid", FP.HUMIDS, b.inner.humid)}
            <p class="modal-sub">Frost Orchids want it cold and humid. Ember Peppers want it hot and dry. Ordinary plants grow in any setting.</p>
          </div>
        </div>
      </div>`;
  };

  // Refreshed every second while open, so timers count down.
  gh.tick = function () {
    if (gh.open) gh.render();
  };

  function onClick(e) {
    const el = e.target.closest("button");
    if (e.target === gh.el) return gh.hide(); // clicking the dim background closes it
    if (!el) return;
    if (el.hasAttribute("data-close")) return gh.hide();
    const b = building();
    if (!b) return gh.hide();
    const state = gh.game.state;
    const now = Date.now();

    if (el.dataset.set) {
      b.inner[el.dataset.set] = Number(el.dataset.value);
      FP.ghCheck(b, now);
      FP.sfx("click");
      FP.save(state);
      return gh.render();
    }

    if (el.dataset.cell !== undefined) {
      const i = Number(el.dataset.cell);
      const plant = b.inner.plots[i];
      const tool = FP.ui.tool;
      if (!plant) {
        if (!tool || tool.type !== "seed") return gh.game.toast("Pick a seed from the bar below first.");
        const err = FP.ghPlant(state, b, i, tool.seedId, now);
        if (err) { FP.sfx("error"); return gh.game.toast(err); }
        FP.sfx("plant");
        if (!state.seeds[tool.seedId]) FP.ui.setTool(null);
        FP.ui.renderHotbar();
        return gh.render();
      }
      if (plant.needsFeed && tool && tool.type === "tool" && tool.toolId === "fertilizer") {
        FP.feedPlant(plant, now);
        FP.ghCheck(b, now);
        state.tools.fertilizer--;
        if (state.tools.fertilizer <= 0) { delete state.tools.fertilizer; FP.ui.setTool(null); }
        FP.sfx("plant");
        FP.ui.renderHotbar();
        return gh.render();
      }
      if (tool && tool.type === "shovel") {
        b.inner.plots[i] = null;
        FP.sfx("dig");
        gh.game.toast("You dug up the " + FP.SEED_BY_ID[plant.seedId].name + ".");
        return gh.render();
      }
      if (FP.isRipe(plant, now)) {
        const from = FP.renderer.centerOf(el);
        const result = FP.harvestPlant(state, plant, now);
        if (result.gone) b.inner.plots[i] = null;
        FP.ghCheck(b, now);
        gh.game.action("cropHarvested", { seedId: result.item.seedId, x: from.x, y: from.y });
        return gh.render();
      }
      const st = cellStatus(b, plant, now);
      gh.game.toast(st.kind === "wait" ? "The " + FP.SEED_BY_ID[plant.seedId].name + " is waiting. " + (plant.needsFeed ? "Use Fertilizer on it." : "It " + st.text.toLowerCase() + ".") : "That isn't ripe yet.");
    }
  }
})(window.FP);
