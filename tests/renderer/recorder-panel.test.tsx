/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecorderAction, RecorderCommand, RecorderProjection } from "../../src/domain/recorder/types";
import type { AstrologerProjection } from "../../src/domain/astrologer/types";
import { RecorderPanel, RecorderAstrologerHistory } from "../../src/renderer/RecorderPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

// Synthetic public projections test presentation only; domain tests own costs and resolution.
const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "大成功、成功可晋升；失败、灾难消耗这一原瓶，排异与实际损失保留。";
function action(command: RecorderCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): RecorderAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取记录官成品指导", true, "360便士 · 1行动");
function recorder(patch: Partial<RecorderProjection> = {}): RecorderProjection {
  return {
    title: "记录官晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "占星人扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", records: [], samples: [],
    capacities: [
      { tier: "LOW", label: "低序列", used: 0, maximum: 20, boundary: "序列9与8；空槽不赠送能力" },
      { tier: "MID", label: "中序列", used: 0, maximum: 8, boundary: "没有实际示范，当前无已存记录" },
      { tier: "DIVINE", label: "神性能力", used: 0, maximum: 1, boundary: "当前没有可用的真实示范" },
    ], ...patch,
  };
}
function cases(): RecorderProjection["cases"] {
  return [
    { id: "flash-screen", title: "帘前闪光", story: "先核对原帘与安全边界，再尝试已记录闪光或普通遮挡。" },
    { id: "courage-task", title: "一项有限任务", story: "只把勇气用于已获同意的有限任务，普通练习同样可行。" },
    { id: "missing-source", title: "没有示范的请求", story: "没有真实旅行或高序列能力示范，只能复核原资料并拒绝越界。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function samples(): RecorderProjection["samples"] {
  return [
    { id: "FLASH", label: "闪光", source: "诺拉·维恩，序列8戏法大师的实际示范", instructorSpirituality: 18, lastAttemptWeek: null, stored: 0 },
    { id: "COURAGE", label: "勇气", source: "原创成年歌颂者萨芙·里恩，序列9的实际示范", instructorSpirituality: 20, lastAttemptWeek: null, stored: 0 },
  ];
}
function originals(): RecorderProjection["records"] {
  return [
    { id: "original-flash-41", sample: "FLASH", sequence: 8, status: "STORED", sourceDemoId: "demo-nora-41", createdWeek: 41, releasedWeek: null, label: "原闪光记录", source: "诺拉的第41周原示范" },
    { id: "original-courage-40", sample: "COURAGE", sequence: 9, status: "RELEASED", sourceDemoId: "demo-saff-40", createdWeek: 40, releasedWeek: 42, label: "原勇气记录", source: "萨芙的第40周原示范" },
  ];
}
function bottled(): RecorderProjection {
  const bottles = [
    { id: "recorder-potion-1", title: "第一瓶记录官魔药", source: "原渠道第一瓶独立成品", chance: 71 },
    { id: "recorder-potion-2", title: "第二瓶记录官魔药", source: "原渠道第二瓶独立采购", chance: 43 },
    { id: "recorder-potion-3", title: "第三瓶记录官魔药", source: "原渠道第三瓶独立封装", chance: 61 },
  ];
  return recorder({ guidanceKnown: true, supplies: "三瓶独立成品按原劳务与付款记录领取。",
    actions: bottles.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 消耗这一原瓶")),
    bottles: bottles.map((bottle): RecorderProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const firstFailure = "原闪光已经释放但未达到现场目标；这一原记录与2灵性实际消耗，不予返还。";
function opened(): RecorderProjection {
  return recorder({ promoted: true, insideCase: true, samples: samples(), records: originals(),
    cases: cases().map((entry) => entry.id === "flash-screen" ? { ...entry, status: "EXAMINED", observations: [firstFailure],
      preparation: "实际释放已选择的原闪光。", result: "原帘仍需普通复核，本次接触尚未结束。", contactOpen: "本次接触尚未实际结束", closes: 0 } : entry),
    actions: [action({ type: "CLOSE", caseId: "flash-screen" }, "结束闪光实践并实际离场", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: RecorderProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<RecorderPanel recorder={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Recorder public originals, actual sources and explicit departure", () => {
  it("shows public maturity and supply without synthesizing formula, bottles or commands", () => {
    const reason = "占星人扮演100；晋升后11/12个完整周，尚未成熟。";
    const supply = "第三瓶尚未实际取得，原劳务4/5。";
    const { onCommand } = panel(recorder({ digestion: reason, supplies: supply, formula: [{ name: "未核实材料不显示", quantity: 12, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "记录官成长下一步" });
    expect(summary.textContent).toContain(reason); expect(summary.textContent).toContain("完整魔药配方、材料与剂量仍未核实");
    expect(screen.getByText(supply)).toBeTruthy(); expect(screen.queryByText("未核实材料不显示")).toBeNull();
    const button = screen.getByRole("button", { name: /^听取记录官成品指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|查看并准备服用/ })).toBeNull();
  });

  it("forwards public acquisition and resupply commands with their exact public costs", async () => {
    const commands: RecorderCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "recorder-potion-3" },
      { type: "BUY_POTION", bottleId: "recorder-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5", "320便士 · 0行动", "1行动 · 下周到货", "0行动 · 登记原瓶"];
    const { onCommand } = panel(recorder({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    costs.forEach((cost) => expect(screen.getByText(cost)).toBeTruthy());
  });

  it("cancels bottle confirmation with keyboard or button at zero AP and restores focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶记录官魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶记录官魔药" }));
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶记录官魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶记录官魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶记录官魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows source, four-tier risk and current resources before submitting the original once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶记录官魔药」" }));
    expect(screen.getByText("recorder-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶独立采购")).toBeTruthy();
    expect(screen.getByRole("region", { name: "记录官服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"].forEach((text) => expect(current.getByText(text)).toBeTruthy());
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶记录官魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("region", { name: "记录官能力与消化" })).toBeNull();
  });

  it("retains failed-save confirmation and leaves retry of the identical envelope to the parent", async () => {
    const value = bottled(); const envelope = { intentId: "original-recorder-consume", expectedRevision: 82, payload: value.actions[0]!.command };
    const sendEnvelope = vi.fn(); const onCommand = vi.fn(() => sendEnvelope(envelope));
    const { rerender } = render(<><button onClick={() => sendEnvelope(envelope)}>父级重试原操作</button><RecorderPanel recorder={value} resources={resources} busy={false} onCommand={onCommand} /></>);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶记录官魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶记录官魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<><button onClick={() => sendEnvelope(envelope)}>父级重试原操作</button><RecorderPanel recorder={value} resources={resources} busy={false} error={error} onCommand={onCommand} /></>);
    const confirmation = within(screen.getByRole("region", { name: "这瓶记录官魔药的服用确认" }));
    expect(confirmation.getByRole("status").textContent).toContain(error.message); expect(confirmation.queryByRole("button", { name: /重试/ })).toBeNull();
    expect((confirmation.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirmation.getByRole("button", { name: "确认服用「第一瓶记录官魔药」" })); await userEvent.keyboard("{Escape}");
    expect(confirmation.getByText("recorder-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "父级重试原操作" }));
    expect(sendEnvelope).toHaveBeenCalledTimes(2); expect(sendEnvelope.mock.calls[0]![0]).toBe(sendEnvelope.mock.calls[1]![0]);
  });

  it("keeps a committed failed original and separately confirms a remaining original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶记录官魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶记录官魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败保留" } : bottle) };
    rerender(<RecorderPanel recorder={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败保留")).toBeTruthy(); expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶记录官魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶记录官魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("recorder-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("leaves confirmation only after committed promotion and retains consumed bottle history", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶记录官魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶记录官魔药」" }));
    rerender(<RecorderPanel recorder={{ ...value, promoted: true, actions: [], bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升记录官" } : bottle) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶记录官魔药的服用确认" })).toBeNull(); expect(screen.getByRole("region", { name: "记录官能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升记录官")).toBeTruthy(); expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("uses changed public eligibility and risk without guessing a local result", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶记录官魔药」" }));
    const reason = "当前精神不足，不能服用这一原瓶。";
    const updated = { ...value, risk: "本次尚未判定，四档风险以当前指导为准。", bottles: value.bottles.map((bottle, index) => index === 1 ? { ...bottle, chance: 19 } : bottle),
      actions: value.actions.map((entry, index) => index === 1 ? { ...entry, enabled: false, reason } : entry) };
    rerender(<RecorderPanel recorder={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶记录官魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(document.getElementById(confirm.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows public 20/8/1 capacities without filling slots or synthesizing release commands", () => {
    const { onCommand, rerender } = panel(recorder({ promoted: true, actions: [] }));
    const capacity = screen.getByRole("region", { name: "原记录与实际容量" });
    ["低序列", "0 / 20", "中序列", "0 / 8", "神性能力", "0 / 1", "尚无已成功储存的原记录"].forEach((text) => expect(capacity.textContent).toContain(text));
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByText(/原记录ID：/)).toBeNull();
    const value = recorder({ promoted: true, actions: [], capacities: [{ tier: "LOW", label: "当前公开低序列容量", used: 7, maximum: 20, boundary: "已经核对7份原记录" }] });
    rerender(<RecorderPanel recorder={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "原记录与实际容量" }).textContent).toContain("7 / 20"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves exact original and demonstration IDs, source, sequence and release history", () => {
    panel(recorder({ promoted: true, actions: [], records: originals() }));
    const recordList = screen.getByRole("region", { name: "原记录与实际容量" });
    ["原记录ID：original-flash-41", "原示范ID：demo-nora-41", "诺拉的第41周原示范", "序列 8", "尚未释放", "第41周实际记录",
      "原记录ID：original-courage-40", "原示范ID：demo-saff-40", "萨芙的第40周原示范", "序列 9", "已释放，原记录已消耗", "第42周实际释放"].forEach((text) => expect(recordList.textContent).toContain(text));
    expect(recordList.textContent).not.toMatch(/过期|到期|有效期/); expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers only actual public sample RECORD commands and never optimistically stores an original", async () => {
    const commands: RecorderCommand[] = [{ type: "RECORD", sample: "FLASH" }, { type: "RECORD", sample: "COURAGE" }];
    const costs = ["1行动 · 3灵性 · 诺拉示范另付2灵性", "1行动 · 3灵性 · 萨芙示范另付1灵性"];
    const value = recorder({ promoted: true, samples: samples(), actions: commands.map((command, index) => action(command, index === 0 ? "实际记录闪光" : "实际记录勇气", true, costs[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际记录闪光/ })); await userEvent.click(screen.getByRole("button", { name: /^实际记录勇气/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands); commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.getByText(/来源：诺拉·维恩，序列8/)).toBeTruthy(); expect(screen.getByText(/来源：原创成年歌颂者萨芙·里恩，序列9/)).toBeTruthy();
    costs.forEach((cost) => expect(screen.getByText(cost)).toBeTruthy()); expect(screen.queryByText(/原记录ID：/)).toBeNull();
    expect(screen.getByRole("region", { name: "原记录与实际容量" }).textContent).toContain("0 / 20");
  });

  it("keeps unavailable samples and unknown-source ability requests disabled without invented IDs", async () => {
    const reason = "没有真实旅行示范，也没有可释放的原记录；请普通核实。";
    const value = recorder({ promoted: true, cases: cases(), samples: samples(), actions: [
      { ...action({ type: "RECORD", sample: "FLASH" }, "再次实际记录闪光", false), reason: "本周已经尝试过，失败成本保留。" },
      { ...action({ type: "PREPARE", caseId: "missing-source", method: "ABILITY" }, "准备有真实来源的能力", false), reason },
    ] });
    const { onCommand } = panel(value); await userEvent.selectOptions(screen.getByRole("combobox"), "missing-source");
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    const unknown = screen.getByRole("button", { name: /^准备有真实来源的能力/ });
    expect(document.getElementById(unknown.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    expect(screen.queryByRole("button", { name: /传送|创造|生成记录/ })).toBeNull(); expect(screen.queryByText(/原记录ID：/)).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects all three stories and passes exact ordinary, preparation, withdrawal and report commands", async () => {
    const commands: RecorderCommand[] = [{ type: "OBSERVE", caseId: "missing-source" }, { type: "PREPARE", caseId: "missing-source", method: "ORDINARY" },
      { type: "PERFORM", caseId: "missing-source" }, { type: "WITHDRAW", caseId: "missing-source" }, { type: "REPORT", caseId: "missing-source" }];
    const labels = ["核对实际来源", "准备普通复核并拒绝越界", "实际核实资料", "撤回尚未执行的准备", "提交有限报告"];
    const value = recorder({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }); const { onCommand } = panel(value);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const entry of value.cases) { await userEvent.selectOptions(screen.getByRole("combobox"), entry.id); expect(screen.getByText(entry.story)).toBeTruthy(); }
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands); expect(screen.queryByRole("region", { name: "有限实践与实际结果" })).toBeNull();
    expect(screen.queryByText(/原记录ID：/)).toBeNull();
  });

  it("distinguishes public recording cost from one-use release cost without consuming at selection", async () => {
    const record = action({ type: "RECORD", sample: "FLASH" }, "实际记录新闪光", true, "1行动 · 3灵性 · 失败照付");
    const prepare = action({ type: "PREPARE", caseId: "flash-screen", method: "ABILITY" }, "准备释放原闪光", true, "1行动 · 准备不释放");
    const release = action({ type: "PERFORM", caseId: "flash-screen" }, "实际释放这一原记录", true, "1行动 · 2灵性 · 消耗同一原记录");
    const value = recorder({ promoted: true, samples: samples(), cases: cases(), records: originals(), actions: [record, prepare, release] }); const { onCommand } = panel(value);
    expect(screen.getByText(record.cost)).toBeTruthy(); expect(screen.getByText(release.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^准备释放原闪光/ }));
    await userEvent.click(screen.getByRole("button", { name: /^实际释放这一原记录/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([prepare.command, release.command]);
    expect(screen.getByRole("heading", { name: "原闪光记录 · 序列 8 · 尚未释放" })).toBeTruthy(); expect(screen.queryByText(/第43周实际释放/)).toBeNull();
  });

  it("locks to the actual enabled CLOSE at zero resources and preserves failed release facts", async () => {
    const value = opened(); const { onCommand, rerender } = panel(recorder({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "missing-source");
    rerender(<RecorderPanel recorder={{ ...value, actions: [action({ type: "CLOSE", caseId: "missing-source" }, "旧接触不可结束", false), ...value.actions,
      action({ type: "RECORD", sample: "FLASH" }, "不应新记录"), action({ type: "REPORT", caseId: "flash-screen" }, "不应提前报告"),
      action({ type: "REFLECT" }, "不应提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不应提前赴冲突")] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement; expect(selector.value).toBe("flash-screen"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1); const close = screen.getByRole("button", { name: /^结束闪光实践并实际离场/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
    expect(screen.getByText("原记录ID：original-flash-41")).toBeTruthy();
  });

  it("does not synthesize CLOSE from historical result text or conceal ordinary completed outcomes", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "记录官成长下一步" }).textContent).toContain("查看当前公开结束选项");
    const ordinary = "玩家实际用普通方法复核资料，拒绝没有来源的请求，没有生成任何能力记录。";
    rerender(<RecorderPanel recorder={{ ...value, insideCase: false, acting: 100, digestion: "本阶段已消化", cases: cases().map((entry) => ({ ...entry, status: "RESOLVED", result: entry.id === "missing-source" ? ordinary : null })) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false); await userEvent.selectOptions(screen.getByRole("combobox"), "missing-source");
    expect(screen.getByText(ordinary)).toBeTruthy(); expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("blocks busy, blocked and save-error actions without hiding original records and supports reload errors", () => {
    const value = recorder({ promoted: true, cases: cases(), records: originals(), samples: samples(), actions: [action({ type: "RECORD", sample: "FLASH" }, "记录闪光"), action({ type: "OBSERVE", caseId: "flash-screen" }, "核对原现场")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<RecorderPanel recorder={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("原记录ID：original-flash-41")).toBeTruthy(); expect(screen.getByText("来源：萨芙的第40周原示范")).toBeTruthy();
    }
    rerender(<RecorderPanel recorder={opened()} resources={resources} busy={false} error={{ message: "原保存须重新加载", retryable: false }} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^结束闪光实践并实际离场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps public mastery and actual conflict options within finite recording and travel boundaries", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与原现场持棍者交涉", true, "1行动 · 实际交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担原现场战斗", true, "1行动 · 真实战斗风险");
    const { onCommand } = panel(recorder({ promoted: true, actions: [talk, fight], abilities: [{ id: "door.s6.recording", label: "有限记录", mastery: 23, description: "仅记录现场真实示范并接受实际判定。" }] }));
    const boundary = screen.getByRole("region", { name: "记录官能力边界" });
    ["失败也保留本次成本", "每份原记录只能释放一次", "三案均有普通核实路线", "尚无旅行家的自身旅行能力", "可以记录他人的旅行能力", "没有可用的真实旅行示范"].forEach((text) => expect(boundary.textContent).toContain(text));
    expect(screen.getByText("有限记录 · 掌握 23")).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限现场冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^与原现场持棍者交涉/ })); await userEvent.click(encounter.getByRole("button", { name: /^承担原现场战斗/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]); expect(screen.queryByRole("button", { name: /免费能力|自动记录|立即旅行/ })).toBeNull();
  });

  it("keeps all original astrologer cases, independent probe results and bottles read-only", () => {
    const astrologer: AstrologerProjection = {
      title: "占星人", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [], supplies: "原占星人成品耗用记录。",
      story: "两幅原画像的判断与核实保留。", environment: "原封信已经实际送达，原测试卡未被读取。",
      cases: [
        { id: "portrait-pair", title: "两幅原画像", story: "核对画师原账。", status: "RESOLVED", observations: ["原画像来自获准资料。"], preparation: "有限关联后普通核实。", result: "只确认当时有限对应。" },
        { id: "short-route", title: "同街原封信", story: "发现原松板。", status: "RESOLVED", observations: ["普通替代路可走。"], preparation: "实际检查原路线。", result: "原信已经普通送达。" },
        { id: "willing-probe", title: "会被抵抗的独立探测", story: "成年梅芙自愿参加原试验。", status: "RESOLVED", observations: ["梅芙自己的灵性6→5。"], preparation: "只准备本次有限干扰。", result: "梅芙实际掷7，成功率34%，仍然成功；没有读取原卡内容。" },
      ],
      actions: [{ id: "old-reflect", label: "不应重做旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "astrologer-old-original", title: "占星人旧原瓶", source: "诺拉原渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "astrologer-old-original", confirmed: true } }],
      abilities: [{ id: "door.s7.divination-interference", label: "原有限占卜干扰", mastery: 67, description: "对方仍可能实际成功。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险",
    };
    render(<RecorderAstrologerHistory astrologer={astrologer} />);
    const history = within(screen.getByRole("region", { name: "占星人时期的经历" }));
    ["原案卷ID：portrait-pair", "原案卷ID：short-route", "原案卷ID：willing-probe", "原瓶ID：astrologer-old-original", "梅芙自己的灵性6→5。",
      "当时的实际核实与试验：梅芙实际掷7，成功率34%，仍然成功；没有读取原卡内容。", "来源：诺拉原渠道", "已耗用 · 原失败保留",
      "原有限占卜干扰 · 掌握 67：对方仍可能实际成功。", astrologer.environment].forEach((text) => expect(history.getByText(text)).toBeTruthy());
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不应重做旧成长")).toBeNull();
  });
});
