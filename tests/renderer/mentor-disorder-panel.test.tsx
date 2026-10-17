/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MentorDisorderAction, MentorDisorderCommand, MentorDisorderProjection } from "../../src/domain/mentor-disorder/types";
import type { CorruptionBaronProjection } from "../../src/domain/corruption-baron/types";
import { MentorDisorderPanel, MentorDisorderCorruptionBaronHistory } from "../../src/renderer/MentorDisorderPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const emptyPractice: MentorDisorderProjection["practice"] = { markers: "SORTED", route: "READY", note: "BLANK" };
const risk = "意志26：大成功与成功晋升；失败与大失败仍耗原瓶，原排异和污染保留。健康须高于20、精神须高于40；晋升不补满灵性。";
const zeroClose = "0行动 · 0精神 · 0灵性";
const failure = "本次能力判断失败，已经支付的3灵性保留。";
function action(command: MentorDisorderCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): MentorDisorderAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取混乱导师成品用药指导", true, "460便士 · 1行动");
function mentorDisorder(patch: Partial<MentorDisorderProjection> = {}): MentorDisorderProjection {
  return {
    title: "混乱导师晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "腐化男爵扮演100，已度过12/12个完整序列6周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", practice: { ...emptyPractice },
    gifts: { held: 2, given: 4, summary: "原木筹1至4已实际给出，原木筹5与6仍持有。" }, ...patch,
  };
}
function cases(): MentorDisorderProjection["cases"] {
  return [
    { id: "paired-trays", title: "两枚原筹的有限轨迹", story: "米蕾实际启动各自原封边软盘内两枚轻筹，没有复制或转移原物。" },
    { id: "willing-crossing", title: "赛恩同意的一次行走", story: "原成年赛恩同意本次短时净空行走，并可自行停止。" },
    { id: "honest-account", title: "同一原纸的如实记录", story: "伊芙只接收已实际发生的有限记录，失败文字也保留。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): MentorDisorderProjection {
  const originals = [
    { id: "mentor-disorder-potion-1", title: "第一瓶混乱导师魔药", source: "G原渠道第一瓶独立成品，米蕾实际准备", chance: 71 },
    { id: "mentor-disorder-potion-2", title: "第二瓶混乱导师魔药", source: "G原渠道第二瓶独立成品，独立采购记录", chance: 43 },
    { id: "mentor-disorder-potion-3", title: "第三瓶混乱导师魔药", source: "G原渠道第三瓶独立成品，独立封装记录", chance: 61 },
  ];
  return mentorDisorder({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶4800便士或五步劳务后600便士。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function opened(caseId = "paired-trays", patch: Partial<MentorDisorderProjection> = {}): MentorDisorderProjection {
  const practice: MentorDisorderProjection["practice"] = caseId === "paired-trays" ? { ...emptyPractice, markers: "COLLECTED" }
    : caseId === "willing-crossing" ? { ...emptyPractice, route: "MARKED" } : { ...emptyPractice, note: "WRITTEN" };
  return mentorDisorder({ promoted: true, insideCase: true, practice,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", observations: [failure],
      contactOpen: "本次接触尚未实际结束", result: "原物仍在，须实际结束本次实践。" } : entry),
    actions: [action({ type: "CLOSE", caseId }, "实际收回原物并结束本次实践", true, zeroClose)], ...patch,
  });
}
function panel(value: MentorDisorderProjection, onCommand = vi.fn(), currentResources = resources) {
  return { onCommand, ...render(<MentorDisorderPanel mentorDisorder={value} resources={currentResources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("MentorDisorder saved original objects, finite practice and independent bottles", () => {
  it("shows S6 maturity, actual costs and unresolved recipe and ritual without revealing private fields", () => {
    const reason = "腐化男爵扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "米蕾保管三瓶独立成品，本瓶已完成4/5步劳务。";
    const value = { ...mentorDisorder({ digestion: reason, supplies, formula: [{ name: "未核材料不能显示", quantity: 9, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }),
      hiddenIntent: "SECRET_INTENT", nextRoll: "SECRET_ROLL", targetThought: "SECRET_THOUGHT" };
    const { container, onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "混乱导师成长下一步" }).textContent).toContain(reason);
    const boundary = screen.getByText("成品来源、费用与配方边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["腐化男爵消化100", "十二个完整序列6周", "460便士", "4800便士", "5步劳务抵扣4200便士后付600便士", "意志26四档", "仪式细节尚未核实", "不宣称原著无需仪式", "健康须高于20", "精神须高于40", "不补满"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    for (const hidden of ["未核材料不能显示", value.hiddenIntent, value.nextRoll, value.targetThought]) expect(container.textContent).not.toContain(hidden);
    const button = screen.getByRole("button", { name: /^听取混乱导师/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact separate guidance, labour, payment and real resupply actions", async () => {
    const commands: MentorDisorderCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "mentor-disorder-potion-3" },
      { type: "BUY_POTION", bottleId: "mentor-disorder-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取指导", "完成第三瓶劳务", "付款领取第二瓶", "请求后续独立原瓶", "实际接收次周补给"];
    const costs = ["460便士 · 1行动", "1行动 · 劳务5/5 · 抵扣4200便士", "600便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(mentorDisorder({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each selected original without spending and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /^查看并准备服用「第一瓶混乱导师魔药」/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶混乱导师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第一瓶混乱导师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶混乱导师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第三瓶混乱导师魔药」/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("distinguishes same-title bottles and confirms only the current public action once", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "混乱导师成品魔药" }));
    value.bottles[1]!.command = { type: "CONSUME", bottleId: "not-an-offered-action", confirmed: true };
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「混乱导师成品魔药」 · 原瓶 mentor-disorder-potion-2" }));
    expect(screen.getByText("mentor-disorder-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶独立成品，独立采购记录")).toBeTruthy();
    expect(screen.queryByText("mentor-disorder-potion-1")).toBeNull();
    expect(screen.getByRole("region", { name: "混乱导师服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「混乱导师成品魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "mentor-disorder-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains the exact submitted bottle through save failure and external same-operation retry", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶混乱导师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶混乱导师魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<MentorDisorderPanel mentorDisorder={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶混乱导师魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("mentor-disorder-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<MentorDisorderPanel mentorDisorder={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<MentorDisorderPanel mentorDisorder={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶混乱导师魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("refreshes current bottle eligibility before confirmation without caching an enabled intent", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶混乱导师魔药」/ }));
    const reason = "当前健康未高于20，请先休养。";
    const disabled = { ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) };
    rerender(<MentorDisorderPanel mentorDisorder={disabled} resources={{ ...resources, health: 20 }} busy={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶混乱导师魔药」" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); expect(screen.getByText("20 / 100")).toBeTruthy();
    fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps consumed failure history and offers untouched originals after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶混乱导师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶混乱导师魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<MentorDisorderPanel mentorDisorder={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^查看并准备服用「第一瓶混乱导师魔药」/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶混乱导师魔药」/ }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("mentor-disorder-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion and retains all original bottles", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶混乱导师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶混乱导师魔药」" }));
    const promoted = { ...value, title: "混乱导师", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升混乱导师" } : bottle) };
    rerender(<MentorDisorderPanel mentorDisorder={promoted} resources={{ ...resources, maxSpirituality: 100 }} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶混乱导师魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 5")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升混乱导师")).toBeTruthy();
    for (const bottle of promoted.bottles) expect(screen.getByText(`原瓶ID：${bottle.id}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("renders all three scenes and forwards exact projected methods without early results", async () => {
    const commands: MentorDisorderCommand[] = [
      { type: "OBSERVE", caseId: "paired-trays" }, { type: "PREPARE", caseId: "paired-trays", method: "ORDINARY" },
      { type: "PREPARE", caseId: "paired-trays", method: "ABILITY" }, { type: "PERFORM", caseId: "paired-trays" },
      { type: "WITHDRAW", caseId: "paired-trays" }, { type: "REPORT", caseId: "paired-trays" },
    ];
    const labels = ["核对原盘", "准备普通分隔板", "准备有限混乱", "实际执行本次方法", "取消未执行准备", "提交真实报告"];
    const { onCommand } = panel(mentorDisorder({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "混乱导师实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "paired-trays");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前使原筹移动、改变赛恩的行走或写好记录");
    expect(screen.getByText("原红筹 MD5-RED-1 与原蓝筹 MD5-BLUE-1 在各自原色分格内")).toBeTruthy();
  });

  it("keeps no-spirituality ordinary alternatives and shows the disabled ability cost and reason", async () => {
    const ability = { ...action({ type: "PREPARE", caseId: "paired-trays", method: "ABILITY" }, "准备有限混乱", false, "1行动 · 执行需3灵性"), reason: "当前灵性不足3。" };
    const ordinary = action({ type: "PREPARE", caseId: "paired-trays", method: "ORDINARY" }, "准备普通分隔板核对", true, "1行动 · 0灵性");
    const { onCommand } = panel(mentorDisorder({ promoted: true, cases: cases(), actions: [ability, ordinary] }), vi.fn(), { ...resources, spirituality: 0 });
    const button = screen.getByRole("button", { name: /^准备有限混乱/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(screen.getByText(ability.reason)).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBe(`mentorDisorder-reason-${ability.id}`);
    expect(screen.getByText(ability.cost)).toBeTruthy(); expect(screen.getByText(ordinary.cost)).toBeTruthy();
    fireEvent.click(button); await userEvent.click(screen.getByRole("button", { name: /^准备普通分隔板核对/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it("keeps the account ordinary-only and requires the same written original paper to be handed over", async () => {
    const commands: MentorDisorderCommand[] = [{ type: "PREPARE", caseId: "honest-account", method: "ORDINARY" }, { type: "PREPARE", caseId: "honest-account", method: "ABILITY" }];
    const { onCommand, rerender } = panel(mentorDisorder({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, index === 0 ? "准备普通记录" : "不可捏造能力记录")) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "honest-account");
    expect(screen.queryByRole("button", { name: /^不可捏造能力记录/ })).toBeNull();
    expect(screen.getByText(/只提供普通方法：执行1行动、0灵性、知识10/).textContent).toContain("MD5-NOTE-1");
    await userEvent.click(screen.getByRole("button", { name: /^准备普通记录/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[0]);
    rerender(<MentorDisorderPanel mentorDisorder={opened("honest-account")} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("同一原记录纸 MD5-NOTE-1 已写，尚未实际交回")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it.each([
    { caseId: "paired-trays", practice: { ...emptyPractice, markers: "MIXED" } },
    { caseId: "paired-trays", practice: { ...emptyPractice, markers: "COLLECTED" } },
    { caseId: "willing-crossing", practice: { ...emptyPractice, route: "MARKED" } },
    { caseId: "honest-account", practice: { ...emptyPractice, note: "WRITTEN" } },
  ] as { caseId: string; practice: MentorDisorderProjection["practice"] }[])("pins active $caseId to its real zero-cost CLOSE even at zero resources", async ({ caseId, practice }) => {
    const { onCommand, rerender } = panel(mentorDisorder({ promoted: true, cases: cases(), actions: [] }));
    const staleId = caseId === "paired-trays" ? "willing-crossing" : "paired-trays";
    await userEvent.selectOptions(screen.getByRole("combobox"), staleId);
    const value = opened(caseId, { practice });
    rerender(<MentorDisorderPanel mentorDisorder={{ ...value, actions: [
      action({ type: "CLOSE", caseId: staleId }, "旧场景不能结束本次实践", false), ...value.actions,
      action({ type: "REPORT", caseId }, "不可提前报告"), action({ type: "WITHDRAW", caseId }, "不可撤回代替结束"),
      action({ type: "PREPARE", caseId, method: "ORDINARY" }, "不可提前重置原物"), action({ type: "BUY_GIFTS" }, "不可接触中买赠物"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, health: 0, mind: 0, spirituality: 0, actionsRemaining: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际收回原物并结束本次实践/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose); await userEvent.click(close);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId }); expect(screen.getByText(failure)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "混乱导师成长下一步" }).textContent).toContain("先收回原物并结束本次实践");
  });

  it.each([
    { caseId: "paired-trays", field: "markers", before: "MIXED", after: "SORTED", oldText: "两枚原筹仍在各自原封边软盘内，轨迹已经短暂混乱，尚未归格", newText: "原红筹 MD5-RED-1 与原蓝筹 MD5-BLUE-1 在各自原色分格内" },
    { caseId: "paired-trays", field: "markers", before: "COLLECTED", after: "SORTED", oldText: "两枚原筹已实际收停并收集，尚未按原ID归回红、蓝分格", newText: "原红筹 MD5-RED-1 与原蓝筹 MD5-BLUE-1 在各自原色分格内" },
    { caseId: "willing-crossing", field: "route", before: "MARKED", after: "FREE", oldText: "赛恩已自行安全停步，原路线标记 MD5-ROUTE-MARKER 尚未收回", newText: "赛恩已复核原路、普通返回起点，原路线标记已收入原盒，本次许可结束" },
    { caseId: "honest-account", field: "note", before: "WRITTEN", after: "HANDED_OVER", oldText: "同一原记录纸 MD5-NOTE-1 已写，尚未实际交回", newText: "同一原记录纸 MD5-NOTE-1 已实际交回核册员伊芙" },
  ])("keeps $field $before and failure visible until saved actual closure", async ({ caseId, field, before, after, oldText, newText }) => {
    const practice = { ...emptyPractice, [field]: before } as MentorDisorderProjection["practice"];
    const value = opened(caseId, { practice }); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(oldText)).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: /^实际收回原物并结束本次实践/ }));
    expect(screen.getByText(oldText)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy();
    rerender(<MentorDisorderPanel mentorDisorder={{ ...value, insideCase: false, actions: [], practice: { ...practice, [field]: after },
      cases: value.cases.map((entry) => entry.id === caseId ? { ...entry, closes: 1, contactOpen: "已实际结束本次实践" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(newText)).toBeTruthy(); expect(screen.getByText(failure)).toBeTruthy(); expect(screen.getByText(/实际结束次数：1/)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId });
  });

  it.each([
    { ...emptyPractice, markers: "MIXED" }, { ...emptyPractice, markers: "COLLECTED" },
    { ...emptyPractice, route: "MARKED" }, { ...emptyPractice, note: "WRITTEN" },
  ] as MentorDisorderProjection["practice"][])("does not permit other work when an original still needs collection: %j", (practice) => {
    const { onCommand } = panel(mentorDisorder({ promoted: true, insideCase: false, practice, cases: cases(), actions: [
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "REPORT", caseId: "paired-trays" }, "不可提前报告"),
      action({ type: "ENCOUNTER_FIGHT" }, "不可提前战斗"),
    ] }));
    expect(screen.queryByRole("button")).toBeNull(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not manufacture CLOSE, restored objects or permission from historical prose", () => {
    const value = opened("willing-crossing", { actions: [], cases: cases().map((entry) => ({ ...entry, result: "上次已归还原物，本次仍须实际处理。" })) });
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("赛恩已自行安全停步，原路线标记 MD5-ROUTE-MARKER 尚未收回")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows ordinary movement honestly and retains fresh finite consent and actual return", () => {
    const value = opened("willing-crossing");
    value.cases = value.cases.map((entry) => entry.id === "willing-crossing" ? { ...entry, result: "本次普通口头澄清与正常行走，没有施加混乱。" } : entry);
    panel(value);
    expect(screen.getByRole("region", { name: "混乱导师实际结果" }).textContent).toContain("没有施加混乱");
    const scope = screen.getByText(/原成年赛恩只同意本次短时行走/).textContent;
    for (const text of ["可自行停止", "无论成败", "自行安全停步", "普通返回起点", "MD5-ROUTE-MARKER", "结束本次许可"]) expect(scope).toContain(text);
    expect(screen.getByText(/重复试验须重新取得当事人的本次许可/)).toBeTruthy();
  });

  it("locks mutations and selection while busy, blocked or a saved-state error is pending", () => {
    const value = mentorDisorder({ promoted: true, cases: cases(), actions: [
      action({ type: "OBSERVE", caseId: "paired-trays" }, "核对原盘"), action({ type: "BUY_GIFTS" }, "购买原赠物"), action({ type: "REFLECT" }, "反思原报告"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<MentorDisorderPanel mentorDisorder={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("原红筹 MD5-RED-1 与原蓝筹 MD5-BLUE-1 在各自原色分格内")).toBeTruthy();
    }
    rerender(<MentorDisorderPanel mentorDisorder={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders seven inherited mastery records plus disorder and preserves the sequence4 boundary", () => {
    const ids = ["black-emperor.s9.rule-analysis", "black-emperor.s9.persuasive-argument", "black-emperor.s9.weak-point-insight", "black-emperor.s8.enhanced-body", "black-emperor.s8.mental-resistance", "black-emperor.s7.bribery-weakening", "black-emperor.s6.distortion", "black-emperor.s5.disorder"];
    const labels = ["规则分析", "说服", "弱点观察", "增强身体", "有限精神抵抗", "贿赂削弱", "扭曲", "混乱"];
    const abilities = ids.map((id, index) => ({ id, label: labels[index]!, mastery: index + 10, description: `保留第${index + 1}项已知能力实际掌握。` }));
    panel(mentorDisorder({ promoted: true, cases: cases(), actions: [], abilities }));
    expect(screen.getByRole("heading", { name: "能力与消化 · 8 项训练记录" })).toBeTruthy();
    for (const ability of abilities) { expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy(); expect(screen.getByText(ability.description)).toBeTruthy(); }
    const boundary = screen.getByText("查看有限混乱与和平成长边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["本序列只新增混乱", "已有运动", "不瞬移或复制", "不改变所有权", "不取消自由意志", "普通方法", "8点知识池掌握", "序列4赠予、放大、利用尚未开放", "三分钟后自我混乱不是本序列的通用代价"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards original gift, reflection and encounter actions without adding battle choices", async () => {
    const actions = [action({ type: "BUY_GIFTS" }, "购买原木筹"), action({ type: "REFLECT" }, "反思实际报告"),
      action({ type: "ENCOUNTER_TALK" }, "与里斯澄清原场地争议"), action({ type: "ENCOUNTER_FIGHT" }, "承担原外院冲突")];
    const { onCommand } = panel(mentorDisorder({ promoted: true, acting: 100, digestion: "本阶段已消化", actions }));
    expect(screen.getByRole("progressbar", { name: "混乱导师扮演进度" }).getAttribute("value")).toBe("100");
    const encounter = screen.getByRole("region", { name: "混乱导师有限冲突" });
    for (const text of ["原成年里斯", "自己的普通短棍", "2米", "不追击", "真实伤亡风险", "3灵性", "正值普通打击", "落空或空当不消耗", "轮末失效"])
      expect(encounter.textContent).toContain(text);
    for (const entry of actions) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(screen.queryByRole("button", { name: /发动放大|保证混乱成功/ })).toBeNull();
  });

  it("keeps old6 original objects, failures, gifts, mastery and bottles strictly read-only", () => {
    const corruptionBaron: CorruptionBaronProjection = {
      title: "腐化男爵", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原腐化男爵独立成品供给。", story: "原腐化男爵故事。", environment: "原核册与木球现场。",
      practice: { clauseOrder: "RESTORED", marker: "STOPPED", route: "FREE" },
      cases: [{ id: "rolling-marker", title: "同一原木球的旧失败", story: "当时的原木球没有消失。", status: "RESOLVED", observations: ["首次扭曲失败，已付3灵性。"],
        preparation: "当时选了能力方法。", result: "原木球实际收停后才提交报告。", contactOpen: "已结束旧接触", closes: 2 }],
      actions: [{ id: "old-gifts", label: "不可在旧历史中购买赠物", enabled: true, reason: null, cost: "60便士", command: { type: "BUY_GIFTS" } }],
      bottles: [{ id: "corruption-baron-original-1", title: "腐化男爵旧原瓶", source: "原渠道独立成品", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "corruption-baron-original-1", confirmed: true } }],
      abilities: [{ id: "black-emperor.s6.distortion", label: "原扭曲", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
      gifts: { held: 2, given: 4, summary: "旧原木筹1至4已给出，原木筹5和6仍在。" },
    };
    render(<MentorDisorderCorruptionBaronHistory corruptionBaron={corruptionBaron} />);
    const history = within(screen.getByRole("region", { name: "腐化男爵时期的经历" }));
    for (const text of ["原腐化男爵故事。", "原腐化男爵独立成品供给。", "当时的原木球没有消失。", "首次扭曲失败，已付3灵性。", "原案卷ID：rolling-marker", "原瓶ID：corruption-baron-original-1",
      "当时的方式与准备：当时选了能力方法。", "当时的接触：已结束旧接触 · 实际结束次数：2", "当时的实际结果与报告：原木球实际收停后才提交报告。", "来源：原渠道独立成品", "已耗用 · 原失败保留", "原扭曲 · 掌握 67：保留原能力实际掌握。", "旧原木筹1至4已给出，原木筹5和6仍在。", "现仍持有 2 件原赠物 · 已实际给出 4 件", "原核册次序已实际恢复", "同一原木球已实际收停", "原四档风险记录"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/你已晋升混乱导师（序列5）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可在旧历史中购买赠物")).toBeNull();
    for (const details of screen.getByRole("region", { name: "腐化男爵时期的经历" }).querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
