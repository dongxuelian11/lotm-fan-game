import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import * as whiteTower from '../helpers/white-tower-capture.js';
import * as tyrant from '../helpers/tyrant-capture.js';

type CheckpointReader = Pick<typeof whiteTower, 'bytes' | 'filePin' | 'hash' | 'json'> & {
  ROOT: string; INPUT_MANIFEST: string; INPUT_MANIFEST_SHA: string;
};

// Authenticate only the checkpoint and selected member, without loading or
// replaying the full campaign. readAction verifies its checkpoint-pinned bytes.
function readAuthenticatedCheckpoint<T>(capture: CheckpointReader): T {
  expect(capture.filePin(capture.INPUT_MANIFEST).sha256).toBe(capture.INPUT_MANIFEST_SHA);
  const manifest = JSON.parse(capture.bytes(capture.INPUT_MANIFEST).toString('utf8')) as whiteTower.Manifest;
  const members = manifest.files.filter(member => member.file === 'checkpoint.json.gz');
  expect(members).toHaveLength(1);
  const member = members[0]!;
  expect(capture.filePin(join(capture.ROOT, member.file)))
    .toEqual({ bytes: member.bytes, sha256: member.sha256 });
  const wrapper = capture.json<{ sha256: string; payload: T }>(member.file);
  expect(capture.hash(wrapper.payload)).toBe(wrapper.sha256);
  return wrapper.payload;
}

describe('Cumulative current migration of retained White Tower and Tyrant captures', () => {
  it('preserves the complete White Tower211 boundary710 through exact current additions', () => {
    const checkpoint = readAuthenticatedCheckpoint<whiteTower.Checkpoint>(whiteTower);
    const rows = checkpoint.rows.filter(row => row.commandCount === 710);
    expect(rows).toHaveLength(1);
    const row = rows[0]!, captured = whiteTower.readAction(row), raw = captured.final;
    expect(captured.commandCount).toBe(710);
    expect(whiteTower.hash(raw)).toBe(row.afterStateSha256);
    expect(whiteTower.hash(captured.globalPublic)).toBe(row.globalPublicAfterSha256);

    const current = whiteTower.migrateCapturedWhiteTowerState(raw), projection = projectSliceState(current);
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(whiteTower.historicalWhiteTowerState(current)).toStrictEqual(raw);
    expect(whiteTower.hash(whiteTower.historicalWhiteTowerState(current))).toBe(row.afterStateSha256);
    expect(whiteTower.historicalWhiteTowerPublic(projection, current))
      .toStrictEqual(projectPlayerText(captured.globalPublic, current.character.name));

    expect(() => whiteTower.historicalWhiteTowerState({ ...current,
      mother: { ...current.mother, guidanceKnown: true } })).toThrow();
    expect(() => whiteTower.migrateCapturedWhiteTowerState({ ...raw, unexpectedRoot: undefined } as typeof raw)).toThrow();
    expect(whiteTower.hash(raw)).toBe(row.afterStateSha256);
    expect(whiteTower.hash(captured.globalPublic)).toBe(row.globalPublicAfterSha256);
  }, 60_000);

  it('preserves the complete Tyrant212 boundary710 before the reviewed717 check correction', () => {
    const checkpoint = readAuthenticatedCheckpoint<tyrant.Checkpoint>(tyrant);
    const rows = checkpoint.rows.filter(row => row.commandCount === 710);
    expect(rows).toHaveLength(1);
    const row = rows[0]!, captured = tyrant.readAction(row), raw = captured.final;
    expect(captured.commandCount).toBe(710);
    expect(tyrant.hash(raw)).toBe(row.afterStateSha256);
    expect(tyrant.hash(captured.globalPublic)).toBe(row.globalPublicAfterSha256);

    const current = tyrant.migrateCapturedTyrantState(raw), projection = projectSliceState(current);
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(tyrant.historicalTyrantState(current)).toStrictEqual(raw);
    expect(tyrant.hash(tyrant.historicalTyrantState(current))).toBe(row.afterStateSha256);
    const expectedPublic = tyrant.expectedCurrentGlobal(captured, 'after');
    expect(expectedPublic).toStrictEqual(captured.globalPublic);
    expect(tyrant.historicalTyrantPublic(projection, current))
      .toStrictEqual(projectPlayerText(expectedPublic, current.character.name));

    expect(() => tyrant.historicalTyrantState({ ...current,
      mother: { ...current.mother, guidanceKnown: true } })).toThrow();
    expect(() => tyrant.migrateCapturedTyrantState({ ...raw, unexpectedRoot: undefined } as typeof raw)).toThrow();
    expect(tyrant.hash(raw)).toBe(row.afterStateSha256);
    expect(tyrant.hash(captured.globalPublic)).toBe(row.globalPublicAfterSha256);
  }, 60_000);
});
