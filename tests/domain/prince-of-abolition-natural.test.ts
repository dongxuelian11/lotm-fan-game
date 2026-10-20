import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validatePrinceOfAbolitionAcquisitionJournal, validatePrinceOfAbolitionJournalContinuity } from '../../src/domain/prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_CASE_IDS, getPrinceOfAbolitionCurrentSite, validatePrinceOfAbolitionLifeState } from '../../src/domain/prince-of-abolition/life.js';
import { validatePrinceOfAbolitionEncounterState } from '../../src/domain/prince-of-abolition/encounter.js';
import { currentPrinceOfAbolitionCombatSource, replayPrinceOfAbolitionCombatRound } from '../../src/domain/prince-of-abolition/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { currentPrinceOfAbolitionReplayExpectation, PRINCE_OF_ABOLITION_CAPTURE_GUIDE_INDEX,
  PRINCE_OF_ABOLITION_CAPTURE_GUIDE_TEXT, PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT } from '../helpers/prince-of-abolition-current-replay.js';
import { PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE as evidence, PRINCE_OF_ABOLITION_METADATA_FILES as METADATA, PRINCE_OF_ABOLITION_CAPTURE_STAGES as STAGES } from './prince-of-abolition-capture-evidence.js';
import { PRINCE_OF_ABOLITION_ROOT as ROOT, PRINCE_OF_ABOLITION_SOURCE as SOURCE, PRINCE_OF_ABOLITION_PRIOR as PRIOR,
  PRINCE_OF_ABOLITION_PREFIX_COUNT as PREFIX, PRINCE_OF_ABOLITION_INHERITED_COUNT as INHERITED, PRINCE_OF_ABOLITION_SEED as SEED,
  captureMetadata, observedCapture, naturalEntry, sourceEntry, summaryEntry, capturePath, captureFileHash,
  insertionOrderHash, captureValueHash, captureJsonLines, currentCapture, originalLivingPrefix, capturedState,
  replayCaptureBoundary, captureBody, capturePublicBody, sourceOriginals, currentOriginals,
  actualLifeAbilityUse, actualCombatAbilityUse, publicCaptureControl, assertOriginalContinuity, sameCaptureValue as same } from './prince-of-abolition-capture-helper.js';

interface FileEvidence { bytes: number; sha256: string }
interface Integrity { producerSha256: string; freezeSha256: string; frozenFiles: ({ file: string } & FileEvidence)[];
  metadata: Record<string, FileEvidence>; files: Record<string, FileEvidence> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }
interface Ledger { step: number; sourcePrefix: boolean; boundaryKey: string | null; intent: SliceIntent;
  before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> }
interface PublicRow { step: number; revision: number; command: SliceIntent; control: unknown;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; before: ReturnType<typeof capturePublicBody>; after: ReturnType<typeof capturePublicBody> }
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);

// This deliberately fails until actual coordinator evidence replaces null.
// Conditional suites alone must never turn absent capture evidence into green.
it('requires actual frozen stage205 observations before claiming natural coverage', () => { observedCapture(); });

describe.skipIf(evidence.observed === null)('Prince of Abolition literal original-seed capture', () => {
  it('adapts only the exact frozen guidance for current replay while preserving original captures', () => {
    const captured = capturedState('final'), originalHash = captureValueHash(captured), index = PRINCE_OF_ABOLITION_CAPTURE_GUIDE_INDEX;
    const expected = currentPrinceOfAbolitionReplayExpectation(captured);
    expect(captured.chronicle[index]!.text).toBe(PRINCE_OF_ABOLITION_CAPTURE_GUIDE_TEXT);
    expect(expected.chronicle[index]!.text).toBe(PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT);
    const restored = structuredClone(expected); restored.chronicle[index]!.text = PRINCE_OF_ABOLITION_CAPTURE_GUIDE_TEXT;
    same(restored, captured); expect(captureValueHash(captured)).toBe(originalHash);
    same(currentPrinceOfAbolitionReplayExpectation(expected), expected);
    const prefix = capturedState('prefixFinal'); expect(currentPrinceOfAbolitionReplayExpectation(prefix)).toBe(prefix);
    const mirrored = structuredClone(captured); mirrored.lastResult = structuredClone(mirrored.chronicle[index]!);
    const mirroredExpected = currentPrinceOfAbolitionReplayExpectation(mirrored);
    expect(mirroredExpected.lastResult!.text).toBe(PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT);
    expect(mirrored.lastResult!.text).toBe(PRINCE_OF_ABOLITION_CAPTURE_GUIDE_TEXT);
    for (const mutate of [
      (state: SliceState) => { state.chronicle[index]!.text += 'altered'; },
      (state: SliceState) => { state.chronicle[index]!.week++; },
      (state: SliceState) => { state.chronicle[index]!.title += 'altered'; },
      (state: SliceState) => { state.chronicle[index]!.id += 'altered'; },
      (state: SliceState) => { state.chronicle.push(structuredClone(state.chronicle[index]!)); },
      (state: SliceState) => { state.chronicle.splice(index, 1); },
      (state: SliceState) => { state.lastResult = { ...state.chronicle[index]!, text: PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT }; },
    ]) {
      const malformed = structuredClone(captured); mutate(malformed);
      expect(() => currentPrinceOfAbolitionReplayExpectation(malformed)).toThrow();
    }
  }, 30_000);

  it('pins every immutable member, observed counts, both scripts and full freeze inventory', async () => {
    const e = observedCapture(), { boundaries, steps, snapshots } = captureMetadata();
    expect(e.commands).toBeGreaterThan(PREFIX); expect(e.uniqueTransitions).toBe(e.commands - PREFIX + 1);
    expect(e.namedBoundaries).toBe(e.uniqueTransitions + e.aliases); expect(STAGES).toContain(e.stage);
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256); expect(await captureFileHash(PRIOR)).toBe(evidence.priorSha256);
    expect(await captureFileHash('scripts/play/prince-of-abolition-stage.mjs')).toBe(e.producerSha256);
    const currentVerifierHash = await captureFileHash('scripts/play/prince-of-abolition-save.mjs');
    const revision = JSON.parse(readFileSync('scripts/play/prince-of-abolition-dependency-revision.json', 'utf8')) as {
      kind: string; captureFreezeSha256: string; changes: { before: { file: string; sha256: string }; after: { file: string; sha256: string } }[];
    };
    expect(revision.kind).toBe('PRINCE205_REVIEWED_INITIALIZATION_DEPENDENCY');
    expect(revision.captureFreezeSha256).toBe(e.freezeSha256);
    const verifierRevision = revision.changes.find(row => row.before.file === 'scripts/play/prince-of-abolition-save.mjs');
    expect(verifierRevision?.before.sha256).toBe(e.saveVerifierSha256);
    expect(verifierRevision?.after.file).toBe('scripts/play/prince-of-abolition-save.mjs');
    expect(verifierRevision?.after.sha256).toBe(currentVerifierHash);
    expect(Object.keys(e.metadataHashes).sort()).toEqual([...METADATA].sort());
    for (const [filename, hash] of Object.entries(e.metadataHashes)) {
      const path = `${ROOT}/${filename}`; expect(realpathSync(path)).toBe(resolve(path)); expect(await captureFileHash(path)).toBe(hash);
    }
    const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as Integrity;
    expect(integrity.producerSha256).toBe(e.producerSha256); expect(integrity.freezeSha256).toBe(e.freezeSha256);
    expect(insertionOrderHash(integrity.frozenFiles)).toBe(e.freezeSha256);
    expect(Object.keys(integrity.metadata).sort()).toEqual(METADATA.filter(name => name !== 'capture-integrity.json').sort());
    const members = [...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].sort();
    same(Object.keys(integrity.files).sort(), members); same(readdirSync(ROOT).sort(), [...members, ...METADATA].sort());
    expect(members.length + METADATA.length).toBe(e.files); expect(sum(readdirSync(ROOT), file => statSync(`${ROOT}/${file}`).size)).toBe(e.bytes);
    for (const [filename, pin] of Object.entries({ ...integrity.metadata, ...integrity.files })) {
      const path = filename.endsWith('.json') ? capturePath(filename) : `${ROOT}/${filename}`;
      expect(realpathSync(path)).toBe(resolve(path)); expect(statSync(path).size).toBe(pin.bytes); expect(await captureFileHash(path)).toBe(pin.sha256);
    }
    same(steps, e.boundarySteps); same(Object.keys(snapshots), e.snapshots);
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) {
      const raw = naturalEntry<SliceState>(key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([202, 'prince-of-abolition-v202']);
    }
    for (const filename of new Set(Object.values(snapshots))) {
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(202);
      expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('prince-of-abolition-v202');
    }
    const prefix = capturePath('source-prefix.json');
    expect(readObjectEntry(prefix, 'source')).toBe(SOURCE); expect(readObjectEntry(prefix, 'sourceSha256')).toBe(evidence.sourceSha256);
    expect(readObjectEntry(prefix, 'sourceRoot')).toBe('final'); expect(readObjectEntry(prefix, 'prefixCount')).toBe(PREFIX);
    expect(readObjectEntry(prefix, 'inheritedDirectedPrefix')).toBe(false); expect(readObjectEntry(prefix, 'rawCommandsSha256')).toBe(evidence.prefixSha256);
    expect(readObjectEntry(prefix, 'predecessorSource')).toBe(PRIOR); expect(readObjectEntry(prefix, 'predecessorSha256')).toBe(evidence.priorSha256);
    expect(readObjectEntry(prefix, 'inheritedCount')).toBe(INHERITED); expect(readObjectEntry(prefix, 'inheritedCommandsSha256')).toBe(evidence.inheritedSha256);
    for (const [captured, original] of [['rawInitial', 'initial'], ['rawFinal', 'final'], ['rawInheritedFinal', 'prefixFinal']] as const) same(readObjectEntry(prefix, captured), sourceEntry(original));
    same(readObjectEntry(prefix, 'commands'), sourceEntry('commands'));
    // This historical hash belongs to the producer's raw202 capture. CURRENT
    // migration is compared separately below, never substituted into this pin.
    expect(readObjectEntry(prefix, 'migratedWholeStateSha256')).toBe(captureValueHash(naturalEntry('prefixFinal')));
    expect(summaryEntry<{ migratedWholeSourceSha256: string }>('source').migratedWholeSourceSha256).toBe(captureValueHash(naturalEntry('prefixFinal')));
    expect(captureValueHash(naturalEntry('final'))).toBe(e.finalRawStateSha256);
    same(capturedState('prefixFinal'), originalLivingPrefix()); same(capturedState('initial'), currentCapture(sourceEntry('initial')));
  }, 240_000);

  it('replays every command from actual creation, retains the555/558 branch and compares all private/public/RNG evidence without output files', async () => {
    const e = observedCapture(), { commands, boundaries, steps, snapshots } = captureMetadata();
    const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as Transition[];
    expect(commands).toHaveLength(e.commands); same(commands.slice(0, PREFIX), sourceEntry('commands'));
    expect(naturalEntry('seed')).toBe(SEED); expect(naturalEntry('prefixVerified')).toBe(true); expect(naturalEntry('prefixCount')).toBe(PREFIX); expect(naturalEntry('inheritedPrefixCount')).toBe(INHERITED);
    expect(Object.keys(boundaries)).toHaveLength(e.namedBoundaries); expect(transitions).toHaveLength(e.uniqueTransitions);
    expect(transitions).toHaveLength(commands.length - PREFIX + 1); same(Object.keys(steps), Object.keys(boundaries));
    same([...new Set(Object.values(boundaries))], transitions.map(row => row.file));
    const byStep = new Map(transitions.map(row => [row.commandIndex, row])), firstNames = new Map<number, string>();
    for (const [index, row] of transitions.entries()) {
      expect([row.commandIndex, row.beforeRevision, row.afterRevision]).toEqual([PREFIX + index, PREFIX + index, PREFIX + index + 1]);
      expect(boundaries[row.key]).toBe(row.file); expect(steps[row.key]).toBe(row.commandIndex);
    }
    for (const [name, file] of Object.entries(boundaries)) {
      const step = steps[name]!, row = byStep.get(step); expect(row, name).toBeDefined(); expect(file).toBe(row!.file);
      if (!firstNames.has(step)) { firstNames.set(step, name); expect(name).toBe(row!.key); }
    }
    expect(Object.keys(boundaries).length - firstNames.size).toBe(e.aliases);
    const original = originalLivingPrefix(); same(captureBody(original), e.originalBody); same(original.character, e.originalCharacter); same(original.progression.mastery, e.originalMastery);
    let state = createSliceRun(original.runId, sourceEntry<Parameters<typeof createSliceRun>[1]>('creation'), SEED), count = 0, inheritedDeathVerified = false;
    let livingContinues = 0; const sourceTerminals: { root: string; targetId: string | null; enemyStatus: string; playerStatus: string }[] = [];
    const treatments: unknown[] = [];
    same(state, capturedState('initial'));
    const publicRows = captureJsonLines<PublicRow>('public.jsonl'), stateHashes = new Map<number, string>();
    try {
      for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
        expect(row.step).toBe(++count); expect(row.sourcePrefix).toBe(count <= PREFIX); same(row.intent, commands[count - 1]);
        expect(validateSlicePayload(row.intent)).toBe(true); same(captureBody(state), row.before);
        const before = state, transition = byStep.get(count); let proof: PublicRow | null = null;
        if (count > PREFIX) {
          expect(row.boundaryKey).toBe(transition!.key);
          const control = publicCaptureControl(before, row.intent), next = await publicRows.next();
          if (next.done) throw new Error(`Missing public row for actual command ${count}`); proof = next.value;
          expect(proof.step).toBe(count); expect(proof.revision).toBe(before.revision); same(proof.command, row.intent); same(proof.control, control);
          same(proof.randomBefore, before.random); same(proof.before, capturePublicBody(before));
        } else expect(row.boundaryKey).toBeNull();
        state = applySliceIntent(before, row.intent);
        expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe(SEED); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
        same(captureBody(state), row.after);
        if (proof) { same(proof.after, capturePublicBody(state)); same(proof.randomAfter, state.random); }
        if (count === INHERITED) {
          same(state, currentCapture(sourceEntry('prefixFinal')));
          const prior = readObjectEntry<SliceIntent[]>(PRIOR, 'commands'); expect(prior).toHaveLength(558); same(prior.slice(0, INHERITED), commands.slice(0, INHERITED));
          let branch = state;
          for (const intent of prior.slice(INHERITED)) { expect(branch.status).toBe('ACTIVE'); branch = applySliceIntent(branch, intent); assertValidSliceState(branch); }
          same(branch, currentCapture(readObjectEntry(PRIOR, 'final'))); expect(branch.status).toBe('DEAD'); expect(branch.health).toBe(0); inheritedDeathVerified = true;
        }
        if (count <= PREFIX && row.intent.type === 'CONTINUE_LIFE') { expect(before.status).toBe('SLICE_COMPLETE'); expect(state.status).toBe('ACTIVE'); livingContinues++; }
        if (count <= PREFIX) {
          for (const root of ['fallenEarl', 'entropyDuke'] as const) {
            const a = before[root].encounter, b = state[root].encounter;
            if (a.enemyStatus !== b.enemyStatus && ['DEAD', 'SURRENDERED'].includes(b.enemyStatus)) {
              expect(state.status).toBe('ACTIVE'); same(b, original[root].encounter);
              sourceTerminals.push({ root, targetId: b.targetId, enemyStatus: b.enemyStatus, playerStatus: state.status });
            }
          }
        }
        if (count === PREFIX) same(state, original);
        if (transition) {
          const path = capturePath(transition.file); expect(readObjectEntry(path, 'commandCount')).toBe(count); same(readObjectEntry(path, 'lastIntent'), row.intent);
          // Two reducer states plus one parsed raw root at a time. Only digests retained.
          for (const root of ['beforeLast', 'final']) {
            const raw = readObjectEntry<SliceState>(path, root); expect([raw.schemaVersion, raw.contentVersion]).toEqual([202, 'prince-of-abolition-v202']);
            same(root === 'beforeLast' ? before : state, currentPrinceOfAbolitionReplayExpectation(currentCapture(raw)));
          }
          stateHashes.set(state.revision, captureValueHash(state)); assertOriginalContinuity(state, original);
          if (count > PREFIX) {
            expect(currentOriginals(state).site.clockSeconds).toBeGreaterThanOrEqual(currentOriginals(before).site.clockSeconds);
            expect(currentOriginals(state).site.playerTravelMetres).toBeGreaterThanOrEqual(currentOriginals(before).site.playerTravelMetres);
            if (row.intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') treatments.push({ paidPennies: 60, before: captureBody(before), after: captureBody(state) });
          }
        }
      }
      expect((await publicRows.next()).done).toBe(true);
    } finally { await publicRows.return(undefined); }
    expect(count).toBe(e.commands); expect(state.revision).toBe(e.commands + 1); same(state, currentPrinceOfAbolitionReplayExpectation(capturedState('final')));
    same(captureBody(state), e.final); assertValidSliceState(state); assertOriginalContinuity(state, original);
    expect(inheritedDeathVerified).toBe(true); expect(livingContinues).toBeGreaterThan(0);
    expect(sourceTerminals).toEqual(expect.arrayContaining([
      expect.objectContaining({ root: 'fallenEarl', enemyStatus: 'DEAD', playerStatus: 'ACTIVE' }),
      { root: 'entropyDuke', targetId: 'ED2-OSWIN', enemyStatus: 'SURRENDERED', playerStatus: 'ACTIVE' },
    ]));
    for (const filename of new Set(Object.values(snapshots))) {
      const saved = currentPrinceOfAbolitionReplayExpectation(currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8'))));
      expect(captureValueHash(saved), filename).toBe(stateHashes.get(saved.revision));
    }
    same(naturalEntry('creation'), sourceEntry('creation')); same(naturalEntry('strategy'), e.strategy); same(naturalEntry('provenance'), e.provenance);
    expect(naturalEntry('stage')).toBe(e.stage); expect(naturalEntry('error')).toBe(e.error); expect(naturalEntry('failurePhase')).toBe(e.failurePhase); same(naturalEntry('pendingIntent'), e.pendingIntent);
    same(treatments, e.treatments); same(treatments, naturalEntry('treatments')); same(treatments, summaryEntry('treatments'));
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256); expect(await captureFileHash(PRIOR)).toBe(evidence.priorSha256);
    // Windows run39354205666 reached the old 900s budget at912.162s with no assertion failure.
    // Give this full inherited campaign replay headroom without changing its checkpoints.
    // No global timeout change, producer invocation, giant output, seed/cursor search or state substitution.
  }, 1_200_000);

  it('accounts for real acquisition and life receipts without assuming successes, clinic visits or invented resources', () => {
    const e = observedCapture(), s = capturedState('final'), original = originalLivingPrefix(), stage = s.princeOfAbolition, life = stage.life;
    same(stage.bottles, e.bottles); same(stage.bottles, summaryEntry('bottles')); expect(stage.promotionWeek).toBe(e.promotionWeek);
    expect(new Set(stage.bottles.map(b => b.id)).size).toBe(stage.bottles.length); expect(stage.bottles.filter(b => b.status === 'CONSUMED').length).toBeLessThanOrEqual(12);
    expect(validatePrinceOfAbolitionAcquisitionJournal(s)).toBe(true); expect(validatePrinceOfAbolitionJournalContinuity(s)).toBe(true);
    for (const receipt of stage.acquisitionJournal) {
      const c = receipt.command;
      const fee = c.type === 'LEARN_GUIDANCE' ? 500 : c.type === 'BUY_POTION' ? 1200 : c.type === 'PREPARE_PROMOTION' ? 180 : c.type === 'REQUEST_SUPPLY' ? 100 : 0;
      const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(c.type) ? 1 : 0;
      expect(receipt.after.cash).toBe(receipt.before.cash - fee); expect(receipt.after.actions).toBe(receipt.before.actions - ap); same(receipt.before.gifts, receipt.after.gifts);
    }
    for (const bottle of stage.bottles.filter(b => b.status === 'CONSUMED')) {
      const save = replayCaptureBoundary(`consume-${bottle.id}`);
      expect(save.before.week - original.entropyDuke.promotionWeek!).toBeGreaterThanOrEqual(12); expect(save.before.princeOfAbolition.preparedWeek).toBe(save.before.week);
      expect(save.final.princeOfAbolition.preparedWeek).toBeNull(); expect(save.final.random.cursor - save.before.random.cursor).toBe(1);
      same(save.before.injuries, save.final.injuries); same(currentOriginals(save.before), currentOriginals(save.final));
      expect(stage.acquisitionJournal.filter(r => r.command.type === 'POTION_WORK' && r.command.bottleId === bottle.id)).toHaveLength(5);
      expect(bottle.preparationWeek).toBe(bottle.consumedWeek);
    }
    for (const id of PRINCE_OF_ABOLITION_CASE_IDS) {
      const c = life.cases[id]; expect(c.attempts.length).toBeLessThanOrEqual(1);
      expect(life.journal.filter(r => ['DIRECTED_AMPLIFICATION', 'EFFECT_MAINTENANCE'].includes(r.command.type) && 'caseId' in r.command && r.command.caseId === id).length).toBeLessThanOrEqual(1);
      expect(life.journal.filter(r => r.command.type === 'THROW_BALL' && r.command.caseId === id).length).toBeLessThanOrEqual(1);
    }
    for (const r of life.journal) {
      expect(r.after.cash).toBe(r.before.cash - r.paid.pennies); expect(r.after.actions).toBe(r.before.actions - r.paid.actions);
      expect(r.after.spirituality).toBe(r.before.spirituality - r.paid.spirituality); expect(r.after.mind).toBe(r.before.mind - r.paid.mind);
      same(r.before.gifts, r.after.gifts); same(r.operationBefore, r.operationAfter); same(r.siteBefore.parcel, r.siteAfter.parcel); same(r.siteBefore.pads, r.siteAfter.pads);
      expect(r.siteAfter.clockSeconds - r.siteBefore.clockSeconds).toBe(r.elapsedSeconds); expect(r.siteAfter.playerTravelMetres - r.siteBefore.playerTravelMetres).toBe(sum(r.moves, m => m.metres));
      if (r.command.type === 'PREPARE') { expect(r.command.method).toBe('ABILITY'); expect([r.paid.pennies, r.paid.actions]).toEqual([20, 1]); }
      if (r.command.type === 'INSPECT') expect([r.paid.cooperationEffort, r.paid.volunteerMind]).toEqual([3, 1]);
      if (r.command.type === 'DIRECTED_AMPLIFICATION' || r.command.type === 'EFFECT_MAINTENANCE') {
        expect([r.paid.spirituality, r.paid.actions, r.paid.pieceCharges]).toEqual([8, 0, 1]); expect(r.paid.mind).toBe(r.outcome === 'FAILURE' || r.outcome === 'GREAT_FAILURE' ? 4 : 2);
      }
      if (r.command.type === 'EXIT_ROOM') expect([r.paid.actions, r.elapsedSeconds, sum(r.moves, m => m.metres)]).toEqual([0, 4, 4]);
      if (r.command.type === 'BUY_ANNEX') expect([r.paid.pennies, r.paid.actions, r.elapsedSeconds, sum(r.moves, m => m.metres)]).toEqual([40, 1, 18, 16]);
    }
    same(actualLifeAbilityUse(s), e.lifeAbilityUse); same(summaryEntry('lifeAbilityUse'), e.lifeAbilityUse); same(summaryEntry('life'), life);
    same(PRINCE_OF_ABOLITION_CASE_IDS.filter(id => life.cases[id].status === 'RESOLVED'), e.completedCases);
    expect(validatePrinceOfAbolitionLifeState(s)).toBe(true); assertOriginalContinuity(s, original);
  }, 240_000);

  it('pins the actual three doses, six-round surrender, resisted maintenance and two retained LIGHT injuries', () => {
    const s = capturedState('final'), original = originalLivingPrefix(), p = s.princeOfAbolition;
    expect(p.bottles.map(b => [b.id, b.outcome, b.consumedWeek])).toEqual([
      ['prince-of-abolition-potion-1', 'FAILURE', 195], ['prince-of-abolition-potion-2', 'FAILURE', 205], ['prince-of-abolition-potion-3', 'SUCCESS', 216],
    ]);
    expect(p.promotionWeek).toBe(216); expect(s).toMatchObject({ status: 'ACTIVE', revision: 925, week: 222,
      health: 80, mind: 71, spirituality: 97, cash: 140, actionsRemaining: 1, injuryRisk: 1, random: { seed: SEED, cursor: 315 } });
    expect(s.injuries).toEqual([
      { id: 'lawyer-rebuild-natural:combat:1:PLAYER:920:0', severity: 'LIGHT', acquiredRevision: 920, treatedRevision: null },
      { id: 'lawyer-rebuild-natural:combat:5:PLAYER:924:1', severity: 'LIGHT', acquiredRevision: 924, treatedRevision: null },
    ]);
    expect(naturalEntry('treatments')).toEqual([]);
    expect([s.progression.mastery['black-emperor.s1.directed-amplification'], s.progression.mastery['black-emperor.s1.effect-maintenance']]).toEqual([16, 8]);
    expect(s.progression.mastery['black-emperor.s2.action-amplification']).toBe(40);
    expect(original.progression.mastery['black-emperor.s2.action-amplification']).toBe(8);
    expect(p.life.cases['directed-throw'].attempts[0]).toMatchObject({ castTier: 'SUCCESS', throwTier: 'SUCCESS', amplification: 35, result: 'ABILITY' });
    expect(p.life.cases['maintained-flight'].attempts[0]).toMatchObject({ castTier: 'GREAT_SUCCESS', throwTier: 'FAILURE', maintenanceSeconds: 20, result: 'ABILITY' });
    expect(p.life.cases['withdrawn-input'].attempts[0]).toMatchObject({ castTier: 'SUCCESS', withdrawn: true, amplification: 0, result: 'ORDINARY', appliedAbilityIds: [] });
    const rounds = s.combatHistory.slice(original.combatHistory.length), mental = rounds[1]!, resisted = rounds[2]!.princeOfAbolitionOutcome!.playerActions.find(a => a.id === 'black-emperor.s1.effect-maintenance')!;
    expect(mental).toMatchObject({ round: 2, winner: 'ENEMY', consequenceDomain: 'MENTAL' });
    expect(mental.princeOfAbolitionOutcome).toMatchObject({ source: { playerMind: 91 }, playerMindAfter: 79 });
    expect(sum(mental.princeOfAbolitionOutcome!.playerActions, a => a.mindCost)).toBe(2);
    expect(resisted).toMatchObject({ paidCost: 8, mindCost: 4, check: { tier: 'SUCCESS' }, succeeded: false, resisted: true, windowGranted: null, masteryApplied: [] });
    expect(actualCombatAbilityUse(s, original)['black-emperor.s1.effect-maintenance']).toMatchObject({ selectedSlots: 5, paidAttempts: 1, resistedAttempts: 1, actualApplications: 0 });
    expect(p.gifts.slice(12)).toEqual([
      { id: 'BR7-GIFT-13', location: 'GIVEN', destination: 'BATTLE:PRINCE_OF_ABOLITION_DISPUTE:GROUND', givenWeek: 222 },
      { id: 'BR7-GIFT-14', location: 'PLAYER', destination: null, givenWeek: null }, { id: 'BR7-GIFT-15', location: 'PLAYER', destination: null, givenWeek: null },
    ]);
    expect(p.encounter.supportPieces.map(v => [v.status, v.wear, v.usedRound, v.usedOrder])).toEqual([['SPENT', 1, 1, 2], ['SPENT', 1, 1, 4], ['SPENT', 1, 3, 2]]);
    expect(p.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 6, enemyHealth: 50, enemyMind: 100, enemySpirituality: 73, exitMetres: 4, exitSeconds: 4 });
    expect(getPrinceOfAbolitionCurrentSite(s)).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 236, clockSeconds: 983, guide: { location: 'OUTSIDE' }, volunteer: { location: 'OUTSIDE', mind: 97 } });
    assertOriginalContinuity(s, original);
  }, 120_000);

  it('replays all observed new battle rounds and retains honest mastery, gifts, costs and raw/public terminal equality', () => {
    const e = observedCapture(), original = originalLivingPrefix(), s = capturedState('final'), rounds = s.combatHistory.slice(original.combatHistory.length);
    same(rounds.map(r => r.round), e.combatRounds); same(rounds, summaryEntry('rounds')); same([...new Set(rounds.map(r => r.consequenceDomain))], e.consequenceDomains);
    same(actualCombatAbilityUse(s, original), e.combatAbilityUse); same(summaryEntry('combatAbilityUse'), e.combatAbilityUse);
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.princeOfAbolitionOutcome!;
      same(save.final.lastCombatRound, round); same(currentPrinceOfAbolitionCombatSource(save.before), o.source);
      same(replayPrinceOfAbolitionCombatRound(o.source, round.stance).round, round);
      expect(o.source).toMatchObject({ targetId: 'PA1-EDMUND', targetAge: 44, independentMind: true, actualBody: true, policy: 'ALL', maxActionCount: 6, thirdPartiesInArea: 0, automaticAllyImmunity: false });
      same(o.source.originals, sourceOriginals(original)); same(o.source.operation, original.entropyDuke.life.operation);
      expect(o.playerActions).toHaveLength(round.playerCount); expect(o.enemyActions).toHaveLength(round.enemyCount);
      expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - sum(o.playerActions, a => a.paidCost));
      const actualMentalConsequence = round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0;
      expect(o.playerMindAfter).toBe(Math.max(0, o.source.playerMind - sum(o.playerActions, a => a.mindCost) - actualMentalConsequence));
      expect(save.final.random.cursor).toBe(o.randomCursorAfter);
      const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      expect(actions.map(a => a.order)).toEqual(actions.map((_, i) => i));
      for (const a of actions) { expect(a.randomCursorAfter).toBeGreaterThanOrEqual(a.randomCursorBefore); expect(a.elapsedSeconds).toBe(5); }
      assertOriginalContinuity(save.final, original);
    }
    same(summaryEntry('currentOriginals'), currentOriginals(s)); same(summaryEntry('encounter'), s.princeOfAbolition.encounter);
    same(s.princeOfAbolition.encounter.terminal, e.terminal); expect(validatePrinceOfAbolitionEncounterState(s)).toBe(true);
    const raw = naturalEntry<SliceState>('final'), reopened = currentCapture(raw); same(reopened, s); same(migrateSliceState(reopened), s);
    same(projectSliceState(reopened), projectSliceState(s));
    // The producer stores public controls/compact state in public.jsonl, not a
    // separate full public snapshot. Its complete ledger is pinned and replayed
    // above; full projection equality is checked on reopen here.
    same(captureBody(s), e.final); same(applySliceIntent(capturedState('beforeLast'), naturalEntry<SliceIntent>('lastIntent')), s);
    assertValidSliceState(s); assertOriginalContinuity(s, original);
    if (e.stage === STAGES[0]) {
      expect(e.error).toBeNull(); expect(s.status).toBe('ACTIVE'); expect(s.progression.sequence).toBe(1); expect(s.progression.acting).toBe(100);
      expect(s.princeOfAbolition.life).toMatchObject({ reflected: true, activeCase: null, pending: null, flight: null, volunteerMindSpent: 3, cooperationEffortSpent: 9 });
      expect(e.completedCases).toEqual([...PRINCE_OF_ABOLITION_CASE_IDS]); expect(s.combat).toBeNull(); expect(e.terminal).not.toBeNull();
      expect(s.princeOfAbolition.encounter.terminal!.outcome).not.toBe('PLAYER_DEAD');
      expect(s.princeOfAbolition.encounter.terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 });
      expect(getPrinceOfAbolitionCurrentSite(s).playerLocation).toBe('OUTSIDE');
      expect(s.princeOfAbolition.life.cases['withdrawn-input'].attempts[0]).toMatchObject({ withdrawn: true, result: 'ORDINARY', appliedAbilityIds: [] });
    } else if (e.stage === STAGES[1]) {
      expect(s.status).toBe('ACTIVE'); expect(s.progression.sequence).toBe(2); expect(rounds).toHaveLength(0);
      const consumed = s.princeOfAbolition.bottles.filter(b => b.status === 'CONSUMED'); expect(consumed).toHaveLength(12);
      expect(consumed.every(b => b.outcome === 'FAILURE' || b.outcome === 'GREAT_FAILURE')).toBe(true);
    } else if (e.stage === STAGES[2]) {
      expect(s.status).toBe('ACTIVE'); expect(s.princeOfAbolition.encounter.status).toBe('FIGHTING'); expect(s.princeOfAbolition.encounter.terminal).toBeNull(); expect(s.combat).not.toBeNull(); expect(rounds).toHaveLength(90);
    } else {
      expect(e.stage).toBe(STAGES[3]); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0); expect(projectSliceState(s).canAct).toBe(false);
      const hash = captureValueHash(s); expect(() => applySliceIntent(s, { type: 'CONTINUE_LIFE' })).toThrow(); expect(captureValueHash(s)).toBe(hash);
    }
  }, 240_000);
});
