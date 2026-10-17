import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";

import { registerSliceIpc } from "./slice-ipc.js";
import {
  SqliteSliceStore,
  NewerSliceSaveError,
} from "../persistence/slice-store.js";
import { resolveRendererLoadPlan } from "./renderer-source.js";
import {
  buildMainWindowOptions,
  installWindowSecurity,
} from "./window-security.js";

let mainWindow: BrowserWindow | null = null;
let store: SqliteSliceStore | null = null;
let disposeIpcHandlers: (() => void) | null = null;

let storageError = "桌面存档无法打开，原文件已保留。";

function openStore(): void {
  try {
    const databasePath = join(app.getPath("userData"), "playable-slice.sqlite");
    store = new SqliteSliceStore(databasePath);
  } catch (error) {
    storageError =
      error instanceof NewerSliceSaveError
        ? "存档来自更新版本，当前程序不会覆盖它。请使用更新版本打开。"
        : "桌面存档无法打开，原文件已保留。请检查存储权限或恢复备份。";
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
  disposeIpcHandlers = registerSliceIpc({
    ipcMain,
    getWindow: () => mainWindow,
    getStore: () => store,
    getStorageError: () => storageError,
  });

  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (process.env.LOTM_TEST_USER_DATA)
  app.setPath("userData", process.env.LOTM_TEST_USER_DATA);

app
  .whenReady()
  .then(startApplication)
  .catch(() => undefined);

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
