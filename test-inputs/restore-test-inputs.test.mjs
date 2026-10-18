// Small generated archives only. Run: node --test test-inputs/restore-test-inputs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const RESTORE = fileURLToPath(new URL('./restore-test-inputs.mjs', import.meta.url));
const ROOT = '诡秘';
const sha = (data) => createHash('sha256').update(data).digest('hex');
const fixture = (name, text = name) => ({ path: `tests/fixtures/${name}`, data: Buffer.from(text) });

function header(name, size, type = '0', link = '') {
  const block = Buffer.alloc(512);
  const put = (text, at, length) => block.write(text, at, length, 'ascii');
  put(name, 0, 100);
  put('0000644\0', 100, 8);
  put('0000000\0', 108, 8);
  put('0000000\0', 116, 8);
  put(`${size.toString(8).padStart(11, '0')}\0`, 124, 12);
  put('00000000000\0', 136, 12);
  block.fill(32, 148, 156);
  put(type, 156, 1);
  put(link, 157, 100);
  put('ustar\0', 257, 6);
  put('00', 263, 2);
  const checksum = block.reduce((sum, value) => sum + value, 0);
  put(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  return block;
}

function paxRecord(key, value) {
  const body = `${key}=${value}\n`;
  let length = Buffer.byteLength(body) + 2;
  while (true) {
    const record = Buffer.from(`${length} ${body}`);
    if (record.length === length) return record;
    length = record.length;
  }
}

function tar(entries) {
  const blocks = [];
  const add = (head, body) => blocks.push(head, body, Buffer.alloc((512 - body.length % 512) % 512));
  for (const entry of entries) {
    const name = entry.archiveName ?? `${ROOT}/${entry.path}`;
    const metadata = Buffer.concat([paxRecord('path', name), ...(entry.pax ?? []).map(([key, value]) => paxRecord(key, value))]);
    add(header('././@PaxHeader', metadata.length, 'x'), metadata);
    add(header('placeholder', entry.data.length, entry.type ?? '0', entry.link ?? ''), entry.data);
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

async function setup(t, groups, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fixture-restore-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  const inputs = path.join(root, 'test-inputs');
  await fs.mkdir(repo);
  await fs.mkdir(inputs);
  const parts = [];
  for (let i = 0; i < groups.length; i++) {
    let payload = tar(groups[i]);
    if (options.mutateTar) payload = options.mutateTar(payload);
    const compressed = gzipSync(payload);
    const name = `fixtures-part-${i + 1}.tar.gz`;
    await fs.writeFile(path.join(inputs, name), compressed);
    parts.push({ name, bytes: compressed.length, sha256: sha(compressed) });
  }
  const fileEntries = (options.manifestEntries ?? groups.flat()).map((entry) => ({ path: entry.path, bytes: entry.data.length, sha256: sha(entry.data) }));
  const manifest = path.join(inputs, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify({ format: 'lotm-test-inputs-v1', parts, fileEntries }));
  return { root, repo, inputs, manifest, target: (name) => path.join(repo, 'tests', 'fixtures', name) };
}

function run(context, args = [], error = null) {
  const result = spawnSync(process.execPath, [RESTORE, '--repo', context.repo, '--manifest', context.manifest, ...args], { encoding: 'utf8', timeout: 30_000 });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  if (error) { assert.notEqual(result.status, 0, output); assert.match(output, error); }
  else assert.equal(result.status, 0, output);
  return output;
}

async function absent(filename) {
  await assert.rejects(fs.lstat(filename), { code: 'ENOENT' });
}

test('full restore handles multiple parts, Unicode/PAX long paths, empty files, and safe reruns', async (t) => {
  const longName = `long/${'中文'.repeat(40)}/sample.json`;
  const files = [fixture('campaign/first.json', '{"one":1}'), fixture(longName, '{"long":true}'), fixture('empty/file.json', '')];
  const ctx = await setup(t, [[files[0]], files.slice(1)]);
  run(ctx);
  for (const file of files) assert.deepEqual(await fs.readFile(path.join(ctx.repo, file.path)), file.data);
  assert.match(run(ctx), /0 files restored, 3 identical files kept/u);
});

test('repeated directory prefixes are bounded and do not include a similarly named directory', async (t) => {
  const files = [fixture('campaign/a.json', 'a'), fixture('campaign-extra/b.json', 'b'), fixture('nested/keep/c.json', 'c')];
  const ctx = await setup(t, [[files[0], files[1]], [files[2]]]);
  const output = run(ctx, ['--only-prefix', 'campaign', '--only-prefix', 'tests/fixtures/nested/keep/', '--max-bytes', '2']);
  assert.match(output, /all 3 fixture hashes verified/u);
  assert.equal(await fs.readFile(ctx.target('campaign/a.json'), 'utf8'), 'a');
  assert.equal(await fs.readFile(ctx.target('nested/keep/c.json'), 'utf8'), 'c');
  await absent(ctx.target('campaign-extra'));
});

test('dry run verifies content without creating fixture directories', async (t) => {
  const ctx = await setup(t, [[fixture('campaign/a.json')]]);
  assert.match(run(ctx, ['--dry-run']), /no files written/u);
  await absent(path.join(ctx.repo, 'tests'));
});

test('output byte limit and nonexistent prefixes fail without creating fixtures', async (t) => {
  const ctx = await setup(t, [[fixture('campaign/a.json', 'abcdef')]]);
  run(ctx, ['--max-bytes', '5'], /above --max-bytes/u);
  run(ctx, ['--only-prefix', 'missing'], /No fixture files match/u);
  await absent(path.join(ctx.repo, 'tests'));
});

test('all part checksums are verified before any selected file is written', async (t) => {
  const ctx = await setup(t, [[fixture('selected/a.json')], [fixture('other/b.json')]]);
  const badPart = path.join(ctx.inputs, 'fixtures-part-2.tar.gz');
  const data = await fs.readFile(badPart);
  data[data.length - 1] ^= 1;
  await fs.writeFile(badPart, data);
  run(ctx, ['--only-prefix', 'selected'], /Archive part size\/SHA-256 mismatch/u);
  await absent(path.join(ctx.repo, 'tests'));
});

test('differing existing files are preserved; explicit separate destination succeeds', async (t) => {
  const ctx = await setup(t, [[fixture('campaign/a.json', 'archive')]]);
  await fs.mkdir(path.dirname(ctx.target('campaign/a.json')), { recursive: true });
  await fs.writeFile(ctx.target('campaign/a.json'), 'user edit');
  run(ctx, [], /Refusing to overwrite different existing file/u);
  assert.equal(await fs.readFile(ctx.target('campaign/a.json'), 'utf8'), 'user edit');
  const separate = path.join(ctx.root, 'separate-fixtures');
  run(ctx, ['--destination', separate]);
  assert.equal(await fs.readFile(path.join(separate, 'campaign/a.json'), 'utf8'), 'archive');
});

test('path traversal in PAX metadata is rejected', async (t) => {
  const ctx = await setup(t, [[{ ...fixture('safe/a.json'), archiveName: `${ROOT}/tests/fixtures/../../escaped.json` }]]);
  run(ctx, [], /Unsafe archive member/u);
  await absent(path.join(ctx.repo, 'escaped.json'));
});

for (const [type, name] of [['2', 'symbolic link'], ['1', 'hard link'], ['g', 'global PAX'], ['5', 'directory'], ['3', 'device']]) {
  test(`rejects unsupported ${name} archive entries`, async (t) => {
    const ctx = await setup(t, [[{ ...fixture('safe/a.json', ''), type, link: type === '1' || type === '2' ? '/tmp/unwanted' : '' }]]);
    run(ctx, [], /Unsafe\/unsupported tar entry type/u);
    await absent(ctx.target('safe/a.json'));
  });
}

test('rejects symlinked destination directories and files', { skip: process.platform === 'win32' }, async (t) => {
  const ctx = await setup(t, [[fixture('safe/a.json', 'archive')]]);
  const outside = path.join(ctx.root, 'outside');
  await fs.mkdir(outside);
  await fs.mkdir(path.join(ctx.repo, 'tests', 'fixtures'), { recursive: true });
  await fs.symlink(outside, ctx.target('safe'));
  run(ctx, [], /Unsafe destination directory/u);
  await absent(path.join(outside, 'a.json'));
  await fs.unlink(ctx.target('safe'));
  await fs.mkdir(ctx.target('safe'));
  await fs.writeFile(path.join(outside, 'a.json'), 'archive');
  await fs.symlink(path.join(outside, 'a.json'), ctx.target('safe/a.json'));
  run(ctx, [], /Refusing non-regular destination/u);
});

test('fixture content hash mismatch never installs the invalid file', async (t) => {
  const ctx = await setup(t, [[fixture('safe/a.json', 'wrong')]], { manifestEntries: [fixture('safe/a.json', 'right')] });
  run(ctx, [], /Fixture SHA-256 mismatch/u);
  await absent(ctx.target('safe/a.json'));
  assert.deepEqual(await fs.readdir(ctx.target('safe')), []);
});

test('header checksum mismatch fails even when the compressed part checksum is valid', async (t) => {
  const ctx = await setup(t, [[fixture('safe/a.json')]], { mutateTar: (data) => { data[0] ^= 1; return data; } });
  run(ctx, [], /Tar header checksum mismatch/u);
});

test('rejects unrecognized PAX link metadata', async (t) => {
  const ctx = await setup(t, [[{ ...fixture('safe/a.json'), pax: [['linkpath', '/tmp/unwanted']] }]]);
  run(ctx, [], /Unsupported or duplicate PAX field: linkpath/u);
});

test('detects missing manifest files and duplicate archive members', async (t) => {
  const one = fixture('safe/a.json');
  const missing = await setup(t, [[one]], { manifestEntries: [one, fixture('safe/missing.json')] });
  run(missing, [], /Manifest fixture is missing/u);
  const duplicate = await setup(t, [[one, one]], { manifestEntries: [one] });
  run(duplicate, [], /Duplicate archive member/u);
});
