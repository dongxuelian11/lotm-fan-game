#!/usr/bin/env node
// Restore the deliberately narrow regular-file/PAX fixture archive format.
// Requires Node.js 18+. No packages, shell, or external tar executable are used.
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createGunzip } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = 'tests/fixtures';
const ARCHIVE_ROOT = '诡秘';
const decoder = new TextDecoder('utf-8', { fatal: true });
const fail = (message) => { throw new Error(message); };
const integer = (n) => Number.isSafeInteger(n) && n >= 0;

function canonical(p) {
  return typeof p === 'string' && p.length > 0 &&
    !/[\\\x00-\x1f\x7f]/u.test(p) && !p.startsWith('/') &&
    p.split('/').every((part) => part !== '' && part !== '.' && part !== '..' && !part.includes(':'));
}

function options(argv) {
  const result = { manifest: path.join(HERE, 'manifest.json'), repo: path.resolve(HERE, '..'), prefixes: [], dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') { result.help = true; continue; }
    if (flag === '--dry-run') { result.dryRun = true; continue; }
    if (!['--manifest', '--repo', '--destination', '--only-prefix', '--max-bytes'].includes(flag)) fail(`Unknown argument: ${flag}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`);
    if (flag === '--only-prefix') {
      let prefix = value.replace(/\/+$/u, '');
      if (prefix !== FIXTURES && !prefix.startsWith(`${FIXTURES}/`)) prefix = `${FIXTURES}/${prefix}`;
      if (!canonical(prefix)) fail(`Unsafe fixture prefix: ${value}`);
      result.prefixes.push(prefix);
    } else if (flag === '--max-bytes') {
      if (!/^\d+$/u.test(value) || !integer(Number(value))) fail('--max-bytes must be a nonnegative integer');
      result.maxBytes = Number(value);
    } else result[flag.slice(2)] = path.resolve(value);
  }
  return result;
}

function validateManifest(manifest) {
  if (manifest?.format !== 'lotm-test-inputs-v1') fail('Unsupported manifest format');
  if (!Array.isArray(manifest.parts) || !manifest.parts.length ||
      !Array.isArray(manifest.fileEntries) || !manifest.fileEntries.length) fail('Manifest must contain nonempty parts and fileEntries arrays');
  const partNames = new Set();
  const entries = new Map();
  for (const part of manifest.parts) {
    if (!part || typeof part.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.tar\.gz$/u.test(part.name) ||
        !integer(part.bytes) || part.bytes === 0 || !/^[a-f0-9]{64}$/u.test(part.sha256 ?? '')) fail('Invalid part entry in manifest');
    if (partNames.has(part.name)) fail(`Duplicate archive part: ${part.name}`);
    partNames.add(part.name);
  }
  for (const entry of manifest.fileEntries) {
    if (!entry || !canonical(entry.path) || !entry.path.startsWith(`${FIXTURES}/`) ||
        !integer(entry.bytes) || !/^[a-f0-9]{64}$/u.test(entry.sha256 ?? '')) fail('Invalid file entry in manifest');
    if (entries.has(entry.path)) fail(`Duplicate manifest path: ${entry.path}`);
    entries.set(entry.path, entry);
  }
  for (const name of entries.keys()) {
    const components = name.split('/');
    while (components.length > 1) {
      components.pop();
      const ancestor = components.join('/');
      if (entries.has(ancestor)) fail(`File/directory collision in manifest: ${ancestor}`);
    }
  }
  return entries;
}

async function statMaybe(filename) {
  try { return await fs.lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function hashFile(filename) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filename)) digest.update(chunk);
  return digest.digest('hex');
}

// Resolve a user-chosen existing boundary once. Below that boundary, never follow
// symlinks. An explicit destination's parent must already exist.
async function destinationFor(args) {
  if (args.destination) {
    const boundary = await fs.realpath(path.dirname(args.destination));
    return { boundary, root: path.join(boundary, path.basename(args.destination)) };
  }
  const boundary = await fs.realpath(args.repo);
  return { boundary, root: path.join(boundary, 'tests', 'fixtures') };
}

async function safeParents(boundary, filename, create) {
  const relative = path.relative(boundary, path.dirname(filename));
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('Destination escapes its boundary');
  let cursor = boundary;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    let stat = await statMaybe(cursor);
    if (!stat && create) {
      try { await fs.mkdir(cursor, { mode: 0o755 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      stat = await fs.lstat(cursor);
    }
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) fail(`Unsafe destination directory: ${cursor}`);
  }
}

async function existingMatches(filename, entry) {
  const stat = await statMaybe(filename);
  if (!stat) return false;
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`Refusing non-regular destination: ${filename}`);
  if (stat.size !== entry.bytes || await hashFile(filename) !== entry.sha256) {
    fail(`Refusing to overwrite different existing file: ${filename}\nChoose an empty --destination directory to restore a separate copy.`);
  }
  return true;
}

// Reads payloads a chunk at a time; a 100+ MiB fixture is never buffered whole.
class TarReader {
  constructor(stream) { this.iterator = stream[Symbol.asyncIterator](); this.buffer = Buffer.alloc(0); this.offset = 0; this.ended = false; }
  async available() {
    while (this.offset === this.buffer.length && !this.ended) {
      const next = await this.iterator.next();
      this.ended = next.done;
      this.buffer = next.done ? Buffer.alloc(0) : next.value;
      this.offset = 0;
    }
    return !this.ended;
  }
  async consume(count, sink = null) {
    while (count > 0) {
      if (!await this.available()) fail('Truncated tar archive');
      const length = Math.min(count, this.buffer.length - this.offset);
      const chunk = this.buffer.subarray(this.offset, this.offset + length);
      if (sink) await sink(chunk);
      this.offset += length;
      count -= length;
    }
  }
  async read(count) {
    const result = Buffer.alloc(count);
    let offset = 0;
    await this.consume(count, (chunk) => { chunk.copy(result, offset); offset += chunk.length; });
    return result;
  }
  async zeroTail() {
    while (await this.available()) {
      if (this.buffer.subarray(this.offset).some((byte) => byte !== 0)) fail('Nonzero data after tar end marker');
      this.offset = this.buffer.length;
    }
  }
}

function field(header, start, length) {
  const bytes = header.subarray(start, start + length);
  const end = bytes.indexOf(0);
  return decoder.decode(end < 0 ? bytes : bytes.subarray(0, end));
}

function octal(header, start, length, label) {
  const value = field(header, start, length).trim();
  if (!/^[0-7]+$/u.test(value)) fail(`Unsupported tar ${label} encoding`);
  const number = Number.parseInt(value, 8);
  if (!integer(number)) fail(`Tar ${label} exceeds supported size`);
  return number;
}

function tarHeader(header) {
  const expected = octal(header, 148, 8, 'checksum');
  let actual = 0;
  for (let i = 0; i < header.length; i++) actual += i >= 148 && i < 156 ? 32 : header[i];
  if (expected !== actual) fail('Tar header checksum mismatch');
  const magic = header.subarray(257, 263).toString('ascii');
  if (magic !== 'ustar\0' && magic !== 'ustar ') fail('Unsupported tar format; expected USTAR/PAX');
  const prefix = field(header, 345, 155);
  const name = field(header, 0, 100);
  return { name: prefix ? `${prefix}/${name}` : name, bytes: octal(header, 124, 12, 'size'), type: header[156], link: field(header, 157, 100) };
}

function paxFields(buffer) {
  const result = Object.create(null);
  const allowed = new Set(['path', 'size', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname', 'comment']);
  let offset = 0;
  while (offset < buffer.length) {
    const space = buffer.indexOf(32, offset);
    if (space < 0 || space - offset > 12) fail('Invalid PAX record length');
    const digits = buffer.subarray(offset, space).toString('ascii');
    if (!/^[1-9]\d*$/u.test(digits)) fail('Invalid PAX record length');
    const length = Number(digits);
    const end = offset + length;
    if (!integer(length) || end > buffer.length || end <= space + 1 || buffer[end - 1] !== 10) fail('Truncated PAX record');
    const record = decoder.decode(buffer.subarray(space + 1, end - 1));
    const separator = record.indexOf('=');
    if (separator <= 0) fail('Invalid PAX record');
    const key = record.slice(0, separator);
    if (!allowed.has(key) || Object.hasOwn(result, key)) fail(`Unsupported or duplicate PAX field: ${key}`);
    result[key] = record.slice(separator + 1);
    offset = end;
  }
  if (result.size !== undefined && (!/^\d+$/u.test(result.size) || !integer(Number(result.size)))) fail('Invalid PAX size');
  return result;
}

async function writeFully(handle, chunk) {
  let offset = 0;
  while (offset < chunk.length) {
    const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
    if (!bytesWritten) fail('Could not write fixture payload');
    offset += bytesWritten;
  }
}

async function restorePart(filename, context) {
  const source = createReadStream(filename);
  const unzip = createGunzip();
  source.on('error', (error) => unzip.destroy(error));
  source.pipe(unzip);
  const reader = new TarReader(unzip);
  let pending = null;
  try {
    while (true) {
      const raw = await reader.read(512);
      if (raw.every((byte) => byte === 0)) {
        if (pending) fail('PAX metadata has no following file');
        if (!(await reader.read(512)).every((byte) => byte === 0)) fail('Missing second tar end block');
        await reader.zeroTail();
        break;
      }
      const header = tarHeader(raw);
      if (header.type === 120) { // Local PAX x header, as produced by Python tarfile.
        if (pending || header.bytes > 1024 * 1024 || header.link) fail('Unsupported PAX metadata entry');
        pending = paxFields(await reader.read(header.bytes));
        await reader.consume((512 - header.bytes % 512) % 512);
        continue;
      }
      if ((header.type !== 0 && header.type !== 48) || header.link) fail(`Unsafe/unsupported tar entry type ${header.type}: ${header.name}`);
      const archiveName = pending?.path ?? header.name;
      const size = pending?.size === undefined ? header.bytes : Number(pending.size);
      pending = null;
      if (!canonical(archiveName) || !archiveName.startsWith(`${ARCHIVE_ROOT}/${FIXTURES}/`)) fail(`Unsafe archive member: ${archiveName}`);
      const relative = archiveName.slice(ARCHIVE_ROOT.length + 1);
      const entry = context.entries.get(relative);
      if (!entry || entry.bytes !== size) fail(`Archive member does not match manifest: ${relative}`);
      if (context.seen.has(relative)) fail(`Duplicate archive member: ${relative}`);
      context.seen.add(relative);
      const selected = context.selected.has(relative);
      const target = path.join(context.destination.root, ...relative.slice(FIXTURES.length + 1).split('/'));
      let temporary = null;
      let handle = null;
      const digest = createHash('sha256');
      try {
        if (selected && !context.args.dryRun) {
          await safeParents(context.destination.boundary, target, true);
          if (!await existingMatches(target, entry)) {
            temporary = path.join(path.dirname(target), `.fixture-restore-${randomBytes(12).toString('hex')}.tmp`);
            handle = await fs.open(temporary, 'wx', 0o600);
          }
        }
        await reader.consume(size, async (chunk) => {
          digest.update(chunk);
          if (handle) await writeFully(handle, chunk);
        });
        if (digest.digest('hex') !== entry.sha256) fail(`Fixture SHA-256 mismatch: ${relative}`);
        await reader.consume((512 - size % 512) % 512);
        if (handle) {
          await handle.chmod(0o644);
          await handle.sync();
          await handle.close();
          handle = null;
          await safeParents(context.destination.boundary, target, false);
          // An atomic no-clobber install. Unlike rename(), link() cannot replace
          // a file another process creates between our check and installation.
          try { await fs.link(temporary, target); context.restored++; }
          catch (error) {
            if (error.code !== 'EEXIST') throw error;
            if (!await existingMatches(target, entry)) throw error;
            context.skipped++;
          }
        } else if (selected && !context.args.dryRun) context.skipped++;
      } finally {
        if (handle) await handle.close();
        if (temporary) await fs.unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
      }
    }
  } finally {
    source.destroy();
    unzip.destroy();
  }
}

async function main() {
  const args = options(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node test-inputs/restore-test-inputs.mjs [--repo PATH] [--destination PATH]\n  [--manifest PATH] [--only-prefix DIRECTORY ...] [--max-bytes N] [--dry-run]\nRepeat --only-prefix for multiple directories. Prefixes are relative to tests/fixtures.\nWithout --only-prefix, all fixtures are restored. Existing identical files are kept.');
    return;
  }
  const manifest = JSON.parse(await fs.readFile(args.manifest, 'utf8'));
  const entries = validateManifest(manifest);
  const selected = new Map([...entries].filter(([name]) => !args.prefixes.length || args.prefixes.some((prefix) => name.startsWith(`${prefix}/`))));
  if (!selected.size) fail('No fixture files match the requested directory prefixes');
  for (const prefix of args.prefixes) {
    if (![...selected.keys()].some((name) => name.startsWith(`${prefix}/`))) fail(`No fixture files match directory prefix: ${prefix}`);
  }
  const bytes = [...selected.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  if (!integer(bytes)) fail('Selected fixture byte total exceeds supported size');
  if (args.maxBytes !== undefined && bytes > args.maxBytes) fail(`Selection is ${bytes} bytes, above --max-bytes ${args.maxBytes}`);
  const destination = await destinationFor(args);
  console.log(`${args.dryRun ? 'Checking' : 'Restoring'} ${selected.size} fixture files (${bytes} bytes) to ${destination.root}`);
  // Check EVERY compressed part before any destination mutation, including for
  // prefix-only runs. The archive parts remain independently reproducible.
  const partsDir = path.dirname(args.manifest);
  for (const part of manifest.parts) {
    const filename = path.join(partsDir, part.name);
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== part.bytes || await hashFile(filename) !== part.sha256) fail(`Archive part size/SHA-256 mismatch: ${part.name}`);
    console.log(`Verified archive: ${part.name}`);
  }
  // Fail before extraction if any selected existing fixture differs.
  for (const entry of selected.values()) {
    const target = path.join(destination.root, ...entry.path.slice(FIXTURES.length + 1).split('/'));
    await safeParents(destination.boundary, target, false);
    await existingMatches(target, entry);
  }
  const context = { args, destination, entries, selected, seen: new Set(), restored: 0, skipped: 0 };
  for (const part of manifest.parts) {
    await restorePart(path.join(partsDir, part.name), context);
    console.log(`Validated fixture contents: ${part.name}`);
  }
  if (context.seen.size !== entries.size) {
    const missing = [...entries.keys()].find((name) => !context.seen.has(name));
    fail(`Manifest fixture is missing from all archive parts: ${missing}`);
  }
  console.log(args.dryRun
    ? `Check complete: all ${entries.size} fixture hashes verified; ${selected.size} files selected; no files written.`
    : `Restore complete: ${context.restored} files restored, ${context.skipped} identical files kept; all ${entries.size} fixture hashes verified.`);
}

main().catch((error) => { console.error(`Fixture restore failed: ${error.message}`); process.exitCode = 1; });
