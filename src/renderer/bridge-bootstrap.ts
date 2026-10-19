import type { MysteryGameBridge } from "@shared/contracts";

export type BrowserBridgeLoader = () => Promise<MysteryGameBridge>;

export async function ensureMysteryGameBridge(
  loadBrowserBridge: BrowserBridgeLoader,
): Promise<MysteryGameBridge | undefined> {
  if (typeof window === "undefined") {
    return undefined;
  }

  const preloadBridge = window.mysteryGame;
  if (preloadBridge !== undefined) {
    return preloadBridge;
  }

  const browserBridge = await loadBrowserBridge();
  return window.mysteryGame ?? (window.mysteryGame = browserBridge);
}
