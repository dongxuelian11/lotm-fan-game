import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createFerrymanState } from '../../src/domain/ferryman/index.js';
import { applyFerrymanActivity, blockFerrymanLife, createFerrymanLifeState, FERRYMAN_CASE_IDS, hasFerrymanLifeLock, projectFerrymanLife, validateFerrymanActivityCommand, validateFerrymanLife, type FerrymanActivityCommand, type FerrymanCaseId } from '../../src/domain/ferryman/life.js';

const FERRY = 'death.s3.bounded-ferry', WARD = 'death.s3.departure-ward';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Isolated directed scene fixture; campaign replay verifies the unmodified historical prefix. */
function ready(postCycle = false): SliceState {
  const s = createSliceRun('ferryman-life', sliceDefaultCreationSelection, 'ferryman-life');
  s.ferryman = createFerrymanState(); s.week = 20; s.ferryman.promotionWeek = 19; s.ferryman.promotionDate = { ...s.date }; s.ferryman.undyingActingAtPromotion = 100;
  s.ferryman.channels.push({ id: postCycle ? 'POST_CYCLE' : 'ORIGINAL', provider: { id: postCycle ? 'FR3-HANNA' : 'FR3-LEWIS', name: postCycle ? '汉娜·斯托克' : '路易斯·赛尔', ageAtIntroduction: postCycle ? 43 : 56 }, introducedWeek: 18, introducedDate: { ...s.date }, guidancePaid: 120, agreementClosedDate: null, bottles: [], resupply: { requestedWeek: null, requestedDate: null, cancelledDate: null, deliveries: 0 }, preparations: [], preparedWeek: null, preparationWindows: [] });
  if (postCycle) s.ferryman.era.location = 'RECEPTION';
  s.progression = { pathwayId: 'death', sequence: 3, acting: 0, promotionWeek: 19, mastery: { [FERRY]: 0, [WARD]: 0, 'death.s4.underworld-seal': 37 } };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000;
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: FerrymanActivityCommand, roll = 1) { const ctx = context(s, roll); applyFerrymanActivity(s, command, ctx); expect(validateFerrymanLife(s), `${command.type}: ${JSON.stringify(s.ferryman.life)}`).toBe(true); return ctx; }
function step(s: SliceState, caseId: FerrymanCaseId, type: Exclude<FerrymanActivityCommand['type'], 'PREPARE' | 'REFLECT'>, roll = 1) { return act(s, { type, caseId } as FerrymanActivityCommand, roll); }
function reject(s: SliceState, command: FerrymanActivityCommand) { const before = structuredClone(s); expect(() => applyFerrymanActivity(s, command, context(s))).toThrow(); expect(s).toEqual(before); }
const attempt = (s: SliceState, id: FerrymanCaseId) => s.ferryman.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, caseId: FerrymanCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { if (s.ferryman.life.cases[caseId].status === 'AVAILABLE') step(s, caseId, 'OBSERVE'); act(s, { type: 'PREPARE', caseId, method }); step(s, caseId, 'PERFORM'); }
function setupPassage(s: SliceState, caseId: 'passage-out' | 'passage-return') { for (const type of ['CONSENT_OWNER', 'GO_SITE', 'CHECK_ENDPOINTS', 'CONSENT_SPIRIT'] as const) step(s, caseId, type); step(s, caseId, caseId === 'passage-out' ? 'HAND_TAG' : 'WRITE_REPLY'); }
function stopEffect(s: SliceState, id: FerrymanCaseId) { if (attempt(s, id).effectActive) step(s, id, 'STOP_EFFECT'); }
function close(s: SliceState, caseId: FerrymanCaseId) { if (s.ferryman.life.playerLocation !== 'START') step(s, caseId, 'RETURN_PLAYER'); step(s, caseId, 'INSPECT'); step(s, caseId, 'CLOSE'); }
function finish(s: SliceState, caseId: FerrymanCaseId, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  start(s, caseId, method);
  if (caseId === 'quiet-jar') { step(s, caseId, 'GO_SITE'); step(s, caseId, 'CONSENT_OWNER'); if (method === 'ABILITY') step(s, caseId, 'QUIET_JAR', roll); step(s, caseId, 'SEAL_JAR'); stopEffect(s, caseId); }
  else { setupPassage(s, caseId); if (method === 'ABILITY') step(s, caseId, 'OPEN_PASSAGE', roll); step(s, caseId, 'CROSS_SPIRIT'); step(s, caseId, 'GO_RECIPIENT'); if (caseId === 'passage-out') step(s, caseId, 'DELIVER_TAG'); else step(s, caseId, 'TAKE_REPLY'); stopEffect(s, caseId); if (caseId === 'passage-return') { step(s, caseId, 'RETURN_PLAYER'); step(s, caseId, 'DELIVER_REPLY'); } }
  close(s, caseId); step(s, caseId, 'REPORT');
}
function toJar(s: SliceState) { finish(s, 'passage-out'); start(s, 'quiet-jar'); step(s, 'quiet-jar', 'GO_SITE'); step(s, 'quiet-jar', 'CONSENT_OWNER'); }
function toReturn(s: SliceState) { finish(s, 'passage-out'); finish(s, 'quiet-jar'); start(s, 'passage-return'); }

describe('Ferryman connected finite G life and original local spirit', () => {
  it('keeps current people unintroduced until actual observation and never revives older people', () => {
    const s = ready(true), old = structuredClone({ undying: s.undying, gatekeeper: s.gatekeeper, spiritGuide: s.spiritGuide });
    expect(validateFerrymanLife(s)).toBe(true); expect(s.ferryman.life.introducedWeek).toBeNull();
    step(s, 'passage-out', 'OBSERVE'); const l = s.ferryman.life;
    expect(l).toMatchObject({ introducedWeek: 20, introducedDate: s.date, channelId: 'POST_CYCLE' });
    expect(l.mara).toMatchObject({ id: 'FR3-MARA', age: 45 }); expect(l.ilan).toMatchObject({ id: 'FR3-ILAN', age: 33 }); expect(l.reed).toMatchObject({ id: 'FR3-REED', source: 'CURRENT_TRANSFER_HOUSE', location: 'NEAR', energy: 100 });
    expect({ undying: s.undying, gatekeeper: s.gatekeeper, spiritGuide: s.spiritGuide }).toEqual(old);
    expect(projectFerrymanLife(s).story).toContain('原创G'); expect(projectFerrymanLife(s).story).toContain('共13行动');
  });
  it('requires actual current-era arrival rather than acting from outside reception', () => { const s = ready(true); s.ferryman.era.location = 'OUTSIDE'; reject(s, { type: 'OBSERVE', caseId: 'passage-out' }); });
  it('projects detached objects, attempts and movement records', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); const v = projectFerrymanLife(s);
    v.reed.energy = 0; v.tag.location = 'ILAN'; v.endpoints.nearIntact = false; v.currentAttempt!.playerMoves[0]!.metres = 99; v.cases[0]!.attempts[0]!.materialsSpent = 2;
    expect(s.ferryman.life.reed.energy).toBe(100); expect(s.ferryman.life.tag.location).toBe('REED'); expect(s.ferryman.life.endpoints.nearIntact).toBe(true); expect(attempt(s, 'passage-out').playerMoves[0]!.metres).toBe(4); expect(attempt(s, 'passage-out').materialsSpent).toBe(0);
  });
  it('requires specific current owner and original spirit consent before carrying or casting', () => {
    const s = ready(); start(s, 'passage-out'); reject(s, { type: 'GO_SITE', caseId: 'passage-out' }); step(s, 'passage-out', 'CONSENT_OWNER'); step(s, 'passage-out', 'GO_SITE'); step(s, 'passage-out', 'CHECK_ENDPOINTS');
    expect(s.ferryman.life.tag).toMatchObject({ location: 'PLAYER', travelMetres: 4 }); reject(s, { type: 'HAND_TAG', caseId: 'passage-out' }); reject(s, { type: 'OPEN_PASSAGE', caseId: 'passage-out' });
    step(s, 'passage-out', 'CONSENT_SPIRIT'); step(s, 'passage-out', 'HAND_TAG'); expect(blockFerrymanLife(s, { type: 'OPEN_PASSAGE', caseId: 'passage-out' })).toBeNull();
  });
  it('moves only the same willing spirit and original tag through finite endpoints, then walks the player', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); const l = s.ferryman.life, spirit = l.reed, tag = l.tag;
    const ctx = step(s, 'passage-out', 'OPEN_PASSAGE'); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18); expect(s.spirituality).toBe(114); expect(l.materials.remaining).toBe(1); expect(l.reed.location).toBe('NEAR');
    expect(attempt(s, 'passage-out').effectRemainingSeconds).toBe(20); step(s, 'passage-out', 'CROSS_SPIRIT');
    expect(l.reed).toBe(spirit); expect(l.tag).toBe(tag); expect(l.reed).toMatchObject({ location: 'FAR', energy: 97, travelMetres: 6 }); expect(l.playerLocation).toBe('NEAR'); expect(l.tag).toMatchObject({ location: 'REED', travelMetres: 10 }); expect(attempt(s, 'passage-out').effectRemainingSeconds).toBe(14);
    reject(s, { type: 'DELIVER_TAG', caseId: 'passage-out' }); reject(s, { type: 'CROSS_SPIRIT', caseId: 'passage-out' }); step(s, 'passage-out', 'GO_RECIPIENT'); step(s, 'passage-out', 'DELIVER_TAG');
    reject(s, { type: 'RETURN_PLAYER', caseId: 'passage-out' }); step(s, 'passage-out', 'STOP_EFFECT'); close(s, 'passage-out'); step(s, 'passage-out', 'REPORT');
    expect(l).toMatchObject({ playerLocation: 'START', playerTravelMetres: 20, clockSeconds: 40 }); expect(l.reed.location).toBe('FAR'); expect(l.tag.location).toBe('ILAN'); expect(s.progression.mastery[FERRY]).toBe(8);
  });
  it('charges a failed passage once and finishes via real ordinary sixteen-metre travel', () => {
    const s = ready(); finish(s, 'passage-out', 100); const a = attempt(s, 'passage-out');
    expect(a).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, materialsSpent: 1, passageBenefit: false, spiritTravelMetres: 16, spiritEnergySpent: 6, result: 'ORDINARY' });
    expect(s.ferryman.life.reed).toMatchObject({ location: 'FAR', energy: 94, travelMetres: 16 }); expect(s.ferryman.life.tag.travelMetres).toBe(20); expect(s.progression.mastery[FERRY]).toBe(0); reject(s, { type: 'OPEN_PASSAGE', caseId: 'passage-out' });
  });
  it('expires unused success without teleporting, refunding materials, or awarding mastery', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); step(s, 'passage-out', 'OPEN_PASSAGE'); step(s, 'passage-out', 'WAIT_WINDOW');
    expect(attempt(s, 'passage-out')).toMatchObject({ effectActive: false, effectRemainingSeconds: 0, waitedSeconds: 20, effectExpired: true }); expect(s.ferryman.life.reed.location).toBe('NEAR');
    s.spirituality = 0; step(s, 'passage-out', 'CROSS_SPIRIT'); step(s, 'passage-out', 'GO_RECIPIENT'); step(s, 'passage-out', 'DELIVER_TAG'); close(s, 'passage-out'); step(s, 'passage-out', 'REPORT');
    expect(s.ferryman.life.reed.energy).toBe(94); expect(s.progression.mastery[FERRY]).toBe(0); expect(s.ferryman.life.materials.remaining).toBe(1);
  });
  it('expiry after actual crossing leaves the spirit at the far endpoint', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); step(s, 'passage-out', 'OPEN_PASSAGE'); step(s, 'passage-out', 'CROSS_SPIRIT'); step(s, 'passage-out', 'WAIT_WINDOW');
    expect(s.ferryman.life.reed.location).toBe('FAR'); expect(s.ferryman.life.playerLocation).toBe('NEAR'); step(s, 'passage-out', 'GO_RECIPIENT'); step(s, 'passage-out', 'DELIVER_TAG'); close(s, 'passage-out'); step(s, 'passage-out', 'REPORT'); expect(s.progression.mastery[FERRY]).toBe(8);
  });
  it('does not coerce a refusing original spirit and returns the same player-carried tag', () => {
    const s = ready(); s.ferryman.life.reed.willing = false; start(s, 'passage-out'); for (const type of ['CONSENT_OWNER', 'GO_SITE', 'CHECK_ENDPOINTS', 'CONSENT_SPIRIT'] as const) step(s, 'passage-out', type);
    reject(s, { type: 'HAND_TAG', caseId: 'passage-out' }); reject(s, { type: 'OPEN_PASSAGE', caseId: 'passage-out' }); close(s, 'passage-out'); step(s, 'passage-out', 'REPORT');
    expect(s.ferryman.life.tag).toMatchObject({ location: 'MARA', travelMetres: 8 }); expect(s.ferryman.life.reed).toMatchObject({ location: 'NEAR', energy: 100 }); expect(attempt(s, 'passage-out').result).toBe('ORDINARY'); expect(s.spirituality).toBe(120);
  });
  it('honors revoked consent after opening and preserves ordinary custody cleanup at zero resources', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); step(s, 'passage-out', 'OPEN_PASSAGE'); s.ferryman.life.reed.willing = false; s.ferryman.life.mara.willing = false; s.spirituality = 0; s.actionsRemaining = 0;
    reject(s, { type: 'CROSS_SPIRIT', caseId: 'passage-out' }); step(s, 'passage-out', 'STOP_CONTACT'); step(s, 'passage-out', 'STOP_EFFECT'); step(s, 'passage-out', 'RETURN_ITEMS'); close(s, 'passage-out');
    expect(hasFerrymanLifeLock(s)).toBe(false); expect(s.ferryman.life.tag.location).toBe('MARA'); expect(s.ferryman.life.reed.location).toBe('NEAR'); expect(s.ferryman.life.materials.remaining).toBe(1); s.actionsRemaining = 1; step(s, 'passage-out', 'REPORT'); expect(s.progression.mastery[FERRY]).toBe(0);
  });
  it('retains the actual far position when a crossed delivery is stopped and the paper returned', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); step(s, 'passage-out', 'CROSS_SPIRIT'); step(s, 'passage-out', 'STOP_CONTACT'); step(s, 'passage-out', 'GO_RECIPIENT'); step(s, 'passage-out', 'RETURN_ITEMS'); close(s, 'passage-out'); step(s, 'passage-out', 'REPORT');
    expect(s.ferryman.life.tag).toMatchObject({ location: 'MARA', travelMetres: 30 }); expect(s.ferryman.life.reed).toMatchObject({ location: 'FAR', energy: 94 }); expect(s.progression.mastery[FERRY]).toBe(0);
  });
  it('does not cast or cross a broken endpoint, but allows ordinary travel after closing the effect', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); step(s, 'passage-out', 'OPEN_PASSAGE'); s.ferryman.life.endpoints.farIntact = false;
    reject(s, { type: 'CROSS_SPIRIT', caseId: 'passage-out' }); step(s, 'passage-out', 'STOP_EFFECT'); step(s, 'passage-out', 'CROSS_SPIRIT'); expect(s.ferryman.life.reed.travelMetres).toBe(16);
  });
  it('does not invent movement across a blocked ordinary door or waive reserve energy', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); s.ferryman.life.reed.energy = 11; reject(s, { type: 'OPEN_PASSAGE', caseId: 'passage-out' }); reject(s, { type: 'CROSS_SPIRIT', caseId: 'passage-out' });
    s.ferryman.life.reed.energy = 100; s.ferryman.life.door.state = 'BLOCKED'; reject(s, { type: 'CROSS_SPIRIT', caseId: 'passage-out' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'passage-out' });
  });
  it('temporarily quiets the same original echo but keeps residual two and real sealing separate', () => {
    const s = ready(); toJar(s); const l = s.ferryman.life, jar = l.jar; const ctx = step(s, 'quiet-jar', 'QUIET_JAR'); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18);
    expect(jar).toMatchObject({ agitation: 0, residualEcho: 2, sealed: false, lidClosed: false }); expect(l.seal.remaining).toBe(1); step(s, 'quiet-jar', 'SEAL_JAR');
    expect(l.jar).toBe(jar); expect(jar).toMatchObject({ agitation: 0, residualEcho: 2, sealed: true, lidClosed: true, location: 'FAR', quantity: 1 }); expect(l.clamp.durability).toBe(100); expect(l.seal.remaining).toBe(0);
    reject(s, { type: 'RETURN_PLAYER', caseId: 'quiet-jar' }); step(s, 'quiet-jar', 'STOP_EFFECT'); expect(jar.agitation).toBe(2); close(s, 'quiet-jar'); step(s, 'quiet-jar', 'REPORT'); expect(s.progression.mastery[WARD]).toBe(8);
  });
  it('uses the original clamp and one original seal after failed quieting without rerolls', () => {
    const s = ready(); toJar(s); step(s, 'quiet-jar', 'QUIET_JAR', 100); reject(s, { type: 'QUIET_JAR', caseId: 'quiet-jar' }); s.spirituality = 0;
    step(s, 'quiet-jar', 'SEAL_JAR'); close(s, 'quiet-jar'); step(s, 'quiet-jar', 'REPORT');
    expect(s.ferryman.life.jar).toMatchObject({ agitation: 2, residualEcho: 2, sealed: true }); expect(s.ferryman.life.clamp.durability).toBe(98); expect(s.ferryman.life.seal.remaining).toBe(0); expect(s.progression.mastery[WARD]).toBe(0); expect(attempt(s, 'quiet-jar')).toMatchObject({ spiritualitySpent: 6, sealBenefit: false, clampWear: 2 });
  });
  it('ordinary sealing after expired quiet success cannot earn mastery', () => {
    const s = ready(); toJar(s); step(s, 'quiet-jar', 'QUIET_JAR'); step(s, 'quiet-jar', 'WAIT_WINDOW'); expect(s.ferryman.life.jar.agitation).toBe(2); step(s, 'quiet-jar', 'SEAL_JAR'); close(s, 'quiet-jar'); step(s, 'quiet-jar', 'REPORT');
    expect(attempt(s, 'quiet-jar')).toMatchObject({ abilityTier: 'GREAT_SUCCESS', jarQuieted: true, sealBenefit: false, result: 'ORDINARY' }); expect(s.ferryman.life.clamp.durability).toBe(98); expect(s.progression.mastery[WARD]).toBe(0);
  });
  it('refusing original jar owner cannot be treated as consent to sealing', () => {
    const s = ready(); finish(s, 'passage-out'); s.ferryman.life.ilan.willing = false; start(s, 'quiet-jar'); step(s, 'quiet-jar', 'GO_SITE'); step(s, 'quiet-jar', 'CONSENT_OWNER');
    reject(s, { type: 'QUIET_JAR', caseId: 'quiet-jar' }); reject(s, { type: 'SEAL_JAR', caseId: 'quiet-jar' }); close(s, 'quiet-jar'); step(s, 'quiet-jar', 'REPORT'); expect(s.ferryman.life.jar.sealed).toBe(false); expect(s.ferryman.life.seal.remaining).toBe(1);
  });
  it('renews consent at the far endpoint and creates a distinct original reply, keeping the original tag', () => {
    const s = ready(); toReturn(s); step(s, 'passage-return', 'CONSENT_OWNER'); step(s, 'passage-return', 'GO_SITE'); step(s, 'passage-return', 'CHECK_ENDPOINTS');
    expect(s.ferryman.life.reed.location).toBe('FAR'); expect(attempt(s, 'passage-return').spiritConsent).toBe('UNASKED'); reject(s, { type: 'WRITE_REPLY', caseId: 'passage-return' });
    step(s, 'passage-return', 'CONSENT_SPIRIT'); step(s, 'passage-return', 'WRITE_REPLY'); expect(s.ferryman.life.reply).toMatchObject({ written: true, id: 'FR3-REPLY', location: 'REED' }); expect(s.ferryman.life.tag).toMatchObject({ id: 'FR3-TAG', location: 'ILAN' });
    step(s, 'passage-return', 'OPEN_PASSAGE'); step(s, 'passage-return', 'CROSS_SPIRIT'); expect(s.ferryman.life.reed).toMatchObject({ location: 'NEAR', energy: 94, travelMetres: 12 }); expect(s.ferryman.life.playerLocation).toBe('FAR');
    step(s, 'passage-return', 'GO_RECIPIENT'); step(s, 'passage-return', 'TAKE_REPLY'); step(s, 'passage-return', 'STOP_EFFECT'); step(s, 'passage-return', 'RETURN_PLAYER'); step(s, 'passage-return', 'DELIVER_REPLY'); close(s, 'passage-return'); step(s, 'passage-return', 'REPORT');
    expect(s.ferryman.life.reply).toMatchObject({ location: 'MARA', travelMetres: 10 }); expect(s.ferryman.life.tag.location).toBe('ILAN'); expect(s.ferryman.life.materials.remaining).toBe(0); expect(s.progression.mastery[FERRY]).toBe(16);
  });
  it('accepts return refusal and leaves the same spirit at FAR without creating a reply or ally', () => {
    const s = ready(); toReturn(s); s.ferryman.life.reed.willing = false; for (const type of ['CONSENT_OWNER', 'GO_SITE', 'CHECK_ENDPOINTS', 'CONSENT_SPIRIT'] as const) step(s, 'passage-return', type);
    reject(s, { type: 'WRITE_REPLY', caseId: 'passage-return' }); reject(s, { type: 'CROSS_SPIRIT', caseId: 'passage-return' }); close(s, 'passage-return'); step(s, 'passage-return', 'REPORT');
    expect(s.ferryman.life.reed).toMatchObject({ location: 'FAR', energy: 97 }); expect(s.ferryman.life.reply).toMatchObject({ written: false, location: 'UNWRITTEN' }); expect(s.ferryman.life.materials.remaining).toBe(1); expect(s.progression.mastery[FERRY]).toBe(8);
  });
  it('returns an already written reply to its actual FAR author when the spirit stops before crossing', () => {
    const s = ready(); toReturn(s); setupPassage(s, 'passage-return'); step(s, 'passage-return', 'STOP_CONTACT'); step(s, 'passage-return', 'RETURN_ITEMS'); close(s, 'passage-return'); step(s, 'passage-return', 'REPORT');
    expect(s.ferryman.life.reply).toMatchObject({ written: true, location: 'ILAN', travelMetres: 0 }); expect(s.ferryman.life.reed.location).toBe('FAR'); expect(s.progression.mastery[FERRY]).toBe(8);
  });
  it('does not invent a far-end spirit after an ordinary refusal of the outgoing job', () => {
    const s = ready(); start(s, 'passage-out'); step(s, 'passage-out', 'STOP_CONTACT'); close(s, 'passage-out'); step(s, 'passage-out', 'REPORT'); finish(s, 'quiet-jar'); start(s, 'passage-return'); step(s, 'passage-return', 'CONSENT_OWNER'); reject(s, { type: 'GO_SITE', caseId: 'passage-return' }); step(s, 'passage-return', 'STOP_CONTACT'); close(s, 'passage-return'); step(s, 'passage-return', 'REPORT'); expect(s.ferryman.life.reed.location).toBe('NEAR');
  });
  it('completes exactly thirteen common AP, 60 player metres, real spirit costs and once-only mastery', () => {
    const s = ready(); const old = structuredClone({ gatekeeper: s.gatekeeper, spiritGuide: s.spiritGuide, undying: s.undying });
    for (const id of FERRYMAN_CASE_IDS) finish(s, id); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(102); expect(s.ferryman.life.playerTravelMetres).toBe(60); expect(s.ferryman.life.clockSeconds).toBe(111); expect(s.ferryman.life.reed.energy).toBe(94); expect(s.progression.mastery).toMatchObject({ [FERRY]: 16, [WARD]: 8, 'death.s4.underworld-seal': 37 });
    expect({ gatekeeper: s.gatekeeper, spiritGuide: s.spiritGuide, undying: s.undying }).toEqual(old); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'passage-return' }); expect(hasFerrymanLifeLock(s)).toBe(false);
  });
  it('supports wholly ordinary work without spending spirituality/materials or earning magic mastery', () => {
    const s = ready(); s.spirituality = 0; for (const id of FERRYMAN_CASE_IDS) finish(s, id, 1, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.ferryman.life.reed).toMatchObject({ energy: 88, travelMetres: 32, location: 'NEAR' }); expect(s.ferryman.life.materials.remaining).toBe(2); expect(s.ferryman.life.clamp.durability).toBe(98); expect(s.progression.mastery[FERRY]).toBe(0); expect(s.progression.mastery[WARD]).toBe(0); expect(s.progression.acting).toBe(100);
  });
  it('preserves paid active windows and actual custody through JSON save and resume', () => {
    const s = ready(); start(s, 'passage-out'); setupPassage(s, 'passage-out'); step(s, 'passage-out', 'OPEN_PASSAGE'); step(s, 'passage-out', 'CROSS_SPIRIT');
    const loaded: SliceState = JSON.parse(JSON.stringify(s)); expect(validateFerrymanLife(loaded)).toBe(true); expect(loaded.ferryman.life).toEqual(s.ferryman.life);
    reject(loaded, { type: 'OPEN_PASSAGE', caseId: 'passage-out' }); step(loaded, 'passage-out', 'GO_RECIPIENT'); step(loaded, 'passage-out', 'DELIVER_TAG'); stopEffect(loaded, 'passage-out'); close(loaded, 'passage-out'); step(loaded, 'passage-out', 'REPORT'); expect(loaded.ferryman.life.reed.location).toBe('FAR');
  });
  it('requires the two-AP preparation reserve and allows a zero-AP cancellation', () => {
    const s = ready(); step(s, 'passage-out', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'passage-out', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'passage-out', method: 'ABILITY' }); s.actionsRemaining = 0; step(s, 'passage-out', 'WITHDRAW'); expect(s.ferryman.life.cases['passage-out'].status).toBe('OBSERVED'); expect(hasFerrymanLifeLock(s)).toBe(false);
  });
  it('validates exact commands and rejects swapped case operations or extra teleport destinations', () => {
    expect(validateFerrymanActivityCommand({ type: 'OPEN_PASSAGE', caseId: 'passage-out' })).toBe(true); expect(validateFerrymanActivityCommand({ type: 'QUIET_JAR', caseId: 'quiet-jar' })).toBe(true); expect(validateFerrymanActivityCommand({ type: 'WRITE_REPLY', caseId: 'passage-return' })).toBe(true);
    expect(validateFerrymanActivityCommand({ type: 'WRITE_REPLY', caseId: 'passage-out' })).toBe(false); expect(validateFerrymanActivityCommand({ type: 'OPEN_PASSAGE', caseId: 'passage-return', destination: 'UNDERWORLD' })).toBe(false); expect(validateFerrymanActivityCommand({ type: 'REFLECT', caseId: 'passage-out' })).toBe(false); expect(createFerrymanLifeState().materials.remaining).toBe(2);
  });
  it('rejects duplicated originals, reset energy/costs, permanent purification and vanished custody on save', () => {
    const s = ready(); for (const id of FERRYMAN_CASE_IDS) finish(s, id);
    for (const mutate of [
      (x: SliceState) => { x.ferryman.life.reed.energy = 100; },
      (x: SliceState) => { x.ferryman.life.materials.remaining = 2; },
      (x: SliceState) => { x.ferryman.life.jar.agitation = 0; },
      (x: SliceState) => { x.ferryman.life.tag.location = 'MARA'; },
      (x: SliceState) => { x.ferryman.life.reply.location = 'UNWRITTEN'; },
      (x: SliceState) => { x.ferryman.life.clockSeconds++; },
      (x: SliceState) => { (x.ferryman.life.reed as { id: string }).id = 'SG6-GRAY-FEATHER'; },
    ]) { const copy = structuredClone(s); mutate(copy); expect(validateFerrymanLife(copy)).toBe(false); }
  });
});
