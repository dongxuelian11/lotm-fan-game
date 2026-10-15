/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AttendantMysteriesPanel, type AttendantMysteriesPanelProps } from '../../src/renderer/AttendantMysteriesPanel.js';
import type { AttendantMysteriesAction, AttendantMysteriesCommand, AttendantMysteriesProjection } from '../../src/domain/attendant-mysteries/types.js';

afterEach(cleanup);
type TownCommand = Extract<AttendantMysteriesCommand, { type: 'TOWN' }>['command'];
const action = (command: AttendantMysteriesCommand, label: string, extra: Partial<AttendantMysteriesAction> = {}): AttendantMysteriesAction => ({ id: JSON.stringify(command), label, cost: '0行动', enabled: true, reason: null, command, ...extra });
const townAction = (command: TownCommand, label: string, extra: Partial<AttendantMysteriesAction> = {}) => action({ type: 'TOWN', command }, label, extra);
const convert = () => townAction({ type: 'CONVERT', originalId: 'town-being-01', confirmedIrreversibleDeath: true }, '继续转化第一原生物', { cost: '0行动 · 8灵性；原活体不可逆死亡', irreversible: true, preferredAction: true });
const begin = () => townAction({ type: 'BEGIN_CONTROL', originalId: 'town-being-02' }, '初控第二原生物', { cost: '1行动 · 3灵性；失败−4健康' });
const returnHome = () => townAction({ type: 'TRAVEL', to: 'base' }, '沿原路返回接待处', { cost: '0行动 · 实际步行200米', cleanup: true });

/** Complete public-view fixture, deliberately independent of domain journals or natural-route claims. */
function fixture(): AttendantMysteriesProjection {
  const first = convert(), second = begin(), survey = townAction({ type: 'SURVEY_SITE', siteId: 'quarry' }, '亲自核对石角采坑', { cost: '1行动 · 12便士' });
  const guidance = action({ type: 'LEARN_GUIDANCE' }, '听取配方与城镇指导', { cost: '1行动 · 500便士' });
  const facilities = ['mill', 'bakery', 'workshop', 'clinic', 'post', 'market'];
  return {
    title: '诡秘侍者·占卜家序列1', discovered: true, promoted: false, guidanceKnown: true, formulaKnown: true,
    formula: [{ name: '诡秘侍者非凡特性', quantity: 1, unit: '份', note: '核对独立封存来源。' }],
    story: '建立由实际原身体组成的新城镇，外来者仍有自主意志。', boundary: '死亡和旧联系永久保留，数量不能替代真实往来。',
    risk: '须在镇内付1行动和140便士准备。失败耗原瓶，健康−15、精神−25、排异+30；成功也不补满当前身体。', supplies: '一份封存特性和九种不同灵界辅料，按原批交付。',
    nextStep: first.label, preferredActionId: first.id, actions: [first, second, survey, returnHome(), guidance],
    bottles: [{ id: 'original-bottle-1', title: '第一原药瓶', source: '原批batch-1，实际投入十份独立材料', status: '已配制', chance: 63, command: { type: 'PREPARE_PROMOTION', bottleId: 'original-bottle-1' } }],
    abilities: [{ id: 'diviner.s1.thread-regeneration', label: '灵体之线再生', description: '只唤回同一原料已失去的线，不使原生物复活。', mastery: 0 }],
    acting: 100, digestion: '奇迹师已实际完成消化；尚未服药。', pollution: 12,
    resources: { health: 64, maxHealth: 100, mind: 72, maxMind: 100, spirituality: 91, maxSpirituality: 120, cash: '804便士', actionsRemaining: 2 },
    injuries: [{ id: 'old-injury-1', severity: 'HEAVY', treated: false }], injuryRisk: 8,
    inheritedHistory: ['旧31项掌握与四次复起账本保留。'], insideCase: false, environment: '本人和原物沿有限路线实际移动。',
    reception: { title: '同一当代接待处', summary: '真实劳动0次、休养0次、经过0周。', location: '须先沿原路返回', actions: [], facts: ['原人原物沿原路返回后方可劳动和休养。'] },
    town: {
      title: '秘偶城镇 · 原人原物', summary: '1/24个实际岗位；6座原设施；已取得3段生活经历。', location: '石角采坑', nextStep: first.label, preferredActionId: first.id,
      residents: Array.from({ length: 24 }, (_, index) => {
        const id = `town-being-${String(index + 1).padStart(2, '0')}`;
        return { id, name: `第${index + 1}原居民`, source: index < 4 ? '石角采坑' : '芦面洞穴', bodyId: `${id}:body`, alive: index !== 2 && index !== 3,
          status: index === 0 ? '暂时初控，尚活着' : index === 2 ? '已不可逆转化的秘偶' : index === 3 ? '失去控制的遗骸' : '原活体，尚可抵抗',
          location: index === 2 ? '新白榆空地' : '石角采坑', facility: index === 2 ? '磨坊' : '尚未入岗', worm: index === 2 ? 'town-worm-1' : '未占用', fateCount: index === 2 ? 3 : 0 };
      }),
      facilities: facilities.map((id, index) => ({ id, label: ['磨坊', '面包房', '工坊', '照料所', '邮务所', '集市'][index]!, built: index === 0, staffed: index === 0 ? 1 : 0, condition: index === 0 ? 88 : 0, output: index === 0 ? 7 : 0 })),
      visitors: [{ id: 'merchant-ada', label: '商人艾达，34岁', location: '原镇外', consent: '仅本次往来同意', completed: 2 }, { id: 'courier-neri', label: '信使奈莉，29岁', location: '原镇外', consent: '已撤回', completed: 1 }],
      ledger: ['原信件town-letter-4已送达原收件人。', '旧灵界区域1处，原死亡2位，支出不返还。'],
      requirements: [{ label: '原岗位到场', complete: false, detail: '尚有23位未完成到场与分工。' }, { label: '已完成的生活经历', complete: true, detail: '本址已有3段，仍须继续真实生活。' }],
      region: 'town-spirit-region-0，第31周形成', ready: false, actions: [first, second, survey, returnHome()],
    },
    life: {
      title: '河岸工坊实践', story: '核实原鱼料、原门与自愿者。', environment: '普通通道始终可用。', nextStep: '先当面观察。', preferredActionId: null, facts: ['原鱼料已死，牵动不能复活。'],
      activeCase: null, inside: false, insideCase: false, reflected: false, clockSeconds: 0, playerLocation: 'A', playerTravelMetres: 0, currentAttempt: null, effectRemainingSeconds: 0,
      site: {
        siteId: 'AM1-RIVERSIDE-WORKSHOP', introducedWeek: null, introducedDate: null, clockSeconds: 0, playerLocation: 'A', playerTravelMetres: 0,
        playerBody: { id: 'PLAYER', count: 1, original: true, solid: true },
        owner: { id: 'AM1-GLEN', name: '格伦·伍德', age: 46, alive: true, independentMind: true, health: 100, mind: 100, bodyCount: 1, location: 'A', consent: 'UNASKED', travelMetres: 0 },
        volunteer: { id: 'AM1-MIRA', name: '米拉·里德', age: 39, alive: true, independentMind: true, health: 100, mind: 100, bodyCount: 1, location: 'A', consent: 'UNASKED', travelMetres: 0 },
        fish: { id: 'AM1-FISH', quantity: 1, massGrams: 100, alive: false, owner: 'FISHERMAN', holder: 'TRAY', location: 'A', travelMetres: 0, provenance: { sourceId: 'AM1-LICENSED-CATCH-17', sellerId: 'AM1-GLEN', sellerLicence: 'AM1-RIVER-LICENCE-9', species: 'RIVER_PERCH', originalSpiritThreads: 'PREEXISTED_THEN_LOST', deathBeforeScene: true }, paidPennies: 0, threadsPresent: false },
        gate: { id: 'AM1-TIMBER-GATE', quantity: 1, material: 'TIMBER', location: 'A', endpointA: { id: 'AM1-END-A', location: 'A', observed: false, positioned: false }, endpointB: { id: 'AM1-END-B', location: 'B', observed: false, positioned: false }, distanceMetres: 8, ordinaryRouteOpen: true, traversals: 0 },
        parcel: { id: 'AM1-PARCEL', quantity: 1, alive: false, massGrams: 500, owner: 'AM1-GLEN', holder: 'OWNER', location: 'A', travelMetres: 0 },
        room: { id: 'AM1-ROOM', quantity: 1, radiusMetres: 6, enclosed: true, doorId: 'AM1-ORDINARY-DOOR', doorUsable: true, tableId: 'AM1-ROOM-TABLE', tableQuantity: 1, concealed: false, boundaryObservations: 0 },
        materials: [], movements: [],
      },
      cases: [{ id: 'lost-threads', title: '原鱼料之线', story: '只牵动同一原鱼料。', observations: [], status: 'AVAILABLE', method: null, result: null, contactOpen: false, returned: false, closes: 0, attempts: [] },
        { id: 'bounded-door', title: '原门两端', story: '亲自核对两个真实端点。', observations: [], status: 'AVAILABLE', method: null, result: null, contactOpen: false, returned: false, closes: 0, attempts: [] }], actions: [],
    },
    encounter: {
      title: '工坊外的空地争议', story: '埃利亚斯有独立身体与抵抗。', status: 'AVAILABLE', inside: false, preparation: null,
      scene: { siteId: 'AM1-WORKSHOP-CLEARING', playerLocation: 'WORKSHOP', playerCoordinate: 0, enemyCoordinate: 14, groundCoordinate: 18, ordinaryExit: 'OPEN', groundEmpty: true, thirdPartiesInArea: 0, residentsLocation: 'TOWN', residentsJoined: 0, observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0 },
      remnant: { id: 'AM1-REMNANT-1', sourceId: 'AM1-TANNER-STOCK-1', animal: 'ADULT_GOAT', quantity: 1, owner: 'SUPPLIER', holder: 'SUPPLIER', location: 'WORKSHOP', alive: false, health: 0, independentMind: false, threadsPreviouslyLost: true, lostThreadsEvidence: null, acquiredWeek: null, pricePaid: 0, segments: [{ id: 'AM1-REMNANT-1-SEGMENT-1', status: 'UNUSED' }, { id: 'AM1-REMNANT-1-SEGMENT-2', status: 'UNUSED' }, { id: 'AM1-REMNANT-1-SEGMENT-3', status: 'UNUSED' }] },
      enemy: { id: 'AM1-ELIAS-VALE', name: '埃利亚斯·维尔', age: 47, sequence: 2, health: 100, mind: 100, spirituality: 120, status: 'RESISTING', weaponLocation: 'HAND', powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0, MENTAL_PRESSURE: 0 }, abilities: ['有限银弧'] },
      pendingKind: null, composureReady: false, actions: [], facts: ['镇中居民保留原位，没有自动参战。'],
    },
  };
}
function withTownActions(...actions: AttendantMysteriesAction[]) {
  const value = fixture();
  value.actions = actions; value.town.actions = actions; value.preferredActionId = actions[0]?.id ?? null; value.town.preferredActionId = actions[0]?.id ?? null;
  return value;
}
function show(value = fixture(), extra: Partial<AttendantMysteriesPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const page = (name: string) => within(screen.getByRole('navigation', { name: '诡秘侍者页面' })).getByRole('button', { name });
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '诡秘侍者操作确认' }); }
const confirm = (dialog: HTMLElement) => within(dialog).getAllByRole('button').find(button => button.textContent?.startsWith('确认'))!;
const selectTarget = (value: string) => fireEvent.change(screen.getByRole('combobox', { name: '当前城镇对象' }), { target: { value } });

describe('AttendantMysteries panel: compact town and authoritative public facts', () => {
  it('defaults to the unpromoted town, keeps one preferred action and offers materials without dispatching', () => {
    const value = fixture(), view = show(value);
    expect(page('城镇').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: value.title })).toBeTruthy();
    expect(primary().textContent).toContain(convert().label);
    expect(screen.getAllByRole('button').length).toBeLessThan(10);
    expect(screen.getByRole('list', { name: '当前城镇要求' }).textContent).toContain('尚有23位未完成到场与分工');
    expect(screen.getByRole('region', { name: '诡秘侍者当前资源' }).textContent).toContain('健康64/100 · 精神72/100 · 灵性91/120');
    expect(view.container.textContent).toContain('804便士 · 本周行动2');
    expect(view.container.textContent).toContain('重伤 · 尚未处置');
    expect(view.container.textContent).not.toMatch(/原创G|本作G|候选|原著未核/);
    fireEvent.click(page('材料与魔药'));
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[0]!.source);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('lists all 24 original identities while distinguishing living, resisting, converted and inert bodies', () => {
    show();
    fireEvent.click(screen.getByText('居民与原身体（24位）'));
    const table = screen.getByRole('table', { name: '居民生命、控制与原身体' });
    expect(within(table).getAllByRole('row')).toHaveLength(25);
    for (let index = 1; index <= 24; index++) expect(table.textContent).toContain(`town-being-${String(index).padStart(2, '0')}:body`);
    expect(table.textContent).toContain('原生物仍活');
    expect(table.textContent).toContain('尚可抵抗');
    expect(table.textContent).toContain('原生物已死亡');
    expect(table.textContent).toContain('已不可逆转化的秘偶');
    expect(table.textContent).toContain('失去控制的遗骸');
    fireEvent.click(screen.getByText('自主来访者与往来'));
    expect(screen.getByText(/这些来访者是仍活、有自主意志的成年人/)).toBeTruthy();
    expect(table.textContent).not.toContain('merchant-ada');
  });

  it('filters resident actions without creating a command, then dispatches only the selected domain intent', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    selectTarget('resident:town-being-02');
    expect(primary().textContent).toContain('初控第二原生物');
    expect(screen.queryByRole('button', { name: /继续转化第一原生物/ })).toBeNull();
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(openPrimary()));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(begin().command);
    expect(value).toEqual(before);
  });

  it('filters actual site and facility commands and retains the domain disabled reason and full costs', () => {
    const build = townAction({ type: 'BUILD', facilityId: 'mill' }, '建设原磨坊', { cost: '1行动 · 12便士 · 3木料2石料', enabled: false, reason: '原地只剩2木料，缺1木料。' });
    const survey = townAction({ type: 'SURVEY_SITE', siteId: 'quarry' }, '亲自调查原采坑', { cost: '1行动 · 12便士' });
    const view = show(withTownActions(convert(), build, survey));
    selectTarget('site:quarry');
    expect(primary().textContent).toContain(survey.label);
    selectTarget('facility:mill');
    expect(isDisabled(primary())).toBe(true);
    expect(primary().textContent).toContain(build.cost);
    expect(screen.getByText(build.reason!)).toBeTruthy();
    expect(primary().getAttribute('aria-describedby')).toBeTruthy();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves a literal custom name rather than running player identity through a prose filter', () => {
    const value = fixture(); value.town.residents[0]!.name = 'G候选·原著未核';
    show(value);
    expect(openPrimary().textContent).toContain('G候选·原著未核');
  });

  it('adapts inherited authored ability labels without changing mastery, limits or costs', () => {
    const value = fixture(); value.abilities.push({ id: 'diviner.s3.historical-projection', label: '历史影像', mastery: 0, description: '初学一次仅1个已实际了解普通物影像、至多30秒G；不能出售、复制原物。' });
    const view = show(value);
    expect(view.container.textContent).toContain('历史影像 · 掌握0');
    expect(view.container.textContent).toContain('至多30秒');
    expect(view.container.textContent).not.toContain('30秒G');
  });

  it('keeps alternative commands in a compact selector and does not dispatch when changing that selection', () => {
    const move = townAction({ type: 'MOVE_TOWN', plotId: 'new-flint-clearing', confirmedBrokenLinks: true }, '迁往已核新燧石地块', { cost: '3行动 · 72便士 · 12灵性' });
    const view = show(withTownActions(convert(), returnHome(), move));
    fireEvent.click(screen.getByText(/其他操作、普通替代与退出（/));
    fireEvent.change(screen.getByRole('combobox', { name: '其他操作' }), { target: { value: move.id } });
    expect(screen.getByRole('button', { name: /迁往已核新燧石地块/ }).textContent).toContain(move.cost);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('AttendantMysteries panel: explicit irreversible confirmations', () => {
  it('names the actual original, body, death and cost before forwarding the unmodified conversion once', () => {
    const value = fixture(), before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('town-being-01');
    expect(dialog.textContent).toContain('town-being-01:body');
    expect(dialog.textContent).toContain('原生物不可逆死亡');
    expect(dialog.textContent).toContain('8灵性');
    const button = within(dialog).getByRole('button', { name: '确认原生物死亡并转化' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(convert().command);
    expect(value).toEqual(before);
  });

  it('does not call an initially controlled living original dead when confirming release', () => {
    const end = townAction({ type: 'END_CONTROL', originalId: 'town-being-01', confirmedLoss: true }, '结束第一原体的初步控制', { cleanup: true, cost: '0行动；未收原虫则损10精神、排异+10' });
    const view = show(withTownActions(end)), dialog = openPrimary();
    expect(dialog.textContent).toContain('原生物当前仍活');
    expect(dialog.textContent).toContain(end.cost);
    fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(end.command);
  });

  it('preserves converted death and original worm identity when ending control', () => {
    const end = townAction({ type: 'END_CONTROL', originalId: 'town-being-03', confirmedLoss: true }, '终止第三原身体控制', { cleanup: true, cost: '0行动 · 10精神 · 排异+10' });
    const view = show(withTownActions(end)), dialog = openPrimary();
    expect(dialog.textContent).toContain('town-being-03:body');
    expect(dialog.textContent).toContain('town-worm-1');
    expect(dialog.textContent).toContain('原生命不会恢复');
    fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(end.command);
  });

  it('shows the real old region, visitors, letters and costs before confirming relocation', () => {
    const move = townAction({ type: 'MOVE_TOWN', plotId: 'new-flint-clearing', confirmedBrokenLinks: true }, '迁往新燧石空地', { cost: '3行动 · 72便士 · 12灵性', irreversible: true });
    const value = withTownActions(move), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('new-flint-clearing');
    expect(dialog.textContent).toContain(value.town.region);
    expect(dialog.textContent).toContain('商人艾达，34岁');
    expect(dialog.textContent).toContain('town-letter-4');
    expect(dialog.textContent).toContain('旧往来与旧灵界区域不再用于本次仪式');
    expect(dialog.textContent).toContain(move.cost);
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认迁址并使旧联系失效' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(move.command);
  });

  it('keeps the material page available in the actual town and confirms only the chosen original bottle', () => {
    const value = fixture(), dose1 = action({ type: 'CONSUME', bottleId: 'original-bottle-1', confirmed: true }, '服用第一原瓶', { cost: '0行动 · 耗尽原瓶与当周准备', irreversible: true });
    const dose2 = action({ type: 'CONSUME', bottleId: 'original-bottle-2', confirmed: true }, '服用第二原瓶', { cost: '0行动 · 耗尽第二原瓶与当周准备', irreversible: true });
    value.insideCase = true; value.actions = [dose1, dose2]; value.preferredActionId = dose1.id;
    value.bottles.push({ id: 'original-bottle-2', title: '第二原药瓶', source: '第二原批batch-2，投入的是另外十份材料', status: '已配制并核证', chance: 47, command: dose2.command.type === 'CONSUME' ? dose2.command : { type: 'PREPARE_PROMOTION', bottleId: 'original-bottle-2' } });
    const before = structuredClone(value), view = show(value);
    expect(isDisabled(page('材料与魔药'))).toBe(false);
    fireEvent.click(page('材料与魔药'));
    fireEvent.change(screen.getByRole('combobox', { name: '当前原药瓶' }), { target: { value: 'original-bottle-2' } });
    expect(view.onCommand).not.toHaveBeenCalled();
    const dialog = openPrimary();
    expect(dialog.textContent).toContain('original-bottle-2');
    expect(dialog.textContent).toContain('第二原批batch-2');
    expect(dialog.textContent).toContain('当前成功率47%');
    expect(dialog.textContent).toContain('健康−15、精神−25、排异+30');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一原瓶' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(dose2.command);
    expect(value).toEqual(before);
  });

  it('refuses an irreversible action whose original identity is absent from the saved public view', () => {
    const value = withTownActions(convert()); value.town.residents = [];
    const view = show(value), dialog = openPrimary();
    expect(isDisabled(confirm(dialog))).toBe(true);
    expect(within(dialog).getByRole('alert').textContent).toContain('无法从当前已保存记录核对');
    fireEvent.click(confirm(dialog));
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('AttendantMysteries panel: focus, stale snapshots and save receipts', () => {
  it('focuses and traps confirmation, disables background controls and restores focus on cancel or Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), trigger = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: convert().label }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    for (const button of within(screen.getByRole('navigation', { name: '诡秘侍者页面' })).getAllByRole('button')) expect(isDisabled(button)).toBe(true);
    expect(isDisabled(screen.getByRole('combobox', { name: '当前城镇对象' }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onClose).not.toHaveBeenCalled();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('invalidates an unsubmitted confirmation on any changed saved facts without using a stale command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), oldConfirm = confirm(dialog), after = structuredClone(value);
    after.town.residents[0]!.status = '原活体，初控已解除';
    after.actions[0]!.enabled = false; after.actions[0]!.reason = '初控已解除，不能继续转化。';
    view.rerender(<AttendantMysteriesPanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(oldConfirm);
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
  });

  it('keeps one submitted intent locked across same-content rerenders and ignores Escape while saving', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<AttendantMysteriesPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(isDisabled(primary())).toBe(true);
    expect(isDisabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(convert().command);
  });

  it('closes an unsubmitted confirmation on save error, focuses the panel and unlocks only after the error clears', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<AttendantMysteriesPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: value.title }));
    expect(isDisabled(primary())).toBe(true);
    view.rerender(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} />);
    expect(isDisabled(primary())).toBe(false);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('does not resubmit after error clearing; waits for changed saved facts and focuses their new phase', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<AttendantMysteriesPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} />);
    expect(isDisabled(primary())).toBe(true);
    fireEvent.click(primary());
    expect(onCommand).toHaveBeenCalledTimes(1);
    const after = withTownActions(returnHome());
    after.town.residents[0]!.alive = false; after.town.residents[0]!.status = '已不可逆转化的秘偶'; after.resources!.spirituality = 83;
    view.rerender(<AttendantMysteriesPanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(isDisabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(screen.getByRole('region', { name: '诡秘侍者当前资源' }).textContent).toContain('灵性83/120');
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(convert().command);
  });

  it.each(['busy', 'blocked', 'dead'] as const)('makes %s projections read-only without inventing cleanup permission', mode => {
    const value = fixture(); if (mode === 'dead') value.resources!.health = 0;
    const view = show(value, { busy: mode === 'busy', blocked: mode === 'blocked' });
    expect(isDisabled(primary())).toBe(true);
    fireEvent.click(primary());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows and forwards domain-issued zero-action cleanup with its actual non-action costs', () => {
    const cleanupAction = returnHome(), value = withTownActions(cleanupAction); value.resources!.actionsRemaining = 0;
    const view = show(value);
    expect(screen.getByText(/本周行动已用尽，仍有可执行的普通收尾/)).toBeTruthy();
    expect(primary().textContent).toContain(cleanupAction.cost);
    expect(isDisabled(primary())).toBe(false);
    fireEvent.click(confirm(openPrimary()));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(cleanupAction.command);
  });

  it('routes active practice and encounter only through root-issued actions, never through a nested forged action', () => {
    const value = fixture(); value.promoted = true; value.life.insideCase = true; value.life.inside = true; value.life.activeCase = 'lost-threads';
    const stop = { id: 'life-stop', label: '停止本次原鱼料牵动', cost: '0行动 · 已花灵性不退', enabled: true, reason: null, command: { type: 'STOP', caseId: 'lost-threads' } as const, cleanup: true };
    value.actions = [stop]; value.life.actions = [stop]; value.life.preferredActionId = stop.id;
    const onCommand = vi.fn(), view = render(<AttendantMysteriesPanel value={value} busy={false} onCommand={onCommand} />);
    expect(page('实践').getAttribute('aria-pressed')).toBe('true');
    expect(isDisabled(page('交涉'))).toBe(true);
    expect(primary().textContent).toContain(stop.label);
    const encounterValue = fixture(); encounterValue.promoted = true; encounterValue.encounter.inside = true;
    const leave = { id: 'encounter-leave', label: '普通离开原空地', cost: '0行动 · 实际步行12米', enabled: true, reason: null, command: { type: 'LEAVE_ENCOUNTER' } as const };
    encounterValue.encounter.actions = [leave]; encounterValue.actions = [];
    view.rerender(<AttendantMysteriesPanel value={encounterValue} busy={false} onCommand={onCommand} />);
    expect(page('交涉').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: /普通离开原空地/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });
});

const receptionExamples = [
  { type: 'RECEPTION_WORK', label: '当代接待处普通劳动', cost: '1行动，收入24便士；低钱时每周至多一次应急', reason: '本周行动用尽；有限补劳动已用或无需启用。' },
  { type: 'RECEPTION_REST', label: '当代接待处处置休养', cost: '1行动、8便士', reason: '休养需要1行动。' },
  { type: 'RECEPTION_NEXT_WEEK', label: '在当代实际度过七天', cost: '行动用尽后24便士；下一周4行动', reason: '七天生活费24便士；可用本周有限补劳动。' },
] as const;

function receptionFixture(entry: typeof receptionExamples[number], reason: string | null = null) {
  const issued = action({ type: entry.type }, entry.label, {
    id: `attendantMysteries-${entry.type}`, cost: entry.cost, enabled: reason === null, reason,
  });
  const value = fixture();
  value.actions = [issued];
  value.preferredActionId = issued.id;
  value.town.actions = [];
  value.town.preferredActionId = null;
  value.town.location = '当代接待处';
  value.resources!.actionsRemaining = reason !== null || entry.type === 'RECEPTION_NEXT_WEEK' ? 0 : 2;
  value.resources!.cash = reason !== null ? '0便士' : '804便士';
  return { value, issued };
}

describe('AttendantMysteries panel: root-issued contemporary reception actions', () => {
  it('shows work, rest and next-week costs on both town and materials pages and forwards each exact issued command only after confirmation', () => {
    for (const entry of receptionExamples) {
      for (const tab of ['城镇', '材料与魔药']) {
        const { value, issued } = receptionFixture(entry), before = structuredClone(value), view = show(value);
        fireEvent.click(page(tab));
        expect(primary().textContent).toContain(entry.label);
        expect(primary().textContent).toContain(entry.cost);
        expect(isDisabled(primary())).toBe(false);
        expect(view.onCommand).not.toHaveBeenCalled();
        const dialog = openPrimary();
        expect(dialog.textContent).toContain(entry.cost);
        expect(view.onCommand).not.toHaveBeenCalled();
        fireEvent.click(confirm(dialog));
        expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(issued.command);
        expect(view.onCommand.mock.calls[0]![0]).toBe(issued.command);
        expect(value).toEqual(before);
        view.unmount();
      }
    }
  });

  it('keeps each domain refusal and full cost through same-content rerenders, error clearing and page changes without granting emergency work', () => {
    for (const entry of receptionExamples) {
      const { value } = receptionFixture(entry, entry.reason), view = show(value);
      view.rerender(<AttendantMysteriesPanel value={structuredClone(value)} busy={false} error="保存中断" onCommand={view.onCommand} />);
      view.rerender(<AttendantMysteriesPanel value={structuredClone(value)} busy={false} onCommand={view.onCommand} />);
      for (const tab of ['城镇', '材料与魔药', '城镇']) {
        fireEvent.click(page(tab));
        const button = primary(), reasonId = button.getAttribute('aria-describedby');
        expect(isDisabled(button)).toBe(true);
        expect(button.textContent).toContain(entry.cost);
        expect(reasonId).toBeTruthy();
        expect(document.getElementById(reasonId!)?.textContent).toBe(entry.reason);
        fireEvent.click(button);
        expect(screen.queryByRole('dialog')).toBeNull();
      }
      expect(view.onCommand).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('cannot dispatch reception work, rest or a new week while the saved domain view requires a physical return from the town', () => {
    const reason = '先沿原路回同一当代接待处。';
    for (const entry of receptionExamples) {
      const { value } = receptionFixture(entry, reason);
      value.insideCase = true;
      value.town.location = '新白榆空地';
      // Enough resources do not override the domain-issued location refusal.
      value.resources!.actionsRemaining = entry.type === 'RECEPTION_NEXT_WEEK' ? 0 : 2;
      value.resources!.cash = '804便士';
      const before = structuredClone(value), view = show(value);
      expect(screen.getByRole('region', { name: '新城镇总览' }).textContent).toContain('新白榆空地');
      for (const tab of ['城镇', '材料与魔药']) {
        fireEvent.click(page(tab));
        expect(primary().textContent).toContain(entry.label);
        expect(primary().textContent).toContain(entry.cost);
        expect(isDisabled(primary())).toBe(true);
        expect(screen.getByText(reason)).toBeTruthy();
        fireEvent.click(primary());
        expect(screen.queryByRole('dialog')).toBeNull();
      }
      expect(view.onCommand).not.toHaveBeenCalled();
      expect(value).toEqual(before);
      view.unmount();
    }
  });
});
