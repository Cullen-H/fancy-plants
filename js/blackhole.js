// The black hole screen. Rebirth pulls the farm into it, and the GMO Point skill tree
// sits around it. The hole is drawn on its own canvas and the skills are HTML buttons.
(function (FP) {
  const TAU = FP.TAU;
  const W = 1280, H = 720, CX = 640, CY = 340;
  const RING1 = 150, RING2 = 255;  // distance of tier 1 and tier 2 skills from the center
  const BRANCH_ANGLE = [-135, -45, 45, 135].map(d => d * Math.PI / 180); // top left, top right, bottom right, bottom left

  const hole = FP.blackHole = { open: false, selected: null, intro: null, stars: [] };

  // Each skill's spot on the screen.
  function skillPos(skill) {
    const base = BRANCH_ANGLE[skill.branch];
    if (skill.tier === 1) return { x: CX + Math.cos(base) * RING1, y: CY + Math.sin(base) * RING1 };
    const siblings = FP.SKILLS.filter(s => s.branch === skill.branch && s.tier === 2);
    const spread = (siblings.indexOf(skill) - (siblings.length - 1) / 2) * 0.42;
    return { x: CX + Math.cos(base + spread) * RING2, y: CY + Math.sin(base + spread) * RING2 };
  }

  hole.init = function (game) {
    hole.game = game;
    hole.el = document.getElementById("void");
    hole.canvas = document.getElementById("void-canvas");
    hole.ctx = hole.canvas.getContext("2d");
    hole.nodes = document.getElementById("void-nodes");
    hole.lines = document.getElementById("void-lines");
    hole.info = document.getElementById("void-info");
    hole.points = document.getElementById("void-points");

    const rand = FP.rng(99);
    for (let i = 0; i < 220; i++) hole.stars.push({ a: rand() * TAU, r: 60 + rand() * 800, speed: 0.2 + rand() * 0.8, size: 0.6 + rand() * 1.6 });

    hole.nodes.addEventListener("click", e => {
      const b = e.target.closest("[data-skill]");
      if (b) { hole.selected = b.dataset.skill; hole.render(); }
    });
    hole.info.addEventListener("click", e => {
      const b = e.target.closest("[data-buy]");
      if (b && !b.disabled) game.action("buySkill", { id: b.dataset.buy });
    });
    document.getElementById("void-back").addEventListener("click", () => game.action("closeVoid", {}));
  };

  hole.resize = function (pixelScale) {
    hole.scale = pixelScale;
    hole.canvas = hole.canvas || document.getElementById("void-canvas");
    hole.ctx = hole.ctx || hole.canvas.getContext("2d");
    hole.canvas.width = Math.round(W * pixelScale);
    hole.canvas.height = Math.round(H * pixelScale);
  };

  // snapshot is the farm canvas, which gets pulled into the hole during the intro.
  hole.show = function (snapshot, gmoGained) {
    hole.open = true;
    hole.el.hidden = false;
    hole.selected = hole.selected || "thumb";
    hole.intro = snapshot ? { image: snapshot, start: performance.now(), gmo: gmoGained } : null;
    hole.el.classList.toggle("intro", !!snapshot);
    hole.render();
  };

  hole.hide = function () {
    hole.open = false;
    hole.el.hidden = true;
    hole.intro = null;
  };

  // ---------- The skill tree (HTML) ----------

  hole.render = function () {
    const state = hole.game.state;
    hole.points.textContent = state.rebirth.gmo;
    document.getElementById("void-rebirths").textContent =
      state.rebirth.count === 1 ? "1 rebirth" : state.rebirth.count + " rebirths";

    // Lines from the center to tier 1 skills, and from tier 1 to tier 2.
    let lines = "";
    FP.SKILLS.forEach(skill => {
      const p = skillPos(skill);
      const from = skill.tier === 1 ? { x: CX, y: CY } : skillPos(FP.SKILLS.find(s => s.branch === skill.branch && s.tier === 1));
      const lit = FP.skillLevel(state, skill.id) > 0;
      lines += `<line x1="${from.x}" y1="${from.y}" x2="${p.x}" y2="${p.y}" stroke="${FP.BRANCHES[skill.branch].color}" stroke-opacity="${lit ? 0.9 : 0.25}" stroke-width="${lit ? 4 : 2}" ${lit ? "" : 'stroke-dasharray="6 6"'}/>`;
    });
    hole.lines.innerHTML = lines;

    hole.nodes.innerHTML = FP.SKILLS.map(skill => {
      const p = skillPos(skill);
      const level = FP.skillLevel(state, skill.id);
      const blocked = FP.skillBlocked(state, skill.id);
      const ready = !blocked;
      const pips = Array.from({ length: skill.max }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("");
      return `<button class="skill ${level ? "owned" : ""} ${ready ? "ready" : ""} ${hole.selected === skill.id ? "picked" : ""}"
          data-skill="${skill.id}" style="left:${p.x}px; top:${p.y}px; --branch:${FP.BRANCHES[skill.branch].color}">
          <b>${skill.name}</b><span class="skill-pips">${pips}</span></button>`;
    }).join("");

    const skill = FP.SKILL_BY_ID[hole.selected];
    const level = FP.skillLevel(state, skill.id);
    const blocked = FP.skillBlocked(state, skill.id);
    const maxed = level >= skill.max;
    const cost = FP.skillCost(state, skill.id);
    hole.info.style.setProperty("--branch", FP.BRANCHES[skill.branch].color);
    hole.info.innerHTML = `<div class="void-info-head"><b>${skill.name}</b><span>${FP.BRANCHES[skill.branch].name}, level ${level} of ${skill.max}</span></div>
      <p>${skill.desc}</p>
      ${maxed ? `<button class="btn" disabled>Fully upgraded</button>`
        : `<button class="btn btn-gold" data-buy="${skill.id}" ${blocked ? "disabled" : ""}>Buy for ${cost} GMO ${cost === 1 ? "Point" : "Points"}</button>
           ${blocked ? `<span class="void-why">${blocked}</span>` : ""}`}`;
  };

  // ---------- The hole itself (canvas) ----------

  hole.draw = function (now) {
    if (!hole.open) return;
    const ctx = hole.ctx;
    const t = now / 1000;
    ctx.setTransform(hole.scale, 0, 0, hole.scale, 0, 0);

    const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 760);
    bg.addColorStop(0, "#1a0b2e");
    bg.addColorStop(0.5, "#0b0618");
    bg.addColorStop(1, "#000000");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Stars spiral inward and start over at the edge once they fall in.
    for (const s of hole.stars) {
      s.r -= s.speed * (1 + 140 / s.r) * 0.6;
      s.a += s.speed * 0.004 * (300 / s.r);
      if (s.r < 70) { s.r = 700 + Math.random() * 120; }
      const x = CX + Math.cos(s.a) * s.r, y = CY + Math.sin(s.a) * s.r * 0.62;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (s.r - 70) / 200)})`;
      ctx.fillRect(x, y, s.size, s.size);
    }

    // The glowing disk of stuff falling in, squashed so it looks tilted.
    ctx.save();
    ctx.translate(CX, CY);
    ctx.scale(1, 0.42);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(t * (0.4 + i * 0.12) + i);
      const r = 90 + i * 16;
      const g = ctx.createLinearGradient(-r, 0, r, 0);
      g.addColorStop(0, "rgba(255,120,40,0)");
      g.addColorStop(0.5, `rgba(255,${150 + i * 15},${80 + i * 25},${0.55 - i * 0.06})`);
      g.addColorStop(1, "rgba(180,90,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 10 - i;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // The hole, with a bright ring at its edge
    const rim = ctx.createRadialGradient(CX, CY, 58, CX, CY, 92);
    rim.addColorStop(0, "rgba(255,200,120,0.9)");
    rim.addColorStop(0.35, "rgba(200,110,255,0.45)");
    rim.addColorStop(1, "rgba(120,60,200,0)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(CX, CY, 92, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(CX, CY, 62, 0, TAU);
    ctx.fill();

    if (hole.intro) drawIntro(ctx, now);

    // The label in the middle of the hole
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 21px " + getComputedStyle(document.documentElement).getPropertyValue("--font-display");
    ctx.fillStyle = "#fff4d6";
    ctx.shadowColor = "rgba(255,170,90,0.9)";
    ctx.shadowBlur = 12;
    ctx.fillText("Fancy Plants!", CX, CY);
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
  };

  // The farm spins down into the hole, then the skill tree fades in.
  function drawIntro(ctx, now) {
    const k = (now - hole.intro.start) / 1800;
    if (k >= 1) {
      hole.el.classList.remove("intro");
      if (!hole.intro.announced) {
        hole.intro.announced = true;
        hole.game.action("voidArrived", { gmo: hole.intro.gmo });
      }
      return;
    }
    const e = k * k;
    ctx.save();
    ctx.globalAlpha = 1 - e;
    ctx.translate(CX, CY);
    ctx.rotate(e * TAU * 1.5);
    const s = 1 - e;
    ctx.scale(s, s);
    ctx.drawImage(hole.intro.image, -W / 2, -H / 2, W, H);
    ctx.restore();
  }
})(window.FP);
