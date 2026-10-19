import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

/** Independent explicitly authorized branch at original command918, before original DECLARE919.
 * Only public projection/actions enter chooseAction. No seed/options/outcome search.
 * Original983 is sealed separately and never replaced or relabeled a success.
 */
export const SOURCE = 'tests/fixtures/conqueror-v01870/natural.json';
export const SOURCE_SHA256 = '469a6ac77052f92ac0dbd8e6ea39164592de6b4c8d8ea0405b080c1a015f7973';
export const ORIGINAL_PREFIX_SHA256 = '88211e592c4714058c3e8b45eab02fa0f0ae73b35c2526288503329ec1d52f2e';
export const PREFIX_SHA256 = ORIGINAL_PREFIX_SHA256;
export const PREFIX_COUNT = 795;
export const FORK_COUNT = 918;
const FORMAT = 'RED_PRIEST_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
const SELF = fileURLToPath(import.meta.url);
export const POLICY = Object.freeze({
  id: 'RED_PRIEST_PREDECLARE918_COORDINATED_FULL_PREPARATION_V1',
  maximumNewCommands: 900, attemptsPerMaterialOperation: 12,
  authorityAttemptsPerPolity: 12, battleAttemptsPerNode: 4, armisticeAttempts: 5,
  maximumSupportCommandsWithoutProgress: 70, maximumUnchangedWeeklyWaits: 4,
  cashBeforeDeclaration: 1600, preparationHealth: 100, preparationMind: 100, preparationSpirituality: 120,
  materialOrder: 'LOCAL_WORK_BEFORE_FIRST_PUBLIC_MATERIAL_DESTINATION',
  warOrder: 'EXPLICIT_PLANNING_OPT_IN_THEN_REAL_RECON_COORDINATED_EXTRA_SUPPLIES_BATTLE_CONSOLIDATE_ACHIEVED_TRUCE',
  plannedStance: 'COORDINATED', extraSupplies: true, minimumPlanningMorale: 60, supplyConvoyThreshold: 40,
  publicBasis: 'Recon+8, six actual extra supply per army+12, coordinated+20 needs three present authorized armies each1000personnel and60morale; choose once before any battle result',
  recovery: 'BOUNDED_ENABLED_CLINIC_REST_WORK_MILITARY_LABOUR_ACTUAL_ARMY_REST_AND_ORIGINAL_STOCK_CONVOYS',
  rescue: 'REAL_RETURN_ROUTE_THEN_COORDINATE_ONCE_THEN_EVACUATE_OR_WITHDRAW_AND_REPORT',
  logisticsRecovery: true, fieldArmyRecovery: true, finiteSupplyRecovery: true, postwarFootReturn: true,
  verifiedPersonnelExit: '现有人员已经不足以完成剩余目标。继续交战不能补回损失，可以真实停战或保护撤离。',
  noReroll: true, snapshots: 'ONE_ROLLING_CHECKPOINT_AND_FINAL_CAPTURE_ONLY',
});
const clone = value => structuredClone(value);
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha = value => createHash('sha256').update(value).digest('hex');
export const stateHash = value => sha(stable(value));
const compactHash = value => sha(JSON.stringify(value));
export function fileEvidence(path) {
  const before = lstatSync(path, { bigint: true });
  assert(before.isFile() && !before.isSymbolicLink(), `Not a frozen regular file: ${path}`);
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(65536);
  let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  assert.equal(before.size, after.size); assert.equal(before.mtimeNs, after.mtimeNs); assert.equal(BigInt(bytes), after.size);
  return { bytes, sha256: hash.digest('hex') };
}
export function inspectFreeze(root = process.cwd()) {
  const files = [];
  const walk = name => {
    const path = join(root, name), stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Frozen input cannot be a symlink: ${name}`);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(name, child));
    else if (stat.isFile()) files.push({ file: name.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync(join(root, 'dist/domain/red-priest/owned-session.js')), 'Build reviewed mechanics before capture; no game was loaded');
  for (const name of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation']) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) }, { file: SOURCE, ...fileEvidence(join(root, SOURCE)) });
  return { sha256: compactHash(files), files };
}
function stampFreeze(root, freeze) {
  return freeze.files.map(file => {
    const path = file.file === '$natural-producer' ? SELF : join(root, file.file), stat = lstatSync(path, { bigint: true });
    return { path, size: stat.size, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs, ino: stat.ino };
  });
}
function unchangedSinceFreeze(stamps) {
  for (const before of stamps) {
    const after = lstatSync(before.path, { bigint: true });
    assert(after.isFile() && !after.isSymbolicLink(), `Frozen input replaced: ${before.path}`);
    for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], `Frozen input changed: ${before.path}`);
  }
}
export function readSource(root = process.cwd()) {
  const path = join(root, SOURCE), bytes = readFileSync(path);
  assert.equal(sha(bytes), SOURCE_SHA256, 'Original natural capture bytes have changed; do not regenerate/replace them');
  const old = JSON.parse(bytes), s = old.final;
  assert.equal(old.commands.length, PREFIX_COUNT); assert.equal(compactHash(old.commands), PREFIX_SHA256);
  assert.equal(old.seed, 'hunter-rebuild-first'); assert.equal(s.runId, 'hunter-rebuild-natural');
  assert.equal(s.schemaVersion, 184); assert.equal(s.contentVersion, 'conqueror-v184');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 796); assert.equal(s.week, 200);
  assert.deepEqual([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining], [80, 100, 120, 536, 3]);
  assert.deepEqual(s.random, { seed: old.seed, cursor: 376 });
  assert.equal(s.progression.pathwayId, 'hunter'); assert.equal(s.progression.sequence, 1); assert.equal(s.progression.acting, 100);
  assert.equal(Object.keys(s.progression.mastery).length, 23); assert.equal(Object.values(s.progression.mastery).filter(n => n === 0).length, 6);
  assert.equal(s.injuries.length, 2); assert(s.injuries.every(i => i.severity === 'LIGHT'));
  assert.deepEqual(s.conqueror.bottles.map(b => [b.id, b.status, b.outcome]), [
    ['conqueror-potion-1', 'CONSUMED', 'FAILURE'], ['conqueror-potion-2', 'CONSUMED', 'FAILURE'], ['conqueror-potion-3', 'CONSUMED', 'SUCCESS'],
  ]);
  assert.equal(s.combat, null); assert.equal(s.activeEvent, null);
  return Object.fromEntries(['provenance', 'creation', 'seed', 'commands', 'initial', 'final'].map(key => [key, old[key]]));
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index', 'domain/slice/migration', 'domain/red-priest/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openRedPriestRuntimeSession: session.openRedPriestRuntimeSession };
}
function verifyMigration(runtime, raw) {
  const current = runtime.migrateSliceState(raw);
  assert.equal(current.contentVersion, 'red-priest-v206'); assert.equal(current.schemaVersion, 206);
  for (const [key, value] of Object.entries(raw)) {
    if (['schemaVersion', 'contentVersion', 'fool', 'redPriest'].includes(key)) continue;
    assert.deepEqual(current[key], value, `Migration changed original ${key}`);
  }
  runtime.assertValidSliceState(current); return current;
}
function checkOriginals(state, old) {
  assert.equal(state.runId, old.final.runId); assert.equal(state.random.seed, old.seed);
  assert(state.random.cursor >= old.final.random.cursor);
  for (const key of ['hunter', 'provoker', 'pyromaniac', 'conspirator', 'reaper', 'ironBloodKnight', 'warBishop', 'weatherWarlock', 'conqueror', 'combatHistory', 'world'])
    assert.deepEqual(state[key], old.final[key], `Original ${key} must not change`);
  const { coreStats: _now, ...identity } = state.character, { coreStats: _then, ...original } = old.final.character;
  assert.deepEqual(identity, original);
  for (const [id, value] of Object.entries(old.final.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  if (state.redPriest?.source) {
    const source = state.redPriest.source, raw = old.final;
    assert.equal(source.revision, raw.revision); assert.deepEqual(source.random, raw.random); assert.deepEqual(source.character, raw.character);
    assert.deepEqual(source.finance, Object.fromEntries(['weeklyBudget', 'wagePaidWeek', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit'].map(key => [key, raw[key]])));
    assert.deepEqual(source.budget, { week: raw.week, date: raw.date, actions: raw.actionsRemaining, cash: raw.cash,
      health: raw.health, mind: raw.mind, spirituality: raw.spirituality, pollution: raw.seer.pollution,
      injuries: raw.injuries, injuryRisk: raw.injuryRisk, status: raw.status, sequence: raw.progression.sequence,
      acting: raw.progression.acting, mastery: raw.progression.mastery, coreStats: raw.character.coreStats, completedSources: raw.seer.completedSources });
  }
}
function syncDirectory(path) {
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
}
function durableCreate(path, contents) {
  const fd = openSync(path, 'wx'); try { writeFileSync(fd, contents); fsyncSync(fd); } finally { closeSync(fd); }
}
function encodeCheckpoint(payload) { return JSON.stringify({ sha256: stateHash(payload), payload }); }
function decodeCheckpoint(bytes) {
  const wrapped = JSON.parse(bytes); assert.equal(wrapped.sha256, stateHash(wrapped.payload), 'Checkpoint checksum mismatch');
  assert.equal(wrapped.payload.format, FORMAT); return wrapped;
}
/** A complete next boundary is never thrown away merely because rename was interrupted. */
function recoverAtomicNext(path) {
  const nextPath = `${path}.next`; if (!existsSync(nextPath)) return;
  const current = existsSync(path) ? decodeCheckpoint(readFileSync(path, 'utf8')) : null;
  let next;
  try { next = decodeCheckpoint(readFileSync(nextPath, 'utf8')); }
  catch {
    const retained = `${path}.incomplete`;
    assert(!existsSync(retained), 'A prior incomplete checkpoint already exists; preserve both files and inspect before resuming');
    renameSync(nextPath, retained); syncDirectory(dirname(path)); return;
  }
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unrecognized next checkpoint; preserve files for inspection');
  renameSync(nextPath, path); syncDirectory(dirname(path));
}
function saveCheckpoint(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'A pending atomic replacement must be recovered first');
  const next = { ...payload, predecessorSha256 }, text = encodeCheckpoint(next);
  durableCreate(`${path}.next`, text); renameSync(`${path}.next`, path); syncDirectory(dirname(path));
  return decodeCheckpoint(text);
}
function replaceDerived(path, value) {
  // Derived outputs are only written at a manual/terminal boundary, not per step.
  const temp = `${path}.derived-next`, fd = openSync(temp, 'w');
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path); syncDirectory(dirname(path));
}
const section = (view, id) => view.sections.find(s => s.id === id)?.lines ?? [];
const commandKey = command => JSON.stringify(command);
const nestedType = action => action.command.command?.type;
const injuryCount = view => Number(section(view, 'finance').join(' ').match(/当前伤势(\d+)份/)?.[1] ?? 0);
const cash = view => Number(view.resources.cash.match(/^\d+/)?.[0] ?? 0);
const achievement = view => {
  const match = section(view, 'campaign-status').join(' ').match(/独立胜利(\d+)\/5；交战战区(\d+)\/3；受控战区(\d+)\/3/);
  return match ? { victories: Number(match[1]), engaged: Number(match[2]), controlled: Number(match[3]) } : null;
};
const materialReady = view => section(view, 'materials').filter(line => line.includes('本人持有原件')).length === 3;
const materialUnavailable = view => section(view, 'materials').some(line => line.includes('当前无法取回'));
function startingPolicy() { return { phase: 'GUIDANCE', attempts: {}, supportSinceProgress: 0, unchangedWaits: 0, lastProgress: null, stopAfterWithdrawal: null }; }
function progressSignature(view) {
  return stateHash({ promoted: view.promoted, guidance: view.guidanceKnown,
    materials: section(view, 'materials'), campaign: section(view, 'campaign-status'), epilogue: section(view, 'epilogue'),
    actions: view.actions.filter(a => !['REST', 'WORK', 'CLINIC', 'NEXT_WEEK'].includes(a.command.type))
      .map(a => ({ command: a.command, label: a.label })) });
}
function price(action) {
  const text = action.cost;
  return { actions: Number(text.match(/(\d+)行动/)?.[1] ?? 1), cash: Number(text.match(/(\d+)便士/)?.[1] ?? 0), spirituality: Number(text.match(/(\d+)灵性/)?.[1] ?? 0) };
}
/** This function receives no private state, RNG, checks or outcome receipts. */
export function chooseAction(view, previous, definition = POLICY) {
  const policy = clone(previous), all = view.actions, enabled = all.filter(a => a.enabled);
  const find = type => enabled.find(a => a.command.type === type);
  const campaign = type => all.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === type);
  const choose = (action, reason) => { assert(action?.enabled, 'Policy may select only an enabled public action'); return { action: clone(action), reason, policy }; };
  const stop = (code, reason) => ({ stop: code, reason, policy });
  const count = action => policy.attempts[commandKey(action.command)] ?? 0;
  const support = (reason, need = {}, allowArmyWork = true) => {
    const clinic = find('CLINIC'), work = find('WORK'), rest = find('REST'), wait = find('NEXT_WEEK');
    const armyWork = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'MILITARY_LABOUR');
    const requiredCash = need.cash ?? 0;
    const headquartersReturn = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'RETURN_TO_HEADQUARTERS');
    if (definition.logisticsRecovery && cash(view) < requiredCash && !work && !(allowArmyWork && armyWork) && headquartersReturn)
      return choose(headquartersReturn, 'Return along the real military route to earn legal income; retain war, losses, time and personal debts');
    if (policy.supportSinceProgress >= POLICY.maximumSupportCommandsWithoutProgress || policy.unchangedWaits >= POLICY.maximumUnchangedWeeklyWaits)
      return stop('FINITE_PUBLIC_NO_PROGRESS', `Finite recovery limit reached: ${reason}`);
    if (injuryCount(view) > 0 && clinic) return choose(clinic, `Pay actual treatment before recovery: ${reason}`);
    if (cash(view) < requiredCash) {
      if (work) return choose(work, `Earn the one legal occupational wage this week: ${reason}`);
      if (allowArmyWork && armyWork) return choose(armyWork, `Perform the enabled, treasury-funded weekly military task: ${reason}`);
    }
    if (rest && (injuryCount(view) > 0 || view.resources.health < (need.health ?? 0) || view.resources.mind < (need.mind ?? 0) || view.resources.spirituality < (need.spirituality ?? 0)))
      return choose(rest, `Use ordinary paid-life recovery, preserving actual wounds: ${reason}`);
    if (wait) return choose(wait, `Actually pass seven days and settle costs: ${reason}`);
    return stop('PUBLIC_RECOVERY_UNAVAILABLE', reason);
  };
  const prepare = (reason, need, allowArmyWork = true) => {
    if (cash(view) < (need.cash ?? 0) || view.resources.actionsRemaining < (need.actions ?? 1) || view.resources.health < (need.health ?? 0)
      || view.resources.mind < (need.mind ?? 0) || view.resources.spirituality < (need.spirituality ?? 0) || need.uninjured && injuryCount(view) > 0)
      return support(reason, need, allowArmyWork);
    return null;
  };
  const atFullHealth = { health: POLICY.preparationHealth, mind: POLICY.preparationMind, spirituality: POLICY.preparationSpirituality, uninjured: true };
  const pursue = (action, reason, extra = {}) => {
    const needs = { ...price(action), ...extra };
    const preparation = prepare(reason, needs); if (preparation) return preparation;
    if (action.enabled) return choose(action, reason);
    if (/无法按当前保管线|已经用尽|无法取回|后备.*不足/.test(action.reason ?? '')) return stop('PUBLIC_FINITE_RESOURCE_LOSS', action.reason);
    // Return-route prices are deliberately prose rather than a numeric total.
    // A public insufficient-funds block authorizes seeking actual legal income,
    // never reading the private route cost or repeatedly waiting into debt.
    if (/费用|资源/.test(action.reason ?? '') && cash(view) >= needs.cash) needs.cash = cash(view) + 1;
    return support(`${reason}; public block: ${action.reason ?? 'unavailable'}`, needs);
  };
  const materials = afterWar => {
    if (materialUnavailable(view)) return stop('ORIGINAL_MATERIAL_UNAVAILABLE', 'An original material is publicly unavailable; no replacement, reset or reroll is permitted');
    const local = all.find(a => a.command.type === 'MATERIAL' && nestedType(a) !== 'PREPARE_COMPOUND');
    if (local) {
      if (count(local) >= definition.attemptsPerMaterialOperation) return stop('FINITE_MATERIAL_ATTEMPTS', `Finite attempts exhausted for ${local.label}`);
      return pursue(local, `Complete the current original-material operation at this actual location: ${local.label}`, atFullHealth);
    }
    if (materialReady(view) || all.some(a => a.command.type === 'CONSUME')) return null;
    // Projection order is public; local work always wins, so preferred travel
    // cannot bounce the actor between the two original residue destinations.
    const travel = all.find(a => a.command.type === 'TRAVEL' && a.command.to !== 'loen-headquarters' && a.command.to !== 'backlund:sealed-compounding-room');
    return travel ? pursue(travel, `Follow the first publicly offered remaining material lead: ${travel.label}`)
      : stop(afterWar ? 'NO_RECOVERABLE_MATERIAL_ROUTE' : 'NO_PUBLIC_MATERIAL_ROUTE', 'No public route to the remaining original materials is available');
  };
  for (let transitions = 0; transitions < 8; transitions++) {
    if (policy.phase === 'WITHDRAWN_PERSONNEL') {
      const ended = section(view, 'campaign-status').includes('战事已停，原有损失和经历继续保留。') && !campaign('WITHDRAW_PROTECT');
      return stop(ended ? 'FINITE_CAMPAIGN_WITHDRAWN' : 'FINITE_CAMPAIGN_REVIEW_REQUIRED', ended
        ? 'Executed the real protective withdrawal after the exact public warning that remaining personnel cannot complete the remaining objectives; all losses and costs remain'
        : 'The selected protective withdrawal did not publicly confirm a stopped war; preserve the actual result for review');
    }
    if (policy.stopAfterWithdrawal) {
      if (definition.logisticsRecovery) return stop('FINITE_CAMPAIGN_REVIEW_REQUIRED', policy.stopAfterWithdrawal);
      const withdrawal = campaign('WITHDRAW_PROTECT');
      if (withdrawal) return pursue(withdrawal, `End the actual failed campaign by its ordinary route: ${policy.stopAfterWithdrawal}`);
      return stop('FINITE_CAMPAIGN_WITHDRAWN', policy.stopAfterWithdrawal);
    }
    if (view.promoted) policy.phase = 'RESCUE';
    if (policy.phase === 'GUIDANCE') {
      if (view.guidanceKnown) { policy.phase = 'MATERIALS'; continue; }
      const action = find('LEARN_GUIDANCE'); return action ? choose(action, 'Learn guidance publicly from the exact migrated living original') : stop('GUIDANCE_UNAVAILABLE', 'Original public guidance is unavailable');
    }
    if (policy.phase === 'MATERIALS') {
      const preparation = prepare('Heal the original light wounds before material investigation', { ...atFullHealth, actions: 1 });
      if (preparation) return preparation;
      const next = materials(false); if (next) return next;
      policy.phase = 'FUND_WAR'; continue;
    }
    if (policy.phase === 'FUND_WAR') {
      const preparation = prepare('Accumulate a finite personal campaign reserve through actual weekly wages', { ...atFullHealth, actions: 1, cash: POLICY.cashBeforeDeclaration }, false);
      if (preparation) return preparation;
      const home = all.find(a => a.command.type === 'TRAVEL' && a.command.to === 'loen-headquarters');
      if (home) return pursue(home, 'Personally return to the coalition headquarters before requesting authority');
      policy.phase = 'WAR'; continue;
    }
    if (policy.phase === 'WAR') {
      const enablePlanning = campaign('ENABLE_PLANNING');
      if (enablePlanning) return pursue(enablePlanning, 'Explicitly enable the authorized planning rules before declaration; preserve the entire original predeclaration state', { actions: 0 });
      if (definition.verifiedPersonnelExit && section(view, 'campaign-readiness').includes(definition.verifiedPersonnelExit)) {
        const withdrawal = campaign('WITHDRAW_PROTECT');
        if (withdrawal?.enabled) {
          policy.phase = 'WITHDRAWN_PERSONNEL';
          return choose(withdrawal, 'The exact public readiness warning confirms insufficient remaining original personnel for the remaining objectives; execute the approved real protective withdrawal');
        }
        return withdrawal ? support('Obtain the real action needed for the publicly justified protective withdrawal', { actions: 1 })
          : stop('FINITE_CAMPAIGN_REVIEW_REQUIRED', 'Public personnel exhaustion has no enabled protective withdrawal route');
      }
      if (/将两份外在原特性/.test(view.nextStep)) { policy.phase = 'POSTWAR'; continue; }
      const authority = campaign('REQUEST_AUTHORITY');
      if (authority) {
        if (count(authority) >= definition.authorityAttemptsPerPolity) return stop('FINITE_AUTHORITY_ATTEMPTS', 'Actual coalition permission was not obtained within the finite public policy');
        return pursue(authority, `Obtain this polity's actual coalition authority: ${authority.label}`, atFullHealth);
      }
      const declaration = campaign('DECLARE_OFFENSIVE');
      if (declaration) return pursue(declaration, 'Issue the actual offensive only after the three public authorizations',
        definition.logisticsRecovery ? { ...atFullHealth, cash: POLICY.cashBeforeDeclaration } : atFullHealth);
      const achieved = achievement(view), truce = campaign('SEEK_ARMISTICE');
      if (truce && achieved && achieved.victories >= 5 && achieved.engaged === 3 && achieved.controlled === 3 && /完整经历/.test(view.nextStep)) {
        if (count(truce) >= POLICY.armisticeAttempts) { policy.stopAfterWithdrawal = 'Actual truce was refused within the finite negotiation policy'; continue; }
        return pursue(truce, 'Negotiate actual truce after the publicly recorded five victories and three controlled theaters');
      }
      const legionNeeds = section(view, 'campaign-losses').flatMap(line => {
        const match = line.match(/^(.+)：现员(\d+)，阵亡\d+，伤员\d+，补给(\d+)，士气(\d+)/);
        return match ? [{ name: match[1], personnel: Number(match[2]), supply: Number(match[3]), morale: Number(match[4]) }] : [];
      });
      const depletedSupply = legionNeeds.filter(l => l.supply < POLICY.supplyConvoyThreshold);
      if (definition.finiteSupplyRecovery && depletedSupply.length) {
        const forDepleted = a => depletedSupply.some(l => a.label.includes(l.name.slice(0, 2)));
        const reinforcement = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE' && forDepleted(a) && legionNeeds.some(l => l.personnel < 1200 && a.label.includes(l.name.slice(0, 2))));
        const supplies = all.filter(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'SUPPLY_ONLY' && forDepleted(a));
        const supply = supplies.find(a => a.enabled);
        if (!reinforcement && supply) return choose(supply, 'Pay the actual finite supply convoy when the original manpower reserve cannot reinforce this publicly undersupplied army');
        if (!reinforcement && supplies.some(a => /仍在途中/.test(a.reason ?? '')))
          return support('Wait for the actual already-dispatched original-supply convoy');
        const resourceBlockedSupply = supplies.find(a => /行动|费用|灵性/.test(a.reason ?? ''));
        if (!reinforcement && resourceBlockedSupply) return pursue(resourceBlockedSupply, 'Earn or recover the actual personal resources for the finite original-supply convoy');
      }
      if (definition.fieldArmyRecovery && legionNeeds.some(l => l.morale < POLICY.minimumPlanningMorale)) {
        const armyRest = campaign('REST_FIELD_ARMIES'), returnHome = campaign('RETURN_TO_HEADQUARTERS');
        if (armyRest?.enabled) return choose(armyRest, 'Pay the actual headquarters rest costs to recover original-army morale; preserve all casualties, reserves and battle attempts');
        if (returnHome?.enabled) return choose(returnHome, 'Return the same original armies along the real route for headquarters rest; retain the active war and all losses');
        if (/行动/.test(armyRest?.reason ?? returnHome?.reason ?? '')) return support('Actually pass time for the headquarters rest action', { actions: 1 });
        return stop('PUBLIC_FIELD_ARMY_RECOVERY_UNAVAILABLE', armyRest?.reason ?? 'No enabled actual route or headquarters rest is available for the exhausted original armies');
      }
      const depleted = legionNeeds.filter(l => l.personnel < 1200 || l.supply < 20 || l.morale < 50);
      if (depleted.length) {
        const reinforcement = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE' && depleted.some(l => a.label.includes(l.name.slice(0, 2))));
        if (reinforcement) return pursue(reinforcement, 'Request real finite reserves for a publicly depleted legion');
      }
      const consolidation = campaign('CONSOLIDATE'), battle = campaign('PREPARED_BATTLE'), march = campaign('MARCH');
      if (definition.logisticsRecovery && march && /本人在鲁恩联合协商处；原军团在鲁恩联合协商处/.test(section(view, 'campaign-status')[0] ?? '')) {
        const reserve = prepare('Earn the existing 1600-penny operating reserve before leaving headquarters again',
          { ...atFullHealth, actions: 1, cash: POLICY.cashBeforeDeclaration }, false);
        if (reserve) return reserve;
      }
      if (consolidation?.enabled) return pursue(consolidation, 'Consolidate the genuinely won local transport objective');
      if (battle && !/已经获胜/.test(battle.reason ?? '')) {
        const target = battle.command.command.nodeId;
        if (count(battle) >= POLICY.battleAttemptsPerNode) return stop('FINITE_PLANNED_BATTLE_ATTEMPTS', 'Four genuine prepared attempts at this objective are exhausted; retain every loss');
        const prepared = prepare('Recover the real body before this planned encounter', { health: 90, mind: 90, spirituality: 30, uninjured: true, actions: 1 });
        if (prepared) return prepared;
        const recon = all.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'RECONNOITRE' && a.command.command.nodeId === target);
        if (!section(view, 'campaign-planning').includes('本次侦察仍对应当前守军：实际检定加值8，只用于该守军的下一次交战。')) {
          if (!recon) return stop('PUBLIC_RECON_ROUTE_UNAVAILABLE', 'No scoped public reconnaissance action is available at the current actual objective');
          if (recon.enabled) return choose(recon, 'Perform one real target-scoped reconnaissance, paying the published original treasuries, supplies and week');
          if (/行动|费用|灵性/.test(recon.reason ?? '')) return pursue(recon, 'Recover the actual resources needed for scoped reconnaissance');
          return stop('FINITE_PLANNING_RESOURCE_EXHAUSTED', recon.reason ?? 'Reconnaissance is blocked by finite resources or live target conditions');
        }
        if (!section(view, 'campaign-planning').includes('已生效方案：三军协同；会战时额外投入每军6补给。方案仅用于本次交战，打完不会自动沿用。')) {
          const selection = all.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'SELECT_BATTLE_PLAN' && a.command.command.nodeId === target && a.command.command.stance === POLICY.plannedStance && a.command.command.extraSupplies === true);
          if (!selection) return stop('PUBLIC_COORDINATED_PLAN_UNAVAILABLE', 'The predetermined coordinated full-supply public plan is not offered');
          if (selection.enabled) return choose(selection, 'Select the precommitted coordinated plan with six actual extra supplies per army after live eligibility and paid reconnaissance');
          if (/行动|费用|灵性/.test(selection.reason ?? '')) return pursue(selection, 'Recover the live personal resources for the selected coordinated plan');
          return stop('FINITE_COORDINATED_PLAN_BLOCKED', selection.reason ?? 'The publicly visible coordinated plan requirements are not met');
        }
      }
      if (battle?.enabled) {
        if (count(battle) >= POLICY.battleAttemptsPerNode) { policy.stopAfterWithdrawal = 'Finite attempts at the same real battle are exhausted'; continue; }
        return pursue(battle, 'Fight the actual opposing legion at this independent objective', { health: 90, mind: 90, spirituality: 30, uninjured: true });
      }
      if (march?.enabled) return pursue(march, 'March along the next enabled real route after local consolidation');
      const resourceBlocked = [battle, consolidation, march].find(a => a && /行动|费用|灵性|休养|重伤/.test(a.reason ?? ''));
      if (resourceBlocked) return pursue(resourceBlocked, `Recover actual resources for ${resourceBlocked.label}`, { health: 90, mind: 90, spirituality: 30, uninjured: true });
      const reinforcement = enabled.find(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE');
      if (reinforcement) return pursue(reinforcement, 'Use the remaining legal finite reinforcement when forward action is blocked');
      const pending = all.some(a => a.command.type === 'CAMPAIGN' && nestedType(a) === 'REORGANIZE' && /仍在途中/.test(a.reason ?? ''));
      if (pending) return support('Wait for the actual already-dispatched reinforcement convoy');
      policy.stopAfterWithdrawal = 'No enabled forward route, objective or finite reinforcement remains'; continue;
    }
    if (policy.phase === 'POSTWAR') {
      const footReturn = definition.postwarFootReturn ? all.find(a => a.command.type === 'RETURN_ON_FOOT') : null;
      if (footReturn) {
        const paidReturn = enabled.find(a => a.command.type === 'TRAVEL' && a.command.to === 'loen-headquarters');
        if (paidReturn) return choose(paidReturn, 'Use the affordable real paid return route after actual armistice, retaining the original armies at their postwar station');
        if (footReturn.enabled) return choose(footReturn, 'Walk the actual postwar return route without advance fare; pay real extra weeks and living debts while the original armies remain stationed');
        return support('Wait for a legal public postwar return action', { actions: 1 });
      }
      // Failure may leave real recoverable original boxes, or permanently lose
      // them. Treat the actual living patient before considering another bottle.
      const preparation = prepare('Recover actual postwar or failed-consumption injuries', { ...atFullHealth, actions: 1, cash: injuryCount(view) ? 60 : 0 });
      if (preparation) return preparation;
      const next = materials(true); if (next) return next;
      const consumption = all.find(a => a.command.type === 'CONSUME');
      if (consumption) return pursue(consumption, 'Drink this actual prepared compound once, accepting its genuine result', atFullHealth);
      const compound = all.find(a => a.command.type === 'MATERIAL' && nestedType(a) === 'PREPARE_COMPOUND');
      if (compound) return pursue(compound, 'Consume one finite ordinary supply pack to prepare the original materials');
      const destinations = all.filter(a => a.command.type === 'TRAVEL' && ['backlund:sealed-compounding-room', 'loen-headquarters'].includes(a.command.to));
      const travel = destinations.find(a => a.enabled) ?? destinations.find(a => a.command.to === 'loen-headquarters') ?? destinations[0];
      return travel ? pursue(travel, 'Transport the actual originals along the public return route to the workshop')
        : stop('POSTWAR_PUBLIC_ROUTE_UNAVAILABLE', 'No legal public preparation or transport action remains');
    }
    if (policy.phase === 'RESCUE') {
      const epilogue = enabled.filter(a => a.command.type === 'EPILOGUE');
      // A real rescue, not an ability checklist. With the inherited 3 AP,
      // START leaves 2: attempt coordination, then carry the actual patients.
      // Never sacrifice the only remaining evacuation action to test flame.
      for (const type of ['COORDINATE', 'EVACUATE', 'REPORT', 'CONTAIN_FIRE', 'WITHDRAW']) {
        const action = epilogue.find(a => nestedType(a) === type);
        if (type === 'CONTAIN_FIRE' && epilogue.some(a => nestedType(a) === 'EVACUATE')) continue;
        if (action) return choose(action, type === 'WITHDRAW' ? 'Ordinarily withdraw when the remaining real rescue actions are unavailable' : `Resolve the one actual return-route rescue: ${action.label}`);
      }
      if (section(view, 'epilogue').length) return stop('NATURAL_RESCUE_REPORTED', 'The actual rescue/withdrawal and casualties have been reported');
      const preparation = prepare('Recover before returning to the original route for coordination and actual evacuation', { ...atFullHealth, actions: 3 });
      if (preparation) return preparation;
      const start = find('START_EPILOGUE');
      if (start) return choose(start, 'Dispatch the actual six-person detachment at its original postwar location');
      const travel = all.find(a => a.command.type === 'TRAVEL');
      return travel ? pursue(travel, 'Actually traverse the original continent route back to the postwar legion') : stop('RESCUE_ROUTE_UNAVAILABLE', 'No public route or real detachment is available');
    }
  }
  return stop('PUBLIC_POLICY_PHASE_BLOCKED', 'No bounded phase transition produced an enabled action');
}
function advancePolicy(decision, publicAfter) {
  const policy = clone(decision.policy), key = commandKey(decision.action.command);
  const command = decision.action.command.command;
  if (decision.action.command.type === 'CAMPAIGN') {
    if (command.type === 'RECONNOITRE') policy.reconNode = command.nodeId;
    if (command.type === 'SELECT_BATTLE_PLAN') policy.selectedPlanNode = command.nodeId;
    if (['MARCH', 'RETURN_TO_HEADQUARTERS', 'BATTLE', 'PREPARED_BATTLE', 'RELEASE_AUTHORITY'].includes(command.type)) { policy.reconNode = null; policy.selectedPlanNode = null; }
  }
  policy.attempts[key] = (policy.attempts[key] ?? 0) + 1;
  const progress = progressSignature(publicAfter), unchanged = policy.lastProgress === progress;
  const supportAction = ['REST', 'WORK', 'CLINIC', 'NEXT_WEEK'].includes(decision.action.command.type)
    || decision.action.command.command?.type === 'MILITARY_LABOUR';
  policy.supportSinceProgress = unchanged && supportAction ? policy.supportSinceProgress + 1 : 0;
  // Wage/health progress makes another weekly cycle meaningful. Pure consecutive
  // waiting on an unchanged public problem remains bounded.
  policy.unchangedWaits = unchanged && decision.action.command.type === 'NEXT_WEEK' ? policy.unchangedWaits + 1 : 0;
  policy.lastProgress = progress; return policy;
}
function verifyBoundary(cp, root, prefixHash, freeze, fork) {
  assert.equal(cp.format, FORMAT); assert.equal(cp.prefixCount, FORK_COUNT);
  assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA256); assert.equal(cp.prefixSha256, prefixHash);
  assert.equal(cp.freezeSha256, freeze.sha256); assert.deepEqual(cp.policyDefinition, POLICY); assert.deepEqual(cp.fork, fork);
  assert.equal(cp.initialStateSha256, root.finalStateSha256); assert.equal(cp.commandCount,FORK_COUNT+cp.commands.length);
  assert.equal(cp.rows.length,cp.commands.length); assert.equal(cp.state.revision,root.state.revision+cp.commands.length);
  assert.equal(cp.finalStateSha256,stateHash(cp.state)); assert.deepEqual(cp.state.random.seed,root.state.random.seed);
  let previousState=root.finalStateSha256,previousRandom=root.state.random,previousPublic=cp.initialPublicStateSha256;
  const attempts={};
  for(const [i,row] of cp.rows.entries()) {
    assert.equal(row.commandCount,FORK_COUNT+i+1);assert.equal(row.revision,root.state.revision+i+1);assert.deepEqual(row.intent,cp.commands[i]);
    assert.equal(row.commandSha256,compactHash(row.intent));assert.equal(row.beforeStateSha256,previousState);assert.deepEqual(row.randomBefore,previousRandom);
    assert.equal(row.publicBeforeSha256,previousPublic);assert.equal(row.randomAfter.seed,root.state.random.seed);
    previousState=row.afterStateSha256;previousRandom=row.randomAfter;previousPublic=row.publicAfterSha256;
    const key=commandKey(row.intent.command);attempts[key]=(attempts[key]??0)+1;
  }
  assert.equal(previousState,cp.finalStateSha256);assert.deepEqual(previousRandom,cp.state.random);assert.equal(previousPublic,cp.publicStateSha256);
  assert.deepEqual(attempts,cp.policy.attempts);
  if(cp.pending) {assert.equal(cp.pending.commandCount,cp.commandCount+1);assert.equal(cp.pending.beforeStateSha256,cp.finalStateSha256);assert.equal(cp.pending.publicBeforeSha256,cp.publicStateSha256);assert.deepEqual(cp.pending.intent,{type:'RED_PRIEST',command:cp.pending.decision.action.command});}
}
function parseOptions(args) {
  const options={out:null,resume:null,forkDirectory:null,archiveDirectory:null,archiveProducer:null,equivalenceProof:null,maxNew:Infinity,preflight:false};
  for(let i=0;i<args.length;i++){
    const flag=args[i];if(flag==='--preflight'){assert(!options.preflight);options.preflight=true;continue;}
    const value=args[++i];assert(value!==undefined,`Missing ${flag}`);
    const keys={'--out':'out','--resume':'resume','--fork-directory':'forkDirectory','--archive-directory':'archiveDirectory','--archive-producer':'archiveProducer','--equivalence-proof':'equivalenceProof'};
    if(keys[flag]) {assert.equal(options[keys[flag]],null);options[keys[flag]]=resolve(value);}
    else if(flag==='--max-new'){assert.equal(options.maxNew,Infinity);assert(/^\d+$/.test(value));options.maxNew=Number(value);assert(Number.isSafeInteger(options.maxNew));}
    else throw Error(`Unsupported option ${flag}; no seed, result, resources or strategy override exists`);
  }
  for(const key of ['forkDirectory','archiveDirectory','equivalenceProof'])assert(options[key],`${key} is required`);
  if(options.resume){assert(!options.out||options.out===dirname(options.resume));options.out=dirname(options.resume);}
  if(!options.preflight)assert(options.out,'Explicit new output directory required');if(options.out)assert(options.out!==options.archiveDirectory&&!options.out.startsWith(options.archiveDirectory+sep),'A planned branch must remain outside the immutable original983 archive');return options;
}
function readBranchInputs(options, old, freeze) {
  const rootPath=join(options.forkDirectory,'original-918-checkpoint.json'),proofPath=join(options.forkDirectory,'reconstruction-proof.json');
  const wrapped=JSON.parse(readFileSync(rootPath,'utf8')),root=wrapped.payload,proof=JSON.parse(readFileSync(proofPath,'utf8'));
  assert.equal(fileEvidence(rootPath).sha256,'2ab728663f4ce0096a94e49279a5feadda378f64629dd4ec6ccff785db60c68b');assert.equal(fileEvidence(proofPath).sha256,'398f3854fc323bc106f58b0133cf702cce1a9b234bca850ccc416a21570611c5');
  assert.equal(wrapped.sha256,stateHash(root));assert.equal(root.format,'RED_PRIEST_EXACT_PREDECLARATION918_BRANCH_ROOT_V1');assert.equal(root.commandCount,FORK_COUNT);
  assert.equal(root.finalStateSha256,'779ef84dfc74b9abbfe1e97c9bff206c683a9b18d3957d6603661f9748b38acd');
  assert.equal(root.publicStateSha256,'361cc87eba7713bdf66752b17fd298350d558e5be2f10e30e8419fb67f172d91');
  assert.equal(root.originalRuntimeFreezeSha256,'be967f07d9a912627b5c21fb1746247b4d2ba3797ee1dce532108748e1eeb11e');
  assert.equal(root.sourceSha256,SOURCE_SHA256);assert.equal(root.prefixSha256,ORIGINAL_PREFIX_SHA256);assert.equal(root.commands.length,123);assert.equal(root.rows.length,123);
  assert.equal(stateHash(root.state),root.finalStateSha256);assert.deepEqual(root.state.random,{seed:old.seed,cursor:423});
  assert.equal(root.state.redPriest.campaign.phase,'CRISIS');assert.equal(root.state.redPriest.campaign.declaration,null);assert.equal(root.state.redPriest.campaign.planning,undefined);
  assert.equal(proof.allPrivatePublicAndRngEqual,true);assert.equal(proof.strictFinalValidation,true);assert.deepEqual(fileEvidence(rootPath),proof.checkpoint);
  assert.deepEqual(proof.checks.map(r=>r.commandCount),[916,917,918]);assert.equal(proof.expectedStateSha256,root.finalStateSha256);assert.equal(proof.expectedPublicSha256,root.publicStateSha256);
  for(const entry of proof.original983.files)assert.deepEqual(fileEvidence(join(options.archiveDirectory,entry.path)),{bytes:entry.bytes,sha256:entry.sha256},`Sealed original983 ${entry.path}`);
  assert.equal(proof.original983.files.length,57,'Complete original983 archive required');
  assert.equal(proof.original983.manifestEvidence.sha256,'24d971395d08ca7b031d51d79c17a75681ccf7e3fe78a076f79b84f917acf909');
  const sealed=JSON.parse(readFileSync(join(options.archiveDirectory,'checkpoint.json'),'utf8'));assert.equal(sealed.sha256,stateHash(sealed.payload));assert.equal(sealed.payload.commandCount,983);assert.equal(sealed.payload.terminal.stage,'FINITE_CAMPAIGN_WITHDRAWN');assert.equal(sealed.sha256,'91ca947ee1b0903d3d63296827d9db4004ee0f077a357bccd11ffa35fdb03c85');assert.deepEqual(root.commands,sealed.payload.commands.slice(0,123));assert.deepEqual(root.rows,sealed.payload.rows.slice(0,123));
  assert.equal(fileEvidence(options.equivalenceProof).sha256,'9f64e510ace5f5f484ad2869a8bc616c668231ac345383695740a4edd065a3c3','The reviewed complete original983 planning-equivalence proof is required');
  const equivalent=JSON.parse(readFileSync(options.equivalenceProof,'utf8'));
  assert.equal(equivalent.format,'RED_PRIEST983_PLANNING_TRANSITION_V1');
  const runtimeFiles=freeze.files.filter(e=>e.file!=='$natural-producer');
  assert.deepEqual(equivalent.currentRuntimeFreeze.files.filter(e=>e.file!=='$natural-producer'),runtimeFiles,'Historical equivalence must use the exact current frozen runtime');
  assert.equal(equivalent.currentRuntimeFreeze.sha256,compactHash(equivalent.currentRuntimeFreeze.files));assert.equal(equivalent.currentRuntimeFreeze.sha256,'a7e68d0887485e05bc55779eda3db46512fad01e8a67b67babace7f8ae3e3cd7');
  assert.equal(equivalent.replay.commands,188);assert.equal(equivalent.replay.first,796);assert.equal(equivalent.replay.last,983);
  assert.equal(equivalent.replay.allPrivateAndRngEqual,true);assert.equal(equivalent.replay.rows.length,188);
  const originalProducer=options.archiveProducer??(existsSync(join(options.archiveDirectory,'producer.mjs'))?join(options.archiveDirectory,'producer.mjs'):resolve(proof.original983.producer.path));
  assert.deepEqual(fileEvidence(originalProducer),{bytes:proof.original983.producer.bytes,sha256:proof.original983.producer.sha256},'Archived original983 producer must remain exact');
  const prefixCommands=[...old.commands,...root.commands],prefixHash=compactHash(prefixCommands);
  return {root,proof,equivalent,prefixCommands,prefixHash,rootEvidence:fileEvidence(rootPath),proofEvidence:fileEvidence(proofPath),equivalenceEvidence:fileEvidence(options.equivalenceProof)};
}
function planningProjectionSeam(view, originalView) {
  const restored=clone(view);const added=restored.actions.filter(a=>a.command.type==='CAMPAIGN'&&a.command.command.type==='ENABLE_PLANNING');
  assert.equal(added.length,1);assert.deepEqual(added[0].command,{type:'CAMPAIGN',command:{type:'ENABLE_PLANNING'}});assert.equal(added[0].enabled,true);
  assert.deepEqual(restored.actions.at(-1),added[0],'Opt-in must only append one public action');restored.actions.pop();
  assert.equal(stateHash(restored),originalView);return {allowedPublicChanges:['APPENDED_ENABLE_PLANNING_CRISIS_ACTION'],addedAction:added[0]};
}
export async function main(args=process.argv.slice(2)) {
  const options=parseOptions(args),rootDirectory=process.cwd();
  const old=readSource(rootDirectory),freeze=inspectFreeze(rootDirectory),stamps=stampFreeze(rootDirectory,freeze);
  const inputs=readBranchInputs(options,old,freeze),forkRoot=inputs.root;
  if(options.preflight){console.log(JSON.stringify({passed:true,prefixCount:FORK_COUNT,prefixSha256:inputs.prefixHash,freezeSha256:freeze.sha256,producerSha256:fileEvidence(SELF).sha256,original983Intact:true,rootSha256:inputs.rootEvidence.sha256,proofSha256:inputs.proofEvidence.sha256,equivalenceProofSha256:inputs.equivalenceEvidence.sha256,noRuntimeImported:true}));return;}
  mkdirSync(options.out,{recursive:true});const checkpointPath=options.resume??join(options.out,'checkpoint.json');
  const runtime=await loadRuntime(rootDirectory);runtime.assertValidSliceState(forkRoot.state);
  let initialSession=runtime.openRedPriestRuntimeSession(forkRoot.state);assert.equal(stateHash(initialSession.snapshot()),forkRoot.finalStateSha256);
  const initialPublic=initialSession.projectRedPriest(),seam=planningProjectionSeam(initialPublic,forkRoot.publicStateSha256);
  const runtimeProof={format:'RED_PRIEST918_PLANNING_TRANSITION_V1',commandCount:FORK_COUNT,
    originalRuntimeFreezeSha256:forkRoot.originalRuntimeFreezeSha256,newRuntimeFreezeSha256:freeze.sha256,
    stateSha256:forkRoot.finalStateSha256,originalPublicSha256:forkRoot.publicStateSha256,continuedPublicSha256:stateHash(initialPublic),
    random:clone(forkRoot.state.random),unchangedPrivateAndRng:true,publicDifference:'Only appended ENABLE_PLANNING action',
    ...seam,original983Replay:{proofFile:relative(rootDirectory,options.equivalenceProof).split(sep).join('/'),proofSha256:inputs.equivalenceEvidence.sha256}};
  const runtimeProofBytes=JSON.stringify(runtimeProof),fork={rootFile:'original-918-checkpoint.json',rootSha256:inputs.rootEvidence.sha256,proofFile:'reconstruction-proof.json',proofSha256:inputs.proofEvidence.sha256,runtimeProofFile:'runtime-transition.json',runtimeProofSha256:sha(runtimeProofBytes)};
  let saved,session=initialSession,stage=null,reason=null,committedThisInvocation=0;
  if(options.resume){recoverAtomicNext(checkpointPath);saved=decodeCheckpoint(readFileSync(checkpointPath,'utf8'));assert.deepEqual(JSON.parse(readFileSync(join(options.out,'freeze.json'),'utf8')),freeze);assert.equal(readFileSync(join(options.out,'runtime-transition.json'),'utf8'),runtimeProofBytes);verifyBoundary(saved.payload,forkRoot,inputs.prefixHash,freeze,fork);session=runtime.openRedPriestRuntimeSession(saved.payload.state);if(saved.payload.terminal){stage=saved.payload.terminal.stage;reason=saved.payload.terminal.reason;}}
  else{assert.equal(readdirSync(options.out).length,0,'Refuse to overwrite or reroll an existing branch; use its exact --resume');durableCreate(join(options.out,'freeze.json'),JSON.stringify(freeze));durableCreate(join(options.out,'runtime-transition.json'),runtimeProofBytes);saved=saveCheckpoint(checkpointPath,{format:FORMAT,source:SOURCE,sourceSha256:SOURCE_SHA256,prefixCount:FORK_COUNT,prefixSha256:inputs.prefixHash,freezeSha256:freeze.sha256,fork,policyDefinition:POLICY,policy:{...startingPolicy(),phase:'WAR',reconNode:null,selectedPlanNode:null},createdAt:new Date().toISOString(),commandCount:FORK_COUNT,commands:[],rows:[],state:forkRoot.state,initialStateSha256:forkRoot.finalStateSha256,initialPublicStateSha256:stateHash(initialPublic),finalStateSha256:forkRoot.finalStateSha256,publicStateSha256:stateHash(initialPublic),pending:null,terminal:null},null);}
  try {
    assert.equal(stateHash(session.projectRedPriest()),saved.payload.publicStateSha256);
    while(!stage){unchangedSinceFreeze(stamps);const boundary=saved.payload;
      if(boundary.state.status!=='ACTIVE'){stage='NATURAL_ACTUAL_TERMINAL';reason=`Actual ${boundary.state.status}`;break;}
      if(!boundary.pending&&committedThisInvocation>=options.maxNew){stage='MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY';reason='Requested action-boundary pause';break;}
      if(!boundary.pending&&boundary.commands.length>=POLICY.maximumNewCommands){stage='FINITE_COMMAND_BUDGET';reason='The bounded public planned-campaign policy is exhausted';break;}
      let pending=boundary.pending;
      if(!pending){const view=session.projectRedPriest(),decision=chooseAction(view,boundary.policy,POLICY);if(decision.stop){stage=decision.stop;reason=decision.reason;break;}
        assert.notEqual(decision.action.command.command?.type,'BATTLE','Planned branch never substitutes an ordinary unprepared battle');
        pending={commandCount:boundary.commandCount+1,intent:{type:'RED_PRIEST',command:clone(decision.action.command)},decision,beforeStateSha256:boundary.finalStateSha256,publicBeforeSha256:stateHash(view),startedAt:new Date().toISOString()};saved=saveCheckpoint(checkpointPath,{...boundary,pending},saved.sha256);}
      const view=session.projectRedPriest(),offered=view.actions.find(a=>isDeepStrictEqual(a.command,pending.intent.command));assert(offered?.enabled);assert.equal(stateHash(view),pending.publicBeforeSha256);
      const before=saved.payload.state,started=performance.now(),draft=session.prepare(pending.intent,before.revision),next=session.snapshotDraft(draft),after=session.projectDraftRedPriest(draft);
      assert.equal(next.revision,before.revision+1);checkOriginals(next,old);
      const row={commandCount:pending.commandCount,intent:clone(pending.intent),commandSha256:compactHash(pending.intent),reason:pending.decision.reason,publicLabel:offered.label,startedAt:pending.startedAt,elapsedMilliseconds:Math.round(performance.now()-started),revision:next.revision,beforeStateSha256:pending.beforeStateSha256,afterStateSha256:stateHash(next),publicBeforeSha256:pending.publicBeforeSha256,publicAfterSha256:stateHash(after),randomBefore:clone(before.random),randomAfter:clone(next.random)};
      saved=saveCheckpoint(checkpointPath,{...saved.payload,state:next,finalStateSha256:row.afterStateSha256,publicStateSha256:row.publicAfterSha256,commandCount:pending.commandCount,commands:[...saved.payload.commands,clone(pending.intent)],rows:[...saved.payload.rows,row],policy:advancePolicy(pending.decision,after),pending:null},saved.sha256);
      session.commit(draft);committedThisInvocation++;console.log(JSON.stringify({completed:pending.commandCount,action:offered.label,week:next.week,sequence:next.progression.sequence,milliseconds:row.elapsedMilliseconds}));
    }
    unchangedSinceFreeze(stamps);assert.deepEqual(inspectFreeze(rootDirectory),freeze);verifyBoundary(saved.payload,forkRoot,inputs.prefixHash,freeze,fork);checkOriginals(saved.payload.state,old);
    runtime.assertValidSliceState(saved.payload.state);const strict=runtime.openRedPriestRuntimeSession(saved.payload.state);assert.equal(stateHash(strict.snapshot()),saved.payload.finalStateSha256);assert.equal(stateHash(strict.projectRedPriest()),saved.payload.publicStateSha256);
    for(const entry of inputs.proof.original983.files)assert.deepEqual(fileEvidence(join(options.archiveDirectory,entry.path)),{bytes:entry.bytes,sha256:entry.sha256});
    const paused=stage==='MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY';if(!paused&&!saved.payload.terminal)saved=saveCheckpoint(checkpointPath,{...saved.payload,terminal:{stage,reason}},saved.sha256);
    const finalView=session.projectRedPriest();replaceDerived(join(options.out,'commands.ndjson'),saved.payload.rows.map(r=>JSON.stringify(r)).join('\n')+(saved.payload.rows.length?'\n':''));
    const provenance={kind:'EXACT_ORIGINAL_PREDECLARE918_PLANNED_BRANCH',source:SOURCE,sourceSha256:SOURCE_SHA256,prefixCommandsSha256:inputs.prefixHash,runtimeFreezeSha256:freeze.sha256,historicalPrefixRetainedExactly:true,original983BranchPreserved:true,notContinuationOf983:true,seedChanged:false,selectedFromEnabledPublicActionsOnly:true,fork};
    replaceDerived(join(options.out,'natural.json'),JSON.stringify({provenance,creation:old.creation,seed:old.seed,prefixCount:FORK_COUNT,commands:[...inputs.prefixCommands,...saved.payload.commands],initial:old.initial,policy:POLICY,stage,reason,pendingIntent:null,final:saved.payload.state}));
    replaceDerived(join(options.out,'summary.json'),JSON.stringify({stage,reason,commands:saved.payload.commandCount,originalCommands:FORK_COUNT,newCommands:saved.payload.commands.length,paused,strictFinalValidation:true,branch:'Independent original918 predeclaration planning branch; original983 withdrawal preserved separately',public:{title:finalView.title,promoted:finalView.promoted,nextStep:finalView.nextStep,resources:finalView.resources,abilities:finalView.abilities,sections:finalView.sections}}));
    console.log(JSON.stringify({outputDir:options.out,stage,commands:saved.payload.commandCount,paused}));return {outputDir:options.out,stage,commands:saved.payload.commandCount,paused};
  }catch(error){try{replaceDerived(join(options.out,'error.json'),JSON.stringify({stage:'CAPTURE_INTERRUPTED',error:String(error),checkpoint:checkpointPath,resumeExactPendingRequired:true,commandCount:saved?.payload.commandCount??null,at:new Date().toISOString()}));}catch{}throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===SELF)await main();
