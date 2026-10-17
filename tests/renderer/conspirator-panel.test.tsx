/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConspiratorAction, ConspiratorCommand, ConspiratorProjection } from "../../src/domain/conspirator/types";
import type { PyromaniacProjection } from "../../src/domain/pyromaniac/types";
import { ConspiratorPanel, ConspiratorPyromaniacHistory } from "../../src/renderer/ConspiratorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染以已提交结果为准。";
function action(command: ConspiratorCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): ConspiratorAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取阴谋家成品用药指导", true, "360便士 · 1行动");
function conspirator(patch: Partial<ConspiratorProjection> = {}): ConspiratorProjection {
  return {
    title: "阴谋家晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "纵火家扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function cases(): ConspiratorProjection["cases"] {
  return [
    { id: "warehouse-rosters", title: "仓库排班核对", story: "原排班单只证明已公开的时间和人员安排。" },
    { id: "rejected-detour", title: "被拒绝的绕行", story: "对方会自行评估负担，提出方案不能保证同意。" },
    { id: "urgent-handover", title: "紧急交接的备选", story: "主计划失效后须按实际条件选择备选。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): ConspiratorProjection {
  const originals = [
    { id: "conspirator-potion-1", title: "第一瓶阴谋家魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "conspirator-potion-2", title: "第二瓶阴谋家魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "conspirator-potion-3", title: "第三瓶阴谋家魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return conspirator({ guidanceKnown: true,
    supplies: "原三瓶独立成品，不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): ConspiratorProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const refusal = "首次明确拒绝：这条绕路会耽误我原先答应的交货，我不同意。";
const newFact = "后来实际核实：原交货时间已由当事人另行调整，仍须本人重新评估。";
function opened(): ConspiratorProjection {
  return conspirator({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "rejected-detour" ? {
      ...entry, status: "OBSERVED", observations: ["原交货时间来自本次已核对的单据。", refusal],
      result: "本次方案被明确拒绝，尚未执行绕行。", contactOpen: "本次接触尚未实际结束",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "rejected-detour" }, "实际结束被拒绝的绕行交谈", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: ConspiratorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ConspiratorPanel conspirator={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Conspirator public plans, autonomous refusals and original-bottle confirmation", () => {
  it("shows the public S7 maturity gate and sourced finished supply without inventing an unknown formula", () => {
    const reason = "纵火家扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const value = conspirator({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "阴谋家成长下一步" }).textContent).toContain(reason);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取阴谋家成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact public guidance, per-bottle labour, payment and resupply commands with public costs", async () => {
    const commands: ConspiratorCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "conspirator-potion-3" },
      { type: "BUY_POTION", bottleId: "conspirator-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(conspirator({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels an original-bottle confirmation at zero AP and returns keyboard focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶阴谋家魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶阴谋家魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶阴谋家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶阴谋家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶阴谋家魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows exact source, risk and current resources before independently confirming only the selected bottle once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶阴谋家魔药」" }));
    expect(screen.getByText("conspirator-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "阴谋家服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶阴谋家魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "conspirator-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted original through save failure and leaves envelope retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶阴谋家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶阴谋家魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<ConspiratorPanel conspirator={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect(screen.getByRole("region", { name: "这瓶阴谋家魔药的服用确认" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶阴谋家魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("conspirator-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<ConspiratorPanel conspirator={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves a committed failed original as history and independently offers the remaining bottles", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶阴谋家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶阴谋家魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<ConspiratorPanel conspirator={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶阴谋家魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶阴谋家魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("conspirator-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only when a committed promotion arrives and preserves the consumed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶阴谋家魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶阴谋家魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升阴谋家" } : bottle) };
    rerender(<ConspiratorPanel conspirator={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶阴谋家魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "阴谋家能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升阴谋家")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects cases and forwards only their exact public commands without optimistic preparation or agreement", async () => {
    const commands: ConspiratorCommand[] = [{ type: "OBSERVE", caseId: "urgent-handover" },
      { type: "PREPARE", caseId: "urgent-handover", method: "ORDINARY" },
      { type: "PREPARE", caseId: "urgent-handover", method: "ABILITY" },
      { type: "PERFORM", caseId: "urgent-handover" }, { type: "WITHDRAW", caseId: "urgent-handover" }, { type: "REPORT", caseId: "urgent-handover" }];
    const labels = ["核对已知交接事实", "准备普通备选", "准备有限谋划", "实际提出方案", "撤回待执行方案", "提交有限报告"];
    const { onCommand } = panel(conspirator({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "warehouse-rosters");
    expect(screen.queryByRole("button", { name: /^实际提出方案/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "urgent-handover");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "有条件方案与准备" }).textContent).toContain("当前没有待执行的方案");
    expect(screen.queryByRole("region", { name: "对方自主评估与实际结果" })).toBeNull();
  });

  it("keeps the true first refusal through actual CLOSE, new evidence, revision and a later failed attempt", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(refusal)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束被拒绝/ }));
    expect(screen.getByText(refusal)).toBeTruthy();
    const closed = { ...value, insideCase: false, actions: [action({ type: "PREPARE", caseId: "rejected-detour", method: "ABILITY" }, "按实际新事实修订方案")],
      cases: value.cases.map((entry) => entry.id === "rejected-detour" ? { ...entry, contactOpen: "已实际结束", closes: 1, observations: [...entry.observations, newFact] } : entry) };
    rerender(<ConspiratorPanel conspirator={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(refusal)).toBeTruthy(); expect(screen.getByText(newFact)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^按实际新事实修订/ }));
    expect(screen.getByRole("region", { name: "对方自主评估与实际结果" }).textContent).toContain("本次方案被明确拒绝");
    const revised = { ...closed, cases: closed.cases.map((entry) => entry.id === "rejected-detour" ? {
      ...entry, preparation: "按真实新时间修订方案，仍须对方自主评估。", result: "修订后仍未获接受，保留原拒绝与本次失败。",
    } : entry) };
    rerender(<ConspiratorPanel conspirator={revised} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(refusal)).toBeTruthy(); expect(screen.getByText(newFact)).toBeTruthy();
    expect(screen.getByRole("region", { name: "对方自主评估与实际结果" }).textContent).toContain("修订后仍未获接受");
    expect(screen.getByRole("region", { name: "有条件方案与准备" }).textContent).toContain("仍须对方自主评估");
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "CLOSE", caseId: "rejected-detour" }, { type: "PREPARE", caseId: "rejected-detour", method: "ABILITY" }]);
  });

  it("selects the actual open case and exposes only its authoritative CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(conspirator({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "urgent-handover");
    const value = opened();
    rerender(<ConspiratorPanel conspirator={{ ...value, actions: [action({ type: "CLOSE", caseId: "warehouse-rosters" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "rejected-detour" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "rejected-detour" }, "不可撤回代替结束"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_TALK" }, "不可提前赴后门"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("rejected-detour"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束被拒绝/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "rejected-detour" });
    expect(screen.getByText(refusal)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
  });

  it("does not manufacture CLOSE from prose or treat old refusal text as an active contact", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "阴谋家成长下一步" }).textContent).toContain("查看当前公开结束选项");
    // Without a public CLOSE, refusal prose must not select an allegedly active case.
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("warehouse-rosters");
    rerender(<ConspiratorPanel conspirator={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "rejected-detour");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(refusal)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("disables public interactions while busy, blocked or waiting on a save error without changing resources", () => {
    const value = conspirator({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "warehouse-rosters" }, "核对原排班"), action({ type: "REFLECT" }, "复盘实际结果")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<ConspiratorPanel conspirator={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders only public mastery and textual capability limits without a controlled-person or success effect", () => {
    const abilities = [{ id: "hunter.s6.reasoning-plan", label: "有依据的谋划", mastery: 23, description: "依赖已核实的信息，错误前提会导致失败。" },
      { id: "hunter.s7.flame-control", label: "原火焰操控", mastery: 81, description: "沿用原火焰能力公开条件。" }];
    panel(conspirator({ promoted: true, acting: 100, abilities, actions: [], cases: cases() }));
    expect(screen.getByText("有依据的谋划 · 掌握 23")).toBeTruthy(); expect(screen.getByText("原火焰操控 · 掌握 81")).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "阴谋家能力边界" });
    expect(boundary.textContent).toContain("三项主实践可和平完成");
    expect(boundary.textContent).toContain("不会自动让人降智");
    expect(boundary.textContent).toContain("木偶控制与收割者的弱点击杀不属于本阶段新增能力");
    expect(screen.queryByRole("button", { name: /控制|降智|弱点击杀/ })).toBeNull();
    expect(document.querySelector("audio, [data-controlled], .conspirator-success")).toBeNull();
  });

  it("keeps the optional back-door encounter separate from three cases and forwards talk or ordinary combat choices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴后门核实后交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴后门承担普通短棍战", true, "1行动 · 真实战斗风险");
    const environment = "原后门有2米可见净空通路；原货物仍属于货主。";
    const { onCommand } = panel(conspirator({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限后门冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴后门核实后交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴后门承担普通短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "对方自主评估与实际结果" })).toBeNull();
    expect(screen.getByText(environment)).toBeTruthy();
  });

  it("preserves S7 practice failures, fire mastery and original-bottle sources as read-only history", () => {
    const pyromaniac: PyromaniacProjection = {
      title: "纵火家", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原纵火家库存与耗用记录保留。", story: "原货道争执已和平收尾。", environment: "原安全通路与火种准备记录。",
      practices: [{ id: "old-fire", title: "原压缩火球练习", story: "原尝试失败，实际消耗3灵性；下周重新尝试后完成。", status: "已完成，原失败保留" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "pyromaniac-old", title: "纵火家旧原瓶", source: "纵火家原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "pyromaniac-old", confirmed: true } }],
      abilities: [{ id: "hunter.s7.flame-control", label: "原火焰操控", mastery: 67, description: "保留原有限火焰规则。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<ConspiratorPyromaniacHistory pyromaniac={pyromaniac} />);
    const history = within(screen.getByRole("region", { name: "纵火家时期的经历" }));
    expect(history.getByText("原尝试失败，实际消耗3灵性；下周重新尝试后完成。")).toBeTruthy();
    expect(history.getByText("来源：纵火家原独立成品渠道")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原火焰操控 · 掌握 67：保留原有限火焰规则。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
