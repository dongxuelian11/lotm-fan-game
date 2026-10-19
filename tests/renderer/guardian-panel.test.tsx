/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuardianAction, GuardianCommand, GuardianProjection } from "../../src/domain/guardian/types";
import type { DawnPaladinProjection } from "../../src/domain/dawn-paladin/types";
import { GuardianDawnPaladinHistory, GuardianPanel } from "../../src/renderer/GuardianPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；黎明骑士消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: GuardianCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): GuardianAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取守护者成品用药指导", true, "460便士 · 1行动");
const emptyEquipment: GuardianProjection["battleEquipment"] = {
  swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null,
};
function guardian(patch: Partial<GuardianProjection> = {}): GuardianProjection {
  return {
    title: "守护者晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "黎明骑士扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, battleEquipment: { ...emptyEquipment }, ...patch,
  };
}
function cases(): GuardianProjection["cases"] {
  return [
    { id: "guarded-load", title: "守护承压", story: "原软垫摆锤与机械止动已在本案练习角，基准6伤害只是原创G低强度试探。" },
    { id: "lowered-guard", title: "出手时降低防御", story: "第二套原软垫摆锤与原纸靶GD5-TARGET-1，出手用自己的身体或已有原棍。" },
    { id: "nearby-companion", title: "近旁同伴的真实分担", story: "成年维拉自愿参与第三套原摆锤试探，从相邻等候点沿原两米路径到场。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
const originalPractice: NonNullable<GuardianProjection["practice"]> = {
  guard: "本人未进入守护，本轮没有出手；实践累计实际承伤0。",
  target: "原纸靶GD5-TARGET-1仍完整，没有凭空创建替代品。",
  companion: "维拉仍在相邻原等候点；未在分担范围，健康100，累计伤害0，实际分担0。",
  history: [],
};
function bottled(): GuardianProjection {
  const originals = [
    { id: "guardian-potion-1", title: "第一瓶守护者魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "guardian-potion-2", title: "第二瓶守护者魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "guardian-potion-3", title: "第三瓶守护者魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return guardian({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): GuardianProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：本次意志核对未通过，已消耗3灵性，实际承受2点试探伤害，未取得成功报告。";
function opened(caseId = "guarded-load"): GuardianProjection {
  return guardian({ promoted: true, insideCase: true, actions: [
    action({ type: "CLOSE", caseId }, "停止原摆锤并实际解除守护", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "REPORT", caseId }, "提交本次有限报告", false),
  ], cases: cases().map((entry) => entry.id === caseId ? {
    ...entry, status: "EXAMINED", observations: ["本次已核对原软垫摆锤与机械止动。", failure],
    preparation: "只同意本次实际试探，守护期间不出手。", contactOpen: "本次接触尚未实际结束",
  } : entry), practice: { ...originalPractice, guard: "本人实际守护且没有攻击；已接受1次试探，实践累计承伤2。",
    history: ["实际试探1次，实付3灵性，本人健康实际减少2；原失败保留。"] } });
}
function panel(value: GuardianProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<GuardianPanel guardian={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Guardian public defense, real injuries and independent original bottles", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "黎明骑士扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(guardian({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "守护者成长下一步" });
    expect(summary.textContent).toContain("黎明骑士6 → 守护者5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方与晋升仪式细节尚未核实");
    expect(summary.textContent).toContain("不能据此断言无需仪式");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取守护者成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: GuardianCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "guardian-potion-3" },
      { type: "BUY_POTION", bottleId: "guardian-potion-3" }, { type: "BUY_POTION", bottleId: "guardian-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(guardian({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["guardian-potion-1", "guardian-potion-2", "guardian-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "guardian-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("guardian-potion-2"));
    expect(screen.getByText("guardian-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "守护者服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 100", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶守护者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "守护者能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("guardian-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶守护者魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<GuardianPanel guardian={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶守护者魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("guardian-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<GuardianPanel guardian={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<GuardianPanel guardian={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶守护者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶守护者魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("guardian-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶守护者魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<GuardianPanel guardian={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*guardian-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("guardian-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("guardian-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶守护者魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("guardian-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶守护者魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升守护者" } : bottle) };
    rerender(<GuardianPanel guardian={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶守护者魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "守护者能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升守护者")).toBeTruthy();
    expect(screen.getByText("原瓶ID：guardian-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("guardian-potion-2"));
    expect(screen.getByText("guardian-potion-2")).toBeTruthy();
    rerender(<GuardianPanel guardian={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶守护者魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("guardian-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<GuardianPanel guardian={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶守护者魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });


  it("forwards all projected case intents unchanged without optimistically guarding, injuring or moving anyone", async () => {
    const commands: GuardianCommand[] = [{ type: "OBSERVE", caseId: "guarded-load" },
      { type: "PREPARE", caseId: "guarded-load", method: "ORDINARY" },
      { type: "PREPARE", caseId: "guarded-load", method: "ABILITY" },
      { type: "PERFORM", caseId: "guarded-load" }, { type: "WITHDRAW", caseId: "guarded-load" },
      { type: "CLOSE", caseId: "guarded-load" }, { type: "REPORT", caseId: "guarded-load" }];
    const labels = ["核对原摆锤", "准备普通移开", "准备守护承压", "实施本次试探", "撤回未实施准备", "结束本次接触", "提交有限报告"];
    const value = guardian({ promoted: true, cases: cases(), practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "lowered-guard");
    expect(screen.queryByRole("button", { name: /^实施本次试探/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "guarded-load");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const text of [originalPractice.guard, originalPractice.target, originalPractice.companion]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("准备只记录本次知情同意与方法");
    expect(screen.queryByRole("region", { name: "守护者实际结果" })).toBeNull();
  });

  it("keeps preparation outside contact and recommends actual performance before voluntary withdrawal", async () => {
    const perform = action({ type: "PERFORM", caseId: "nearby-companion" }, "让维拉实际沿两米原路到场并试探", true, "1行动 · 3灵性 · 意志14");
    const withdraw = action({ type: "WITHDRAW", caseId: "nearby-companion" }, "撤回本次未执行的同意", true, "0行动 · 0精神 · 0灵性");
    const value = guardian({ promoted: true, cases: cases().map((entry) => entry.id === "nearby-companion"
      ? { ...entry, status: "PREPARED", preparation: "仅记录本次同意，维拉仍在原等候点。" } : entry),
      actions: [withdraw, perform], practice: originalPractice });
    const { onCommand } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "守护者成长下一步" }).textContent).toContain(`下一步：${perform.label}`);
    expect(screen.getByText(originalPractice.companion)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${perform.label}`) }));
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${withdraw.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([perform.command, withdraw.command]);
    expect(screen.getByText(originalPractice.companion)).toBeTruthy();
  });

  it("shows real guard failure damage, actual player health and zero-resource close without healing", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(value.practice!.guard)).toBeTruthy();
    const state = screen.getByRole("region", { name: "守护者本人与同伴实际状态" });
    expect(within(state).getByText("76 / 100")).toBeTruthy();
    expect(screen.getByText(failure)).toBeTruthy();
    rerender(<GuardianPanel guardian={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const close = screen.getByRole("button", { name: /^停止原摆锤并实际解除守护/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); await userEvent.click(close);
    expect(screen.getByText(value.practice!.guard)).toBeTruthy();
    const guard = "本人已实际解除守护；原承伤2保留，未恢复健康。";
    rerender(<GuardianPanel guardian={{ ...value, insideCase: false, actions: [],
      practice: { ...value.practice!, guard }, cases: value.cases.map((entry) => entry.id === "guarded-load"
        ? { ...entry, contactOpen: "已实际结束", closes: 1 } : entry) }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(guard)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.getByText("76 / 100")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it("shows actual own strike, lowered defense, original marked target and retained damage", () => {
    const result = "本次原纸靶留下实际击痕；本人健康减少3，灵性消耗3，意志核对成功。";
    const practice = { ...originalPractice, guard: "本人已出手，守护不再持续；实践累计承伤3。",
      target: "原纸靶GD5-TARGET-1已经留下实际击痕，仍为同一原靶。", history: ["以自己已持的原短棍实际出手1次，没有凝剑。"] };
    panel(guardian({ promoted: true, insideCase: true, practice,
      actions: [action({ type: "CLOSE", caseId: "lowered-guard" }, "停下第二套原摆锤并收回双手", true, "0行动 · 0灵性")],
      cases: cases().map((entry) => entry.id === "lowered-guard" ? { ...entry, status: "EXAMINED", result } : entry) }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("lowered-guard");
    for (const text of [practice.guard, practice.target, practice.history[0]!]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole("region", { name: "守护者实际结果" }).textContent).toContain(result);
    expect(screen.getByLabelText("守护者本场临时装备").textContent).toContain("当前没有待用晨曦剑");
    expect(screen.queryByRole("button", { name: /免费凝剑|恢复纸靶|自动治疗/ })).toBeNull();
  });

  it.each([
    ["成功", "本人正在守护且没有出手；此次分担3，实践累计承伤7。", "维拉实际在两米标记，健康97，累计伤害3，本人实际分担3。"],
    ["失败", "本人正在守护且没有出手；此次分担0，实践累计承伤4。", "维拉实际在两米标记，健康94，累计伤害6，本人实际分担0。"],
  ])("renders committed %s sharing with exact public player and ally injuries and physical return", async (_tier, guard, companion) => {
    const close = action({ type: "CLOSE", caseId: "nearby-companion" }, "停止第三套原摆锤并让维拉走回原等候点", true, "0行动 · 0精神 · 0灵性");
    const practice = { ...originalPractice, guard, companion, history: ["维拉已亲自从相邻等候点沿两米原路走到标记；一次试探实际发生。"] };
    const value = guardian({ promoted: true, insideCase: true, cases: cases(), actions: [close], practice });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("nearby-companion");
    expect(screen.getByText(guard)).toBeTruthy(); expect(screen.getByText(companion)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${close.label}`) }));
    expect(screen.getByText(companion)).toBeTruthy();
    const returned = `${companion} 她已实际走回原等候点，不再在分担范围，原伤势未恢复。`;
    rerender(<GuardianPanel guardian={{ ...value, insideCase: false, actions: [], practice: { ...practice, companion: returned } }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(returned)).toBeTruthy(); expect(screen.getByText("76 / 100")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("supports all three peaceful alternatives without inventing guard success, injuries or mastery", async () => {
    const commands: GuardianCommand[] = cases().map((entry) => ({ type: "PREPARE", caseId: entry.id, method: "ORDINARY" }));
    const labels = ["普通移开第一套原摆锤", "普通拆下原纸靶与第二套原摆锤", "双方退出第三套原试探"];
    const { onCommand, rerender } = panel(guardian({ promoted: true, cases: cases(), practice: originalPractice,
      actions: commands.map((command, index) => action(command, labels[index]!, true, "1行动 · 0灵性")) }));
    for (let index = 0; index < commands.length; index++) {
      await userEvent.selectOptions(screen.getByRole("combobox"), cases()[index]!.id);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${labels[index]!}`) }));
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    const target = "原纸靶与第二套摆锤已实际拆下，未造成任何伤害。";
    rerender(<GuardianPanel guardian={guardian({ promoted: true, acting: 100, actions: [],
      cases: cases().map((entry) => ({ ...entry, status: "RESOLVED", closes: 1, result: "普通方法已报告，未使用能力。" })),
      practice: { ...originalPractice, target, history: ["普通路线实际收束三案；探击0，本人伤害0，同伴伤害0，分担0。"] } })}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(target)).toBeTruthy(); expect(screen.getByText(originalPractice.companion)).toBeTruthy();
    expect((screen.getByRole("progressbar", { name: "守护者扮演进度" }) as HTMLProgressElement).value).toBe(100);
    expect(screen.getByRole("region", { name: "守护者成长下一步" }).textContent).toContain("这一阶段已消化");
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByText(/守护状态 · 掌握/)).toBeNull();
  });

  it("prioritizes projected zero-cost CLOSE and locks selection to its active case", async () => {
    const { onCommand, rerender } = panel(guardian({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "nearby-companion");
    const value = opened();
    rerender(<GuardianPanel guardian={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("guarded-load"); expect(selector.disabled).toBe(true);
    expect(screen.getByRole("region", { name: "守护者成长下一步" }).textContent).toContain("下一步：停止原摆锤并实际解除守护");
    const close = screen.getByRole("button", { name: /^停止原摆锤并实际解除守护/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close);
    const withdraw = action({ type: "WITHDRAW", caseId: "nearby-companion" }, "撤回尚未执行的同伴准备", true, "0行动 · 0精神 · 0灵性");
    rerender(<GuardianPanel guardian={{ ...value, actions: [action({ type: "CLOSE", caseId: "guarded-load" }, "旧接触不能再次结束", false), withdraw] }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(selector.value).toBe("nearby-companion");
    expect(screen.getByRole("region", { name: "守护者成长下一步" }).textContent).toContain(`下一步：${withdraw.label}`);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${withdraw.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, withdraw.command]);
  });

  it("does not infer contact, health, secret thoughts or controls from extra hidden-shaped properties", () => {
    const value = { ...opened(), insideCase: false, actions: [], practice: null,
      npcPrivateThought: "SECRET_VERA_THOUGHT", nextDamageRoll: "SECRET_FUTURE_HARM", rngSeed: "SECRET_SEED" };
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "守护者本人与同伴实际状态" })).toBeNull();
    for (const text of [value.npcPrivateThought, value.nextDamageRoll, value.rngSeed]) expect(screen.queryByText(text)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<GuardianPanel guardian={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "守护者成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains accessible public reasons and locks submissions during busy, blocking and save errors", () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    const report = value.actions[1]!;
    const disabled = screen.getByRole("button", { name: /^提交本次有限报告/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`guardian-reason-${report.id}`);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<GuardianPanel guardian={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(value.practice!.guard)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
      expect(screen.getByText("灵性 12 / 100 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows non-retryable persistence recovery without fabricating another domain retry", () => {
    const onCommand = vi.fn();
    render(<GuardianPanel guardian={guardian()} resources={resources} busy={false}
      error={{ message: "存档版本已变化。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^听取守护者成品用药指导/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows only projected mastery and separates actual guardian-state, illusion clarity and unavailable S4", () => {
    const abilities = [{ id: "warrior.s5.guard-state", label: "守护状态", mastery: 24, description: "放弃攻击时取得强防御。" },
      { id: "warrior.s5.damage-sharing", label: "近旁伤害分担", mastery: 8, description: "由本人实际承接近旁同伴伤害。" },
      { id: "warrior.s6.light-storm", label: "原光之风暴", mastery: 68, description: "必须已有实际凝剑并承担失剑与裂甲。" }];
    panel(guardian({ promoted: true, abilities, actions: [], practice: originalPractice }));
    expect(screen.getByText("守护者5")).toBeTruthy();
    abilities.forEach((ability) => expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy());
    const boundary = screen.getByLabelText("守护者能力边界");
    for (const text of ["守护状态放弃攻击", "主动出手时防御降低", "不会被幻术迷惑", "不等于读心", "实际损失1健康", "实际损失2健康", "本人实际损失3健康",
      "她仍承受3点", "她承受6点", "不追溯转移旧伤", "不递归转移", "只结算一次", "原能力ID与掌握", "序列4猎魔人", "神话生物形态", "守护者本页不提供序列4猎魔人的"])
      expect(boundary.textContent).toContain(text);
    expect(boundary.textContent).toContain("三项有限实践、软垫试探、距离、伤害、消耗、判定、导师准备、独立成品渠道与消化数值以本页说明为准。完整配方和晋升仪式细节尚未掌握，服药前仍须完成当前渠道要求的准备。");
    expect(boundary.textContent).toContain("晨曦、晨曦铠甲、凝聚武器与光之风暴继承原能力ID与掌握。晨曦剑须实际凝聚，光之风暴需已有剑并实际耗灵，会失剑且使自身光甲受损；不自动借棍、补剑或补甲。守护者本页不提供序列4猎魔人的邪恶与污染辨识、隐藏意图、怪物弱点、专用材料与针对性药膏、神话生物形态。");
    expect(screen.queryByRole("button", { name: /读心|邪恶标记|药膏|神话形态|自动补剑/ })).toBeNull();
  });

  it("describes optional Edwin combat as whole-round nonattacking defense with no actual ally", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "向埃德温交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担埃德温的真实冲突", true, "1行动 · 真实伤势与死亡风险");
    const environment = "埃德温在原空院中，普通出口清楚，双方相距两米。";
    const { onCommand } = panel(guardian({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const element = screen.getByRole("region", { name: "守护者有限冲突" });
    for (const text of ["埃德温", "自己的普通短棍", "对方不追击", "维拉不会加入", "没有可分担伤害的同伴", "本回合全程守护并放弃攻击", "不足时仍不攻击", "不能伤害埃德温"])
      expect(element.textContent).toContain(text);
    const encounter = within(element);
    await userEvent.click(encounter.getByRole("button", { name: /^向埃德温交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担埃德温的真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("button", { name: /召唤维拉|分担同伴|保证胜利/ })).toBeNull();
    expect(screen.getByLabelText("守护者能力边界").textContent).toContain("不与旧光甲重复相乘");
  });

  it("renders only current encounter sword, loss and armor expiry without copying old S6 equipment", () => {
    panel(guardian({ promoted: true, actions: [], battleEquipment: {
      swordReady: false, swordLostRound: 3, armorReady: true, armorExpiresRound: 5,
    } }));
    const equipment = within(screen.getByLabelText("守护者本场临时装备"));
    for (const text of ["当前没有待用晨曦剑", "第3回合", "已有本场临时光甲", "至第5回合"])
      expect(equipment.getByText(text)).toBeTruthy();
    expect(equipment.queryByRole("button")).toBeNull();
  });

  it("keeps every old S6 practice field, injuries to original objects, independent equipment and bottles read-only", () => {
    const dawnPaladin: DawnPaladinProjection = {
      title: "黎明骑士", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "旧三瓶来源与实际耗用记录保留。", story: "原三案以真实动作收束。", environment: "原导师短棍已实际归还奥斯温，旧罗尔德伤势仍保留。",
      actions: [{ id: "old-reflect", label: "不可重做旧反思", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      cases: [{ id: "cleared-storm", title: "原清场风暴", story: "原失败已耗灵性，后来跨周重试。", status: "RESOLVED",
        observations: ["原场地与退出路线已核对。"], preparation: "导师从原出口走到场外。", result: "实际风暴后失剑、裂甲与原靶损毁保留。", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "dawn-paladin-old", title: "黎明骑士旧原瓶", source: "原独立黎明骑士成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "dawn-paladin-old", confirmed: true } }],
      abilities: [{ id: "warrior.s6.dawn-light", label: "原晨曦", mastery: 12, description: "原实际破幻记录。" },
        { id: "warrior.s6.dawn-armor", label: "原晨曦铠甲", mastery: 23, description: "原实际裂甲记录。" },
        { id: "warrior.s6.dawn-weapon", label: "原晨曦武器", mastery: 34, description: "原实际凝剑记录。" },
        { id: "warrior.s6.light-storm", label: "原光之风暴", mastery: 45, description: "原实际风暴记录。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原风险记录", insideCase: false,
      practice: { swordActive: false, armorActive: false, illusionCreated: true, volunteerSpirituality: 16, illusionDispelled: true,
        screenRemoved: false, armorProbePerformed: true, armorCracked: true, stormCleared: true, instructorOutside: false,
        stormTarget: "DESTROYED", stormFrameScorched: true, stormSwordDispersed: true, stormArmorCracked: true },
      battleEquipment: { swordReady: false, swordLostRound: 4, armorReady: false, armorExpiresRound: 6 },
    };
    render(<GuardianDawnPaladinHistory dawnPaladin={dawnPaladin} />);
    const history = within(screen.getByRole("region", { name: "黎明骑士时期的经历" }));
    for (const text of [dawnPaladin.environment, "原失败已耗灵性，后来跨周重试。", "原场地与退出路线已核对。", "原案卷ID：cleared-storm", "原瓶ID：dawn-paladin-old",
      "当时的方案与准备：导师从原出口走到场外。", "当时的实际结果与报告：实际风暴后失剑、裂甲与原靶损毁保留。", "来源：原独立黎明骑士成品渠道", "已耗用 · 原失败保留",
      "16", "已实际建立", "已实际破除", "尚无移开记录", "已实际试探", "已有实际裂纹", "已实际清场", "原记录不在场外等候",
      "已被实际风暴毁坏", "已有风暴灼损", "已在原风暴后消散", "已有风暴裂纹", "第4回合", "至第6回合"])
      expect(history.getByText(text)).toBeTruthy();
    dawnPaladin.abilities.forEach((ability) => expect(history.getByText(`${ability.label} · 掌握 ${ability.mastery}：${ability.description}`)).toBeTruthy());
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText("不可重做旧反思")).toBeNull(); expect(history.queryByLabelText("守护者本场临时装备")).toBeNull();
  });
});
