import { SCENES, AMBIENTS, DEFAULT_LINES, DEFAULT_REACTIONS } from './presets.js';
export const TOPICS = [
  { id: 'q1', text: 'Nếu có một tối hoàn toàn rảnh, ông chọn gì?', choices: ['Cà phê với bạn', 'Nghe một concert', 'Chăm một góc vườn'] },
  { id: 'q2', text: 'Một siêu năng lực cho ngày mai?', choices: ['Đọc được suy nghĩ', 'Dừng thời gian', 'Dịch chuyển tức thì'] },
  { id: 'q3', text: 'Điều nhỏ nào làm một ngày tốt hơn?', choices: ['Một lời hỏi thăm', 'Một bài nhạc hay', 'Một giấc ngủ ngon'] },
];
export const DEFAULT_SETTINGS = {
  title: 'Cà Phê Sau 12h', subtitle: 'Một chiếc bàn, một câu chuyện.', scene: 'cafe',
  voice: 'vi-VN-HoaiMyNeural', pitch: 0, rate: -5, voiceVolume: 100,
  music: true, ambient: 'lofi', ambientVolume: 35, trackVolume: 60, duckVolume: 15,
  readGifts: true, likeGoal: 200, giftGoal: 1000, giftGoalTitle: 'Cùng thắp sáng quán',
  songMinGift: 1, ordersOpen: true, autoPlay: true, queueLimit: 50, musicVoting: true, readFollows: true,
  stageCapacity: 5, stageMinGift: 1, stageSeconds: 10, freeStage: true,
  seatLimit: 100, bubbleSeconds: 7, bubbleLimit: 3, bubbleFont: 24, bubbleWidth: 300, hideCommands: true, animationLevel: 1, viewerAvatars: true,
};
const DRINKS = ['latte', 'den', 'tra', 'cacao'];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const normalize = value => clean(value, 160).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const publicAvatar = value => /^\/live\/avatar\/[a-f0-9]{32}\.img$/.test(String(value || '')) ? value : '';
export class CafeRoom {
  constructor(emit = () => {}, clock = Date.now) {
    this.emit = emit; this.clock = clock; this.settings = { ...DEFAULT_SETTINGS }; this.startedAt = clock();
    this.viewers = new Map(); this.supporters = new Map(); this.credits = new Map(); this.stageCredits = new Map();
    this.topics = structuredClone(TOPICS); this.lines = structuredClone(DEFAULT_LINES); this.reactions = structuredClone(DEFAULT_REACTIONS); this.reactionIndex = {}; this.followers = new Set(); this.songBallots = new Map(); this.topic = 0; this.votes = new Map();
    this.likes = 0; this.demoLikes = 0; this.trees = 0; this.lightsUntil = 0;
    this.performers = []; this.stageQueue = []; this.library = []; this.publishedTracks = new Set(); this.trackTitles = new Map(); this.catalog = []; this.queue = []; this.playing = null;
    this.sequence = 0; this.paused = false; this.position = 0; this.duration = 0; this.seekVersion = 0; this.seekTo = 0;
  }
  get stage() { return this.performers[0] || null; }
  publicViewer(v) { const { id, name, skin, drink, coins, demo, lastText, chatUntil, gesture, gestureUntil, avatar } = v; return { id, name, skin, drink, coins, demo, lastText, chatUntil, gesture, gestureUntil, avatar }; }
  community() {
    const topic = this.topics[this.topic] || this.topics[0], totals = topic.choices.map(() => 0);
    for (const vote of this.votes.values()) if (vote < totals.length) totals[vote]++;
    return { likes: this.likes, demoLikes: this.demoLikes, trees: this.trees, topic, votes: totals,
      lightsUntil: this.lightsUntil, stage: this.stage, performers: this.performers, stageQueue: this.stageQueue };
  }
  donations() {
    const all = [...this.supporters.values()], real = all.filter(v => !v.demo), demo = all.filter(v => v.demo);
    const rank = list => list.sort((a, b) => b.coins - a.coins || a.name.localeCompare(b.name, 'vi')).slice(0, 5).map(v => ({ ...v }));
    return { total: real.reduce((s, v) => s + v.coins, 0), demoTotal: demo.reduce((s, v) => s + v.coins, 0), supporterCount: real.length, leaderboard: rank(real), demoLeaderboard: rank(demo) };
  }
  radio() { return { catalog: this.catalog, library: this.library, queue: this.queue, playing: this.playing, paused: this.paused, position: this.position, duration: this.duration, seekVersion: this.seekVersion, seekTo: this.seekTo }; }
  configuration() { return { topics: this.topics, lines: this.lines, reactions: this.reactions, activeTopic: this.topic, publishedTracks: [...this.publishedTracks], trackTitles: Object.fromEntries(this.trackTitles) }; }
  exportConfig() { return { version: 4, settings: this.settings, ...this.configuration() }; }
  snapshot() { return { t: 'state', settings: this.settings, viewers: [...this.viewers.values()].map(v => this.publicViewer(v)), startedAt: this.startedAt, community: this.community(), radio: this.radio(), donations: this.donations(), configuration: this.configuration() }; }
  sendCommunity() { this.emit({ t: 'community', ...this.community() }); }
  sendRadio() { this.emit({ t: 'radio', ...this.radio() }); }
  sendDonations() { this.emit({ t: 'donations', ...this.donations() }); }
  sendConfiguration() { this.emit({ t: 'configuration', ...this.configuration() }); }
  notice(v, text) { this.emit({ t: 'notice', name: v?.name || 'Chủ quán', text }); }
  reaction(kind, values) {
    const choices = this.reactions[kind] || DEFAULT_REACTIONS[kind];
    const index = this.reactionIndex[kind] || 0; this.reactionIndex[kind] = (index + 1) % choices.length;
    return choices[index % choices.length].replace(/\{(name|gift|count)\}/g, (_, key) => String(values[key] ?? '')).slice(0, 400);
  }
  reactionAction(input) {
    if (!input || typeof input !== 'object') return;
    const next = {};
    for (const kind of ['rose', 'gift', 'follow']) {
      if (!Array.isArray(input[kind])) return this.notice(null, 'Cần đủ ba nhóm lời cảm ơn.');
      const lines = input[kind].slice(0, 12).map(text => clean(text, 320)).filter(Boolean);
      if (!lines.length) return this.notice(null, 'Mỗi nhóm cần ít nhất một câu cảm ơn.'); next[kind] = lines;
    }
    this.reactions = next; this.reactionIndex = {}; this.sendConfiguration();
  }
  follow(id, name, demo = false, avatar = '') {
    id = clean(id, 100); if (!id) return;
    const key = `${demo ? 'demo' : 'live'}:${id}`; if (this.followers.has(key)) return;
    this.followers.add(key); if (this.followers.size > 10000) this.followers.delete(this.followers.values().next().value);
    name = clean(name || id, 22); const text = this.reaction('follow', { name });
    this.emit({ t: 'follow', id, name, text, demo: !!demo, avatar: publicAvatar(avatar) }); return text;
  }
  seat(id, name, demo = false, avatar = '') {
    id = clean(id, 100); if (!id) return null;
    let v = this.viewers.get(id); if (v) { v.lastAt = this.clock(); const image = publicAvatar(avatar); if (image && v.avatar !== image) { v.avatar = image; this.emit({ t: 'viewer', v: this.publicViewer(v) }); } return v; }
    if (this.viewers.size >= this.settings.seatLimit) {
      const quiet = [...this.viewers.values()].filter(p => !p.coins && !this.performers.some(a => a.id === p.id) && !this.stageQueue.some(a => a.id === p.id)).sort((a, b) => a.lastAt - b.lastAt)[0];
      if (!quiet) return null;
      this.viewers.delete(quiet.id); this.emit({ t: 'leave', id: quiet.id });
    }
    const paid = this.supporters.get(`${demo ? 'demo' : 'live'}:${id}`)?.coins || 0;
    v = { id, name: clean(name || id, 22), skin: this.viewers.size % 6, drink: 'latte', coins: paid, demo: !!demo, avatar: publicAvatar(avatar), lastAt: this.clock(), lastText: '', chatUntil: 0, actions: {} };
    this.viewers.set(id, v); this.emit({ t: 'join', v: this.publicViewer(v) }); return v;
  }
  setDemoAudience(count, names) {
    const generated = [...this.viewers.values()].filter(v => v.demo && /^demo_\d+$/.test(v.id));
    const target = Math.min(clamp(count, 0, this.settings.seatLimit), Math.max(0, this.settings.seatLimit - (this.viewers.size - generated.length)));
    const leaving = generated.filter(v => Number(v.id.slice(5)) >= target);
    if (leaving.length) {
      const ids = new Set(leaving.map(v => v.id));
      let radioChanged = false;
      for (const id of ids) {
        this.viewers.delete(id); this.stageCredits.delete(id); this.credits.delete(id); this.votes.delete(id);
        const ballot = this.songBallots.get(id);
        if (ballot) {
          radioChanged = true;
          const item = this.queue.find(q => q.qid === ballot.qid);
          if (item) {
            item.votes = Math.max(0, (item.votes || 0) - 1);
            item.demoVotes = Math.max(0, (item.demoVotes || 0) - 1);
            item.priority = Math.max(0, item.priority - ballot.credit);
            item.demo = !item.realVotes;
          }
          this.songBallots.delete(id);
        }
        this.emit({ t: 'leave', id });
      }
      const stageChanged = [...this.performers, ...this.stageQueue].some(p => ids.has(p.id));
      this.performers = this.performers.filter(p => !ids.has(p.id));
      this.stageQueue = this.stageQueue.filter(p => !ids.has(p.id));
      if (stageChanged) { this.tick(false); this.sendCommunity(); }
      const queueBefore = this.queue.length;
      for (const item of this.queue) if (item.votes > 0 && ids.has(item.viewerId)) {
        const nextVoter = [...this.songBallots].find(([id, ballot]) => ballot.qid === item.qid && this.viewers.has(id));
        if (nextVoter) { item.viewerId = nextVoter[0]; item.name = this.viewers.get(nextVoter[0]).name; }
      }
      this.queue = this.queue.filter(q => q.host || (Number.isInteger(q.votes) ? q.votes > 0 : !ids.has(q.viewerId)));
      this.sortQueue();
      if (queueBefore !== this.queue.length || radioChanged) this.sendRadio();
    }
    for (let i = 0; i < target; i++) {
      const id = `demo_${i}`;
      if (!this.viewers.has(id) && this.viewers.size < this.settings.seatLimit) this.seat(id, `${names[i % names.length]}${i >= names.length ? ` ${i + 1}` : ''}`, true);
    }
  }
  ready(v, action, delay) { const now = this.clock(); if (v.actions[action] !== undefined && now - v.actions[action] < delay) return false; v.actions[action] = now; return true; }
  chat(id, name, text, demo = false, avatar = '') {
    text = clean(text, 160); if (!text) return;
    const v = this.seat(id, name, demo, avatar); if (!v) return this.notice({ name }, 'Quán đủ chỗ. Chủ quán có thể tăng số ghế.');
    if (!this.ready(v, 'chat', 900)) return;
    v.lastText = text; v.chatUntil = this.clock() + this.settings.bubbleSeconds * 1000;
    this.emit({ t: 'chat', id: v.id, name: v.name, text, until: v.chatUntil, demo: v.demo });
    this.redeemStage(v.id, v);
    const cmd = normalize(text);
    if (/^!uong\s/.test(cmd) && DRINKS.includes(cmd.slice(6).trim())) { v.drink = cmd.slice(6).trim(); this.emit({ t: 'viewer', v: this.publicViewer(v) }); }
    else if (/^!ao [1-6]$/.test(cmd)) { v.skin = Number(cmd.at(-1)) - 1; this.emit({ t: 'viewer', v: this.publicViewer(v) }); }
    else if (/^!?(nhay(?: [1-6])?|hat|mua|khieu vu)$/.test(cmd) && this.ready(v, 'dance', 4000)) {
      const activity = cmd.includes('hat') ? 'sing' : cmd.includes('khieu vu') ? 'ballroom' : cmd.includes('mua') ? 'ribbon' : 'dance';
      if (this.settings.freeStage) this.perform(v, activity, /[1-6]$/.test(cmd) ? Number(cmd.at(-1)) - 1 : undefined);
      else this.notice(v, 'Chủ quán đang tắt biểu diễn miễn phí. Tặng một hoa hồng để nhận một lượt nhảy nhé.');
    } else if (['den', '!den'].includes(cmd) && this.ready(v, 'light', 8000)) { this.lightsUntil = Math.max(this.lightsUntil, this.clock() + 12000); this.emit({ t: 'effect', kind: 'light', id: v.id }); this.sendCommunity(); }
    else if (['vo tay', 'vay tay', '!votay', '!vaytay'].includes(cmd) && this.ready(v, 'gesture', 5000)) { v.gesture = cmd.includes('vo') ? 'clap' : 'wave'; v.gestureUntil = this.clock() + 6000; this.emit({ t: 'viewer', v: { ...this.publicViewer(v), gesture: v.gesture, gestureUntil: v.gestureUntil } }); this.emit({ t: 'effect', kind: 'music', id: v.id }); }
    else if (/^!nhac\s/.test(cmd)) this.request(v, text.slice(6).trim());
  }
  redeemStage(id, v) {
    const credit = this.stageCredits.get(id); if (!credit) return;
    const extra = Math.floor(credit.coins / this.settings.stageMinGift);
    credit.turns += extra; credit.coins %= this.settings.stageMinGift;
    if (v && credit.turns > 0 && this.joinStage(v, credit.priority, credit.turns)) { credit.turns = 0; credit.priority = credit.coins; }
    if (!credit.coins && !credit.turns) this.stageCredits.delete(id); else this.stageCredits.set(id, credit);
  }
  perform(v, activity = 'dance', style) {
    if (activity === 'ballroom' && this.settings.stageCapacity < 2) return this.notice(v, 'Khiêu vũ cần ít nhất hai chỗ sân khấu.');
    this.tick(false);
    const existing = [...this.performers, ...this.stageQueue].find(p => p.id === v.id);
    if (existing) { existing.activity = activity; existing.style = style ?? ((existing.style || 0) + 1) % 6; existing.partnerId = null; this.pairPerformers(); this.sendCommunity(); return; }
    this.joinStage(v, 0, 1, activity, style);
  }
  pairPerformers() {
    for (const p of this.performers) if (p.partnerId && (!this.performers.some(other => other.id === p.partnerId && other.activity === 'ballroom' && other.partnerId === p.id) || p.activity !== 'ballroom')) p.partnerId = null;
    const solo = this.performers.filter(p => p.activity === 'ballroom' && !p.partnerId);
    for (let i = 0; i + 1 < solo.length; i += 2) { solo[i].partnerId = solo[i + 1].id; solo[i + 1].partnerId = solo[i].id; }
  }
  joinStage(v, priority = 0, turns = 1, activity = 'dance', style) {
    this.tick(false);
    const onStage = this.performers.find(p => p.id === v.id);
    if (onStage) { onStage.turns = Math.min(9999, onStage.turns + turns); onStage.priority += priority; this.sendCommunity(); return true; }
    const waiting = this.stageQueue.find(p => p.id === v.id);
    if (waiting) { waiting.priority += priority; waiting.turns = Math.min(9999, waiting.turns + turns); }
    else {
      const entry = { id: v.id, name: v.name, skin: v.skin, demo: !!v.demo, priority, turns: clamp(turns, 1, 9999), order: ++this.sequence, activity, style: style ?? this.sequence % 6, partnerId: null };
      if (this.performers.length < this.settings.stageCapacity) this.performers.push({ ...entry, until: this.clock() + this.settings.stageSeconds * 1000 });
      else if (this.stageQueue.length < 200) this.stageQueue.push(entry);
      else { this.notice(v, 'Hàng chờ sân khấu đầy. Lượt quà được giữ đến lần bình luận tiếp theo.'); return false; }
    }
    this.stageQueue.sort((a, b) => b.priority - a.priority || a.order - b.order); this.pairPerformers(); this.sendCommunity(); return true;
  }
  dance(v, duration) { this.joinStage(v, 0); const p = this.performers.find(a => a.id === v.id); if (p && duration) p.until = this.clock() + duration; this.sendCommunity(); }
  tick(emit = true) {
    const now = this.clock(), expired = this.performers.filter(p => p.until <= now);
    this.performers = this.performers.filter(p => p.until > now);
    for (const { until, ...p } of expired) {
      const awaitingPartner = p.activity === 'ballroom' && !p.partnerId && this.stageQueue.some(q => q.activity === 'ballroom');
      if (p.turns > 1 || awaitingPartner) this.stageQueue.push({ ...p, partnerId: null, turns: awaitingPartner ? p.turns : p.turns - 1, priority: 0, order: ++this.sequence });
    }
    this.stageQueue.sort((a, b) => b.priority - a.priority || a.order - b.order);
    let changed = expired.length > 0;
    while (this.performers.length < this.settings.stageCapacity && this.stageQueue.length) { this.performers.push({ ...this.stageQueue.shift(), until: now + this.settings.stageSeconds * 1000 }); changed = true; }
    this.pairPerformers(); if (changed && emit) this.sendCommunity(); return changed;
  }
  stageAction(action, id) {
    if (action === 'clear') { this.performers = []; this.stageQueue = []; this.stageCredits.clear(); }
    if (action === 'remove') { this.performers = this.performers.filter(p => p.id !== id); this.stageQueue = this.stageQueue.filter(p => p.id !== id); this.stageCredits.delete(id); this.tick(false); }
    if (action === 'invite') { const v = this.viewers.get(id); if (v) this.joinStage(v, 0); }
    this.sendCommunity();
  }
  like(id, count, demo = false) {
    const key = demo ? 'demoLikes' : 'likes', n = clamp(count, 1, 10000), before = Math.floor(this[key] / this.settings.likeGoal); this[key] += n;
    if (Math.floor(this[key] / this.settings.likeGoal) > before) this.lightsUntil = Math.max(this.lightsUntil, this.clock() + 20000);
    this.emit({ t: 'like', id: clean(id, 100), n: Math.min(n, 12), demo: !!demo }); this.sendCommunity();
  }
  gift(id, name, giftName, count, diamonds, demo = false) {
    id = clean(id, 100); if (!id) return;
    const v = this.viewers.get(id); // Gifts never create seats. A comment is required.
    count = clamp(count, 1, 9999); diamonds = clamp(diamonds, 1, 50000);
    const coins = count * diamonds, key = `${demo ? 'demo' : 'live'}:${id}`;
    const supporter = this.supporters.get(key) || { id, name: clean(name || id, 22), coins: 0, demo: !!demo };
    const before = demo ? 0 : this.donations().total;
    supporter.name = clean(name || id, 22); supporter.coins += coins; this.supporters.set(key, supporter); if (v) v.coins += coins;
    const tier = coins >= 99 ? 3 : coins >= 10 ? 2 : 1;
    if (tier >= 2) this.lightsUntil = Math.max(this.lightsUntil, this.clock() + 20000);
    const stageCredit = this.stageCredits.get(id) || { coins: 0, turns: 0, priority: 0 };
    const isRose = /hoa hong|rose/.test(normalize(giftName));
    const danceTurns = isRose || diamonds >= this.settings.stageMinGift ? count : Math.floor((stageCredit.coins + coins) / this.settings.stageMinGift);
    if (isRose || diamonds >= this.settings.stageMinGift) stageCredit.turns += count;
    else stageCredit.coins += coins;
    stageCredit.priority += coins; this.stageCredits.set(id, stageCredit); this.redeemStage(id, v);
    const ballot = this.songBallots.get(id);
    const queued = this.settings.musicVoting ? this.queue.find(item => item.qid === ballot?.qid) : this.queue.find(item => item.viewerId === id && !item.host);
    if (queued) { queued.priority += coins; if (ballot) ballot.credit += coins; this.sortQueue(); this.sendRadio(); }
    else this.credits.set(id, Math.min(1000000000, (this.credits.get(id) || 0) + coins));
    this.emit({ t: 'gift', id, name: supporter.name, giftName: clean(giftName || 'quà', 48), count, coins, total: supporter.coins, tier, danceTurns, demo: !!demo }); this.sendDonations();
    if (!demo && before < this.settings.giftGoal && before + coins >= this.settings.giftGoal) { this.lightsUntil = Math.max(this.lightsUntil, this.clock() + 30000); this.emit({ t: 'goalReached', title: this.settings.giftGoalTitle, total: before + coins, target: this.settings.giftGoal }); }
    this.sendCommunity();
    return this.reaction(isRose ? 'rose' : 'gift', { name: supporter.name, gift: clean(giftName || 'quà', 48), count });
  }
  updateSettings(input) {
    if (!input || typeof input !== 'object') return;
    for (const [key, max] of [['title', 36], ['subtitle', 70], ['giftGoalTitle', 40]]) if (typeof input[key] === 'string') this.settings[key] = clean(input[key], max) || DEFAULT_SETTINGS[key];
    if (typeof input.musicVoting === 'boolean' && input.musicVoting !== this.settings.musicVoting) { this.queue = this.queue.filter(q => q.host); this.songBallots.clear(); }
    for (const key of ['music', 'readGifts', 'readFollows', 'musicVoting', 'ordersOpen', 'autoPlay', 'freeStage', 'hideCommands', 'viewerAvatars']) if (typeof input[key] === 'boolean') this.settings[key] = input[key];
    if (SCENES.some(s => s.id === input.scene)) this.settings.scene = input.scene;
    if (AMBIENTS.some(s => s.id === input.ambient)) this.settings.ambient = input.ambient;
    if (['vi-VN-NamMinhNeural', 'vi-VN-HoaiMyNeural'].includes(input.voice)) this.settings.voice = input.voice;
    for (const [key, min, max] of [['rate', -50, 50], ['pitch', -50, 50], ['likeGoal', 20, 10000], ['giftGoal', 1, 1000000000], ['voiceVolume', 0, 100], ['ambientVolume', 0, 100], ['trackVolume', 0, 100], ['duckVolume', 0, 25], ['songMinGift', 0, 100000], ['queueLimit', 5, 100], ['stageMinGift', 1, 100000], ['stageSeconds', 3, 180], ['seatLimit', 12, 200], ['bubbleSeconds', 3, 15], ['bubbleLimit', 1, 8], ['bubbleFont', 18, 34], ['bubbleWidth', 180, 420]]) if (Number.isFinite(input[key])) this.settings[key] = clamp(input[key], min, max);
    if (Number.isFinite(input.stageCapacity)) this.settings.stageCapacity = clamp(input.stageCapacity, 1, 100);
    this.settings.seatLimit = Math.max(this.settings.seatLimit, this.settings.stageCapacity);
    if ([0, 1, 2].includes(input.animationLevel)) this.settings.animationLevel = input.animationLevel;
    if (this.performers.length > this.settings.stageCapacity) this.stageQueue.unshift(...this.performers.splice(this.settings.stageCapacity).map(({ until, ...p }) => p));
    // Reducing seats keeps existing donors; no one is silently discarded.
    this.tick(false); this.emit({ t: 'settings', settings: this.settings }); this.sendCommunity();
  }
  nextTopic() { this.topic = (this.topic + 1) % this.topics.length; this.votes.clear(); this.sendCommunity(); }
  topicAction(action, input = {}) {
    const i = this.topics.findIndex(q => q.id === input.id);
    if (action === 'select' && i >= 0) { this.topic = i; this.votes.clear(); }
    if (action === 'save') {
      const text = clean(input.text, 160), choices = Array.isArray(input.choices) ? input.choices.map(s => clean(s, 60)).filter(Boolean).slice(0, 6) : [];
      if (!text || choices.length < 2 || new Set(choices.map(normalize)).size !== choices.length) return this.notice(null, 'Câu hỏi cần nội dung và 2–6 đáp án khác nhau.');
      if (i < 0 && this.topics.length >= 50) return this.notice(null, 'Tối đa 50 câu hỏi.');
      const q = { id: i >= 0 ? this.topics[i].id : `q_${++this.sequence}_${this.clock()}`, text, choices };
      if (i >= 0) { this.topics[i] = q; if (i === this.topic) this.votes.clear(); } else this.topics.push(q);
    }
    if (action === 'delete' && i >= 0) {
      if (this.topics.length === 1) return this.notice(null, 'Cần giữ ít nhất một câu hỏi.');
      const activeId = this.topics[this.topic].id; this.topics.splice(i, 1);
      this.topic = Math.max(0, this.topics.findIndex(q => q.id === activeId)); if (activeId === input.id) this.votes.clear();
    }
    this.sendConfiguration(); this.sendCommunity();
  }
  lineAction(action, input = {}) {
    const i = this.lines.findIndex(l => l.id === input.id);
    if (action === 'delete' && i >= 0) this.lines.splice(i, 1);
    if (action === 'save') {
      const label = clean(input.label, 36), text = clean(input.text, 400);
      const audioUrl = /^\/assets\/radio\/[^/]+\.(mp3|wav|ogg|m4a)$/i.test(String(input.audioUrl || '')) ? clean(input.audioUrl, 600) : '';
      if (!label || (!text && !audioUrl)) return this.notice(null, 'Lời đọc cần tên nút và nội dung hoặc file giọng thu âm.');
      if (i < 0 && this.lines.length >= 30) return this.notice(null, 'Tối đa 30 lời đọc sẵn.');
      const line = { id: i >= 0 ? this.lines[i].id : `line_${++this.sequence}_${this.clock()}`, label, text, audioUrl }; if (i >= 0) this.lines[i] = line; else this.lines.push(line);
    }
    this.sendConfiguration();
  }
  loadConfig(config) {
    if (!config || typeof config !== 'object') return;
    this.publishedTracks = new Set(Array.isArray(config.publishedTracks) ? config.publishedTracks.filter(url => typeof url === 'string' && /^\/assets\/radio\/[^/]+\.(mp3|wav|ogg|m4a)$/i.test(url)).slice(0, 100) : []);
    this.trackTitles = new Map(Object.entries(config.trackTitles && typeof config.trackTitles === 'object' && !Array.isArray(config.trackTitles) ? config.trackTitles : {})
      .filter(([url, title]) => /^\/assets\/radio\/[^/]+\.(mp3|wav|ogg|m4a)$/i.test(url) && typeof title === 'string' && clean(title, 80))
      .slice(0, 100).map(([url, title]) => [url, clean(title, 80)]));
    const settings = { ...config.settings };
    if (!config.version || config.version < 4) { settings.stageMinGift = 1; settings.freeStage = true; settings.musicVoting = true; }
    this.updateSettings(settings);
    if (Array.isArray(config.topics) && config.topics.length) {
      const valid = config.topics.slice(0, 50).map((q, i) => ({ id: `q_import_${i}`, text: clean(q?.text, 160), choices: Array.isArray(q?.choices) ? q.choices.map(s => clean(s, 60)).filter(Boolean).slice(0, 6) : [] })).filter(q => q.text && q.choices.length >= 2 && new Set(q.choices.map(normalize)).size === q.choices.length);
      if (valid.length) { this.topics = valid; this.topic = clamp(config.activeTopic, 0, valid.length - 1); this.votes.clear(); }
    }
    if (Array.isArray(config.lines)) this.lines = config.lines.slice(0, 30).map((l, i) => ({ id: `line_import_${i}`, label: clean(l?.label, 36), text: clean(l?.text, 400), audioUrl: /^\/assets\/radio\/[^/]+\.(mp3|wav|ogg|m4a)$/i.test(String(l?.audioUrl || '')) ? clean(l.audioUrl, 600) : '' })).filter(l => l.label && (l.text || l.audioUrl));
    for (const line of this.lines) if (!line.audioUrl && line.text === 'Tôi chào mừng mọi người đến với Cà Phê Sau 12 giờ. Mọi người bình luận một câu để chọn chỗ ngồi nhé.') line.text = DEFAULT_LINES.find(l => l.id === 'welcome').text;
    if (!config.version || config.version < 4) for (const line of this.lines) {
      if (!line.audioUrl && line.text === 'Tôi mời mọi người chọn bài trong danh sách. Để order nhạc, mọi người tặng quà rồi bình luận chấm than nhạc kèm mã bài nhé.') line.text = DEFAULT_LINES.find(l => l.id === 'order').text;
    }
    if (config.reactions) this.reactionAction(config.reactions);
    if (this.library.length) this.setLibrary(this.library);
    this.sendConfiguration(); this.sendCommunity();
  }
  setLibrary(files) {
    this.library = files.map(track => {
      const originalTitle = track.originalTitle || track.title;
      return { ...track, originalTitle, title: this.trackTitles.get(track.url) || originalTitle };
    });
    this.catalog = this.library.filter(track => this.publishedTracks.has(track.url)).map((track, i) => ({ ...track, id: String(i + 1) }));
    const active = new Map(this.catalog.map(track => [track.url, track]));
    this.queue = this.queue.filter(item => {
      const track = active.get(item.url);
      if (!track) { this.releaseBallots(item.qid); return false; }
      item.id = track.id; item.title = track.title; return true;
    });
    if (this.playing) {
      const track = active.get(this.playing.url);
      if (track) { this.playing.id = track.id; this.playing.title = track.title; }
      else this.startTrack(null);
    }
    this.sendRadio();
  }
  renameTrack(url, title) {
    const track = this.library.find(item => item.url === url);
    if (!track || typeof title !== 'string' || !title.trim() || title.length > 80) return false;
    const next = clean(title, 80);
    if (!next || next === track.title) return false;
    if (next === track.originalTitle) this.trackTitles.delete(url);
    else this.trackTitles.set(url, next);
    this.setLibrary(this.library); this.sendConfiguration(); return true;
  }
  publishTracks(action, urls) {
    if (!['add', 'remove'].includes(action) || !Array.isArray(urls) || !urls.length || urls.length > 100) return false;
    const available = new Set(this.library.map(track => track.url));
    if (urls.some(url => typeof url !== 'string' || !available.has(url))) return false;
    const next = new Set(this.publishedTracks);
    for (const url of urls) if (action === 'add') next.add(url); else next.delete(url);
    if (next.size === this.publishedTracks.size && [...next].every(url => this.publishedTracks.has(url))) return false;
    this.publishedTracks = next; this.setLibrary(this.library); this.sendConfiguration(); return true;
  }
  findTrack(query) { const key = normalize(query); return this.catalog.find(t => t.id === key) || this.catalog.find(t => normalize(t.title) === key); }
  request(v, query) {
    if (this.settings.musicVoting) return this.voteSong(v, query);
    if (!this.settings.ordersOpen) return this.notice(v, 'Chủ quán đang tạm đóng nhận order.');
    if (!this.catalog.length) return this.notice(v, 'Chưa có nhạc. Chủ quán cần thêm file vào assets/radio.');
    if (this.queue.some(item => item.viewerId === v.id && !item.host)) return this.notice(v, 'Ông đã có một bài trong hàng chờ.');
    if (this.queue.length >= this.settings.queueLimit) return this.notice(v, 'Hàng chờ đã đầy, thử lại sau nhé!');
    const track = this.findTrack(query); if (!track) return this.notice(v, 'Không tìm thấy bài. Dùng !nhac và mã bài trong danh sách.');
    const credit = this.credits.get(v.id) || 0;
    if (credit < this.settings.songMinGift) return this.notice(v, `Order cần quà từ ${this.settings.songMinGift} KC. Tặng quà rồi gửi lại !nhac nhé.`);
    if (!this.ready(v, 'song', 30000)) return this.notice(v, 'Mỗi người order tối đa một lần trong 30 giây.');
    this.credits.delete(v.id);
    this.queue.push({ ...track, qid: `song_${++this.sequence}`, viewerId: v.id, name: v.name, demo: v.demo, priority: credit, order: this.sequence, manualRank: 0, host: false });
    this.sortQueue(); this.sendRadio();
  }
  voteSong(v, query) {
    if (!this.settings.ordersOpen) return this.notice(v, 'Chủ quán đang tạm đóng bình chọn nhạc.');
    const track = this.findTrack(query); if (!track) return this.notice(v, 'Không tìm thấy bài. Xem mã nhạc trên màn hình rồi gõ !nhac MÃ nhé.');
    if (this.playing?.url === track.url) return this.notice(v, 'Bài này đang phát rồi. Bạn chọn bài tiếp theo nhé.');
    const previous = this.songBallots.get(v.id);
    let item = this.queue.find(q => q.url === track.url && !q.host);
    if (previous?.qid === item?.qid && item) return this.notice(v, 'Bạn đã chọn bài này rồi. Một người được tính một phiếu nhé.');
    if (!item && this.queue.length >= this.settings.queueLimit) return this.notice(v, 'Hàng chờ đã đầy. Bạn vẫn có thể chọn một bài đang chờ.');
    if (!this.ready(v, 'songVote', 3000)) return this.notice(v, 'Bạn đợi 3 giây trước khi đổi bài nhé.');
    let credit = this.credits.get(v.id) || 0;
    if (previous) {
      const old = this.queue.find(q => q.qid === previous.qid);
      if (old) { old.votes--; old[previous.demo ? 'demoVotes' : 'realVotes']--; old.demo = old.realVotes === 0; old.priority = Math.max(0, old.priority - previous.credit); credit += previous.credit; if (!old.votes) this.queue = this.queue.filter(q => q !== old); }
    }
    if (!item) {
      item = { ...track, qid: `song_${++this.sequence}`, viewerId: v.id, name: v.name, demo: !!v.demo, priority: 0, order: this.sequence, manualRank: 0, host: false, votes: 0, realVotes: 0, demoVotes: 0 };
      this.queue.push(item);
    }
    item.votes++; item[v.demo ? 'demoVotes' : 'realVotes']++; item.demo = item.realVotes === 0; item.priority += credit;
    this.songBallots.set(v.id, { qid: item.qid, credit, demo: !!v.demo }); this.credits.delete(v.id);
    this.sortQueue(); this.sendRadio();
  }
  sortQueue() { this.queue.sort((a, b) => (b.manualRank || 0) - (a.manualRank || 0) || (this.settings.musicVoting ? (b.votes || 0) - (a.votes || 0) : 0) || b.priority - a.priority || a.order - b.order); }
  releaseBallots(qid) { for (const [id, ballot] of this.songBallots) if (ballot.qid === qid) this.songBallots.delete(id); }
  addHostTrack(id, playNow = false) {
    const track = this.findTrack(id); if (!track) return this.notice(null, 'Không tìm thấy file nhạc.');
    if (this.queue.length >= this.settings.queueLimit) return this.notice(null, 'Hàng chờ đầy. Xóa bớt bài trước.');
    const item = { ...track, qid: `song_${++this.sequence}`, viewerId: 'host', name: 'Chủ quán', host: true, demo: false, priority: 0, manualRank: 0, order: this.sequence };
    this.queue.push(item); if (playNow) this.queueAction('play', item.qid); else this.sendRadio();
  }
  queueAction(action, qid, direction) {
    const i = this.queue.findIndex(q => q.qid === qid);
    if (action === 'clear') { this.queue = []; this.songBallots.clear(); }
    if (i >= 0) {
      if (action === 'remove') { this.releaseBallots(qid); this.queue.splice(i, 1); }
      if (action === 'pin') { this.queue[i].manualRank = Math.max(0, ...this.queue.map(q => q.manualRank || 0)) + 1; this.sortQueue(); }
      if (action === 'unpin') { this.queue[i].manualRank = 0; this.sortQueue(); }
      if (action === 'move') {
        const target = Math.max(0, Math.min(this.queue.length - 1, i + (direction === 'up' ? -1 : 1)));
        const [item] = this.queue.splice(i, 1); this.queue.splice(target, 0, item);
        this.queue.forEach((q, index) => { q.manualRank = this.queue.length - index; });
      }
      if (action === 'play') { const [item] = this.queue.splice(i, 1); this.startTrack(item); }
    }
    this.sendRadio();
  }
  startTrack(item) { if (item) this.releaseBallots(item.qid); this.playing = item ? { ...item, token: ++this.sequence } : null; this.position = 0; this.duration = 0; this.seekTo = 0; this.seekVersion++; this.paused = false; }
  nextTrack() { this.startTrack(this.queue.shift() || null); this.sendRadio(); return this.playing; }
  playback(action, value) {
    if (action === 'pause') this.paused = true;
    if (action === 'resume') { this.paused = false; if (!this.playing && this.queue.length) this.startTrack(this.queue.shift()); }
    if (action === 'stop') { this.startTrack(null); this.paused = true; }
    if (action === 'seek' && this.playing && Number.isFinite(value)) { this.seekTo = Math.max(0, Math.min(this.duration || 86400, value)); this.position = this.seekTo; this.seekVersion++; }
    this.sendRadio();
  }
  clear() {
    this.viewers.clear(); this.queue = []; this.songBallots.clear(); this.followers.clear(); this.startTrack(null); this.votes.clear(); this.credits.clear(); this.stageCredits.clear();
    this.likes = 0; this.demoLikes = 0; this.supporters.clear(); this.trees = 0; this.performers = []; this.stageQueue = []; this.lightsUntil = 0; this.emit(this.snapshot());
  }
}
export function normalizeGift(data) {
  const gift = data.giftDetails || data.gift || {}, ext = data.extendedGiftInfo || {};
  const type = Number(gift.giftType ?? gift.type ?? data.giftType ?? ext.type ?? 0); if (type === 1 && !data.repeatEnd) return null;
  return { giftName: gift.giftName || gift.name || data.giftName || ext.name || 'quà', count: data.repeatCount || 1, diamonds: gift.diamondCount ?? gift.diamond_count ?? data.diamondCount ?? ext.diamond_count ?? ext.diamondCount ?? 1 };
}
