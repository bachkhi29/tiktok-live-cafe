import test from 'node:test';
import assert from 'node:assert/strict';
import { liveUser, liveChatText } from '../tiktok-events.mjs';
import { CafeRoom } from '../cafe.mjs';

test('TikTok LIVE v3 chat fields identify the commenter and message', () => {
  const event = { user: { id: '12345', nickname: 'Khách thật' }, content: 'nhảy' };
  assert.deepEqual(liveUser(event), { id: 'live:12345', name: 'Khách thật' });
  assert.equal(liveChatText(event), 'nhảy');
});

test('older connector fields remain readable', () => {
  const event = { user: { userId: '67890', nickname: 'Khách cũ' }, comment: 'chào' };
  assert.equal(liveUser(event).id, 'live:67890');
  assert.equal(liveChatText(event), 'chào');
});

test('a TikTok member event seats the arriving viewer before any comment', () => {
  const room = new CafeRoom();
  const event = { user: { id: '24680', nickname: 'Khách mới' }, memberCount: 1 };
  const u = liveUser(event);
  room.seat(u.id, u.name);
  assert.equal(room.snapshot().viewers[0].name, 'Khách mới');
  assert.equal(room.snapshot().viewers[0].lastText, '');
});
