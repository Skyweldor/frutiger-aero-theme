# Frutiger Aero Glass Theme Suite

Glossy, sky-blue and emerald color themes inspired by the mid-2000s Frutiger Aero look, with an optional frosted **glass mode**: a scenic wallpaper behind see-through panels, glass tabs and headers, and an Aero-style title bar.

![Daylight Glass with Scenic Wallpaper glass mode](images/screenshot-daylight-glass.png)

| Deep Aqua | Split editor |
| --- | --- |
| ![Deep Aqua with glass mode](images/screenshot-deep-aqua.png) | ![Two editors side by side under glass](images/screenshot-split-editor.png) |

![Glass bottom panel under the editor](images/screenshot-glass-panel.png)

*Screenshots show the Scenic Wallpaper + Full Glass mode.*

## Install

**From the VS Code Marketplace:** [install Frutiger Aero Glass Theme Suite](https://marketplace.visualstudio.com/items?itemName=synthcity-digilabs.frutiger-aero-theme), or search for "Frutiger Aero" in the Extensions view. Updates install automatically.

**From a GitHub release:** download the `.vsix` file from the [latest release](https://github.com/Skyweldor/frutiger-aero-theme/releases/latest), then either:

- In the Extensions view, click **⋯** at the top, choose **Install from VSIX...** and pick the file, or
- Run `code --install-extension frutiger-aero-theme-1.0.0.vsix` in a terminal.

The `.vsix` also works in VS Code-based editors such as Antigravity, Cursor and VSCodium.

## Color themes

Open the theme picker (`Ctrl+K Ctrl+T`, or `Cmd+K Cmd+T` on macOS) and choose:

- **Frutiger Aero (Daylight Glass)**: bright cerulean, emerald and sky-blue.
- **Frutiger Aero (Deep Aqua)**: deeper ocean and teal for long sessions.
- **Frutiger Aero (Night)**: midnight navy, moonlit cyan and dim teal.

The color themes work on their own and don't change anything else about VS Code.

## Glass mode (optional)

VS Code themes can only set flat colors, so the glass effects are stylesheets injected by the free [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css) extension. This extension sets everything up for you.

1. Choose one of the Frutiger Aero color themes.
2. Run **Frutiger Aero: Enable Glass Mode** from the Command Palette (`Ctrl+Shift+P`).
3. Pick a mode:
   - **Scenic Wallpaper + Full Glass** (recommended): wallpaper behind frosted, see-through panels.
   - **Night Wallpaper + Full Glass**: moonlit wallpaper behind blue-teal glass (pairs well with the Night color theme).
   - **Pure CSS Mesh & Orbs**: gradient hills and glass orbs, no image.
   - **Minimal Glass Chrome**: glossy tabs, headers and title bar on a plain editor.
4. If the loader isn't installed yet, click **Install Loader**, then run the command again.
5. Click **Apply Now**, then **fully quit and reopen** VS Code. Reloading the window isn't enough.

To undo everything, run **Frutiger Aero: Disable Glass Mode**.

### What glass mode changes

- Adds the chosen stylesheets to `vscode_custom_css.imports`. Any imports of your own are kept.
- Makes `sideBar.background` transparent for the three Frutiger Aero themes only, so panels like chat views show the glass. This isn't done in Minimal mode.
- Sets `window.controlsStyle` to `custom` on Windows and Linux, so the minimize, maximize and close buttons can be drawn as glass buttons. Disabling glass restores the value you had before.

### Your own Night wallpaper

Night mode already works with a CSS-only moonlit sky, so no image is required. To use your own artwork:

1. Save it as `assets/frutiger-aero-night-wallpaper.jpg` (JPEG; a wide 16:9 image works best).
2. Run `npm run build:embed`. This rewrites `css/frutiger-aero-night-wallpaper-embed.css` with the image embedded as a data URI (VS Code blocks `file:///` images). The Daylight wallpaper is regenerated at the same time.
3. Repackage/reinstall the extension (or reload it in development), then run **Frutiger Aero: Enable Glass Mode** → **Night Wallpaper + Full Glass**.

If you remove your Night JPG and run the build again, the CSS fallback sky is restored.

### Good to know

- **"Your installation appears to be corrupt":** the loader works by patching VS Code's files, so VS Code shows this warning. It's expected. Choose **Don't show again**.
- **After a VS Code update,** the patch is removed. Run **Enable Glass Mode** (or the loader's **Reload Custom CSS and JS**) again and restart.
- **After this extension updates,** it offers to re-apply the glass from the new version automatically.
- **Administrator rights:** if VS Code is installed in a protected folder such as `Program Files`, the loader needs VS Code to run as administrator once to apply the patch.
- **Pages that stay mostly solid:** webview pages in the editor area, such as Markdown preview and extension details, show the theme's tinted editor color instead of full glass, because the stylesheets can't reach inside them.
- **Claude Code tool output looks blank:** with Full Glass or Mesh & Orbs, the boxes that show a tool's input and output in the Claude Code panel can appear empty. They fade out using the sidebar color, which glass mode makes transparent. The optional [patch script](scripts/patch-claude-code-webview.js) in this repository fixes it: run `node scripts/patch-claude-code-webview.js`, then reload the window. Run it again after each Claude Code update. Minimal Glass Chrome mode isn't affected.

## Development

Requires Node.js 18 or newer. No `npm install` is needed: the extension has no runtime dependencies. To rebuild the embedded wallpapers and create an installable VSIX:

```bash
npm run package
```

This runs `npm run build:embed`, then `npx @vscode/vsce package` and writes `dist/frutiger-aero-theme-<version>.vsix`. Install it with `code --install-extension dist/frutiger-aero-theme-<version>.vsix`.

> The wallpaper JPGs live in `assets/` but are excluded from the VSIX by `.vscodeignore`. Only the generated `css/*-wallpaper-embed.css` files are shipped, so run the build **after** changing `assets/frutiger-aero-wallpaper.jpg` or `assets/frutiger-aero-night-wallpaper.jpg`.

For a quick local test without packaging, run `powershell -ExecutionPolicy Bypass -File .\install-theme.ps1` to copy the folder into `~/.vscode/extensions` (and `~/.antigravity/extensions`).

## License

[MIT](LICENSE). Published by [SynthCity DigiLabs](https://www.synthcitydigilabs.com/).
