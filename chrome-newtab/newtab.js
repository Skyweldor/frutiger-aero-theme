'use strict';

// Frutiger Aero Glass New Tab.
// No network requests, no accounts: everything on this page is local.

const root = document.documentElement;
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

// ---------------------------------------------------------------------------
// Settings (kept in localStorage; the page works without it)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  gfx: 'auto',
  tiles: 'bubble',
  cycle: true,
  clock: false,
  calendar: false,
};
const DEFAULT_WALLPAPER = 'bubbles-day';

function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window or blocked storage: changes last for this tab only */
  }
}

// Only what someone changes in the settings panel is saved. Anything they
// never touched follows DEFAULTS, so a later version can change a default and
// it reaches everyone who left that setting alone.
const stored = readStored('aero-newtab');
const chosen = stored && typeof stored === 'object' ? stored : {};
const settings = { ...DEFAULTS, ...chosen };

function choose(key, value) {
  settings[key] = value;
  chosen[key] = value;
  writeStored('aero-newtab', chosen);
}

// ---------------------------------------------------------------------------
// Graphics tiers
// ---------------------------------------------------------------------------
// "auto" picks Lite when the device reports little memory or few cores, or
// when the system asks for reduced transparency. Blur is the expensive part
// of the glass look, so Lite drops it and keeps everything else.
function autoTier() {
  const memory = navigator.deviceMemory || 8; // GB, capped at 8 by Chrome
  const cores = navigator.hardwareConcurrency || 8;
  const reduced = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  return reduced || memory <= 4 || cores <= 2 ? 'lite' : 'full';
}

function applyTier() {
  root.dataset.gfx = settings.gfx === 'auto' ? autoTier() : settings.gfx;
}

applyTier(); // runs in <head>, before first paint

// ---------------------------------------------------------------------------
// Tile styles: bubble, clear or frost (CSS does the rest)
// ---------------------------------------------------------------------------
function applyTiles() {
  root.dataset.tiles = settings.tiles;
}

applyTiles();

// ---------------------------------------------------------------------------
// Wallpaper: the list comes from wallpapers.js (see wallpapers/build_page_assets.py)
// ---------------------------------------------------------------------------
const wallpapers = typeof WALLPAPERS !== 'undefined' ? WALLPAPERS : [];

// The wallpaper showing now is kept apart from the settings: with cycling on
// it changes on every new tab, and that shouldn't save the other settings too.
// Version 0.2.0 kept it with the settings, so look there as well.
const lastWallpaper = readStored('aero-newtab-wallpaper') ?? chosen.wallpaper ?? null;
delete chosen.wallpaper;
settings.wallpaper = lastWallpaper ?? DEFAULT_WALLPAPER;

function applyWallpaper() {
  const current = wallpapers.find((wp) => wp.id === settings.wallpaper) || wallpapers[0];
  if (current) root.style.setProperty('--wallpaper', `url("wallpapers/${current.id}.jpg")`);
}

function setWallpaper(id) {
  settings.wallpaper = id;
  writeStored('aero-newtab-wallpaper', id);
  applyWallpaper();
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// "New wallpaper on every new tab" deals the wallpapers like a shuffled deck:
// each one comes up once, in random order, before any comes up again, and a
// new round never starts with the one just shown. What's left of the deck is
// saved between tabs. A wallpaper added later joins at the next round.
function nextShuffled(current) {
  const ids = wallpapers.map((wp) => wp.id);
  const saved = readStored('aero-newtab-deck');
  let deck = Array.isArray(saved) ? saved.filter((id) => ids.includes(id) && id !== current) : [];
  if (!deck.length) deck = shuffle(ids.filter((id) => id !== current));
  const next = deck.shift();
  writeStored('aero-newtab-deck', deck);
  return next;
}

// The very first visit shows the default wallpaper.
if (lastWallpaper === null) {
  writeStored('aero-newtab-wallpaper', settings.wallpaper);
} else if (settings.cycle && wallpapers.length > 1) {
  writeStored('aero-newtab-wallpaper', (settings.wallpaper = nextShuffled(settings.wallpaper)));
}

applyWallpaper(); // before first paint, like the tier

// Bubble tiles bend the wallpaper behind them (Full tier only). This draws the
// displacement map for the #bubble-lens filter: the middle of the bubble is
// left alone and the picture is pulled outward more and more toward the rim,
// like looking through a glass ball. Red carries the sideways shift, green
// the up-down shift, and mid-grey means "no shift".
function initLens() {
  const target = document.getElementById('bubble-lens-map');
  if (!target) return;
  const size = 96; // the bubble's diameter in CSS pixels (see newtab.css)
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const map = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / (size / 2) - 1;
      const ny = (y + 0.5) / (size / 2) - 1;
      const r = Math.hypot(nx, ny);
      const pull = r < 1 ? r * r : 0; // times (nx, ny): a cubic rise toward the rim
      const i = (y * size + x) * 4;
      map.data[i] = 128 - 127 * nx * pull;
      map.data[i + 1] = 128 - 127 * ny * pull;
      map.data[i + 2] = 128;
      map.data[i + 3] = 255;
    }
  }
  ctx.putImageData(map, 0, 0);
  target.setAttribute('href', canvas.toDataURL());
}

// ---------------------------------------------------------------------------
// Search: hands the query to the user's own default search engine
// ---------------------------------------------------------------------------
function initSearch() {
  const form = document.getElementById('search');
  const input = document.getElementById('q');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (isExtension && chrome.search) {
      chrome.search.query({ text, disposition: 'CURRENT_TAB' });
    } else {
      document.getElementById('hint').hidden = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Tiles: the user's most visited sites
// ---------------------------------------------------------------------------
const MAX_TILES = 8;
const PREVIEW_SITES = ['Mail', 'Videos', 'News', 'Maps', 'Music', 'Photos'].map((title) => ({
  title,
  url: '#',
}));

function hueFor(text) {
  // Stay in the Aero range: emerald through aqua to sky blue.
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return 150 + (hash % 70);
}

function siteName(site) {
  if (site.title) return site.title;
  try {
    return new URL(site.url).hostname.replace(/^www\./, '');
  } catch {
    return site.url;
  }
}

function monogram(orb, name) {
  orb.replaceChildren(document.createTextNode([...name][0].toUpperCase()));
  delete orb.dataset.backing;
  orb.dataset.hue = '';
  orb.style.setProperty('--h', hueFor(name));
}

// ---------------------------------------------------------------------------
// Site icons
// ---------------------------------------------------------------------------
// Two things can leave a bubble looking empty, so each icon is checked once it
// has loaded:
//  - Chrome has no icon stored for the site. It then returns its own plain
//    default picture instead of an error, so the "error" fallback never runs.
//    Those tiles get the coloured letter.
//  - The icon is white or very pale. Some sites draw theirs white when the
//    browser is in dark mode (ChatGPT does), which disappears on the white orb.
//    Those tiles get a deep aqua orb instead.
const ICON_SIZE = 32;

function faviconUrl(pageUrl) {
  return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(pageUrl)}&size=${ICON_SIZE}`;
}

function iconUrl(site) {
  if (site.favicon) return site.favicon; // some browsers hand icons over with the list
  if (isExtension && site.url !== '#') return faviconUrl(site.url);
  return null;
}

// The icon's pixels, drawn at ICON_SIZE square, or null if they can't be read.
function iconPixels(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);
    return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data;
  } catch {
    return null;
  }
}

// Chrome's default picture, taken once from an address that can't have an icon.
let defaultIconPixels;
function chromeDefaultIcon() {
  defaultIconPixels ??= new Promise((resolve) => {
    if (!isExtension) return resolve(null);
    const img = new Image();
    img.addEventListener('load', () => resolve(iconPixels(img)));
    img.addEventListener('error', () => resolve(null));
    img.src = faviconUrl('https://example.invalid/');
  });
  return defaultIconPixels;
}

function samePicture(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference += Math.abs(a[i] - b[i]);
  return difference / a.length < 3;
}

// Share of the icon's area that shows up when it sits on a white orb: pixels
// that, blended onto white, end up clearly different from white.
function shareVisibleOnWhite(pixels) {
  let visible = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    const darkest = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (alpha * (255 - darkest) > 64) visible++;
  }
  return visible / (pixels.length / 4);
}

// Share of the icon's area that isn't see-through at all.
function shareCovered(pixels) {
  let covered = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 40) covered++;
  return covered / (pixels.length / 4);
}

async function checkIcon(img, orb, name) {
  const pixels = iconPixels(img);
  if (!pixels) return; // can't be read: leave the icon as it is
  if (shareCovered(pixels) < 0.02 || samePicture(pixels, await chromeDefaultIcon())) {
    monogram(orb, name);
  } else if (shareVisibleOnWhite(pixels) < 0.02) {
    orb.dataset.backing = 'dark';
  }
}

function makeTile(site) {
  const name = siteName(site);
  const tile = document.createElement('a');
  tile.className = 'tile';
  tile.href = site.url;
  tile.title = name;

  const glass = document.createElement('span');
  glass.className = 'tile-glass';
  glass.setAttribute('aria-hidden', 'true');

  const orb = document.createElement('span');
  orb.className = 'orb';
  const src = iconUrl(site);
  if (src) {
    const icon = document.createElement('img');
    icon.alt = '';
    icon.addEventListener('load', () => checkIcon(icon, orb, name));
    icon.addEventListener('error', () => monogram(orb, name));
    icon.src = src;
    orb.append(icon);
  } else {
    monogram(orb, name);
  }

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = name;

  tile.append(glass, orb, label);
  return tile;
}

async function initTiles() {
  const container = document.getElementById('tiles');
  let sites = PREVIEW_SITES;
  if (isExtension && chrome.topSites) {
    try {
      sites = (await chrome.topSites.get()).slice(0, MAX_TILES);
    } catch {
      sites = [];
    }
  }
  container.replaceChildren(...sites.map(makeTile));
  container.hidden = sites.length === 0;
}

// ---------------------------------------------------------------------------
// Clock gadget
// ---------------------------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg';

function initClock() {
  const ticks = document.getElementById('clock-ticks');
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    if (major && i % 15 === 0) continue; // numerals sit at 12, 3, 6, 9
    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('class', major ? 'tick major' : 'tick');
    tick.setAttribute('x1', 100);
    tick.setAttribute('x2', 100);
    tick.setAttribute('y1', 22);
    tick.setAttribute('y2', major ? 31 : 26);
    tick.setAttribute('transform', `rotate(${i * 6} 100 100)`);
    ticks.append(tick);
  }
}

let calendarDay = null;

function tick() {
  const now = new Date();
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const turn = (id, deg) =>
    document.getElementById(id).setAttribute('transform', `rotate(${deg} 100 100)`);
  turn('hand-s', s * 6);
  turn('hand-m', m * 6);
  turn('hand-h', h * 30);
  document.getElementById('clock-label').textContent = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (now.getDate() !== calendarDay) renderCalendar(now);
}

// ---------------------------------------------------------------------------
// Calendar gadget (month names, weekday letters and week start follow the
// browser's language)
// ---------------------------------------------------------------------------
function firstDayOfWeek() {
  try {
    const locale = new Intl.Locale(navigator.language);
    const info = locale.getWeekInfo ? locale.getWeekInfo() : locale.weekInfo;
    return info.firstDay % 7; // 1..7 (Mon..Sun) -> 0..6 (Sun..Sat)
  } catch {
    return 0;
  }
}

function renderCalendar(now) {
  calendarDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = firstDayOfWeek();

  const head = document.createElement('div');
  head.className = 'cal-head';
  head.textContent = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now);

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  const cell = (text, className) => {
    const span = document.createElement('span');
    span.textContent = text;
    if (className) span.className = className;
    grid.append(span);
  };

  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
  for (let i = 0; i < 7; i++) {
    cell(weekday.format(new Date(2026, 0, 4 + ((start + i) % 7))), 'cal-dow'); // 4 Jan 2026 is a Sunday
  }

  const lead = (new Date(year, month, 1).getDay() - start + 7) % 7;
  for (let i = 0; i < lead; i++) cell('');
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day++) cell(day, day === calendarDay ? 'cal-today' : '');

  document.getElementById('calendar').replaceChildren(head, grid);
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------
function applyGadgets() {
  document.getElementById('clock').hidden = !settings.clock;
  document.getElementById('calendar').hidden = !settings.calendar;
}

function describeTier() {
  const active = root.dataset.gfx === 'full' ? 'Full glass' : 'Lite';
  document.getElementById('gfx-note').textContent =
    settings.gfx === 'auto'
      ? `Auto chose ${active} for this device.`
      : root.dataset.gfx === 'full'
        ? 'Frosted blur, glows and motion.'
        : 'No blur or motion. Best for slower Chromebooks.';
}

// The thumbnails are only fetched the first time the panel opens, so a new
// tab never pays for them.
function buildWallpaperGrid() {
  const grid = document.getElementById('wp-grid');
  if (grid.childElementCount) return;
  for (const wp of wallpapers) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wp-thumb';
    button.title = wp.name;
    button.dataset.id = wp.id;
    button.setAttribute('aria-label', wp.name);
    const thumb = document.createElement('img');
    thumb.alt = '';
    thumb.src = `wallpapers/thumbs/${wp.id}.jpg`;
    button.append(thumb);
    button.addEventListener('click', () => {
      setWallpaper(wp.id);
      markWallpaper();
    });
    grid.append(button);
  }
  markWallpaper();
}

function markWallpaper() {
  for (const button of document.querySelectorAll('.wp-thumb')) {
    button.setAttribute('aria-pressed', String(button.dataset.id === settings.wallpaper));
  }
  // Credit line for wallpapers that are someone else's work
  const current = wallpapers.find((wp) => wp.id === settings.wallpaper);
  const credit = document.getElementById('wp-credit');
  credit.hidden = !(current && current.credit);
  if (credit.hidden) return;
  const text = `${current.name}: ${current.credit}`;
  if (current.page) {
    const link = document.createElement('a');
    link.href = current.page;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;
    credit.replaceChildren(link);
  } else {
    credit.textContent = text;
  }
}

function initSettings() {
  const gear = document.getElementById('gear');
  const panel = document.getElementById('settings');

  const setOpen = (open) => {
    if (open) buildWallpaperGrid();
    panel.hidden = !open;
    gear.setAttribute('aria-expanded', String(open));
  };
  gear.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !gear.contains(event.target)) setOpen(false);
  });

  for (const radio of panel.querySelectorAll('input[name="gfx"]')) {
    radio.checked = radio.value === settings.gfx;
    radio.addEventListener('change', () => {
      choose('gfx', radio.value);
      applyTier();
      describeTier();
    });
  }

  for (const radio of panel.querySelectorAll('input[name="tiles"]')) {
    radio.checked = radio.value === settings.tiles;
    radio.addEventListener('change', () => {
      choose('tiles', radio.value);
      applyTiles();
    });
  }

  document.getElementById('wp-settings').hidden = wallpapers.length === 0;
  const cycle = document.getElementById('wp-cycle');
  cycle.checked = settings.cycle;
  cycle.addEventListener('change', () => choose('cycle', cycle.checked));

  for (const [id, key] of [['show-clock', 'clock'], ['show-calendar', 'calendar']]) {
    const box = document.getElementById(id);
    box.checked = settings[key];
    box.addEventListener('change', () => {
      choose(key, box.checked);
      applyGadgets();
    });
  }

  describeTier();
}

// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initLens();
  initSearch();
  initTiles();
  initClock();
  applyGadgets();
  initSettings();
  tick();
  setInterval(tick, 1000);
});
