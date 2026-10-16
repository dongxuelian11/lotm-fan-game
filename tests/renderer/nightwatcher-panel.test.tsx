/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyNightwatcherCommand, createNightwatcherState, projectNightwatcher } from "../../src/domain/nightwatcher/index";
import { applyNightwatcherActivity, validateNightwatcherActivityCommand, type NightwatcherCaseId } from "../../src/domain/nightwatcher/life";
import { NIGHTWATCHER_CONSUMPTION_RISK } from "../../src/domain/nightwatcher/content";
import type { NightwatcherAction, NightwatcherCommand, NightwatcherProjection } from "../../src/domain/nightwatcher/types";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { NightwatcherSpiritWarlockHistory, NightwatcherPanel } from "../../src/renderer/NightwatcherPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const oldSpiritWarlockRun = JSON.parse(readFileSync("tests/fixtures/spirit-warlock-v01000/natural.json", "utf8")).final;
/** Component fixtures preserve the original saved history, then use explicit clocks/resources and real commands.
 * They are not a natural-run claim and never rewrite the original fixture or any previous outcome. */
function warlock(): SliceState {
  const s = migrateSliceState(structuredClone(oldSpiritWarlockRun));
  s.nightwatcher = createNightwatcherState(); s.week = Math.max(s.week, s.spiritWarlock.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28; s.character.coreStats.perception = 28;
  return s;
}
function apply(s: SliceState, command: NightwatcherCommand, roll: number | number[] = 1) {
  const rolls = typeof roll === "number" ? [roll] : [...roll];
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: rolls.length > 1 ? rolls.shift()! : rolls[0]! })) };
  if (validateNightwatcherActivityCommand(command)) applyNightwatcherActivity(s, command, context);
  else applyNightwatcherCommand(s, command, context);
}
function taught() { const s = warlock(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function ritual(open = true, checked = true) {
  const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "nightwatcher-potion-1" }); apply(s, { type: "BOOK_RITUAL" });
  if (open) { s.week++; apply(s, { type: "BEGIN_RITUAL" }); if (checked) apply(s, { type: "CHECK_PREPARATION", confirmed: true }); }
  return s;
}
function promoted() { const s = ritual(); apply(s, { type: "CONSUME", bottleId: "nightwatcher-potion-1", confirmed: true }); return s; }
function beginCase(s: SliceState, caseId: NightwatcherCaseId, method: "ABILITY" | "ORDINARY" = "ABILITY", roll: number | number[] = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method }); apply(s, { type: "PERFORM", caseId }, roll);
}
function closeCase(s: SliceState, caseId: NightwatcherCaseId, report = true) {
  if (s.nightwatcher.life.cases[caseId].effectActive) apply(s, { type: "STOP_EFFECT", caseId });
  if (s.spiritWarlock.companion.status === "DEPLOYED") apply(s, { type: "RECALL_SPIRIT" });
  if (s.nightwatcher.life.cart.location !== "START") apply(s, { type: "RETURN_CART" });
  if (s.nightwatcher.life.practice.note.location === "RECIPIENT") apply(s, { type: "RETURN_NOTE" });
  apply(s, { type: "CLOSE", caseId }); if (report) apply(s, { type: "REPORT", caseId });
}
function beforeDream() { const s = promoted(); beginCase(s, "uneven-cart", "ORDINARY"); closeCase(s, "uneven-cart"); return s; }
function beforeLeaf() { const s = beforeDream(); beginCase(s, "paired-dream", "ORDINARY"); closeCase(s, "paired-dream"); return s; }
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: NightwatcherProjection, type: NightwatcherCommand["type"], predicate: (action: NightwatcherAction) => boolean = () => true): NightwatcherAction {
  const action = value.actions.find(entry => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`);
  return action;
}
function buttonFor(value: NightwatcherProjection, type: NightwatcherCommand["type"], predicate?: (action: NightwatcherAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectNightwatcher(s);
  return { value, onCommand, ...render(<NightwatcherPanel nightwatcher={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Nightwatcher public panel, actual professional preparation and finite original papers", () => {
  it("keeps both the complete formula and ritual unknown and only forwards the original supply command", async () => {
    const s = taught(), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "守夜人配方与专业准备边界" });
    expect(boundary.textContent).toContain("成品配方仍未知"); expect(boundary.textContent).toContain("专业准备");
    expect(boundary.textContent).toContain("取得有来源的成品原瓶，由当前自愿且在场的专家主持专业准备；当前渠道不提供完整配方、材料清单或操作步骤。");
    expect(boundary.textContent).toContain("继续灵巫生活"); expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    expect(screen.queryByRole("button", { name: /调配|直接晋升|恐惧攻击|灵界旅行/ })).toBeNull();
    expect(value.bottles).toHaveLength(3); const work = findAction(value, "POTION_WORK"); await userEvent.click(buttonFor(value, "POTION_WORK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(work.command);
    expect(s.nightwatcher.bottles.every(bottle => bottle.labourSteps === 0 && bottle.status === "SUPPLIER")).toBe(true);
  });

  it("shows the actual adult expert, next-week visit and unused supplier kit without inventing an early window", () => {
    const s = ritual(false), { value } = panel(s);
    const current = screen.getByRole("region", { name: "守夜人当前专业准备" });
    for (const text of ["奥黛莉娅·黑尔", "66岁", "成年外貌", "序列4", "NW4-ODELIA", "NW4-HALL", "NW4-RITUAL-1", "NW4-KIT-1", "原供应方", "尚未耗用"])
      expect(current.textContent).toContain(text);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "BEGIN_RITUAL").disabled).toBe(true);
    expect(buttonFor(value, "CANCEL_RITUAL").disabled).toBe(false);
    expect(value.actions.some(action => action.command.type === "CHECK_PREPARATION")).toBe(false);
  });

  it("reviews the real preparation separately from drinking and restores focus when the player declines", async () => {
    const s = ritual(true, false), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "核对本次专业准备，自由选择是否继续" }));
    const review = screen.getByRole("region", { name: "守夜人专业准备的继续确认" });
    expect(review.textContent).toContain("NW4-KIT-1"); expect(review.textContent).toContain("服药还需逐瓶确认");
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "CHECK_PREPARATION"));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.nightwatcher.ritual.visits[0]!.checkedWeek).toBeNull();
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    await userEvent.click(screen.getByRole("button", { name: "确认核对，继续本次专业准备" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CHECK_PREPARATION", confirmed: true });
    expect(s.nightwatcher.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("rechecks current expert consent while reviewing and discards a confirmation when the original visit changes", async () => {
    const s = ritual(true, false), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION")); s.nightwatcher.ritual.expert.willing = false;
    rerender(<NightwatcherPanel nightwatcher={projectNightwatcher(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前专家的真实状态" }).textContent).toContain("不愿参与当前指导");
    const confirm = screen.getByRole("button", { name: "确认核对，继续本次专业准备" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    apply(s, { type: "END_RITUAL" }); s.nightwatcher.ritual.expert.willing = true; apply(s, { type: "BOOK_RITUAL" }); s.week++;
    apply(s, { type: "BEGIN_RITUAL" }); const next = projectNightwatcher(s);
    rerender(<NightwatcherPanel nightwatcher={next} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "守夜人专业准备的继续确认" })).toBeNull();
    await userEvent.click(buttonFor(next, "CHECK_PREPARATION"));
    expect(screen.getByRole("region", { name: "确认前的当前守夜人仪式" }).textContent).toContain("NW4-KIT-2");
    expect(s.nightwatcher.ritual.visits[0]!.kit.status).toBe("SEALED"); expect(s.nightwatcher.ritual.visits[0]!.kit.location).toBe("TABLE");
  });

  it("shows the selected original, current kit, four-tier risks and real resources, then submits drinking only once", async () => {
    const s = ritual(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME"));
    expect(screen.getByRole("region", { name: "守夜人服用风险与四档结果" }).textContent).toContain(NIGHTWATCHER_CONSUMPTION_RISK);
    const review = screen.getByRole("region", { name: "这瓶守夜人魔药的服用确认" });
    expect(review.textContent).toContain("完整晋升配方与仪式细节尚未掌握；服药前须完成专业指导准备，不提供完整仪式步骤。特殊跨途径晋升个例不能当作守夜人的通用配方。");
    for (const text of ["nightwatcher-potion-1", "NW4-KIT-1", "成功或失败都会耗用这一原瓶与本次原封装包", "旧包不能复用"])
      expect(review.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    const error = { message: "本次保存失败，请重试原操作。", retryable: true };
    rerender(<NightwatcherPanel nightwatcher={value} resources={resources(s)} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复派灵、耗用原包或服药");
    expect((screen.getByRole("button", { name: "暂不服用，返回原准备室" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶守夜人魔药的服用确认" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<NightwatcherPanel nightwatcher={value} resources={resources(s)} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "nightwatcher-potion-1", confirmed: true });
    expect(s.nightwatcher.bottles[0]!.status).toBe("PLAYER"); expect(s.nightwatcher.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("preserves a failed bottle and consumed kit, and shows a separately paid second kit at its actual supplier", async () => {
    const s = ritual(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "CONSUME"));
    await userEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    apply(s, { type: "CONSUME", bottleId: "nightwatcher-potion-1", confirmed: true }, 100);
    const failedVisit = structuredClone(s.nightwatcher.ritual.visits[0]);
    rerender(<NightwatcherPanel nightwatcher={projectNightwatcher(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶守夜人魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "守夜人当前专业准备" }).textContent).toContain("原包已耗尽，不能复用");
    expect(s.progression.sequence).toBe(5); expect(s.nightwatcher.ritual.playerLocation).toBe("OUTSIDE");
    apply(s, { type: "BUY_POTION", bottleId: "nightwatcher-potion-2" }); apply(s, { type: "BOOK_RITUAL" });
    rerender(<NightwatcherPanel nightwatcher={projectNightwatcher(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    const current = screen.getByRole("region", { name: "守夜人当前专业准备" });
    for (const text of ["NW4-KIT-1", "NW4-KIT-2", "原供应方", "原包已耗尽，不能复用"])
      expect(current.textContent).toContain(text);
    expect(s.nightwatcher.ritual.visits[0]).toEqual(failedVisit); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("offers zero-action actual departure even after current expert availability changes, without optimistic movement or refund", async () => {
    const s = ritual(); s.actionsRemaining = 0; s.spirituality = 0; s.nightwatcher.ritual.expert.location = "AWAY";
    const snapshot = structuredClone(s.nightwatcher.ritual), cash = s.cash, { value, onCommand } = panel(s);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "CONSUME").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "守夜人成长下一步" }).textContent).toContain(findAction(value, "END_RITUAL").label);
    expect(buttonFor(value, "END_RITUAL").disabled).toBe(false); await userEvent.click(buttonFor(value, "END_RITUAL"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END_RITUAL" }); expect(s.nightwatcher.ritual).toEqual(snapshot); expect(s.cash).toBe(cash);
    expect(screen.getByRole("region", { name: "当前专家的真实状态" }).textContent).toContain("当前不在原厅");
  });

  it.each([1, 100])("shows the real finite cart outcome and forwards zero-action physical return at roll %s", async (roll) => {
    const s = promoted(); beginCase(s, "uneven-cart", "ABILITY", roll); s.actionsRemaining = 0; s.spirituality = 0;
    const snapshot = structuredClone(s.nightwatcher.life.cart), { value, onCommand, rerender } = panel(s);
    const cart = screen.getByRole("region", { name: "同一原空车与真实推回" });
    expect(cart.textContent).toContain("NW4-CART"); expect(cart.textContent).toContain("原轮仍有可见的不平整");
    expect(cart.textContent).toContain(roll === 1 ? "原轮受阻，停在原路线途中" : "原2米路线终点，尚未推回");
    expect(buttonFor(value, "RETURN_CART").disabled).toBe(false); expect(buttonFor(value, "CLOSE").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "守夜人成长下一步" }).textContent).toContain(findAction(value, roll === 1 ? "STOP_EFFECT" : "RETURN_CART").label);
    await userEvent.click(buttonFor(value, "RETURN_CART")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_CART" });
    expect(s.nightwatcher.life.cart).toEqual(snapshot);
    apply(s, { type: "RETURN_CART" }); const returned = projectNightwatcher(s);
    rerender(<NightwatcherPanel nightwatcher={returned} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "同一原空车与真实推回" }).textContent).toContain("原路线起点");
    expect(screen.getByRole("region", { name: "同一原空车与真实推回" }).textContent).toContain("实际推回 1 次");
  });

  it("shows each actual adult independently in a partial dream and stops without inventing a second success", async () => {
    const s = beforeDream(); beginCase(s, "paired-dream", "ABILITY", [1, 100]); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand, rerender } = panel(s);
    const people = screen.getByRole("region", { name: "两位成年人的实际睡眠状态" });
    expect(people.textContent).toContain("梅森 · 34岁 · SW5-MASON"); expect(people.textContent).toContain("伊尔瓦·雷恩 · 29岁 · NW4-ILVA");
    const mason = screen.getByRole("article", { name: "梅森的当前睡眠状态" });
    const ilva = screen.getByRole("article", { name: "伊尔瓦·雷恩的当前睡眠状态" });
    expect(mason.textContent).toContain("实际仍在短梦中"); expect(mason.textContent).toContain("本次实际短暂入梦");
    expect(ilva.textContent).toContain("当前清醒"); expect(ilva.textContent).toContain("本次抵抗，未入梦");
    expect(people.textContent).toContain("本人仍在原椅，没有移动"); expect(people.textContent).toContain("不构成现实心理治疗");
    expect(buttonFor(value, "CLOSE").disabled).toBe(true); await userEvent.click(buttonFor(value, "STOP_EFFECT"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STOP_EFFECT", caseId: "paired-dream" });
    expect(s.nightwatcher.life.people.mason.asleep).toBe(true);
    apply(s, { type: "STOP_EFFECT", caseId: "paired-dream" });
    rerender(<NightwatcherPanel nightwatcher={projectNightwatcher(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("article", { name: "梅森的当前睡眠状态" }).textContent).toContain("当前清醒");
    expect(screen.getByRole("article", { name: "伊尔瓦·雷恩的当前睡眠状态" }).textContent).toContain("本次抵抗，未入梦");
  });

  it("keeps both resisted adults awake and retains the real paid failure", () => {
    const s = beforeDream(), before = s.spirituality; beginCase(s, "paired-dream", "ABILITY", [100, 100]); panel(s);
    expect(s.spirituality).toBe(before - 5);
    for (const name of ["梅森", "伊尔瓦·雷恩"]) {
      const person = screen.getByRole("article", { name: `${name}的当前睡眠状态` });
      expect(person.textContent).toContain("当前清醒"); expect(person.textContent).toContain("本次抵抗，未入梦");
    }
    expect(s.nightwatcher.life.people.mason.asleep).toBe(false); expect(s.nightwatcher.life.people.ilva.asleep).toBe(false);
    expect(screen.getByRole("region", { name: "守夜人实际生活结果" }).textContent).not.toBe("");
  });

  it("keeps ordinary joint conversation awake and does not claim ability mastery", () => {
    const s = beforeDream(), mastery = { ...s.progression.mastery }; beginCase(s, "paired-dream", "ORDINARY"); panel(s);
    expect(s.progression.mastery).toEqual(mastery);
    for (const name of ["梅森", "伊尔瓦·雷恩"]) {
      const person = screen.getByRole("article", { name: `${name}的当前睡眠状态` });
      expect(person.textContent).toContain("当前清醒"); expect(person.textContent).toContain("仅普通清醒交谈");
    }
  });

  it("uses the acquired original leaf and preserves its live counters until actual recall and paper retrieval", async () => {
    const s = beforeLeaf(), oldCompanion = structuredClone(s.spiritWarlock.companion), oldPractice = structuredClone(s.spiritWarlock.practice);
    beginCase(s, "leaf-signal", "ABILITY"); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand, rerender } = panel(s);
    const leaf = screen.getByRole("region", { name: "继承同一原灵的当前状态" });
    expect(leaf.textContent).toContain("SW5-LEAF-1"); expect(leaf.textContent).toContain(`累计实际派出 ${oldCompanion.deployments + 1} 次`);
    expect(leaf.textContent).toContain(`实际召回 ${oldCompanion.recalls} 次`); expect(leaf.textContent).toContain(`第${oldCompanion.acquiredWeek}周`);
    const paper = screen.getByRole("region", { name: "原灵与同一原纸条的实际去回" });
    expect(paper.textContent).toContain("NW4-NOTE-1"); expect(paper.textContent).toContain("梅森原接收处，尚未取回");
    expect(paper.textContent).toContain("本人仍在维持有限梦境专注"); expect(buttonFor(value, "RETURN_NOTE").disabled).toBe(true);
    await userEvent.click(buttonFor(value, "STOP_EFFECT")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STOP_EFFECT", caseId: "leaf-signal" });
    apply(s, { type: "STOP_EFFECT", caseId: "leaf-signal" });
    const stopped = projectNightwatcher(s); rerender(<NightwatcherPanel nightwatcher={stopped} resources={resources(s)} busy={false} onCommand={onCommand} />);
    await userEvent.click(buttonFor(stopped, "RECALL_SPIRIT")); expect(onCommand).toHaveBeenLastCalledWith({ type: "RECALL_SPIRIT" });
    expect(s.spiritWarlock.companion.status).toBe("DEPLOYED");
    apply(s, { type: "RECALL_SPIRIT" }); const recalled = projectNightwatcher(s);
    rerender(<NightwatcherPanel nightwatcher={recalled} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "继承同一原灵的当前状态" }).textContent).toContain(`实际召回 ${oldCompanion.recalls + 1} 次`);
    expect(screen.getByRole("region", { name: "原灵与同一原纸条的实际去回" }).textContent).toContain("梅森原接收处，尚未取回");
    await userEvent.click(buttonFor(recalled, "RETURN_NOTE")); expect(onCommand).toHaveBeenLastCalledWith({ type: "RETURN_NOTE" });
    expect(s.nightwatcher.life.practice.note.location).toBe("RECIPIENT"); apply(s, { type: "RETURN_NOTE" });
    rerender(<NightwatcherPanel nightwatcher={projectNightwatcher(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "原灵与同一原纸条的实际去回" }).textContent).toContain("实际取回 1 次");
    expect(s.spiritWarlock.practice).toEqual(oldPractice); expect(s.spiritWarlock.companion.source).toBe(oldCompanion.source);
  });

  it("shows a real failed dispatch without claiming that the new paper arrived", () => {
    const s = beforeLeaf(), old = structuredClone(s.spiritWarlock.companion); beginCase(s, "leaf-signal", "ABILITY", 100); panel(s);
    const paper = screen.getByRole("region", { name: "原灵与同一原纸条的实际去回" });
    expect(paper.textContent).toContain("原桌，已取回或尚未送出"); expect(paper.textContent).toContain("该原纸实际送达 0 次");
    expect(s.spiritWarlock.companion.deployments).toBe(old.deployments + 1); expect(s.spiritWarlock.companion.status).toBe("DEPLOYED");
    expect(screen.getByRole("region", { name: "继承同一原灵的当前状态" }).textContent).toContain("仍须召回");
  });

  it("keeps a released original unavailable and allows cancellation into the actual ordinary route", async () => {
    const s = beforeLeaf(); apply(s, { type: "RELEASE_SPIRIT" }); const old = structuredClone(s.spiritWarlock.companion);
    apply(s, { type: "OBSERVE", caseId: "leaf-signal" }); apply(s, { type: "PREPARE", caseId: "leaf-signal", method: "ABILITY" });
    const { value, onCommand, rerender } = panel(s);
    expect(screen.getByRole("region", { name: "继承同一原灵的当前状态" }).textContent).toContain("同一原灵已经释放");
    expect(buttonFor(value, "PERFORM").disabled).toBe(true); expect(buttonFor(value, "WITHDRAW").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "WITHDRAW")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WITHDRAW", caseId: "leaf-signal" });
    apply(s, { type: "WITHDRAW", caseId: "leaf-signal" }); const ordinaryReady = projectNightwatcher(s);
    rerender(<NightwatcherPanel nightwatcher={ordinaryReady} resources={resources(s)} busy={false} onCommand={onCommand} />);
    const ordinary = (action: NightwatcherAction) => action.command.type === "PREPARE" && action.command.method === "ORDINARY";
    expect(buttonFor(ordinaryReady, "PREPARE", ordinary).disabled).toBe(false); await userEvent.click(buttonFor(ordinaryReady, "PREPARE", ordinary));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "PREPARE", caseId: "leaf-signal", method: "ORDINARY" });
    expect(s.spiritWarlock.companion).toEqual(old); expect(s.spiritWarlock.companion.source).toBe("SW5-LEAF-1");
  });

  it("preserves the actual ordinary watchman and his original club while forwarding peaceful departure", async () => {
    const s = promoted(); apply(s, { type: "ENCOUNTER_TALK" }); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand } = panel(s), encounter = screen.getByRole("region", { name: "守夜人可选原院冲突" });
    for (const text of ["布拉姆·洛 · 45岁 · NW4-BRAM", "NW4-BRAM-CLUB", "不追击"]) expect(encounter.textContent).toContain(text);
    expect(buttonFor(value, "ENCOUNTER_FIGHT").disabled).toBe(true); await userEvent.click(buttonFor(value, "LEAVE_ENCOUNTER"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_ENCOUNTER" }); expect(s.nightwatcher.encounter.status).toBe("READY");
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("blocks all public actions while %s without introducing a retry", (condition) => {
    const s = ritual(true, false), value = projectNightwatcher(s), onCommand = vi.fn();
    render(<NightwatcherPanel nightwatcher={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "CHECK_PREPARATION")); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });

  it("keeps all old leaf, paper, case and bottle history read-only after advancement", () => {
    const s = promoted(), old = projectSliceState(s).spiritWarlock; render(<NightwatcherSpiritWarlockHistory spiritWarlock={old} />);
    const history = screen.getByRole("region", { name: "灵巫时期的经历" });
    expect(history.textContent).toContain(old.companion!.source); expect(history.textContent).toContain(old.practice!.note);
    expect(history.textContent).toContain(old.bottles[0]!.id); expect(history.textContent).toContain(old.bottles[0]!.status);
    for (const entry of old.cases) { for (const fact of entry.observations) expect(history.textContent).toContain(fact); if (entry.result) expect(history.textContent).toContain(entry.result); }
    for (const fact of old.companion!.history) expect(history.textContent).toContain(fact);
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.spiritWarlock).toEqual(oldSpiritWarlockRun.spiritWarlock);
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
  // Preserve Olin's original surrendered outcome and dismiss only its inherited presentation through the actual UI.
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return { api, state };
}
describe("Nightwatcher actual SliceApp navigation", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });

  it("opens actual Darkness S5 advancement in the Nightwatcher panel without sending a command", async () => {
    const { api, state } = await enter(taught()); await userEvent.click(screen.getByRole("button", { name: "查看守夜人晋升" }));
    expect(within(screen.getByRole("region", { name: "守夜人成长下一步" })).getByRole("heading", { name: state.nightwatcher.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "守夜人晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "灵巫成长下一步" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current S4 growth and the old read-only SpiritWarlock chapter, then returns to current growth", async () => {
    const { api, state } = await enter(promoted()); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "守夜人成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "守夜人成长" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "灵巫经历" }));
    const history = within(screen.getByRole("region", { name: "灵巫时期的经历" })); await userEvent.click(history.getByText("灵巫原瓶 · 来源与去向"));
    expect(history.getByText(`原瓶：${state.spiritWarlock.bottles[0]!.id}`)).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "守夜人成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "守夜人成长" })); expect(screen.getByRole("region", { name: "守夜人成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps the currently deployed inherited leaf on its actual S4 case rather than reopening old S5 controls", async () => {
    const s = beforeLeaf(); beginCase(s, "leaf-signal", "ABILITY"); const { api } = await enter(s);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "守夜人成长下一步" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "原灵与同一原纸条的实际去回" }).textContent).toContain("NW4-NOTE-1");
    expect(screen.getByRole("button", { name: /^实际召回同一个原卷叶/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "灵巫时期的经历" })).toBeNull();
    expect(screen.queryByRole("region", { name: "灵巫成长下一步" })).toBeNull();
    expect((screen.getByRole("button", { name: "灵巫经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
