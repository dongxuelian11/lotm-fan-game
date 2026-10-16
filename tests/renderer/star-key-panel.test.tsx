/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StarKeyPanel, type StarKeyPanelProps } from '../../src/renderer/StarKeyPanel.js';
import { STAR_KEY_ABILITIES, STAR_KEY_CONSUMPTION_RISK, STAR_KEY_INHERITED_ABILITIES, STAR_KEY_PREPARATIONS } from '../../src/domain/star-key/content.js';
import { createStarKeyMaterials, createStarKeyScene, STAR_KEY_ENCOUNTER_STORY } from '../../src/domain/star-key/encounter.js';
import { createPlaneswalkerSiteState } from '../../src/domain/planeswalker/resources.js';
import type { StarKeyAction, StarKeyCommand, StarKeyProjection } from '../../src/domain/star-key/types.js';

afterEach(cleanup);

// Explicit renderer-only UNIT projections. These are presentation inputs, not
// valid saves, source continuations, random replays, or evidence of a natural run.
function action(command: StarKeyCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): StarKeyAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
const oldMastery: Record<string, number> = {
  'door.s9.door-opening': 78, 'door.s8.tricks': 45, 'door.s7.astrology': 66, 'door.s7.divination-interference': 8,
  'door.s6.recording': 8, 'door.s6.release': 8, 'door.s5.travel': 46, 'door.s5.invisible-hand': 0,
  'door.s4.space-hiding': 0, 'door.s4.space-pocket': 0, 'door.s4.banishment': 0,
  'door.s3.star-wandering': 0, 'door.s3.astral-positioning': 0, 'door.s2.symbolic-transit': 8, 'door.s2.pattern-reproduction': 0,
};
function fixture(promoted = false): StarKeyProjection {
  const actions = promoted ? [action({ type: 'OBSERVE', caseId: 'endpoint-verification' }, '观察原通行室与本次端点', '1行动')]
    : [action({ type: 'LEARN_GUIDANCE' }, '听取星之匙成品与专业准备指导', '1行动 · 500便士')];
  return {
    title: '星之匙·门序列1', characterName: '伊莲', discovered: true, guidanceKnown: promoted, promoted, formulaKnown: false, formula: [],
    story: '指导者介绍独立封存的星之匙成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null, actions, preferredActionId: actions[0]!.id,
    digestion: promoted ? '星之匙扮演0/100，普通完成同样可以报告。' : '旅法师消化100，晋升后须12整周。',
    pollution: 0, risk: STAR_KEY_CONSUMPTION_RISK, acting: 0,
    resources: { health: 98, maxHealth: 100, mind: 98, maxMind: 100, spirituality: 120, maxSpirituality: 120, cash: '560便士', actionsRemaining: 1 },
    injuries: [], injuryRisk: 0, currentGender: 'FEMALE', originalGender: 'FEMALE',
    appearanceRecord: '当前女性，姓名、年龄、性格与身体记录保留。', inheritedHistory: [],
    inheritedTools: '同一原封包与通行室保留；旧异星封包仍在异星原处，不能用作本地库存。', insideCase: false,
    environment: '同一通行室、玛拉与原封包各有自己的实际记录。',
    bottles: [1, 2, 3].map(number => ({ id: `star-key-potion-${number}`, title: `第${number}瓶 · 星之匙成品魔药`,
      source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
      command: { type: 'CONSUME', bottleId: `star-key-potion-${number}`, confirmed: true } })),
    preparations: STAR_KEY_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null })),
    abilities: promoted ? [...STAR_KEY_INHERITED_ABILITIES.map(item => ({ ...item, mastery: oldMastery[item.id] ?? 0 })),
      ...STAR_KEY_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [],
    life: lifeFixture(),
    encounter: {
      title: '罗温的前庭争议', story: STAR_KEY_ENCOUNTER_STORY, status: 'AVAILABLE', inside: false,
      policy: 'INHERITED_ONLY', policyConfirmed: false, scene: createStarKeyScene(), materials: createStarKeyMaterials(),
      enemy: { id: 'SK1-ROWAN-VALE', name: '罗温·维尔', age: 44, sequence: 1, health: 100, mind: 100, spirituality: 120,
        status: 'RESISTING', weaponLocation: 'HAND', powerUses: { SPATIAL_MARK: 0, MENTAL_MARK: 0, FEINT: 0 } },
      actions: [], facts: [],
    },
  };
}
function show(value = fixture(), extra: Partial<StarKeyPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<StarKeyPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '星之匙目标' });
const resources = () => screen.getAllByRole('region', { name: '星之匙当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '星之匙操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '星之匙其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(YARD|ROOM|ENTRY|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"command"|"before"/;

describe('Star Key panel: exact resources, finite acquisition and unchanged body', () => {
  it('shows one main step, actual resources and three independent bottles without inventing treatment', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康98/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('560便士 · 本周行动1 · 现有伤势0处 · 累计风险0');
    expect(screen.getByRole('region', { name: '星之匙阶段总览' }).textContent).toContain('专业准备0/3');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(view.container.textContent).not.toMatch(/必须诊疗|先去诊所/); expect(view.container.textContent).not.toMatch(editorial);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps existing injury severity, treatment and risk visible', () => {
    const value = fixture(); value.injuries = [{ id: 'unit-old-injury', severity: 'HEAVY', treated: true }]; value.injuryRisk = 9;
    const before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('现有伤势1处 · 累计风险9');
    expect(resources().textContent).toContain('伤势1：重伤 · 已经实际治疗');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('uses only the preferred public action and leaves alternatives collapsed', () => {
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对原封包与原通行室', '1行动'));
    value.preferredActionId = value.actions[1]!.id; const view = show(value);
    expect(primary().textContent).toContain('核对原封包与原通行室');
    expect((screen.getByText('其他操作与普通替代').closest('details') as HTMLDetailsElement).open).toBe(false);
    chooseExtra(value.actions[0]!.id); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms the exact selected original bottle with spent-on-failure costs and no gender transformation', () => {
    const value = fixture(); value.preparedWeek = 138; value.insideCase = true;
    value.bottles[0]!.status = value.bottles[1]!.status = '已交付，尚未服用';
    value.actions = value.bottles.slice(0, 2).map(bottle => action(bottle.command, `独立确认服用${bottle.title}`, '0行动 · 当周准备已付150便士'));
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(disabled(picker())).toBe(false); fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    const dialog = openPrimary(); expect(dialog.textContent).toContain('第2瓶独立封存'); expect(dialog.textContent).toContain('当前成功率68%');
    expect(dialog.textContent).toContain('健康−15精神−25排异+30'); expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向'); expect(dialog.textContent).not.toMatch(/身体会成为|接受身体变化/);
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });

  it('retains the selected original bottle after saved facts change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<StarKeyPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'star-key-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<StarKeyPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders all fifteen old masteries, seven old zeros and two new zeros without awards', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(17); expect(value.abilities.slice(0, 15).filter(item => item.mastery === 0)).toHaveLength(7);
    expect(value.abilities.slice(15).map(item => item.mastery)).toEqual([0, 0]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves a custom player name verbatim even when it contains editorial words', () => {
    const value = fixture(); value.characterName = '原创G候选'; value.appearanceRecord = `${value.characterName}保有自己的身份。`;
    value.actions[0]!.label = `请${value.characterName}听取指导`; const view = show(value);
    expect(resources().textContent).toContain('原创G候选'); expect(primary().textContent).toContain('请原创G候选听取指导');
    expect(view.container.textContent).toContain('原创G候选保有自己的身份。');
  });

  it('shows saved failure damage and a spent bottle without a second consumption', () => {
    const value = fixture(), bottle = value.bottles[0]!; value.preparedWeek = 138; value.insideCase = true;
    value.actions = [action(bottle.command, '独立确认服用第1瓶星之匙魔药')];
    const onCommand = vi.fn(), view = render(<StarKeyPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); view.rerender(<StarKeyPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为旅法师';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6600便士')];
    view.rerender(<StarKeyPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性120/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('Star Key panel: confirmation, focus and same-save protection', () => {
  it('traps focus, disables the background and restores the initiating button on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取星之匙成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(disabled(picker())).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回普通生活' }))).toBe(true);
    expect(button.closest('[inert]')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked across identical rerenders, errors and clearing the error', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<StarKeyPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<StarKeyPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    view.rerender(<StarKeyPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<StarKeyPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it('unlocks only after new committed facts and never automatically submits the next step', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<StarKeyPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    saved.guidanceKnown = true; saved.resources!.cash = '60便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对原封包与原通行室', '1行动')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<StarKeyPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
  });

  it('invalidates a confirmation if any saved facts or the same action ID command change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<StarKeyPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), oldConfirm = confirm(dialog), saved = structuredClone(value);
    saved.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' };
    view.rerender(<StarKeyPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.click(oldConfirm); expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks all commands and navigation while %s', mode => {
    const value = fixture(), onClose = vi.fn();
    if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const view = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null, onClose });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps a disabled action and its current reason visible without dispatch', () => {
    const value = fixture(); value.actions[0]!.enabled = false; value.actions[0]!.reason = '本周行动不足。'; const view = show(value);
    expect(disabled(primary())).toBe(true); expect(primary().getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('本周行动不足。')).toBeTruthy(); fireEvent.click(primary()); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('closes a settled page as navigation only', () => {
    const value = fixture(), before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(); expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('Star Key panel: independent opponent and finite stocks', () => {
  function encounter() {
    const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
    value.encounter.scene.playerLocation = 'YARD'; value.encounter.scene.playerCoordinate = 4;
    value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动', '0行动；开战前明确选择')];
    value.preferredActionId = value.actions[0]!.id; return value;
  }
  it.each(['INHERITED_ONLY', 'ENDPOINT_LOCATION', 'ANCHOR_MAINTENANCE', 'ALL', 'ORDINARY'] as const)('only confirms the exact %s policy', policy => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_POLICY', policy }, '明确选择本场策略')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('只保存本场策略'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy }); expect(value).toEqual(before);
  });
  it('shows the independent adult, spent original marks, changed sightline and bounded mental defense', () => {
    const value = encounter(); value.encounter.materials.weapon.location = 'YARD';
    value.encounter.materials.marks.forEach(mark => { mark.status = 'SPENT'; mark.usedRound = 1; });
    value.encounter.enemy.powerUses.SPATIAL_MARK = 2; value.encounter.enemy.powerUses.MENTAL_MARK = 1;
    value.encounter.enemy.spirituality = 99; value.encounter.scene.visibleBodyLine = false;
    value.encounter.scene.conditionVersion = 2; value.encounter.scene.observedConditionVersion = 1;
    const before = structuredClone(value), view = show(value), region = screen.getByRole('region', { name: '星之匙可选真实交战' });
    expect(region.textContent).toContain('罗温·维尔 · 44岁'); expect(region.textContent).toContain('灵性99/120');
    expect(region.textContent).toContain('等待本场明确选择'); expect(region.textContent).toContain('当前动作路线被遮挡');
    expect(region.textContent).toContain('现场条件版本2；最近实际观察版本1');
    expect(region.textContent).toContain('原印记剩余0/3枚，已耗尽3枚'); expect(region.textContent).toContain('已落在前庭地面');
    expect(region.textContent).toContain('不能挡普通棍击'); expect(region.textContent).toContain('身体与精神后果分别结算');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled(); expect(view.container.textContent).not.toMatch(editorial);
  });
  it('requires separate fight confirmation with saved strategy and real death risk', () => {
    const value = encounter(); value.encounter.policy = 'ANCHOR_MAINTENANCE'; value.encounter.policyConfirmed = true;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '自主承担真实冲突', '1行动；真实伤势与死亡风险')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('罗温·维尔'); expect(dialog.textContent).toContain('普通死亡终结本周目');
    expect(dialog.textContent).toContain('本场策略：允许锚点维系'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' }); expect(value).toEqual(before);
  });
  it('keeps a public four-metre zero-action exit available while inside without navigation or healing', () => {
    const value = encounter(); value.resources!.actionsRemaining = 0; value.resources!.spirituality = 7;
    value.actions = [action({ type: 'LEAVE_ENCOUNTER' }, '沿普通路和平离开', '0行动、4米4秒')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(primary())).toBe(false);
    const dialog = openPrimary(); expect(dialog.textContent).toContain('0行动、4米4秒'); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' }); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it('treats a nullable close callback as unavailable navigation', () => {
    const view = show(fixture(), { onClose: null });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(view.onCommand).not.toHaveBeenCalled();
  });
});

function lifeFixture(): StarKeyProjection['life'] {
  const site = createPlaneswalkerSiteState();
  Object.assign(site, { elapsedSeconds: 211, playerMetres: 40, playerAstralLegs: 2, operatorEnergy: 94, operatorConsent: 'WITHDRAWN', operatorConsentWeek: 198 });
  Object.assign(site.door, { operations: 8 }); Object.assign(site.parcel, { ordinaryMetres: 8, astralLegs: 2 });
  Object.assign(site.lamp, { oilRemaining: 2, shows: 1, patternKnown: true });
  Object.assign(site.kits['symbolic-transit'], { status: 'ARCHIVED', protectionSeconds: 70 });
  Object.assign(site.kits['withdrawn-transit'], { status: 'ARCHIVED', protectionSeconds: 90 });
  return {
    title: '原通行室、四米端点与普通归还', story: '先观察当前端点，再分别决定是否施用与实际应用。',
    source: '玛拉与原通行室、唯一原封包保留。', environment: '每次邀请10便士、1行动；普通步行每米1秒，玛拉每走2米消耗1精力。',
    activeCase: null, inside: false, insideCase: false, reflected: false, preferredActionId: null,
    clockSeconds: 211, elapsedSeconds: 0, playerLocation: 'ENTRY', playerTravelMetres: 0, maraTravelMetres: 0, conditionVersion: 1,
    site, maraPresent: true, pending: null, pendingUsable: false, pendingRemainingSeconds: 0, currentAttempt: null,
    cases: ([['endpoint-verification', '亲见端点与步行核验'], ['anchor-transfer', '已知两端与原包通过'], ['withdrawn-return', '尊重撤回与普通归还']] as const)
      .map(([id, title]) => ({ id, title, story: '重新邀请并取得本次许可，原包与身体实际走过原路。', observations: [], status: 'AVAILABLE', method: null, result: null, contactOpen: false, returned: false, attempts: [] })),
    ledger: [], actions: [],
  };
}
function inside(caseId: 'endpoint-verification' | 'anchor-transfer' | 'withdrawn-return' = 'endpoint-verification') {
  const value = fixture(true), life = value.life; value.insideCase = life.inside = life.insideCase = true;
  life.activeCase = caseId; life.playerLocation = 'NEAR'; life.clockSeconds = 250; life.elapsedSeconds = 39; life.playerTravelMetres = 14; life.maraTravelMetres = 2;
  life.site.playerLocation = 'NEAR'; life.site.playerMetres = 54; life.site.operatorLocation = 'NEAR'; life.site.operatorMetres = 2;
  life.site.operatorEnergy = 92; life.site.operatorConsent = 'GRANTED'; life.site.operatorConsentWeek = 202;
  life.site.parcel.location = 'PLAYER'; life.site.parcel.ordinaryMetres = 10; life.site.door.state = 'OPEN'; life.site.door.operations = 9;
  const use = (): NonNullable<StarKeyProjection['life']['currentAttempt']>['endpoint'] => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0, conditionVersion: null, clue: null });
  const attempt: NonNullable<StarKeyProjection['life']['currentAttempt']> = {
    week: 202, method: 'ABILITY', closed: false, result: 'NONE', elapsedSeconds: 39, playerTravelMetres: 14, maraTravelMetres: 2,
    operatorEnergySpent: 2, penniesSpent: 10, spiritualitySpent: caseId === 'endpoint-verification' ? 8 : 7, mindSpent: 2,
    permission: { owner: 'GRANTED', operator: 'GRANTED', ability: 'GRANTED' }, permissionVersion: 3,
    sourceRead: true, returnAgreed: true, padsChecked: true, returnMarkerChecked: true, parcelTaken: true, parcelReturned: false,
    doorOperations: 1, observedVersions: [1], endpointObservation: { atSeconds: 248, conditionVersion: 1, from: 'NEAR', to: 'FAR', distanceMetres: 4, parcelId: 'PW2-PARCEL', doorOperations: 9 },
    walkVerifyAttempted: false, verifyTier: null, walkVerified: false, manualVerified: false,
    walkCarryAttempted: false, carryTier: null, walkCarried: false, exited: false, endpoint: use(), anchor: use(),
  };
  life.currentAttempt = attempt;
  const current = life.cases.find(item => item.id === caseId)!; current.status = 'ACTIVE'; current.method = 'ABILITY'; current.contactOpen = true; current.attempts = [attempt];
  life.pending = { kind: caseId === 'endpoint-verification' ? 'ENDPOINT' : 'ANCHOR', caseId, createdAt: 250, expiresAt: 270, conditionVersion: 1, permissionVersion: 3, from: 'NEAR', to: 'FAR', parcelId: 'PW2-PARCEL', bonus: 10 };
  life.pendingUsable = true; life.pendingRemainingSeconds = 20;
  const power = caseId === 'endpoint-verification' ? attempt.endpoint : attempt.anchor;
  Object.assign(power, { attempts: 1, successes: 1, tier: 'SUCCESS', state: 'ACTIVE', remainingSeconds: 20, conditionVersion: 1,
    clue: caseId === 'endpoint-verification' ? '本次亲见远台在近台前方四米，仍须亲自步行核验。' : null });
  value.actions = [action({ type: caseId === 'endpoint-verification' ? 'WALK_VERIFY' : 'WALK_CARRY' }, caseId === 'endpoint-verification' ? '普通步行四米核验' : '携原包实际步行四米', '0行动 · 4米4秒')];
  value.preferredActionId = value.actions[0]!.id;
  return value;
}

describe('Star Key panel: current permission, original parcel and actual application', () => {
  it('preserves the actual starting room, 94 operator energy and archived stocks without moving or refilling', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    const details = screen.getByText('原通行室、玛拉与旧物当前记录').closest('details')!; details.open = true;
    const region = within(details).getByRole('region', { name: '原通行室当前状态' });
    expect(region.textContent).toContain('玛拉 · 42岁，当前在原入口，精力94/100');
    expect(region.textContent).toContain('已经撤回，第198周记录'); expect(region.textContent).toContain('累计普通步行40米');
    expect(region.textContent).toContain('数量1，现在原入口架上'); expect(region.textContent).toContain('累计普通搬运8米');
    expect(region.textContent).toContain('原油灯余油2份'); expect(region.textContent).toContain('原屏空白');
    expect(region.textContent).toContain('70秒（已归档）、90秒（已归档）');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['endpoint-verification', 'anchor-transfer'] as const)('separates a successful %s cast from the subsequent physical action', caseId => {
    const value = inside(caseId), before = structuredClone(value), view = show(value);
    const powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain(caseId === 'endpoint-verification' ? '端点定位记录还剩20秒' : '锚点维系记录还剩20秒');
    expect(powers.textContent).toContain('实际应用0次'); expect(powers.textContent).toContain('尚未实际完成');
    expect(powers.textContent).toContain('施放本身不增加掌握'); expect(primary().textContent).toContain('4米4秒');
    if (caseId === 'endpoint-verification') expect(powers.textContent).toContain('本次有限线索：本次亲见远台');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(value.life.site.playerLocation).toBe('NEAR'); expect(value.life.site.parcel.location).toBe('PLAYER');
  });
  it.each(['stale', 'expired', 'withdrawn', 'hidden', 'moved'] as const)('does not claim an unusable %s window can be applied or move the parcel', reason => {
    const value = inside(), life = value.life; life.pendingUsable = false;
    if (reason === 'stale') life.conditionVersion++;
    if (reason === 'expired') { life.clockSeconds = 270; life.pendingRemainingSeconds = 0; life.currentAttempt!.endpoint.remainingSeconds = 0; }
    if (reason === 'withdrawn') { life.currentAttempt!.permission.operator = 'WITHDRAWN'; life.site.operatorConsent = 'WITHDRAWN'; }
    if (reason === 'hidden') life.site.door.state = 'CLOSED';
    if (reason === 'moved') life.site.playerLocation = life.playerLocation = 'ENTRY';
    const before = structuredClone(value), view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('当前没有可应用的端点定位窗口'); expect(powers.textContent).not.toContain('本次有限线索：');
    expect(powers.textContent).toContain('实际应用0次'); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('reports saved physical application once and keeps ordinary travel separate from mastery', () => {
    const value = inside('anchor-transfer'), life = value.life, attempt = life.currentAttempt!;
    life.pending = null; life.pendingUsable = false; life.pendingRemainingSeconds = 0;
    life.playerLocation = life.site.playerLocation = 'FAR'; life.playerTravelMetres += 4; life.site.playerMetres += 4; life.site.parcel.ordinaryMetres += 4;
    Object.assign(attempt.anchor, { state: 'APPLIED', effects: 1, remainingSeconds: 0 });
    Object.assign(attempt, { walkCarryAttempted: true, carryTier: 'SUCCESS', walkCarried: true });
    const before = structuredClone(value), view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('锚点维系：成功，已经实际应用，实际应用1次');
    expect(powers.textContent).toContain('后续实际携包通过：成功，已实际完成');
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('本人在远台');
    expect(value.abilities.at(-1)!.mastery).toBe(0); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('keeps zero-action withdrawal and original parcel cleanup available without navigation', () => {
    const value = inside('withdrawn-return'); value.resources!.actionsRemaining = 0;
    value.actions = [action({ type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' }, '玛拉撤回本案当前许可', '0行动，不退已付费用')];
    value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(disabled(primary())).toBe(false); expect(disabled(picker())).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const dialog = openPrimary(); expect(dialog.textContent).toContain('仍须普通步行归还同一原包');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' });
    expect(value).toEqual(before); expect(onClose).not.toHaveBeenCalled();
  });
  it.each(['WALK_ENTRY', 'RETURN_PARCEL', 'CLOSE_DOOR', 'EXIT_ROOM'] as const)('submits the exact zero-action %s cleanup without auto-moving originals', type => {
    const value = inside('withdrawn-return'); value.resources!.actionsRemaining = 0;
    value.actions = [action({ type }, '普通收尾原现场', '0行动，保留实际时间与步行')]; value.actions[0]!.cleanup = true;
    value.preferredActionId = value.actions[0]!.id; const before = structuredClone(value), view = show(value);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type }); expect(value).toEqual(before);
  });
  it('does not present past closed consent as current permission', () => {
    const value = inside(), life = value.life; life.activeCase = null; life.inside = life.insideCase = value.insideCase = false;
    const old = life.cases[0]!; old.contactOpen = false; old.attempts[0]!.closed = true;
    life.pendingUsable = false; life.pending = null; life.pendingRemainingSeconds = 0;
    const view = show(value), permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('本案曾明确同意，当前无生效许可'); expect(permissions.textContent).not.toContain('当前明确同意');
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});
