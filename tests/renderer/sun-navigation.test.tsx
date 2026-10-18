/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection } from '../../src/domain/slice/types.js';
import type { SunAction } from '../../src/domain/sun/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';

const PANEL = '序列0 太阳';
const LEARN = '听取太阳晋升与居民服务指导';
const PREPARE = '组织原居民实际到场并完成本瓶付费准备';
const CONSUME = '服用当前这一瓶魔药';
const COMPOUND = 'public-sun-compound';
const WORK = '做一班实际劳动';
const action = (id: string, label: string, cost: string, command: SunAction['command']): SunAction =>
  ({ id, label, cost, command, enabled: true, reason: null });

// Controlled public presentation fixtures only. No private state is patched,
// no campaign history is replayed, and the adapter does not establish natural
// progression, domain eligibility, fair RNG or committed SQLite persistence.
function projection(guidanceKnown = false): SliceProjection {
  const base = projectSliceState(createSliceRun('sun-navigation', sliceDefaultCreationSelection, 'sun-navigation'));
  return {
    ...base, revision: 41, week: 162, cash: 400, actionsRemaining: 3,
    health: 100, mind: 100, spirituality: 120, maxSpirituality: 120,
    activeEvent: null, combat: null, lastCombatRound: null, lastResult: null, lastCheck: null,
    progression: { ...base.progression, pathwayId: 'sun', sequence: 1, acting: 100,
      mastery: { ...base.progression.mastery, 'sun.s1.focused-purification': 8 } },
    pureWhiteAngel: { ...base.pureWhiteAngel, discovered: true, promoted: true, insideCase: false,
      life: { ...base.pureWhiteAngel.life, reflected: true } },
    sun: {
      title: PANEL, guidanceKnown, promoted: false, insideCase: false,
      story: '原采光廊、旧灯油与已投降的西拉斯仍在。',
      nextStep: guidanceKnown ? '查看本瓶当前准备与原居民约定。' : '听取指导后核实两件服务与原材料。',
      risk: '服药会消耗本瓶及本次准备，严重失败可能死亡。',
      resources: { health: 100, mind: 100, spirituality: 120, cash: '400便士', actionsRemaining: 3 },
      abilities: [{ id: 'sun.s1.focused-purification', label: '净光定向', mastery: 8, description: '保留原有掌握。' }],
      actions: [guidanceKnown ? action('work', WORK, '1行动；收入按本次结算', { type: 'WORK' })
        : action('guidance', LEARN, '1行动、100便士', { type: 'LEARN_GUIDANCE' })],
      sections: [{ id: 'clock', title: '当前位置与实际日历', lines: ['街区接待处；第162周。'] }],
    },
  };
}

function changed(before: SliceProjection, resources: Partial<SliceProjection['sun']['resources']>, title: string, text: string) {
  const next = structuredClone(before);
  next.revision++;
  Object.assign(next.sun.resources, resources);
  const r = next.sun.resources;
  Object.assign(next, { health: r.health, mind: r.mind, spirituality: r.spirituality,
    cash: Number(r.cash.replace('便士', '')), actionsRemaining: r.actionsRemaining });
  next.lastResult = { id: `public-result-${next.revision}`, week: next.week, title, text };
  next.lastCheck = null;
  return next;
}

interface Transition {
  intent: SliceIntent;
  after: SliceProjection;
  firstResponse?: 'save-failed' | 'response-lost';
}

// Only the explicitly supplied public transition can be returned. The retained
// in-memory receipt models the bridge contract, not a persistence implementation.
function publicAdapter(initial: SliceProjection, transitions: Transition[] = []) {
  let current = structuredClone(initial), step = 0, failures = 0, commits = 0;
  let pendingEnvelope: SliceEnvelope | null = null;
  const receipts = new Map<string, SliceReceipt>();
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current), runs: [{ runId: current.runId,
      name: current.character.name, portraitId: current.character.portraitId, week: current.week,
      date: current.date, status: current.status, revision: current.revision, updatedAt: '2026-10-18T02:00:00Z' }],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(current.runId);
    return { ok: true, value: structuredClone(current) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (pendingEnvelope) expect(envelope).toEqual(pendingEnvelope);
    const replay = receipts.get(envelope.intentId);
    if (replay) {
      pendingEnvelope = null;
      return { ok: true, value: { ...structuredClone(replay), replayed: true } };
    }
    const transition = transitions[step];
    if (!transition) throw new Error('No public transition was supplied for this command.');
    expect(envelope).toEqual({ intentId: expect.any(String), runId: current.runId,
      expectedRevision: current.revision, payload: transition.intent });
    const firstFailure = !!transition.firstResponse && failures === 0;
    if (firstFailure) { pendingEnvelope = structuredClone(envelope); failures++; }
    if (firstFailure && transition.firstResponse === 'save-failed')
      return { ok: false, error: { code: 'SAVE_FAILED', message: '保存失败', retryable: true } };
    expect(transition.after.revision).toBe(current.revision + 1);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: current.runId,
      previousRevision: current.revision, newRevision: transition.after.revision,
      committedAt: '2026-10-18T02:01:00Z', replayed: false, state: structuredClone(transition.after) };
    current = structuredClone(transition.after); receipts.set(envelope.intentId, receipt); commits++; step++;
    if (firstFailure && transition.firstResponse === 'response-lost')
      return { ok: false, error: { code: 'RESPONSE_LOST', message: '保存回执未收到', retryable: true } };
    pendingEnvelope = null;
    return { ok: true, value: structuredClone(receipt) };
  });
  return { bridge: { getBootstrap, loadRun, submitIntent }, get current() { return current; }, get commits() { return commits; } };
}
type PublicAdapter = ReturnType<typeof publicAdapter>;

async function mount(game: PublicAdapter) {
  window.sliceGame = game.bridge;
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.current.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('region', { name: PANEL })).toBeTruthy());
  expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId);
  return view;
}

function assertPage(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: PANEL });
  const r = value.sun.resources;
  expect(panel.textContent).toContain(`健康 ${r.health} · 精神 ${r.mind} · 灵性 ${r.spirituality} · ${r.cash} · 本周行动 ${r.actionsRemaining}`);
  const topbar = screen.getByRole('button', { name: '返回主菜单' }).closest('header');
  expect(topbar).not.toBeNull();
  expect(topbar!.textContent).toContain(`${value.character.name} · ${value.sun.title}`);
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.sun.nextStep);
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '纯白天使成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  return panel;
}

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks(); });

describe('Sun SliceApp navigation with controlled public receipts', () => {
  it('opens the new page from qualified S1 guide, growth and explicit coast entries without spending', async () => {
    const before = projection(), game = publicAdapter(before);
    await mount(game);
    for (const name of ['查看太阳晋升准备', /非凡成长/, '太阳晋升与居民事务']) {
      await userEvent.click(screen.getByRole('button', { name }));
      const panel = assertPage(before);
      expect(within(panel).getByRole('button', { name: LEARN })).toBeTruthy();
      await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
      expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    }
    await userEvent.click(screen.getByRole('button', { name: '纯白天使与采光廊' }));
    expect(await screen.findByRole('region', { name: '纯白天使成长' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '查看太阳晋升准备' }));
    assertPage(before);
    expect(game.current).toEqual(before);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
  });

  it('keeps the All-Knowing Eye handoff on the reader pathway without advertising Sun', async () => {
    const before = projection();
    before.progression.pathwayId = 'white-tower';
    before.allKnowingEye = { ...before.allKnowingEye, discovered: true, promoted: true, insideCase: false,
      life: { ...before.allKnowingEye.life, reflected: true } };
    const game = publicAdapter(before); await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '全知之眼与阅览处' }));
    expect(await screen.findByRole('region', { name: '全知之眼成长' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看白塔晋升准备' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '查看太阳晋升准备' })).toBeNull();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
  });

  it.each(['unpromoted', 'unreflected', 'undigested'] as const)('does not advertise the new S1 chapter when %s', async reason => {
    const before = projection();
    if (reason === 'unpromoted') before.pureWhiteAngel.promoted = false;
    if (reason === 'unreflected') before.pureWhiteAngel.life.reflected = false;
    if (reason === 'undigested') before.progression.acting = 99;
    const game = publicAdapter(before); await mount(game);
    expect(screen.queryByRole('button', { name: '查看太阳晋升准备' })).toBeNull();
    expect(screen.queryByRole('button', { name: '太阳晋升与居民事务' })).toBeNull();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
  });

  it('keeps the actual new page open after LEARN_GUIDANCE and reloads its retained public result', async () => {
    const before = projection();
    const after = changed(before, { cash: '300便士', actionsRemaining: 2 }, '已听取太阳指导', '实付100便士与1行动，原人原物保留。');
    after.sun.guidanceKnown = true;
    after.sun.nextStep = '先查看原居民的当前选择。';
    after.sun.actions = [action('work', WORK, '1行动；收入按本次结算', { type: 'WORK' })];
    const game = publicAdapter(before, [{ intent: { type: 'SUN', command: { type: 'LEARN_GUIDANCE' } }, after }]);
    const first = await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '查看太阳晋升准备' }));
    const learn = within(assertPage(before)).getByRole('button', { name: LEARN });
    fireEvent.click(learn); fireEvent.click(learn);
    await screen.findByRole('heading', { name: '已听取太阳指导' });
    const panel = assertPage(after);
    expect(within(panel).queryByRole('button', { name: LEARN })).toBeNull();
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await waitFor(() => expect((within(panel).getByRole('button', { name: WORK }) as HTMLButtonElement).disabled).toBe(false));
    expect(game.bridge.submitIntent).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: { type: 'SUN', command: { type: 'LEARN_GUIDANCE' } } });
    const text = panel.textContent; first.unmount();
    await mount(game);
    expect(assertPage(after).textContent).toBe(text);
    expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
  });

  it('saves preparation then requires same-bottle confirmation and shows the S0 receipt immediately and on reload', async () => {
    const before = projection(true);
    before.sun.actions = [action('prepare', PREPARE, '100便士、1行动、12灵性、8精神、3600秒',
      { type: 'STABILIZE_PROMOTION', compoundId: COMPOUND })];
    before.sun.sections.push({ id: 'materials', title: '三份原特性与同一唯一性', lines: ['三份原特性与唯一性已核验；当前为同一瓶魔药。'] });
    const prepared = changed(before, { cash: '300便士', actionsRemaining: 2, spirituality: 108, mind: 92 },
      '本瓶付费准备已完成', '实付100便士、1行动、12灵性与8精神。');
    prepared.sun.actions = [action('consume', CONSUME, '1行动、30灵性；消耗本瓶载体和准备',
      { type: 'CONSUME', compoundId: COMPOUND, confirmed: true })];
    prepared.sun.sections.push({ id: 'promotion-stability', title: '本瓶当前准备', lines: ['当前成功率74%；同瓶准备仍有效。'] });
    const promoted = changed(prepared, { actionsRemaining: 1, spirituality: 78, mind: 80 },
      '已晋升序列0 太阳', '同一瓶已经耗尽；精神变化-12，灵性变化-30。');
    promoted.progression.sequence = 0; promoted.progression.acting = 0;
    promoted.sun.promoted = true;
    promoted.sun.nextStep = '查看晋升后的同一洗衣房。';
    promoted.sun.actions = [action('epilogue', '查看洗衣房险情', '按当前现场实际结算', { type: 'START_EPILOGUE' })];
    promoted.sun.sections = promoted.sun.sections.filter(section => section.id !== 'promotion-stability');
    promoted.sun.abilities.push({ id: 'sun.s0.directed-solar-radiance', label: '定向日光', mastery: 0, description: '新掌握从零开始。' });
    promoted.progression.mastery['sun.s0.directed-solar-radiance'] = 0;
    promoted.lastCheck = { ability: 'will', baseAbility: 30, effectiveAbility: 70, difficulty: 58,
      chance: 74, roll: 34, tier: 'SUCCESS', modifiers: [{ source: '本瓶当前准备', value: 40 }] };
    const game = publicAdapter(before, [
      { intent: { type: 'SUN', command: { type: 'STABILIZE_PROMOTION', compoundId: COMPOUND } }, after: prepared },
      { intent: { type: 'SUN', command: { type: 'CONSUME', compoundId: COMPOUND, confirmed: true } }, after: promoted },
    ]);
    const first = await mount(game);
    await userEvent.click(within(assertPage(before)).getByRole('button', { name: PREPARE }));
    await screen.findByRole('heading', { name: '本瓶付费准备已完成' });
    assertPage(prepared);
    await userEvent.click(screen.getByRole('button', { name: CONSUME }));
    const dialog = screen.getByRole('dialog', { name: '太阳服药确认' });
    for (const text of ['74%', '1行动、30灵性', '已付费用不退还', '严重失败可能死亡']) expect(dialog.textContent).toContain(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByRole('heading', { name: '已晋升序列0 太阳' });
    const panel = assertPage(promoted);
    expect(screen.queryByRole('dialog', { name: '太阳服药确认' })).toBeNull();
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['成功 · 意志检定', '实际掷骰 34', '精神变化-12，灵性变化-30']) expect(result.textContent).toContain(text);
    expect(within(panel).queryByRole('button', { name: CONSUME })).toBeNull();
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(within(panel).getByText('已掌握的能力', { selector: 'summary' }));
    expect(within(panel).getByRole('heading', { name: '定向日光 · 熟练 0' })).toBeTruthy();
    expect(game.bridge.submitIntent.mock.calls.map(([envelope]) => envelope.expectedRevision)).toEqual([before.revision, prepared.revision]);
    expect(game.commits).toBe(2);
    const text = panel.textContent; first.unmount(); await mount(game);
    expect(assertPage(promoted).textContent).toBe(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
  });

  it.each(['save-failed', 'response-lost'] as const)('keeps displayed resources unchanged after %s and retries the identical envelope once', async firstResponse => {
    const before = projection(true);
    const after = changed(before, { cash: '580便士', actionsRemaining: 2 }, '劳动结算', '本次工资180便士已经结算。');
    const game = publicAdapter(before, [{ intent: { type: 'SUN', command: { type: 'WORK' } }, after, firstResponse }]);
    await mount(game);
    const work = within(assertPage(before)).getByRole('button', { name: WORK });
    fireEvent.click(work); fireEvent.click(work);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    const panel = assertPage(before);
    expect(panel.textContent).not.toContain('580便士');
    expect((work as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(work); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(retry); fireEvent.click(retry);
    await screen.findByRole('heading', { name: '劳动结算' });
    assertPage(after);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.commits).toBe(1);
    expect(game.current).toEqual(after);
    expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull();
    await waitFor(() => expect((screen.getByRole('button', { name: WORK }) as HTMLButtonElement).disabled).toBe(false));
  });
});
