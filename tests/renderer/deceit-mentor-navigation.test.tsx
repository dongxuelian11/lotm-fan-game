import { playerText } from "../../src/shared/player-text.js";
/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { DeceitMentorCommand } from "../../src/domain/deceit-mentor/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

interface ContinuedCapture {
  prefixCount: number; commands: SliceIntent[]; departureStart: unknown; guidanceStart: unknown;
  promoted: unknown; practiced: unknown; combatStart: unknown; final: unknown;
}
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// These are actual public-command captures. Never edit resources, consent, RNG, original people or objects.
const original = (): { commands: SliceIntent[]; final: unknown } => JSON.parse(readFileSync("tests/fixtures/parasite-v01280/natural.json", "utf8"));
const continued = (): ContinuedCapture => JSON.parse(readFileSync("tests/fixtures/deceit-mentor-v01510/natural.json", "utf8"));
function boundary(name: string): Boundary {
  const entries = JSON.parse(readFileSync("tests/fixtures/deceit-mentor-v01510/boundaries.json", "utf8")) as Record<string, Boundary>;
  if (!entries[name]) throw new Error(`Missing real DeceitMentor boundary: ${name}`);
  return entries[name];
}
function savedGame(state: unknown, failFirstSave = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This original run already exists.");
    if (failFirstSave && attempts++ === 0) return { ok: false as const, error: { code: "SAVE_FAILED", message: "本次原操作尚未保存", retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T08:00:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
const LEGACY_STAGES = ["marauder", "swindler", "cryptologist", "fireThief", "dreamStealer", "parasite"] as const;
function expectLegacyPreserved(state: SliceState, before: SliceState) {
  for (const key of LEGACY_STAGES) expect(state[key]).toEqual(before[key]);
  expect(state.runId).toBe(before.runId); expect(state.random.seed).toBe(before.random.seed); expect(state.character.gender).toBe(before.character.gender);
}
async function acknowledgeSavedRound() {
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function mountGame(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T07:59:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: state.status === "DEAD" ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "人物卷宗" })
    ?? screen.queryByRole("region", { name: "欺瞒导师" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.combat ? screen.queryByRole("dialog", { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // Previous battles remain in the save. Acknowledge their real outcomes through the UI instead of erasing them.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.deceitMentor.insideCase) await screen.findByRole("region", { name: "欺瞒导师" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    await userEvent.click(screen.getByRole("button", { name: "欺瞒导师与有限规则欺瞒" }));
    await screen.findByRole("region", { name: "欺瞒导师" });
  }
}
function actionButton(state: SliceState, command: DeceitMentorCommand) {
  const entry = projectSliceState(state).deceitMentor.actions.find(item => JSON.stringify(item.command) === JSON.stringify(command));
  if (!entry) throw new Error(`No actual public DeceitMentor action: ${JSON.stringify(command)}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "欺瞒导师" }).getAttribute("aria-busy")).toBe("false"));
}
async function submitCapturedRound(game: SavedGame, intent: SliceIntent) {
  if (intent.type !== "COMBAT_ROUND") throw new Error("The actual captured intent must be a combat round.");
  const battle = projectSliceState(game.state).combat!;
  const stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
  const stance = battle.stances.find(item => item.id === intent.stance)!;
  await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(stance.label) }));
  await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
  return screen.findByRole("dialog", { name: "战斗回合结果" });
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Deceit Mentor navigation from the preserved352-command natural Parasite prefix", () => {
  it("opens after the exact352-command natural S4 prefix without healing or rewriting the old originals", async () => {
    const old = original(), capture = continued(), game = savedGame(capture.departureStart), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(352); expect(capture.prefixCount).toBe(352); expect(capture.commands.slice(0, 352)).toEqual(old.commands);
    expect(before).toMatchObject({ week: 92, health: 100, mind: 100, spirituality: 114, cash: 570, actionsRemaining: 3, progression: { sequence: 4, acting: 100 } });
    expect(before.parasite.life.host.control).toBe("HOST"); expect(before.parasite.encounter.enemyStatus).toBe("SURRENDERED");
    await mountGame(game);
    expect(screen.getByRole("region", { name: "欺瞒导师当前目标" }).textContent).toContain("10/12");
    const summary = screen.getByText("原身体、旧寄生与继承原物", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false); await userEvent.click(summary);
    const history = screen.getByRole("region", { name: "欺瞒导师继承记录" });
    for (const value of ["第82周真实晋升", "PR4-THOMAS", "HOST", "PR4-ALICE", "EXECUTED", "PR4-RALF-TOREN", "SURRENDERED", "PR4-RALF-CLUB", "YARD"]) expect(history.textContent).toContain(value);
    expect(within(history).queryByRole("button")).toBeNull(); await userEvent.click(screen.getByRole("button", { name: "关闭欺瞒导师页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("retries the exact guidance envelope after save failure without charging twice", async () => {
    const captured = boundary("guidance"), game = savedGame(captured.beforeLast, true), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "DECEIT_MENTOR", command: { type: "LEARN_GUIDANCE" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "LEARN_GUIDANCE" }));
    await screen.findByRole("alert"); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(actionButton(game.state, { type: "LEARN_GUIDANCE" }).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭欺瞒导师页面" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    if (game.state.week === before.week) { expect(game.state.cash).toBe(before.cash - 500); expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1); }
  }, 15_000);

  it.each(["potion-work-5", "buy-independent-potion"])("saves %s against only the actual original bottle", async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "DECEIT_MENTOR" || !('bottleId' in captured.lastIntent.command)) throw new Error("Expected the actual original bottle command.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立欺瞒导师原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command));
    const expected = migrateSliceState(captured.final);
    if (expected.activeEvent) {
      expect(expected.activeEvent.id).toBe("LIFE-BILL-01");
      const event = projectSliceState(expected).activeEvent!;
      const bill = await screen.findByRole("dialog", { name: event.title });
      expect(within(bill).getByRole("heading", { name: event.title })).toBeTruthy();
      expect(screen.queryByRole("region", { name: "欺瞒导师" })).toBeNull();
    } else await settled();
    expect(game.state).toEqual(expected); expectLegacyPreserved(game.state, before);
    const current = game.state.deceitMentor.bottles.find(bottle => bottle.id === command.bottleId)!;
    if (name === "potion-work-5") expect(current).toMatchObject({ labourSteps: 5, status: "SUPPLIER", acquiredWeek: null });
    else expect(current).toMatchObject({ status: "PLAYER", consumedWeek: null, outcome: null });
    expect(game.state.deceitMentor.preparedWeek).toBeNull(); expect(game.state.deceitMentor.life).toEqual(before.deceitMentor.life);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("locks paid current-week preparation while leaving a real zero-action cancellation", async () => {
    const captured = boundary("prepare-current-week"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "DECEIT_MENTOR", command: { type: "PREPARE_PROMOTION" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "PREPARE_PROMOTION" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.deceitMentor.preparedWeek).toBe(before.week);
    expect(screen.queryByRole("button", { name: "关闭欺瞒导师页面" })).toBeNull(); expect(actionButton(game.state, { type: "LEAVE_PREPARATION" }).disabled).toBe(false);
    expectLegacyPreserved(game.state, before); expect(game.state.spirituality).toBe(before.spirituality);
  }, 15_000);

  it("requires separate original-bottle confirmation then keeps the promoted page without refills", async () => {
    const captured = boundary("promotion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "DECEIT_MENTOR" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected actual independent consumption.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立欺瞒导师原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); const review = screen.getByRole("region", { name: "欺瞒导师原瓶服用确认" });
    expect(review.textContent).toContain(command.bottleId); expect(review.textContent).toContain("身体性别不改变"); expect(review.textContent).toContain("不补满");
    expect(within(review).queryByRole("checkbox")).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" })); expect(game.state).toEqual(before);
    await userEvent.click(actionButton(game.state, command)); await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.progression.sequence).toBe(3);
    expect(game.state.deceitMentor.bottles.find(bottle => bottle.id === command.bottleId)?.status).toBe("CONSUMED");
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.deceitMentor.preparedWeek).toBeNull(); expect(game.state.deceitMentor.parasiteActingAtPromotion).toBe(100);
    expectLegacyPreserved(game.state, before); expect(game.state.deceitMentor.life).toEqual(before.deceitMentor.life);
    expect(screen.getByRole("region", { name: "欺瞒导师" })).toBeTruthy(); expect(screen.getByRole("button", { name: "关闭欺瞒导师页面" })).toBeTruthy();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves reflection100 then returns to ordinary life and reopens growth without renewed consent", async () => {
    const captured = boundary("reflection"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "DECEIT_MENTOR", command: { type: "REFLECT" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "REFLECT" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state).toEqual(migrateSliceState(continued().practiced));
    expect(game.state.progression).toMatchObject({ sequence: 3, acting: 100 }); expect(game.state.deceitMentor.life.reflected).toBe(true);
    expect(Object.values(game.state.deceitMentor.life.cases).every(entry => entry.status === "RESOLVED" && !entry.contactOpen)).toBe(true);
    const after = structuredClone(game.state); await userEvent.click(screen.getByRole("button", { name: "关闭欺瞒导师页面" }));
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ })); expect(screen.getByRole("region", { name: "欺瞒导师" })).toBeTruthy();
    expect(game.state).toEqual(after); expectLegacyPreserved(game.state, before); expect(game.submit).toHaveBeenCalledOnce();
  }, 15_000);

  it("shows the first actual Gideon round rather than the old parasite round and replays without cost duplication", async () => {
    const captured = boundary("combat-first"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(before.combat?.encounterId).toBe("DECEIT_MENTOR_DISPUTE"); expect(before.combat?.round).toBe(1); expect(before.lastCombatRound?.parasiteOutcome).toBeTruthy();
    await mountGame(game); const battle = projectSliceState(before).combat!, stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain("吉迪恩"); expect(battle.deceitMentor).toBeTruthy(); expect(stage.textContent).toContain(battle.deceitMentor!.summary); expect(game.submit).not.toHaveBeenCalled();
    const result = await submitCapturedRound(game, captured.lastIntent); expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory); expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1);
    const round = game.state.lastCombatRound!, after = structuredClone(game.state); expect(round.deceitMentorOutcome).toBeTruthy();
    expect(within(result).getByRole("heading", { name: `第 ${round.round} 回合完整记录` })).toBeTruthy(); for (const move of round.moves) expect(result.textContent).toContain(playerText(move.label));
    await userEvent.click(within(result).getByRole("checkbox", { name: "快速显示本回合结果" })); expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
      const replay = within(screen.getByRole("dialog", { name: battle.title ?? "普通人追击" })).getByText(`回看第 ${round.round} 回合完整记录`, { selector: "summary" });
      await userEvent.click(replay); expect(replay.closest("details")!.open).toBe(true); expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    }
  }, 15_000);

  it("commits and reloads the actual terminal outcome without resetting original host, old thought or surrendered Ralf", async () => {
    const captured = boundary("combat-terminal"), game = savedGame(captured.beforeLast), before = structuredClone(game.state), terminal = migrateSliceState(captured.final);
    expect(terminal.combat).toBeNull(); expect(terminal.deceitMentor.encounter.terminal).not.toBeNull();
    await mountGame(game); const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(terminal); expectLegacyPreserved(game.state, before); expect(game.submit).toHaveBeenCalledOnce();
    if (terminal.status === "DEAD") {
      expect(terminal.health).toBe(0); await userEvent.click(within(result).getByRole("button", { name: "查看收尾卷宗" }));
      expect(screen.getByRole("heading", { name: terminal.ending!.title })).toBeTruthy(); expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    } else await userEvent.click(within(result).getByRole("button", { name: "返回生活" }));
    cleanup(); delete window.sliceGame; const reloaded = savedGame(captured.final); await mountGame(reloaded);
    expect(reloaded.state).toEqual(terminal); expect(reloaded.submit).not.toHaveBeenCalled(); expectLegacyPreserved(reloaded.state, before);
    expect(reloaded.state.parasite).toEqual(before.parasite);
    expect(reloaded.state.fireThief.loan).toEqual(before.fireThief.loan);
    expect(reloaded.state.parasite.encounter.borrowed).toEqual(before.parasite.encounter.borrowed);
    if (terminal.ending) { expect(screen.getByRole("heading", { name: terminal.ending.title })).toBeTruthy(); expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull(); }
    else expect(screen.getByRole("region", { name: "欺瞒导师" })).toBeTruthy();
  }, 15_000);
});
