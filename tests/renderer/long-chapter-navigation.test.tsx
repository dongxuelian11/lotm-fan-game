/* @vitest-environment jsdom */
import { readObjectEntry } from "../helpers/read-object-entry";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { LongChapterCommand } from "../../src/domain/long-chapter/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

// All navigation begins from captured public-command saves. No lifecycle, cash, date or memory is patched.
type NaturalCapture = {
  prefixCount: number;
  commands: unknown[];
  departureStart: SliceState;
  prepared: SliceState;
  cycleDead: SliceState;
  revived: SliceState;
  recovered: SliceState;
  final: SliceState;
};
const natural = <K extends keyof NaturalCapture>(key: K): NaturalCapture[K] =>
  readObjectEntry<NaturalCapture[K]>("tests/fixtures/long-chapter-v01390/natural.json", key);
const residenceBoundary = () => readObjectEntry<{ beforeLast: unknown }>(
  "tests/fixtures/long-chapter-v01390/boundaries.json", "pay_residence");
const project = (state: unknown) => projectSliceState(migrateSliceState(state));
async function enter(state: SliceProjection, submitIntent: SliceBridge["submitIntent"] = vi.fn()) {
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision,
      updatedAt: "2026-10-13T00:00:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: state })), submitIntent,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: new RegExp(state.character.name) }));
  if (state.longChapter.eraClosed || state.longChapter.locked) await screen.findByRole("region", { name: "长期章节" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
    if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: state.combat ? "进入下一回合" : "返回生活" }));
  }
}
function savedGame(state: unknown) {
  let current = migrateSliceState(state);
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This fixture already has its original run.");
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T00:01:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
function actionButton(state: SliceState, type: LongChapterCommand["type"]): HTMLButtonElement {
  const action = projectSliceState(state).longChapter.actions.find(entry => entry.command.type === type);
  if (!action) throw new Error(`Missing actual projected long-chapter action ${type}`);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
function expectNoOldScene() {
  expect(screen.queryByRole("heading", { name: "人物卷宗" })).toBeNull();
  expect(screen.queryByRole("button", { name: /非凡成长/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^工作，|^休养，/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "不死者有限生活实践" })).toBeNull();
  expect(screen.queryByRole("region", { name: "原见证人当前同意与期限" })).toBeNull();
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Long chapter navigation from actual natural saves", () => {
  it("opens and dismisses the available future chapter without changing the original living run", async () => {
    const capture = { departureStart: natural("departureStart"), prefixCount: natural("prefixCount"), commands: natural("commands") }, state = project(capture.departureStart), before = structuredClone(state);
    expect(capture.prefixCount).toBe(408); expect(capture.commands).toHaveLength(428);
    expect(state.progression.sequence).toBe(4); expect(state.longChapter.phase).toBe("NONE");
    await enter(state); await userEvent.click(screen.getByRole("button", { name: "长期章节与六十年周期" }));
    expect(screen.getByRole("region", { name: "长期章节当前处境" }).textContent).toContain("首次六十年");
    expect(screen.getByRole("region", { name: "真实日期与经过" }).textContent).toContain("1411年6月12日");
    expectNoOldScene();
    await userEvent.click(screen.getByRole("button", { name: "关闭长期章节页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
  });

  it("requires payment review and a later independent irreversible review on the actual prepared originals", async () => {
    const game = savedGame(residenceBoundary().beforeLast);
    const cash = game.state.cash, date = structuredClone(game.state.date), ap = game.state.actionsRemaining;
    const book = structuredClone(game.state.undying.life.book);
    expect(game.state.longChapter.supportTasks).toHaveLength(4); expect(book.location).toBe("CARE_CHEST");
    await enter(projectSliceState(game.state), game.submit);
    await userEvent.click(actionButton(game.state, "PAY_RESIDENCE"));
    expect(screen.getByRole("region", { name: "长期供养付费确认" }).textContent).toContain("160便士");
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state.cash).toBe(cash);
    await userEvent.click(screen.getByRole("button", { name: "暂不付费，返回安排" }));
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(actionButton(game.state, "PAY_RESIDENCE"));
    await userEvent.click(screen.getByRole("button", { name: "确认支付当前余款，仅落实供养" }));
    expect(game.state.longChapter.phase).toBe("RESIDING"); expect(game.state.longChapter.paidPennies).toBe(160);
    expect(game.state.cash).toBe(cash - 160); expect(game.state.actionsRemaining).toBe(ap - 1);
    expect(game.state.date).toEqual(date); expect(game.state.undying.life.book).toEqual(book);
    // A committed bridge result precedes the panel effect releasing its one-submit lock.
    await waitFor(() => expect(screen.getByRole("region", { name: "长期章节" }).getAttribute("aria-busy")).toBe("false"));
    await userEvent.click(actionButton(game.state, "LIVE_TO_CYCLE"));
    expect(screen.getByRole("region", { name: "不可逆时代推进确认" }).textContent).toContain("39年后83岁故去");
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.state.date).toEqual(date);
    await userEvent.click(screen.getByRole("button", { name: "确认不可逆推进至首次周年" }));
    expect(game.state.status).toBe("ACTIVE"); expect(game.state.health).toBe(0);
    expect(game.state.longChapter.phase).toBe("CYCLE_DEAD"); expect(game.state.date).toEqual(natural("cycleDead").date);
    expect(game.state.cash).toBe(cash - 160); expect(game.state.undying.life.book).toEqual(book); expectNoOldScene();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
      { type: "LONG_CHAPTER", command: { type: "PAY_RESIDENCE", confirmed: true } },
      { type: "LONG_CHAPTER", command: { type: "LIVE_TO_CYCLE", confirmed: true } },
    ]);
  });

  it("returns the same paid original book before cancelling and returns to the original era without a refund", async () => {
    const game = savedGame(natural("prepared")), cash = game.state.cash, date = structuredClone(game.state.date);
    const entries = structuredClone(game.state.undying.life.book.entries);
    await enter(projectSliceState(game.state), game.submit);
    expect(actionButton(game.state, "CANCEL").disabled).toBe(true);
    await userEvent.click(actionButton(game.state, "BOOK_OUT"));
    expect(game.state.undying.life.book.location).toBe("PLAYER"); expect(game.state.longChapter.bookWithdrawals).toBe(1);
    await userEvent.click(actionButton(game.state, "CANCEL"));
    const close = screen.queryByRole("button", { name: "关闭长期章节页面" });
    if (close) await userEvent.click(close);
    expect(game.state.longChapter.phase).toBe("CANCELLED"); expect(game.state.cash).toBe(cash);
    expect(game.state.longChapter.paidPennies).toBe(160); expect(game.state.date).toEqual(date);
    expect(game.state.undying.life.book.entries).toEqual(entries);
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^休养，/ })).toBeTruthy();
  });

  it("reopens the independent cycle-death save and continues seven real days on the same body", async () => {
    const capture = { cycleDead: natural("cycleDead"), revived: natural("revived") }, game = savedGame(capture.cycleDead);
    const body = structuredClone(game.state.longChapter.body), cash = game.state.cash;
    await enter(projectSliceState(game.state), game.submit); expectNoOldScene();
    const facts = screen.getByRole("region", { name: "同一身体与当前身份" });
    expect(facts.textContent).toContain(body!.id); expect(facts.textContent).toContain("当前健康0");
    expect(screen.queryByRole("button", { name: "关闭长期章节页面" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "长期章节" })).toBeTruthy();
    await userEvent.click(actionButton(game.state, "AWAIT_REVIVAL"));
    expect(game.state.date).toEqual(capture.revived.date); expect(game.state.week).toBe(capture.revived.week);
    expect([game.state.health, game.state.mind, game.state.spirituality]).toEqual([50, 60, 94]);
    expect(game.state.cash).toBe(cash); expect(game.state.longChapter.body).toEqual(body);
    expect(game.state.undying.lifecycle.experiencedCycles).toBe(1);
    expect(game.state.longChapter.recoveredSources).toEqual([]); expectNoOldScene();
    expect(projectSliceState(game.state).longChapter.actions.some(action => action.command.type === "AWAIT_REVIVAL")).toBe(false);
  }, 10_000);

  it("keeps readable external originals separate from three actual memory recoveries and original-book return", async () => {
    const game = savedGame(natural("revived")), entries = structuredClone(game.state.undying.life.book.entries);
    const oldGrowth = structuredClone(game.state.progression), originalAp = game.state.actionsRemaining;
    await enter(projectSliceState(game.state), game.submit);
    expect(screen.getByRole("banner").textContent).toContain("本人尚未记起名字");
    expect(screen.getByRole("banner").textContent).not.toContain(game.state.character.name);
    const memory = screen.getByRole("region", { name: "外部记录与部分记忆" });
    for (const entry of entries) { expect(memory.textContent).toContain(entry.id); expect(memory.textContent).toContain(entry.text); }
    expect(memory.textContent).toContain("外部原记录，尚不等于本人想起");
    expect(game.submit).not.toHaveBeenCalled(); expect(actionButton(game.state, "RECOVER_IDENTITY").disabled).toBe(true);
    await userEvent.click(actionButton(game.state, "BOOK_OUT"));
    expect(game.state.longChapter.recoveredSources).toEqual([]); expect(game.state.actionsRemaining).toBe(originalAp);
    const steps = ["RECOVER_IDENTITY", "RECOVER_CASE", "RECOVER_WITNESS"] as const;
    for (const [index, type] of steps.entries()) {
      await userEvent.click(actionButton(game.state, type));
      expect(game.state.longChapter.recoveredSources).toHaveLength(index + 1);
      expect(game.state.actionsRemaining).toBe(originalAp - index - 1);
      expect(game.state.undying.life.book.entries).toEqual(entries);
    }
    expect(game.state.longChapter.phase).toBe("PARTIAL_RECOVERY"); expect(game.state.longChapter.mentallyStable).toBe(true);
    expect(game.state.longChapter.recoveredSources.map(item => item.entryId)).toEqual(entries.map(entry => entry.id));
    expect(game.state.longChapter.recoveredSources.map(item => item.objectId)).toEqual(["UDY4-BOOK-1", "SG6-REPLY-1", "LC-HANDOVER-1"]);
    expect(game.state.progression).toEqual(oldGrowth);
    expect(screen.getByRole("region", { name: "外部记录与部分记忆" }).textContent).toContain("未寻回其余人生记忆");
    expectNoOldScene();
  }, 15_000);

  it("shows actual deaths, new custodians and preserved original sources only as the appropriate era", async () => {
    const capture = { recovered: natural("recovered") }, state = project(capture.recovered), before = structuredClone(state);
    await enter(state); expectNoOldScene();
    const people = screen.getByRole("region", { name: "旧人后果与本时代守护人" });
    for (const text of ["LC-ADA-FENN", "LC-MILES-REED", "LC-LENA-VOSS", "莱娜·沃斯", "1390年8月14日", "83岁时故去", "去向未知", "不提供新预约"])
      expect(people.textContent).toContain(text);
    const objects = screen.getByRole("region", { name: "同一原物与处置" });
    for (const text of ["UDY4-BOOK-1", "SG6-REPLY-1", "UDY4-OWEN-CLUB", "本人手中", "只保旧地点历史"])
      expect(objects.textContent).toContain(text);
    const external = screen.getByText("外部案卷（含旧时代原记录，不代表已找回全部记忆）");
    await userEvent.click(external);
    const archive = external.closest("details")!;
    for (const record of state.chronicle) expect(archive.textContent).toContain(record.text);
    expect(within(archive).queryByRole("button")).toBeNull(); expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
  }, 20_000);

  it("performs the captured new-era work, paid rest and real week without reactivating the old employer", async () => {
    const capture = { recovered: natural("recovered"), final: natural("final") }, game = savedGame(capture.recovered);
    const oldCharacter = structuredClone(game.state.character), oldBook = structuredClone(game.state.undying.life.book);
    const cash = game.state.cash;
    await enter(projectSliceState(game.state), game.submit); expectNoOldScene();
    const steps = ["WORK", "NEXT_WEEK", "WORK", "WORK", "REST", "LEAVE_RECEPTION"] as const;
    for (const type of steps) {
      await userEvent.click(actionButton(game.state, type)); expectNoOldScene();
    }
    expect(game.state.date).toEqual(capture.final.date); expect(game.state.week).toBe(capture.final.week);
    expect([game.state.health, game.state.mind, game.state.spirituality]).toEqual([55, 68, 104]);
    expect(game.state.cash).toBe(cash + 72 - 24 - 8); expect(game.state.longChapter.newLife).toEqual(capture.final.longChapter.newLife);
    expect(game.state.longChapter.location).toBe("OUTSIDE"); expect(game.state.longChapter.body!.location).toBe("LC-OUTSIDE");
    expect(game.state.character).toEqual(oldCharacter); expect(game.state.undying.life.book).toEqual(oldBook);
    expect(projectSliceState(game.state).longChapter.actions.map(action => action.command.type)).toEqual(["CONTINUE_FERRYMAN", "ENTER_RECEPTION"]);
    expect(screen.queryByRole("button", { name: /在当代接待处实做普通档案劳动/ })).toBeNull();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual(steps.map(type => ({ type: "LONG_CHAPTER", command: { type } })));
  }, 30_000);

  it("reopens the actually exited new-era save and enters the same reception without returning to the old city", async () => {
    const game = savedGame(natural("final")), bodyId = game.state.longChapter.body!.id, book = structuredClone(game.state.undying.life.book);
    const cash = game.state.cash, date = structuredClone(game.state.date), ap = game.state.actionsRemaining;
    expect(ap).toBe(1); // The captured final save retains one real action; entering must not refill it.
    await enter(projectSliceState(game.state), game.submit); expectNoOldScene();
    expect(screen.getByRole("region", { name: "本时代生活约定" }).textContent).toContain("本人在门外");
    await userEvent.click(actionButton(game.state, "ENTER_RECEPTION"));
    expect(game.state.longChapter.location).toBe("RECEPTION"); expect(game.state.longChapter.body!.id).toBe(bodyId);
    expect(game.state.undying.life.book).toEqual(book); expect(game.state.cash).toBe(cash); expect(game.state.date).toEqual(date);
    expect(game.state.actionsRemaining).toBe(ap);
    expect(projectSliceState(game.state).longChapter.actions.find(action => action.command.type === "WORK")!.enabled).toBe(true);
    // Assert the committed UI has released its save lock before checking the next action.
    await waitFor(() => expect(screen.getByRole("region", { name: "长期章节" }).getAttribute("aria-busy")).toBe("false"));
    expect(actionButton(game.state, "WORK").disabled).toBe(false); expectNoOldScene();
  });
});
