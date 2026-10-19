/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { createRedPriestState, projectRedPriest } from '../../src/domain/red-priest/index.js';
import { createVisionaryState, projectVisionary } from '../../src/domain/visionary/index.js';
import { createPerfecterState, projectPerfecter } from '../../src/domain/perfecter/index.js';
import { createMoonState, projectMoon } from '../../src/domain/moon/index.js';
import { createDarknessState, projectDarkness } from '../../src/domain/darkness/index.js';
import { createWhiteTowerState, projectWhiteTower } from '../../src/domain/white-tower/index.js';
import { createTyrantState, projectTyrant } from '../../src/domain/tyrant/index.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceBridge, SliceRunSummary } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { historicalFoolStateForEmptyRootAudit, historicalWithoutEmptyDoorAndErrorPublic, EMPTY_SUN } from '../helpers/historical-empty-root-audit.js';
import { historicalInactiveHermitPublic } from '../helpers/inactive-hermit-public-capture.js';
import { assertEmptyDeathPublic } from '../helpers/empty-death-capture.js';

// Actual completed 2083-command campaign, not an S1 save patched into S0.
// One production strict projection supplies every displayed fact. No output/
// benchmark file, fabricated public view, new action, replay or SQLite dependency.
const SOURCE = 'tests/fixtures/fool-v02080/natural.json';
const FINAL_SHA256 = '66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a';
// Reviewed historical 208 public hash: only the historical S1 private source and
// random cursors were removed. Keep this pin distinct from the full current view.
const PUBLIC_SHA256 = '0e0d77363984f154ac14fc8e5260d9bda59119a582aaf8bcd7549b727f34f5b3';
const PANEL = '愚者 · 当前现场';
const hash = (value: unknown): string => sha256Hex(stableStringify(value));
const ADDED_ROOTS = ['redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant',
  'sun', 'death', 'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan',
  'abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
type OriginalFoolState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | typeof ADDED_ROOTS[number]> & {
  schemaVersion: 205; contentVersion: 'fool-v205';
};
const EMPTY_DARKNESS: SliceState['darkness'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  evacuation: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_WHITE_TOWER: SliceState['whiteTower'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  passages: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_TYRANT: SliceState['tyrant'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  coasts: null, challenge: null, materials: null, epilogue: null, seaVoyages: [], assembly: null,
  journal: [], promotionStability: { preparations: [] },
};

function assertExactMigration(original: OriginalFoolState, current: SliceState): void {
  expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(Object.keys(current).sort()).toEqual([...Object.keys(original), ...ADDED_ROOTS].sort());
  expect(current.redPriest).toStrictEqual(createRedPriestState());
  expect(current.visionary).toStrictEqual(createVisionaryState());
  expect(current.perfecter).toStrictEqual(createPerfecterState());
  expect(current.moon).toStrictEqual(createMoonState());
  expect(current.darkness).toStrictEqual(EMPTY_DARKNESS);
  expect(current.whiteTower).toStrictEqual(EMPTY_WHITE_TOWER);
  expect(current.tyrant).toStrictEqual(EMPTY_TYRANT);
  expect(hash(historicalFoolStateForEmptyRootAudit(current, Object.keys(original)))).toBe(hash(original));
  const now = current as unknown as Record<string, unknown>;
  // Every old field is covered, including all nested history, body and RNG data.
  // Hashes avoid retaining giant private trees in assertion failure diffs.
  for (const [key, value] of Object.entries(original)) {
    if (key !== 'schemaVersion' && key !== 'contentVersion') expect(hash(now[key]), key).toBe(hash(value));
  }
}

function historicalPublicHash(value: SliceProjection, current: SliceState): string {
  // Remove only the twenty-one fully verified fresh-root projections. Everything else,
  // including unexpected additions or missing old public fields, stays hash-bound.
  expect(current.redPriest).toStrictEqual(createRedPriestState());
  expect(current.visionary).toStrictEqual(createVisionaryState());
  expect(current.perfecter).toStrictEqual(createPerfecterState());
  expect(current.moon).toStrictEqual(createMoonState());
  expect(current.darkness).toStrictEqual(EMPTY_DARKNESS);
  expect(current.whiteTower).toStrictEqual(EMPTY_WHITE_TOWER);
  expect(current.tyrant).toStrictEqual(EMPTY_TYRANT);
  expect(current.progression.pathwayId).toBe('diviner');
  expect(value.redPriest).toStrictEqual(projectPlayerText(projectRedPriest(current), current.character.name));
  expect(value.visionary).toStrictEqual(projectPlayerText(projectVisionary(current), current.character.name));
  expect(value.perfecter).toStrictEqual(projectPlayerText(projectPerfecter(current), current.character.name));
  expect(value.moon).toStrictEqual(projectPlayerText(projectMoon(current), current.character.name));
  expect(Object.hasOwn(value, 'darkness')).toBe(true);
  expect(value.darkness).toStrictEqual(projectPlayerText(projectDarkness(current), current.character.name));
  expect(Object.hasOwn(value, 'whiteTower')).toBe(true);
  expect(value.whiteTower).toStrictEqual(projectPlayerText(projectWhiteTower(current), current.character.name));
  expect(Object.hasOwn(value, 'tyrant')).toBe(true);
  expect(value.tyrant).toStrictEqual(projectPlayerText(projectTyrant(current), current.character.name));
  // Independently pin every discarded field and the one disabled action.
  expect(value.darkness).toStrictEqual({
    title: '序列0 黑暗', guidanceKnown: false, promoted: false,
    story: '原庭院里的人和物仍在原处。步行前往新街区，在白昼查路、问过四位成年人的意愿，入夜后用普通灯、原绳和亲身搀扶完成长夜撤离。',
    nextStep: '四人逐一在真实夜间抵达，再亲走返程；核清三份原特性，等待1353年真实事件后才交接同一唯一性，并为同一瓶付费准备。',
    risk: '完整准备按本人实际意志计算成功率，不改骰子。失败会留下伤势、污染并可能死亡。幸存者须原地封存、隔周付费回收，另购有限载体重新准备。',
    resources: { health: current.health, mind: current.mind, spirituality: current.spirituality,
      cash: `${current.cash}便士`, actionsRemaining: current.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'darkness:0:LEARN_GUIDANCE', label: '听取长夜撤离与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: current.status === 'ACTIVE' ? '须由仍活着的厄难骑士继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  // White Tower is discarded only after its entire inactive public shape is pinned.
  expect(value.whiteTower).toStrictEqual({
    title: '序列0 白塔', guidanceKnown: false, promoted: false,
    story: '原资料室、埃德温的庭院、两张原纸与停止的器材留在原处。街区接待处收到市场台阶、运河检修廊和公寓后巷三处阻路求助；分别亲自问过居民、实勘、修补和验收，再让本人真实通过，并于下一周回来复核。',
    nextStep: '完成三处原居民的真实通过与隔周复核；核清本人已有的一份和另外两份原特性，实地确认同一唯一性空位，再为同一本人的同一瓶付费准备。',
    risk: '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。',
    resources: { health: current.health, mind: current.mind, spirituality: current.spirituality,
      cash: `${current.cash}便士`, actionsRemaining: current.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'white-tower:0:LEARN_GUIDANCE', label: '听取三条通路与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: current.status === 'ACTIVE' ? '须由仍活着的全知之眼本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  expect(value.tyrant).toStrictEqual({
    title: '序列0 暴君', guidanceKnown: false, promoted: false,
    story: '原小湾与旧人原物继续保留。三岸共二十七万原居民各有当前意愿与有限粮食；履约、隔周复核和真实航运不能用证书代替。另一位太阳真神独立敌对，单独挑战并真实存活才计入晋升经历。',
    nextStep: '先继续雷神的真实原三份续筹、晋升和三案反思；历史独立第四份不能改写为同根回收件。',
    risk: '晋升成功率按当前意志与本次付费准备计算；失败实际重伤、污染或死亡，没有免费重试。药液与普通载体耗用，原特性仍守恒，回收必须按真实原处和隔周条件完成。',
    resources: { health: current.health, mind: current.mind, spirituality: current.spirituality,
      cash: `${current.cash}便士`, actionsRemaining: current.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'tyrant:0:LEARN_GUIDANCE', label: '听取暴君晋升与三岸原人群指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: current.status === 'ACTIVE' ? '须由仍活着的雷神本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  for (const root of [value.redPriest, value.visionary, value.perfecter, value.moon, value.darkness, value.whiteTower, value.tyrant]) {
    expect(Object.keys(root).sort()).toEqual(['title', 'guidanceKnown', 'promoted', 'story', 'nextStep',
      'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase'].sort());
    expect(root).toMatchObject({ guidanceKnown: false, promoted: false, insideCase: false, abilities: [] });
    expect(root.abilities).toEqual([]);
    expect(root.actions.every(action => !action.enabled)).toBe(true);
    for (const key of ['source', 'frame', 'journal']) expect(Object.hasOwn(root, key)).toBe(false);
  }
  expect(value.perfecter.sections).toEqual([]); expect(value.moon.sections).toEqual([]); expect(value.darkness.sections).toEqual([]); expect(value.whiteTower.sections).toEqual([]); expect(value.tyrant.sections).toEqual([]);
  expect(current.sun).toStrictEqual(EMPTY_SUN);
  expect(Object.hasOwn(value, 'sun')).toBe(true);
  expect(value.sun).toStrictEqual({
    title: '序列0 太阳', guidanceKnown: false, promoted: false,
    story: '玛拉与芦影、原采光廊和投降的西拉斯都留在原处，旧许可、伤势和耗料继续保留。街区接待处有洗衣房与邻楼后阶两件居民求助；须亲自问清情况、处理实际原物并完成交接，普通手段也能完成。',
    nextStep: '完成两件居民服务与现场核验；核清本人已有的一份和另外两份原特性，实地确认同一太阳唯一性空位，再为同一本人的同一瓶付费准备。实际晋1满十二周才可服药。',
    risk: '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。',
    resources: { health: current.health, mind: current.mind, spirituality: current.spirituality,
      cash: `${current.cash}便士`, actionsRemaining: current.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'sun:0:LEARN_GUIDANCE', label: '听取两件服务与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: current.status === 'ACTIVE' ? '须由仍活着的纯白天使本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  assertEmptyDeathPublic(value, current);
  const { redPriest: _redPriest, visionary: _visionary, perfecter: _perfecter, moon: _moon,
    darkness: _darkness, whiteTower: _whiteTower, tyrant: _tyrant, sun: _sun, death: _death,
    ...historical } = historicalWithoutEmptyDoorAndErrorPublic(value, current);
  // The original view predates the Hermit privacy whitelist. This existing
  // seam pins both inactive chapters before restoring only their null fields.
  const inactive = historicalInactiveHermitPublic(value, current);
  return hash({ ...historical, knowledgeEmperor: inactive.knowledgeEmperor, sage: inactive.sage });
}

// The bridge owns only a detached PUBLIC value. It never captures the 9 MB
// private campaign or a game/session closure. Separate implementations and an
// explicit disposer release even public mock results after unmount/failure.
function readOnlyBridge(value: SliceProjection) {
  let saved: SliceProjection | null = structuredClone(value);
  const current = (): SliceProjection => {
    if (!saved) throw new Error('The read-only bridge has been disposed.');
    return saved;
  };
  const run: SliceRunSummary = { runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
    week: value.week, date: { ...value.date }, status: value.status, revision: value.revision, updatedAt: '2026-10-16T21:53:11Z' };
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current()), runs: [structuredClone(run)],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(run.runId);
    return { ok: true, value: structuredClone(current()) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockResolvedValue({ ok: false,
    error: { code: 'UNEXPECTED_READ_ONLY_INTENT', message: '只读重开不应产生行动。', retryable: false } });
  return { bridge: { getBootstrap, loadRun, submitIntent } satisfies SliceBridge,
    publicHash: () => hash(current()),
    dispose() { saved = null; getBootstrap.mockReset(); loadRun.mockReset(); submitIntent.mockReset(); } };
}

async function continueOriginal(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: label => label.includes(name) }));
  return screen.findByRole('region', { name: PANEL });
}

async function assertCurrentScene(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: PANEL });
  expect(within(panel).getByRole('heading', { name: PANEL })).toBeTruthy();
  expect(panel.textContent).toContain('健康 65 · 精神 96 · 灵性 92 · 71便士 · 本周行动 2');
  expect(panel.textContent).toContain('本次救人与撤离已留下实际结果，可继续接待处生活。');
  expect(panel.textContent).toContain(value.fool.story);
  expect(panel.textContent).toContain(value.fool.risk);
  // jsdom exposes both the game HUD and this panel's own header as banners.
  // Account for both explicitly, so an extra/stale game's HUD cannot be hidden
  // by simply selecting the first banner or matching text anywhere on the page.
  const banners = screen.getAllByRole('banner');
  const huds = banners.filter(candidate => candidate.classList.contains('slice-topbar'));
  expect(huds).toHaveLength(1);
  const banner = huds[0]!;
  expect(banners.filter(candidate => candidate !== banner)).toEqual([within(panel).getByRole('banner')]);
  expect(within(banner).getByRole('button', { name: '返回主菜单' })).toBe(screen.getByRole('button', { name: '返回主菜单' }));
  expect(within(banner).getByText(`${value.character.name} · ${PANEL}`, { selector: 'strong', exact: true })).toBeTruthy();
  expect(within(banner).getByText('第五纪 1656年3月27日 · 第 16006 周', { selector: 'span', exact: true })).toBeTruthy();

  // The original final still retains an old S1 round and revival allowance.
  // Loading S0 must not route the player back into those historical screens.
  for (const name of ['愚者晋升准备', '诡秘侍者成长', '奇迹师', '古代学者', '有限复起待决选择']) {
    expect(screen.queryByRole('region', { name })).toBeNull();
  }
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button', { name: '查看愚者晋升准备' })).toBeNull();
  expect(screen.queryByRole('button', { name: '返回当前生活' })).toBeNull();
  expect(screen.queryByRole('button', { name: '核对成神条件与原遗产' })).toBeNull();

  const abilities = within(panel).getByText('已掌握的能力', { selector: 'summary' });
  const details = abilities.closest('details'); expect(details).not.toBeNull();
  if (!details!.open) await userEvent.click(abilities);
  expect(details!.open).toBe(true);
  expect(within(panel).getByRole('heading', { name: '片刻盲愚 · 熟练 0' })).toBeTruthy();
  expect(within(panel).getByRole('heading', { name: '前刻留影 · 熟练 0' })).toBeTruthy();
  for (const ability of value.fool.abilities) {
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  for (const section of value.fool.sections) {
    const region = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(region.textContent).toContain(line);
  }
  const escape = within(panel).getByRole('region', { name: '封存库的短撤离' });
  expect(escape.textContent).toContain('莉娜：健康65，在出口，实际走过12米。');
  expect(escape.textContent).toContain('苏莱：健康82，在出口，实际走过12米。');
  expect(escape.textContent).toContain('莉恩：健康82，在出口，实际走过12米。');

  // Available ordinary life choices and their real costs/reasons remain visible;
  // no action button is clicked during this read-only routing check.
  expect(value.fool.actions.map(action => action.command.type)).toEqual(['FOG', 'RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_NEXT_WEEK']);
  for (const action of value.fool.actions) {
    const button = within(panel).getByRole('button', { name: action.label }) as HTMLButtonElement;
    expect(button.disabled).toBe(!action.enabled);
    const descriptions = (button.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent);
    expect(descriptions).toContain(action.cost);
    if (action.reason) expect(descriptions).toContain(action.reason);
  }
}

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Fool SliceApp actual completed S0 terminal navigation', () => {
  it('reopens the real injured S0 current life with both new masteries zero and never submits or changes the saved campaign', async () => {
    const original = readObjectEntry<OriginalFoolState>(SOURCE, 'final');
    expect(hash(original)).toBe(FINAL_SHA256);
    expect(original).toMatchObject({ schemaVersion: 205, contentVersion: 'fool-v205', runId: 'seer-rebuild-natural', revision: 2084,
      status: 'ACTIVE', week: 16006, date: { epoch: 'FIFTH_EPOCH', year: 1656, month: 3, day: 27 },
      character: { name: '莉娜' }, health: 65, mind: 96, spirituality: 92, cash: 71, actionsRemaining: 2,
      random: { seed: 'seer-rebuild-first', cursor: 956 }, progression: { pathwayId: 'diviner', sequence: 0, mastery: {
        'diviner.s0.momentary-blindness': 0, 'diviner.s0.prior-place': 0,
      } }, fool: { guidanceKnown: true }, combat: null, activeEvent: null, ending: null,
      miracleWorker: { revival: { allowance: 4, used: 0, pendingDeathId: null, records: [] } } });
    expect(original.lastCombatRound?.attendantMysteriesOutcome).toBeTruthy();
    expect(Object.hasOwn(original, 'redPriest')).toBe(false); expect(Object.hasOwn(original, 'visionary')).toBe(false);
    expect(Object.hasOwn(original, 'perfecter')).toBe(false); expect(Object.hasOwn(original, 'moon')).toBe(false);
    expect(Object.hasOwn(original, 'darkness')).toBe(false); expect(Object.hasOwn(original, 'whiteTower')).toBe(false);
    expect(Object.hasOwn(original, 'tyrant')).toBe(false);
    for (const root of ADDED_ROOTS) expect(Object.hasOwn(original, root)).toBe(false);
    expect(EMPTY_DARKNESS).toStrictEqual(createDarknessState());
    expect(EMPTY_WHITE_TOWER).toStrictEqual(createWhiteTowerState());
    expect(EMPTY_TYRANT).toStrictEqual(createTyrantState());
    const current = migrateSliceState(original);
    assertExactMigration(original, current);
    expect(() => assertExactMigration(original, { ...current, unexpectedRoot: null } as SliceState)).toThrow();
    const missingRoot = { ...current }; Reflect.deleteProperty(missingRoot, 'fool');
    expect(() => assertExactMigration(original, missingRoot)).toThrow();
    for (const key of ADDED_ROOTS) {
      const { [key]: _missing, ...missing } = current;
      expect(() => assertExactMigration(original, missing as SliceState)).toThrow();
      expect(() => assertExactMigration(original, { ...current, [key]: { ...current[key], guidanceKnown: true } })).toThrow();
      expect(() => assertExactMigration(original, { ...current, [key]: { ...current[key], unexpectedField: undefined } })).toThrow();
    }
    expect(() => assertExactMigration(original, { ...current, darkness: { ...current.darkness,
      promotionStability: { preparations: [], unexpectedField: undefined } } } as SliceState)).toThrow();
    expect(() => assertExactMigration(original, { ...current, whiteTower: { ...current.whiteTower,
      promotionStability: { preparations: [], unexpectedField: undefined } } } as SliceState)).toThrow();
    expect(() => assertExactMigration(original, { ...current, whiteTower: null } as unknown as SliceState)).toThrow();
    expect(() => assertExactMigration(original, { ...current, tyrant: { ...current.tyrant,
      promotionStability: { preparations: [], unexpectedField: undefined } } } as SliceState)).toThrow();
    expect(() => assertExactMigration(original, { ...current, tyrant: null } as unknown as SliceState)).toThrow();
    const currentPrivateHash = hash(current);
    const value = projectSliceState(current); // Actual current production projector, exactly once.
    const currentPublicHash = hash(value);
    expect(historicalPublicHash(value, current)).toBe(PUBLIC_SHA256); expect(hash(original)).toBe(FINAL_SHA256);
    expect(historicalPublicHash({ ...value, unexpectedRoot: null } as SliceProjection, current)).not.toBe(PUBLIC_SHA256);
    const missingPublicRoot = { ...value }; Reflect.deleteProperty(missingPublicRoot, 'fool');
    expect(historicalPublicHash(missingPublicRoot, current)).not.toBe(PUBLIC_SHA256);
    for (const key of ADDED_ROOTS) {
      const { [key]: _missing, ...missing } = value;
      expect(() => historicalPublicHash(missing as SliceProjection, current)).toThrow();
      expect(() => historicalPublicHash({ ...value, [key]: { ...value[key], guidanceKnown: true } }, current)).toThrow();
      expect(() => historicalPublicHash({ ...value, [key]: { ...value[key], privateProbe: undefined } }, current)).toThrow();
    }
    for (const actions of [[], [{ ...value.darkness.actions[0]!, enabled: true }],
      [{ ...value.darkness.actions[0]!, reason: null }], [{ ...value.darkness.actions[0]!, privateProbe: undefined }]]) {
      expect(() => historicalPublicHash({ ...value, darkness: { ...value.darkness, actions } }, current)).toThrow();
    }
    expect(() => historicalPublicHash({ ...value, darkness: { ...value.darkness,
      resources: { ...value.darkness.resources, cash: '0便士' } } }, current)).toThrow();
    for (const actions of [[], [{ ...value.whiteTower.actions[0]!, enabled: true }],
      [{ ...value.whiteTower.actions[0]!, reason: null }], [{ ...value.whiteTower.actions[0]!, privateProbe: undefined }],
      [{ ...value.whiteTower.actions[0]!, command: { type: 'LEARN_GUIDANCE' as const, privateProbe: undefined } }]]) {
      expect(() => historicalPublicHash({ ...value, whiteTower: { ...value.whiteTower, actions } }, current)).toThrow();
    }
    expect(() => historicalPublicHash({ ...value, whiteTower: { ...value.whiteTower,
      resources: { ...value.whiteTower.resources, cash: '0便士' } } }, current)).toThrow();
    expect(() => historicalPublicHash({ ...value, whiteTower: null } as unknown as SliceProjection, current)).toThrow();
    for (const actions of [[], [{ ...value.tyrant.actions[0]!, enabled: true }],
      [{ ...value.tyrant.actions[0]!, reason: null }], [{ ...value.tyrant.actions[0]!, privateProbe: undefined }],
      [{ ...value.tyrant.actions[0]!, command: { type: 'LEARN_GUIDANCE' as const, privateProbe: undefined } }]]) {
      expect(() => historicalPublicHash({ ...value, tyrant: { ...value.tyrant, actions } }, current)).toThrow();
    }
    expect(() => historicalPublicHash({ ...value, tyrant: { ...value.tyrant,
      resources: { ...value.tyrant.resources, cash: '0便士' } } }, current)).toThrow();
    expect(() => historicalPublicHash({ ...value, tyrant: null } as unknown as SliceProjection, current)).toThrow();
    expect(hash(current)).toBe(currentPrivateHash);
    expect(value.fool).toMatchObject({ title: PANEL, guidanceKnown: true, promoted: true, insideCase: false,
      resources: { health: 65, mind: 96, spirituality: 92, cash: '71便士', actionsRemaining: 2 } });
    expect(value.fool.abilities).toHaveLength(36);
    for (const ability of value.fool.abilities) expect(ability.mastery).toBe(original.progression.mastery[ability.id]);
    const saved = readOnlyBridge(value); window.sliceGame = saved.bridge;
    try {
      let mounted = render(<SliceApp />);
      for (let opening = 1; opening <= 3; opening++) {
        await continueOriginal(value.character.name); await assertCurrentScene(value);
        expect(saved.bridge.loadRun).toHaveBeenCalledTimes(opening);
        expect(saved.bridge.loadRun).toHaveBeenLastCalledWith(value.runId);
        expect(saved.bridge.submitIntent).not.toHaveBeenCalled();
        expect(hash(original)).toBe(FINAL_SHA256); expect(hash(current)).toBe(currentPrivateHash);
        expect(historicalPublicHash(value, current)).toBe(PUBLIC_SHA256);
        expect(hash(value)).toBe(currentPublicHash); expect(saved.publicHash()).toBe(currentPublicHash);
        if (opening === 1) await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
        if (opening === 2) { mounted.unmount(); mounted = render(<SliceApp />); }
      }
      expect(saved.bridge.getBootstrap).toHaveBeenCalledTimes(2);
      mounted.unmount();
    } finally { cleanup(); saved.dispose(); }
  }, 120_000);
});
