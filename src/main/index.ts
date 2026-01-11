import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

// Kiosk mode configuration
const KIOSK_MODE = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    kiosk: KIOSK_MODE,
    frame: !KIOSK_MODE,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Kiosk mode: lock down the browser
  if (KIOSK_MODE) {
    mainWindow.setMenu(null);
    mainWindow.setFullScreenable(false);
  }

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools(); // Uncomment for debugging
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Security: Prevent navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
    }
  });

  // Security: Prevent new windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electron app lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Block keyboard shortcuts in kiosk mode
app.on('browser-window-focus', () => {
  if (KIOSK_MODE && mainWindow) {
    // Block common shortcuts
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('keydown', (e) => {
        // Block F12 (DevTools)
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        // Block Ctrl+R (refresh)
        if (e.ctrlKey && e.key === 'r') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        // Block Ctrl+C (copy - optional, may want to allow)
        // if (e.ctrlKey && e.key === 'c') {
        //   e.preventDefault();
        //   return false;
        // }
      });

      // Block context menu (right-click)
      window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
      });
    `);
  }
});
