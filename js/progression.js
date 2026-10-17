// Farm levels, rebirth, and the GMO Point skill tree.
(function (FP) {
  // ---------- Levels ----------

  FP.MAX_LEVEL = 20;
  FP.HARVEST_XP = [1, 3, 8, 20, 50]; // XP per crop, by rarity

  // XP needed to go from this level to the next. Each level takes a bit longer than the last.
  FP.xpToNext = level => Math.round(30 * Math.pow(1.45, level - 1));

  // The level a total amount of XP reaches, plus how far into the next level it is.
  FP.levelFromXp = function (xp) {
    let level = 1, left = xp;
    while (level < FP.MAX_LEVEL && left >= FP.xpToNext(level)) {
      left -= FP.xpToNext(level);
      level++;
    }
    return { level, into: left, need: level < FP.MAX_LEVEL ? FP.xpToNext(level) : 0 };
  };

  FP.level = state => FP.levelFromXp(state.xp).level;

  FP.addXp = function (state, amount) {
    state.xp += amount * (1 + 0.25 * FP.skillLevel(state, "learner"));
  };

  // What each level unlocks. The game checks these numbers; the text is for the menus.
  FP.RARITY_LEVEL = [1, 3, 7, 12, 16];
  FP.TOOL_LEVEL = { can: 2, fertilizer: 5, trowel: 5, jar: 10, spray: 14 };
  FP.WORKER_LEVEL = { waterer: 5, picker: 7, cultivator: 10, beekeeper: 14, shadow: 18 };
  FP.EXPAND_LEVEL = [2, 6, 11, 15];   // level needed for the 1st, 2nd, 3rd, and 4th expansion
  FP.WEATHER_LEVEL = 3;
  FP.RARE_WEATHER_LEVEL = 9;
  FP.RARE_WEATHERS = ["rainbow", "bloodmoon", "meteors"];
  FP.REBIRTH_LEVEL = 12;

  FP.UNLOCKS = [
    { level: 2,  text: "the Watering Can and your first farm expansion" },
    { level: 3,  text: "Rare seeds and the weather" },
    { level: 5,  text: "Fertilizer, the Trowel, and the Waterer" },
    { level: 6,  text: "a second farm expansion" },
    { level: 7,  text: "Epic seeds and the Picker" },
    { level: 9,  text: "rainbows, blood moons, and meteor showers" },
    { level: 10, text: "Storm in a Jar and the Aura Cultivator" },
    { level: 11, text: "a third farm expansion" },
    { level: 12, text: "Legendary seeds and Rebirth" },
    { level: 14, text: "Golden Spray and the Beekeeper" },
    { level: 15, text: "the last farm expansion" },
    { level: 16, text: "Mythic seeds" },
    { level: 18, text: "the Shadow Gardener" },
    { level: 20, text: "a golden frame for your farm" },
  ];

  FP.seedUnlocked = (state, seed) => FP.level(state) >= FP.RARITY_LEVEL[seed.rarity];
  FP.toolUnlocked = (state, id) => FP.level(state) >= FP.TOOL_LEVEL[id];
  FP.workerUnlocked = (state, id) => FP.level(state) >= FP.WORKER_LEVEL[id];

  FP.weatherUnlocked = function (state, id) {
    const level = FP.level(state);
    if (level < FP.WEATHER_LEVEL) return false;
    return !FP.RARE_WEATHERS.includes(id) || level >= FP.RARE_WEATHER_LEVEL;
  };

  // ---------- Skill tree ----------

  FP.BRANCHES = [
    { name: "Growth",  color: "#6ee36e" },
    { name: "Market",  color: "#ffd23f" },
    { name: "Luck",    color: "#ff7ad9" },
    { name: "Workers", color: "#5ec8ff" },
  ];

  // tier 1 skills sit next to the black hole. tier 2 skills need their branch's tier 1 skill first.
  // cost is GMO Points for the first level; each level after costs that much more again.
  FP.SKILLS = [
    { id: "thumb",     branch: 0, tier: 1, name: "Green Thumb",   max: 5, cost: 1, desc: "Plants grow 5% faster for each level." },
    { id: "roots",     branch: 0, tier: 2, name: "Deep Roots",    max: 2, cost: 3, desc: "Every new run starts with the farm expanded once for each level." },
    { id: "learner",   branch: 0, tier: 2, name: "Quick Learner", max: 4, cost: 1, desc: "You earn 25% more XP for each level." },
    { id: "haggler",   branch: 1, tier: 1, name: "Haggler",       max: 5, cost: 1, desc: "Crops sell for 10% more for each level." },
    { id: "nestegg",   branch: 1, tier: 2, name: "Nest Egg",      max: 3, cost: 2, desc: "Every new run starts with extra coins: 2,000 at level 1, 10,000 at level 2, and 50,000 at level 3." },
    { id: "bulk",      branch: 1, tier: 2, name: "Bulk Buyer",    max: 3, cost: 2, desc: "Every shop stocks one more of each item for each level." },
    { id: "lucky",     branch: 2, tier: 1, name: "Lucky Soil",    max: 4, cost: 2, desc: "Golden and Prismatic plants are 50% more likely for each level." },
    { id: "storm",     branch: 2, tier: 2, name: "Storm Chaser",  max: 4, cost: 1, desc: "Weather changes plants 20% more often for each level." },
    { id: "owl",       branch: 2, tier: 2, name: "Night Owl",     max: 2, cost: 2, desc: "Plants become Moonlit at night twice as often for each level." },
    { id: "hustle",    branch: 3, tier: 1, name: "Hard Workers",  max: 4, cost: 2, desc: "Workers do their jobs 10% faster for each level." },
    { id: "headstart", branch: 3, tier: 2, name: "Head Start",    max: 2, cost: 3, desc: "Every new run starts with a Waterer, and at level 2 a Picker too." },
    { id: "jobboard",  branch: 3, tier: 2, name: "Job Board",     max: 3, cost: 2, desc: "Rare workers look for work 30% more often for each level." },
  ];
  FP.SKILL_BY_ID = {};
  FP.SKILLS.forEach(s => { FP.SKILL_BY_ID[s.id] = s; });

  FP.skillLevel = (state, id) => state.rebirth.skills[id] || 0;
  FP.skillCost = (state, id) => FP.SKILL_BY_ID[id].cost * (FP.skillLevel(state, id) + 1);

  // Returns why a skill can't be bought, or null.
  FP.skillBlocked = function (state, id) {
    const skill = FP.SKILL_BY_ID[id];
    if (FP.skillLevel(state, id) >= skill.max) return "This skill is fully upgraded.";
    if (skill.tier === 2) {
      const root = FP.SKILLS.find(s => s.branch === skill.branch && s.tier === 1);
      if (!FP.skillLevel(state, root.id)) return "Needs " + root.name + " first.";
    }
    const cost = FP.skillCost(state, id);
    if (state.rebirth.gmo < cost) return "You need " + (cost - state.rebirth.gmo) + " more GMO " + (cost - state.rebirth.gmo === 1 ? "Point." : "Points.");
    return null;
  };

  FP.buySkill = function (state, id) {
    const err = FP.skillBlocked(state, id);
    if (err) return err;
    state.rebirth.gmo -= FP.skillCost(state, id);
    state.rebirth.skills[id] = FP.skillLevel(state, id) + 1;
    return null;
  };

  // ---------- Rebirth ----------

  FP.canRebirth = state => FP.level(state) >= FP.REBIRTH_LEVEL;

  // GMO Points grow with how much the farm earned this run, slower and slower the more it earned.
  FP.gmoForRebirth = state => Math.max(1, Math.floor(Math.sqrt(state.stats.runEarned / 50000)));

  const NEST_EGG = [0, 2000, 10000, 50000];

  // Builds the state for a new run. The guide, goals, lifetime stats, and the skill tree carry over.
  FP.rebirth = function (state, now) {
    const gmo = FP.gmoForRebirth(state);
    const next = FP.newState();
    next.discovered = state.discovered;
    next.goalsClaimed = state.goalsClaimed;
    next.stats = Object.assign({}, state.stats, { runEarned: 0 });
    next.tutorial = -1;
    next.rebirth = {
      count: state.rebirth.count + 1,
      gmo: state.rebirth.gmo + gmo,
      earnedGmo: state.rebirth.earnedGmo + gmo,
      skills: state.rebirth.skills,
      townSeen: state.rebirth.townSeen,
      townVisited: state.rebirth.townVisited,
    };
    applyRunBonuses(next, now);
    return { state: next, gmo };
  };

  // Skills that change how a run starts.
  function applyRunBonuses(state, now) {
    state.coins += NEST_EGG[FP.skillLevel(state, "nestegg")];
    for (let i = 0; i < FP.skillLevel(state, "roots"); i++) {
      const size = FP.nextFarmSize(state);
      if (!size) break;
      while (state.cols < size.cols) { state.plots.forEach(row => row.push(null)); state.cols++; }
      while (state.rows < size.rows) { state.plots.push(new Array(state.cols).fill(null)); state.rows++; }
    }
    const head = FP.skillLevel(state, "headstart");
    if (head >= 1) state.workerBag.push({ workerId: "waterer", level: 1 });
    if (head >= 2) state.workerBag.push({ workerId: "picker", level: 1 });
    state.weather = { id: "clear", endsAt: now + FP.WEATHER_TIMES.firstClear * 1000 };
  }
  FP.applyRunBonuses = applyRunBonuses;
})(window.FP);
