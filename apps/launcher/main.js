const { app, Menu, Tray, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');
const treeKill = require('tree-kill');

let childProc;
let tray;

const PROJECT_DIR = path.resolve(__dirname, '..', '..'); // adjust if needed
const START_CMD = process.env.START_CMD || 'npm run dev'; // customize if you use pnpm/turbo
const APP_URL = process.env.APP_URL || 'http://localhost:3030';
const START_TIMEOUT_MS = Number(process.env.START_TIMEOUT_MS || 60000);

function startDev() {
  childProc = spawn(START_CMD, {
    cwd: PROJECT_DIR,
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  childProc.stdout.on('data', d => console.log(String(d)));
  childProc.stderr.on('data', d => console.error(String(d)));
  childProc.on('exit', (code, signal) => {
    console.log(`dev process exited (code=${code}, signal=${signal})`);
  });
}

async function waitAndOpen() {
  try {
    await waitOn({ resources: [APP_URL], timeout: START_TIMEOUT_MS, validateStatus: s => s === 200 });
    await shell.openExternal(APP_URL);
  } catch (err) {
    dialog.showErrorBox('Server did not start', `Could not reach ${APP_URL} within ${START_TIMEOUT_MS/1000}s.\n\n${err.message}`);
  }
}

function buildMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open App', click: () => shell.openExternal(APP_URL) },
    { type: 'separator' },
    { label: 'Quit', click: quitAll }
  ]);
  return contextMenu;
}

function quitAll() {
  if (childProc && !childProc.killed) {
    try { treeKill(childProc.pid); } catch (_) {}
  }
  app.quit();
}

/*
app.on('ready', async () => {
  // tray icon (template icon looks nice in macOS menu bar)
  const iconPath = path.join(__dirname, 'iconTemplate.png'); // optional; any 18–22px monochrome PNG
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Ticket-Check');
  tray.setContextMenu(buildMenu());

  startDev();
  waitAndOpen();
});

app.on('before-quit', () => {
  if (childProc && !childProc.killed) {
    try { treeKill(childProc.pid); } catch (_) {}
  }
});
*/

console.log("Electron launcher is currently deactivated.");