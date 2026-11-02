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


it('labels the current audience original bottle while forwarding its exact raw command', async () => {
  const value = bottled();
  const id = 'audience-batch-1:bottle';
  const command = { type: 'CONSUME' as const, bottleId: id, confirmed: true as const };
  value.bottles = [{ ...value.bottles[0]!, id, command, source: '仅由audience-batch-1的六项材料调配，原瓶audience-batch-1:bottle' }];
  value.actions = [{ ...value.actions[0]!, command }];
  const before = JSON.stringify(value);
  const { onCommand } = panel(value);
  expect(screen.getByRole('region', { name: '已调配的观众魔药' }).textContent).toContain('仅由第1批备料的六项材料调配，第1批观众原瓶');
  await userEvent.click(screen.getByRole('button', { name: /查看并准备服用/ }));
  const confirmation = screen.getByRole('region', { name: '这瓶观众魔药的服用确认' });
  expect(confirmation.textContent).toContain('这一瓶第1批观众原瓶');
  expect(confirmation.textContent).not.toContain('audience-batch-');
  await userEvent.click(screen.getByRole('button', { name: '暂不服用' }));
  expect(onCommand).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /查看并准备服用/ }));
  await userEvent.click(screen.getByRole('button', { name: '确认服用「第一瓶观众魔药」' }));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
  expect(JSON.stringify(value)).toBe(before);
});

it('uses readable audience labels in the existing recent-result summary without rewriting the chronicle', async () => {
  const state = fixture(social(), true);
  state.chronicle = [{ id: 'audience-success', week: 5, title: '成为观众', text: '原瓶audience-batch-1:bottle已耗尽。意志判定20/72，成功。' }];
  const before = JSON.stringify(state.chronicle);
  await enter(bridge(state));
  expect(screen.getByText('第1批观众原瓶已耗尽。意志判定20/72，成功。')).toBeTruthy();
  expect(JSON.stringify(state.chronicle)).toBe(before);
});


describe('Prepared audience bottle next-step guidance', () => {
  const work: AudienceAction = { id: 'second-batch-work', label: '第2批 · 整理阅览室目录', cost: '1行动', enabled: true, reason: null, command: { type: 'MATERIAL_WORK', batchId: 'audience-batch-2' } };
  function waiting(reason = '普通生活已完成2/4整周，第5周起可以服药。') {
    const value = bottled();
    value.bottles = [{ ...value.bottles[0]!, status: '已调配，尚未服用' }];
    value.actions = [work, { ...value.actions[0]!, enabled: false, reason }];
    return value;
  }
  it.each(['普通生活已完成2/4整周，第5周起可以服药。', '当前健康或精神不足，先休养。'])('keeps the original public bottle gate visible: %s', reason => {
    const value = waiting(reason), before = JSON.stringify(value);
    const { onCommand } = panel(value);
    const next = screen.getByRole('region', { name: '观众成长下一步' });
    expect(next.textContent).toContain(`下一步：${value.actions[1]!.label}。${reason}`);
    expect(next.textContent).not.toContain(work.label);
    expect((screen.getByRole('button', { name: /查看并准备服用/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /第2批 · 整理阅览室目录/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(onCommand).not.toHaveBeenCalled();
    expect(JSON.stringify(value)).toBe(before);
  });
  it('retains the waiting bottle when no material actions are available', () => {
    const value = waiting(); value.actions = value.actions.slice(1);
    panel(value);
    expect(screen.getByRole('region', { name: '观众成长下一步' }).textContent).toContain(value.actions[0]!.reason!);
  });
  it('still prefers an enabled consume over an earlier waiting bottle', () => {
    const value = waiting();
    const second = bottled();
    value.bottles.push(second.bottles[1]!); value.actions.push(second.actions[1]!);
    panel(value);
    expect(screen.getByRole('region', { name: '观众成长下一步' }).textContent).toContain(second.actions[1]!.label);
  });
  it.each(['missing-bottle', 'consumed', 'missing-action', 'unknown-status'] as const)('does not invent a prepared-bottle goal for %s', condition => {
    const value = waiting();
    if (condition === 'missing-bottle') value.bottles = [];
    if (condition === 'consumed') value.bottles[0]!.status = '已耗尽 · 排异，未晋升';
    if (condition === 'unknown-status') value.bottles[0]!.status = '未知状态';
    if (condition === 'missing-action') value.actions = [work];
    panel(value);
    expect(screen.getByRole('region', { name: '观众成长下一步' }).textContent).toContain(work.label);
  });
  it('leaves promoted social guidance ahead of any preparation residue', () => {
    const value = social(), pending = waiting();
    value.actions.push(...pending.actions); value.bottles = pending.bottles;
    panel(value);
    expect(screen.getByRole('region', { name: '观众成长下一步' }).textContent).toContain('询问收据日期');
  });
});


it.each([
  ['AVAILABLE', '尚未观察'], ['OBSERVED', '已观察，待核实'], ['RESOLVED', '核验已完成'],
  ['FUTURE_STATUS', 'FUTURE_STATUS'], ['OBSERVED_EXTRA', 'OBSERVED_EXTRA'], ['已观察，尚待处理', '已观察，尚待处理'],
])('labels only the exact public social status %s in the selector and current case', (status, label) => {
  const value = social(); value.scenes[0]!.status = status;
  const before = JSON.stringify(value);
  const { onCommand } = panel(value);
  expect(screen.getByRole('option', { name: `柜台收据 · ${label}` })).toBeTruthy();
  expect(screen.getByRole('region', { name: '当前社会情境' }).textContent).toContain(label);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'backstage-letter' } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'counter-receipt' } });
  expect(screen.getByRole('region', { name: '当前社会情境' }).textContent).toContain(label);
  expect(onCommand).not.toHaveBeenCalled();
  expect(JSON.stringify(value)).toBe(before);
});


describe('Audience case selection across transaction projections', () => {
  const renderPanel = (value: AudienceProjection, onCommand: (command: AudienceAction["command"]) => void, key = 'same-run') =>
    <AudiencePanel key={key} audience={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />;
  const current = () => screen.getByRole('region', { name: '当前社会情境' }).textContent;
  it('keeps the initial useful default after failure, a weekly unlock and successful resolution', () => {
    const value = social(), onCommand = vi.fn();
    // Earlier scene cannot act this week; the automatic initial default is the later scene.
    value.actions = value.actions.map(a => 'caseId' in a.command && a.command.caseId === 'counter-receipt' ? { ...a, enabled: false, reason: '下周可再试。' } : a);
    const view = render(renderPanel(value, onCommand));
    expect(current()).toContain('剧院门口有人递出一封信。');
    const failed = { ...value, actions: value.actions.map(a => ({ ...a, enabled: false })) };
    view.rerender(renderPanel(failed, onCommand));
    expect(current()).toContain('剧院门口有人递出一封信。');
    const nextWeek = social();
    view.rerender(renderPanel(nextWeek, onCommand));
    expect(current()).toContain('剧院门口有人递出一封信。');
    const resolved = { ...nextWeek, scenes: nextWeek.scenes.map(s => s.id === 'backstage-letter' ? { ...s, status: 'RESOLVED', story: '当前邀约已经共同核实。' } : s), actions: nextWeek.actions.filter(a => !('caseId' in a.command) || a.command.caseId !== 'backstage-letter') };
    view.rerender(renderPanel(resolved, onCommand));
    expect(current()).toContain('当前邀约已经共同核实。');
    expect(current()).toContain('核验已完成');
    expect(onCommand).not.toHaveBeenCalled();
  });
  it('falls back only when the selected scene disappears, including empty scenes', async () => {
    const value = social(), onCommand = vi.fn();
    const view = render(renderPanel(value, onCommand));
    await userEvent.selectOptions(screen.getByRole('combobox'), 'backstage-letter');
    view.rerender(renderPanel({ ...value, scenes: value.scenes.slice(0, 1) }, onCommand));
    expect(current()).toContain('店员把一张收据放在柜台上。');
    view.rerender(renderPanel({ ...value, scenes: [] }, onCommand));
    expect(screen.queryByRole('region', { name: '当前社会情境' })).toBeNull();
    view.rerender(renderPanel(value, onCommand));
    expect(current()).toContain('店员把一张收据放在柜台上。');
    expect(onCommand).not.toHaveBeenCalled();
  });
  it('resets at the existing new-run key and when leaving the promoted stage', async () => {
    const value = social(), onCommand = vi.fn();
    const view = render(renderPanel(value, onCommand));
    await userEvent.selectOptions(screen.getByRole('combobox'), 'backstage-letter');
    view.rerender(renderPanel(value, onCommand, 'new-run'));
    expect(current()).toContain('店员把一张收据放在柜台上。');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'backstage-letter');
    view.rerender(renderPanel({ ...value, promoted: false }, onCommand, 'new-run'));
    view.rerender(renderPanel(value, onCommand, 'new-run'));
    expect(current()).toContain('店员把一张收据放在柜台上。');
    expect(onCommand).not.toHaveBeenCalled();
  });
});
