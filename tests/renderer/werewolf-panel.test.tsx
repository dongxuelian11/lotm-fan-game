/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { WerewolfAction, WerewolfCommand, WerewolfProjection } from "../../src/domain/werewolf/types";
import type { SliceCombatRound, SliceProjection } from "../../src/domain/slice/types";
import { WerewolfPanel, WerewolfMadmanHistory, WerewolfPrisonerHistory } from "../../src/renderer/WerewolfPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const zero = { ...resources, health: 0, mind: 0, spirituality: 0, actionsRemaining: 0 };
const risk = "服用存在大成功、成功、失败、大失败四档结果；失败保留实际代价。";
function action(command: WerewolfCommand, label = "观察原现场", enabled = true, cost = "1行动 · 本案公开成本"): WerewolfAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "原公开限制仍未解除。", command };
}
const guidance = action({ type: "LEARN_GUIDANCE" }, "学习狼人服用指导");
function werewolf(patch: Partial<WerewolfProjection> = {}): WerewolfProjection {
  return { title: "狼人晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "疯子扮演100，已度过8/8个完整序列8周。", pollution: 3, risk,
    cases: [], environment: "", insideCase: false,
    moon: { pending: false, summary: "本次月圆已过，下次仍会到来。", history: [] }, ...patch };
}
function cases(): WerewolfProjection["cases"] {
  return ["existing-wound", "claw-mark", "night-route"].map((id, index) => ({ id,
    title: `有限实践${index + 1}`, story: `原现场与普通退路${index + 1}`, observations: [], preparation: null,
    result: null, status: "AVAILABLE", sceneOpen: "尚未打开本次现场", returns: 0 }));
}
function opened(method: "ABILITY" | "ORDINARY" = "ABILITY"): WerewolfProjection {
  return werewolf({ promoted: true, insideCase: true, title: "狼人 · 序列7",
    cases: cases().map((entry) => entry.id === "claw-mark" ? { ...entry, status: "EXAMINED",
      observations: ["原木与普通退路已核实"], preparation: `已实际采用${method}`,
      sceneOpen: "本次现场仍未实际收拾返回", result: "原尝试失败，仍须实际返回。" } : entry),
    actions: [action({ type: "RETURN", caseId: "claw-mark" }, "实际收拾原木并返回", true, "0行动 · 0精神 · 0灵性"),
      action({ type: "REPORT", caseId: "claw-mark" }, "不得提前报告"),
      action({ type: "OBSERVE", caseId: "existing-wound" }, "不得另开实践")] });
}
function moonPending(): WerewolfProjection {
  return werewolf({ promoted: true, insideCase: true, cases: cases(),
    moon: { pending: true, summary: "本次月圆尚未实际过夜。", history: [] },
    actions: [action({ type: "HANDLE_MOON", method: "GUARDED" }, "在原哈伦工坊接受看守过夜", true, "0行动 · 最多10精神 · 0灵性"),
      action({ type: "HANDLE_MOON", method: "ALONE" }, "在当前地点停止接触并独自过夜", true, "0行动 · 最多20精神 · 0灵性"),
      action({ type: "OBSERVE", caseId: "existing-wound" }, "不得在月圆中另开实践"),
      action({ type: "REFLECT" }, "不得用反思跳过月圆")] });
}
function bottled(): WerewolfProjection {
  return werewolf({ guidanceKnown: true, supplies: "三瓶独立狼人成品，完整配方尚未核实，费用与劳动条件按公开记录。",
    actions: [1, 2].map((n) => action({ type: "CONSUME", bottleId: `werewolf-potion-${n}`, confirmed: true }, `服用原瓶${n}`, true, "0行动 · 消耗这瓶独立原瓶")),
    bottles: [1, 2, 3].map((n) => ({ id: `werewolf-potion-${n}`, title: `第${n}瓶狼人魔药`, source: `原渠道第${n}瓶独立成品`,
      status: n === 3 ? "尚未交付" : "已交付，尚未服用", chance: n === 1 ? 71 : 43,
      command: { type: "CONSUME" as const, bottleId: `werewolf-potion-${n}`, confirmed: true as const } })) });
}
function panel(value: WerewolfProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<WerewolfPanel werewolf={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("werewolf-renderer-run", sliceDefaultCreationSelection, "werewolf-renderer-seed");
  raw.week = 20; raw.activeEvent = null; raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return { ...state, canAct: true, actionBlockedReason: null,
    prisoner: { ...state.prisoner, discovered: sequence !== null, promoted: sequence !== null, title: "囚犯 · 序列9", acting: 100, actions: [] },
    madman: { ...state.madman, promoted: sequence === 8 || sequence === 7, title: "疯子 · 序列8", acting: 100, actions: [] },
    werewolf: werewolf({ promoted: sequence === 7, title: sequence === 7 ? "狼人 · 序列7" : "狼人晋升", actions: sequence === 7 ? [] : [guidance] }),
    progression: { pathwayId: sequence === null ? null : "chained", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 10 },
    ...patch };
}
function bridge(state: SliceProjection): SliceBridge {
  return { getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{
    runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week,
    date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn() };
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
async function openWerewolf() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "狼人晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Werewolf sequence seven dossier", () => {
  it("keeps eighteen ordinary choices and no S7 shortcut", async () => {
    const api = bridge(fixture(null)); await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "囚犯之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /狼人/ })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("keeps S8 current while its tab and advancement guide open S7 preparation", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "疯子成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "狼人晋升" }));
    expect(screen.getByRole("region", { name: "狼人成长下一步" }).textContent).toContain("疯子100消化与八个完整序列8周");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "狼人成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("defaults S7 to current growth and exposes S9 and S8 only as original histories", async () => {
    const state = fixture(7); state.seer.discovered = true;
    state.madman.cases = [{ id: "weighted-gate", title: "原闸门尝试", story: "原闸门与原铃", observations: ["原边界已核实"], preparation: "原普通方法", result: "原失败与停止保留", status: "RESOLVED", burstOpen: "已实际停止", stops: 2, burstUses: 1 }];
    state.madman.actions = [{ id: "stale", label: "不得重做的疯子实践", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "weighted-gate" } }];
    const api = bridge(state); await enter(api); await openWerewolf();
    expect(screen.getByRole("button", { name: "狼人成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "疯子经历" }));
    const history = screen.getByRole("region", { name: "疯子时期的经历" });
    for (const text of ["原闸门与原铃", "原边界已核实", "原普通方法", "原失败与停止保留"]) expect(within(history).getByText(text)).toBeTruthy();
    expect(history.textContent).toContain("实际停止次数：2"); expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不得重做的疯子实践")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "囚犯经历" }));
    expect(screen.getByRole("region", { name: "囚犯时期的经历" }).textContent).toContain("已晋升狼人");
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("retains prior originals, costs, results and mastery without history controls", () => {
    const state = fixture(7);
    state.prisoner.bottles = [{ id: "prisoner-old", title: "旧囚犯原瓶", source: "原劳动渠道", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "prisoner-old", confirmed: true } }];
    state.madman.abilities = [{ id: "chained.s8.burst", label: "原短暂强化", mastery: 42, description: "原理智代价保留" }];
    render(<><WerewolfPrisonerHistory prisoner={state.prisoner} /><WerewolfMadmanHistory madman={state.madman} /></>);
    expect(screen.getByText("来源：原劳动渠道")).toBeTruthy(); expect(screen.getByText("已服用 · 失败")).toBeTruthy();
    expect(screen.getByText("原短暂强化 · 掌握 42：原理智代价保留")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
  });
  it("opens an independent original at zero AP and confirms body changes and monthly curse once without a checkbox", async () => {
    const { onCommand } = panel(bottled()); const first = screen.getByRole("button", { name: /查看并准备服用「第1瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}"); expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第1瓶狼人魔药" }));
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第1瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第2瓶/ }));
    expect(screen.getByText("werewolf-potion-2")).toBeTruthy(); expect(screen.getByText("来源：原渠道第2瓶独立成品")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    const warning = screen.getByRole("region", { name: "狼人服用风险与四档结果" });
    for (const text of [risk, "身体变化", "月圆诅咒", "嗜血冲动", "不会自动执行暴力"]) expect(warning.textContent).toContain(text);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    const confirm = screen.getByRole("button", { name: "确认服用「第2瓶狼人魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "werewolf-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps public bottle eligibility and costs authoritative without invented ingredients", async () => {
    const value = bottled(); value.formula = [{ name: "未核实材料", quantity: 1, unit: "份" }];
    const { onCommand, rerender } = panel(value); expect(screen.queryByText("未核实材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制造|查看并准备服用「第3瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第1瓶/ }));
    rerender(<WerewolfPanel werewolf={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "还未度过八个完整序列8周。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第1瓶狼人魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("还未度过八个完整序列8周。")).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(onCommand).not.toHaveBeenCalled();
  });
  it.each(["removed", "promoted", "inside", "moon"] as const)("invalidates a potion confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第1瓶/ }));
    rerender(<WerewolfPanel werewolf={{ ...value, actions: change === "removed" ? [] : value.actions, promoted: change === "promoted", insideCase: change === "inside", moon: { ...value.moon, pending: change === "moon" } }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });
  it("preserves selected work and sends either preparation without local execution or payment", async () => {
    const value = werewolf({ promoted: true, cases: cases(), actions: [] }); const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "night-route");
    const choices = (["ABILITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "night-route", method }, `准备${method}`));
    rerender(<WerewolfPanel werewolf={{ ...value, actions: choices }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("night-route");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByText("当前现场：尚未打开本次现场")).toBeTruthy(); expect(screen.queryByRole("button", { name: /实际收拾/ })).toBeNull();
  });
  it.each(["ABILITY", "ORDINARY"] as const)("shows only matching actual RETURN for %s at zero resources", async (method) => {
    const { onCommand } = panel(opened(method), vi.fn(), zero);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("claw-mark"); expect(selector.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /不得提前报告|不得另开实践/ })).toBeNull();
    expect(screen.getByText("原尝试失败，仍须实际返回。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "狼人成长下一步" }).textContent).toContain("不退还此前成本");
    const exit = screen.getByRole("button", { name: /^实际收拾原木并返回/ }); expect((exit as HTMLButtonElement).disabled).toBe(false); await userEvent.click(exit);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", caseId: "claw-mark" }); expect(screen.getByText("当前现场：本次现场仍未实际收拾返回")).toBeTruthy();
  });
  it("locks Close, Escape, switching and life through PERFORM until a separate RETURN commits", async () => {
    const state = fixture(7, { werewolf: werewolf({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "claw-mark" }, "执行本次普通原木检验")] }) });
    const api = bridge(state); const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, werewolf: opened("ORDINARY") }, envelope))
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 2, werewolf: { ...opened("ORDINARY"), insideCase: false,
        cases: opened("ORDINARY").cases.map((entry) => entry.id === "claw-mark" ? { ...entry, sceneOpen: "已实际收拾并返回", returns: 1 } : entry),
        actions: [action({ type: "REPORT", caseId: "claw-mark" }, "记录原失败与返回", false)] } }, envelope));
    api.submitIntent = submit; await enter(api); await openWerewolf();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "claw-mark");
    await userEvent.click(screen.getByRole("button", { name: /^执行本次普通原木检验/ }));
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "WEREWOLF", command: { type: "PERFORM", caseId: "claw-mark" } });
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull(); await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "疯子经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /休养，1行动/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际收拾原木并返回/ }));
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "WEREWOLF", command: { type: "RETURN", caseId: "claw-mark" } });
    expect(screen.getByText("当前现场：已实际收拾并返回")).toBeTruthy(); expect(screen.getByText("实际返回次数：1")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("claw-mark");
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });
  it("retains a real return and retries exactly the same envelope after failed saving", async () => {
    const state = fixture(7, { werewolf: opened(), mind: 0, spirituality: 0, actionsRemaining: 0 }); const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "实际返回保存尚未确认", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, werewolf: { ...state.werewolf, insideCase: false, actions: [] } }, envelope));
    api.submitIntent = submit; await enter(api); await userEvent.click(screen.getByRole("button", { name: /^实际收拾原木并返回/ }));
    expect(screen.getByRole("alert").textContent).toContain("实际返回保存尚未确认");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: /^实际收拾原木并返回/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(await screen.findByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });
  it.each(["prisoner", "madman"] as const)("lets an older actual %s exit take priority over the S7 moon", async (older) => {
    const state = fixture(7, { werewolf: moonPending() });
    if (older === "prisoner") {
      state.prisoner.insideCase = true;
      state.prisoner.cases = [{ id: "jammed-shutter", title: "原撑窗实践", story: "原木仍借用", observations: [], preparation: null, result: null, status: "EXAMINED", holding: "原木仍在手中", returns: 0 }];
      state.prisoner.actions = [{ id: "return", label: "先实际归还原木垫块", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "jammed-shutter" } }];
    } else {
      state.madman.insideCase = true;
      state.madman.cases = [{ id: "weighted-gate", title: "原闸门实践", story: "原尝试仍未停止", observations: [], preparation: null, result: null, status: "EXAMINED", burstOpen: "仍须停止", stops: 0, burstUses: 1 }];
      state.madman.actions = [{ id: "stop", label: "先实际停止原闸门尝试", cost: "0行动", enabled: true, reason: null, command: { type: "STOP", caseId: "weighted-gate" } }];
    }
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt({ ...state, revision: state.revision + 1, [older]: { ...state[older], insideCase: false, actions: [] } }, envelope));
    await enter(api); expect(screen.queryByRole("group", { name: "本次月圆处理选择" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: older === "prisoner" ? /^先实际归还原木垫块/ : /^先实际停止原闸门尝试/ }));
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload.type).toBe(older === "prisoner" ? "PRISONER" : "MADMAN");
    expect(await screen.findByRole("group", { name: "本次月圆处理选择" })).toBeTruthy();
  });
  it("does not infer a lock from historical scene or moon prose", async () => {
    const historical = opened(); historical.insideCase = false; historical.actions = [];
    historical.moon = { pending: false, summary: "旧记录说月圆尚未过夜，但已按实际状态结清。", history: [{ week: 16, method: "ALONE", mentalCost: 20 }] };
    const api = bridge(fixture(7, { werewolf: historical })); await enter(api); await openWerewolf();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy(); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it.each(["GUARDED", "ALONE"] as const)("allows public %s handling with all resources zero and no local resolution", async (method) => {
    const { onCommand } = panel(moonPending(), vi.fn(), zero);
    const choices = within(screen.getByRole("group", { name: "本次月圆处理选择" })); expect(choices.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /不得在月圆|不得用反思/ })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    const moon = screen.getByRole("region", { name: "月圆诅咒与实际过夜" });
    for (const text of ["毛发增生", "嗜血冲动", "理智承压", "不会自动执行暴力", "贝克兰德", "10中的较小值", "20中的较小值", "下次月圆仍会到来"]) expect(moon.textContent).toContain(text);
    await userEvent.click(choices.getByRole("button", { name: method === "GUARDED" ? /^在原哈伦工坊/ : /^在当前地点/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "HANDLE_MOON", method }); expect(screen.getByText("本次月圆尚未实际过夜。")).toBeTruthy();
  });
  it("shows unavailable guarded help while retaining the actual public alternative", async () => {
    const value = moonPending(); value.actions[0] = { ...value.actions[0]!, enabled: false, reason: "当前不在贝克兰德原工坊。" };
    const { onCommand } = panel(value, vi.fn(), zero);
    expect((screen.getByRole("button", { name: /^在原哈伦工坊/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("当前不在贝克兰德原工坊。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^在当前地点/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "HANDLE_MOON", method: "ALONE" });
  });
  it("keeps moon costs, locks and exact retry until an authoritative overnight commits", async () => {
    const state = fixture(7, { werewolf: moonPending(), mind: 0, spirituality: 0, actionsRemaining: 0 }); const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "过夜保存尚未确认", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, werewolf: { ...state.werewolf, insideCase: false, actions: [],
        moon: { pending: false, summary: "本次已在原工坊过夜，下一次仍会到来。", history: [{ week: 20, method: "GUARDED", mentalCost: 0 }] } } }, envelope));
    api.submitIntent = submit; await enter(api);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull(); await userEvent.keyboard("{Escape}");
    expect((screen.getByRole("button", { name: "囚犯经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /休养，1行动/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^在原哈伦工坊/ }));
    expect(screen.getByRole("alert").textContent).toContain("过夜保存尚未确认");
    expect((screen.getByRole("button", { name: /^在当前地点/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]); expect(submit.mock.calls[1]![0].payload).toEqual({ type: "WEREWOLF", command: { type: "HANDLE_MOON", method: "GUARDED" } });
    expect(screen.getByText(/第20周 · 原哈伦工坊看守过夜 · 实际精神消耗0/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "本次月圆处理选择" })).toBeNull(); expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });
  it("reopens a saved pending moon after reload without charging or choosing for the player", async () => {
    const state = fixture(7, { werewolf: moonPending(), actionsRemaining: 0 });
    state.werewolf.moon.history = [{ week: 16, method: "ALONE", mentalCost: 7 }];
    const api = bridge(state); await enter(api);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(guide.textContent).toContain("先实际度过本次月圆");
    expect(guide.textContent).toContain("当前地点停止接触");
    expect(guide.textContent).toContain("打开狼人卷宗，在原哈伦工坊接受看守，或在当前地点停止接触并独自过夜。两者均0行动、0灵性，精神为0仍可执行；分别实际扣除最多10或20精神，不治疗、不奖励，下次月圆仍会到来。本阶段只处理有限已公示月相事件，不代表精确历法。");
    expect(guide.textContent).not.toContain("先实际收拾现场并返回");
    expect(guide.textContent).not.toContain("安全地点");
    expect(screen.getByRole("group", { name: "本次月圆处理选择" })).toBeTruthy();
    expect(screen.getByText(/第16周 · 原地点停止接触并独自过夜 · 实际精神消耗7/)).toBeTruthy();
    cleanup(); await enter(api);
    expect(screen.getByRole("group", { name: "本次月圆处理选择" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("treats the public aggregate insideCase as a moon scene when moon.pending is true", () => {
    const value = moonPending(); expect(value.insideCase).toBe(true);
    panel(value, vi.fn(), zero);
    expect(screen.getByRole("group", { name: "本次月圆处理选择" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^实际收拾原木并返回/ })).toBeNull();
    expect(screen.getByRole("region", { name: "狼人成长下一步" }).textContent).toContain("先度过本次月圆");
    expect(screen.queryByRole("combobox")).toBeNull();
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
    moves: [{ actor: "PLAYER", label: "继承短暂强化的狼人近身主攻", selfGain: 14, enemyReduction: 0 }],
    playerAdvantage: 14, enemyAdvantage: 5, winChance: 65, winner: "PLAYER", consequence: "原物理后果盘结果保留。",
    consequenceWeights: { light: 65, heavy: 30, death: 5 }, retreat: "NONE",
    madmanBurst: { policy: "BURST_FIRST", triggered: true, mentalCost: 10, spiritualCost: 2 } };
}
describe("Werewolf inherited round policy", () => {
  it("inherits only the two original choices and sends the explicit default HOLD", async () => {
    const state = fixture(7, { combat: battle(), canAct: false }); const api = bridge(state);
    api.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt({ ...state, revision: state.revision + 1, combat: { ...battle(), round: 2 } }, envelope));
    await enter(api); expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole("radio")).toHaveLength(2); expect(screen.getByRole("group", { name: "本回合短暂强化策略" }).textContent).toContain("10精神、2灵性");
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", madmanPolicy: "HOLD" });
  });
  it("retains inherited policy across saving failure and retries the exact original intent", async () => {
    const state = fixture(7, { combat: battle(), canAct: false, mind: 9, spirituality: 1 }); const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "狼人回合保存尚未确认", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, combat: { ...battle(), round: 2 } }, envelope));
    api.submitIntent = submit; await enter(api); expect(screen.getByText(/当前资源不足：短暂强化需要至少10精神与2灵性/)).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: burstName })); expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^防守/ })); await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect((screen.getByRole("group", { name: "本回合短暂强化策略" }) as HTMLFieldSetElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]); expect(submit.mock.calls[1]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "DEFEND", madmanPolicy: "BURST_FIRST" });
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
  });
  it("submits once, renders original committed costs and resets the next round to HOLD", async () => {
    const state = fixture(7, { combat: battle(), canAct: false }); const api = bridge(state); let finish!: (result: SliceResult<SliceReceipt>) => void;
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValue(new Promise((resolve) => { finish = resolve; })); api.submitIntent = submit;
    await enter(api); await userEvent.click(screen.getByRole("radio", { name: burstName }));
    const confirm = screen.getByRole("button", { name: roundButton }); fireEvent.click(confirm); fireEvent.click(confirm); expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", madmanPolicy: "BURST_FIRST" });
    const round = committedRound(); await act(async () => { finish(receipt({ ...state, revision: state.revision + 1, combat: { ...battle(), round: 2, lastRound: round }, lastCombatRound: round, combatHistory: [round] }, submit.mock.calls[0]![0])); });
    expect(screen.getByText(/实际消耗 10精神、2灵性/)).toBeTruthy(); expect(screen.getByText(/继承短暂强化的狼人近身主攻/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "进入下一回合" })); expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
  });
});
