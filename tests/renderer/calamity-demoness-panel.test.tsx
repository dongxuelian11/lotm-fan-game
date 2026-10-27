/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalamityDemonessPanel } from '../../src/renderer/CalamityDemonessPanel';
import type { CalamityDemonessAction, CalamityDemonessCommand, CalamityDemonessProjection } from '../../src/domain/calamity-demoness/types';
import type { CalamityDemonessPublicAttempt, CalamityDemonessCaseId, CalamityDemonessPublicSite, CalamityDemonessPublicHistory } from '../../src/domain/calamity-demoness/life';

// Small renderer-only public fixtures, not domain saves, replay evidence or natural outcomes.
// They never load campaign fixtures or the whole application.
const INHERITED = [
  ['assassin.s9.lightness', '短暂轻身与敏捷步伐', 24], ['assassin.s9.vision', '鹰视与黑暗视觉', 33],
  ['assassin.s9.shadow', '藏影', 57], ['assassin.s9.burst', '集中力量的一击', 16], ['assassin.s8.instigation', '教唆', 8],
  ['assassin.s7.black-flame', '有限黑焰', 8], ['assassin.s7.frost', '冰霜', 41], ['assassin.s7.invisibility', '本人隐形', 8],
  ['assassin.s7.substitute', '有限替身', 0], ['assassin.s7.divination-interference', '占卜与干扰', 0], ['assassin.s7.black-magic', '黑魔法', 0],
  ['assassin.s6.silk-binding', '真实蛛丝与有限束缚', 8], ['assassin.s6.charm', '有限魅惑', 8], ['assassin.s5.disease', '渐进的超自然疾病', 8],
  ['assassin.s4.plague', '渐进瘟疫与有限施法干扰', 8], ['assassin.s3.mirror-passage', '镜界通行', 8],
] as const;
const TITLES: Record<CalamityDemonessCaseId, string> = { 'mirror-screen': '原镜前的一次封闭负载', 'black-flame-channel': '原箱内的一份封装残留物', 'revoked-window': '撤回许可后的普通路线' };
function historicalScene(): CalamityDemonessPublicHistory {
  return { clockSeconds: 247, playerLocation: 'START', playerTravelMetres: 86,
    vera: { name: '维瑞娜·肖', age: 46, location: 'START' },
    marcus: { name: '马库斯·赫尔', age: 41, location: 'B' },
    mirrorA: { id: 'UD3-MIRROR-A', intact: true }, mirrorB: { id: 'UD3-MIRROR-B', intact: true },
    entry: { held: false }, shutter: { state: 'OPEN' } };
}
function site(): CalamityDemonessPublicSite {
  return { siteId: 'CD2-GALLERY-ANNEX', introducedWeek: 139, introducedDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 1 }, clockSeconds: 48,
    playerLocation: 'A', playerTravelMetres: 12, playerEnergy: 88,
    vera: { id: 'UD3-VERA', name: '维瑞娜·肖', age: 46, alive: true, willing: true, location: 'ENTRY', energy: 98, travelMetres: 2, mirrorConsent: 'GRANTED', boxConsent: 'UNASKED' },
    marcus: { id: 'UD3-MARCUS', name: '马库斯·赫尔', age: 41, alive: true, willing: true, location: 'ENTRY', energy: 76, travelMetres: 24, mirrorConsent: 'GRANTED', boxConsent: 'UNASKED' },
    mirrorA: { id: 'UD3-MIRROR-A', owner: 'UD3-VERA', quantity: 1, location: 'A', intact: true },
    mirrorB: { id: 'UD3-MIRROR-B', owner: 'UD3-VERA', quantity: 1, location: 'B', intact: true },
    load: { id: 'CD2-TEST-LOAD', location: 'A', enclosed: true, initialForce: 12, remainingLoads: 0, appliedLoads: 1, finalForce: 7, bufferedForce: 5 },
    box: { id: 'CD2-BOX', ownerId: 'UD3-MARCUS', location: 'BOX', state: 'CLOSED', scorched: false, pulses: 0, pulseSeconds: 0, handovers: 0 }, residue: null,
    screen: { active: false, mirrorId: 'UD3-MIRROR-A', expiresAt: null, plateId: null },
    plates: [
      { id: 'CD2-PLATE-1', caseId: 'mirror-screen', ownerId: 'PLAYER', quantity: 1, status: 'CONSUMED', location: 'A', charges: 0, wear: 5, scorched: false, paidPennies: 20, preparedWeek: 139 },
      { id: 'CD2-PLATE-2', caseId: 'black-flame-channel', ownerId: 'PLAYER', quantity: 1, status: 'SUPPLY', location: 'SUPPLY', charges: 1, wear: 0, scorched: false, paidPennies: 0, preparedWeek: null },
      { id: 'CD2-PLATE-3', caseId: 'revoked-window', ownerId: 'PLAYER', quantity: 1, status: 'SUPPLY', location: 'SUPPLY', charges: 1, wear: 0, scorched: false, paidPennies: 0, preparedWeek: null },
    ], actorMoves: [
      { actorId: 'UD3-VERA', from: 'SOURCE_START', to: 'ENTRY', mode: 'SOURCE_ARRIVAL', metres: 2, seconds: 2 },
      { actorId: 'UD3-MARCUS', from: 'SOURCE_B', to: 'ENTRY', mode: 'SOURCE_ARRIVAL', metres: 24, seconds: 24 },
    ] };
}
function attempt(p: CalamityDemonessPublicSite, overrides: Partial<CalamityDemonessPublicAttempt> = {}): CalamityDemonessPublicAttempt {
  return { week: 139, method: 'ABILITY', closed: false, result: 'ABILITY', stopped: false, inspected: false, permissionWithdrawn: false,
    elapsedSeconds: 14, playerTravelMetres: 4, energySpent: 4, spiritualitySpent: 6, penniesSpent: 20,
    operatorConsent: 'GRANTED', ownerConsent: 'GRANTED', routeConsent: 'GRANTED', consentWeek: 139,
    plateId: 'CD2-PLATE-1', plateInstalled: true, plateReturned: false, abilityTier: 'SUCCESS', window: 'APPLIED', windowExpiresAt: null,
    loadApplied: true, bufferedForce: 5, plateWear: 5, pulseApplied: false, residueHandedOver: false, boxClosed: false, clearanceConfirmed: false, adultsReturned: false,
    routeWalked: false, routeReturned: false, waits: 0, appliedAbilityIds: ['assassin.s2.mirror-screen'], playerMoves: [], actorMoves: [], siteAtStart: structuredClone(p), siteAtClose: null, ...overrides };
}
function action(command: CalamityDemonessCommand, label: string, cost: string, enabled = true, reason: string | null = null): CalamityDemonessAction {
  return { id: `display:${command.type}:${'bottleId' in command ? command.bottleId : 'caseId' in command ? command.caseId : 'once'}${command.type === 'WALK' ? `:${command.to}` : ''}`, command, label, cost, enabled, reason };
}
function view(promoted = true): CalamityDemonessProjection {
  const p = site(), a = attempt(p);
  return { title: '灾难魔女', discovered: true, guidanceKnown: true, promoted, formulaKnown: false, formula: [], story: '核对同两面原镜与当前自愿许可。', supplies: '各瓶独立取得并记录。', actions: [],
    bottles: [1, 2].map((n): CalamityDemonessProjection['bottles'][number] => ({ id: `calamity-demoness-potion-${n}`, title: `第${n}瓶灾难魔女成品魔药`, source: `专业交接处的第${n}瓶独立原瓶。`, status: n === 1 ? '已耗尽，未晋升' : '本人持有，尚未饮用', chance: 72, command: { type: 'CONSUME', bottleId: `calamity-demoness-potion-${n}`, confirmed: true } })),
    preparations: [{ taskId: 'TRACE_ORIGINAL_MIRRORS', title: '核对原镜来源与现有状态', completedWeek: 136 }, { taskId: 'PLAN_CONTAINMENT', title: '安排封闭负载与残留物处置', completedWeek: 137 }, { taskId: 'CHECK_RETURN', title: '走查停止与普通返回路线', completedWeek: 137 }], preparedWeek: promoted ? null : 138,
    abilities: [...INHERITED.map(([id, label, mastery]) => ({ id, label, mastery, description: '按既有身体、原物与实际掌握使用。' })), ...(promoted ? [
      { id: 'assassin.s2.mirror-screen', label: '短暂镜幕', mastery: 0, description: '6灵性尝试，实际缓冲才算应用。' },
      { id: 'assassin.s2.black-flame-channel', label: '封闭黑焰疏导', mastery: 0, description: '本人到已闭箱前作一次有限尝试。' },
    ] : [])], acting: promoted ? 0 : 100, digestion: promoted ? '灾难魔女消化0/100。' : '不老魔女消化100/100。', pollution: 0,
    risk: '服药耗尽原瓶和当次检查。普通战斗仍可能造成伤势或死亡。', resources: { health: 100, maxHealth: 100, mind: 85, maxMind: 100, spirituality: 111, maxSpirituality: 120, cash: '3镑2苏勒', actionsRemaining: 1 },
    currentGender: 'FEMALE', inheritedHistory: ['第115周实际晋升不老魔女，原消化100/100保留。', '原科宾已经投降，原身体、原棍和旧伤保留。'], appearanceRecord: '延续女巫时期的女性身体，不重复变化。',
    life: { title: '原馆舍附廊', story: '原人原物与实际消耗逐案保存。', environment: '门口0米，原镜A4米，原箱8米，原镜B12米。', activeCase: promoted ? 'mirror-screen' : null, inside: promoted, insideCase: promoted, reflected: false, site: p, historicalScene: historicalScene(),
      clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: promoted ? a : null,
      cases: (Object.keys(TITLES) as CalamityDemonessCaseId[]).map((id): CalamityDemonessProjection['life']['cases'][number] => ({ id, title: TITLES[id], story: '每案当前许可独立，普通退路始终保留。', observations: [], status: id === 'mirror-screen' && promoted ? 'ACTIVE' : 'AVAILABLE', method: id === 'mirror-screen' && promoted ? 'ABILITY' : null, result: null, contactOpen: id === 'mirror-screen' && promoted, returned: false, closes: 0, attempts: id === 'mirror-screen' && promoted ? [a] : [] })), actions: [] },
    encounter: { title: '庭院里的伊瑞丝', story: '伊瑞丝持自己的原棍提出通行争议。', status: 'AVAILABLE', inside: false, site: null, startSite: null, preparation: null, plate: null, enemy: null, actions: [], facts: [] }, insideCase: promoted, environment: '贝克兰德馆舍附廊' };
}
function renderView(value: CalamityDemonessProjection, extra: { busy?: boolean; blocked?: boolean; error?: string | { message: string; retryable?: boolean } | null } = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), props = { value, busy: false, error: null, onCommand, onClose, ...extra };
  return { ...render(<CalamityDemonessPanel {...props}/>), props, onCommand, onClose };
}
function copyIsNatural(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/候选|原文未核|原创G|本作G|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])/);
  expect(node.textContent).not.toMatch(/银甲|近身护持|白银骑士|"(?:playerEnergy|siteAtStart|appliedAbilityIds)"\s*:/);
}
async function choose(a: CalamityDemonessAction) {
  const button = screen.getByRole('button', { name: name => name.startsWith(a.label) }); await userEvent.click(button); return button;
}
const confirm = () => within(screen.getByRole('dialog')).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一药瓶)$/ });
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'), close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Calamity Demoness independent confirmations and committed-state gates', () => {
  const acquisitions: [CalamityDemonessCommand, string, string][] = [
    [{ type: 'LEARN_GUIDANCE' }, '听取专业指导', '1行动 · 500便士'],
    [{ type: 'BUY_POTION', bottleId: 'calamity-demoness-potion-2' }, '支付本瓶余款', '0行动 · 900便士'],
    [{ type: 'PREPARE_PROMOTION' }, '实际检查服药场地', '1行动 · 140便士'],
    [{ type: 'CONSUME', bottleId: 'calamity-demoness-potion-2', confirmed: true }, '服用第2瓶灾难魔女成品魔药', '0行动 · 意志30 · 耗本瓶与当次检查'],
    [{ type: 'REQUEST_SUPPLY' }, '申请下一批原瓶', '1行动 · 下一真实周到货'],
    [{ type: 'RECEIVE_SUPPLY' }, '接收实际到货原瓶', '0行动'],
  ];
  it.each(acquisitions)('%s submits only its exact projected command after independent confirmation', async (command, label, cost) => {
    const value = view(false), a = action(command, label, cost); value.actions = [a]; const saved = structuredClone(value), ui = renderView(value);
    await choose(a); const dialog = screen.getByRole('dialog'); expect(dialog.textContent).toContain(cost); copyIsNatural(dialog);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(saved); await userEvent.click(confirm());
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(ui.onCommand.mock.calls[0]![0]).toBe(a.command); expect(value).toEqual(saved);
  });
  it('retains the selected original bottle, cancels without costs, restores focus and prevents double submission', async () => {
    const value = view(false), a = action(acquisitions[3]![0], acquisitions[3]![1], acquisitions[3]![2]); value.actions = [a]; const saved = structuredClone(value), ui = renderView(value);
    const trigger = screen.getByRole('button', { name: name => name.startsWith(a.label) }); expect((screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement).value).toBe('calamity-demoness-potion-2');
    for (const mode of ['button', 'escape', 'native']) {
      await userEvent.click(trigger); const dialog = screen.getByRole('dialog'), cancel = within(dialog).getByRole('button', { name: '取消，返回查看' });
      expect(document.activeElement).toBe(cancel);
      for (const text of ['第2瓶灾难魔女成品魔药', '当前成功率72%', '无论成功失败都会耗尽', '十六项已有掌握', '不补满当前灵性', '不修复原镜']) expect(dialog.textContent).toContain(text);
      if (mode === 'button') await userEvent.click(cancel); else if (mode === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' }); else fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger); expect(ui.onCommand).not.toHaveBeenCalled();
    }
    await userEvent.click(trigger); const submit = confirm(); fireEvent.click(submit); fireEvent.click(submit); expect(ui.onCommand).toHaveBeenCalledOnce(); expect(value).toEqual(saved);
  });
  it('closes the native modal on save failure but keeps the pending intent locked for the parent retry', async () => {
    const closeSpy = vi.spyOn(HTMLDialogElement.prototype, 'close');
    const value = view(false), a = action(acquisitions[3]![0], acquisitions[3]![1], acquisitions[3]![2]); value.actions = [a]; const ui = renderView(value);
    await choose(a); fireEvent.click(confirm()); ui.rerender(<CalamityDemonessPanel {...ui.props} busy/>);
    for (const error of [{ message: '本次保存被拒绝', retryable: true }, null]) {
      ui.rerender(<CalamityDemonessPanel {...ui.props} value={structuredClone(value)} error={error}/>);
      for (const button of screen.getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
      for (const select of screen.getAllByRole('combobox', { hidden: true })) expect((select as HTMLSelectElement).disabled).toBe(true);
      expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByRole('button', { name: /重试/, hidden: true })).toBeNull();
      expect(ui.onCommand).toHaveBeenCalledOnce(); expect(ui.onClose).not.toHaveBeenCalled();
    }
    expect(closeSpy).toHaveBeenCalledOnce();
    const committed = structuredClone(value); committed.bottles[1]!.status = '已耗尽，晋升成功'; committed.resources!.mind = 70;
    ui.rerender(<CalamityDemonessPanel {...ui.props} value={committed} error="仍待同一次保存"/>); expect(screen.getByRole('region', { name: '灾难魔女' }).getAttribute('aria-busy')).toBe('true');
    ui.rerender(<CalamityDemonessPanel {...ui.props} value={committed}/>); expect(screen.getByRole('region', { name: '灾难魔女' }).getAttribute('aria-busy')).toBe('false'); expect(ui.onCommand).toHaveBeenCalledOnce();
  });
  it.each([{ busy: true }, { blocked: true }, { error: '保存失败' }])('blocks all new actions while %s', extra => {
    const value = view(false), a = action({ type: 'LEARN_GUIDANCE' }, '听取专业指导', '1行动 · 500便士'); value.actions = [a]; const ui = renderView(value, extra);
    const button = screen.getByRole('button', { name: /听取专业指导/ }); expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('invalidates an unsubmitted confirmation when authoritative facts change and exposes the blocked reason', async () => {
    const value = view(false), a = action({ type: 'LEARN_GUIDANCE' }, '听取专业指导', '1行动 · 500便士'); value.actions = [a]; const ui = renderView(value); await choose(a);
    const changed = structuredClone(value); changed.actions[0]!.enabled = false; changed.actions[0]!.reason = '现金不足，先取得500便士。';
    ui.rerender(<CalamityDemonessPanel {...ui.props} value={changed}/>); expect(screen.queryByRole('dialog')).toBeNull();
    const denied = screen.getByRole('button', { name: /听取专业指导/ }); expect((denied as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(denied.getAttribute('aria-describedby')!)?.textContent).toContain('现金不足'); fireEvent.click(denied); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it('contains keyboard focus within the current confirmation', async () => {
    const value = view(false), a = action({ type: 'LEARN_GUIDANCE' }, '听取专业指导', '1行动'); value.actions = [a]; const ui = renderView(value); await choose(a);
    const dialog = screen.getByRole('dialog'), controls = within(dialog).getAllByRole('button'); controls[0]!.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(controls.at(-1));
    controls.at(-1)!.focus(); fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(controls[0]); expect(ui.onCommand).not.toHaveBeenCalled();
  });
});

describe('Calamity Demoness real original mirrors, people and finite supplies', () => {
  it('shows sixteen inherited values exactly once and two distinct new zero values without changing the female body', async () => {
    const value = view(), ui = renderView(value), fresh = screen.getByRole('region', { name: '灾难魔女两项新技巧' });
    await userEvent.click(screen.getByText('身体与已有经历')); const inherited = screen.getByRole('region', { name: '灾难魔女十六项已有掌握' });
    expect(within(inherited).getAllByText(/· 掌握/)).toHaveLength(16); expect(within(fresh).getAllByText(/· 掌握/)).toHaveLength(2);
    for (const [, label, mastery] of INHERITED) { expect(inherited.textContent).toContain(`${label} · 掌握${mastery}`); expect(fresh.textContent).not.toContain(`${label} · 掌握`); }
    expect(fresh.textContent).toContain('短暂镜幕 · 掌握0'); expect(fresh.textContent).toContain('封闭黑焰疏导 · 掌握0'); expect(ui.container.textContent).toContain('当前身体性别：女性');
    expect(ui.container.textContent).toContain('不重复改变身体性别'); expect(ui.container.textContent).toContain('旧阶段页面只供查看已有记录'); copyIsNatural(ui.container); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it('separates unchanged historical A/B snapshots from the same current originals and shows paid wear outside folds', () => {
    const value = view(); value.life.site.mirrorA!.intact = false; const saved = structuredClone(value), ui = renderView(value);
    const items = screen.getByRole('region', { name: '灾难魔女原镜与当前物资' }), people = screen.getByRole('region', { name: '灾难魔女原人位置与当前许可' });
    expect(items.closest('details')).toBeNull(); expect(people.closest('details')).toBeNull();
    for (const text of ['原镜A（UD3-MIRROR-A）完好', '原镜B（UD3-MIRROR-B）完好', '同一原镜A当前状态受损', '旧馆当时经过247秒', '累计行走86米', 'CD2-PLATE-1', '实付20便士', '剩余0次，实际磨损5', '实际减势5 · 最终7单位']) expect(items.textContent).toContain(text);
    for (const text of ['维瑞娜·肖，46岁，在旧馆门口', '马库斯·赫尔，41岁，在旧馆原镜B旁', '当前在附廊门口', '独立精力98/100', '独立精力76/100', '累计普通步行24米', '当前镜面许可已明确同意', '闭箱许可尚未询问']) expect(people.textContent).toContain(text);
    expect(screen.getByRole('region', { name: '灾难魔女当前资源' }).textContent).toContain('111/120'); copyIsNatural(items); copyIsNatural(people); expect(value).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it('does not fabricate current original people or item arrival before the source is inspected', () => {
    const value = view(), p = value.life.site; delete value.life.historicalScene; p.introducedWeek = null; p.mirrorA = null; p.mirrorB = null; p.vera = null; p.marcus = null; p.actorMoves = []; value.life.currentAttempt = null;
    renderView(value); const people = screen.getByRole('region', { name: '灾难魔女原人位置与当前许可' }); expect(people.textContent).toContain('尚无本人的现场行程'); expect(people.textContent).not.toContain('当前在附廊门口');
    expect(screen.getByRole('region', { name: '灾难魔女原镜与当前物资' }).textContent).toContain('尚未亲自核对');
  });
  it('keeps original source positions current until the two real ordinary arrivals are separately confirmed', async () => {
    const value = view(); value.life.site.vera!.location = 'SOURCE_START'; value.life.site.marcus!.location = 'SOURCE_B'; value.life.site.vera!.energy = 100; value.life.site.marcus!.energy = 100; value.life.site.actorMoves = []; value.life.currentAttempt = null;
    const a = action({ type: 'ARRIVE_MARCUS', caseId: 'mirror-screen' }, '请原马库斯步行到场', '0行动 · 原成人24米/秒'); value.actions = [a]; const ui = renderView(value);
    expect(screen.getByRole('region', { name: '灾难魔女原人位置与当前许可' }).textContent).toContain('当前在旧馆原镜B旁'); await choose(a);
    expect(screen.getByRole('dialog').textContent).toContain('耗24秒和他自己的24精力'); expect(ui.onCommand).not.toHaveBeenCalled(); await userEvent.click(confirm()); expect(ui.onCommand.mock.calls[0]![0]).toBe(a.command);
  });
  it('does not turn a successful unused window into actual application or mastery', () => {
    const value = view(), a = value.life.currentAttempt!; a.appliedAbilityIds = []; a.loadApplied = false; a.bufferedForce = 0; a.plateWear = 0; a.window = 'ACTIVE'; value.life.site.screen = { active: true, mirrorId: 'UD3-MIRROR-A', expiresAt: 68, plateId: 'CD2-PLATE-1' };
    renderView(value); const current = screen.getByRole('region', { name: '灾难魔女本次尝试' }); expect(current.textContent).toContain('检定成功，但尚无实际应用'); expect(current.textContent).toContain('实际应用：无'); expect(current.textContent).toContain('实耗6灵性、20便士');
    expect(screen.getByRole('region', { name: '灾难魔女原镜与当前物资' }).textContent).toContain('尚余20秒'); expect(screen.getByRole('region', { name: '灾难魔女两项新技巧' }).textContent).toContain('短暂镜幕 · 掌握0');
  });
  it('shows one actual residue, box scorch and consumed original plate without replenishing on render', () => {
    const value = view(), p = value.life.site; p.box.scorched = true; p.box.pulses = 1; p.box.pulseSeconds = 10;
    p.residue = { id: 'CD2-RESIDUE-1', ownerId: 'UD3-MARCUS', quantity: 1, fictional: true, biological: false, origin: 'ADULT_WORKSHOP_CUSTODIAN', acquiredWithPlateId: 'CD2-PLATE-2', sealed: true, status: 'CONSUMED', location: 'BOX', acquiredWeek: 140 };
    p.plates[1] = { ...p.plates[1]!, status: 'CONSUMED', location: 'BOX', charges: 0, wear: 5, scorched: true, paidPennies: 20, preparedWeek: 140 };
    const saved = structuredClone(value), ui = renderView(value), items = screen.getByRole('region', { name: '灾难魔女原镜与当前物资' });
    for (const text of ['CD2-RESIDUE-1 · 已耗尽', 'CD2-BOX · 已闭合 · 焦痕仍在', '实际脉冲1次/10秒', '虚构、非生物残留物来自成年工坊保管者', 'CD2-PLATE-2', '剩余0次，实际磨损5，焦痕仍在']) expect(items.textContent).toContain(text);
    ui.rerender(<CalamityDemonessPanel {...ui.props} value={structuredClone(value)}/>); expect(value).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it.each([
    ['SCREEN_MIRROR', 'mirror-screen', '最长30秒', '成功开窗不等于已经应用'],
    ['APPLY_LOAD', 'mirror-screen', '唯一12单位封闭负载', '另付5精力'],
    ['CHANNEL_BLACK_FLAME', 'black-flame-channel', '一次10秒闭箱黑焰', '失败残留仍封装'],
    ['COLLECT_RESIDUE', 'black-flame-channel', '同一份仍封装的残留物', '取回不等于已经交还'],
    ['SEALED_HANDOVER', 'black-flame-channel', '当面交还已经实际返回的原保管者', '普通方法结束'],
    ['RETURN_PLATE', 'mirror-screen', '本人在门口亲手交还', '费用不退'],
  ] as const)('%s has explicit bounded facts and costs before submission', async (type, caseId, first, second) => {
    const value = view(); value.life.activeCase = caseId;
    const a = action({ type, caseId }, `测试确认${type}`, '真实投影成本'); value.actions = [a]; const ui = renderView(value); await choose(a);
    const dialog = screen.getByRole('dialog'); for (const text of ['真实投影成本', first, second]) expect(dialog.textContent).toContain(text); copyIsNatural(dialog); expect(ui.onCommand).not.toHaveBeenCalled(); await userEvent.click(confirm()); expect(ui.onCommand.mock.calls[0]![0]).toBe(a.command);
  });
  it('preserves withdrawal, independently confirms STOP and ordinary routes, and keeps navigation locked', async () => {
    const value = view(); value.life.activeCase = 'revoked-window'; value.life.site.vera!.mirrorConsent = 'WITHDRAWN';
    value.life.currentAttempt = attempt(value.life.site, { permissionWithdrawn: true, ownerConsent: 'WITHDRAWN', routeConsent: 'GRANTED', abilityTier: null, appliedAbilityIds: [], loadApplied: false, bufferedForce: 0, plateWear: 0, spiritualitySpent: 0, window: 'NONE' });
    const stop = action({ type: 'STOP', caseId: 'revoked-window' }, '停止新的能力使用', '0行动'); value.actions = [stop]; const ui = renderView(value);
    expect((screen.getByRole('button', { name: '关闭灾难魔女页面' }) as HTMLButtonElement).disabled).toBe(true); expect((screen.getByRole('combobox', { name: '查看实践' }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '灾难魔女原人位置与当前许可' }).textContent).toContain('镜面许可已撤回，不能继续施术');
    await choose(stop); expect(ui.onCommand).not.toHaveBeenCalled(); await userEvent.click(confirm()); expect(ui.onCommand.mock.calls[0]![0]).toBe(stop.command);
    const saved = structuredClone(value), route = action({ type: 'ORDINARY_ROUTE', caseId: 'revoked-window' }, '沿普通8米路线走到B', '1行动 · 8精力 · 8米/秒'); saved.life.currentAttempt!.stopped = true; saved.actions = [route];
    ui.rerender(<CalamityDemonessPanel {...ui.props} value={saved}/>); await choose(route); const dialog = screen.getByRole('dialog');
    for (const text of ['独立普通路线许可', '耗8秒和8精力', '8米回A与4米回门口', '不施术、不增加能力掌握']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).toHaveBeenCalledOnce(); expect(ui.onClose).not.toHaveBeenCalled();
  });
  it('uses the actual encounter continuation for current positions and finite combat plate charges', async () => {
    const value = view(), downstream = structuredClone(value.life.site); downstream.playerLocation = 'YARD'; downstream.playerEnergy = 32; downstream.playerTravelMetres = 68; downstream.clockSeconds = 321;
    downstream.vera!.location = 'OUTSIDE'; downstream.marcus!.location = 'OUTSIDE'; downstream.vera!.energy = 92; downstream.marcus!.energy = 70; downstream.mirrorA!.intact = false;
    value.life.currentAttempt = null; value.life.activeCase = null;
    value.encounter = { ...value.encounter, status: 'READY', inside: true, site: downstream, startSite: structuredClone(value.life.site),
      plate: { id: 'CD2-COMBAT-PLATE', ownerId: 'PLAYER', quantity: 1, location: 'PLAYER', initialCharges: 3, charges: 1, paidPennies: 20 },
      enemy: { id: 'CD2-IRIS', name: '伊瑞丝', age: 45, sequence: 3, health: 70, mind: 100, spirituality: 65, status: 'RESISTING', weaponId: 'CD2-IRIS-ROD', weaponLocation: 'HAND', powerUses: { FORCE_STRIKE: 7, GUARD: 2, DISRUPT: 4 } }, facts: ['本人保留2米普通退出路线。'] };
    const leave = action({ type: 'LEAVE_ENCOUNTER' }, '沿普通出口离开后院', '0行动 · 2米 · 2秒 · 2精力'), stale = action({ type: 'OBSERVE', caseId: 'mirror-screen' }, '旧案观察不应显示', '1行动'); value.actions = [leave, stale]; const saved = structuredClone(value), ui = renderView(value);
    const people = screen.getByRole('region', { name: '灾难魔女原人位置与当前许可' }), encounter = screen.getByRole('region', { name: '灾难魔女可选遭遇' });
    for (const text of ['本人当前在独立后院', '本场精力32/100', '当前在接触区外', '独立精力92/100', '独立精力70/100']) expect(people.textContent).toContain(text);
    expect(screen.getByRole('region', { name: '灾难魔女原镜与当前物资' }).textContent).toContain('同一原镜A当前状态受损');
    expect(screen.getByRole('region', { name: '灾难魔女当前资源' }).textContent).toContain('32/100');
    for (const text of ['伊瑞丝，45岁', '健康70/100', '独立灵性65/120', 'CD2-IRIS-ROD', '仍在伊瑞丝手中', '本场没有同伴参战', '没有友人天然免疫', '原科宾的投降', 'CD2-COMBAT-PLATE', '剩余1/3次']) expect(encounter.textContent).toContain(text);
    expect(encounter.closest('details')).toBeNull(); expect(screen.queryByRole('button', { name: /旧案观察不应显示/ })).toBeNull(); expect(screen.queryByRole('region', { name: '灾难魔女当前实践' })).toBeNull();
    await choose(leave); for (const text of ['实际步行2米', '耗2秒和2精力', '她的原棍留在后院']) expect(screen.getByRole('dialog').textContent).toContain(text); expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(saved); copyIsNatural(encounter);
  });
  it('shows exhausted combat supplies without inventing replacement charges, shield state or ally protection', async () => {
    const value = view(); value.encounter.inside = true; value.encounter.status = 'FIGHTING'; value.encounter.plate = { id: 'CD2-COMBAT-PLATE', ownerId: 'PLAYER', quantity: 1, location: 'PLAYER', initialCharges: 3, charges: 0, paidPennies: 20 };
    const ui = renderView(value), plate = screen.getByRole('region', { name: '灾难魔女战斗镜片' }); expect(plate.textContent).toContain('剩余0/3次'); expect(plate.textContent).toContain('已经耗尽，不能再设置镜幕');
    expect(ui.container.textContent).not.toMatch(/无限镜片|队友免伤|当前战斗镜幕尚余|近身护持/); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it.each(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const)('%s is separately confirmed and never automatically starts the next step', async type => {
    const value = view(); value.life.activeCase = null; value.life.currentAttempt = null; value.encounter.inside = type !== 'PREPARE_ENCOUNTER'; value.encounter.status = type === 'ENCOUNTER_FIGHT' ? 'READY' : 'AVAILABLE';
    const a = action({ type }, `独立遭遇步骤${type}`, type === 'PREPARE_ENCOUNTER' ? '20便士 · 3次镜片' : '1行动'); value.actions = [a]; const ui = renderView(value);
    if (!value.encounter.inside) await userEvent.click(screen.getByText('庭院里的可选冲突')); await choose(a); expect(ui.onCommand).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog'); if (type === 'PREPARE_ENCOUNTER') expect(dialog.textContent).toContain('另付20便士'); if (type === 'ENCOUNTER_TALK') expect(dialog.textContent).toContain('只到场交谈，不自动交战'); if (type === 'ENCOUNTER_FIGHT') expect(dialog.textContent).toContain('全力防守整轮停止黑焰与普通攻击');
    await userEvent.click(confirm()); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(a.command);
  });
  it('labels historical attempts as historical instead of reusing their positions as the present scene', async () => {
    const value = view(); value.life.currentAttempt = null; value.life.activeCase = null; value.life.inside = false; value.insideCase = false;
    const a = value.life.cases[0]!.attempts[0]!; a.closed = true; a.siteAtClose = site(); a.siteAtClose.playerLocation = 'ENTRY'; value.life.site.playerLocation = 'OUTSIDE';
    renderView(value); await userEvent.click(screen.getByText('三案经历与实际应用')); expect(screen.getAllByText(/这是当次已保存经历，原人原物的当前位置以上方当前事实为准/).length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: '灾难魔女原人位置与当前许可' }).textContent).toContain('本人当前在接触区外');
  });
});
