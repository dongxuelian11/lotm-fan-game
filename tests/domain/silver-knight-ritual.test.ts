import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applySilverKnightCommand, createSilverKnightState, hasSilverKnightLock, projectSilverKnight } from '../../src/domain/silver-knight/index.js';
import { SILVER_KNIGHT_PREPARATION_IDS, type SilverKnightCommand } from '../../src/domain/silver-knight/types.js';
import { SILVER_KNIGHT_ALTAR_SLOTS, currentSilverKnightBlessing, hasSilverKnightRitualLock, projectSilverKnightRitual, validateSilverKnightRitual, validateSilverKnightRitualCommand } from '../../src/domain/silver-knight/ritual.js';

function ctx(s: SliceState, roll = 1): SeerContext { return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
function act(s: SliceState, c: SilverKnightCommand, roll = 1) { const context = ctx(s, roll); applySilverKnightCommand(s, c, context); return context; }
/** Deliberately isolated ritual fixture. These are fabricated test records, never natural hunt evidence. */
function fixture(withRemains = true) {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/demon-hunter-v01290/natural.json', 'utf8')).final); s.silverKnight = createSilverKnightState();
  s.week = s.demonHunter.promotionWeek! + 12; s.cash = 50000; s.actionsRemaining = 80; s.weeklyBudget = 80; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; s.character.coreStats.will = 30;
  act(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of SILVER_KNIGHT_PREPARATION_IDS) act(s, { type: 'PREPARE_TASK', taskId }); act(s, { type: 'BUY_POTION', bottleId: 'silver-knight-potion-1' });
  if (withRemains) s.silverKnight.encounter.remains = SILVER_KNIGHT_ALTAR_SLOTS.map((slot, n) => ({ id: `UNIT-REMAINS-${n}`, instanceId: `UNIT-BODY-${n}`, speciesId: slot.speciesId, killedBy: 'PLAYER', outcome: 'ENEMY_DEAD', killedWeek: s.week, collectedWeek: s.week, locationId: 'PLAYER', originLocationId: `UNIT-ORIGIN-${n}`, status: 'OWNER_PLAYER', slotId: null, consumedWeek: null }));
  return s;
}
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), context = ctx(s); expect(() => applySilverKnightCommand(s, command as SilverKnightCommand, context)).toThrow(); expect(s).toEqual(before); expect(context.check).not.toHaveBeenCalled(); }
function meet(s: SliceState, roll = 1) { for (const type of ['RITUAL_REQUEST_MEETING', 'RITUAL_GO_MEETING', 'RITUAL_SHOW_RECORDS'] as const) act(s, { type }); act(s, { type: 'RITUAL_SEEK_BLESSING' }, roll); act(s, { type: 'RITUAL_RETURN_DOOR' }); }
function arrange(s: SliceState) { act(s, { type: 'RITUAL_GO_ALTAR' }); for (const [n, slot] of SILVER_KNIGHT_ALTAR_SLOTS.entries()) act(s, { type: 'RITUAL_PLACE_REMAINS', slotId: slot.id, remainsId: `UNIT-REMAINS-${n}` }); }

describe('Silver Knight actual original anchor, Angel meeting, remains placement and altar exit', () => {
  it('starts at a real open door with empty slots and no blessing', () => { const s = fixture(false), r = s.silverKnight.ritual; expect(r.playerLocation).toBe('DOOR'); expect(r.door.state).toBe('OPEN'); expect(r.slots.map(v => v.remainsId)).toEqual([null, null, null, null, null, null]); expect(r.meetings).toEqual([]); expect(hasSilverKnightLock(s)).toBe(false); expect(validateSilverKnightRitual(s)).toBe(true); reject(s, { type: 'RITUAL_REQUEST_MEETING' }); });
  it('strictly validates ritual commands and cannot smuggle a fake granted blessing', () => {
    for (const c of [{ type: 'RITUAL_REQUEST_MEETING', granted: true }, { type: 'RITUAL_PLACE_REMAINS', remainsId: 'x', slotId: 'WRONG' }, { type: 'RITUAL_SEEK_BLESSING', sourceId: 'FOOL' }]) expect(validateSilverKnightRitualCommand(c)).toBe(false);
    expect(validateSilverKnightRitualCommand({ type: 'RITUAL_PLACE_REMAINS', remainsId: 'original', slotId: 'NORTH' })).toBe(true);
  });
  it('reserves the next action and rejects oneAP without spending or locking', () => { const s = fixture(); s.actionsRemaining = 1; reject(s, { type: 'RITUAL_REQUEST_MEETING' }); expect(hasSilverKnightRitualLock(s)).toBe(false); });
  it('appointment is not arrival, presentation or automatic consent', () => {
    const s = fixture(), ap = s.actionsRemaining; act(s, { type: 'RITUAL_REQUEST_MEETING' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.silverKnight.ritual.playerLocation).toBe('DOOR'); expect(currentSilverKnightBlessing(s)).toBeNull(); expect(hasSilverKnightRitualLock(s)).toBe(true);
    reject(s, { type: 'RITUAL_SHOW_RECORDS' }); reject(s, { type: 'RITUAL_SEEK_BLESSING' }); reject(s, { type: 'RITUAL_GO_ALTAR' }); reject(s, { type: 'BUY_POTION', bottleId: 'silver-knight-potion-2' });
    act(s, { type: 'RITUAL_GO_MEETING' }); expect(s.silverKnight.ritual).toMatchObject({ playerLocation: 'MEETING', travelMetres: 6 }); reject(s, { type: 'RITUAL_SEEK_BLESSING' }); reject(s, { type: 'RITUAL_RETURN_DOOR' }); expect(validateSilverKnightRitual(s)).toBe(true);
  });
  it('requires original six records and original anchor at the actual meeting point', () => {
    const s = fixture(); act(s, { type: 'RITUAL_REQUEST_MEETING' }); act(s, { type: 'RITUAL_GO_MEETING' }); act(s, { type: 'RITUAL_SHOW_RECORDS' });
    expect(s.silverKnight.ritual.meetings[0]).toMatchObject({ visited: true, shown: true, anchorId: 'SK3-ANCHOR-JOURNAL', remainsIds: SILVER_KNIGHT_ALTAR_SLOTS.map((_, n) => `UNIT-REMAINS-${n}`), blessing: null });
    reject(s, { type: 'RITUAL_SHOW_RECORDS' }); expect(validateSilverKnightRitual(s)).toBe(true);
  });
  it('grants one actual source-bound current-week blessing then requires6m ordinary return', () => {
    const s = fixture(), spirits = s.spirituality; meet(s);
    expect(s.silverKnight.ritual).toMatchObject({ playerLocation: 'DOOR', travelMetres: 12, activeMeetingId: null });
    expect(currentSilverKnightBlessing(s)).toEqual({ id: 'SK3-AURIEL-BLESSING-1', sourceId: 'SK3-AURIEL', meetingId: 'SK3-AURIEL-MEETING-1', grantedWeek: s.week, status: 'ACTIVE', consumedWeek: null });
    expect(s.spirituality).toBe(spirits); expect(validateSilverKnightRitual(s)).toBe(true); reject(s, { type: 'RITUAL_REQUEST_MEETING' }); reject(s, { type: 'RITUAL_SEEK_BLESSING' });
  });
  it('keeps independent source refusal and unchanged original remains', () => {
    const s = fixture(), remains = structuredClone(s.silverKnight.encounter.remains); s.silverKnight.ritual.auriel.willing = false;
    for (const type of ['RITUAL_REQUEST_MEETING', 'RITUAL_GO_MEETING', 'RITUAL_SHOW_RECORDS'] as const) act(s, { type }); const context = act(s, { type: 'RITUAL_SEEK_BLESSING' });
    expect(context.check).not.toHaveBeenCalled(); expect(s.silverKnight.ritual.meetings[0]).toMatchObject({ status: 'REFUSED', sourceWilling: false, decisionTier: null, blessing: null });
    act(s, { type: 'RITUAL_RETURN_DOOR' }); expect(s.silverKnight.encounter.remains).toEqual(remains); expect(validateSilverKnightRitual(s)).toBe(true); reject(s, { type: 'RITUAL_REQUEST_MEETING' });
  });
  it('real failed request records its failure, permits ordinary exit and a later independent request', () => {
    const s = fixture(); meet(s, 100); expect(s.silverKnight.ritual.meetings[0]).toMatchObject({ status: 'REFUSED', decisionTier: 'GREAT_FAILURE', blessing: null, returned: true });
    expect(hasSilverKnightRitualLock(s)).toBe(false); s.week++; meet(s); expect(s.silverKnight.ritual.meetings).toHaveLength(2); expect(currentSilverKnightBlessing(s)?.id).toBe('SK3-AURIEL-BLESSING-2'); expect(validateSilverKnightRitual(s)).toBe(true);
  });
  it.each([false, true])('cancellation at visited=%s preserves actual route and cannot grant a blessing', visited => {
    const s = fixture(); act(s, { type: 'RITUAL_REQUEST_MEETING' }); if (visited) act(s, { type: 'RITUAL_GO_MEETING' }); act(s, { type: 'RITUAL_CANCEL_MEETING' });
    if (visited) { expect(s.silverKnight.ritual.playerLocation).toBe('MEETING'); expect(hasSilverKnightRitualLock(s)).toBe(true); act(s, { type: 'RITUAL_RETURN_DOOR' }); }
    expect(s.silverKnight.ritual.travelMetres).toBe(visited ? 12 : 0); expect(s.silverKnight.ritual.meetings[0]).toMatchObject({ status: 'CANCELLED', blessing: null, returned: true }); expect(validateSilverKnightRitual(s)).toBe(true);
  });
  it('cannot place remotely, put a species in the wrong slot, copy an original or use a fake ID', () => {
    const s = fixture(); reject(s, { type: 'RITUAL_PLACE_REMAINS', slotId: 'NORTH', remainsId: 'UNIT-REMAINS-0' }); act(s, { type: 'RITUAL_GO_ALTAR' });
    reject(s, { type: 'RITUAL_PLACE_REMAINS', slotId: 'NORTH_EAST', remainsId: 'UNIT-REMAINS-0' }); reject(s, { type: 'RITUAL_PLACE_REMAINS', slotId: 'NORTH', remainsId: 'DH4-CINDER-GUARD' });
    act(s, { type: 'RITUAL_PLACE_REMAINS', slotId: 'NORTH', remainsId: 'UNIT-REMAINS-0' }); reject(s, { type: 'RITUAL_PLACE_REMAINS', slotId: 'NORTH', remainsId: 'UNIT-REMAINS-0' });
    expect(s.silverKnight.encounter.remains[0]).toMatchObject({ status: 'ALTAR', locationId: 'SK3-CHAPEL:ALTAR:NORTH', originLocationId: 'UNIT-ORIGIN-0' }); expect(validateSilverKnightRitual(s)).toBe(true);
  });
  it('six correct slots alone do not substitute for an actual current blessing', () => { const s = fixture(); arrange(s); reject(s, { type: 'PREPARE_PROMOTION' }); act(s, { type: 'RITUAL_RETURN_DOOR' }); meet(s); arrangeAlreadyPlaced(s); act(s, { type: 'PREPARE_PROMOTION' }); expect(validateSilverKnightRitual(s)).toBe(true); });
  it('leaving altar preserves original locations and requires the actual4m return', () => { const s = fixture(); arrange(s); const remains = structuredClone(s.silverKnight.encounter.remains); act(s, { type: 'RITUAL_RETURN_DOOR' }); expect(s.silverKnight.ritual.travelMetres).toBe(8); expect(s.silverKnight.encounter.remains).toEqual(remains); expect(validateSilverKnightRitual(s)).toBe(true); });
  it('expires blessing by real week rather than refreshing it via projection', () => { const s = fixture(); meet(s); s.week++; expect(currentSilverKnightBlessing(s)).toBeNull(); arrange(s); reject(s, { type: 'PREPARE_PROMOTION' }); const before = structuredClone(s); expect(projectSilverKnightRitual(s).blessing).toBeNull(); projectSilverKnight(s); expect(s).toEqual(before); });
  it('shows actual consumption and supports lastAP preparation with0AP cancel and no refunds', () => {
    const s = fixture(); meet(s); arrange(s); s.actionsRemaining = 1; const cash = s.cash; act(s, { type: 'PREPARE_PROMOTION' });
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash - 140]); expect(projectSilverKnight(s).preferredActionId).toBe('consume-silver-knight-potion-1'); expect(hasSilverKnightLock(s)).toBe(true);
    expect(s.silverKnight.ritual.attempts[0]).toMatchObject({ kitId: 'SK3-ALTAR-KIT-1', kitStatus: 'APPLIED', sealingPowderSpent: 1, altarMaterialSpent: 1, costPence: 140 });
    act(s, { type: 'LEAVE_PREPARATION' }); expect([s.actionsRemaining, s.cash, s.silverKnight.ritual.travelMetres]).toEqual([0, cash - 140, 20]); expect(hasSilverKnightLock(s)).toBe(false); expect(validateSilverKnightRitual(s)).toBe(true);
  });
  it('rejects forged travel, substituted source, missing anchor entry and wrong placed species on validation', () => {
    const s = fixture(); meet(s); arrange(s); expect(validateSilverKnightRitual(s)).toBe(true);
    for (const change of [(v: SliceState) => { v.silverKnight.ritual.travelMetres++; }, (v: SliceState) => { v.silverKnight.ritual.anchor!.entries[0]!.eventWeek++; }, (v: SliceState) => { v.silverKnight.ritual.meetings[0]!.remainsIds[0] = 'FAKE'; }, (v: SliceState) => { v.silverKnight.ritual.slots[0]!.remainsId = 'UNIT-REMAINS-1'; }, (v: SliceState) => { (v.silverKnight.ritual.meetings[0]!.blessing as unknown as Record<string, unknown>).sourceId = 'UNKNOWN'; }]) { const altered = structuredClone(s); change(altered); expect(validateSilverKnightRitual(altered)).toBe(false); }
  });
});
function arrangeAlreadyPlaced(s: SliceState) { act(s, { type: 'RITUAL_GO_ALTAR' }); }
