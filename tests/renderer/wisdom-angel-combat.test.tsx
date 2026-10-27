/* @vitest-environment jsdom */
import { assertCombatRiskDisclosure, assertCombatHealth } from './combat-risk-assertions';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice';
import { WISDOM_ANGEL_ROUND_COPY, WISDOM_ANGEL_PLAYER_LABELS, WISDOM_ANGEL_ENEMY_LABELS } from './wisdom-angel-display-expectations';
import { playerAbilityWheel } from '../../src/domain/slice/combat';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceState } from '../../src/domain/slice/types';
import { WISDOM_ANGEL_COUNT_WHEEL, WISDOM_ANGEL_ENEMY_COUNT_WHEEL, WISDOM_ANGEL_ENEMY_ABILITY_WHEEL, wisdomAngelAbilityWheel } from '../../src/domain/wisdom-angel/combat';
import {
  PANEL, snapshot, boundaryForIntent, commandBoundary, capturedCommand, savedGame, mountGame, commandControl,
  actionButton, clickCommand, assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './wisdom-angel-helper';

const firstRound = () => boundaryForIntent(i => i.type === 'COMBAT_ROUND');
const terminalRound = () => boundaryForIntent(i => i.type === 'COMBAT_ROUND', b => b.final.wisdomAngel.encounter.terminal !== null);
function assertCurrentResources(dialog: HTMLElement, state: SliceState) {
  const p = projectSliceState(state), actual = p.combat!.wisdomAngel!, e = state.wisdomAngel.encounter;
  const section = within(dialog).getByRole('region', { name: '智慧天使本回合实际资源' });
  expect(section.closest('details')).toBeNull(); const text = section.textContent!.replace(/\s+/g, ' ');
  expect(text).toContain(`本人精神 ${state.mind} / ${p.maxMind} · 灵性 ${state.spirituality} / ${p.maxSpirituality}`);
  expect(text).toContain(`原维克托精神 ${e.enemyMind} / 100 · 独立灵性 ${e.enemySpirituality} / 120`);
  expect(text).toContain(`当前条件版本 ${e.conditionVersion}`);
  expect(text).toContain(`本版实际见过 ${actual.currentObservations.map(o => o.power).join('、') || '尚无'}`);
  expect(text).toContain(`本人位置 ${e.playerLocation}，累计普通步行 ${e.playerTravelMetres} 米 / 现场 ${e.clockSeconds} 秒`);
  expect(text).toContain(`原微光片库存 ${actual.remainingCraftIds.join('、') || '已耗尽'}`);
  expect(text).toContain(actual.windowStatus); expect(text).toContain(actual.summary);
  const synthesis = e.abilityUses.SYNTHESIS, response = e.abilityUses.RESPONSE;
  expect(text).toContain(`综合尝试 ${synthesis.attempts} / 成功 ${synthesis.successes} / 实际应用 ${synthesis.effects}`);
  expect(text).toContain(`应对尝试 ${response.attempts} / 成功 ${response.successes} / 实际应用 ${response.effects}`);
  expect(actual.enemyHealth).toBe(e.enemyHealth); expect(actual.enemyMind).toBe(e.enemyMind); expect(actual.enemySpirituality).toBe(e.enemySpirituality);
  expect(actual.powerUses).toEqual(e.powerUses); expect(actual.abilityUses).toEqual(e.abilityUses); expect(actual.observations).toEqual(e.observations);
  expect(actual.currentObservations).toEqual(e.observations.filter(o => o.conditionVersion === e.conditionVersion));
  expect(actual.crafts).toEqual(state.mysticismMagister.crafts); expect(actual.responseWindow).toBeNull(); expect(actual.responseRemainingSeconds).toBe(0);
  if (actual.lastWindowSequence.length) {
    const order = within(section).getByRole('list', { name: '观察与应对实际先后' }), items = within(order).getAllByRole('listitem');
    expect(items).toHaveLength(actual.lastWindowSequence.length);
    actual.lastWindowSequence.forEach((event, i) => expect(items[i]!.textContent).toBe(`第 ${event.order} 槽 · ${event.atSeconds} 秒：${event.label}`));
    expect(actual.lastWindowSequence.map(a => a.order)).toEqual([...actual.lastWindowSequence.map(a => a.order)].sort((a, b) => a - b));
  } else expect(within(section).queryByRole('list', { name: '观察与应对实际先后' })).toBeNull();
}

describe('Wisdom Angel actual Victor combat, original items and saved ordered evidence', () => {
  it.each([
    ['approach', () => commandBoundary('ENCOUNTER_TALK')],
    ['fight choice', () => commandBoundary('ENCOUNTER_FIGHT')],
    ['first actual round', firstRound],
    ['actual terminal', terminalRound],
  ] as const)('renders the exact%s projection without state changes or invented outcomes', (_label, get) => { renderBoundaryProjection(get()); });

  it('reviews real lethal risk, cancels safely and starts the same original Victor exactly once', async () => {
    const captured = commandBoundary('ENCOUNTER_FIGHT'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭智慧天使页面' })).toBeNull();
    const panel = screen.getByRole('region', { name: PANEL });
    for (const text of ['WA2-VICTOR', '49岁', 'WA2-VICTOR-CLUB', '有限2', '身体核心24', 'M100/100', 'S120/120']) expect(panel.textContent).toContain(text);
    const trigger = await commandControl(game.state, capturedCommand(captured)); await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: '确认本次真实消耗与风险' });
    for (const text of ['不可逆死亡', '旧伤和累计风险继续生效', '不跳过共同伤势盘', '不提供复活或无条件逃跑']) expect(review.textContent).toContain(text);
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expect(actionButton(game.state, { type: 'LEAVE_ENCOUNTER' }).disabled).toBe(false);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: '确认本次真实消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' }); fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByRole('dialog', { name: projectSliceState(migrateSliceState(captured.final)).combat!.title ?? "普通人追击" });
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    expect(game.state.wisdomAngel.encounter).toMatchObject({ targetId: 'WA2-VICTOR', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', playerLocation: 'DOORSTEP', conditionVersion: 1, observations: [], responseWindow: null });
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.random).toEqual(before.random); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each([['first', firstRound], ['terminal', terminalRound]] as const)('shows actual wheels/resources and commits the exact%s recorded round without a reveal reroll', async (_label, get) => {
    const captured = get(), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected an actual captured round');
    const intent = captured.lastIntent, battle = projectSliceState(before).combat!;
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" }); assertCurrentResources(stage, before);
    expect(battle.wisdomAngel?.targetId).toBe('WA2-VICTOR'); expect(battle.playerCountWheel).toEqual(WISDOM_ANGEL_COUNT_WHEEL);
    expect(battle.enemyCountWheel).toEqual(WISDOM_ANGEL_ENEMY_COUNT_WHEEL); expect(battle.enemyAbilityWheel.map(({ label: _label, ...mechanics }) => mechanics)).toEqual(WISDOM_ANGEL_ENEMY_ABILITY_WHEEL.map(({ label: _label, ...mechanics }) => mechanics));
    expect(battle.enemyAbilityWheel.map(a => a.label)).toEqual(WISDOM_ANGEL_ENEMY_LABELS);
    expect(battle.playerAbilityWheel.map(({ label: _label, ...mechanics }) => mechanics)).toEqual(playerAbilityWheel(before, null).map(({ label: _label, ...mechanics }) => mechanics));
    expect(before.town.clubLocation).toBe('HAND');
    expect(wisdomAngelAbilityWheel(before, null).find(entry => entry.id === 'STRIKE')).toEqual({
      id: 'STRIKE', label: '本人普通打击（原身体12/实际在手原棍16×身体G）', weight: 15,
    });
    expect(battle.playerAbilityWheel.map(a => a.label)).toEqual(WISDOM_ANGEL_PLAYER_LABELS); expect(battle.playerAbilityWheel.map(a => a.weight)).toEqual([20, 20, 15, 15, 15, 15]);
    expect(battle.enemyAbilityWheel.map(a => [a.id, a.weight])).toEqual([['FLASH', 35], ['WARD', 25], ['BODY_STRIKE', 20], ['FEINT', 15], ['ACCIDENT', 5]]);
    assertCombatHealth(stage, before.health, battle.enemyHealth);
    expect(within(stage).getByRole('heading', { name: battle.enemyName })).toBeTruthy();
    const risk = await assertCombatRiskDisclosure(stage, battle.consequenceWeights);
    for (const text of [`轻伤 ${battle.consequenceWeights.light}%`, `重伤 ${battle.consequenceWeights.heavy}%`, `死亡 ${battle.consequenceWeights.death}%`]) expect(risk.textContent).toContain(text);
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const entry of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.enemyAbilityWheel) expect(within(stage).getByText(/^对手能力盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.playerAbilityWheel) expect(within(stage).getByText(/^你的能力盘：/).textContent).toContain(entry.label);
    const stance = battle.stances.find(a => a.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: label => label.startsWith(stance.label) })); expect(game.submit).not.toHaveBeenCalled();
    const confirm = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }); fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state, { combat: true });
    expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    const round = game.state.lastCombatRound!, o = round.wisdomAngelOutcome!, result = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(o.source.revision).toBe(before.revision); expect(o.source.randomCursor).toBe(before.random.cursor); expect(o.source.randomSeed).toBe(before.random.seed);
    expect(o.randomCursorAfter).toBe(game.state.random.cursor); expect(o.abilityUses).toEqual(game.state.wisdomAngel.encounter.abilityUses);
    expect(o.observations).toEqual(game.state.wisdomAngel.encounter.observations); expect(o.source.flashSample).toEqual(before.polymath.samples.FLASH);
    expect(o.source.crafts).toEqual(before.mysticismMagister.crafts); expect(o.craftsAfter).toEqual(game.state.mysticismMagister.crafts);
    expect(game.state.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
    const expectedCopy = WISDOM_ANGEL_ROUND_COPY[_label === 'first' ? 'combat-first' : 'combat-terminal'];
    const rawAfter = structuredClone(game.state), displayedRound = projectSliceState(game.state).lastCombatRound!;
    expect(game.state.revision).toBe(expectedCopy.revision); expect(round.round).toBe(expectedCopy.round);
    expect(round.moves.map(move => move.label)).toEqual(expectedCopy.rawMoves); expect(round.consequence).toBe(expectedCopy.rawConsequence);
    expect(displayedRound.moves.map(move => move.label)).toEqual(expectedCopy.displayMoves); expect(displayedRound.consequence).toBe(expectedCopy.displayConsequence);
    expect(displayedRound.moves.map(({ label: _label, ...mechanics }) => mechanics)).toEqual(round.moves.map(({ label: _label, ...mechanics }) => mechanics));
    for (const label of expectedCopy.displayMoves) expect(result.textContent).toContain(label); expect(result.textContent).toContain(expectedCopy.displayConsequence);
    expect(game.state).toEqual(rawAfter);
    const after = structuredClone(game.state); await userEvent.click(within(result).getByRole('checkbox', { name: '快速显示本回合结果' }));
    expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole('button', { name: '进入下一回合' })); const next = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
      assertCurrentResources(next, game.state); await userEvent.click(within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: 'summary' }));
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    } else {
      expect(game.state.wisdomAngel.encounter.terminal).not.toBeNull();
      await userEvent.click(within(result).getByRole('button', { name: game.state.status === 'DEAD' ? '查看收尾卷宗' : '返回生活' }));
      expect(screen.queryByRole('dialog', { name: battle.title ?? "普通人追击" })).toBeNull(); expect(game.state.wisdomAngel.encounter.playerLocation).toBe(game.state.status === 'DEAD' ? 'DOORSTEP' : 'OUTSIDE');
    }
  }, 30_000);

  it('keeps a failed round save pending and retries the identical original source envelope without extra draws', async () => {
    const captured = firstRound(), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true }), before = structuredClone(game.state);
    if (captured.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected an actual round');
    const battle = projectSliceState(before).combat!, intent = captured.lastIntent, stance = battle.stances.find(a => a.id === intent.stance)!;
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByRole('button', { name: label => label.startsWith(stance.label) }));
    const confirm = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: '重试这次操作' }).at(-1)!); await screen.findByRole('dialog', { name: '战斗回合结果' });
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertLegacyPreserved(before, game.state, { combat: true });
  }, 20_000);

  it('displays actual terminal attempts, observations and item consumption without inventing response success or victory', () => {
    const captured = terminalRound(), state = migrateSliceState(captured.final), e = state.wisdomAngel.encounter;
    renderBoundaryProjection(captured); const panel = screen.getByRole('region', { name: PANEL });
    for (const [name, use] of [['条件综合', e.abilityUses.SYNTHESIS], ['已见方法应对', e.abilityUses.RESPONSE]] as const) {
      expect(panel.textContent).toContain(`${name}：尝试${use.attempts} / 成功${use.successes} / 应用${use.effects}`);
    }
    expect(panel.textContent).toContain(`M${e.enemyMind}/100 · S${e.enemySpirituality}/120`); expect(panel.textContent).toContain(`当前实际条件版本${e.conditionVersion}`);
    expect(panel.textContent).toContain('当前没有未使用应对窗口');
    for (const o of e.observations) expect(panel.textContent).toContain(`第${o.round}轮第${o.order}序：${o.power}，条件版本${o.conditionVersion}，实际付${o.paidCost}灵性，${o.atSeconds}秒`);
    expect(e.enemySpirituality).toBe(120 - e.powerUses.FLASH * 7 - e.powerUses.WARD * 6 - e.powerUses.FEINT * 3);
    const terminal = e.terminal!; expect(terminal.round).toBe(terminal.historyIndex - e.startHistoryIndex! + 1);
    const o = state.combatHistory[terminal.historyIndex]!.wisdomAngelOutcome!; expect(o.abilityUses).toEqual(e.abilityUses); expect(o.craftsAfter).toEqual(state.mysticismMagister.crafts);
    expect(e.enemyStatus).toBe(terminal.enemyStatus); expect(e.playerLocation).toBe(state.status === 'DEAD' ? 'DOORSTEP' : 'OUTSIDE');
    expect(state.progression.mastery).toEqual(snapshot('practiced').progression.mastery);
  });

  it('uses a separately chosen peaceful exit with actual movement and no combat or free restored resource', async () => {
    const game = savedGame(commandBoundary('ENCOUNTER_FIGHT').beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'LEAVE_ENCOUNTER' }); const e = game.state.wisdomAngel.encounter;
    expect(game.state.combat).toBeNull(); expect(game.state.combatHistory).toEqual(before.combatHistory);
    expect(e).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', terminal: null, playerLocation: 'OUTSIDE' });
    expect(e.playerTravelMetres).toBe(before.wisdomAngel.encounter.playerTravelMetres + 2); expect(e.clockSeconds).toBe(before.wisdomAngel.encounter.clockSeconds + 2);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.cash).toBe(before.cash); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.progression).toEqual(before.progression); expect(game.state.wisdomAngel.life).toEqual(before.wisdomAngel.life); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('reloads the exact actual terminal, including any recorded death, without reviving or replaying a spell', async () => {
    const captured = terminalRound(), game = savedGame(captured.final), before = structuredClone(game.state);
    await mountGame(game); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); cleanup(); delete window.sliceGame;
    const restored = savedGame(captured.final); await mountGame(restored);
    expect(restored.state).toEqual(before); expect(restored.submit).not.toHaveBeenCalled(); assertLegacyPreserved(before, restored.state);
    expect(restored.state.injuries).toEqual(before.injuries); expect(restored.state.wisdomAngel.encounter).toEqual(before.wisdomAngel.encounter);
  }, 20_000);
});
