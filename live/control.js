import { SCENES, AMBIENTS, DEMO_GIFTS } from './presets.js';
const $ = id => document.getElementById(id), el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const number = v => Number(v || 0).toLocaleString('vi-VN'), time = v => `${String(Math.floor((v || 0) / 60)).padStart(2, '0')}:${String(Math.floor((v || 0) % 60)).padStart(2, '0')}`;
let ws, bots = false, people = new Map(), settings = {}, roomCommunity, toastTimer, serverProtocol = 0, configuration = { topics: [], lines: [] };
let donations = { total: 0, demoTotal: 0, leaderboard: [], demoLeaderboard: [] }, radio = { queue: [], catalog: [], library: [] }, giftCatalog = { source: 'demo', gifts: DEMO_GIFTS };
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000); }
function send(cmd, extra = {}) { if (ws?.readyState !== 1) { toast('Server chưa kết nối.'); return false; } ws.send(JSON.stringify({ t: 'ctl', cmd, ...extra })); return true; }
function button(text, fn, cls = 'quiet') { const b = el('button', cls, text); b.onclick = fn; return b; }
function log(line) { $('logs').textContent = ($('logs').textContent + line + '\n').split('\n').slice(-200).join('\n'); }
const NUMBERS = ['likeGoal', 'giftGoal', 'rate', 'pitch', 'voiceVolume', 'ambientVolume', 'trackVolume', 'duckVolume', 'songMinGift', 'queueLimit', 'stageCapacity', 'stageMinGift', 'stageSeconds', 'seatLimit', 'bubbleSeconds', 'bubbleLimit', 'bubbleFont', 'bubbleWidth', 'animationLevel'];
const SETTING_IDS = ['title', 'subtitle', 'voice', 'music', 'readGifts', 'readFollows', 'musicVoting', 'giftGoalTitle', 'ambient', 'ordersOpen', 'autoPlay', 'freeStage', 'hideCommands', 'viewerAvatars', ...NUMBERS];
function fillSettings(value) {
  settings = value;
  $('studioTitle').textContent = value.title;
  const rule = `🌹 1 hoa hồng = 1 lượt nhảy · ${value.stageSeconds} giây/lượt`;
  $('liveDanceRule').textContent = rule; $('stageRuleTitle').textContent = rule;
  for (const key of SETTING_IDS) { const input = $(key); if (document.activeElement !== input) { if (input.type === 'checkbox') input.checked = !!value[key]; else input.value = value[key]; } }
  document.querySelectorAll('[data-value-for]').forEach(n => { n.textContent = settings[n.dataset.valueFor]; });
  document.querySelectorAll('[data-scene]').forEach(n => { const selected = n.dataset.scene === value.scene; n.classList.toggle('active', selected); n.setAttribute('aria-pressed', selected); });
  $('songMinGift').disabled = value.musicVoting;
  renderDonations(donations); if (roomCommunity) renderStage(roomCommunity);
}
for (const scene of SCENES) {
  const b = button('', () => send('settings', { settings: { scene: scene.id } }), 'scene'); b.dataset.scene = scene.id; b.setAttribute('aria-pressed', 'false');
  b.style.setProperty('--scene-color', scene.accent); b.append(el('span', '', scene.icon), el('b', '', scene.name), el('small', '', scene.note)); $('scenePicker').append(b);
}
for (const a of AMBIENTS) { const option = el('option', '', a.name); option.value = a.id; $('ambient').append(option); }
function renderDonations(value) {
  donations = value; const target = settings.giftGoal || 1000, percent = Math.min(100, value.total / target * 100);
  $('donationTotal').textContent = `${number(value.total)} KC`; $('donationDemoTotal').textContent = `${number(value.demoTotal)} KC`;
  $('donationProgressText').textContent = `${number(value.total)} / ${number(target)} KC`; $('donationProgressPercent').textContent = `${Math.floor(percent)}%`; $('donationProgressFill').style.width = `${percent}%`;
  const demo = !value.leaderboard.length && value.demoLeaderboard.length > 0, list = $('donationLeaders'); list.replaceChildren();
  const entries = demo ? value.demoLeaderboard : value.leaderboard;
  if (!entries.length) list.append(el('li', 'empty-state', 'Chưa có người tặng quà.'));
  entries.forEach((v, i) => { const row = el('li'); row.append(el('span', '', `${i + 1}. ${v.name}${demo ? ' · DEMO' : ''}`), el('b', '', `${number(v.coins)} KC`)); list.append(row); });
}
function renderTikTok(v) {
  $('tiktokStatus').textContent = ({ idle: 'Chưa nối TikTok · vẫn thử cục bộ được', connecting: `Đang nối @${v.uniqueId}…`, connected: `Đã nối LIVE @${v.uniqueId}`, reconnecting: 'TikTok mất kết nối · đang thử nối lại', disconnected: 'TikTok mất kết nối', error: 'Không nối được phòng LIVE' })[v.status] || v.status;
  $('tiktokError').textContent = v.error || ''; $('connect').disabled = v.status === 'connecting'; $('connect').textContent = v.status === 'connecting' ? 'Đang nối…' : 'Kết nối';
}
function renderPeople() {
  $('guestCount').textContent = people.size; $('realCount').textContent = `${[...people.values()].filter(v => !v.demo).length} thật`;
  const root = $('people'); root.replaceChildren(); if (!people.size) root.append(el('p', 'empty-state', 'Khách vào LIVE sẽ có chỗ ngồi ☕'));
  [...people.values()].sort((a, b) => b.coins - a.coins).forEach(v => {
    const row = el('div', 'person'), avatar = el('span', 'avatar', v.name.slice(0, 1)); avatar.style.background = ['#d9a993', '#afa5cd', '#a6bdab', '#cba2b9', '#c4b48b', '#91b9c5'][v.skin % 6];
    if (/^\/live\/avatar\/[a-f0-9]{32}\.img$/.test(v.avatar || '')) { const image = el('img'); image.alt = ''; image.src = v.avatar; image.onerror = () => { avatar.textContent = v.name.slice(0, 1); }; avatar.replaceChildren(image); }
    const invite = button('♫', () => send('stageAction', { action: 'invite', id: v.id }), 'person-invite'); invite.title = `Mời ${v.name} lên sân khấu`;
    row.append(avatar, el('span', 'person-name', v.name), el('small', '', v.demo ? 'DEMO' : 'LIVE'), el('span', 'person-coins', v.coins ? `✧ ${number(v.coins)}` : '☕'), invite); root.append(row);
  });
}
function renderStage(v) {
  const performers = v.performers || [], waiting = v.stageQueue || []; $('stageCount').textContent = `${performers.length} / ${settings.stageCapacity || 5}`; $('stagePeople').replaceChildren();
  $('previewStageCount').textContent = `${performers.length} biểu diễn`;
  if (!performers.length) $('stagePeople').append(el('p', 'empty-state', 'Sân khấu đang chờ khách.'));
  performers.forEach(p => { const row = el('div', 'stage-person'); const activity = ({ dance: 'Nhảy ' + ((p.style || 0) + 1), sing: 'Cầm mic hát', ribbon: 'Múa lụa', ballroom: p.partnerId ? 'Khiêu vũ đôi' : 'Chờ bạn khiêu vũ' })[p.activity || 'dance']; row.append(el('span', '', `${p.name}${p.demo ? ' · DEMO' : ''}`), el('small', 'performance-badge', activity), el('small', '', `${Math.max(0, Math.ceil((p.until - Date.now()) / 1000))}s · ${p.turns || 1} lượt`), button('Mời xuống', () => send('stageAction', { action: 'remove', id: p.id }), 'text-button')); $('stagePeople').append(row); });
  $('stageWaiting').textContent = waiting.length ? `Đang chờ: ${waiting.map(p => `${p.name} (${p.turns || 1} lượt)`).join(' · ')}` : 'Đủ chỗ thì lên nhảy. Còn lượt sẽ vào vòng chờ tiếp để nhường người khác.';
}
function renderCommunity(v) { roomCommunity = v; renderStage(v); }
function renderRadio(v) {
  radio = v; $('nowPlaying').textContent = v.playing?.title || 'Chưa có bài order';
  $('requestedBy').textContent = v.playing ? `${v.paused ? 'Tạm dừng · ' : ''}${v.playing.host ? 'Chủ quán chọn' : `Order bởi ${v.playing.name}${v.playing.demo ? ' · DEMO' : ''}`}` : 'Mở overlay riêng và bấm bật âm thanh để nghe.';
  $('pause').textContent = v.paused ? 'Tiếp tục ▶' : 'Tạm dừng Ⅱ'; $('queueCount').textContent = v.queue.length; mediaTime(v);
  const root = $('queue'); root.replaceChildren(); if (!v.queue.length) root.append(el('li', 'empty-state', 'Chưa có bài chờ. Chủ quán có thể thêm từ thư viện.'));
  v.queue.forEach((item, i) => {
    const row = el('li', 'queue-item'); row.dataset.qid = item.qid;
    const name = button(`${String(i + 1).padStart(2, '0')} · ${item.title}`, () => send('queueAction', { action: 'play', qid: item.qid }), 'queue-play'); name.title = 'Phát ngay bài này, thay bài hiện tại';
    const tools = el('div', 'queue-tools');
    tools.append(button('↑', () => send('queueAction', { action: 'move', qid: item.qid, direction: 'up' })), button('↓', () => send('queueAction', { action: 'move', qid: item.qid, direction: 'down' })), button(item.manualRank ? 'Bỏ ghim' : 'Ghim', () => send('queueAction', { action: item.manualRank ? 'unpin' : 'pin', qid: item.qid })), button('×', () => send('queueAction', { action: 'remove', qid: item.qid }), 'danger'));
    row.append(name, el('small', 'queue-vote-count', `${settings.musicVoting ? `${item.votes || 0} người chọn (${item.realVotes || 0} thật · ${item.demoVotes || 0} thử) · ` : ''}${item.name}${item.demo ? ' · DEMO' : ''} · ${number(item.priority)} KC${item.manualRank ? ' · CHỦ QUÁN XẾP' : ''}`), tools); root.append(row);
  }); renderCatalog();
}
function mediaTime(v) { $('elapsed').textContent = time(v.position); $('duration').textContent = time(v.duration); if (document.activeElement !== $('seek')) { $('seek').max = v.duration || 1; $('seek').value = v.position || 0; } }
function editTrackTitle(track, detail) {
  if (detail.querySelector('.library-rename')) return;
  const editor = el('div', 'library-rename'), input = el('input'), actions = el('div', 'library-rename-actions');
  input.type = 'text'; input.maxLength = 80; input.value = track.title; input.setAttribute('aria-label', `Tên hiển thị của ${track.originalTitle}`);
  const save = () => { const title = input.value.trim(); if (!title) return toast('Nhập tên bài trước khi lưu.'); if (send('renameTrack', { url: track.url, title })) editor.remove(); };
  actions.append(button('Lưu tên', save, 'primary'), button('Hủy', () => editor.remove()));
  if (track.title !== track.originalTitle) actions.append(button('Tên gốc', () => { input.value = track.originalTitle; input.focus(); }));
  input.onkeydown = event => { if (event.key === 'Enter') save(); if (event.key === 'Escape') editor.remove(); };
  editor.append(input, actions, el('small', '', `Chỉ đổi tên hiển thị · file gốc: ${track.originalTitle}`)); detail.append(editor); input.focus(); input.select();
}
function renderCatalog() {
  const query = $('musicSearch').value.toLocaleLowerCase(), root = $('catalog'); root.replaceChildren();
  const library = radio.library || radio.catalog, published = new Map(radio.catalog.map(t => [t.url, t]));
  const list = library.filter(t => t.title.toLocaleLowerCase().includes(query));
  if (!list.length) root.append(el('li', 'empty-state', library.length ? 'Không tìm thấy bài.' : 'Chưa có file. Bấm Thêm file để đưa nhạc vào thư viện.'));
  list.forEach(t => {
    const active = published.get(t.url), li = el('li', 'catalog-item'), checkbox = el('input'), detail = el('div', 'library-track'), tools = el('div', 'queue-tools');
    checkbox.type = 'checkbox'; checkbox.checked = !!active; checkbox.disabled = serverProtocol < 5; checkbox.setAttribute('aria-label', `Hiện ${t.title} cho người xem order`);
    checkbox.onchange = () => {
      const action = checkbox.checked ? 'add' : 'remove';
      checkbox.checked = !!active; checkbox.disabled = true;
      if (!send('publishTracks', { action, urls: [t.url] })) checkbox.disabled = false;
    };
    detail.append(el('b', '', t.title), el('small', active ? 'ĐANG TRONG DANH SÁCH PHÁT' : 'CHỈ Ở THƯ VIỆN'));
    tools.append(button('Sửa tên', () => editTrackTitle(t, detail)));
    if (active) tools.append(el('code', '', `!nhac ${active.id}`), button('+ Hàng chờ', () => send('addTrack', { id: active.id })), button('▶ Phát ngay', () => send('addTrack', { id: active.id, playNow: true })));
    li.classList.toggle('published', !!active); li.append(checkbox, detail, tools); root.append(li);
  });
  $('libraryStatus').textContent = serverProtocol < 5 ? 'Server đang chạy bản cũ · đóng cửa sổ server rồi mở lại start-cafe.cmd hoặc start-phone.cmd' : `${radio.catalog.length}/${library.length} bài hiện cho người xem · tích để hiện, bỏ tích để ẩn`;
  $('hideAllTracks').disabled = serverProtocol < 5 || radio.catalog.length === 0;
  renderLineAudioOptions();
}
function renderConfiguration(v) {
  configuration = v;
  for (const kind of ['rose', 'gift', 'follow']) { const input = $('reaction-' + kind); if (document.activeElement !== input) input.value = (v.reactions?.[kind] || []).join('\n'); }
  const selectedLine = $('lineSelect').value; $('lineSelect').replaceChildren(new Option('+ Thêm lời đọc mới', ''));
  for (const line of v.lines) $('lineSelect').append(new Option(line.label, line.id)); $('lineSelect').value = v.lines.some(l => l.id === selectedLine) ? selectedLine : '';
  if (!document.activeElement?.closest('#voicePanel .editor')) fillLine();
  $('savedLines').replaceChildren(); v.lines.forEach(l => { const b = button(`▶ ${l.label}`, () => send('sayLine', { id: l.id })); b.title = l.text; $('savedLines').append(b); });
}
function renderLineAudioOptions(selected = $('lineAudio').value) { $('lineAudio').replaceChildren(new Option('Dùng giọng đọc tự động', '')); for (const t of radio.library || radio.catalog) $('lineAudio').append(new Option(t.title, t.url)); $('lineAudio').value = selected; }
function fillLine() { const l = configuration.lines.find(l => l.id === $('lineSelect').value); $('lineLabel').value = l?.label || ''; $('lineText').value = l?.text || ''; renderLineAudioOptions(l?.audioUrl || ''); }
function renderGiftCatalog(v) { giftCatalog = v; $('giftSelect').replaceChildren(); v.gifts.forEach((g, i) => $('giftSelect').append(new Option(`${g.icon || '🎁'} ${g.name}`, String(i)))); $('giftSource').textContent = v.source === 'tiktok' ? 'TỪ PHÒNG TIKTOK' : 'BỘ QUÀ DEMO'; $('giftValue').value = v.gifts[0]?.coins || 1; }
function renderAudio(ready, device = '') { $('audioStatus').textContent = ready ? `ÂM THANH: ${device || 'OVERLAY'}` : 'CHƯA BẬT ÂM THANH'; }
function connect() {
  ws = new WebSocket(`ws://${location.host}/ws?role=control`);
  ws.onopen = () => { $('serverStatus').textContent = 'Server đang chạy'; $('serverStatus').className = 'status ok'; };
  ws.onclose = () => { $('serverStatus').textContent = 'Server mất kết nối'; $('serverStatus').className = 'status error'; $('connect').disabled = false; setTimeout(connect, 2000); };
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.t === 'state') { serverProtocol = Number(m.protocolVersion || 0); people = new Map(m.viewers.map(v => [v.id, v])); fillSettings(m.settings); renderPeople(); renderCommunity(m.community); renderRadio(m.radio); renderDonations(m.donations); renderConfiguration(m.configuration); renderTikTok(m.tiktok); bots = !!m.bots; renderAudio(m.audioReady, m.audioDevice); renderGiftCatalog(m.giftCatalog); if (serverProtocol < 5) toast('Server đang chạy bản cũ. Đóng cửa sổ server rồi mở lại để dùng chọn bài nhạc.'); }
    if (m.t === 'settings') fillSettings(m.settings);
    if (m.t === 'configuration') renderConfiguration(m);
    if (m.t === 'giftCatalog') renderGiftCatalog(m);
    if (m.t === 'tiktok') renderTikTok(m);
    if (m.t === 'join' || m.t === 'viewer') { people.set(m.v.id, m.v); renderPeople(); }
    if (m.t === 'leave') { people.delete(m.id); renderPeople(); }
    if (m.t === 'gift') { const v = people.get(m.id); if (v) v.coins = m.total; renderPeople(); }
    if (m.t === 'community') renderCommunity(m);
    if (m.t === 'donations') renderDonations(m);
    if (m.t === 'goalReached') toast(`Đạt mục tiêu ${m.title}!`);
    if (m.t === 'radio') renderRadio(m);
    if (m.t === 'mediaTime') mediaTime(m);
    if (m.t === 'audioReady') renderAudio(m.ready, m.device);
    if (m.t === 'logs') $('logs').textContent = m.lines.join('\n') + '\n';
    if (m.t === 'log') { log(m.line); if (/lỗi|Không|Cần/.test(m.line)) toast(m.line); }
    if (m.t === 'notice') toast(`${m.name}: ${m.text}`);
    if (m.t === 'bots') { bots = m.on; $('bots').textContent = bots ? 'Tắt bot' : 'Bật bot'; }
    if (m.t === 'configSaved') $('settingsSaved').textContent = 'Đã lưu trên máy phát ✓';
    if (m.t === 'ttsReady') { $('ttsStatus').dataset.source = m.source || 'file'; $('ttsStatus').dataset.cached = String(!!m.cached); $('ttsStatus').textContent = m.source === 'google' ? 'Đã có giọng Việt dự phòng Google ✓ · hỗ trợ tốc độ và âm lượng; độ trầm/cao dùng giọng gốc.' : m.cached ? 'Đã có giọng đọc lưu sẵn ✓' : 'Đã tạo và lưu âm thanh ✓'; }
    if (m.t === 'ttsFailed') $('ttsStatus').textContent = 'Các nguồn giọng trực tuyến chưa trả được âm thanh. Đang thử giọng Việt trên máy nếu có.';
    if (m.t === 'speechStatus') $('ttsStatus').textContent = ({ generating: 'Đang tạo giọng đọc…', retrying: 'Kết nối giọng đọc gián đoạn · đang thử lại…', fallbackGenerating: 'Edge chưa tạo được tiếng · đang tạo giọng Việt dự phòng…', stopped: 'Đã dừng đọc.' })[m.status] || m.status;
    if (m.t === 'reactionPreview') $('reactionPreviewText').textContent = m.text;
    if (m.t === 'audioNote') { $('ttsStatus').textContent = m.message; toast(m.message); }
  };
}
connect();
$('connect').onclick = () => send('connect', { uniqueId: $('username').value }); $('disconnect').onclick = () => send('disconnect');
$('username').onkeydown = e => { if (e.key === 'Enter' && !$('connect').disabled) $('connect').click(); };
$('sendChat').onclick = () => send('chat', { name: $('simName').value, text: $('simText').value }); $('simText').onkeydown = e => { if (e.key === 'Enter') $('sendChat').click(); };
document.querySelectorAll('[data-command]').forEach(b => b.onclick = () => send('chat', { name: $('simName').value, text: b.dataset.command }));
document.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => send('gift', { name: $('simName').value, gift: b.dataset.gift, diamonds: Number(b.dataset.value), count: 1 }));
document.querySelectorAll('[data-fill]').forEach(b => b.onclick = () => send('fill', { n: Number(b.dataset.fill) }));
$('giftSelect').onchange = () => { $('giftValue').value = giftCatalog.gifts[Number($('giftSelect').value)]?.coins || 1; };
$('sendGift').onclick = () => send('gift', { name: $('simName').value, gift: giftCatalog.gifts[Number($('giftSelect').value)]?.name || 'Quà', diamonds: Number($('giftValue').value), count: Number($('giftCount').value) });
for (const key of SETTING_IDS) {
  const input = $(key); let timer;
  const apply = () => send('settings', { settings: { [key]: input.type === 'checkbox' ? input.checked : NUMBERS.includes(key) ? Number(input.value) : input.value } });
  input.onchange = () => { clearTimeout(timer); apply(); };
  if (input.type === 'range') input.oninput = () => { document.querySelector(`[data-value-for="${key}"]`).textContent = input.value; clearTimeout(timer); timer = setTimeout(apply, 120); };
}
$('like').onclick = () => send('like', { n: 20 }); $('bots').onclick = () => send('bots', { on: !bots });
$('clear').onclick = () => { if (confirm('Đặt lại khách, quà, tim, sân khấu và hàng chờ? Cấu hình được giữ.')) send('clear'); };
$('skip').onclick = () => send('skip'); $('pause').onclick = () => send('playback', { action: radio.paused ? 'resume' : 'pause' }); $('stopMusic').onclick = () => send('playback', { action: 'stop' });
$('seek').onchange = () => send('playback', { action: 'seek', value: Number($('seek').value) });
$('clearQueue').onclick = () => { if (confirm('Xóa toàn bộ bài đang chờ?')) send('queueAction', { action: 'clear' }); };
$('reloadMusic').onclick = () => send('reloadMusic'); $('musicSearch').oninput = renderCatalog;
$('hideAllTracks').onclick = () => { if (serverProtocol < 5) return toast('Cần đóng và mở lại server trước.'); const urls = radio.catalog.map(track => track.url); if (urls.length) { $('hideAllTracks').disabled = true; send('publishTracks', { action: 'remove', urls }); } };
$('say').onclick = () => send('say', { text: $('announcement').value }); $('stopSpeech').onclick = () => send('stopSpeech');
$('lineSelect').onchange = fillLine;
$('saveLine').onclick = () => send('lineAction', { action: 'save', line: { id: $('lineSelect').value, label: $('lineLabel').value, text: $('lineText').value, audioUrl: $('lineAudio').value } });
$('deleteLine').onclick = () => send('lineAction', { action: 'delete', line: { id: $('lineSelect').value } });
$('prepareLine').onclick = () => { if ($('lineSelect').value) { send('sayLine', { id: $('lineSelect').value, prepare: true }); $('ttsStatus').textContent = 'Đang tạo giọng đọc…'; } else toast('Chọn một lời đã lưu trước.'); };
$('clearStage').onclick = () => send('stageAction', { action: 'clear' });
$('fillStage').onclick = () => send('fillStage');
$('testFollow').onclick = () => send('follow', { name: $('simName').value });
$('saveReactions').onclick = () => { const reactions = Object.fromEntries(['rose', 'gift', 'follow'].map(kind => [kind, $('reaction-' + kind).value.split('\n').map(s => s.trim()).filter(Boolean)])); if (Object.values(reactions).some(lines => !lines.length || lines.length > 12 || lines.some(s => s.length > 320))) return toast('Mỗi nhóm cần 1–12 câu, tối đa 320 ký tự/câu.'); send('reactionAction', { reactions }); };
$('previewReaction').onclick = () => send('previewReaction', { kind: $('reactionKind').value, name: $('simName').value || 'Bách' });
$('copyOverlay').onclick = async () => { try { await navigator.clipboard.writeText(`${location.origin}/live/overlay.html`); toast('Đã sao chép địa chỉ overlay.'); } catch { toast(`${location.origin}/live/overlay.html`); } };
$('exportConfig').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 4, settings, ...configuration }, null, 2)], { type: 'application/json' })); const a = el('a'); a.href = url; a.download = 'ca-phe-sau-12h.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('importConfig').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 128000) throw new Error('File tối đa 128 KB.'); send('importConfig', { config: JSON.parse(await file.text()) }); } catch (error) { toast(`Không nhập được cấu hình: ${error.message}`); } e.target.value = ''; };
$('uploadMusic').onchange = async e => {
  const files = [...e.target.files]; $('uploadMusic').disabled = true;
  try { for (const file of files) { if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name}: tối đa 100 MB.`); $('uploadStatus').textContent = `Đang thêm ${file.name}…`; const response = await fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file }); if (!response.ok) throw new Error(await response.text()); } $('uploadStatus').textContent = `Đã lưu ${files.length} file vào thư viện. Tích bài muốn hiện cho người xem là xong.`; }
  catch (error) { $('uploadStatus').textContent = error.message; } finally { $('uploadMusic').disabled = false; e.target.value = ''; }
};
setInterval(() => { if (roomCommunity) renderStage(roomCommunity); }, 1000);
const tabButtons = [...document.querySelectorAll('[data-tab]')];
function selectTab(name, focus = false) {
  if (!tabButtons.some(b => b.dataset.tab === name)) name = 'live';
  tabButtons.forEach(b => { const active = b.dataset.tab === name; b.setAttribute('aria-selected', active); b.tabIndex = active ? 0 : -1; if (active && focus) b.focus(); });
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== name; });
  document.querySelectorAll('.rail [data-jump]').forEach(a => a.classList.toggle('rail-active', a.dataset.jump === name));
  document.querySelector('.tab-content').scrollTop = 0;
  try { localStorage.setItem('cafe-studio-tab', name); } catch {}
}
tabButtons.forEach((b, i) => {
  b.onclick = () => selectTab(b.dataset.tab);
  b.onkeydown = event => {
    const next = event.key === 'ArrowRight' ? (i + 1) % tabButtons.length : event.key === 'ArrowLeft' ? (i + tabButtons.length - 1) % tabButtons.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabButtons.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); selectTab(tabButtons[next].dataset.tab, true); }
  };
});
document.querySelectorAll('[data-jump]').forEach(a => a.onclick = event => { event.preventDefault(); selectTab(a.dataset.jump, true); });
let initialTab = 'live'; try { initialTab = localStorage.getItem('cafe-studio-tab') || 'live'; } catch {} selectTab(initialTab);
if (matchMedia('(max-width:800px)').matches) document.querySelector('.preview-column').open = false;
$('simName').addEventListener('input', () => { $('stageTestUser').textContent = $('simName').value || 'Bách'; });
$('stageTestRose').onclick = () => { const name = $('simName').value || 'Bách'; send('chat', { name, text: 'Cho tôi lên sân khấu nhảy một chút nhé!' }); send('gift', { name, gift: 'Rose · Hoa hồng', count: 1, diamonds: 1 }); toast(`Đã gửi bình luận và 1 hoa hồng DEMO cho ${name}.`); };
