/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MysticismMagisterAction, MysticismMagisterCommand, MysticismMagisterProjection } from "../../src/domain/mysticism-magister/types";
import type { PolymathProjection } from "../../src/domain/polymath/types";
import { MysticismMagisterPolymathHistory, MysticismMagisterPanel } from "../../src/renderer/MysticismMagisterPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "本作原创G：意志难度26；博学者消化100且晋升后满12整周。大成功晋升精神−5；成功晋升精神−10；失败未晋升精神−20、健康−10、排异+25；灾难中断晋升精神−40、健康−20、排异+50。导师处理本次指导服药的排异，不随机即死，休养可恢复；原瓶不复原，保护不适用于战斗。";
function action(command: MysticismMagisterCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): MysticismMagisterAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取秘术导师成品用药指导", true, "460便士 · 1行动");
function mysticismMagister(patch: Partial<MysticismMagisterProjection> = {}): MysticismMagisterProjection {
  return {
    title: "秘术导师晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "博学者扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: null, crafts: [], ...patch,
  };
}
function cases(): MysticismMagisterProjection["cases"] {
  return [
    { id: "linked-dream", title: "真实原物联系", story: "成年诺亚的原布片始终属于本人，原休息室沿公共走道40米可达。" },
    { id: "modest-craft", title: "有材料的有限制作", story: "实际购入并耗用灵性材料包，只制作一件短暂微光原件。" },
    { id: "careful-teaching", title: "有边界的谨慎教导", story: "成年塔莉娅独立核对来源、出口与材料清单。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): MysticismMagisterProjection {
  const originals = [
    { id: "mysticism-magister-potion-1", title: "第一瓶秘术导师魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "mysticism-magister-potion-2", title: "第二瓶秘术导师魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "mysticism-magister-potion-3", title: "第三瓶秘术导师魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return mysticismMagister({ guidanceKnown: true, supplies: "三瓶独立G成品原瓶，原价4800便士，每瓶五次劳务抵4200，再付600；完整配方和仪式未知。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): MysticismMagisterProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const failure = "原失败保留：本次仪式未建立联系，实际消耗4灵性，原布片仍暂借在玩家手中。";
const borrowed = "原布片MM5-CLOTH-1暂借在玩家手中，所有人仍是诺亚。";
const owner = "原布片MM5-CLOTH-1已由玩家步行归还诺亚本人。";
const claim = "当次梦境接触仍在继续；已有待核实说法，尚未经清醒核实。";
const closedClaim = "实际梦境已结束；待核实说法尚未经清醒核实。";
const verified = "实际梦境已结束；已向清醒的诺亚核实本次有限消息。";
function practice(patch: Partial<NonNullable<MysticismMagisterProjection["practice"]>> = {}): NonNullable<MysticismMagisterProjection["practice"]> {
  return { token: borrowed, dream: claim, summary: "玩家身体始终留在原书房；原布片不是魔法材料。", ...patch };
}
function opened(): MysticismMagisterProjection {
  return mysticismMagister({ promoted: true, insideCase: true, actions: [
    action({ type: "CLOSE", caseId: "linked-dream" }, "实际结束当前梦境接触", true, "0行动 · 0精神 · 0灵性"),
    action({ type: "VERIFY_DREAM" }, "普通步行后向清醒诺亚核实", false, "1行动 · 普通去回40米"),
    action({ type: "RETURN_TOKEN" }, "步行归还同一原布片", false, "0行动 · 普通去回40米"),
  ], cases: cases().map((entry) => entry.id === "linked-dream" ? {
    ...entry, status: "EXAMINED", observations: [failure],
    preparation: "当次已重新确认成年诺亚的同意与入睡，玩家身体留在书房。",
    result: "梦中得到一条有限说法，必须清醒核实。", contactOpen: "本次接触尚未实际结束",
  } : entry), practice: practice() });
}
function panel(value: MysticismMagisterProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MysticismMagisterPanel mysticismMagister={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function bottleButton(id: string): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^查看并准备服用.*原瓶 ${id}$`) }) as HTMLButtonElement;
}
afterEach(cleanup);

describe("Mysticism Magister real links, original crafts and read-only Polymath history", () => {
  it("shows the public S6 gate and G supply while keeping the full recipe and ritual unknown", () => {
    const reason = "博学者扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立G成品由原指导者保管，本瓶已完成4/5步劳务，原价4800便士。";
    const { onCommand } = panel(mysticismMagister({ digestion: reason, supplies,
      formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "秘术导师成长下一步" });
    expect(summary.textContent).toContain("博学者6 → 秘术导师5");
    expect(summary.textContent).toContain(reason);
    expect(summary.textContent).toContain("完整魔药配方、晋升仪式与具体法术清单尚未核实");
    expect(summary.textContent).toContain("不能据此断言无需仪式");
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取秘术导师成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards original guidance, per-bottle labour, payment and resupply commands with projected costs", async () => {
    const commands: MysticismMagisterCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "mysticism-magister-potion-3" },
      { type: "BUY_POTION", bottleId: "mysticism-magister-potion-3" }, { type: "BUY_POTION", bottleId: "mysticism-magister-potion-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "支付第二瓶原价", "申请下一批成品", "登记实际到货"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "4800便士 · 0行动", "1行动 · 下一真实周到货", "0行动"];
    const { onCommand } = panel(mysticismMagister({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels each independent bottle at zero AP and restores focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    for (const id of ["mysticism-magister-potion-1", "mysticism-magister-potion-2", "mysticism-magister-potion-3"]) {
      bottleButton(id).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement?.tagName).toBe("H3");
      expect(screen.getByText(id)).toBeTruthy();
      if (id === "mysticism-magister-potion-2") await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
      else await userEvent.keyboard("{Escape}");
      expect(document.activeElement).toBe(bottleButton(id));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, projected Will26 risk and resources before confirming its exact command once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    await userEvent.click(bottleButton("mysticism-magister-potion-2"));
    expect(screen.getByText("mysticism-magister-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "秘术导师服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶秘术导师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("region", { name: "秘术导师能力与消化" })).toBeNull();
  });

  it("retains the submitted original through save failure and leaves same-operation retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("mysticism-magister-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶秘术导师魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<MysticismMagisterPanel mysticismMagister={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶秘术导师魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("mysticism-magister-potion-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<MysticismMagisterPanel mysticismMagister={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<MysticismMagisterPanel mysticismMagister={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶秘术导师魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "这瓶秘术导师魔药的服用确认" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders a committed failed original as history and confirms the next original independently", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("mysticism-magister-potion-1"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶秘术导师魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<MysticismMagisterPanel mysticismMagister={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用.*mysticism-magister-potion-1/ })).toBeNull();
    await userEvent.click(bottleButton("mysticism-magister-potion-3"));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("mysticism-magister-potion-3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶秘术导师魔药」" }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, value.actions[2]!.command]);
  });

  it("ends confirmation only on committed promotion and preserves all original-bottle sources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("mysticism-magister-potion-3"));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶秘术导师魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升秘术导师" } : bottle) };
    rerender(<MysticismMagisterPanel mysticismMagister={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶秘术导师魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "秘术导师能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升秘术导师")).toBeTruthy();
    expect(screen.getByText("原瓶ID：mysticism-magister-potion-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("distinguishes identical bottle titles by original IDs and removes a revoked confirmation", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "独立原瓶" }));
    const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("mysticism-magister-potion-2"));
    expect(screen.getByText("mysticism-magister-potion-2")).toBeTruthy();
    rerender(<MysticismMagisterPanel mysticismMagister={{ ...value, actions: [], bottles: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶秘术导师魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("updates public risk and eligibility without recalculating chance or submitting after conditions change", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(bottleButton("mysticism-magister-potion-2"));
    const reason = "请先恢复精神，再按本瓶公开条件确认。";
    const updated = { ...value, risk: "更新后的公开四档风险，仍保留原瓶消耗。",
      bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })),
      actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<MysticismMagisterPanel mysticismMagister={updated} resources={{ ...resources, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("0 / 100")).toBeTruthy();
    expect(screen.getByText(updated.risk)).toBeTruthy(); expect(screen.getByText(reason)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶秘术导师魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards selected-case public methods without inventing a dream, craft or teaching result", async () => {
    const commands: MysticismMagisterCommand[] = [{ type: "OBSERVE", caseId: "modest-craft" },
      { type: "PREPARE", caseId: "modest-craft", method: "ORDINARY" },
      { type: "PREPARE", caseId: "modest-craft", method: "ABILITY" },
      { type: "PERFORM", caseId: "modest-craft" }, { type: "WITHDRAW", caseId: "modest-craft" },
      { type: "CLOSE", caseId: "modest-craft" }, { type: "REPORT", caseId: "modest-craft" }];
    const labels = ["核对原材料渠道", "准备普通纸样对照", "准备实际耗料制作", "实际购料并执行制作", "撤回准备", "结束本次制作接触", "提交有限制作报告"];
    const value = mysticismMagister({ promoted: true, cases: cases(), practice: practice({ token: owner, dream: "尚无本次梦境说法。" }),
      actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox"), "linked-dream");
    expect(screen.queryByRole("button", { name: /^实际购料并执行制作/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "modest-craft");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.getByText("尚无实际制作成功的微光原件。")).toBeTruthy();
    expect(screen.getByText("尚无本次梦境说法。")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "秘术导师实际结果" })).toBeNull();
  });

  it("prioritizes actual CLOSE at zero resources and uses public intents to locate the open case", async () => {
    const { onCommand, rerender } = panel(mysticismMagister({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "careful-teaching");
    const value = opened();
    rerender(<MysticismMagisterPanel mysticismMagister={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("linked-dream"); expect(selector.disabled).toBe(true);
    expect(screen.getByRole("region", { name: "秘术导师成长下一步" }).textContent).toContain("下一步：实际结束当前梦境接触");
    const close = screen.getByRole("button", { name: /^实际结束当前梦境接触/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close);
    expect(screen.getByText(claim)).toBeTruthy(); expect(screen.getByText(borrowed)).toBeTruthy();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    const withdraw = action({ type: "WITHDRAW", caseId: "modest-craft" }, "撤回尚未实施的制作准备", true, "0行动 · 不退还原成本");
    rerender(<MysticismMagisterPanel mysticismMagister={{ ...value, actions: [action({ type: "CLOSE", caseId: "linked-dream" }, "旧案不能结束", false), withdraw] }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(selector.value).toBe("modest-craft");
    expect(screen.getByRole("region", { name: "秘术导师成长下一步" }).textContent).toContain("下一步：撤回尚未实施的制作准备");
    await userEvent.click(screen.getByRole("button", { name: /^撤回尚未实施的制作准备/ }));
    expect(onCommand.mock.calls[1]![0]).toBe(withdraw.command);
  });

  it("keeps CLOSE, waking verification and original-cloth return explicit and separately committed", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    const link = screen.getByRole("region", { name: "秘术导师原布片与梦境核实" });
    expect(link.textContent).toContain(claim); expect(link.textContent).toContain("玩家身体留在原书房");
    expect(link.textContent).toContain("普通步行40米"); expect(link.textContent).toContain("归还也不会代替结束梦境");
    for (const label of [/^普通步行后向清醒诺亚核实/, /^步行归还同一原布片/]) {
      const blocked = screen.getByRole("button", { name: label }) as HTMLButtonElement;
      expect(blocked.disabled).toBe(true); fireEvent.click(blocked);
    }
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束当前梦境接触/ }));
    const verify = action({ type: "VERIFY_DREAM" }, "普通步行后向清醒诺亚核实", true, "1行动 · 普通去回40米");
    const giveBack = action({ type: "RETURN_TOKEN" }, "步行归还同一原布片", true, "0行动 · 普通去回40米");
    const report = action({ type: "REPORT", caseId: "linked-dream" }, "提交已核实的有限报告", false, "1行动");
    const closed = { ...value, insideCase: false, actions: [verify, giveBack, report], practice: practice({ dream: closedClaim }),
      cases: value.cases.map((entry) => entry.id === "linked-dream" ? { ...entry, closes: 1, contactOpen: "本次接触已实际结束" } : entry) };
    rerender(<MysticismMagisterPanel mysticismMagister={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /^实际结束当前梦境接触/ })).toBeNull();
    expect(screen.getByText(borrowed)).toBeTruthy(); expect(screen.getByText(closedClaim)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^普通步行后向清醒诺亚核实/ }));
    expect(screen.getByText(closedClaim)).toBeTruthy(); expect(screen.queryByText(verified)).toBeNull();
    const checked = { ...closed, actions: [giveBack, report], practice: practice({ dream: verified }) };
    rerender(<MysticismMagisterPanel mysticismMagister={checked} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(verified)).toBeTruthy(); expect(screen.getByText(borrowed)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^提交已核实的有限报告/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^步行归还同一原布片/ }));
    expect(screen.getByText(borrowed)).toBeTruthy();
    const ready = { ...checked, actions: [{ ...report, enabled: true, reason: null }], practice: practice({ token: owner, dream: verified }) };
    rerender(<MysticismMagisterPanel mysticismMagister={ready} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(owner)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.getByRole("region", { name: "当前秘术导师实践" }).textContent).toContain("实际结束次数：1");
    await userEvent.click(screen.getByRole("button", { name: /^提交已核实的有限报告/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([value.actions[0]!.command, verify.command, giveBack.command, report.command]);
  });

  it("does not turn an original-cloth return or failed connection into verified dream facts", async () => {
    const giveBack = action({ type: "RETURN_TOKEN" }, "归还失败尝试借用的原布片", true, "0行动");
    const value = mysticismMagister({ promoted: true, cases: opened().cases.map((entry) => entry.id === "linked-dream"
      ? { ...entry, result: "本次联系失败，原成本保留；接触已实际结束。", closes: 1, contactOpen: "本次接触已实际结束" } : entry), actions: [giveBack],
      practice: practice({ dream: "本次联系失败；梦境已结束，尚无可核实说法。" }) });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^归还失败尝试借用的原布片/ }));
    rerender(<MysticismMagisterPanel mysticismMagister={{ ...value, actions: [], practice: { ...value.practice!, token: owner } }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(owner)).toBeTruthy(); expect(screen.getByText(value.practice!.dream)).toBeTruthy();
    expect(screen.getByText(failure)).toBeTruthy(); expect(screen.queryByText(verified)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(giveBack.command);
  });

  it("never infers active contact or fabricates an exit command from historical prose", async () => {
    const value = { ...opened(), insideCase: false, actions: [] }; const { onCommand, rerender } = panel(value);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("linked-dream"); expect(selector.disabled).toBe(false);
    await userEvent.selectOptions(selector, "modest-craft"); expect(selector.value).toBe("modest-craft");
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<MysticismMagisterPanel mysticismMagister={{ ...value, insideCase: true }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "秘术导师成长下一步" }).textContent).toContain("查看当前公开的结束实践选项");
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows each real craft source and fixed power, then consumes only the exact projected original on committed test", async () => {
    const first = { id: "MM5-FLASH-1", source: "第54周实际购买并耗用MM5-KIT-1，费用160便士。", status: "原件已耗用 · 第54周", power: "制作时固定0.72" };
    const second = { id: "MM5-FLASH-2", source: "第55周实际购买并耗用MM5-KIT-2，费用160便士。", status: "原件由玩家持有 · 尚可实际耗用一次", power: "制作时固定0.79" };
    const test = action({ type: "TEST_TOKEN", itemId: second.id }, "实际测试原件MM5-FLASH-2", true, "0行动 · 耗用指定原件一次");
    const value = mysticismMagister({ promoted: true, cases: cases(), actions: [test], crafts: [first, second] });
    const { onCommand, rerender } = panel(value);
    const firstCard = screen.getByRole("article", { name: `一次性原件 ${first.id}` });
    const secondCard = screen.getByRole("article", { name: `一次性原件 ${second.id}` });
    expect(firstCard.textContent).toContain(first.source); expect(firstCard.textContent).toContain(first.status);
    expect(within(firstCard).queryByRole("button")).toBeNull();
    expect(secondCard.textContent).toContain(second.source); expect(secondCard.textContent).toContain(second.power);
    await userEvent.click(within(secondCard).getByRole("button", { name: /^实际测试原件MM5-FLASH-2/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(test.command); expect(onCommand.mock.calls[0]![0]).toBe(test.command);
    expect(secondCard.textContent).toContain(second.status);
    const spent = "原件已耗用 · 第56周在原空置试验凹室真实测试";
    rerender(<MysticismMagisterPanel mysticismMagister={{ ...value, actions: [], crafts: [first, { ...second, status: spent }] }}
      resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(spent)).toBeTruthy(); expect(screen.getByText(second.power)).toBeTruthy();
    expect(screen.getByText(`来源：${first.source}`)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "秘术导师实际制品与原料来源" }).textContent).toContain("不补充次数");
  });

  it("keeps actual craft testing gated until the projected contact is closed", async () => {
    const test = { ...action({ type: "TEST_TOKEN", itemId: "MM5-FLASH-4" }, "耗用测试MM5-FLASH-4", false), reason: "须先实际结束当前制作接触。" };
    const close = action({ type: "CLOSE", caseId: "modest-craft" }, "实际结束当前制作接触", true, "0行动");
    const craft = { id: "MM5-FLASH-4", source: "原材料MM5-KIT-5已真实耗用，第四次成功制作。", status: "玩家持有", power: "0.8" };
    const { onCommand } = panel(mysticismMagister({ promoted: true, insideCase: true, cases: cases(), crafts: [craft], actions: [test, close] }));
    const button = screen.getByRole("button", { name: /^耗用测试MM5-FLASH-4/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(button.getAttribute("aria-describedby")).toBe(`mysticism-magister-reason-${test.id}`);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束当前制作接触/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command); expect(screen.getByText(craft.status)).toBeTruthy();
  });

  it("offers optional real weekly crafting only through its public command and never previews an imaginary item", async () => {
    const { onCommand, rerender } = panel(mysticismMagister({ promoted: true, cases: cases(), actions: [] }));
    expect(screen.queryByRole("button", { name: /备制/ })).toBeNull();
    const make = { ...action({ type: "MAKE_TOKEN" }, "真实购料备制一次性原件", false, "1行动 · 160便士 · 4灵性"), reason: "须完成有限制作案，并已有学会的FLASH样本；本周尚未备制。" };
    const value = mysticismMagister({ promoted: true, cases: cases(), actions: [make] });
    rerender(<MysticismMagisterPanel mysticismMagister={value} resources={resources} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: /^真实购料备制一次性原件/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(screen.getByText(make.reason)).toBeTruthy(); fireEvent.click(button);
    rerender(<MysticismMagisterPanel mysticismMagister={{ ...value, actions: [{ ...make, enabled: true, reason: null }] }}
      resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^真实购料备制一次性原件/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(make.command); expect(screen.getByText(make.cost)).toBeTruthy();
    expect(screen.getByText("尚无实际制作成功的微光原件。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "秘术导师实际制品与原料来源" }).textContent).toContain("备制不是和平消化的必需步骤");
    expect(screen.queryByRole("button", { name: /测试|领取|免费/ })).toBeNull();
  });

  it("renders an actual ordinary lesson without granting copied abilities or an optimistic reward", async () => {
    const report = action({ type: "REPORT", caseId: "careful-teaching" }, "提交本人复核的清单记录", true, "1行动");
    const reflection = action({ type: "REFLECT" }, "反思三次有限实践", true, "1行动");
    const result = "塔莉娅以普通图示独立核对来源、出口与材料；没有使用魔法，也未获复制能力。";
    const value = mysticismMagister({ promoted: true, acting: 75, actions: [report, reflection], cases: cases().map((entry) => entry.id === "careful-teaching"
      ? { ...entry, status: "EXAMINED", result, closes: 1, contactOpen: "已实际结束" } : entry) });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "秘术导师实际结果" }).textContent).toContain(result);
    await userEvent.click(screen.getByRole("button", { name: /^提交本人复核的清单记录/ }));
    await userEvent.click(screen.getByRole("button", { name: /^反思三次有限实践/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([report.command, reflection.command]);
    expect((screen.getByRole("progressbar", { name: "秘术导师扮演进度" }) as HTMLProgressElement).value).toBe(75);
  });

  it("locks all projected submissions for busy, actual blocking and save errors without hiding original records", () => {
    const value = { ...opened(), crafts: [{ id: "MM5-FLASH-1", source: "实际耗用MM5-KIT-1", status: "玩家持有", power: "0.65" }],
      actions: [...opened().actions.map((entry) => ({ ...entry, enabled: true })),
        action({ type: "TEST_TOKEN", itemId: "MM5-FLASH-1" }, "测试原件", true), action({ type: "MAKE_TOKEN" }, "真实备制", true)] };
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<MysticismMagisterPanel mysticismMagister={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText(borrowed)).toBeTruthy(); expect(screen.getByText(claim)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
      expect(screen.getByText("来源：实际耗用MM5-KIT-1")).toBeTruthy(); expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows non-retryable persistence recovery without inventing a second domain retry", () => {
    const onCommand = vi.fn();
    render(<MysticismMagisterPanel mysticismMagister={mysticismMagister({ actions: [learn] })} resources={resources} busy={false}
      error={{ message: "存档版本已变化。", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
    expect(screen.queryByRole("button", { name: /重试|重新加载/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^听取秘术导师成品用药指导/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("states canonical ritual/material limits and narrow G practice without granting a free power library", () => {
    const abilities = [{ id: "reader.s5.secret-ritual", label: "有物联系的秘术仪式", mastery: 24, description: "需要真实原物和当次同意，实际仪式可能失败。" },
      { id: "reader.s5.material-imitation", label: "耗料制造式模仿", mastery: 8, description: "相关知识与真实超凡材料缺一不可。" },
      { id: "reader.s6.limited-imitation", label: "原有限模仿", mastery: 72, description: "原样本学习条件与实际弱化保留。" }];
    panel(mysticismMagister({ promoted: true, acting: 100, abilities, actions: [], cases: cases() }));
    expect(screen.getByText("秘术导师5")).toBeTruthy();
    expect(screen.getByText("有物联系的秘术仪式 · 掌握 24")).toBeTruthy(); expect(screen.getByText("原有限模仿 · 掌握 72")).toBeTruthy();
    const boundary = screen.getByLabelText("秘术导师能力边界");
    for (const fragment of ["不是梦魇能力", "不搬运玩家身体", "一千海里个案", "实际超凡材料", "可能失败", "不赠送完整技能库", "普通方法不制造魔法制品", "本人独立完成", "序列4的未来预言"])
      expect(boundary.textContent).toContain(fragment);
    expect(screen.queryByRole("button", { name: /瞬移|圣光|预言|必然|免费/ })).toBeNull();
  });

  it("keeps the real optional encounter separate and forwards exact talk and fight choices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "实际赴原私人工院交涉", true, "1行动 · 普通步行");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担罗文原普通棍的真实冲突", true, "1行动 · 真实伤势与死亡风险");
    const environment = "原空置私人工院，成年罗文持自己的普通棍站在2米处，真实出口可见。";
    const { onCommand } = panel(mysticismMagister({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "秘术导师有限冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^实际赴原私人工院交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担罗文原普通棍的真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "秘术导师实际结果" })).toBeNull();
  });

  it("preserves actual S6 sample learning, failed attempts, closures and original bottles as read-only history", () => {
    const polymath: PolymathProjection = {
      title: "博学者", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "博学者原供货记录保留。", story: "原三案已提交各自有限报告。", environment: "原教学室记录。",
      actions: [{ id: "old-analysis", label: "不可重新分析旧样本", enabled: true, reason: null, cost: "1行动", command: { type: "ANALYSE", caseId: "thin-frost" } }],
      cases: ["flash-study", "thin-frost", "willing-chorus"].map((id, index) => ({ id, title: `博学者原案${index + 1}`,
        story: `原案${index + 1}的真实经过。`, status: "RESOLVED", observations: index === 1 ? ["原失败：薄冰模仿失败仍消耗原灵性。"] : [],
        preparation: index === 1 ? "当时已实际亲见并分析原杯薄冰。" : null,
        result: `原案${index + 1}报告已提交，失败和实际消耗保留。`, contactOpen: "已实际结束", closes: index + 1 })),
      bottles: [{ id: "polymath-potion-2", title: "博学者旧原瓶", source: "博学者原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "polymath-potion-2", confirmed: true } }],
      abilities: [{ id: "reader.s6.limited-imitation", label: "原有限模仿", mastery: 67, description: "原样本、来源与失败继续保留。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
      samples: [
        { id: "FLASH", label: "原短暂闪光", observed: true, understood: true, learned: true, source: "成年诺亚的原实际示范", boundary: "弱化原闪光，未得到完整技能库。" },
        { id: "FROST", label: "原杯薄冰", observed: true, understood: true, learned: false, source: "诺亚的同一原杯水示范", boundary: "曾分析成功但模仿失败，原杯已归还。" },
        { id: "COURAGE", label: "原短句鼓舞", observed: true, understood: false, learned: false, source: "成年歌颂者的原自愿示范", boundary: "仅曾亲见，尚未分析成功或模仿成功。" },
      ],
    };
    render(<MysticismMagisterPolymathHistory polymath={polymath} />);
    const history = within(screen.getByRole("region", { name: "博学者时期的经历" }));
    for (const entry of polymath.cases) expect(history.getByText(`原案卷ID：${entry.id}`)).toBeTruthy();
    expect(history.getByText("原失败：薄冰模仿失败仍消耗原灵性。")).toBeTruthy();
    expect(history.getByText("原瓶ID：polymath-potion-2")).toBeTruthy();
    expect(history.getByText("来源：博学者原独立成品渠道")).toBeTruthy(); expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原有限模仿 · 掌握 67：原样本、来源与失败继续保留。")).toBeTruthy();
    const flash = within(history.getByLabelText("原短暂闪光"));
    expect(flash.getByText("原样本ID：FLASH")).toBeTruthy(); expect(flash.getByText("已成功模仿")).toBeTruthy();
    const frost = within(history.getByLabelText("原杯薄冰"));
    expect(frost.getByText("已分析成功")).toBeTruthy(); expect(frost.getByText("尚未成功模仿")).toBeTruthy();
    expect(frost.getByText("来源：诺亚的同一原杯水示范")).toBeTruthy();
    const courage = within(history.getByLabelText("原短句鼓舞"));
    expect(courage.getByText("已亲见")).toBeTruthy(); expect(courage.getByText("尚未分析成功")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
