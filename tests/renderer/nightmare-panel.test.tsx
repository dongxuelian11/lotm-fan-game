/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { NightmareAction, NightmareCommand, NightmareProjection } from "../../src/domain/nightmare/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { MidnightHistory, NightmarePanel, NightmareSleeplessHistory } from "../../src/renderer/NightmarePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
const caseIds = ["letter-at-window", "workshop-footsteps", "old-journey"] as const;
function action(command: NightmareCommand, enabled = true): NightmareAction {
  const target = "caseId" in command ? command.caseId : "bottleId" in command ? command.bottleId : "";
  return {
    id: `${command.type}-${target}`, label: `公开操作${command.type}${target}`,
    cost: `领域成本${command.type}`, enabled, reason: enabled ? null : "领域原因：本周已尝试，请下周再来。", command,
  };
}
function cases(): NightmareProjection["cases"] {
  return caseIds.map((id, index) => ({
    id, title: `入梦情境${index + 1}`, story: `成年当事人自愿协助的公开说明${index + 1}`,
    observations: [], dreamRecord: null, result: null, status: "AVAILABLE",
  }));
}
function nightmare(patch: Partial<NightmareProjection> = {}): NightmareProjection {
  return {
    title: "梦魇之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立成品，每瓶2010便士或实际劳动4次加210便士。完整配方待核。",
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "午夜诗人消化100/100，晋升午夜诗人后8/8整周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): NightmareProjection {
  return nightmare({ guidanceKnown: true,
    actions: ["nightmare-potion-1", "nightmare-potion-2"].map((bottleId) => ({
      ...action({ type: "CONSUME", bottleId, confirmed: true }), cost: "0行动 · 独立确认 · 消耗这瓶魔药",
    })),
    bottles: [
      { id: "nightmare-potion-1", title: "第一瓶梦魇魔药", source: "夜间导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "nightmare-potion-1", confirmed: true } },
      { id: "nightmare-potion-2", title: "第二瓶梦魇魔药", source: "四次真实劳务及余款换得的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "nightmare-potion-2", confirmed: true } },
      { id: "nightmare-potion-3", title: "第三瓶梦魇魔药", source: "已耗用的第三原瓶", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "nightmare-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: NightmareProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<NightmarePanel nightmare={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 | null = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("nightmare-renderer-run", sliceDefaultCreationSelection, "nightmare-renderer-seed");
  raw.week = 24;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, investigateTargets: [], canAct: true, actionBlockedReason: null,
    sleepless: { ...state.sleepless, discovered: sequence !== null, promoted: sequence !== null },
    midnight: { ...state.midnight, title: "午夜诗人 · 序列8", promoted: sequence === 8 || sequence === 7 },
    nightmare: nightmare({ title: sequence === 7 ? "梦魇 · 序列7" : "梦魇之路", promoted: sequence === 7, actions: sequence === 7 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "darkness", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
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
async function openNightmare() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "梦魇晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Nightmare sequence seven dossier", () => {
  it("keeps the eight ordinary routes and lets the growth drawer close", async () => {
    const value = bridge(fixture(null));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路"]) {
      expect(within(tabs).getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /梦魇/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("adds Nightmare preparation after Midnight and routes the advancement guide to it", async () => {
    const value = bridge(fixture(8));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "午夜诗人成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "梦魇晋升" }));
    expect(screen.getByRole("region", { name: "梦魇成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "梦魇成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("forwards each acquisition action with backend cost and reason, without fabricating a recipe", async () => {
    const { onCommand, rerender } = panel(nightmare({ formula: [{ name: "未核配方不得显示", quantity: 9, unit: "份" }] }));
    expect(screen.queryByText("未核配方不得显示")).toBeNull();
    expect(screen.getByText("这是有限成品药渠道，当前渠道只提供成品魔药，不提供完整配方；取得渠道或晋升不会自动加入教会。")).toBeTruthy();
    expect(screen.getByText(/每瓶2010便士或实际劳动4次加210便士/)).toBeTruthy();
    const commands: NightmareCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "nightmare-potion-1" },
      { type: "BUY_POTION", bottleId: "nightmare-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    for (const command of commands) {
      const current = { ...action(command), cost: command.type === "LEARN_GUIDANCE" ? "1行动 · 240便士" : `原领域成本${command.type}` };
      rerender(<NightmarePanel nightmare={nightmare({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      expect(screen.getByText(current.cost)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
    const unavailable = action({ type: "BUY_POTION", bottleId: "nightmare-potion-2" }, false);
    rerender(<NightmarePanel nightmare={nightmare({ actions: [unavailable] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
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
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶梦魇魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶梦魇魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶梦魇魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶梦魇魔药」/ }));
    for (const text of ["nightmare-potion-2", "43%", "来源：四次真实劳务及余款换得的第二原瓶", "0行动 · 独立确认 · 消耗这瓶魔药"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "梦魇服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 60", resources.cash, "3", "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶梦魇魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "nightmare-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("rechecks current bottle restrictions while the independent confirmation is open", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<NightmarePanel nightmare={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "午夜诗人尚未消化，且不足八个完整周。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶梦魇魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("午夜诗人尚未消化，且不足八个完整周。")).toBeTruthy();
    fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(screen.queryByRole("region", { name: "这瓶梦魇魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("drops stale confirmation when its bottle action disappears or promotion is committed", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<NightmarePanel nightmare={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<NightmarePanel nightmare={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only one of three cases and never invents observations or outcomes", async () => {
    const list = cases();
    list[1]!.observations = ["当事人已说明紧张的原因，旁人仍在场。"];
    const { onCommand } = panel(nightmare({ promoted: true, cases: list, actions: list.map((scene) => action({ type: "OBSERVE", caseId: scene.id })) }));
    expect(screen.getAllByRole("region", { name: "当前入梦情境" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    for (const [index, scene] of list.entries()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择入梦情境" }), scene.id);
      expect(screen.getByText(`成年当事人自愿协助的公开说明${index + 1}`)).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(caseIds)("forwards observe, preparation, complete session, awake verification and withdrawal for %s", async (caseId) => {
    const list = cases();
    const commands: NightmareCommand[] = [
      { type: "OBSERVE", caseId }, { type: "PREPARE", caseId },
      { type: "SESSION", caseId }, { type: "VERIFY", caseId }, { type: "WITHDRAW", caseId },
    ];
    const value = nightmare({ promoted: true, cases: list, actions: commands.map((command) => action(command)) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择入梦情境" }), caseId);
    for (const command of commands) {
      const current = action(command);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    }
    const observed = list.map((scene) => scene.id === caseId ? { ...scene, status: "PREPARED", observations: ["成年当事人已同意并入睡，普通守护人已就位。"] } : scene);
    rerender(<NightmarePanel nightmare={{ ...value, cases: observed }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("成年当事人已同意并入睡，普通守护人已就位。")).toBeTruthy();
    expect(screen.getByText("实践状态：准备已完成")).toBeTruthy();
    const finished = observed.map((scene) => scene.id === caseId ? { ...scene, status: "RESOLVED", result: "实际清醒核实：窗边原信封仍在，梦中说法未获全部证实。" } : scene);
    rerender(<NightmarePanel nightmare={{ ...value, cases: finished, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain("实际清醒核实：窗边原信封仍在，梦中说法未获全部证实。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps one complete dream session separate from later awake verification and never turns a report into proof", async () => {
    const list = cases();
    list[0]!.status = "PREPARED";
    list[0]!.observations = ["成年本人同意，已经自愿入睡；普通守护人留守身体。"];
    const session = action({ type: "SESSION", caseId: "letter-at-window" });
    const value = nightmare({ promoted: true, cases: list, actions: [session] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "梦魇实践记录" }).textContent).toContain("进入、查看与退出");
    expect(screen.getByRole("region", { name: "梦魇实践记录" }).textContent).toContain("本体全程留在原处不能移动");
    expect(screen.queryByRole("region", { name: "梦境经历记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${session.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(session.command);
    expect(screen.queryByRole("region", { name: "梦境经历记录" })).toBeNull();
    expect(screen.getByText("实践状态：准备已完成")).toBeTruthy();

    const report = "本人梦见窗前的来信被移动；这是本次入梦报告。";
    const recorded = list.map((scene) => scene.id === "letter-at-window" ? { ...scene, status: "DREAM_RECORDED", dreamRecord: report } : scene);
    const verify = action({ type: "VERIFY", caseId: "letter-at-window" });
    rerender(<NightmarePanel nightmare={{ ...value, cases: recorded, actions: [verify] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const dream = screen.getByRole("region", { name: "梦境经历记录" });
    expect(within(dream).getByRole("heading", { name: "梦境经历记录 · 待清醒核实" })).toBeTruthy();
    expect(dream.textContent).toContain(report);
    expect(dream.textContent).toContain("不能直接作为事实或证词");
    expect(screen.getByText("实践状态：已退出梦境，等待清醒核实")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^公开操作SESSION/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${verify.label}`) }));
    expect(onCommand).toHaveBeenLastCalledWith(verify.command);
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();

    const result = "清醒核实：来信仍在原处，梦中的移动未获证实。";
    const resolved = recorded.map((scene) => scene.id === "letter-at-window" ? { ...scene, status: "RESOLVED", result } : scene);
    rerender(<NightmarePanel nightmare={{ ...value, cases: resolved, actions: [], acting: 30 }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain(result);
    expect(screen.getByRole("region", { name: "梦境经历记录" }).textContent).toContain(report);
    expect(screen.getByRole("heading", { name: "梦境经历记录 · 已另行清醒核实" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "梦境经历记录" }).textContent).toContain("可能失真");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("retains a withdrawn dream record without describing it as verified", () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "WITHDRAWN", dreamRecord: "退出前报告的模糊经历", result: "本次核实已停止，没有确认额外事实。" };
    panel(nightmare({ promoted: true, cases: list, actions: [] }));
    expect(screen.getByRole("heading", { name: "梦境经历记录 · 未完成清醒核实" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "梦境经历记录" }).textContent).toContain("退出前报告的模糊经历");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["OBSERVED", "PREPARED", "DREAM_RECORDED"])("defaults to the active %s case and allows backend-approved zero-AP withdrawal at incapacity", async (status) => {
    const list = cases();
    list[1]!.status = status;
    const withdraw = { ...action({ type: "WITHDRAW", caseId: "workshop-footsteps" }), cost: "0行动 · 停止本次实践" };
    const value = nightmare({ promoted: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "letter-at-window" }), withdraw] });
    const onCommand = vi.fn();
    render(<NightmarePanel nightmare={value} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择入梦情境" }) as HTMLSelectElement).value).toBe("workshop-footsteps");
    expect(screen.getByText(withdraw.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作WITHDRAW/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
  });

  it("obeys backend disabled reasons, save locks and blocking errors without inferring permission from AP", () => {
    const list = cases();
    list[0]!.status = "OBSERVED";
    const value = nightmare({ promoted: true, cases: list, actions: [action({ type: "PREPARE", caseId: "letter-at-window" }, false), action({ type: "WITHDRAW", caseId: "letter-at-window" })] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^公开操作PREPARE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("领域原因：本周已尝试，请下周再来。").length).toBeGreaterThan(0);
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<NightmarePanel nightmare={value} resources={resources} {...lock} onCommand={onCommand} />);
      const withdraw = screen.getByRole("button", { name: /^公开操作WITHDRAW/ });
      expect((withdraw as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("combobox", { name: "选择入梦情境" }) as HTMLSelectElement).disabled).toBe(true);
      fireEvent.click(withdraw);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps optional dispute actions in the selected fourth case and forwards clearing bystanders", async () => {
    const list = [...cases(), { id: "nightmare-dispute", title: "夜间争端", story: "委托人请求先了解现场。", observations: [], dreamRecord: null, result: null, status: "AVAILABLE" }];
    const encounter = (["OBSERVE_ENCOUNTER", "CLEAR_BYSTANDER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"] as const).map((type) => action({ type }));
    const { onCommand } = panel(nightmare({ promoted: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "letter-at-window" }), ...encounter] }));
    expect(screen.queryByRole("button", { name: /^公开操作CLEAR_BYSTANDER/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择入梦情境" }), "nightmare-dispute");
    expect(screen.queryByRole("button", { name: /^公开操作OBSERVEletter-at-window/ })).toBeNull();
    expect(screen.getAllByRole("region", { name: "当前入梦情境" })).toHaveLength(1);
    for (const current of encounter) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(current.command);
    }
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
  });

  it("shows public ability limits, unknown environment and completed digestion without invented actions", () => {
    panel(nightmare({ promoted: true, cases: cases(), actions: [], acting: 100, abilities: [{ id: "public-dream", label: "已掌握的入梦", mastery: 17, description: "实际公开能力说明" }] }));
    const ability = screen.getByRole("region", { name: "梦魇能力与消化" });
    for (const text of ["可能失真", "不会自动揭示秘密", "反复准备", "本体不能移动", "不能同时发动身体动作"]) expect(ability.textContent).toContain(text);
    expect(within(ability).getByText("已掌握的入梦 · 掌握 17")).toBeTruthy();
    expect(screen.getByRole("region", { name: "已知入梦环境" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "梦魇成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards reflection only when supplied and enabled by the backend", async () => {
    const reflection = action({ type: "REFLECT" });
    const value = nightmare({ promoted: true, cases: cases(), actions: [reflection] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REFLECT/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<NightmarePanel nightmare={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /^公开操作REFLECT/ })).toBeNull();
  });

  it("opens darkness seven by default and retains both older dossiers read-only", async () => {
    const state = fixture();
    state.sleepless.watches = [{ id: "quiet-warehouse", title: "旧夜班原记录", story: "旧夜班未改写", observations: ["原观察保留"], result: "原报告保留", status: "RESOLVED" }];
    state.sleepless.bottles = [{ id: "sleepless-original", title: "旧不眠者原瓶", source: "原渠道保留", status: "已耗用", chance: 50, command: { type: "CONSUME", bottleId: "sleepless-original", confirmed: true } }];
    state.sleepless.abilities = [{ id: "old-vision", label: "原夜视", mastery: 23, description: "原能力说明" }];
    state.midnight.cases = [{ id: "old-midnight-case", title: "原诗歌实践", story: "原诗歌实践未改写", observations: ["原同意记录保留"], result: "原处理结果保留", status: "RESOLVED" }];
    state.midnight.bottles = [{ id: "midnight-original", title: "旧午夜诗人原瓶", source: "原S8渠道保留", status: "已耗用", chance: 50, command: { type: "CONSUME", bottleId: "midnight-original", confirmed: true } }];
    state.midnight.abilities = [{ id: "old-poem", label: "原诗歌能力", mastery: 31, description: "原S8能力说明" }];
    state.midnight.actions = [{ id: "old-s8-command", label: "不可重复旧实践", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "old-midnight-case" } }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`梦魇 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "梦魇成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "不眠者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "不眠者经历" }));
    const history = screen.getByRole("region", { name: "不眠者时期的经历" });
    for (const text of ["旧夜班未改写", "原观察保留", "原报告保留", "原渠道保留", "原夜视", "23"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "午夜诗人经历" }));
    const midnightHistory = screen.getByRole("region", { name: "午夜诗人时期的经历" });
    for (const text of ["原诗歌实践未改写", "原同意记录保留", "原处理结果保留", "原S8渠道保留", "原诗歌能力", "31"]) expect(midnightHistory.textContent).toContain(text);
    expect(within(midnightHistory).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "梦魇成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("never renders stale Sleepless action commands in prior-sequence history", () => {
    const state = fixture();
    state.sleepless.actions = [{ id: "old-consume", label: "不可重服原瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old-original", confirmed: true } }];
    render(<NightmareSleeplessHistory sleepless={state.sleepless} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重服原瓶")).toBeNull();
  });

  it("never renders stale Midnight practice or bottle commands in prior-sequence history", () => {
    const state = fixture();
    state.midnight.actions = [
      { id: "old-s8-consume", label: "不可重复旧服药", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old-s8", confirmed: true } },
      { id: "old-s8-perform", label: "不可重复旧吟诵", cost: "1行动", enabled: true, reason: null, command: { type: "PERFORM", caseId: "old-case", method: "POEM" } },
    ];
    render(<MidnightHistory midnight={state.midnight} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重复旧服药")).toBeNull();
    expect(screen.queryByText("不可重复旧吟诵")).toBeNull();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"],
  ] as const)("preserves the %s S7 default and does not expose Nightmare", async (pathwayId, heading) => {
    const state = fixture(8, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "梦魇成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /梦魇成长|梦魇晋升/ })).toBeNull();
  });

  it.each(["CONSUME", "PREPARE", "SESSION", "VERIFY", "WITHDRAW"] as const)("retries the identical failed %s envelope without a duplicate action", async (type) => {
    const consuming = type === "CONSUME";
    const cmd: NightmareCommand = consuming ? { type: "CONSUME", bottleId: "nightmare-potion-2", confirmed: true }
      : { type, caseId: "letter-at-window" };
    const list = cases();
    list[0]!.status = type === "SESSION" ? "PREPARED" : type === "VERIFY" ? "DREAM_RECORDED" : "OBSERVED";
    const state = fixture(consuming ? 8 : 7, {
      nightmare: consuming ? bottled() : nightmare({ promoted: true, cases: list, actions: [action(cmd)] }),
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
    await openNightmare();
    if (consuming) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶梦魇魔药」/ }));
    const name = consuming ? "确认服用「第二瓶梦魇魔药」" : new RegExp(`^${action(cmd).label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "梦魇模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("梦魇模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "NIGHTMARE", command: cmd });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
