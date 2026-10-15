/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AllKnowingEyePanel } from '../../src/renderer/AllKnowingEyePanel.js';
import { projectAllKnowingEye } from '../../src/domain/all-knowing-eye/index.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { originalWisdomAngel, loadAllKnowingEyeFixture, prepared, promoted, readerLegacyKeys,
  wisdomAngelNaturalPath, wisdomAngelBranchPath } from '../domain/all-knowing-eye-directed-helper.js';

afterEach(cleanup);
async function hash(path: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
function room() {
  const fold = screen.getByText('原房间、玛拉与旧物当前记录').closest('details')!; fold.open = true;
  return within(fold).getByRole('region', { name: '原房间当前状态' });
}
const newIds = ['reader.s1.bounded-insight', 'reader.s1.pending-forecast'];
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|完整配方与仪式仍未知/;
const defensivePath = 'tests/fixtures/wisdom-angel-v01700/defensive-round-2.json';

// Raw historical pins deliberately do not enter the current validator. All
// projector inputs cross the one explicit shared fixture-migration boundary.
describe('All-Knowing Eye renderer: genuine living source, preserved dead endings and originals', () => {
  it('pins the untouched 537-command living checkpoint separately from both dead captures', async () => {
    expect(await hash(wisdomAngelNaturalPath)).toBe('2e24ce11c787ba9b51d10d58b2abe9917c17a34a000d10394605944d52043e96');
    expect(await hash(wisdomAngelBranchPath)).toBe('c208e391bb21812061361737bf5b22d6d3b21352945231eb81d0bd11c7be1fdd');
    expect(await hash(defensivePath)).toBe('6d34a93817e084cc3937eb15cde42300137d9d3b71c8ff84d814c42c8a46f870');
    const dead = readObjectEntry<SliceState>(wisdomAngelNaturalPath, 'final');
    const living = readObjectEntry<SliceState>(wisdomAngelBranchPath, 'beforeLast');
    const commands = readObjectEntry<SliceIntent[]>(wisdomAngelNaturalPath, 'commands');
    expect(commands).toHaveLength(543); expect(commands.slice(0, 537)).toHaveLength(537);
    expect(commands[536]).toEqual({ type: 'ACTION', action: 'REST' });
    expect(commands[537]).toEqual({ type: 'WISDOM_ANGEL', command: { type: 'ENCOUNTER_TALK' } });
    expect(living).toMatchObject({ schemaVersion: 167, contentVersion: 'wisdom-angel-v167', revision: 538,
      status: 'ACTIVE', week: 125, date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 11, day: 13 },
      health: 100, mind: 100, spirituality: 120, cash: 410, actionsRemaining: 3, injuries: [], injuryRisk: 0,
      random: { seed: 'reader-natural-v023', cursor: 180 }, progression: { sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(living.wisdomAngel.promotionWeek).toBe(117);
    expect(living.wisdomAngel.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'WA2-VICTOR', approachWeek: null, attemptWeek: null });
    expect(dead).toMatchObject({ schemaVersion: 167, contentVersion: 'wisdom-angel-v167', revision: 544,
      status: 'DEAD', health: 0, random: { seed: 'reader-natural-v023', cursor: 239 }, ending: { kind: 'DEATH' } });
    expect(living.mysticismMagister.crafts.map(craft => [craft.id, craft.status])).toEqual([
      ['MM5-FLASH-1', 'CONSUMED'], ['MM5-FLASH-3', 'PLAYER'], ['MM5-FLASH-4', 'PLAYER'],
    ]);
    expect(dead.mysticismMagister.crafts.every(craft => craft.status === 'CONSUMED')).toBe(true);
  }, 60000);

  it('renders the migrated living body, exact zero-charge original device and old paper read history without any command', () => {
    const state = originalWisdomAngel(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectAllKnowingEye(state), onCommand = vi.fn();
    const view = render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    const resources = screen.getByRole('region', { name: '全知之眼当前资源' });
    expect(resources.textContent).toContain('罗温'); expect(resources.textContent).toContain('健康100/100 · 精神100/100 · 灵性120/120');
    expect(resources.textContent).toContain('410便士 · 本周行动3 · 现有伤势0处 · 累计风险0');
    const originals = room();
    expect(originals.textContent).toContain('玛拉 · 43岁，存活；健康100/100、精神100/100');
    expect(originals.textContent).toContain('原门外出口，累计实走24米');
    expect(originals.textContent).toContain('原房间通路长4米'); expect(originals.textContent).toContain('原门开放');
    expect(within(originals).getAllByText(/首次实际阅读：第118周/)).toHaveLength(2);
    expect(originals.textContent).toContain('剩余储能0格；琥珀滤片，条件版本2');
    expect(originals.textContent).toContain('已实做2次演示、实际换滤片1次');
    expect(value.life.room).toEqual(state.wisdomAngel.life.room);
    const { present: _present, ...mara } = value.life.mara;
    expect(mara).toEqual(state.wisdomAngel.life.mara);
    expect(value.life.papers).toEqual(state.wisdomAngel.life.papers);
    expect(value.life.device).toEqual(state.wisdomAngel.life.device);
    for (const paper of state.wisdomAngel.life.papers) expect(originals.textContent).toContain(paper.text);
    expect(state.prophet.encounter.enemy).toMatchObject({ id: 'PF4-HAROLD', health: 70, status: 'SURRENDERED' });
    expect(state.insightScholar.encounter).toMatchObject({ targetId: 'IS3-ALTON', status: 'RESOLVED', attemptWeek: null });
    expect(state.wisdomAngel.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
    expect(view.container.textContent).not.toMatch(editorial); expect(view.container.textContent).not.toMatch(/必须诊疗|先去诊所/);
    for (const key of readerLegacyKeys) expect(state[key]).toEqual(before[key]);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it.each([wisdomAngelNaturalPath, defensivePath])('keeps the separately migrated %s death read-only without resurrection', path => {
    const state = loadAllKnowingEyeFixture(path, 'final'), before = structuredClone(state); assertValidSliceState(state);
    const value = projectAllKnowingEye(state), onCommand = vi.fn();
    render(<AllKnowingEyePanel value={value} busy={false} blocked onCommand={onCommand} />);
    expect(state).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
    expect(screen.getByRole('region', { name: '全知之眼当前资源' }).textContent).toContain('健康0/100');
    expect(screen.getByText('本周目已经死亡，原身体、原人物与原物记录只读保留。')).toBeTruthy();
    for (const button of screen.queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('confirms only the actually acquired, prepared original bottle, without body transformation or a second command', () => {
    const state = prepared(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectAllKnowingEye(state), onCommand = vi.fn();
    const consume = value.actions.find(entry => entry.enabled && entry.command.type === 'CONSUME')!; expect(consume).toBeTruthy();
    render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button'));
    const dialog = screen.getByRole('dialog', { name: '全知之眼操作确认' });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向');
    expect(dialog.textContent).not.toMatch(/身体会成为|确认接受晋升后的身体变化|确认拒绝身体变化/);
    expect(onCommand).not.toHaveBeenCalled(); const button = within(dialog).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command); expect(state).toEqual(before);
  }, 60000);

  it('renders genuine promotion with nineteen old masteries, five unchanged zeros and two new zeros', () => {
    const source = originalWisdomAngel(), state = promoted(), before = structuredClone(state); assertValidSliceState(state);
    const value = projectAllKnowingEye(state), onCommand = vi.fn();
    const view = render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    expect(value.currentGender).toBe(source.character.gender); expect(state.character).toMatchObject({ name: source.character.name, age: source.character.age, gender: source.character.gender });
    expect(room().textContent).toContain('本阶不改变性别、姓名、年龄、性格与取向');
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(21); expect(value.abilities.slice(0, 19).filter(item => item.mastery === 0)).toHaveLength(5);
    expect(value.abilities.slice(19).map(item => [item.id, item.mastery])).toEqual(newIds.map(id => [id, 0]));
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(state.progression.mastery[ability.id]);
      expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    }
    for (const key of readerLegacyKeys) expect(state[key]).toEqual(source[key]);
    expect(fold.textContent).toContain('MM5-FLASH-1已耗尽');
    expect(fold.textContent).toContain('MM5-FLASH-3尚持有'); expect(fold.textContent).toContain('MM5-FLASH-4尚持有');
    expect(view.container.textContent).not.toMatch(editorial); expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('shows Edwin Ross as a distinct adult, with his own four-charge rod and ordinary four-metre exit', () => {
    const state = promoted(), before = structuredClone(state), value = projectAllKnowingEye(state), onCommand = vi.fn(); assertValidSliceState(state);
    render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByRole('combobox', { name: '全知之眼目标' }), { target: { value: 'encounter' } });
    const encounter = screen.getByRole('region', { name: '全知之眼可选真实交战' });
    expect(encounter.textContent).toContain('埃德温·罗斯 · 47岁');
    expect(encounter.textContent).toContain('健康100/100、精神100/100、灵性120/120');
    expect(encounter.textContent).toContain('玛拉和伊蕾娜·韦尔在本场之外');
    expect(encounter.textContent).toContain('实际走过4米'); expect(encounter.textContent).toContain('储能4/4');
    const crafts = screen.getByRole('region', { name: '已有样本与原微光片' });
    expect(crafts.textContent).toContain('闪光样本在第42周实际学会');
    expect(crafts.textContent).toContain('MM5-FLASH-1：第58周以原材料MM5-KIT-1制成，第58周已实际耗尽');
    expect(crafts.textContent).toContain('MM5-FLASH-3：第63周以原材料MM5-KIT-3制成，本人尚持有同一原片');
    expect(crafts.textContent).toContain('MM5-FLASH-4：第123周以原材料MM5-KIT-4制成，本人尚持有同一原片');
    expect(crafts.textContent).toContain('当前尚持有2枚');
    expect(state.wisdomAngel.encounter).toEqual(before.wisdomAngel.encounter);
    expect(state.mysticismMagister.crafts).toEqual(before.mysticismMagister.crafts);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);
});
