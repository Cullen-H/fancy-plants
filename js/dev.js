// A panel of test buttons for trying features without playing for hours.
// It only shows up when the page address ends in ?dev, so regular players never see it.
// Anything done here changes your real save, so test on a device or browser you don't mind messing up.
(function (FP) {
  if (!/[?&]dev\b/.test(location.search)) return;

  FP.devHourOffset = 0; // time.js adds this to the clock, so the panel can jump to any time of day

  const BUTTONS = [
    { group: "Coins", items: [
      ["+1,000", g => { g.state.coins += 1000; }],
      ["+100,000", g => { g.state.coins += 100000; }],
      ["+10 million", g => { g.state.coins += 10000000; }],
    ] },
    { group: "Farm level", items: [
      ["+1 level", g => { const info = FP.levelFromXp(g.state.xp); g.state.xp += info.need - info.into + 0.01; }],
      ["Level 12 (rebirth)", g => setLevel(g.state, 12)],
      ["Level 20", g => setLevel(g.state, 20)],
    ] },
    { group: "Plants", items: [
      ["Ripen everything", g => g.state.plots.forEach(row => row.forEach(p => { if (p) p.plantedAt = Date.now() - p.growMs - 1; }))],
      ["Fill farm with random seeds", g => fillFarm(g.state)],
      ["5 crops in basket", g => addCrops(g.state)],
      ["Seeds of every kind", g => FP.SEEDS.forEach(s => { g.state.seeds[s.id] = (g.state.seeds[s.id] || 0) + 5; })],
    ] },
    { group: "Shops", items: [
      ["Restock all shops", g => { const now = Date.now(); FP.refreshShop(g.state, now); FP.refreshToolShop(g.state, now); FP.refreshWorkerShop(g.state, now); }],
      ["Every tool, 5 uses", g => FP.TOOLS.forEach(t => { g.state.tools[t.id] = (g.state.tools[t.id] || 0) + 5; })],
      ["One of each building", g => FP.WORKERS.forEach(w => g.state.workerBag.push({ workerId: w.id, level: 1 }))],
    ] },
    { group: "Rebirth and Town", items: [
      ["+10 GMO Points", g => { g.state.rebirth.gmo += 10; }],
      ["Unlock all floors and sizes", g => { Object.assign(g.state.rebirth.skills, { wide: 3, floor2: 1, floor3: 1 }); FP.ensureFloors(g.state); }],
      ["Open black hole", g => g.action("openVoid", {})],
      ["Replay Town cutscene", g => { if (!g.state.rebirth.count) g.state.rebirth.count = 1; g.action("replayTownIntro", {}); }],
      ["Open Town", g => { if (!g.state.rebirth.townSeen) { g.state.rebirth.count = Math.max(1, g.state.rebirth.count); g.state.rebirth.townSeen = true; } g.action("openTown", {}); }],
    ] },
  ];

  function setLevel(state, level) {
    let xp = 0;
    for (let l = 1; l < level; l++) xp += FP.xpToNext(l);
    state.xp = Math.max(state.xp, xp + 0.01);
  }

  function fillFarm(state) {
    const now = Date.now();
    state.plots.forEach((row, y) => row.forEach((p, x) => {
      if (p || FP.buildingAt(state, x, y)) return;
      const seed = FP.SEEDS[Math.floor(Math.random() * FP.SEEDS.length)];
      row[x] = { seedId: seed.id, plantedAt: now - Math.random() * seed.grow * 1000, growMs: seed.grow * 1000, harvests: 0, mods: [] };
    }));
  }

  function addCrops(state) {
    for (let i = 0; i < 5; i++) {
      const seed = FP.SEEDS[Math.floor(Math.random() * FP.SEEDS.length)];
      const mods = Math.random() < 0.5 ? [["wet", "golden", "shocked", "frozen"][i % 4]] : [];
      state.harvest.push({ seedId: seed.id, value: Math.round(seed.value * FP.modMultiplier(mods)), mods, bet: false });
    }
  }

  function build(game) {
    const panel = document.createElement("div");
    panel.id = "dev";
    const weatherOptions = FP.WEATHER.map(w => `<option value="${w.id}">${w.name}</option>`).join("");
    const timeOptions = FP.TIMES.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    panel.innerHTML = `<button class="dev-toggle">Test tools</button>
      <div class="dev-body" hidden>
        <p class="dev-note">These change your real save. Remove ?dev from the address to hide this panel.</p>
        ${BUTTONS.map((g, gi) => `<div class="dev-group"><b>${g.group}</b>
          ${g.items.map((item, ii) => `<button data-dev="${gi}.${ii}">${item[0]}</button>`).join("")}</div>`).join("")}
        <div class="dev-group"><b>Weather</b><select data-dev-select="weather">${weatherOptions}</select><button data-dev-set="weather">Start it</button></div>
        <div class="dev-group"><b>Time of day</b><select data-dev-select="time">${timeOptions}</select><button data-dev-set="time">Jump to it</button></div>
      </div>`;
    document.body.appendChild(panel);

    panel.querySelector(".dev-toggle").addEventListener("click", () => {
      const body = panel.querySelector(".dev-body");
      body.hidden = !body.hidden;
    });

    panel.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.dev) {
        const [gi, ii] = b.dataset.dev.split(".").map(Number);
        const [label, run] = BUTTONS[gi].items[ii];
        run(game);
        done(game, label);
      } else if (b.dataset.devSet === "weather") {
        const id = panel.querySelector('[data-dev-select="weather"]').value;
        game.state.weather = { id, endsAt: Date.now() + (id === "clear" ? 60 : 120) * 1000 };
        done(game, "Weather set to " + FP.WEATHER_BY_ID[id].name);
      } else if (b.dataset.devSet === "time") {
        const target = FP.TIME_BY_ID[panel.querySelector('[data-dev-select="time"]').value];
        FP.devHourOffset = 0;
        const now = FP.gameHour(Date.now());
        FP.devHourOffset = (((target.from % 24) + 0.25 - now) % 24 + 24) % 24;
        done(game, "Jumped to " + target.name);
      }
    });
  }

  function done(game, label) {
    FP.ui.refresh();
    FP.save(game.state);
    FP.ui.toast("Test tools: " + label + ".");
  }

  // main.js creates the game object, so wait until the page has finished loading.
  window.addEventListener("load", () => build(FP.game));
})(window.FP);
