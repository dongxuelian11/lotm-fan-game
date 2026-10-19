import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { assertValidSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { openRedPriestRuntimeSession } from '../../src/domain/red-priest/owned-session.js';
import { RED_PRIEST_FROZEN_SOURCE_KEYS } from '../../src/domain/red-priest/source.js';
import { RED_PRIEST_CHARACTERISTIC_IDS, RED_PRIEST_MATERIAL_IDS, RED_PRIEST_UNIQUENESS_ID } from '../../src/domain/red-priest/material-content.js';
import { RED_PRIEST_CAMPAIGN_LEGIONS, RED_PRIEST_CAMPAIGN_NODES, RED_PRIEST_CAMPAIGN_POLITIES } from '../../src/domain/red-priest/campaign-content.js';
import type { RedPriestProjection } from '../../src/domain/red-priest/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { assertFinalUiBoundary, finalUiObserved, finalUiProof } from '../helpers/red-priest-final-ui-fixture.js';
import { bindStoryRow, expectedStory, storyObserved, storyProof } from '../helpers/red-priest-story-fixture.js';
import {
  ROOT, SOURCE, SOURCE_SHA, ORIGINAL_PREFIX_SHA, ORIGINAL_COUNT, FORK_COUNT, FORK_SHA, RECONSTRUCTION_SHA,
  EQUIVALENCE_SHA, FORK_STATE_SHA, FORK_PUBLIC_SHA, PLANNING_INITIAL_PUBLIC_SHA,
  ORIGINAL918_FREEZE_SHA, ORIGINAL983_FREEZE_SHA, authenticateFixture, captureHash, checkpoint,
  compactHash, filePin, hash, initialPlanningSeam, inventory, json, ledger, observed, same, stable,
  type IndependentRuntimeTransition, type ArtifactMap, type BranchRoot, type Checkpoint, type FilePin, type Fork, type Freeze, type Row, type RuntimeTransition,
} from '../helpers/red-priest-capture-fixture.js';

/** One owned-session replay of the entire actual planned tail, starting at918.
 * Original795/796..918 are authenticated, never executed again here. The failed
 * original983 branch is a separate immutable archive, never a victory target.
 * No producer imports, private outcome selection, fixture writes or rerolls. */
interface Summary {
  stage: string; reason: string; commands: number; originalCommands: number; newCommands: number;
  paused: boolean; strictFinalValidation: boolean;
  public: Pick<RedPriestProjection, 'title' | 'promoted' | 'nextStep' | 'resources' | 'abilities' | 'sections'>;
}
interface Reconstruction {
  format: string; allPrivatePublicAndRngEqual: boolean; strictFinalValidation: boolean;
  checkpoint: FilePin; expectedStateSha256: string; expectedPublicSha256: string; random: SliceState['random'];
  checks: Array<{ commandCount: number; fullPrivateBeforeSha256: string; fullPrivateAfterSha256: string;
    publicBeforeSha256: string; publicAfterSha256: string; randomBefore: SliceState['random']; randomAfter: SliceState['random']; enabledAction: boolean }>;
  original983: { files: Array<FilePin & { path: string }>; stage: string; freezeSha256: string; manifest: string; manifestEvidence: FilePin;
    producer: FilePin & { path: string } };
}
interface EquivalenceRow {
  commandCount: number; commandSha256: string; beforeStateSha256: string; stateSha256: string;
  randomBefore: SliceState['random']; random: SliceState['random'];
  capturedPublicBeforeSha256: string; capturedPublicSha256: string; publicBeforeSha256: string; publicSha256: string;
  priorRuntimePublicBeforeSha256: string; priorRuntimePublicSha256: string;
  planningActionRemovedBefore: number; planningActionRemovedAfter: number;
  privateAndRngEqual: boolean; allExistingPublicFieldsEqual: boolean; enabledOriginalAction: boolean;
}
interface Equivalence {
  format: string; commandCount: number; originalFreezeSha256: string; currentRuntimeFreeze: Freeze;
  changedFiles: Array<{ file: string; before: FilePin; after: FilePin }>;
  stateSha256: string; originalPublicSha256: string; continuedPublicSha256: string; random: SliceState['random'];
  strictFinalValidation: boolean; originalInputsUnchanged: boolean; productionUnchangedDuringReplay: boolean;
  inputStartSha256: string; inputEndSha256: string; currentRuntimeEndSha256: string;
  inputFiles: Array<FilePin & { path: string }>;
  replay: { commands: number; first: number; last: number; allPrivateAndRngEqual: boolean;
    allExistingPublicFieldsEqual: boolean; allowedPublicChanges: string[]; rows: EquivalenceRow[] };
  source918: EquivalenceRow & { checkpoint: FilePin; reconstructionProof: FilePin };
}
interface Planned1017Manifest {
  format: string; commandCount: number; checkpointPayloadSha256: string; stateSha256: string; publicSha256: string;
  random: SliceState['random']; freezeSha256: string; files: Array<FilePin & { file: string }>; producer: FilePin & { file: string };
}
interface Continuation {
  format: string; originalCapture: Planned1017Manifest; originalPolicyDefinition: Checkpoint['policyDefinition'];
  continuedPolicyDefinition: Checkpoint['policyDefinition']; originalPolicyState: Checkpoint['policy'];
  originalTerminal: Checkpoint['terminal']; originalRowsSha256: string; originalCommandsSha256: string;
  priorFork: Fork; newFreezeSha256: string; onlyAllowedFreezeChange: string[];
}
interface StabilityRow extends EquivalenceRow {
  stabilityActionsAddedBefore: number; stabilityActionsAddedAfter: number;
  stabilitySectionsAddedBefore: number; stabilitySectionsAddedAfter: number;
  publicAdditionBeforeSha256: string; publicAdditionSha256: string;
}
interface StabilityEquivalence {
  format: string; commandCount: number; originalFreezeSha256: string; currentRuntimeFreeze: Freeze;
  changedFiles: Equivalence['changedFiles']; allowedChanges: string[]; originalRuntimeFiles: Array<FilePin & { file: string; source: string }>;
  stateSha256: string; originalPublicSha256: string; continuedPublicSha256: string; random: SliceState['random'];
  strictFinalValidation: boolean; originalInputsUnchanged: boolean; productionUnchangedDuringReplay: boolean;
  inputStartSha256: string; inputEndSha256: string; currentRuntimeEndSha256: string; inputFiles: Equivalence['inputFiles'];
  unchangedHistoricalConsumptionChecks: Array<{ commandCount: number; compoundId: string; chance: number; roll: number;
    tier: string; outcome: string; randomBefore: SliceState['random']; randomAfter: SliceState['random'];
    stateSha256: string; unchangedHistoricalEventSha256: string }>;
  original983Replay: { proofFile: string; proofSha256: string };
  source1137: { commandCount: number; stateSha256: string; publicSha256: string; random: SliceState['random']; checkpoint: FilePin; payloadSha256: string };
  replay: { commands: number; first: number; last: number; allPrivateAndRngEqual: boolean; allExistingPublicFieldsEqual: boolean;
    allowedPublicChanges: string[]; addedActionChecks: number; addedSectionChecks: number; rows: StabilityRow[] };
  normalizerNegativeTests: { commandCount: number; positiveControlPassed: boolean; noAdditionalReplay: boolean; rejectedMutations: number;
    observedStateSha256: string; observedPublicSha256: string; capturedPublicSha256: string; checks: Array<{ name: string; rejected: boolean }> };
}
interface StabilityContinuation {
  format: string; originalCapture: { format: string; commandCount: number; checkpointPayloadSha256: string; stateSha256: string;
    publicSha256: string; random: SliceState['random']; freezeSha256: string; files: Array<FilePin & { path: string }>; producer: FilePin & { file: string } };
  originalPolicyDefinition: Checkpoint['policyDefinition']; continuedPolicyDefinition: Checkpoint['policyDefinition'];
  originalPolicyState: Checkpoint['policy']; originalTerminal: Checkpoint['terminal']; originalRowsSha256: string; originalCommandsSha256: string;
  priorFork: Fork; priorContinuation: Checkpoint['continuation']; newFreezeSha256: string; runtimeTransition: { proofFile: string; proofSha256: string };
}
const STABILITY_PUBLIC_CHANGES = ['APPENDED_STABILIZE_PROMOTION_PREPARED_COMPOUND_ACTIONS', 'APPENDED_PROMOTION_STABILITY_PREPARED_COMPOUND_SECTION'];
const STABILITY_ALLOWED_FILES = [
  'src/domain/red-priest/types.ts', 'src/domain/red-priest/content.ts', 'src/domain/red-priest/engine.ts',
  'src/domain/red-priest/epilogue.ts', 'src/domain/red-priest/index.ts', 'src/renderer/RedPriestPanel.tsx',
  'dist/domain/red-priest/types.js', 'dist/domain/red-priest/types.js.map', 'dist/domain/red-priest/content.js', 'dist/domain/red-priest/content.js.map',
  'dist/domain/red-priest/engine.js', 'dist/domain/red-priest/engine.js.map', 'dist/domain/red-priest/epilogue.js', 'dist/domain/red-priest/epilogue.js.map',
  'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map',
];
const entry = <T>(key: string): T => readObjectEntry<T>(join(ROOT, 'planned/natural.json'), key);
let raw795: SliceState, root: BranchRoot, initial: SliceState, cp: Checkpoint, rows: Row[], originalRows: Row[];
let report: Summary, transition: IndependentRuntimeTransition, historicalTransition: RuntimeTransition, equivalence: Equivalence, reconstruction: Reconstruction;
let stability: StabilityEquivalence;
let fixtureAuthenticated = false;

function conserve(state: SliceState, before?: SliceState): void {
  const materials = state.redPriest.materials!, campaign = state.redPriest.campaign!;
  expect(materials).not.toBeNull(); expect(campaign).not.toBeNull();
  expect(materials.items.map(item => item.id).sort()).toEqual([...RED_PRIEST_MATERIAL_IDS].sort());
  expect(new Set(materials.items.map(item => item.id)).size).toBe(4);
  expect(materials.items.filter(item => item.kind === 'CHARACTERISTIC')).toHaveLength(3);
  expect(materials.items.filter(item => item.kind === 'UNIQUENESS').map(item => item.id)).toEqual([RED_PRIEST_UNIQUENESS_ID]);
  for (const [index, id] of RED_PRIEST_CHARACTERISTIC_IDS.entries())
    expect(materials.items.find(item => item.id === id)!.sourceBottleId).toBe(raw795.conqueror.bottles[index]!.id);
  same(materials.origin, root.state.redPriest.materials!.origin);
  expect(materials.originDigest).toBe(root.state.redPriest.materials!.originDigest);
  for (const compound of materials.compounds) {
    expect([compound.integratedMaterialId, ...compound.externalMaterialIds].sort()).toEqual([...RED_PRIEST_CHARACTERISTIC_IDS].sort());
    expect(compound.uniquenessId).toBe(RED_PRIEST_UNIQUENESS_ID);
  }
  expect(materials.compounds.filter(c => c.status === 'PREPARED').length).toBeLessThanOrEqual(1);
  same(campaign.origin, root.state.redPriest.campaign!.origin);
  expect(Object.keys(campaign.legions).sort()).toEqual(RED_PRIEST_CAMPAIGN_LEGIONS.map(c => c.id).sort());
  for (const cfg of RED_PRIEST_CAMPAIGN_LEGIONS) {
    const legion = campaign.legions[cfg.id], old = before?.redPriest.campaign!.legions[cfg.id];
    expect(legion.personnel + legion.killed + legion.wounded + legion.detached, cfg.id).toBe(cfg.personnel + legion.reinforcements);
    expect(legion.supply + legion.supplySpent, cfg.id).toBe(cfg.supply + legion.supplyDelivered);
    const arrived = campaign.convoys.filter(c => c.legionId === cfg.id && c.status === 'DELIVERED');
    expect(legion.reinforcements).toBe(arrived.reduce((n, c) => n + c.personnel, 0));
    expect(legion.supplyDelivered).toBe(arrived.reduce((n, c) => n + c.supply, 0));
    expect(legion.detached).toBe(campaign.detachments.filter(d => d.legionId === cfg.id && d.status === 'DEPLOYED').reduce((n, d) => n + d.originalPersonnel, 0));
    if (old) for (const key of ['killed', 'wounded', 'reinforcements', 'supplySpent', 'supplyDelivered'] as const)
      expect(legion[key], `${cfg.id}.${key} must retain actual losses and spending`).toBeGreaterThanOrEqual(old[key]);
  }
  for (const cfg of RED_PRIEST_CAMPAIGN_POLITIES) {
    const polity = campaign.polities[cfg.id];
    expect(polity.treasury + polity.treasurySpent, cfg.id).toBe(cfg.treasury);
    expect(polity.reservePersonnel + polity.reservesCommitted, cfg.id).toBe(cfg.reserves);
    expect(polity.supplyReserve + polity.suppliesCommitted, cfg.id).toBe(cfg.supplyReserve);
    expect(polity.displacedResidents + polity.evacuatedResidents + polity.civilianDeaths).toBeLessThanOrEqual(cfg.residents);
    const sent = campaign.convoys.filter(c => c.polityId === cfg.id && c.status !== 'RETURNED');
    expect(polity.reservesCommitted).toBe(sent.reduce((n, c) => n + c.personnel, 0));
    expect(polity.suppliesCommitted).toBe(sent.reduce((n, c) => n + c.supply, 0));
  }
  for (const cfg of RED_PRIEST_CAMPAIGN_NODES) {
    const node = campaign.nodes[cfg.id], old = before?.redPriest.campaign!.nodes[cfg.id];
    expect(node.displaced + node.evacuated + node.civilianDeaths).toBeLessThanOrEqual(cfg.residents);
    if (old) for (const key of ['coalitionLosses', 'defenderLosses', 'civilianDeaths', 'battleCount'] as const)
      expect(node[key], `${cfg.id}.${key}`).toBeGreaterThanOrEqual(old[key]);
  }
  for (const detachment of campaign.detachments) {
    expect(detachment.killed + detachment.wounded + detachment.returned)
      .toBe(detachment.status === 'RETURNED' ? detachment.originalPersonnel : 0);
  }
  const epilogue = state.redPriest.epilogue;
  if (epilogue) {
    const detachment = campaign.detachments.find(d => d.id === epilogue.detachmentId)!;
    expect(detachment).toBeDefined(); expect(epilogue.personnel).toBe(detachment.originalPersonnel);
    expect(epilogue.patients.map(p => p.id)).toEqual([1, 2, 3].map(n => `${epilogue.originLegionId}:war-wounded:${n}`));
    if (epilogue.status !== 'ACTIVE') {
      expect(epilogue.killed + epilogue.wounded + epilogue.returned).toBe(epilogue.personnel);
      expect(detachment).toMatchObject({ status: 'RETURNED', killed: epilogue.killed, wounded: epilogue.wounded, returned: epilogue.returned });
    }
    // Evacuation changes location/status, never erases the army's old wounded.
    if (before?.redPriest.epilogue) for (const patient of before.redPriest.epilogue.patients.filter(p => p.status === 'EVACUATED'))
      expect(epilogue.patients.find(p => p.id === patient.id)?.status).toBe('EVACUATED');
  }
}

beforeAll(() => {
  authenticateFixture(); fixtureAuthenticated = true;
  raw795 = readObjectEntry<SliceState>(SOURCE, 'final');
  root = checkpoint<BranchRoot>('fork/original-918-checkpoint.json');
  cp = checkpoint<Checkpoint>('planned/checkpoint.json'); rows = ledger(); originalRows = ledger('original983/commands.ndjson');
  report = json<Summary>('planned/summary.json'); transition = json<IndependentRuntimeTransition>('planned/runtime-transition.json');
  historicalTransition = json<RuntimeTransition>('planned1137/runtime-transition.json');
  equivalence = json<Equivalence>('proofs/planning-equivalence.json'); reconstruction = json<Reconstruction>('fork/reconstruction-proof.json');
  stability = json<StabilityEquivalence>('proofs/stability-equivalence.json');
  const captured = hash(root.state); initial = migrateSliceState(root.state);
  expect(hash(root.state), 'Explicit migration never rewrites the raw original918 state').toBe(captured);
  expect(captureHash(initial, root.state)).toBe(FORK_STATE_SHA);
  assertValidSliceState(initial); conserve(initial);
}, 60_000);

afterAll(() => { if (fixtureAuthenticated) authenticateFixture(); }, 60_000);

describe('Red Priest209 exact original918 planned branch', () => {
  it('retains every raw original795/918/983 byte and the full918 prefix without replaying it', () => {
    const oldCommands = readObjectEntry<SliceIntent[]>(SOURCE, 'commands');
    expect(oldCommands).toHaveLength(ORIGINAL_COUNT); expect(compactHash(oldCommands)).toBe(ORIGINAL_PREFIX_SHA);
    expect([raw795.schemaVersion, raw795.contentVersion]).toEqual([184, 'conqueror-v184']);
    expect(raw795).toMatchObject({ revision: 796, week: 200, health: 80, mind: 100, spirituality: 120, cash: 536,
      actionsRemaining: 3, status: 'ACTIVE', random: { seed: 'hunter-rebuild-first', cursor: 376 } });
    expect(raw795.injuries.map(i => i.severity)).toEqual(['LIGHT', 'LIGHT']);
    expect(root).toMatchObject({ format: 'RED_PRIEST_EXACT_PREDECLARATION918_BRANCH_ROOT_V1', source: SOURCE,
      sourceSha256: SOURCE_SHA, prefixSha256: ORIGINAL_PREFIX_SHA, originalRuntimeFreezeSha256: ORIGINAL918_FREEZE_SHA,
      commandCount: FORK_COUNT, finalStateSha256: FORK_STATE_SHA, publicStateSha256: FORK_PUBLIC_SHA,
      random: { seed: 'hunter-rebuild-first', cursor: 423 } });
    expect(root.commands).toHaveLength(123); same(root.rows, originalRows.slice(0, 123));
    same(root.commands, originalRows.slice(0, 123).map(r => r.intent));
    expect(root.state.revision).toBe(919); expect(root.state.status).toBe('ACTIVE');
    expect(root.state.redPriest.campaign).toMatchObject({ phase: 'CRISIS', declaration: null, firstCrossBorder: null, warStarted: null });
    expect(Object.hasOwn(root.state.redPriest.campaign!, 'planning')).toBe(false);
    const fullPrefix = [...oldCommands, ...root.commands], commands = entry<SliceIntent[]>('commands');
    same(commands.slice(0, FORK_COUNT), fullPrefix); expect(compactHash(fullPrefix)).toBe(observed().prefixSha256);
    same(commands.slice(FORK_COUNT), cp.commands); expect(commands).toHaveLength(observed().commands);
    const archive = checkpoint<Checkpoint>('original983/checkpoint.json');
    expect(archive.commandCount).toBe(983); expect(archive.state.progression.sequence).toBe(1);
    expect(archive.state.status).toBe('ACTIVE'); expect(archive.state.redPriest.campaign!.phase).toBe('WITHDRAWN');
    expect(archive.terminal?.stage).toBe('FINITE_CAMPAIGN_WITHDRAWN');
    expect(archive.state.random).toEqual({ seed: 'hunter-rebuild-first', cursor: 427 });
    expect(archive.commands[123]).toEqual({ type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'DECLARE_OFFENSIVE' } } });
    expect(cp.commands[0]).toEqual({ type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } } });
    same(readObjectEntry<SliceIntent[]>(join(ROOT, 'original983/natural.json'), 'commands').slice(0, FORK_COUNT), fullPrefix);
    expect(reconstruction.original983.files).toHaveLength(57);
    expect(inventory(join(ROOT, 'original983'))).toEqual(reconstruction.original983.files.map(f => f.path).sort());
    for (const { path, ...pin } of reconstruction.original983.files) expect(filePin(join(ROOT, 'original983', path)), path).toEqual(pin);
    expect(reconstruction).toMatchObject({ format: 'RED_PRIEST_EXACT_PREDECLARATION918_RECONSTRUCTION_PROOF_V1',
      allPrivatePublicAndRngEqual: true, strictFinalValidation: true, expectedStateSha256: FORK_STATE_SHA, expectedPublicSha256: FORK_PUBLIC_SHA,
      random: root.state.random, checkpoint: filePin(join(ROOT, 'fork/original-918-checkpoint.json')) });
    expect(reconstruction.checks.map(r => r.commandCount)).toEqual([916, 917, 918]);
    for (const check of reconstruction.checks) {
      const row = originalRows[check.commandCount - ORIGINAL_COUNT - 1]!;
      expect(check).toEqual({ commandCount: row.commandCount, fullPrivateBeforeSha256: row.beforeStateSha256,
        fullPrivateAfterSha256: row.afterStateSha256, publicBeforeSha256: row.publicBeforeSha256,
        publicAfterSha256: row.publicAfterSha256, randomBefore: row.randomBefore, randomAfter: row.randomAfter, enabledAction: true });
    }
  }, 60_000);

  it('binds all188 old private/RNG/public proof rows and the exact appended planning action seam', () => {
    expect(equivalence).toMatchObject({ format: 'RED_PRIEST983_PLANNING_TRANSITION_V1', commandCount: 983,
      originalFreezeSha256: ORIGINAL983_FREEZE_SHA, strictFinalValidation: true,
      originalInputsUnchanged: true, productionUnchangedDuringReplay: true,
      replay: { commands: 188, first: 796, last: 983, allPrivateAndRngEqual: true,
        allExistingPublicFieldsEqual: true, allowedPublicChanges: ['APPENDED_ENABLE_PLANNING_CRISIS_ACTION'] } });
    expect(equivalence.inputStartSha256).toBe(equivalence.inputEndSha256);
    expect(equivalence.currentRuntimeEndSha256).toBe(equivalence.currentRuntimeFreeze.sha256);
    expect(compactHash(equivalence.currentRuntimeFreeze.files)).toBe(equivalence.currentRuntimeFreeze.sha256);
    expect(equivalence.replay.rows).toHaveLength(188); expect(originalRows).toHaveLength(188);
    const restoration = json<{ replay: { rows: Array<{ publicSha256: string }> } }>('original983/prior-proof/runtime-transition.json');
    expect(restoration.replay.rows).toHaveLength(179);
    let priorPublic: string | undefined;
    for (const [index, check] of equivalence.replay.rows.entries()) {
      const row = originalRows[index]!, previous = equivalence.replay.rows[index - 1];
      const historicalAfter = index < 179 ? restoration.replay.rows[index]!.publicSha256 : row.publicAfterSha256;
      expect(check).toMatchObject({ commandCount: ORIGINAL_COUNT + index + 1, commandSha256: row.commandSha256,
        beforeStateSha256: row.beforeStateSha256, stateSha256: row.afterStateSha256,
        randomBefore: row.randomBefore, random: row.randomAfter,
        capturedPublicBeforeSha256: row.publicBeforeSha256, capturedPublicSha256: row.publicAfterSha256,
        priorRuntimePublicBeforeSha256: priorPublic ?? row.publicBeforeSha256, priorRuntimePublicSha256: historicalAfter,
        privateAndRngEqual: true, allExistingPublicFieldsEqual: true, enabledOriginalAction: true });
      for (const count of [check.planningActionRemovedBefore, check.planningActionRemovedAfter]) expect([0, 1]).toContain(count);
      if (!check.planningActionRemovedBefore) expect(check.publicBeforeSha256).toBe(check.priorRuntimePublicBeforeSha256);
      if (!check.planningActionRemovedAfter) expect(check.publicSha256).toBe(check.priorRuntimePublicSha256);
      if (previous) expect(check.publicBeforeSha256).toBe(previous.publicSha256);
      priorPublic = historicalAfter;
    }
    expect(equivalence.source918).toMatchObject({ ...equivalence.replay.rows[122], checkpoint: reconstruction.checkpoint,
      reconstructionProof: filePin(join(ROOT, 'fork/reconstruction-proof.json')) });
    const archive = checkpoint<Checkpoint>('original983/checkpoint.json');
    expect(equivalence.stateSha256).toBe(hash(archive.state)); expect(equivalence.random).toEqual(archive.state.random);
    expect(equivalence.originalPublicSha256).toBe(archive.publicStateSha256);
    expect(equivalence.continuedPublicSha256).toBe(archive.publicStateSha256);
    expect(historicalTransition).toMatchObject({ format: 'RED_PRIEST918_PLANNING_TRANSITION_V1', commandCount: FORK_COUNT,
      originalRuntimeFreezeSha256: ORIGINAL918_FREEZE_SHA, stateSha256: FORK_STATE_SHA,
      originalPublicSha256: FORK_PUBLIC_SHA, continuedPublicSha256: PLANNING_INITIAL_PUBLIC_SHA,
      random: root.state.random, unchangedPrivateAndRng: true, publicDifference: 'Only appended ENABLE_PLANNING action',
      allowedPublicChanges: ['APPENDED_ENABLE_PLANNING_CRISIS_ACTION'], original983Replay: { proofSha256: EQUIVALENCE_SHA } });
    // Stored path strings remain historical bytes; relocation is handled by the
    // separately pinned artifact map, never by rewriting proof JSON.
    expect(historicalTransition.original983Replay.proofFile).toBe('output/qa-0209/planning-equivalence/proof.json');
    initialPlanningSeam(openRedPriestRuntimeSession(initial).projectRedPriest(), transition);
  }, 60_000);

  it('resolves historical artifacts through hash-bound portable aliases without rewriting their raw source paths', () => {
    const map = json<ArtifactMap>('proofs/input-locations.json');
    expect(map.format).toBe('RED_PRIEST_PLANNED_VERIFIER_ARTIFACT_MAP_V1');
    const identities = map.entries.map(e => `${e.kind}:${e.name}:${e.sha256}`);
    expect(new Set(identities).size).toBe(identities.length);
    for (const e of map.entries) {
      expect(['ARTIFACT', 'FROZEN_RUNTIME']).toContain(e.kind);
      expect(e.path.startsWith('/')).toBe(false); expect(e.path).not.toMatch(/[\\\0]/);
      expect(e.path.split('/').every(part => part !== '' && part !== '.' && part !== '..')).toBe(true);
      expect(filePin(join(ROOT, e.path)), `${e.kind}:${e.name}`).toEqual({ bytes: e.bytes, sha256: e.sha256 });
    }
    for (const input of [...equivalence.inputFiles, ...stability.inputFiles]) {
      const match = map.entries.filter(e => e.kind === 'ARTIFACT' && e.name === input.path && e.sha256 === input.sha256);
      expect(match, input.path).toHaveLength(1); expect(match[0]!.bytes).toBe(input.bytes);
    }
    for (const source of ['original983/prior-observation/prior-observation/prior-observation/freeze.json', 'planned1017/freeze.json', 'planned1137/freeze.json']) {
      for (const old of json<Freeze>(source).files) {
        if (stability.currentRuntimeFreeze.files.some(now => stable(now) === stable(old))) continue;
        const match = map.entries.filter(e => e.kind === 'FROZEN_RUNTIME' && e.name === old.file && e.sha256 === old.sha256);
        expect(match, `Exact historical runtime identity ${source}:${old.file}`).toHaveLength(1);
        expect(match[0]!.bytes).toBe(old.bytes);
      }
    }
    for (const change of stability.changedFiles)
      expect(map.entries.some(e => e.sha256 === change.before.sha256 && e.bytes === change.before.bytes), `Retain pre-stability ${change.file}`).toBe(true);
    const proofAlias = map.entries.find(e => e.kind === 'ARTIFACT' && e.name === historicalTransition.original983Replay.proofFile && e.sha256 === EQUIVALENCE_SHA);
    expect(proofAlias?.path).toBe('proofs/planning-equivalence.json');
    const archiveFreeze = json<Freeze>('original983/freeze.json');
    expect(archiveFreeze.sha256).toBe(ORIGINAL983_FREEZE_SHA);
    expect(compactHash(archiveFreeze.files)).toBe(archiveFreeze.sha256);
    expect(equivalence.changedFiles.map(c => c.file)).toEqual([
      'src/domain/red-priest/campaign.ts', 'src/domain/red-priest/engine.ts', 'src/domain/red-priest/index.ts', 'src/renderer/RedPriestPanel.tsx',
      'dist/domain/red-priest/campaign.js', 'dist/domain/red-priest/campaign.js.map', 'dist/domain/red-priest/engine.js',
      'dist/domain/red-priest/engine.js.map', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map',
    ]);
    for (const change of equivalence.changedFiles) {
      expect(archiveFreeze.files.find(f => f.file === change.file)).toEqual({ file: change.file, ...change.before });
      expect(equivalence.currentRuntimeFreeze.files.find(f => f.file === change.file)).toEqual({ file: change.file, ...change.after });
      expect(map.entries.some(e => e.sha256 === change.before.sha256 && e.bytes === change.before.bytes), `Retain historical ${change.file}`).toBe(true);
    }
    const restored = equivalence.currentRuntimeFreeze.files.map(file => {
      const changed = equivalence.changedFiles.find(c => c.file === file.file);
      return changed ? { file: file.file, ...changed.before } : file;
    });
    same(restored, archiveFreeze.files.filter(f => f.file !== '$natural-producer'));
  }, 120_000);

  it('retains the actual1017 observation and permits only its approved5-to20 negotiation-cap continuation', () => {
    // The1017 continuation is the immutable middle1137 capture. Its old proof,
    // fork and source freeze remain intact when the later stability tail starts.
    const cp = checkpoint<Checkpoint>('planned1137/checkpoint.json');
    const pin = json<Planned1017Manifest>('proofs/planned1017-manifest.json');
    const old = checkpoint<Checkpoint>('planned1017/checkpoint.json'), oldRows = ledger('planned1017/commands.ndjson');
    const proof = json<Continuation>('planned1137/continuation.json');
    expect(pin).toMatchObject({ format: 'RED_PRIEST1017_SEALED_CAPTURE_V1', commandCount: 1017,
      checkpointPayloadSha256: 'ad9a5f482a9c70c182bb10abb781df3c9b330ceba9055ed6241145eb51d25d56',
      stateSha256: 'fd4dfbe50b8ab6fcbe1ba02f7ba6465358f2d0d4402a8081a732fa0b92813cdc',
      publicSha256: 'bfaa38148d473d572d8fa41642f0a99e88ed49368b3fe7cdeeacdd051d39d9d2',
      random: { seed: 'hunter-rebuild-first', cursor: 434 } });
    expect(pin.files).toHaveLength(6); expect(inventory(join(ROOT, 'planned1017'))).toEqual(pin.files.map(f => f.file).sort());
    for (const { file, ...fileExpected } of pin.files) expect(filePin(join(ROOT, 'planned1017', file)), file).toEqual(fileExpected);
    expect(hash(old)).toBe(pin.checkpointPayloadSha256); expect(hash(old.state)).toBe(pin.stateSha256);
    expect(old.publicStateSha256).toBe(pin.publicSha256); expect(old.state.random).toEqual(pin.random);
    expect(old.state.status).toBe('ACTIVE'); expect(old.state.progression.sequence).toBe(1);
    expect(old.state.redPriest.campaign!.phase).toBe('WAR'); expect(old.pending).toBeNull();
    expect(old.terminal).toEqual({ stage: 'FINITE_CAMPAIGN_REVIEW_REQUIRED', reason: 'Actual truce was refused within the finite negotiation policy' });
    expect(old.rows).toHaveLength(99); same(oldRows, old.rows); same(cp.rows.slice(0, 99), old.rows); same(cp.commands.slice(0, 99), old.commands);
    same(readObjectEntry<SliceIntent[]>(join(ROOT, 'planned1137/natural.json'), 'commands').slice(0, 1017), readObjectEntry(join(ROOT, 'planned1017/natural.json'), 'commands'));
    expect(cp.commandCount).toBeGreaterThan(1017); expect(cp.rows[99]!.commandCount).toBe(1018);
    expect(cp.rows[99]!.beforeStateSha256).toBe(pin.stateSha256); expect(cp.rows[99]!.publicBeforeSha256).toBe(pin.publicSha256);
    expect(cp.rows[99]!.randomBefore).toEqual(pin.random);
    expect(proof).toEqual({ format: 'RED_PRIEST1017_ARMISTICE_OBSERVATION_CONTINUATION_V1', originalCapture: pin,
      originalPolicyDefinition: old.policyDefinition, continuedPolicyDefinition: cp.policyDefinition, originalPolicyState: old.policy,
      originalTerminal: old.terminal, originalRowsSha256: compactHash(old.rows), originalCommandsSha256: compactHash(old.commands),
      priorFork: old.fork, newFreezeSha256: cp.freezeSha256, onlyAllowedFreezeChange: ['$natural-producer'] });
    expect(old.policyDefinition).toMatchObject({ armisticeAttempts: 5 });
    expect(cp.policyDefinition).toEqual({ ...old.policyDefinition, armisticeAttempts: 20 });
    expect(cp.continuation).toEqual({ proofFile: 'continuation.json', proofSha256: filePin(join(ROOT, 'planned1137/continuation.json')).sha256, originalCommandCount: 1017 });
    expect(readObjectEntry<{ continuation: Checkpoint['continuation'] }>(join(ROOT, 'planned1137/natural.json'), 'provenance').continuation).toEqual(cp.continuation);
    const oldFreeze = json<Freeze>('planned1017/freeze.json'), newFreeze = json<Freeze>('planned1137/freeze.json');
    expect(compactHash(oldFreeze.files)).toBe(oldFreeze.sha256); expect(oldFreeze.sha256).toBe(pin.freezeSha256);
    expect(oldFreeze.files.find(f => f.file === '$natural-producer')).toEqual({ ...pin.producer, file: '$natural-producer' });
    same(newFreeze.files.map(f => f.file === '$natural-producer' ? { ...pin.producer, file: '$natural-producer' } : f), oldFreeze.files);
    const oldTransition = json<RuntimeTransition>('planned1017/runtime-transition.json');
    same(historicalTransition, { ...oldTransition, newRuntimeFreezeSha256: cp.freezeSha256 });
  }, 60_000);

  it('preserves the genuine1137 observation, both5% failed doses and all219 exact public/private/RNG proof boundaries', () => {
    const cp = checkpoint<Checkpoint>('historical-stable-failure/checkpoint.json');
    const entry = <T>(key: string): T => readObjectEntry<T>(join(ROOT, 'historical-stable-failure/natural.json'), key);
    const files = json<Array<FilePin & { path: string }>>('proofs/planned1137-manifest.json');
    const prior = checkpoint<Checkpoint>('planned1137/checkpoint.json'), proof = json<StabilityContinuation>('historical-stable-failure/stability-continuation.json');
    expect(files).toHaveLength(7); expect(inventory(join(ROOT, 'planned1137'))).toEqual(files.map(f => f.path).sort());
    for (const { path, ...pin } of files) expect(filePin(join(ROOT, 'planned1137', path)), path).toEqual(pin);
    expect(prior.commandCount).toBe(1137); expect(prior.commands).toHaveLength(219); expect(prior.rows).toHaveLength(219);
    expect(prior.pending).toBeNull(); expect(prior.stabilityContinuation).toBeUndefined();
    expect(hash(prior)).toBe('0ab3ef4e30ca552ed16611439a270ac921f0d1763af3854b3d3cb58c95290a88');
    expect(prior.finalStateSha256).toBe('ef0a3d0bad112bb15156257e905d65c00dbadce7c79914d58fa097d52c8062bc');
    expect(hash(prior.state)).toBe(prior.finalStateSha256);
    expect(prior.publicStateSha256).toBe('5bfa25052d1fb2a01c8d0f1ce8424d0318477aabfe6f5baf0e778ce97490f354');
    expect(prior.state).toMatchObject({ status: 'ACTIVE', progression: { sequence: 1 }, random: { seed: 'hunter-rebuild-first', cursor: 477 } });
    expect(prior.state.redPriest.campaign!.phase).toBe('ARMISTICE'); expect(prior.state.redPriest.epilogue).toBeNull();
    expect(Object.hasOwn(prior.state.redPriest, 'promotionStability')).toBe(false);
    expect(prior.terminal).toEqual({ stage: 'FINITE_MATERIAL_ATTEMPTS', reason: 'Finite attempts exhausted for 完成原件保管交接' });
    same(cp.commands.slice(0, 219), prior.commands); same(cp.rows.slice(0, 219), prior.rows);
    same(entry<SliceIntent[]>('commands').slice(0, 1137), readObjectEntry(join(ROOT, 'planned1137/natural.json'), 'commands'));
    for (const name of ['runtime-transition.json', 'continuation.json']) expect(filePin(join(ROOT, 'historical-stable-failure', name))).toEqual(filePin(join(ROOT, 'planned1137', name)));
    expect(cp.fork).toEqual(prior.fork); expect(cp.continuation).toEqual(prior.continuation);
    const oldFreeze = json<Freeze>('planned1137/freeze.json');
    expect(compactHash(oldFreeze.files)).toBe(oldFreeze.sha256); expect(oldFreeze.sha256).toBe(prior.freezeSha256);
    expect(stability).toMatchObject({ format: 'RED_PRIEST1137_STABILITY_TRANSITION_V1', commandCount: 1137,
      originalFreezeSha256: prior.freezeSha256, stateSha256: prior.finalStateSha256,
      originalPublicSha256: prior.publicStateSha256, continuedPublicSha256: prior.publicStateSha256, random: prior.state.random,
      strictFinalValidation: true, originalInputsUnchanged: true, productionUnchangedDuringReplay: true,
      replay: { commands: 219, first: 919, last: 1137, allPrivateAndRngEqual: true, allExistingPublicFieldsEqual: true,
        allowedPublicChanges: STABILITY_PUBLIC_CHANGES, addedActionChecks: 6, addedSectionChecks: 6 } });
    expect(stability.replay.rows).toHaveLength(219);
    expect(stability.inputStartSha256).toBe(hash(stability.inputFiles)); expect(stability.inputEndSha256).toBe(stability.inputStartSha256);
    expect(stability.currentRuntimeEndSha256).toBe(stability.currentRuntimeFreeze.sha256);
    expect(compactHash(stability.currentRuntimeFreeze.files)).toBe(stability.currentRuntimeFreeze.sha256);
    expect(stability.original983Replay).toEqual({ proofFile: 'output/qa-0209/planning-equivalence/proof.json', proofSha256: EQUIVALENCE_SHA });
    expect(stability.source1137).toMatchObject({ commandCount: 1137, stateSha256: prior.finalStateSha256, publicSha256: prior.publicStateSha256,
      random: prior.state.random, checkpoint: filePin(join(ROOT, 'planned1137/checkpoint.json')), payloadSha256: hash(prior) });
    for (const [index, check] of stability.replay.rows.entries()) {
      const row = prior.rows[index]!, previous = stability.replay.rows[index - 1];
      expect(check).toMatchObject({ commandCount: 919 + index, commandSha256: row.commandSha256,
        beforeStateSha256: row.beforeStateSha256, stateSha256: row.afterStateSha256, randomBefore: row.randomBefore, random: row.randomAfter,
        capturedPublicBeforeSha256: row.publicBeforeSha256, capturedPublicSha256: row.publicAfterSha256,
        priorRuntimePublicBeforeSha256: row.publicBeforeSha256, priorRuntimePublicSha256: row.publicAfterSha256,
        privateAndRngEqual: true, allExistingPublicFieldsEqual: true, enabledOriginalAction: true });
      const before = Number([1029, 1030, 1031, 1112, 1113, 1114].includes(row.commandCount));
      const after = Number([1028, 1029, 1030, 1111, 1112, 1113].includes(row.commandCount));
      expect(check.stabilityActionsAddedBefore).toBe(before); expect(check.stabilitySectionsAddedBefore).toBe(before);
      expect(check.stabilityActionsAddedAfter).toBe(after); expect(check.stabilitySectionsAddedAfter).toBe(after);
      for (const value of [check.publicBeforeSha256, check.publicSha256, check.publicAdditionBeforeSha256, check.publicAdditionSha256]) expect(value).toMatch(/^[a-f0-9]{64}$/);
      if (!before) expect(check.publicBeforeSha256).toBe(row.publicBeforeSha256);
      if (!after) expect(check.publicSha256).toBe(row.publicAfterSha256);
      if (previous) expect(check.publicBeforeSha256).toBe(previous.publicSha256);
    }
    expect(stability.unchangedHistoricalConsumptionChecks).toEqual([1031, 1114].map((count, index) => {
      const row = prior.rows[count - 919]!, event = prior.state.redPriest.journal.find(e => e.revision === row.revision)!;
      if (row.intent.type !== 'RED_PRIEST' || row.intent.command.type !== 'CONSUME') throw Error('Original failed dose missing');
      expect(event.randomReceipts[0]!.check).toMatchObject({ chance: 5, roll: [42, 58][index], tier: 'FAILURE', modifiers: [] });
      expect(event.materialReceipt?.consumption?.outcome).toBe('FAILURE');
      return { commandCount: count, compoundId: row.intent.command.compoundId, chance: 5, roll: [42, 58][index], tier: 'FAILURE', outcome: 'FAILURE',
        randomBefore: row.randomBefore, randomAfter: row.randomAfter, stateSha256: row.afterStateSha256, unchangedHistoricalEventSha256: hash(event) };
    }));
    const negative = stability.normalizerNegativeTests, prepared = stability.replay.rows[1028 - 919]!;
    expect(negative).toMatchObject({ commandCount: 1028, positiveControlPassed: true, noAdditionalReplay: true, rejectedMutations: 12,
      observedStateSha256: prepared.stateSha256, observedPublicSha256: prepared.publicSha256, capturedPublicSha256: prepared.capturedPublicSha256 });
    expect(negative.checks).toEqual(['missing-new-section', 'missing-new-action', 'extra-new-section', 'extra-new-action',
      'changed-preparation-cost', 'changed-preparation-section', 'changed-original-resource', 'changed-original-action-cost', 'removed-original-section',
      'misplaced-new-action', 'under-removal-rejected-by-complete-public-hash', 'over-removal-rejected-by-complete-public-hash'].map(name => ({ name, rejected: true })));
    expect(stability.allowedChanges).toEqual(STABILITY_ALLOWED_FILES);
    for (const changed of stability.changedFiles) {
      expect(STABILITY_ALLOWED_FILES).toContain(changed.file);
      expect(oldFreeze.files.find(f => f.file === changed.file)).toEqual({ file: changed.file, ...changed.before });
      expect(stability.currentRuntimeFreeze.files.find(f => f.file === changed.file)).toEqual({ file: changed.file, ...changed.after });
    }
    for (const required of STABILITY_ALLOWED_FILES.filter(f => !['dist/domain/red-priest/types.js', 'dist/domain/red-priest/types.js.map', 'dist/domain/red-priest/epilogue.js', 'dist/domain/red-priest/epilogue.js.map'].includes(f)))
      expect(stability.changedFiles.some(f => f.file === required), required).toBe(true);
    same(stability.currentRuntimeFreeze.files.map(file => {
      const change = stability.changedFiles.find(c => c.file === file.file); return change ? { file: file.file, ...change.before } : file;
    }), oldFreeze.files.filter(f => f.file !== '$natural-producer'));
    same(stability.originalRuntimeFiles.map(({ source: _source, ...file }) => file), oldFreeze.files.filter(f => f.file !== '$natural-producer'));
    expect(proof.originalCapture).toEqual({ format: 'RED_PRIEST1137_SEALED_CAPTURE_V1', commandCount: 1137, checkpointPayloadSha256: hash(prior),
      stateSha256: prior.finalStateSha256, publicSha256: prior.publicStateSha256, random: prior.state.random, freezeSha256: prior.freezeSha256, files,
      producer: { file: 'producer.mjs', bytes: 61731, sha256: 'd19b9b1181d3826c61a9cd8da412ed2ae8114d1645486944a91a493bf581d0ef' } });
    expect(proof).toEqual({ format: 'RED_PRIEST1137_STABILITY_CONTINUATION_V1', originalCapture: proof.originalCapture,
      originalPolicyDefinition: prior.policyDefinition, continuedPolicyDefinition: cp.policyDefinition, originalPolicyState: prior.policy,
      originalTerminal: prior.terminal, originalRowsSha256: compactHash(prior.rows), originalCommandsSha256: compactHash(prior.commands),
      priorFork: prior.fork, priorContinuation: prior.continuation, newFreezeSha256: cp.freezeSha256,
      runtimeTransition: { proofFile: 'output/qa-0209/stability-equivalence/proof.json', proofSha256: observed().stabilityEquivalenceSha256 } });
    expect(cp.policyDefinition).toEqual({ ...prior.policyDefinition, id: 'RED_PRIEST1137_STABLE_POSTWAR_CONTINUATION_V1',
      materialAttemptScope: 'SINCE_LAST_ACTUAL_CONSUMPTION', promotionPreparation: 'REQUIRE_SAME_COMPOUND_PAID_STABILITY', minimumMindBeforeStability: 78, preparedEpilogue: true });
    expect(cp.stabilityContinuation).toEqual({ proofFile: 'stability-continuation.json', proofSha256: filePin(join(ROOT, 'historical-stable-failure/stability-continuation.json')).sha256, originalCommandCount: 1137 });
    expect(entry<{ stabilityContinuation: Checkpoint['stabilityContinuation'] }>('provenance').stabilityContinuation).toEqual(cp.stabilityContinuation);
    expect(cp.rows[219]).toMatchObject({ commandCount: 1138, beforeStateSha256: prior.finalStateSha256,
      publicBeforeSha256: stability.continuedPublicSha256, randomBefore: prior.state.random });
    let cycle = { startedAfterCommand: FORK_COUNT, attempts: {} as Record<string, number> };
    for (const [index, intent] of cp.commands.entries()) {
      if (intent.type !== 'RED_PRIEST') throw Error('Non-Red Priest command in recorded recovery cycle');
      if (intent.command.type === 'CONSUME') cycle = { startedAfterCommand: 919 + index, attempts: {} };
      else if (intent.command.type === 'MATERIAL' && intent.command.command.type !== 'PREPARE_COMPOUND') {
        const key = JSON.stringify(intent.command); cycle.attempts[key] = (cycle.attempts[key] ?? 0) + 1;
        if (index >= 219) expect(cycle.attempts[key]).toBeLessThanOrEqual(12);
      }
    }
    expect(cp.policy.materialCycle).toEqual(cycle);
    const failedManifest = json<{ files: Array<FilePin & { path: string }>; totalBytes: number }>('proofs/stable-failure1222-manifest.json');
    expect(failedManifest.totalBytes).toBe(14898350); expect(failedManifest.files).toHaveLength(8);
    expect(inventory(join(ROOT, 'historical-stable-failure'))).toEqual(failedManifest.files.map(f => f.path).sort());
    for (const { path, ...pin } of failedManifest.files) expect(filePin(join(ROOT, 'historical-stable-failure', path)), path).toEqual(pin);
    expect(hash(cp)).toBe('78903719a4e322bc6781b759ece4653e84546a3eb0e4fdf04809bc2abba41147');
    expect(cp.commandCount).toBe(1222); expect(cp.rows).toHaveLength(304); expect(cp.commands).toHaveLength(304);
    expect(cp.finalStateSha256).toBe('860dbc38a705a19021e6c3c43c28d2e6e342610d2c6db8c6e1aea1b45d5426ee');
    expect(cp.publicStateSha256).toBe('a736ce2018e86d2083bcde13fca8b89d7f9438762d41133a8064453a3023aeba');
    expect(hash(cp.state)).toBe(cp.finalStateSha256); expect(hash(entry('final'))).toBe(cp.finalStateSha256);
    expect(cp.state).toMatchObject({ status: 'ACTIVE', progression: { sequence: 1 }, random: { seed: 'hunter-rebuild-first', cursor: 501 } });
    expect(cp.terminal).toEqual({ stage: 'ORIGINAL_MATERIAL_UNAVAILABLE', reason: 'An original material is publicly unavailable; no replacement, reset or reroll is permitted' });
    expect(cp.pending).toBeNull(); same(ledger('historical-stable-failure/commands.ndjson'), cp.rows);
    same(cp.state.redPriest.journal.slice(0, prior.state.redPriest.journal.length), prior.state.redPriest.journal);
    const failedFreeze = json<Freeze>('historical-stable-failure/freeze.json');
    expect(compactHash(failedFreeze.files)).toBe(failedFreeze.sha256); expect(failedFreeze.sha256).toBe(cp.freezeSha256);
    same(failedFreeze.files.filter(f => f.file !== '$natural-producer'), stability.currentRuntimeFreeze.files);
    expect(failedFreeze.files.find(f => f.file === '$natural-producer')).toEqual({ file: '$natural-producer', bytes: 71168,
      sha256: 'a30fa59580e04dfe916d3e75a5d492d2a2d0d2b99b3218816ba18572299c8a17' });
    for (const [index, row] of cp.rows.entries()) {
      expect(row.commandCount).toBe(919 + index); expect(row.commandSha256).toBe(compactHash(row.intent)); same(row.intent, cp.commands[index]);
      if (index) { expect(row.beforeStateSha256).toBe(cp.rows[index - 1]!.afterStateSha256); expect(row.randomBefore).toEqual(cp.rows[index - 1]!.randomAfter); }
    }
    expect(cp.state.redPriest.journal.filter(e => e.command.type === 'CONSUME').map(e => ({ chance: e.randomReceipts[0]!.check.chance,
      roll: e.randomReceipts[0]!.check.roll, tier: e.randomReceipts[0]!.check.tier }))).toEqual([
      { chance: 5, roll: 42, tier: 'FAILURE' }, { chance: 5, roll: 58, tier: 'FAILURE' }, { chance: 68, roll: 90, tier: 'FAILURE' }]);
    expect(cp.rows[1209 - 919]!.intent).toEqual({ type: 'RED_PRIEST', command: { type: 'STABILIZE_PROMOTION', compoundId: 'red-priest:ordinary-compound-pack:3:EMPTY_BOTTLE' } });
    expect(cp.rows[1211 - 919]!.intent).toEqual({ type: 'RED_PRIEST', command: { type: 'CONSUME', compoundId: 'red-priest:ordinary-compound-pack:3:EMPTY_BOTTLE', confirmed: true } });
    expect(cp.state.redPriest.promotionStability!.preparations).toHaveLength(1);
    expect(cp.state.redPriest.promotionStability!.preparations[0]).toMatchObject({ status: 'SPENT', eventId: 'R209:hunter-rebuild-natural:1210', spentEventId: 'R209:hunter-rebuild-natural:1212' });
  }, 60_000);

  it('binds a fresh full918 first-compound strategy to every preserved branch without claiming continuation of the1222 failure', () => {
    const failed = checkpoint<Checkpoint>('historical-stable-failure/checkpoint.json');
    const manifest = json<unknown>('planned/history-manifest.json'), map = json<ArtifactMap>('proofs/input-locations.json');
    const prior1017 = json<Planned1017Manifest>('proofs/planned1017-manifest.json');
    const failedManifest = json<{ files: Array<FilePin & { path: string }> }>('proofs/stable-failure1222-manifest.json');
    const sources = [
      { id: 'source918', directory: 'output/qa-0209/planning-candidate', commandCount: 918,
        files: ['original-918-checkpoint.json', 'reconstruction-proof.json'].map(path => ({ path, ...filePin(join(ROOT, 'fork', path)) })),
        stateSha256: FORK_STATE_SHA, publicSha256: FORK_PUBLIC_SHA, random: root.state.random },
      { id: 'original983', directory: 'output/play/red-priest-02090-recovery', commandCount: 983, files: reconstruction.original983.files,
        producer: reconstruction.original983.producer, manifest: { path: reconstruction.original983.manifest, ...reconstruction.original983.manifestEvidence } },
      { id: 'planned1017', directory: 'output/play/red-priest-02090-planned', commandCount: 1017,
        files: prior1017.files.map(({ file, ...pin }) => ({ path: file, ...pin })),
        producer: { path: 'output/qa-0209/planning-continuation-candidate/original-1017.producer.mjs', bytes: prior1017.producer.bytes, sha256: prior1017.producer.sha256 } },
      { id: 'planned1137', directory: 'output/play/red-priest-02090-planned-continued', commandCount: 1137,
        files: json<Array<FilePin & { path: string }>>('proofs/planned1137-manifest.json'),
        producer: { path: 'scripts/play/red-priest-planned-continue.mjs', bytes: 61731, sha256: 'd19b9b1181d3826c61a9cd8da412ed2ae8114d1645486944a91a493bf581d0ef' } },
      { id: 'stable1222', directory: 'output/play/red-priest-02090-stable-continued', commandCount: 1222, files: failedManifest.files,
        producer: { path: 'scripts/play/red-priest-stable-continue.mjs', bytes: 71168, sha256: 'a30fa59580e04dfe916d3e75a5d492d2a2d0d2b99b3218816ba18572299c8a17' },
        manifest: { path: 'output/play/red-priest-02090-stable-continued.all-files.json', ...filePin(join(ROOT, 'proofs/stable-failure1222-manifest.json')) },
        checkpointPayloadSha256: hash(failed), stateSha256: failed.finalStateSha256, publicSha256: failed.publicStateSha256,
        random: failed.state.random, terminal: failed.terminal },
    ];
    const proofs = [
      { id: 'historicalPlanning983', path: 'output/qa-0209/planning-equivalence/proof.json', ...filePin(join(ROOT, 'proofs/planning-equivalence.json')),
        scope: 'Original188 commands796-983 under the historical planning runtime only; not a current-stability188 replay' },
      { id: 'currentStability219', path: 'output/qa-0209/stability-equivalence/proof.json', ...filePin(join(ROOT, 'proofs/stability-equivalence.json')),
        scope: 'Original219 planned commands919-1137 under the exact current runtime, including the genuine918 initial private/RNG/public boundary' },
    ];
    const used = new Set([...sources.flatMap(s => s.files.map(f => `${s.directory}/${f.path}`)),
      ...sources.flatMap(s => [s.producer?.path, s.manifest?.path].filter((v): v is string => Boolean(v))), ...proofs.map(p => p.path)]);
    const additionalProofInputs = stability.inputFiles.map(e => ({ ...e,
      path: e.path.replace(/^\/workspace\/scratch\/25a15120163a\/publish-repo\//, '') })).filter(e => !used.has(e.path));
    expect(manifest).toEqual({ format: 'RED_PRIEST918_STABILITY_FIRST_HISTORY_V1', independentRootCommandCount: 918,
      preservedFailureCommandCount: 1222, original918PrefixSha256: cp.prefixSha256, newFreezeSha256: cp.freezeSha256,
      policyDefinition: cp.policyDefinition, sameSeedAndCursor: root.state.random, selectedPromotionCheckpoint: false,
      original1222BranchPreserved: true, sources, proofs, additionalProofInputs });
    for (const input of [...sources.flatMap(s => s.files.map(f => ({ ...f, path: `${s.directory}/${f.path}` }))),
      ...sources.flatMap(s => [s.producer, s.manifest].filter((v): v is FilePin & { path: string } => Boolean(v))), ...proofs, ...additionalProofInputs]) {
      expect(input.path.startsWith('/')).toBe(false);
      const match = map.entries.filter(e => e.kind === 'ARTIFACT' && e.name === input.path && e.sha256 === input.sha256);
      expect(match, input.path).toHaveLength(1); expect(match[0]!.bytes).toBe(input.bytes);
    }
    expect(cp.independentBranch).toEqual({ proofFile: 'history-manifest.json', proofSha256: filePin(join(ROOT, 'planned/history-manifest.json')).sha256,
      rootCommandCount: 918, priorFailureCommandCount: 1222 });
    expect(Object.hasOwn(cp, 'continuation')).toBe(false); expect(Object.hasOwn(cp, 'stabilityContinuation')).toBe(false);
    expect(cp.policyDefinition).toEqual({ ...failed.policyDefinition, id: 'RED_PRIEST918_STABILITY_FROM_FIRST_COMPOUND_V1' });
    expect(transition).toEqual({ format: 'RED_PRIEST918_STABILITY_FIRST_TRANSITION_V1', commandCount: FORK_COUNT,
      originalRuntimeFreezeSha256: ORIGINAL918_FREEZE_SHA, newRuntimeFreezeSha256: cp.freezeSha256, stateSha256: FORK_STATE_SHA,
      originalPublicSha256: FORK_PUBLIC_SHA, continuedPublicSha256: PLANNING_INITIAL_PUBLIC_SHA, random: root.state.random,
      unchangedPrivateAndRng: true, publicDifference: 'Only appended ENABLE_PLANNING action at genuine918; full future stability strategy selected before919',
      allowedPublicChanges: ['APPENDED_ENABLE_PLANNING_CRISIS_ACTION'], addedAction: historicalTransition.addedAction,
      independentBranch: cp.independentBranch,
      historicalPlanningReplay: { proofFile: 'output/qa-0209/planning-equivalence/proof.json', proofSha256: EQUIVALENCE_SHA, commands: 188, first: 796, last: 983,
        scope: 'Historical planning runtime only; this is not a current-stability188 replay' },
      currentStabilityReplay: { proofFile: 'output/qa-0209/stability-equivalence/proof.json', proofSha256: observed().stabilityEquivalenceSha256,
        commands: 219, first: 919, last: 1137, genuine918PrivateAndRngBound: true, currentRuntimeFreezeSha256: stability.currentRuntimeFreeze.sha256 } });
    expect(stability.replay.rows[0]).toMatchObject({ commandCount: 919, beforeStateSha256: FORK_STATE_SHA,
      publicBeforeSha256: PLANNING_INITIAL_PUBLIC_SHA, randomBefore: root.state.random, stabilityActionsAddedBefore: 0, stabilitySectionsAddedBefore: 0 });
    expect(rows[0]).toMatchObject({ commandCount: 919, beforeStateSha256: FORK_STATE_SHA, publicBeforeSha256: PLANNING_INITIAL_PUBLIC_SHA, randomBefore: root.state.random });
    let cycle = { startedAfterCommand: FORK_COUNT, attempts: {} as Record<string, number> };
    for (const [index, intent] of cp.commands.entries()) {
      if (intent.type !== 'RED_PRIEST') throw Error('Independent branch must use actual Red Priest public commands');
      if (intent.command.type === 'CONSUME') cycle = { startedAfterCommand: 919 + index, attempts: {} };
      else if (intent.command.type === 'MATERIAL' && intent.command.command.type !== 'PREPARE_COMPOUND') {
        const key = JSON.stringify(intent.command); cycle.attempts[key] = (cycle.attempts[key] ?? 0) + 1;
        expect(cycle.attempts[key]).toBeLessThanOrEqual(12);
      }
    }
    expect(cp.policy.materialCycle).toEqual(cycle);
  }, 60_000);

  it('authenticates the exact observed terminal without requiring victory, promotion or survival', () => {
    const expected = observed(), freeze = json<Freeze>('planned/freeze.json');
    expect(compactHash(freeze.files)).toBe(freeze.sha256); expect(freeze.sha256).toBe(expected.freezeSha256);
    expect(new Set(freeze.files.map(f => f.file)).size).toBe(freeze.files.length);
    same(freeze.files.filter(f => f.file !== '$natural-producer'), stability.currentRuntimeFreeze.files);
    expect(freeze.files.find(f => f.file === '$natural-producer')?.sha256).toBe(expected.producerSha256);
    expect(freeze.files.find(f => f.file === SOURCE)).toEqual({ file: SOURCE, ...filePin(SOURCE) });
    expect(cp).toMatchObject({ format: 'RED_PRIEST_DURABLE_PUBLIC_ACTION_BOUNDARY_V1', source: SOURCE,
      sourceSha256: SOURCE_SHA, prefixCount: FORK_COUNT, prefixSha256: expected.prefixSha256, freezeSha256: expected.freezeSha256,
      commandCount: expected.commands, initialStateSha256: FORK_STATE_SHA, initialPublicStateSha256: PLANNING_INITIAL_PUBLIC_SHA,
      finalStateSha256: expected.finalStateSha256, publicStateSha256: expected.publicStateSha256,
      pending: null, terminal: { stage: expected.stage, reason: expected.reason } });
    expect(cp.fork).toEqual({ rootFile: 'original-918-checkpoint.json', rootSha256: FORK_SHA,
      proofFile: 'reconstruction-proof.json', proofSha256: RECONSTRUCTION_SHA,
      runtimeProofFile: 'runtime-transition.json', runtimeProofSha256: filePin(join(ROOT, 'planned/runtime-transition.json')).sha256 });
    expect(cp.policyDefinition).toMatchObject({ noReroll: true, plannedStance: 'COORDINATED', extraSupplies: true });
    same(rows, cp.rows); expect(rows).toHaveLength(expected.commands - FORK_COUNT); expect(cp.commands).toHaveLength(rows.length);
    expect(hash(cp.state)).toBe(expected.finalStateSha256); expect(hash(entry('final'))).toBe(expected.finalStateSha256);
    expect(cp.state.status).toBe(expected.finalStatus); expect(cp.state.progression.sequence).toBe(expected.finalSequence);
    expect(cp.state.random).toEqual(expected.finalRandom);
    expect(entry('prefixCount')).toBe(FORK_COUNT); expect(entry('pendingIntent')).toBeNull();
    expect(entry('stage')).toBe(expected.stage); expect(entry('reason')).toBe(expected.reason);
    expect(expected.stage).not.toBe('MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY');
    for (const key of ['creation', 'seed', 'initial']) same(entry(key), readObjectEntry(SOURCE, key));
    same(entry('policy'), cp.policyDefinition);
    expect(entry('provenance')).toMatchObject({ kind: 'EXACT_ORIGINAL_PREDECLARE918_STABILITY_FIRST_BRANCH', source: SOURCE,
      sourceSha256: SOURCE_SHA, prefixCommandsSha256: expected.prefixSha256, runtimeFreezeSha256: expected.freezeSha256,
      historicalPrefixRetainedExactly: true, original983BranchPreserved: true, notContinuationOf983: true,
      original1222BranchPreserved: true, notContinuationOf1222: true, independentBranch: cp.independentBranch,
      seedChanged: false, selectedFromEnabledPublicActionsOnly: true, fork: cp.fork });
    expect(report).toMatchObject({ stage: expected.stage, reason: expected.reason, commands: expected.commands,
      originalCommands: FORK_COUNT, newCommands: rows.length, paused: false, strictFinalValidation: true });
    const attempts: Record<string, number> = {};
    for (const row of rows) {
      if (row.intent.type !== 'RED_PRIEST') throw Error('Only real Red Priest actions belong to this tail');
      const key = JSON.stringify(row.intent.command); attempts[key] = (attempts[key] ?? 0) + 1;
    }
    expect(cp.policy.attempts, 'Continuation must not reset failed negotiations, battles or original action counts').toEqual(attempts);
  }, 60_000);

  it('binds the separate story-only133-row proof while preserving the original seven-file capture and156-file inventory', () => {
    const story = storyProof(), expected = storyObserved(), oldFreeze = json<Freeze>('planned/freeze.json');
    const map = json<ArtifactMap>('proofs/story-input-locations.json'), oldMap = json<ArtifactMap>('proofs/input-locations.json');
    expect(Object.keys(observed().files)).toHaveLength(156);
    expect(story).toMatchObject({ commandCount: 1051, stateSha256: cp.finalStateSha256, originalPublicSha256: cp.publicStateSha256,
      continuedPublicSha256: expected.currentPublicSha256, random: cp.state.random, exactSourceEditVerified: true,
      strictFinalValidation: true, originalInputsUnchanged: true, productionUnchangedDuringReplay: true,
      publicProjectionPath: 'redPriest', publicFieldPaths: ['story'],
      allowedPublicChanges: ['EPILOGUE_ROOT_STORY_ACTUAL_PATIENTS_AND_REPORT'] });
    expect(story.originalCapture.freezeSha256).toBe(observed().freezeSha256);
    expect(story.originalCapture.files7.map(f => f.path).sort()).toEqual(inventory(join(ROOT, 'planned')));
    for (const file of story.originalCapture.files7)
      expect(filePin(join(ROOT, 'planned', file.path))).toEqual({ bytes: file.bytes, sha256: file.sha256 });
    expect(story.source1051).toMatchObject({ checkpoint: filePin(join(ROOT, 'planned/checkpoint.json')),
      checkpointPayloadSha256: hash(cp), commandCount: 1051, stateSha256: cp.finalStateSha256,
      publicSha256: cp.publicStateSha256, random: cp.state.random });
    same(story.originalRuntimeFreeze.files, oldFreeze.files.filter(f => f.file !== '$natural-producer'));
    expect(compactHash(story.originalRuntimeFreeze.files)).toBe(story.originalRuntimeFreeze.sha256);
    expect(compactHash(story.currentRuntimeFreeze.files)).toBe(story.currentRuntimeFreeze.sha256);
    expect(story.currentRuntimeFreeze.sha256).toBe(expected.runtimeFreezeSha256);
    expect(story.currentRuntimeEndSha256).toBe(expected.runtimeFreezeSha256);
    const changed = ['src/domain/red-priest/index.ts', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map'];
    expect(story.allowedChanges).toEqual(changed); expect(story.changedFiles.map(c => c.file)).toEqual(changed);
    for (const change of story.changedFiles) {
      expect(story.originalRuntimeFreeze.files.find(f => f.file === change.file)).toEqual({ file: change.file, ...change.before });
      expect(story.currentRuntimeFreeze.files.find(f => f.file === change.file)).toEqual({ file: change.file, ...change.after });
      expect(change.before.sha256).not.toBe(change.after.sha256);
      const aliases = map.entries.filter(e => e.kind === 'FROZEN_RUNTIME' && e.name === change.file && e.sha256 === change.before.sha256);
      expect(aliases).toHaveLength(1); expect(aliases[0]!.bytes).toBe(change.before.bytes);
    }
    same(story.currentRuntimeFreeze.files.map(file => {
      const change = story.changedFiles.find(c => c.file === file.file);
      return change ? { file: file.file, ...change.before } : file;
    }), story.originalRuntimeFreeze.files);
    expect(map.format).toBe(oldMap.format);
    expect(new Set(map.entries.map(e => `${e.kind}:${e.name}:${e.sha256}`)).size).toBe(map.entries.length);
    for (const alias of oldMap.entries) expect(map.entries).toContainEqual(alias);
    const allPins = { ...observed().files, ...expected.files };
    for (const alias of map.entries) {
      expect(alias.path.startsWith('/')).toBe(false); expect(alias.path).not.toMatch(/[\\\0]/);
      expect(alias.path.split('/').every(part => part !== '' && part !== '.' && part !== '..')).toBe(true);
      expect(allPins[alias.path], alias.name).toEqual({ bytes: alias.bytes, sha256: alias.sha256 });
    }
    expect(story.inputFiles).toHaveLength(154); expect(hash(story.inputFiles)).toBe(story.inputStartSha256);
    expect(story.inputEndSha256).toBe(story.inputStartSha256);
    for (const input of story.inputFiles) {
      const aliases = map.entries.filter(e => e.kind === 'ARTIFACT' && e.name === input.path && e.sha256 === input.sha256);
      expect(aliases, input.path).toHaveLength(1); expect(aliases[0]!.bytes).toBe(input.bytes);
    }
    for (const [file, pin] of [
      ['output/qa-0209/final-story-equivalence/verify.mjs', story.scriptSha256],
      ['output/qa-0209/final-story-equivalence/public-equivalence.mjs', story.normalizerSha256],
    ]) expect(story.inputFiles.some(input => input.path === file && input.sha256 === pin)).toBe(true);
    expect(story.replay).toMatchObject({ commands: 133, first: 919, last: 1051,
      allPrivateAndRngEqual: true, allOtherPublicFieldsEqual: true, storyChangedChecks: 5,
      allowedPublicChanges: story.allowedPublicChanges });
    expect(story.replay.rows).toHaveLength(rows.length);
    for (const [index, check] of story.replay.rows.entries()) {
      bindStoryRow(check, rows[index]!);
      const previous = story.replay.rows[index - 1];
      if (previous) {
        expect(check.publicBeforeSha256).toBe(previous.publicSha256);
        expect(check.currentStoryBefore).toBe(previous.currentStoryAfter);
      }
      if (!check.storyChangedBefore) expect(check.publicBeforeSha256).toBe(rows[index]!.publicBeforeSha256);
      if (!check.storyChangedAfter) expect(check.publicSha256).toBe(rows[index]!.publicAfterSha256);
    }
    expect(story.replay.rows.filter(row => row.storyChangedBefore).map(row => row.commandCount)).toEqual([1048, 1049, 1050, 1051]);
    expect(story.replay.rows.filter(row => row.storyChangedAfter).map(row => row.commandCount)).toEqual([1047, 1048, 1049, 1050, 1051]);
    const negative = story.normalizerNegativeTests, firstChanged = story.replay.rows.find(row => row.commandCount === 1047)!;
    expect(negative).toMatchObject({ commandCount: 1047, observedStateSha256: firstChanged.stateSha256,
      observedPublicSha256: firstChanged.publicSha256, capturedPublicSha256: firstChanged.capturedPublicSha256,
      positiveControlPassed: true, noAdditionalReplay: true, rejectedMutations: 11 });
    expect(negative.checks).toEqual(['missing-story', 'wrong-story-text', 'stale-original-story', 'extra-story-copy',
      'changed-original-resource', 'changed-original-action-cost', 'missing-original-section', 'changed-seed',
      'changed-rng-cursor', 'under-normalization-full-public-hash-rejection', 'over-normalization-full-public-hash-rejection']
      .map(name => ({ name, rejected: true })));
    const final = expectedStory(cp.state), last = story.replay.rows.at(-1)!;
    expect(final.patients).toEqual({ evacuated: 1, sheltered: 2, status: 'WITHDRAWN', reported: true });
    expect(story.originalStory).toBe(final.original); expect(story.currentStory).toBe(final.current);
    expect(last.currentStoryAfter).toBe(final.current); expect(last.publicSha256).toBe(expected.currentPublicSha256);
    expect(last.capturedPublicSha256).toBe(observed().publicStateSha256);
  }, 60_000);

  it('binds the appended original-camp travel action and full player-facing projection contracts without rewriting either earlier proof', () => {
    const proof = finalUiProof(), expected = finalUiObserved(), priorStory = storyProof();
    const map = json<ArtifactMap>('proofs/final-ui-input-locations.json'), oldMap = json<ArtifactMap>('proofs/story-input-locations.json');
    expect(Object.keys(observed().files).length + Object.keys(storyObserved().files).length).toBe(165);
    expect(proof).toMatchObject({ commandCount: 1051, stateSha256: cp.finalStateSha256, random: cp.state.random,
      originalPublicSha256: cp.publicStateSha256, continuedPublicSha256: expected.currentPublicSha256,
      playerChapterSha256: expected.playerChapterSha256, publicSliceSha256: expected.publicSliceSha256,
      exactSourceEditVerified: true, strictFinalValidation: true, originalInputsUnchanged: true, productionUnchangedDuringReplay: true,
      publicProjectionPath: 'redPriest', publicFieldPaths: ['story', 'actions[last]'],
      allowedPublicChanges: ['EPILOGUE_ROOT_STORY_ACTUAL_PATIENTS_AND_REPORT', 'APPENDED_S1_HEADQUARTERS_ORIGINAL_GARRISON_TRAVEL_ACTION'],
      priorStoryProof: { proofSha256: storyObserved().proofSha256 } });
    same(proof.originalCapture, { ...priorStory.originalCapture, manifest: 'output/qa-0209/final-ui-equivalence/original-capture-manifest.json' });
    same(proof.originalRuntimeFreeze, priorStory.originalRuntimeFreeze);
    expect(compactHash(proof.currentRuntimeFreeze.files)).toBe(expected.runtimeFreezeSha256);
    expect(proof.currentRuntimeFreeze.sha256).toBe(expected.runtimeFreezeSha256);
    expect(proof.currentRuntimeEndSha256).toBe(expected.runtimeFreezeSha256);
    const producer = json<Freeze>('planned/freeze.json').files.find(f => f.file === '$natural-producer')!;
    const currentPins = new Map(proof.currentRuntimeFreeze.files.map(file => [file.file, file]));
    expect(compactHash(json<Freeze>('planned/freeze.json').files.map(file =>
      file.file === '$natural-producer' ? producer : currentPins.get(file.file)!))).toBe(expected.saveRuntimeFreezeSha256);
    expect(proof.allowedChanges).toEqual(priorStory.allowedChanges);
    expect(proof.changedFiles.map(c => c.file)).toEqual(priorStory.changedFiles.map(c => c.file));
    for (const change of proof.changedFiles) {
      expect(proof.originalRuntimeFreeze.files.find(f => f.file === change.file)).toEqual({ file: change.file, ...change.before });
      expect(proof.currentRuntimeFreeze.files.find(f => f.file === change.file)).toEqual({ file: change.file, ...change.after });
      const previous = priorStory.changedFiles.find(c => c.file === change.file)!;
      expect(previous.before).toEqual(change.before); expect(previous.after.sha256).not.toBe(change.after.sha256);
      const overlay = map.entries.filter(e => e.kind === 'FROZEN_RUNTIME' && e.name === change.file && e.sha256 === previous.after.sha256);
      expect(overlay).toHaveLength(1); expect(overlay[0]!.bytes).toBe(previous.after.bytes);
    }
    same(proof.currentRuntimeFreeze.files.map(file => {
      const change = proof.changedFiles.find(c => c.file === file.file);
      return change ? { file: file.file, ...change.before } : file;
    }), proof.originalRuntimeFreeze.files);
    expect(map.format).toBe(oldMap.format);
    expect(new Set(map.entries.map(e => `${e.kind}:${e.name}:${e.sha256}`)).size).toBe(map.entries.length);
    for (const alias of oldMap.entries) expect(map.entries).toContainEqual(alias);
    const allPins = { ...observed().files, ...storyObserved().files, ...expected.files };
    for (const alias of map.entries) {
      expect(alias.path.startsWith('/')).toBe(false); expect(alias.path).not.toMatch(/[\\\0]/);
      expect(alias.path.split('/').every(part => part !== '' && part !== '.' && part !== '..')).toBe(true);
      expect(allPins[alias.path], alias.name).toEqual({ bytes: alias.bytes, sha256: alias.sha256 });
    }
    expect(proof.inputFiles).toHaveLength(171); expect(hash(proof.inputFiles)).toBe(proof.inputStartSha256);
    expect(proof.inputEndSha256).toBe(proof.inputStartSha256);
    for (const input of proof.inputFiles) {
      const aliases = map.entries.filter(e => e.kind === 'ARTIFACT' && e.name === input.path && e.sha256 === input.sha256);
      expect(aliases, input.path).toHaveLength(1); expect(aliases[0]!.bytes).toBe(input.bytes);
    }
    expect(proof.projectionContracts).toMatchObject({ capture: 'OWNED_AUTHORED_RED_PRIEST_PROJECTION',
      persistence: 'COMPLETE_PLAYER_FACING_SLICE_PROJECTION', relation: 'EXACT_FROZEN_PROJECT_PLAYER_TEXT_WITH_ORIGINAL_PLAYER_NAME' });
    expect(proof.projectionContracts.files.map(f => f.file)).toEqual(['src/shared/player-text.ts', 'src/shared/player-text-copy.ts',
      'dist/shared/player-text.js', 'dist/shared/player-text.js.map', 'dist/shared/player-text-copy.js', 'dist/shared/player-text-copy.js.map']);
    for (const file of proof.projectionContracts.files) {
      expect(proof.originalRuntimeFreeze.files).toContainEqual(file); expect(proof.currentRuntimeFreeze.files).toContainEqual(file);
    }
    expect(proof.replay).toMatchObject({ commands: 133, first: 919, last: 1051, allPrivateAndRngEqual: true,
      allOtherPublicFieldsEqual: true, appendedTravelChecks: 3, storyChangedChecks: 5, exactPlayerTextRelation: true });
    expect(proof.replay.rows).toHaveLength(rows.length);
    for (const [index, check] of proof.replay.rows.entries()) {
      bindStoryRow(check, rows[index]!); const old = priorStory.replay.rows[index]!;
      expect(check).toMatchObject({ priorRuntimePublicBeforeSha256: old.publicBeforeSha256, priorRuntimePublicSha256: old.publicSha256,
        originalStoryBefore: old.originalStoryBefore, originalStoryAfter: old.originalStoryAfter,
        currentStoryBefore: old.currentStoryBefore, currentStoryAfter: old.currentStoryAfter,
        actualPatientsBefore: old.actualPatientsBefore, actualPatientsAfter: old.actualPatientsAfter,
        storyChangedBefore: old.storyChangedBefore, storyChangedAfter: old.storyChangedAfter, exactPlayerTextRelation: true });
      if (!check.appendedTravelBefore) expect(check.publicBeforeSha256).toBe(old.publicBeforeSha256);
      if (!check.appendedTravelAfter) expect(check.publicSha256).toBe(old.publicSha256);
      const previous = proof.replay.rows[index - 1];
      if (previous) {
        expect(check.publicBeforeSha256).toBe(previous.publicSha256);
        expect(check.publicSliceBeforeSha256).toBe(previous.publicSliceSha256);
        expect(check.playerChapterBeforeSha256).toBe(previous.playerChapterSha256);
      }
    }
    expect(proof.replay.rows.filter(row => row.appendedTravelBefore).map(row => row.commandCount)).toEqual([1023, 1024, 1025]);
    expect(proof.replay.rows.filter(row => row.appendedTravelAfter).map(row => row.commandCount)).toEqual([1022, 1023, 1024]);
    expect(proof.replay.rows.filter(row => row.appendedTravelAfter).map(row => row.appendedTravelAfter!.enabled)).toEqual([false, false, true]);
    expect(rows.find(row => row.commandCount === 1025)!.intent).toEqual({ type: 'RED_PRIEST', command: { type: 'TRAVEL', to: 'backlund:sealed-compounding-room' } });
    const negative = proof.travelNegativeTests, first = proof.replay.rows.find(row => row.commandCount === 1022)!;
    expect(negative).toMatchObject({ commandCount: 1022, observedStateSha256: first.stateSha256,
      observedPublicSha256: first.publicSha256, capturedPublicSha256: first.capturedPublicSha256,
      positiveControlPassed: true, noAdditionalReplay: true, rejectedMutations: 15 });
    expect(negative.checks).toEqual(['missing-travel', 'duplicate-travel', 'wrong-travel-target', 'wrong-travel-label', 'wrong-travel-cost',
      'renumbered-travel', 'wrong-travel-enabled', 'wrong-travel-reason', 'extra-preferred-action', 'reordered-original-actions',
      'changed-original-resource', 'renumbered-original-action', 'changed-seed', 'under-normalization-full-public-hash-rejection',
      'over-normalization-full-public-hash-rejection'].map(name => ({ name, rejected: true })));
    expect(proof.ineligibleTravelNegativeTests).toMatchObject({ commandCount: 918, observedStateSha256: FORK_STATE_SHA,
      observedPublicSha256: PLANNING_INITIAL_PUBLIC_SHA, capturedPublicSha256: PLANNING_INITIAL_PUBLIC_SHA,
      positiveControlPassed: true, noAdditionalReplay: true, rejectedMutations: 1,
      checks: [{ name: 'injected-travel-outside-exact-availability', rejected: true }] });
    expect(proof.normalizerNegativeTests).toEqual(priorStory.normalizerNegativeTests);
    const last = proof.replay.rows.at(-1)!;
    expect(last.publicSha256).toBe(expected.currentPublicSha256); expect(last.playerChapterSha256).toBe(expected.playerChapterSha256);
    expect(last.publicSliceSha256).toBe(expected.publicSliceSha256);
  }, 60_000);

  it('replays the whole planned tail once through owned drafts and preserves every private/RNG/public boundary and casualty', () => {
    const expected = observed(), story = storyProof(), finalUi = finalUiProof(), session = openRedPriestRuntimeSession(initial);
    let state = initial, view = session.projectRedPriest(), doses = 0;
    initialPlanningSeam(view, transition);
    for (const [index, row] of rows.entries()) {
      expect(row.commandCount).toBe(FORK_COUNT + index + 1); expect(row.revision).toBe(initial.revision + index + 1);
      expect(row.commandSha256).toBe(compactHash(row.intent)); same(row.intent, cp.commands[index]);
      expect(validateSlicePayload(row.intent)).toBe(true);
      if (row.intent.type !== 'RED_PRIEST') throw Error('Only recorded enabled Red Priest intents may execute');
      expect(state.status).toBe('ACTIVE'); expect(captureHash(state, root.state)).toBe(row.beforeStateSha256);
      expect(state.random).toEqual(row.randomBefore);
      assertFinalUiBoundary(view, state, row, finalUi.replay.rows[index]!, story.replay.rows[index]!, 'Before');
      const command = row.intent.command;
      const offered = view.actions.filter(a => stable(a.command) === stable(command));
      expect(offered).toHaveLength(1); expect(offered[0]!.enabled).toBe(true); expect(offered[0]!.label).toBe(row.publicLabel);
      if (command.type === 'CAMPAIGN') expect(command.command.type).not.toBe('BATTLE');
      expect(command.type).not.toBe('START_EPILOGUE');
      const before = state, draft = session.prepare(row.intent, before.revision);
      state = session.snapshotDraft(draft); view = session.projectDraftRedPriest(draft); session.commit(draft);
      expect(captureHash(before, root.state), 'Drafts must not mutate the predecessor').toBe(row.beforeStateSha256);
      expect(captureHash(state, root.state)).toBe(row.afterStateSha256); expect(state.revision).toBe(row.revision);
      expect(state.random).toEqual(row.randomAfter); expect(state.random.seed).toBe(raw795.random.seed);
      expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      assertFinalUiBoundary(view, state, row, finalUi.replay.rows[index]!, story.replay.rows[index]!, 'After');
      const event = state.redPriest.journal.at(-1)!;
      expect(event.revision).toBe(row.revision); same(event.command, command);
      expect(event.before.random).toEqual(row.randomBefore); expect(event.after.random).toEqual(row.randomAfter);
      if (command.type === 'CAMPAIGN' && ['ENABLE_PLANNING', 'RECONNOITRE', 'SELECT_BATTLE_PLAN'].includes(command.command.type)) {
        expect(state.random).toEqual(before.random); expect(event.randomReceipts).toHaveLength(0);
      }
      if (command.type === 'CAMPAIGN' && command.command.type === 'PREPARED_BATTLE') {
        expect(before.redPriest.campaign!.planning!.selection).toMatchObject({ nodeId: command.command.nodeId, stance: 'COORDINATED', extraSupplies: true });
        expect(state.random.cursor).toBe(before.random.cursor + 1);
        expect(event.randomReceipts).toHaveLength(1); expect(event.campaignHost?.receipt?.source).toBe('BATTLE_RESOLUTION');
        expect(state.redPriest.campaign!.planning).toMatchObject({ recon: null, selection: null });
      }
      if (command.type === 'STABILIZE_PROMOTION') {
        const finance = resolveSliceWeeklyFinance({ ...before.redPriest.frame!.finance, week: before.week,
          revision: before.revision + 1, cash: before.cash - 120, pulse: 'BILL', billAmount: 0 });
        expect(before.actionsRemaining).toBeGreaterThanOrEqual(2); expect(state.actionsRemaining).toBe(state.weeklyBudget);
        expect(state.cash).toBe(finance.state.cash); same(state.debts, finance.state.debts); same(event.financeReceipts, finance.receipts);
        expect(state.random).toEqual(before.random); expect(event.randomReceipts).toHaveLength(0);
        expect(state.week).toBe(before.week + 1); expect(state.mind).toBe(before.mind - 8); expect(state.spirituality).toBe(before.spirituality - 12);
        same(state.redPriest.materials, before.redPriest.materials);
        expect(state.redPriest.promotionStability!.preparations.at(-1)).toMatchObject({ compoundId: command.compoundId,
          eventId: event.id, status: 'READY', spentEventId: null, invalidatedEventId: null });
      }
      if (command.type === 'CONSUME') {
        if (doses++ === 0) expect(command.compoundId).toBe('red-priest:ordinary-compound-pack:1:EMPTY_BOTTLE');
        const paid = before.redPriest.promotionStability!.preparations.find(p => p.compoundId === command.compoundId && p.status === 'READY');
        expect(paid, 'Every actual dose, including the first original bottle, requires its own real paid preparation').toBeDefined();
        expect(paid!.spentEventId).toBeNull(); expect(paid!.invalidatedEventId).toBeNull();
        expect(event.randomReceipts).toHaveLength(1); expect(state.random.cursor).toBe(before.random.cursor + 1);
        const check = event.randomReceipts[0]!.check;
        expect(check.modifiers).toContainEqual({ source: '战后三方原委托稳定准备', value: 35 });
        expect(check.effectiveAbility).toBe(check.baseAbility + 35);
        expect(state.redPriest.promotionStability!.preparations.find(p => p.id === paid!.id)).toMatchObject({ status: 'SPENT', spentEventId: event.id });
        expect(state.redPriest.materials!.compounds.find(c => c.id === command.compoundId)?.status).toBe('CONSUMED');
      }
      if (command.type === 'START_PREPARED_EPILOGUE') {
        expect(state.redPriest.epilogue?.rulesVersion).toBe(2); expect(state.redPriest.epilogue?.personnel).toBe(6);
        expect(state.random).toEqual(before.random); expect(state.actionsRemaining).toBe(before.actionsRemaining - 1);
      }
      same(state.redPriest.source, root.state.redPriest.source); conserve(state, before);
    }
    expect(captureHash(state, root.state)).toBe(expected.finalStateSha256); expect(hash(view)).toBe(finalUiObserved().currentPublicSha256);
    expect(state.status).toBe(expected.finalStatus); expect(state.progression.sequence).toBe(expected.finalSequence);
    expect(state.random).toEqual(expected.finalRandom); expect(state.revision).toBe(initial.revision + rows.length);
    const rawFinalHash = hash(cp.state); same(state, migrateSliceState(cp.state)); expect(hash(cp.state)).toBe(rawFinalHash);
    for (const key of [...RED_PRIEST_FROZEN_SOURCE_KEYS, 'world', 'combatHistory'] as const) same(state[key], raw795[key]);
    const { coreStats: _now, ...identity } = state.character, { coreStats: _then, ...original } = raw795.character;
    same(identity, original);
    for (const [id, value] of Object.entries(raw795.progression.mastery)) expect(state.progression.mastery[id], id).toBe(value);
    assertValidSliceState(state);
    const reopened = openRedPriestRuntimeSession(state);
    expect(captureHash(reopened.snapshot(), root.state)).toBe(expected.finalStateSha256);
    assertFinalUiBoundary(reopened.projectRedPriest(), reopened.snapshot(), rows.at(-1)!, finalUi.replay.rows.at(-1)!, story.replay.rows.at(-1)!, 'After');
    expect(report.public).toEqual({ title: view.title, promoted: view.promoted, nextStep: view.nextStep,
      resources: view.resources, abilities: view.abilities, sections: view.sections });
    if (state.status === 'DEAD') {
      expect(expected.stage).toBe('NATURAL_ACTUAL_TERMINAL'); expect(view.actions.every(a => !a.enabled)).toBe(true);
    }
    // A surviving finite stop, failed consumption, withdrawal, or unrescued
    // patient remains the actual observed result. No success assertion is used.
  }, 600_000);
});
