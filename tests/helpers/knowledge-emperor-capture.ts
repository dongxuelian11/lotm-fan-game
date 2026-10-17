import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from './read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

/** Immutable completed natural run. Never imports or executes its producer. */
export const KNOWLEDGE_CAPTURE = 'tests/fixtures/knowledge-emperor-v02000';
export const KNOWLEDGE_SOURCE = 'tests/fixtures/sage-v01780/natural.json';
export const KNOWLEDGE_PRIOR = 'tests/fixtures/prophecy-master-v01540/natural.json';
export const KNOWLEDGE_PREFIX_COUNT = 651;
export const KNOWLEDGE_SOURCE_SHA = 'a0e37a9db792f8a6906efa92dbec3b13e0c1dff00ad9df492158b7d05b569766';
export const KNOWLEDGE_PRIOR_SHA = 'caf13bc9f7342beac74eae0f75641a022c8aaf0d12e179d5c7c58ea0358dcde8';
export const KNOWLEDGE_PREFIX_SHA = 'b7337b1b8265d38324749a82dfb5b77f9e07fda6d9936c1257a3c2bea3ba9031';
export const knowledgeCaptureExpected = {
  producerSha256: 'f546d4fdb250a37e888a7f7a394ce3f70121409fdd52d5de1a7d9ee962c2e4cc',
  commands: 831, namedBoundaries: 184, uniqueTransitions: 181, aliases: 3, files: 198,
  metadataHashes: {
    'natural.json': '1fd5f8c1fa3f29bb60925268851a597976904065c8b0ed66b95ce95258a92548',
    'summary.json': 'be4da0465de75207d2dd4e8896eee0f11bd51e6169d75669dc7008359bff1232',
    'commands.jsonl': 'fc734f8488a9dd58b4ad66de7f7531adc66d162cad0e2d1c45af9d9df9ef429a',
    'public.jsonl': 'bed05b1d5a7e409499a5e914d5e3679916a33162d5d4d893ce26882d8701c989',
    'boundaries.index.json': '1dea9cc299c21c3a8d294f92edd10d92819460e04e41fd7762a7542f27e12e90',
    'boundaries.steps.json': 'fef062f950f9055b37ba04d6761be4416fb07eb93462d49517eb9eeee8cc4fc6',
    'transitions.json': '822389825d7376ba22bef157cf1fefe4a871bf658a7e11e4dfaa74da22f79778',
    'source-prefix.json': '900add764b895091745606868c14c91796888b986a116f4b62fb915ecbdb1f8e',
    'capture-integrity.json': 'be698cd000f9750162d11727190e05daf3780adb2a96a4ed5d934f7a49072587',
  },
};
export const knowledgeBoundaries = JSON.parse(readFileSync(`${KNOWLEDGE_CAPTURE}/boundaries.index.json`, 'utf8')) as Record<string, string>;
export const knowledgeSteps = JSON.parse(readFileSync(`${KNOWLEDGE_CAPTURE}/boundaries.steps.json`, 'utf8')) as Record<string, number>;
export const knowledgeEntry = <T>(key: string): T => readObjectEntry<T>(`${KNOWLEDGE_CAPTURE}/natural.json`, key);
export const knowledgeSnapshots = knowledgeEntry<Record<string, string>>('snapshots');
export function knowledgeCapturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${KNOWLEDGE_CAPTURE}/${filename}`;
}
export function currentKnowledgeCapture(raw: unknown): SliceState {
  const state = migrateSliceState(raw);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function assertRawKnowledgeCapture(raw: SliceState): void {
  // Raw197 belongs to this immutable input, independently of the current output format.
  expect([raw.schemaVersion, raw.contentVersion]).toEqual([197, 'knowledge-emperor-v197']);
}
export function knowledgeBoundary(name: string) {
  const filename = knowledgeBoundaries[name];
  if (!filename) throw new Error(`Missing actual captured boundary: ${name}`);
  const path = knowledgeCapturePath(filename);
  const rawBefore = readObjectEntry<SliceState>(path, 'beforeLast'), rawFinal = readObjectEntry<SliceState>(path, 'final');
  assertRawKnowledgeCapture(rawBefore); assertRawKnowledgeCapture(rawFinal);
  return { path, filename, count: readObjectEntry<number>(path, 'commandCount'),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), before: currentKnowledgeCapture(rawBefore), final: currentKnowledgeCapture(rawFinal) };
}
export function knowledgeSnapshot(name: string): SliceState {
  const filename = knowledgeSnapshots[name];
  if (!filename) throw new Error(`Missing actual captured snapshot: ${name}`);
  const raw = JSON.parse(readFileSync(knowledgeCapturePath(filename), 'utf8')) as SliceState;
  assertRawKnowledgeCapture(raw); return currentKnowledgeCapture(raw);
}
