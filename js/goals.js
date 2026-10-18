// Goals give the player something to work toward. Each one tracks a number from the save
// and pays out a reward when the player claims it.
(function (FP) {
  const st = s => s.stats;
  const expansions = s => (s.cols - FP.START.cols) + (s.rows - FP.START.rows);
  const fusionsFound = s => FP.FUSIONS.filter(f => s.discovered[f[2]]).length;

  // reward is { coins }, { seeds: { id: count } }, or { tools: { id: uses } }
  FP.GOALS = [
    { id: "plant10",    text: "Plant 10 seeds",                           target: 10,      value: s => st(s).planted,       reward: { coins: 50 } },
    { id: "harvest25",  text: "Harvest 25 crops",                         target: 25,      value: s => st(s).harvested,     reward: { seeds: { lettuce: 3 } } },
    { id: "earn1k",     text: "Earn 1,000 coins from selling",            target: 1000,    value: s => st(s).earned,        reward: { tools: { can: 10 } } },
    { id: "expand",     text: "Expand your farm",                         target: 1,       value: expansions,               reward: { coins: 400 } },
    { id: "rare",       text: "Harvest a Rare crop",                      target: 1,       value: s => st(s).byRarity[1],   reward: { coins: 300 } },
    { id: "weather",    text: "Have the weather change one of your plants", target: 1,     value: s => st(s).modsGained,    reward: { coins: 500 } },
    { id: "earn10k",    text: "Earn 10,000 coins from selling",           target: 10000,   value: s => st(s).earned,        reward: { tools: { fertilizer: 3 } } },
    { id: "fusion",     text: "Make your first fusion",                   target: 1,       value: fusionsFound,             reward: { tools: { jar: 1 } } },
    { id: "hire",       text: "Buy your first building",                   target: 1,       value: s => st(s).hired,         reward: { coins: 3000 } },
    { id: "epic",       text: "Harvest an Epic crop",                     target: 1,       value: s => st(s).byRarity[2],   reward: { coins: 2500 } },
    { id: "harvest500", text: "Harvest 500 crops",                        target: 500,     value: s => st(s).harvested,     reward: { coins: 8000 } },
    { id: "earn100k",   text: "Earn 100,000 coins from selling",          target: 100000,  value: s => st(s).earned,        reward: { tools: { spray: 1 } } },
    { id: "legendary",  text: "Harvest a Legendary crop",                 target: 1,       value: s => st(s).byRarity[3],   reward: { coins: 15000 } },
    { id: "bigfarm",    text: "Grow your farm to 8 by 6",                 target: 4,       value: expansions,               reward: { coins: 25000 } },
    { id: "fusions4",   text: "Find 4 different fusions",                 target: 4,       value: fusionsFound,             reward: { coins: 40000 } },
    { id: "hire3",      text: "Buy 3 buildings",                           target: 3,       value: s => st(s).hired,         reward: { coins: 60000 } },
    { id: "mythic",     text: "Harvest a Mythic crop",                    target: 1,       value: s => st(s).byRarity[4],   reward: { coins: 100000 } },
    { id: "bigsale",    text: "Sell one crop for 100,000 coins or more",  target: 100000,  value: s => st(s).best,          reward: { tools: { spray: 2 } } },
    { id: "earn1m",     text: "Earn 1,000,000 coins from selling",        target: 1000000, value: s => st(s).earned,        reward: { coins: 250000 } },
    { id: "allfusions", text: "Find every fusion",                        target: FP.FUSIONS.length, value: fusionsFound,   reward: { coins: 1000000 } },
  ];
  FP.GOAL_BY_ID = {};
  FP.GOALS.forEach(g => { FP.GOAL_BY_ID[g.id] = g; });

  FP.goalProgress = (state, g) => Math.min(g.target, g.value(state));
  FP.goalDone = (state, g) => g.value(state) >= g.target;
  FP.goalClaimable = (state, g) => !state.goalsClaimed[g.id] && FP.goalDone(state, g);
  FP.claimableGoals = state => FP.GOALS.filter(g => FP.goalClaimable(state, g));

  FP.rewardText = function (reward) {
    if (reward.coins) return FP.formatCoins(reward.coins) + " coins";
    const [kind, map] = reward.seeds ? ["seeds", reward.seeds] : ["tools", reward.tools];
    const [id, n] = Object.entries(map)[0];
    if (kind === "seeds") return n + " " + (n === 1 ? FP.SEED_BY_ID[id].name : FP.SEED_BY_ID[id].plural) + " seeds";
    const tool = FP.TOOL_BY_ID[id];
    return tool.uses === 1 ? (n === 1 ? FP.withArticle(tool.name) : n + " " + tool.name + "s") : tool.name + " with " + n + " uses";
  };

  FP.claimGoal = function (state, id) {
    const g = FP.GOAL_BY_ID[id];
    if (!g || state.goalsClaimed[id]) return "That goal was already claimed.";
    if (!FP.goalDone(state, g)) return "That goal isn't finished yet.";
    const r = g.reward;
    if (r.coins) state.coins += r.coins;
    for (const sid in r.seeds || {}) state.seeds[sid] = (state.seeds[sid] || 0) + r.seeds[sid];
    for (const tid in r.tools || {}) state.tools[tid] = (state.tools[tid] || 0) + r.tools[tid];
    state.goalsClaimed[id] = true;
    return null;
  };
})(window.FP);
