// Shared helpers. Every script hangs its pieces off the FP object.
window.FP = window.FP || {};

(function (FP) {
  FP.TAU = Math.PI * 2;

  FP.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  FP.randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  // Seeded random so decorations like grass tufts land in the same spots every time.
  FP.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Positive amt lightens toward white, negative darkens toward black.
  FP.shade = function (hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) {
      r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
    } else {
      r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
    }
    return "#" + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, "0")).join("");
  };

  FP.rgba = function (hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  };

  // Numbers under a million show in full. Bigger ones follow the notation picked in Settings:
  // standard (1.23M), scientific (1.23e6), or exponential (1.23×10⁶).
  const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const twoPlaces = x => (Math.floor(x * 100 + 1e-9) / 100).toFixed(2);
  FP.formatCoins = function (n) {
    n = Math.floor(n);
    if (!Number.isFinite(n)) return String(n);
    if (Math.abs(n) < 1e6) return n.toLocaleString("en-US");
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    const style = (FP.settings && FP.settings.notation) || "standard";
    const exp = Math.floor(Math.log10(n));
    const group = Math.floor(exp / 3);
    if (style === "standard" && group < SUFFIXES.length) return sign + twoPlaces(n / Math.pow(10, group * 3)) + SUFFIXES[group];
    const mantissa = twoPlaces(n / Math.pow(10, exp));
    if (style === "exponential") return sign + mantissa + "×10" + String(exp).split("").map(d => SUPERSCRIPT[d]).join("");
    return sign + mantissa + "e" + exp;
  };

  FP.formatTime = function (ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60), s = total % 60;
    if (m >= 60) return Math.floor(m / 60) + "h " + (m % 60) + "m";
    if (m > 0) return m + "m " + String(s).padStart(2, "0") + "s";
    return s + "s";
  };

  FP.formatClock = function (ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  };

  // Canvas text uses the same font as the menus. The family comes from the --font
  // variable in style.css, so changing the font there changes it everywhere.
  let fontFamily = null;
  FP.font = function (weight, size) {
    if (!fontFamily) fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "sans-serif";
    return weight + " " + size + "px " + fontFamily;
  };
  FP.refreshFont = () => { fontFamily = null; };

  // True while a mouse button or finger is pressed. Menus that redraw on a timer wait for it,
  // because redrawing in the middle of a click would swallow the click.
  FP.pointerDown = false;
  window.addEventListener("pointerdown", () => { FP.pointerDown = true; }, true);
  window.addEventListener("pointerup", () => { FP.pointerDown = false; }, true);
  window.addEventListener("pointercancel", () => { FP.pointerDown = false; }, true);

  FP.withArticle = name => (/^[aeiou]/i.test(name) ? "an " : "a ") + name;

  FP.countOf = (seed, n) => n === 1 ? "1 " + seed.name : n + " " + seed.plural;

  FP.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  FP.makeGrid = function (cols, rows, fill) {
    const grid = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) row.push(fill ? fill(x, y) : null);
      grid.push(row);
    }
    return grid;
  };
})(window.FP);
