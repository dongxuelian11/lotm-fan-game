/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScrollProfessorAction, ScrollProfessorCommand, ScrollProfessorProjection } from "../../src/domain/scroll-professor/types";
import type { WizardProjection } from "../../src/domain/wizard/types";
import { ScrollProfessorPanel, ScrollProfessorWizardHistory } from "../../src/renderer/ScrollProfessorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留。";
function action(command: ScrollProfessorCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): ScrollProfessorAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取卷轴教授成品用药指导", true, "360便士 · 1行动");
function professor(patch: Partial<ScrollProfessorProjection> = {}): ScrollProfessorProjection {
  return {
    title: "卷轴教授晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "巫师扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    workshop: { summary: "实际材料与卷轴尚未取得。", materials: [], scrolls: [], lessons: [] }, ...patch,
  };
}
function cases(): ScrollProfessorProjection["cases"] {
  return [
    { id: "paper-target", title: "同一纸靶的有限冲力", story: "核对原纸靶与刻录好的冲力卷轴，有限试验后实际退离。" },
    { id: "soft-ward", title: "软冲击与短时护持", story: "只在核对好的软冲击边界内验证这一原护持卷轴。" },
    { id: "willing-reader", title: "自愿参加的成年读者", story: "成年读者自愿参加有限教学，可以拒绝并实际停止。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次现场", closes: 0 }));
}
function bottled(): ScrollProfessorProjection {
  const originals = [
    { id: "scroll-professor-potion-1", title: "第一瓶卷轴教授魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "scroll-professor-potion-2", title: "第二瓶卷轴教授魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "scroll-professor-potion-3", title: "第三瓶卷轴教授魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return professor({ guidanceKnown: true,
    supplies: "原三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
function workshop(): ScrollProfessorProjection["workshop"] {
  return {
    summary: "已购1包，4份原材料中2份已用于实际刻录，保留1次失败。",
    materials: [
      { id: "SP6-material-1", acquiredWeek: 40, status: "SPENT", spentWeek: 40 },
      { id: "SP6-material-2", acquiredWeek: 40, status: "SPENT", spentWeek: 41 },
      { id: "SP6-material-3", acquiredWeek: 40, status: "HELD", spentWeek: null },
      { id: "SP6-material-4", acquiredWeek: 40, status: "HELD", spentWeek: null },
    ],
    lessons: [
      { id: "light-touch", label: "有限牵引", learned: true, description: "原巫师牵引教学记录。" },
      { id: "brief-ward", label: "短时护持", learned: false, description: "尚须实际学习原护持课程。" },
    ],
    scrolls: [
      { id: "SP6-scroll-2", kind: "IMPACT", title: "实际冲力原卷轴", source: "第41周原第二次刻录", materialId: "SP6-material-2", makerSequence: 6, inscriptionMastery: 12, createdWeek: 41, status: "HELD", usedWeek: null, authorized: false },
    ],
  };
}
const firstFailure = "原第一次刻录失败，实际耗用SP6-material-1与2灵性，没有生成卷轴。";
function opened(): ScrollProfessorProjection {
  const saved = workshop();
  saved.summary = "原第三份材料已实际制成护持原卷，随后已在本次软冲击试验耗用。";
  saved.materials[2] = { ...saved.materials[2]!, status: "SPENT", spentWeek: 41 };
  saved.scrolls.push({ ...saved.scrolls[0]!, id: "SP6-scroll-3", kind: "WARD", title: "本次护持原卷轴", materialId: "SP6-material-3", status: "USED", usedWeek: 42 });
  return professor({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "soft-ward" ? { ...entry, status: "EXAMINED", observations: [firstFailure],
      result: "原护持卷轴已经实际耗用，本次有限效果尚未结束。", contactOpen: "本次实践尚未实际结束" } : entry),
    workshop: saved, actions: [action({ type: "CLOSE", caseId: "soft-ward" }, "结束护持检验并实际离场", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: ScrollProfessorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ScrollProfessorPanel scrollProfessor={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Scroll professor originals, actual workshop and explicit authorization", () => {
  it("shows the S7 maturity gate and G prices while hiding an unknown promotion formula", () => {
    const reason = "巫师扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(professor({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "卷轴教授成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "指导只说明有来源的独立成品原瓶，不提供完整晋升配方、材料与剂量；不展示虚构配方，也不开放晋升魔药调配。"])
      expect(summary.textContent).toContain(text);
    expect(screen.getByText(supplies)).toBeTruthy();
    expect(summary.textContent).not.toContain("G指导");
    expect(summary.textContent).not.toContain("材料与剂量尚未核实");
    const button = screen.getByRole("button", { name: /^听取卷轴教授成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, independent labour, payment and actual resupply commands", async () => {
    const commands: ScrollProfessorCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "scroll-professor-potion-3" },
      { type: "BUY_POTION", bottleId: "scroll-professor-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(professor({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels independent original-bottle confirmation at zero AP and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶卷轴教授魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶卷轴教授魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶卷轴教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶卷轴教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶卷轴教授魔药」" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, risk and saved resources and confirms only this original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶卷轴教授魔药」" }));
    expect(screen.getByText("scroll-professor-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "卷轴教授服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶卷轴教授魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "scroll-professor-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted original across save error and delegates same-operation retry outside", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶卷轴教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶卷轴教授魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<ScrollProfessorPanel scrollProfessor={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶卷轴教授魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("scroll-professor-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<ScrollProfessorPanel scrollProfessor={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<ScrollProfessorPanel scrollProfessor={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶卷轴教授魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps failed original history and independently offers untouched originals after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶卷轴教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶卷轴教授魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<ScrollProfessorPanel scrollProfessor={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶卷轴教授魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶卷轴教授魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("scroll-professor-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion and preserves original bottles", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶卷轴教授魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶卷轴教授魔药」" }));
    const promoted = { ...value, title: "卷轴教授", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升卷轴教授" } : bottle) };
    rerender(<ScrollProfessorPanel scrollProfessor={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶卷轴教授魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升卷轴教授")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects three distinct cases and forwards actual methods without optimistic results", async () => {
    const commands: ScrollProfessorCommand[] = [{ type: "OBSERVE", caseId: "paper-target" }, { type: "PREPARE", caseId: "paper-target", method: "ORDINARY" },
      { type: "PREPARE", caseId: "paper-target", method: "ABILITY" }, { type: "PERFORM", caseId: "paper-target" },
      { type: "WITHDRAW", caseId: "paper-target" }, { type: "REPORT", caseId: "paper-target" }];
    const labels = ["核对原纸靶", "准备普通原纸检查", "准备这一原卷轴", "实际使用原件", "撤回待执行准备", "提交本次有限报告"];
    const { onCommand } = panel(professor({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "有限实践与实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "paper-target");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "有限实践与准备" }).textContent).toContain("当前没有待执行的实践");
  });

  it("pins actual open contact to enabled CLOSE at zero AP and hides competing actions", async () => {
    const { onCommand, rerender } = panel(professor({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "willing-reader"); const value = opened();
    rerender(<ScrollProfessorPanel scrollProfessor={{ ...value, actions: [action({ type: "CLOSE", caseId: "paper-target" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "soft-ward" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "soft-ward" }, "不可撤回代替离场"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "BUY_KIT" }, "不可离场前买材料"),
      action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-2", authorized: true }, "不可现场改授权"),
      action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("soft-ward"); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^结束护持检验并实际离场/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "soft-ward" });
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.getByText(/本次实践尚未实际结束/)).toBeTruthy();
  });

  it("never manufactures CLOSE from historical contact text and retains failed material history after close", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "卷轴教授成长下一步" }).textContent).toContain("查看当前公开结束选项");
    rerender(<ScrollProfessorPanel scrollProfessor={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "soft-ward");
    expect(screen.getByText(firstFailure)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(value.workshop.summary)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves voluntary refusal and used originals when actual CLOSE commits", async () => {
    const refused = "米娅本人尚未理解并拒绝继续，未向她施法、赠卷或强制教学。";
    const base = opened();
    const value = { ...base, cases: cases().map((entry) => entry.id === "willing-reader" ? { ...entry, status: "OBSERVED", result: refused, contactOpen: "本次讲解接触尚未实际结束", observations: [firstFailure] } : entry),
      actions: [action({ type: "CLOSE", caseId: "willing-reader" }, "尊重拒绝并实际结束接触", true, "0行动 · 0精神 · 0灵性")] };
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^尊重拒绝并实际结束接触/ }));
    expect(screen.getByText(refused)).toBeTruthy(); expect(screen.getByText("已耗用 · 剩余使用0次 · 未授权自动使用")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(true);
    const closed = { ...value, insideCase: false, actions: [], cases: value.cases.map((entry) => entry.id === "willing-reader" ? { ...entry, closes: 1, contactOpen: "本次讲解接触已实际结束" } : entry) };
    rerender(<ScrollProfessorPanel scrollProfessor={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(refused)).toBeTruthy(); expect(screen.getByText(firstFailure)).toBeTruthy();
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy(); expect(screen.getByText(value.workshop.summary)).toBeTruthy();
    expect(screen.getByText("已耗用 · 剩余使用0次 · 未授权自动使用")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "willing-reader" });
  });

  it("learns only missing inherited spells through exact public lesson commands", async () => {
    const actions = [action({ type: "LEARN_SPELL", spellId: "light-touch" }, "不可重复已学牵引"), action({ type: "LEARN_SPELL", spellId: "brief-ward" }, "补学原短时护持", true, "1行动 · 原巫师课程")];
    const { onCommand } = panel(professor({ promoted: true, workshop: workshop(), actions }));
    const lessons = within(screen.getByRole("region", { name: "继承的巫师法术学习" }));
    expect(lessons.getByText("有限牵引 · 已实际学会")).toBeTruthy(); expect(lessons.getByText("短时护持 · 尚未学会")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /不可重复已学牵引/ })).toBeNull();
    await userEvent.click(lessons.getByRole("button", { name: /^补学原短时护持/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEARN_SPELL", spellId: "brief-ward" });
    expect(lessons.getByText("短时护持 · 尚未学会")).toBeTruthy();
  });

  it("forwards paid kit and selected craft kind without inventing a successful original", async () => {
    const actions = [action({ type: "BUY_KIT" }, "购买四份G教学材料", true, "100便士 · 1行动 · 每周一次"),
      action({ type: "CRAFT_SCROLL", kind: "IMPACT" }, "刻录有限冲力", true, "1行动 · 2灵性 · 1份实际材料 · 知识14"),
      action({ type: "CRAFT_SCROLL", kind: "WARD" }, "刻录短时护持", true, "1行动 · 2灵性 · 1份实际材料 · 知识14")];
    const value = professor({ promoted: true, actions }); const { onCommand } = panel(value);
    const group = within(screen.getByRole("group", { name: "材料购买与卷轴刻录" }));
    expect(group.getAllByRole("button")).toHaveLength(2);
    await userEvent.click(group.getByRole("button", { name: /^购买四份/ }));
    for (const entry of actions.slice(1)) {
      await userEvent.selectOptions(group.getByRole("combobox"), entry.id);
      await userEvent.click(group.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
    expect(screen.getByText("尚无刻录成功的卷轴原件。准备与失败不会生成成品。")).toBeTruthy();
    expect(screen.getByText("尚无实际购买的材料原份。")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "这瓶卷轴教授魔药的服用确认" })).toBeNull();
  });

  it("shows original material IDs, source kind, frozen inscription and held or used status", () => {
    const saved = workshop();
    saved.materials[2] = { ...saved.materials[2]!, status: "SPENT", spentWeek: 41 };
    saved.scrolls.push({ ...saved.scrolls[0]!, id: "SP6-scroll-3", kind: "WARD", title: "已耗用护持原卷轴", materialId: "SP6-material-3", status: "USED", usedWeek: 42 });
    panel(professor({ promoted: true, workshop: saved, actions: [] }));
    for (const material of saved.materials) expect(screen.getAllByText(new RegExp(`材料ID：${material.id}`)).length).toBeGreaterThan(0);
    for (const scroll of saved.scrolls) {
      expect(screen.getByText(scroll.title)).toBeTruthy(); expect(screen.getByText(new RegExp(`原卷轴ID：${scroll.id}`))).toBeTruthy();
    }
    expect(screen.getAllByText("来源：第41周原第二次刻录")).toHaveLength(2);
    expect(screen.getAllByText("制作周：41 · 制作者序列：6 · 刻录时掌握：12")).toHaveLength(2);
    expect(screen.getByText("实际持有 · 可使用一次 · 未授权自动使用")).toBeTruthy();
    expect(screen.getByText("已耗用 · 剩余使用0次 · 未授权自动使用")).toBeTruthy();
    expect(screen.getByText("耗用周：42")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps default authorization off until saved and forwards exact original authorization and revocation", async () => {
    const saved = workshop(); const allow = action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-2", authorized: true }, "授权这一原卷轴供战斗使用", true, "0行动 · 匹配时使用一次");
    const value = professor({ promoted: true, workshop: saved, actions: [allow] }); const { onCommand, rerender } = panel(value);
    expect(screen.getByText("实际持有 · 可使用一次 · 未授权自动使用")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^授权这一原卷轴供战斗使用/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(allow.command);
    expect(screen.getByText("实际持有 · 可使用一次 · 未授权自动使用")).toBeTruthy();
    const revoke = action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-2", authorized: false }, "撤销这一原卷轴战前授权");
    rerender(<ScrollProfessorPanel scrollProfessor={{ ...value, actions: [revoke], workshop: { ...saved, scrolls: saved.scrolls.map((scroll) => ({ ...scroll, authorized: true })) } }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("实际持有 · 可使用一次 · 已授权匹配战斗槽")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^撤销这一原卷轴/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([allow.command, revoke.command]);
  });

  it("disables authorization for a used original even with stale enabled public action", () => {
    const saved = workshop(); saved.scrolls[0] = { ...saved.scrolls[0]!, status: "USED", usedWeek: 42 };
    const { onCommand } = panel(professor({ promoted: true, workshop: saved, actions: [action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-2", authorized: true }, "授权已用原件")] }));
    const button = screen.getByRole("button", { name: /^授权已用原件/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText("这一原件已经耗用，不能再次授权、恢复次数或重用。")).toBeTruthy();
  });

  it("does not invent authorization actions for absent or unprojected originals", () => {
    const { onCommand } = panel(professor({ promoted: true, workshop: workshop(), actions: [action({ type: "AUTHORIZE_SCROLL", scrollId: "missing-original", authorized: true }, "不存在原件的授权")] }));
    expect(screen.getByText("实际持有 · 可使用一次 · 未授权自动使用")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("locks all mutations and selectors on busy, external block or failed save without hiding originals", () => {
    const value = professor({ promoted: true, workshop: workshop(), cases: cases(), actions: [
      action({ type: "CRAFT_SCROLL", kind: "IMPACT" }, "刻录原冲力"), action({ type: "BUY_KIT" }, "购买原材料"),
      action({ type: "AUTHORIZE_SCROLL", scrollId: "SP6-scroll-2", authorized: true }, "授权原件"), action({ type: "LEARN_SPELL", spellId: "brief-ward" }, "补学护持"),
      action({ type: "OBSERVE", caseId: "paper-target" }, "核对纸靶"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<ScrollProfessorPanel scrollProfessor={value} resources={resources} onCommand={onCommand} {...props} />);
      for (const selector of screen.getAllByRole("combobox")) expect((selector as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("实际冲力原卷轴")).toBeTruthy();
    }
    rerender(<ScrollProfessorPanel scrollProfessor={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps story and source text folded and explains bounded G usage without free R crafting", () => {
    const story = "长期原故事与来源说明。";
    panel(professor({ title: "卷轴教授", promoted: true, workshop: workshop(), cases: cases(), story, actions: [] }));
    expect((screen.getByText(story).closest("details") as HTMLDetailsElement).open).toBe(false);
    expect((screen.getByText(cases()[0]!.story).closest("details") as HTMLDetailsElement).open).toBe(false);
    expect((screen.getByText("来源：第41周原第二次刻录").closest("details") as HTMLDetailsElement).open).toBe(false);
    for (const text of ["匹配主攻H或自保B", "预备R不会凭空制作新卷轴", "三项有限实践报告各25", "序列5星象师与序列4神秘学家"])
      expect(screen.getByText(new RegExp(text)).textContent).toContain(text);
    const stageBoundary = screen.getByText("三项有限实践报告各25扮演进度，反思25，可和平完成本阶段。本页不授予序列5星象师与序列4神秘学家的能力。");
    expect(stageBoundary.closest("details")?.getAttribute("aria-label")).toBe("卷轴教授能力边界");
    expect(stageBoundary.textContent).not.toContain("能力尚未开放");
    expect(screen.queryByRole("button", { name: /免费|星象|神秘再现/ })).toBeNull();
  });

  it("forwards only actual encounter commands and displays peaceful full digestion", async () => {
    const actions = [action({ type: "ENCOUNTER_TALK" }, "与现场人交涉"), action({ type: "ENCOUNTER_FIGHT" }, "承担现场冲突")];
    const { onCommand } = panel(professor({ promoted: true, acting: 100, digestion: "本阶段已消化", environment: "原现场人与原物状态保留。", actions }));
    expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy(); expect(screen.getByText("原现场人与原物状态保留。")).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限现场冲突" }));
    for (const entry of actions) await userEvent.click(encounter.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
  });

  it("keeps all previous Wizard stories, lessons, failures, effects and original bottles read-only at S6", () => {
    const wizard: WizardProjection = {
      title: "巫师", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原巫师供给记录保留。", story: "原巫师故事。", environment: "原法术效果已实际结束。",
      cases: [{ id: "paper-marker", title: "原纸标记", story: "首次牵引失败，原消耗仍保留。", status: "RESOLVED", observations: ["原标记已核对。"], preparation: "只对同一纸标记施术。", result: "重新验证后结束效果并报告。", effectOpen: "原效果已结束" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "wizard-original-1", title: "巫师旧原瓶", source: "独立巫师原渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "wizard-original-1", confirmed: true } }],
      lessons: [{ id: "light-touch", label: "原有限牵引", learned: true, description: "原课程真实掌握。" }, { id: "brief-ward", label: "原短时护持", learned: false, description: "原课程尚未学会。" }],
      abilities: [{ id: "hermit.s7.spellcraft", label: "原巫师法术", mastery: 67, description: "保留原法术实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<ScrollProfessorWizardHistory wizard={wizard} />);
    const history = within(screen.getByRole("region", { name: "巫师时期的经历" }));
    for (const text of ["原巫师故事。", "原巫师供给记录保留。", "首次牵引失败，原消耗仍保留。", "原标记已核对。", "原案卷ID：paper-marker", "原瓶ID：wizard-original-1",
      "当时的方式与准备：只对同一纸标记施术。", "当时的法术效果：原效果已结束", "当时的实际练习与报告：重新验证后结束效果并报告。", "来源：独立巫师原渠道", "已耗用 · 原失败保留",
      "原有限牵引 · 已实际学会", "原短时护持 · 尚未学会", "原法术ID：light-touch", "原巫师法术 · 掌握 67：保留原法术实际掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/你已晋升卷轴教授（序列6）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
  });
});
