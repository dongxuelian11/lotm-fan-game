/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { BARBARIAN_ABILITIES, BARBARIAN_CONSUMPTION_RISK, BARBARIAN_FORMULA } from "../../src/domain/barbarian/content";
import { LAWYER_ABILITIES } from "../../src/domain/lawyer/content";
import type { BarbarianAction, BarbarianCommand, BarbarianProjection } from "../../src/domain/barbarian/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { BarbarianPanel } from "../../src/renderer/BarbarianPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: BarbarianCommand, label = "执行本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): BarbarianAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const learn = action({ type: "LEARN_FORMULA" }, "向米蕾·沃德学习野蛮人配方", true, "180便士 · 1行动");
function barbarian(patch: Partial<BarbarianProjection> = {}): BarbarianProjection {
  return {
    title: "野蛮人晋升", discovered: true, promoted: false, formulaKnown: false,
    formula: [], supplies: "", actions: [learn], bottles: [], abilities: [],
    acting: 0, digestion: "律师扮演100，已度过4/4个完整序列9周。", pollution: 3,
    risk: BARBARIAN_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): BarbarianProjection {
  return barbarian({
    formulaKnown: true, formula: [...BARBARIAN_FORMULA],
    supplies: "第一批与第二批的六项实际材料分别调配成瓶；第三批尚由米蕾·沃德保管。",
    actions: ["barbarian-batch-1:bottle", "barbarian-batch-2:bottle"].map((bottleId) =>
      action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: [
      { id: "barbarian-batch-1:bottle", title: "第一瓶野蛮人魔药", source: "第一批六项实际原料的调配记录", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "barbarian-batch-1:bottle", confirmed: true } },
      { id: "barbarian-batch-2:bottle", title: "第二瓶野蛮人魔药", source: "第二批六项实际原料的调配记录", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "barbarian-batch-2:bottle", confirmed: true } },
    ],
  });
}
function cases(): BarbarianProjection["cases"] {
  return [
    { id: "wedged-cart", title: "卡住的货车", story: "原车的楔块与受力情况尚待观察。" },
    { id: "heavy-archive", title: "沉重的档案", story: "须确认原档案箱的落点与协作边界。" },
    { id: "spoken-pressure", title: "言语压力", story: "本次对话有明确停止条件，对方仍有自主选择。" },
  ].map((entry) => ({ ...entry, observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "尚未开始本次接触", closes: 0 }));
}
function opened(): BarbarianProjection {
  return barbarian({ promoted: true, insideCase: true, cases: cases().map((entry) => entry.id === "heavy-archive" ? {
    ...entry, status: "EXAMINED", observations: ["原档案箱的右侧落点已确认。"], preparation: "已选择普通协作。",
    result: "这次尝试未成功，仍须实际放下原档案箱。", contactOpen: "原档案箱尚未实际放下",
  } : entry), actions: [action({ type: "CLOSE", caseId: "heavy-archive" }, "实际放下原档案箱并结束作业", true, "0行动 · 0精神 · 0灵性 · 不退款、不治疗")] });
}
function panel(value: BarbarianProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<BarbarianPanel barbarian={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("barbarian-renderer-run", sliceDefaultCreationSelection, "barbarian-renderer-seed");
raw.week = 20; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: null | 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    lawyer: { ...base.lawyer, discovered: sequence !== null, promoted: sequence !== null, acting: 100, digestion: "律师时期已完成消化。", actions: [] },
    barbarian: barbarian({ title: sequence === 8 ? "野蛮人 · 序列8" : "野蛮人晋升", promoted: sequence === 8,
      actions: sequence === 8 ? [] : [learn], abilities: sequence === 8 ? [...LAWYER_ABILITIES, ...BARBARIAN_ABILITIES].map((entry) => ({ ...entry, mastery: 120 })) : [],
    }),
    progression: { pathwayId: sequence === null ? null : "black-emperor", sequence, mastery: {}, acting: sequence === 8 ? 0 : 100, promotionWeek: sequence === null ? null : 5 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week,
      date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:01:00Z",
    }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:02:00Z", replayed: false, state } };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openBarbarian() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^野蛮人(?:晋升|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Barbarian sequence-eight public crafting and finite-strength dossier", () => {
  it("keeps twenty ordinary starts and does not offer Barbarian before Lawyer", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(tabs.getAllByRole("button")).toHaveLength(22);
    expect(tabs.getByRole("button", { name: "律师之路" })).toBeTruthy();
    expect(tabs.queryByRole("button", { name: /野蛮人/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("routes Lawyer's advancement guide to projected formula preparation and its maturity gate", async () => {
    const reason = "律师扮演100；尚未度过四个完整序列9周。";
    const api = bridge(fixture(9, { barbarian: barbarian({ actions: [{ ...learn, enabled: false, reason }], digestion: reason }) }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "野蛮人成长下一步" }).textContent).toContain("米蕾·沃德");
    const button = screen.getByRole("button", { name: /^向米蕾·沃德学习/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /直接晋升|跳过/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows five public abilities and retains Lawyer history without mutation controls", async () => {
    const state = fixture(8);
    state.lawyer = { ...state.lawyer, cases: [{ id: "duplicated-receipt", title: "旧收据核对", story: "原文书已放回。", status: "RESOLVED",
      observations: ["原收据只证实一处重复。"], preparation: "原普通核对准备", result: "当事人拒绝接受原论证。", contactOpen: "已实际结束", closes: 1 }],
      actions: [{ id: "old-action", label: "不应继续的旧律师行动", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api);
    expect(screen.getByText("野蛮人 · 序列8 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看野蛮人成长" }));
    const abilities = within(screen.getByRole("region", { name: "野蛮人能力与消化" }));
    for (const entry of [...LAWYER_ABILITIES, ...BARBARIAN_ABILITIES]) expect(abilities.getByText(`${entry.label} · 掌握 120`)).toBeTruthy();
    expect(abilities.getByText(/精神抗性不是精神免疫/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /发动贿赂|发动扭曲|精神免疫/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "律师经历" }));
    const history = within(screen.getByRole("region", { name: "律师时期的经历" }));
    expect(history.getByText("律师扮演进度 100 · 律师时期已完成消化。")).toBeTruthy();
    expect(history.getByText("当事人拒绝接受原论证。")).toBeTruthy();
    expect(history.queryAllByRole("button")).toHaveLength(0); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("renders the known six-material formula, preserves unknown source quantity and invents no bottles", () => {
    const supplies = "原料批次尚由米蕾·沃德保管；劳动0/3，主材1050便士，辅材100便士，调配60便士与1行动。";
    const value = barbarian({ formula: [...BARBARIAN_FORMULA], supplies });
    const { rerender, onCommand } = panel(value);
    expect(screen.queryByText("狂化草")).toBeNull();
    expect(screen.getByText(supplies)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    rerender(<BarbarianPanel barbarian={{ ...value, formulaKnown: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    for (const material of BARBARIAN_FORMULA) expect(screen.getByText(material.name)).toBeTruthy();
    expect(screen.getByText("数量原文未注明")).toBeTruthy();
    expect(screen.getByText("原著未给明确数量或重量；本作G每批供货1份。")).toBeTruthy();
    expect(screen.getByText("10 mL")).toBeTruthy(); expect(screen.getByText("100 mL")).toBeTruthy();
    expect(screen.queryByText(/已调配，尚未服用/)).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("sends only projected batch and supply commands with their actual costs", async () => {
    const commands: BarbarianCommand[] = [{ type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "barbarian-batch-2" },
      { type: "BUY_MATERIALS", batchId: "barbarian-batch-2" }, { type: "BREW", batchId: "barbarian-batch-2" }, { type: "REQUEST_SUPPLY" }];
    const labels = ["学习本次配方", "为第二批劳动", "取得第二批六料", "调配第二批原料", "申请后续材料批次"];
    const costs = ["180便士 · 1行动", "1行动 · 完成3/3次劳动抵主材1050便士", "辅材100便士 · 0行动", "60便士 · 1行动", "1行动 · 下周领取"];
    const receive = { ...action({ type: "RECEIVE_SUPPLY" }, "实际领取后续材料", false, "0行动"), reason: "尚未到下一周。" };
    const value = barbarian({ actions: [...commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)), receive] });
    const { onCommand, rerender } = panel(value);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    fireEvent.click(screen.getByRole("button", { name: /^实际领取后续材料/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    rerender(<BarbarianPanel barbarian={{ ...value, actions: [{ ...receive, enabled: true, reason: null }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^实际领取后续材料/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "RECEIVE_SUPPLY" });
  });

  it("cancels at zero AP, restores focus and independently confirms only the chosen original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: "查看并准备服用「第一瓶野蛮人魔药」" });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶野蛮人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶野蛮人魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶野蛮人魔药」" }));
    expect(screen.getByText("barbarian-batch-2:bottle")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByRole("region", { name: "野蛮人服用风险与四档结果" }).textContent).toContain(BARBARIAN_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const button = screen.getByRole("button", { name: "确认服用「第二瓶野蛮人魔药」" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "barbarian-batch-2:bottle", confirmed: true });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("invalidates the consumed original and displays a failed bottle only as committed history", async () => {
    const value = bottled(); const { rerender, onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶野蛮人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶野蛮人魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 本次失败，原料与原瓶不会恢复" } : bottle) };
    rerender(<BarbarianPanel barbarian={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶野蛮人魔药」" })).toBeNull();
    expect(screen.getByText("已耗用 · 本次失败，原料与原瓶不会恢复")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶野蛮人魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps ability and ordinary preparations explicit and does not turn preparation into an outcome", async () => {
    const commands: BarbarianCommand[] = [{ type: "PREPARE", caseId: "wedged-cart", method: "ABILITY" }, { type: "PREPARE", caseId: "wedged-cart", method: "ORDINARY" }];
    const value = barbarian({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, index ? "准备普通协作" : "准备有限体能")) });
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通协作/ }));
    await userEvent.click(screen.getByRole("button", { name: /^准备有限体能/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([commands[1], commands[0]]);
    expect(screen.queryByRole("region", { name: "原障碍、实际结果与有限报告" })).toBeNull();
    expect(screen.getByRole("region", { name: "力量、抗性与自主选择边界" }).textContent).toContain("精神免疫");
  });

  it("selects the actual open contact and ignores stale contact prose when the lock is false", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("heavy-archive"); expect(selector.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际放下原档案箱/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "heavy-archive" });
    const settled = { ...value, insideCase: false, actions: [action({ type: "REPORT", caseId: "heavy-archive" }, "报告原尝试结果")] };
    rerender(<BarbarianPanel barbarian={settled} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText("本次作业与接触：原档案箱尚未实际放下")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^实际放下原档案箱/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^报告原尝试结果/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REPORT", caseId: "heavy-archive" });
  });

  it("preserves the growth drawer after a successful BREW receipt and waits for the real bottle", async () => {
    const brew = action({ type: "BREW", batchId: "barbarian-batch-2" }, "调配第二批原料", true, "60便士 · 1行动");
    const state = fixture(9, { barbarian: barbarian({ formulaKnown: true, formula: [...BARBARIAN_FORMULA], actions: [brew] }) });
    const next = { ...state, revision: state.revision + 1, barbarian: bottled() };
    const api = bridge(state); let finish!: (result: SliceResult<SliceReceipt>) => void;
    api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    await enter(api); await openBarbarian();
    const button = screen.getByRole("button", { name: /^调配第二批原料/ }); fireEvent.click(button); fireEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    const envelope = vi.mocked(api.submitIntent).mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "BARBARIAN", command: brew.command });
    await act(async () => { finish(receipt(next, envelope)); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看并准备服用「第二瓶野蛮人魔药」" })).toBeTruthy();
  });

  it("restores zero-resource contact, retries its identical CLOSE envelope and unlocks only on receipt", async () => {
    const state = fixture(8, { barbarian: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next = { ...state, revision: state.revision + 1, barbarian: { ...state.barbarian, insideCase: false, actions: [],
      cases: state.barbarian.cases.map((entry) => entry.id === "heavy-archive" ? { ...entry, closes: 1, contactOpen: "原档案箱已实际放下，本次作业已结束" } : entry),
    } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "野蛮人成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次野蛮人实践");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: "返回标题" }) as HTMLButtonElement).disabled).toBe(true);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true); expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际放下原档案箱/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次作业与接触：原档案箱尚未实际放下")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^实际放下原档案箱/ })); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "BARBARIAN", command: { type: "CLOSE", caseId: "heavy-archive" } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByText("本次作业与接触：原档案箱已实际放下，本次作业已结束")).toBeTruthy();
    expect(screen.getByText("实际结束次数：1")).toBeTruthy(); expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("keeps an older Lawyer contact ahead of simultaneous Barbarian contact", async () => {
    const state = fixture(8, { barbarian: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.lawyer = { ...state.lawyer, insideCase: true, cases: [{ id: "duplicated-receipt", title: "原收据", story: "原文书仍须实际归还。", status: "EXAMINED",
      observations: [], preparation: null, result: "原论证失败。", contactOpen: "原文书尚在手中", closes: 0 }],
      actions: [{ id: "legacy-close", label: "实际结束旧律师接触", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "duplicated-receipt" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api); await userEvent.click(await screen.findByRole("button", { name: /^实际结束旧律师接触/ }));
    expect(screen.queryByRole("region", { name: "野蛮人成长下一步" })).toBeNull();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "LAWYER", command: { type: "CLOSE", caseId: "duplicated-receipt" } });
  });
});
