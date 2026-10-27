import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import type { AlchemistCreation } from '../../src/domain/alchemist/life.js';
import {
  CIVILIZATION_ENLIGHTENER_COUNT_WHEEL, CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL, CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL,
  projectCivilizationEnlightenerAction, projectCivilizationEnlightenerCombat, projectCivilizationEnlightenerRoundOutcome,
  type CivilizationEnlightenerActionEvidence, type CivilizationEnlightenerRoundOutcome,
} from '../../src/domain/civilization-enlightener/combat.js';
import {
  CIVILIZATION_ENLIGHTENER_CASE_IDS, projectCivilizationEnlightenerLife, projectCivilizationEnlightenerLifeReceipt,
  type CivilizationEnlightenerActivityCommand, type CivilizationEnlightenerLifeReceipt,
} from '../../src/domain/civilization-enlightener/life.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/civilization-enlightener-v01890';
const FILE = `${ROOT}/natural.json`;
const FILE_HASH = '5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f';
const captured = () => readObjectEntry<SliceState>(FILE, 'final');
const capturedLive = () => readObjectEntry<SliceState>(`${ROOT}/boundary-combat-round-2.json`, 'final');
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');
const rounds = (s: SliceState) => s.combatHistory.filter(round => round.civilizationEnlightenerOutcome);
// The sole permitted display-text difference is the known prefix on material provenance.
const displayCreation = (x: AlchemistCreation) => ({ ...structuredClone(x), source: x.source.startsWith('原创G：') ? x.source.slice('原创G：'.length) : x.source });
function withoutActionReplay(action: CivilizationEnlightenerActionEvidence) {
  const { randomCursorBefore: _before, randomCursorAfter: _after, creationsBefore, creationsAfter, ...facts } = structuredClone(action);
  return { ...facts, creationsBefore: creationsBefore.map(displayCreation), creationsAfter: creationsAfter.map(displayCreation) };
}
function withoutOutcomeReplay(outcome: CivilizationEnlightenerRoundOutcome) {
  const { source: _source, randomCursorAfter: _cursor, playerActions, enemyActions, creations, ...facts } = structuredClone(outcome);
  return { ...facts, creations: creations.map(displayCreation), playerActions: playerActions.map(withoutActionReplay), enemyActions: enemyActions.map(withoutActionReplay) };
}
function withoutLifeReplay(entry: CivilizationEnlightenerLifeReceipt) {
  const { randomCursor: _cursor, randomBefore: _before, randomAfter: _after, ...facts } = structuredClone(entry);
  return facts;
}
function assertPublicOnly(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, index) => assertPublicOnly(child, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomBefore', 'randomAfter', 'randomCursorBefore', 'randomCursorAfter', 'preparation',
      'sourceRecord', 'sourceHistory', 'sourceScene', 'historyDigest', 'identityDigest', 'privateProbe', 'privateMastery', 'unexpectedField'].includes(key), `${path}.${key}`).toBe(false);
    // Actual check explanations and material provenance are public facts, including their "source" key.
    if (key === 'source') expect(path, `${path}.${key}`).toMatch(/(?:\.check\.modifiers\[\d+\]|\.creations(?:Before|After)?\[\d+\])$/);
    assertPublicOnly(child, `${path}.${key}`);
  }
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || found.has(value)) return found;
  found.add(value); Object.values(value).forEach(child => objects(child, found)); return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const originals = objects(input);
  for (const object of objects(output)) expect(originals.has(object), 'public objects must not alias private inputs').toBe(false);
}
function injectPrivateFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(injectPrivateFields); return; }
  Object.entries(value).forEach(([key, child]) => { if (key !== 'source') injectPrivateFields(child); });
  Object.assign(value, { unexpectedField: 'not a declared fact', historyDigest: 'private history', privateProbe: { randomSeed: 'private', randomCursor: 1234 } });
}

describe('Civilization Enlightener historical public evidence allowlists', () => {
  it('preserves all four actual rounds and every resolved fact without replay source or stream offsets', () => {
    expect(fileDigest()).toBe(FILE_HASH);
    const state = captured(), before = digest(state), random = structuredClone(state.random);
    expect(rounds(state)).toHaveLength(4);
    for (const round of rounds(state)) {
      const outcome = round.civilizationEnlightenerOutcome!, source = stableStringify(outcome.source);
      expect(outcome.source.randomSeed).toBe(state.random.seed);
      expect(outcome.source.preparation.randomSeed).toBe(state.random.seed);
      const projected = projectCivilizationEnlightenerRoundOutcome(outcome);
      expect(projected).toEqual(withoutOutcomeReplay(outcome));
      expect(projected.materialsAfter).toEqual(outcome.materialsAfter);
      expect(projected.rootAfter).toEqual(outcome.rootAfter);
      expect(projected.masteryAfter).toEqual(outcome.masteryAfter);
      expect(projected.playerInjuriesAfter).toEqual(outcome.playerInjuriesAfter);
      assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(stableStringify(outcome.source)).toBe(source);
    }
    expect(rounds(state).map(round => round.civilizationEnlightenerOutcome!.playerHealthAfter)).toEqual([90, 90, 60, 60]);
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('retains all combat costs, real originals, sources, damage, positions, checks and public modifier sources', () => {
    const state = captured(), before = digest(state);
    const actions = rounds(state).flatMap(round => [...round.civilizationEnlightenerOutcome!.playerActions, ...round.civilizationEnlightenerOutcome!.enemyActions]);
    expect(actions.filter(action => action.selectedAbility === 'MECHANICAL_PULSE').map(action => [action.paidCost, action.mechanismChargeSpent])).toEqual([[7, 1], [7, 1], [7, 1]]);
    for (const action of actions) {
      const projected = projectCivilizationEnlightenerAction(action);
      expect(projected).toMatchObject({ paidCost: action.paidCost, mindCost: action.mindCost, boxChargeSpent: action.boxChargeSpent,
        frameChargeSpent: action.frameChargeSpent, frameDurabilityDamage: action.frameDurabilityDamage, mechanismChargeSpent: action.mechanismChargeSpent,
        rawContribution: action.rawContribution, rawReduction: action.rawReduction, atSeconds: action.atSeconds, elapsedSeconds: action.elapsedSeconds, travelMetres: action.travelMetres,
        playerMindAfter: action.playerMindAfter, playerSpiritualityAfter: action.playerSpiritualityAfter, enemyMindAfter: action.enemyMindAfter, enemySpiritualityAfter: action.enemySpiritualityAfter });
      for (const key of ['creationsBefore', 'creationsAfter'] as const) {
        expect(projected[key]).toEqual(action[key].map(displayCreation));
        expect(projected[key].map(x => [x.id, x.componentIds, x.madeBy, x.owner, x.custodian, x.location, x.charge, x.durability, x.active])).toEqual(action[key].map(x => [x.id, x.componentIds, x.madeBy, x.owner, x.custodian, x.location, x.charge, x.durability, x.active]));
      }
    }
    const checked = structuredClone(actions.find(action => action.check)!);
    const text = 'source randomSeed randomCursor randomBefore randomAfter 的公开检定说明';
    checked.check = { ...checked.check!, modifiers: [{ source: text, value: 0 }] };
    const projected = projectCivilizationEnlightenerAction(checked);
    expect(projected.check).toEqual(checked.check); expect(projected.check!.modifiers[0]!.source).toBe(text);
    assertPublicOnly(projected); assertDetached(projected, checked); expect(digest(state)).toBe(before);
  });

  it('rejects undeclared nested fields without altering the raw replay source, windows or checks', () => {
    const state = captured(); let checks = 0, windows = 0, injuries = 0;
    for (const round of rounds(state)) {
      const outcome = structuredClone(round.civilizationEnlightenerOutcome!), source = stableStringify(outcome.source);
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) if (action.check) {
        action.check = { ...action.check, modifiers: [{ source: '公开来源不是私有重放来源', value: 0 }] }; checks++;
      }
      windows += outcome.expiredWindows.length; injuries += outcome.enemyInjuries.length + outcome.playerInjuriesAfter.length;
      const expected = withoutOutcomeReplay(outcome);
      injectPrivateFields(outcome); outcome.masteryAfter.privateMastery = 42;
      const before = digest(outcome), projected = projectCivilizationEnlightenerRoundOutcome(outcome);
      expect(projected).toEqual(expected); assertPublicOnly(projected); assertDetached(projected, outcome);
      expect(stableStringify(outcome.source)).toBe(source); expect(digest(outcome)).toBe(before);
    }
    expect(checks).toBeGreaterThan(0); expect(windows).toBeGreaterThan(0); expect(injuries).toBeGreaterThan(0);
  });

  it('detaches live and terminal combat panels, including actions, materials, originals and shared wheels', () => {
    for (const state of [capturedLive(), captured()]) {
      const before = digest(state), panel = projectCivilizationEnlightenerCombat(state), repeated = projectCivilizationEnlightenerCombat(state);
      const outcome = (state.combat?.lastRound ?? state.combatHistory[state.civilizationEnlightener.encounter.terminal!.historyIndex])!.civilizationEnlightenerOutcome!;
      expect(panel.lastActionSequence).toEqual([...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order).map(withoutActionReplay));
      expect(panel.materials).toEqual(state.civilizationEnlightener.encounter.materials);
      expect(panel.powerUses).toEqual(state.civilizationEnlightener.encounter.powerUses);
      assertPublicOnly(panel); assertDetached(panel, state); assertDetached(panel, repeated);
      assertDetached(panel.countWheel, CIVILIZATION_ENLIGHTENER_COUNT_WHEEL);
      assertDetached(panel.enemyCountWheel, CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL);
      assertDetached(panel.enemyAbilityWheel, CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL);
      assertDetached(panel.countWheel, panel.enemyCountWheel);
      panel.lastActionSequence[0]!.label = 'public copy only'; panel.creations[0]!.componentIds.push('public-only');
      panel.materials.mechanism.charge--; panel.powerUses.WARD++; panel.countWheel[0]!.weight = 0;
      expect(projectCivilizationEnlightenerCombat(state)).toEqual(repeated); expect(digest(state)).toBe(before);
    }
  });

  it('allowlists all five window kinds and preserves pending-action observations without token-based stripping', () => {
    // Synthetic public-boundary probes do not replay or modify the historical campaign.
    const outcome = structuredClone(rounds(captured())[0]!.civilizationEnlightenerOutcome!);
    const action = outcome.playerActions.find(candidate => candidate.pendingBefore)!;
    const text = 'source randomSeed randomCursor preparation 原创G 维拉';
    action.label = text; action.pendingBefore!.visibleIntent = text; action.pendingAfter = structuredClone(action.pendingBefore);
    outcome.rootAfter.knownPlayerName = text;
    const template = outcome.expiredWindows[0]!;
    for (const [key, kind] of [['analysis', 'ANALYSIS'], ['guidance', 'GUIDANCE'], ['attention', 'ATTENTION'], ['oldAnalysis', 'OLD_ANALYSIS'], ['calibration', 'CALIBRATION']] as const) {
      const window = { ...template, id: `public-${kind}`, kind, targetActionId: action.pendingBefore!.id };
      action.windowsBefore[key] = structuredClone(window); action.windowsAfter[key] = structuredClone(window);
      outcome.windowsAfter[key] = structuredClone(window); outcome.expiredWindows.push(structuredClone(window));
    }
    const expected = withoutOutcomeReplay(outcome); injectPrivateFields(outcome);
    const before = digest(outcome), projected = projectCivilizationEnlightenerRoundOutcome(outcome);
    const actual = projected.playerActions.find(candidate => candidate.order === action.order)!;
    expect(projected).toEqual(expected); expect(projected.rootAfter.knownPlayerName).toBe(text); expect(actual.label).toBe(text);
    expect(actual.pendingBefore!.visibleIntent).toBe(text); expect(actual.pendingAfter).toEqual(expected.playerActions.find(candidate => candidate.order === action.order)!.pendingAfter);
    expect(Object.values(actual.windowsAfter).map(window => window!.kind)).toEqual(['ANALYSIS', 'GUIDANCE', 'ATTENTION', 'OLD_ANALYSIS', 'CALIBRATION']);
    assertPublicOnly(projected); assertDetached(projected, outcome); expect(digest(outcome)).toBe(before);
  });

  it('allowlists nested panel materials, originals and known power counts', () => {
    const state = captured(), expected = projectCivilizationEnlightenerCombat(state);
    injectPrivateFields(state.civilizationEnlightener.encounter.materials); injectPrivateFields(state.civilizationEnlightener.encounter.powerUses);
    injectPrivateFields(state.alchemist.life.creations);
    injectPrivateFields(state.combatHistory[state.civilizationEnlightener.encounter.terminal!.historyIndex]!.civilizationEnlightenerOutcome);
    const before = digest(state), actual = projectCivilizationEnlightenerCombat(state);
    expect(actual).toEqual(expected); assertPublicOnly(actual); assertDetached(actual, state);
    for (const wheel of [actual.countWheel, actual.enemyCountWheel, actual.enemyAbilityWheel]) for (const entry of wheel) expect(Object.keys(entry).sort()).toEqual(['id', 'label', 'weight']);
    expect(digest(state)).toBe(before);
  });

  it('preserves all 51 life receipts and all 44 in-attempt receipts with actual costs, outcomes and originals', () => {
    const state = captured(), before = digest(state), random = structuredClone(state.random);
    const journal = state.civilizationEnlightener.life.journal, panel = projectCivilizationEnlightenerLife(state);
    expect(journal).toHaveLength(51); expect(panel.ledger).toEqual(journal.map(withoutLifeReplay));
    expect(panel.cases.map(item => item.attempts.length)).toEqual([1, 1, 1]);
    expect(panel.cases.map(item => item.attempts[0]!.receipts.length)).toEqual([16, 15, 13]);
    for (const item of panel.cases) {
      const start = journal.findIndex(entry => entry.command.type === 'INVITE' && entry.command.caseId === item.id);
      const end = journal.findIndex((entry, i) => i > start && entry.command.type === 'RETURN_HOME');
      expect(item.attempts[0]!.receipts).toEqual(journal.slice(start, end + 1).map(withoutLifeReplay));
      expect(item.attempts[0]!.evidence).toMatchObject({ returned: true, result: state.civilizationEnlightener.life.cases[item.id].result });
      expect(item.attempts[0]!.outcome).toBe(state.civilizationEnlightener.life.cases[item.id].outcome);
      expect(item.attempts[0]!.learnerOutcome).toBe(state.civilizationEnlightener.life.cases[item.id].learnerOutcome);
      assertPublicOnly(item.attempts);
    }
    expect(panel.ledger.filter(entry => entry.command.type === 'INVITE').map(entry => entry.before.cash - entry.after.cash)).toEqual([20, 20, 20]);
    expect(panel.ledger.filter(entry => entry.command.type === 'BUY_SHIM').map(entry => entry.before.cash - entry.after.cash)).toEqual([40]);
    expect(panel.ledger.filter(entry => entry.check).map(entry => [entry.before.spirituality - entry.after.spirituality, entry.before.mind - entry.after.mind])).toEqual([[6, 2], [8, 3], [0, 0]]);
    expect(panel.ledger.filter(entry => entry.check).map(entry => [entry.check!.roll, entry.check!.chance, entry.check!.tier])).toEqual([[54, 78, 'SUCCESS'], [92, 74, 'FAILURE'], [73, 34, 'FAILURE']]);
    for (const [key, expected] of Object.entries({ elapsedSeconds: 171, ownerWalkedMetres: 12, veraWalkedMetres: 12, originalsCarriedMetres: 24, wrenchCarriedMetres: 12 })) expect(panel.ledger.reduce((sum, entry) => sum + entry[key as 'elapsedSeconds'], 0)).toBe(expected);
    expect(panel.practice).toEqual(state.civilizationEnlightener.life.practice);
    expect(panel.practice.wrench).toMatchObject({ holder: 'RACK', loans: 3, returns: 3 });
    expect(panel.practice.shim).toMatchObject({ status: 'CONSUMED', price: 40 });
    expect(panel.practice.participant).toMatchObject({ name: '维拉', node: 'NEAR', present: false, walkedMetres: 12 });
    const repair = panel.ledger.find(entry => entry.command.type === 'REPAIR_FRAME')!;
    expect(repair.originalsBefore[1]).toMatchObject({ id: 'AL4-FRAME-1', durability: 90, charge: 0, location: 'BENCH_END' });
    expect(repair.originalsAfter[1]).toMatchObject({ id: 'AL4-FRAME-1', durability: 95, charge: 0, location: 'BENCH_END' });
    expect(panel.creations).toEqual(state.alchemist.life.creations.map(displayCreation));
    assertPublicOnly(panel.ledger); assertDetached(panel, state);
    expect(state.random).toEqual(random); expect(digest(state)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('preserves legal life modifier sources and drops every unknown nested receipt field', () => {
    const state = captured(), original = digest(state), text = 'source randomSeed randomCursor randomBefore randomAfter 的公开检定说明';
    for (const raw of state.civilizationEnlightener.life.journal) {
      const receipt = structuredClone(raw);
      if (receipt.check) receipt.check = { ...receipt.check, modifiers: [{ source: text, value: 0 }] };
      const expected = withoutLifeReplay(receipt);
      injectPrivateFields(receipt);
      const before = digest(receipt), projected = projectCivilizationEnlightenerLifeReceipt(receipt);
      expect(projected).toEqual(expected);
      if (projected.check) expect(projected.check.modifiers[0]!.source).toBe(text);
      assertPublicOnly(projected); assertDetached(projected, receipt); expect(digest(receipt)).toBe(before);
    }
    expect(digest(state)).toBe(original);
  });

  it('uses the same nested receipt allowlist in reconstructed attempts without relaxing raw replay validation', () => {
    const state = captured(), expected = projectCivilizationEnlightenerLife(state);
    for (const receipt of state.civilizationEnlightener.life.journal) {
      injectPrivateFields(receipt.date); injectPrivateFields(receipt.check);
      injectPrivateFields(receipt.originalsBefore); injectPrivateFields(receipt.originalsAfter);
      Object.assign(receipt, { unexpectedField: 'private receipt', historyDigest: 'private history' });
    }
    const before = digest(state), actual = projectCivilizationEnlightenerLife(state);
    expect(actual).toEqual(expected); assertPublicOnly(actual.ledger);
    for (const item of actual.cases) { expect(item.attempts).toHaveLength(1); assertPublicOnly(item.attempts); }
    assertDetached(actual, state); expect(digest(state)).toBe(before);
    // Raw command/budget shapes still fail closed instead of becoming accepted through the display mapper.
    injectPrivateFields(state.civilizationEnlightener.life.journal[0]!.command);
    expect(projectCivilizationEnlightenerLife(state).cases.every(item => item.attempts.length === 0)).toBe(true);
  });

  it('copies only the declared fields of every life command variant', () => {
    const commands: CivilizationEnlightenerActivityCommand[] = [
      ...CIVILIZATION_ENLIGHTENER_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'REPORT', caseId },
        { type: 'INVITE', caseId, method: 'ABILITY' }, { type: 'INVITE', caseId, method: 'ORDINARY' },
      ] satisfies CivilizationEnlightenerActivityCommand[]),
      { type: 'MOVE', to: 'NEAR' }, { type: 'MOVE', to: 'FAR' },
      ...(['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'] as const).flatMap(type => [{ type, permission: 'ABILITY' }, { type, permission: 'TEACHING' }] satisfies CivilizationEnlightenerActivityCommand[]),
      ...(['BORROW_WRENCH', 'ENTER_WORKSHOP', 'PLACE_ORIGINALS', 'READ_RECORDS', 'INSPECT_FRAME', 'PROCESS_ANALYSIS', 'HAND_INSPECT', 'BUY_SHIM', 'REPAIR_FRAME', 'DEMONSTRATE_STOP', 'OPERATIONAL_GUIDANCE', 'ARM_MANUAL_LOAD', 'LEARNER_TRY', 'WAIT_GUIDANCE', 'MANUAL_STOP', 'RETURN_ORIGINALS', 'RETURN_WRENCH', 'RETURN_HOME', 'ABORT', 'REFLECT'] as const).map(type => ({ type })),
    ];
    const original = captured().civilizationEnlightener.life.journal[0]!;
    for (const command of commands) {
      const receipt = structuredClone(original); receipt.command = structuredClone(command); injectPrivateFields(receipt.command);
      const before = digest(receipt), projected = projectCivilizationEnlightenerLifeReceipt(receipt);
      expect(projected.command).toEqual(command); assertPublicOnly(projected); assertDetached(projected, receipt); expect(digest(receipt)).toBe(before);
    }
  });

  it('detaches repeated life projections and keeps ledger copies separate from attempt copies', () => {
    const state = captured(), before = digest(state), panel = projectCivilizationEnlightenerLife(state), expected = projectCivilizationEnlightenerLife(state);
    assertDetached(panel, expected); assertDetached(panel.ledger, panel.cases);
    panel.ledger[0]!.before.cash++; panel.ledger[0]!.originalsAfter[0]!.charge++;
    Object.assign(panel.ledger[0]!.date, { day: 1 }); Object.assign(panel.ledger.find(entry => entry.check)!.check!, { roll: 1 });
    panel.cases[0]!.attempts[0]!.receipts[0]!.after.actions++;
    Object.assign(panel.cases[0]!.attempts[0]!.receipts[0]!.command, { method: 'ORDINARY' });
    expect(projectCivilizationEnlightenerLife(state)).toEqual(expected); expect(digest(state)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('preserves adversarial names and legal provenance text rather than stripping tokens globally', () => {
    const state = captured(), name = '原创G source randomSeed randomCursor 维拉';
    state.character.name = name;
    state.civilizationEnlightener.encounter.scene.knownPlayerName = name;
    for (const round of rounds(state)) round.civilizationEnlightenerOutcome!.rootAfter.knownPlayerName = name;
    state.alchemist.life.creations[0]!.source = `公开材料来源 ${name}`;
    const before = digest(state), panel = projectCivilizationEnlightenerLife(state);
    expect(panel.creations[0]!.source).toBe(`公开材料来源 ${name}`);
    for (const round of rounds(state)) expect(projectCivilizationEnlightenerRoundOutcome(round.civilizationEnlightenerOutcome!).rootAfter.knownPlayerName).toBe(name);
    expect(digest(state)).toBe(before);
    // Migrate the authentic capture first; this altered copy only probes display behavior.
    const current = migrateSliceState(captured());
    current.character.name = name; current.civilizationEnlightener.encounter.scene.knownPlayerName = name;
    current.alchemist.life.creations[0]!.source = `公开材料来源 ${name}`;
    for (const round of rounds(current)) round.civilizationEnlightenerOutcome!.rootAfter.knownPlayerName = name;
    const currentBefore = digest(current), view = projectSliceState(current);
    expect(view.character.name).toBe(name); expect(view.civilizationEnlightener.characterName).toBe(name);
    expect(view.civilizationEnlightener.life.creations[0]!.source).toBe(`公开材料来源 ${name}`);
    for (const round of view.combatHistory.filter(item => item.civilizationEnlightenerOutcome)) expect(round.civilizationEnlightenerOutcome!.rootAfter.knownPlayerName).toBe(name);
    expect(digest(current)).toBe(currentBefore); expect(digest(state)).toBe(before);
  });

  it.each(['lastCombatRound', 'combatHistory', 'combat.lastRound'] as const)('routes current %s and the life ledger through the safe mappers without changing the original capture', entrance => {
    const raw = entrance === 'combat.lastRound' ? capturedLive() : captured(), original = digest(raw);
    const state = migrateSliceState(raw), before = digest(state), random = structuredClone(state.random), view = projectSliceState(state);
    const expected = projectCivilizationEnlightenerRoundOutcome(state.lastCombatRound!.civilizationEnlightenerOutcome!);
    if (entrance === 'lastCombatRound') {
      expect(view.lastCombatRound!.civilizationEnlightenerOutcome).toEqual(expected);
      assertPublicOnly(view.lastCombatRound!.civilizationEnlightenerOutcome);
    } else if (entrance === 'combatHistory') {
      const history = view.combatHistory.filter(round => round.civilizationEnlightenerOutcome);
      expect(history).toHaveLength(4); expect(history.at(-1)!.civilizationEnlightenerOutcome).toEqual(expected);
      history.forEach(round => assertPublicOnly(round.civilizationEnlightenerOutcome));
    } else {
      expect(view.combat?.lastRound?.civilizationEnlightenerOutcome).toEqual(expected);
      assertPublicOnly(view.combat!.lastRound!.civilizationEnlightenerOutcome); assertPublicOnly(view.combat!.civilizationEnlightener);
    }
    expect(view.civilizationEnlightener.life.ledger).toEqual(state.civilizationEnlightener.life.journal.map(withoutLifeReplay));
    assertPublicOnly(view.civilizationEnlightener.life.ledger);
    for (const item of view.civilizationEnlightener.life.cases) assertPublicOnly(item.attempts);
    assertDetached(view.civilizationEnlightener.life, state); expect(digest(state)).toBe(before); expect(state.random).toEqual(random);
    expect(digest(raw)).toBe(original); expect(fileDigest()).toBe(FILE_HASH);
  });
});
