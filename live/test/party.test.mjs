import test from 'node:test';
import assert from 'node:assert/strict';
import { CafeRoom } from '../cafe.mjs';
import { characterPose } from '../motion.js';
import { getStageTargets } from '../scene-renderer.js';
function setup() {
  let now = 100000; const events = [], room = new CafeRoom(m => events.push(structuredClone(m)), () => now);
  room.catalog = Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1), title: `Song ${i + 1}`, url: `/assets/radio/${i}.mp3` }));
  return { room, events, tick: (n = 4000) => { now += n; } };
}
test('default comment actions seat the viewer and start the requested activity', () => {
  const { room, tick } = setup();
  room.updateSettings({ stageSeconds: 180 });
  for (const [text, activity] of [['nhảy', 'dance'], ['HÁT', 'sing'], ['múa', 'ribbon'], ['khiêu vũ', 'ballroom']]) {
    room.chat('a', 'An', text); assert.equal(room.performers[0].activity, activity); tick();
  }
  assert.equal(room.performers[0].turns, 1, 'Switching activities cannot buy extra turns');
  assert.equal(room.performers[0].until, 280000, 'Switching cannot extend the current timer');
});
test('six dance selections differ, ordinary sentences do not trigger commands', () => {
  const { room, tick } = setup(); room.updateSettings({ stageSeconds: 180 });
  for (let i = 1; i <= 6; i++) { room.chat('a', 'An', `nhảy ${i}`); assert.equal(room.performers[0].style, i - 1); tick(); }
  const poses = Array.from({ length: 6 }, (_, i) => JSON.stringify(characterPose(2.4, 18, 'dance', false, 1, i)));
  assert.equal(new Set(poses).size, 6);
  room.chat('b', 'Bach', 'tôi thích hát'); assert.ok(!room.performers.some(p => p.id === 'b'));
});
test('a rose always grants a turn even above the other gift threshold; gifts outrank free stage queue', () => {
  const { room } = setup(); room.updateSettings({ stageMinGift: 99 });
  for (let i = 0; i < 5; i++) room.chat(String(i), 'Guest', 'nhảy');
  room.chat('free', 'Free', 'hát'); room.chat('paid', 'Paid', 'Xin chào'); room.gift('paid', 'Paid', 'Rose', 1, 1);
  assert.equal(room.stageQueue[0].id, 'paid'); assert.equal(room.stageQueue[0].turns, 1);
});
test('ballroom pairs willing guests only, stays adjacent, and cleans up a removed partner', () => {
  const { room } = setup(); room.chat('a', 'An', 'khiêu vũ'); room.chat('x', 'X', 'hát');
  assert.equal(room.performers[0].partnerId, null); room.chat('b', 'Bach', 'khiêu vũ');
  const a = room.performers.find(p => p.id === 'a'), b = room.performers.find(p => p.id === 'b');
  assert.equal(a.partnerId, 'b'); assert.equal(b.partnerId, 'a');
  const targets = getStageTargets(room.performers); assert.ok(Math.abs(Math.abs(targets.get('a').x - targets.get('b').x) - 104 * .95) < .001, 'Paired hands should meet');
  assert.equal(targets.get('a').facing, 1); assert.equal(targets.get('b').facing, -1);
  room.stageAction('remove', 'a'); assert.equal(b.partnerId, null);
});
test('an awaiting ballroom guest pairs only after an actual slot opens', () => {
  const { room } = setup(); for (let i = 0; i < 4; i++) room.chat(String(i), 'Guest', 'nhảy');
  room.chat('a', 'An', 'khiêu vũ'); room.chat('b', 'Bach', 'khiêu vũ');
  assert.equal(room.performers.find(p => p.id === 'a').partnerId, null);
  room.stageAction('remove', '0'); assert.equal(room.performers.find(p => p.id === 'a').partnerId, 'b');
});
test('an unpaired ballroom turn is retained when its partner was waiting for a slot', () => {
  const { room, tick } = setup(); for (let i = 0; i < 4; i++) room.chat(String(i), 'Guest', 'nhảy');
  room.chat('a', 'An', 'khiêu vũ'); room.chat('b', 'Bach', 'khiêu vũ'); tick(11000); room.tick();
  assert.equal(room.performers.length, 2); assert.equal(room.performers.find(p => p.id === 'a').partnerId, 'b');
});
test('a queued free performer is not evicted when all seats fill', () => {
  const { room } = setup(); room.updateSettings({ seatLimit: 12 });
  for (let i = 0; i < 12; i++) room.chat(String(i), 'Guest', i < 6 ? 'hát' : 'Chào');
  assert.equal(room.stageQueue[0].id, '5'); room.chat('new', 'New', 'Chào');
  assert.ok(room.viewers.has('5')); assert.equal(room.viewers.size, 12);
});
test('unique song votes aggregate, repeated codes cannot inflate counts, and gifts only break ties', () => {
  const { room, tick } = setup();
  room.gift('a', 'An', 'Galaxy', 1, 1000); room.chat('a', 'An', '!nhac 1');
  room.chat('b', 'Bach', '!nhac 2'); room.chat('c', 'Chi', '!nhac 2');
  assert.equal(room.queue[0].id, '2'); assert.equal(room.queue[0].votes, 2); assert.equal(room.queue[1].priority, 1000);
  tick(); room.chat('c', 'Chi', '!nhac 2'); assert.equal(room.queue[0].votes, 2);
  room.chat('d', 'Dao', '!nhac 1'); assert.equal(room.queue[0].id, '1', 'Gifts decide ties only');
  room.queueAction('pin', room.queue[1].qid); assert.equal(room.queue[0].id, '2', 'Host pin wins');
});
test('changing a vote moves one person and attached gift credit without duplicating it', () => {
  const { room, tick } = setup(); room.chat('a', 'An', '!nhac 1'); room.chat('b', 'Bach', '!nhac 1');
  room.gift('a', 'An', 'Rose', 3, 1); tick(); room.chat('a', 'An', '!nhac 2');
  assert.equal(room.queue.find(q => q.id === '1').votes, 1); assert.equal(room.queue.find(q => q.id === '1').priority, 0);
  assert.equal(room.queue.find(q => q.id === '2').votes, 1); assert.equal(room.queue.find(q => q.id === '2').priority, 3);
  room.queueAction('play', room.queue.find(q => q.id === '2').qid); assert.ok(!room.songBallots.has('a'));
  tick(); room.chat('a', 'An', '!nhac 3'); assert.equal(room.queue.find(q => q.id === '3').priority, 0);
});
test('renumbering the catalogue cannot send votes to a different file with the old number', () => {
  const { room } = setup(); room.chat('a', 'An', '!nhac 1');
  const originalUrl = room.queue[0].url;
  room.catalog = [{ id: '1', title: 'New track', url: '/assets/radio/new.mp3' }, { ...room.catalog[0], id: '2' }];
  room.chat('b', 'Bach', '!nhac 1'); room.chat('c', 'Chi', '!nhac 2');
  assert.equal(room.queue.length, 2);
  assert.equal(room.queue.find(q => q.url === originalUrl).votes, 2);
  assert.equal(room.queue.find(q => q.url === '/assets/radio/new.mp3').votes, 1);
});
test('full music queue still accepts votes for queued songs and rejects new tracks', () => {
  const { room } = setup(); room.updateSettings({ queueLimit: 5 });
  for (let i = 1; i <= 5; i++) room.chat(String(i), 'Guest', `!nhac ${i}`);
  room.chat('six', 'Six', '!nhac 6'); assert.equal(room.queue.length, 5);
  room.chat('seven', 'Seven', '!nhac 1'); assert.equal(room.queue.find(q => q.id === '1').votes, 2);
  room.queueAction('clear'); assert.equal(room.songBallots.size, 0);
});
test('DEMO and real song votes are labelled separately and mode changes release ballots', () => {
  const { room, tick } = setup(); room.chat('a', 'An', '!nhac 1', true); room.chat('b', 'Bach', '!nhac 1');
  assert.equal(room.queue[0].demoVotes, 1); assert.equal(room.queue[0].realVotes, 1); assert.equal(room.queue[0].demo, false);
  tick(); room.chat('b', 'Bach', '!nhac 2'); assert.equal(room.queue.find(q => q.id === '1').demo, true);
  room.addHostTrack('3'); room.updateSettings({ musicVoting: false }); assert.equal(room.songBallots.size, 0); assert.equal(room.queue.length, 1); assert.equal(room.queue[0].host, true);
});
test('follow thanks deduplicate per viewer and never seat anyone or alter donations', () => {
  const { room, events } = setup(); const text = room.follow('a', 'An');
  assert.equal(text, 'Cảm ơn bạn An đã follow kênh của mình nhé.'); assert.equal(room.follow('a', 'An'), undefined);
  assert.equal(events.filter(e => e.t === 'follow').length, 1); assert.equal(room.viewers.size, 0); assert.equal(room.donations().total, 0);
});
test('custom thanks rotate without repetition, expand safe tokens once and survive a restart', () => {
  const { room } = setup(); const reactions = { rose: ['Mình cảm ơn bạn {name}: {count} {gift}.', 'Bạn {name} dễ thương quá, mình cảm ơn nhé.'], gift: ['Mình cảm ơn bạn {name}.'], follow: ['Cảm ơn bạn {name} đã follow kênh của mình nhé.'] };
  room.reactionAction(reactions); const a = room.gift('a', 'An', 'Rose', 2, 1), b = room.gift('a', 'An', 'Rose', 1, 1), c = room.gift('a', 'An', 'Rose', 2, 1);
  assert.equal(a, 'Mình cảm ơn bạn An: 2 Rose.'); assert.notEqual(a, b); assert.equal(a, c);
  const restored = new CafeRoom(); restored.loadConfig(room.exportConfig()); assert.deepEqual(restored.reactions, reactions);
  room.reactionAction({ ...reactions, rose: [] }); assert.deepEqual(room.reactions, reactions, 'Invalid edits are atomic');
  assert.equal(room.reaction('gift', { name: '{gift}', gift: 'Rose' }), 'Mình cảm ơn bạn {gift}.', 'Names cannot inject template expansion');
});
