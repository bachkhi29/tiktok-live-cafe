import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 32763;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-phone-'));
const child = spawn(process.execPath, ['server.mjs'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: String(port), CAFE_PHONE: '1', CAFE_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + String(chunk)).slice(-6000); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function rejectedSocket(url, options) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, options);
    socket.once('open', () => { socket.close(); reject(new Error('Phone connection obtained control rights')); });
    socket.once('unexpected-response', (_, response) => { response.resume(); resolve(response.statusCode); });
    socket.once('error', reject);
  });
}
try {
  let phoneUrl;
  for (let i = 0; i < 100; i++) {
    phoneUrl = output.match(/http:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)[\d.]+:32763\/phone\?t=[A-Za-z\d_-]+/)?.[0];
    if (phoneUrl) break;
    if (child.exitCode !== null) throw new Error(`Phone server exited: ${output}`);
    await delay(100);
  }
  assert.ok(phoneUrl, `No private network address: ${output}`);
  const base = new URL(phoneUrl).origin;
  assert.equal((await fetch(base + '/phone')).status, 403);
  const pair = await fetch(phoneUrl, { redirect: 'manual' });
  assert.equal(pair.status, 302);
  assert.equal(pair.headers.get('location'), '/phone');
  const cookie = pair.headers.get('set-cookie').split(';')[0];
  assert.match(cookie, /^cafe_phone=[A-Za-z\d_-]+$/);
  const headers = { Cookie: cookie };
  assert.equal((await fetch(base + '/phone', { headers })).status, 200);
  assert.equal((await fetch(base + '/live/overlay.js', { headers })).status, 200);
  assert.equal((await fetch(base + '/live/control.html', { headers })).status, 403);
  assert.equal((await fetch(base + '/', { headers })).status, 403);
  assert.equal((await fetch(base + '/api/music', { method: 'POST', headers })).status, 403);
  assert.equal((await fetch(base + '/live/server.mjs', { headers })).status, 404);
  const wsBase = base.replace('http:', 'ws:');
  assert.equal(await rejectedSocket(`${wsBase}/ws?role=control`, { origin: base, headers }), 401);
  assert.equal(await rejectedSocket(`${wsBase}/ws?role=overlay`, { origin: base }), 401);
  const phoneSocket = new WebSocket(`${wsBase}/ws?role=overlay`, { origin: base, headers });
  const state = await new Promise((resolve, reject) => {
    phoneSocket.once('message', data => resolve(JSON.parse(data)));
    phoneSocket.once('error', reject);
  });
  assert.equal(state.settings.title, 'Cà Phê Sau 12h');
  const control = new WebSocket('ws://127.0.0.1:32763/ws?role=control', { origin: 'http://127.0.0.1:32763' });
  await once(control, 'open');
  const changed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Phone did not receive music volume settings')), 3000);
    phoneSocket.on('message', data => {
      const message = JSON.parse(data);
      if (message.t === 'settings') { clearTimeout(timer); resolve(message); }
    });
  });
  control.send(JSON.stringify({ t: 'ctl', cmd: 'settings', settings: { trackVolume: 12, ambientVolume: 20, duckVolume: 10 } }));
  const event = await changed;
  assert.equal(event.settings.trackVolume, 12); assert.equal(event.settings.ambientVolume, 20); assert.equal(event.settings.duckVolume, 10);
  phoneSocket.close(); control.close();
  console.log('PHONE PASS: LAN overlay receives PC volume changes; remote control, upload and unpaired sockets are blocked.');
} finally {
  if (child.exitCode === null) { child.kill(); await Promise.race([once(child, 'exit'), delay(3000)]); }
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(dataDir).startsWith(tempRoot)) fs.rmSync(dataDir, { recursive: true, force: true });
}
