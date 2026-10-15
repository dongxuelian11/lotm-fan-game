/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureMysteryGameBridge } from "../../src/renderer/bridge-bootstrap";
import type { MysteryGameBridge } from "@shared/contracts";

function makeBridge(): MysteryGameBridge {
  return {
    getBootstrap: vi.fn(),
    submitIntent: vi.fn(),
  };
}

describe("renderer bridge bootstrap", () => {
  beforeEach(() => {
    delete window.mysteryGame;
  });

  it("keeps an Electron preload bridge and does not load the browser adapter", async () => {
    const preloadBridge = makeBridge();
    const loadBrowserBridge = vi.fn<() => Promise<MysteryGameBridge>>();
    loadBrowserBridge.mockRejectedValue(new Error("browser adapter should not load"));
    window.mysteryGame = preloadBridge;

    await expect(ensureMysteryGameBridge(loadBrowserBridge)).resolves.toBe(preloadBridge);
    expect(loadBrowserBridge).not.toHaveBeenCalled();
  });

  it("installs the browser adapter when no preload bridge is present", async () => {
    const browserBridge = makeBridge();
    const loadBrowserBridge = vi.fn<() => Promise<MysteryGameBridge>>();
    loadBrowserBridge.mockResolvedValue(browserBridge);

    await expect(ensureMysteryGameBridge(loadBrowserBridge)).resolves.toBe(browserBridge);
    expect(loadBrowserBridge).toHaveBeenCalledTimes(1);
    expect(window.mysteryGame).toBe(browserBridge);
  });
});
