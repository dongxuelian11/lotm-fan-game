import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { ANCIENT_EVIL_CASE_IDS, advanceAncientEvilLifeClock, ancientEvilLifeClosed, blockAncientEvilLife, hasAncientEvilLifeLock, projectAncientEvilLife, replayAncientEvilLifeRoot, validateAncientEvilActivityCommand, validateAncientEvilLifeState, validateAncientEvilSourceSilentDiscipleLife, type AncientEvilActivityCommand, type AncientEvilCaseId } from '../../src/domain/ancient-evil/life.js';
import { ANCIENT_EVIL_PREPARATION_IDS } from '../../src/domain/ancient-evil/types.js';
import { ae, directedInitial3, dose, promoted, rejectAncientEvil, rejectIntent } from './ancient-evil-directed-helper.js';
const FORM = 'chained.s2.enduring-transfiguration', GUIDE = 'chained.s2.curse-guidance';
const attempt = (s: SliceState, id: AncientEvilCaseId) => s.ancientEvil.life.cases[id].attempts.at(-1)!;
const successful = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
function act(s: SliceState, c: AncientEvilActivityCommand): SliceState { const next = ae(s, c); expect(validateAncientEvilLifeState(next), JSON.stringify(c)).toBe(true); return next; }
function begin(s: SliceState, id: AncientEvilCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  for (const c of [{ type: 'OBSERVE', caseId: id }, { type: 'PREPARE', caseId: id, method }, { type: 'WALK', caseId: id, to: 'A' }, { type: 'READ_IDENTITY', caseId: id }] as AncientEvilActivityCommand[]) s = act(s, c);
  if (method === 'ABILITY') for (const type of ['STORE_ITEMS', 'CONSENT_ELSA'] as const) s = act(s, { type, caseId: id });
  return s;
}
function compare(s: SliceState, id: AncientEvilCaseId): SliceState {
  if (s.ancientEvil.life.operation.inputActive) s = act(s, { type: 'STOP_INPUT', caseId: id });
  if (id === 'revoked-form' && attempt(s, id).formTier !== null && !attempt(s, id).permissionWithdrawn) s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: id });
  for (const c of [{ type: 'WALK', caseId: id, to: 'B' }, { type: 'READ_NOTE', caseId: id }, { type: 'WALK', caseId: id, to: 'A' }, { type: 'COMPARE_IDENTITY', caseId: id }] as AncientEvilActivityCommand[]) s = act(s, c);
  return s;
}
function finish(s: SliceState, id: AncientEvilCaseId, report = true): SliceState {
  if (s.ancientEvil.life.operation.inputActive) s = act(s, { type: 'STOP_INPUT', caseId: id });
  if (id === 'revoked-form' && attempt(s, id).formTier !== null && !attempt(s, id).permissionWithdrawn) s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: id });
  if (s.silentDisciple.life.playerLocation === 'B') s = act(s, { type: 'WALK', caseId: id, to: 'A' });
  if (s.ancientEvil.life.operation.form !== null) s = act(s, { type: 'WAIT_FORM', caseId: id });
  if (s.silentDisciple.life.clothing.location === 'TRAY') s = act(s, { type: 'RETURN_ITEMS', caseId: id });
  if (s.silentDisciple.life.playerLocation === 'A') s = act(s, { type: 'WALK', caseId: id, to: 'START' });
  s = act(s, { type: 'INSPECT', caseId: id }); s = act(s, { type: 'LEAVE', caseId: id }); return report ? act(s, { type: 'REPORT', caseId: id }) : s;
}
function ordinary(s: SliceState, id: AncientEvilCaseId): SliceState { s = compare(begin(s, id, 'ORDINARY'), id); s = act(s, { type: 'MANUAL_OPERATION', caseId: id }); return finish(s, id); }
const selected = new Map<string, SliceState>();
/** UNIT-only selection before the first S2 journal: same seed and old 507-command
 * source, unmodified stats/history/bodies. Picks real potion/form/guidance rolls. */
function directed(form: 'SUCCESS' | 'GREAT_FAILURE', guidance: 'SUCCESS' | 'GREAT_FAILURE' = 'SUCCESS', actions = 100): SliceState {
  const key = `${form}:${guidance}:${actions}`, cached = selected.get(key); if (cached) return structuredClone(cached);
  let s = directedInitial3(); const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }), chance = computeCheckChance({ baseAbility: Math.min(500, s.character.coreStats.knowledge + 1), difficulty: 20, modifiers: [] });
  let cursor: number | null = null;
  for (let n = s.random.cursor; n < s.random.cursor + 4096; n++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, n), p = rng.nextInt(1, 100), f = rng.nextInt(1, 100), g = rng.nextInt(1, 100);
    if (p > 5 && p <= potionChance && (form === 'SUCCESS' ? f > 5 && f <= chance : f >= 96) && (guidance === 'SUCCESS' ? g > 5 && g <= chance : g >= 96)) { cursor = n; break; }
  }
  expect(cursor).not.toBeNull(); s.random.cursor = cursor!; s.actionsRemaining = actions; assertValidSliceState(s);
  s = ae(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId });
  s = ae(s, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-1' }); s = ae(s, { type: 'PREPARE_PROMOTION' }); s = ae(s, dose); expect(s.progression.sequence).toBe(2);
  selected.set(key, structuredClone(s)); return s;
}
function transformed(s = directed('SUCCESS'), id: AncientEvilCaseId = 'lasting-form'): SliceState { return act(begin(s, id), { type: 'ENDURING_TRANSFIGURATION', caseId: id }); }

describe('AncientEvil finite same-body life on the actual SilentDisciple original room', () => {
  it('requires exact command shapes and rejects invented cases, remote walking, moon mechanics and general cleansing', () => {
    expect(validateAncientEvilActivityCommand({ type: 'REFLECT', extra: true })).toBe(false);
    expect(validateAncientEvilActivityCommand({ type: 'WALK', caseId: 'lasting-form', to: 'OUTSIDE' })).toBe(false);
    expect(validateAncientEvilActivityCommand({ type: 'CURSE_GUIDANCE', caseId: 'foreign-curse' })).toBe(false);
    expect(validateAncientEvilActivityCommand({ type: 'WAIT_MOON' })).toBe(false);
    const s = promoted(); rejectAncientEvil(s, { type: 'CURSE_GUIDANCE', caseId: 'lasting-form' });
  });
  it('completes ordinary acting100 with zero new mastery while preserving original people, objects, old histories, resolved moon and injuries', () => {
    let s = promoted(); const old = structuredClone(s.silentDisciple.life), injuries = structuredClone(s.injuries), resources = [s.health, s.mind, s.spirituality, s.cash], earlier = [s.prisoner, s.madman, s.werewolf, s.zombie, s.wraith, s.puppet];
    for (const id of ANCIENT_EVIL_CASE_IDS) s = ordinary(s, id); s = act(s, { type: 'REFLECT' });
    expect(ancientEvilLifeClosed(s)).toBe(true); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[FORM]).toBe(0); expect(s.progression.mastery[GUIDE]).toBe(0);
    expect(s.ancientEvil.life.source!.snapshot).toEqual(old);
    for (const key of ['volunteer', 'guide', 'clothing', 'bag', 'tray', 'note', 'cases', 'moon'] as const) expect(s.silentDisciple.life[key]).toEqual(old[key]);
    expect(s.silentDisciple.life.playerTravelMetres).toBe(old.playerTravelMetres + 48); expect([s.health, s.mind, s.spirituality, s.cash]).toEqual(resources);
    expect(s.injuries).toEqual(injuries); expect([s.prisoner, s.madman, s.werewolf, s.zombie, s.wraith, s.puppet]).toEqual(earlier); expect(validateAncientEvilSourceSilentDiscipleLife(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('requires current identity, actual private original belongings and fresh consent before a same-body cast', () => {
    let s = act(promoted(), { type: 'OBSERVE', caseId: 'lasting-form' }); s = act(s, { type: 'PREPARE', caseId: 'lasting-form', method: 'ABILITY' });
    expect(hasAncientEvilLifeLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    for (const type of ['CONSENT_ELSA', 'READ_IDENTITY', 'STORE_ITEMS', 'ENDURING_TRANSFIGURATION'] as const) rejectAncientEvil(s, { type, caseId: 'lasting-form' });
    s = act(s, { type: 'WALK', caseId: 'lasting-form', to: 'A' }); rejectAncientEvil(s, { type: 'STORE_ITEMS', caseId: 'lasting-form' });
    s = act(s, { type: 'READ_IDENTITY', caseId: 'lasting-form' }); rejectAncientEvil(s, { type: 'CONSENT_ELSA', caseId: 'lasting-form' });
    s = act(s, { type: 'STORE_ITEMS', caseId: 'lasting-form' }); expect(s.silentDisciple.life.clothing).toMatchObject({ location: 'TRAY', worn: false, quantity: 1, owner: 'SD3-ELSA' });
    rejectAncientEvil(s, { type: 'ENDURING_TRANSFIGURATION', caseId: 'lasting-form' });
  });
  it('pays actual successful form cost, changes the only original body for90seconds and stopping does not restore or equip it', () => {
    const before = directed('SUCCESS'); let s = transformed(before); const old = before.silentDisciple.life;
    expect(attempt(s, 'lasting-form').formTier).toBe('SUCCESS'); expect([s.spirituality, s.mind, s.health]).toEqual([before.spirituality - 6, before.mind - 2, before.health]);
    expect(s.silentDisciple.life.volunteer).toEqual({ ...old.volunteer, form: 'RABBIT' }); expect(s.ancientEvil.life.operation.form!.expiresAt - s.silentDisciple.life.clockSeconds).toBe(90);
    expect(s.progression.mastery[FORM]).toBe(0); rejectAncientEvil(s, { type: 'ENDURING_TRANSFIGURATION', caseId: 'lasting-form' });
    s = act(s, { type: 'STOP_INPUT', caseId: 'lasting-form' }); expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT'); expect(s.ancientEvil.life.operation.form!.expiresAt - s.silentDisciple.life.clockSeconds).toBe(89);
    rejectAncientEvil(s, { type: 'RETURN_ITEMS', caseId: 'lasting-form' }); rejectAncientEvil(s, { type: 'WALK', caseId: 'lasting-form', to: 'START' });
    s = compare(s, 'lasting-form'); expect(attempt(s, 'lasting-form').comparedForm).toBe('RABBIT'); s = finish(s, 'lasting-form');
    expect(s.progression.mastery[FORM]).toBe(8); expect(s.progression.mastery[GUIDE]).toBe(0); expect(s.silentDisciple.life.volunteer).toEqual(old.volunteer); expect(s.silentDisciple.life.clothing).toEqual(old.clothing);
  });
  it('guidance requires own current successful form and actual roundtrip identity comparison; paid success restores only that original human early', () => {
    let s = transformed(); const id = 'lasting-form' as const; rejectAncientEvil(s, { type: 'CURSE_GUIDANCE', caseId: id });
    s = act(s, { type: 'STOP_INPUT', caseId: id }); rejectAncientEvil(s, { type: 'CURSE_GUIDANCE', caseId: id });
    s = compare(s, id); const before = structuredClone(s), remain = s.ancientEvil.life.operation.form!.expiresAt - s.silentDisciple.life.clockSeconds;
    s = act(s, { type: 'CURSE_GUIDANCE', caseId: id }); expect(attempt(s, id).guidanceTier).toBe('SUCCESS'); expect(remain).toBeGreaterThan(2);
    expect([s.spirituality, s.mind, s.actionsRemaining]).toEqual([before.spirituality - 4, before.mind - 2, before.actionsRemaining - 1]);
    expect(s.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(s.ancientEvil.life.operation.form).toBeNull(); expect(s.silentDisciple.life.clothing).toMatchObject({ location: 'TRAY', worn: false }); expect(s.silentDisciple.life.bag.location).toBe('TRAY');
    expect(s.ancientEvil.life.journal.at(-1)!.source).toMatchObject({ abilityId: GUIDE, currentConsent: 'GRANTED', bodyId: 'SD3-ELSA', originalIdentity: { originalForm: 'HUMAN', compared: true }, form: { sourceCaseId: id, sourceAbilityId: FORM } });
    rejectAncientEvil(s, { type: 'CURSE_GUIDANCE', caseId: id }); rejectAncientEvil(s, { type: 'WAIT_FORM', caseId: id });
    s = finish(s, id); expect(s.progression.mastery[FORM]).toBe(8); expect(s.progression.mastery[GUIDE]).toBe(8);
  });
  it('failed form pays6spirituality4mind, produces no new body or form, and ordinary fallback never earns either mastery', () => {
    const before = directed('GREAT_FAILURE'); let s = transformed(before), id = 'lasting-form' as const;
    expect(attempt(s, id).formTier).toBe('GREAT_FAILURE'); expect([s.spirituality, s.mind, s.health]).toEqual([before.spirituality - 6, before.mind - 4, before.health]); expect(s.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(s.ancientEvil.life.operation.form).toBeNull();
    rejectAncientEvil(s, { type: 'WAIT_FORM', caseId: id }); rejectAncientEvil(s, { type: 'CURSE_GUIDANCE', caseId: id });
    s = compare(s, id); s = act(s, { type: 'MANUAL_OPERATION', caseId: id }); s = finish(s, id); expect(s.progression.acting).toBe(25); expect([s.progression.mastery[FORM], s.progression.mastery[GUIDE]]).toEqual([0, 0]);
  });
  it('failed guidance pays4spirituality4mind and keeps the own form until its real remaining time elapses', () => {
    let s = compare(transformed(directed('SUCCESS', 'GREAT_FAILURE')), 'lasting-form'), id = 'lasting-form' as const; const before = structuredClone(s), until = s.ancientEvil.life.operation.form!.expiresAt;
    s = act(s, { type: 'CURSE_GUIDANCE', caseId: id }); expect(attempt(s, id).guidanceTier).toBe('GREAT_FAILURE'); expect([s.spirituality, s.mind]).toEqual([before.spirituality - 4, before.mind - 4]);
    expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT'); expect(s.ancientEvil.life.operation.form!.expiresAt).toBe(until); rejectAncientEvil(s, { type: 'RETURN_ITEMS', caseId: id });
    const actions = s.actionsRemaining, remaining = until - s.silentDisciple.life.clockSeconds; s = act(s, { type: 'WAIT_FORM', caseId: id }); expect(s.actionsRemaining).toBe(actions); expect(attempt(s, id).waitedSeconds).toBe(remaining); expect(s.silentDisciple.life.clockSeconds).toBe(until); expect(s.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(s.silentDisciple.life.clothing.location).toBe('TRAY');
    s = finish(s, id); expect([s.progression.mastery[FORM], s.progression.mastery[GUIDE]]).toEqual([8, 0]);
  });
  it('withdrawn consent forbids new casting, retains existing form and costs, and still permits own-ending guidance or ordinary wait', () => {
    let s = ordinary(directed('SUCCESS'), 'lasting-form'); s = transformed(s, 'revoked-form'); const id = 'revoked-form' as const, formBefore = s.ancientEvil.life.operation.form;
    // All intervening ordinary operations consume no random draws, so this is the selected successful form.
    expect(formBefore).not.toBeNull(); const resources = [s.spirituality, s.mind, s.health]; s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: id });
    expect(attempt(s, id).consent).toBe('WITHDRAWN'); expect(s.ancientEvil.life.operation.inputActive).toBe(false); expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT'); expect([s.spirituality, s.mind, s.health]).toEqual(resources);
    for (const type of ['CONSENT_ELSA', 'ENDURING_TRANSFIGURATION', 'RETURN_ITEMS'] as const) rejectAncientEvil(s, { type, caseId: id });
    s = compare(s, id); expect(blockAncientEvilLife(s, { type: 'CURSE_GUIDANCE', caseId: id })).toBeNull(); s = act(s, { type: 'CURSE_GUIDANCE', caseId: id }); expect(s.ancientEvil.life.journal.at(-1)!.source!.currentConsent).toBe('WITHDRAWN'); s = finish(s, id); expect(s.progression.acting).toBe(50);
  });
  it('early cancellation offers real safe return with no automatic report or mastery, even after a successful cast', () => {
    let s = transformed(), id = 'lasting-form' as const; const paid = [s.spirituality, s.mind]; s = act(s, { type: 'STOP', caseId: id });
    expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT'); s = finish(s, id, false); expect(hasAncientEvilLifeLock(s)).toBe(false); expect(s.silentDisciple.life.playerLocation).toBe('START'); expect(s.silentDisciple.life.clothing.worn).toBe(true); expect([s.spirituality, s.mind]).toEqual(paid);
    rejectAncientEvil(s, { type: 'REPORT', caseId: id }); expect(s.progression.acting).toBe(0); expect([s.progression.mastery[FORM], s.progression.mastery[GUIDE]]).toEqual([0, 0]);
  });
  it('reserves both casts before opening and keeps zero-action failed-guidance cleanup executable', () => {
    let short = act(directed('SUCCESS', 'SUCCESS', 8), { type: 'OBSERVE', caseId: 'lasting-form' });
    expect(short.actionsRemaining).toBe(2); rejectAncientEvil(short, { type: 'PREPARE', caseId: 'lasting-form', method: 'ABILITY' });
    expect(blockAncientEvilLife(short, { type: 'PREPARE', caseId: 'lasting-form', method: 'ORDINARY' })).toBeNull();
    let s = compare(transformed(directed('SUCCESS', 'GREAT_FAILURE', 9)), 'lasting-form');
    expect(s.actionsRemaining).toBe(1); s = act(s, { type: 'CURSE_GUIDANCE', caseId: 'lasting-form' });
    expect(s.actionsRemaining).toBe(0); expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT');
    const view = projectAncientEvilLife(s), primary = view.actions.find(a => a.id === view.preferredActionId)!;
    expect(primary.command.type).toBe('WAIT_FORM'); expect(primary.enabled).toBe(true);
    s = finish(s, 'lasting-form', false); expect(hasAncientEvilLifeLock(s)).toBe(false); expect(s.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(s.silentDisciple.life.clothing.worn).toBe(true); expect(s.silentDisciple.life.bag.location).toBe('ELSA'); expect(s.silentDisciple.life.playerLocation).toBe('START');
  });
  it('clock expiry changes the same body only and never teleports or silently returns belongings', () => {
    const s = transformed(), l = structuredClone(s.ancientEvil.life), p = structuredClone(s.silentDisciple.life), before = structuredClone(p);
    advanceAncientEvilLifeClock(l, p, 89); expect(p.volunteer.form).toBe('RABBIT'); advanceAncientEvilLifeClock(l, p, 1); expect(p.volunteer).toEqual({ ...before.volunteer, form: 'HUMAN' }); expect(p.clothing).toEqual(before.clothing); expect(p.bag).toEqual(before.bag); expect(p.playerLocation).toBe(before.playerLocation); expect(l.operation.form).toBeNull();
    expect(() => advanceAncientEvilLifeClock(l, p, -1)).toThrow();
  });
  it('strictly replays inherited old source, same body and original items, dates, revision, budgets, RNG and current identity evidence', () => {
    let s = compare(transformed(), 'lasting-form'); s = act(s, { type: 'CURSE_GUIDANCE', caseId: 'lasting-form' }); s = finish(s, 'lasting-form');
    const changes: ((x: SliceState) => void)[] = [
      x => { x.ancientEvil.life.source!.snapshot.clockSeconds++; },
      x => { x.ancientEvil.life.source!.snapshot.cases['original-body'].attempts[0]!.steps[0]!.atSecond++; },
      x => { x.ancientEvil.life.source!.snapshot.moon.elapsedSeconds++; },
      x => { x.ancientEvil.life.journal[0]!.inheritedScene = null; },
      x => { x.ancientEvil.life.journal[1]!.inheritedScene = structuredClone(x.ancientEvil.life.source); },
      x => { x.ancientEvil.life.journal[2]!.revision = x.ancientEvil.life.journal[1]!.revision; },
      x => { x.ancientEvil.life.journal[2]!.date.day++; },
      x => { x.ancientEvil.life.journal[2]!.budget.mindAfter--; },
      x => { x.ancientEvil.life.journal[2]!.randomCursor++; },
      x => { x.random.cursor++; },
      x => { x.ancientEvil.life.journal.find(e => e.check)!.check!.roll++; },
      x => { x.ancientEvil.life.journal.find(e => e.check)!.randomAfter!++; },
      x => { x.ancientEvil.life.journal.find(e => e.source?.abilityId === GUIDE)!.source!.originalIdentity.bodyId = 'OTHER' as never; },
      x => { x.ancientEvil.life.journal.find(e => e.source?.abilityId === GUIDE)!.source!.form!.sourceCaseId = 'original-link'; },
      x => { x.ancientEvil.life.cases['lasting-form'].attempts[0]!.playerMoves[0]!.metres = 8 as never; },
      x => { x.silentDisciple.life.volunteer.bodyId = 'CLONE' as never; },
      x => { x.silentDisciple.life.clothing.quantity = 2 as never; },
      x => { x.silentDisciple.life.bag.owner = 'PLAYER' as never; },
      x => { x.silentDisciple.life.volunteer.location = 'OUTSIDE'; },
      x => { x.silentDisciple.life.note.records[0]!.text += 'fake'; },
      x => { x.silentDisciple.life.moon.mindSpent++; },
      x => { x.progression.mastery[GUIDE] = 16; },
    ];
    for (const change of changes) { const fake = structuredClone(s); change(fake); expect(validateAncientEvilLifeState(fake), change.toString()).toBe(false); expect(validateAncientEvilSourceSilentDiscipleLife(fake)).toBe(false); expect(() => assertValidSliceState(fake)).toThrow(); }
    expect(replayAncientEvilLifeRoot(s)).toEqual(s.silentDisciple.life); assertValidSliceState(s);
  }, 60_000);
  it('offers a single legal preferred route and optional ordinary/cancel without leaking editorial labels or mutating source', () => {
    let s = directed('SUCCESS'); for (let n = 0; n < 100 && !s.ancientEvil.life.reflected; n++) { const view = projectAncientEvilLife(s), primary = view.actions.find(a => a.id === view.preferredActionId); expect(primary, view.nextStep).toBeDefined(); expect(primary!.enabled).toBe(true); s = act(s, primary!.command); }
    expect(s.ancientEvil.life.reflected).toBe(true); expect(s.progression.acting).toBe(100); const before = structuredClone(s), view = projectAncientEvilLife(s);
    const copy = [view.title, view.story, view.environment, view.nextStep, ...view.facts, ...view.cases.flatMap(c => [c.title, c.story, ...c.observations]), ...view.actions.flatMap(a => [a.label, a.reason ?? ''])].join('\n'); expect(copy).not.toMatch(/\bG\b|候选|原文未核|SD3-|START/);
    view.site.volunteer.form = 'RABBIT'; view.cases[0]!.attempts[0]!.evidence.push('fake'); expect(s).toEqual(before);
    for (const id of ANCIENT_EVIL_CASE_IDS) { const a = attempt(s, id); expect(a.playerTravelMetres).toBe(16); if (!successful(a.formTier)) expect(a.appliedAbilityIds).not.toContain(FORM); if (!successful(a.guidanceTier)) expect(a.appliedAbilityIds).not.toContain(GUIDE); }
  }, 60_000);
});
