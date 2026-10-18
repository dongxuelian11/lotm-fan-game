import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  projectWriterLife, projectWriterLifeReceipt, WRITER_CASE_IDS,
  type WriterActivityCommand, type WriterCaseId, type WriterLifeReceipt,
} from '../../src/domain/writer/life.js';

const FILE = 'tests/fixtures/writer-v01880/snapshot-practiced.json';
const FILE_HASH = '49e6d09f367fab24667093f32a1a887aef5b000a2fe505a56cb3190276e3a0bc';
const captured = (): SliceState => JSON.parse(readFileSync(FILE, 'utf8')) as SliceState;
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');
function withoutReplay(entry: WriterLifeReceipt) {
  const { randomCursor: _cursor, randomBefore: _before, randomAfter: _after, ...facts } = structuredClone(entry);
  return facts;
}
function expectedAttempts(journal: WriterLifeReceipt[], id: WriterCaseId) {
  return journal.flatMap((entry, index) => {
    if (entry.command.type !== 'INVITE' || entry.command.caseId !== id) return [];
    const end = journal.findIndex((candidate, candidateIndex) => candidateIndex > index && ['RETURN_HOME', 'ABORT'].includes(candidate.command.type));
    expect(end).toBeGreaterThan(index);
    return [journal.slice(index, end + 1).map(withoutReplay)];
  });
}
function assertPublicOnly(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, index) => assertPublicOnly(child, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomBefore', 'randomAfter', 'privateProbe', 'unexpectedField'].includes(key), `${path}.${key}`).toBe(false);
    if (key === 'source') expect(path, `${path}.${key}`).toMatch(/\.check\.modifiers\[\d+\]$/);
    assertPublicOnly(child, `${path}.${key}`);
  }
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || found.has(value)) return found;
  found.add(value); Object.values(value).forEach(child => objects(child, found)); return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const originals = objects(input);
  for (const object of objects(output)) expect(originals.has(object), 'public objects must not alias their input').toBe(false);
}
function injectPrivateFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(injectPrivateFields); return; }
  Object.values(value).forEach(injectPrivateFields);
  Object.assign(value, { unexpectedField: 'not a declared public fact', privateProbe: { randomSeed: 'private', randomCursor: 1234 } });
}

describe('Writer life public receipt allowlists', () => {
  it('preserves all 33 actual receipts and all three actual attempts without exposing replay cursors', () => {
    expect(fileDigest()).toBe(FILE_HASH);
    const state = captured(), original = structuredClone(state), before = digest(state), random = structuredClone(state.random);
    const journal = state.writer.life.journal, panel = projectWriterLife(state);
    expect(journal).toHaveLength(33); expect(panel.ledger).toEqual(journal.map(withoutReplay));
    expect(panel.cases.map(item => item.attempts.length)).toEqual([1, 1, 1]);
    expect(panel.cases.flatMap(item => item.attempts.flatMap(attempt => attempt.receipts))).toHaveLength(26);
    for (const item of panel.cases) {
      expect(item.attempts.map(attempt => attempt.receipts)).toEqual(expectedAttempts(journal, item.id));
      expect(item.attempts[0]!.evidence).toMatchObject({ returned: true, aborted: false, result: state.writer.life.cases[item.id].result });
      expect(item.attempts[0]!.outcome).toBe(state.writer.life.cases[item.id].outcome);
      assertPublicOnly(item.attempts);
    }
    expect(panel.practice).toEqual(state.writer.life.practice);
    expect(panel.practice.introduction!.name).toBe('莉娜');
    expect(panel.practice.participants.map(person => [person.name, person.node, person.walkedMetres])).toEqual([
      ['伊芙琳·赛尔', 'NEAR', 42], ['托马斯·里德', 'NEAR', 30],
    ]);
    expect(panel.practice.book).toEqual({ id: 'WR1-RETURN-BOOK', ownerId: 'WR1-EVELYN', holder: 'SHELF', node: 'FAR' });
    expect(panel.ledger.filter(entry => entry.command.type === 'INVITE').map(entry => entry.before.cash - entry.after.cash)).toEqual([20, 20, 20]);
    expect(panel.ledger.filter(entry => entry.check).map(entry => [entry.before.spirituality - entry.after.spirituality, entry.before.mind - entry.after.mind])).toEqual([[6, 2], [8, 3]]);
    expect(panel.ledger.reduce((sum, entry) => sum + entry.elapsedSeconds, 0)).toBe(180);
    expect(panel.ledger.reduce((sum, entry) => sum + entry.ownerWalkedMetres, 0)).toBe(48);
    assertPublicOnly(panel.ledger); assertDetached(panel, state);
    expect(state).toEqual(original); expect(state.random).toEqual(random); expect(digest(state)).toBe(before);
    expect(fileDigest()).toBe(FILE_HASH);
  });

  it('retains resolved checks and public modifier sources, including words that also name private fields', () => {
    const state = captured(), original = digest(state);
    const text = 'source randomSeed randomCursor randomBefore randomAfter 莉娜的公开检定说明';
    const receipts = state.writer.life.journal.filter(entry => entry.check).map(entry => structuredClone(entry));
    expect(receipts).toHaveLength(2);
    for (const receipt of receipts) {
      receipt.check = { ...receipt.check!, modifiers: [{ source: text, value: 0 }] };
      const before = digest(receipt), projected = projectWriterLifeReceipt(receipt);
      expect(projected).toEqual(withoutReplay(receipt)); expect(projected.check).toEqual(receipt.check);
      expect(projected.check!.modifiers[0]!.source).toBe(text);
      assertPublicOnly(projected); assertDetached(projected, receipt); expect(digest(receipt)).toBe(before);
    }
    expect(digest(state)).toBe(original); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('allowlists every nested receipt object while leaving malformed raw attempt replay rejected', () => {
    const state = captured(), expected = state.writer.life.journal.map(withoutReplay);
    for (const receipt of state.writer.life.journal) injectPrivateFields(receipt);
    const before = digest(state), random = structuredClone(state.random), panel = projectWriterLife(state);
    expect(panel.ledger).toEqual(expected);
    expect(panel.cases.every(item => item.attempts.length === 0)).toBe(true);
    for (const [index, receipt] of state.writer.life.journal.entries()) {
      const projected = projectWriterLifeReceipt(receipt);
      expect(projected).toEqual(expected[index]); assertPublicOnly(projected); assertDetached(projected, receipt);
    }
    assertPublicOnly(panel.ledger); assertDetached(panel.ledger, state);
    expect(digest(state)).toBe(before); expect(state.random).toEqual(random); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('filters unknown receipt, date, check, modifier and walk fields in reconstructed attempts too', () => {
    const state = captured();
    for (const receipt of state.writer.life.journal) {
      if (receipt.check) receipt.check = { ...receipt.check, modifiers: [{ source: '公开来源不是私有重放来源', value: 0 }] };
    }
    const expected = projectWriterLife(state);
    for (const receipt of state.writer.life.journal) {
      injectPrivateFields(receipt.date); injectPrivateFields(receipt.check); injectPrivateFields(receipt.participantWalks);
      Object.assign(receipt, { unexpectedField: 'private receipt input' });
    }
    const before = digest(state), actual = projectWriterLife(state);
    expect(actual).toEqual(expected); assertPublicOnly(actual.ledger);
    for (const item of actual.cases) { expect(item.attempts).toHaveLength(1); assertPublicOnly(item.attempts); }
    assertDetached(actual, state); expect(digest(state)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('copies only each command variant’s declared fields', () => {
    // Synthetic command-shape probes do not alter or replay the actual campaign.
    const commands: WriterActivityCommand[] = [
      ...WRITER_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'REPORT', caseId },
        { type: 'INVITE', caseId, method: 'ABILITY' }, { type: 'INVITE', caseId, method: 'ORDINARY' },
      ] satisfies WriterActivityCommand[]),
      { type: 'MOVE', to: 'NEAR' }, { type: 'MOVE', to: 'FAR' },
      { type: 'REVOKE_CONSENT', permission: 'ABILITY' }, { type: 'REVOKE_CONSENT', permission: 'MATERIAL' },
      ...(['ENTER_ROOM', 'INTRODUCE', 'TAKE_BOOK', 'CHECK_BOOK', 'HAND_TO_THOMAS', 'MUTUAL_INSIGHT', 'ARRANGE_RETURN', 'WAIT_ARRANGEMENT', 'CANCEL_ARRANGEMENT', 'CLOSE_DOOR', 'OPEN_DOOR', 'ORDINARY_RETURN', 'RETURN_BOOK', 'RETURN_HOME', 'ABORT', 'REFLECT'] as const).map(type => ({ type })),
    ];
    const original = captured().writer.life.journal[0]!;
    for (const command of commands) {
      const receipt = structuredClone(original); receipt.command = structuredClone(command);
      injectPrivateFields(receipt.command);
      const before = digest(receipt), projected = projectWriterLifeReceipt(receipt);
      expect(projected.command).toEqual(command); assertPublicOnly(projected); assertDetached(projected, receipt);
      expect(digest(receipt)).toBe(before);
    }
    expect(fileDigest()).toBe(FILE_HASH);
  });

  it('returns detached ledger and attempt copies on every projection', () => {
    const state = captured(), before = digest(state), panel = projectWriterLife(state), expected = projectWriterLife(state);
    assertDetached(panel, expected); assertDetached(panel.ledger, panel.cases);
    panel.ledger[0]!.before.cash++; panel.ledger[0]!.participantWalks[0]!.metres++;
    Object.assign(panel.ledger[0]!.date, { day: 1 });
    Object.assign(panel.ledger.find(entry => entry.check)!.check!, { roll: 1 });
    panel.cases[0]!.attempts[0]!.receipts[0]!.after.actions++;
    Object.assign(panel.cases[0]!.attempts[0]!.receipts[0]!.command, { method: 'ORDINARY' });
    expect(projectWriterLife(state)).toEqual(expected); expect(digest(state)).toBe(before); expect(fileDigest()).toBe(FILE_HASH);
  });

  it('uses the safe life receipt mapping in the current global projection without rewriting the capture', () => {
    const raw = captured(), original = structuredClone(raw), originalHash = digest(raw);
    const state = migrateSliceState(raw), before = digest(state), random = structuredClone(state.random);
    const view = projectSliceState(state), panel = view.writer.life;
    expect(panel).toEqual(projectWriterLife(state)); expect(panel.ledger).toHaveLength(33);
    assertPublicOnly(panel.ledger);
    for (const item of panel.cases) assertPublicOnly(item.attempts);
    assertDetached(panel, state); expect(state.random).toEqual(random); expect(digest(state)).toBe(before);
    expect(raw).toEqual(original); expect(digest(raw)).toBe(originalHash); expect(fileDigest()).toBe(FILE_HASH);
  });
});
