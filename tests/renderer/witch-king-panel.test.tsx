/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyWitchKingCommand, createWitchKingState, projectWitchKing } from "../../src/domain/witch-king/index";
import { applyWitchKingActivity, validateWitchKingActivityCommand, type WitchKingCaseId } from "../../src/domain/witch-king/life";
import { WITCH_KING_CONSUMPTION_RISK } from "../../src/domain/witch-king/content";
import type { WitchKingAction, WitchKingCommand, WitchKingProjection } from "../../src/domain/witch-king/types";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { WitchKingCrimsonScholarHistory, WitchKingPanel } from "../../src/renderer/WitchKingPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const oldCrimsonScholarRun = JSON.parse(readFileSync("tests/fixtures/crimson-scholar-v0990/natural.json", "utf8")).final;
/** Component fixtures preserve the original saved history, then use explicit clocks/resources and real commands.
 * They are not a natural-run claim and never rewrite the original fixture or any previous outcome. */
function scholar(): SliceState {
  const s = migrateSliceState(structuredClone(oldCrimsonScholarRun));
  s.witchKing = createWitchKingState(); s.week = Math.max(s.week, s.crimsonScholar.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28; s.character.coreStats.perception = 28;
  return s;
}
function apply(s: SliceState, command: WitchKingCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  if (validateWitchKingActivityCommand(command)) applyWitchKingActivity(s, command, context);
  else applyWitchKingCommand(s, command, context);
}
function taught() { const s = scholar(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function ritual(open = true, checked = true) {
  const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "witch-king-potion-1" }); apply(s, { type: "BOOK_RITUAL" });
  if (open) { s.week++; apply(s, { type: "BEGIN_RITUAL" }); if (checked) apply(s, { type: "CHECK_PREPARATION", confirmed: true }); }
  return s;
}
function promoted() { const s = ritual(); apply(s, { type: "CONSUME", bottleId: "witch-king-potion-1", confirmed: true }); return s; }
function beginCase(s: SliceState, caseId: WitchKingCaseId, method: "ABILITY" | "ORDINARY" = "ABILITY", roll = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method });
  if (caseId === "paper-trial" && method === "ABILITY") {
    if (!s.witchKing.life.papers.length) throw new Error("The test must buy actual papers before preparing the case.");
    apply(s, { type: "PREPARE_PAPER", paperId: s.witchKing.life.papers.find(paper => paper.status === "HELD")!.id });
  }
  apply(s, { type: "PERFORM", caseId }, roll);
}
function closeCase(s: SliceState, caseId: WitchKingCaseId, report = true) {
  if (s.witchKing.life.practice.location === "END") apply(s, { type: "RETURN", method: "ORDINARY" });
  if (s.witchKing.life.cases[caseId].effectActive) apply(s, { type: "STOP_EFFECT", caseId });
  apply(s, { type: "INSPECT", caseId }); apply(s, { type: "CLOSE", caseId });
  if (report) apply(s, { type: "REPORT", caseId });
}
function beforeArrow() { const s = promoted(); beginCase(s, "paper-trial", "ORDINARY"); closeCase(s, "paper-trial"); return s; }
function beforeMoon() { const s = beforeArrow(); beginCase(s, "arrow-target", "ORDINARY"); closeCase(s, "arrow-target"); return s; }
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: WitchKingProjection, type: WitchKingCommand["type"], predicate: (action: WitchKingAction) => boolean = () => true): WitchKingAction {
  const action = value.actions.find(entry => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`);
  return action;
}
function buttonFor(value: WitchKingProjection, type: WitchKingCommand["type"], predicate?: (action: WitchKingAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectWitchKing(s);
  return { value, onCommand, ...render(<WitchKingPanel witchKing={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("WitchKing public panel, actual professional preparation and finite original papers", () => {
  it("keeps both the complete formula and ritual unknown and only forwards the original supply command", async () => {
    const s = taught(), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "巫王配方与专业准备边界" });
    expect(boundary.textContent).toContain("成品配方仍未知"); expect(boundary.textContent).toContain("取得有来源的成品原瓶，由当前自愿且在场的专家主持专业准备；当前渠道不提供完整配方、材料清单或操作步骤。");
    expect(boundary.textContent).toContain("血族晋升序列4仍需仪式"); expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    expect(screen.queryByRole("button", { name: /调配|直接晋升|召唤大师|召唤天使/ })).toBeNull();
    expect(value.bottles).toHaveLength(3); const work = findAction(value, "POTION_WORK"); await userEvent.click(buttonFor(value, "POTION_WORK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(work.command);
    expect(s.witchKing.bottles.every(bottle => bottle.labourSteps === 0 && bottle.status === "SUPPLIER")).toBe(true);
  });

  it("shows the actual adult expert, next-week visit and unused supplier kit without inventing an early window", () => {
    const s = ritual(false), { value } = panel(s);
    const current = screen.getByRole("region", { name: "巫王当前专业准备" });
    for (const text of ["格蕾丝·维尔", "214岁", "成年外貌", "序列4", "WK4-GRACE", "WK4-HALL", "WK4-RITUAL-1", "WK4-KIT-1", "原供应方", "尚未耗用"])
      expect(current.textContent).toContain(text);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "BEGIN_RITUAL").disabled).toBe(true);
    expect(buttonFor(value, "CANCEL_RITUAL").disabled).toBe(false);
    expect(value.actions.some(action => action.command.type === "CHECK_PREPARATION")).toBe(false);
  });

  it("reviews the real preparation separately from drinking and restores focus when the player declines", async () => {
    const s = ritual(true, false), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "核对本次专业准备，自由选择是否继续" }));
    const review = screen.getByRole("region", { name: "巫王专业准备的继续确认" });
    expect(review.textContent).toContain("WK4-KIT-1"); expect(review.textContent).toContain("服药还需逐瓶确认");
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "CHECK_PREPARATION"));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.witchKing.ritual.visits[0]!.checkedWeek).toBeNull();
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    await userEvent.click(screen.getByRole("button", { name: "确认核对，继续本次专业准备" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CHECK_PREPARATION", confirmed: true });
    expect(s.witchKing.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("rechecks current expert consent while reviewing and discards a confirmation when the original visit changes", async () => {
    const s = ritual(true, false), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION")); s.witchKing.ritual.expert.willing = false;
    rerender(<WitchKingPanel witchKing={projectWitchKing(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前专家的真实状态" }).textContent).toContain("不愿参与当前指导");
    const confirm = screen.getByRole("button", { name: "确认核对，继续本次专业准备" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    apply(s, { type: "END_RITUAL" }); s.witchKing.ritual.expert.willing = true; apply(s, { type: "BOOK_RITUAL" }); s.week++;
    apply(s, { type: "BEGIN_RITUAL" }); const next = projectWitchKing(s);
    rerender(<WitchKingPanel witchKing={next} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "巫王专业准备的继续确认" })).toBeNull();
    await userEvent.click(buttonFor(next, "CHECK_PREPARATION"));
    expect(screen.getByRole("region", { name: "确认前的当前巫王仪式" }).textContent).toContain("WK4-KIT-2");
    expect(s.witchKing.ritual.visits[0]!.kit.status).toBe("SEALED"); expect(s.witchKing.ritual.visits[0]!.kit.location).toBe("TABLE");
  });

  it("shows the selected original, current kit, four-tier risks and real resources, then submits drinking only once", async () => {
    const s = ritual(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME"));
    expect(screen.getByRole("region", { name: "巫王服用风险与四档结果" }).textContent).toContain(WITCH_KING_CONSUMPTION_RISK);
    const review = screen.getByRole("region", { name: "这瓶巫王魔药的服用确认" });
    for (const text of ["witch-king-potion-1", "WK4-KIT-1", "成功或失败都会耗用这一原瓶与本次原封装包", "旧包不能复用"])
      expect(review.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    const error = { message: "本次保存失败，请重试原操作。", retryable: true };
    rerender(<WitchKingPanel witchKing={value} resources={resources(s)} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要再次准备、耗纸或服药");
    expect((screen.getByRole("button", { name: "暂不服用，返回原礼堂" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶巫王魔药的服用确认" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<WitchKingPanel witchKing={value} resources={resources(s)} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "witch-king-potion-1", confirmed: true });
    expect(s.witchKing.bottles[0]!.status).toBe("PLAYER"); expect(s.witchKing.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("preserves a failed bottle and consumed kit, and shows a separately paid second kit at its actual supplier", async () => {
    const s = ritual(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "CONSUME"));
    await userEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    apply(s, { type: "CONSUME", bottleId: "witch-king-potion-1", confirmed: true }, 100);
    const failedVisit = structuredClone(s.witchKing.ritual.visits[0]);
    rerender(<WitchKingPanel witchKing={projectWitchKing(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶巫王魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "巫王当前专业准备" }).textContent).toContain("原包已耗尽，不能复用");
    expect(s.progression.sequence).toBe(5); expect(s.witchKing.ritual.playerLocation).toBe("OUTSIDE");
    apply(s, { type: "BUY_POTION", bottleId: "witch-king-potion-2" }); apply(s, { type: "BOOK_RITUAL" });
    rerender(<WitchKingPanel witchKing={projectWitchKing(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    const current = screen.getByRole("region", { name: "巫王当前专业准备" });
    for (const text of ["WK4-KIT-1", "WK4-KIT-2", "原供应方", "原包已耗尽，不能复用"])
      expect(current.textContent).toContain(text);
    expect(s.witchKing.ritual.visits[0]).toEqual(failedVisit); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("offers zero-action actual departure even after current expert availability changes, without optimistic movement or refund", async () => {
    const s = ritual(); s.actionsRemaining = 0; s.spirituality = 0; s.witchKing.ritual.expert.location = "AWAY";
    const snapshot = structuredClone(s.witchKing.ritual), cash = s.cash, { value, onCommand } = panel(s);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "CONSUME").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "巫王成长下一步" }).textContent).toContain(findAction(value, "END_RITUAL").label);
    expect(buttonFor(value, "END_RITUAL").disabled).toBe(false); await userEvent.click(buttonFor(value, "END_RITUAL"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END_RITUAL" }); expect(s.witchKing.ritual).toEqual(snapshot); expect(s.cash).toBe(cash);
    expect(screen.getByRole("region", { name: "当前专家的真实状态" }).textContent).toContain("当前不在原厅");
  });

  it("requires an explicit original-paper selection and forwards only its projected preparation, with no optimistic charge", async () => {
    const s = promoted(); apply(s, { type: "BUY_PAPERS" }); const { value, onCommand, rerender } = panel(s);
    const papers = screen.getByRole("region", { name: "实际月亮纸人与逐张去向" });
    expect(papers.textContent).toContain("未准备 3 张 · 已准备 0 张 · 已耗用 0 张");
    expect(screen.queryByRole("button", { name: /明确准备原纸/ })).toBeNull();
    const selector = screen.getByRole("combobox", { name: "选择要准备的一张原纸" }) as HTMLSelectElement;
    expect(selector.value).toBe(""); await userEvent.selectOptions(selector, "WK4-PAPER-1-2"); expect(onCommand).not.toHaveBeenCalled();
    const predicate = (action: WitchKingAction) => action.command.type === "PREPARE_PAPER" && action.command.paperId === "WK4-PAPER-1-2";
    const button = buttonFor(value, "PREPARE_PAPER", predicate); expect(button.textContent).toContain("1行动"); expect(button.textContent).toContain("3灵性");
    await userEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE_PAPER", paperId: "WK4-PAPER-1-2" });
    expect(papers.textContent).toContain("未准备 3 张 · 已准备 0 张 · 已耗用 0 张");
    apply(s, { type: "PREPARE_PAPER", paperId: "WK4-PAPER-1-2" });
    rerender(<WitchKingPanel witchKing={projectWitchKing(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际月亮纸人与逐张去向" }).textContent).toContain("未准备 2 张 · 已准备 1 张 · 已耗用 0 张");
    expect((screen.getByRole("combobox", { name: "选择要准备的一张原纸" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /明确准备原纸/ })).toBeNull();
  });

  it("shows the embedded paper preparation as zero AP but still three spirituality and a real selected paper", async () => {
    const s = promoted(); apply(s, { type: "BUY_PAPERS" }); apply(s, { type: "OBSERVE", caseId: "paper-trial" });
    apply(s, { type: "PREPARE", caseId: "paper-trial", method: "ABILITY" }); s.actionsRemaining = 0;
    const { value, onCommand } = panel(s);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择要准备的一张原纸" }), "WK4-PAPER-1-1");
    const button = buttonFor(value, "PREPARE_PAPER"); expect(button.disabled).toBe(false); expect(button.textContent).toContain("0行动"); expect(button.textContent).toContain("3灵性");
    await userEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE_PAPER", paperId: "WK4-PAPER-1-1" });
    expect(s.witchKing.life.papers[0]!.status).toBe("HELD");
  });

  it("preserves the exact consumed paper on failed substitution and permits zero-resource original inspection", async () => {
    const s = promoted(); apply(s, { type: "BUY_PAPERS" }); beginCase(s, "paper-trial", "ABILITY", 100); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand } = panel(s);
    const papers = screen.getByRole("region", { name: "实际月亮纸人与逐张去向" });
    for (const text of ["未准备 2 张 · 已准备 0 张 · 已耗用 1 张", "WK4-PAPER-1-1", "已经耗用，不会恢复为新纸", "原软垫纸人实践"])
      expect(papers.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "巫王实际生活结果" }).textContent).toContain("未取得充分结果");
    expect(s.health).toBe(98); expect(buttonFor(value, "INSPECT").disabled).toBe(false);
    expect(value.actions.some(action => action.command.type === "STOP_EFFECT")).toBe(false);
    await userEvent.click(buttonFor(value, "INSPECT")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "INSPECT", caseId: "paper-trial" });
    expect(s.witchKing.life.cases["paper-trial"].effectActive).toBe(false); expect(s.witchKing.life.cases["paper-trial"].inspected).toBe(false);
    expect(s.witchKing.life.papers[0]!.status).toBe("CONSUMED");
  });

  it("keeps ordinary sidestepping as a real route without paper or ability mastery", () => {
    const s = promoted(), mastery = { ...s.progression.mastery }; beginCase(s, "paper-trial", "ORDINARY"); closeCase(s, "paper-trial");
    const { value } = panel(s); expect(s.witchKing.life.papers).toEqual([]); expect(s.progression.mastery).toEqual(mastery);
    expect(value.life.cases[0]!.result).toContain("普通真实对照"); expect(s.progression.acting).toBe(25);
    expect(screen.getByRole("region", { name: "巫王能力与消化" }).textContent).toContain("月光不是复活或永久免疫");
    expect(screen.getByRole("region", { name: "巫王能力与消化" }).textContent).toContain("序列3召唤大师");
  });

  it.each([1, 100])("shows the real original target after the paid arrow attempt with roll %s", (roll) => {
    const s = beforeArrow(); const spirituality = s.spirituality; beginCase(s, "arrow-target", "ABILITY", roll); const { value } = panel(s);
    const target = screen.getByRole("region", { name: "同一原泥靶的真实状态" });
    expect(target.textContent).toContain("WK4-TARGET"); expect(target.textContent).toContain("WK4-BACKSTOP");
    expect(target.textContent).toContain(roll === 1 ? "已经破裂" : "仍完整");
    expect(target.textContent).toContain(`实际失手 ${roll === 1 ? 0 : 1} 次`); expect(s.spirituality).toBe(spirituality - 4);
    expect(value.actions.some(action => action.command.type === "PERFORM" && action.command.caseId === "arrow-target")).toBe(false);
  });

  it("keeps body and folio at END until actual zero-AP ordinary return, then stops the field before close", async () => {
    const s = beforeMoon(); beginCase(s, "moon-return"); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand, rerender } = panel(s);
    const current = screen.getByRole("region", { name: "本人和原手册的真实位置" });
    expect(current.textContent).toContain("原6米路线终点，尚未返回"); expect(current.textContent).toContain("WK4-FOLIO"); expect(current.textContent).toContain("有限月效仍在持续");
    const ordinary = (action: WitchKingAction) => action.command.type === "RETURN" && action.command.method === "ORDINARY";
    const ability = (action: WitchKingAction) => action.command.type === "RETURN" && action.command.method === "ABILITY";
    expect(buttonFor(value, "RETURN", ordinary).disabled).toBe(false); expect(buttonFor(value, "RETURN", ability).disabled).toBe(true);
    expect(buttonFor(value, "STOP_EFFECT").disabled).toBe(true); expect(buttonFor(value, "CLOSE").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "巫王成长下一步" }).textContent).toContain(findAction(value, "RETURN", ordinary).label);
    expect((screen.getByRole("combobox", { name: "选择当前生活实践" }) as HTMLSelectElement).value).toBe("moon-return");
    await userEvent.click(buttonFor(value, "RETURN", ordinary)); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", method: "ORDINARY" });
    expect(s.witchKing.life.practice.location).toBe("END"); expect(s.witchKing.life.practice.folio.location).toBe("END");
    apply(s, { type: "RETURN", method: "ORDINARY" }); const returned = projectWitchKing(s);
    rerender(<WitchKingPanel witchKing={returned} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "本人和原手册的真实位置" }).textContent).toContain("原路线起点");
    expect(buttonFor(returned, "STOP_EFFECT").disabled).toBe(false); expect(buttonFor(returned, "CLOSE").disabled).toBe(true);
    await userEvent.click(buttonFor(returned, "STOP_EFFECT")); expect(onCommand).toHaveBeenLastCalledWith({ type: "STOP_EFFECT", caseId: "moon-return" });
    expect(s.witchKing.life.practice.field).toBe("MOON");
  });

  it("keeps a failed moonlight return at the real endpoint and still offers ordinary return", () => {
    const s = beforeMoon(); beginCase(s, "moon-return"); apply(s, { type: "RETURN", method: "ABILITY" }, 100);
    const { value } = panel(s);
    expect(s.witchKing.life.practice.location).toBe("END"); expect(s.witchKing.life.practice.returns).toBe(0);
    expect(buttonFor(value, "RETURN", action => action.command.type === "RETURN" && action.command.method === "ABILITY").disabled).toBe(true);
    expect(buttonFor(value, "RETURN", action => action.command.type === "RETURN" && action.command.method === "ORDINARY").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "本人和原手册的真实位置" }).textContent).toContain("实际返程 0 次");
  });

  it("keeps optional conflict on the actual adult and original club and allows zero-action peaceful departure", async () => {
    const s = promoted(); apply(s, { type: "ENCOUNTER_TALK" }); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand } = panel(s);
    const encounter = screen.getByRole("region", { name: "巫王可选原院冲突" });
    for (const text of ["多里安 · 42岁 · WK4-DORIAN", "WK4-DORIAN-CLUB", "不自动抵消死亡"])
      expect(encounter.textContent).toContain(text);
    expect(buttonFor(value, "ENCOUNTER_FIGHT").disabled).toBe(true);
    await userEvent.click(buttonFor(value, "LEAVE_ENCOUNTER")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_ENCOUNTER" });
    expect(s.witchKing.encounter.status).toBe("READY"); expect(s.witchKing.life.papers).toEqual([]);
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("blocks public actions while %s without inventing a panel retry", (condition) => {
    const s = ritual(true, false), value = projectWitchKing(s), onCommand = vi.fn();
    render(<WitchKingPanel witchKing={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "CHECK_PREPARATION")); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });

  it("preserves the old original full-moon ritual, body movements, bottles and all outcomes as read-only history", () => {
    const s = promoted(), old = projectSliceState(s).crimsonScholar; render(<WitchKingCrimsonScholarHistory crimsonScholar={old} />);
    const history = screen.getByRole("region", { name: "深红学者时期的经历" });
    expect(history.textContent).toContain(`实际去程 ${old.practice!.outboundTrips} 次`);
    expect(history.textContent).toContain(`实际返程 ${old.practice!.returns} 次`);
    expect(history.textContent).toContain(old.bottles[0]!.id); expect(history.textContent).toContain(old.bottles[0]!.status);
    for (const entry of old.cases) { for (const fact of entry.observations) expect(history.textContent).toContain(fact); if (entry.result) expect(history.textContent).toContain(entry.result); }
    for (const fact of old.ritual.history) expect(history.textContent).toContain(fact);
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0);
    expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.crimsonScholar).toEqual(oldCrimsonScholarRun.crimsonScholar);
  });
});

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})),
  };
}
async function enter(s: SliceState) {
  s.character.name = "艾琳"; const state = projectSliceState(s); const api = bridge(state); window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ })); await screen.findByRole("heading", { name: "人物卷宗" });
  // Retain Sid's real surrendered outcome. Dismiss its inherited presentation through the actual UI.
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return { api, state };
}
describe("WitchKing actual SliceApp navigation", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });

  it("opens Moon S5 advancement in the actual WitchKing panel without sending a command", async () => {
    const { api, state } = await enter(taught());
    await userEvent.click(screen.getByRole("button", { name: "查看巫王晋升" }));
    expect(within(screen.getByRole("region", { name: "巫王成长下一步" })).getByRole("heading", { name: state.witchKing.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "巫王晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "深红学者成长下一步" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current S4 growth and the read-only old CrimsonScholar chapter without replaying old actions", async () => {
    const { api, state } = await enter(promoted());
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "巫王成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "巫王成长" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "深红学者经历" }));
    const history = within(screen.getByRole("region", { name: "深红学者时期的经历" }));
    await userEvent.click(history.getByText("深红学者原瓶 · 来源与去向"));
    expect(history.getByText(`原瓶：${state.crimsonScholar.bottles[0]!.id}`)).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "巫王成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "巫王成长" }));
    expect(screen.getByRole("region", { name: "巫王成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
