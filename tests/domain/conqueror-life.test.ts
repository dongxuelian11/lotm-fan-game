import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createConquerorState } from '../../src/domain/conqueror/index.js';
import { applyConquerorActivity, blockConquerorActivity, createConquerorLifeState, initializeConquerorLife, hasConquerorLifeLock, projectConquerorLife, validateConquerorActivityCommand, validateConquerorLife, CONQUEROR_CASE_IDS, CONQUEROR_MEMBER_IDS, type ConquerorActivityCommand, type ConquerorCaseId } from '../../src/domain/conqueror/life.js';

const IDS = ['hunter.s1.formation-momentum', 'hunter.s1.focused-flame'] as const;
/** Focused domain fixture: the unchanged real W164 source roster/objects, with an explicit S1/unit AP setup.
 * End-to-end acquisition is covered by the campaign tests. No member, seed, cursor, cash or calendar is reset here.
 * Optional knowledge is only a unit check boundary, never a generated campaign save. */
function lifeState(knowledge?: number): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/weather-warlock-v01650/natural.json', 'utf8')).final);
  s.conqueror = createConquerorState(); s.conqueror.promotionWeek = s.week;
  s.progression.sequence = 1; s.progression.acting = 0; for (const id of IDS) s.progression.mastery[id] = 0;
  s.actionsRemaining = 100; s.weeklyBudget = 100;
  if (knowledge !== undefined) s.character.coreStats.knowledge = knowledge;
  initializeConquerorLife(s); return s;
}
function context(s: SliceState): SeerContext {
  return { note: vi.fn(), roll: vi.fn((min, max) => { const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor); const value = rng.nextInt(min, max); s.random.cursor = rng.cursor; return value; }),
    check: vi.fn((ability, difficulty) => { const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor); const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: rng.nextInt(1, 100) }); s.random.cursor = rng.cursor; s.lastCheck = result; return result; }) };
}
function act(s: SliceState, command: ConquerorActivityCommand) { const ctx = context(s); applyConquerorActivity(s, command, ctx); s.revision++; expect(validateConquerorLife(s)).toBe(true); return ctx; }
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyConquerorActivity(s, command as ConquerorActivityCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); }
function nextWeek(s: SliceState) { s.week++; s.date = addGameWeeks(s.date, 1); s.revision++; }
function recover(s: SliceState) { act(s, { type: 'REST_TEAM' }); nextWeek(s); act(s, { type: 'RECOVER_TEAM' }); }
function begin(s: SliceState, id: ConquerorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { act(s, { type: 'OBSERVE', caseId: id }); act(s, { type: 'INVITE_TEAM', caseId: id, method }); act(s, { type: 'ENTER_WORK' }); }
function finish(s: SliceState, id: ConquerorCaseId) { act(s, { type: 'RETURN_HOME' }); act(s, { type: 'REPORT', caseId: id }); }
function ordinary(s: SliceState, id: ConquerorCaseId) { begin(s, id, 'ORDINARY'); act(s, { type: 'ORDINARY_WORK' }); finish(s, id); }

describe('Conqueror finite life: original bodies, paid recovery, heat and permission', () => {
  it('keeps the actual exhausted 30-person source and requires paid rest plus a real later week', () => {
    const s = lifeState(), source = structuredClone(s.ironBloodKnight.team), references = [...s.ironBloodKnight.team.members];
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual([5, 5, 5, 5, 6]);
    expect(s.cash).toBe(576); expect(s.week).toBe(164); expect(s.conqueror.life.sourceTeam).toEqual(source); expect(validateConquerorLife(s)).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'yard-cart' }); reject(s, { type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ABILITY' });
    const cash = s.cash; act(s, { type: 'REST_TEAM' }); expect(s.cash).toBe(cash - 40); expect(s.ironBloodKnight.team.members).toEqual(source.members); reject(s, { type: 'RECOVER_TEAM' });
    nextWeek(s); act(s, { type: 'RECOVER_TEAM' }); expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual([13, 13, 13, 13, 14]);
    expect(s.ironBloodKnight.team.members).toHaveLength(30); for (const [i, m] of s.ironBloodKnight.team.members.entries()) expect(m).toBe(references[i]);
    expect(s.ironBloodKnight.team.cohorts).toEqual(source.cohorts); expect(s.ironBloodKnight.team.exercises).toEqual(source.exercises); expect(s.conqueror.life.sourceTeam).toEqual(source);
    expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true); reject(s, { type: 'RECOVER_TEAM' });
  });

  it('applies one finite formation pulse to the actual cart, charges all five and awards only its report', () => {
    const s = lifeState(500); recover(s); const before = structuredClone(s.ironBloodKnight), energy = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy), mind = s.mind, spirit = s.spirituality, cash = s.cash, cursor = s.random.cursor;
    begin(s, 'yard-cart'); expect(s.conqueror.life.practice.memberPositions.every(p => p.distanceMetres <= 15)).toBe(true);
    expect(s.ironBloodKnight.team.members.filter(m => m.present).map(m => m.id)).toEqual([...CONQUEROR_MEMBER_IDS]);
    const ctx = act(s, { type: 'APPLY_POWER' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 16); expect(s.random.cursor).toBe(cursor + 1);
    expect(s.conqueror.life.practice.cart).toEqual({ id: 'CQ1-CART-1', resistance: 0, movedMetres: 3 }); expect(s.mind).toBe(mind - 3); expect(s.spirituality).toBe(spirit - 8);
    expect(s.conqueror.life.practice.abilityUses[IDS[0]]).toEqual({ attempts: 1, successes: 1, applied: 1 }); expect(s.progression.mastery[IDS[0]]).toBe(0);
    reject(s, { type: 'APPLY_POWER' }); reject(s, { type: 'REPORT', caseId: 'yard-cart' }); finish(s, 'yard-cart');
    expect(s.progression.mastery[IDS[0]]).toBe(8); expect(s.progression.mastery[IDS[1]]).toBe(0); expect(s.cash).toBe(cash - 40);
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual(energy.map(v => v - 5)); expect(s.ironBloodKnight.team.members.slice(5)).toEqual(before.team.members.slice(5));
    expect(s.ironBloodKnight.life).toEqual(before.life); expect(s.ironBloodKnight.encounter).toEqual(before.encounter); expect(hasConquerorLifeLock(s)).toBe(false);
    const receipts = projectConquerorLife(s).cases[0]!.attempts[0]!.receipts; expect(receipts.reduce((sum, r) => sum + r.elapsedSeconds, 0)).toBe(75);
    expect(receipts.reduce((sum, r) => sum + r.memberCosts[0]!.walkedMetres, 0)).toBe(50); expect(receipts.reduce((sum, r) => sum + r.toolTravelMetres, 0)).toBe(10);
  });

  it('retains a failed partial push and all costs while ordinary completion grants no ability usage', () => {
    const s = lifeState(0); recover(s); const energy = s.ironBloodKnight.team.members[0]!.energy, mind = s.mind; begin(s, 'yard-cart'); act(s, { type: 'APPLY_POWER' });
    expect(s.conqueror.life.practice.cart).toMatchObject({ resistance: 40, movedMetres: 1 }); expect(s.mind).toBe(mind - 5); reject(s, { type: 'APPLY_POWER' });
    act(s, { type: 'ORDINARY_WORK' }); finish(s, 'yard-cart'); expect(s.ironBloodKnight.team.members[0]!.energy).toBe(energy - 6);
    expect(s.conqueror.life.cases['yard-cart']).toMatchObject({ result: 'ORDINARY', abilityAttempted: true, abilityApplied: false }); expect(s.progression.mastery[IDS[0]]).toBe(0);
    expect(s.conqueror.life.practice.abilityUses[IDS[0]]).toEqual({ attempts: 1, successes: 0, applied: 0 });
  });

  it('keeps real iron heat damage, all bodies thermal injury and finite water through the failure fallback', () => {
    const s = lifeState(0); recover(s); ordinary(s, 'yard-cart'); recover(s); const health = s.health, members = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.health), spirit = s.spirituality;
    begin(s, 'iron-target'); const ctx = act(s, { type: 'APPLY_POWER' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18);
    expect(s.conqueror.life.practice.iron).toMatchObject({ integrity: 90, heatDamage: 10, temperature: 60, cooldownSeconds: 30, observed: true }); expect(s.conqueror.life.practice.backstop.charred).toBe(true);
    expect(s.health).toBe(health - 1); expect(s.spirituality).toBe(spirit - 12); expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.health)).toEqual(members.map(v => v - 1));
    for (const type of ['RETURN_HOME', 'ABORT', 'ORDINARY_WORK', 'APPLY_POWER'] as const) reject(s, { type });
    act(s, { type: 'COOL_DOWN' }); expect(s.conqueror.life.practice.iron).toMatchObject({ integrity: 90, heatDamage: 10, temperature: 20, cooldownSeconds: 0 });
    act(s, { type: 'ORDINARY_WORK' }); finish(s, 'iron-target'); expect(s.conqueror.life.practice.water).toEqual({ id: 'CQ1-WATER-1', wasteBasinId: 'CQ1-BASIN-1', remainingMl: 1000, usedMl: 1000 }); expect(s.progression.mastery[IDS[1]]).toBe(0);
    expect(s.health).toBe(health - 1); expect(s.conqueror.life.practice.backstop.charred).toBe(true); reject(s, { type: 'COOL_DOWN' });
  });

  it('distinguishes a successful observed iron hit and cooling from ordinary water work', () => {
    const s = lifeState(500); recover(s); ordinary(s, 'yard-cart'); recover(s); begin(s, 'iron-target'); act(s, { type: 'APPLY_POWER' });
    expect(s.conqueror.life.practice.iron).toMatchObject({ integrity: 70, heatDamage: 30, temperature: 80, cooldownSeconds: 30 });
    expect(s.conqueror.life.practice.abilityUses[IDS[1]]).toEqual({ attempts: 1, successes: 1, applied: 1 }); reject(s, { type: 'RETURN_HOME' });
    act(s, { type: 'COOL_DOWN' }); finish(s, 'iron-target'); expect(s.progression.mastery[IDS[1]]).toBe(8); expect(s.conqueror.life.practice.water.remainingMl).toBe(2000);
    // Later normal study may change the current stat; historical checks keep their actual original base.
    s.character.coreStats.knowledge = 499; s.revision++; expect(validateConquerorLife(s)).toBe(true);
  });

  it('honors the withdrawn power permission, completes all three ordinary cases and reflects exactly once', () => {
    const s = lifeState(); const spirit = s.spirituality;
    for (const id of CONQUEROR_CASE_IDS) { recover(s); begin(s, id, 'ORDINARY'); if (id === 'withdrawn-permission') { expect(s.conqueror.life.cases[id].permission).toBe('WITHDRAWN'); reject(s, { type: 'APPLY_POWER' }); } act(s, { type: 'ORDINARY_WORK' }); finish(s, id); }
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[IDS[0]]).toBe(0); expect(s.progression.mastery[IDS[1]]).toBe(0); expect(s.spirituality).toBe(spirit);
    expect(s.conqueror.life.practice.crate.movedMetres).toBe(2); expect(s.conqueror.life.practice.water.remainingMl + s.conqueror.life.practice.water.usedMl).toBe(2000);
    expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true); reject(s, { type: 'REFLECT' });
    const current = structuredClone(s.ironBloodKnight.team); recover(s); expect(validateConquerorLife(s)).toBe(true); expect(s.ironBloodKnight.team.members[0]!.energy).toBe(Math.min(20, current.members[0]!.energy + 8));
  });

  it('can actually abort at entry or after a failed push, preserving objects and requiring new paid consent', () => {
    const s = lifeState(0); recover(s); act(s, { type: 'OBSERVE', caseId: 'yard-cart' }); act(s, { type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ABILITY' }); const energy = s.ironBloodKnight.team.members[0]!.energy;
    act(s, { type: 'ABORT' }); expect(s.ironBloodKnight.team.members[0]!.energy).toBe(energy - 1); expect(s.conqueror.life.cases['yard-cart'].status).toBe('PAUSED'); expect(hasConquerorLifeLock(s)).toBe(false);
    reject(s, { type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ORDINARY' }); nextWeek(s); reject(s, { type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ABILITY' });
    const cash = s.cash; act(s, { type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ORDINARY' }); act(s, { type: 'ENTER_WORK' }); act(s, { type: 'ORDINARY_WORK' }); finish(s, 'yard-cart'); expect(s.cash).toBe(cash - 40);
    expect(s.conqueror.life.cases['yard-cart'].invitationWeeks).toHaveLength(2); expect(projectConquerorLife(s).cases[0]!.attempts).toHaveLength(2); expect(s.progression.mastery[IDS[0]]).toBe(0);
    const failed = lifeState(0); recover(failed); begin(failed, 'yard-cart'); act(failed, { type: 'APPLY_POWER' }); act(failed, { type: 'ABORT' }); expect(failed.conqueror.life.practice.cart.movedMetres).toBe(1);
    recover(failed); act(failed, { type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ORDINARY' }); act(failed, { type: 'ENTER_WORK' }); reject(failed, { type: 'APPLY_POWER' }); act(failed, { type: 'ORDINARY_WORK' }); finish(failed, 'yard-cart'); expect(failed.conqueror.life.practice.abilityUses[IDS[0]].attempts).toBe(1);
  });

  it('supports zero-AP safe cleanup without zero-resource creation and blocks a one-mind withdrawn invitation', () => {
    const s = lifeState(); recover(s); s.actionsRemaining = 2; s.revision++; begin(s, 'yard-cart', 'ORDINARY'); expect(s.actionsRemaining).toBe(0); act(s, { type: 'ORDINARY_WORK' }); act(s, { type: 'RETURN_HOME' }); expect(s.actionsRemaining).toBe(0); reject(s, { type: 'REPORT', caseId: 'yard-cart' });
    const low = lifeState(); recover(low); ordinary(low, 'yard-cart'); recover(low); ordinary(low, 'iron-target'); recover(low); act(low, { type: 'OBSERVE', caseId: 'withdrawn-permission' }); low.mind = 1; low.revision++;
    reject(low, { type: 'INVITE_TEAM', caseId: 'withdrawn-permission', method: 'ORDINARY' }); expect(hasConquerorLifeLock(low)).toBe(false);
  });

  it('rejects forged members, free recovery, changed physical receipts and reordered time without exceptions', () => {
    const s = lifeState(500); recover(s); begin(s, 'yard-cart'); act(s, { type: 'APPLY_POWER' });
    const edits: ((state: SliceState) => void)[] = [
      x => { x.ironBloodKnight.team.members[0]!.energy++; }, x => { x.ironBloodKnight.team.members.push(structuredClone(x.ironBloodKnight.team.members[0]!)); },
      x => { x.ironBloodKnight.team.members[8]!.experience = 0; }, x => { x.conqueror.life.practice.memberPositions[0]!.distanceMetres = 16; },
      x => { x.conqueror.life.practice.cart.movedMetres = 0; }, x => { x.conqueror.life.practice.abilityUses[IDS[0]].applied++; },
      x => { x.conqueror.life.journal.at(-1)!.after.spirituality++; }, x => { x.conqueror.life.journal.at(-1)!.randomAfter! += 1; },
      x => { x.conqueror.life.journal.at(-1)!.checkBase = 0; }, x => { x.conqueror.life.journal.at(-1)!.revision = 0; },
      x => { x.conqueror.life.journal.at(-1)!.date.day = 1; }, x => { (x.conqueror.life.journal.at(-1)! as unknown as Record<string, unknown>).command = null; },
      x => { (x.conqueror.life as unknown as Record<string, unknown>).members = [{ id: 'COPY' }]; },
    ];
    for (const edit of edits) { const bad = structuredClone(s); edit(bad); expect(validateConquerorLife(bad)).toBe(false); }
    const reordered = JSON.parse(stableStringify(s)) as SliceState; expect(validateConquerorLife(reordered)).toBe(true); expect(projectConquerorLife(reordered)).toEqual(projectConquerorLife(s));
    expect(validateConquerorActivityCommand({ type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ABILITY', energy: 20 })).toBe(false);
    expect(blockConquerorActivity(s, { type: 'REST_TEAM' })).not.toBeNull(); expect(createConquerorLifeState().sourceTeam).toBeNull();
  });
});
