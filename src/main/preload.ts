import { contextBridge, ipcRenderer } from "electron";

import type {
  BootstrapProjection,
  BridgeResult,
  CommitReceipt,
  IntentEnvelope,
  MysteryGameBridge,
} from "../shared/contracts.js";

const bridge: MysteryGameBridge = {
  getBootstrap: () =>
    ipcRenderer.invoke("mystery-game:get-bootstrap") as Promise<BridgeResult<BootstrapProjection>>,
  submitIntent: (intent: IntentEnvelope) =>
    ipcRenderer.invoke("mystery-game:submit-intent", intent) as Promise<BridgeResult<CommitReceipt>>,
};

contextBridge.exposeInMainWorld("mysteryGame", bridge);
