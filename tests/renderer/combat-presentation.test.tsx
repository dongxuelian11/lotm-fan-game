/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import {
  applySliceIntent,
  createSliceRun,
  projectSliceState,
} from '../../src/domain/slice/index.js';
import type { SliceProjection, SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { CombatStage, firstCaseInjuryTarget } from '../../src/renderer/CombatStage.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';

afterEach(() => {
  cleanup();
  delete window.sliceGame;
  vi.restoreAllMocks();
});

function choose(state: SliceState, choiceId: string): SliceState {
  const event = projectSliceState(state).activeEvent;
  if (!event) throw new Error(`No active event for ${choiceId}`);
  return applySliceIntent(state, {
    type: 'EVENT_CHOICE',
    eventInstanceId: event.instanceId,
    choiceId,
  });
}

function successfulLedgerSeed(): string {
  for (let index = 0; index < 1000; index += 1) {
    const seed = `combat-presentation-ledger-${index}`;
    const roll = new DeterministicActionRandomStream(seed).nextInt(1, 100);
    if (roll >= 6 && roll <= 20) return seed;
  }
  throw new Error('Could not find a deterministic ledger-success seed');
}

// Enter the real first case through the same public intents as a new player.
// Only deterministic random seeds are selected; no battle/result fixtures are patched.
function firstCase(): SliceState {
  let state = createSliceRun(
    'combat-presentation',
    sliceDefaultCreationSelection,
    'combat-presentation-opening',
  );
  state = choose(state, '.decline');
  state = applySliceIntent(state, {
    type: 'ACTION', action: 'INVESTIGATE', targetId: 'LIFE-LEAD-NIGHTSHIFT',
  });
  state.random = { seed: successfulLedgerSeed(), cursor: 0 };
  state = choose(state, 'A_LEDGER');
  state = applySliceIntent(state, { type: 'ACTION', action: 'WORK' });
  state = applySliceIntent(state, { type: 'ACTION', action: 'REST' });
  state = choose(state, 'B_SHARE');
  state = choose(state, 'SKIP');
  state = applySliceIntent(state, {
    type: 'ACTION', action: 'INVESTIGATE', targetId: 'ARC-C',
  });
  state = choose(state, 'C_PURSUIT');
  expect(state.combat?.encounterId).toBe('FIRST_CASE');
  return state;
}

function resolvedRound(
  accepts: (state: SliceState) => boolean,
  stance: SliceStance = 'ATTACK',
): SliceState {
  const initial = firstCase();
  for (let index = 0; index < 256; index += 1) {
    const candidate = structuredClone(initial);
    candidate.random = { seed: `combat-presentation-round-${index}`, cursor: 0 };
    const state = applySliceIntent(candidate, { type: 'COMBAT_ROUND', stance });
    if (accepts(state)) return state;
  }
  throw new Error(`Could not find a deterministic ${stance} round matching the case`);
}

async function openSave(state: ReturnType<typeof projectSliceState>) {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const bridge: SliceBridge = {
    getBootstrap: vi.fn(async () => ({
      ok: true as const,
      value: {
        mode: 'browser' as const,
        activeState: state,
        runs: [{
          runId: state.runId,
          name: state.character.name,
          portraitId: state.character.portraitId,
          week: state.week,
          date: state.date,
          status: state.status,
          revision: state.revision,
          updatedAt: '2026-10-22T12:00:00Z',
        }],
      },
    })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(async () => ({
      ok: false as const,
      error: { code: 'UNEXPECTED_INTENT', message: 'Presentation must not submit an intent', retryable: false },
    })),
  };
  window.sliceGame = bridge;
  render(<SliceApp />);
  fireEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(state.character.name) }));
  await screen.findByRole('heading', { name: '人物卷宗' });
  return bridge;
}

async function openCombat(state: ReturnType<typeof projectSliceState>) {
  const bridge = await openSave(state);
  const dialog = await screen.findByRole('dialog', {
      name: state.lastCombatRound ? '战斗回合结果' : (state.combat?.title ?? '普通人追击'),
  });
  return { bridge, dialog };
}

function visibleWheels(dialog: HTMLElement) {
  const region = within(dialog).getByRole('region', { name: '本回合转盘' });
  expect(region.closest('details')).toBeNull();
  const wheels = Array.from(region.querySelectorAll('.slice-wheel'));
  expect(wheels).toHaveLength(3);
  for (const wheel of wheels) expect(wheel.closest('details')).toBeNull();
  expect(wheels.map((wheel) => wheel.querySelector('.slice-wheel-center small')?.textContent))
    .toEqual(['你的次数', '对手次数', '回合胜负']);
  return region;
}

function wheelValues(region: HTMLElement) {
  return Array.from(region.querySelectorAll('.slice-wheel-center strong'))
    .map((value) => value.textContent);
}

function expectSavedMoveSummary(dialog: HTMLElement, state: SliceProjection) {
  const summary = within(dialog).getByLabelText('本回合动作与胜势');
  expect(summary.closest('details')).toBeNull();
  const round = state.lastCombatRound!;
  for (const [actor, own, opposing, label] of [
    ['PLAYER', '你的', '对手', '你的本回合动作'],
    ['ENEMY', '对手', '你的', '对手本回合动作'],
  ] as const) {
    const row = within(summary).getByLabelText(label);
    const moves = round.moves.filter((move) => move.actor === actor);
    const text = row.textContent!.replace(/\s+/g, '');
    expect(text).toContain(moves.length ? moves.map((move) => move.label).join('→') : '未执行动作');
    if (moves.length) {
      expect(text).toContain(`${own}胜势+${moves.reduce((sum, move) => sum + move.selfGain, 0)}`);
      expect(text).toContain(`${opposing}胜势−${moves.reduce((sum, move) => sum + move.enemyReduction, 0)}`);
    } else {
      expect(text).not.toMatch(/胜势[+−-]\d/);
    }
  }
  expect(summary.querySelectorAll('p[aria-label]')).toHaveLength(2);
  expect(summary.textContent).not.toMatch(/伤害\s*[:：]?\s*[+−-]?\d|健康\s*[+−-]\d/);
  return summary;
}

function expectGenericEnemyMark(enemy: HTMLElement) {
  expect(enemy.querySelector('img')).toBeNull();
  const mark = enemy.querySelector('svg.combat-enemy-mark');
  expect(mark?.getAttribute('aria-hidden')).toBe('true');
  expect(mark?.querySelector('path')?.getAttribute('d'))
    .toBe('M45 10 77 25 72 78 45 110 18 78 13 25Z');
}

describe('combat stage presents saved gameplay without inventing outcomes', () => {
  it('uses accessible current health values from the first-case projection', () => {
    const state = projectSliceState(firstCase());
    render(<CombatStage state={state} round={null} fast={false} />);

    const healthBars = [
      screen.getByRole('progressbar', { name: '你的健康' }),
      screen.getByRole('progressbar', { name: '对手健康' }),
    ];
    expect(healthBars).toHaveLength(2);
    expect(healthBars.map((bar) => Number(bar.getAttribute('aria-valuenow'))))
      .toEqual([state.health, state.combat!.enemyHealth]);
    expect(healthBars.map((bar) => Number(bar.getAttribute('aria-valuemax'))))
      .toEqual([state.maxHealth, 100]);
    for (const bar of healthBars) {
      expect(bar.getAttribute('aria-label') ?? bar.getAttribute('aria-labelledby')).toBeTruthy();
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
    }
    expect(screen.getByRole('region', { name: '当前战场' }).getAttribute('data-animated'))
      .toBe('false');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('选择姿态，再结算这一回合')).toBeTruthy();
  });

  it('shows actual post-round health instead of turning advantage into damage', () => {
    const saved = resolvedRound((state) => Boolean(
      state.combat && state.combat.enemyHealth < 100,
    ));
    const state = projectSliceState(saved);
    const round = state.lastCombatRound!;
    const before = JSON.stringify(state);
    const { container } = render(<CombatStage state={state} round={round} fast={false} />);

    const healthBars = screen.getAllByRole('progressbar');
    expect(healthBars.map((bar) => Number(bar.getAttribute('aria-valuenow'))))
      .toEqual([state.health, state.combat!.enemyHealth]);
    expect(container.textContent).not.toMatch(/伤害\s*[:：]?\s*\+?\d|伤害值|伤害\s*=\s*优势/);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('uses the selected player portrait and the named first-case enemy portrait', () => {
    const state = projectSliceState(firstCase());
    render(<CombatStage state={state} round={null} fast={false} />);

    const stage = screen.getByRole('region', { name: '当前战场' });
    const portrait = within(stage).getByRole('region', { name: '你的战斗状态' })
      .querySelector('img');
    expect(portrait?.getAttribute('src')).toContain(
      `assets/portraits/portrait_${state.character.portraitId.replace('portrait-', '').padStart(2, '0')}.webp`,
    );
    expect(portrait?.getAttribute('alt')).toBe('');
    expect(stage.classList.contains('combat-stage-boiler')).toBe(true);
    expect(within(stage).getByRole('heading', { name: state.character.name })).toBeTruthy();
    expect(within(stage).getByRole('heading', { name: state.combat!.enemyName })).toBeTruthy();
    const enemy = within(stage).getByRole('region', { name: '对手战斗状态' });
    const enemyPortrait = within(enemy).getByRole('img', { name: '持短棍的携铃者' });
    expect(enemyPortrait.getAttribute('src')).toBe(
      `${import.meta.env.BASE_URL}assets/npcs/bell-bearer.png`,
    );
    expect(enemyPortrait.classList.contains('combat-portrait')).toBe(true);
    expect(enemyPortrait.classList.contains('combat-enemy-portrait')).toBe(true);
    expect(enemy.querySelector('svg')).toBeNull();
  });

  it.each(['普通人追击', '首案 · 追击携铃者（其他遭遇）', undefined])(
    'keeps the generic enemy mark for a battle titled %s', (title) => {
      const original = projectSliceState(firstCase());
      // Change only the presentation title to prove the portrait uses the exact gate,
      // not the opponent name or another first-case field from the saved projection.
      const state = { ...original, combat: { ...original.combat! } };
      if (title === undefined) delete state.combat.title;
      else state.combat.title = title;
      const before = JSON.stringify(state);
      render(<CombatStage state={state} round={null} fast={false} />);

      const stage = screen.getByRole('region', { name: '当前战场' });
      const enemy = within(stage).getByRole('region', { name: '对手战斗状态' });
      expect(stage.classList.contains('combat-stage-boiler')).toBe(false);
      expectGenericEnemyMark(enemy);
      expect(within(enemy).getByRole('heading', { name: state.combat.enemyName })).toBeTruthy();
      expect(within(enemy).getByRole('progressbar', { name: '对手健康' })
        .getAttribute('aria-valuenow')).toBe(String(state.combat.enemyHealth));
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it.each([
    ['PLAYER', '你赢得本回合'],
    ['ENEMY', '对手赢得本回合'],
  ] as const)('prominently shows the actual %s round winner and action counts', (winner, label) => {
    const saved = resolvedRound((state) => Boolean(
      state.combat && state.lastCombatRound?.winner === winner,
    ));
    const state = projectSliceState(saved);
    const round = state.lastCombatRound!;
    render(<CombatStage state={state} round={round} fast={false} />);

    const outcome = screen.getByRole('status');
    expect(within(outcome).getByText(label)).toBeTruthy();
    expect(outcome.textContent).toContain(`行动次数：你 ${round.playerCount} · 对手 ${round.enemyCount}`);
    expect(outcome.textContent).toContain(round.first === 'PLAYER' ? '你先行动' : '对手先行动');
  });

  it.each(['PLAYER', 'ENEMY'] as const)('makes failed retreat clear even when %s wins the exchange', (winner) => {
    const saved = resolvedRound((state) => state.lastCombatRound?.retreat === 'FAILURE' && state.lastCombatRound.winner === winner, 'RETREAT');
    const state = projectSliceState(saved);
    render(<CombatStage state={state} round={state.lastCombatRound} fast={false} />);

    const outcome = screen.getByRole('status');
    expect(within(outcome).getByText('撤退失败')).toBeTruthy();
    expect(within(outcome).queryByText('你赢得本回合')).toBeNull();
    expect(within(outcome).queryByText('成功脱离战斗')).toBeNull();
  });

  it('shows successful retreat without inventing enemy health after the battle has ended', () => {
    const saved = resolvedRound((state) => state.lastCombatRound?.retreat === 'SUCCESS', 'RETREAT');
    const state = projectSliceState(saved);
    expect(state.combat).toBeNull();
    render(<CombatStage state={state} round={state.lastCombatRound} fast={false} />);

    expect(within(screen.getByRole('status')).getByText('成功脱离战斗')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.queryByRole('progressbar', { name: '对手健康' })).toBeNull();
    const enemy = screen.getByRole('region', { name: '对手战斗状态' });
    expect(within(enemy).getByText('遭遇已结束')).toBeTruthy();
    expect(within(enemy).getByText('当前没有交战中的对手')).toBeTruthy();
    expect(enemy.textContent).not.toMatch(/\d+\s*\/\s*100/);
    expect(within(enemy).queryByText('已死亡')).toBeNull();
    expect(within(enemy).getByRole('heading', { name: '对手' })).toBeTruthy();
    expect(within(enemy).queryByText(/携铃者/)).toBeNull();
    expectGenericEnemyMark(enemy);
    expect(screen.getByRole('region', { name: '当前战场' })
      .classList.contains('combat-stage-boiler')).toBe(false);
  });

  it('does not create enemy health or an outcome when no battle and no round are available', () => {
    const state = projectSliceState(createSliceRun(
      'combat-presentation-no-battle', sliceDefaultCreationSelection, 'no-battle',
    ));
    expect(state.combat).toBeNull();
    expect(state.lastCombatRound).toBeNull();
    render(<CombatStage state={state} round={null} fast={false} />);

    expect(screen.queryByRole('progressbar', { name: '对手健康' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('region', { name: '当前战场' }).getAttribute('data-animated'))
      .toBe('false');
    const enemy = screen.getByRole('region', { name: '对手战斗状态' });
    expect(within(enemy).getByRole('heading', { name: '对手' })).toBeTruthy();
    expect(within(enemy).getByText('当前没有交战中的对手')).toBeTruthy();
    expectGenericEnemyMark(enemy);
  });

  it('suppresses reveal animation in fast mode without changing the committed outcome', () => {
    const state = projectSliceState(resolvedRound((candidate) => Boolean(candidate.combat)));
    const round = state.lastCombatRound!;
    const before = JSON.stringify(state);
    const { rerender } = render(<CombatStage state={state} round={round} fast={false} />);
    const outcome = screen.getByRole('status').textContent;
    expect(screen.getByRole('region', { name: '当前战场' }).getAttribute('data-animated'))
      .toBe('true');
    expect(document.querySelector('.combat-stage-reveal')).not.toBeNull();

    rerender(<CombatStage state={state} round={round} fast />);
    expect(screen.getByRole('region', { name: '当前战场' }).getAttribute('data-animated'))
      .toBe('false');
    expect(document.querySelector('.combat-stage-reveal')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(outcome);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('disables combat reveal and wheel animation for a reduced-motion preference', () => {
    const stylesheet = readFileSync('src/renderer/combat-stage.css', 'utf8');
    const reducedMotion = stylesheet.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/,
    )?.[1];
    expect(reducedMotion).toBeDefined();
    expect(reducedMotion).toContain('.combat-stage-reveal');
    expect(reducedMotion).toContain('.slice-wheel.spinning');
    expect(reducedMotion).toMatch(/animation:\s*none\s*!important/);
  });

  it('shows three idle planning wheels outside details without inventing a count or winner', async () => {
    const state = projectSliceState(firstCase());
    expect(state.lastCombatRound).toBeNull();
    const before = JSON.stringify(state);
    const { bridge, dialog } = await openCombat(state);
    const wheels = visibleWheels(dialog);

    expect(wheelValues(wheels)).toEqual(['待结算', '待结算', '待结算']);
    expect(wheels.querySelector('.spinning')).toBeNull();
    expect(within(wheels).queryByText(/^(你胜|对手胜|平局)$/)).toBeNull();
    expect(within(within(dialog).getByRole('region', { name: '当前战场' }))
      .queryByRole('status')).toBeNull();
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('updates selected stance odds from the public wheels without resolving a round', async () => {
    const state = projectSliceState(firstCase());
    const battle = state.combat!;
    const before = JSON.stringify(state);
    const { bridge, dialog } = await openCombat(state);
    const wheels = visibleWheels(dialog);
    const feedback = within(wheels).getByRole('status', { name: '当前姿态' });
    expect(feedback.closest('details')).toBeNull();

    for (const [stance, abilityId, label] of [
      ['ATTACK', 'STRIKE', '进攻'],
      ['DEFEND', 'BLOCK', '防守'],
    ] as const) {
      const button = within(dialog).getByRole('button', { name: new RegExp(`^${label}`) });
      fireEvent.click(button);
      const neutral = battle.playerAbilityWheel.find((entry) => entry.id === abilityId);
      const selected = battle.playerAbilityWheels?.[stance]?.find((entry) => entry.id === abilityId);
      if (!neutral || !selected) throw new Error(`Missing public ${stance} ability weights`);
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(feedback.textContent).toContain(`已选${label}`);
      expect(feedback.textContent).toContain(
        `${neutral.label}抽中率 ${Number(neutral.weight.toFixed(2))}% → ${Number(selected.weight.toFixed(2))}%`,
      );
      expect(feedback.textContent).toMatch(stance === 'ATTACK'
        ? /不是.*命中率.*伤害/ : /不保证.*格挡.*免伤/);
      expect(wheelValues(wheels)).toEqual(['待结算', '待结算', '待结算']);
    }

    fireEvent.click(within(dialog).getByRole('button', { name: /^尝试撤退/ }));
    expect(feedback.textContent).toContain('已选尝试撤退');
    expect(feedback.textContent).toMatch(/全部行动.*撤离|整回合.*撤/);
    expect(feedback.textContent).toMatch(/不.*攻击|不.*进攻/);
    expect(feedback.textContent).toContain('成功会结束此次追击');
    expect(feedback.textContent).toContain('可能放走携铃者及危险物');
    expect(feedback.textContent).toContain('已有救援与证据保留');
    expect(feedback.textContent).toContain('继续生活处理伤势');
    expect(feedback.textContent).not.toMatch(/%|抽中率/);
    expect(wheelValues(wheels)).toEqual(['待结算', '待结算', '待结算']);
    expect(wheels.querySelector('.spinning')).toBeNull();
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('shows the committed DEFEND stance after JSON restoration rather than local ATTACK', async () => {
    const saved = resolvedRound((candidate) => candidate.combat !== null, 'DEFEND');
    const state = projectSliceState(JSON.parse(JSON.stringify(saved)) as SliceState);
    const before = JSON.stringify(state);
    const { bridge, dialog } = await openCombat(state);
    const feedback = within(visibleWheels(dialog)).getByRole('status', { name: '当前姿态' });

    expect(state.lastCombatRound!.stance).toBe('DEFEND');
    expect(feedback.textContent).toContain('本回合采用：防守');
    expect(feedback.textContent).not.toMatch(/已选进攻|本回合采用：进攻/);
    fireEvent.click(within(dialog).getByLabelText('快速显示本回合结果'));
    expect(feedback.textContent).toContain('本回合采用：防守');
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('summarizes the saved moves in side order with their actual advantage contributions', async () => {
    const saved = resolvedRound((candidate) => {
      const round = candidate.lastCombatRound;
      return candidate.combat !== null && round !== null && round.moves.length > 2
        && round.moves.some((move) => move.actor === 'ENEMY' && move.selfGain > 0)
        && round.moves.some((move) => move.enemyReduction > 0);
    });
    const state = projectSliceState(saved);
    const before = JSON.stringify(state);
    const { bridge, dialog } = await openCombat(state);
    const summary = expectSavedMoveSummary(dialog, state);
    const wheels = visibleWheels(dialog);
    expect(within(wheels).getByRole('status', { name: '当前姿态' }).textContent)
      .toContain('下列数字是胜势，不是健康伤害');
    const ledger = within(dialog).getByText('查看完整回合记录', { selector: 'summary' })
      .closest('details')!;
    expect(ledger.open).toBe(false);
    expect(ledger.contains(summary)).toBe(false);
    expect(ledger.querySelectorAll('.slice-simple-list > li')).toHaveLength(state.lastCombatRound!.moves.length);
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps a recorded zero-contribution miss instead of inventing a successful action', async () => {
    const saved = resolvedRound((candidate) => candidate.combat !== null
      && Boolean(candidate.lastCombatRound?.moves.some((move) => move.label === '动作落空'
        && move.selfGain === 0 && move.enemyReduction === 0)));
    const state = projectSliceState(saved);
    const { bridge, dialog } = await openCombat(state);
    const summary = expectSavedMoveSummary(dialog, state);
    expect(summary.textContent).toContain('动作落空');
    expect(bridge.submitIntent).not.toHaveBeenCalled();
  });

  it('shows no invented player move when the saved failed retreat spent all player actions', async () => {
    const saved = resolvedRound((candidate) => candidate.combat !== null
      && candidate.lastCombatRound?.retreat === 'FAILURE', 'RETREAT');
    const state = projectSliceState(saved);
    expect(state.lastCombatRound!.moves.some((move) => move.actor === 'PLAYER')).toBe(false);
    expect(state.lastCombatRound!.moves.some((move) => move.actor === 'ENEMY')).toBe(true);
    const { bridge, dialog } = await openCombat(state);
    const summary = expectSavedMoveSummary(dialog, state);
    const player = within(summary).getByLabelText('你的本回合动作');
    expect(player.textContent).toContain('未执行动作');
    expect(player.textContent).not.toMatch(/普通打击|短棍打击|格挡护身|寻找空当|拉开距离/);
    expect(bridge.submitIntent).not.toHaveBeenCalled();
  });

  it('restores the same summary without RNG or intents and removes it for next-round planning', async () => {
    const saved = resolvedRound((candidate) => candidate.combat !== null, 'DEFEND');
    const savedJson = JSON.stringify(saved);
    const state = projectSliceState(saved);
    const stateJson = JSON.stringify(state);
    const random = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
    const initial = await openCombat(state);
    const expectedSummary = expectSavedMoveSummary(initial.dialog, state).textContent;
    const expectedWheels = wheelValues(visibleWheels(initial.dialog));
    expect(initial.bridge.submitIntent).not.toHaveBeenCalled();
    cleanup();

    const restored = projectSliceState(JSON.parse(savedJson) as SliceState);
    const { bridge, dialog } = await openCombat(restored);
    expect(expectSavedMoveSummary(dialog, restored).textContent).toBe(expectedSummary);
    fireEvent.click(within(dialog).getByLabelText('快速显示本回合结果'));
    expect(expectSavedMoveSummary(dialog, restored).textContent).toBe(expectedSummary);
    expect(wheelValues(visibleWheels(dialog))).toEqual(expectedWheels);
    fireEvent.click(within(dialog).getByRole('button', { name: '进入下一回合' }));
    const planning = await screen.findByRole('dialog', { name: restored.combat!.title ?? '普通人追击' });
    expect(within(planning).queryByLabelText('本回合动作与胜势')).toBeNull();
    expect(wheelValues(visibleWheels(planning))).toEqual(['待结算', '待结算', '待结算']);
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(JSON.stringify(saved)).toBe(savedJson);
    expect(JSON.stringify(state)).toBe(stateJson);
    expect(JSON.stringify(restored)).toBe(stateJson);
  });

  it.each(['higher sequence', 'different title', 'no current combat'] as const)(
    'does not add the ordinary move summary to %s', async (variant) => {
      const state = projectSliceState(resolvedRound((candidate) => candidate.combat !== null));
      if (variant === 'higher sequence') {
        state.progression = { ...state.progression, pathwayId: 'diviner', sequence: 8 };
      } else if (variant === 'different title') {
        state.combat = { ...state.combat!, title: '首案 · 追击携铃者（其他遭遇）' };
      } else {
        state.combat = null;
      }
      const before = JSON.stringify(state);
      const { bridge, dialog } = await openCombat(state);
      expect(within(dialog).queryByLabelText('本回合动作与胜势')).toBeNull();
      visibleWheels(dialog);
      expect(bridge.submitIntent).not.toHaveBeenCalled();
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it.each(['higher sequence', 'different title'] as const)(
    'uses public stance descriptions without ordinary odds for %s planning', async (variant) => {
      const state = projectSliceState(firstCase());
      // Probe the presentation boundary, without changing any authoritative round or fixture.
      if (variant === 'higher sequence') {
        state.progression = { ...state.progression, pathwayId: 'diviner', sequence: 8 };
      } else {
        state.combat = { ...state.combat!, title: '普通人追击' };
      }
      const before = JSON.stringify(state);
      const { bridge, dialog } = await openCombat(state);
      const feedback = within(visibleWheels(dialog)).getByRole('status', { name: '当前姿态' });
      expect(feedback.textContent).toContain(state.combat!.stances[0]!.description);
      expect(feedback.textContent).not.toMatch(/抽中率|\d+(?:\.\d+)?%\s*→/);
      fireEvent.click(within(dialog).getByRole('button', { name: /^尝试撤退/ }));
      expect(feedback.textContent).not.toMatch(/结束此次追击|携铃者及危险物|已有救援与证据保留/);
      expect(bridge.submitIntent).not.toHaveBeenCalled();
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it.each([
    ['PLAYER', true, 'ENEMY', '对手受到伤势'],
    ['ENEMY', true, 'PLAYER', '你受到伤势'],
    ['PLAYER', false, 'NONE', '本回合未新增伤势'],
    ['ENEMY', false, 'NONE', '本回合未新增伤势'],
  ] as const)('separates %s victory from actual injury (%s)', async (winner, injured, target, heading) => {
    const state = projectSliceState(resolvedRound((candidate) => {
      const round = candidate.lastCombatRound;
      return candidate.combat !== null && round !== null && round.winner === winner
        && (round.consequenceWeights !== null) === injured;
    }));
    const round = state.lastCombatRound!;
    const before = JSON.stringify(state);
    expect(firstCaseInjuryTarget(state, round)).toBe(target);
    const { bridge, dialog } = await openCombat(state);
    const stage = within(dialog).getByRole('region', { name: '当前战场' });
    const player = within(stage).getByRole('region', { name: '你的战斗状态' });
    const enemy = within(stage).getByRole('region', { name: '对手战斗状态' });
    expect(player.classList.contains('combat-impact')).toBe(target === 'PLAYER');
    expect(enemy.classList.contains('combat-impact')).toBe(target === 'ENEMY');
    expect(stage.querySelectorAll('.combat-impact')).toHaveLength(injured ? 1 : 0);
    const consequence = within(dialog).getByLabelText('本回合实际后果');
    expect(within(consequence).getByText(heading, { selector: 'strong' })).toBeTruthy();
    expect(within(dialog).getAllByText(round.consequence)).toHaveLength(1);

    fireEvent.click(within(dialog).getByLabelText('快速显示本回合结果'));
    expect(stage.getAttribute('data-animated')).toBe('false');
    expect(stage.classList.contains('combat-stage-reveal')).toBe(false);
    expect(within(dialog).getAllByText(round.consequence)).toHaveLength(1);
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(['higher sequence', 'different title', 'no current combat'] as const)(
    'does not infer injury feedback for %s', async (variant) => {
      const state: SliceProjection = projectSliceState(resolvedRound((candidate) => {
        const round = candidate.lastCombatRound;
        return candidate.combat !== null && round !== null && round.winner === 'PLAYER'
          && round.consequenceWeights !== null;
      }));
      // Keep the saved result unchanged while probing each exclusion independently.
      if (variant === 'higher sequence') {
        state.progression = { ...state.progression, pathwayId: 'diviner', sequence: 8 };
      } else if (variant === 'different title') {
        state.combat = { ...state.combat!, title: '首案 · 追击携铃者（其他遭遇）' };
      } else {
        state.combat = null;
      }
      const round = state.lastCombatRound!;
      const before = JSON.stringify(state);
      expect(firstCaseInjuryTarget(state, round)).toBeNull();
      const { bridge, dialog } = await openCombat(state);
      expect(dialog.querySelector('.combat-impact')).toBeNull();
      const consequence = within(dialog).getByLabelText('本回合实际后果');
      expect(within(consequence).getByText('实际后果', { selector: 'strong' })).toBeTruthy();
      expect(within(consequence).queryByText(/^(你受到伤势|对手受到伤势|本回合未新增伤势)$/))
        .toBeNull();
      expect(within(dialog).getAllByText(round.consequence)).toHaveLength(1);
      expect(bridge.submitIntent).not.toHaveBeenCalled();
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it('does not classify a missing round, unknown winner, or successful retreat as injury', () => {
    const state = projectSliceState(firstCase());
    const retreat = projectSliceState(resolvedRound(
      (candidate) => candidate.lastCombatRound?.retreat === 'SUCCESS', 'RETREAT',
    )).lastCombatRound!;
    expect(firstCaseInjuryTarget(state, null)).toBeNull();
    expect(firstCaseInjuryTarget(state, retreat)).toBeNull();
    expect(firstCaseInjuryTarget(state, { ...retreat, retreat: 'NONE', winner: null })).toBeNull();
  });

  it.each([
    ['PLAYER', '你胜'],
    ['ENEMY', '对手胜'],
  ] as const)('shows exact saved %s wheel results and resets them when planning the next round', async (winner, label) => {
    const state = projectSliceState(resolvedRound((candidate) => Boolean(
      candidate.combat && candidate.lastCombatRound?.winner === winner,
    )));
    const round = state.lastCombatRound!;
    const before = JSON.stringify(state);
    const { bridge, dialog } = await openCombat(state);
    const wheels = visibleWheels(dialog);
    const expectedValues = [String(round.playerCount), String(round.enemyCount), label];

    expect(wheelValues(wheels)).toEqual(expectedValues);
    expect(wheels.querySelectorAll('.slice-wheel.spinning')).toHaveLength(3);
    const ledger = within(dialog).getByText('查看完整回合记录', { selector: 'summary' })
      .closest('details');
    expect(ledger).not.toBeNull();
    expect(ledger!.open).toBe(false);
    expect(ledger!.querySelector('.slice-wheel')).toBeNull();
    expect(within(ledger!).getByText(`第 ${round.round} 回合完整记录`, { selector: 'h3' }))
      .toBeTruthy();

    fireEvent.click(within(dialog).getByLabelText('快速显示本回合结果'));
    expect(wheelValues(visibleWheels(dialog))).toEqual(expectedValues);
    expect(wheels.querySelector('.spinning')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: '进入下一回合' }));
    const planning = await screen.findByRole('dialog', { name: state.combat?.title ?? '普通人追击' });
    const planningWheels = visibleWheels(planning);
    expect(wheelValues(planningWheels)).toEqual(['待结算', '待结算', '待结算']);
    expect(planningWheels.querySelector('.spinning')).toBeNull();
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(['ATTACK', 'RETREAT'] as const)('puts the saved %s consequence above details and fast reveal never submits an intent', async (stance) => {
    const saved = resolvedRound((state) => stance === 'RETREAT' ? state.lastCombatRound?.retreat === 'SUCCESS' : Boolean(state.combat && state.combat.enemyHealth < 100), stance);
    const state = projectSliceState(JSON.parse(JSON.stringify(saved)) as SliceState);
    const { bridge, dialog } = await openCombat(state);
    const consequence = within(dialog).getByLabelText('本回合实际后果');
    expect(within(consequence).getByText(state.lastCombatRound!.consequence)).toBeTruthy();
    expect(within(dialog).getAllByText(state.lastCombatRound!.consequence)).toHaveLength(1);
    expect(consequence.closest('details')).toBeNull();
    expect(dialog.querySelector('.slice-battle-warning') !== null).toBe(state.combat !== null);
    const wheels = visibleWheels(dialog);
    const round = state.lastCombatRound!;
    expect(wheelValues(wheels)).toEqual([
      String(round.playerCount),
      String(round.enemyCount),
      round.retreat === 'SUCCESS' ? '未进入胜负盘' : round.winner === 'PLAYER' ? '你胜' : '对手胜',
    ]);
    expect(wheels.querySelectorAll('.slice-wheel.spinning')).toHaveLength(stance === 'RETREAT' ? 2 : 3);
    if (stance === 'RETREAT') {
      // Successful retreat records the opponent holding the field, without drawing the victory wheel.
      expect(round.winner).toBe('ENEMY');
      expect(within(wheels).getByText('未进入胜负盘')).toBeTruthy();
      expect(within(dialog).queryByText('平局')).toBeNull();
    }

    fireEvent.click(within(dialog).getByLabelText('快速显示本回合结果'));
    expect(within(dialog).getByRole('region', { name: '当前战场' }).getAttribute('data-animated'))
      .toBe('false');
    expect(wheels.querySelector('.spinning')).toBeNull();
    expect(within(consequence).getByText(state.lastCombatRound!.consequence)).toBeTruthy();
    expect(bridge.submitIntent).not.toHaveBeenCalled();
  });
});


describe('resuming life after the first case', () => {
  it.each([false, true])('does not reopen an archived ordinary battle after continuing life (later rest: %s)', async (restAfterwards) => {
    const finished = resolvedRound((state) => state.lastCombatRound?.retreat === 'SUCCESS', 'RETREAT');
    let continued = applySliceIntent(finished, { type: 'CONTINUE_LIFE' });
    if (restAfterwards) continued = applySliceIntent(continued, { type: 'ACTION', action: 'REST' });
    const state = projectSliceState(JSON.parse(JSON.stringify(continued)) as SliceState);
    expect(state.status).toBe('ACTIVE');
    expect(state.caseArchive).toHaveLength(1);
    expect(state.lastCombatRound).toEqual(projectSliceState(finished).lastCombatRound);
    const before = JSON.stringify(state);
    const bridge = await openSave(state);

    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.getByRole('group', { name: '四个主要行动' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /完整纪事/ }));
    const chronicle = await screen.findByRole('dialog', { name: '完整纪事' });
    const history = within(chronicle).getByRole('heading', { name: '战斗完整回放' }).closest('section');
    expect(history).not.toBeNull();
    expect(within(history!).getByText(state.lastCombatRound!.consequence)).toBeTruthy();
    expect(bridge.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
});
