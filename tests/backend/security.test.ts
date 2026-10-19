import { describe, expect, it, vi } from "vitest";

import {
  buildMainWindowOptions,
  installWindowSecurity,
  type WindowSecurityTarget,
} from "../../src/main/window-security.js";
import { resolveRendererLoadPlan } from "../../src/main/renderer-source.js";

describe("R2 Electron security boundary", () => {
  it("pins the required BrowserWindow web preferences", () => {
    const options = buildMainWindowOptions("C:\\app\\preload.js");

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
    });
    expect(options.webPreferences?.preload).toBe("C:\\app\\preload.js");
    expect(options).toMatchObject({
      width: 1600,
      height: 900,
      minWidth: 1280,
      minHeight: 720,
    });
  });

  it("denies new windows, webviews, and non-app navigations", () => {
    const openHandler = vi.fn();
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const target: WindowSecurityTarget = {
      webContents: {
        setWindowOpenHandler: openHandler,
        on: (event, listener) => listeners.set(event, listener),
      },
    };

    installWindowSecurity(target, "http://127.0.0.1:5173/");

    const denied = openHandler.mock.calls[0]?.[0] as () => { action: string };
    expect(denied()).toEqual({ action: "deny" });

    const navigation = { preventDefault: vi.fn() };
    listeners.get("will-navigate")?.(navigation, "https://example.com/");
    listeners.get("will-attach-webview")?.(navigation);

    expect(navigation.preventDefault).toHaveBeenCalledTimes(2);
  });

  it("keeps packaged startup on the local renderer even when the dev URL is set", () => {
    const rendererPath = "C:\\app\\renderer\\index.html";

    expect(
      resolveRendererLoadPlan({
        isPackaged: true,
        devServerUrl: "http://127.0.0.1:5173",
        rendererPath,
      }),
    ).toMatchObject({ kind: "local-file", rendererPath });
  });

  it("falls back to the local renderer for a remote development URL", () => {
    const rendererPath = "C:\\app\\renderer\\index.html";

    expect(
      resolveRendererLoadPlan({
        isPackaged: false,
        devServerUrl: "https://renderer-attacker.example/",
        rendererPath,
      }),
    ).toMatchObject({ kind: "local-file", rendererPath });
  });

  it("accepts only the exact loopback development origin", () => {
    expect(
      resolveRendererLoadPlan({
        isPackaged: false,
        devServerUrl: "http://127.0.0.1:5173",
        rendererPath: "C:\\app\\renderer\\index.html",
      }),
    ).toEqual({
      kind: "dev-server",
      devServerUrl: "http://127.0.0.1:5173/",
      allowedNavigationUrl: "http://127.0.0.1:5173/",
    });
  });
});
