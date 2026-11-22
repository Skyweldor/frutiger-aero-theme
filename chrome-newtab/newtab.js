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
  wallpaper: 'bubbles-day',
  cycle: false,
  clock: true,
  calendar: true,
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('aero-newtab') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem('aero-newtab', JSON.stringify(settings));
  } catch {
    /* private window or blocked storage: settings last for this tab only */
  }
}

const settings = loadSettings();

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

function applyWallpaper() {
  const chosen = wallpapers.find((wp) => wp.id === settings.wallpaper) || wallpapers[0];
  if (chosen) root.style.setProperty('--wallpaper', `url("wallpapers/${chosen.id}.jpg")`);
}

// "New wallpaper on every new tab": step to the next one in the list each
// time the page opens, wrapping round at the end.
if (settings.cycle && wallpapers.length > 1) {
  const current = wallpapers.findIndex((wp) => wp.id === settings.wallpaper);
  settings.wallpaper = wallpapers[(current + 1) % wallpapers.length].id;
  saveSettings();
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
  orb.dataset.hue = '';
  orb.style.setProperty('--h', hueFor(name));
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
  if (isExtension && site.url !== '#') {
    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(site.url)}&size=32`;
    icon.addEventListener('error', () => monogram(orb, name));
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
      settings.wallpaper = wp.id;
      saveSettings();
      applyWallpaper();
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
  const chosen = wallpapers.find((wp) => wp.id === settings.wallpaper);
  const credit = document.getElementById('wp-credit');
  credit.hidden = !(chosen && chosen.credit);
  if (credit.hidden) return;
  const text = `${chosen.name}: ${chosen.credit}`;
  if (chosen.page) {
    const link = document.createElement('a');
    link.href = chosen.page;
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
      settings.gfx = radio.value;
      saveSettings();
      applyTier();
      describeTier();
    });
  }

  for (const radio of panel.querySelectorAll('input[name="tiles"]')) {
    radio.checked = radio.value === settings.tiles;
    radio.addEventListener('change', () => {
      settings.tiles = radio.value;
      saveSettings();
      applyTiles();
    });
  }

  document.getElementById('wp-settings').hidden = wallpapers.length === 0;
  const cycle = document.getElementById('wp-cycle');
  cycle.checked = settings.cycle;
  cycle.addEventListener('change', () => {
    settings.cycle = cycle.checked;
    saveSettings();
  });

  for (const [id, key] of [['show-clock', 'clock'], ['show-calendar', 'calendar']]) {
    const box = document.getElementById(id);
    box.checked = settings[key];
    box.addEventListener('change', () => {
      settings[key] = box.checked;
      saveSettings();
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
