// Assemble data only. Never launches Electron; Windows QA is a separate step.
import { existsSync, mkdirSync, readdirSync, lstatSync, readFileSync, writeFileSync, copyFileSync, renameSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [runtimeArg, outputArg, commit] = process.argv.slice(2);
function assert(ok, message) { if (!ok) throw new Error(message); }
assert(runtimeArg && outputArg && /^[a-f0-9]{40}$/.test(commit ?? ''),
  'Usage: node scripts/assemble-windows-portable.mjs <official-runtime-cache> <NEW-output-dir> <frozen-40-char-commit>');
const run = (exe, args, cwd = root) => execFileSync(exe, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const runtime = resolve(runtimeArg), output = resolve(outputArg);
assert(!existsSync(output), 'Output must be a new directory; existing files are never overwritten.');
assert(run('git', ['rev-parse', 'HEAD']).trim() === commit, 'HEAD differs from frozen source commit.');
assert(run('git', ['diff', 'HEAD', '--name-only']).trim() === '', 'Tracked source changes must be committed before packaging.');
const untrackedInputs = run('git', ['ls-files', '--others', '--', 'src', 'public', 'scripts', 'package*.json', 'tsconfig*.json', 'vite.config.*', 'index.html']).trim();
assert(!untrackedInputs, `Build inputs must belong to frozen commit: ${untrackedInputs}`);
const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
assert(pkg.name === 'lotm-fan-game' && pkg.version === '0.229.0', 'Review application identity/version before changing packaging.');
assert(pkg.devDependencies.electron === '44.0.0' && pkg.dependencies['@noble/hashes'] === '1.8.0', 'Review changed runtime dependencies.');
const zipName = 'electron-v44.0.0-win32-x64.zip';
const zip = join(runtime, zipName);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sums = readFileSync(join(runtime, 'SHASUMS256.txt'), 'utf8');
const expected = sums.split(/\r?\n/).map(line => line.trim().split(/\s+\*?/)).find(parts => parts[1] === zipName)?.[0];
assert(expected && hash(zip) === expected, 'Electron archive must match official SHASUMS256.txt.');
const entries = run('unzip', ['-Z1', zip]).trim().split('\n');
assert(entries.every(p => !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..')), 'Unsafe archive paths.');
assert(run('unzip', ['-p', zip, 'version']).trim() === '44.0.0', 'Wrong Electron version.');
// Always rebuild this checkout, never copy another worktree’s potentially stale dist.
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
mkdirSync(output);
const name = `lotm-fan-game-${pkg.version}-${commit.slice(0, 7)}-windows-x64-candidate`;
const bundle = join(output, name), app = join(bundle, 'resources', 'app');
mkdirSync(bundle);
run('unzip', ['-q', zip, '-d', bundle]);
assert(!existsSync(app), 'Official runtime unexpectedly contains resources/app.');
mkdirSync(app);
const forbidden = /(^|\/)(?:\.git(?:hub-device-config)?|\.env[^/]*|tests?|test-inputs|novel|private|saves?|userdata|output|coverage)(\/|$)|\.(?:db|sqlite\d*|bak|sealed|pem|key)(?:$|[-.])/i;
function files(dir) {
  return readdirSync(dir).sort().flatMap(n => {
    const p = join(dir, n), stat = lstatSync(p);
    assert(!stat.isSymbolicLink(), `Refusing symlink: ${p}`);
    assert(stat.isFile() || stat.isDirectory(), `Refusing special file: ${p}`);
    return stat.isDirectory() ? files(p) : [p];
  });
}
function copy(source, target) {
  assert(!relative(app, target).split(/[\\/]/).some(p => p.startsWith('.')) && !forbidden.test(relative(app, target).replaceAll('\\', '/')), `Forbidden runtime path: ${target}`);
  mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
}
const compiled = ['application', 'content', 'domain', 'main', 'persistence', 'resolution', 'shared', 'simulation'];
assert(readdirSync(join(root, 'dist')).every(n => [...compiled, 'renderer'].includes(n)), 'Unexpected dist root.');
for (const folder of compiled) for (const p of files(join(root, 'dist', folder))) {
  assert(/\.js(?:\.map)?$/.test(p), `Unexpected compiled file: ${p}`);
  if (p.endsWith('.js')) copy(p, join(app, relative(root, p)));
}
for (const p of files(join(root, 'dist', 'renderer'))) {
  assert(/\.(?:html|js|css|webp|png|woff|woff2|txt|json)$/.test(p), `Unexpected renderer asset: ${p}`);
  copy(p, join(app, relative(root, p)));
}
// Only the actual unbundled runtime dependency, not development node_modules.
const noble = join(root, 'node_modules', '@noble', 'hashes');
assert(JSON.parse(readFileSync(join(noble, 'package.json'))).version === '1.8.0', 'Wrong noble runtime.');
for (const p of files(noble)) {
  const rel = relative(noble, p).replaceAll('\\', '/');
  if (/^(?:[^/]+\.js|package\.json|LICENSE|esm\/(?:[^/]+\.js|package\.json))$/.test(rel))
    copy(p, join(app, 'node_modules', '@noble', 'hashes', rel));
}
for (const p of ['LICENSE', 'NOTICE']) copy(join(root, p), join(app, p));
for (const dep of ['react', 'react-dom', 'scheduler'])
  copy(join(root, 'node_modules', dep, 'LICENSE'), join(app, 'licenses', `${dep}-LICENSE`));
writeFileSync(join(app, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version,
  private: true, main: pkg.main, license: pkg.license, dependencies: { '@noble/hashes': '1.8.0' } }, null, 2) + '\n');
// All static CommonJS runtime imports must resolve inside the packaged application.
for (const folder of compiled) for (const p of files(join(app, 'dist', folder))) {
  const req = createRequire(p);
  for (const [, spec] of readFileSync(p, 'utf8').matchAll(/require\(["']([^"']+)["']\)/g)) {
    if (spec === 'electron' || spec.startsWith('node:')) continue;
    assert(spec.startsWith('.') || spec.startsWith('@noble/hashes/'), `Unexpected external import: ${spec}`);
    assert(req.resolve(spec).startsWith(app + '/'), `Import escaped package: ${spec}`);
  }
}
for (const p of files(join(root, 'public'))) assert(hash(p) === hash(join(app, 'dist', 'renderer', relative(join(root, 'public'), p))), `Public asset mismatch: ${p}`);
renameSync(join(bundle, 'electron.exe'), join(bundle, 'lotm-fan-game.exe'));
writeFileSync(join(bundle, '候选运行说明.txt'), `诡秘之主同人游戏 ${pkg.version} Windows x64 候选\n完整解压后双击 lotm-fan-game.exe；不要在 ZIP 内运行或单独移动 exe。\n这是未签名、未完成 Windows 实机验收的候选，不是正式发行版。Windows QA: NOT_RUN。\n存档仍在系统用户数据目录 lotm-fan-game/playable-slice.sqlite，不随程序目录移动；升级前关闭游戏并另行备份整个存档目录。不要同时打开两个版本。\n本包不带任何玩家存档。\n源码提交：${commit}\n`);
const manifest = { version: pkg.version, sourceCommit: commit, electron: '44.0.0', platform: 'win32-x64',
  runtimeZipSha256: expected, windowsQA: 'NOT_RUN', files: files(bundle).map(p => ({ path: relative(bundle, p).replaceAll('\\', '/'), sha256: hash(p) })) };
writeFileSync(join(bundle, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
run('zip', ['-q', '-r', `${name}.zip`, name], output);
const archive = join(output, `${name}.zip`);
const archived = run('unzip', ['-Z1', archive]).trim().split('\n').filter(p => !p.endsWith('/'));
const expectedFiles = [...manifest.files.map(f => `${name}/${f.path}`), `${name}/candidate-manifest.json`].sort();
assert(JSON.stringify(archived.sort()) === JSON.stringify(expectedFiles), 'Archive manifest paths mismatch.');
run('unzip', ['-tq', archive]);
assert(archived.every(p => !forbidden.test(p)), 'Forbidden data in archive.');
writeFileSync(`${archive}.sha256`, `${hash(archive)}  ${name}.zip\n`);
console.log(JSON.stringify({ archive, sha256: hash(archive), files: archived.length, windowsQA: 'NOT_RUN' }));
