import { deflateSync } from 'node:zlib';
// A generated checkerboard PNG, explicitly used as a DEMO rendering fixture.
export function avatarPng() {
  const crc = bytes => { let n = 0xffffffff; for (const byte of bytes) { n ^= byte; for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const tag = Buffer.from(type), head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(data.length); tail.writeUInt32BE(crc(Buffer.concat([tag, data]))); return Buffer.concat([head, tag, data, tail]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(32); header.writeUInt32BE(32, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc(32 * 97);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const at = y * 97 + 1 + x * 3, light = (Math.floor(x / 8) + Math.floor(y / 8)) % 2; pixels[at] = light ? 240 : 65; pixels[at + 1] = light ? 220 : 170; pixels[at + 2] = light ? 185 : 160; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
