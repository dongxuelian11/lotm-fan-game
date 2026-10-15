/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { GladiatorAction, GladiatorCommand, GladiatorProjection } from "../../src/domain/gladiator/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { GladiatorPanel } from "../../src/renderer/GladiatorPanel";
import { WarriorHistory } from "../../src/renderer/WarriorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
const caseIds = ["agreed-stop", "close-pass", "interrupted-round"] as const;
function action(command: GladiatorCommand, enabled = true): GladiatorAction {
  const target = "caseId" in command ? command.caseId : "bottleId" in command ? command.bottleId : "";
  const suffix = command.type === "PREPARE" ? command.method : "";
  return {
    id: `${command.type}-${target}-${suffix}`, label: `公开操作${command.type}${target}${suffix}`,
    cost: command.type === "RELEASE" ? "0行动 · 无需灵性或检定" : `领域成本${command.type}`,
    enabled, reason: enabled ? null : "领域原因：本周已尝试，请下周再来。", command,
  };
}
function cases(): GladiatorProjection["cases"] {
  return caseIds.map((id, index) => ({
    id, title: `练习情境${index + 1}`, story: `成年伙伴的公开说明${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE", contact: "没有持续接触",
  }));
}
function gladiator(patch: Partial<GladiatorProjection> = {}): GladiatorProjection {
  return {
    title: "格斗家之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立成品，完整配方待核，补给须等下周。",
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "战士消化100/100，成熟时间4/4整周。", pollution: 3, risk,
    cases: [], environment: "", insideCase: false, ...patch,
  };
}
function bottled(): GladiatorProjection {
  return gladiator({ guidanceKnown: true,
    actions: ["gladiator-potion-1", "gladiator-potion-2"].map((bottleId) => ({
      ...action({ type: "CONSUME", bottleId, confirmed: true }), cost: "0行动 · 独立确认 · 消耗这瓶魔药",
    })),
    bottles: [
      { id: "gladiator-potion-1", title: "第一瓶格斗家魔药", source: "奥斯温独立封存的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "gladiator-potion-1", confirmed: true } },
      { id: "gladiator-potion-2", title: "第二瓶格斗家魔药", source: "三次真实劳务及余款换得的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "gladiator-potion-2", confirmed: true } },
      { id: "gladiator-potion-3", title: "第三瓶格斗家魔药", source: "已耗用的第三原瓶", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "gladiator-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: GladiatorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<GladiatorPanel gladiator={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | null = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("gladiator-renderer-run", sliceDefaultCreationSelection, "gladiator-renderer-seed");
  raw.week = 14; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, investigateTargets: [], canAct: true, actionBlockedReason: null,
    warrior: { ...state.warrior, discovered: sequence !== null, promoted: sequence !== null, actions: [] },
    gladiator: gladiator({ title: sequence === 8 ? "格斗家 · 序列8" : "格斗家之路", promoted: sequence === 8, actions: sequence === 8 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "warrior", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
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
async function openGladiator() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "格斗家晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Gladiator sequence eight dossier", () => {
  it("keeps thirteen initial routes and offers no extra ordinary Gladiator route", async () => {
    const value = bridge(fixture(null)); await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    expect(within(tabs).getByRole("button", { name: "战士之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /格斗家/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("opens the Warrior S9 stage normally and routes advancement to independent S8 preparation", async () => {
    const value = bridge(fixture(9)); await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "战士成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "格斗家晋升" }));
    expect(screen.getByRole("region", { name: "格斗家成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "格斗家成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows supplied guidance, per-bottle labour, finite resupply and inherited tool commands only", async () => {
    const commands: GladiatorCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "gladiator-potion-1" },
      { type: "BUY_POTION", bottleId: "gladiator-potion-2" }, { type: "REQUEST_SUPPLY" },
      { type: "RECEIVE_SUPPLY" }, { type: "RETURN_TOOL" },
    ];
    const { onCommand } = panel(gladiator({ actions: commands.map((command) => action(command)) }));
    for (const command of commands) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${action(command).label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
    expect(screen.getByText("三瓶独立成品，完整配方待核，补给须等下周。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /配方|材料|调配/ })).toBeNull();
  });

  it("independently confirms the original bottle, restores focus on cancellation, and prevents repeat consumption", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    await userEvent.click(first);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶格斗家魔药" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "这瓶格斗家魔药的服用确认" }), { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    for (const text of ["gladiator-potion-2", "43%", "来源：三次真实劳务及余款换得的第二原瓶", "0行动 · 独立确认 · 消耗这瓶魔药"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "格斗家服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "0 / 40", resources.cash, "3", "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶格斗家魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "gladiator-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale bottle confirmation when the authoritative action disappears or promotion commits", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<GladiatorPanel gladiator={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<GladiatorPanel gladiator={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(caseIds)("renders one selected scene and keeps %s visible when its result resolves", async (caseId) => {
    const list = cases();
    const commands: GladiatorCommand[] = [
      { type: "OBSERVE", caseId }, { type: "PREPARE", caseId, method: "TECHNIQUE" },
      { type: "PREPARE", caseId, method: "TEAM" }, { type: "PERFORM", caseId },
      { type: "WITHDRAW", caseId }, { type: "REPORT", caseId },
    ];
    const value = gladiator({ promoted: true, cases: list, actions: commands.map((command) => action(command)) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择练习情境" }), caseId);
    expect(screen.getAllByRole("region", { name: "当前练习情境" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    for (const command of commands) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${action(command).label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
    const finished = list.map((scene) => scene.id === caseId ? { ...scene, status: "RESOLVED", observations: ["对方明确同意本次练习。"], result: "真实报告已提交；已支付的行动保留。" } : scene);
    rerender(<GladiatorPanel gladiator={{ ...value, cases: finished, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择练习情境" }) as HTMLSelectElement).value).toBe(caseId);
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain("真实报告已提交；已支付的行动保留。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the typed release action and insideCase flag, never localized contact text, to make zero-AP release prominent", async () => {
    const list = cases(); list[1] = { ...list[1]!, status: "EXAMINED", contact: "公开文字可变，不作为交互状态码", result: "伙伴仍在本次接触中。" };
    const release = action({ type: "RELEASE", caseId: "close-pass" });
    const value = gladiator({ promoted: true, insideCase: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "agreed-stop" }), release, action({ type: "REPORT", caseId: "close-pass" })] });
    const onCommand = vi.fn();
    render(<GladiatorPanel gladiator={value} resources={{ ...resources, health: 0, mind: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择练习情境" }) as HTMLSelectElement;
    expect(selector.value).toBe("close-pass"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("接触状态：公开文字可变，不作为交互状态码")).toBeTruthy();
    const urgent = screen.getByRole("region", { name: "立即松开并停止接触" });
    const button = within(urgent).getByRole("button", { name: /^公开操作RELEASE/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); expect(within(urgent).getByText(release.cost)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^公开操作REPORT/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(release.command);
  });

  it("keeps paid preparation visible through withdrawal and defers all outcomes to receipts", async () => {
    const list = cases(); list[2] = { ...list[2]!, status: "PREPARED", observations: ["此前观察与成本保留。"], preparation: "本次已支付1行动，尚未发生身体接触。" };
    const withdraw = action({ type: "WITHDRAW", caseId: "interrupted-round" });
    const { onCommand } = panel(gladiator({ promoted: true, cases: list, actions: [withdraw] }));
    expect(screen.getByRole("region", { name: "实际方法与准备" }).textContent).toContain("已支付1行动");
    expect(screen.getByText(/取消或退出不会退回已支付的行动/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作WITHDRAW/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByText("实践状态：已选定方法并完成准备")).toBeTruthy();
  });

  it("honors disabled reasons and save/error locks, including release, while never requiring AP or spirit locally", () => {
    const list = cases(); list[0]!.status = "EXAMINED";
    const release = action({ type: "RELEASE", caseId: "agreed-stop" });
    const value = gladiator({ promoted: true, insideCase: true, cases: list, actions: [release] });
    const { onCommand, rerender } = panel(value);
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<GladiatorPanel gladiator={value} resources={resources} {...lock} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^公开操作RELEASE/ }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    rerender(<GladiatorPanel gladiator={{ ...value, actions: [action(release.command, false)] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getAllByText("领域原因：本周已尝试，请下周再来。", { exact: false }).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: /^公开操作RELEASE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the one new training category and explicit fear, mental and local S6 boundaries", () => {
    panel(gladiator({ promoted: true, cases: cases(), actions: [], acting: 100, abilities: [{ id: "warrior.s8.combat-skill", label: "格斗技巧", mastery: 17, description: "实际公开能力说明" }] }));
    const ability = screen.getByRole("region", { name: "格斗家能力与消化" });
    for (const text of ["格斗技巧在本阶段新增为一项训练分类", "仍会受到精神影响与恐惧干扰", "序列6晨曦铠甲", "晨曦武器与光之风暴", "停止信号"]) expect(ability.textContent).toContain(text);
    expect(ability.textContent).toContain("格斗技巧在本阶段新增为一项训练分类；原有战士能力与掌握记录继续继承。练习需要成年伙伴明确同意，停止信号必须落实为实际松开。格斗家仍会受到精神影响与恐惧干扰，不免伤、不徒手防弹；本页不提供序列6晨曦铠甲、晨曦武器与光之风暴。");
    expect(within(ability).getByText("格斗技巧 · 掌握 17")).toBeTruthy();
    expect(screen.getByRole("region", { name: "格斗家成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens warrior eight at the current stage, retaining prior original-tool and bottle history read-only", async () => {
    const state = fixture();
    state.warrior.tool = { id: "original-club", owner: "原主人奥斯温", custodian: "你实际持有", location: "原训练院", version: 2 };
    state.warrior.cases = [{ id: "old-case", title: "旧院门记录", story: "旧院门未改写", observations: ["原观察保留"], preparation: "原准备保留", result: "原报告保留", status: "RESOLVED" }];
    state.warrior.bottles = [{ id: "warrior-original", title: "旧战士原瓶", source: "原渠道保留", status: "已耗用", chance: 50, command: { type: "CONSUME", bottleId: "warrior-original", confirmed: true } }];
    state.warrior.abilities = [{ id: "warrior.s9.physique", label: "原战士力量", mastery: 23, description: "原能力说明" }];
    state.warrior.actions = [{ id: "stale-return", label: "不可重做的原物交还", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN_TOOL" } }];
    const value = bridge(state); await enter(value);
    expect(screen.getByText(new RegExp(`格斗家 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await openGladiator();
    expect(screen.getByRole("region", { name: "格斗家成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "战士经历" }));
    const history = screen.getByRole("region", { name: "战士时期的经历" });
    for (const text of ["旧院门未改写", "原观察保留", "原报告保留", "原渠道保留", "原战士力量", "23", "原主人奥斯温", "你实际持有"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重做的原物交还")).toBeNull();
    expect(within(history).queryByText(/已选择其它途径/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await openGladiator();
    expect(screen.getByRole("region", { name: "格斗家成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps other-route Warrior history read-only and preserves existing growth routes", async () => {
    const state = fixture(); render(<WarriorHistory warrior={state.warrior} />);
    expect(screen.getByText(/已选择其它途径/)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    await enter(bridge(fixture(8, { progression: { pathwayId: "error", sequence: 7, mastery: {}, acting: 0, promotionWeek: 5 } })));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "解密学者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /格斗家成长|格斗家晋升/ })).toBeNull();
  });

  it("forces saved contact into the current dossier and keeps ordinary actions blocked until the actual release receipt", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", contact: "仍有实际接触：先松手分开" };
    const cmd: GladiatorCommand = { type: "RELEASE", caseId: "agreed-stop" };
    const state = fixture(8, { gladiator: gladiator({ promoted: true, insideCase: true, cases: list, actions: [action(cmd)] }), actionsRemaining: 0, spirituality: 0, health: 0, mind: 0, canAct: false });
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, gladiator: { ...state.gladiator, insideCase: false, cases: [{ ...list[0]!, contact: "已实际松手分开" }, ...list.slice(1)], actions: [] } }, envelope));
    await enter(value);
    expect(await screen.findByRole("region", { name: "立即松开并停止接触" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: "战士经历" }) as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) expect(button.disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "非凡成长" }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作RELEASE/ }));
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "立即松开并停止接触" })).toBeNull();
    expect(screen.getByText("接触状态：已实际松手分开")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
  });

  it.each(["CONSUME", "PREPARE", "PERFORM", "RELEASE", "REPORT", "WITHDRAW"] as const)("retries the identical failed %s envelope without duplicate effects or losing the current scene", async (type) => {
    const consuming = type === "CONSUME";
    const cmd: GladiatorCommand = consuming ? { type: "CONSUME", bottleId: "gladiator-potion-2", confirmed: true }
      : type === "PREPARE" ? { type, caseId: "close-pass", method: "TECHNIQUE" } : { type, caseId: "close-pass" };
    const list = cases(); list[1]!.status = type === "RELEASE" || type === "REPORT" ? "EXAMINED" : type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(consuming ? 9 : 8, {
      gladiator: consuming ? bottled() : gladiator({ promoted: true, cases: list, insideCase: type === "RELEASE", actions: [action(cmd)] }),
      actionsRemaining: 0, spirituality: 0, canAct: false, health: type === "RELEASE" ? 0 : 76, mind: type === "RELEASE" ? 0 : 88,
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next = { ...state, revision: state.revision + 1, gladiator: { ...state.gladiator, insideCase: false, actions: [] } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(next, envelope));
    value.submitIntent = submit; await enter(value); await openGladiator();
    if (consuming) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = consuming ? "确认服用「第二瓶格斗家魔药」" : new RegExp(`^${action(cmd).label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button); fireEvent.click(button); expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "格斗家模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("格斗家模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "GLADIATOR", command: cmd });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    if (!consuming) expect((screen.getByRole("combobox", { name: "选择练习情境" }) as HTMLSelectElement).value).toBe("close-pass");
  });
});
