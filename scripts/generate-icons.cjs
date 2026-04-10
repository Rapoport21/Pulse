#!/usr/bin/env node
// Generates simple placeholder PNG icons for the PWA: rose-600 background
// with a white "P" glyph rendered from a hand-drawn 7x9 bitmap font.
// No external dependencies — uses Node's built-in zlib + crc32.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Rose-600: #e11d48
const BG = [0xe1, 0x1d, 0x48, 0xff];
const FG = [0xff, 0xff, 0xff, 0xff];

// 7x9 bitmap of "P" — 1 = ink, 0 = bg
const P_GLYPH = [
  [1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
];
const GLYPH_W = 7;
const GLYPH_H = 9;

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function generatePng(size) {
  // Build raw RGBA pixel data with a centered "P" filling ~60% of the canvas.
  // Pixel scale: glyph height should be ~60% of size.
  const targetGlyphPx = Math.round(size * 0.6);
  const scale = Math.max(1, Math.floor(targetGlyphPx / GLYPH_H));
  const glyphPxW = GLYPH_W * scale;
  const glyphPxH = GLYPH_H * scale;
  const offsetX = Math.floor((size - glyphPxW) / 2);
  const offsetY = Math.floor((size - glyphPxH) / 2);

  // Each scanline: 1 filter byte + size*4 RGBA bytes.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);

  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      let color = BG;
      const gx = x - offsetX;
      const gy = y - offsetY;
      if (gx >= 0 && gx < glyphPxW && gy >= 0 && gy < glyphPxH) {
        const cx = Math.floor(gx / scale);
        const cy = Math.floor(gy / scale);
        if (P_GLYPH[cy][cx]) color = FG;
      }
      const off = y * (stride + 1) + 1 + x * 4;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
      raw[off + 3] = color[3];
    }
  }

  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT — zlib-compressed
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon.png', size: 32 },
];

for (const { name, size } of sizes) {
  const png = generatePng(size);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('wrote', name, '(' + png.length + ' bytes)');
}
