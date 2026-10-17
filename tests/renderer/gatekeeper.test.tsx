/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GatekeeperAction, GatekeeperCommand, GatekeeperProjection } from "../../src/domain/gatekeeper/types";
import type { SpiritGuideProjection } from "../../src/domain/spirit-guide/types";
import { GatekeeperSpiritGuideHistory, GatekeeperPanel } from "../../src/renderer/GatekeeperPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；死灵导师消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: GatekeeperCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): GatekeeperAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取看门人成品用药指导", true, "460便士 · 1行动");
function gatekeeper(patch: Partial<GatekeeperProjection> = {}): GatekeeperProjection {
  return {
    title: "看门人晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "死灵导师扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", companion: null, practice: null, ...patch,
  };
}
function cases(): GatekeeperProjection["cases"] {
  return [
    { id: "resting-place", title: "有限体内休憩", story: "原灰羽须重新接受自愿短驻约定，才能进入本人的有限体内冥界。" },
    { id: "shared-task", title: "同一原木牌", story: "导师的新原木牌沿普通两米路径递给同意的成年看守。" },
    { id: "controlled-threshold", title: "可控门限", story: "本人实际沿普通十米走廊到空置凹室，以仍系原锚点的固定布条核对有限吸引。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
const originalCompanion: NonNullable<GatekeeperProjection["companion"]> = {
  name: "灰羽", source: "SG6-GRAY-FEATHER · 导师原工作室栖架", status: "原灰羽在体外，尚未接受本阶段短驻约定", history: [],
};
const originalPractice: NonNullable<GatekeeperProjection["practice"]> = {
  marker: "GK5-MARKER-1仍在导师原桌上", gate: "没有开启冥界之门", summary: "实际递送0次 · 交回0次 · 门限核对0次",
};
function bottled(): GatekeeperProjection {
  const originals = [
    { id: "gatekeeper-potion-1", title: "第一瓶看门人魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "gatekeeper-potion-2", title: "第二瓶看门人魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "gatekeeper-potion-3", title: "第三瓶看门人魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return gatekeeper({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): GatekeeperProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：能力核对未通过，已消耗3灵性，灰羽与原木牌没有复制。";
function opened(): GatekeeperProjection {
  return gatekeeper({ promoted: true, insideCase: true, actions: [
    action({ type: "PERFORM", caseId: "shared-task" }, "实际递送原木牌", true, "1行动 · 本次实际成本"),
    action({ type: "CLOSE", caseId: "shared-task" }, "实际结束接触并召回", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "WITHDRAW", caseId: "shared-task" }, "撤回尚未实施的准备", true, "0行动 · 保留原成本"),
  ], cases: cases().map((entry) => entry.id === "shared-task" ? {
    ...entry, status: "EXAMINED", observations: ["本次已核对同一原木牌。", failure],
    preparation: "已准备本次有限递送。", contactOpen: "本次接触尚未实际结束",
  } : entry), companion: { ...originalCompanion, status: "已派出同一灰羽", history: ["第54周取得同一原灵体。", "实际派出1次，尚未召回。"] },
    practice: { ...originalPractice, marker: "GK5-MARKER-1现在由同意的成年看守保管", summary: "实际递送1次 · 交回0次 · 门限核对0次" } });
}
function panel(value: GatekeeperProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<GatekeeperPanel gatekeeper={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Gatekeeper original gray-feather, marker, bounded door and independent bottles", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "死灵导师扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(gatekeeper({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "看门人成长下一步" });
    expect(summary.textContent).toContain("死灵导师6 → 看门人5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方与晋升仪式细节尚未核实");
    expect(summary.textContent).toContain("不能据此断言无需仪式");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取看门人成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: GatekeeperCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "gatekeeper-potion-3" },
      { type: "BUY_POTION", bottleId: "gatekeeper-potion-3" }, { type: "BUY_POTION", bottleId: "gatekeeper-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(gatekeeper({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["gatekeeper-potion-1", "gatekeeper-potion-2", "gatekeeper-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "gatekeeper-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("gatekeeper-potion-2"));
    expect(screen.getByText("gatekeeper-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "看门人服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶看门人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "看门人能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("gatekeeper-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶看门人魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<GatekeeperPanel gatekeeper={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶看门人魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("gatekeeper-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<GatekeeperPanel gatekeeper={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<GatekeeperPanel gatekeeper={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶看门人魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶看门人魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("gatekeeper-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶看门人魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<GatekeeperPanel gatekeeper={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*gatekeeper-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("gatekeeper-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("gatekeeper-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶看门人魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("gatekeeper-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶看门人魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升看门人" } : bottle) };
    rerender(<GatekeeperPanel gatekeeper={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶看门人魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "看门人能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升看门人")).toBeTruthy();
    expect(screen.getByText("原瓶ID：gatekeeper-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("gatekeeper-potion-2"));
    expect(screen.getByText("gatekeeper-potion-2")).toBeTruthy();
    rerender(<GatekeeperPanel gatekeeper={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶看门人魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("gatekeeper-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<GatekeeperPanel gatekeeper={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶看门人魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards only the selected public method without acquiring a spirit or delivering the original marker optimistically", async () => {
    const commands: GatekeeperCommand[] = [{ type: "OBSERVE", caseId: "shared-task" },
      { type: "PREPARE", caseId: "shared-task", method: "ORDINARY" },
      { type: "PREPARE", caseId: "shared-task", method: "ABILITY" },
      { type: "PERFORM", caseId: "shared-task" }, { type: "WITHDRAW", caseId: "shared-task" },
      { type: "CLOSE", caseId: "shared-task" }, { type: "REPORT", caseId: "shared-task" }];
    const labels = ["核对原木牌", "准备普通本人递送", "准备原灵体递送", "实际递送", "撤回准备", "结束接触", "提交有限报告"];
    const value = gatekeeper({ promoted: true, cases: cases(), companion: originalCompanion, practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "resting-place");
    expect(screen.queryByRole("button", { name: /^实际递送/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "shared-task");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.getByText(originalCompanion.status)).toBeTruthy();
    expect(screen.getByText(originalPractice.marker)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.queryByRole("region", { name: "看门人实际结果" })).toBeNull();
  });

  it("prioritizes enabled CLOSE then WITHDRAW at zero resources and uses the active public case", async () => {
    const { onCommand, rerender } = panel(gatekeeper({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "controlled-threshold");
    const value = opened();
    rerender(<GatekeeperPanel gatekeeper={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("shared-task"); expect(selector.disabled).toBe(true);
    const summary = screen.getByRole("region", { name: "看门人成长下一步" });
    expect(summary.textContent).toContain("下一步：实际结束接触并召回");
    const close = screen.getByRole("button", { name: /^实际结束接触并召回/ }) as HTMLButtonElement;
    const perform = screen.getByRole("button", { name: /^实际递送原木牌/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(perform.disabled).toBe(false);
    expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(perform); await userEvent.click(close);
    const onlyWithdraw = { ...value, actions: [action({ type: "CLOSE", caseId: "resting-place" }, "旧案不能结束", false),
      action({ type: "PERFORM", caseId: "shared-task" }, "现在不能递送", false), value.actions[2]!] };
    rerender(<GatekeeperPanel gatekeeper={onlyWithdraw} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(summary.textContent).toContain("下一步：撤回尚未实施的准备");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("shared-task");
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未实施的准备/ }));
    expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[1]!.command, value.actions[2]!.command]);
  });

  it("renders one real companion source and committed history through invitation, deployment, recall and release", async () => {
    const invite = action({ type: "INVITE_SPIRIT" }, "邀请原工作室灰羽", true, "1行动 · 3灵性 · 知识14 · 成功另付12便士");
    const recall = action({ type: "RECALL_SPIRIT" }, "召回同一灰羽", true, "0行动 · 0精神 · 0灵性");
    const release = action({ type: "RELEASE_SPIRIT" }, "释放回原工作室栖架", true, "0行动 · 0精神 · 0灵性");
    const history = ["第54周邀请失败，未收容，消耗保留。", "第55周灰羽重新接受本次自愿短驻约定，实际支付12便士后进入本人有限体内冥界。", "已实际派出1次。"];
    const value = gatekeeper({ promoted: true, cases: cases(), companion: originalCompanion, practice: originalPractice, actions: [invite] });
    const { onCommand, rerender } = panel(value);
    const companion = screen.getByRole("region", { name: "看门人原灵体与实际经历" });
    expect(within(companion).getByText(originalCompanion.source)).toBeTruthy();
    expect(companion.textContent).toContain("尚无已保存的邀请、收容或协作经历");
    await userEvent.click(screen.getByRole("button", { name: /^邀请原工作室灰羽/ }));
    expect(companion.textContent).toContain(originalCompanion.status);
    rerender(<GatekeeperPanel gatekeeper={{ ...value, insideCase: true, actions: [recall],
      companion: { ...originalCompanion, status: "同一原灵体已派出", history } }}
      resources={{ ...resources, spirituality: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    for (const entry of history) expect(within(companion).getByText(entry)).toBeTruthy();
    expect(screen.getByRole("region", { name: "看门人成长下一步" }).textContent).toContain("下一步：召回同一灰羽");
    await userEvent.click(screen.getByRole("button", { name: /^召回同一灰羽/ }));
    expect(companion.textContent).toContain("同一原灵体已派出");
    rerender(<GatekeeperPanel gatekeeper={{ ...value, actions: [release],
      companion: { ...originalCompanion, status: "同一灰羽已召回本人有限体内冥界", history: [...history, "已实际召回1次。"] } }}
      resources={{ ...resources, spirituality: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^释放回原工作室栖架/ }));
    expect(companion.textContent).toContain("同一灰羽已召回本人有限体内冥界");
    rerender(<GatekeeperPanel gatekeeper={{ ...value, actions: [],
      companion: { ...originalCompanion, status: "原灰羽已回到原工作室同一栖架", history: [...history, "已实际召回1次。", "已释放1次，新约定、原费用与实际进入记录保留。"] } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    for (const entry of history) expect(within(companion).getByText(entry)).toBeTruthy();
    expect(within(companion).getByText(originalCompanion.source)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([invite.command, recall.command, release.command]);
  });

  it("keeps a delivered original after CLOSE and exposes zero-AP RETRIEVE_MARKER until the saved handback", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^实际结束接触并召回/ }));
    const retrieve = action({ type: "RETRIEVE_MARKER" }, "由原看守交回同一原木牌", true, "0行动 · 0精神 · 0灵性");
    const report = action({ type: "REPORT", caseId: "shared-task" }, "取回后报告原件去向", false);
    const closed = { ...value, insideCase: true, actions: [action({ type: "CLOSE", caseId: "resting-place" }, "旧案已结束", false), retrieve, report],
      cases: value.cases.map((entry) => entry.id === "shared-task" ? { ...entry, closes: 1, contactOpen: "接触已结束，原木牌尚未交回" } : entry) };
    rerender(<GatekeeperPanel gatekeeper={closed} resources={{ ...resources, spirituality: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("shared-task");
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(value.practice!.marker)).toBeTruthy();
    expect(screen.getByRole("region", { name: "看门人成长下一步" }).textContent).toContain("下一步：由原看守交回同一原木牌");
    const returnButton = screen.getByRole("button", { name: /^由原看守交回同一原木牌/ }) as HTMLButtonElement;
    expect(returnButton.disabled).toBe(false); await userEvent.click(returnButton);
    expect(screen.getByText(value.practice!.marker)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^取回后报告原件去向/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<GatekeeperPanel gatekeeper={{ ...closed, insideCase: false, actions: [{ ...report, enabled: true, reason: null }],
      practice: { ...originalPractice, summary: "实际递送1次 · 交回1次 · 门限核对0次" } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(originalPractice.marker)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^由原看守交回同一原木牌/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^取回后报告原件去向/ }));
    expect(screen.getByText(failure)).toBeTruthy();
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[1]!.command, retrieve.command, report.command]);
  });

  it("keeps the actual failed door open until explicit zero-resource CLOSE and actual return commit", async () => {
    const close = action({ type: "CLOSE", caseId: "controlled-threshold" }, "完全关门并沿十米原路返回", true, "0行动 · 0精神 · 0灵性");
    const practice = { ...originalPractice, gate: "本人在十米外原凹室维持冥界之门，原布条仍系原锚点", summary: "本次能力核对失败，已付4灵性，门限核对0次。" };
    const value = gatekeeper({ promoted: true, insideCase: true, cases: cases().map((entry) => entry.id === "controlled-threshold"
      ? { ...entry, status: "EXAMINED", contactOpen: "接触与维持尚未实际结束", result: "本次有限开门失败，原消耗保留；未传送任何人与物。" } : entry),
      actions: [close], practice, companion: { ...originalCompanion, status: "原灰羽在十米外原工作室栖架休息", history: ["已实际释放1次。"] } });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("controlled-threshold");
    rerender(<GatekeeperPanel gatekeeper={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(practice.gate)).toBeTruthy();
    expect(screen.getByRole("region", { name: "看门人成长下一步" }).textContent).toContain("下一步：完全关门并沿十米原路返回");
    const button = screen.getByRole("button", { name: /^完全关门并沿十米原路返回/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false); await userEvent.click(button);
    expect(screen.getByText(practice.gate)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /召回|释放|取回/ })).toBeNull();
    rerender(<GatekeeperPanel gatekeeper={{ ...value, insideCase: false, actions: [],
      practice: { ...practice, gate: "冥界之门已完全关闭，本人已实际走回导师原工作室" } }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("冥界之门已完全关闭，本人已实际走回导师原工作室")).toBeTruthy();
    expect(screen.getByText("本次能力核对失败，已付4灵性，门限核对0次。")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("leaves ordinary navigation available when the same gray-feather only rests INSIDE", async () => {
    const release = action({ type: "RELEASE_SPIRIT" }, "让原灰羽回到原工作室栖架", true, "0行动 · 0精神 · 0灵性");
    const observe = action({ type: "OBSERVE", caseId: "shared-task" }, "核对相邻桌的原木牌", true, "1行动");
    const value = gatekeeper({ promoted: true, insideCase: false, cases: cases(), actions: [release, observe],
      companion: { ...originalCompanion, status: "同一灰羽在本人体内安静休憩", history: ["本次新约定已接受，实际支付12便士；旧约定未续签。"] }, practice: originalPractice });
    const { onCommand } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.disabled).toBe(false);
    expect(screen.getByRole("region", { name: "看门人原灵体与实际经历" }).textContent).toContain("在体内休憩本身不会阻断普通生活");
    await userEvent.selectOptions(selector, "shared-task");
    await userEvent.click(screen.getByRole("button", { name: /^核对相邻桌的原木牌/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(observe.command);
    expect(screen.getByText("同一灰羽在本人体内安静休憩")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /关闭冥界之门|结束接触/ })).toBeNull();
  });

  it("ends a resting-place discussion without releasing or cloning the same body-held spirit", async () => {
    const close = action({ type: "CLOSE", caseId: "resting-place" }, "结束本次体内有限交流", true, "0行动 · 0精神 · 0灵性");
    const companion = { ...originalCompanion, status: "原灰羽仍在本人体内，当前有限交流未结束", history: ["第55周实际进入1次，已付新约定12便士。"] };
    const value = gatekeeper({ promoted: true, insideCase: true, cases: cases(), actions: [close], companion, practice: originalPractice });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^结束本次体内有限交流/ }));
    expect(screen.getByText(companion.status)).toBeTruthy();
    const resting = "原灰羽仍在本人体内安静休憩，本次交流已实际结束";
    rerender(<GatekeeperPanel gatekeeper={{ ...value, insideCase: false, actions: [], companion: { ...companion, status: resting },
      cases: value.cases.map((entry) => entry.id === "resting-place" ? { ...entry, contactOpen: "已实际结束有限交流", closes: 1 } : entry) }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(resting)).toBeTruthy();
    expect(screen.getByText(companion.history[0]!)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /释放|重新邀请/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("keeps threshold preparation on the ordinary original site until actual performance is saved", async () => {
    const prepare = action({ type: "PREPARE", caseId: "controlled-threshold", method: "ABILITY" }, "准备有限门限方案", true, "1行动");
    const withdraw = action({ type: "WITHDRAW", caseId: "controlled-threshold" }, "撤回未执行的门限方案", true, "0行动 · 0精神 · 0灵性");
    const environment = "本人仍在导师原工作室，尚未走十米到凹室。";
    const value = gatekeeper({ promoted: true, insideCase: false, cases: cases(), actions: [prepare], companion: originalCompanion, practice: originalPractice, environment });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^准备有限门限方案/ }));
    expect(screen.getByText(environment)).toBeTruthy();
    expect(screen.getByText(originalPractice.gate)).toBeTruthy();
    rerender(<GatekeeperPanel gatekeeper={{ ...value, actions: [withdraw],
      cases: value.cases.map((entry) => entry.id === "controlled-threshold" ? { ...entry, status: "PREPARED", preparation: "只记录门限方案，实际执行才步行十米到原凹室。" } : entry) }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(environment)).toBeTruthy();
    expect(screen.getByText(originalPractice.gate)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /^撤回未执行的门限方案/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([prepare.command, withdraw.command]);
  });

  it("never infers active contact, learned spirit skills or commands from history or absent projections", async () => {
    const value = { ...opened(), insideCase: false, actions: [], companion: null, practice: null };
    const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("resting-place"); expect(selector.disabled).toBe(false);
    await userEvent.selectOptions(selector, "shared-task"); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "看门人原灵体与实际经历" })).toBeNull();
    expect(screen.queryByRole("region", { name: "看门人原木牌与当前冥界之门" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<GatekeeperPanel gatekeeper={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "看门人成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("supports ordinary peaceful completion without fabricating an invited spirit or an open door", () => {
    panel(gatekeeper({ promoted: true, acting: 100, actions: [], cases: cases().map((entry) => ({ ...entry, status: "RESOLVED",
      observations: ["普通方法实际观察与本人往返。"], result: "普通方法已报告，不声称灵体入内或开门。", closes: 1 })),
      companion: originalCompanion, practice: { ...originalPractice, summary: "本人实际递送1次 · 交回1次 · 能力开门0次" } }));
    expect(screen.getByText(originalCompanion.status)).toBeTruthy(); expect(screen.getByText(originalPractice.gate)).toBeTruthy();
    expect(screen.getByText("本人实际递送1次 · 交回1次 · 能力开门0次")).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "看门人扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("region", { name: "看门人成长下一步" }).textContent).toContain("这一阶段已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps projected conditions accessible and locks all submissions during busy, real blocking and save errors", () => {
    const recall = action({ type: "RECALL_SPIRIT" }, "召回本次原灵体", false);
    const value = { ...opened(), actions: [...opened().actions, recall] }; const { onCommand, rerender } = panel(value);
    const disabled = screen.getByRole("button", { name: /^召回本次原灵体/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`gatekeeper-reason-${recall.id}`);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<GatekeeperPanel gatekeeper={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.practice!.marker)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
      expect(screen.getByText("灵性 12 / 100 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows non-retryable persistence recovery without inventing a second domain retry", () => {
    const onCommand = vi.fn();
    render(<GatekeeperPanel gatekeeper={gatekeeper({ actions: [learn] })} resources={resources} busy={false}
      error={{ message: "存档版本已变化。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^听取看门人成品用药指导/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps body-bound capability, inherited mastery and actual companion assistance distinct", () => {
    const abilities = [{ id: "death.s5.inner-underworld", label: "有限体内冥界", mastery: 24, description: "本人身体形成有限冥界，灰羽须另行同意。" },
      { id: "death.s5.underworld-door", label: "有限冥界之门", mastery: 8, description: "本人在场维持并实际关闭，不传送。" },
      { id: "death.s6.spirit-recruitment", label: "原有限信使招募", mastery: 72, description: "原能力ID与掌握保留，旧约定不续签。" }];
    panel(gatekeeper({ promoted: true, abilities, actions: [], companion: originalCompanion, practice: originalPractice }));
    expect(screen.getByText("看门人5")).toBeTruthy();
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByLabelText("看门人能力边界");
    for (const text of ["不会赠送灵体库", "不会获得序列4的不死与复活", "灰羽先释放在十米外原栖架", "必须显式关门再步行回原室", "原能力ID与掌握继续保留", "该死亡现场离体", "不传送回原栖架"]) expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /复活|高位灵体|船只|旅行|永久学会/ })).toBeNull();
    expect(screen.queryByText(/^灰羽 · 掌握/)).toBeNull();
  });

  it("keeps the optional actual Locke encounter separate and forwards exact talk and fight intents", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴原空院向洛克交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴原空院承担真实冲突", true, "1行动 · 真实伤势与死亡风险");
    const environment = "旧纪念院原私人空院出口可见，成年洛克与自己的普通短棍在两米外。";
    const { onCommand } = panel(gatekeeper({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "看门人有限冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴原空院向洛克交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴原空院承担真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "看门人实际结果" })).toBeNull();
  });

  it("preserves every actual S6 observation, revision, failure, closure, source and mastery as read-only history", () => {
    const spiritGuide: SpiritGuideProjection = {
      title: "死灵导师", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "死灵导师原供货记录保留。", story: "旧三案已经和平收尾。", environment: "原信使约定、原密封信与实际答复记录。",
      messenger: { recruited: true, deliveries: 1, letter: "RECIPIENT", replyReceived: true, feePaid: 12 },
      actions: [{ id: "old-pacify", label: "不可再次结算旧实践", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: ["messenger-terms", "short-delivery", "restless-echo"].map((id, index) => ({ id, title: `死灵导师原案${index + 1}`,
        story: `原案${index + 1}的真实经过。`, status: "RESOLVED", observations: index === 1 ? ["原失败：亡者之语遇阻，已实际退出。", "下一周本人核实原收件人答复，修订原印象。"] : [],
        preparation: index === 1 ? "当时已准备有限亡者之语与现实对照。" : null,
        result: `原案${index + 1}报告已提交，原失败与修订保留。`, contactOpen: "已实际结束", closes: index + 1 })),
      bottles: [{ id: "spirit-guide-potion-2", title: "死灵导师旧原瓶", source: "死灵导师原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "spirit-guide-potion-2", confirmed: true } }],
      abilities: [{ id: "death.s6.dead-words", label: "原亡者之语", mastery: 67, description: "原观察与核实条件继续保留。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<GatekeeperSpiritGuideHistory spiritGuide={spiritGuide} />);
    const history = within(screen.getByRole("region", { name: "死灵导师时期的经历" }));
    for (const entry of spiritGuide.cases) {
      expect(history.getByText(`原案卷ID：${entry.id}`)).toBeTruthy();
      expect(history.getByText(`当时的接触：已实际结束 · 实际结束次数：${entry.closes}`)).toBeTruthy();
      expect(history.getByText(`当时的实际结果与报告：${entry.result}`)).toBeTruthy();
    }
    expect(history.getByText("原失败：亡者之语遇阻，已实际退出。")).toBeTruthy();
    expect(history.getByText("下一周本人核实原收件人答复，修订原印象。")).toBeTruthy();
    expect(history.getByText("原瓶ID：spirit-guide-potion-2")).toBeTruthy();
    expect(history.getByText("来源：死灵导师原独立成品渠道")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原亡者之语 · 掌握 67：原观察与核实条件继续保留。")).toBeTruthy();
    const original = within(history.getByRole("region", { name: "死灵导师原信使约定与原信去向" }));
    for (const text of ["曾实际招募灰羽，仅适用原有限条款", "12便士", "仍在原收件人手中，不因晋升取回或重置", "已实际带回当时的有限答复"]) expect(original.getByText(text)).toBeTruthy();
    expect(history.getByRole("region", { name: "死灵导师原信使约定与原信去向" }).textContent).toContain("不能授权现在进入体内冥界、派出协作或参加冲突");
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
