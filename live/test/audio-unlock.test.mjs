import test from 'node:test';
import assert from 'node:assert/strict';
import { CafeAudio } from '../audio-engine.js';
test('enable unlocks music and voice during the click before awaiting AudioContext', async () => {
  const prior = { Audio: globalThis.Audio, AudioContext: globalThis.AudioContext, document: globalThis.document };
  const players = [], calls = []; let gesture = true;
  globalThis.Audio = class {
    constructor() { players.push(this); } pause() {} removeAttribute() {}
    play() { assert.equal(gesture, true, 'HTML audio unlock must happen synchronously in the user gesture'); calls.push(this.id); return Promise.resolve(); }
  };
  globalThis.AudioContext = class {
    currentTime = 0; destination = {};
    resume() { calls.push('context'); return Promise.resolve(); }
    createGain() { return { gain: { value: 0, setTargetAtTime() {} }, connect() {} }; }
    close() {}
  };
  globalThis.document = { body: { append() {} } };
  let audio;
  try {
    audio = new CafeAudio(m => calls.push(m.t), assert.fail);
    const pending = audio.enable(); gesture = false; await pending;
    assert.deepEqual(calls.slice(0, 3), ['trackAudio', 'voiceAudio', 'context']); assert.equal(calls.at(-1), 'audio');
    for (const player of players) assert.ok(player.src.startsWith('data:audio/wav;base64,'));
  } finally { clearInterval(audio?.timer); for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});

test('one music slider controls ordered tracks and ambient on the phone while speech is louder', async () => {
  const prior = { Audio: globalThis.Audio, AudioContext: globalThis.AudioContext, document: globalThis.document };
  const levels = [];
  globalThis.Audio = class {
    // iPhone Safari reports full element volume even when JavaScript sets a lower value.
    get volume() { return 1; } set volume(_) {}
    pause() {} removeAttribute() {} play() { return Promise.resolve(); }
  };
  globalThis.AudioContext = class {
    currentTime = 0; destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return { gain: { value: 0, setTargetAtTime(value) { levels.push(value); } }, connect() {} }; }
    createMediaElementSource() { return { connect() {} }; }
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} }; }
  };
  globalThis.document = { body: { append() {} } };
  let audio;
  try {
    audio = new CafeAudio(() => {}, assert.fail);
    await audio.enable(); audio.setOwner(true);
    audio.setSettings({ music: true, trackVolume: 20, ambientVolume: 50, voiceVolume: 100, duckVolume: 10 });
    assert.equal(audio.track.volume, 1);
    assert.ok(Math.abs(levels.at(-3) - .2) < 1e-9, 'music GainNode follows the PC slider');
    assert.ok(Math.abs(levels.at(-1) - .12 * .5 * (.2 / .6)) < 1e-9);
    audio.speaking = true; audio.sync();
    assert.ok(Math.abs(levels.at(-3) - .02) < 1e-9, 'speech ducks music through the GainNode');
    assert.ok(Math.abs(levels.at(-2) - 1.8) < 1e-9);
    assert.ok(Math.abs(levels.at(-1) - .12 * .5 * (.2 / .6) * .1) < 1e-9);
    audio.setSettings({ music: true, trackVolume: 100, ambientVolume: 100, voiceVolume: 100, duckVolume: 100 });
    assert.equal(audio.track.volume, 1);
    assert.equal(levels.at(-3), .25, 'music remains below the boosted voice while speaking');
  } finally { clearInterval(audio?.timer); for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
