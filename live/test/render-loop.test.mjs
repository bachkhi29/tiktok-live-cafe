import test from 'node:test';
import assert from 'node:assert/strict';
import { startRenderLoop } from '../render-loop.js';

function setup(workerAvailable = true) {
  const handlers = new Map(), frames = [], workers = [], timers = new Map(); let next = 0, now = 0, raf;
  const document = { hidden: false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const environment = { document, performance: { now: () => now }, requestAnimationFrame: fn => { raf = fn; return ++next; }, cancelAnimationFrame: () => { raf = null; },
    setInterval: fn => { timers.set(++next, fn); return next; }, clearInterval: id => timers.delete(id),
    Worker: class { constructor() { if (!workerAvailable) throw new Error('blocked'); workers.push(this); } postMessage(value) { this.last = value; } terminate() { this.closed = true; } } };
  return { frames, environment, workers, timers, hide: value => { document.hidden = value; handlers.get('visibilitychange')(); }, raf: () => { now += 34; raf?.(now); }, tick: () => { now += 34; workers[0]?.onmessage(); for (const fn of timers.values()) fn(); } };
}
test('main overlay keeps drawing with a worker while hidden and resumes RAF without duplicate loops', () => {
  const s = setup(), stop = startRenderLoop(time => s.frames.push(time), { environment: s.environment });
  s.raf(); assert.equal(s.frames.length, 1); s.hide(true); assert.equal(s.workers[0].last.running, true);
  const first = s.frames.length; s.raf(); assert.equal(s.frames.length, first); s.tick(); s.tick(); assert.equal(s.frames.length, first + 2);
  s.hide(false); assert.equal(s.workers[0].last.running, false); s.tick(); assert.equal(s.frames.length, first + 2); s.raf(); assert.equal(s.frames.length, first + 3);
  stop(); s.tick(); s.raf(); assert.equal(s.frames.length, first + 3); assert.equal(s.workers[0].closed, true);
});
test('hidden dashboard preview rests without starting another worker', () => {
  const s = setup(), stop = startRenderLoop(time => s.frames.push(time), { preview: true, environment: s.environment });
  s.raf(); s.hide(true); s.raf(); assert.equal(s.frames.length, 1); assert.equal(s.workers.length, 0); s.hide(false); s.raf(); assert.equal(s.frames.length, 2); stop();
});
test('a blocked worker falls back to a timer and releases it when visible or stopped', () => {
  const s = setup(false), stop = startRenderLoop(time => s.frames.push(time), { environment: s.environment });
  s.hide(true); assert.equal(s.timers.size, 1); const before = s.frames.length; s.tick(); assert.equal(s.frames.length, before + 1);
  s.hide(false); assert.equal(s.timers.size, 0); s.hide(true); assert.equal(s.timers.size, 1); stop(); assert.equal(s.timers.size, 0);
});
