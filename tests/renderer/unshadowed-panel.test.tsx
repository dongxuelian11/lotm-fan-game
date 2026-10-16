/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyUnshadowedCommand, projectUnshadowed } from "../../src/domain/unshadowed/index";
import { applyUnshadowedActivity, validateUnshadowedActivityCommand, type UnshadowedCaseId } from "../../src/domain/unshadowed/life";
import { UNSHADOWED_CONSUMPTION_RISK, UNSHADOWED_FORMULA } from "../../src/domain/unshadowed/content";
import type { UnshadowedAction, UnshadowedCommand, UnshadowedProjection } from "../../src/domain/unshadowed/types";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { UnshadowedPanel, UnshadowedPriestOfLightHistory } from "../../src/renderer/UnshadowedPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const oldRun = JSON.parse(readFileSync("tests/fixtures/priest-of-light-v01030/natural.json", "utf8")).final;
/** Directed component-only setup isolates resources and the clock. Original S5 facts are
 * preserved. The actual SliceApp navigation tests below do not use or patch this setup. */
function priest(): SliceState {
  const s = migrateSliceState(structuredClone(oldRun));
  s.week = Math.max(s.week, s.priestOfLight.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.physique = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function apply(s: SliceState, command: UnshadowedCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  if (validateUnshadowedActivityCommand(command)) applyUnshadowedActivity(s, command, context);
  else applyUnshadowedCommand(s, command, context);
}
function taught() { const s = priest(); apply(s, { type: "LEARN_FORMULA" }); return s; }
function brew(s: SliceState, batchId = "unshadowed-batch-1") {
  apply(s, { type: "BUY_MATERIALS", batchId }); apply(s, { type: "BREW", batchId });
}
function booked() { const s = taught(); brew(s); apply(s, { type: "BOOK_RITUAL" }); return s; }
function entered() { const s = booked(); s.week++; apply(s, { type: "BEGIN_RITUAL" }); return s; }
function declared() { const s = entered(); apply(s, { type: "DECLARE_EMOTION", subjectId: "UD4-MIRIEL", confirmed: true }); return s; }
function separated() { const s = declared(); apply(s, { type: "SEPARATE_EMOTION", confirmed: true }); return s; }
function drank(roll = 1) { const s = separated(); apply(s, { type: "CONSUME", bottleId: s.unshadowed.bottles[0]!.id, confirmed: true }, roll); return s; }
function promoted(leave = true) { const s = drank(); apply(s, { type: "RETURN_EMOTION" }); if (leave) apply(s, { type: "END_RITUAL" }); return s; }
function beginCase(s: SliceState, caseId: UnshadowedCaseId, method: "ABILITY" | "ORDINARY" = "ABILITY", roll = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method });
  if (caseId === "warned-sunflare" && method === "ABILITY") apply(s, { type: "MOVE_ALLY" });
  apply(s, { type: "PERFORM", caseId }, roll);
}
function finishCase(s: SliceState, caseId: UnshadowedCaseId) {
  if (caseId === "open-domain" && s.unshadowed.life.cases[caseId].effectActive) { apply(s, { type: "STEP_OUT" }); apply(s, { type: "STEP_IN" }); }
  if (s.unshadowed.life.cases[caseId].effectActive) apply(s, { type: "STOP_EFFECT", caseId });
  if (s.unshadowed.life.tile.heat === "HOT") apply(s, { type: "COOL_TARGET" });
  if (s.unshadowed.life.ally.location === "OUTSIDE") apply(s, { type: "RETURN_ALLY" });
  apply(s, { type: "CLOSE", caseId }); apply(s, { type: "REPORT", caseId });
}
function throughDomain() { const s = promoted(); beginCase(s, "open-domain"); finishCase(s, "open-domain"); return s; }
function throughPurification() { const s = throughDomain(); beginCase(s, "finite-purification"); finishCase(s, "finite-purification"); return s; }
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: UnshadowedProjection, type: UnshadowedCommand["type"], predicate: (action: UnshadowedAction) => boolean = () => true) {
  const action = value.actions.find(entry => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`); return action;
}
function buttonFor(value: UnshadowedProjection, type: UnshadowedCommand["type"], predicate?: (action: UnshadowedAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
const forCase = (caseId: UnshadowedCaseId) => (action: UnshadowedAction) => "caseId" in action.command && action.command.caseId === caseId;
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectUnshadowed(s);
  return { value, onCommand, ...render(<UnshadowedPanel unshadowed={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
function updatePanel(s: SliceState, onCommand: (command: UnshadowedCommand) => void) {
  return <UnshadowedPanel unshadowed={projectUnshadowed(s)} resources={resources(s)} busy={false} onCommand={onCommand} />;
}
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Unshadowed original materials and independent emotion ritual choices", () => {
  it("shows all six actual ingredients and only describes unavailable god blood as an alternative", async () => {
    const s = taught(), before = structuredClone(s.unshadowed), { value, onCommand } = panel(s);
    const formula = screen.getByRole("region", { name: "无暗者配方与已知替代" });
    expect(value.formula).toHaveLength(6);
    for (const material of UNSHADOWED_FORMULA) expect(formula.textContent).toContain(material.name);
    expect(formula.textContent).toContain("太阳神血液1滴"); expect(formula.textContent).toContain("没有神血库存或购买入口");
    const batches = screen.getByRole("region", { name: "无暗者原批次与材料去向" });
    for (const batch of value.batches) {
      expect(batch.materials).toHaveLength(6);
      for (const material of batch.materials) { expect(batches.textContent).toContain(material.id); expect(batches.textContent).toContain(material.source); }
    }
    expect(value.batches.flatMap(batch => batch.materials).some(material => material.name === "太阳神血液")).toBe(false);
    await userEvent.click(buttonFor(value, "POTION_WORK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "POTION_WORK").command); expect(s.unshadowed).toEqual(before);
    expect(screen.queryByRole("button", { name: /直接晋升|购买神血/ })).toBeNull();
  });

  it("shows paid original staff, carrier and kit while a next-week appointment still blocks entry", () => {
    const s = booked(), { value } = panel(s), facts = screen.getByRole("region", { name: "无暗者当前仪式" });
    for (const text of ["米瑞尔·赫斯", "52岁", "UD4-MIRIEL", "西莉娅·罗", "64岁", "UD4-CELIA", "UD4-HALL", "UD4-VESSEL-1", "UD4-KIT-1", "320便士", "原供应方保管"])
      expect(facts.textContent).toContain(text);
    expect(buttonFor(value, "BEGIN_RITUAL").disabled).toBe(true); expect(value.ritual.windowOpen).toBe(false);
    expect(s.unshadowed.ritual.visits[0]!.anchor).toBeNull(); expect(s.priestOfLight).toEqual(oldRun.priestOfLight);
  });

  it("requires the player's own strongest-emotion declaration, restores focus and never separates on cancel", async () => {
    const s = entered(), before = structuredClone(s.unshadowed.ritual), { value, onCommand } = panel(s);
    const trigger = buttonFor(value, "DECLARE_EMOTION"); await userEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "由你决定本角色此刻最珍重的情感" }));
    const review = screen.getByRole("region", { name: "最强烈情感的独立声明" });
    for (const text of ["不会从旧经历自动判定", "不符合时请暂不声明", "继续作为光之祭司生活", "bard:original-guidance", "priest-of-light:promotion"])
      expect(review.textContent).toContain(text);
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "DECLARE_EMOTION"));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.unshadowed.ritual).toEqual(before);
    await userEvent.click(buttonFor(value, "DECLARE_EMOTION"));
    const confirm = screen.getByRole("button", { name: "确认这是本角色此刻最强烈、最不愿舍弃的情感" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "DECLARE_EMOTION", subjectId: "UD4-MIRIEL", confirmed: true });
    expect(s.unshadowed.ritual.visits[0]!.anchor).toBeNull();
  });

  it("rechecks current consent and discards stale confirmation when the exact original visit changes", async () => {
    const s = entered(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "DECLARE_EMOTION"));
    s.unshadowed.ritual.guide.willing = false; rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "当前原导师与持照专业者" }).textContent).toContain("不愿参与本次安排");
    const confirm = screen.getByRole("button", { name: "确认这是本角色此刻最强烈、最不愿舍弃的情感" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    apply(s, { type: "CANCEL_RITUAL" }); s.unshadowed.ritual.guide.willing = true; s.week++; apply(s, { type: "BOOK_RITUAL" });
    rerender(updatePanel(s, onCommand)); expect(screen.queryByRole("region", { name: "最强烈情感的独立声明" })).toBeNull();
    expect(screen.getByRole("region", { name: "无暗者当前仪式" }).textContent).toContain("UD4-VESSEL-2");
    expect(s.unshadowed.ritual.visits[0]!.anchor).toBeNull();
  });

  it("reviews separation separately from drinking and shows the same emotion actually absent after applying it", async () => {
    const s = declared(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "SEPARATE_EMOTION"));
    const review = screen.getByRole("region", { name: "声明情感分离的独立确认" });
    for (const text of ["UD4-EMOTION-1", "UD4-VESSEL-1", "不是清除全部人性", "不能靠关闭页面恢复", "此次确认不服药"])
      expect(review.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "确认由专业者分离这份声明情感" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SEPARATE_EMOTION", confirmed: true }); expect(s.unshadowed.ritual.visits[0]!.anchor!.felt).toBe(true);
    apply(s, { type: "SEPARATE_EMOTION", confirmed: true }); rerender(updatePanel(s, onCommand));
    const facts = screen.getByRole("region", { name: "UD4-RITUAL-1声明情感的真实状态" });
    expect(facts.textContent).toContain("暂时感受不到这份声明情感"); expect(facts.textContent).toContain("记忆事实仍保留");
    expect(s.unshadowed.bottles[0]!.status).toBe("PREPARED"); expect(buttonFor(projectUnshadowed(s), "CONSUME").disabled).toBe(false);
  });

  it("reviews the actual bottle, retains pending submission through failed saving and prevents a second drink", async () => {
    const s = separated(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "CONSUME"));
    const review = screen.getByRole("region", { name: "这瓶无暗者魔药的服用确认" });
    for (const text of [s.unshadowed.bottles[0]!.id, "UD4-VESSEL-1", "UD4-KIT-1", "服药成功后仍是光之祭司5", "回输不会治疗"])
      expect(review.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "无暗者服用风险与四档结果" }).textContent).toContain(UNSHADOWED_CONSUMPTION_RISK);
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    rerender(<UnshadowedPanel unshadowed={value} resources={resources(s)} busy={false} error={{ message: "原操作保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复分离、服药或回输");
    expect((screen.getByRole("button", { name: "暂不服用，返回现场" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶无暗者魔药的服用确认" })).toBeTruthy();
    rerender(updatePanel(s, onCommand)); fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: s.unshadowed.bottles[0]!.id, confirmed: true });
    expect(s.unshadowed.bottles[0]!.status).toBe("PREPARED"); expect(s.unshadowed.ritual.visits[0]!.phase).toBe("SEPARATED");
  });

  it("shows raw success as S5 until actual return, then keeps departure separate from S4 promotion", async () => {
    const s = drank(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s);
    const facts = () => screen.getByRole("region", { name: "UD4-RITUAL-1原始药效与晋升状态" });
    expect(s.progression.sequence).toBe(5); expect(value.promoted).toBe(false); expect(facts().textContent).toContain("目前仍为光之祭司5");
    expect(buttonFor(value, "RETURN_EMOTION").disabled).toBe(false); await userEvent.click(buttonFor(value, "RETURN_EMOTION"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_EMOTION" }); expect(s.unshadowed.ritual.visits[0]!.anchor!.felt).toBe(false);
    apply(s, { type: "RETURN_EMOTION" }); rerender(updatePanel(s, onCommand));
    expect(s.progression.sequence).toBe(4); expect(facts().textContent).toContain("无暗者4晋升已完成");
    expect(screen.getByRole("region", { name: "UD4-RITUAL-1声明情感的真实状态" }).textContent).toContain("实际回输来源：UD4-VESSEL-1");
    expect(s.unshadowed.ritual.playerLocation).toBe("HALL"); expect(buttonFor(projectUnshadowed(s), "END_RITUAL").disabled).toBe(false);
    expect(s.unshadowed.ritual.visits[0]!.vessel.status).toBe("EMPTY"); expect(s.spirituality).toBe(100);
  });

  it("retains failed costs and absent emotion until a real return without awarding promotion", () => {
    const s = drank(100), loss = { health: s.health, mind: s.mind, cash: s.cash, pollution: s.seer.pollution }, { onCommand, rerender } = panel(s);
    expect(screen.getByRole("region", { name: "UD4-RITUAL-1原始药效与晋升状态" }).textContent).toContain("失败也不能跳过回输");
    expect(s.unshadowed.ritual.visits[0]!.anchor!.felt).toBe(false);
    apply(s, { type: "RETURN_EMOTION" }); rerender(updatePanel(s, onCommand));
    expect(s.progression.sequence).toBe(5); expect(s.progression.acting).toBe(100);
    expect(screen.getByRole("region", { name: "UD4-RITUAL-1原始药效与晋升状态" }).textContent).toContain("原始药效未完成晋升");
    expect({ health: s.health, mind: s.mind, cash: s.cash, pollution: s.seer.pollution }).toEqual(loss); expect(onCommand).not.toHaveBeenCalled();
  });

  it("makes abandoning a raw success explicit and preserves the actual old carrier on a later booking", async () => {
    const s = drank(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "CANCEL_RITUAL"));
    const review = screen.getByRole("region", { name: "放弃本次无暗者晋升的确认" });
    for (const text of ["即使原始药效成功也仍为光之祭司5", "先从本次同一原载体回输", "不退款或重抽"]) expect(review.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: "确认按当前原状态回输并退出，不再晋升" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CANCEL_RITUAL" }); expect(s.unshadowed.ritual.playerLocation).toBe("HALL");
    apply(s, { type: "CANCEL_RITUAL" }); const old = structuredClone(s.unshadowed.ritual.visits[0]);
    brew(s, "unshadowed-batch-2"); s.week++; apply(s, { type: "BOOK_RITUAL" }); rerender(updatePanel(s, onCommand));
    const facts = screen.getByRole("region", { name: "无暗者当前仪式" });
    for (const text of ["UD4-VESSEL-1", "UD4-VESSEL-2", "UD4-KIT-1", "UD4-KIT-2", "本人已明确放弃本次晋升"]) expect(facts.textContent).toContain(text);
    expect(s.progression.sequence).toBe(5); expect(s.unshadowed.ritual.visits[0]).toEqual(old); expect(old!.anchor!.returnedFromVesselId).toBe("UD4-VESSEL-1");
  });

  it.each(["missing-carrier", "declining-guide"] as const)("keeps the actual absence visible and does not invent restoration when %s", condition => {
    const s = drank();
    if (condition === "missing-carrier") s.unshadowed.ritual.visits[0]!.vessel.location = "MISSING";
    else s.unshadowed.ritual.guide.willing = false;
    const { value, onCommand } = panel(s);
    expect(buttonFor(value, "RETURN_EMOTION").disabled).toBe(true); expect(buttonFor(value, "CANCEL_RITUAL").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "UD4-RITUAL-1声明情感的真实状态" }).textContent).toContain("仍离身");
    fireEvent.click(buttonFor(value, "RETURN_EMOTION")); fireEvent.click(buttonFor(value, "CANCEL_RITUAL"));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.unshadowed.ritual.visits[0]!.anchor!.felt).toBe(false); expect(s.progression.sequence).toBe(5);
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("blocks all commands during %s without a made-up local retry", condition => {
    const s = entered(), value = projectUnshadowed(s), onCommand = vi.fn();
    render(<UnshadowedPanel unshadowed={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"} readOnly={condition === "readOnly"}
      error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "DECLARE_EMOTION")); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });
});

describe("Unshadowed finite originals, ordinary exits and real consequences", () => {
  it("shows a real ordinary exit while the domain is active, and never moves the player by viewing it", async () => {
    const s = promoted(); beginCase(s, "open-domain"); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand, rerender } = panel(s), facts = () => screen.getByRole("region", { name: "无暗者当前原物与实际变化" });
    for (const text of ["UD4-PRACTICE-HALL", "UD4-SCREEN", "UD4-MARK", "没有领域物理墙", "实际走出0次/返回0次"]) expect(facts().textContent).toContain(text);
    expect(buttonFor(value, "CLOSE", forCase("open-domain")).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "STEP_OUT")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STEP_OUT" });
    expect(s.unshadowed.life.playerLocation).toBe("ROOM"); expect(s.unshadowed.life.room.illuminated).toBe(true);
    apply(s, { type: "STEP_OUT" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "当前同伴、普通出口与有限效果" }).textContent).toContain("沿普通门走到室外");
    expect(facts().textContent).toContain("当前照明ON"); expect(buttonFor(projectUnshadowed(s), "STEP_IN").disabled).toBe(false);
    apply(s, { type: "STEP_IN" }); apply(s, { type: "STOP_EFFECT", caseId: "open-domain" }); rerender(updatePanel(s, onCommand));
    expect(facts().textContent).toContain("实际走出1次/返回1次"); expect(facts().textContent).toContain("当前照明OFF");
    expect(buttonFor(projectUnshadowed(s), "CLOSE", forCase("open-domain")).disabled).toBe(false);
    expect((screen.getByRole("combobox", { name: "选择当前生活实践" }) as HTMLSelectElement).disabled).toBe(true);
  });

  it("shows actual ordinary containment without claiming purification or granting mastery", () => {
    const s = throughDomain(), before = structuredClone(s.progression.mastery); beginCase(s, "finite-purification", "ORDINARY");
    const { onCommand, rerender } = panel(s), facts = () => screen.getByRole("region", { name: "无暗者当前原物与实际变化" });
    for (const text of ["UD4-CHARACTERISTIC-1", "已故普通失控成年歌颂者9", "精神污染3G", "3→3", "CONTAINED", "原数量1", "所有者ARCHIVE"])
      expect(facts().textContent).toContain(text);
    expect(screen.getByRole("region", { name: "无暗者实际实践结果" }).textContent).toContain("污染没有被清除");
    finishCase(s, "finite-purification"); rerender(updatePanel(s, onCommand));
    expect(facts().textContent).toContain("精神污染3"); expect(s.progression.mastery).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
    expect(s.unshadowed.bottles).toHaveLength(1); expect(s.unshadowed.life.characteristic.owner).toBe("ARCHIVE");
  });

  it("shows finite successful purification on the same original fragment and preserves it after stopping", () => {
    const s = throughDomain(); beginCase(s, "finite-purification"); const { onCommand, rerender } = panel(s);
    const facts = () => screen.getByRole("region", { name: "无暗者当前原物与实际变化" });
    expect(facts().textContent).toContain("本次3→0"); expect(facts().textContent).toContain("无神性污染净化保证或免费抽取");
    apply(s, { type: "STOP_EFFECT", caseId: "finite-purification" }); rerender(updatePanel(s, onCommand));
    expect(facts().textContent).toContain("本次3→0"); expect(facts().textContent).toContain("原数量1 · 所有者ARCHIVE");
    expect(s.unshadowed.life.characteristic.contamination).toBe(0); expect(onCommand).not.toHaveBeenCalled();
  });

  it("requires actual ally movement before sunflare and separate stop, cooling and return commands", async () => {
    const s = throughPurification(); apply(s, { type: "OBSERVE", caseId: "warned-sunflare" }); apply(s, { type: "PREPARE", caseId: "warned-sunflare", method: "ABILITY" });
    const { value, onCommand, rerender } = panel(s), originals = () => screen.getByRole("region", { name: "无暗者当前原物与实际变化" });
    expect(screen.getByRole("region", { name: "当前同伴、普通出口与有限效果" }).textContent).toContain("奥尔登·弗思 · 41岁 · UD4-ALDEN");
    expect(buttonFor(value, "PERFORM", forCase("warned-sunflare")).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "MOVE_ALLY")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "MOVE_ALLY" }); expect(s.unshadowed.life.ally.location).toBe("LOW");
    apply(s, { type: "MOVE_ALLY" }); apply(s, { type: "PERFORM", caseId: "warned-sunflare" }); s.actionsRemaining = 0; s.spirituality = 0;
    rerender(updatePanel(s, onCommand));
    expect(originals().textContent).toContain("UD4-TILE · 热量HOT · 耀斑焦痕1");
    expect(buttonFor(projectUnshadowed(s), "RETURN_ALLY").disabled).toBe(true); expect(buttonFor(projectUnshadowed(s), "COOL_TARGET").disabled).toBe(true);
    apply(s, { type: "STOP_EFFECT", caseId: "warned-sunflare" }); rerender(updatePanel(s, onCommand));
    expect(originals().textContent).toContain("热量HOT"); expect(buttonFor(projectUnshadowed(s), "COOL_TARGET").disabled).toBe(false);
    expect(buttonFor(projectUnshadowed(s), "CLOSE", forCase("warned-sunflare")).disabled).toBe(true);
    apply(s, { type: "COOL_TARGET" }); rerender(updatePanel(s, onCommand));
    expect(originals().textContent).toContain("热量COLD · 耀斑焦痕1"); expect(originals().textContent).toContain("实际停止后冷却60秒");
    expect(buttonFor(projectUnshadowed(s), "RETURN_ALLY").disabled).toBe(false);
    apply(s, { type: "RETURN_ALLY" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectUnshadowed(s), "CLOSE", forCase("warned-sunflare")).disabled).toBe(false);
    expect(s.unshadowed.life.tile.scorchMarks).toBe(1); expect(s.unshadowed.life.ally.location).toBe("LOW");
  });

  it("respects present consent without auto-moving the ally or granting immunity", () => {
    const s = throughPurification(); apply(s, { type: "OBSERVE", caseId: "warned-sunflare" }); apply(s, { type: "PREPARE", caseId: "warned-sunflare", method: "ABILITY" });
    s.unshadowed.life.ally.willing = false; const { value, onCommand } = panel(s);
    expect(screen.getByRole("region", { name: "当前同伴、普通出口与有限效果" }).textContent).toContain("当前不愿参与");
    expect(buttonFor(value, "MOVE_ALLY").disabled).toBe(true); expect(buttonFor(value, "PERFORM", forCase("warned-sunflare")).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "MOVE_ALLY")); expect(onCommand).not.toHaveBeenCalled(); expect(s.unshadowed.life.ally.location).toBe("LOW");
  });

  it("shows failure without fabricating new heat or marks and keeps the actual paid costs", () => {
    const s = throughPurification(), spirit = s.spirituality; beginCase(s, "warned-sunflare", "ABILITY", 100);
    const { value, onCommand } = panel(s);
    expect(screen.getByRole("region", { name: "无暗者当前原物与实际变化" }).textContent).toContain("热量COLD · 耀斑焦痕0");
    expect(screen.getByRole("region", { name: "无暗者实际实践结果" }).textContent).toContain("尚无合格结果");
    expect(s.spirituality).toBe(spirit - 6); expect(s.unshadowed.life.ally.location).toBe("OUTSIDE");
    expect(buttonFor(value, "RETURN_ALLY").disabled).toBe(false); expect(buttonFor(value, "REPORT", forCase("warned-sunflare")).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows an ordinary opponent, actual original weapon and peaceful exit without promising victory", async () => {
    const s = promoted(); apply(s, { type: "ENCOUNTER_TALK" }); s.actionsRemaining = 0; s.spirituality = 0;
    const before = structuredClone(s.unshadowed.encounter), { value, onCommand } = panel(s);
    const encounter = screen.getByRole("region", { name: "无暗者可选原庭院冲突" });
    for (const text of ["埃德蒙·塔尔 · 47岁 · UD4-EDMUND", "UD4-EDMUND-CLUB", "不追击", "没有自动邪异易伤", "不保证能够战胜"]) expect(encounter.textContent).toContain(text);
    expect(buttonFor(value, "ENCOUNTER_FIGHT").disabled).toBe(true); expect(buttonFor(value, "LEAVE_ENCOUNTER").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "LEAVE_ENCOUNTER")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_ENCOUNTER" });
    expect(s.unshadowed.encounter).toEqual(before);
  });

  it("keeps every original S5 bottle, ice journey, lamp and case report as noninteractive history", () => {
    const s = promoted(), old = projectSliceState(s).priestOfLight; render(<UnshadowedPriestOfLightHistory priestOfLight={old} />);
    const history = screen.getByRole("region", { name: "光之祭司时期的经历" });
    expect(history.textContent).toContain("晋升时光之祭司扮演进度 100"); expect(s.progression.acting).toBe(0);
    expect(history.textContent).toContain("实际赴仪式 4 次"); expect(history.textContent).toContain(old.ritual.summary);
    for (const bottle of old.bottles) { expect(history.textContent).toContain(bottle.id); expect(history.textContent).toContain(bottle.source); expect(history.textContent).toContain(bottle.status); }
    for (const entry of old.cases) { for (const fact of entry.observations) expect(history.textContent).toContain(fact); if (entry.result) expect(history.textContent).toContain(entry.result); }
    for (const fact of old.practice!.history) expect(history.textContent).toContain(fact);
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.priestOfLight).toEqual(oldRun.priestOfLight);
  });
});

function bridge(state: SliceProjection): SliceBridge {
  return { getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state,
    runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})) };
}
/** Exact migrated snapshots, including the original old S5 battle reveal. Dismiss that
 * real modal through its normal button; never patch resources, event, identity or combat. */
async function enter(state: SliceProjection) {
  const api = bridge(state); window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return api;
}
function natural(key: "promoted" | "practiced") {
  const capture = JSON.parse(readFileSync("tests/fixtures/unshadowed-v01250/natural.json", "utf8"));
  return projectSliceState(migrateSliceState(structuredClone(capture[key])));
}
describe("Unshadowed actual SliceApp navigation", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
  it("opens S5 advancement from the exact original Priest of Light capture", async () => {
    const s = migrateSliceState(structuredClone(oldRun)), before = structuredClone(s), state = projectSliceState(s), api = await enter(state);
    await userEvent.click(screen.getByRole("button", { name: "查看无暗者晋升" }));
    expect(screen.getByRole("region", { name: "无暗者成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "无暗者晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(api.submitIntent).not.toHaveBeenCalled(); expect(s).toEqual(before); expect(s.priestOfLight).toEqual(oldRun.priestOfLight);
  });
  it("opens current S4, reads original S5 history and returns without replaying any old action", async () => {
    const state = natural("practiced"), api = await enter(state); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "无暗者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "光之祭司经历" }));
    const history = within(screen.getByRole("region", { name: "光之祭司时期的经历" }));
    await userEvent.click(history.getByText("光之祭司原瓶 · 来源与去向"));
    expect(history.getByText(`原瓶：${state.priestOfLight.bottles[0]!.id}`)).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "无暗者成长" })); expect(screen.getByRole("region", { name: "无暗者成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("keeps the newly promoted original hall locked until actual departure", async () => {
    const state = natural("promoted"), api = await enter(state);
    expect(state.unshadowed.ritual.playerLocation).toBe("HALL");
    expect(await screen.findByRole("region", { name: "无暗者当前仪式" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "光之祭司经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(buttonFor(state.unshadowed, "END_RITUAL"));
    expect(api.submitIntent).toHaveBeenCalledWith(expect.objectContaining({ payload: { type: "UNSHADOWED", command: { type: "END_RITUAL" } } }));
    expect(state.unshadowed.ritual.playerLocation).toBe("HALL");
  });
  it("allows ordinary rest after natural original effects, people and objects are fully closed", async () => {
    const state = natural("practiced"), api = await enter(state); expect(state.unshadowed.insideCase).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ })); await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const rest = screen.getByRole("button", { name: "休养，1行动，恢复身心" }) as HTMLButtonElement; expect(rest.disabled).toBe(false);
    await userEvent.click(rest); expect(api.submitIntent).toHaveBeenCalledWith(expect.objectContaining({ payload: { type: "ACTION", action: "REST" } }));
  });
});
