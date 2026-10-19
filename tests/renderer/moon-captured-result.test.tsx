/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { MOON_ABILITY_IDS } from '../../src/domain/moon/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import {
  ROOT, SOURCE, SOURCE_SHA, PREFIX, PREFIX_SHA, bytes, decoded, evidence, filePin, hash, sha,
  capturePublic, historicalMoonState, migrateCapturedMoonState, type Checkpoint, type LoadedCapture, type Manifest,
} from '../helpers/moon-capture.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

// Read only the independently pinned natural924 checkpoint and summary. There
// is no controlled RNG seam, producer run, gameplay submission or SQLite save.
// The separate full-capture and SQLite suites establish replay/persistence;
// this test establishes actual SliceApp loading and truthful final-page display.
const PANEL = '序列0 月亮';
const checkedFiles = new Map<string, string>();

function capturedFinal() {
  const pins = evidence(), manifestBytes = bytes(pins.inputManifest);
  expect(sha(manifestBytes)).toBe(pins.inputManifestSha256);
  checkedFiles.set(pins.inputManifest, pins.inputManifestSha256);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
  expect(manifest.format).toBe('MOON212_CAPTURE_FILES_V1');
  function readPinned<T>(name: string): T {
    const members = manifest.files.filter(member => member.file === name);
    expect(members).toHaveLength(1);
    const member = members[0]!, path = `${ROOT}/${name}`;
    expect(filePin(path)).toEqual({ bytes: member.bytes, sha256: member.sha256 });
    checkedFiles.set(path, member.sha256);
    const unpacked = decoded(path);
    if (name.endsWith('.gz')) {
      expect(unpacked.length).toBe(member.originalBytes);
      expect(sha(unpacked)).toBe(member.originalSha256);
    }
    return JSON.parse(unpacked.toString('utf8')) as T;
  }
  const wrapped = readPinned<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz');
  expect(Object.keys(wrapped).sort()).toEqual(['payload', 'sha256']);
  expect(hash(wrapped.payload)).toBe(wrapped.sha256);
  const checkpoint = wrapped.payload;
  expect(checkpoint).toMatchObject({ format: 'MOON670_DURABLE_PUBLIC_ACTION_BOUNDARY_V1',
    source: SOURCE, sourceSha256: SOURCE_SHA, prefixSha256: PREFIX_SHA, freezeSha256: pins.freezeSha256,
    commandCount: 924, pending: null, terminal: { stage: pins.stage, reason: pins.reason },
    finalStateSha256: pins.finalStateSha256, publicStateSha256: pins.finalPublicSha256 });
  expect(checkpoint.commands).toHaveLength(pins.newCommands);
  expect(checkpoint.commandCount).toBe(PREFIX + pins.newCommands);
  expect(checkpoint.commands.at(-1)).toEqual({ type: 'MOON', command: { type: 'EPILOGUE', command: { type: 'REPORT' } } });
  const raw = checkpoint.state;
  expect(hash(raw)).toBe(pins.finalStateSha256);
  expect(hash(raw.random)).toBe(pins.finalRandomSha256);
  expect([raw.schemaVersion, raw.contentVersion]).toEqual([209, 'moon-v209']);
  const summary = readPinned<LoadedCapture['summary']>('summary.json');
  expect(summary).toMatchObject({ stage: pins.stage, reason: pins.reason, commands: 924,
    originalCommands: 670, newCommands: 254, week: 211, paused: false, diagnostic: false,
    strictFinalValidation: true, checkpoint: 'checkpoint.json.gz' });
  expect(hash(summary.public)).toBe(pins.finalPublicSha256);

  const current = migrateCapturedMoonState(raw);
  expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  // Only the exact reviewed default Darkness and White Tower roots may be added.
  // Every old field remains covered by the immutable historical capture hash.
  expect(Object.keys(current).sort()).toEqual([...Object.keys(raw), 'darkness', 'whiteTower'].sort());
  expect(current.darkness).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    evacuation: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
  });
  expect(current.whiteTower).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    passages: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
  });
  expect(hash(historicalMoonState(current))).toBe(pins.finalStateSha256);
  expect(hash(raw)).toBe(pins.finalStateSha256);
  assertValidSliceState(current);
  const value = projectSliceState(current);
  expect(capturePublic(value, current)).toEqual(summary.public);
  expect(hash(capturePublic(value, current))).toBe(pins.finalPublicSha256);
  return { raw, current, value, pins };
}

function assertPublicBoundary(value: SliceProjection, state: SliceState) {
  const forbidden = /^(?:seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|preparedRoll|futureRoll|sourceDigest|sourceIdentityDigest|beforeDigest|afterDigest|randomReceipts)$/;
  const privatePaths: string[] = [];
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((child, index) => visit(child, `${path}[${index}]`)); return; }
    for (const [key, child] of Object.entries(node)) {
      const next = `${path}.${key}`;
      if (forbidden.test(key)) privatePaths.push(next);
      visit(child, next);
    }
  }
  visit(value, '$');
  expect(privatePaths).toEqual([]);
  for (const key of ['random', 'seed', 'cursor', 'source', 'frame', 'journal']) {
    expect(Object.hasOwn(value, key)).toBe(false);
    expect(Object.hasOwn(value.moon, key)).toBe(false);
  }
  expect(Object.keys(value.moon).sort()).toEqual(['abilities', 'actions', 'guidanceKnown', 'insideCase',
    'nextStep', 'promoted', 'resources', 'risk', 'sections', 'story', 'title'].sort());
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain(state.random.seed);
  expect(serialized).not.toContain(state.moon.source!.historyDigest);
  // Public check modifier explanations may legitimately have a string "source".
}

async function openCapturedPage(value: SliceProjection) {
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(value), runs: [{ runId: value.runId,
      name: value.character.name, portraitId: value.character.portraitId, week: value.week,
      date: value.date, status: value.status, revision: value.revision, updatedAt: '2026-10-17T16:00:00Z' }],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => ({ ok: true, value: structuredClone(value) }));
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async () => {
    throw Error('The actual final-capture UI adapter is read-only; no gameplay may be submitted.');
  });
  window.sliceGame = { getBootstrap, loadRun, submitIntent };
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  await screen.findByRole('region', { name: PANEL });
  expect(getBootstrap).toHaveBeenCalledTimes(1);
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
  expect(submitIntent).not.toHaveBeenCalled();
  return { view, submitIntent };
}

async function assertFinalPage(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: PANEL });
  const banner = screen.getAllByRole('banner').find(item => within(item).queryByRole('button', { name: '返回主菜单' }))!;
  expect(banner.textContent).toContain('艾琳 · 序列0 月亮');
  expect(banner.textContent).toContain('第 211 周');
  expect(within(panel).getByRole('heading', { name: PANEL, level: 2 })).toBeTruthy();
  expect(panel.textContent).toContain('健康 92 · 精神 83 · 灵性 128 · 2996便士 · 本周行动 0');
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent)
    .toContain('本次真实现场已经交接，普通生活仍可继续。');
  const body = within(panel).getByRole('region', { name: '本人身体、原来客与普通医疗' });
  expect(body.textContent).toContain('艾琳，26岁，当前女性身体');
  expect(body.textContent).toContain('健康92，精神83，灵性128/150，污染0，意志28');
  expect(body.textContent).toContain('轻伤：尚未处置。');
  expect(body.textContent).toContain('流灯仍是原来的同一身体，在原来的家中；健康100，精神92，精力79。');
  const injury = within(panel).getByRole('region', { name: '当前伤势' });
  expect(injury.textContent).toContain('伤势风险 1');
  expect(within(injury).getAllByRole('listitem')).toHaveLength(1);
  expect(within(injury).getByRole('listitem').textContent).toBe('1. 轻伤 · 未处理');

  const incident = within(panel).getByRole('region', { name: '东岸原船松缆的有限处置' });
  expect(incident.closest('details')).toBeNull();
  for (const name of ['赫莲·布鲁克', '奥斯卡·贝尔'])
    expect(within(incident).getByText(`${name}：已实际抵达内岸避风点；无新增乘客伤势。`)).toBeTruthy();
  expect(incident.textContent).toContain('原船状况69，原灯状况87；原船员露西·费恩。');
  expect(incident.textContent).toContain('月照航道：尝试已经结束。');
  expect(incident.textContent).toContain('柔和渡行：本次已尝试');
  expect(incident.textContent).not.toContain('已成功用于实际转移');
  expect(incident.textContent).not.toContain('仍在先前抵达的彼岸登船台');
  const recent = within(panel).getByRole('region', { name: '最近行动结果' });
  expect(within(recent).getByText(state.lastResult!.text)).toBeTruthy();
  expect(recent.textContent).toContain('实际交接：2名原乘客抵达内岸避风点，0名仍在原彼岸登船台');
  expect(recent.textContent).not.toMatch(/实际掷骰|检定|大成功|本次施术失败/);
  expect(value.lastCheck).toBeNull();

  await userEvent.click(within(panel).getByText('已掌握的能力', { selector: 'summary' }));
  expect(value.moon.abilities).toHaveLength(25);
  expect(Object.fromEntries(value.moon.abilities.map(ability => [ability.id, ability.mastery])))
    .toEqual(state.progression.mastery);
  for (const ability of value.moon.abilities)
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  expect(within(panel).getByRole('heading', { name: '月照航道 · 熟练 0' })).toBeTruthy();
  expect(within(panel).getByRole('heading', { name: '柔和渡行 · 熟练 0' })).toBeTruthy();

  await userEvent.click(within(panel).getByText('其他可选行动', { selector: 'summary' }));
  for (const action of value.moon.actions.filter(action => action.command.type === 'EPILOGUE')) {
    expect(action.enabled).toBe(false);
    expect((within(panel).getByRole('button', { name: action.label }) as HTMLButtonElement).disabled).toBe(true);
  }
  expect(screen.queryByRole('region', { name: '美神成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/apothecary-rebuild-first|randomCursor|cursorBefore|cursorAfter|sourceDigest|historyDigest|preparedRoll|futureRoll/);
  expect(panel.innerHTML).not.toContain(state.moon.source!.historyDigest);
  return panel.textContent;
}

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  vi.resetAllMocks(); vi.restoreAllMocks();
  for (const [path, expected] of checkedFiles) expect(filePin(path).sha256, 'Original capture bytes stay untouched').toBe(expected);
  checkedFiles.clear();
});

describe('Moon actual natural924 final result in SliceApp', () => {
  it('opens and reopens the original reported S0 with its actual costs, injury, two transferred passengers and zero new-skill mastery', async () => {
    const { raw, current, value, pins } = capturedFinal(), currentHash = hash(current), publicHash = hash(value);
    expect(current).toMatchObject({ revision: 925, status: 'ACTIVE', week: 211, health: 92, mind: 83,
      spirituality: 128, cash: 2996, actionsRemaining: 0, injuryRisk: 1,
      progression: { pathwayId: 'moon', sequence: 0, acting: 0 } });
    expect(current.injuries).toEqual([{ id: 'R212:apothecary-rebuild-natural:920:quay-injury',
      severity: 'LIGHT', acquiredRevision: 920, treatedRevision: null }]);
    expect(current.character).toEqual(raw.character);
    expect(current.character).toEqual(current.moon.source!.character);
    expect(value.character).toEqual(raw.character);
    expect(value.moon).toMatchObject({ promoted: true, insideCase: false });
    expect(Object.keys(current.progression.mastery)).toHaveLength(25);
    const inherited = Object.fromEntries(Object.entries(current.progression.mastery)
      .filter(([id]) => !MOON_ABILITY_IDS.some(ability => ability === id)));
    expect(Object.keys(inherited)).toHaveLength(23);
    expect(inherited).toEqual(current.moon.source!.budget.mastery);
    for (const id of MOON_ABILITY_IDS) expect(current.progression.mastery[id]).toBe(0);
    const epilogue = current.moon.epilogue!;
    expect(epilogue).toMatchObject({ status: 'RESOLVED', reported: true, moored: true, transferred: true,
      channel: { attempted: true, passed: false, active: false, applied: false },
      crossing: { attempted: true, passed: true, expiresSecond: null, applied: false } });
    const channel = epilogue.journal.find(event => event.command.type === 'MOONLIT_CHANNEL')!;
    const crossing = epilogue.journal.find(event => event.command.type === 'GENTLE_CROSSING')!;
    const mooring = epilogue.journal.find(event => event.command.type === 'MOOR')!;
    const transfer = epilogue.journal.find(event => event.command.type === 'TRANSFER')!;
    expect(channel.check).toMatchObject({ chance: 76, roll: 93, tier: 'FAILURE' });
    expect(crossing.check).toMatchObject({ chance: 76, roll: 55, tier: 'SUCCESS' });
    expect(mooring.second - crossing.second).toBe(120);
    expect(transfer.second).toBeGreaterThan(crossing.second + 60);
    expect(epilogue.journal.at(-1)!.command.type).toBe('REPORT');
    const passengers = current.moon.services!.stations.find(station => station.id === 'EAST')!.passengers;
    expect(passengers.map(passenger => passenger.id)).toEqual(epilogue.passengerIds);
    expect(passengers).toHaveLength(2);
    expect(passengers.every(passenger => passenger.status === 'EVACUATED'
      && passenger.location === 'backlund:moon-east-quay:inner-shore-refuge' && passenger.injuries.length === 0)).toBe(true);
    assertPublicBoundary(value, current);

    const first = await openCapturedPage(value), firstText = await assertFinalPage(value, current);
    expect(first.submitIntent).not.toHaveBeenCalled();
    first.view.unmount();
    const reopenedValue = projectSliceState(current);
    expect(reopenedValue).toEqual(value);
    assertPublicBoundary(reopenedValue, current);
    const reopened = await openCapturedPage(reopenedValue);
    expect(await assertFinalPage(reopenedValue, current)).toBe(firstText);
    expect(first.submitIntent).not.toHaveBeenCalled(); expect(reopened.submitIntent).not.toHaveBeenCalled();
    expect(hash(raw)).toBe(pins.finalStateSha256);
    expect(hash(current)).toBe(currentHash); expect(hash(value)).toBe(publicHash);
  }, 120_000);
});
