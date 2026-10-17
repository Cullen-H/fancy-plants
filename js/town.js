// The Town, which opens after the first rebirth. It has a Casino where crops can be bet,
// and a Weather Station where a crop buys a say in the next weather.
(function (FP) {
  const TAU = FP.TAU;
  const W = 1280, H = 720, STREET = 560;

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

  const BUILDINGS = [
    { id: "casino",  name: "Casino",          x: 80,   w: 320, h: 300, open: true },
    { id: "weather", name: "Weather Station", x: 460,  w: 280, h: 280, open: true },
    { id: "soon1",   name: "Coming Soon",     x: 800,  w: 200, h: 220, open: false },
    { id: "soon2",   name: "Coming Soon",     x: 1040, w: 200, h: 250, open: false },
  ];

  const town = FP.town = { open: false, hover: null, modal: null };

  town.init = function (game) {
    town.game = game;
    town.el = document.getElementById("town");
    town.canvas = town.canvas || document.getElementById("town-canvas");
    town.ctx = town.canvas.getContext("2d");
    town.modalEl = document.getElementById("town-modal");

    town.canvas.addEventListener("pointermove", e => {
      const p = FP.renderer.toGame(e.clientX, e.clientY);
      town.hover = BUILDINGS.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= STREET - b.h - 40 && p.y <= STREET) || null;
      town.canvas.style.cursor = town.hover ? "pointer" : "default";
    });
    town.canvas.addEventListener("pointerdown", () => {
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

  function drawCasino(ctx, b, t) {
    const top = STREET - b.h;
    FP.roundRect(ctx, b.x, top, b.w, b.h, 8);
    outlined(ctx, "#7a2a4a");
    // Gold trim and a marquee of blinking lights
    FP.roundRect(ctx, b.x + 20, top + 20, b.w - 40, 70, 10);
    outlined(ctx, "#2a0f1f");
    for (let i = 0; i < 18; i++) {
      const lx = b.x + 28 + i * ((b.w - 56) / 17);
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
    ctx.fillText("CASINO", b.x + b.w / 2, top + 70);
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) windowPane(ctx, b.x + 34 + i * 90, top + 120, 60, 50, true);
    // Double doors
    FP.roundRect(ctx, b.x + b.w / 2 - 50, STREET - 100, 100, 100, 6);
    outlined(ctx, "#3a1424");
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2, STREET - 100);
    ctx.lineTo(b.x + b.w / 2, STREET);
    ctx.stroke();
    // A big gold coin over the door
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, STREET - 125, 18, 0, TAU);
    outlined(ctx, "#f5b82e");
  }

  function drawStation(ctx, b, t) {
    const top = STREET - b.h + 70;
    // Tower with a spinning dish on top
    FP.roundRect(ctx, b.x + b.w - 90, top - 90, 50, 100, 4);
    outlined(ctx, "#dfe8ef");
    ctx.save();
    ctx.translate(b.x + b.w - 65, top - 100);
    ctx.scale(Math.cos(t * 1.5), 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI);
    outlined(ctx, "#ffffff");
    ctx.restore();
    // A weather vane spinning in the wind
    ctx.save();
    ctx.translate(b.x + 60, top - 30);
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
    // Main building
    FP.roundRect(ctx, b.x, top, b.w, STREET - top, 8);
    outlined(ctx, "#4b8bff");
    FP.roundRect(ctx, b.x + 16, top + 16, b.w - 32, 44, 8);
    outlined(ctx, "#f3f8ff", 2);
    ctx.font = "700 24px " + FP.displayFont();
    ctx.textAlign = "center";
    ctx.fillStyle = "#24507a";
    ctx.fillText("Weather Station", b.x + b.w / 2, top + 46);
    windowPane(ctx, b.x + 30, top + 80, 70, 56, false);
    windowPane(ctx, b.x + b.w - 100, top + 80, 70, 56, false);
    // The weather machine glows through the left window
    ctx.beginPath();
    ctx.arc(b.x + 65, top + 108, 12, 0, TAU);
    ctx.fillStyle = `rgba(120,255,200,${0.5 + 0.4 * Math.sin(t * 4)})`;
    ctx.fill();
    FP.roundRect(ctx, b.x + b.w / 2 - 34, STREET - 90, 68, 90, 6);
    outlined(ctx, "#2f5f8f");
  }

  function drawSoon(ctx, b) {
    const top = STREET - b.h;
    FP.roundRect(ctx, b.x, top, b.w, b.h, 6);
    outlined(ctx, "#b39a7a");
    // Boards nailed across the front
    [[0.25, -0.12], [0.5, 0.1], [0.75, -0.08]].forEach(([k, tilt]) => {
      ctx.save();
      ctx.translate(b.x + b.w / 2, top + b.h * k);
      ctx.rotate(tilt);
      FP.roundRect(ctx, -b.w / 2 - 6, -12, b.w + 12, 24, 3);
      outlined(ctx, "#a0703f", 2);
      ctx.restore();
    });
    FP.roundRect(ctx, b.x + b.w / 2 - 70, top + b.h / 2 - 22, 140, 44, 6);
    outlined(ctx, "#fff4d6", 2);
    ctx.font = "700 18px " + FP.displayFont();
    ctx.textAlign = "center";
    ctx.fillStyle = "#7a2a1a";
    ctx.fillText("Coming Soon", b.x + b.w / 2, top + b.h / 2 + 6);
  }

  const folks = [
    { shirt: "#e8412c", speed: 38, offset: 0 },
    { shirt: "#4bb8ff", speed: -30, offset: 600 },
    { shirt: "#9b59f0", speed: 24, offset: 900 },
  ];

  town.draw = function (now) {
    if (!town.open) return;
    const ctx = town.ctx;
    const t = now / 1000;
    ctx.setTransform(town.scale, 0, 0, town.scale, 0, 0);

    const night = FP.lightAt(now).dark / 0.42;
    const sky = ctx.createLinearGradient(0, 0, 0, STREET);
    sky.addColorStop(0, night > 0.5 ? "#1a2350" : "#8fd0ff");
    sky.addColorStop(1, night > 0.5 ? "#3a3f78" : "#d8f1ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, STREET);

    // Rolling hills in the back
    ctx.fillStyle = "#86c45a";
    ctx.beginPath();
    ctx.moveTo(0, STREET - 120);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, STREET - 140 + Math.sin(x / 140) * 30);
    ctx.lineTo(W, STREET);
    ctx.lineTo(0, STREET);
    ctx.fill();

    // Sidewalk and street
    ctx.fillStyle = "#c9b79a";
    ctx.fillRect(0, STREET, W, 40);
    ctx.fillStyle = "#6b6460";
    ctx.fillRect(0, STREET + 40, W, H - STREET - 40);
    ctx.fillStyle = "#f5e6b8";
    for (let x = 20; x < W; x += 120) ctx.fillRect(x, STREET + 100, 60, 8);

    for (const b of BUILDINGS) {
      if (town.hover === b) {
        const glow = ctx.createRadialGradient(b.x + b.w / 2, STREET - b.h / 2, 20, b.x + b.w / 2, STREET - b.h / 2, b.w * 0.8);
        glow.addColorStop(0, "rgba(255,240,170,0.45)");
        glow.addColorStop(1, "rgba(255,240,170,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(b.x - b.w * 0.3, STREET - b.h - 80, b.w * 1.6, b.h + 80);
      }
      if (b.id === "casino") drawCasino(ctx, b, t);
      else if (b.id === "weather") drawStation(ctx, b, t);
      else drawSoon(ctx, b);
      if (town.hover === b) {
        ctx.font = "700 20px " + FP.displayFont();
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#3a2717";
        ctx.strokeText(b.name, b.x + b.w / 2, STREET + 30);
        ctx.fillStyle = "#fff4d6";
        ctx.fillText(b.name, b.x + b.w / 2, STREET + 30);
      }
    }

    // Townsfolk strolling along the sidewalk
    folks.forEach(f => {
      const span = W + 200;
      const x = (((t * f.speed + f.offset) % span) + span) % span - 100;
      FP.drawPerson(ctx, x, STREET + 34, 30, f.shirt, t, true);
    });

    if (night > 0.01) {
      ctx.fillStyle = `rgba(16,24,70,${0.3 * night})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

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
    if (m.id === "casino") {
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
    town.modalEl.innerHTML = `<div class="modal-box ${m.id}">
        <div class="modal-head"><h2>${m.id === "casino" ? "Casino" : "Weather Station"}</h2><button class="modal-close" data-close>Close</button></div>
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
    ? `<span class="card back"></span>`
    : `<span class="card ${c.s === "♥" || c.s === "♦" ? "red" : ""}">${c.r}<i>${c.s}</i></span>`;

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
