import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyImperativeMageCommand, createImperativeMageState } from '../../src/domain/imperative-mage/index.js';
import { IMPERATIVE_MAGE_ABILITY_IDS } from '../../src/domain/imperative-mage/types.js';
import {
  applyImperativeMageActivity, createImperativeMageLifeState, hasImperativeMageLifeLock,
  projectImperativeMageLife, imperativeMageActivityReason, imperativeMageLifeActions,
  validateImperativeMageActivityCommand, validateImperativeMageLife,
  IMPERATIVE_MAGE_CASE_IDS, IMPERATIVE_MAGE_LIFE_ENVIRONMENT,
  type ImperativeMageActivityCommand, type ImperativeMageCaseId, type ImperativeMageLifeAbilityId,
} from '../../src/domain/imperative-mage/life.js';

// Directed unit fixtures preserve the real old history. Fixed rolls are not natural-play claims.
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: ImperativeMageLifeAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function previous() {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/punishment-knight-v01150/natural.json', 'utf8')).final);
  s.imperativeMage = createImperativeMageState(); setWeek(s, Math.max(s.week, s.punishmentKnight.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 40000; s.health = 100; s.mind = 100; s.spirituality = 100;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function promoted() {
  const s = previous(), { ctx } = context(s);
  applyImperativeMageCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyImperativeMageCommand(s, { type: 'BUY_POTION', bottleId: 'imperative-mage-potion-1' }, ctx);
  applyImperativeMageCommand(s, { type: 'CONSUME', bottleId: 'imperative-mage-potion-1', confirmed: true }, ctx);
  expect(validateImperativeMageLife(s)).toBe(true); return s;
}
function act(s: SliceState, command: ImperativeMageActivityCommand, roll = 1) {
  const c = context(s, roll); applyImperativeMageActivity(s, command, c.ctx, c.award);
  expect(validateImperativeMageLife(s), `invalid after ${JSON.stringify(command)}`).toBe(true); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyImperativeMageActivity(s, command as ImperativeMageActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: ImperativeMageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.imperativeMage.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function close(s: SliceState, caseId: ImperativeMageCaseId, checkLight = true) {
  const a = s.imperativeMage.life.cases[caseId].attempts.at(-1)!;
  if (!a.cleaned) {
    if (caseId === 'willing-attention') act(s, { type: 'RELEASE_ATTENTION', caseId });
    if (caseId === 'one-borrowed-light') { if (checkLight && a.lightCheck === 'NONE') act(s, { type: 'CHECK_LIGHT', caseId }); act(s, { type: 'RESTORE_LIGHT', caseId }); }
    if (caseId === 'equal-line') act(s, { type: 'REMOVE_RULE', caseId });
  }
  return act(s, { type: 'CLOSE', caseId });
}
function finish(s: SliceState, caseId: ImperativeMageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); close(s, caseId); return act(s, { type: 'REPORT', caseId });
}
function ready(caseId: ImperativeMageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const s = promoted(); for (const id of IMPERATIVE_MAGE_CASE_IDS) { if (id === caseId) break; finish(s, id); }
  begin(s, caseId, method); return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; s.mind = 100; s.spirituality = 100; }
function originals(s: SliceState) { return structuredClone([s.arbiter, s.sheriff, s.interrogator, s.judge, s.punishmentKnight, s.character, s.combatHistory, s.world, s.town]); }
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');

describe('Imperative Mage finite life: original people, actual FLASH resources and equal rules', () => {
  it('is dormant before promotion and exposes three source-bounded finite G cases without changing prior domains', () => {
    const old = previous(); expect(old.imperativeMage.life).toEqual(createImperativeMageLifeState()); expect(validateImperativeMageLife(old)).toBe(true);
    expect(imperativeMageLifeActions(old)).toEqual([]); expect(projectImperativeMageLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    const s = promoted(), before = structuredClone(s), p = projectImperativeMageLife(s);
    expect(p.cases.map(x => x.id)).toEqual([...IMPERATIVE_MAGE_CASE_IDS]); expect(p.cases.every(x => x.observations.length === 0)).toBe(true); expect(s).toEqual(before);
    for (const phrase of ['原创G', '完整配方与晋升仪式仍未知', '准备不施法', '旧仲裁人', '第三案继承原法官禁令ID']) expect(IMPERATIVE_MAGE_LIFE_ENVIRONMENT).toContain(phrase);
    expect(s.imperativeMage.life.partner).toMatchObject({ id: 'IM4-ELDEN-VALE', adult: true, sequence: 8, profession: '戏法大师', knownAbilities: ['FLASH'], spirituality: 12, abilityAvailable: true });
  });

  it('completes ordinary practices and reflection in thirteen actions, with real partner expenditure and no ability rewards', () => {
    const s = promoted(), old = originals(s), ap = s.actionsRemaining, spirit = s.spirituality, mastery = structuredClone(s.progression.mastery);
    for (const id of IMPERATIVE_MAGE_CASE_IDS) expect(finish(s, id).award).not.toHaveBeenCalled(); act(s, { type: 'REFLECT' });
    expect(ap - s.actionsRemaining).toBe(13); expect(s.spirituality).toBe(spirit); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect(s.imperativeMage.life.partner).toMatchObject({ spirituality: 6, abilityAvailable: true, knownAbilities: ['FLASH'], confirmations: 1 });
    expect(s.imperativeMage.life.light).toMatchObject({ cardId: 'IM4-CARD-1', hoodId: 'IM4-HOOD-1', holder: 'GUIDE', positionMetres: 0, distanceMetres: 2, elapsedSeconds: 0 });
    expect(s.imperativeMage.life.line).toMatchObject({ rule: 'NONE', tokenHolder: 'GUIDE', playerDistanceMetres: 4, partnerDistanceMetres: 0, appliesTo: 'BOTH' });
    expect(originals(s)).toEqual(old); expect(hasImperativeMageLifeLock(s)).toBe(false);
    reject(s, { type: 'REPORT', caseId: 'one-borrowed-light' }); reject(s, { type: 'REFLECT' });
  });

  it('pays eleven player spirituality and awards only the two new IDs plus the inherited original prohibition after complete reports', () => {
    const s = promoted(), old = originals(s), spirit = s.spirituality, inherited = s.progression.mastery['justiciar.s6.prohibition']!;
    const ids: ImperativeMageLifeAbilityId[] = ['justiciar.s4.intimidation', 'justiciar.s4.deprivation', 'justiciar.s6.prohibition'];
    for (const [index, id] of IMPERATIVE_MAGE_CASE_IDS.entries()) {
      begin(s, id, 'ABILITY'); const c = act(s, { type: 'PERFORM', caseId: id });
      expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', id === 'equal-line' ? 14 : 18); expect(c.award).not.toHaveBeenCalled();
      reject(s, { type: 'REPORT', caseId: id }); close(s, id); expect(act(s, { type: 'REPORT', caseId: id }).award).toHaveBeenCalledExactlyOnceWith(ids[index], 8);
    }
    act(s, { type: 'REFLECT' }); expect(s.spirituality).toBe(spirit - 11); expect(s.imperativeMage.life.partner.spirituality).toBe(8);
    expect(IMPERATIVE_MAGE_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]); expect(s.progression.mastery['justiciar.s6.prohibition']).toBe(inherited + 8);
    expect(originals(s)).toEqual(old); expect(s.imperativeMage.life.attention.elapsedSeconds).toBe(3); expect(s.imperativeMage.life.light.elapsedSeconds).toBe(10);
  });

  it('preparation does not open a contact lock, persists over a real week, and can be cancelled at zero action or spirituality', () => {
    const s = ready('willing-attention'), before = originals(s), spirit = s.spirituality;
    expect(hasImperativeMageLifeLock(s)).toBe(false); nextWeek(s);
    expect(notes(act(s, { type: 'PERFORM', caseId: 'willing-attention' }))).toContain('重新确认原阿伦'); close(s, 'willing-attention');
    expect(originals(s)).toEqual(before); expect(s.spirituality).toBe(96); expect(spirit).toBeGreaterThanOrEqual(0);
    const cancelled = ready('one-borrowed-light'); cancelled.actionsRemaining = 0; cancelled.spirituality = 0;
    expect(hasImperativeMageLifeLock(cancelled)).toBe(false); reject(cancelled, { type: 'PERFORM', caseId: 'one-borrowed-light' });
    act(cancelled, { type: 'WITHDRAW', caseId: 'one-borrowed-light' });
    expect(cancelled.imperativeMage.life.partner).toMatchObject({ spirituality: 12, consented: false }); expect(cancelled.imperativeMage.life.light.holder).toBe('GUIDE');
    expect(cancelled.imperativeMage.life.cases['one-borrowed-light']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, attempts: [] });
  });

  it('withdraws new consent before implementation and retains the actual three-second residual after implementation', () => {
    const before = ready('willing-attention'), spirit = before.spirituality; before.actionsRemaining = 0;
    act(before, { type: 'WITHDRAW_CONSENT', caseId: 'willing-attention' });
    expect(before.imperativeMage.life.attention).toMatchObject({ consented: false, effect: 'NONE', cancelledConsents: 1, consentWithdrawals: 1 });
    expect(before.spirituality).toBe(spirit); reject(before, { type: 'PERFORM', caseId: 'willing-attention' });
    const s = ready('willing-attention'), old = originals(s); s.actionsRemaining = 1; s.spirituality = 4;
    act(s, { type: 'PERFORM', caseId: 'willing-attention' }); act(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-attention' });
    expect(s.imperativeMage.life.attention).toMatchObject({ consented: false, effect: 'ATTENTION_HELD', remainingSeconds: 3 });
    reject(s, { type: 'CLOSE', caseId: 'willing-attention' }); expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    s.mind = 0; act(s, { type: 'RELEASE_ATTENTION', caseId: 'willing-attention' }); act(s, { type: 'CLOSE', caseId: 'willing-attention' });
    expect(s.imperativeMage.life.attention).toMatchObject({ person: 'ORIGINAL_ARLEN', effect: 'NONE', remainingSeconds: 0, elapsedSeconds: 3, confirmations: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old); expect(hasImperativeMageLifeLock(s)).toBe(false);
  });

  it('resisted attention retains its cost with zero fabricated duration and retries only next real week', () => {
    const s = ready('willing-attention'), spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'willing-attention' }, 100); expect(s.spirituality).toBe(spirit - 4);
    expect(s.imperativeMage.life.attention).toMatchObject({ effect: 'NONE', remainingSeconds: 0 });
    act(s, { type: 'CLOSE', caseId: 'willing-attention' }); reject(s, { type: 'REPORT', caseId: 'willing-attention' });
    reject(s, { type: 'PREPARE', caseId: 'willing-attention', method: 'ABILITY' }); nextWeek(s); finish(s, 'willing-attention', 'ABILITY');
    expect(s.imperativeMage.life.cases['willing-attention'].attempts.map(a => [a.success, a.spiritualityCost, a.elapsedSeconds])).toEqual([[false, 4, 0], [true, 4, 3]]);
  });

  it('temporarily blocks an actual known FLASH, restores that same ability after ten seconds, and takes the same props back over two metres', () => {
    const s = ready('one-borrowed-light'), old = originals(s); s.actionsRemaining = 1; s.spirituality = 4;
    act(s, { type: 'PERFORM', caseId: 'one-borrowed-light' });
    expect(s.imperativeMage.life.partner).toMatchObject({ spirituality: 10, abilityAvailable: false, knownAbilities: ['FLASH'] });
    expect(s.imperativeMage.life.light).toMatchObject({ remainingSeconds: 10, holder: 'TABLE', positionMetres: 1 });
    expect(s.imperativeMage.life.cases['one-borrowed-light'].attempts[0]).toMatchObject({ baseline: 'LIT', partnerSpiritualityBefore: 12, partnerSpiritualityCost: 2 });
    act(s, { type: 'CHECK_LIGHT', caseId: 'one-borrowed-light' }); reject(s, { type: 'CHECK_LIGHT', caseId: 'one-borrowed-light' });
    expect(s.imperativeMage.life.partner.spirituality).toBe(10); expect(s.imperativeMage.life.cases['one-borrowed-light'].attempts[0]?.lightCheck).toBe('BLOCKED');
    reject(s, { type: 'CLOSE', caseId: 'one-borrowed-light' }); s.mind = 0; act(s, { type: 'RESTORE_LIGHT', caseId: 'one-borrowed-light' });
    expect(s.imperativeMage.life.partner).toMatchObject({ spirituality: 8, abilityAvailable: true, knownAbilities: ['FLASH'] });
    expect(s.imperativeMage.life.light).toMatchObject({ remainingSeconds: 0, elapsedSeconds: 10, holder: 'TABLE' });
    reject(s, { type: 'RESTORE_LIGHT', caseId: 'one-borrowed-light' }); act(s, { type: 'CLOSE', caseId: 'one-borrowed-light' });
    expect(s.imperativeMage.life.cases['one-borrowed-light'].attempts[0]).toMatchObject({ restoration: 'LIT', partnerSpiritualityCost: 4, distanceMetres: 2, closed: true });
    expect(s.imperativeMage.life.light).toMatchObject({ holder: 'GUIDE', positionMetres: 0, handovers: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old);
    expect(Object.keys(s.progression.mastery).some(id => /FLASH/.test(id))).toBe(false);
  });

  it('lets missing BLOCKED evidence safely close without a reward, preserving ability recovery and permitting next-week retry', () => {
    const s = ready('one-borrowed-light'); act(s, { type: 'PERFORM', caseId: 'one-borrowed-light' }); close(s, 'one-borrowed-light', false);
    expect(s.imperativeMage.life.partner).toMatchObject({ abilityAvailable: true, spirituality: 8 });
    expect(s.imperativeMage.life.cases['one-borrowed-light']).toMatchObject({ status: 'OBSERVED', method: null, closes: 1 });
    reject(s, { type: 'REPORT', caseId: 'one-borrowed-light' }); reject(s, { type: 'CHECK_LIGHT', caseId: 'one-borrowed-light' });
    nextWeek(s); finish(s, 'one-borrowed-light', 'ABILITY'); expect(s.imperativeMage.life.partner.spirituality).toBe(4);
    expect(s.imperativeMage.life.light).toMatchObject({ elapsedSeconds: 20, distanceMetres: 4, handovers: 2 });
  });

  it('retains failed FLASH expenditure, does not refill on retry, and requires cancellation before a once-per-new-week six-hour partner rest', () => {
    const s = ready('one-borrowed-light'), spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'one-borrowed-light' }, 100); close(s, 'one-borrowed-light');
    expect(s.imperativeMage.life.partner).toMatchObject({ spirituality: 6, abilityAvailable: true }); expect(s.spirituality).toBe(spirit - 4);
    expect(s.imperativeMage.life.cases['one-borrowed-light'].attempts[0]).toMatchObject({ outcome: 'STILL_AVAILABLE', lightCheck: 'LIT', restoration: 'LIT', partnerSpiritualityCost: 6, elapsedSeconds: 0 });
    reject(s, { type: 'PARTNER_REST' }); nextWeek(s); begin(s, 'one-borrowed-light', 'ABILITY');
    act(s, { type: 'PERFORM', caseId: 'one-borrowed-light' }, 100); close(s, 'one-borrowed-light'); expect(s.imperativeMage.life.partner.spirituality).toBe(0);
    nextWeek(s); begin(s, 'one-borrowed-light', 'ABILITY'); expect(hasImperativeMageLifeLock(s)).toBe(false);
    expect(imperativeMageActivityReason(s, { type: 'PERFORM', caseId: 'one-borrowed-light' })).toContain('至少6灵性');
    reject(s, { type: 'PERFORM', caseId: 'one-borrowed-light' }); reject(s, { type: 'PARTNER_REST' }); act(s, { type: 'WITHDRAW', caseId: 'one-borrowed-light' });
    const player = [s.health, s.mind, s.spirituality], ap = s.actionsRemaining;
    act(s, { type: 'PARTNER_REST' }); expect([s.health, s.mind, s.spirituality]).toEqual(player); expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.imperativeMage.life.partner).toMatchObject({ spirituality: 6, rests: [{ week: s.week, afterAttempts: 2, before: 0, restored: 6, elapsedHours: 6 }] });
    reject(s, { type: 'PARTNER_REST' }); finish(s, 'one-borrowed-light', 'ABILITY');
    expect(s.imperativeMage.life.partner).toMatchObject({ spirituality: 2, knownAbilities: ['FLASH'], abilityAvailable: true, confirmations: 3 });
    expect(s.imperativeMage.life.light).toMatchObject({ distanceMetres: 6, handovers: 3 });
  });

  it('ordinary hood comparison keeps the same ability available and pays for actual baseline, check and restored demonstrations', () => {
    const s = ready('one-borrowed-light', 'ORDINARY'), spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'one-borrowed-light' }); expect(s.imperativeMage.life.light.hoodComparison).toBe(true);
    expect(s.imperativeMage.life.partner).toMatchObject({ spirituality: 10, abilityAvailable: true });
    act(s, { type: 'CHECK_LIGHT', caseId: 'one-borrowed-light' }); expect(s.imperativeMage.life.partner.spirituality).toBe(8);
    close(s, 'one-borrowed-light'); expect(act(s, { type: 'REPORT', caseId: 'one-borrowed-light' }).award).not.toHaveBeenCalled();
    expect(s.imperativeMage.life.partner.spirituality).toBe(6); expect(s.spirituality).toBe(spirit);
    expect(s.imperativeMage.life.cases['one-borrowed-light'].attempts[0]).toMatchObject({ outcome: 'ORDINARY_SHADE', lightCheck: 'LIT', restoration: 'LIT', elapsedSeconds: 0 });
  });

  it('applies the same actual line condition to both people and preserves failed crossings, paid cost and ordinary four-metre returns', () => {
    const s = ready('equal-line'), old = originals(s), spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'equal-line' }, 100);
    expect(s.imperativeMage.life.line).toMatchObject({ rule: 'NO_CROSSING', appliesTo: 'BOTH', testedBy: 'BOTH', playerPositionMetres: 2, partnerPositionMetres: 2, playerDistanceMetres: 2, partnerDistanceMetres: 2, tokenHolder: 'TABLE' });
    reject(s, { type: 'CLOSE', caseId: 'equal-line' }); s.actionsRemaining = 0; s.mind = 0;
    act(s, { type: 'REMOVE_RULE', caseId: 'equal-line' });
    expect(s.imperativeMage.life.line).toMatchObject({ rule: 'NONE', holder: 'GUIDE', tokenHolder: 'PLAYER', playerPositionMetres: 0, partnerPositionMetres: 0, playerDistanceMetres: 4, partnerDistanceMetres: 4 });
    reject(s, { type: 'REMOVE_RULE', caseId: 'equal-line' }); act(s, { type: 'CLOSE', caseId: 'equal-line' });
    expect(s.spirituality).toBe(spirit - 3); expect(originals(s)).toEqual(old); nextWeek(s); finish(s, 'equal-line', 'ABILITY');
    expect(s.imperativeMage.life.line).toMatchObject({ tokenHolder: 'GUIDE', playerDistanceMetres: 8, partnerDistanceMetres: 4, handovers: 2 });
    expect(s.imperativeMage.life.cases['equal-line'].attempts.map(a => [a.outcome, a.distanceMetres, a.partnerDistanceMetres])).toEqual([['BOTH_CROSS', 4, 4], ['BOTH_STOP', 4, 0]]);
  });

  it('projects the live resources, exact pending cleanup and once-only commands without mutating state', () => {
    const s = ready('one-borrowed-light'); act(s, { type: 'PERFORM', caseId: 'one-borrowed-light' }); const before = structuredClone(s), p = projectImperativeMageLife(s);
    expect(p.insideCase).toBe(true); expect(p.practice?.partner).toContain('10/12'); expect(p.practice?.partner).toContain('暂时不可用'); expect(p.practice?.light).toContain('剩余10秒'); expect(s).toEqual(before);
    expect(imperativeMageLifeActions(s).filter(a => a.enabled).map(a => a.command.type)).toEqual(['CHECK_LIGHT', 'RESTORE_LIGHT']);
    act(s, { type: 'CHECK_LIGHT', caseId: 'one-borrowed-light' }); expect(imperativeMageLifeActions(s).some(a => a.enabled && a.command.type === 'CHECK_LIGHT')).toBe(false);
    for (const c of [{ type: 'CHECK_LIGHT', caseId: 'equal-line' }, { type: 'PARTNER_REST', caseId: 'one-borrowed-light' }, { type: 'PREPARE', caseId: 'equal-line', method: 'UNKNOWN' }, { type: 'REFLECT', extra: true }]) expect(validateImperativeMageActivityCommand(c)).toBe(false);
  });

  it('rejects changed partner resources, deleted known ability, fabricated time or swapped original props before any mutation', () => {
    const base = ready('one-borrowed-light'); act(base, { type: 'PERFORM', caseId: 'one-borrowed-light' });
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.imperativeMage.life.partner.spirituality += 2; }, s => { s.imperativeMage.life.partner.knownAbilities = [] as unknown as ['FLASH']; },
      s => { s.imperativeMage.life.partner.abilityAvailable = true; }, s => { s.imperativeMage.life.light.remainingSeconds = 0; },
      s => { s.imperativeMage.life.light.cardId = 'CLONE' as 'IM4-CARD-1'; }, s => { s.imperativeMage.life.cases['one-borrowed-light'].attempts[0]!.partnerSpiritualityCost = 0; },
    ];
    for (const mutate of mutations) { const s = structuredClone(base); mutate(s); expect(validateImperativeMageLife(s)).toBe(false); reject(s, { type: 'RESTORE_LIGHT', caseId: 'one-borrowed-light' }); }
    const blocked = promoted(); blocked.punishmentKnight.practice.partner = 'HELD'; reject(blocked, { type: 'OBSERVE', caseId: 'willing-attention' });
  });
});
