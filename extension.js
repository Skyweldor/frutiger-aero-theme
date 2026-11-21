// @ts-check
// Frutiger Aero Glass Theme Suite
// The color themes work on their own. This file adds two commands that set up
// (or remove) the optional frosted-glass layer, which is injected into VS Code
// by the third-party "Custom CSS and JS Loader" extension.

const vscode = require('vscode');
const path = require('path');
const { pathToFileURL } = require('url');

const LOADER_ID = 'be5invis.vscode-custom-css';
const LOADER_APPLY_CMD = 'extension.updateCustomCSS';
const LOADER_REMOVE_CMD = 'extension.uninstallCustomCSS';
const GLOBAL = vscode.ConfigurationTarget.Global;

const THEMES = [
  'Frutiger Aero (Daylight Glass)',
  'Frutiger Aero (Deep Aqua)',
  'Frutiger Aero (Night)',
];

// Matches any stylesheet this extension has ever written into the imports list,
// from any install location or version.
const OUR_CSS =
  /frutiger-aero-(full-wallpaper|mesh-orbs|minimal-glass|wallpaper-embed|night-overrides|night-wallpaper-embed)\.css$/;

const MODES = [
  {
    id: 'full',
    label: 'Scenic Wallpaper + Full Glass',
    description: 'Recommended',
    detail: 'Wallpaper behind frosted, see-through panels.',
    files: ['frutiger-aero-full-wallpaper.css', 'frutiger-aero-wallpaper-embed.css'],
    seeThroughPanels: true,
  },
  {
    id: 'night',
    label: 'Night Wallpaper + Full Glass',
    description: 'Nocturnal',
    detail: 'Moonlit night wallpaper behind frosted blue-teal glass.',
    files: [
      'frutiger-aero-full-wallpaper.css',
      'frutiger-aero-night-overrides.css',
      'frutiger-aero-night-wallpaper-embed.css',
    ],
    seeThroughPanels: true,
  },
  {
    id: 'mesh',
    label: 'Pure CSS Mesh & Orbs',
    description: 'No image',
    detail: 'Gradient hills, sky and glass orbs drawn with CSS.',
    files: ['frutiger-aero-mesh-orbs.css'],
    seeThroughPanels: true,
  },
  {
    id: 'minimal',
    label: 'Minimal Glass Chrome',
    description: 'Lightest',
    detail: 'Glossy tabs, headers and title bar; plain editor background.',
    files: ['frutiger-aero-minimal-glass.css'],
    seeThroughPanels: false,
  },
];

// Theme overrides needed for see-through panels: webview panels (chat, etc.)
// paint with sideBar.background, so it must be transparent for the glass to show.
const SEE_THROUGH_COLORS = { 'sideBar.background': '#00000000' };

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('frutigerAero.enableGlass', () => enableGlass(context)),
    vscode.commands.registerCommand('frutigerAero.disableGlass', () => disableGlass(context))
  );
  // Each extension update installs to a new folder, so stored paths go stale.
  refreshPathsAfterUpdate(context).catch((err) => console.error('[Frutiger Aero]', err));
}

function deactivate() {}

// ---------------------------------------------------------------------------

/** @param {vscode.ExtensionContext} context */
async function enableGlass(context) {
  const mode = await vscode.window.showQuickPick(MODES, {
    title: 'Frutiger Aero: choose a glass mode',
    placeHolder: 'Pick how much glass you want',
  });
  if (!mode) return;

  await writeImports(cssUrls(context, mode));
  await setSeeThroughColors(mode.seeThroughPanels);
  await setCustomWindowControls(true, context);
  await context.globalState.update('glassMode', mode.id);

  await applyWithLoader(
    `Frutiger Aero "${mode.label}" is configured.`,
    'Apply Now'
  );
}

/** @param {vscode.ExtensionContext} context */
async function disableGlass(context) {
  const remaining = await writeImports([]);
  await setSeeThroughColors(false);
  await setCustomWindowControls(false, context);
  await context.globalState.update('glassMode', undefined);

  if (!vscode.extensions.getExtension(LOADER_ID)) {
    vscode.window.showInformationMessage('Frutiger Aero glass settings removed.');
    return;
  }
  if (remaining.length === 0) {
    const pick = await vscode.window.showInformationMessage(
      'Frutiger Aero glass settings removed. Remove the injected CSS from VS Code too? (Restart afterwards.)',
      'Remove Now'
    );
    if (pick) await vscode.commands.executeCommand(LOADER_REMOVE_CMD);
  } else {
    const pick = await vscode.window.showInformationMessage(
      'Frutiger Aero glass settings removed. Your other custom CSS imports were kept. Re-apply them now? (Restart afterwards.)',
      'Re-apply'
    );
    if (pick) await vscode.commands.executeCommand(LOADER_APPLY_CMD);
  }
}

/** @param {vscode.ExtensionContext} context */
async function refreshPathsAfterUpdate(context) {
  const mode = MODES.find((m) => m.id === context.globalState.get('glassMode'));
  if (!mode) return; // glass mode never enabled through this extension

  const wanted = cssUrls(context, mode);
  const current = globalValue('vscode_custom_css', 'imports') || [];
  const ours = current.filter((u) => typeof u === 'string' && OUR_CSS.test(u));
  if (ours.length === wanted.length && ours.every((u, i) => u === wanted[i])) return;

  await writeImports(wanted);
  await applyWithLoader('Frutiger Aero was updated.', 'Re-apply Glass');
}

// ---------------------------------------------------------------------------

/**
 * @param {vscode.ExtensionContext} context
 * @param {{files: string[]}} mode
 */
function cssUrls(context, mode) {
  return mode.files.map((f) => pathToFileURL(path.join(context.extensionPath, 'css', f)).href);
}

/**
 * Replace this extension's entries in vscode_custom_css.imports, keeping the user's own.
 * @param {string[]} ourUrls
 * @returns {Promise<string[]>} the user's other imports that were kept
 */
async function writeImports(ourUrls) {
  const current = globalValue('vscode_custom_css', 'imports') || [];
  const kept = current.filter((u) => !(typeof u === 'string' && OUR_CSS.test(u)));
  const next = [...kept, ...ourUrls];
  await vscode.workspace
    .getConfiguration('vscode_custom_css')
    .update('imports', next.length ? next : undefined, GLOBAL);
  return kept;
}

/** @param {boolean} enable */
async function setSeeThroughColors(enable) {
  const all = { ...(globalValue('workbench', 'colorCustomizations') || {}) };
  for (const theme of THEMES) {
    const key = `[${theme}]`;
    const entry = { ...(all[key] || {}) };
    for (const [token, value] of Object.entries(SEE_THROUGH_COLORS)) {
      if (enable) entry[token] = value;
      else if (entry[token] === value) delete entry[token];
    }
    if (Object.keys(entry).length) all[key] = entry;
    else delete all[key];
  }
  await vscode.workspace
    .getConfiguration('workbench')
    .update('colorCustomizations', Object.keys(all).length ? all : undefined, GLOBAL);
}

/**
 * HTML window buttons, so the stylesheet can draw Aero caption buttons.
 * Remembers the user's previous setting so disabling glass restores it instead
 * of clearing a value that was already set before glass mode was enabled.
 * @param {boolean} enable
 * @param {vscode.ExtensionContext} context
 */
async function setCustomWindowControls(enable, context) {
  if (process.platform === 'darwin') return; // macOS keeps native traffic lights
  try {
    const config = vscode.workspace.getConfiguration('window');
    const savedKey = 'controlsStyleBeforeGlass';
    if (enable) {
      // Switching modes re-enables glass; keep the value saved the first time.
      if (context.globalState.get(savedKey) === undefined) {
        await context.globalState.update(savedKey, globalValue('window', 'controlsStyle') ?? null);
      }
      await config.update('controlsStyle', 'custom', GLOBAL);
    } else {
      const previous = context.globalState.get(savedKey);
      await config.update('controlsStyle', previous ?? undefined, GLOBAL);
      await context.globalState.update(savedKey, undefined);
    }
  } catch {
    // Older VS Code without window.controlsStyle: buttons stay native, rest still works.
  }
}

/**
 * @param {string} message
 * @param {string} applyLabel
 */
async function applyWithLoader(message, applyLabel) {
  if (!vscode.extensions.getExtension(LOADER_ID)) {
    const pick = await vscode.window.showInformationMessage(
      `${message} The glass layer needs the "Custom CSS and JS Loader" extension to inject it into VS Code.`,
      'Install Loader'
    );
    if (pick) {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', LOADER_ID);
      vscode.window.showInformationMessage(
        'Loader installed. Run "Frutiger Aero: Enable Glass Mode" once more to apply the glass.'
      );
    }
    return;
  }
  const pick = await vscode.window.showInformationMessage(
    `${message} Apply the glass now? Fully quit and reopen VS Code afterwards. ` +
      'VS Code may then say the installation is corrupt; that warning is expected with custom CSS.',
    applyLabel
  );
  if (pick) await vscode.commands.executeCommand(LOADER_APPLY_CMD);
}

/**
 * @param {string} section
 * @param {string} key
 */
function globalValue(section, key) {
  const info = vscode.workspace.getConfiguration(section).inspect(key);
  return /** @type {any} */ (info && info.globalValue);
}

module.exports = { activate, deactivate };
