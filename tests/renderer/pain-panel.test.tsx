/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PainAction, PainCommand, PainProjection } from "../../src/domain/pain/types";
import type { PleasureProjection } from "../../src/domain/pleasure/types";
import { PainPanel, PainPleasureHistory } from "../../src/renderer/PainPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；欢愉消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
const bodyChange = "序列7原身体变化保持原样；序列5不发生第二次身体变化。";
function action(command: PainCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): PainAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取痛苦魔女成品用药指导", true, "460便士 · 1行动");
const noDisease: PainProjection["diseaseState"] = {
  fieldActive: false, enemyDisease: 0, diseaseApplications: 0, care: "NONE", enemyHealth: 100, enemyStatus: "NOT_MET",
};
const originalPractice: NonNullable<PainProjection["practice"]> = {
  position: "本人在原入口，成年拉维妮在原等候点；同一木标记PN5-MARKER-1仍在原架。",
  records: "原虚构情境卡PN5-CASE-NOTES-1尚未填入本次三行比较。",
  care: "同一原纸PN5-CARE-NOTE-1仍为空白，尚未交接。",
  history: [],
};
function pain(patch: Partial<PainProjection> = {}): PainProjection {
  return {
    title: "痛苦魔女晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", inheritedTools: "原镜片与粉末按已保存记录保留。", bodyChange,
    actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "欢愉扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, diseaseState: { ...noDisease }, ...patch,
  };
}
function cases(): PainProjection["cases"] {
  return [
    { id: "exit-markers", title: "原通路的疏散演练", story: "双方约定普通模拟，沿原4米通路走到安全标记；不让志愿者染病。" },
    { id: "symptom-table", title: "虚构情境的三行比较", story: "只比较原情境卡的三个虚构时间点，不采集样本或诊断。" },
    { id: "care-handoff", title: "同一张演练便条", story: "成年拉维妮自愿请你写下并交接这张虚构演练便条。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次演练", closes: 0 }));
}
function bottled(): PainProjection {
  const originals = [
    { id: "pain-potion-1", title: "第一瓶痛苦魔女魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "pain-potion-2", title: "第二瓶痛苦魔女魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "pain-potion-3", title: "第三瓶痛苦魔女魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return pain({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): PainProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "本次知识核对未通过；双方已沿原4米通路到达安全标记，原标记已实际放在原门旁，失败与动作保留。";
function opened(): PainProjection {
  return pain({ promoted: true, insideCase: true, actions: [
    action({ type: "CLOSE", caseId: "exit-markers" }, "双方沿原路走回并归还同一木标记", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "REPORT", caseId: "exit-markers" }, "提交本次有限报告", false),
  ], cases: cases().map((entry) => entry.id === "exit-markers" ? {
    ...entry, status: "EXAMINED", observations: ["本次普通演练已取得双方自愿同意。", failure],
    preparation: "只约定普通演练，不施加疾病。", contactOpen: "本次演练尚未实际结束",
  } : entry), practice: { ...originalPractice,
    position: "双方实际已在原4米外安全标记，同一木标记在原门旁；拉维妮没有感染。",
    history: ["实付1行动，已完成原路线走动；核对失败未被改写为成功。"] } });
}
function panel(value: PainProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PainPanel pain={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Pain public defense, real injuries and independent original bottles", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "欢愉扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(pain({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "痛苦魔女成长下一步" });
    expect(summary.textContent).toContain("欢愉6 → 痛苦魔女5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方与晋升仪式细节尚未掌握");
    expect(summary.textContent).toContain("服药前仍须完成准备");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取痛苦魔女成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: PainCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "pain-potion-3" },
      { type: "BUY_POTION", bottleId: "pain-potion-3" }, { type: "BUY_POTION", bottleId: "pain-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(pain({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["pain-potion-1", "pain-potion-2", "pain-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "pain-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("pain-potion-2"));
    expect(screen.getByText("pain-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "痛苦魔女服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶痛苦魔女魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "痛苦魔女能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("pain-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶痛苦魔女魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<PainPanel pain={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶痛苦魔女魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("pain-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<PainPanel pain={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<PainPanel pain={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶痛苦魔女魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶痛苦魔女魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("pain-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶痛苦魔女魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<PainPanel pain={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*pain-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("pain-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("pain-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶痛苦魔女魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("pain-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶痛苦魔女魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升痛苦魔女" } : bottle) };
    rerender(<PainPanel pain={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶痛苦魔女魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "痛苦魔女能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升痛苦魔女")).toBeTruthy();
    expect(screen.getByText("原瓶ID：pain-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("pain-potion-2"));
    expect(screen.getByText("pain-potion-2")).toBeTruthy();
    rerender(<PainPanel pain={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶痛苦魔女魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("pain-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<PainPanel pain={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶痛苦魔女魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });


  it("forwards only the projected ordinary case intents without optimistic movement, notes or disease", async () => {
    const commands: PainCommand[] = [{ type: "OBSERVE", caseId: "exit-markers" },
      { type: "PREPARE", caseId: "exit-markers", method: "ORDINARY" },
      { type: "PERFORM", caseId: "exit-markers" }, { type: "WITHDRAW", caseId: "exit-markers" },
      { type: "REPORT", caseId: "exit-markers" }];
    const labels = ["核对原通路与本人意见", "准备普通模拟演练", "实际沿原4米通路走动", "撤回尚未执行准备", "提交本次普通演练报告"];
    const { onCommand } = panel(pain({ promoted: true, cases: cases(), practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!)) }));
    expect(screen.getAllByRole("option")).toHaveLength(3);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const text of [originalPractice.position, originalPractice.records, originalPractice.care]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText("0 / 3")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "痛苦魔女实际结果" })).toBeNull();
    expect(screen.queryByRole("button", { name: /实际感染|疾病模拟施放|疾病能力练习/ })).toBeNull();
  });

  it("keeps preparation outside the scene and prioritizes the actual ordinary performance over withdrawal", () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "care-handoff" }, "撤回本次便条准备", true, "0行动");
    const perform = action({ type: "PERFORM", caseId: "care-handoff" }, "实际填写并尝试交接同一原纸", true, "1行动 · 0灵性");
    panel(pain({ promoted: true, cases: cases().map((entry) => entry.id === "care-handoff"
      ? { ...entry, status: "PREPARED", preparation: "仅约定普通纸面演练，原纸仍为空白。" } : entry),
      actions: [withdraw, perform], practice: originalPractice }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "痛苦魔女成长下一步" }).textContent).toContain(`下一步：${perform.label}`);
    expect(screen.getByText(originalPractice.care)).toBeTruthy();
  });

  it("pins the actual scene to public CLOSE at zero resources and retains movement and failure until saved return", async () => {
    const { onCommand, rerender } = panel(pain({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "care-handoff");
    const value = opened();
    rerender(<PainPanel pain={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("exit-markers"); expect(selector.disabled).toBe(true);
    expect(screen.getByText(failure)).toBeTruthy(); expect(screen.getByText(value.practice!.position)).toBeTruthy();
    const close = screen.getByRole("button", { name: /^双方沿原路走回并归还同一木标记/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(screen.getByText(value.practice!.position)).toBeTruthy();
    const position = "双方实际沿原4米通路走回原入口与原等候点，同一木标记归回原架；仍无疾病。";
    rerender(<PainPanel pain={{ ...value, insideCase: false, actions: [], practice: { ...value.practice!, position },
      cases: value.cases.map((entry) => entry.id === "exit-markers" ? { ...entry, contactOpen: "已实际结束", closes: 1 } : entry) }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(position)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy(); expect(selector.disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it("prefers an enabled public exit over a stale disabled close and never fabricates an exit", async () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "care-handoff" }, "撤回尚未执行的原纸准备", true, "0行动");
    const value = { ...opened(), actions: [action({ type: "CLOSE", caseId: "exit-markers" }, "旧演练不可重复结束", false), withdraw] };
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("care-handoff");
    expect(screen.getByRole("region", { name: "痛苦魔女成长下一步" }).textContent).toContain(withdraw.label);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${withdraw.label}`) }));
    rerender(<PainPanel pain={{ ...value, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "痛苦魔女成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
  });

  it("retains actual three written fictional rows on failure and after close without implying a diagnosis", async () => {
    const records = "原PN5-CASE-NOTES-1已实际填写三行：0、1、2个虚构回合；没有真实感染、标本或诊断。";
    const result = "知识核对失败；同一原表三行仍在，未通过本次比较报告。";
    const close = action({ type: "CLOSE", caseId: "symptom-table" }, "将同一原情境卡放回原文件夹", true, "0行动 · 0灵性");
    const value = pain({ promoted: true, insideCase: true, practice: { ...originalPractice, records }, actions: [close],
      cases: cases().map((entry) => entry.id === "symptom-table" ? { ...entry, status: "EXAMINED", result } : entry) });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("symptom-table");
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${close.label}`) }));
    expect(screen.getByText(records)).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy();
    rerender(<PainPanel pain={{ ...value, insideCase: false, actions: [], practice: { ...value.practice!, history: ["同一原卡已放回原文件夹，实际三行与失败仍保留。"] } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(records)).toBeTruthy(); expect(screen.getByText(result)).toBeTruthy(); expect(screen.getByText("0 / 3")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it.each([
    ["失败", "同一PN5-CARE-NOTE-1已写好但未被接收，仍由玩家实际持有。", "同一已写便条已实际放回原桌，失败记录仍保留。"],
    ["成功", "同一PN5-CARE-NOTE-1已交给自愿接收的拉维妮。", "拉维妮仍持有同一已交接原纸，没有复制便条。"],
  ])("renders the exact saved %s note holder and close without treatment or replacement", async (_tier, care, closedCare) => {
    const close = action({ type: "CLOSE", caseId: "care-handoff" }, "实际收束本次原纸交接", true, "0行动");
    const value = pain({ promoted: true, insideCase: true, cases: cases(), practice: { ...originalPractice, care }, actions: [close] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText(care)).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${close.label}`) }));
    expect(screen.getByText(care)).toBeTruthy();
    rerender(<PainPanel pain={{ ...value, insideCase: false, actions: [], practice: { ...value.practice!, care: closedCare } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(closedCare)).toBeTruthy(); expect(screen.getByText("0 / 3")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("allows all three ordinary preparations and displays peaceful 100 without increasing projected disease mastery", async () => {
    const commands: PainCommand[] = cases().map((entry) => ({ type: "PREPARE", caseId: entry.id, method: "ORDINARY" }));
    const labels = ["准备原通路演练", "准备虚构表格比较", "准备同一原纸交接"];
    const abilities = [{ id: "assassin.s5.disease", label: "超自然疾病", mastery: 0, description: "实际施用另行记录。" }];
    const { onCommand, rerender } = panel(pain({ promoted: true, cases: cases(), practice: originalPractice, abilities,
      actions: commands.map((command, index) => action(command, labels[index]!, true, "1行动 · 0灵性")) }));
    for (let index = 0; index < commands.length; index++) {
      await userEvent.selectOptions(screen.getByRole("combobox"), cases()[index]!.id);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${labels[index]!}`) }));
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    rerender(<PainPanel pain={pain({ promoted: true, acting: 100, digestion: "本作G非伤害替代路线已消化", actions: [], abilities,
      cases: cases().map((entry) => ({ ...entry, status: "RESOLVED", closes: 1, result: "普通演练已报告，没有实际疾病施用。" })), practice: originalPractice })}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("progressbar", { name: "痛苦魔女扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByText("超自然疾病 · 掌握 0")).toBeTruthy(); expect(screen.getByText("0 / 3")).toBeTruthy();
    expect(screen.getByRole("region", { name: "痛苦魔女成长下一步" }).textContent).toContain("这一阶段已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders actual persistent disease when DEFEND or departure has stopped further exposure", () => {
    const value = pain({ promoted: true, actions: [], diseaseState: { ...noDisease, fieldActive: true, enemyDisease: 2,
      diseaseApplications: 1, enemyHealth: 70, enemyStatus: "RESISTING" } });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText("正在维持，仍可能发生新暴露")).toBeTruthy(); expect(screen.getByText("2 / 3")).toBeTruthy();
    rerender(<PainPanel pain={{ ...value, diseaseState: { ...value.diseaseState, fieldActive: false, enemyStatus: "LEFT" } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    const state = within(screen.getByRole("region", { name: "本场已保存的疾病与援助" }));
    for (const text of ["未在维持，不再追加新暴露", "2 / 3", "70 / 100", "已离开冲突", "1"]) expect(state.getByText(text)).toBeTruthy();
    expect(state.getByText(/停场和离开不会清除/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "痛苦魔女有限冲突" }).textContent).toContain("防守（DEFEND）会停止后续暴露");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards aid only as the projected paid help request and keeps the same illness and health after saved aid", async () => {
    const aid = action({ type: "ENCOUNTER_AID" }, "实际请求传讯与车马援助", true, "1行动 · 40便士 · 不保证治愈");
    const value = pain({ promoted: true, actions: [aid], diseaseState: { ...noDisease, enemyDisease: 3,
      diseaseApplications: 1, enemyHealth: 70, enemyStatus: "SURRENDERED" } });
    const { onCommand, rerender } = panel(value);
    const encounter = within(screen.getByRole("region", { name: "痛苦魔女有限冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^实际请求传讯与车马援助/ }));
    expect(screen.getByText("尚未请求后续援助")).toBeTruthy();
    rerender(<PainPanel pain={{ ...value, actions: [], diseaseState: { ...value.diseaseState, care: "REQUESTED" } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    const state = within(screen.getByRole("region", { name: "本场已保存的疾病与援助" }));
    for (const text of ["3 / 3", "70 / 100", "已自行投降", "已实际请求传讯与车马协助；尚无治愈结果"]) expect(state.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(aid.command);
  });

  it("does not invent aid for a dead opponent or infer death from health or old prose", () => {
    const { onCommand, rerender } = panel(pain({ promoted: true, actions: [], environment: "旧说法含伤势，不决定现在生死。",
      diseaseState: { ...noDisease, enemyDisease: 1, enemyHealth: 0, enemyStatus: "DEAD" } }));
    expect(screen.getByText("已经死亡")).toBeTruthy(); expect(screen.getByText("1 / 3")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    rerender(<PainPanel pain={pain({ promoted: true, actions: [], diseaseState: { ...noDisease, enemyHealth: 0, enemyStatus: "LEFT" } })}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已离开冲突")).toBeTruthy(); expect(screen.queryByText("已经死亡")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards talk and fight without promising immunity, supernatural control or victory", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "向奥伦当面交涉", true, "1行动");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担空院真实冲突", true, "1行动 · 真实风险");
    const { onCommand } = panel(pain({ promoted: true, actions: [talk, fight] }));
    const element = screen.getByRole("region", { name: "痛苦魔女有限冲突" });
    for (const text of ["奥伦", "自己的普通短棍", "对方不追击", "现场没有旁观者", "不表示同伴自动免疫疾病", "不会自动治愈原对手"]) expect(element.textContent).toContain(text);
    const encounter = within(element);
    await userEvent.click(encounter.getByRole("button", { name: /^向奥伦当面交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担空院真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.getByText("0 / 3")).toBeTruthy();
  });

  it("keeps inherited originals and paid supply/prepared-mirror intents without optimistic replenishment", async () => {
    const supplies = action({ type: "BUY_SUPPLIES" }, "购入有记录的原粉末与镜片", true, "1行动 · 80便士");
    const mirror = action({ type: "PREPARE_MIRROR" }, "实际准备已持原镜片", true, "1行动 · 持有的原镜片");
    const inheritedTools = "原镜片已经耗用一片；当前粉末2份，尚未准备镜替。";
    const { onCommand } = panel(pain({ promoted: true, actions: [supplies, mirror], inheritedTools }));
    await userEvent.click(screen.getByRole("button", { name: /^购入有记录的原粉末与镜片/ }));
    await userEvent.click(screen.getByRole("button", { name: /^实际准备已持原镜片/ }));
    expect(screen.getByText(inheritedTools)).toBeTruthy(); expect(screen.getByText(bodyChange)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([supplies.command, mirror.command]);
    expect(screen.queryByRole("button", { name: /免费镜替|复制原瓶|再次身体转变/ })).toBeNull();
  });

  it("displays disabled reasons and blocks busy, external blockers and save failures without hiding original facts", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    const report = screen.getByRole("button", { name: /^提交本次有限报告/ }) as HTMLButtonElement;
    expect(report.disabled).toBe(true); expect(document.getElementById(report.getAttribute("aria-describedby")!)?.textContent).toBe(value.actions[1]!.reason);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<PainPanel pain={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.practice!.position)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    }
    rerender(<PainPanel pain={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("reads only the public projection without inferring state, secret rolls or controls from hidden-shaped extras", () => {
    const value = { ...opened(), insideCase: false, actions: [], practice: null,
      npcPrivateThought: "SECRET_VOLUNTEER_THOUGHT", nextDiseaseRoll: "SECRET_DISEASE_ROLL", rngSeed: "SECRET_SEED" };
    const { onCommand } = panel(value);
    expect(screen.queryByRole("region", { name: "已保存的普通演练与原物记录" })).toBeNull();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    for (const text of [value.npcPrivateThought, value.nextDiseaseRoll, value.rngSeed]) expect(screen.queryByText(text)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps player boundaries folded, preserves body history and shows only projected mastery", () => {
    const abilities = [{ id: "assassin.s5.disease", label: "超自然疾病", mastery: 8, description: "实际成功施用记录。" },
      { id: "assassin.s6.silk-binding", label: "原丝线", mastery: 49, description: "原ID及掌握保留。" }];
    panel(pain({ promoted: true, actions: [], abilities, practice: originalPractice }));
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByLabelText("痛苦魔女能力边界"); expect((boundary as HTMLDetailsElement).open).toBe(false);
    for (const text of ["SIMULATION", "自愿", "普通演练不增加疾病能力掌握", "PN5-MARKER-1", "PN5-CASE-NOTES-1", "PN5-CARE-NOTE-1",
      "每项有限报告25与反思25组成和平消化100", "非伤害替代路线", "不代表完整扮演", "失败仍消耗", "防守（DEFEND）停止新暴露", "疾病强度仍保留",
      "没有同伴自动免疫", "不重复相乘", "援助（AID）", "原能力ID和掌握", "序列7原身体变化保留", "序列4绝望", "神话生物形态", "晋升仪式细节尚未掌握"])
      expect(boundary.textContent).toContain(text);
    expect(boundary.textContent).toContain("本阶段不提供序列4绝望的神话生物形态与更高阶瘟疫");
    for (const text of ["本场强度0至3", "约50米和20至30秒", "首次尝试施病支付4灵性", "新回合维持支付2灵性"]) expect(boundary.textContent).toContain(text);
    for (const marker of ["本作原创G", "原著", "待核实", "尚未开放"]) expect(boundary.textContent).not.toContain(marker);
    expect(screen.getByText(bodyChange)).toBeTruthy(); expect(screen.queryByRole("button", { name: /自动治愈|友军免疫|神话形态/ })).toBeNull();
  });

  it("preserves the original S6 formula, body change, tools, refusal, physical silk records and bottles as read-only history", () => {
    const pleasure: PleasureProjection = {
      title: "欢愉魔女", discovered: true, formulaKnown: true, promoted: true,
      formula: [{ name: "魅欲女妖全部残留毛发", quantity: null, unit: "全部", note: "原整体一份，不新增克重" },
        { name: "纯水", quantity: 100, unit: "毫升" }],
      supplies: "原七件材料与耗用记录保留。", story: "原三案与实际失败保留。", environment: "原马伦重伤投降，旧伤势保留。",
      inheritedTools: "原镜片已碎，原粉末剩余两份。", bodyChange,
      cases: [{ id: "refused-invitation", title: "原拒绝与改约", story: "原邀请当面被拒绝，后来跨周改约。", status: "RESOLVED",
        observations: ["当时本人明确拒绝，未被魅惑改写。"], preparation: "只按本次普通交流范围改约。", contactOpen: "已实际结束", closes: 2,
        result: "跨周复核仍保留原失败与普通方式。" }],
      practice: { wrist: "FREE", wristConsent: true, invitationWilling: false, fireSilk: "CLEARED", fireBreak: "BLACK_FLAME" },
      actions: [{ id: "old-reflect", label: "不可重做旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "pleasure-old", title: "欢愉旧原瓶", source: "原七料独立调配", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "pleasure-old", confirmed: true } }],
      abilities: [{ id: "assassin.s6.silk-binding", label: "原丝缚", mastery: 67, description: "保留原实际建立与解除记录。" },
        { id: "assassin.s6.charm", label: "原魅惑", mastery: 0, description: "不替代本人意愿。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<PainPleasureHistory pleasure={pleasure} />);
    const history = within(screen.getByRole("region", { name: "欢愉时期的经历" }));
    for (const text of [pleasure.supplies, pleasure.story!, pleasure.environment, pleasure.inheritedTools, bodyChange,
      "原案卷ID：refused-invitation", "原邀请当面被拒绝，后来跨周改约。", "当时本人明确拒绝，未被魅惑改写。",
      "当时的方式与准备：只按本次普通交流范围改约。", "当时的实际结果与报告：跨周复核仍保留原失败与普通方式。",
      "已记录当时的自愿同意", "原丝线或绳圈接触已解除", "当时本人尚未同意邀请", "原断丝已实际清理", "继承黑焰",
      "全部", "原整体一份，不新增克重", "100 毫升", "原瓶ID：pleasure-old", "来源：原七料独立调配", "已耗用 · 原失败保留"])
      expect(history.getByText(text)).toBeTruthy();
    for (const ability of pleasure.abilities) expect(history.getByText(`${ability.label} · 掌握 ${ability.mastery}：${ability.description}`)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可重做旧成长")).toBeNull(); expect(history.queryByLabelText("本场已保存的疾病与援助")).toBeNull();
  });
});
