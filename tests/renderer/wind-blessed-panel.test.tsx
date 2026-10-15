/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WindBlessedAction, WindBlessedCommand, WindBlessedProjection } from "../../src/domain/wind-blessed/types";
import type { NavigatorProjection } from "../../src/domain/navigator/types";
import { WindBlessedPanel, WindBlessedNavigatorHistory } from "../../src/renderer/WindBlessedPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可按公开休养与补给继续恢复。";
function action(command: WindBlessedCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): WindBlessedAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取风眷者成品用药指导", true, "360便士 · 1行动");
function windBlessed(patch: Partial<WindBlessedProjection> = {}): WindBlessedProjection {
  return {
    title: "风眷者晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "航海家扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    flight: { position: "GROUND", ascents: 0, flightReturns: 0, stairReturns: 0 }, ...patch,
  };
}
function cases(): WindBlessedProjection["cases"] {
  return [
    { id: "crosswind-screen", title: "原工作框里的帆布", story: "只在获准工作框内稳住原帆布，原普通支杆可以使用。" },
    { id: "low-platform", title: "原低台的去程与回路", story: "原低台水平6米、高2米，原8米普通楼梯回路仍在。" },
    { id: "cutting-target", title: "获准薄木条上的切口", story: "仅切割获准的原薄木条，原普通锯具可以使用。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次现场", closes: 0 }));
}
function bottled(): WindBlessedProjection {
  const originals = [
    { id: "wind-blessed-potion-1", title: "第一瓶风眷者魔药", source: "独立G渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "wind-blessed-potion-2", title: "第二瓶风眷者魔药", source: "独立G渠道第二瓶成品，另有采购记录", chance: 43 },
    { id: "wind-blessed-potion-3", title: "第三瓶风眷者魔药", source: "独立G渠道第三瓶成品，另有封装记录", chance: 61 },
  ];
  return windBlessed({ guidanceKnown: true,
    supplies: "三瓶独立G成品，每瓶3320便士或五步劳务后320便士，下一周补货；不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): WindBlessedProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const returnFailure = "飞行返程失败：实际消耗2灵性，仍留在原低台台面；原8米楼梯可以返回。";
const stairs = () => action({ type: "CLOSE", caseId: "low-platform", returnMethod: "STAIRS" }, "沿原楼梯返回地面并结束", true, "0行动 · 0精神 · 0灵性 · 不另抽随机");
const flight = () => action({ type: "CLOSE", caseId: "low-platform", returnMethod: "FLIGHT" }, "借风返回原地面并结束", true, "0行动 · 2灵性 · 独立体质14判定");
function onPlatform(patch: Partial<WindBlessedProjection> = {}): WindBlessedProjection {
  return windBlessed({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "low-platform" ? { ...entry, status: "EXAMINED", observations: ["已实际登上原低台；原楼梯仍在。"],
      result: "去程成功：实际消耗3灵性，人在原低台台面。", contactOpen: "本次低台往返尚未结束" } : entry),
    flight: { position: "LOW_PLATFORM", ascents: 1, flightReturns: 0, stairReturns: 0 },
    actions: [stairs(), flight()], ...patch,
  });
}
function panel(value: WindBlessedProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<WindBlessedPanel windBlessed={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function returnRecords() { return within(screen.getByRole("region", { name: "原低台位置与往返记录" })); }
function recordValue(label: string) { return returnRecords().getByText(label, { selector: "dt" }).nextElementSibling?.textContent; }
afterEach(cleanup);

describe("Wind-blessed independent bottles, bounded wind practice and actual return", () => {
  it("shows the public maturity gate and only the two verified material fragments, never an invented complete recipe", () => {
    const reason = "航海家扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "独立G渠道三瓶成品由原指导者保管，本瓶已完成4/5步劳务。";
    const value = windBlessed({ digestion: reason, supplies, formula: [{ name: "未核实辅料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "风眷者成长下一步" }).textContent).toContain(reason);
    const formula = screen.getByRole("region", { name: "风眷者已核主材料与配方边界" });
    expect(formula.textContent).toContain("蓝影隼结晶羽毛6根"); expect(formula.textContent).toContain("龙眼海雕眼珠1对");
    expect(formula.textContent).toContain("当前仅掌握主材料线索：蓝影隼结晶羽毛6根与龙眼海雕眼珠1对。完整配方、辅料、其余剂量与调配顺序尚未掌握；这两项仅供了解，不开放材料采购或调配。");
    expect(formula.textContent).toContain("不开放材料采购或调配"); expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取风眷者成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实辅料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|采购材料|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact public guidance, per-bottle labour, payment and resupply commands with their costs", async () => {
    const commands: WindBlessedCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "wind-blessed-potion-3" },
      { type: "BUY_POTION", bottleId: "wind-blessed-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(windBlessed({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels a bottle confirmation at zero AP and returns keyboard focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶风眷者魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶风眷者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶风眷者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶风眷者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶风眷者魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows source, risk and resources before independently confirming the selected original exactly once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶风眷者魔药」" }));
    const confirmation = within(screen.getByRole("region", { name: "这瓶风眷者魔药的服用确认" }));
    for (const text of ["wind-blessed-potion-2", `来源：${value.bottles[1]!.source}`, "43%", risk, "76 / 100", "88 / 100", "12 / 80", resources.cash]) {
      expect(confirmation.getByText(text)).toBeTruthy();
    }
    expect(confirmation.getByText("剩余行动").nextElementSibling?.textContent).toBe("0");
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶风眷者魔药」" });
    confirm.focus(); await userEvent.keyboard("{Enter}"); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(screen.queryByText("wind-blessed-potion-1")).toBeNull(); expect(screen.queryByText("wind-blessed-potion-3")).toBeNull();
    expect(screen.queryByRole("region", { name: "风眷者能力与消化" })).toBeNull();
  });

  it("keeps a submitted bottle locked through save failure, delegates retry to the parent and blocks Escape", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶风眷者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶风眷者魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<WindBlessedPanel windBlessed={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶风眷者魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("wind-blessed-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<WindBlessedPanel windBlessed={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves the failed original and independently offers remaining bottles only after the committed update", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶风眷者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶风眷者魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<WindBlessedPanel windBlessed={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶风眷者魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶风眷者魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("wind-blessed-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation when promotion commits and keeps consumed and unused bottles as history", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶风眷者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶风眷者魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升风眷者" } : bottle) };
    rerender(<WindBlessedPanel windBlessed={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶风眷者魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "风眷者能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升风眷者")).toBeTruthy();
    expect(screen.getByText("原瓶ID：wind-blessed-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("uses updated public eligibility and risk in an open confirmation without computing a local result", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶风眷者魔药」" }));
    const reason = "当前服药条件已变化，须先恢复精神。";
    const updated = { ...value, risk: "当前公共风险：原瓶仍在，尚未进行判定。", bottles: value.bottles.map((bottle) => bottle.id === "wind-blessed-potion-2" ? { ...bottle, chance: 19 } : bottle),
      actions: value.actions.map((entry) => entry.command.type === "CONSUME" && entry.command.bottleId === "wind-blessed-potion-2" ? { ...entry, enabled: false, reason } : entry) };
    rerender(<WindBlessedPanel windBlessed={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶风眷者魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects three distinct public stories and forwards exact ordinary and ability practice commands", async () => {
    const commands: WindBlessedCommand[] = [{ type: "OBSERVE", caseId: "crosswind-screen" },
      { type: "PREPARE", caseId: "crosswind-screen", method: "ORDINARY" }, { type: "PREPARE", caseId: "crosswind-screen", method: "ABILITY" },
      { type: "PERFORM", caseId: "crosswind-screen" }, { type: "WITHDRAW", caseId: "crosswind-screen" }, { type: "REPORT", caseId: "crosswind-screen" }];
    const labels = ["核对原工作框", "准备用原支杆固定", "准备用有限控风", "实际稳住帆布", "撤回待执行准备", "提交实际帆布记录"];
    const { onCommand } = panel(windBlessed({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox"), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "风眷者实际结果" })).toBeNull();
      expect(recordValue("实际位置")).toBe("原地面");
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "crosswind-screen");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "有限实践与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(recordValue("实际登台")).toBe("0 次");
  });

  it("displays the actual round-trip cost and permits a public outward attempt with 3 spirituality", async () => {
    const outward = action({ type: "PERFORM", caseId: "low-platform" }, "借风尝试前往原低台", true, "1行动 · 3灵性 · 体质14判定");
    const value = windBlessed({ promoted: true, cases: cases(), actions: [outward] });
    const onCommand = vi.fn();
    render(<WindBlessedPanel windBlessed={value} resources={{ ...resources, spirituality: 3, actionsRemaining: 1 }} busy={false} onCommand={onCommand} />);
    const record = returnRecords();
    expect(record.getByText(/原低台水平6米、高2米；原8米普通楼梯回路始终开放/)).toBeTruthy();
    expect(record.getByText(/计划飞行往返合计5灵性/)).toBeTruthy();
    expect(record.getByText(/只有3灵性时也可按公开选项尝试去程/)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^借风尝试前往原低台/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); expect(button.textContent).toContain(outward.cost);
    await userEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(outward.command);
    expect(recordValue("实际位置")).toBe("原地面"); expect(recordValue("实际登台")).toBe("0 次");
    expect(screen.queryByRole("button", { name: /返回地面并结束/ })).toBeNull();
  });

  it("shows both exact public zero-AP exits and waits for a saved result instead of teleporting on click", async () => {
    const value = onPlatform(); const { onCommand } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("low-platform"); expect(selector.disabled).toBe(true);
    expect(recordValue("实际位置")).toBe("原低台台面"); expect(recordValue("实际登台")).toBe("1 次");
    const exitGroup = within(screen.getByRole("group", { name: "当前风眷者实践行动" }));
    expect(exitGroup.getAllByRole("button")).toHaveLength(2);
    for (const entry of value.actions) {
      const button = exitGroup.getByRole("button", { name: new RegExp(`^${entry.label}`) }) as HTMLButtonElement;
      expect(button.disabled).toBe(false); expect(button.textContent).toContain(entry.cost);
      await userEvent.click(button);
      expect(recordValue("实际位置")).toBe("原低台台面");
      expect(recordValue("成功飞行返回")).toBe("0 次"); expect(recordValue("实际楼梯返回")).toBe("0 次");
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([stairs().command, flight().command]);
  });

  it("keeps stairs available at zero AP, mind and spirituality while respecting a disabled flight reason", async () => {
    const reason = "飞行返程仍需2灵性；当前不足，原楼梯仍可返回。";
    const fly = { ...flight(), enabled: false, reason };
    const onCommand = vi.fn();
    render(<WindBlessedPanel windBlessed={onPlatform({ actions: [fly, stairs()] })} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const disabled = screen.getByRole("button", { name: /^借风返回原地面并结束/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(document.getElementById(disabled.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(disabled);
    const stairsButton = screen.getByRole("button", { name: /^沿原楼梯返回地面并结束/ }) as HTMLButtonElement;
    expect(stairsButton.disabled).toBe(false); await userEvent.click(stairsButton);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(stairs().command);
    expect(recordValue("实际位置")).toBe("原低台台面");
  });

  it("preserves flight-return failure and costs until a committed stair return actually changes position", async () => {
    const value = onPlatform(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^借风返回原地面并结束/ }));
    const failed = { ...value, cases: value.cases.map((entry) => entry.id === "low-platform" ? { ...entry, observations: [...entry.observations, returnFailure], result: returnFailure } : entry) };
    rerender(<WindBlessedPanel windBlessed={failed} resources={{ ...resources, spirituality: 10 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "风眷者实际结果" }).textContent).toContain(returnFailure);
    expect(screen.getByRole("region", { name: "公开观察与原失败记录" }).textContent).toContain(returnFailure);
    expect(recordValue("实际位置")).toBe("原低台台面"); expect(recordValue("成功飞行返回")).toBe("0 次");
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^沿原楼梯返回地面并结束/ }));
    expect(recordValue("实际位置")).toBe("原低台台面");
    const returned: WindBlessedProjection = { ...failed, insideCase: false, actions: [], flight: { ...failed.flight, position: "GROUND", stairReturns: 1 },
      cases: failed.cases.map((entry) => entry.id === "low-platform" ? { ...entry, contactOpen: "已沿原楼梯实际返回并结束", closes: 1 } : entry) };
    rerender(<WindBlessedPanel windBlessed={returned} resources={{ ...resources, spirituality: 10 }} busy={false} onCommand={onCommand} />);
    expect(recordValue("实际位置")).toBe("原地面"); expect(recordValue("实际楼梯返回")).toBe("1 次");
    expect(recordValue("成功飞行返回")).toBe("0 次"); expect(recordValue("实际登台")).toBe("1 次");
    expect(screen.getByRole("region", { name: "公开观察与原失败记录" }).textContent).toContain(returnFailure);
    expect(screen.getByText(/本次现场：已沿原楼梯实际返回并结束 · 实际结束次数：1/)).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole("combobox"), "cutting-target");
    expect(recordValue("实际位置")).toBe("原地面"); expect(recordValue("实际楼梯返回")).toBe("1 次");
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([flight().command, stairs().command]);
  });

  it("displays a separately committed flight return without incrementing stairs or reducing recorded ascents", async () => {
    const value = onPlatform({ flight: { position: "LOW_PLATFORM", ascents: 4, flightReturns: 1, stairReturns: 2 } });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^借风返回原地面并结束/ }));
    expect(recordValue("成功飞行返回")).toBe("1 次");
    const returned: WindBlessedProjection = { ...value, insideCase: false, actions: [], flight: { ...value.flight, position: "GROUND", flightReturns: 2 } };
    rerender(<WindBlessedPanel windBlessed={returned} resources={{ ...resources, spirituality: 10 }} busy={false} onCommand={onCommand} />);
    expect(recordValue("实际位置")).toBe("原地面"); expect(recordValue("成功飞行返回")).toBe("2 次");
    expect(recordValue("实际楼梯返回")).toBe("2 次"); expect(recordValue("实际登台")).toBe("4 次");
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(flight().command);
  });

  it("selects the real public open scene after a different selection and retains disabled non-exit reasons", async () => {
    const { onCommand, rerender } = panel(windBlessed({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "cutting-target");
    const held = [action({ type: "REPORT", caseId: "low-platform" }, "返回后才能报告", false),
      action({ type: "WITHDRAW", caseId: "low-platform" }, "撤回不能代替返回", false),
      action({ type: "REFLECT" }, "返回后才能复盘", false), action({ type: "ENCOUNTER_TALK" }, "返回后才能交涉", false)];
    held.forEach((entry, index) => { entry.reason = `本次低台往返尚未结束：公开禁用原因${index + 1}`; });
    const value = onPlatform({ actions: [action({ type: "CLOSE", caseId: "crosswind-screen" }, "旧现场不可结束", false), stairs(), flight(), ...held] });
    rerender(<WindBlessedPanel windBlessed={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("low-platform");
    for (const entry of held) {
      const button = screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); expect(screen.getByText(entry.reason!)).toBeTruthy(); fireEvent.click(button);
    }
    expect(screen.queryByRole("button", { name: /^旧现场不可结束/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^沿原楼梯返回地面并结束/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(stairs().command);
  });

  it("forwards a published ordinary ground CLOSE unchanged without inventing a return method", async () => {
    const close = action({ type: "CLOSE", caseId: "crosswind-screen" }, "放下原帆布并实际结束", true, "0行动 · 0精神 · 0灵性");
    const { onCommand } = panel(windBlessed({ promoted: true, insideCase: true, cases: cases(), actions: [close] }));
    await userEvent.click(screen.getByRole("button", { name: /^放下原帆布并实际结束/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
    expect(screen.queryByRole("button", { name: /楼梯返回|借风返回/ })).toBeNull();
  });

  it("never manufactures exits, flight, saw cuts, supply or attacks from history or bottle commands", async () => {
    const value = onPlatform({ actions: [], bottles: bottled().bottles }); const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "风眷者成长下一步" }).textContent).toContain("查看当前公开返回或结束选项");
    expect(recordValue("实际位置")).toBe("原低台台面");
    const history = { ...value, insideCase: false, flight: { ...value.flight, position: "GROUND" as const, stairReturns: 1 } };
    rerender(<WindBlessedPanel windBlessed={history} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "low-platform");
    expect(screen.queryByRole("button")).toBeNull(); expect(recordValue("实际位置")).toBe("原地面");
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("blocks exits during save error without changing actual position and offers no duplicate local retry", () => {
    const value = onPlatform(); const onCommand = vi.fn();
    const { rerender } = render(<WindBlessedPanel windBlessed={value} resources={resources} busy={false} error="本次返程尚未保存。" onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(recordValue("实际位置")).toBe("原低台台面"); expect(recordValue("成功飞行返回")).toBe("0 次");
    expect(screen.getByRole("status").textContent).toContain("当前仍显示上次已保存的记录");
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    rerender(<WindBlessedPanel windBlessed={value} resources={resources} busy={false} blocked onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^沿原楼梯返回地面并结束/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<WindBlessedPanel windBlessed={value} resources={resources} busy={false} error={{ message: "此存档须重新加载。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
  });

  it("uses only published ordinary tools and shows a disabled ability reason even with abundant resources", async () => {
    const ordinary = action({ type: "PREPARE", caseId: "cutting-target", method: "ORDINARY" }, "准备使用原普通锯具", true, "1行动 · 0灵性");
    const ability = { ...action({ type: "PREPARE", caseId: "cutting-target", method: "ABILITY" }, "准备有限风刃", false), reason: "尚未核对获准原薄木条，不能开始风刃练习。" };
    const { onCommand } = panel(windBlessed({ promoted: true, cases: cases(), actions: [ordinary, ability] }));
    const button = screen.getByRole("button", { name: /^准备有限风刃/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(ability.reason);
    fireEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: /^准备使用原普通锯具/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.queryByRole("button", { name: /雷击|歌声|免费飞行|远程杀敌|采购锯具/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "风眷者实际结果" })).toBeNull();
  });

  it("forwards only public encounter and reflection commands without asserting battle victory", async () => {
    const commands: WindBlessedCommand[] = [{ type: "REFLECT" }, { type: "ENCOUNTER_TALK" }, { type: "ENCOUNTER_FIGHT" }];
    const labels = ["复盘实际风眷者实践", "与原在场者交涉", "进入原现场有限冲突"];
    const environment = "原低台外的通道与现场原人仍在。";
    const { onCommand } = panel(windBlessed({ promoted: true, environment, actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByText(environment)).toBeTruthy(); expect(screen.queryByRole("region", { name: "风眷者实际结果" })).toBeNull();
    expect(recordValue("实际位置")).toBe("原地面");
  });

  it("keeps Navigator titles, observations, plans, results, bottles, mastery and acting read-only at S6", () => {
    const navigator: NavigatorProjection = {
      title: "航海家", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原航海家库存与耗用记录保留。", story: "原航海家作业记录已提交。", environment: "原岸线和原布具仍在。",
      cases: [{ id: "waterline-cleanup", title: "原岸侧刻度清洁", story: "只清洁获准的原岸侧刻度。", status: "RESOLVED",
        observations: ["原布具没有被替换。", "原失败实际消耗2灵性。"], preparation: "使用原布具进行普通清洁。", result: "已在原岸侧完成有限清洁并实际返回。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "navigator-old", title: "航海家旧原瓶", source: "航海家原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "navigator-old", confirmed: true } }],
      abilities: [{ id: "tyrant.s7.navigation", label: "原有限导航", mastery: 67, description: "保留原能力掌握，不把直觉当航行保证。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<WindBlessedNavigatorHistory navigator={navigator} />);
    const history = within(screen.getByRole("region", { name: "航海家时期的经历" }));
    for (const text of ["原岸侧刻度清洁 · 已有实际作业结果", "只清洁获准的原岸侧刻度。", "原布具没有被替换。", "原失败实际消耗2灵性。",
      "原案卷ID：waterline-cleanup", "原瓶ID：navigator-old", "当时的计划与准备：使用原布具进行普通清洁。", "当时的实际结果：已在原岸侧完成有限清洁并实际返回。",
      "来源：航海家原独立成品渠道", "已耗用 · 原失败保留", "航海家扮演进度 100 · 消化：已消化", "原有限导航 · 掌握 67：保留原能力掌握，不把直觉当航行保证。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });
});
