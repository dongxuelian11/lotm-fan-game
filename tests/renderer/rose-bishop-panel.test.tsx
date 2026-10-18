/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoseBishopAction, RoseBishopCommand, RoseBishopProjection } from "../../src/domain/rose-bishop/types";
import type { ShadowAsceticProjection } from "../../src/domain/shadow-ascetic/types";
import { RoseBishopPanel, RoseBishopShadowAsceticHistory } from "../../src/renderer/RoseBishopPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可休养后另取独立成品重试。";
function action(command: RoseBishopCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): RoseBishopAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取蔷薇主教成品用药指导", true, "360便士 · 1行动");
function bishop(patch: Partial<RoseBishopProjection> = {}): RoseBishopProjection {
  return {
    title: "蔷薇主教晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "隐修士扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    reserve: { summary: "尚未购买或实际取用供给包。", points: 0, max: 3, packetsBought: 0, lastPurchaseWeek: null, packets: [] },
    practice: { shape: "NORMAL" }, ...patch,
  };
}
function cases(): RoseBishopProjection["cases"] {
  return [
    { id: "ring-release", title: "本人手部与同一原环", story: "只调整本人手部，退出同一只练习原环；普通安全方法也可完成。" },
    { id: "steady-grip", title: "本人手掌与同一原瓶", story: "由本人手掌承托同一只原瓶，不改动他人身体。" },
    { id: "reserve-lesson", title: "自愿成年人的储备教学", story: "成年学习者可拒绝这次讲解，不能用能力替他同意。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): RoseBishopProjection {
  const originals = [
    { id: "rose-bishop-potion-1", title: "第一瓶蔷薇主教魔药", source: "G原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "rose-bishop-potion-2", title: "第二瓶蔷薇主教魔药", source: "G原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "rose-bishop-potion-3", title: "第三瓶蔷薇主教魔药", source: "G原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return bishop({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function reserve(): RoseBishopProjection["reserve"] {
  return { summary: "两个密封动物原包，一包已经实际耗用，一包仍在。", points: 1, max: 3, packetsBought: 2, lastPurchaseWeek: 41, packets: [
    { id: "RB6-packet-1", acquiredWeek: 40, status: "CONSUMED", consumedWeek: 40 },
    { id: "RB6-packet-2", acquiredWeek: 41, status: "HELD", consumedWeek: null },
  ] };
}
const originalFailure = "第一次手部调整失败，原灵性与储备消耗保留。";
function opened(): RoseBishopProjection {
  return bishop({ promoted: true, insideCase: true, reserve: reserve(), practice: { shape: "SUPPORT_PALM" },
    cases: cases().map((entry) => entry.id === "steady-grip" ? { ...entry, status: "EXAMINED", observations: [originalFailure],
      result: "本人手掌已实际承托同一原瓶，原瓶仍在；尚未恢复常态。", contactOpen: "本次接触尚未实际结束" } : entry),
    actions: [action({ type: "CLOSE", caseId: "steady-grip" }, "放稳原瓶并实际恢复常态", true, "0行动 · 0精神 · 0灵性 · 0储备")],
  });
}
function panel(value: RoseBishopProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<RoseBishopPanel roseBishop={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Rose Bishop actual body practice, reserve originals and saved intent", () => {
  it("shows S7 maturity, G prices and recoverable four-tier risk without inventing a formula", () => {
    const reason = "隐修士扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(bishop({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "蔷薇主教成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "当前渠道只提供有来源的独立成品，不提供完整晋升配方、材料与剂量；不展示虚构材料，也不开放晋升魔药调配。"])
      expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    expect(summary.textContent).not.toContain("G指导");
    expect(summary.textContent).not.toContain("材料与剂量尚未核实");
    const button = screen.getByRole("button", { name: /^听取蔷薇主教成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, separate labour/payment and actual resupply commands", async () => {
    const commands: RoseBishopCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "rose-bishop-potion-3" },
      { type: "BUY_POTION", bottleId: "rose-bishop-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(bishop({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each original confirmation at zero AP and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶蔷薇主教魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶蔷薇主教魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶蔷薇主教魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶蔷薇主教魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶蔷薇主教魔药」" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, risk, saved resources and confirms only that original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶蔷薇主教魔药」" }));
    expect(screen.getByText("rose-bishop-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "蔷薇主教服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶蔷薇主教魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "rose-bishop-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted bottle through save error and leaves same-operation retry outside", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶蔷薇主教魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶蔷薇主教魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<RoseBishopPanel roseBishop={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶蔷薇主教魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("rose-bishop-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<RoseBishopPanel roseBishop={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<RoseBishopPanel roseBishop={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶蔷薇主教魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps failed original history and offers only untouched bottles after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶蔷薇主教魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶蔷薇主教魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<RoseBishopPanel roseBishop={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶蔷薇主教魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶蔷薇主教魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("rose-bishop-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion while retaining each original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶蔷薇主教魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶蔷薇主教魔药」" }));
    const promoted = { ...value, title: "蔷薇主教", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升蔷薇主教" } : bottle) };
    rerender(<RoseBishopPanel roseBishop={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶蔷薇主教魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升蔷薇主教")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects three distinct practices and sends exact methods without optimistic body changes", async () => {
    const commands: RoseBishopCommand[] = [{ type: "OBSERVE", caseId: "ring-release" }, { type: "PREPARE", caseId: "ring-release", method: "ORDINARY" },
      { type: "PREPARE", caseId: "ring-release", method: "ABILITY" }, { type: "PERFORM", caseId: "ring-release" },
      { type: "WITHDRAW", caseId: "ring-release" }, { type: "REPORT", caseId: "ring-release" }];
    const labels = ["核对本人手部与原环", "准备普通方法", "准备本人手部调整", "实际执行原环练习", "撤回待执行准备", "提交原环有限报告"];
    const { onCommand } = panel(bishop({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "蔷薇主教实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "ring-release");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("当前没有待执行的实践");
    expect(screen.getByText("当前本人身体：正常身体")).toBeTruthy(); expect(screen.getByRole("heading", { name: "血肉储备 0 / 3" })).toBeTruthy();
  });

  it("shows actual own-hand adjustment and paid costs while retaining a safe ordinary alternative", async () => {
    const paid = action({ type: "PERFORM", caseId: "ring-release" }, "实际调整本人手部", true, "1行动 · 3灵性 · 1储备");
    const ordinary = action({ type: "PREPARE", caseId: "ring-release", method: "ORDINARY" }, "改用普通安全方法", true, "0灵性 · 0储备");
    const value = bishop({ promoted: true, cases: cases(), actions: [paid, ordinary], reserve: reserve() }); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(paid.cost)).toBeTruthy(); expect(screen.getByText(ordinary.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际调整本人手部/ }));
    expect(screen.getByText("当前本人身体：正常身体")).toBeTruthy();
    rerender(<RoseBishopPanel roseBishop={{ ...value, insideCase: true, practice: { shape: "SLIM_HAND" }, actions: [action({ type: "CLOSE", caseId: "ring-release" }, "恢复本人手部常态")],
      cases: cases().map((entry) => entry.id === "ring-release" ? { ...entry, status: "EXAMINED", result: "同一原环已实际脱离，本人手部尚未复原。", contactOpen: "手部调整仍在" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前本人身体：本人手部仍处于有限调整")).toBeTruthy();
    expect(screen.getByText("同一原环已实际脱离，本人手部尚未复原。")).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(paid.command);
  });

  it("shows committed own-palm grip and the same original flask without inventing a replacement", () => {
    panel(opened());
    expect(screen.getByText(cases()[1]!.story)).toBeTruthy();
    expect(screen.getByText("当前本人身体：本人手掌仍处于承托调整")).toBeTruthy();
    expect(screen.getByText("本人手掌已实际承托同一原瓶，原瓶仍在；尚未恢复常态。")).toBeTruthy();
    expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /获得新瓶|改变他人身体|报告/ })).toBeNull();
  });

  it("pins actual contact to enabled CLOSE at zero resources and hides every competing action", async () => {
    const { onCommand, rerender } = panel(bishop({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "reserve-lesson"); const value = opened();
    rerender(<RoseBishopPanel roseBishop={{ ...value, actions: [action({ type: "CLOSE", caseId: "ring-release" }, "旧场景不能结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "steady-grip" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "steady-grip" }, "不可撤回代替复原"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "BUY_RATION" }, "不可现场买供给"),
      action({ type: "TAKE_RATION", packetId: "RB6-packet-2" }, "不可现场取用原包"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("steady-grip"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^放稳原瓶并实际恢复常态/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性 · 0储备");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "steady-grip" });
    expect(screen.getByText(originalFailure)).toBeTruthy(); expect(screen.getByText("当前本人身体：本人手掌仍处于承托调整")).toBeTruthy();
  });

  it("does not manufacture CLOSE from historical text or reset body state before a saved close", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "蔷薇主教成长下一步" }).textContent).toContain("查看当前公开结束选项");
    rerender(<RoseBishopPanel roseBishop={{ ...value, insideCase: false, practice: { shape: "NORMAL" } }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "steady-grip");
    expect(screen.getByText(originalFailure)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("当前本人身体：正常身体")).toBeTruthy(); expect(screen.getByRole("heading", { name: "血肉储备 1 / 3" })).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves voluntary teaching refusal and all spent originals after actual CLOSE commits", async () => {
    const refused = "成年学习者拒绝继续本次讲解；未向他喂食，也未消耗灵性或储备。";
    const value = { ...opened(), practice: { shape: "NORMAL" as const }, cases: cases().map((entry) => entry.id === "reserve-lesson" ? { ...entry, status: "OBSERVED", result: refused, contactOpen: "本次讲解尚未实际结束", observations: [originalFailure] } : entry),
      actions: [action({ type: "CLOSE", caseId: "reserve-lesson" }, "尊重拒绝并结束本次讲解", true, "0行动 · 0精神 · 0灵性 · 0储备")] };
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^尊重拒绝并结束本次讲解/ }));
    expect(screen.getByText(refused)).toBeTruthy(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    const closed = { ...value, insideCase: false, actions: [], cases: value.cases.map((entry) => entry.id === "reserve-lesson" ? { ...entry, closes: 1, contactOpen: "本次讲解已实际结束" } : entry) };
    rerender(<RoseBishopPanel roseBishop={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(refused)).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy(); expect(screen.getByText("已实际耗用 · 耗用周：40")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "reserve-lesson" });
  });

  it("buys one sealed animal packet by its public intent without optimistic reserve or packet creation", async () => {
    const buy = action({ type: "BUY_RATION" }, "购买密封动物供给原包", true, "1行动 · 40便士 · 每周最多一次");
    const { onCommand } = panel(bishop({ promoted: true, actions: [buy] }));
    await userEvent.click(screen.getByRole("button", { name: /^购买密封动物供给原包/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BUY_RATION" });
    expect(screen.getByText(buy.cost)).toBeTruthy(); expect(screen.getByText("尚无实际购买的供给原包。")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "血肉储备 0 / 3" })).toBeTruthy();
    expect(screen.getByText(/已购供给包 0 份/).textContent).toContain("尚未购买");
    expect(screen.getByText(/密封非人类动物供给包每周/).textContent).toContain("休养不会补回储备");
  });

  it("consumes the exact held packet only after saving and preserves consumed IDs and weeks", async () => {
    const saved = reserve(); const take = action({ type: "TAKE_RATION", packetId: "RB6-packet-2" }, "取用第二原包", true, "1行动 · 储备+1 · 消耗这一原包");
    const value = bishop({ promoted: true, actions: [take], reserve: saved }); const { onCommand, rerender } = panel(value);
    expect(screen.getByText("供给原包 RB6-packet-1")).toBeTruthy(); expect(screen.getByText("供给原包 RB6-packet-2")).toBeTruthy();
    expect(screen.getByText("取得周：40")).toBeTruthy(); expect(screen.getByText("取得周：41")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^取用第二原包/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "TAKE_RATION", packetId: "RB6-packet-2" });
    expect(screen.getByRole("heading", { name: "血肉储备 1 / 3" })).toBeTruthy(); expect(screen.getByText("实际持有 · 尚未取用")).toBeTruthy();
    rerender(<RoseBishopPanel roseBishop={{ ...value, actions: [], reserve: { ...saved, points: 2, summary: "第二原包已耗用，未直接恢复健康。",
      packets: saved.packets.map((packet) => packet.id === "RB6-packet-2" ? { ...packet, status: "CONSUMED" as const, consumedWeek: 42 } : packet) } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole("heading", { name: "血肉储备 2 / 3" })).toBeTruthy(); expect(screen.getByText("已实际耗用 · 耗用周：42")).toBeTruthy();
    expect(screen.getByText("已实际耗用 · 耗用周：40")).toBeTruthy(); expect(screen.getByText("第二原包已耗用，未直接恢复健康。")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("respects weekly and reserve-cap reasons and rejects stale consumed or absent packet controls", () => {
    const saved = { ...reserve(), points: 3 };
    const weekly = { ...action({ type: "BUY_RATION" }, "本周再购买", false), reason: "本周已购买一包，下周再来。" };
    const capped = { ...action({ type: "TAKE_RATION", packetId: "RB6-packet-2" }, "满储备取用", false), reason: "储备已满3，不能再耗用这一原包。" };
    const { onCommand } = panel(bishop({ promoted: true, reserve: saved, actions: [weekly, capped,
      action({ type: "TAKE_RATION", packetId: "RB6-packet-1" }, "不可重复耗用原包"), action({ type: "TAKE_RATION", packetId: "missing-packet" }, "不存在原包不得取用")] }));
    for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(screen.getByText(weekly.reason)).toBeTruthy(); expect(screen.getByText(capped.reason)).toBeTruthy();
    expect(screen.getByText(/已购供给包 2 份/).textContent).toContain("第41周");
    expect(screen.queryByRole("button", { name: /不存在原包/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks all mutations and selectors while busy, blocked or awaiting save retry, retaining originals", () => {
    const value = bishop({ promoted: true, reserve: reserve(), cases: cases(), actions: [
      action({ type: "BUY_RATION" }, "购买供给原包"), action({ type: "TAKE_RATION", packetId: "RB6-packet-2" }, "取用原包"),
      action({ type: "OBSERVE", caseId: "ring-release" }, "核对原环"), action({ type: "REFLECT" }, "反思本人实践"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<RoseBishopPanel roseBishop={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("供给原包 RB6-packet-2")).toBeTruthy(); expect(screen.getByRole("heading", { name: "血肉储备 1 / 3" })).toBeTruthy();
    }
    rerender(<RoseBishopPanel roseBishop={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps source and boundaries brief and folded, with real healing costs and no higher-sequence controls", () => {
    const story = "仅已核实的本人血肉能力，其余教学与供给为G原创。";
    panel(bishop({ promoted: true, cases: cases(), story, actions: [], abilities: [
      { id: "hanged-man.s6.flesh-shaping", label: "本人有限血肉变化", mastery: 32, description: "只记录实际掌握的本人有限变化。" },
      { id: "hanged-man.s6.self-renewal", label: "自身有限恢复", mastery: 25, description: "实际恢复健康，仍保留原伤势。" },
    ] }));
    expect((screen.getByText(story).closest("details") as HTMLDetailsElement).open).toBe(false);
    const boundary = screen.getByText("查看自愿实践、来源与能力边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["教学只面向自愿成年人", "三项有限实践报告各25", "主攻H", "2灵性、1储备", "自保B", "3灵性、1储备", "保留伤势，不是复活", "序列5放牧"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy(); expect(screen.queryByRole("button", { name: /食人|宿主|放牧|灵魂|复活/ })).toBeNull();
  });

  it("forwards the original non-pursuit encounter choices and displays peaceful digestion100", async () => {
    const actions = [action({ type: "ENCOUNTER_TALK" }, "与维恩交涉"), action({ type: "ENCOUNTER_FIGHT" }, "承担外院冲突")];
    const { onCommand } = panel(bishop({ promoted: true, acting: 100, digestion: "本阶段已消化", environment: "维恩和他自己的短棍仍在原外院。", actions }));
    expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy(); expect(screen.getByText("维恩和他自己的短棍仍在原外院。")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "蔷薇主教扮演进度" }).getAttribute("value")).toBe("100");
    const encounter = within(screen.getByRole("region", { name: "蔷薇主教有限冲突" }));
    expect(encounter.getByText(/维恩持自己的短棍/).textContent).toContain("这里不追击");
    for (const entry of actions) await userEvent.click(encounter.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
  });

  it("retains old Shadow Ascetic stories, shadows, failed results and bottle identities as read-only history", () => {
    const shadowAscetic: ShadowAsceticProjection = {
      title: "隐修士", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原隐修士供给记录保留。", story: "原隐修士故事。", environment: "已从原阴影中显形退出。",
      cases: [{ id: "lamp-shift", title: "原灯光移动", story: "初次阴影检验失败，原消耗仍保留。", status: "RESOLVED", observations: ["原灯与退路已核对。"], preparation: "只在原阴影边界内尝试。", result: "实际显形后提交有限报告。", shadowOpen: "原阴影接触已结束", hidden: false }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "shadow-ascetic-original-1", title: "隐修士旧原瓶", source: "独立隐修士原渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "shadow-ascetic-original-1", confirmed: true } }],
      abilities: [{ id: "hanged-man.s7.shadow-concealment", label: "原阴影藏匿", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<RoseBishopShadowAsceticHistory shadowAscetic={shadowAscetic} />);
    const history = within(screen.getByRole("region", { name: "隐修士时期的经历" }));
    for (const text of ["原隐修士故事。", "原隐修士供给记录保留。", "初次阴影检验失败，原消耗仍保留。", "原灯与退路已核对。", "原案卷ID：lamp-shift", "原瓶ID：shadow-ascetic-original-1",
      "当时的方式与准备：只在原阴影边界内尝试。", "当时的阴影接触：原阴影接触已结束", "当时实际藏匿：已显形或未藏匿", "当时的实际结果与报告：实际显形后提交有限报告。", "来源：独立隐修士原渠道", "已耗用 · 原失败保留", "原阴影藏匿 · 掌握 67：保留原能力实际掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/你已晋升蔷薇主教（序列6）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });
});
