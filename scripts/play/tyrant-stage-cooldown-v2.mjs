import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';
/** NEW215 rebuild producer, not restoration of the lost original215 proof.
 * Continue the exact restored193 living701 final. Historical commands are
 * retained, never replayed; the policy never receives seed/cursor or future draws.
 * The parent must freeze/build the reviewed runtime before any natural run. */
export const SOURCE = 'tests/fixtures/thunder-god-v01930/boundary-step-701-action.json';
export const SOURCE_SHA256 = '6d721f6e2376085b77026c8a9373fbed5b005ee8a2413d27cdf5f02a4303f708';
export const SOURCE_STATE_SHA256 = '46f9e02789ce3b8b948a8110ab84c2ff7ee8651a7bc03b28876d1d90bc1bc788';
export const ARCHIVE = 'tests/fixtures/thunder-god-v01930/natural.json';
export const ARCHIVE_SHA256 = 'd682e3656fa4f8fb70f09e38b71355c50b4657c5ab7263201afa3c97b2c3f8b1';
export const PREFIX_COUNT = 701;
export const PREFIX_SHA256 = 'c015b29d305accb2a3ed61c77aa736f3789d3568587afd952c917720d995eaac';
export const FORMAT = 'NEW215_RESTORED193_LIVING701_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const INPUTS = Object.freeze([{ file: SOURCE, sha256: SOURCE_SHA256 }, { file: ARCHIVE, sha256: ARCHIVE_SHA256 }]);
export const POLICY = Object.freeze({ id: 'NEW215_SAME_THREE_ORIGINALS_PUBLIC_REBUILD_COOLDOWN_V2',
  predecessorPolicy: 'NEW215_SAME_THREE_ORIGINALS_PUBLIC_REBUILD_V1',
  cooldown: 'ONLY_EXACT_COAST_ASK_PERMISSION_ALREADY_ANSWERED_THIS_WEEK_USES_EXISTING_PAID_WAIT', startWeek: 169,
  wage: 180, weeklyLiving: 30, defaultObservationActions: 32, selectedBoundaryLimit: 64, carrierLimit: 3,
  s1Recovery: 'PAID_SAME_ORIGINAL1_LATER_WEEK_FIVE_FRESH_JOBS_PAID_PREPARATION_PAID_SUPPORT',
  s1Practice: 'THREE_PAID_ORDINARY_CASES_ACTUAL_RETURNS_AND_REFLECTION',
  s1Failure: 'KEEP_REAL_COSTS_BODY_AND_FAILURE_THEN_RECOVER_SAME_LATEST_ORIGINAL',
  coasts: 'FINITE_PAID_GRAIN_TRANSFER_REAL_FULFILLMENT_LATER_REVIEW_TWELVE_WEEK_WITNESSES',
  challenge: 'ACTUAL_SOLO_OTHER_SUN0_HOSTILE_EXCHANGES_AND_PHYSICAL_ESCAPE',
  promotion: 'CURRENT_PHYSICAL_ASSEMBLY_SAME_COMPOUND_PAID_PREPARATION_SEPARATE_DOSE',
  failure: 'SEAL_REAL_REMAINS_LATER_WEEK_PAID_RECOVERY_NO_FOURTH_CARRIER_DEATH_ARCHIVED',
  epilogue: 'TWO_FINITE_TECHNIQUE_ATTEMPTS_ACTUAL_RESCUE_OR_ORDINARY_EXIT_HONEST_REPORT',
  observationLimit: 'RESUMABLE_CONTROLLED_STOP_NEVER_PRODUCT_FAILURE', noReroll: true });
/** This is a reviewed policy continuation, never a replacement historical run.
 * Product source, built runtime, costs and all consumed random outcomes are V1. */
export const CONTINUATION_835 = Object.freeze({
  kind: 'NEW215_EXACT835_PUBLIC_COAST_PERMISSION_COOLDOWN_V2', commandCount: 835, newCommands: 134,
  checkpointSha256: '809d7ea0a29860fe1549950c6a38d68957f56af3ac31a449e6bb608978707f1f',
  envelopeSha256: '84e6454150f9360b7ba5693489dabfe41b2adac3a58ce4acf74f106d5ce88cae',
  stateSha256: 'a8ebdf5285e8a80729f2aeeae265339fc13c237b0c137e3b3b3046530a5b3a27',
  runtimeFreezeSha256: '4ddaedd779bb456d2626a7880f7ffa254c15195f9a5fa9c5ccafeeefc71ffb21',
  runtimeFreezeFileSha256: '1a2228b053326997e15f45ea3f7fed140ce90e71917828ccd701f73549e8efac',
  producerSha256: '33696eed2c892db28ebe49d989c7971e06a0eddcd01da359228e99a9f2b5eb58',
  inputFreezeSha256: 'e0c90e36fa1b47596bdfef3bfec3d6e0af686c67fa32285b6678ef9551e4d474',
  blockedReason: '本周已得到这一原人群答复，不反复询问刷许可。'
});
export function isExactCoastPermissionCooldown(action) {
  return action?.preferredAction === true && action.enabled === false &&
    action.command?.type === 'COAST' && action.command.command?.type === 'ASK_PERMISSION' &&
    ['north','east','south'].includes(action.command.command.coastId) && action.reason === CONTINUATION_835.blockedReason;
}
export function assert835Predecessor(envelope, evidence) {
  const p = envelope.payload;
  assert.equal(evidence.sha256, CONTINUATION_835.checkpointSha256, 'Not the pinned actual835 compressed checkpoint');
  assert.equal(envelope.sha256, CONTINUATION_835.envelopeSha256, 'Not the pinned actual835 envelope');
  assert.equal(p.commandCount, 835); assert.equal(p.commands.length, 134); assert.equal(p.rows.length, 134);
  assert.equal(p.finalStateSha256, CONTINUATION_835.stateSha256); assert.equal(stateHash(p.state), p.finalStateSha256);
  assert.equal(p.runtimeFreezeSha256, CONTINUATION_835.runtimeFreezeSha256);
  assert.equal(p.inputFreezeSha256, CONTINUATION_835.inputFreezeSha256);
  assert.deepEqual(p.state.random, { seed: 'sailor-natural-v026', cursor: 273 });
  assert.equal(p.pending, null); assert.equal(p.terminal, null);
}
export function assertOnlyProducerFreezeChanged(before, after, producerEvidence) {
  assert.equal(before.sha256, CONTINUATION_835.runtimeFreezeSha256);
  assertFrozenRowsExceptProducer(before, after, producerEvidence);
}
export function assertFrozenRowsExceptProducer(before, after, producerEvidence) {
  assert.equal(before.sha256, compactHash(before.files)); assert.equal(after.sha256, compactHash(after.files));
  assert.equal(before.nodeVersion, after.nodeVersion); assert.equal(before.files.length, after.files.length);
  let replacements = 0;
  for (const [index, old] of before.files.entries()) {
    const next = after.files[index]; assert.equal(next.file, old.file, 'Frozen path/order drift');
    if (old.file === '$natural-producer') {
      replacements++; assert.equal(old.sha256, CONTINUATION_835.producerSha256);
      assert.deepEqual(next, { file: '$natural-producer', ...producerEvidence });
      assert.notEqual(next.sha256, old.sha256, 'Continuation producer must have a distinct exact hash');
    } else assert.deepEqual(next, old, `Unapproved frozen file drift: ${old.file}`);
  }
  assert.equal(replacements, 1);
}
export function assert835InheritedPayload(current, predecessor) {
  assert(current.commandCount >= 835, 'Cannot start or rewind before the actual835 boundary');
  assert.deepEqual(current.commands.slice(0, 134), predecessor.commands, 'Inherited actual commands changed');
  assert.deepEqual(current.rows.slice(0, 134), predecessor.rows, 'Inherited complete receipts changed');
  assert.deepEqual(current.boundaries.filter(b => b.commandCount <= 835), predecessor.boundaries);
  for (const key of ['format','source','sourceSha256','prefixSha256','inputFreezeSha256','migration','createdAt',
    'initialStateSha256','initialPublicSha256','initialGlobalPublicSha256','initialRandomSha256'])
    assert.deepEqual(current[key], predecessor[key], `Inherited ${key} changed`);
  if (current.commandCount === 835) {
    for (const key of ['state','finalStateSha256','publicStateSha256','globalPublicStateSha256','policy','terminal'])
      assert.deepEqual(current[key], predecessor[key], `835 continuation mutated ${key}`);
    if (current.pending !== null) {
      assert.equal(current.pending.commandCount, 836, 'Only exact836 may be pending at835');
      assert.equal(current.pending.beforeStateSha256, predecessor.finalStateSha256);
      assert.equal(current.pending.policyBeforeSha256, stateHash(predecessor.policy));
    }
  }
}
export function assert835PendingDecision(payload, publicView) {
  if (payload.commandCount !== 835 || !payload.pending) return;
  const decision = chooseAction(publicView, payload.policy);
  assert(!decision.stop && publicActionStillAvailable(publicView, decision.action));
  assert(['WORK','NEXT_WEEK'].includes(decision.action.intent.command.type));
  assert.deepEqual(payload.pending.decision, decision, 'Pending836 must retain the exact reviewed cooldown decision');
  assert.deepEqual(payload.pending.intent, decision.action.intent);
}
export function verify835Continuation(directory, payload, freeze) {
  const proof = readCapture(join(directory, 'continuation-835.json'));
  assert.deepEqual(proof.anchor, CONTINUATION_835); assert.deepEqual(payload.continuation835, proof);
  assert.equal(proof.format, 'NEW215_REVIEWED_EXACT835_CONTINUATION_MANIFEST_V1');
  assert.equal(proof.predecessorDirectory, 'predecessor-835');
  assert.equal(proof.firstPossibleNewCommand, 836); assert.equal(proof.runtimeRulesChanged, false);
  assert.equal(proof.inheritedCommandsVerifiedByBothPolicies, 134); assert.equal(proof.oldOutcomesRetained, true);
  assert.equal(proof.predecessorFilesSha256, stateHash(proof.predecessorFiles));
  assert.equal(proof.newRuntimeFreezeSha256, freeze.sha256);
  assert.deepEqual(proof.producer, fileEvidence(SELF));
  assert.deepEqual(fileEvidence(join(directory, 'producer.mjs')), proof.producer);
  assert.deepEqual(fileEvidence(join(directory, 'continuation-tool.mjs')), proof.tool);
  assert.deepEqual(fileEvidence(join(dirname(SELF), 'tyrant-stage-continue-835.mjs')), proof.tool);
  const archive = join(directory, 'predecessor-835');
  assert.equal(proof.predecessorFiles.length, 145);
  assert.equal(new Set(proof.predecessorFiles.map(row => row.file)).size, 145);
  assert.deepEqual(readdirSync(archive).sort(), proof.predecessorFiles.map(row => row.file).sort());
  for (const row of proof.predecessorFiles) {
    assert(/^[A-Za-z0-9.-]+$/.test(row.file), 'Invalid predecessor evidence filename');
    assert.deepEqual(fileEvidence(join(archive, row.file)), { bytes: row.bytes, sha256: row.sha256 });
  }
  const predecessorPath = join(archive, 'checkpoint.json.gz'), predecessor = decodeCheckpoint(readFileSync(predecessorPath));
  assert835Predecessor(predecessor, fileEvidence(predecessorPath));
  assert.equal(fileEvidence(join(archive, 'runtime-freeze.json')).sha256, CONTINUATION_835.runtimeFreezeFileSha256);
  assert.equal(fileEvidence(join(archive, 'producer.mjs')).sha256, CONTINUATION_835.producerSha256);
  assertOnlyProducerFreezeChanged(readCapture(join(archive, 'runtime-freeze.json')), freeze, proof.producer);
  assert835InheritedPayload(payload, predecessor.payload);
  assert835PendingDecision(payload, readCapture(join(archive, 'action-835.json.gz')).public);
  return proof;
}
const SELF = fileURLToPath(import.meta.url);
const clone = value => structuredClone(value);
const sha = value => createHash('sha256').update(value).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => sha(stable(value));
const compactHash = value => sha(JSON.stringify(value));
const cash = panel => Number(String(panel.resources.cash).match(/^\d+/)?.[0] ?? NaN);
export const publicPrice = action => ({ actions: Number(action.cost.match(/(\d+)行动/)?.[1] ?? 0), cash: Number(action.cost.match(/(\d+)便士/)?.[1] ?? 0) });
export function startingPolicy() { return { phase: 'S1_SAME_ORIGINAL_RECOVERY', week: POLICY.startWeek,
  s1SourceBottleId: 'thunder-god-potion-1', s1StabilizedBottleId: null, s1Doses: 0,
  doses: 0, carriers: [], epilogueAttempted: [], reported: false, loop: { key: null, repetitions: 0 } }; }
const actionOf = (action, type = 'TYRANT') => ({ ...clone(action), intent: { type, command: clone(action.command) } });
const noProgress = reason => ({ stop: 'PUBLIC_ACTION_BLOCKED', reason });

/** Exact field names, not broad substring bans: public prices.preparation and
 * check.modifiers[].source are lawful. Neither exposes a private source state. */
export function assertPublicOnly(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const labelSource = key === 'source' && typeof child === 'string';
    assert(!['seed','cursor','randomSeed','randomCursor','random','rng','rngState','futureRoll','futureRolls','nextRoll','unrolledResult','privateSource','sourceState','frame','journal'].includes(key), `Private field at ${path}.${key}`);
    assert(key !== 'source' || labelSource, `Private source at ${path}.${key}`);
    assertPublicOnly(child, `${path}.${key}`);
  }
}
/** Whole-dashboard audit is separate from the current-chapter policy view.
 * Public scalar source labels and prices.preparation are legitimate; only the
 * two exact inactive null guard targets are exceptions to private actor IDs. */
export function assertGlobalPublic(projection, state) {
  const forbidden = new Set(['random','seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter',
    'cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest','originalsDigest',
    'originalPracticeDigest','acquisitionDigest','originalWorldDigest','combatHistoryDigest','compoundDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId',
    'custodianActorId','futureRoll','futureRolls','nextRoll','unrolledResult']);
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    for (const [key,value] of Object.entries(node)) {
      const next = `${path}.${key}`, inactiveGuard = key === 'actorId' && value === null &&
        ['$.divineHand.life.site.guard.actorId','$.glory.life.site.guard.actorId'].includes(next);
      assert(!(forbidden.has(key) && !inactiveGuard) && !(key === 'source' && value !== null && typeof value === 'object'), `Private global field at ${next}`);
      visit(value, next);
    }
  };
  visit(projection, '$');
  const json = JSON.stringify(projection);
  const secrets = new Set([state.random.seed]);
  const collect = node => {
    if (!node || typeof node !== 'object') return;
    for (const [key,value] of Object.entries(node)) {
      if ((key === 'actorId' || key.endsWith('Digest')) && typeof value === 'string' && value) secrets.add(value);
      else if (value && typeof value === 'object') collect(value);
    }
  };
  collect(state);
  for (const secret of secrets)
    assert(!json.includes(secret), 'Whole public projection contains an actual private seed or source identity');
}
export function capturePublic(projection) {
  const fields = ['runId','revision','status','week','date','actionsRemaining','weeklyBudget','cash','weeklyWage','wagePaid',
    'health','mind','spirituality','maxHealth','maxMind','maxSpirituality','pollution','injuries','injuryRisk',
    'debtTotal','debts','canAct','actionBlockedReason','activeEvent','combat'];
  const ordinary = Object.fromEntries(fields.map(key => [key, clone(projection[key])]));
  const tg = projection.thunderGod;
  // No raw acquisition/source journal is a decision input. Life exposes only
  // existing public controls, ordinary scene facts and actual resolved results.
  const thunderGod = { guidanceKnown: tg.guidanceKnown, promoted: tg.promoted, preparedWeek: tg.preparedWeek,
    actions: clone(tg.actions), bottles: tg.bottles.map(({ id,status,chance }) => ({ id,status,chance })),
    insideCase: tg.insideCase, life: Object.fromEntries(['activeCase','inside','reflected','playerLocation','target','pad','cases','actions']
      .map(key => [key, clone(tg.life[key])])) };
  const result = { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: clone(projection.progression.mastery) }, thunderGod, tyrant: clone(projection.tyrant) };
  assertPublicOnly(result); return result;
}
const fullBody = view => view.health >= 100 && view.mind >= 100 && view.spirituality >= 120 && view.pollution === 0 && view.injuries.length === 0;
function ordinaryAction(view, reason) {
  if (!view.canAct || view.thunderGod.insideCase || view.thunderGod.life.inside || view.combat)
    return noProgress(`Ordinary work/rest cannot bypass an active scene: ${reason}`);
  const action = view.wagePaid ? 'REST' : 'WORK';
  return { action: { id: `ordinary-${action}`, label: action === 'WORK' ? '做本周原职业工作' : '按实际生活档休养',
    cost: '1行动；实际工资、恢复与周生活费照常', enabled: true, reason: null, intent: { type: 'ACTION', action } }, reason };
}
function s1Action(view, policy) {
  const d = view.thunderGod, actions = d.actions, find = type => actions.find(a => a.command.type === type);
  const select = (a, reason) => ({ action: actionOf(a, 'THUNDER_GOD'), reason });
  const nextOrBudget = (a, reason) => {
    if (!a) return noProgress(`The same original public action is missing: ${reason}`);
    if (a.enabled) return select(a, reason);
    const cost = publicPrice(a);
    if (view.actionsRemaining < cost.actions || view.cash < cost.cash || /隔一真实周|下一真实周|本周剩余行动不足/.test(a.reason ?? ''))
      return ordinaryAction(view, `${a.label}: ${a.reason}`);
    return noProgress(`${a.label}: ${a.reason ?? reason}`);
  };
  if (view.progression.sequence === 2) {
    policy.phase = 'S1_SAME_ORIGINAL_RECOVERY';
    const dose = find('CONSUME'), support = find('STABILIZE_PROMOTION');
    if (dose) {
      if (d.preparedWeek === view.week) {
        if (policy.s1StabilizedBottleId !== dose.command.bottleId)
          return nextOrBudget(support, 'Pay the current same-bottle support separately; no source, resource or draw replacement');
        const offered = d.bottles.find(b => b.id === dose.command.bottleId);
        if (offered?.chance !== 70) return noProgress('The exact supported S1 dose does not publicly show70% readiness');
        return nextOrBudget(dose, 'Consume the actual paid supported recovered original; retain its real failure or death');
      }
      if (!fullBody(view) || view.cash < 210 || view.actionsRemaining < 2)
        return ordinaryAction(view, 'Recover the actual body and reserve150p preparation plus60p support and two available actions');
      return nextOrBudget(find('PREPARE_PROMOTION'), 'Pay150p for this week’s actual original-site preparation');
    }
    const labour = find('POTION_WORK');
    if (labour) return nextOrBudget(labour, 'Do each of the five fresh actual paid-remixture labour steps');
    const buy = find('BUY_POTION');
    if (buy) {
      if (!fullBody(view) || view.cash < publicPrice(buy).cash + 210 || view.actionsRemaining < 2)
        return ordinaryAction(view, 'Earn the displayed actual remixture balance plus210p separate preparation/support and recover this body');
      return nextOrBudget(buy, 'Pay the displayed actual price for the same original characteristic’s new ordinary vessel');
    }
    const recover = find('RECOVER_CHARACTERISTIC_V1');
    if (recover) return nextOrBudget(recover, 'Return after a real week and recover the same paid original remnant with its current keeper');
    const request = actions.find(a => a.command.type === 'REQUEST_RECOVERY_V1' && a.command.bottleId === policy.s1SourceBottleId);
    return nextOrBudget(request, 'Pay120p to investigate the same latest failed vessel descended from original1; never request an independent fourth original');
  }
  if (view.progression.sequence !== 1) return noProgress('Unexpected S1 handoff sequence');
  if (!d.life.reflected) {
    policy.phase = 'S1_THREE_ORDINARY_PRACTICES';
    const invitation = d.life.actions.find(a => a.command.type === 'INVITE' && a.command.method === 'ORDINARY');
    const preferred = invitation ?? d.life.actions.find(a => a.preferredAction)
      ?? d.life.actions.find(a => ['OBSERVE','BUY_TARGET','BUY_PAD','WALK_TO_SITE','REPORT','REFLECT'].includes(a.command.type));
    if (preferred?.command.type === 'WALK_TO_SITE' && (view.cash < 10 || view.actionsRemaining < 1 || view.health < 6 || view.mind < 10 || view.spirituality < 10))
      return ordinaryAction(view, 'Reserve the actual10p invitation and1AP before beginning contact at the original exit');
    return nextOrBudget(preferred, 'Complete the next actual ordinary source inspection, permission, physical task, return and honest report');
  }
  policy.phase = 'TYRANT_ENTRY';
  const guidance = view.tyrant.actions.find(a => a.command.type === 'LEARN_GUIDANCE');
  if (guidance?.enabled) return { action: actionOf(guidance), reason: 'Begin NEW215 only after genuine same-original S1 promotion and three real ordinary reports/reflection' };
  if (guidance && (view.actionsRemaining < publicPrice(guidance).actions || view.cash < publicPrice(guidance).cash))
    return ordinaryAction(view, 'Earn the exact public100p Tyrant guidance and actual action before the S0 chapter');
  return noProgress(`Actual S1 handoff is blocked: ${guidance?.reason ?? 'No public guidance'}`);
}
function tyrantAction(view, policy) {
  const d = view.tyrant, actions = d.actions, find = type => actions.find(a => a.command.type === type && a.enabled);
  const select = (a, reason) => ({ action: actionOf(a), reason });
  if (policy.reported) return { stop: 'NATURAL_FINITE_TYRANT_REPORTED', reason: 'The actual finite incident was honestly reported; failed skills are retained' };
  policy.phase = d.promoted ? 'TYRANT_EPILOGUE' : 'TYRANT_MATERIALS_COASTS_CHALLENGE';
  const next = actions.find(a => a.preferredAction);
  if (!next) {
    if (!d.promoted && policy.carriers.length === POLICY.carrierLimit && !actions.some(a => a.enabled && a.command.type === 'MATERIAL' && ['SEAL_REMAINS','RECOVER_SEALED','COMPOSE_POTION'].includes(a.command.command.type)))
      return { stop: 'NATURAL_FINITE_CARRIERS_UNAVAILABLE', reason: 'All three actual ordinary carriers are spent; the captured original outcomes remain' };
    return noProgress('No intended public progression action is marked; preserve the current physical boundary');
  }
  const c = next.command, cost = publicPrice(next);
  const ordinaryExit = reason => {
    const a = actions.find(a => a.enabled && a.command.type === 'COAST' && a.command.command.type === 'RETURN_TO_HARBOR') ?? find('RETURN_ON_FOOT');
    return a ? select(a, `Actually walk to the ordinary recovery location: ${reason}`) : noProgress(`No safe enabled ordinary return: ${reason}`);
  };
  const wait = (reason, targetCash = cost.cash + POLICY.weeklyLiving) => {
    if (d.insideCase) return ordinaryExit(reason);
    if (cash(d) < targetCash && find('WORK')) return select(find('WORK'), `Earn this real week’s original180p wage for the displayed next cost: ${reason}`);
    if (find('NEXT_WEEK')) return select(find('NEXT_WEEK'), `Cross one actual week, paying living costs and old debts: ${reason}`);
    return ordinaryExit(reason);
  };
  const recover = reason => {
    if (view.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
      const clinic = actions.find(a => a.command.type === 'CLINIC');
      if (clinic?.enabled) return select(clinic, 'Pay actual60p treatment of the same untreated heavy injury; later rest is still required');
      if (clinic && (cash(d) < publicPrice(clinic).cash || d.resources.actionsRemaining < publicPrice(clinic).actions))
        return wait('Earn and reserve the displayed actual clinic cost before resting the untreated injury', publicPrice(clinic).cash + POLICY.weeklyLiving);
      return noProgress(`The actual clinic is unavailable: ${clinic?.reason ?? reason}`);
    }
    return find('REST') ? select(find('REST'), reason) : wait(reason, POLICY.weeklyLiving);
  };
  if (c.type === 'CONSUME') {
    if (policy.doses >= POLICY.carrierLimit) return noProgress('The finite three-carrier policy cannot consume a fourth vessel');
    if (!next.enabled || !d.sections.some(s => s.id.startsWith('promotion-') && s.lines.some(line => /当前同瓶准备仍有效/.test(line))))
      return noProgress('The exact current physically assembled same-dose preparation is not publicly valid');
    return select(next, 'Consume the same actual paid prepared compound immediately, retaining all expenses, injury, failure and death');
  }
  if (c.type === 'MATERIAL' && c.command.type === 'SEAL_REMAINS')
    return next.enabled ? select(next, 'Seal the real failed remains at their actual location before any optional recovery') : noProgress(next.reason);
  if ((c.type === 'STABILIZE_PROMOTION' || c.type === 'START_EPILOGUE' || c.type === 'CHALLENGE' && c.command.type === 'BEGIN') && !fullBody(view))
    return recover('Recover the actual body and pollution before the next independent physical risk');
  if (c.type === 'STABILIZE_PROMOTION' && d.resources.actionsRemaining < 2)
    return wait('Keep two available actions before paid preparation; independent consumption uses its displayed cost');
  if (c.type === 'MATERIAL' && c.command.type === 'VERIFY_UNIQUENESS' && c.command.step === 'VACANCY') {
    const handoff = actions.find(a => a.command.type === 'MATERIAL' && a.command.command.type === 'ACQUIRE_UNIQUENESS');
    if (!handoff) return noProgress('The matching public same-week uniqueness handoff is missing');
    const pairCash = cost.cash + publicPrice(handoff).cash + POLICY.weeklyLiving;
    if (d.resources.actionsRemaining < cost.actions + publicPrice(handoff).actions || cash(d) < pairCash)
      return wait('Reserve both displayed verification and same-week handoff costs plus actual living charges', pairCash);
  }
  if (next.enabled) return select(next, 'Follow the exact enabled public same-original action and retain its actual outcome');
  if (d.resources.actionsRemaining < cost.actions || cash(d) < cost.cash) return wait(`${next.label}: ${next.reason}`);
  if (/下一真实周|下一实际周|隔周|至少到下一|至少下一|尚未到达|尚未满12|下周/.test(next.reason ?? '')) return wait(`${next.label}: ${next.reason}`);
  if (isExactCoastPermissionCooldown(next)) return wait(`${next.label}: ${next.reason}`);
  if (/健康|精神|灵性|伤势|休养/.test(next.reason ?? '') && !fullBody(view)) return recover(`${next.label}: ${next.reason}`);
  return noProgress(`${next.label}: ${next.reason ?? 'Unresolved public prerequisite'}`);
}
export function chooseAction(view, previous) {
  assertPublicOnly(view); const policy = clone(previous);
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_ACTUAL_TERMINAL', reason: `Actual runtime status ${view.status}`, policy };
  if (view.combat) return { ...noProgress('Unexpected old combat; never reopen or replace a historical encounter'), policy };
  if (view.activeEvent) {
    if (view.tyrant.guidanceKnown) return { ...noProgress('A legacy event cannot bypass the owned chapter'), policy };
    const event = view.activeEvent, choices = { 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' };
    const id = event.id.startsWith('ORIGIN') ? '.decline' : choices[event.id], choice = event.choices.find(c => c.id === id && c.enabled);
    if (!choice) return { ...noProgress(`No declared enabled ordinary choice for ${event.id}`), policy };
    return { action: { ...clone(choice), cost: choice.cost ?? '实际事件费用', intent: { type: 'EVENT_CHOICE', eventInstanceId: event.instanceId, choiceId: id } },
      reason: 'Resolve the actual ordinary bill, treatment or explicitly declined offer without bypassing its cost', policy };
  }
  return { ...(view.tyrant.guidanceKnown ? tyrantAction(view, policy) : s1Action(view, policy)), policy };
}
export function loopDiagnostic(before, after, policy) {
  const semantic = v => ({ phase: policy.phase, sequence: v.progression.sequence, acting: v.progression.acting,
    event: v.activeEvent,
    s1: v.tyrant.guidanceKnown ? null : { bottles: v.thunderGod.bottles, preparedWeek: v.thunderGod.preparedWeek,
      life: Object.fromEntries(Object.entries(v.thunderGod.life).filter(([key]) => key !== 'actions')) },
    progress: v.tyrant.sections.filter(s => !['clock','recent-action','finance','body'].includes(s.id)),
    intended: v.tyrant.actions.filter(a => a.preferredAction).map(a => a.command) });
  // A real paid wage or actual bodily recovery is progress. Burning actions,
  // losing cash to bills or changing only the clock is not progress by itself.
  const gained = after.cash > before.cash || after.health > before.health || after.mind > before.mind ||
    after.spirituality > before.spirituality || after.pollution < before.pollution || after.injuries.length < before.injuries.length;
  const key = stateHash(semantic(after)), unchanged = isDeepStrictEqual(semantic(before), semantic(after));
  return { key, repetitions: unchanged && !gained ? policy.loop.repetitions + 1 : 0 };
}
export function advancePolicy(decision, after, before) {
  const p = clone(decision.policy), intent = decision.action.intent, c = intent.command; p.week = after.week;
  if (intent.type === 'THUNDER_GOD') {
    if (c.type === 'STABILIZE_PROMOTION') p.s1StabilizedBottleId = c.bottleId;
    if (c.type === 'CONSUME') { p.s1Doses++; p.s1SourceBottleId = c.bottleId; p.s1StabilizedBottleId = null; }
  }
  if (intent.type === 'TYRANT') {
    if (c.type === 'CONSUME') p.doses++;
    if (c.type === 'MATERIAL' && c.command.type === 'BUY_COMPOUND') { assert(!p.carriers.includes(c.command.batchId)); p.carriers.push(c.command.batchId); assert(p.carriers.length <= POLICY.carrierLimit); }
    if (c.type === 'EPILOGUE') {
      if (['DIVERT_WATER','RELEASE_ENERGY'].includes(c.command.type)) { assert(!p.epilogueAttempted.includes(c.command.type)); p.epilogueAttempted.push(c.command.type); }
      if (c.command.type === 'REPORT') p.reported = true;
    }
  }
  p.loop = loopDiagnostic(before, after, p); return p;
}
export function fileEvidence(path) {
  const before = lstatSync(path, { bigint: true });
  assert(before.isFile() && !before.isSymbolicLink(), `Not a frozen regular file: ${path}`);
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(before[key], after[key], `File changed while hashing: ${path}`);
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: hash.digest('hex') };
}
export function inspectFreeze(root = process.cwd()) {
  const files = [];
  const walk = name => {
    const path = join(root, name), stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Frozen input cannot be a symlink: ${name}`);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(name, child));
    else if (stat.isFile()) files.push({ file: name.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync(join(root, 'dist/domain/tyrant/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of new Set(['package.json','package-lock.json','src','dist/domain','dist/content','dist/resolution','dist/persistence','dist/shared','dist/application','dist/simulation','node_modules/@noble/hashes'])) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) });
  files.push({ file: 'scripts/play/tyrant-stage.test.mjs', ...fileEvidence(join(root, 'scripts/play/tyrant-stage.test.mjs')) });
  return { sha256: compactHash(files), nodeVersion: process.version, files };
}
const stampFreeze = (root, freeze) => freeze.files.map(file => {
  const path = file.file === '$natural-producer' ? SELF : join(root, file.file), stat = lstatSync(path, { bigint: true });
  return { path, size: stat.size, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs, ino: stat.ino };
});
function unchanged(stamps) {
  for (const before of stamps) {
    const after = lstatSync(before.path, { bigint: true }); assert(after.isFile() && !after.isSymbolicLink());
    for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(before[key], after[key], `Frozen input drift: ${before.path}`);
  }
}
const syncDirectory = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function durableCreate(path, value) {
  const fd = openSync(path, 'wx'); try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
}
export const encodeCheckpoint = payload => JSON.stringify({ sha256: stateHash(payload), payload });
export function decodeCheckpoint(bytes) {
  const envelope = JSON.parse(Buffer.isBuffer(bytes) && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : String(bytes)); assert.equal(envelope.sha256, stateHash(envelope.payload), 'Checkpoint checksum mismatch');
  assert.equal(envelope.payload.format, FORMAT); return envelope;
}
export function recoverAtomicNext(path) {
  const candidate = `${path}.next`; if (!existsSync(candidate)) return;
  const current = existsSync(path) ? decodeCheckpoint(readFileSync(path)) : null;
  let next;
  try { next = decodeCheckpoint(readFileSync(candidate)); }
  catch {
    assert(!existsSync(`${path}.incomplete`), 'Preserve both incomplete boundaries and inspect before resume');
    renameSync(candidate, `${path}.incomplete`); syncDirectory(dirname(path)); return;
  }
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unknown checkpoint successor; do not discard it');
  renameSync(candidate, path); syncDirectory(dirname(path));
}
function saveCheckpoint(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'Recover the pending atomic successor first');
  const text = encodeCheckpoint({ ...payload, predecessorSha256 }); durableCreate(`${path}.next`, gzipSync(text, { level: 6 }));
  renameSync(`${path}.next`, path); syncDirectory(dirname(path)); return decodeCheckpoint(text);
}
function replaceDerived(path, value) {
  const temporary = `${path}.derived-next`, fd = openSync(temporary, 'w');
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path); syncDirectory(dirname(path));
}
export function readSource(root = process.cwd()) {
  const buffers = INPUTS.map(pin => { const bytes = readFileSync(join(root, pin.file)); assert.equal(sha(bytes), pin.sha256, `Frozen historical input changed: ${pin.file}`); return bytes; });
  const boundary = JSON.parse(buffers[0]), archive = JSON.parse(buffers[1]);
  const source = boundary.final, commands = archive.commands.slice(0, PREFIX_COUNT);
  assert.equal(boundary.commandCount, PREFIX_COUNT); assert.deepEqual(boundary.lastIntent, commands.at(-1));
  assert.equal(compactHash(source), SOURCE_STATE_SHA256, 'Use the exact restored193 living701 final, never a substitute successor');
  assert.equal(commands.length, PREFIX_COUNT); assert.equal(compactHash(commands), PREFIX_SHA256);
  assert.equal(source.revision, 702); assert.equal(source.runId, 'sailor-rebuild-natural');
  assert.equal(archive.seed, source.random.seed); assert.deepEqual(source.random, { seed: 'sailor-natural-v026', cursor: 270 });
  assert.equal(source.schemaVersion, 190); assert.equal(source.contentVersion, 'thunder-god-v190');
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, POLICY.startWeek);
  assert.deepEqual(source.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 9, day: 16 });
  assert.deepEqual([source.health,source.mind,source.spirituality,source.cash,source.actionsRemaining,source.seer.pollution], [93,85,120,210,2,20]);
  assert.deepEqual(source.injuries, []); assert.equal(source.character.coreStats.will, 27); assert.equal(source.character.weeklyWage, 180);
  assert.equal(source.lifeTier, 'DESTITUTE'); assert.equal(source.progression.pathwayId, 'tyrant'); assert.equal(source.progression.sequence, 2);
  assert.equal(source.progression.acting, 100); assert.equal(source.catastrophe.life.reflected, true);
  assert.equal(source.thunderGod.promotionWeek, null); assert.equal(source.thunderGod.life.reflected, false);
  assert.deepEqual(source.thunderGod.bottles.map(b => [b.id,b.status,b.outcome]), [1,2,3].map(n => [`thunder-god-potion-${n}`,'CONSUMED','FAILURE']));
  assert.equal(source.thunderGod.acquisitionJournal.filter(j => j.command.type === 'CONSUME').length, 3);
  assert.equal(Object.keys(source.progression.mastery).length, 22); assert.equal(source.combat, null); assert.equal(source.activeEvent, null);
  const files = INPUTS.map((pin, index) => ({ ...pin, bytes: buffers[index].length }));
  return { source, commands, creation: archive.creation, seed: archive.seed, buffers,
    inputFreeze: { format: 'NEW215_RESTORED193_HISTORICAL_INPUTS_V1', sha256: compactHash(files), files,
      originalStateSha256: SOURCE_STATE_SHA256, sourceRoot: 'final', prefixSha256: PREFIX_SHA256, archivedCommandCount: PREFIX_COUNT,
      origin: 'GENUINELY_RESTORED_VOLUME193', lostOriginal215Restored: false } };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index','domain/slice/migration','domain/tyrant/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openTyrantRuntimeSession: session.openTyrantRuntimeSession };
}
export function migrate(runtime, original) {
  const before = stateHash(original), state = runtime.migrateSliceState(original);
  assert.equal(stateHash(original), before, 'Migration mutated historical input');
  for (const [key,value] of Object.entries(original)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  assert.equal(state.schemaVersion, 212); assert.equal(state.contentVersion, 'tyrant-v212');
  runtime.assertValidSliceState(state); return state;
}
export function checkOriginals(state, original, before) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed); assert(state.random.cursor >= before.random.cursor);
  // S1 practice may move these same original people along the original path;
  // only its site counters/positions may change. The strict reducer validates
  // every such movement. Neither the frozen old cases nor old objects change.
  for (const key of ['sailor','rager','navigator','windBlessed','oceanSinger','cataclysmPriest','seaKing','town','combatHistory'])
    assert.deepEqual(state[key], original[key], `Frozen original history changed: ${key}`);
  const catastrophe = clone(state.catastrophe); catastrophe.life.site = clone(original.catastrophe.life.site);
  assert.deepEqual(catastrophe, original.catastrophe, 'Old Catastrophe cases, outcomes and uncontacted people must stay frozen');
  for (const key of ['water','gate','buoy','mooring','winch','wheel'])
    assert.deepEqual(state.catastrophe.life.site[key], original.catastrophe.life.site[key], `Original object changed: ${key}`);
  const { coreStats: _current, ...identity } = state.character, { coreStats: _old, ...oldIdentity } = original.character;
  assert.deepEqual(identity, oldIdentity, 'Original identity and real wage cannot be replaced');
  for (const [id,value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  assert.deepEqual(state.thunderGod.bottles.slice(0,3), original.thunderGod.bottles, 'All three actual failed original bottles remain unchanged');
  assert.deepEqual(state.thunderGod.sourceScene, original.thunderGod.sourceScene, 'The actual paid S1 source scene is immutable');
  assert.deepEqual(state.thunderGod.sourceHistory, original.thunderGod.sourceHistory, 'The complete inherited S1 source history is immutable');
  assert.deepEqual(state.thunderGod.acquisitionJournal.slice(0,original.thunderGod.acquisitionJournal.length), original.thunderGod.acquisitionJournal);
  for (const bottle of state.thunderGod.bottles.slice(3)) {
    assert(bottle.recovery, 'Never add an independent fourth original characteristic');
    assert.equal(bottle.recovery.originalBottleId, 'thunder-god-potion-1', 'The producer retains the same original1 recovery lineage');
  }
  if (before.tyrant.guidanceKnown) {
    for (const key of ['catastrophe','thunderGod','world']) assert.deepEqual(state[key], before[key], `Frozen actual S1 handoff changed: ${key}`);
    assert.deepEqual(state.tyrant.source, before.tyrant.source, 'Frozen actual S1 handoff cannot be replaced');
    assert.deepEqual(state.character, before.character, 'S0 does not replace the original identity or core stats');
    assert.equal(state.activeEvent, null);
  }
  assert.equal(state.combat, null);
}
export function selectionOutcome(after) {
  return { status: after.status, sequence: after.progression.sequence, promoted: after.tyrant.promoted,
    guidance: after.tyrant.guidanceKnown, s1Reflected: after.thunderGod.life.reflected };
}
/** First occurrence sampling does not drop the complete per-action evidence. */
export function selectedBoundary(intent, after, previous) {
  if (previous.length >= POLICY.selectedBoundaryLimit) return null;
  const c = intent.command, outcome = 'tyrant' in after ? selectionOutcome(after) : after; let key = null;
  if (intent.type === 'EVENT_CHOICE' && intent.choiceId === 'PAY') key = 'ordinary-paid-treatment';
  if (intent.type === 'THUNDER_GOD') {
    if (['REQUEST_RECOVERY_V1','RECOVER_CHARACTERISTIC_V1','BUY_POTION','PREPARE_PROMOTION','STABILIZE_PROMOTION','REFLECT'].includes(c.type)) key = `s1-${c.type.toLowerCase()}`;
    if (c.type === 'REPORT') key = `s1-report-${c.caseId}`;
    if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 's1-actual-terminal-dose' : outcome.sequence === 1 ? 's1-actual-promotion' : 's1-first-recovered-dose-failure';
  }
  if (intent.type === 'TYRANT') {
    if (['LEARN_GUIDANCE','CLINIC','STABILIZE_PROMOTION','START_EPILOGUE'].includes(c.type)) key = `tyrant-${c.type.toLowerCase()}`;
    if (c.type === 'COAST' && ['FULFILL','RENEW','REVIEW_NEXT_WEEK','LOAD_TRANSFER','DELIVER_TRANSFER'].includes(c.command.type)) key = `coast-${c.command.coastId}-${c.command.type.toLowerCase()}`;
    if (c.type === 'MATERIAL') {
      if (['ACQUIRE_CHARACTERISTIC','INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}-${c.command.bottleId}`;
      if (['ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}`;
      if (c.command.type === 'VERIFY_UNIQUENESS') key = `uniqueness-${c.command.step.toLowerCase()}`;
    }
    if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 'tyrant-actual-terminal-dose' : outcome.promoted ? 'tyrant-actual-promotion' : 'tyrant-first-failed-dose';
    if (c.type === 'CHALLENGE') key = `challenge-${c.command.type.toLowerCase()}`;
    if (c.type === 'EPILOGUE') key = `epilogue-${c.command.type.toLowerCase()}`;
  }
  if (outcome.status !== 'ACTIVE') key = `${intent.type.toLowerCase()}-actual-terminal`;
  return key && !previous.some(b => b.kind === key) ? key : null;
}
export function verifyCheckpoint(payload, freeze, initialStateSha256, inputFreeze) {
  assert.equal(payload.format, FORMAT); assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.prefixSha256, PREFIX_SHA256); assert.equal(payload.runtimeFreezeSha256, freeze.sha256);
  assert.equal(payload.inputFreezeSha256, inputFreeze.sha256); assert.deepEqual(payload.policyDefinition, POLICY);
  assert.equal(payload.initialStateSha256, initialStateSha256); assert.equal(payload.migration.originalStateSha256, SOURCE_STATE_SHA256);
  assert.equal(payload.migration.migratedStateSha256, initialStateSha256);
  assert.equal(payload.migration.fromSchema, 190); assert.equal(payload.migration.toSchema, 212);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  for (const key of ['initialGlobalPublicSha256','globalPublicStateSha256']) assert(/^[a-f0-9]{64}$/.test(payload[key] ?? ''), `Missing or invalid ${key}`);
  let state = initialStateSha256, publicHash = payload.initialPublicSha256, globalPublicHash = payload.initialGlobalPublicSha256, randomHash = payload.initialRandomSha256, policyHash = stateHash(startingPolicy());
  const selected = [];
  for (const [index,row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    for (const key of ['globalPublicBeforeSha256','globalPublicAfterSha256']) assert(/^[a-f0-9]{64}$/.test(row[key] ?? ''), `Missing or invalid ${key}`);
    assert(['TYRANT','THUNDER_GOD','ACTION','EVENT_CHOICE'].includes(row.intent.type)); assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, state);
    assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalPublicHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    assert.deepEqual(Object.keys(row.selectionOutcome).sort(), ['guidance','promoted','s1Reflected','sequence','status']);
    assert([0,1,2].includes(row.selectionOutcome.sequence));
    assert.equal(typeof row.selectionOutcome.guidance, 'boolean'); assert.equal(typeof row.selectionOutcome.s1Reflected, 'boolean');
    assert.equal(typeof row.selectionOutcome.promoted, 'boolean'); assert.equal(typeof row.selectionOutcome.status, 'string');
    assert.equal(row.revision, row.commandCount + 1);
    assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
    assert(Number.isSafeInteger(row.capture.bytes) && row.capture.bytes > 0); assert(/^[a-f0-9]{64}$/.test(row.capture.sha256));
    const kind = selectedBoundary(row.intent, row.selectionOutcome, selected);
    if (kind) selected.push({ kind, commandCount: row.commandCount });
    state = row.afterStateSha256; publicHash = row.publicAfterSha256; globalPublicHash = row.globalPublicAfterSha256; randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(state, payload.finalStateSha256); assert.equal(publicHash, payload.publicStateSha256); assert.equal(globalPublicHash, payload.globalPublicStateSha256); assert.equal(randomHash, stateHash(payload.state.random)); assert.equal(policyHash, stateHash(payload.policy));
  assert(Number.isSafeInteger(payload.policy.s1Doses) && payload.policy.s1Doses >= 0);
  assert(/^thunder-god-potion-\d+$/.test(payload.policy.s1SourceBottleId));
  assert.equal(payload.policy.week, payload.state.week); assert(Number.isInteger(payload.policy.doses) && payload.policy.doses >= 0 && payload.policy.doses <= POLICY.carrierLimit);
  assert(payload.policy.carriers.length <= POLICY.carrierLimit); assert.equal(new Set(payload.policy.carriers).size, payload.policy.carriers.length);
  assert(payload.policy.epilogueAttempted.every(type => ['DIVERT_WATER','RELEASE_ENERGY'].includes(type)));
  assert.equal(new Set(payload.policy.epilogueAttempted).size, payload.policy.epilogueAttempted.length);
  assert.deepEqual(payload.boundaries.map(({ kind,commandCount }) => ({ kind,commandCount })), selected, 'Selected evidence must rederive from actual public outcomes');
  assert(payload.boundaries.length <= POLICY.selectedBoundaryLimit); assert.equal(new Set(payload.boundaries.map(b => b.kind)).size, payload.boundaries.length);
  for (const boundary of payload.boundaries) {
    const row = payload.rows[boundary.commandCount - PREFIX_COUNT - 1];
    assert.deepEqual({ file: boundary.file, bytes: boundary.bytes, sha256: boundary.sha256 }, row.capture);
  }
  if (payload.pending) {
    assert.equal(payload.pending.commandCount, payload.commandCount + 1); assert.equal(payload.pending.beforeStateSha256, payload.finalStateSha256);
    assert.equal(payload.pending.publicBeforeSha256, payload.publicStateSha256); assert.equal(payload.pending.globalPublicBeforeSha256, payload.globalPublicStateSha256); assert.equal(payload.pending.policyBeforeSha256, stateHash(payload.policy));
    assert.equal(payload.pending.randomBeforeSha256, stateHash(payload.state.random));
    assert.deepEqual(payload.pending.intent, payload.pending.decision.action.intent);
  }
}
/** Every actual action retains complete private, RNG, chapter-public and
 * whole-public boundaries. Selected SQLite samples refer to these same bytes. */
export function verifyActionCapture(content, row) {
  assert.equal(content.commandCount, row.commandCount); assert.deepEqual(content.lastIntent, row.intent);
  assert.equal(stateHash(content.beforeLast), row.beforeStateSha256); assert.equal(stateHash(content.final), row.afterStateSha256);
  assert.equal(stateHash(content.publicBefore), row.publicBeforeSha256); assert.equal(stateHash(content.public), row.publicAfterSha256);
  assert.equal(stateHash(content.globalPublicBefore), row.globalPublicBeforeSha256); assert.equal(stateHash(content.globalPublic), row.globalPublicAfterSha256);
  assert.deepEqual(content.randomBefore, row.randomBefore); assert.deepEqual(content.randomAfter, row.randomAfter);
  assert.deepEqual(content.beforeLast.random, content.randomBefore); assert.deepEqual(content.final.random, content.randomAfter);
  assertGlobalPublic(content.globalPublicBefore, content.beforeLast); assertGlobalPublic(content.globalPublic, content.final);
  assert.deepEqual(capturePublic(content.globalPublicBefore), content.publicBefore); assert.deepEqual(capturePublic(content.globalPublic), content.public);
  assert.deepEqual(selectionOutcome(content.public), row.selectionOutcome);
  assert.equal(stateHash(content.policyBefore), row.policyBeforeSha256); assert.equal(stateHash(content.policyAfter), row.policyAfterSha256);
  const decision = chooseAction(content.publicBefore, content.policyBefore);
  assert(!decision.stop, 'Retained action was not selected by the frozen public policy');
  assert(publicActionStillAvailable(content.publicBefore, decision.action), 'Retained action was not an exact enabled public control');
  assert.deepEqual(decision.action.intent, content.lastIntent); assert.equal(decision.reason, row.reason);
  assert.equal(decision.action.label, row.publicLabel); assert.equal(decision.action.cost, row.publicCost);
  assert.deepEqual(advancePolicy(decision, content.public, content.publicBefore), content.policyAfter);
  const { capture: _capture, ...audit } = row;
  assert.deepEqual(content.audit, { ...audit, elapsedMilliseconds: null });
}
export function retainActionCapture(directory, content) {
  const file = `action-${content.commandCount}.json.gz`, path = join(directory, file), candidate = `${path}.next`;
  if (existsSync(path)) {
    assert(!existsSync(candidate), 'Preserve the unexpected extra actual action successor for review');
    assert.deepEqual(readCapture(path), content, 'Existing actual action differs from the exact resumed draft');
  }
  else {
    if (existsSync(candidate)) {
      let recovered, decoded = false;
      try { recovered = readCapture(candidate); decoded = true; }
      catch {
        assert(!existsSync(`${path}.incomplete`), 'Preserve both incomplete action captures for review');
        renameSync(candidate, `${path}.incomplete`); syncDirectory(directory);
      }
      if (decoded) assert.deepEqual(recovered, content, 'Unknown actual action successor; preserve it without rerolling');
    }
    if (!existsSync(candidate)) durableCreate(candidate, gzipSync(JSON.stringify(content), { level: 6 }));
    renameSync(candidate, path); syncDirectory(directory);
  }
  return { file, ...fileEvidence(path) };
}
export function parseOptions(args) {
  const result = { out: null, resume: null, maxNewActions: POLICY.defaultObservationActions, stopAfterCommand: null, pauseFlag: null }, seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index], value = args[++index]; assert(value !== undefined, `Missing value for ${flag}`);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--out') result.out = resolve(value);
    else if (flag === '--resume') result.resume = resolve(value);
    else if (flag === '--pause-flag') result.pauseFlag = resolve(value);
    else if (flag === '--max-new-actions' || flag === '--stop-after-command') {
      assert(/^\d+$/.test(value)); const number = Number(value); assert(Number.isSafeInteger(number));
      if (flag === '--max-new-actions') result.maxNewActions = number;
      else { assert(number >= PREFIX_COUNT, 'A stop boundary cannot precede living701'); result.stopAfterCommand = number; }
    } else throw Error(`Unsupported ${flag}: no source, seed, roll, strategy, resources or outcome overrides`);
  }
  if (result.resume) { assert(!result.out || result.out === dirname(result.resume), 'Resume retains its exact output directory'); result.out = dirname(result.resume); }
  return result;
}
export function readCapture(path) {
  const bytes = readFileSync(path); return JSON.parse(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
}
export function publicActionStillAvailable(view, action) {
  const intent = action.intent;
  if (intent.type === 'TYRANT' || intent.type === 'THUNDER_GOD') {
    const actions = intent.type === 'TYRANT' ? view.tyrant.actions : view.thunderGod.actions;
    return actions.some(a => a.enabled && isDeepStrictEqual(a.command, intent.command) && isDeepStrictEqual(actionOf(a, intent.type), action));
  }
  if (intent.type === 'ACTION') {
    const offered = ordinaryAction(view, 'Public control verification');
    return !view.tyrant.guidanceKnown && !view.activeEvent && !!offered.action && isDeepStrictEqual(offered.action, action);
  }
  if (intent.type === 'EVENT_CHOICE') {
    const event = view.activeEvent, choice = event?.choices.find(a => a.id === intent.choiceId && a.enabled);
    return !view.tyrant.guidanceKnown && event?.instanceId === intent.eventInstanceId && !!choice &&
      isDeepStrictEqual({ ...clone(choice), cost: choice.cost ?? '实际事件费用', intent: clone(intent) }, action);
  }
  return false;
}
function actualReceipts(next, before) {
  const latest = next.tyrant.journal.at(-1);
  if (latest?.revision === next.revision) return { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) };
  const acquisition = next.thunderGod.acquisitionJournal.slice(before.thunderGod.acquisitionJournal.length);
  const life = next.thunderGod.life.journal.slice(before.thunderGod.life.journal.length);
  return { checks: clone([...acquisition,...life].filter(r => r.check).map(r => r.check)),
    acquisition: clone(acquisition), life: clone(life), finance: [], notes: clone(next.chronicle.slice(before.chronicle.length)) };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert(options.resume, 'Cooldown V2 is only an exact835 continuation; creating a new701 run is forbidden');
  assert.equal(resolve(root, 'scripts/play/tyrant-stage-cooldown-v2.mjs'), SELF, 'Run from the matching reviewed frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, { files: [...freeze.files,...old.inputFreeze.files] });
  const runtime = await loadRuntime(root), initial = migrate(runtime, old.source), initialHash = stateHash(initial);
  const initialGlobal = runtime.projectSliceState(initial); assertGlobalPublic(initialGlobal, initial); const initialView = capturePublic(initialGlobal);
  if (!options.out) { mkdirSync(join(root, 'output/play'), { recursive: true }); options.out = mkdtempSync(join(root, 'output/play/tyrant-02150-new215-')); }
  for (const name of ['src','dist','scripts','tests','test-inputs','docs','node_modules','.git']) {
    const protectedPath = join(root, name); assert(options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output cannot modify frozen inputs or repository metadata');
  }
  assert.notEqual(options.out, root); mkdirSync(options.out, { recursive: true });
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json.gz'), freezePath = join(options.out, 'runtime-freeze.json'), inputPath = join(options.out, 'input-freeze.json');
  const originals = ['archived-original701.json.gz','archived-original193-natural.json.gz'];
  const initialCapture = { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: initialHash,
    publicSha256: stateHash(initialView), globalPublicSha256: stateHash(initialGlobal),
    final: initial, random: initial.random, public: initialView, globalPublic: initialGlobal };
  assert.equal(dirname(checkpointPath), options.out);
  let saved, session = null, stage = null, reason = null, count = 0, pauseRequested = false;
  const requestPause = () => { pauseRequested = true; };
  options.pauseFlag ??= join(options.out, 'PAUSE');
  if (options.resume) {
    assert.deepEqual(readCapture(freezePath), freeze, 'Frozen runtime/producer drift; never resume with changed rules');
    assert.deepEqual(readCapture(inputPath), old.inputFreeze, 'Frozen historical inputs drifted');
    for (const [index,file] of originals.entries()) assert.equal(sha(gunzipSync(readFileSync(join(options.out, file)))), INPUTS[index].sha256, 'Retained original evidence changed');
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath)); verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze);
    verify835Continuation(options.out, saved.payload, freeze);
    if (saved.payload.terminal) ({ stage, reason } = saved.payload.terminal);
  } else {
    assert.equal(readdirSync(options.out).length, 0, 'Refuse to overwrite an existing capture; use exact --resume');
    const globalView = initialGlobal, view = initialView;
    durableCreate(freezePath, JSON.stringify(freeze)); durableCreate(inputPath, JSON.stringify(old.inputFreeze)); durableCreate(join(options.out, 'producer.mjs'), readFileSync(SELF));
    for (const [index,file] of originals.entries()) durableCreate(join(options.out, file), gzipSync(old.buffers[index], { level: 6 }));
    durableCreate(join(options.out, 'migration-initial.json.gz'), gzipSync(JSON.stringify(initialCapture), { level: 6 })); syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
      inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
      migration: { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: initialHash, fromSchema: 190, toSchema: 212 },
      createdAt: new Date().toISOString(), commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
      initialStateSha256: initialHash, finalStateSha256: initialHash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
      initialGlobalPublicSha256: stateHash(globalView), globalPublicStateSha256: stateHash(globalView), initialRandomSha256: stateHash(initial.random), pending: null, terminal: null }, null);
  }
  process.on('SIGINT', requestPause); process.on('SIGTERM', requestPause);
  try {
    assert.equal(saved.payload.initialPublicSha256, stateHash(initialView), 'Original current-chapter public hash changed');
    assert.equal(saved.payload.initialGlobalPublicSha256, stateHash(initialGlobal), 'Original whole-public hash changed');
    assert.deepEqual(readCapture(join(options.out, 'migration-initial.json.gz')), initialCapture, 'Retained migrated initial/public boundary changed');
    if (saved.payload.state.tyrant.guidanceKnown) session = runtime.openTyrantRuntimeSession(saved.payload.state);
    const projectGlobal = () => { const projection = session ? session.project() : runtime.projectSliceState(saved.payload.state); assertGlobalPublic(projection, saved.payload.state); return projection; };
    const project = () => capturePublic(projectGlobal()), reopened = projectGlobal();
    assert.equal(stateHash(capturePublic(reopened)), saved.payload.publicStateSha256, 'Reopened current-chapter public boundary changed');
    assert.equal(stateHash(reopened), saved.payload.globalPublicStateSha256, 'Reopened whole public boundary changed');
    for (const row of saved.payload.rows) {
      assert.deepEqual(fileEvidence(join(options.out, row.capture.file)), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
      verifyActionCapture(readCapture(join(options.out, row.capture.file)), row);
    }
    for (const boundary of saved.payload.boundaries) assert.deepEqual(fileEvidence(join(options.out, boundary.file)), { bytes: boundary.bytes, sha256: boundary.sha256 });
    while (!stage) {
      await new Promise(resolve => setImmediate(resolve));
      unchanged(stamps); const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual runtime status ${boundary.state.status}`; break; }
      if (!boundary.pending && (pauseRequested || existsSync(options.pauseFlag) || count >= options.maxNewActions || options.stopAfterCommand !== null && boundary.commandCount >= options.stopAfterCommand)) {
        stage = 'MANUAL_PAUSE'; reason = 'Paused at the requested durable completed-action boundary; resume the exact frozen policy'; break;
      }
      if (boundary.policy.loop.repetitions >= 3) { stage = 'PUBLIC_NO_PROGRESS_DIAGNOSTIC'; reason = 'Three accepted actions left the meaningful public boundary unchanged; retain the actual state for review'; break; }
      let pending = boundary.pending;
      if (!pending) {
        const globalView = projectGlobal(), view = capturePublic(globalView), decision = chooseAction(view, boundary.policy);
        if (decision.stop) { stage = decision.stop; reason = decision.reason; break; }
        assert(publicActionStillAvailable(view, decision.action), 'Selection must be an exact enabled public button');
        pending = { commandCount: boundary.commandCount + 1, intent: clone(decision.action.intent), decision,
          beforeStateSha256: boundary.finalStateSha256, publicBeforeSha256: stateHash(view), globalPublicBeforeSha256: stateHash(globalView),
          randomBeforeSha256: stateHash(boundary.state.random), policyBeforeSha256: stateHash(boundary.policy), startedAt: new Date().toISOString() };
        saved = saveCheckpoint(checkpointPath, { ...boundary, pending }, saved.sha256);
      }
      const beforeGlobal = projectGlobal(), beforeView = capturePublic(beforeGlobal); assert(publicActionStillAvailable(beforeView, pending.decision.action), 'Pending exact button is no longer enabled');
      assert.equal(stateHash(beforeView), pending.publicBeforeSha256); assert.equal(stateHash(beforeGlobal), pending.globalPublicBeforeSha256);
      assert.equal(stateHash(saved.payload.state.random), pending.randomBeforeSha256);
      assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision, 'Retain the exact pending frozen policy choice');
      const before = saved.payload.state, started = performance.now(); let draft = null, next, globalAfter;
      if (session) { draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); globalAfter = session.projectDraft(draft); }
      else {
        next = runtime.applySliceIntent(before, pending.intent);
        if (next.tyrant.guidanceKnown) session = runtime.openTyrantRuntimeSession(next);
        globalAfter = session ? session.project() : runtime.projectSliceState(next);
      }
      assertGlobalPublic(globalAfter, next); const after = capturePublic(globalAfter);
      assert.equal(next.revision, before.revision + 1); checkOriginals(next, old.source, before);
      const policy = advancePolicy(pending.decision, after, beforeView);
      const row = { commandCount: pending.commandCount, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
        reason: pending.decision.reason, publicLabel: pending.decision.action.label, publicCost: pending.decision.action.cost,
        startedAt: pending.startedAt, elapsedMilliseconds: Math.round(performance.now() - started), revision: next.revision, week: next.week,
        beforeStateSha256: pending.beforeStateSha256, afterStateSha256: stateHash(next), publicBeforeSha256: pending.publicBeforeSha256, publicAfterSha256: stateHash(after),
        globalPublicBeforeSha256: pending.globalPublicBeforeSha256, globalPublicAfterSha256: stateHash(globalAfter), selectionOutcome: selectionOutcome(after), randomBefore: clone(before.random), randomAfter: clone(next.random), randomBeforeSha256: stateHash(before.random), randomAfterSha256: stateHash(next.random),
        policyBeforeSha256: pending.policyBeforeSha256, policyAfterSha256: stateHash(policy), receipts: actualReceipts(next, before) };
      const selected = selectedBoundary(pending.intent, after, saved.payload.boundaries), boundaries = [...saved.payload.boundaries];
      const content = { commandCount: pending.commandCount, beforeLast: before, lastIntent: pending.intent, final: next,
        randomBefore: row.randomBefore, randomAfter: row.randomAfter, publicBefore: beforeView, public: after,
        globalPublicBefore: beforeGlobal, globalPublic: globalAfter, policyBefore: clone(saved.payload.policy), policyAfter: clone(policy),
        audit: { ...row, elapsedMilliseconds: null } };
      row.capture = retainActionCapture(options.out, content); verifyActionCapture(content, row);
      if (selected) boundaries.push({ ...row.capture, kind: selected, commandCount: pending.commandCount });
      saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256, globalPublicStateSha256: row.globalPublicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands,pending.intent], rows: [...saved.payload.rows,row], boundaries, policy, pending: null }, saved.sha256);
      if (draft) session.commit(draft); count++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: pending.decision.action.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen runtime bytes changed during capture'); assert.deepEqual(readSource(root).inputFreeze, old.inputFreeze);
    verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze); verify835Continuation(options.out, saved.payload, freeze); runtime.assertValidSliceState(saved.payload.state);
    if (saved.payload.state.tyrant.guidanceKnown) {
      const strict = runtime.openTyrantRuntimeSession(saved.payload.state); assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256);
      const strictGlobal = strict.project(); assertGlobalPublic(strictGlobal, saved.payload.state);
      assert.equal(stateHash(capturePublic(strictGlobal)), saved.payload.publicStateSha256); assert.equal(stateHash(strictGlobal), saved.payload.globalPublicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE', diagnostic = stage.startsWith('PUBLIC_');
    if (!paused && !diagnostic && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson.gz'), gzipSync(saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''), { level: 6 }));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json.gz'), gzipSync(JSON.stringify({ provenance: { kind: 'NEW215_FROM_RESTORED193_LIVING701_PUBLIC_TYRANT_CONTINUATION',
      format: 'NEW215_REBUILD_PROVENANCE_COOLDOWN_V2', continuation835: saved.payload.continuation835, lostOriginal215Restored: false, rebuiltFromRestoredVolume193: true,
      source: SOURCE, sourceSha256: SOURCE_SHA256, sourceRoot: 'final', originalStateSha256: SOURCE_STATE_SHA256, originalEvidence: originals,
      prefixCommandsSha256: PREFIX_SHA256, inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256,
      historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, completeOriginalSourceRetainedExactly: true, alternateSourceUsed: false,
      privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false, selectedFromEnabledPublicActionsOnly: true,
      everyActionEvidence: 'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
      selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER', globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'POSITIVE_S1_THEN_TYRANT_AND_ORDINARY_PUBLIC_DASHBOARD' },
      creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT, commands: [...old.commands,...saved.payload.commands],
      policy: POLICY, stage, reason, pendingIntent: saved.payload.pending?.intent ?? null, boundaries: saved.payload.boundaries, final: saved.payload.state }), { level: 6 }));
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount, originalCommands: PREFIX_COUNT,
      newCommands: saved.payload.commands.length, rebuild: 'NEW215', lostOriginal215Restored: false, controlledStop: stage === 'MANUAL_PAUSE', week: saved.payload.policy.week, paused, diagnostic, strictFinalValidation: true,
      continuation835: saved.payload.continuation835, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: view }));
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic };
  } catch (error) {
    try { replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error), commandCount: saved?.payload.commandCount ?? null, resumeExactPendingRequired: true, at: new Date().toISOString() })); }
    catch { /* Keep the first error, exact pending command and every durable boundary. */ }
    throw error;
  } finally { process.off('SIGINT', requestPause); process.off('SIGTERM', requestPause); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
