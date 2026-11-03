// The dashboard may rest while hidden; a capture source must keep producing frames.
export function startRenderLoop(draw, { preview = false, environment = globalThis } = {}) {
  const env = environment, doc = env.document;
  let stopped = false, worker = null, timer = null, raf;
  const backgroundTick = () => { if (!stopped && !preview && doc.hidden) draw(env.performance.now()); };
  const fallback = () => { if (!stopped && !timer) timer = env.setInterval(backgroundTick, 1000 / 30); };
  const visibility = () => {
    if (stopped) return;
    if (!preview && doc.hidden) {
      if (!worker) {
        try { worker = new env.Worker(new URL('./render-clock.js', import.meta.url)); worker.onmessage = backgroundTick; worker.onerror = event => { event.preventDefault?.(); worker.terminate(); worker = null; fallback(); }; }
        catch { fallback(); }
      }
      worker?.postMessage({ running: true, fps: 30 }); backgroundTick();
    } else { worker?.postMessage({ running: false }); if (timer) { env.clearInterval(timer); timer = null; } }
  };
  const foreground = time => {
    if (stopped) return;
    if (!doc.hidden) draw(time);
    raf = env.requestAnimationFrame(foreground);
  };
  doc.addEventListener('visibilitychange', visibility); visibility(); raf = env.requestAnimationFrame(foreground);
  return () => { stopped = true; env.cancelAnimationFrame(raf); worker?.terminate(); if (timer) env.clearInterval(timer); doc.removeEventListener('visibilitychange', visibility); };
}
