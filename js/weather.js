// Weather you can see: falling rain and snow, sky tints, lightning, and the small weather icons.
(function (FP) {
  const TAU = FP.TAU;
  const W = 1280, H = 720;

  // Fixed random positions for falling things, so every drop keeps its own lane.
  const rand = FP.rng(2024);
  const drops = Array.from({ length: 160 }, () => ({ x: rand(), y: rand(), speed: 0.8 + rand() * 0.4, size: rand() }));

  function tint(ctx, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
  }

  function rain(ctx, t, count, slant, alpha) {
    ctx.strokeStyle = `rgba(200,225,255,${0.55 * alpha})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const d = drops[i];
      const y = ((d.y * H + t * 900 * d.speed) % (H + 40)) - 20;
      const x = ((d.x * (W + 200) + y * slant) % (W + 200)) - 100;
      ctx.moveTo(x, y);
      ctx.lineTo(x + slant * 16, y + 16);
    }
    ctx.stroke();
  }

  function snow(ctx, t, alpha) {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * alpha})`;
    for (let i = 0; i < 110; i++) {
      const d = drops[i];
      const y = ((d.y * H + t * 45 * d.speed) % (H + 20)) - 10;
      const x = d.x * W + Math.sin(t * 0.8 + i) * 18;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + d.size * 2.2, 0, TAU);
      ctx.fill();
    }
  }

  function hail(ctx, t, alpha) {
    ctx.fillStyle = `rgba(235,248,255,${0.9 * alpha})`;
    ctx.strokeStyle = `rgba(120,160,200,${0.6 * alpha})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const d = drops[i];
      const y = ((d.y * H + t * 650 * d.speed) % (H + 20)) - 10;
      const x = d.x * W + y * 0.1;
      ctx.beginPath();
      ctx.arc(x % W, y, 2 + d.size * 1.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  function skyGlow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, FP.rgba(color, alpha));
    g.addColorStop(1, FP.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function sunRays(ctx, t, alpha) {
    ctx.save();
    ctx.translate(40, 60);
    ctx.rotate(t * 0.03);
    ctx.fillStyle = `rgba(255,236,170,${0.09 * alpha})`;
    for (let i = 0; i < 9; i++) {
      ctx.rotate(TAU / 9);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(1400, -90);
      ctx.lineTo(1400, 90);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    skyGlow(ctx, 40, 60, 420, "#fff2b0", 0.35 * alpha);
  }

  function rainbowArc(ctx, t, alpha) {
    ctx.lineWidth = 16;
    FP.RAINBOW.forEach((color, i) => {
      ctx.strokeStyle = FP.rgba(color, 0.2 * alpha);
      ctx.beginPath();
      ctx.arc(460, 760, 620 - i * 16, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    });
    // Glitter drifting down
    for (let i = 0; i < 40; i++) {
      const d = drops[i];
      const y = ((d.y * H + t * 30 * d.speed) % H);
      const x = d.x * 900;
      const a = (0.5 + 0.5 * Math.sin(t * 4 + i)) * alpha;
      ctx.fillStyle = FP.rgba(FP.RAINBOW[i % FP.RAINBOW.length], 0.8 * a);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, TAU);
      ctx.fill();
    }
  }

  // Only the moon's glow shows. A solid moon would sit on top of the plots.
  function moon(ctx, color, alpha) {
    skyGlow(ctx, 40, 60, 360, color, 0.4 * alpha);
  }

  function meteors(ctx, t, alpha) {
    for (let i = 0; i < 5; i++) {
      const period = 2.2 + i * 0.37;
      const k = ((t + i * 0.9) % period) / period; // 0 to 1 over each meteor's trip
      if (k > 0.45) continue;                       // each one is only visible part of the time
      const u = k / 0.45;
      const sx = (drops[i].x * 700 + Math.floor((t + i * 0.9) / period) * 311) % 900;
      const x = sx + u * 380, y = -20 + u * 300;
      const g = ctx.createLinearGradient(x - 120, y - 95, x, y);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, `rgba(230,210,255,${0.9 * alpha})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 120, y - 95);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fill();
    }
  }

  // Streaks of wind and a few leaves blowing across. strength speeds everything up for a hurricane.
  function wind(ctx, t, alpha, strength) {
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * alpha})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 14 * strength; i++) {
      const d = drops[i];
      const x = ((d.x * (W + 400) + t * 420 * strength * d.speed) % (W + 400)) - 200;
      const y = d.y * H;
      const len = 60 + d.size * 80;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.3, y - 8, x + len * 0.6, y + 8, x + len, y);
      ctx.stroke();
    }
    for (let i = 0; i < 10 * strength; i++) {
      const d = drops[40 + i];
      const x = ((d.x * (W + 200) + t * 300 * strength * d.speed) % (W + 200)) - 100;
      const y = d.y * H + Math.sin(t * 3 + i) * 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 4 + i);
      ctx.fillStyle = FP.rgba(i % 3 ? "#6fbf4a" : "#d9a441", 0.85 * alpha);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // Soft bands of fog drifting slowly sideways.
  function fog(ctx, t, alpha) {
    for (let i = 0; i < 10; i++) {
      const y = 40 + i * 70 + Math.sin(t * 0.3 + i) * 12;
      const x = ((i * 377 + t * (12 + i * 3)) % (W + 600)) - 300;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 340);
      g.addColorStop(0, `rgba(240,242,246,${0.55 * alpha})`);
      g.addColorStop(1, "rgba(235,238,242,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 340, y - 340, 680, 680);
    }
  }

  // Thick snow driven sideways by the wind.
  function blizzard(ctx, t, alpha) {
    ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`;
    for (let i = 0; i < 160; i++) {
      const d = drops[i];
      const y = ((d.y * H + t * 160 * d.speed) % (H + 20)) - 10;
      const x = ((d.x * (W + 300) + t * 260 * d.speed + Math.sin(t * 2 + i) * 10) % (W + 300)) - 150;
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + d.size * 2.4, 0, TAU);
      ctx.fill();
    }
  }

  // Lightning flashes at random moments during a thunderstorm.
  const storm = { next: 0, flashAt: -10, boltX: 0 };

  function lightning(ctx, t, alpha) {
    if (t > storm.next) {
      storm.flashAt = t;
      storm.boltX = 120 + Math.random() * 700;
      storm.next = t + 4 + Math.random() * 6;
    }
    const since = t - storm.flashAt;
    if (since < 0.5) {
      ctx.fillStyle = `rgba(255,255,240,${0.35 * (1 - since / 0.5) * alpha})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (since < 0.18) {
      const r = FP.rng(Math.floor(storm.flashAt * 100));
      ctx.strokeStyle = `rgba(255,250,200,${alpha})`;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let x = storm.boltX, y = 0;
      ctx.moveTo(x, y);
      while (y < 420) {
        x += (r() - 0.5) * 70;
        y += 30 + r() * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Butterflies hide in these.
  FP.ROUGH_WEATHER = { rain: true, snow: true, hail: true, thunder: true, moonlight: true, bloodmoon: true, meteors: true,
    windy: true, fog: true, blizzard: true, hurricane: true };

  // alpha fades the whole effect in and out when the weather changes.
  FP.drawWeather = function (ctx, id, t, alpha) {
    if (alpha <= 0.01) return;
    switch (id) {
      case "rain":
        tint(ctx, `rgba(40,70,110,${0.14 * alpha})`);
        rain(ctx, t, 120, 0.2, alpha);
        break;
      case "thunder":
        tint(ctx, `rgba(25,30,55,${0.3 * alpha})`);
        rain(ctx, t, 160, 0.35, alpha);
        lightning(ctx, t, alpha);
        break;
      case "snow":
        tint(ctx, `rgba(225,238,255,${0.16 * alpha})`);
        snow(ctx, t, alpha);
        break;
      case "hail":
        tint(ctx, `rgba(190,215,240,${0.14 * alpha})`);
        hail(ctx, t, alpha);
        break;
      case "sunny":
        tint(ctx, `rgba(255,190,90,${0.1 * alpha})`);
        sunRays(ctx, t, alpha);
        break;
      case "moonlight":
        tint(ctx, `rgba(18,28,80,${0.34 * alpha})`);
        moon(ctx, "#e8ecff", alpha);
        break;
      case "bloodmoon":
        tint(ctx, `rgba(70,0,12,${0.36 * alpha})`);
        moon(ctx, "#ff4a4a", alpha);
        break;
      case "meteors":
        tint(ctx, `rgba(20,16,60,${0.32 * alpha})`);
        meteors(ctx, t, alpha);
        break;
      case "rainbow":
        tint(ctx, `rgba(255,220,240,${0.06 * alpha})`);
        rainbowArc(ctx, t, alpha);
        break;
      case "windy":
        tint(ctx, `rgba(200,235,220,${0.06 * alpha})`);
        wind(ctx, t, alpha, 1);
        break;
      case "fog":
        tint(ctx, `rgba(220,224,230,${0.22 * alpha})`);
        fog(ctx, t, alpha);
        break;
      case "blizzard":
        tint(ctx, `rgba(225,238,255,${0.3 * alpha})`);
        blizzard(ctx, t, alpha);
        hail(ctx, t, alpha * 0.7);
        break;
      case "hurricane":
        tint(ctx, `rgba(30,40,55,${0.34 * alpha})`);
        rain(ctx, t, 160, 1.1, alpha);
        wind(ctx, t, alpha, 2);
        lightning(ctx, t, alpha * 0.7);
        break;
    }
  };

  // ---------- Icons ----------

  function outlined(g, fill, line = 2.5) {
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = line;
    g.strokeStyle = FP.shade(fill.startsWith("#") ? fill : "#888888", -0.45);
    g.stroke();
  }

  function cloud(g, x, y, s, color) {
    g.beginPath();
    g.arc(x - s * 0.45, y + s * 0.1, s * 0.35, Math.PI * 0.5, Math.PI * 1.5);
    g.arc(x - s * 0.1, y - s * 0.2, s * 0.45, Math.PI, Math.PI * 1.85);
    g.arc(x + s * 0.42, y + s * 0.05, s * 0.38, Math.PI * 1.3, Math.PI * 0.5);
    g.closePath();
    outlined(g, color);
  }

  function sun(g, x, y, r) {
    g.strokeStyle = "#f5a623";
    g.lineWidth = 5;
    g.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3);
      g.lineTo(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7);
      g.stroke();
    }
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    outlined(g, "#ffd447");
  }

  const ICONS = {
    clear(g) { sun(g, 40, 38, 15); cloud(g, 58, 62, 26, "#ffffff"); },
    sunny(g) { sun(g, 48, 48, 20); },
    rain(g) {
      cloud(g, 48, 38, 34, "#dfe6ee");
      g.strokeStyle = "#4b8bff"; g.lineWidth = 5; g.lineCap = "round";
      [[30, 66], [48, 72], [66, 66]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x + 3, y - 8); g.lineTo(x - 2, y + 4); g.stroke(); });
    },
    snow(g) {
      g.strokeStyle = "#5aa9ff"; g.lineWidth = 6; g.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI;
        g.beginPath();
        g.moveTo(48 + Math.cos(a) * 30, 48 + Math.sin(a) * 30);
        g.lineTo(48 - Math.cos(a) * 30, 48 - Math.sin(a) * 30);
        g.stroke();
      }
      g.strokeStyle = "#e8f6ff"; g.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI;
        g.beginPath();
        g.moveTo(48 + Math.cos(a) * 28, 48 + Math.sin(a) * 28);
        g.lineTo(48 - Math.cos(a) * 28, 48 - Math.sin(a) * 28);
        g.stroke();
      }
    },
    hail(g) {
      cloud(g, 48, 38, 34, "#cfd8e3");
      [[32, 68], [50, 74], [66, 66]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 6, 0, TAU); outlined(g, "#eaf8ff", 2); });
    },
    moonlight(g) {
      g.beginPath();
      g.arc(48, 48, 28, 0.6, TAU - 0.6, false);
      g.arc(62, 40, 22, TAU - 1.2, 1.2, true);
      g.closePath();
      outlined(g, "#e8ecff");
    },
    thunder(g) {
      cloud(g, 48, 36, 34, "#8a93a6");
      g.beginPath();
      g.moveTo(50, 50); g.lineTo(38, 72); g.lineTo(50, 70); g.lineTo(44, 90); g.lineTo(64, 62); g.lineTo(52, 64); g.lineTo(58, 50);
      g.closePath();
      outlined(g, "#ffe14d", 2);
    },
    rainbow(g) {
      g.lineWidth = 7;
      FP.RAINBOW.slice(0, 5).forEach((color, i) => {
        g.strokeStyle = color;
        g.beginPath();
        g.arc(48, 70, 38 - i * 7, Math.PI, TAU);
        g.stroke();
      });
    },
    bloodmoon(g) {
      g.beginPath(); g.arc(48, 48, 28, 0, TAU); outlined(g, "#d7263d");
      g.fillStyle = "#a01a2c";
      [[38, 40, 6], [58, 54, 5], [44, 60, 4]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
    },
    windy(g) {
      g.strokeStyle = "#5fae8c"; g.lineWidth = 6; g.lineCap = "round";
      [[20, 34, 52], [12, 52, 64], [24, 70, 44]].forEach(([x, y, len]) => {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + len, y);
        g.arc(x + len, y - 9, 9, Math.PI / 2, -Math.PI * 0.9, true);
        g.stroke();
      });
    },
    fog(g) {
      cloud(g, 48, 36, 32, "#e4e8ee");
      g.strokeStyle = "#9aa3ae"; g.lineWidth = 6; g.lineCap = "round";
      [[18, 62, 60], [28, 76, 50]].forEach(([x, y, len]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); });
    },
    blizzard(g) {
      cloud(g, 48, 34, 34, "#cfd8e3");
      g.strokeStyle = "#5aa9ff"; g.lineWidth = 3; g.lineCap = "round";
      [[28, 66], [50, 76], [70, 64]].forEach(([x, y]) => {
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * Math.PI;
          g.beginPath();
          g.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
          g.lineTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8);
          g.stroke();
        }
      });
    },
    hurricane(g) {
      g.strokeStyle = "#5b6b80"; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = i / 60 * TAU * 2.2, rr = 4 + i * 0.55;
        g.lineTo(48 + Math.cos(a) * rr, 48 + Math.sin(a) * rr);
      }
      g.stroke();
      g.beginPath(); g.arc(48, 48, 6, 0, TAU); outlined(g, "#dfe6ee", 2);
    },
    meteors(g) {
      g.strokeStyle = "#c9a2ff"; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.moveTo(16, 18); g.lineTo(54, 52); g.stroke();
      g.beginPath(); g.arc(60, 58, 14, 0, TAU); outlined(g, "#f3e9ff");
    },
  };

  const iconCache = {};
  FP.weatherIconURL = function (id) {
    if (!iconCache[id]) {
      const c = document.createElement("canvas");
      c.width = c.height = 96;
      const g = c.getContext("2d");
      g.lineJoin = "round";
      (ICONS[id] || ICONS.clear)(g);
      iconCache[id] = c.toDataURL();
    }
    return iconCache[id];
  };
})(window.FP);
