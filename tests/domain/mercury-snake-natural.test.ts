import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateMercurySnakeAcquisitionJournal, validateMercurySnakeJournalContinuity } from '../../src/domain/mercury-snake/index.js';
import { MERCURY_SNAKE_ABILITY_IDS, MERCURY_SNAKE_PREPARATION_IDS } from '../../src/domain/mercury-snake/types.js';
import { MERCURY_SNAKE_CASE_IDS, getMercurySnakeCurrentSite, mercurySnakeLifeMasteryGains, validateMercurySnakeLifeState } from '../../src/domain/mercury-snake/life.js';
import { validateMercurySnakeEncounterState } from '../../src/domain/mercury-snake/encounter.js';
import { currentMercurySnakeCombatSource, replayMercurySnakeCombatRound, mercurySnakeActionCount, mercurySnakeEnemyActionCount } from '../../src/domain/mercury-snake/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { MERCURY_SNAKE_CAPTURE_EVIDENCE as evidence, MERCURY_SNAKE_METADATA_FILES } from './mercury-snake-capture-evidence.js';
import { MERCURY_SNAKE_ROOT as ROOT, MERCURY_SNAKE_SOURCE as SOURCE, MERCURY_SNAKE_PRIOR as PRIOR,
  MERCURY_SNAKE_PREFIX_COUNT as PREFIX, MERCURY_SNAKE_INHERITED_COUNT as INHERITED, MERCURY_SNAKE_SEED as SEED,
  captureMetadata, observedCapture, naturalEntry, sourceEntry, summaryEntry, capturePath, captureFileHash,
  insertionOrderHash, captureValueHash, captureJsonLines, currentCapture, originalLivingPrefix, capturedState, capturedSnapshot,
  replayCaptureBoundary, captureBody, capturePublicBody, sourceOriginals, currentOriginals, actualLifeAbilityUse, actualCombatAbilityUse,
  assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same } from './mercury-snake-capture-helper.js';

const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
interface FileEvidence { bytes: number; sha256: string }
interface Integrity { producerSha256: string; freezeSha256: string; frozenFiles: ({ file: string } & FileEvidence)[];
  metadata: Record<string, FileEvidence>; files: Record<string, FileEvidence> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }
interface Ledger { step: number; sourcePrefix: boolean; boundaryKey: string | null; intent: SliceIntent;
  before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> }
interface PublicRow { step: number; revision: number; command: SliceIntent; control: { enabled?: boolean; kind?: string; stance?: string; winnerPolicy?: string };
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; before: ReturnType<typeof capturePublicBody>; after: ReturnType<typeof capturePublicBody> }

it('requires real coordinator-frozen stage204 observations rather than accepting a pending natural suite', () => { observedCapture(); });

describe('Mercury Snake complete original703 campaign and immutable raw179 source', () => {
  it('pins both prior campaigns, raw versions and all703 commands before explicit CURRENT migration', async () => {
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256); expect(await captureFileHash(PRIOR)).toBe(evidence.priorSha256);
    const commands = sourceEntry<SliceIntent[]>('commands'), prior = readObjectEntry<SliceIntent[]>(PRIOR, 'commands');
    expect(commands).toHaveLength(PREFIX); expect(PREFIX).toBe(703); expect(prior).toHaveLength(INHERITED); expect(INHERITED).toBe(551);
    expect(sourceEntry('prefixCount')).toBe(INHERITED); same(commands.slice(0, INHERITED), prior); expect(insertionOrderHash(commands)).toBe(evidence.prefixSha256);
    for (const key of ['initial', 'final']) {
      const raw = sourceEntry<SliceState>(key), rawHash = captureValueHash(raw);
      expect([raw.schemaVersion, raw.contentVersion]).toEqual([179, 'fate-prophet-v179']);
      const current = currentCapture(raw);
      for (const name of Object.keys(raw) as (keyof SliceState)[]) if (name !== 'schemaVersion' && name !== 'contentVersion') same(current[name], raw[name]);
      expect(captureValueHash(raw)).toBe(rawHash); expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    }
    const original = originalLivingPrefix(); same(captureBody(original), observedCapture().originalBody);
    same(original.character, observedCapture().originalCharacter); same(original.progression.mastery, observedCapture().originalMastery);
    expect([original.revision, original.week, original.health, original.mind, original.spirituality, original.cash, original.actionsRemaining]).toEqual([704, 177, 90, 95, 119, 1060, 2]);
    expect(original.status).toBe('ACTIVE'); expect(original.random).toEqual({ seed: SEED, cursor: 269 });
    expect(Object.keys(original.progression.mastery)).toHaveLength(17); expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(6);
    expect(original.injuries).toEqual([{ id: 'monster-rebuild-natural:combat:2:PLAYER:702:0', severity: 'LIGHT', acquiredRevision: 702, treatedRevision: null }]);
    expect(original.fateProphet.promotionWeek).toBe(166); expect(original.progression.promotionWeek).toBe(6);
    expect(original.winner.luck).toEqual({ stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
    assertOriginalContinuity(original, original);
  }, 120_000);
});

describe.skipIf(evidence.observed === null)('Mercury Snake literal original-seed natural capture', () => {
  it('pins all154 immutable members,773058564 bytes, producer, freeze inventory and exact raw formats', async () => {
    const expected = observedCapture(), { boundaries, steps, snapshots } = captureMetadata();
    expect(expected.files).toBe(154); expect(expected.bytes).toBe(773058564);
    expect(expected.metadataHashes['natural.json']).toBe('6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574');
    expect(await captureFileHash('scripts/play/mercury-snake-stage.mjs')).toBe(expected.producerSha256);
    expect(Object.keys(expected.metadataHashes).sort()).toEqual([...MERCURY_SNAKE_METADATA_FILES].sort());
    for (const [filename, hash] of Object.entries(expected.metadataHashes)) {
      const path = `${ROOT}/${filename}`; expect(realpathSync(path)).toBe(resolve(path)); expect(await captureFileHash(path)).toBe(hash);
    }
    const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as Integrity;
    expect(integrity.producerSha256).toBe(expected.producerSha256); expect(integrity.freezeSha256).toBe(expected.freezeSha256);
    expect(insertionOrderHash(integrity.frozenFiles)).toBe(expected.freezeSha256);
    const members = [...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].sort();
    same(Object.keys(integrity.files).sort(), members); same(readdirSync(ROOT).sort(), [...members, ...MERCURY_SNAKE_METADATA_FILES].sort());
    expect(members.length + MERCURY_SNAKE_METADATA_FILES.length).toBe(expected.files);
    expect(sum(readdirSync(ROOT), file => statSync(`${ROOT}/${file}`).size)).toBe(expected.bytes);
    for (const [filename, pin] of Object.entries({ ...integrity.metadata, ...integrity.files })) {
      const path = `${ROOT}/${filename}`; expect(realpathSync(path)).toBe(resolve(path)); expect(statSync(path).size).toBe(pin.bytes);
      expect(await captureFileHash(path)).toBe(pin.sha256);
    }
    // Historical raw literals are independent of the current migration contract.
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) {
      const raw = naturalEntry<SliceState>(key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([201, 'mercury-snake-v201']);
    }
    for (const filename of new Set(Object.values(snapshots))) {
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(201); expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('mercury-snake-v201');
    }
    same(steps, expected.boundarySteps); same(Object.keys(snapshots), expected.snapshots);
    const prefix = capturePath('source-prefix.json');
    expect(readObjectEntry(prefix, 'source')).toBe(SOURCE); expect(readObjectEntry(prefix, 'sourceSha256')).toBe(evidence.sourceSha256);
    expect(readObjectEntry(prefix, 'sourceRoot')).toBe('final'); expect(readObjectEntry(prefix, 'prefixCount')).toBe(PREFIX);
    expect(readObjectEntry(prefix, 'inheritedDirectedPrefix')).toBe(false); expect(readObjectEntry(prefix, 'rawCommandsSha256')).toBe(evidence.prefixSha256);
    same(readObjectEntry(prefix, 'rawInitial'), sourceEntry('initial')); same(readObjectEntry(prefix, 'rawFinal'), sourceEntry('final'));
    same(readObjectEntry(prefix, 'commands'), sourceEntry('commands'));
    // This recorded digest describes the producer's raw201 migration, not a future CURRENT migration.
    expect(readObjectEntry(prefix, 'migratedWholeStateSha256')).toBe(captureValueHash(naturalEntry('prefixFinal')));
    same(capturedState('prefixFinal'), originalLivingPrefix()); same(capturedState('initial'), currentCapture(sourceEntry('initial')));
  }, 240_000);

  it('replays all841 frozen commands from actual creation and original seed with no output, reroll or state replacement', async () => {
    const expected = observedCapture(), { commands, boundaries, steps, snapshots } = captureMetadata();
    const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as Transition[];
    expect(commands).toHaveLength(841); same(commands.slice(0, PREFIX), sourceEntry('commands'));
    expect(naturalEntry('seed')).toBe(SEED); expect(naturalEntry('prefixVerified')).toBe(true); expect(naturalEntry('prefixCount')).toBe(PREFIX); expect(naturalEntry('inheritedPrefixCount')).toBe(INHERITED);
    expect(Object.keys(boundaries)).toHaveLength(182); expect(transitions).toHaveLength(139); expect(transitions).toHaveLength(commands.length - PREFIX + 1);
    same(Object.keys(steps), Object.keys(boundaries)); same([...new Set(Object.values(boundaries))], transitions.map(row => row.file));
    const byStep = new Map(transitions.map(row => [row.commandIndex, row])), firstNames = new Map<number, string>();
    for (const [index, row] of transitions.entries()) {
      expect([row.commandIndex, row.beforeRevision, row.afterRevision]).toEqual([PREFIX + index, PREFIX + index, PREFIX + index + 1]);
      expect(boundaries[row.key]).toBe(row.file); expect(steps[row.key]).toBe(row.commandIndex);
    }
    for (const [name, file] of Object.entries(boundaries)) {
      const step = steps[name]!, row = byStep.get(step); expect(row, name).toBeDefined(); expect(file).toBe(row!.file);
      if (!firstNames.has(step)) { firstNames.set(step, name); expect(name).toBe(row!.key); }
    }
    expect(Object.keys(boundaries).length - firstNames.size).toBe(43);
    const original = originalLivingPrefix();
    let state = createSliceRun(original.runId, sourceEntry<Parameters<typeof createSliceRun>[1]>('creation'), SEED), count = 0;
    same(state, capturedState('initial'));
    const publicRows = captureJsonLines<PublicRow>('public.jsonl'), stateHashes = new Map<number, string>();
    try {
      for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
        expect(row.step).toBe(++count); expect(row.sourcePrefix).toBe(count <= PREFIX); same(row.intent, commands[count - 1]);
        expect(validateSlicePayload(row.intent)).toBe(true); same(captureBody(state), row.before);
        const before = state, transition = byStep.get(count);
        let publicRow: PublicRow | null = null;
        if (count > PREFIX) {
          expect(row.boundaryKey).toBe(transition!.key);
          assertPublicCaptureControl(before, row.intent);
          const next = await publicRows.next(); expect(next.done).toBe(false); publicRow = next.value!;
          expect(publicRow.step).toBe(count); expect(publicRow.revision).toBe(before.revision); same(publicRow.command, row.intent);
          same(publicRow.randomBefore, before.random); same(publicRow.before, capturePublicBody(before));
          if (row.intent.type === 'COMBAT_ROUND') expect(publicRow.control).toMatchObject({ kind: 'COMBAT_ROUND', stance: 'CONTROL', winnerPolicy: 'HOLD' });
          else expect(publicRow.control.enabled).toBe(true);
        }
        state = applySliceIntent(before, row.intent);
        expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe(SEED); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
        same(captureBody(state), row.after);
        if (publicRow) { same(publicRow.after, capturePublicBody(state)); same(publicRow.randomAfter, state.random); }
        if (count === PREFIX) same(state, original);
        if (transition) {
          const path = capturePath(transition.file); expect(readObjectEntry(path, 'commandCount')).toBe(count); same(readObjectEntry(path, 'lastIntent'), row.intent);
          // Only two live reducer states plus one raw root at a time; retain hashes only.
          same(before, currentCapture(readObjectEntry(path, 'beforeLast'))); same(state, currentCapture(readObjectEntry(path, 'final')));
          stateHashes.set(state.revision, captureValueHash(state));
        }
      }
      expect((await publicRows.next()).done).toBe(true);
    } finally { await publicRows.return(undefined); }
    expect(count).toBe(expected.commands); expect(state.revision).toBe(842); same(state, capturedState('final'));
    same(captureBody(state), expected.final); assertValidSliceState(state); assertOriginalContinuity(state, original);
    for (const filename of new Set(Object.values(snapshots))) {
      const saved = currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
      expect(captureValueHash(saved), filename).toBe(stateHashes.get(saved.revision));
    }
    same(naturalEntry('creation'), sourceEntry('creation')); same(naturalEntry('strategy'), expected.strategy); same(naturalEntry('provenance'), expected.provenance);
    expect(naturalEntry('stage')).toBe('NATURAL703_PREFIX_PUBLIC_MERCURY_SNAKE_CONTINUATION'); expect(naturalEntry('error')).toBeNull();
    expect(naturalEntry('failurePhase')).toBe('IDLE'); expect(naturalEntry('pendingIntent')).toBeNull();
    // The long703-command inherited campaign is intentionally a per-case600s budget.
    // No global timeout changes, producer invocation, source edits or output writes.
  }, 600_000);

  it('preserves the actual paid guidance, ten labour steps, two independent bottles and failure before promotion', () => {
    const original = originalLivingPrefix(), final = capturedState('final'), stage = final.mercurySnake;
    same(naturalEntry('treatments'), []); same(capturedSnapshot('departure'), original);
    const guidance = replayCaptureBoundary('paid500-guidance-freezes-eight-roots-and-original-luck'), receipt = guidance.final.mercurySnake.acquisitionJournal.at(-1)!;
    expect([receipt.before.cash - receipt.after.cash, receipt.before.actions - receipt.after.actions]).toEqual([500, 1]);
    same(guidance.final.mercurySnake.sourceScene!.originals, sourceOriginals(original));
    expect(stage.preparations.map(row => row.taskId)).toEqual([...MERCURY_SNAKE_PREPARATION_IDS]);
    expect(stage.bottles.map(b => [b.id, b.status, b.outcome, b.consumedWeek])).toEqual([
      ['mercury-snake-potion-1', 'CONSUMED', 'FAILURE', 185], ['mercury-snake-potion-2', 'CONSUMED', 'SUCCESS', 196], ['mercury-snake-potion-3', 'SUPPLIER', null, null],
    ]);
    expect(new Set(stage.bottles.map(row => row.id)).size).toBe(3); same(stage.bottles, summaryEntry('bottles'));
    for (const bottle of stage.bottles.filter(row => row.status === 'CONSUMED')) {
      const bought = replayCaptureBoundary(`paid1200-${bottle.id}`), prepared = replayCaptureBoundary(`paid180-current-week-prepare-${bottle.id}`), dose = replayCaptureBoundary(`consume-${bottle.id}`);
      const labour = stage.acquisitionJournal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id);
      expect(labour).toHaveLength(5); for (const row of labour) expect([row.before.actions - row.after.actions, row.before.cash - row.after.cash]).toEqual([1, 0]);
      expect(bought.final.mercurySnake.acquisitionJournal.at(-1)!.before.cash - bought.final.mercurySnake.acquisitionJournal.at(-1)!.after.cash).toBe(1200);
      expect(prepared.final.mercurySnake.acquisitionJournal.at(-1)!.before.cash - prepared.final.mercurySnake.acquisitionJournal.at(-1)!.after.cash).toBe(180);
      expect(dose.before.week - original.fateProphet.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.mercurySnake.preparedWeek).toBe(dose.before.week); expect(dose.final.mercurySnake.preparedWeek).toBeNull();
      expect(dose.final.random.cursor - dose.before.random.cursor).toBe(1); same(dose.before.injuries, dose.final.injuries); same(currentOriginals(dose.before), currentOriginals(dose.final));
      const paid = dose.final.mercurySnake.acquisitionJournal.at(-1)!;
      expect(paid.after.actions).toBe(paid.before.actions); expect(paid.after.spirituality).toBe(paid.before.spirituality);
      const costs = bottle.outcome === 'FAILURE' ? [15, 25, 30] : [0, 15, 0];
      expect(paid.after.health).toBe(Math.max(1, paid.before.health - costs[0]!)); expect(paid.after.mind).toBe(Math.max(1, paid.before.mind - costs[1]!));
      expect(paid.after.pollution).toBe(Math.min(100, paid.before.pollution + costs[2]!));
      for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(dose.final.progression.mastery[id]).toBe(mastery);
    }
    expect(stage.bottles[2]).toMatchObject({ stockedWeek: 177, labourSteps: 0, acquiredWeek: null, preparationWeek: null });
    expect(stage.acquisitionJournal.some(row => row.command.type === 'REQUEST_SUPPLY' || row.command.type === 'RECEIVE_SUPPLY')).toBe(false);
    expect(stage.promotionWeek).toBe(196); expect(stage.fateProphetActingAtPromotion).toBe(100);
    const promoted = capturedSnapshot('promoted'); expect(MERCURY_SNAKE_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    expect(promoted.injuries).toEqual([]); expect(validateMercurySnakeAcquisitionJournal(final)).toBe(true); expect(validateMercurySnakeJournalContinuity(final)).toBe(true);
  }, 240_000);

  it('retains all three honest life results, real fees, original cart and parcel, failed casts and withdrawn permission', () => {
    const final = capturedState('final'), original = originalLivingPrefix(), life = final.mercurySnake.life;
    same(actualLifeAbilityUse(final), observedCapture().lifeAbilityUse); same(summaryEntry('lifeAbilityUse'), actualLifeAbilityUse(final)); same(summaryEntry('life'), life);
    expect(MERCURY_SNAKE_CASE_IDS.filter(id => life.cases[id].status === 'RESOLVED')).toEqual([...MERCURY_SNAKE_CASE_IDS]);
    expect(life.pieces.map(p => [p.id, p.initialCharges, p.charges, p.wear, p.returnUses, p.anchorUses])).toEqual([
      ['MS1-PIECE-1', 1, 0, 1, 1, 0], ['MS1-PIECE-2', 2, 2, 0, 0, 0], ['MS1-PIECE-3', 1, 1, 0, 0, 0],
    ]);
    expect(life.cases['cart-return'].attempts[0]).toMatchObject({ restartTier: 'SUCCESS', anchorTier: null, restartApplied: true, anchorApplied: false, returnKind: 'RESTART', windowEnd: 'APPLIED' });
    expect(life.cases['maintained-contact'].attempts[0]).toMatchObject({ restartTier: 'FAILURE', anchorTier: 'GREAT_FAILURE', restartApplied: false, anchorApplied: false, returnKind: 'ORDINARY', windowEnd: 'FAILED' });
    expect(life.cases['withdrawn-contact'].attempts[0]).toMatchObject({ restartTier: null, anchorTier: 'SUCCESS', restartApplied: false, anchorApplied: false, withdrawn: true, returnKind: 'ORDINARY', windowEnd: 'WITHDRAWN' });
    for (const id of MERCURY_SNAKE_CASE_IDS) {
      const c = life.cases[id], attempt = c.attempts[0]!, piece = life.pieces.find(row => row.caseId === id)!;
      expect(c.attempts).toHaveLength(1); expect([c.status, c.returned, c.contactOpen]).toEqual(['RESOLVED', true, false]);
      expect(attempt).toMatchObject({ closed: true, returned: true, verified: true, penniesSpent: 20, readCart: true, readOriginal: true, piecePlaced: true, captured: true, released: true, objectsReturned: true, volunteerMindSpent: 1 });
      expect(piece).toMatchObject({ paidPennies: 20, quantity: 1, status: 'RETURNED', location: 'RETURNED' });
      expect(piece.initialCharges - piece.charges).toBe(piece.wear); expect(piece.wear).toBe(attempt.appliedAbilityIds.length);
      const prepared = replayCaptureBoundary(`${id}-prepare`), prepareReceipt = prepared.final.mercurySnake.life.journal.at(-1)!;
      expect(prepareReceipt.paid).toEqual({ actions: 1, pennies: 20, spirituality: 0, mind: 0, volunteerMind: 0, pieceCharges: 0, luck: 0 });
      const release = replayCaptureBoundary(`${id}-release_cart`), released = release.final.mercurySnake.life.journal.at(-1)!;
      expect(released.moves).toEqual([{ actorId: 'CW3-CART', from: 'A', to: 'B', mode: 'ROLL', metres: 4, seconds: 4, itemIds: ['CW3-CART', 'CW3-PARCEL'] }]);
      expect(released.siteAfter.parcel.location).toBe('CW3-CART'); expect(released.siteAfter.cart.releases).toBe(released.siteBefore.cart.releases + 1);
      const report = replayCaptureBoundary(`${id}-honest-report`);
      expect(report.before.mercurySnake.life.cases[id].status).toBe('EXAMINED');
      for (const ability of MERCURY_SNAKE_ABILITY_IDS) expect(report.final.progression.mastery[ability]! - report.before.progression.mastery[ability]!).toBe(attempt.appliedAbilityIds.includes(ability) ? 8 : 0);
      expect(report.final.progression.acting - report.before.progression.acting).toBe(25);
      expect(life.journal.filter(row => row.command.type === 'REPORT' && row.command.caseId === id)).toHaveLength(1);
    }
    for (const row of life.journal) {
      expect(row.siteAfter.clockSeconds - row.siteBefore.clockSeconds).toBe(row.elapsedSeconds);
      expect(row.siteAfter.playerTravelMetres - row.siteBefore.playerTravelMetres).toBe(sum(row.moves.filter(move => move.actorId === 'PLAYER'), move => move.metres));
      same(row.operationBefore, row.operationAfter); same(row.before.luck, row.after.luck); expect(row.paid.luck).toBe(0);
      for (const key of ['disc', 'pouch', 'tags', 'record'] as const) same(row.siteBefore[key], row.siteAfter[key]);
      if (row.command.type === 'LOCAL_RESTART' || row.command.type === 'MOMENT_ANCHOR') {
        expect(row.check).not.toBeNull(); expect(row.paid.spirituality).toBe(8); expect(row.paid.mind).toBe(['SUCCESS', 'GREAT_SUCCESS'].includes(row.check!.tier) ? 2 : 4);
        expect(row.before.spirituality - row.after.spirituality).toBe(8); expect(row.before.mind - row.after.mind).toBe(row.paid.mind);
        same(row.before.mastery, row.after.mastery); expect(row.elapsedSeconds).toBe(1);
      }
      if (row.paid.volunteerMind) { expect(row.command.type).toBe('READ_ORIGINAL'); expect(row.paid.volunteerMind).toBe(1); }
    }
    const success = replayCaptureBoundary('cart-return-local_restart'), applied = success.final.mercurySnake.life.journal.at(-1)!;
    expect(applied.moves).toEqual([{ actorId: 'CW3-CART', from: 'B', to: 'A', mode: 'RESTART', metres: 4, seconds: 1, itemIds: ['CW3-CART', 'CW3-PARCEL'] }]);
    expect(applied.paid.pieceCharges).toBe(1); expect(applied.before.health).toBe(applied.after.health); same(applied.before.injuries, applied.after.injuries);
    const anchor = replayCaptureBoundary('withdrawn-contact-moment_anchor'); expect(anchor.final.mercurySnake.life.pending!.expiresAt - anchor.final.mercurySnake.life.pending!.createdAt).toBe(20);
    const withdrawal = replayCaptureBoundary('withdrawn-contact-withdraw_consent-ability');
    expect(withdrawal.final.mercurySnake.life.pending).toBeNull(); expect(withdrawal.final.mercurySnake.life.captured?.valid).toBe(false);
    expect(withdrawal.final.mercurySnake.life.cases['withdrawn-contact'].permission.ABILITY).toBe('WITHDRAWN');
    same(withdrawal.before.random, withdrawal.final.random); same(withdrawal.before.progression.mastery, withdrawal.final.progression.mastery);
    same(withdrawal.before.mercurySnake.life.pieces, withdrawal.final.mercurySnake.life.pieces);
    expect(life.volunteerMindSpent).toBe(3); expect(life.site.volunteer.mind).toBe(97); expect(life.site.volunteer.health).toBe(100);
    expect(life.site.cart.releases).toBe(original.chaosWalker.life.cart.releases + 3); expect(life.site.cart.returns).toBe(original.chaosWalker.life.cart.returns + 3);
    expect(life.site.parcel).toEqual(original.chaosWalker.life.parcel); expect(life.pending).toBeNull(); expect(life.captured?.valid).toBe(false);
    expect(mercurySnakeLifeMasteryGains(final)).toEqual({ 'wheel.s1.local-restart': 8, 'wheel.s1.moment-anchor': 0 });
    expect(validateMercurySnakeLifeState(final)).toBe(true); assertOriginalContinuity(final, original);
  }, 240_000);

  it('replays both actual battle rounds with original positions, finite plates and one25-point restart application', () => {
    const original = originalLivingPrefix(), final = capturedState('final'), rounds = final.combatHistory.slice(original.combatHistory.length);
    expect(rounds.map(row => row.round)).toEqual([1, 2]); same(rounds, summaryEntry('rounds'));
    same(actualCombatAbilityUse(final, original), observedCapture().combatAbilityUse); same(summaryEntry('combatAbilityUse'), actualCombatAbilityUse(final, original));
    expect(rounds.map(row => row.mercurySnakeOutcome!.source.enemyDistanceMetres)).toEqual([2, 3]);
    const prepared = replayCaptureBoundary('paid30-independent-three-charge-combat-piece'), preparation = prepared.final.mercurySnake.encounter.preparation!;
    expect([preparation.pricePaid, preparation.actionsPaid, preparation.before.cash - preparation.after.cash, preparation.before.actions - preparation.after.actions]).toEqual([30, 1, 30, 1]);
    expect(prepared.final.mercurySnake.encounter.piece).toMatchObject({ id: 'MS1-COMBAT-PIECE', initialCharges: 3, charges: 3, wear: 0, paidPennies: 30 });
    const approach = replayCaptureBoundary('original-adults-actually-leave-player-walks-to-new-yard'), move = approach.final.mercurySnake.encounter.journal.at(-1)!;
    expect([move.siteBefore.guide.location, move.siteBefore.volunteer.location]).toEqual(['A', 'A']);
    expect([move.siteAfter.guide.location, move.siteAfter.volunteer.location, move.siteAfter.playerLocation]).toEqual(['OUTSIDE', 'OUTSIDE', 'YARD']);
    expect(move.siteAfter.clockSeconds - move.siteBefore.clockSeconds).toBe(20); expect(move.siteAfter.playerTravelMetres - move.siteBefore.playerTravelMetres).toBe(4);
    for (const key of ['cart', 'parcel', 'disc', 'record', 'pouch', 'tags'] as const) same(move.siteBefore[key], move.siteAfter[key]);
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.mercurySnakeOutcome!;
      const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      same(save.final.lastCombatRound, round); same(currentMercurySnakeCombatSource(save.before), o.source);
      same(replayMercurySnakeCombatRound(o.source, round.stance, o.winnerPolicy).round, round);
      expect(o.source).toMatchObject({ targetId: 'MS1-OSWIN', targetName: '奥斯温·贝尔', targetAge: 44, actualBody: true,
        independentMind: true, enemyWeapon: 'MS1-OSWIN-ROD', maxActionCount: 6, ordinaryExit: 'OPEN', thirdPartiesInArea: 0, automaticAllyImmunity: false, policy: 'ALL' });
      same(o.source.site, save.before.mercurySnake.encounter.currentSite); same(o.source.operation, original.fateProphet.life.operation);
      same(o.source.originals, sourceOriginals(original)); same(o.source.luck, original.winner.luck);
      expect([o.source.site.guide.location, o.source.site.volunteer.location]).toEqual(['OUTSIDE', 'OUTSIDE']);
      expect(round.playerCount).toBe(mercurySnakeActionCount(round.playerCountRoll!)); expect(round.enemyCount).toBe(mercurySnakeEnemyActionCount(round.enemyCountRoll!));
      expect(o.playerActions).toHaveLength(round.playerCount); expect(o.enemyActions).toHaveLength(round.enemyCount);
      expect(actions.map(a => a.order)).toEqual(Array.from({ length: actions.length }, (_, index) => index));
      expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - sum(o.playerActions, a => a.paidCost));
      expect(o.playerMindAfter).toBe(o.source.playerMind - sum(o.playerActions, a => a.mindCost));
      expect(o.enemySpirituality).toBe(o.source.body.enemySpirituality - sum(o.enemyActions, a => a.paidCost));
      expect(o.piece!.charges).toBe(o.source.body.piece!.charges - sum(actions, a => a.pieceChargePaid));
      expect(o.piece!.wear).toBe(o.source.body.piece!.wear + sum(actions, a => a.pieceWearPaid));
      for (const plate of o.source.body.plates) {
        const used = o.enemyActions.find(a => a.receipt?.plateId === plate.id), after = o.plates.find(p => p.id === plate.id)!;
        if (used) { expect(plate.status).toBe('HELD'); expect(after).toEqual({ ...plate, status: 'SPENT', usedRound: round.round, usedOrder: used.order }); expect(used.paidCost).toBe(7); }
        else same(after, plate);
      }
      let clock = o.source.site.clockSeconds, position = o.source.body.playerLocalMetres;
      for (const action of actions) {
        expect(action.atSeconds).toBe(clock); expect(action.elapsedSeconds).toBe(5); clock += action.elapsedSeconds;
        expect(action.playerPositionBefore).toBe(position); position = action.playerPositionAfter;
        expect(action.randomCursorAfter).toBeGreaterThanOrEqual(action.randomCursorBefore); expect(action.luckCost).toBe(0); same(action.luckAfter, original.winner.luck);
        expect(action.pieceWearPaid).toBe(action.pieceChargePaid);
        if (action.mode === 'BODY') expect(action.travelMetres).toBe(2 * (action.playerPositionBefore === 0 ? 2 : 3));
        if (action.actor === 'ENEMY' && action.mode === 'BODY') {
          expect(action.receipt).toMatchObject({ targetId: 'MS1-OSWIN', power: 'BODY_STRIKE', kind: 'BODY', visible: true, unsettled: true });
          expect(action.impulseMetres).toBe(1); expect(action.selfGain + sum(action.windowsApplied, w => w.amount)).toBe(25);
          expect(action.playerPositionAfter).toBe(action.returnedMetres ? action.playerPositionBefore : 1 - action.playerPositionBefore);
        }
        if (action.attackKind === 'MENTAL') { expect(action.impulseMetres).toBe(0); expect(action.returnedMetres).toBe(0); expect(action.windowsApplied).toEqual([]); }
        for (const used of action.windowsApplied) {
          const cast = actions.find(a => a.order === used.order && used.round === round.round);
          expect(cast?.windowGranted?.kind).toBe(used.kind); expect(action.actor).toBe('ENEMY'); expect(action.attackKind).toBe('BODY');
          expect(action.atSeconds).toBeLessThan(cast!.windowGranted!.expiresAt); expect(used).toMatchObject({ kind: 'RESTART', amount: 25 });
          expect(cast!.windowGranted!.relation.localMetres).toBe(action.playerPositionBefore);
          expect(action.returnedMetres).toBe(1); expect(action.pieceChargePaid).toBe(1); expect(action.masteryApplied).toEqual(['wheel.s1.local-restart']);
        }
        if (action.windowGranted) {
          const window = action.windowGranted; expect(window.expiresAt - window.castAt).toBe(window.kind === 'RESTART' ? 10 : 20);
          expect(window.relation.localMetres).toBe(action.playerPositionBefore); expect(Object.keys(window.relation).sort()).toEqual(['conditionVersion', 'living', 'localMetres', 'observedAt', 'playerId', 'position']);
        }
      }
      expect(o.playerLocalMetres).toBe(position);
      expect(o.playerTravelMetres - o.source.body.playerTravelMetres).toBe(sum(o.playerActions, a => a.travelMetres) + sum(actions, a => a.impulseMetres + a.returnedMetres));
      expect(o.enemyTravelMetres - o.source.body.enemyTravelMetres).toBe(sum(o.enemyActions, a => a.travelMetres));
      expect(o.siteAfter.playerTravelMetres - o.source.site.playerTravelMetres).toBe(o.playerTravelMetres - o.source.body.playerTravelMetres);
      for (const action of o.playerActions.filter(a => MERCURY_SNAKE_ABILITY_IDS.some(id => id === a.id))) {
        expect(action.attempted).toBe(true); expect(action.paidCost).toBe(8); expect(action.mindCost).toBe(action.succeeded ? 2 : 4);
        expect(action.pieceChargePaid).toBe(0); expect(action.masteryApplied).toEqual([]);
      }
      for (const action of o.enemyActions.filter(a => a.mode === 'MIND_SPIKE')) {
        expect(action).toMatchObject({ attackKind: 'MENTAL', paidCost: 7, selfGain: 75, threatens: false }); expect(action.receipt?.kind).toBe('MENTAL');
      }
      expect(round.consequenceDomain).toBe('BODY'); expect(round.consequenceWeights).not.toBeNull(); expect(round.consequenceRoll).toBeGreaterThanOrEqual(1); expect(round.consequenceRoll).toBeLessThanOrEqual(100);
      expect(o.elapsedSeconds).toBe(60); expect(o.siteAfter.clockSeconds - o.source.site.clockSeconds).toBe(60);
      expect(save.final.random.cursor).toBe(o.randomCursorAfter); expect(save.final.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
      same(save.final.mercurySnake.encounter.piece, o.piece); same(save.final.mercurySnake.encounter.plates, o.plates);
    }
    const second = rounds[1]!.mercurySnakeOutcome!, applied = second.enemyActions.find(a => a.returnedMetres === 1)!;
    expect([applied.playerPositionBefore, applied.playerPositionAfter, applied.impulseMetres, applied.returnedMetres, applied.travelMetres]).toEqual([1, 1, 1, 1, 6]);
    const cancelled = second.enemyActions.find(a => a.windowsCancelled.some(w => w.kind === 'ANCHOR'))!;
    expect([cancelled.playerPositionBefore, cancelled.playerPositionAfter, cancelled.pieceChargePaid]).toEqual([1, 0, 0]);
    expect(second.expiredWindows.map(w => [w.kind, w.relation.localMetres])).toEqual([['RESTART', 0]]);
    expect(final.mercurySnake.encounter.piece).toMatchObject({ charges: 2, wear: 1 }); expect(final.mercurySnake.encounter.plates.map(p => p.status)).toEqual(['SPENT', 'SPENT', 'SPENT']);
    expect([final.mercurySnake.encounter.restartApplications, final.mercurySnake.encounter.anchorApplications]).toEqual([1, 0]);
    expect(validateMercurySnakeEncounterState(final)).toBe(true); assertOriginalContinuity(final, original);
  }, 240_000);

  it('reopens the actual living terminal with a new LIGHT injury, final settlement, old Rowan and unchanged zero luck', () => {
    const expected = observedCapture(), final = capturedState('final'), original = originalLivingPrefix(), before = capturedState('beforeLast');
    const last = naturalEntry<SliceIntent>('lastIntent'); same(last, captureMetadata().commands.at(-1)); same(applySliceIntent(before, last), final);
    const reopened = currentCapture(naturalEntry('final')); assertValidSliceState(reopened); same(reopened, final); same(migrateSliceState(reopened), final);
    same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(final), expected.final);
    expect([final.status, final.week, final.health, final.mind, final.spirituality, final.cash, final.actionsRemaining]).toEqual(['ACTIVE', 202, 90, 88, 86, 20, 3]);
    expect(final.injuries).toEqual([{ id: 'monster-rebuild-natural:combat:1:PLAYER:841:0', severity: 'LIGHT', acquiredRevision: 841, treatedRevision: null }]);
    expect(final.injuries[0]!.id).not.toBe(original.injuries[0]!.id); expect(final.random).toEqual({ seed: SEED, cursor: 306 });
    expect(MERCURY_SNAKE_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([16, 0]);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id]).toBe(mastery);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(6);
    const terminal = final.mercurySnake.encounter.terminal!, site = getMercurySnakeCurrentSite(final);
    same(terminal, expected.terminal); expect(terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 2, historyIndex: 18,
      enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 95, windowWaitSeconds: 0, exitMetres: 4, exitSeconds: 4 });
    const outcome = final.combatHistory[terminal.historyIndex]!.mercurySnakeOutcome!;
    expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + terminal.exitMetres);
    expect(site.clockSeconds).toBe(outcome.siteAfter.clockSeconds + terminal.windowWaitSeconds + terminal.exitSeconds);
    expect([site.playerLocation, site.guide.location, site.volunteer.location]).toEqual(['START', 'OUTSIDE', 'OUTSIDE']);
    expect([site.playerTravelMetres, site.clockSeconds, site.volunteer.mind]).toEqual([212, 1008, 97]);
    expect(final.combat).toBeNull(); expect(projectSliceState(final).canAct).toBe(true);
    expect(before.week).toBe(201); expect(before.actionsRemaining).toBe(0); expect(final.cash).toBe(before.cash - 30);
    same(capturedSnapshot('combatTerminal'), final); same(capturedSnapshot('beforeEncounter'), capturedSnapshot('practiced'));
    expect(final.mercurySnake.luck).toEqual({ stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
    assertOriginalContinuity(reopened, original);
  }, 120_000);
});
