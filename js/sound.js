// Sound effects made on the fly with the Web Audio API, plus the player's settings.
// Settings live apart from the farm save, so resetting the farm keeps them.
(function (FP) {
  const SETTINGS_KEY = "fancyPlants.settings";

  FP.settings = { volume: 0.6, calm: false };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (Number.isFinite(saved.volume)) FP.settings.volume = FP.clamp(saved.volume, 0, 1);
    if (typeof saved.calm === "boolean") FP.settings.calm = saved.calm;
  } catch (err) { /* keep the defaults */ }

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
