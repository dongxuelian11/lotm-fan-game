/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SLEEPLESS_ABILITIES } from "../../src/domain/sleepless/content";
import type { SleeplessAction, SleeplessProjection } from "../../src/domain/sleepless/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SleeplessPanel } from "../../src/renderer/SleeplessPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: SleeplessAction = {
  id: "discover", label: "拜访守夜导师", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
function sleepless(patch: Partial<SleeplessProjection> = {}): SleeplessProjection {
  return {
    title: "不眠者之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    watches: [], environment: "", ...patch,
  };
}
function bottled(): SleeplessProjection {
  return sleepless({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核，只能取得守夜导师三瓶独立成品；供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["sleepless-potion-1", "sleepless-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "sleepless-potion-1", title: "第一瓶不眠者魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "sleepless-potion-1", confirmed: true } },
      { id: "sleepless-potion-2", title: "第二瓶不眠者魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "sleepless-potion-2", confirmed: true } },
      { id: "sleepless-potion-3", title: "第三瓶不眠者魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "sleepless-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: SleeplessProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SleeplessPanel sleepless={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("sleepless-renderer-run", sliceDefaultCreationSelection, "sleepless-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    sleepless: sleepless({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "不眠者 · 序列9" : "不眠者之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? SLEEPLESS_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "darkness" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(SLEEPLESS_ABILITIES.map((ability) => [ability.id, 0])) : {},
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
async function openSleepless() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "不眠者之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function watches(): SleeplessProjection["watches"] {
  return ["quiet-warehouse", "lost-lamplighter", "dark-stair"].map((id, index) => ({
    id, title: `公开守望地点${index + 1}`, story: `现场公开说明${index + 1}`,
    observations: [], result: null, status: "AVAILABLE",
  }));
}
function watchAction(watchId = "quiet-warehouse", approach?: "OBSERVE" | "REPORT", enabled = true): SleeplessAction {
  return {
    id: `${approach ?? "survey"}-${watchId}`, label: approach ? `公开守望${approach}` : "公开勘察现场",
    cost: approach ? "1行动 · 领域公开的守望成本" : "1行动 · 勘察现场",
    enabled, reason: enabled ? null : "本周已尝试，须下周再来。",
    command: approach ? { type: "WATCH", watchId, approach } : { type: "SURVEY", watchId },
  };
}

describe("Sleepless sequence nine dossier", () => {
  it("adds a sixth ordinary choice without joining a church or spending an action to open it", async () => {
    const value = bridge(fixture());
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await openSleepless();
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "不眠者之路" }).textContent).toContain("夜间守望与报告");
    expect(screen.getByRole("region", { name: "不眠者成长下一步" }).textContent).toContain("不会自动加入教会");
    expect(screen.queryByRole("button", { name: /午夜诗人|梦魇/ })).toBeNull();
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
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶不眠者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶不眠者魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶不眠者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶不眠者魔药」/ }));
    expect(screen.getByText("sleepless-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "不眠者服用风险与四档结果" }).textContent).toContain(risk);
    expect(screen.getByText("0行动 · 独立确认 · 消耗这瓶魔药")).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶不眠者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "sleepless-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale confirmation if its original action disappears or the route becomes read-only", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶不眠者魔药」/ }));
    rerender(<SleeplessPanel sleepless={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶不眠者魔药」/ }));
    rerender(<SleeplessPanel sleepless={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains backend timing and acquisition costs instead of inferring permission from cash or AP", () => {
    const value = bottled();
    const reason = "尚未完成四个完整周，第5周起才能服药。";
    const actions = value.actions.map((action) => ({ ...action, enabled: false, reason }));
    actions.push({ id: "buy", label: "取得导师原瓶", cost: "660便士，或实际劳动2/2后60便士", enabled: false, reason: "现金不足", command: { type: "BUY_POTION", bottleId: "sleepless-potion-3" } });
    const { onCommand } = panel({ ...value, actions });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("660便士，或实际劳动2/2后60便士")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^取得导师原瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected watch and only the observations supplied for that place", async () => {
    const list = watches();
    list[1]!.observations = ["真实公开观察：灯杆旁有一只放下的工具包。"];
    const value = sleepless({ promoted: true, watches: list, actions: list.map((watch) => watchAction(watch.id)) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前守望记录" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开勘察现场/ })).toHaveLength(1);
    expect(screen.getByText("尚未取得现场观察。黑暗中的情况仍待核实。")).toBeTruthy();
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择守望地点" }), "lost-lamplighter");
    expect(screen.getByText("现场公开说明2")).toBeTruthy();
    expect(screen.queryByText("现场公开说明1")).toBeNull();
    expect(screen.getByText(list[1]!.observations[0]!)).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^公开勘察现场/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SURVEY", watchId: "lost-lamplighter" });
  });

  it("forwards observe or report choices without inventing a result before committed projection", async () => {
    const list = watches();
    const value = sleepless({ promoted: true, watches: list, actions: [watchAction("quiet-warehouse", "OBSERVE"), watchAction("quiet-warehouse", "REPORT")] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^公开守望OBSERVE/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "WATCH", watchId: "quiet-warehouse", approach: "OBSERVE" });
    expect(screen.queryByRole("region", { name: "实际守望结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开守望REPORT/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "WATCH", watchId: "quiet-warehouse", approach: "REPORT" });
    list[0] = { ...list[0]!, result: "实际记录：报告送达，主人清点货物。", status: "RESOLVED" };
    rerender(<SleeplessPanel sleepless={{ ...value, watches: list, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际守望结果" }).textContent).toContain(list[0]!.result);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps unseen night conditions unknown and invents no action from an unfinished watch", () => {
    panel(sleepless({ promoted: true, watches: watches(), actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知夜间环境" }).textContent).toContain("尚未确认");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/当前夜色最深|已经安全|隐藏危险来源/)).toBeNull();
  });

  it("obeys backend disabled reasons, busy and blocked states without a blanket zero-AP lock", async () => {
    const value = sleepless({ promoted: true, watches: watches(), actions: [watchAction("quiet-warehouse", "OBSERVE", false), { id: "reflect", label: "反思实际守望", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^公开守望OBSERVE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("本周已尝试，须下周再来。").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /^反思实际守望/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<SleeplessPanel sleepless={value} resources={resources} busy blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^反思实际守望/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择守望地点" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<SleeplessPanel sleepless={value} resources={resources} busy={false} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^反思实际守望/ }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("places optional encounter commands inside its one selected fourth watch", async () => {
    const list = [...watches(), { id: "sleepless-watch", title: "夜间货道争端", story: "货主请求先了解发生了什么。", observations: [], result: null, status: "AVAILABLE" }];
    const encounter: SleeplessAction[] = (["OBSERVE_ENCOUNTER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"] as const).map((type) => ({ id: type, label: `现场${type}`, cost: "领域现场成本", enabled: true, reason: null, command: { type } }));
    const { onCommand } = panel(sleepless({ promoted: true, watches: list, actions: [watchAction(), ...encounter] }));
    expect(screen.queryByRole("button", { name: /^现场ENCOUNTER/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择守望地点" }), "sleepless-watch");
    expect(screen.queryByRole("button", { name: /^公开勘察/ })).toBeNull();
    expect(screen.getAllByRole("region", { name: "当前守望记录" })).toHaveLength(1);
    for (const action of encounter) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${action.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(action.command);
    }
    expect(screen.queryByRole("region", { name: "实际守望结果" })).toBeNull();
  });

  it("displays the three public S9 abilities and keeps ordinary rest and action limits clear", () => {
    panel(sleepless({ promoted: true, actions: [], acting: 100, digestion: "实际守望已消化。", environment: "已确认是有路灯的夜间街道。", abilities: SLEEPLESS_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 })) }));
    const ability = screen.getByRole("region", { name: "不眠者能力与消化" });
    expect(ability.textContent).toContain("睡眠需求减少，仍需休息");
    expect(ability.textContent).toContain("每周行动不增加");
    expect(ability.textContent).toContain("没有催眠诗歌或入梦能力");
    for (const [index, entry] of SLEEPLESS_ABILITIES.entries()) expect(within(ability).getByText(`${entry.label} · 掌握 ${index * 7}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "已知夜间环境" }).textContent).toContain("已确认是有路灯的夜间街道。");
    expect(screen.getByRole("region", { name: "不眠者成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens darkness growth by default and retains previously learned other channels as history", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "先前已知的占卜家材料", quantity: 1, unit: "份" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`不眠者 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("不眠者 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "不眠者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("先前已知的占卜家材料");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("makes stale Sleepless channels read-only after selecting another route and shows the backend reason", async () => {
    const value = bottled();
    value.actions[0] = { ...value.actions[0]!, enabled: false, reason: "已踏入占卜家途径，不可改换为不眠者。" };
    const state = fixture(false, { sleepless: value, progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } });
    const api = bridge(state);
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "不眠者经历" }));
    expect(screen.getByText("已选择其它途径，这份不眠者渠道只供回看。")).toBeTruthy();
    expect(screen.getByText("已踏入占卜家途径，不可改换为不眠者。")).toBeTruthy();
    for (const button of screen.getAllByRole("button", { name: /查看并准备服用/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"],
  ] as const)("keeps the existing %s S7 route as the default rather than the sixth channel", async (pathwayId, heading) => {
    const state = fixture(false, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    state.sleepless.discovered = true;
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "不眠者成长下一步" })).toBeNull();
  });

  it.each(["CONSUME", "WATCH"] as const)("locks and retries the same failed %s envelope without a duplicate action", async (type) => {
    const watching = type === "WATCH";
    const state = fixture(watching, { sleepless: watching ? sleepless({ promoted: true, watches: watches(), actions: [watchAction("quiet-warehouse", "REPORT")] }) : bottled(), actionsRemaining: watching ? 1 : 0, canAct: watching });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openSleepless();
    if (!watching) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶不眠者魔药」/ }));
    const confirm = screen.getByRole("button", { name: watching ? /^公开守望REPORT/ : "确认服用「第二瓶不眠者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "不眠者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("不眠者模拟保存失败");
    expect((screen.getByRole("button", { name: watching ? /^公开守望REPORT/ : "确认服用「第二瓶不眠者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SLEEPLESS", command: watching ? { type: "WATCH", watchId: "quiet-warehouse", approach: "REPORT" } : { type: "CONSUME", bottleId: "sleepless-potion-2", confirmed: true } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
