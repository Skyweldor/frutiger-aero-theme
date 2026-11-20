# Frutiger Aero Glass New Tab (prototype)

A Chrome extension that replaces the New Tab page with a Frutiger Aero one: the suite's scenic wallpaper, a glass search box, glass tiles for your most visited sites, and clock and calendar gadgets. It works on Chromebooks and on Chrome for Windows, macOS and Linux.

This is a prototype. It is not on the Chrome Web Store yet.

## Try it

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose this `chrome-newtab` folder.
3. Open a new tab. Chrome asks once whether to keep the new page; choose **Keep it**.

You can also open `newtab.html` straight from disk to see the design. In that preview the tiles are samples and the search box does nothing, because both need the extension to be installed.

## Graphics tiers

The gear button (bottom right) has a **Graphics** setting:

| Setting | What it does |
| --- | --- |
| Auto (default) | Picks Lite on devices that report 4 GB of memory or less, 2 CPU cores or fewer, or a system "reduce transparency" preference. Otherwise picks Full glass. |
| Full glass | Frosted blur behind the glass, glows and hover motion. |
| Lite | No blur and no motion. The glass becomes a flat see-through tint, which is cheap to draw on slower Chromebooks. |

The same panel shows or hides the clock and the calendar.

## Permissions

| Permission | Why |
| --- | --- |
| `search` | Sends what you type to your own default search engine. |
| `topSites` | Lists your most visited sites as tiles. |
| `favicon` | Shows each tile's site icon. |

The page makes no network requests and stores only its own settings, in the browser's local storage.

## Files

- `manifest.json`: the extension manifest (Manifest V3).
- `newtab.html`, `newtab.css`, `newtab.js`: the page.
- `wallpaper.jpg`: a copy of `assets/frutiger-aero-wallpaper.jpg`.
- `icons/`: the suite icon at 16, 48 and 128 px.
