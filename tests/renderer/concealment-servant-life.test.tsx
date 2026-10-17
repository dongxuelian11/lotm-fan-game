/* @vitest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration';
import {
  CASES, PANEL, boundary, snapshot, capturedCommand, savedGame, mountGame,
  commandControl, actionButton, clickCommand, settled, view, confirmationName, confirmLabel,
  assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './concealment-servant-ui-fixture';

describe('Concealment Servant same room, actual current consent and ordinary return', () => {
  it.each(['consented-box-concealment-outcome', 'consented-box-actual-next-weak-search', 'owner-current-consent-withdrawn', 'actual-original-door-blocked', 'ordinary-unbolt-after-release', 'reflection'])('renders actual %s attempts, effects, original objects and time separately', renderBoundaryProjection);

  it('asks owner and participant separately, then really walks into the same room with the same original box', async () => {
    const game = savedGame(boundary('consented-box-opened').final), before = structuredClone(game.state), caseId = 'consented-box';
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭隐秘之仆页面' })).toBeNull();
    expect(view(game.state).life.currentAttempt).toMatchObject({ ownerConsent: 'UNASKED', participantConsent: 'UNASKED', entered: false });
    await clickCommand(game, { type: 'READ_SOURCE', caseId }); await clickCommand(game, { type: 'CHECK_DOOR', caseId });
    await clickCommand(game, { type: 'CONSENT_OWNER', caseId });
    expect(view(game.state).life.currentAttempt).toMatchObject({ ownerConsent: 'GRANTED', participantConsent: 'UNASKED' });
    expect(actionButton(game.state, { type: 'ENTER_ROOM', caseId }).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain('参与者意愿：尚未询问本次');
    await clickCommand(game, { type: 'CONSENT_PARTICIPANT', caseId });
    expect(view(game.state).life.currentAttempt).toMatchObject({ ownerConsent: 'GRANTED', participantConsent: 'GRANTED', entered: false });
    await clickCommand(game, { type: 'AGREE_RETURN', caseId }); const atDoor = structuredClone(game.state);
    await clickCommand(game, { type: 'ENTER_ROOM', caseId });
    expect(game.state.concealmentServant.life.playerLocation).toBe('ROOM'); expect(game.state.concealmentServant.life.erin.location).toBe('ROOM');
    expect(game.state.concealmentServant.life.playerTravelMetres).toBe(atDoor.concealmentServant.life.playerTravelMetres + 6);
    expect(game.state.concealmentServant.life.erin.travelMetres).toBe(atDoor.concealmentServant.life.erin.travelMetres + 6);
    expect(game.state.concealmentServant.life.clockSeconds).toBe(atDoor.concealmentServant.life.clockSeconds + 6);
    await clickCommand(game, { type: 'TAKE_BOX', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary('consented-box-concealment-outcome').beforeLast));
    expect(game.state.concealmentServant.life.box).toMatchObject({ id: 'CS2-CASE-1', owner: 'CS2-ERIN', location: 'PLAYER' });
    expect(game.state.concealmentServant.life.page).toEqual(before.concealmentServant.life.page);
    expect(game.state.spiritWarlock).toEqual(before.spiritWarlock); assertLegacyPreserved(before, game.state);
  }, 30_000);

  it.each(CASES)('separately reviews the actual %s concealment attempt without treating a successful window as an application', async caseId => {
    const captured = boundary(`${caseId}-concealment-outcome`), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    const review = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of ['6灵性、知识18', '最多60秒', '身体仍在原地点', '实际搬运才计本次应用', '先解除，再普通解闩']) expect(review.textContent).toContain(text);
    await userEvent.click(within(review).getByRole('button', { name: confirmLabel(command) }));
    await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); const current = view(game.state).life.currentAttempt!;
    expect(current.concealment.attempts).toBe(1); expect(current.concealment.effects).toBe(0);
    const successful = current.concealment.tier === 'SUCCESS' || current.concealment.tier === 'GREAT_SUCCESS';
    expect(current.concealment.successes).toBe(successful ? 1 : 0);
    expect(current.concealment.remainingSeconds).toBe(successful ? 60 : 0);
    expect(current.concealment.state).toBe(successful ? 'ACTIVE' : 'FAILED');
    expect(game.state.spirituality).toBe(before.spirituality - 6); expect(game.state.health).toBe(before.health);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(game.state.concealmentServant.life.playerLocation).toBe(before.concealmentServant.life.playerLocation);
    expect(game.state.concealmentServant.life.box).toEqual(before.concealmentServant.life.box);
    expect(game.state.concealmentServant.life.erin).toEqual(before.concealmentServant.life.erin);
    const after = structuredClone(game.state); fireEvent.focus(screen.getByRole('heading', { name: view(game.state).title }));
    await userEvent.click(screen.getByText('三案历史、掌握与原记录', { selector: 'summary' }));
    expect(game.state).toEqual(after); // Browser focus and reading do not advance actual scene seconds.
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['consented-box', 'blocked-door'] as const)('keeps %s actual movement and weak-marker retrieval separate from opening windows', async caseId => {
    const moved = boundary(`${caseId}-actual-box-move`), game = savedGame(moved.beforeLast), before = structuredClone(game.state);
    await mountGame(game); const prior = view(before).life.currentAttempt!;
    await clickCommand(game, capturedCommand(moved)); expect(game.state).toEqual(migrateSliceState(moved.final));
    expect(game.state.concealmentServant.life.box).toMatchObject({ id: 'CS2-CASE-1', owner: 'CS2-ERIN', location: 'TABLE' });
    expect(game.state.concealmentServant.life.box.travelMetres).toBe(before.concealmentServant.life.box.travelMetres + 2);
    expect(view(game.state).life.currentAttempt!.concealment.effects).toBe(prior.concealment.state === 'ACTIVE' && prior.concealment.remainingSeconds >= 2 ? 1 : 0);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); // Real application is reported before +8 is awarded.
    const beforeSearch = structuredClone(game.state), original = view(beforeSearch).life.currentAttempt!;
    await clickCommand(game, { type: 'WEAK_SEARCH', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary(`${caseId}-actual-next-weak-search`).final));
    const current = view(game.state).life.currentAttempt!, delay = original.traceVeil.state === 'ACTIVE' ? 20 : 0;
    expect(current.search).toMatchObject({ delayedSeconds: delay });
    expect(current.search!.completedAt - current.search!.requestedAt).toBe(1 + delay);
    expect(current.traceVeil.effects).toBe(delay ? 1 : 0);
    expect(game.state.concealmentServant.life.trace.searches).toBe(beforeSearch.concealmentServant.life.trace.searches + 1);
    expect(game.state.concealmentServant.life.trace.exists).toBe(true); expect(game.state.concealmentServant.life.trace.alive).toBe(false);
    expect(game.state.concealmentServant.life.page).toEqual(before.concealmentServant.life.page);
    expect(game.state.spirituality).toBe(before.spirituality); assertLegacyPreserved(before, game.state);
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain(`实际延迟${delay}秒`);
  }, 20_000);

  it('immediately honors current Erin withdrawal without pretending the box or either body has returned', async () => {
    const captured = boundary('owner-current-consent-withdrawn'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), caseId = 'withdrawn-consent';
    await mountGame(game); await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(view(game.state).life.currentAttempt).toMatchObject({ ownerConsent: 'REVOKED', participantConsent: 'REVOKED', stoppedBy: 'ERIN', boxReturned: false, exited: false });
    for (const type of ['CONCEAL', 'TRACE_VEIL', 'MOVE_BOX', 'WEAK_SEARCH'] as const) expect(actionButton(game.state, { type, caseId }).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain('本次由艾琳撤回');
    expect(game.state.concealmentServant.life.box).toEqual(before.concealmentServant.life.box);
    expect(game.state.concealmentServant.life.erin).toEqual(before.concealmentServant.life.erin);
    expect(game.state.concealmentServant.life.clockSeconds).toBe(before.concealmentServant.life.clockSeconds);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(actionButton(game.state, { type: 'EXIT_ROOM', caseId }).disabled).toBe(true);
    assertSavedEnvelope(game, before, captured.lastIntent);
    await clickCommand(game, { type: 'RETURN_BOX', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary(`${caseId}-same-box-returned`).final));
    expect(game.state.concealmentServant.life.erin.location).toBe('ROOM');
    await clickCommand(game, { type: 'EXIT_ROOM', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary(`${caseId}-actual-ordinary-exit`).final));
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('also permits the player to withdraw without rewriting the owner’s already-granted answer', async () => {
    // Explicit alternate public choice from a real save; no RNG or private-state edits.
    const game = savedGame(boundary('owner-current-consent-withdrawn').beforeLast), before = structuredClone(game.state), caseId = 'withdrawn-consent';
    await mountGame(game); await clickCommand(game, { type: 'WITHDRAW_CONSENT', caseId, actor: 'PLAYER' });
    expect(view(game.state).life.currentAttempt).toMatchObject({ ownerConsent: 'GRANTED', participantConsent: 'REVOKED', stoppedBy: 'PLAYER' });
    expect(actionButton(game.state, { type: 'MOVE_BOX', caseId }).disabled).toBe(true);
    expect(game.state.concealmentServant.life.box).toEqual(before.concealmentServant.life.box);
    await clickCommand(game, { type: 'RETURN_BOX', caseId }); await clickCommand(game, { type: 'EXIT_ROOM', caseId });
    expect(game.state.concealmentServant.life.box.location).toBe('START'); expect(game.state.concealmentServant.life.erin.location).toBe('EXIT');
    expect(game.state.spirituality).toBe(before.spirituality); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('releases the actually blocked door first, then unbolts it ordinarily, then returns the object and walks out', async () => {
    const captured = boundary('actual-original-door-blocked'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), caseId = 'blocked-door';
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.concealmentServant.life.room.doorBlocked).toBe(true);
    expect(game.state.concealmentServant.life.erin.travelMetres).toBe(before.concealmentServant.life.erin.travelMetres + 12);
    expect(game.state.concealmentServant.life.clockSeconds).toBe(before.concealmentServant.life.clockSeconds + 13);
    expect(actionButton(game.state, { type: 'UNBOLT_DOOR', caseId }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'EXIT_ROOM', caseId }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'CLOSE', caseId }).disabled).toBe(true);
    const blocked = structuredClone(game.state); fireEvent.click(actionButton(game.state, { type: 'EXIT_ROOM', caseId })); expect(game.state).toEqual(blocked);
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain('门闩真实受阻，先解除，再普通解闩');
    await clickCommand(game, { type: 'RELEASE_CONCEALMENT', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary('blocked-door-explicit-release').final));
    expect(game.state.concealmentServant.life.playerLocation).toBe('ROOM'); expect(game.state.concealmentServant.life.room.doorBlocked).toBe(true);
    expect(game.state.concealmentServant.life.clockSeconds).toBe(blocked.concealmentServant.life.clockSeconds);
    expect(game.state.concealmentServant.life.box).toEqual(blocked.concealmentServant.life.box);
    await clickCommand(game, { type: 'UNBOLT_DOOR', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary('ordinary-unbolt-after-release').final));
    expect(game.state.concealmentServant.life.erin.travelMetres).toBe(blocked.concealmentServant.life.erin.travelMetres + 12);
    expect(game.state.concealmentServant.life.clockSeconds).toBe(blocked.concealmentServant.life.clockSeconds + 14);
    expect(game.state.concealmentServant.life.room.doorBlocked).toBe(false); expect(game.state.concealmentServant.life.playerLocation).toBe('ROOM');
    expect(actionButton(game.state, { type: 'EXIT_ROOM', caseId }).disabled).toBe(true); // Same original box is still on the table.
    await clickCommand(game, { type: 'RETURN_BOX', caseId }); await clickCommand(game, { type: 'EXIT_ROOM', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary('blocked-door-actual-ordinary-exit').final));
    expect(view(game.state).life.currentAttempt).toMatchObject({ releasedAfterBlock: true, doorUnbolted: true, boxReturned: true, exited: true });
    expect(game.state.spirituality).toBe(before.spirituality); assertLegacyPreserved(before, game.state);
  }, 30_000);

  it.each(CASES)('returns the same %s original object before the original bodies and records only actual application growth', async caseId => {
    const captured = boundary(`${caseId}-same-box-returned`), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.concealmentServant.life.box).toMatchObject({ id: 'CS2-CASE-1', owner: 'CS2-ERIN', location: 'START' });
    expect(game.state.concealmentServant.life.erin.location).toBe('ROOM'); expect(game.state.concealmentServant.life.playerLocation).toBe('ROOM');
    expect(actionButton(game.state, { type: 'CLOSE', caseId }).disabled).toBe(true);
    const returned = structuredClone(game.state); await clickCommand(game, { type: 'EXIT_ROOM', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary(`${caseId}-actual-ordinary-exit`).final));
    expect(game.state.concealmentServant.life.clockSeconds).toBe(returned.concealmentServant.life.clockSeconds + 6);
    expect(game.state.concealmentServant.life.erin.travelMetres).toBe(returned.concealmentServant.life.erin.travelMetres + 6);
    expect(game.state.concealmentServant.life.page).toEqual(before.concealmentServant.life.page);
    await clickCommand(game, { type: 'INSPECT', caseId }); await clickCommand(game, { type: 'CLOSE', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary(`${caseId}-closed`).final));
    expect(game.state.concealmentServant.life.cases[caseId].attempts.at(-1)).toMatchObject({ closed: true, inspected: true, boxReturned: true, exited: true });
    assertLegacyPreserved(before, game.state);
  }, 30_000);

  it.each(CASES)('reports %s actual effects only, never successful-unused windows, for each +8', async caseId => {
    const captured = boundary(`${caseId}-report`), game = savedGame(captured.beforeLast), before = structuredClone(game.state), attempt = before.concealmentServant.life.cases[caseId].attempts.at(-1)!;
    await mountGame(game); await clickCommand(game, capturedCommand(captured)); expect(game.state).toEqual(migrateSliceState(captured.final));
    for (const [id, use] of [['darkness.s2.bounded-concealment', attempt.concealment], ['darkness.s2.trace-veil', attempt.traceVeil]] as const) {
      expect(game.state.progression.mastery[id]).toBe(before.progression.mastery[id]! + (use.effects ? 8 : 0));
    }
    expect(game.state.progression.acting).toBe(before.progression.acting + 25); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['consented-box', 'blocked-door'] as const)('counteracts %s currently active windows without undoing completed movement or refunding resources', async caseId => {
    // Deliberately branch at the actual original move. Existing failed windows remain failed.
    const game = savedGame(boundary(`${caseId}-actual-box-move`).final), before = structuredClone(game.state);
    const previous = view(before).life.currentAttempt!;
    await mountGame(game); await clickCommand(game, { type: 'LIGHT_ANCHOR', caseId });
    const current = view(game.state).life.currentAttempt!;
    for (const key of ['concealment', 'traceVeil'] as const) {
      expect(current[key].effects).toBe(previous[key].effects); expect(current[key].successes).toBe(previous[key].successes);
      expect(current[key].state).toBe(previous[key].state === 'ACTIVE' ? 'COUNTERED' : previous[key].state);
    }
    expect(game.state.concealmentServant.life.room.concealed).toBe(false); expect(game.state.concealmentServant.life.anchorLight.on).toBe(true);
    expect(game.state.concealmentServant.life.box).toEqual(before.concealmentServant.life.box); expect(current.boxMoved).toBe(true);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.random).toEqual(before.random);
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain('当前开启，有限窗口已受反制');
    await clickCommand(game, { type: 'WEAK_SEARCH', caseId }); expect(view(game.state).life.currentAttempt!.search!.delayedSeconds).toBe(0);
    await clickCommand(game, { type: 'SWITCH_OFF_ANCHOR', caseId }); await clickCommand(game, { type: 'RETURN_BOX', caseId }); await clickCommand(game, { type: 'EXIT_ROOM', caseId });
    expect(game.state.concealmentServant.life.trace.exists).toBe(true); assertLegacyPreserved(before, game.state);
  }, 30_000);

  it('advances bounded window time only with an actual wait and does not award unused windows', async () => {
    const game = savedGame(boundary('consented-box-veil-outcome').final), before = structuredClone(game.state), caseId = 'consented-box';
    await mountGame(game); const prior = view(before).life.currentAttempt!; await clickCommand(game, { type: 'WAIT_20', caseId });
    const current = view(game.state).life.currentAttempt!;
    expect(game.state.concealmentServant.life.clockSeconds).toBe(before.concealmentServant.life.clockSeconds + 20);
    expect(current.traceVeil.remainingSeconds).toBe(0); expect(current.traceVeil.state).toBe(prior.traceVeil.state === 'ACTIVE' ? 'EXPIRED' : prior.traceVeil.state);
    expect(current.concealment.remainingSeconds).toBe(Math.max(0, prior.concealment.remainingSeconds - 20));
    expect(current.concealment.effects).toBe(0); expect(current.traceVeil.effects).toBe(0); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.random).toEqual(before.random);
    await clickCommand(game, { type: 'WEAK_SEARCH', caseId }); expect(view(game.state).life.currentAttempt!.search!.delayedSeconds).toBe(0);
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('permits an ordinary refusal and truthful closure without moving a body or conjuring an object', async () => {
    const game = savedGame(boundary('consented-box-opened').final), before = structuredClone(game.state), caseId = 'consented-box';
    await mountGame(game); await clickCommand(game, { type: 'READ_SOURCE', caseId }); await clickCommand(game, { type: 'DECLINE_OWNER', caseId });
    expect(actionButton(game.state, { type: 'ENTER_ROOM', caseId }).disabled).toBe(true);
    await clickCommand(game, { type: 'INSPECT', caseId }); await clickCommand(game, { type: 'CLOSE', caseId });
    expect(game.state.concealmentServant.life.cases[caseId]).toMatchObject({ status: 'EXAMINED', result: 'ORDINARY', returned: true });
    expect(game.state.concealmentServant.life.cases[caseId].attempts.at(-1)).toMatchObject({ entered: false, exited: false, boxTaken: false, result: 'ORDINARY' });
    expect(game.state.concealmentServant.life.box).toEqual(before.concealmentServant.life.box); expect(game.state.concealmentServant.life.erin).toEqual(before.concealmentServant.life.erin);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('reopens practiced history without renewing current consent, moving originals, or applying a free body copy', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mountGame(game); await userEvent.selectOptions(screen.getByRole('combobox', { name: '查看实践' }), 'withdrawn-consent');
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain('本次已结束');
    expect(game.state.concealmentServant.life.activeCase).toBeNull(); expect(game.state.concealmentServant.life.box.location).toBe('START');
    await userEvent.click(screen.getByRole('button', { name: '关闭隐秘之仆页面' }));
    expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});
