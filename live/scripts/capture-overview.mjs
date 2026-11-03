// Capture the actual app with isolated, explicitly labelled DEMO data.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { wav } from '../test/audio-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, '..', 'docs', 'images');
fs.mkdirSync(output, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-overview-data-'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-overview-chrome-'));
const origin = 'http://127.0.0.1:32765';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const files = ['Piano dem', 'Bossa ca phe', 'Mua ben cua so'].map((title, i) => {
  const name = `__overview-${process.pid}-${i}.wav`, file = path.join(root, '..', 'assets', 'radio', name);
  fs.writeFileSync(file, wav(2)); return { file, url: `/assets/radio/${name}`, title: `DEMO · ${title}` };
});
let server, chrome, cdp, control, sequence = 0, logs = '';
const calls = new Map(), errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function command(cmd, extra = {}) { control.send(JSON.stringify({ t: 'ctl', cmd, ...extra })); }
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { calls.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    calls.set(id, { resolve, reject, timer }); cdp.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(sessionId, expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(sessionId, expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(sessionId, expression)) return; await pause(100); }
  throw new Error(`Timed out: ${expression}`);
}
async function page(url, width, height) {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Page.enable', {}, sessionId); await call('Runtime.enable', {}, sessionId);
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  await call('Page.navigate', { url }, sessionId); return sessionId;
}
async function screenshot(sessionId, name) {
  const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  fs.writeFileSync(path.join(output, name), Buffer.from(data, 'base64'));
}
try {
  server = spawn(process.execPath, ['server.mjs'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: '32765', CAFE_DATA_DIR: dataDir, CAFE_PHONE: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {} await pause(100); }
  assert.ok(ready, logs);
  control = new WebSocket('ws://127.0.0.1:32765/ws?role=control', { origin }); await once(control, 'open');
  command('settings', { settings: { title: 'Cà Phê Cùng TƯ DUY LOGIC', subtitle: 'Một chiếc bàn, một câu chuyện.', scene: 'cafe', stageCapacity: 8, seatLimit: 36, stageSeconds: 180, bubbleSeconds: 15, readGifts: false, readFollows: false } });
  command('fill', { n: 12 });
  for (const file of files) command('renameTrack', { url: file.url, title: file.title });
  command('publishTracks', { action: 'add', urls: files.map(f => f.url) });
  for (const [name, text] of [['Ca sĩ', 'hát'], ['Vũ công', 'múa'], ['Đôi A', 'khiêu vũ'], ['Đôi B', 'khiêu vũ'], ['Minh', '!nhac 1'], ['An', '!nhac 1'], ['Linh', '!nhac 2']]) command('chat', { name, text });
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 15000);
    chrome.stderr.on('data', chunk => { const match = String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    chrome.on('error', reject);
  });
  cdp = new WebSocket(endpoint); await once(cdp, 'open');
  cdp.on('message', data => {
    const m = JSON.parse(data);
    if (m.id && calls.has(m.id)) { const p = calls.get(m.id); calls.delete(m.id); clearTimeout(p.timer); if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  });
  const studio = await page(origin, 1800, 1100);
  await until(studio, `document.querySelector('#libraryStatus')?.textContent.startsWith('3/')`);
  await evaluate(studio, `document.querySelector('[data-tab="music"]').click()`);
  // Verify the actual checkbox and Hide all controls, not just the server API.
  await evaluate(studio, `document.querySelector('#catalog input[type=checkbox]').click()`);
  await until(studio, `document.querySelectorAll('#catalog input:checked').length === 2`);
  await until(studio, `!document.querySelector('#catalog li:first-child code')`);
  await evaluate(studio, `document.querySelector('#hideAllTracks').click()`);
  await until(studio, `document.querySelectorAll('#catalog input:checked').length === 0`);
  for (const index of [0, 1, 2]) {
    await evaluate(studio, `document.querySelectorAll('#catalog input[type=checkbox]')[${index}].click()`);
    await until(studio, `document.querySelectorAll('#catalog input:checked').length === ${index + 1}`);
  }
  command('chat', { name: 'Khách A', text: '!nhac 1' }); command('chat', { name: 'Khách B', text: '!nhac 1' }); command('chat', { name: 'Khách C', text: '!nhac 2' });
  await pause(1000);
  await screenshot(studio, 'studio-music.png');
  const overlay = await page(`${origin}/live/overlay.html?capture=1`, 1080, 1920);
  await until(overlay, `Number(document.querySelector('#scene')?.dataset.renderFrame) > 5`);
  await until(overlay, `document.querySelectorAll('#publicQueue li[data-track-id]').length === 2`);
  await pause(500); await screenshot(overlay, 'overlay.png');
  await evaluate(studio, `document.querySelector('[data-tab="live"]').click()`);
  await screenshot(studio, 'studio.png');
  const png = name => `data:image/png;base64,${fs.readFileSync(path.join(output, name)).toString('base64')}`;
  const coverHtml = `<!doctype html><html lang="vi"><meta charset="utf-8"><style>
    *{box-sizing:border-box}html{overflow:hidden}body{margin:0;width:1600px;height:1100px;overflow:hidden;background:radial-gradient(ellipse at 90% 0,#503d50 0,transparent 55%),#111216;color:#f6ecde;font-family:Arial,sans-serif;padding:60px 65px;display:grid;grid-template-columns:850px 495px;gap:95px}
    .eyebrow{color:#efb89b;letter-spacing:4px;font-size:17px;margin:0 0 22px}h1{font-size:73px;letter-spacing:-3px;margin:0 0 16px}h1 span{color:#efb89b}.intro{font-size:25px;line-height:1.5;color:#d7c8cf;margin:0 0 24px}.pills{display:flex;gap:12px;margin-bottom:26px}.pills b{font-size:14px;letter-spacing:1px;border:1px solid #65505d;padding:10px 15px;border-radius:30px;color:#f3c6a9}.label{font-size:15px;color:#ccafb5;margin-bottom:10px}.studio{width:850px;border:1px solid #67505c;border-radius:15px;display:block}.features{display:flex;gap:28px;font-size:18px;line-height:1.5;margin:22px 0;color:#f0d5be}.footer{font-size:16px;color:#ae9baa;margin-top:20px}.phone{width:495px;height:880px;overflow:hidden;border:1px solid #967b84;border-radius:23px;box-shadow:0 24px 70px #0008}.phone img{display:block;width:495px;height:880px}
    </style><main><p class="eyebrow">BÁCH · @_tuduylogic_ · OPEN SOURCE</p><h1>TikTok LIVE <span>Café</span></h1><p class="intro">Một quán nhỏ. Nhiều câu chuyện.<br>Người xem trở thành nhân vật trong buổi LIVE.</p><div class="pills"><b>1080 × 1920</b><b>NODE.JS + CANVAS</b><b>MIT LICENSE</b></div><p class="label">STUDIO ĐIỀU KHIỂN · DỮ LIỆU DEMO</p><img class="studio" src="${png('studio-music.png')}"><div class="features"><span>♫ Bình chọn nhạc</span><span>✦ Sân khấu tương tác</span><span>☾ 10 không gian</span></div><p class="footer">github.com/bachkhi29/tiktok-live-cafe · Ảnh chụp từ ứng dụng thật</p></main><aside class="phone"><img src="${png('overlay.png')}"></aside></html>`;
  const cover = await page(`data:text/html;charset=utf-8,${encodeURIComponent(coverHtml)}`, 1600, 1100);
  await until(cover, `document.images.length === 2 && [...document.images].every(image => image.complete && image.naturalWidth > 0)`);
  await screenshot(cover, 'overview.png');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('OVERVIEW PASS: real UI screenshots saved; checkbox publication and Hide all verified.');
} finally {
  for (const p of calls.values()) clearTimeout(p.timer);
  cdp?.terminate(); control?.terminate(); chrome?.kill(); server?.kill();
  if (server && server.exitCode === null) await once(server, 'exit');
  for (const file of files) if (fs.existsSync(file.file)) fs.unlinkSync(file.file);
}
