import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createSeaKingState } from '../../src/domain/sea-king/index.js';
import { applySeaKingActivity, blockSeaKingLife, createSeaKingLifeState, hasSeaKingLifeLock, projectSeaKingLife, SEA_KING_CASE_IDS, validateSeaKingActivityCommand, validateSeaKingLife, type SeaKingActivityCommand, type SeaKingCaseId } from '../../src/domain/sea-king/life.js';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Isolated life setup; public integration replay retains the actual original sailor history. */
function ready(): SliceState {
  const s = createSliceRun('sea-king-life', sliceDefaultCreationSelection, 'sea-king-life');
  s.seaKing = createSeaKingState(); s.week = 20; s.seaKing.promotionWeek = 19;
  s.progression = { pathwayId: 'tyrant', sequence: 3, acting: 0, promotionWeek: 19, mastery: { 'tyrant.s3.sea-domain': 0, 'tyrant.s3.remote-tempest': 0, 'tyrant.s3.water-recollection': 0 } };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000;
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: SeaKingActivityCommand, roll = 1) { const ctx = context(s, roll); applySeaKingActivity(s, command, ctx); expect(validateSeaKingLife(s), `${command.type}: ${JSON.stringify(s.seaKing.life)}`).toBe(true); return ctx; }
function reject(s: SliceState, command: SeaKingActivityCommand) { const before = structuredClone(s); expect(() => applySeaKingActivity(s, command, context(s))).toThrow(); expect(s).toEqual(before); }
const attempt = (s: SliceState, id: SeaKingCaseId) => s.seaKing.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, caseId: SeaKingCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (s.seaKing.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId });
}
function site(s: SliceState, caseId: SeaKingCaseId) { for (const type of ['CONSENT_OWNER', 'GO_SITE', 'READ_CHART', 'CHECK_BOUNDARY'] as const) act(s, { type, caseId }); }
function exit(s: SliceState, caseId: SeaKingCaseId) { if (s.seaKing.life.playerLocation !== 'EXIT') act(s, { type: 'RETURN_PLAYER', caseId }); if (s.seaKing.life.chart.location === 'PLAYER' || s.seaKing.life.handoverRecord.location === 'PLAYER') act(s, { type: 'RETURN_ITEMS', caseId }); act(s, { type: 'INSPECT', caseId }); act(s, { type: 'CLOSE', caseId }); }
function dinghySetup(s: SliceState) { site(s, 'remote-dinghy'); act(s, { type: 'CONSENT_ORIN', caseId: 'remote-dinghy' }); act(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); }
function wetSetup(s: SliceState) { site(s, 'wet-recess'); act(s, { type: 'CHECK_ASSISTANT', caseId: 'wet-recess' }); }
function recordSetup(s: SliceState) { site(s, 'calm-water-record'); act(s, { type: 'CHECK_CALM', caseId: 'calm-water-record' }); }
function recordEvidence(s: SliceState) {
  act(s, { type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'CURRENT' });
  for (const type of ['RETURN_PLAYER', 'ASK_SELMA', 'ASK_ORIN', 'READ_RECORD'] as const) act(s, { type, caseId: 'calm-water-record' });
  act(s, { type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'HAND_MOVED' }); act(s, { type: 'VERIFY', caseId: 'calm-water-record' });
}
function finish(s: SliceState, caseId: SeaKingCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', roll = 1) {
  start(s, caseId, method);
  if (caseId === 'remote-dinghy') {
    dinghySetup(s); if (method === 'ABILITY') act(s, { type: 'REMOTE_WIND', caseId }, roll);
    if (!attempt(s, caseId).returnedBy) act(s, { type: 'ROW_RETURN', caseId }); act(s, { type: 'TIE_BOAT', caseId });
  } else if (caseId === 'wet-recess') {
    wetSetup(s); if (method === 'ABILITY') act(s, { type: 'DIVERT_WATER', caseId }, roll);
    if (attempt(s, caseId).windowRemaining) { act(s, { type: 'TAKE_PLATE', caseId }); act(s, { type: 'STOP_WATER', caseId }); }
    else act(s, { type: 'TOOL_RETRIEVE', caseId });
  } else { recordSetup(s); if (method === 'ABILITY') act(s, { type: 'RECOLLECT', caseId }, roll); recordEvidence(s); }
  exit(s, caseId); act(s, { type: 'REPORT', caseId });
}
function toWet(s: SliceState) { finish(s, 'remote-dinghy'); start(s, 'wet-recess'); }
function toRecord(s: SliceState) { finish(s, 'remote-dinghy'); finish(s, 'wet-recess'); start(s, 'calm-water-record'); }

describe('Sea King finite original sea, people, water and evidence', () => {
  it('creates original adults and resources, labels G limits, and detaches every public nested object', () => {
    const s = ready(), l = s.seaKing.life; expect(validateSeaKingLife(s)).toBe(true);
    expect(l.selma).toMatchObject({ id: 'SK3-SELMA', age: 44 }); expect(l.orin).toMatchObject({ id: 'SK3-ORIN', age: 39, energy: 100 });
    expect(l.buoys).toMatchObject({ originalCount: 2, boundaryMetres: 96 }); expect(l.recess).toMatchObject({ waterUnits: 20, displacedToCove: 0 });
    const view = projectSeaKingLife(s); expect(view.title).toContain('有限G'); expect(view.story).toContain('最多一次6灵性'); expect(view.cases.every(c => c.title.includes('G'))).toBe(true);
    view.orin.energy = 0; view.dinghy.hull = 0; view.recess.waterUnits = 0; view.cases[0]!.attempts.push({} as never);
    expect(l.orin.energy).toBe(100); expect(l.dinghy.hull).toBe(100); expect(l.recess.waterUnits).toBe(20); expect(l.cases['remote-dinghy'].attempts).toEqual([]);
  });
  it('requires current owner, original rower permission, actual chart and measured boundary before departure', () => {
    const s = ready(); start(s, 'remote-dinghy'); reject(s, { type: 'GO_SITE', caseId: 'remote-dinghy' });
    act(s, { type: 'CONSENT_OWNER', caseId: 'remote-dinghy' }); act(s, { type: 'GO_SITE', caseId: 'remote-dinghy' });
    reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); act(s, { type: 'CONSENT_ORIN', caseId: 'remote-dinghy' });
    reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); act(s, { type: 'READ_CHART', caseId: 'remote-dinghy' });
    reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); act(s, { type: 'CHECK_BOUNDARY', caseId: 'remote-dinghy' });
    expect(s.seaKing.life).toMatchObject({ playerLocation: 'PIER', playerTravelMetres: 4 }); expect(blockSeaKingLife(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' })).toBeNull();
  });
  it('moves the same real rower and boat 60 metres, charges energy and never duplicates the person ashore', () => {
    const s = ready(); start(s, 'remote-dinghy'); const boat = s.seaKing.life.dinghy, orin = s.seaKing.life.orin; dinghySetup(s);
    expect(boat).toMatchObject({ location: 'MARK', occupant: 'SK3-ORIN', travelMetres: 60, cargoUnits: 0 }); expect(orin).toMatchObject({ location: 'DINGHY', energy: 88, travelMetres: 60 });
    expect(s.seaKing.life.playerLocation).toBe('PIER'); expect(attempt(s, 'remote-dinghy').elapsedSeconds).toBeGreaterThanOrEqual(60);
    reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'remote-dinghy' }); reject(s, { type: 'CLOSE', caseId: 'remote-dinghy' });
    const ctx = act(s, { type: 'REMOTE_WIND', caseId: 'remote-dinghy' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18);
    expect(s.spirituality).toBe(114); expect(boat).toBe(s.seaKing.life.dinghy); expect(orin).toBe(s.seaKing.life.orin);
    expect(boat).toMatchObject({ location: 'PIER', occupant: 'SK3-ORIN', travelMetres: 120 }); expect(orin).toMatchObject({ location: 'DINGHY', energy: 84, travelMetres: 120 });
    reject(s, { type: 'RETURN_PLAYER', caseId: 'remote-dinghy' }); act(s, { type: 'TIE_BOAT', caseId: 'remote-dinghy' }); exit(s, 'remote-dinghy'); act(s, { type: 'REPORT', caseId: 'remote-dinghy' });
    expect(orin).toMatchObject({ location: 'PIER', energy: 84 }); expect(boat).toMatchObject({ location: 'PIER', occupant: null, hull: 100 }); expect(s.seaKing.life.playerTravelMetres).toBe(8); expect(s.progression.mastery['tyrant.s3.remote-tempest']).toBe(8);
  });
  it('charges failed wind once and allows the same ordinary row return at zero AP and spirituality', () => {
    const s = ready(); start(s, 'remote-dinghy'); dinghySetup(s); act(s, { type: 'REMOTE_WIND', caseId: 'remote-dinghy' }, 100);
    expect(attempt(s, 'remote-dinghy')).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, returnedBy: null }); expect(s.seaKing.life.dinghy.location).toBe('MARK'); reject(s, { type: 'REMOTE_WIND', caseId: 'remote-dinghy' });
    s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'ROW_RETURN', caseId: 'remote-dinghy' }); act(s, { type: 'TIE_BOAT', caseId: 'remote-dinghy' }); exit(s, 'remote-dinghy');
    expect(hasSeaKingLifeLock(s)).toBe(false); expect(s.seaKing.life.orin.energy).toBe(76); expect(s.progression.mastery['tyrant.s3.remote-tempest']).toBe(0); expect(attempt(s, 'remote-dinghy').result).toBe('ORDINARY');
    reject(s, { type: 'REPORT', caseId: 'remote-dinghy' });
  });
  it('honors rower refusal before departure without a phantom ability success or replacement crew', () => {
    const s = ready(); s.seaKing.life.orin.willing = false; start(s, 'remote-dinghy'); site(s, 'remote-dinghy'); act(s, { type: 'CONSENT_ORIN', caseId: 'remote-dinghy' });
    reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); reject(s, { type: 'REMOTE_WIND', caseId: 'remote-dinghy' }); exit(s, 'remote-dinghy'); act(s, { type: 'REPORT', caseId: 'remote-dinghy' });
    expect(s.seaKing.life.dinghy.travelMetres).toBe(0); expect(s.seaKing.life.orin.energy).toBe(100); expect(attempt(s, 'remote-dinghy')).toMatchObject({ refused: true, result: 'ORDINARY', rowedOut: false, abilityTier: null }); expect(s.spirituality).toBe(120);
  });
  it('lets the real rower return if consent is withdrawn at the buoy without free wind', () => {
    const s = ready(); start(s, 'remote-dinghy'); dinghySetup(s); s.seaKing.life.orin.willing = false;
    reject(s, { type: 'REMOTE_WIND', caseId: 'remote-dinghy' }); act(s, { type: 'ROW_RETURN', caseId: 'remote-dinghy' }); act(s, { type: 'TIE_BOAT', caseId: 'remote-dinghy' }); exit(s, 'remote-dinghy');
    expect(s.seaKing.life.orin.energy).toBe(76); expect(s.spirituality).toBe(120); expect(hasSeaKingLifeLock(s)).toBe(false);
  });
  it('requires the same actual water, boundary and reserved ordinary return resources', () => {
    const s = ready(); start(s, 'remote-dinghy'); site(s, 'remote-dinghy'); act(s, { type: 'CONSENT_ORIN', caseId: 'remote-dinghy' });
    s.seaKing.life.waterSource = 'NONE'; reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); s.seaKing.life.waterSource = 'SEAWATER';
    s.seaKing.life.orin.energy = 23; reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' }); s.seaKing.life.orin.energy = 100;
    s.seaKing.life.dinghy.hull = 0; reject(s, { type: 'ROW_OUT', caseId: 'remote-dinghy' });
  });
  it('physically borrows and returns the original chart even when stopped before departure', () => {
    const s = ready(); start(s, 'remote-dinghy'); site(s, 'remote-dinghy');
    reject(s, { type: 'RETURN_ITEMS', caseId: 'remote-dinghy' }); act(s, { type: 'RETURN_PLAYER', caseId: 'remote-dinghy' }); reject(s, { type: 'CLOSE', caseId: 'remote-dinghy' });
    act(s, { type: 'RETURN_ITEMS', caseId: 'remote-dinghy' }); act(s, { type: 'INSPECT', caseId: 'remote-dinghy' }); act(s, { type: 'WITHDRAW', caseId: 'remote-dinghy' });
    expect(s.seaKing.life.chart.location).toBe('OWNER'); expect(s.seaKing.life.cases['remote-dinghy'].status).toBe('OBSERVED'); reject(s, { type: 'REPORT', caseId: 'remote-dinghy' }); reject(s, { type: 'PREPARE', caseId: 'remote-dinghy', method: 'ABILITY' });
    s.week++; start(s, 'remote-dinghy', 'ORDINARY'); expect(attempt(s, 'remote-dinghy').ownerConsent).toBe('UNASKED'); reject(s, { type: 'GO_SITE', caseId: 'remote-dinghy' });
  });
  it('moves exactly the original 20 water units to the connected cove for one finite window', () => {
    const s = ready(); toWet(s); wetSetup(s); const recess = s.seaKing.life.recess, plate = s.seaKing.life.plate, hook = s.seaKing.life.hook;
    const ctx = act(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18);
    expect(recess).toMatchObject({ waterUnits: 0, displacedToCove: 20, connectedTo: 'SK3-COVE' }); expect(attempt(s, 'wet-recess')).toMatchObject({ windowRemaining: 20, windowElapsed: 0, waterMoved: true });
    reject(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'wet-recess' });
    act(s, { type: 'TAKE_PLATE', caseId: 'wet-recess' }); expect(plate.location).toBe('PLAYER'); expect(hook.durability).toBe(99); expect(attempt(s, 'wet-recess').windowRemaining).toBe(18);
    act(s, { type: 'STOP_WATER', caseId: 'wet-recess' }); expect(recess).toBe(s.seaKing.life.recess); expect(recess).toMatchObject({ waterUnits: 20, displacedToCove: 0 });
    exit(s, 'wet-recess'); act(s, { type: 'REPORT', caseId: 'wet-recess' }); expect(plate).toBe(s.seaKing.life.plate); expect(plate.location).toBe('OWNER'); expect(hook).toMatchObject({ location: 'OWNER', durability: 99 }); expect(s.seaKing.life.windlass).toMatchObject({ location: 'OWNER', durability: 100 }); expect(s.progression.mastery['tyrant.s3.sea-domain']).toBe(8);
  });
  it('requires the actual assistant on a dry bank and original owner consent before any displacement', () => {
    const s = ready(); toWet(s); site(s, 'wet-recess'); reject(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' });
    s.seaKing.life.orin.present = false; reject(s, { type: 'CHECK_ASSISTANT', caseId: 'wet-recess' }); s.seaKing.life.orin.present = true;
    act(s, { type: 'CHECK_ASSISTANT', caseId: 'wet-recess' }); s.seaKing.life.selma.willing = false; reject(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }); exit(s, 'wet-recess');
    expect(s.seaKing.life.recess.waterUnits).toBe(20); expect(s.spirituality).toBe(120); expect(s.seaKing.life.plate.location).toBe('RECESS');
  });
  it('failed displacement does not create dry ground and uses the same ordinary tool at real wear and time', () => {
    const s = ready(); toWet(s); wetSetup(s); act(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }, 100); const before = attempt(s, 'wet-recess').elapsedSeconds;
    expect(s.seaKing.life.recess).toMatchObject({ waterUnits: 20, displacedToCove: 0 }); reject(s, { type: 'TAKE_PLATE', caseId: 'wet-recess' }); reject(s, { type: 'STOP_WATER', caseId: 'wet-recess' }); reject(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' });
    s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'TOOL_RETRIEVE', caseId: 'wet-recess' }); expect(attempt(s, 'wet-recess').elapsedSeconds - before).toBe(6);
    expect(s.seaKing.life.windlass.durability).toBe(98); expect(s.seaKing.life.hook.durability).toBe(100); exit(s, 'wet-recess'); expect(hasSeaKingLifeLock(s)).toBe(false); expect(attempt(s, 'wet-recess').result).toBe('ORDINARY');
  });
  it('expires the full 20 seconds without deleting water and completes ordinary retrieval without ability mastery', () => {
    const s = ready(); toWet(s); wetSetup(s); act(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }); const before = s.seaKing.life.clockSeconds;
    act(s, { type: 'WAIT_WINDOW', caseId: 'wet-recess' }); expect(s.seaKing.life.clockSeconds - before).toBe(20); expect(attempt(s, 'wet-recess')).toMatchObject({ windowRemaining: 0, windowElapsed: 20, waterReturned: true }); expect(s.seaKing.life.recess.waterUnits).toBe(20);
    reject(s, { type: 'TAKE_PLATE', caseId: 'wet-recess' }); reject(s, { type: 'WAIT_WINDOW', caseId: 'wet-recess' }); act(s, { type: 'TOOL_RETRIEVE', caseId: 'wet-recess' }); exit(s, 'wet-recess'); act(s, { type: 'REPORT', caseId: 'wet-recess' });
    expect(s.progression.mastery['tyrant.s3.sea-domain']).toBe(0); expect(attempt(s, 'wet-recess').result).toBe('ORDINARY');
  });
  it('includes hook work in the window clock and automatically returns original water at the cap', () => {
    const s = ready(); toWet(s); wetSetup(s); act(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }); act(s, { type: 'TAKE_PLATE', caseId: 'wet-recess' }); const before = s.seaKing.life.clockSeconds;
    act(s, { type: 'WAIT_WINDOW', caseId: 'wet-recess' }); expect(s.seaKing.life.clockSeconds - before).toBe(18); expect(attempt(s, 'wet-recess').windowElapsed).toBe(20); expect(s.seaKing.life.recess.displacedToCove).toBe(0); exit(s, 'wet-recess');
  });
  it('stops early and preserves the original spent check across a later ordinary continuation', () => {
    const s = ready(); toWet(s); wetSetup(s); act(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }); act(s, { type: 'STOP_WATER', caseId: 'wet-recess' }); exit(s, 'wet-recess');
    expect(s.seaKing.life.cases['wet-recess'].status).toBe('OBSERVED'); s.week++;
    reject(s, { type: 'PREPARE', caseId: 'wet-recess', method: 'ABILITY' }); start(s, 'wet-recess', 'ORDINARY'); wetSetup(s); act(s, { type: 'TOOL_RETRIEVE', caseId: 'wet-recess' }); exit(s, 'wet-recess'); act(s, { type: 'REPORT', caseId: 'wet-recess' });
    expect(s.seaKing.life.cases['wet-recess'].attempts.filter(a => a.abilityTier !== null)).toHaveLength(1); expect(s.spirituality).toBe(114); expect(s.progression.mastery['tyrant.s3.sea-domain']).toBe(0);
  });
  it('does not teleport a recovered plate or restore its original tool on exit or report', () => {
    const s = ready(); toWet(s); wetSetup(s); act(s, { type: 'TOOL_RETRIEVE', caseId: 'wet-recess' });
    reject(s, { type: 'RETURN_ITEMS', caseId: 'wet-recess' }); reject(s, { type: 'CLOSE', caseId: 'wet-recess' }); act(s, { type: 'RETURN_PLAYER', caseId: 'wet-recess' }); expect(s.seaKing.life.plate.location).toBe('PLAYER');
    act(s, { type: 'RETURN_ITEMS', caseId: 'wet-recess' }); expect(s.seaKing.life.plate.location).toBe('OWNER'); expect(s.seaKing.life.windlass.durability).toBe(98); reject(s, { type: 'TOOL_RETRIEVE', caseId: 'wet-recess' });
    act(s, { type: 'INSPECT', caseId: 'wet-recess' }); act(s, { type: 'CLOSE', caseId: 'wet-recess' }); act(s, { type: 'REPORT', caseId: 'wet-recess' }); expect(s.seaKing.life.windlass.durability).toBe(98);
  });
  it('requires a real calm surface and limits recall to two witnessed fragments without any hidden culprit leak', () => {
    const s = ready(); toRecord(s); site(s, 'calm-water-record'); reject(s, { type: 'RECOLLECT', caseId: 'calm-water-record' });
    s.seaKing.life.surfaceCalm = false; reject(s, { type: 'CHECK_CALM', caseId: 'calm-water-record' }); s.seaKing.life.surfaceCalm = true; act(s, { type: 'CHECK_CALM', caseId: 'calm-water-record' });
    const before = projectSeaKingLife(s); expect(JSON.stringify(before)).not.toContain('BLUE_CLOTH'); expect(JSON.stringify(before)).not.toContain('奥林移桶'); expect(before.actions.find(x => x.command.type === 'VERIFY')?.reason).not.toContain('人为移桶');
    const ctx = act(s, { type: 'RECOLLECT', caseId: 'calm-water-record' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18); expect(attempt(s, 'calm-water-record').fragments).toEqual(['BLUE_CLOTH', 'ONE_BELL']);
    const after = projectSeaKingLife(s); expect(JSON.stringify(after)).toContain('BLUE_CLOTH'); expect(JSON.stringify(after)).not.toContain('奥林移桶'); expect(attempt(s, 'calm-water-record').ownerEvidenceRead).toBe(false); reject(s, { type: 'VERIFY', caseId: 'calm-water-record' });
  });
  it('keeps an incorrect current hypothesis and requires actual original witnesses and original owner record to correct it', () => {
    const s = ready(); toRecord(s); recordSetup(s); act(s, { type: 'RECOLLECT', caseId: 'calm-water-record' }); const barrel = s.seaKing.life.barrel;
    act(s, { type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'CURRENT' }); reject(s, { type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'HAND_MOVED' }); reject(s, { type: 'ASK_SELMA', caseId: 'calm-water-record' });
    act(s, { type: 'RETURN_PLAYER', caseId: 'calm-water-record' }); act(s, { type: 'ASK_SELMA', caseId: 'calm-water-record' }); reject(s, { type: 'READ_RECORD', caseId: 'calm-water-record' });
    const metres = s.seaKing.life.playerTravelMetres; act(s, { type: 'ASK_ORIN', caseId: 'calm-water-record' }); expect(s.seaKing.life.playerTravelMetres - metres).toBe(8); expect(s.seaKing.life.playerLocation).toBe('EXIT');
    reject(s, { type: 'VERIFY', caseId: 'calm-water-record' }); act(s, { type: 'READ_RECORD', caseId: 'calm-water-record' }); reject(s, { type: 'VERIFY', caseId: 'calm-water-record' });
    act(s, { type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'HAND_MOVED' }); act(s, { type: 'VERIFY', caseId: 'calm-water-record' }); reject(s, { type: 'CLOSE', caseId: 'calm-water-record' }); exit(s, 'calm-water-record'); act(s, { type: 'REPORT', caseId: 'calm-water-record' });
    expect(attempt(s, 'calm-water-record')).toMatchObject({ hypothesisHistory: ['CURRENT', 'HAND_MOVED'], ownerEvidenceRead: true, verified: true, recordReturned: true, playerTravelMetres: 14 }); expect(barrel).toBe(s.seaKing.life.barrel); expect(barrel.location).toBe('SIDE_BERTH'); expect(s.progression.mastery['tyrant.s3.water-recollection']).toBe(8);
  });
  it('failed recall costs spirituality once, reveals no fragments and allows full ordinary evidence at zero resources', () => {
    const s = ready(); toRecord(s); recordSetup(s); act(s, { type: 'RECOLLECT', caseId: 'calm-water-record' }, 100); expect(attempt(s, 'calm-water-record').fragments).toEqual([]); expect(s.spirituality).toBe(114);
    reject(s, { type: 'RECOLLECT', caseId: 'calm-water-record' }); s.actionsRemaining = 0; s.spirituality = 0; recordEvidence(s); exit(s, 'calm-water-record');
    expect(hasSeaKingLifeLock(s)).toBe(false); expect(attempt(s, 'calm-water-record').result).toBe('ORDINARY'); expect(s.progression.mastery['tyrant.s3.water-recollection']).toBe(0); expect(s.seaKing.life.handoverRecord.location).toBe('OWNER');
  });
  it('can complete all evidence ordinarily without a recall check or fragments', () => {
    const s = ready(); for (const id of SEA_KING_CASE_IDS) finish(s, id); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(120); expect(s.seer.completedSources).toContain('sea-king-reflection'); expect(s.seaKing.life.cases['calm-water-record'].attempts[0]!.abilityTier).toBeNull();
    expect(s.seaKing.life.orin.energy).toBe(76); expect(s.seaKing.life.windlass.durability).toBe(98); expect(s.seaKing.life.recess.waterUnits).toBe(20);
  });
  it('records a correct initial hypothesis as a hypothesis until ordinary evidence is obtained', () => {
    const s = ready(); toRecord(s); recordSetup(s); act(s, { type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'HAND_MOVED' }); reject(s, { type: 'VERIFY', caseId: 'calm-water-record' });
    for (const type of ['RETURN_PLAYER', 'ASK_SELMA', 'ASK_ORIN', 'READ_RECORD', 'VERIFY'] as const) act(s, { type, caseId: 'calm-water-record' });
    expect(attempt(s, 'calm-water-record').hypothesisHistory).toEqual(['HAND_MOVED']); exit(s, 'calm-water-record');
  });
  it('does not borrow owner permission for an unwilling witness and can return the record or chart safely', () => {
    const s = ready(); toRecord(s); recordSetup(s); act(s, { type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'CURRENT' }); act(s, { type: 'RETURN_PLAYER', caseId: 'calm-water-record' });
    s.seaKing.life.orin.willing = false; reject(s, { type: 'ASK_ORIN', caseId: 'calm-water-record' }); reject(s, { type: 'READ_RECORD', caseId: 'calm-water-record' }); exit(s, 'calm-water-record');
    expect(attempt(s, 'calm-water-record')).toMatchObject({ refused: true, result: 'ORDINARY', verified: false, ownerEvidenceRead: false });
  });
  it('honors owner refusal without moving water, objects or the boat and never awards ability growth', () => {
    const s = ready(); s.seaKing.life.selma.willing = false; start(s, 'remote-dinghy'); act(s, { type: 'CONSENT_OWNER', caseId: 'remote-dinghy' });
    reject(s, { type: 'GO_SITE', caseId: 'remote-dinghy' }); exit(s, 'remote-dinghy'); act(s, { type: 'REPORT', caseId: 'remote-dinghy' }); expect(s.progression.acting).toBe(25); expect(s.spirituality).toBe(120); expect(s.seaKing.life.dinghy.travelMetres).toBe(0);
  });
  it('charges exactly four AP per complete case and one reflection, with a single once-only award', () => {
    const s = ready(); const old = { priest: structuredClone(s.cataclysmPriest), singer: structuredClone(s.oceanSinger) };
    for (const id of SEA_KING_CASE_IDS) finish(s, id, 'ABILITY'); expect(s.actionsRemaining).toBe(88); act(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(87);
    expect(s.spirituality).toBe(102); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual({ 'tyrant.s3.sea-domain': 8, 'tyrant.s3.remote-tempest': 8, 'tyrant.s3.water-recollection': 8 });
    for (const id of SEA_KING_CASE_IDS) { reject(s, { type: 'REPORT', caseId: id }); reject(s, { type: 'OBSERVE', caseId: id }); reject(s, { type: 'PREPARE', caseId: id, method: 'ABILITY' }); }
    reject(s, { type: 'REFLECT' }); expect(s.cataclysmPriest).toEqual(old.priest); expect(s.oceanSinger).toEqual(old.singer); expect(s.seer.completedSources.filter(x => x === 'sea-king-reflection')).toHaveLength(1);
  });
  it('requires two AP to prepare, and prepared withdrawal is safe at zero AP without refund', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'remote-dinghy' }); s.actionsRemaining = 1;
    reject(s, { type: 'PREPARE', caseId: 'remote-dinghy', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'remote-dinghy', method: 'ABILITY' }); expect(hasSeaKingLifeLock(s)).toBe(true);
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'remote-dinghy' }); expect(hasSeaKingLifeLock(s)).toBe(false); expect(s.actionsRemaining).toBe(0);
  });
  it('blocks bypassing sequence, city, old original life contact, old ritual and original encounters', () => {
    for (const mutate of [
      (s: SliceState) => { s.progression.sequence = 4; },
      (s: SliceState) => { s.world.city = 'TINGEN'; },
      (s: SliceState) => { s.cataclysmPriest.life.float.location = 'MARK'; },
      (s: SliceState) => { s.cataclysmPriest.life.cases['sea-eddy'].status = 'PREPARED'; },
      (s: SliceState) => { s.cataclysmPriest.ritual.playerLocation = 'PLATFORM'; },
      (s: SliceState) => { s.seaKing.encounter.status = 'READY'; },
      (s: SliceState) => { s.oceanSinger.practice.songOpen = true; },
    ]) { const s = ready(); mutate(s); reject(s, { type: 'OBSERVE', caseId: 'remote-dinghy' }); }
  });
  it('rejects cross-case commands, extra fields, unsupported hypotheses and unbounded time requests', () => {
    expect(validateSeaKingActivityCommand({ type: 'REMOTE_WIND', caseId: 'wet-recess' })).toBe(false);
    expect(validateSeaKingActivityCommand({ type: 'WAIT_WINDOW', caseId: 'wet-recess', seconds: 200 })).toBe(false);
    expect(validateSeaKingActivityCommand({ type: 'HYPOTHESIZE', caseId: 'calm-water-record', hypothesis: 'GUILTY' })).toBe(false);
    expect(validateSeaKingActivityCommand({ type: 'REFLECT', caseId: 'remote-dinghy' })).toBe(false);
    expect(validateSeaKingActivityCommand({ type: 'PREPARE', caseId: 'remote-dinghy', method: 'ABILITY' })).toBe(true);
  });
  it('validates unpromoted default exactly and rejects unknown extra state', () => {
    const s = ready(); s.seaKing.promotionWeek = null; s.seaKing.life = createSeaKingLifeState(); expect(validateSeaKingLife(s)).toBe(true);
    s.seaKing.life.orin.energy = 99; expect(validateSeaKingLife(s)).toBe(false);
    const bad = ready(); Object.assign(bad.seaKing.life, { freeOcean: true }); expect(validateSeaKingLife(bad)).toBe(false);
  });
  it('rejects cloned rowers, erased water, free restoration, forged observations and orphaned objects', () => {
    const source = ready(); for (const id of SEA_KING_CASE_IDS) finish(source, id, 'ABILITY'); act(source, { type: 'REFLECT' });
    const changes: ((s: SliceState) => void)[] = [
      s => { s.seaKing.life.orin.energy = 100; }, s => { s.seaKing.life.orin.location = 'DINGHY'; }, s => { s.seaKing.life.dinghy.occupant = 'SK3-ORIN'; },
      s => { s.seaKing.life.recess.waterUnits = 0; }, s => { s.seaKing.life.recess.displacedToCove = 20; }, s => { s.seaKing.life.hook.durability = 100; },
      s => { s.seaKing.life.plate.location = 'RECESS'; }, s => { s.seaKing.life.handoverRecord.location = 'PLAYER'; }, s => { s.seaKing.life.playerTravelMetres = 0; },
      s => { attempt(s, 'remote-dinghy').boatTravelMetres = 60; }, s => { attempt(s, 'wet-recess').windowRemaining = 21; },
      s => { attempt(s, 'calm-water-record').ownerEvidenceRead = false; }, s => { attempt(s, 'calm-water-record').fragments.push('BLUE_CLOTH'); },
      s => { attempt(s, 'calm-water-record').hypothesisHistory = ['HAND_MOVED']; attempt(s, 'calm-water-record').hypothesis = 'CURRENT'; },
      s => { s.progression.acting = 99; }, s => { s.seer.completedSources.push('sea-king-reflection'); },
    ];
    for (const mutate of changes) { const bad = structuredClone(source); mutate(bad); expect(validateSeaKingLife(bad)).toBe(false); }
  });
  it('preserves truthful active-water and offshore snapshots while rejecting impossible person or water copies', () => {
    const s = ready(); start(s, 'remote-dinghy'); dinghySetup(s); expect(validateSeaKingLife(structuredClone(s))).toBe(true);
    const clone = structuredClone(s); clone.seaKing.life.orin.location = 'PIER'; expect(validateSeaKingLife(clone)).toBe(false);
    act(s, { type: 'ROW_RETURN', caseId: 'remote-dinghy' }); act(s, { type: 'TIE_BOAT', caseId: 'remote-dinghy' }); exit(s, 'remote-dinghy'); act(s, { type: 'REPORT', caseId: 'remote-dinghy' });
    start(s, 'wet-recess'); wetSetup(s); act(s, { type: 'DIVERT_WATER', caseId: 'wet-recess' }); expect(validateSeaKingLife(structuredClone(s))).toBe(true);
    const copiedWater = structuredClone(s); copiedWater.seaKing.life.recess.waterUnits = 20; expect(validateSeaKingLife(copiedWater)).toBe(false);
  });
});
