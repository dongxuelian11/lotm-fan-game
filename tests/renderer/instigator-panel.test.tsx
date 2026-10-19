/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { InstigatorAction, InstigatorCommand, InstigatorProjection } from "../../src/domain/instigator/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { InstigatorPanel, InstigatorAssassinHistory } from "../../src/renderer/InstigatorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
const caseIds = ["queue-grievance", "two-notices", "stage-rivalry"] as const;
function action(command: InstigatorCommand, enabled = true): InstigatorAction {
  const target = "caseId" in command ? command.caseId : "bottleId" in command ? command.bottleId : "";
  const suffix = command.type === "PREPARE" ? command.method : "";
  return {
    id: `${command.type}-${target}-${suffix}`, label: `公开操作${command.type}${target}${suffix}`,
    cost: command.type === "SETTLE" ? "0行动 · 无需灵性或检定" : `领域成本${command.type}`,
    enabled, reason: enabled ? null : "领域原因：本周已尝试，请下周再来。", command,
  };
}
function cases(): InstigatorProjection["cases"] {
  return caseIds.map((id, index) => ({
    id, title: `社会情境${index + 1}`, story: `当事人的公开说明${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE", tension: "没有激化的争执",
  }));
}
function instigator(patch: Partial<InstigatorProjection> = {}): InstigatorProjection {
  return {
    title: "教唆者之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "指导180便士；三瓶独立成品，原价1210便士，三次劳务后160便士。完整配方待核，补给须等下周。",
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "刺客消化100/100，成熟时间4/4整周。", pollution: 3, risk,
    cases: [], environment: "", insideCase: false, ...patch,
  };
}
function bottled(): InstigatorProjection {
  return instigator({ guidanceKnown: true,
    actions: ["instigator-potion-1", "instigator-potion-2"].map((bottleId) => ({
      ...action({ type: "CONSUME", bottleId, confirmed: true }), cost: "0行动 · 独立确认 · 消耗这瓶魔药",
    })),
    bottles: [
      { id: "instigator-potion-1", title: "第一瓶教唆者魔药", source: "诺艾拉·温瑟独立封存的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "instigator-potion-1", confirmed: true } },
      { id: "instigator-potion-2", title: "第二瓶教唆者魔药", source: "三次真实劳务及余款换得的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "instigator-potion-2", confirmed: true } },
      { id: "instigator-potion-3", title: "第三瓶教唆者魔药", source: "已耗用的第三原瓶", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "instigator-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: InstigatorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<InstigatorPanel instigator={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | null = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("instigator-renderer-run", sliceDefaultCreationSelection, "instigator-renderer-seed");
  raw.week = 14; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, investigateTargets: [], canAct: true, actionBlockedReason: null,
    assassin: { ...state.assassin, discovered: sequence !== null, promoted: sequence !== null, actions: [] },
    instigator: instigator({ title: sequence === 8 ? "教唆者 · 序列8" : "教唆者之路", promoted: sequence === 8, actions: sequence === 8 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "demoness", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-12T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:01:00Z", replayed: false, state,
  } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
}
async function openInstigator() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "教唆者晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Instigator sequence eight dossier", () => {
  it("keeps fourteen initial routes and offers no extra ordinary Instigator route", async () => {
    const value = bridge(fixture(null)); await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    expect(within(tabs).getByRole("button", { name: "刺客之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /教唆者/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("opens the Assassin S9 stage normally and routes advancement to independent S8 preparation", async () => {
    const value = bridge(fixture(9)); await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(await screen.findByRole("region", { name: "刺客成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "教唆者晋升" }));
    expect(screen.getByRole("region", { name: "教唆者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "教唆者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows supplied guidance, per-bottle labour and finite resupply commands only", async () => {
    const commands: InstigatorCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "instigator-potion-1" },
      { type: "BUY_POTION", bottleId: "instigator-potion-2" }, { type: "REQUEST_SUPPLY" },
      { type: "RECEIVE_SUPPLY" },
    ];
    const { onCommand } = panel(instigator({ actions: commands.map((command) => action(command)) }));
    for (const command of commands) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${action(command).label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
    expect(screen.getByText("指导180便士；三瓶独立成品，原价1210便士，三次劳务后160便士。完整配方待核，补给须等下周。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /配方|材料|调配/ })).toBeNull();
  });

  it("independently confirms the original bottle, restores focus on cancellation, and prevents repeat consumption", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    await userEvent.click(first);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶教唆者魔药" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "这瓶教唆者魔药的服用确认" }), { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    for (const text of ["instigator-potion-2", "43%", "来源：三次真实劳务及余款换得的第二原瓶", "0行动 · 独立确认 · 消耗这瓶魔药"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "教唆者服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "0 / 40", resources.cash, "3", "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶教唆者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "instigator-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale bottle confirmation when the authoritative action disappears or promotion commits", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<InstigatorPanel instigator={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<InstigatorPanel instigator={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(caseIds)("renders one selected scene and keeps %s visible when its result resolves", async (caseId) => {
    const list = cases();
    const commands: InstigatorCommand[] = [
      { type: "OBSERVE", caseId }, { type: "PREPARE", caseId, method: "INCITE" },
      { type: "PREPARE", caseId, method: "PLAIN" }, { type: "PERFORM", caseId },
      { type: "WITHDRAW", caseId }, { type: "REPORT", caseId },
    ];
    const value = instigator({ promoted: true, cases: list, actions: commands.map((command) => action(command)) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择社会情境" }), caseId);
    expect(screen.getAllByRole("region", { name: "当前社会情境" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    for (const command of commands) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${action(command).label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
    const finished = list.map((scene) => scene.id === caseId ? { ...scene, status: "RESOLVED", observations: ["对方实际说明已有不满。"], result: "真实报告已提交；已支付的行动保留。" } : scene);
    rerender(<InstigatorPanel instigator={{ ...value, cases: finished, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择社会情境" }) as HTMLSelectElement).value).toBe(caseId);
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain("真实报告已提交；已支付的行动保留。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the typed SETTLE action and insideCase flag, never localized tension text, to make zero-AP repair prominent", async () => {
    const list = cases(); list[1] = { ...list[1]!, status: "EXAMINED", tension: "公开文字可变，不作为交互状态码", result: "当事人的争执尚未缓和。" };
    const settle = action({ type: "SETTLE", caseId: "two-notices" });
    const value = instigator({ promoted: true, insideCase: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "queue-grievance" }), settle, action({ type: "REPORT", caseId: "two-notices" })] });
    const onCommand = vi.fn();
    render(<InstigatorPanel instigator={value} resources={{ ...resources, health: 0, mind: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择社会情境" }) as HTMLSelectElement;
    expect(selector.value).toBe("two-notices"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("争执状态：公开文字可变，不作为交互状态码")).toBeTruthy();
    const urgent = screen.getByRole("region", { name: "立即停止挑动并退开" });
    const button = within(urgent).getByRole("button", { name: /^公开操作SETTLE/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); expect(within(urgent).getByText(settle.cost)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^公开操作REPORT/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(settle.command);
  });

  it("keeps paid preparation visible through withdrawal and defers all outcomes to receipts", async () => {
    const list = cases(); list[2] = { ...list[2]!, status: "PREPARED", observations: ["此前观察与成本保留。"], preparation: "本次已支付1行动，尚未实际施加影响。" };
    const withdraw = action({ type: "WITHDRAW", caseId: "stage-rivalry" });
    const { onCommand } = panel(instigator({ promoted: true, cases: list, actions: [withdraw] }));
    expect(screen.getByRole("region", { name: "实际方法与准备" }).textContent).toContain("已支付1行动");
    expect(screen.getByText(/取消或退出不会退回已支付的行动/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作WITHDRAW/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByText("实践状态：已选定方法并完成准备")).toBeTruthy();
  });

  it("honors disabled reasons and save/error locks, including settle, while never requiring AP or spirit locally", () => {
    const list = cases(); list[0]!.status = "EXAMINED";
    const settle = action({ type: "SETTLE", caseId: "queue-grievance" });
    const value = instigator({ promoted: true, insideCase: true, cases: list, actions: [settle] });
    const { onCommand, rerender } = panel(value);
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<InstigatorPanel instigator={value} resources={resources} {...lock} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^公开操作SETTLE/ }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    rerender(<InstigatorPanel instigator={{ ...value, actions: [action(settle.command, false)] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getAllByText("领域原因：本周已尝试，请下周再来。", { exact: false }).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: /^公开操作SETTLE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only the new limited influence and keeps S7 powers unavailable", () => {
    panel(instigator({ promoted: true, cases: cases(), actions: [], acting: 100, abilities: [{ id: "assassin.s8.instigation", label: "教唆", mastery: 17, description: "实际公开能力说明" }] }));
    const ability = screen.getByRole("region", { name: "教唆者能力与消化" });
    for (const text of ["不保证对方冷静或原谅", "原有刺客能力与掌握记录继续继承", "不保证对方服从", "普通核对与沟通同样可完成实践", "序列7女巫的身体变化、隐身和黑焰尚未开放"]) expect(ability.textContent).toContain(text);
    expect(within(ability).getByText("教唆 · 掌握 17")).toBeTruthy();
    expect(screen.getByRole("region", { name: "教唆者成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens sequence eight at its current stage and retains the original S9 draft and ability history read-only", async () => {
    const state = fixture();
    state.assassin.draft = { id: "assassin-original-draft", owner: "诺艾拉·温瑟", custodian: "原作者实际保管", location: "原作者书桌", version: 4 };
    state.assassin.cases = [{ id: "upper-draft", title: "旧上层原稿", story: "旧原稿位置未改写", observations: ["原观察保留"], preparation: "原准备保留", result: "原报告保留", status: "RESOLVED", position: "原起点" }];
    state.assassin.bottles = [{ id: "assassin-original", title: "旧刺客原瓶", source: "原渠道保留", status: "已耗用", chance: 50, command: { type: "CONSUME", bottleId: "assassin-original", confirmed: true } }];
    state.assassin.abilities = [{ id: "assassin.s9.lightness", label: "原刺客轻盈身法", mastery: 23, description: "原能力说明" }];
    state.assassin.actions = [{ id: "stale-return", label: "不可重做的原稿返回", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }];
    const value = bridge(state); await enter(value);
    expect(screen.getByText(new RegExp(`教唆者 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await openInstigator();
    expect(screen.getByRole("region", { name: "教唆者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "刺客经历" }));
    const history = screen.getByRole("region", { name: "刺客时期的经历" });
    for (const text of ["旧原稿位置未改写", "原观察保留", "原报告保留", "原渠道保留", "原刺客轻盈身法", "23", "诺艾拉·温瑟", "原作者实际保管"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重做的原稿返回")).toBeNull();
    expect(within(history).queryByText(/已选择其它途径/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await openInstigator();
    expect(screen.getByRole("region", { name: "教唆者成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("has no mutation controls in inherited history and preserves the other current pathways", async () => {
    const state = fixture(); render(<InstigatorAssassinHistory assassin={state.assassin} />);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull();
    cleanup();
    await enter(bridge(fixture(8, { progression: { pathwayId: "error", sequence: 7, mastery: {}, acting: 0, promotionWeek: 5 } })));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "解密学者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /教唆者成长|教唆者晋升/ })).toBeNull();
  });

  it("forces saved heated consequences into the current dossier until the actual zero-AP SETTLE receipt", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", tension: "仍有实际激化的争执：先停止挑动并退开" };
    const cmd: InstigatorCommand = { type: "SETTLE", caseId: "queue-grievance" };
    const state = fixture(8, { instigator: instigator({ promoted: true, insideCase: true, cases: list, actions: [action(cmd)] }), actionsRemaining: 0, spirituality: 0, health: 0, mind: 0, canAct: false });
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, instigator: { ...state.instigator, insideCase: false, cases: [{ ...list[0]!, tension: "已实际停止挑动并退开" }, ...list.slice(1)], actions: [] } }, envelope));
    await enter(value);
    expect(await screen.findByRole("region", { name: "立即停止挑动并退开" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: "刺客经历" }) as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) expect(button.disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "非凡成长" }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作SETTLE/ }));
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "立即停止挑动并退开" })).toBeNull();
    expect(screen.getByText("争执状态：已实际停止挑动并退开")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "SETTLE", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the identical failed %s envelope without duplicate effects or losing the current scene", async (type) => {
    const consuming = type === "CONSUME";
    const cmd: InstigatorCommand = consuming ? { type: "CONSUME", bottleId: "instigator-potion-2", confirmed: true }
      : type === "REFLECT" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "two-notices", method: "INCITE" } : { type, caseId: "two-notices" };
    const list = cases(); list[1]!.status = type === "SETTLE" || type === "REPORT" ? "EXAMINED" : type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const preparing = consuming || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY";
    const state = fixture(preparing ? 9 : 8, {
      instigator: consuming ? bottled() : instigator({ promoted: !preparing, cases: list, insideCase: type === "SETTLE", actions: [action(cmd)] }),
      actionsRemaining: 0, spirituality: 0, canAct: false, health: type === "SETTLE" ? 0 : 76, mind: type === "SETTLE" ? 0 : 88,
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next = { ...state, revision: state.revision + 1, instigator: { ...state.instigator, insideCase: false, actions: [] } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(next, envelope));
    value.submitIntent = submit; await enter(value); await openInstigator();
    if (consuming) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = consuming ? "确认服用「第二瓶教唆者魔药」" : new RegExp(`^${action(cmd).label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button); fireEvent.click(button); expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "教唆者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("教唆者模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "INSTIGATOR", command: cmd });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    if ("caseId" in cmd) expect((screen.getByRole("combobox", { name: "选择社会情境" }) as HTMLSelectElement).value).toBe("two-notices");
  });

  it("keeps the normal dashboard and close navigation available when the public insideCase flag is false", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", tension: "HEATED：这只是可变的公开记录文字" };
    const value = bridge(fixture(8, { instigator: instigator({ promoted: true, insideCase: false, cases: list, actions: [] }), actionsRemaining: 1 }));
    await enter(value);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).not.toContain("先停止挑动并退开");
    const life = [...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")];
    expect(life.length).toBeGreaterThan(0); expect(life.some((button) => !button.disabled)).toBe(true);
    await openInstigator();
    expect(screen.queryByRole("region", { name: "立即停止挑动并退开" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择社会情境" }) as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("gives the existing upper-draft RETURN priority before exposing any S8 consequence repair", async () => {
    const state = fixture(9);
    state.assassin = { ...state.assassin, insideCase: true, cases: [{ id: "upper-draft", title: "上层原稿", story: "本次仍在原平台", observations: ["导师已打开普通楼梯"], preparation: null, result: "尚未返回", status: "EXAMINED", position: "上层平台" }],
      actions: [{ id: "original-stairs", label: "沿原楼梯实际返回", cost: "0行动 · 0灵性", enabled: true, reason: null, command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }] };
    state.instigator = instigator({ promoted: false, insideCase: true, cases: cases(), actions: [action({ type: "SETTLE", caseId: "queue-grievance" })] });
    state.health = 0; state.mind = 0; state.spirituality = 0; state.actionsRemaining = 0;
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, assassin: { ...state.assassin, insideCase: false, actions: [] } }, envelope));
    await enter(value);
    expect(await screen.findByRole("region", { name: "刺客成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "立即停止挑动并退开" })).toBeNull();
    expect((screen.getByRole("button", { name: "教唆者晋升" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先从上层平台实际返回");
    await userEvent.click(screen.getByRole("button", { name: /^沿原楼梯实际返回/ }));
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "ASSASSIN", command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } });
    expect(await screen.findByRole("region", { name: "立即停止挑动并退开" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  });

  it("retains a genuinely consumed failed original and opens the next independent bottle", async () => {
    const state = fixture(9, { instigator: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      instigator: { ...state.instigator, bottles: state.instigator.bottles.map((bottle) => bottle.id === "instigator-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.instigator.actions.slice(1) } };
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(value); await openInstigator();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶教唆者魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "INSTIGATOR", command: { type: "CONSUME", bottleId: "instigator-potion-1", confirmed: true } });
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("instigator-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
  });

  it("shows an actual INCITE consequence until SETTLE commits and only then enables the report", async () => {
    const caseId = "stage-rivalry";
    const perform = action({ type: "PERFORM", caseId });
    const list = cases().map((entry) => entry.id === caseId ? { ...entry, status: "PREPARED", preparation: "已准备针对已有竞争的教唆" } : entry);
    const state = fixture(8, { instigator: instigator({ promoted: true, cases: list, actions: [perform] }) });
    const heated: SliceProjection = { ...state, revision: state.revision + 1, actionsRemaining: 0, spirituality: 0, canAct: false,
      instigator: { ...state.instigator, insideCase: true,
        cases: list.map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", preparation: null, result: "对方争执实际升温，没有保证服从", tension: "实际争执尚待本人停止挑动" } : entry),
        actions: [action({ type: "SETTLE", caseId }), action({ type: "REPORT", caseId }), action({ type: "WITHDRAW", caseId })] } };
    const settled: SliceProjection = { ...heated, revision: heated.revision + 1,
      instigator: { ...heated.instigator, insideCase: false,
        cases: heated.instigator.cases.map((entry) => entry.id === caseId ? { ...entry, tension: "已实际退开，原尝试与成本保留" } : entry), actions: [action({ type: "REPORT", caseId })] } };
    const value = bridge(state);
    value.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(heated, envelope))
      .mockImplementationOnce(async (envelope) => receipt(settled, envelope));
    await enter(value); await openInstigator();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${perform.label}`) }));
    expect(screen.getByRole("region", { name: "立即停止挑动并退开" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain("没有保证服从");
    for (const type of ["REPORT", "WITHDRAW"]) {
      const button = screen.getByRole("button", { name: new RegExp(`^公开操作${type}`) }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const settle = screen.getByRole("button", { name: /^公开操作SETTLE/ }) as HTMLButtonElement;
    expect(settle.disabled).toBe(false); await userEvent.click(settle);
    expect(vi.mocked(value.submitIntent).mock.calls[1]![0].payload).toEqual({ type: "INSTIGATOR", command: { type: "SETTLE", caseId } });
    expect(screen.queryByRole("region", { name: "立即停止挑动并退开" })).toBeNull();
    expect((screen.getByRole("button", { name: /^公开操作REPORT/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("争执状态：已实际退开，原尝试与成本保留")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });
});
