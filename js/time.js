// The day and night clock. It runs alongside the weather instead of being a weather.
// The clock comes from the real time, so it keeps going while the game is closed
// and every device shows the same time of day.
(function (FP) {
  FP.GAME_HOUR_MS = 60 * 1000; // one game hour is one real minute, so a full day takes 24 minutes

  // from and to are hours on a 24 hour clock. Midnight wraps past 24.
  FP.TIMES = [
    { id: "dawn",      name: "Dawn",       from: 5,  to: 7,  night: false },
    { id: "morning",   name: "Morning",    from: 7,  to: 11, night: false },
    { id: "noon",      name: "Noon",       from: 11, to: 13, night: false },
    { id: "afternoon", name: "Afternoon",  from: 13, to: 17, night: false },
    { id: "dusk",      name: "Dusk",       from: 17, to: 19, night: false },
    { id: "evening",   name: "Evening",    from: 19, to: 22, night: true },
    { id: "midnight",  name: "Midnight",   from: 22, to: 26, night: true },
    { id: "latenight", name: "Late Night", from: 2,  to: 5,  night: true },
  ];
  FP.TIME_BY_ID = {};
  FP.TIMES.forEach(t => { FP.TIME_BY_ID[t.id] = t; });

  FP.NIGHT_CHANCE = 0.02; // chance per plant per weather tick to become Moonlit at night

  // Hour of the game day as a decimal, from 0 up to 24.
  // devHourOffset is only set by the test tools in dev.js.
  FP.gameHour = now => (now / FP.GAME_HOUR_MS + (FP.devHourOffset || 0)) % 24;

  FP.timeOfDay = function (now) {
    const h = FP.gameHour(now);
    for (const t of FP.TIMES) {
      if ((h >= t.from && h < t.to) || (t.to > 24 && h < t.to - 24)) return t;
    }
    return FP.TIME_BY_ID.morning;
  };

  FP.isNight = now => FP.timeOfDay(now).night;

  FP.clockText = function (now) {
    const h = FP.gameHour(now);
    const hour = Math.floor(h), minute = Math.floor((h - hour) * 6) * 10; // round to 10 minutes so it doesn't flicker
    const shown = hour % 12 === 0 ? 12 : hour % 12;
    return shown + ":" + String(minute).padStart(2, "0") + (hour < 12 ? " AM" : " PM");
  };

  // Real milliseconds until the current time of day ends.
  FP.timeLeftInPeriod = function (now) {
    const t = FP.timeOfDay(now);
    const h = FP.gameHour(now);
    let end = t.to % 24;
    let hours = end - h;
    if (hours <= 0) hours += 24;
    return hours * FP.GAME_HOUR_MS;
  };

  // How the farm is lit at this hour: a dark blue for night and a warm glow at dawn and dusk.
  // Values blend smoothly between hours so the light never jumps.
  const smooth = (h, a, b) => FP.clamp((h - a) / (b - a), 0, 1);
  FP.lightAt = function (now) {
    const h = FP.gameHour(now);
    // Darkness rises from 18 to 21 and falls from 4 to 7.
    const dark = h >= 12 ? smooth(h, 18, 21) : 1 - smooth(h, 4, 7);
    // Warm light peaks at 6 and 18.
    const warm = Math.max(0, 1 - Math.abs(h - 6) / 1.5) + Math.max(0, 1 - Math.abs(h - 18) / 1.5);
    return { dark: dark * 0.42, warm: Math.min(1, warm) * 0.16 };
  };
})(window.FP);
