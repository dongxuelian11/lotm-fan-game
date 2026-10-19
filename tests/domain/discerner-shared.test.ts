import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { applyDiscernerCommand, createDiscernerState, projectDiscerner, validateDiscernerCommand, validateDiscernerState } from '../../src/domain/discerner/index.js';
import { DISCERNER_ABILITY_IDS } from '../../src/domain/discerner/types.js';
import { DISCERNER_CASE_IDS, projectDiscernerLife, validateDiscernerActivityCommand } from '../../src/domain/discerner/life.js';
import { validateDiscernerEncounter, validateDiscernerEncounterCommand, DISCERNER_POWERS } from '../../src/domain/discerner/encounter.js';
import { validateDiscernerRoundOutcome } from '../../src/domain/discerner/combat.js';
import { DREAM_WEAVER_COUNT_WHEEL, DREAM_WEAVER_ENEMY_COUNT_WHEEL, DREAM_WEAVER_ENEMY_ABILITY_WHEEL, dreamWeaverAbilityWheel } from '../../src/domain/dream-weaver/combat.js';
import {
  audienceLegacyKeys, discernerContext, discernerFixturePath, discernerSnapshot,
  discernerBoundary, discernerBoundaryNames,
} from './discerner-test-fixture.js';

const oldLivingPath = 'tests/fixtures/dream-weaver-v01420/peaceful-exit.json';
const oldDeathPath = 'tests/fixtures/dream-weaver-v01420/natural.json';
const entry = <T>(path: string, key: string) => readObjectEntry<T>(path, key);
const commands = (path: string) => entry<SliceIntent[]>(path, 'commands');
const rawFinal = (path: string) => entry<SliceState>(path, 'final');
const IMPRINT = 'audience.s2.mental-imprint', INSIGHT = 'audience.s2.insight-window';
function replay(path: string) {
  const final = rawFinal(path), creation = entry<Parameters<typeof createSliceRun>[1]>(path, 'creation'), seed = entry<string>(path, 'seed');
  let s = createSliceRun(final.runId, creation, seed);
  for (const command of commands(path)) s = applySliceIntent(s, command);
  assertValidSliceState(s); expect(s).toEqual(migrateSliceState(final)); return s;
}

describe('Discerner same-seed public route and exact shared boundaries', () => {
  it('replays the complete natural transcript from the exact existing 441-command living branch', () => {
    const prefix = commands(oldLivingPath), actual = commands(discernerFixturePath);
    expect(prefix).toHaveLength(441); expect(entry<number>(discernerFixturePath, 'prefixCount')).toBe(441);
    expect(actual.slice(0, 441)).toEqual(prefix); expect(entry<string>(discernerFixturePath, 'seed')).toBe(entry<string>(oldLivingPath, 'seed'));
    expect(discernerSnapshot('departureStart')).toEqual(migrateSliceState(rawFinal(oldLivingPath)));
    const s = replay(discernerFixturePath); expect(s.progression.sequence).toBe(2);
    expect(s.discerner.encounter.terminal).not.toBeNull();
    // Natural terminal outcome is selected by the real transcript, not assumed by this test.
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.discerner.encounter.terminal!.outcome).toBe('PLAYER_DEAD'); }
    else expect(s.health).toBeGreaterThan(0);
  }, 60000);

  it('replays every captured persistence boundary once without mutating its original input', () => {
    const names = discernerBoundaryNames(); expect(new Set(names).size).toBe(names.length);
    for (const required of ['guidance', 'promotion', 'present-mark-formed', 'present-mark-ability-outcome', 'present-mark-card-taken', 'present-mark-checked', 'present-mark-returned', 'covered-mark-seal', 'covered-mark-ability-outcome', 'withdrawn-mark-revoked', 'withdrawn-mark-closed', 'reflection', 'combat-start', 'combat-first', 'combat-terminal', 'clinic-pay60', 'clinic-later-rest']) expect(names).toContain(required);
    for (const name of names) {
      const b = discernerBoundary(name), bytes = JSON.stringify(b.beforeLast);
      assertValidSliceState(b.beforeLast); assertValidSliceState(b.final);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), name).toEqual(b.final);
      expect(JSON.stringify(b.beforeLast), name).toBe(bytes);
    }
  }, 60000);

  it('keeps the original 443-command dead branch reproducible and never revives it on migration', () => {
    expect(commands(oldDeathPath)).toHaveLength(443); const original = rawFinal(oldDeathPath), bytes = JSON.stringify(original);
    expect(original.status).toBe('DEAD'); expect(original.health).toBe(0);
    const s = replay(oldDeathPath); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0);
    expect(s.discerner).toEqual(createDiscernerState());
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(original[key]);
    expect(s.combatHistory).toEqual(original.combatHistory); expect(s.injuries).toEqual(original.injuries);
    expect(s.random).toEqual(original.random); expect(s.progression).toEqual(original.progression);
    const before = structuredClone(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'OBSERVE', caseId: 'present-mark' }, { type: 'ENCOUNTER_TALK' }] as const)
      expect(() => applySliceIntent(s, { type: 'DISCERNER', command })).toThrow();
    expect(s).toEqual(before); expect(JSON.stringify(original)).toBe(bytes);
  }, 60000);

  it('clears the two original heavy wounds only through actual paid clinic care and later rest', () => {
    const old = discernerSnapshot('departureStart'), guidance = discernerSnapshot('guidanceStart'), battle = discernerSnapshot('combatStart');
    expect(old.injuries.filter(i => i.severity === 'HEAVY')).toHaveLength(2);
    const paid = discernerBoundary('clinic-pay60');
    expect(paid.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(paid.final.cash).toBe(paid.beforeLast.cash - 60);
    expect(paid.final.injuries.map(i => i.id)).toEqual(paid.beforeLast.injuries.map(i => i.id));
    expect(paid.final.injuries.filter(i => i.severity === 'HEAVY').every(i => i.treatedRevision !== null)).toBe(true);
    const rest = discernerBoundary('clinic-later-rest'); expect(rest.lastIntent).toEqual({ type: 'ACTION', action: 'REST' });
    expect(rest.beforeLast.injuries.length).toBeGreaterThan(0); expect(rest.final.injuries).toEqual([]); expect(rest.final.injuryRisk).toBe(0);
    expect(guidance.injuries).toEqual([]); expect(battle.injuries).toEqual([]); expect(battle.injuryRisk).toBe(0);
    for (const key of audienceLegacyKeys) { expect(guidance[key]).toEqual(old[key]); expect(battle[key]).toEqual(old[key]); }
  });

  it('preserves every original lower-stage person, object, unused bottle and mastery at real promotion', () => {
    const old = discernerSnapshot('departureStart'), s = discernerSnapshot('promoted'); assertValidSliceState(s);
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(old[key]);
    expect(s.character.gender).toBe(old.character.gender); expect(s.discerner.dreamWeaverActingAtPromotion).toBe(100);
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...DISCERNER_ABILITY_IDS]);
    expect(DISCERNER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(projectDiscerner(s).resources!.maxSpirituality).toBe(120); expect(projectSliceState(s).dreamWeaver.acting).toBe(100);
    const consumed = s.discerner.bottles.filter(b => b.status === 'CONSUMED');
    expect(consumed.length).toBeGreaterThan(0); expect(['SUCCESS', 'GREAT_SUCCESS']).toContain(consumed.at(-1)!.outcome);
    expect(consumed.slice(0, -1).every(b => b.outcome === 'FAILURE' || b.outcome === 'GREAT_FAILURE')).toBe(true);
    expect(consumed.every(b => b.consumedWeek === b.preparationWeek && b.acquiredWeek !== null)).toBe(true);
    expect(s.discerner.bottles.every(b => b.id.startsWith('discerner-potion-'))).toBe(true);
  });

  it('records actual natural finite checks, blocked/refused contacts and original-card cleanup without guessing the first roll', () => {
    const s = discernerSnapshot('practiced'), p = projectDiscernerLife(s), promoted = discernerSnapshot('promoted');
    assertValidSliceState(s); expect(s.progression.acting).toBe(100); expect(s.discerner.life.reflected).toBe(true);
    expect(p.cases.map(c => c.id)).toEqual([...DISCERNER_CASE_IDS]);
    expect(p.cases.every(c => c.status === 'RESOLVED' && c.attempts.length === 1 && c.closes === 1)).toBe(true);
    const actual = p.cases.map(c => c.attempts[0]!);
    expect(actual.map(a => a.ownerTravelMetres)).toEqual([12, 12, 12]);
    expect(actual.every(a => a.cardTaken && a.cardChecked && a.cardReturned && a.verified && a.closed && !a.contactActive && a.ownerNode === 'NEAR')).toBe(true);
    expect(actual.map(a => [a.spiritualitySpent, a.ownerMindSpent])).toEqual([[6, 2], [6, 2], [0, 0]]);
    expect(actual[1]).toMatchObject({ imprintResult: 'BLOCKED', sealCharges: 0, result: 'ORDINARY' });
    expect(actual[2]).toMatchObject({ contactPermission: 'WITHDRAWN', materialPermission: 'GRANTED', imprintAttempted: false, result: 'ORDINARY' });
    const first = actual[0]!; expect(first.check).not.toBeNull();
    const firstSucceeded = first.check!.tier === 'SUCCESS' || first.check!.tier === 'GREAT_SUCCESS';
    expect(first.imprintResult).toBe(firstSucceeded ? 'REVEALED' : 'FAILED');
    expect(s.progression.mastery[IMPRINT]).toBe(promoted.progression.mastery[IMPRINT]! + (firstSucceeded ? 8 : 0));
    expect(s.progression.mastery[INSIGHT]).toBe(0);
    expect(p.practice!.knownClues.filter(k => k.source === 'FINITE_IMPRINT').length).toBe(firstSucceeded ? 1 : 0);
    expect(p.practice!.knownClues.filter(k => k.source === 'PHYSICAL_ORIGINAL')).toHaveLength(3);
    expect(Object.values(p.practice!.cards).every(c => c.holder === 'TARGET' && c.node === 'FAR' && !!c.marking)).toBe(true);
  });

  it('keeps real hidden card faces absent until their specific physical-check boundary', () => {
    const formed = discernerBoundary('present-mark-formed'), scanned = discernerBoundary('present-mark-ability-outcome');
    const taken = discernerBoundary('present-mark-card-taken'), checked = discernerBoundary('present-mark-checked');
    for (const b of [formed, scanned, taken]) expect(projectDiscernerLife(b.final).practice!.cards['DCR2-ELENA-CARD']).not.toHaveProperty('marking');
    expect(projectDiscernerLife(checked.beforeLast).practice!.cards['DCR2-ELENA-CARD']).not.toHaveProperty('marking');
    expect(projectDiscernerLife(checked.final).practice!.cards['DCR2-ELENA-CARD'].marking).toBeTruthy();
    const blocked = projectDiscernerLife(discernerBoundary('covered-mark-ability-outcome').final);
    expect(blocked.practice!.knownClues.some(c => c.caseId === 'covered-mark')).toBe(false);
    expect(blocked.practice!.cards['DCR2-BRAM-CARD']).not.toHaveProperty('marking');
  });

  it('keeps all actual battle uses/costs and original enemies while recording ordinary exit or real death exactly', () => {
    const s = discernerSnapshot('final'), old = discernerSnapshot('departureStart'); assertValidSliceState(s);
    expect(validateDiscernerEncounter(s)).toBe(true); expect(s.combat).toBeNull();
    const e = s.discerner.encounter, rounds = s.combatHistory.filter(r => r.discernerOutcome).map(r => r.discernerOutcome!);
    expect(rounds.length).toBeGreaterThan(0); for (const o of rounds) expect(validateDiscernerRoundOutcome(o)).toBe(true);
    expect(e.enemySpirituality).toBe(120 - DISCERNER_POWERS.reduce((sum, p) => sum + e.powerUses[p.id] * p.cost, 0));
    const actions = rounds.flatMap(o => o.playerActions);
    expect(e.mentalImprintUses).toBe(actions.filter(a => a.id === IMPRINT && a.paidCost === 6).length);
    expect(e.mentalImprintSuccesses).toBe(actions.filter(a => a.id === IMPRINT && a.finiteResult === 'APPLIED').length);
    expect(e.insightWindowUses).toBe(actions.filter(a => a.id === INSIGHT && a.paidCost === 5).length);
    expect(e.insightWindowSuccesses).toBe(actions.filter(a => a.id === INSIGHT && a.finiteResult === 'APPLIED').length);
    expect(e.totalOwnerMindSpent).toBe(actions.reduce((sum, a) => sum + a.ownerMindSpent, 0));
    expect([e.exitTravelMetres, e.exitSeconds]).toEqual(s.status === 'DEAD' ? [0, 0] : [4, 4]);
    expect(e.weaponLocation).toBe(e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD');
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(old[key]);
    for (const o of rounds) {
      expect(o.playerActions.filter(a => a.id === IMPRINT && a.paidCost > 0).length).toBeLessThanOrEqual(1);
      expect(o.playerActions.filter(a => a.id === INSIGHT && a.paidCost > 0).length).toBeLessThanOrEqual(1);
    }
  });

  it('projects old Dream Weaver enemy wheels from their actual fixed source after migration', () => {
    const old = migrateSliceState(entry<unknown>(oldDeathPath, 'combatStart')); assertValidSliceState(old);
    const p = projectSliceState(old).combat!; expect(p.enemyCountWheel).toEqual(DREAM_WEAVER_ENEMY_COUNT_WHEEL);
    const playerLabels = ["近真梦像（6S/意志18；实际信以为真才−6M/优势38×掌握）", "一具外部身份牵制（5S+2M/意志16；至多60秒6米/减势26）", "继承心灵岛屿（4S/意志16；−8M/优势42×掌握）", "继承本人防守人格（3S+1M；减势24）", "继承鳞片（2S/减势14×掌握；不足普通自保）", "继承有限精神瘟疫（4S/意志18；仅播种一次，离场不净化）", "本人原身体/实际在手原棍（12/16×身体）", "观察真实原人（0消耗/0贡献，不全知）", "判断失衡（固定−22.5）"];
    const enemyLabels = ["原有限弧光术：5S/贡献75", "原有限护术：4S/减势45", "实际精神抵抗：3S/一次梦像抵抗30%→70%", "自己的唯一原棍：20×身体", "普通观察原身体与原出口：0贡献", "判断偏差：−22.5"];
    expect(p.playerCountWheel).toEqual(DREAM_WEAVER_COUNT_WHEEL); expect(p.enemyAbilityWheel).toEqual(DREAM_WEAVER_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]})));
    expect(p.playerAbilityWheel).toEqual(dreamWeaverAbilityWheel(old, null).map((entry,index)=>({...entry,label:playerLabels[index]})));
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE'] as const) expect(p.playerAbilityWheels?.[stance]).toEqual(dreamWeaverAbilityWheel(old, stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
    expect(p.playerAbilityWheels?.RETREAT).toEqual([]);
  });

  it('uses only real preparation and the selected independent bottle, and never refills current S on promotion', () => {
    const b = discernerBoundary('promotion'), s = structuredClone(b.beforeLast), old = structuredClone(s);
    if (b.lastIntent.type !== 'DISCERNER' || b.lastIntent.command.type !== 'CONSUME') throw new Error('Expected actual promotion consumption');
    const command = b.lastIntent.command;
    s.spirituality = 17; // Explicit unit-only resource check on the real prepared source.
    applyDiscernerCommand(s, command, discernerContext(s, 1));
    expect(s.spirituality).toBe(17); expect(s.actionsRemaining).toBe(old.actionsRemaining); expect(s.cash).toBe(old.cash);
    expect(s.discerner.preparedWeek).toBeNull(); expect(s.progression.sequence).toBe(2);
    expect(s.discerner.bottles.find(v => v.id === command.bottleId)!.status).toBe('CONSUMED');
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(old[key]);
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(Math.min(500, old.character.coreStats[key] + 1));
    expect(() => applyDiscernerCommand(s, command, discernerContext(s))).toThrow();
  });

  it('preserves the selected paid bottle and spent preparation after a directed severe failure', () => {
    const b = discernerBoundary('promotion'), s = structuredClone(b.beforeLast), old = structuredClone(s);
    if (b.lastIntent.type !== 'DISCERNER' || b.lastIntent.command.type !== 'CONSUME') throw new Error('Expected actual prepared consumption');
    const command = b.lastIntent.command; applyDiscernerCommand(s, command, discernerContext(s, 100));
    expect(s.progression).toEqual(old.progression); expect(s.health).toBe(Math.max(1, old.health - 25)); expect(s.mind).toBe(Math.max(1, old.mind - 45));
    expect(s.discerner.preparedWeek).toBeNull(); expect(s.discerner.bottles.find(v => v.id === command.bottleId)).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' });
    expect(s.spirituality).toBe(old.spirituality); expect(s.actionsRemaining).toBe(old.actionsRemaining);
    expect(() => applyDiscernerCommand(s, command, discernerContext(s))).toThrow();
  });

  it('accepts only exact typed public command shapes', () => {
    const valid = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'PREPARE_PROMOTION' }, { type: 'LEAVE_PREPARATION' },
      { type: 'PREPARE_TASK', taskId: 'CHECK_ORIGINALS' }, { type: 'POTION_WORK', bottleId: 'discerner-potion-1' }, { type: 'BUY_POTION', bottleId: 'discerner-potion-2' }, { type: 'CONSUME', bottleId: 'discerner-potion-2', confirmed: true },
      { type: 'OBSERVE', caseId: 'present-mark' }, { type: 'PREPARE', caseId: 'covered-mark', method: 'ORDINARY' }, { type: 'CONSENT', personId: 'DCR2-ELENA', permission: 'CONTACT' }, { type: 'DECLINE_CONSENT', personId: 'DCR2-ELENA', permission: 'MATERIAL' }, { type: 'REVOKE_CONSENT', personId: 'DCR2-SELMA', permission: 'CONTACT' },
      { type: 'PERFORM', caseId: 'present-mark' }, { type: 'FORM_MARK' }, { type: 'ACTIVATE_SEAL' }, { type: 'DEACTIVATE_SEAL' }, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }, { type: 'MENTAL_IMPRINT' }, { type: 'STOP_CONTACT' }, { type: 'WAIT_MARK' }, { type: 'TAKE_CARD' }, { type: 'CHECK_CARD' }, { type: 'RETURN_CARD' },
      { type: 'VERIFY', caseId: 'present-mark' }, { type: 'CLOSE', caseId: 'present-mark' }, { type: 'WITHDRAW', caseId: 'present-mark' }, { type: 'REPORT', caseId: 'present-mark' }, { type: 'REFLECT' },
      { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'LEAVE_ENCOUNTER' }, { type: 'AID_ENEMY' },
    ];
    for (const command of valid) {
      expect(validateDiscernerCommand(command)).toBe(true); expect(validateSlicePayload({ type: 'DISCERNER', command })).toBe(true);
      expect(validateDiscernerCommand({ ...command, free: true })).toBe(false); expect(validateSlicePayload({ type: 'DISCERNER', command, trusted: true })).toBe(false);
    }
  });

  it.each([
    null, {}, [], { type: 'READ_ALL_MINDS' }, { type: 'MENTAL_IMPRINT', success: true }, { type: 'MENTAL_IMPRINT', caseId: 'present-mark' },
    { type: 'CONSENT', personId: 'DWV3-IRIS', permission: 'CONTACT' }, { type: 'CONSENT', personId: 'DCR2-ELENA', permission: 'ALL' },
    { type: 'MOVE', actor: 'TARGET', to: 'NEAR' }, { type: 'MOVE', actor: 'OWNER', to: 'CITY' }, { type: 'TAKE_CARD', cardId: 'COPY' },
    { type: 'OBSERVE', caseId: 'old-dream' }, { type: 'PREPARE', caseId: 'present-mark', method: 'FORCE_SUCCESS' },
    { type: 'PREPARE_TASK', taskId: 'OLD_ASSEMBLY' }, { type: 'BUY_POTION', bottleId: 'dream-weaver-potion-1' }, { type: 'BUY_POTION', bottleId: 'discerner-potion-0' }, { type: 'BUY_POTION', bottleId: 'discerner-potion-01' },
    { type: 'CONSUME', bottleId: 'discerner-potion-1' }, { type: 'CONSUME', bottleId: 'discerner-potion-1', confirmed: false }, { type: 'REFILL_SEAL' }, { type: 'REVIVE' },
  ])('rejects malformed or hidden command %# before mutation or randomness', command => {
    expect(validateDiscernerCommand(command)).toBe(false); expect(validateSlicePayload({ type: 'DISCERNER', command })).toBe(false);
    const s = discernerSnapshot('promoted'), before = structuredClone(s), ctx = discernerContext(s);
    expect(() => applyDiscernerCommand(s, command as never, ctx)).toThrow(); expect(s).toEqual(before);
    expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled();
  });

  it('rejects undeclared direct life/encounter fields and unknown real bottle IDs atomically', () => {
    expect(validateDiscernerActivityCommand({ type: 'TAKE_CARD', copy: true })).toBe(false);
    expect(validateDiscernerEncounterCommand({ type: 'ENCOUNTER_FIGHT', targetId: 'DWV3-OSMOND' })).toBe(false);
    const s = discernerBoundary('guidance').final, before = structuredClone(s), ctx = discernerContext(s);
    expect(() => applyDiscernerCommand(s, { type: 'BUY_POTION', bottleId: 'discerner-potion-999' }, ctx)).toThrow(); expect(s).toEqual(before);
    s.progression.pathwayId = 'diviner'; expect(projectDiscerner(s).discovered).toBe(false); expect(projectDiscerner(s).actions).toEqual([]);
  });

  it('rejects forged independent resources/history and preserves canonical serialization', () => {
    const s = discernerSnapshot('final'), bad = structuredClone(s); bad.discerner.encounter.enemySpirituality++;
    expect(validateDiscernerEncounter(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow();
    const reordered = JSON.parse(stableStringify(s)) as SliceState;
    expect(validateDiscernerState(reordered)).toBe(true); expect(projectDiscerner(reordered)).toEqual(projectDiscerner(s));
    expect(() => assertValidSliceState(reordered)).not.toThrow();
  });
});
