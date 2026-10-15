/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANCIENT_ALCHEMIST_ABILITIES, ANCIENT_ALCHEMIST_CONSUMPTION_RISK } from "../../src/domain/ancient-alchemist/content";
import { createAncientAlchemistEncounterState, ANCIENT_ALCHEMIST_ENCOUNTER_STORY, ANCIENT_ALCHEMIST_POWERS } from "../../src/domain/ancient-alchemist/encounter";
import type { AncientAlchemistAction, AncientAlchemistCommand, AncientAlchemistProjection } from "../../src/domain/ancient-alchemist/types";
import { readFileSync } from "node:fs";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import { AncientAlchemistPanel, AncientAlchemistDruidHistory } from "../../src/renderer/AncientAlchemistPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "身体与性别保持原状，晋升不补满灵性。";
function action(command: AncientAlchemistCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): AncientAlchemistAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取原导师的古代炼金师指导", true, "1行动 · 540便士");
function cases(): AncientAlchemistProjection["cases"] {
  return ([
    { id: "living-stem", title: "同一原活茎的有限修补", story: "原AA4-STEM-1一直活着，保留原浅表损伤。" },
    { id: "living-fibre", title: "同一原托盘的短期纤维", story: "实际原材料制成60秒有限基质。" },
    { id: "honest-handover", title: "同一原纸的诚实交接", story: "诺拉·贝尔自愿接收真实有限报告。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null,
    result: null, contactOpen: "尚未开始本次实践", closes: 0 }));
}
const practice: NonNullable<AncientAlchemistProjection["practice"]> = {
  stem: "原AA4-STEM-1在同一原盆中活着，原损伤尚未修补。",
  matrix: "AA4-TRAY-1在原台，尚未消耗原材料制造基质。",
  report: "AA4-RECORD-1仍空白，原成年诺拉·贝尔在2米外原桌自愿等待。",
  route: "本次实际观察0小时、经过0秒、普通取还0米。",
  guard: "尚未制作护腕，没有可用原段。",
  kits: "AA4-KIT-1、AA4-KIT-2、AA4-KIT-3均为伊芙库存中分别登记的原包。", history: [],
};
function ancientAlchemist(patch: Partial<AncientAlchemistProjection> = {}): AncientAlchemistProjection {
  return { title: "古代炼金师 · 序列4 · 有限G实践", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立原瓶，各自保留来源与去向。", bodyChange,
    inheritedTools: "旧壤土、原双苗、原标记与原纸继续保留。",
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "德鲁伊消化100，已度过12/12真实整周。",
    pollution: 3, risk: ANCIENT_ALCHEMIST_CONSUMPTION_RISK, cases: [], insideCase: false,
    environment: "同一原导师、独立原材料和有限原样品，距离、期限与检定均为G。", practice: null, encounter: null, ...patch };
}
function bottled(): AncientAlchemistProjection {
  const bottles: AncientAlchemistProjection["bottles"] = [1, 2, 3].map(number => ({ id: `ancient-alchemist-potion-${number}`,
    title: `第${number}瓶古代炼金师原瓶`, source: `原导师独立封存的第${number}瓶G成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `ancient-alchemist-potion-${number}`, confirmed: true } }));
  return ancientAlchemist({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<AncientAlchemistProjection> = {}): AncientAlchemistProjection {
  return ancientAlchemist({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: ANCIENT_ALCHEMIST_ABILITIES.map(ability => ({ ...ability, mastery: 0 })), ...patch });
}
function encounter(patch: Partial<NonNullable<AncientAlchemistProjection["encounter"]>> = {}): NonNullable<AncientAlchemistProjection["encounter"]> {
  return { ...createAncientAlchemistEncounterState(), name: "奥斯里克·维尔", story: ANCIENT_ALCHEMIST_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原苗圃边庭普通侧门", pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: ANCIENT_ALCHEMIST_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: AncientAlchemistProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<AncientAlchemistPanel ancientAlchemist={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: AncientAlchemistProjection, onCommand: (command: AncientAlchemistCommand) => void) {
  return <AncientAlchemistPanel ancientAlchemist={value} resources={resources} busy={false} onCommand={onCommand} />;
}
function scene(id: string, status: string): AncientAlchemistProjection["cases"] {
  return cases().map(entry => entry.id === id ? { ...entry, status } : entry);
}
afterEach(cleanup);

describe("AncientAlchemist independent bottles and committed confirmations", () => {
  it("shows the actual maturity and costs while the full formula and ritual stay unknown", () => {
    const reason = "德鲁伊晋升后11/12整周，尚未成熟。";
    const { onCommand } = panel(ancientAlchemist({ digestion: reason, formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }],
      actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "古代炼金师配方与成品边界" });
    for (const text of ["完整配方", "晋升仪式细节尚未掌握", "12真实整周", "意志难度28", "540", "6800", "5300", "1500", "下一真实周", "继续德鲁伊生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(button(learn.label).disabled).toBe(true); fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|神话变身|灵魂契约/ })).toBeNull();
  });

  it("forwards exact independent labour and payment commands with public costs", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "ancient-alchemist-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 五步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "ancient-alchemist-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立古代炼金师原瓶" }), "ancient-alchemist-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle and restores keyboard focus on Escape without consumption", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立古代炼金师原瓶" }), bottle.id);
      const entry = value.actions.find(item => "bottleId" in item.command && item.command.bottleId === bottle.id)!;
      button(entry.label).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: bottle.title }));
      expect(screen.getByText(`原瓶：${bottle.id}`)).toBeTruthy(); expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
      await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(button(entry.label));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows real four-tier risks and submits the selected zero-AP consumption only once", async () => {
    const value = bottled(), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(value.actions[0]!.label));
    const review = screen.getByRole("region", { name: "这瓶古代炼金师魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "古代炼金师服用风险与四档结果" }).textContent).toContain(ANCIENT_ALCHEMIST_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", bodyChange, "既往代价"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before); expect(confirm.disabled).toBe(true);
  });

  it("keeps the same pending submission through save failure and defers retry to the save owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<AncientAlchemistPanel ancientAlchemist={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药、施用、等待"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶古代炼金师魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale review when the original bottle has actually been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶古代炼金师魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立古代炼金师原瓶" }), "ancient-alchemist-potion-1");
    expect(screen.getByText("已耗用，本次失败")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<AncientAlchemistPanel ancientAlchemist={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Ancient Alchemist finite original materials and cleanup", () => {
  it("distinguishes the source-backed direction from fictional prototypes and zero-mastery skills", () => {
    panel(trained());
    const boundary = screen.getByRole("region", { name: "古代炼金师能力范围" });
    for (const text of ["母亲途径", "古典炼金师", "人体炼金师", "下一序列抬棺人的能力不在本页开放", "晋升须取得独立成品并完成专业准备", "完整配方", "不开放复活死者", "通识者", "老尼尔", "弗兰克", "灵魂", "无限食物"]) expect(boundary.textContent).toContain(text);
    expect(ANCIENT_ALCHEMIST_ABILITIES).toHaveLength(2);
    for (const ability of ANCIENT_ALCHEMIST_ABILITIES) expect(screen.getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain("当前灵性 0 / 120");
  });

  it("renders only committed original objects, kit supply and actual guard resources", () => {
    const value = trained(), before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" });
    for (const text of [practice.stem, practice.matrix, practice.report, practice.route, practice.guard, practice.kits]) expect(facts.textContent).toContain(text);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards the selected existing kit and case without fabricating materials on click", () => {
    const buy = action({ type: "BUY_KIT", caseId: "living-stem", kitId: "AA4-KIT-2" }, "实际购买原AA4-KIT-2用于活茎", true, "1行动 · 80便士");
    const value = trained({ cases: scene("living-stem", "OBSERVED"), actions: [buy] }), before = structuredClone(value);
    const { onCommand } = panel(value); fireEvent.click(button(buy.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(buy.command); expect(onCommand.mock.calls[0]![0]).toBe(buy.command);
    expect(screen.getByText(buy.cost)).toBeTruthy(); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("伊芙库存");
  });

  it.each(["ABILITY", "ORDINARY"] as const)("sends exact %s preparation without changing the original stem", method => {
    const prepare = action({ type: "PREPARE", caseId: "living-stem", method }, `准备${method}活茎修补`, true, "1行动");
    const value = trained({ cases: scene("living-stem", "OBSERVED"), actions: [prepare] }), before = structuredClone(value);
    const { onCommand } = panel(value); fireEvent.click(button(prepare.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("原损伤尚未修补");
  });

  it("keeps six-hour observation and original-pot return separate before close, including at zero AP", () => {
    const observe = action({ type: "OBSERVE_RECOVERY", caseId: "living-stem" }, "实际观察原活茎6小时");
    const handBack = action({ type: "RETURN_SAMPLE", caseId: "living-stem" }, "结束保管并归还原盆与普通夹具", false, "0行动", "先完成6小时原观察。");
    const close = action({ type: "CLOSE", caseId: "living-stem" }, "确认原盆归还并结束", false, "0行动", "原盆仍由本人保管。");
    const value = trained({ insideCase: true, cases: scene("living-stem", "EXAMINED"), actions: [close, handBack, observe],
      practice: { ...practice, stem: "原AA4-STEM-1同一盆、原损伤有限稳定，但未实际观察。", kits: "同一AA4-KIT-1已实际耗用。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain(observe.label);
    expect((screen.getByRole("combobox", { name: "选择当前古代炼金师生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(observe.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(observe.command); expect(value).toEqual(before);
    rerender(update({ ...value, actions: [close, { ...handBack, enabled: true, reason: null }],
      practice: { ...value.practice!, stem: "同一原活茎实际观察6小时，仅记录短期稳定。", route: "实际观察6小时。" } }, onCommand));
    expect(button(close.label).disabled).toBe(true); fireEvent.click(button(handBack.label));
    expect(onCommand.mock.calls[1]![0]).toBe(handBack.command);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }],
      practice: { ...value.practice!, stem: "同一原盆仍在伊芙原台，本人保管已结束，未用夹具已归还。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[2]![0]).toBe(close.command);
  });

  it("preserves visible failed damage and spent materials rather than claiming revival", () => {
    const value = trained({ cases: scene("living-stem", "EXAMINED").map(entry => entry.id === "living-stem"
      ? { ...entry, result: "失败：AA4-KIT-1实耗，4灵性已付，原活茎损伤仍未解决，没有奖励。" } : entry),
      practice: { ...practice, stem: "原活茎仍活着，原损伤可见未解决。", kits: "AA4-KIT-1已耗用，不得再次使用。" } });
    const { onCommand } = panel(value);
    const result = screen.getByRole("region", { name: "古代炼金师实际实践结果" });
    for (const text of ["失败", "AA4-KIT-1实耗", "4灵性已付", "没有奖励"]) expect(result.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("原损伤可见未解决");
    expect(screen.queryByRole("button", { name: /复活|补满|免费重试/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("recommends testing the original matrix before stopping, then ordinary two-metre return", () => {
    const test = action({ type: "TEST_MATRIX", caseId: "living-fibre" }, "用同一试重块测试原基质一次");
    const stop = action({ type: "STOP_MATRIX", caseId: "living-fibre" }, "实际等完原基质60秒期限");
    const handBack = action({ type: "RETURN_SAMPLE", caseId: "living-fibre" }, "普通往返2米交回同一惰性残体", false, "0行动", "原基质尚未停止。");
    const value = trained({ insideCase: true, cases: scene("living-fibre", "EXAMINED"), actions: [stop, test, handBack],
      practice: { ...practice, matrix: "AA4-MATRIX-1在原AA4-TRAY-1，实际剩余60秒；耗用原AA4-KIT-2。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain(test.label);
    expect(button(handBack.label).disabled).toBe(true); fireEvent.click(button(test.label)); expect(value).toEqual(before);
    const tested = { ...value, actions: [stop, handBack], practice: { ...value.practice!, matrix: "同一0.5千克原块滑动一次，AA4-MATRIX-1收缩支撑，实际已过10秒。" } };
    rerender(update(tested, onCommand)); expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain(stop.label);
    fireEvent.click(button(stop.label)); expect(onCommand.mock.calls[1]![0]).toBe(stop.command);
    rerender(update({ ...tested, actions: [{ ...handBack, enabled: true, reason: null }],
      practice: { ...tested.practice, matrix: "同一AA4-MATRIX-1已过60秒，为不可复苏的惰性残体。" } }, onCommand));
    fireEvent.click(button(handBack.label)); expect(onCommand.mock.calls[2]![0]).toBe(handBack.command);
    expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("不可复苏");
  });

  it("distinguishes ordinary woven support and failed inert residue from a living matrix", async () => {
    const value = trained({ cases: scene("living-fibre", "EXAMINED").map(entry => entry.id === "living-fibre"
      ? { ...entry, result: "普通方法0灵性，同一AA4-KIT-2已耗，只得到非活性编织垫。" } : entry) });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前古代炼金师生活实践" }), "living-fibre");
    expect(screen.getByRole("region", { name: "古代炼金师实际实践结果" }).textContent).toContain("非活性编织垫");
    rerender(update({ ...value, cases: value.cases.map(entry => entry.id === "living-fibre"
      ? { ...entry, result: "能力失败，AA4-KIT-2实耗，只有同一惰性残料，没有活性基质。" } : entry) }, onCommand));
    expect(screen.getByRole("region", { name: "古代炼金师实际实践结果" }).textContent).toContain("只有同一惰性残料");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("hands over the same bounded report and returns before close without magical ordinary credit", () => {
    const handOver = action({ type: "HAND_OVER", caseId: "honest-handover" }, "往返4米把同一原纸交给诺拉");
    const close = action({ type: "CLOSE", caseId: "honest-handover" }, "确认原纸已交妥并结束", false, "0行动", "同一原纸尚在本人手中。");
    const value = trained({ insideCase: true, cases: scene("honest-handover", "EXAMINED"), actions: [close, handOver],
      practice: { ...practice, report: "AA4-RECORD-1由本人持有，已记AA4-KIT-1/2、6小时观察和60秒停止，无造魂声明。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain(handOver.label);
    fireEvent.click(button(handOver.label)); expect(value).toEqual(before); expect(button(close.label).disabled).toBe(true);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...value.practice!,
      report: "同一AA4-RECORD-1由原AA4-NORA-BELL收妥。", route: "本人走2米交纸，再走2米返回，共4米。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls.map(([command]) => command)).toEqual([handOver.command, close.command]);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")!.textContent).toContain("两种方法都只做普通核对");
  });

  it("withdraws unused preparation without pretending the original held kit was refunded", () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "living-stem" }, "撤回尚未施用的活茎准备");
    const perform = action({ type: "PERFORM", caseId: "living-stem" }, "施用原有限活茎修补", false, "1行动 · 4灵性", "当前灵性不足4。");
    const value = trained({ cases: scene("living-stem", "PREPARED"), actions: [withdraw, perform],
      practice: { ...practice, kits: "AA4-KIT-1仍由本人持有，原80便士已支付。" } }), before = structuredClone(value);
    const { onCommand } = panel(value); fireEvent.click(button(withdraw.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(value).toEqual(before); expect(button(perform.label).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("仍由本人持有");
  });

  it("forwards bounded next-week supply and separately paid original guard fabrication", () => {
    const commands: AncientAlchemistCommand[] = [
      { type: "REQUEST_KITS" }, { type: "RECEIVE_KITS" }, { type: "REQUEST_GUARD_KITS" }, { type: "RECEIVE_GUARD_KITS" },
      { type: "PREPARE_GUARD", kitId: "AA4-GUARD-KIT-1" }, { type: "RETURN_GUARD" },
    ];
    const actions = commands.map((command, index) => action(command, `真实材料行动${index + 1}`, true,
      command.type === "PREPARE_GUARD" ? "1行动 · 120便士 · 4灵性 · 原包AA4-GUARD-KIT-1" : "依原投影成本"));
    const value = trained({ actions }), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of actions) fireEvent.click(button(entry.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands); expect(value).toEqual(before);
    expect(screen.getByText(actions[4]!.cost)).toBeTruthy();
    expect(screen.getByRole("region", { name: "古代炼金师原护腕与有限制作" }).textContent).toContain("晋升不自动赠送成品");
  });

  it("preserves three actual guard segments and the same spent frame after an activation", () => {
    const value = trained({ practice: { ...practice, guard: "原AA4-GUARD-1，原材料AA4-GUARD-KIT-1，剩余3/3段，无自动补充。" } });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("剩余3/3段");
    rerender(update({ ...value, practice: { ...value.practice!, guard: "同一AA4-GUARD-1，原段1实耗，剩余2/3段，原惰性段保留在同一框体。" } }, onCommand));
    const facts = screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" });
    expect(facts.textContent).toContain("剩余2/3段"); expect(facts.textContent).toContain("原惰性段保留"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("advances the selected case only after its report actually commits", () => {
    const report = action({ type: "REPORT", caseId: "living-stem" }, "提交原活茎6小时报告", true, "1行动");
    const observe = action({ type: "OBSERVE", caseId: "living-fibre" }, "观察原托盘与独立原材料", true, "1行动");
    const value = trained({ cases: scene("living-stem", "EXAMINED"), actions: [report, observe] });
    const { onCommand, rerender } = panel(value); fireEvent.click(button(report.label));
    expect((screen.getByRole("combobox", { name: "选择当前古代炼金师生活实践" }) as HTMLSelectElement).value).toBe("living-stem");
    rerender(update({ ...value, cases: scene("living-stem", "RESOLVED"), actions: [observe] }, onCommand));
    expect((screen.getByRole("combobox", { name: "选择当前古代炼金师生活实践" }) as HTMLSelectElement).value).toBe("living-fibre");
  });
});

describe("Ancient Alchemist real opponent and original Druid history", () => {
  it("requires cancellable confirmation and submits the real fight only once", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原奥斯里克的边庭冲突", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [fight] }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(fight.label)); expect(onCommand).not.toHaveBeenCalled();
    const review = screen.getByRole("region", { name: "古代炼金师真实迎战确认" });
    for (const text of ["奥斯里克·维尔", "40点有限灵性", "AA4-OSRIC-CLUB", "3段", "知识18", "0.6", "60秒", "失败照常消耗", "旧马伦", "死亡"]) expect(review.textContent).toContain(text);
    expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(button("暂不迎战")); expect(onCommand).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button(fight.label));
    await userEvent.click(button(fight.label)); const confirm = button("确认风险"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(confirm.disabled).toBe(true); expect(value).toEqual(before);
  });

  it("dismisses stale fight review when the original opponent's committed state changes", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "准备迎战原奥斯里克", true, "1行动");
    const value = trained({ encounter: encounter(), actions: [fight] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(fight.label)); rerender(update({ ...value, encounter: encounter({ status: "RETREATED" }), actions: [] }, onCommand));
    expect(screen.queryByRole("region", { name: "古代炼金师真实迎战确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "古代炼金师原奥斯里克与实际费用" }).textContent).toContain("本人已沿原出口离开");
  });

  it("shows actual pending paid protection and retains costs after expiry without inventing healing", () => {
    const value = trained({ encounter: encounter({ status: "FIGHTING", enemySpirituality: 32,
      guardAttempts: 2, guardReady: { guardId: "AA4-GUARD-1", segmentId: "AA4-GUARD-1-SEGMENT-2" } }) });
    const { onCommand, rerender } = panel(value);
    const facts = screen.getByRole("region", { name: "古代炼金师原奥斯里克与实际费用" });
    for (const text of ["32 / 40", "AA4-OSRIC-CLUB", "未传给玩家", "尝试防护 2 次", "AA4-GUARD-1-SEGMENT-2", "0.6", "不恢复本人健康"]) expect(facts.textContent).toContain(text);
    rerender(update({ ...value, encounter: encounter({ ...value.encounter!, guardReady: null }) }, onCommand));
    expect(screen.getByRole("region", { name: "古代炼金师有限防护与实际花费" }).textContent).toContain("当前没有待生效防护");
    expect(screen.getByRole("region", { name: "古代炼金师有限防护与实际花费" }).textContent).toContain("尝试防护 2 次");
    expect(screen.queryByRole("button", { name: /抢棍|补灵|必胜|重掷/ })).toBeNull();
  });

  it("retains the actual original body, wounds, club and terminal resource cost", () => {
    panel(trained({ encounter: encounter({ status: "RESOLVED", enemyHealth: 70, enemySpirituality: 8, enemyStatus: "SURRENDERED",
      enemyInjuries: [{ id: "original-osric-wound", severity: "HEAVY", acquiredRevision: 400, treatedRevision: null }],
      terminal: { outcome: "ENEMY_SURRENDERED", round: 2, historyIndex: 8, enemyHealth: 70, enemyMind: 100, enemySpirituality: 8, enemyStatus: "SURRENDERED" } }) }));
    const facts = screen.getByRole("region", { name: "古代炼金师原奥斯里克与实际费用" });
    for (const text of ["原奥斯里克自行停止抵抗", "original-osric-wound", "当前没有待生效防护", "仍为奥斯里克本人的原物", "当时原敌人健康70、精神100、灵性8", "不能重新开战"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /迎战|重战|复活/ })).toBeNull();
  });

  it("shows the actual migrated 304-command Druid record read-only with its failed original bottles", () => {
    const capture = JSON.parse(readFileSync("tests/fixtures/druid-v01160/natural.json", "utf8"));
    const old = projectSliceState(migrateSliceState(capture.final)).druid!, before = structuredClone(old);
    expect(capture.commands).toHaveLength(304); expect(old.acting).toBe(100);
    render(<AncientAlchemistDruidHistory druid={old} />);
    const history = screen.getByRole("region", { name: "德鲁伊时期的经历" });
    for (const text of ["伊芙·莫兰", "BOX", "SETTLED", "RESTING", "HANDED_OVER", "原马伦", "犬", "猫", "鼠", "拉瓦章鱼", "成年霍纳奇斯灰山羊", "六翼石像鬼"]) expect(history.textContent).toContain(text);
    for (const bottle of old.bottles) { expect(history.textContent).toContain(bottle.id); expect(history.textContent).toContain(bottle.status); }
    for (const entry of old.cases) { expect(history.textContent).toContain(entry.title); if (entry.result) expect(history.textContent).toContain(entry.result); }
    expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull(); expect(old).toEqual(before);
  });
});

describe("AncientAlchemist exact static copy", () => {
  it("retains the actual preparation conditions without claiming a known complete ritual", () => {
    const value = ancientAlchemist(), before = structuredClone(value), { onCommand } = panel(value);
    const formula = screen.getByRole("region", { name: "古代炼金师配方与成品边界" });
    expect(within(formula).getByText("完整配方与晋升仪式细节尚未掌握。原导师伊芙·莫兰提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。", { exact: true })).toBeTruthy();
    expect(within(formula).queryByText("完整配方与原著晋升仪式细节仍未知。原导师伊芙·莫兰的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。", { exact: true })).toBeNull();
    for (const text of ["12真实整周", "意志难度28", "540便士", "6800便士", "5300便士", "1500便士", "三瓶独立原瓶全部失败后", "下一真实周"]) expect(formula.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it("keeps the exact adult opponent, weapon, distance, spirituality and ordinary exit in fight review", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原奥斯里克的边庭冲突", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [fight] }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(fight.label));
    const review = screen.getByRole("region", { name: "古代炼金师真实迎战确认" });
    expect(within(review).getByText("成年序列5对手奥斯里克·维尔在已知普通浅壤土原边庭2米外，持自己的AA4-OSRIC-CLUB原短棍，有40点有限灵性。原普通侧门开放、无旁人、无追逐；也可以普通拒绝交手后离开。", { exact: true })).toBeTruthy();
    expect(within(review).queryByText("原创成年序列5对手奥斯里克·维尔在已知普通浅壤土原边庭2米外，持自己的AA4-OSRIC-CLUB原短棍，有40点有限灵性。原普通侧门开放、无旁人、无追逐；也可以普通拒绝交手后离开。", { exact: true })).toBeNull();
    for (const text of ["120便士", "4灵性", "3段", "知识18", "0.6", "60秒", "失败照常消耗", "死亡"]) expect(review.textContent).toContain(text);
    await userEvent.click(button("暂不迎战"));
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
