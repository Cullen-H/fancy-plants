// Sound effects made on the fly with the Web Audio API, plus the player's settings.
// Settings live apart from the farm save, so resetting the farm keeps them.
(function (FP) {
  const SETTINGS_KEY = "fancyPlants.settings";

  // Actions that can have a key. key is the default, or null for none.
  FP.KEY_ACTIONS = [
    { id: "harvestAll", name: "Harvest all",       key: "h" },
    { id: "shovel",     name: "Pick up the shovel", key: "q" },
    { id: "sellAll",    name: "Sell everything",   key: null },
    { id: "floorUp",    name: "Go up a floor",     key: "ArrowUp" },
    { id: "floorDown",  name: "Go down a floor",   key: "ArrowDown" },
    { id: "town",       name: "Open the Town",     key: null },
    { id: "void",       name: "Open the black hole", key: null },
    { id: "settings",   name: "Open Settings",     key: "s" },
    { id: "tabShop",    name: "Open the Shop tab", key: null },
    { id: "tabSell",    name: "Open the Sell tab", key: null },
    { id: "tabUpgrades", name: "Open the Upgrades tab", key: null },
    { id: "tabGoals",   name: "Open the Goals tab", key: null },
    { id: "tabGuide",   name: "Open the Guide tab", key: null },
  ];
  FP.NOTATIONS = { standard: "Standard", scientific: "Scientific", exponential: "Exponential" };

  const defaultKeys = () => Object.fromEntries(FP.KEY_ACTIONS.map(a => [a.id, a.key]));

  FP.settings = { volume: 0.6, calm: false, notation: "standard", keys: defaultKeys() };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (Number.isFinite(saved.volume)) FP.settings.volume = FP.clamp(saved.volume, 0, 1);
    if (typeof saved.calm === "boolean") FP.settings.calm = saved.calm;
    if (FP.NOTATIONS[saved.notation]) FP.settings.notation = saved.notation;
    for (const a of FP.KEY_ACTIONS) {
      const k = saved.keys && saved.keys[a.id];
      if (k === null || typeof k === "string") FP.settings.keys[a.id] = k;
    }
  } catch (err) { /* keep the defaults */ }

  // Letters are stored lowercase so Shift and Caps Lock don't matter.
  FP.normalizeKey = key => (key.length === 1 ? key.toLowerCase() : key);

  // Keys a player can't take, because the game already uses them for something fixed.
  FP.reservedKey = key => key === "Escape" || /^[1-9]$/.test(key);

  FP.keyAction = key => FP.KEY_ACTIONS.find(a => FP.settings.keys[a.id] === key) || null;

  // Gives a key to an action and takes it away from any other action that had it.
  FP.setKey = function (id, key) {
    for (const a of FP.KEY_ACTIONS) if (FP.settings.keys[a.id] === key) FP.settings.keys[a.id] = null;
    FP.settings.keys[id] = key;
    FP.saveSettings();
  };

  FP.resetKeys = function () {
    FP.settings.keys = defaultKeys();
    FP.saveSettings();
  };

  const KEY_NAMES = { " ": "Space", ArrowUp: "Up Arrow", ArrowDown: "Down Arrow", ArrowLeft: "Left Arrow", ArrowRight: "Right Arrow" };
  FP.keyName = key => (!key ? "None" : KEY_NAMES[key] || (key.length === 1 ? key.toUpperCase() : key.replace(/([a-z])([A-Z])/g, "$1 $2")));

  FP.saveSettings = function () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(FP.settings)); } catch (err) { /* not saved */ }
  };

  let audio = null;
  let master = null;

  // Browsers only allow sound after the player has clicked or tapped something.
  function wake() {
    if (audio) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = new Ctx();
    master = audio.createGain();
    master.gain.value = FP.settings.volume * 0.5;
    master.connect(audio.destination);
  }
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);

  FP.setVolume = function (v) {
    FP.settings.volume = FP.clamp(v, 0, 1);
    if (master) master.gain.value = FP.settings.volume * 0.5;
    FP.saveSettings();
  };

  // One note. freq can slide to freqEnd over the note's length.
  function tone(freq, start, length, type = "sine", gain = 0.3, freqEnd = null) {
    const t = audio.currentTime + start;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + length);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  const SOUNDS = {
    click:   () => tone(900, 0, 0.04, "triangle", 0.12),
    plant:   () => tone(220, 0, 0.12, "sine", 0.35, 360),
    harvest: () => { tone(520, 0, 0.1, "triangle", 0.25, 700); tone(780, 0.05, 0.12, "triangle", 0.18); },
    coin:    () => { tone(1320, 0, 0.08, "square", 0.06); tone(1760, 0.06, 0.14, "square", 0.06); },
    buy:     () => tone(660, 0, 0.1, "triangle", 0.2, 880),
    error:   () => tone(180, 0, 0.16, "square", 0.08, 140),
    mod:     () => { [1200, 1500, 1800].forEach((f, i) => tone(f, i * 0.05, 0.12, "sine", 0.12)); },
    fusion:  () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.07, 0.3, "triangle", 0.18)); },
    weather: () => { tone(880, 0, 0.9, "sine", 0.12); tone(1320, 0.1, 0.9, "sine", 0.08); },
    goal:    () => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.25, "square", 0.07)); tone(1046, 0.36, 0.5, "triangle", 0.15); },
    dig:     () => tone(140, 0, 0.18, "sawtooth", 0.08, 80),
    splash:  () => { tone(1500, 0, 0.09, "sine", 0.12, 700); tone(500, 0.02, 0.18, "triangle", 0.08, 220); },
    rebirth: () => { tone(420, 0, 1.8, "sawtooth", 0.12, 30); tone(210, 0.1, 1.8, "sine", 0.3, 20); tone(840, 0.2, 1.4, "sine", 0.06, 60); },
  };

  // The same sound can't stack up faster than this, so Harvest All doesn't get loud.
  const lastPlayed = {};
  FP.sfx = function (name) {
    if (!audio || FP.settings.volume <= 0 || !SOUNDS[name]) return;
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < 60) return;
    lastPlayed[name] = now;
    if (audio.state === "suspended") audio.resume();
    SOUNDS[name]();
  };
})(window.FP);
