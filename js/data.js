// Game data. Balance numbers live here so they can be tuned without touching logic.
(function (FP) {
  // stockChance is how likely a seed of this rarity shows up when the shop restocks.
  FP.RARITIES = [
    { name: "Common",    color: "#8a96a3", stockChance: 1.0,  stock: [3, 7] },
    { name: "Rare",      color: "#3d8bfd", stockChance: 0.6,  stock: [2, 5] },
    { name: "Epic",      color: "#9b59f0", stockChance: 0.35, stock: [1, 3] },
    { name: "Legendary", color: "#f0a91a", stockChance: 0.15, stock: [1, 2] },
    { name: "Mythic",    color: "#ef4b4b", stockChance: 0.06, stock: [1, 1] },
  ];

  // grow and regrow are in seconds. regrow 0 means the plant is gone after one harvest.
  // shape picks the drawing in plants.js, and fruit picks the variation inside it.
  FP.SEEDS = [
    { id: "carrot",       name: "Carrot",       plural: "Carrots",       rarity: 0, price: 10,    value: 18,    grow: 20,  regrow: 0,   shape: "root",    color: "#f28c28" },
    { id: "radish",       name: "Radish",       plural: "Radishes",      rarity: 0, price: 18,    value: 32,    grow: 30,  regrow: 0,   shape: "root",    color: "#e0344f", round: true },
    { id: "lettuce",      name: "Lettuce",      plural: "Lettuce",       rarity: 0, price: 45,    value: 12,    grow: 25,  regrow: 20,  shape: "leafy",   color: "#86cf55" },
    { id: "potato",       name: "Potato",       plural: "Potatoes",      rarity: 0, price: 60,    value: 15,    grow: 35,  regrow: 25,  shape: "bush",    color: "#c99a5b", fruit: "tuber" },
    { id: "tomato",       name: "Tomato",       plural: "Tomatoes",      rarity: 1, price: 150,   value: 40,    grow: 45,  regrow: 35,  shape: "bush",    color: "#e8412c", fruit: "round" },
    { id: "strawberry",   name: "Strawberry",   plural: "Strawberries",  rarity: 1, price: 220,   value: 55,    grow: 50,  regrow: 40,  shape: "bush",    color: "#e63950", fruit: "strawberry" },
    { id: "blueberry",    name: "Blueberry",    plural: "Blueberries",   rarity: 1, price: 260,   value: 32,    grow: 35,  regrow: 25,  shape: "bush",    color: "#4a5bd4", fruit: "berry" },
    { id: "pumpkin",      name: "Pumpkin",      plural: "Pumpkins",      rarity: 2, price: 900,   value: 1300,  grow: 120, regrow: 0,   shape: "pumpkin", color: "#f07f1a" },
    { id: "corn",         name: "Corn",         plural: "Corn",          rarity: 2, price: 1200,  value: 230,   grow: 90,  regrow: 60,  shape: "stalk",   color: "#f5d33b" },
    { id: "starfruit",    name: "Starfruit",    plural: "Starfruit",     rarity: 3, price: 4500,  value: 850,   grow: 150, regrow: 100, shape: "tree",    color: "#f9d923", fruit: "star" },
    { id: "golden_apple", name: "Golden Apple", plural: "Golden Apples", rarity: 3, price: 7000,  value: 10500, grow: 240, regrow: 0,   shape: "tree",    color: "#f2c230", fruit: "apple" },
    { id: "moonflower",   name: "Moonflower",   plural: "Moonflowers",   rarity: 4, price: 22000, value: 3800,  grow: 240, regrow: 150, shape: "flower",  color: "#b9b3f0" },
  ];

  FP.SEED_BY_ID = {};
  FP.SEEDS.forEach(seed => { FP.SEED_BY_ID[seed.id] = seed; });

  FP.START = { coins: 100, cols: 6, rows: 4, seeds: { carrot: 3 } };
  FP.MAX_COLS = 8;
  FP.MAX_ROWS = 6;
  FP.SHOP_REFRESH_MS = 3 * 60 * 1000;

  // ---------- Modifiers ----------
  // mult is how much a harvest is worth with this modifier. Modifiers multiply together.
  // kind is "weather" (from weather), "lucky" (random), or "fusion" (two modifiers combined).
  FP.MODS = {
    wet:        { name: "Wet",            color: "#4b8bff", mult: 2,      kind: "weather" },
    heated:     { name: "Heated",         color: "#ff7a2f", mult: 2,      kind: "weather" },
    chilled:    { name: "Chilled",        color: "#9fd8f0", mult: 2,      kind: "weather" },
    moonlit:    { name: "Moonlit",        color: "#b0a3e6", mult: 2,      kind: "weather" },
    icy:        { name: "Icy",            color: "#7fe3ff", mult: 3,      kind: "weather" },
    blood:      { name: "Blood Stricken", color: "#d7263d", mult: 6,      kind: "weather" },
    lucky:      { name: "Lucky",          color: "#ff9ecf", mult: 8,      kind: "weather" },
    shocked:    { name: "Shocked",        color: "#ffe14d", mult: 10,     kind: "weather" },
    celestial:  { name: "Celestial",      color: "#c9a2ff", mult: 12,     kind: "weather" },
    golden:     { name: "Golden",         color: "#ffd23f", mult: 10,     kind: "lucky", chance: 0.02 },
    prismatic:  { name: "Prismatic",      color: "rainbow", mult: 40,     kind: "lucky", chance: 0.002 },
    frozen:     { name: "Frozen",         color: "#5aa9ff", mult: 8,      kind: "fusion" },
    planetary:  { name: "Planetary",      color: "#8a6cff", mult: 10,     kind: "fusion" },
    gaseous:    { name: "Gaseous",        color: "#9be7a0", mult: 12,     kind: "fusion" },
    paradox:    { name: "Paradox",        color: "#ff4fa3", mult: 100,    kind: "fusion" },
    solar:      { name: "Solar",          color: "#ffb000", mult: 250,    kind: "fusion" },
    supernova:  { name: "Supernova",      color: "#ff5ec4", mult: 5000,   kind: "fusion" },
    universal:  { name: "Universal",      color: "#e08cff", mult: 150000, kind: "fusion" },
    aura:       { name: "Aura",           color: "#9370db", mult: 1.5,    kind: "worker" },
    pollinated: { name: "Pollinated",     color: "#ffc23a", mult: 2,      kind: "worker" },
    risen:      { name: "Risen",          color: "#5b3fa0", mult: 4,      kind: "worker" },
    monarch:    { name: "Monarch",        color: "#3d1f7a", mult: 60,     kind: "fusion" },
  };

  // When a plant has both of the first two, they turn into the third.
  // Each result is always worth more than the two modifiers it replaces.
  FP.FUSIONS = [
    ["wet", "chilled", "frozen"],
    ["heated", "moonlit", "planetary"],
    ["heated", "icy", "gaseous"],
    ["lucky", "blood", "paradox"],
    ["gaseous", "planetary", "solar"],
    ["solar", "frozen", "supernova"],
    ["celestial", "supernova", "universal"],
    ["aura", "risen", "monarch"],
  ];

  FP.RAINBOW = ["#ff5a5a", "#ffa53a", "#ffe14d", "#6ee36e", "#4bb8ff", "#8a6cff", "#e07cff"];

  // ---------- Weather ----------
  // weight decides how often each weather is picked. Clear weather comes between every other kind.
  FP.WEATHER = [
    { id: "clear",     name: "Clear Skies",   mod: null,        weight: 0,  start: "The weather cleared up." },
    { id: "rain",      name: "Rain",          mod: "wet",       weight: 30, start: "It started to rain." },
    { id: "sunny",     name: "Sunny",         mod: "heated",    weight: 25, start: "The sun is beating down on the farm." },
    { id: "snow",      name: "Snow",          mod: "chilled",   weight: 15, start: "Snow is falling." },
    { id: "moonlight", name: "Moonlight",     mod: "moonlit",   weight: 14, start: "The moon came out." },
    { id: "hail",      name: "Hail",          mod: "icy",       weight: 10, start: "Hail is coming down." },
    { id: "thunder",   name: "Thunderstorm",  mod: "shocked",   weight: 6,  start: "A thunderstorm rolled in." },
    { id: "rainbow",   name: "Rainbow",       mod: "lucky",     weight: 5,  start: "A rainbow appeared over the farm." },
    { id: "bloodmoon", name: "Blood Moon",    mod: "blood",     weight: 4,  start: "The moon turned red." },
    { id: "meteors",   name: "Meteor Shower", mod: "celestial", weight: 2,  start: "Meteors are streaking across the sky." },
  ];
  FP.WEATHER_BY_ID = {};
  FP.WEATHER.forEach(w => { FP.WEATHER_BY_ID[w.id] = w; });

  FP.WEATHER_TIMES = { clear: [90, 180], active: [100, 160], firstClear: 45 }; // seconds
  FP.WEATHER_TICK_MS = 5000;   // how often weather tries to change plants
  FP.WEATHER_CHANCE = 0.04;    // chance per plant per tick

  // ---------- Tools ----------
  // grow is the share of a plant's grow time that the tool skips.
  FP.TOOLS = [
    { id: "can",        name: "Watering Can",   rarity: 0, price: 150,   uses: 10, grow: 0.1,
      desc: "Waters a growing plant so it skips a tenth of its grow time." },
    { id: "fertilizer", name: "Fertilizer",     rarity: 1, price: 900,   uses: 3,  grow: 0.35,
      desc: "Feeds a growing plant so it skips about a third of its grow time." },
    { id: "trowel",     name: "Trowel",         rarity: 1, price: 1200,  uses: 5,
      desc: "Lifts a plant out gently so you can move it to another plot." },
    { id: "jar",        name: "Storm in a Jar", rarity: 2, price: 6000,  uses: 1,
      desc: "Gives a plant the current weather's modifier right away." },
    { id: "spray",      name: "Golden Spray",   rarity: 3, price: 40000, uses: 1,
      desc: "Coats a plant in gold, so its harvests are worth ten times more." },
  ];
  FP.TOOL_BY_ID = {};
  FP.TOOLS.forEach(tool => { FP.TOOL_BY_ID[tool.id] = tool; });

  // ---------- Upgrades ----------
  // Cost of the next level is base * scale ^ level.
  FP.UPGRADES = [
    { id: "soil",   name: "Rich Soil",    max: 6,  base: 1500, scale: 2.5, desc: "Plants grow 5% faster for each level." },
    { id: "vane",   name: "Weather Vane", max: 4,  base: 3000, scale: 2.6, desc: "Weather is 25% more likely to change your plants for each level." },
    { id: "stall",  name: "Market Stall", max: 10, base: 2000, scale: 2,   desc: "Crops sell for 5% more for each level." },
    { id: "shelf",  name: "Bigger Shop",  max: 3,  base: 2500, scale: 3,   desc: "The shop stocks one more of each seed per level, and rare seeds show up more often." },
  ];
  // ---------- Workers ----------
  // Each worker lives in a building that takes up one plot. Stats are listed per level (1, 2, 3).
  // every is seconds between jobs, and range is how many plots away the worker reaches.
  FP.WORKERS = [
    { id: "waterer", name: "Waterer", building: "Waterer's Shed", rarity: 0, price: 2500, roof: "#4b8bff", shirt: "#4b8bff",
      every: [12, 9, 6], range: [1, 2, 2], grow: 0.08,
      desc: "Walks over to the thirstiest plant nearby and waters it, which skips 8% of its grow time." },
    { id: "picker", name: "Picker", building: "Picker's Hut", rarity: 1, price: 8000, roof: "#e8412c", shirt: "#f28c28",
      every: [6, 4, 2.5], range: [1, 2, 3],
      desc: "Harvests one ripe plant nearby at a time and drops it in your basket." },
    { id: "cultivator", name: "Aura Cultivator", building: "Cultivation Circle", rarity: 2, price: 30000, roof: "#9b59f0",
      every: [5, 4, 3], range: [1, 1, 2], grow: 0.03, chance: [0.1, 0.15, 0.2], mod: "aura",
      desc: "Sends out a pulse that pushes every nearby plant 3% closer to ripe, and it can give them Aura." },
    { id: "beekeeper", name: "Beekeeper", building: "Bee Hive", rarity: 3, price: 120000, roof: "#f0a91a",
      every: [4, 3, 2], range: [3, 3, 3], grow: 0.04, chance: [0.08, 0.1, 0.12], mod: "pollinated", bees: [2, 3, 5],
      desc: "Keeps bees that buzz between plants. Every visit helps a plant grow, and some visits leave it Pollinated." },
    { id: "shadow", name: "Shadow Gardener", building: "Shadow Manor", rarity: 4, price: 600000, roof: "#3d1f7a",
      every: [3, 2.5, 2], range: [2, 2, 3], grow: 0.04, chance: [0.03, 0.05, 0.08], mod: "risen",
      desc: "Calls on the shadows to grow every plant nearby, and the plants it touches can rise as Risen." },
  ];
  FP.WORKER_BY_ID = {};
  FP.WORKERS.forEach(w => { FP.WORKER_BY_ID[w.id] = w; });
  FP.WORKER_MAX_LEVEL = 3;

  FP.UPGRADE_BY_ID = {};
  FP.UPGRADES.forEach(u => { FP.UPGRADE_BY_ID[u.id] = u; });
})(window.FP);
