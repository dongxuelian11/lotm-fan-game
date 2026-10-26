/* @vitest-environment jsdom */
import { assertCombatRiskDisclosure, assertCombatHealth } from './combat-risk-assertions';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { playerText } from '../../src/shared/player-text.js';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceState } from '../../src/domain/slice/types';
import { CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL, CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL, concealmentServantAbilityWheel } from '../../src/domain/concealment-servant/combat';
import {
  PANEL, boundary, snapshot, capturedCommand, savedGame, mountGame, commandControl,
  actionButton, clickCommand, view, assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './concealment-servant-ui-fixture';

function assertCurrentResources(dialog: HTMLElement, state: SliceState) {
  const projected = projectSliceState(state), actual = projected.combat!.concealmentServant!, encounter = state.concealmentServant.encounter;
  const section = within(dialog).getByRole('region', { name: '隐秘之仆本回合实际资源' });
  expect(section.closest('details')).toBeNull(); const text = section.textContent!.replace(/\s+/g, ' ');
  expect(text).toContain(`本人精神 ${state.mind} / ${projected.maxMind} · 灵性 ${state.spirituality} / ${projected.maxSpirituality}`);
  expect(text).toContain(`原奥斯温精神 ${encounter.enemyMind} / 100 · 独立灵性 ${encounter.enemySpirituality} / 120`);
  expect(actual.enemyMind).toBe(encounter.enemyMind); expect(actual.enemySpirituality).toBe(encounter.enemySpirituality);
  expect(actual.abilityUses).toEqual(encounter.abilityUses); expect(actual.companion).toEqual(state.spiritWarlock.companion);
  expect(actual.room).toEqual(encounter.room); expect(actual.playerLocation).toBe(encounter.playerLocation);
  expect(text).toContain(`原门 ${encounter.room.doorId} · 实际开放`);
  expect(text).toContain(`本人位置 ${encounter.playerLocation}，累计普通步行 ${encounter.playerTravelMetres} 米 / 现场 ${encounter.clockSeconds} 秒`);
  expect(text).toContain(`隐秘剩余 ${actual.concealmentRemainingSeconds} 秒；遮踪剩余 ${actual.veilRemainingSeconds} 秒`);
  expect(text).toContain(actual.windowStatus);
  const conceal = encounter.abilityUses.BOUNDED_CONCEALMENT, veil = encounter.abilityUses.TRACE_VEIL;
  expect(text).toContain(`有限隐秘尝试 ${conceal.attempts} / 成功 ${conceal.successes} / 实际应用 ${conceal.effects}`);
  expect(text).toContain(`遮踪尝试 ${veil.attempts} / 成功 ${veil.successes} / 实际应用 ${veil.effects}`);
  expect(text).toContain(`原卷叶 ${state.spiritWarlock.companion.source} · ${state.spiritWarlock.companion.status}`);
  expect(text).toContain('本场不会赠送或复制灵'); expect(text).toContain(actual.summary);
  expect(actual.concealmentRemainingSeconds).toBe(0); expect(actual.veilRemainingSeconds).toBe(0);
  if (actual.lastWindowSequence.length) {
    const order = within(section).getByRole('list', { name: '隐秘与锚定实际先后' });
    const items = within(order).getAllByRole('listitem'); expect(items).toHaveLength(actual.lastWindowSequence.length);
    actual.lastWindowSequence.forEach((event, i) => expect(items[i]!.textContent).toBe(`第 ${event.order} 槽 · ${event.atSeconds} 秒：${event.label}`));
    expect(actual.lastWindowSequence.map(event => event.order)).toEqual([...actual.lastWindowSequence.map(event => event.order)].sort((a, b) => a - b));
  } else expect(within(section).queryByRole('list', { name: '隐秘与锚定实际先后' })).toBeNull();
}

describe('Concealment Servant original Oswin, true resources and ordered bounded windows', () => {
  it.each(['original-enemy-approach', 'original-enemy-fight', 'combat-first', 'combat-terminal'])('renders exact saved %s without changing the enemy, original body or histories', renderBoundaryProjection);

  it('reviews real lethal consequences, cancels safely and starts the same original Oswin only once', async () => {
    const captured = boundary('original-enemy-fight'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭隐秘之仆页面' })).toBeNull();
    const panel = screen.getByRole('region', { name: PANEL });
    for (const text of ['CS2-OSWIN', '47岁', 'CS2-OSWIN-CLUB', '有限2', '身体核心24', 'M100/100', 'S120/120']) expect(panel.textContent).toContain(text);
    const trigger = await commandControl(game.state, capturedCommand(captured)); await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: '确认本次真实消耗与风险' });
    for (const text of ['伤势、投降或不可逆死亡', '当前原伤和累计风险继续生效', '不跳过共同伤势盘', '不提供复活或无条件逃跑']) expect(review.textContent).toContain(text);
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    expect(actionButton(game.state, { type: 'LEAVE_ENCOUNTER' }).disabled).toBe(false);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: '确认本次真实消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' }); fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByRole('dialog', { name: projectSliceState(migrateSliceState(captured.final)).combat!.title ?? "普通人追击" });
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    expect(game.state.concealmentServant.encounter).toMatchObject({ targetId: 'CS2-OSWIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', playerLocation: 'DOORSTEP' });
    expect(game.state.spiritWarlock).toEqual(before.spiritWarlock); expect(game.state.injuries).toEqual(before.injuries); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['combat-first', 'combat-terminal'])('shows actual wheels and current resources, then commits exact %s without a reveal reroll', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected an actual recorded combat round.');
    const intent = captured.lastIntent, battle = projectSliceState(before).combat!;
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    expect(battle.concealmentServant?.targetId).toBe('CS2-OSWIN'); assertCurrentResources(stage, before);
    expect(battle.playerCountWheel.map(entry => entry.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(battle.enemyCountWheel).toEqual(CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL);
    expect(battle.enemyAbilityWheel).toEqual(CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL.map(entry => ({ ...entry, label: playerText(entry.label) })));
    expect(battle.enemyAbilityWheel.map(entry => [entry.id, entry.weight])).toEqual([
      ['DARK_BOLT', 35], ['WARD', 25], ['BODY_STRIKE', 20], ['ANCHOR_LIGHT', 15], ['ACCIDENT', 5],
    ]);
    expect(battle.playerAbilityWheel).toEqual(concealmentServantAbilityWheel(before, null).map(entry => ({ ...entry, label: playerText(entry.label) })));
    expect(battle.playerAbilityWheel.map(entry => entry.weight)).toEqual([20, 20, 20, 15, 10, 15]);
    expect(battle.enemyAbilityWheel.map(entry => entry.label)).toEqual([
      '有限暗矢：7S/105；仍需检索原目标', '有限护术：6S/减60', '原门口可达原身体：原棍20×身体',
      '原场照明锚：4S/每轮一次，打断当前或下一新窗口', '判断偏差：−22.5',
    ]);
    expect(battle.playerAbilityWheel.map(entry => entry.label)).toEqual([
      '有限房间隐秘（6S/知识18；≤60秒，后续暗矢才减35）',
      '有限遮踪（5S/意志18；原弱标记≤20秒，后续暗矢才减20）',
      '继承黑暗毁灭（6S/知识18，65×原掌握）', '继承睡恐短时压力（5S/意志18，减32）',
      '继承有限厄运（4S/意志16，减22）', '同一原卷叶（先2S派出0贡献；后槽2S协助减22）',
    ]);
    assertCombatHealth(stage, before.health, battle.enemyHealth);
    expect(within(stage).getByRole('heading', { name: battle.enemyName })).toBeTruthy();
    const risk = await assertCombatRiskDisclosure(stage, battle.consequenceWeights);
    for (const text of [`轻伤 ${battle.consequenceWeights.light}%`, `重伤 ${battle.consequenceWeights.heavy}%`, `死亡 ${battle.consequenceWeights.death}%`]) expect(risk.textContent).toContain(text);
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const entry of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.enemyAbilityWheel) expect(within(stage).getByText(/^对手能力盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.playerAbilityWheel) expect(within(stage).getByText(/^你的能力盘：/).textContent).toContain(entry.label);
    const stance = battle.stances.find(s => s.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: label => label.startsWith(stance.label) }));
    expect(game.submit).not.toHaveBeenCalled(); const confirm = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(confirm); fireEvent.click(confirm); await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state, { combat: true });
    expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    const round = game.state.lastCombatRound!, outcome = round.concealmentServantOutcome!, result = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(outcome.source.revision).toBe(before.revision); expect(outcome.source.randomCursor).toBe(before.random.cursor);
    expect(outcome.source.randomSeed).toBe(before.random.seed); expect(outcome.randomCursorAfter).toBe(game.state.random.cursor);
    expect(outcome.abilityUses).toEqual(game.state.concealmentServant.encounter.abilityUses);
    expect(outcome.enemySpirituality).toBe(game.state.concealmentServant.encounter.enemySpirituality);
    expect(outcome.source.companion).toEqual(before.spiritWarlock.companion); expect(outcome.companionAfter).toEqual(game.state.spiritWarlock.companion);
    expect(outcome.source.clubHeld).toBe(before.town.clubLocation === 'HAND');
    for (const move of round.moves) expect(result.textContent).toContain(playerText(move.label));
    expect(result.textContent).toContain(playerText(round.consequence));
    const after = structuredClone(game.state); await userEvent.click(within(result).getByRole('checkbox', { name: '快速显示本回合结果' }));
    expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole('button', { name: '进入下一回合' }));
      const next = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" }); assertCurrentResources(next, game.state);
      await userEvent.click(within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: 'summary' }));
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    } else {
      expect(game.state.concealmentServant.encounter.terminal).not.toBeNull();
      await userEvent.click(within(result).getByRole('button', { name: game.state.status === 'DEAD' ? '查看收尾卷宗' : '返回生活' }));
      expect(screen.queryByRole('dialog', { name: battle.title ?? "普通人追击" })).toBeNull();
      if (game.state.status === 'DEAD') expect(game.state.concealmentServant.encounter.playerLocation).toBe('DOORSTEP');
      else expect(game.state.concealmentServant.encounter.playerLocation).toBe('OUTSIDE');
    }
  }, 30_000);

  it('keeps a failed round save pending and retries the identical source envelope without additional draws', async () => {
    const captured = boundary('combat-first'), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true }), before = structuredClone(game.state);
    if (captured.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected an actual round.');
    const intent = captured.lastIntent, battle = projectSliceState(before).combat!, stance = battle.stances.find(s => s.id === intent.stance)!;
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByRole('button', { name: label => label.startsWith(stance.label) }));
    const confirm = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const retries = screen.getAllByRole('button', { name: '重试这次操作' }); await userEvent.click(retries.at(-1)!);
    await screen.findByRole('dialog', { name: '战斗回合结果' });
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertLegacyPreserved(before, game.state, { combat: true });
  }, 20_000);

  it('preserves exact actual terminal attempts, effects, independent S and original bodies rather than inventing victory or a round count', () => {
    const captured = boundary('combat-terminal'), state = migrateSliceState(captured.final), encounter = state.concealmentServant.encounter;
    renderBoundaryProjection('combat-terminal'); const panel = screen.getByRole('region', { name: PANEL });
    const conceal = encounter.abilityUses.BOUNDED_CONCEALMENT, veil = encounter.abilityUses.TRACE_VEIL;
    expect(panel.textContent).toContain(`战斗隐秘：尝试${conceal.attempts} / 成功${conceal.successes} / 实际效果${conceal.effects}`);
    expect(panel.textContent).toContain(`遮踪：尝试${veil.attempts} / 成功${veil.successes} / 实际效果${veil.effects}`);
    expect(panel.textContent).toContain(`M${encounter.enemyMind}/100 · S${encounter.enemySpirituality}/120`);
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.DARK_BOLT * 7 - encounter.powerUses.WARD * 6 - encounter.powerUses.ANCHOR_LIGHT * 4);
    expect(encounter.terminal).not.toBeNull(); expect(encounter.terminal!.round).toBe(state.combatHistory.length - encounter.startHistoryIndex!);
    expect(encounter.terminal!.historyIndex).toBe(state.combatHistory.length - 1);
    const last = state.combatHistory[encounter.terminal!.historyIndex]!;
    expect(last.concealmentServantOutcome!.abilityUses).toEqual(encounter.abilityUses);
    expect(encounter.enemyStatus).toBe(encounter.terminal!.enemyStatus);
    expect(encounter.playerLocation).toBe(state.status === 'DEAD' ? 'DOORSTEP' : 'OUTSIDE');
    expect(state.progression.mastery).toEqual(migrateSliceState(snapshot('practiced')).progression.mastery);
    expect(state.spiritWarlock.companion.source).toBe('SW5-LEAF-1'); expect(state.spiritWarlock.companion.status).toBe('SEALED');
  });

  it('uses an explicitly separate peaceful-exit branch and actually walks out without awarding combat', async () => {
    const game = savedGame(boundary('original-enemy-fight').beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'LEAVE_ENCOUNTER' });
    const encounter = game.state.concealmentServant.encounter;
    expect(game.state.combat).toBeNull(); expect(game.state.combatHistory).toEqual(before.combatHistory);
    expect(encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', terminal: null, playerLocation: 'OUTSIDE' });
    expect(encounter.playerTravelMetres).toBe(before.concealmentServant.encounter.playerTravelMetres + 2);
    expect(encounter.clockSeconds).toBe(before.concealmentServant.encounter.clockSeconds + 2);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.cash).toBe(before.cash); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); expect(game.state.concealmentServant.life).toEqual(before.concealmentServant.life);
    expect(game.state.spiritWarlock).toEqual(before.spiritWarlock); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('reloads the exact actual terminal, including an actual death if recorded, without reviving or replaying an attack', async () => {
    const captured = boundary('combat-terminal'), game = savedGame(captured.final), before = structuredClone(game.state);
    await mountGame(game); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    cleanup(); delete window.sliceGame;
    const restored = savedGame(captured.final); await mountGame(restored);
    expect(restored.state).toEqual(before); expect(restored.submit).not.toHaveBeenCalled();
    assertLegacyPreserved(before, restored.state); expect(restored.state.injuries).toEqual(before.injuries);
    expect(restored.state.concealmentServant.encounter).toEqual(before.concealmentServant.encounter);
  }, 20_000);
});
