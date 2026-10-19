import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

import type { PublicGameState } from "../shared/contracts.js";
import { stableStringify } from "./canonical.js";

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

export type PublicGameStateWithoutChecksum = Omit<PublicGameState, "stateChecksum">;

export function computeStateChecksum(state: PublicGameStateWithoutChecksum): string {
  return sha256Hex(stableStringify(state));
}
