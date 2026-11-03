import test from 'node:test';
import assert from 'node:assert/strict';
import { CafeRoom, normalizeGift } from '../cafe.mjs';
function fixture() {
  let now = 100000; const events = [], room = new CafeRoom(e => events.push(structuredClone(e)), () => now);
  room.updateSettings({ musicVoting: false }); // Retain coverage of the optional paid-order mode.
  return { room, events, tick: (n = 1000) => { now += n; } };
}
test('comments create one visitor and safely retain literal HTML as text', () => {
  const { room, tick } = fixture(); room.chat('bach', 'Bách', '<img src=x onerror=alert(1)>'); tick(); room.chat('bach', 'Bách', 'Chào quán');
  assert.equal(room.viewers.size, 1); assert.equal(room.viewers.get('bach').lastText, 'Chào quán');
});
test('empty identities and empty chat cannot create phantom visitors', () => {
  const { room } = fixture(); room.chat('', '', 'hi'); room.chat('x', 'x', ''); assert.equal(room.viewers.size, 0);
});
test('only explicit commands change drinks and clothes', () => {
  const { room, tick } = fixture(); room.chat('a', 'An', 'tôi uống cacao'); assert.equal(room.viewers.get('a').drink, 'latte');
  tick(); room.chat('a', 'An', '!uong cacao'); assert.equal(room.viewers.get('a').drink, 'cacao');
  tick(); room.chat('a', 'An', '!áo 6'); assert.equal(room.viewers.get('a').skin, 5);
});
test('tree command is retired; applause creates a timed character gesture with cooldown', () => {
  const { room, tick } = fixture(); room.chat('a', 'An', '!trong'); assert.equal(room.trees, 0);
  tick(); room.chat('a', 'An', 'vỗ tay'); const until = room.viewers.get('a').gestureUntil;
  tick(); room.chat('a', 'An', 'vỗ tay'); assert.equal(room.viewers.get('a').gestureUntil, until);
  tick(5000); room.chat('a', 'An', 'vẫy tay'); assert.equal(room.viewers.get('a').gesture, 'wave');
});
test('retired question commands remain ordinary chat and do not create votes', () => {
  const { room, tick } = fixture(); room.chat('a', 'An', '!a'); tick(); room.chat('a', 'An', '!b'); room.chat('b', 'Bách', '!c');
  assert.deepEqual(room.community().votes, [0, 0, 0]);
  assert.equal(room.viewers.get('a').lastText, '!b');
});
test('host can require gifts for stage and still support multiple performers', () => {
  const { room } = fixture(); room.updateSettings({ freeStage: false }); room.chat('a', 'An', '!nhay'); room.chat('b', 'Bách', '!nhay'); assert.equal(room.stage, null);
  room.gift('a', 'An', 'Quà', 1, 99); room.gift('b', 'Bách', 'Quà', 1, 99);
  assert.equal(room.performers.length, 2); assert.equal(room.performers[1].id, 'b'); assert.equal(room.performers[1].until, 110000);
});
test('likes crossing a goal light the room even when one event crosses multiple goals', () => {
  const { room } = fixture(); room.like('a', 199); assert.equal(room.lightsUntil, 0); room.like('a', 405); assert.equal(room.likes, 604); assert.equal(room.lightsUntil, 120000);
});
test('gift value is count times diamonds; public totals accumulate', () => {
  const { room, events } = fixture(); room.chat('a', 'An', 'Chào'); room.gift('a', 'An', 'Hoa hồng', 5, 2); room.gift('a', 'An', 'Hoa hồng', 1, 1);
  assert.equal(room.viewers.get('a').coins, 11); assert.equal(events.find(e => e.t === 'gift').tier, 2);
});
test('donations sum each supporter and rank top five by gift value', () => {
  const { room } = fixture();
  for (let i = 1; i <= 7; i++) room.gift(`u${i}`, `Khách ${i}`, 'Quà', i, 10);
  room.gift('u1', 'Tên mới', 'Quà', 1, 100);
  const summary = room.donations();
  assert.equal(summary.total, 380); assert.equal(summary.supporterCount, 7);
  assert.deepEqual(summary.leaderboard.map(v => v.coins), [110, 70, 60, 50, 40]);
  assert.equal(summary.leaderboard[0].name, 'Tên mới'); assert.equal(summary.demoTotal, 0);
});
test('demo gifts and likes never contribute to real totals or real donation goal', () => {
  const { room, events } = fixture(); room.updateSettings({ giftGoal: 20 });
  room.gift('demo', 'Thử', 'Quà', 1, 100, true); room.gift('real', 'Thật', 'Quà', 1, 5);
  room.like('demo', 200, true); room.like('real', 3);
  const summary = room.donations(); assert.equal(summary.total, 5); assert.equal(summary.demoTotal, 100);
  assert.equal(summary.leaderboard[0].name, 'Thật'); assert.equal(summary.demoLeaderboard[0].name, 'Thử');
  assert.equal(room.community().likes, 3); assert.equal(room.community().demoLikes, 200);
  assert.ok(!events.some(e => e.t === 'goalReached'));
});
test('donation goal celebrates only when real gifts cross the target', () => {
  const { room, events } = fixture(); room.updateSettings({ giftGoal: 10, giftGoalTitle: 'Mở đèn đêm' });
  room.gift('a', 'An', 'Quà', 1, 6); room.gift('b', 'Bách', 'Quà', 1, 5); room.gift('c', 'Cá', 'Quà', 1, 1);
  const reached = events.filter(e => e.t === 'goalReached'); assert.equal(reached.length, 1);
  assert.equal(reached[0].title, 'Mở đèn đêm'); assert.equal(reached[0].total, 11); assert.equal(room.lightsUntil, 130000);
  room.gift('d', 'Dương', 'Quà', 1, 10); room.like('a', 200);
  assert.equal(room.lightsUntil, 130000, 'Later gifts and likes must not shorten goal celebration');
});
test('full room still records donations from a new supporter without a seat', () => {
  const { room } = fixture(); for (let i = 0; i < 100; i++) { room.seat(String(i), 'Khách'); room.gift(String(i), 'Khách', 'Quà', 1, 1); }
  room.gift('new', 'Mới', 'Quà', 1, 99);
  assert.equal(room.viewers.size, 100); assert.ok(!room.viewers.has('new'));
  assert.equal(room.donations().total, 199); assert.equal(room.donations().supporterCount, 101);
  assert.equal(room.donations().leaderboard[0].id, 'new');
});
test('donation settings validate inputs and reset clears ledger without changing configured target', () => {
  const { room } = fixture(); room.updateSettings({ giftGoal: -100, giftGoalTitle: 'x'.repeat(80) });
  assert.equal(room.settings.giftGoal, 1); assert.equal(room.settings.giftGoalTitle.length, 40);
  room.updateSettings({ giftGoal: NaN, giftGoalTitle: '  ' }); assert.equal(room.settings.giftGoal, 1); assert.equal(room.settings.giftGoalTitle, 'Cùng thắp sáng quán');
  room.gift('real', 'Thật', 'Quà', 1, 5); room.gift('demo', 'Thử', 'Quà', 1, 99, true); room.clear();
  assert.deepEqual(room.snapshot().donations, { total: 0, demoTotal: 0, supporterCount: 0, leaderboard: [], demoLeaderboard: [] });
  assert.equal(room.settings.giftGoal, 1);
});
test('gift normalization ignores cumulative streak updates and accepts final count', () => {
  const data = { giftDetails: { giftType: 1, giftName: 'Rose', diamondCount: 1 }, repeatCount: 5, repeatEnd: false };
  assert.equal(normalizeGift(data), null); assert.deepEqual(normalizeGift({ ...data, repeatEnd: true }), { giftName: 'Rose', count: 5, diamonds: 1 });
  assert.equal(normalizeGift({ giftType: 0, giftName: 'Cat', diamondCount: 10 }).diamonds, 10);
});
test('full room evicts quiet non-donor and never exceeds 100', () => {
  const { room, tick } = fixture(); for (let i = 0; i < 100; i++) { room.seat(String(i), `V${i}`); tick(); }
  room.gift('0', 'V0', 'Rose', 1, 1); room.seat('new', 'Mới'); assert.equal(room.viewers.size, 100); assert.ok(room.viewers.has('0')); assert.ok(!room.viewers.has('1'));
});
test('a full room with 100 donors does not add an invalid visitor', () => {
  const { room } = fixture(); for (let i = 0; i < 100; i++) { room.seat(String(i), 'Khách'); room.gift(String(i), 'Khách', 'Rose', 1, 1); }
  assert.equal(room.seat('new', 'Mới'), null); assert.equal(room.viewers.size, 100);
});
test('settings reject wrong types, unknown keys and invalid scenes', () => {
  const { room } = fixture(); room.updateSettings({ music: 'false', scene: 'temple', likeGoal: Infinity, title: 'x'.repeat(80), evil: true });
  assert.equal(room.settings.music, true); assert.equal(room.settings.scene, 'cafe'); assert.equal(room.settings.likeGoal, 200); assert.equal(room.settings.title.length, 36); assert.ok(!('evil' in room.settings));
});
test('empty or invalid song requests do not fabricate songs', () => {
  const { room, events, tick } = fixture(); room.chat('a', 'An', '!nhac abc'); assert.equal(room.queue.length, 0); assert.ok(events.some(e => e.t === 'notice'));
  room.catalog = [{ id: '1', title: 'Mưa', url: '/assets/radio/mua.mp3' }]; tick(); room.chat('a', 'An', '!nhac missing'); assert.equal(room.queue.length, 0);
});
test('one queued song per user, gifts prioritize their pending song without interrupting playing', () => {
  const { room, tick } = fixture(); room.catalog = [{ id: '1', title: 'Mưa', url: '/assets/radio/mua.mp3' }];
  room.updateSettings({ songMinGift: 0 });
  room.chat('a', 'An', '!nhac 1'); room.nextTrack(); room.chat('b', 'Bách', '!nhac 1'); room.chat('c', 'Cá', '!nhac 1');
  room.gift('c', 'Cá', 'Rose', 1, 10); assert.equal(room.queue[0].viewerId, 'c'); assert.equal(room.playing.viewerId, 'a');
  tick(); room.chat('c', 'Cá', '!nhac 1'); assert.equal(room.queue.length, 2);
  room.nextTrack(); assert.equal(room.playing.viewerId, 'c');
});
test('queue bounds stop request flooding and clear resets all session counters', () => {
  const { room } = fixture(); room.catalog = [{ id: '1', title: 'Mưa', url: '/assets/radio/mua.mp3' }];
  room.updateSettings({ songMinGift: 0, queueLimit: 25 });
  for (let i = 0; i < 30; i++) room.chat(String(i), 'Khách', '!nhac 1'); assert.equal(room.queue.length, 25);
  room.like('0', 50); room.clear(); assert.equal(room.viewers.size, 0); assert.equal(room.likes, 0); assert.equal(room.queue.length, 0); assert.equal(room.playing, null);
});
