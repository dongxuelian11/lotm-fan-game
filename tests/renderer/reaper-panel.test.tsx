/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReaperAction, ReaperCommand, ReaperProjection } from "../../src/domain/reaper/types";
import type { ConspiratorProjection } from "../../src/domain/conspirator/types";
import { ReaperConspiratorHistory, ReaperPanel } from "../../src/renderer/ReaperPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；阴谋家消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: ReaperCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): ReaperAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取收割者成品用药指导", true, "420便士 · 1行动");
function reaper(patch: Partial<ReaperProjection> = {}): ReaperProjection {
  return {
    title: "收割者晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "阴谋家扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function cases(): ReaperProjection["cases"] {
  return [
    { id: "timber-seam", title: "原木接缝", story: "只观察原木已有的接缝，原木归场地主人所有。" },
    { id: "moving-shutter", title: "移动挡片窗口", story: "原挡片由成年教练操作，只有真实信号才打开本次窗口。" },
    { id: "guarded-flame", title: "原耐火靶", story: "原火焰与靶都有条件，不能预先宣告穿透或击毁。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0, windowOpen: "当前没有已打开的窗口", practice: "实际尝试0次，原器材留在原处。" }));
}
function bottled(): ReaperProjection {
  const originals = [
    { id: "reaper-potion-1", title: "第一瓶收割者魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "reaper-potion-2", title: "第二瓶收割者魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "reaper-potion-3", title: "第三瓶收割者魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return reaper({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4600便士，每瓶五次劳务抵4000，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): ReaperProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：本次没有命中薄弱处，实际消耗3灵性，原器材仍归原主。";
function opened(): ReaperProjection {
  return reaper({ promoted: true, insideCase: true, actions: [
    action({ type: "CLOSE", caseId: "moving-shutter" }, "实际结束窗口并退出", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "PERFORM", caseId: "moving-shutter" }, "实际执行本次打击", true, "1行动 · 本次实际成本"),
    action({ type: "WITHDRAW", caseId: "moving-shutter" }, "撤回尚未实施的准备", true, "0行动 · 保留原成本"),
  ], cases: cases().map((entry) => entry.id === "moving-shutter" ? {
    ...entry, status: "PREPARED", observations: ["本次已核对原挡片运动与安全范围。", failure],
    preparation: "已准备本次方法，仍须真实窗口与实际执行。", contactOpen: "本次窗口尚未实际收束",
    windowOpen: "原挡片窗口已打开，尚未实际使用", practice: "已实际发出1次信号，实际使用0次，原失败与3灵性消耗保留。",
  } : entry) });
}
function panel(value: ReaperProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ReaperPanel reaper={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Reaper public windows, original bottles and read-only history", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "阴谋家扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4600便士。";
    const { onCommand } = panel(reaper({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "收割者成长下一步" });
    expect(summary.textContent).toContain("阴谋家6 → 收割者5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方与晋升仪式尚未核实");
    expect(summary.textContent).toContain("不能据此断言无需仪式");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取收割者成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: ReaperCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "reaper-potion-3" },
      { type: "BUY_POTION", bottleId: "reaper-potion-3" }, { type: "BUY_POTION", bottleId: "reaper-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["420便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4000便士", "600便士 · 0行动", "4600便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(reaper({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["reaper-potion-1", "reaper-potion-2", "reaper-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "reaper-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("reaper-potion-2"));
    expect(screen.getByText("reaper-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "收割者服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶收割者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "收割者能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("reaper-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶收割者魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<ReaperPanel reaper={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶收割者魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("reaper-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<ReaperPanel reaper={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<ReaperPanel reaper={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶收割者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶收割者魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("reaper-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶收割者魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<ReaperPanel reaper={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*reaper-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("reaper-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("reaper-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶收割者魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("reaper-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶收割者魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升收割者" } : bottle) };
    rerender(<ReaperPanel reaper={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶收割者魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "收割者能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升收割者")).toBeTruthy();
    expect(screen.getByText("原瓶ID：reaper-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("reaper-potion-2"));
    expect(screen.getByText("reaper-potion-2")).toBeTruthy();
    rerender(<ReaperPanel reaper={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶收割者魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("reaper-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<ReaperPanel reaper={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶收割者魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects a case and forwards its exact public observation, method, SIGNAL, execution and report intents", async () => {
    const commands: ReaperCommand[] = [{ type: "OBSERVE", caseId: "moving-shutter" },
      { type: "PREPARE", caseId: "moving-shutter", method: "ORDINARY" }, { type: "PREPARE", caseId: "moving-shutter", method: "ABILITY" },
      { type: "SIGNAL", caseId: "moving-shutter" }, { type: "PERFORM", caseId: "moving-shutter" },
      { type: "WITHDRAW", caseId: "moving-shutter" }, { type: "REPORT", caseId: "moving-shutter" }];
    const labels = ["核对原挡片", "准备普通方法", "准备能力方法", "实际发出开窗信号", "实际执行", "撤回准备", "提交有限报告"];
    const { onCommand } = panel(reaper({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "timber-seam");
    expect(screen.queryByRole("button", { name: /^实际发出开窗信号/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "moving-shutter");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.getByText("当前没有已打开的窗口")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "收割者实际结果" })).toBeNull();
  });

  it("never invents SIGNAL from window prose and respects its public disabled reason", async () => {
    const value = reaper({ promoted: true, cases: cases(), actions: [] }); const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "moving-shutter");
    expect(screen.getByText("当前没有已打开的窗口")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    const signal = { ...action({ type: "SIGNAL", caseId: "moving-shutter" }, "请教练实际打开窗口", false), reason: "先实际核对并准备本次方法。" };
    rerender(<ReaperPanel reaper={{ ...value, actions: [signal] }} resources={resources} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: /^请教练实际打开窗口/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(button.getAttribute("aria-describedby")).toBe(`reaper-reason-${signal.id}`);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText("当前没有已打开的窗口")).toBeTruthy();
  });

  it("keeps permitted in-scene actions visible and permits both public zero-resource exit intents", async () => {
    const { onCommand, rerender } = panel(reaper({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "guarded-flame");
    const value = opened(); value.actions = [action({ type: "CLOSE", caseId: "timber-seam" }, "旧案不能结束", false),
      action({ type: "PERFORM", caseId: "moving-shutter" }, "实际执行本次打击", false, "1行动 · 本次实际成本"),
      action({ type: "WITHDRAW", caseId: "moving-shutter" }, "撤回尚未实施的准备", true, "0行动 · 保留原成本"),
      action({ type: "SIGNAL", caseId: "moving-shutter" }, "公开的现场信号", false, "本次窗口不可叠加")];
    rerender(<ReaperPanel reaper={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("moving-shutter"); expect(selector.disabled).toBe(true);
    const choices = within(screen.getByRole("group", { name: "当前收割者实践行动" }));
    expect(choices.getByRole("button", { name: /^实际执行本次打击/ })).toBeTruthy();
    expect(choices.getByRole("button", { name: /^公开的现场信号/ })).toBeTruthy();
    const withdraw = choices.getByRole("button", { name: /^撤回尚未实施的准备/ }) as HTMLButtonElement;
    expect(withdraw.disabled).toBe(false); await userEvent.click(withdraw);
    expect(screen.getByText("原挡片窗口已打开，尚未实际使用")).toBeTruthy();
    expect(screen.getByText(failure)).toBeTruthy();
    const contact = { ...value, actions: [action({ type: "CLOSE", caseId: "moving-shutter" }, "实际结束练习并退出", true, "0行动 · 0精神 · 0灵性")],
      cases: value.cases.map((entry) => entry.id === "moving-shutter" ? { ...entry, windowOpen: "原窗口已消耗，本次接触尚未结束" } : entry) };
    rerender(<ReaperPanel reaper={contact} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const close = screen.getByRole("button", { name: /^实际结束练习并退出/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close);
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "WITHDRAW", caseId: "moving-shutter" }, { type: "CLOSE", caseId: "moving-shutter" }]);
    expect(screen.getByText(failure)).toBeTruthy();
  });

  it("does not infer active contact or manufacture exit controls from historical text", async () => {
    const value = { ...opened(), insideCase: false, actions: [] }; const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("timber-seam"); expect(selector.disabled).toBe(false);
    await userEvent.selectOptions(selector, "moving-shutter");
    expect(screen.getByText("原挡片窗口已打开，尚未实际使用")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<ReaperPanel reaper={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "收割者成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves original observations and failure through a committed close and a later report", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际结束窗口并退出/ }));
    const closed = { ...value, insideCase: false, actions: [action({ type: "REPORT", caseId: "moving-shutter" }, "提交本次有限记录")],
      cases: value.cases.map((entry) => entry.id === "moving-shutter" ? { ...entry, status: "EXAMINED", closes: 1,
        windowOpen: "本次原窗口已实际关闭", contactOpen: "本次接触已实际结束", result: "后一次实际命中靶的可见薄弱处，原失败不删除。" } : entry) };
    rerender(<ReaperPanel reaper={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(failure)).toBeTruthy(); expect(screen.getByText("本次原窗口已实际关闭")).toBeTruthy();
    expect(screen.getByRole("region", { name: "收割者实际结果" }).textContent).toContain("原失败不删除");
    await userEvent.click(screen.getByRole("button", { name: /^提交本次有限记录/ }));
    expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "CLOSE", caseId: "moving-shutter" }, { type: "REPORT", caseId: "moving-shutter" }]);
  });

  it("locks submissions for busy, real blocking or save errors without hiding committed window evidence", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<ReaperPanel reaper={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("原挡片窗口已打开，尚未实际使用")).toBeTruthy();
      expect(screen.getByText(failure)).toBeTruthy(); expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows non-retryable persistence recovery without making a new domain retry action", () => {
    const onCommand = vi.fn();
    render(<ReaperPanel reaper={reaper({ actions: [learn] })} resources={resources} busy={false}
      error={{ message: "存档版本已变化。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^听取收割者成品用药指导/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders public mastery and bounded weakness practice without adding artifact or S4 commands", () => {
    const abilities = [{ id: "hunter.s5.weakness-observation", label: "弱点观察", mastery: 23, description: "只根据实际观察寻找薄弱处，可能失败。" },
      { id: "hunter.s7.flame-control", label: "原火焰操控", mastery: 81, description: "沿用原火焰能力公开条件。" }];
    panel(reaper({ promoted: true, acting: 100, abilities, actions: [], cases: cases() }));
    expect(screen.getByText("弱点观察 · 掌握 23")).toBeTruthy(); expect(screen.getByText("原火焰操控 · 掌握 81")).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "收割者扮演进度" }) as HTMLProgressElement).value).toBe(100);
    const boundary = screen.getByLabelText("收割者能力边界");
    expect(boundary.textContent).toContain("发现弱点也不等于命中");
    expect(boundary.textContent).toContain("丧钟物品的三枪、5秒");
    expect(boundary.textContent).toContain("序列4的火焰化");
    expect(screen.queryByRole("button", { name: /必杀|丧钟|火焰化|团队连接/ })).toBeNull();
  });

  it("keeps the optional encounter separate and forwards exact talk and fight choices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴原院核对后交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴原院承担真实冲突", true, "1行动 · 真实伤势与死亡风险");
    const environment = "原院出口可见，双方原器材仍归原主。";
    const { onCommand } = panel(reaper({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "收割者有限冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴原院核对后交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴原院承担真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "收割者实际结果" })).toBeNull();
  });

  it("preserves all three S6 cases, original refusals, revisions, bottles and mastery as read-only history", () => {
    const conspirator: ConspiratorProjection = {
      title: "阴谋家", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "阴谋家原供货记录保留。", story: "旧三案已经和平收尾。", environment: "旧现场原记录。",
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: ["warehouse-rosters", "rejected-detour", "urgent-handover"].map((id, index) => ({ id, title: `阴谋家原案${index + 1}`,
        story: `原案${index + 1}的真实经过。`, status: "RESOLVED", observations: index === 1 ? ["原拒绝：对方不同意原绕路。", "原新事实：下一周已核对新的交货时间。"] : [],
        preparation: index === 1 ? "曾按真实新事实修订，仍可能失败。" : null,
        result: `原案${index + 1}报告已提交，原失败与消耗保留。`, contactOpen: "已实际结束", closes: index + 1 })),
      bottles: [{ id: "conspirator-potion-2", title: "阴谋家旧原瓶", source: "阴谋家原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "conspirator-potion-2", confirmed: true } }],
      abilities: [{ id: "hunter.s6.reasoning-plan", label: "原有据谋划", mastery: 67, description: "原方案须按事实与本人意愿评估。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<ReaperConspiratorHistory conspirator={conspirator} />);
    const history = within(screen.getByRole("region", { name: "阴谋家时期的经历" }));
    for (const entry of conspirator.cases) expect(history.getByText(`原案卷ID：${entry.id}`)).toBeTruthy();
    expect(history.getByText("原拒绝：对方不同意原绕路。")).toBeTruthy();
    expect(history.getByText("原新事实：下一周已核对新的交货时间。")).toBeTruthy();
    expect(history.getByText("原瓶ID：conspirator-potion-2")).toBeTruthy();
    expect(history.getByText("来源：阴谋家原独立成品渠道")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原有据谋划 · 掌握 67：原方案须按事实与本人意愿评估。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
