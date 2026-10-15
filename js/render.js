// Draws the farm on the canvas. The menus are HTML and live in ui.js.
// Effects that fly over the menus (coins, harvested crops) go on a second canvas on top.
(function (FP) {
  const TAU = FP.TAU;
  const W = 1280, H = 720;
  const FARM = { x: 24, y: 80, w: 872, h: 540 }; // area left of the menu and above the seed bar
  const PLANT_SCALE = 1.25; // plants are drawn a bit bigger than the plot so they read clearly
  const POP_MS = 400;       // how long a plant bounces when it reaches a new stage

  // ---------- Layout ----------

  FP.layout = function (state) {
    const gap = 12;
    const size = Math.min(
      116,
      (FARM.w - 56 - gap * (state.cols - 1)) / state.cols,
      (FARM.h - 56 - gap * (state.rows - 1)) / state.rows
    );
    const totalW = size * state.cols + gap * (state.cols - 1);
    const totalH = size * state.rows + gap * (state.rows - 1);
    return {
      size, gap, totalW, totalH,
      x0: FARM.x + (FARM.w - totalW) / 2,
      y0: FARM.y + (FARM.h - totalH) / 2,
    };
  };

  FP.plotRect = (L, x, y) => ({ x: L.x0 + x * (L.size + L.gap), y: L.y0 + y * (L.size + L.gap), s: L.size });

  FP.plotAt = function (state, mx, my) {
    const L = FP.layout(state);
    const step = L.size + L.gap;
    const x = Math.floor((mx - L.x0) / step), y = Math.floor((my - L.y0) / step);
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return null;
    if (mx - L.x0 - x * step > L.size || my - L.y0 - y * step > L.size) return null; // in the gap
    return { x, y };
  };

  // ---------- Effects ----------

  const fx = FP.fx = { items: [] };

  fx.text = function (x, y, text, color) {
    fx.items.push({ kind: "text", x, y, text, color, age: 0, life: 1.1 });
  };

  fx.burst = function (x, y, color, count, power = 1) {
    if (FP.settings.calm) count = Math.ceil(count / 4); // fewer effects keeps just a hint of each burst
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, speed = (80 + Math.random() * 140) * power;
      fx.items.push({
        kind: "bit", x, y, color, age: 0, life: 0.5 + Math.random() * 0.4,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 120 * power, r: 2 + Math.random() * 3,
      });
    }
  };

  // Something that arcs from one point to another, like a crop flying into the basket.
  // draw(ctx, x, y, size) paints it. onArrive runs once when it lands.
  fx.fly = function (opts) {
    const dx = opts.to.x - opts.from.x;
    fx.items.push({
      kind: "fly", age: 0, delay: opts.delay || 0, dur: opts.dur || 0.7,
      from: opts.from, to: opts.to,
      ctrl: { x: opts.from.x + dx * 0.3, y: Math.min(opts.from.y, opts.to.y) - (opts.lift ?? 140) },
      draw: opts.draw, size: opts.size || 1, endSize: opts.endSize ?? 0.6, onArrive: opts.onArrive,
    });
  };

  fx.clear = () => { fx.items = []; };

  const easeInOut = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

  function drawFx(ctx, dt) {
    const keep = [];
    for (const item of fx.items) {
      item.age += dt;
      if (item.kind === "fly") {
        const u = (item.age - item.delay) / item.dur;
        if (u >= 1) {
          if (item.onArrive) item.onArrive();
          continue;
        }
        keep.push(item);
        if (u < 0) continue;
        const e = easeInOut(u), m = 1 - e;
        const x = m * m * item.from.x + 2 * m * e * item.ctrl.x + e * e * item.to.x;
        const y = m * m * item.from.y + 2 * m * e * item.ctrl.y + e * e * item.to.y;
        item.draw(ctx, x, y, item.size + (item.endSize - item.size) * e);
        continue;
      }
      if (item.age >= item.life) continue;
      keep.push(item);
      const k = item.age / item.life;
      ctx.globalAlpha = 1 - k * k;
      if (item.kind === "text") {
        ctx.font = "600 20px Fredoka, 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#3a2717";
        const y = item.y - 46 * Math.sqrt(k);
        ctx.strokeText(item.text, item.x, y);
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, item.x, y);
      } else {
        item.vy += 600 * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r * (1 - k * 0.5), 0, TAU);
        ctx.fillStyle = item.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    fx.items = keep;
  }

  // Ready made drawings for flying things.
  const iconImages = {};
  FP.seedIconImage = function (seed) {
    if (!iconImages[seed.id]) {
      const img = new Image();
      img.src = FP.seedIconURL(seed);
      iconImages[seed.id] = img;
    }
    return iconImages[seed.id];
  };

  FP.drawIcon = seed => (ctx, x, y, size) => {
    const img = FP.seedIconImage(seed);
    if (!img.complete) return;
    const d = 52 * size;
    ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
  };

  FP.drawCoin = function (ctx, x, y, size) {
    const r = 10 * size;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = "#f5b82e";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#8a5a06";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, TAU);
    ctx.strokeStyle = "rgba(138,90,6,0.5)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
  };

  // ---------- Renderer ----------

  const R = FP.renderer = { canvas: null, ctx: null, fxCanvas: null, fxCtx: null, scale: 1 };
  let bgCache = null;
  let farmCache = null, farmKey = "";
  const memory = {};   // per plot: the stage we last drew, so we notice when it changes
  let firstFrame = true;
  const scratch = document.createElement("canvas"); // for tinting Golden and Prismatic plants
  const scratchCtx = scratch.getContext("2d");
  const sky = { id: "clear", alpha: 0 };             // the weather on screen, which fades between kinds

  R.init = function (canvas, fxCanvas) {
    R.canvas = canvas;
    R.ctx = canvas.getContext("2d");
    R.fxCanvas = fxCanvas;
    R.fxCtx = fxCanvas.getContext("2d");
  };

  // pixelScale is how many real pixels one game pixel covers, so the farm stays sharp.
  R.resize = function (pixelScale) {
    R.scale = pixelScale;
    for (const c of [R.canvas, R.fxCanvas]) {
      c.width = Math.round(W * pixelScale);
      c.height = Math.round(H * pixelScale);
    }
    bgCache = null;
    farmKey = "";
  };

  // Converts a point on the screen into game coordinates.
  R.toGame = function (clientX, clientY) {
    const r = R.canvas.getBoundingClientRect();
    return { x: (clientX - r.left) * W / r.width, y: (clientY - r.top) * H / r.height };
  };

  R.centerOf = function (el) {
    const r = el.getBoundingClientRect();
    return R.toGame(r.left + r.width / 2, r.top + r.height / 2);
  };

  function makeLayer() {
    const c = document.createElement("canvas");
    c.width = Math.round(W * R.scale);
    c.height = Math.round(H * R.scale);
    const g = c.getContext("2d");
    g.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    return { c, g };
  }

  function buildBackground() {
    const { c, g } = makeLayer();
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#9fd770");
    grad.addColorStop(1, "#7fc25a");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // Mowed stripes
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = -H; i < W; i += 90) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 45, 0);
      g.lineTo(i + 45 + H * 0.5, H);
      g.lineTo(i + H * 0.5, H);
      g.closePath();
      g.fill();
    }

    const rand = FP.rng(1337);
    g.lineCap = "round";
    g.lineWidth = 1.6;
    for (let i = 0; i < 420; i++) {
      const x = rand() * W, y = rand() * H, h = 4 + rand() * 5;
      g.strokeStyle = rand() < 0.5 ? "#6aad48" : "#b2e386";
      g.beginPath();
      g.moveTo(x - 2, y); g.lineTo(x - 3.5, y - h);
      g.moveTo(x, y); g.lineTo(x, y - h * 1.25);
      g.moveTo(x + 2, y); g.lineTo(x + 3.5, y - h);
      g.stroke();
    }
    for (let i = 0; i < 45; i++) {
      const x = rand() * W, y = rand() * H;
      const petal = rand() < 0.6 ? "#ffffff" : "#ffd6e8";
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * TAU;
        g.beginPath();
        g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, TAU);
        g.fillStyle = petal;
        g.fill();
      }
      g.beginPath();
      g.arc(x, y, 1.6, 0, TAU);
      g.fillStyle = "#ffcf3a";
      g.fill();
    }
    return c;
  }

  // ---------- Farm frame and soil (drawn once and cached) ----------

  function plank(g, x, y, w, h, horizontal, rand) {
    g.fillStyle = "#a86f3f";
    g.fillRect(x, y, w, h);

    // Wood grain
    g.strokeStyle = "rgba(90,50,20,0.28)";
    g.lineWidth = 1;
    const len = horizontal ? w : h, thick = horizontal ? h : w;
    for (let i = 0; i < 3; i++) {
      const off = thick * (0.25 + i * 0.25) + (rand() - 0.5) * 2;
      let pos = rand() * 30;
      while (pos < len) {
        const seg = 20 + rand() * 50;
        g.beginPath();
        if (horizontal) { g.moveTo(x + pos, y + off); g.lineTo(x + Math.min(len, pos + seg), y + off); }
        else { g.moveTo(x + off, y + pos); g.lineTo(x + off, y + Math.min(len, pos + seg)); }
        g.stroke();
        pos += seg + 8 + rand() * 20;
      }
    }

    // Seams between boards
    for (let pos = 90 + rand() * 40; pos < len - 40; pos += 110 + rand() * 50) {
      g.fillStyle = "#6b4122";
      if (horizontal) g.fillRect(x + pos, y, 2, h); else g.fillRect(x, y + pos, w, 2);
      g.fillStyle = "rgba(255,230,190,0.25)";
      if (horizontal) g.fillRect(x + pos + 2, y, 1, h); else g.fillRect(x, y + pos + 2, w, 1);
    }

    g.fillStyle = "rgba(255,235,200,0.22)";
    if (horizontal) g.fillRect(x, y, w, 2); else g.fillRect(x, y, 2, h);
    g.strokeStyle = "#5a3820";
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function post(g, cx, cy, s) {
    FP.roundRect(g, cx - s / 2, cy - s / 2 + 3, s, s, 5);
    g.fillStyle = "rgba(40,20,8,0.35)";
    g.fill();
    FP.roundRect(g, cx - s / 2, cy - s / 2, s, s, 5);
    g.fillStyle = "#8b5a33";
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = "#4a2d16";
    g.stroke();
    FP.roundRect(g, cx - s * 0.32, cy - s * 0.32, s * 0.64, s * 0.64, 3);
    g.fillStyle = "#a0693d";
    g.fill();
    g.beginPath();
    g.arc(cx, cy, Math.max(1.5, s * 0.08), 0, TAU);
    g.fillStyle = "#d8c9b0";
    g.fill();
  }

  function drawFrame(g, L) {
    const pad = Math.max(24, L.size * 0.28);
    const b = pad * 0.66; // board thickness
    const x = L.x0 - pad, y = L.y0 - pad, w = L.totalW + pad * 2, h = L.totalH + pad * 2;
    const rand = FP.rng(42);

    FP.roundRect(g, x + 2, y + 10, w, h, 12);
    g.fillStyle = "rgba(30,60,20,0.28)";
    g.fill();
    FP.roundRect(g, x, y, w, h, 12);
    g.fillStyle = "#5e3b22";
    g.fill();

    plank(g, x, y, w, b, true, rand);
    plank(g, x, y + h - b, w, b, true, rand);
    plank(g, x, y + b, b, h - b * 2, false, rand);
    plank(g, x + w - b, y + b, b, h - b * 2, false, rand);

    const ps = b * 1.45;
    post(g, x + b / 2, y + b / 2, ps);
    post(g, x + w - b / 2, y + b / 2, ps);
    post(g, x + b / 2, y + h - b / 2, ps);
    post(g, x + w - b / 2, y + h - b / 2, ps);
  }

  function drawSoil(g, r, px, py) {
    const { x, y, s } = r;
    FP.roundRect(g, x, y + 4, s, s, s * 0.12);
    g.fillStyle = "rgba(30,15,5,0.4)";
    g.fill();
    FP.roundRect(g, x, y, s, s, s * 0.12);
    g.fillStyle = "#a8744a";
    g.fill();

    g.save();
    FP.roundRect(g, x, y, s, s, s * 0.12);
    g.clip();
    const rand = FP.rng(px * 97 + py * 13 + 1);
    const k = s / 100;
    for (let i = 0; i < 22; i++) {
      g.beginPath();
      g.arc(x + rand() * s, y + rand() * s, (0.8 + rand() * 1.2) * k, 0, TAU);
      g.fillStyle = rand() < 0.55 ? "rgba(80,45,20,0.35)" : "rgba(230,190,140,0.35)";
      g.fill();
    }
    // A pebble or two near the edges, away from where the plant sits
    const pebbles = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < pebbles; i++) {
      const left = rand() < 0.5;
      const pxx = x + (left ? 0.1 + rand() * 0.12 : 0.78 + rand() * 0.12) * s;
      const pyy = y + (0.15 + rand() * 0.7) * s;
      g.beginPath();
      g.ellipse(pxx, pyy, 3.2 * k, 2.3 * k, rand(), 0, TAU);
      g.fillStyle = "#a59a8e";
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = "#6e6359";
      g.stroke();
    }
    g.restore();

    g.strokeStyle = "rgba(90,52,25,0.38)";
    g.lineWidth = Math.max(1.5, s * 0.025);
    g.lineCap = "round";
    for (let i = 1; i <= 3; i++) {
      const yy = y + s * i / 4;
      g.beginPath();
      g.moveTo(x + s * 0.14, yy);
      g.quadraticCurveTo(x + s / 2, yy + s * 0.03, x + s * 0.86, yy);
      g.stroke();
    }

    FP.roundRect(g, x + 1.5, y + 1.5, s - 3, s - 3, s * 0.11);
    g.strokeStyle = "rgba(255,230,190,0.25)";
    g.lineWidth = 2;
    g.stroke();
  }

  function farmLayer(state, L) {
    const key = state.cols + "x" + state.rows + "@" + R.scale;
    if (key === farmKey) return farmCache;
    const { c, g } = makeLayer();
    drawFrame(g, L);
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) drawSoil(g, FP.plotRect(L, x, y), x, y);
    }
    farmCache = c;
    farmKey = key;
    return c;
  }

  // ---------- Plants ----------

  function plotOutline(ctx, r, color) {
    FP.roundRect(ctx, r.x - 2, r.y - 2, r.s + 4, r.s + 4, r.s * 0.14);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Remembers each plot's stage and returns when it last changed, for the pop.
  function trackStage(x, y, plant, stage, r, now) {
    const key = x + "," + y;
    const mem = memory[key];
    if (!mem || mem.seedId !== plant.seedId) {
      memory[key] = { seedId: plant.seedId, stage, popAt: firstFrame ? 0 : now };
      return memory[key].popAt;
    }
    if (stage > mem.stage && !firstFrame) {
      mem.popAt = now;
      if (stage === 3) {
        const seed = FP.SEED_BY_ID[plant.seedId];
        fx.burst(r.x + r.s / 2, r.y + r.s * 0.4, "#fff6b0", 6, 0.6);
        fx.burst(r.x + r.s / 2, r.y + r.s * 0.4, seed.color, 4, 0.6);
      }
    }
    mem.stage = stage;
    return mem.popAt;
  }

  function drawPlantAt(ctx, plant, r, now, t, phase, popAt) {
    const seed = FP.SEED_BY_ID[plant.seedId];
    const { stage, sub } = FP.growStage(plant, now);
    const bx = r.x + r.s / 2, by = r.y + r.s * 0.74;

    // Fresh plantings sit in a patch of damp soil that dries over a few seconds.
    const since = now - plant.plantedAt;
    if (plant.harvests === 0 && since < 5000) {
      ctx.beginPath();
      ctx.ellipse(bx, by, r.s * 0.3, r.s * 0.12, 0, 0, TAU);
      ctx.fillStyle = `rgba(70,35,12,${0.4 * (1 - since / 5000)})`;
      ctx.fill();
    }

    // Ripe plants of Epic rarity or higher glow in their rarity color.
    if (stage === 3 && seed.rarity >= 2) {
      const color = FP.RARITIES[seed.rarity].color;
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.5 + phase);
      const cy = by - r.s * 0.3;
      const glow = ctx.createRadialGradient(bx, cy, 0, bx, cy, r.s * 0.62);
      glow.addColorStop(0, FP.rgba(color, 0.5 * pulse));
      glow.addColorStop(1, FP.rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, cy, r.s * 0.62, 0, TAU);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.ellipse(bx, by + r.s * 0.02, r.s * 0.22, r.s * 0.06, 0, 0, TAU);
    ctx.fillStyle = "rgba(50,25,10,0.25)";
    ctx.fill();

    // Sway, ripe bounce, growth, and the stage pop all happen around the plant's base.
    const pose = g => {
      g.rotate(Math.sin(t * 1.6 + phase) * 0.035);
      if (stage === 3) {
        const b = Math.abs(Math.sin(t * 3 + phase)) * 0.04;
        g.scale(1 - b * 0.5, 1 + b);
      } else {
        const grow = 0.85 + 0.15 * sub;
        g.scale(grow, grow);
      }
      const k = (now - popAt) / POP_MS;
      if (k >= 0 && k < 1) {
        const pop = 1 + 0.25 * Math.sin(Math.PI * k) * (1 - k);
        g.scale(pop, pop);
      }
    };

    const tinted = plant.mods.includes("prismatic") ? "prismatic" : plant.mods.includes("golden") ? "golden" : null;
    if (!tinted) {
      ctx.save();
      ctx.translate(bx, by);
      pose(ctx);
      FP.drawPlant(ctx, seed, r.s * PLANT_SCALE, stage, t);
      ctx.restore();
      return;
    }

    // Golden and Prismatic plants are drawn on a scratch canvas first, then colored over,
    // so only the plant itself picks up the tint.
    const size = r.s * 2.2;
    const px = Math.ceil(size * R.scale);
    if (scratch.width < px || scratch.height < px) { scratch.width = px; scratch.height = px; }
    const g = scratchCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, scratch.width, scratch.height);
    g.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    g.save();
    g.translate(size / 2, size * 0.8);
    pose(g);
    FP.drawPlant(g, seed, r.s * PLANT_SCALE, stage, t);
    g.restore();
    g.globalCompositeOperation = "source-atop";
    if (tinted === "golden") {
      g.fillStyle = "rgba(255,205,40,0.55)";
    } else {
      const grad = g.createLinearGradient(0, 0, size, size);
      const shift = (t * 0.25) % 1;
      FP.RAINBOW.forEach((color, i) => grad.addColorStop((i / FP.RAINBOW.length + shift) % 1, FP.rgba(color, 0.6)));
      g.fillStyle = grad;
    }
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = "source-over";
    ctx.drawImage(scratch, 0, 0, px, px, bx - size / 2, by - size * 0.8, size, size);

    // A glint now and then
    const glint = (t * 0.7 + phase) % 1;
    if (glint < 0.25) {
      const a = Math.sin(glint / 0.25 * Math.PI);
      ctx.globalAlpha = a;
      sparkle(ctx, bx + Math.sin(phase * 3) * r.s * 0.2, by - r.s * (0.3 + 0.2 * Math.cos(phase * 5)), r.s * 0.08, "#ffffff");
      ctx.globalAlpha = 1;
    }
  }

  // Small colored dots in the corner of a plot, one per modifier.
  function drawModPips(ctx, plant, r, t) {
    const mods = plant.mods;
    if (!mods.length) return;
    const rad = Math.max(4, r.s * 0.06);
    const shown = mods.slice(0, 4);
    shown.forEach((id, i) => {
      const x = r.x + r.s * 0.12 + i * rad * 2.3, y = r.y + r.s * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fillStyle = modColor(id, t, i);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#3a2717";
      ctx.stroke();
    });
    if (mods.length > shown.length) {
      ctx.font = `600 ${Math.round(rad * 2)}px Fredoka, 'Trebuchet MS', sans-serif`;
      ctx.textAlign = "left";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#3a2717";
      const text = "+" + (mods.length - shown.length);
      const x = r.x + r.s * 0.12 + shown.length * rad * 2.3 - rad * 0.6, y = r.y + r.s * 0.12 + rad * 0.7;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = "#fff8ea";
      ctx.fillText(text, x, y);
    }
  }

  // Prismatic has no single color, so it cycles through the rainbow.
  function modColor(id, t, offset = 0) {
    const mod = FP.MODS[id];
    if (mod.color !== "rainbow") return mod.color;
    return FP.RAINBOW[Math.floor(t * 4 + offset) % FP.RAINBOW.length];
  }
  FP.modColor = modColor;

  function sparkle(ctx, x, y, size, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x, y, x + size, y);
    ctx.quadraticCurveTo(x, y, x, y + size);
    ctx.quadraticCurveTo(x, y, x - size, y);
    ctx.quadraticCurveTo(x, y, x, y - size);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawStatus(ctx, plant, r, now, t, phase) {
    if (FP.isRipe(plant, now)) {
      const seed = FP.SEED_BY_ID[plant.seedId];
      const color = seed.rarity >= 2 ? FP.shade(FP.RARITIES[seed.rarity].color, 0.5) : "#fff6b0";
      const bob = Math.sin(t * 4 + phase) * 2;
      sparkle(ctx, r.x + r.s * 0.84, r.y + r.s * 0.16 + bob, r.s * 0.07 * (0.8 + 0.2 * Math.sin(t * 6 + phase)), color);
      return;
    }
    const p = FP.growPercent(plant, now);
    const bw = r.s * 0.7, bh = Math.max(5, r.s * 0.06);
    const bx = r.x + (r.s - bw) / 2, by = r.y + r.s - bh - r.s * 0.07;
    FP.roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = "rgba(40,20,8,0.5)";
    ctx.fill();
    if (p > 0.02) {
      FP.roundRect(ctx, bx, by, bw * p, bh, bh / 2);
      ctx.fillStyle = "#8be04e";
      ctx.fill();
    }
  }

  // ---------- Ambient life ----------

  const CLOUDS = [
    { y: 170, speed: 12, size: 1.0, offset: 0 },
    { y: 430, speed: 9, size: 1.35, offset: 650 },
    { y: 300, speed: 15, size: 0.8, offset: 1200 },
  ];
  const PUFFS = [[0, 0, 120, 48], [85, -18, 90, 44], [-95, 8, 80, 38], [40, 26, 100, 38]];

  function drawClouds(ctx, t) {
    ctx.fillStyle = "rgba(20,50,30,0.075)";
    for (const cloud of CLOUDS) {
      const span = W + 700;
      const cx = ((t * cloud.speed + cloud.offset) % span) - 350;
      ctx.beginPath();
      for (const [dx, dy, rx, ry] of PUFFS) {
        ctx.moveTo(cx + (dx + rx) * cloud.size, cloud.y + dy * cloud.size);
        ctx.ellipse(cx + dx * cloud.size, cloud.y + dy * cloud.size, rx * cloud.size, ry * cloud.size, 0, 0, TAU);
      }
      ctx.fill(); // one fill so overlapping puffs don't get darker
    }
  }

  const BUTTERFLIES = [
    { seed: 1.3, color: "#ffffff" },
    { seed: 4.1, color: "#ffd166" },
    { seed: 7.7, color: "#f4a3c8" },
  ];

  function butterflyPos(b, t) {
    return {
      x: 460 + 400 * Math.sin(t * 0.11 + b.seed) * Math.cos(t * 0.07 + b.seed * 2),
      y: 350 + 230 * Math.sin(t * 0.09 + b.seed * 3) + 25 * Math.sin(t * 1.3 + b.seed),
    };
  }

  function drawButterflies(ctx, t) {
    for (const b of BUTTERFLIES) {
      const p = butterflyPos(b, t), prev = butterflyPos(b, t - 0.1);
      const facing = p.x >= prev.x ? 1 : -1;
      const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + b.seed));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(facing, 1);
      ctx.fillStyle = b.color;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(60,40,30,0.5)";
      for (const [wx, wy, rx, ry, rot] of [[-3, -3, 5, 4, -0.4], [-2.5, 3, 3.6, 3, 0.4], [3, -3, 5, 4, 0.4], [2.5, 3, 3.6, 3, -0.4]]) {
        ctx.beginPath();
        ctx.ellipse(wx * flap, wy, rx * flap, ry, rot, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 5);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#3a2717";
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- Buildings and workers ----------
  // Everything here is animation. The work itself already happened in workers.js.

  const walkers = {}; // building uid to its worker's position on screen and its queue of trips
  const pulses = [];  // rings that spread out from cultivators
  const flights = []; // bees on their way to a plant and back

  function outlinedFill(ctx, color, width = 2) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = width;
    ctx.strokeStyle = FP.shade(color, -0.45);
    ctx.stroke();
  }

  function house(ctx, r, roof, wall, extra) {
    const s = r.s, cx = r.x + s / 2, base = r.y + s * 0.86;
    const w = s * 0.6, h = s * 0.34;
    ctx.beginPath();
    ctx.ellipse(cx, base + 2, w * 0.6, s * 0.06, 0, 0, TAU);
    ctx.fillStyle = "rgba(40,20,8,0.3)";
    ctx.fill();
    ctx.beginPath();
    ctx.rect(cx - w / 2, base - h, w, h);
    outlinedFill(ctx, wall);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.62, base - h + 2);
    ctx.lineTo(cx, base - h - s * 0.28);
    ctx.lineTo(cx + w * 0.62, base - h + 2);
    ctx.closePath();
    outlinedFill(ctx, roof);
    FP.roundRect(ctx, cx - s * 0.06, base - s * 0.2, s * 0.12, s * 0.2, 3);
    outlinedFill(ctx, "#7a4e2d", 1.5);
    FP.roundRect(ctx, cx + w * 0.18, base - h * 0.75, s * 0.1, s * 0.09, 2);
    outlinedFill(ctx, extra || "#bfe6ff", 1.5);
  }

  const BUILDINGS = {
    waterer(ctx, r) {
      house(ctx, r, "#4b8bff", "#e9d9bd");
      // A little bucket by the door
      const s = r.s;
      FP.roundRect(ctx, r.x + s * 0.14, r.y + s * 0.74, s * 0.1, s * 0.11, 2);
      outlinedFill(ctx, "#8fa7b8", 1.5);
    },
    picker(ctx, r) {
      house(ctx, r, "#e8412c", "#f0dcb4");
      const s = r.s;
      FP.roundRect(ctx, r.x + s * 0.72, r.y + s * 0.72, s * 0.16, s * 0.13, 2);
      outlinedFill(ctx, "#b07a45", 1.5);
      ctx.beginPath();
      ctx.arc(r.x + s * 0.76, r.y + s * 0.72, s * 0.035, 0, TAU);
      ctx.arc(r.x + s * 0.84, r.y + s * 0.72, s * 0.035, 0, TAU);
      ctx.fillStyle = "#e8412c";
      ctx.fill();
    },
    cultivator(ctx, r, t) {
      stoneCircle(ctx, r, t, "#b48cff");
    },
    shadow(ctx, r, t) {
      const glow = 0.6 + 0.4 * Math.sin(t * 2);
      house(ctx, r, "#3d1f7a", "#4a4458", `rgba(190,140,255,${glow})`);
    },
    beekeeper(ctx, r) {
      const s = r.s, cx = r.x + s / 2, base = r.y + s * 0.84;
      ctx.beginPath();
      ctx.ellipse(cx, base + 2, s * 0.26, s * 0.06, 0, 0, TAU);
      ctx.fillStyle = "rgba(40,20,8,0.3)";
      ctx.fill();
      // Stacked rings make the hive
      [[0.26, 0], [0.23, 0.13], [0.18, 0.25], [0.11, 0.35]].forEach(([w, up]) => {
        ctx.beginPath();
        ctx.ellipse(cx, base - s * up - s * 0.06, s * w, s * 0.075, 0, 0, TAU);
        outlinedFill(ctx, "#f0b93a");
      });
      ctx.beginPath();
      ctx.ellipse(cx, base - s * 0.08, s * 0.05, s * 0.035, 0, 0, TAU);
      ctx.fillStyle = "#4a2d16";
      ctx.fill();
    },
  };

  function stoneCircle(ctx, r, t, color) {
    const s = r.s, cx = r.x + s / 2, cy = r.y + s * 0.6;
    const glow = 0.5 + 0.5 * Math.sin(t * 2.2);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.4);
    g.addColorStop(0, FP.rgba(color, 0.55 * glow));
    g.addColorStop(1, FP.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.22, s * 0.1, 0, 0, TAU);
    ctx.lineWidth = 2;
    ctx.strokeStyle = FP.rgba(color, 0.8);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + t * 0.2;
      const sx = cx + Math.cos(a) * s * 0.3, sy = cy + Math.sin(a) * s * 0.14;
      FP.roundRect(ctx, sx - s * 0.04, sy - s * 0.12, s * 0.08, s * 0.12, 3);
      outlinedFill(ctx, "#a59a8e", 1.5);
      ctx.beginPath();
      ctx.arc(sx, sy - s * 0.07, s * 0.015, 0, TAU);
      ctx.fillStyle = FP.rgba(color, glow);
      ctx.fill();
    }
  }

  function levelPips(ctx, b, r) {
    for (let i = 0; i < b.level; i++) {
      const x = r.x + r.s * 0.5 + (i - (b.level - 1) / 2) * r.s * 0.12;
      ctx.beginPath();
      ctx.arc(x, r.y + r.s * 0.95, Math.max(2.5, r.s * 0.035), 0, TAU);
      outlinedFill(ctx, "#ffd23f", 1.5);
    }
  }

  function person(ctx, x, y, s, shirt, t, moving, carry) {
    const step = moving ? Math.sin(t * 14) : 0;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4a2d16";
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.15, y - s * 0.3); ctx.lineTo(x - s * 0.15 + step * s * 0.12, y);
    ctx.moveTo(x + s * 0.15, y - s * 0.3); ctx.lineTo(x + s * 0.15 - step * s * 0.12, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.55, s * 0.32, s * 0.36, 0, 0, TAU);
    outlinedFill(ctx, shirt, 1.5);
    ctx.beginPath();
    ctx.arc(x, y - s * 1.05, s * 0.26, 0, TAU);
    outlinedFill(ctx, "#f5cfa0", 1.5);
    ctx.beginPath();                       // straw hat
    ctx.ellipse(x, y - s * 1.2, s * 0.38, s * 0.09, 0, 0, TAU);
    outlinedFill(ctx, "#e8c36a", 1.5);
    ctx.beginPath();
    ctx.ellipse(x, y - s * 1.28, s * 0.2, s * 0.13, 0, Math.PI, TAU);
    outlinedFill(ctx, "#e8c36a", 1.5);
    if (carry) carry(ctx, x + s * 0.38, y - s * 0.5, s);
  }

  function bee(ctx, x, y, size, t) {
    const flap = Math.abs(Math.sin(t * 30));
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.ellipse(x - size * 0.3, y - size * 0.7, size * 0.45, size * 0.3 * flap + 0.5, -0.5, 0, TAU);
    ctx.ellipse(x + size * 0.3, y - size * 0.7, size * 0.45, size * 0.3 * flap + 0.5, 0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.7, size * 0.5, 0, 0, TAU);
    ctx.fillStyle = "#ffcf3a";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#3a2717";
    ctx.stroke();
    ctx.fillStyle = "#3a2717";
    ctx.fillRect(x - size * 0.1, y - size * 0.5, size * 0.2, size);
  }

  // The spot right in front of the building's door.
  const doorstep = (L, b) => {
    const r = FP.plotRect(L, b.x, b.y);
    return { x: r.x + r.s * 0.5, y: r.y + r.s * 0.98 };
  };
  const plotFeet = (L, x, y) => {
    const r = FP.plotRect(L, x, y);
    return { x: r.x + r.s * 0.5, y: r.y + r.s * 0.92 };
  };

  // Called by the game for every job a worker does. onArrive plays the job's effect
  // when the worker or bee actually gets there.
  R.workerEvent = function (state, b, event, onArrive) {
    const L = FP.layout(state);
    if (event.kind === "walk") {
      const w = walkers[b.uid] || (walkers[b.uid] = { pos: doorstep(L, b), queue: [], waitUntil: 0 });
      if (w.queue.length >= 3) { onArrive(); return; } // too busy to walk, so the effect just plays
      w.queue.push({ to: plotFeet(L, event.x, event.y), onArrive, carry: event.action === "pick" ? FP.SEED_BY_ID[event.seedId] : null });
    } else if (event.kind === "pulse") {
      const r = FP.plotRect(L, b.x, b.y);
      pulses.push({ x: r.x + r.s / 2, y: r.y + r.s / 2, reach: (FP.workerRange(b) + 0.5) * (L.size + L.gap), age: 0, color: b.workerId === "shadow" ? "#6b3fd0" : "#b48cff" });
      onArrive();
    } else if (event.kind === "bee") {
      const from = FP.plotRect(L, b.x, b.y), to = FP.plotRect(L, event.x, event.y);
      flights.push({
        from: { x: from.x + from.s / 2, y: from.y + from.s * 0.6 },
        to: { x: to.x + to.s / 2, y: to.y + to.s * 0.4 },
        age: 0, dur: 2.4, onArrive, arrived: false, uid: b.uid,
      });
    }
  };

  // Moves walkers along their queue. Speed is in game pixels per second.
  function updateWalkers(state, L, dt) {
    const now = Date.now();
    for (const b of state.buildings) {
      const w = walkers[b.uid];
      if (!w) continue;
      const job = w.queue[0];
      const target = job ? job.to : doorstep(L, b);
      const dx = target.x - w.pos.x, dy = target.y - w.pos.y, dist = Math.hypot(dx, dy);
      w.moving = false;
      if (dist > 2 && now >= w.waitUntil) {
        const step = Math.min(dist, 150 * dt);
        w.pos.x += dx / dist * step;
        w.pos.y += dy / dist * step;
        w.moving = true;
        w.facing = dx >= 0 ? 1 : -1;
      } else if (job && now >= w.waitUntil) {
        job.onArrive();
        w.carrying = job.carry;
        w.queue.shift();
        w.waitUntil = now + 450;
      } else if (!job) {
        w.carrying = null;
      }
    }
    // Forget walkers whose building is gone.
    for (const uid in walkers) if (!state.buildings.some(b => b.uid === uid)) delete walkers[uid];
  }

  function drawBuildingsInRow(ctx, state, L, y, t) {
    for (const b of state.buildings) {
      if (b.y !== y) continue;
      const r = FP.plotRect(L, b.x, b.y);
      BUILDINGS[b.workerId](ctx, r, t);
      levelPips(ctx, b, r);
      // Hive bees that are home circle the hive.
      if (b.workerId === "beekeeper") {
        const def = FP.WORKER_BY_ID.beekeeper;
        const out = flights.filter(f => f.uid === b.uid).length;
        const home = Math.max(0, def.bees[b.level - 1] - out);
        for (let i = 0; i < home; i++) {
          const a = t * 2.2 + i / home * TAU;
          bee(ctx, r.x + r.s / 2 + Math.cos(a) * r.s * 0.32, r.y + r.s * 0.45 + Math.sin(a) * r.s * 0.12, r.s * 0.06, t + i);
        }
      }
    }
  }

  function drawWalkers(ctx, state, L, t) {
    for (const b of state.buildings) {
      const def = FP.WORKER_BY_ID[b.workerId];
      if (!def.shirt) continue;
      const w = walkers[b.uid] || (walkers[b.uid] = { pos: doorstep(L, b), queue: [], waitUntil: 0 });
      const carry = w.carrying ? (c, x, y, s) => {
        const img = FP.seedIconImage(w.carrying);
        if (img.complete) c.drawImage(img, x - s * 0.35, y - s * 0.35, s * 0.7, s * 0.7);
      } : (b.workerId === "waterer" ? (c, x, y, s) => {
        FP.roundRect(c, x - s * 0.15, y - s * 0.12, s * 0.3, s * 0.26, 3);
        outlinedFill(c, "#7fb3d5", 1.2);
      } : null);
      person(ctx, w.pos.x, w.pos.y, L.size * 0.2, def.shirt, t, w.moving, carry);
    }
  }

  function drawPulses(ctx, dt) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.age += dt;
      const k = p.age / 0.9;
      if (k >= 1) { pulses.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.reach * k, 0, TAU);
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.strokeStyle = FP.rgba(p.color, 0.7 * (1 - k));
      ctx.stroke();
    }
  }

  function drawFlights(ctx, dt, t) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.age += dt;
      const k = f.age / f.dur;
      if (k >= 1) { flights.splice(i, 1); continue; }
      if (k >= 0.5 && !f.arrived) { f.arrived = true; f.onArrive(); }
      // Out and back along a wobbly path
      const u = k < 0.5 ? k * 2 : 2 - k * 2;
      const x = f.from.x + (f.to.x - f.from.x) * u + Math.sin(t * 9 + i) * 4;
      const y = f.from.y + (f.to.y - f.from.y) * u - Math.sin(u * Math.PI) * 30 + Math.cos(t * 11 + i) * 3;
      bee(ctx, x, y, 5, t + i);
    }
  }

  // Lighter plots show how far a building reaches.
  function drawRange(ctx, state, L, b) {
    const range = FP.workerRange(b);
    for (let y = Math.max(0, b.y - range); y <= Math.min(state.rows - 1, b.y + range); y++) {
      for (let x = Math.max(0, b.x - range); x <= Math.min(state.cols - 1, b.x + range); x++) {
        const r = FP.plotRect(L, x, y);
        FP.roundRect(ctx, r.x, r.y, r.s, r.s, r.s * 0.12);
        ctx.fillStyle = "rgba(255,250,220,0.18)";
        ctx.fill();
      }
    }
    const a = FP.plotRect(L, Math.max(0, b.x - range), Math.max(0, b.y - range));
    const z = FP.plotRect(L, Math.min(state.cols - 1, b.x + range), Math.min(state.rows - 1, b.y + range));
    ctx.setLineDash([8, 6]);
    FP.roundRect(ctx, a.x - 4, a.y - 4, z.x + z.s - a.x + 8, z.y + z.s - a.y + 8, 12);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255,250,220,0.85)";
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Menu picture of a building, drawn with the same code as the farm.
  const buildingIcons = {};
  FP.buildingIconURL = function (def) {
    if (!buildingIcons[def.id]) {
      const c = document.createElement("canvas");
      c.width = c.height = 96;
      const g = c.getContext("2d");
      g.lineJoin = "round";
      BUILDINGS[def.id](g, { x: 4, y: 2, s: 88 }, 0.8);
      buildingIcons[def.id] = c.toDataURL();
    }
    return buildingIcons[def.id];
  };

  R.clearWorkers = function () {
    for (const uid in walkers) delete walkers[uid];
    pulses.length = 0;
    flights.length = 0;
  };

  // ---------- Tooltip ----------

  const FONT_BOLD = "600 17px Fredoka, 'Trebuchet MS', sans-serif";
  const FONT = "500 14px Fredoka, 'Trebuchet MS', sans-serif";

  function drawBuildingTooltip(ctx, b, view) {
    const def = FP.WORKER_BY_ID[b.workerId];
    const rarity = FP.RARITIES[def.rarity];
    const line2 = "Level " + b.level + ". Click for details.";
    ctx.font = FONT_BOLD;
    let w = ctx.measureText(def.building).width;
    ctx.font = FONT;
    w = Math.max(w, ctx.measureText(line2).width) + 26;
    const h = 52;
    const x = FP.clamp(view.mouse.x + 18, 4, FARM.x + FARM.w - w);
    const y = FP.clamp(view.mouse.y + 18, 70, H - 96 - h);
    FP.roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = "rgba(43,29,18,0.94)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rarity.color;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = FONT_BOLD;
    ctx.fillStyle = FP.shade(rarity.color, 0.35);
    ctx.fillText(def.building, x + 13, y + 22);
    ctx.font = FONT;
    ctx.fillStyle = "#f3e6d0";
    ctx.fillText(line2, x + 13, y + 41);
  }

  function drawTooltip(ctx, state, view, now, t) {
    if (!view.hover || !view.mouse) return;
    const b = FP.buildingAt(state, view.hover.x, view.hover.y);
    if (b) return view.selected === b.uid ? null : drawBuildingTooltip(ctx, b, view);
    const plant = state.plots[view.hover.y][view.hover.x];
    if (!plant) return;
    const seed = FP.SEED_BY_ID[plant.seedId];
    const rarity = FP.RARITIES[seed.rarity];
    const status = FP.isRipe(plant, now) ? "Ready to harvest" : "Ready in " + FP.formatTime(FP.timeLeft(plant, now));
    const worth = FP.sellPrice(state, { value: Math.round(seed.value * FP.modMultiplier(plant.mods)) });
    const worthText = "Sells for " + FP.formatCoins(worth);

    // Modifier names wrap onto as many lines as they need.
    ctx.font = FONT;
    const maxW = 240;
    const modLines = [];
    let line = [], lineW = 0;
    plant.mods.forEach((id, i) => {
      const word = FP.MODS[id].name + (i < plant.mods.length - 1 ? ", " : "");
      const w = ctx.measureText(word).width;
      if (lineW + w > maxW && line.length) { modLines.push(line); line = []; lineW = 0; }
      line.push({ id, word, w });
      lineW += w;
    });
    if (line.length) modLines.push(line);

    let w = Math.max(ctx.measureText(status).width, ctx.measureText(worthText).width);
    modLines.forEach(l => { w = Math.max(w, l.reduce((sum, p) => sum + p.w, 0)); });
    ctx.font = FONT_BOLD;
    w = Math.max(w, ctx.measureText(seed.name).width) + 26;
    const h = 64 + modLines.length * 19;
    const x = FP.clamp(view.mouse.x + 18, 4, FARM.x + FARM.w - w);
    const y = FP.clamp(view.mouse.y + 18, 70, H - 96 - h);

    FP.roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = "rgba(43,29,18,0.94)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rarity.color;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = FONT_BOLD;
    ctx.fillStyle = FP.shade(rarity.color, 0.35);
    ctx.fillText(seed.name, x + 13, y + 22);
    ctx.font = FONT;
    ctx.fillStyle = "#f3e6d0";
    ctx.fillText(status, x + 13, y + 41);
    let ly = y + 41;
    modLines.forEach(l => {
      ly += 19;
      let lx = x + 13;
      l.forEach((part, i) => {
        ctx.fillStyle = FP.shade(modColor(part.id, t, i).replace("rainbow", "#ffffff"), 0.2);
        ctx.fillText(part.word, lx, ly);
        lx += part.w;
      });
    });
    ctx.fillStyle = "#ffd76a";
    ctx.fillText(worthText, x + 13, ly + 19);
  }

  // ---------- Frame ----------

  // Fades the weather on screen toward the weather in the game.
  function updateSky(state, dt) {
    const target = state.weather.id;
    if (sky.id !== target) {
      sky.alpha -= dt / 1.5;
      if (sky.alpha <= 0) { sky.id = target; sky.alpha = 0; }
    } else {
      sky.alpha = Math.min(1, sky.alpha + dt / 1.5);
    }
  }

  // Says whether the held tool would do something on this plot, for the green outline.
  function toolFits(state, tool, plant, now) {
    if (!plant) return false;
    if (!tool.toolId) return false;
    const def = FP.TOOL_BY_ID[tool.toolId];
    if (def.grow) return !FP.isRipe(plant, now);
    if (tool.toolId === "trowel") return true;
    if (tool.toolId === "jar") {
      const mod = FP.currentWeather(state).mod;
      return !!mod && !plant.mods.includes(mod);
    }
    if (tool.toolId === "spray") return !plant.mods.includes("golden");
    return false;
  }

  // view holds what the player is pointing at and holding: { hover, mouse, tool, pendingDig, carrying }
  R.draw = function (state, now, dt, view) {
    const ctx = R.ctx;
    const t = now / 1000;
    ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    if (!bgCache) bgCache = buildBackground();
    ctx.drawImage(bgCache, 0, 0, W, H);

    const L = FP.layout(state);
    ctx.drawImage(farmLayer(state, L), 0, 0, W, H);
    const tool = view.tool;
    const carrying = view.carrying;
    const isHover = (x, y) => view.hover && view.hover.x === x && view.hover.y === y;

    // The range of the selected or hovered building shows on the soil.
    const hoveredBuilding = view.hover && FP.buildingAt(state, view.hover.x, view.hover.y);
    const shownBuilding = state.buildings.find(b => b.uid === view.selected) || hoveredBuilding;
    if (shownBuilding) drawRange(ctx, state, L, shownBuilding);

    // Hover highlights and outlines sit on the soil, under the plants.
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const plant = state.plots[y][x];
        const r = FP.plotRect(L, x, y);
        const hovered = isHover(x, y);
        if (hovered) {
          FP.roundRect(ctx, r.x, r.y, r.s, r.s, r.s * 0.12);
          ctx.fillStyle = "rgba(255,240,210,0.16)";
          ctx.fill();
        }
        const building = FP.buildingAt(state, x, y);
        if (building && (view.selected === building.uid || hovered)) plotOutline(ctx, r, "#fff3a0");
        else if (hovered && tool && tool.type === "building" && !plant && !building) plotOutline(ctx, r, "#8be04e");
        else if (carrying && carrying.x === x && carrying.y === y) plotOutline(ctx, r, "#7fd3ff");
        else if (carrying && hovered && !plant) plotOutline(ctx, r, "#7fd3ff");
        else if (view.pendingDig && view.pendingDig.x === x && view.pendingDig.y === y) plotOutline(ctx, r, "#e5533d");
        else if (hovered && tool && tool.type === "shovel" && plant) plotOutline(ctx, r, "#e5533d");
        else if (hovered && tool && tool.type === "tool" && toolFits(state, tool, plant, now)) plotOutline(ctx, r, "#8be04e");
        else if (hovered && plant && FP.isRipe(plant, now)) plotOutline(ctx, r, "#fff3a0");
      }
    }

    // Top row first, so tall plants overlap the row behind them.
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const plant = state.plots[y][x];
        const r = FP.plotRect(L, x, y);
        if (plant) {
          const { stage } = FP.growStage(plant, now);
          const popAt = trackStage(x, y, plant, stage, r, now);
          const lifted = carrying && carrying.x === x && carrying.y === y;
          if (lifted) ctx.globalAlpha = 0.45;
          drawPlantAt(ctx, plant, r, now, t, x * 7.3 + y * 3.1, popAt);
          ctx.globalAlpha = 1;
          // Plants with modifiers give off a little sparkle in their colors now and then.
          if (plant.mods.length && !FP.settings.calm && Math.random() < dt * 0.8) {
            const id = plant.mods[Math.floor(Math.random() * plant.mods.length)];
            fx.burst(r.x + r.s * (0.3 + Math.random() * 0.4), r.y + r.s * (0.3 + Math.random() * 0.3), modColor(id, t), 1, 0.25);
          }
        } else {
          delete memory[x + "," + y];
          if (isHover(x, y) && tool && tool.type === "seed" && !FP.buildingAt(state, x, y)) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.translate(r.x + r.s / 2, r.y + r.s * 0.74);
            FP.drawSprout(ctx, r.s * PLANT_SCALE);
            ctx.restore();
          }
        }
      }
      drawBuildingsInRow(ctx, state, L, y, t);
    }

    updateWalkers(state, L, dt);
    drawPulses(ctx, dt);
    drawWalkers(ctx, state, L, t);
    drawFlights(ctx, dt, t);

    if (!FP.settings.calm) drawClouds(ctx, t);
    updateSky(state, dt);
    // Butterflies stay out of rain, snow, and the dark.
    ctx.globalAlpha = FP.ROUGH_WEATHER[sky.id] ? 1 - sky.alpha : 1;
    if (ctx.globalAlpha > 0.01 && !FP.settings.calm) drawButterflies(ctx, t);
    ctx.globalAlpha = 1;
    FP.drawWeather(ctx, sky.id, t, sky.alpha);

    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const plant = state.plots[y][x];
        if (!plant) continue;
        const r = FP.plotRect(L, x, y);
        drawStatus(ctx, plant, r, now, t, x * 7.3 + y * 3.1);
        drawModPips(ctx, plant, r, t);
      }
    }
    drawTooltip(ctx, state, view, now, t);

    const fctx = R.fxCtx;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, R.fxCanvas.width, R.fxCanvas.height);
    fctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
    drawFx(fctx, dt);

    firstFrame = false;
  };

  // Forget remembered stages, for example after the farm is reset.
  R.forget = function () {
    for (const key in memory) delete memory[key];
    firstFrame = true;
  };
})(window.FP);
