import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wav } from './audio-fixture.mjs';
const port = 32761, origin = `http://127.0.0.1:${port}`;
let child, control, overlay;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-server-test-'));
const fixtureName = `__cafe-test-${process.pid}.wav`, fixtureUrl = new URL(`../../assets/radio/${fixtureName}`, import.meta.url);
const uploadName = `__upload-test-${process.pid}.wav`, uploadUrl = new URL(`../../assets/radio/${uploadName}`, import.meta.url);
const sockets = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function connect(role, customOrigin = origin) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=${role}`, { origin: customOrigin }); sockets.push(ws); await once(ws, 'open'); return ws;
}
function next(ws, predicate) { return new Promise((resolve, reject) => {
  const timer = setTimeout(() => { ws.off('message', handler); reject(new Error('Timed out waiting for websocket event')); }, 3000);
  const handler = buffer => { const message = JSON.parse(buffer); if (predicate(message)) { clearTimeout(timer); ws.off('message', handler); resolve(message); } }; ws.on('message', handler);
}); }
before(async () => {
  fs.writeFileSync(fixtureUrl, wav());
  child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port), CAFE_DATA_DIR: dataDir }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let ready = false, output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
  for (let i = 0; i < 70; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {} await delay(100); }
  assert.ok(ready, `Server did not start: ${output}`); control = await connect('control'); overlay = await connect('overlay');
});
after(async () => { for (const ws of sockets) ws.terminate(); child?.kill(); if (child && child.exitCode === null) await once(child, 'exit'); fs.unlinkSync(fixtureUrl); if (fs.existsSync(uploadUrl)) fs.unlinkSync(uploadUrl); });
test('HTTP serves complete app entrypoints and blocks private/source paths', async () => {
  for (const p of ['/', '/live/control.html', '/live/overlay.html', '/live/control.js', '/live/overlay.js', '/live/style.css']) assert.equal((await fetch(origin + p)).status, 200, p);
  const overlayHtml = await (await fetch(origin + '/live/overlay.html')).text();
  assert.match(overlayHtml, /apple-mobile-web-app-capable/); assert.match(overlayHtml, /apple-mobile-web-app-status-bar-style[^>]+black/); assert.match(overlayHtml, /viewport-fit=cover/);
  for (const p of ['/live/server.mjs', '/live/cafe.mjs', '/live/package.json', '/.git/config', '/assets/hall.jpg', '/live/%2e%2e%5c.git%5cconfig', '/live/%ZZ']) {
    const status = (await fetch(origin + p)).status; assert.ok([400, 404].includes(status), `${p}: ${status}`);
  }
});
test('state advertises the control protocol required by the current Studio', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=control`, { origin }); sockets.push(ws);
  const state = await next(ws, m => m.t === 'state'); assert.ok(state.protocolVersion >= 5);
});
test('forged Host and cross-site WebSocket Origin are denied', async () => {
  const status = await new Promise((resolve, reject) => { http.get(origin, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject); });
  assert.equal(status, 421);
  await assert.rejects(connect('control', 'https://evil.example'), /401/);
});
test('real audio files support complete responses and byte ranges', async () => {
  const response = await fetch(`${origin}/assets/radio/${fixtureName}`, { headers: { Range: 'bytes=0-43' } });
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-type'), 'audio/wav');
  const data = Buffer.from(await response.arrayBuffer()); assert.equal(data.length, 44); assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal((await fetch(`${origin}/assets/radio/${fixtureName}`, { headers: { Range: 'bytes=999999-' } })).status, 416);
});
test('server keeps files in the library until host publishes them', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=control`, { origin }); sockets.push(ws);
  const state = await next(ws, m => m.t === 'state');
  const track = state.radio.library.find(t => t.title === path.parse(fixtureName).name);
  assert.ok(track); assert.equal(state.radio.catalog.some(t => t.url === track.url), false);
  let pending = next(overlay, m => m.t === 'radio' && m.catalog.some(t => t.url === track.url));
  let saved = next(control, m => m.t === 'configSaved');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'publishTracks', action: 'add', urls: [track.url] }));
  const published = await pending; assert.equal(published.catalog.find(t => t.url === track.url).id, '1');
  await saved;
  const config = JSON.parse(fs.readFileSync(path.join(dataDir, 'studio.json'), 'utf8'));
  assert.deepEqual(config.publishedTracks, [track.url]);
  pending = next(overlay, m => m.t === 'radio' && !m.catalog.some(t => t.url === track.url));
  saved = next(control, m => m.t === 'configSaved');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'publishTracks', action: 'remove', urls: [track.url] }));
  assert.equal((await pending).catalog.length, 0); await saved;
});
test('renamed file title reaches the overlay and is saved without publishing the song', async () => {
  const url = `/assets/radio/${fixtureName}`, title = 'Tên bài trên LIVE';
  const updated = next(overlay, m => m.t === 'radio' && m.library.some(track => track.url === url && track.title === title));
  const saved = next(control, m => m.t === 'configSaved');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'renameTrack', url, title }));
  const radio = await updated; await saved;
  assert.ok(!radio.catalog.some(track => track.url === url));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'studio.json'), 'utf8')).trackTitles[url], title);
  const reset = next(overlay, m => m.t === 'radio' && m.library.some(track => track.url === url && track.title === path.parse(fixtureName).name));
  control.send(JSON.stringify({ t: 'ctl', cmd: 'renameTrack', url, title: path.parse(fixtureName).name })); await reset;
});
test('local file upload accepts audio, rejects overwrites and unsafe paths/origins', async () => {
  const upload = (name, from = origin) => fetch(origin + '/api/music', { method: 'POST', headers: { Origin: from, 'X-File-Name': encodeURIComponent(name), 'Content-Type': 'application/octet-stream' }, body: wav() });
  assert.equal((await upload(uploadName)).status, 201); assert.equal((await fetch(`${origin}/assets/radio/${uploadName}`)).status, 200);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=control`, { origin }); sockets.push(ws);
  const state = await next(ws, m => m.t === 'state');
  assert.ok(state.radio.library.some(t => t.title === path.parse(uploadName).name));
  assert.ok(!state.radio.catalog.some(t => t.title === path.parse(uploadName).name));
  assert.equal((await upload(uploadName)).status, 409); assert.equal((await upload('../evil.mp3')).status, 400); assert.equal((await upload('evil.mjs')).status, 400); assert.equal((await upload('safe.wav', 'https://evil.example')).status, 403);
});
test('settings, question bank and saved lines are persisted without session donations', async () => {
  let pending = next(control, m => m.t === 'configSaved'); control.send(JSON.stringify({ t: 'ctl', cmd: 'topicAction', action: 'save', topic: { text: 'Câu hỏi được lưu?', choices: ['Có', 'Không'] } })); await pending;
  pending = next(control, m => m.t === 'configSaved'); control.send(JSON.stringify({ t: 'ctl', cmd: 'lineAction', action: 'save', line: { label: 'Chào thử', text: 'Chào mọi người.' } })); await pending;
  const config = JSON.parse(fs.readFileSync(path.join(dataDir, 'studio.json'), 'utf8')); assert.equal(config.topics.at(-1).text, 'Câu hỏi được lưu?'); assert.equal(config.lines.at(-1).label, 'Chào thử'); assert.ok(!('donations' in config)); assert.ok(!('viewers' in config));
});
test('control simulation reaches overlay with explicit demo flag', async () => {
  const pending = next(overlay, m => m.t === 'chat'); control.send(JSON.stringify({ t: 'ctl', cmd: 'chat', name: 'Bách', text: 'Chào quán' }));
  const m = await pending; assert.equal(m.text, 'Chào quán'); assert.equal(m.demo, true);
});
test('studio fill controls shrink the audience visible to the overlay', async () => {
  const settings = next(overlay, m => m.t === 'settings' && m.settings.seatLimit === 64);
  control.send(JSON.stringify({ t: 'ctl', cmd: 'settings', settings: { seatLimit: 64 } })); await settings;
  const crowded = next(overlay, m => m.t === 'join' && m.v.id === 'demo_61');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'fill', n: 100 })); await crowded;
  const left = next(overlay, m => m.t === 'leave' && m.id === 'demo_61');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'fill', n: 12 })); await left;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=overlay`, { origin }); sockets.push(ws);
  const state = await next(ws, m => m.t === 'state');
  assert.equal(state.viewers.filter(v => /^demo_\d+$/.test(v.id)).length, 12);
  assert.ok(state.viewers.some(v => v.id === 'sim_Bách'));
});
test('simulated gifts and goal settings broadcast without increasing real donations', async () => {
  let pending = next(overlay, m => m.t === 'settings');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'settings', settings: { giftGoal: 250, giftGoalTitle: 'Quán đêm' } }));
  assert.equal((await pending).settings.giftGoal, 250);
  pending = next(overlay, m => m.t === 'donations');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'gift', name: 'Bách', diamonds: 99, count: 2 }));
  const summary = await pending; assert.equal(summary.total, 0); assert.equal(summary.demoTotal, 198);
  assert.equal(summary.demoLeaderboard[0].name, 'Bách');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin }); sockets.push(ws);
  const state = await next(ws, m => m.t === 'state'); assert.equal(state.donations.demoTotal, 198); assert.equal(state.settings.giftGoalTitle, 'Quán đêm'); ws.close();
});
test('music and voice volume settings from PC reach the overlay', async () => {
  const pending = next(overlay, m => m.t === 'settings');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'settings', settings: { trackVolume: 18, ambientVolume: 42, voiceVolume: 95, duckVolume: 10 } }));
  const event = await pending;
  assert.equal(event.settings.trackVolume, 18);
  assert.equal(event.settings.ambientVolume, 42);
  assert.equal(event.settings.voiceVolume, 95);
  assert.equal(event.settings.duckVolume, 10);
});
test('overlay commands cannot modify room settings', async () => {
  overlay.send(JSON.stringify({ t: 'ctl', cmd: 'settings', settings: { title: 'Hacked' } })); await delay(100);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin }); sockets.push(ws);
  const pending = next(ws, m => m.t === 'state'); const m = await pending; assert.equal(m.settings.title, 'Cà Phê Sau 12h'); ws.close();
});
test('follow simulation sends personalised thanks without fabricating a donation', async () => {
  const event = next(overlay, m => m.t === 'follow');
  control.send(JSON.stringify({ t: 'ctl', cmd: 'follow', name: 'Bách follow' }));
  const message = await event; assert.equal(message.demo, true); assert.equal(message.name, 'Bách follow');
  assert.equal(message.text, 'Cảm ơn bạn Bách follow đã follow kênh của mình nhé.');
});

test('audio ownership moves exclusively between overlays and clear keeps connection state', async () => {
  const p1 = next(overlay, m => m.t === 'audioOwner'); overlay.send(JSON.stringify({ t: 'audio', enabled: true })); assert.equal((await p1).owner, true);
  const other = await connect('overlay'); const p2 = next(overlay, m => m.t === 'audioOwner'); const p3 = next(other, m => m.t === 'audioOwner');
  other.send(JSON.stringify({ t: 'audio', enabled: true })); assert.equal((await p2).owner, false); assert.equal((await p3).owner, true);
  const reset = next(control, m => m.t === 'state'); control.send(JSON.stringify({ t: 'ctl', cmd: 'clear' }));
  const m = await reset; assert.equal(m.audioReady, true); assert.equal(m.audioDevice, 'PC'); assert.equal(m.tiktok.status, 'idle'); assert.equal(m.viewers.length, 0);
});
