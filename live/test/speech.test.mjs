import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { synthesizeSpeech } from '../speech-service.mjs';
const job = { text: 'Chào <Bách> & cả quán.', voice: 'vi-VN-NamMinhNeural', pitch: -10, rate: 15 };
test('Vietnamese voices use the full Edge voice name and preserve prosody/XML escaping', async () => {
  for (const [short, full] of [['vi-VN-NamMinhNeural', 'NamMinhNeural'], ['vi-VN-HoaiMyNeural', 'HoaiMyNeural']]) {
    let closed = false;
    const audio = await synthesizeSpeech({ ...job, voice: short }, { createClient: () => ({
      async setMetadata(voice) { assert.equal(voice, `Microsoft Server Speech Text to Speech Voice (vi-VN, ${full})`); },
      toStream(text, options) { assert.equal(text, 'Chào &lt;Bách&gt; &amp; cả quán.'); assert.deepEqual(options, { pitch: '-10Hz', rate: '+15%' }); return { audioStream: Readable.from([Buffer.from('test-audio')]) }; },
      close() { closed = true; },
    }) });
    assert.equal(audio.toString(), 'test-audio'); assert.equal(closed, true);
  }
});
test('an interrupted synthesis retries with a fresh connection', async () => {
  let created = 0, retried = 0, closed = 0;
  const audio = await synthesizeSpeech(job, { onRetry: () => retried++, createClient: () => {
    const index = ++created;
    return { async setMetadata() {}, toStream() { if (index === 1) return { audioStream: Readable.from((async function* () { throw new Error('connection closed'); })()) }; return { audioStream: Readable.from([Buffer.from('recovered')]) }; }, close() { closed++; } };
  } });
  assert.equal(audio.toString(), 'recovered'); assert.equal(created, 2); assert.equal(retried, 1); assert.equal(closed, 2);
});
test('failed attempts do not suppress the next independent speech request for 60 seconds', async () => {
  const make = fail => () => ({ async setMetadata() { if (fail) throw new Error('offline'); }, toStream() { return { audioStream: Readable.from([Buffer.from('next request')]) }; }, close() {} });
  await assert.rejects(synthesizeSpeech(job, { createClient: make(true) }), /offline/);
  assert.equal((await synthesizeSpeech(job, { createClient: make(false) })).toString(), 'next request');
});
test('stop aborts an in-flight request and does not retry cancelled speech', async () => {
  const controller = new AbortController(); let created = 0, closed = 0;
  const pending = synthesizeSpeech(job, { signal: controller.signal, createClient: () => { created++; return { setMetadata: () => new Promise(() => {}), close() { closed++; } }; } });
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(created, 1); assert.equal(closed, 1);
});
