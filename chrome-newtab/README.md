# Frutiger Aero Glass New Tab (prototype)

A Chrome extension that replaces the New Tab page with a Frutiger Aero one: a choice of wallpapers, a glass search box, your most visited sites as clear bubbles, and clock and calendar gadgets. It works on Chromebooks and on Chrome for Windows, macOS and Linux.

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

The same panel shows or hides the clock and the calendar. Both are off to start with.

## Tiles

The **Tiles** setting changes how the most visited sites are drawn:

| Setting | What it looks like |
| --- | --- |
| Bubbles (default) | Each site sits in a round, clear bubble with a bright rim, a rainbow soap film and a highlight. On Full glass the wallpaper bends inside the bubble like a glass ball. |
| Clear | A barely tinted pane with a gloss band and only a light blur, so the wallpaper shows through. |
| Frosted | The original frosted squares. |

Site icons that are white or very pale, such as sites that switch to a white icon when the browser is in dark mode, get a deep aqua orb so they stay visible. A site Chrome has no icon for shows a coloured letter instead.

## Wallpapers

The **Wallpaper** setting shows a thumbnail for every wallpaper in `wallpapers/`. Click one to use it. **New wallpaper on every new tab** is on to start with: each new tab moves to the next wallpaper in the list, beginning with the bubbles day wallpaper on the very first tab. Untick it to keep the one you picked.

The page loads only the chosen wallpaper. Thumbnails load the first time the settings panel opens.

Nine wallpapers were made for this project: bubbles, balloons and ribbons, each in a day, sunset and night version. The rest are by other people; `wallpapers/CREDITS.md` lists who made each one, its licence and where it came from, and the settings panel shows a credit line when one of them is selected.

## Matching browser colours

The page can't change Chrome's tab strip, toolbar or address bar. For those, load one of the two colour themes in `../chrome-themes/`: Frutiger Aero Blue or Frutiger Aero Night.

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
- `wallpapers.js`: the list of wallpapers the page offers.
- `wallpapers/`: the wallpapers, their thumbnails in `thumbs/`, and `CREDITS.md`.
- `icons/`: the suite icon at 16, 48 and 128 px.
