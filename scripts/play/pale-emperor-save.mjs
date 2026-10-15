import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileEvidence, inspectSources, parseArguments, verifySageBoundaries } from './sage-save.mjs';

// Uses the existing real SQLite transaction verifier. Every selected transition
// receives rollback/no-receipt, reopen-before, public/private projection equality,
// committed reopen and idempotent retry checks; genuine death gets its own sealed
// database. All databases are newly created verification files, never player DBs.
const TERMINAL_STAGES = [
  'NATURAL_PALE_EMPEROR_PUBLIC_CONTINUATION',
  'NATURAL_FINITE_POTION_FAILURES_ALIVE_S2',
  'NATURAL_FINITE_ENCOUNTER_UNRESOLVED',
  'NATURAL_ACTUAL_TERMINAL',
];
const SOURCE_HASH = '283fa4554282597027a6e65f2a31c561750769fb3f93343e570abebac11fdee9';
const PREFIX_HASH = '7f1377eebd7abfe9032d610ca171cdda2fac8541d5777ba096866b9b9e533caa';
const SOURCE_STATE_HASH = '6f02cbfee03fb205ffbb5017173800c078227ac388790217028f188db50274ab';
const json = path => JSON.parse(readFileSync(path, 'utf8'));

try {
  const args = process.argv.slice(2);
  if (!args.includes('--source-directory')) args.push('--source-directory', 'tests/fixtures/pale-emperor-v01950');
  if (!args.includes('--output-directory')) args.push('--output-directory', 'output/qa-0195/sqlite');
  const options = parseArguments(args);
  if (options.help) {
    console.log('Usage: node --expose-gc scripts/play/pale-emperor-save.mjs --expected-boundaries N [--source-directory DIR] [--output-directory DIR] [--tag NAME]\nVerifies the complete named natural capture index. No partial range, state substitution, or ACTUAL_BLOCKER success.');
  } else {
    assert.equal(options.key, 'boundaries', 'This verifier requires the actual natural named boundaries');
    assert.equal(options.start, 0, 'Verify all named captures from the first transition');
    assert(options.expectedBoundaries !== undefined, 'Supply the exact observed --expected-boundaries count');
    const source = inspectSources(options), summary = json(join(source.root, 'summary.json')), integrity = json(join(source.root, 'capture-integrity.json'));
    const integrityBefore = fileEvidence(join(source.root, 'capture-integrity.json'));
    assert.equal(source.count, source.entries.length, 'A partial range cannot certify the full capture set');
    assert.equal(new Set(source.entries.map(row => row.filename)).size, source.entries.length, 'Every named boundary has its own genuine transition file');
    assert(TERMINAL_STAGES.includes(summary.stage), 'An actual blocker is preserved evidence, not a completed save verification');
    assert.equal(summary.source.prefixCount, 815); assert.equal(summary.source.prefixVerified, true);
    assert.equal(summary.source.sourceSha256, SOURCE_HASH); assert.equal(summary.source.prefixJsonStringifySha256, PREFIX_HASH); assert.equal(summary.source.rawSourceStateSha256, SOURCE_STATE_HASH);
    assert.equal(summary.source.rawSchemaVersion, 170); assert.equal(summary.source.rawContentVersion, 'death-consul-v170');
    assert.equal(summary.final.random.seed, 'corpsecollector-natural-v032');
    const budget = summary.captureBudget;
    assert.deepEqual(budget, integrity.captureBudget); assert.equal(budget.prefixTransitions, 815);
    assert.equal(budget.capturedSourceTransitions, 1); assert.equal(budget.continuationTransitions, summary.commands - 815);
    assert.equal(budget.exactExpectedBoundaries, summary.commands - 815 + 1);
    assert.equal(budget.actualBoundaries, budget.exactExpectedBoundaries); assert.equal(source.entries.length, budget.exactExpectedBoundaries);
    assert.equal(source.entries.length, options.expectedBoundaries); assert(source.entries.length <= budget.maximumBoundaries);
    assert.deepEqual(source.entries.map(row => row.name), summary.boundaries);
    assert.equal(fileEvidence(join(source.root, 'natural.json')).sha256, integrity.naturalSha256);
    assert.equal(fileEvidence(join(source.root, 'summary.json')).sha256, integrity.summarySha256);
    assert.equal(fileEvidence(join(source.root, 'commands.jsonl')).sha256, integrity.commandsSha256);
    assert.equal(fileEvidence(join(source.root, 'public.jsonl')).sha256, integrity.publicSha256);
    assert.equal(source.indexEvidence.sha256, integrity.indexSha256);
    assert.equal(fileEvidence(join(source.root, 'source-prefix.json')).sha256, integrity.sourcePrefixSha256);
    const prefix = json(join(source.root, 'source-prefix.json'));
    assert.equal(prefix.commandCount, 815); assert.equal(prefix.jsonStringifySha256, PREFIX_HASH);
    assert.equal(createHash('sha256').update(JSON.stringify(prefix.commands)).digest('hex'), PREFIX_HASH);
    const commandRows = readFileSync(join(source.root, 'commands.jsonl'), 'utf8').trimEnd().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const publicRows = readFileSync(join(source.root, 'public.jsonl'), 'utf8').trimEnd().split('\n').filter(Boolean).map(line => JSON.parse(line));
    assert.equal(commandRows.length, summary.commands); assert.equal(publicRows.length, summary.commands - 815);
    assert.deepEqual(commandRows.slice(0, 815).map(row => row.intent), prefix.commands, 'Full exact source command prefix');
    for (const [index, row] of commandRows.entries()) { assert.equal(row.step, index + 1); assert.equal(row.sourcePrefix, index < 815); }
    for (const [index, proof] of publicRows.entries()) {
      const row = commandRows[815 + index]; assert.equal(proof.step, row.step); assert.deepEqual(proof.command, row.intent);
      assert.equal(proof.control.enabled, true); assert.equal(proof.control.kind, row.intent.type);
      if (row.intent.command) assert.deepEqual(proof.control.command, row.intent.command);
      else { assert.equal(row.intent.type, 'COMBAT_ROUND'); assert.equal(proof.control.stance, 'CONTROL'); }
      assert.deepEqual(proof.randomBefore, row.before.random); assert.deepEqual(proof.randomAfter, row.after.random);
    }
    assert.equal(fileEvidence(fileURLToPath(new URL('./pale-emperor-stage.mjs', import.meta.url))).sha256, integrity.producerSha256, 'Producer remains frozen');
    const originalSource = resolve('tests/fixtures/death-consul-v01730/natural.json');
    assert.equal(fileEvidence(originalSource).sha256, SOURCE_HASH, 'Original source file remains byte-identical');
    const expectedFiles = [...new Set([...source.entries.map(row => row.filename), ...Object.values(summary.snapshots)])].sort();
    assert.deepEqual(Object.keys(integrity.files).sort(), expectedFiles, 'Integrity manifest covers every named capture and snapshot exactly');
    for (const filename of expectedFiles) {
      assert.equal(filename, basename(filename)); assert.equal(fileEvidence(join(source.root, filename)).sha256, integrity.files[filename], `Unchanged capture ${filename}`);
    }
    if (summary.stage === 'NATURAL_PALE_EMPEROR_PUBLIC_CONTINUATION') {
      assert.equal(summary.final.status, 'ACTIVE'); assert.equal(summary.final.sequence, 1); assert.equal(summary.final.acting, 100);
      assert(summary.boundaries.includes('actual-current-era-paid-work-after-living16m-exit'));
      for (const id of ['quiet-lid', 'guarded-carry', 'withdrawn-return']) assert.equal(summary.lifeCases[id].status, 'RESOLVED');
      assert.equal(summary.life.reflected, true); assert.equal(summary.life.playerLocation, 'RECEPTION'); assert.equal(summary.life.nora.present, false);
      assert.equal(summary.encounter.terminal.exitMetres, 4); assert.equal(summary.encounter.terminal.roadExitMetres, 12);
    } else if (summary.stage === 'NATURAL_FINITE_POTION_FAILURES_ALIVE_S2') {
      assert.equal(summary.final.status, 'ACTIVE'); assert.equal(summary.final.sequence, 2);
      assert.equal(summary.bottles.filter(bottle => bottle.status === 'CONSUMED').length, 12);
      assert(summary.bottles.filter(bottle => bottle.status === 'CONSUMED').every(bottle => ['FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome)));
      assert.equal(summary.rounds.length, 0);
    } else if (summary.stage === 'NATURAL_FINITE_ENCOUNTER_UNRESOLVED') {
      assert.equal(summary.final.status, 'ACTIVE'); assert.equal(summary.encounter.status, 'FIGHTING'); assert.equal(summary.encounter.terminal, null);
      assert.equal(summary.rounds.length, 90); assert(summary.rounds.every(round => round.stance === 'CONTROL'));
    } else {
      assert.equal(summary.final.status, 'DEAD'); assert.equal(summary.final.H, 0);
      assert.equal(summary.encounter.terminal.outcome, 'PLAYER_DEAD'); assert.equal(summary.encounter.terminal.exitMetres, 0); assert.equal(summary.encounter.terminal.roadExitMetres, 0);
      assert(!summary.boundaries.includes('actual-current-era-paid-work-after-living16m-exit'));
    }
    // Read one small independent boundary at a time, never an all-boundaries
    // JSON blob or all historical snapshots. Verify complete sequential coverage.
    for (const [index, entry] of source.entries.entries()) {
      const capture = json(entry.path);
      assert.equal(capture.commandCount, 815 + index, 'No omitted or duplicate continuation transition');
      assert.equal(capture.beforeLast.random.seed, 'corpsecollector-natural-v032'); assert.equal(capture.final.random.seed, 'corpsecollector-natural-v032');
      assert.equal(capture.final.revision, capture.beforeLast.revision + 1); assert.equal(capture.final.revision, capture.commandCount + 1);
      assert(capture.lastIntent && capture.beforeLast.status === 'ACTIVE');
      assert.deepEqual(capture.lastIntent, commandRows[capture.commandCount - 1].intent);
      if (index > 0) {
        const proof = publicRows[index - 1]; assert.equal(proof.revision, capture.beforeLast.revision);
        assert.deepEqual(proof.randomBefore, capture.beforeLast.random); assert.deepEqual(proof.randomAfter, capture.final.random);
      }
      global.gc?.();
    }
    const result = await verifySageBoundaries(options);
    assert.equal(result.fullIndexVerified, true); assert.equal(result.boundaries, budget.exactExpectedBoundaries);
    assert.equal(result.uniqueSourceFiles, result.boundaries); assert.equal(result.uniqueFinalStates, result.boundaries);
    assert.equal(fileEvidence(originalSource).sha256, SOURCE_HASH);
    for (const [filename, expected] of [['natural.json', integrity.naturalSha256], ['summary.json', integrity.summarySha256], ['commands.jsonl', integrity.commandsSha256], ['public.jsonl', integrity.publicSha256], ['boundaries.index.json', integrity.indexSha256], ['source-prefix.json', integrity.sourcePrefixSha256], ...Object.entries(integrity.files)]) assert.equal(fileEvidence(join(source.root, filename)).sha256, expected, `Still immutable after verification: ${filename}`);
    assert.deepEqual(fileEvidence(join(source.root, 'capture-integrity.json')), integrityBefore);
    console.log(JSON.stringify({ passed: true, stage: summary.stage, allNamedCaptures: result.boundaries, terminalBoundaries: result.terminalBoundaries, outputDir: result.outputDir }));
  }
} catch (error) { console.error(error); process.exitCode = 1; }
