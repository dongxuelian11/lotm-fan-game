/* @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

vi.setConfig({ testTimeout: 60_000 });
const ROOT = 'tests/fixtures/conqueror-v01870';
const PANEL = '征服者成长';
const ENTRY = '征服者与原院协作';
const boundary = (name: string) => `${ROOT}/boundary-${name}.json`;
const capturedState = (file: string, entry: string) => migrateSliceState(readObjectEntry<unknown>(file, entry));

/** Unedited captures from the original 658-command campaign continuation.
 * Migration and submitted public intents are the only state transformations.
 * No fabricated history, resource overrides, selected seeds or rerolls. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input);
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('This original campaign already exists.');
    expect(envelope.runId).toBe(state.runId);
    expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload);
    assertValidSliceState(state);
    return { ok: true, value: {
      intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T09:45:00Z', replayed: false, state: projectSliceState(state),
    } };
  });
  return { get state() { return state; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;

async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name,
        portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status,
        revision: state.revision, updatedAt: '2026-10-15T09:44:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  const rendered = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
  return rendered;
}

async function acknowledgeSavedRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合)$/ }));
}

async function openCurrentGrowth() {
  await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
  return screen.findByRole('region', { name: PANEL });
}

function assertCurrentIdentityAndResources(state: SliceState) {
  const current = projectSliceState(state);
  expect(current.character.name).toBe('罗温');
  expect(screen.getByRole('banner').textContent).toContain(`${current.character.name} · ${current.conqueror.title}`);
  const resources = screen.getByRole('region', { name: '征服者当前资源' });
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}

function assertCombatResources(stage: HTMLElement, state: SliceState) {
  const current = projectSliceState(state), actual = current.combat?.conqueror;
  if (!actual) throw new Error('Expected the captured current Conqueror combat projection.');
  expect(within(stage).getByRole('heading', { name: state.character.name })).toBeTruthy();
  const resources = within(stage).getByRole('region', { name: '征服者本回合实际资源' });
  expect(resources.textContent).toContain(`本人健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`${actual.enemyName}：健康${actual.enemyHealth}、精神${actual.enemyMind}、灵性${actual.enemySpirituality}`);
  expect(actual.targetId).toBe('CQ1-RONAN-HALE');
  expect(actual.materials).toEqual(state.conqueror.encounter.materials);
  expect(actual.materials.weapon).toMatchObject({ id: 'CQ1-RONAN-IRON-ROD', sourceId: 'CQ1-RONAN-OWNED-IRON-1', owner: actual.targetId });
  expect(actual.materials.water).toMatchObject({ id: 'CQ1-RONAN-WATER-BUCKET', sourceId: 'CQ1-RONAN-OWNED-WATER-1', owner: actual.targetId });
  expect(resources.textContent).toContain(`对手原铁杖温度${actual.materials.weapon.temperatureC}度，完整度${actual.materials.weapon.condition}`);
  expect(resources.textContent).toContain(actual.weaponLocation === 'HAND' ? '仍在对手手中' : '留在原空地');
  expect(resources.textContent).toContain(`原冷却水剩余${actual.materials.water.remainingLitres}升`);
  expect(resources.textContent).toContain('没有实际队友在场');
  expect(state.conqueror.encounter.scene.presentMemberIds).toEqual([]);
  expect(within(stage).queryByRole('region', { name: '天气术士本回合实际资源' })).toBeNull();
}

function assertActualRound(reveal: HTMLElement, round: SliceCombatRound) {
  const outcome = round.conquerorOutcome;
  if (!outcome) throw new Error('Expected the actual captured Conqueror round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).not.toContain('损耗10点');
  const actual = within(reveal).getByRole('region', { name: '征服者本回合实际记录' });
  expect(actual.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(actual.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  if (round.consequenceDomain === 'BODY') {
    if (!round.consequenceWeights) throw new Error('The captured BODY round must retain its actual consequence wheel.');
    const weights = round.consequenceWeights;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
    expect(actual.textContent).toContain('本回合按实际身体冲击结算伤势');
  } else {
    expect(round.consequenceDomain).toBeUndefined();
    expect(round.consequenceWeights).toBeNull();
    expect(actual.textContent).toContain('本回合没有身体或精神后果盘');
    expect(reveal.textContent).not.toContain('败者后果盘：轻伤');
  }
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(actual).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    const row = rows[index]!;
    expect(row.textContent).toContain(action.label);
    expect(row.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(row.textContent).toContain(`本槽后原铁杖温度${action.materialsAfter.weapon.temperatureC}度、完整度${action.materialsAfter.weapon.condition}`);
    expect(row.textContent).toContain(`对手原水剩余${action.materialsAfter.water.remainingLitres}升`);
    expect(row.textContent).toContain(`实际队员${action.actualMemberIds.length}人`);
  });
}

async function submitCapturedRound(game: SavedGame, file: string) {
  const intent = readObjectEntry<SliceIntent>(file, 'lastIntent');
  if (intent.type !== 'COMBAT_ROUND') throw new Error('Expected the recorded round command.');
  const before = structuredClone(game.state), battle = projectSliceState(before).combat!;
  const stage = await screen.findByRole('dialog', { name: battle.title! });
  assertCombatResources(stage, before);
  const stance = battle.stances.find(entry => entry.id === intent.stance)!;
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
  expect(game.submit).not.toHaveBeenCalled();
  expect(game.state).toEqual(before);
  await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
  const expected = capturedState(file, 'final');
  await waitFor(() => expect(game.state).toEqual(expected));
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
  assertActualRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), expected.lastCombatRound!);
  return expected;
}

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Conqueror original saved S1 navigation and actual combat continuation', () => {
  it('opens the actual promoted S1 growth ahead of the historical Weather Warlock page and round', async () => {
    const game = savedGame(readObjectEntry<unknown>(boundary('consume-conqueror-potion-3'), 'final'));
    const before = structuredClone(game.state), current = projectSliceState(before);
    expect(before.progression).toMatchObject({ pathwayId: 'hunter', sequence: 1 });
    expect(current.weatherWarlock.promoted).toBe(true);
    expect(before.lastCombatRound?.weatherWarlockOutcome).toBeTruthy();
    expect(before.lastCombatRound?.conquerorOutcome).toBeUndefined();
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openCurrentGrowth();
    expect(within(panel).getByRole('heading', { name: current.conqueror.title })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '天气术士' })).toBeNull();
    expect(screen.queryByRole('region', { name: '战争主教' })).toBeNull();
    expect(screen.queryByRole('button', { name: /独立确认服用第/ })).toBeNull();
    assertCurrentIdentityAndResources(before);
    expect(game.submit).not.toHaveBeenCalled();
    expect(game.state).toEqual(before);
  });

  it('reopens the natural week200 original name, current injured body, both mastery8 skills and original five people at home', async () => {
    const game = savedGame(readObjectEntry<unknown>(`${ROOT}/natural.json`, 'final'));
    const before = structuredClone(game.state), current = projectSliceState(before);
    expect(before).toMatchObject({ status: 'ACTIVE', week: 200, health: 80, mind: 100, spirituality: 120, injuryRisk: 1 });
    expect(before.injuries).toHaveLength(2);
    expect(before.injuries.every(injury => injury.severity === 'LIGHT' && injury.treatedRevision === null)).toBe(true);
    await mount(game); await acknowledgeSavedRound();
    const panel = await openCurrentGrowth();
    assertCurrentIdentityAndResources(before);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    for (const id of ['hunter.s1.formation-momentum', 'hunter.s1.focused-flame']) {
      const ability = current.conqueror.abilities.find(entry => entry.id === id)!;
      expect(ability.mastery).toBe(8);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握8` })).toBeTruthy();
    }
    const members = within(panel).getByRole('region', { name: '原五位同伴的实际状态' });
    expect(current.conqueror.life.members.map(member => member.id)).toEqual(['IB4-01', 'IB4-02', 'IB4-03', 'IB4-04', 'IB4-05']);
    for (const member of current.conqueror.life.members) {
      expect(member).toMatchObject({ location: 'HOME', present: false });
      expect(members.textContent).toContain(`${member.name}：健康${member.health}/100 · 精力${member.energy}/20`);
    }
    expect(within(members).getAllByRole('listitem')).toHaveLength(5);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('closes current S1 growth to the ordinary dashboard with legal work and rest, without restoring old-stage actions', async () => {
    const game = savedGame(readObjectEntry<unknown>(`${ROOT}/natural.json`, 'final'));
    const before = structuredClone(game.state);
    await mount(game); await acknowledgeSavedRound(); await openCurrentGrowth();
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect((screen.getByRole('button', { name: /^工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /^休养，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(projectSliceState(game.state).weatherWarlock.actions).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: '天气术士与有限天气' }));
    const history = await screen.findByRole('region', { name: '天气术士' });
    expect(within(within(history).getByRole('group', { name: '天气术士公开行动' })).queryAllByRole('button')).toEqual([]);
    expect(within(history).queryByRole('button', { name: /独立确认服用|领取第|实际检查本次服药场地/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭天气术士页面' }));
    await openCurrentGrowth();
    assertCurrentIdentityAndResources(before);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('loads the first real combat beforeLast ahead of old results, submits its exact DEFEND command and reopens its no-consequence round', async () => {
    const file = boundary('combat-round-1'), game = savedGame(readObjectEntry<unknown>(file, 'beforeLast'));
    const before = structuredClone(game.state);
    expect(before.lastCombatRound?.weatherWarlockOutcome).toBeTruthy();
    expect(readObjectEntry<SliceIntent>(file, 'lastIntent')).toEqual({ type: 'COMBAT_ROUND', stance: 'DEFEND' });
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const expected = await submitCapturedRound(game, file);
    expect(expected.lastCombatRound?.consequenceDomain).toBeUndefined();
    expect(expected.conqueror.encounter.enemySpirituality).toBe(112);
    cleanup(); await mount(game);
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertActualRound(reveal, expected.lastCombatRound!);
    await userEvent.click(within(reveal).getByRole('checkbox', { name: '快速显示本回合结果' }));
    await acknowledgeSavedRound();
    assertCombatResources(await screen.findByRole('dialog', { name: projectSliceState(expected).combat!.title! }), expected);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the actual first round from second beforeLast, then submits and reopens the exact second BODY result without rerolling', async () => {
    const file = boundary('combat-round-2'), game = savedGame(readObjectEntry<unknown>(file, 'beforeLast'));
    const before = structuredClone(game.state);
    expect(before.lastCombatRound?.round).toBe(1);
    expect(before.lastCombatRound?.consequenceDomain).toBeUndefined();
    expect(readObjectEntry<SliceIntent>(file, 'lastIntent')).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    await mount(game);
    assertActualRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), before.lastCombatRound!);
    await acknowledgeSavedRound();
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    const expected = await submitCapturedRound(game, file);
    expect(expected.lastCombatRound?.consequenceDomain).toBe('BODY');
    expect(expected.conqueror.encounter).toMatchObject({ enemyHealth: 90, enemyMind: 100, enemySpirituality: 107 });
    expect(expected.injuries).toEqual(before.injuries);
    cleanup(); await mount(game);
    assertActualRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), expected.lastCombatRound!);
    await acknowledgeSavedRound();
    assertCombatResources(await screen.findByRole('dialog', { name: projectSliceState(expected).combat!.title! }), expected);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('acknowledges the real terminal BODY round and saves the captured ordinary WORK without reviving Ronan or replacing his originals', async () => {
    const file = boundary('ordinary-life-after-exit'), game = savedGame(readObjectEntry<unknown>(file, 'beforeLast'));
    const before = structuredClone(game.state), expected = capturedState(file, 'final');
    expect(before.combat).toBeNull();
    expect(before.conqueror.encounter).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD', status: 'RESOLVED',
      terminal: { outcome: 'ENEMY_DEAD', round: 8, exitMetres: 12, exitSeconds: 12 }, scene: { playerLocation: 'WORKSHOP' } });
    await mount(game);
    assertActualRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), before.lastCombatRound!);
    await acknowledgeSavedRound();
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.submit).not.toHaveBeenCalled();
    const intent = readObjectEntry<SliceIntent>(file, 'lastIntent');
    expect(intent).toEqual({ type: 'ACTION', action: 'WORK' });
    await userEvent.click(screen.getByRole('button', { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(expected));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: intent });
    expect(game.state.conqueror.encounter).toEqual(before.conqueror.encounter);
    expect(game.state.weatherWarlock).toEqual(before.weatherWarlock);
    await openCurrentGrowth();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '征服者目标' }), 'encounter');
    const encounter = screen.getByRole('region', { name: '征服者可选真实交战' });
    expect(encounter.textContent).toContain('罗南·黑尔');
    expect(encounter.textContent).toContain('健康0/100、精神100/100、灵性25/120 · 已死亡');
    const materials = within(encounter).getByRole('region', { name: '对手原铁杖与原水' });
    expect(materials.textContent).toContain('已落在原院地面');
    expect(materials.textContent).toContain(`原水还剩${expected.conqueror.encounter.materials.water.remainingLitres}/20升`);
    expect(projectSliceState(game.state).conqueror.encounter.actions.every(action => !action.enabled)).toBe(true);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('keeps the exact pre-guidance658 source at S2 and shows only its real historical round before opening the optional preparation page', async () => {
    expect(readObjectEntry<number>(`${ROOT}/natural.json`, 'prefixCount')).toBe(658);
    const game = savedGame(readObjectEntry<unknown>(`${ROOT}/natural.json`, 'prefixFinal'));
    const before = structuredClone(game.state), current = projectSliceState(before);
    expect(before.progression).toMatchObject({ pathwayId: 'hunter', sequence: 2 });
    expect(before.conqueror.guidanceKnown).toBe(false);
    expect(before.conqueror.promotionWeek).toBeNull();
    expect(before.combat).toBeNull();
    expect(before.lastCombatRound?.weatherWarlockOutcome).toBeTruthy();
    expect(before.lastCombatRound?.conquerorOutcome).toBeUndefined();
    await mount(game);
    const historical = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(historical.textContent).toContain(current.lastCombatRound!.consequence);
    expect(within(historical).queryByRole('region', { name: '征服者本回合实际记录' })).toBeNull();
    await acknowledgeSavedRound();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(within(panel).getByRole('region', { name: '征服者服药准备' })).toBeTruthy();
    expect(current.conqueror.abilities).toEqual([]);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('region', { name: '征服者本回合实际资源' })).toBeNull();
    assertCurrentIdentityAndResources(before);
    const guidance = current.conqueror.actions.find(action => action.command.type === 'LEARN_GUIDANCE')!;
    const control = within(panel).getByRole('button', { name: name => name.startsWith(guidance.label) }) as HTMLButtonElement;
    expect(control.disabled).toBe(!guidance.enabled);
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });
});
