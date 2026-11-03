import test from 'node:test';
import assert from 'node:assert/strict';
import { CafeRoom } from '../cafe.mjs';
import { SCENES, AMBIENTS } from '../presets.js';
import { placeBubbles, overlaps } from '../bubble-layout.js';
import { getStageTargets } from '../scene-renderer.js';
function setup() { let now = 100000; const events = [], room = new CafeRoom(e => events.push(structuredClone(e)), () => now); room.updateSettings({ musicVoting: false }); room.catalog = [{ id: '1', title: 'Mưa', url: '/assets/radio/mua.mp3' }, { id: '2', title: 'Đêm', url: '/assets/radio/dem.mp3' }]; return { room, events, tick: (n = 1000) => { now += n; } }; }
test('changing demo audience from 100 to 12 removes surplus guests but keeps LIVE and manual guests', () => {
  const { room, events } = setup(); room.updateSettings({ seatLimit: 64 });
  room.seat('live_1', 'Khách LIVE'); room.seat('sim_Bách', 'Khách thử', true);
  room.setDemoAudience(100, ['Bách', 'Mây']);
  assert.equal(room.viewers.size, 64);
  assert.equal([...room.viewers.values()].filter(v => /^demo_\d+$/.test(v.id)).length, 62);
  room.setDemoAudience(12, ['Bách', 'Mây']);
  assert.equal(room.viewers.size, 14);
  assert.equal([...room.viewers.values()].filter(v => /^demo_\d+$/.test(v.id)).length, 12);
  assert.ok(room.viewers.has('live_1')); assert.ok(room.viewers.has('sim_Bách'));
  assert.equal(events.filter(e => e.t === 'leave').length, 50);
  room.setDemoAudience(36, ['Bách', 'Mây']);
  assert.equal(room.viewers.size, 38);
});
test('removing surplus demo guests cleans their stage turns and music votes', () => {
  const { room, events } = setup(); room.updateSettings({ stageCapacity: 1, musicVoting: true });
  room.setLibrary([{ title: 'Mưa', url: '/assets/radio/mua.mp3' }]); room.publishTracks('add', ['/assets/radio/mua.mp3']);
  room.seat('live_1', 'Khách LIVE'); room.setDemoAudience(36, ['Bách']);
  room.perform(room.viewers.get('demo_30')); room.perform(room.viewers.get('live_1'));
  room.chat('demo_30', 'Bách 31', '!nhac 1', true); room.chat('live_1', 'Khách LIVE', '!nhac 1');
  assert.equal(room.queue[0].votes, 2);
  room.setDemoAudience(12, ['Bách']);
  assert.equal(room.performers[0].id, 'live_1'); assert.equal(room.stageQueue.length, 0);
  assert.equal(room.queue[0].votes, 1); assert.equal(room.queue[0].demoVotes, 0);
  assert.equal(room.queue[0].viewerId, 'live_1'); assert.equal(room.queue[0].name, 'Khách LIVE');
  assert.ok(room.songBallots.has('live_1')); assert.ok(!room.songBallots.has('demo_30'));
  assert.ok(events.some(e => e.t === 'community' && e.performers[0]?.id === 'live_1'));
  assert.ok(events.some(e => e.t === 'radio' && e.queue[0]?.votes === 1));
});
test('file library needs explicit publication before songs appear for viewers', () => {
  const room = new CafeRoom();
  const files = [{ title: 'Mưa', url: '/assets/radio/mua.mp3' }, { title: 'Đêm', url: '/assets/radio/dem.mp3' }];
  room.setLibrary(files);
  assert.equal(room.radio().library.length, 2); assert.equal(room.radio().catalog.length, 0);
  room.chat('a', 'An', '!nhac 1'); assert.equal(room.queue.length, 0);
  assert.equal(room.publishTracks('add', [files[1].url]), true);
  assert.deepEqual(room.catalog.map(t => [t.id, t.title]), [['1', 'Đêm']]);
  room.chat('b', 'Bách', '!nhac 1'); assert.equal(room.queue[0].title, 'Đêm');
  assert.equal(room.publishTracks('remove', [files[1].url]), true);
  assert.equal(room.catalog.length, 0); assert.equal(room.queue.length, 0); assert.equal(room.songBallots.size, 0);
  room.publishTracks('add', [files[0].url]); room.addHostTrack('1', true);
  assert.equal(room.playing.title, 'Mưa'); room.publishTracks('remove', [files[0].url]); assert.equal(room.playing, null);
  assert.equal(room.publishTracks('add', ['/assets/radio/not-in-library.mp3']), false);
});
test('selected music survives configuration export and new uploads stay unpublished', () => {
  const first = { title: 'Mưa', url: '/assets/radio/mua.mp3' }, second = { title: 'Đêm', url: '/assets/radio/dem.mp3' };
  const room = new CafeRoom(); room.setLibrary([first]); room.publishTracks('add', [first.url]);
  const restored = new CafeRoom(); restored.loadConfig(room.exportConfig()); restored.setLibrary([first, second]);
  assert.deepEqual(restored.catalog.map(t => t.title), ['Mưa']);
  assert.equal(restored.library.length, 2);
});
test('renaming a song updates the library, queue and playing title without changing its file or code', () => {
  const file = { title: 'bai_hat_01', url: '/assets/radio/bai_hat_01.mp3' };
  const room = new CafeRoom(); room.setLibrary([file]);
  assert.equal(room.renameTrack(file.url, 'Đêm bình yên'), true);
  assert.equal(room.library[0].title, 'Đêm bình yên'); assert.equal(room.catalog.length, 0);
  room.publishTracks('add', [file.url]); room.addHostTrack('1'); room.addHostTrack('1', true);
  const token = room.playing.token;
  assert.equal(room.renameTrack(file.url, 'Cà phê và mưa'), true);
  assert.equal(room.catalog[0].id, '1'); assert.equal(room.catalog[0].url, file.url);
  assert.equal(room.queue[0].title, 'Cà phê và mưa'); assert.equal(room.playing.title, 'Cà phê và mưa');
  assert.equal(room.playing.token, token, 'Changing display name must not restart the audio');
  room.setLibrary([file]); assert.equal(room.catalog[0].title, 'Cà phê và mưa');
  const restored = new CafeRoom(); restored.loadConfig(room.exportConfig()); restored.setLibrary([file]);
  assert.equal(restored.catalog[0].title, 'Cà phê và mưa');
  assert.equal(room.renameTrack(file.url, file.title), true); assert.equal(room.trackTitles.size, 0);
  assert.equal(room.catalog[0].title, file.title);
  assert.equal(room.renameTrack(file.url, ''), false);
  assert.equal(room.renameTrack('/assets/radio/missing.mp3', 'Không có'), false);
});
test('a gift before the first chat is retained for order and stage', () => {
  const { room } = setup(); room.gift('a', 'An', 'Quà', 1, 100); assert.equal(room.viewers.size, 0);
  room.chat('a', 'An', '!nhac 1'); assert.equal(room.viewers.size, 1); assert.equal(room.queue[0].priority, 100); assert.equal(room.performers[0].id, 'a');
});
test('gift credit is consumed once, and pending song receives subsequent gift priority', () => {
  const { room, tick } = setup(); room.chat('a', 'An', '!nhac 1'); assert.equal(room.queue.length, 0);
  room.gift('a', 'An', 'Rose', 1, 1); tick(); room.chat('a', 'An', '!nhac 1'); assert.equal(room.queue[0].priority, 1);
  room.gift('a', 'An', 'Quà', 1, 100); assert.equal(room.queue[0].priority, 101); room.nextTrack(); tick(30000);
  room.chat('a', 'An', '!nhac 2'); assert.equal(room.queue.length, 0, 'Spent gifts cannot keep buying new songs');
});
test('highest paid request wins; host pin and move override future gifts', () => {
  const { room } = setup(); for (const [id, coins] of [['a', 1], ['b', 30], ['c', 99]]) { room.gift(id, id, 'Quà', 1, coins); room.chat(id, id, '!nhac 1'); }
  assert.deepEqual(room.queue.map(q => q.viewerId), ['c', 'b', 'a']);
  const a = room.queue.find(q => q.viewerId === 'a'); room.queueAction('pin', a.qid); room.gift('c', 'c', 'Quà', 1, 1000); assert.equal(room.queue[0].viewerId, 'a');
  room.queueAction('move', room.queue[1].qid, 'down'); assert.deepEqual(room.queue.map(q => q.viewerId), ['a', 'b', 'c']);
});
test('host can add, interrupt with a queued song, remove, clear and control playback', () => {
  const { room } = setup(); room.addHostTrack('1'); room.addHostTrack('2'); room.queueAction('play', room.queue[1].qid);
  assert.equal(room.playing.title, 'Đêm'); assert.equal(room.queue.length, 1); const token = room.playing.token;
  room.playback('pause'); assert.equal(room.paused, true); room.duration = 100; room.playback('seek', 150); assert.equal(room.seekTo, 100);
  room.playback('resume'); assert.equal(room.paused, false); room.nextTrack(); assert.notEqual(room.playing.token, token);
  room.addHostTrack('2'); room.queueAction('remove', room.queue[0].qid); assert.equal(room.queue.length, 0);
  room.addHostTrack('1'); room.queueAction('clear'); assert.equal(room.queue.length, 0); room.playback('stop'); assert.equal(room.playing, null); assert.equal(room.paused, true);
  room.updateSettings({ autoPlay: false }); room.addHostTrack('2'); room.playback('resume'); assert.equal(room.playing.title, 'Đêm', 'Host resume starts a queued song even with automatic playback off');
});
test('host can close orders while retaining management rights', () => {
  const { room } = setup(); room.updateSettings({ ordersOpen: false }); room.gift('a', 'An', 'Quà', 1, 100); room.chat('a', 'An', '!nhac 1'); assert.equal(room.queue.length, 0); room.addHostTrack('1'); assert.equal(room.queue.length, 1);
});
test('stage capacity 5/7/8, overflow priorities, expiration and removal', () => {
  const { room, tick } = setup(); room.updateSettings({ stageCapacity: 5, stageSeconds: 10 });
  for (let i = 0; i < 8; i++) { room.chat(String(i), `Khách ${i}`, 'Chào'); room.gift(String(i), `Khách ${i}`, 'Quà', 1, 100 + i); }
  assert.equal(room.performers.length, 5); assert.equal(room.stageQueue.length, 3); assert.equal(room.stageQueue[0].id, '7');
  room.stageAction('remove', '0'); assert.ok(room.performers.some(p => p.id === '7'));
  room.updateSettings({ stageCapacity: 8 }); assert.equal(room.performers.length, 7); assert.equal(room.stageQueue.length, 0);
  tick(11000); room.tick(); assert.equal(room.performers.length, 0);
});
test('cumulative small gifts can earn one stage visit', () => {
  const { room } = setup(); room.chat('a', 'An', 'Chào'); room.gift('a', 'An', 'Rose', 50, 1); room.gift('a', 'An', 'Rose', 49, 1); assert.equal(room.performers.length, 1);
});
test('legacy question data remains valid but answer commands no longer count votes', () => {
  const { room, tick } = setup(); room.topicAction('save', { text: 'Chọn một số?', choices: ['Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu'] });
  const q = room.topics.at(-1); room.topicAction('select', { id: q.id }); room.chat('a', 'An', '!f'); assert.deepEqual(room.community().votes, [0, 0, 0, 0, 0, 0]);
  room.topicAction('save', { id: q.id, text: 'Hai lựa chọn?', choices: ['Có', 'Không'] }); assert.deepEqual(room.community().votes, [0, 0]);
  tick(); room.chat('a', 'An', '!f'); assert.deepEqual(room.community().votes, [0, 0]);
  room.topicAction('delete', { id: q.id }); assert.notEqual(room.community().topic.id, q.id);
  const count = room.topics.length; room.topicAction('save', { text: 'Lỗi', choices: ['Có', 'Có'] }); assert.equal(room.topics.length, count);
});
test('speech presets and settings round-trip through persisted configuration', () => {
  const { room } = setup(); room.updateSettings({ scene: 'sakura', pitch: -20, rate: 15, voiceVolume: 80, seatLimit: 200, ambient: 'bossa' });
  room.lineAction('save', { label: 'Lời chào', text: 'Chào cả quán.' }); room.topicAction('save', { text: 'Hôm nay thế nào?', choices: ['Vui', 'Buồn'] });
  const restored = new CafeRoom(); restored.loadConfig(JSON.parse(JSON.stringify(room.exportConfig())));
  assert.equal(restored.settings.scene, 'sakura'); assert.equal(restored.settings.pitch, -20); assert.equal(restored.settings.seatLimit, 200);
  assert.equal(restored.lines.at(-1).text, 'Chào cả quán.'); assert.equal(restored.topics.at(-1).choices.length, 2);
});
test('10 distinct scenes and six music presets are valid settings', () => {
  const { room } = setup(); assert.equal(SCENES.length, 10); assert.equal(new Set(SCENES.map(s => s.motif)).size, 10); assert.equal(AMBIENTS.length, 6);
  for (const s of SCENES) { room.updateSettings({ scene: s.id }); assert.equal(room.settings.scene, s.id); }
  room.updateSettings({ trackVolume: 200, duckVolume: 100, pitch: -100, bubbleLimit: 500, stageCapacity: 999 }); assert.equal(room.settings.trackVolume, 100); assert.equal(room.settings.duckVolume, 25); assert.equal(room.settings.pitch, -50); assert.equal(room.settings.bubbleLimit, 8); assert.equal(room.settings.stageCapacity, 100);
});
test('recorded host lines retain local audio, reject remote URLs and persist safely', () => {
  const { room } = setup(); room.lineAction('save', { label: 'Thu âm', audioUrl: '/assets/radio/hello.wav', text: '' });
  assert.equal(room.lines.at(-1).audioUrl, '/assets/radio/hello.wav'); const count = room.lines.length;
  room.lineAction('save', { label: 'URL lạ', audioUrl: 'https://evil.example/voice.mp3', text: '' }); assert.equal(room.lines.length, count);
  const restored = new CafeRoom(); restored.loadConfig(room.exportConfig()); assert.equal(restored.lines.at(-1).audioUrl, '/assets/radio/hello.wav');
});
test('seat setting permits 200 viewers and protects donors at a full limit', () => {
  const { room } = setup(); room.updateSettings({ seatLimit: 200 }); for (let i = 0; i < 200; i++) room.chat(String(i), 'Khách', 'Chào'); assert.equal(room.viewers.size, 200);
  room.gift('0', 'Khách', 'Quà', 1, 1); room.chat('new', 'Mới', 'Chào'); assert.equal(room.viewers.size, 200); assert.ok(room.viewers.has('0'));
});
test('bubble placement cannot overlap, exceed bounds or draw more than the configured count', () => {
  const input = Array.from({ length: 200 }, (_, i) => ({ id: i, w: 280, h: 90, anchorX: 540, anchorY: 1200 })), bounds = { x: 25, y: 1025, w: 1030, h: 350 };
  const boxes = placeBubbles(input, bounds, 8, 10); assert.ok(boxes.length > 1); assert.ok(boxes.length <= 8);
  boxes.forEach((a, i) => { assert.ok(a.x >= bounds.x && a.y >= bounds.y && a.x + a.w <= bounds.x + bounds.w && a.y + a.h <= bounds.y + bounds.h); boxes.slice(i + 1).forEach(b => assert.equal(overlaps(a, b, 9), false)); });
});
test('one rose grants one turn and combo quantity grants that many turns', () => {
  const { room, tick, events } = setup(); room.updateSettings({ stageSeconds: 3 }); room.chat('a', 'An', 'Chào quán'); room.gift('a', 'An', 'Rose', 1, 1);
  assert.equal(events.find(e => e.t === 'gift').danceTurns, 1);
  assert.equal(room.performers[0].turns, 1); const firstEnd = room.performers[0].until;
  tick(); room.gift('a', 'An', 'Rose', 2, 1); assert.equal(room.performers[0].turns, 3); assert.equal(room.performers[0].until, firstEnd, 'Additional gifts add turns, never reset the current countdown');
  tick(2100); room.tick(); assert.equal(room.performers[0].turns, 2);
  tick(3100); room.tick(); assert.equal(room.performers[0].turns, 1);
  tick(3100); room.tick(); assert.equal(room.performers.length, 0);
});
test('a high-value single gift is one turn; unseated combo tickets wait for a comment', () => {
  const { room, tick } = setup(); room.gift('a', 'An', 'Rose', 5, 1); assert.equal(room.viewers.size, 0);
  room.chat('a', 'An', 'Tôi vào quán'); assert.equal(room.performers[0].turns, 5);
  tick(); room.chat('a', 'An', 'Tôi vẫn ở đây'); assert.equal(room.performers[0].turns, 5);
  room.chat('b', 'Bách', 'Chào'); room.gift('b', 'Bách', 'Galaxy', 1, 1000); assert.equal(room.performers.find(v => v.id === 'b').turns, 1);
});
test('remaining turns rejoin behind a waiting guest instead of monopolizing a stage slot', () => {
  const { room, tick } = setup(); room.updateSettings({ stageSeconds: 3 });
  for (let i = 0; i < 5; i++) { room.chat(String(i), 'Khách', 'Chào'); room.gift(String(i), 'Khách', 'Rose', i === 0 ? 3 : 1, 1); tick(100); }
  room.chat('wait', 'Chờ', 'Chào'); room.gift('wait', 'Chờ', 'Rose', 1, 1); tick(2550); room.tick();
  assert.ok(room.performers.some(v => v.id === 'wait')); assert.equal(room.stageQueue.find(v => v.id === '0').turns, 2); assert.ok(!room.performers.some(v => v.id === '0'));
});
test('old configuration enables comment performances and voting while preserving host customization', () => {
  const { room } = setup(); room.loadConfig({ version: 2, settings: { title: 'Quán của Bách', stageMinGift: 99, stageSeconds: 35, stageCapacity: 7, seatLimit: 36 } });
  assert.equal(room.settings.stageMinGift, 1); assert.equal(room.settings.stageSeconds, 35); assert.equal(room.settings.title, 'Quán của Bách'); assert.equal(room.settings.seatLimit, 36); assert.equal(room.settings.stageCapacity, 7);
  assert.equal(room.settings.freeStage, true); assert.equal(room.settings.musicVoting, true);
  const config = room.exportConfig(); assert.equal(config.version, 4); config.settings.stageMinGift = 5; room.loadConfig(config); assert.equal(room.settings.stageMinGift, 5, 'New manual settings are not overwritten on restart');
});
test('the old default welcome line no longer asks viewers to comment for a seat', () => {
  const room = new CafeRoom();
  room.loadConfig({ version: 4, lines: [{ label: 'Chào khách', text: 'Tôi chào mừng mọi người đến với Cà Phê Sau 12 giờ. Mọi người bình luận một câu để chọn chỗ ngồi nhé.' }] });
  assert.match(room.lines[0].text, /vào quán là có chỗ ngồi/);
});
test('stage speech fits above the actor and avoids information panels', () => {
  const target = getStageTargets([{ id: 'a' }]).get('a'); assert.equal(target.y, 931);
  const [box] = placeBubbles([{ id: 'a', anchorX: target.x, anchorY: target.y - 107 * target.scale, w: 280, h: 85 }], { x: 25, y: 740, w: 1030, h: 635 }, 3, 10, [{ x: 55, y: 365, w: 310, h: 300 }, { x: 715, y: 575, w: 310, h: 180 }]);
  assert.ok(box); assert.ok(box.y + box.h < target.y); assert.ok(box.y < 900);
});
