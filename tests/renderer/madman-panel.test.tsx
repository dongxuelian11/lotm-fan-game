/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { MadmanAction, MadmanCommand, MadmanProjection } from "../../src/domain/madman/types";
import type { SliceCombatRound, SliceProjection } from "../../src/domain/slice/types";
import { MadmanPanel, MadmanPrisonerHistory } from "../../src/renderer/MadmanPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "服用存在大成功、成功、失败、大失败四档结果；失败保留实际代价。";
const guidance: MadmanAction = {
  id: "guidance", label: "学习疯子服用指导", cost: "1行动 · 公开指导费用", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
function madman(patch: Partial<MadmanProjection> = {}): MadmanProjection {
  return {
    title: "疯子晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "囚犯扮演100，已度过4/4个完整序列9周。", pollution: 3, risk,
    cases: [], environment: "", insideCase: false, ...patch,
  };
}
function action(command: MadmanCommand, label = "观察原现场", enabled = true, cost = "1行动 · 本案公开成本"): MadmanAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "原公开限制仍未解除。", command };
}
function cases(): MadmanProjection["cases"] {
  return ["stop-bell", "weighted-gate", "taunting-note"].map((id, index) => ({
    id, title: `有限实践${index + 1}`, story: `原现场与停止边界${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
    burstOpen: "尚未开始本次尝试", stops: 0, burstUses: 0,
  }));
}
function opened(method: "BURST" | "ORDINARY" = "BURST"): MadmanProjection {
  return madman({ promoted: true, insideCase: true, title: "疯子 · 序列8",
    cases: cases().map((entry) => entry.id === "weighted-gate" ? {
      ...entry, status: "EXAMINED", observations: ["原闸门与停止信号已核实"], preparation: `已实际采用${method}`,
      burstOpen: "本次尝试仍未实际停止", burstUses: method === "BURST" ? 1 : 0,
      result: "原尝试失败，仍须实际停止。",
    } : entry),
    actions: [action({ type: "STOP", caseId: "weighted-gate" }, "实际停止本次闸门尝试", true, "0行动 · 0精神 · 0灵性"),
      action({ type: "REPORT", caseId: "weighted-gate" }, "不得提前报告"),
      action({ type: "OBSERVE", caseId: "stop-bell" }, "不得另开实践")],
  });
}
function bottled(): MadmanProjection {
  return madman({ guidanceKnown: true, supplies: "三瓶独立疯子成品，完整配方尚未核实，费用与劳动条件按公开记录。",
    actions: ["madman-potion-1", "madman-potion-2"].map((id) => action({ type: "CONSUME", bottleId: id, confirmed: true }, `服用${id}`, true, "0行动 · 消耗这瓶独立原瓶")),
    bottles: [
      { id: "madman-potion-1", title: "第一瓶疯子魔药", source: "原渠道交接的第一瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "madman-potion-1", confirmed: true } },
      { id: "madman-potion-2", title: "第二瓶疯子魔药", source: "原渠道交接的第二瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "madman-potion-2", confirmed: true } },
      { id: "madman-potion-3", title: "第三瓶疯子魔药", source: "原渠道保管的第三瓶", status: "尚未交付", chance: 43, command: { type: "CONSUME", bottleId: "madman-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: MadmanProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<MadmanPanel madman={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("madman-renderer-run", sliceDefaultCreationSelection, "madman-renderer-seed");
  raw.week = 10; raw.activeEvent = null; raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return { ...state, canAct: true, actionBlockedReason: null,
    prisoner: { ...state.prisoner, discovered: sequence !== null, promoted: sequence !== null, title: "囚犯 · 序列9", acting: 100, actions: [] },
    madman: madman({ promoted: sequence === 8, title: sequence === 8 ? "疯子 · 序列8" : "疯子晋升", actions: sequence === 8 ? [] : [guidance] }),
    progression: { pathwayId: sequence === null ? null : "chained", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week,
      date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z",
    }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:01:00Z", replayed: false, state } };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openMadman() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "疯子晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Madman sequence eight dossier", () => {
  it("keeps all eighteen ordinary choices without opening an S8 route", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "囚犯之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /疯子/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps S9 as default and opens S8 from its tab and advancement guide", async () => {
    const api = bridge(fixture(9)); await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "囚犯成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "疯子晋升" }));
    const summary = screen.getByRole("region", { name: "疯子成长下一步" });
    expect(summary.textContent).toContain("囚犯100消化与四个完整序列9周");
    expect(summary.textContent).toContain("不对应现实诊断");
    expect(summary.textContent).toContain("普通方法也可完成");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "疯子成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S8 to current growth and exposes inherited S9 only as original history", async () => {
    const state = fixture(8); state.seer.discovered = true;
    state.prisoner.cases = [{ id: "jammed-shutter", title: "原撑窗实践", story: "原窗与原桌", observations: ["原木垫块磨损已核实"], preparation: "原普通协作", result: "原失败与归还均保留", status: "RESOLVED", holding: "原木垫块已放回原桌", returns: 2 }];
    state.prisoner.actions = [{ id: "stale", label: "不得重做的囚犯作业", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "jammed-shutter" } }];
    const api = bridge(state); await enter(api); await openMadman();
    expect(screen.getByRole("button", { name: "疯子成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: "囚犯成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "囚犯经历" }));
    const history = screen.getByRole("region", { name: "囚犯时期的经历" });
    for (const text of ["原窗与原桌", "原木垫块磨损已核实", "原普通协作", "原失败与归还均保留"]) expect(within(history).getByText(text)).toBeTruthy();
    expect(history.textContent).toContain("实际归还次数：2");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不得重做的囚犯作业")).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("preserves S9 original sources, outcomes and mastery without controls", () => {
    const prisoner = fixture(8).prisoner;
    prisoner.bottles = [{ id: "prisoner-old", title: "旧囚犯原瓶", source: "原劳动渠道", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "prisoner-old", confirmed: true } }];
    prisoner.abilities = [{ id: "chained.s9.body", label: "原强健身体", mastery: 42, description: "原有限身体能力" }];
    render(<MadmanPrisonerHistory prisoner={prisoner} />);
    expect(screen.getByText("来源：原劳动渠道")).toBeTruthy();
    expect(screen.getByText("已服用 · 失败")).toBeTruthy();
    expect(screen.getByText("原强健身体 · 掌握 42：原有限身体能力")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens an independent original at zero AP, cancels with focus return and confirms once without an extra checkbox", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶疯子魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("madman-potion-2")).toBeTruthy();
    expect(screen.getByText("来源：原渠道交接的第二瓶")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "疯子服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶疯子魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "madman-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps original source and eligibility authoritative and never renders unverified ingredients", async () => {
    const value = bottled(); value.formula = [{ name: "未核实的材料不可显示", quantity: 1, unit: "份" }];
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.queryByText("未核实的材料不可显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制造|查看并准备服用「第三瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "还没有度过四个完整序列9周。";
    rerender(<MadmanPanel madman={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶疯子魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(reason)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["removed", "promoted", "inside", "readOnly"] as const)("invalidates potion confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<MadmanPanel madman={{ ...value, actions: change === "removed" ? [] : value.actions, promoted: change === "promoted", insideCase: change === "inside" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps chosen practice after updates and exposes only observed public facts", async () => {
    const value = madman({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "taunting-note");
    rerender(<MadmanPanel madman={{ ...value, actions: [action({ type: "OBSERVE", caseId: "stop-bell" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("taunting-note");
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("sends chosen BURST and ORDINARY preparation without opening or charging a local attempt", async () => {
    const choices = (["BURST", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "stop-bell", method }, `准备${method}`));
    const { onCommand } = panel(madman({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByText("当前尝试：尚未开始本次尝试")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /实际停止/ })).toBeNull();
    const boundaries = screen.getByRole("region", { name: "实践范围与节制边界" });
    expect(boundaries.textContent).toContain("额外消耗10精神、2灵性");
    expect(boundaries.textContent).toContain("普通方法不付这笔强化成本");
  });

  it.each(["BURST", "ORDINARY"] as const)("makes actual STOP the only step for %s at zero resources and retains failure facts", async (method) => {
    const value = opened(method); const zero = { ...resources, health: 0, mind: 0, spirituality: 0, actionsRemaining: 0 };
    const { onCommand } = panel(value, vi.fn(), zero);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("weighted-gate"); expect(selector.disabled).toBe(true);
    const button = screen.getByRole("button", { name: /^实际停止本次闸门尝试/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /不得提前报告|不得另开实践/ })).toBeNull();
    expect(screen.getByText("原尝试失败，仍须实际停止。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "疯子成长下一步" }).textContent).toContain("不退还此前成本");
    await userEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STOP", caseId: "weighted-gate" });
    expect(screen.getByText("当前尝试：本次尝试仍未实际停止")).toBeTruthy();
  });

  it("locks Close, Escape, switching and ordinary life until actual STOP commits, then keeps the selected practice", async () => {
    const state = fixture(8, { madman: opened(), health: 0, mind: 0, spirituality: 0, actionsRemaining: 0, canAct: true });
    const api = bridge(state); let finish!: (result: SliceResult<SliceReceipt>) => void;
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValue(new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    api.submitIntent = submit; await enter(api);
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "囚犯经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /休养，1行动/ }) as HTMLButtonElement).disabled).toBe(true);
    const stop = screen.getByRole("button", { name: /^实际停止本次闸门尝试/ }); fireEvent.click(stop); fireEvent.click(stop);
    expect(submit).toHaveBeenCalledTimes(1);
    const envelope = submit.mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "MADMAN", command: { type: "STOP", caseId: "weighted-gate" } });
    const next = { ...state, revision: state.revision + 1, madman: { ...state.madman, insideCase: false,
      cases: state.madman.cases.map((entry) => entry.id === "weighted-gate" ? { ...entry, burstOpen: "已实际停止", stops: 1 } : entry),
      actions: [action({ type: "REPORT", caseId: "weighted-gate" }, "记录原失败与停止", false)],
    } };
    await act(async () => { finish(receipt(next, envelope)); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("weighted-gate");
    expect(screen.getByText("当前尝试：已实际停止")).toBeTruthy();
    expect(screen.getByText("实际停止次数：1 · 实际强化次数：1")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^记录原失败与停止/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });

  it("keeps a non-first practice in its drawer after PERFORM and requires a separately committed STOP", async () => {
    const state = fixture(8, { madman: madman({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "weighted-gate" }, "执行本次普通闸门尝试")] }) });
    const api = bridge(state); let finish!: (result: SliceResult<SliceReceipt>) => void;
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValue(new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    api.submitIntent = submit; await enter(api); await openMadman();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "weighted-gate");
    await userEvent.click(screen.getByRole("button", { name: /^执行本次普通闸门尝试/ }));
    expect(screen.queryByText("原尝试失败，仍须实际停止。")).toBeNull();
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "MADMAN", command: { type: "PERFORM", caseId: "weighted-gate" } });
    await act(async () => { finish(receipt({ ...state, revision: state.revision + 1, madman: opened("ORDINARY") }, submit.mock.calls[0]![0])); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("weighted-gate");
    expect(screen.getByRole("button", { name: /^实际停止本次闸门尝试/ })).toBeTruthy();
    expect(screen.getByText("实际停止次数：0 · 实际强化次数：0")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("does not turn historical open-attempt prose into a navigation lock", async () => {
    const historical = opened(); historical.insideCase = false; historical.actions = [];
    const api = bridge(fixture(8, { madman: historical })); await enter(api); await openMadman();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("lets an older actual prisoner return take priority over the S8 stop", async () => {
    const state = fixture(8, { madman: opened() });
    state.prisoner.insideCase = true;
    state.prisoner.cases = [{ id: "jammed-shutter", title: "原撑窗实践", story: "原木仍借用", observations: [], preparation: null, result: null, status: "EXAMINED", holding: "原木仍在手中", returns: 0 }];
    state.prisoner.actions = [{ id: "return", label: "先实际归还原木垫块", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "jammed-shutter" } }];
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt({ ...state, revision: state.revision + 1, prisoner: { ...state.prisoner, insideCase: false, actions: [] } }, envelope));
    await enter(api);
    expect(screen.getByRole("region", { name: "囚犯成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "疯子成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^先实际归还原木垫块/ }));
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "PRISONER", command: { type: "RETURN", caseId: "jammed-shutter" } });
    expect(await screen.findByRole("region", { name: "疯子成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^实际停止本次闸门尝试/ })).toBeTruthy();
  });

  it("keeps the actual stop and exact envelope pending across a save failure", async () => {
    const state = fixture(8, { madman: opened(), mind: 0, spirituality: 0, actionsRemaining: 0 });
    const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "实际停止保存尚未确认", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, madman: { ...state.madman, insideCase: false, actions: [] } }, envelope));
    api.submitIntent = submit; await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /^实际停止本次闸门尝试/ }));
    expect(screen.getByRole("alert").textContent).toContain("实际停止保存尚未确认");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: /^实际停止本次闸门尝试/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(await screen.findByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });
});

function battle(): NonNullable<SliceProjection["combat"]> {
  return { title: "原现场冲突", round: 1, enemyName: "持棍的对手", enemyHealth: 100, enemyStatus: "RESISTING",
    playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [],
    consequenceWeights: { light: 65, heavy: 30, death: 5 },
    stances: [{ id: "ATTACK", label: "进攻", description: "公开进攻姿态" }, { id: "DEFEND", label: "防守", description: "公开防守姿态" }, { id: "RETREAT", label: "撤退", description: "公开撤退姿态" }], lastRound: null };
}
const holdName = "保持理智";
const burstName = "首次条件满足时短暂强化";
const roundButton = "确认姿态，结算完整回合";
function committedRound(): SliceCombatRound {
  return { round: 1, stance: "ATTACK", first: "PLAYER", playerCount: 2, enemyCount: 1, playerCountRoll: 70, enemyCountRoll: 20,
    moves: [{ actor: "PLAYER", label: "自主短暂强化的近身主攻", selfGain: 14, enemyReduction: 0 }],
    playerAdvantage: 14, enemyAdvantage: 5, winChance: 65, winner: "PLAYER", consequence: "原物理后果盘结果保留。",
    consequenceWeights: { light: 65, heavy: 30, death: 5 }, retreat: "NONE",
    madmanBurst: { policy: "BURST_FIRST", triggered: true, mentalCost: 10, spiritualCost: 2 },
  };
}

describe("Madman round-level choice", () => {
  it("defaults to HOLD, explains exact costs and spends nothing on radio selection", async () => {
    const api = bridge(fixture(8, { combat: battle(), canAct: false })); await enter(api);
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
    const group = screen.getByRole("group", { name: "本回合短暂强化策略" });
    for (const text of ["10精神、2灵性", "25% × 掌握系数（0.65–1）", "不增加攻击次数", "选择撤退都不付强化成本"]) expect(group.textContent).toContain(text);
    await userEvent.click(screen.getByRole("radio", { name: burstName }));
    expect(api.submitIntent).not.toHaveBeenCalled();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("submits exactly one explicit default HOLD in the existing round envelope", async () => {
    const state = fixture(8, { combat: battle(), canAct: false }); const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockImplementation(async (envelope) => receipt({ ...state, revision: state.revision + 1, combat: { ...battle(), round: 2 } }, envelope));
    api.submitIntent = submit; await enter(api);
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", madmanPolicy: "HOLD" });
  });

  it("sends one chosen policy, shows committed costs, and resets on the next authoritative round", async () => {
    const state = fixture(8, { combat: battle(), canAct: false }); const api = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValue(new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    api.submitIntent = submit; await enter(api);
    await userEvent.click(screen.getByRole("radio", { name: burstName }));
    const confirm = screen.getByRole("button", { name: roundButton }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1); const envelope = submit.mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", madmanPolicy: "BURST_FIRST" });
    const round = committedRound();
    await act(async () => { finish(receipt({ ...state, revision: state.revision + 1, combat: { ...battle(), round: 2, lastRound: round }, lastCombatRound: round, combatHistory: [round] }, envelope)); });
    expect(screen.getByRole("heading", { name: "第 1 回合结果" })).toBeTruthy();
    expect(screen.getByText(/实际消耗 10精神、2灵性/)).toBeTruthy();
    expect(screen.getByText(/自主短暂强化的近身主攻/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "进入下一回合" }));
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
  });

  it("shows insufficient resources without charging for an untriggered selection", async () => {
    const api = bridge(fixture(8, { combat: battle(), canAct: false, mind: 9, spirituality: 1 })); await enter(api);
    expect(screen.getByText(/当前资源不足：短暂强化需要至少10精神与2灵性/)).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: burstName }));
    expect((screen.getByRole("radio", { name: burstName }) as HTMLInputElement).checked).toBe(true);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains chosen policy and retries the exact original envelope after save failure", async () => {
    const state = fixture(8, { combat: battle(), canAct: false }); const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "强化回合保存尚未确认", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, combat: { ...battle(), round: 2 } }, envelope));
    api.submitIntent = submit; await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /^防守/ }));
    await userEvent.click(screen.getByRole("radio", { name: burstName }));
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(screen.getByRole("alert").textContent).toContain("强化回合保存尚未确认");
    expect((screen.getByRole("group", { name: "本回合短暂强化策略" }) as HTMLFieldSetElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: holdName }));
    expect((screen.getByRole("radio", { name: burstName }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "DEFEND", madmanPolicy: "BURST_FIRST" });
    await screen.findByRole("heading", { name: "第 2 回合" });
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
  });

  it.each([null, 9] as const)("does not expose or send an S8 policy for sequence %s", async (sequence) => {
    const state = fixture(sequence, { combat: battle(), canAct: false }); const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockImplementation(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit; await enter(api);
    expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK" });
  });

  it("resets authorization on a new revision even if the projected round number is unchanged", async () => {
    const state = fixture(8, { combat: battle(), canAct: false }); const api = bridge(state);
    api.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    await enter(api); await userEvent.click(screen.getByRole("radio", { name: burstName }));
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", madmanPolicy: "BURST_FIRST" });
  });

  it("preserves the independent tyrant rage policy and sends no madman policy", async () => {
    const state = fixture(8, { combat: { ...battle(), rage: { charge: 2 } }, canAct: false }); state.progression.pathwayId = "tyrant";
    const api = bridge(state); const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockImplementation(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit; await enter(api);
    expect(screen.queryByRole("radio", { name: burstName })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "首次满足条件时释放怒击" }));
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", ragePolicy: "RELEASE_FIRST" });
  });
});
