import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createWandererState } from '../../src/domain/wanderer/index.js';
import { applyWandererActivity, blockWandererLife, createWandererLifeState, hasWandererLifeLock, projectWandererLife, validateWandererActivityCommand, validateWandererLife, WANDERER_CASE_IDS, type WandererActivityCommand, type WandererCaseId } from '../../src/domain/wanderer/life.js';

const STAR = 'door.s3.star-wandering', POSITION = 'door.s3.astral-positioning';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Directed isolated product fixture, not a claim of naturally reaching sequence 3. */
function ready(): SliceState {
  const s = createSliceRun('wanderer-life', sliceDefaultCreationSelection, 'wanderer-life');
  s.wanderer = createWandererState(); s.week = 100; s.wanderer.promotionWeek = 99; s.wanderer.secretsSorcererActingAtPromotion = 100;
  s.progression = { pathwayId: 'door', sequence: 3, acting: 0, promotionWeek: 99, mastery: { [STAR]: 0, [POSITION]: 0, 'door.s4.space-concealment': 37 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, c: WandererActivityCommand, roll = 1) { const ctx = context(s, roll); applyWandererActivity(s, c, ctx); expect(validateWandererLife(s), `${c.type}: ${JSON.stringify(s.wanderer.life)}`).toBe(true); return ctx; }
function step(s: SliceState, caseId: WandererCaseId, type: Exclude<WandererActivityCommand['type'], 'PREPARE' | 'REFLECT' | 'DEPART' | 'VIEW_HORIZON'>, roll = 1) { return act(s, { type, caseId } as WandererActivityCommand, roll); }
function reject(s: SliceState, c: WandererActivityCommand) { const before = structuredClone(s); expect(() => applyWandererActivity(s, c, context(s))).toThrow(); expect(s).toEqual(before); }
const attempt = (s: SliceState, id: WandererCaseId) => s.wanderer.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, id: WandererCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'PERFORM'); }
function close(s: SliceState, id: WandererCaseId) { step(s, id, 'INSPECT'); step(s, id, 'CLOSE'); step(s, id, 'REPORT'); }
function finishAnchor(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'anchor-check'; start(s, id, method);
  for (const type of ['CONSENT_OWNER', 'TAKE_ANCHOR', 'GO_SITE', 'PLACE_ANCHOR', 'READ_COORDINATES'] as const) step(s, id, type);
  if (method === 'ABILITY') step(s, id, 'ALIGN_ANCHOR', roll);
  if (!attempt(s, id).anchorCalibrated) step(s, id, 'MANUAL_ALIGN');
  step(s, id, 'RETURN_PLAYER'); close(s, id);
}
function prepareVisit(s: SliceState, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'offworld-visit'; start(s, id, method);
  for (const type of ['CONSENT_OWNER', 'BORROW_SUIT', 'CHECK_SUIT', 'GO_SITE', 'CHECK_DEPARTURE'] as const) step(s, id, type);
}
function finishVisit(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', takePacket = true) {
  prepareVisit(s, method);
  if (method === 'ABILITY') act(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true }, roll);
  if (attempt(s, 'offworld-visit').departed) { step(s, 'offworld-visit', 'CHECK_RETURN_MARKER'); if (takePacket) step(s, 'offworld-visit', 'TAKE_PACKET'); step(s, 'offworld-visit', 'RETURN_LOCAL'); }
  else step(s, 'offworld-visit', 'STOP_CONTACT');
  step(s, 'offworld-visit', 'RETURN_PLAYER'); step(s, 'offworld-visit', 'RETURN_SUIT'); close(s, 'offworld-visit');
}
function finishHandoff(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'original-handoff'; start(s, id, method);
  for (const type of ['CONSENT_OWNER', 'GO_SITE', 'CONSENT_RECIPIENT', 'CHECK_PACKET_RECORDS'] as const) step(s, id, type);
  if (s.wanderer.life.packet.location === 'PLAYER') {
    if (method === 'ABILITY') step(s, id, 'COMPARE_RECORDS', roll);
    if (!attempt(s, id).recordsCompared) step(s, id, 'MANUAL_COMPARE'); step(s, id, 'HAND_PACKET');
  } else step(s, id, 'FILE_NONRETURN');
  step(s, id, 'RETURN_PLAYER');
  if (s.wanderer.life.anchor.location === 'PAD') { step(s, id, 'GO_ANCHOR'); step(s, id, 'RECOVER_ANCHOR'); step(s, id, 'RETURN_PLAYER'); step(s, id, 'RETURN_ANCHOR'); }
  close(s, id);
}

describe('Wanderer finite offworld body, original resources and three connected G cases', () => {
  it('begins with the same existing remote packet, original suit and independent current adults', () => {
    const s = ready(), l = s.wanderer.life; expect(validateWandererLife(s)).toBe(true);
    expect(l).toMatchObject({ playerLocation: 'START', introducedWeek: null, packet: { id: 'WN3-PACKET', location: 'REMOTE', source: 'PRIOR_RECORDED_DELIVERY', quantity: 1 }, suit: { id: 'WN3-SUIT', location: 'OWNER', protectionSeconds: 90 }, anchor: { id: 'WN3-ANCHOR', location: 'OWNER', status: 'UNCHECKED' }, energy: { remaining: 2, spent: 0 } });
    expect(l.nora).toMatchObject({ age: 41, location: 'START' }); expect(l.elias).toMatchObject({ age: 37, location: 'OFFICE' });
    expect(projectWandererLife(s).story).toContain('原创G'); expect(projectWandererLife(s).story).toContain('共13行动'); expect(projectWandererLife(s).story).toContain('非真空免疫');
  });
  it('preserves the real calendar epoch when the first current scene is introduced', () => {
    const s = ready(); s.date = { epoch: 'FIFTH_EPOCH', year: 1351, month: 9, day: 25 }; step(s, 'anchor-check', 'OBSERVE');
    expect(s.wanderer.life.introducedDate).toEqual(s.date); expect(validateWandererLife(s)).toBe(true);
    const forged = structuredClone(s); (forged.wanderer.life.introducedDate as unknown as { epoch: string }).epoch = 'UNKNOWN'; expect(validateWandererLife(forged)).toBe(false);
  });
  it('requires original owner consent and real carrying before anchoring, then leaves the original at PAD', () => {
    const s = ready(); start(s, 'anchor-check'); reject(s, { type: 'TAKE_ANCHOR', caseId: 'anchor-check' });
    step(s, 'anchor-check', 'CONSENT_OWNER'); reject(s, { type: 'GO_SITE', caseId: 'anchor-check' }); step(s, 'anchor-check', 'TAKE_ANCHOR'); reject(s, { type: 'PLACE_ANCHOR', caseId: 'anchor-check' });
    step(s, 'anchor-check', 'GO_SITE'); step(s, 'anchor-check', 'PLACE_ANCHOR'); reject(s, { type: 'ALIGN_ANCHOR', caseId: 'anchor-check' }); step(s, 'anchor-check', 'READ_COORDINATES');
    const ctx = step(s, 'anchor-check', 'ALIGN_ANCHOR'); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); step(s, 'anchor-check', 'RETURN_PLAYER'); close(s, 'anchor-check');
    expect(s.wanderer.life.anchor).toMatchObject({ location: 'PAD', status: 'CALIBRATED', travelMetres: 4 }); expect(s.wanderer.life.playerTravelMetres).toBe(8); expect(s.progression.mastery[POSITION]).toBe(8);
  });
  it('retains a failed alignment cost, uses actual twenty-second manual checking and cannot reroll', () => {
    const s = ready(); finishAnchor(s, 100); const a = attempt(s, 'anchor-check');
    expect(a).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, manualAlignment: true, anchorCalibrated: true, result: 'ORDINARY', elapsedSeconds: 40 });
    expect(s.progression.mastery[POSITION]).toBe(0); expect(s.wanderer.life.anchor.status).toBe('CALIBRATED'); reject(s, { type: 'ALIGN_ANCHOR', caseId: 'anchor-check' });
  });
  it('keeps departure separate from preparation and blocks absent confirmation or arbitrary destinations', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s);
    expect(attempt(s, 'offworld-visit').ownerConsent).toBe('GRANTED'); expect(s.wanderer.life.playerLocation).toBe('PAD');
    expect(validateWandererActivityCommand({ type: 'DEPART', caseId: 'offworld-visit' })).toBe(false);
    expect(validateWandererActivityCommand({ type: 'DEPART', caseId: 'offworld-visit', confirm: false })).toBe(false);
    expect(validateWandererActivityCommand({ type: 'DEPART', caseId: 'offworld-visit', confirm: true, destination: 'ANY_STAR' })).toBe(false);
    const action = projectWandererLife(s).actions.find(x => x.command.type === 'DEPART')!; expect(action.command).toEqual({ type: 'DEPART', caseId: 'offworld-visit', confirm: true }); expect(action.label).toContain('污染'); expect(action.cost).toContain('18灵性');
  });
  it('moves the original body and suit to the original remote dock, then carries the same original packet back', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); const l = s.wanderer.life, suit = l.suit, packet = l.packet, anchor = l.anchor;
    const ctx = act(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 20);
    expect(l.playerLocation).toBe('REMOTE'); expect(l.packet.location).toBe('REMOTE'); expect(l.suit).toBe(suit); expect(l.anchor).toBe(anchor); expect(l.suit.protectionSeconds).toBe(90); expect(s.spirituality).toBe(106); expect(l.energy.remaining).toBe(1);
    reject(s, { type: 'RETURN_PLAYER', caseId: 'offworld-visit' }); reject(s, { type: 'CLOSE', caseId: 'offworld-visit' }); reject(s, { type: 'RETURN_LOCAL', caseId: 'offworld-visit' });
    step(s, 'offworld-visit', 'CHECK_RETURN_MARKER'); step(s, 'offworld-visit', 'TAKE_PACKET'); expect(l.packet).toBe(packet); expect(packet.location).toBe('PLAYER'); expect(l.suit.protectionSeconds).toBe(82);
    step(s, 'offworld-visit', 'RETURN_LOCAL'); expect(l.playerLocation).toBe('PAD'); expect(s.spirituality).toBe(98); expect(l.energy).toMatchObject({ remaining: 0, spent: 2 }); expect(l.suit).toMatchObject({ protectionSeconds: 72, remoteSeconds: 18, offworldLegs: 2 }); expect(packet.offworldLegs).toBe(1);
    expect(attempt(s, 'offworld-visit').playerMoves.filter(x => x.mode === 'STAR_WANDERING')).toEqual([
      { from: 'PAD', to: 'REMOTE', mode: 'STAR_WANDERING', metres: null, seconds: 10, anchorCarried: false, suitCarried: true, packetCarried: false },
      { from: 'REMOTE', to: 'PAD', mode: 'STAR_WANDERING', metres: null, seconds: 10, anchorCarried: false, suitCarried: true, packetCarried: true },
    ]);
    step(s, 'offworld-visit', 'RETURN_PLAYER'); step(s, 'offworld-visit', 'RETURN_SUIT'); close(s, 'offworld-visit'); expect(s.progression.mastery[STAR]).toBe(8); expect(l.nora.location).toBe('START'); expect(l.elias.location).toBe('OFFICE');
  });
  it('charges failed departure once, leaves the body at PAD and reports the packet honestly later', () => {
    const s = ready(); finishAnchor(s); finishVisit(s, 100); const l = s.wanderer.life;
    expect(attempt(s, 'offworld-visit')).toMatchObject({ failedDeparture: true, departed: false, returnedLocal: false, spiritualitySpent: 8, energySpent: 1, pollutionAdded: 2, result: 'ORDINARY' });
    expect(l.packet.location).toBe('REMOTE'); expect(l.energy.remaining).toBe(1); expect(l.suit.protectionSeconds).toBe(90); expect(s.mind).toBe(95); expect(s.seer.pollution).toBe(2); expect(s.progression.mastery[STAR]).toBe(0);
    finishHandoff(s); expect(attempt(s, 'original-handoff')).toMatchObject({ nonreturnFiled: true, packetHanded: false, spiritualitySpent: 0, result: 'ORDINARY' }); expect(l.packet.location).toBe('REMOTE'); expect(l.anchor.location).toBe('OWNER');
    reject(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true }); expect(l.energy.remaining).toBe(1);
  });
  it('allows choosing never to depart and completes all reports through local ordinary work at zero spirituality', () => {
    const s = ready(); s.spirituality = 0; finishAnchor(s, 1, 'ORDINARY'); finishVisit(s, 1, 'ORDINARY'); finishHandoff(s, 1, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(0); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[STAR]).toBe(0); expect(s.progression.mastery[POSITION]).toBe(0); expect(s.wanderer.life.packet.location).toBe('REMOTE'); expect(s.wanderer.life.energy.remaining).toBe(2); expect(s.wanderer.life.suit.protectionSeconds).toBe(90); expect(hasWandererLifeLock(s)).toBe(false);
  });
  it('can return without viewing the sky or taking the packet, with no invented delivery or extra reward', () => {
    const s = ready(); finishAnchor(s); finishVisit(s, 1, 'ABILITY', false); finishHandoff(s);
    expect(attempt(s, 'offworld-visit')).toMatchObject({ horizonViewed: false, departed: true, returnedLocal: true, packetTaken: false, pollutionAdded: 0 });
    expect(s.wanderer.life.packet).toMatchObject({ location: 'REMOTE', offworldLegs: 0, travelMetres: 0 }); expect(s.progression.mastery[STAR]).toBe(8); expect(attempt(s, 'original-handoff').nonreturnFiled).toBe(true); expect(s.wanderer.life.suit.protectionSeconds).toBe(75);
  });
  it('requires a separate optional horizon confirmation and retains finite contamination without rewarding it', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); act(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true });
    expect(validateWandererActivityCommand({ type: 'VIEW_HORIZON', caseId: 'offworld-visit' })).toBe(false);
    act(s, { type: 'VIEW_HORIZON', caseId: 'offworld-visit', confirm: true }); expect(s.mind).toBe(94); expect(s.seer.pollution).toBe(3); expect(s.wanderer.life.suit.protectionSeconds).toBe(88); expect(s.progression.mastery[STAR]).toBe(0);
    reject(s, { type: 'VIEW_HORIZON', caseId: 'offworld-visit', confirm: true }); step(s, 'offworld-visit', 'CHECK_RETURN_MARKER'); step(s, 'offworld-visit', 'RETURN_LOCAL'); step(s, 'offworld-visit', 'RETURN_PLAYER'); step(s, 'offworld-visit', 'RETURN_SUIT'); close(s, 'offworld-visit'); expect(s.progression.mastery[STAR]).toBe(8); expect(s.seer.pollution).toBe(3);
  });
  it('requires the actual reserve and rejects untreated disabling injury before departure', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); const command = { type: 'DEPART', caseId: 'offworld-visit', confirm: true } as const;
    s.spirituality = 17; reject(s, command); s.spirituality = 18; s.injuries.push({ id: 'test-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }); reject(s, command); s.injuries[0]!.treatedRevision = 2; expect(blockWandererLife(s, command)).toBeNull();
    act(s, command); expect(s.spirituality).toBe(10); step(s, 'offworld-visit', 'CHECK_RETURN_MARKER'); step(s, 'offworld-visit', 'RETURN_LOCAL'); expect(s.spirituality).toBe(2);
  });
  it('does not transform zero-spirituality ordinary exit into a remote escape or reset the reserve', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); act(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true }); step(s, 'offworld-visit', 'CHECK_RETURN_MARKER'); s.spirituality = 0;
    reject(s, { type: 'RETURN_LOCAL', caseId: 'offworld-visit' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'offworld-visit' }); reject(s, { type: 'WITHDRAW', caseId: 'offworld-visit' }); expect(s.wanderer.life.playerLocation).toBe('REMOTE'); expect(hasWandererLifeLock(s)).toBe(true);
  });
  it('preserves original borrowed gear and ordinary local return after refusal or revoked consent at zero AP/S', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); s.wanderer.life.nora.willing = false; s.actionsRemaining = 0; s.spirituality = 0;
    reject(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true }); step(s, 'offworld-visit', 'STOP_CONTACT'); step(s, 'offworld-visit', 'RETURN_PLAYER'); step(s, 'offworld-visit', 'RETURN_SUIT'); step(s, 'offworld-visit', 'INSPECT'); step(s, 'offworld-visit', 'CLOSE');
    expect(hasWandererLifeLock(s)).toBe(false); expect(s.wanderer.life.suit.location).toBe('OWNER'); expect(s.wanderer.life.energy.remaining).toBe(2); expect(s.wanderer.life.packet.location).toBe('REMOTE');
  });
  it('retains the existing paid remote return after consent is revoked rather than demanding new dangerous work', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); act(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true }); s.wanderer.life.nora.willing = false; s.actionsRemaining = 0;
    step(s, 'offworld-visit', 'STOP_CONTACT'); step(s, 'offworld-visit', 'CHECK_RETURN_MARKER'); reject(s, { type: 'TAKE_PACKET', caseId: 'offworld-visit' }); step(s, 'offworld-visit', 'RETURN_LOCAL'); step(s, 'offworld-visit', 'RETURN_PLAYER'); step(s, 'offworld-visit', 'RETURN_SUIT'); step(s, 'offworld-visit', 'INSPECT'); step(s, 'offworld-visit', 'CLOSE');
    expect(s.wanderer.life.playerLocation).toBe('START'); expect(s.wanderer.life.packet.location).toBe('REMOTE'); expect(s.wanderer.life.energy.remaining).toBe(0);
  });
  it('consumes real remote protection and saves a deliberate fatal delay at the actual remote body position', () => {
    const s = ready(); s.health = 15; finishAnchor(s); prepareVisit(s); act(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true });
    for (let i = 0; i < 9; i++) step(s, 'offworld-visit', 'WAIT_EXPOSURE'); expect(s.health).toBe(15); expect(s.wanderer.life.suit.protectionSeconds).toBe(0);
    step(s, 'offworld-visit', 'WAIT_EXPOSURE'); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0); expect(s.mind).toBe(95); expect(s.wanderer.life.playerLocation).toBe('REMOTE'); expect(s.wanderer.life.suit.location).toBe('PLAYER'); expect(s.wanderer.life.packet.location).toBe('REMOTE'); expect(attempt(s, 'offworld-visit')).toMatchObject({ exposureActions: 1, healthLost: 15, remoteSeconds: 100, returnedLocal: false });
    reject(s, { type: 'RETURN_LOCAL', caseId: 'offworld-visit' }); reject(s, { type: 'CLOSE', caseId: 'offworld-visit' }); expect(validateWandererLife(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
  });
  it('requires actual receiver consent and preserves a refused original packet for ordinary owner return', () => {
    const s = ready(); finishAnchor(s); finishVisit(s); s.wanderer.life.elias.willing = false; start(s, 'original-handoff'); step(s, 'original-handoff', 'CONSENT_OWNER'); step(s, 'original-handoff', 'GO_SITE'); step(s, 'original-handoff', 'CONSENT_RECIPIENT');
    reject(s, { type: 'HAND_PACKET', caseId: 'original-handoff' }); step(s, 'original-handoff', 'STOP_CONTACT'); step(s, 'original-handoff', 'RETURN_PLAYER'); step(s, 'original-handoff', 'RETURN_PACKET'); step(s, 'original-handoff', 'GO_ANCHOR'); step(s, 'original-handoff', 'RECOVER_ANCHOR'); step(s, 'original-handoff', 'RETURN_PLAYER'); step(s, 'original-handoff', 'RETURN_ANCHOR'); close(s, 'original-handoff');
    expect(s.wanderer.life.packet).toMatchObject({ location: 'OWNER', travelMetres: 24, offworldLegs: 1 }); expect(attempt(s, 'original-handoff').result).toBe('ORDINARY'); expect(s.progression.mastery[POSITION]).toBe(8);
  });
  it('finishes a failed record comparison manually and does not disguise it as ability mastery', () => {
    const s = ready(); finishAnchor(s); finishVisit(s); finishHandoff(s, 100); expect(attempt(s, 'original-handoff')).toMatchObject({ abilityTier: 'GREAT_FAILURE', manualComparison: true, recordsCompared: true, packetHanded: true, spiritualitySpent: 6, result: 'ORDINARY' }); expect(s.progression.mastery[POSITION]).toBe(8); expect(s.wanderer.life.packet.location).toBe('OWNER_ARCHIVE');
  });
  it('completes exactly thirteen AP with real original custody, finite costs and inherited history untouched', () => {
    const s = ready(), old = structuredClone({ secretsSorcerer: s.secretsSorcerer, traveler: s.traveler, recorder: s.recorder, apprentice: s.apprentice }); finishAnchor(s); finishVisit(s); finishHandoff(s); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(92); expect(s.wanderer.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 44, clockSeconds: 119, anchor: { location: 'OWNER', status: 'CALIBRATED', travelMetres: 8 }, suit: { location: 'OWNER', protectionSeconds: 72, travelMetres: 8, offworldLegs: 2 }, packet: { location: 'OWNER_ARCHIVE', travelMetres: 14, offworldLegs: 1 }, energy: { remaining: 0, spent: 2 } });
    expect(s.progression.mastery).toMatchObject({ [STAR]: 8, [POSITION]: 16, 'door.s4.space-concealment': 37 }); expect({ secretsSorcerer: s.secretsSorcerer, traveler: s.traveler, recorder: s.recorder, apprentice: s.apprentice }).toEqual(old); expect(hasWandererLifeLock(s)).toBe(false); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'offworld-visit' });
  });
  it('saves and reloads the exact remote body, remaining protection and carried original packet', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); act(s, { type: 'DEPART', caseId: 'offworld-visit', confirm: true }); step(s, 'offworld-visit', 'CHECK_RETURN_MARKER'); step(s, 'offworld-visit', 'TAKE_PACKET');
    const loaded: SliceState = JSON.parse(JSON.stringify(s)); expect(validateWandererLife(loaded)).toBe(true); expect(loaded.wanderer.life).toEqual(s.wanderer.life); reject(loaded, { type: 'DEPART', caseId: 'offworld-visit', confirm: true });
    step(loaded, 'offworld-visit', 'RETURN_LOCAL'); step(loaded, 'offworld-visit', 'RETURN_PLAYER'); step(loaded, 'offworld-visit', 'RETURN_SUIT'); close(loaded, 'offworld-visit'); expect(loaded.wanderer.life.packet.location).toBe('PLAYER'); expect(loaded.wanderer.life.suit.protectionSeconds).toBe(72);
  });
  it('does not expose mutable scene originals or movement history through projection', () => {
    const s = ready(); finishAnchor(s); prepareVisit(s); const view = projectWandererLife(s); view.anchor.location = 'OWNER'; view.energy.remaining = 0; view.currentAttempt!.playerMoves[0]!.metres = 999; view.cases[0]!.attempts[0]!.steps[0]!.noraWilling = false;
    expect(s.wanderer.life.anchor.location).toBe('PAD'); expect(s.wanderer.life.energy.remaining).toBe(2); expect(attempt(s, 'offworld-visit').playerMoves[0]!.metres).toBe(4); expect(attempt(s, 'anchor-check').steps[0]!.noraWilling).toBe(true);
  });
  it('requires two AP before preparation and permits zero-AP cancellation without refunding the preparation', () => {
    const s = ready(); step(s, 'anchor-check', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'anchor-check', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'anchor-check', method: 'ABILITY' }); s.actionsRemaining = 0; step(s, 'anchor-check', 'WITHDRAW'); expect(s.wanderer.life.cases['anchor-check'].status).toBe('OBSERVED'); expect(hasWandererLifeLock(s)).toBe(false);
  });
  it('rejects duplicated originals, false body returns, replenished gear, invented traces and duplicate rewards on save', () => {
    const s = ready(); finishAnchor(s); finishVisit(s); finishHandoff(s); act(s, { type: 'REFLECT' });
    for (const mutate of [
      (x: SliceState) => { x.wanderer.life.energy.remaining = 2; },
      (x: SliceState) => { x.wanderer.life.suit.protectionSeconds = 90; },
      (x: SliceState) => { x.wanderer.life.packet.location = 'REMOTE'; },
      (x: SliceState) => { x.wanderer.life.playerLocation = 'REMOTE'; },
      (x: SliceState) => { x.wanderer.life.anchor.travelMetres = 0; },
      (x: SliceState) => { x.wanderer.life.clockSeconds++; },
      (x: SliceState) => { attempt(x, 'offworld-visit').playerMoves[1]!.metres = 12345; },
      (x: SliceState) => { attempt(x, 'offworld-visit').returnedLocal = false; },
      (x: SliceState) => { attempt(x, 'offworld-visit').steps = []; },
      (x: SliceState) => { (x.wanderer.life.packet as { quantity: number }).quantity = 2; },
      (x: SliceState) => { x.seer.completedSources.push('wanderer-reflection'); },
    ]) { const copy = structuredClone(s); mutate(copy); expect(validateWandererLife(copy)).toBe(false); }
  });
  it('uses exact narrow command shapes and exposes only the three finite cases', () => {
    expect(WANDERER_CASE_IDS).toEqual(['anchor-check', 'offworld-visit', 'original-handoff']); expect(createWandererLifeState().endpoints.remoteId).toBe('WN3-REMOTE-DOCK');
    expect(validateWandererActivityCommand({ type: 'HAND_PACKET', caseId: 'anchor-check' })).toBe(false); expect(validateWandererActivityCommand({ type: 'DEPART', caseId: 'original-handoff', confirm: true })).toBe(false); expect(validateWandererActivityCommand({ type: 'REFLECT', caseId: 'anchor-check' })).toBe(false); expect(validateWandererActivityCommand({ type: 'RETURN_LOCAL', caseId: 'offworld-visit', free: true })).toBe(false);
  });
});
