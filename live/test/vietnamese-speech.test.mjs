import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSpeech, synthesizeGoogleVietnamese, synthesizeVietnameseSpeech } from '../vietnamese-speech.mjs';
const job = { text: 'Mình cảm ơn bạn Bách đã follow kênh của mình nhé.', voice: 'vi-VN-HoaiMyNeural', rate: 13, pitch: -10 };
// Header fixture for transport validation only; real MP3 decoding is checked in Chrome.
const mp3Header = Buffer.alloc(144); mp3Header[0] = 0xff; mp3Header[1] = 0xf3;
const response = () => new Response(mp3Header, { headers: { 'content-type': 'audio/mpeg' } });
const edgeDown = async () => { throw new Error('Edge closed before turn.end'); };

test('healthy Edge retains the selected voice and never calls the backup', async () => {
  let fetched = false;
  const result = await synthesizeVietnameseSpeech(job, { edge: async input => { assert.equal(input.voice, job.voice); return mp3Header; }, fetch: () => { fetched = true; } });
  assert.equal(result.source, 'edge'); assert.equal(result.playbackRate, 1); assert.equal(fetched, false);
});
test('an Edge failure produces Vietnamese MP3 via the backup with honest source and playback speed', async () => {
  let transitions = 0;
  const result = await synthesizeVietnameseSpeech(job, { edge: edgeDown, onFallback: () => transitions++, fetch: async input => {
    const url = new URL(input); assert.equal(url.hostname, 'translate.google.com'); assert.equal(url.searchParams.get('tl'), 'vi'); assert.equal(url.searchParams.get('q'), job.text); return response();
  } });
  assert.equal(result.source, 'google'); assert.equal(result.playbackRate, 1.13); assert.deepEqual(result.audio, mp3Header); assert.equal(transitions, 1);
});
test('long Vietnamese text is split safely and every segment is fetched once in order', async () => {
  const text = ('Chúc mọi người một buổi tối bình an. ☕ ' + 'a'.repeat(195)).repeat(2), chunks = splitSpeech(text), fetched = [];
  assert.ok(chunks.length > 2); assert.ok(chunks.every(chunk => [...chunk].length <= 180 && !/^[\udc00-\udfff]|[\ud800-\udbff]$/.test(chunk)));
  assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
  const audio = await synthesizeGoogleVietnamese(text, { fetch: async url => { fetched.push(new URL(url).searchParams.get('q')); return response(); } });
  assert.deepEqual(fetched, chunks); assert.equal(audio.length, chunks.length * mp3Header.length);
});
test('non-audio pages and empty/corrupt audio are rejected, not cached as speech', async () => {
  for (const make of [() => new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } }), () => new Response('', { headers: { 'content-type': 'audio/mpeg' } }), () => new Response('x'.repeat(100), { headers: { 'content-type': 'audio/mpeg' } })]) {
    let count = 0; await assert.rejects(synthesizeGoogleVietnamese(job.text, { fetch: async () => { count++; return make(); } })); assert.equal(count, 2);
  }
});
test('a transient backup error retries once, then the next independent read remains usable', async () => {
  let count = 0;
  const audio = await synthesizeGoogleVietnamese(job.text, { fetch: async () => { if (++count === 1) throw new Error('temporary disconnect'); return response(); } });
  assert.equal(count, 2); assert.deepEqual(audio, mp3Header);
  assert.equal((await synthesizeVietnameseSpeech(job, { edge: edgeDown, fetch: async () => response() })).source, 'google');
});
test('stop during Edge never starts the backup', async () => {
  const controller = new AbortController(); let fetched = false;
  const pending = synthesizeVietnameseSpeech(job, { signal: controller.signal, edge: async () => { controller.abort(); throw new Error('cancelled'); }, fetch: async () => { fetched = true; return response(); } });
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(fetched, false);
});
test('stop aborts an in-flight backup request and prevents another segment or retry', async () => {
  const controller = new AbortController(); let count = 0;
  const pending = synthesizeVietnameseSpeech(job, { edge: edgeDown, signal: controller.signal, fetch: async (_, options) => { count++; controller.abort(); assert.equal(options.signal.aborted, true); throw new Error('cancelled'); } });
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(count, 1);
});
