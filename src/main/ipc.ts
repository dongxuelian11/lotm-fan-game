import type {
  BootstrapProjection,
  BridgeResult,
  CommitReceipt,
} from "../shared/contracts.js";
import { makePublicError } from "../domain/public-error.js";
import { validateR1Intent } from "../content/r1-validation.js";
import { unavailableBootstrap, type SqliteGameStore } from "../persistence/sqlite-store.js";

export const IPC_CHANNELS = {
  GET_BOOTSTRAP: "mystery-game:get-bootstrap",
  SUBMIT_INTENT: "mystery-game:submit-intent",
} as const;

export interface IpcEventLike {
  readonly sender: unknown;
  readonly senderFrame?: unknown;
}

export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: IpcEventLike, ...args: unknown[]) => Promise<unknown>,
  ): void;
  removeHandler(channel: string): void;
}

export interface MainWindowLike {
  readonly webContents: {
    readonly mainFrame: unknown;
  };
}

export interface IpcHandlerDependencies {
  readonly ipcMain: IpcMainLike;
  readonly getWindow: () => MainWindowLike | null;
  readonly getStore: () => SqliteGameStore | null;
  readonly appVersion: string;
}

export function isTrustedIpcSender(
  event: IpcEventLike,
  expectedSender: unknown,
  expectedMainFrame: unknown,
): boolean {
  return event.sender === expectedSender && event.senderFrame === expectedMainFrame;
}

function senderRejected(): BridgeResult<never> {
  return { ok: false, error: makePublicError("SENDER_REJECTED") };
}

function canAcceptFromMainWindow(
  event: IpcEventLike,
  getWindow: () => MainWindowLike | null,
): boolean {
  try {
    const window = getWindow();
    return (
      window !== null &&
      isTrustedIpcSender(event, window.webContents, window.webContents.mainFrame)
    );
  } catch {
    return false;
  }
}

export function registerIpcHandlers(dependencies: IpcHandlerDependencies): () => void {
  const getBootstrap = async (
    event: IpcEventLike,
  ): Promise<BridgeResult<BootstrapProjection>> => {
    if (!canAcceptFromMainWindow(event, dependencies.getWindow)) {
      return senderRejected();
    }

    try {
      const store = dependencies.getStore();
      return {
        ok: true,
        value: store === null
          ? unavailableBootstrap(dependencies.appVersion)
          : store.getBootstrap(),
      };
    } catch {
      return { ok: true, value: unavailableBootstrap(dependencies.appVersion) };
    }
  };

  const submitIntent = async (
    event: IpcEventLike,
    input: unknown,
  ): Promise<BridgeResult<CommitReceipt>> => {
    if (!canAcceptFromMainWindow(event, dependencies.getWindow)) {
      return senderRejected();
    }

    try {
      const store = dependencies.getStore();
      return store === null
        ? { ok: false, error: makePublicError("PERSISTENCE_UNAVAILABLE") }
        : submitValidatedInput(store, input);
    } catch {
      return { ok: false, error: makePublicError("PERSISTENCE_UNAVAILABLE") };
    }
  };

  dependencies.ipcMain.handle(IPC_CHANNELS.GET_BOOTSTRAP, getBootstrap);
  dependencies.ipcMain.handle(IPC_CHANNELS.SUBMIT_INTENT, submitIntent);

  return () => {
    dependencies.ipcMain.removeHandler(IPC_CHANNELS.GET_BOOTSTRAP);
    dependencies.ipcMain.removeHandler(IPC_CHANNELS.SUBMIT_INTENT);
  };
}

function submitValidatedInput(
  store: SqliteGameStore,
  input: unknown,
): BridgeResult<CommitReceipt> {
  const validation = validateR1Intent(input);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  return store.submitIntent(validation.value);
}
