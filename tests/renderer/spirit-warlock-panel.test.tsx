/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpiritWarlockAction, SpiritWarlockCommand, SpiritWarlockProjection } from "../../src/domain/spirit-warlock/types";
import type { SootherProjection } from "../../src/domain/soother/types";
import { SpiritWarlockSootherHistory, SpiritWarlockPanel } from "../../src/renderer/SpiritWarlockPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；安魂师消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: SpiritWarlockCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): SpiritWarlockAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取灵巫成品用药指导", true, "460便士 · 1行动");
function spiritWarlock(patch: Partial<SpiritWarlockProjection> = {}): SpiritWarlockProjection {
  return {
    title: "灵巫晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "安魂师扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", companion: null, practice: null, ...patch,
  };
}
function cases(): SpiritWarlockProjection["cases"] {
  return [
    { id: "listening-leaves", title: "庭院听叶", story: "原庭院老榆树旁的卷叶，只回应有限的叶动。" },
    { id: "original-message", title: "同一原纸条", story: "导师原纸条沿清楚可见的普通两米路径递给同意的成年梅森。" },
    { id: "quiet-coordination", title: "安静协作", story: "成年梅森自愿在原椅休息；本人不动，原灵体仅给一次约定叶动。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
const originalCompanion: NonNullable<SpiritWarlockProjection["companion"]> = {
  name: "卷叶", source: "SW5-LEAF-1 · 原庭院老榆树", status: "未遇见原灵体，未封印或派出", history: [],
};
const originalPractice: NonNullable<SpiritWarlockProjection["practice"]> = {
  note: "SW5-NOTE-1仍在导师原桌上", dream: "没有开启梦境", summary: "实际递送0次 · 交回0次 · 协同核对0次",
};
function bottled(): SpiritWarlockProjection {
  const originals = [
    { id: "spirit-warlock-potion-1", title: "第一瓶灵巫魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "spirit-warlock-potion-2", title: "第二瓶灵巫魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "spirit-warlock-potion-3", title: "第三瓶灵巫魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return spiritWarlock({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): SpiritWarlockProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：能力核对未通过，已消耗3灵性，卷叶与原纸条没有复制。";
function opened(): SpiritWarlockProjection {
  return spiritWarlock({ promoted: true, insideCase: true, actions: [
    action({ type: "PERFORM", caseId: "original-message" }, "实际递送原纸条", true, "1行动 · 本次实际成本"),
    action({ type: "CLOSE", caseId: "original-message" }, "实际结束接触并召回", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "WITHDRAW", caseId: "original-message" }, "撤回尚未实施的准备", true, "0行动 · 保留原成本"),
  ], cases: cases().map((entry) => entry.id === "original-message" ? {
    ...entry, status: "EXAMINED", observations: ["本次已核对同一原纸条。", failure],
    preparation: "已准备本次有限递送。", contactOpen: "本次接触尚未实际结束",
  } : entry), companion: { ...originalCompanion, status: "已派出同一卷叶", history: ["第54周取得同一原灵体。", "实际派出1次，尚未召回。"] },
    practice: { ...originalPractice, note: "SW5-NOTE-1现在由梅森保管", summary: "实际递送1次 · 交回0次 · 协同核对0次" } });
}
function panel(value: SpiritWarlockProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SpiritWarlockPanel spiritWarlock={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("SpiritWarlock actual original companion, note, dream and independent bottles", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "安魂师扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(spiritWarlock({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "灵巫成长下一步" });
    expect(summary.textContent).toContain("安魂师6 → 灵巫5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方、晋升仪式与具体法术清单尚未核实");
    expect(summary.textContent).toContain("不能据此断言无需仪式");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取灵巫成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: SpiritWarlockCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "spirit-warlock-potion-3" },
      { type: "BUY_POTION", bottleId: "spirit-warlock-potion-3" }, { type: "BUY_POTION", bottleId: "spirit-warlock-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(spiritWarlock({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["spirit-warlock-potion-1", "spirit-warlock-potion-2", "spirit-warlock-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "spirit-warlock-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("spirit-warlock-potion-2"));
    expect(screen.getByText("spirit-warlock-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "灵巫服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶灵巫魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "灵巫能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("spirit-warlock-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶灵巫魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<SpiritWarlockPanel spiritWarlock={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶灵巫魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("spirit-warlock-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<SpiritWarlockPanel spiritWarlock={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<SpiritWarlockPanel spiritWarlock={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶灵巫魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶灵巫魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("spirit-warlock-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶灵巫魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<SpiritWarlockPanel spiritWarlock={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*spirit-warlock-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("spirit-warlock-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("spirit-warlock-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶灵巫魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("spirit-warlock-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶灵巫魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升灵巫" } : bottle) };
    rerender(<SpiritWarlockPanel spiritWarlock={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶灵巫魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "灵巫能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升灵巫")).toBeTruthy();
    expect(screen.getByText("原瓶ID：spirit-warlock-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("spirit-warlock-potion-2"));
    expect(screen.getByText("spirit-warlock-potion-2")).toBeTruthy();
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶灵巫魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("spirit-warlock-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<SpiritWarlockPanel spiritWarlock={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶灵巫魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards only the selected public method without acquiring a spirit or delivering a note optimistically", async () => {
    const commands: SpiritWarlockCommand[] = [{ type: "OBSERVE", caseId: "original-message" },
      { type: "PREPARE", caseId: "original-message", method: "ORDINARY" },
      { type: "PREPARE", caseId: "original-message", method: "ABILITY" },
      { type: "PERFORM", caseId: "original-message" }, { type: "WITHDRAW", caseId: "original-message" },
      { type: "CLOSE", caseId: "original-message" }, { type: "REPORT", caseId: "original-message" }];
    const labels = ["核对原纸条", "准备普通本人递送", "准备原灵体递送", "实际递送", "撤回准备", "结束接触", "提交有限报告"];
    const value = spiritWarlock({ promoted: true, cases: cases(), companion: originalCompanion, practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "listening-leaves");
    expect(screen.queryByRole("button", { name: /^实际递送/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "original-message");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.getByText(originalCompanion.status)).toBeTruthy();
    expect(screen.getByText(originalPractice.note)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.queryByRole("region", { name: "灵巫实际结果" })).toBeNull();
  });

  it("prioritizes enabled CLOSE then WITHDRAW at zero resources and uses the active public case", async () => {
    const { onCommand, rerender } = panel(spiritWarlock({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "quiet-coordination");
    const value = opened();
    rerender(<SpiritWarlockPanel spiritWarlock={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("original-message"); expect(selector.disabled).toBe(true);
    const summary = screen.getByRole("region", { name: "灵巫成长下一步" });
    expect(summary.textContent).toContain("下一步：实际结束接触并召回");
    const close = screen.getByRole("button", { name: /^实际结束接触并召回/ }) as HTMLButtonElement;
    const perform = screen.getByRole("button", { name: /^实际递送原纸条/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(perform.disabled).toBe(false);
    expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(perform); await userEvent.click(close);
    const onlyWithdraw = { ...value, actions: [action({ type: "CLOSE", caseId: "listening-leaves" }, "旧案不能结束", false),
      action({ type: "PERFORM", caseId: "original-message" }, "现在不能递送", false), value.actions[2]!] };
    rerender(<SpiritWarlockPanel spiritWarlock={onlyWithdraw} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(summary.textContent).toContain("下一步：撤回尚未实施的准备");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("original-message");
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未实施的准备/ }));
    expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[1]!.command, value.actions[2]!.command]);
  });

  it("renders one real companion source and committed history through invitation, deployment, recall and release", async () => {
    const invite = action({ type: "INVITE_SPIRIT" }, "邀请原庭院卷叶", true, "1行动 · 3灵性 · 意志14");
    const recall = action({ type: "RECALL_SPIRIT" }, "召回同一卷叶", true, "0行动 · 0精神 · 0灵性");
    const release = action({ type: "RELEASE_SPIRIT" }, "释放回原庭院", true, "0行动 · 0精神 · 0灵性");
    const history = ["第54周邀请失败，未收容，消耗保留。", "第55周自愿寄居于同一牙齿媒介。", "已实际派出1次。"];
    const value = spiritWarlock({ promoted: true, cases: cases(), companion: originalCompanion, practice: originalPractice, actions: [invite] });
    const { onCommand, rerender } = panel(value);
    const companion = screen.getByRole("region", { name: "灵巫原灵体与实际经历" });
    expect(within(companion).getByText(originalCompanion.source)).toBeTruthy();
    expect(companion.textContent).toContain("尚无已保存的邀请、收容或协作经历");
    await userEvent.click(screen.getByRole("button", { name: /^邀请原庭院卷叶/ }));
    expect(companion.textContent).toContain(originalCompanion.status);
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...value, insideCase: true, actions: [recall],
      companion: { ...originalCompanion, status: "同一原灵体已派出", history } }}
      resources={{ ...resources, spirituality: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    for (const entry of history) expect(within(companion).getByText(entry)).toBeTruthy();
    expect(screen.getByRole("region", { name: "灵巫成长下一步" }).textContent).toContain("下一步：召回同一卷叶");
    await userEvent.click(screen.getByRole("button", { name: /^召回同一卷叶/ }));
    expect(companion.textContent).toContain("同一原灵体已派出");
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...value, actions: [release],
      companion: { ...originalCompanion, status: "同一卷叶已召回媒介", history: [...history, "已实际召回1次。"] } }}
      resources={{ ...resources, spirituality: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^释放回原庭院/ }));
    expect(companion.textContent).toContain("同一卷叶已召回媒介");
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...value, actions: [],
      companion: { ...originalCompanion, status: "原卷叶已回到同一庭院", history: [...history, "已实际召回1次。", "已释放1次，原取得周保留。"] } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    for (const entry of history) expect(within(companion).getByText(entry)).toBeTruthy();
    expect(within(companion).getByText(originalCompanion.source)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([invite.command, recall.command, release.command]);
  });

  it("keeps a delivered original after CLOSE and exposes zero-AP RETRIEVE_NOTE until the saved handback", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际结束接触并召回/ }));
    const retrieve = action({ type: "RETRIEVE_NOTE" }, "由梅森交回同一原纸条", true, "0行动 · 0精神 · 0灵性");
    const report = action({ type: "REPORT", caseId: "original-message" }, "取回后报告原件去向", false);
    const closed = { ...value, insideCase: true, actions: [action({ type: "CLOSE", caseId: "listening-leaves" }, "旧案已结束", false), retrieve, report],
      cases: value.cases.map((entry) => entry.id === "original-message" ? { ...entry, closes: 1, contactOpen: "接触已结束，原纸条尚未交回" } : entry) };
    rerender(<SpiritWarlockPanel spiritWarlock={closed} resources={{ ...resources, spirituality: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("original-message");
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(value.practice!.note)).toBeTruthy();
    expect(screen.getByRole("region", { name: "灵巫成长下一步" }).textContent).toContain("下一步：由梅森交回同一原纸条");
    const returnButton = screen.getByRole("button", { name: /^由梅森交回同一原纸条/ }) as HTMLButtonElement;
    expect(returnButton.disabled).toBe(false); await userEvent.click(returnButton);
    expect(screen.getByText(value.practice!.note)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^取回后报告原件去向/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...closed, insideCase: false, actions: [{ ...report, enabled: true, reason: null }],
      practice: { ...originalPractice, summary: "实际递送1次 · 交回1次 · 协同核对0次" } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(originalPractice.note)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^由梅森交回同一原纸条/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^取回后报告原件去向/ }));
    expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[1]!.command, retrieve.command, report.command]);
  });

  it("keeps the actual dream open after a recall until CLOSE commits without moving the original body", async () => {
    const recall = action({ type: "RECALL_SPIRIT" }, "只召回原灵体", true, "0行动 · 0灵性");
    const close = action({ type: "CLOSE", caseId: "quiet-coordination" }, "结束有限梦境并唤醒", true, "0行动 · 0灵性");
    const practice = { ...originalPractice, dream: "同意的成年梅森仍在有限梦境中；本人身体在原椅旁未移动", summary: "实际协同核对1次，尚未结束梦境。" };
    const value = spiritWarlock({ promoted: true, insideCase: true, cases: cases(), actions: [recall, close], practice,
      companion: { ...originalCompanion, status: "同一卷叶在原场景给出约定叶动", history: ["已派出1次"] } });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("quiet-coordination");
    await userEvent.click(screen.getByRole("button", { name: /^只召回原灵体/ }));
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...value, actions: [close], companion: { ...originalCompanion,
      status: "同一卷叶已回媒介，梦境未结束", history: ["已派出1次", "已召回1次"] } }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(practice.dream)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^结束有限梦境并唤醒/ }));
    expect(screen.getByText(practice.dream)).toBeTruthy();
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...value, insideCase: false, actions: [],
      practice: { ...practice, dream: "有限梦境已结束，梅森清醒，本人身体仍在原处" } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("有限梦境已结束，梅森清醒，本人身体仍在原处")).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([recall.command, close.command]);
  });

  it("never infers active contact, learned spirit skills or commands from history or absent projections", async () => {
    const value = { ...opened(), insideCase: false, actions: [], companion: null, practice: null };
    const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("listening-leaves"); expect(selector.disabled).toBe(false);
    await userEvent.selectOptions(selector, "original-message"); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "灵巫原灵体与实际经历" })).toBeNull();
    expect(screen.queryByRole("region", { name: "灵巫原纸条与当前梦境" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<SpiritWarlockPanel spiritWarlock={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "灵巫成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("supports an ordinary peaceful completion without displaying a fabricated bound spirit or dream", () => {
    panel(spiritWarlock({ promoted: true, acting: 100, actions: [], cases: cases().map((entry) => ({ ...entry, status: "RESOLVED",
      observations: ["普通方法实际观察与本人往返。"], result: "普通方法已报告，不声称封印或入梦。", closes: 1 })),
      companion: originalCompanion, practice: { ...originalPractice, summary: "本人实际递送1次 · 交回1次 · 能力协同0次" } }));
    expect(screen.getByText(originalCompanion.status)).toBeTruthy(); expect(screen.getByText(originalPractice.dream)).toBeTruthy();
    expect(screen.getByText("本人实际递送1次 · 交回1次 · 能力协同0次")).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "灵巫扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("region", { name: "灵巫成长下一步" }).textContent).toContain("这一阶段已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps projected conditions accessible and locks all submissions during busy, real blocking and save errors", () => {
    const recall = action({ type: "RECALL_SPIRIT" }, "召回本次原灵体", false);
    const value = { ...opened(), actions: [...opened().actions, recall] }; const { onCommand, rerender } = panel(value);
    const disabled = screen.getByRole("button", { name: /^召回本次原灵体/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`spirit-warlock-reason-${recall.id}`);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<SpiritWarlockPanel spiritWarlock={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.practice!.note)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
      expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows non-retryable persistence recovery without inventing a second domain retry", () => {
    const onCommand = vi.fn();
    render(<SpiritWarlockPanel spiritWarlock={spiritWarlock({ actions: [learn] })} resources={resources} busy={false}
      error={{ message: "存档版本已变化。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^听取灵巫成品用药指导/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows actual self-training and inherited mastery without treating the companion as a permanent learned power", () => {
    const abilities = [{ id: "darkness.s5.spirit-shelter", label: "灵体收容", mastery: 24, description: "必须另行实际取得灵体。" },
      { id: "darkness.s5.spirit-assistance", label: "有限灵体协助", mastery: 8, description: "只限本次实际派出的同一原灵体。" },
      { id: "darkness.s5.spirit-coordination", label: "梦境与灵体协同", mastery: 16, description: "本人保持原身体静止。" },
      { id: "darkness.s6.spirit-pacification", label: "原有限安魂", mastery: 72, description: "原能力ID与掌握保留。" }];
    panel(spiritWarlock({ promoted: true, abilities, actions: [], companion: originalCompanion, practice: originalPractice }));
    expect(screen.getByText("灵巫5")).toBeTruthy();
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByLabelText("灵巫能力边界");
    expect(boundary.textContent).toContain("不会赠送灵体库");
    expect(boundary.textContent).toContain("飞行、土行等借助灵体的效果需要合适且已经取得的独立灵体");
    expect(boundary.textContent).toContain("本人身体留在原处");
    expect(boundary.textContent).toContain("原能力ID与掌握继续保留");
    expect(screen.queryByRole("button", { name: /飞行|土行|厄运|体内冥界|永久学会/ })).toBeNull();
    expect(screen.queryByText(/^卷叶 · 掌握/)).toBeNull();
  });

  it("keeps the optional actual Olin encounter separate and forwards exact talk and fight intents", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴原庭院向奥林交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴原庭院承担真实冲突", true, "1行动 · 真实伤势与死亡风险");
    const environment = "原庭院出口可见，成年奥林与自己的普通短棍在两米外。";
    const { onCommand } = panel(spiritWarlock({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "灵巫有限冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴原庭院向奥林交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴原庭院承担真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "灵巫实际结果" })).toBeNull();
  });

  it("preserves every actual S6 observation, revision, failure, closure, source and mastery as read-only history", () => {
    const soother: SootherProjection = {
      title: "安魂师", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "安魂师原供货记录保留。", story: "旧三案已经和平收尾。", environment: "原残影与成年家属记录。",
      actions: [{ id: "old-pacify", label: "不可再次结算旧实践", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: ["restless-wolf", "echo-at-wall", "remembered-name"].map((id, index) => ({ id, title: `安魂师原案${index + 1}`,
        story: `原案${index + 1}的真实经过。`, status: "RESOLVED", observations: index === 1 ? ["原失败：安魂遇阻，已实际退出。", "下一周本人现实核实，修订原印象。"] : [],
        preparation: index === 1 ? "当时已准备有限灵视与现实对照。" : null,
        result: `原案${index + 1}报告已提交，原失败与修订保留。`, contactOpen: "已实际结束", closes: index + 1 })),
      bottles: [{ id: "soother-potion-2", title: "安魂师旧原瓶", source: "安魂师原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "soother-potion-2", confirmed: true } }],
      abilities: [{ id: "darkness.s6.spirit-sight", label: "原有限灵视", mastery: 67, description: "原观察与核实条件继续保留。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<SpiritWarlockSootherHistory soother={soother} />);
    const history = within(screen.getByRole("region", { name: "安魂师时期的经历" }));
    for (const entry of soother.cases) {
      expect(history.getByText(`原案卷ID：${entry.id}`)).toBeTruthy();
      expect(history.getByText(`当时的接触：已实际结束 · 实际结束次数：${entry.closes}`)).toBeTruthy();
      expect(history.getByText(`当时的实际结果与报告：${entry.result}`)).toBeTruthy();
    }
    expect(history.getByText("原失败：安魂遇阻，已实际退出。")).toBeTruthy();
    expect(history.getByText("下一周本人现实核实，修订原印象。")).toBeTruthy();
    expect(history.getByText("原瓶ID：soother-potion-2")).toBeTruthy();
    expect(history.getByText("来源：安魂师原独立成品渠道")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原有限灵视 · 掌握 67：原观察与核实条件继续保留。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
