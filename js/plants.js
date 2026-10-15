// Plant drawings. Each shape draws with (0, 0) at the soil, and up is negative y.
// s is the plot size, so every plant scales with the farm.
(function (FP) {
  const TAU = FP.TAU;
  const LEAF = "#5cb84a";
  const LEAF_DARK = "#3f8f35";
  const STEM = "#4f9a3c";
  const BARK = "#8a5a36";
  let lw = 2; // outline width, set from the plot size in drawPlant

  // ---------- Building blocks ----------

  function fillStroke(ctx, fill) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = FP.shade(fill, -0.42);
    ctx.stroke();
  }

  function shine(ctx, x, y, r) {
    ctx.beginPath();
    ctx.ellipse(x - r * 0.35, y - r * 0.38, r * 0.3, r * 0.18, -0.6, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();
  }

  function ball(ctx, x, y, r, color, glossy = true) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    fillStroke(ctx, color);
    if (glossy && r > 3) shine(ctx, x, y, r);
  }

  // A leaf pointing up, then rotated by ang around its base.
  function leaf(ctx, x, y, len, wid, ang, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.8, 0, -len);
    ctx.bezierCurveTo(-wid * 0.8, -len * 0.8, -wid, -len * 0.25, 0, 0);
    fillStroke(ctx, color);
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.08);
    ctx.lineTo(0, -len * 0.78);
    ctx.strokeStyle = FP.shade(color, -0.22);
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
    ctx.restore();
  }

  function stem(ctx, x1, y1, x2, y2, width, color = STEM) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width + lw * 2;
    ctx.strokeStyle = FP.shade(color, -0.42);
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  // A circle with a wavy edge, used for lettuce and bushes.
  function scallop(ctx, x, y, r, color, bumps = 8) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    for (let i = 0; i < bumps; i++) {
      const a1 = (i + 1) / bumps * TAU, am = (i + 0.5) / bumps * TAU;
      ctx.quadraticCurveTo(x + Math.cos(am) * r * 1.15, y + Math.sin(am) * r * 1.15, x + Math.cos(a1) * r, y + Math.sin(a1) * r);
    }
    ctx.closePath();
    fillStroke(ctx, color);
  }

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.5 : r;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    fillStroke(ctx, color);
    shine(ctx, x, y, r * 0.6);
  }

  function blossom(ctx, x, y, r) {
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, TAU);
      ctx.fillStyle = "#fffaf0";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, TAU);
    ctx.fillStyle = "#ffd447";
    ctx.fill();
  }

  function strawberry(ctx, x, y, r, color, ripe) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 1.3);
    ctx.bezierCurveTo(x - r * 1.4, y + r * 0.2, x - r * 1.0, y - r * 1.0, x, y - r * 0.8);
    ctx.bezierCurveTo(x + r * 1.0, y - r * 1.0, x + r * 1.4, y + r * 0.2, x, y + r * 1.3);
    fillStroke(ctx, color);
    if (ripe) {
      ctx.fillStyle = "#ffe08a";
      [[-0.4, -0.1], [0.4, -0.1], [0, 0.35], [-0.25, 0.7], [0.25, 0.7], [0, -0.45]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.ellipse(x + dx * r, y + dy * r, r * 0.09, r * 0.13, 0, 0, TAU);
        ctx.fill();
      });
    }
    leaf(ctx, x, y - r * 0.7, r * 0.6, r * 0.3, -2.0, LEAF);
    leaf(ctx, x, y - r * 0.7, r * 0.6, r * 0.3, 2.0, LEAF);
    leaf(ctx, x, y - r * 0.7, r * 0.5, r * 0.25, 0, LEAF_DARK);
  }

  function berryCluster(ctx, x, y, r, color) {
    ball(ctx, x - r * 0.9, y, r, color);
    ball(ctx, x + r * 0.9, y, r, color);
    ball(ctx, x, y - r * 0.85, r, color);
  }

  function tuber(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.72, -0.15, 0, TAU);
    fillStroke(ctx, color);
    ctx.fillStyle = FP.shade(color, -0.35);
    [[-0.4, -0.15], [0.3, 0.1], [0.05, -0.35]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, r * 0.08, 0, TAU);
      ctx.fill();
    });
    shine(ctx, x, y, r * 0.8);
  }

  function sprout(ctx, s) {
    stem(ctx, 0, 0, 0, -s * 0.11, s * 0.03);
    leaf(ctx, 0, -s * 0.1, s * 0.13, s * 0.06, -1.0, LEAF);
    leaf(ctx, 0, -s * 0.1, s * 0.13, s * 0.06, 1.0, LEAF_DARK);
  }

  // ---------- Shapes ----------

  const SHAPES = {
    // Carrot and radish. The root pokes out of the soil once it gets big.
    root(ctx, s, stage, seed) {
      let top = 0;
      if (stage >= 2) {
        const ripe = stage === 3;
        let w = s * (ripe ? 0.12 : 0.075), h = s * (ripe ? 0.09 : 0.05);
        if (seed.round) { w *= 1.2; h *= 1.7; }
        ctx.beginPath();
        ctx.ellipse(0, s * 0.015, w, h, 0, Math.PI, TAU);
        ctx.closePath();
        fillStroke(ctx, seed.color);
        if (seed.round) {
          shine(ctx, 0, -h * 0.4, w * 0.8);
        } else {
          ctx.strokeStyle = FP.shade(seed.color, -0.25);
          ctx.lineWidth = lw * 0.7;
          for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(-w * 0.55, -h * i * 0.3);
            ctx.lineTo(w * 0.1, -h * i * 0.3);
            ctx.stroke();
          }
        }
        top = -h * 0.75;
      }
      const n = stage === 1 ? 3 : 5;
      const len = s * (0.16 + 0.07 * stage);
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1) - 0.5) * 1.4;
        leaf(ctx, 0, top, len * (1 - Math.abs(a) * 0.3), s * 0.05, a, i % 2 ? LEAF_DARK : LEAF);
      }
    },

    leafy(ctx, s, stage, seed) {
      const R = s * (0.05 + 0.045 * stage);
      const dark = FP.shade(seed.color, -0.22), light = FP.shade(seed.color, 0.3);
      scallop(ctx, -R * 0.85, -R * 0.85, R * 0.8, dark);
      scallop(ctx, R * 0.85, -R * 0.85, R * 0.8, dark);
      scallop(ctx, 0, -R * 1.3, R * 0.85, dark);
      if (stage >= 2) {
        scallop(ctx, -R * 0.5, -R * 0.55, R * 0.75, seed.color);
        scallop(ctx, R * 0.5, -R * 0.55, R * 0.75, seed.color);
      }
      scallop(ctx, 0, -R * 0.9, R * (stage === 3 ? 0.62 : 0.5), light);
    },

    // A leafy bush. The fruit field decides what grows on it.
    bush(ctx, s, stage, seed) {
      const R = s * (0.06 + 0.04 * stage);
      scallop(ctx, -R * 0.75, -R * 0.8, R * 0.75, LEAF_DARK, 7);
      scallop(ctx, R * 0.75, -R * 0.8, R * 0.75, LEAF_DARK, 7);
      scallop(ctx, 0, -R * 1.3, R * 0.8, LEAF, 7);
      scallop(ctx, 0, -R * 0.65, R * 0.8, LEAF, 7);
      if (stage < 2) return;

      const ripe = stage === 3;
      const spots = [[-0.7, -0.75], [0.6, -1.05], [0.15, -0.45], [-0.15, -1.35]];
      if (seed.fruit === "round") {
        spots.slice(0, 3).forEach(([x, y]) => ball(ctx, x * R, y * R, s * (ripe ? 0.07 : 0.045), ripe ? seed.color : "#a5d65a"));
      } else if (seed.fruit === "strawberry") {
        spots.slice(0, 3).forEach(([x, y]) => strawberry(ctx, x * R, y * R + s * 0.02, s * (ripe ? 0.05 : 0.035), ripe ? seed.color : "#cfe8a0", ripe));
      } else if (seed.fruit === "berry") {
        spots.forEach(([x, y]) => berryCluster(ctx, x * R, y * R, s * (ripe ? 0.03 : 0.022), ripe ? seed.color : "#c4dd9a"));
      } else if (seed.fruit === "tuber") {
        if (!ripe) {
          spots.forEach(([x, y]) => blossom(ctx, x * R, y * R, s * 0.022));
        } else {
          tuber(ctx, -s * 0.13, -s * 0.01, s * 0.07, seed.color);
          tuber(ctx, s * 0.14, 0, s * 0.06, seed.color);
          tuber(ctx, s * 0.01, s * 0.02, s * 0.075, seed.color);
        }
      }
    },

    pumpkin(ctx, s, stage, seed) {
      const lr = s * (0.08 + 0.04 * stage);
      leaf(ctx, -s * 0.05, 0, lr * 1.6, lr * 0.9, -1.25, LEAF_DARK);
      leaf(ctx, s * 0.05, 0, lr * 1.6, lr * 0.9, 1.25, LEAF);
      if (stage === 1) {
        leaf(ctx, 0, 0, lr * 1.4, lr * 0.8, 0, LEAF);
        return;
      }
      const ripe = stage === 3;
      const R = s * (ripe ? 0.2 : 0.1);
      const color = ripe ? seed.color : "#8cc152";
      const cy = -R * 0.85;
      const side = FP.shade(color, -0.1);
      ctx.beginPath(); ctx.ellipse(-R * 0.45, cy, R * 0.6, R * 0.82, 0, 0, TAU); fillStroke(ctx, side);
      ctx.beginPath(); ctx.ellipse(R * 0.45, cy, R * 0.6, R * 0.82, 0, 0, TAU); fillStroke(ctx, side);
      ctx.beginPath(); ctx.ellipse(0, cy, R * 0.55, R * 0.88, 0, 0, TAU); fillStroke(ctx, color);
      shine(ctx, 0, cy, R * 0.55);
      stem(ctx, 0, cy - R * 0.8, R * 0.18, cy - R * 1.15, s * 0.035, "#6b8e23");
    },

    stalk(ctx, s, stage, seed) {
      const H = s * (0.2 + 0.15 * stage);
      stem(ctx, 0, 0, 0, -H, s * 0.035, "#7cbf4a");
      const leaves = 2 + stage;
      for (let i = 0; i < leaves; i++) {
        const y = -H * (0.2 + i * 0.65 / leaves);
        leaf(ctx, 0, y, s * (0.16 + 0.03 * stage), s * 0.035, i % 2 ? 1.0 : -1.0, i % 2 ? LEAF : LEAF_DARK);
      }
      if (stage < 2) return;
      const ripe = stage === 3;
      // Tassel on top
      for (let i = -1; i <= 1; i++) stem(ctx, 0, -H, i * s * 0.035, -H - s * 0.06, s * 0.01, "#d9b860");
      // Ear of corn, tilted off the stalk
      ctx.save();
      ctx.translate(s * 0.03, -H * 0.5);
      ctx.rotate(0.35);
      const ch = s * (ripe ? 0.16 : 0.11), cw = s * (ripe ? 0.05 : 0.04);
      if (ripe) {
        ctx.beginPath();
        ctx.ellipse(0, -ch * 0.55, cw * 0.85, ch * 0.55, 0, 0, TAU);
        fillStroke(ctx, seed.color);
        ctx.fillStyle = FP.shade(seed.color, -0.15);
        for (let row = 0; row < 4; row++) {
          for (let col = -1; col <= 1; col++) {
            ctx.beginPath();
            ctx.arc(col * cw * 0.4, -ch * (0.3 + row * 0.18), cw * 0.12, 0, TAU);
            ctx.fill();
          }
        }
      }
      leaf(ctx, 0, 0, ch * 1.05, cw * 0.9, ripe ? -0.45 : -0.12, "#9ccc5a");
      leaf(ctx, 0, 0, ch * 1.05, cw * 0.9, ripe ? 0.45 : 0.12, "#8bbd4a");
      ctx.restore();
    },

    // Starfruit and golden apple.
    tree(ctx, s, stage, seed) {
      const H = s * (0.12 + 0.11 * stage);
      const tw = s * (0.03 + 0.012 * stage);
      ctx.beginPath();
      ctx.moveTo(-tw, 0);
      ctx.lineTo(-tw * 0.6, -H);
      ctx.lineTo(tw * 0.6, -H);
      ctx.lineTo(tw, 0);
      ctx.closePath();
      fillStroke(ctx, BARK);
      if (stage === 1) {
        leaf(ctx, 0, -H, s * 0.14, s * 0.06, -0.7, LEAF);
        leaf(ctx, 0, -H, s * 0.14, s * 0.06, 0.7, LEAF_DARK);
        leaf(ctx, 0, -H, s * 0.12, s * 0.05, 0, LEAF);
        return;
      }
      const R = s * (stage === 2 ? 0.15 : 0.18);
      const cy = -H - R * 0.4;
      [[-0.65, 0.15, 0.62, LEAF_DARK], [0.65, 0.15, 0.62, LEAF_DARK], [0, -0.45, 0.75, LEAF], [-0.3, 0.2, 0.6, LEAF], [0.3, 0.2, 0.6, LEAF]]
        .forEach(([x, y, r, c]) => ball(ctx, x * R, cy + y * R, r * R, c, false));
      const spots = [[-0.6, 0.2], [0.55, 0.05], [0, -0.5], [0.15, 0.45]];
      if (stage === 2) {
        spots.forEach(([x, y]) => blossom(ctx, x * R, cy + y * R, s * 0.022));
        return;
      }
      spots.forEach(([x, y]) => {
        const fx = x * R, fy = cy + y * R;
        if (seed.fruit === "star") {
          star(ctx, fx, fy, s * 0.058, seed.color);
        } else {
          ball(ctx, fx, fy, s * 0.048, seed.color);
          leaf(ctx, fx + s * 0.01, fy - s * 0.04, s * 0.035, s * 0.015, 0.6, LEAF);
        }
      });
    },

    flower(ctx, s, stage, seed, t) {
      const H = s * (0.14 + 0.1 * stage);
      stem(ctx, 0, 0, 0, -H, s * 0.025);
      leaf(ctx, 0, -H * 0.25, s * 0.14, s * 0.06, -1.1, LEAF_DARK);
      leaf(ctx, 0, -H * 0.4, s * 0.13, s * 0.055, 1.1, LEAF);
      if (stage === 1) return;
      const cy = -H;
      if (stage === 2) {
        ctx.beginPath();
        ctx.ellipse(0, cy - s * 0.045, s * 0.035, s * 0.06, 0, 0, TAU);
        fillStroke(ctx, FP.shade(seed.color, 0.35));
        leaf(ctx, 0, cy, s * 0.05, s * 0.025, -0.5, LEAF);
        leaf(ctx, 0, cy, s * 0.05, s * 0.025, 0.5, LEAF);
        return;
      }
      const pulse = 0.75 + Math.sin(t * 2) * 0.25;
      const glow = ctx.createRadialGradient(0, cy, 0, 0, cy, s * 0.32);
      glow.addColorStop(0, FP.rgba(seed.color, 0.6 * pulse));
      glow.addColorStop(1, FP.rgba(seed.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, cy, s * 0.32, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        leaf(ctx, 0, cy, s * 0.14, s * 0.07, i / 6 * TAU, i % 2 ? seed.color : FP.shade(seed.color, 0.25));
      }
      ball(ctx, 0, cy, s * 0.035, "#fff1a8");
    },
  };

  FP.drawPlant = function (ctx, seed, s, stage, t = 0) {
    lw = Math.max(1, s * 0.018);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (stage === 0) return sprout(ctx, s);
    (SHAPES[seed.shape] || SHAPES.bush)(ctx, s, stage, seed, t);
  };

  FP.drawSprout = function (ctx, s) {
    lw = Math.max(1, s * 0.018);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    sprout(ctx, s);
  };

  // ---------- Icons for the menus ----------

  const iconCache = {};

  // Draws the ripe plant large, finds the pixels it covered, and scales that box
  // to fill the icon. Short plants like lettuce come out as big as tall ones.
  FP.seedIconURL = function (seed) {
    if (iconCache[seed.id]) return iconCache[seed.id];
    const big = document.createElement("canvas");
    big.width = big.height = 400;
    const bctx = big.getContext("2d");
    bctx.translate(200, 300);
    FP.drawPlant(bctx, seed, 300, 3, 0);

    const data = bctx.getImageData(0, 0, 400, 400).data;
    let x0 = 400, y0 = 400, x1 = 0, y1 = 0;
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 400; x++) {
        if (data[(y * 400 + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }

    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const fit = 80 / Math.max(w, h);
    c.getContext("2d").drawImage(big, x0, y0, w, h, (96 - w * fit) / 2, (96 - h * fit) / 2, w * fit, h * fit);
    return (iconCache[seed.id] = c.toDataURL());
  };

  FP.shovelIconURL = function () {
    if (iconCache.shovel) return iconCache.shovel;
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const ctx = c.getContext("2d");
    lw = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.translate(48, 48);
    ctx.rotate(-0.75);
    stem(ctx, 0, -34, 0, 6, 7, "#a0703f");
    stem(ctx, -9, -34, 9, -34, 6, "#a0703f");
    ctx.beginPath();
    ctx.moveTo(-13, 4);
    ctx.lineTo(13, 4);
    ctx.lineTo(12, 22);
    ctx.quadraticCurveTo(0, 38, -12, 22);
    ctx.closePath();
    fillStroke(ctx, "#b8c4cc");
    shine(ctx, 0, 14, 9);
    return (iconCache.shovel = c.toDataURL());
  };

  const TOOL_ICONS = {
    can(ctx) {
      stem(ctx, 30, 56, 12, 30, 7, "#5f93b8");          // spout
      ctx.beginPath();
      ctx.arc(60, 40, 16, Math.PI, 0);                   // handle
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#3d6a8a";
      ctx.stroke();
      FP.roundRect(ctx, 30, 40, 44, 40, 10);
      fillStroke(ctx, "#7fb3d5");
      shine(ctx, 46, 54, 12);
      ctx.fillStyle = "#4b8bff";                         // drops
      [[10, 40], [16, 48]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); });
    },
    fertilizer(ctx) {
      ctx.beginPath();
      ctx.moveTo(30, 28); ctx.lineTo(66, 28); ctx.lineTo(76, 84); ctx.lineTo(20, 84);
      ctx.closePath();
      fillStroke(ctx, "#c9a26b");
      stem(ctx, 36, 26, 60, 26, 6, "#a8834f");           // tied top
      leaf(ctx, 48, 72, 26, 11, -0.4, LEAF);
      leaf(ctx, 48, 72, 22, 9, 0.5, LEAF_DARK);
    },
    trowel(ctx) {
      ctx.translate(48, 48);
      ctx.rotate(-0.75);
      stem(ctx, 0, -38, 0, -6, 9, "#a0703f");
      ctx.beginPath();
      ctx.moveTo(-14, -4); ctx.lineTo(14, -4);
      ctx.quadraticCurveTo(14, 26, 0, 40);
      ctx.quadraticCurveTo(-14, 26, -14, -4);
      ctx.closePath();
      fillStroke(ctx, "#b8c4cc");
      shine(ctx, 0, 10, 10);
    },
    jar(ctx) {
      FP.roundRect(ctx, 24, 26, 48, 60, 12);
      ctx.fillStyle = "rgba(200,230,255,0.55)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#5b7c99";
      ctx.stroke();
      FP.roundRect(ctx, 28, 16, 40, 12, 4);
      fillStroke(ctx, "#a0703f");                        // lid
      ctx.beginPath();                                   // little storm cloud inside
      ctx.arc(40, 50, 9, 0, TAU); ctx.arc(52, 46, 11, 0, TAU); ctx.arc(60, 54, 8, 0, TAU);
      ctx.fillStyle = "#7c869a";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(50, 56); ctx.lineTo(43, 70); ctx.lineTo(50, 69); ctx.lineTo(46, 80); ctx.lineTo(58, 63); ctx.lineTo(51, 64); ctx.lineTo(55, 56);
      ctx.closePath();
      fillStroke(ctx, "#ffe14d");
      shine(ctx, 36, 40, 10);
    },
    spray(ctx) {
      FP.roundRect(ctx, 30, 38, 36, 50, 10);
      fillStroke(ctx, "#f2c230");
      FP.roundRect(ctx, 38, 24, 20, 16, 3);
      fillStroke(ctx, "#8a5a36");
      stem(ctx, 58, 30, 72, 30, 5, "#8a5a36");           // nozzle
      shine(ctx, 46, 56, 12);
      ctx.fillStyle = "#fff3a0";
      [[80, 22, 3], [84, 34, 2.5], [78, 42, 2]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
    },
  };

  FP.toolIconURL = function (tool) {
    const key = "tool:" + tool.id;
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const ctx = c.getContext("2d");
    lw = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    TOOL_ICONS[tool.id](ctx);
    return (iconCache[key] = c.toDataURL());
  };
})(window.FP);
