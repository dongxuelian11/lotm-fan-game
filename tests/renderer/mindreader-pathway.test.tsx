/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { MindreaderAction, MindreaderProjection } from "../../src/domain/mindreader/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { MindreaderPanel } from "../../src/renderer/MindreaderPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const learn: MindreaderAction = {
  id: "learn", label: "向原导师学习读心者配方", cost: "领域配方成本", enabled: true,
  reason: null, command: { type: "LEARN_FORMULA" },
};
const risk = "领域四档风险原文：失败也消耗所选原瓶。三批全部服用失败后可申请补给，下一个真实周才能领取。";
function mindreader(patch: Partial<MindreaderProjection> = {}): MindreaderProjection {
  return {
    title: "读心者晋升", discovered: true, formulaKnown: false, promoted: false,
    formula: [], actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "观众扮演100；晋升观众后已满6整周。", pollution: 3, risk,
    scenes: [], ...patch,
  };
}
function bottled(): MindreaderProjection {
  return mindreader({
    formulaKnown: true,
    actions: ["mindreader-batch-1:bottle", "mindreader-batch-2:bottle"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "mindreader-batch-1:bottle", title: "第一瓶读心者魔药", source: "劳务所得六料 · 第一批", status: "已调配", chance: 71, command: { type: "CONSUME", bottleId: "mindreader-batch-1:bottle", confirmed: true } },
      { id: "mindreader-batch-2:bottle", title: "第二瓶读心者魔药", source: "自费购入六料 · 第二批", status: "已调配", chance: 43, command: { type: "CONSUME", bottleId: "mindreader-batch-2:bottle", confirmed: true } },
    ],
  });
}
function social(): MindreaderProjection {
  return mindreader({
    title: "读心者 · 序列8", promoted: true, acting: 24, digestion: "开始理解浅层思绪与事实的区别",
    scenes: [
      { id: "receipt", title: "迟疑的收据", story: "店员把一张收据放在柜台上。", observations: ["店员望向门口，手指停在日期处。"], impression: "表层心声：别让老板又把抄错算到我头上。情绪灵光中有焦虑。", dialogue: "", status: "已读心，尚待交谈" },
      { id: "letter", title: "后台来信", story: "剧院门口有人递出一封信。", observations: [], impression: "", dialogue: "", status: "尚未观察" },
    ],
    actions: [
      { id: "ask", label: "询问收据日期", cost: "1行动 · 2灵性", enabled: true, reason: null, command: { type: "DISCUSS", caseId: "receipt", approach: "ASK" } },
      { id: "verify", label: "核对公开账目", cost: "1行动", enabled: true, reason: null, command: { type: "DISCUSS", caseId: "receipt", approach: "VERIFY" } },
      { id: "observe-letter", label: "观察门口的交谈", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "letter" } },
      { id: "read-letter", label: "读取递信者的浅层心声", cost: "1行动 · 2灵性", enabled: false, reason: "先完成普通观察。", command: { type: "READ", caseId: "letter" } },
      { id: "reflect", label: "复盘读心与交谈", cost: "1行动", enabled: false, reason: "还有未处理的公开情境。", command: { type: "REFLECT" } },
    ],
    abilities: [
      { id: "audience.observation", label: "观察", description: "继承的表情与动作观察。", mastery: 35 },
      { id: "audience.shallow-reading", label: "浅层读心", description: "读取当下浅层思想和情绪灵光。", mastery: 15 },
    ],
  });
}
function panel(value: MindreaderProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MindreaderPanel mindreader={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(value = mindreader(), sequence: 8 | 9 | null = 9): SliceProjection {
  const raw = createSliceRun("mindreader-renderer-run", sliceDefaultCreationSelection, "mindreader-renderer-seed");
  raw.week = 12;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null, mindreader: value,
    audience: { ...state.audience, discovered: sequence !== null, formulaKnown: sequence !== null, promoted: sequence !== null, acting: 100, digestion: "观众魔药已消化", actions: [] },
    progression: { pathwayId: sequence === null ? null : "audience", sequence, mastery: {}, acting: sequence === 8 ? 24 : 100, promotionWeek: sequence === null ? null : 5 },
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
async function openMindreader() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "读心者晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Mindreader pathway dossier", () => {
  it("offers ordinary characters only the Audience entry, with no sequence-8 shortcut", async () => {
    const value = bridge(fixture(mindreader(), null));
    await enter(value);
    expect(screen.queryByRole("region", { name: "读心者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: "观众之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "读心者晋升" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect((screen.getByRole("button", { name: /^工作，/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps undiscovered formula, social scenes and unacquired abilities hidden", async () => {
    const value = social();
    const { onCommand } = panel({ ...value, promoted: false, formulaKnown: false, actions: [learn], formula: [{ name: "未学配方", quantity: 1, unit: "份" }] });
    expect(screen.queryByText("未学配方")).toBeNull();
    expect(screen.queryByText(/读心者能力与消化/)).toBeNull();
    expect(screen.queryByText("店员把一张收据放在柜台上。")).toBeNull();
    expect(screen.queryByText(/别让老板又把抄错/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /向原导师学习读心者配方/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEARN_FORMULA" });
  });

  it("shows six formula quantities and forwards exact material, brewing and bounded resupply commands", async () => {
    const actions: MindreaderAction[] = [
      { id: "work", label: "完成第二批材料劳务", cost: "领域劳动成本", enabled: true, reason: null, command: { type: "MATERIAL_WORK", batchId: "mindreader-batch-2" } },
      { id: "buy", label: "购齐第二批六料", cost: "领域材料成本", enabled: true, reason: null, command: { type: "BUY_MATERIALS", batchId: "mindreader-batch-2" } },
      { id: "brew", label: "调配第二批原瓶", cost: "领域制瓶成本", enabled: true, reason: null, command: { type: "BREW", batchId: "mindreader-batch-2" } },
      { id: "request", label: "申请下一轮材料", cost: "1行动", enabled: true, reason: null, command: { type: "REQUEST_SUPPLY" } },
      { id: "receive", label: "领取下一轮材料", cost: "0行动", enabled: false, reason: "须等到下一个真实周。", command: { type: "RECEIVE_SUPPLY" } },
    ];
    const { onCommand } = panel(mindreader({ formulaKnown: true, formula: Array.from({ length: 6 }, (_, index) => ({ name: `测试材料${index + 1}`, quantity: index + 1, unit: "份" })), actions }));
    await userEvent.click(screen.getByText("查看已知配方 · 6 种材料"));
    expect(screen.getByText("测试材料6")).toBeTruthy();
    expect(screen.getByText("6 份")).toBeTruthy();
    expect(screen.getByText(/以上是配方用量/)).toBeTruthy();
    for (const action of actions.slice(0, 4)) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(action.label) }));
      expect(onCommand).toHaveBeenLastCalledWith(action.command);
    }
    const receive = screen.getByRole("button", { name: /领取下一轮材料/ });
    expect((receive as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("须等到下一个真实周。")).toBeTruthy();
    fireEvent.click(receive);
    expect(onCommand).toHaveBeenCalledTimes(4);
    await userEvent.click(screen.getByText("查看服用风险与补给规则"));
    expect(screen.getByText(risk)).toBeTruthy();
  });

  it("cancels freely, restores focus and confirms the exact second bottle only once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶读心者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶读心者魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶读心者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶读心者魔药」/ }));
    expect(screen.getByText("mindreader-batch-2:bottle")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "读心者服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶读心者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "mindreader-batch-2:bottle", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("never transfers confirmation when its original bottle or action disappears", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶读心者魔药」/ }));
    rerender(<MindreaderPanel mindreader={{ ...value, bottles: value.bottles.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶读心者魔药」/ }));
    rerender(<MindreaderPanel mindreader={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("revalidates the same bottle against newly blocked gates without consuming it", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶读心者魔药」/ }));
    rerender(<MindreaderPanel mindreader={{ ...value, actions: value.actions.map((action) => ({ ...action, enabled: false, reason: "当前精神不足，先休养。" })) }} resources={{ ...resources, mind: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("mindreader-batch-2:bottle")).toBeTruthy();
    expect(screen.getByText("当前精神不足，先休养。")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶读心者魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps one selected scene and separates visible observations from actual shallow reading", async () => {
    const { onCommand } = panel(social());
    const scene = screen.getByRole("region", { name: "当前社会情境" });
    expect(within(scene).getByRole("region", { name: "亲眼观察到的线索" }).textContent).toContain("店员望向门口，手指停在日期处。");
    const reading = within(scene).getByRole("region", { name: "读心获得的浅层印象" });
    expect(reading.textContent).toContain("表层心声：别让老板又把抄错算到我头上。");
    expect(reading.textContent).toContain("情绪灵光");
    expect(reading.textContent).toContain("不是完整记忆");
    expect(screen.getByText(/它不会打开深层记忆，也不能操控对方/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "交谈与核实的结果" })).toBeNull();
    expect(screen.queryByRole("button", { name: /观察门口的交谈/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择社会情境" }), "letter");
    expect(screen.queryByText("店员把一张收据放在柜台上。")).toBeNull();
    expect(screen.queryByRole("button", { name: /询问收据日期/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "读心获得的浅层印象" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /观察门口的交谈/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "OBSERVE", caseId: "letter" });
    expect((screen.getByRole("button", { name: /读取递信者的浅层心声/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("先完成普通观察。")).toBeTruthy();
  });

  it("shows final dialogue only from the projected result, without overwriting the reading", () => {
    const value = social();
    const scene = value.scenes[0]!;
    panel({ ...value, scenes: [{ ...scene, status: "已交谈核实", dialogue: "店员自愿说明：日期确实抄错，并出示公开副本。" }], actions: [] });
    expect(screen.getByRole("region", { name: "交谈与核实的结果" }).textContent).toContain("店员自愿说明");
    expect(screen.getByRole("region", { name: "读心获得的浅层印象" }).textContent).toContain(scene.impression);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards projected READ, ASK, VERIFY and REFLECT commands without inventing choices", async () => {
    const value = social();
    const read: MindreaderAction = { id: "read-ready", label: "读取收据店员的表层心声", cost: "领域读取成本", enabled: true, reason: null, command: { type: "READ", caseId: "receipt" } };
    const reflect: MindreaderAction = { id: "reflect-ready", label: "记下读心的边界", cost: "领域复盘成本", enabled: true, reason: null, command: { type: "REFLECT" } };
    const actions = [read, value.actions[0]!, value.actions[1]!, reflect];
    const { onCommand } = panel({ ...value, actions });
    for (const action of actions) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(action.label) }));
      expect(onCommand).toHaveBeenLastCalledWith(action.command);
    }
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /观察门口的交谈|当场指责/ })).toBeNull();
  });

  it("keeps scene selection across updates and falls back if that scene disappears", async () => {
    const value = social();
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择社会情境" }), "letter");
    rerender(<MindreaderPanel mindreader={{ ...value, acting: 40 }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前社会情境" }).textContent).toContain("剧院门口有人递出一封信。");
    rerender(<MindreaderPanel mindreader={{ ...value, scenes: value.scenes.slice(0, 1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前社会情境" }).textContent).toContain("店员把一张收据放在柜台上。");
  });

  it("locks all scene choices and selection while saving or blocked", () => {
    const value = social();
    const onCommand = vi.fn();
    const view = render(<MindreaderPanel mindreader={value} resources={resources} busy={true} blocked={false} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    view.rerender(<MindreaderPanel mindreader={value} resources={resources} busy={false} blocked={true} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /核对公开账目/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("folds acquired abilities and original bottles, preserving mastery and S8 digestion", async () => {
    panel({ ...social(), bottles: bottled().bottles });
    const abilityFold = screen.getByText("读心者能力与消化 · 2 项能力").closest("details");
    expect(abilityFold?.open).toBe(false);
    await userEvent.click(screen.getByText("读心者能力与消化 · 2 项能力"));
    expect(abilityFold?.open).toBe(true);
    const abilities = screen.getByRole("region", { name: "读心者能力与消化" });
    expect(abilities.textContent).toContain("观察 · 掌握 35");
    expect(abilities.textContent).toContain("浅层读心 · 掌握 15");
    expect(abilities.textContent).toContain("扮演进度 24");
    expect(abilities.textContent).toContain("灵性 12 / 40 · 污染 3");
    await userEvent.click(screen.getByText("读心者独立原瓶 · 来源与去向"));
    expect(screen.getByRole("heading", { name: "第一瓶读心者魔药" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("defaults Audience8 to Mindreader and preserves Audience9 history as read-only", async () => {
    const state = fixture(social(), 8);
    state.audience.bottles = [{ id: "old-audience-bottle", title: "最初的观众原瓶", source: "原阅览室渠道", status: "已服用", chance: 70, command: { type: "CONSUME", bottleId: "old-audience-bottle", confirmed: true } }];
    state.audience.actions = [{ id: "stale", label: "不应再执行的观众行动", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }];
    state.audience.scenes = [{ id: "old-scene", title: "先前的社会交往", story: "已核实的旧故事。", observations: ["旧观察。"], interpretation: "旧解释。", status: "已核实" }];
    state.seer.discovered = true;
    state.hunter.discovered = true;
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`读心者 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "读心者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "观众经历" }));
    const history = screen.getByRole("region", { name: "观众时期的经历" });
    expect(history.textContent).toContain("观众扮演进度 100");
    expect(history.textContent).toContain("最初的观众原瓶");
    expect(history.textContent).toContain("已核实的旧故事。");
    expect(within(history).queryByRole("button")).toBeNull();
    for (const [tab, region] of [["占卜家经历", "已了解的占卜家渠道"], ["猎人经历", "已了解的猎人渠道"]] as const) {
      await userEvent.click(screen.getByRole("button", { name: tab }));
      expect(within(screen.getByRole("region", { name: region })).queryByRole("button")).toBeNull();
      expect(screen.queryByRole("region", { name: "当前社会情境" })).toBeNull();
    }
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["diviner", "hunter"] as const)("never offers Mindreader choices on the %s pathway", async (pathwayId) => {
    const state = fixture(social(), 8);
    state.progression = { ...state.progression, pathwayId };
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.queryByRole("button", { name: "读心者晋升" })).toBeNull();
    expect(screen.queryByRole("region", { name: "读心者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "观众经历" }));
    expect(within(screen.getByRole("region", { name: "已了解的观众渠道" })).queryByRole("button")).toBeNull();
  });

  it("submits the chosen social command once and keeps the saved dossier open until manually closed", async () => {
    const state = fixture(social(), 8);
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    value.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    await enter(value);
    await openMindreader();
    const ask = screen.getByRole("button", { name: /询问收据日期/ });
    fireEvent.click(ask);
    fireEvent.click(ask);
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    const envelope = vi.mocked(value.submitIntent).mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "MINDREADER", command: { type: "DISCUSS", caseId: "receipt", approach: "ASK" } });
    await act(async () => { finish(receipt({ ...state, revision: state.revision + 1, mindreader: { ...state.mindreader, acting: 48 } }, envelope)); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    await openMindreader();
    await userEvent.click(screen.getByText("读心者能力与消化 · 2 项能力"));
    expect(screen.getByRole("region", { name: "读心者能力与消化" }).textContent).toContain("扮演进度 48");
  });

  it("retries the exact failed envelope and original bottle, locking tabs and close", async () => {
    const state = fixture(bottled(), 9);
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openMindreader();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶读心者魔药」/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶读心者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "读心者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("读心者模拟保存失败");
    expect((screen.getByRole("button", { name: "确认服用「第二瓶读心者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    for (const name of ["观众之路", "读心者晋升"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "MINDREADER", command: { type: "CONSUME", bottleId: "mindreader-batch-2:bottle", confirmed: true } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
