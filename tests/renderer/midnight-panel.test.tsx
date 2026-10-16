/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { MidnightAction, MidnightCommand, MidnightProjection } from "../../src/domain/midnight/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { MidnightPanel, SleeplessHistory } from "../../src/renderer/MidnightPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
const caseIds = ["sleepless-patient", "nervous-courier", "noisy-lodging"] as const;
function action(command: MidnightCommand, enabled = true): MidnightAction {
  const target = "caseId" in command ? command.caseId : "bottleId" in command ? command.bottleId : "";
  const suffix = command.type === "PERFORM" ? command.method : "";
  return {
    id: `${command.type}-${target}-${suffix}`, label: `公开操作${command.type}${target}${suffix}`,
    cost: `领域成本${command.type}`, enabled, reason: enabled ? null : "领域原因：本周已尝试，请下周再来。", command,
  };
}
function cases(): MidnightProjection["cases"] {
  return caseIds.map((id, index) => ({
    id, title: `夜间情境${index + 1}`, story: `成年当事人的公开说明${index + 1}`,
    observations: [], result: null, status: "AVAILABLE",
  }));
}
function midnight(patch: Partial<MidnightProjection> = {}): MidnightProjection {
  return {
    title: "午夜诗人之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立成品，每瓶1210便士或实际劳动3次加160便士。完整配方待核。",
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "不眠者消化100/100，成熟时间6/6整周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): MidnightProjection {
  return midnight({ guidanceKnown: true,
    actions: ["midnight-potion-1", "midnight-potion-2"].map((bottleId) => ({
      ...action({ type: "CONSUME", bottleId, confirmed: true }), cost: "0行动 · 独立确认 · 消耗这瓶魔药",
    })),
    bottles: [
      { id: "midnight-potion-1", title: "第一瓶午夜诗人魔药", source: "夜间导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "midnight-potion-1", confirmed: true } },
      { id: "midnight-potion-2", title: "第二瓶午夜诗人魔药", source: "三次真实劳务及余款换得的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "midnight-potion-2", confirmed: true } },
      { id: "midnight-potion-3", title: "第三瓶午夜诗人魔药", source: "已耗用的第三原瓶", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "midnight-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: MidnightProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MidnightPanel midnight={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | null = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("midnight-renderer-run", sliceDefaultCreationSelection, "midnight-renderer-seed");
  raw.week = 14;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, investigateTargets: [], canAct: true, actionBlockedReason: null,
    sleepless: { ...state.sleepless, discovered: sequence !== null, promoted: sequence !== null },
    midnight: midnight({ title: sequence === 8 ? "午夜诗人 · 序列8" : "午夜诗人之路", promoted: sequence === 8, actions: sequence === 8 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "darkness", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
    ...patch,
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
async function openMidnight() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "午夜诗人晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Midnight Poet sequence eight dossier", () => {
  it("keeps the six ordinary routes and lets the growth drawer close without a seventh choice", async () => {
    const value = bridge(fixture(null));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路"]) {
      expect(within(tabs).getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /午夜诗人/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("adds Midnight preparation after Sleepless and routes the advancement guide to it", async () => {
    const value = bridge(fixture(9));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "不眠者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "午夜诗人晋升" }));
    expect(screen.getByRole("region", { name: "午夜诗人成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "午夜诗人成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("forwards each acquisition action with backend cost and reason, without fabricating a recipe", async () => {
    const { onCommand, rerender } = panel(midnight({ formula: [{ name: "未核配方不得显示", quantity: 9, unit: "份" }] }));
    expect(screen.queryByText("未核配方不得显示")).toBeNull();
    expect(screen.getByText("这是有限成品药渠道，当前渠道只提供成品魔药，不提供完整配方；取得渠道或晋升不会自动加入教会。")).toBeTruthy();
    expect(screen.getByText(/每瓶1210便士或实际劳动3次加160便士/)).toBeTruthy();
    const commands: MidnightCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "midnight-potion-1" },
      { type: "BUY_POTION", bottleId: "midnight-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    for (const command of commands) {
      const current = { ...action(command), cost: command.type === "LEARN_GUIDANCE" ? "1行动 · 180便士" : `原领域成本${command.type}` };
      rerender(<MidnightPanel midnight={midnight({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      expect(screen.getByText(current.cost)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
    const unavailable = action({ type: "BUY_POTION", bottleId: "midnight-potion-2" }, false);
    rerender(<MidnightPanel midnight={midnight({ actions: [unavailable] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getAllByText(unavailable.reason!, { exact: false }).length).toBeGreaterThan(0);
    const disabled = screen.getByRole("button", { name: new RegExp(`^${unavailable.label}`) });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabled);
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("independently confirms the selected original bottle, cancels for free and guards repeat submission", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶午夜诗人魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶午夜诗人魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶午夜诗人魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶午夜诗人魔药」/ }));
    for (const text of ["midnight-potion-2", "43%", "来源：三次真实劳务及余款换得的第二原瓶", "0行动 · 独立确认 · 消耗这瓶魔药"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "午夜诗人服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "3", "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶午夜诗人魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "midnight-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale confirmation when its bottle action disappears or promotion is committed", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<MidnightPanel midnight={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<MidnightPanel midnight={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only one of three cases and never invents observations or outcomes", async () => {
    const list = cases();
    list[1]!.observations = ["当事人已说明紧张的原因，旁人仍在场。"];
    const { onCommand } = panel(midnight({ promoted: true, cases: list, actions: list.map((scene) => action({ type: "OBSERVE", caseId: scene.id })) }));
    expect(screen.getAllByRole("region", { name: "当前夜间情境" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    for (const [index, scene] of list.entries()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择夜间情境" }), scene.id);
      expect(screen.getByText(`成年当事人的公开说明${index + 1}`)).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(caseIds)("forwards observe, preparation, both methods and withdrawal for %s", async (caseId) => {
    const list = cases();
    const commands: MidnightCommand[] = [
      { type: "OBSERVE", caseId }, { type: "PREPARE", caseId },
      { type: "PERFORM", caseId, method: "POEM" }, { type: "PERFORM", caseId, method: "TALK" }, { type: "WITHDRAW", caseId },
    ];
    const value = midnight({ promoted: true, cases: list, actions: commands.map((command) => action(command)) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择夜间情境" }), caseId);
    for (const command of commands) {
      const current = action(command);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    }
    const observed = list.map((scene) => scene.id === caseId ? { ...scene, status: "PREPARED", observations: ["成年当事人已同意，旁人已离开。"] } : scene);
    rerender(<MidnightPanel midnight={{ ...value, cases: observed }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("成年当事人已同意，旁人已离开。")).toBeTruthy();
    expect(screen.getByText("实践状态：准备已完成")).toBeTruthy();
    const finished = observed.map((scene) => scene.id === caseId ? { ...scene, status: "RESOLVED", result: "实际结算：短暂平静，未改写本人意志。" } : scene);
    rerender(<MidnightPanel midnight={{ ...value, cases: finished, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain("实际结算：短暂平静，未改写本人意志。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["OBSERVED", "PREPARED"])("defaults to the active %s case and allows backend-approved zero-AP withdrawal at incapacity", async (status) => {
    const list = cases();
    list[1]!.status = status;
    const withdraw = { ...action({ type: "WITHDRAW", caseId: "nervous-courier" }), cost: "0行动 · 停止本次实践" };
    const value = midnight({ promoted: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "sleepless-patient" }), withdraw] });
    const onCommand = vi.fn();
    render(<MidnightPanel midnight={value} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择夜间情境" }) as HTMLSelectElement).value).toBe("nervous-courier");
    expect(screen.getByText(withdraw.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作WITHDRAW/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
  });

  it("obeys backend disabled reasons, save locks and blocking errors without inferring permission from AP", () => {
    const list = cases();
    list[0]!.status = "OBSERVED";
    const value = midnight({ promoted: true, cases: list, actions: [action({ type: "PREPARE", caseId: "sleepless-patient" }, false), action({ type: "WITHDRAW", caseId: "sleepless-patient" })] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^公开操作PREPARE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("领域原因：本周已尝试，请下周再来。").length).toBeGreaterThan(0);
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<MidnightPanel midnight={value} resources={resources} {...lock} onCommand={onCommand} />);
      const withdraw = screen.getByRole("button", { name: /^公开操作WITHDRAW/ });
      expect((withdraw as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("combobox", { name: "选择夜间情境" }) as HTMLSelectElement).disabled).toBe(true);
      fireEvent.click(withdraw);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps optional dispute actions in the selected fourth case and forwards clearing bystanders", async () => {
    const list = [...cases(), { id: "midnight-dispute", title: "夜间争端", story: "委托人请求先了解现场。", observations: [], result: null, status: "AVAILABLE" }];
    const encounter = (["OBSERVE_ENCOUNTER", "CLEAR_BYSTANDER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"] as const).map((type) => action({ type }));
    const { onCommand } = panel(midnight({ promoted: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "sleepless-patient" }), ...encounter] }));
    expect(screen.queryByRole("button", { name: /^公开操作CLEAR_BYSTANDER/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择夜间情境" }), "midnight-dispute");
    expect(screen.queryByRole("button", { name: /^公开操作OBSERVEsleepless-patient/ })).toBeNull();
    expect(screen.getAllByRole("region", { name: "当前夜间情境" })).toHaveLength(1);
    for (const current of encounter) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(current.command);
    }
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
  });

  it("shows public ability limits, unknown environment and completed digestion without invented actions", () => {
    panel(midnight({ promoted: true, cases: cases(), actions: [], acting: 100, abilities: [{ id: "public-poem", label: "已掌握的诗歌", mastery: 17, description: "实际公开能力说明" }] }));
    const ability = screen.getByRole("region", { name: "午夜诗人能力与消化" });
    for (const text of ["有声吟诵", "平静或困意", "被抵抗", "附近同伴", "不能控制意志、读取思想或进入梦境"]) expect(ability.textContent).toContain(text);
    expect(within(ability).getByText("已掌握的诗歌 · 掌握 17")).toBeTruthy();
    expect(screen.getByRole("region", { name: "已知夜间环境" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "午夜诗人成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards reflection only when supplied and enabled by the backend", async () => {
    const reflection = action({ type: "REFLECT" });
    const value = midnight({ promoted: true, cases: cases(), actions: [reflection] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REFLECT/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<MidnightPanel midnight={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /^公开操作REFLECT/ })).toBeNull();
  });

  it("opens darkness eight by default and retains the old Sleepless dossier read-only", async () => {
    const state = fixture();
    state.sleepless.watches = [{ id: "quiet-warehouse", title: "旧夜班原记录", story: "旧夜班未改写", observations: ["原观察保留"], result: "原报告保留", status: "RESOLVED" }];
    state.sleepless.bottles = [{ id: "sleepless-original", title: "旧不眠者原瓶", source: "原渠道保留", status: "已耗用", chance: 50, command: { type: "CONSUME", bottleId: "sleepless-original", confirmed: true } }];
    state.sleepless.abilities = [{ id: "old-vision", label: "原夜视", mastery: 23, description: "原能力说明" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`午夜诗人 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "午夜诗人成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "不眠者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "不眠者经历" }));
    const history = screen.getByRole("region", { name: "不眠者时期的经历" });
    for (const text of ["旧夜班未改写", "原观察保留", "原报告保留", "原渠道保留", "原夜视", "23"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "午夜诗人成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("never renders stale Sleepless action commands in prior-sequence history", () => {
    const state = fixture();
    state.sleepless.actions = [{ id: "old-consume", label: "不可重服原瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old-original", confirmed: true } }];
    render(<SleeplessHistory sleepless={state.sleepless} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重服原瓶")).toBeNull();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"],
  ] as const)("preserves the %s S7 default and does not expose Midnight", async (pathwayId, heading) => {
    const state = fixture(8, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "午夜诗人成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /午夜诗人成长|午夜诗人晋升/ })).toBeNull();
  });

  it.each(["CONSUME", "PREPARE", "PERFORM", "WITHDRAW"] as const)("retries the identical failed %s envelope without a duplicate action", async (type) => {
    const consuming = type === "CONSUME";
    const cmd: MidnightCommand = consuming ? { type: "CONSUME", bottleId: "midnight-potion-2", confirmed: true }
      : type === "PERFORM" ? { type, caseId: "sleepless-patient", method: "POEM" } : { type, caseId: "sleepless-patient" };
    const list = cases();
    list[0]!.status = type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(consuming ? 9 : 8, {
      midnight: consuming ? bottled() : midnight({ promoted: true, cases: list, actions: [action(cmd)] }),
      actionsRemaining: 0, canAct: false, health: type === "WITHDRAW" ? 0 : 76,
      mind: type === "WITHDRAW" ? 0 : 88, actionBlockedReason: "领域当前不可进行主要行动。",
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openMidnight();
    if (consuming) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶午夜诗人魔药」/ }));
    const name = consuming ? "确认服用「第二瓶午夜诗人魔药」" : new RegExp(`^${action(cmd).label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "午夜诗人模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("午夜诗人模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "MIDNIGHT", command: cmd });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
