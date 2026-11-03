// Stable phases keep guests from moving in unison; no per-frame random state.
export function motionSeed(id) {
  let hash = 2166136261;
  for (const char of String(id)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return (hash >>> 0) % 10007;
}
export function motionStrength(settings, reduced = false) {
  if (reduced || settings.animationLevel === 0) return 0;
  return settings.animationLevel === 2 ? 1 : .65;
}
export function characterPose(time, seed, mode = 'idle', talking = false, strength = .65, style) {
  const pose = { x: 0, y: 0, rotation: 0, headTilt: 0, eyes: 1, mouth: 0, leftArm: 0, rightArm: 0, step: 0, sip: 0, wave: 0, mode, style: style ?? seed % 6, facing: 1 };
  if (!strength) return pose;
  const phase = seed * .618, t = time + phase, beat = Math.sin(time * 5 + phase);
  const blink = (t % (3.8 + seed % 5 * .23));
  pose.eyes = blink < .16 ? Math.max(.08, Math.abs(blink - .08) / .08) : 1;
  pose.y = Math.sin(t * 1.7) * 1.8 * strength;
  pose.headTilt = Math.sin(t * .8) * .035 * strength;
  if (talking) {
    pose.mouth = (.3 + Math.abs(Math.sin(t * 8)) * .7) * strength;
    pose.headTilt += Math.sin(t * 3.5) * .045 * strength;
    pose.wave = (.45 + Math.sin(t * 2) * .15) * strength;
  }
  if (mode === 'walk') {
    pose.step = Math.sin(t * 10) * 11 * strength;
    pose.y -= Math.abs(Math.sin(t * 10)) * 3 * strength;
    pose.leftArm = -pose.step; pose.rightArm = pose.step;
  } else if (mode === 'dance') {
    const variant = pose.style;
    pose.x = beat * ([8, 14, 5, 9, 10, 6][variant]) * strength;
    pose.y -= Math.abs(beat) * ([8, 6, 2, 14, 5, 8][variant]) * strength;
    pose.rotation = (variant === 2 ? Math.round(beat * 2) / 2 : beat) * (variant === 4 ? .16 : .1) * strength;
    pose.step = Math.sin(time * (variant === 1 ? 10 : 5) + phase + 1) * (variant === 1 ? 17 : 9) * strength;
    pose.leftArm = (variant === 2 ? Math.round(beat) : variant === 5 ? Math.sin(time * 4 + phase) : beat) * 22 * strength;
    pose.rightArm = (variant === 0 ? -beat : variant === 3 ? beat : Math.cos(time * 5 + phase)) * 22 * strength;
    pose.headTilt += -pose.rotation * .4;
  } else if (mode === 'sing') {
    pose.x = Math.sin(t * 2) * 4 * strength; pose.rotation = Math.sin(t * 2) * .06 * strength;
    pose.mouth = (.3 + Math.abs(Math.sin(t * 7)) * .7) * strength; pose.wave = (.7 + Math.sin(t * 2) * .3) * strength;
  } else if (mode === 'ribbon') {
    pose.x = Math.sin(t * 2.2) * 10 * strength; pose.rotation = Math.sin(t * 2.2) * .09 * strength;
    pose.leftArm = Math.sin(t * 2.2) * 24 * strength; pose.rightArm = Math.cos(t * 2.2) * 24 * strength;
    pose.step = Math.sin(t * 2.2) * 9 * strength;
  } else if (mode === 'ballroom') {
    pose.rotation = Math.sin(time * 2.2) * .07 * strength; pose.x = Math.sin(time * 2.2) * 5 * strength;
    pose.step = Math.sin(time * 2.2) * 8 * strength; pose.y = Math.cos(time * 4.4) * 2 * strength;
  } else if (mode === 'wave') {
    pose.wave = (.8 + Math.sin(t * 6) * .2) * strength;
  } else if (mode === 'clap') {
    pose.leftArm = (1 + Math.sin(t * 7)) * 12 * strength; pose.rightArm = pose.leftArm;
  } else if (mode === 'idle' && !talking) {
    // A short sip every ~15 seconds, staggered per guest.
    const cycle = t % 15;
    if (cycle < 2.7) pose.sip = Math.sin(cycle / 2.7 * Math.PI) ** 2;
  }
  return pose;
}
export function headAnchor(x, y, scale, pose) {
  // Same neck and body transforms used to paint the character.
  const localX = Math.sin(pose.headTilt) * 56 * (pose.facing || 1), localY = -54 - Math.cos(pose.headTilt) * 56;
  const cos = Math.cos(pose.rotation), sin = Math.sin(pose.rotation);
  return { anchorX: x + (pose.x + localX * cos - localY * sin) * scale,
    anchorY: y + (pose.y + localX * sin + localY * cos) * scale };
}
export function armTargets(p) {
  if (p.mode === 'sing') return { left: [-36, -31, -40, -25 - p.wave * 25], right: [34, -41, 14, -63] };
  if (p.mode === 'ballroom') return { left: [-35, -32, -40, -47], right: [37, -43, 52, -46] };
  if (p.mode === 'clap') return { left: [-32, -30, -3 - p.leftArm, -39], right: [32, -30, 3 + p.rightArm, -39] };
  if (p.mode === 'ribbon') return { left: [-41, -58 - p.leftArm, -43, -82 - p.leftArm], right: [43, -64 + p.rightArm, 42, -82 + p.rightArm] };
  if (p.mode === 'dance') {
    const a = p.leftArm, b = p.rightArm;
    switch (p.style) {
      case 0: return { left: [-38, -65, -43, -90 - a], right: [39, -20, 44, -12 + b] };
      case 1: return { left: [-36, -24, -30 + a * .5, -35], right: [36, -24, 30 + b * .5, -35] };
      case 2: return { left: [-42, -42, -42, -70 - a], right: [42, -42, 42, -22 + b] };
      case 3: return { left: [-38, -28, 3 + a * .5, -40], right: [38, -28, -3 + b * .5, -51] };
      case 4: return { left: [-35, -54, -50, -44 + a], right: [35, -54, 50, -44 + b] };
      default: return { left: [-38, -58 - a * .5, -44, -83 - a], right: [38, -58 - b * .5, 44, -83 - b] };
    }
  }
  return { left: [-29 - p.leftArm * .4, -15, -10 - p.leftArm, -9], right: [31 + p.wave * 9, -16 - p.wave * 16 - p.sip * 18, 10 + p.wave * 28 - p.sip * 12 + p.rightArm, -11 - p.wave * 35 - p.sip * 44] };
}
