/* @vitest-environment jsdom */
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WisdomAngelActivityCommand, WisdomAngelCaseId } from '../../src/domain/wisdom-angel/life';
import type { SliceState } from '../../src/domain/slice/types';
import {
  PANEL, NEW_IDS, boundaryForIntent, snapshot, capturedCommand, savedGame, mountGame,
  commandControl, actionButton, clickCommand, settled, view, confirmationName, confirmLabel,
  assertLegacyPreserved, assertSavedEnvelope,
} from './wisdom-angel-helper';

const CASES = ['record-handover', 'changed-condition', 'withdrawn-consent'] as const;
const actual = (state: SliceState, id: WisdomAngelCaseId) => state.wisdomAngel.life.cases[id].attempts.at(-1)!;
function lifeBoundary(type: WisdomAngelActivityCommand['type'], caseId: WisdomAngelCaseId,
  accept: Parameters<typeof boundaryForIntent>[1] = () => true) {
  return boundaryForIntent(intent => intent.type === 'WISDOM_ANGEL' && intent.command.type === type && 'caseId' in intent.command && intent.command.caseId === caseId, accept);
}
const originalRegion = () => screen.getByRole('region', { name: '当前原人原物与来源' });

describe('Wisdom Angel real reading, condition changes and current permission in the saved UI', () => {
  it('keeps unread answers hidden until original source agreement, actual movement, taking and each separate read', async () => {
    const game = savedGame(lifeBoundary('PERFORM', 'record-handover').final), before = structuredClone(game.state), caseId = 'record-handover';
    await mountGame(game);
    for (const p of before.wisdomAngel.life.papers) expect(screen.getByRole('region', { name: PANEL }).textContent).not.toContain(p.text);
    expect(originalRegion().textContent).toContain('尚未实际阅读，内容不公开');
    expect(originalRegion().textContent).toContain('本版本尚未亲眼观察');
    for (const type of ['READ_FIRST', 'READ_SECOND', 'SYNTHESIS', 'ENTER_ROOM', 'VERIFY_HANDOVER'] as const) expect(actionButton(game.state, { type, caseId }).disabled).toBe(true);
    await clickCommand(game, { type: 'READ_SOURCE', caseId });
    expect(view(game.state).life.papers.map(p => p.text)).toEqual([null, null]);
    await clickCommand(game, { type: 'CONSENT_OWNER', caseId });
    expect(actionButton(game.state, { type: 'ENTER_ROOM', caseId }).disabled).toBe(true);
    await clickCommand(game, { type: 'AGREE_RETURN', caseId }); const door = structuredClone(game.state);
    await clickCommand(game, { type: 'ENTER_ROOM', caseId });
    expect(game.state.wisdomAngel.life).toMatchObject({ playerLocation: 'TABLE', mara: { location: 'TABLE' } });
    expect(game.state.wisdomAngel.life.playerTravelMetres).toBe(door.wisdomAngel.life.playerTravelMetres + 4);
    expect(game.state.wisdomAngel.life.mara.travelMetres).toBe(door.wisdomAngel.life.mara.travelMetres + 4);
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(door.wisdomAngel.life.clockSeconds + 4);
    expect(game.state.wisdomAngel.life.papers).toEqual(door.wisdomAngel.life.papers);
    await clickCommand(game, { type: 'TAKE_PAPERS', caseId }); await clickCommand(game, { type: 'READ_FIRST', caseId });
    expect(originalRegion().textContent).toContain(before.wisdomAngel.life.papers[0].text);
    expect(originalRegion().textContent).not.toContain(before.wisdomAngel.life.papers[1].text);
    expect(actionButton(game.state, { type: 'SYNTHESIS', caseId }).disabled).toBe(true);
    await clickCommand(game, { type: 'READ_SECOND', caseId });
    expect(originalRegion().textContent).toContain(before.wisdomAngel.life.papers[1].text);
    expect(actual(game.state, caseId).handoverFinding).toBeNull(); expect(game.state.random).toEqual(before.random);
    expect(game.state.wisdomAngel.life.papers.map(p => [p.id, p.owner, p.location])).toEqual([
      ['WA2-SHEET-1', 'WA2-MARA', 'PLAYER'], ['WA2-SHEET-2', 'WA2-MARA', 'PLAYER'],
    ]); assertLegacyPreserved(before, game.state);
  }, 30_000);

  it.each(CASES)('reviews the actual %s synthesis cost and saves its attempt separately from success, application and mastery', async caseId => {
    const captured = lifeBoundary('SYNTHESIS', caseId), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const trigger = await commandControl(game.state, command); await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of ['5灵性、知识20', '实际2秒', '最多20秒', '实际交接或实做结果检验', '未应用不奖掌握']) expect(dialog.textContent).toContain(text);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(document.activeElement).toBe(trigger); expect(game.state).toEqual(before);
    await userEvent.click(trigger); dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) })); await settled();
    expect(game.state).toEqual(captured.final); const prior = actual(before, caseId).synthesis, now = actual(game.state, caseId).synthesis;
    const succeeded = now.tier === 'SUCCESS' || now.tier === 'GREAT_SUCCESS';
    expect(now.attempts).toBe(prior.attempts + 1); expect(now.successes).toBe(prior.successes + Number(succeeded)); expect(now.effects).toBe(prior.effects);
    expect(now.state).toBe(succeeded ? 'ACTIVE' : 'FAILED'); expect(now.remainingSeconds).toBe(succeeded ? 20 : 0);
    expect(game.state.spirituality).toBe(before.spirituality - 5); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(game.state.wisdomAngel.life.papers).toEqual(before.wisdomAngel.life.papers); expect(game.state.wisdomAngel.life.device).toEqual(before.wisdomAngel.life.device);
    expect(actual(game.state, caseId).handoverFinding).toBeNull(); expect(actual(game.state, caseId).resultVerified).toBe(false);
    expect(originalRegion().textContent).toContain(`条件综合：尝试${now.attempts} / 检定成功${now.successes} / 实际应用${now.effects}`);
    const saved = structuredClone(game.state); fireEvent.focus(screen.getByRole('heading', { name: view(game.state).title }));
    await userEvent.click(screen.getByText('三案历史与新掌握', { selector: 'summary' })); expect(game.state).toEqual(saved);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('performs the real handover check after comparison and never renders a synthesis as a guilt or truth button', async () => {
    const captured = lifeBoundary('VERIFY_HANDOVER', 'record-handover'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), caseId = 'record-handover';
    await mountGame(game); expect(originalRegion().textContent).not.toContain('已与原桌旁玛拉当面核对');
    await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(captured.final);
    const prior = actual(before, caseId).synthesis, now = actual(game.state, caseId);
    expect(now.handoverVerified).toBe(true); expect(now.handoverFinding).toContain('未据此判定任何人有罪');
    expect(now.synthesis.effects).toBe(prior.state === 'ACTIVE' && prior.remainingSeconds >= 4 && prior.conditionVersion === before.wisdomAngel.life.device.conditionVersion ? 1 : prior.effects);
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 4);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); expect(game.state.spirituality).toBe(before.spirituality);
    expect(originalRegion().textContent).toContain(now.handoverFinding!); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('uses the first real original charge only after confirmation and shows only the demonstration that actually happened', async () => {
    const captured = lifeBoundary('FIRST_DEMONSTRATION', 'changed-condition'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); expect(actual(game.state, 'changed-condition').demonstrations).toHaveLength(0);
    await userEvent.click(await commandControl(game.state, command)); const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of ['同一原器具实际耗1格储能', '原两格不会补充', '真实结果发生后才记录']) expect(dialog.textContent).toContain(text);
    expect(game.state.wisdomAngel.life.device.charges).toBe(2); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) })); await settled(); expect(game.state).toEqual(captured.final);
    expect(game.state.wisdomAngel.life.device).toMatchObject({ id: 'WA2-DEVICE', owner: 'WA2-MARA', charges: 1, demonstrations: 1 });
    expect(actual(game.state, 'changed-condition').demonstrations).toHaveLength(1);
    expect(originalRegion().textContent).toContain('实际WA2-DEMO-1'); expect(originalRegion().textContent).not.toContain('实际WA2-DEMO-2');
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 3);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.random).toEqual(before.random); assertSavedEnvelope(game, before, captured.lastIntent);
  }, 20_000);

  it('changes the real filter, retains old predictions and models, and requires a new current observation', async () => {
    const captured = lifeBoundary('SWITCH_FILTER', 'changed-condition'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), caseId = 'changed-condition';
    await mountGame(game); await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(captured.final);
    const prior = actual(before, caseId), now = actual(game.state, caseId);
    expect(game.state.wisdomAngel.life.device).toMatchObject({ filter: 'AMBER', conditionVersion: 2, filterChanges: 1, charges: 1 });
    expect(now.models).toEqual(prior.models.map(m => ({ ...m, state: m.state === 'ACTIVE' ? 'INVALIDATED' : m.state })));
    for (const key of ['synthesis', 'response'] as const) {
      expect(now[key].effects).toBe(prior[key].effects); expect(now[key].successes).toBe(prior[key].successes);
      expect(now[key].state).toBe(prior[key].state === 'ACTIVE' ? 'INVALIDATED' : prior[key].state);
    }
    expect(now.predictions).toEqual(prior.predictions); expect(now.demonstrations).toEqual(prior.demonstrations);
    expect(originalRegion().textContent).toContain('当前条件版本2'); expect(originalRegion().textContent).toContain('本版本尚未亲眼观察');
    for (const type of ['SYNTHESIS', 'RESPONSE', 'SECOND_DEMONSTRATION', 'SWITCH_FILTER'] as const) expect(actionButton(game.state, { type, caseId }).disabled).toBe(true);
    const changed = structuredClone(game.state); await clickCommand(game, { type: 'OBSERVE_CONDITION', caseId });
    expect(view(game.state).life.device.filter).toBe('AMBER'); expect(originalRegion().textContent).toContain('本版本已见琥珀滤片');
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(changed.wisdomAngel.life.clockSeconds + 2);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.random).toEqual(before.random); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('charges only an actual response attempt, keeps its success provisional and does not restore original charges', async () => {
    const captured = lifeBoundary('RESPONSE', 'changed-condition'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of ['6灵性、知识20', '成功最多20秒', '本人已见原示范', '错误预测不会获得实际应对效果']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) })); await settled(); expect(game.state).toEqual(captured.final);
    const use = actual(game.state, 'changed-condition').response, success = use.tier === 'SUCCESS' || use.tier === 'GREAT_SUCCESS';
    expect(use).toMatchObject({ attempts: 1, successes: Number(success), effects: 0, state: success ? 'ACTIVE' : 'FAILED', remainingSeconds: success ? 20 : 0 });
    expect(game.state.spirituality).toBe(before.spirituality - 6); expect(game.state.wisdomAngel.life.device).toEqual(before.wisdomAngel.life.device);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); expect(originalRegion().textContent).toContain(`已见方法应对：尝试1 / 检定成功${Number(success)} / 实际应用0`);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('spends the last real charge for the second demonstration before comparing actual and predicted versions', async () => {
    const captured = lifeBoundary('SECOND_DEMONSTRATION', 'changed-condition'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), caseId = 'changed-condition';
    await mountGame(game); expect(actual(game.state, caseId).predictionMatched).toBeNull();
    await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(captured.final);
    const prior = actual(before, caseId), now = actual(game.state, caseId), predicted = prior.predictions.at(-1)!;
    const responseApplies = prior.response.state === 'ACTIVE' && prior.response.remainingSeconds >= 3 && prior.response.conditionVersion === 2 && predicted.version === 2 && predicted.prediction === 'AMBER';
    expect(now.response.effects).toBe(responseApplies ? 1 : prior.response.effects); expect(now.predictionMatched).toBeNull(); expect(now.resultVerified).toBe(false);
    expect(game.state.wisdomAngel.life.device).toMatchObject({ id: 'WA2-DEVICE', owner: 'WA2-MARA', charges: 0, demonstrations: 2 });
    expect(originalRegion().textContent).toContain('实际WA2-DEMO-2'); expect(originalRegion().textContent).toContain('原储能1→0');
    for (const type of ['FIRST_DEMONSTRATION', 'SECOND_DEMONSTRATION', 'RESPONSE'] as const) expect(actionButton(game.state, { type, caseId }).disabled).toBe(true);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); const demonstrated = structuredClone(game.state);
    await clickCommand(game, { type: 'VERIFY_RESULT', caseId }); const verified = actual(game.state, caseId);
    expect(verified.predictionMatched).toBe(predicted.version === 2 && predicted.prediction === 'AMBER'); expect(verified.resultVerified).toBe(true);
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(demonstrated.wisdomAngel.life.clockSeconds + 2);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.random).toEqual(before.random); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('preserves an explicitly stale prediction and honestly records mismatch after ordinary actual demonstration', async () => {
    // Alternate public choices from the original first demonstration; no seed, resource or state edits.
    const game = savedGame(lifeBoundary('FIRST_DEMONSTRATION', 'changed-condition').final), before = structuredClone(game.state), caseId = 'changed-condition';
    await mountGame(game); await clickCommand(game, { type: 'PREDICT', caseId, prediction: 'WHITE' });
    await clickCommand(game, { type: 'SWITCH_FILTER', caseId }); await clickCommand(game, { type: 'OBSERVE_CONDITION', caseId });
    expect(actionButton(game.state, { type: 'RESPONSE', caseId }).disabled).toBe(true);
    await clickCommand(game, { type: 'SECOND_DEMONSTRATION', caseId }); await clickCommand(game, { type: 'VERIFY_RESULT', caseId });
    expect(actual(game.state, caseId)).toMatchObject({ resultVerified: true, predictionMatched: false, response: { attempts: 0, successes: 0, effects: 0 } });
    expect(actual(game.state, caseId).predictions).toHaveLength(1); expect(actual(game.state, caseId).predictions[0]).toMatchObject({ version: 1, prediction: 'WHITE' });
    expect(originalRegion().textContent).toContain('最新预测错误或版本已过时，原记录保留');
    expect(game.state.wisdomAngel.life.device.charges).toBe(0); expect(game.state.random).toEqual(before.random); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    assertLegacyPreserved(before, game.state);
  }, 30_000);

  it('honors the actual current withdrawal immediately, without pretending held originals or either body have returned', async () => {
    const captured = lifeBoundary('WITHDRAW_CONSENT', 'withdrawn-consent'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), caseId = 'withdrawn-consent';
    await mountGame(game); await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(captured.final);
    expect(actual(game.state, caseId).ownerConsent).toBe('REVOKED'); expect(originalRegion().textContent).toContain('本次已撤回');
    for (const key of ['synthesis', 'response'] as const) {
      const old = actual(before, caseId)[key], now = actual(game.state, caseId)[key];
      expect(now.state).toBe(old.state === 'ACTIVE' ? 'STOPPED' : old.state); expect(now.effects).toBe(old.effects); expect(now.successes).toBe(old.successes);
    }
    expect(game.state.wisdomAngel.life.papers).toEqual(before.wisdomAngel.life.papers); expect(game.state.wisdomAngel.life.device).toEqual(before.wisdomAngel.life.device);
    expect(game.state.wisdomAngel.life.mara).toEqual(before.wisdomAngel.life.mara); expect(game.state.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    for (const type of ['SYNTHESIS', 'MANUAL_COMPARE', 'OBSERVE_CONDITION', 'CONSENT_OWNER', 'EXIT_ROOM', 'CLOSE'] as const) expect(actionButton(game.state, { type, caseId }).disabled).toBe(true);
    assertSavedEnvelope(game, before, captured.lastIntent);
    await clickCommand(game, { type: 'RETURN_PAPERS', caseId }); expect(actionButton(game.state, { type: 'EXIT_ROOM', caseId }).disabled).toBe(true);
    await clickCommand(game, { type: 'RETURN_DEVICE', caseId });
    expect(game.state.wisdomAngel.life.playerLocation).toBe('TABLE'); expect(game.state.wisdomAngel.life.mara.location).toBe('TABLE');
    expect(game.state.wisdomAngel.life.device).toMatchObject({ id: 'WA2-DEVICE', owner: 'WA2-MARA', location: 'TABLE', charges: 0 });
    const returned = structuredClone(game.state); await clickCommand(game, { type: 'EXIT_ROOM', caseId });
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(returned.wisdomAngel.life.clockSeconds + 4);
    expect(game.state.wisdomAngel.life.playerTravelMetres).toBe(returned.wisdomAngel.life.playerTravelMetres + 4);
    expect(game.state.wisdomAngel.life.mara.travelMetres).toBe(returned.wisdomAngel.life.mara.travelMetres + 4);
    expect(game.state.wisdomAngel.life).toMatchObject({ playerLocation: 'EXIT', mara: { location: 'EXIT' } });
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.random).toEqual(before.random); assertLegacyPreserved(before, game.state);
  }, 30_000);

  it.each(CASES)('returns the same %s sheets before physically exiting, with no navigation shortcut masquerading as cleanup', async caseId => {
    const captured = lifeBoundary('RETURN_PAPERS', caseId), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(captured.final);
    expect(game.state.wisdomAngel.life.papers.map(p => [p.id, p.owner, p.location, p.text])).toEqual(before.wisdomAngel.life.papers.map(p => [p.id, p.owner, 'TABLE', p.text]));
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 2);
    expect(game.state.wisdomAngel.life.playerLocation).toBe('TABLE'); expect(game.state.wisdomAngel.life.mara).toEqual(before.wisdomAngel.life.mara);
    expect(actionButton(game.state, { type: 'CLOSE', caseId }).disabled).toBe(true);
    const navigation = screen.queryByRole('button', { name: '关闭智慧天使页面' }) as HTMLButtonElement | null;
    if (navigation) expect(navigation.disabled).toBe(true);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.progression.mastery).toEqual(before.progression.mastery); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(CASES)('reports %s actual effects only, awarding no mastery for merely attempted or successful-unused windows', async caseId => {
    const captured = lifeBoundary('REPORT', caseId), game = savedGame(captured.beforeLast), before = structuredClone(game.state), previous = actual(before, caseId);
    await mountGame(game); await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(captured.final);
    for (const [index, key] of ['synthesis', 'response'].entries()) {
      const use = previous[key as 'synthesis' | 'response'], ability = NEW_IDS[index]!;
      expect(game.state.progression.mastery[ability]).toBe(before.progression.mastery[ability]! + (use.effects ? 8 : 0));
    }
    expect(game.state.progression.acting).toBe(before.progression.acting + 25);
    expect(actual(game.state, caseId)).toEqual(previous); expect(previous.closed).toBe(true);
    expect(game.state.wisdomAngel.life.papers.every(p => p.location === 'TABLE')).toBe(true); expect(game.state.wisdomAngel.life.device.location).toBe('TABLE');
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('only an actual wait advances the finite response window; focus and reading history do not', async () => {
    const game = savedGame(lifeBoundary('RESPONSE', 'changed-condition').final), before = structuredClone(game.state), caseId = 'changed-condition';
    await mountGame(game); fireEvent.focus(screen.getByRole('heading', { name: view(game.state).title }));
    await userEvent.click(screen.getByText('三案历史与新掌握', { selector: 'summary' })); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await clickCommand(game, { type: 'WAIT_20', caseId }); const old = actual(before, caseId).response, now = actual(game.state, caseId).response;
    expect(now.state).toBe(old.state === 'ACTIVE' ? 'EXPIRED' : old.state); expect(now.remainingSeconds).toBe(0); expect(now.effects).toBe(0);
    expect(game.state.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 20);
    expect(game.state.wisdomAngel.life.device).toEqual(before.wisdomAngel.life.device); expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.random).toEqual(before.random);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); await clickCommand(game, { type: 'SECOND_DEMONSTRATION', caseId });
    expect(actual(game.state, caseId).response.effects).toBe(0); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('allows an ordinary initial refusal and truthful closure without borrowing, moving or charging anything', async () => {
    const game = savedGame(lifeBoundary('PERFORM', 'record-handover').final), before = structuredClone(game.state), caseId = 'record-handover';
    await mountGame(game); await clickCommand(game, { type: 'READ_SOURCE', caseId }); await clickCommand(game, { type: 'DECLINE_OWNER', caseId });
    expect(actionButton(game.state, { type: 'ENTER_ROOM', caseId }).disabled).toBe(true); expect(actionButton(game.state, { type: 'SYNTHESIS', caseId }).disabled).toBe(true);
    await clickCommand(game, { type: 'INSPECT', caseId }); await clickCommand(game, { type: 'CLOSE', caseId });
    expect(actual(game.state, caseId)).toMatchObject({ closed: true, result: 'ORDINARY', entered: false, exited: false, papersTaken: false, deviceTaken: false });
    expect(game.state.wisdomAngel.life.papers).toEqual(before.wisdomAngel.life.papers); expect(game.state.wisdomAngel.life.mara).toEqual(before.wisdomAngel.life.mara); expect(game.state.wisdomAngel.life.device).toEqual(before.wisdomAngel.life.device);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('locks a failed real spell save and retries the same envelope without double cost or clearing the original intent', async () => {
    const captured = lifeBoundary('SYNTHESIS', 'record-handover'), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true }), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    await userEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before); expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(game.state, command).disabled).toBe(true); fireEvent.click(actionButton(game.state, command)); expect(game.submit).toHaveBeenCalledOnce();
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert'); await settled();
    expect(game.state).toEqual(before); expect(actionButton(game.state, command).disabled).toBe(true);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('保存错误未解除原意图锁');
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await settled();
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(captured.final); expect(game.state.spirituality).toBe(before.spirituality - 5); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('reopens completed history with the same exhausted device and closed permission without performing new actions', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mountGame(game); await userEvent.selectOptions(screen.getByRole('combobox', { name: '查看实践' }), 'withdrawn-consent');
    expect(originalRegion().textContent).toContain('本次已结束'); expect(originalRegion().textContent).toContain('剩0/2格原储能');
    expect(game.state.wisdomAngel.life.activeCase).toBeNull(); expect(game.state.wisdomAngel.life.device.location).toBe('TABLE');
    await userEvent.click(screen.getByText('三案历史与新掌握', { selector: 'summary' }));
    for (const ability of view(before).abilities) expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    await userEvent.click(screen.getByRole('button', { name: '关闭智慧天使页面' }));
    expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});
