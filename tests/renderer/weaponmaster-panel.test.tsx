/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { WeaponmasterAction, WeaponmasterCommand, WeaponmasterProjection } from "../../src/domain/weaponmaster/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { WeaponmasterPanel, GladiatorHistory } from "../../src/renderer/WeaponmasterPanel";
import { WarriorHistory } from "../../src/renderer/WarriorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
const caseIds = ["weapon-fit", "padded-mark", "watch-handover"] as const;
function action(command: WeaponmasterCommand, enabled = true): WeaponmasterAction {
  const target = "caseId" in command ? command.caseId : "bottleId" in command ? command.bottleId : "";
  const suffix = command.type === "PREPARE" ? command.method : "";
  return {
    id: `${command.type}-${target}-${suffix}`, label: `公开操作${command.type}${target}${suffix}`,
    cost: `领域成本${command.type}`, enabled, reason: enabled ? null : "领域原因：本周已尝试，请下周再来。", command,
  };
}
function cases(): WeaponmasterProjection["cases"] {
  return caseIds.map((id, index) => ({
    id, title: `武器练习情境${index + 1}`, story: `原记录的公开说明${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function weaponmaster(patch: Partial<WeaponmasterProjection> = {}): WeaponmasterProjection {
  return {
    title: "武器大师之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立成品，费用按原瓶公开记录，完整配方待核，补给须等下周。",
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "格斗家消化100/100，成熟时间8/8整周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): WeaponmasterProjection {
  return weaponmaster({ guidanceKnown: true,
    actions: ["weaponmaster-potion-1", "weaponmaster-potion-2"].map((bottleId) => ({
      ...action({ type: "CONSUME", bottleId, confirmed: true }), cost: "0行动 · 独立确认 · 消耗这瓶魔药",
    })),
    bottles: [
      { id: "weaponmaster-potion-1", title: "第一瓶武器大师魔药", source: "奥斯温独立封存的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "weaponmaster-potion-1", confirmed: true } },
      { id: "weaponmaster-potion-2", title: "第二瓶武器大师魔药", source: "四次真实劳务及余款换得的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "weaponmaster-potion-2", confirmed: true } },
      { id: "weaponmaster-potion-3", title: "第三瓶武器大师魔药", source: "已耗用的第三原瓶", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "weaponmaster-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: WeaponmasterProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<WeaponmasterPanel weaponmaster={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 | null = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("weaponmaster-renderer-run", sliceDefaultCreationSelection, "weaponmaster-renderer-seed");
  raw.week = 14;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, investigateTargets: [], canAct: true, actionBlockedReason: null,
    warrior: { ...state.warrior, discovered: sequence !== null, promoted: sequence !== null },
    gladiator: { ...state.gladiator, discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7 },
    weaponmaster: weaponmaster({ title: sequence === 7 ? "武器大师 · 序列7" : "武器大师之路", promoted: sequence === 7, actions: sequence === 7 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "warrior", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
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
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
}
async function openWeaponmaster() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "武器大师晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Weaponmaster sequence seven dossier", () => {
  it("keeps the thirteen ordinary routes and closes without an extra initial pathway", async () => {
    const value = bridge(fixture(null));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "战士之路"]) {
      expect(within(tabs).getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /武器大师/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("adds Weaponmaster preparation after Gladiator and routes the advancement guide to it", async () => {
    const value = bridge(fixture(8));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "格斗家成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "武器大师晋升" }));
    expect(screen.getByRole("region", { name: "武器大师成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "武器大师成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("forwards each acquisition action with backend cost and reason, without fabricating a recipe", async () => {
    const { onCommand, rerender } = panel(weaponmaster({ formula: [{ name: "未核配方不得显示", quantity: 9, unit: "份" }] }));
    expect(screen.queryByText("未核配方不得显示")).toBeNull();
    expect(screen.getByText("这是新渠道独立成品药，沿用成年导师奥斯温·布莱克特；当前渠道只提供成品魔药，不提供完整配方，指导不解锁材料采购或制造，也不会建立组织身份。")).toBeTruthy();
    expect(screen.getByText(/三瓶独立成品.*补给须等下周/)).toBeTruthy();
    const commands: WeaponmasterCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "weaponmaster-potion-1" },
      { type: "BUY_POTION", bottleId: "weaponmaster-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    for (const command of commands) {
      const current = { ...action(command), cost: command.type === "LEARN_GUIDANCE" ? "1行动 · 240便士" : `原领域成本${command.type}` };
      rerender(<WeaponmasterPanel weaponmaster={weaponmaster({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      expect(screen.getByText(current.cost)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
    const unavailable = action({ type: "BUY_POTION", bottleId: "weaponmaster-potion-2" }, false);
    rerender(<WeaponmasterPanel weaponmaster={weaponmaster({ actions: [unavailable] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
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
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶武器大师魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶武器大师魔药" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "这瓶武器大师魔药的服用确认" }), { key: "Escape" });
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶武器大师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶武器大师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶武器大师魔药」/ }));
    for (const text of ["weaponmaster-potion-2", "43%", "来源：四次真实劳务及余款换得的第二原瓶", "0行动 · 独立确认 · 消耗这瓶魔药"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "武器大师服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "3", "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶武器大师魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "weaponmaster-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops stale confirmation when its bottle action disappears or promotion is committed", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<WeaponmasterPanel weaponmaster={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<WeaponmasterPanel weaponmaster={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only one of three cases and never invents observations or outcomes", async () => {
    const list = cases();
    list[1]!.observations = ["当事人已说明紧张的原因，旁人仍在场。"];
    const { onCommand } = panel(weaponmaster({ promoted: true, cases: list, actions: list.map((scene) => action({ type: "OBSERVE", caseId: scene.id })) }));
    expect(screen.getAllByRole("region", { name: "当前武器实践情境" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    expect(screen.queryByText(list[1]!.observations[0]!)).toBeNull();
    expect(screen.queryByRole("region", { name: "实际武器实践结果" })).toBeNull();
    for (const [index, scene] of list.entries()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择武器实践情境" }), scene.id);
      expect(screen.getByText(`原记录的公开说明${index + 1}`)).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(caseIds)("forwards observe, preparation, both methods and withdrawal for %s", async (caseId) => {
    const list = cases();
    const commands: WeaponmasterCommand[] = [
      { type: "OBSERVE", caseId }, { type: "PREPARE", caseId, method: "TECHNIQUE" }, { type: "PREPARE", caseId, method: "TEAM" },
      { type: "PERFORM", caseId }, { type: "REPORT", caseId }, { type: "WITHDRAW", caseId },
    ];
    const value = weaponmaster({ promoted: true, cases: list, actions: commands.map((command) => action(command)) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择武器实践情境" }), caseId);
    for (const command of commands) {
      const current = action(command);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("region", { name: "实际武器实践结果" })).toBeNull();
    }
    const observed = list.map((scene) => scene.id === caseId ? { ...scene, status: "PREPARED", observations: ["原记录已出示，核查范围已说明。"] } : scene);
    rerender(<WeaponmasterPanel weaponmaster={{ ...value, cases: observed }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("原记录已出示，核查范围已说明。")).toBeTruthy();
    expect(screen.getByText("实践状态：已选定方法并完成准备")).toBeTruthy();
    const finished = observed.map((scene) => scene.id === caseId ? { ...scene, status: "RESOLVED", result: "实际结算：已完成原工具练习，未宣称看穿所有弱点。" } : scene);
    rerender(<WeaponmasterPanel weaponmaster={{ ...value, cases: finished, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际武器实践结果" }).textContent).toContain("实际结算：已完成原工具练习，未宣称看穿所有弱点。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["OBSERVED", "PREPARED"])("defaults to the active %s case and allows backend-approved zero-AP withdrawal at incapacity", async (status) => {
    const list = cases();
    list[1]!.status = status;
    const withdraw = { ...action({ type: "WITHDRAW", caseId: "padded-mark" }), cost: "0行动 · 停止本次实践" };
    const value = weaponmaster({ promoted: true, cases: list, actions: [action({ type: "OBSERVE", caseId: "weapon-fit" }), withdraw] });
    const onCommand = vi.fn();
    render(<WeaponmasterPanel weaponmaster={value} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择武器实践情境" }) as HTMLSelectElement).value).toBe("padded-mark");
    expect(screen.getByText(withdraw.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作WITHDRAW/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
  });

  it("obeys backend disabled reasons, save locks and blocking errors without inferring permission from AP", () => {
    const list = cases();
    list[0]!.status = "OBSERVED";
    const value = weaponmaster({ promoted: true, cases: list, actions: [action({ type: "PREPARE", caseId: "weapon-fit", method: "TECHNIQUE" }, false), action({ type: "WITHDRAW", caseId: "weapon-fit" })] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^公开操作PREPARE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("领域原因：本周已尝试，请下周再来。").length).toBeGreaterThan(0);
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<WeaponmasterPanel weaponmaster={value} resources={resources} {...lock} onCommand={onCommand} />);
      const withdraw = screen.getByRole("button", { name: /^公开操作WITHDRAW/ });
      expect((withdraw as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("combobox", { name: "选择武器实践情境" }) as HTMLSelectElement).disabled).toBe(true);
      fireEvent.click(withdraw);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("prioritizes an examined case and keeps its submitted report selected after commit", async () => {
    const list = cases();
    list[1] = { ...list[1]!, status: "EXAMINED", preparation: "原棍与填充靶已核对，已实际完成有限练习。", result: "靶面标记已重查，尚未提交练习报告。" };
    const disclose = action({ type: "REPORT", caseId: "padded-mark" });
    const value = weaponmaster({ promoted: true, acting: 0, cases: list, actions: [action({ type: "OBSERVE", caseId: "weapon-fit" }), disclose] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox", { name: "选择武器实践情境" }) as HTMLSelectElement).value).toBe("padded-mark");
    expect(screen.getByRole("region", { name: "实际方法与准备" }).textContent).toContain("原棍与填充靶已核对");
    expect(screen.getByText(/尚未完成报告与奖励结算/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${disclose.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(disclose.command);
    expect(screen.getByText(/实践状态：已实际练习，等待核对并报告/)).toBeTruthy();
    expect(screen.getByText(/扮演进度 0/)).toBeTruthy();
    const resolved = list.map((scene) => scene.id === "padded-mark" ? { ...scene, status: "RESOLVED", result: "原棍与填充靶已核实；本次有限报告已提交。" } : scene);
    rerender(<WeaponmasterPanel weaponmaster={{ ...value, acting: 30, cases: resolved, actions: [action({ type: "OBSERVE", caseId: "weapon-fit" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择武器实践情境" }) as HTMLSelectElement).value).toBe("padded-mark");
    expect(screen.getByRole("region", { name: "实际武器实践结果" }).textContent).toContain("原棍与填充靶已核实");
    expect(screen.getByText(/扮演进度 30/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows only supplied inherited and S7 abilities and the limited progression boundary", () => {
    const abilities = [
      { id: "warrior.s9.physique", label: "原战士力量", mastery: 11, description: "原能力说明" },
      { id: "warrior.s9.arms", label: "原器械基础", mastery: 12, description: "原器械说明" },
      { id: "warrior.s9.restraint", label: "原收力", mastery: 13, description: "原收力说明" },
      { id: "warrior.s8.combat-skill", label: "格斗技巧", mastery: 14, description: "有限格斗说明" },
      { id: "warrior.s7.weapons", label: "武器技巧", mastery: 17, description: "实际武器的公开说明" },
      { id: "warrior.s7.weak-point", label: "有限薄弱处判断", mastery: 19, description: "只对公开目标有效" },
    ];
    panel(weaponmaster({ promoted: true, cases: cases(), actions: [], acting: 100, abilities }));
    const ability = screen.getByRole("region", { name: "武器大师能力与消化" });
    for (const text of ["武器技巧与有限薄弱处判断属于本阶段的实践分类", "实际在手的原武器", "不凭空获得装备", "仍会受到精神影响与恐惧干扰", "序列6晨曦铠甲", "光之风暴尚未开放"]) expect(ability.textContent).toContain(text);
    expect(within(ability).getByRole("heading", { name: "能力与消化 · 6 项能力" })).toBeTruthy();
    for (const entry of abilities) expect(within(ability).getByText(`${entry.label} · 掌握 ${entry.mastery}`)).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "武器大师扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("region", { name: "已知实践环境" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "武器大师成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards borrowing and returning the same S9 original without inventing a new weapon", async () => {
    const tool = { id: "warrior-training-club", owner: "奥斯温·布莱克特", custodian: "导师保管", location: "原训练架", version: 3 };
    const commands: WeaponmasterCommand[] = [{ type: "BORROW_TOOL" }, { type: "RETURN_TOOL" }];
    const value = weaponmaster({ promoted: true, cases: cases(), actions: commands.map((command) => action(command)) });
    const onCommand = vi.fn();
    const { rerender } = render(<WeaponmasterPanel weaponmaster={value} tool={tool} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    for (const command of commands) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${action(command).label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.getByRole("region", { name: "训练原棍的归属与持有" }).textContent).toContain("导师保管");
    }
    expect(screen.getByText(/借用不转移所有权/)).toBeTruthy();
    rerender(<WeaponmasterPanel weaponmaster={{ ...value, actions: [] }} tool={{ ...tool, custodian: "你实际持有", location: "你的手中", version: 4 }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const record = screen.getByRole("region", { name: "训练原棍的归属与持有" });
    for (const text of ["warrior-training-club", "奥斯温·布莱克特", "你实际持有", "你的手中", "4"]) expect(record.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards an inherited original-tool return only when the public projection offers it", async () => {
    const returning = { ...action({ type: "RETURN_TOOL" }), cost: "0行动 · 交回同一原短棍" };
    const { onCommand, rerender } = panel(weaponmaster({ promoted: true, actions: [returning] }));
    await userEvent.click(screen.getByRole("button", { name: /^公开操作RETURN_TOOL/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_TOOL" });
    rerender(<WeaponmasterPanel weaponmaster={weaponmaster({ promoted: true, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /^公开操作RETURN_TOOL/ })).toBeNull();
  });

  it("forwards reflection only when supplied and enabled by the backend", async () => {
    const reflection = action({ type: "REFLECT" });
    const value = weaponmaster({ promoted: true, cases: cases(), actions: [reflection] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REFLECT/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    rerender(<WeaponmasterPanel weaponmaster={{ ...value, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /^公开操作REFLECT/ })).toBeNull();
  });

  it("opens warrior seven by default and retains the S9 original tool and report history read-only", async () => {
    const state = fixture();
    state.warrior.cases = [{ id: "old-case", title: "旧院门记录", story: "旧院门未改写", observations: ["原观察保留"], preparation: "原准备保留", result: "原报告保留", status: "RESOLVED" }];
    state.warrior.tool = { id: "warrior-training-club", owner: "原主人奥斯温", custodian: "你实际持有", location: "原训练院", version: 2 };
    state.warrior.bottles = [{ id: "warrior-original", title: "旧战士原瓶", source: "原渠道保留", status: "已耗用", chance: 50, command: { type: "CONSUME", bottleId: "warrior-original", confirmed: true } }];
    state.warrior.abilities = [{ id: "warrior.s9.physique", label: "原战士力量", mastery: 23, description: "原能力说明" }];
    state.warrior.actions = [{ id: "stale-return", label: "不可重做的原物交还", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN_TOOL" } }];
    const value = bridge(state); await enter(value);
    expect(screen.getByText(new RegExp(`武器大师 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "武器大师成长下一步" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "训练原棍的归属与持有" }).textContent).toContain("warrior-training-club");
    await userEvent.click(screen.getByRole("button", { name: "战士经历" }));
    const history = screen.getByRole("region", { name: "战士时期的经历" });
    for (const text of ["已晋升武器大师", "旧院门未改写", "原观察保留", "原报告保留", "原渠道保留", "原战士力量", "23", "原主人奥斯温", "你实际持有"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重做的原物交还")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "武器大师成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Gladiator original observations, methods, report and bottles read-only after S7", async () => {
    const state = fixture();
    state.gladiator.cases = [{ id: "old-s8", title: "旧格斗练习", story: "旧公开事实保留", observations: ["旧观察不变"], preparation: "实际采用普通团队方法", result: "实际松开并提交停止报告", status: "RESOLVED", contact: "已实际松开，接触结束" }];
    state.gladiator.bottles = [{ id: "old-s8-potion", title: "旧格斗家原瓶", source: "旧S8渠道保留", status: "已耗用 · 成功", chance: 55, command: { type: "CONSUME", bottleId: "old-s8-potion", confirmed: true } }];
    state.gladiator.abilities = [{ id: "warrior.s8.combat-skill", label: "原格斗技巧", mastery: 37, description: "原有限格斗说明" }];
    state.gladiator.actions = [{ id: "stale-s8", label: "不可重做的旧报告", cost: "0行动", enabled: true, reason: null, command: { type: "REPORT", caseId: "old-s8" } }];
    const value = bridge(state);
    await enter(value);
    await openWeaponmaster();
    await userEvent.click(screen.getByRole("button", { name: "格斗家经历" }));
    const history = screen.getByRole("region", { name: "格斗家时期的经历" });
    for (const text of ["已晋升武器大师", "旧公开事实保留", "旧观察不变", "实际采用普通团队方法", "实际松开并提交停止报告", "旧S8渠道保留", "已耗用 · 成功", "原格斗技巧", "37"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重做的旧报告")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "武器大师成长" }));
    expect(screen.getByRole("region", { name: "武器大师成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("does not expose S7 preparation to an S9 character even when stale S7 data exists", async () => {
    await enter(bridge(fixture(9)));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "战士成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "格斗家晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /武器大师/ })).toBeNull();
  });

  it("ignores stale S8 formula and action fields in a standalone history record", () => {
    const state = fixture();
    state.gladiator.formula = [{ name: "未核S8配方不得显示", quantity: 1, unit: "份" }];
    state.gladiator.actions = [{ id: "stale-s8", label: "不可重做的旧报告", cost: "0行动", enabled: true, reason: null, command: { type: "REPORT", caseId: "old-s8" } }];
    render(<GladiatorHistory gladiator={state.gladiator} />);
    expect(screen.queryByText("未核S8配方不得显示")).toBeNull();
    expect(screen.queryByText("不可重做的旧报告")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never renders stale S9 commands or mutation handlers in other-route history", () => {
    const state = fixture();
    state.warrior.actions = [{ id: "old-consume", label: "不可重服原瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old-original", confirmed: true } }];
    render(<WarriorHistory warrior={state.warrior} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("不可重服原瓶")).toBeNull();
    expect(screen.getByText(/已选择其它途径/)).toBeTruthy();
  });

  it.each([
    ["diviner", "魔术师成长下一步"], ["hunter", "纵火家成长下一步"],
    ["audience", "心理医生成长下一步"], ["paragon", "鉴定师成长下一步"], ["moon", "吸血鬼成长下一步"],
  ] as const)("preserves the %s S7 default and does not expose Weaponmaster", async (pathwayId, heading) => {
    const state = fixture(8, { progression: { pathwayId, sequence: 7, acting: 0, mastery: {}, promotionWeek: 5 } });
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: heading })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "武器大师成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /武器大师成长|武器大师晋升/ })).toBeNull();
  });

  it("keeps S8 contact release available and blocks entering S7 until the release is committed", async () => {
    const state = fixture(8);
    state.gladiator = { ...state.gladiator, insideCase: true, promoted: true,
      cases: [{ id: "agreed-stop", title: "原同意练习", story: "原伙伴仍待松开", observations: [], preparation: "原近身方法", result: "已完成练习", contact: "仍有实际接触", status: "EXAMINED" }],
      actions: [{ id: "release", label: "实际松开原伙伴", cost: "0行动 · 无需灵性", enabled: true, reason: null, command: { type: "RELEASE", caseId: "agreed-stop" } }],
    };
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, gladiator: { ...state.gladiator, insideCase: false, actions: [] } }, envelope));
    await enter(value);
    expect(await screen.findByRole("region", { name: "立即松开并停止接触" })).toBeTruthy();
    const next = screen.getByRole("button", { name: "武器大师晋升" });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(next);
    expect(screen.queryByRole("region", { name: "武器大师成长下一步" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "非凡成长" }), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^实际松开原伙伴/ }));
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "武器大师晋升" }));
    expect(screen.getByRole("region", { name: "武器大师成长下一步" })).toBeTruthy();
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
  });

  it.each(["CONSUME", "PREPARE", "PERFORM", "REPORT", "WITHDRAW", "BORROW_TOOL", "RETURN_TOOL"] as const)("retries the identical failed %s envelope without a duplicate action", async (type) => {
    const consuming = type === "CONSUME";
    const cmd: WeaponmasterCommand = consuming ? { type: "CONSUME", bottleId: "weaponmaster-potion-2", confirmed: true }
      : type === "PREPARE" ? { type, caseId: "weapon-fit", method: "TECHNIQUE" }
        : type === "BORROW_TOOL" || type === "RETURN_TOOL" ? { type } : { type, caseId: "weapon-fit" };
    const list = cases();
    list[0]!.status = type === "REPORT" ? "EXAMINED" : type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(consuming ? 8 : 7, {
      weaponmaster: consuming ? bottled() : weaponmaster({ promoted: true, cases: list, actions: [action(cmd)] }),
      actionsRemaining: 0, canAct: false, health: type === "WITHDRAW" ? 0 : 76,
      mind: type === "WITHDRAW" ? 0 : 88, actionBlockedReason: "领域当前不可进行主要行动。",
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, weaponmaster: { ...state.weaponmaster, actions: [], cases: list.map((entry) => entry.id === "weapon-fit" && type === "REPORT" ? { ...entry, status: "RESOLVED", result: "本次练习报告已提交" } : entry) } }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openWeaponmaster();
    if (consuming) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶武器大师魔药」/ }));
    const name = consuming ? "确认服用「第二瓶武器大师魔药」" : new RegExp(`^${action(cmd).label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "武器大师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("武器大师模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "WEAPONMASTER", command: cmd });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    if (!consuming) expect((screen.getByRole("combobox", { name: "选择武器实践情境" }) as HTMLSelectElement).value).toBe("weapon-fit");
  });
});
