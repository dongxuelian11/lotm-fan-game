// Fixed public 85de candidate only. No download, production hook, or player save input.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
export const SOURCE = '85de5c0a60ec179f909573c0e014b0d52c420b5e';
export const ZIP_HASH = 'a450c161f08213838c958877384f1a8ac43322a3c8579597c598b7c1720e19c1';
const MANIFEST_HASH = '16447b5ed7ed2c029fedd6697304d888145a389457771b6a95adbd35ab4764b3';
const self = fileURLToPath(import.meta.url);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
export function safePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('\\') &&
    !value.includes(':') && !value.includes('\0') &&
    value.split('/').every(part => part && part !== '.' && part !== '..');
}
function inventory(root, dir = root) {
  return readdirSync(dir).flatMap(name => {
    const file = join(dir, name), stat = lstatSync(file);
    assert(!stat.isSymbolicLink(), 'Symlinks are not accepted');
    assert(stat.isDirectory() || stat.isFile(), 'Special files are not accepted');
    return stat.isDirectory() ? inventory(root, file) : [relative(root, file).replaceAll('\\', '/')];
  }).sort();
}
export function verifyCandidate(directory, archive) {
  const root = resolve(directory);
  assert.equal(hash(archive), ZIP_HASH, 'Not the fixed published ZIP');
  const manifestFile = join(root, 'candidate-manifest.json');
  assert.equal(hash(manifestFile), MANIFEST_HASH, 'Manifest differs from published candidate');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  assert.equal(manifest.sourceCommit, SOURCE);
  assert.equal(manifest.electron, '44.0.0');
  assert.equal(manifest.platform, 'win32-x64');
  assert.equal(manifest.files.length, 1681);
  const paths = manifest.files.map(entry => entry.path);
  assert(paths.every(safePath), 'Unsafe manifest path');
  assert.equal(new Set(paths.map(p => p.toLowerCase())).size, paths.length, 'Duplicate Windows path');
  assert.deepEqual(inventory(root), [...paths, 'candidate-manifest.json'].sort(), 'Package file inventory changed');
  for (const entry of manifest.files) assert.equal(hash(join(root, entry.path)), entry.sha256, `Changed file: ${entry.path}`);
  return root;
}
export function requireWindows(platform = process.platform) {
  assert.equal(platform, 'win32', 'Windows execution NOT_RUN: use --verify-only for static checks on other platforms');
}
function phase(root, evidence, name) {
  requireWindows();
  assert.equal(process.arch, 'x64');
  assert.equal(process.versions.electron, '44.0.0', 'Must use candidate Electron runtime');
  assert.equal(resolve(process.execPath).toLowerCase(), join(root, 'lotm-fan-game.exe').toLowerCase());
  assert(['create', 'recover'].includes(name));
  const require = createRequire(join(root, 'resources/app/package.json'));
  const { SqliteSliceStore } = require('./dist/persistence/slice-store.js');
  const { sliceDefaultCreationSelection } = require('./dist/content/slice-creation.js');
  const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result.error)); return result.value; };
  assert.equal(readFileSync(join(evidence, 'probe-owner.txt'), 'utf8'), SOURCE, 'Not a probe-owned directory');
  const database = join(evidence, 'synthetic.sqlite');
  assert.equal(existsSync(database), name === 'recover', 'Refuse existing database for create or missing database for recovery');
  const store = new SqliteSliceStore(database);
  try {
    if (name === 'create') {
      assert.equal(unwrap(store.getBootstrap()).activeState, null);
      const command = { intentId: 'candidate-synthetic-create', runId: null, expectedRevision: 0,
        payload: { type: 'CREATE', selection: sliceDefaultCreationSelection } };
      const receipt = unwrap(store.submitIntent(command));
      assert(receipt.state.activeEvent);
      writeFileSync(join(evidence, 'synthetic-receipt.json'), JSON.stringify({ command, state: receipt.state }));
    } else {
      const prior = JSON.parse(readFileSync(join(evidence, 'synthetic-receipt.json'), 'utf8'));
      assert.deepEqual(unwrap(store.getBootstrap()).activeState, prior.state);
      const receipt = unwrap(store.submitIntent(prior.command));
      assert.equal(receipt.replayed, true);
      assert.deepEqual(receipt.state, prior.state);
    }
  } finally { store.close(); }
  console.log(`CANDIDATE_WINDOWS_NODE_${name.toUpperCase()}_PASS`);
}
function main(args) {
  if (args[0] === '--phase') {
    assert.equal(args.length, 4, 'Internal phase requires phase, candidate and evidence');
    return phase(resolve(args[2]), resolve(args[3]), args[1]);
  }
  const verifyOnly = args[0] === '--verify-only';
  if (verifyOnly) args = args.slice(1);
  assert.equal(args.length, 2, 'Usage: node scripts/check-windows-candidate.mjs [--verify-only] <extracted-candidate-directory> <published.zip>');
  // Reject unsupported execution before opening or creating any files.
  if (!verifyOnly) requireWindows();
  const root = verifyCandidate(args[0], args[1]);
  if (verifyOnly) {
    console.log('FIXED_CANDIDATE_STATIC_PASS; WINDOWS_RUNTIME=NOT_RUN; GUI=NOT_RUN');
    return;
  }
  const evidence = mkdtempSync(join(tmpdir(), 'lotm-候选验证-'));
  writeFileSync(join(evidence, 'probe-owner.txt'), SOURCE, { flag: 'wx' });
  console.log(`Synthetic local evidence retained: ${evidence}`);
  const summary = { sourceCommit: SOURCE, zipSha256: ZIP_HASH, platform: process.platform,
    runtimePersistence: 'FAILED', gui: 'NOT_RUN', phases: [] };
  try {
    for (const name of ['create', 'recover']) {
      const child = spawnSync(join(root, 'lotm-fan-game.exe'), [self, '--phase', name, root, evidence], {
        cwd: evidence, timeout: 60000, encoding: 'utf8', maxBuffer: 1024 * 1024,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '', NODE_PATH: '',
          LOTM_TEST_USER_DATA: evidence, ELECTRON_ENABLE_LOGGING: '1' },
      });
      writeFileSync(join(evidence, `${name}.log`), `${child.stdout || ''}\n${child.stderr || ''}\n${child.error?.message || ''}`);
      assert(!child.error, `${name}: ${child.error?.message}`);
      assert.equal(child.status, 0, `${name} failed; inspect local log`);
      assert(child.stdout.includes(`CANDIDATE_WINDOWS_NODE_${name.toUpperCase()}_PASS`), 'Missing phase proof');
      summary.phases.push(name);
    }
    verifyCandidate(root, args[1]);
    summary.runtimePersistence = 'PASS';
  } finally {
    writeFileSync(join(evidence, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  console.log('WINDOWS_CANDIDATE_RUNTIME_SQLITE_RESTART_PASS; PRODUCTION_GUI=NOT_RUN; VISUAL_QA=NOT_RUN');
}
if (process.argv[1] && resolve(process.argv[1]) === self) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
