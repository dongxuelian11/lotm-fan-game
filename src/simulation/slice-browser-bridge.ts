import {
  SliceApplication,
  SlicePersistenceError,
  summarizeSlice,
  type SliceRepository,
  type RepositorySliceBootstrap,
  type StoredSlice,
  type StoredSliceReceipt,
} from "../application/slice-application.js";
import { SliceOwnedRuntime, assertSliceSaveTimestamp, type FoolRepositoryDraft, type FoolRepositoryHead, type OwnedRepositoryDraft, type OwnedRepositoryHead } from "../application/slice-owned-runtime.js";
import { assertValidSliceState } from "../domain/slice/index.js";
import { migrateSliceState } from "../domain/slice/migration.js";
import { stableStringify } from "../domain/canonical.js";
import type { SliceIntent, SliceProjection, SliceState } from "../domain/slice/types.js";
import type { SliceBridge } from "../shared/slice-contracts.js";

function readEnvelope(raw: string): StoredSlice {
  const value = JSON.parse(raw) as StoredSlice;
  assertSliceSaveTimestamp(value.updatedAt);
  return value;
}
function hydrateState(input: unknown): SliceState {
  // A genuine original Fool save may cross the 205/206/207 -> 208 strict migration.
  // Other browser inputs retain their original current-format-only gate.
  if (input && typeof input === "object" && "schemaVersion" in input && (input.schemaVersion === 205 || input.schemaVersion === 206 || input.schemaVersion === 207))
    return migrateSliceState(input);
  assertValidSliceState(input);
  return input;
}
function decode(raw: string): StoredSlice {
  const value = readEnvelope(raw);
  value.state = hydrateState(value.state);
  return value;
}
export class MemorySliceRepository implements SliceRepository {
  #values = new Map<string, string>();
  #receipts = new Map<string, StoredSliceReceipt>();
  #selected: string | null = null;
  #inTransaction = false;
  #runtime = new SliceOwnedRuntime();
  transaction<T>(operation: () => T): T {
    if (this.#inTransaction) throw new SlicePersistenceError("Nested transactions are not supported");
    const values = new Map(this.#values),
      receipts = structuredClone(this.#receipts),
      selected = this.#selected;
    this.#inTransaction = true;
    this.#runtime.begin();
    try {
      const result = operation();
      this.#runtime.committed();
      return result;
    } catch (error) {
      this.#values = values;
      this.#receipts = receipts;
      this.#selected = selected;
      this.#runtime.rolledBack();
      throw error;
    } finally {
      this.#inTransaction = false;
    }
  }
  bootstrapView(): RepositorySliceBootstrap {
    return this.transaction(() => {
      // Preserve this repository's existing reverse insertion ordering.
      const rows = [...this.#values.entries()].reverse();
      const current = rows.find(([runId]) => runId === this.#selected) ?? rows[0];
      let activeState: SliceProjection | null = null;
      const runs = rows.map(row => {
        const [runId, raw] = row;
        if (row === current) {
          const loaded = this.#runtime.load(runId, raw, readEnvelope, hydrateState, false);
          if (!loaded) throw new SlicePersistenceError("Missing selected snapshot");
          activeState = loaded.state;
          return summarizeSlice(loaded);
        }
        const stored = decode(raw);
        if (stored.state.runId !== runId) throw new SlicePersistenceError("Snapshot identity mismatch");
        return summarizeSlice(stored);
      });
      return { runs, activeState };
    });
  }
  list(): StoredSlice[] {
    return [...this.#values.values()].reverse().map(decode);
  }
  get(id: string): StoredSlice | null {
    const raw = this.#values.get(id);
    return raw === undefined ? null : decode(raw);
  }
  put(value: StoredSlice): void {
    if (!this.#inTransaction) throw new SlicePersistenceError("Write outside transaction");
    const detached = structuredClone(value);
    assertSliceSaveTimestamp(detached.updatedAt);
    assertValidSliceState(detached.state);
    const raw = stableStringify(detached);
    this.#values.set(detached.state.runId, raw);
    this.#runtime.stageRaw(detached.state.runId, raw);
  }
  foolHead(runId: string): FoolRepositoryHead | null {
    return this.ownedHead(runId);
  }
  ownedHead(runId: string): OwnedRepositoryHead | null {
    return this.#runtime.inspect(runId, this.#values.get(runId) ?? null, decode);
  }
  projectFoolRun(runId: string): SliceProjection | null {
    return this.#runtime.project(runId, this.#values.get(runId) ?? null, decode);
  }
  loadRunProjection(runId: string): SliceProjection | null {
    if (!this.#inTransaction) throw new SlicePersistenceError("Load outside transaction");
    return this.#runtime.load(runId, this.#values.get(runId) ?? null, readEnvelope, hydrateState, false)?.state ?? null;
  }
  prepareFool(runId: string, intent: SliceIntent, expectedRevision: number): FoolRepositoryDraft {
    return this.prepareOwned(runId, intent, expectedRevision);
  }
  prepareOwned(runId: string, intent: SliceIntent, expectedRevision: number): OwnedRepositoryDraft {
    return this.#runtime.prepare(runId, this.#values.get(runId) ?? null, decode, intent, expectedRevision);
  }
  projectFoolDraft(draft: FoolRepositoryDraft): SliceProjection {
    return this.projectOwnedDraft(draft);
  }
  projectOwnedDraft(draft: OwnedRepositoryDraft): SliceProjection {
    return this.#runtime.projectDraft(draft);
  }
  putFoolDraft(draft: FoolRepositoryDraft, updatedAt: string): void {
    this.putOwnedDraft(draft, updatedAt);
  }
  putOwnedDraft(draft: OwnedRepositoryDraft, updatedAt: string): void {
    if (!this.#inTransaction) throw new SlicePersistenceError("Write outside transaction");
    assertSliceSaveTimestamp(updatedAt);
    const state = this.#runtime.snapshotDraft(draft, this.#values.get(draft.runId) ?? null);
    const raw = stableStringify({ state, updatedAt });
    this.#values.set(state.runId, raw);
    this.#runtime.stageDraft(draft, raw);
  }
  receipt(id: string): StoredSliceReceipt | null {
    return structuredClone(this.#receipts.get(id) ?? null);
  }
  putReceipt(id: string, value: StoredSliceReceipt): void {
    if (!this.#inTransaction) throw new SlicePersistenceError("Write outside transaction");
    if (this.#receipts.has(id)) throw new SlicePersistenceError("Duplicate receipt");
    this.#receipts.set(id, structuredClone(value));
  }
  activeRun(): string | null {
    return this.#selected;
  }
  selectRun(id: string): void {
    this.#selected = id;
  }
}
export function createSliceBrowserBridge(): SliceBridge {
  const app = new SliceApplication(new MemorySliceRepository(), "browser", () =>
    globalThis.crypto.randomUUID(),
  );
  return {
    getBootstrap: async () => app.getBootstrap(),
    loadRun: async (id) => app.loadRun(id),
    submitIntent: async (intent) => app.submitIntent(intent),
  };
}
