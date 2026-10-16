/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpiritGuideAction, SpiritGuideCommand, SpiritGuideProjection } from "../../src/domain/spirit-guide/types";
import type { SpiritmediumProjection } from "../../src/domain/spiritmedium/types";
import { SpiritGuidePanel, SpiritGuideSpiritmediumHistory } from "../../src/renderer/SpiritGuidePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

// Synthetic public projections exercise rendering only; domain checks own actual resolution.
const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与灾难消耗这一原瓶，实际排异保留，可按公开休养与补给继续恢复。";
function action(command: SpiritGuideCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): SpiritGuideAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取死灵导师成品用药指导", true, "360便士 · 1行动");
function guide(patch: Partial<SpiritGuideProjection> = {}): SpiritGuideProjection {
  return {
    title: "死灵导师晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "通灵者扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    messenger: { recruited: false, deliveries: 0, letter: "DESK", replyReceived: false, feePaid: 0 }, ...patch,
  };
}
function cases(): SpiritGuideProjection["cases"] {
  return [
    { id: "messenger-terms", title: "灰羽的有限条款", story: "原导师请你先核对灰羽的能力、费用与停止边界，观察不等于实际招募。" },
    { id: "short-delivery", title: "相邻房间的原信", story: "同一封密封教学信仍在导师原桌，原收件人只在已知相邻看守房间接收。" },
    { id: "restless-echo", title: "现场滞留的回响", story: "近处原滞留灵尚未平静，有限亡者之语不保证奏效或取得可靠证词。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): SpiritGuideProjection {
  const originals = [
    { id: "spirit-guide-potion-1", title: "第一瓶死灵导师魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "spirit-guide-potion-2", title: "第二瓶死灵导师魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "spirit-guide-potion-3", title: "第三瓶死灵导师魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return guide({ guidanceKnown: true,
    supplies: "原三瓶独立成品，每瓶3320便士或五步劳务抵扣3000便士后另付320便士，下一周补货；不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): SpiritGuideProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const firstFailure = "本次实际亡者之语未能平复原滞留灵；原灵、原消耗和有限观察继续保留。";
function opened(): SpiritGuideProjection {
  return guide({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "restless-echo" ? {
      ...entry, status: "EXAMINED", observations: ["原滞留灵仍在原位置，没有因选择准备而消失。", firstFailure],
      preparation: "只对现场这一个滞留灵尝试有限亡者之语。", result: "原滞留灵仍未平静，须实际结束能力并离场。", contactOpen: "本次接触尚未实际结束",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "restless-echo" }, "结束亡者之语并实际离场", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: SpiritGuideProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SpiritGuidePanel spiritGuide={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("SpiritGuide public originals, bounded messenger and actual departure", () => {
  it("shows the public S7 maturity gate and supply without inventing a complete formula", () => {
    const reason = "通灵者扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "原指导者保管三瓶独立成品，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(guide({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "死灵导师成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "五步劳务抵扣3000便士后另付320便士", "完整魔药配方、材料与剂量仍未核实"]) expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取死灵导师成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards public guidance, per-bottle labour, payment and supply commands with exact costs", async () => {
    const commands: SpiritGuideCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "spirit-guide-potion-3" },
      { type: "BUY_POTION", bottleId: "spirit-guide-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(guide({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels original-bottle confirmation at zero AP and restores keyboard focus without a command", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶死灵导师魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶死灵导师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶死灵导师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶死灵导师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶死灵导师魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders public source, four-tier risk and current resources before confirming the selected original once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶死灵导师魔药」" }));
    expect(screen.getByText("spirit-guide-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "死灵导师服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶死灵导师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "spirit-guide-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("region", { name: "死灵导师能力与消化" })).toBeNull();
  });

  it("retains the submitted original on save failure and leaves same-envelope retry to the parent", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶死灵导师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶死灵导师魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<SpiritGuidePanel spiritGuide={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶死灵导师魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("spirit-guide-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<SpiritGuidePanel spiritGuide={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves a committed failed original and independently offers the remaining originals", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶死灵导师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶死灵导师魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<SpiritGuidePanel spiritGuide={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶死灵导师魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶死灵导师魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("spirit-guide-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after committed promotion while preserving the consumed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶死灵导师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶死灵导师魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升死灵导师" } : bottle) };
    rerender(<SpiritGuidePanel spiritGuide={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶死灵导师魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "死灵导师能力与消化" })).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升死灵导师")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("uses updated public bottle eligibility and risk without calculating a local result", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶死灵导师魔药」" }));
    const reason = "当前服药条件已变化，须先恢复精神。";
    const updated = { ...value, risk: "当前公开风险：原瓶仍在，未进行任何判定。", bottles: value.bottles.map((bottle) => bottle.id === "spirit-guide-potion-2" ? { ...bottle, chance: 19 } : bottle),
      actions: value.actions.map((entry) => entry.command.type === "CONSUME" && entry.command.bottleId === "spirit-guide-potion-2" ? { ...entry, enabled: false, reason } : entry) };
    rerender(<SpiritGuidePanel spiritGuide={updated} resources={{ ...resources, mind: 1 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("19%")).toBeTruthy(); expect(screen.getByText("1 / 100")).toBeTruthy(); expect(screen.getByText(updated.risk)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶死灵导师魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(document.getElementById(confirm.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
    fireEvent.click(confirm); await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("selects public cases and forwards exact methods without optimistic recruitment, payment or reports", async () => {
    const commands: SpiritGuideCommand[] = [{ type: "OBSERVE", caseId: "messenger-terms" },
      { type: "PREPARE", caseId: "messenger-terms", method: "ORDINARY" }, { type: "PREPARE", caseId: "messenger-terms", method: "ABILITY" },
      { type: "PERFORM", caseId: "messenger-terms" }, { type: "WITHDRAW", caseId: "messenger-terms" }, { type: "REPORT", caseId: "messenger-terms" }];
    const labels = ["核对灰羽的有限条款", "准备普通条款记录", "准备接受有限招募", "实际核验并实施", "撤回待执行准备", "提交有限报告"];
    const { onCommand } = panel(guide({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "short-delivery"); expect(screen.queryByRole("button", { name: /^实际核验并实施/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "messenger-terms");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    const messenger = within(screen.getByRole("region", { name: "灰羽与原信的实际状态" }));
    for (const text of ["尚未招募灰羽", "0便士", "仍在导师房间的原桌上", "尚未实际带回答复"]) expect(messenger.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "有限接触与实际结果" })).toBeNull();
  });

  it("shows accepted recruitment and its fee only when committed public state changes", async () => {
    const value = guide({ promoted: true, cases: cases(), actions: [action({ type: "PERFORM", caseId: "messenger-terms" }, "实际尝试招募灰羽", true, "1行动 · 12便士 · 实际判定")] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际尝试招募灰羽/ }));
    expect(screen.getByText("尚未招募灰羽")).toBeTruthy(); expect(screen.queryByText("已实际招募灰羽，受原有限条款约束")).toBeNull();
    const recruited = { ...value, messenger: { ...value.messenger, recruited: true, feePaid: 12 }, insideCase: true,
      actions: [action({ type: "CLOSE", caseId: "messenger-terms" }, "结束条款接触并实际离场", true, "0行动 · 0精神 · 0灵性")] };
    rerender(<SpiritGuidePanel spiritGuide={recruited} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已实际招募灰羽，受原有限条款约束")).toBeTruthy(); expect(screen.getByText("12便士")).toBeTruthy();
    expect(screen.getByText("仍在导师房间的原桌上")).toBeTruthy(); expect(screen.getByText("尚未实际带回答复")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^结束条款接触并实际离场/ }));
    expect(screen.getByText("已实际招募灰羽，受原有限条款约束")).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "PERFORM", caseId: "messenger-terms" }, { type: "CLOSE", caseId: "messenger-terms" }]);
  });

  it("preserves the actual original-letter destination, returned reply and resting messenger through CLOSE", async () => {
    const value = guide({ promoted: true, insideCase: true, cases: cases().map((entry) => entry.id === "short-delivery" ? { ...entry, result: "灰羽实际携同一原信完成一次递送并带回有限答复，现在按原约定休息。" } : entry),
      messenger: { recruited: true, deliveries: 1, letter: "RECIPIENT", replyReceived: true, feePaid: 12 },
      actions: [action({ type: "CLOSE", caseId: "short-delivery" }, "结束递送接触并实际离场", true, "0行动 · 0精神 · 0灵性")] });
    const { onCommand, rerender } = panel(value);
    const verifyLetter = () => {
      const state = screen.getByRole("region", { name: "灰羽与原信的实际状态" });
      for (const text of ["已在相邻已知看守房间的原收件人手中", "已经实际带回本次有限答复", "唯一原信已实际交付", "不能证明信件内容、灵体陈述或全部事实绝对真实"]) expect(state.textContent).toContain(text);
    };
    verifyLetter(); expect(screen.getByText("灰羽实际携同一原信完成一次递送并带回有限答复，现在按原约定休息。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^结束递送接触并实际离场/ })); verifyLetter();
    rerender(<SpiritGuidePanel spiritGuide={{ ...value, insideCase: false, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    verifyLetter(); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "short-delivery" });
    expect(screen.queryByRole("button", { name: /再次递送|派遣灰羽|加入战斗/ })).toBeNull();
  });

  it("keeps ordinary terms and player-carried delivery distinct from recruiting a messenger", async () => {
    const result = "玩家本人把同一原信交给相邻看守房间的原收件人，再实际带回有限答复；本次没有信使代劳。";
    const value = guide({ promoted: true, acting: 100, digestion: "本阶段已消化", cases: cases().map((entry) => ({ ...entry, status: "RESOLVED", result: entry.id === "short-delivery" ? result : null })),
      messenger: { recruited: false, deliveries: 1, letter: "RECIPIENT", replyReceived: true, feePaid: 0 }, actions: [] });
    const { onCommand, rerender } = panel(value); await userEvent.selectOptions(screen.getByRole("combobox"), "short-delivery");
    expect(screen.getByText(result)).toBeTruthy(); expect(screen.getByText("尚未招募灰羽")).toBeTruthy(); expect(screen.getByText("0便士")).toBeTruthy();
    expect(screen.getByText("已经实际带回本次有限答复")).toBeTruthy(); expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy();
    expect(screen.queryByText("灰羽实际携同一原信完成一次递送并带回有限答复，现在按原约定休息。")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
    // Even prior recruitment plus one delivered original does not prove gray-feather carried it.
    rerender(<SpiritGuidePanel spiritGuide={{ ...value, messenger: { ...value.messenger, recruited: true, feePaid: 12 } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已实际招募灰羽，受原有限条款约束")).toBeTruthy();
    expect(screen.queryByText("灰羽实际携同一原信完成一次递送并带回有限答复，现在按原约定休息。")).toBeNull();
    expect(screen.getByRole("region", { name: "灰羽与原信的实际状态" }).textContent).toContain("具体递送方式与灰羽状态以本案实际结果为准");
  });

  it("retains real lingering-spirit failure and shows later results only from the public projection", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(firstFailure)).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: /^结束亡者之语并实际离场/ }));
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
    const laterResult = "后续有限接触中原灵暂时平静；仅记录实际片段，不断言其陈述全部真实。";
    const closed = { ...value, insideCase: false, actions: [], cases: value.cases.map((entry) => entry.id === "restless-echo" ? { ...entry, contactOpen: "已实际结束", closes: 1, result: laterResult } : entry) };
    rerender(<SpiritGuidePanel spiritGuide={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(laterResult)).toBeTruthy(); expect(screen.getByText(/实际结束次数：1/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /复活|绝对控制|净化全部|重置灵体/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "restless-echo" });
  });

  it("locks selection to the enabled public CLOSE case even at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(guide({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "messenger-terms"); const value = opened();
    rerender(<SpiritGuidePanel spiritGuide={{ ...value, actions: [action({ type: "CLOSE", caseId: "messenger-terms" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "restless-echo" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "restless-echo" }, "不可撤回代替离场"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("restless-echo"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^结束亡者之语并实际离场/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "restless-echo" });
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
  });

  it("does not manufacture an exit from prose or infer an active contact from historical records", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "死灵导师成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("messenger-terms");
    rerender(<SpiritGuidePanel spiritGuide={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "restless-echo");
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("blocks busy, externally blocked and failed-save commands without hiding committed original facts", () => {
    const value = guide({ promoted: true, cases: cases(), messenger: { recruited: true, deliveries: 1, letter: "RECIPIENT", replyReceived: true, feePaid: 12 },
      actions: [action({ type: "OBSERVE", caseId: "messenger-terms" }, "核对实际条款"), action({ type: "REFLECT" }, "复盘实际结果")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<SpiritGuidePanel spiritGuide={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("已在相邻已知看守房间的原收件人手中")).toBeTruthy(); expect(screen.getByText("已经实际带回本次有限答复")).toBeTruthy();
    }
    rerender(<SpiritGuidePanel spiritGuide={opened()} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^结束亡者之语并实际离场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders three distinct public stories and disabled reasons without inventing dialogue or actions", async () => {
    const reason = "灰羽尚未接受本次公开有限条款。";
    const prepare = { ...action({ type: "PREPARE", caseId: "short-delivery", method: "ABILITY" }, "准备原信有限递送", false), reason };
    const value = guide({ promoted: true, cases: cases(), actions: [prepare] }); const { onCommand } = panel(value);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox"), entry.id); expect(screen.getByText(entry.story)).toBeTruthy();
      expect(screen.queryByRole("region", { name: "有限接触与实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "short-delivery");
    const button = screen.getByRole("button", { name: /^准备原信有限递送/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(reason); fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /立刻传送|免费招募|命令军队|结束能力/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only public mastery and the local messenger, truthful-reply and bounded dead-words limits", () => {
    const abilities = [{ id: "death.s6.spirit-recruitment", label: "有限灵体招募", mastery: 23, description: "实际接受原条款后才可尝试招募，信使仍有边界。" },
      { id: "death.s6.dead-words", label: "有限亡者之语", mastery: 41, description: "只对适用现场灵体尝试，不保证服从或回答可靠。" }];
    panel(guide({ promoted: true, acting: 100, abilities, cases: cases(), actions: [] }));
    expect(screen.getByText("有限灵体招募 · 掌握 23")).toBeTruthy(); expect(screen.getByText("有限亡者之语 · 掌握 41")).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "死灵导师能力边界" });
    expect(boundary.textContent).not.toContain("原创G");
    for (const text of ["支付12便士", "经实际判定", "观察与普通条款记录不会招募", "完成一次后休息", "三项主实践可和平完成本阶段消化100", "免费世界传送、军队或随身战斗同伴", "不会复活死者、绝对控制亡灵或保证回答真实", "冥界之门不属于本阶段能力"]) expect(boundary.textContent).toContain(text);
    expect(document.querySelector("audio, [data-spirit-truth], .spirit-guide-success")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps optional encounter talk and real combat separate from a messenger companion", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与现场持棍者交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担原现场短棍战", true, "1行动 · 真实战斗风险");
    const environment = "原现场有普通退路，原货物仍属于货主，灰羽并未登记为战斗同伴。";
    const { onCommand } = panel(guide({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限现场冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^与现场持棍者交涉/ })); await userEvent.click(encounter.getByRole("button", { name: /^承担原现场短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /召唤灰羽|灰羽出战|免费胜利/ })).toBeNull(); expect(screen.queryByRole("region", { name: "有限接触与实际结果" })).toBeNull();
  });

  it("keeps old spiritmedium observations, original-object history, IDs, bottles and abilities read-only", () => {
    const spiritmedium: SpiritmediumProjection = {
      title: "通灵者", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原通灵者库存与耗用记录保留。", story: "原普通核实已完成。", environment: "原纸卡已实际从桌面移至原托盘。",
      cases: [{ id: "wind-assistance", title: "原纸卡借力", story: "首次原灵借力失败，实际消耗保留；后来重做。", status: "RESOLVED",
        observations: ["原纸卡与原托盘均已核对。"], preparation: "只让原灵协助这一原纸卡。", result: "原纸卡实际移动，不等于灵体陈述全为真。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "spiritmedium-old", title: "通灵者旧原瓶", source: "通灵者原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "spiritmedium-old", confirmed: true } }],
      abilities: [{ id: "death.s7.spirit-borrowing", label: "原有限灵体借力", mastery: 67, description: "只保留已实际接触原灵与原物的记录。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<SpiritGuideSpiritmediumHistory spiritmedium={spiritmedium} />);
    const history = within(screen.getByRole("region", { name: "通灵者时期的经历" }));
    for (const text of ["首次原灵借力失败，实际消耗保留；后来重做。", "原纸卡与原托盘均已核对。", "原案卷ID：wind-assistance", "原瓶ID：spiritmedium-old",
      "当时的方式与准备：只让原灵协助这一原纸卡。", "当时的实际核实与报告：原纸卡实际移动，不等于灵体陈述全为真。", "来源：通灵者原独立成品渠道", "已耗用 · 原失败保留",
      "原有限灵体借力 · 掌握 67：只保留已实际接触原灵与原物的记录。", spiritmedium.environment]) expect(history.getByText(text)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });
});
