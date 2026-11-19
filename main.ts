// The World Today - 18 November 2026.
// A one-page newspaper drawn by code: stdlib-only Node 22, deterministic.
// It writes entry.png (1024x1024) into MAKEFUN_OUTPUT_DIR (or /output).
// Every pixel comes from the buffer below; the PNG encoder is written here too.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;

const PAPER: [number, number, number] = [247, 242, 231];
const INK: [number, number, number] = [26, 26, 26];
const RED: [number, number, number] = [168, 38, 28];
const BLUE: [number, number, number] = [31, 78, 121];
const GOLD: [number, number, number] = [200, 160, 40];
const WHITE: [number, number, number] = [255, 255, 255];

type RGB = [number, number, number];

const buf = Buffer.alloc(W * H * 3);

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
  }
}

function hline(x: number, y: number, len: number, c: RGB): void {
  fillRect(x, y, len, 1, c);
}

function vline(x: number, y: number, len: number, c: RGB): void {
  fillRect(x, y, 1, len, c);
}

// Integer-only Bresenham line, identical on every platform.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  let ax = x0;
  let ay = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPx(ax, ay, c);
    if (ax === x1 && ay === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(x, y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  const ri2 = (r - 2) * (r - 2);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 >= ri2) setPx(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. '1' is ink; the draw test below checks exactly '1'.
// ---------------------------------------------------------------------------

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
};

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (bits[col] === '1') {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentred(text: string, y: number, scale: number, c: RGB): void {
  drawText(text, Math.floor((W - textWidth(text, scale)) / 2), y, scale, c);
}

// Greedy word wrap; every line fits maxW at the given scale.
function wrapText(text: string, maxW: number, scale: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur === '' ? word : cur + ' ' + word;
    if (textWidth(next, scale) <= maxW) {
      cur = next;
    } else {
      if (cur !== '') lines.push(cur);
      cur = word;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// The day's news (verified 18 Nov 2026; numbers come from these variables)
// ---------------------------------------------------------------------------

const DATE_LINE = 'WEDNESDAY 18 NOVEMBER 2026';
const MASTHEAD = 'THE WORLD TODAY';

const HERO = {
  kicker: 'APEC SUMMIT - SHENZHEN, CHINA',
  headA: 'TRUMP, XI AND PUTIN',
  headB: 'MEET IN SHENZHEN',
  sub: 'FIRST THREE-WAY SUMMIT SET FOR THURSDAY AS THE LEADERS OF THE THREE BIGGEST NUCLEAR POWERS GATHER',
};

const STORIES = [
  {
    kicker: 'THE GULF',
    head: 'IRAN DRONES TARGET US BASES IN KUWAIT AND BAHRAIN',
    body: 'BOTH ATTACKS INTERCEPTED. NO DAMAGE OR CASUALTIES REPORTED.',
    art: 'drones',
  },
  {
    kicker: 'TECHNOLOGY',
    head: 'NVIDIA DOUBLES REVENUE TO $115.8BN',
    body: 'BOARD RULES OUT A RETURN FOR FOUNDER JENSEN HUANG AS CEO.',
    art: 'chip',
  },
  {
    kicker: 'WEATHER',
    head: 'CYCLONE AKVAN BEARS DOWN ON INDIA',
    body: 'SEVERE STORM DUE ASHORE ON 20 NOV WITH WINDS OF 100-110 KM/H.',
    art: 'cyclone',
  },
  {
    kicker: 'UKRAINE',
    head: '141 RUSSIAN DRONES OVERNIGHT',
    body: 'AIR DEFENCES DOWN 126. FIVE KILLED AS ENERGY SITES ARE HIT.',
    art: 'blast',
  },
];

const FOOTER =
  'ALL STORIES REPORTED 18 NOV 2026 - REUTERS, AP, AFP, IMD, KYIV INDEPENDENT';

// ---------------------------------------------------------------------------
// Small drawings for the vignette corners
// ---------------------------------------------------------------------------

function drawArt(kind: string, x: number, y: number): void {
  if (kind === 'drones') {
    // Three quadcopters: square body, four arms, four rotor discs.
    for (let i = 0; i < 3; i++) {
      const cx = x + 12 + i * 15;
      const cy = y + 12 + (i % 2) * 14;
      fillRect(cx - 4, cy - 3, 9, 7, INK);
      fillRect(cx - 2, cy - 1, 5, 3, PAPER);
      line(cx - 4, cy - 3, cx - 9, cy - 8, INK);
      line(cx + 5, cy - 3, cx + 10, cy - 8, INK);
      line(cx - 4, cy + 4, cx - 9, cy + 9, INK);
      line(cx + 5, cy + 4, cx + 10, cy + 9, INK);
      fillCircle(cx - 9, cy - 8, 2, RED);
      fillCircle(cx + 10, cy - 8, 2, RED);
      fillCircle(cx - 9, cy + 9, 2, RED);
      fillCircle(cx + 10, cy + 9, 2, RED);
    }
    line(x + 2, y + 40, x + 46, y + 40, RED);
  } else if (kind === 'chip') {
    fillRect(x + 8, y + 8, 32, 32, INK);
    fillRect(x + 16, y + 16, 16, 16, PAPER);
    fillRect(x + 21, y + 21, 6, 6, RED);
    for (let i = 0; i < 4; i++) {
      fillRect(x + 12 + i * 8, y + 2, 3, 6, INK);
      fillRect(x + 12 + i * 8, y + 40, 3, 6, INK);
      fillRect(x + 2, y + 12 + i * 8, 6, 3, INK);
      fillRect(x + 40, y + 12 + i * 8, 6, 3, INK);
    }
  } else if (kind === 'cyclone') {
    ring(x + 24, y + 24, 18, BLUE);
    ring(x + 24, y + 24, 11, BLUE);
    fillCircle(x + 24, y + 24, 4, RED);
    line(x + 24, y + 24, x + 42, y + 10, BLUE);
  } else {
    // blast: star burst
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const x2 = Math.round(x + 24 + Math.cos(ang) * 20);
      const y2 = Math.round(y + 24 + Math.sin(ang) * 20);
      line(x + 24, y + 24, x2, y2, RED);
    }
    fillCircle(x + 24, y + 24, 7, GOLD);
    fillCircle(x + 24, y + 24, 3, RED);
  }
}

// ---------------------------------------------------------------------------
// Hero art: sun, three flags, skyline
// ---------------------------------------------------------------------------

function drawFlagUS(x: number, y: number): void {
  for (let i = 0; i < 7; i++) {
    fillRect(x, y + i * 6, 72, 3, i % 2 === 0 ? RED : WHITE);
  }
  fillRect(x, y, 30, 21, BLUE);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      fillRect(x + 3 + c * 7, y + 3 + r * 6, 3, 3, WHITE);
    }
  }
}

function drawFlagCN(x: number, y: number): void {
  fillRect(x, y, 72, 42, RED);
  fillCircle(x + 12, y + 12, 5, GOLD);
  for (let i = 0; i < 4; i++) {
    fillCircle(x + 30 + (i % 2) * 12, y + 6 + Math.floor(i / 2) * 10, 2, GOLD);
  }
}

function drawFlagRU(x: number, y: number): void {
  fillRect(x, y, 72, 14, WHITE);
  fillRect(x, y + 14, 72, 14, BLUE);
  fillRect(x, y + 28, 72, 14, RED);
}

function drawHeroArt(): void {
  // Sun with a red ring, top right of the hero.
  fillCircle(806, 292, 40, GOLD);
  ring(806, 292, 40, RED);
  // Three flags on poles.
  const flags: Array<[number, (x: number, y: number) => void]> = [
    [652, drawFlagUS],
    [752, drawFlagCN],
    [852, drawFlagRU],
  ];
  for (const [fx, draw] of flags) {
    vline(fx - 4, 204, 92, INK);
    fillCircle(fx - 4, 202, 3, GOLD);
    draw(fx, 204);
  }
  // Skyline silhouette along the bottom of the hero.
  const buildings: Array<[number, number, number]> = [
    [648, 66, 92],
    [712, 50, 70],
    [762, 58, 108],
    [820, 46, 80],
    [866, 62, 96],
    [928, 44, 64],
  ];
  for (const [bx, bw, bh] of buildings) {
    fillRect(bx, 492 - bh, bw, bh, BLUE);
    for (let wy = 492 - bh + 10; wy < 484; wy += 16) {
      for (let wx = bx + 8; wx < bx + bw - 8; wx += 14) {
        fillRect(wx, wy, 5, 6, GOLD);
      }
    }
  }
  hline(640, 492, 332, INK);
}

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------

function drawPage(): void {
  fillRect(0, 0, W, H, PAPER);

  // Double outer border.
  fillRect(16, 16, W - 32, 2, INK);
  fillRect(16, H - 18, W - 32, 2, INK);
  fillRect(16, 16, 2, H - 32, INK);
  fillRect(W - 18, 16, 2, H - 32, INK);

  // Masthead.
  drawTextCentred(MASTHEAD, 44, 7, INK);
  hline(28, 140, W - 56, INK);
  hline(28, 146, W - 56, INK);
  drawTextCentred(DATE_LINE, 158, 3, RED);

  // Hero box.
  const hx = 32;
  const hy = 188;
  const hw = 960;
  const hh = 320;
  fillRect(hx, hy, hw, 2, INK);
  fillRect(hx, hy + hh - 2, hw, 2, INK);
  fillRect(hx, hy, 2, hh, INK);
  fillRect(hx + hw - 2, hy, 2, hh, INK);
  drawText(HERO.kicker, hx + 20, hy + 18, 2, RED);
  drawText(HERO.headA, hx + 20, hy + 46, 4, INK);
  drawText(HERO.headB, hx + 20, hy + 86, 4, INK);
  hline(hx + 20, hy + 128, 560, RED);
  const subLines = wrapText(HERO.sub, 560, 2);
  subLines.forEach((ln, i) => {
    drawText(ln, hx + 20, hy + 142 + i * 18, 2, INK);
  });
  drawText('SHENZHEN, CHINA - 18 NOVEMBER 2026', hx + 20, hy + 142 + 3 * 18 + 12, 2, BLUE);
  drawHeroArt();

  // Vignette grid, 2 x 2.
  const bw = 470;
  const bh = 212;
  const gx = [32, 522];
  const gy = [536, 760];
  STORIES.forEach((s, idx) => {
    const bx = gx[idx % 2];
    const by = gy[Math.floor(idx / 2)];
    fillRect(bx, by, bw, 2, INK);
    fillRect(bx, by + bh - 2, bw, 2, INK);
    fillRect(bx, by, 2, bh, INK);
    fillRect(bx + bw - 2, by, 2, bh, INK);
    drawText(s.kicker, bx + 16, by + 16, 2, RED);
    const headLines = wrapText(s.head, bw - 32, 3);
    headLines.forEach((ln, i) => {
      drawText(ln, bx + 16, by + 44 + i * 27, 3, INK);
    });
    const bodyLines = wrapText(s.body, bw - 32, 2);
    bodyLines.forEach((ln, i) => {
      drawText(ln, bx + 16, by + 44 + headLines.length * 27 + 10 + i * 18, 2, INK);
    });
    drawArt(s.art, bx + bw - 64, by + bh - 64);
  });

  // Footer.
  drawTextCentred(FOOTER, 984, 2, INK);
}

// ---------------------------------------------------------------------------
// PNG encoder (stdlib only): signature, IHDR, one IDAT, IEND.
// CRC32 covers type + data together.
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Raw scanlines: one filter byte (0) per row, then RGB bytes.
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const rowStart = y * (W * 3 + 1);
    raw[rowStart] = 0;
    buf.copy(raw, rowStart + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
  const sha = createHash('sha256').update(png).digest('hex');
  console.log(`wrote entry.png ${png.length} bytes sha256=${sha}`);
}

main();
