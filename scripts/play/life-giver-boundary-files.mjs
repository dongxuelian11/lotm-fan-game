import assert from 'node:assert/strict';
import {appendFileSync, closeSync, createReadStream, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import {Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';

const FORMAT = 'life-giver-boundary-shards-v1';
const INDEX_NAME = 'boundaries.index.json';
const ENTRIES_PER_PART = 16;
const MAX_GZIP_BYTES = 15_000_000;

/** This index is only fixture storage metadata, not a game/save schema. */
function readIndex(root) {
  const index = JSON.parse(readFileSync(join(root, INDEX_NAME), 'utf8'));
  assert.equal(index.format, FORMAT, 'Unsupported LifeGiver boundary index');
  assert(index.entries && typeof index.entries === 'object' && !Array.isArray(index.entries));
  assert(Array.isArray(index.parts));
  return index;
}

function partPath(root, file) {
  assert(typeof file === 'string' && /^boundary-parts-[A-Za-z0-9]+\/part-\d{2,}\.json$/.test(file),
    `Invalid LifeGiver boundary part: ${file}`);
  return join(root, file);
}

/** Resolve a small index first; the caller still streams only the selected entry. */
export function lifeGiverBoundaryFile(root, key) {
  const index = readIndex(root);
  assert(Object.hasOwn(index.entries, key), `Missing LifeGiver boundary: ${key}`);
  return partPath(root, index.entries[key]);
}

/** Iterate complete object-valued boundaries, retaining only one raw value at a
 * time. Strings, escapes and UTF-8 chunk boundaries must survive byte-for-byte.
 * This is deliberately scoped to the 0.168 boundary documents, not all fixtures. */
export function* lifeGiverBoundaryEntries(path) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START', keyText = '', key = '', quoted = false, escaped = false, depth = 0;
  const pieces = [], seen = new Set();
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      const text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'END') { assert(/\s/.test(c), 'Unexpected trailing boundary data'); continue; }
        if (phase === 'START') {
          if (/\s/.test(c)) continue;
          assert.equal(c, '{', 'Expected a top-level boundary object'); phase = 'FIRST_KEY'; continue;
        }
        if (phase === 'FIRST_KEY' || phase === 'KEY') {
          if (/\s/.test(c)) continue;
          if (c === '}' && phase === 'FIRST_KEY') { phase = 'END'; continue; }
          assert.equal(c, '"', 'Expected a boundary key');
          keyText = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          keyText += c;
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') {
            key = JSON.parse(keyText); assert(!seen.has(key), `Duplicate boundary key: ${key}`);
            seen.add(key); phase = 'COLON';
          }
          continue;
        }
        if (phase === 'COLON') {
          if (/\s/.test(c)) continue;
          assert.equal(c, ':', 'Expected a boundary colon'); phase = 'VALUE_START'; continue;
        }
        if (phase === 'AFTER_VALUE') {
          if (/\s/.test(c)) continue;
          if (c === ',') phase = 'KEY';
          else { assert.equal(c, '}', 'Expected the next boundary or object end'); phase = 'END'; }
          continue;
        }
        if (phase === 'VALUE_START') {
          if (/\s/.test(c)) continue;
          assert.equal(c, '{', 'Every LifeGiver boundary must be an object');
          captureStart = i; depth = 0; quoted = false; escaped = false; phase = 'VALUE';
        }
        if (phase === 'VALUE') {
          if (quoted) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') quoted = false;
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') depth--;
          if (depth === 0) {
            pieces.push(text.slice(captureStart, i + 1));
            const raw = pieces.join(''); pieces.length = 0;
            captureStart = -1; phase = 'AFTER_VALUE';
            yield {key, raw};
          }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
    assert.equal(phase, 'END', 'Incomplete LifeGiver boundary document');
  } finally { closeSync(fd); }
}

async function gzipBytes(path) {
  let bytes = 0;
  await pipeline(createReadStream(path), createGzip({level: 9}), new Writable({
    write(chunk, _encoding, callback) { bytes += chunk.length; callback(); },
  }));
  return bytes;
}

/** Pure format conversion. Never removes/rewrites the source, a previous part,
 * or an older output run. Publish the small index only after all parts pass the
 * size check. A new directory also keeps readers of the old index consistent. */
export async function splitLifeGiverBoundaries(source, root) {
  assert.notEqual(resolve(source), resolve(root, INDEX_NAME));
  mkdirSync(root, {recursive: true});
  const directory = mkdtempSync(join(root, 'boundary-parts-'));
  const relativeDirectory = basename(directory);
  const entries = Object.create(null), parts = [];
  let current = null;
  async function finishPart() {
    if (!current) return;
    appendFileSync(current.path, '}');
    const compressedBytes = await gzipBytes(current.path);
    assert(compressedBytes < MAX_GZIP_BYTES,
      `${current.file} is ${compressedBytes} gzip bytes, exceeding the <15 MB delivery target; source and parts retained`);
    parts.push({file: current.file, keys: current.keys, jsonBytes: statSync(current.path).size, gzipBytes: compressedBytes});
    current = null;
  }
  for (const {key, raw} of lifeGiverBoundaryEntries(source)) {
    JSON.parse(raw); // Validate this complete JSON value without changing its bytes.
    if (!current) {
      const file = `${relativeDirectory}/part-${String(parts.length + 1).padStart(2, '0')}.json`;
      current = {file, path: partPath(root, file), keys: []};
      writeFileSync(current.path, '{', {flag: 'wx'});
    }
    appendFileSync(current.path, `${current.keys.length ? ',' : ''}${JSON.stringify(key)}:${raw}`);
    current.keys.push(key); entries[key] = current.file;
    if (current.keys.length === ENTRIES_PER_PART) await finishPart();
  }
  await finishPart();
  assert(parts.length > 0, 'Refusing to publish an empty LifeGiver boundary index');
  const index = {format: FORMAT, entriesPerPart: ENTRIES_PER_PART, entries, parts};
  const temporaryIndex = join(directory, 'index.pending.json');
  writeFileSync(temporaryIndex, `${JSON.stringify(index, null, 2)}\n`, {flag: 'wx'});
  renameSync(temporaryIndex, join(root, INDEX_NAME));
  return {index: join(root, INDEX_NAME), boundaries: Object.keys(entries).length, parts};
}

/** Verify all fields as well as the exact raw value bytes and key order. Only
 * two boundary values are parsed at once; no game commands or RNG are run. */
export async function verifyLifeGiverBoundaries(source, root) {
  const index = readIndex(root), expected = lifeGiverBoundaryEntries(source), keys = [], files = new Set();
  try {
    for (const part of index.parts) {
      assert(!files.has(part.file), `Repeated boundary part: ${part.file}`); files.add(part.file);
      const path = partPath(root, part.file), actualKeys = [];
      for (const actual of lifeGiverBoundaryEntries(path)) {
        const original = expected.next();
        assert(!original.done, `Unexpected split boundary: ${actual.key}`);
        assert.equal(actual.key, original.value.key, 'Boundary order/key changed');
        assert.equal(actual.raw, original.value.raw, `Boundary value bytes changed: ${actual.key}`);
        assert.deepEqual(JSON.parse(actual.raw), JSON.parse(original.value.raw), `Boundary fields changed: ${actual.key}`);
        assert(Object.hasOwn(index.entries, actual.key));
        assert.equal(index.entries[actual.key], part.file, `Wrong indexed part: ${actual.key}`);
        actualKeys.push(actual.key); keys.push(actual.key);
      }
      assert(actualKeys.length > 0 && actualKeys.length <= ENTRIES_PER_PART);
      assert.deepEqual(actualKeys, part.keys, `Wrong part manifest: ${part.file}`);
      assert.equal(statSync(path).size, part.jsonBytes);
      const compressedBytes = await gzipBytes(path);
      assert.equal(compressedBytes, part.gzipBytes);
      assert(compressedBytes < MAX_GZIP_BYTES, `Boundary part exceeds delivery target: ${part.file}`);
    }
    assert(expected.next().done, 'Split fixtures omitted original boundaries');
    assert.deepEqual(Object.keys(index.entries), keys, 'Boundary index contains extra/missing/reordered keys');
    return {passed: true, boundaries: keys.length, parts: index.parts};
  } finally { expected.return(); }
}
