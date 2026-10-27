/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { applySliceIntent, createSliceRun, projectSliceState } from "../../src/domain/slice";
import { applySeerCommand, type SeerContext } from "../../src/domain/seer";
import { SEER_ABILITY_IDS } from "../../src/domain/seer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import type { TownAction, TownCommand, TownProjection } from "../../src/domain/town/types";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { SliceApp } from "../../src/renderer/SliceApp";
import { TownPanel } from "../../src/renderer/TownPanel";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

function projection(patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("town-renderer-run", sliceDefaultCreationSelection, "town-renderer-seed");
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  return { ...projectSliceState(raw), activeEvent: null, canAct: true, actionBlockedReason: null, ...patch };
}
function pathway(pathwayId: "diviner" | "hunter" | "audience", sequence: 9 | 8 | 7, acting: number): SliceProjection {
  const raw = createSliceRun("town-renderer-run", sliceDefaultCreationSelection, "town-renderer-seed");
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  raw.week = 12;
  raw.progression = { pathwayId, sequence, acting, mastery: {}, promotionWeek: 5 };
  return { ...projectSliceState(raw), canAct: true, actionBlockedReason: null };
}
function readySeerPractice(actionsRemaining = 3, checkRoll = 20) {
  const raw = createSliceRun("seer-guide", sliceDefaultCreationSelection, "seer-guide");
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  raw.arc.stage = "ENDED";
  raw.week = 12;
  raw.actionsRemaining = actionsRemaining;
  raw.seer.discovered = true;
  raw.seer.formulaKnown = true;
  raw.progression = { pathwayId: "diviner", sequence: 9, promotionWeek: 5, acting: 0,
    mastery: Object.fromEntries(SEER_ABILITY_IDS.map(id => [id, 0])) };
  const context: SeerContext = {
    check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: raw.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll }),
    roll: min => min,
    note: () => {},
  };
  return { raw, context };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-11T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-11T00:01:00Z", replayed: false, state,
  } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
function expectSeerBudget(state: SliceProjection) {
  const currentCase = screen.getByRole("region", { name: "当前委托" });
  const budget = within(currentCase).getByRole("group", { name: "当前委托行动预算" });
  expect(within(budget).getByText(`本周剩余 ${state.actionsRemaining} 行动 · 灵性 ${state.spirituality} / ${state.maxSpirituality} · ${state.wagePaid ? "本周工资已领" : "本周工资尚未领取"}`)).toBeTruthy();
  expect(screen.getAllByRole("group", { name: "当前委托行动预算" })).toHaveLength(1);
  return budget;
}
function townAction(command: TownCommand, enabled = true): TownAction {
  return { id: command.type, label: `操作${command.type}`, cost: `投影成本${command.type}`, enabled, reason: enabled ? null : "实际公开限制", command };
}
function town(actions: TownAction[] = [townAction({ type: "BUY_CLUB" })]): TownProjection {
  return {
    title: "随身物品与商店", shopKnown: true,
    items: [
      { id: "town-short-club", label: "实际原短棍", description: "来自商店的这一根短棍。", quantity: 1, location: "SHOP", owner: "SHOP", equipped: false },
      { id: "held-bandages", label: "绷带", description: "普通伤口处置。", quantity: 2, location: "BAG", owner: "PLAYER", equipped: false },
    ],
    actions, stockSummary: "领域提供的有限库存说明",
  };
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Compact dashboard navigation", () => {
  it("starts with one goal, one primary guide, nested pathways and accessible work/rest", async () => {
    const state = projection({ lastResult: null, investigateTargets: [] });
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(guide.querySelectorAll("button.primary")).toHaveLength(1);
    expect(within(guide).getAllByRole("button").length).toBeLessThanOrEqual(3);
    expect(within(guide).getByText(/普通生活 0\/4 整周/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /随身物品与商店/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "占卜家之路" })).toBeNull();
    expect(screen.queryByRole("button", { name: "猎人之路" })).toBeNull();
    expect(screen.queryByRole("button", { name: "观众之路" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("一张普通告示，留下了失踪工人的线索。")).toBeNull();
    const work = screen.getByRole("button", { name: /^工作，/ });
    const rest = screen.getByRole("button", { name: /^休养，/ });
    expect((work as HTMLButtonElement).disabled).toBe(false);
    expect((rest as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(within(guide).getByRole("button", { name: "安排日常行动" }));
    expect(document.activeElement).toBe(work);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["health", "mind"] as const)("prioritizes recovery when %s is depleted without auto-resting", async (resource) => {
    const value = bridge({ ...pathway("audience", 8, 24), [resource]: 0 });
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "先恢复身心" })).toBeTruthy();
    await userEvent.click(within(guide).getByRole("button", { name: "先去休养" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^休养，/ }));
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("prioritizes a publicly available ARC-C investigation over growth practice", async () => {
    const value = bridge({ ...pathway("diviner", 9, 24), nextStep: "已经公开的案件时限与下一步。", investigateTargets: [{ id: "ARC-C", label: "已知案件现场", description: "实际公开目标" }] });
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "继续眼前的案件" })).toBeTruthy();
    expect(within(guide).getByText("已经公开的案件时限与下一步。")).toBeTruthy();
    await userEvent.click(within(guide).getByRole("button", { name: "查看已知调查" }));
    expect(screen.getByRole("dialog", { name: "选择调查目标" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("offers channel choice after four complete weeks without picking or executing a pathway", async () => {
    const value = bridge(projection({ week: 5 }));
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "了解渠道，再决定是否踏入非凡" })).toBeTruthy();
    await userEvent.click(within(guide).getByRole("button", { name: "查看非凡渠道" }));
    for (const label of ["占卜家之路", "猎人之路", "观众之路"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "占卜家经历"],
    ["hunter", "猎人之路"],
    ["audience", "观众之路"],
  ] as const)("routes %s sequence 9 practice to its own growth dossier", async (path, current) => {
    const value = bridge(pathway(path, 9, 48));
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "实践当前能力，消化魔药" })).toBeTruthy();
    expect(within(guide).getByText(/扮演 48\/100/)).toBeTruthy();
    await userEvent.click(within(guide).getByRole("button", { name: "查看当前成长" }));
    expect(screen.getByRole("button", { name: current }).getAttribute("aria-pressed")).toBe("true");
    if (path !== "diviner") {
      expect(screen.queryByRole("group", { name: "当前委托行动预算" })).toBeNull();
      expect(screen.queryByRole("button", { name: "返回日常行动（不消耗行动）" })).toBeNull();
    }
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each([false, true])("shows the actual Seer budget with wage paid %s and returns to daily actions without changing state", async wagePaid => {
    let { raw } = readySeerPractice();
    raw.spirituality = 7.5;
    if (wagePaid) raw = applySliceIntent(raw, { type: "ACTION", action: "WORK" });
    const state = projectSliceState(raw), snapshot = JSON.stringify({ raw, state });
    expect(state.wagePaid).toBe(wagePaid);
    const value = bridge(state);
    await enter(value);
    await userEvent.click(within(screen.getByRole("region", { name: "接下来" })).getByRole("button", { name: "查看当前成长" }));
    const budget = expectSeerBudget(state);
    const choices = screen.getByRole("group", { name: "委托处理方式" });
    expect(within(choices).getAllByRole("button")).toHaveLength(2);
    for (const choice of state.seer.practice.cases[0]!.choices) {
      expect(within(choices).getByText(choice.cost)).toBeTruthy();
    }
    await userEvent.click(within(budget).getByRole("button", { name: "返回日常行动（不消耗行动）" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    const dailyActions = screen.getByRole("group", { name: "四个主要行动" });
    expect(dailyActions.getAttribute("tabindex")).toBe("-1");
    expect(within(dailyActions).getAllByRole("button")).toHaveLength(4);
    await waitFor(() => expect(document.activeElement).toBe(dailyActions));
    expect(value.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify({ raw, state })).toBe(snapshot);
  });

  it("refreshes the Seer budget from real commission, work and next-week rest receipts", async () => {
    let { raw } = readySeerPractice();
    raw.spirituality = 7.5;
    raw.cash = 1000;
    const startingWeek = raw.week;
    const value = bridge(projectSliceState(raw));
    vi.mocked(value.submitIntent).mockImplementation(async envelope => {
      if (envelope.payload.type === "CREATE") throw new Error("This test continues an existing run.");
      raw = applySliceIntent(raw, envelope.payload);
      return receipt(projectSliceState(raw), envelope);
    });
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expectSeerBudget(projectSliceState(raw));
    const dialog = screen.getByRole("dialog", { name: "非凡成长" });
    await userEvent.click(within(screen.getByRole("group", { name: "委托处理方式" })).getByRole("button", { name: /^开启灵视/ }));
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBe(dialog);
    expect(raw.actionsRemaining).toBe(2);
    expect(raw.spirituality).toBe(5.5);
    expectSeerBudget(projectSliceState(raw));
    await userEvent.click(screen.getByRole("button", { name: "返回日常行动（不消耗行动）" }));
    await userEvent.click(screen.getByRole("button", { name: /^工作，/ }));
    expect(raw.actionsRemaining).toBe(1);
    expect(raw.wagePaidWeek).toBe(startingWeek);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expectSeerBudget(projectSliceState(raw));
    await userEvent.click(screen.getByRole("button", { name: "返回日常行动（不消耗行动）" }));
    await userEvent.click(screen.getByRole("button", { name: /^休养，/ }));
    expect(raw.week).toBe(startingWeek + 1);
    expect(raw.actionsRemaining).toBe(raw.weeklyBudget);
    expect(raw.spirituality).toBeGreaterThan(5.5);
    expect(projectSliceState(raw).wagePaid).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expectSeerBudget(projectSliceState(raw));
    expect(vi.mocked(value.submitIntent).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
      { type: "SEER", command: { type: "PRACTICE", caseId: "folded-bookmark", approachId: "observe-sight" } },
      { type: "ACTION", action: "WORK" },
      { type: "ACTION", action: "REST" },
    ]);
  });

  it.each([8, 7] as const)("does not add current-action budgeting to sequence %s Seer history", async sequence => {
    const { raw } = readySeerPractice();
    raw.progression.sequence = sequence;
    const state = projectSliceState(raw), snapshot = JSON.stringify(state);
    const value = bridge(state);
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    expect(screen.getByRole("combobox", { name: sequence === 7 ? "查看旧委托" : "查看委托" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "当前委托行动预算" })).toBeNull();
    expect(screen.queryByRole("button", { name: "返回日常行动（不消耗行动）" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it.each(["COMPLETED", "DISPUTED", "FAILED"] as const)("skips the %s first Seer commission for the next actionable one without submitting it", async status => {
    const { raw, context } = readySeerPractice(3, status === "FAILED" ? 100 : 20);
    applySeerCommand(raw, { type: "PRACTICE", caseId: "folded-bookmark", approachId: "observe-sight" }, context);
    if (status !== "FAILED") applySeerCommand(raw, { type: "PRACTICE", caseId: "folded-bookmark", approachId: status === "COMPLETED" ? "report-bounded" : "report-cause" }, context);
    expect(raw.seer.practice.cases[0]!.status).toBe(status);
    const value = bridge(projectSliceState(raw));
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "继续委托：装箱单上少掉的一行" })).toBeTruthy();
    expect(guide.textContent).toContain(`已交付 ${status === "COMPLETED" ? 1 : 0}/8 份委托`);
    expect(guide.textContent).toContain(`扮演 ${status === "COMPLETED" ? 12 : 0}/100`);
    await userEvent.click(within(guide).getByRole("button", { name: "查看当前成长" }));
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("region", { name: "当前委托" })).getByRole("heading", { name: "装箱单上少掉的一行" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("guides the pending bookmark reply neutrally at zero actions without choosing a report", async () => {
    const { raw, context } = readySeerPractice(1);
    applySeerCommand(raw, { type: "PRACTICE", caseId: "folded-bookmark", approachId: "observe-sight" }, context);
    expect(raw.actionsRemaining).toBe(0);
    const state = projectSliceState(raw), snapshot = JSON.stringify({ raw, state });
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "回应书签主人的追问" })).toBeTruthy();
    expect(guide.textContent).toContain("决定怎样解释观察所得");
    expect(guide.textContent).toContain("不再消耗行动或灵性");
    expect(guide.textContent).toContain("已交付 0/8 份委托");
    expect(guide.textContent).not.toContain("只说明观察所得");
    expect(guide.textContent).not.toContain("断言先前的演示");
    await userEvent.click(within(guide).getByRole("button", { name: "查看当前成长" }));
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("true");
    const currentCase = screen.getByRole("region", { name: "当前委托" });
    expect(within(currentCase).getByRole("heading", { name: "书签折痕里的冷意" })).toBeTruthy();
    const choices = within(currentCase).getByRole("group", { name: "委托处理方式" });
    expect(within(choices).getAllByRole("button")).toHaveLength(2);
    for (const button of within(choices).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(false);
    const budget = expectSeerBudget(state);
    await userEvent.click(within(budget).getByRole("button", { name: "返回日常行动（不消耗行动）" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    const dailyActions = screen.getByRole("group", { name: "四个主要行动" });
    await waitFor(() => expect(document.activeElement).toBe(dailyActions));
    expect(value.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify({ raw, state })).toBe(snapshot);
  });

  it("routes seven deliveries with the last commission locked this week to daily life", async () => {
    const { raw, context } = readySeerPractice(10);
    const cases = projectSliceState(raw).seer.practice.cases;
    for (const entry of cases.slice(0, 7)) {
      applySeerCommand(raw, entry.choices[1]!.command, context);
      if (entry.id === "folded-bookmark") applySeerCommand(raw, { type: "PRACTICE", caseId: entry.id, approachId: "report-bounded" }, context);
    }
    const failedContext = { ...context, check: (ability: Parameters<SeerContext["check"]>[0], difficulty: number) => resolveNormalCheck({ ability, baseAbility: raw.character.coreStats[ability], difficulty, modifiers: [], roll: 100 }) };
    applySeerCommand(raw, cases[7]!.choices[1]!.command, failedContext);
    const state = projectSliceState(raw), snapshot = JSON.stringify(state);
    expect(state.seer.practice.completed).toBe(7);
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "剩余委托下周再复核" })).toBeTruthy();
    expect(guide.textContent).toContain("已交付 7/8 份委托");
    expect(guide.textContent).toContain("扮演 84/100");
    await userEvent.click(within(guide).getByRole("button", { name: "安排日常行动" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^工作，/ }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("offers reflection after eight real deliveries without spending the reflection action", async () => {
    const { raw, context } = readySeerPractice(9);
    for (const entry of projectSliceState(raw).seer.practice.cases) {
      applySeerCommand(raw, entry.choices[1]!.command, context);
      if (entry.id === "folded-bookmark") applySeerCommand(raw, { type: "PRACTICE", caseId: entry.id, approachId: "report-bounded" }, context);
    }
    const state = projectSliceState(raw);
    expect(state.seer.practice.completed).toBe(8);
    expect(state.seer.practice.reflection.enabled).toBe(true);
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "整理委托经历，写下扮演原则" })).toBeTruthy();
    expect(guide.textContent).toContain("已交付 8/8 份委托");
    await userEvent.click(within(guide).getByRole("button", { name: "查看当前成长" }));
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: /整理八份委托的共同原则/ }) as HTMLButtonElement).disabled).toBe(false);
    expectSeerBudget(state);
    expect(screen.getByRole("button", { name: "返回日常行动（不消耗行动）" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["blocked", "legacy", "empty-choices"] as const)("keeps generic growth navigation for %s Seer practice", async kind => {
    const { raw } = readySeerPractice(0);
    const state = projectSliceState(raw);
    if (kind === "legacy") delete (state.seer as Partial<SliceProjection["seer"]>).practice;
    if (kind === "empty-choices") state.seer.practice.cases.forEach(entry => { entry.choices = []; });
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "实践当前能力，消化魔药" })).toBeTruthy();
    expect(guide.textContent).toContain("扮演 0/100");
    await userEvent.click(within(guide).getByRole("button", { name: "查看当前成长" }));
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("true");
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "小丑晋升"], ["hunter", "挑衅者晋升"], ["audience", "读心者晋升"],
  ] as const)("routes digested %s sequence 9 to sequence 8 preparation", async (path, next) => {
    const value = bridge(pathway(path, 9, 100));
    await enter(value);
    await userEvent.click(within(screen.getByRole("region", { name: "接下来" })).getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("button", { name: next }).getAttribute("aria-pressed")).toBe("true");
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "小丑晋升"], ["hunter", "挑衅者晋升"], ["audience", "读心者晋升"],
  ] as const)("routes %s sequence 8 practice without returning to sequence 9", async (path, current) => {
    const value = bridge(pathway(path, 8, 24));
    await enter(value);
    expect(within(screen.getByRole("region", { name: "接下来" })).getByRole("heading", { name: "实践当前能力，消化魔药" })).toBeTruthy();
    await userEvent.click(within(screen.getByRole("region", { name: "接下来" })).getByRole("button", { name: "查看当前成长" }));
    expect(screen.getByRole("button", { name: current }).getAttribute("aria-pressed")).toBe("true");
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["hunter", "audience"] as const)("keeps %s completed S8 pointed to the now implemented S7 preparation", async(path) => {
    const value=bridge(pathway(path,8,100));await enter(value);
    expect(within(screen.getByRole("region",{name:"接下来"})).getByRole("heading",{name:"准备序列7晋升"})).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps only the visible investigation alongside the implemented sequence 6 promotion guide and opens it without spending", async () => {
    const state = { ...pathway("audience", 7, 100), investigateTargets: [{ id: "actual-case", label: "实际已知调查", description: "玩家已知的公开说明" }], nextStep: "实际公开的下一步" };
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(within(guide).getByRole("heading", { name: "准备催眠师晋升" })).toBeTruthy();
    expect(guide.textContent).toContain("心理医生消化100、晋升后12整周，取得独立原瓶再确认服用；尚未掌握完整辅料配方。");
    expect(within(guide).getByRole("button", { name: "查看已知调查" })).toBeTruthy();
    const tasks = screen.getByRole("region", { name: "当前任务与线索" });
    expect(within(tasks).getByText("实际公开的下一步")).toBeTruthy();
    await userEvent.click(within(tasks).getByRole("button", { name: "实际已知调查" }));
    expect(screen.getByRole("dialog", { name: "选择调查目标" })).toBeTruthy();
    expect(screen.getByText("玩家已知的公开说明")).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("retains ordinary life and the implemented sequence 6 promotion without inventing investigation targets", async () => {
    const value = bridge({ ...pathway("hunter", 7, 100), investigateTargets: [], nextStep: "保持自己的生活。" });
    await enter(value);
    expect(screen.getByRole("heading", { name: "准备阴谋家晋升" })).toBeTruthy();
    const tasks = screen.getByRole("region", { name: "当前任务与线索" });
    expect(within(tasks).queryAllByRole("button")).toHaveLength(0);
    expect(within(tasks).getByText(/当前没有待查目标/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^调查，/ }));
    expect(screen.getByText("目前没有已知目标。关闭后可以工作或休养，不消耗行动。")).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });
});

describe("Rest action feedback", () => {
  it("shows actual recovery and week settlement without changing persisted historical prose", async () => {
    let raw = createSliceRun("rest-feedback", sliceDefaultCreationSelection, "rest-feedback");
    raw.activeEvent = null; raw.character.name = "艾琳";
    raw.health = 91; raw.mind = 94; raw.spirituality = 12; raw.seer.pollution = 7;
    raw.cash = 1000; raw.actionsRemaining = 1;
    const value = bridge(projectSliceState(raw));
    let committed: SliceProjection | undefined;
    vi.mocked(value.submitIntent).mockImplementation(async envelope => {
      if (envelope.payload.type === "CREATE") throw new Error("This test continues an existing run.");
      raw = applySliceIntent(raw, envelope.payload);
      committed = projectSliceState(raw);
      return receipt(committed, envelope);
    });
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /^休养，/ }));
    expect(screen.getByRole("heading", { name: "完成休养", level: 1 })).toBeTruthy();
    expect(screen.getByText("休养及本次结算后：健康91→100；精神94→100；灵性12→14.25；魔药排异7→0。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次行动与周结算" }).textContent).toContain("新的一周");
    expect(raw.week).toBe(2);
    expect(raw.chronicle.find(record => record.title === "完成休养")?.text).toBe("健康91→100；精神100，灵性14.25。");
    expect(committed?.chronicle.find(record => record.title === "完成休养")?.text).toBe("健康91→100；精神100，灵性14.25。");
  });
});

describe("Town items and trade drawer", () => {
  it("keeps real consecutive purchases and equipment changes in place, with action and week outcomes together", async () => {
    let raw = createSliceRun("continuous-shop", sliceDefaultCreationSelection, "continuous-shop");
    raw.activeEvent = null; raw.town.shopKnown = true; raw.character.name = "艾琳";
    raw.health = 80; raw.cash = 1000; raw.actionsRemaining = 1;
    const value = bridge(projectSliceState(raw));
    vi.mocked(value.submitIntent).mockImplementation(async envelope => {
      if (envelope.payload.type === "CREATE") throw new Error("This test continues an existing run.");
      raw = applySliceIntent(raw, envelope.payload);
      return receipt(projectSliceState(raw), envelope);
    });
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /随身物品与商店/ }));
    const dialog = screen.getByRole("dialog", { name: "随身物品与商店" });
    dialog.scrollTop = 480;
    const focus = vi.spyOn(within(dialog).getByRole("heading", { name: "随身物品与商店" }), "focus");
    for (const name of [/^购买短棍/, /^持用短棍/, /^购买一份绷带/]) {
      await userEvent.click(within(dialog).getByRole("button", { name }));
      expect(screen.getByRole("dialog", { name: "随身物品与商店" })).toBe(dialog);
      expect(dialog.scrollTop).toBe(480);
    }
    expect(focus).not.toHaveBeenCalled();
    expect(raw.town.clubLocation).toBe("HAND");
    expect(raw.town.bandagesHeld).toBe(1);
    await userEvent.click(within(dialog).getByRole("button", { name: /^使用一份绷带/ }));
    const feedback = within(dialog).getByRole("status", { name: "本次行动结果" });
    expect(feedback.textContent).toContain("使用随身绷带");
    expect(feedback.textContent).toContain("新的一周");
    expect(raw.week).toBe(2);
    await userEvent.click(within(dialog).getByRole("button", { name: "关闭随身物品与商店" }));
    expect(screen.getByRole("heading", { name: "使用随身绷带", level: 1 })).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次行动与周结算" }).textContent).toContain("新的一周");
    expect(value.submitIntent).toHaveBeenCalledTimes(4);
  });

  it("renders the real items, exact costs and every projection-supplied command", async () => {
    const commands: TownCommand[] = ["VISIT_SHOP", "BUY_CLUB", "SELL_CLUB", "EQUIP_CLUB", "UNEQUIP_CLUB", "BUY_BANDAGE", "USE_BANDAGE"].map((type) => ({ type }) as TownCommand);
    const onCommand = vi.fn();
    render(<TownPanel town={town(commands.map((command) => townAction(command)))} cash="1镑 2苏勒 3便士" actionsRemaining={2} busy={false} blocked={false} onCommand={onCommand} />);
    expect(within(screen.getByRole("region", { name: "商店" })).getByText("实际原短棍 × 1")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "随身物品" })).getByText("绷带 × 2")).toBeTruthy();
    expect(screen.getByText("现金 1镑 2苏勒 3便士")).toBeTruthy();
    for (const command of commands) {
      expect(screen.getByText(`投影成本${command.type}`)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`操作${command.type}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("keeps domain restrictions visible and disables actions during a save or unresolved failure", () => {
    const onCommand = vi.fn();
    const value = town([townAction({ type: "EQUIP_CLUB" }, false), townAction({ type: "BUY_BANDAGE" })]);
    const { rerender } = render(<TownPanel town={value} cash="0便士" actionsRemaining={0} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("实际公开限制")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /操作EQUIP_CLUB/ }));
    expect(onCommand).not.toHaveBeenCalled();
    for (const props of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<TownPanel town={value} cash="0便士" actionsRemaining={0} {...props} onCommand={onCommand} />);
      for (const button of screen.getAllByRole("button")) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(button);
      }
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("opening and closing spends nothing and returns focus to its single entry", async () => {
    const value = bridge(projection({ town: town() }));
    await enter(value);
    const entry = screen.getByRole("button", { name: /随身物品与商店/ });
    await userEvent.click(entry);
    expect(screen.getByRole("dialog", { name: "随身物品与商店" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭随身物品与商店" }));
    expect(document.activeElement).toBe(entry);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps pathway supplies read-only and links to the existing growth drawer", async () => {
    const state = pathway("audience", 8, 24);
    const value = bridge({ ...state, town: town([]) });
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /随身物品与商店/ }));
    await userEvent.click(screen.getByRole("button", { name: "前往非凡成长" }));
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "读心者晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("submits one exact town intent, locks close while pending, and retries the same envelope after save failure", async () => {
    const state = projection({ town: town() });
    const value = bridge(state);
    let finish: ((result: SliceResult<SliceReceipt>) => void) | undefined;
    vi.mocked(value.submitIntent).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /随身物品与商店/ }));
    const buy = screen.getByRole("button", { name: /操作BUY_CLUB/ });
    fireEvent.click(buy);
    fireEvent.click(buy);
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    const envelope = vi.mocked(value.submitIntent).mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "TOWN", command: { type: "BUY_CLUB" } });
    expect((buy as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭随身物品与商店" })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "随身物品与商店" })).toBeTruthy();
    await act(async () => { finish?.({ ok: false, error: { code: "SAVE_FAILED", message: "这笔交易尚未保存", retryable: true } }); });
    expect(screen.getByText("这笔交易尚未保存")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭随身物品与商店" })).toBeNull();
    expect((screen.getByRole("button", { name: /操作BUY_CLUB/ }) as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(value.submitIntent).mockImplementationOnce(async (same) => receipt({ ...state, revision: state.revision + 1 }, same));
    await userEvent.click(screen.getByRole("button", { name: /重试/ }));
    expect(value.submitIntent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(value.submitIntent).mock.calls[1]![0]).toEqual(envelope);
    expect(screen.getByRole("dialog", { name: "随身物品与商店" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭随身物品与商店" }));
    expect(screen.queryByRole("dialog", { name: "随身物品与商店" })).toBeNull();
  });
});
