/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeerPanel, type SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import type { SeerAction, SeerProjection } from "../../src/domain/seer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 15, cash: "2镑 3苏勒 4便士", actionsRemaining: 2,
};
const discover: SeerAction = {
  id: "discover", label: "拜访神秘学店铺", cost: "1 行动", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
function seer(patch: Partial<SeerProjection> = {}): SeerProjection {
  return {
    practice: projectSliceState(createSliceRun("seer-panel-fixture", sliceDefaultCreationSelection, "seer-panel-fixture")).seer.practice,
    title: "占卜家之路", discovered: false, formulaKnown: false, promoted: false,
    formula: [], actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "尚未服药", pollution: 3,
    risk: "测试风险说明：失败耗尽这瓶魔药，并损失健康与精神。", ...patch,
  };
}
function bottled(): SeerProjection {
  return seer({
    discovered: true, formulaKnown: true,
    actions: ["bottle-a", "bottle-b"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "1 行动 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "bottle-a", title: "第一瓶魔药", source: "劳务所得材料 · 第一批", status: "已调配", chance: 71, command: { type: "CONSUME", bottleId: "bottle-a", confirmed: true } },
      { id: "bottle-b", title: "第二瓶魔药", source: "自费购入材料 · 第二批", status: "已调配", chance: 43, command: { type: "CONSUME", bottleId: "bottle-b", confirmed: true } },
    ],
  });
}
function panel(value: SeerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SeerPanel seer={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(value: SeerProjection = seer()): SliceProjection {
  const state = projectSliceState(createSliceRun("seer-renderer-run", sliceDefaultCreationSelection, "seer-renderer-seed"));
  return {
    ...state, character: { ...state.character, name: "艾琳" }, activeEvent: null,
    seer: value, canAct: true, actionBlockedReason: null,
    progression: { pathwayId: null, sequence: null, mastery: {}, acting: 0, promotionWeek: null },
  };
}
function testBridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-11T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId,
    previousRevision: envelope.expectedRevision, newRevision: state.revision,
    committedAt: "2026-10-11T00:01:00Z", replayed: false, state,
  } };
}
async function enter(bridge: SliceBridge) {
  window.sliceGame = bridge;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Seer progression dossier", () => {
  it("offers discovery and the four-full-week guidance without revealing an unknown formula or abilities", async () => {
    const { onCommand } = panel(seer({
      formula: [{ name: "未见配方测试材料", quantity: 1, unit: "份" }],
      abilities: [{ id: "hidden", label: "未获能力测试", description: "不可泄漏", mastery: 0 }],
    }));
    expect(screen.getByText(/首次晋升需先完成四整周生活/)).toBeTruthy();
    expect(screen.queryByText("未见配方测试材料")).toBeNull();
    expect(screen.queryByText(/未获能力测试/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /拜访神秘学店铺/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "DISCOVER" });
  });

  it("uses projected action costs and disabled reasons verbatim", () => {
    const action = { ...discover, enabled: false, cost: "领域成本原文 17", reason: "领域阻止原因原文" };
    const { onCommand } = panel(seer({ actions: [action] }));
    const button = screen.getByRole("button", { name: /拜访神秘学店铺/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(within(button).getByText(action.cost)).toBeTruthy();
    expect(screen.getByText(action.reason)).toBeTruthy();
    fireEvent.click(button);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows known formula quantities and both projected material routes without treating the recipe as inventory", async () => {
    const value = seer({
      discovered: true, formulaKnown: true,
      formula: Array.from({ length: 7 }, (_, i) => ({ name: `已知测试材料${i + 1}`, quantity: i + 1, unit: "份" })),
      actions: [
        { id: "buy", label: "购齐这一批七种材料", cost: "1 行动 · 240 便士", enabled: true, reason: null, command: { type: "BUY_MATERIALS", batchId: "batch-ui" } },
        { id: "work", label: "继续材料劳务（第2步）", cost: "1 行动 · 无现金支出", enabled: true, reason: null, command: { type: "MATERIAL_WORK", batchId: "batch-ui" } },
      ],
    });
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByText("查看已知配方 · 7 种材料"));
    expect(screen.getByText("已知测试材料7")).toBeTruthy();
    expect(screen.getByText("7 份")).toBeTruthy();
    expect(screen.getByText(/以上是配方用量/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /购齐这一批七种材料/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "BUY_MATERIALS", batchId: "batch-ui" });
  });

  it("cancels without a command and requires a fresh confirmation for the selected exact bottle", async () => {
    const value = bottled();
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶魔药」/ }));
    expect(screen.getByText("71%")).toBeTruthy();
    expect(screen.getByText(/劳务所得材料 · 第一批/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶魔药」/ }));
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("bottle-b")).toBeTruthy();
    expect(screen.getByText(value.risk)).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 15", resources.cash]) expect(within(current).getByText(text)).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶魔药」" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "bottle-b", confirmed: true });
  });

  it("does not transfer confirmation when a bottle disappears or is replaced", async () => {
    const value = bottled();
    const onCommand = vi.fn();
    const view = panel(value, onCommand);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶魔药」/ }));
    view.rerender(<SeerPanel seer={{ ...value, bottles: [value.bottles[1]!] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(screen.getByRole("button", { name: /查看并准备服用「第二瓶魔药」/ })).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("displays dynamic spirituality, per-ability mastery, acting and qualitative digestion after promotion", () => {
    render(<SeerPanel seer={seer({
      discovered: true, promoted: true, actions: [], acting: 3, digestion: "开始理解扮演", abilities: [
        { id: "sight", label: "灵视", mastery: 12, description: "已经公开的灵视说明" },
        { id: "divination", label: "占卜", mastery: 7, description: "已经公开的占卜说明" },
      ],
    })} resources={{ ...resources, maxSpirituality: 48 }} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.getByText(/灵性 12 \/ 48/)).toBeTruthy();
    expect(screen.getByText("灵视 · 掌握 12")).toBeTruthy();
    expect(screen.getByText("占卜 · 掌握 7")).toBeTruthy();
    expect(screen.getByText(/扮演进度 3 · 消化：开始理解扮演/)).toBeTruthy();
    expect(screen.queryByText(/首次晋升/)).toBeNull();
  });

  it("keeps growth optional so closing it returns to ordinary work and rest without spending an action", async () => {
    const bridge = testBridge(fixture());
    await enter(bridge);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect((screen.getByRole("button", { name: /工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /休养，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(bridge.submitIntent).not.toHaveBeenCalled();
  });

  it("locks pending confirmation against double clicks and retries the exact failed envelope and bottle", async () => {
    const state = fixture(bottled());
    const bridge = testBridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    bridge.submitIntent = submit;
    await enter(bridge);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶魔药」/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: /正在结算并保存/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("模拟保存失败");
    expect((screen.getByRole("button", { name: "确认服用「第二瓶魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SEER", command: { type: "CONSUME", bottleId: "bottle-b", confirmed: true } });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
