import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createSecretsSorcererState } from '../../src/domain/secrets-sorcerer/index.js';
import { SECRETS_SORCERER_ABILITY_IDS } from '../../src/domain/secrets-sorcerer/types.js';
import { applySecretsSorcererActivity, createSecretsSorcererLifeState, hasSecretsSorcererLifeLock, projectSecretsSorcererLife, secretsSorcererLifeActions, SECRETS_SORCERER_CASE_IDS, SECRETS_SORCERER_ITEM_IDS, validateSecretsSorcererActivityCommand, validateSecretsSorcererLife, type SecretsSorcererActivityCommand, type SecretsSorcererCaseId } from '../../src/domain/secrets-sorcerer/life.js';

/** Directed isolated post-promotion fixture; full real S5 original history is retained. */
function ready(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/traveler-v01050/natural.json', 'utf8')).final);
  s.week += 12; s.date = addGameWeeks(s.date, 12);
  s.secretsSorcerer = createSecretsSorcererState(); s.secretsSorcerer.promotionWeek = s.week; s.secretsSorcerer.travelerActingAtPromotion = 100;
  s.progression.sequence = 4; s.progression.acting = 0; s.progression.promotionWeek = s.week;
  for (const id of SECRETS_SORCERER_ABILITY_IDS) s.progression.mastery[id] = 0;
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 120; s.cash = 10000;
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (!s.seer.completedSources.includes(source)) { s.seer.completedSources.push(source); s.progression.mastery[SECRETS_SORCERER_ABILITY_IDS[0]]! += amount; } });
  return { ctx, award };
}
function act(s: SliceState, command: SecretsSorcererActivityCommand, roll = 1) { const c = context(s, roll); applySecretsSorcererActivity(s, command, c.ctx, c.award); expect(validateSecretsSorcererLife(s)).toBe(true); return c; }
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), c = context(s); expect(() => applySecretsSorcererActivity(s, command as SecretsSorcererActivityCommand, c.ctx, c.award)).toThrow(); expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled(); }
function prepare(s: SliceState, caseId: SecretsSorcererCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { if (s.secretsSorcerer.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); }
function nextWeek(s: SliceState) { s.week++; s.date = addGameWeeks(s.date, 1); }
function exchange(s: SliceState) { for (const itemId of SECRETS_SORCERER_ITEM_IDS) act(s, { type: 'STORE_ITEM', itemId }); for (const itemId of SECRETS_SORCERER_ITEM_IDS) { act(s, { type: 'TAKE_ITEM', itemId }); if (itemId !== 'SS4-COIN-1') act(s, { type: 'RETURN_ITEM', itemId }); } }
function complete(s: SliceState, caseId: SecretsSorcererCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  prepare(s, caseId, method); if (caseId === 'temporary-banishment' && method === 'ABILITY') act(s, { type: 'SECURE_TARGET' }); act(s, { type: 'PERFORM', caseId });
  if (caseId === 'hidden-room') { act(s, { type: 'EXIT_ROOM' }); if (method === 'ABILITY') act(s, { type: 'STOP_HIDING' }); }
  if (caseId === 'original-pocket') { exchange(s); act(s, { type: 'STOP_POCKET' }); }
  if (caseId === 'temporary-banishment' && method === 'ABILITY') { act(s, { type: 'WAIT_RETURN' }); act(s, { type: 'RELEASE_RESTRAINT' }); }
  act(s, { type: 'CLOSE', caseId }); act(s, { type: 'REPORT', caseId });
}
const oldDoor = (s: SliceState) => structuredClone([s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler]);
const mastery = (s: SliceState) => Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0);
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.flat().join(' ');

describe('Secrets Sorcerer actual original spaces and temporary same-body return', () => {
  it('creates only one original room, door, finite bag, three objects and weak echo', () => {
    const s = ready(); expect(s.secretsSorcerer.life).toEqual(createSecretsSorcererLifeState()); expect(validateSecretsSorcererLife(s)).toBe(true);
    expect(s.secretsSorcerer.life.room).toMatchObject({ id: 'SS4-ROOM', doorId: 'SS4-DOOR', position: 'OUTSIDE', hidden: false });
    expect(s.secretsSorcerer.life.pocket.items.map(i => i.id)).toEqual([...SECRETS_SORCERER_ITEM_IDS]); expect(s.secretsSorcerer.life.pocket.capacity).toBe(3);
    expect(s.secretsSorcerer.life.banishment).toMatchObject({ id: 'SS4-ECHO-G', location: 'ORIGINAL_CAGE', restrained: false, cageClosed: true });
    expect(hasSecretsSorcererLifeLock(s)).toBe(false); expect(projectSecretsSorcererLife(s).cases.every(c => c.observations.length === 0)).toBe(true);
  });
  it('actually walks through the unique original door before folding the same room', () => {
    const s = ready(), old = oldDoor(s); prepare(s, 'hidden-room'); expect(s.secretsSorcerer.life.room.position).toBe('OUTSIDE');
    const spirit = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'hidden-room' }); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(spirit - 6);
    expect(s.secretsSorcerer.life.room).toMatchObject({ position: 'INSIDE', hidden: true, entries: 1, exits: 0, companionPosition: 'OUTSIDE', consent: true });
    expect(hasSecretsSorcererLifeLock(s)).toBe(true); reject(s, { type: 'STOP_HIDING' }); reject(s, { type: 'CLOSE', caseId: 'hidden-room' }); reject(s, { type: 'REPORT', caseId: 'hidden-room' });
    expect(oldDoor(s)).toEqual(old);
  });
  it('zero-action door exit and stopping remain possible at zero AP, mind and spirit', () => {
    const s = ready(); prepare(s, 'hidden-room'); act(s, { type: 'PERFORM', caseId: 'hidden-room' }); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0;
    act(s, { type: 'EXIT_ROOM' }); expect(s.secretsSorcerer.life.room.hidden).toBe(true); reject(s, { type: 'CLOSE', caseId: 'hidden-room' }); act(s, { type: 'STOP_HIDING' });
    const c = act(s, { type: 'CLOSE', caseId: 'hidden-room' }); expect(c.award).toHaveBeenCalledWith('secrets-sorcerer-practice:hidden-room', 5);
    expect([s.actionsRemaining, s.mind, s.spirituality]).toEqual([0, 0, 0]); expect(hasSecretsSorcererLifeLock(s)).toBe(false); expect(s.secretsSorcerer.life.room).toMatchObject({ entries: 1, exits: 1, folds: 1, unfoldings: 1, consent: false });
    reject(s, { type: 'EXIT_ROOM' }); reject(s, { type: 'STOP_HIDING' });
  });
  it('failed folding spends spirit and retains actual room entry without inventing hiding', () => {
    const s = ready(); prepare(s, 'hidden-room'); const spirit = s.spirituality; act(s, { type: 'PERFORM', caseId: 'hidden-room' }, 100);
    expect(s.spirituality).toBe(spirit - 6); expect(s.secretsSorcerer.life.room).toMatchObject({ position: 'INSIDE', hidden: false, folds: 0 }); reject(s, { type: 'STOP_HIDING' });
    act(s, { type: 'EXIT_ROOM' }); const close = act(s, { type: 'CLOSE', caseId: 'hidden-room' }); expect(close.award).not.toHaveBeenCalled(); reject(s, { type: 'PREPARE', caseId: 'hidden-room', method: 'ABILITY' });
    nextWeek(s); complete(s, 'hidden-room'); expect(s.secretsSorcerer.life.room.entries).toBe(2); expect(s.secretsSorcerer.life.room.exits).toBe(2);
  });
  it('ordinary curtains use the real room and door with no magical space or mastery', () => {
    const s = ready(), before = mastery(s), spirit = s.spirituality; complete(s, 'hidden-room', 'ORDINARY'); expect(s.secretsSorcerer.life.room).toMatchObject({ entries: 1, exits: 1, folds: 0, unfoldings: 0, hidden: false });
    expect(s.spirituality).toBe(spirit); expect(mastery(s)).toBe(before); expect(s.progression.acting).toBe(25);
  });
  it('creates a paid bounded link but does not conjure or automatically store objects', () => {
    const s = ready(); prepare(s, 'original-pocket'); expect(s.cash).toBe(9920); expect(s.secretsSorcerer.life.pocket.films[0]).toMatchObject({ id: 'SS4-FILM-1', consumedWeek: null });
    const c = act(s, { type: 'PERFORM', caseId: 'original-pocket' }); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(114);
    expect(s.secretsSorcerer.life.pocket).toMatchObject({ linked: true, expiresWeek: s.week + 1, capacity: 3 }); expect(s.secretsSorcerer.life.pocket.items.map(i => i.location)).toEqual(['DESK', 'PLAYER', 'DESK']);
    reject(s, { type: 'CLOSE', caseId: 'original-pocket' }); reject(s, { type: 'STOP_POCKET' }); reject(s, { type: 'TAKE_ITEM', itemId: 'SS4-CARD-1' }); reject(s, { type: 'STORE_ITEM', itemId: 'OTHER-ARTIFACT' });
  });
  it('moves each of the same three originals and retains both weak stone costs', () => {
    const s = ready(), old = oldDoor(s); prepare(s, 'original-pocket'); act(s, { type: 'PERFORM', caseId: 'original-pocket' }); const ap = s.actionsRemaining, mind = s.mind;
    for (const itemId of SECRETS_SORCERER_ITEM_IDS) act(s, { type: 'STORE_ITEM', itemId }); expect(s.secretsSorcerer.life.pocket.items.every(i => i.location === 'POCKET')).toBe(true); expect(s.mind).toBe(mind - 1);
    reject(s, { type: 'STORE_ITEM', itemId: 'SS4-COIN-1' }); reject(s, { type: 'STOP_POCKET' });
    for (const itemId of SECRETS_SORCERER_ITEM_IDS) act(s, { type: 'TAKE_ITEM', itemId }); expect(s.mind).toBe(mind - 2); expect(s.actionsRemaining).toBe(ap);
    reject(s, { type: 'TAKE_ITEM', itemId: 'SS4-CARD-1' }); reject(s, { type: 'RETURN_ITEM', itemId: 'SS4-COIN-1' });
    act(s, { type: 'STOP_POCKET' }); reject(s, { type: 'CLOSE', caseId: 'original-pocket' });
    act(s, { type: 'RETURN_ITEM', itemId: 'SS4-CARD-1' }); act(s, { type: 'RETURN_ITEM', itemId: 'SS4-SEALED-STONE-1' }); act(s, { type: 'CLOSE', caseId: 'original-pocket' });
    expect(s.secretsSorcerer.life.pocket.items.map(i => i.location)).toEqual(['DESK', 'PLAYER', 'DESK']); expect(s.secretsSorcerer.life.pocket.buzzCosts).toBe(2); expect(oldDoor(s)).toEqual(old);
  });
  it('expired contents survive suspension and a real week, blocking entry and retrieval until paid upkeep', () => {
    const s = ready(); prepare(s, 'original-pocket'); act(s, { type: 'PERFORM', caseId: 'original-pocket' }); act(s, { type: 'STORE_ITEM', itemId: 'SS4-CARD-1' });
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'original-pocket' }); expect(hasSecretsSorcererLifeLock(s)).toBe(false); const items = structuredClone(s.secretsSorcerer.life.pocket.items); nextWeek(s);
    expect(validateSecretsSorcererLife(s)).toBe(true); expect(projectSecretsSorcererLife(s).pocket.expired).toBe(true); expect(s.secretsSorcerer.life.pocket.items).toEqual(items);
    reject(s, { type: 'STORE_ITEM', itemId: 'SS4-COIN-1' }); reject(s, { type: 'TAKE_ITEM', itemId: 'SS4-CARD-1' }); reject(s, { type: 'MAINTAIN_POCKET' });
    const blocked = secretsSorcererLifeActions(s).find(a => a.command.type === 'MAINTAIN_POCKET'); expect(blocked?.reason).toContain('1行动');
    s.actionsRemaining = 2; const spirit = s.spirituality, cash = s.cash; act(s, { type: 'MAINTAIN_POCKET' }); expect([s.actionsRemaining, s.spirituality, s.cash]).toEqual([1, spirit - 2, cash - 20]);
    expect(s.secretsSorcerer.life.pocket.items).toEqual(items); expect(s.secretsSorcerer.life.pocket.films[1]).toMatchObject({ id: 'SS4-FILM-2', purpose: 'MAINTAIN', consumedWeek: s.week });
    reject(s, { type: 'MAINTAIN_POCKET' }); act(s, { type: 'TAKE_ITEM', itemId: 'SS4-CARD-1' }); act(s, { type: 'RETURN_ITEM', itemId: 'SS4-CARD-1' });
    for (const itemId of ['SS4-COIN-1', 'SS4-SEALED-STONE-1'] as const) { act(s, { type: 'STORE_ITEM', itemId }); act(s, { type: 'TAKE_ITEM', itemId }); if (itemId !== 'SS4-COIN-1') act(s, { type: 'RETURN_ITEM', itemId }); }
    act(s, { type: 'STOP_POCKET' }); act(s, { type: 'CLOSE', caseId: 'original-pocket' }); expect(hasSecretsSorcererLifeLock(s)).toBe(false); expect(s.secretsSorcerer.life.cases['original-pocket'].suspended).toBe(false);
  });
  it('ordinary compartment still stores real objects and has no magical upkeep', () => {
    const s = ready(), before = mastery(s), cash = s.cash, spirit = s.spirituality; complete(s, 'original-pocket', 'ORDINARY'); expect(s.secretsSorcerer.life.pocket).toMatchObject({ linked: false, links: 0, films: [], buzzCosts: 2 });
    expect(s.cash).toBe(cash); expect(s.spirituality).toBe(spirit); expect(mastery(s)).toBe(before); expect(s.secretsSorcerer.life.pocket.items.every(i => i.stores === 1 && i.takes === 1)).toBe(true);
  });
  it('failed pocket creation consumes its exact original film and never creates a link', () => {
    const s = ready(); prepare(s, 'original-pocket'); act(s, { type: 'PERFORM', caseId: 'original-pocket' }, 100); expect(s.secretsSorcerer.life.pocket).toMatchObject({ mode: 'NONE', linked: false, links: 0 });
    expect(s.secretsSorcerer.life.pocket.films[0]?.consumedWeek).toBe(s.week); reject(s, { type: 'STORE_ITEM', itemId: 'SS4-CARD-1' }); s.actionsRemaining = 0; act(s, { type: 'CLOSE', caseId: 'original-pocket' });
    s.actionsRemaining = 100; reject(s, { type: 'PREPARE', caseId: 'original-pocket', method: 'ABILITY' }); nextWeek(s); prepare(s, 'original-pocket'); expect(s.cash).toBe(9840); expect(s.secretsSorcerer.life.pocket.films.map(f => f.id)).toEqual(['SS4-FILM-1', 'SS4-FILM-2']);
  });
  it('unused paid original film survives cancellation and is reused without another purchase', () => {
    const s = ready(); prepare(s, 'original-pocket'); const cash = s.cash; act(s, { type: 'WITHDRAW', caseId: 'original-pocket' }); prepare(s, 'original-pocket'); expect(s.cash).toBe(cash); expect(s.secretsSorcerer.life.pocket.films).toHaveLength(1); expect(s.secretsSorcerer.life.cases['original-pocket'].filmId).toBe('SS4-FILM-1');
  });
  it('requires actual prior cage restraint, then keeps the same original echo away until explicit return', () => {
    const s = ready(); prepare(s, 'temporary-banishment'); reject(s, { type: 'PERFORM', caseId: 'temporary-banishment' }); act(s, { type: 'SECURE_TARGET' });
    const spirit = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'temporary-banishment' }); expect(c.ctx.check).toHaveBeenCalledWith('will', 18); expect(s.spirituality).toBe(spirit - 6);
    expect(s.secretsSorcerer.life.banishment).toMatchObject({ id: 'SS4-ECHO-G', location: 'AWAY', restrained: true, returnAtSeconds: 30, sceneSeconds: 0 }); expect(projectSecretsSorcererLife(s).banishment.remainingSeconds).toBe(30);
    reject(s, { type: 'RELEASE_RESTRAINT' }); reject(s, { type: 'CLOSE', caseId: 'temporary-banishment' }); reject(s, { type: 'REPORT', caseId: 'temporary-banishment' }); reject(s, { type: 'WITHDRAW', caseId: 'temporary-banishment' });
  });
  it('returns the same restrained entity after actual 30 seconds and supports zero-AP cleanup', () => {
    const s = ready(); prepare(s, 'temporary-banishment'); act(s, { type: 'SECURE_TARGET' }); act(s, { type: 'PERFORM', caseId: 'temporary-banishment' }); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0;
    const c = act(s, { type: 'WAIT_RETURN' }); expect(notes(c)).toContain('同一个SS4-ECHO-G'); expect(s.secretsSorcerer.life.banishment).toMatchObject({ location: 'ORIGINAL_CAGE', restrained: true, sceneSeconds: 30, returns: 1, banishments: 1, cageClosed: true });
    reject(s, { type: 'CLOSE', caseId: 'temporary-banishment' }); act(s, { type: 'RELEASE_RESTRAINT' }); act(s, { type: 'CLOSE', caseId: 'temporary-banishment' }); expect(hasSecretsSorcererLifeLock(s)).toBe(false);
    expect([s.actionsRemaining, s.mind, s.spirituality]).toEqual([0, 0, 0]); reject(s, { type: 'WAIT_RETURN' });
  });
  it('failed banishment retains the same restrained source and spirit cost until real release', () => {
    const s = ready(); prepare(s, 'temporary-banishment'); act(s, { type: 'SECURE_TARGET' }); act(s, { type: 'PERFORM', caseId: 'temporary-banishment' }, 100);
    expect(s.secretsSorcerer.life.banishment).toMatchObject({ location: 'ORIGINAL_CAGE', restrained: true, banishments: 0, returns: 0 }); expect(s.spirituality).toBe(114); reject(s, { type: 'WAIT_RETURN' });
    act(s, { type: 'RELEASE_RESTRAINT' }); const c = act(s, { type: 'CLOSE', caseId: 'temporary-banishment' }); expect(c.award).not.toHaveBeenCalled(); reject(s, { type: 'PREPARE', caseId: 'temporary-banishment', method: 'ABILITY' });
  });
  it('ordinary closed-cage inspection never banishes or grants magical mastery', () => {
    const s = ready(), before = mastery(s); complete(s, 'temporary-banishment', 'ORDINARY'); expect(s.secretsSorcerer.life.banishment).toMatchObject({ location: 'ORIGINAL_CAGE', banishments: 0, returns: 0, sceneSeconds: 0, cageClosed: true }); expect(mastery(s)).toBe(before);
  });
  it('all three ordinary cases reach peaceful100 without changing old Door history or ability mastery', () => {
    const s = ready(), old = oldDoor(s), before = mastery(s); for (const caseId of SECRETS_SORCERER_CASE_IDS) complete(s, caseId, 'ORDINARY'); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(mastery(s)).toBe(before); expect(oldDoor(s)).toEqual(old); reject(s, { type: 'REFLECT' });
  });
  it('only successful actual ability closure and report each award once', () => {
    const s = ready(), before = mastery(s); for (const caseId of SECRETS_SORCERER_CASE_IDS) complete(s, caseId); act(s, { type: 'REFLECT' }); expect(mastery(s) - before).toBe(39); expect(s.progression.acting).toBe(100);
    for (const caseId of SECRETS_SORCERER_CASE_IDS) { reject(s, { type: 'CLOSE', caseId }); reject(s, { type: 'REPORT', caseId }); }
  });
  it('rejects forged sources, duplicate items, fake capacity and invented return history', () => {
    for (const corrupt of [
      (s: SliceState) => { s.secretsSorcerer.life.room.doorId = 'REMOTE-DOOR' as 'SS4-DOOR'; },
      (s: SliceState) => { s.secretsSorcerer.life.pocket.items.push({ ...s.secretsSorcerer.life.pocket.items[0]! }); },
      (s: SliceState) => { s.secretsSorcerer.life.pocket.capacity = 99 as 3; },
      (s: SliceState) => { s.secretsSorcerer.life.pocket.coordinate = 'UNKNOWN' as 'SS4-ROOM:SS4-BAG-1:ANCHOR'; },
      (s: SliceState) => { s.secretsSorcerer.life.banishment.returns = 1; },
      (s: SliceState) => { s.secretsSorcerer.life.banishment.id = 'SUBSTITUTE' as 'SS4-ECHO-G'; },
      (s: SliceState) => { s.secretsSorcerer.life.pocket.films.push({ id: 'FREE', purpose: 'PREPARE', purchasedWeek: s.week, consumedWeek: null }); },
    ]) { const s = ready(); corrupt(s); expect(validateSecretsSorcererLife(s)).toBe(false); }
    expect(validateSecretsSorcererActivityCommand({ type: 'STORE_ITEM', itemId: 'SS4-COIN-1', quantity: 99 })).toBe(false); expect(validateSecretsSorcererActivityCommand({ type: 'BANISH_ANYONE', targetId: 'PERSON' })).toBe(false);
  });
  it('projection copies cannot alter actual original objects, finite counters or histories', () => {
    const s = ready(), before = structuredClone(s.secretsSorcerer.life), view = projectSecretsSorcererLife(s); view.pocket.items[0]!.location = 'POCKET'; view.room.history.push('invented'); view.cases[0]!.observations.push('invented'); expect(s.secretsSorcerer.life).toEqual(before);
  });
});
