/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SAVANT_ABILITY_IDS } from "../../src/domain/savant/types";
import { ARCHAEOLOGIST_ABILITY_IDS } from "../../src/domain/archaeologist/types";
import { APPRAISER_ABILITY_IDS, type AppraiserAction, type AppraiserCommand, type AppraiserProjection } from "../../src/domain/appraiser/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { AppraiserPanel } from "../../src/renderer/AppraiserPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20，可休养重筹。每档都消耗所选原瓶。";
function action(command: AppraiserCommand, enabled = true): AppraiserAction {
  const suffix = "itemId" in command ? command.itemId : "bottleId" in command ? command.bottleId : "";
  return { id: `${command.type}-${suffix}`, label: `公开操作${command.type}${suffix}`, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "本周剩余行动不足。", command };
}
function appraiser(patch: Partial<AppraiserProjection> = {}): AppraiserProjection {
  return {
    title: "鉴定师之路", discovered: true, guidanceKnown: false, formulaKnown: false, promoted: false,
    formula: [], actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "考古学家消化100/100，晋升考古学家后8/8整周。", pollution: 3, risk,
    supplies: "三瓶独立成品药；每瓶可付全款，或完成四次实际劳务后支付余款。",
    items: [], environment: "委托原物仍归原主人，当面检查后原路交还。", ...patch,
  };
}
function bottled(): AppraiserProjection {
  return appraiser({ guidanceKnown: true,
    actions: ["appraiser-potion-1", "appraiser-potion-2"].map((bottleId) => ({ ...action({ type: "CONSUME", bottleId, confirmed: true }), cost: "0行动 · 消耗这一原瓶" })),
    bottles: [
      { id: "appraiser-potion-1", title: "第一瓶鉴定师魔药", source: "实际完成劳务并付余款的原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "appraiser-potion-1", confirmed: true } },
      { id: "appraiser-potion-2", title: "第二瓶鉴定师魔药", source: "新渠道实际供给的第二瓶成品", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "appraiser-potion-2", confirmed: true } },
      { id: "appraiser-potion-3", title: "第三瓶鉴定师魔药", source: "已耗用的第三瓶成品", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "appraiser-potion-3", confirmed: true } },
    ],
  });
}
function items(): AppraiserProjection["items"] {
  return ["echo-brooch", "warm-lamp", "needle-box"].map((id, index) => ({
    id, title: ["回声胸针", "暖灯", "针匣"][index]!, story: `原主人交来的具体物件${index + 1}`,
    observations: [], finding: null, risk: null, status: "等待检查",
  }));
}
function panel(value: AppraiserProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<AppraiserPanel appraiser={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("appraiser-renderer-run", sliceDefaultCreationSelection, "appraiser-renderer-seed");
  raw.week = 24;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  raw.savant.discovered = true;
  raw.savant.guidanceKnown = true;
  raw.progression = {
    pathwayId: "paragon", sequence, acting: sequence === 7 ? 0 : 100, promotionWeek: 5,
    mastery: Object.fromEntries([...SAVANT_ABILITY_IDS, ...(sequence !== 9 ? ARCHAEOLOGIST_ABILITY_IDS : []), ...(sequence === 7 ? APPRAISER_ABILITY_IDS : [])].map((id, index) => [id, index * 2])),
  };
  if (sequence !== 9) {
    raw.archaeologist.guidanceKnown = true;
    raw.archaeologist.promotionWeek = 13;
    raw.archaeologist.savantActingAtPromotion = 100;
  }
  if (sequence === 7) {
    raw.appraiser.guidanceKnown = true;
    raw.appraiser.promotionWeek = 22;
    raw.appraiser.archaeologistActingAtPromotion = 100;
  }
  return { ...projectSliceState(raw), investigateTargets: [], canAct: true, actionBlockedReason: null, ...patch };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state,
      runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week,
        date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-11T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-11T00:01:00Z", replayed: false, state } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Appraiser S7 dossier", () => {
  it("keeps the independent finished-bottle channel without revealing an unverified formula", async () => {
    const { onCommand, rerender } = panel(appraiser({ formula: [{ name: "未核材料", quantity: 1, unit: "份" }] }));
    expect(screen.queryByText("未核材料")).toBeNull();
    expect(screen.getByText("当前渠道只提供成品魔药，不提供完整配方。本阶段使用有限成品药渠道；取得原瓶与确认服用是两个独立步骤。")).toBeTruthy();
    expect(screen.queryByText(/游戏设定（G）/)).toBeNull();
    for (const command of [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "appraiser-potion-1" },
      { type: "BUY_POTION", bottleId: "appraiser-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ] satisfies AppraiserCommand[]) {
      const current = action(command);
      rerender(<AppraiserPanel appraiser={appraiser({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
  });

  it("confirms only the selected original at zero AP, with source, risk, resources and one submission", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "第二瓶鉴定师魔药" })).toBe(document.activeElement);
    expect(screen.getByText("appraiser-potion-2")).toBeTruthy();
    expect(screen.getByText("来源：新渠道实际供给的第二瓶成品")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText(risk)).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 60", "3", "0", resources.cash]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶鉴定师魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "appraiser-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancels freely and restores focus to the same original", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })).toBe(document.activeElement);
  });

  it("rechecks disabled confirmation and discards a disappeared original", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<AppraiserPanel appraiser={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "考古学家尚未消化。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶鉴定师魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("考古学家尚未消化。")).toBeTruthy();
    fireEvent.click(confirm);
    rerender(<AppraiserPanel appraiser={{ ...value, bottles: value.bottles.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects one original and explicitly preserves unknown findings and risks before identification", async () => {
    const list = items();
    const { onCommand } = panel(appraiser({ promoted: true, items: list, actions: list.map((item) => action({ type: "EXAMINE", itemId: item.id })) }));
    expect(screen.getAllByRole("region", { name: "当前鉴定原物" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作EXAMINE/ })).toHaveLength(1);
    expect(screen.getByText("用途尚不明确，等待实际鉴定。")).toBeTruthy();
    expect(screen.getByText("隐患尚未查明，不代表安全。")).toBeTruthy();
    expect(screen.queryByText("原主人交来的具体物件2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择鉴定原物" }), "warm-lamp");
    expect(screen.getByRole("region", { name: "鉴定师成长下一步" }).textContent).toContain("公开操作EXAMINEwarm-lamp");
    await userEvent.click(screen.getByRole("button", { name: /^公开操作EXAMINE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "EXAMINE", itemId: "warm-lamp" });
    expect(screen.getByText("尚未留下可用的检查记录。")).toBeTruthy();
    expect(screen.getByText("用途尚不明确，等待实际鉴定。")).toBeTruthy();
  });

  it("renders only supplied findings and source-specific risks, including failure and recovery limits", async () => {
    const list = items();
    const value = appraiser({ promoted: true, items: list, actions: [] });
    const { onCommand, rerender } = panel(value);
    const identified = { ...list[0]!, observations: ["原表面留有亲见磨痕"], finding: "本次实际鉴定到的有限用途", risk: "本物来源的污染须先交还原物再休养；其他来源不变。", status: "鉴定成功，尚未试用", intrinsicTruth: "隐藏的全部真相" };
    rerender(<AppraiserPanel appraiser={{ ...value, items: [identified, ...list.slice(1)] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("原表面留有亲见磨痕")).toBeTruthy();
    expect(screen.getByText("本次实际鉴定到的有限用途")).toBeTruthy();
    expect(screen.getByText(identified.risk)).toBeTruthy();
    expect(screen.queryByText(identified.intrinsicTruth)).toBeNull();
    rerender(<AppraiserPanel appraiser={{ ...value, items: [{ ...identified, status: "试用失败，原消耗保留，下周再试" }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(within(screen.getByRole("region", { name: "当前鉴定原物" })).getByText("试用失败，原消耗保留，下周再试")).toBeTruthy();
  });

  it("forwards staged identification, cautious test, report and reflection without optimistic changes", async () => {
    const list = items();
    const { onCommand, rerender } = panel(appraiser({ promoted: true, items: list }));
    for (const command of [
      { type: "EXAMINE", itemId: "echo-brooch" }, { type: "IDENTIFY", itemId: "echo-brooch" },
      { type: "TEST", itemId: "echo-brooch" }, { type: "REPORT", itemId: "echo-brooch" }, { type: "REFLECT" },
    ] satisfies AppraiserCommand[]) {
      const current = action(command);
      rerender(<AppraiserPanel appraiser={appraiser({ promoted: true, items: list, actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.getByText("用途尚不明确，等待实际鉴定。")).toBeTruthy();
    }
  });

  it("offers a report without requiring activation of the dangerous original", async () => {
    const list = items().map((item) => ({ ...item, finding: "已鉴定到有限用途", risk: "原物可能产生有来源的污染", status: "鉴定完成" }));
    const value = appraiser({ promoted: true, items: list, actions: [action({ type: "REPORT", itemId: "needle-box" })] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("needle-box");
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REPORT/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", itemId: "needle-box" });
    expect(screen.queryByRole("button", { name: /^公开操作TEST/ })).toBeNull();
    await userEvent.click(screen.getByText("查看鉴定与试用边界"));
    expect(screen.getByText(/不必为了完成委托冒险试用/)).toBeTruthy();
    rerender(<AppraiserPanel appraiser={{ ...value, items: list.map((item) => item.id === "needle-box" ? { ...item, status: "已交付报告，未激活原物" } : item), actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "needle-box");
    expect(within(screen.getByRole("region", { name: "当前鉴定原物" })).getByText("已交付报告，未激活原物")).toBeTruthy();
  });

  it("uses the projected environment and folds the actual inherited and new abilities", async () => {
    const abilities = [{ id: "one", label: "继承知识", mastery: 57, description: "只解释已有记录。" }, { id: "two", label: "有限鉴定", mastery: 31, description: "用途不等于全部真相。" }];
    const value = appraiser({ promoted: true, actions: [], abilities });
    panel(value);
    expect(screen.getByRole("region", { name: "当前鉴定环境" }).textContent).toContain(value.environment);
    const folded = screen.getByLabelText("鉴定师能力与消化") as HTMLDetailsElement;
    expect(folded.open).toBe(false);
    await userEvent.click(screen.getByText("能力与消化 · 2 项能力"));
    for (const ability of abilities) expect(within(folded).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(within(folded).queryByRole("button")).toBeNull();
  });

  it.each(["busy", "blocked"])("disables actual controls when %s", (condition) => {
    const value = appraiser({ promoted: true, items: items(), actions: [action({ type: "REPORT", itemId: "echo-brooch" }), action({ type: "REFLECT" })] });
    const onCommand = vi.fn();
    render(<AppraiserPanel appraiser={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"} onCommand={onCommand} />);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([9, 8, 7] as const)("routes Paragon sequence %s to its current dossier", async (sequence) => {
    const value = bridge(fixture(sequence));
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: sequence === 9 ? "通识者之路" : sequence === 8 ? "考古学家晋升" : "鉴定师成长" }).getAttribute("aria-pressed")).toBe("true");
    if (sequence === 9) expect(screen.queryByRole("button", { name: /鉴定师晋升|鉴定师成长/ })).toBeNull();
    else expect(screen.getByRole("button", { name: sequence === 8 ? "鉴定师晋升" : "鉴定师成长" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /魔术师晋升|纵火家晋升|心理医生晋升/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("opens S7 preparation from the digested Archaeologist goal and labels the promoted resource view", async () => {
    await enter(bridge(fixture(8)));
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "鉴定师成长下一步" })).toBeTruthy();
    cleanup();
    const state = fixture(7);
    await enter(bridge(state));
    expect(screen.getByText(/鉴定师 · 序列7 ·/, { selector: "p.slice-muted" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe(String(state.maxSpirituality));
  });

  it("retains S9 craft and S8 exploration facts and original failures as read-only history", async () => {
    const state = fixture();
    state.savant.projects = [{ id: "old-work", title: "旧灯修复", story: "原工坊经过", plan: "当年学过的工序", status: "DELIVERED", materials: "实际耗用铜片", tool: "已归还原工坊" }];
    state.savant.actions = [{ id: "old-craft", label: "重复制作奖励", cost: "1行动", enabled: true, reason: null, command: { type: "CRAFT", projectId: "old-work" } }];
    state.archaeologist.sites = [{ id: "old-site", title: "旧拱门现场", story: "当年的许可", observations: ["亲见的拱门裂纹"], result: "按原查档实际核实", status: "RESOLVED" }];
    state.archaeologist.actions = [{ id: "old-explore", label: "重复探索奖励", cost: "1行动", enabled: true, reason: null, command: { type: "EXPLORE", siteId: "old-site", approach: "CAREFUL" } }];
    state.archaeologist.bottles = [{ id: "old", title: "原考古学家瓶", source: "原考察队批次", status: "已耗尽 · 严重排异", chance: 61, command: { type: "CONSUME", bottleId: "old", confirmed: true } }];
    const value = bridge(state);
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "通识者经历" }));
    await userEvent.click(screen.getByText("旧灯修复 · 已交付"));
    expect(screen.getByText("当年学过的工序")).toBeTruthy();
    expect(screen.getByText(/实际耗用铜片/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "通识者时期的经历" })).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "考古学家经历" }));
    await userEvent.click(screen.getByText("旧拱门现场 · 探索记录已核实交付"));
    expect(screen.getByText("亲见的拱门裂纹")).toBeTruthy();
    expect(screen.getByText(/按原查档实际核实/)).toBeTruthy();
    await userEvent.click(screen.getByText("考古学家原瓶 · 来源与去向"));
    expect(screen.getByText("来源：原考察队批次")).toBeTruthy();
    expect(screen.getByText("已耗尽 · 严重排异")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "考古学家时期的经历" })).queryByRole("button")).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps the other three S7 pathways on their own current dossiers", async () => {
    for (const pathwayId of ["diviner", "hunter", "audience"] as const) {
      const state = fixture();
      state.progression.pathwayId = pathwayId;
      state.magician = { ...state.magician, promoted: pathwayId === "diviner", discovered: true };
      state.pyromaniac = { ...state.pyromaniac, promoted: pathwayId === "hunter", discovered: true };
      state.psychologist = { ...state.psychologist, promoted: pathwayId === "audience", discovered: true };
      await enter(bridge(state));
      await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
      const name = pathwayId === "diviner" ? "魔术师成长" : pathwayId === "hunter" ? "纵火家成长" : "心理医生成长";
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("region", { name: `${name}下一步` })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /鉴定师晋升|鉴定师成长/ })).toBeNull();
      cleanup();
    }
  });

  it.each(["CONSUME", "IDENTIFY"] as const)("locks and retries the identical failed %s envelope", async (type) => {
    const consume = type === "CONSUME";
    const command: AppraiserCommand = consume ? { type, bottleId: "appraiser-potion-2", confirmed: true } : { type, itemId: "echo-brooch" };
    const state = fixture(consume ? 8 : 7, { appraiser: consume ? bottled() : appraiser({ promoted: true, items: items(), actions: [action(command)] }) });
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    if (consume) {
      await userEvent.click(screen.getByRole("button", { name: "鉴定师晋升" }));
      await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    }
    const buttonName = consume ? "确认服用「第二瓶鉴定师魔药」" : /^公开操作IDENTIFY/;
    const button = screen.getByRole("button", { name: buttonName });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "鉴定师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("鉴定师模拟保存失败");
    expect((screen.getByRole("button", { name: buttonName }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: consume ? "考古学家晋升" : "考古学家经历" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "APPRAISER", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
