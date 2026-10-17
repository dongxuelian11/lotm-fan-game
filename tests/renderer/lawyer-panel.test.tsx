/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { LAWYER_ABILITIES, LAWYER_CONSUMPTION_RISK } from "../../src/domain/lawyer/content";
import type { LawyerAction, LawyerCommand, LawyerProjection } from "../../src/domain/lawyer/types";
import type { SliceCombatRound, SliceProjection } from "../../src/domain/slice/types";
import { LawyerPanel } from "../../src/renderer/LawyerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: LawyerCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): LawyerAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const discover = action({ type: "DISCOVER" }, "拜访契约文书员米蕾·沃德");
function lawyer(patch: Partial<LawyerProjection> = {}): LawyerProjection {
  return {
    title: "律师之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可了解渠道与服药。", pollution: 3,
    risk: LAWYER_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): LawyerProjection {
  return lawyer({
    discovered: true, guidanceKnown: true,
    supplies: "三瓶独立成品，原价660便士；每瓶两次实际劳动抵扣600便士后付60便士，指导120便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；跨周补给另行申请、领取。",
    actions: ["lawyer-potion-1", "lawyer-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "lawyer-potion-1", title: "第一瓶律师魔药", source: "米蕾·沃德独立留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "lawyer-potion-1", confirmed: true } },
      { id: "lawyer-potion-2", title: "第二瓶律师魔药", source: "米蕾·沃德独立留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "lawyer-potion-2", confirmed: true } },
      { id: "lawyer-potion-3", title: "第三瓶律师魔药", source: "米蕾·沃德独立留存的第三原瓶", status: "指导者保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "lawyer-potion-3", confirmed: true } },
    ],
  });
}
function cases(): LawyerProjection["cases"] {
  return [
    { id: "ambiguous-delivery", title: "含糊的送货条款", story: "原送货条款只写本周内，日期范围和履行事实仍须核实。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未取得原文书", closes: 0 },
    { id: "duplicated-receipt", title: "重复的收据", story: "原收据号码是否重复仍须普通核对，不能先指控任何人。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未取得原文书", closes: 0 },
    { id: "closing-counter", title: "将关门的柜台", story: "原告示写明柜台关闭时间，对方仍可以拒绝延长接待。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未取得原文书", closes: 0 },
  ];
}
function opened(): LawyerProjection {
  return lawyer({ promoted: true, discovered: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "duplicated-receipt" ? {
      ...entry, status: "EXAMINED", contactOpen: "原文书仍在手中，谈话尚未实际结束",
      observations: ["曾核对原收据号码，只确认一处重复记录。"],
      result: "本次说服未获接受；对方明确拒绝，仍须实际放回原文书并结束谈话。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "duplicated-receipt" }, "实际放回原收据并结束谈话", true, "0行动 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: LawyerProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<LawyerPanel lawyer={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("lawyer-renderer-run", sliceDefaultCreationSelection, "lawyer-renderer-seed");
raw.week = 6; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    lawyer: lawyer({
      discovered: promoted, guidanceKnown: promoted, promoted, title: promoted ? "律师 · 序列9" : "律师之路",
      actions: promoted ? [] : [discover], abilities: promoted ? LAWYER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: promoted ? "black-emperor" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:01:00Z",
      }],
    } })),
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
async function openLawyer() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: /^律师(?:之路|成长)$/ });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Lawyer sequence-nine public finite-argument dossier", () => {
  it("offers twenty ordinary routes and remembers the explicit Lawyer selection", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.queryByRole("group", { name: "选择成长卷宗" })).toBeNull();
    await openLawyer();
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "律师之路" }).textContent).toContain("规则理解");
    expect(choices.getByRole("button", { name: "律师之路" }).getAttribute("aria-pressed")).toBe("true");
    expect(choices.getByRole("button", { name: "占卜家之路" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "律师成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "律师成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current growth with finite rule analysis and no higher-sequence controls", async () => {
    await enter(bridge(fixture(true)));
    expect(screen.getByText("律师 · 序列9 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看律师成长" }));
    const abilities = screen.getByRole("region", { name: "律师能力与消化" });
    for (const ability of LAWYER_ABILITIES) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const boundary of ["规则分析", "说服论证", "当前可知事实", "当事人仍自主决定", "不提供序列8"]) expect(abilities.textContent).toContain(boundary);
    expect(screen.getByRole("region", { name: "律师成长下一步" }).textContent).toContain("本阶段扮演解释");
    expect(screen.getByRole("region", { name: "律师成长下一步" }).textContent).toContain("理解既存条款、核对当前事实并尊重当事人的自主选择");
    expect(screen.getByRole("region", { name: "律师成长下一步" }).textContent).not.toContain("本阶段G扮演解释");
    expect(screen.queryByRole("button", { name: /野蛮人体能|贿赂控制|扭曲现实|序列8晋升/ })).toBeNull();
  });

  it("keeps four ordinary weeks as the projected discovery gate without inventing a shortcut", () => {
    const reason = "需要完成四个完整普通周，第5周起才可发现米蕾·沃德的渠道。";
    const { onCommand } = panel(lawyer({ actions: [{ ...discover, enabled: false, reason }], digestion: "普通生活0/4整周。" }));
    const button = screen.getByRole("button", { name: /^拜访契约文书员/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); expect(screen.getAllByText(new RegExp(reason))).not.toHaveLength(0);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /服用|跳过|直接晋升/ })).toBeNull();
  });

  it("shows three independent sources and public supply terms without unverified ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不应显示的未核材料", quantity: 1, unit: "份" }] });
    expect(new Set(value.bottles.map((bottle) => bottle.id)).size).toBe(3);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "律师成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(screen.getByRole("region", { name: "律师成品渠道与配方边界" }).textContent).toContain("独立成品原瓶，不提供调配");
    expect(screen.getByRole("region", { name: "律师成品渠道与配方边界" }).textContent).not.toContain("完整配方尚未核实");
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("不应显示的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("opens and cancels at zero AP, restores focus and confirms only the chosen original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶律师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("lawyer-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "律师服用风险与四档结果" }).textContent).toContain(LAWYER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶律师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "lawyer-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "readOnly", "insideCase"] as const)("invalidates a confirmation when %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<LawyerPanel lawyer={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted", insideCase: change === "insideCase" }} resources={resources} busy={false} blocked={false} readOnly={change === "readOnly"} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps updated bottle eligibility authoritative instead of deriving it from resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "需要度过四个完整普通周，第5周起可以服药。";
    rerender(<LawyerPanel lawyer={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶律师魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy();
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps selected cases and reveals no observation or result before its committed projection", async () => {
    const value = lawyer({ promoted: true, cases: cases(), actions: [] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "closing-counter");
    rerender(<LawyerPanel lawyer={{ ...value, actions: [action({ type: "OBSERVE", caseId: "ambiguous-delivery" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("closing-counter");
    expect(screen.getByRole("region", { name: "当前律师实践" }).textContent).toContain("对方仍可以拒绝延长接待");
    expect(screen.queryByRole("region", { name: "原条款、实际选择与有限报告" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches only public ARGUMENT and ORDINARY methods while preserving terms, actual facts and voluntary choice", async () => {
    const choices = (["ARGUMENT", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "ambiguous-delivery", method }, `准备${method}`));
    const { onCommand } = panel(lawyer({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    const boundaries = screen.getByRole("region", { name: "条款、论证与自主选择边界" });
    for (const text of ["已有条款、提出的理由与当事人的实际选择是不同的事实", "不能凭空创造条款或读取未知事实", "当事人可以拒绝、离开或提出异议"]) expect(boundaries.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "原条款、实际选择与有限报告" })).toBeNull();
    expect(screen.queryByRole("button", { name: /结束/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "closing-counter");
    expect(screen.queryByRole("button", { name: /^准备ARGUMENT/ })).toBeNull();
  });

  it("reports committed facts without inventing a claim selector or coercive result", async () => {
    const report = action({ type: "REPORT", caseId: "ambiguous-delivery" }, "提交本次有限报告", true, "1行动 · 已公开报告成本");
    const value = lawyer({ promoted: true, cases: cases().map((entry) => entry.id === "ambiguous-delivery" ? {
      ...entry, status: "EXAMINED", closes: 1,
      result: "原条款：本周内交货。当前事实：只有原收据日期已核实。实际选择：对方拒绝改期，未形成新约定。",
    } : entry), actions: [report] });
    const { onCommand } = panel(value);
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("region", { name: "原条款、实际选择与有限报告" }).textContent).toContain("对方拒绝改期，未形成新约定");
    expect(screen.queryByRole("button", { name: /确定真相|强制服从|过度断言/ })).toBeNull();
    const button = screen.getByRole("button", { name: /^提交本次有限报告/ });
    expect(button.textContent).toContain(report.cost); await userEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", caseId: "ambiguous-delivery" });
  });

  it("selects the actual open contact and exposes only matching CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(lawyer({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "closing-counter");
    const value = opened();
    rerender(<LawyerPanel lawyer={{ ...value, actions: [...value.actions, action({ type: "REPORT", caseId: "duplicated-receipt" }, "不能提前报告"), action({ type: "WITHDRAW", caseId: "duplicated-receipt" }, "不能撤回代替结束"), action({ type: "REFLECT" }, "不能提前反思")] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("duplicated-receipt"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("本次文书与谈话接触：原文书仍在手中，谈话尚未实际结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "律师成长下一步" }).textContent).toContain("不另抽随机、不奖励、不治疗、不退还此前成本");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际放回原收据/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "duplicated-receipt" });
    expect(screen.getByText("本次文书与谈话接触：原文书仍在手中，谈话尚未实际结束")).toBeTruthy();
  });

  it("never manufactures a missing CLOSE action from public contact prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "律师成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a discovered Lawyer channel read-only after selecting another route", async () => {
    const api = bridge(fixture(false, { lawyer: { ...bottled(), cases: opened().cases }, progression: { pathwayId: "diviner", sequence: 9, mastery: {}, acting: 0, promotionWeek: 5 } }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "律师经历" }));
    const history = within(screen.getByRole("region", { name: "律师渠道经历" }));
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.getByText(/本次文书与谈话接触：原文书仍在手中，谈话尚未实际结束/)).toBeTruthy();
    expect(history.getByText("来源：米蕾·沃德独立留存的第一原瓶")).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "CLOSE", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the exact failed %s envelope without optimistic facts or duplicate clicks", async (type) => {
    const isLife = !["CONSUME", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: LawyerCommand = type === "CONSUME" ? { type, bottleId: "lawyer-potion-2", confirmed: true }
      : type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" || type === "REFLECT" ? { type }
      : type === "PREPARE" ? { type, caseId: "ambiguous-delivery", method: "ARGUMENT" }
      : type === "REPORT" ? { type, caseId: "ambiguous-delivery" }
      : { type, caseId: "ambiguous-delivery" };
    const entry = action(command, "执行这次公开行动");
    const zeroAP = ["CONSUME", "WITHDRAW", "RECEIVE_SUPPLY", "CLOSE"].includes(type);
    const state = fixture(isLife, { lawyer: type === "CONSUME" ? bottled() : lawyer({ promoted: isLife, cases: isLife ? cases() : [], actions: [entry] }), actionsRemaining: zeroAP ? 0 : 1, canAct: !zeroAP });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, lawyer: { ...state.lawyer, actions: [], bottles: state.lawyer.bottles.map((bottle) => ({ ...bottle, status: "实际消费已记录" })) } }, envelope));
    api.submitIntent = submit; await enter(api); await openLawyer();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶律师魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "律师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("律师模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "原条款、实际选择与有限报告" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "LAWYER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads contact at zero resources and unlocks only after the actual CLOSE receipt", async () => {
    const state = fixture(true, { lawyer: opened(), seer: { ...base.seer, discovered: true }, actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, lawyer: { ...opened(), insideCase: false,
      actions: [], cases: opened().cases.map((entry) => entry.id === "duplicated-receipt" ? { ...entry, contactOpen: "原文书已实际放回，本次谈话已结束", closes: 1 } : entry),
    } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "律师成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际归还原文书并结束谈话");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" });
    expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) {
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际放回原收据/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次文书与谈话接触：原文书仍在手中，谈话尚未实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "LAWYER", command: { type: "CLOSE", caseId: "duplicated-receipt" } });
    expect(screen.getByText("本次文书与谈话接触：原文书已实际放回，本次谈话已结束")).toBeTruthy();
    expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
    expect(next.cash).toBe(state.cash); expect(next.health).toBe(state.health); expect(next.mind).toBe(state.mind);
  });

  it.each(["pryer", "prisoner", "madman", "werewolf", "moon"] as const)("preserves an older %s actual exit ahead of simultaneous Lawyer contact", async (older) => {
    const state = fixture(true, { lawyer: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false,
      progression: { pathwayId: older === "pryer" ? "hermit" : "chained", sequence: older === "pryer" || older === "prisoner" ? 9 : older === "madman" ? 8 : 7, mastery: {}, acting: 0, promotionWeek: 5 },
    });
    const label = "旧实践的实际退出";
    if (older === "pryer") state.pryer = { ...state.pryer, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "intrusive-page", title: "原异常页", story: "尚未合页。", status: "EXAMINED", readingOpen: "尚未合页", overclaims: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-close", label, cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "intrusive-page" } }],
    };
    else if (older === "prisoner") state.prisoner = { ...state.prisoner, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "jammed-shutter", title: "原百叶窗", story: "原木垫块仍在手中。", status: "EXAMINED", holding: "尚未归还", returns: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-return", label, cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "jammed-shutter" } }],
    };
    else if (older === "madman") state.madman = { ...state.madman, promoted: true, insideCase: true,
      cases: [{ id: "weighted-gate", title: "原闸门", story: "尚未停止。", status: "EXAMINED", burstOpen: "尚未停止", stops: 0, burstUses: 0, observations: [], preparation: null, result: null }],
      actions: [{ id: "legacy-stop", label, cost: "0行动", enabled: true, reason: null, command: { type: "STOP", caseId: "weighted-gate" } }],
    };
    else state.werewolf = { ...state.werewolf, promoted: true, insideCase: true,
      moon: { pending: older === "moon", summary: "原月相记录", history: [] },
      cases: [{ id: "claw-mark", title: "原木", story: "尚未返回。", status: "EXAMINED", sceneOpen: "尚未返回", returns: 0, observations: [], preparation: null, result: null }],
      actions: older === "moon"
        ? [{ id: "legacy-moon", label, cost: "0行动", enabled: true, reason: null, command: { type: "HANDLE_MOON", method: "GUARDED" } }]
        : [{ id: "legacy-return", label, cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "claw-mark" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "律师成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload.type).toBe(older === "moon" ? "WEREWOLF" : older.toUpperCase());
  });

  it.each(["PREPARED", "EXAMINED", "RESOLVED"] as const)("does not lock ordinary life for %s records or old contact prose", async (status) => {
    const value = lawyer({ promoted: true, cases: cases().map((entry) => ({ ...entry, status, preparation: "旧准备仍可回看", result: "已提交的原结果", contactOpen: "旧文字说接触尚未结束", closes: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(true, { lawyer: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openLawyer(); expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^实际放回原收据/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps a failed original consumed and opens a different bottle with updated resources", async () => {
    const state = fixture(false, { lawyer: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      lawyer: { ...state.lawyer, bottles: state.lawyer.bottles.map((bottle) => bottle.id === "lawyer-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.lawyer.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openLawyer();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶律师魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("lawyer-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
  it("uses each bottle's own labour command and the projected 600-pence credit", async () => {
    const value = bottled();
    const commands: LawyerCommand[] = [
      { type: "POTION_WORK", bottleId: "lawyer-potion-3" },
      { type: "BUY_POTION", bottleId: "lawyer-potion-3" },
      { type: "LEARN_GUIDANCE" },
    ];
    const { onCommand } = panel({ ...value, actions: commands.map((command, index) => action(command, ["为第三原瓶完成劳动", "支付第三原瓶尾款", "了解用药指导"][index]!, true, ["1行动 · 本原瓶劳动2/2后抵扣600便士", "60便士 · 0行动", "120便士 · 1行动"][index]!)) });
    for (const label of ["为第三原瓶完成劳动", "支付第三原瓶尾款", "了解用药指导"]) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByText(/本原瓶劳动2\/2后抵扣600便士/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    expect(screen.getByText("指导者保管 · 劳动0/2")).toBeTruthy();
  });

  it("requires separate public supply actions and keeps consumed originals intact", async () => {
    const original = bottled();
    const request = action({ type: "REQUEST_SUPPLY" }, "申请后续独立成品补给", true, "1行动 · 到下一周再领取");
    const receive = { ...action({ type: "RECEIVE_SUPPLY" }, "实际领取后续原瓶", false, "0行动"), reason: "本周尚未到货，下周才能实际领取。" };
    const waiting = { ...original, bottles: original.bottles.map((bottle) => ({ ...bottle, status: "已耗用 · 原失败记录保留" })), actions: [request, receive] };
    const { onCommand, rerender } = panel(waiting);
    await userEvent.click(screen.getByRole("button", { name: /^申请后续独立成品补给/ }));
    fireEvent.click(screen.getByRole("button", { name: /^实际领取后续原瓶/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REQUEST_SUPPLY" });
    expect(screen.getAllByText("已耗用 · 原失败记录保留")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    const arrived = { ...waiting, actions: [{ ...receive, enabled: true, reason: null }] };
    rerender(<LawyerPanel lawyer={arrived} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(onCommand).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /^实际领取后续原瓶/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "RECEIVE_SUPPLY" });
    expect(screen.getAllByText("已耗用 · 原失败记录保留")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    const bottle = { ...original.bottles[0]!, id: "lawyer-potion-restock-1", title: "后续第一瓶律师魔药", source: "米蕾·沃德本次实际领取的后续独立原瓶", status: "已交付，尚未服用", command: { type: "CONSUME", bottleId: "lawyer-potion-restock-1", confirmed: true } as const };
    rerender(<LawyerPanel lawyer={{ ...arrived, bottles: [...arrived.bottles, bottle], actions: [action(bottle.command)] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getAllByText("已耗用 · 原失败记录保留")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "查看并准备服用「后续第一瓶律师魔药」" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it.each(["busy", "blocked"] as const)("disables public and bottle controls while %s", (lock) => {
    const value = bottled(); const onCommand = vi.fn();
    render(<LawyerPanel lawyer={{ ...value, actions: [...value.actions, discover] }} resources={resources} busy={lock === "busy"} blocked={lock === "blocked"} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps ordinary and ability battle entries in the common display without a new intent", async () => {
    const ordinaryMove = "普通持棍击打（普通动作）";
    const abilityMove = "以规则分析核对对手已公开前提";
    const battle: NonNullable<SliceProjection["combat"]> = {
      title: "原现场冲突", round: 1, enemyName: "持棍的对手", enemyHealth: 100, enemyStatus: "RESISTING",
      playerCountWheel: [{ id: "count-2", label: "2次", weight: 100 }], enemyCountWheel: [],
      playerAbilityWheel: [
        { id: "ordinary-strike", label: ordinaryMove, weight: 50 },
        { id: "black-emperor.s9.rule-analysis", label: abilityMove, weight: 50 },
      ], enemyAbilityWheel: [], consequenceWeights: { light: 65, heavy: 30, death: 5 },
      stances: [{ id: "ATTACK", label: "进攻", description: "公开进攻姿态" }, { id: "DEFEND", label: "防守", description: "公开防守姿态" }, { id: "RETREAT", label: "撤退", description: "公开撤退姿态" }], lastRound: null,
    };
    const state = fixture(true, { combat: battle, canAct: false });
    const round: SliceCombatRound = {
      round: 1, stance: "ATTACK", first: "PLAYER", playerCount: 2, enemyCount: 1, playerCountRoll: 40, enemyCountRoll: 20,
      moves: [{ actor: "PLAYER", label: ordinaryMove, selfGain: 2, enemyReduction: 0 }, { actor: "PLAYER", label: abilityMove, selfGain: 0, enemyReduction: 1 }],
      playerAdvantage: 2, enemyAdvantage: 3, winChance: 40, winner: "ENEMY", consequence: "本次论证没有阻止攻击，实际受伤。", consequenceWeights: { light: 65, heavy: 30, death: 5 }, retreat: "NONE",
    };
    const next = { ...state, revision: state.revision + 1, health: 90, combat: { ...battle, round: 2, lastRound: round }, lastCombatRound: round, combatHistory: [round] };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api);
    const publicWheel = screen.getByText(/^你的能力盘：/);
    expect(publicWheel.textContent).toContain(ordinaryMove); expect(publicWheel.textContent).toContain(abilityMove); expect(publicWheel.textContent).toContain("50%");
    expect(screen.queryByRole("button", { name: /发动规则分析|强制说服|点选弱点|律师特殊指令/ })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "确认姿态，结算完整回合" }));
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK" });
    expect(screen.getByText(ordinaryMove, { exact: false })).toBeTruthy(); expect(screen.getByText(abilityMove, { exact: false })).toBeTruthy();
    expect(screen.getByText(round.consequence)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "进入下一回合" }));
    expect(screen.getByText("健康 90 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });

});
