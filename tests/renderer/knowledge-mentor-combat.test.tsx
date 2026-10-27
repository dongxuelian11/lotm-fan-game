/* @vitest-environment jsdom */
import { assertCombatRiskDisclosure } from './combat-risk-assertions';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import { KNOWLEDGE_MENTOR_ROUND_COPY } from './knowledge-mentor-display-expectations';
import {
  PANEL, boundary, naturalEntry, capturedCommand, savedGame, mountGame, actionButton,
  commandControl, clickCommand, view, assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './knowledge-mentor-ui-fixture';

describe('Knowledge Mentor real Rowan wheels, actual use counters and physical exits', () => {
  it.each(['rowan-actual-entry', 'combat-start', 'combat-first', 'combat-terminal', 'ordinary-life-after-actual-exit'])('renders actual %s without inventing success, restoration or another actor', renderBoundaryProjection);

  it('reviews the real lethal encounter, cancels safely, then starts the same Rowan exactly once', async () => {
    const captured = boundary('combat-start'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭知识导师页面' })).toBeNull();
    const encounter = screen.getByRole('region', { name: '知识导师原人遭遇' });
    for (const text of ['KM2-ROWAN-HALE', '48岁', 'KM2-ROWAN-CLUB']) expect(encounter.textContent).toContain(text);
    const trigger = await commandControl(game.state, capturedCommand(captured)); await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    expect(dialog.textContent).toContain('真实战斗，会产生伤势、投降或不可逆死亡');
    expect(dialog.textContent).toContain('不借用其他途径复活');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    expect(actionButton(game.state, { type: 'LEAVE_ENCOUNTER' }).disabled).toBe(false);
    await userEvent.click(trigger); dialog = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    const confirm = within(dialog).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByRole('dialog', { name: projectSliceState(migrateSliceState(captured.final)).combat!.title ?? "普通人追击" });
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.knowledgeMentor.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND' });
    expect(game.state.knowledgeMentor.encounter.carriedPlateIds).toEqual(['KM2-COMBAT-PLATE-1']);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['combat-first', 'combat-terminal'])('shows resolver count/ability wheels and commits the exact original %s round', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected original COMBAT_ROUND.');
    const intent = captured.lastIntent, battle = projectSliceState(before).combat!;
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    expect(battle.knowledgeMentor?.targetId).toBe('KM2-ROWAN-HALE');
    expect(battle.playerCountWheel.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(battle.enemyCountWheel.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(battle.enemyAbilityWheel.map(e => [e.id, e.weight])).toEqual([
      ['ARC_BOLT', 30], ['WARD', 20], ['JAM', 20], ['BODY_STRIKE', 20], ['OBSERVE', 5], ['ACCIDENT', 5],
    ]);
    expect(stage.textContent).toContain(battle.knowledgeMentor!.summary);
    expect(within(stage).getByRole('heading', { name: battle.enemyName })).toBeTruthy();
    const risk = await assertCombatRiskDisclosure(stage, battle.consequenceWeights);
    for (const text of [`轻伤 ${battle.consequenceWeights.light}%`, `重伤 ${battle.consequenceWeights.heavy}%`, `死亡 ${battle.consequenceWeights.death}%`]) expect(risk.textContent).toContain(text);
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const entry of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.enemyAbilityWheel) expect(within(stage).getByText(/^对手能力盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.playerAbilityWheel) expect(within(stage).getByText(/^你的能力盘：/).textContent).toContain(entry.label);
    const stance = battle.stances.find(s => s.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: n => n.startsWith(stance.label) }));
    expect(game.submit).not.toHaveBeenCalled();
    const confirm = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    assertLegacyPreserved(before, game.state);
    const round = game.state.lastCombatRound!, result = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(round.knowledgeMentorOutcome?.source.revision).toBe(before.revision);
    const expected = name === 'combat-first' ? KNOWLEDGE_MENTOR_ROUND_COPY['combat-first'] : KNOWLEDGE_MENTOR_ROUND_COPY['combat-terminal'];
    const rawAfter = structuredClone(game.state), displayedRound = projectSliceState(game.state).lastCombatRound!;
    expect(round.moves.map(move => move.label)).toEqual(expected.rawMoves);
    expect(round.consequence).toBe(expected.rawConsequence);
    expect(displayedRound.moves.map(move => move.label)).toEqual(expected.displayMoves);
    expect(displayedRound.consequence).toBe(expected.displayConsequence);
    expect(displayedRound.moves.map(({ label: _label, ...mechanics }) => mechanics)).toEqual(round.moves.map(({ label: _label, ...mechanics }) => mechanics));
    for (const label of expected.displayMoves) expect(result.textContent).toContain(label);
    expect(result.textContent).toContain(expected.displayConsequence);
    expect(game.state).toEqual(rawAfter);
    const after = structuredClone(game.state);
    await userEvent.click(within(result).getByRole('checkbox', { name: '快速显示本回合结果' }));
    expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole('button', { name: '进入下一回合' }));
      const next = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
      await userEvent.click(within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: 'summary' }));
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    } else {
      expect(game.state.status).toBe('ACTIVE');
      expect(game.state.knowledgeMentor.encounter.terminal).toMatchObject({ outcome: 'ENEMY_DEAD', round: 4 });
      await userEvent.click(within(result).getByRole('button', { name: '返回生活' }));
      expect(screen.queryByRole('dialog', { name: battle.title ?? "普通人追击" })).toBeNull();
    }
  }, 20_000);

  it('shows actual attempted/succeeded/applied counters separately, exhausted original plate, and mastery-zero caveat', async () => {
    const game = savedGame(naturalEntry('final')), before = structuredClone(game.state), e = before.knowledgeMentor.encounter;
    expect(e).toMatchObject({ protocolUses: 1, protocolSuccesses: 0, calibrationUses: 1, calibrationSuccesses: 1, calibrationEffects: 0, totalOwnerMindSpent: 1 });
    expect(e.powerUses).toEqual({ ARC_BOLT: 4, WARD: 2, JAM: 2 });
    expect(e.enemySpirituality).toBe(120 - 4 * 7 - 2 * 6 - 2 * 3);
    await mountGame(game);
    await userEvent.click(screen.getByText('罗温原人的可选冲突与普通出口', { selector: 'summary' }));
    const facts = screen.getByRole('region', { name: '知识导师原人遭遇' });
    for (const text of ['封装实际尝试1次，成功0次', '校准实际尝试1次，成功1次', '后续原造物实际受益0次', '本人精神实耗1', '独立灵性74', '已真实死亡']) expect(facts.textContent).toContain(text);
    await userEvent.click(screen.getByText('有限战斗指令片与付费补能记录', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('KM2-COMBAT-PLATE-1 · 已耗尽，实物仍在');
    expect(before.knowledgeMentor.life.combatPlates[0]).toMatchObject({ status: 'SPENT', location: 'PLAYER' });
    expect(before.knowledgeMentor.life.combatPlates.slice(1).every(p => p.status === 'FAILED' && p.location === 'RECYCLE')).toBe(true);
    await userEvent.click(screen.getByText('三项实践、实际尝试与掌握', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('掌握0不表示从未尝试，也不否认已付成本');
    expect(before.progression.mastery['paragon.s3.bounded-analysis']).toBe(0);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('restores actual terminal resources and original people without replaying attacks or replacing the dead Rowan', async () => {
    const captured = boundary('combat-terminal'), game = savedGame(captured.final), before = structuredClone(game.state);
    expect(before.knowledgeMentor.encounter).toMatchObject({ enemyHealth: 0, enemyMind: 100, enemySpirituality: 74, enemyStatus: 'DEAD', weaponLocation: 'YARD', exitTravelMetres: 4, exitSeconds: 4 });
    expect(before.knowledgeMentor.encounter.retrievedIds).toEqual(['AL4-BOX-1', 'AL4-FRAME-1']);
    expect(before.knowledgeMentor.encounter.retrievedPlateIds).toEqual(['KM2-COMBAT-PLATE-1']);
    for (const original of before.alchemist.life.creations) expect(original).toMatchObject({ location: 'PLAYER', active: false });
    await mountGame(game); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    expect(actionButton(game.state, { type: 'ENCOUNTER_TALK' }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'ENCOUNTER_FIGHT' }).disabled).toBe(true);
    cleanup(); delete window.sliceGame;
    const restored = savedGame(captured.final); await mountGame(restored);
    expect(restored.state).toEqual(before); expect(restored.submit).not.toHaveBeenCalled();
    expect(restored.state.alchemist.encounter.enemy?.status).toBe('DEAD');
    expect(restored.state.arcaneScholar.encounter.enemyStatus).toBe('SURRENDERED');
    assertLegacyPreserved(before, restored.state);
  }, 20_000);

  it('uses the independent peaceful exit branch without combat, reward, recharge or free replacement plates', async () => {
    // Explicit alternative UI branch from the original pre-fight save.
    const game = savedGame(boundary('combat-start').beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'LEAVE_ENCOUNTER' });
    expect(game.state.combat).toBeNull(); expect(game.state.combatHistory).toEqual(before.combatHistory);
    expect(game.state.knowledgeMentor.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', terminal: null, exitTravelMetres: 4, exitSeconds: 4 });
    expect(game.state.cash).toBe(before.cash); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    for (const original of game.state.alchemist.life.creations) {
      const prior = before.alchemist.life.creations.find(o => o.id === original.id)!;
      expect(original).toMatchObject({ location: 'PLAYER', active: false, charge: prior.charge, durability: prior.durability });
    }
    expect(game.state.knowledgeMentor.life.combatPlates[0]).toMatchObject({ id: 'KM2-COMBAT-PLATE-1', status: 'READY', location: 'PLAYER' });
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('submits actual ordinary work after physical exit and preserves all three different original-person endings', async () => {
    const captured = boundary('ordinary-life-after-actual-exit'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' });
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state).toMatchObject({ status: 'ACTIVE', week: 169, health: 70, mind: 99, spirituality: 113 });
    expect(game.state.knowledgeMentor).toEqual(before.knowledgeMentor);
    expect(game.state.combatHistory).toEqual(before.combatHistory);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);
});
