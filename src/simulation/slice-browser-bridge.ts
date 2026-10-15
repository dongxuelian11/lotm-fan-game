import {
  SliceApplication,
  type SliceRepository,
  type StoredSlice,
  type StoredSliceReceipt,
} from "../application/slice-application.js";
import type { SliceBridge } from "../shared/slice-contracts.js";

export class MemorySliceRepository implements SliceRepository {
  private values = new Map<string, StoredSlice>();
  private receipts = new Map<string, StoredSliceReceipt>();
  private selected: string | null = null;
  transaction<T>(operation: () => T): T {
    const values = structuredClone(this.values),
      receipts = structuredClone(this.receipts),
      selected = this.selected;
    try {
      return operation();
    } catch (error) {
      this.values = values;
      this.receipts = receipts;
      this.selected = selected;
      throw error;
    }
  }
  list(): StoredSlice[] {
    return structuredClone([...this.values.values()].reverse());
  }
  get(id: string): StoredSlice | null {
    return structuredClone(this.values.get(id) ?? null);
  }
  put(value: StoredSlice): void {
    this.values.set(value.state.runId, structuredClone(value));
  }
  receipt(id: string): StoredSliceReceipt | null {
    return structuredClone(this.receipts.get(id) ?? null);
  }
  putReceipt(id: string, value: StoredSliceReceipt): void {
    this.receipts.set(id, structuredClone(value));
  }
  activeRun(): string | null {
    return this.selected;
  }
  selectRun(id: string): void {
    this.selected = id;
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
