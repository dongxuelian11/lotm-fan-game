import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { natureWalkerInheritedView, validateNatureWalkerAcquisitionJournal, validateNatureWalkerJournalContinuity } from '../../src/domain/nature-walker/index.js';
import { NATURE_WALKER_SOURCE_KEYS, NATURE_WALKER_ABILITY_IDS } from '../../src/domain/nature-walker/types.js';
import { NATURE_WALKER_CASE_IDS, getNatureWalkerCurrentSite } from '../../src/domain/nature-walker/life.js';
import { currentNatureWalkerCombatSource, projectNatureWalkerRoundOutcome, replayNatureWalkerCombatRound } from '../../src/domain/nature-walker/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { currentNatureWalkerReplayExpectation, currentNatureWalkerPublicReplayExpectation,
  NATURE_WALKER_CAPTURE_GUIDE_REVISION } from '../helpers/nature-walker-current-replay.js';
import { NATURE_WALKER_CAPTURE_EVIDENCE as evidence, NATURE_WALKER_METADATA_FILES as METADATA, NATURE_WALKER_CAPTURE_STAGES as STAGES } from './nature-walker-capture-evidence.js';
import { NATURE_WALKER_ROOT as ROOT, NATURE_WALKER_SOURCE as SOURCE, NATURE_WALKER_PREDECESSOR as PREDECESSOR,
  NATURE_WALKER_PREFIX_COUNT as PREFIX, NATURE_WALKER_INHERITED_COUNT as INHERITED, NATURE_WALKER_SEED as SEED,
  captureMetadata, observedCapture, naturalEntry, sourceEntry, summaryEntry, capturePath, captureFileHash, insertionOrderHash, captureValueHash, currentCapture,
  captureJsonLines, capturePublicBody, publicCaptureControl, originalLivingPrefix, capturedState, namedBoundary, replayCaptureBoundary,
  captureBody, sourceOriginals, currentOriginals, currentPad, actualLifeAbilityUse, actualCombatAbilityUse, assertOriginalContinuity, sameCaptureValue as same } from './nature-walker-capture-helper.js';
import { expectedPublicNatureWalkerOutcome, expectedPublicNatureWalkerRound, assertNoPrivateNatureWalkerFields, assertNatureWalkerPublicEvidence, decoratePrivateProbe } from './nature-walker-public-evidence.js';

interface FileEvidence { bytes: number; sha256: string }
interface Integrity { producerSha256: string; freezeSha256: string; frozenFiles: ({ file: string } & FileEvidence)[]; metadata: Record<string, FileEvidence>; files: Record<string, FileEvidence> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }
interface Ledger { step: number; sourcePrefix: boolean; boundaryKey: string | null; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> }
interface PublicRow { step: number; revision: number; command: SliceIntent; control: unknown; before: ReturnType<typeof capturePublicBody>; after: ReturnType<typeof capturePublicBody> }
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
const inventory = () => readdirSync(ROOT).sort().map(file => { const s = statSync(`${ROOT}/${file}`); return { file, bytes: s.size, mtimeMs: s.mtimeMs, ctimeMs: s.ctimeMs }; });

it('requires a confirmed completed stage207 observation rather than treating missing or running evidence as success', () => { observedCapture(); });

describe('Nature Walker literal same-seed natural capture', () => {
  it('pins every immutable member, both source chains, strict initial scripts and raw204 capture hashes without dist', async () => {
    const e = observedCapture(), { boundaries, steps, snapshots } = captureMetadata();
    expect(e.commands).toBeGreaterThan(PREFIX); expect(e.uniqueTransitions).toBe(e.commands - PREFIX + 1);
    expect(e.namedBoundaries).toBe(e.uniqueTransitions + e.aliases); expect(STAGES).toContain(e.stage); expect(e.replayTimeoutMs).toBe(600_000);
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256); expect(await captureFileHash(PREDECESSOR)).toBe(evidence.predecessorSha256);
    expect(await captureFileHash('scripts/play/nature-walker-stage.mjs')).toBe(e.producerSha256);
    expect(await captureFileHash('scripts/play/nature-walker-save.mjs')).toBe(e.saveVerifierSha256);
    expect(Object.keys(e.metadataHashes).sort()).toEqual([...METADATA].sort());
    for (const [file, hash] of Object.entries(e.metadataHashes)) { const path = `${ROOT}/${file}`; expect(realpathSync(path)).toBe(resolve(path)); expect(await captureFileHash(path)).toBe(hash); }
    const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as Integrity;
    expect(integrity.producerSha256).toBe(e.producerSha256); expect(integrity.freezeSha256).toBe(e.freezeSha256); expect(insertionOrderHash(integrity.frozenFiles)).toBe(e.freezeSha256);
    expect(new Set(integrity.frozenFiles.map(f => f.file)).size).toBe(integrity.frozenFiles.length);
    expect(integrity.frozenFiles.find(f => f.file === 'scripts/play/nature-walker-stage.mjs')?.sha256).toBe(e.producerSha256);
    expect(integrity.frozenFiles.find(f => f.file === 'scripts/play/nature-walker-save.mjs')?.sha256).toBe(e.saveVerifierSha256);
    // Initial207 has no historical UI revision exception. The coordinator's
    // separate verifier compares the entire live runtime freeze; these tests
    // check its immutable recorded inventory without requiring compiled dist.
    expect(Object.keys(integrity.metadata).sort()).toEqual(METADATA.filter(name => name !== 'capture-integrity.json').sort());
    const members = [...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].sort();
    same(Object.keys(integrity.files).sort(), members); same(readdirSync(ROOT).sort(), [...members, ...METADATA].sort());
    expect(members.length + METADATA.length).toBe(e.files); expect(sum(inventory(), f => f.bytes)).toBe(e.bytes);
    for (const [file, pin] of Object.entries({ ...integrity.metadata, ...integrity.files })) {
      const path = file.endsWith('.json') ? capturePath(file) : `${ROOT}/${file}`; expect(realpathSync(path)).toBe(resolve(path)); expect(statSync(path).size).toBe(pin.bytes); expect(await captureFileHash(path)).toBe(pin.sha256);
    }
    same(steps, e.boundarySteps); same(Object.keys(snapshots), e.snapshots);
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) { const raw = naturalEntry<SliceState>(key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([204, 'nature-walker-v204']); }
    for (const file of new Set(Object.values(snapshots))) { expect(readObjectEntry(capturePath(file), 'schemaVersion')).toBe(204); expect(readObjectEntry(capturePath(file), 'contentVersion')).toBe('nature-walker-v204'); }
    const prefix = capturePath('source-prefix.json');
    for (const [key, value] of Object.entries({ source: SOURCE, sourceSha256: evidence.sourceSha256, sourceRoot: 'final', prefixCount: PREFIX, inheritedDirectedPrefix: false,
      rawCommandsSha256: evidence.prefixSha256, predecessorSource: PREDECESSOR, predecessorSha256: evidence.predecessorSha256, inheritedCount: INHERITED, inheritedCommandsSha256: evidence.inheritedSha256 })) same(readObjectEntry(prefix, key), value);
    for (const [captured, original] of [['rawInitial', 'initial'], ['rawFinal', 'final'], ['rawInheritedFinal', 'prefixFinal']] as const) same(readObjectEntry(prefix, captured), sourceEntry(original));
    same(readObjectEntry(prefix, 'commands'), sourceEntry('commands'));
    expect(insertionOrderHash(sourceEntry('commands'))).toBe(evidence.prefixSha256); expect(insertionOrderHash(readObjectEntry(PREDECESSOR, 'commands'))).toBe(evidence.inheritedSha256);
    expect(readObjectEntry(prefix, 'migratedWholeStateSha256')).toBe(captureValueHash(naturalEntry('prefixFinal')));
    expect(summaryEntry<{ migratedWholeSourceSha256: string }>('source').migratedWholeSourceSha256).toBe(captureValueHash(naturalEntry('prefixFinal')));
    expect(captureValueHash(naturalEntry('final'))).toBe(e.finalRawStateSha256);
    same(capturedState('prefixFinal'), originalLivingPrefix()); same(capturedState('initial'), currentCapture(sourceEntry('initial')));
  }, 240_000);

  it('replays the full original851 and every actual new command through CURRENT, comparing every state/public/RNG boundary in memory', async () => {
    const e = observedCapture(), { commands, boundaries, steps, snapshots } = captureMetadata(), filesBefore = inventory();
    expect(commands).toHaveLength(e.commands); same(commands.slice(0, PREFIX), sourceEntry('commands'));
    same(commands.slice(0, INHERITED), readObjectEntry(PREDECESSOR, 'commands'));
    expect(naturalEntry('seed')).toBe(SEED); expect(naturalEntry('prefixVerified')).toBe(true); expect(naturalEntry('prefixCount')).toBe(PREFIX); expect(naturalEntry('inheritedPrefixCount')).toBe(INHERITED);
    const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as Transition[];
    expect(transitions).toHaveLength(e.uniqueTransitions); const byStep = new Map(transitions.map(row => [row.commandIndex, row]));
    expect(Object.keys(boundaries)).toHaveLength(e.namedBoundaries); same(Object.keys(steps), Object.keys(boundaries)); same([...new Set(Object.values(boundaries))], transitions.map(row => row.file));
    for (const [i, row] of transitions.entries()) { expect([row.commandIndex, row.beforeRevision, row.afterRevision]).toEqual([PREFIX + i, PREFIX + i, PREFIX + i + 1]); expect(boundaries[row.key]).toBe(row.file); expect(steps[row.key]).toBe(row.commandIndex); }
    for (const [name, file] of Object.entries(boundaries)) expect(byStep.get(steps[name]!)?.file, name).toBe(file);
    const original = originalLivingPrefix(); let state = createSliceRun(original.runId, sourceEntry<Parameters<typeof createSliceRun>[1]>('creation'), SEED);
    let count = 0, inheritedVerified = false, prefixVerified = false, livingContinues = 0;
    same(state, capturedState('initial')); const publicRows = captureJsonLines<PublicRow>('public.jsonl'), stateHashes = new Map<number, string>(), treatments: unknown[] = [];
    try {
      for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
        expect(row.step).toBe(++count); expect(row.sourcePrefix).toBe(count <= PREFIX); same(row.intent, commands[count - 1]); expect(validateSlicePayload(row.intent)).toBe(true);
        same(captureBody(state), row.before); const before = state, transition = byStep.get(count); let proof: PublicRow | null = null;
        if (count > PREFIX) {
          expect(transition).toBeDefined(); expect(row.boundaryKey).toBe(transition!.key);
          const control = publicCaptureControl(before, row.intent), next = await publicRows.next(); if (next.done) throw new Error(`Missing actual public row ${count}`); proof = next.value;
          expect(Object.keys(proof).sort()).toEqual(['step', 'revision', 'command', 'control', 'before', 'after'].sort());
          expect(proof.step).toBe(count); expect(proof.revision).toBe(before.revision); same(proof.command, row.intent); same(proof.control, control);
          same(currentNatureWalkerPublicReplayExpectation(proof.before), capturePublicBody(before));
          assertNoPrivateNatureWalkerFields(proof.before.natureWalker, [], false); assertNoPrivateNatureWalkerFields(proof.after.natureWalker, [], false);
        } else expect(row.boundaryKey).toBeNull();
        state = applySliceIntent(before, row.intent); assertValidSliceState(state);
        expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe(SEED); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor); same(captureBody(state), row.after);
        if (proof) same(currentNatureWalkerPublicReplayExpectation(proof.after), capturePublicBody(state));
        if (count === INHERITED) { same(state, currentCapture(sourceEntry('prefixFinal'))); same(state, currentCapture(readObjectEntry(PREDECESSOR, 'final'))); inheritedVerified = true; }
        if (row.intent.type === 'CONTINUE_LIFE') { expect(before.status).toBe('SLICE_COMPLETE'); expect(before.ending?.kind).not.toBe('DEATH'); expect(state.status).toBe('ACTIVE'); livingContinues++; }
        if (count === PREFIX) { same(state, original); prefixVerified = true; }
        if (transition) {
          const path = capturePath(transition.file); expect(readObjectEntry(path, 'commandCount')).toBe(count); same(readObjectEntry(path, 'lastIntent'), row.intent);
          for (const root of ['beforeLast', 'final']) {
            const raw = readObjectEntry<SliceState>(path, root); expect([raw.schemaVersion, raw.contentVersion]).toEqual([204, 'nature-walker-v204']);
            const migrated = currentCapture(raw), expected = migrated.revision >= NATURE_WALKER_CAPTURE_GUIDE_REVISION
              ? currentNatureWalkerReplayExpectation(migrated) : migrated;
            same(root === 'beforeLast' ? before : state, expected);
          }
          stateHashes.set(state.revision, captureValueHash(state)); assertOriginalContinuity(state, original);
          if (count > PREFIX) {
            expect(getNatureWalkerCurrentSite(state).clockSeconds).toBeGreaterThanOrEqual(getNatureWalkerCurrentSite(before).clockSeconds);
            expect(getNatureWalkerCurrentSite(state).playerTravelMetres).toBeGreaterThanOrEqual(getNatureWalkerCurrentSite(before).playerTravelMetres);
            if (row.intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') treatments.push({ paidPennies: 60, before: captureBody(before), after: captureBody(state) });
          }
        }
      }
      expect((await publicRows.next()).done).toBe(true);
    } finally { await publicRows.return(undefined); }
    expect(count).toBe(e.commands); expect(state.revision).toBe(e.commands + 1);
    same(state, currentNatureWalkerReplayExpectation(capturedState('final'))); same(captureBody(state), e.final);
    expect(inheritedVerified).toBe(true); expect(prefixVerified).toBe(true); expect(livingContinues).toBeGreaterThan(0);
    for (const file of new Set(Object.values(snapshots))) {
      const saved = currentCapture(JSON.parse(readFileSync(capturePath(file), 'utf8'))), expected = saved.revision >= NATURE_WALKER_CAPTURE_GUIDE_REVISION
        ? currentNatureWalkerReplayExpectation(saved) : saved;
      expect(captureValueHash(expected), file).toBe(stateHashes.get(saved.revision));
    }
    same(treatments, e.treatments); same(treatments, naturalEntry('treatments')); same(treatments, summaryEntry('treatments')); same(inventory(), filesBefore); assertOriginalContinuity(state, original);
    // Only this complete851+ continuation replay receives600s. No global timeout,
    // dist/global-freeze dependency, producer invocation, fixture rewrite or RNG edit.
  }, 600_000);

  it('accounts for actual acquisition, every finite dose and honest bounded life receipts without inventing recovery', () => {
    const e = observedCapture(), s = capturedState('final'), original = originalLivingPrefix(), h = s.natureWalker, life = h.life;
    same(captureBody(original), e.originalBody); same(original.character, e.originalCharacter); same(original.progression.mastery, e.originalMastery);
    expect(Object.keys(original.progression.mastery)).toHaveLength(15); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(3);
    expect(original.character.gender).toBe('FEMALE'); expect(original.health).toBe(100); expect(original.injuries).toEqual([]); expect(original.injuryRisk).toBe(0); expect(currentPad(original).integrity).toBe(50);
    same(h.bottles, e.bottles); same(h.bottles, summaryEntry('bottles')); expect(h.promotionWeek).toBe(e.promotionWeek); expect(new Set(h.bottles.map(b => b.id)).size).toBe(h.bottles.length);
    same(naturalEntry('treatments'), e.treatments); same(summaryEntry('treatments'), e.treatments);
    expect(validateNatureWalkerAcquisitionJournal(s)).toBe(true); expect(validateNatureWalkerJournalContinuity(s)).toBe(true);
    for (const r of h.acquisitionJournal) {
      const c = r.command, fee = c.type === 'LEARN_GUIDANCE' ? 500 : c.type === 'BUY_POTION' ? 1200 : c.type === 'PREPARE_PROMOTION' ? 180 : c.type === 'REQUEST_SUPPLY' ? 100 : 0;
      const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(c.type) ? 1 : 0;
      expect(r.after.cash).toBe(r.before.cash - fee); expect(r.after.actions).toBe(r.before.actions - ap); same(r.after.injuries, r.before.injuries);
      expect(r.actor).toMatchObject({ pathwayId: 'mother', barrenMatriarchPromotionWeek: 202, cultivatorPromotionWeek: 6 });
    }
    for (const bottle of h.bottles.filter(b => b.status === 'CONSUMED')) {
      const b = replayCaptureBoundary(`consume-${bottle.id}`); expect(b.before.week - original.barrenMatriarch.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(b.before.natureWalker.preparedWeek).toBe(b.before.week); expect(b.final.natureWalker.preparedWeek).toBeNull(); expect(b.final.random.cursor - b.before.random.cursor).toBe(1);
      same(b.before.injuries, b.final.injuries); same(currentOriginals(b.before), currentOriginals(b.final));
      expect(h.acquisitionJournal.filter(r => r.command.type === 'POTION_WORK' && r.command.bottleId === bottle.id)).toHaveLength(5); expect(bottle.preparationWeek).toBe(bottle.consumedWeek);
      if (b.final.progression.sequence === 1) { expect(b.final.health).toBe(b.before.health); expect(b.final.spirituality).toBe(b.before.spirituality); same(b.final.progression.mastery, { ...b.before.progression.mastery, ...Object.fromEntries(NATURE_WALKER_ABILITY_IDS.map(id => [id, 0])) }); }
    }
    for (const id of NATURE_WALKER_CASE_IDS) {
      expect(life.cases[id].attempts.length).toBeLessThanOrEqual(1);
      expect(life.journal.filter(r => ['LIVING_RESPONSE', 'ROOT_BEARING'].includes(r.command.type) && 'caseId' in r.command && r.command.caseId === id).length).toBeLessThanOrEqual(1);
      const a = life.cases[id].attempts[0]; if (!a) continue;
      expect(a.effortSpent).toBe(3); expect(a.recipientMindSpent).toBe(1);
      if (life.cases[id].status === 'RESOLVED') expect(a).toMatchObject({ closed: true, inspected: true, objectsReturned: true, resultRead: true });
    }
    for (const r of life.journal) {
      expect(r.after.cash).toBe(r.before.cash - r.paid.pennies); expect(r.after.actions).toBe(r.before.actions - r.paid.actions);
      expect(r.after.spirituality).toBe(r.before.spirituality - r.paid.spirituality); expect(r.after.mind).toBe(r.before.mind - r.paid.mind); expect(r.after.health).toBe(r.before.health - r.paid.health);
      expect(r.clockAfter).toBeGreaterThanOrEqual(r.clockBefore);
      if (r.command.type === 'LIVING_RESPONSE' || r.command.type === 'ROOT_BEARING') { expect([r.paid.spirituality, r.paid.actions]).toEqual([8, 1]); expect(r.paid.mind).toBe(r.tier === 'FAILURE' || r.tier === 'GREAT_FAILURE' ? 4 : 2); expect(r.source).toMatchObject({ difficulty: 18, coreStat: r.command.type === 'LIVING_RESPONSE' ? 'knowledge' : 'will', supportPiecesBefore: expect.any(Number) }); }
      if (r.command.type === 'EXIT_ORIGINAL') { expect(r.clockAfter - r.clockBefore).toBe(4); expect(r.paid.actions).toBe(0); }
      if (r.command.type === 'INITIALISE_WORKAREA' || r.command.type === 'RENT_ANNEX') expect([r.paid.pennies, r.paid.actions]).toEqual([40, 1]);
    }
    same(actualLifeAbilityUse(s), e.lifeAbilityUse); same(summaryEntry('lifeAbilityUse'), e.lifeAbilityUse); same(summaryEntry('life'), life);
    same(NATURE_WALKER_CASE_IDS.filter(id => life.cases[id].status === 'RESOLVED'), e.completedCases); assertOriginalContinuity(s, original);
  }, 180_000);

  it('replays actual rounds with the sole continuing pad, finite original guard, honest costs and application-only mastery', () => {
    const e = observedCapture(), original = originalLivingPrefix(), s = capturedState('final'), rounds = s.combatHistory.slice(original.combatHistory.length);
    same(rounds.map(r => r.round), e.combatRounds); same(rounds, summaryEntry('rounds')); same([...new Set(rounds.map(r => r.consequenceDomain ?? null))], e.consequenceDomains);
    same(actualCombatAbilityUse(s, original), e.combatAbilityUse); same(summaryEntry('combatAbilityUse'), e.combatAbilityUse);
    for (const round of rounds) {
      const name = round.stance === 'RETREAT' ? 'actual-one-public-retreat-at-declared-cap' : `combat-round-${round.round}`, b = replayCaptureBoundary(name), o = round.natureWalkerOutcome!;
      same(b.final.lastCombatRound, round); same(currentNatureWalkerCombatSource(b.before), o.source); same(replayNatureWalkerCombatRound(o.source, round.stance).round, round);
      expect(o.source).toMatchObject({ targetId: 'NW1-ELIAS', targetAge: 45, targetSequence: 2, targetCore: 27, independentMind: true, actualBody: true, policy: 'ALL', maxActionCount: 6, thirdPartiesInArea: 0, automaticAllyImmunity: false });
      same(o.source.originals, sourceOriginals(original)); same({ dormancy: o.source.operation.dormancy, buffer: o.source.operation.buffer }, original.barrenMatriarch.life.operation);
      expect(o.playerActions).toHaveLength(round.stance === 'RETREAT' ? 0 : round.playerCount); expect(o.enemyActions).toHaveLength(round.stance === 'RETREAT' ? 0 : round.enemyCount); expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - sum(o.playerActions, a => a.paidCost));
      expect(o.playerMindAfter).toBe(Math.max(0, o.source.playerMind - sum(o.playerActions, a => a.mindCost) - (round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0)));
      expect(b.final.random.cursor).toBe(o.randomCursorAfter); const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      expect(actions.map(a => a.order)).toEqual(actions.map((_, i) => i));
      for (const a of actions) {
        expect(a.randomCursorAfter).toBeGreaterThanOrEqual(a.randomCursorBefore); expect(a.elapsedSeconds).toBe(5);
        if (a.actor === 'PLAYER' && a.id === NATURE_WALKER_ABILITY_IDS[0]) expect(a).toMatchObject({ paidCost: 0, mindCost: 0, windowGranted: null, masteryApplied: [] });
      }
      expect(o.livingResponseApplications).toBe(0); assertOriginalContinuity(b.final, original);
    }
    same(summaryEntry('currentOriginals'), currentOriginals(s)); same(summaryEntry('encounter'), s.natureWalker.encounter); same(s.natureWalker.encounter.terminal, e.terminal);
    same(captureBody(s), e.final); same(migrateSliceState(s), s); same(projectSliceState(currentCapture(naturalEntry('final'))), projectSliceState(s));
    same(applySliceIntent(capturedState('beforeLast'), naturalEntry<SliceIntent>('lastIntent')), s); assertOriginalContinuity(s, original);
  }, 180_000);

  it('keeps all eight private Mother histories immutable and inherited surfaces read-only', () => {
    const original = originalLivingPrefix(), s = capturedState('final'); if (!s.natureWalker.guidanceKnown) return;
    const before = captureValueHash(s), historical = natureWalkerInheritedView(s), view = projectSliceState(s);
    expect(historical.progression.sequence).toBe(2); expect(historical.barrenMatriarch.promotionWeek).toBe(202); same(historical.progression.mastery, original.progression.mastery);
    const scan = (v: unknown): void => {
      if (!v || typeof v !== 'object') return; if (Array.isArray(v)) { v.forEach(scan); return; }
      const o = v as Record<string, unknown>; if (Array.isArray(o.actions)) for (const a of o.actions as { enabled: boolean }[]) expect(a.enabled).toBe(false);
      if ('preferredActionId' in o) expect(o.preferredActionId).toBeNull(); Object.values(o).forEach(scan);
    };
    for (const key of NATURE_WALKER_SOURCE_KEYS) { same(s[key], original[key]); scan(view[key]); }
    expect(view.barrenMatriarch.abilities).toHaveLength(15); expect(view.barrenMatriarch.acting).toBe(100); expect(captureValueHash(s)).toBe(before);
    for (const type of ['CULTIVATOR', 'PHYSICIAN', 'HARVESTPRIEST', 'BIOLOGIST', 'DRUID', 'ANCIENT_ALCHEMIST', 'COFFIN_BEARER', 'BARREN_MATRIARCH'] as const) {
      expect(() => applySliceIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent)).toThrow(); expect(captureValueHash(s)).toBe(before);
    }
  }, 90_000);

  it('uses exact nested positive allowlists at all three public round entrances and retains actual modifier labels', () => {
    const e = observedCapture(), original = originalLivingPrefix(); let activeRoundChecked = false;
    for (const n of e.combatRounds) {
      const name = n > 90 ? 'actual-one-public-retreat-at-declared-cap' : `combat-round-${n}`, raw = namedBoundary(name).final;
      const rawHash = captureValueHash(raw), round = raw.lastCombatRound!, o = round.natureWalkerOutcome!, view = projectSliceState(raw), expected = expectedPublicNatureWalkerOutcome(o);
      same(projectNatureWalkerRoundOutcome(o), expected); assertNatureWalkerPublicEvidence(raw, view);
      const entries = [view.lastCombatRound!.natureWalkerOutcome, view.combatHistory.at(-1)!.natureWalkerOutcome];
      if (view.combat?.lastRound) { entries.push(view.combat.lastRound.natureWalkerOutcome); activeRoundChecked = true; }
      for (const entry of entries) { same(entry, projectPlayerText(expected, raw.character.name)); assertNoPrivateNatureWalkerFields(entry); }
      expect(captureValueHash(raw)).toBe(rawHash); same(raw.natureWalker.sourceHistory, Object.fromEntries(NATURE_WALKER_SOURCE_KEYS.map(k => [k, original[k]])));
      const probe = structuredClone(raw), probeRound = probe.lastCombatRound!, probeOutcome = probeRound.natureWalkerOutcome!;
      const checked = [...probeOutcome.playerActions, ...probeOutcome.enemyActions].find(a => a.check !== null);
      if (checked) checked.check = { ...checked.check!, modifiers: [...checked.check!.modifiers, { source: '公开的实际修正标签', value: 0 }] };
      decoratePrivateProbe(probeOutcome); probe.combatHistory[probe.combatHistory.length - 1] = structuredClone(probeRound); if (probe.combat) probe.combat.lastRound = structuredClone(probeRound);
      const poisonedHash = captureValueHash(probe), projected = projectSliceState(probe), probeExpected = expectedPublicNatureWalkerOutcome(probeOutcome);
      const projectedEntries = [projected.lastCombatRound!.natureWalkerOutcome, projected.combatHistory.at(-1)!.natureWalkerOutcome];
      if (projected.combat?.lastRound) projectedEntries.push(projected.combat.lastRound.natureWalkerOutcome);
      for (const entry of projectedEntries) { same(entry, projectPlayerText(probeExpected, probe.character.name)); assertNoPrivateNatureWalkerFields(entry); }
      same(projected.lastCombatRound, projectPlayerText(expectedPublicNatureWalkerRound(probeRound), probe.character.name));
      if (checked) expect(JSON.stringify(projectedEntries)).toContain('公开的实际修正标签'); expect(captureValueHash(probe)).toBe(poisonedHash);
    }
    if (e.combatRounds.length > 1) expect(activeRoundChecked).toBe(true);
  }, 180_000);

  it('pins the actual first dose, five no-plant fallbacks, paid failed/resisted casts and wounded living exit', () => {
    const s = capturedState('final'), original = originalLivingPrefix(), h = s.natureWalker, life = h.life, site = getNatureWalkerCurrentSite(s);
    expect(h.bottles.map(b => [b.id, b.status, b.outcome, b.stockedWeek, b.acquiredWeek, b.consumedWeek, b.labourSteps])).toEqual([
      ['nature-walker-potion-1', 'CONSUMED', 'SUCCESS', 212, 220, 221, 5],
      ['nature-walker-potion-2', 'SUPPLIER', null, 212, null, null, 0], ['nature-walker-potion-3', 'SUPPLIER', null, 212, null, null, 0],
    ]);
    expect(h.promotionWeek).toBe(221); expect(h.acquisitionJournal.some(r => r.command.type === 'REQUEST_SUPPLY')).toBe(false);
    expect(s).toMatchObject({ status: 'ACTIVE', revision: 956, week: 228, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 11, day: 3 },
      health: 40, mind: 83, spirituality: 114, cash: 255, actionsRemaining: 3, injuryRisk: 3, random: { seed: SEED, cursor: 349 }, progression: { sequence: 1, acting: 100 } });
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, coreStats: { physique: 29, perception: 25, will: 24, knowledge: 25 } });
    expect(s.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 948, null], ['LIGHT', 949, null], ['HEAVY', 953, null], ['HEAVY', 954, null]]);
    expect(naturalEntry('treatments')).toEqual([]); expect(summaryEntry('treatments')).toEqual([]);
    expect(NATURE_WALKER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(id === 'mother.s2.root-buffer' ? 24 : value);
    expect(life.cases['living-response'].attempts[0]).toMatchObject({ livingResponseTier: 'SUCCESS', careTier: 'SUCCESS', careAssisted: true, result: 'ABILITY', spiritualitySpent: 8, mindSpent: 2, appliedAbilityIds: ['mother.s1.living-response'] });
    expect(life.cases['withdrawn-care'].attempts[0]).toMatchObject({ livingResponseTier: 'SUCCESS', careTier: 'SUCCESS', careAssisted: false, permissionWithdrawn: true, result: 'ORDINARY', spiritualitySpent: 8, mindSpent: 2, appliedAbilityIds: [] });
    expect(life.cases['root-impact'].attempts[0]).toMatchObject({ rootBearingTier: 'SUCCESS', result: 'ABILITY', spiritualitySpent: 8, mindSpent: 2, healthLost: 2, appliedAbilityIds: ['mother.s1.root-bearing'], impact: { mode: 'IMPACT', contribution: 15, baseHealthLoss: 5, healthLoss: 2, padWear: 15, rootBearingApplied: true } });
    expect(life).toMatchObject({ reflected: true, activeCase: null, annex: { paidWeek: 222, supportPieces: 0, effortSpent: 9, effortLimit: 9 } });
    expect(site.samples.map(v => [v.id, v.alive, v.vitality, v.location])).toEqual([['CB3-LIVE-1', true, 47, 'OUTSIDE'], ['CB3-LIVE-2', true, 47, 'OUTSIDE'], ['CB3-DRY-1', false, 0, 'OUTSIDE']]);
    expect(site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 228, clockSeconds: 1522, externalSeconds: 1060,
      owner: { alive: true, health: 100, mind: 100, location: 'OUTSIDE' }, recipient: { alive: true, health: 100, mind: 97, location: 'OUTSIDE' } });
    expect(site.guard.segments.map(v => [v.id, v.status])).toEqual([['CB3-SEG1', 'SPENT'], ['CB3-SEG2', 'SPENT'], ['CB3-SEG3', 'SPENT']]);
    expect(currentPad(s)).toMatchObject({ id: 'BM2-ROOT-PAD', sourceId: 'BM2-ROOT-FIBRE-STOCK', acquiredWeek: 202, integrity: 5, location: 'OUTSIDE' });
    const rounds = s.combatHistory.slice(original.combatHistory.length);
    expect(rounds.map(r => [r.round, r.winner, r.playerCountRoll, r.enemyCountRoll, r.playerCount, r.enemyCount, r.consequenceDomain ?? null, r.consequenceRoll ?? null])).toEqual([
      [1, 'PLAYER', 17, 36, 2, 3, 'BODY', 64], [2, 'ENEMY', 45, 26, 3, 3, 'BODY', 1], [3, 'ENEMY', 20, 15, 2, 2, 'BODY', 29],
      [4, 'PLAYER', 86, 67, 5, 4, 'BODY', 52], [5, 'PLAYER', 71, 90, 4, 5, null, null], [6, 'PLAYER', 13, 70, 2, 4, 'BODY', 23],
      [7, 'ENEMY', 42, 85, 3, 5, 'BODY', 58], [8, 'ENEMY', 39, 20, 3, 2, 'BODY', 49], [9, 'PLAYER', 68, 87, 4, 5, 'BODY', 48],
    ]);
    const actions = rounds.flatMap(r => r.natureWalkerOutcome!.playerActions), fallback = actions.filter(a => a.id === NATURE_WALKER_ABILITY_IDS[0]);
    expect(fallback).toHaveLength(5);
    for (const a of fallback) expect(a).toMatchObject({ selectedAbility: 'ORDINARY_OBSERVE', fallbackReason: 'NO_ORIGINAL_LIVING_PLANT_CARE_EVENT', mode: 'OBSERVE', paidCost: 0, mindCost: 0, windowGranted: null, windowsApplied: [], masteryApplied: [] });
    const bearing = actions.filter(a => a.id === NATURE_WALKER_ABILITY_IDS[1]);
    expect(bearing.map(a => [a.paidCost, a.mindCost, a.check?.roll ?? null, a.check?.tier ?? null, a.succeeded, a.resisted])).toEqual([
      [8, 4, 91, 'FAILURE', false, false], [8, 4, 100, 'GREAT_FAILURE', false, false], [8, 4, 28, 'SUCCESS', false, true], [0, 0, null, null, false, false],
    ]);
    for (const a of bearing) { expect(a.windowGranted).toBeNull(); expect(a.masteryApplied).toEqual([]); }
    for (const id of NATURE_WALKER_ABILITY_IDS) expect(actualCombatAbilityUse(s, original)[id]).toMatchObject({ actualApplications: 0, contributionChange: 0, masteryApplications: 0 });
    expect(h.encounter.supportPieces.map(p => [p.status, p.wear, p.usedRound, p.usedOrder])).toEqual([['SPENT', 1, 3, 2], ['SPENT', 1, 4, 3], ['SPENT', 1, 5, 2]]);
    expect(h.encounter.enemyCharges.map(p => [p.status, p.usedRound, p.usedOrder])).toEqual([['SPENT', 1, 4], ['SPENT', 2, 0], ['SPENT', 2, 4]]);
    expect(h.encounter.terminal).toEqual({ outcome: 'ENEMY_SURRENDERED', round: 9, historyIndex: 25, enemyHealth: 40, enemyMind: 100, enemySpirituality: 53, enemyStatus: 'SURRENDERED', exitMetres: 4, exitSeconds: 4 });
    expect(s.combat).toBeNull(); const before = capturedState('beforeLast');
    expect(naturalEntry('lastIntent')).toEqual({ type: 'ACTION', action: 'WORK' }); expect(before).toMatchObject({ week: 227, cash: 105, actionsRemaining: 1 });
    expect(s.cash).toBe(before.cash + 180 - 30); expect(s.health).toBe(before.health); expect(s.mind).toBe(before.mind); expect(s.spirituality).toBe(before.spirituality); same(s.injuries, before.injuries); same(s.random, before.random);
    assertOriginalContinuity(s, original);
  }, 120_000);

  it('pins the actual endpoint honestly and never converts a finite failure or permanent death into success', () => {
    const e = observedCapture(), s = capturedState('final'), rounds = s.combatHistory.slice(originalLivingPrefix().combatHistory.length), life = s.natureWalker.life;
    same(captureBody(s), e.final); same(naturalEntry('strategy'), e.strategy); same(naturalEntry('provenance'), e.provenance); expect(naturalEntry('stage')).toBe(e.stage);
    expect(naturalEntry('error')).toBe(e.error); expect(naturalEntry('failurePhase')).toBe('IDLE'); expect(e.failurePhase).toBe('IDLE'); expect(naturalEntry('pendingIntent')).toBeNull(); expect(e.pendingIntent).toBeNull(); assertValidSliceState(s);
    if (e.stage === STAGES[0]) {
      expect(e.error).toBeNull(); expect(s).toMatchObject({ status: 'ACTIVE', progression: { sequence: 1, acting: 100 } }); expect(s.combat).toBeNull();
      expect(life).toMatchObject({ reflected: true, activeCase: null, annex: { effortSpent: 9 }, operation: { dormancy: null, buffer: null, livingResponse: null, rootBearing: null } });
      expect(e.completedCases).toEqual([...NATURE_WALKER_CASE_IDS]); expect(s.natureWalker.encounter.terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 }); expect(s.natureWalker.encounter.terminal!.outcome).not.toBe('PLAYER_DEAD');
      expect(getNatureWalkerCurrentSite(s).playerLocation).toBe('OUTSIDE'); expect(captureMetadata().snapshots.livingContinuation).toBeDefined();
      expect(life.cases['withdrawn-care'].attempts[0]).toMatchObject({ permissionWithdrawn: true, result: 'ORDINARY', appliedAbilityIds: [] });
    } else if (e.stage === STAGES[1]) {
      expect(s.status).toBe('ACTIVE'); expect(s.progression.sequence).toBe(2); expect(rounds).toHaveLength(0); const consumed = s.natureWalker.bottles.filter(b => b.status === 'CONSUMED');
      expect(consumed).toHaveLength(12); expect(consumed.every(b => b.outcome === 'FAILURE' || b.outcome === 'GREAT_FAILURE')).toBe(true);
    } else if (e.stage === STAGES[2]) {
      expect(s.status).toBe('ACTIVE'); expect(s.natureWalker.encounter.status).toBe('FIGHTING'); expect(s.natureWalker.encounter.terminal).toBeNull(); expect(s.combat).not.toBeNull(); expect(rounds.length).toBeGreaterThanOrEqual(90); expect(rounds.length).toBeLessThanOrEqual(91);
    } else {
      expect(e.stage).toBe(STAGES[3]); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0); expect(projectSliceState(s).canAct).toBe(false); const hash = captureValueHash(s);
      for (const intent of [{ type: 'CONTINUE_LIFE' }, { type: 'ACTION', action: 'REST' }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }] as SliceIntent[]) { expect(() => applySliceIntent(s, intent)).toThrow(); expect(captureValueHash(s)).toBe(hash); }
    }
    expect(currentPad(s).integrity).toBeGreaterThanOrEqual(0); expect(currentPad(s).integrity).toBeLessThanOrEqual(50); assertOriginalContinuity(s, originalLivingPrefix());
  }, 90_000);
});
