/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { READER_ABILITIES } from "../../src/domain/reader/content";
import type { ReaderAction, ReaderProjection } from "../../src/domain/reader/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ReaderPanel } from "../../src/renderer/ReaderPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: ReaderAction = {
  id: "discover", label: "拜访案卷导师", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
function reader(patch: Partial<ReaderProjection> = {}): ReaderProjection {
  return {
    title: "阅读者之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): ReaderProjection {
  return reader({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核，只能取得案卷导师三瓶独立成品；供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["reader-potion-1", "reader-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "reader-potion-1", title: "第一瓶阅读者魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "reader-potion-1", confirmed: true } },
      { id: "reader-potion-2", title: "第二瓶阅读者魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "reader-potion-2", confirmed: true } },
      { id: "reader-potion-3", title: "第三瓶阅读者魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "reader-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: ReaderProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ReaderPanel reader={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("reader-renderer-run", sliceDefaultCreationSelection, "reader-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    reader: reader({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "阅读者 · 序列9" : "阅读者之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? READER_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "white-tower" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(READER_ABILITIES.map((ability) => [ability.id, 0])) : {},
      acting: 0, promotionWeek: promoted ? 5 : null,
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
async function openReader() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "阅读者之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function cases(): ReaderProjection["cases"] {
  return ["shift-ledger", "parcel-copy", "ritual-margin"].map((id, index) => ({
    id, title: `公开案卷${index + 1}`, story: `公开案卷说明${index + 1}`,
    documents: [], analysis: null, result: null, status: "AVAILABLE",
  }));
}
function caseAction(caseId = "shift-ledger", type: "READ" | "ANALYZE" | "SUBMIT" = "READ", conclusion: "LIMITED" | "CERTAIN" = "LIMITED", enabled = true): ReaderAction {
  return {
    id: `${type}-${caseId}-${conclusion}`,
    label: type === "READ" ? "阅读交接簿与值班员摘录" : type === "ANALYZE" ? "比对时间戳与抄录缺口" : conclusion === "LIMITED" ? "提交：尚不能确定缺席者" : "提交：就是缺席者所为",
    cost: type === "SUBMIT" ? "1行动 · 实际提交结论" : "1行动 · 本案公开成本",
    enabled, reason: enabled ? null : "本周已尝试，须下周再来。",
    command: type === "SUBMIT" ? { type, caseId, conclusion } : { type, caseId },
  };
}

describe("Reader sequence nine dossier", () => {
  it("adds a seventh ordinary choice without joining a church or spending an action to open it", async () => {
    const value = bridge(fixture());
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await openReader();
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "阅读者之路" }).textContent).toContain("案卷阅读与核实");
    expect(screen.getByRole("region", { name: "阅读者成长下一步" }).textContent).toContain("不会自动加入教会");
    expect(screen.queryByRole("button", { name: /推理学员|守知者/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows individually sourced finite finished bottles and no unknown formula", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "隐藏配方不应显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("隐藏配方不应显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, restores focus and independently confirms only the selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶阅读者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶阅读者魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶阅读者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶阅读者魔药」/ }));
    expect(screen.getByText("reader-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "阅读者服用风险与四档结果" }).textContent).toContain(risk);
    expect(screen.getByText("0行动 · 独立确认 · 消耗这瓶魔药")).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶阅读者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "reader-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale confirmation if its original action disappears or the route becomes read-only", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶阅读者魔药」/ }));
    rerender(<ReaderPanel reader={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶阅读者魔药」/ }));
    rerender(<ReaderPanel reader={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains backend timing and acquisition costs instead of inferring permission from cash or AP", () => {
    const value = bottled();
    const reason = "尚未完成四个完整周，第5周起才能服药。";
    const actions = value.actions.map((action) => ({ ...action, enabled: false, reason }));
    actions.push({ id: "buy", label: "取得导师原瓶", cost: "660便士，或实际劳动2/2后60便士", enabled: false, reason: "现金不足", command: { type: "BUY_POTION", bottleId: "reader-potion-3" } });
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("660便士，或实际劳动2/2后60便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得导师原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected case with only its public source cards and no unread facts", async () => {
    const list = cases();
    list[1]!.documents = ["包裹交接抄本：只记录了送出日期。", "收件人公开说明：原始收据仍未找到。"];
    const value = reader({ promoted: true, cases: list, actions: list.map((entry) => caseAction(entry.id)) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前案卷" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^阅读交接簿/ })).toHaveLength(1);
    expect(screen.getByText("尚未阅读本案资料，不能据此确认缺失的内容。")).toBeTruthy();
    expect(screen.queryByText(list[1]!.documents[0]!)).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择案卷" }), "parcel-copy");
    expect(screen.getByText("公开案卷说明2")).toBeTruthy();
    expect(screen.queryByText("公开案卷说明1")).toBeNull();
    for (const [index, source] of list[1]!.documents.entries()) {
      expect(within(screen.getByRole("article", { name: `公开资料 ${index + 1}` })).getByText(source)).toBeTruthy();
    }
    expect(screen.queryByRole("region", { name: "资料分析与待核之处" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际提交结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^阅读交接簿/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "READ", caseId: "parcel-copy" });
  });

  it("requires committed reading and analysis before displaying their text, then forwards either conclusion unchanged", async () => {
    const list = cases();
    const value = reader({ promoted: true, cases: list, actions: [caseAction()] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^阅读交接簿/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "READ", caseId: "shift-ledger" });
    expect(screen.queryByRole("article")).toBeNull();
    list[0] = { ...list[0]!, status: "READ", documents: ["值班簿：这页没有交接签名。", "公开摘录：时钟曾停走。"] };
    rerender(<ReaderPanel reader={{ ...value, cases: list, actions: [caseAction("shift-ledger", "ANALYZE")] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: /^比对时间戳/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "ANALYZE", caseId: "shift-ledger" });
    expect(screen.queryByRole("region", { name: "资料分析与待核之处" })).toBeNull();
    list[0] = { ...list[0]!, status: "ANALYZED", analysis: "公开分析：缺少签名与停钟都不足以证明是谁取走物件。" };
    rerender(<ReaderPanel reader={{ ...value, cases: list, actions: [caseAction("shift-ledger", "SUBMIT", "LIMITED"), caseAction("shift-ledger", "SUBMIT", "CERTAIN")] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "资料分析与待核之处" }).textContent).toContain(list[0]!.analysis);
    expect(screen.getByRole("region", { name: "阅读者成长下一步" }).textContent).not.toContain("提交：尚不能确定缺席者");
    await userEvent.click(screen.getByRole("button", { name: /^提交：尚不能确定缺席者/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "SUBMIT", caseId: "shift-ledger", conclusion: "LIMITED" });
    await userEvent.click(screen.getByRole("button", { name: /^提交：就是缺席者所为/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "SUBMIT", caseId: "shift-ledger", conclusion: "CERTAIN" });
    expect(screen.queryByRole("region", { name: "实际提交结果" })).toBeNull();
    list[0] = { ...list[0]!, result: "实际结果：导师退回这份证据不足的指认。", status: "RESOLVED" };
    rerender(<ReaderPanel reader={{ ...value, cases: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际提交结果" }).textContent).toContain(list[0]!.result);
    expect(screen.getByRole("region", { name: "资料分析与待核之处" }).textContent).not.toContain(list[0]!.result);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps unprovided sources and environment unknown without inventing an answer or combat action", () => {
    panel(reader({ promoted: true, cases: cases(), actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知案卷环境" }).textContent).toContain("尚未确认");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("region", { name: "资料分析与待核之处" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际提交结果" })).toBeNull();
    expect(screen.queryByText(/隐藏真相|正确答案|已知凶手/)).toBeNull();
  });

  it("obeys backend reasons, busy and blocked states without a blanket zero-AP lock", async () => {
    const value = reader({ promoted: true, cases: cases(), actions: [caseAction("shift-ledger", "READ", "LIMITED", false), { id: "reflect", label: "反思实际阅读与提交", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^阅读交接簿/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("本周已尝试，须下周再来。").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /^反思实际阅读/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<ReaderPanel reader={value} resources={resources} busy blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^反思实际阅读/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择案卷" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<ReaderPanel reader={value} resources={resources} busy={false} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^反思实际阅读/ }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("shows only supplied abilities and distinguishes approved game design from unverified novel powers", () => {
    panel(reader({ promoted: true, actions: [], acting: 100, digestion: "实际阅读与提交已消化。", environment: "三份经许可提供的案卷副本。", abilities: READER_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 })) }));
    const ability = screen.getByRole("region", { name: "阅读者能力与消化" });
    expect(ability.textContent).toContain("已确认的游戏设计");
    expect(ability.textContent).toContain("原著正文仍待核实");
    expect(ability.textContent).toContain("记住资料不等于证明其真实");
    for (const [index, entry] of READER_ABILITIES.entries()) expect(within(ability).getByText(`${entry.label} · 掌握 ${index * 7}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "已知案卷环境" }).textContent).toContain("三份经许可提供的案卷副本。");
    expect(screen.getByRole("region", { name: "阅读者成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens white-tower growth by default and retains previously learned other channels as history", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "先前已知的占卜家材料", quantity: 1, unit: "份" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`阅读者 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("阅读者 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "阅读者成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /推理学员/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /守知者/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("先前已知的占卜家材料");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("makes stale Reader channels read-only after selecting another route and shows the backend reason", async () => {
    const value = bottled();
    value.actions[0] = { ...value.actions[0]!, enabled: false, reason: "已踏入占卜家途径，不可改换为阅读者。" };
    const state = fixture(false, { reader: value, progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } });
    const api = bridge(state);
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "阅读者经历" }));
    expect(screen.getByText("已选择其它途径，这份阅读者渠道只供回看。")).toBeTruthy();
    expect(screen.getByText("已踏入占卜家途径，不可改换为阅读者。")).toBeTruthy();
    for (const button of screen.getAllByRole("button", { name: /查看并准备服用/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"], ["darkness", "梦魇成长下一步"],
  ] as const)("keeps the existing %s S7 route as the default rather than the seventh channel", async (pathwayId, heading) => {
    const state = fixture(false, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.reader.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "阅读者成长下一步" })).toBeNull();
  });

  it.each(["CONSUME", "READ", "ANALYZE", "SUBMIT"] as const)("locks and retries the same failed %s envelope without a duplicate action", async (type) => {
    const isCase = type !== "CONSUME";
    const action = isCase ? caseAction("shift-ledger", type, "CERTAIN") : null;
    const state = fixture(isCase, { reader: action ? reader({ promoted: true, cases: cases(), actions: [action] }) : bottled(), actionsRemaining: isCase ? 1 : 0, canAct: isCase });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openReader();
    if (!isCase) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶阅读者魔药」/ }));
    const confirm = screen.getByRole("button", { name: action ? new RegExp(`^${action.label}`) : "确认服用「第二瓶阅读者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "阅读者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("阅读者模拟保存失败");
    expect((screen.getByRole("button", { name: action ? new RegExp(`^${action.label}`) : "确认服用「第二瓶阅读者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际提交结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "READER", command: action?.command ?? { type: "CONSUME", bottleId: "reader-potion-2", confirmed: true } });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
