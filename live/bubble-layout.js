export function overlaps(a, b, gap = 8) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}
// Greedy placement: newer speech wins; never draw an unreadable overlapping bubble.
export function placeBubbles(candidates, bounds, maxVisible = 3, gap = 10, obstacles = []) {
  const placed = [];
  for (const item of candidates) {
    if (placed.length >= maxVisible) break;
    const area = item.bounds || bounds;
    if (item.w > area.w || item.h > area.h) continue;
    const clampX = x => Math.max(area.x, Math.min(area.x + area.w - item.w, x));
    const clampY = y => Math.max(area.y, Math.min(area.y + area.h - item.h, y));
    const positions = [{ x: clampX(item.anchorX - item.w / 2), y: clampY(item.anchorY - item.h - 16) }];
    for (let y = area.y; y + item.h <= area.y + area.h; y += item.h + gap) {
      for (let x = area.x; x + item.w <= area.x + area.w; x += item.w + gap) positions.push({ x, y });
    }
    positions.sort((a, b) => Math.hypot(a.x + item.w / 2 - item.anchorX, a.y + item.h - item.anchorY) - Math.hypot(b.x + item.w / 2 - item.anchorX, b.y + item.h - item.anchorY));
    for (const p of positions) {
      const box = { ...item, ...p };
      if (!placed.some(other => overlaps(box, other, gap)) && !obstacles.some(other => overlaps(box, other, gap))) { placed.push(box); break; }
    }
  }
  return placed;
}
