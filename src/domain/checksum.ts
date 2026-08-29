import { createHash } from "node:crypto";

import type { PublicGameState } from "../shared/contracts.js";
import { stableStringify } from "./canonical.js";

export type PublicGameStateWithoutChecksum = Omit<PublicGameState, "stateChecksum">;

export function computeStateChecksum(state: PublicGameStateWithoutChecksum): string {
  return createHash("sha256").update(stableStringify(state), "utf8").digest("hex");
}
