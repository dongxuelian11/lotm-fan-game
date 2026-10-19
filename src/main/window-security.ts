import type { BrowserWindowConstructorOptions } from "electron";

export interface NavigationEvent {
  preventDefault(): void;
}

export interface WindowSecurityTarget {
  webContents: {
    setWindowOpenHandler(handler: (details: unknown) => { action: "deny" }): void;
    on(
      event: "will-navigate",
      listener: (event: NavigationEvent, url: string) => void,
    ): void;
    on(
      event: "will-attach-webview",
      listener: (event: NavigationEvent, ...args: unknown[]) => void,
    ): void;
  };
}

export function buildMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  };
}

export function installWindowSecurity(
  target: WindowSecurityTarget,
  allowedNavigationUrl: string,
): void {
  target.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  target.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url, allowedNavigationUrl)) {
      event.preventDefault();
    }
  });

  target.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

function isAllowedNavigation(url: string, allowedNavigationUrl: string): boolean {
  try {
    return new URL(url).toString() === new URL(allowedNavigationUrl).toString();
  } catch {
    return url === allowedNavigationUrl;
  }
}
