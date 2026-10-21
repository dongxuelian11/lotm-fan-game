/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { REASONER_ABILITIES } from "../../src/domain/reasoner/content";
import type { ReasonerAction, ReasonerCommand, ReasonerProjection } from "../../src/domain/reasoner/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ReaderHistory, ReasonerPanel } from "../../src/renderer/ReasonerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const guidance: ReasonerAction = {
  id: "guidance", label: "学习推理学员服用指导", cost: "1行动 · 180便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
function reasoner(patch: Partial<ReasonerProjection> = {}): ReasonerProjection {
  return {
    title: "推理学员晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "阅读者扮演100，已度过4/4个完整序列9周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): ReasonerProjection {
  return reasoner({
    guidanceKnown: true,
    supplies: "完整配方待核；借阅馆三瓶独立成品，1210便士或完成3次劳动抵1050便士后付160便士；指导180便士。",
    actions: ["reasoner-potion-1", "reasoner-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "reasoner-potion-1", title: "第一瓶推理学员魔药", source: "借阅馆交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "reasoner-potion-1", confirmed: true } },
      { id: "reasoner-potion-2", title: "第二瓶推理学员魔药", source: "借阅馆交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "reasoner-potion-2", confirmed: true } },
      { id: "reasoner-potion-3", title: "第三瓶推理学员魔药", source: "借阅馆交接的第三原瓶", status: "导师保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "reasoner-potion-3", confirmed: true } },
    ],
  });
}
function cases(): ReasonerProjection["cases"] {
  return ["stair-footprints", "swapped-invoice", "broken-window"].map((id, index) => ({
    id, title: `公开推理案卷${index + 1}`, story: `原始资料与工具说明${index + 1}`,
    observations: [], hypotheses: [], testResult: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: ReasonerCommand, label = "勘察原现场与资料", enabled = true): ReasonerAction {
  return {
    id: JSON.stringify(command), label, cost: "1行动 · 本案公开成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: ReasonerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ReasonerPanel reasoner={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("reasoner-renderer-run", sliceDefaultCreationSelection, "reasoner-renderer-seed");
  raw.week = 10;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    reader: { ...state.reader, discovered: sequence !== null, promoted: sequence !== null, title: "阅读者 · 序列9", acting: 100, actions: [] },
    reasoner: reasoner({
      promoted: sequence === 8, title: sequence === 8 ? "推理学员 · 序列8" : "推理学员晋升",
      actions: sequence === 8 ? [] : [guidance],
    }),
    progression: {
      pathwayId: sequence === null ? null : "white-tower", sequence,
      mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5,
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
async function openReasoner() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "推理学员晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Reasoner sequence eight dossier", () => {
  it("retains exactly eight ordinary routes and never offers sequence eight before choosing Reader", async () => {
    const value = bridge(fixture(null));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路"]) {
      expect(choices.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /推理学员/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Reader as the S9 default and opens S8 preparation from its tab or dashboard guide", async () => {
    const value = bridge(fixture(9));
    await enter(value);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "阅读者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "推理学员晋升" }));
    expect(screen.getByRole("region", { name: "推理学员成长下一步" }).textContent).toContain("四个完整序列9周");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "推理学员成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S8 to Reasoner and keeps exact Reader history without obsolete commands", async () => {
    const state = fixture(8);
    state.reader.cases = [{ id: "shift-ledger", title: "旧交接簿", story: "旧案原场景", documents: ["旧案原抄件"], analysis: "旧案原分析", result: "旧案原提交结果", status: "RESOLVED" }];
    state.reader.actions = [{ id: "stale-reader", label: "不可重做的旧案", cost: "1行动", enabled: true, reason: null, command: { type: "READ", caseId: "shift-ledger" } }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`推理学员 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("推理学员 · 序列8 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openReasoner();
    expect(screen.getByRole("button", { name: "推理学员成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "推理学员成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "阅读者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "阅读者经历" }));
    const history = screen.getByRole("region", { name: "阅读者时期的经历" });
    for (const text of ["旧案原场景", "旧案原抄件", "旧案原分析", "旧案原提交结果"]) expect(within(history).getByText(text)).toBeTruthy();
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重做的旧案")).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("preserves Reader original bottles and inherited abilities in command-free history", () => {
    const old = fixture(8).reader;
    old.bottles = [{ id: "old-reader-bottle", title: "阅读者已服原瓶", source: "旧渠道原来源", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "old-reader-bottle", confirmed: true } }];
    old.abilities = [{ id: "reader.s9.memory", label: "已掌握的记忆", description: "旧能力原描述", mastery: 42 }];
    render(<ReaderHistory reader={old} />);
    expect(screen.getByText("来源：旧渠道原来源")).toBeTruthy();
    expect(screen.getByText("已服用 · 失败")).toBeTruthy();
    expect(screen.getByText("已掌握的记忆 · 掌握 42：旧能力原描述")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows finite individually sourced bottles and public costs while keeping the unverified formula hidden", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未核配方不应显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未核配方不应显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    expect(screen.getByRole("region", { name: "推理学员成长下一步" }).textContent).toContain("本阶段具体能力与成品药渠道以当前说明为准，当前渠道只提供成品魔药，不提供完整配方。取得渠道或晋升不会自动加入教会。");
    expect(screen.getByRole("region", { name: "推理学员成长下一步" }).textContent).not.toContain("原著细节");
  });

  it("cancels without a command, restores focus and confirms only the selected bottle once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶推理学员魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶推理学员魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶推理学员魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶推理学员魔药」/ }));
    expect(screen.getByText("reasoner-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：借阅馆交接的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "推理学员服用风险与四档结果" }).textContent).toContain(risk);
    expect(screen.getByText("0行动 · 独立确认 · 消耗这瓶魔药")).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶推理学员魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "reasoner-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops a stale confirmation when its original action disappears or the panel becomes read-only", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<ReasonerPanel reasoner={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<ReasonerPanel reasoner={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps backend maturity, guidance and labour-cost reasons rather than calculating permission", () => {
    const value = bottled();
    const reason = "阅读者扮演不足100，且仅度过3/4个完整序列9周。";
    const actions = value.actions.map((entry) => ({ ...entry, enabled: false, reason }));
    actions.push({ id: "buy", label: "取得借阅馆第三原瓶", cost: "1210便士，或实际劳动3/3抵1050便士后付160便士", enabled: false, reason: "现金不足", command: { type: "BUY_POTION", bottleId: "reasoner-potion-3" } });
    const { onCommand } = panel({ ...value, actions: [...actions, guidance] });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("1210便士，或实际劳动3/3抵1050便士后付160便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 180便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得借阅馆第三原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects one case and shows only its supplied observations and hypotheses without spending an action", async () => {
    const list = cases();
    list[1]!.observations = ["原发票纸张上留有一道压痕。", "实际提供的放大镜已放在桌边。"];
    list[1]!.hypotheses = ["可能是在抄写时换了页。", "也可能是归档时装订错位。"];
    const value = reasoner({ promoted: true, cases: list, actions: list.map((entry) => action({ type: "EXAMINE", caseId: entry.id })) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前案卷" })).toHaveLength(1);
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择案卷" }), "swapped-invoice");
    expect(screen.getByText("原始资料与工具说明2")).toBeTruthy();
    expect(screen.queryByText("原始资料与工具说明1")).toBeNull();
    const observations = screen.getByRole("region", { name: "已取得的现场观察" });
    const hypotheses = screen.getByRole("region", { name: "待检验的竞争假设" });
    for (const text of list[1]!.observations) expect(within(observations).getByText(text)).toBeTruthy();
    for (const text of list[1]!.hypotheses) expect(within(hypotheses).getByText(text)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "实际检验记录" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际结论结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^勘察原现场/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "EXAMINE", caseId: "swapped-invoice" });
  });

  it("keeps competing test choices neutral and waits for the committed actual test record", async () => {
    const list = cases();
    list[0] = { ...list[0]!, observations: ["台阶有两段不同宽度的足迹。"], hypotheses: ["两个人留下足迹。", "同一双鞋带泥量不同。"], status: "EXAMINED" };
    const first = action({ type: "TEST", caseId: "stair-footprints", testId: "measure-width" }, "用原尺量取足迹宽度");
    const second = action({ type: "TEST", caseId: "stair-footprints", testId: "compare-ledger" }, "核对当班原登记簿");
    const value = reasoner({ promoted: true, cases: list, actions: [first, second] });
    const { onCommand, rerender } = panel(value);
    const next = screen.getByRole("region", { name: "推理学员成长下一步" });
    expect(next.textContent).toContain("选择要实际进行的检验");
    for (const entry of [first, second]) {
      expect(next.textContent).not.toContain(entry.label);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(entry.command);
    }
    expect(screen.queryByRole("region", { name: "实际检验记录" })).toBeNull();
    list[0] = { ...list[0]!, testResult: "实际检验：登记簿只记下到场时间，不能辨认鞋印。", status: "TESTED" };
    rerender(<ReasonerPanel reasoner={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际检验记录" }).textContent).toContain(list[0]!.testResult);
    expect(screen.getByRole("region", { name: "待检验的竞争假设" }).textContent).not.toContain(list[0]!.testResult);
    expect(screen.queryByRole("region", { name: "实际结论结果" })).toBeNull();
  });

  it("never recommends the first conclusion and preserves separate actual test and conclusion outcomes", async () => {
    const list = cases();
    list[2] = { ...list[2]!, observations: ["窗扣弯曲，窗台有一处磨痕。"], hypotheses: ["搬运碰撞。", "外力撬动。"], testResult: "原工具对照后仍有一处尺寸不符。", status: "TESTED" };
    const choices = [
      action({ type: "CONCLUDE", caseId: "broken-window", conclusion: "collision" }, "结论：搬运时发生碰撞"),
      action({ type: "CONCLUDE", caseId: "broken-window", conclusion: "prying" }, "结论：有人从外面撬窗"),
      action({ type: "CONCLUDE", caseId: "broken-window", conclusion: "unknown" }, "结论：保留无法确认之处"),
    ];
    const value = reasoner({ promoted: true, cases: list, actions: choices });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择案卷" }), "broken-window");
    const next = screen.getByRole("region", { name: "推理学员成长下一步" });
    expect(next.textContent).toContain("选择本次结论");
    for (const entry of choices) {
      expect(next.textContent).not.toContain(entry.label);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(entry.command);
    }
    expect(screen.queryByRole("region", { name: "实际结论结果" })).toBeNull();
    list[2] = { ...list[2]!, result: "实际结论反馈：此项推断尚缺原始证据支持。", status: "RESOLVED" };
    rerender(<ReasonerPanel reasoner={{ ...value, cases: list, actions: choices.map((entry) => ({ ...entry, enabled: false, reason: "本案已结算。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际结论结果" }).textContent).toContain(list[2]!.result);
    expect(screen.getByRole("region", { name: "实际检验记录" }).textContent).not.toContain(list[2]!.result);
  });

  it("keeps missing information unknown and creates no unsupplied action or result", () => {
    panel(reasoner({ promoted: true, cases: cases(), actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知推理环境" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "已取得的现场观察" }).textContent).toContain("不能确认未提供的事实");
    expect(screen.getByRole("region", { name: "待检验的竞争假设" }).textContent).toContain("尚无可供比较的假设");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "实际检验记录" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际结论结果" })).toBeNull();
    expect(screen.queryByText(/隐藏真相|正确答案|已知凶手/)).toBeNull();
  });

  it("obeys backend reason, busy, blocked and readonly while allowing projected zero-AP reflection", async () => {
    const value = reasoner({ promoted: true, cases: cases(), actions: [
      action({ type: "EXAMINE", caseId: "stair-footprints" }, "勘察原现场", false),
      { ...action({ type: "REFLECT" }, "反思实际检验与结论"), cost: "0行动" },
    ] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^勘察原现场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("本周已尝试，须下周再来。").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /^反思实际检验/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<ReasonerPanel reasoner={value} resources={resources} {...flags} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^反思实际检验/ });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders only supplied S8 abilities with finite observation and channel limits", () => {
    panel(reasoner({ promoted: true, actions: [], acting: 100, digestion: "实际观察与检验已消化。", environment: "三处获准查看的现场及原始资料。", abilities: REASONER_ABILITIES.map((entry, index) => ({ ...entry, mastery: index * 7 })) }));
    const ability = screen.getByRole("region", { name: "推理学员能力与消化" });
    expect(ability.textContent).toContain("具体能力限于有限观察、假设比较与实际检验；当前渠道只提供成品魔药，不提供完整配方。结论必须受已有资料约束，不能读心、凭空生成证据或自动得知真相。");
    for (const marker of ["具体能力按实现", "原著正文细节", "游戏设定（G）"]) expect(ability.textContent).not.toContain(marker);
    expect(ability.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(ability.textContent).toContain("不能读心、凭空生成证据或自动得知真相");
    for (const [index, entry] of REASONER_ABILITIES.entries()) expect(within(ability).getByText(`${entry.label} · 掌握 ${index * 7}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "推理学员成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["CONSUME", "EXAMINE", "TEST", "CONCLUDE", "REFLECT"] as const)("locks and retries the same failed %s envelope without consuming a second bottle or repeating a case", async (type) => {
    const command: ReasonerCommand = type === "CONSUME" ? { type, bottleId: "reasoner-potion-2", confirmed: true }
      : type === "REFLECT" ? { type }
      : type === "TEST" ? { type, caseId: "stair-footprints", testId: "measure-width" }
      : type === "CONCLUDE" ? { type, caseId: "stair-footprints", conclusion: "unknown" }
      : { type, caseId: "stair-footprints" };
    const entry = action(command, `执行${type}`);
    const state = fixture(type === "CONSUME" ? 9 : 8, {
      reasoner: type === "CONSUME" ? bottled() : reasoner({ promoted: true, cases: cases(), actions: [entry] }),
      actionsRemaining: type === "CONSUME" || type === "REFLECT" ? 0 : 1,
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openReasoner();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶推理学员魔药」/ }));
    const label = type === "CONSUME" ? "确认服用「第二瓶推理学员魔药」" : new RegExp(`^${entry.label}`);
    const confirm = screen.getByRole("button", { name: label });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "推理学员模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("推理学员模拟保存失败");
    expect((screen.getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际检验记录" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际结论结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "REASONER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
