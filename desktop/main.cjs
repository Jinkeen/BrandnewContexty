const { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, screen } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const port = Number(process.env.CONTEXTY_DESKTOP_PORT || 4174);
const appUrl = `http://127.0.0.1:${port}`;
let mainWindow;
let captureWindow;
let serverProcess;
let canvasReady = false;
const pendingCaptures = [];

async function serverIsReady() {
  try {
    const response = await fetch(appUrl, { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.text()).includes('Brandnew Contexty');
  } catch { return false; }
}

async function startLocalServer() {
  serverProcess = spawn('node', [path.join(projectRoot, 'server.mjs')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    windowsHide: true,
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await serverIsReady()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('本地服务启动失败，请检查端口是否被占用。');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'main-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadURL(appUrl);
  mainWindow.on('closed', () => { mainWindow = null; canvasReady = false; });
  mainWindow.webContents.on('did-start-loading', () => { canvasReady = false; });
}

async function startCapture() {
  if (captureWindow) { captureWindow.focus(); return; }
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.bounds.width * display.scaleFactor),
      height: Math.round(display.bounds.height * display.scaleFactor)
    }
  });
  const source = sources.find(item => item.display_id === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) throw new Error('无法读取当前屏幕。');
  captureWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#17202b',
    webPreferences: {
      preload: path.join(__dirname, 'capture-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const window = captureWindow;
  window.on('closed', () => { if (captureWindow === window) captureWindow = null; });
  await window.loadFile(path.join(__dirname, 'capture.html'));
  window.webContents.send('capture:source', source.thumbnail.toDataURL());
  window.show();
  window.focus();
}

function closeCapture() {
  if (captureWindow && !captureWindow.isDestroyed()) captureWindow.close();
}

ipcMain.on('capture:cancel', closeCapture);
ipcMain.on('capture:start', () => {
  startCapture().catch(error => console.error('截图失败：', error));
});
ipcMain.on('capture:ready', () => {
  canvasReady = true;
  while (pendingCaptures.length && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('contexty:capture', pendingCaptures.shift());
  }
});
ipcMain.handle('capture:save', (event, data) => {
  if (!captureWindow || event.sender !== captureWindow.webContents) throw new Error('无效的截图窗口');
  const memo = String(data?.memo || '').trim().slice(0, 2000);
  const image = data?.image;
  if (!memo || typeof image !== 'string' || !/^data:image\/jpeg;base64,/.test(image) || image.length > 5_000_000) {
    throw new Error('请框选区域并填写想法');
  }
  const capture = { image, memo, source: '屏幕截图', createdAt: Date.now() };
  if (canvasReady && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('contexty:capture', capture);
  else pendingCaptures.push(capture);
  closeCapture();
  return true;
});

app.whenReady().then(async () => {
  try {
    await startLocalServer();
    createMainWindow();
    if (!globalShortcut.register('CommandOrControl+Shift+S', () => {
      startCapture().catch(error => console.error('截图失败：', error));
    })) dialog.showMessageBox(mainWindow, { type: 'warning', message: 'Ctrl+Shift+S 已被其他应用占用', detail: '你仍可点击画布底部的“截屏”按钮。' });
  } catch (error) {
    console.error(error);
    dialog.showErrorBox('Brandnew Contexty 启动失败', error.message);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
