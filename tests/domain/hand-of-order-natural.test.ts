import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { handOfOrderInheritedView, resolveHandOfOrderOriginalsSnapshot, validateHandOfOrderAcquisitionJournal, validateHandOfOrderJournalContinuity } from '../../src/domain/hand-of-order/index.js';
import { HAND_OF_ORDER_SOURCE_KEYS, HAND_OF_ORDER_ABILITY_IDS } from '../../src/domain/hand-of-order/types.js';
import { HAND_OF_ORDER_CASE_IDS, getHandOfOrderCurrentSite, validateHandOfOrderLifeState } from '../../src/domain/hand-of-order/life.js';
import { validateHandOfOrderEncounterState } from '../../src/domain/hand-of-order/encounter.js';
import { currentHandOfOrderCombatSource, projectHandOfOrderRoundOutcome, replayHandOfOrderCombatRound } from '../../src/domain/hand-of-order/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { HAND_OF_ORDER_CAPTURE_EVIDENCE as evidence, HAND_OF_ORDER_METADATA_FILES as METADATA, HAND_OF_ORDER_CAPTURE_STAGES as STAGES } from './hand-of-order-capture-evidence.js';
import { HAND_OF_ORDER_ROOT as ROOT, HAND_OF_ORDER_SOURCE as SOURCE, HAND_OF_ORDER_RECOVERY as RECOVERY, HAND_OF_ORDER_DEATH as DEATH,
  HAND_OF_ORDER_PREFIX_COUNT as PREFIX, HAND_OF_ORDER_INHERITED_COUNT as INHERITED, HAND_OF_ORDER_SEED as SEED,
  captureMetadata, observedCapture, naturalEntry, sourceEntry, summaryEntry, capturePath, captureFileHash, insertionOrderHash, captureValueHash, currentCapture, captureJsonLines, capturePublicBody, publicCaptureControl, assertPublicCaptureControl,
  originalLivingPrefix, capturedState, capturedSnapshot, namedBoundary, replayCaptureBoundary, captureBody, sourceOriginals, currentOriginals, currentPlate,
  actualLifeAbilityUse, actualCombatAbilityUse, assertOriginalContinuity, sameCaptureValue as same } from './hand-of-order-capture-helper.js';
import { expectedPublicHandOfOrderOutcome, assertNoPrivateHandOfOrderFields, decoratePrivateProbe } from './hand-of-order-public-evidence.js';

interface FileEvidence { bytes: number; sha256: string }
interface Integrity { producerSha256: string; freezeSha256: string; frozenFiles: ({ file: string } & FileEvidence)[]; metadata: Record<string, FileEvidence>; files: Record<string, FileEvidence> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }
interface Ledger { step: number; sourcePrefix: boolean; boundaryKey: string | null; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> }
interface PublicRow { step: number; revision: number; command: SliceIntent; control: unknown; randomBefore: SliceState['random']; randomAfter: SliceState['random']; before: ReturnType<typeof capturePublicBody>; after: ReturnType<typeof capturePublicBody> }
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
const inventory = () => readdirSync(ROOT).sort().map(file => { const s = statSync(`${ROOT}/${file}`); return { file, bytes: s.size, mtimeMs: s.mtimeMs, ctimeMs: s.ctimeMs }; });

it('requires a confirmed frozen stage206 observation rather than treating missing or running evidence as success', () => { observedCapture(); });

describe('Hand of Order literal same-seed natural capture', () => {
  it('pins every immutable member, original sources, both scripts, raw203 hashes and the complete frozen inventory', async () => {
    const e = observedCapture(), { boundaries, steps, snapshots } = captureMetadata();
    expect(e.commands).toBeGreaterThan(PREFIX); expect(e.uniqueTransitions).toBe(e.commands - PREFIX + 1); expect(e.namedBoundaries).toBe(e.uniqueTransitions + e.aliases); expect(STAGES).toContain(e.stage);
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256); expect(await captureFileHash(RECOVERY)).toBe(evidence.recoverySha256); expect(await captureFileHash(DEATH)).toBe(evidence.deathSha256);
    expect(await captureFileHash('scripts/play/hand-of-order-stage.mjs')).toBe(e.producerSha256);
    expect(Object.keys(e.metadataHashes).sort()).toEqual([...METADATA].sort());
    for (const [file, sha256] of Object.entries(e.metadataHashes)) { const path = `${ROOT}/${file}`; expect(realpathSync(path)).toBe(resolve(path)); expect(await captureFileHash(path)).toBe(sha256); }
    const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as Integrity;
    expect(integrity.producerSha256).toBe(e.producerSha256); expect(integrity.freezeSha256).toBe(e.freezeSha256); expect(insertionOrderHash(integrity.frozenFiles)).toBe(e.freezeSha256);
    // The observed verifier hash remains the raw capture pin. Only the exact
    // reviewed UI/verifier revision may differ; no dist import or replay is needed.
    const verifierFile = 'scripts/play/hand-of-order-save.mjs', currentVerifierHash = await captureFileHash(verifierFile);
    expect(integrity.frozenFiles.find(row => row.file === verifierFile)?.sha256).toBe(e.saveVerifierSha256);
    if (currentVerifierHash !== e.saveVerifierSha256) {
      const revisionPath = 'scripts/play/hand-of-order-ui-revision.json';
      expect(realpathSync(revisionPath)).toBe(resolve(revisionPath));
      const revision = JSON.parse(readFileSync(revisionPath, 'utf8')) as {
        kind: string; captureFreezeSha256: string; runtimeFreezeSha256: string;
        changes: { before: { file: string } & FileEvidence; after: { file: string } & FileEvidence }[];
      };
      expect(revision.kind).toBe('HAND_OF_ORDER206_REVIEWED_UI_DRAWER_REVISION');
      expect(revision.captureFreezeSha256).toBe(e.freezeSha256);
      expect(revision.changes.map(row => row.before.file).sort()).toEqual(['src/renderer/SliceApp.tsx', verifierFile].sort());
      for (const row of revision.changes) {
        expect(row.before).toEqual(integrity.frozenFiles.find(file => file.file === row.before.file));
        expect(row.after.file).toBe(row.before.file); expect(row.after).not.toEqual(row.before);
        // Later stages may extend the renderer; the historical two-row proof
        // stays exact, while the stage206 verifier itself must remain pinned.
        if (row.after.file === verifierFile || Number(CURRENT_SCHEMA_VERSION) === 203) {
          expect(realpathSync(row.after.file)).toBe(resolve(row.after.file));
          expect(row.after.bytes).toBe(statSync(row.after.file).size); expect(row.after.sha256).toBe(await captureFileHash(row.after.file));
        }
      }
      const revisedFiles = integrity.frozenFiles.map(before => revision.changes.find(row => row.before.file === before.file)?.after ?? before);
      expect(insertionOrderHash(revisedFiles)).toBe(revision.runtimeFreezeSha256);
    }
    expect(Object.keys(integrity.metadata).sort()).toEqual(METADATA.filter(name => name !== 'capture-integrity.json').sort());
    const members = [...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].sort();
    same(Object.keys(integrity.files).sort(), members); same(readdirSync(ROOT).sort(), [...members, ...METADATA].sort());
    expect(members.length + METADATA.length).toBe(e.files); expect(sum(inventory(), f => f.bytes)).toBe(e.bytes);
    for (const [file, pin] of Object.entries({ ...integrity.metadata, ...integrity.files })) {
      const path = file.endsWith('.json') ? capturePath(file) : `${ROOT}/${file}`; expect(realpathSync(path)).toBe(resolve(path)); expect(statSync(path).size).toBe(pin.bytes); expect(await captureFileHash(path)).toBe(pin.sha256);
    }
    same(steps, e.boundarySteps); same(Object.keys(snapshots), e.snapshots);
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) { const raw = naturalEntry<SliceState>(key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([203, 'hand-of-order-v203']); }
    for (const file of new Set(Object.values(snapshots))) { expect(readObjectEntry(capturePath(file), 'schemaVersion')).toBe(203); expect(readObjectEntry(capturePath(file), 'contentVersion')).toBe('hand-of-order-v203'); }
    const prefix = capturePath('source-prefix.json'), death = capturePath('original-death-source.json');
    for (const [key, value] of Object.entries({ source: SOURCE, sourceSha256: evidence.sourceSha256, sourceRoot: 'final', prefixCount: PREFIX, inheritedDirectedPrefix: false,
      rawCommandsSha256: evidence.prefixSha256, predecessorSource: RECOVERY, predecessorSha256: evidence.recoverySha256, inheritedCount: INHERITED, inheritedCommandsSha256: evidence.inheritedSha256 })) same(readObjectEntry(prefix, key), value);
    for (const [captured, original] of [['rawInitial', 'initial'], ['rawFinal', 'final'], ['rawInheritedFinal', 'prefixFinal']] as const) same(readObjectEntry(prefix, captured), sourceEntry(original));
    same(readObjectEntry(prefix, 'commands'), sourceEntry('commands')); expect(readObjectEntry(death, 'source')).toBe(DEATH); expect(readObjectEntry(death, 'sourceSha256')).toBe(evidence.deathSha256); expect(readObjectEntry(death, 'commonPrefixCount')).toBe(474);
    for (const [captured, original] of [['rawInitial', 'initial'], ['rawFinal', 'final'], ['commands', 'commands'], ['seed', 'seed'], ['creation', 'creation']] as const) same(readObjectEntry(death, captured), readObjectEntry(DEATH, original));
    // These pins belong to the captured raw203 states, separately from moving CURRENT migration.
    expect(readObjectEntry(prefix, 'migratedWholeStateSha256')).toBe(captureValueHash(naturalEntry('prefixFinal')));
    expect(summaryEntry<{ migratedWholeSourceSha256: string }>('source').migratedWholeSourceSha256).toBe(captureValueHash(naturalEntry('prefixFinal')));
    expect(captureValueHash(naturalEntry('final'))).toBe(e.finalRawStateSha256);
    same(capturedState('prefixFinal'), originalLivingPrefix()); same(capturedState('initial'), currentCapture(sourceEntry('initial')));
  }, 240_000);

  describe.sequential('replays the original706 current intents continuously and retains the complete801-command archive', () => {
    // One continuous generator owns the actual CURRENT state. Fixed blocks
    // never reload a checkpoint; after706 only the frozen evidence is read.
    const currentEnd = 706, blockEnds: readonly number[] = [200, 400, 594, 646, 698, 702, currentEnd];
    let completedThrough = 0, replayFailed = false, activeSignal: AbortSignal | undefined;
    async function* replayCommands(): AsyncGenerator<number, number, void> {
      const e = observedCapture(), { commands, boundaries, steps, snapshots } = captureMetadata(), filesBefore = inventory();
      expect(e.commands).toBe(801); expect(commands).toHaveLength(e.commands); same(commands.slice(0, PREFIX), sourceEntry('commands'));
      expect(commands[currentEnd]).toEqual({ type: 'HAND_OF_ORDER', command: { type: 'REQUEST_SUPPLY' } });
      expect(commands[708]).toEqual({ type: 'HAND_OF_ORDER', command: { type: 'RECEIVE_SUPPLY' } });
      expect(naturalEntry('seed')).toBe(SEED); expect(naturalEntry('prefixVerified')).toBe(true); expect(naturalEntry('prefixCount')).toBe(PREFIX); expect(naturalEntry('inheritedPrefixCount')).toBe(INHERITED);
      const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as Transition[];
      expect(transitions).toHaveLength(e.uniqueTransitions); const byStep = new Map(transitions.map(row => [row.commandIndex, row]));
      expect(Object.keys(boundaries)).toHaveLength(e.namedBoundaries); same(Object.keys(steps), Object.keys(boundaries)); same([...new Set(Object.values(boundaries))], transitions.map(row => row.file));
      for (const [i, row] of transitions.entries()) { expect([row.commandIndex, row.beforeRevision, row.afterRevision]).toEqual([PREFIX + i, PREFIX + i, PREFIX + i + 1]); expect(boundaries[row.key]).toBe(row.file); expect(steps[row.key]).toBe(row.commandIndex); }
      for (const [name, file] of Object.entries(boundaries)) expect(byStep.get(steps[name]!)?.file, name).toBe(file);
      const original = originalLivingPrefix(), deathCommands = readObjectEntry<SliceIntent[]>(DEATH, 'commands'), recoveryCommands = readObjectEntry<SliceIntent[]>(RECOVERY, 'commands');
      same(commands.slice(0, INHERITED), recoveryCommands); same(commands.slice(0, 474), deathCommands.slice(0, 474)); expect(commands[474]).not.toEqual(deathCommands[474]);
      let state = createSliceRun(original.runId, sourceEntry<Parameters<typeof createSliceRun>[1]>('creation'), SEED), count = 0, oldDeathVerified = false, recoveryVerified = false, prefixVerified = false, livingContinues = 0;
      same(state, capturedState('initial'));
      const publicRows = captureJsonLines<PublicRow>('public.jsonl'), rawStateHashes = new Map<number, string>(), treatments: unknown[] = [];
      let previousBody = captureBody(state), previousRawStateHash: string | undefined, currentEndpointHash: string | undefined;
      try {
        for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
          if (replayFailed) throw new Error('A preceding replay block failed or timed out.');
          activeSignal?.throwIfAborted();
          expect(row.step).toBe(++count); expect(row.sourcePrefix).toBe(count <= PREFIX); same(row.intent, commands[count - 1]);
          const replaying = count <= currentEnd, legacySupply = count === 707 || count === 709;
          expect(validateSlicePayload(row.intent)).toBe(!legacySupply);
          same(row.before, previousBody); expect(row.after.revision).toBe(row.before.revision + 1);
          expect(row.before.status).toBe(row.intent.type === 'CONTINUE_LIFE' ? 'SLICE_COMPLETE' : 'ACTIVE');
          expect(row.after.random.seed).toBe(SEED); expect(row.after.random.cursor).toBeGreaterThanOrEqual(row.before.random.cursor); previousBody = row.after;
          const before = state, transition = byStep.get(count); let proof: PublicRow | null = null;
          if (replaying) same(captureBody(before), row.before);
          if (count > PREFIX) {
            expect(transition).toBeDefined(); expect(row.boundaryKey).toBe(transition!.key);
            const next = await publicRows.next(); if (next.done) throw new Error(`Missing actual public row ${count}`); proof = next.value;
            expect(proof.step).toBe(count); expect(proof.revision).toBe(row.before.revision); same(proof.command, row.intent);
            same(proof.randomBefore, row.before.random); same(proof.randomAfter, row.after.random);
            if (replaying) { same(proof.control, publicCaptureControl(before, row.intent)); same(proof.before, capturePublicBody(before)); }
            else {
              // The raw public ledger is hash-pinned, not a current permission
              // grant. Removed supply and fourth-original actions stay archived.
              const control = proof.control as { enabled?: boolean; kind?: string; stance?: string; command?: unknown };
              if (row.intent.type === 'COMBAT_ROUND') expect(control).toMatchObject({ kind: 'COMBAT_ROUND', stance: row.intent.stance });
              else expect(control.enabled).toBe(true);
              if (row.intent.type === 'HAND_OF_ORDER') same(control.command, row.intent.command);
            }
          } else expect(row.boundaryKey).toBeNull();
          if (replaying) {
            state = applySliceIntent(before, row.intent); assertValidSliceState(state);
            expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe(SEED); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor); same(captureBody(state), row.after);
            if (proof) { same(proof.after, capturePublicBody(state)); same(proof.randomAfter, state.random); }
            if (count === 474) {
              same(state, currentCapture(readObjectEntry(RECOVERY, 'initial'))); const preserved = captureValueHash(state); let dead = state;
              for (const intent of deathCommands.slice(474)) { expect(dead.status).toBe('ACTIVE'); dead = applySliceIntent(dead, intent); assertValidSliceState(dead); }
              same(dead, currentCapture(readObjectEntry(DEATH, 'final'))); expect(dead).toMatchObject({ status: 'DEAD', health: 0, revision: 478, random: { seed: SEED, cursor: 290 } });
              expect(() => applySliceIntent(dead, { type: 'CONTINUE_LIFE' })).toThrow(); expect(captureValueHash(state)).toBe(preserved); oldDeathVerified = true;
            }
            if (count === INHERITED) { same(state, currentCapture(sourceEntry('prefixFinal'))); same(state, currentCapture(readObjectEntry(RECOVERY, 'final'))); recoveryVerified = true; }
            if (count <= PREFIX && row.intent.type === 'CONTINUE_LIFE') { expect(before.status).toBe('SLICE_COMPLETE'); expect(state.status).toBe('ACTIVE'); livingContinues++; }
            if (count === PREFIX) { same(state, original); prefixVerified = true; }
          }
          if (transition) {
            const path = capturePath(transition.file); expect(readObjectEntry(path, 'commandCount')).toBe(count); same(readObjectEntry(path, 'lastIntent'), row.intent);
            // All208 original boundaries retain full raw-state adjacency and
            // exact private/public/RNG evidence. Only the legal prefix is also
            // migrated and compared with the actual CURRENT reducer state.
            for (const root of ['beforeLast', 'final'] as const) {
              const raw = readObjectEntry<SliceState>(path, root); expect([raw.schemaVersion, raw.contentVersion]).toEqual([203, 'hand-of-order-v203']);
              const rawHash = captureValueHash(raw), isBefore = root === 'beforeLast';
              same(captureBody(raw), isBefore ? row.before : row.after);
              if (proof) same(capturePublicBody(raw), isBefore ? proof.before : proof.after);
              if (isBefore && previousRawStateHash !== undefined) expect(rawHash).toBe(previousRawStateHash);
              if (!isBefore) { previousRawStateHash = rawHash; rawStateHashes.set(raw.revision, rawHash); }
              if (replaying) same(isBefore ? before : state, withCurrentGuidance(currentCapture(raw)));
            }
            if (replaying) {
              assertOriginalContinuity(state, original);
              if (count > PREFIX) {
                expect(getHandOfOrderCurrentSite(state).clockSeconds).toBeGreaterThanOrEqual(getHandOfOrderCurrentSite(before).clockSeconds);
                expect(getHandOfOrderCurrentSite(state).playerTravelMetres).toBeGreaterThanOrEqual(getHandOfOrderCurrentSite(before).playerTravelMetres);
                if (row.intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') treatments.push({ paidPennies: 60, before: captureBody(before), after: captureBody(state) });
              }
            }
          }
          if (count === currentEnd) currentEndpointHash = captureValueHash(state);
          // Suspend only after every check for this actual reducer-produced state.
          if (count < currentEnd && blockEnds.includes(count)) yield count;
        }
        expect((await publicRows.next()).done).toBe(true);
      } finally { await publicRows.return(undefined); }
      expect(count).toBe(e.commands); same(previousBody, e.final);
      expect(state).toMatchObject({ status: 'ACTIVE', revision: currentEnd + 1, week: 169, health: 93, mind: 85, spirituality: 120,
        cash: 190, actionsRemaining: 2, random: { seed: SEED, cursor: 370 }, progression: { sequence: 2, acting: 100 } });
      expect(state.handOfOrder.bottles.map(b => [b.id, b.status, b.outcome])).toEqual([
        ['hand-of-order-potion-1', 'CONSUMED', 'FAILURE'], ['hand-of-order-potion-2', 'CONSUMED', 'FAILURE'], ['hand-of-order-potion-3', 'CONSUMED', 'FAILURE'],
      ]);
      expect(captureValueHash(state)).toBe(currentEndpointHash);
      expect(projectSliceState(state).handOfOrder.actions.some(action => ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(action.command.type))).toBe(false);
      assertPublicCaptureControl(state, { type: 'HAND_OF_ORDER', command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'hand-of-order-potion-1' } });
      for (const intent of [commands[currentEnd]!, commands[708]!]) {
        expect(validateSlicePayload(intent)).toBe(false); expect(() => applySliceIntent(state, intent)).toThrow(); expect(captureValueHash(state)).toBe(currentEndpointHash);
      }
      expect(oldDeathVerified).toBe(true); expect(recoveryVerified).toBe(true); expect(prefixVerified).toBe(true); expect(livingContinues).toBeGreaterThan(0);
      for (const filename of new Set(Object.values(snapshots))) {
        const saved = JSON.parse(readFileSync(capturePath(filename), 'utf8')) as SliceState;
        expect([saved.schemaVersion, saved.contentVersion]).toEqual([203, 'hand-of-order-v203']); expect(captureValueHash(saved), filename).toBe(rawStateHashes.get(saved.revision));
      }
      expect(previousRawStateHash).toBe(e.finalRawStateSha256); expect(previousRawStateHash).toBe(captureValueHash(naturalEntry('final')));
      const archived = capturedState('final');
      expect(validateHandOfOrderAcquisitionJournal(archived)).toBe(true); expect(validateHandOfOrderJournalContinuity(archived)).toBe(true);
      expect(validateHandOfOrderLifeState(archived)).toBe(true); expect(validateHandOfOrderEncounterState(archived)).toBe(true);
      expect(archived.handOfOrder.bottles).toHaveLength(6); expect(archived.handOfOrder.bottles.every(b => b.recovery === undefined)).toBe(true);
      expect(resolveHandOfOrderOriginalsSnapshot(archived.handOfOrder)).toBeNull();
      expect(archived).toMatchObject({ status: 'DEAD', revision: e.commands + 1, progression: { sequence: 1 } }); same(captureBody(archived), e.final);
      same(treatments, e.treatments); same(treatments, naturalEntry('treatments')); same(treatments, summaryEntry('treatments'));
      same(inventory(), filesBefore); assertOriginalContinuity(state, original); assertOriginalContinuity(archived, original);
      return currentEnd;
    }
    const replay = replayCommands();
    afterAll(async () => { replayFailed = true; await replay.return(completedThrough); });
    for (const [index, end] of blockEnds.entries()) {
      const start = index === 0 ? 1 : blockEnds[index - 1]! + 1;
      it(`replays contiguous current commands ${start}-${end}${index === blockEnds.length - 1 ? ' and validates all801 archived commands' : ''}`, async ({ signal, onTestFailed }) => {
        const markFailed = () => { replayFailed = true; };
        signal.addEventListener('abort', markFailed, { once: true }); onTestFailed(markFailed);
        try {
          expect(replayFailed, 'A preceding replay block must pass before continuing.').toBe(false);
          expect(completedThrough, 'The next block must start at the actual prior reducer endpoint.').toBe(start - 1);
          activeSignal = signal;
          const result = await replay.next();
          signal.throwIfAborted();
          expect(result).toEqual({ value: end, done: index === blockEnds.length - 1 });
          completedThrough = end;
        } catch (error) { markFailed(); throw error; }
      }, 600_000);
    }
  });

  it('accounts for actual paid wound treatment, acquisition, every finite dose and honest bounded life receipts', () => {
    const e = observedCapture(), s = capturedState('final'), original = originalLivingPrefix(), h = s.handOfOrder, life = h.life;
    same(captureBody(original), e.originalBody); same(original.character, e.originalCharacter); same(original.progression.mastery, e.originalMastery);
    same(h.bottles, e.bottles); same(h.bottles, summaryEntry('bottles')); expect(h.promotionWeek).toBe(e.promotionWeek); expect(new Set(h.bottles.map(b => b.id)).size).toBe(h.bottles.length);
    same(naturalEntry('treatments'), e.treatments); same(summaryEntry('treatments'), e.treatments);
    const treated = capturedSnapshot('treated'); expect(treated.health).toBe(100); expect(treated.injuries).toEqual([]); expect(treated.injuryRisk).toBe(0); assertOriginalContinuity(treated, original);
    expect(validateHandOfOrderAcquisitionJournal(s)).toBe(true); expect(validateHandOfOrderJournalContinuity(s)).toBe(true);
    for (const r of h.acquisitionJournal) {
      const c = r.command, fee = c.type === 'LEARN_GUIDANCE' ? 500 : c.type === 'BUY_POTION' ? 1200 : c.type === 'PREPARE_PROMOTION' ? 180 : c.type === 'REQUEST_SUPPLY' ? 100 : 0;
      const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(c.type) ? 1 : 0;
      expect(r.after.cash).toBe(r.before.cash - fee); expect(r.after.actions).toBe(r.before.actions - ap); same(r.after.injuries, r.before.injuries);
      expect(r.actor).toMatchObject({ pathwayId: 'justiciar', balancerPromotionWeek: 126, arbiterPromotionWeek: 9 });
    }
    for (const bottle of h.bottles.filter(b => b.status === 'CONSUMED')) {
      const b = bottle.id === 'hand-of-order-potion-4' ? archivedFourthDose() : replayCaptureBoundary(`consume-${bottle.id}`); expect(b.before.week - original.balancer.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(b.before.handOfOrder.preparedWeek).toBe(b.before.week); expect(b.final.handOfOrder.preparedWeek).toBeNull(); expect(b.final.random.cursor - b.before.random.cursor).toBe(1);
      same(b.before.injuries, b.final.injuries); same(currentOriginals(b.before), currentOriginals(b.final));
      expect(h.acquisitionJournal.filter(r => r.command.type === 'POTION_WORK' && r.command.bottleId === bottle.id)).toHaveLength(5); expect(bottle.preparationWeek).toBe(bottle.consumedWeek);
      if (b.final.progression.sequence === 1) { expect(b.final.health).toBe(b.before.health); expect(b.final.spirituality).toBe(b.before.spirituality); same(b.final.progression.mastery, { ...b.before.progression.mastery, ...Object.fromEntries(HAND_OF_ORDER_ABILITY_IDS.map(id => [id, 0])) }); }
    }
    for (const id of HAND_OF_ORDER_CASE_IDS) {
      expect(life.cases[id].attempts.length).toBeLessThanOrEqual(1);
      expect(life.journal.filter(r => ['BATTLEFIELD_DIVISION', 'AFTERMATH_CONTROL'].includes(r.command.type) && 'caseId' in r.command && r.command.caseId === id).length).toBeLessThanOrEqual(1);
      const a = life.cases[id].attempts[0]; if (!a) continue;
      expect(a.effortSpent).toBe(3); expect(a.volunteerMindSpent).toBe(1);
      if (life.cases[id].status === 'RESOLVED') expect(a).toMatchObject({ closed: true, inspected: true, objectsReturned: true, resultRead: true, objectRetrieved: true });
    }
    for (const r of life.journal) {
      expect(r.after.cash).toBe(r.before.cash - r.paid.pennies); expect(r.after.actions).toBe(r.before.actions - r.paid.actions);
      expect(r.after.spirituality).toBe(r.before.spirituality - r.paid.spirituality); expect(r.after.mind).toBe(r.before.mind - r.paid.mind); expect(r.after.health).toBe(r.before.health - r.paid.health);
      expect(r.clockAfter).toBeGreaterThanOrEqual(r.clockBefore);
      if (r.command.type === 'BATTLEFIELD_DIVISION' || r.command.type === 'AFTERMATH_CONTROL') { expect([r.paid.spirituality, r.paid.actions]).toEqual([8, 1]); expect(r.paid.mind).toBe(r.tier === 'FAILURE' || r.tier === 'GREAT_FAILURE' ? 4 : 2); expect(r.source).toMatchObject({ difficulty: 18, coreStat: 'knowledge', supportPiecesBefore: expect.any(Number) }); }
      if (r.command.type === 'EXIT_ORIGINAL') { expect(r.clockAfter - r.clockBefore).toBe(4); expect(r.paid.actions).toBe(0); }
      if (r.command.type === 'RENT_ANNEX') expect([r.paid.pennies, r.paid.actions]).toEqual([40, 1]);
    }
    same(actualLifeAbilityUse(s), e.lifeAbilityUse); same(summaryEntry('lifeAbilityUse'), e.lifeAbilityUse); same(summaryEntry('life'), life);
    same(HAND_OF_ORDER_CASE_IDS.filter(id => life.cases[id].status === 'RESOLVED'), e.completedCases); assertOriginalContinuity(s, original);
  }, 240_000);

  it('replays actual battle rounds with one continuing original plate, finite materials, costs and application-only mastery', () => {
    const e = observedCapture(), original = originalLivingPrefix(), s = capturedState('final'), rounds = s.combatHistory.slice(original.combatHistory.length);
    same(rounds.map(r => r.round), e.combatRounds); same(rounds, summaryEntry('rounds')); same([...new Set(rounds.map(r => r.consequenceDomain ?? null))], e.consequenceDomains);
    same(actualCombatAbilityUse(s, original), e.combatAbilityUse); same(summaryEntry('combatAbilityUse'), e.combatAbilityUse);
    for (const round of rounds) {
      const b = replayCaptureBoundary(`combat-round-${round.round}`), o = round.handOfOrderOutcome!;
      same(b.final.lastCombatRound, round); same(currentHandOfOrderCombatSource(b.before), o.source); same(replayHandOfOrderCombatRound(o.source, round.stance).round, round);
      expect(o.source).toMatchObject({ targetId: 'HO1-BRAM', targetAge: 45, targetSequence: 2, targetCore: 27, independentMind: true, actualBody: true, policy: 'ALL', maxActionCount: 6, thirdPartiesInArea: 0, automaticAllyImmunity: false });
      same(o.source.originals, sourceOriginals(original)); same({ door: o.source.operation.door, truth: o.source.operation.truth, effect: o.source.operation.effect }, original.balancer.life.operation);
      expect(o.playerActions).toHaveLength(round.playerCount); expect(o.enemyActions).toHaveLength(round.enemyCount); expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - sum(o.playerActions, a => a.paidCost));
      expect(o.playerMindAfter).toBe(Math.max(0, o.source.playerMind - sum(o.playerActions, a => a.mindCost) - (round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0)));
      expect(b.final.random.cursor).toBe(o.randomCursorAfter); const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      expect(actions.map(a => a.order)).toEqual(actions.map((_, i) => i)); for (const a of actions) { expect(a.randomCursorAfter).toBeGreaterThanOrEqual(a.randomCursorBefore); expect(a.elapsedSeconds).toBe(5); }
      assertOriginalContinuity(b.final, original);
    }
    same(summaryEntry('currentOriginals'), currentOriginals(s)); same(summaryEntry('encounter'), s.handOfOrder.encounter); same(s.handOfOrder.encounter.terminal, e.terminal);
    same(captureBody(s), e.final); same(migrateSliceState(s), s); same(projectSliceState(currentCapture(naturalEntry('final'))), projectSliceState(s));
    same(applySliceIntent(capturedState('beforeLast'), naturalEntry<SliceIntent>('lastIntent')), s); assertOriginalContinuity(s, original);
  }, 240_000);

  it('keeps all eight private histories immutable and projects inherited surfaces read-only', () => {
    const original = originalLivingPrefix(), s = capturedState('final');
    if (!s.handOfOrder.guidanceKnown) return;
    const before = captureValueHash(s), historical = handOfOrderInheritedView(s), view = projectSliceState(s);
    expect(historical.progression.sequence).toBe(2); expect(historical.balancer.promotionWeek).toBe(126); same(historical.progression.mastery, original.progression.mastery);
    const scan = (v: unknown): void => {
      if (!v || typeof v !== 'object') return; if (Array.isArray(v)) { v.forEach(scan); return; }
      const o = v as Record<string, unknown>; if (Array.isArray(o.actions)) for (const a of o.actions as { enabled: boolean }[]) expect(a.enabled).toBe(false);
      if ('preferredActionId' in o) expect(o.preferredActionId).toBeNull(); Object.values(o).forEach(scan);
    };
    for (const key of HAND_OF_ORDER_SOURCE_KEYS) { same(s[key], original[key]); scan(view[key]); }
    expect(view.balancer.abilities).toHaveLength(17); expect(view.balancer.acting).toBe(100); expect(captureValueHash(s)).toBe(before);
    for (const type of ['ARBITER', 'SHERIFF', 'INTERROGATOR', 'JUDGE', 'PUNISHMENT_KNIGHT', 'IMPERATIVE_MAGE', 'CHAOS_HUNTER', 'BALANCER'] as const) {
      expect(() => applySliceIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent)).toThrow(); expect(captureValueHash(s)).toBe(before);
    }
  }, 120_000);

  it('uses exact nested allowlists on all three public round entries while retaining modifier source labels', () => {
    const e = observedCapture(), original = originalLivingPrefix(); let activeRoundChecked = false;
    for (const n of e.combatRounds) {
      const b = namedBoundary(`combat-round-${n}`), raw = b.final, rawHash = captureValueHash(raw), round = raw.lastCombatRound!, o = round.handOfOrderOutcome!, view = projectSliceState(raw);
      const expected = expectedPublicHandOfOrderOutcome(o); same(projectHandOfOrderRoundOutcome(o), expected);
      const entries = [view.lastCombatRound!.handOfOrderOutcome, view.combatHistory.at(-1)!.handOfOrderOutcome];
      if (view.combat?.lastRound) { entries.push(view.combat.lastRound.handOfOrderOutcome); activeRoundChecked = true; }
      for (const entry of entries) { same(entry, expected); assertNoPrivateHandOfOrderFields(entry); }
      expect(captureValueHash(raw)).toBe(rawHash); same(raw.handOfOrder.sourceHistory, Object.fromEntries(HAND_OF_ORDER_SOURCE_KEYS.map(k => [k, original[k]])));
      // A detached invalid-input probe is only passed to the projection boundary, never reducers or persistence.
      const probe = structuredClone(raw), probeRound = probe.lastCombatRound!, probeOutcome = probeRound.handOfOrderOutcome!;
      const checked = [...probeOutcome.playerActions, ...probeOutcome.enemyActions].find(a => a.check !== null);
      if (checked) checked.check = { ...checked.check!, modifiers: [...checked.check!.modifiers, { source: '公开的实际修正标签', value: 0 }] };
      decoratePrivateProbe(probeOutcome);
      probe.combatHistory[probe.combatHistory.length - 1] = structuredClone(probeRound);
      if (probe.combat) probe.combat.lastRound = structuredClone(probeRound);
      const poisonedHash = captureValueHash(probe), projected = projectSliceState(probe), probeExpected = expectedPublicHandOfOrderOutcome(probeOutcome);
      const projectedEntries = [projected.lastCombatRound!.handOfOrderOutcome, projected.combatHistory.at(-1)!.handOfOrderOutcome];
      if (projected.combat?.lastRound) projectedEntries.push(projected.combat.lastRound.handOfOrderOutcome);
      for (const entry of projectedEntries) { same(entry, probeExpected); assertNoPrivateHandOfOrderFields(entry); }
      if (checked) expect(JSON.stringify(projectedEntries)).toContain('公开的实际修正标签'); expect(captureValueHash(probe)).toBe(poisonedHash);
    }
    if (e.combatRounds.length > 1) expect(activeRoundChecked).toBe(true);
  }, 240_000);

  it('pins four real doses, ordinary brace after failed control, a cancelled window and the actual third-round death', () => {
    const s = capturedState('final'), original = originalLivingPrefix(), h = s.handOfOrder, life = h.life;
    expect(h.bottles.map(b => [b.id, b.status, b.outcome, b.stockedWeek, b.consumedWeek])).toEqual([
      ['hand-of-order-potion-1', 'CONSUMED', 'FAILURE', 136, 147], ['hand-of-order-potion-2', 'CONSUMED', 'FAILURE', 136, 158],
      ['hand-of-order-potion-3', 'CONSUMED', 'FAILURE', 136, 168], ['hand-of-order-potion-4', 'CONSUMED', 'SUCCESS', 170, 179],
      ['hand-of-order-potion-5', 'SUPPLIER', null, 170, null], ['hand-of-order-potion-6', 'SUPPLIER', null, 170, null],
    ]);
    const request = h.acquisitionJournal.find(r => r.command.type === 'REQUEST_SUPPLY')!, received = h.acquisitionJournal.find(r => r.command.type === 'RECEIVE_SUPPLY')!;
    expect(request).toMatchObject({ week: 169, before: { cash: 190, actions: 2 }, after: { cash: 90, actions: 1 } }); expect(received.week).toBe(170); expect(received.week).toBeGreaterThan(request.week);
    expect(h.promotionWeek).toBe(179); expect(s).toMatchObject({ status: 'DEAD', revision: 802, week: 185, health: 0, mind: 88, spirituality: 100, cash: 140, actionsRemaining: 1, injuryRisk: 1,
      date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 6 }, random: { seed: SEED, cursor: 416 }, progression: { sequence: 1, acting: 100 }, ending: { kind: 'DEATH' } });
    expect(s.character.coreStats).toEqual({ physique: 31, perception: 26, will: 26, knowledge: 22 });
    expect(s.injuries).toEqual([{ id: 'arbiter-rebuild-natural:combat:1:PLAYER:800:0', severity: 'LIGHT', acquiredRevision: 800, treatedRevision: null }]);
    expect([s.progression.mastery['justiciar.s1.battlefield-division'], s.progression.mastery['justiciar.s1.aftermath-control']]).toEqual([8, 0]);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(value);
    const treatment = naturalEntry<{ paidPennies: number; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> }[]>('treatments');
    expect(treatment).toHaveLength(1); expect(treatment[0]).toMatchObject({ paidPennies: 60, before: { revision: 596, H: 68, cash: 690 }, after: { revision: 597, H: 68, cash: 630 } });
    expect(treatment[0]!.after.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 590, null], ['HEAVY', 593, 597]]);
    expect(life.cases['paired-handover'].attempts[0]).toMatchObject({ divisionTier: 'GREAT_SUCCESS', divisionOutcome: 'STOPPED', result: 'ABILITY', spiritualitySpent: 8, mindSpent: 2, appliedAbilityIds: ['justiciar.s1.battlefield-division'] });
    expect(life.cases['measured-aftermath'].attempts[0]).toMatchObject({ aftermathTier: 'FAILURE', result: 'ORDINARY', spiritualitySpent: 8, mindSpent: 4, healthLost: 2, appliedAbilityIds: [],
      impact: { mode: 'ORDINARY_BRACE', baseHealthLoss: 5, healthLoss: 2, plateWear: 15, aftermathApplied: false } });
    expect(life.cases['withdrawn-boundary'].attempts[0]).toMatchObject({ divisionTier: 'FAILURE', permissionWithdrawn: true, result: 'ORDINARY', spiritualitySpent: 8, mindSpent: 4, appliedAbilityIds: [] });
    expect(life).toMatchObject({ reflected: true, activeCase: null, annex: { supportPieces: 0, effortSpent: 9, effortLimit: 9 } });
    const rounds = s.combatHistory.slice(original.combatHistory.length);
    expect(rounds.map(r => [r.round, r.winner, r.playerCountRoll, r.enemyCountRoll, r.playerCount, r.enemyCount, r.consequenceDomain ?? null, r.consequenceRoll ?? null])).toEqual([
      [1, 'ENEMY', 98, 79, 6, 5, 'BODY', 23], [2, 'PLAYER', 28, 9, 3, 1, null, null], [3, 'ENEMY', 78, 59, 5, 4, 'BODY', 94],
    ]);
    expect(rounds[0]!.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 }); expect(rounds[2]!.consequenceWeights).toEqual({ light: 55, heavy: 30, death: 15 });
    const first = rounds[0]!.handOfOrderOutcome!, granted = first.playerActions.find(a => a.order === 0)!, resisted = first.playerActions.find(a => a.order === 8)!, failed = first.playerActions.find(a => a.order === 10)!;
    expect(granted).toMatchObject({ id: 'justiciar.s1.aftermath-control', paidCost: 8, mindCost: 2, succeeded: true, check: { roll: 41, tier: 'SUCCESS' }, windowGranted: { kind: 'AFTERMATH', castAt: 930, expiresAt: 950 }, windowsApplied: [], masteryApplied: [] });
    expect(first.enemyActions.find(a => a.order === 3)).toMatchObject({ id: 'COMPOSE', windowsCancelled: [granted.windowGranted] });
    expect(resisted).toMatchObject({ id: 'justiciar.s1.battlefield-division', paidCost: 8, mindCost: 4, check: { roll: 16, tier: 'SUCCESS' }, succeeded: false, resisted: true, windowGranted: null, masteryApplied: [] });
    expect(failed).toMatchObject({ id: 'justiciar.s1.aftermath-control', paidCost: 8, mindCost: 4, check: { roll: 85, tier: 'FAILURE' }, succeeded: false, windowGranted: null, masteryApplied: [] });
    for (const id of HAND_OF_ORDER_ABILITY_IDS) expect(actualCombatAbilityUse(s, original)[id]).toMatchObject({ actualApplications: 0, contributionChange: 0, masteryApplications: 0 });
    expect(h.encounter.supportPieces.map(p => [p.status, p.wear, p.usedRound, p.usedOrder])).toEqual([['SPENT', 1, 1, 0], ['SPENT', 1, 1, 8], ['SPENT', 1, 1, 10]]);
    expect(h.encounter.enemyCharges.map(p => [p.status, p.usedRound, p.usedOrder])).toEqual([['SPENT', 1, 9], ['HELD', null, null], ['HELD', null, null]]);
    expect(h.encounter.terminal).toEqual({ outcome: 'PLAYER_DEAD', round: 3, historyIndex: 29, enemyHealth: 100, enemyMind: 100, enemySpirituality: 71, enemyStatus: 'RESISTING', exitMetres: 0, exitSeconds: 0 });
    expect(currentPlate(s)).toMatchObject({ id: 'BA2-GUARD-PLATE', integrity: 50, location: 'ANNEX_A', acquiredWeek: 126 });
    expect(getHandOfOrderCurrentSite(s)).toMatchObject({ playerLocation: 'ANNEX_A', playerTravelMetres: 188, guideTravelMetres: 148, clockSeconds: 1110,
      guide: { location: 'OUTSIDE' }, volunteer: { location: 'OUTSIDE', alive: true, health: 100, mind: 97 } });
    expect(s.combat).toBeNull(); assertOriginalContinuity(s, original);
  }, 120_000);

  it('pins the actual endpoint honestly, including permanent player death if observed', () => {
    const e = observedCapture(), s = capturedState('final'), rounds = s.combatHistory.slice(originalLivingPrefix().combatHistory.length);
    same(captureBody(s), e.final); same(naturalEntry('strategy'), e.strategy); same(naturalEntry('provenance'), e.provenance); expect(naturalEntry('stage')).toBe(e.stage);
    expect(naturalEntry('error')).toBe(e.error); expect(naturalEntry('failurePhase')).toBe(e.failurePhase); same(naturalEntry('pendingIntent'), e.pendingIntent); assertValidSliceState(s);
    if (e.stage === STAGES[0]) {
      expect(e.error).toBeNull(); expect(s).toMatchObject({ status: 'ACTIVE', progression: { sequence: 1, acting: 100 } }); expect(s.combat).toBeNull();
      expect(s.handOfOrder.life).toMatchObject({ reflected: true, activeCase: null, annex: { effortSpent: 9 } }); expect(e.completedCases).toEqual([...HAND_OF_ORDER_CASE_IDS]);
      expect(s.handOfOrder.encounter.terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 }); expect(s.handOfOrder.encounter.terminal!.outcome).not.toBe('PLAYER_DEAD');
      expect(getHandOfOrderCurrentSite(s).playerLocation).toBe('OUTSIDE');
      expect(s.handOfOrder.life.cases['withdrawn-boundary'].attempts[0]).toMatchObject({ permissionWithdrawn: true, result: 'ORDINARY', appliedAbilityIds: [] });
    } else if (e.stage === STAGES[1]) {
      expect(s.status).toBe('ACTIVE'); expect(s.progression.sequence).toBe(2); expect(rounds).toHaveLength(0); const consumed = s.handOfOrder.bottles.filter(b => b.status === 'CONSUMED');
      expect(consumed).toHaveLength(12); expect(consumed.every(b => b.outcome === 'FAILURE' || b.outcome === 'GREAT_FAILURE')).toBe(true);
    } else if (e.stage === STAGES[2]) {
      expect(s.status).toBe('ACTIVE'); expect(s.handOfOrder.encounter.status).toBe('FIGHTING'); expect(s.handOfOrder.encounter.terminal).toBeNull(); expect(s.combat).not.toBeNull(); expect(rounds).toHaveLength(90);
    } else {
      expect(e.stage).toBe(STAGES[3]); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0); expect(projectSliceState(s).canAct).toBe(false); const hash = captureValueHash(s);
      for (const intent of [{ type: 'CONTINUE_LIFE' }, { type: 'ACTION', action: 'REST' }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }] as SliceIntent[]) { expect(() => applySliceIntent(s, intent)).toThrow(); expect(captureValueHash(s)).toBe(hash); }
    }
    expect(currentPlate(s).integrity).toBeGreaterThanOrEqual(0);
  }, 120_000);
});

/** Only the newly emitted guidance record changes. Historical capture bytes,
 * all other records and every gameplay/random field remain the original. */
function withCurrentGuidance(archived: SliceState): SliceState {
  if (!archived.handOfOrder.guidanceKnown) {
    expect(archived.revision).toBeLessThanOrEqual(601);
    expect(archived.chronicle.some(record => record.id === 'record-602-943')).toBe(false);
    return archived;
  }
  const expected = structuredClone(archived), records = expected.chronicle.filter(record => record.id === 'record-602-943');
  expect(records).toHaveLength(1);
  const record = records[0]!;
  expect({ id: record.id, week: record.week, title: record.title }).toEqual({
    id: 'record-602-943', week: 136, title: '听取秩序之手独立成品与专业准备指导',
  });
  expect(createHash('sha256').update(record.text).digest('hex')).toBe('71580ffd37c86930cd2c48ca913eef9d0cec1ba009bd0306b73615b3fe67ec4b');
  const oldGuidance = '全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
  const currentGuidance = '最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。可另付60便士、8灵性、6精神为所选同瓶准备同场当周支持，0行动，意志临时+15；仍可能失败，换瓶、退出或跨周失效，已付成本不退。';
  expect(record.text.endsWith(oldGuidance)).toBe(true);
  expect(expected.chronicle.reduce((count, row) => count + row.text.split(oldGuidance).length - 1, 0)).toBe(1);
  const latestGuidance = expected.lastResult?.id === record.id ? expected.lastResult : null;
  if (latestGuidance) same(latestGuidance, record);
  record.text = record.text.slice(0, -oldGuidance.length) + currentGuidance;
  if (latestGuidance) latestGuidance.text = record.text;
  return expected;
}


/** Validate the real fourth-dose receipt without permitting a new independent
 * original or replacing the archived successful outcome with recovery data. */
function archivedFourthDose() {
  const b = namedBoundary('consume-hand-of-order-potion-4');
  expect(b.count).toBe(740); expect(b.intent).toEqual({ type: 'HAND_OF_ORDER', command: { type: 'CONSUME', bottleId: 'hand-of-order-potion-4', confirmed: true } });
  expect(validateSlicePayload(b.intent)).toBe(true);
  for (const state of [b.before, b.final]) {
    const hash = captureValueHash(state);
    expect(validateHandOfOrderAcquisitionJournal(state)).toBe(true); expect(validateHandOfOrderJournalContinuity(state)).toBe(true);
    expect(state.handOfOrder.bottles).toHaveLength(6); expect(state.handOfOrder.bottles.every(bottle => bottle.recovery === undefined)).toBe(true);
    expect(resolveHandOfOrderOriginalsSnapshot(state.handOfOrder)).toBeNull();
    expect(projectSliceState(state).handOfOrder.actions.some(action => action.enabled && captureValueHash(action.command) === captureValueHash(b.intent.type === 'HAND_OF_ORDER' ? b.intent.command : null))).toBe(false);
    expect(() => applySliceIntent(state, b.intent)).toThrow(); expect(captureValueHash(state)).toBe(hash);
  }
  expect(b.final.revision).toBe(b.before.revision + 1); expect(b.final.runId).toBe(b.before.runId);
  same(b.final.handOfOrder.sourceHistory, b.before.handOfOrder.sourceHistory); same(b.final.handOfOrder.sourceScene, b.before.handOfOrder.sourceScene);
  same(b.final.handOfOrder.acquisitionJournal.slice(0, -1), b.before.handOfOrder.acquisitionJournal);
  const receipt = b.final.handOfOrder.acquisitionJournal.at(-1)!;
  same({ type: 'HAND_OF_ORDER', command: receipt.command }, b.intent);
  expect(receipt).toMatchObject({ revision: b.before.revision, week: b.before.week, cursorBefore: b.before.random.cursor, cursorAfter: b.final.random.cursor,
    after: { sequence: 1 }, check: { tier: 'SUCCESS' } }); same(receipt.date, b.before.date);
  return b;
}
