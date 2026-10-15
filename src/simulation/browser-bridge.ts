import {
  CONTRACT_VERSION,
  STORAGE_SCHEMA_VERSION,
  type BootstrapProjection,
  type BridgeResult,
  type CommitReceipt,
  type IntentEnvelope,
  type MysteryGameBridge as MysteryGameBridgeContract,
  type PublicGameState,
  type PublicRunSummary,
} from "../shared/contracts.js";
import { stableStringify } from "../domain/canonical.js";
import {
  BROWSER_ALPHA_CANDIDATE,
  createR2CharacterRunState,
} from "../domain/fixture.js";
import {
  applyBrowserAlphaAction,
  BlockingEventUnavailableError,
  EventResolutionUnavailableError,
  resolveEventChoice,
} from "../domain/action-resolution.js";
import { makePublicError } from "../domain/public-error.js";
import { R2_FIXTURE_CATALOGUE } from "../content/r2-catalogue.js";
import { validateR2Intent, type ValidatedR2Intent } from "../content/r2-validation.js";
import { DeterministicActionRandomStream } from "../resolution/deterministic-random.js";

type StoredReceipt = {
  readonly fingerprint: string;
  readonly receipt: CommitReceipt;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createIdentity(): string {
  const cryptoApi = (globalThis as typeof globalThis & {
    crypto?: {
      randomUUID?: () => string;
      getRandomValues?: (array: Uint8Array) => Uint8Array;
    };
  }).crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error("Secure identity source unavailable");
}

function nowIso(): string {
  return new Date().toISOString();
}

function publicRunSummary(state: PublicGameState, updatedAt: string): PublicRunSummary {
  return {
    runId: state.runId,
    lifecycle: state.lifecycle,
    displayName: state.character.displayName,
    week: state.week,
    currentDate: { ...state.currentDate },
    revision: state.revision,
    updatedAt,
  };
}

/**
 * Development-only Browser Alpha bridge. Its lifetime is the page lifetime:
 * refresh or a new instance starts with no run and no durable storage.
 */
export class MysteryGameBridge implements MysteryGameBridgeContract {
  private state: PublicGameState | null = null;
  private updatedAt: string | null = null;
  private readonly receipts = new Map<string, StoredReceipt>();
  #randomCursor = 0;

  public constructor(private readonly appVersion = "browser-alpha") {}

  public reset(): void {
    this.state = null;
    this.updatedAt = null;
    this.receipts.clear();
    this.#randomCursor = 0;
  }

  public async getBootstrap(): Promise<BridgeResult<BootstrapProjection>> {
    const runs = this.state !== null && this.updatedAt !== null
      ? [publicRunSummary(this.state, this.updatedAt)]
      : [];

    return {
      ok: true,
      value: {
        appVersion: this.appVersion,
        contractVersion: CONTRACT_VERSION,
        storageSchemaVersion: STORAGE_SCHEMA_VERSION,
        storageStatus: "READY",
        lifecycle: this.state?.lifecycle ?? "NO_RUN",
        runs,
        activeState: this.state === null ? null : clone(this.state),
        characterCreation: clone(R2_FIXTURE_CATALOGUE),
      },
    };
  }

  public async submitIntent(input: unknown): Promise<BridgeResult<CommitReceipt>> {
    const validated = validateR2Intent(input, R2_FIXTURE_CATALOGUE);
    if (!validated.ok) {
      return validated;
    }

    const fingerprint = this.fingerprint(input);
    const existing = this.receipts.get(validated.value.intentId);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        return { ok: false, error: makePublicError("DUPLICATE_INTENT_CONFLICT") };
      }

      return {
        ok: true,
        value: {
          ...clone(existing.receipt),
          replayed: true,
        },
      };
    }

    let result: BridgeResult<CommitReceipt>;
    try {
      result = this.commit(validated.value);
    } catch {
      return { ok: false, error: makePublicError("INTERNAL_ERROR") };
    }
    if (!result.ok) {
      return result;
    }

    this.receipts.set(validated.value.intentId, {
      fingerprint,
      receipt: clone(result.value),
    });
    return result;
  }

  private fingerprint(input: unknown): string {
    try {
      return stableStringify(input);
    } catch {
      // Validation has already rejected non-plain input. Keep this boundary
      // public and deterministic if a future validator changes that order.
      return "invalid-envelope";
    }
  }

  private commit(intent: ValidatedR2Intent): BridgeResult<CommitReceipt> {
    if (intent.payload.kind === "CREATE_CHARACTER_RUN") {
      if (this.state !== null) {
        return { ok: false, error: makePublicError("REVISION_CONFLICT", this.state.revision) };
      }
      if (intent.expectedRevision !== 0) {
        return { ok: false, error: makePublicError("REVISION_CONFLICT", 0) };
      }

      const runId = createIdentity();
      const nextState = createR2CharacterRunState(
        runId,
        intent.payload.selection,
        R2_FIXTURE_CATALOGUE,
        BROWSER_ALPHA_CANDIDATE,
      );
      return this.storeState(intent, nextState, 0);
    }

    if (this.state === null) {
      return { ok: false, error: makePublicError("RUN_NOT_FOUND") };
    }
    if (intent.runId !== this.state.runId) {
      return { ok: false, error: makePublicError("RUN_NOT_FOUND") };
    }
    if (intent.expectedRevision !== this.state.revision) {
      return { ok: false, error: makePublicError("REVISION_CONFLICT", this.state.revision) };
    }
    try {
      const random = new DeterministicActionRandomStream(this.appVersion, this.#randomCursor);
      if (intent.payload.kind === "RESOLVE_EVENT_CHOICE") {
        const nextState = resolveEventChoice(
          this.state,
          intent.payload.eventInstanceId,
          intent.payload.choiceId,
          { random },
        );
        const result = this.storeState(intent, nextState, this.state.revision);
        if (result.ok) this.#randomCursor = random.cursor;
        return result;
      }
      if (intent.payload.kind !== "PERFORM_WEEKLY_ACTION") {
        return { ok: false, error: makePublicError("SCHEMA_INVALID") };
      }
      if (this.state.availableActions < 1) {
        return { ok: false, error: makePublicError("ACTION_UNAVAILABLE", this.state.revision) };
      }
      const nextState = applyBrowserAlphaAction(this.state, intent.payload.action, { random });
      const result = this.storeState(intent, nextState, this.state.revision);
      if (result.ok) this.#randomCursor = random.cursor;
      return result;
    } catch (error) {
      if (error instanceof BlockingEventUnavailableError || error instanceof EventResolutionUnavailableError) {
        return { ok: false, error: makePublicError("ACTION_UNAVAILABLE", this.state.revision) };
      }
      return { ok: false, error: makePublicError("INTERNAL_ERROR") };
    }
  }

  private storeState(
    intent: ValidatedR2Intent,
    nextState: PublicGameState,
    previousRevision: number,
  ): BridgeResult<CommitReceipt> {
    const committedAt = nowIso();
    this.state = clone(nextState);
    this.updatedAt = committedAt;
    const receipt: CommitReceipt = {
      intentId: intent.intentId,
      runId: nextState.runId,
      previousRevision,
      newRevision: nextState.revision,
      stateChecksum: nextState.stateChecksum,
      committedAt,
      replayed: false,
      publicState: clone(nextState),
    };
    return { ok: true, value: clone(receipt) };
  }
}

export function createBrowserMysteryGameBridge(appVersion = "browser-alpha"): MysteryGameBridge {
  return new MysteryGameBridge(appVersion);
}
