/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { AudienceAction, AudienceProjection } from "../../src/domain/audience/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { AudiencePanel } from "../../src/renderer/AudiencePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: AudienceAction = {
  id: "discover", label: "拜访沙龙引荐人", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = "领域四档风险原文：失败也会消耗这瓶魔药，并损失健康与精神。";
function audience(patch: Partial<AudienceProjection> = {}): AudienceProjection {
  return {
    title: "观众之路", discovered: false, formulaKnown: false, promoted: false,
    formula: [], actions: [discover], bottles: [], abilities: [], acting: 0,
    digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    scenes: [], trust: 0, ...patch,
  };
}
function bottled(): AudienceProjection {
  return audience({
    discovered: true, formulaKnown: true,
    actions: ["audience-potion-1", "audience-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "audience-potion-1", title: "第一瓶观众魔药", source: "劳务所得材料 · 第一批", status: "已调配", chance: 71, command: { type: "CONSUME", bottleId: "audience-potion-1", confirmed: true } },
      { id: "audience-potion-2", title: "第二瓶观众魔药", source: "自费购入材料 · 第二批", status: "已调配", chance: 43, command: { type: "CONSUME", bottleId: "audience-potion-2", confirmed: true } },
    ],
  });
}
function social(): AudienceProjection {
  return audience({
    title: "观众 · 序列9", discovered: true, promoted: true, trust: 2, acting: 24, digestion: "开始理解旁观与核实",
    scenes: [
      { id: "counter-receipt", title: "柜台收据", story: "店员把一张收据放在柜台上。", observations: ["店员望向门口，手指停在日期处。"], interpretation: "可能在等待别人核对，也可能只是着急。", status: "已观察，尚待处理" },
      { id: "backstage-letter", title: "后台来信", story: "剧院门口有人递出一封信。", observations: [], interpretation: "", status: "尚未观察" },
    ],
    actions: [
      { id: "ask", label: "询问收据日期", cost: "1行动 · 2灵性", enabled: true, reason: null, command: { type: "DISCUSS", caseId: "counter-receipt", approach: "ASK" } },
      { id: "verify", label: "核对公开账目", cost: "1行动", enabled: true, reason: null, command: { type: "DISCUSS", caseId: "counter-receipt", approach: "VERIFY" } },
      { id: "accuse", label: "当场指责店员", cost: "1行动 · 可能损害信任", enabled: true, reason: null, command: { type: "DISCUSS", caseId: "counter-receipt", approach: "ACCUSE" } },
      { id: "observe-letter", label: "观察门口的交谈", cost: "1行动 · 1灵性", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "backstage-letter" } },
      { id: "reflect", label: "复盘这次社会交往", cost: "1行动", enabled: false, reason: "还有未处理的公开情境。", command: { type: "REFLECT" } },
    ],
    abilities: [{ id: "audience.s9.observation", label: "观察", description: "从公开表情与动作获得线索。", mastery: 15 }],
  });
}
function panel(value: AudienceProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<AudiencePanel audience={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(value = audience(), promoted = false): SliceProjection {
  const raw = createSliceRun("audience-renderer-run", sliceDefaultCreationSelection, "audience-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null, audience: value,
    progression: { pathwayId: promoted ? "audience" : null, sequence: promoted ? 9 : null, mastery: {}, acting: 0, promotionWeek: promoted ? 5 : null },
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
async function openAudience() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "观众之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Audience pathway dossier", () => {
  it("offers the third optional route and preserves ordinary work after closing", async () => {
    const value = bridge(fixture());
    await enter(value);
    await openAudience();
    for (const title of ["占卜家之路", "猎人之路", "观众之路"]) expect(screen.getByRole("button", { name: title })).toBeTruthy();
    expect(screen.getByRole("region", { name: "观众成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect((screen.getByRole("button", { name: /^工作，/ }) as HTMLButtonElement).disabled).toBe(false);
    await openAudience();
    expect(screen.getByRole("region", { name: "观众成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps unknown formula, social scenes and unacquired abilities hidden", async () => {
    const value = social();
    const { onCommand } = panel({ ...value, promoted: false, discovered: false, formulaKnown: false, actions: [discover], formula: [{ name: "未学配方", quantity: 1, unit: "份" }] });
    expect(screen.queryByText("未学配方")).toBeNull();
    expect(screen.queryByRole("region", { name: "观众能力与消化" })).toBeNull();
    expect(screen.queryByText("店员把一张收据放在柜台上。")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /拜访沙龙引荐人/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "DISCOVER" });
  });

  it("shows all six known quantities and forwards public acquisition actions unchanged", async () => {
    const buy: AudienceAction = { id: "buy", label: "购齐这一批六种材料", cost: "领域成本原文 240便士", enabled: true, reason: null, command: { type: "BUY_MATERIALS", batchId: "batch-ui" } };
    const { onCommand } = panel(audience({ discovered: true, formulaKnown: true, formula: Array.from({ length: 6 }, (_, index) => ({ name: `测试材料${index + 1}`, quantity: index + 1, unit: "份" })), actions: [buy] }));
    await userEvent.click(screen.getByText("查看已知配方 · 6 种材料"));
    expect(screen.getByText("测试材料6")).toBeTruthy();
    expect(screen.getByText("6 份")).toBeTruthy();
    expect(screen.getByText(/以上是配方用量/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /购齐这一批六种材料/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(buy.command);
  });

  it("cancels freely, restores focus and confirms the exact second bottle once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶观众魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶观众魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶观众魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶观众魔药」/ }));
    expect(screen.getByText("audience-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "观众服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶观众魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "audience-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not transfer confirmation when its original bottle or action disappears", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶观众魔药」/ }));
    rerender(<AudiencePanel audience={{ ...value, bottles: value.bottles.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶观众魔药」/ }));
    rerender(<AudiencePanel audience={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one social scene with observations separate from tentative interpretation", async () => {
    const { onCommand } = panel(social());
    const scene = screen.getByRole("region", { name: "当前社会情境" });
    expect(within(scene).getByText("店员把一张收据放在柜台上。")).toBeTruthy();
    expect(within(scene).getByRole("region", { name: "亲眼观察到的线索" }).textContent).toContain("店员望向门口，手指停在日期处。");
    const interpretation = within(scene).getByRole("region", { name: "暂时的解读" });
    expect(interpretation.textContent).toContain("可能在等待别人核对，也可能只是着急。");
    expect(interpretation.textContent).toContain("推测仍需核实");
    expect(screen.queryByRole("button", { name: /观察门口的交谈/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择社会情境" }), "backstage-letter");
    expect(screen.queryByText("店员把一张收据放在柜台上。")).toBeNull();
    expect(screen.queryByRole("button", { name: /询问收据日期/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "暂时的解读" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /观察门口的交谈/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "OBSERVE", caseId: "backstage-letter" });
  });

  it("renders only projected scene choices, retaining public costs, reasons and commands", async () => {
    const value = social();
    const { onCommand } = panel(value);
    for (const action of value.actions.slice(0, 3)) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(action.label) }));
      expect(onCommand).toHaveBeenLastCalledWith(action.command);
    }
    const reflection = screen.getByRole("button", { name: /复盘这次社会交往/ }) as HTMLButtonElement;
    expect(reflection.disabled).toBe(true);
    expect(screen.getByText("还有未处理的公开情境。")).toBeTruthy();
    fireEvent.click(reflection);
    expect(onCommand).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("keeps scene selection after a public update and falls back when that scene disappears", async () => {
    const value = social();
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择社会情境" }), "backstage-letter");
    rerender(<AudiencePanel audience={{ ...value, trust: 4 }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前社会情境" }).textContent).toContain("剧院门口有人递出一封信。");
    rerender(<AudiencePanel audience={{ ...value, scenes: value.scenes.slice(0, 1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前社会情境" }).textContent).toContain("店员把一张收据放在柜台上。");
  });

  it("never recreates an omitted scene choice and forwards an enabled reflection unchanged", async () => {
    const value = social();
    const reflect: AudienceAction = { id: "reflect-ready", label: "记下旁观者的分寸", cost: "领域公开复盘成本", enabled: true, reason: null, command: { type: "REFLECT" } };
    const { onCommand } = panel({ ...value, actions: [value.actions[1]!, reflect] });
    expect(screen.queryByRole("button", { name: /询问收据日期|当场指责店员|观察门口的交谈/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /记下旁观者的分寸/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(reflect.command);
  });

  it("locks social choices and selection while saving or blocked", () => {
    const value = social();
    const onCommand = vi.fn();
    const view = render(<AudiencePanel audience={value} resources={resources} busy={true} blocked={false} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    view.rerender(<AudiencePanel audience={value} resources={resources} busy={false} blocked={true} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /核对公开账目/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows actual trust, ability mastery and qualitative digestion", () => {
    panel(social());
    expect(screen.getByText("交往信任：2")).toBeTruthy();
    const abilities = screen.getByRole("region", { name: "观众能力与消化" });
    expect(abilities.textContent).toContain("观察 · 掌握 15");
    expect(abilities.textContent).toContain("扮演进度 24 · 消化：开始理解旁观与核实");
    expect(abilities.textContent).toContain("灵性 12 / 30 · 污染 3");
  });

  it("defaults an Audience9 character to audience and keeps known prior channels read-only", async () => {
    const state = fixture(social(), true);
    state.seer.discovered = true;
    state.hunter.discovered = true;
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`观众 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "观众成长下一步" })).toBeTruthy();
    for (const [tab, region] of [["占卜家经历", "已了解的占卜家渠道"], ["猎人经历", "已了解的猎人渠道"]] as const) {
      await userEvent.click(screen.getByRole("button", { name: tab }));
      expect(within(screen.getByRole("region", { name: region })).queryByRole("button")).toBeNull();
      expect(screen.queryByRole("region", { name: "当前社会情境" })).toBeNull();
    }
    expect(screen.queryByRole("button", { name: "小丑晋升" })).toBeNull();
    expect(screen.queryByRole("button", { name: "挑衅者晋升" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["diviner", "hunter"] as const)("keeps known audience original bottles read-only after choosing %s", async (pathwayId) => {
    const state = fixture(bottled());
    state.progression = { ...state.progression, pathwayId, sequence: 9, promotionWeek: 5 };
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "观众经历" }));
    const history = screen.getByRole("region", { name: "已了解的观众渠道" });
    expect(history.textContent).toContain("第一瓶观众魔药");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "观众能力与消化" })).toBeNull();
  });

  it("submits the chosen public social action once and keeps the saved dossier open until manually closed", async () => {
    const state = fixture(social(), true);
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    value.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    await enter(value);
    await openAudience();
    const ask = screen.getByRole("button", { name: /询问收据日期/ });
    fireEvent.click(ask);
    fireEvent.click(ask);
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    const envelope = vi.mocked(value.submitIntent).mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "AUDIENCE", command: { type: "DISCUSS", caseId: "counter-receipt", approach: "ASK" } });
    await act(async () => { finish(receipt({ ...state, revision: state.revision + 1, audience: { ...state.audience, trust: 3 } }, envelope)); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    await openAudience();
    expect(screen.getByText("交往信任：3")).toBeTruthy();
  });

  it("retries the exact failed envelope and selected original bottle, locking tabs and close", async () => {
    const state = fixture(bottled());
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openAudience();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶观众魔药」/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶观众魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "观众模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("观众模拟保存失败");
    expect((screen.getByRole("button", { name: "确认服用「第二瓶观众魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    for (const name of ["占卜家之路", "猎人之路", "观众之路"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "AUDIENCE", command: { type: "CONSUME", bottleId: "audience-potion-2", confirmed: true } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
