/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalamityPriestAction, CalamityPriestCommand, CalamityPriestProjection } from "../../src/domain/calamity-priest/types";
import type { LuckyProjection } from "../../src/domain/lucky/types";
import { CalamityPriestPanel, CalamityPriestLuckyHistory } from "../../src/renderer/CalamityPriestPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可休养后另取独立成品重试。";
function action(command: CalamityPriestCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): CalamityPriestAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取灾祸教士成品用药指导", true, "360便士 · 1行动");
function calamityPriest(patch: Partial<CalamityPriestProjection> = {}): CalamityPriestProjection {
  return {
    title: "灾祸教士晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "幸运者扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "",
    practice: { hazard: "UNASSESSED", board: "RESTING", contact: "NONE" }, ...patch,
  };
}
function cases(): CalamityPriestProjection["cases"] {
  return [
    { id: "rain-rack", title: "雨棚原架的有限风险", story: "有限预感后仍要看清原架、原箱与安全退路。" },
    { id: "isolated-board", title: "隔离区的同一原板", story: "物主已授权，隔离区已清空；只处理同一原板、原支架和承接盘。" },
    { id: "willing-focus", title: "佩林自愿的短暂精神实践", story: "现存成年人佩林已同意短暂轻微的G原创精神实践，本人可要求停止。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): CalamityPriestProjection {
  const originals = [
    { id: "calamity-priest-potion-1", title: "第一瓶灾祸教士魔药", source: "G原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "calamity-priest-potion-2", title: "第二瓶灾祸教士魔药", source: "G原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "calamity-priest-potion-3", title: "第三瓶灾祸教士魔药", source: "G原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return calamityPriest({ guidanceKnown: true, supplies: "三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle) => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const originalFailure = "原判断失败，已经支付的灵性与本次风险保留。";
const zeroClose = "0行动 · 0精神 · 0灵性";
function opened(caseId = "isolated-board", practice: CalamityPriestProjection["practice"] = { hazard: "UNASSESSED", board: "FALLEN", contact: "NONE" }): CalamityPriestProjection {
  return calamityPriest({ promoted: true, insideCase: true, practice,
    cases: cases().map((entry) => entry.id === caseId ? { ...entry, status: "EXAMINED", observations: [originalFailure],
      result: "本次实际结果已记录，现场仍需实际收束。", contactOpen: "本次接触尚未实际结束" } : entry),
    actions: [action({ type: "CLOSE", caseId }, "实际收束当前原现场", true, zeroClose)],
  });
}
function panel(value: CalamityPriestProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<CalamityPriestPanel calamityPriest={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("CalamityPriest public practice and saved original intent", () => {
  it("shows S7 maturity, G prices and recoverable four-tier risk without inventing a formula", () => {
    const reason = "幸运者扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const { onCommand } = panel(calamityPriest({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] }));
    const summary = screen.getByRole("region", { name: "灾祸教士成长下一步" });
    for (const text of [reason, "指导360便士", "每瓶3320便士", "5步劳务抵扣3000便士后付320便士", "意志24四档", "不提供完整晋升配方、材料与剂量"])
      expect(summary.textContent).toContain(text);
    expect(within(summary).getByText("当前渠道只提供有来源的独立成品，不提供完整晋升配方、材料与剂量；不展示虚构材料，也不开放晋升魔药调配。")).toBeTruthy();
    expect(summary.textContent).not.toContain("尚未核实");
    expect(screen.getByText(supplies)).toBeTruthy(); expect(screen.getByText(risk)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取灾祸教士成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|调配|跳过成熟/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact guidance, separate labour/payment and actual resupply commands", async () => {
    const commands: CalamityPriestCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "calamity-priest-potion-3" },
      { type: "BUY_POTION", bottleId: "calamity-priest-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(calamityPriest({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
  });

  it("cancels each original confirmation at zero AP and restores keyboard focus", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: "查看并准备服用「第一瓶灾祸教士魔药」" }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶灾祸教士魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶灾祸教士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶灾祸教士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶灾祸教士魔药」" })); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the selected source, risk, saved resources and confirms only that original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶灾祸教士魔药」" }));
    expect(screen.getByText("calamity-priest-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：G原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "灾祸教士服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶灾祸教士魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "calamity-priest-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted bottle through save error and leaves same-operation retry outside", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶灾祸教士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶灾祸教士魔药」" }));
    const error = { message: "本次服药尚未保存，须重试同一操作ID。", retryable: true };
    rerender(<CalamityPriestPanel calamityPriest={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶灾祸教士魔药」" })); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("calamity-priest-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<CalamityPriestPanel calamityPriest={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<CalamityPriestPanel calamityPriest={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶灾祸教士魔药」" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps failed original history and offers only untouched bottles after committed failure", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶灾祸教士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶灾祸教士魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<CalamityPriestPanel calamityPriest={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶灾祸教士魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶灾祸教士魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("calamity-priest-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only after saved promotion while retaining each original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶灾祸教士魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶灾祸教士魔药」" }));
    const promoted = { ...value, title: "灾祸教士", promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升灾祸教士" } : bottle) };
    rerender(<CalamityPriestPanel calamityPriest={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶灾祸教士魔药的服用确认" })).toBeNull();
    expect(screen.getByText("序列 6")).toBeTruthy(); expect(screen.getByText("原瓶已耗用 · 已晋升灾祸教士")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects three original scenes and forwards exact public methods without optimistic results", async () => {
    const commands: CalamityPriestCommand[] = [{ type: "OBSERVE", caseId: "rain-rack" },
      { type: "PREPARE", caseId: "rain-rack", method: "ORDINARY" }, { type: "PREPARE", caseId: "rain-rack", method: "ABILITY" },
      { type: "PERFORM", caseId: "rain-rack" }, { type: "WITHDRAW", caseId: "rain-rack" }, { type: "REPORT", caseId: "rain-rack" }];
    const labels = ["核对原架", "准备普通观察", "准备有限预感", "实际观察一次", "撤回本次准备", "提交有限报告"];
    const { onCommand } = panel(calamityPriest({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), entry.id);
      expect(screen.getByText(entry.story)).toBeTruthy(); expect(screen.queryByRole("region", { name: "灾祸教士实际结果" })).toBeNull();
    }
    await userEvent.selectOptions(screen.getByRole("combobox"), "rain-rack");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "本次方法与准备" }).textContent).toContain("选择方法不会提前获得预感、使原板落下或开始精神接触");
    expect(screen.getByText("当前雨棚风险：尚未完成本次风险核查")).toBeTruthy();
    expect(screen.getByText("当前原板：同一原板仍在原支架上")).toBeTruthy();
    expect(screen.getByText("当前精神接触：尚未开始本次接触")).toBeTruthy();
  });

  it("keeps paid ability practice distinct from an ordinary zero-spirituality option", async () => {
    const paid = action({ type: "PERFORM", caseId: "rain-rack" }, "实际施用有限预感并核查", true, "1行动 · 3灵性");
    const ordinary = action({ type: "PREPARE", caseId: "rain-rack", method: "ORDINARY" }, "改用普通安全观察", true, "1行动 · 0灵性");
    const { onCommand } = panel(calamityPriest({ promoted: true, cases: cases(), actions: [paid, ordinary] }));
    expect(screen.getByText(paid.cost)).toBeTruthy(); expect(screen.getByText(ordinary.cost)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际施用有限预感并核查/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(paid.command);
    expect(screen.queryByRole("region", { name: "灾祸教士实际结果" })).toBeNull();
    expect(screen.getByText("当前雨棚风险：尚未完成本次风险核查")).toBeTruthy();
  });

  it.each([
    { caseId: "rain-rack", practice: { hazard: "NOTICED", board: "RESTING", contact: "NONE" } },
    { caseId: "isolated-board", practice: { hazard: "UNASSESSED", board: "FALLEN", contact: "NONE" } },
    { caseId: "willing-focus", practice: { hazard: "UNASSESSED", board: "SECURED", contact: "FOCUSED" } },
  ] as { caseId: string; practice: CalamityPriestProjection["practice"] }[])("pins the actual $caseId scene to projected zero-cost CLOSE with no resources", async ({ caseId, practice }) => {
    const { onCommand, rerender } = panel(calamityPriest({ promoted: true, cases: cases(), actions: [] }));
    const staleId = caseId === "rain-rack" ? "isolated-board" : "rain-rack";
    await userEvent.selectOptions(screen.getByRole("combobox"), staleId);
    const value = opened(caseId, practice);
    rerender(<CalamityPriestPanel calamityPriest={{ ...value, actions: [
      action({ type: "CLOSE", caseId: staleId }, "旧现场不能结束", false), ...value.actions,
      action({ type: "REPORT", caseId }, "不可提前报告"), action({ type: "WITHDRAW", caseId }, "不可撤回代替实际结束"),
      action({ type: "PREPARE", caseId, method: "ORDINARY" }, "不可提前重置原物"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_FIGHT" }, "不可提前赴冲突"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe(caseId); expect(selector.disabled).toBe(true); expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际收束当前原现场/ }) as HTMLButtonElement;
    expect(close.disabled).toBe(false); expect(close.textContent).toContain(zeroClose);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId });
    expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
  });

  it("retains the real rain-rack risk until saved CLOSE secures the original objects", async () => {
    const value = opened("rain-rack", { hazard: "NOTICED", board: "RESTING", contact: "NONE" });
    const { onCommand, rerender } = panel(value);
    const current = "当前雨棚风险：已留意本次风险，尚未实际收束";
    expect(screen.getByText(current)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际收束当前原现场/ }));
    expect(screen.getByText(current)).toBeTruthy();
    rerender(<CalamityPriestPanel calamityPriest={{ ...value, insideCase: false, practice: { ...value.practice, hazard: "SECURED" }, actions: [],
      cases: value.cases.map((entry) => entry.id === "rain-rack" ? { ...entry, closes: 1, contactOpen: "已实际移开原箱并固定原支架" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前雨棚风险：已实际退出并做好本次风险收束")).toBeTruthy();
    expect(screen.getByText(/已实际移开原箱并固定原支架/)).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
  });

  it.each(["UNSTABLE", "FALLEN"] as const)("retains a %s original board and the failure until saved physical securing", async (board) => {
    const value = opened("isolated-board", { hazard: "UNASSESSED", board, contact: "NONE" });
    const { onCommand, rerender } = panel(value);
    const current = board === "FALLEN" ? "当前原板：同一原板已落下，尚未固定" : "当前原板：同一原板不稳，尚未固定";
    expect(screen.getByText(current)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际收束当前原现场/ }));
    expect(screen.getByText(current)).toBeTruthy();
    rerender(<CalamityPriestPanel calamityPriest={{ ...value, insideCase: false, practice: { ...value.practice, board: "SECURED" }, actions: [],
      cases: value.cases.map((entry) => entry.id === "isolated-board" ? { ...entry, closes: 1, contactOpen: "已实际固定收好同一原板" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前原板：同一原板已实际固定收好")).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.getByText(/实际结束次数：1/)).toBeTruthy(); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "isolated-board" });
  });

  it("retains willing focus until saved release without therapy or forced truth controls", async () => {
    const value = opened("willing-focus", { hazard: "UNASSESSED", board: "RESTING", contact: "FOCUSED" });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByText("当前精神接触：短暂精神接触仍在，须主动结束")).toBeTruthy();
    expect(screen.getByText(cases()[2]!.story)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际收束当前原现场/ }));
    expect(screen.getByText("当前精神接触：短暂精神接触仍在，须主动结束")).toBeTruthy();
    rerender(<CalamityPriestPanel calamityPriest={{ ...value, insideCase: false, practice: { ...value.practice, contact: "RELEASED" }, actions: [],
      cases: value.cases.map((entry) => entry.id === "willing-focus" ? { ...entry, closes: 1, contactOpen: "已停止接触并等短暂影响结束" } : entry) }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前精神接触：本次精神接触已实际解除")).toBeTruthy(); expect(screen.getByText(originalFailure)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /真话|治疗|读心|强迫|继续控制/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "willing-focus" });
  });

  it("does not manufacture CLOSE, report, lottery or secured state from old result prose", () => {
    const value = { ...opened(), actions: [], cases: cases().map((entry) => ({ ...entry, result: "上次原板已收好，本次仍需实际处理。" })) };
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "灾祸教士成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(screen.getByText("当前原板：同一原板已落下，尚未固定")).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("never renders private source fields or assumes hidden future knowledge", () => {
    const value = { ...calamityPriest({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "rain-rack" }, "从安全位置观察原架")] }),
      privatePlan: "PRIVATE_PLAN_NEVER_RENDER", future: "FUTURE_ROLL_NEVER_RENDER", luckPool: 999, badLuckDebt: 999, strain: 3, moon: "HIDDEN_MOON" };
    panel(value);
    for (const secret of ["PRIVATE_PLAN_NEVER_RENDER", "FUTURE_ROLL_NEVER_RENDER", "HIDDEN_MOON", "999", "冲动张力", "月相"])
      expect(document.body.textContent).not.toContain(secret);
    expect(screen.queryByRole("region", { name: "灾祸教士实际结果" })).toBeNull(); expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /读心|敌方计划|未来|选好运|储存|重抽/ })).toBeNull();
  });

  it("honors ability resource reasons while retaining an ordinary route", async () => {
    const ability = { ...action({ type: "PREPARE", caseId: "isolated-board", method: "ABILITY" }, "准备有限招灾", false, "1行动 · 执行需3灵性"), reason: "当前灵性不足3。" };
    const ordinary = action({ type: "PREPARE", caseId: "isolated-board", method: "ORDINARY" }, "准备普通原板方法", true, "1行动 · 0灵性");
    const { onCommand } = panel(calamityPriest({ promoted: true, cases: cases(), actions: [ability, ordinary] }));
    const abilityButton = screen.getByRole("button", { name: /^准备有限招灾/ }) as HTMLButtonElement;
    expect(abilityButton.disabled).toBe(true); expect(screen.getByText(ability.reason)).toBeTruthy(); fireEvent.click(abilityButton);
    await userEvent.click(screen.getByRole("button", { name: /^准备普通原板方法/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it("locks pending selection and mutations without clearing committed original flags", () => {
    const value = calamityPriest({ promoted: true, cases: cases(), practice: { hazard: "SECURED", board: "SECURED", contact: "RELEASED" }, actions: [
      action({ type: "OBSERVE", caseId: "rain-rack" }, "观察原现场"), action({ type: "REFLECT" }, "反思原报告"),
    ] }); const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<CalamityPriestPanel calamityPriest={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("当前原板：同一原板已实际固定收好")).toBeTruthy();
      expect(screen.getByText("当前精神接触：本次精神接触已实际解除")).toBeTruthy();
    }
    rerender(<CalamityPriestPanel calamityPriest={value} resources={resources} busy={false} error={{ message: "须重新加载原保存", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows all six inherited and three new mastery entries without an active luck command", () => {
    const ids = ["wheel.s9.spirit-sensitivity", "wheel.s9.fragmentary-omen", "wheel.s9.danger-intuition", "wheel.s8.calculation-control", "wheel.s8.divination-guard", "wheel.s7.passive-luck", "wheel.s6.disaster-awareness", "wheel.s6.disaster-attraction", "wheel.s6.mental-storm"];
    const labels = ["灵性感知", "片段预兆", "危险直觉", "计算与控制", "占卜防护", "被动幸运", "有限灾害察觉", "有限招灾", "有限精神风暴"];
    const story = "有限能力以已核实原文为边界，三处情境与和平路线为G原创。";
    const abilities = ids.map((id, index) => ({ id, label: labels[index]!, mastery: index + 10, description: `保留第${index + 1}项已知能力实际掌握。` }));
    panel(calamityPriest({ promoted: true, story, cases: cases(), actions: [], abilities }));
    expect(screen.getByRole("heading", { name: "能力与消化 · 9 项训练记录" })).toBeTruthy();
    for (const ability of abilities) {
      expect(screen.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(screen.getByText(ability.description)).toBeTruthy();
    }
    expect((screen.getByText(story).closest("details") as HTMLDetailsElement).open).toBe(false);
    const boundary = screen.getByText("查看有限灾害、精神接触与被动幸运边界").closest("details") as HTMLDetailsElement;
    expect(boundary.open).toBe(false);
    for (const text of ["实际风险核查", "物主授权", "人员已清空", "同一原板", "现存成年人佩林", "本人可要求停止", "强迫说真话", "不是", "不能主动选择好运时机", "不存在幸运池、等额厄运债", "序列5幸运储存", "每次耗3灵性", "普通安全方法0灵性", "各25扮演进度、反思25", "原著无代价保证"])
      expect(boundary.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("forwards real encounter choices with an existing exit and no invented disaster source", async () => {
    const actions = [action({ type: "ENCOUNTER_TALK" }, "与杜兰交涉"), action({ type: "ENCOUNTER_FIGHT" }, "承担原外院冲突")];
    const { onCommand } = panel(calamityPriest({ promoted: true, acting: 100, digestion: "本阶段已消化", environment: "杜兰与自己的普通短棍仍在原外院。", actions }));
    expect(screen.getByText("扮演进度 100 · 消化：本阶段已消化")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "灾祸教士扮演进度" }).getAttribute("value")).toBe("100");
    const encounter = within(screen.getByRole("region", { name: "灾祸教士有限冲突" }));
    for (const text of ["相隔2米", "原清空外院", "没有松板、旁人或可用灾源", "原出口", "这里不追击", "被动幸运不能主动指定成功"])
      expect(encounter.getByText(/成年普通人杜兰持自己的普通短棍/).textContent).toContain(text);
    for (const entry of actions) await userEvent.click(encounter.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(actions.map((entry) => entry.command));
  });

  it("retains S7 stories, passive luck, failures, closures and independent bottles as read-only history", () => {
    const lucky: LuckyProjection = {
      title: "幸运者", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原幸运者供给记录保留。", story: "原幸运者故事。", environment: "原现场已经实际结束。",
      cases: [{ id: "next-carriage", title: "原班车实践", story: "原车次已经驶离，未改写实际失败。", status: "RESOLVED", observations: ["已核对车站的真实时刻表。"],
        preparation: "只查询实际存在的下一车次。", result: "实际离开后提交有限报告。", contactOpen: "已实际结束原接触", closes: 2, luck: "原被动幸运平常，没有重抽。" }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "lucky-original-1", title: "幸运者旧原瓶", source: "独立幸运者原渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "lucky-original-1", confirmed: true } }],
      abilities: [{ id: "wheel.s7.passive-luck", label: "原被动幸运", mastery: 67, description: "保留原能力实际掌握。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录", insideCase: false,
    };
    render(<CalamityPriestLuckyHistory lucky={lucky} />);
    const history = within(screen.getByRole("region", { name: "幸运者时期的经历" }));
    for (const text of ["原幸运者故事。", "原幸运者供给记录保留。", "原车次已经驶离，未改写实际失败。", "已核对车站的真实时刻表。", "原案卷ID：next-carriage", "原瓶ID：lucky-original-1",
      "当时的方式与准备：只查询实际存在的下一车次。", "当时的接触：已实际结束原接触", "当时实际结束次数：2", "当时的被动幸运记录：原被动幸运平常，没有重抽。", "当时的实际结果与报告：实际离开后提交有限报告。", "来源：独立幸运者原渠道", "已耗用 · 原失败保留", "原被动幸运 · 掌握 67：保留原能力实际掌握。"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/你已晋升灾祸教士（序列6）/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull(); expect(history.queryByText("不可重新执行旧成长")).toBeNull();
    for (const details of screen.getByRole("region", { name: "幸运者时期的经历" }).querySelectorAll("details")) expect(details.open).toBe(false);
  });
});
