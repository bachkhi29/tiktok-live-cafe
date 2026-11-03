import test from 'node:test';
import assert from 'node:assert/strict';
import { characterPose, headAnchor, motionSeed, motionStrength } from '../motion.js';
import { CafeRoom } from '../cafe.mjs';

test('motion preferences persist and reduced-motion overrides either enabled level', () => {
  const room = new CafeRoom(); assert.equal(room.settings.animationLevel, 1);
  room.updateSettings({ animationLevel: 2 });
  const restored = new CafeRoom(); restored.loadConfig(room.exportConfig());
  assert.equal(restored.settings.animationLevel, 2);
  for (const invalid of [-1, 3, '0', null]) restored.updateSettings({ animationLevel: invalid });
  assert.equal(restored.settings.animationLevel, 2);
  assert.equal(motionStrength(restored.settings), 1);
  assert.equal(motionStrength(restored.settings, true), 0);
  restored.updateSettings({ animationLevel: 0 }); assert.equal(motionStrength(restored.settings), 0);
  assert.equal(motionStrength({}), .65, 'Older settings default to gentle motion');
});

test('turning motion off freezes all poses and speech anchors across time', () => {
  for (const mode of ['idle', 'walk', 'dance']) {
    const a = characterPose(1, 42, mode, true, 0), b = characterPose(100, 42, mode, true, 0);
    assert.deepEqual(a, b); assert.equal(a.eyes, 1);
    assert.deepEqual(headAnchor(540, 931, 1, a), { anchorX: 540, anchorY: 821 });
  }
});

test('guests have independent animation phases and bounded head anchors in each mode', () => {
  const seeds = ['Bách', 'Mây', 'An', 'Khánh'].map(motionSeed);
  assert.equal(new Set(seeds).size, 4);
  assert.notDeepEqual(characterPose(4, seeds[0], 'dance'), characterPose(4, seeds[1], 'dance'));
  for (const seed of seeds) for (const mode of ['idle', 'walk', 'dance']) for (let t = 0; t < 18; t += .07) {
    const pose = characterPose(t, seed, mode, true, 1), anchor = headAnchor(540, 931, .95, pose);
    assert.ok(Object.values(pose).filter(v => typeof v === 'number').every(Number.isFinite));
    assert.ok(pose.eyes >= .08 && pose.eyes <= 1);
    assert.ok(anchor.anchorY < 840 && anchor.anchorY > 800, 'Chat stays above the head while dancing/walking');
    assert.ok(Math.abs(anchor.anchorX - 540) < 36);
  }
});

test('idle gestures include blinks and sips; speaking replaces sips with a gesture', () => {
  let blinks = 0, sips = 0, raisedCup = 0;
  for (let t = 0; t < 20; t += .04) {
    const idle = characterPose(t, 0), speaking = characterPose(t, 0, 'idle', true);
    if (idle.eyes < .5) blinks++;
    if (idle.sip > .3) sips++;
    raisedCup = Math.max(raisedCup, idle.sip);
    assert.equal(speaking.sip, 0); assert.ok(speaking.wave > 0);
  }
  assert.ok(blinks > 0); assert.ok(sips > 0); assert.ok(raisedCup > .95, 'A gentle sip still reaches the mouth');
});
