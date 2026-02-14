export function createGameLoop({ tickMs, update, render }) {
  let running = false;
  let accumulator = 0;
  let lastTime = 0;

  function frame(now) {
    if (!running) return;

    if (lastTime === 0) {
      lastTime = now;
    }

    accumulator += now - lastTime;
    lastTime = now;

    while (accumulator >= tickMs) {
      update(tickMs);
      accumulator -= tickMs;
    }

    render();
    requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    }
  };
}
