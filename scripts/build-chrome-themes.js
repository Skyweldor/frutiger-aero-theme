// Builds the two Chrome colour themes in chrome-themes/:
//   chrome-themes/blue/    Frutiger Aero Blue   (light, matches Frutiger Aero Daylight)
//   chrome-themes/night/   Frutiger Aero Night  (dark, matches Frutiger Aero Deep Aqua)
//
// Each theme is a manifest.json plus three gradient images, all written from
// the palettes below, so this file is the one place to change a colour.
//
//   node scripts/build-chrome-themes.js
//
// No dependencies: the PNG images are encoded by hand.

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'chrome-themes');

// Gradients are lists of [y, colour] stops, in pixels from the top of the
// image. "highlight" lightens the top row by that much, for the thin bright
// edge Aero glass has. The last stop's colour fills the rest of the image and
// is also used as the theme's flat colour for that area.
//
// Chrome draws:
//   frame           behind the tab strip, when the window is focused
//   frameInactive   the same, when it isn't
//   toolbar         behind the toolbar, the selected tab and the bookmarks bar
const THEMES = {
  blue: {
    name: 'Frutiger Aero Blue',
    description: 'A glossy sky-blue Frutiger Aero theme. Matches the Frutiger Aero Daylight theme for VS Code.',
    frame: { highlight: 0.7, stops: [[1, '#d6f3ff'], [18, '#a6ddf5'], [21, '#7fcaec'], [48, '#5db8e2']] },
    frameInactive: { highlight: 0.5, stops: [[1, '#cfe9f5'], [18, '#a5d3e8'], [21, '#7cbcd9'], [48, '#5aa8cc']] },
    toolbar: { highlight: 0.9, stops: [[1, '#f6fdff'], [40, '#e7f7fd'], [110, '#dbf2fc']] },
    colors: {
      tab_text: '#08283b',
      tab_background_text: '#08283b',
      tab_background_text_inactive: '#0b3550',
      bookmark_text: '#0b3a55',
      toolbar_text: '#08283b',
      toolbar_button_icon: '#1a6f9e',
      omnibox_background: '#ffffff',
      omnibox_text: '#08283b',
      ntp_background: '#dbf2fc',
      ntp_text: '#08283b',
      ntp_link: '#0b6fa8',
    },
  },
  night: {
    name: 'Frutiger Aero Night',
    description: 'A deep navy and aqua Frutiger Aero theme. Matches the Frutiger Aero Deep Aqua theme for VS Code.',
    frame: { highlight: 0.18, stops: [[1, '#1d5a7e'], [18, '#164a68'], [21, '#0f3a54'], [48, '#0d3249']] },
    frameInactive: { highlight: 0.1, stops: [[1, '#173f57'], [18, '#123448'], [21, '#0d2a3c'], [48, '#0b2534']] },
    toolbar: { highlight: 0.15, stops: [[1, '#1a587b'], [40, '#165172'], [110, '#134a69']] },
    colors: {
      tab_text: '#f0fbff',
      tab_background_text: '#e6f7ff',
      tab_background_text_inactive: '#9bd4eb',
      bookmark_text: '#dcf4ff',
      toolbar_text: '#f0fbff',
      toolbar_button_icon: '#8fdcff',
      omnibox_background: '#0b2e42',
      omnibox_text: '#ffffff',
      ntp_background: '#0b2e42',
      ntp_text: '#f0fbff',
      ntp_link: '#8fdcff',
    },
  },
};

const IMAGE_WIDTH = 512; // Chrome tiles theme images, so any width works
const FRAME_HEIGHT = 160;
const TOOLBAR_HEIGHT = 256; // tall enough that it never repeats behind the bookmarks bar

// ---------------------------------------------------------------------------
// Colours

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function last(list) {
  return list[list.length - 1];
}

// colourAt(y) for a gradient: straight lines between the stops, flat outside them.
function gradient({ stops, highlight = 0 }) {
  const points = stops.map(([y, hex]) => [y, rgb(hex)]);
  return (y) => {
    let colour = y <= points[0][0] ? points[0][1] : last(points)[1];
    for (let i = 0; i < points.length - 1; i++) {
      const [y0, c0] = points[i];
      const [y1, c1] = points[i + 1];
      if (y > y0 && y <= y1) {
        const t = (y - y0) / (y1 - y0);
        colour = c0.map((v, k) => v + (c1[k] - v) * t);
        break;
      }
    }
    if (y === 0) colour = colour.map((v) => v + (255 - v) * highlight);
    return colour.map(Math.round);
  };
}

// ---------------------------------------------------------------------------
// PNG encoding (RGB, one colour per row)

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function stripedPng(width, height, colourAt) {
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height); // starts as zeros
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes;
    // Filter type 1 ("Sub") stores each pixel as its difference from the one
    // to its left. Every row is a single colour, so only the first pixel needs
    // writing and the rest stay zero, which compresses to almost nothing.
    raw[row] = 1;
    raw.set(colourAt(y), row + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Themes

function manifestFor(theme) {
  const colours = {
    frame: last(theme.frame.stops)[1],
    frame_inactive: last(theme.frameInactive.stops)[1],
    toolbar: last(theme.toolbar.stops)[1],
    ...theme.colors,
  };
  return {
    manifest_version: 3,
    name: theme.name,
    version: '0.1.0',
    description: theme.description,
    theme: {
      images: {
        theme_frame: 'images/frame.png',
        theme_frame_inactive: 'images/frame-inactive.png',
        theme_toolbar: 'images/toolbar.png',
      },
      colors: Object.fromEntries(Object.entries(colours).map(([key, hex]) => [key, rgb(hex)])),
    },
  };
}

// JSON with each [r, g, b] on one line
function formatJson(value) {
  return JSON.stringify(value, null, 2).replace(/\[\s+([\d,\s]+?)\s+\]/g, (_, inner) => `[${inner.split(/,\s*/).join(', ')}]`) + '\n';
}

for (const [folder, theme] of Object.entries(THEMES)) {
  const dir = path.join(OUT, folder);
  fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), formatJson(manifestFor(theme)));
  const images = [
    ['frame.png', FRAME_HEIGHT, theme.frame],
    ['frame-inactive.png', FRAME_HEIGHT, theme.frameInactive],
    ['toolbar.png', TOOLBAR_HEIGHT, theme.toolbar],
  ];
  for (const [file, height, spec] of images) {
    const png = stripedPng(IMAGE_WIDTH, height, gradient(spec));
    fs.writeFileSync(path.join(dir, 'images', file), png);
  }
  console.log(`${theme.name}: ${path.relative(process.cwd(), dir)}`);
}
