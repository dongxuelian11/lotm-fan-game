/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { FateTrojanCommand } from '../../src/domain/fate-trojan/types';
import type { FateTrojanCaseId } from '../../src/domain/fate-trojan/life';
import { FATE_TROJAN_ENEMY_ABILITY_WHEEL, FATE_TROJAN_ENEMY_COUNT_WHEEL } from '../../src/domain/fate-trojan/combat';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/fate-trojan-v01750';
const PANEL = '命运木马', ENTRY = '命运木马与身份登记所';
const LEGACY = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor'] as const;
const NEW_IDS = ['error.s2.identity-link', 'error.s2.fate-assumption'] as const;
const CASES: readonly FateTrojanCaseId[] = ['identity-link', 'fate-assumption', 'revoked-link'];
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
// Require the runtime lead's actual completed capture. These tests neither create
// a route nor patch recorded state. Read one original state tree at a time.
const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
function boundaryPath(name: string): string {
  const file = index[name];
  if (!file) throw new Error(`Missing actual Fate Trojan boundary: ${name}`);
  return `${ROOT}/${file}`;
}
function boundary(name: string): Boundary {
  const file = boundaryPath(name);
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'),
    final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
function savedBoundary(name: string): SliceState {
  return migrateSliceState(readObjectEntry<unknown>(boundaryPath(name), 'final'));
}
function snapshot(name: 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart'): SliceState {
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
}
const view = (state: SliceState) => projectSliceState(state).fateTrojan;
function commandOf(entry: Boundary): FateTrojanCommand {
  if (entry.lastIntent.type !== 'FATE_TROJAN') throw new Error('Expected a recorded public Fate Trojan command.');
  return entry.lastIntent.command;
}
function savedGame(input: unknown) {
  let state = migrateSliceState(input);
  assertValidSliceState(state);
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    state = applySliceIntent(state, envelope.payload);
    assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-14T07:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-14T06:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeReveal() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openFateTrojan(game: SavedGame) {
  await mount(game); await acknowledgeReveal();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: FateTrojanCommand): HTMLButtonElement {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: FateTrojanCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('caseId' in command) {
    const select = screen.getByRole('combobox', { name: '查看实践' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed);
  expect(after.character.gender).toBe(before.character.gender);
  for (const key of LEGACY) expect(after[key]).toEqual(before[key]);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) {
    if (!id.startsWith('error.s2.')) expect(after.progression.mastery[id]).toBe(mastery);
  }
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
function fact(section: HTMLElement, label: string): string {
  const term = within(section).getByText(label, { selector: 'dt' });
  return term.closest('div')!.querySelector('dd')!.textContent!;
}
function assertRecordedBodyWheel(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.fateTrojanOutcome).toBeTruthy(); expect(round.consequenceDomain).toBe('BODY');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).not.toContain('精神后果盘');
  if (round.consequenceWeights) {
    const w = round.consequenceWeights;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${w.light}% · 重伤 ${w.heavy}% · 死亡 ${w.death}%`);
  } else expect(reveal.textContent).not.toContain('败者后果盘：');
}
async function submitRecordedRound(game: SavedGame, entry: Boundary) {
  if (entry.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected an actual captured combat round.');
  const battle = projectSliceState(game.state).combat!;
  // Capture the narrowed command outside callbacks; never choose a different stance.
  const intent = entry.lastIntent, option = battle.stances.find(s => s.id === intent.stance);
  if (!option) throw new Error('The recorded stance is not currently public.');
  const stage = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(option.label) }));
  await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
  await waitFor(() => expect(game.state).toEqual(entry.final));
  return screen.findByRole('dialog', { name: '战斗回合结果' });
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Fate Trojan navigation from the unchanged original living campaign', () => {
  it('opens the S2 proposal from the actual S3 source and leaves its original 451-command history and wounds intact', async () => {
    const inherited = savedBoundary('inherited-full-451-living-final');
    const originalPath = 'tests/fixtures/deceit-mentor-v01510/peaceful.json';
    const original = migrateSliceState(readObjectEntry<unknown>(originalPath, 'final'));
    expect(inherited).toEqual(original); expect(snapshot('departureStart')).toEqual(inherited);
    const oldCommands = readObjectEntry<SliceIntent[]>(originalPath, 'commands');
    const commands = readObjectEntry<SliceIntent[]>(`${ROOT}/natural.json`, 'commands');
    expect(oldCommands).toHaveLength(451); expect(commands.length).toBeGreaterThan(451);
    expect(commands.slice(0, 451)).toEqual(oldCommands);
    expect(commands).toHaveLength(551);
    expect(readObjectEntry<unknown>(`${ROOT}/natural.json`, 'provenance')).toEqual(readObjectEntry<unknown>(originalPath, 'provenance'));
    expect(readObjectEntry<{ kind: string; newRandomChanges: boolean }>(`${ROOT}/natural.json`, 'continuation')).toMatchObject({
      kind: 'EXACT_451_PUBLIC_LIVING_PREFIX_THEN_PUBLIC_FATE_TROJAN', newRandomChanges: false,
    });
    const game = savedGame(inherited), before = structuredClone(game.state);
    expect(before.progression).toMatchObject({ pathwayId: 'error', sequence: 3, acting: 100 });
    expect(before.health).toBe(100); expect(before.injuryRisk).toBe(2);
    expect(before.injuries).toHaveLength(2); expect(before.injuries.every(i => i.severity === 'HEAVY' && i.treatedRevision === null)).toBe(true);
    await mount(game); await acknowledgeReveal();
    expect(screen.getAllByRole('button', { name: '查看普通诊疗点' }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(panel.textContent).toContain('欺瞒导师3 → 命运木马2');
    expect(within(panel).getByRole('region', { name: '命运木马独立药瓶与准备' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '欺瞒导师' })).toBeNull();
    await userEvent.click(within(panel).getByText('身体与已有经历', { selector: 'summary' }));
    expect(panel.textContent).toContain('旧宿主、本人原身体、原拉尔夫、旧工坊与原吉迪恩');
    await userEvent.click(screen.getByRole('button', { name: '关闭命运木马页面' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await screen.findByRole('region', { name: PANEL });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it.each(['promoted', 'practiced'] as const)('opens the actual %s S2 growth page without replaying the saved Parasite round or rewriting mastery', async name => {
    const game = savedGame(snapshot(name)), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(2); expect(before.deceitMentor.promotionWeek).not.toBeNull();
    expect(before.lastCombatRound?.parasiteOutcome).toBeTruthy();
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '欺瞒导师' })).toBeNull();
    const abilities = within(panel).getByRole('region', { name: '命运木马两项技巧' });
    await userEvent.click(within(panel).getByText('身体与已有经历', { selector: 'summary' }));
    const inheritedAbilities = within(panel).getByRole('region', { name: '命运木马十二项已有掌握' });
    const actual = view(before).abilities;
    expect(actual.filter(a => NEW_IDS.includes(a.id as typeof NEW_IDS[number])).map(a => a.id).sort()).toEqual([...NEW_IDS].sort());
    // The full saved mastery dictionary includes inherited skills. Only the
    // abilities actually projected by this panel are asserted as rendered rows.
    expect(Object.keys(before.progression.mastery)).toHaveLength(14);
    for (const ability of actual) {
      expect((NEW_IDS.includes(ability.id as typeof NEW_IDS[number]) ? abilities : inheritedAbilities).textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
    }
    if (name === 'promoted') for (const id of NEW_IDS) expect(before.progression.mastery[id]).toBe(0);
    else {
      expect(before.progression.acting).toBe(100); expect(before.fateTrojan.life.reflected).toBe(true);
      for (const id of NEW_IDS) expect(before.progression.mastery[id]).toBe(CASES.reduce((n, caseId) => n + before.fateTrojan.life.cases[caseId].attempts.filter(a => a.appliedAbilityIds.includes(id)).length * 8, 0));
      for (const caseId of CASES) expect(before.fateTrojan.life.cases[caseId]).toMatchObject({ status: 'RESOLVED', contactOpen: false });
    }
    await userEvent.click(screen.getByRole('button', { name: '关闭命运木马页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await screen.findByRole('region', { name: PANEL });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('requires the separate original-bottle confirmation, then saves exactly the captured promotion command', async () => {
    const entry = boundary('actual-promotion'), game = savedGame(entry.beforeLast), before = structuredClone(game.state), command = commandOf(entry);
    if (command.type !== 'CONSUME') throw new Error('Actual promotion was not an original bottle consumption.');
    expect(command.confirmed).toBe(true);
    const originalBottle = before.fateTrojan.bottles.find(b => b.id === command.bottleId)!;
    expect(originalBottle.status).toBe('PLAYER');
    await openFateTrojan(game); await userEvent.click(await control(game.state, command));
    let review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    const bottleTitle = view(before).bottles.find(b => b.id === command.bottleId)!.title;
    expect(review.textContent).toContain(bottleTitle); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await control(game.state, command));
    review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    await userEvent.click(within(review).getByRole('button', { name: '确认服用这一药瓶' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull());
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    expect(game.state.progression.sequence).toBe(2); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.injuryRisk).toBe(before.injuryRisk);
    expect(game.state.fateTrojan.bottles.filter(b => b.id !== command.bottleId)).toEqual(before.fateTrojan.bottles.filter(b => b.id !== command.bottleId));
    expect(game.state.fateTrojan.bottles.find(b => b.id === command.bottleId)!.status).toBe('CONSUMED');
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
  }, 20000);
});

describe('Fate Trojan actual case state remains physically actionable after reload', () => {
  it.each([
    ['identity-link', 'identity-paid-check-and-actual-taken-state'],
    ['fate-assumption', 'fate-paid-check-and-actual-assumption'],
    ['revoked-link', 'revoked-current-owner-withdrawal-after-paid-preparation'],
  ] as const)('reloads the real %s scene with its current holder, obligation and permission', async (caseId, name) => {
    const game = savedGame(savedBoundary(name)), before = structuredClone(game.state), p = before.fateTrojan.life.site;
    const a = before.fateTrojan.life.cases[caseId].attempts.at(-1)!;
    expect(view(before).insideCase).toBe(true); expect(before.fateTrojan.life.activeCase).toBe(caseId);
    await mount(game);
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('region', { name: '欺瞒导师' })).toBeNull();
    expect(screen.queryByRole('button', { name: '关闭命运木马页面' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^工作，1行动|^休养，1行动|结束本周/ })).toBeNull();
    expect((within(panel).getByRole('combobox', { name: '查看实践' }) as HTMLSelectElement).value).toBe(caseId);
    const site = within(panel).getByRole('region', { name: '命运木马登记室当前实况' });
    const people = within(panel).getByRole('region', { name: '命运木马本人及原人位置与当前许可' });
    expect(fact(site, '同一身份联系')).toContain(`当前由${p.link.holder === 'PLAYER' ? '本人' : '维克托'}持有`);
    expect(fact(site, '原柜目前识别谁')).toContain(p.cabinet.recognitionHolder === 'PLAYER' ? '本人' : '维克托');
    expect(fact(site, '原报酬')).toContain(`已付本人${p.fate.paidToPlayer}便士`);
    expect(people.textContent).toContain(`本场精力${p.playerEnergy}/100，累计普通步行${p.playerTravelMetres}米`);
    if (caseId === 'identity-link') {
      expect(a.identityTaken).toBe(a.abilityTier === 'SUCCESS' || a.abilityTier === 'GREAT_SUCCESS');
      expect(a.identityUsed).toBe(false); expect(a.appliedAbilityIds).toEqual([]);
      expect(p.link.holder).toBe(a.identityTaken ? 'PLAYER' : 'OWNER'); expect(p.link.returnPending).toBe(a.identityTaken);
      expect(fact(site, '身份联系归还')).toContain(a.identityTaken ? '仍欠当面归还，另付4灵性' : '没有尚欠的身份联系');
      expect(fact(site, '当前使用条件')).toContain(a.identityTaken ? '原主当前不能使用该联系' : '原主可使用自己的联系');
    } else if (caseId === 'fate-assumption') {
      expect(a.fateTaken).toBe(a.abilityTier === 'SUCCESS' || a.abilityTier === 'GREAT_SUCCESS');
      expect(p.fate.status).toBe(a.fateTaken ? 'ASSUMED' : 'PENDING');
      expect(p.fate.debtor).toBe(a.fateTaken ? 'PLAYER' : 'OWNER'); expect(p.fate.ownerRelieved).toBe(a.fateTaken);
      expect(p.parcel.location).toBe('CABINET'); expect(p.fate.paidToPlayer).toBe(0); expect(p.fate.incurredHealth).toBe(0);
      expect(fact(site, '这一次搬运')).toContain(a.fateTaken ? '本人已接下，仍须亲自完成' : '原主原先的待办尚未完成');
      expect(fact(site, '当前责任人')).toContain(a.fateTaken ? '本人 · 维克托已免除这一次待办' : '维克托 · 维克托未因能力免除这一次待办');
    } else {
      expect(a).toMatchObject({ ownerConsent: 'WITHDRAWN', permissionWithdrawn: true, abilityTier: null, penniesSpent: 20, identityTaken: false, fateTaken: false, appliedAbilityIds: [] });
      expect(p.link.holder).toBe('OWNER'); expect(p.link.returnPending).toBe(false);
      expect(p.fate.status).toBe('COMPLETED'); expect(p.parcel.location).toBe('OUTSIDE');
      expect(people.textContent).toContain('维克托已撤回本案许可');
      expect(people.textContent).toContain('仍须交回原封签并亲自走回门口');
      expect(view(game.state).actions.some(action => ['TAKE_IDENTITY', 'TAKE_FATE'].includes(action.command.type))).toBe(false);
      expect(within(panel).queryByRole('button', { name: /^暂取同一原柜的识别联系/ })).toBeNull();
      expect(p.seals.find(seal => seal.id === a.sealId)).toMatchObject({ location: 'PLAYER', charges: 1, paidPennies: 20 });
    }
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it.each(['identity-paid-check-and-actual-taken-state', 'fate-paid-check-and-actual-assumption'] as const)('confirms and commits %s using its captured public intent and actual paid result', async name => {
    const entry = boundary(name), game = savedGame(entry.beforeLast), before = structuredClone(game.state), command = commandOf(entry);
    expect(command.type).toBe(name.startsWith('identity') ? 'TAKE_IDENTITY' : 'TAKE_FATE');
    await openFateTrojan(game); await userEvent.click(await control(game.state, command));
    const review = await screen.findByRole('dialog', { name: '确认本次消耗与风险' });
    expect(review.textContent).toContain('8灵性'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '确认本次消耗与风险' })).toBeNull());
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    expect(game.state.spirituality).toBe(before.spirituality - 8);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.random.cursor).toBe(before.random.cursor + 1);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
  }, 20000);

  it('submits the real original-parcel carry and displays the actual bodily cost, payment and ordinary position', async () => {
    const capture = index['fate-actual-original-parcel-carry-and-cost'] ? 'fate-actual-original-parcel-carry-and-cost' : 'fate-failed-check-actual-ordinary-carry-and-cost';
    const entry = boundary(capture), game = savedGame(entry.beforeLast), before = structuredClone(game.state), p = before.fateTrojan.life.site;
    const command = commandOf(entry); expect(command).toEqual({ type: 'CARRY_PARCEL', caseId: 'fate-assumption' });
    await openFateTrojan(game); await userEvent.click(await control(game.state, command));
    const review = await screen.findByRole('dialog', { name: '确认本次消耗与风险' });
    expect(review.textContent).toContain('5健康与5精力'); expect(review.textContent).toContain('12便士');
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '确认本次消耗与风险' })).toBeNull());
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    const next = game.state.fateTrojan.life.site;
    expect(game.state.health).toBe(before.health - 5); expect(game.state.cash).toBe(before.cash + 12);
    expect(next.playerEnergy).toBe(p.playerEnergy - 13); expect(next.playerTravelMetres).toBe(p.playerTravelMetres + 8);
    expect(next.playerLocation).toBe('OUTSIDE'); expect(next.parcel).toMatchObject({ id: p.parcel.id, ownerId: p.parcel.ownerId, quantity: 1, location: 'OUTSIDE', ordinaryMetres: p.parcel.ordinaryMetres + 8 });
    expect(next.fate).toMatchObject({ status: 'COMPLETED', paidToPlayer: 12, incurredHealth: 5, incurredEnergy: 5, escrowPennies: 0 });
    const site = screen.getByRole('region', { name: '命运木马登记室当前实况' });
    expect(fact(site, '唯一原包裹')).toContain('已在室外 · 实际搬运8米');
    expect(fact(site, '实际搬运负担')).toContain('已付5健康、5精力');
    expect(screen.queryByRole('button', { name: '关闭命运木马页面' })).toBeNull();
  }, 20000);

  it('pays the actual four-spirituality return at the desk before enabling ordinary scene cleanup', async () => {
    const entry = boundary('identity-paid4-actual-return-to-original-owner');
    const game = savedGame(entry.beforeLast), before = structuredClone(game.state), command = commandOf(entry);
    expect(command).toEqual({ type: 'RETURN_LINK', caseId: 'identity-link' });
    const p = before.fateTrojan.life.site;
    expect(p.playerLocation).toBe('DESK'); expect(p.cabinet.open).toBe(false);
    expect(p.link).toMatchObject({ holder: 'PLAYER', returnPending: true });
    await openFateTrojan(game); await userEvent.click(await control(game.state, command));
    const review = await screen.findByRole('dialog', { name: '确认本次消耗与风险' });
    expect(review.textContent).toContain('另付4灵性'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '确认本次消耗与风险' })).toBeNull());
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    const next = game.state.fateTrojan.life.site;
    expect(next.link).toMatchObject({ id: p.link.id, ownerId: p.link.ownerId, holder: 'OWNER', returnPending: false, windowExpiresAt: null });
    expect(next.cabinet.recognitionHolder).toBe('OWNER'); expect(game.state.spirituality).toBe(before.spirituality - 4);
    expect(game.state.random).toEqual(before.random); expect(next.clockSeconds).toBe(p.clockSeconds + 2);
    expect(next.playerLocation).toBe('DESK'); expect(next.seals.some(seal => seal.location === 'PLAYER')).toBe(true);
    expect(fact(screen.getByRole('region', { name: '命运木马登记室当前实况' }), '身份联系归还')).toContain('没有尚欠的身份联系');
    expect(screen.queryByRole('button', { name: '关闭命运木马页面' })).toBeNull();
  }, 20000);

  it('reloads the completed three-case journal without treating withdrawal or ordinary fallback as mastery', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    const panel = await openFateTrojan(game);
    await userEvent.click(within(panel).getByText('三案经历与实际应用', { selector: 'summary' }));
    const cases = before.fateTrojan.life.cases, p = before.fateTrojan.life.site;
    for (const caseId of CASES) {
      const attempt = cases[caseId].attempts.at(-1)!;
      expect(attempt).toMatchObject({ closed: true, inspected: true, sealReturned: true });
      expect(attempt.siteAtClose?.playerLocation).toBe('ENTRY');
      expect(attempt.siteAtClose?.link).toMatchObject({ holder: 'OWNER', returnPending: false });
    }
    expect(cases['revoked-link'].attempts.at(-1)!.appliedAbilityIds).toEqual([]);
    expect(cases['revoked-link'].attempts.at(-1)!.abilityTier).toBeNull();
    expect(p.seals).toHaveLength(3); expect(p.seals.every(seal => seal.location === 'DESK')).toBe(true);
    expect(p.seals.find(seal => seal.caseId === 'revoked-link')!.charges).toBe(1);
    expect(p.cabinet.open).toBe(false); expect(p.playerLocation).toBe('ENTRY');
    expect(p.fate).toMatchObject({ status: 'COMPLETED', paidToPlayer: 12, incurredHealth: 5 });
    expect(panel.textContent).toContain('只有真正应用并报告的技巧才增加8掌握');
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);
});

describe('Fate Trojan stored rounds, physical wheels and actual terminal state', () => {
  it('opens the actual new opponent with its own 35/25/20/15/5 ability wheel and independent resources', async () => {
    const game = savedGame(snapshot('combatStart')), before = structuredClone(game.state);
    expect(before.combat?.encounterId).toBe('FATE_TROJAN_DISPUTE'); expect(before.lastCombatRound?.parasiteOutcome).toBeTruthy();
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const battle = projectSliceState(before).combat!, dialog = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain('伊莱亚斯');
    expect(battle.enemyAbilityWheel).toEqual(FATE_TROJAN_ENEMY_ABILITY_WHEEL);
    expect(battle.enemyCountWheel).toEqual(FATE_TROJAN_ENEMY_COUNT_WHEEL);
    expect(battle.enemyAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual([
      { id: 'FORCE_STRIKE', weight: 35 }, { id: 'GUARD', weight: 25 }, { id: 'BODY_STRIKE', weight: 20 },
      { id: 'DISCERN', weight: 15 }, { id: 'ACCIDENT', weight: 5 },
    ]);
    const resources = within(dialog).getByRole('region', { name: '命运木马本回合实际资源' });
    expect(resources.textContent).toContain(`本人健康 ${before.health} / ${projectSliceState(before).maxHealth}`);
    expect(resources.textContent).toContain(`独立灵性 ${battle.fateTrojan!.enemySpirituality} / 120`);
    expect(within(dialog).queryByRole('region', { name: '欺瞒导师本回合实际资源' })).toBeNull();
    await userEvent.click(within(dialog).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of FATE_TROJAN_ENEMY_ABILITY_WHEEL) expect(dialog.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('submits the captured first public round, then reloads that exact saved record despite the old S3 promotion mask', async () => {
    const entry = boundary('combat-round-1'), game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    expect(before.lastCombatRound?.parasiteOutcome).toBeTruthy();
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    let reveal = await submitRecordedRound(game, entry);
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    assertRecordedBodyWheel(reveal, entry.final.lastCombatRound!);
    const saved = structuredClone(game.state);
    await userEvent.click(within(reveal).getByRole('checkbox', { name: '快速显示本回合结果' }));
    expect(game.state).toEqual(saved); expect(game.submit).toHaveBeenCalledOnce();
    cleanup();
    const reloaded = savedGame(saved); await mount(reloaded);
    reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, saved.lastCombatRound!);
    expect(screen.queryByRole('region', { name: '欺瞒导师' })).toBeNull();
    expect(reloaded.state.lastCombatRound).toEqual(saved.lastCombatRound);
    expect(reloaded.state.combatHistory).toEqual(saved.combatHistory);
    expect(reloaded.state).toEqual(saved); expect(reloaded.submit).not.toHaveBeenCalled();
  }, 20000);

  it('reloads the recorded eighth-round heavy injury on its actual 45/30/25 physical wheel', async () => {
    const entry = boundary('combat-round-8'), game = savedGame(entry.final), before = structuredClone(game.state);
    expect(before.lastCombatRound).toMatchObject({ round: 8, consequenceRoll: 64,
      consequenceDomain: 'BODY', consequenceWeights: { light: 45, heavy: 30, death: 25 } });
    expect(before.health).toBe(40); expect(before.mind).toBe(entry.beforeLast.mind);
    expect(before.injuries.length).toBe(entry.beforeLast.injuries.length + 1);
    expect(before.injuries.at(-1)!.severity).toBe('HEAVY');
    await mount(game);
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, before.lastCombatRound!);
    expect(reveal.textContent).not.toContain('损耗40点');
    await userEvent.click(within(reveal).getByRole('button', { name: '进入下一回合' }));
    const battle = projectSliceState(game.state).combat!;
    const stage = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByText('回看第 8 回合完整记录', { selector: 'summary' }));
    expect(stage.textContent).toContain('败者后果盘：轻伤 45% · 重伤 30% · 死亡 25%');
    expect(stage.textContent).not.toContain('精神后果盘');
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('keeps the original 456-command Deceit Mentor death archive on its saved physical consequence wheel', async () => {
    const path = 'tests/fixtures/deceit-mentor-v01510/natural.json';
    expect(readObjectEntry<SliceIntent[]>(path, 'commands')).toHaveLength(456);
    const original = migrateSliceState(readObjectEntry<unknown>(path, 'final'));
    const game = savedGame(original), before = structuredClone(game.state), round = before.lastCombatRound!;
    expect(before).toMatchObject({ status: 'DEAD', health: 0 }); expect(before.progression.sequence).toBe(3);
    expect(round.deceitMentorOutcome).toBeTruthy(); expect(round.fateTrojanOutcome).toBeUndefined();
    expect(round).toMatchObject({ round: 6, consequenceRoll: 71, consequenceWeights: { light: 15, heavy: 30, death: 55 } });
    await mount(game);
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(reveal.textContent).toContain('败者后果盘：轻伤 15% · 重伤 30% · 死亡 55%');
    expect(reveal.textContent).not.toContain('精神后果盘');
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
    await screen.findByRole('heading', { name: before.ending!.title });
    expect(screen.queryByRole('button', { name: /继续生活|进入下一回合|确认姿态|复起|复活/ })).toBeNull();
    expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('retains the actual terminal health and original bodies, then permits only the continuation actually captured', async () => {
    const entry = boundary('combat-terminal'), game = savedGame(entry.final), before = structuredClone(game.state);
    const outcome = before.lastCombatRound!.fateTrojanOutcome!, terminal = before.fateTrojan.encounter.terminal!;
    expect(before.combat).toBeNull(); expect(terminal).toBeTruthy();
    expect(before.health).toBe(outcome.playerHealthAfter); expect(before.mind).toBe(outcome.playerMindAfter);
    expect(before.spirituality).toBe(outcome.playerSpiritualityAfter);
    expect(before.fateTrojan.encounter.startSite).not.toBeNull();
    for (const key of ['cabinet', 'parcel', 'link', 'fate', 'seals'] as const) expect(before.fateTrojan.life.site[key]).toEqual(before.fateTrojan.encounter.startSite![key]);
    await mount(game);
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, before.lastCombatRound!);
    expect(screen.queryByRole('region', { name: '欺瞒导师' })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    if (before.status === 'DEAD') {
      expect(before.health).toBe(0); expect(terminal.outcome).toBe('PLAYER_DEAD');
      expect(before.fateTrojan.life.site.playerLocation).toBe('YARD');
      expect(index['ordinary-life-after-actual-exit']).toBeUndefined();
      await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
      await screen.findByRole('heading', { name: before.ending!.title });
      expect(screen.queryByRole('button', { name: /继续生活|进入下一回合|确认姿态|复起|复活/ })).toBeNull();
      expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
      expect(screen.queryByRole('button', { name: /^工作，1行动|^休养，1行动/ })).toBeNull();
      expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    } else {
      expect(before.status).toBe('ACTIVE'); expect(before.health).toBeGreaterThan(0);
      expect(terminal.outcome).not.toBe('PLAYER_DEAD'); expect(before.fateTrojan.life.site.playerLocation).toBe('OUTSIDE');
      const ordinary = boundary('ordinary-life-after-actual-exit');
      expect(ordinary.beforeLast).toEqual(before);
      if (ordinary.lastIntent.type !== 'ACTION' || !['WORK', 'REST'].includes(ordinary.lastIntent.action)) throw new Error('Expected the captured ordinary work/rest action after the actual exit.');
      await userEvent.click(within(reveal).getByRole('button', { name: '返回生活' }));
      const closePanel = screen.queryByRole('button', { name: '关闭命运木马页面' });
      if (closePanel) await userEvent.click(closePanel);
      const button = await screen.findByRole('button', { name: ordinary.lastIntent.action === 'WORK' ? /^工作，1行动/ : /^休养，1行动/ });
      expect((button as HTMLButtonElement).disabled).toBe(false); await userEvent.click(button);
      await waitFor(() => expect(game.state).toEqual(ordinary.final));
      assertEnvelope(game, before, ordinary.lastIntent); assertLegacy(before, game.state);
      expect(game.state.fateTrojan.life.site).toEqual(before.fateTrojan.life.site);
      expect(game.state.lastCombatRound).toEqual(before.lastCombatRound);
    }
  }, 20000);
});
