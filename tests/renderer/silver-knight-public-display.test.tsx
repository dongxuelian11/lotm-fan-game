/* @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import { SILVER_KNIGHT_ENEMY_ABILITY_WHEEL, SILVER_KNIGHT_ENEMY_COUNT_WHEEL } from '../../src/domain/silver-knight/combat';
import type { SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

const OLD = 'tests/fixtures/silver-knight-v01520';
const weights = (wheel: readonly { id: string; weight: number }[]) => wheel.map(({ id, weight }) => ({ id, weight }));
function actualFight(kind: 'HUNT' | 'POST'): SliceState {
  if (kind === 'POST') return migrateSliceState(readObjectEntry(`${OLD}/directed.json`, 'combatStart'));
  const entry = readObjectEntry<{ final: unknown }>(`${OLD}/first-hunt-boundaries.json`, 'rock_husk-fight');
  return migrateSliceState(entry.final);
}
async function mount(state: SliceState) {
  assertValidSliceState(state);
  const value = projectSliceState(state);
  const submit: SliceBridge['submitIntent'] = vi.fn(async () => { throw new Error('Display-only regression must never submit an intent.'); });
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: value, runs: [{
      runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
      week: value.week, date: value.date, status: value.status, revision: value.revision, updatedAt: '2026-10-14T08:00:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value })), submitIntent: submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (value.combat ? screen.queryByRole('dialog', { name: value.combat.title ?? "普通人追击" }) : null)
    ?? screen.queryByRole('heading', { name: '人物卷宗' })).toBeTruthy());
  return { submit, value };
}
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

// These actual old captures expose both confirmed display-wiring mistakes:
// the generic opponent wheel and the absent-domain physical round fallback.
// No old state, journal, random cursor, target or outcome is rewritten here.
describe('Existing Silver Knight public display wiring', () => {
  it.each(['HUNT', 'POST'] as const)('projects and displays the original %s opponent wheel from its actual resolver', async kind => {
    const state = actualFight(kind), before = structuredClone(state), { submit, value } = await mount(state);
    expect(state.combat!.encounterId).toBe(kind === 'HUNT' ? 'SILVER_KNIGHT_HUNT' : 'SILVER_KNIGHT_DISPUTE');
    const battle = value.combat!;
    expect(weights(battle.enemyAbilityWheel)).toEqual(weights(SILVER_KNIGHT_ENEMY_ABILITY_WHEEL));
    expect(weights(battle.enemyCountWheel)).toEqual(weights(SILVER_KNIGHT_ENEMY_COUNT_WHEEL));
    expect(weights(battle.enemyAbilityWheel)).toEqual([
      { id: 'PRIMARY', weight: 35 }, { id: 'DEFENSE', weight: 25 }, { id: 'TRAIT', weight: 15 },
      { id: 'BODY_STRIKE', weight: 20 }, { id: 'ACCIDENT', weight: 5 },
    ]);
    const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
    if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合)$/ }));
    const stage = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const entry of battle.enemyAbilityWheel) expect(stage.textContent).toContain(`${entry.label} ${entry.weight}%`);
    const count = within(stage).getByText(/^对手次数盘：/);
    for (const entry of battle.enemyCountWheel) expect(count.textContent).toContain(`${entry.label} ${entry.weight}%`);
    expect(state).toEqual(before); expect(submit).not.toHaveBeenCalled();
  }, 20_000);

  it('loads the real legacy round with no explicit consequence domain as its saved physical injury wheel', async () => {
    const raw = readObjectEntry<SliceState>(`${OLD}/natural.json`, 'final');
    expect(raw.lastCombatRound?.silverKnightOutcome).toBeTruthy();
    expect(raw.lastCombatRound?.consequenceDomain).toBeUndefined();
    expect(raw.lastCombatRound?.pendingConsequence).toBeUndefined();
    expect(raw.lastCombatRound).toMatchObject({ round: 1, consequenceRoll: 72, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    const state = migrateSliceState(raw), before = structuredClone(state), { submit } = await mount(state);
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain('败者后果盘：轻伤 65% · 重伤 30% · 死亡 5%');
    expect(reveal.textContent).not.toContain('精神后果盘'); expect(reveal.textContent).not.toContain('损耗40点');
    expect(state).toEqual(before); expect(submit).not.toHaveBeenCalled();
  }, 20_000);
});
