/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { DETECTIVE_ABILITIES } from "../../src/domain/detective/content";
import type { DetectiveAction, DetectiveCommand, DetectiveProjection } from "../../src/domain/detective/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { DetectivePanel, DetectiveReaderHistory, ReasonerHistory } from "../../src/renderer/DetectivePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const guidance: DetectiveAction = {
  id: "guidance", label: "学习守知者服用指导", cost: "1行动 · 240便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
const risk = "领域四档原文：意志难度18；大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗，严重排异可休养。";
function detective(patch: Partial<DetectiveProjection> = {}): DetectiveProjection {
  return {
    title: "守知者（侦探）晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "推理学员扮演100，已度过8/8个完整序列8周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): DetectiveProjection {
  return detective({
    guidanceKnown: true,
    supplies: "完整配方待核；新渠道三瓶独立成品，各2010便士，或完成4次劳动抵1800便士后付210便士；指导240便士。",
    actions: ["detective-potion-1", "detective-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "detective-potion-1", title: "第一瓶守知者魔药", source: "新渠道交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "detective-potion-1", confirmed: true } },
      { id: "detective-potion-2", title: "第二瓶守知者魔药", source: "新渠道交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "detective-potion-2", confirmed: true } },
      { id: "detective-potion-3", title: "第三瓶守知者魔药", source: "新渠道交接的第三原瓶", status: "导师保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "detective-potion-3", confirmed: true } },
    ],
  });
}
function cases(): DetectiveProjection["cases"] {
  return ["fallen-shelf", "courtyard-route", "quay-collision"].map((id, index) => ({
    id, title: `公开重构案卷${index + 1}`, story: `原现场与工具说明${index + 1}`,
    traces: [], reconstruction: null, gaps: [], result: null, status: "AVAILABLE",
  }));
}
function action(command: DetectiveCommand, label = "勘察原现场残留", enabled = true): DetectiveAction {
  return {
    id: JSON.stringify(command), label, cost: "1行动 · 本案公开成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: DetectiveProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DetectivePanel detective={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("detective-renderer-run", sliceDefaultCreationSelection, "detective-renderer-seed");
  raw.week = 20;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    reader: { ...state.reader, discovered: sequence !== null, promoted: sequence !== null, title: "阅读者 · 序列9", acting: 100, actions: [] },
    reasoner: { ...state.reasoner, discovered: sequence !== null, promoted: sequence === 8 || sequence === 7, title: "推理学员 · 序列8", acting: 100, actions: [] },
    detective: detective({ promoted: sequence === 7, title: sequence === 7 ? "守知者（侦探） · 序列7" : "守知者（侦探）晋升", actions: sequence === 7 ? [] : [guidance] }),
    progression: {
      pathwayId: sequence === null ? null : "white-tower", sequence,
      mastery: {}, acting: sequence === 8 || sequence === 9 ? 100 : 0,
      promotionWeek: sequence === null ? null : 5,
    }, ...patch,
  };
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
async function openDetective() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "守知者晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Detective sequence seven dossier", () => {
  it("keeps exactly eight ordinary choices and does not expose either later White Tower sequence", async () => {
    const value = bridge(fixture(null));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路"]) expect(choices.getByRole("button", { name })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /守知者|推理学员/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("does not expose Detective preparation at sequence nine", async () => {
    const value = bridge(fixture(9));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "阅读者成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "推理学员晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /守知者/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Reasoner as the S8 default and opens S7 preparation from its tab or dashboard guide", async () => {
    const value = bridge(fixture(8));
    await enter(value);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "推理学员成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "守知者晋升" }));
    expect(screen.getByRole("region", { name: "守知者成长下一步" }).textContent).toContain("八个完整序列8周");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "守知者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S7 to Detective and preserves both older dossiers without stale command controls", async () => {
    const state = fixture(7);
    state.reader.cases = [{ id: "shift-ledger", title: "旧交接簿", story: "旧阅读场景", documents: ["旧案原抄件"], analysis: "旧案原分析", result: "旧案原提交结果", status: "RESOLVED" }];
    state.reader.actions = [{ id: "stale-reader", label: "不可重做的旧阅读", cost: "1行动", enabled: true, reason: null, command: { type: "READ", caseId: "shift-ledger" } }];
    state.reasoner.cases = [{ id: "stair-footprints", title: "旧泥印案", story: "旧推理场景", observations: ["旧现场观察"], hypotheses: ["旧竞争假设"], testResult: "旧实际检验", result: "旧实际结论", status: "RESOLVED" }];
    state.reasoner.actions = [{ id: "stale-reasoner", label: "不可重做的旧推理", cost: "1行动", enabled: true, reason: null, command: { type: "EXAMINE", caseId: "stair-footprints" } }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(`守知者（侦探） · 序列7 · ${state.character.professionName}`)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("守知者（侦探） · 序列7 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openDetective();
    expect(screen.getByRole("button", { name: "守知者成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "守知者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "阅读者经历" }));
    const readerHistory = screen.getByRole("region", { name: "阅读者时期的经历" });
    for (const text of ["旧阅读场景", "旧案原抄件", "旧案原分析", "旧案原提交结果"]) expect(within(readerHistory).getByText(text)).toBeTruthy();
    expect(within(readerHistory).queryByRole("button")).toBeNull();
    expect(readerHistory.textContent).toContain("当前实践请回到守知者卷宗");
    await userEvent.click(screen.getByRole("button", { name: "推理学员经历" }));
    const reasonerHistory = screen.getByRole("region", { name: "推理学员时期的经历" });
    for (const text of ["旧推理场景", "旧现场观察", "旧竞争假设", "旧实际检验", "旧实际结论"]) expect(within(reasonerHistory).getByText(text)).toBeTruthy();
    expect(within(reasonerHistory).queryByRole("button")).toBeNull();
    expect(screen.queryByText(/不可重做的旧/)).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("retains exact original bottles and mastery in both command-free histories", () => {
    const state = fixture(7);
    state.reader.bottles = [{ id: "old-reader", title: "阅读者已服原瓶", source: "旧阅读渠道", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "old-reader", confirmed: true } }];
    state.reader.abilities = [{ id: "reader.s9.memory", label: "已掌握的记忆", description: "旧记忆原描述", mastery: 42 }];
    state.reasoner.bottles = [{ id: "old-reasoner", title: "推理学员已服原瓶", source: "旧推理渠道", status: "已服用 · 成功", chance: 60, command: { type: "CONSUME", bottleId: "old-reasoner", confirmed: true } }];
    state.reasoner.abilities = [{ id: "reader.s8.observation", label: "已掌握的观察", description: "旧观察原描述", mastery: 67 }];
    render(<><DetectiveReaderHistory reader={state.reader} /><ReasonerHistory reasoner={state.reasoner} /></>);
    for (const text of ["来源：旧阅读渠道", "来源：旧推理渠道", "已服用 · 失败", "已服用 · 成功", "已掌握的记忆 · 掌握 42：旧记忆原描述", "已掌握的观察 · 掌握 67：旧观察原描述"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows independently sourced bottles and supplied costs without inventing a full recipe", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未核配方不应显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未核配方不应显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    const next = screen.getByRole("region", { name: "守知者成长下一步" });
    expect(next.textContent).toContain("知识、推理与器械运用");
    expect(next.textContent).toContain("具体实践、数值与成品药渠道以当前说明为准");
    expect(next.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(next.textContent).toContain("守知者（侦探）擅长知识、推理与器械运用；具体实践、数值与成品药渠道以当前说明为准。当前渠道只提供成品魔药，不提供完整配方。取得渠道或晋升不会自动加入教会。");
    for (const marker of ["原著", "游戏设定（G）", "未核实"]) expect(next.textContent).not.toContain(marker);
  });

  it("cancels without spending, restores focus, and confirms only the selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶守知者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶守知者魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶守知者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶守知者魔药」/ }));
    expect(screen.getByText("detective-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：新渠道交接的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "守知者服用风险与四档结果" }).textContent).toContain(risk);
    expect(screen.getByText("0行动 · 独立确认 · 消耗这瓶魔药")).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 60", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶守知者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "detective-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("dismisses stale bottle confirmation when its action disappears or the panel becomes read-only", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<DetectivePanel detective={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<DetectivePanel detective={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves domain eligibility reasons and actual labour prices instead of inferring permission", () => {
    const value = bottled();
    const reason = "推理学员扮演不足100，且仅度过7/8个完整序列8周。";
    const actions = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push({ id: "buy", label: "取得新渠道第三原瓶", cost: "2010便士，或实际劳动4/4抵1800便士后付210便士", enabled: false, reason: "现金不足", command: { type: "BUY_POTION", bottleId: "detective-potion-3" } });
    const { onCommand } = panel({ ...value, actions: [...actions, guidance] });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("2010便士，或实际劳动4/4抵1800便士后付210便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 240便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得新渠道第三原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects only one public case without spending and keeps original trace order", async () => {
    const list = cases();
    list[1]!.traces = ["先登记的第二道轮痕。", "后登记的第一道灰痕。"];
    list[1]!.gaps = ["墙后没有留下可用痕迹。"];
    const value = detective({ promoted: true, cases: list, actions: list.map((entry) => action({ type: "SURVEY", caseId: entry.id })) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前案卷" })).toHaveLength(1);
    expect(screen.queryByText(list[1]!.traces[0]!)).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择案卷" }), "courtyard-route");
    expect(screen.getByText("原现场与工具说明2")).toBeTruthy();
    expect(screen.queryByText("原现场与工具说明1")).toBeNull();
    const traces = screen.getByRole("region", { name: "已取得的现场残留" });
    expect(within(traces).getAllByRole("listitem").map((item) => item.textContent)).toEqual(list[1]!.traces);
    expect(traces.textContent).toContain("记录顺序不代表事件发生顺序");
    expect(screen.getByRole("region", { name: "尚未补足的证据缺口" }).textContent).toContain(list[1]!.gaps[0]);
    expect(screen.queryByRole("region", { name: "实际重构记录" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际报告结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^勘察原现场/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SURVEY", caseId: "courtyard-route" });
  });

  it("keeps reconstruction plans neutral and renders the committed actual route separately", async () => {
    const list = cases();
    list[0] = { ...list[0]!, traces: ["垫片压住一道原灰痕。"], gaps: ["尚不知由谁搬动。"], status: "SURVEYED" };
    const choices = [
      action({ type: "RECONSTRUCT", caseId: "fallen-shelf", plan: "FASTENER_FIRST" }, "按叠压顺序比较先后"),
      action({ type: "RECONSTRUCT", caseId: "fallen-shelf", plan: "LOAD_FIRST" }, "先按搬运者身份猜测"),
    ];
    const value = detective({ promoted: true, cases: list, actions: choices });
    const { onCommand, rerender } = panel(value);
    const next = screen.getByRole("region", { name: "守知者成长下一步" });
    expect(next.textContent).toContain("选择本次重构方案");
    for (const entry of choices) {
      expect(next.textContent).not.toContain(entry.label);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(entry.command);
    }
    expect(screen.queryByRole("region", { name: "实际重构记录" })).toBeNull();
    list[0] = { ...list[0]!, reconstruction: "实际重构：先有灰痕，后有垫片覆盖；人物仍无法辨认。", status: "RECONSTRUCTED" };
    rerender(<DetectivePanel detective={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际重构记录" }).textContent).toContain(list[0]!.reconstruction);
    expect(screen.getByRole("region", { name: "已取得的现场残留" }).textContent).not.toContain(list[0]!.reconstruction);
    expect(screen.getByRole("region", { name: "尚未补足的证据缺口" }).textContent).toContain("尚不知由谁搬动。");
    expect(screen.queryByRole("region", { name: "实际报告结果" })).toBeNull();
  });

  it("does not recommend the first report and never replaces gaps with a culprit", async () => {
    const list = cases();
    list[2] = { ...list[2]!, traces: ["轮印在箱角前偏转。"], reconstruction: "可追踪的轮印向左偏转，之后与箱角相接。", gaps: ["没有可辨认人物身份的痕迹。"], status: "RECONSTRUCTED" };
    const choices = [
      action({ type: "REPORT", caseId: "quay-collision", conclusion: "CART_BEFORE_PASSER" }, "报告轨迹并保留身份缺口"),
      action({ type: "REPORT", caseId: "quay-collision", conclusion: "NAME_SABOTEUR" }, "指认特定搬运者有意破坏"),
    ];
    const value = detective({ promoted: true, cases: list, actions: choices });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择案卷" }), "quay-collision");
    const next = screen.getByRole("region", { name: "守知者成长下一步" });
    expect(next.textContent).toContain("选择本次报告");
    for (const entry of choices) {
      expect(next.textContent).not.toContain(entry.label);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(entry.command);
    }
    expect(screen.queryByRole("region", { name: "实际报告结果" })).toBeNull();
    list[2] = { ...list[2]!, result: "实际报告反馈：已接受有限轨迹报告，身份与动机仍未知。", status: "RESOLVED" };
    rerender(<DetectivePanel detective={{ ...value, cases: list, actions: choices.map((entry) => ({ ...entry, enabled: false, reason: "本案已交付。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际报告结果" }).textContent).toContain(list[2]!.result);
    expect(screen.getByRole("region", { name: "实际重构记录" }).textContent).toContain(list[2]!.reconstruction);
    expect(screen.getByRole("region", { name: "尚未补足的证据缺口" }).textContent).toContain(list[2]!.gaps[0]);
  });

  it("keeps absent facts unknown without synthesizing action, route or report", () => {
    panel(detective({ promoted: true, cases: cases(), actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知重构环境" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "已取得的现场残留" }).textContent).toContain("不能确认未提供的事实");
    expect(screen.getByRole("region", { name: "尚未补足的证据缺口" }).textContent).toContain("不代表证据完整");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "实际重构记录" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际报告结果" })).toBeNull();
    expect(screen.queryByText(/隐藏真相|正确答案|已知凶手/)).toBeNull();
  });

  it("obeys domain eligibility, busy, blocked and readonly without recalculating action permission", async () => {
    const value = detective({ promoted: true, cases: cases(), actions: [
      action({ type: "SURVEY", caseId: "fallen-shelf" }, "勘察原现场", false),
      { ...action({ type: "REFLECT" }, "反思实际重构与报告"), cost: "1行动" },
    ] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^勘察原现场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("本周已尝试，须下周再来。").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /^反思实际重构/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<DetectivePanel detective={value} resources={resources} {...flags} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^反思实际重构/ });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders only supplied inherited and new abilities, without supplying higher-sequence imitation", () => {
    const inherited = Array.from({ length: 6 }, (_, index) => ({ id: `inherited-${index}`, label: `实际继承能力${index + 1}`, description: `原掌握描述${index + 1}`, mastery: 40 + index }));
    const abilities = [...inherited, ...DETECTIVE_ABILITIES.map((entry, index) => ({ ...entry, mastery: index * 7 }))];
    panel(detective({ promoted: true, actions: [], acting: 100, digestion: "实际重构与报告已消化。", environment: "三处获准查看的现场。", abilities }));
    const section = screen.getByRole("region", { name: "守知者能力与消化" });
    expect(section.textContent).toContain("9 项能力");
    expect(section.textContent).toContain("不会复制他人的非凡能力");
    expect(section.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(section.textContent).toContain("现场重构只整理已有残留支持的顺序、轨迹和缺口。武器、格斗与敏捷仍受实际身体和器械限制；不会复制他人的非凡能力。具体实践与数值以当前说明为准；当前渠道只提供成品魔药，不提供完整配方。");
    for (const marker of ["游戏设定（G）", "待核实"]) expect(section.textContent).not.toContain(marker);
    for (const entry of abilities) expect(within(section).getByText(`${entry.label} · 掌握 ${entry.mastery}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "守知者成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["CONSUME", "SURVEY", "RECONSTRUCT", "REPORT", "REFLECT"] as const)("locks and retries the same failed %s envelope without a new bottle or guessed outcome", async (type) => {
    const command: DetectiveCommand = type === "CONSUME" ? { type, bottleId: "detective-potion-2", confirmed: true }
      : type === "REFLECT" ? { type }
      : type === "RECONSTRUCT" ? { type, caseId: "fallen-shelf", plan: "FASTENER_FIRST" }
      : type === "REPORT" ? { type, caseId: "fallen-shelf", conclusion: "REPAIR_FASTENER" }
      : { type, caseId: "fallen-shelf" };
    const entry = action(command, `执行${type}`);
    const state = fixture(type === "CONSUME" ? 8 : 7, {
      detective: type === "CONSUME" ? bottled() : detective({ promoted: true, cases: cases(), actions: [entry] }),
      actionsRemaining: type === "CONSUME" ? 0 : 1,
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openDetective();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶守知者魔药」/ }));
    const label = type === "CONSUME" ? "确认服用「第二瓶守知者魔药」" : new RegExp(`^${entry.label}`);
    const confirm = screen.getByRole("button", { name: label });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "守知者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("守知者模拟保存失败");
    expect((screen.getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际重构记录" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际报告结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "DETECTIVE", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
