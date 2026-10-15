// A short first time tutorial. Each step waits for the player to do one thing.
(function (FP) {
  // advance is the game event that finishes the step. ripe is checked every frame instead.
  const STEPS = [
    { text: "Click an empty plot to plant your first carrot.", advance: "plant" },
    { text: "Plants grow on their own. Point at your carrot to see when it will be ready.", advance: "ripe" },
    { text: "Your carrot is ripe. Click it to harvest it.", advance: "harvest" },
    { text: "Harvested crops go in your basket. Open the Sell tab and sell them.", advance: "sell" },
    { text: "Spend your coins on more seeds in the shop. Seeds that regrow keep giving you crops.", advance: "buySeed" },
    { text: "Keep an eye on the weather at the top. It can change your plants and make them worth more, and the Guide tab explains how.", advance: "dismiss" },
  ];

  const tut = FP.tutorial = { el: null };

  tut.init = function (game) {
    tut.game = game;
    tut.el = document.getElementById("tip");
    tut.el.addEventListener("click", e => {
      const b = e.target.closest("[data-tip]");
      if (!b) return;
      if (b.dataset.tip === "skip") tut.finish();
      else tut.on("dismiss");
    });
    tut.render();
  };

  tut.active = () => tut.game.state.tutorial >= 0 && tut.game.state.tutorial < STEPS.length;

  tut.render = function () {
    if (!tut.active()) {
      tut.el.hidden = true;
      return;
    }
    const i = tut.game.state.tutorial;
    const step = STEPS[i];
    tut.el.innerHTML = `<span class="tip-step">${i + 1} of ${STEPS.length}</span>
      <span class="tip-text">${step.text}</span>
      ${step.advance === "dismiss"
        ? `<button class="btn" data-tip="next">Got it</button>`
        : `<button class="tip-skip" data-tip="skip">Skip tutorial</button>`}`;
    tut.el.hidden = false;
  };

  // Called by the game when something happens. Moves on if it's what the current step wants.
  tut.on = function (event) {
    if (!tut.active()) return;
    const state = tut.game.state;
    if (STEPS[state.tutorial].advance !== event) return;
    state.tutorial++;
    if (state.tutorial >= STEPS.length) state.tutorial = -1;
    FP.sfx("click");
    tut.render();
  };

  tut.tick = function (now) {
    if (tut.active() && STEPS[tut.game.state.tutorial].advance === "ripe" && FP.ripeCells(tut.game.state, now).length) tut.on("ripe");
  };

  tut.finish = function () {
    tut.game.state.tutorial = -1;
    tut.render();
  };

  tut.restart = function () {
    tut.game.state.tutorial = 0;
    tut.render();
  };
})(window.FP);
