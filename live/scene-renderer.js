import { SCENES } from './presets.js';
export function getStageTargets(performers = []) {
  const ordered = [], used = new Set(), byId = new Map(performers.map(p => [p.id, p]));
  for (const p of performers) {
    if (used.has(p.id)) continue;
    ordered.push(p); used.add(p.id);
    const partner = byId.get(p.partnerId);
    if (partner && !used.has(partner.id)) { ordered.push(partner); used.add(partner.id); }
  }
  if (performers.length > 4) {
    const columns = performers.length <= 8 ? 4 : performers.length <= 50 ? 8 : 10, rows = [];
    let row = [];
    for (let i = 0; i < ordered.length; i++) {
      const pair = !!ordered[i].partnerId && ordered[i].partnerId === ordered[i + 1]?.id;
      if (row.length + (pair ? 2 : 1) > columns) { rows.push(row); row = []; }
      row.push(ordered[i]); if (pair) row.push(ordered[++i]);
      if (row.length === columns) { rows.push(row); row = []; }
    }
    if (row.length) rows.push(row);
    const gap = 780 / columns, rowGap = Math.min(105, 320 / Math.max(1, rows.length - 1)), scale = Math.min(.72, gap / 135, rowGap / 135), targets = new Map();
    rows.forEach((members, r) => members.forEach((p, c) => {
      const facing = p.partnerId && members[c - 1]?.id === p.partnerId ? -1 : 1;
      const closer = p.partnerId ? (gap - 104 * scale) / 2 * facing : 0;
      targets.set(p.id, { x: 540 + (c - (members.length - 1) / 2) * gap + closer, y: 1010 + r * rowGap, scale, activity: p.activity || 'dance', style: p.style, partnerId: p.partnerId, facing });
    }));
    return targets;
  }
  const spacing = Math.min(138, 780 / Math.max(1, performers.length)), scale = performers.length > 5 ? .78 : .95;
  return new Map(ordered.map((p, i) => {
    const facing = p.partnerId && ordered[i - 1]?.id === p.partnerId ? -1 : 1;
    const closer = p.partnerId ? (spacing - 104 * scale) / 2 * facing : 0;
    return [p.id, { x: 540 + (i - (performers.length - 1) / 2) * spacing + closer, y: 931, scale, activity: p.activity || 'dance', style: p.style, partnerId: p.partnerId, facing }];
  }));
}
export function drawSpace(ctx, time, now, settings, community, h, strength = .65) {
  const { rect, ellipse, line, text, glow, plant, cup, steam } = h;
  const scene = SCENES.find(s => s.id === settings.scene) || SCENES[0], motif = scene.motif;
  const lit = community.lightsUntil > now, t = strength ? time : 0;
  const breeze = (x, y, size = 1, color) => plant(x, y, size, color, Math.sin(t * .9 + x * .013) * .045 * strength);
  const gradient = ctx.createLinearGradient(0, 0, 0, 1920); gradient.addColorStop(0, scene.wall); gradient.addColorStop(.65, '#211d29'); gradient.addColorStop(1, '#11151d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1920);
  glow(220, 80, 650, scene.accent + '17'); glow(960, 550, 450, scene.accent + '12');
  // Timber ceiling and architectural trim frame the room.
  for (let x = 0; x < 1080; x += 54) line([[x, 350], [x, 805]], '#ffffff05', 1);
  rect(25, 350, 1030, 18, '#090d1580', 5); line([[45, 372], [1035, 372]], scene.accent + '33', 2);
  for (let n = 0; n < 3; n++) {
    const x = 110 + n * 310;
    rect(x - 9, 425, 260, 360, '#080c1244', 114); rect(x - 3, 430, 248, 348, scene.accent + '40', 110); rect(x + 5, 438, 232, 334, '#121d2c', 104);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 5, 438, 232, 334, 104); ctx.clip();
    if (motif === 'sea') {
      const g = ctx.createLinearGradient(0, 438, 0, 772); g.addColorStop(0, '#2a4759'); g.addColorStop(.55, '#9b7f7a'); g.addColorStop(.56, '#3e6974'); g.addColorStop(1, '#173c4b'); ctx.fillStyle = g; ctx.fillRect(x, 438, 242, 334);
      for (let j = 0; j < 9; j++) {
        const y = 650 + j * 14, crest = Math.sin(t * 1.3 + j * .6 + n) * 5 * strength;
        line([[x, y], [x + 60, y + crest], [x + 135, y - crest], [x + 242, y]], '#c2d8ce33', 2);
      }
    } else {
      ellipse(x + 159, 479, 23, 23, '#ecd7b5'); ellipse(x + 169, 471, 23, 23, '#121d2c');
      for (let j = 0; j < 9; j++) {
        const height = 45 + ((j * 29 + n * 17) % 100); rect(x + j * 29 - 5, 772 - height, 25, height, j % 2 ? '#293146' : '#202b40');
        for (let k = 0; k < 5; k++) if ((j + k + n) % 3) rect(x + j * 29 + 2, 779 - height + k * 18, 4, 7, scene.accent + '66');
      }
      if (motif === 'rooftop') for (let j = 0; j < 10; j++) {
        ctx.save(); ctx.globalAlpha = .45 + (.5 + Math.sin(t * 1.4 + j * 7)) * .25;
        ellipse(x + j * 26, 548 + Math.sin(j * 17) * 40, 1.6, 1.6, '#e7dfcf'); ctx.restore();
      }
      // Tiny car lights stay outside, clipped to the windows.
      if (motif === 'cafe' || motif === 'rain' || motif === 'rooftop') for (let j = 0; j < 2; j++) {
        const carX = x - 20 + ((t * (j ? -24 : 32) + 30000 + j * 128 + n * 69) % 300);
        line([[carX, 758 + j * 7], [carX + 7, 758 + j * 7]], j ? '#e69f9a88' : '#f1dcaf88', 2);
      }
    }
    if (motif === 'rain' || motif === 'cafe') for (let j = 0; j < (motif === 'rain' ? 35 : 12); j++) { const y = 435 + ((j * 37 + t * 85) % 345); line([[x + (j * 21) % 240, y], [x + (j * 21) % 240 - 5, y + 20]], '#b7b4d52a', 2); }
    if (motif === 'snow') for (let j = 0; j < 24; j++) ellipse(x + (j * 31) % 240, 440 + ((j * 29 + t * 22) % 330), 2.5, 2.5, '#dddbe7bb');
    if (motif !== 'rooftop' && motif !== 'sea') { line([[x + 121, 440], [x + 121, 772]], '#74606a', 5); line([[x + 4, 618], [x + 240, 618]], '#74606a', 5); }
    ctx.restore(); rect(x - 15, 772, 272, 18, '#977665', 4);
  }
  if (motif === 'books') {
    for (const x of [90, 785]) for (let shelf = 0; shelf < 4; shelf++) {
      rect(x, 445 + shelf * 83, 200, 9, '#a08060', 2);
      for (let j = 0; j < 11; j++) { const height = 38 + j % 3 * 10; rect(x + 6 + j * 17, 443 + shelf * 83 - height, 13, height, ['#bd8e81', '#7a9e9b', '#bea76e', '#8f80a7'][(j + shelf) % 4], 2); }
    }
    text('BOOKS & BREWS', 540, 720, 22, scene.accent);
  }
  if (motif === 'sakura') {
    for (const flip of [-1, 1]) {
      line([[540 + flip * 490, 450], [540 + flip * 310, 520], [540 + flip * 90, 430]], '#987379', 9);
      for (let j = 0; j < 28; j++) { const x = 540 + flip * (60 + j * 15), y = 450 + Math.sin(j * 7) * 50; for (let k = 0; k < 5; k++) ellipse(x + Math.cos(k * 1.26) * 7, y + Math.sin(k * 1.26) * 7, 6, 5, '#efb9c8aa'); }
    }
    for (let j = 0; j < 20; j++) {
      ctx.save(); ctx.translate(70 + j * 49 + Math.sin(t * .8 + j) * 36 * strength, 460 + ((j * 57 + t * 26) % 850)); ctx.rotate(t * .6 + j);
      ellipse(0, 0, 5, 2.8, '#eeb9c488'); ctx.restore();
    }
  }
  if (motif === 'arcade') for (const x of [150, 820]) {
    rect(x, 620, 115, 210, '#26233a', 10); rect(x + 9, 633, 97, 17, '#d490d4', 2); rect(x + 16, 663, 83, 90, '#111527', 4);
    for (let k = 0; k < 5; k++) rect(x + 27 + k * 12, 695 + k % 2 * 12 + Math.sin(t * 3 + k) * 8 * strength, 8, 8, '#b29cd9');
    const scanY = 665 + ((t * 32) % 85); line([[x + 18, scanY], [x + 96, scanY]], '#edabdc33', 2);
    ellipse(x + 45, 779, 6, 6, '#db96bc'); rect(x + 65, 775, 17, 7, '#8ac4c3', 2);
  }
  if (motif === 'snow') {
    rect(410, 640, 260, 148, '#7c5b51', 12); rect(441, 669, 198, 105, '#241d26', 65);
    for (let j = 0; j < 5; j++) { ctx.fillStyle = j % 2 ? '#eaae67aa' : '#e7805faa'; ctx.beginPath(); ctx.moveTo(458 + j * 36, 769); ctx.quadraticCurveTo(453 + j * 38, 710 - Math.sin(t * 3 + j) * 14, 478 + j * 36, 688); ctx.quadraticCurveTo(507 + j * 35, 745, 498 + j * 35, 769); ctx.fill(); }
  }
  if (motif === 'neon' || motif === 'arcade') {
    glow(540, 600, 250 + Math.sin(t * 1.8) * 25 * strength, '#b478d333'); text(motif === 'arcade' ? 'PLAY • TALK • CHILL' : 'AFTER HOURS LIVE', 540, 575, 24, scene.accent); line([[390, 600], [690, 600]], scene.accent + '88', 3);
    for (let j = 0; j < 13; j++) {
      const height = 12 + (1 + Math.sin(t * 3 + j * 1.4)) * 17 * strength;
      rect(404 + j * 21, 749 - height, 11, height, scene.accent + '77', 3);
    }
  }
  if (motif === 'rooftop') { for (let j = 0; j < 5; j++) line([[j * 250 - 80, 350], [540 + (j - 2) * 90, 620]], '#a9bdd744', 4); line([[60, 620], [1020, 620]], '#a9bdd744', 4); }
  const floor = ctx.createLinearGradient(0, 800, 0, 1400); floor.addColorStop(0, scene.floor); floor.addColorStop(1, '#25212c'); ctx.fillStyle = floor; ctx.fillRect(0, 800, 1080, 600);
  for (let j = 0; j < 8; j++) line([[0, 820 + j * 80], [1080, 820 + j * 80]], '#d2a77f16', 2);
  for (let j = 0; j < 11; j++) line([[540 + (j - 5) * 70, 800], [540 + (j - 5) * 190, 1400]], '#d2a77f12', 2);
  rect(320, 796, 440, 72, '#49363b', 6); rect(307, 790, 466, 16, '#b48d71', 5); cup(350, 785, 'latte', .8); cup(730, 785, 'den', .8);
  steam(350, 770, .9, t, strength); steam(730, 770, .9, t + 2, strength);
  breeze(290, 800, .9); breeze(790, 800, .9);
  for (let j = 0; j < 14; j++) {
    const x = 45 + j * 76, y = 378 + Math.sin(j / 13 * Math.PI) * 55;
    if (j) line([[x - 76, 378 + Math.sin((j - 1) / 13 * Math.PI) * 55], [x, y]], '#9c807766', 2);
    const sway = Math.sin(t * .8 + j * .3) * 5 * strength, pulse = Math.sin(t * 1.6 + j * .5) * 5 * strength;
    line([[x, y], [x + sway, y + 12]], '#9c807766', 1);
    glow(x + sway, y + 14, (lit ? 58 : 28) + pulse, lit ? scene.accent + '66' : scene.accent + '33'); ellipse(x + sway, y + 14, 5, 8, lit ? '#ffe1af' : '#c39c80');
  }
  const performers = community.performers || [];
  for (const [x, color, phase] of [[110, scene.accent + (lit ? '34' : '20'), 0], [970, '#eeb69a22', 2]]) {
    const aim = 540 + Math.sin(t * .7 + phase) * 180 * strength;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, 500); ctx.lineTo(aim - 210, 970); ctx.lineTo(aim + 210, 970); ctx.closePath(); ctx.fill();
  }
  const stageBottom = performers.length > 4 ? Math.max(...[...getStageTargets(performers).values()].map(p => p.y)) + 35 : 972;
  if (performers.length > 4) { ellipse(540, stageBottom + 10, 450, 35, '#00000044'); rect(105, 936, 870, stageBottom - 930, '#453b4d', 25); rect(113, 941, 854, stageBottom - 950, '#766176', 22); }
  else { ellipse(540, 972, 437, 48, '#00000044'); rect(115, 922, 850, 62, '#453b4d', 25); ellipse(540, 926, 425, 45, '#766176'); }
  for (const [j, color] of ['#9dd8df22', '#c5a1e522', '#edb38d22'].entries()) {
    const x = 360 + j * 180 + Math.sin(t * 1.2 + j * 2) * 75 * strength;
    ellipse(x, performers.length > 4 ? 1080 + j * 70 : 930, 80 + Math.cos(t + j) * 10 * strength, 13, color);
  }
  line([[147, stageBottom - 7], [934, stageBottom - 7]], scene.accent + (lit ? 'dd' : '88'), 3);
  for (let j = 0; j < 17; j++) {
    ctx.save(); ctx.globalAlpha = .35 + (.5 + Math.sin(t * 3 + j * .6)) * .35;
    ellipse(170 + j * 46, stageBottom - 6, 3.5, 2.5, scene.accent); ctx.restore();
  }
  // Actors are drawn once by overlay.js; the same moving coordinates anchor speech bubbles.
  // The explicitly labelled host performs between guest turns; no fake guests or votes.
  for (let j = 0; j < 5; j++) {
    const progress = ((t * .18 + j * .2) % 1), x = 240 + j * 145 + Math.sin(t + j) * 20 * strength;
    ctx.save(); ctx.globalAlpha = Math.sin(progress * Math.PI) * .35;
    text(j % 2 ? '♪' : '♫', x, 935 - progress * 115, 22, scene.accent); ctx.restore();
  }
  breeze(50, 1045, 1.5); breeze(1030, 1045, 1.5); breeze(40, 1325, 1.4); breeze(1040, 1325, 1.4);
  if (motif === 'garden') {
    for (let j = 0; j < Math.min(community.trees || 0, 18); j++) breeze(24 + j * 60, 1370, .6 + j % 3 * .15, '#91b880');
    for (let j = 0; j < 18; j++) {
      const x = 70 + j * 54 + Math.sin(t * .5 + j * 2) * 20 * strength, y = 810 + Math.sin(t * .7 + j) * 70;
      ctx.save(); ctx.globalAlpha = .4 + (.5 + Math.sin(t * 1.7 + j)) * .3; glow(x, y, 9, '#dbe3ac77'); ellipse(x, y, 1.5, 1.5, '#e0edab'); ctx.restore();
    }
  }
  // A few slow dust motes make the warm cafe/library feel alive without covering text.
  if (motif === 'cafe' || motif === 'books') for (let j = 0; j < 12; j++) {
    const x = 330 + (j * 47 % 420) + Math.sin(t * .35 + j) * 13 * strength, y = 475 + ((j * 43 - t * 9 + 30000) % 300);
    ctx.save(); ctx.globalAlpha = .15 + (.5 + Math.sin(t + j)) * .15; ellipse(x, y, 1.6, 1.6, '#efd8ac'); ctx.restore();
  }
  line([[20, 1398], [1060, 1398]], scene.accent + '44', 2);
}
