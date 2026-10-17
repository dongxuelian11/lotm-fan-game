/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { BRIBER_ABILITIES, BRIBER_CONSUMPTION_RISK, BRIBER_FORMULA, BRIBER_FORMULA_SOURCE } from "../../src/domain/briber/content";
import { BARBARIAN_ABILITIES, BARBARIAN_FORMULA } from "../../src/domain/barbarian/content";
import { LAWYER_ABILITIES } from "../../src/domain/lawyer/content";
import type { BriberAction, BriberCommand, BriberProjection } from "../../src/domain/briber/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { BriberPanel } from "../../src/renderer/BriberPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: BriberCommand, label = "执行本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): BriberAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const learn = action({ type: "LEARN_FORMULA" }, "向米蕾·沃德学习贿赂者配方", true, "240便士 · 1行动");
function briber(patch: Partial<BriberProjection> = {}): BriberProjection {
  return {
    title: "贿赂者晋升", discovered: true, promoted: false, formulaKnown: false,
    formula: [], supplies: "", actions: [learn], bottles: [], abilities: [],
    acting: 0, digestion: "野蛮人扮演100，已度过8/8个完整序列8周。", pollution: 3,
    gifts: { held: 0, given: 0, summary: "尚未购买实际赠物。" },
    risk: BRIBER_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): BriberProjection {
  return briber({
    formulaKnown: true, formula: [...BRIBER_FORMULA],
    supplies: "第一批与第二批的六项实际材料分别调配成瓶；第三批尚由米蕾·沃德保管。",
    actions: ["briber-batch-1:bottle", "briber-batch-2:bottle"].map((bottleId) =>
      action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: [
      { id: "briber-batch-1:bottle", title: "第一瓶贿赂者魔药", source: "第一批六项实际原料的调配记录", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "briber-batch-1:bottle", confirmed: true } },
      { id: "briber-batch-2:bottle", title: "第二瓶贿赂者魔药", source: "第二批六项实际原料的调配记录", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "briber-batch-2:bottle", confirmed: true } },
    ],
  });
}
function cases(): BriberProjection["cases"] {
  return [
    { id: "volunteered-test", title: "自愿短测", story: "对方同意本次有限测试，原木牌尚未给出。" },
    { id: "rejected-cup", title: "被拒绝的杯子", story: "对方明确拒绝饮用，须保留这一选择。" },
    { id: "parting-gift", title: "临别赠物", story: "原赠物与本次谈话有明确去向和停止边界。" },
  ].map((entry) => ({ ...entry, observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "尚未开始本次接触", closes: 0 }));
}
function opened(): BriberProjection {
  return briber({ promoted: true, insideCase: true, gifts: { held: 2, given: 1, summary: "一件原木牌已实际给出；结束不会退还。" }, cases: cases().map((entry) => entry.id === "rejected-cup" ? {
    ...entry, status: "EXAMINED", observations: ["对方拒绝饮用，拒绝仍有效。"], preparation: "已选择有限削弱。",
    result: "本次未成功；一件赠物已经给出，对方仍然拒绝。", contactOpen: "本次影响尚未实际结束",
  } : entry), actions: [action({ type: "CLOSE", caseId: "rejected-cup" }, "实际停止影响并结束本次谈话", true, "0行动 · 0精神 · 0灵性 · 不退款、不治疗")] });
}
function panel(value: BriberProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<BriberPanel briber={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("briber-renderer-run", sliceDefaultCreationSelection, "briber-renderer-seed");
raw.week = 20; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    lawyer: { ...base.lawyer, discovered: sequence !== null, promoted: sequence !== null, acting: 100, digestion: "律师时期已完成消化。", actions: [] },
    barbarian: { ...base.barbarian, discovered: sequence !== null, promoted: sequence === 8 || sequence === 7, acting: 100,
      digestion: "野蛮人时期已完成消化。", actions: [], formulaKnown: true, formula: [...BARBARIAN_FORMULA] },
    briber: briber({ title: sequence === 7 ? "贿赂者 · 序列7" : "贿赂者晋升", promoted: sequence === 7,
      actions: sequence === 7 ? [] : [learn], abilities: sequence === 7 ? [...LAWYER_ABILITIES, ...BARBARIAN_ABILITIES, ...BRIBER_ABILITIES].map((entry) => ({ ...entry, mastery: 120 })) : [],
    }),
    progression: { pathwayId: sequence === null ? null : "black-emperor", sequence, mastery: {}, acting: sequence === 7 ? 0 : 100, promotionWeek: sequence === null ? null : 5 },
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
async function openBriber() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^贿赂者(?:晋升|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Briber sequence-seven crafting, actual gifts and finite weakening dossier", () => {
  it("keeps twenty ordinary starts and does not offer Briber before Barbarian", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(tabs.getAllByRole("button")).toHaveLength(22);
    expect(tabs.getByRole("button", { name: "律师之路" })).toBeTruthy();
    expect(tabs.queryByRole("button", { name: /贿赂者/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("routes Barbarian's advancement guide to projected formula preparation and its maturity gate", async () => {
    const reason = "野蛮人扮演100；尚未度过八个完整序列8周。";
    const api = bridge(fixture(8, { briber: briber({ actions: [{ ...learn, enabled: false, reason }], digestion: reason }) }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "贿赂者成长下一步" }).textContent).toContain("米蕾·沃德");
    const button = screen.getByRole("button", { name: /^向米蕾·沃德学习/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /直接晋升|跳过/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows all six public abilities and preserves both earlier histories without mutation controls", async () => {
    const state = fixture(7);
    state.lawyer = { ...state.lawyer, cases: [{ id: "duplicated-receipt", title: "旧收据核对", story: "原文书已放回。", status: "RESOLVED",
      observations: ["原收据只证实一处重复。"], preparation: "原普通核对准备", result: "当事人拒绝接受原论证。", contactOpen: "已实际结束", closes: 1 }],
      actions: [{ id: "old-lawyer-action", label: "不应继续的旧律师行动", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    state.barbarian = { ...state.barbarian, cases: [{ id: "heavy-archive", title: "原档案箱作业", story: "原箱已实际放下。", status: "RESOLVED",
      observations: ["原箱的落点已确认。"], preparation: "原普通协作准备", result: "旧作业失败后实际结束，结果保留。", contactOpen: "原箱已放下", closes: 2 }],
      bottles: [{ id: "old-barbarian-bottle", title: "野蛮人原瓶", source: "米蕾保管的原六料", status: "已耗用 · 原失败保留", chance: 43, command: { type: "CONSUME", bottleId: "old-barbarian-bottle", confirmed: true } }],
      actions: [{ id: "old-barbarian-action", label: "不应继续的旧野蛮人行动", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api);
    expect(screen.getByText("贿赂者 · 序列7 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看贿赂者成长" }));
    const abilities = within(screen.getByRole("region", { name: "贿赂者能力与消化" }));
    for (const entry of [...LAWYER_ABILITIES, ...BARBARIAN_ABILITIES, ...BRIBER_ABILITIES]) expect(abilities.getByText(`${entry.label} · 掌握 120`)).toBeTruthy();
    expect(abilities.getByText(/只削弱本轮此后一次实际敌方行动/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /发动扭曲|强迫同意/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "律师经历" }));
    const lawyerHistory = within(screen.getByRole("region", { name: "律师时期的经历" }));
    expect(lawyerHistory.getByText("律师扮演进度 100 · 律师时期已完成消化。")).toBeTruthy();
    expect(lawyerHistory.getByText("当事人拒绝接受原论证。")).toBeTruthy();
    expect(lawyerHistory.queryAllByRole("button")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "野蛮人经历" }));
    const barbarianHistory = within(screen.getByRole("region", { name: "野蛮人时期的经历" }));
    expect(barbarianHistory.getByText("野蛮人扮演进度 100 · 消化：野蛮人时期已完成消化。")).toBeTruthy();
    expect(barbarianHistory.getByText("旧作业失败后实际结束，结果保留。")).toBeTruthy();
    expect(barbarianHistory.getByText("来源：米蕾保管的原六料")).toBeTruthy();
    expect(barbarianHistory.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(barbarianHistory.queryAllByRole("button")).toHaveLength(0); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("renders the known six-material formula, preserves unknown source quantity and invents no bottles", () => {
    const supplies = "原料批次尚由米蕾·沃德保管；劳动0/4，主材1800便士，辅材150便士，调配60便士与1行动。";
    const value = briber({ formula: [...BRIBER_FORMULA], supplies, story: BRIBER_FORMULA_SOURCE });
    const { rerender, onCommand } = panel(value);
    expect(screen.queryByText("“哭泣婴儿”花")).toBeNull();
    expect(screen.getByText(supplies)).toBeTruthy();
    expect(screen.getByText(BRIBER_FORMULA_SOURCE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    rerender(<BriberPanel briber={{ ...value, formulaKnown: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    for (const material of BRIBER_FORMULA) expect(screen.getByText(material.name)).toBeTruthy();
    expect(screen.getByText("数量原文未注明")).toBeTruthy();
    expect(screen.getByText("原著未给明确数量或重量；本作G每批供货1份。")).toBeTruthy();
    expect(screen.getByText("1 朵")).toBeTruthy(); expect(screen.getAllByText("5 滴")).toHaveLength(2);
    expect(screen.getByText("4 滴")).toBeTruthy(); expect(screen.getByText("80 mL")).toBeTruthy();
    expect(screen.queryByText(/已调配，尚未服用/)).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("sends only projected batch and supply commands with their actual costs", async () => {
    const commands: BriberCommand[] = [{ type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "briber-batch-2" },
      { type: "BUY_MATERIALS", batchId: "briber-batch-2" }, { type: "BREW", batchId: "briber-batch-2" }, { type: "REQUEST_SUPPLY" }];
    const labels = ["学习本次配方", "为第二批劳动", "取得第二批六料", "调配第二批原料", "申请后续材料批次"];
    const costs = ["240便士 · 1行动", "1行动 · 完成4/4次劳动抵主材1800便士", "辅材150便士 · 0行动", "60便士 · 1行动", "1行动 · 下周领取"];
    const receive = { ...action({ type: "RECEIVE_SUPPLY" }, "实际领取后续材料", false, "0行动"), reason: "尚未到下一周。" };
    const value = briber({ actions: [...commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)), receive] });
    const { onCommand, rerender } = panel(value);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    fireEvent.click(screen.getByRole("button", { name: /^实际领取后续材料/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    rerender(<BriberPanel briber={{ ...value, actions: [{ ...receive, enabled: true, reason: null }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^实际领取后续材料/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "RECEIVE_SUPPLY" });
  });

  it("cancels at zero AP, restores focus and independently confirms only the chosen original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: "查看并准备服用「第一瓶贿赂者魔药」" });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶贿赂者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶贿赂者魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶贿赂者魔药」" }));
    expect(screen.getByText("briber-batch-2:bottle")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：第二批六项实际原料的调配记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "贿赂者服用风险与四档结果" }).textContent).toContain(BRIBER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const button = screen.getByRole("button", { name: "确认服用「第二瓶贿赂者魔药」" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "briber-batch-2:bottle", confirmed: true });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("invalidates the consumed original and displays a failed bottle only as committed history", async () => {
    const value = bottled(); const { rerender, onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶贿赂者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶贿赂者魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 本次失败，原料与原瓶不会恢复" } : bottle) };
    rerender(<BriberPanel briber={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶贿赂者魔药」" })).toBeNull();
    expect(screen.getByText("已耗用 · 本次失败，原料与原瓶不会恢复")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶贿赂者魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("uses only projected gift and practice commands and never treats preparation or refusal as agreement", async () => {
    const commands: BriberCommand[] = [{ type: "BUY_GIFTS" }, { type: "PREPARE", caseId: "volunteered-test", method: "ABILITY" },
      { type: "PREPARE", caseId: "volunteered-test", method: "ORDINARY" }, { type: "PERFORM", caseId: "volunteered-test" },
      { type: "REPORT", caseId: "volunteered-test" }, { type: "WITHDRAW", caseId: "volunteered-test" }];
    const labels = ["购买三件实际木牌赠物", "准备有限削弱", "准备普通沟通", "实际给出本次赠物", "报告本次结果", "撤回本次准备"];
    const value = briber({ promoted: true, cases: cases(), gifts: { held: 2, given: 1, summary: "原木牌1件已给出，2件仍在手中。" },
      actions: commands.map((command, index) => action(command, labels[index]!, true, index === 0 ? "60便士 · 0行动 · 3件实际木牌" : index === 3 ? "1行动 · 3灵性 · 实际给出1件赠物" : "本次公开成本")) });
    const { onCommand } = panel(value);
    const inventory = within(screen.getByRole("region", { name: "实际赠物库存与去向" }));
    expect(inventory.getByText(value.gifts.summary)).toBeTruthy(); expect(inventory.getByText("2")).toBeTruthy(); expect(inventory.getByText("1")).toBeTruthy();
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(inventory.getByText(value.gifts.summary)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "原赠物、实际结果与有限报告" })).toBeNull();
    const boundaries = screen.getByRole("region", { name: "赠与、削弱与自主选择边界" });
    expect(boundaries.textContent).toContain("不要求对方接住赠物或喝下杯中饮料");
    expect(boundaries.textContent).toContain("不把实际拒绝变成同意");
    expect(boundaries.textContent).toContain("关闭为0行动、0精神、0灵性");
  });

  it("selects the actual open contact and ignores stale contact prose when the lock is false", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("rejected-cup"); expect(selector.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际停止影响并结束/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "rejected-cup" });
    const settled = { ...value, insideCase: false, actions: [action({ type: "REPORT", caseId: "rejected-cup" }, "报告原尝试结果")] };
    rerender(<BriberPanel briber={settled} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText("本次赠与实践：本次影响尚未实际结束")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^实际停止影响并结束/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^报告原尝试结果/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REPORT", caseId: "rejected-cup" });
  });

  it("preserves the growth drawer after a successful BREW receipt and waits for the real bottle", async () => {
    const brew = action({ type: "BREW", batchId: "briber-batch-2" }, "调配第二批原料", true, "60便士 · 1行动");
    const state = fixture(8, { briber: briber({ formulaKnown: true, formula: [...BRIBER_FORMULA], actions: [brew] }) });
    const next = { ...state, revision: state.revision + 1, briber: bottled() };
    const api = bridge(state); let finish!: (result: SliceResult<SliceReceipt>) => void;
    api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    await enter(api); await openBriber();
    const button = screen.getByRole("button", { name: /^调配第二批原料/ }); fireEvent.click(button); fireEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    const envelope = vi.mocked(api.submitIntent).mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "BRIBER", command: brew.command });
    await act(async () => { finish(receipt(next, envelope)); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看并准备服用「第二瓶贿赂者魔药」" })).toBeTruthy();
  });

  it("restores zero-resource contact, retries its identical CLOSE envelope and unlocks only on receipt", async () => {
    const state = fixture(7, { briber: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next = { ...state, revision: state.revision + 1, briber: { ...state.briber, insideCase: false, actions: [],
      cases: state.briber.cases.map((entry) => entry.id === "rejected-cup" ? { ...entry, closes: 1, contactOpen: "本次影响与谈话已实际结束" } : entry),
    } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "贿赂者成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次贿赂者实践");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: "返回标题" }) as HTMLButtonElement).disabled).toBe(true);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true); expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际停止影响并结束/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次赠与实践：本次影响尚未实际结束")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^实际停止影响并结束/ })); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "BRIBER", command: { type: "CLOSE", caseId: "rejected-cup" } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByText("本次赠与实践：本次影响与谈话已实际结束")).toBeTruthy();
    expect(screen.getByText("实际结束次数：1")).toBeTruthy(); expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByText("一件原木牌已实际给出；结束不会退还。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it.each(["LAWYER", "BARBARIAN"] as const)("keeps older %s contact ahead of simultaneous Briber contact", async (older) => {
    const state = fixture(7, { briber: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.lawyer = { ...state.lawyer, insideCase: true, cases: [{ id: "duplicated-receipt", title: "原收据", story: "原文书仍须实际归还。", status: "EXAMINED",
      observations: [], preparation: null, result: "原论证失败。", contactOpen: "原文书尚在手中", closes: 0 }],
      actions: [{ id: "legacy-close", label: "实际结束旧律师接触", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "duplicated-receipt" } }],
    };
    if (older === "BARBARIAN") {
      state.lawyer = { ...state.lawyer, insideCase: false, actions: [] };
      state.barbarian = { ...state.barbarian, insideCase: true, cases: [{ id: "heavy-archive", title: "原档案箱", story: "原箱仍须放下。", status: "EXAMINED",
        observations: [], preparation: null, result: "原作业失败。", contactOpen: "原箱仍在手中", closes: 0 }],
        actions: [{ id: "older-close", label: "实际结束旧野蛮人作业", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "heavy-archive" } }] };
    }
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api); await userEvent.click(await screen.findByRole("button", { name: older === "LAWYER" ? /^实际结束旧律师接触/ : /^实际结束旧野蛮人作业/ }));
    expect(screen.queryByRole("region", { name: "贿赂者成长下一步" })).toBeNull();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: older, command: { type: "CLOSE", caseId: older === "LAWYER" ? "duplicated-receipt" : "heavy-archive" } });
  });
});
