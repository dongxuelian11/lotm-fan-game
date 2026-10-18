import {
  isTrustedIpcSender,
  type IpcEventLike,
  type IpcMainLike,
  type MainWindowLike,
} from "./ipc.js";
import { failure } from "../application/slice-application.js";
import type { SqliteSliceStore } from "../persistence/slice-store.js";
export const SLICE_IPC = {
  bootstrap: "slice:get-bootstrap",
  load: "slice:load-run",
  submit: "slice:submit-intent",
} as const;
export function registerSliceIpc(deps: {
  ipcMain: IpcMainLike;
  getWindow: () => MainWindowLike | null;
  getStore: () => SqliteSliceStore | null;
  getStorageError?: () => string;
}): () => void {
  const guard = (event: IpcEventLike): boolean => {
    const window = deps.getWindow();
    return (
      window !== null &&
      isTrustedIpcSender(
        event,
        window.webContents,
        window.webContents.mainFrame,
      )
    );
  };
  const handle =
    (fn: (store: SqliteSliceStore, input: unknown) => unknown) =>
    async (event: IpcEventLike, input?: unknown): Promise<unknown> => {
      if (!guard(event))
        return failure("SENDER_REJECTED", "无法接受这个窗口的请求。");
      const store = deps.getStore();
      if (!store)
        return failure(
          "SAVE_UNAVAILABLE",
          deps.getStorageError?.() || "桌面存档无法打开，原文件已保留。",
          true,
        );
      try {
        return fn(store, input);
      } catch {
        return failure(
          "SAVE_UNAVAILABLE",
          "存档暂时无法访问。原进度已保留。",
          true,
        );
      }
    };
  deps.ipcMain.handle(
    SLICE_IPC.bootstrap,
    handle((store) => store.getBootstrap()),
  );
  deps.ipcMain.handle(
    SLICE_IPC.load,
    handle((store, input) => store.loadRun(input)),
  );
  deps.ipcMain.handle(
    SLICE_IPC.submit,
    handle((store, input) => store.submitIntent(input)),
  );
  return () => {
    for (const channel of Object.values(SLICE_IPC))
      deps.ipcMain.removeHandler(channel);
  };
}
