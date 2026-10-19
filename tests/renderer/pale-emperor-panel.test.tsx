/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PaleEmperorPanel, type PaleEmperorPanelProps } from '../../src/renderer/PaleEmperorPanel.js';
import { projectPaleEmperor } from '../../src/domain/pale-emperor/index.js';
import { PALE_EMPEROR_ABILITIES, PALE_EMPEROR_INHERITED_ABILITIES, paleEmperorConsumptionRisk, PALE_EMPEROR_PREPARATIONS } from '../../src/domain/pale-emperor/content.js';
import type { PaleEmperorAction, PaleEmperorCommand, PaleEmperorProjection } from '../../src/domain/pale-emperor/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

afterEach(cleanup);
let sourceCache: SliceState | undefined;
function source() {
  if (!sourceCache) {
    sourceCache = migrateSliceState(readObjectEntry<SliceState>('tests/fixtures/death-consul-v01730/natural.json', 'final'));
    expect(sourceCache.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(sourceCache.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  }
  return sourceCache;
}
function action(command: PaleEmperorCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): PaleEmperorAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let original: PaleEmperorProjection | undefined;
/** Renderer-only UNIT projections, never valid saves or a simulated campaign.
 * Original bodies, resources and all seventeen inherited masteries come unchanged
 * from an explicitly migrated historical fixture, including five zero entries. */
function fixture(promoted = false): PaleEmperorProjection {
  const value = structuredClone(original ??= projectPaleEmperor(source()));
  Object.assign(value, {
    title: '苍白皇帝·死神序列1', discovered: true, guidanceKnown: promoted, promoted, acting: 0,
    story: '指导者介绍独立封存的苍白皇帝成品魔药。', supplies: '每瓶1200便士，完成本瓶五项劳动后支付80便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null, insideCase: false,
    digestion: promoted ? '苍白皇帝扮演0/100，普通完成同样可以报告。' : '死亡执政官消化100，实际晋升后须12整周。',
    risk: paleEmperorConsumptionRisk('POST_CYCLE'),
  } satisfies Partial<PaleEmperorProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `pale-emperor-potion-${number}`, title: `第${number}瓶 · 苍白皇帝成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `pale-emperor-potion-${number}`, confirmed: true } }));
  value.preparations = PALE_EMPEROR_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  value.abilities = promoted ? [...PALE_EMPEROR_INHERITED_ABILITIES.map(item => ({ ...item, mastery: source().progression.mastery[item.id] ?? 0 })),
    ...PALE_EMPEROR_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [action({ type: 'OBSERVE', caseId: 'quiet-lid' }, '观察同一残响容器', '0行动 · 2秒')]
    : [action({ type: 'LEARN_GUIDANCE' }, '听取苍白皇帝成品与专业准备指导', '1行动 · 120便士')];
  value.preferredActionId = value.actions[0]!.id;
  return value;
}
function show(value = fixture(), extra: Partial<PaleEmperorPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '苍白皇帝目标' });
const resources = () => screen.getAllByRole('region', { name: '苍白皇帝当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '苍白皇帝操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(FORECOURT|FAR|ENTRY|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"command"|"before"/;

describe('Pale Emperor panel: original resources and finite acquisition', () => {
  it('uses the migrated actual source and preserves four injuries, present resources and risk', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康20/100 · 精神100/100 · 灵性95/120');
    expect(resources().textContent).toContain('34便士 · 本周行动1 · 现有伤势4处 · 累计风险6');
    expect(within(resources()).getAllByText(/尚未治疗/)).toHaveLength(4);
    expect(value.injuries.filter(injury => injury.severity === 'LIGHT')).toHaveLength(2);
    expect(value.injuries.filter(injury => injury.severity === 'HEAVY')).toHaveLength(2);
    expect(screen.getByRole('region', { name: '苍白皇帝阶段总览' }).textContent).toContain('专业准备0/3');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3); expect(primary().textContent).toContain('120便士');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('renders seventeen inherited values, five inherited zeros and two new zeros without awarding mastery', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(19); expect(value.abilities.slice(0, 17).filter(item => item.mastery === 0)).toHaveLength(5);
    expect(value.abilities.slice(17).map(item => item.mastery)).toEqual([0, 0]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(value.abilities.slice(0, 17).map(item => [item.id, item.mastery])).toEqual(PALE_EMPEROR_INHERITED_ABILITIES.map(item => [item.id, source().progression.mastery[item.id]]));
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('confirms the exact selected bottle and its failure cost without changing identity or double submission', () => {
    const value = fixture(); value.preparedWeek = 3300; value.insideCase = true;
    value.actions = value.bottles.map(bottle => action(bottle.command, `饮用${bottle.title}`, '0行动 · 实际耗尽所选原瓶'));
    const before = structuredClone(value), view = show(value);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    const dialog = openPrimary(); expect(dialog.textContent).toContain('第2瓶独立封存');
    expect(dialog.textContent).toContain('当前成功率68%'); expect(dialog.textContent).toContain('健康−15精神−25排异+30');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向'); expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });
  it('retains the selected original bottle when saved labour changes', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<PaleEmperorPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });
  it('keeps custom names verbatim even if a name contains editorial words', () => {
    const value = fixture(); value.characterName = '原创G候选'; value.appearanceRecord = `${value.characterName}保有自己的身份。`;
    value.actions[0]!.label = `请${value.characterName}听取指导`; const view = show(value);
    expect(resources().textContent).toContain('原创G候选'); expect(primary().textContent).toContain('请原创G候选听取指导');
    expect(view.container.textContent).toContain('原创G候选保有自己的身份。');
  });
});

describe('Pale Emperor panel: accessible confirmation and same-save protection', () => {
  it('traps focus and restores the initiating control on cancel and Escape without dispatch', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取苍白皇帝成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(disabled(picker())).toBe(true); expect(button.closest('[inert]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(document.activeElement).toBe(button); expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(openPrimary(), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('keeps a submitted command locked across identical rerenders, error and error dismissal', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<PaleEmperorPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    view.rerender(<PaleEmperorPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });
  it('unlocks on new saved facts without automatically issuing the next command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    saved.guidanceKnown = true; saved.resources!.cash = '40便士'; saved.resources!.actionsRemaining = 2;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'VERIFY_PROVENANCE' }, '核对原瓶与旧物', '1行动')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<PaleEmperorPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
  });
  it('invalidates stale confirmation when the same action ID carries a changed command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} />);
    const staleConfirm = confirm(openPrimary()), saved = structuredClone(value);
    saved.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'VERIFY_PROVENANCE' };
    view.rerender(<PaleEmperorPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.click(staleConfirm); expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });
  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks mutation and navigation while %s', mode => {
    const value = fixture(), onClose = vi.fn();
    if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const view = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null, onClose });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' })); expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
  it('shows the current disabled reason and treats close as navigation only', () => {
    const value = fixture(); value.actions[0]!.enabled = false; value.actions[0]!.reason = '本周行动不足。';
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(disabled(primary())).toBe(true); expect(primary().getAttribute('aria-describedby')).toBeTruthy(); expect(screen.getByText('本周行动不足。')).toBeTruthy();
    fireEvent.click(primary()); fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(); expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

function inside(caseId: 'quiet-lid' | 'guarded-carry' | 'withdrawn-return' = 'quiet-lid') {
  const value = fixture(true), life = value.life, quiet = caseId === 'quiet-lid';
  life.activeCase = caseId; life.inside = life.insideCase = value.insideCase = true;
  life.clockSeconds = 100; life.elapsedSeconds = 100; life.playerTravelMetres = 12; life.playerLocation = 'NEAR'; life.conditionVersion = 2;
  life.site = {
    id: 'PE1-ANNEX', introducedWeek: 3300, introducedDate: { epoch: 'FIFTH_EPOCH', year: 1412, month: 9, day: 23 }, lengthMetres: 4, ordinaryRoadMetres: 12, ordinaryExit: 'OPEN',
    vessel: { id: 'PE1-VESSEL-1', nature: 'NON_SENTIENT_RESIDUAL', quantity: 1, owner: 'ANNEX', source: 'ANNEX_ORIGINAL_LOAN', holder: 'PLAYER', location: 'NEAR', agitation: quiet ? 0 : 2, lid: 'OPEN', seal: 'NONE', scuffs: 2, travelledMetres: 4, version: 2 },
    lid: { id: 'PE1-LID-1', location: 'NEAR', operations: 1, travelledMetres: 0 }, screen: { id: 'PE1-SCREEN-1', state: 'RETRACTED', location: 'NEAR', operations: 1, travelledMetres: 0 },
    door: { id: 'PE1-DOOR-1', location: 'NEAR', state: 'OPEN', operations: 0 }, box: { id: 'PE1-BOX-1', location: 'NEAR', closed: false, operations: 1, travelledMetres: 0 },
    loan: { custodianId: 'PE1-NORA', terms: 'RETURN_SAME_VESSEL_AND_LID', grantedWeek: 3300, returnedWeek: null, grants: 1, returns: 0 },
    seals: [1, 2].map(n => ({ id: `PE1-SEAL-${n}`, price: 4, state: 'PLAYER', purchasedWeek: 3300, usedWeek: null })),
  };
  life.nora = { id: 'PE1-NORA', name: '诺拉·贝尔', age: 42, source: 'CONTEMPORARY_ANNEX_CUSTODIAN', alive: true, health: 100, mind: 100, energy: 98, present: true, location: 'NEAR', travelMetres: 4 };
  const use = () => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' as const, remainingSeconds: 0 });
  const attempt: NonNullable<typeof life.currentAttempt> = {
    week: 3300, method: 'ABILITY', closed: false, result: 'NONE', elapsedSeconds: 20,
    playerTravelMetres: 0, noraTravelMetres: 4, noraEnergySpent: 2, vesselTravelMetres: 0, spiritualitySpent: quiet ? 8 : 7, mindSpent: 2,
    permission: { custodian: 'GRANTED', ability: 'GRANTED' }, permissionVersion: 2,
    prepared: true, observedVersion: 2, lidFitted: false, carried: false, resealed: false, manualReturned: false, loanReturned: false,
    quieting: use(), interdiction: use(),
  };
  Object.assign(quiet ? attempt.quieting : attempt.interdiction, { attempts: 1, successes: 1, effects: 0, tier: 'SUCCESS', state: 'ACTIVE', remainingSeconds: 20 });
  life.currentAttempt = attempt;
  const selected = life.cases.find(item => item.id === caseId)!; selected.status = 'ACTIVE'; selected.contactOpen = true; selected.method = 'ABILITY'; selected.attempts = [attempt];
  life.pending = { kind: quiet ? 'QUIETING' : 'INTERDICTION', caseId, vesselId: 'PE1-VESSEL-1', vesselVersion: 2, conditionVersion: 2, permissionVersion: 2, createdAt: 100, expiresAt: 120, line: quiet ? null : ['NEAR', 'FAR'] };
  value.actions = [action({ type: quiet ? 'FIT_LID' : 'CARRY_VESSEL' }, quiet ? '亲手合盖' : '实际搬运同一容器', '0行动 · 4秒'),
    action({ type: 'STOP' }, '停止尚未应用的窗口', '0行动 · 不退款'), action({ type: 'ABORT' }, '安全收物并走回接待处', '0行动 · 实际收物和步行')];
  value.actions[1]!.cleanup = value.actions[2]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
  return value;
}
const windows = () => screen.getByRole('region', { name: '两项残响能力的有限窗口' });

describe('Pale Emperor panel: same vessel, current consent and physical return', () => {
  it('does not invent an introduced annex or present adult before the first actual visit', () => {
    const value = fixture(true), view = show(value);
    expect(value.life.site).toBeNull(); expect(value.life.nora).toBeNull();
    expect(view.container.textContent).toContain('尚未实际到达附室');
    expect(screen.queryByRole('region', { name: '附室当前人物与原物' })).toBeNull(); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['quiet-lid', 'guarded-carry'] as const)('separates paid %s opening from actual application and mastery', caseId => {
    const value = inside(caseId), before = structuredClone(value), view = show(value);
    expect(windows().textContent).toContain(`${caseId === 'quiet-lid' ? '残响安定' : '灵迹阻隔'}还剩20秒`);
    expect(windows().textContent).toContain('成功开窗1次'); expect(windows().textContent).toContain('实际应用0次');
    expect(windows().textContent).toContain('不立即增加掌握'); expect(value.abilities.slice(17).map(ability => ability.mastery)).toEqual([0, 0]);
    const current = screen.getByRole('region', { name: '附室当前人物与原物' });
    expect(current.textContent).toContain('诺拉·贝尔 · 42岁'); expect(current.textContent).toContain('精力98/100');
    expect(current.textContent).toContain('擦痕2处'); expect(current.textContent).toContain('本人剩余2条、已用0条、尚未购买0条');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['expired', 'too-short', 'condition', 'door', 'screen', 'box', 'vessel', 'observation', 'permission', 'withdrawal', 'absent', 'location', 'disabled'] as const)('does not describe an active usable window after %s changed', change => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    if (change === 'expired') life.clockSeconds = 120;
    if (change === 'too-short') life.clockSeconds = 117;
    if (change === 'condition') life.conditionVersion++;
    if (change === 'door') life.site!.door.state = 'CLOSED';
    if (change === 'screen') life.site!.screen.state = 'DEPLOYED';
    if (change === 'box') life.site!.box.closed = true;
    if (change === 'vessel') life.site!.vessel.version++;
    if (change === 'observation') attempt.observedVersion = 1;
    if (change === 'permission') attempt.permissionVersion++;
    if (change === 'withdrawal') attempt.permission.ability = 'WITHDRAWN';
    if (change === 'absent') life.nora!.present = false;
    if (change === 'location') life.nora!.location = 'FAR';
    if (change === 'disabled') value.actions[0]!.enabled = false;
    const view = show(value); expect(windows().textContent).not.toMatch(/还剩\d+秒/);
    expect(windows().textContent).toContain('当前不可应用'); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['RESIDUAL_QUIETING', 'SPIRITUAL_INTERDICTION'] as const)('confirms exact %s cost and separate application without optimistic changes', type => {
    const value = inside(type === 'RESIDUAL_QUIETING' ? 'quiet-lid' : 'guarded-carry'); value.life.pending = null;
    value.actions = [action({ type }, type === 'RESIDUAL_QUIETING' ? '尝试残响安定' : '尝试灵迹阻隔', type === 'RESIDUAL_QUIETING' ? '8灵性＋2精神 · 意志18' : '7灵性＋2精神 · 知识18')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain(type === 'RESIDUAL_QUIETING' ? '消耗8灵性、2精神，意志18' : '消耗7灵性、2精神，知识18');
    expect(dialog.textContent).toContain('20秒'); expect(dialog.textContent).toContain('开窗本身');
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type }); expect(value).toEqual(before);
  });
  it('shows failed checks and the exact ordinary alternative without implying a new window or refund', () => {
    const value = inside(), use = value.life.currentAttempt!.quieting;
    value.life.pending = null; value.life.site!.vessel.agitation = 2; Object.assign(use, { state: 'FAILED', successes: 0, tier: 'FAILURE', remainingSeconds: 0 });
    value.actions = [action({ type: 'ORDINARY_FIT' }, '用原屏普通合盖', '原屏 · 12秒 · 原容器擦痕＋1')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value); expect(windows().textContent).toContain('判定失败'); expect(windows().textContent).toContain('实际应用0次');
    const dialog = openPrimary(); expect(dialog.textContent).toContain('实际花12秒'); expect(dialog.textContent).toContain('增加1处擦痕'); expect(dialog.textContent).toContain('不返还');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ORDINARY_FIT' }); expect(value).toEqual(before);
  });
  it('shows expired effects without resetting the same lid, seals, location or scuffs', () => {
    const value = inside('guarded-carry'), life = value.life; life.pending = null;
    Object.assign(life.currentAttempt!.interdiction, { state: 'EXPIRED', remainingSeconds: 0 });
    Object.assign(life.site!.vessel, { agitation: 2, location: 'FAR', lid: 'CLOSED', seal: 'BROKEN', scuffs: 3, travelledMetres: 8 });
    life.site!.seals[0]!.state = 'USED'; life.site!.seals[0]!.usedWeek = 3300;
    const before = structuredClone(value), view = show(value), current = screen.getByRole('region', { name: '附室当前人物与原物' });
    expect(windows().textContent).toContain('已经到期'); expect(windows().textContent).not.toMatch(/还剩\d+秒/);
    expect(current.textContent).toContain('唯一原容器在远台'); expect(current.textContent).toContain('躁动2/2，原盖合拢');
    expect(current.textContent).toContain('擦痕3处'); expect(current.textContent).toContain('本人剩余1条、已用1条'); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['CUSTODIAN', 'ABILITY'] as const)('identifies and submits only the requested %s permission', permission => {
    const value = inside(); value.actions = [action({ type: 'CONSENT', permission }, '确认这一次许可')]; value.preferredActionId = value.actions[0]!.id;
    const view = show(value), dialog = openPrimary();
    expect(within(dialog).getByRole('heading', { name: /确认这一次许可/ }).textContent).toContain(permission === 'CUSTODIAN' ? '诺拉本次保管参与' : '本人本次使用能力');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSENT', permission });
  });
  it('allows ordinary manual return after withdrawal at zero actions, never panel-close teleportation', () => {
    const value = inside('withdrawn-return'), life = value.life; life.pending = null; life.playerLocation = 'FAR'; life.nora!.location = 'FAR'; life.site!.vessel.location = 'FAR';
    life.currentAttempt!.permission.custodian = 'WITHDRAWN'; life.currentAttempt!.interdiction.state = 'STOPPED'; value.resources!.actionsRemaining = 0;
    life.site!.seals.forEach(seal => { seal.state = 'USED'; seal.usedWeek = 3300; });
    value.actions = [action({ type: 'MANUAL_RETURN' }, '普通收物并实搬回近台', '0行动 · 原屏和箱 · 实搬4米')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.getByRole('region', { name: '本次许可与实际代价' }).textContent).toContain('保管参与：已经撤回');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    const dialog = openPrimary(); expect(dialog.textContent).toContain('独自把同一容器从远台实搬4米回近台');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MANUAL_RETURN' }); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it('keeps ordinary alternatives in the public action list and sends their exact case and method', () => {
    const value = fixture(true); value.life.inside = value.life.insideCase = value.insideCase = true;
    value.actions = [action({ type: 'INVITE', caseId: 'quiet-lid', method: 'ABILITY' }, '付费邀请诺拉参加本案', '1行动 · 10便士'),
      action({ type: 'INVITE', caseId: 'quiet-lid', method: 'ORDINARY' }, '付费邀请诺拉参加本案', '1行动 · 10便士')]; value.preferredActionId = value.actions[0]!.id;
    const view = show(value), fold = screen.getByText('其他操作与普通替代').closest('details')!; fold.open = true;
    fireEvent.click(within(fold).getByRole('button')); const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /付费邀请诺拉参加本案/ }).textContent).toContain('普通处理'); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'INVITE', caseId: 'quiet-lid', method: 'ORDINARY' });
  });
  it('cancels confirmation when consent, paid resources or effect timing changes', () => {
    const value = inside(), onCommand = vi.fn(), view = render(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} />);
    const stale = confirm(openPrimary()), saved = structuredClone(value); saved.life.currentAttempt!.permission.ability = 'WITHDRAWN'; saved.life.pending = null; saved.life.clockSeconds++;
    saved.resources!.spirituality -= 7; view.rerender(<PaleEmperorPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.click(stale); expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });
});

function encounterFixture() {
  const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
  value.encounter.scene.playerLocation = 'FORECOURT'; value.encounter.scene.playerCoordinate = 4;
  value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动')]; value.preferredActionId = value.actions[0]!.id; return value;
}
describe('Pale Emperor panel: independent encounter and ordinary exit', () => {
  it.each(['INHERITED_ONLY', 'RESIDUAL_QUIETING', 'SPIRITUAL_INTERDICTION', 'ALL', 'ORDINARY'] as const)('confirms exact %s policy without starting combat', policy => {
    const value = encounterFixture(); value.actions = [action({ type: 'ENCOUNTER_POLICY', policy }, '明确选择本场策略')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain('只保存本场策略');
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy }); expect(value).toEqual(before);
  });
  it('shows independent Alden, exhausted finite marks, own screen and actual mental-versus-body limits', () => {
    const value = encounterFixture(); value.encounter.materials.weapon.location = 'FORECOURT'; value.encounter.materials.marks.remaining = 0;
    value.encounter.materials.marks.pieces.forEach(mark => { mark.state = 'SPENT'; }); value.encounter.enemy.powerUses.PALE_STRIKE = 3;
    value.encounter.scene.visibleBodyLine = false; value.encounter.scene.conditionVersion = 2; value.encounter.materials.screen.hood = 'CLOSED'; value.encounter.materials.screen.operations = 1;
    const before = structuredClone(value), view = show(value), opponent = screen.getByRole('region', { name: '苍白皇帝可选真实交战' });
    expect(opponent.textContent).toContain('阿尔登·沃德 · 47岁'); expect(opponent.textContent).toContain('健康100/100、精神100/100、灵性120/120');
    expect(opponent.textContent).toContain('原灵印剩余0/3枚，已经耗尽3枚'); expect(opponent.textContent).toContain('落在前庭地面');
    expect(opponent.textContent).toContain('当前视线受阻'); expect(opponent.textContent).toContain('原遮屏关闭');
    expect(opponent.textContent).toContain('身体棍击不在这两项能力的保护范围'); expect(opponent.textContent).toContain('诺拉与旧场人物均不在本场');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('requires confirmation before real combat and cancel commits nothing', () => {
    const value = encounterFixture(); value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '开始真实交战', '1行动')]; value.preferredActionId = value.actions[0]!.id;
    const view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain('双方独立受伤、投降、撤退与死亡都将保存');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' });
  });
  it('submits actual ordinary exit at zero actions instead of just closing the panel', () => {
    const value = encounterFixture(); value.resources!.actionsRemaining = 0;
    value.actions = [action({ type: 'LEAVE_ENCOUNTER' }, '沿普通路和平离开', '0行动 · 实际步行返程')]; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('Pale Emperor panel: saved outcomes remain authoritative', () => {
  it('shows the exhausted failed bottle and saved damage without retrying consumption', () => {
    const value = fixture(); value.preparedWeek = 3300; value.insideCase = true;
    value.actions = [action(value.bottles[0]!.command, '饮用第一瓶', '实际耗尽这一瓶')]; value.preferredActionId = value.actions[0]!.id;
    const onCommand = vi.fn(), view = render(<PaleEmperorPanel value={value} busy={false} onCommand={onCommand} />); fireEvent.click(confirm(openPrimary()));
    const saved = structuredClone(value); saved.preparedWeek = null; saved.insideCase = false;
    saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为死亡执政官'; saved.resources!.health = 5; saved.resources!.mind = 75; saved.pollution = 30;
    saved.actions = [action({ type: 'PREPARE_PROMOTION' }, '重新检查当周服药场地', '1行动 · 20便士', false, '健康须高于20。')]; saved.preferredActionId = null;
    view.rerender(<PaleEmperorPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(resources().textContent).toContain('健康5/100 · 精神75/100 · 灵性95/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽 · 排异'); expect(disabled(primary())).toBe(true);
    fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[0]!.command);
  });
  it('shows the paid visit cost and later invitation separately before walking', () => {
    const value = fixture(true); value.actions = [action({ type: 'WALK_TO_ANNEX' }, '步行十二米到附室', '1行动 · 12米/12秒')]; value.preferredActionId = value.actions[0]!.id;
    const view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain('邀请另需1行动与10便士'); expect(dialog.textContent).toContain('两条封条另付8便士');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WALK_TO_ANNEX' });
  });
  it('does not show an old closed attempt as current permission or award it again', () => {
    const value = inside(), life = value.life; life.activeCase = null; life.inside = life.insideCase = value.insideCase = false; life.pending = null;
    life.currentAttempt = null; const selected = life.cases[0]!, attempt = selected.attempts[0]!; attempt.closed = true; attempt.loanReturned = true;
    attempt.quieting.state = 'APPLIED'; attempt.quieting.effects = 1; selected.status = 'EXAMINED'; selected.contactOpen = false;
    life.playerLocation = 'RECEPTION'; life.nora!.location = 'AWAY'; life.nora!.present = false;
    value.actions = [action({ type: 'REPORT', caseId: 'quiet-lid' }, '报告本案实际结果', '1行动 · 扮演＋25')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), permissions = screen.getByRole('region', { name: '本次许可与实际代价' });
    expect(permissions.textContent).toContain('本案曾明确同意，当前无生效许可'); expect(windows().textContent).toContain('实际应用1次');
    expect(value.abilities.slice(17).map(item => item.mastery)).toEqual([0, 0]);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'REPORT', caseId: 'quiet-lid' }); expect(value).toEqual(before);
  });
  it('rejects a mismatched observed carry line in the displayed window', () => {
    const value = inside('guarded-carry'); value.life.pending!.line = ['FAR', 'NEAR']; const view = show(value);
    expect(windows().textContent).not.toMatch(/还剩\d+秒/); expect(windows().textContent).toContain('当前不可应用'); expect(view.onCommand).not.toHaveBeenCalled();
  });
});
