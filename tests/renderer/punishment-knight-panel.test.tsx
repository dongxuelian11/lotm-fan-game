/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PunishmentKnightAction, PunishmentKnightCommand, PunishmentKnightProjection } from "../../src/domain/punishment-knight/types";
import type { JudgeProjection } from "../../src/domain/judge/types";
import { PunishmentKnightPanel, PunishmentKnightJudgeHistory } from "../../src/renderer/PunishmentKnightPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const emptyPractice: PunishmentKnightProjection["practice"] = { pad: "STAND", partner: "FREE", rule: "NONE", note: "BLANK" };
const risk = "意志26：大成功与成功晋升；失败与大失败仍耗原瓶，原排异和污染保留。健康须高于20、精神须高于40；晋升不补满灵性。";
const zeroClose = "0行动 · 0精神 · 0灵性";
const failure = "本次能力判断失败，已经支付的3灵性保留。";
function action(command: PunishmentKnightCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): PunishmentKnightAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取惩戒骑士成品用药指导", true, "460便士 · 1行动");
function punishmentKnight(patch: Partial<PunishmentKnightProjection> = {}): PunishmentKnightProjection {
  return {
    title: "惩戒骑士晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "法官扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: { ...emptyPractice },
    ...patch,
  };
}
function cases(): PunishmentKnightProjection["cases"] {
  return [
    { id: "breach-and-pad", title: "实际越线与同一原软靶", story: "阿伦自愿先越过原线，玩家只对同一原软靶作有限实践。" },
    { id: "willing-pause", title: "阿伦同意的一次停步", story: "原成年阿伦同意本次短时停步，并约定停止口令。" },
    { id: "wound-record", title: "同一原纸的伤势记录", story: "薇娜只接收实际观察到的伤势或未见伤势的记录。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): PunishmentKnightProjection {
  const originals = [
    { id: "punishment-knight-potion-1", title: "第一瓶惩戒骑士魔药", source: "G原渠道第一瓶独立成品，薇娜实际准备", chance: 71 },
    { id: "punishment-knight-potion-2", title: "第二瓶惩戒骑士魔药", source: "G原渠道第二瓶独立成品，独立采购记录", chance: 43 },
    { id: "punishment-knight-potion-3", title: "第三瓶惩戒骑士魔药", source: "G原渠道第三瓶独立成品，独立封装记录", chance: 61 },
  ];
  return punishmentKnight({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶4800便士或五步劳务后600便士。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function opened(caseId = "breach-and-pad", patch: Partial<PunishmentKnightProjection> = {}): PunishmentKnightProjection {
  const practice: PunishmentKnightProjection["practice"] = caseId === "breach-and-pad" ? { ...emptyPractice, pad: "MAT", rule: "BREACHED" }
    : caseId === "willing-pause" ? { ...emptyPractice, partner: "HELD" } : { ...emptyPractice, note: "WRITTEN" };
  return punishmentKnight({ promoted: true, insideCase: true, practice,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", observations: [failure],
      contactOpen: "本次接触尚未实际结束", result: "原物仍在，须实际结束本次实践。" } : entry),
    actions: [action({ type: "CLOSE", caseId }, "实际收束并结束本次实践", true, zeroClose)], ...patch,
  });
}
function panel(value: PunishmentKnightProjection, onCommand = vi.fn(), currentResources = resources) {
  return { onCommand, ...render(<PunishmentKnightPanel punishmentKnight={value} resources={currentResources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("PunishmentKnight saved original objects, finite practice and independent bottles", () => {
  it("shows S6 maturity, actual costs and unresolved recipe and ritual without revealing private fields", () => {
    const reason = "法官扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "薇娜保管三瓶独立成品，本瓶已完成4/5步劳务。";
    const value = { ...punishmentKnight({ digestion: reason, supplies, formula: [{ name: "未核材料不能显示", quantity: 9, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }),
      hiddenIntent: "SECRET_INTENT", nextRoll: "SECRET_ROLL", targetThought: "SECRET_THOUGHT" };
    const { container, onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "惩戒骑士成长下一步" }).textContent).toContain(reason);
    const boundary = screen.getByText("成品来源、费用与配方边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["法官消化100", "十二个完整序列6周", "460便士", "4800便士", "5步劳务抵扣4200便士后付600便士", "意志26四档", "仪式细节尚未掌握", "服药前仍须完成准备", "健康须高于20", "精神须高于40", "不补满"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    for (const hidden of ["未核材料不能显示", value.hiddenIntent, value.nextRoll, value.targetThought]) expect(container.textContent).not.toContain(hidden);
    const button = screen.getByRole("button", { name: /^听取惩戒骑士/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact separate guidance, labour, payment and real resupply actions", async () => {
    const commands: PunishmentKnightCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "punishment-knight-potion-3" },
      { type: "BUY_POTION", bottleId: "punishment-knight-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取指导", "完成第三瓶劳务", "付款领取第二瓶", "请求后续独立原瓶", "实际接收次周补给"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(punishmentKnight({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each selected original without spending and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /^查看并准备服用「第一瓶惩戒骑士魔药」/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶惩戒骑士魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第一瓶惩戒骑士魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶惩戒骑士魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第三瓶惩戒骑士魔药」/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("distinguishes same-title bottles and confirms only the current public action once", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "惩戒骑士成品魔药" }));
    value.bottles[1]!.command = { type: "CONSUME", bottleId: "not-an-offered-action", confirmed: true };
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「惩戒骑士成品魔药」 · 原瓶 punishment-knight-potion-2" }));
    expect(screen.getByText("punishment-knight-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶独立成品，独立采购记录")).toBeTruthy();
    expect(screen.queryByText("punishment-knight-potion-1")).toBeNull();
    expect(screen.getByRole("region", { name: "惩戒骑士服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「惩戒骑士成品魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "punishment-knight-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains the exact submitted bottle through save failure and external same-operation retry", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶惩戒骑士魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶惩戒骑士魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<PunishmentKnightPanel punishmentKnight={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶惩戒骑士魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("punishment-knight-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<PunishmentKnightPanel punishmentKnight={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<PunishmentKnightPanel punishmentKnight={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶惩戒骑士魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("refreshes current bottle eligibility before confirmation without caching an enabled intent", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶惩戒骑士魔药」/ }));
    const reason = "当前健康未高于20，请先休养。";
    const disabled = { ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<PunishmentKnightPanel punishmentKnight={disabled} resources={{ ...resources, health: 20 }} busy={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶惩戒骑士魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); expect(screen.getByText("20 / 100")).toBeTruthy();
    fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps consumed failure history and offers untouched originals after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶惩戒骑士魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶惩戒骑士魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<PunishmentKnightPanel punishmentKnight={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^查看并准备服用「第一瓶惩戒骑士魔药」/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶惩戒骑士魔药」/ }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("punishment-knight-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion and retains all original bottles", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶惩戒骑士魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶惩戒骑士魔药」" }));
    const promoted = { ...value, title: "惩戒骑士", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升惩戒骑士" } : bottle) };
    rerender(<PunishmentKnightPanel punishmentKnight={promoted} resources={{ ...resources, maxSpirituality: 100 }} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶惩戒骑士魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 5")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升惩戒骑士")).toBeTruthy();
    for (const bottle of promoted.bottles) expect(screen.getByText(`原瓶ID：${bottle.id}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders all three scenes and forwards exact methods without optimistic results", async () => {
    const commands: PunishmentKnightCommand[] = [
      { type: "OBSERVE", caseId: "breach-and-pad" }, { type: "PREPARE", caseId: "breach-and-pad", method: "ORDINARY" },
      { type: "PREPARE", caseId: "breach-and-pad", method: "ABILITY" }, { type: "PERFORM", caseId: "breach-and-pad" },
      { type: "WITHDRAW", caseId: "breach-and-pad" }, { type: "REPORT", caseId: "breach-and-pad" },
    ];
    const labels = ["核对原线与原靶", "准备普通软靶测试", "准备有限惩戒", "实际执行本次方法", "取消未执行准备", "提交真实报告"];
    const { onCommand } = panel(punishmentKnight({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "惩戒骑士实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "breach-and-pad");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前认定越线、击落原软靶、禁锢阿伦或写好记录");
    expect(screen.getByText("同一原软靶 PK5-SOFT-PAD-1 在原架上")).toBeTruthy();
  });

  it("keeps zero-spirituality ordinary alternatives and the projected ability reason", async () => {
    const ability = { ...action({ type: "PREPARE", caseId: "breach-and-pad", method: "ABILITY" }, "准备有限惩戒", false, "1行动 · 执行需3灵性"), reason: "当前灵性不足3。" };
    const ordinary = action({ type: "PREPARE", caseId: "breach-and-pad", method: "ORDINARY" }, "准备普通软靶测试", true, "1行动 · 0灵性");
    const { onCommand } = panel(punishmentKnight({ promoted: true, cases: cases(), actions: [ability, ordinary] }), vi.fn(), { ...resources, spirituality: 0 });
    const button = screen.getByRole("button", { name: /^准备有限惩戒/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(screen.getByText(ability.reason)).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBe(`punishmentKnight-reason-${ability.id}`);
    expect(screen.getByText(ability.cost)).toBeTruthy(); expect(screen.getByText(ordinary.cost)).toBeTruthy();
    fireEvent.click(button); await userEvent.click(screen.getByRole("button", { name: /^准备普通软靶测试/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it("requires actual voluntary crossing before safe-object punishment without official authority", () => {
    panel(punishmentKnight({ promoted: true, cases: cases(), actions: [] }));
    const scope = screen.getByText(/先说明约定，再由阿伦自愿实际越过原标线/).textContent;
    for (const text of ["PK5-LINE-1", "薇娜当场观察", "不是仅凭计划、指控或宣告", "不是绝对屏障", "阿伦保留自己的选择", "PK5-SOFT-PAD-1", "绝不击打阿伦", "失败仍付费", "没有神秘宣告或惩戒", "范围与数值以当前说明为准", "实际将原软靶归架、收回原标线", "不制造真人伤势"])
      expect(scope).toContain(text);
    for (const text of ["执行1行动、3灵性、知识14", "知识12", "0灵性"]) expect(scope).toContain(text);
    expect(scope).not.toContain("G原创");
    const saved = screen.getByRole("region", { name: "已保存的原软靶、阿伦、原标线与原纸状态" });
    for (const text of ["调解处安全练习室", "民间调解文书员", "成年递件员", "晋升不授予官方身份", "训练宣告变成法律或定罪"]) expect(saved.textContent).toContain(text);
  });

  it("keeps wound recording ordinary-only without requiring a battle or manufacturing wounds", async () => {
    const commands: PunishmentKnightCommand[] = [{ type: "PREPARE", caseId: "wound-record", method: "ORDINARY" }, { type: "PREPARE", caseId: "wound-record", method: "ABILITY" }];
    const { onCommand, rerender } = panel(punishmentKnight({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, index === 0 ? "准备普通伤势记录" : "不可捏造能力记录")) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "wound-record");
    expect(screen.queryByRole("button", { name: /^不可捏造能力记录/ })).toBeNull();
    const scope = screen.getByText(/只提供普通方法：执行1行动、0灵性、知识10/).textContent;
    for (const text of ["PK5-NOTE-1", "先前实际记录的伤势", "未观察到伤势", "不需要先战斗", "不推断隐藏伤口", "不为训练制造伤势", "不算伤势裁决能力实践", "实际交回薇娜·贝尔"]) expect(scope).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通伤势记录/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[0]);
    rerender(<PunishmentKnightPanel punishmentKnight={opened("wound-record")} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原记录纸 PK5-NOTE-1 已写，尚未实际交回")).toBeTruthy(); expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it.each([
    { caseId: "breach-and-pad", practice: { ...emptyPractice, pad: "MAT", rule: "BREACHED" } },
    { caseId: "breach-and-pad", practice: { ...emptyPractice, rule: "BREACHED" } },
    { caseId: "breach-and-pad", practice: { ...emptyPractice, pad: "MAT" } },
    { caseId: "willing-pause", practice: { ...emptyPractice, partner: "HELD" } },
    { caseId: "willing-pause", practice: { ...emptyPractice } },
    { caseId: "wound-record", practice: { ...emptyPractice, note: "WRITTEN" } },
  ] as { caseId: string; practice: PunishmentKnightProjection["practice"] }[])("pins active $caseId to its actual zero-cost CLOSE even after failed or ordinary execution", async ({ caseId, practice }) => {
    const { onCommand, rerender } = panel(punishmentKnight({ promoted: true, cases: cases(), actions: [] }));
    const staleId = caseId === "breach-and-pad" ? "willing-pause" : "breach-and-pad";
    await userEvent.selectOptions(screen.getByRole("combobox"), staleId);
    const value = opened(caseId, { practice });
    rerender(<PunishmentKnightPanel punishmentKnight={{ ...value, actions: [
      action({ type: "CLOSE", caseId: staleId }, "旧场景不能结束本次实践", false), ...value.actions,
      action({ type: "REPORT", caseId }, "不可提前报告"), action({ type: "WITHDRAW", caseId }, "不可撤回代替结束"),
      action({ type: "PREPARE", caseId, method: "ORDINARY" }, "不可提前重置原物"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0, actionsRemaining: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际收束并结束本次实践/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId }); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "惩戒骑士成长下一步" }).textContent).toContain("先实际收束本次实践");
  });

  it.each([
    { caseId: "breach-and-pad", before: { ...emptyPractice, pad: "MAT", rule: "BREACHED" }, after: { ...emptyPractice }, oldText: "同一原软靶 PK5-SOFT-PAD-1 已实际落在原软垫上，尚未归架", newText: "同一原软靶 PK5-SOFT-PAD-1 在原架上" },
    { caseId: "breach-and-pad", before: { ...emptyPractice, rule: "BREACHED" }, after: { ...emptyPractice }, oldText: "阿伦已先实际越过原标线 PK5-LINE-1，本次宣告尚须结束并收回原线", newText: "当前没有生效的训练宣告；原标线是否已收回，以本次实际结束记录为准" },
    { caseId: "willing-pause", before: { ...emptyPractice, partner: "HELD" }, after: { ...emptyPractice }, oldText: "原成年阿伦正处于本次自愿短时停步，尚须实际解除并返回", newText: "原成年阿伦可自由行动，没有尚在生效的禁锢" },
    { caseId: "wound-record", before: { ...emptyPractice, note: "WRITTEN" }, after: { ...emptyPractice, note: "HANDED_OVER" }, oldText: "同一原记录纸 PK5-NOTE-1 已写，尚未实际交回", newText: "同一原记录纸 PK5-NOTE-1 已实际交回薇娜·贝尔" },
  ] as { caseId: string; before: PunishmentKnightProjection["practice"]; after: PunishmentKnightProjection["practice"]; oldText: string; newText: string }[])("keeps original $caseId effects and failure until saved actual closure", async ({ caseId, before, after, oldText, newText }) => {
    const value = opened(caseId, { practice: before }); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(oldText)).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: /^实际收束并结束本次实践/ }));
    expect(screen.getByText(oldText)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    rerender(<PunishmentKnightPanel punishmentKnight={{ ...value, insideCase: false, actions: [], practice: after,
      cases: value.cases.map((entry) => entry.id === caseId ? { ...entry, closes: 1, contactOpen: "已实际结束本次实践", result: "原软靶与原标线、阿伦或同一原纸已按本次方法实际收束，既有失败保留。" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(newText)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy(); expect(screen.getByText(/实际结束次数：1/)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId });
  });

  it.each([
    { ...emptyPractice, pad: "MAT" }, { ...emptyPractice, partner: "HELD" },
    { ...emptyPractice, rule: "DECLARED" }, { ...emptyPractice, rule: "BREACHED" }, { ...emptyPractice, note: "WRITTEN" },
  ] as PunishmentKnightProjection["practice"][])("prevents other work while a saved original still requires cleanup: %j", (practice) => {
    const { onCommand } = panel(punishmentKnight({ promoted: true, insideCase: false, practice, cases: cases(), actions: [
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "REPORT", caseId: "breach-and-pad" }, "不可提前报告"),
      action({ type: "ENCOUNTER_FIGHT" }, "不可提前战斗"),
    ] }));
    expect(screen.queryByRole("button")).toBeNull(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not manufacture CLOSE or a free partner from historical prose", () => {
    const value = opened("willing-pause", { actions: [], cases: cases().map((entry) => ({ ...entry, result: "上次已解除禁锢，本次仍须实际处理。" })) });
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("原成年阿伦正处于本次自愿短时停步，尚须实际解除并返回")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps ordinary voluntary pauses distinct from confinement and preserves fresh consent", () => {
    const value = opened("willing-pause", { practice: { ...emptyPractice } });
    value.cases = value.cases.map((entry) => entry.id === "willing-pause" ? { ...entry, result: "本次普通口头停步，没有施加禁锢。" } : entry);
    panel(value);
    expect(screen.getByRole("region", { name: "惩戒骑士实际结果" }).textContent).toContain("没有施加禁锢");
    const scope = screen.getByText(/原成年阿伦只同意本次短时停步/).textContent;
    for (const text of ["停止口令", "可要求立即结束", "可能失败", "不算禁锢成功", "实际解除影响", "原净空短路正常返回", "可自由离开", "不是永久许可"]) expect(scope).toContain(text);
    expect(screen.getByText(/重复试验须重新取得当事人的本次许可/)).toBeTruthy();
  });

  it("locks mutations and selection while busy, blocked or a save error is pending", () => {
    const value = punishmentKnight({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "breach-and-pad" }, "核对原靶"), action({ type: "REFLECT" }, "反思原报告")] });
    const { onCommand, rerender } = panel(value);
    for (const flags of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: "保存失败" }, { busy: false, error: { message: "无法恢复", retryable: false } }]) {
      rerender(<PunishmentKnightPanel punishmentKnight={value} resources={resources} onCommand={onCommand} {...flags} />);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    }
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows every projected mastery including zero new abilities without promising awards", () => {
    const abilities = [
      { id: "justiciar.s9.combat", label: "原格斗", mastery: 67, description: "继承原掌握。" },
      { id: "justiciar.s6.prohibition", label: "原禁令", mastery: 14, description: "保留原法官禁令掌握。" },
      { id: "justiciar.s5.punishment", label: "惩戒", mastery: 0, description: "有限惩戒。" },
      { id: "justiciar.s5.confinement", label: "禁锢", mastery: 0, description: "有限禁锢。" },
      { id: "justiciar.s5.wound-verdict", label: "伤势裁决", mastery: 0, description: "须有实际目标伤势。" },
    ];
    panel(punishmentKnight({ promoted: true, cases: cases(), actions: [], abilities }));
    expect(screen.getByRole("heading", { name: "能力与消化 · 5 项训练记录" })).toBeTruthy();
    for (const ability of abilities) { expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy(); expect(screen.getByText(ability.description)).toBeTruthy(); }
    const boundary = screen.getByText("查看惩戒、禁锢与伤势裁决边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["独立掌握", "实际触发依据", "不是自动定罪", "不取消自由意志", "当前目标实际记录的既存伤势", "普通伤势记录不会获得伤势裁决掌握", "8点知识池掌握", "不保证新能力增长", "本阶段不提供序列4律令法师的能力剥夺"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards reflection and encounter intents while explaining real wound and round-local limits", async () => {
    const actions = [action({ type: "REFLECT" }, "反思实际报告"), action({ type: "ENCOUNTER_TALK" }, "与迪恩澄清争议"), action({ type: "ENCOUNTER_FIGHT" }, "承担原外院冲突")];
    const { onCommand } = panel(punishmentKnight({ promoted: true, acting: 100, digestion: "本阶段已消化", actions }));
    expect(screen.getByRole("progressbar", { name: "惩戒骑士扮演进度" }).getAttribute("value")).toBe("100");
    const encounter = screen.getByRole("region", { name: "惩戒骑士有限冲突" });
    for (const text of ["原成年迪恩", "自己的普通短棍", "2米", "不追击", "真实伤亡风险", "敌我双方", "一次实际抵抗判定", "正值打击", "后续惩戒另需3灵性", "轮末失效", "目标仍存活且已有实际记录伤势", "回退普通动作", "不是“一句话必死”", "不凭玩家自身伤势"]) expect(encounter.textContent).toContain(text);
    for (const entry of actions) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(screen.queryByRole("button", { name: /剥夺能力|一言处死/ })).toBeNull();
  });

  it("keeps original Judge trials, failures, tests, mastery and independent bottles read-only", () => {
    const judge: JudgeProjection = {
      title: "法官", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原法官独立成品供给。", story: "原法官故事。", environment: "原标线与木牌现场。",
      practice: { audience: "FREE", boundary: "RELEASED", token: "RETURNED", lineTestedBy: "BOTH", tokenTestedBy: "BOTH" },
      cases: [{ id: "shared-token", title: "同一原木牌的旧失败", story: "当时双方均实际尝试带出原木牌。", status: "RESOLVED", observations: ["首次禁令失败，已付3灵性。"],
        preparation: "当时选了能力方法。", result: "同一原木牌实际归台后才提交报告。", contactOpen: "已结束旧接触", closes: 2 }],
      actions: [{ id: "old-perform", label: "不可在旧历史重做带牌", enabled: true, reason: null, cost: "1行动", command: { type: "PERFORM", caseId: "shared-token" } }],
      bottles: [{ id: "judge-original-1", title: "法官旧原瓶", source: "原渠道独立成品", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "judge-original-1", confirmed: true } }],
      abilities: [{ id: "justiciar.s6.prohibition", label: "原禁令", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<PunishmentKnightJudgeHistory judge={judge} />);
    const history = within(screen.getByRole("region", { name: "法官时期的经历" }));
    for (const text of ["原法官故事。", "原法官独立成品供给。", "当时双方均实际尝试带出原木牌。", "首次禁令失败，已付3灵性。", "原案卷ID：shared-token", "原瓶ID：judge-original-1",
      "当时的方式与准备：当时选了能力方法。", "当时的接触：已结束旧接触 · 实际结束次数：2", "当时的实际结果与报告：同一原木牌实际归台后才提交报告。", "来源：原渠道独立成品", "已耗用 · 原失败保留", "原禁令 · 掌握 67：保留原能力实际掌握。", "原标线限制已实际撤回，双方可自由跨越", "同一原木牌已实际放回原台，本次限制已撤回", "原四档风险记录"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getAllByText("玩家与当事人双方均已实际尝试")).toHaveLength(2);
    expect(history.getByText(/你已晋升惩戒骑士（序列5）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可在旧历史重做带牌")).toBeNull();
    for (const details of screen.getByRole("region", { name: "法官时期的经历" }).querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
