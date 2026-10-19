/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PolymathAction, PolymathCommand, PolymathProjection } from "../../src/domain/polymath/types";
import type { DetectiveProjection } from "../../src/domain/detective/types";
import { PolymathPanel, PolymathDetectiveHistory } from "../../src/renderer/PolymathPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可按公开休养与补给继续恢复。";
function action(command: PolymathCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): PolymathAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取博学者成品用药指导", true, "360便士 · 1行动");
function polymath(patch: Partial<PolymathProjection> = {}): PolymathProjection {
  return {
    title: "博学者晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "守知者扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", samples: [], ...patch,
  };
}
function cases(): PolymathProjection["cases"] {
  return [
    { id: "flash-study", title: "纸屏前的短暂闪光", story: "成年教师自愿作出低强闪光示范，只照亮纸屏，不造成伤害。" },
    { id: "thin-frost", title: "原杯里的薄冰", story: "成年教师自愿演示约定杯水上的薄冰，不冻结生命或整片场地，原杯须归还。" },
    { id: "willing-chorus", title: "自愿者的鼓舞练习", story: "成年教师只为自愿成年人作低强鼓舞示范，本人可以停止，鼓舞不控制心智。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): PolymathProjection {
  const originals = [
    { id: "polymath-potion-1", title: "第一瓶博学者魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "polymath-potion-2", title: "第二瓶博学者魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "polymath-potion-3", title: "第三瓶博学者魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return polymath({ guidanceKnown: true,
    supplies: "原三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货；不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): PolymathProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const firstFailure = "首次实际模仿失败：杯面没有出现薄冰；原杯、原水与实际消耗保留。";
function opened(): PolymathProjection {
  return polymath({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "thin-frost" ? {
      ...entry, status: "PREPARED", observations: ["亲见教师在约定杯水表面形成薄冰，实际分析记录保留。", firstFailure],
      preparation: "只尝试约定杯水表面的弱化薄冰。", result: "本次有限模仿未成功，须结束短效、归还原杯并实际离场。", contactOpen: "本次练习尚未实际结束",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "thin-frost" }, "结束薄冰短效、归还原杯并实际离场", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: PolymathProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PolymathPanel polymath={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Polymath public boundaries, separate sample learning, actual departure and independent originals", () => {
  it("shows the S7 public maturity gate and supply without inventing an unknown formula", () => {
    const reason = "守知者扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const value = polymath({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "博学者成长下一步" }).textContent).toContain(reason);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取博学者成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards public guidance, per-bottle labour, payment and supply commands with exact costs", async () => {
    const commands: PolymathCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "polymath-potion-3" },
      { type: "BUY_POTION", bottleId: "polymath-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(polymath({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels original-bottle confirmation at zero AP and returns keyboard focus without a command", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶博学者魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶博学者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶博学者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶博学者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶博学者魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders public source, risk, success line and resources before confirming only the selected original once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶博学者魔药」" }));
    expect(screen.getByText("polymath-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "博学者服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶博学者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "polymath-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the submitted original on save failure and leaves same-envelope retry to its outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶博学者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶博学者魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<PolymathPanel polymath={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect(screen.getByRole("region", { name: "这瓶博学者魔药的服用确认" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶博学者魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("polymath-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<PolymathPanel polymath={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves a committed failed original and independently offers each remaining bottle", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶博学者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶博学者魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<PolymathPanel polymath={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶博学者魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶博学者魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("polymath-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after committed promotion and retains the consumed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶博学者魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶博学者魔药」" }));
    expect(screen.queryByRole("region", { name: "博学者能力与消化" })).toBeNull();
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升博学者" } : bottle) };
    rerender(<PolymathPanel polymath={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶博学者魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "博学者能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升博学者")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("forwards only the selected public observation, ANALYSE and practice commands without optimistic learning", async () => {
    const commands: PolymathCommand[] = [{ type: "OBSERVE", caseId: "willing-chorus" }, { type: "ANALYSE", caseId: "willing-chorus" },
      { type: "PREPARE", caseId: "willing-chorus", method: "ORDINARY" }, { type: "PREPARE", caseId: "willing-chorus", method: "ABILITY" },
      { type: "PERFORM", caseId: "willing-chorus" }, { type: "WITHDRAW", caseId: "willing-chorus" }, { type: "REPORT", caseId: "willing-chorus" }];
    const labels = ["亲见成年教师的自愿鼓舞", "分析亲见的鼓舞样本", "准备普通言语对照", "准备弱化鼓舞模仿", "实际进行有限实践", "撤回待执行准备", "提交有限报告"];
    const { onCommand } = panel(polymath({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "flash-study");
    expect(screen.queryByRole("button", { name: /^实际进行有限实践/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "willing-chorus");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "有限实践与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.queryByRole("region", { name: "有限模仿与实际结果" })).toBeNull();
  });

  it("separates all three sample states and never grants learning from a click or ordinary result", async () => {
    const samples: PolymathProjection["samples"] = [
      { id: "FLASH", label: "已亲见的闪光", source: "成年教师的实际纸屏演示", observed: true, understood: false, learned: false, boundary: "只有弱光照，不能致伤。" },
      { id: "FROST", label: "已分析的杯水薄冰", source: "成年教师的实际杯水演示", observed: true, understood: true, learned: false, boundary: "只作用于约定杯水。" },
      { id: "COURAGE", label: "已模仿的自愿鼓舞", source: "成年教师的实际自愿鼓舞", observed: true, understood: true, learned: true, boundary: "不控制心智或制造忠诚。" },
    ];
    const analyse = action({ type: "ANALYSE", caseId: "flash-study" }, "分析纸屏前实际闪光");
    const ordinary = action({ type: "PREPARE", caseId: "thin-frost", method: "ORDINARY" }, "准备普通温度对照");
    const value = polymath({ promoted: true, cases: cases(), samples, actions: [analyse, ordinary] });
    const { onCommand, rerender } = panel(value);
    const flash = within(screen.getByRole("article", { name: "已亲见的闪光" }));
    expect(flash.getByText("已亲见")).toBeTruthy();
    expect(flash.getByText("尚未分析成功")).toBeTruthy(); expect(flash.getByText("尚未成功模仿")).toBeTruthy();
    const frost = within(screen.getByRole("article", { name: "已分析的杯水薄冰" }));
    expect(frost.getByText("已分析成功")).toBeTruthy(); expect(frost.getByText("尚未成功模仿")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "已模仿的自愿鼓舞" })).getByText("已成功模仿")).toBeTruthy();
    for (const sample of samples) {
      expect(screen.getByText(`来源：${sample.source}`)).toBeTruthy(); expect(screen.getByText(sample.boundary)).toBeTruthy();
    }
    await userEvent.click(screen.getByRole("button", { name: /^分析纸屏前实际闪光/ }));
    expect(flash.getByText("尚未分析成功")).toBeTruthy(); expect(flash.getByText("尚未成功模仿")).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole("combobox"), "thin-frost");
    await userEvent.click(screen.getByRole("button", { name: /^准备普通温度对照/ }));
    const ordinaryResult = "普通对照已完成，原水未结冰；普通方法没有学会薄冰样本。";
    rerender(<PolymathPanel polymath={{ ...value, actions: [], cases: value.cases.map((entry) => entry.id === "thin-frost" ? { ...entry, status: "RESOLVED", result: ordinaryResult } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(ordinaryResult)).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "已分析的杯水薄冰" })).getByText("尚未成功模仿")).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([analyse.command, ordinary.command]);
    rerender(<PolymathPanel polymath={{ ...value, samples: samples.map((sample) => sample.id === "FROST" ? { ...sample, learned: true } : sample) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(within(screen.getByRole("article", { name: "已分析的杯水薄冰" })).getByText("已成功模仿")).toBeTruthy();
  });

  it("locks selection to the actual open case and exposes only its CLOSE with zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(polymath({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "willing-chorus");
    const value = opened();
    rerender(<PolymathPanel polymath={{ ...value, actions: [action({ type: "CLOSE", caseId: "flash-study" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "thin-frost" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "thin-frost" }, "不可撤回代替离场"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_TALK" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("thin-frost"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^结束薄冰短效、归还原杯并实际离场/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "thin-frost" });
    expect(screen.getByText(firstFailure)).toBeTruthy();
    expect(screen.getByText(/本次练习尚未实际结束/)).toBeTruthy();
    rerender(<PolymathPanel polymath={value} resources={resources} busy={false} error={{ message: "离场尚未保存，请重试原操作。", retryable: true }} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^结束薄冰短效、归还原杯并实际离场/ }));
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    const report = action({ type: "REPORT", caseId: "thin-frost" }, "提交保留原失败的有限报告");
    rerender(<PolymathPanel polymath={{ ...value, insideCase: false, actions: [report], cases: value.cases.map((entry) => entry.id === "thin-frost" ? { ...entry, contactOpen: "短效已结束，原杯已归还并实际离场", closes: 1 } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText(/短效已结束，原杯已归还并实际离场/)).toBeTruthy();
    expect(screen.getByText(firstFailure)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^提交保留原失败的有限报告/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "CLOSE", caseId: "thin-frost" }, report.command]);
  });

  it("does not manufacture CLOSE from failure prose or infer an active contact from old records", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "博学者成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("flash-study");
    rerender(<PolymathPanel polymath={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "thin-frost");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("blocks public interactions while busy, externally blocked or awaiting a failed save", () => {
    const value = polymath({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "flash-study" }, "亲见成年教师的低强闪光"), action({ type: "REFLECT" }, "复盘实际结果")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<PolymathPanel polymath={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    rerender(<PolymathPanel polymath={opened()} resources={resources} busy={true} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^结束薄冰短效、归还原杯并实际离场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves three distinct stories without manufacturing unseen samples or actions", async () => {
    const value = polymath({ promoted: true, cases: cases(), actions: [] }); panel(value);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox"), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "有限模仿与实际结果" })).toBeNull();
    }
    expect(within(screen.getByRole("region", { name: "亲见样本与学习记录" })).queryByRole("article")).toBeNull();
    expect(screen.getByText(/尚无已公开的亲见样本/)).toBeTruthy();
    expect(screen.queryByText(firstFailure)).toBeNull();
    expect(screen.queryByRole("button", { name: /分析|强制|冻结生命|控制心智/ })).toBeNull();
  });

  it("shows public mastery while keeping weakened samples and adult consent within their limits", () => {
    const abilities = [{ id: "reader.s6.analysis", label: "样本分析", mastery: 23, description: "依据亲见实际样本分析结构。" },
      { id: "reader.s6.limited-imitation", label: "有限弱化模仿", mastery: 41, description: "分析成功后再实际尝试，不保证模仿成功。" }];
    const result = "纸屏前仅出现较弱光照，无人受伤；结束短效后记录本次结果。";
    panel(polymath({ promoted: true, acting: 100, abilities, actions: [], cases: cases().map((entry) => ({ ...entry, result: entry.id === "flash-study" ? result : null })) }));
    expect(screen.getByText("样本分析 · 掌握 23")).toBeTruthy(); expect(screen.getByText("有限弱化模仿 · 掌握 41")).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "博学者能力边界" });
    for (const text of ["成年教师本人自愿", "分析成功仍不保证模仿成功", "三项主实践可和平完成", "普通对照保留自己的结果，不授予已学样本", "不造成伤害", "薄冰只作用于约定杯水", "不控制心智", "本人可以停止", "2-081的案例不赠送任何样本"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(result)).toBeTruthy();
    expect(document.querySelector("audio, [data-hidden-samples], .polymath-success")).toBeNull();
  });

  it("keeps optional conflict separate and forwards only public talk or ordinary combat choices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与现场持棍者交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担普通短棍战", true, "1行动 · 真实战斗风险");
    const environment = "原现场仍有净空通路，原货物属于货主，旁观者已离开。";
    const { onCommand } = panel(polymath({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限现场冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^与现场持棍者交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担普通短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "有限模仿与实际结果" })).toBeNull();
    expect(screen.getByText(environment)).toBeTruthy();
  });

  it("keeps original Detective traces, gaps, reconstruction, conclusions, bottles and abilities read-only", () => {
    const detective: DetectiveProjection = {
      title: "守知者", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原守知者库存与耗用记录保留。", story: "原现场报告已提交。", environment: "原货架与足迹仍在。",
      cases: [{ id: "fallen-shelf", title: "原倒塌货架", story: "原货架由现场痕迹重构，不能凭空生成动机。", status: "RESOLVED",
        traces: ["地面保留原拖行痕迹。"], gaps: ["无法仅凭痕迹确认来者身份。"], reconstruction: "先移动木箱，后发生货架倾倒。", result: "仅报告已核对的事件顺序，保留身份缺口。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "detective-old", title: "守知者旧原瓶", source: "守知者原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "detective-old", confirmed: true } }],
      abilities: [{ id: "reader.s7.reconstruction", label: "原现场重构", mastery: 67, description: "只依据痕迹，不补出对白或动机。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<PolymathDetectiveHistory detective={detective} />);
    const history = within(screen.getByRole("region", { name: "守知者时期的经历" }));
    for (const text of ["原货架由现场痕迹重构，不能凭空生成动机。", "地面保留原拖行痕迹。", "无法仅凭痕迹确认来者身份。", "原案卷ID：fallen-shelf", "原瓶ID：detective-old",
      "当时的实际重构：先移动木箱，后发生货架倾倒。", "当时的结论与报告：仅报告已核对的事件顺序，保留身份缺口。", "来源：守知者原独立成品渠道", "已耗用 · 原失败保留",
      "原现场重构 · 掌握 67：只依据痕迹，不补出对白或动机。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });

  it("honors public disabled reasons even with ample resources and never creates missing actions", () => {
    const reason = "尚未亲见成年教师的实际薄冰示范，不能分析这个样本。";
    const prepare = { ...action({ type: "ANALYSE", caseId: "thin-frost" }, "分析亲见薄冰样本", false), reason };
    const { onCommand } = panel(polymath({ promoted: true, cases: cases(), actions: [prepare] }));
    const selector = screen.getByRole("combobox");
    fireEvent.change(selector, { target: { value: "thin-frost" } });
    const button = screen.getByRole("button", { name: /^分析亲见薄冰样本/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /直接学会|立即冻结|结束能力/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public bottle eligibility and risk in an open confirmation without calculating a local result", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶博学者魔药」" }));
    const reason = "当前服药条件已变化，须先恢复精神。";
    const updated = { ...value, risk: "当前公共风险：原瓶仍在，未进行任何判定。", bottles: value.bottles.map((bottle) => bottle.id === "polymath-potion-2" ? { ...bottle, chance: 19 } : bottle),
      actions: value.actions.map((entry) => entry.command.type === "CONSUME" && entry.command.bottleId === "polymath-potion-2" ? { ...entry, enabled: false, reason } : entry) };
    rerender(<PolymathPanel polymath={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶博学者魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "博学者能力与消化" })).toBeNull();
  });
});
