import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  applyDiscernerActivity, createDiscernerLifeState, hasDiscernerLifeLock,
  projectDiscernerLife, validateDiscernerLifeState,
  DISCERNER_CASE_IDS, DISCERNER_PERSON_IDS, DISCERNER_CARD_IDS,
  type DiscernerActivityCommand, type DiscernerCaseId,
} from '../../src/domain/discerner/life.js';
import { audienceLegacyKeys, discernerContext, discernerLifeReady, discernerSnapshot } from './discerner-test-fixture.js';

const IMPRINT = 'audience.s2.mental-imprint', INSIGHT = 'audience.s2.insight-window';
const person = (id: DiscernerCaseId) => DISCERNER_PERSON_IDS[DISCERNER_CASE_IDS.indexOf(id)]!;
const card = (id: DiscernerCaseId) => DISCERNER_CARD_IDS[DISCERNER_CASE_IDS.indexOf(id)]!;
const view = (s: SliceState) => projectDiscernerLife(s);
const attempt = (s: SliceState, id: DiscernerCaseId) => view(s).cases.find(c => c.id === id)!.attempts.at(-1)!;
function act(s: SliceState, command: DiscernerActivityCommand, roll = 1) {
  const ctx = discernerContext(s, roll); applyDiscernerActivity(s, command, ctx);
  expect(validateDiscernerLifeState(s)).toBe(true); return ctx;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = discernerContext(s);
  expect(() => applyDiscernerActivity(s, command as DiscernerActivityCommand, ctx)).toThrow();
  expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled();
}
function prepare(s: SliceState, caseId: DiscernerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method });
}
function begin(s: SliceState, caseId: DiscernerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  prepare(s, caseId, method);
  if (method === 'ABILITY') act(s, { type: 'CONSENT', personId: person(caseId), permission: 'CONTACT' });
  act(s, { type: 'CONSENT', personId: person(caseId), permission: 'MATERIAL' });
  act(s, { type: 'PERFORM', caseId });
}
function finishOrdinary(s: SliceState, caseId: DiscernerCaseId) {
  if (view(s).currentAttempt!.contactActive) act(s, { type: 'STOP_CONTACT' });
  if (view(s).currentAttempt!.sealActive) act(s, { type: 'DEACTIVATE_SEAL' });
  if (view(s).currentAttempt!.ownerNode === 'NEAR') act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' });
  act(s, { type: 'TAKE_CARD' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' });
  act(s, { type: 'CHECK_CARD' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' });
  act(s, { type: 'RETURN_CARD' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' });
  act(s, { type: 'VERIFY', caseId }); act(s, { type: 'CLOSE', caseId });
}
function ordinary(s: SliceState, caseId: DiscernerCaseId) {
  begin(s, caseId, 'ORDINARY'); finishOrdinary(s, caseId); act(s, { type: 'REPORT', caseId });
}
function reach(s: SliceState, target: DiscernerCaseId) {
  for (const id of DISCERNER_CASE_IDS) { if (id === target) return; ordinary(s, id); }
}

describe('Discerner finite original-card practice (explicit unit-only RNG)', () => {
  it('starts from actual S2 promotion with three distinct originals and no disclosed private card faces', () => {
    const s = discernerLifeReady(), original = discernerSnapshot('promoted'), p = view(s).practice!;
    for (const key of audienceLegacyKeys) expect(s[key]).toEqual(original[key]);
    expect(s.discerner.life).toEqual(createDiscernerLifeState());
    expect(Object.keys(p.participants)).toEqual([...DISCERNER_PERSON_IDS]);
    expect(Object.keys(p.cards)).toEqual([...DISCERNER_CARD_IDS]);
    expect(Object.values(p.participants).every(v => v.age > 18 && v.health === 100 && v.mind === 100 && v.node === 'FAR')).toBe(true);
    expect(Object.values(p.cards).every(v => v.holder === 'TARGET' && v.node === 'FAR' && !Object.hasOwn(v, 'marking'))).toBe(true);
    expect(p.knownClues).toEqual([]); expect(p.seal).toMatchObject({ id: 'DCR2-BRAM-SEAL', holder: 'TARGET', node: 'FAR', active: false, charges: 1 });
    expect(view(s).currentConsents.every(v => !v.consented && !v.materialConsented)).toBe(true);
  });

  it('requires two current permissions from this case’s original adult and a genuinely formed near-range mark', () => {
    const s = discernerLifeReady(); prepare(s, 'present-mark');
    reject(s, { type: 'CONSENT', personId: 'DCR2-BRAM', permission: 'CONTACT' });
    reject(s, { type: 'PERFORM', caseId: 'present-mark' });
    act(s, { type: 'CONSENT', personId: 'DCR2-ELENA', permission: 'CONTACT' });
    reject(s, { type: 'PERFORM', caseId: 'present-mark' });
    act(s, { type: 'CONSENT', personId: 'DCR2-ELENA', permission: 'MATERIAL' });
    act(s, { type: 'PERFORM', caseId: 'present-mark' }); reject(s, { type: 'MENTAL_IMPRINT' });
    act(s, { type: 'FORM_MARK' }); reject(s, { type: 'FORM_MARK' }); reject(s, { type: 'MENTAL_IMPRINT' });
    expect(view(s).practice!.knownClues).toEqual([]);
    expect(view(s).practice!.cards[card('present-mark')]).not.toHaveProperty('marking');
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' });
    const spirit = s.spirituality, mind = s.mind, ctx = act(s, { type: 'MENTAL_IMPRINT' });
    expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18);
    expect([s.spirituality, s.mind]).toEqual([spirit - 6, mind - 2]);
    expect(view(s).currentAttempt).toMatchObject({ imprintResult: 'REVEALED', spiritualitySpent: 6, ownerMindSpent: 2, ownerTravelMetres: 3, elapsedSeconds: 8 });
    expect(view(s).practice!.knownClues.map(k => k.source)).toEqual(['FINITE_IMPRINT']);
    expect(view(s).practice!.cards[card('present-mark')]).not.toHaveProperty('marking');
    reject(s, { type: 'MENTAL_IMPRINT' }); reject(s, { type: 'TAKE_CARD' }); reject(s, { type: 'CLOSE', caseId: 'present-mark' });
  });

  it('stops contact immediately without moving the body/card or refunding cost and actually carries the same card back', () => {
    const s = discernerLifeReady(), old = structuredClone(s.dreamWeaver); begin(s, 'present-mark');
    act(s, { type: 'FORM_MARK' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'MENTAL_IMPRINT' });
    const before = view(s).currentAttempt!, spirit = s.spirituality, mind = s.mind;
    act(s, { type: 'STOP_CONTACT' });
    expect(view(s).currentAttempt).toMatchObject({ ownerNode: 'FAR', elapsedSeconds: before.elapsedSeconds, ownerTravelMetres: before.ownerTravelMetres, contactActive: false, contactEnd: 'STOPPED' });
    expect([s.spirituality, s.mind]).toEqual([spirit, mind]);
    act(s, { type: 'TAKE_CARD' }); expect(view(s).practice!.cards[card('present-mark')]).toMatchObject({ holder: 'OWNER', node: 'FAR' });
    reject(s, { type: 'CHECK_CARD' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' });
    expect(view(s).practice!.cards[card('present-mark')]).toMatchObject({ holder: 'OWNER', node: 'NEAR' });
    reject(s, { type: 'RETURN_CARD' }); act(s, { type: 'CHECK_CARD' });
    expect(view(s).practice!.knownClues.map(k => k.source)).toEqual(['FINITE_IMPRINT', 'PHYSICAL_ORIGINAL']);
    expect(view(s).practice!.cards[card('present-mark')].marking).toBeTruthy();
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'RETURN_CARD' });
    reject(s, { type: 'CLOSE', caseId: 'present-mark' }); reject(s, { type: 'VERIFY', caseId: 'present-mark' });
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'VERIFY', caseId: 'present-mark' }); act(s, { type: 'CLOSE', caseId: 'present-mark' });
    act(s, { type: 'REPORT', caseId: 'present-mark' });
    expect(attempt(s, 'present-mark')).toMatchObject({ elapsedSeconds: 22, ownerTravelMetres: 12, cardReturned: true, verified: true, closed: true, result: 'ABILITY' });
    expect(s.progression.mastery[IMPRINT]).toBe(8); expect(s.progression.mastery[INSIGHT]).toBe(0);
    expect(s.dreamWeaver).toEqual(old); expect(hasDiscernerLifeLock(s)).toBe(false);
    expect(view(s).practice!.cards[card('present-mark')]).toMatchObject({ holder: 'TARGET', node: 'FAR' });
    reject(s, { type: 'REPORT', caseId: 'present-mark' });
  });

  it.each([1, 100])('spends one actual seal charge, check and full scan cost without private leakage at directed roll %i', roll => {
    const s = discernerLifeReady(); reach(s, 'covered-mark'); begin(s, 'covered-mark');
    act(s, { type: 'FORM_MARK' }); act(s, { type: 'ACTIVATE_SEAL' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' });
    const spirit = s.spirituality, mind = s.mind, ctx = act(s, { type: 'MENTAL_IMPRINT' }, roll);
    expect(ctx.check).toHaveBeenCalledTimes(1); expect([s.spirituality, s.mind]).toEqual([spirit - 6, mind - 2]);
    expect(view(s).currentAttempt).toMatchObject({ imprintResult: 'BLOCKED', sealActivated: true, sealActive: false, sealCharges: 0, contactActive: false });
    expect(view(s).practice!.knownClues.filter(k => k.caseId === 'covered-mark')).toEqual([]);
    expect(view(s).practice!.cards[card('covered-mark')]).not.toHaveProperty('marking');
    reject(s, { type: 'ACTIVATE_SEAL' }); reject(s, { type: 'MENTAL_IMPRINT' });
    finishOrdinary(s, 'covered-mark'); act(s, { type: 'REPORT', caseId: 'covered-mark' });
    expect(attempt(s, 'covered-mark').result).toBe('ORDINARY'); expect(s.progression.mastery[IMPRINT]).toBe(0);
    expect(view(s).practice!.seal.charges).toBe(0);
  });

  it.each(['DECLINE_CONSENT', 'REVOKE_CONSENT'] as const)('respects %s of contact while separately authorized original-card work remains possible', type => {
    const s = discernerLifeReady(); reach(s, 'withdrawn-mark'); prepare(s, 'withdrawn-mark');
    if (type === 'REVOKE_CONSENT') act(s, { type: 'CONSENT', personId: 'DCR2-SELMA', permission: 'CONTACT' });
    act(s, { type, personId: 'DCR2-SELMA', permission: 'CONTACT' });
    act(s, { type: 'CONSENT', personId: 'DCR2-SELMA', permission: 'MATERIAL' }); act(s, { type: 'PERFORM', caseId: 'withdrawn-mark' });
    reject(s, { type: 'FORM_MARK' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); reject(s, { type: 'MENTAL_IMPRINT' });
    reject(s, { type: 'CONSENT', personId: 'DCR2-SELMA', permission: 'CONTACT' });
    const spirit = s.spirituality, mind = s.mind; finishOrdinary(s, 'withdrawn-mark'); act(s, { type: 'REPORT', caseId: 'withdrawn-mark' });
    expect([s.spirituality, s.mind]).toEqual([spirit, mind]); expect(attempt(s, 'withdrawn-mark').result).toBe('ORDINARY');
    expect(view(s).practice!.knownClues.filter(k => k.caseId === 'withdrawn-mark').map(k => k.source)).toEqual(['PHYSICAL_ORIGINAL']);
    expect(s.progression.mastery[IMPRINT]).toBe(0);
  });

  it('revokes ongoing contact at once and permits returning a carried card after separate material revocation', () => {
    const s = discernerLifeReady(); begin(s, 'present-mark'); act(s, { type: 'FORM_MARK' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'MENTAL_IMPRINT' });
    act(s, { type: 'REVOKE_CONSENT', personId: 'DCR2-ELENA', permission: 'CONTACT' });
    expect(view(s).currentAttempt).toMatchObject({ contactActive: false, contactEnd: 'WITHDRAWN', ownerNode: 'FAR' });
    act(s, { type: 'TAKE_CARD' }); act(s, { type: 'REVOKE_CONSENT', personId: 'DCR2-ELENA', permission: 'MATERIAL' });
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); reject(s, { type: 'CHECK_CARD' });
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'RETURN_CARD' });
    act(s, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' }); act(s, { type: 'WITHDRAW', caseId: 'present-mark' });
    expect(s.discerner.life.cases['present-mark'].status).toBe('OBSERVED');
    expect(view(s).practice!.cards[card('present-mark')]).not.toHaveProperty('marking');
    reject(s, { type: 'REPORT', caseId: 'present-mark' }); reject(s, { type: 'PREPARE', caseId: 'present-mark', method: 'ABILITY' });
    // Explicit unit-only next date to inspect the retry gate; not a natural weekly transition.
    s.week++; s.date = addGameWeeks(s.date, 1);
    act(s, { type: 'PREPARE', caseId: 'present-mark', method: 'ORDINARY' });
    expect(view(s).currentAttempt).toMatchObject({ contactPermission: 'UNASKED', materialPermission: 'UNASKED', imprintAttempted: false });
  });

  it.each(['spirit', 'mind', 'failed-check', 'expired-mark'] as const)('keeps a fully ordinary path after %s without a refund or false mastery', reason => {
    const s = discernerLifeReady(); begin(s, 'present-mark');
    // Explicit unit-only exhaustion inputs; no natural snapshot is rewritten on disk.
    if (reason === 'spirit') s.spirituality = 0;
    if (reason === 'mind') s.mind = 2;
    act(s, { type: 'FORM_MARK' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' });
    const spirit = s.spirituality, mind = s.mind;
    if (reason === 'expired-mark') act(s, { type: 'WAIT_MARK' });
    if (reason === 'failed-check') { act(s, { type: 'MENTAL_IMPRINT' }, 100); reject(s, { type: 'MENTAL_IMPRINT' }); }
    else reject(s, { type: 'MENTAL_IMPRINT' });
    finishOrdinary(s, 'present-mark'); act(s, { type: 'REPORT', caseId: 'present-mark' });
    expect([s.spirituality, s.mind]).toEqual([spirit - (reason === 'failed-check' ? 6 : 0), mind - (reason === 'failed-check' ? 2 : 0)]);
    expect(attempt(s, 'present-mark').result).toBe('ORDINARY'); expect(s.progression.mastery[IMPRINT]).toBe(0);
  });

  it('lets paid implementation finish all movement and return steps at zero AP', () => {
    const s = discernerLifeReady(); act(s, { type: 'OBSERVE', caseId: 'present-mark' }); s.actionsRemaining = 1;
    reject(s, { type: 'PREPARE', caseId: 'present-mark', method: 'ORDINARY' }); s.actionsRemaining = 2;
    act(s, { type: 'PREPARE', caseId: 'present-mark', method: 'ORDINARY' });
    act(s, { type: 'CONSENT', personId: 'DCR2-ELENA', permission: 'MATERIAL' }); act(s, { type: 'PERFORM', caseId: 'present-mark' });
    expect(s.actionsRemaining).toBe(0); finishOrdinary(s, 'present-mark'); expect(s.actionsRemaining).toBe(0);
    expect(hasDiscernerLifeLock(s)).toBe(false); reject(s, { type: 'REPORT', caseId: 'present-mark' });
  });

  it('records three ordinary original-card comparisons and reflection without new ability mastery', () => {
    const s = discernerLifeReady(), mastery = structuredClone(s.progression.mastery), spirit = s.spirituality;
    for (const id of DISCERNER_CASE_IDS) ordinary(s, id);
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100);
    expect(s.progression.mastery).toEqual(mastery); expect(s.spirituality).toBe(spirit);
    expect(view(s).practice!.knownClues.map(k => k.source)).toEqual(['PHYSICAL_ORIGINAL', 'PHYSICAL_ORIGINAL', 'PHYSICAL_ORIGINAL']);
    expect(view(s).cases.map(c => c.attempts[0]!.ownerTravelMetres)).toEqual([12, 12, 12]);
    reject(s, { type: 'REFLECT' });
  });

  it('rejects forged replayed cost, check, ordering, duplicate card return and completed-source receipts', () => {
    const s = discernerLifeReady(); begin(s, 'present-mark'); act(s, { type: 'FORM_MARK' }); act(s, { type: 'MOVE', actor: 'OWNER', to: 'FAR' }); act(s, { type: 'MENTAL_IMPRINT' });
    finishOrdinary(s, 'present-mark'); act(s, { type: 'REPORT', caseId: 'present-mark' });
    const edits: ((x: SliceState) => void)[] = [
      x => { (x.discerner.life as unknown as Record<string, unknown>).cards = [{ id: 'COPY' }]; },
      x => { x.discerner.life.cases['present-mark'].attempts[0]!.steps.splice(2, 1); },
      x => { x.discerner.life.cases['present-mark'].attempts[0]!.steps.push({ type: 'RETURN_CARD' }); },
      x => { const step = x.discerner.life.cases['present-mark'].attempts[0]!.steps.find(v => v.type === 'MENTAL_IMPRINT')!; if (step.type === 'MENTAL_IMPRINT') step.spiritualityBefore = 5; },
      x => { const step = x.discerner.life.cases['present-mark'].attempts[0]!.steps.find(v => v.type === 'MENTAL_IMPRINT')!; if (step.type === 'MENTAL_IMPRINT') step.check.chance++; },
      x => { x.seer.completedSources.push('discerner-case:present-mark'); },
      x => { x.progression.mastery[IMPRINT] = 0; },
    ];
    for (const edit of edits) { const bad = structuredClone(s); edit(bad); expect(validateDiscernerLifeState(bad)).toBe(false); }
    const reordered = JSON.parse(stableStringify(s)) as SliceState;
    expect(validateDiscernerLifeState(reordered)).toBe(true); expect(view(reordered)).toEqual(view(s));
  });
});
