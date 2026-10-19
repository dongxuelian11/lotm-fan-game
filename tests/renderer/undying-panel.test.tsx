/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyUndyingCommand, createUndyingState, projectUndying } from "../../src/domain/undying/index";
import { applyUndyingActivity, validateUndyingActivityCommand, type UndyingCaseId } from "../../src/domain/undying/life";
import { UNDYING_CONSUMPTION_RISK } from "../../src/domain/undying/content";
import type { UndyingAction, UndyingCommand, UndyingProjection } from "../../src/domain/undying/types";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { UndyingGatekeeperHistory, UndyingPanel } from "../../src/renderer/UndyingPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const oldRun = JSON.parse(readFileSync("tests/fixtures/gatekeeper-v01040/natural.json", "utf8")).final;
/** Directed component setup only. Navigation below uses unchanged natural saves instead. */
function gatekeeper(): SliceState {
  const s = migrateSliceState(structuredClone(oldRun));
  s.undying = createUndyingState(); s.week = Math.max(s.week, s.gatekeeper.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28; s.character.coreStats.perception = 28;
  return s;
}
function apply(s: SliceState, command: UndyingCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  if (validateUndyingActivityCommand(command)) applyUndyingActivity(s, command, context);
  else applyUndyingCommand(s, command, context);
}
function taught() { const s = gatekeeper(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function ritual(open = true, checked = true) {
  const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "undying-potion-1" }); apply(s, { type: "BOOK_RITUAL" });
  if (open) { s.week++; apply(s, { type: "BEGIN_RITUAL" }); if (checked) apply(s, { type: "CHECK_PREPARATION", confirmed: true }); }
  return s;
}
function promoted(exit = true) {
  const s = ritual(); apply(s, { type: "CONSUME", bottleId: "undying-potion-1", confirmed: true });
  if (exit) apply(s, { type: "END_RITUAL" }); return s;
}
function beginCase(s: SliceState, caseId: UndyingCaseId, method: "ABILITY" | "ORDINARY" = "ORDINARY", roll = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method }); apply(s, { type: "PERFORM", caseId }, roll);
}
function finishCase(s: SliceState, caseId: UndyingCaseId) {
  if (s.undying.life.cases[caseId].effectActive) apply(s, { type: "STOP_EFFECT", caseId });
  if (s.undying.life.book.location === "DESK") apply(s, { type: "RETURN_BOOK" });
  apply(s, { type: "CLOSE", caseId }); apply(s, { type: "REPORT", caseId });
}
function beforeWitness() { const s = promoted(); beginCase(s, "memory-ledger"); finishCase(s, "memory-ledger"); return s; }
function beforeSeal() { const s = beforeWitness(); beginCase(s, "willing-witness"); finishCase(s, "willing-witness"); return s; }
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: UndyingProjection, type: UndyingCommand["type"], predicate: (action: UndyingAction) => boolean = () => true): UndyingAction {
  const action = value.actions.find(entry => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`); return action;
}
function buttonFor(value: UndyingProjection, type: UndyingCommand["type"], predicate?: (action: UndyingAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
const forCase = (caseId: UndyingCaseId) => (action: UndyingAction) => "caseId" in action.command && action.command.caseId === caseId;
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectUndying(s);
  return { value, onCommand, ...render(<UndyingPanel undying={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
function updatePanel(s: SliceState, onCommand: (command: UndyingCommand) => void) {
  return <UndyingPanel undying={projectUndying(s)} resources={resources(s)} busy={false} onCommand={onCommand} />;
}
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Undying original preparation and independent confirmations", () => {
  it("leaves the unknown recipe empty and forwards only the selected original supply work", async () => {
    const s = taught(), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "不死者配方与专业准备边界" });
    expect(boundary.textContent).toContain("此渠道不提供完整配方或自行调配步骤"); expect(boundary.textContent).toContain("独立专家主持专业准备");
    expect(boundary.textContent).toContain("继续看门人生活"); expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    expect(screen.queryByRole("button", { name: /调配|直接晋升|直接复活|恢复全部记忆/ })).toBeNull();
    const action = findAction(value, "POTION_WORK"); await userEvent.click(buttonFor(value, "POTION_WORK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
    expect(s.undying.bottles.every(bottle => bottle.labourSteps === 0 && bottle.status === "SUPPLIER")).toBe(true);
  });

  it("shows current independent expert, paid next-week booking and actual supplier kit", () => {
    const s = ritual(false), { value } = panel(s), current = screen.getByRole("region", { name: "不死者当前专业准备" });
    for (const text of ["乔里·埃尔德", "67岁", "成年外貌", "序列4", "UDY4-JORY", "UDY4-HALL", "UDY4-KIT-1", "280便士", "原供应方", "尚未耗用"])
      expect(current.textContent).toContain(text);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "BEGIN_RITUAL").disabled).toBe(true);
    expect(buttonFor(value, "CANCEL_RITUAL").disabled).toBe(false);
    expect(value.actions.some(action => action.command.type === "CHECK_PREPARATION")).toBe(false);
  });

  it("reviews preparation and sixty-year burden separately from drinking and restores focus on decline", async () => {
    const s = ritual(true, false), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "核对本次专业准备，自由选择是否继续" }));
    const review = screen.getByRole("region", { name: "不死者专业准备的继续确认" });
    for (const text of ["UDY4-KIT-1", "当前本人可实际接触的身体", "六十年负担", "服药还需逐瓶确认", "不模拟实际死亡", "不承诺低风险"])
      expect(review.textContent).toContain(text);
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "CHECK_PREPARATION"));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.undying.ritual.visits[0]!.checkedWeek).toBeNull();
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    await userEvent.click(screen.getByRole("button", { name: "确认核对，继续本次专业准备" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CHECK_PREPARATION", confirmed: true });
    expect(s.undying.bottles[0]!.status).toBe("PLAYER"); expect(s.undying.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("rechecks expert consent and discards an obsolete original-visit confirmation", async () => {
    const s = ritual(true, false), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION")); s.undying.ritual.expert.willing = false;
    rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "当前专家的真实状态" }).textContent).toContain("不愿参与当前指导");
    const confirm = screen.getByRole("button", { name: "确认核对，继续本次专业准备" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    apply(s, { type: "END_RITUAL" }); s.undying.ritual.expert.willing = true; apply(s, { type: "BOOK_RITUAL" }); s.week++;
    apply(s, { type: "BEGIN_RITUAL" }); rerender(updatePanel(s, onCommand));
    expect(screen.queryByRole("region", { name: "不死者专业准备的继续确认" })).toBeNull();
    await userEvent.click(buttonFor(projectUndying(s), "CHECK_PREPARATION"));
    expect(screen.getByRole("region", { name: "确认前的当前不死者准备" }).textContent).toContain("UDY4-KIT-2");
    expect(s.undying.ritual.visits[0]!.kit.location).toBe("TABLE");
  });

  it("shows original bottle, current kit, actual resource costs and all four risks, with single-submit save retry protection", async () => {
    const s = ritual(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME"));
    expect(screen.getByRole("region", { name: "不死者服用风险与四档结果" }).textContent).toContain(UNDYING_CONSUMPTION_RISK);
    const review = screen.getByRole("region", { name: "这瓶不死者魔药的服用确认" });
    for (const text of ["undying-potion-1", "UDY4-KIT-1", "成功或失败都会耗用这一原瓶与本次原封装包", "实际经历周期仍为0", "普通战斗死亡不自动复活"])
      expect(review.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    rerender(<UndyingPanel undying={value} resources={resources(s)} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复记忆抄录、耗用原包或服药");
    expect((screen.getByRole("button", { name: "暂不服用，返回原准备室" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶不死者魔药的服用确认" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull(); rerender(updatePanel(s, onCommand)); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "undying-potion-1", confirmed: true });
    expect(s.undying.bottles[0]!.status).toBe("PLAYER");
  });

  it.each([1, 100])("keeps actual walkout available after successful or failed consumption, roll %s", async (roll) => {
    const s = ritual(); apply(s, { type: "CONSUME", bottleId: "undying-potion-1", confirmed: true }, roll); s.actionsRemaining = 0;
    const old = structuredClone(s.undying.ritual), { value, onCommand } = panel(s);
    expect(screen.getByRole("region", { name: "不死者当前专业准备" }).textContent).toContain("UDY4-KIT-1");
    expect(value.ritual.playerLocation).toBe("本人在UDY4-HALL原厅内");
    expect(s.undying.ritual.playerLocation).toBe("HALL"); expect(value.ritual.windowOpen).toBe(false);
    expect(screen.getByRole("region", { name: "不死者成长下一步" }).textContent).toContain(findAction(value, "END_RITUAL").label);
    expect(buttonFor(value, "END_RITUAL").disabled).toBe(false); await userEvent.click(buttonFor(value, "END_RITUAL"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END_RITUAL" }); expect(s.undying.ritual).toEqual(old);
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks public actions for %s without introducing local retry controls", condition => {
    const s = ritual(true, false), value = projectUndying(s), onCommand = vi.fn();
    render(<UndyingPanel undying={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "CHECK_PREPARATION")); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Undying original memory, current witness and limited seal", () => {
  it("shows fixed promotion and G anniversary dates while explicitly recording zero experienced cycles", () => {
    const s = promoted(), lifecycle = structuredClone(s.undying.lifecycle); s.date = { ...s.date, year: s.date.year + 2 }; panel(s);
    const record = screen.getByRole("region", { name: "不死者六十年周期登记与实际边界" });
    for (const date of [lifecycle.promotionDate!, lifecycle.expectedCycleDate!]) expect(record.textContent).toContain(`第五纪${date.year}年${date.month}月${date.day}日`);
    expect(record.textContent).toContain("实际经历的周期0 次"); expect(record.textContent).toContain("六十年周期尚未经历");
    expect(record.textContent).toContain("不是已经死亡复活的记录"); expect(record.textContent).toContain("普通战斗死亡不自动复活");
    expect(record.textContent).toContain("长期章节先确认供养付费"); expect(s.undying.lifecycle).toEqual(lifecycle);
  });

  it("shows the actual original book on the desk and requires a separate zero-action physical return", async () => {
    const s = promoted(); beginCase(s, "memory-ledger"); s.actionsRemaining = 0; s.spirituality = 0;
    const original = structuredClone(s.undying.life.book), { value, onCommand, rerender } = panel(s);
    const book = screen.getByRole("region", { name: "唯一原记忆簿与实际去向" });
    expect(book.textContent).toContain("UDY4-BOOK-1"); expect(book.textContent).toContain("原档案桌"); expect(book.textContent).toContain("剩余空白页 0 张");
    for (const entry of original.entries) { expect(book.textContent).toContain(entry.id); expect(book.textContent).toContain(entry.text); expect(book.textContent).toContain(entry.sourceId); }
    expect(buttonFor(value, "CLOSE", forCase("memory-ledger")).disabled).toBe(true);
    expect(buttonFor(value, "RETURN_BOOK").disabled).toBe(false); await userEvent.click(buttonFor(value, "RETURN_BOOK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_BOOK" }); expect(s.undying.life.book).toEqual(original);
    apply(s, { type: "RETURN_BOOK" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "唯一原记忆簿与实际去向" }).textContent).toContain("亲手拿回 1 次");
    expect(buttonFor(projectUndying(s), "CLOSE", forCase("memory-ledger")).disabled).toBe(false);
    expect(s.undying.life.book.entries).toEqual(original.entries);
  });

  it("offers only ordinary memory preparation and never invents missing entries on failure", () => {
    const s = promoted(); apply(s, { type: "OBSERVE", caseId: "memory-ledger" }); const { value, rerender, onCommand } = panel(s);
    expect(value.actions.some(action => action.command.type === "PREPARE" && action.command.caseId === "memory-ledger" && action.command.method === "ABILITY")).toBe(false);
    apply(s, { type: "PREPARE", caseId: "memory-ledger", method: "ORDINARY" }); apply(s, { type: "PERFORM", caseId: "memory-ledger" }, 100);
    rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "唯一原记忆簿与实际去向" }).textContent).toContain("原三页尚未写入事实");
    expect(screen.getByRole("region", { name: "不死者实际实践结果" }).textContent).toContain("本次失败，成本保留");
    expect(s.undying.life.book.location).toBe("DESK"); expect(s.undying.life.book.entries).toEqual([]);
  });

  it("rechecks the original witness's current consent rather than treating previous records as permanent permission", () => {
    const s = beforeWitness(); apply(s, { type: "OBSERVE", caseId: "willing-witness" }); apply(s, { type: "PREPARE", caseId: "willing-witness", method: "ORDINARY" });
    const { value, onCommand, rerender } = panel(s); expect(buttonFor(value, "PERFORM", forCase("willing-witness")).disabled).toBe(false);
    s.undying.life.witness.willing = false; rerender(updatePanel(s, onCommand));
    const witness = screen.getByRole("region", { name: "原见证人当前同意与期限" });
    for (const text of ["伊芙琳·沃斯", "44岁成年女性", "EVELYN-VOSS", "不愿参与本次核对", "六十年后可联系", "均无保证"])
      expect(witness.textContent).toContain(text);
    expect(buttonFor(projectUndying(s), "PERFORM", forCase("willing-witness")).disabled).toBe(true);
    expect(buttonFor(projectUndying(s), "RETURN_BOOK").disabled).toBe(false); expect(s.undying.life.witness.agreedWeek).toBeNull();
  });

  it("shows the actual witness's specific three original entries and finite statement", () => {
    const s = beforeWitness(); beginCase(s, "willing-witness"); panel(s);
    const witness = screen.getByRole("region", { name: "原见证人当前同意与期限" });
    expect(witness.textContent).toContain(`第${s.week}周本人实际作证`);
    for (const id of s.undying.life.witness.entryIds) expect(witness.textContent).toContain(id);
    expect(witness.textContent).toContain(s.undying.life.witness.uncertainty!);
    expect(s.undying.life.book.location).toBe("DESK");
  });

  it.each([1, 100])("shows paid original seal-strip consumption and zero-resource stop after roll %s without moving gray feather", async roll => {
    const s = beforeSeal(), gray = structuredClone(s.gatekeeper.companion); beginCase(s, "bounded-seal", "ABILITY", roll);
    s.actionsRemaining = 0; s.spirituality = 0; const { value, onCommand } = panel(s);
    await userEvent.click(screen.getByText("原回响、屏蔽盒与实际封条"));
    const originals = screen.getByRole("region", { name: "原封印对象与已付封条" });
    for (const text of ["UDY4-ECHO-VESSEL", "UDY4-SHIELD-BOX", "UDY4-STRIP-1", "40便士", "实际消耗", "6灵性", "原灰羽不参与"])
      expect(originals.textContent).toContain(text);
    expect(originals.textContent).toContain(roll === 1 ? "QUIET" : "ACTIVE");
    expect(buttonFor(value, "CLOSE", forCase("bounded-seal")).disabled).toBe(true);
    expect(buttonFor(value, "STOP_EFFECT", forCase("bounded-seal")).disabled).toBe(false);
    await userEvent.click(buttonFor(value, "STOP_EFFECT", forCase("bounded-seal")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STOP_EFFECT", caseId: "bounded-seal" });
    expect(s.undying.life.cases["bounded-seal"].effectActive).toBe(true); expect(s.gatekeeper.companion).toEqual(gray);
  });

  it("distinguishes ordinary containment from making the original echo quiet", async () => {
    const s = beforeSeal(); beginCase(s, "bounded-seal", "ORDINARY"); panel(s);
    await userEvent.click(screen.getByText("原回响、屏蔽盒与实际封条"));
    const originals = screen.getByRole("region", { name: "原封印对象与已付封条" });
    expect(originals.textContent).toContain("CONTAINED"); expect(originals.textContent).toContain("已实际关闭，普通封存");
    expect(originals.textContent).toContain("没有已购买的原封条");
    expect(screen.getByRole("region", { name: "不死者实际实践结果" }).textContent).toContain("未使回响本身安静");
    expect(s.undying.life.strips).toEqual([]);
  });

  it("shows actual ordinary opponent and forwards peaceful zero-action departure", async () => {
    const s = promoted(); apply(s, { type: "ENCOUNTER_TALK" }); s.actionsRemaining = 0; s.spirituality = 0;
    const original = structuredClone(s.undying.encounter), { value, onCommand } = panel(s), encounter = screen.getByRole("region", { name: "不死者可选原院冲突" });
    for (const text of ["欧文·戴尔", "46岁", "UDY4-OWEN", "UDY4-OWEN-CLUB", "不追击", "普通战斗死亡不自动复活"]) expect(encounter.textContent).toContain(text);
    expect(buttonFor(value, "ENCOUNTER_FIGHT").disabled).toBe(true); expect(buttonFor(value, "LEAVE_ENCOUNTER").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "LEAVE_ENCOUNTER")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_ENCOUNTER" });
    expect(s.undying.encounter).toEqual(original);
  });

  it("preserves old gray feather, original marker, cases and bottle history as read-only", () => {
    const s = promoted(), old = projectSliceState(s).gatekeeper; render(<UndyingGatekeeperHistory gatekeeper={old} />);
    const history = screen.getByRole("region", { name: "看门人时期的经历" });
    expect(history.textContent).toContain("看门人扮演进度 100"); expect(history.textContent).toContain("SG6-GRAY-FEATHER");
    expect(history.textContent).toContain(old.practice!.marker); expect(history.textContent).toContain(old.practice!.gate);
    for (const fact of old.companion!.history) expect(history.textContent).toContain(fact);
    for (const entry of old.cases) { for (const fact of entry.observations) expect(history.textContent).toContain(fact); if (entry.result) expect(history.textContent).toContain(entry.result); }
    expect(history.textContent).toContain(old.bottles[0]!.id);
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.gatekeeper).toEqual(oldRun.gatekeeper);
  });
});

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})),
  };
}
async function enterNatural(path: string) {
  // Load the exact final snapshot. No resource, encounter, character, chronology or practice patching.
  const original = JSON.parse(readFileSync(path, "utf8")).final, s = migrateSliceState(structuredClone(original));
  const state = projectSliceState(s), api = bridge(state); window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  // Preserve the old battle; dismiss only its inherited presentation through its ordinary UI.
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return { api, state, s, original };
}
describe("Undying navigation using unchanged natural saves", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
  it("opens advancement from exact original Gatekeeper history without silently preparing anything", async () => {
    const { api, state, s, original } = await enterNatural("tests/fixtures/gatekeeper-v01040/natural.json");
    await userEvent.click(screen.getByRole("button", { name: "查看不死者晋升" }));
    expect(within(screen.getByRole("region", { name: "不死者成长下一步" })).getByRole("heading", { name: state.undying.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "不死者晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "看门人成长下一步" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
    expect(s.gatekeeper).toEqual(original.gatekeeper); expect(s.combatHistory).toEqual(original.combatHistory);
  });
  it("opens practiced S4 growth, reads the original S5 history and returns without mutating the natural save", async () => {
    const { api, state, s, original } = await enterNatural("tests/fixtures/undying-v01260/natural.json");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "不死者成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "不死者成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "不死者六十年周期登记与实际边界" }).textContent).toContain("六十年周期尚未经历");
    await userEvent.click(screen.getByRole("button", { name: "看门人经历" }));
    const history = within(screen.getByRole("region", { name: "看门人时期的经历" }));
    await userEvent.click(history.getByText("看门人原瓶 · 来源与去向")); expect(history.getByText(`原瓶：${state.gatekeeper.bottles[0]!.id}`)).toBeTruthy();
    expect(history.getByRole("region", { name: "看门人原灰羽与短驻约定" }).textContent).toContain("SG6-GRAY-FEATHER");
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "不死者成长" })); expect(screen.getByRole("region", { name: "不死者成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled(); expect(s.undying).toEqual(original.undying); expect(s.gatekeeper).toEqual(original.gatekeeper);
  });
});
