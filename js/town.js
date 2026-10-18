// The Town, which opens after the first rebirth. It has a Casino where crops can be bet,
// and a Weather Station where a crop buys a say in the next weather.
(function (FP) {
  const TAU = FP.TAU;
  const W = 1280, H = 720;

  // ---------- Rules ----------

  // How much a crop's value is multiplied by. Every game is close to an even bet over
  // many plays, so the Casino is a gamble and not a way to print coins.
  FP.CASINO = {
    lose: 0.5,
    coin: 1.5,
    rps: 1.6,
    blackjack: 1.6, natural: 2, push: 1,
    pair: 1.25, triple: 5, jackpot: 10,
  };

  // Crops that haven't been bet yet, most valuable first. Each crop can only be bet once.
  FP.betItems = state => state.harvest.filter(item => !item.bet).sort((a, b) => b.value - a.value);

  FP.settleBet = function (item, mult) {
    item.value = Math.max(1, Math.round(item.value * mult));
    item.bet = true;
  };

  // A score for how impressive a crop is: rarity counts, and so does value.
  FP.cropScore = (state, item) => FP.SEED_BY_ID[item.seedId].rarity + Math.log10(FP.sellPrice(state, item) + 1);

  // The weatherman takes the crop and sets the next weather. A better crop flattens the odds,
  // so rare weathers come up nearly as often as common ones.
  FP.weatherOptions = state => FP.WEATHER.filter(w => w.mod && FP.weatherUnlocked(state, w.id));

  // Returns null, and keeps the crop, when the farm is too low a level for any weather.
  FP.weathermanPick = function (state, item, now) {
    const score = FP.cropScore(state, item);
    const pull = FP.clamp(score / 10, 0, 1);
    const options = FP.weatherOptions(state);
    if (!options.length) return null;
    const weights = options.map(w => w.weight * Math.pow(40 / w.weight, pull));
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    let pick = options[0];
    for (let i = 0; i < options.length; i++) {
      roll -= weights[i];
      if (roll < 0) { pick = options[i]; break; }
    }
    state.harvest = state.harvest.filter(other => other !== item);
    state.weather.forecast = pick.id;
    // If the sky is clear, the forecast weather shows up soon instead of after a long wait.
    if (state.weather.id === "clear") state.weather.endsAt = Math.min(state.weather.endsAt, now + 15000);
    return { weather: pick, score };
  };

  // ---------- Town screen ----------
  // The Town is a round plaza with a fountain in the middle and buildings around the edge.
  // Each building is drawn at a "design" size and scaled down by k to fit its spot.
  // cx and base are where the middle of its front wall meets the ground.

  const PLAZA = { x: 640, y: 430, rx: 450, ry: 165 };
  const FOUNTAIN = { x: 640, y: 425 };

  const BUILDINGS = [
    { id: "seedshop", name: "Seed Shop",      cx: 370,  base: 292, dw: 220, dh: 220, k: 0.72, open: true },
    { id: "casino",  name: "Casino",          cx: 655,  base: 272, dw: 320, dh: 300, k: 0.62, open: true },
    { id: "weather", name: "Weather Station", cx: 935,  base: 312, dw: 280, dh: 280, k: 0.58, open: true },
    { id: "soon2",   name: "Coming Soon",     cx: 190,  base: 490, dw: 200, dh: 230, k: 0.78, open: false },
    { id: "requests", name: "Request Board",  cx: 1090, base: 505, dw: 210, dh: 200, k: 0.78, open: true },
    { id: "soon4",   name: "Coming Soon",     cx: 425,  base: 672, dw: 240, dh: 190, k: 0.78, open: false },
    { id: "soon5",   name: "Coming Soon",     cx: 640,  base: 695, dw: 120, dh: 230, k: 0.75, open: false },
    { id: "soon6",   name: "Coming Soon",     cx: 830,  base: 668, dw: 180, dh: 210, k: 0.8,  open: false },
  ];

  // The box on screen a building covers, for hovering and clicking.
  function hitBox(b) {
    const w = b.dw * b.k, h = (b.dh + (b.id === "weather" ? 40 : 0)) * b.k;
    return { x: b.cx - w / 2, y: b.base - h, w, h };
  }

  const inFountain = p => Math.pow((p.x - FOUNTAIN.x) / 85, 2) + Math.pow((p.y - FOUNTAIN.y + 25) / 60, 2) < 1;

  const town = FP.town = { open: false, hover: null, modal: null, tossed: [], scale: 1 };

  town.init = function (game) {
    town.game = game;
    town.el = document.getElementById("town");
    town.canvas = town.canvas || document.getElementById("town-canvas");
    town.ctx = town.canvas.getContext("2d");
    town.modalEl = document.getElementById("town-modal");

    town.canvas.addEventListener("pointermove", e => {
      const p = FP.renderer.toGame(e.clientX, e.clientY);
      // Buildings closer to the front are checked first, since they sit on top.
      const front = BUILDINGS.slice().sort((a, b) => b.base - a.base);
      town.hover = front.find(b => {
        const r = hitBox(b);
        return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
      }) || (inFountain(p) ? { id: "fountain", name: "Fountain", open: true } : null);
      town.canvas.style.cursor = town.hover ? "pointer" : "default";
    });
    town.canvas.addEventListener("pointerdown", e => {
      town.canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: e.clientX, clientY: e.clientY }));
      if (!town.hover || town.modal) return;
      if (!town.hover.open) return town.game.toast("This building is still being built. Check back in a later update.");
      FP.sfx("click");
      town.openModal(town.hover.id);
    });
    document.getElementById("town-back").addEventListener("click", () => game.action("closeTown", {}));
    town.modalEl.addEventListener("click", onModalClick);
  };

  town.resize = function (pixelScale) {
    town.scale = pixelScale;
    town.canvas = town.canvas || document.getElementById("town-canvas");
    town.canvas.width = Math.round(W * pixelScale);
    town.canvas.height = Math.round(H * pixelScale);
  };

  town.show = function () {
    town.open = true;
    town.el.hidden = false;
    town.closeModal();
  };

  town.hide = function () {
    town.open = false;
    town.el.hidden = true;
    town.closeModal();
  };

  // ---------- Drawing ----------

  function outlined(ctx, color, width = 3) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = width;
    ctx.strokeStyle = FP.shade(color, -0.45);
    ctx.stroke();
  }

  function windowPane(ctx, x, y, w, h, lit) {
    FP.roundRect(ctx, x, y, w, h, 4);
    outlined(ctx, lit ? "#ffe9a8" : "#bfe6ff", 2);
  }

  // The building functions below draw with (0, 0) at the bottom left corner of the
  // front wall, at the building's design size. Up is negative y.

  function drawCasino(ctx, b, t) {
    const w = b.dw, top = -b.dh;
    FP.roundRect(ctx, 0, top, w, b.dh, 8);
    outlined(ctx, "#7a2a4a");
    // Gold trim and a marquee of blinking lights
    FP.roundRect(ctx, 20, top + 20, w - 40, 70, 10);
    outlined(ctx, "#2a0f1f");
    for (let i = 0; i < 18; i++) {
      const lx = 28 + i * ((w - 56) / 17);
      for (const ly of [top + 26, top + 84]) {
        const on = (Math.floor(t * 4) + i) % 2 === 0;
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, TAU);
        ctx.fillStyle = on ? "#ffe14d" : "#7a5a1a";
        ctx.fill();
      }
    }
    ctx.font = "700 38px " + FP.displayFont();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd23f";
    ctx.shadowColor = "#ff4fa3";
    ctx.shadowBlur = 12 + 6 * Math.sin(t * 3);
    ctx.fillText("CASINO", w / 2, top + 70);
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) windowPane(ctx, 34 + i * 90, top + 120, 60, 50, true);
    FP.roundRect(ctx, w / 2 - 50, -100, 100, 100, 6);
    outlined(ctx, "#3a1424");
    ctx.beginPath();
    ctx.moveTo(w / 2, -100);
    ctx.lineTo(w / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, -125, 18, 0, TAU);
    outlined(ctx, "#f5b82e");
  }

  function drawStation(ctx, b, t) {
    const w = b.dw, top = -b.dh + 70;
    // Tower with a spinning dish on top
    FP.roundRect(ctx, w - 90, top - 90, 50, 100, 4);
    outlined(ctx, "#dfe8ef");
    ctx.save();
    ctx.translate(w - 65, top - 100);
    ctx.scale(Math.cos(t * 1.5), 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI);
    outlined(ctx, "#ffffff");
    ctx.restore();
    // A weather vane turning in the wind
    ctx.save();
    ctx.translate(60, top - 30);
    ctx.strokeStyle = "#4a2d16";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.lineTo(0, -10);
    ctx.stroke();
    ctx.scale(Math.cos(t * 0.8), 1);
    ctx.beginPath();
    ctx.moveTo(-22, -10); ctx.lineTo(22, -10); ctx.lineTo(14, -18); ctx.moveTo(22, -10); ctx.lineTo(14, -2);
    ctx.stroke();
    ctx.restore();
    FP.roundRect(ctx, 0, top, w, -top, 8);
    outlined(ctx, "#4b8bff");
    FP.roundRect(ctx, 16, top + 16, w - 32, 44, 8);
    outlined(ctx, "#f3f8ff", 2);
    ctx.font = "700 24px " + FP.displayFont();
    ctx.textAlign = "center";
    ctx.fillStyle = "#24507a";
    ctx.fillText("Weather Station", w / 2, top + 46);
    windowPane(ctx, 30, top + 80, 70, 56, false);
    windowPane(ctx, w - 100, top + 80, 70, 56, false);
    ctx.beginPath();
    ctx.arc(65, top + 108, 12, 0, TAU);
    ctx.fillStyle = `rgba(120,255,200,${0.5 + 0.4 * Math.sin(t * 4)})`;
    ctx.fill();
    FP.roundRect(ctx, w / 2 - 34, -90, 68, 90, 6);
    outlined(ctx, "#2f5f8f");
  }

  function drawSeedShop(ctx, b, t) {
    const w = b.dw, h = b.dh, top = -h;
    FP.roundRect(ctx, 0, top, w, h, 8);
    outlined(ctx, "#6fae5a");
    // Striped awning
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * w / 8 - 6, top + 54);
      ctx.lineTo((i + 1) * w / 8 + 6, top + 54);
      ctx.lineTo((i + 1) * w / 8 + 6, top + 80);
      ctx.quadraticCurveTo((i + 0.5) * w / 8, top + 92, i * w / 8 - 6, top + 80);
      ctx.closePath();
      outlined(ctx, i % 2 ? "#fff4d6" : "#e8412c", 2);
    }
    FP.roundRect(ctx, 24, top + 10, w - 48, 38, 8);
    outlined(ctx, "#fff4d6", 2);
    ctx.font = "700 26px " + FP.displayFont();
    ctx.textAlign = "center";
    ctx.fillStyle = "#2f7d32";
    ctx.fillText("SEEDS", w / 2, top + 39);
    windowPane(ctx, 20, top + 104, 64, 54, true);
    // Seed packets in the window
    ["#f28c28", "#e8412c", "#9b59f0"].forEach((c, i) => {
      FP.roundRect(ctx, 28 + i * 19, top + 118, 14, 22, 2);
      outlined(ctx, c, 1.5);
    });
    FP.roundRect(ctx, w - 90, -96, 64, 96, 6);
    outlined(ctx, "#7a4e2d");
    ctx.beginPath();
    ctx.arc(w - 36, -48, 4, 0, TAU);
    ctx.fillStyle = "#ffd23f";
    ctx.fill();
  }

  // A covered notice board on two posts, with notes pinned to it.
  function drawRequestBoard(ctx, b, t) {
    const w = b.dw, h = b.dh, top = -h;
    for (const x of [18, w - 30]) {
      FP.roundRect(ctx, x, top + 40, 14, h - 40, 3);
      outlined(ctx, "#7a4e2d", 2);
    }
    ctx.beginPath();
    ctx.moveTo(-6, top + 44);
    ctx.lineTo(w / 2, top);
    ctx.lineTo(w + 6, top + 44);
    ctx.closePath();
    outlined(ctx, "#a0703f");
    FP.roundRect(ctx, 6, top + 50, w - 12, h - 100, 6);
    outlined(ctx, "#c99a5b");
    const state = town.game.state;
    for (let i = 0; i < 4; i++) {
      const req = state.requests[i];
      if (!req || !req.who) continue;
      const nx = 22 + (i % 2) * (w / 2 - 12), ny = top + 62 + Math.floor(i / 2) * 50;
      ctx.save();
      ctx.translate(nx + 36, ny + 20);
      ctx.rotate([-0.06, 0.05, 0.04, -0.05][i]);
      FP.roundRect(ctx, -36, -20, 72, 42, 3);
      outlined(ctx, "#fffbe9", 1.5);
      ctx.fillStyle = "rgba(60,40,20,0.35)";
      for (let l = 0; l < 3; l++) ctx.fillRect(-26, -8 + l * 9, 52 - l * 10, 2);
      ctx.beginPath();
      ctx.arc(0, -16, 3.5, 0, TAU);
      ctx.fillStyle = "#e5533d";
      ctx.fill();
      ctx.restore();
    }
    FP.roundRect(ctx, w / 2 - 70, -40, 140, 30, 6);
    outlined(ctx, "#fff4d6", 2);
    ctx.font = "700 17px " + FP.displayFont();
    ctx.textAlign = "center";
    ctx.fillStyle = "#7a4e2d";
    ctx.fillText("Requests", w / 2, -19);
  }

  function drawSoon(ctx, b) {
    const w = b.dw, h = b.dh, top = -h;
    FP.roundRect(ctx, 0, top, w, h, 6);
    outlined(ctx, "#b39a7a");
    // A plain roof so each one reads as a building
    ctx.beginPath();
    ctx.moveTo(-10, top + 4);
    ctx.lineTo(w / 2, top - 40);
    ctx.lineTo(w + 10, top + 4);
    ctx.closePath();
    outlined(ctx, "#8a6a4a");
    // Boards nailed across the front
    [[0.25, -0.12], [0.5, 0.1], [0.78, -0.08]].forEach(([k, tilt]) => {
      ctx.save();
      ctx.translate(w / 2, top + h * k);
      ctx.rotate(tilt);
      FP.roundRect(ctx, -w / 2 - 6, -12, w + 12, 24, 3);
      outlined(ctx, "#a0703f", 2);
      ctx.restore();
    });
    const sw = Math.min(140, w - 14);
    FP.roundRect(ctx, w / 2 - sw / 2, top + h / 2 - 24, sw, 48, 6);
    outlined(ctx, "#fff4d6", 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#7a2a1a";
    if (sw < 130) {
      ctx.font = "700 17px " + FP.displayFont();
      ctx.fillText("Coming", w / 2, top + h / 2 - 3);
      ctx.fillText("Soon", w / 2, top + h / 2 + 16);
    } else {
      ctx.font = "700 18px " + FP.displayFont();
      ctx.fillText("Coming Soon", w / 2, top + h / 2 + 6);
    }
  }

  function drawBuilding(ctx, b, t) {
    ctx.save();
    ctx.translate(b.cx - b.dw * b.k / 2, b.base);
    ctx.scale(b.k, b.k);
    // A soft shadow on the ground in front
    ctx.beginPath();
    ctx.ellipse(b.dw / 2, 4, b.dw * 0.55, 14, 0, 0, TAU);
    ctx.fillStyle = "rgba(40,30,20,0.25)";
    ctx.fill();
    if (b.id === "casino") drawCasino(ctx, b, t);
    else if (b.id === "weather") drawStation(ctx, b, t);
    else if (b.id === "seedshop") drawSeedShop(ctx, b, t);
    else if (b.id === "requests") drawRequestBoard(ctx, b, t);
    else drawSoon(ctx, b);
    ctx.restore();
  }

  // Stone plaza, seen at an angle so the circle looks like an oval.
  let plazaCache = null;
  function drawPlaza(ctx) {
    if (!plazaCache || plazaCache.scale !== town.scale || !plazaCache.canvas.width) {
      const c = document.createElement("canvas");
      c.width = Math.round(W * town.scale);
      c.height = Math.round(H * town.scale);
      const g = c.getContext("2d");
      g.setTransform(town.scale, 0, 0, town.scale, 0, 0);
      g.beginPath();
      g.ellipse(PLAZA.x, PLAZA.y + 8, PLAZA.rx, PLAZA.ry, 0, 0, TAU);
      g.fillStyle = "rgba(40,30,20,0.25)";
      g.fill();
      g.beginPath();
      g.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry, 0, 0, TAU);
      g.fillStyle = "#d8c8a8";
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = "#a8957a";
      g.stroke();
      // Rings of paving stones
      g.lineWidth = 1.5;
      g.strokeStyle = "rgba(120,100,75,0.35)";
      for (let i = 1; i <= 5; i++) {
        g.beginPath();
        g.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx * i / 6, PLAZA.ry * i / 6, 0, 0, TAU);
        g.stroke();
      }
      const rand = FP.rng(31);
      for (let i = 0; i < 260; i++) {
        const a = rand() * TAU, r = Math.sqrt(rand());
        g.beginPath();
        g.ellipse(PLAZA.x + Math.cos(a) * r * PLAZA.rx * 0.97, PLAZA.y + Math.sin(a) * r * PLAZA.ry * 0.97, 3 + rand() * 4, 2 + rand() * 2, 0, 0, TAU);
        g.fillStyle = rand() < 0.5 ? "rgba(150,130,100,0.35)" : "rgba(240,230,210,0.5)";
        g.fill();
      }
      plazaCache = { canvas: c, scale: town.scale };
    }
    ctx.drawImage(plazaCache.canvas, 0, 0, W, H);
  }

  function drawFountain(ctx, t, hovered) {
    const { x, y } = FOUNTAIN;
    if (hovered) {
      const glow = ctx.createRadialGradient(x, y - 20, 10, x, y - 20, 120);
      glow.addColorStop(0, "rgba(255,240,170,0.5)");
      glow.addColorStop(1, "rgba(255,240,170,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 130, y - 140, 260, 220);
    }
    // Basin
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 82, 30, 0, 0, TAU);
    ctx.fillStyle = "rgba(40,30,20,0.25)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, 80, 28, 0, 0, TAU);
    outlined(ctx, "#b9b2a6");
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 66, 20, 0, 0, TAU);
    outlined(ctx, "#5ab0e8", 2);
    // Ripples
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.6 + i / 3) % 1);
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 18 + k * 44, 6 + k * 13, 0, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Coins glinting at the bottom, more of them the more you've tossed in
    const shown = Math.min(18, Math.ceil(Math.log10((town.game.state.fountain.coins || 0) + 1) * 4));
    const rand = FP.rng(5);
    for (let i = 0; i < shown; i++) {
      const a = rand() * TAU, r = 0.3 + rand() * 0.6;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 58 * r, y - 4 + Math.sin(a) * 15 * r, 3.5, 2, 0, 0, TAU);
      ctx.fillStyle = (Math.sin(t * 3 + i) > 0.6) ? "#fff3a0" : "#f5b82e";
      ctx.fill();
    }
    // Center column and top bowl
    FP.roundRect(ctx, x - 8, y - 62, 16, 58, 4);
    outlined(ctx, "#c9c2b6", 2);
    ctx.beginPath();
    ctx.ellipse(x, y - 62, 26, 8, 0, 0, TAU);
    outlined(ctx, "#c9c2b6", 2);
    // Water arcing out of the top bowl
    ctx.fillStyle = "rgba(170,220,255,0.9)";
    for (let s = 0; s < 6; s++) {
      const a = s / 6 * TAU;
      for (let i = 0; i < 5; i++) {
        const k = ((t * 0.9 + i / 5) % 1);
        const px = x + Math.cos(a) * (8 + k * 46);
        const py = y - 66 + Math.sin(a) * (3 + k * 12) - Math.sin(k * Math.PI) * 26 + k * 50;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Coins flying from the bottom of the screen into the fountain.
  function drawTossed(ctx, dt) {
    town.tossed = town.tossed.filter(c => (c.age += dt) < c.dur + 0.5);
    for (const c of town.tossed) {
      const k = Math.min(1, c.age / c.dur);
      if (k < 1) {
        const x = c.from + (FOUNTAIN.x + c.off - c.from) * k;
        const y = 720 + (FOUNTAIN.y - 8 - 720) * k - Math.sin(k * Math.PI) * 180;
        FP.drawCoin(ctx, x, y, 0.9);
      } else {
        const s = (c.age - c.dur) / 0.5;
        ctx.beginPath();
        ctx.ellipse(FOUNTAIN.x + c.off, FOUNTAIN.y - 6, 6 + s * 22, 2 + s * 7, 0, 0, TAU);
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - s)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // Townsfolk walking laps around the fountain.
  const folks = [
    { shirt: "#e8412c", speed: 0.12, offset: 0 },
    { shirt: "#4bb8ff", speed: -0.09, offset: 2.1 },
    { shirt: "#9b59f0", speed: 0.07, offset: 4.2 },
    { shirt: "#6ee36e", speed: -0.11, offset: 5.4 },
  ];

  let lastDraw = 0;
  town.draw = function (now) {
    if (!town.open) return;
    // A page opened in the background can start with a canvas of size 0.
    if (!town.canvas.width) town.resize(town.scale || 1);
    const ctx = town.ctx;
    const t = now / 1000;
    const dt = Math.min(0.05, (now - (lastDraw || now)) / 1000);
    lastDraw = now;
    ctx.setTransform(town.scale, 0, 0, town.scale, 0, 0);

    const night = FP.lightAt(now).dark / 0.42;
    const sky = ctx.createLinearGradient(0, 0, 0, 170);
    sky.addColorStop(0, night > 0.5 ? "#1a2350" : "#8fd0ff");
    sky.addColorStop(1, night > 0.5 ? "#3a3f78" : "#d8f1ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = "#7fbf55";
    ctx.beginPath();
    ctx.moveTo(0, 150);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 140 + Math.sin(x / 130) * 18);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    const grass = ctx.createLinearGradient(0, 150, 0, H);
    grass.addColorStop(0, "#8fcd63");
    grass.addColorStop(1, "#7cbf55");
    ctx.fillStyle = grass;
    ctx.fillRect(0, 170, W, H - 170);

    // The road back to the farm comes in from the bottom left corner.
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8a6339";
    ctx.lineWidth = 46;
    ctx.beginPath();
    ctx.moveTo(-20, 640);
    ctx.quadraticCurveTo(170, 600, 290, 545);
    ctx.stroke();
    ctx.strokeStyle = "#c79a64";
    ctx.lineWidth = 38;
    ctx.stroke();

    drawPlaza(ctx);

    // Everything standing on the ground is drawn back to front.
    const things = BUILDINGS.map(b => ({ y: b.base, draw: () => drawBuilding(ctx, b, t), b }));
    things.push({ y: FOUNTAIN.y + 20, draw: () => drawFountain(ctx, t, town.hover && town.hover.id === "fountain") });
    folks.forEach(f => {
      const a = t * f.speed + f.offset;
      const x = PLAZA.x + Math.cos(a) * PLAZA.rx * 0.7, y = PLAZA.y + Math.sin(a) * PLAZA.ry * 0.62 + 10;
      things.push({ y, draw: () => FP.drawPerson(ctx, x, y, 26, f.shirt, t, true) });
    });
    things.sort((p, q) => p.y - q.y);
    for (const thing of things) {
      if (thing.b && town.hover === thing.b) {
        const r = hitBox(thing.b);
        const glow = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 10, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.9);
        glow.addColorStop(0, "rgba(255,240,170,0.5)");
        glow.addColorStop(1, "rgba(255,240,170,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(r.x - r.w * 0.4, r.y - 40, r.w * 1.8, r.h + 60);
      }
      thing.draw();
    }

    drawTossed(ctx, dt);
    if (town.modal && town.modal.id === "fountain") drawWish(dt);

    if (night > 0.01) {
      ctx.fillStyle = `rgba(16,24,70,${0.3 * night})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Name of whatever the mouse is over, just above it
    if (town.hover) {
      const label = town.hover.name;
      let lx, ly;
      if (town.hover.id === "fountain") { lx = FOUNTAIN.x; ly = FOUNTAIN.y - 100; }
      else { const r = hitBox(town.hover); lx = r.x + r.w / 2; ly = Math.max(96, r.y - 14); }
      ctx.font = "700 20px " + FP.displayFont();
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#3a2717";
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = "#fff4d6";
      ctx.fillText(label, lx, ly);
    }
  };

  // Called when coins go in, so the fountain can show them flying.
  town.tossCoins = function (count) {
    const n = Math.min(12, count);
    for (let i = 0; i < n; i++) {
      town.tossed.push({ age: -i * 0.06, dur: 0.75, from: 560 + Math.random() * 160, off: (Math.random() - 0.5) * 70 });
    }
  };

  // ---------- Fountain close-up ----------
  // The player stands at the edge of the fountain and tosses one coin at a time.
  // The game still counts the coins, but the count is never shown.

  const WISH_W = 600, WISH_H = 340;
  const BASIN = { x: 300, y: 178, rx: 282, ry: 96 };
  const WATER = { x: 300, y: 172, rx: 252, ry: 78 };
  const wish = town.wish = { coins: [], drops: [], ripples: [], sunk: [], armUntil: 0, last: 0 };

  // A random spot on the water, kept away from the center column.
  function waterSpot() {
    for (;;) {
      const a = Math.random() * TAU, r = 0.25 + Math.random() * 0.68;
      const x = WATER.x + Math.cos(a) * WATER.rx * r, y = WATER.y + Math.sin(a) * WATER.ry * r;
      if (y < WATER.y + 50) return { x, y };
    }
  }

  // Throws one coin. Now and then it clinks off the stone rim before it hops in.
  town.tossWish = function () {
    const now = performance.now() / 1000;
    const end = waterSpot();
    const hand = { x: 330, y: 268 };
    const rim = Math.random() < 0.15;
    let first = end;
    if (rim) {
      const a = Math.PI + 0.3 + Math.random() * (Math.PI - 0.6); // somewhere along the far rim
      first = { x: BASIN.x + Math.cos(a) * (BASIN.rx - 14), y: BASIN.y + Math.sin(a) * (BASIN.ry - 8) };
    }
    wish.coins.push({
      legs: rim ? [{ from: hand, to: first, h: 120 + Math.random() * 60, dur: 0.85 }, { from: first, to: end, h: 30, dur: 0.4 }]
                : [{ from: hand, to: end, h: 80 + Math.random() * 110, dur: 0.7 + Math.random() * 0.35 }],
      leg: 0, start: now, spin: 8 + Math.random() * 12, tilt: Math.random() * TAU,
    });
    wish.armUntil = now + 0.35;
    FP.sfx("click");
  };

  function splash(x, y, big) {
    const n = big ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 60 + Math.random() * 110;
      wish.drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.5 + Math.random() * 0.3 });
    }
    for (let i = 0; i < 3; i++) wish.ripples.push({ x, y, age: -i * 0.18, life: 1.4 });
    FP.sfx("splash");
  }

  function drawWish(dt) {
    const c = document.getElementById("wish");
    if (!c) return;
    const ctx = c.getContext("2d");
    const now = performance.now() / 1000;
    ctx.setTransform(c.width / WISH_W, 0, 0, c.height / WISH_H, 0, 0);

    // Paving stones around the fountain
    const ground = ctx.createLinearGradient(0, 0, 0, WISH_H);
    ground.addColorStop(0, "#cdbd9c");
    ground.addColorStop(1, "#e2d4b8");
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, WISH_W, WISH_H);
    const rand = FP.rng(12);
    for (let i = 0; i < 70; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * WISH_W, rand() * WISH_H, 6 + rand() * 10, 3 + rand() * 4, 0, 0, TAU);
      ctx.fillStyle = rand() < 0.5 ? "rgba(150,130,100,0.3)" : "rgba(250,240,220,0.45)";
      ctx.fill();
    }

    // Basin and water
    ctx.beginPath();
    ctx.ellipse(BASIN.x, BASIN.y + 10, BASIN.rx, BASIN.ry, 0, 0, TAU);
    ctx.fillStyle = "rgba(40,30,20,0.25)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(BASIN.x, BASIN.y, BASIN.rx, BASIN.ry, 0, 0, TAU);
    outlined(ctx, "#bdb6aa", 4);
    const water = ctx.createRadialGradient(WATER.x, WATER.y - 10, 20, WATER.x, WATER.y, WATER.rx);
    water.addColorStop(0, "#7cc8f2");
    water.addColorStop(1, "#3f8fc8");
    ctx.beginPath();
    ctx.ellipse(WATER.x, WATER.y, WATER.rx, WATER.ry, 0, 0, TAU);
    ctx.fillStyle = water;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2f6f9f";
    ctx.stroke();

    // Coins resting on the bottom
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(WATER.x, WATER.y, WATER.rx - 2, WATER.ry - 2, 0, 0, TAU);
    ctx.clip();
    for (const s of wish.sunk) {
      const k = Math.min(1, (now - s.at) / 1.2);
      ctx.globalAlpha = 0.35 + 0.4 * k;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 6 * k, 5, 2.6, s.tilt, 0, TAU);
      ctx.fillStyle = Math.sin(now * 2 + s.tilt * 5) > 0.85 ? "#fff3a0" : "#e0a82a";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Light dancing on the surface
    for (let i = 0; i < 9; i++) {
      const x = WATER.x + Math.sin(now * 0.7 + i * 1.9) * WATER.rx * 0.75;
      const y = WATER.y + Math.cos(now * 0.5 + i * 2.7) * WATER.ry * 0.6;
      ctx.beginPath();
      ctx.ellipse(x, y, 16, 3, 0, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();
    }
    ctx.restore();

    // Ripples from splashes
    wish.ripples = wish.ripples.filter(r => (r.age += dt) < r.life);
    for (const r of wish.ripples) {
      if (r.age < 0) continue;
      const k = r.age / r.life;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 4 + k * 46, 1.5 + k * 15, 0, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Center column, top bowl, and the water falling from it
    FP.roundRect(ctx, BASIN.x - 16, 40, 32, WATER.y - 40, 6);
    outlined(ctx, "#cfc8bc", 3);
    ctx.beginPath();
    ctx.ellipse(BASIN.x, 42, 62, 16, 0, 0, TAU);
    outlined(ctx, "#cfc8bc", 3);
    ctx.fillStyle = "rgba(180,225,255,0.9)";
    for (let s = 0; s < 10; s++) {
      const a = s / 10 * TAU;
      for (let i = 0; i < 6; i++) {
        const k = (now * 0.8 + i / 6) % 1;
        const x = BASIN.x + Math.cos(a) * (20 + k * 110);
        const y = 40 + Math.sin(a) * (6 + k * 30) - Math.sin(k * Math.PI) * 30 + k * 115;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, TAU);
        ctx.fill();
      }
    }

    // Coins in the air
    for (let i = wish.coins.length - 1; i >= 0; i--) {
      const coin = wish.coins[i];
      const leg = coin.legs[coin.leg];
      const k = (now - coin.start) / leg.dur;
      if (k >= 1) {
        if (coin.leg + 1 < coin.legs.length) {
          coin.leg++;
          coin.start = now;
          FP.sfx("click"); // clink on the stone
          continue;
        }
        splash(leg.to.x, leg.to.y, Math.random() < 0.3);
        wish.sunk.push({ x: leg.to.x, y: leg.to.y, tilt: coin.tilt, at: now });
        if (wish.sunk.length > 60) wish.sunk.shift();
        wish.coins.splice(i, 1);
        continue;
      }
      const x = leg.from.x + (leg.to.x - leg.from.x) * k;
      const y = leg.from.y + (leg.to.y - leg.from.y) * k - Math.sin(k * Math.PI) * leg.h;
      const size = 9 - 3 * ((coin.leg + k) / coin.legs.length);
      const face = Math.abs(Math.cos((now - coin.start) * coin.spin + coin.tilt));
      ctx.beginPath();
      ctx.ellipse(x, y, size * Math.max(0.15, face), size, 0, 0, TAU);
      ctx.fillStyle = face > 0.5 ? "#f5b82e" : "#c98a0c";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#8a5a06";
      ctx.stroke();
    }

    // Splash droplets
    wish.drops = wish.drops.filter(d => (d.age += dt) < d.life);
    ctx.fillStyle = "rgba(220,245,255,0.95)";
    for (const d of wish.drops) {
      d.vy += 420 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 2.2 * (1 - d.age / d.life) + 0.6, 0, TAU);
      ctx.fill();
    }

    // The player, seen from behind, with a coin in hand until it's thrown
    const throwing = now < wish.armUntil;
    const px = 300, py = WISH_H + 50;
    FP.drawPerson(ctx, px, py, 130, "#6b8e23", now, false);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#f5cfa0";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(px + 30, py - 100);
    if (throwing) ctx.lineTo(px + 46, py - 170);
    else ctx.lineTo(px + 52, py - 70);
    ctx.stroke();
    if (!throwing) FP.drawCoin(ctx, px + 54, py - 68, 0.8);
  }

  // ---------- Building menus ----------

  town.openModal = function (id) {
    town.modal = { id, step: "pick", item: null, game: null };
    renderModal();
    town.modalEl.hidden = false;
  };

  town.closeModal = function () {
    town.modal = null;
    if (town.modalEl) town.modalEl.hidden = true;
  };

  const coin = `<span class="coin-icon small"></span>`;

  function cropRow(state, item, i) {
    const seed = FP.SEED_BY_ID[item.seedId];
    return `<button class="crop-pick" data-pick="${i}" style="--rarity:${FP.RARITIES[seed.rarity].color}">
      <img src="${FP.seedIconURL(seed)}" alt="">
      <span class="crop-name">${seed.name}${item.mods.length ? `<span class="mods">${item.mods.map(m => FP.ui.modTag(m)).join("")}</span>` : ""}</span>
      <span class="crop-value">${coin}${FP.formatCoins(FP.sellPrice(state, item))}</span>
    </button>`;
  }

  function pickList(state, emptyText) {
    const items = town.modal.id === "casino" ? FP.betItems(state) : state.harvest.slice().sort((a, b) => b.value - a.value);
    town.modal.choices = items.slice(0, 40);
    if (!items.length) return `<p class="empty">${emptyText}</p>`;
    return `<div class="crop-list">${town.modal.choices.map((item, i) => cropRow(state, item, i)).join("")}</div>`;
  }

  function itemLine(state) {
    const item = town.modal.item;
    const seed = FP.SEED_BY_ID[item.seedId];
    return `<div class="bet-line"><img src="${FP.seedIconURL(seed)}" alt=""><span>Your ${seed.name}, worth ${coin}<b>${FP.formatCoins(FP.sellPrice(state, item))}</b></span></div>`;
  }

  const GAMES = [
    { id: "coin", name: "Coin Flip", desc: "Call heads or tails. A win is worth x1.5." },
    { id: "rps", name: "Rock Paper Scissors", desc: "Best of 3 against the dealer. A win is worth x1.6." },
    { id: "blackjack", name: "Blackjack", desc: "Get closer to 21 than the dealer without going over. A win is worth x1.6, and a blackjack is worth x2." },
    { id: "slots", name: "Slots", desc: "Two matching is worth x1.25, three is x5, and three Moonflowers is x10." },
  ];

  function renderModal() {
    const state = town.game.state;
    const m = town.modal;
    let body = "";
    if (m.id === "requests") {
      body = requestBody(state);
    } else if (m.id === "seedshop") {
      body = seedShopBody(state);
    } else if (m.id === "fountain") {
      body = `<canvas id="wish" class="wish" width="1200" height="680"></canvas>
        <div class="moves"><button class="btn btn-gold" data-toss ${state.coins < 1 ? "disabled" : ""}>Toss a coin</button></div>
        <p class="modal-sub center">Make a wish. Each toss costs one coin.</p>`;
    } else if (m.id === "casino") {
      if (m.step === "pick") {
        body = `<p class="modal-sub">Pick a crop from your basket to bet. Win and its value goes up. Lose and its value is cut in half, but you keep it. Each crop can only be bet once.</p>
          ${pickList(state, "You have no crops to bet. Harvest something first, or check that your crops haven't all been bet already.")}`;
      } else if (m.step === "game") {
        body = `${itemLine(state)}<p class="modal-sub">Pick a game.</p>
          <div class="game-list">${GAMES.map(g => `<button class="game-pick" data-game="${g.id}"><b>${g.name}</b><span>${g.desc}</span></button>`).join("")}</div>
          <button class="btn btn-plain" data-back="pick">Pick a different crop</button>`;
      } else {
        body = itemLine(state) + `<div class="game-area">${GAME_VIEWS[m.game](state)}</div>`;
      }
    } else {
      const forecast = state.weather.forecast ? FP.WEATHER_BY_ID[state.weather.forecast] : null;
      if (m.step === "pick" && !FP.weatherOptions(state).length) {
        body = `<div class="weatherman"><canvas id="weatherman" width="200" height="200"></canvas>
            <p class="speech">"The machine is still warming up. Come back once your farm reaches level ${FP.WEATHER_LEVEL} and I'll put your crops to good use."</p></div>`;
      } else if (m.step === "pick") {
        body = `<div class="weatherman"><canvas id="weatherman" width="200" height="200"></canvas>
            <p class="speech">"Hand me one of your crops and I'll feed it to the machine. The better the crop, the stranger the weather it can make."</p></div>
          ${forecast ? `<p class="modal-sub">The machine is already set to ${forecast.name}. A new crop will replace that.</p>` : ""}
          ${pickList(state, "You have no crops to give. Harvest something first.")}`;
      } else {
        const r = m.result;
        body = `<div class="weatherman"><canvas id="weatherman" width="200" height="200"></canvas>
            <p class="speech">${r ? r.line : "Let's see what the machine makes of this..."}</p></div>
          ${r ? `<div class="forecast"><img src="${FP.weatherIconURL(r.weather.id)}" alt=""><div><b>Next weather: ${r.weather.name}</b>
            <span>It will start ${state.weather.id === "clear" ? "in a few seconds" : "as soon as the current " + FP.currentWeather(state).noun + " ends"}.</span></div></div>
            <button class="btn" data-back="pick">Give another crop</button>` : ""}`;
      }
    }
    town.modalEl.innerHTML = `<div class="modal-box modal-${m.id}">
        <div class="modal-head"><h2>${{ casino: "Casino", weather: "Weather Station", fountain: "Fountain", seedshop: "Seed Shop", requests: "Request Board" }[m.id]}</h2><button class="modal-close" data-close>Close</button></div>
        ${body}
      </div>`;
    if (m.id === "weather") drawWeatherman(m.step === "spin");
  }
  town.render = () => town.modal && renderModal();

  function onModalClick(e) {
    const m = town.modal;
    if (!m) return;
    const state = town.game.state;
    const el = e.target.closest("button");
    if (!el || el.disabled) return;
    if (el.hasAttribute("data-close")) return town.closeModal();
    if (el.dataset.back) { m.step = el.dataset.back; m.result = null; return renderModal(); }
    if (el.dataset.shop) return seedShopClick(state, el.dataset.shop, el.dataset.id);
    if (el.dataset.request !== undefined) return requestClick(state, Number(el.dataset.request), el);
    if (el.hasAttribute("data-toss")) {
      if (state.coins < 1) return;
      state.coins -= 1;
      state.fountain.coins += 1;
      state.fountain.tosses++;
      town.tossWish();
      town.game.action("townChanged", {});
      if (state.coins < 1) el.disabled = true; // only the button changes, so the animation keeps going
      return;
    }
    if (el.dataset.pick !== undefined) {
      const item = m.choices[Number(el.dataset.pick)];
      if (!item || !state.harvest.includes(item)) return renderModal();
      m.item = item;
      FP.sfx("click");
      if (m.id === "casino") { m.step = "game"; return renderModal(); }
      return giveToWeatherman(item);
    }
    if (el.dataset.game) {
      m.game = el.dataset.game;
      m.step = "play";
      GAME_START[m.game](m);
      FP.sfx("click");
      return renderModal();
    }
    if (el.dataset.move !== undefined) GAME_MOVES[m.game](m, el.dataset.move);
  }

  // Ends a casino game: changes the crop's value and shows the result.
  function finish(m, mult, text) {
    const state = town.game.state;
    const before = FP.sellPrice(state, m.item);
    FP.settleBet(m.item, mult);
    const after = FP.sellPrice(state, m.item);
    m.done = { mult, text, before, after };
    FP.sfx(mult > 1 ? "goal" : mult === 1 ? "click" : "error");
    town.game.action("townChanged", {});
    if (town.modal === m) renderModal(); // the player may have closed the menu while the game finished
  }

  function resultBox(m) {
    const d = m.done;
    const kind = d.mult > 1 ? "win" : d.mult === 1 ? "push" : "lose";
    return `<div class="result ${kind}"><b>${d.text}</b>
      <span>Your crop went from ${coin}${FP.formatCoins(d.before)} to ${coin}${FP.formatCoins(d.after)}.</span></div>
      <button class="btn" data-back="pick">Bet another crop</button>`;
  }

  // ---------- Seed Shop ----------

  // A short line about what a special seed needs.
  FP.needsText = function (seed) {
    const n = seed.needs || {};
    if (n.tile) return "Has to be planted on " + FP.TILES[n.tile].name.toLowerCase() + ".";
    if (n.feed) return "Waits as a sprout until you give it Fertilizer.";
    if (n.size) return "Takes up " + n.size + " by " + n.size + " plots.";
    if (n.temp !== undefined) return "Only grows in a Green House set to " + FP.TEMPS[n.temp].toLowerCase() + " and " + FP.HUMIDS[n.humid].toLowerCase() + ".";
    return "";
  };

  function seedShopBody(state) {
    const seeds = FP.SPECIAL_SEEDS.map(seed => {
      const unlocked = FP.specialUnlocked(state, seed.id);
      const q = FP.QUESTS[seed.id];
      const have = Math.min(q.count, FP.questItems(state, seed.id).length);
      const right = unlocked
        ? `<button class="btn btn-gold ${state.coins < seed.price ? "poor" : ""}" data-shop="seed" data-id="${seed.id}">${coin}${FP.formatCoins(seed.price)}</button>`
        : `<button class="btn" data-shop="quest" data-id="${seed.id}" ${have < q.count ? "disabled" : ""}>Hand over</button>`;
      return `<div class="shop-row ${unlocked ? "" : "locked-seed"}" style="--rarity:${FP.RARITIES[seed.rarity].color}">
        <img src="${FP.seedIconURL(seed)}" alt="">
        <div class="shop-info"><b>${seed.name}</b><span>${FP.needsText(seed)} Sells for ${FP.formatCoins(seed.value)}.</span>
          ${unlocked ? "" : `<span class="quest">"${q.text}" You have ${have} of ${q.count}.</span>`}</div>
        ${right}
      </div>`;
    }).join("");
    const supply = (key, icon, name, desc, price, owned) => `<div class="shop-row">
        <img src="${icon}" alt="">
        <div class="shop-info"><b>${name}</b><span>${desc}${owned ? " You have " + owned + "." : ""}</span></div>
        <button class="btn btn-gold ${state.coins < price ? "poor" : ""}" data-shop="${key}">${coin}${FP.formatCoins(price)}</button>
      </div>`;
    const gh = FP.WORKER_BY_ID.greenhouse;
    return `<p class="modal-sub">"I keep the unusual seeds back here. Do me a favor and I'll put one on the shelf for you for good."</p>
      <h3 class="section">Special seeds</h3>${seeds}
      <h3 class="section">Supplies</h3>
      ${supply("sand", FP.tileIconURL("sand"), FP.TILES.sand.kit, FP.TILES.sand.desc, FP.TILES.sand.price, state.tileKits.sand)}
      ${supply("water", FP.tileIconURL("water"), FP.TILES.water.kit, FP.TILES.water.desc, FP.TILES.water.price, state.tileKits.water)}
      ${supply("fence", FP.fenceIconURL(), "Picket Fence", "Goes around a plant so the Picker leaves it alone. On a big plant it goes around the whole thing.", FP.FENCE_PRICE, state.fences)}
      ${supply("greenhouse", FP.buildingIconURL(gh), "Green House", gh.desc, FP.GREENHOUSE_PRICE, 0)}`;
  }

  function seedShopClick(state, kind, id) {
    let err, msg;
    if (kind === "quest") {
      err = FP.turnInQuest(state, id);
      msg = "The " + FP.SEED_BY_ID[id].name + " is on the shelf now. You can buy its seeds here whenever you like.";
    } else if (kind === "seed") {
      err = FP.buySpecialSeed(state, id);
      msg = "You bought " + FP.withArticle(FP.SEED_BY_ID[id].name) + " seed.";
    } else if (kind === "sand" || kind === "water") {
      err = FP.buyTileKit(state, kind);
      msg = "You bought " + FP.withArticle(FP.TILES[kind].kit) + ". Click an empty plot to use it.";
    } else if (kind === "fence") {
      err = FP.buyFence(state);
      msg = "You bought a Picket Fence. Click a plant to put it around.";
    } else if (kind === "greenhouse") {
      err = FP.buyGreenhouse(state);
      msg = "You bought a Green House. Place it on an empty plot.";
    }
    if (err) {
      FP.sfx("error");
      town.game.toast(err);
      return;
    }
    FP.sfx(kind === "quest" ? "goal" : "buy");
    town.game.toast(msg);
    town.game.action("townChanged", {});
    FP.ui.renderHotbar();
    renderModal();
  }

  // ---------- Request Board ----------

  function requestBody(state) {
    const now = Date.now();
    const notes = [];
    for (let i = 0; i < FP.REQUEST_SLOTS; i++) {
      const req = state.requests[i];
      if (!req || !req.who) {
        const wait = req && req.emptyUntil ? FP.formatClock(req.emptyUntil - now) : "a moment";
        notes.push(`<div class="note empty-note"><p>A new request will be pinned up in ${wait}.</p></div>`);
        continue;
      }
      const best = FP.bestForRequest(state, req);
      const seed = req.seedId ? FP.SEED_BY_ID[req.seedId] : null;
      notes.push(`<div class="note" style="--tilt:${[-1.2, 1, 0.8, -1][i]}deg">
        <div class="note-top">
          ${seed ? `<img src="${FP.seedIconURL(seed)}" alt="">` : ""}
          <div><b>${req.who}</b><span class="note-pay">Pays x${req.mult}</span></div>
        </div>
        <p>${FP.requestText(req)}</p>
        ${req.mod ? `<div class="mods">${FP.ui.modTag(req.mod)}</div>` : ""}
        <span class="note-time">Comes down in ${FP.formatClock(req.expiresAt - now)}</span>
        ${best
          ? `<button class="btn btn-gold" data-request="${i}">Hand over for ${coin}${FP.formatCoins(FP.requestPayout(state, req, best))}</button>`
          : `<button class="btn" disabled>You don't have one yet</button>`}
      </div>`);
    }
    return `<p class="modal-sub">Townsfolk pin up what they're looking for. Hand one over and they pay its value times the number on the note. If you have more than one that fits, the most valuable one goes, since it pays the most.</p>
      <div class="notes">${notes.join("")}</div>`;
  }

  function requestClick(state, i, el) {
    const from = FP.renderer.centerOf(el);
    const res = FP.fulfillRequest(state, i, Date.now());
    if (res.error) {
      FP.sfx("error");
      town.game.toast(res.error);
      return renderModal();
    }
    FP.sfx("goal");
    town.game.toast(res.req.who + " paid you " + FP.formatCoins(res.coins) + " coins for the " + FP.SEED_BY_ID[res.item.seedId].name + ".");
    town.game.action("requestPaid", { coins: res.coins, x: from.x, y: from.y });
    renderModal();
  }

  // Keeps timers on the notes ticking while the board is open.
  town.tickRequests = function () {
    if (town.modal && town.modal.id === "requests" && !FP.pointerDown) renderModal();
  };

  // ---------- Casino games ----------

  const HANDS = ["Rock", "Paper", "Scissors"];
  const beats = (a, b) => (a === 0 && b === 2) || (a === 1 && b === 0) || (a === 2 && b === 1);

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  function newDeck() {
    const deck = [];
    SUITS.forEach(s => RANKS.forEach(r => deck.push({ r, s })));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  function handValue(hand) {
    let total = 0, aces = 0;
    hand.forEach(c => {
      if (c.r === "A") { total += 11; aces++; }
      else total += ["J", "Q", "K"].includes(c.r) ? 10 : Number(c.r);
    });
    while (total > 21 && aces) { total -= 10; aces--; }
    return total;
  }
  const cardHTML = (c, hidden) => hidden
    ? `<span class="pcard back"></span>`
    : `<span class="pcard ${c.s === "♥" || c.s === "♦" ? "red" : ""}">${c.r}<i>${c.s}</i></span>`;

  const SLOT_SYMBOLS = ["carrot", "tomato", "pumpkin", "corn", "starfruit", "moonflower"];

  const GAME_START = {
    coin(m) { m.state = {}; m.done = null; },
    rps(m) { m.state = { you: 0, them: 0, last: null }; m.done = null; },
    blackjack(m) {
      const deck = newDeck();
      m.state = { deck, you: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()] };
      m.done = null;
      const you = handValue(m.state.you), dealer = handValue(m.state.dealer);
      if (you === 21 || dealer === 21) {
        m.state.reveal = true;
        if (you === 21 && dealer === 21) return setTimeout(() => finish(m, FP.CASINO.push, "You both have blackjack, so it's a tie."), 0);
        if (you === 21) return setTimeout(() => finish(m, FP.CASINO.natural, "Blackjack! You win."), 0);
        return setTimeout(() => finish(m, FP.CASINO.lose, "The dealer has blackjack. You lose."), 0);
      }
    },
    slots(m) { m.state = { reels: ["carrot", "tomato", "pumpkin"], spinning: false }; m.done = null; },
  };

  const GAME_VIEWS = {
    coin(state) {
      const m = town.modal;
      return `<div class="coin-flip ${m.state.flipping ? "flipping" : ""}"><span class="coin-face">${m.state.face || "?"}</span></div>
        ${m.done ? resultBox(m) : m.state.flipping ? `<p class="modal-sub">The coin is in the air...</p>`
          : `<p class="modal-sub">Call it.</p><div class="moves"><button class="btn" data-move="Heads">Heads</button><button class="btn" data-move="Tails">Tails</button></div>`}`;
    },
    rps(state) {
      const m = town.modal, s = m.state;
      const last = s.last ? `<p class="modal-sub">You threw ${HANDS[s.last.you]} and the dealer threw ${HANDS[s.last.them]}. ${s.last.text}</p>` : `<p class="modal-sub">First to 2 wins takes it.</p>`;
      return `<div class="score"><span>You <b>${s.you}</b></span><span>Dealer <b>${s.them}</b></span></div>${last}
        ${m.done ? resultBox(m) : `<div class="moves">${HANDS.map((h, i) => `<button class="btn" data-move="${i}">${h}</button>`).join("")}</div>`}`;
    },
    blackjack(state) {
      const m = town.modal, s = m.state;
      const hideDealer = !s.reveal && !m.done;
      return `<div class="table">
          <div class="hand"><span class="hand-label">Dealer${hideDealer ? "" : ", " + handValue(s.dealer)}</span>${s.dealer.map((c, i) => cardHTML(c, hideDealer && i === 1)).join("")}</div>
          <div class="hand"><span class="hand-label">You, ${handValue(s.you)}</span>${s.you.map(c => cardHTML(c)).join("")}</div>
        </div>
        ${m.done ? resultBox(m) : `<div class="moves"><button class="btn" data-move="hit">Hit</button><button class="btn btn-gold" data-move="stand">Stand</button></div>`}`;
    },
    slots(state) {
      const m = town.modal, s = m.state;
      return `<div class="reels">${s.reels.map(id => `<span class="reel"><img src="${FP.seedIconURL(FP.SEED_BY_ID[id])}" alt=""></span>`).join("")}</div>
        ${m.done ? resultBox(m) : s.spinning ? `<p class="modal-sub">Spinning...</p>` : `<div class="moves"><button class="btn btn-gold" data-move="spin">Pull the lever</button></div>`}`;
    },
  };

  const GAME_MOVES = {
    coin(m, call) {
      if (m.state.flipping || m.done) return;
      m.state.flipping = true;
      FP.sfx("click");
      renderModal();
      setTimeout(() => {
        const face = Math.random() < 0.5 ? "Heads" : "Tails";
        m.state.flipping = false;
        m.state.face = face;
        if (face === call) finish(m, FP.CASINO.coin, "It landed on " + face + ". You win!");
        else finish(m, FP.CASINO.lose, "It landed on " + face + ". You lose.");
      }, 1100);
    },
    rps(m, move) {
      if (m.done) return;
      const s = m.state, you = Number(move), them = Math.floor(Math.random() * 3);
      let text;
      if (you === them) text = "That's a tie, so throw again.";
      else if (beats(you, them)) { s.you++; text = "You take the round."; }
      else { s.them++; text = "The dealer takes the round."; }
      s.last = { you, them, text };
      FP.sfx("click");
      if (s.you === 2) return finish(m, FP.CASINO.rps, "You won the best of 3!");
      if (s.them === 2) return finish(m, FP.CASINO.lose, "The dealer won the best of 3.");
      renderModal();
    },
    blackjack(m, move) {
      if (m.done) return;
      const s = m.state;
      if (move === "hit") {
        s.you.push(s.deck.pop());
        FP.sfx("click");
        if (handValue(s.you) > 21) return finish(m, FP.CASINO.lose, "You went over 21. You lose.");
        return renderModal();
      }
      s.reveal = true;
      while (handValue(s.dealer) < 17) s.dealer.push(s.deck.pop());
      const you = handValue(s.you), dealer = handValue(s.dealer);
      if (dealer > 21) return finish(m, FP.CASINO.blackjack, "The dealer went over 21. You win!");
      if (you > dealer) return finish(m, FP.CASINO.blackjack, "Your " + you + " beats the dealer's " + dealer + ". You win!");
      if (you === dealer) return finish(m, FP.CASINO.push, "You both have " + you + ", so it's a tie.");
      finish(m, FP.CASINO.lose, "The dealer's " + dealer + " beats your " + you + ". You lose.");
    },
    slots(m) {
      const s = m.state;
      if (s.spinning || m.done) return;
      s.spinning = true;
      const final = [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
      const started = Date.now();
      // Each reel keeps changing until its stop time, left to right.
      const tick = setInterval(() => {
        const elapsed = Date.now() - started;
        s.reels = s.reels.map((id, i) => elapsed > 700 + i * 450 ? final[i] : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
        FP.sfx("click");
        if (elapsed > 700 + 2 * 450) {
          clearInterval(tick);
          s.spinning = false;
          const [a, b, c] = final;
          if (a === b && b === c) {
            if (a === "moonflower") finish(m, FP.CASINO.jackpot, "Three Moonflowers! That's the jackpot!");
            else finish(m, FP.CASINO.triple, "Three of a kind! You win big.");
          } else if (a === b || b === c || a === c) finish(m, FP.CASINO.pair, "Two of a kind. That's a small win.");
          else finish(m, FP.CASINO.lose, "Nothing matched. You lose.");
        } else if (town.modal === m) renderModal();
      }, 110);
      renderModal();
    },
  };

  // ---------- Weather Station ----------

  function giveToWeatherman(item) {
    const m = town.modal;
    const state = town.game.state;
    m.step = "spin";
    m.result = null;
    renderModal();
    town.modalEl.querySelector(".modal-box").classList.add("shake");
    FP.sfx("weather");
    setTimeout(() => {
      if (town.modal !== m) return;
      const result = FP.weathermanPick(state, item, Date.now());
      if (!result) { m.step = "pick"; return renderModal(); }
      const seed = FP.SEED_BY_ID[item.seedId];
      let line;
      if (result.score < 3) line = `"A ${seed.name}. It won't stir up much, but the machine took it. It says ${result.weather.name} is next."`;
      else if (result.score < 6) line = `"Now that's a fine ${seed.name}. The machine liked it, and it's calling for ${result.weather.name}."`;
      else line = `"Oh my. Stand back, this ${seed.name} might shake the whole sky. The machine says ${result.weather.name}!"`;
      m.result = { weather: result.weather, line };
      FP.sfx("goal");
      town.game.action("townChanged", {});
      renderModal();
    }, 1600);
  }

  // The weatherman in his raincoat, with the machine behind him.
  function drawWeatherman(busy) {
    const c = document.getElementById("weatherman");
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.lineJoin = "round";
    FP.roundRect(ctx, 100, 30, 90, 150, 10);
    outlined(ctx, "#8fa7b8");
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(125 + i * 20, 60, 6, 0, TAU);
      ctx.fillStyle = busy ? ["#ff5a5a", "#ffe14d", "#6ee36e"][i] : "#4a5560";
      ctx.fill();
    }
    FP.roundRect(ctx, 115, 85, 60, 40, 6);
    outlined(ctx, busy ? "#9fffd4" : "#2a3a44", 2);
    ctx.beginPath();
    ctx.arc(145, 150, 14, 0, TAU);
    outlined(ctx, "#ffd23f", 2);
    FP.drawPerson(ctx, 62, 190, 70, "#ffcf3a", 0, false);
  }

  // Lets other code find the display font for canvas text.
  FP.displayFont = () => getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "serif";
})(window.FP);
