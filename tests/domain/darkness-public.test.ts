import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import {
  MISFORTUNE_KNIGHT_COMBAT_CONSTANTS, MISFORTUNE_KNIGHT_COUNT_WHEEL,
  MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL, MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL,
  misfortuneKnightAbilityWheel, projectMisfortuneKnightAction, projectMisfortuneKnightCombat,
  projectMisfortuneKnightRoundOutcome,
} from '../../src/domain/misfortune-knight/combat.js';
import { projectMisfortuneKnightLife, projectMisfortuneKnightLifeReceipt, type MisfortuneKnightLifeReceipt } from '../../src/domain/misfortune-knight/life.js';
import {
  CONCEALMENT_SERVANT_COUNT_WHEEL, CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL,
  CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL, currentConcealmentServantCombatSource,
  projectConcealmentServantCombat, projectConcealmentServantRoundOutcome,
} from '../../src/domain/concealment-servant/combat.js';
import { currentFearBishopCombatSource, projectFearBishopCombat, projectFearBishopRoundOutcome } from '../../src/domain/fear-bishop/combat.js';
import { currentNightwatcherCombatSource, projectNightwatcherCombat } from '../../src/domain/nightwatcher/combat.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SliceProjection, SlicePublicCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// Pending integration candidate. These tests read original captures; they never advance a run,
// rewrite schema/content labels, fabricate history, or validate a probe-injected state.
const ROOT = 'tests/fixtures';
interface Capture {
  name: string; file: string; entry: string | null; nested?: true; sha: string;
  revision: number; schema: number; sequence: number; status: 'ACTIVE' | 'DEAD';
  history: number; rounds: readonly [number, number, number, number]; combatRound: number | null;
}
const CAPTURES: readonly Capture[] = [
  { name: '679 living inheritance', file: 'misfortune-knight-v01910/boundary-three-honest-reports-reflected.json', entry: 'final',
    sha: '6e5889192d3a0c697640fc0bc1fadd680c7b8526088a11d8f920b602cf34b79f', revision: 680, schema: 188, sequence: 1, status: 'ACTIVE', history: 27, rounds: [0, 0, 6, 7], combatRound: null },
  { name: 'actual independent catch', file: 'misfortune-knight-v01910/boundary-pending-parcel-actual-independent-catch.json', entry: 'final',
    sha: '86f6fbdc6b07ed725024ccfd7c1443babaa912ea29d76b72a1774a5a911a5627', revision: 631, schema: 188, sequence: 1, status: 'ACTIVE', history: 27, rounds: [0, 0, 6, 7], combatRound: null },
  { name: 'MK round 1', file: 'misfortune-knight-v01910/boundary-combat-round-1.json', entry: 'final',
    sha: '1de449b3d23a7c8addd540e813810fe68d197d53d903ceeac0f94c68cb8bdc1d', revision: 687, schema: 188, sequence: 1, status: 'ACTIVE', history: 28, rounds: [1, 0, 6, 7], combatRound: 2 },
  { name: 'MK round 8', file: 'misfortune-knight-v01910/boundary-combat-round-8.json', entry: 'final',
    sha: '25106e851a4a5f727a90acf8c711c24309fce21877041de842ea7737d707c73f', revision: 694, schema: 188, sequence: 1, status: 'ACTIVE', history: 35, rounds: [8, 0, 6, 7], combatRound: 9 },
  { name: 'MK round 9 genuine death', file: 'misfortune-knight-v01910/boundary-combat-round-9.json', entry: 'final',
    sha: 'e0ffe8d29782fe92745e89364e999ea56249d642444da2b0f8e48f4e8e26475d', revision: 695, schema: 188, sequence: 1, status: 'DEAD', history: 36, rounds: [9, 0, 6, 7], combatRound: null },
  { name: 'CS start without first round', file: 'concealment-servant-v01690/snapshot-combatStart.json', entry: null,
    sha: '0a2828efda6c5506cdad43a6b6884bb263f348df1e800c5065577b36c171f5bd', revision: 521, schema: 166, sequence: 2, status: 'ACTIVE', history: 27, rounds: [0, 0, 6, 7], combatRound: 1 },
  { name: 'CS first round', file: 'concealment-servant-v01690/combat-first.json', entry: 'final',
    sha: '4e34f6afb6816758dd07c491b3b36102f3f4ec7e1b721dab736c93503aa4d598', revision: 522, schema: 166, sequence: 2, status: 'ACTIVE', history: 28, rounds: [0, 1, 6, 7], combatRound: 2 },
  { name: 'CS genuine terminal death', file: 'concealment-servant-v01690/combat-terminal.json', entry: 'final',
    sha: 'f9e4c53d66fe49b37adb78328d3ced7dbfe50a772d82e8388b1b40d1e1810ee5', revision: 529, schema: 166, sequence: 2, status: 'DEAD', history: 35, rounds: [0, 8, 6, 7], combatRound: null },
  { name: 'FB first round', file: 'fear-bishop-v01450/boundaries.json', entry: 'combat-first', nested: true,
    sha: 'd20daf6603dc75e9935df44376565ea4e1ab7ded3694f56b3a7aa80ce541737d', revision: 415, schema: 143, sequence: 3, status: 'ACTIVE', history: 22, rounds: [0, 0, 1, 7], combatRound: 2 },
  { name: 'FB genuine terminal', file: 'fear-bishop-v01450/boundaries.json', entry: 'combat-terminal', nested: true,
    sha: 'd20daf6603dc75e9935df44376565ea4e1ab7ded3694f56b3a7aa80ce541737d', revision: 420, schema: 143, sequence: 3, status: 'ACTIVE', history: 27, rounds: [0, 0, 6, 7], combatRound: null },
  { name: 'NW before last round', file: 'nightwatcher-v01220/natural.json', entry: 'beforeLast',
    sha: 'b4c1e0bb8854f5bd2b1a10cad4b1610ed461e5fbf7013dd3041e34448ef14276', revision: 291, schema: 120, sequence: 4, status: 'ACTIVE', history: 20, rounds: [0, 0, 0, 6], combatRound: 7 },
  { name: 'NW paid preparation', file: 'nightwatcher-v01220/shared-check-save-boundary.json', entry: 'final',
    sha: '9c6e19020c3792e1913e84489e5cbca009ff8b261893bc89cc15b6e0e1913eae', revision: 250, schema: 120, sequence: 5, status: 'ACTIVE', history: 14, rounds: [0, 0, 0, 0], combatRound: null },
];
const OUTCOMES = ['misfortuneKnightOutcome', 'concealmentServantOutcome', 'fearBishopOutcome', 'nightwatcherOutcome'] as const;
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = (file: string) => createHash('sha256').update(readFileSync(`${ROOT}/${file}`)).digest('hex');
const captureNamed = (name: string) => CAPTURES.find(c => c.name === name)!;
function readCapture(c: Capture): SliceState {
  const path = `${ROOT}/${c.file}`;
  if (c.entry === null) return JSON.parse(readFileSync(path, 'utf8')) as SliceState;
  return c.nested ? readObjectEntry<{ final: SliceState }>(path, c.entry).final : readObjectEntry<SliceState>(path, c.entry);
}
function validatedCapture(name: string): SliceState {
  const state = migrateSliceState(readCapture(captureNamed(name)));
  assertValidSliceState(state);
  return state;
}

// Independent test-side allowlists, not production projectors or exclusion spreads.
// A scalar slot cannot silently deep-clone a newly added object.
type Shape = true | { readonly [key: string]: Shape } | readonly [Shape];
const fields = (keys: string): { [key: string]: Shape } => Object.fromEntries(keys.split(' ').map(key => [key, true]));
function pick(value: unknown, shape: Shape): unknown {
  if (value === null || value === undefined) return value;
  if (shape === true) {
    expect(typeof value, 'allowlisted scalar must remain a scalar').not.toBe('object');
    return value;
  }
  if (Array.isArray(shape)) {
    expect(Array.isArray(value)).toBe(true);
    return (value as unknown[]).map(item => pick(item, shape[0]!));
  }
  expect(typeof value).toBe('object');
  const raw = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(shape).filter(([key]) => Object.hasOwn(raw, key)).map(([key, child]) => [key, pick(raw[key], child)]));
}
const COMPANION = fields('source status acquiredWeek invitedWeek releases deployments recalls');
const INJURY = fields('id severity acquiredRevision treatedRevision');
const CHECK: Shape = { ...fields('ability baseAbility effectiveAbility difficulty chance roll tier'), modifiers: [fields('source value')] };
const WHEEL = fields('id label weight');
const MK_WINDOW = fields('id kind createdAt expiresAt targetActionId magnitude plateId');
const MK_WINDOWS: Shape = { nightGuard: MK_WINDOW, guidedMishap: MK_WINDOW, attention: MK_WINDOW };
const MK_PENDING = fields('id planned actual declaredAt observedAt observationSeconds visibleIntent bodyImpact');
const MK_MATERIALS: Shape = {
  weapon: fields('id sourceId owner massKg location condition charge capacity visible'),
  plate: fields('id sourceId owner paidPennies purchasedWeek location integrity initialIntegrity wearPerAttempt'),
};
const MK_ROOT: Shape = { ...fields('siteId playerLocation playerCoordinate enemyCoordinate ordinaryExit visibleBodyLine floorLineClear thirdPartiesInArea observedSourceId observationWeek clockSeconds externalSeconds playerTravelMetres knownPlayerName knownEnemyName'), presentMemberIds: [true] };
const MK_POWERS = fields('DARK_BOLT MIND_PRESSURE WARD ATTENTION BLOCK_LINE');
// Intentionally independent of the production exported list, and does not mint absent keys.
const MK_MASTERY = fields('darkness.s9.night-vision darkness.s9.night-vigor darkness.s9.danger-sense darkness.s8.poetry darkness.s8.physical-training darkness.s7.dream-entry darkness.s7.dream-discernment darkness.s6.spirit-sight darkness.s6.spirit-pacification darkness.s5.spirit-shelter darkness.s5.spirit-assistance darkness.s5.spirit-coordination darkness.s4.limited-misfortune darkness.s4.area-dream darkness.s3.dark-dissolution darkness.s3.sleep-fear darkness.s2.bounded-concealment darkness.s2.trace-veil darkness.s1.guided-mishap darkness.s1.bounded-night-guard');
const MK_ACTION: Shape = {
  ...fields('order actor id planned selectedAbility fallbackReason label selfGain enemyReduction threatens mentalPressure attackKind rawContribution rawReduction paidCost mindCost physicalFactor resistanceRoll resistanceChance succeeded finiteResult spiritOperation plateWear plateId rodChargeSpent atSeconds elapsedSeconds travelMetres playerMindAfter playerSpiritualityAfter enemyMindAfter enemySpiritualityAfter'),
  check: CHECK, windowsBefore: MK_WINDOWS, windowsAfter: MK_WINDOWS, pendingBefore: MK_PENDING, pendingAfter: MK_PENDING,
  masteryApplied: [true], countered: [true], companionBefore: COMPANION, companionAfter: COMPANION,
  materialsBefore: MK_MATERIALS, materialsAfter: MK_MATERIALS, travelPath: [true],
};
const MK_OUTCOME: Shape = {
  ...fields('enemyHealth enemyMind enemySpirituality enemyStatus enemyRisk weaponLocation spiritDeployments spiritAssists spiritRecalls totalOwnerMindSpent guidedMishapAttempts guidedMishapSuccesses nightGuardAttempts nightGuardSuccesses targetId round stance continuing playerHealthAfter playerMindAfter playerSpiritualityAfter playerRiskAfter elapsedSeconds pendingEnemyActionAfter'),
  enemyInjuries: [INJURY], powerUses: MK_POWERS, playerInjuriesAfter: [INJURY], materialsAfter: MK_MATERIALS,
  companion: COMPANION, masteryAfter: MK_MASTERY, rootAfter: MK_ROOT, playerActions: [MK_ACTION], enemyActions: [MK_ACTION],
  expiredWindows: [MK_WINDOW], windowsAfter: MK_WINDOWS,
  spiritRecall: { ...fields('sourceId atSeconds elapsedSeconds'), before: COMPANION, after: COMPANION },
};
const CS_WINDOW = fields('openedOrder expiresAt');
const CS_WINDOWS: Shape = { concealment: CS_WINDOW, veil: CS_WINDOW, anchorReady: true, anchorUsed: true };
const CS_POWERS = fields('DARK_BOLT WARD ANCHOR_LIGHT');
const CS_USES: Shape = { BOUNDED_CONCEALMENT: fields('attempts successes effects'), TRACE_VEIL: fields('attempts successes effects') };
const CS_ACTION_COMMON = {
  ...fields('label selfGain enemyReduction threatens mentalPressure order atSeconds paidCost physicalFactor playerSpiritualityAfter enemySpiritualityAfter'),
  rolls: [true] as const, windowsBefore: CS_WINDOWS, windowsAfter: CS_WINDOWS,
};
const CS_PLAYER: Shape = { ...CS_ACTION_COMMON, ...fields('id spiritOperation resisted attempted succeeded') };
const CS_ENEMY: Shape = { ...CS_ACTION_COMMON, ...fields('planned actual anchorGranted'), interrupted: [true], applied: [true] };
const CS_OUTCOME: Shape = {
  ...fields('targetId round stance continuing enemyHealth enemyMind enemySpirituality enemyStatus playerSpiritualityBefore playerSpiritualityAfter playerHealthAfter playerMindAfter enemySpiritualityBefore playerRiskAfter enemyRiskAfter recalled elapsedSeconds playerLocationAfter playerTravelMetresAfter clockSecondsAfter'),
  playerInjuriesAfter: [INJURY], enemyInjuriesAfter: [INJURY], powerUses: CS_POWERS, abilityUses: CS_USES,
  companionAfter: COMPANION, windowsBeforeClose: CS_WINDOWS, windowsAfter: CS_WINDOWS,
  playerActions: [CS_PLAYER], enemyActions: [CS_ENEMY],
};
const FB_POWERS = fields('DARK_BOLT WARD FOCUS');
const FB_ACTION_COMMON = { ...fields('label selfGain enemyReduction threatens mentalPressure order paidCost physicalFactor'), rolls: [true] as const };
const FB_OUTCOME: Shape = {
  ...fields('targetId round stance continuing enemyHealth enemyMind enemySpirituality enemyStatus playerSpiritualityBefore playerSpiritualityAfter playerHealthAfter playerMindAfter enemySpiritualityBefore recalled focusReadyAfter elapsedSeconds'),
  powerUses: FB_POWERS, companionAfter: COMPANION,
  playerActions: [{ ...FB_ACTION_COMMON, ...fields('id spiritOperation resisted') }],
  enemyActions: [{ ...FB_ACTION_COMMON, ...fields('planned actual focusGranted') }],
};
const ORIGINALS: Shape = {
  ...fields('playerLocation playerTravelMetres clockSeconds'),
  erin: fields('id name age alive health mind location travelMetres'),
  room: fields('id lengthMetres doorId doorBlocked concealed remainingSeconds'),
  box: fields('id owner location travelMetres'), page: fields('id owner location text'),
  trace: fields('id source alive conscious exists searches delayedSearches totalDelaySeconds'),
  anchorLight: fields('id owner location on'),
};
const BUDGET = fields('health mind spirituality cash actions');
const RECEIPT: Shape = {
  ...fields('week revision checkBase outcome elapsedSeconds playerWalkedMetres boxMovedMetres plateWear releasedForce absorbedForce'),
  date: fields('epoch year month day'), check: CHECK, before: BUDGET, after: BUDGET,
  originalsBefore: ORIGINALS, originalsAfter: ORIGINALS, companion: COMPANION,
};
function expectedReceipt(entry: MisfortuneKnightLifeReceipt) {
  const type = entry.command.type;
  const commandKeys = type === 'INVITE' ? 'type caseId method' : type === 'OBSERVE' || type === 'REPORT' ? 'type caseId'
    : ['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(type) ? 'type permission' : type === 'WALK_TO' ? 'type metres' : 'type';
  return { ...(pick(entry, RECEIPT) as object), command: pick(entry.command, fields(commandKeys)) };
}
function expectedRound(round: SliceCombatRound | null, name: string): unknown {
  if (!round) return null;
  const expected = structuredClone(round) as unknown as Record<string, unknown>;
  if (round.misfortuneKnightOutcome) expected.misfortuneKnightOutcome = pick(round.misfortuneKnightOutcome, MK_OUTCOME);
  if (round.concealmentServantOutcome) expected.concealmentServantOutcome = pick(round.concealmentServantOutcome, CS_OUTCOME);
  if (round.fearBishopOutcome) expected.fearBishopOutcome = pick(round.fearBishopOutcome, FB_OUTCOME);
  return projectPlayerText(expected, name);
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || found.has(value)) return found;
  found.add(value);
  Object.values(value).forEach(child => objects(child, found));
  return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const originals = objects(input);
  for (const object of objects(output)) expect(originals.has(object), 'public facts must not alias private objects').toBe(false);
}
function assertNoPrivate(value: unknown, path: string): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, i) => assertNoPrivate(child, `${path}[${i}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter', 'privateProbe'].includes(key), `${path}.${key}`).toBe(false);
    if (key === 'source') expect(typeof child, `${path}.${key} is public provenance, never a private source object`).toBe('string');
    assertNoPrivate(child, `${path}.${key}`);
  }
}
function injectProbe(value: unknown, path = '', paths: string[] = []): string[] {
  if (!value || typeof value !== 'object') return paths;
  if (Array.isArray(value)) { value.forEach((child, i) => injectProbe(child, `${path}[${i}]`, paths)); return paths; }
  for (const [key, child] of Object.entries(value)) injectProbe(child, `${path}.${key}`, paths);
  Object.assign(value, { privateProbe: { randomSeed: 'never-public', randomCursor: 31415 } });
  paths.push(path);
  return paths;
}
function assertRoundEntrances(view: SliceProjection, state: SliceState): void {
  expect(view.combatHistory).toHaveLength(state.combatHistory.length);
  expect(view.lastCombatRound).toEqual(expectedRound(state.lastCombatRound, state.character.name));
  for (const [i, round] of state.combatHistory.entries()) {
    expect(view.combatHistory[i], `combatHistory[${i}] preserves every allowed resolved fact`).toEqual(expectedRound(round, state.character.name));
    for (const key of OUTCOMES) if (round[key]) assertNoPrivate(view.combatHistory[i]![key], `combatHistory[${i}].${key}`);
  }
  for (const key of OUTCOMES) if (state.lastCombatRound?.[key]) assertNoPrivate(view.lastCombatRound?.[key], `lastCombatRound.${key}`);
  if (state.combat) {
    expect(view.combat).not.toBeNull();
    expect(view.combat!.lastRound).toEqual(expectedRound(state.combat.lastRound, state.character.name));
    for (const key of OUTCOMES) if (state.combat.lastRound?.[key]) assertNoPrivate(view.combat!.lastRound?.[key], `combat.lastRound.${key}`);
    if (state.combat.lastRound) expect(view.combat!.lastRound).toEqual(view.lastCombatRound);
  } else expect(view.combat).toBeNull();
}
function expectedAttempts(state: SliceState, id: string) {
  const result: { invitedWeek: number; method: 'ABILITY' | 'ORDINARY'; outcome: MisfortuneKnightLifeReceipt['outcome']; operationOutcome: MisfortuneKnightLifeReceipt['outcome']; receipts: ReturnType<typeof expectedReceipt>[] }[] = [];
  let active: typeof result[number] | null = null;
  for (const entry of state.misfortuneKnight.life.journal) {
    if (entry.command.type === 'INVITE' && entry.command.caseId === id) {
      active = { invitedWeek: entry.week, method: entry.command.method, outcome: null, operationOutcome: null, receipts: [] };
      result.push(active);
    }
    if (!active) continue;
    active.receipts.push(expectedReceipt(entry));
    if (entry.command.type === 'GUIDED_MISHAP' || entry.command.type === 'BOUNDED_NIGHT_GUARD') active.outcome = entry.outcome;
    if (entry.command.type === 'CATCH_PARCEL') active.operationOutcome = entry.outcome;
    if (entry.command.type === 'RETURN_HOME' || entry.command.type === 'ABORT') active = null;
  }
  return result;
}
function assertLifeEntrances(view: SliceProjection, state: SliceState): void {
  const life = view.misfortuneKnight.life, journal = state.misfortuneKnight.life.journal, name = state.character.name;
  expect(life.ledger).toEqual(projectPlayerText(journal.map(expectedReceipt), name));
  for (const c of life.cases) {
    expect(c.attempts).toEqual(projectPlayerText(expectedAttempts(state, c.id), name));
    for (const attempt of c.attempts) for (const receipt of attempt.receipts) assertNoPrivate(receipt, `life.cases.${c.id}.attempt.receipt`);
  }
  for (const receipt of life.ledger) assertNoPrivate(receipt, 'life.ledger');
  expect(life.practice).toEqual(projectPlayerText(state.misfortuneKnight.life.practice, name));
  expect(life.originals).toEqual(projectPlayerText(pick(state.concealmentServant.life, ORIGINALS) as object, name));
  assertDetached(life.ledger, journal);
}

function expectedMKPanel(state: SliceState) {
  const e = state.misfortuneKnight.encounter, last = state.combat!.lastRound?.misfortuneKnightOutcome;
  return {
    enemyName: '奥尔登·沃德（46岁）', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, weaponLocation: e.weaponLocation, powerUses: pick(e.powerUses, MK_POWERS), policy: e.policy,
    materials: pick(e.materials, MK_MATERIALS), companion: pick(state.spiritWarlock.companion, COMPANION),
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order).map(a => pick(a, MK_ACTION)) : [],
    constants: pick(MISFORTUNE_KNIGHT_COMBAT_CONSTANTS, {
      ...fields('tier floor maxSpirituality continuingRecovery enemyPhysique guidedMishapCost guidedMishapMindCost guidedMishapReduction nightGuardCost nightGuardMindCost nightGuardReduction windowSeconds'),
      weights: fields('physique perception will knowledge'),
    }),
    countWheel: pick(MISFORTUNE_KNIGHT_COUNT_WHEEL, [WHEEL]), enemyCountWheel: pick(MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL, [WHEEL]),
    abilityWheel: pick(misfortuneKnightAbilityWheel(state, null), [WHEEL]), enemyAbilityWheel: pick(MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL, [WHEEL]),
    facts: ['体35%、感25%、意25%、知15%；双方1至6动作10/15/25/25/15/10，基础1250、底125、上限120，仅继续轮恢复12。',
      '两项新能力只影响同一项已观察、尚未执行的身体冲击；精神压力单独结算。',
      '每轮各一次，失败照付；空窗口不涨掌握，原木板磨损不恢复。',
      '原卷叶先付2灵性派出，后槽另付2灵性协助；当轮召回同一原牙齿，计数照实增加。',
      '身体攻击走共同伤势盘；精神耗尽活着停战，身体死亡终结本周目。'],
  };
}
function expectedCSPanel(state: SliceState) {
  const e = state.concealmentServant.encounter, last = state.combat!.lastRound?.concealmentServantOutcome;
  return {
    enemyName: '奥斯温（47岁，原创有限G2非凡者）', targetId: e.targetId,
    playerHealth: state.health, playerMind: state.mind, playerSpirituality: state.spirituality, maxSpirituality: 120,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    powerUses: pick(e.powerUses, CS_POWERS), abilityUses: pick(e.abilityUses, CS_USES), companion: pick(state.spiritWarlock.companion, COMPANION),
    room: pick(e.room, fields('id widthMetres doorId doorStatus traceId tracePresent')),
    playerLocation: e.playerLocation, playerTravelMetres: e.playerTravelMetres, clockSeconds: e.clockSeconds,
    windows: { concealment: null, veil: null, anchorReady: false, anchorUsed: false }, concealmentRemainingSeconds: 0, veilRemainingSeconds: 0,
    windowStatus: '回合结算边界：本轮有限窗口均已实际收束；下一轮须重新付费。',
    lastWindowSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order).map(a => pick(a, {
      ...fields('order atSeconds label'), windowsBefore: CS_WINDOWS, windowsAfter: CS_WINDOWS,
    })) : [],
    originalExit: e.room.doorStatus === 'OPEN', pursuit: false, distanceMetres: 2,
    countWheel: pick(CONCEALMENT_SERVANT_COUNT_WHEEL, [WHEEL]), enemyCountWheel: pick(CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL, [WHEEL]),
    enemyAbilityWheel: pick(CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL, [WHEEL]),
    summary: 'G：黑暗原核心35/25/25/15、1250/底125，S120，仅继续轮恢复12。每实际槽5秒，≤60秒收束；隐秘/遮踪成功开窗不等于应用，后续暗矢实际减35/20才计效果。敌4S锚每轮一次只中断当前或下一窗口；原身体仍在已知可达门口，普通棍击、实际伤勢和50%普通撤离不豁免。原卷叶须真实已取得，2S派出/后槽2S协助/轮末召回。所有限额、费用与场景为原创G。',
  };
}
function expectedFBPanel(state: SliceState) {
  const e = state.fearBishop.encounter;
  return {
    enemyName: '哈兰（48岁，原创有限G3非凡者）', targetId: e.targetId, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    powerUses: pick(e.powerUses, FB_POWERS), companion: pick(state.spiritWarlock.companion, COMPANION),
    originalExit: true, pursuit: false, distanceMetres: 2,
    summary: '双方1–6次权重10/15/25/25/15/10；继承实际黑暗4核心35/25/25/15、1250/底125、S120，仅继续轮恢复12G。有限黑暗毁灭6S/知识18形成65×新掌握优势，睡恐5S/意志18减32可被敌专注抵抗。原厄运4S减22，同一旧卷叶先2S派出0贡献，后槽2S协助减22，轮末实际召回。共同伤势盘决定原身体后果，旧人旧物及释放史保留。',
  };
}
function expectedNWPanel(state: SliceState) {
  return {
    enemyName: '原45岁布拉姆·洛', companion: pick(state.spiritWarlock.companion, COMPANION),
    summary: '4阶核心1250/底线125，灵性上限120、继续回合恢复12（G）。有限厄运与梦境均可失败且仅本槽有效；同一个旧卷叶须实际取得、当轮R派出才可B付费协助，每轮实际召回。无资源仅普通观察或身体避让，付费检验失败0贡献。没有运气库、永久昏睡、免费灵、灵界旅行或复活。',
  };
}
function assertActivePanel(view: SliceProjection, state: SliceState): void {
  if (!state.combat) return;
  let key: 'misfortuneKnight' | 'concealmentServant' | 'fearBishop' | 'nightwatcher', actual: unknown, expected: unknown;
  switch (state.combat.encounterId) {
    case 'MISFORTUNE_KNIGHT_DISPUTE':
      key = 'misfortuneKnight'; actual = projectMisfortuneKnightCombat(state); expected = expectedMKPanel(state);
      expect(state.combat.lastRound!.misfortuneKnightOutcome!.source.randomSeed).toBe(state.random.seed);
      expect(state.combat.lastRound!.misfortuneKnightOutcome!.source.preparation.randomSeed).toBe(state.random.seed);
      break;
    case 'CONCEALMENT_SERVANT_DISPUTE': {
      key = 'concealmentServant'; actual = projectConcealmentServantCombat(state); expected = expectedCSPanel(state);
      const privateSource = currentConcealmentServantCombatSource(state);
      expect(privateSource).not.toBeNull();
      expect(privateSource!.randomSeed).toBe(state.random.seed);
      expect(privateSource!.randomCursor).toBe(state.random.cursor);
      break;
    }
    case 'FEAR_BISHOP_DISPUTE': {
      key = 'fearBishop'; actual = projectFearBishopCombat(state); expected = expectedFBPanel(state);
      const privateSource = currentFearBishopCombatSource(state);
      expect(privateSource).not.toBeNull();
      expect(privateSource).not.toHaveProperty('randomSeed');
      expect(privateSource).not.toHaveProperty('randomCursor');
      break;
    }
    case 'NIGHTWATCHER_DISPUTE': {
      key = 'nightwatcher'; actual = projectNightwatcherCombat(state); expected = expectedNWPanel(state);
      const privateSource = currentNightwatcherCombatSource(state);
      expect(privateSource).not.toBeNull();
      expect(privateSource).not.toHaveProperty('randomSeed');
      expect(privateSource).not.toHaveProperty('randomCursor');
      break;
    }
    default: throw new Error(`Unexpected fixture encounter: ${state.combat.encounterId}`);
  }
  expect(actual, `narrow ${key} panel exact whitelist and facts`).toEqual(expected);
  expect(view.combat![key], `central combat.${key} wiring`).toEqual(projectPlayerText(expected as object, state.character.name));
  assertNoPrivate(actual, `panel.${key}`); assertDetached(actual, state);
}

describe('Darkness public boundary from untouched, formally migrated original captures', () => {
  it('narrows all three public round types, four panels and both life receipt types', () => {
    type MK = NonNullable<SlicePublicCombatRound['misfortuneKnightOutcome']>;
    type CS = NonNullable<SlicePublicCombatRound['concealmentServantOutcome']>;
    type FB = NonNullable<SlicePublicCombatRound['fearBishopOutcome']>;
    type Combat = NonNullable<SliceProjection['combat']>;
    type Life = SliceProjection['misfortuneKnight']['life'];
    expectTypeOf<MK>().not.toHaveProperty('source');
    expectTypeOf<MK>().not.toHaveProperty('randomCursorAfter');
    expectTypeOf<MK['playerActions'][number]>().not.toHaveProperty('randomCursorBefore');
    expectTypeOf<MK['enemyActions'][number]>().not.toHaveProperty('randomCursorAfter');
    expectTypeOf<CS>().not.toHaveProperty('source');
    expectTypeOf<CS>().not.toHaveProperty('randomCursorAfter');
    expectTypeOf<CS['playerActions'][number]>().not.toHaveProperty('randomCursorAfter');
    expectTypeOf<CS['enemyActions'][number]>().not.toHaveProperty('randomCursorBefore');
    expectTypeOf<FB>().not.toHaveProperty('source');
    expectTypeOf<NonNullable<SliceProjection['lastCombatRound']>>().toEqualTypeOf<SlicePublicCombatRound>();
    expectTypeOf<SliceProjection['combatHistory'][number]>().toEqualTypeOf<SlicePublicCombatRound>();
    expectTypeOf<NonNullable<Combat['lastRound']>>().toEqualTypeOf<SlicePublicCombatRound>();
    expectTypeOf<NonNullable<Combat['nightwatcher']>>().not.toHaveProperty('source');
    expectTypeOf<NonNullable<Combat['fearBishop']>>().not.toHaveProperty('source');
    expectTypeOf<NonNullable<Combat['concealmentServant']>>().not.toHaveProperty('source');
    expectTypeOf<NonNullable<Combat['misfortuneKnight']>['lastActionSequence'][number]>().not.toHaveProperty('randomCursorBefore');
    expectTypeOf<NonNullable<Combat['misfortuneKnight']>['lastActionSequence'][number]>().not.toHaveProperty('randomCursorAfter');
    expectTypeOf<Life['ledger'][number]>().not.toHaveProperty('randomCursor');
    expectTypeOf<Life['ledger'][number]>().not.toHaveProperty('randomBefore');
    expectTypeOf<Life['ledger'][number]>().not.toHaveProperty('randomAfter');
    expectTypeOf<Life['cases'][number]['attempts'][number]['receipts'][number]>().toEqualTypeOf<Life['ledger'][number]>();
  });

  it.each(CAPTURES)('preserves $name at every existing entrance without manufacturing another branch', capture => {
    const original = readCapture(capture), originalHash = digest(original), originalRandom = structuredClone(original.random);
    expect(fileDigest(capture.file)).toBe(capture.sha);
    expect(original.schemaVersion).toBe(capture.schema);
    expect(original.revision).toBe(capture.revision);
    expect(original.status).toBe(capture.status);
    expect(original.progression.sequence).toBe(capture.sequence);
    expect(original.combatHistory).toHaveLength(capture.history);
    expect(OUTCOMES.map(key => original.combatHistory.filter(round => round[key]).length)).toEqual(capture.rounds);
    expect(original.combat?.round ?? null).toBe(capture.combatRound);

    // Only the official migration and full validator establish trust in historical snapshots.
    const state = migrateSliceState(original);
    assertValidSliceState(state);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(state.combatHistory).toEqual(original.combatHistory);
    expect(state.lastCombatRound).toEqual(original.lastCombatRound);
    expect(state.combat).toEqual(original.combat);
    expect(state.status).toBe(capture.status);
    expect(state.revision).toBe(capture.revision);
    const before = digest(state), random = structuredClone(state.random);
    const privateSources = state.combatHistory.map(round => OUTCOMES.slice(0, 3).map(key => round[key] ?? null));
    const sourceHash = digest(privateSources), ledgerHash = digest(state.misfortuneKnight.life.journal);
    const view = projectSliceState(state);
    assertRoundEntrances(view, state);
    assertActivePanel(view, state);
    assertLifeEntrances(view, state);
    expect(state.random).toEqual(random);
    expect(digest(privateSources)).toBe(sourceHash);
    expect(digest(state.misfortuneKnight.life.journal)).toBe(ledgerHash);
    expect(digest(state)).toBe(before);
    expect(original.random).toEqual(originalRandom);
    expect(digest(original)).toBe(originalHash);
    expect(fileDigest(capture.file)).toBe(capture.sha);
  }, 120_000);

  it('keeps the complete true 679 inheritance: 27 history, six FB, seven NW, 54 receipts and no fabricated CS/MK combat', () => {
    const state = validatedCapture('679 living inheritance'), before = digest(state), random = structuredClone(state.random);
    const current = migrateSliceState(state);
    assertValidSliceState(current);
    expect(current).toEqual(state);
    const view = projectSliceState(current);
    expect(state).toMatchObject({ revision: 680, week: 158, status: 'ACTIVE', combat: null });
    expect(view.combatHistory).toHaveLength(27);
    expect(view.combatHistory.filter(r => r.fearBishopOutcome)).toHaveLength(6);
    expect(view.combatHistory.filter(r => r.nightwatcherOutcome)).toHaveLength(7);
    expect(view.combatHistory.some(r => r.concealmentServantOutcome || r.misfortuneKnightOutcome)).toBe(false);
    expect(state.concealmentServant.encounter.status).toBe('AVAILABLE');
    expect(state.misfortuneKnight.encounter.status).toBe('AVAILABLE');
    assertRoundEntrances(view, state); assertLifeEntrances(view, state);
    expect(view.misfortuneKnight.life.ledger).toHaveLength(54);
    expect(view.misfortuneKnight.life.cases.flatMap(c => c.attempts).flatMap(a => a.receipts).length).toBeGreaterThan(0);
    const checked = view.misfortuneKnight.life.ledger.filter(receipt => receipt.check !== null);
    expect(checked.map(receipt => receipt.check!.roll)).toEqual([70, 51, 32, 13]);
    const catchReceipt = checked.find(receipt => receipt.command.type === 'CATCH_PARCEL')!;
    expect(catchReceipt.check).toEqual({ ability: 'perception', baseAbility: 29,
      modifiers: [{ source: '这一次尚未发生的原盒接取', value: 10 }], effectiveAbility: 39, difficulty: 18, chance: 92, roll: 51, tier: 'SUCCESS' });
    expect(catchReceipt.checkBase).toBe(29);
    expect(catchReceipt.companion.source).toBe('SW5-LEAF-1');
    expect(catchReceipt.originalsAfter.trace.source.length).toBeGreaterThan(0);
    expect(view.misfortuneKnight.life.source.length).toBeGreaterThan(0);
    expect(view.misfortuneKnight.life.practice.tray.source.length).toBeGreaterThan(0);
    expect(view.misfortuneKnight.life.practice.plate.source.length).toBeGreaterThan(0);
    expect(view.misfortuneKnight.life.practice.rig.source.length).toBeGreaterThan(0);
    expect(view.misfortuneKnight.life.ledger.some(receipt => receipt.before.cash - receipt.after.cash === 20)).toBe(true);
    expect(view.misfortuneKnight.life.ledger.some(receipt => receipt.plateWear === 10)).toBe(true);
    expect(view.misfortuneKnight.life.ledger.some(receipt => receipt.playerWalkedMetres > 0)).toBe(true);
    for (let i = 14; i < 21; i++) expect(view.combatHistory[i]!.nightwatcherOutcome).toEqual(state.combatHistory[i]!.nightwatcherOutcome);
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before); expect(digest(current)).toBe(before);
  }, 120_000);

  it('preserves the actual catch receipt at its own boundary, including legitimate modifier provenance and the consumed roll', () => {
    const state = validatedCapture('actual independent catch'), before = digest(state);
    const entry = state.misfortuneKnight.life.journal.find(receipt => receipt.command.type === 'CATCH_PARCEL')!;
    expect(entry.check).toMatchObject({ chance: 92, roll: 51, modifiers: [{ source: '这一次尚未发生的原盒接取', value: 10 }] });
    const actual = projectMisfortuneKnightLifeReceipt(entry);
    expect(actual).toEqual(expectedReceipt(entry));
    expect(actual.check).toEqual(entry.check);
    expect(actual.before).toEqual(entry.before); expect(actual.after).toEqual(entry.after);
    assertDetached(actual, entry); assertNoPrivate(actual, 'actualCatch');
    const view = projectSliceState(state);
    assertLifeEntrances(view, state);
    expect(view.misfortuneKnight.life.ledger.find(receipt => receipt.revision === entry.revision)).toEqual(projectPlayerText(expectedReceipt(entry), state.character.name));
    expect(digest(state)).toBe(before);
  }, 120_000);

  it('preserves genuine NW preparation, price, original kit provenance and the open paid window', () => {
    const state = validatedCapture('NW paid preparation'), before = digest(state), random = structuredClone(state.random);
    const raw = state.nightwatcher.ritual, visit = raw.visits.find(v => v.id === raw.activeVisitId)!;
    expect(visit).toMatchObject({ paidPennies: 240, status: 'OPEN', preparedWeek: 68, checkedWeek: 68, windowWeek: 68 });
    const view = projectSliceState(state), ritual = view.nightwatcher.ritual, publicVisit = ritual.visits.find(v => v.id === visit.id)!;
    expect(ritual.windowOpen).toBe(true); expect(ritual.currentVisitId).toBe(visit.id);
    expect(publicVisit).toMatchObject({ paidPennies: 240, preparedWeek: 68, checkedWeek: 68, windowWeek: 68,
      kit: { id: visit.kit.id, consumedWeek: null, sealsIntact: true, location: 'NW4-HALL原桌', status: '原封装未用，封条完好' } });
    expect(publicVisit.source).toBe(projectPlayerText({ source: visit.source }, state.character.name).source);
    expect(publicVisit.kit.source).toBe(projectPlayerText({ source: visit.kit.source }, state.character.name).source);
    expect(ritual.expert!.source).toBe(projectPlayerText({ source: raw.expert.source }, state.character.name).source);
    expect(ritual.appointment).toContain('240便士');
    expect(publicVisit.summary).toContain('240便士');
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before);
  }, 120_000);

  function exerciseNarrow<T>(raw: T, expected: unknown, project: (value: T) => unknown, label: string): string[] {
    const before = digest(raw), actual = project(raw);
    expect(actual, `${label}: independently enumerated allowed fields`).toEqual(expected);
    assertNoPrivate(actual, label); assertDetached(actual, raw);
    const clone = structuredClone(raw), paths = injectProbe(clone), injectedHash = digest(clone);
    // This intentionally invalid copy is only a mapper input. Never validate, save, replay,
    // append it to history, or pass it to the complete central state projector.
    const injected = project(clone);
    expect(injected, `${label}: future fields stay private at every existing nested object`).toEqual(expected);
    assertNoPrivate(injected, label); assertDetached(injected, clone);
    expect(digest(clone)).toBe(injectedHash); expect(digest(raw)).toBe(before);
    return paths;
  }

  it('allowlists all nine genuine MK outcomes and actions, including actual checks, pending facts, windows, materials and recalls', () => {
    const state = validatedCapture('MK round 9 genuine death'), before = digest(state), random = structuredClone(state.random);
    const outcomes = state.combatHistory.flatMap(round => round.misfortuneKnightOutcome ? [round.misfortuneKnightOutcome] : []);
    expect(outcomes).toHaveLength(9);
    const paths: string[] = [];
    for (const outcome of outcomes) {
      expect(outcome.source.randomSeed).toBe(state.random.seed);
      expect(outcome.source.preparation.randomSeed).toBe(state.random.seed);
      const sourceHash = digest(outcome.source);
      paths.push(...exerciseNarrow(outcome, pick(outcome, MK_OUTCOME), projectMisfortuneKnightRoundOutcome, `MK round ${outcome.round}`));
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) {
        paths.push(...exerciseNarrow(action, pick(action, MK_ACTION), projectMisfortuneKnightAction, `MK action ${action.order}`));
        const actual = projectMisfortuneKnightAction(action);
        expect(actual.check).toEqual(action.check);
        expect(actual.resistanceRoll).toBe(action.resistanceRoll); expect(actual.resistanceChance).toBe(action.resistanceChance);
        expect(actual).toMatchObject({ paidCost: action.paidCost, mindCost: action.mindCost, plateWear: action.plateWear,
          rodChargeSpent: action.rodChargeSpent, atSeconds: action.atSeconds, elapsedSeconds: action.elapsedSeconds, travelMetres: action.travelMetres });
        expect(actual.materialsAfter.weapon.sourceId).toBe('MK1-ALDEN-OWNED-ROD-1');
        expect(actual.materialsAfter.plate!.sourceId).toBe('MK1-BATTLE-WOOD-SHOP-1');
        expect(actual.materialsAfter.plate!.paidPennies).toBe(40);
      }
      expect(digest(outcome.source)).toBe(sourceHash);
    }
    // Assert the real captures exercised these branches; never synthesize a missing window/check.
    for (const pattern of [/\.check$/, /\.pendingBefore$/, /\.windowsAfter\.attention$/, /\.expiredWindows\[\d+\]$/,
      /\.materialsAfter\.plate$/, /\.companionBefore$/, /\.rootAfter$/, /\.masteryAfter$/, /\.spiritRecall\.before$/, /\.playerInjuriesAfter\[\d+\]$/]) {
      expect(paths.some(path => pattern.test(path)), `real MK branch ${pattern}`).toBe(true);
    }
    expect(outcomes.some(o => o.rootAfter.observedSourceId !== null)).toBe(true);
    expect(outcomes.flatMap(o => o.playerActions).some(a => a.check !== null && a.paidCost > 0)).toBe(true);
    expect(state.status).toBe('DEAD'); expect(state.combat).toBeNull();
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before);
  }, 120_000);

  it('allowlists genuine CS and FB actions and retains all consumed rolls and paid costs after nested probe injection', () => {
    const cs = validatedCapture('CS genuine terminal death'), fb = validatedCapture('FB genuine terminal');
    const beforeCS = digest(cs), beforeFB = digest(fb), csPaths: string[] = [];
    const csOutcomes = cs.combatHistory.flatMap(round => round.concealmentServantOutcome ? [round.concealmentServantOutcome] : []);
    const fbOutcomes = fb.combatHistory.flatMap(round => round.fearBishopOutcome ? [round.fearBishopOutcome] : []);
    expect(csOutcomes).toHaveLength(8); expect(fbOutcomes).toHaveLength(6);
    let csRolls = 0, fbRolls = 0, csCost = 0, fbCost = 0;
    for (const outcome of csOutcomes) {
      expect(outcome.source.randomSeed).toBe(cs.random.seed);
      csPaths.push(...exerciseNarrow(outcome, pick(outcome, CS_OUTCOME), projectConcealmentServantRoundOutcome, `CS round ${outcome.round}`));
      const actual = projectConcealmentServantRoundOutcome(outcome);
      for (const side of ['playerActions', 'enemyActions'] as const) for (const [i, action] of outcome[side].entries()) {
        expect(actual[side][i]!.rolls).toEqual(action.rolls);
        expect(actual[side][i]!.paidCost).toBe(action.paidCost);
        csRolls += action.rolls.length; csCost += action.paidCost;
      }
      expect(actual.companionAfter.source).toBe('SW5-LEAF-1');
    }
    for (const outcome of fbOutcomes) {
      expect(outcome.source).not.toHaveProperty('randomSeed'); expect(outcome.source).not.toHaveProperty('randomCursor');
      exerciseNarrow(outcome, pick(outcome, FB_OUTCOME), projectFearBishopRoundOutcome, `FB round ${outcome.round}`);
      const actual = projectFearBishopRoundOutcome(outcome);
      for (const side of ['playerActions', 'enemyActions'] as const) for (const [i, action] of outcome[side].entries()) {
        expect(actual[side][i]!.rolls).toEqual(action.rolls);
        expect(actual[side][i]!.paidCost).toBe(action.paidCost);
        fbRolls += action.rolls.length; fbCost += action.paidCost;
      }
      expect(actual.companionAfter.source).toBe('SW5-LEAF-1');
    }
    expect(csPaths.some(path => /\.windowsAfter\.(concealment|veil)$/.test(path))).toBe(true);
    expect(csPaths.some(path => /\.abilityUses\.BOUNDED_CONCEALMENT$/.test(path))).toBe(true);
    expect(csRolls).toBe(16); expect(csCost).toBe(201);
    expect(fbRolls).toBe(11); expect(fbCost).toBe(137);
    expect(digest(cs)).toBe(beforeCS); expect(digest(fb)).toBe(beforeFB);
  }, 120_000);

  it('rejects unknown nested receipt fields with the genuine check modifier, budgets, dates, commands and original objects intact', () => {
    const state = validatedCapture('679 living inheritance'), before = digest(state), paths: string[] = [];
    for (const entry of state.misfortuneKnight.life.journal) {
      paths.push(...exerciseNarrow(entry, expectedReceipt(entry), projectMisfortuneKnightLifeReceipt, `receipt ${entry.revision}`));
    }
    for (const pattern of [/\.check\.modifiers\[0\]$/, /\.command$/, /\.date$/, /\.before$/, /\.after$/,
      /\.originalsBefore\.erin$/, /\.originalsAfter\.trace$/, /\.companion$/]) {
      expect(paths.some(path => pattern.test(path)), `real receipt branch ${pattern}`).toBe(true);
    }
    // The two public consumers must both call that mapper; this clone is never validated.
    const clone = structuredClone(state), expected = projectMisfortuneKnightLife(state);
    clone.misfortuneKnight.life.journal.forEach(entry => injectProbe(entry));
    const injectedHash = digest(clone), actual = projectMisfortuneKnightLife(clone);
    expect(actual).toEqual(expected);
    expect(actual.ledger).toEqual(state.misfortuneKnight.life.journal.map(expectedReceipt));
    for (const c of actual.cases) expect(c.attempts).toEqual(expectedAttempts(state, c.id));
    actual.ledger.forEach(entry => assertNoPrivate(entry, 'life.ledger'));
    for (const c of actual.cases) for (const attempt of c.attempts) attempt.receipts.forEach(entry => assertNoPrivate(entry, 'life.attempt.receipt'));
    assertDetached(actual.ledger, clone); expect(digest(clone)).toBe(injectedHash); expect(digest(state)).toBe(before);
  }, 120_000);

  it('keeps all four narrow live panels safe against future fields without touching any genuine state', () => {
    const panels = [
      { name: 'MK round 1', key: 'misfortuneKnight' as const, project: projectMisfortuneKnightCombat, expected: expectedMKPanel },
      { name: 'CS first round', key: 'concealmentServant' as const, project: projectConcealmentServantCombat, expected: expectedCSPanel },
      { name: 'FB first round', key: 'fearBishop' as const, project: projectFearBishopCombat, expected: expectedFBPanel },
      { name: 'NW before last round', key: 'nightwatcher' as const, project: projectNightwatcherCombat, expected: expectedNWPanel },
    ];
    for (const panel of panels) {
      const state = validatedCapture(panel.name), before = digest(state), expected = panel.expected(state), clone = structuredClone(state);
      injectProbe(clone.spiritWarlock.companion);
      injectProbe(clone[panel.key].encounter);
      if (clone.combat!.lastRound) {
        const last = clone.combat!.lastRound;
        // Probe only the existing mapped outcome. NW outcomes are already public, unchanged facts.
        if (last.misfortuneKnightOutcome) injectProbe(last.misfortuneKnightOutcome);
        if (last.concealmentServantOutcome) injectProbe(last.concealmentServantOutcome);
        if (last.fearBishopOutcome) injectProbe(last.fearBishopOutcome);
      }
      const injectedHash = digest(clone), actual = panel.project(clone);
      expect(actual).toEqual(expected); assertNoPrivate(actual, `panel.${panel.key}`); assertDetached(actual, clone);
      expect(digest(clone)).toBe(injectedHash); expect(digest(state)).toBe(before);
    }
  }, 120_000);
});
