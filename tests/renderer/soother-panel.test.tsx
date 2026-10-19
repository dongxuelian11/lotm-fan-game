/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SootherAction, SootherCommand, SootherProjection } from "../../src/domain/soother/types";
import type { NightmareProjection } from "../../src/domain/nightmare/types";
import { SootherPanel, SootherNightmareHistory } from "../../src/renderer/SootherPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可按公开休养与补给继续恢复。";
function action(command: SootherCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): SootherAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取安魂师成品用药指导", true, "360便士 · 1行动");
function soother(patch: Partial<SootherProjection> = {}): SootherProjection {
  return {
    title: "安魂师晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "梦魇扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function cases(): SootherProjection["cases"] {
  return [
    { id: "restless-wolf", title: "不安的野狼幽魂", story: "原导师请你观察一只野狼幽魂，先保留距离，再尝试有限平复。" },
    { id: "echo-at-wall", title: "窗边墙上的残影", story: "原窗框仍在，残影的来历尚未核实，不能凭印象断言已消除。" },
    { id: "remembered-name", title: "成年家属自愿追忆的名字", story: "成年家属本人愿意谈起一个名字，可以随时停止；追忆不是召回亡者。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): SootherProjection {
  const originals = [
    { id: "soother-potion-1", title: "第一瓶安魂师魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "soother-potion-2", title: "第二瓶安魂师魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "soother-potion-3", title: "第三瓶安魂师魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return soother({ guidanceKnown: true,
    supplies: "原三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货；不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): SootherProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const firstFailure = "首次实际尝试失败：窗口残影过强，本次有限安魂无法平复；原消耗与原残影保留。";
const newFact = "下一周原导师已说明有限对照：保留原窗框，先观察安静时的残影，再只处理可承受的一段。";
function opened(): SootherProjection {
  return soother({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "echo-at-wall" ? {
      ...entry, status: "PREPARED", observations: ["原窗框与现场记录仍在，残影没有因本次安魂消失。", firstFailure],
      preparation: "只尝试已约定的有限平复。", result: "本次有限安魂未能平复窗口残影，须结束能力并实际离场。", contactOpen: "本次接触尚未实际结束",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "echo-at-wall" }, "结束能力并实际离开窗口", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: SootherProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SootherPanel soother={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Soother public boundaries, actual departure and independent originals", () => {
  it("shows the S7 public maturity gate and supply without inventing an unknown formula", () => {
    const reason = "梦魇扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const value = soother({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "安魂师成长下一步" }).textContent).toContain(reason);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取安魂师成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards public guidance, per-bottle labour, payment and supply commands with exact costs", async () => {
    const commands: SootherCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "soother-potion-3" },
      { type: "BUY_POTION", bottleId: "soother-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(soother({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels original-bottle confirmation at zero AP and returns keyboard focus without a command", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶安魂师魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶安魂师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶安魂师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶安魂师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶安魂师魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders public source, risk, success line and resources before confirming only the selected original once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶安魂师魔药」" }));
    expect(screen.getByText("soother-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "安魂师服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶安魂师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "soother-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the submitted original on save failure and leaves same-envelope retry to its outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶安魂师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶安魂师魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<SootherPanel soother={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect(screen.getByRole("region", { name: "这瓶安魂师魔药的服用确认" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶安魂师魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("soother-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<SootherPanel soother={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves a committed failed original and independently offers each remaining bottle", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶安魂师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶安魂师魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<SootherPanel soother={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶安魂师魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶安魂师魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("soother-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after committed promotion and retains the consumed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶安魂师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶安魂师魔药」" }));
    expect(screen.queryByRole("region", { name: "安魂师能力与消化" })).toBeNull();
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升安魂师" } : bottle) };
    rerender(<SootherPanel soother={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶安魂师魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "安魂师能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升安魂师")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects cases and forwards exact public methods without optimistic consent, pacification or reports", async () => {
    const commands: SootherCommand[] = [{ type: "OBSERVE", caseId: "remembered-name" },
      { type: "PREPARE", caseId: "remembered-name", method: "ORDINARY" }, { type: "PREPARE", caseId: "remembered-name", method: "ABILITY" },
      { type: "PERFORM", caseId: "remembered-name" }, { type: "WITHDRAW", caseId: "remembered-name" }, { type: "REPORT", caseId: "remembered-name" }];
    const labels = ["核对成年家属本人的意愿", "准备普通追忆记录", "准备有限安魂", "实际进行有限实践", "撤回待执行准备", "提交有限报告"];
    const { onCommand } = panel(soother({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "restless-wolf");
    expect(screen.queryByRole("button", { name: /^实际进行有限实践/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "remembered-name");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "有限实践与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.queryByRole("region", { name: "有限平复与实际结果" })).toBeNull();
  });

  it("keeps the deterministic first boundary failure through CLOSE and displays later facts only when projected", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.queryByText(newFact)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^结束能力并实际离开窗口/ }));
    expect(screen.getByText(firstFailure)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
    const closed = { ...value, insideCase: false, actions: [action({ type: "PREPARE", caseId: "echo-at-wall", method: "ABILITY" }, "按原导师下周对照修订有限准备")],
      cases: value.cases.map((entry) => entry.id === "echo-at-wall" ? { ...entry, contactOpen: "已实际结束", closes: 1, observations: [...entry.observations, newFact] } : entry) };
    rerender(<SootherPanel soother={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(newFact)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^按原导师下周对照修订/ }));
    expect(screen.getByRole("region", { name: "有限平复与实际结果" }).textContent).toContain("未能平复窗口残影");
    const revised = { ...closed, cases: closed.cases.map((entry) => entry.id === "echo-at-wall" ? {
      ...entry, preparation: "仅处理公开对照中可承受的一段，原窗框仍在。", result: "修订后的有限尝试仍未完成，保留原失败与本次消耗。",
    } : entry) };
    rerender(<SootherPanel soother={revised} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(newFact)).toBeTruthy();
    expect(screen.getByRole("region", { name: "有限平复与实际结果" }).textContent).toContain("修订后的有限尝试仍未完成");
    expect(screen.getByRole("region", { name: "有限实践与准备" }).textContent).toContain("原窗框仍在");
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "CLOSE", caseId: "echo-at-wall" }, { type: "PREPARE", caseId: "echo-at-wall", method: "ABILITY" }]);
  });

  it("locks selection to the actual open case and exposes only its CLOSE with zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(soother({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "remembered-name");
    const value = opened();
    rerender(<SootherPanel soother={{ ...value, actions: [action({ type: "CLOSE", caseId: "restless-wolf" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "echo-at-wall" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "echo-at-wall" }, "不可撤回代替离场"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_TALK" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("echo-at-wall"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^结束能力并实际离开窗口/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "echo-at-wall" });
    expect(screen.getByText(firstFailure)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
  });

  it("does not manufacture CLOSE from failure prose or infer an active contact from old records", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "安魂师成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("restless-wolf");
    rerender(<SootherPanel soother={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "echo-at-wall");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("blocks public interactions while busy, externally blocked or awaiting a failed save", () => {
    const value = soother({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "restless-wolf" }, "核对野狼幽魂的可见动静"), action({ type: "REFLECT" }, "复盘实际结果")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<SootherPanel soother={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    rerender(<SootherPanel soother={opened()} resources={resources} busy={true} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^结束能力并实际离开窗口/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves all three distinct stories and an adult's right to stop without inventing a spirit answer", async () => {
    const value = soother({ promoted: true, cases: cases(), actions: [] }); panel(value);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox"), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "有限平复与实际结果" })).toBeNull();
    }
    expect(screen.queryByText(firstFailure)).toBeNull(); expect(screen.queryByText(newFact)).toBeNull();
    expect(screen.queryByRole("button", { name: /强制|召回|净化|复活/ })).toBeNull();
  });

  it("shows only public ability mastery and keeps pacification, resurrection, sealing and dream-body limits distinct", () => {
    const abilities = [{ id: "darkness.s6.spirit-sight", label: "有限灵体观察", mastery: 23, description: "记录近处实际可见的灵体动静，仍须现实复核。" },
      { id: "darkness.s6.spirit-pacification", label: "有限安魂", mastery: 41, description: "可尝试平复，不保证成功或消除污染。" }];
    const result = "野狼幽魂暂时安静，原灵体仍在；没有净化、收容或命令它。";
    panel(soother({ promoted: true, acting: 100, abilities, actions: [], cases: cases().map((entry) => ({ ...entry, result: entry.id === "restless-wolf" ? result : null })) }));
    expect(screen.getByText("有限灵体观察 · 掌握 23")).toBeTruthy(); expect(screen.getByText("有限安魂 · 掌握 41")).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "安魂师能力边界" });
    for (const text of ["三项主实践可和平完成", "成年家属本人自愿追忆", "不保证净化全部污染", "本人可以停止", "本体仍不能移动", "清醒后核实", "封灵、收容与驱使灵体不属于本阶段能力"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(result)).toBeTruthy();
    expect(document.querySelector("audio, [data-spirit-truth], .soother-success")).toBeNull();
  });

  it("keeps optional conflict separate and forwards only public talk or ordinary combat choices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与现场持棍者交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担普通短棍战", true, "1行动 · 真实战斗风险");
    const environment = "原现场仍有净空通路，原货物属于货主，旁观者已离开。";
    const { onCommand } = panel(soother({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限现场冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^与现场持棍者交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担普通短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "有限平复与实际结果" })).toBeNull();
    expect(screen.getByText(environment)).toBeTruthy();
  });

  it("keeps old dream accounts, waking reports, source IDs, bottles and abilities entirely read-only", () => {
    const nightmare: NightmareProjection = {
      title: "梦魇", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原梦魇库存与耗用记录保留。", story: "原后院冲突已和平结束。", environment: "本体当时留在原守护者身旁。",
      cases: [{ id: "letter-at-window", title: "原窗边梦境", story: "首次入梦失败，已花灵性保留；下周经本人同意重做。", status: "RESOLVED",
        observations: ["成年人本人只同意核对窗边片段。"], dreamRecord: "梦里似乎见到信封，仍只是本人体验。", result: "清醒后以原记录核实，信封内容仍未知。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "nightmare-old", title: "梦魇旧原瓶", source: "梦魇原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "nightmare-old", confirmed: true } }],
      abilities: [{ id: "darkness.s7.dream-entry", label: "原限定入梦", mastery: 67, description: "本体仍不能移动，梦境不保证真实。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<SootherNightmareHistory nightmare={nightmare} />);
    const history = within(screen.getByRole("region", { name: "梦魇时期的经历" }));
    for (const text of ["首次入梦失败，已花灵性保留；下周经本人同意重做。", "成年人本人只同意核对窗边片段。", "原梦境ID：letter-at-window", "原瓶ID：nightmare-old",
      "当时的梦中记录：梦里似乎见到信封，仍只是本人体验。", "当时的核实与报告：清醒后以原记录核实，信封内容仍未知。", "来源：梦魇原独立成品渠道", "已耗用 · 原失败保留",
      "原限定入梦 · 掌握 67：本体仍不能移动，梦境不保证真实。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });

  it("honors public disabled reasons even with ample resources and never creates missing actions", () => {
    const reason = "原导师尚未公开下一周的有限对照。";
    const prepare = { ...action({ type: "PREPARE", caseId: "echo-at-wall", method: "ABILITY" }, "修订窗口残影准备", false), reason };
    const { onCommand } = panel(soother({ promoted: true, cases: cases(), actions: [prepare] }));
    const selector = screen.getByRole("combobox");
    fireEvent.change(selector, { target: { value: "echo-at-wall" } });
    const button = screen.getByRole("button", { name: /^修订窗口残影准备/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /立即净化|重置残影|结束能力/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public bottle eligibility and risk in an open confirmation without calculating a local result", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶安魂师魔药」" }));
    const reason = "当前服药条件已变化，须先恢复精神。";
    const updated = { ...value, risk: "当前公共风险：原瓶仍在，未进行任何判定。", bottles: value.bottles.map((bottle) => bottle.id === "soother-potion-2" ? { ...bottle, chance: 19 } : bottle),
      actions: value.actions.map((entry) => entry.command.type === "CONSUME" && entry.command.bottleId === "soother-potion-2" ? { ...entry, enabled: false, reason } : entry) };
    rerender(<SootherPanel soother={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶安魂师魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "安魂师能力与消化" })).toBeNull();
  });
});
