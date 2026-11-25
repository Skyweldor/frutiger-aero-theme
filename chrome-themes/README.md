# Frutiger Aero Chrome themes (prototype)

Two colour themes for Chrome's tab strip, toolbar and address bar, in the same style as the Frutiger Aero themes for VS Code.

| Folder | Theme | Look | Matches the VS Code theme |
| --- | --- | --- | --- |
| `blue/` | Frutiger Aero Blue | Glossy sky-blue tab strip, light aqua toolbar, dark text | Frutiger Aero Daylight |
| `night/` | Frutiger Aero Night | Deep navy and aqua, light text, dark address bar | Frutiger Aero Deep Aqua |

They go well with the New Tab page in `../chrome-newtab/`, but each works on its own.

## Try one

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose the `blue` or `night` folder.

Chrome uses one theme at a time, so loading the other one replaces it.

A Chrome theme is a fixed set of colours: it doesn't switch between Blue and Night when the computer changes between light and dark mode. Anyone who wants that can stay on Chrome's own colours, which do follow the computer's setting. So there are three choices:

| Choice | How |
| --- | --- |
| Frutiger Aero Blue | Load the `blue` folder |
| Frutiger Aero Night | Load the `night` folder |
| Follow the computer's light or dark mode | No theme. If one is loaded, open **Settings > Appearance** and click **Reset to default** next to Theme |

Other browsers built on Chromium, such as Brave and Edge, should accept the same folders. That hasn't been tested yet.

## Changing the colours

Everything in the `blue` and `night` folders is generated from the palettes at the top of `scripts/build-chrome-themes.js`. Edit the colours there, then run this from the repository root:

```
node scripts/build-chrome-themes.js
```

It rewrites both `manifest.json` files and the gradient images in each `images` folder:

| Image | Where Chrome draws it |
| --- | --- |
| `frame.png` | Behind the tab strip while the window is focused |
| `frame-inactive.png` | Behind the tab strip while the window isn't focused |
| `toolbar.png` | Behind the toolbar, the selected tab and the bookmarks bar |

To see a change, load the theme's folder again with **Load unpacked**.
