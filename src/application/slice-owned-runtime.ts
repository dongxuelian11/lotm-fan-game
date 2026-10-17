import {
  openFoolRuntimeSession,
  type FoolRuntimeDraft,
  type FoolRuntimeSession,
} from "../domain/fool/owned-session.js";
import type { SliceIntent, SliceProjection, SliceState } from "../domain/slice/types.js";
import { projectSliceState } from "../domain/slice/index.js";
import type { StoredSlice } from "./slice-application.js";

export function assertSliceSaveTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw Error("Invalid save timestamp");
}

export interface FoolRepositoryHead {
  readonly runId: string;
  readonly revision: number;
  readonly status: SliceState["status"];
}
/** Metadata is public; authority is runtime membership in one repository's private map. */
export interface FoolRepositoryDraft extends FoolRepositoryHead {
  readonly __repositoryDraft: unique symbol;
}
interface Head {
  readonly raw: string;
  readonly session: FoolRuntimeSession;
}
interface Draft {
  readonly epoch: object;
  readonly head: Head;
  readonly domain: FoolRuntimeDraft;
  readonly runId: string;
}
interface Transaction {
  readonly epoch: object;
  readonly heads: Map<string, Head>;
  readonly drafts: Set<Draft>;
  readonly writes: Map<string, { raw: string; draft: Draft | null }>;
}

/** Kept in a repository #private field. Never hands a domain session or state out. */
export class SliceOwnedRuntime {
  #heads = new Map<string, Head>();
  #drafts = new WeakMap<object, Draft>();
  #transaction: Transaction | null = null;

  begin(): void {
    if (this.#transaction) throw Error("Nested runtime transaction");
    this.#transaction = {
      epoch: {}, heads: new Map(this.#heads), drafts: new Set(), writes: new Map(),
    };
  }

  #read(runId: string, raw: string | null, decode: (raw: string) => StoredSlice): Head | null {
    const heads = this.#transaction?.heads ?? this.#heads;
    // Never turn a transaction-local raw write into a committed authority.
    if (this.#transaction?.writes.has(runId)) return this.#heads.get(runId) ?? null;
    if (raw === null) { heads.delete(runId); this.#heads.delete(runId); return null; }
    const existing = heads.get(runId);
    if (existing?.raw === raw) return existing;
    // An external replacement revokes authority even when hydration fails and
    // this transaction rolls back. Restoring old bytes must strictly reopen.
    if (this.#heads.get(runId)?.raw !== raw) this.#heads.delete(runId);
    heads.delete(runId);
    const stored = decode(raw);
    if (stored.state.runId !== runId) throw Error("Snapshot identity mismatch");
    if (!stored.state.fool.guidanceKnown || stored.state.fool.source === null) return null;
    const head = { raw, session: openFoolRuntimeSession(stored.state) };
    heads.set(runId, head);
    return head;
  }

  inspect(runId: string, raw: string | null, decode: (raw: string) => StoredSlice): FoolRepositoryHead | null {
    return this.#read(runId, raw, decode)?.session.inspect() ?? null;
  }

  project(runId: string, raw: string | null, decode: (raw: string) => StoredSlice): SliceProjection | null {
    return this.#read(runId, raw, decode)?.session.project() ?? null;
  }

  /** Explicit load always opens from these exact persisted bytes. Envelope parsing
   * confers no authority: the domain factory validates the complete current Fool
   * state, while every other snapshot uses the original strict migration path. */
  load(runId: string, raw: string | null, readEnvelope: (raw: string) => StoredSlice,
    hydrateState: (input: unknown) => SliceState, sealed: boolean): { state: SliceProjection; updatedAt: string } | null {
    const transaction = this.#transaction;
    if (!transaction || transaction.writes.has(runId)) throw Error("Load requires an unwritten repository transaction");
    if (raw === null || this.#heads.get(runId)?.raw !== raw) this.#heads.delete(runId);
    transaction.heads.delete(runId);
    if (raw === null) return null;
    const stored = readEnvelope(raw), input = stored.state;
    const assertIdentity = (identity: FoolRepositoryHead): void => {
      if (identity.runId !== runId) throw Error("Snapshot identity mismatch");
      if (sealed && identity.status !== "DEAD") throw Error("Sealed run cannot be reopened alive");
    };
    if (input?.schemaVersion === 205 && input.contentVersion === "fool-v205" &&
      input.fool?.guidanceKnown === true && input.fool.source !== null) {
      const session = openFoolRuntimeSession(input);
      assertIdentity(session.inspect());
      const projection = session.project();
      // Failed validation, sealed checks or projection never retain a partial head.
      transaction.heads.set(runId, { raw, session });
      return { state: projection, updatedAt: stored.updatedAt };
    }
    const state = hydrateState(input);
    assertIdentity(state);
    return { state: projectSliceState(state), updatedAt: stored.updatedAt };
  }

  prepare(runId: string, raw: string | null, decode: (raw: string) => StoredSlice, intent: SliceIntent, expectedRevision: number): FoolRepositoryDraft {
    const transaction = this.#transaction;
    if (!transaction) throw Error("Prepare outside transaction");
    if (transaction.writes.has(runId)) throw Error("Run already written in this transaction");
    const head = this.#read(runId, raw, decode);
    if (!head) throw Error("No current Fool session");
    const domain = head.session.prepare(intent, expectedRevision);
    const draft: Draft = { epoch: transaction.epoch, head, domain, runId };
    const handle = Object.freeze({ ...head.session.inspectDraft(domain) }) as FoolRepositoryDraft;
    this.#drafts.set(handle, draft);
    transaction.drafts.add(draft);
    return handle;
  }

  #require(handle: FoolRepositoryDraft): Draft {
    const draft = this.#drafts.get(handle), transaction = this.#transaction;
    if (!draft || !transaction || draft.epoch !== transaction.epoch ||
      transaction.heads.get(draft.runId) !== draft.head || transaction.writes.has(draft.runId))
      throw Error("Foreign, stale or already persisted runtime draft");
    return draft;
  }

  projectDraft(handle: FoolRepositoryDraft): SliceProjection {
    const draft = this.#require(handle);
    return draft.head.session.projectDraft(draft.domain);
  }

  snapshotDraft(handle: FoolRepositoryDraft, raw: string | null): SliceState {
    const draft = this.#require(handle);
    if (raw !== draft.head.raw) {
      this.#transaction!.heads.delete(draft.runId);
      throw Error("Persisted snapshot changed during runtime transaction");
    }
    return draft.head.session.snapshotDraft(draft.domain);
  }

  stageDraft(handle: FoolRepositoryDraft, raw: string): void {
    const draft = this.#require(handle);
    this.#transaction!.writes.set(draft.runId, { raw, draft });
  }

  stageRaw(runId: string, raw: string): void {
    if (!this.#transaction) throw Error("Write outside transaction");
    this.#transaction.writes.set(runId, { raw, draft: null });
  }

  /** Call only after the backend's durable COMMIT, never inside its operation callback. */
  committed(): void {
    const transaction = this.#transaction;
    if (!transaction) return;
    for (const [runId, write] of transaction.writes) {
      transaction.heads.delete(runId);
      if (write.draft) {
        try {
          write.draft.head.session.commit(write.draft.domain);
          transaction.heads.set(runId, { raw: write.raw, session: write.draft.head.session });
        } catch {
          // Persistence already succeeded. Re-enter strict hydration rather than
          // misreport a rollback if a programming error prevents publication.
        }
      }
    }
    this.#heads = transaction.heads;
    this.#transaction = null;
    this.#drafts = new WeakMap();
  }

  rolledBack(): void {
    const transaction = this.#transaction;
    this.#transaction = null;
    this.#drafts = new WeakMap();
    if (transaction) for (const draft of transaction.drafts) {
      try { draft.head.session.discard(draft.domain); } catch { /* already discarded */ }
    }
  }

  invalidate(): void {
    this.rolledBack();
    this.#heads.clear();
  }
}
