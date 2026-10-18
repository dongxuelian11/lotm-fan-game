/* @vitest-environment jsdom */
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent } from '../../src/domain/slice/types';
import {
  COMBAT_BOUNDARIES, boundary, savedGame, mountGame, actionButton, clickCommand,
  assertLegacyPreserved, assertSavedEnvelope, naturalEntry, renderBoundaryProjection,
} from './discerner-ui-fixture';

describe('Discerner actual combat wheels, consequences and ordinary exits', () => {
  it.each(COMBAT_BOUNDARIES)('projects the actual %s snapshot without manufacturing a victory, death or recovery', name => renderBoundaryProjection(name));

  it('starts the same actual new opponent with original independent resources and preserves every older encounter', async () => {
    const captured = boundary('combat-start'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game);
    expect(screen.queryByRole('button', { name: '关闭洞察者页面' })).toBeNull();
    expect(screen.getByRole('region', { name: '洞察者独立原人遭遇' }).textContent).toContain('DCR2-ALRIC-VALE');
    await clickCommand(game, { type: 'ENCOUNTER_FIGHT' });
    await screen.findByRole('dialog', { name: projectSliceState(game.state).combat!.title ?? "普通人追击" });
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.discerner.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND' });
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['combat-first', 'combat-terminal'])('displays the actual six-count and ability wheels, visible risk, and saves the original %s outcome', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual captured round command.');
    const intent = captured.lastIntent, battle = projectSliceState(before).combat!;
    await mountGame(game);
    const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    expect(battle.discerner?.targetId).toBe('DCR2-ALRIC-VALE');
    expect(battle.playerCountWheel.map(e => e.weight)).toEqual([15, 20, 25, 20, 15, 5]);
    expect(battle.enemyCountWheel.map(e => e.weight)).toEqual([15, 20, 25, 20, 15, 5]);
    expect(battle.enemyAbilityWheel.map(e => [e.id, e.weight])).toEqual([
      ['PSYCHIC_STRIKE', 30], ['MENTAL_WARD', 20], ['COMPOSE', 20], ['BODY_STRIKE', 20], ['OBSERVE', 5], ['ACCIDENT', 5],
    ]);
    expect(within(stage).getByRole('heading', { name: battle.enemyName })).toBeTruthy();
    expect(stage.textContent).toContain(battle.discerner!.summary);
    const risk = within(stage).getByRole('region', { name: '伤势与恢复路线' });
    expect(risk.closest('details')).toBeNull();
    for (const text of [`轻伤 ${battle.consequenceWeights.light}%`, `重伤 ${battle.consequenceWeights.heavy}%`, `死亡 ${battle.consequenceWeights.death}%`]) expect(risk.textContent).toContain(text);
    const wheelDetails = within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' });
    expect(wheelDetails.closest('details')!.open).toBe(false); await userEvent.click(wheelDetails);
    for (const entry of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.enemyAbilityWheel) expect(within(stage).getByText(/^对手能力盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.playerAbilityWheel) expect(within(stage).getByText(/^你的能力盘：/).textContent).toContain(entry.label);
    const stance = battle.stances.find(s => s.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
    expect(game.state.lastCombatRound?.discernerOutcome?.source.revision).toBe(before.revision);
    const round = game.state.lastCombatRound!, result = await screen.findByRole('dialog', { name: '战斗回合结果' });
    const displayRound = projectSliceState(game.state).lastCombatRound!;
    const expectedDisplay = {
      "combat-first": {
        "labels": [
          "近距有限心灵印记意志检定100>76失败，实付6S+2M不退；没有优势、未知记忆或真相结论。",
          "原阿尔里克·维尔用自己的唯一原棍DCR2-ALRIC-CLUB作普通打击20×身体。",
          "本轮该有限能力已经尝试一次，不能重试或重骰；本人原身体普通自保减势10，不重抽、不产生身份或免伤。",
          "原阿尔里克·维尔本人对梦像、印记与窗口的有限精神抵抗：实际独立原灵性−3、余117/120；本轮下一次成功施展的梦像、印记或窗口抵抗30%提高到70%，消费后或本轮结束失效，不无限抵抗，不借本人资源。",
          "本轮该有限能力已经尝试一次，不能重试或重骰；本人原身体普通自保减势10，不重抽、不产生身份或免伤。",
          "原阿尔里克·维尔普通观察眼前原身体与出口，0消耗0贡献，没有免费精神抵抗。"
        ],
        "consequence": "同一原阿尔里克·维尔在独立净空石院2米外，独立灵性120/120。同一原阿尔里克·维尔本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。本轮有限外部身份归并、梦像、印记与洞察窗口停止，双方临时护持和抵抗结束；真实精神与灵性消耗不退，既有感染不会因停像消失。"
      },
      "combat-terminal": {
        "labels": [
          "原阿尔里克·维尔普通观察眼前原身体与出口，0消耗0贡献，没有免费精神抵抗。",
          "梦像施术55≤76、对方抵抗36>30，同一原阿尔里克·维尔本次信以为真，精神实际−2、余0，有限优势38×掌握；没有实体召神、物理伤害或永久控制，梦像本动作结束。"
        ],
        "consequence": "同一原阿尔里克·维尔在独立净空石院2米外，独立灵性1/120。原精神瘟疫本轮实际−12M、余2，病势现3；离场不自动治愈。原阿尔里克·维尔精神降0而停止抵抗；不是物理死亡或永久夺心，原感染与物品保留。本轮有限外部身份归并、梦像、印记与洞察窗口停止，双方临时护持和抵抗结束；真实精神与灵性消耗不退，既有感染不会因停像消失。"
      }
    };
    const { labels: displayLabels, consequence: displayConsequence } = expectedDisplay[name as keyof typeof expectedDisplay];
    expect(displayRound.moves).toEqual(round.moves.map((move, index) => ({ ...move, label: displayLabels[index] })));
    expect(displayRound.consequence).toBe(displayConsequence);
    expect(round).toEqual(migrateSliceState(captured.final).lastCombatRound);
    expect(within(result).getByRole('heading', { name: `第 ${round.round} 回合结果` })).toBeTruthy();
    for (const label of displayLabels) expect(result.textContent).toContain(label);
    expect(result.textContent).toContain(displayConsequence);
    const after = structuredClone(game.state);
    await userEvent.click(within(result).getByRole('checkbox', { name: '快速显示本回合结果' }));
    expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole('button', { name: '进入下一回合' }));
      expect(screen.getByRole('dialog', { name: battle.title ?? "普通人追击" })).toBeTruthy();
    } else {
      expect(game.state.status).toBe('ACTIVE');
      expect(game.state.discerner.encounter).toMatchObject({ enemyHealth: 90, enemyMind: 0, enemySpirituality: 1, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD', exitTravelMetres: 4, exitSeconds: 4, mentalPlague: 3 });
      expect(game.state.discerner.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 10 });
      await userEvent.click(within(result).getByRole('button', { name: '返回生活' }));
      expect(screen.queryByRole('dialog', { name: battle.title ?? "普通人追击" })).toBeNull();
    }
  }, 20_000);

  it('pays for actual consented post-exit aid without restoring the original opponent health, mind, spirituality or weapon', async () => {
    const captured = boundary('aid-enemy'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'AID_ENEMY' });
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
    const prior = before.discerner.encounter, current = game.state.discerner.encounter;
    expect(current.mentalPlague).toBe(prior.mentalPlague - 1);
    expect(current.helpHistory.at(-1)).toEqual({ week: before.week, before: prior.mentalPlague, after: prior.mentalPlague - 1, fee: 40 });
    for (const key of ['enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'weaponLocation', 'enemyInjuries', 'terminal'] as const) expect(current[key]).toEqual(prior[key]);
    // The captured last action advances the real week; compare the whole saved
    // state rather than pretending the weekly living cost or AP refresh did not occur.
    expect(game.state.week).toBe(before.week + 1);
  }, 20_000);

  it('submits the actual ordinary work after exit with the same surrendered original person, paid aid and preserved history', async () => {
    const captured = boundary('ordinary-life-after-exit'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' });
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
    expect(game.state.discerner).toEqual(before.discerner); expect(game.state.combatHistory).toEqual(before.combatHistory);
    expect(game.state).toMatchObject({ status: 'ACTIVE', week: 126, health: 98, mind: 98, spirituality: 120, cash: 560 });
    expect(game.state.discerner.encounter.helpHistory.map(h => h.week)).toEqual([124, 125, 126]);
    expect(game.state.discerner.encounter.helpHistory.every(h => h.fee === 40)).toBe(true);
  }, 20_000);

  it('allows an explicitly separate peaceful UI exit from the real pre-fight state without combat, rewards or a replacement person', async () => {
    // This public-command branch is not represented as the natural ten-round outcome.
    const game = savedGame(boundary('combat-start').beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'LEAVE_ENCOUNTER' });
    expect(game.state.combat).toBeNull(); expect(game.state.combatHistory).toEqual(before.combatHistory);
    expect(game.state.discerner.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', terminal: null, exitTravelMetres: 4, exitSeconds: 4 });
    expect(game.state.cash).toBe(before.cash); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(actionButton(game.state, { type: 'ENCOUNTER_TALK' }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'ENCOUNTER_FIGHT' }).disabled).toBe(true);
    assertLegacyPreserved(before, game.state);
    await userEvent.click(screen.getByRole('button', { name: '关闭洞察者页面' }));
    expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy();
  }, 20_000);

  it('keeps the separate original 443-command death read-only with no S2 route or ordinary-life reopening', async () => {
    const file = 'tests/fixtures/dream-weaver-v01420/natural.json';
    expect(readObjectEntry<SliceIntent[]>(file, 'commands')).toHaveLength(443);
    const game = savedGame(readObjectEntry(file, 'final')), before = structuredClone(game.state);
    expect(before.status).toBe('DEAD'); expect(before.health).toBe(0); expect(before.progression.sequence).toBe(3);
    expect(before.discerner.promotionWeek).toBeNull();
    await mountGame(game);
    expect(screen.getByRole('heading', { name: before.ending!.title })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '洞察者与有限印记' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^独立确认服用第/ })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    cleanup(); delete window.sliceGame;
    const reloaded = savedGame(readObjectEntry(file, 'final')); await mountGame(reloaded);
    expect(screen.getByRole('heading', { name: before.ending!.title })).toBeTruthy();
    expect(reloaded.state).toEqual(before); expect(reloaded.submit).not.toHaveBeenCalled();
    expect(naturalEntry<string>('stage')).toBe('FULL_NATURAL_BRANCH');
    // The new living route is a continuation of the old peaceful save, never this archive.
    expect(migrateSliceState(naturalEntry('departureStart')).status).toBe('ACTIVE');
  }, 20_000);
});
