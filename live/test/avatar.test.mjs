import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarStore, safeAvatarUrl } from '../avatar-service.mjs';
import { CafeRoom } from '../cafe.mjs';
import { getStageTargets } from '../scene-renderer.js';

test('avatar URLs accept TikTok CDNs and reject unrelated hosts, credentials and local addresses', () => {
  assert.equal(safeAvatarUrl('https://p16-sign.tiktokcdn.com/avatar.jpeg'), 'https://p16-sign.tiktokcdn.com/avatar.jpeg');
  for (const url of ['http://p16.tiktokcdn.com/a.png', 'https://localhost/a', 'https://127.0.0.1/', 'https://tiktokcdn.com.evil.example/a', 'https://evil-tiktokcdn.com/a', 'https://x@y.tiktokcdn.com/a', 'https://p16.tiktokcdn.com:123/a']) assert.equal(safeAvatarUrl(url), '');
});
test('avatar proxy extracts protobuf profiles, shares in-flight downloads and caches bytes', async () => {
  let calls = 0; const store = new AvatarStore(async () => { calls++; return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }); });
  const path = store.register({ user: { avatarThumb: { urlList: ['https://p16.tiktokcdn.com/test.png'] } } });
  assert.match(path, /^\/live\/avatar\/[a-f0-9]{32}\.img$/);
  const key = path.split('/').at(-1).slice(0, -4);
  const images = await Promise.all([store.load(key), store.load(key)]);
  assert.equal(calls, 1); assert.deepEqual(images[0].bytes, Buffer.from([1, 2, 3])); assert.equal((await store.load(key)).type, 'image/png'); assert.equal(calls, 1);
  assert.equal(await store.load('unknown'), null);
});
test('avatar proxy blocks unsafe redirects, HTML/SVG and over-sized bodies', async () => {
  for (const make of [() => new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/secret' } }), () => new Response('html', { headers: { 'content-type': 'text/html' } }), () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }), () => new Response(new Uint8Array(512 * 1024 + 1), { headers: { 'content-type': 'image/png' } })]) {
    let calls = 0; const store = new AvatarStore(async () => { calls++; return make(); }); const path = store.register({ profilePictureUrl: 'https://p16.tiktokcdn.com/a' });
    assert.equal(await store.load(path.split('/').at(-1).slice(0, -4)), null); assert.equal(calls, 1);
  }
});
test('profile photos survive chat and follow without seating new followers', () => {
  const events = [], room = new CafeRoom(m => events.push(m)), path = '/live/avatar/' + 'a'.repeat(32) + '.img';
  room.chat('a', 'An', 'nhảy', false, path); assert.equal(room.snapshot().viewers[0].avatar, path);
  room.seat('a', 'An'); assert.equal(room.snapshot().viewers[0].avatar, path, 'A packet without avatar must not erase it');
  room.follow('b', 'Bach', false, path); assert.equal(events.find(m => m.t === 'follow').avatar, path); assert.equal(room.viewers.size, 1);
  room.chat('c', 'Chi', 'Chào', false, 'https://evil.example/a.png'); assert.equal(room.viewers.get('c').avatar, '');
});
test('stage accepts custom capacities up to 100 and grows the total seat limit accordingly', () => {
  const room = new CafeRoom(); room.updateSettings({ stageCapacity: 100 }); assert.equal(room.settings.stageCapacity, 100); assert.ok(room.settings.seatLimit >= 100);
  for (let i = 0; i < 100; i++) room.chat(String(i), 'Khách ' + i, 'nhảy');
  assert.equal(room.performers.length, 100);
  room.updateSettings({ stageCapacity: 13 }); assert.equal(room.performers.length, 13); assert.equal(room.stageQueue.length, 87);
  room.updateSettings({ stageCapacity: 100 }); assert.equal(room.performers.length, 100);
  room.updateSettings({ stageCapacity: -5 }); assert.equal(room.settings.stageCapacity, 1);
  room.updateSettings({ stageCapacity: '50' }); assert.equal(room.settings.stageCapacity, 1);
});
test('50/100 dancers receive distinct on-screen positions in multiple rows', () => {
  for (const count of [9, 16, 50, 100]) {
    const targets = [...getStageTargets(Array.from({ length: count }, (_, i) => ({ id: String(i) }))).values()];
    assert.equal(targets.length, count); assert.equal(new Set(targets.map(p => `${p.x}:${p.y}`)).size, count);
    assert.ok(targets.every(p => p.x > 100 && p.x < 980 && p.y >= 1000 && p.y <= 1331 && p.scale > .2));
    for (const a of targets) for (const b of targets) if (a !== b) assert.ok(Math.abs(a.x - b.x) > 55 * a.scale || Math.abs(a.y - b.y) > 120 * a.scale, 'Crowd avatar bodies must not overlap');
  }
});
