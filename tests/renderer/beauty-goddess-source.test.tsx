/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BeautyGoddessPanel } from '../../src/renderer/BeautyGoddessPanel.js';
import { projectBeautyGoddess } from '../../src/domain/beauty-goddess/index.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { originalLifeGiver, prepared, promoted, lifeGiverNaturalPath, bg, dose, moonLegacyKeys } from '../domain/beauty-goddess-directed-helper.js';

afterEach(cleanup);

// Large historical captures are streamed one top-level entry at a time. Raw
// schema165 metadata is pinned separately; all current projections use migration.
describe('Beauty Goddess renderer source boundary', () => {
  it('pins the original 572-command life-giver capture without passing raw historical data to a current validator', () => {
    const raw = readObjectEntry<{ schemaVersion: number; contentVersion: string; revision: number; week: number }>(lifeGiverNaturalPath, 'final');
    expect(raw).toMatchObject({ schemaVersion: 165, contentVersion: 'life-giver-v165', revision: 573, week: 131 });
    expect(readObjectEntry<unknown[]>(lifeGiverNaturalPath, 'commands')).toHaveLength(572);
  });

  it('renders the exact migrated original body and live Lumen without healing, replenishing or cloning', () => {
    const state = originalLifeGiver(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectBeautyGoddess(state), onCommand = vi.fn();
    const view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    const resources = screen.getByRole('region', { name: '美神当前资源' });
    expect(resources.textContent).toContain('艾琳'); expect(resources.textContent).toContain('健康70/100 · 精神100/100 · 灵性120/120');
    expect(resources.textContent).toContain('634便士 · 本周行动3 · 现有伤势3处 · 累计风险2');
    expect(within(resources).getAllByText(/轻伤 · 尚未治疗/)).toHaveLength(3);
    const guest = screen.getByRole('region', { name: '同一流灯的当前资源' });
    expect(guest.textContent).toContain('健康100/100 · 精神92/100 · 精力88/100');
    expect(guest.textContent).toContain('原玻璃屋内'); expect(guest.textContent).toContain('累计普通行走334米');
    expect(guest.textContent).toContain('第105周实付30便士'); expect(guest.textContent).toContain('第123周实付30便士');
    expect(value.life.partner).toEqual(state.summoningMaster.life.partner);
    expect(state.lifeGiver.life.beads.filter(item => item.purpose === 'COMBAT').map(item => [item.status, item.location])).toEqual([
      ['SPENT', 'RETURN_TRAY'], ['SPENT', 'RETURN_TRAY'], ['SPENT', 'RETURN_TRAY'],
    ]);
    expect(state.witchKing.life.papers.every(item => item.status === 'CONSUMED')).toBe(true);
    expect(view.container.textContent).not.toMatch(/必须诊疗|先去诊所|候选|原创G|本作G|原文未核|编号推断/);
    for (const key of moonLegacyKeys) expect(state[key]).toEqual(before[key]);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it.each(['FEMALE', 'MALE'] as const)('uses the separate saved body acknowledgment and exact prepared %s original bottle', gender => {
    // MALE is an explicitly directed unit identity before the new acquisition
    // journal; originalLifeGiver always retains the real female historical body.
    const state = prepared('SUCCESS', false, gender), before = structuredClone(state); assertValidSliceState(state);
    const value = projectBeautyGoddess(state), onCommand = vi.fn();
    expect(value.transformation).toMatchObject({ originalGender: gender, decision: 'ACCEPTED', outcome: null });
    const consume = value.actions.find(entry => entry.enabled && entry.command.type === 'CONSUME')!; expect(consume).toBeTruthy();
    render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button'));
    const dialog = screen.getByRole('dialog', { name: '美神操作确认' });
    expect(dialog.textContent).toContain(gender === 'MALE' ? '身体会成为女性' : '成功晋升美神后仍为女性');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('服药失败不改变原有身体性别');
    expect(onCommand).not.toHaveBeenCalled(); const button = within(dialog).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(button); fireEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command); expect(state).toEqual(before);
  }, 60000);

  it.each(['FEMALE', 'MALE'] as const)('shows the actual saved successful %s outcome and 21 unchanged masteries plus two zeros', gender => {
    const state = promoted('SUCCESS', gender), before = structuredClone(state), value = projectBeautyGoddess(state); assertValidSliceState(state);
    const onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    const body = screen.getByRole('region', { name: '美神身体变化记录' });
    expect(body.textContent).toContain('当前身体：女性'); expect(body.textContent).toContain(`晋升前身体：${gender === 'MALE' ? '男性' : '女性'}`);
    expect(body.textContent).toContain('成功服药后的身体结果已保存');
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(23); expect(value.abilities.slice(0, 21).filter(item => item.mastery === 0)).toHaveLength(7);
    expect(value.abilities.slice(21).map(item => [item.id, item.mastery])).toEqual([['moon.s1.self-poise', 0], ['moon.s1.bounded-moonform', 0]]);
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(state.progression.mastery[ability.id]);
      expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    }
    expect(value.life.partner).toEqual(originalLifeGiver().summoningMaster.life.partner);
    expect(view.container.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断/);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it.each(['FEMALE', 'MALE'] as const)('renders a real failed %s attempt without changing its body or refunding its spent bottle', gender => {
    const state = bg(prepared('FAILURE', false, gender), dose), before = structuredClone(state); assertValidSliceState(state);
    const value = projectBeautyGoddess(state), onCommand = vi.fn();
    render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    expect(state.progression.sequence).toBe(2); expect(value.currentGender).toBe(gender); expect(value.transformation.outcome).toBeNull();
    expect(state.beautyGoddess.bottles[0]!.status).toBe('CONSUMED');
    expect(screen.getByRole('region', { name: '美神身体变化记录' }).textContent).toContain(`当前身体：${gender === 'MALE' ? '男性' : '女性'}`);
    expect(screen.getByRole('region', { name: '美神当前资源' }).textContent).toContain(`健康${state.health}/100 · 精神${state.mind}/100`);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('shows the real absence of old expendable resources and new battle purchases', () => {
    const state = promoted(), before = structuredClone(state), value = projectBeautyGoddess(state), onCommand = vi.fn();
    assertValidSliceState(state); render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByRole('combobox', { name: '美神目标' }), { target: { value: 'encounter' } });
    expect(value.encounter.materials.lamp).toBeNull(); expect(value.encounter.materials.pieces).toEqual([]);
    const encounter = screen.getByRole('region', { name: '美神可选真实交战' });
    expect(encounter.textContent).toContain('尚未购买战场灯'); expect(encounter.textContent).toContain('没有已购买的战场月片');
    expect(encounter.textContent).toContain('流灯仍留在原家'); expect(encounter.textContent).toContain('旧原珠不在手');
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);
});
