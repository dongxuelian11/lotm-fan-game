import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { applyDemonHunterCommand } from '../../src/domain/demon-hunter/index.js';
import { GLORY_INHERITED_ABILITY_IDS, createGloryState, projectGlory, validateGloryAcquisitionJournal, validateGloryCommand, validateGloryState } from '../../src/domain/glory/index.js';
import { GLORY_ABILITY_IDS, GLORY_PREPARATION_IDS } from '../../src/domain/glory/types.js';
import { directedInitial3, dose, gl, oldWarriorRoots, originalSilverFinal, prepared, promoted, recover, rejectGlory, rejectIntent, silverDirectedPath, step, taught, warriorLegacyKeys } from './glory-directed-helper.js';

const journal = (s: SliceState) => s.glory.acquisitionJournal;
describe('Glory acquisition from the explicitly directed original Silver Knight source', () => {
  it('retains the exact70-command source provenance, seven roots, original body, wounds and same armor65', () => {
    const s = originalSilverFinal(), raw = readObjectEntry<SliceState>(silverDirectedPath, 'final');
    expect(readObjectEntry<string>(silverDirectedPath, 'provenance')).toContain('DIRECTED');
    expect(readObjectEntry<SliceIntent[]>(silverDirectedPath, 'commands')).toHaveLength(70);
    expect(s).toMatchObject({ week: 128, health: 30, mind: 100, spirituality: 120, injuryRisk: 2, random: { seed: 'warrior-natural-v042', cursor: 440 }, progression: { sequence: 3, acting: 100 }, character: { gender: 'FEMALE' } });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['HEAVY', null], ['LIGHT', null]]);
    for (const key of warriorLegacyKeys) expect(s[key]).toEqual(raw[key]);
    expect(s.silverKnight.life.armor).toEqual({ id: 'SK3-LIFE-ARMOR', owner: 'PLAYER', formed: true, active: false, integrity: 65, remainingSeconds: 0 });
    expect(Object.keys(s.progression.mastery)).toHaveLength(18); expect(GLORY_INHERITED_ABILITY_IDS).toHaveLength(18);
    expect(s.glory).toEqual(createGloryState()); assertValidSliceState(s);
  });
  it('declares only pre-journal unit cash, AP, calendar, spirit and cursor without editing original history', () => {
    const original = originalSilverFinal(), s = directedInitial3();
    expect(s).toMatchObject({ week: 132, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, spirituality: 31, health: 30 });
    expect(s.random.seed).toBe(original.random.seed); expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor);
    expect(oldWarriorRoots(s)).toEqual(oldWarriorRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.glory.acquisitionJournal).toEqual([]); expect(originalSilverFinal()).toEqual(original);
  });
  it('charges guidance500 and exactly one AP; it creates neither mastery nor a potion', () => {
    const before = directedInitial3(), s = gl(before, { type: 'LEARN_GUIDANCE' }), e = journal(s).at(-1)!;
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 500, before.actionsRemaining - 1]);
    expect(s.progression.mastery).toEqual(before.progression.mastery); expect(s.glory.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect(e.before.cash - e.after.cash).toBe(500); expect(e.before.actions - e.after.actions).toBe(1);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]); rejectGlory(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires twelve full weeks and all three distinct paid preparation tasks', () => {
    let s = gl(originalSilverFinal(), { type: 'LEARN_GUIDANCE' });
    expect(projectGlory(s).digestion).toContain('8/12'); rejectGlory(s, { type: 'PREPARE_PROMOTION' });
    s = taught(); const ap = s.actionsRemaining;
    for (const taskId of GLORY_PREPARATION_IDS) { s = gl(s, { type: 'PREPARE_TASK', taskId }); rejectGlory(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); expect(s.glory.preparations.map(p => p.taskId)).toEqual(['TRACE_ARMOR', 'PLAN_LOAD', 'CHECK_EXIT']);
    rejectGlory(s, { type: 'PREPARE_PROMOTION' }); expect(s.glory.preparedWeek).toBeNull();
  });
  it('five actual AP jobs belong to one independent bottle and still require900 cash', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = gl(s, { type: 'POTION_WORK', bottleId: 'glory-potion-2' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 5); expect(s.cash).toBe(before.cash);
    expect(s.glory.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.glory.bottles[0]!.labourSteps).toBe(0);
    rejectGlory(s, { type: 'POTION_WORK', bottleId: 'glory-potion-2' });
    s = gl(s, { type: 'BUY_POTION', bottleId: 'glory-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.glory.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week }); rejectGlory(s, { type: 'BUY_POTION', bottleId: 'glory-potion-2' });
    expect(validateGloryAcquisitionJournal(s)).toBe(true);
  });
  it('four jobs give no partial credit and cannot discount another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = gl(s, { type: 'POTION_WORK', bottleId: 'glory-potion-1' });
    const cash = s.cash; s = gl(s, { type: 'BUY_POTION', bottleId: 'glory-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = gl(s, { type: 'BUY_POTION', bottleId: 'glory-potion-2' }); expect(s.cash).toBe(cash - 12800);
  });
  it('the independent site preparation spends140+1AP and cancellation refunds nothing', () => {
    const s = prepared('SUCCESS', true), e = journal(s).at(-1)!, before = structuredClone(s);
    expect(e.command).toEqual({ type: 'PREPARE_PROMOTION' }); expect(e.before.cash - e.after.cash).toBe(140); expect(e.before.actions - e.after.actions).toBe(1);
    expect(s.cash).toBe(100000 - 500 - 900 - 140); expect(s.actionsRemaining).toBe(90);
    rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = gl(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([s.cash, s.actionsRemaining, s.health, s.spirituality]);
    expect(left.glory.bottles[0]!.status).toBe('PLAYER'); expect(left.glory.preparedWeek).toBeNull(); expect(s).toEqual(before);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('real current-seed %s gives18→20 without healing, refill, gender swap or old mastery drift', kind => {
    const before = prepared(kind), s = gl(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    const check = resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) });
    expect(e.check).toEqual(check); expect(e.randomBefore).toBe(before.random.cursor); expect(e.randomAfter).toBe(rng.cursor); expect(s.random.cursor).toBe(rng.cursor);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toHaveLength(20);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of GLORY_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const key of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[key]).toBe(before.character.coreStats[key] + 1);
    expect(s.health).toBe(30); expect(s.spirituality).toBe(31); expect(s.mind).toBe(kind === 'GREAT_SUCCESS' ? 92 : 85);
    expect(s.character.gender).toBe('FEMALE'); expect(s.injuries).toEqual(before.injuries); expect(s.injuryRisk).toBe(before.injuryRisk);
    expect(oldWarriorRoots(s)).toEqual(oldWarriorRoots(before)); expect(s.glory.silverKnightActingAtPromotion).toBe(100);
    expect(s.glory.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: s.week, consumedWeek: s.week });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(validateGloryAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectGlory(s, dose);
  });
  it.each([['FAILURE', 15, 75, 30], ['GREAT_FAILURE', 5, 55, 60]] as const)('real %s consumes the original and retains exact health/mind/pollution costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = gl(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 31, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(Math.min(100, before.seer.pollution + pollution));
    expect(s.glory.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind }); expect(s.glory.preparedWeek).toBeNull();
    expect(oldWarriorRoots(s)).toEqual(oldWarriorRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(18);
    expect(validateGloryAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectGlory(s, dose);
  });
  it('requires an actual clinic payment followed by later rests to clear the original injuries', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(!before.careKnown);
    expect(commands.filter(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toHaveLength(1);
    expect(s.cash).toBe(before.cash - 60); expect(s.health).toBe(100); expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(s.random).toEqual(before.random); expect(oldWarriorRoots(s)).toEqual(oldWarriorRoots(before)); expect(s.glory.acquisitionJournal).toEqual(before.glory.acquisitionJournal);
    expect(s.glory.life.journal).toEqual([]); assertValidSliceState(s);
  });
  it('all three genuine failures must precede a request; receipt is blocked in the same week', () => {
    let s = taught('THREE_FAILURES'); rejectGlory(s, { type: 'REQUEST_SUPPLY' }); rejectGlory(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of GLORY_PREPARATION_IDS) s = gl(s, { type: 'PREPARE_TASK', taskId });
    for (const bottleId of ['glory-potion-1', 'glory-potion-2', 'glory-potion-3']) {
      s = recover(s); s = gl(s, { type: 'BUY_POTION', bottleId }); s = gl(s, { type: 'PREPARE_PROMOTION' }); s = gl(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.glory.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    const old = structuredClone(s.glory.bottles), beforeAP = s.actionsRemaining; s = gl(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.glory.bottles).toEqual(old); rejectGlory(s, { type: 'RECEIVE_SUPPLY' });
    // Explicit next-week source-only boundary: tests the delivery gate, not a natural week transition.
    const nextWeek = structuredClone(s); nextWeek.week++; nextWeek.date = addGameDays(nextWeek.date, 7);
    const received = gl(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.glory.bottles.slice(0, 3)).toEqual(old); expect(received.glory.bottles.slice(3).map(b => b.id)).toEqual(['glory-potion-4', 'glory-potion-5', 'glory-potion-6']);
    expect(received.glory.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === received.week && b.acquiredWeek === null && b.labourSteps === 0)).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(validateGloryAcquisitionJournal(received)).toBe(true);
  });
  it.each(['WARRIOR', 'GLADIATOR', 'WEAPONMASTER', 'DAWN_PALADIN', 'GUARDIAN', 'DEMON_HUNTER', 'SILVER_KNIGHT'])('closes old %s acquisition atS2 without mutating any prior root', type => {
    rejectIntent(promoted(), { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
  });
  it.each(['S3', 'S2'] as const)('direct Demon Hunter re-purchase remains closed at%s, before any check or cost', stage => {
    const s = stage === 'S3' ? directedInitial3() : promoted(), before = structuredClone(s), ctx = { note: vi.fn(), roll: vi.fn(), check: vi.fn() };
    const bottle = s.demonHunter.bottles.find(b => b.status === 'SUPPLIER')!; expect(bottle).toBeTruthy();
    expect(() => applyDemonHunterCommand(s, { type: 'BUY_POTION', bottleId: bottle.id }, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled();
  });
  it.each([{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'silver-knight-potion-1' }, { type: 'PREPARE_TASK', taskId: 'CHECK_SOURCE' }, { type: 'LEARN_GUIDANCE', free: true }])('rejects malformed public command%o', c => {
    expect(validateGloryCommand(c)).toBe(false); rejectGlory(prepared(), c);
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['paid cash', s => { journal(s)[0]!.after.cash++; }], ['paid action', s => { journal(s)[0]!.after.actions++; }],
  ['dose source cursor', s => { journal(s).at(-1)!.randomBefore!++; }], ['dose final cursor', s => { journal(s).at(-1)!.randomAfter!++; }],
  ['dose check roll', s => { journal(s).at(-1)!.check!.roll++; }], ['dose check cost', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['dose health refund', s => { journal(s).at(-1)!.after.health++; }], ['dose spirit refill', s => { journal(s).at(-1)!.after.spirituality++; }],
  ['wrong original promotion', s => { journal(s)[0]!.actor.silverKnightPromotionWeek++; }],
  ['extra journal evidence', s => { Object.assign(journal(s)[0]!, { free: true }); }], ['extra budget field', s => { Object.assign(journal(s)[0]!.before, { copiedArmor: true }); }],
  ['missing purchase history', s => { s.glory.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['bottle source', s => { s.glory.bottles[0]!.source = 'free'; }], ['invented current mastery', s => { s.progression.mastery[ARMOR_ID] = 8; }],
  ['historical acting', s => { s.glory.silverKnightActingAtPromotion = 0; }], ['extra stage field', s => { Object.assign(s.glory, { free: true }); }],
];
const ARMOR_ID = GLORY_ABILITY_IDS[0];
describe('Glory strict acquisition evidence', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateGloryState(s)).toBe(true); change(s); expect(validateGloryState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('projected formula remains unknown and public ability list has all20 exact IDs', () => {
    const s = promoted(), before = structuredClone(s), p = projectGlory(s); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.abilities.map(a => a.id)).toEqual([...GLORY_INHERITED_ABILITY_IDS, ...GLORY_ABILITY_IDS]); expect(p.resources!.maxSpirituality).toBe(120);
    expect(p.currentGender).toBe('FEMALE'); p.abilities[0]!.mastery++; p.life.site.playerEnergy--; expect(s).toEqual(before);
  });
});
