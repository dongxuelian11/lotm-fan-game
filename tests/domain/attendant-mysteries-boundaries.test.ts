import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const ROOT = 'tests/fixtures/attendant-mysteries-v01860';
const same = (a: unknown, b: unknown) => expect(Buffer.from(stableStringify(a)).equals(Buffer.from(stableStringify(b)))).toBe(true);
const entry = <T>(file: string, key: string) => readObjectEntry<T>(`${ROOT}/${file}`, key);
describe('Attendant actual public boundaries and continuous original command prefix', () => {
  it('keeps the original1038 commands, all1856 town/life commands and the actual optional continuation', () => {
    const original = readObjectEntry<SliceIntent[]>('tests/fixtures/miracle-worker-v01640/continuation.json', 'commands');
    const main = entry<SliceIntent[]>('natural.json', 'commands'), battle = entry<SliceIntent[]>('natural-battle.json', 'commands');
    expect(original).toHaveLength(1038); expect(main).toHaveLength(1856); expect(battle).toHaveLength(1868);
    same(main.slice(0, original.length), original); same(battle.slice(0, main.length), main);
    const raw = entry<Record<string, unknown>>('natural-battle.json', 'final'), rawBytes = stableStringify(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([183, 'attendant-mysteries-v183']);
    const s = migrateSliceState(raw), current = s as unknown as Record<string, unknown>; assertValidSliceState(s);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of Object.keys(raw)) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], raw[key]);
    }
    const defaults = createSliceRun(s.runId, readObjectEntry<Parameters<typeof createSliceRun>[1]>('tests/fixtures/miracle-worker-v01640/continuation.json','creation'), s.random.seed) as unknown as Record<string,unknown>;
    const added = Object.keys(defaults).filter(key => !Object.hasOwn(raw,key));
    expect(added).toContain('conqueror');
    expect(Object.keys(current).filter(key => !Object.hasOwn(raw,key)).sort()).toEqual([...added].sort());
    for(const key of added) same(current[key], defaults[key]);
    expect(stableStringify(raw)).toBe(rawBytes);
    expect(s).toMatchObject({ revision: 1869, week: 15971, status: 'ACTIVE', health: 90, mind: 95, spirituality: 106, cash: 25, actionsRemaining: 3, injuryRisk: 1, progression: { sequence: 1 }, random: { seed: 'seer-rebuild-first', cursor: 932 } });
    expect(s.attendantMysteries.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 3, exitMetres: 12, enemyHealth: 70 });
    same(s.miracleWorker.revival, entry<SliceState>('natural.json', 'final').miracleWorker.revival);
  }, 15_000);
  for (const start of [0, 11, 22, 33]) it(`replays eleven exact captured public boundaries from offset${start}`, () => {
    const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
    expect(Object.keys(index)).toHaveLength(44); expect(new Set(Object.values(index)).size).toBe(44);
    for (const [name, file] of Object.entries(index).slice(start, start + 11)) {
      expect(file).toMatch(/^boundary-[A-Za-z0-9_.-]+\.json$/);
      const before = migrateSliceState(entry<unknown>(file, 'beforeLast')), intent = entry<SliceIntent>(file, 'lastIntent'), final = migrateSliceState(entry<unknown>(file, 'final'));
      const immutable = stableStringify(before); assertValidSliceState(before); expect(validateSlicePayload(intent), name).toBe(true);
      if (intent.type === 'ATTENDANT_MYSTERIES') {
        const action = projectSliceState(before).attendantMysteries.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
        expect(action, name).toBeDefined(); expect(action!.enabled, action!.reason ?? name).toBe(true);
      }
      same(applySliceIntent(before, intent), final); expect(stableStringify(before), name).toBe(immutable);
      assertValidSliceState(final); same(projectSliceState(JSON.parse(stableStringify(final))), projectSliceState(final));
      expect(final.revision).toBe(before.revision + 1); expect(final.random.seed).toBe(before.random.seed);
    }
  }, start === 22 || start === 33 ? 60_000 : 30_000);
});
