import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SliceApp } from "./SliceApp";
import type { SliceBridge } from "../shared/slice-contracts";

export async function ensureSliceBridge(
  loadBrowser: () => Promise<SliceBridge>,
): Promise<SliceBridge> {
  if (window.sliceGame) return window.sliceGame;
  // Electron preload failure must never silently switch canonical saving to memory.
  if (navigator.userAgent.includes("Electron/"))
    throw new Error(
      "桌面连接未能载入；为保护存档，本次不会进入内存试玩。请重启游戏。",
    );
  return (window.sliceGame = await loadBrowser());
}
export async function mountRenderer(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) throw new Error("Renderer root missing");
  try {
    await ensureSliceBridge(async () =>
      (
        await import("../simulation/slice-browser-bridge.js")
      ).createSliceBrowserBridge(),
    );
    createRoot(root).render(
      <StrictMode>
        <SliceApp />
      </StrictMode>,
    );
  } catch (error) {
    root.textContent =
      error instanceof Error ? error.message : "游戏无法启动，请重新打开。";
  }
}
if (typeof document !== "undefined" && document.getElementById("root"))
  void mountRenderer();
