import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SliceApplication } from '../../src/application/slice-application.js';
import { MemorySliceRepository } from '../../src/simulation/slice-browser-bridge.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';

describe('legacy receipt player copy is read-only', () => {
  it('shows the same natural copy as a normal load while preserving original receipt and fingerprint', () => {
    const captured = JSON.parse(readFileSync('tests/fixtures/catastrophe-v01710/promotion.json', 'utf8'));
    const after = migrateSliceState(captured.final), normal = projectSliceState(after);
    const envelope: SliceEnvelope = { intentId: 'legacy-player-copy', runId: after.runId, expectedRevision: captured.beforeLast.revision, payload: captured.lastIntent };
    const legacyView = structuredClone(normal);
    legacyView.catastrophe.title += '（G）';
    legacyView.catastrophe.abilities[0]!.label += '（G）';
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: envelope.expectedRevision, newRevision: after.revision,
      committedAt: '2026-10-14T00:00:00.000Z', replayed: false, state: legacyView };
    const stored = { fingerprint: stableStringify(envelope), receipt };
    const repository = new MemorySliceRepository();
    repository.transaction(() => { repository.put({ state: after, updatedAt: receipt.committedAt }); repository.selectRun(after.runId); repository.putReceipt(envelope.intentId, stored); });
    const app = new SliceApplication(repository, 'browser', () => 'not-used');
    const result = app.submitIntent(envelope); expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.error.message);
    expect(result.value.replayed).toBe(true); expect(result.value.state).toEqual(normal);
    expect(repository.receipt(envelope.intentId)).toEqual(stored); expect(repository.get(after.runId)!.state).toEqual(after);
    const loaded = app.loadRun(after.runId); expect(loaded.ok).toBe(true); if (loaded.ok) expect(result.value.state).toEqual(loaded.value);
    const again = app.submitIntent(envelope); expect(again).toEqual(result);
  });
});
