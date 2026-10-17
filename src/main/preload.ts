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
    ipcRenderer.invoke("mystery-game:get-bootstrap") as Promise<
      BridgeResult<BootstrapProjection>
    >,
  submitIntent: (intent: IntentEnvelope) =>
    ipcRenderer.invoke("mystery-game:submit-intent", intent) as Promise<
      BridgeResult<CommitReceipt>
    >,
};

contextBridge.exposeInMainWorld("mysteryGame", bridge);

// Narrow public projection bridge. Internal world and random streams stay in Main.
import type { SliceBridge, SliceEnvelope } from "../shared/slice-contracts.js";
const sliceBridge: SliceBridge = {
  getBootstrap: () => ipcRenderer.invoke("slice:get-bootstrap"),
  loadRun: (runId: string) => ipcRenderer.invoke("slice:load-run", runId),
  submitIntent: (intent: SliceEnvelope) =>
    ipcRenderer.invoke("slice:submit-intent", intent),
};
contextBridge.exposeInMainWorld("sliceGame", sliceBridge);
