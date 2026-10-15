/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DruidAction, DruidCommand, DruidProjection, DruidStudySourceId } from "../../src/domain/druid/types";
import type { BiologistProjection } from "../../src/domain/biologist/types";
import { DruidBiologistHistory, DruidPanel } from "../../src/renderer/DruidPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 3, maxSpirituality: 100, cash: "2镑 3苏勒 4便士", actionsRemaining: 0 };
const risk = "意志26：大成功与成功可晋升；失败和大失败耗原瓶，排异、污染与原成本保留。";
function action(command: DruidCommand, label = "执行公开行动", enabled = true, cost = "本次公开成本"): DruidAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取德鲁伊指导", true, "1行动 · 460便士");
function druid(patch: Partial<DruidProjection> = {}): DruidProjection {
  return { title: "德鲁伊晋升", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [],
    supplies: "", actions: [learn], studies: [],
    ritual: { notebook: "原笔记 DR5-NOTEBOOK-1", recordStatus: "尚未写成总记录。", readyStatus: "尚未准备本瓶仪式。", attempts: 0, summary: "原学习与笔记持续保留。" },
    bottles: [], abilities: [], acting: 0, digestion: "生物学家消化100，已度过12/12个完整序列6周。", pollution: 3, risk,
    cases: [], insideCase: false, environment: "",
    practice: { position: "NEAR", soil: "SETTLED", marker: "BOX", seedlings: "RESTING", note: "BLANK", returnAttempted: false }, ...patch };
}
function studies(): DruidProjection["studies"] {
  const originals: { id: DruidStudySourceId; title: string; creatures: string[] }[] = [
    { id: "ordinary-animals", title: "普通动物原教学册", creatures: ["犬", "猫", "鼠"] },
    { id: "lava-octopus", title: "拉瓦章鱼原教学册", creatures: ["拉瓦章鱼"] },
    { id: "grey-goat", title: "灰山羊原教学册", creatures: ["成年霍纳奇斯灰山羊"] },
    { id: "six-winged-gargoyle", title: "六翼石像鬼原教学册", creatures: ["六翼石像鬼"] },
  ];
  return originals.map((entry) => ({ ...entry, source: `伊芙原柜的G教学记录 ${entry.id}`, completed: false,
    status: "尚未实际阅读与记录。", action: action({ type: "STUDY", sourceId: entry.id }, `实际学习${entry.title}`, true, "1行动 · 0灵性 · 知识14") }));
}
function cases(): DruidProjection["cases"] {
  return [
    { id: "known-soil", title: "已知壤土的真实去回", story: "原1米普通土段，两端都有已知干燥出口。" },
    { id: "paired-growth", title: "两株原苗的普通观察", story: "同一对原苗留在原植床，只作普通有限比较。" },
    { id: "honest-record", title: "如实记录并实际交回", story: "同一张原记录纸写下已知与未知，再实际交妥。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): DruidProjection {
  const originals = [
    { id: "druid-potion-1", title: "第一瓶德鲁伊魔药", source: "G原渠道第一瓶，独立采购", chance: 61 },
    { id: "druid-potion-2", title: "第二瓶德鲁伊魔药", source: "G原渠道第二瓶，另次采购", chance: 43 },
    { id: "druid-potion-3", title: "第三瓶德鲁伊魔药", source: "G原渠道第三瓶，独立封装", chance: 71 },
  ];
  return druid({ guidanceKnown: true, supplies: "每瓶4800便士，或五步劳务后600便士，三瓶独立供给。",
    ritual: { ...druid().ritual, recordStatus: "四项学习与总记录均已实际完成。", readyStatus: "第58周本瓶准备已保存。", attempts: 1 },
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 消耗这一原瓶与本次准备")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })) });
}
const zero = "0行动 · 0精神 · 0灵性";
const originalFailure = "原判定失败，已付灵性保留，身体与原标记仍在远端。";
function far(): DruidProjection {
  return druid({ promoted: true, insideCase: true, actions: [
    action({ type: "RETURN", caseId: "known-soil", method: "ABILITY" }, "付费地下返程", true, "0行动 · 3灵性 · 独立知识14判定"),
    action({ type: "RETURN", caseId: "known-soil", method: "ORDINARY" }, "沿原普通短路返回", true, zero),
    { ...action({ type: "CLOSE", caseId: "known-soil" }, "收好原标记并结束", false, zero), reason: "身体仍在远端，须先实际返回近端。" },
  ], cases: cases().map((entry) => entry.id === "known-soil" ? { ...entry, status: "EXAMINED", observations: ["原土段已实际核对。"],
    result: "本次去程身体与同一原标记已到远端，土段恢复稳定。", contactOpen: "本次实践尚未实际结束" } : entry),
    practice: { ...druid().practice, position: "FAR", marker: "FAR" } });
}
function panel(value: DruidProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DruidPanel druid={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Druid actual studies, physical return and saved public intents", () => {
  it("separates the known ritual portion from unknown formula and preserves S6 maturity and prices", () => {
    const reason = "生物学家消化100，但仅完成11/12个完整周。";
    const { onCommand } = panel(druid({ digestion: reason, formula: [{ name: "PRIVATE_UNVERIFIED_FORMULA", quantity: 9, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "德鲁伊成长下一步" });
    for (const text of [reason, "指导460便士", "每瓶4800便士", "5步劳务抵扣4200便士后付600便士", "意志26", "多种普通动物与三种超凡生物", "亲笔写出", "其余完整仪式步骤尚未掌握"])
      expect(summary.textContent).toContain(text);
    expect(summary.textContent).toContain("晋升准备要求积累多种普通动物与三种超凡生物的习性、身体构造知识，并亲笔写出知识和经历。完整配方、材料剂量与其余完整仪式步骤尚未掌握；独立成品不能代替这些实际学习与记录。");
    const disabled = screen.getByRole("button", { name: /^听取德鲁伊指导/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); fireEvent.click(disabled);
    expect(document.body.textContent).not.toContain("PRIVATE_UNVERIFIED_FORMULA");
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders four distinct original study sources once and submits exact source IDs without completing locally", async () => {
    const entries = studies(); const value = druid({ studies: entries, actions: entries.map((entry) => entry.action) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    for (const entry of entries) {
      const region = within(screen.getByRole("article", { name: `${entry.title}学习记录` }));
      expect(region.getByText(`资料来源：${entry.source}`)).toBeTruthy();
      expect(region.getByText(`本册对象：${entry.creatures.join("、")}`)).toBeTruthy();
      await userEvent.click(region.getByRole("button", { name: new RegExp(`^${entry.action.label}`) }));
      expect(region.getByText("已保存的学习结果：本项尚未完成")).toBeTruthy();
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(entries.map((entry) => entry.action.command));
    expect(screen.queryByText("已保存的学习结果：本项已完成")).toBeNull();
  });

  it("retains failed notes and cross-week study restriction until the saved projection changes", async () => {
    const entries = studies(); const first = entries[0]!;
    entries[0] = { ...first, status: "本周失败，小记保留；下一真实周才可重读。", action: { ...first.action, enabled: false, reason: "本周已实际学习，等下一真实周。" } };
    const value = druid({ studies: entries, actions: [] }); const { onCommand, rerender } = panel(value);
    const disabled = screen.getByRole("button", { name: /^实际学习普通动物原教学册/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true); expect(disabled.getAttribute("aria-describedby")).toBe(`druid-reason-${first.action.id}`);
    fireEvent.click(disabled); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText(entries[0].status)).toBeTruthy();
    const completed = entries.map((entry, index) => index === 0 ? { ...entry, completed: true, status: "已实际完成并归还原页。", action: { ...entry.action, enabled: false, reason: "本项已完成，无须重复。" } } : entry);
    rerender(<DruidPanel druid={{ ...value, studies: completed }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已保存的学习结果：本项已完成")).toBeTruthy(); expect(screen.getByText("已实际完成并归还原页。")).toBeTruthy();
  });

  it("requires separate public write and paid prepare commands while retaining the original notebook", async () => {
    const write = action({ type: "WRITE_RECORD" }, "亲笔写成四册总记录", true, "1行动 · 0灵性 · 知识12");
    const prepare = { ...action({ type: "PREPARE_RITE" }, "核对原笔记并准备本瓶仪式", false, "1行动 · 90便士"), reason: "须先实际写成总记录。" };
    const value = druid({ studies: studies().map((entry) => ({ ...entry, completed: true, action: { ...entry.action, enabled: false } })), actions: [write, prepare] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^亲笔写成四册总记录/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WRITE_RECORD" });
    expect(screen.getByText("尚未写成总记录。")).toBeTruthy(); expect(screen.getByText("实际准备次数：0")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^核对原笔记并准备本瓶仪式/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<DruidPanel druid={{ ...value, ritual: { ...value.ritual, recordStatus: "总记录已实际写成。" }, actions: [{ ...prepare, enabled: true, reason: null }] }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^核对原笔记并准备本瓶仪式/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "PREPARE_RITE" });
    expect(screen.getByText("原笔记 DR5-NOTEBOOK-1")).toBeTruthy(); expect(screen.getByText("尚未准备本瓶仪式。")).toBeTruthy();
    expect(screen.getByText("实际准备次数：0")).toBeTruthy();
  });

  it("forwards exact independent guidance, labour, payment and resupply intents", async () => {
    const commands: DruidCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "druid-potion-2" },
      { type: "BUY_POTION", bottleId: "druid-potion-2" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听指导", "完成第二原瓶劳务", "支付第二原瓶余款", "申请下一批成品", "领取实际到货"];
    const { onCommand } = panel(druid({ actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
  });

  it("cancels original bottle confirmation at zero AP and restores focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /^查看并准备服用「第一瓶德鲁伊魔药」/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶德鲁伊魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第一瓶德鲁伊魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶德鲁伊魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^查看并准备服用「第三瓶德鲁伊魔药」/ })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("confirms only the selected original with current risk, preparation and resources", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第二瓶德鲁伊魔药」/ }));
    expect(screen.getByText("druid-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶，另次采购")).toBeTruthy();
    expect(screen.getByRole("region", { name: "本瓶实际仪式准备" }).textContent).toContain("第58周本瓶准备已保存。");
    expect(screen.getByRole("region", { name: "本瓶实际仪式准备" }).textContent).toContain("下瓶都须重新付费准备");
    expect(screen.getByRole("region", { name: "德鲁伊服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "3 / 100", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const button = screen.getByRole("button", { name: "确认服用「第二瓶德鲁伊魔药」" }); fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "druid-potion-2", confirmed: true });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses stable bottle IDs even when all bottles have the same title", async () => {
    const value = bottled(); value.bottles = value.bottles.map((bottle) => ({ ...bottle, title: "德鲁伊成品魔药" }));
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「德鲁伊成品魔药」 · 原瓶 druid-potion-3" }));
    expect(screen.getByText("druid-potion-3")).toBeTruthy(); expect(screen.queryByText("druid-potion-1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「德鲁伊成品魔药」" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "druid-potion-3", confirmed: true });
  });

  it("keeps the same original confirmation through failed save and defers same-operation retry to the owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶德鲁伊魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶德鲁伊魔药」" }));
    const error = { message: "本次服药未保存，重试同一操作。", retryable: true };
    rerender(<DruidPanel druid={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect(screen.getByRole("status").textContent).toContain("上次已保存");
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶德鲁伊魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("druid-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<DruidPanel druid={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<DruidPanel druid={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶德鲁伊魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("preserves failed original history and requires a newly projected paid preparation before the next bottle", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第一瓶德鲁伊魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶德鲁伊魔药」" }));
    const prepare = action({ type: "PREPARE_RITE" }, "重新准备下一瓶仪式", true, "1行动 · 90便士");
    const failed = { ...value, ritual: { ...value.ritual, readyStatus: "本次准备已随服药耗用，须重新准备。" },
      actions: [prepare, ...value.actions.slice(1).map((entry) => ({ ...entry, enabled: false, reason: "须重新准备本瓶仪式。" }))],
      bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "原第一瓶已耗用 · 原失败保留" } : bottle) };
    rerender(<DruidPanel druid={failed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶德鲁伊魔药的服用确认" })).toBeNull();
    expect(screen.getByText("原第一瓶已耗用 · 原失败保留")).toBeTruthy();
    expect(screen.getByText("四项学习与总记录均已实际完成。")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^查看并准备服用「第二瓶德鲁伊魔药」/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^重新准备下一瓶仪式/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "PREPARE_RITE" });
    expect(screen.getByText("本次准备已随服药耗用，须重新准备。")).toBeTruthy();
  });

  it("ends confirmation only after saved promotion and preserves original bottle statuses", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^查看并准备服用「第三瓶德鲁伊魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶德鲁伊魔药」" }));
    const promoted = { ...value, promoted: true, title: "德鲁伊", actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升德鲁伊" } : bottle) };
    rerender(<DruidPanel druid={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶德鲁伊魔药的服用确认" })).toBeNull(); expect(screen.getByText("序列 5")).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升德鲁伊")).toBeTruthy(); expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("forwards prepared practice intents without moving body or marker before saved results", async () => {
    const commands: DruidCommand[] = [{ type: "OBSERVE", caseId: "known-soil" }, { type: "PREPARE", caseId: "known-soil", method: "ORDINARY" },
      { type: "PREPARE", caseId: "known-soil", method: "ABILITY" }, { type: "PERFORM", caseId: "known-soil" },
      { type: "WITHDRAW", caseId: "known-soil" }, { type: "REPORT", caseId: "known-soil" }];
    const labels = ["观察原土段", "准备原普通路线", "准备地下去程", "实际走完去程", "撤回本次准备", "提交实际报告"];
    const { onCommand } = panel(druid({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByText("身体位置：近端（NEAR）")).toBeTruthy(); expect(screen.getByText("原标记 DR5-MARKER-1：原收纳盒（BOX）")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "德鲁伊实际结果" })).toBeNull();
  });

  it("pins the actual FAR scene to separately priced return and disabled close, hiding stale unrelated actions", async () => {
    const { onCommand, rerender } = panel(druid({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "honest-record");
    const value = far();
    rerender(<DruidPanel druid={{ ...value, actions: [action({ type: "CLOSE", caseId: "honest-record" }, "旧实践无效结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "known-soil" }, "不能提前报告"), action({ type: "WITHDRAW", caseId: "known-soil" }, "不能撤回代替返回"),
      action({ type: "REFLECT" }, "不能提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不能提前战斗")] }} resources={resources} busy={false} onCommand={onCommand} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement; expect(select.value).toBe("known-soil"); expect(select.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    const ability = screen.getByRole("button", { name: /^付费地下返程/ }); expect(ability.textContent).toContain("3灵性");
    const close = screen.getByRole("button", { name: /^收好原标记并结束/ }) as HTMLButtonElement; expect(close.disabled).toBe(true); fireEvent.click(close);
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(ability); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", caseId: "known-soil", method: "ABILITY" });
    expect(screen.getByText("身体位置：远端（FAR）")).toBeTruthy(); expect(screen.getByText("原标记 DR5-MARKER-1：远端（FAR）")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际身体、原标记与原物" }).textContent).toContain("能力往返合计6灵性");
  });

  it("keeps original ordinary return usable after a paid failed ability return at zero resources", async () => {
    const initial = far(); const value = { ...initial, practice: { ...initial.practice, returnAttempted: true },
      cases: initial.cases.map((entry) => entry.id === "known-soil" ? { ...entry, result: originalFailure } : entry),
      actions: initial.actions.map((entry) => entry.command.type === "RETURN" && entry.command.method === "ABILITY"
        ? { ...entry, enabled: false, reason: "本次能力返程已尝试，原普通退路仍可使用。" } : entry) };
    const onCommand = vi.fn(); render(<DruidPanel druid={value} resources={{ ...resources, spirituality: 0, mind: 0, actionsRemaining: 0 }} busy={false} onCommand={onCommand} />);
    const ability = screen.getByRole("button", { name: /^付费地下返程/ }) as HTMLButtonElement; expect(ability.disabled).toBe(true); fireEvent.click(ability);
    const ordinary = screen.getByRole("button", { name: /^沿原普通短路返回/ }) as HTMLButtonElement; expect(ordinary.disabled).toBe(false); expect(ordinary.textContent).toContain(zero);
    await userEvent.click(ordinary); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN", caseId: "known-soil", method: "ORDINARY" });
    expect(screen.getByText(originalFailure)).toBeTruthy(); expect(screen.getByText("身体位置：远端（FAR）")).toBeTruthy();
  });

  it("requires saved physical return before zero-cost CLOSE and saved close before marker is boxed", async () => {
    const value = far(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^沿原普通短路返回/ }));
    expect(screen.getByText("身体位置：远端（FAR）")).toBeTruthy();
    const returned = { ...value, practice: { ...value.practice, position: "NEAR" as const, marker: "NEAR" as const },
      actions: [action({ type: "CLOSE", caseId: "known-soil" }, "收好原标记并结束", true, zero)] };
    rerender(<DruidPanel druid={returned} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("身体位置：近端（NEAR）")).toBeTruthy(); expect(screen.getByText("原标记 DR5-MARKER-1：近端（NEAR）")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /^收好原标记并结束/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CLOSE", caseId: "known-soil" }); expect(screen.getByText("原标记 DR5-MARKER-1：近端（NEAR）")).toBeTruthy();
    rerender(<DruidPanel druid={{ ...returned, insideCase: false, practice: { ...returned.practice, marker: "BOX" }, actions: [] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("原标记 DR5-MARKER-1：原收纳盒（BOX）")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it.each(["paired-growth", "honest-record"])("uses only ordinary projected methods for %s and requires actual close", async (caseId) => {
    const ordinary = action({ type: "PREPARE", caseId, method: "ORDINARY" }, "准备本次普通观察记录", true, "1行动 · 0灵性");
    const value = druid({ promoted: true, cases: cases(), actions: [ordinary] }); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^准备本次普通观察记录/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(screen.queryByRole("button", { name: /能力|变形|催生/ })).toBeNull();
    const practice = { ...value.practice, seedlings: "OBSERVED" as const, note: "WRITTEN" as const };
    rerender(<DruidPanel druid={{ ...value, insideCase: true, practice, actions: [action({ type: "CLOSE", caseId }, "实际收妥原物并结束", true, zero)] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("两株原苗 DR5-SEEDLING-A/B：已实际观察，仍在各自原植床")).toBeTruthy();
    expect(screen.getByText("原记录纸 DR5-LIFE-NOTE-1：已实际写下，尚未交回")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际收妥原物并结束/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CLOSE", caseId });
    expect(screen.getByText("原记录纸 DR5-LIFE-NOTE-1：已实际写下，尚未交回")).toBeTruthy();
  });

  it("never manufactures release commands or treats old result prose as physical state", () => {
    const value = { ...far(), actions: [], privatePlan: "PRIVATE_NEVER_RENDER", future: "FUTURE_NEVER_RENDER",
      cases: cases().map((entry) => ({ ...entry, result: "旧文字说已经返回；本次以实际位置为准。" })) };
    const { onCommand } = panel(value); expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("身体位置：远端（FAR）")).toBeTruthy(); expect(screen.getByText("原标记 DR5-MARKER-1：远端（FAR）")).toBeTruthy();
    expect(screen.getByRole("region", { name: "德鲁伊成长下一步" }).textContent).toContain("查看当前公开的返程与结束选项");
    for (const text of [value.privatePlan, value.future]) expect(document.body.textContent).not.toContain(text); expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks projected studies, preparation and releases during pending saves or errors without changing facts", () => {
    const value = far(); const { onCommand, rerender } = panel(value);
    for (const state of [value, druid({ studies: studies(), actions: [action({ type: "WRITE_RECORD" }, "写总记录"), action({ type: "PREPARE_RITE" }, "准备仪式")] })]) {
      for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
        rerender(<DruidPanel druid={state} resources={resources} onCommand={onCommand} {...props} />);
        for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
        const select = screen.queryByRole("combobox"); if (select) expect((select as HTMLSelectElement).disabled).toBe(true);
      }
    }
    rerender(<DruidPanel druid={value} resources={resources} busy={false} error={{ message: "请重载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
    expect(screen.getByText("身体位置：远端（FAR）")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows inherited mastery and only finite verified ground-passage boundaries", async () => {
    const abilities = Array.from({ length: 10 }, (_, index) => ({ id: index === 9 ? "mother.s5.ground-passage" : `original-${index}`, label: `原能力${index + 1}`, mastery: index, description: "实际保存的掌握。" }));
    const encounter = [action({ type: "ENCOUNTER_TALK" }, "与马伦交涉"), action({ type: "ENCOUNTER_FIGHT" }, "承担园边冲突")];
    const { onCommand } = panel(druid({ promoted: true, acting: 100, abilities, actions: encounter }));
    expect(screen.getByRole("heading", { name: "能力与消化 · 10 项训练记录" })).toBeTruthy();
    for (const ability of abilities) expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    const boundary = screen.getByText("查看地下潜行、普通实践与使用范围").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["继承原九项能力", "具体距离、速度和消耗", "当前仅限已知1米土段与两端安全出口", "每次实践只可尝试一次", "普通退路返回", "两案不开放能力方法", "本阶段不提供具体动物变形形态", "序列4赋予造物灵魂", "不更改旧死亡记录"])
      expect(boundary.textContent).toContain(text);
    expect(boundary.textContent).toContain("本阶段新增地下潜行一项掌握，继承原九项能力与实际掌握。地下潜行可在通过后恢复软化的地面；具体距离、速度和消耗以当前场地说明为准。当前仅限已知1米土段与两端安全出口，费用与成长按本页说明结算。");
    expect(screen.queryByRole("button", { name: /变形|熊|鹰|龙|赋魂|催生/ })).toBeNull();
    const conflict = within(screen.getByRole("region", { name: "德鲁伊有限冲突" }));
    for (const entry of encounter) await userEvent.click(conflict.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(encounter.map((entry) => entry.command));
  });

  it("retains S6 failures, original water, verification, actual returns and independent bottles as read-only history", () => {
    const history: BiologistProjection = { title: "生物学家", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原三瓶生物学家独立供给。", story: "原生物学家故事。", environment: "同一温室，实际归还原苗。",
      actions: [{ id: "old-perform", label: "不可重做旧试验", cost: "原成本", enabled: true, reason: null, command: { type: "PERFORM", caseId: "paired-seedling" } }],
      cases: [{ id: "paired-seedling", title: "原同苗试验", story: "原苗仍归伊芙。", observations: ["原失败耗水保留。"], status: "RESOLVED",
        preparation: "实际取用原库存水。", result: "曾失败耗水，后真实复核并归还，没有新增粮食。", contactOpen: "已实际结束", closes: 2 }],
      bottles: [{ id: "biologist-original-1", title: "生物学家旧原瓶", source: "独立原批成品", status: "已耗用 · 原失败保留", chance: 0,
        command: { type: "CONSUME", bottleId: "biologist-original-1", confirmed: true } }],
      abilities: [{ id: "mother.s6.specimen-study", label: "原样本研究", mastery: 28, description: "保留原实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原风险", insideCase: false,
      practice: { sampleRecorded: true, warningsRecorded: true }, trial: { careWeek: 40, verifiedWeek: 41, waterUsed: 2, status: "RETURNED", location: "OWNER" },
      water: { held: 0, used: 4, summary: "原水实用4份，剩余0份，无新库存。" } };
    render(<DruidBiologistHistory biologist={history} />);
    const region = screen.getByRole("region", { name: "生物学家时期的经历" }); const content = within(region);
    for (const text of [history.story!, history.environment, history.supplies, history.water.summary, "原案卷ID：paired-seedling", "当时实际结束次数：2",
      "当时的实际结果与报告：曾失败耗水，后真实复核并归还，没有新增粮食。", "原瓶ID：biologist-original-1", "来源：独立原批成品", "已耗用 · 原失败保留",
      "原实际复核：第41周", "原苗位置：已当面交回原主伊芙", "生物学家阶段实际用水：2份", "原样本研究 · 掌握 28：保留原实际掌握。"])
      expect(content.getByText(text)).toBeTruthy();
    expect(content.queryByRole("button")).toBeNull(); expect(content.queryByRole("combobox")).toBeNull(); expect(content.queryByText("不可重做旧试验")).toBeNull();
    for (const details of region.querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
