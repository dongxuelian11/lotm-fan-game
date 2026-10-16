import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { SliceResult } from '../../src/shared/slice-contracts.js';
const unwrap = <T>(result: SliceResult<T>): T => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('source package playable release smoke', () => {
  it('creates a valid ordinary character with all latest pathways available to project', () => {
    const state = createSliceRun('release-smoke', sliceDefaultCreationSelection, 'release-smoke-seed');
    assertValidSliceState(state);
    expect(state.progression.sequence).toBeNull();
    expect(projectSliceState(state).harvestpriest).toBeDefined();
    expect(projectSliceState(state).biologist).toBeDefined();
    expect(migrateSliceState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
  it.each(['seer-v030', 'physician-v0700', 'harvestpriest-v0710'])('loads shipped %s save and retains existing play results', (folder) => {
    const old = JSON.parse(readFileSync(new URL(`../fixtures/${folder}/natural.json`, import.meta.url), 'utf8')).final;
    const current = migrateSliceState(old);
    assertValidSliceState(current);
    for (const key of ['runId', 'week', 'health', 'mind', 'cash', 'random', 'progression', 'combatHistory'] as const)
      expect(current[key], key).toEqual(old[key]);
    expect(migrateSliceState(JSON.parse(JSON.stringify(current)))).toEqual(current);
    expect(projectSliceState(current).runId).toBe(old.runId);
  });
  it('persists a new game, rolls back a failed choice, reopens and retries the same action once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lotm-release-smoke-'));
    const file = join(dir, 'play.sqlite');
    let fail = false;
    let store = new SqliteSliceStore(file, { beforeWrite: () => { if (fail) throw new Error('simulated write failure'); } });
    try {
      const created = unwrap(store.submitIntent({ intentId: 'create', runId: null, expectedRevision: 0,
        payload: { type: 'CREATE', selection: sliceDefaultCreationSelection } }));
      const before = structuredClone(store.repository.get(created.runId)!.state);
      const event = created.state.activeEvent!;
      const command = { intentId: 'opening-choice', runId: created.runId, expectedRevision: created.newRevision,
        payload: { type: 'EVENT_CHOICE' as const, eventInstanceId: event.instanceId,
          choiceId: event.choices.find(c => c.enabled)!.id } };
      fail = true;
      expect(store.submitIntent(command)).toMatchObject({ ok: false, error: { code: 'SAVE_FAILED' } });
      expect(store.repository.get(created.runId)!.state).toEqual(before);
      store.close(); store = new SqliteSliceStore(file);
      expect(store.repository.get(created.runId)!.state).toEqual(before);
      const accepted = unwrap(store.submitIntent(command));
      const after = structuredClone(store.repository.get(created.runId)!.state);
      store.close(); store = new SqliteSliceStore(file);
      expect(unwrap(store.getBootstrap()).activeState).toEqual(accepted.state);
      expect(unwrap(store.submitIntent(command)).replayed).toBe(true);
      expect(store.repository.get(created.runId)!.state).toEqual(after);
    } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
  }, 10_000);
});
