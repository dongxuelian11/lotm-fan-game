import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { CALAMITY_DEMONESS_INHERITED_ABILITY_IDS, createCalamityDemonessState, projectCalamityDemoness, validateCalamityDemonessAcquisitionJournal, validateCalamityDemonessCommand, validateCalamityDemonessState } from '../../src/domain/calamity-demoness/index.js';
import { CALAMITY_DEMONESS_ABILITY_IDS, CALAMITY_DEMONESS_PREPARATION_IDS } from '../../src/domain/calamity-demoness/types.js';
import { directedInitial3, dose, cd, oldDemonessRoots, originalUnagingFinal, prepared, promoted, recover, rejectCalamity, rejectIntent, unagingNaturalPath, taught, demonessLegacyKeys } from './calamity-demoness-directed-helper.js';

const journal = (s: SliceState) => s.calamityDemoness.acquisitionJournal;
describe('CalamityDemoness acquisition from the original487-command natural Unaging Demoness source', () => {
  it('retains the exact487-command source, seven original roots, one untreated HEAVY and both original mirrors', () => {
    const s = originalUnagingFinal(), raw = readObjectEntry<SliceState>(unagingNaturalPath, 'final');
    expect(readObjectEntry<{ kind: string; newRandomChanges: boolean }>(unagingNaturalPath, 'provenance')).toMatchObject({ kind: 'SAME_SEED_PUBLIC_NATURAL_PREFIX', newRandomChanges: false });
    expect(readObjectEntry<SliceIntent[]>(unagingNaturalPath, 'commands')).toHaveLength(487);
    expect(s).toMatchObject({ week: 124, health: 70, mind: 100, spirituality: 111, cash: 520, actionsRemaining: 3, injuryRisk: 0, random: { seed: 'assassin-natural-v045', cursor: 177 }, progression: { sequence: 3, acting: 100 }, character: { gender: 'FEMALE' } });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null]]);
    for (const key of demonessLegacyKeys) expect(s[key]).toEqual(raw[key]);
    expect(s.unagingDemoness.life.mirrorA).toMatchObject({ id: 'UD3-MIRROR-A', owner: 'UD3-VERA', intact: true }); expect(s.unagingDemoness.life.mirrorB).toMatchObject({ id: 'UD3-MIRROR-B', intact: true });
    expect(s.unagingDemoness.encounter).toMatchObject({ targetId: 'UD3-CORBIN', enemyStatus: 'SURRENDERED', enemyHealth: 70 });
    expect(Object.keys(s.progression.mastery)).toHaveLength(16); expect(CALAMITY_DEMONESS_INHERITED_ABILITY_IDS).toHaveLength(16);
    expect(s.calamityDemoness).toEqual(createCalamityDemonessState()); assertValidSliceState(s);
  });
  it('declares only pre-journal unit cash, AP, calendar, spirit and cursor without editing original history', () => {
    const original = originalUnagingFinal(), s = directedInitial3();
    expect(s).toMatchObject({ week: 128, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, spirituality: 31, health: 70 });
    expect(s.random.seed).toBe(original.random.seed); expect(s.random.cursor).toBeGreaterThanOrEqual(original.random.cursor);
    expect(oldDemonessRoots(s)).toEqual(oldDemonessRoots(original)); expect(s.injuries).toEqual(original.injuries);
    expect(s.calamityDemoness.acquisitionJournal).toEqual([]); expect(originalUnagingFinal()).toEqual(original);
  });
  it('keeps new states independent, hides acquisition before realS3 and does not exposeS1', () => {
    const s = createSliceRun('calamity-hidden', sliceDefaultCreationSelection, 'calamity-hidden');
    expect(projectCalamityDemoness(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectCalamity(s, { type: 'LEARN_GUIDANCE' }); const a = createCalamityDemonessState(); a.bottles[0]!.labourSteps = 5; expect(s.calamityDemoness.bottles[0]!.labourSteps).toBe(0);
    for (const sequence of [1, 0] as const) { const t = originalUnagingFinal(); t.progression.sequence = sequence; expect(projectCalamityDemoness(t).discovered).toBe(false); rejectCalamity(t, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects illegal historical promotion/material/mastery sources before accepting any new cost', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.unagingDemoness.promotionWeek = null; }, s => { s.unagingDemoness.despairActingAtPromotion = 99; },
      s => { s.character.gender = 'MALE'; }, s => { s.witch.previousGender = null; }, s => { s.progression.pathwayId = 'warrior'; },
      s => { delete s.progression.mastery['assassin.s3.mirror-passage']; }, s => { s.progression.mastery['warrior.s2.armor-temper'] = 0; },
      s => { s.assassin.bottles.find(b => b.status === 'CONSUMED' && (b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS'))!.acquiredWeek = s.week + 1; },
      s => { const b = s.witch.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!; b.inputIds.pop(); },
    ];
    for (const change of changes) { const s = directedInitial3(); change(s); rejectCalamity(s, { type: 'LEARN_GUIDANCE' }); }
  });
  it('charges guidance500 and exactly one AP; it creates neither mastery nor a potion', () => {
    const before = directedInitial3(), s = cd(before, { type: 'LEARN_GUIDANCE' }), e = journal(s).at(-1)!;
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 500, before.actionsRemaining - 1]);
    expect(s.progression.mastery).toEqual(before.progression.mastery); expect(s.calamityDemoness.bottles.every(b => b.status === 'SUPPLIER')).toBe(true);
    expect(e.before.cash - e.after.cash).toBe(500); expect(e.before.actions - e.after.actions).toBe(1);
    expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]); rejectCalamity(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires twelve full weeks and all three distinct paid preparation tasks', () => {
    let s = cd(originalUnagingFinal(), { type: 'LEARN_GUIDANCE' });
    expect(projectCalamityDemoness(s).digestion).toContain('8/12'); rejectCalamity(s, { type: 'PREPARE_PROMOTION' });
    s = taught(); const ap = s.actionsRemaining;
    for (const taskId of CALAMITY_DEMONESS_PREPARATION_IDS) { s = cd(s, { type: 'PREPARE_TASK', taskId }); rejectCalamity(s, { type: 'PREPARE_TASK', taskId }); }
    expect(s.actionsRemaining).toBe(ap - 3); expect(s.calamityDemoness.preparations.map(p => p.taskId)).toEqual(['TRACE_ORIGINAL_MIRRORS', 'PLAN_CONTAINMENT', 'CHECK_RETURN']);
    rejectCalamity(s, { type: 'PREPARE_PROMOTION' }); expect(s.calamityDemoness.preparedWeek).toBeNull();
  });
  it('five actual AP jobs belong to one independent bottle and still require900 cash', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = cd(s, { type: 'POTION_WORK', bottleId: 'calamity-demoness-potion-2' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 5); expect(s.cash).toBe(before.cash);
    expect(s.calamityDemoness.bottles[1]).toMatchObject({ labourSteps: 5, status: 'SUPPLIER' }); expect(s.calamityDemoness.bottles[0]!.labourSteps).toBe(0);
    rejectCalamity(s, { type: 'POTION_WORK', bottleId: 'calamity-demoness-potion-2' });
    s = cd(s, { type: 'BUY_POTION', bottleId: 'calamity-demoness-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    expect(s.calamityDemoness.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week }); rejectCalamity(s, { type: 'BUY_POTION', bottleId: 'calamity-demoness-potion-2' });
    expect(validateCalamityDemonessAcquisitionJournal(s)).toBe(true);
  });
  it('four jobs give no partial credit and cannot discount another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = cd(s, { type: 'POTION_WORK', bottleId: 'calamity-demoness-potion-1' });
    const cash = s.cash; s = cd(s, { type: 'BUY_POTION', bottleId: 'calamity-demoness-potion-1' }); expect(s.cash).toBe(cash - 6400);
    s = cd(s, { type: 'BUY_POTION', bottleId: 'calamity-demoness-potion-2' }); expect(s.cash).toBe(cash - 12800);
  });
  it('the independent site preparation spends140+1AP and cancellation refunds nothing', () => {
    const s = prepared('SUCCESS', true), e = journal(s).at(-1)!, before = structuredClone(s);
    expect(e.command).toEqual({ type: 'PREPARE_PROMOTION' }); expect(e.before.cash - e.after.cash).toBe(140); expect(e.before.actions - e.after.actions).toBe(1);
    expect(s.cash).toBe(100000 - 500 - 900 - 140); expect(s.actionsRemaining).toBe(90);
    rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = cd(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining, left.health, left.spirituality]).toEqual([s.cash, s.actionsRemaining, s.health, s.spirituality]);
    expect(left.calamityDemoness.bottles[0]!.status).toBe('PLAYER'); expect(left.calamityDemoness.preparedWeek).toBeNull(); expect(s).toEqual(before);
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('real current-seed %s gives16→18 without healing, refill, gender swap or old mastery drift', kind => {
    const before = prepared(kind), s = cd(before, dose), e = journal(s).at(-1)!;
    const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
    const check = resolveNormalCheck({ ability: 'will', baseAbility: before.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) });
    expect(e.check).toEqual(check); expect(e.randomBefore).toBe(before.random.cursor); expect(e.randomAfter).toBe(rng.cursor); expect(s.random.cursor).toBe(rng.cursor);
    expect(s.progression.sequence).toBe(2); expect(Object.keys(s.progression.mastery)).toHaveLength(18);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const id of CALAMITY_DEMONESS_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const key of ['physique', 'perception', 'knowledge', 'will'] as const) expect(s.character.coreStats[key]).toBe(before.character.coreStats[key] + 1);
    expect(s.health).toBe(70); expect(s.spirituality).toBe(31); expect(s.mind).toBe(kind === 'GREAT_SUCCESS' ? 92 : 85);
    expect(s.character.gender).toBe('FEMALE'); expect(s.injuries).toEqual(before.injuries); expect(s.injuryRisk).toBe(before.injuryRisk);
    expect(oldDemonessRoots(s)).toEqual(oldDemonessRoots(before)); expect(s.calamityDemoness.unagingDemonessActingAtPromotion).toBe(100);
    expect(s.calamityDemoness.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, preparationWeek: s.week, consumedWeek: s.week });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining, before.cash]); expect(validateCalamityDemonessAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectCalamity(s, dose);
  });
  it.each([['FAILURE', 55, 75, 30], ['GREAT_FAILURE', 45, 55, 60]] as const)('real %s consumes the original and retains exact health/mind/pollution costs', (kind, health, mind, pollution) => {
    const before = prepared(kind), s = cd(before, dose);
    expect(s).toMatchObject({ health, mind, spirituality: 31, progression: { sequence: 3, acting: 100 } }); expect(s.seer.pollution).toBe(Math.min(100, before.seer.pollution + pollution));
    expect(s.calamityDemoness.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind }); expect(s.calamityDemoness.preparedWeek).toBeNull();
    expect(oldDemonessRoots(s)).toEqual(oldDemonessRoots(before)); expect(s.injuries).toEqual(before.injuries); expect(Object.keys(s.progression.mastery)).toHaveLength(16);
    expect(validateCalamityDemonessAcquisitionJournal(s)).toBe(true); assertValidSliceState(s); rejectCalamity(s, dose);
  });
  it('requires an actual clinic payment followed by later rests to clear the original injuries', () => {
    const before = promoted(), commands: SliceIntent[] = [], s = recover(before, commands);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(!before.careKnown);
    expect(commands.filter(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toHaveLength(1);
    expect(s.cash).toBe(before.cash - 60); expect(s.health).toBe(100); expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(s.random).toEqual(before.random); expect(oldDemonessRoots(s)).toEqual(oldDemonessRoots(before)); expect(s.calamityDemoness.acquisitionJournal).toEqual(before.calamityDemoness.acquisitionJournal);
    expect(s.calamityDemoness.life.journal).toEqual([]); assertValidSliceState(s);
  });
  it('all three genuine failures must precede a request; receipt is blocked in the same week', () => {
    let s = taught('THREE_FAILURES'); rejectCalamity(s, { type: 'REQUEST_SUPPLY' }); rejectCalamity(s, { type: 'RECEIVE_SUPPLY' });
    for (const taskId of CALAMITY_DEMONESS_PREPARATION_IDS) s = cd(s, { type: 'PREPARE_TASK', taskId });
    for (const bottleId of ['calamity-demoness-potion-1', 'calamity-demoness-potion-2', 'calamity-demoness-potion-3']) {
      s = recover(s); s = cd(s, { type: 'BUY_POTION', bottleId }); s = cd(s, { type: 'PREPARE_PROMOTION' }); s = cd(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.calamityDemoness.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    const old = structuredClone(s.calamityDemoness.bottles), beforeAP = s.actionsRemaining; s = cd(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(beforeAP - 1); expect(s.calamityDemoness.bottles).toEqual(old); rejectCalamity(s, { type: 'RECEIVE_SUPPLY' });
    // Explicit next-week source-only boundary: tests the delivery gate, not a natural week transition.
    const nextWeek = structuredClone(s); nextWeek.week++; nextWeek.date = addGameDays(nextWeek.date, 7);
    const received = cd(nextWeek, { type: 'RECEIVE_SUPPLY' });
    expect(received.calamityDemoness.bottles.slice(0, 3)).toEqual(old); expect(received.calamityDemoness.bottles.slice(3).map(b => b.id)).toEqual(['calamity-demoness-potion-4', 'calamity-demoness-potion-5', 'calamity-demoness-potion-6']);
    expect(received.calamityDemoness.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === received.week && b.acquiredWeek === null && b.labourSteps === 0)).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([nextWeek.cash, nextWeek.actionsRemaining]); expect(validateCalamityDemonessAcquisitionJournal(received)).toBe(true);
  });
  it.each(['ASSASSIN', 'INSTIGATOR', 'WITCH', 'PLEASURE', 'PAIN', 'DESPAIR', 'UNAGING_DEMONESS'])('closes old %s acquisition atS2 without mutating any prior root', type => {
    rejectIntent(promoted(), { type, command: { type: type === 'WITCH' || type === 'PLEASURE' ? 'LEARN_FORMULA' : 'LEARN_GUIDANCE' } } as SliceIntent);
  });
  it.each([{ ...dose, confirmed: false }, { ...dose, free: true }, { type: 'BUY_POTION', bottleId: 'unaging-demoness-potion-1' }, { type: 'PREPARE_TASK', taskId: 'CHECK_SOURCE' }, { type: 'LEARN_GUIDANCE', free: true }])('rejects malformed public command%o', c => {
    expect(validateCalamityDemonessCommand(c)).toBe(false); rejectCalamity(prepared(), c);
  });
});

const acquisitionMutations: [string, (s: SliceState) => void][] = [
  ['paid cash', s => { journal(s)[0]!.after.cash++; }], ['paid action', s => { journal(s)[0]!.after.actions++; }],
  ['dose source cursor', s => { journal(s).at(-1)!.randomBefore!++; }], ['dose final cursor', s => { journal(s).at(-1)!.randomAfter!++; }],
  ['dose check roll', s => { journal(s).at(-1)!.check!.roll++; }], ['dose check cost', s => { journal(s).at(-1)!.check!.difficulty++; }],
  ['dose health refund', s => { journal(s).at(-1)!.after.health++; }], ['dose spirit refill', s => { journal(s).at(-1)!.after.spirituality++; }],
  ['wrong original promotion', s => { journal(s)[0]!.actor.unagingDemonessPromotionWeek++; }],
  ['extra journal evidence', s => { Object.assign(journal(s)[0]!, { free: true }); }], ['extra budget field', s => { Object.assign(journal(s)[0]!.before, { copiedMirror: true }); }],
  ['missing purchase history', s => { s.calamityDemoness.acquisitionJournal = journal(s).filter(e => e.command.type !== 'BUY_POTION'); }],
  ['bottle source', s => { s.calamityDemoness.bottles[0]!.source = 'free'; }], ['invented current mastery', s => { s.progression.mastery[SCREEN_ID] = 8; }],
  ['historical acting', s => { s.calamityDemoness.unagingDemonessActingAtPromotion = 0; }], ['extra stage field', s => { Object.assign(s.calamityDemoness, { free: true }); }],
];
const SCREEN_ID = CALAMITY_DEMONESS_ABILITY_IDS[0];
describe('CalamityDemoness strict acquisition evidence', () => {
  it.each(acquisitionMutations)('rejects %s', (_name, change) => {
    const s = promoted(); expect(validateCalamityDemonessState(s)).toBe(true); change(s); expect(validateCalamityDemonessState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('projected formula remains unknown and public ability list has all18 exact IDs', () => {
    const s = promoted(), before = structuredClone(s), p = projectCalamityDemoness(s); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.abilities.map(a => a.id)).toEqual([...CALAMITY_DEMONESS_INHERITED_ABILITY_IDS, ...CALAMITY_DEMONESS_ABILITY_IDS]); expect(p.resources!.maxSpirituality).toBe(120);
    expect(p.currentGender).toBe('FEMALE'); expect(new Set(p.abilities.map(a => a.id)).size).toBe(18); expect(JSON.stringify(p.abilities)).not.toMatch(/候选|原文未核|原创G/); p.abilities[0]!.mastery++; p.life.site.playerEnergy--; expect(s).toEqual(before);
  });
});
