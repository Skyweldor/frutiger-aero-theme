'use strict';

// Frutiger Aero Glass New Tab.
// No network requests, no accounts: everything on this page is local.

const root = document.documentElement;
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

// ---------------------------------------------------------------------------
// Settings (kept in localStorage; the page works without it)
// ---------------------------------------------------------------------------
const DEFAULTS = { gfx: 'auto', clock: true, calendar: true };

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

  tile.append(orb, label);
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

function initSettings() {
  const gear = document.getElementById('gear');
  const panel = document.getElementById('settings');

  const setOpen = (open) => {
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
  initSearch();
  initTiles();
  initClock();
  applyGadgets();
  initSettings();
  tick();
  setInterval(tick, 1000);
});
