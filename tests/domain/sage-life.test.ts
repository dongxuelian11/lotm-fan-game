import { describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceState } from '../../src/domain/slice/types.js';
vi.mock('../../src/domain/sage/index.js', () => ({ hasSageOldPractice: () => false }));
import { blockSageLife, createSageLifeState, handleSageLife, projectSageLife, sageLifeClosed, validateSageActivityCommand, validateSageLifeState, validateSageSiteState, type SageActivityCommand, type SageCaseId } from '../../src/domain/sage/life.js';
const FORM = 'hermit.s2.information-form', SIFT = 'hermit.s2.information-sift';
/** Isolated, declared pre-journal unit inputs. These are not acquisition or natural-play evidence. */
function fixture(firstSuccess = true): SliceState {
  let seed = '';
  for (let n = 0; n < 512; n++) { const candidate = `sage-life-unit-${n}`, random = new DeterministicActionRandomStream(candidate, 0); if ((random.nextInt(1, 100) <= 95) === firstSuccess) { seed = candidate; break; } }
  expect(seed).not.toBe('');
  return { week: 1, date: { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 }, status: 'ACTIVE', activeEvent: null, combat: null, world: { city: 'BACKLUND' }, actionsRemaining: 100, cash: 1000, spirituality: 120, mind: 100, health: 100,
    character: { name: '测试者', gender: 'FEMALE', coreStats: { knowledge: 500 } }, random: { seed, cursor: 0 }, progression: { pathwayId: 'hermit', sequence: 2, acting: 0, mastery: { [FORM]: 0, [SIFT]: 0 } },
    prophecyMaster: { promotionWeek: 1, life: { siteId: 'PM3-WAREHOUSE', owner: { id: 'PM3-IRIS', name: '艾瑞丝·沃德', age: 49, alive: true, willing: true, location: 'START' }, playerLocation: 'START', playerTravelMetres: 60, clockSeconds: 119, records: { 'bounded-source': { id: 'PM3-BOUNDARY-RECORD', owner: 'PM3-IRIS', quantity: 1, location: 'OWNER', travelMetres: 12 } } } },
    sage: { promotionWeek: 1, preparedWeek: null, life: createSageLifeState(), encounter: { status: 'AVAILABLE', currentSite: null } },
  } as unknown as SliceState;
}
function act(s: SliceState, c: SageActivityCommand): SliceState {
  handleSageLife(s, c, { note() {}, roll(min, max) { const r = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), n = r.nextInt(min, max); s.random.cursor = r.cursor; return n; }, check(ability, difficulty) { const r = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), check = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: r.nextInt(1, 100) }); s.random.cursor = r.cursor; return check; } });
  expect(validateSageLifeState(s), JSON.stringify(c)).toBe(true); return s;
}
const a = (s: SliceState, id: SageCaseId) => s.sage.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, caseId: SageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'CONSENT_OWNER', caseId }); return act(s, { type: 'PREPARE', caseId, method }); }
function walk(s: SliceState, caseId: SageCaseId, to: 'ENTRY' | 'A' | 'B') { if (s.sage.life.site.playerLocation !== to) act(s, { type: 'WALK', caseId, to }); }
function finish(s: SliceState, caseId: SageCaseId, stop = false) {
  if (stop && !a(s, caseId).stopped) act(s, { type: 'STOP', caseId });
  if (s.sage.life.site.playerLocation === 'B') walk(s, caseId, 'A');
  if (s.sage.life.site.materials.find(x => x.caseId === caseId)!.status === 'INSTALLED') act(s, { type: 'REMOVE_ANCHOR', caseId });
  walk(s, caseId, 'ENTRY');
  if (s.sage.life.site.iris!.location === 'B') act(s, { type: 'RETURN_OWNER', caseId });
  act(s, { type: 'RETURN_ITEMS', caseId }); act(s, { type: 'INSPECT', caseId }); act(s, { type: 'LEAVE', caseId }); return act(s, { type: 'REPORT', caseId });
}
function ordinary(s: SliceState, caseId: SageCaseId) { start(s, caseId, 'ORDINARY'); if (caseId === 'joint-verification') act(s, { type: 'INVITE_OWNER', caseId }); walk(s, caseId, 'A'); walk(s, caseId, 'B'); act(s, { type: 'READ_ARCHIVE', caseId }); act(s, { type: 'VERIFY_INFORMATION', caseId }); return finish(s, caseId); }
function formed(s = fixture()) { const caseId = 'information-route'; start(s, caseId); walk(s, caseId, 'A'); act(s, { type: 'INSTALL_ANCHOR', caseId }); return act(s, { type: 'INFORMATION_FORM', caseId }); }
function reject(s: SliceState, command: SageActivityCommand) { const before = structuredClone(s); expect(() => act(s, command)).toThrow(); expect(s).toEqual(before); }
describe('Sage finite local life and strict replay', () => {
  it('rejects command injection and nonlocal destinations', () => { expect(validateSageActivityCommand({ type: 'REFLECT', extra: true })).toBe(false); expect(validateSageActivityCommand({ type: 'WALK', caseId: 'information-route', to: 'REMOTE' })).toBe(false); expect(validateSageActivityCommand({ type: 'SIFT_INFORMATION', caseId: 'bogus' })).toBe(false); expect(validateSageLifeState(fixture())).toBe(true); });
  it('keeps one original body and page, pays anchor/reassembly, and credits only actual route application on report', () => {
    const s = formed(), legacy = structuredClone(s.prophecyMaster), before = s.sage.life.site;
    expect(before).toMatchObject({ body: 'INFORMATION', playerLocation: 'A', formEnergySpent: 2, playerEnergy: 92, record: { id: 'PM3-BOUNDARY-RECORD', quantity: 1, location: 'PLAYER' } });
    expect([s.spirituality, s.mind, s.progression.mastery[FORM]]).toEqual([112, 98, 0]); reject(s, { type: 'WALK', caseId: 'information-route', to: 'B' });
    act(s, { type: 'TRAVERSE_CONDUIT', caseId: 'information-route' }); expect(s.sage.life.site.playerLocation).toBe('B'); expect(a(s, 'information-route').playerMoves.at(-1)).toMatchObject({ mode: 'INFORMATION_CONDUIT', metres: 4, seconds: 4, itemIds: ['PM3-BOUNDARY-RECORD'] });
    act(s, { type: 'REASSEMBLE', caseId: 'information-route' }); expect(s.sage.life.site.playerLocation).toBe('B'); expect(s.progression.mastery[FORM]).toBe(0); finish(s, 'information-route');
    expect(s.progression.mastery[FORM]).toBe(8); expect(s.sage.life.site).toMatchObject({ playerEnergy: 78, playerTravelMetres: 20, body: 'SOLID', record: { location: 'OWNER', travelMetres: 32 } }); expect(s.sage.life.site.materials[0]).toMatchObject({ status: 'RETURNED', wear: 2, paidPennies: 20 }); expect(s.prophecyMaster).toEqual(legacy);
  });
  it('failure keeps exact costs and actual assimilation shock; ordinary verification completes with no form mastery', () => {
    const s = formed(fixture(false)), id = 'information-route'; expect(s.sage.life.site.body).toBe('SOLID'); expect(s.spirituality).toBe(112); expect(s.mind).toBe(96); expect(a(s, id).mindSpent).toBe(4);
    walk(s, id, 'B'); const ap = s.actionsRemaining; act(s, { type: 'READ_ARCHIVE', caseId: id }); expect(s.actionsRemaining).toBe(ap); act(s, { type: 'VERIFY_INFORMATION', caseId: id }); finish(s, id); expect(s.progression.mastery[FORM]).toBe(0); expect(s.progression.acting).toBe(25);
  });
  it('expired form reconstructs at the same place with additional real mind loss, no route or mastery', () => {
    const s = formed(), id = 'information-route'; act(s, { type: 'WAIT_10', caseId: id }); act(s, { type: 'WAIT_10', caseId: id }); expect(s.mind).toBe(96); expect(a(s, id)).toMatchObject({ expired: true, reassembled: true, mindSpent: 4, traversed: false }); expect(s.sage.life.site).toMatchObject({ body: 'SOLID', playerLocation: 'A' }); finish(s, id, true); expect(s.progression.mastery[FORM]).toBe(0);
  });
  it('does not reveal unread leaf content; sift still requires actual verification of false and missing portions', () => {
    const s = ordinary(fixture(), 'information-route'), id = 'onsite-sift'; start(s, id); walk(s, id, 'A'); walk(s, id, 'B'); expect(projectSageLife(s).cases[1]!.observations.join('')).not.toContain('第四格');
    act(s, { type: 'SIFT_INFORMATION', caseId: id }); if (!a(s, id).read) act(s, { type: 'READ_ARCHIVE', caseId: id }); expect(a(s, id).information).toHaveLength(3); expect(a(s, id).correction).toBeNull(); expect(s.progression.mastery[SIFT]).toBe(0);
    act(s, { type: 'VERIFY_INFORMATION', caseId: id }); expect(a(s, id).correction).toContain('仍记未知'); finish(s, id); expect(s.progression.mastery[SIFT]).toBe(a(s, id).siftTier === 'SUCCESS' || a(s, id).siftTier === 'GREAT_SUCCESS' ? 8 : 0);
  });
  it('requires three action points for joint ability preparation, permits ordinary completion, and never refills site energy', () => {
    const s = ordinary(ordinary(fixture(), 'information-route'), 'onsite-sift'), id = 'joint-verification'; act(s, { type: 'OBSERVE', caseId: id }); act(s, { type: 'CONSENT_OWNER', caseId: id }); s.actionsRemaining = 2;
    expect(blockSageLife(s, { type: 'PREPARE', caseId: id, method: 'ABILITY' })).not.toBeNull(); act(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); act(s, { type: 'INVITE_OWNER', caseId: id }); walk(s, id, 'A'); walk(s, id, 'B'); act(s, { type: 'READ_ARCHIVE', caseId: id }); act(s, { type: 'VERIFY_INFORMATION', caseId: id }); finish(s, id); s.actionsRemaining = 1; act(s, { type: 'REFLECT' });
    expect(sageLifeClosed(s)).toBe(true); expect(s.progression.acting).toBe(100); expect(s.sage.life.site).toMatchObject({ playerTravelMetres: 60, playerEnergy: 40, iris: { location: 'ENTRY', travelMetres: 20, energy: 80 } }); expect(s.progression.mastery).toEqual({ [FORM]: 0, [SIFT]: 0 });
  });
  it('reports each actually used ability separately in the joint task and preserves the original adult and all finite material costs', () => {
    const s = fixture();
    for (const caseId of ['information-route', 'onsite-sift', 'joint-verification'] as const) {
      start(s, caseId); if (caseId === 'joint-verification') act(s, { type: 'INVITE_OWNER', caseId }); walk(s, caseId, 'A');
      if (caseId !== 'onsite-sift') { act(s, { type: 'INSTALL_ANCHOR', caseId }); act(s, { type: 'INFORMATION_FORM', caseId }); if (s.sage.life.site.body === 'INFORMATION') { act(s, { type: 'TRAVERSE_CONDUIT', caseId }); act(s, { type: 'REASSEMBLE', caseId }); } else walk(s, caseId, 'B'); } else walk(s, caseId, 'B');
      if (caseId !== 'information-route') act(s, { type: 'SIFT_INFORMATION', caseId });
      if (caseId !== 'information-route' || !a(s, caseId).traversed) { if (!a(s, caseId).read) act(s, { type: 'READ_ARCHIVE', caseId }); act(s, { type: 'VERIFY_INFORMATION', caseId }); }
      finish(s, caseId);
    }
    act(s, { type: 'REFLECT' });
    for (const ability of [FORM, SIFT]) expect(s.progression.mastery[ability]).toBe(Object.values(s.sage.life.cases).filter(r => r.attempts[0]!.appliedAbilityIds.includes(ability as typeof FORM | typeof SIFT)).length * 8);
    expect(s.sage.life.site).toMatchObject({ playerTravelMetres: 60, playerEnergy: 36, formEnergySpent: 4, iris: { id: 'PM3-IRIS', age: 49, alive: true, willing: true, location: 'ENTRY', energy: 80, travelMetres: 20 } });
    expect(s.spirituality).toBe(92); expect(s.cash).toBe(940); expect(s.sage.life.site.materials.every(m => m.status === 'RETURNED')).toBe(true); expect(s.progression.acting).toBe(100);
  });
  it('honors revocation mid-form without remote return, free costs or permanent control', () => {
    const s = formed(), id = 'information-route', spirit = s.spirituality; act(s, { type: 'TRAVERSE_CONDUIT', caseId: id }); act(s, { type: 'WITHDRAW_PERMISSION', caseId: id }); expect(s.sage.life.site).toMatchObject({ body: 'SOLID', playerLocation: 'B', iris: { consent: 'WITHDRAWN', willing: true } }); reject(s, { type: 'SIFT_INFORMATION', caseId: id }); reject(s, { type: 'RETURN_ITEMS', caseId: id }); finish(s, id); expect(s.spirituality).toBe(spirit); expect(a(s, id).permissionWithdrawn).toBe(true);
  });
  it('rejects tampered objects, budgets, checks, source, movement, rewards and extra fields', () => {
    const s = formed(); act(s, { type: 'TRAVERSE_CONDUIT', caseId: 'information-route' }); act(s, { type: 'REASSEMBLE', caseId: 'information-route' }); finish(s, 'information-route');
    const mutations: ((x: SliceState) => void)[] = [x => x.sage.life.site.playerEnergy++, x => x.sage.life.site.record!.travelMetres++, x => x.sage.life.site.materials[0]!.wear = 0, x => x.sage.life.journal[0]!.budget.cashAfter++, x => x.sage.life.journal.find(e => e.check)!.check!.roll = 1, x => x.sage.life.journal[0]!.inheritedScene!.snapshot.owner.age = 48 as 49, x => x.sage.life.cases['information-route'].attempts[0]!.playerMoves[0]!.metres++, x => x.progression.mastery[FORM] = 16, x => (x.sage.life as unknown as Record<string, unknown>).extra = true];
    for (const change of mutations) { const copy = structuredClone(s); change(copy); expect(validateSageLifeState(copy)).toBe(false); } expect(validateSageSiteState(s.sage.life.site)).toBe(true);
  });
});
