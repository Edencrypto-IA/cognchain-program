/**
 * CongChain Desktop (Electron)
 *
 * Spawns the Next.js server (production build when available, dev otherwise)
 * and opens it in a native window — a Cursor-like local experience.
 *
 * Run:
 *   cd desktop && npm install
 *   (optional) cd .. && npm run build          # production server
 *   cd desktop && npm run dev                  # opens the app window
 *   npm run dist:win|dist:mac|dist:linux       # build installer (.exe/.dmg/.AppImage)
 */

const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 3200;
const APP_URL = `http://127.0.0.1:${PORT}`;

let serverProcess = null;
let mainWindow = null;

function hasProductionBuild() {
  return fs.existsSync(path.join(PROJECT_ROOT, '.next', 'BUILD_ID'));
}

function startNextServer() {
  const nextBin = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const args = hasProductionBuild()
    ? [nextBin, 'start', '-p', String(PORT)]
    : [nextBin, 'dev', '-p', String(PORT)];

  // ELECTRON_RUN_AS_NODE makes Electron act as a plain Node runtime for the child.
  serverProcess = spawn(process.execPath, args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore',
    windowsHide: true,
  });

  serverProcess.on('exit', () => {
    serverProcess = null;
  });
}

function waitForServer(attempts = 60) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get(APP_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        req.destroy();
        if (left <= 0) return reject(new Error('Servidor não respondeu a tempo.'));
        setTimeout(() => tryOnce(left - 1), 500);
      });
      req.setTimeout(1000, () => {
        req.destroy();
        if (left <= 0) return reject(new Error('Servidor não respondeu a tempo.'));
        setTimeout(() => tryOnce(left - 1), 500);
      });
    };
    tryOnce(attempts);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    title: 'CongChain',
    backgroundColor: '#06060e',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  try {
    await waitForServer();
    await mainWindow.loadURL(APP_URL);
  } catch (error) {
    dialog.showErrorBox(
      'CongChain não iniciou',
      `O servidor local não respondeu em ${APP_URL}.\n\n` +
        `Dica: rode antes "npm run build" na raiz do projeto, ou verifique se a porta ${PORT} está livre.\n\n${String(error)}`,
    );
    app.quit();
  }
}

app.whenReady().then(() => {
  startNextServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      /* already dead */
    }
    serverProcess = null;
  }
});
