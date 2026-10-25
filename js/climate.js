// Heat and humidity on each plot, and the attachments that change them.
// An attachment sits on a corner point between plots and changes every plot it touches.
(function (FP) {
  const TAU = FP.TAU;

  // ---------- Data ----------

  // heat and humid are what an attachment adds to each plot it touches.
  // grow is how much faster touched plants grow. mod is a modifier touched plants can get now and then.
  FP.ATTACHMENTS = {
    sprinkler:    { name: "Sprinkler",     price: 8000,  heat: 0,  humid: 1,  grow: 0.15, color: "#4b8bff",
      desc: "Makes the plots it touches more humid, and the plants on them grow 15% faster." },
    dehumidifier: { name: "Dehumidifier",  price: 6000,  heat: 0,  humid: -1, color: "#c9a26b",
      desc: "Makes the plots it touches drier." },
    campfire:     { name: "Campfire",      price: 5000,  heat: 1,  humid: 0,  color: "#f07f1a",
      desc: "Makes the plots it touches a little warmer." },
    heater:       { name: "Heater",        price: 15000, heat: 2,  humid: 0,  mod: "heated", color: "#e5533d",
      desc: "Makes the plots it touches much hotter. Plants next to it can become Heated now and then." },
    fan:          { name: "Electric Fan",  price: 10000, heat: -1, humid: 0,  mod: "breeze", color: "#9fd8f0",
      desc: "Makes the plots it touches a little cooler. Plants next to it can catch a Breeze now and then." },
    ice:          { name: "Block of Ice",  price: 4000,  heat: -1, humid: 0,  mod: "chilled", color: "#bfefff",
      desc: "Makes the plots it touches a little cooler. Plants next to it can become Chilled now and then." },
    freezer:      { name: "Freezer",       price: 30000, heat: -2, humid: 0,  mod: "frozen", color: "#5aa9ff",
      desc: "Makes the plots it touches much colder. Plants next to it can become Frozen now and then." },
  };
  FP.ATTACHMENT_IDS = Object.keys(FP.ATTACHMENTS);
  FP.ATTACHMENT_MOD_CHANCE = 0.01; // per touched plant, every few seconds

  // Heat runs from -2 to 2 and humidity from -1 to 2.
  FP.HEAT_NAMES = ["Cold", "Cool", "Normal", "Warm", "Hot"];
  FP.heatName = h => FP.HEAT_NAMES[FP.clamp(h, -2, 2) + 2];
  FP.humidName = h => (h <= -1 ? "Dry" : h >= 1 ? "Humid" : "Normal");

  // What each special tile starts at before attachments.
  FP.TILE_CLIMATE = { sand: { heat: 0, humid: -1 }, water: { heat: -1, humid: 2 } };

  // ---------- Where things are ----------

  // The four corner points around a plot.
  const cornersOf = (x, y) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];

  FP.attachmentAt = (state, cx, cy) => (state.attachments || []).find(a => a.cx === cx && a.cy === cy) || null;

  // Attachments touching a plot.
  FP.attachmentsOn = (state, x, y) => cornersOf(x, y).map(([cx, cy]) => FP.attachmentAt(state, cx, cy)).filter(Boolean);

  FP.tileClimate = function (state, x, y) {
    const base = FP.TILE_CLIMATE[FP.tileAt(state, x, y)] || { heat: 0, humid: 0 };
    let heat = base.heat, humid = base.humid;
    for (const a of FP.attachmentsOn(state, x, y)) {
      heat += FP.ATTACHMENTS[a.id].heat;
      humid += FP.ATTACHMENTS[a.id].humid;
    }
    return { heat: FP.clamp(heat, -2, 2), humid: FP.clamp(humid, -1, 2) };
  };

  FP.climateText = c => FP.heatName(c.heat) + " and " + FP.humidName(c.humid).toLowerCase();

  // True when a plot's heat and humidity suit a seed. Seeds without climate needs grow anywhere.
  FP.climateFits = function (seed, c) {
    const n = seed.needs || {};
    if (n.heat !== undefined && c.heat !== n.heat) return false;
    if (n.humid !== undefined && FP.humidName(c.humid) !== FP.humidName(n.humid)) return false;
    return true;
  };

  FP.needsClimate = seed => !!seed.needs && (seed.needs.heat !== undefined || seed.needs.humid !== undefined);

  // What a seed wants, like "cold and humid".
  FP.climateWanted = seed => {
    const n = seed.needs;
    return [n.heat !== undefined ? FP.heatName(n.heat).toLowerCase() : null,
            n.humid !== undefined ? FP.humidName(n.humid).toLowerCase() : null].filter(Boolean).join(" and ");
  };

  // ---------- Placing ----------

  FP.cornerValid = (state, cx, cy) => cx >= 0 && cy >= 0 && cx <= state.cols && cy <= state.rows;

  FP.placeAttachment = function (state, id, cx, cy) {
    if (!state.attachmentBag[id]) return "You don't have " + FP.withArticle(FP.ATTACHMENTS[id].name) + ".";
    if (!FP.cornerValid(state, cx, cy)) return "Attachments go on the corners between plots.";
    if (FP.attachmentAt(state, cx, cy)) return "There's already an attachment on that corner.";
    state.attachments.push({ id, cx, cy });
    state.attachmentBag[id]--;
    if (!state.attachmentBag[id]) delete state.attachmentBag[id];
    return null;
  };

  FP.pickUpAttachment = function (state, cx, cy) {
    const a = FP.attachmentAt(state, cx, cy);
    if (!a) return null;
    state.attachments.splice(state.attachments.indexOf(a), 1);
    state.attachmentBag[a.id] = (state.attachmentBag[a.id] || 0) + 1;
    return a;
  };

  FP.buyAttachment = function (state, id) {
    const def = FP.ATTACHMENTS[id];
    if (state.coins < def.price) return "You need " + FP.formatCoins(def.price - state.coins) + " more coins for that.";
    state.coins -= def.price;
    state.attachmentBag[id] = (state.attachmentBag[id] || 0) + 1;
    return null;
  };

  // ---------- Every second ----------

  // Pauses plants whose plot has the wrong climate, pushes plants near Sprinklers along,
  // and now and then gives plants near an attachment its modifier. Runs on the floor that is set.
  // onChange(x, y, plant, modId, result) runs for each plant that gained a modifier.
  FP.climateTick = function (state, now, dtMs, rollMods, onChange) {
    state.plots.forEach((row, y) => row.forEach((plant, x) => {
      if (!plant) return;
      const seed = FP.SEED_BY_ID[plant.seedId];
      if (FP.needsClimate(seed) && !plant.needsFeed) {
        if (FP.climateFits(seed, FP.tileClimate(state, x, y))) FP.resumePlant(plant, now);
        else FP.pausePlant(plant, now);
      }
      if (plant.pausedAt) return;
      const near = FP.attachmentsOn(state, x, y);
      // Sprinklers speed up the plants they touch. Goddess Rice also speeds up for each rice plant beside it in the row.
      let grow = near.length ? Math.max(0, ...near.map(a => FP.ATTACHMENTS[a.id].grow || 0)) : 0;
      if (seed.rowBonus) {
        for (const nx of [x - 1, x + 1]) {
          const other = row[nx];
          if (other && other.seedId === seed.id) grow += seed.rowBonus;
        }
      }
      if (grow && !FP.isRipe(plant, now)) plant.plantedAt = Math.max(plant.plantedAt - dtMs * grow, now - plant.growMs);
      if (!near.length) return;
      if (!rollMods) return;
      for (const a of near) {
        const modId = FP.ATTACHMENTS[a.id].mod;
        if (!modId || Math.random() >= FP.ATTACHMENT_MOD_CHANCE) continue;
        const result = FP.addMod(state, plant, modId);
        if (result) onChange(x, y, plant, modId, result);
      }
    }));
  };

  // ---------- Pictures ----------

  function outlined(g, fill, line = 3) {
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = line;
    g.strokeStyle = FP.shade(fill, -0.45);
    g.stroke();
  }

  const DRAW = {
    sprinkler(g) {
      FP.roundRect(g, 42, 46, 12, 34, 4); outlined(g, "#8a96a3");
      g.beginPath(); g.arc(48, 44, 14, 0, TAU); outlined(g, "#4b8bff");
      g.fillStyle = "#9fd0ff";
      [[20, 30], [28, 18], [48, 12], [68, 18], [76, 30]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); });
    },
    dehumidifier(g) {
      FP.roundRect(g, 24, 20, 48, 60, 10); outlined(g, "#e8dfcc");
      FP.roundRect(g, 32, 30, 32, 14, 4); outlined(g, "#8a96a3", 2);
      g.beginPath(); g.moveTo(48, 52); g.quadraticCurveTo(60, 66, 48, 72); g.quadraticCurveTo(36, 66, 48, 52); outlined(g, "#c9a26b", 2);
    },
    campfire(g) {
      g.lineCap = "round";
      [[-0.5, "#8a5a36"], [0.5, "#7a4e2d"]].forEach(([a, c]) => {
        g.save(); g.translate(48, 74); g.rotate(a); FP.roundRect(g, -28, -6, 56, 12, 6); outlined(g, c, 2); g.restore();
      });
      g.beginPath(); g.moveTo(48, 18); g.quadraticCurveTo(70, 46, 60, 66); g.lineTo(36, 66); g.quadraticCurveTo(26, 46, 48, 18); outlined(g, "#f07f1a", 2.5);
      g.beginPath(); g.moveTo(48, 38); g.quadraticCurveTo(58, 54, 54, 64); g.lineTo(42, 64); g.quadraticCurveTo(38, 54, 48, 38); g.fillStyle = "#ffd23f"; g.fill();
    },
    heater(g) {
      FP.roundRect(g, 18, 26, 60, 50, 10); outlined(g, "#e5533d");
      g.strokeStyle = "#ffd23f"; g.lineWidth = 4;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(30 + i * 12, 36); g.lineTo(30 + i * 12, 66); g.stroke(); }
      g.strokeStyle = "rgba(255,120,60,0.8)"; g.lineWidth = 3; g.lineCap = "round";
      [34, 48, 62].forEach(x => { g.beginPath(); g.moveTo(x, 20); g.quadraticCurveTo(x - 6, 14, x, 6); g.stroke(); });
    },
    fan(g) {
      FP.roundRect(g, 44, 54, 8, 24, 3); outlined(g, "#8a96a3", 2);
      FP.roundRect(g, 30, 76, 36, 8, 4); outlined(g, "#8a96a3", 2);
      g.beginPath(); g.arc(48, 40, 26, 0, TAU); outlined(g, "#dff3fb");
      g.fillStyle = "#4bb8e6";
      for (let i = 0; i < 3; i++) {
        g.save(); g.translate(48, 40); g.rotate(i * TAU / 3);
        g.beginPath(); g.ellipse(0, -11, 7, 12, 0.3, 0, TAU); g.fill(); g.restore();
      }
      g.beginPath(); g.arc(48, 40, 5, 0, TAU); outlined(g, "#8a96a3", 2);
    },
    ice(g) {
      g.beginPath(); g.moveTo(26, 36); g.lineTo(52, 24); g.lineTo(74, 36); g.lineTo(74, 66); g.lineTo(48, 80); g.lineTo(26, 66); g.closePath(); outlined(g, "#bfefff");
      g.beginPath(); g.moveTo(26, 36); g.lineTo(48, 48); g.lineTo(74, 36); g.moveTo(48, 48); g.lineTo(48, 80);
      g.strokeStyle = "rgba(90,169,255,0.7)"; g.lineWidth = 2; g.stroke();
      g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.ellipse(38, 56, 4, 8, 0.4, 0, TAU); g.fill();
    },
    freezer(g) {
      FP.roundRect(g, 22, 12, 52, 72, 8); outlined(g, "#e8f4ff");
      g.strokeStyle = "#8a96a3"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(22, 38); g.lineTo(74, 38); g.stroke();
      FP.roundRect(g, 62, 18, 5, 14, 2); outlined(g, "#8a96a3", 1.5);
      FP.roundRect(g, 62, 46, 5, 18, 2); outlined(g, "#8a96a3", 1.5);
      g.strokeStyle = "#5aa9ff"; g.lineWidth = 3; g.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI;
        g.beginPath(); g.moveTo(42 + Math.cos(a) * 10, 60 + Math.sin(a) * 10); g.lineTo(42 - Math.cos(a) * 10, 60 - Math.sin(a) * 10); g.stroke();
      }
    },
  };

  // Each picture is drawn once onto its own canvas, which the farm draws straight from.
  const canvases = {}, urls = {};
  FP.attachmentCanvas = function (id) {
    if (!canvases[id]) {
      const c = document.createElement("canvas");
      c.width = c.height = 96;
      const g = c.getContext("2d");
      g.lineJoin = "round";
      DRAW[id](g);
      canvases[id] = c;
    }
    return canvases[id];
  };
  FP.attachmentIconURL = id => urls[id] || (urls[id] = FP.attachmentCanvas(id).toDataURL());
})(window.FP);
