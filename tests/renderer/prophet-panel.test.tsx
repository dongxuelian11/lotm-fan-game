/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyProphetCommand, createProphetState, projectProphet } from "../../src/domain/prophet/index";
import { applyProphetActivity, validateProphetActivityCommand, type ProphetCaseId } from "../../src/domain/prophet/life";
import { PROPHET_CONSUMPTION_RISK } from "../../src/domain/prophet/content";
import type { ProphetAction, ProphetCommand, ProphetProjection } from "../../src/domain/prophet/types";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { ProphetMysticismMagisterHistory, ProphetPanel } from "../../src/renderer/ProphetPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const oldMagisterRun = JSON.parse(readFileSync("tests/fixtures/mysticism-magister-v01010/natural.json", "utf8")).final;
/** Directed component setup, not a natural replay: preserve original S5 cases, crafts and combat history,
 * then explicitly set a mature test clock/resources and exercise real public domain commands. */
function magister(): SliceState {
  const s = migrateSliceState(structuredClone(oldMagisterRun));
  s.prophet = createProphetState(); s.week = Math.max(s.week, s.mysticismMagister.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28; s.character.coreStats.perception = 28;
  return s;
}
function apply(s: SliceState, command: ProphetCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  if (validateProphetActivityCommand(command)) applyProphetActivity(s, command, context);
  else applyProphetCommand(s, command, context);
}
function taught() { const s = magister(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function ritual(open = true, checked = true) {
  const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "prophet-potion-1" }); apply(s, { type: "BOOK_RITUAL" });
  if (open) { s.week++; apply(s, { type: "BEGIN_RITUAL" }); if (checked) apply(s, { type: "CHECK_PREPARATION", confirmed: true }); }
  return s;
}
function promoted() { const s = ritual(); apply(s, { type: "CONSUME", bottleId: "prophet-potion-1", confirmed: true }); return s; }
function beginCase(s: SliceState, caseId: ProphetCaseId, method: "ABILITY" | "ORDINARY" = "ABILITY", roll = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method }); apply(s, { type: "PERFORM", caseId }, roll);
}
function waitCase(s: SliceState, caseId: ProphetCaseId) {
  const entry = s.prophet.life.cases[caseId];
  if (entry.effectActive) apply(s, { type: "STOP_EFFECT", caseId });
  if (entry.result !== "NONE" && entry.hypothesis === null) apply(s, { type: "INTERPRET", caseId, hypothesis: caseId === "loose-shutter" ? "LOOSE_FASTENER" : caseId === "blue-door" ? "DELAYED_DELIVERY" : "RECENT_CONTACT" });
  apply(s, { type: "CLOSE", caseId });
}
function finishOrdinary(s: SliceState, caseId: "loose-shutter" | "blue-door") {
  beginCase(s, caseId, "ORDINARY");
  if (caseId === "loose-shutter") apply(s, { type: "SECURE_SHUTTER" });
  waitCase(s, caseId); s.week++; apply(s, { type: "VERIFY", caseId });
  const returnPages = projectProphet(s).actions.find(action => action.command.type === "RETURN_PAGES" && action.enabled);
  if (returnPages) apply(s, returnPages.command);
  apply(s, { type: "REPORT", caseId });
}
function beforeDoor() { const s = promoted(); finishOrdinary(s, "loose-shutter"); return s; }
function beforeHelper() { const s = beforeDoor(); finishOrdinary(s, "blue-door"); return s; }
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: ProphetProjection, type: ProphetCommand["type"], predicate: (action: ProphetAction) => boolean = () => true): ProphetAction {
  const action = value.actions.find(entry => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`);
  return action;
}
function buttonFor(value: ProphetProjection, type: ProphetCommand["type"], predicate?: (action: ProphetAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
const forCase = (caseId: ProphetCaseId) => (action: ProphetAction) => "caseId" in action.command && action.command.caseId === caseId;
const forPerson = (personId: string) => (action: ProphetAction) => "personId" in action.command && action.command.personId === personId;
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectProphet(s);
  return { value, onCommand, ...render(<ProphetPanel prophet={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
function updatePanel(s: SliceState, onCommand: (command: ProphetCommand) => void) {
  return <ProphetPanel prophet={projectProphet(s)} resources={resources(s)} busy={false} onCommand={onCommand} />;
}
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Prophet original preparations and independent confirmations", () => {
  it("keeps both the complete formula and ritual unknown and only forwards the original supply command", async () => {
    const s = taught(), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "预言家配方与专业准备边界" });
    expect(boundary.textContent).toContain("成品配方仍未知，原瓶、付费预约与专业准备分别结算，旧仪式不能代替");
    expect(boundary.textContent).toContain("当前自愿且在场的专家主持专业准备；当前渠道不提供完整配方、材料清单或操作步骤");
    expect(boundary.querySelector("p")!.textContent).not.toContain("原著");
    expect(boundary.textContent).toContain("继续秘术导师生活"); expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    expect(screen.queryByRole("button", { name: /调配|直接晋升|恐惧攻击|灵界旅行/ })).toBeNull();
    expect(value.bottles).toHaveLength(3); const work = findAction(value, "POTION_WORK"); await userEvent.click(buttonFor(value, "POTION_WORK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(work.command);
    expect(s.prophet.bottles.every(bottle => bottle.labourSteps === 0 && bottle.status === "SUPPLIER")).toBe(true);
  });

  it("shows the actual adult expert, next-week visit and unused supplier kit without inventing an early window", () => {
    const s = ritual(false), { value } = panel(s);
    const current = screen.getByRole("region", { name: "预言家当前专业准备" });
    for (const text of ["玛莎·维尔", "64岁", "成年外貌", "序列4", "PF4-MARTHA", "PF4-HALL", "PF4-RITUAL-1", "PF4-KIT-1", "原供应方", "尚未耗用"])
      expect(current.textContent).toContain(text);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "BEGIN_RITUAL").disabled).toBe(true);
    expect(buttonFor(value, "CANCEL_RITUAL").disabled).toBe(false);
    expect(value.actions.some(action => action.command.type === "CHECK_PREPARATION")).toBe(false);
  });

  it("reviews the real preparation separately from drinking and restores focus when the player declines", async () => {
    const s = ritual(true, false), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "核对本次专业准备，自由选择是否继续" }));
    const review = screen.getByRole("region", { name: "预言家专业准备的继续确认" });
    expect(review.textContent).toContain("PF4-KIT-1"); expect(review.textContent).toContain("服药还需逐瓶确认");
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "CHECK_PREPARATION"));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.prophet.ritual.visits[0]!.checkedWeek).toBeNull();
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    await userEvent.click(screen.getByRole("button", { name: "确认核对，继续本次专业准备" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CHECK_PREPARATION", confirmed: true });
    expect(s.prophet.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("rechecks current expert consent while reviewing and discards a confirmation when the original visit changes", async () => {
    const s = ritual(true, false), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION")); s.prophet.ritual.expert.willing = false;
    rerender(<ProphetPanel prophet={projectProphet(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前专家的真实状态" }).textContent).toContain("不愿参与当前指导");
    const confirm = screen.getByRole("button", { name: "确认核对，继续本次专业准备" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    apply(s, { type: "END_RITUAL" }); s.prophet.ritual.expert.willing = true; apply(s, { type: "BOOK_RITUAL" }); s.week++;
    apply(s, { type: "BEGIN_RITUAL" }); const next = projectProphet(s);
    rerender(<ProphetPanel prophet={next} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "预言家专业准备的继续确认" })).toBeNull();
    await userEvent.click(buttonFor(next, "CHECK_PREPARATION"));
    expect(screen.getByRole("region", { name: "确认前的当前预言家仪式" }).textContent).toContain("PF4-KIT-2");
    expect(s.prophet.ritual.visits[0]!.kit.status).toBe("SEALED"); expect(s.prophet.ritual.visits[0]!.kit.location).toBe("TABLE");
  });

  it("shows the selected original, current kit, four-tier risks and real resources, then submits drinking only once", async () => {
    const s = ritual(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME"));
    expect(screen.getByRole("region", { name: "预言家服用风险与四档结果" }).textContent).toContain(PROPHET_CONSUMPTION_RISK);
    const review = screen.getByRole("region", { name: "这瓶预言家魔药的服用确认" });
    for (const text of ["prophet-potion-1", "PF4-KIT-1", "成功或失败都会耗用这一原瓶与本次原封装包", "旧包不能复用"])
      expect(review.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    const error = { message: "本次保存失败，请重试原操作。", retryable: true };
    rerender(<ProphetPanel prophet={value} resources={resources(s)} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复预测、耗用原包或服药");
    expect((screen.getByRole("button", { name: "暂不服用，返回原准备室" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶预言家魔药的服用确认" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<ProphetPanel prophet={value} resources={resources(s)} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "prophet-potion-1", confirmed: true });
    expect(s.prophet.bottles[0]!.status).toBe("PLAYER"); expect(s.prophet.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("preserves a failed bottle and consumed kit, and shows a separately paid second kit at its actual supplier", async () => {
    const s = ritual(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "CONSUME"));
    await userEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    apply(s, { type: "CONSUME", bottleId: "prophet-potion-1", confirmed: true }, 100);
    const failedVisit = structuredClone(s.prophet.ritual.visits[0]);
    rerender(<ProphetPanel prophet={projectProphet(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶预言家魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "预言家当前专业准备" }).textContent).toContain("原包已耗尽，不能复用");
    expect(s.progression.sequence).toBe(5); expect(s.prophet.ritual.playerLocation).toBe("OUTSIDE");
    apply(s, { type: "BUY_POTION", bottleId: "prophet-potion-2" }); apply(s, { type: "BOOK_RITUAL" });
    rerender(<ProphetPanel prophet={projectProphet(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    const current = screen.getByRole("region", { name: "预言家当前专业准备" });
    for (const text of ["PF4-KIT-1", "PF4-KIT-2", "原供应方", "原包已耗尽，不能复用"])
      expect(current.textContent).toContain(text);
    expect(s.prophet.ritual.visits[0]).toEqual(failedVisit); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("offers zero-action actual departure even after current expert availability changes, without optimistic movement or refund", async () => {
    const s = ritual(); s.actionsRemaining = 0; s.spirituality = 0; s.prophet.ritual.expert.location = "AWAY";
    const snapshot = structuredClone(s.prophet.ritual), cash = s.cash, { value, onCommand } = panel(s);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "CONSUME").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "预言家成长下一步" }).textContent).toContain(findAction(value, "END_RITUAL").label);
    expect(buttonFor(value, "END_RITUAL").disabled).toBe(false); await userEvent.click(buttonFor(value, "END_RITUAL"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END_RITUAL" }); expect(s.prophet.ritual).toEqual(snapshot); expect(s.cash).toBe(cash);
    expect(screen.getByRole("region", { name: "当前专家的真实状态" }).textContent).toContain("当前不在原厅");
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("blocks all public actions while %s without introducing a retry", (condition) => {
    const s = ritual(true, false), value = projectProphet(s), onCommand = vi.fn();
    render(<ProphetPanel prophet={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "CHECK_PREPARATION")); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });

});

describe("Prophet uncertain images, physical originals and later observations", () => {
  it("keeps the image, locked player hypothesis and independent later fact visibly separate", async () => {
    const s = promoted(); beginCase(s, "loose-shutter");
    const { value, onCommand, rerender } = panel(s);
    expect(screen.getByRole("region", { name: "不确定意象与玩家假设" }).textContent).toContain("木响与散页");
    expect(screen.getByRole("region", { name: "后来的独立现实观察" }).textContent).toContain("尚无后来的独立现实观察");
    expect(buttonFor(value, "CLOSE", forCase("loose-shutter")).disabled).toBe(true);
    const hardGuess = (action: ProphetAction) => action.command.type === "INTERPRET" && action.command.hypothesis === "HARD_DAMAGE";
    await userEvent.click(buttonFor(value, "INTERPRET", hardGuess));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "INTERPRET", caseId: "loose-shutter", hypothesis: "HARD_DAMAGE" });
    expect(s.prophet.life.cases["loose-shutter"].hypothesis).toBeNull();
    apply(s, { type: "INTERPRET", caseId: "loose-shutter", hypothesis: "HARD_DAMAGE" });
    rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "不确定意象与玩家假设" }).textContent).toContain("严重损坏（未证实）");
    expect(screen.getByRole("region", { name: "后来的独立现实观察" }).textContent).not.toContain("后来诺拉实际开窗");
    expect(projectProphet(s).actions.some(action => action.command.type === "INTERPRET")).toBe(false);
  });

  it.each([true, false])("shows changed outcomes only after the real later opening, secured=%s", async (secure) => {
    const s = promoted(); beginCase(s, "loose-shutter");
    apply(s, { type: "INTERPRET", caseId: "loose-shutter", hypothesis: "HARD_DAMAGE" });
    if (secure) apply(s, { type: "SECURE_SHUTTER" });
    waitCase(s, "loose-shutter");
    const { value, onCommand, rerender } = panel(s), recordedWeek = s.week;
    expect(value.life.inside).toBe(false); expect(buttonFor(value, "VERIFY", forCase("loose-shutter")).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("等待期间可以返回普通生活");
    expect((screen.getByRole("combobox", { name: "选择当前生活实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(s.prophet.life.pages.location).toBe("TABLE");
    s.week++; apply(s, { type: "VERIFY", caseId: "loose-shutter" });
    rerender(updatePanel(s, onCommand));
    const facts = screen.getByRole("region", { name: "后来的独立现实观察" });
    expect(facts.textContent).toContain(secure ? "窗稳定，原页仍在桌" : "原页落到一米内地面");
    expect(facts.textContent).toContain(`第${recordedWeek + 1}周`);
    expect(screen.getByRole("region", { name: "不确定意象与玩家假设" }).textContent).toContain("严重损坏（未证实）");
    const originals = screen.getByRole("region", { name: "当前原物与实际去向" });
    expect(originals.textContent).toContain("PF4-SHUTTER"); expect(originals.textContent).toContain("PF4-PAGES");
    expect(originals.textContent).toContain(secure ? "一次用掉" : "诺拉持有、未用");
    if (!secure) {
      s.actionsRemaining = 0; s.spirituality = 0; rerender(updatePanel(s, onCommand));
      expect(buttonFor(projectProphet(s), "RETURN_PAGES").disabled).toBe(false);
      await userEvent.click(buttonFor(projectProphet(s), "RETURN_PAGES"));
      expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_PAGES" });
      expect(s.prophet.life.pages.location).toBe("FLOOR");
      apply(s, { type: "RETURN_PAGES" }); rerender(updatePanel(s, onCommand));
      expect(screen.getByRole("region", { name: "当前原物与实际去向" }).textContent).toContain("实际捡回1次");
    }
    expect(s.prophet.life.shutter.pin).toBe("LOOSE");
  });

  it("forwards ordinary preventive fastening without inventing a repair or an extra strap", async () => {
    const s = promoted(); beginCase(s, "loose-shutter"); s.actionsRemaining = 0; s.spirituality = 0;
    const old = structuredClone(s.prophet.life), { value, onCommand, rerender } = panel(s);
    expect(buttonFor(value, "SECURE_SHUTTER").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "SECURE_SHUTTER"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SECURE_SHUTTER" }); expect(s.prophet.life).toEqual(old);
    apply(s, { type: "SECURE_SHUTTER" }); rerender(updatePanel(s, onCommand));
    const originals = screen.getByRole("region", { name: "当前原物与实际去向" });
    expect(originals.textContent).toContain("一次用掉"); expect(originals.textContent).toContain("原销松动");
    expect(projectProphet(s).actions.some(action => action.command.type === "SECURE_SHUTTER")).toBe(false);
  });

  it("keeps a paid failure, allows zero-action departure and does not manufacture an image", async () => {
    const s = promoted(), before = s.spirituality; beginCase(s, "loose-shutter", "ABILITY", 100);
    s.actionsRemaining = 0; s.spirituality = 0; const { value, onCommand, rerender } = panel(s);
    expect(s.prophet.life.cases["loose-shutter"].result).toBe("NONE");
    expect(value.life.cases.find(entry => entry.id === "loose-shutter")!.forecast).toBeNull();
    expect(screen.getByRole("region", { name: "预言家实际实践结果" }).textContent).toContain("本次记录失败");
    expect(buttonFor(value, "CLOSE", forCase("loose-shutter")).disabled).toBe(false);
    await userEvent.click(buttonFor(value, "CLOSE", forCase("loose-shutter")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "loose-shutter" });
    expect(s.prophet.life.playerLocation).toBe("WORKAREA");
    apply(s, { type: "CLOSE", caseId: "loose-shutter" }); s.actionsRemaining = 20; s.spirituality = before - 4;
    rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectProphet(s), "PREPARE", forCase("loose-shutter")).disabled).toBe(true);
    expect(s.prophet.life.cases["loose-shutter"].status).toBe("OBSERVED"); expect(s.prophet.life.pages.location).toBe("TABLE");
  });

  it("stops only the player's short dream and keeps the parcel at the post until later delivery", async () => {
    const s = beforeDoor(); beginCase(s, "blue-door");
    apply(s, { type: "INTERPRET", caseId: "blue-door", hypothesis: "PERSON_HURT" });
    s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand, rerender } = panel(s);
    expect(screen.getByRole("region", { name: "不确定意象与玩家假设" }).textContent).toContain("蓝门框、迟来的脚步");
    expect(screen.getByRole("region", { name: "当前原物与实际去向" }).textContent).toContain("当前邮局");
    expect(buttonFor(value, "CLOSE", forCase("blue-door")).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "STOP_EFFECT", forCase("blue-door")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STOP_EFFECT", caseId: "blue-door" });
    expect(s.prophet.life.cases["blue-door"].effectActive).toBe(true);
    apply(s, { type: "STOP_EFFECT", caseId: "blue-door" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectProphet(s), "CLOSE", forCase("blue-door")).disabled).toBe(false);
    apply(s, { type: "CLOSE", caseId: "blue-door" });
    expect(s.prophet.life.parcel.handovers).toBe(0); s.week++; s.actionsRemaining = 20;
    apply(s, { type: "VERIFY", caseId: "blue-door" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "当前原物与实际去向" }).textContent).toContain("实际交接2次");
    expect(screen.getByRole("region", { name: "后来的独立现实观察" }).textContent).toContain("没有人员受伤事实");
    expect(screen.getByRole("region", { name: "不确定意象与玩家假设" }).textContent).toContain("可能有人受伤（未证实）");
    expect(s.prophet.life.parcel.id).toBe("PF4-PARCEL"); expect(s.mysticismMagister.practice).toEqual(oldMagisterRun.mysticismMagister.practice);
  });

  it("keeps the ordinary route honest and reports observed facts without ability mastery", async () => {
    const s = promoted(), mastery = { ...s.progression.mastery }, spirituality = s.spirituality;
    finishOrdinary(s, "loose-shutter"); panel(s);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前生活实践" }), "loose-shutter");
    expect(s.progression.mastery).toEqual(mastery); expect(s.spirituality).toBe(spirituality);
    expect(s.progression.acting).toBe(25);
    expect(screen.getByRole("region", { name: "当前预言家生活实践" }).textContent).toContain("普通调查，不增加能力掌握");
    expect(screen.getByRole("region", { name: "不确定意象与玩家假设" }).textContent).toContain("尚无本次能力意象");
    expect(screen.getByRole("region", { name: "后来的独立现实观察" }).textContent).toContain("窗稳定");
  });

  it("reveals a possible helper only through actual meetings and forwards help with current consent", async () => {
    const s = beforeHelper(); beginCase(s, "uncertain-helper"); waitCase(s, "uncertain-helper"); s.week++;
    const { value, onCommand, rerender } = panel(s);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前生活实践" }), "uncertain-helper");
    const jonas = screen.getByRole("article", { name: "乔纳斯·佩尔的实际会面" });
    expect(jonas.textContent).toContain("尚未在本案实际会面"); expect(jonas.textContent).not.toContain("退休木匠");
    expect(screen.getByRole("region", { name: "当前原物与实际去向" }).textContent).not.toContain("PF4-PLIERS");
    await userEvent.click(buttonFor(value, "MEET_HELPER", forPerson("PF4-NORA")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "MEET_HELPER", personId: "PF4-NORA" });
    expect(s.prophet.life.people["PF4-NORA"].metWeek).toBeNull();
    apply(s, { type: "MEET_HELPER", personId: "PF4-NORA" }); apply(s, { type: "ASK_HELP", personId: "PF4-NORA" });
    rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("article", { name: "诺拉·海斯的实际会面" }).textContent).toContain("没有修销手艺");
    expect(s.prophet.life.shutter.pin).toBe("LOOSE");
    apply(s, { type: "MEET_HELPER", personId: "PF4-JONAS" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("article", { name: "乔纳斯·佩尔的实际会面" }).textContent).toContain("退休木匠");
    expect(screen.getByRole("region", { name: "当前原物与实际去向" }).textContent).toContain("PF4-PLIERS");
    s.prophet.life.people["PF4-JONAS"].willing = false; rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectProphet(s), "ASK_HELP", forPerson("PF4-JONAS")).disabled).toBe(true);
    expect(screen.getByRole("article", { name: "乔纳斯·佩尔的实际会面" }).textContent).toContain("不愿参与这次交流");
    s.prophet.life.people["PF4-JONAS"].willing = true; s.actionsRemaining = 0; rerender(updatePanel(s, onCommand));
    await userEvent.click(buttonFor(projectProphet(s), "ASK_HELP", forPerson("PF4-JONAS")));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "ASK_HELP", personId: "PF4-JONAS" }); expect(s.prophet.life.shutter.pin).toBe("LOOSE");
    apply(s, { type: "ASK_HELP", personId: "PF4-JONAS" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "当前原物与实际去向" }).textContent).toContain("实际修销1次");
    expect(screen.getByRole("region", { name: "后来的独立现实观察" }).textContent).toContain("尚无后来的独立现实观察");
    s.actionsRemaining = 20; apply(s, { type: "VERIFY", caseId: "uncertain-helper" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "后来的独立现实观察" }).textContent).toContain("本人又实际复查为SOUND");
  });

  it("shows the original ordinary opponent and forwards peaceful zero-action departure", async () => {
    const s = promoted(); apply(s, { type: "ENCOUNTER_TALK" }); s.actionsRemaining = 0; s.spirituality = 0;
    const old = structuredClone(s.prophet.encounter), { value, onCommand } = panel(s);
    const encounter = screen.getByRole("region", { name: "预言家可选原院冲突" });
    expect(encounter.textContent).toContain("哈罗德·布伦特 · 46岁 · PF4-HAROLD");
    expect(encounter.textContent).toContain("PF4-HAROLD-CLUB"); expect(encounter.textContent).toContain("不追击");
    expect(buttonFor(value, "ENCOUNTER_FIGHT").disabled).toBe(true);
    expect(buttonFor(value, "LEAVE_ENCOUNTER").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "LEAVE_ENCOUNTER"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_ENCOUNTER" }); expect(s.prophet.encounter).toEqual(old);
  });

  it("keeps old FLASH originals and inherited paid production distinct from advancement gifts", async () => {
    const s = promoted(), originals = structuredClone(s.mysticismMagister.crafts), { value, onCommand } = panel(s);
    await userEvent.click(screen.getByText("原闪光签库存与继承制作"));
    const inventory = screen.getByRole("region", { name: "同一原闪光签的当前库存" });
    for (const craft of value.life.crafts) expect(inventory.textContent).toContain(craft.id);
    expect(inventory.textContent).toContain("MM5-FLASH-3"); expect(inventory.textContent).toContain("160便士");
    await userEvent.click(buttonFor(value, "MAKE_FLASH"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "MAKE_FLASH" }); expect(s.mysticismMagister.crafts).toEqual(originals);
    expect(originals).toEqual(oldMagisterRun.mysticismMagister.crafts);
  });

  it("keeps original S5 cases, token, crafts and bottles read-only at their historical acting snapshot", () => {
    const s = promoted(), old = projectSliceState(s).mysticismMagister;
    render(<ProphetMysticismMagisterHistory mysticismMagister={old} />);
    const history = screen.getByRole("region", { name: "秘术导师时期的经历" });
    expect(history.textContent).toContain("晋升时秘术导师扮演进度 100"); expect(s.progression.acting).toBe(0);
    expect(history.textContent).toContain(old.practice!.token); expect(history.textContent).toContain(old.practice!.dream);
    for (const craft of old.crafts) { expect(history.textContent).toContain(craft.id); expect(history.textContent).toContain(craft.source); expect(history.textContent).toContain(craft.status); }
    for (const entry of old.cases) { for (const fact of entry.observations) expect(history.textContent).toContain(fact); if (entry.result) expect(history.textContent).toContain(entry.result); }
    expect(history.textContent).toContain(old.bottles[0]!.id);
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.mysticismMagister).toEqual(oldMagisterRun.mysticismMagister);
  });
});

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})),
  };
}
async function enter(s: SliceState) {
  s.character.name = "艾琳"; const state = projectSliceState(s), api = bridge(state); window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ })); await screen.findByRole("heading", { name: "人物卷宗" });
  // Rowan's original surrendered outcome stays in history; dismiss only its inherited presentation via the actual UI.
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return { api, state };
}
describe("Prophet actual SliceApp navigation using the original S5 history", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });

  it("opens the real S5 advancement page without silently preparing or consuming anything", async () => {
    const saved = taught(), originalInjuries = structuredClone(saved.injuries);
    expect(originalInjuries).toEqual(oldMagisterRun.injuries);
    expect(originalInjuries.filter(injury => injury.severity === "HEAVY" && injury.treatedRevision === null)).toHaveLength(1);
    const { api, state } = await enter(saved), before = structuredClone(state), savedBefore = structuredClone(saved);
    expect(state.recovery).toMatchObject({ needsAttention: true, healthFullWithInjuries: true, locked: false });
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "健康已满，先处理仍在的伤势" })).toBeTruthy();
    expect((within(guide).getByRole("button", { name: "查看普通诊疗点" }) as HTMLButtonElement).disabled).toBe(false);
    // Keep the original wound and the recovery-first guide; the explicit advancement tab remains discoverable.
    await userEvent.click(screen.getByRole("button", { name: "非凡成长" }));
    const promotion = within(screen.getByRole("group", { name: "选择成长卷宗" })).getByRole("button", { name: "预言家晋升" }) as HTMLButtonElement;
    expect(promotion.disabled).toBe(false); await userEvent.click(promotion);
    expect(within(screen.getByRole("region", { name: "预言家成长下一步" })).getByRole("heading", { name: state.prophet.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "预言家晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "秘术导师成长下一步" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
    expect(saved.injuries).toEqual(originalInjuries); expect(saved).toEqual(savedBefore); expect(state).toEqual(before);
  });

  it("opens current S4 growth and folded original S5 history, then returns to growth", async () => {
    const { api, state } = await enter(promoted()); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "预言家成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "预言家成长" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "秘术导师经历" }));
    const history = within(screen.getByRole("region", { name: "秘术导师时期的经历" }));
    await userEvent.click(history.getByText("秘术导师原瓶 · 来源与去向"));
    expect(history.getByText(`原瓶：${state.mysticismMagister.bottles[0]!.id}`)).toBeTruthy();
    await userEvent.click(history.getByText("秘术导师原闪光签 · 来源与实际去向"));
    expect(history.getByRole("heading", { name: "MM5-FLASH-3" })).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "预言家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "预言家成长" })); expect(screen.getByRole("region", { name: "预言家成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps the real active dream on current S4 controls and exposes its zero-action stop", async () => {
    const s = beforeDoor(); beginCase(s, "blue-door"); const { api, state } = await enter(s);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "预言家成长下一步" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "当前原物与实际去向" }).textContent).toContain("PF4-PARCEL");
    expect((screen.getByRole("button", { name: "秘术导师经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(buttonFor(state.prophet, "STOP_EFFECT", forCase("blue-door")).disabled).toBe(false);
    await userEvent.click(buttonFor(state.prophet, "STOP_EFFECT", forCase("blue-door")));
    expect(api.submitIntent).toHaveBeenCalledWith(expect.objectContaining({ payload: { type: "PROPHET", command: { type: "STOP_EFFECT", caseId: "blue-door" } } }));
    expect(s.prophet.life.cases["blue-door"].effectActive).toBe(true);
  });

  it("lets a waiting prediction return to ordinary life and submit rest without forging a later fact", async () => {
    const s = promoted(); beginCase(s, "loose-shutter"); waitCase(s, "loose-shutter");
    const { api, state } = await enter(s); expect(state.canAct).toBe(true); expect(state.prophet.insideCase).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(within(screen.getByRole("region", { name: "当前预言家生活实践" })).getByRole("status").textContent).toContain("等待期间可以返回普通生活");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const rest = screen.getByRole("button", { name: "休养，1行动，恢复身心" }) as HTMLButtonElement;
    expect(rest.disabled).toBe(false); await userEvent.click(rest);
    expect(api.submitIntent).toHaveBeenCalledWith(expect.objectContaining({ payload: { type: "ACTION", action: "REST" } }));
    expect(s.prophet.life.cases["loose-shutter"].actual).toBe("NONE"); expect(s.prophet.life.pages.location).toBe("TABLE");
  });
});
