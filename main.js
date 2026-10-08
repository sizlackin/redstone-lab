// Redstone Lab desktop app (Electron).
// The app itself is the web page in app/. This file opens it in its own window and adds a small menu
// (press Alt to show it) with "Get the newest version from GitHub".
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const APP_DIR = __dirname;
const INDEX = path.join(APP_DIR, 'app', 'index.html');
const REPO_URL = require('./package.json').homepage;
// Only the copy made by install.sh updates itself (it has this marker file).
// A copy you cloned yourself to edit is left alone, so your changes are never overwritten.
const MANAGED = fs.existsSync(path.join(APP_DIR, '.git', 'redstone-lab-installed'));

let win = null;
let updating = false;

function pageQuery() {
  if (process.env.REDSTONE_LAB_UPDATED !== '1') return {};
  // Cut by whole characters so an emoji is never split in half.
  return { updated: '1', msg: Array.from(process.env.REDSTONE_LAB_UPDATE_MSG || '').slice(0, 120).join('') };
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#121418',
    title: 'Redstone Lab',
    icon: path.join(APP_DIR, 'app', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  const w = win;
  w.once('ready-to-show', () => w.show());
  // Never leave an invisible window behind, even if the page has trouble loading.
  setTimeout(() => { if (!w.isDestroyed() && !w.isVisible()) w.show(); }, 4000);
  w.loadFile(INDEX, { query: pageQuery() }).catch(() => {
    if (!w.isDestroyed()) w.loadFile(INDEX).catch(() => {});
  });
  // Web links open in your normal browser, never inside the app.
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file://')) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  w.on('closed', () => { if (win === w) win = null; });
}

/* A message in the app's own pop-up at the bottom of the window. */
function toast(text) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript('window.redstoneLab && window.redstoneLab.showToast(' + JSON.stringify(text) + ')').catch(() => {});
}

/* Runs linux/sync.sh, which makes this folder match GitHub. Its first word says what happened. */
function runSync() {
  return new Promise((resolve) => {
    execFile('bash', [path.join(APP_DIR, 'linux', 'sync.sh')], { timeout: 45000 }, (err, stdout) => {
      resolve(String(stdout || '').trim() || (err ? 'offline' : 'current'));
    });
  });
}

async function updateFromGitHub() {
  if (updating) return;
  if (!MANAGED) {
    toast('This copy doesn’t update itself. Only the installed app (the one in your app menu) downloads new versions from GitHub, so your own edits here are safe.');
    return;
  }
  updating = true;
  toast('Checking GitHub for a newer version…');
  const out = await runSync();
  updating = false;
  if (out.startsWith('current')) { toast('You already have the newest version.'); return; }
  if (out.startsWith('broken')) {
    toast('The newest version on GitHub has a typo in ' + out.slice(7) + ', so it wasn’t installed. Fix it on GitHub and try again.');
    return;
  }
  if (out.startsWith('busy')) { toast('An update is already running. Try again in a moment.'); return; }
  if (!out.startsWith('updated')) {
    toast('Couldn’t reach GitHub. Check your internet connection and try again. The app keeps working with the version you have.');
    return;
  }
  const msg = out.replace(/^updated\s*/, '');
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    message: 'Downloaded the newest version from GitHub.',
    detail: (msg ? 'Latest change: “' + msg + '”\n\n' : '') + 'Restart the app to use it. Whatever is on the grid right now will be cleared, so press “Copy current layout” first if you want to keep it.',
  });
  if (response === 0) {
    process.env.REDSTONE_LAB_UPDATED = '1';
    process.env.REDSTONE_LAB_UPDATE_MSG = msg;
    app.relaunch();
    app.exit(0);
    return;
  }
  toast('The new version is downloaded. It starts the next time you open the app.');
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Redstone Lab',
      submenu: [
        { label: 'Get the newest version from GitHub', accelerator: 'CmdOrCtrl+U', click: () => { updateFromGitHub(); } },
        { label: 'Open the GitHub page', click: () => { shell.openExternal(REPO_URL); } },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
}

// Opening the app a second time just brings the existing window to the front.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(buildMenu());
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
