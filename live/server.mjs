// Adapted from Kent Juno's MIT-licensed Chánh Điện Online.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { synthesizeVietnameseSpeech } from './vietnamese-speech.mjs';
import { AvatarStore } from './avatar-service.mjs';
import { liveUser, liveChatText } from './tiktok-events.mjs';
import { CafeRoom, clamp, normalizeGift } from './cafe.mjs';
import { DEMO_GIFTS } from './presets.js';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(DIR, '..');
const PORT = Number(process.env.PORT) || 3000;
const PROTOCOL_VERSION = 5;
const PHONE_MODE = process.env.CAFE_PHONE === '1';
const PHONE_KEY = PHONE_MODE ? randomBytes(12).toString('base64url') : '';
const privateIp = value => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(value);
const PHONE_IPS = PHONE_MODE ? [...new Set(Object.values(os.networkInterfaces()).flat().filter(value => value?.family === 'IPv4' && !value.internal && privateIp(value.address)).map(value => value.address))] : [];
const localPeer = value => /^(::1|127\.|::ffff:127\.)/.test(String(value || ''));
const phoneCookie = req => String(req.headers.cookie || '').split(/;\s*/).includes(`cafe_phone=${PHONE_KEY}`);
const TTS_DIR = path.join(DIR, 'tts'), RADIO_DIR = path.join(ROOT, 'assets', 'radio');
const DATA_DIR = process.env.CAFE_DATA_DIR || path.join(DIR, 'data'), CONFIG_FILE = path.join(DATA_DIR, 'studio.json');
fs.mkdirSync(TTS_DIR, { recursive: true }); fs.mkdirSync(RADIO_DIR, { recursive: true });
const logs = [];
const avatars = new AvatarStore();
let tiktokState = { status: 'idle', uniqueId: '_tuduylogic_', error: '' };
let connection = null, generation = 0, reconnectTimer = null, audioOwner = null, bots = null, uploadBusy = false;
let giftCatalog = { source: 'demo', gifts: DEMO_GIFTS };
const room = new CafeRoom(message => {
  broadcast(message.t === 'state' ? snapshot() : message);
  if (message.t === 'radio' && !room.playing && room.queue.length && audioOwner && !room.paused && room.settings.autoPlay) room.nextTrack();
});
function snapshot() { return { ...room.snapshot(), protocolVersion: PROTOCOL_VERSION, tiktok: tiktokState, bots: !!bots, audioReady: !!audioOwner, audioDevice: audioOwner?.device || '', giftCatalog }; }
function saveConfig() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CONFIG_FILE + '.tmp', JSON.stringify(room.exportConfig(), null, 2)); fs.renameSync(CONFIG_FILE + '.tmp', CONFIG_FILE); broadcast({ t: 'configSaved' }, 'control'); }
  catch (error) { log(`Không lưu được cài đặt: ${error.message}`); }
}
function log(text) {
  const line = `[${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}] ${text}`;
  logs.push(line); if (logs.length > 200) logs.shift();
  broadcast({ t: 'log', line }, 'control'); console.log(line);
}
function catalog() {
  const files = fs.readdirSync(RADIO_DIR, { withFileTypes: true }).filter(f => f.isFile() && /\.(mp3|wav|ogg|m4a)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi')).slice(0, 100)
    .map(f => ({ title: path.parse(f.name).name.slice(0, 80), url: `/assets/radio/${encodeURIComponent(f.name)}` }));
  room.setLibrary(files);
}
const ttsQueue = []; let ttsBusy = false, speechGeneration = 0, ttsAbort = null;
function say(text, prepare = false) {
  if (ttsQueue.length >= 10) return log('Hàng chờ giọng đọc đầy.');
  ttsQueue.push({ text: String(text).slice(0, 400), prepare, generation: speechGeneration, voice: room.settings.voice, pitch: room.settings.pitch, rate: room.settings.rate }); void pumpTTS();
}
async function pumpTTS() {
  if (ttsBusy || !ttsQueue.length) return;
  ttsBusy = true; const job = ttsQueue.shift(), { text, voice, pitch, rate } = job;
  const controller = new AbortController(); ttsAbort = controller;
  const filename = `tts_${createHash('sha256').update(JSON.stringify([text, voice, pitch, rate])).digest('hex').slice(0, 32)}.mp3`;
  const metadataPath = path.join(TTS_DIR, filename.replace(/\.mp3$/, '.json'));
  const deliver = metadata => {
    if (job.generation === speechGeneration && !job.prepare && audioOwner?.readyState === 1) audioOwner.send(JSON.stringify({ t: 'tts', url: `/live/tts/${filename}`, text, ...metadata }));
  };
  try {
    if (fs.existsSync(path.join(TTS_DIR, filename)) && fs.statSync(path.join(TTS_DIR, filename)).size > 0) {
      let metadata = { source: 'edge', playbackRate: 1 };
      try { const saved = JSON.parse(fs.readFileSync(metadataPath, 'utf8')); if (['edge', 'google'].includes(saved.source) && Number.isFinite(saved.playbackRate) && saved.playbackRate >= .5 && saved.playbackRate <= 1.5) metadata = { source: saved.source, playbackRate: saved.playbackRate }; } catch {}
      deliver(metadata); broadcast({ t: 'ttsReady', text, cached: true, source: metadata.source }, 'control'); return;
    }
    broadcast({ t: 'speechStatus', status: 'generating' }, 'control');
    const { audio, source, playbackRate } = await synthesizeVietnameseSpeech(job, { signal: controller.signal, onFallback: error => {
      log(`Edge chưa tạo được giọng: ${error.message} Đang chuyển sang giọng Việt dự phòng Google.`);
      broadcast({ t: 'speechStatus', status: 'fallbackGenerating' }, 'control');
    } });
    if (job.generation !== speechGeneration || controller.signal.aborted) return;
    fs.writeFileSync(path.join(TTS_DIR, filename), audio);
    const metadata = { source, playbackRate }; fs.writeFileSync(metadataPath, JSON.stringify(metadata));
    deliver(metadata); broadcast({ t: 'ttsReady', text, cached: false, source }, 'control');
    const files = fs.readdirSync(TTS_DIR).filter(f => /^tts_[a-f0-9]{32}\.mp3$/.test(f)).map(f => ({ f, time: fs.statSync(path.join(TTS_DIR, f)).mtimeMs })).sort((a, b) => b.time - a.time);
    for (const old of files.slice(120)) { fs.unlinkSync(path.join(TTS_DIR, old.f)); const meta = path.join(TTS_DIR, old.f.replace(/\.mp3$/, '.json')); if (fs.existsSync(meta)) fs.unlinkSync(meta); }
  } catch (error) {
    if (error.name === 'AbortError') return;
    log(`Chưa tạo được giọng trực tuyến: ${error.message}`); broadcast({ t: 'ttsFailed', text }, 'control');
    if (job.generation === speechGeneration && !job.prepare && audioOwner?.readyState === 1) audioOwner.send(JSON.stringify({ t: 'ttsFallback', text, pitch, rate, voice }));
  }
  finally { if (ttsAbort === controller) ttsAbort = null; ttsBusy = false; if (ttsQueue.length) void pumpTTS(); }
}
function gift(id, name, giftName, count, diamonds, demo = false) {
  const text = room.gift(id, name, giftName, count, diamonds, demo);
  if (text && room.settings.readGifts && audioOwner) say(text);
}
function follow(id, name, demo = false, avatar = '') {
  const text = room.follow(id, name, demo, avatar);
  if (text && room.settings.readFollows && audioOwner) say(text);
}

async function disconnectTikTok() {
  clearTimeout(reconnectTimer); reconnectTimer = null;
  const request = ++generation; const previous = connection; connection = null;
  if (previous) { previous.removeAllListeners(); try { await previous.disconnect(); } catch {} }
  if (request !== generation) return request;
  giftCatalog = { source: 'demo', gifts: DEMO_GIFTS }; broadcast({ t: 'giftCatalog', ...giftCatalog }, 'control');
  tiktokState = { status: 'idle', uniqueId: tiktokState.uniqueId, error: '' }; broadcast({ t: 'tiktok', ...tiktokState });
  return request;
}
async function connectTikTok(input, retry = 0) {
  const username = String(input || '').trim().replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, '').replace(/^@/, '').split(/[/?#]/)[0];
  if (!/^[\w.]{1,40}$/.test(username)) return log('Username TikTok không hợp lệ.');
  const attempt = await disconnectTikTok(); if (attempt !== generation) return;
  tiktokState = { status: 'connecting', uniqueId: username, error: '' }; broadcast({ t: 'tiktok', ...tiktokState });
  let failures = retry;
  const scheduleReconnect = () => {
    if (attempt !== generation || reconnectTimer || failures >= 5) return;
    const delay = Math.min(60000, 5000 * 2 ** failures);
    tiktokState = { ...tiktokState, status: 'reconnecting' }; broadcast({ t: 'tiktok', ...tiktokState });
    log(`Sẽ thử nối lại TikTok sau ${delay / 1000} giây (${failures + 1}/5).`);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; if (attempt === generation) void connectTikTok(username, failures + 1); }, delay);
  };
  try {
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
    if (attempt !== generation) return;
    // Extended gift catalog needs a paid signer route and must not block chat/follow/gift events.
    const conn = new TikTokLiveConnection(username, { enableExtendedGiftInfo: false, processInitialData: false }); connection = conn;
    const user = d => ({ ...liveUser(d), avatar: avatars.register(d) });
    const active = fn => d => { if (attempt === generation) fn(d); };
    let chatCount = 0, memberCount = 0;
    conn.on(WebcastEvent.CHAT, active(d => {
      const u = user(d), text = liveChatText(d);
      if (!u.id || !text) { log('TikTok gửi bình luận thiếu mã người dùng hoặc nội dung.'); return; }
      room.chat(u.id, u.name, text, false, u.avatar);
      if (++chatCount <= 3 || chatCount % 10 === 0) log(`Đã nhận ${chatCount} bình luận TikTok; ${room.viewers.size} khách đang có chỗ.`);
    }));
    conn.on(WebcastEvent.MEMBER, active(d => {
      const u = user(d);
      if (u.id) {
        room.seat(u.id, u.name, false, u.avatar);
        if (++memberCount <= 3 || memberCount % 25 === 0) log(`Đã nhận ${memberCount} lượt vào phòng TikTok; ${room.viewers.size} khách đang có chỗ.`);
      }
    }));
    conn.on(WebcastEvent.FOLLOW, active(d => { const u = user(d); follow(u.id, u.name, false, u.avatar); }));
    const seen = new Set();
    conn.on(WebcastEvent.GIFT, active(d => {
      const g = normalizeGift(d); if (!g) return;
      const eventId = d.common?.msgId || d.msgId;
      if (eventId) { const key = String(eventId); if (seen.has(key)) return; seen.add(key); if (seen.size > 1000) seen.delete(seen.values().next().value); }
      const u = user(d); gift(u.id, u.name, g.giftName, g.count, g.diamonds); log(`${u.name} tặng ${g.giftName} ×${g.count}`);
    }));
    conn.on(WebcastEvent.LIKE, active(d => room.like(user(d).id, d.likeCount || 1)));
    // Entering, liking, and gifting never allocate a seat. Only CHAT does.
    conn.on(ControlEvent.DISCONNECTED, active(d => {
      tiktokState = { ...tiktokState, status: 'disconnected' }; broadcast({ t: 'tiktok', ...tiktokState });
      log(`TikTok mất kết nối${d?.reason ? `: ${String(d.reason).slice(0, 120)}` : ''}.`);
      scheduleReconnect();
    }));
    conn.on(ControlEvent.ERROR, active(e => log(`TikTok: ${String(e?.info || e?.message || e).slice(0, 250)}`)));
    const state = await conn.connect();
    if (attempt !== generation) { try { await conn.disconnect(); } catch {} return; }
    failures = 0;
    tiktokState = { status: 'connected', uniqueId: username, error: '', roomId: String(state?.roomId || '') }; log(`Đã kết nối LIVE @${username}`);
    const rawGifts = conn.availableGifts;
    const gifts = Array.isArray(rawGifts) ? rawGifts : Array.isArray(rawGifts?.gifts) ? rawGifts.gifts : Array.isArray(rawGifts?.data?.gifts) ? rawGifts.data.gifts : [];
    if (gifts.length) {
      giftCatalog = { source: 'tiktok', gifts: gifts.slice(0, 1000).map(g => ({ name: String(g.name || g.giftName || 'Quà').slice(0, 48), coins: Number(g.diamond_count ?? g.diamondCount ?? 1), icon: '🎁' })) };
      broadcast({ t: 'giftCatalog', ...giftCatalog }, 'control');
    }
  } catch (error) {
    if (attempt !== generation) return;
    if (connection) { connection.removeAllListeners(); try { await connection.disconnect(); } catch {} connection = null; }
    tiktokState = { status: 'error', uniqueId: username, error: String(error?.message || error).slice(0, 300) }; log(`Không kết nối được TikTok: ${tiktokState.error}`);
    if (retry > 0) scheduleReconnect();
  }
  if (reconnectTimer) tiktokState = { ...tiktokState, status: 'reconnecting' };
  broadcast({ t: 'tiktok', ...tiktokState });
}
const NAMES = ['Bách', 'Mây', 'An Nhiên', 'Minh Anh', 'Hạ', 'Cá Mặn', 'Mèo Mun', 'Khánh', 'Bắp', 'Linh', 'Nắng', 'Tuấn'];
function fillDemo(n) { room.setDemoAudience(n, NAMES); }
function setBots(on) {
  clearInterval(bots); bots = null;
  if (on) {
    fillDemo(12); const lines = ['Tối nay vui quá!', '!uong cacao', 'nhảy', 'hát', 'múa', 'khiêu vũ', 'vỗ tay', 'vẫy tay', 'đèn', '!a', '!b', '!c'];
    bots = setInterval(() => { const v = room.viewers.get(`demo_${Math.floor(Math.random() * 12)}`); if (v) { room.chat(v.id, v.name, lines[Math.floor(Math.random() * lines.length)], true); if (Math.random() < .3) room.like(v.id, 5, true); } }, 3000);
  }
  broadcast({ t: 'bots', on: !!bots });
}
function onControl(m) {
  const name = String(m.name || 'Bách').slice(0, 22), id = `sim_${name}`;
  switch (m.cmd) {
    case 'connect': void connectTikTok(m.uniqueId); break;
    case 'disconnect': void disconnectTikTok(); break;
    case 'settings': room.updateSettings(m.settings); saveConfig(); break;
    case 'chat': room.chat(id, name, m.text, true, m.avatar); break;
    case 'gift': gift(id, name, m.gift || 'Hoa hồng', m.count || 1, m.diamonds || 1, true); break;
    case 'follow': follow(id, name, true); break;
    case 'like': room.like(id, m.n || 20, true); break;
    case 'fill': fillDemo(m.n); break;
    case 'fillStage': {
      const emit = room.emit; room.emit = () => {};
      try { for (let i = 0; i < room.settings.stageCapacity; i++) { const v = room.seat(`demo_stage_${i}`, `Sân khấu ${i + 1}`, true); if (v) room.perform(v, 'dance', i % 6); } }
      finally { room.emit = emit; }
      broadcast(snapshot()); break;
    }
    case 'clear': setBots(false); room.clear(); log('Đã bắt đầu phiên mới.'); break;
    case 'bots': setBots(m.on === true); break;
    case 'topic': room.nextTopic(); saveConfig(); break;
    case 'topicAction': room.topicAction(m.action, m.topic); saveConfig(); break;
    case 'lineAction': room.lineAction(m.action, m.line); saveConfig(); break;
    case 'reactionAction': room.reactionAction(m.reactions); saveConfig(); break;
    case 'previewReaction': {
      if (!['rose', 'gift', 'follow'].includes(m.kind)) break;
      const text = room.reaction(m.kind, { name, gift: 'Hoa hồng', count: 1 }); broadcast({ t: 'reactionPreview', text }, 'control');
      if (audioOwner) say(text); break;
    }
    case 'sayLine': {
      const line = room.lines.find(l => l.id === m.id);
      if (!line) break;
      if (line.audioUrl) {
        if (!room.library.some(t => t.url === line.audioUrl)) log('Không tìm thấy file giọng thu âm. Chọn lại file trong lời đọc sẵn.');
        else if (m.prepare === true) broadcast({ t: 'ttsReady', cached: true, text: line.label }, 'control');
        else if (audioOwner?.readyState === 1) audioOwner.send(JSON.stringify({ t: 'tts', url: line.audioUrl, text: line.label }));
        else log('Cần bật âm thanh trong cửa sổ overlay trước.');
      } else if (audioOwner || m.prepare === true) say(line.text, m.prepare === true);
      else log('Cần bật âm thanh trong cửa sổ overlay trước.');
      break;
    }
    case 'stopSpeech': speechGeneration++; ttsQueue.length = 0; ttsAbort?.abort(); broadcast({ t: 'stopSpeech' }); broadcast({ t: 'speechStatus', status: 'stopped' }, 'control'); break;
    case 'stageAction': room.stageAction(m.action, m.id); break;
    case 'queueAction': room.queueAction(m.action, m.qid, m.direction); break;
    case 'addTrack': room.addHostTrack(String(m.id || ''), m.playNow === true); break;
    case 'publishTracks': if (room.publishTracks(m.action, m.urls)) { saveConfig(); log(`Đã cập nhật danh sách phát: ${room.catalog.length} bài.`); } else log('Chọn bài hợp lệ và thay đổi trạng thái trước khi lưu danh sách phát.'); break;
    case 'renameTrack': if (room.renameTrack(m.url, m.title)) { saveConfig(); log('Đã đổi tên hiển thị bài hát.'); } else log('Không đổi được tên bài: chọn file trong thư viện và nhập tên mới (tối đa 80 ký tự).'); break;
    case 'playback': room.playback(m.action, m.value); break;
    case 'importConfig': room.loadConfig(m.config); saveConfig(); break;
    case 'skip': room.nextTrack(); break;
    case 'reloadMusic': catalog(); log(`Thư viện: ${room.library.length} file · danh sách phát: ${room.catalog.length} bài.`); break;
    case 'say': if (m.text && audioOwner) say(m.text); else log('Cần bật âm thanh trong cửa sổ overlay trước.'); break;
  }
}
const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`, ...PHONE_IPS.map(ip => `${ip}:${PORT}`)]);
const okHost = host => HOSTS.has(String(host || '').toLowerCase());
const PUBLIC = new Set(['/live/control.html', '/live/overlay.html', '/live/control.js', '/live/overlay.js', '/live/style.css', '/live/studio-v2.css', '/live/studio-v3.css', '/live/party.css', '/live/presets.js', '/live/bubble-layout.js', '/live/audio-engine.js', '/live/scene-renderer.js', '/live/motion.js', '/live/render-loop.js', '/live/render-clock.js']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
function staticFile(url) {
  const p = url === '/' ? '/live/control.html' : url;
  if (p.includes('\\') || p.includes('\0') || p.split('/').some(s => s.startsWith('.'))) return null;
  if (!PUBLIC.has(p) && !/^\/assets\/radio\/[^/]+\.(mp3|wav|ogg|m4a)$/i.test(p) && !/^\/live\/tts\/tts_[a-f0-9]{32}\.mp3$/.test(p)) return null;
  const file = path.resolve(ROOT, `.${p}`);
  if (!file.startsWith(ROOT + path.sep)) return null;
  try { if (!fs.realpathSync(file).startsWith(ROOT + path.sep)) return null; } catch { return null; }
  return file;
}
const server = http.createServer(async (req, res) => {
  if (!okHost(req.headers.host)) return res.writeHead(421).end('wrong host');
  const phonePeer = PHONE_MODE && !localPeer(req.socket.remoteAddress);
  if (phonePeer) {
    let url; try { url = new URL(req.url, 'http://localhost'); } catch { return res.writeHead(400).end(); }
    if (req.method === 'GET' && url.pathname === '/phone' && url.searchParams.get('t') === PHONE_KEY) {
      return res.writeHead(302, { Location: '/phone', 'Set-Cookie': `cafe_phone=${PHONE_KEY}; HttpOnly; SameSite=Lax; Path=/; Max-Age=14400`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).end();
    }
    if (!phoneCookie(req)) return res.writeHead(403).end('Open the phone link printed by the cafe server.');
  }
  if (req.method === 'POST' && req.url === '/api/music') {
    if (phonePeer) return res.writeHead(403).end();
    let origin; try { origin = new URL(req.headers.origin); } catch { return res.writeHead(403).end(); }
    if (origin.protocol !== 'http:' || !okHost(origin.host)) return res.writeHead(403).end();
    if (uploadBusy) return res.writeHead(409).end('Đang tải file khác, thử lại sau.');
    let filename; try { filename = decodeURIComponent(String(req.headers['x-file-name'] || '')); } catch { return res.writeHead(400).end('Tên file lỗi.'); }
    if (filename.length > 120 || /^[.]/.test(filename) || /[<>:"/\\|?*\u0000-\u001f]/.test(filename) || !/\.(mp3|wav|ogg|m4a)$/i.test(filename)) return res.writeHead(400).end('Chỉ nhận MP3, WAV, OGG, M4A với tên file hợp lệ.');
    const target = path.join(RADIO_DIR, filename); if (fs.existsSync(target)) return res.writeHead(409).end('Đã có file cùng tên, đổi tên trước khi tải.');
    uploadBusy = true; req.setTimeout(60000, () => req.destroy());
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 100 * 1024 * 1024) { res.writeHead(413).end('File tối đa 100 MB.'); return; } chunks.push(chunk); }
      if (!bytes) return res.writeHead(400).end('File rỗng.');
      fs.writeFileSync(target, Buffer.concat(chunks), { flag: 'wx' }); catalog(); res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ name: filename }));
    } catch (error) { if (!res.headersSent) res.writeHead(400).end('Không tải được file.'); log(`Tải nhạc lỗi: ${error.message}`); }
    finally { uploadBusy = false; }
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405).end();
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return res.writeHead(400).end(); }
  if (phonePeer && (p === '/' || p === '/live/control.html' || p === '/live/control.js')) return res.writeHead(403).end();
  const avatarKey = /^\/live\/avatar\/([a-f0-9]{32})\.img$/.exec(p)?.[1];
  if (avatarKey) {
    const image = await avatars.load(avatarKey); if (!image) return res.writeHead(404, { 'Cache-Control': 'no-store' }).end('avatar unavailable');
    res.writeHead(200, { 'Content-Type': image.type, 'Content-Length': image.bytes.length, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return res.end(req.method === 'HEAD' ? undefined : image.bytes);
  }
  const file = staticFile(p === '/phone' && phonePeer ? '/live/overlay.html' : p); if (!file) return res.writeHead(404).end('not found');
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return res.writeHead(404).end('not found');
    const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    let start = 0, end = stat.size - 1, code = 200;
    if (req.headers.range && /^audio\//.test(headers['Content-Type'])) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!range) return res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
      start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), end) : end;
      if (start > end || start >= stat.size) return res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
      code = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1); headers['Accept-Ranges'] = 'bytes'; res.writeHead(code, headers);
    if (req.method === 'HEAD' || !stat.size) return res.end();
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  });
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 131072, verifyClient: ({ origin, req }) => {
  if (!okHost(req.headers.host)) return false;
  const phonePeer = PHONE_MODE && !localPeer(req.socket.remoteAddress);
  if (phonePeer && (!phoneCookie(req) || new URL(req.url, 'http://localhost').searchParams.get('role') === 'control')) return false;
  if (!origin) return !phonePeer;
  try { const url = new URL(origin); return url.protocol === 'http:' && okHost(url.host); } catch { return false; }
} });
function broadcast(m, role) { const json = JSON.stringify(m); for (const c of wss.clients) if (c.readyState === 1 && (!role || c.role === role)) c.send(json); }
wss.on('connection', (ws, req) => {
  ws.role = new URL(req.url, 'http://localhost').searchParams.get('role') === 'control' ? 'control' : 'overlay';
  ws.device = localPeer(req.socket.remoteAddress) ? 'PC' : 'iPhone / mạng nội bộ';
  ws.send(JSON.stringify(snapshot())); if (ws.role === 'control') ws.send(JSON.stringify({ t: 'logs', lines: logs }));
  let since = Date.now(), messages = 0;
  ws.on('message', buffer => {
    if (Date.now() - since > 1000) { since = Date.now(); messages = 0; } if (++messages > 30) return;
    try {
      const m = JSON.parse(buffer); if (!m || typeof m !== 'object') return;
      if (ws.role === 'control' && m.t === 'ctl') onControl(m);
      // Overlay can claim audio and acknowledge playback, but cannot send control commands.
      if (ws.role === 'overlay' && m.t === 'audio') {
        if (m.enabled === true) {
          if (audioOwner && audioOwner !== ws) audioOwner.send(JSON.stringify({ t: 'audioOwner', owner: false }));
          audioOwner = ws; ws.send(JSON.stringify({ t: 'audioOwner', owner: true }));
          if (!room.playing && !room.paused && room.settings.autoPlay) room.nextTrack(); else room.sendRadio();
        } else if (audioOwner === ws) audioOwner = null;
        broadcast({ t: 'audioReady', ready: !!audioOwner, device: audioOwner?.device || '' });
      }
      if (ws === audioOwner && ['ended', 'audioError'].includes(m.t) && room.playing && m.token === room.playing.token) {
        if (m.t === 'audioError') log(`Không phát được: ${room.playing.title}. Kiểm tra file và âm thanh.`);
        if (room.settings.autoPlay) room.nextTrack(); else { room.startTrack(null); room.paused = true; room.sendRadio(); }
      }
      if (ws === audioOwner && m.t === 'mediaTime' && room.playing && m.token === room.playing.token && Number.isFinite(m.position) && Number.isFinite(m.duration)) {
        room.duration = Math.max(0, Math.min(86400, m.duration)); room.position = Math.max(0, Math.min(room.duration, m.position));
        broadcast({ t: 'mediaTime', position: room.position, duration: room.duration }, 'control');
      }
      if (ws === audioOwner && m.t === 'voiceError') {
        const message = m.code === 'NotAllowedError' ? 'Trình duyệt đang chặn giọng đọc. Bấm lại Bật âm thanh trong overlay.' : 'File giọng đọc không phát được. Kiểm tra nguồn âm thanh hoặc thử tạo lại.';
        broadcast({ t: 'audioNote', message }, 'control'); log(message);
      }
      if (ws === audioOwner && m.t === 'voiceStatus' && ['playing', 'fallbackSpeaking', 'fallbackUnavailable'].includes(m.status)) {
        const message = m.status === 'playing' ? m.source === 'google' ? 'Đang phát giọng Việt dự phòng (Google) ✓' : 'Đang phát giọng đọc ✓' : m.status === 'fallbackSpeaking' ? 'Đang dùng giọng tiếng Việt dự phòng của trình duyệt.' : 'Chưa đọc được: các nguồn giọng trực tuyến đều lỗi, máy chưa có giọng Việt dự phòng. Kiểm tra Internet rồi thử lại.';
        broadcast({ t: 'audioNote', message }, 'control');
        if (m.status !== 'playing') log(message);
      }
    } catch (error) { log(`Lệnh không hợp lệ: ${error.message}`); }
  });
  ws.on('close', () => { if (audioOwner === ws) { audioOwner = null; broadcast({ t: 'audioReady', ready: false, device: '' }); } });
});
server.on('error', e => { console.error(`Không mở được cổng ${PORT}: ${e.message}`); process.exitCode = 1; });
try { if (fs.existsSync(CONFIG_FILE)) room.loadConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); } catch (error) { console.error(`Không đọc được cấu hình, dùng mặc định: ${error.message}`); }
setInterval(() => room.tick(), 1000).unref();
server.listen(PORT, PHONE_MODE ? '0.0.0.0' : '127.0.0.1', () => {
  catalog(); log(`Cà Phê Sau 12h: http://localhost:${PORT}`);
  if (PHONE_MODE) {
    for (const ip of PHONE_IPS) console.log(`Mở trên iPhone cùng Wi-Fi: http://${ip}:${PORT}/phone?t=${PHONE_KEY}`);
    if (!PHONE_IPS.length) console.log('Chưa tìm thấy IP Wi-Fi nội bộ. Kiểm tra PC đã nối Wi-Fi và mở lại start-phone.cmd.');
  }
});
