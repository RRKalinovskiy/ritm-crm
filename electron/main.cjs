const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');

const APP_ORIGIN = 'app://ritm';
const APP_ROOT = path.join(__dirname, '..');

// Стабильная папка данных, не зависящая от отображаемого названия приложения.
app.setPath('userData', path.join(app.getPath('appData'), 'RITM-CRM'));

const DIST_ROOT = path.join(APP_ROOT, 'dist');
const DEV_URL = process.env.RITM_DEV_URL;
const ICON_PATH = path.join(APP_ROOT, 'build', 'icon.png');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#F3F6F4',
    title: 'РИТМ — CRM студии',
    icon: ICON_PATH,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith(APP_ORIGIN) || (DEV_URL && url.startsWith(DEV_URL));
    if (!isLocal) {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        void shell.openExternal(url);
      }
    }
  });

  if (DEV_URL) {
    void mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  }
}

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const target = path.normalize(path.join(DIST_ROOT, decoded));

    if (target !== DIST_ROOT && !target.startsWith(DIST_ROOT + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(target).toString());
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerAppProtocol();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
