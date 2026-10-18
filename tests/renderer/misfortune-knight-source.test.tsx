/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MisfortuneKnightPanel } from '../../src/renderer/MisfortuneKnightPanel.js';
import { projectMisfortuneKnight } from '../../src/domain/misfortune-knight/index.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { originalConcealmentServant, prepared, promoted, mk, dose, darknessLegacyKeys, loadMisfortuneKnightFixture,
  concealmentServantNaturalPath, concealmentServantBranchPath } from '../domain/misfortune-knight-directed-helper.js';

afterEach(cleanup);
async function hash(path: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
function room() {
  const fold = screen.getByText('原房间、艾琳与旧物当前记录').closest('details')!; fold.open = true;
  return within(fold).getByRole('region', { name: '原房间当前状态' });
}
const newIds = ['darkness.s1.guided-mishap', 'darkness.s1.bounded-night-guard'];
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|完整配方与仪式仍未知/;

// Raw historical pins deliberately never enter the current validator. Every
// state used by a current projector comes through the shared migration helper.
describe('Misfortune Knight renderer: actual living source and preserved dead ending', () => {
  it('pins both untouched raw files and the exact 518-command peaceful prefix separately from the 528-command dead ending', async () => {
    expect(await hash(concealmentServantNaturalPath)).toBe('b1edff5df12aa0b3a88aa16b2feee5ff63766ea15d4c7346b9ccb294f1c8c7b4');
    expect(await hash(concealmentServantBranchPath)).toBe('667f41064ca3aedc76365a66a05bd26ec2fb47a20d6cbf74ffa744a88b778dba');
    const dead = readObjectEntry<SliceState>(concealmentServantNaturalPath, 'final');
    const living = readObjectEntry<SliceState>(concealmentServantBranchPath, 'beforeLast');
    const commands = readObjectEntry<SliceIntent[]>(concealmentServantNaturalPath, 'commands');
    expect(commands).toHaveLength(528); expect(commands.slice(0, 518)).toHaveLength(518);
    expect(commands[517]).toEqual({ type: 'ACTION', action: 'REST' });
    expect(commands[518]).toEqual({ type: 'CONCEALMENT_SERVANT', command: { type: 'ENCOUNTER_TALK' } });
    expect(living).toMatchObject({ schemaVersion: 166, contentVersion: 'concealment-servant-v166', revision: 519,
      status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 420, week: 121, actionsRemaining: 3,
      injuries: [], injuryRisk: 0, random: { seed: 'sleepless-natural-v020', cursor: 341 } });
    expect(dead).toMatchObject({ schemaVersion: 166, contentVersion: 'concealment-servant-v166', revision: 529,
      status: 'DEAD', health: 0, random: { seed: 'sleepless-natural-v020', cursor: 432 }, ending: { kind: 'DEATH' } });
    expect(dead.spiritWarlock.companion).toMatchObject({ deployments: 13, recalls: 13 });
    expect(living.spiritWarlock.companion).toMatchObject({ deployments: 12, recalls: 12 });
  }, 60000);

  it('renders the migrated original living body and exact old room without healing, copying or starting a command', () => {
    const state = originalConcealmentServant(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectMisfortuneKnight(state), onCommand = vi.fn();
    const view = render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    const resources = screen.getByRole('region', { name: '厄难骑士当前资源' });
    expect(resources.textContent).toContain('罗温'); expect(resources.textContent).toContain('健康100/100 · 精神100/100 · 灵性120/120');
    expect(resources.textContent).toContain('420便士 · 本周行动3 · 现有伤势0处 · 累计风险0');
    expect(room().textContent).toContain('艾琳 · 38岁，存活；健康100/100、精神100/100');
    expect(room().textContent).toContain('原房间长6米'); expect(room().textContent).toContain('原门开放');
    expect(room().textContent).toContain('原保管起点'); expect(room().textContent).toContain('实际检索2次，其中延迟1次、共20秒');
    expect(room().textContent).toContain('固定锚灯关闭'); expect(room().textContent).toContain('无生命、无独立意识');
    expect(value.life.originals.box).toEqual(state.concealmentServant.life.box);
    expect(value.life.originals.page).toEqual(state.concealmentServant.life.page);
    expect(value.life.originals.trace).toEqual(state.concealmentServant.life.trace);
    expect(state.spiritWarlock.companion).toEqual({ source: 'SW5-LEAF-1', status: 'SEALED', acquiredWeek: 45, invitedWeek: 53, releases: 1, deployments: 12, recalls: 12 });
    expect(state.spiritWarlock.practice).toMatchObject({ note: 'TABLE', dreamOpen: false, deliveries: 1, returns: 1 });
    expect(state.nightwatcher.encounter.enemy.status).toBe('DEAD'); expect(state.fearBishop.encounter.enemyStatus).toBe('SURRENDERED');
    expect(state.concealmentServant.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
    expect(view.container.textContent).not.toMatch(editorial); expect(view.container.textContent).not.toMatch(/必须诊疗|先去诊所/);
    for (const key of darknessLegacyKeys) expect(state[key]).toEqual(before[key]);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('keeps the separately migrated original dead final read-only and never turns it into the living branch', () => {
    const state = loadMisfortuneKnightFixture(concealmentServantNaturalPath, 'final'), before = structuredClone(state);
    assertValidSliceState(state); const value = projectMisfortuneKnight(state), onCommand = vi.fn();
    render(<MisfortuneKnightPanel value={value} busy={false} blocked onCommand={onCommand} />);
    expect(state).toMatchObject({ status: 'DEAD', health: 0, revision: 529, ending: { kind: 'DEATH' } });
    expect(screen.getByRole('region', { name: '厄难骑士当前资源' }).textContent).toContain('健康0/100');
    expect(screen.getByText('本周目已经死亡，原身体、原人物与原物记录只读保留。')).toBeTruthy();
    for (const button of screen.queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled(); expect(state).toEqual(before);
  }, 60000);

  it.each(['FEMALE', 'MALE'] as const)('uses the actual prepared %s bottle and confirms only consumption', gender => {
    // MALE is explicitly selected UNIT input before acquisition, not a claim
    // about the historical female player or a natural replay.
    const state = prepared('SUCCESS', false, gender), before = structuredClone(state); assertValidSliceState(state);
    const value = projectMisfortuneKnight(state), onCommand = vi.fn();
    const consume = value.actions.find(entry => entry.enabled && entry.command.type === 'CONSUME')!; expect(consume).toBeTruthy();
    render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button'));
    const dialog = screen.getByRole('dialog', { name: '厄难骑士操作确认' });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('性别、姓名、年龄、性格与取向不变');
    expect(dialog.textContent).not.toMatch(/身体会成为|确认接受晋升后的身体变化|确认拒绝身体变化/);
    expect(onCommand).not.toHaveBeenCalled(); const button = within(dialog).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(button); fireEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command); expect(state).toEqual(before);
  }, 60000);

  it.each(['FEMALE', 'MALE'] as const)('shows successful %s promotion with eighteen unchanged masteries and two zeros', gender => {
    const source = originalConcealmentServant(), state = promoted('SUCCESS', gender), before = structuredClone(state);
    assertValidSliceState(state); const value = projectMisfortuneKnight(state), onCommand = vi.fn();
    const view = render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    expect(value.currentGender).toBe(gender); expect(state.character.gender).toBe(gender);
    expect(room().textContent).toContain(`当前身体：${gender === 'MALE' ? '男性' : '女性'}`);
    expect(room().textContent).toContain('本阶不改变性别、姓名、年龄、性格与取向');
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(20); expect(value.abilities.slice(0, 18).filter(item => item.mastery === 0)).toHaveLength(5);
    expect(value.abilities.slice(18).map(item => [item.id, item.mastery])).toEqual(newIds.map(id => [id, 0]));
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(state.progression.mastery[ability.id]);
      expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    }
    for (const key of darknessLegacyKeys) expect(state[key]).toEqual(source[key]);
    expect(state.spiritWarlock.companion).toEqual(source.spiritWarlock.companion);
    expect(view.container.textContent).not.toMatch(editorial); expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it.each(['FEMALE', 'MALE'] as const)('keeps a failed %s bottle spent, preserves damage and makes no mastery award', gender => {
    const state = mk(prepared('FAILURE', false, gender), dose), before = structuredClone(state);
    assertValidSliceState(state); const value = projectMisfortuneKnight(state), onCommand = vi.fn();
    render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    expect(state.progression.sequence).toBe(2); expect(value.currentGender).toBe(gender);
    expect(state.misfortuneKnight.bottles[0]!.status).toBe('CONSUMED');
    expect(state.misfortuneKnight.preparedWeek).toBeNull();
    expect(state.health).toBe(85); expect(state.mind).toBe(75); expect(state.seer.pollution).toBe(30);
    expect(screen.getByRole('region', { name: '厄难骑士当前资源' }).textContent).toContain('健康85/100 · 精神75/100');
    expect(Object.keys(state.progression.mastery)).toHaveLength(18);
    expect(newIds.every(id => !Object.hasOwn(state.progression.mastery, id))).toBe(true);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('shows the distinct optional opponent and no free battle wood, old material or spirit copies', () => {
    const state = promoted(), before = structuredClone(state), value = projectMisfortuneKnight(state), onCommand = vi.fn();
    assertValidSliceState(state); render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByRole('combobox', { name: '厄难骑士目标' }), { target: { value: 'encounter' } });
    const encounter = screen.getByRole('region', { name: '厄难骑士可选真实交战' });
    expect(encounter.textContent).toContain('奥尔登·沃德 · 46岁');
    expect(encounter.textContent).toContain('健康100/100、精神100/100、灵性120/120');
    expect(encounter.textContent).toContain('尚未购买战场木板'); expect(encounter.textContent).toContain('艾琳和米洛在本场之外');
    expect(value.encounter.materials.plate).toBeNull(); expect(value.encounter.materials.weapon.charge).toBe(4);
    expect(state.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'SEALED', deployments: 12, recalls: 12 });
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);
});
