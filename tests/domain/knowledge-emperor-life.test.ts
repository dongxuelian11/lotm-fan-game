import { describe, expect, it } from 'vitest';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateKnowledgeEmperorState } from '../../src/domain/knowledge-emperor/index.js';
import { blockKnowledgeEmperorLife, getKnowledgeEmperorCurrentSite, hasKnowledgeEmperorLifeLock, knowledgeEmperorLifeActions, knowledgeEmperorLifeClosed,
  knowledgeEmperorLifeMasteryGains, projectKnowledgeEmperorLife, validateKnowledgeEmperorActivityCommand, validateKnowledgeEmperorCurrentSite,
  validateKnowledgeEmperorLifeState, type KnowledgeEmperorCaseId } from '../../src/domain/knowledge-emperor/life.js';
import { KNOWLEDGE_EMPEROR_ABILITY_IDS } from '../../src/domain/knowledge-emperor/types.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { directedInitial2, dose, ke, oldHermitRoots, originalSage, prepareBottle, promoted, ready, rejectKnowledgeEmperor, step } from './knowledge-emperor-directed-helper.js';
const [KP, PK] = KNOWLEDGE_EMPEROR_ABILITY_IDS;
const attempt = (s: SliceState, id: KnowledgeEmperorCaseId) => s.knowledgeEmperor.life.cases[id].attempts[0]!;
const note = (s: SliceState, id: KnowledgeEmperorCaseId) => s.knowledgeEmperor.life.notes.find(n => n.caseId === id)!;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const cache = new Map<boolean, SliceState>();
/** Explicit UNIT input selected before guidance. Keep original seed and all
 * eight actual651 roots; never use this selection in natural acceptance. */
function firstCast(wins: boolean): SliceState {
  if (!cache.has(wins)) {
    const initial = directedInitial2(), promotionChance = computeCheckChance({ baseAbility: initial.character.coreStats.will, difficulty: 30, modifiers: [] }),
      lifeChance = computeCheckChance({ baseAbility: initial.character.coreStats.knowledge + 1, difficulty: 18, modifiers: [] });
    let chosen: number | null = null;
    for (let cursor = initial.random.cursor; cursor < initial.random.cursor + 512; cursor++) {
      const rng = new DeterministicActionRandomStream(initial.random.seed, cursor), promotionRoll = rng.nextInt(1, 100), castRoll = rng.nextInt(1, 100);
      if (promotionRoll > 5 && promotionRoll <= promotionChance && ((castRoll <= lifeChance) === wins)) { chosen = cursor; break; }
    }
    expect(chosen).not.toBeNull(); initial.random.cursor = chosen!;
    const s = ke(prepareBottle(initial, dose.bottleId), dose); expect(s.progression.sequence).toBe(1); cache.set(wins, s);
  }
  return structuredClone(cache.get(wins)!);
}
function start(s: SliceState, id: KnowledgeEmperorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = ready(s, { ap: 3, cash: 100, mind: 10, spirituality: 20 });
  while (s.knowledgeEmperor.life.site.playerEnergy < 24) s = ke(s, { type: 'RECOVER_ENERGY' });
  s = ke(s, { type: 'OBSERVE', caseId: id }); s = ke(s, { type: 'CONSENT', caseId: id, permission: 'OWNER' });
  if (method === 'ABILITY') s = ke(s, { type: 'CONSENT', caseId: id, permission: 'ABILITY' });
  return ke(s, { type: 'PREPARE', caseId: id, method });
}
function read(s: SliceState, id: KnowledgeEmperorCaseId): SliceState {
  for (const type of ['APPROACH', 'WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'COPY_NOTE'] as const) s = ke(s, { type, caseId: id });
  return s;
}
function finish(s: SliceState, id: KnowledgeEmperorCaseId, stop = false): SliceState {
  if (stop && !attempt(s, id).stopped) s = ke(s, { type: 'STOP_METHOD', caseId: id });
  for (const type of ['RETURN_TO_A', 'RETURN_TO_ENTRY', 'LEAVE', 'RETURN_NOTE'] as const) s = ke(s, { type, caseId: id });
  return ke(ready(s), { type: 'REPORT', caseId: id });
}
function ordinary(s: SliceState, id: 'knowledge-power' | 'power-knowledge'): SliceState {
  s = read(start(s, id, 'ORDINARY'), id); s = ke(s, { type: id === 'knowledge-power' ? 'APPLY_POWER' : 'VERIFY_REACTION', caseId: id }); return finish(s, id);
}

describe('Knowledge Emperor finite original archive practice', () => {
  it('starts from actual encounter currentSite, keeps original body/owner/inventory and hides unread content', () => {
    const s = promoted(), original = originalSage();
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(s.knowledgeEmperor.life.site).toEqual(original.sage.encounter.currentSite);
    expect(s.knowledgeEmperor.life.site).not.toEqual(original.sage.life.site);
    expect(getKnowledgeEmperorCurrentSite(s)).toMatchObject({ playerLocation: 'OUTSIDE', body: 'SOLID', playerEnergy: 30, playerTravelMetres: 66, clockSeconds: 510,
      iris: { id: 'PM3-IRIS', age: 49, location: 'OUTSIDE', energy: 78, travelMetres: 22 }, record: { location: 'OWNER', travelMetres: 72 } });
    expect(s.knowledgeEmperor.life.notes).toEqual([]); expect(s.knowledgeEmperor.life.cases['knowledge-power'].permission).toEqual({ OWNER: 'UNASKED', ABILITY: 'UNASKED' });
    expect(projectKnowledgeEmperorLife(s).cases.flatMap(c => c.observations)).toEqual([]); expect(oldHermitRoots(s)).toEqual(oldHermitRoots(original));
    expect(validateKnowledgeEmperorLifeState(s)).toBe(true);
  }, 120_000);
  it('requires new case permission despite old granted consent, purchases one paper and transforms that same substrate', () => {
    let s = promoted(); s = ke(s, { type: 'OBSERVE', caseId: 'knowledge-power' });
    rejectKnowledgeEmperor(s, { type: 'PREPARE', caseId: 'knowledge-power', method: 'ABILITY' });
    s = ke(s, { type: 'CONSENT', caseId: 'knowledge-power', permission: 'OWNER' });
    rejectKnowledgeEmperor(s, { type: 'PREPARE', caseId: 'knowledge-power', method: 'ABILITY' });
    s = ke(s, { type: 'CONSENT', caseId: 'knowledge-power', permission: 'ABILITY' });
    const cash = s.cash, ap = s.actionsRemaining; s = ke(s, { type: 'PREPARE', caseId: 'knowledge-power', method: 'ABILITY' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 20, ap - 1]);
    expect(note(s, 'knowledge-power')).toMatchObject({ id: 'KE1-PAPER-1', substrateId: 'KE1-PAPER-1', charges: 1, wear: 0, content: [], copied: false });
    rejectKnowledgeEmperor(s, { type: 'COPY_NOTE', caseId: 'knowledge-power' }); s = read(s, 'knowledge-power');
    expect(s.knowledgeEmperor.life.notes).toHaveLength(1);
    expect(note(s, 'knowledge-power')).toMatchObject({ id: 'KE1-NOTE-1', substrateId: 'KE1-PAPER-1', copied: true, charges: 1, wear: 0, travelMetres: 12 });
    expect(note(s, 'knowledge-power').content).toHaveLength(3); expect(note(s, 'knowledge-power').content.join('')).toContain('仍然未知');
    expect(s.knowledgeEmperor.life.site.archive.readings).toBe(3); expect(s.sage.encounter.currentSite!.archive.readings).toBe(2);
    rejectKnowledgeEmperor(s, { type: 'READ_ORIGINAL', caseId: 'knowledge-power' }); rejectKnowledgeEmperor(s, { type: 'COPY_NOTE', caseId: 'knowledge-power' });
  }, 120_000);
  it('pays a real knowledge check but awards only the once-applied same-page effect after real return and report', () => {
    let s = read(start(firstCast(true), 'knowledge-power'), 'knowledge-power'); const before = structuredClone(s), roots = oldHermitRoots(s);
    s = ke(s, { type: 'KNOWLEDGE_POWER', caseId: 'knowledge-power' });
    expect(success(attempt(s, 'knowledge-power').knowledgePowerTier)).toBe(true); expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 2, before.random.cursor + 1]);
    expect(s.knowledgeEmperor.life.pending).toMatchObject({ noteId: 'KE1-NOTE-1', pageId: 'SG2-ARCHIVE-LEAF', location: 'B', expiresAt: s.knowledgeEmperor.life.site.clockSeconds + 20 });
    expect(s.progression.mastery[KP]).toBe(0); expect(note(s, 'knowledge-power').charges).toBe(1);
    s = ke(s, { type: 'APPLY_POWER', caseId: 'knowledge-power' }); expect(attempt(s, 'knowledge-power')).toMatchObject({ baselineStabilization: 3, measuredStabilization: 6, appliedAbilityIds: [KP], checkSpiritualitySpent: 8, forceSpiritualitySpent: 0 });
    expect(note(s, 'knowledge-power')).toMatchObject({ charges: 0, wear: 1 }); expect(s.progression.mastery[KP]).toBe(0);
    rejectKnowledgeEmperor(s, { type: 'APPLY_POWER', caseId: 'knowledge-power' }); rejectKnowledgeEmperor(s, { type: 'REPORT', caseId: 'knowledge-power' });
    s = finish(s, 'knowledge-power'); expect(s.progression.mastery[KP]).toBe(8); expect(s.progression.acting).toBe(25);
    expect(note(s, 'knowledge-power')).toMatchObject({ status: 'RETURNED', location: 'OWNER', travelMetres: 24, charges: 0, wear: 1 });
    expect(s.knowledgeEmperor.life.site).toMatchObject({ playerEnergy: 6, playerTravelMetres: 90, iris: { energy: 78, travelMetres: 22, location: 'OUTSIDE' } });
    expect(oldHermitRoots(s)).toEqual(roots); rejectKnowledgeEmperor(s, { type: 'REPORT', caseId: 'knowledge-power' });
  }, 120_000);
  it('failed cast keeps actual costs and RNG, consumes the one ordinary baseline application, and gives no skill reward', () => {
    let s = read(start(firstCast(false), 'knowledge-power'), 'knowledge-power'); const before = { spirit: s.spirituality, mind: s.mind, cursor: s.random.cursor };
    s = ke(s, { type: 'KNOWLEDGE_POWER', caseId: 'knowledge-power' }); expect(success(attempt(s, 'knowledge-power').knowledgePowerTier)).toBe(false);
    expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirit - 8, before.mind - 2, before.cursor + 1]); expect(s.knowledgeEmperor.life.pending).toBeNull();
    s = ke(s, { type: 'APPLY_POWER', caseId: 'knowledge-power' }); expect(attempt(s, 'knowledge-power')).toMatchObject({ baselineStabilization: 3, measuredStabilization: 3, appliedAbilityIds: [] });
    s = finish(s, 'knowledge-power'); expect(s.progression.mastery[KP]).toBe(0); expect(note(s, 'knowledge-power')).toMatchObject({ charges: 0, wear: 1 });
  }, 120_000);
  it('expiry and actual movement irreversibly clear paid windows without restoring the source or refunding', () => {
    for (const expiry of [true, false]) {
      let s = read(start(firstCast(true), 'knowledge-power'), 'knowledge-power'); s = ke(s, { type: 'KNOWLEDGE_POWER', caseId: 'knowledge-power' }); const spirit = s.spirituality;
      if (expiry) { s = ke(s, { type: 'WAIT_10', caseId: 'knowledge-power' }); s = ke(s, { type: 'WAIT_10', caseId: 'knowledge-power' }); }
      else s = ke(s, { type: 'RETURN_TO_A', caseId: 'knowledge-power' });
      expect(s.knowledgeEmperor.life.pending).toBeNull(); expect(s.spirituality).toBe(spirit); expect(note(s, 'knowledge-power').charges).toBe(1);
      expect(attempt(s, 'knowledge-power').windowEnd).toBe(expiry ? 'EXPIRED' : 'MOVED'); rejectKnowledgeEmperor(s, { type: 'KNOWLEDGE_POWER', caseId: 'knowledge-power' });
      if (expiry) { s = ke(s, { type: 'APPLY_POWER', caseId: 'knowledge-power' }); expect(attempt(s, 'knowledge-power').measuredStabilization).toBe(3); }
      s = ke(s, { type: 'ABORT', caseId: 'knowledge-power' }); s = ke(s, { type: 'REPORT', caseId: 'knowledge-power' }); expect(s.progression.mastery[KP]).toBe(0);
    }
  }, 120_000);
  it('requires an actual spent force receipt, records separate4S and8S costs, moves the original owner, and never restores charges', () => {
    let s = ordinary(firstCast(true), 'knowledge-power'); s = read(start(s, 'power-knowledge'), 'power-knowledge');
    expect(s.knowledgeEmperor.life.site.iris).toMatchObject({ location: 'B', energy: 66, travelMetres: 34 });
    expect(s.knowledgeEmperor.life.site.record).toMatchObject({ location: 'OWNER', travelMetres: 84 });
    rejectKnowledgeEmperor(s, { type: 'POWER_KNOWLEDGE', caseId: 'power-knowledge' });
    const before = s.spirituality; s = ke(s, { type: 'SPEND_FORCE', caseId: 'power-knowledge' });
    expect(attempt(s, 'power-knowledge').forceReceipt).toMatchObject({ id: 'KE1-FORCE-2', noteId: 'KE1-NOTE-2', pageId: 'SG2-ARCHIVE-LEAF', force: 6, spiritualitySpent: 4, paperEdgeMovedMm: 1, noteChargeSpent: 1 });
    expect(s.spirituality).toBe(before - 4); expect(note(s, 'power-knowledge')).toMatchObject({ charges: 0, wear: 1 });
    rejectKnowledgeEmperor(s, { type: 'SPEND_FORCE', caseId: 'power-knowledge' }); s = ke(s, { type: 'POWER_KNOWLEDGE', caseId: 'power-knowledge' });
    expect(s.spirituality).toBe(before - 12); expect(attempt(s, 'power-knowledge')).toMatchObject({ checkSpiritualitySpent: 8, forceSpiritualitySpent: 4 });
    s = ke(s, { type: 'VERIFY_REACTION', caseId: 'power-knowledge' }); expect(note(s, 'power-knowledge')).toMatchObject({ charges: 0, wear: 2 });
    expect(attempt(s, 'power-knowledge').observedReaction).toContain('没有读出缺失正文'); const earned = success(attempt(s, 'power-knowledge').powerKnowledgeTier) ? 8 : 0;
    s = finish(s, 'power-knowledge'); expect(s.progression.mastery[PK]).toBe(earned);
    expect(s.knowledgeEmperor.life.site.iris).toMatchObject({ location: 'OUTSIDE', energy: 54, travelMetres: 46 }); expect(s.knowledgeEmperor.life.site.record!.travelMetres).toBe(96);
    expect(s.sage.encounter.currentSite!.iris).toMatchObject({ energy: 78, travelMetres: 22 });
  }, 120_000);
  it('third case genuinely revokes fresh consent, returns physically, and never rewards its unused successful preparation', () => {
    let s = ordinary(ordinary(firstCast(true), 'knowledge-power'), 'power-knowledge'); s = read(start(s, 'withdrawn-consent'), 'withdrawn-consent');
    s = ke(s, { type: 'KNOWLEDGE_POWER', caseId: 'withdrawn-consent' }); const spirit = s.spirituality;
    s = ke(s, { type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-consent', permission: 'ABILITY' });
    expect(s.knowledgeEmperor.life.pending).toBeNull(); expect(s.spirituality).toBe(spirit); expect(attempt(s, 'withdrawn-consent')).toMatchObject({ withdrawn: true, stopped: true, appliedAbilityIds: [] });
    rejectKnowledgeEmperor(s, { type: 'APPLY_POWER', caseId: 'withdrawn-consent' }); rejectKnowledgeEmperor(s, { type: 'CONSENT', caseId: 'withdrawn-consent', permission: 'ABILITY' });
    s = finish(s, 'withdrawn-consent'); s = ke(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[KP]).toBe(0); expect(s.progression.mastery[PK]).toBe(0);
    expect(s.knowledgeEmperor.life.notes).toHaveLength(3); expect(note(s, 'withdrawn-consent')).toMatchObject({ charges: 1, wear: 0, location: 'OWNER', status: 'RETURNED' });
    expect(knowledgeEmperorLifeClosed(s)).toBe(true); expect(hasKnowledgeEmperorLifeLock(s)).toBe(false);
    expect(s.knowledgeEmperor.life.site).toMatchObject({ playerTravelMetres: 138, playerEnergy: 18, archive: { readings: 5, verifications: 4 } });
    expect(s.knowledgeEmperor.life.energyRecovered).toBe(60); expect(knowledgeEmperorLifeMasteryGains(s)).toEqual({ [KP]: 0, [PK]: 0 });
    rejectKnowledgeEmperor(s, { type: 'REFLECT' }); expect(validateKnowledgeEmperorState(s)).toBe(true);
  }, 120_000);
  it('paid outside recovery changes only real energy and elapsed time; ordinary REST never refills the local site', () => {
    let s = ordinary(promoted(), 'knowledge-power'); const old = structuredClone(s), roots = oldHermitRoots(s);
    s = ke(s, { type: 'RECOVER_ENERGY' }); expect(s.knowledgeEmperor.life.site.playerEnergy).toBe(26);
    expect(s.knowledgeEmperor.life.site.clockSeconds).toBe(old.knowledgeEmperor.life.site.clockSeconds + 60); expect(s.cash).toBe(old.cash - 15); expect(s.actionsRemaining).toBe(old.actionsRemaining - 1);
    expect([s.spirituality, s.mind, s.health]).toEqual([old.spirituality, old.mind, old.health]); const energy = s.knowledgeEmperor.life.site.playerEnergy;
    s = step(s, { type: 'ACTION', action: 'REST' }); expect(s.knowledgeEmperor.life.site.playerEnergy).toBe(energy); expect(oldHermitRoots(s)).toEqual(roots);
  }, 120_000);
  it('preferred actions actually reach all three reports and reflection with a finite copied substrate per case', () => {
    let s = promoted(); const commands: string[] = [];
    for (let count = 0; !s.knowledgeEmperor.life.reflected && count < 120; count++) {
      if (!hasKnowledgeEmperorLifeLock(s)) s = ready(s, { ap: 3, cash: 100, mind: 10, spirituality: 20 });
      const view = projectKnowledgeEmperorLife(s), action = view.actions.find(a => a.id === view.preferredActionId && a.enabled) ?? view.actions.find(a => a.enabled);
      expect(action, JSON.stringify(view.actions)).toBeDefined(); commands.push(action!.command.type); s = ke(s, action!.command);
    }
    expect(s.knowledgeEmperor.life.reflected).toBe(true); expect(commands.filter(x => x === 'SPEND_FORCE')).toHaveLength(1); expect(commands.filter(x => x === 'WITHDRAW_CONSENT')).toHaveLength(1);
    expect(commands.filter(x => x === 'REPORT')).toHaveLength(3); expect(commands.filter(x => x === 'RECOVER_ENERGY')).toHaveLength(3);
    expect(projectKnowledgeEmperorLife(s).actions.some(a => a.command.type === 'RECOVER_ENERGY')).toBe(false);
    expect(blockKnowledgeEmperorLife(s, { type: 'RECOVER_ENERGY' })).toBeNull();
    expect(s.knowledgeEmperor.life.notes.map(n => n.substrateId)).toEqual(['KE1-PAPER-1', 'KE1-PAPER-2', 'KE1-PAPER-3']); assertValidSliceState(s);
  }, 240_000);
  it('rejects altered source, one-use charges, budgets, RNG, owner movement and duplicate rewards', () => {
    let s = read(start(firstCast(true), 'knowledge-power'), 'knowledge-power'); s = ke(s, { type: 'KNOWLEDGE_POWER', caseId: 'knowledge-power' });
    const changes: ((x: SliceState) => void)[] = [
      x => { x.knowledgeEmperor.life.site.playerEnergy++; }, x => { x.knowledgeEmperor.life.site.archive.readings++; },
      x => { x.knowledgeEmperor.life.notes[0]!.content.push('伪造缺文'); }, x => { x.knowledgeEmperor.life.notes.push(structuredClone(x.knowledgeEmperor.life.notes[0]!)); },
      x => { x.knowledgeEmperor.life.notes[0]!.charges = 0; }, x => { x.knowledgeEmperor.life.pending!.expiresAt++; },
      x => { x.knowledgeEmperor.life.journal.at(-1)!.paid.spirituality = 0; }, x => { x.knowledgeEmperor.life.journal.at(-1)!.randomAfter!++; },
      x => { x.knowledgeEmperor.life.journal.at(-1)!.check!.roll = 101; }, x => { x.knowledgeEmperor.life.journal.at(-1)!.after.cash++; },
      x => { x.knowledgeEmperor.life.site.iris!.energy++; }, x => { x.knowledgeEmperor.life.site.record!.travelMetres++; },
      x => { x.knowledgeEmperor.life.site.materials[0]!.wear = 0; }, x => { x.seer.completedSources.push('knowledge-emperor-case:knowledge-power'); },
    ];
    for (const change of changes) { const x = structuredClone(s); change(x); expect(validateKnowledgeEmperorLifeState(x), change.toString()).toBe(false); }
    expect(validateKnowledgeEmperorCurrentSite(s.knowledgeEmperor.life.site, s.knowledgeEmperor.sourceScene!.originals)).toBe(true);
    expect(validateKnowledgeEmperorActivityCommand({ type: 'CONSENT', caseId: 'knowledge-power', permission: 'ALL' })).toBe(false);
    expect(validateKnowledgeEmperorActivityCommand({ type: 'KNOWLEDGE_POWER', caseId: 'knowledge-power', free: true })).toBe(false);
    expect(blockKnowledgeEmperorLife(s, { type: 'REPORT', caseId: 'knowledge-power' })).not.toBeNull(); expect(knowledgeEmperorLifeActions(s).filter(a => a.command.type === 'KNOWLEDGE_POWER')).toEqual([]);
  }, 120_000);
});
