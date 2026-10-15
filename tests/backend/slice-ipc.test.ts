import { describe, expect, it } from "vitest";
import { registerSliceIpc, SLICE_IPC } from "../../src/main/slice-ipc.js";
import type { IpcEventLike } from "../../src/main/ipc.js";
describe("slice IPC security", () => {
  it("rejects foreign windows/subframes and reports unavailable canonical saving without memory fallback", async () => {
    const handlers = new Map<
      string,
      (event: IpcEventLike, ...args: unknown[]) => Promise<unknown>
    >();
    const frame = {},
      webContents = { mainFrame: frame };
    const dispose = registerSliceIpc({
      ipcMain: {
        handle: (k, fn) => {
          handlers.set(k, fn);
        },
        removeHandler: (k) => {
          handlers.delete(k);
        },
      },
      getWindow: () => ({ webContents }),
      getStore: () => null,
    });
    expect(
      await handlers.get(SLICE_IPC.bootstrap)!({
        sender: {},
        senderFrame: frame,
      }),
    ).toMatchObject({ ok: false, error: { code: "SENDER_REJECTED" } });
    expect(
      await handlers.get(SLICE_IPC.submit)!(
        { sender: webContents, senderFrame: {} },
        {},
      ),
    ).toMatchObject({ ok: false, error: { code: "SENDER_REJECTED" } });
    expect(
      await handlers.get(SLICE_IPC.bootstrap)!({
        sender: webContents,
        senderFrame: frame,
      }),
    ).toMatchObject({ ok: false, error: { code: "SAVE_UNAVAILABLE" } });
    dispose();
    expect(handlers.size).toBe(0);
  });
});
