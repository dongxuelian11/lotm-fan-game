import { describe, expect, it } from 'vitest';
import { validateDeathConsulState } from '../../src/domain/death-consul/index.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { createPaleEmperorState, paleEmperorInheritedView, paleEmperorAcquisitionBlock, validatePaleEmperorState, validatePaleEmperorAcquisitionJournal, validatePaleEmperorEraJournal, validatePaleEmperorFinancialContinuity, PALE_EMPEROR_INHERITED_ABILITY_IDS } from '../../src/domain/pale-emperor/index.js';
import { PALE_EMPEROR_ABILITY_IDS } from '../../src/domain/pale-emperor/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { originalDeathConsul, taught, prepared, promoted, pe, era, ready, dose, rejectPaleEmperor, rejectIntent, originalDeathRoots } from './pale-emperor-directed-helper.js';
const journal = (s: SliceState) => s.paleEmperor.acquisitionJournal;

describe('Pale Emperor independent original bottles and exact current-era receipts', () => {
  it('starts at living20 with four real untreated wounds and cannot afford care or guidance', () => {
    const s = originalDeathConsul();
    expect(s.paleEmperor).toEqual(createPaleEmperorState());
    rejectPaleEmperor(s, { type: 'LEARN_GUIDANCE' }); rejectPaleEmperor(s, dose);
    rejectIntent(s, { type: 'FERRYMAN', command: { type: 'ERA_CARE' } });
    let n = era(s, 'ERA_WORK'); expect(n).toMatchObject({ cash: 58, actionsRemaining: 0, health: 20 });
    n = era(n, 'ERA_NEXT_WEEK'); expect(n).toMatchObject({ cash: 34, actionsRemaining: 4, health: 20, week: 3291 });
    n = era(era(n, 'ERA_WORK'), 'ERA_WORK'); expect(n.cash).toBe(82);
    n = era(n, 'ERA_CARE'); expect(n).toMatchObject({ cash: 22, actionsRemaining: 1, health: 20, injuryRisk: 6 });
    expect(n.injuries.filter(i => i.severity === 'HEAVY').every(i => i.treatedRevision !== null)).toBe(true);
    n = era(n, 'ERA_REST'); expect(n).toMatchObject({ cash: 14, health: 25, injuryRisk: 6 }); expect(n.injuries).toHaveLength(4);
    expect(originalDeathRoots(n)).toEqual(originalDeathRoots(s)); assertValidSliceState(n);
  }, 180_000);
  it('records actual120p guidance without healing or changing old history', () => {
    const s = taught(), first = journal(s)[0]!;
    expect(first.command).toEqual({ type: 'LEARN_GUIDANCE' }); expect(first.before.cash - first.after.cash).toBe(120);
    expect(first.before.actions - first.after.actions).toBe(1); expect(first.before.health).toBe(20); expect(first.after.health).toBe(20);
    expect(first.before.injuries).toEqual(originalDeathConsul().injuries); expect(s.paleEmperor.sourceEra).toBe('POST_CYCLE');
    expect(s.paleEmperor.bottles.every(b => b.source.includes('FR3-HANNA') && b.stockedWeek === first.week)).toBe(true);
    expect(originalDeathRoots(s)).toEqual(originalDeathRoots(originalDeathConsul())); assertValidSliceState(s);
  }, 180_000);
  it('requires each bottle’s five real jobs,80p purchase and20p current preparation', () => {
    const s = prepared(), j = journal(s);
    const work = j.filter(e => e.command.type === 'POTION_WORK' && e.command.bottleId === dose.bottleId);
    expect(work).toHaveLength(5); for (const e of work) { expect(e.before.actions - e.after.actions).toBe(1); expect(e.before.cash).toBe(e.after.cash); }
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, prepare = j.at(-1)!;
    expect(buy.before.cash - buy.after.cash).toBe(80); expect(buy.before.actions).toBe(buy.after.actions);
    expect(prepare.command.type).toBe('PREPARE_PROMOTION'); expect(prepare.before.cash - prepare.after.cash).toBe(20);
    expect(prepare.before.actions - prepare.after.actions).toBe(1); expect(s.week).toBeGreaterThanOrEqual(3296);
    expect(s.health).toBe(100); expect(s.injuries).toHaveLength(0); expect(s.injuryRisk).toBe(0);
    expect(s.paleEmperor.eraJournal.some(e => e.command.type === 'ERA_CARE')).toBe(true);
    expect(s.paleEmperor.eraJournal.filter(e => e.command.type === 'ERA_REST').length).toBeGreaterThanOrEqual(16);
    expect(validatePaleEmperorAcquisitionJournal(s)).toBe(true); expect(validatePaleEmperorEraJournal(s)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('does not replace actualS2promotion with old generalweek5 and freezes a paid preparation', () => {
    const source = originalDeathConsul(); expect(source.week - source.deathConsul.promotionWeek!).toBe(6); expect(source.week - source.progression.promotionWeek!).toBeGreaterThan(12);
    expect(paleEmperorAcquisitionBlock(source, { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const s = prepared(); rejectIntent(s, { type: 'FERRYMAN', command: { type: 'ERA_WORK' } }); rejectIntent(s, { type: 'FERRYMAN', command: { type: 'ERA_REST' } });
    const cash = s.cash, ap = s.actionsRemaining, n = pe(s, { type: 'LEAVE_PREPARATION' });
    expect(n.cash).toBe(cash); expect(n.actionsRemaining).toBe(ap); expect(n.paleEmperor.bottles[0]!.status).toBe('PLAYER');
    rejectPaleEmperor(n, dose); assertValidSliceState(n);
  }, 240_000);
  it('preserves every failed bottle and exactly19 skills with sevenzero entries on success', () => {
    const s = promoted(), source = originalDeathConsul(), receipt = journal(s).at(-1)!;
    expect(receipt.after.sequence).toBe(1); expect(Object.keys(s.progression.mastery)).toHaveLength(19); expect(s.progression.acting).toBe(0);
    for (const id of PALE_EMPEROR_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    for (const id of PALE_EMPEROR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(7); expect(s.paleEmperor.deathConsulActingAtPromotion).toBe(100);
    for (const e of journal(s).filter(e => e.command.type === 'CONSUME')) {
      expect(e.cursorAfter).toBe(e.cursorBefore + 1); expect(e.before.spirituality).toBe(e.after.spirituality); expect(e.before.injuries).toEqual(e.after.injuries);
      expect(s.paleEmperor.bottles.find(b => 'bottleId' in e.command && b.id === e.command.bottleId)?.status).toBe('CONSUMED');
    }
    for (const stat of ['physique','perception','will','knowledge'] as const) expect(receipt.after.coreStats[stat]).toBe(receipt.before.coreStats[stat] + 1);
    expect(s.random.seed).toBe(source.random.seed); expect(s.combatHistory).toEqual(source.combatHistory); expect(originalDeathRoots(s)).toEqual(originalDeathRoots(source));
    rejectPaleEmperor(s, dose); assertValidSliceState(s);
  }, 300_000);
  it('requires exhausted failed stock and a paid nextactualweek for any new bottles', () => {
    const start = taught(); rejectPaleEmperor(start, { type: 'REQUEST_SUPPLY' }); rejectPaleEmperor(start, { type: 'RECEIVE_SUPPLY' });
    const s = promoted();
    for (const e of journal(s).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(e.before.cash - e.after.cash).toBe(20); expect(e.before.actions - e.after.actions).toBe(1);
      const next = journal(s).find(v => v.command.type === 'RECEIVE_SUPPLY' && v.revision > e.revision)!;
      expect(next.week).toBeGreaterThan(e.week); expect(next.before).toEqual(next.after);
    }
    expect(new Set(s.paleEmperor.bottles.map(b => b.id)).size).toBe(s.paleEmperor.bottles.length);
  }, 300_000);
});
describe('Pale Emperor source, deterministic receipts and live financial continuity', () => {
  it('returns the exact paid-guidanceS2 checkpoint with originalH20 wounds', () => {
    const s = promoted(), before = structuredClone(s), v = paleEmperorInheritedView(s), source = s.paleEmperor.sourceScene!;
    expect(v).toMatchObject({ health: 20, injuryRisk: 6, progression: { sequence: 2, acting: 100 } }); expect(v.injuries).toEqual(originalDeathConsul().injuries);
    expect(v.character).toEqual(source.character); expect(v.random).toEqual(source.random); expect(v.ferryman.era).toEqual(source.budget.era);
    expect(v.paleEmperor).toEqual(createPaleEmperorState()); expect(s).toEqual(before); expect(validateDeathConsulState(v)).toBe(true);
  }, 300_000);
  it('keeps actual work and recovery available afterS1 and rejects unpaid cash or fabricated era receipts', () => {
    const before = ready(promoted(), { ap: 1 }), after = era(before, 'ERA_WORK');
    expect(after.cash).toBe(before.cash + 24); expect(after.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(validatePaleEmperorFinancialContinuity(after)).toBe(true); assertValidSliceState(after);
    for (const mutate of [
      (s: SliceState) => { s.cash++; },
      (s: SliceState) => { s.paleEmperor.eraJournal.at(-1)!.after.cash++; },
      (s: SliceState) => { s.paleEmperor.eraJournal.at(-1)!.before.health++; },
      (s: SliceState) => { s.paleEmperor.eraJournal.pop(); },
      (s: SliceState) => { s.ferryman.era.income += 24; s.ferryman.era.works++; s.cash += 24; },
      (s: SliceState) => { journal(s)[0]!.after.cash++; },
      (s: SliceState) => { journal(s)[1]!.revision = journal(s)[0]!.revision; },
      (s: SliceState) => { s.paleEmperor.bottles[0]!.id = 'pale-emperor-potion-2'; },
      (s: SliceState) => { s.paleEmperor.sourceEra = 'ORIGINAL'; },
    ]) { const s = structuredClone(after); mutate(s); expect(validatePaleEmperorState(s), mutate.toString()).toBe(false); }
  }, 300_000);
  it('rejects altered random draws, source injuries, identities and restored original resources', () => {
    for (const mutate of [
      (s: SliceState) => { s.character.gender = 'MALE'; }, (s: SliceState) => { s.character.name = '另一个人'; },
      (s: SliceState) => { s.paleEmperor.sourceScene!.budget.injuries.pop(); },
      (s: SliceState) => { s.deathConsul.life.site.operatorEnergy = 100; }, (s: SliceState) => { s.deathConsul.life.site.material.remaining = 1; },
      (s: SliceState) => { s.deathConsul.life.site.door.operations = 0; }, (s: SliceState) => { s.deathConsul.encounter.enemyHealth = 100; },
      (s: SliceState) => { s.undying.encounter.enemy.health = 0; }, (s: SliceState) => { s.longChapter.releasedSpiritDate = null; },
      (s: SliceState) => { journal(s).at(-1)!.randomAfter!++; },
      (s: SliceState) => { const c = journal(s).at(-1)!.check!; c.roll = c.roll === 1 ? 2 : 1; },
    ]) { const s = promoted(); mutate(s); expect(validatePaleEmperorState(s), mutate.toString()).toBe(false); }
  }, 300_000);
});
