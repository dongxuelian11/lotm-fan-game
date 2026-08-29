import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";

import { registerIpcHandlers } from "./ipc.js";
import { SqliteGameStore } from "../persistence/sqlite-store.js";
import { resolveRendererLoadPlan } from "./renderer-source.js";
import { buildMainWindowOptions, installWindowSecurity } from "./window-security.js";

let mainWindow: BrowserWindow | null = null;
let store: SqliteGameStore | null = null;
let disposeIpcHandlers: (() => void) | null = null;

function openStore(): void {
  try {
    const databasePath = join(app.getPath("userData"), "mystery-game.sqlite");
    store = new SqliteGameStore(databasePath, app.getVersion());
  } catch {
    store = null;
  }
}

function createMainWindow(): BrowserWindow {
  const preloadPath = join(__dirname, "preload.js");
  const window = new BrowserWindow(buildMainWindowOptions(preloadPath));
  const rendererPath = join(__dirname, "../renderer/index.html");
  const rendererLoadPlan = resolveRendererLoadPlan({
    isPackaged: app.isPackaged,
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    rendererPath,
  });

  installWindowSecurity(window, rendererLoadPlan.allowedNavigationUrl);

  window.once("ready-to-show", () => {
    window.show();
  });

  if (rendererLoadPlan.kind === "dev-server") {
    void window.loadURL(rendererLoadPlan.devServerUrl).catch(() => undefined);
  } else {
    void window.loadFile(rendererLoadPlan.rendererPath).catch(() => undefined);
  }

  return window;
}

function startApplication(): void {
  openStore();
  disposeIpcHandlers = registerIpcHandlers({
    ipcMain,
    getWindow: () => mainWindow,
    getStore: () => store,
    appVersion: app.getVersion(),
  });

  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(startApplication).catch(() => undefined);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }
});

app.on("before-quit", () => {
  disposeIpcHandlers?.();
  disposeIpcHandlers = null;
  store?.close();
  store = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
