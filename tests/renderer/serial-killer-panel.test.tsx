/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { SliceProjection } from "../../src/domain/slice/types";
import type { SerialKillerAction, SerialKillerCommand, SerialKillerProjection } from "../../src/domain/serial-killer/types";
import { SerialKillerPanel, SerialKillerUnwingedHistory } from "../../src/renderer/SerialKillerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const consume = (bottleId: string): SerialKillerCommand => ({ type: "CONSUME", bottleId, confirmed: true });
function action(command: SerialKillerCommand, label = `公开操作${command.type}`, enabled = true): SerialKillerAction {
  return { id: JSON.stringify(command), label, cost: "公开成本 · 0行动 · 本次实际成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command };
}
function serialKiller(patch: Partial<SerialKillerProjection> = {}): SerialKillerProjection {
  return {
    title: "连环杀手晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "折翼天使扮演100，已度过8/8个完整序列8周。", pollution: 3,
    risk: "原瓶四档风险：大成功、成功、失败与严重排异；失败仍耗用原瓶，身心与污染变化以实际结果为准。",
    cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): SerialKillerProjection {
  return serialKiller({
    guidanceKnown: true,
    supplies: "罗安保管三瓶独立序列7成品；费用、三次劳动与补给条件见本次公开记录。完整配方待核。",
    actions: [action(consume("serial-killer-potion-1")), action(consume("serial-killer-potion-2"))],
    bottles: [
      { id: "serial-killer-potion-1", title: "第一瓶连环杀手魔药", source: "罗安交接的第一独立序列7原瓶", status: "已交付，尚未服用", chance: 71, command: consume("serial-killer-potion-1") },
      { id: "serial-killer-potion-2", title: "第二瓶连环杀手魔药", source: "罗安交接的第二独立序列7原瓶", status: "已交付，尚未服用", chance: 43, command: consume("serial-killer-potion-2") },
      { id: "serial-killer-potion-3", title: "第三瓶连环杀手魔药", source: "罗安保管的第三独立序列7原瓶", status: "尚未取得 · 劳动0/3", chance: 43, command: consume("serial-killer-potion-3") },
    ],
  });
}
function cases(): SerialKillerProjection["cases"] {
  return ["sealed-index", "empty-circle", "false-dedication"].map((id, index) => ({
    id, title: `知识与仪式实践${index + 1}`, story: `原物与普通对照${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有尚待收束的接触", closures: 0, overclaims: 0,
  }));
}
function openContact(): SerialKillerProjection {
  return serialKiller({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "false-dedication" ? { ...entry, status: "EXAMINED", result: "本次普通方法实际失败，原成本保留。", contactOpen: "本次接触尚未收束" } : entry),
    actions: [action({ type: "CLOSE", caseId: "false-dedication" }, "实际收束原物与本次接触")],
  });
}
function panel(value: SerialKillerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SerialKillerPanel serialKiller={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("serial-killer-renderer-run", sliceDefaultCreationSelection, "serial-killer-renderer-seed");
  raw.week = 24; raw.activeEvent = null; raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    criminal: { ...state.criminal, discovered: sequence !== null, promoted: sequence !== null, acting: sequence === null ? 0 : 100, actions: [] },
    unwinged: { ...state.unwinged, discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7,
      conscienceLost: sequence === 8 || sequence === 7, acting: sequence === 8 || sequence === 7 ? 100 : 0, actions: [] },
    serialKiller: serialKiller({ promoted: sequence === 7, title: sequence === 7 ? "连环杀手 · 序列7" : "连环杀手晋升", actions: sequence === 7 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "abyss", sequence, mastery: {}, acting: sequence === 9 || sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:01:00Z", replayed: false, state } };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openSerialKiller() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  if (!screen.queryByRole("region", { name: "连环杀手成长下一步" })) await userEvent.click(screen.getByRole("button", { name: "连环杀手晋升" }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Serial Killer sequence seven dossier", () => {
  it("keeps seventeen ordinary routes and the original S9 default", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")).toHaveLength(22);
    expect(screen.getByRole("button", { name: "罪犯之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /连环杀手|折翼天使/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
    cleanup();
    const s9 = bridge(fixture(9)); await enter(s9);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "罪犯成长下一步" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /连环杀手/ })).toBeNull();
  });

  it("offers exactly three S8 dossiers and eight-week S7 preparation via tab or guide", async () => {
    const api = bridge(fixture(8)); await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "折翼天使成长下一步" })).toBeTruthy();
    const chooser = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(chooser.getAllByRole("button")).toHaveLength(3);
    expect(chooser.getByRole("button", { name: "罪犯经历" })).toBeTruthy();
    expect(chooser.getByRole("button", { name: "折翼天使成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(chooser.getByRole("button", { name: "连环杀手晋升" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(chooser.getByRole("button", { name: "连环杀手晋升" }));
    expect(screen.getByRole("region", { name: "连环杀手成长下一步" }).textContent).toContain("八个完整周");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "连环杀手成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S7 to its current profile and marks exactly the current tab pressed", async () => {
    const state = fixture(7); state.seer.discovered = true;
    const api = bridge(state); await enter(api);
    expect(screen.getByText(new RegExp(`连环杀手 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看连环杀手成长" }));
    const chooser = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(chooser.getByRole("button", { name: "连环杀手成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(chooser.getAllByRole("button").filter((button) => button.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    expect(chooser.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: "罪犯成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: "折翼天使成长下一步" })).toBeNull();
  });

  it("preserves both original stages and the separate S8 accepted change as read-only history", async () => {
    const state = fixture(7);
    state.criminal.cases = [{ id: "found-pay", title: "原工钱袋", story: "原主人仍为玛拉", observations: ["原封记已经核对"], preparation: "实际取回经过", result: "归还不抹去拿取后果", status: "RESOLVED", holding: "已交回玛拉", tookOriginal: true, returns: 1 }];
    state.criminal.actions = [{ id: "old-s9", label: "不得重做的罪犯行动", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "found-pay" } }];
    state.unwinged.changeWarning = "原序列8单独接受的虚构良知变化说明";
    state.unwinged.cases = [{ id: "cold-grip", title: "原抓握练习", story: "原成人提出停止", observations: ["原铃声与停止信号"], preparation: "实际普通方法准备", result: "已付精神并实际松手", status: "RESOLVED", urgeOpen: "已实际克制", restraints: 2 }];
    state.unwinged.bottles = [{ id: "original-s8", title: "原序列8瓶", source: "原序列8独立交接", status: "已耗用 · 成功", chance: 60, command: { type: "CONSUME", bottleId: "original-s8", confirmed: true, acceptedChange: true } }];
    state.unwinged.abilities = [{ id: "abyss.s8.inhuman-body", label: "原身体能力", mastery: 37, description: "保留原掌握" }];
    state.unwinged.actions = [{ id: "old-s8", label: "不得重做的折翼天使行动", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }];
    const api = bridge(state); await enter(api); await openSerialKiller();
    await userEvent.click(screen.getByRole("button", { name: "罪犯经历" }));
    const s9 = within(screen.getByRole("region", { name: "罪犯时期的经历" }));
    for (const text of ["原主人仍为玛拉", "原封记已经核对", "实际取回经过", "归还不抹去拿取后果"]) expect(s9.getByText(text)).toBeTruthy();
    expect(s9.queryByRole("button")).toBeNull(); expect(s9.getByText(/罪犯扮演进度 100/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "折翼天使经历" }));
    const s8 = within(screen.getByRole("region", { name: "折翼天使时期的经历" }));
    for (const text of ["原序列8单独接受的虚构良知变化说明", "原成人提出停止", "原铃声与停止信号", "实际普通方法准备", "已付精神并实际松手", "来源：原序列8独立交接", "已耗用 · 成功", "原身体能力 · 掌握 37：保留原掌握"]) expect(s8.getByText(text)).toBeTruthy();
    expect(s8.getByText("角色良知状态：已失去原有良知")).toBeTruthy();
    expect(s8.getByText(/实际克制次数：2/)).toBeTruthy(); expect(s8.getByText(/折翼天使扮演进度 100/)).toBeTruthy();
    expect(s8.queryByRole("button")).toBeNull(); expect(s8.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/不得重做的/)).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("renders original history without any command callback", () => {
    render(<SerialKillerUnwingedHistory unwinged={fixture(7).unwinged} />);
    expect(screen.getByText("角色良知状态：已失去原有良知")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows authored supplies and independent originals but never an unverified formula", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "未核材料不得显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy(); expect(screen.queryByText("未核材料不得显示")).toBeNull();
    expect(screen.getByRole("region", { name: "连环杀手成品渠道与配方边界" }).textContent).toContain("本阶段只使用独立成品原瓶，不提供完整配方、材料或调配。每瓶来源、劳动与供应条件以公开记录为准。");
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制造|配方学习/ })).toBeNull();
  });

  it("cancels or escapes without cost, restores focus and confirms only the chosen original once", async () => {
    const value = bottled(); const original = JSON.stringify(value); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶连环杀手魔药" }));
    expect(screen.getByRole("region", { name: "连环杀手服用风险与四档结果" }).textContent).toContain(value.risk);
    expect(screen.getByRole("region", { name: "已发生的虚构角色变化" }).textContent).toContain("已单独接受");
    expect(within(screen.getByRole("region", { name: "这瓶连环杀手魔药的服用确认" })).queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("来源：罗安交接的第一独立序列7原瓶")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    fireEvent.keyDown(screen.getByRole("region", { name: "这瓶连环杀手魔药的服用确认" }), { key: "Escape" });
    expect(onCommand).not.toHaveBeenCalled(); expect(JSON.stringify(value)).toBe(original);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("serial-killer-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶连环杀手魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume("serial-killer-potion-2"));
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "inside"] as const)("invalidates bottle confirmation when the public state becomes %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<SerialKillerPanel serialKiller={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted", insideCase: change === "inside" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶连环杀手魔药的服用确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains failed bottle consumption and S8 conscience history, with updated resources for bottle two", async () => {
    const state = fixture(8, { serialKiller: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      serialKiller: { ...state.serialKiller, bottles: state.serialKiller.bottles.map((bottle) => bottle.id === "serial-killer-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.serialKiller.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openSerialKiller(); await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶连环杀手魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(screen.getByText(new RegExp(`折翼天使 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    expect(failed.unwinged.conscienceLost).toBe(true); expect(failed.unwinged.acting).toBe(100);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "SERIAL_KILLER", command: consume("serial-killer-potion-1") });
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(within(screen.getByRole("region", { name: "这瓶连环杀手魔药的服用确认" })).queryByRole("checkbox")).toBeNull();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" })); expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });

  it("shows only the selected case's current choices and trusts public availability at zero resources", async () => {
    const ritual = action({ type: "PREPARE", caseId: "sealed-index", method: "RITUAL" }, "选择公开有限仪式");
    const ordinary = action({ type: "PREPARE", caseId: "sealed-index", method: "ORDINARY" }, "选择公开普通对照", false);
    const different = action({ type: "OBSERVE", caseId: "empty-circle" }, "观察另一个原物");
    const value = serialKiller({ promoted: true, cases: cases(), actions: [ritual, ordinary, different] });
    const onCommand = vi.fn(); render(<SerialKillerPanel serialKiller={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^选择公开有限仪式/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /^选择公开普通对照/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(ordinary.reason!)).toBeTruthy(); expect(screen.queryByRole("button", { name: /^观察另一个原物/ })).toBeNull();
    expect(within(screen.getByRole("group", { name: "当前情境行动" })).getAllByRole("button")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: /^选择公开有限仪式/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ritual.command);
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
  });

  const retryCommands: SerialKillerCommand[] = [
    consume("serial-killer-potion-2"), { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "serial-killer-potion-3" }, { type: "BUY_POTION", bottleId: "serial-killer-potion-3" },
    { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }, { type: "OBSERVE", caseId: "false-dedication" },
    { type: "PREPARE", caseId: "false-dedication", method: "RITUAL" }, { type: "PREPARE", caseId: "false-dedication", method: "ORDINARY" },
    { type: "PERFORM", caseId: "false-dedication" }, { type: "CLOSE", caseId: "false-dedication" },
    { type: "REPORT", caseId: "false-dedication", claim: "LIMITED" }, { type: "REPORT", caseId: "false-dedication", claim: "CERTAIN" },
    { type: "WITHDRAW", caseId: "false-dedication" }, { type: "REFLECT" },
  ];
  it.each(retryCommands)("retries the identical $type envelope and retains the chosen case after commit", async (command) => {
    const consuming = command.type === "CONSUME";
    const acquiring = ["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(command.type);
    const state = fixture(acquiring ? 8 : 7, { serialKiller: consuming ? bottled() : serialKiller({ promoted: !acquiring,
      cases: acquiring ? [] : cases(), insideCase: command.type === "CLOSE", actions: [action(command, "执行这次公开行动")] }), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const api = bridge(state); let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next: SliceProjection = { ...state, revision: state.revision + 1, serialKiller: { ...state.serialKiller, insideCase: false, actions: [],
      cases: state.serialKiller.cases.map((entry) => entry.id === "false-dedication" ? { ...entry, status: "RESOLVED", result: "已保存的原结果" } : entry) } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    api.submitIntent = submit; await enter(api); await openSerialKiller();
    if ("caseId" in command && command.type !== "CLOSE") await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), command.caseId);
    if (consuming) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = consuming ? "确认服用「第二瓶连环杀手魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "连环杀手模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("连环杀手模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByText("已保存的原结果")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SERIAL_KILLER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "连环杀手成长下一步" })).toBeTruthy();
    if ("caseId" in command) {
      expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe(command.caseId);
      expect(screen.getByText("已保存的原结果")).toBeTruthy();
    }
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads a failed open attempt at zero AP, mind and spirituality and unlocks only after saved CLOSE", async () => {
    const state = fixture(7, { serialKiller: openContact(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, serialKiller: { ...state.serialKiller, insideCase: false, actions: [],
      cases: state.serialKiller.cases.map((entry) => entry.id === "false-dedication" ? { ...entry, contactOpen: "已实际收束", closures: 1 } : entry) } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "收束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "立即收束本次接触" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际收束本次接触");
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("false-dedication");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) expect(button.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    expect(screen.getByText("本次普通方法实际失败，原成本保留。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际收束原物与本次接触/ }));
    expect(screen.getByRole("alert").textContent).toContain("收束尚未保存");
    expect(screen.getByText("本次接触：本次接触尚未收束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "SERIAL_KILLER", command: { type: "CLOSE", caseId: "false-dedication" } });
    expect(screen.getByText("本次接触：已实际收束")).toBeTruthy(); expect(screen.getByText(/实际收束次数：1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(next.health).toBe(state.health); expect(next.mind).toBe(0); expect(next.unwinged.conscienceLost).toBe(true);
  });

  it("does not infer a lock from pending preparation, localized historical contact or old closures", async () => {
    const value = serialKiller({ promoted: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "普通对照待执行", contactOpen: "旧记录曾尚未收束", closures: 1, overclaims: 1 })), actions: [] });
    const api = bridge(fixture(7, { serialKiller: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openSerialKiller(); expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "立即收束本次接触" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["criminal", "unwinged"] as const)("preserves the earlier %s exit before simultaneous S7 contact", async (earlier) => {
    const state = fixture(7, { serialKiller: openContact(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    if (earlier === "criminal") state.criminal = { ...state.criminal, insideCase: true,
      cases: [{ id: "found-pay", title: "原工资袋", story: "原袋尚在手中", observations: [], preparation: null, result: "原拿取后果保留", status: "EXAMINED", holding: "仍在手中", tookOriginal: true, returns: 0 }],
      actions: [{ id: "legacy-return", label: "先实际交还旧原袋", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "found-pay" } }],
    };
    else state.unwinged = { ...state.unwinged, insideCase: true,
      cases: [{ id: "cold-grip", title: "原接触", story: "原伙伴仍要求停止", observations: [], preparation: null, result: "原精神代价保留", status: "EXAMINED", urgeOpen: "仍须实际松手", restraints: 0 }],
      actions: [{ id: "legacy-stand-down", label: "先实际松开原伙伴", cost: "0行动", enabled: true, reason: null, command: { type: "STAND_DOWN", caseId: "cold-grip" } }],
    };
    const afterOldExit: SliceProjection = { ...state, revision: state.revision + 1,
      criminal: { ...state.criminal, insideCase: false, actions: [] }, unwinged: { ...state.unwinged, insideCase: false, actions: [] } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(afterOldExit, envelope));
    await enter(api);
    const button = await screen.findByRole("button", { name: earlier === "criminal" ? /^先实际交还旧原袋/ : /^先实际松开原伙伴/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "连环杀手成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: earlier === "criminal" ? "罪犯时期的经历" : "折翼天使时期的经历" })).toBeNull();
    await userEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual(earlier === "criminal"
      ? { type: "CRIMINAL", command: { type: "RETURN", caseId: "found-pay" } }
      : { type: "UNWINGED", command: { type: "STAND_DOWN", caseId: "cold-grip" } });
    await screen.findByRole("region", { name: "立即收束本次接触" });
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.getByRole("button", { name: /^实际收束原物与本次接触/ })).toBeTruthy();
  });

  it("keeps the newly promoted S7 dossier open and removes stale original-stage controls", async () => {
    const state = fixture(8, { serialKiller: bottled() });
    state.unwinged.actions = [{ id: "old-reflect", label: "旧阶段不可再反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }];
    const next = fixture(7, { revision: state.revision + 1, unwinged: state.unwinged,
      serialKiller: serialKiller({ promoted: true, title: "连环杀手 · 序列7", cases: cases(), actions: [], abilities: [
        { id: "abyss.s7.demonic-lore", label: "有限恶魔知识", mastery: 0, description: "来源仍须核实" },
        { id: "abyss.s7.ritual-practice", label: "有限仪式实践", mastery: 0, description: "每次实际尝试都须收束" },
      ] }),
    });
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api); await openSerialKiller(); await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶连环杀手魔药」" }));
    expect(screen.getByRole("region", { name: "连环杀手成长下一步" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "连环杀手能力与消化" }).textContent).toContain("罪犯与折翼天使时期的原记录、能力掌握和消化继续保留，角色已失去的原有良知不会恢复。这里仅显示恶魔知识与仪式的有限掌握；不提供额外魔类法术、完整真相或保证安全的接触。练习的消化进度不保证这是一条普遍适用的善良消化路线。");
    expect(screen.getByRole("region", { name: "连环杀手成长下一步" }).textContent).toContain("本页展示恶魔知识与仪式的有限实践。本页指导者、成品渠道、三项不伤人的知识／仪式练习、成本与消化解释以当前说明为准，不保证此途径可以无痛善良消化。本阶段不开放序列6的火焰、诅咒、巨大化、魔甲或危险预知。");
    expect(screen.getByRole("region", { name: "连环杀手有限知识与仪式实践" }).textContent).toContain("先观察原物，再选择当前公开的有限仪式或普通对照。准备、实际尝试、收束和有限报告分别提交；准备或报告不能替代实际收束。三项不伤人练习与具体成本以当前说明为准，不保证未知来源可信。");
    for (const marker of ["G练习", "原著确认", "未核魔类法术"]) expect(screen.getByRole("region", { name: "连环杀手能力与消化" }).textContent).not.toContain(marker);
    expect(screen.queryByRole("region", { name: "折翼天使成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用|旧阶段不可再反思/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "折翼天使经历" }));
    expect(screen.getByRole("region", { name: "折翼天使时期的经历" }).textContent).toContain("折翼天使扮演进度 100");
    expect(within(screen.getByRole("region", { name: "折翼天使时期的经历" })).queryByRole("button")).toBeNull();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
});
