/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DreamStealerAction, DreamStealerCommand, DreamStealerProjection } from "../../src/domain/dream-stealer/types";
import type { FireThiefProjection } from "../../src/domain/fire-thief/types";
import { DreamStealerFireThiefHistory, DreamStealerPanel } from "../../src/renderer/DreamStealerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；盗火人消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: DreamStealerCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): DreamStealerAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取窃梦家成品用药指导", true, "460便士 · 1行动");
function dreamStealer(patch: Partial<DreamStealerProjection> = {}): DreamStealerProjection {
  return {
    title: "窃梦家晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "盗火人扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, ...patch,
  };
}
function cases(): DreamStealerProjection["cases"] {
  return [
    { id: "announced-seat", title: "现在坐下的决定", story: "成年瑟蕾·芬恩同意一次当前落座念头练习，双方各有自己的原椅。" },
    { id: "intended-reach", title: "伸向自己的空桌", story: "成年诺汀·布莱尔决定伸手拿自己的DS5-TOKEN-1蓝木片；本人只有自己的空桌与空手。" },
    { id: "empty-performance", title: "动作不等于念头", story: "原杠杆驱动的机械木臂没有自主心智，只能普通核对原记录。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
const originalPractice: NonNullable<DreamStealerProjection["practice"]> = {
  pose: "本人实际站立，双手空着。", target: "原目标没有被迫停顿，可以自行决定是否参加。",
  token: "诺汀的原蓝木片DS5-TOKEN-1在他自己的原桌上。", history: [],
};
function bottled(): DreamStealerProjection {
  const originals = [
    { id: "dream-stealer-potion-1", title: "第一瓶窃梦家魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "dream-stealer-potion-2", title: "第二瓶窃梦家魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "dream-stealer-potion-3", title: "第三瓶窃梦家魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return dreamStealer({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): DreamStealerProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：本次知识核对未通过，已消耗3灵性，原目标实际完成自己的动作，没有窃得念头。";
function opened(caseId = "announced-seat"): DreamStealerProjection {
  return dreamStealer({ promoted: true, insideCase: true, actions: [
    action({ type: "CLOSE", caseId }, "实际恢复并普通起身收束", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "REPORT", caseId }, "提交本次有限报告", false),
  ], cases: cases().map((entry) => entry.id === caseId ? {
    ...entry, status: "EXAMINED", observations: ["本次已核对原成年志愿者的有限同意。", failure],
    preparation: "只同意本次当前念头试验。", contactOpen: "本次接触尚未实际结束",
  } : entry), practice: { ...originalPractice, pose: "本人已经在同一次行动中坐到自己的原椅上。",
    target: "瑟蕾暂时忘记当前落座决定，仍站在自己的原椅旁。", history: ["实际窃取1次 · 立即亲自执行1次 · 已核实恢复0次。"] } });
}
function panel(value: DreamStealerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DreamStealerPanel dreamStealer={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("DreamStealer current thought, immediate own action and independent bottles", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "盗火人扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(dreamStealer({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "窃梦家成长下一步" });
    expect(summary.textContent).toContain("盗火人6 → 窃梦家5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方与晋升仪式细节尚未核实");
    expect(summary.textContent).toContain("不能据此断言无需仪式");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取窃梦家成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: DreamStealerCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "dream-stealer-potion-3" },
      { type: "BUY_POTION", bottleId: "dream-stealer-potion-3" }, { type: "BUY_POTION", bottleId: "dream-stealer-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(dreamStealer({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["dream-stealer-potion-1", "dream-stealer-potion-2", "dream-stealer-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "dream-stealer-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("dream-stealer-potion-2"));
    expect(screen.getByText("dream-stealer-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "窃梦家服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶窃梦家魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "窃梦家能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dream-stealer-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶窃梦家魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<DreamStealerPanel dreamStealer={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶窃梦家魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("dream-stealer-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<DreamStealerPanel dreamStealer={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<DreamStealerPanel dreamStealer={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶窃梦家魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶窃梦家魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dream-stealer-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶窃梦家魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<DreamStealerPanel dreamStealer={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*dream-stealer-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("dream-stealer-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("dream-stealer-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶窃梦家魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dream-stealer-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶窃梦家魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升窃梦家" } : bottle) };
    rerender(<DreamStealerPanel dreamStealer={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶窃梦家魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "窃梦家能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升窃梦家")).toBeTruthy();
    expect(screen.getByText("原瓶ID：dream-stealer-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dream-stealer-potion-2"));
    expect(screen.getByText("dream-stealer-potion-2")).toBeTruthy();
    rerender(<DreamStealerPanel dreamStealer={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶窃梦家魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("dream-stealer-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<DreamStealerPanel dreamStealer={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶窃梦家魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards each selected public method unchanged without optimistically stealing or moving bodies", async () => {
    const commands: DreamStealerCommand[] = [{ type: "OBSERVE", caseId: "announced-seat" },
      { type: "PREPARE", caseId: "announced-seat", method: "ORDINARY" },
      { type: "PREPARE", caseId: "announced-seat", method: "ABILITY" },
      { type: "PERFORM", caseId: "announced-seat" }, { type: "WITHDRAW", caseId: "announced-seat" },
      { type: "CLOSE", caseId: "announced-seat" }, { type: "REPORT", caseId: "announced-seat" }];
    const labels = ["核对原座椅", "准备普通落座对照", "准备当前落座念头", "实施当前同意试验", "撤回未实施准备", "结束本次接触", "提交有限报告"];
    const value = dreamStealer({ promoted: true, cases: cases(), practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "intended-reach");
    expect(screen.queryByRole("button", { name: /^实施当前同意试验/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "announced-seat");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const text of [originalPractice.pose, originalPractice.target, originalPractice.token]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("准备只记录本次知情同意与方法");
    expect(screen.queryByRole("region", { name: "窃梦家实际结果" })).toBeNull();
  });

  it("keeps preparation outside contact and recommends actual performance before voluntary withdrawal", async () => {
    const perform = action({ type: "PERFORM", caseId: "announced-seat" }, "实际尝试当前落座念头", true, "1行动 · 3灵性 · 知识14");
    const withdraw = action({ type: "WITHDRAW", caseId: "announced-seat" }, "撤回尚未实施的准备", true, "0行动 · 0精神 · 0灵性");
    const preparation = "瑟蕾只同意一次当前落座决定；此刻双方仍站立，尚未窃取或停顿。";
    const value = dreamStealer({ promoted: true, cases: cases().map((entry) => entry.id === "announced-seat"
      ? { ...entry, status: "PREPARED", preparation } : entry), actions: [withdraw, perform], practice: originalPractice });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "窃梦家成长下一步" }).textContent).toContain(`下一步：${perform.label}`);
    expect(screen.getByText(preparation)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际尝试当前落座念头/ }));
    expect(screen.getByText(originalPractice.pose)).toBeTruthy();
    expect(screen.getByText(originalPractice.target)).toBeTruthy();
    rerender(<DreamStealerPanel dreamStealer={{ ...value, actions: [{ ...perform, enabled: false, reason: "本周行动已用完。" }, withdraw] }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "窃梦家成长下一步" }).textContent).toContain(`下一步：${withdraw.label}`);
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未实施的准备/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([perform.command, withdraw.command]);
    expect(screen.getByText(originalPractice.token)).toBeTruthy();
  });

  it("shows successful theft and mandatory own sitting in one committed action, then actual zero-cost recovery", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(value.practice!.pose)).toBeTruthy(); expect(screen.getByText(value.practice!.target)).toBeTruthy();
    expect(screen.getByText(value.practice!.history[0]!)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /稍后执行|储存|选择执行|亲自坐下/ })).toBeNull();
    const close = screen.getByRole("button", { name: /^实际恢复并普通起身收束/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); await userEvent.click(close);
    expect(screen.getByText(value.practice!.pose)).toBeTruthy();
    const target = "瑟蕾已实际等过十秒恢复决定，双方普通起身；她可以拒绝再次参与。";
    const history = [...value.practice!.history, "本次实际恢复1次，原椅复位，原成本与失败仍保留。"];
    rerender(<DreamStealerPanel dreamStealer={{ ...value, insideCase: false, actions: [],
      practice: { ...originalPractice, target, history },
      cases: value.cases.map((entry) => entry.id === "announced-seat" ? { ...entry, contactOpen: "已实际结束", closes: 1 } : entry) }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(originalPractice.pose)).toBeTruthy(); expect(screen.getByText(target)).toBeTruthy();
    history.forEach((entry) => expect(screen.getByText(entry)).toBeTruthy());
    expect(screen.getByText(failure)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it("keeps the stolen reaching action on the player's own empty desk and the original token with its owner", async () => {
    const close = action({ type: "CLOSE", caseId: "intended-reach" }, "恢复原决定并由诺汀归置原木片", true, "0行动 · 0精神 · 0灵性");
    const practice = { ...originalPractice, pose: "本人已立即向自己的空桌伸出空手，没有拿到任何物品。",
      target: "诺汀暂时忘记拿原蓝木片的当前决定，仍站在自己的桌边。",
      history: ["窃取1次 · 立即执行1次 · 恢复0次 · 原木片移动0次。"] };
    const value = dreamStealer({ promoted: true, insideCase: true, cases: cases(), actions: [close], practice });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("intended-reach");
    expect(screen.getByText(practice.pose)).toBeTruthy(); expect(screen.getByText(originalPractice.token)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^恢复原决定并由诺汀归置原木片/ }));
    expect(screen.getByText(practice.pose)).toBeTruthy();
    const history = [...practice.history, "诺汀恢复后亲手拿起原木片，再亲手放回原桌；两次实际移动，所有者未变。"];
    rerender(<DreamStealerPanel dreamStealer={{ ...value, insideCase: false, actions: [],
      practice: { ...originalPractice, history }, cases: value.cases.map((entry) => entry.id === "intended-reach"
        ? { ...entry, status: "EXAMINED", contactOpen: "已实际结束", closes: 1 } : entry) }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(originalPractice.pose)).toBeTruthy(); expect(screen.getByText(originalPractice.token)).toBeTruthy();
    expect(screen.getByText(history[1]!)).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("retains a failed reaching attempt, the target's actual pickup and no invented player theft", async () => {
    const close = action({ type: "CLOSE", caseId: "intended-reach" }, "由原主放回已拿起的木片并结束", true, "0行动 · 0精神 · 0灵性");
    const token = "原蓝木片DS5-TOKEN-1已由诺汀亲手拿起，仍在他手中。";
    const history = ["本次窃取失败，3灵性已耗；窃取0次 · 立即执行0次 · 原木片移动1次。"];
    const value = dreamStealer({ promoted: true, insideCase: true, actions: [close], cases: cases(),
      practice: { ...originalPractice, token, history } });
    const { onCommand } = panel(value);
    expect(screen.getByText(token)).toBeTruthy(); expect(screen.getByText(originalPractice.pose)).toBeTruthy();
    expect(screen.getByText(history[0]!)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^由原主放回已拿起的木片并结束/ }));
    expect(screen.getByText(token)).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
    expect(screen.queryByRole("button", { name: /拿走|获得木片|偷取物品|使用借用/ })).toBeNull();
  });

  it("shows ordinary seating as a voluntary comparison rather than a forced forgotten decision", () => {
    const pose = "本人普通坐在自己的原椅上，按同意条款进行落座对照。";
    const target = "瑟蕾自主完成本次坐下动作，没有被强制停顿或遗忘。";
    const result = "普通知识核对完成，未窃取念头，也不产生能力收益。";
    panel(dreamStealer({ promoted: true, insideCase: true,
      actions: [action({ type: "CLOSE", caseId: "announced-seat" }, "普通起身并归置原椅", true, "0行动 · 0精神 · 0灵性")],
      cases: cases().map((entry) => entry.id === "announced-seat" ? { ...entry, status: "EXAMINED", result } : entry),
      practice: { ...originalPractice, pose, target, history: ["窃取0次 · 立即执行0次 · 恢复0次。"] } }));
    expect(screen.getByText(pose)).toBeTruthy(); expect(screen.getByText(target)).toBeTruthy();
    expect(screen.getByRole("region", { name: "窃梦家实际结果" }).textContent).toContain(result);
    expect(screen.getByText("窃取0次 · 立即执行0次 · 恢复0次。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /恢复被窃念头|使用能力/ })).toBeNull();
  });

  it("offers only projected ordinary inspection for the mechanical arm with no autonomous mind", async () => {
    const prepare = action({ type: "PREPARE", caseId: "empty-performance", method: "ORDINARY" }, "普通核对原杠杆与记录", true, "1行动 · 0灵性");
    const perform = action({ type: "PERFORM", caseId: "empty-performance" }, "实际查看机械木臂来源", true, "1行动 · 知识10 · 0灵性");
    const value = dreamStealer({ promoted: true, cases: cases(), practice: originalPractice, actions: [prepare, perform] });
    const { onCommand } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("empty-performance");
    expect(screen.getByText(cases()[2]!.story)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^普通核对原杠杆与记录/ }));
    await userEvent.click(screen.getByRole("button", { name: /^实际查看机械木臂来源/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([prepare.command, perform.command]);
    expect(screen.queryByRole("button", { name: /窃取|能力准备|入梦|解析梦境|储存念头/ })).toBeNull();
    expect(screen.getByLabelText("窃梦家能力边界").textContent).toContain("看到运动不等于发现了念头");
    expect(screen.getByText(originalPractice.pose)).toBeTruthy();
  });

  it("prioritizes the actual public zero-cost CLOSE and locks selection to its active case", async () => {
    const { onCommand, rerender } = panel(dreamStealer({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "empty-performance");
    const value = opened();
    rerender(<DreamStealerPanel dreamStealer={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("announced-seat"); expect(selector.disabled).toBe(true);
    expect(screen.getByRole("region", { name: "窃梦家成长下一步" }).textContent).toContain("下一步：实际恢复并普通起身收束");
    const close = screen.getByRole("button", { name: /^实际恢复并普通起身收束/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close);
    const withdraw = action({ type: "WITHDRAW", caseId: "intended-reach" }, "撤回这次尚未执行的准备", true, "0行动 · 0精神 · 0灵性");
    rerender(<DreamStealerPanel dreamStealer={{ ...value, actions: [
      action({ type: "CLOSE", caseId: "announced-seat" }, "旧接触不能再次结束", false), withdraw] }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(selector.value).toBe("intended-reach");
    expect(screen.getByRole("region", { name: "窃梦家成长下一步" }).textContent).toContain(`下一步：${withdraw.label}`);
    await userEvent.click(screen.getByRole("button", { name: /^撤回这次尚未执行的准备/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, withdraw.command]);
  });

  it("does not infer open contact or fabricate controls from prose, history or unrelated hidden-shaped properties", async () => {
    const value = { ...opened(), insideCase: false, actions: [], practice: null,
      futureEnemyIntent: "SECRET_NEXT_ENEMY_DECISION", dreamPool: ["UNVERIFIED_DREAM_POOL"],
      npcPrivateThought: "SECRET_PRIVATE_THOUGHT" };
    const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("announced-seat"); expect(selector.disabled).toBe(false);
    expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "窃梦家本人与原物实际状态" })).toBeNull();
    for (const text of [value.futureEnemyIntent, value.dreamPool[0]!, value.npcPrivateThought]) expect(screen.queryByText(text)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<DreamStealerPanel dreamStealer={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "窃梦家成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("supports ordinary peaceful completion without inventing theft, recovered stolen thoughts or new skills", () => {
    panel(dreamStealer({ promoted: true, acting: 100, actions: [], cases: cases().map((entry) => ({ ...entry, status: "RESOLVED",
      observations: ["普通方法实际核对原物与自愿动作。"], result: "普通方法已报告，未窃取念头。", closes: 1 })),
      practice: { ...originalPractice, history: ["实际窃取0次 · 立即执行0次 · 被窃念头恢复0次。"] } }));
    expect(screen.getByText(originalPractice.pose)).toBeTruthy(); expect(screen.getByText(originalPractice.target)).toBeTruthy();
    expect(screen.getByText("实际窃取0次 · 立即执行0次 · 被窃念头恢复0次。")).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "窃梦家扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("region", { name: "窃梦家成长下一步" }).textContent).toContain("这一阶段已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps projected reasons accessible and locks all submissions during busy, blocking and save errors", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    const report = value.actions[1]!;
    const disabled = screen.getByRole("button", { name: /^提交本次有限报告/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`dream-stealer-reason-${report.id}`);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<DreamStealerPanel dreamStealer={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.practice!.pose)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
      expect(screen.getByText("灵性 12 / 100 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows non-retryable persistence recovery without inventing another domain retry", () => {
    const onCommand = vi.fn();
    render(<DreamStealerPanel dreamStealer={dreamStealer()} resources={resources} busy={false}
      error={{ message: "存档版本已变化。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^听取窃梦家成品用药指导/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains only projected mastery and states immediate self-execution, resistance and unverified dream limits", () => {
    const abilities = [{ id: "error.s5.thought-theft", label: "当前念头窃取", mastery: 24, description: "成功后必须立即亲自执行对应动作。" },
      { id: "error.s6.power-theft", label: "原有限能力窃取", mastery: 68, description: "只从实际已知来源暂时借用。" }];
    panel(dreamStealer({ promoted: true, abilities, actions: [], practice: originalPractice }));
    expect(screen.getByText("窃梦家5")).toBeTruthy();
    abilities.forEach((ability) => expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy());
    const boundary = screen.getByLabelText("窃梦家能力边界");
    for (const text of ["本人必须立即亲自执行", "不会一并取得", "目标可恢复决定", "更强目标可能抵抗", "机械木臂没有自主心智", "不把梦中说法认定为事实", "序列4才有的", "原能力ID与掌握继续保留", "具体操作边界尚未核实"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /免于执行|储存|寄生|全部能力|梦境|未来/ })).toBeNull();
    expect(screen.queryByText(/^梦境窃取 · 掌握/)).toBeNull();
  });

  it("shows the ordinary original Marlow encounter separately and forwards exact talk and fight intents", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "赴原空院向马洛交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴原空院承担真实冲突", true, "1行动 · 真实伤势与死亡风险");
    const environment = "纸箱房原私人空院出口可见，成年马洛与自己的普通短棍在两米外。";
    const { onCommand } = panel(dreamStealer({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounterElement = screen.getByRole("region", { name: "窃梦家有限冲突" });
    expect(encounterElement.textContent).toContain("他是普通人，没有可供盗取的非凡能力");
    expect(encounterElement.textContent).toContain("不增加额外行动");
    const encounter = within(encounterElement);
    await userEvent.click(encounter.getByRole("button", { name: /^赴原空院向马洛交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴原空院承担真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "窃梦家实际结果" })).toBeNull();
  });

  it("preserves actual S6 sources, demonstrations, resources, independent windows, failures and bottles read-only", () => {
    const fireThief: FireThiefProjection = {
      title: "盗火人", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "盗火人原供货记录保留。", story: "原三案已和平收尾，旧对手已自行投降。", environment: "原示范与两段期限记录。",
      actions: [{ id: "old-reflect", label: "不可再次结算旧实践", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: ["borrowed-flash", "separate-windows", "unknown-power"].map((id, index) => ({ id, title: `盗火人原案${index + 1}`,
        story: `原案${index + 1}的真实经过。`, status: "RESOLVED", observations: index === 0
          ? ["原失败：3灵性已耗，未能窃取。", "下周想借闪光，实际借到冰霜，已在原杯水面使用并等待原主恢复。"] : [],
        preparation: index === 0 ? "当时只准备已演示的有限来源。" : null,
        result: `原案${index + 1}报告已提交，原借错、使用与恢复保留。`, contactOpen: "已实际结束", closes: index + 1 })),
      bottles: [{ id: "fire-thief-potion-2", title: "盗火人旧原瓶", source: "盗火人原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "fire-thief-potion-2", confirmed: true } }],
      abilities: [{ id: "error.s6.power-theft", label: "原有限能力窃取", mastery: 67, description: "原观察与真实来源条件继续保留。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
      loan: { caseId: "borrowed-flash", sample: "FROST", playerSteps: 0, targetSteps: 0, uses: 1, elapsedSteps: 3 },
      battleLoan: { playerRounds: 0, targetRounds: 0, startedRound: 2, uses: 1 }, enemyCourageSeen: true, enemySpirituality: 16,
      samples: [
        { id: "FLASH", label: "原闪光", source: "瑟蕾·芬恩对原屏后的净空目标实际示范。", instructorSpirituality: 16, demonstrated: true },
        { id: "FROST", label: "原冰霜", source: "同一瑟蕾·芬恩对原杯现有水面实际示范。", instructorSpirituality: 16, demonstrated: true },
        { id: "COURAGE", label: "原勇气", source: "诺汀·布莱尔原普通整理任务。", instructorSpirituality: 18, demonstrated: true },
      ],
    };
    const before = JSON.stringify(fireThief);
    render(<DreamStealerFireThiefHistory fireThief={fireThief} />);
    const historyElement = screen.getByRole("region", { name: "盗火人时期的经历" });
    const history = within(historyElement);
    for (const entry of fireThief.cases) {
      expect(history.getByText(`原案卷ID：${entry.id}`)).toBeTruthy();
      expect(history.getByText(`当时的接触：已实际结束 · 实际结束次数：${entry.closes}`)).toBeTruthy();
      expect(history.getByText(`当时的实际结果与报告：${entry.result}`)).toBeTruthy();
    }
    for (const observation of fireThief.cases[0]!.observations) expect(history.getByText(observation)).toBeTruthy();
    for (const sample of fireThief.samples) {
      expect(history.getByText(`原样本ID：${sample.id}`)).toBeTruthy(); expect(history.getByText(`来源：${sample.source}`)).toBeTruthy();
    }
    expect(history.getAllByText("原来源灵性 16 · 已有原实际示范")).toHaveLength(2);
    expect(history.getByText("原来源灵性 18 · 已有原实际示范")).toBeTruthy();
    const windows = within(screen.getByLabelText("盗火人原借用与两段时窗"));
    expect(windows.getByText("原冰霜")).toBeTruthy(); expect(windows.getByText("borrowed-flash")).toBeTruthy();
    expect(windows.getAllByText("0 个现场时段")).toHaveLength(2);
    expect(windows.getByText("3 个现场时段")).toBeTruthy(); expect(windows.getByText("第2回合")).toBeTruthy();
    expect(windows.getByText("16")).toBeTruthy(); expect(windows.getByText("原战斗已实际观察")).toBeTruthy();
    expect(history.getByText("原瓶ID：fire-thief-potion-2")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原有限能力窃取 · 掌握 67：原观察与真实来源条件继续保留。")).toBeTruthy();
    expect(historyElement.textContent).toContain("不补满来源灵性"); expect(historyElement.textContent).toContain("不生成当前可用能力");
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可再次结算旧实践")).toBeNull(); expect(JSON.stringify(fireThief)).toBe(before);
  });
});
