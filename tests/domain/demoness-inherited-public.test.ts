/** Retained actual688 and historical854 public evidence only; no historical replay or new save. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectCalamityDemonessLife, projectCalamityDemonessHistory } from '../../src/domain/calamity-demoness/life.js';
import { projectCalamityDemonessEncounter } from '../../src/domain/calamity-demoness/encounter.js';
import { projectCalamityDemonessCombat, projectCalamityDemonessRoundOutcome } from '../../src/domain/calamity-demoness/combat.js';
import { projectApocalypseDemonessLife, projectApocalypseDemonessLifeReceipt } from '../../src/domain/apocalypse-demoness/life.js';
import { projectApocalypseDemonessEncounter } from '../../src/domain/apocalypse-demoness/encounter.js';
import { projectApocalypseDemonessCombat, projectApocalypseDemonessRoundOutcome } from '../../src/domain/apocalypse-demoness/combat.js';
import { projectDespairCombat, projectDespairRoundOutcome } from '../../src/domain/despair/combat.js';
import { projectUnagingDemonessCombat, projectUnagingDemonessRoundOutcome } from '../../src/domain/unaging-demoness/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ACTUAL = 'tests/fixtures/apocalypse-demoness-v01990/boundary-step-688-action.json';
const LEGACY = 'tests/fixtures/apocalypse-demoness-v01990/natural.json';
const ACTUAL_SHA = '34e43b3cb872a7c43851e5d3d583983e06b2081d8645bc42cd10b6d243a5bb67';
const LEGACY_SHA = 'baf997edd399bee66132fc7278a741968063dee012e960c9e2fc80ae1f1f4339';
const hashFile = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const raw = readObjectEntry<SliceState>(ACTUAL, 'final'), legacy = readObjectEntry<SliceState>(LEGACY, 'final');
const keys = ['despairOutcome', 'unagingDemonessOutcome', 'calamityDemonessOutcome', 'apocalypseDemonessOutcome'] as const;
const replayKeys = ['randomSeed', 'randomCursor', 'randomBefore', 'randomAfter', 'randomCursorBefore', 'randomCursorAfter'];
function host(input = raw): SliceState {
  // Supply only absent newer module defaults for projection, never migrate, validate, or replay the old history.
  return { ...createSliceRun('demoness-public-host', sliceDefaultCreationSelection, 'demoness-public-host'), ...structuredClone(input) };
}
/** Scoped expected facts: these roots' object-valued source is replay provenance.
 * String modifier/debt labels and physical pendingSource/sourceId facts remain. */
function facts<T>(v: T): T {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(facts) as T;
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => !replayKeys.includes(k) && !(k === 'source' && typeof x !== 'string')).map(([k, x]) => [k, facts(x)])) as T;
}
function inject(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach(inject); return; }
  Object.values(v).forEach(inject);
  Object.assign(v, { privateProbe: { randomSeed: 'never-public', randomCursor: 9001 } });
}
function publicOnly(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  for (const [key, child] of Object.entries(v)) {
    expect([...replayKeys, 'privateProbe'].includes(key), key).toBe(false);
    if (key === 'source') expect(typeof child, 'public source labels remain strings').toBe('string');
    publicOnly(child);
  }
}
function objects(v: unknown, out = new Set<object>()): Set<object> {
  if (!v || typeof v !== 'object' || out.has(v)) return out;
  out.add(v); Object.values(v).forEach(x => objects(x, out)); return out;
}
function detached(view: unknown, state: unknown): void {
  const privateObjects = objects(state);
  for (const o of objects(view)) expect(privateObjects.has(o)).toBe(false);
}
const withoutActions = <T extends { actions: unknown }>(v: T) => {
  const { actions: _actions, ...result } = v;
  // The preferred control can change when the intentionally injected history fails strict validation.
  return Object.fromEntries(Object.entries(result).filter(([k]) => k !== 'preferredActionId'));
};
function projectOutcomes(round: SliceCombatRound) {
  return {
    ...(round.despairOutcome ? { despairOutcome: projectDespairRoundOutcome(round.despairOutcome) } : {}),
    ...(round.unagingDemonessOutcome ? { unagingDemonessOutcome: projectUnagingDemonessRoundOutcome(round.unagingDemonessOutcome) } : {}),
    ...(round.calamityDemonessOutcome ? { calamityDemonessOutcome: projectCalamityDemonessRoundOutcome(round.calamityDemonessOutcome) } : {}),
    ...(round.apocalypseDemonessOutcome ? { apocalypseDemonessOutcome: projectApocalypseDemonessRoundOutcome(round.apocalypseDemonessOutcome) } : {}),
  };
}

describe('actual221 inherited demoness public evidence', () => {
  it('preserves actual688 current bodies, consent, paid preparation and old attempts without provenance', () => {
    expect(hashFile(ACTUAL)).toBe(ACTUAL_SHA);
    const s = host(), before = digest(s), random = structuredClone(s.random);
    const life = projectCalamityDemonessLife(s), encounter = projectCalamityDemonessEncounter(s), future = projectApocalypseDemonessLife(s);
    expect(s.revision).toBe(689); expect(s.calamityDemoness.life.journal.length).toBeGreaterThan(0);
    expect(life.site).toEqual(facts(s.calamityDemoness.encounter.currentSite!));
    expect(future.site).toEqual(life.site); expect(future.ledger).toEqual([]);
    expect(life.site.vera).toMatchObject({ id: 'UD3-VERA', location: 'OUTSIDE', energy: 92 });
    expect(life.site.marcus).toMatchObject({ id: 'UD3-MARCUS', location: 'OUTSIDE', energy: 70 });
    expect(life.historicalScene).toMatchObject({ vera: { name: '维瑞娜·肖', age: 46, location: 'START' }, marcus: { name: '马库斯·赫尔', age: 41, location: 'B' } });
    expect(life.historicalScene).not.toHaveProperty('snapshot'); expect(life.historicalScene).not.toHaveProperty('root');
    const historicalInput = structuredClone(s.calamityDemoness.encounter.currentSite!.source!); inject(historicalInput);
    const historyBefore = digest(historicalInput), historical = projectCalamityDemonessHistory(historicalInput);
    expect(historical).toEqual(life.historicalScene); publicOnly(historical); detached(historical, historicalInput); expect(digest(historicalInput)).toBe(historyBefore);
    const untouched = createSliceRun('unintroduced-public-scene', sliceDefaultCreationSelection, 'unintroduced-public-scene');
    expect(projectCalamityDemonessLife(untouched)).not.toHaveProperty('historicalScene');
    expect(life.site.playerEnergy).toBe(22); expect(life.site.plates.every(p => p.status === 'RETURNED')).toBe(true);
    for (const c of life.cases) expect(c.attempts).toEqual(facts(s.calamityDemoness.life.cases[c.id].attempts));
    const prep = facts(s.calamityDemoness.encounter.preparation!); const { runId: _run, ...preparation } = prep;
    expect(encounter.preparation).toEqual(preparation); expect(encounter.plate).toEqual(s.calamityDemoness.encounter.plate);
    for (const v of [life, encounter, future]) { publicOnly(v); detached(v, s); }
    expect(s.random).toEqual(random); expect(digest(s)).toBe(before); expect(hashFile(ACTUAL)).toBe(ACTUAL_SHA);
  });

  it('keeps every historical854 S1 ledger fact, actual checks and modifier labels, with detached public originals', () => {
    expect(hashFile(LEGACY)).toBe(LEGACY_SHA);
    const s = host(legacy), before = digest(s), life = projectApocalypseDemonessLife(s);
    expect(s.apocalypseDemoness.life.journal).toHaveLength(55);
    expect(life.ledger).toEqual(facts(s.apocalypseDemoness.life.journal));
    expect(life.ledger.filter(r => r.check)).toHaveLength(2);
    expect(life.ledger.some(r => r.moves.length > 0)).toBe(true);
    for (const c of life.cases) expect(c.attempts).toEqual(facts(s.apocalypseDemoness.life.cases[c.id].attempts));
    for (const receipt of s.apocalypseDemoness.life.journal) {
      const input = structuredClone(receipt), expected = facts(input); inject(input); const beforeInput = digest(input);
      const view = projectApocalypseDemonessLifeReceipt(input);
      expect(view).toEqual(expected); publicOnly(view); detached(view, input); expect(digest(input)).toBe(beforeInput);
      if (view.check) {
        expect(view.check.roll).toBe(receipt.check!.roll); expect(view.check.chance).toBe(receipt.check!.chance);
        expect(view.check.modifiers).toEqual(receipt.check!.modifiers);
      }
    }
    publicOnly(life); detached(life, s); expect(digest(s)).toBe(before); expect(hashFile(LEGACY)).toBe(LEGACY_SHA);
  });

  it('rejects unknown nested life, site and encounter fields without changing any private evidence', () => {
    for (const input of [raw, legacy]) {
      const s = host(input), expected = [projectCalamityDemonessLife(s), projectCalamityDemonessEncounter(s), projectApocalypseDemonessLife(s), projectApocalypseDemonessEncounter(s)].map(withoutActions);
      inject(s.calamityDemoness.life); inject(s.calamityDemoness.encounter); inject(s.apocalypseDemoness.life); inject(s.apocalypseDemoness.encounter);
      const before = digest(s), views = [projectCalamityDemonessLife(s), projectCalamityDemonessEncounter(s), projectApocalypseDemonessLife(s), projectApocalypseDemonessEncounter(s)];
      // Strict private validation can disable actions on deliberately invalid evidence; public facts must remain identical.
      expect(views.map(withoutActions)).toEqual(expected);
      for (const v of views) { publicOnly(v); detached(v, s); }
      expect(digest(s)).toBe(before);
    }
  });

  it('uses one allowed outcome projection at all three global round entries, including real S1 rounds', () => {
    const s = host(legacy);
    expect(keys.map(k => s.combatHistory.filter(r => r[k]).length)).toEqual([2, 2, 3, 4]);
    const expected = s.combatHistory.map(r => projectPlayerText(Object.fromEntries(keys.filter(k => r[k]).map(k => [k, facts(r[k])])), s.character.name));
    // Controlled projection host only: collect retained actual outcomes to cover all entry points without running combat.
    const previous = structuredClone(s.combatHistory.at(-1)!);
    for (const key of keys) Object.assign(previous, { [key]: structuredClone(s.combatHistory.find(r => r[key])![key]) });
    const previousExpected = projectPlayerText(Object.fromEntries(keys.map(k => [k, facts(previous[k])])), s.character.name);
    s.lastCombatRound = structuredClone(previous);
    s.combat = { encounterId: 'APOCALYPSE_DEMONESS_DISPUTE', round: previous.round + 1, enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0, lastRound: structuredClone(previous) };
    for (const round of [...s.combatHistory, s.lastCombatRound, s.combat.lastRound!]) for (const key of keys) if (round[key]) inject(round[key]);
    const before = digest(s), random = structuredClone(s.random), view = projectSliceState(s);
    for (const key of keys) {
      expect(view.lastCombatRound![key]).toEqual(previousExpected[key]); expect(view.combat!.lastRound![key]).toEqual(previousExpected[key]);
      publicOnly(view.lastCombatRound![key]); publicOnly(view.combat!.lastRound![key]);
    }
    for (const [i, round] of view.combatHistory.entries()) for (const key of keys) if (round[key]) {
      expect(round[key]).toEqual(expected[i]![key]); publicOnly(round[key]);
    }
    for (const r of [...raw.combatHistory, ...legacy.combatHistory]) {
      const outcome = projectOutcomes(r); expect(outcome).toEqual(Object.fromEntries(keys.filter(k => r[k]).map(k => [k, facts(r[k])]))); publicOnly(outcome);
    }
    detached(view.lastCombatRound, s); detached(view.combat!.lastRound, s); detached(view.combatHistory, s);
    expect(s.random).toEqual(random); expect(digest(s)).toBe(before);
  }, 120_000);

  it('sanitizes live and terminal direct combat panels while retaining real ordered actions and physical mark sources', () => {
    for (const stage of ['calamity', 'apocalypse'] as const) for (const live of [false, true]) {
      const s = host(stage === 'calamity' ? raw : legacy), key = stage === 'calamity' ? 'calamityDemonessOutcome' : 'apocalypseDemonessOutcome';
      const candidates = s.combatHistory.filter(r => r[key]);
      const round = structuredClone(live ? candidates.find(r => r[key]!.playerActions.length > 0)! : candidates.at(-1)!), o = round[key]!;
      const allowed = facts(o), expected = [...allowed.playerActions.map(a => ({ ...a, actor: 'PLAYER' })), ...allowed.enemyActions.map(a => ({ ...a, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order);
      if (live) s.combat = { encounterId: stage === 'calamity' ? 'CALAMITY_DEMONESS_DISPUTE' : 'APOCALYPSE_DEMONESS_DISPUTE', round: round.round + 1,
        enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemyStatus: o.enemyStatus, enemyInjuries: [], enemyRisk: 0, lastRound: round };
      inject(s.calamityDemoness.encounter); inject(s.apocalypseDemoness.encounter);
      for (const r of s.combatHistory) if (r[key]) inject(r[key]); if (s.combat?.lastRound?.[key]) inject(s.combat.lastRound[key]);
      const before = digest(s), view = stage === 'calamity' ? projectCalamityDemonessCombat(s) : projectApocalypseDemonessCombat(s);
      expect(view.lastActionSequence).toEqual(expected); expect(view).not.toHaveProperty('source'); publicOnly(view); detached(view, s); expect(digest(s)).toBe(before);
    }
    const s = host(); s.progression.sequence = 3; inject(s.unagingDemoness.encounter.scene); inject(s.unagingDemoness.encounter.powerUses); inject(s.despair.encounter.powerUses);
    for (const v of [projectUnagingDemonessCombat(s), projectDespairCombat(s)]) { expect(v).not.toHaveProperty('source'); publicOnly(v); detached(v, s); }
    const rounds = legacy.combatHistory.flatMap(r => r.apocalypseDemonessOutcome ? [projectApocalypseDemonessRoundOutcome(r.apocalypseDemonessOutcome)] : []);
    expect(rounds.some(r => [...r.playerActions, ...r.enemyActions].some(a => a.pendingSourceAfter?.markId))).toBe(true);
    expect(hashFile(ACTUAL)).toBe(ACTUAL_SHA); expect(hashFile(LEGACY)).toBe(LEGACY_SHA);
  });
});
