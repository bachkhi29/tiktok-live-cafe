import { CafeAudio } from './audio-engine.js';
import { SCENES } from './presets.js';
import { drawSpace, getStageTargets } from './scene-renderer.js';
import { placeBubbles } from './bubble-layout.js';
import { characterPose, headAnchor, motionSeed, motionStrength, armTargets } from './motion.js';
import { startRenderLoop } from './render-loop.js';
const $ = id => document.getElementById(id), canvas = $('scene'), ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search), capture = params.has('capture');
const preview = params.has('preview') || capture, passivePreview = preview && !capture;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#d3a18c', '#b4a4cf', '#9db5a3', '#c99ab1', '#c7b581', '#8eb5c2'];
let ws, viewers = new Map(), settings = { scene: 'cafe', music: true, likeGoal: 200 }, community = { likes: 0, trees: 0, lightsUntil: 0 }, radio = { queue: [], catalog: [], playing: null };
let donations = { total: 0, demoTotal: 0, supporterCount: 0, leaderboard: [], demoLeaderboard: [] };
const number = value => Number(value || 0).toLocaleString('vi-VN');
let startedAt = Date.now(), particles = [], giftUntil = 0, audioOwner = false, wasAudioEnabled = false;
let followUntil = 0, followOverflow = 0;
const followQueue = [], avatarImages = new Map();
function avatarImage(path) {
  if (!/^\/live\/avatar\/[a-f0-9]{32}\.img$/.test(path || '')) return null;
  if (avatarImages.get(path)?.retryAt < Date.now()) avatarImages.delete(path);
  if (!avatarImages.has(path)) {
    const entry = { ready: false, image: new Image() }; entry.image.decoding = 'async'; entry.image.referrerPolicy = 'no-referrer';
    entry.image.onload = () => { entry.ready = entry.image.naturalWidth > 0; }; entry.image.onerror = () => { entry.ready = false; entry.retryAt = Date.now() + 30000; }; entry.image.src = path;
    avatarImages.set(path, entry); if (avatarImages.size > 512) avatarImages.delete(avatarImages.keys().next().value);
  }
  const entry = avatarImages.get(path); return entry?.ready ? entry.image : null;
}
function nextFollow() {
  const event = followQueue.shift();
  if (!event) { followUntil = 0; $('followBanner').classList.remove('visible'); return; }
  $('followHeading').textContent = event.demo ? 'FOLLOW THỬ · DEMO' : 'CẢM ƠN BẠN ĐÃ FOLLOW';
  $('followName').textContent = event.name; $('followMessage').textContent = event.text; $('followMessage').title = event.text;
  $('followInitial').textContent = event.name.trim().slice(0, 1).toLocaleUpperCase();
  const image = $('followAvatar'); image.hidden = true; image.onload = () => { image.hidden = false; }; image.onerror = () => { image.hidden = true; };
  if (/^\/live\/avatar\/[a-f0-9]{32}\.img$/.test(event.avatar || '')) image.src = event.avatar; else image.removeAttribute('src');
  $('followPending').textContent = followQueue.length + followOverflow ? `+${followQueue.length + followOverflow} follow` : '';
  followUntil = Date.now() + 5500; $('followBanner').classList.add('visible');
}
function fit() { $('stage').style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / 1080, innerHeight / 1920)})`; }
addEventListener('resize', fit); fit();
if (preview) $('soundButton').hidden = true;
function send(message) { if (ws?.readyState === 1) ws.send(JSON.stringify(message)); }
function updateViewer(v) {
  const old = viewers.get(v.id); viewers.set(v.id, { x: 1100, y: 1300, seed: motionSeed(v.id), ...old, ...v }); updateCount();
}
function updateCount() {
  const demos = [...viewers.values()].filter(v => v.demo).length;
  $('overlayCount').textContent = `${viewers.size - demos} khách thật · ${viewers.size}/${settings.seatLimit || 100} ghế`;
  $('overlayDemo').hidden = !demos; $('overlayDemo').textContent = `${demos} DEMO`;
}
function updateSettings(value) {
  settings = value;
  document.title = `${value.title} · Overlay LIVE`;
  const title = $('overlayTitle'); title.textContent = value.title;
  title.style.fontSize = value.title.length > 23 ? '46px' : '68px';
  const dot = document.createElement('span'); dot.textContent = '.'; title.append(dot);
  $('overlaySubtitle').textContent = value.subtitle;
  const scene = SCENES.find(s => s.id === value.scene) || SCENES[0];
  $('sceneCaption').textContent = scene.name.toLocaleUpperCase(); $('stage').style.setProperty('--scene-accent', scene.accent);
  $('performanceGuide').textContent = value.freeStage ? 'Vào LIVE là có nhân vật và chỗ ngồi ☕' : 'Vào LIVE có chỗ ngồi · sân khấu cần quà hoặc chủ quán mời';
  updateCommunity(community); updateDonations(donations); audio.setSettings(settings); updateRadio(radio); updateCount();
}
function updateDonations(value) {
  donations = value;
  const target = settings.giftGoal || 1000, progress = Math.min(100, value.total / target * 100);
  const demo = !value.leaderboard.length && value.demoLeaderboard.length > 0;
  $('supportRankMode').textContent = demo ? 'DEMO' : 'QUÀ THẬT';
  const list = $('supportRank'); list.replaceChildren();
  const entries = demo ? value.demoLeaderboard : value.leaderboard;
  if (!entries.length) { const empty = document.createElement('li'); empty.className = 'support-empty'; empty.textContent = 'Chưa có quà. Cùng ngồi lại và trò chuyện ☕'; list.append(empty); }
  entries.forEach((v, i) => {
    const row = document.createElement('li'), rank = document.createElement('span'), name = document.createElement('span'), coins = document.createElement('b');
    rank.className = 'support-rank-number'; rank.textContent = i + 1;
    name.className = 'support-rank-name'; name.textContent = `${v.name}${demo ? ' · DEMO' : ''}`;
    coins.textContent = number(v.coins); row.append(rank, name, coins); list.append(row);
  });
  $('supportGoalTitle').textContent = settings.giftGoalTitle || 'Cùng thắp sáng quán';
  $('supportGoalAmount').textContent = `${number(value.total)} / ${number(target)} KC`;
  $('supportGoalState').textContent = value.total >= target ? 'Đã đạt ✓' : 'Góp sức';
  $('supportGoalPercent').textContent = `${Math.floor(progress)}%`;
  $('supportGoalFill').style.width = `${progress}%`; $('supportGoalBar').setAttribute('aria-valuenow', Math.floor(progress));
  $('supportGoalDemo').hidden = $('supportDemoBar').hidden = !value.demoTotal;
  $('supportGoalDemo').textContent = `THỬ · ${number(value.demoTotal)} / ${number(target)} KC`;
  $('supportDemoFill').style.width = `${Math.min(100, value.demoTotal / target * 100)}%`;
}
function updateCommunity(value) {
  community = value;
  $('partyStatus').textContent = value.performers?.length ? `${value.performers.length}/${settings.stageCapacity || 5} BIỂU DIỄN · ${value.stageQueue?.length || 0} CHỜ LƯỢT` : 'CHỦ QUÁN ĐANG BIỂU DIỄN';
}
function updateRadio(value) {
  radio = value; $('overlayTrack').textContent = value.playing ? `${value.paused ? 'Ⅱ ' : '♫ '}${value.playing.title} · ${value.playing.name}${value.playing.demo ? ' [DEMO]' : ''}` : 'Nhạc nền của quán';
  audio.setRadio(value);
  renderPublicQueue(); renderCatalogCodes();
}
function renderPublicQueue() {
  const root = $('publicQueue'); root.replaceChildren();
  const maxVotes = Math.max(1, ...radio.queue.map(q => q.votes || 0));
  for (const [i, item] of radio.queue.slice(0, 3).entries()) {
    const li = document.createElement('li'), fill = document.createElement('i');
    fill.style.width = `${(item.votes || 0) / maxVotes * 100}%`; li.append(fill); li.dataset.trackId = item.id;
    for (const label of [String(i + 1), `!nhac ${item.id}`, `${item.manualRank ? '📌 ' : ''}${item.title}`]) { const span = document.createElement('span'); span.textContent = label; li.append(span); }
    const count = document.createElement('b'); count.textContent = settings.musicVoting ? `${item.votes || 0} người${item.demoVotes ? ` · ${item.demoVotes} thử` : ''}` : `${item.priority} KC`;
    li.append(count); root.append(li);
  }
  if (!radio.queue.length) { const li = document.createElement('li'); li.className = 'queue-empty'; li.textContent = 'Chưa có ai chọn bài · xem mã bên dưới'; root.append(li); }
  $('queueRule').textContent = !settings.ordersOpen ? 'TẠM ĐÓNG NHẬN BÀI' : settings.musicVoting ? 'Mỗi người 1 phiếu' : `Order từ ${settings.songMinGift} KC`;
  $('orderInstruction').textContent = '';
  if (radio.catalog.length && settings.ordersOpen) {
    $('orderInstruction').append('Bình luận ', Object.assign(document.createElement('strong'), { textContent: '!nhac + MÃ' }), ' để order bài hát tiếp theo');
  } else $('orderInstruction').textContent = !radio.catalog.length ? 'Chủ quán chưa thêm bài hát' : 'Chủ quán đang tạm đóng nhận order';
  $('orderExample').textContent = radio.catalog.length && settings.ordersOpen ? `Ví dụ: !nhac ${radio.catalog[0].id} · không gõ dấu +` : '';
  $('queueSummary').textContent = `${radio.queue.length > 3 ? `Còn ${radio.queue.length - 3} bài · ` : ''}${settings.musicVoting ? 'Ưu tiên: ghim → số người chọn → quà phá hòa' : 'Ưu tiên: ghim → giá trị quà → bài đến trước'}`;
}
let catalogSignature = '', catalogBelt = null, catalogWidth = 0, catalogStarted = 0;
function renderCatalogCodes() {
  const signature = JSON.stringify(radio.catalog.map(t => [t.id, t.title])); if (signature === catalogSignature) return; catalogSignature = signature;
  const root = $('catalogCodes'); root.replaceChildren();
  catalogBelt = null; catalogWidth = 0;
  const belt = document.createElement('div'), group = document.createElement('div'); belt.className = 'catalog-belt'; group.className = 'catalog-group';
  for (const track of radio.catalog) {
    const span = document.createElement('span'), code = document.createElement('b'); code.textContent = `!nhac ${track.id} `;
    span.append(code, document.createTextNode(track.title)); span.title = track.title; group.append(span);
  }
  if (!radio.catalog.length) { root.textContent = 'Chủ quán chưa thêm file nhạc.'; return; }
  const duplicate = group.cloneNode(true); duplicate.setAttribute('aria-hidden', 'true'); belt.append(group, duplicate); root.append(belt);
  catalogBelt = belt; catalogStarted = performance.now(); belt.style.animation = 'none';
  const pace = () => { if (belt.isConnected) catalogWidth = group.scrollWidth; };
  requestAnimationFrame(pace); document.fonts.ready.then(pace);
}
function updateTikTok(value) {
  const labels = { connected: '● ĐANG LIVE', connecting: 'ĐANG KẾT NỐI', reconnecting: 'ĐANG NỐI LẠI', idle: 'CHƯA NỐI TIKTOK', error: 'LỖI KẾT NỐI', disconnected: 'MẤT KẾT NỐI' };
  $('liveBadge').textContent = labels[value.status] || 'CHƯA NỐI TIKTOK';
  $('liveBadge').style.color = value.status === 'connected' ? '#b5d8b9' : '#dcc8d5';
}
function burst(id, kind = 'heart', count = 12) {
  const v = viewers.get(id), x = v?.x || 540, y = v?.y || 1130;
  for (let i = 0; i < Math.min(count, 35); i++) particles.push({ x: x + (Math.random() - .5) * 110, y, vx: (Math.random() - .5) * 65, vy: -65 - Math.random() * 90, age: 0, life: 2 + Math.random() * 2, kind });
  if (particles.length > 150) particles.splice(0, particles.length - 150);
}
function connect() {
  ws = new WebSocket(`ws://${location.host}/ws?role=overlay`);
  ws.onopen = () => { $('overlayConnection').textContent = preview ? 'XEM TRƯỚC · TẮT ÂM THANH' : 'SERVER ĐÃ KẾT NỐI'; if (wasAudioEnabled && !preview) send({ t: 'audio', enabled: true }); };
  ws.onclose = () => { audioOwner = false; audio.setOwner(false); updateTikTok({ status: 'disconnected' }); $('overlayConnection').textContent = 'SERVER MẤT KẾT NỐI'; setTimeout(connect, 2000); };
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.t === 'state') {
      viewers.clear(); m.viewers.forEach(updateViewer); updateCount(); startedAt = m.startedAt;
      updateSettings(m.settings); updateCommunity(m.community); updateRadio(m.radio); updateDonations(m.donations); if (m.tiktok) updateTikTok(m.tiktok);
    }
    if (m.t === 'settings') updateSettings(m.settings);
    if (m.t === 'tiktok') updateTikTok(m);
    if (m.t === 'join' || m.t === 'viewer') updateViewer(m.v);
    if (m.t === 'leave') { viewers.delete(m.id); updateCount(); }
    if (m.t === 'chat') { const v = viewers.get(m.id); if (v) { v.lastText = m.text; v.chatUntil = m.until; } }
    if (m.t === 'like') burst(m.id, 'heart', Math.min(m.n, 12));
    if (m.t === 'effect') burst(m.id, m.kind, 8);
    if (m.t === 'community') updateCommunity(m);
    if (m.t === 'donations') updateDonations(m);
    if (m.t === 'goalReached') {
      $('giftBanner').querySelector('small').textContent = 'CẢ QUÁN CÙNG ĐẠT MỤC TIÊU';
      $('giftName').textContent = 'ĐẠT MỤC TIÊU ✦'; $('giftDetail').textContent = `${m.title} · ${number(m.total)} KC`;
      giftUntil = Date.now() + 8000; $('giftBanner').classList.add('visible'); burst('', 'spark', 35);
    }
    if (m.t === 'radio') updateRadio(m);
    if (m.t === 'gift') {
      $('giftBanner').querySelector('small').textContent = m.demo ? 'QUÀ THỬ · DEMO' : 'CẢM ƠN BẠN ĐÃ TẶNG QUÀ';
      const v = viewers.get(m.id); if (v) v.coins = m.total;
      $('giftName').textContent = `${m.name}${m.demo ? ' · DEMO' : ''}`;
      $('giftDetail').textContent = `${m.giftName} ×${m.count} · ${m.danceTurns ? `+${m.danceTurns} lượt nhảy ♫${v ? '' : ' · Bình luận để nhận lượt'}` : ['', 'Mời một ly ☕', 'Cả quán sáng lên ✧', 'Quà đã ghi nhận ♫'][m.tier]}`;
      giftUntil = Date.now() + 6500; $('giftBanner').classList.add('visible'); burst(m.id, 'spark', m.tier * 10);
    }
    if (m.t === 'follow') {
      if (followQueue.length < 8) followQueue.push(m); else followOverflow++;
      if (!followUntil) nextFollow(); else $('followPending').textContent = `+${followQueue.length + followOverflow} follow`;
      burst(m.id, 'music', 14);
    }
    if (m.t === 'audioOwner') {
      audioOwner = m.owner; wasAudioEnabled = m.owner; $('soundButton').hidden = preview || m.owner; audio.setOwner(m.owner);
    }
    if (m.t === 'tts') audio.enqueueSpeech(m.url, m);
    if (m.t === 'ttsFallback') audio.enqueueFallback(m);
    if (m.t === 'stopSpeech') audio.stopSpeech();
  };
}
connect();

const audio = new CafeAudio(send, message => { $('soundButton').hidden = preview; $('soundButton').textContent = message; wasAudioEnabled = false; }, preview);
$('soundButton').onclick = () => audio.enable();
addEventListener('pagehide', () => audio.close());

function rect(x, y, w, h, color, radius = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
function ellipse(x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function line(points, color, width = 3) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
function text(value, x, y, size, color = '#e9dcc9', align = 'center') { ctx.fillStyle = color; ctx.font = `500 ${size}px "Be Vietnam Pro",sans-serif`; ctx.textAlign = align; ctx.fillText(value, x, y); }
function glow(x, y, radius, color) { const g = ctx.createRadialGradient(x, y, 1, x, y, radius); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); }
function plant(x, y, scale = 1, color = '#647e68', sway = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.save(); ctx.rotate(sway);
  line([[0, 0], [-4, -62]], '#6d866d', 4);
  for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(-3, -15 - i * 10); ctx.rotate((i % 2 ? 1 : -1) * .75); ellipse(i % 2 ? 12 : -12, -4, 19, 7, color); ctx.restore(); }
  ctx.restore(); rect(-18, -4, 36, 32, '#af806b', 6); rect(-21, -6, 42, 8, '#cc9a7c', 3); ctx.restore();
}
function cup(x, y, type = 'latte', scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(0, 8, 21, 6, '#ac8d7988'); line([[13, -8], [22, -8], [23, 1], [14, 3]], '#e2c8aa', 4);
  rect(-14, -15, 29, 22, type === 'tra' ? '#c7a56c' : type === 'cacao' ? '#b78c7d' : '#e0c8ad', 5);
  ellipse(0, -14, 13, 4, type === 'den' ? '#3b2927' : '#bd957c');
  if (type === 'latte') text('♥', 0, -10, 11, '#f4dfbf');
  ctx.restore();
}
function steam(x, y, scale, time, strength) {
  if (!strength) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  for (let j = 0; j < 2; j++) {
    const progress = ((time * .24 + j * .5 + x * .013) % 1);
    ctx.globalAlpha = Math.sin(progress * Math.PI) * .28 * strength;
    const drift = Math.sin(time * 1.2 + j) * 5 * strength, top = -20 - progress * 32;
    ctx.strokeStyle = '#f7e8d9'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-5 + j * 9, top + 12); ctx.bezierCurveTo(-12 + drift + j * 9, top + 7, 7 + drift + j * 9, top + 4, j * 9 + drift, top - 3); ctx.stroke();
  }
  ctx.restore();
}
function character(x, y, scale, skin, pose, drink, profile) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(0, 8, 33, 9, '#0004');
  ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation);
  ctx.scale(pose.facing || 1, 1);
  line([[-10, -8], [-14 - pose.step * .4, 13 - Math.max(0, pose.step) * .5], [-23 - pose.step, 14 - Math.max(0, pose.step) * .5]], '#36333f', 11);
  line([[10, -8], [14 - pose.step * .4, 13 + Math.min(0, pose.step) * .5], [24 - pose.step, 14 + Math.min(0, pose.step) * .5]], '#36333f', 11);
  rect(-25, -52, 50, 48, COLORS[skin % 6], 15);
  const arms = pose.arms || armTargets(pose);
  for (const [side, arm] of [[-1, arms.left], [1, arms.right]]) {
    line([[side * 21, -40], [arm[0], arm[1]], [arm[2], arm[3]]], COLORS[skin % 6], 9);
    ellipse(arm[2], arm[3], 5, 5, '#e1b69b');
  }
  // Pivot the whole face/hair around the neck so the bubble can use the same transform.
  ctx.save(); ctx.translate(0, -54); ctx.rotate(pose.headTilt); ctx.translate(0, 54);
  ellipse(0, -74, 26, 29, '#e1b69b');
  ellipse(0, -91, 27, 16, skin % 2 ? '#42343c' : '#332d35');
  if (skin % 2) { ellipse(-24, -76, 6, 22, '#42343c'); ellipse(24, -76, 6, 22, '#42343c'); }
  ellipse(-9, -74, 2.2, 2.7 * pose.eyes, '#48343b'); ellipse(9, -74, 2.2, 2.7 * pose.eyes, '#48343b');
  if (pose.mouth) ellipse(0, -62, 3.3, 1 + pose.mouth * 3, '#9b6261');
  else line([[-4, -63], [0, -61], [5, -63]], '#9b6261', 2);
  ellipse(-15, -67, 5, 3, '#d5988c88'); ellipse(15, -67, 5, 3, '#d5988c88');
  if (skin === 4) { line([[-22, -83], [24, -83]], '#cfb17a', 7); ellipse(0, -91, 24, 11, '#cfb17a'); }
  if (skin === 5) { line([[-28, -80], [-30, -64]], '#a2c4cc', 7); line([[28, -80], [30, -64]], '#a2c4cc', 7); }
  if (profile && settings.viewerAvatars !== false) {
    ellipse(0, -76, 29, 29, COLORS[skin % 6]);
    const image = avatarImage(profile.avatar); profile.avatarLoaded = !!image;
    ctx.save(); ctx.beginPath(); ctx.arc(0, -76, 28, 0, Math.PI * 2); ctx.clip();
    if (image) { const size = Math.min(image.naturalWidth, image.naturalHeight); ctx.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, -28, -104, 56, 56); }
    else { const parts = profile.name.trim().split(/\s+/); text((parts[0]?.[0] || '') + (parts.length > 1 ? parts.at(-1)[0] : ''), 0, -68, 23, '#292331'); }
    ctx.restore(); ctx.strokeStyle = '#f3d7b9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -76, 29, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  if (pose.mode === 'sing') {
    const [,,hx,hy] = arms.right;
    line([[hx, hy - 2], [hx + 6, hy + 14]], '#aeb9ca', 5); ellipse(hx - 2, hy - 7, 7, 9, '#202333'); line([[hx - 6, hy - 9], [hx + 2, hy - 9]], '#78869b', 2);
    line([[hx + 6, hy + 14], [31, -18], [17, 2]], '#393540', 1.4);
  }
  if (pose.mode === 'ribbon') {
    for (const [side, arm, color, hand] of [[-1, pose.leftArm, '#e8a7ce', arms.left], [1, -pose.rightArm, '#91d3da', arms.right]]) {
      const handX = hand[2], handY = hand[3];
      line([[handX, handY], [handX + side * 9, handY - 14]], '#f5dfb2', 2);
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(handX + side * 9, handY - 14);
      ctx.bezierCurveTo(handX + side * 52, handY - 45 - arm, handX + side * 65, handY + 38, handX + side * 24, handY + 44); ctx.stroke();
    }
  }
  if (pose.sip > .08) cup(6 - pose.sip * 12, -13 - pose.sip * 44, drink, .6);
  ctx.restore();
}
function background(time, now, strength) {
  drawSpace(ctx, time, now, settings, community, { rect, ellipse, line, text, glow, plant, cup, steam }, strength);
}
function measureBubble(v, scale) {
  const font = settings.bubbleFont || 24, width = settings.bubbleWidth || 300, lines = []; let current = '';
  ctx.font = `500 ${font}px "Be Vietnam Pro",sans-serif`;
  for (const char of [...v.lastText.slice(0, 110)]) { if (ctx.measureText(current + char).width > width - 28 && current) { lines.push(current); current = char; } else current += char; }
  if (current) lines.push(current); const count = v.onStage ? 2 : 3, shown = lines.slice(0, count); if (lines.length > count) shown[count - 1] = shown[count - 1].slice(0, -1) + '…';
  const { anchorX, anchorY } = headAnchor(v.x, v.y, scale, v.pose);
  return { id: v.id, name: v.name, font, lines: shown, onStage: v.onStage, w: Math.min(width, Math.max(110, ...shown.map(t => ctx.measureText(t).width + 28))), h: shown.length * (font + 5) + 36, anchorX, anchorY };
}
function paintBubble(b) {
  rect(b.x, b.y, b.w, b.h, '#f4e6d3f7', 11); text(b.name.slice(0, 18), b.x + 12, b.y + 18, 13, '#936d6a', 'left');
  b.lines.forEach((t, i) => text(t, b.x + 14, b.y + 37 + i * (b.font + 5), b.font, '#45353e', 'left'));
}
let last = 0;
let bubbleObstacles = [];
function readBubbleObstacles() {
  const root = $('stage').getBoundingClientRect(), scale = root.width / 1080;
  bubbleObstacles = [...document.querySelectorAll('#interactionGuide,#radioQueueCard,.support-ranking,.support-goal,#giftBanner.visible')].map(n => {
    const r = n.getBoundingClientRect(); return { x: (r.x - root.x) / scale, y: (r.y - root.y) / scale, w: r.width / scale, h: r.height / scale };
  });
}
setInterval(readBubbleObstacles, 200);
function frame(milliseconds) {
  // Studio preview shares a machine with the full overlay; avoid drawing both at 60 fps.
  if ((passivePreview && document.hidden) || milliseconds - last < (preview || document.hidden ? 1000 / 30 : 1000 / 60) - 1) return;
  const time = milliseconds / 1000, dt = Math.min(.05, (milliseconds - last) / 1000 || .016), now = Date.now(); last = milliseconds;
  const strength = motionStrength(settings, reduceMotion); document.body.dataset.motion = strength ? 'on' : 'off';
  if (catalogBelt && catalogWidth && strength) catalogBelt.style.transform = `translate3d(-${((milliseconds - catalogStarted) / 1000 * 65) % catalogWidth}px,0,0)`;
  canvas.dataset.renderFrame = String((Number(canvas.dataset.renderFrame) || 0) + 1);
  canvas.dataset.renderHidden = String(document.hidden);
  background(time, now, strength); canvas.dataset.motionStrength = strength;
  const list = [...viewers.values()], slots = Math.max(12, list.length);
  const columns = slots <= 24 ? 4 : slots <= 36 ? 6 : slots <= 64 ? 8 : slots <= 100 ? 10 : slots <= 150 ? 12 : 14;
  const rows = Math.ceil(slots / columns), gap = 880 / columns, rowGap = rows > 1 ? 190 / (rows - 1) : 100;
  const scale = Math.min(.9, 3.5 / columns, rowGap / 100);
  const targets = getStageTargets(community.performers || []), actors = [], expanded = targets.size > 4;
  document.body.classList.toggle('expanded-stage', expanded);
  const seated = new Map(list.filter(v => !targets.has(v.id)).map((v, i) => [v.id, i]));
  const bubbles = [];
  for (let i = 0; i < slots; i++) {
    let x = 100 + gap / 2 + i % columns * gap, y = 1140 + Math.floor(i / columns) * rowGap;
    const v = list[i];
    if (!v) { if (!expanded) { ellipse(x, y + 12, 35 * scale, 9 * scale, '#ba8a7140'); line([[x, y + 10], [x, y + 36]], '#8f6e5d55', 4); } continue; }
    const wingGap = 270 / Math.max(1, Math.ceil(seated.size / 2) - 1);
    if (expanded && seated.has(v.id)) { const index = seated.get(v.id); x = index % 2 ? 1020 : 60; y = 1050 + Math.floor(index / 2) * wingGap; }
    const target = targets.get(v.id) || { x, y: y - 10 * scale, scale: expanded ? Math.min(.32, wingGap / 120) : scale };
    v.onStage = targets.has(v.id); v.drawScale ??= scale;
    const speed = strength ? Math.min(1, dt * 5) : 1;
    v.x += (target.x - v.x) * speed; v.y += (target.y - v.y) * speed; v.drawScale += (target.scale - v.drawScale) * speed;
    v.dancing = v.onStage && Math.hypot(target.x - v.x, target.y - v.y) < 8;
    const moving = Math.hypot(target.x - v.x, target.y - v.y) > 8;
    const crowdBeat = strength ? (Math.floor(time / 6) + v.seed) % 9 : 8;
    const idleActivity = v.chatUntil > now ? 'idle' : crowdBeat === 0 ? 'clap' : crowdBeat === 1 ? 'wave' : 'idle';
    v.pose = characterPose(time, target.partnerId ? motionSeed([v.id, target.partnerId].sort().join(':')) : v.seed,
      moving ? 'walk' : v.dancing ? target.activity : v.gestureUntil > now ? v.gesture : idleActivity, v.chatUntil > now, strength, target.style);
    const arms = armTargets(v.pose), blend = strength ? Math.min(1, dt * 10) : 1;
    v.armPose ??= structuredClone(arms);
    for (const side of ['left', 'right']) v.armPose[side] = v.armPose[side].map((value, k) => value + (arms[side][k] - value) * blend);
    v.pose.arms = v.armPose;
    if (target.partnerId && !moving) v.pose.facing = target.facing;
    v.activity = target.activity; v.partnerId = target.partnerId;
    actors.push(v);
    if (expanded) continue;
    rect(x - 32 * scale, y - 40 * scale, 64 * scale, 60 * scale, '#745b5366', 13 * scale);
    if (v.onStage) text('♫', x, y - 28 * scale, 22 * scale, '#e9bca0');
    ellipse(x, y + 17 * scale, 48 * scale, 14 * scale, '#a97b65'); ellipse(x, y + 11 * scale, 48 * scale, 13 * scale, '#bb9177');
    line([[x, y + 25 * scale], [x, y + 43 * scale]], '#825e54', 5 * scale);
    if (v.onStage || v.pose.sip <= .08) cup(x + 12 * scale, y + 8 * scale, v.drink, .65 * scale);
    if (i < 24 && !v.onStage && v.pose.sip <= .08) steam(x + 12 * scale, y - 2 * scale, .65 * scale, time, strength);
  }
  const hostTime = strength ? time : 0;
  const hostOnStage = !targets.size, hostPose = characterPose(hostTime, 61, hostOnStage ? ['sing', 'dance', 'ribbon'][Math.floor(hostTime / 14) % 3] : 'wave', false, strength, Math.floor(hostTime / 10) % 6);
  character(540, hostOnStage ? 931 : 858, hostOnStage ? 1.1 : .48, 5, hostPose, 'latte');
  text(hostOnStage ? 'CHỦ QUÁN · BIỂU DIỄN TỰ ĐỘNG' : 'CHỦ QUÁN', 540, hostOnStage ? 971 : 878, hostOnStage ? 14 : 9, '#f1c6a2');
  actors.sort((a, b) => a.y - b.y).forEach(v => {
    const s = v.drawScale;
    if (v.coins) glow(v.x, v.y - 30, 55 * s, '#eeb69a1c');
    character(v.x, v.y, s, v.skin, v.pose, v.drink, v);
    const name = `${v.name.slice(0, v.onStage ? expanded ? 6 : 8 : columns > 6 ? 9 : 15)}${v.demo ? ' · D' : ''}`;
    if (v.onStage || columns <= 10 || v.coins || v.chatUntil > now) text(name, v.x, v.y + 38 * s, v.onStage ? expanded ? Math.max(8, 18 * s) : 14 : Math.max(10, 23 * s), v.coins ? '#edc3a1' : '#d3c1bc');
    if (v.lastText && v.chatUntil > now && !(settings.hideCommands && v.lastText.startsWith('!'))) bubbles.push(v);
  });
  const candidates = bubbles.sort((a, b) => Number(b.onStage) - Number(a.onStage) || b.chatUntil - a.chatUntil).slice(0, 30).map(v => {
    const bubble = measureBubble(v, v.drawScale);
    if (expanded && v.onStage) bubble.bounds = { x: 295, y: 740, w: 490, h: 175 };
    return bubble;
  });
  const boxes = placeBubbles(candidates, { x: 25, y: 740, w: 1030, h: 635 }, Math.min(settings.bubbleLimit || 3, expanded ? 2 : 8), 10, bubbleObstacles);
  boxes.forEach(b => line([[b.anchorX, b.anchorY], [b.x + b.w / 2, b.y + b.h]], '#dfc9b299', 2));
  boxes.forEach(paintBubble); canvas.dataset.bubbleBoxes = JSON.stringify(boxes.map(({ id, x, y, w, h, anchorX, anchorY, onStage }) => ({ id, x, y, w, h, anchorX, anchorY, onStage })));
  canvas.dataset.actorPositions = JSON.stringify(actors.filter(v => v.onStage || v.chatUntil > now).map(v => ({ id: v.id, x: v.x, y: v.y, scale: v.drawScale, avatar: v.avatar || '', avatarLoaded: !!v.avatarLoaded, onStage: v.onStage, activity: v.activity, partnerId: v.partnerId, pose: v.pose })));
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.age += dt; if (p.age > p.life) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt * strength; p.y += p.vy * dt * strength;
    ctx.save(); ctx.globalAlpha = Math.min(1, p.life - p.age); text(p.kind === 'music' ? '♪' : p.kind === 'light' ? '✧' : p.kind === 'heart' ? '♥' : '✦', p.x, p.y, 30, p.kind === 'heart' ? '#e6a0b3' : '#f4cc95'); ctx.restore();
  }
  if (giftUntil && giftUntil < now) { $('giftBanner').classList.remove('visible'); giftUntil = 0; }
  if (followUntil && followUntil < now) { if (!followQueue.length && followOverflow) { followQueue.push({ name: `${followOverflow} bạn mới`, text: 'Cảm ơn các bạn đã follow kênh của mình nhé.' }); followOverflow = 0; } nextFollow(); }
}
const stopRendering = startRenderLoop(frame, { preview: passivePreview });
addEventListener('pagehide', stopRendering, { once: true });
setInterval(() => { const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000)); $('sessionTime').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`; }, 1000);
