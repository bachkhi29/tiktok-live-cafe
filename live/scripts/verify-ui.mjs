// Browser checks use the already installed Chrome and ws; no browser-test dependency.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { wav } from '../test/audio-fixture.mjs';
import { SCENES, AMBIENTS } from '../presets.js';
import { avatarPng } from '../test/avatar-fixture.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = path.join(root, 'artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
assert.ok(fs.existsSync(chromePath), 'Chrome not found. Set CHROME_PATH to your Chrome executable.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-ui-'));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-ui-settings-'));
const fixtureTitle = `__cafe-ui-${process.pid}`, fixturePath = path.join(root, '..', 'assets', 'radio', `${fixtureTitle}.wav`);
fs.writeFileSync(fixturePath, wav(4));
const voteTitle = `__vote-ui-${process.pid}`, votePath = path.join(root, '..', 'assets', 'radio', `${voteTitle}.wav`); fs.writeFileSync(votePath, wav(4));
let serverOutput = '';
const launch = () => {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: '32762', CAFE_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { serverOutput = (serverOutput + String(data)).slice(-6000); });
  return child;
};
let server = launch();
let chrome, cdp, control, sequence = 0;
let cachedVoice = null;
const calls = new Map(), errors = [], origin = 'http://127.0.0.1:32762';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { calls.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
    calls.set(id, { resolve, reject, timer }); cdp.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function page(url, width, height) {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Page.enable', {}, sessionId); await call('Runtime.enable', {}, sessionId);
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  await call('Page.navigate', { url }, sessionId);
  return sessionId;
}
async function evaluate(session, expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
}
async function until(session, expression, timeout = 10000) {
  for (let i = 0; i < Math.ceil(timeout / 100); i++) { if (await evaluate(session, expression)) return; await delay(100); }
  const diagnostic = await evaluate(session, `(() => { const voice = document.querySelector('#voiceAudio'); return { voice: voice && { src: voice.currentSrc.startsWith('data:') ? '[unlocked silent audio]' : voice.currentSrc, time: voice.currentTime, paused: voice.paused, error: voice.error?.message }, tts: document.querySelector('#ttsStatus')?.textContent, audio: document.querySelector('#audioStatus')?.textContent }; })()`);
  console.error('Browser diagnostic:', diagnostic, '\nStage:', await evaluate(session, `({ hidden: document.hidden, actors: JSON.parse(document.querySelector('#scene')?.dataset.actorPositions || '[]').filter(a => a.onStage).length })`), '\nAvatar:', await evaluate(session, `JSON.parse(document.querySelector('#scene')?.dataset.actorPositions || '[]').filter(a => a.id === 'sim_Bách').map(({id,avatar,avatarLoaded}) => ({id,avatar,avatarLoaded}))`), '\nErrors:', errors, '\nServer log:', serverOutput);
  await screenshot(session, 'failure-ui.png');
  throw new Error(`Browser condition timed out: ${expression}`);
}
async function screenshot(session, name) { const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, session); fs.writeFileSync(path.join(artifacts, name), Buffer.from(data, 'base64')); }
async function click(session, selector) {
  const point = await evaluate(session, `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, session);
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, session);
}
async function tab(session, name) {
  await evaluate(session, `document.querySelector('[data-tab="${name}"]').click()`);
  await until(session, `document.querySelector('[data-panel="${name}"]').hidden === false`);
}
function command(cmd, extra = {}) { control.send(JSON.stringify({ t: 'ctl', cmd, ...extra })); }
try {
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {} await delay(100); }
  assert.ok(ready, 'Test server did not start');
  control = new WebSocket(`ws://127.0.0.1:32762/ws?role=control`, { origin }); await once(control, 'open');
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome remote debugger did not start')), 15000);
    chrome.stderr.on('data', data => { const match = String(data).match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    chrome.on('error', reject);
  });
  cdp = new WebSocket(endpoint); await once(cdp, 'open');
  cdp.on('message', data => {
    const message = JSON.parse(data);
    if (message.id && calls.has(message.id)) { const pending = calls.get(message.id); calls.delete(message.id); clearTimeout(pending.timer); if (message.error) pending.reject(new Error(JSON.stringify(message.error))); else pending.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Fetch.requestPaused') {
      // Only this test target receives a known PNG fixture; this does not mock TikTok events or the production proxy.
      void call('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: avatarPng().toString('base64') }, message.sessionId).catch(error => errors.push(String(error)));
    }
  });
  const studio = await page(origin, 1440, 1050);
  await until(studio, `document.querySelector('#serverStatus')?.textContent === 'Server đang chạy'`);
  command('publishTracks', { action: 'add', urls: [fixtureTitle, voteTitle].map(title => `/assets/radio/${encodeURIComponent(title)}.wav`) });
  await until(studio, `document.querySelector('#libraryStatus').textContent.startsWith('2/')`);
  command('settings', { settings: { title: 'Cà Phê Cùng TƯ DUY LOGIC', stageSeconds: 3, bubbleSeconds: 15, musicVoting: false, readGifts: false, readFollows: false } });
  assert.equal(await evaluate(studio, `document.documentElement.scrollWidth <= innerWidth`), true, 'Desktop has horizontal overflow');
  assert.equal(await evaluate(studio, `document.documentElement.scrollHeight <= innerHeight + 1`), true, 'Desktop requires deep document scrolling');
  assert.equal(await evaluate(studio, `document.querySelectorAll('[data-panel]:not([hidden])').length`), 1);
  await evaluate(studio, `document.querySelector('[data-fill="12"]').click()`);
  await until(studio, `document.querySelector('#guestCount').textContent === '12'`);
  await evaluate(studio, `document.querySelector('#sendChat').click()`);
  await until(studio, `document.querySelector('#guestCount').textContent === '13'`);
  await screenshot(studio, 'studio-desktop.png');
  const overlay = await page(`${origin}/live/overlay.html`, 540, 960);
  await call('Network.enable', {}, overlay); await call('Network.setCacheDisabled', { cacheDisabled: true }, overlay);
  await call('Fetch.enable', { patterns: [{ urlPattern: '*/live/avatar/*', requestStage: 'Request' }] }, overlay);
  await until(overlay, `document.querySelector('#overlayDemo').textContent === '13 DEMO'`);
  await delay(700);
  await call('Page.bringToFront', {}, studio);
  await until(overlay, `document.hidden === true`);
  const backgroundFrame = await evaluate(overlay, `Number(document.querySelector('#scene').dataset.renderFrame)`);
  const backgroundBelt = await evaluate(overlay, `document.querySelector('.catalog-belt').getBoundingClientRect().x`);
  // Check continuing output without assuming this machine can sustain a particular FPS.
  await until(overlay, `Number(document.querySelector('#scene').dataset.renderFrame) > ${backgroundFrame + 10}`);
  assert.equal(await evaluate(overlay, `document.querySelector('#scene').dataset.renderHidden`), 'true');
  assert.ok(await evaluate(overlay, `document.querySelector('.catalog-belt').getBoundingClientRect().x`) < backgroundBelt - 5, 'The conveyor must keep moving in the background');
  await call('Page.bringToFront', {}, overlay);
  const hd = await page(`${origin}/live/overlay.html?capture=1`, 1080, 1920);
  await until(hd, `Number(document.querySelector('#scene')?.dataset.renderFrame) > 2`);
  const hdSize = await evaluate(hd, `(() => { const c = document.querySelector('#scene'), r = document.querySelector('#stage').getBoundingClientRect(); return { w: c.width, h: c.height, visibleW: r.width, visibleH: r.height }; })()`);
  assert.deepEqual(hdSize, { w: 1080, h: 1920, visibleW: 1080, visibleH: 1920 });
  assert.equal(await evaluate(hd, `document.querySelector('#soundButton').hidden && document.querySelector('#trackAudio').paused`), true, 'The HD video-only source must not steal audio');
  await screenshot(hd, 'overlay-hd-source.png');
  await call('Page.bringToFront', {}, studio); await until(hd, `document.hidden === true`);
  const hdFrame = await evaluate(hd, `Number(document.querySelector('#scene').dataset.renderFrame)`);
  await until(hd, `Number(document.querySelector('#scene').dataset.renderFrame) > ${hdFrame + 5}`);
  await call('Page.navigate', { url: 'about:blank' }, hd);
  await call('Page.bringToFront', {}, overlay);
  await screenshot(overlay, 'overlay-cafe.png');
  assert.equal(await evaluate(overlay, `document.querySelector('.overlay-topic, .overlay-footer, .support-menu, #danceRule') === null`), true, 'Retired panels must leave the room clear');
  assert.equal(await evaluate(overlay, `document.querySelector('#orderInstruction').textContent.includes('Bình luận !nhac + MÃ để order bài hát tiếp theo')`), true);
  assert.ok(await evaluate(overlay, `parseFloat(getComputedStyle(document.querySelector('#orderInstruction')).fontSize)`) >= 27, 'Music command must be readable');
  assert.equal(await evaluate(overlay, `document.querySelector('.overlay-pills').getBoundingClientRect().bottom <= document.querySelector('.overlay-radio').getBoundingClientRect().top`), true, 'Title and pills overlap radio');
  // Verify real interaction delivery and safe text rendering, rather than a static mock.
  command('chat', { name: 'Kiểm tra', text: '<img src=x onerror=alert(1)>' });
  await until(studio, `document.querySelector('#guestCount').textContent === '14'`);
  assert.equal(await evaluate(studio, `document.querySelectorAll('#people img').length`), 0);
  await delay(1000); command('chat', { name: 'Kiểm tra', text: 'Tối nay quán đông vui quá ☕' });
  command('follow', { name: 'Theo dõi' });
  await until(overlay, `document.querySelector('#followMessage').textContent === 'Cảm ơn bạn Theo dõi đã follow kênh của mình nhé.' && getComputedStyle(document.querySelector('#followBanner')).opacity > .9`);
  assert.equal(await evaluate(overlay, `document.querySelector('#followName').textContent`), 'Theo dõi');
  assert.equal(await evaluate(overlay, `document.querySelector('#followBanner').getBoundingClientRect().bottom <= document.querySelector('#interactionGuide').getBoundingClientRect().top`), true, 'Follow must not cover command instructions');
  assert.equal(await evaluate(studio, `document.querySelector('#guestCount').textContent`), '14', 'Follow must not seat a viewer');
  assert.equal(await evaluate(overlay, `document.querySelector('#interactionGuide').getBoundingClientRect().bottom <= document.querySelector('#radioQueueCard').getBoundingClientRect().top`), true);
  await screenshot(overlay, 'overlay-follow.png');
  await tab(studio, 'settings'); await evaluate(studio, `document.querySelector('[data-scene="concert"]').click()`);
  await tab(studio, 'live');
  command('chat', { name: 'Bách', text: 'Avatar DEMO trên sân khấu', avatar: '/live/avatar/' + 'a'.repeat(32) + '.img' });
  command('gift', { name: 'Bách', gift: 'Rose · Hoa hồng', diamonds: 1, count: 1 });
  await until(overlay, `document.querySelector('#giftBanner').classList.contains('visible')`);
  await until(overlay, `document.querySelector('#giftDetail').textContent.includes('+1 lượt nhảy')`);
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').some(a => a.id === 'sim_Bách' && a.onStage && Math.abs(a.y - 931) < 8)`);
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').some(a => a.id === 'sim_Bách' && a.avatarLoaded)`);
  assert.equal(await evaluate(overlay, `document.querySelector('#interactionGuide').textContent.includes('HOA HỒNG')`), false);
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.bubbleBoxes || '[]').some(b => b.id === 'sim_Bách' && b.onStage && b.anchorY < 900)`);
  const stageSpeech = await evaluate(overlay, `JSON.parse(document.querySelector('#scene').dataset.bubbleBoxes).find(b => b.id === 'sim_Bách')`);
  assert.ok(stageSpeech.y + stageSpeech.h < 950, 'Stage chat must follow the stage actor instead of staying at its table');
  assert.ok(stageSpeech.anchorY < 900);
  const poseA = await evaluate(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions).find(a => a.id === 'sim_Bách').pose`);
  await delay(220);
  const poseB = await evaluate(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions).find(a => a.id === 'sim_Bách').pose`);
  assert.equal(poseB.mode, 'dance'); assert.notDeepEqual(poseA, poseB, 'Dance animation must change across frames');
  await screenshot(overlay, 'overlay-rose-chat.png');
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').some(a => a.id === 'sim_Bách' && !a.onStage && a.y > 1100)`);
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.bubbleBoxes || '[]').some(b => b.id === 'sim_Bách' && !b.onStage && b.anchorY > 1000)`);
  command('settings', { settings: { stageSeconds: 180 } }); command('stageAction', { action: 'invite', id: 'sim_Bách' });
  await delay(300); await screenshot(overlay, 'overlay-concert.png');
  await until(overlay, `document.querySelector('#supportRankMode').textContent === 'DEMO'`);
  assert.equal(await evaluate(overlay, `document.querySelector('#supportGoalAmount').textContent.startsWith('0 /')`), true, 'Demo gift counted as real money');
  assert.equal(await evaluate(overlay, `document.querySelector('#supportGoalFill').style.width`), '0%');
  await evaluate(studio, `(() => { const goal = document.querySelector('#giftGoal'); goal.value = '250'; goal.dispatchEvent(new Event('change')); const title = document.querySelector('#giftGoalTitle'); title.value = 'Đêm concert của chúng ta'; title.dispatchEvent(new Event('change')); })()`);
  await until(overlay, `document.querySelector('#supportGoalTitle').textContent === 'Đêm concert của chúng ta'`);
  command('gift', { name: 'Mây', gift: 'Ánh đèn', diamonds: 10, count: 3 });
  command('gift', { name: 'An Nhiên', gift: 'Hoa hồng', diamonds: 1, count: 5 });
  await until(studio, `document.querySelector('#donationDemoTotal').textContent === '36 KC'`);
  await until(overlay, `document.querySelector('#supportRank li:first-child .support-rank-name')?.textContent === 'Mây · DEMO'`);
  assert.equal(await evaluate(overlay, `document.querySelector('#supportDemoFill').style.width`), '14.4%');
  assert.equal(await evaluate(overlay, `document.querySelector('#supportRank img')`), null);
  assert.equal(await evaluate(overlay, `document.querySelector('.support-ranking').getBoundingClientRect().bottom < document.querySelector('.support-goal').getBoundingClientRect().top`), true, 'Donation boards overlap');
  await screenshot(overlay, 'overlay-support.png'); await screenshot(studio, 'studio-support.png');
  await tab(studio, 'settings'); await evaluate(studio, `document.querySelector('[data-scene="garden"]').click()`);
  command('chat', { name: 'Vườn', text: 'vỗ tay' }); await delay(400);
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').some(p => p.id === 'sim_Vườn' && p.pose.mode === 'clap')`);
  await screenshot(overlay, 'overlay-garden.png');
  await click(overlay, '#soundButton');
  await until(studio, `document.querySelector('#audioStatus').textContent.includes('ĐÃ BẬT')`);
  if (process.env.CAFE_TEST_LIVE_TTS === '1') {
    for (const voice of ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural']) {
      command('settings', { settings: { voice, pitch: -10, rate: 10, voiceVolume: 85 } });
      const text = `Xin chào cả quán. Đây là kiểm tra giọng đọc tiếng Việt, lần ${Date.now() % 10000}.`;
      command('say', { text });
      await until(overlay, `document.querySelector('#voiceAudio').currentSrc.includes('/live/tts/') && document.querySelector('#voiceAudio').currentTime > .15 && !document.querySelector('#voiceAudio').paused`, 45000);
      await until(studio, `document.querySelector('#ttsStatus').textContent.startsWith('Đang phát') && document.querySelector('#ttsStatus').textContent.includes('✓')`);
      assert.ok((await evaluate(overlay, `document.querySelector('#voiceAudio').duration`)) > 1);
      const source = await evaluate(overlay, `document.body.dataset.speechSource`);
      assert.ok(['edge', 'google'].includes(source));
      assert.ok(Math.abs(await evaluate(overlay, `document.querySelector('#voiceAudio').playbackRate`) - (source === 'google' ? 1.1 : 1)) < .001);
      command('stopSpeech'); await until(overlay, `document.querySelector('#voiceAudio').paused`);
      console.log(`LIVE TTS PASS: requested ${voice}; fresh Vietnamese MP3 served by ${source} and played in browser.`);
      cachedVoice = { text, source, src: await evaluate(overlay, `document.querySelector('#voiceAudio').currentSrc`) };
      await evaluate(studio, `document.querySelector('#ttsStatus').dataset.cached = 'pending'`);
      command('say', { text });
      await until(studio, `document.querySelector('#ttsStatus').dataset.cached === 'true'`);
      await until(overlay, `document.querySelector('#voiceAudio').currentTime > .15 && !document.querySelector('#voiceAudio').paused`);
      assert.equal(await evaluate(overlay, `document.body.dataset.speechSource`), source);
      command('stopSpeech'); await until(overlay, `document.querySelector('#voiceAudio').paused`);
    }
    const longText = 'Tôi cảm ơn mọi người đã ghé quán. Chúc mọi người một buổi tối bình an, nghe nhạc thật vui và nghỉ ngơi thoải mái. '.repeat(3) + String(Date.now() % 10000);
    const previousSrc = await evaluate(overlay, `document.querySelector('#voiceAudio').currentSrc`);
    command('say', { text: longText });
    await until(overlay, `document.querySelector('#voiceAudio').currentSrc !== ${JSON.stringify(previousSrc)} && document.querySelector('#voiceAudio').currentTime > .15 && !document.querySelector('#voiceAudio').paused`, 45000);
    assert.ok(await evaluate(overlay, `document.querySelector('#voiceAudio').duration > 10`), 'Long speech must include every segment');
    await evaluate(overlay, `(() => { const audio = document.querySelector('#voiceAudio'); audio.currentTime = audio.duration - 1; })()`);
    await until(overlay, `document.querySelector('#voiceAudio').currentTime > document.querySelector('#voiceAudio').duration - .8 && !document.querySelector('#voiceAudio').paused`);
    command('stopSpeech'); await until(overlay, `document.querySelector('#voiceAudio').paused`);
    command('say', { text: 'Tôi sẽ dừng câu này trước khi âm thanh được tạo xong. ' + Date.now() });
    await until(studio, `document.querySelector('#ttsStatus').textContent === 'Đang tạo giọng đọc…'`);
    command('stopSpeech'); await until(studio, `document.querySelector('#ttsStatus').textContent === 'Đã dừng đọc.'`);
    await delay(1000); assert.equal(await evaluate(overlay, `document.querySelector('#voiceAudio').paused`), true);
    console.log('LIVE TTS PASS: cached reads, long segmented speech including the final audio frames, and cancellation during generation.');
    command('settings', { settings: { readGifts: true, readFollows: true } });
    for (const kind of ['follow', 'gift']) {
      const previousSrc = await evaluate(overlay, `document.querySelector('#voiceAudio').currentSrc`);
      command(kind, { name: `${kind} ${Date.now() % 10000000}`, gift: 'Rose', diamonds: 1, count: 1 });
      await until(overlay, `document.querySelector('#voiceAudio').currentSrc !== ${JSON.stringify(previousSrc)} && document.querySelector('#voiceAudio').currentTime > .15 && !document.querySelector('#voiceAudio').paused`, 45000);
      command('stopSpeech'); await until(overlay, `document.querySelector('#voiceAudio').paused`);
      console.log(`LIVE TTS PASS: automatic ${kind} thanks generated and played in browser.`);
    }
    command('settings', { settings: { readGifts: false, readFollows: false } });
  }
  command('settings', { settings: { songMinGift: 0 } });
  // A real generated WAV tests HTTP decoding, browser playback, and ended acknowledgements.
  command('chat', { name: 'Nghe nhạc 1', text: `!nhac ${fixtureTitle}` });
  await until(studio, `document.querySelector('#requestedBy').textContent.includes('Nghe nhạc 1')`);
  command('chat', { name: 'Nghe nhạc 2', text: `!nhac ${fixtureTitle}` });
  await until(studio, `document.querySelector('#queueCount').textContent === '1'`);
  await until(studio, `document.querySelector('#requestedBy').textContent.includes('Nghe nhạc 2')`);
  await until(studio, `document.querySelector('#nowPlaying').textContent === 'Chưa có bài order'`);
  // Host controls a real audio element: manual start, volume, pause, seek and stop.
  await tab(studio, 'music');
  command('settings', { settings: { autoPlay: false } });
  command('addTrack', { id: fixtureTitle }); command('addTrack', { id: fixtureTitle });
  await until(studio, `document.querySelectorAll('#queue .queue-item').length === 2`);
  await evaluate(studio, `document.querySelector('#queue .queue-tools button:nth-child(3)').click()`);
  await until(studio, `document.querySelector('#queue .queue-item small').textContent.includes('CHỦ QUÁN XẾP')`);
  await evaluate(studio, `document.querySelector('#queue .queue-play').click()`);
  await until(overlay, `document.querySelector('#trackAudio').paused === false`);
  await evaluate(studio, `(() => { const s = document.querySelector('#trackVolume'); s.value = '17'; s.dispatchEvent(new Event('change')); })()`);
  await evaluate(studio, `document.querySelector('#pause').click()`);
  await until(overlay, `document.querySelector('#trackAudio').paused === true`);
  await evaluate(studio, `(() => { const s = document.querySelector('#seek'); s.value = '1.5'; s.dispatchEvent(new Event('change')); })()`);
  await until(overlay, `Math.abs(document.querySelector('#trackAudio').currentTime - 1.5) < .25`);
  await evaluate(studio, `document.querySelector('#pause').click()`);
  await until(overlay, `document.querySelector('#trackAudio').paused === false`);
  await evaluate(studio, `document.querySelector('#stopMusic').click()`);
  await until(studio, `document.querySelector('#nowPlaying').textContent === 'Chưa có bài order'`);
  command('queueAction', { action: 'clear' });
  // Voice lines remain available after retiring the question editor.
  await tab(studio, 'voice'); await evaluate(studio, `(() => { document.querySelector('#lineLabel').value = 'Chào Bách'; document.querySelector('#lineText').value = 'Chào Bách và cả quán.'; document.querySelector('#lineAudio').value = [...document.querySelector('#lineAudio').options].find(o => o.textContent === ${JSON.stringify(fixtureTitle)}).value; document.querySelector('#saveLine').click(); })()`);
  await until(studio, `[...document.querySelectorAll('#savedLines button')].some(b => b.textContent.includes('Chào Bách'))`);
  command('addTrack', { id: fixtureTitle, playNow: true }); await until(overlay, `document.querySelector('#trackAudio').paused === false`);
  await evaluate(studio, `(() => { const s = document.querySelector('#voiceVolume'); s.value = '40'; s.dispatchEvent(new Event('change')); [...document.querySelectorAll('#savedLines button')].find(b => b.textContent.includes('Chào Bách')).click(); })()`);
  await until(overlay, `document.querySelector('#voiceAudio').paused === false`);
  assert.equal(await evaluate(overlay, `document.querySelector('#voiceAudio').playbackRate`), 1, 'Recorded audio must not inherit fallback speech speed');
  await evaluate(studio, `document.querySelector('#stopSpeech').click()`); await until(overlay, `document.querySelector('#voiceAudio').paused === true`);
  await evaluate(studio, `document.querySelector('#stopMusic').click()`);
  // Real voting UI: two tracks, one vote per person, duplicate resistance and change of vote.
  command('settings', { settings: { musicVoting: true, autoPlay: false } });
  await evaluate(overlay, `document.querySelector('.catalog-belt').dataset.marker = 'keep'`);
  const beltX = await evaluate(overlay, `document.querySelector('.catalog-belt').getBoundingClientRect().x`);
  await delay(350);
  assert.ok(await evaluate(overlay, `document.querySelector('.catalog-belt').getBoundingClientRect().x`) < beltX - 2, 'Music codes must scroll smoothly');
  command('chat', { name: 'Fan A', text: `!nhac ${fixtureTitle}` });
  command('chat', { name: 'Fan B', text: `!nhac ${voteTitle}` }); command('chat', { name: 'Fan C', text: `!nhac ${voteTitle}` });
  await until(overlay, `document.querySelector('#publicQueue li:first-child b')?.textContent.startsWith('2 người')`);
  assert.equal(await evaluate(overlay, `document.querySelector('.catalog-belt').dataset.marker`), 'keep', 'Voting must not reset the conveyor');
  await delay(1000); command('chat', { name: 'Fan C', text: `!nhac ${voteTitle}` });
  await delay(150); assert.equal(await evaluate(overlay, `document.querySelector('#publicQueue li:first-child b').textContent.startsWith('2 người')`), true);
  await screenshot(overlay, 'overlay-music-votes.png');
  await delay(2100); command('chat', { name: 'Fan A', text: `!nhac ${voteTitle}` });
  await until(overlay, `document.querySelector('#publicQueue li:first-child b')?.textContent.startsWith('3 người')`);
  command('queueAction', { action: 'clear' });
  // Save custom rotating thanks using the real editor; server restart below verifies persistence.
  await tab(studio, 'voice');
  await evaluate(studio, `document.querySelector('.reaction-editor>summary').click()`);
  assert.equal(await evaluate(studio, `document.querySelector('.reaction-editor').open`), true);
  await evaluate(studio, `(() => { document.querySelector('#reaction-rose').value = ['Mình cảm ơn bạn {name} đã tặng hoa hồng.','Bạn {name} ơi, mình đã nhận được {count} hoa hồng rồi nhé.'].join('\\n'); document.querySelector('#saveReactions').click(); })()`);
  await evaluate(studio, `document.querySelector('.reaction-editor>summary').click()`);
  command('settings', { settings: { stageSeconds: 180, stageCapacity: 8 } }); command('stageAction', { action: 'clear' });
  for (const [name, text] of [['Ca sĩ','hát'],['Vũ công','múa'],['Đôi A','khiêu vũ'],['Đôi B','khiêu vũ']]) command('chat', { name, text });
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').some(p => p.id === 'sim_Ca sĩ' && p.pose.mode === 'sing')`);
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').some(p => p.id === 'sim_Vũ công' && p.pose.mode === 'ribbon')`);
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').some(p => p.id === 'sim_Đôi A' && p.partnerId === 'sim_Đôi B' && p.pose.mode === 'ballroom')`);
  await delay(500); await screenshot(overlay, 'overlay-performance-party.png');
  command('stageAction', { action: 'clear' }); command('stageAction', { action: 'invite', id: 'sim_Bách' });
  command('settings', { settings: { stageCapacity: 8, bubbleLimit: 8 } });
  for (let i = 0; i < 7; i++) { command('chat', { name: 'Sân khấu ' + i, text: 'Lên nhịp nào' }); command('gift', { name: 'Sân khấu ' + i, diamonds: 100, count: 1 }); }
  await until(studio, `document.querySelector('#stageCount').textContent === '8 / 8'`);
  await screenshot(overlay, 'overlay-eight-performers.png');
  await tab(studio, 'settings');
  for (const scene of SCENES) {
    await evaluate(studio, `document.querySelector('[data-scene="${scene.id}"]').click()`);
    await until(overlay, `document.querySelector('#sceneCaption').textContent === ${JSON.stringify(scene.name.toLocaleUpperCase())}`);
    await delay(120);
    const pixels = `(() => { const pixels = document.querySelector('#scene').getContext('2d').getImageData(320,445,440,330).data; let hash = 2166136261; for (let i = 0; i < pixels.length; i++) hash = Math.imul(hash ^ pixels[i], 16777619); return hash >>> 0; })()`;
    const a = await evaluate(overlay, pixels); await delay(220);
    assert.notEqual(await evaluate(overlay, pixels), a, `${scene.id} environment must animate`);
    await screenshot(overlay, `scene-${scene.id}.png`);
  }
  // Use the visible setting, then inspect real canvas pixels and the persisted value.
  await tab(studio, 'settings');
  await evaluate(studio, `(() => { const input = document.querySelector('#animationLevel'); input.value = '0'; input.dispatchEvent(new Event('change')); })()`);
  await until(overlay, `document.querySelector('#scene').dataset.motionStrength === '0'`);
  const staticPixels = `document.querySelector('#scene').getContext('2d').getImageData(320,445,440,330).data.reduce((sum, v, i) => (sum + v * (i % 13 + 1)) >>> 0, 0)`;
  const frozen = await evaluate(overlay, staticPixels); await delay(250);
  assert.equal(await evaluate(overlay, staticPixels), frozen, 'Motion off must freeze environment');
  await evaluate(studio, `(() => { const input = document.querySelector('#animationLevel'); input.value = '2'; input.dispatchEvent(new Event('change')); })()`);
  await until(overlay, `document.querySelector('#scene').dataset.motionStrength === '1'`);
  const reduced = await page('about:blank', 540, 960);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, reduced);
  await call('Page.navigate', { url: `${origin}/live/overlay.html?preview=1` }, reduced);
  await until(reduced, `document.querySelector('#scene')?.dataset.motionStrength === '0'`);
  command('settings', { settings: { animationLevel: 1 } });
  command('playback', { action: 'resume' });
  for (const ambient of AMBIENTS) { command('settings', { settings: { ambient: ambient.id } }); await until(overlay, `document.body.dataset.ambientPreset === ${JSON.stringify(ambient.id)}`); }
  command('fill', { n: 100 }); await delay(700);
  await until(studio, `document.querySelector('#guestCount').textContent === '100'`);
  await screenshot(overlay, 'overlay-100-guests.png');
  command('settings', { settings: { seatLimit: 200 } }); command('fill', { n: 200 });
  await until(studio, `document.querySelector('#guestCount').textContent === '200'`);
  await delay(1300);
  for (let i = 0; i < 8; i++) command('chat', { name: 'Trò chuyện ' + i, text: 'Một câu chuyện dài để kiểm tra bình luận không chồng lên nhau số ' + i });
  await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.bubbleBoxes || '[]').length > 1`);
  const boxes = await evaluate(overlay, `JSON.parse(document.querySelector('#scene').dataset.bubbleBoxes)`);
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => assert.equal(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y, false, 'Speech bubbles overlap')));
  await screenshot(overlay, 'overlay-200-guests.png'); await screenshot(studio, 'studio-v2.png');
  await tab(studio, 'stage');
  await call('Page.bringToFront', {}, overlay);
  for (const count of [50, 100]) {
    await evaluate(studio, `(() => { const input = document.querySelector('#stageCapacity'); input.value = '${count}'; input.dispatchEvent(new Event('change')); document.querySelector('#fillStage').click(); })()`);
    await until(studio, `document.querySelector('#stageCount').textContent === '${count} / ${count}'`);
    await until(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions || '[]').filter(a => a.onStage).length === ${count}`);
    await delay(1600);
    const actors = await evaluate(overlay, `JSON.parse(document.querySelector('#scene').dataset.actorPositions).filter(a => a.onStage)`);
    assert.ok(actors.every(a => a.x > 100 && a.x < 980 && a.y >= 990 && a.y < 1340));
    assert.ok(new Set(actors.map(a => Math.round(a.y))).size > 2);
    await screenshot(overlay, `overlay-stage-${count}.png`);
  }
  await evaluate(studio, `(() => { const input = document.querySelector('#stageCapacity'); input.value = '8'; input.dispatchEvent(new Event('change')); })()`);
  await until(studio, `document.querySelector('#stageCount').textContent === '8 / 8'`);
  for (const name of ['live', 'music', 'stage', 'voice', 'settings']) {
    await tab(studio, name);
    assert.equal(await evaluate(studio, `document.querySelectorAll('[data-panel]:not([hidden])').length`), 1);
    assert.equal(await evaluate(studio, `document.documentElement.scrollHeight <= innerHeight + 1`), true);
    await screenshot(studio, `studio-tab-${name}.png`);
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false }, studio);
  await tab(studio, 'live');
  assert.equal(await evaluate(studio, `document.documentElement.scrollHeight <= innerHeight + 1`), true, 'Laptop layout must not require document scrolling');
  await screenshot(studio, 'studio-compact-laptop.png');
  await evaluate(studio, `document.querySelector('[data-tab="live"]').focus()`);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, studio);
  await until(studio, `document.querySelector('[data-tab="music"]').getAttribute('aria-selected') === 'true'`);
  const mobile = await page(origin, 390, 844);
  await until(mobile, `document.querySelector('#guestCount')?.textContent === '200'`);
  await until(mobile, `document.querySelector('#preview').contentDocument.querySelector('#overlayDemo')?.textContent === '200 DEMO'`);
  assert.equal(await evaluate(mobile, `document.documentElement.scrollWidth <= innerWidth`), true, 'Mobile has horizontal overflow');
  await screenshot(mobile, 'studio-mobile.png');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  // Restart proves that settings and saved lines survive a real process exit.
  control.terminate(); server.kill(); await once(server, 'exit'); server = launch();
  await until(studio, `document.querySelector('#serverStatus').textContent === 'Server đang chạy' && document.querySelector('#guestCount').textContent === '0'`);
  assert.equal(await evaluate(studio, `document.querySelector('#seatLimit').value`), '200');
  assert.equal(await evaluate(studio, `document.querySelector('#libraryStatus').textContent.startsWith('2/')`), true);
  assert.equal(await evaluate(studio, `document.querySelector('#animationLevel').value`), '1');
  assert.ok((await evaluate(studio, `document.querySelector('#reaction-rose').value`)).includes('Bạn {name} ơi'));
  assert.equal(await evaluate(studio, `[...document.querySelectorAll('#savedLines button')].some(b => b.textContent.includes('Chào Bách'))`), true);
  if (cachedVoice) {
    // The dashboard reconnecting does not mean the separate audio window is connected yet.
    // Wait for that socket before a real user click can send the audio-owner request.
    await call('Page.bringToFront', {}, overlay);
    await until(overlay, `document.querySelector('#overlayConnection').textContent === 'SERVER ĐÃ KẾT NỐI'`);
    if (!await evaluate(overlay, `document.querySelector('#soundButton').hidden`)) await click(overlay, '#soundButton');
    await until(studio, `document.querySelector('#audioStatus').textContent.includes('ĐÃ BẬT')`);
    await tab(studio, 'voice');
    await evaluate(studio, `(() => { document.querySelector('#ttsStatus').dataset.cached = 'pending'; document.querySelector('#announcement').value = ${JSON.stringify(cachedVoice.text)}; document.querySelector('#say').click(); })()`);
    await until(studio, `document.querySelector('#ttsStatus').dataset.cached === 'true'`);
    await until(overlay, `document.querySelector('#voiceAudio').currentSrc === ${JSON.stringify(cachedVoice.src)} && document.querySelector('#voiceAudio').currentTime > .15 && !document.querySelector('#voiceAudio').paused`);
    assert.equal(await evaluate(overlay, `document.body.dataset.speechSource`), cachedVoice.source);
    await evaluate(studio, `document.querySelector('#stopSpeech').click()`);
    console.log('LIVE TTS PASS: cached MP3 and its actual voice source survive a server restart.');
  }
  console.log('UI PASS: hidden overlay and conveyor stay animated, native 1080x1920 silent capture, follow, avatars, 50/100 stage slots, all 10 scenes, 200 seats and audio controls; zero runtime errors.');
  console.log(`Screenshots: ${artifacts}`);
} finally {
  control?.terminate(); cdp?.terminate();
  for (const pending of calls.values()) clearTimeout(pending.timer);
  if (chrome && chrome.exitCode === null) { chrome.kill(); await Promise.race([once(chrome, 'exit'), delay(3000)]); }
  if (server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  fs.unlinkSync(fixturePath);
  fs.unlinkSync(votePath);
  // Temporary Chrome profile stays under the OS temp directory for OS cleanup.
}
