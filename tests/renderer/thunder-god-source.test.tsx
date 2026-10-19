/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ThunderGodPanel } from '../../src/renderer/ThunderGodPanel.js';
import { projectThunderGod } from '../../src/domain/thunder-god/index.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { originalCatastrophe, loadThunderGodFixture, prepared, promoted, tyrantLegacyKeys,
  catastropheNaturalPath, catastropheBranchPath } from '../domain/thunder-god-directed-helper.js';

afterEach(cleanup);
async function hash(path: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
function originals() {
  const fold = screen.getByText('原小湾、诺拉与旧物当前记录').closest('details')!; fold.open = true;
  return within(fold).getByRole('region', { name: '原小湾当前状态' });
}
const newIds = ['tyrant.s1.guided-thunder', 'tyrant.s1.storm-brace'];
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|完整配方与仪式仍未知/;

// Raw history pins remain historical. Every state passed to current validators
// and projectors is loaded through the shared explicit migration helper.
describe('Thunder God renderer: exact living source and preserved original bodies and objects', () => {
  it('pins the untouched 599-command living checkpoint separately from the 602-command actual death', async () => {
    expect(await hash(catastropheBranchPath)).toBe('3ee5d4bfb9582aabb88a477bd5f0b5a47c335e8dbe5074b0eafbafff35d8b448');
    expect(await hash(catastropheNaturalPath)).toBe('cb8649c4d3dc15b5fa61601591eaed3f99579082f01bffa4f566afbf7ed8dc53');
    const living = readObjectEntry<SliceState>(catastropheBranchPath, 'beforeLast');
    const dead = readObjectEntry<SliceState>(catastropheNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(catastropheNaturalPath, 'commands');
    expect(commands).toHaveLength(602); expect(commands.slice(0, 599)).toHaveLength(599);
    expect(commands[598]).toEqual({ type: 'ACTION', action: 'REST' });
    expect(commands[599]).toEqual({ type: 'CATASTROPHE', command: { type: 'ENCOUNTER_TALK' } });
    expect(living).toMatchObject({ schemaVersion: 168, contentVersion: 'catastrophe-v168', revision: 600,
      status: 'ACTIVE', week: 138, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 2, day: 12 },
      health: 100, mind: 100, spirituality: 120, cash: 350, actionsRemaining: 3, injuries: [], injuryRisk: 0,
      random: { seed: 'sailor-natural-v026', cursor: 267 }, progression: { pathwayId: 'tyrant', sequence: 2, acting: 100, promotionWeek: 7 } });
    expect(living.character).toMatchObject({ name: '托林', gender: 'FEMALE', age: 26, coreStats: { physique: 34, perception: 27, will: 27, knowledge: 21 } });
    expect(living.catastrophe.promotionWeek).toBe(131);
    expect(living.catastrophe.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'CT2-VALE', approachWeek: null, attemptWeek: null });
    expect(dead).toMatchObject({ schemaVersion: 168, contentVersion: 'catastrophe-v168', revision: 603,
      status: 'DEAD', health: 0, random: { seed: 'sailor-natural-v026', cursor: 282 }, ending: { kind: 'DEATH' } });
    expect(Object.keys(living.progression.mastery)).toHaveLength(22);
    expect(Object.values(living.progression.mastery).filter(value => value === 0)).toHaveLength(7);
  }, 60000);

  it('renders the migrated living body, original water20, gate96 and Nora88 without any command or restoration', () => {
    const state = originalCatastrophe(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectThunderGod(state), onCommand = vi.fn();
    const view = render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    const resources = screen.getByRole('region', { name: '雷神当前资源' });
    expect(resources.textContent).toContain('托林'); expect(resources.textContent).toContain('健康100/100 · 精神100/100 · 灵性120/120');
    expect(resources.textContent).toContain('350便士 · 本周行动3 · 现有伤势0处 · 累计风险0');
    const site = originals();
    expect(site.textContent).toContain('诺拉 · 45岁，存活；精力88/100');
    expect(site.textContent).toContain('原控制位，累计实走36米');
    expect(site.textContent).toContain('本人在原小湾出口，累计实走12米');
    expect(site.textContent).toContain('同一原小湾边界12米，现场时钟123秒');
    expect(site.textContent).toContain('同一原水总量20单位：湾内20、水道0');
    expect(site.textContent).toContain('原闸关闭，耐久96/100，已经实际操作4次');
    expect(site.textContent).toContain('原系索耐久99/100、原绞盘耐久99/100、原轮耐久99/100，累计实际转动1次');
    expect(value.life.site).toEqual(state.catastrophe.life.site);
    expect(view.container.textContent).not.toMatch(editorial); expect(view.container.textContent).not.toMatch(/必须诊疗|先去诊所/);
    for (const key of tyrantLegacyKeys) expect(state[key]).toEqual(before[key]);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('keeps the separately migrated actual death read-only without resurrection', () => {
    const state = loadThunderGodFixture(catastropheNaturalPath, 'final'), before = structuredClone(state); assertValidSliceState(state);
    const value = projectThunderGod(state), onCommand = vi.fn();
    render(<ThunderGodPanel value={value} busy={false} blocked onCommand={onCommand} />);
    expect(state).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
    expect(screen.getByRole('region', { name: '雷神当前资源' }).textContent).toContain('健康0/100');
    expect(screen.getByText('本周目已经死亡，原身体、原人物与原物记录只读保留。')).toBeTruthy();
    for (const button of screen.queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('confirms the actually acquired and prepared original bottle with unchanged identity', () => {
    const state = prepared(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectThunderGod(state), onCommand = vi.fn();
    const consume = value.actions.find(entry => entry.enabled && entry.command.type === 'CONSUME')!; expect(consume).toBeTruthy();
    render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button'));
    const dialog = screen.getByRole('dialog', { name: '雷神操作确认' });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向');
    expect(dialog.textContent).not.toMatch(/身体会成为|确认接受晋升后的身体变化|确认拒绝身体变化/);
    expect(onCommand).not.toHaveBeenCalled(); const button = within(dialog).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command); expect(state).toEqual(before);
  }, 60000);

  it('renders genuine promotion with all22 old masteries, seven old zeros and two new zeros', () => {
    const source = originalCatastrophe(), state = promoted(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectThunderGod(state), onCommand = vi.fn();
    const view = render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    expect(value.currentGender).toBe(source.character.gender);
    expect(state.character).toMatchObject({ name: source.character.name, age: source.character.age, gender: source.character.gender });
    expect(originals().textContent).toContain('本阶不改变性别、姓名、年龄、性格与取向');
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(24); expect(value.abilities.slice(0, 22).filter(item => item.mastery === 0)).toHaveLength(7);
    expect(value.abilities.slice(22).map(item => [item.id, item.mastery])).toEqual(newIds.map(id => [id, 0]));
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(state.progression.mastery[ability.id]);
      expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    }
    for (const key of tyrantLegacyKeys) expect(state[key]).toEqual(source[key]);
    expect(view.container.textContent).not.toMatch(editorial); expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('shows Oren Gage as a distinct adult with his own4-charge rod and separate4-metre route', () => {
    const state = promoted(), before = structuredClone(state), value = projectThunderGod(state), onCommand = vi.fn(); assertValidSliceState(state);
    render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByRole('combobox', { name: '雷神目标' }), { target: { value: 'encounter' } });
    const encounter = screen.getByRole('region', { name: '雷神可选真实交战' });
    expect(encounter.textContent).toContain('欧伦·盖奇 · 48岁');
    expect(encounter.textContent).toContain('健康100/100、精神100/100、灵性120/120');
    expect(encounter.textContent).toContain('诺拉和芬恩·科尔在本场之外');
    expect(encounter.textContent).toContain('实际走过4米'); expect(encounter.textContent).toContain('雷击储能4/4');
    expect(encounter.textContent).toContain('原小湾的12米生活路线分别记录');
    expect(state.catastrophe.encounter).toEqual(before.catastrophe.encounter);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);
});
