// The Request Board in the Town. Townsfolk pin up requests for crops, and handing one over
// pays the crop's value times the request's multiplier. Requests for a crop with a certain
// modifier pay more.
(function (FP) {
  FP.REQUEST_SLOTS = 4;
  FP.REQUEST_LIFE_MS = 12 * 60 * 1000;   // a request comes down after this long
  FP.REQUEST_REFILL_MS = 90 * 1000;      // an empty spot gets a new request after this long

  const FOLKS = ["Mabel", "Otis", "June", "Hank", "Rosa", "Pip", "Gus", "Ivy", "Wren", "Bert", "Nell", "Arlo"];

  // Why each person wants the crop, to make the notes read like notes.
  const REASONS = [
    "for a family dinner", "for the bake sale", "to win the county fair", "for a picnic",
    "for a recipe from their grandmother", "to cheer up a friend", "for their shop window", "just because",
  ];

  const pick = list => list[Math.floor(Math.random() * list.length)];
  const roundQuarter = n => Math.round(n * 4) / 4;

  // Crops this farm can actually grow right now.
  function seedPool(state) {
    return FP.SEEDS.filter(s => FP.seedUnlocked(state, s))
      .concat(FP.SPECIAL_SEEDS.filter(s => FP.specialUnlocked(state, s.id)));
  }

  // Modifiers the weather can give at this farm level, plus Moonlit from the night.
  function modPool(state) {
    const mods = FP.weatherOptions(state).map(w => w.mod);
    return mods.length ? mods.concat("moonlit") : [];
  }

  FP.makeRequest = function (state, now) {
    const seeds = seedPool(state);
    const mods = modPool(state);
    const seed = pick(seeds);
    let mod = null, anyCrop = false;
    if (mods.length && Math.random() < 0.45) {
      mod = pick(mods);
      anyCrop = Math.random() < 0.35; // some people only care about the modifier
    }
    let mult = 1.5 + Math.random();
    if (mod) mult += 1.5 + Math.random() + FP.MODS[mod].mult * 0.05;
    if (!anyCrop) mult += 0.25 * seed.rarity + (seed.special ? 0.5 : 0);
    return {
      who: pick(FOLKS),
      why: pick(REASONS),
      seedId: anyCrop ? null : seed.id,
      mod,
      mult: roundQuarter(mult),
      expiresAt: now + FP.REQUEST_LIFE_MS,
    };
  };

  // Fills empty spots once their wait is over and takes down old requests.
  FP.updateRequests = function (state, now) {
    const board = state.requests;
    let changed = false;
    for (let i = 0; i < FP.REQUEST_SLOTS; i++) {
      const r = board[i];
      if (r && r.expiresAt && now >= r.expiresAt) {
        board[i] = { emptyUntil: now + FP.REQUEST_REFILL_MS };
        changed = true;
      } else if (!r || (r.emptyUntil && now >= r.emptyUntil)) {
        board[i] = FP.makeRequest(state, now);
        changed = true;
      }
    }
    return changed;
  };

  FP.requestMatches = (req, item) => (!req.seedId || item.seedId === req.seedId) && (!req.mod || item.mods.includes(req.mod));

  // The most valuable crop in the basket that fits a request, since the payout grows with its value.
  FP.bestForRequest = function (state, req) {
    let best = null;
    for (const item of state.harvest) {
      if (FP.requestMatches(req, item) && (!best || FP.sellPrice(state, item) > FP.sellPrice(state, best))) best = item;
    }
    return best;
  };

  FP.requestPayout = (state, req, item) => Math.round(FP.sellPrice(state, item) * req.mult);

  FP.fulfillRequest = function (state, i, now) {
    const req = state.requests[i];
    if (!req || !req.who) return { error: "That request was already taken down." };
    const item = FP.bestForRequest(state, req);
    if (!item) return { error: "You don't have a crop that fits that request." };
    const coins = FP.requestPayout(state, req, item);
    state.harvest = state.harvest.filter(other => other !== item);
    state.coins += coins;
    state.stats.earned += coins;
    state.stats.runEarned += coins;
    state.stats.best = Math.max(state.stats.best, coins);
    state.requests[i] = { emptyUntil: now + FP.REQUEST_REFILL_MS };
    return { coins, req, item };
  };

  // One sentence describing what the request wants.
  FP.requestText = function (req) {
    const what = req.seedId
      ? (req.mod ? FP.withArticle(FP.MODS[req.mod].name + " " + FP.SEED_BY_ID[req.seedId].name) : FP.withArticle(FP.SEED_BY_ID[req.seedId].name))
      : "any crop that is " + FP.MODS[req.mod].name;
    return req.who + " wants " + what + " " + req.why + ".";
  };
})(window.FP);
