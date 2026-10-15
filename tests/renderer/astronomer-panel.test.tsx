/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AstronomerAction, AstronomerCommand, AstronomerProjection } from "../../src/domain/astronomer/types";
import type { ArtisanProjection } from "../../src/domain/artisan/types";
import { AstronomerArtisanHistory, AstronomerPanel } from "../../src/renderer/AstronomerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；工匠消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: AstronomerCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): AstronomerAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取天文学家成品用药指导", true, "440便士 · 1行动");
function astronomer(patch: Partial<AstronomerProjection> = {}): AstronomerProjection {
  return {
    title: "天文学家晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "工匠扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, ...patch,
  };
}
function cases(): AstronomerProjection["cases"] {
  return [
    { id: "catalogue-check", title: "有来源的星表", story: "核对原星表及可追查的抄录来源。" },
    { id: "instrument-drift", title: "原仪器偏差", story: "原仪器留在原观测楼顶，须以真实工具手动调整。" },
    { id: "night-measurement", title: "下一真实周夜访", story: "须等校准后的实际下一周，再亲赴楼顶完成当晚有限观测。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): AstronomerProjection {
  const originals = [
    { id: "astronomer-potion-1", title: "第一瓶天文学家魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "astronomer-potion-2", title: "第二瓶天文学家魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "astronomer-potion-3", title: "第三瓶天文学家魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return astronomer({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4700便士，每瓶五次劳务抵4100，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): AstronomerProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：本次读数核对未通过，实际消耗3灵性，原仪器仍留在原屋顶。";
function opened(): AstronomerProjection {
  return astronomer({ promoted: true, insideCase: true, actions: [
    action({ type: "PERFORM", caseId: "instrument-drift" }, "实际手动校准原仪器", true, "1行动 · 本次实际成本"),
    action({ type: "CLOSE", caseId: "instrument-drift" }, "实际结束校准并退出", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "WITHDRAW", caseId: "instrument-drift" }, "撤回尚未实施的准备", true, "0行动 · 保留原成本"),
  ], cases: cases().map((entry) => entry.id === "instrument-drift" ? {
    ...entry, status: "PREPARED", observations: ["本次已核对原仪器存在偏差。", failure],
    preparation: "已准备本次方法，尚须真实手动调整。", contactOpen: "本次接触尚未实际结束",
  } : entry), practice: { instrumentOffset: 2, calibratedWeek: null, observedWeek: null, measurements: 0 } });
}
function panel(value: AstronomerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<AstronomerPanel astronomer={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Astronomer finite measurements, original bottles and read-only artisan history", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "工匠扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4700便士。";
    const { onCommand } = panel(astronomer({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "天文学家成长下一步" });
    expect(summary.textContent).toContain("工匠6 → 天文学家5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("当前渠道只提供独立成品魔药，不提供完整配方、材料、剂量或调配顺序。完整晋升仪式与具体法术清单尚未掌握，不能据此断言无需仪式。本阶段服药须完成普通导师准备与指导流程。");
    expect(summary.textContent).toContain("不能据此断言无需仪式");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取天文学家成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: AstronomerCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "astronomer-potion-3" },
      { type: "BUY_POTION", bottleId: "astronomer-potion-3" }, { type: "BUY_POTION", bottleId: "astronomer-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["440便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4100便士", "600便士 · 0行动", "4700便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(astronomer({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["astronomer-potion-1", "astronomer-potion-2", "astronomer-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "astronomer-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("astronomer-potion-2"));
    expect(screen.getByText("astronomer-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByText("本次只确认指导流程中的这一成品原瓶。完整配方、晋升仪式与具体法术清单尚未掌握，不能据此断言无需仪式。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "天文学家服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶天文学家魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "天文学家能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("astronomer-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶天文学家魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<AstronomerPanel astronomer={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶天文学家魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("astronomer-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<AstronomerPanel astronomer={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<AstronomerPanel astronomer={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶天文学家魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶天文学家魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("astronomer-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶天文学家魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<AstronomerPanel astronomer={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*astronomer-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("astronomer-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("astronomer-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶天文学家魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("astronomer-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶天文学家魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升天文学家" } : bottle) };
    rerender(<AstronomerPanel astronomer={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶天文学家魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "天文学家能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升天文学家")).toBeTruthy();
    expect(screen.getByText("原瓶ID：astronomer-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("astronomer-potion-2"));
    expect(screen.getByText("astronomer-potion-2")).toBeTruthy();
    rerender(<AstronomerPanel astronomer={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶天文学家魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("astronomer-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<AstronomerPanel astronomer={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶天文学家魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards selected-case public methods and results without applying optimistic calibration", async () => {
    const commands: AstronomerCommand[] = [{ type: "OBSERVE", caseId: "instrument-drift" },
      { type: "PREPARE", caseId: "instrument-drift", method: "ORDINARY" },
      { type: "PREPARE", caseId: "instrument-drift", method: "ABILITY" },
      { type: "PERFORM", caseId: "instrument-drift" }, { type: "WITHDRAW", caseId: "instrument-drift" },
      { type: "CLOSE", caseId: "instrument-drift" }, { type: "REPORT", caseId: "instrument-drift" }];
    const labels = ["核对原刻度", "准备普通手动方法", "准备短时专注方法", "实际手动校准", "撤回准备", "结束校准", "提交有限报告"];
    const value = astronomer({ promoted: true, cases: cases(), practice: { instrumentOffset: 2, calibratedWeek: null, observedWeek: null, measurements: 0 },
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "catalogue-check");
    expect(screen.queryByRole("button", { name: /^实际手动校准/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "instrument-drift");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.getByText("尚未完成实际校准")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "天文学家实际结果" })).toBeNull();
  });

  it("prioritizes enabled CLOSE then WITHDRAW at zero resources without locking other public in-scene intents", async () => {
    const { onCommand, rerender } = panel(astronomer({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "night-measurement");
    const value = opened();
    rerender(<AstronomerPanel astronomer={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("instrument-drift"); expect(selector.disabled).toBe(true);
    const summary = screen.getByRole("region", { name: "天文学家成长下一步" });
    expect(summary.textContent).toContain("下一步：实际结束校准并退出");
    const close = screen.getByRole("button", { name: /^实际结束校准并退出/ }) as HTMLButtonElement;
    const perform = screen.getByRole("button", { name: /^实际手动校准原仪器/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(perform.disabled).toBe(false);
    expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(perform); await userEvent.click(close);
    const onlyWithdraw = { ...value, actions: [action({ type: "CLOSE", caseId: "catalogue-check" }, "旧案不能结束", false),
      action({ type: "PERFORM", caseId: "instrument-drift" }, "现在不能校准", false), value.actions[2]!] };
    rerender(<AstronomerPanel astronomer={onlyWithdraw} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(summary.textContent).toContain("下一步：撤回尚未实施的准备");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("instrument-drift");
    const withdraw = screen.getByRole("button", { name: /^撤回尚未实施的准备/ }) as HTMLButtonElement;
    expect(withdraw.disabled).toBe(false); await userEvent.click(withdraw);
    expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[1]!.command, value.actions[2]!.command]);
  });

  it("never infers active contact, new ritual steps or exit commands from historical prose", async () => {
    const value = { ...opened(), insideCase: false, actions: [] }; const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("catalogue-check"); expect(selector.disabled).toBe(false);
    await userEvent.selectOptions(selector, "instrument-drift");
    expect(screen.getByText(failure)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    rerender(<AstronomerPanel astronomer={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "天文学家成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders only committed calibration and night-visit facts, with a real next-week gate and no forecast", () => {
    const reason = "校准报告已提交；须等实际下一周才能亲赴原屋顶夜访。";
    const visit = { ...action({ type: "OBSERVE", caseId: "night-measurement" }, "赴原屋顶实际夜访", false), reason };
    const value = astronomer({ promoted: true, cases: cases(), actions: [visit],
      practice: { instrumentOffset: 0, calibratedWeek: 54, observedWeek: null, measurements: 0 } });
    const { onCommand, rerender } = panel(value);
    const practice = screen.getByRole("region", { name: "天文学家仪器与实际观测记录" });
    expect(practice.textContent).toContain("第54周"); expect(practice.textContent).toContain("尚未完成实际夜访");
    expect(practice.textContent).toContain("真实工具手动校准"); expect(practice.textContent).toContain("实际下一周");
    expect(practice.textContent).toContain("记录不能保证未来天象或未来事件");
    expect(practice.textContent).not.toContain("第55周");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "night-measurement" } });
    const disabled = screen.getByRole("button", { name: /^赴原屋顶实际夜访/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`astronomer-reason-${visit.id}`);
    fireEvent.click(disabled); expect(onCommand).not.toHaveBeenCalled();
    rerender(<AstronomerPanel astronomer={{ ...value, actions: [], practice: { instrumentOffset: 0, calibratedWeek: 54, observedWeek: 56, measurements: 1 } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(practice.textContent).toContain("第56周"); expect(practice.textContent).toContain("已保存测量次数1");
    rerender(<AstronomerPanel astronomer={{ ...value, practice: null }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "天文学家仪器与实际观测记录" })).toBeNull();
  });

  it("preserves failure and source records through committed close and later report", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际结束校准并退出/ }));
    const closed = { ...value, insideCase: false, actions: [action({ type: "REPORT", caseId: "instrument-drift" }, "提交本次有限校准记录")],
      cases: value.cases.map((entry) => entry.id === "instrument-drift" ? { ...entry, status: "EXAMINED", closes: 1,
        contactOpen: "本次接触已实际结束", result: "后来已用原螺丝刀实际调整；原失败与消耗保留。" } : entry),
      practice: { instrumentOffset: 0 as const, calibratedWeek: 54, observedWeek: null, measurements: 0 } };
    rerender(<AstronomerPanel astronomer={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.getByRole("region", { name: "天文学家实际结果" }).textContent).toContain("原失败与消耗保留");
    expect(screen.getByRole("region", { name: "当前天文学家实践" }).textContent).toContain("实际结束次数：1");
    await userEvent.click(screen.getByRole("button", { name: /^提交本次有限校准记录/ }));
    expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "CLOSE", caseId: "instrument-drift" }, { type: "REPORT", caseId: "instrument-drift" }]);
  });

  it("locks submissions for busy, real blocking and save errors without hiding committed measurements", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<AstronomerPanel astronomer={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("尚未完成实际校准")).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
      expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows non-retryable persistence recovery without inventing a second domain retry", () => {
    const onCommand = vi.fn();
    render(<AstronomerPanel astronomer={astronomer({ actions: [learn] })} resources={resources} busy={false}
      error={{ message: "存档版本已变化。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^听取天文学家成品用药指导/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the sole new skill, inherited mastery and unavailable spell list without adding powers", () => {
    const abilities = [{ id: "paragon.s5.precision-focus", label: "短时专注校准", mastery: 24, description: "明确原创G能力，有限专注，可能失败。" },
      { id: "paragon.s6.spiritual-craft", label: "原灵性制造", mastery: 72, description: "原图纸与实际原料条件保留。" }];
    panel(astronomer({ promoted: true, acting: 100, abilities, actions: [], cases: cases() }));
    expect(screen.getByText("天文学家5（古称星术师）")).toBeTruthy();
    expect(screen.getByText("短时专注校准 · 掌握 24")).toBeTruthy(); expect(screen.getByText("原灵性制造 · 掌握 72")).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "天文学家扮演进度" }) as HTMLProgressElement).value).toBe(100);
    const boundary = screen.getByLabelText("天文学家能力边界");
    expect(boundary.textContent).toContain("本阶段新增一项技能「短时专注校准」，用于有限练习与当次真实结算。");
    expect(boundary.textContent).toContain("本阶段新增一项技能「短时专注校准」，用于有限练习与当次真实结算。它只提供上述有限用途；完整法术清单尚未掌握，本阶段不增加其它法术。");
    expect(boundary.textContent).toContain("也不能提供确定未来");
    expect(boundary.textContent).toContain("原能力ID与掌握继续保留");
    expect(screen.queryByRole("button", { name: /星光|引力|天气|赋灵|梦境|仪式|必然/ })).toBeNull();
  });

  it("keeps the optional encounter separate and sends exact talk and fight choices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴楼梯口核对后交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴楼梯口承担真实冲突", true, "1行动 · 真实伤势与死亡风险");
    const environment = "原观测楼顶出口可见，原仪器与原工具留在原处。";
    const { onCommand } = panel(astronomer({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "天文学家有限冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴楼梯口核对后交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴楼梯口承担真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "天文学家实际结果" })).toBeNull();
  });

  it("preserves S6 sources, failures and the same client-owned lamp as read-only history", () => {
    const artisan: ArtisanProjection = {
      title: "工匠", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "工匠原供货记录保留。", story: "旧三案已经和平收尾。", environment: "原工房记录。",
      actions: [{ id: "old-craft", label: "不可重新领取旧原件", enabled: true, reason: null, cost: "1行动", command: { type: "BUY_KIT" } }],
      cases: ["reading-diagram", "limited-fabrication", "client-handover"].map((id, index) => ({ id, title: `工匠原案${index + 1}`,
        story: `原案${index + 1}的真实经过。`, status: "RESOLVED", observations: index === 1 ? ["原失败：制造失败仍耗铜壳与灵性材料。"] : [],
        preparation: index === 1 ? "当时已准备原图纸和原工具。" : null,
        result: `原案${index + 1}报告已提交，原失败与消耗保留。`, contactOpen: "已实际结束", closes: index + 1 })),
      bottles: [{ id: "artisan-potion-2", title: "工匠旧原瓶", source: "工匠原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "artisan-potion-2", confirmed: true } }],
      abilities: [{ id: "paragon.s6.spiritual-craft", label: "原灵性制造", mastery: 67, description: "原图纸、材料与失败继续保留。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
      workshop: { summary: "原工房工具仍在原处。", materials: "原铜壳0、灵性材料0，实际已用。",
        lamp: "原件ART6-LAMP-1位于CLIENT，检验已经消耗1次。", remainingUses: 2, delivered: true },
    };
    render(<AstronomerArtisanHistory artisan={artisan} />);
    const history = within(screen.getByRole("region", { name: "工匠时期的经历" }));
    for (const entry of artisan.cases) expect(history.getByText(`原案卷ID：${entry.id}`)).toBeTruthy();
    expect(history.getByText("原失败：制造失败仍耗铜壳与灵性材料。")).toBeTruthy();
    expect(history.getByText("原瓶ID：artisan-potion-2")).toBeTruthy();
    expect(history.getByText("来源：工匠原独立成品渠道")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原灵性制造 · 掌握 67：原图纸、材料与失败继续保留。")).toBeTruthy();
    expect(history.getByText(artisan.workshop.lamp!)).toBeTruthy();
    expect(history.getByText("原件剩余照明：2 次。")).toBeTruthy();
    expect(history.getByText("原件已交付，由委托人本人保有。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
