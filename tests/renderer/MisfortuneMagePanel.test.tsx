/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MISFORTUNE_MAGE_ABILITIES, MISFORTUNE_MAGE_CONSUMPTION_RISK } from "../../src/domain/misfortune-mage/content";
import { createMisfortuneMageEncounterState, MISFORTUNE_MAGE_ENCOUNTER_STORY, MISFORTUNE_MAGE_POWERS } from "../../src/domain/misfortune-mage/encounter";
import type { MisfortuneMageAction, MisfortuneMageCommand, MisfortuneMageProjection } from "../../src/domain/misfortune-mage/types";
import type { WinnerProjection } from "../../src/domain/winner/types";
import { MisfortuneMagePanel, MisfortuneMageWinnerHistory } from "../../src/renderer/MisfortuneMagePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "身体与性别保持原状，晋升不补满灵性。";
function action(command: MisfortuneMageCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): MisfortuneMageAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取原导师的候选厄运法师指导", true, "1行动 · 540便士");
function cases(): MisfortuneMageProjection["cases"] {
  return ([
    { id: "uncertain-weight", title: "原砝码的不确定警示", story: "艾妲允许一次原砝码观察，下面无人。" },
    { id: "willing-throw", title: "塞拉重新同意的投掷", story: "原成年塞拉只同意这一次原豆袋投掷。" },
    { id: "honest-forecast", title: "原纸上的有限记录", story: "同一张新记录纸如实保留失败与费用。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null,
    result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
const practice: NonNullable<MisfortuneMageProjection["practice"]> = {
  weight: "MM4-WEIGHT-1仍是艾妲自己的同一原物。", cord: "MM4-CORD-1完整，原软盘在原砝码下方。",
  bag: "MM4-BAG-1在原主人塞拉手中。", consent: "塞拉尚未作出本次投掷许可。",
  note: "同一MM4-NOTE-1未写，原WN5-NOTE-1不改。", route: "本人实际取回走动0米。", history: [],
};
const luck: WinnerProjection["luck"] = { stored: 2, accumulated: 5, spent: 3, lastAccumulateWeek: 67, capacity: 3,
  summary: "原账真实累计积存5份、花费3份，当前储存2份。" };
function misfortuneMage(patch: Partial<MisfortuneMageProjection> = {}): MisfortuneMageProjection {
  return { title: "厄运法师 · 候选序列4 · G延伸实践", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立原瓶，各自保留来源与去向。", bodyChange,
    inheritedTools: "原木筹、原环、原纸与唯一原积运账继续保留。",
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "赢家消化100，已度过12/12真实整周。",
    pollution: 3, risk: MISFORTUNE_MAGE_CONSUMPTION_RISK, cases: [], insideCase: false,
    environment: "同一原导师、原成年人和新原物，距离、期限与检定均为G。", practice: null, luck: structuredClone(luck), encounter: null, ...patch };
}
function bottled(): MisfortuneMageProjection {
  const bottles: MisfortuneMageProjection["bottles"] = [1, 2, 3].map(number => ({ id: `misfortune-mage-potion-${number}`,
    title: `第${number}瓶厄运法师原瓶`, source: `原导师独立封存的第${number}瓶G成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `misfortune-mage-potion-${number}`, confirmed: true } }));
  return misfortuneMage({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<MisfortuneMageProjection> = {}): MisfortuneMageProjection {
  return misfortuneMage({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: MISFORTUNE_MAGE_ABILITIES.map(ability => ({ ...ability, mastery: 0 })), ...patch });
}
function encounter(patch: Partial<NonNullable<MisfortuneMageProjection["encounter"]>> = {}): NonNullable<MisfortuneMageProjection["encounter"]> {
  return { ...createMisfortuneMageEncounterState(), name: "费里斯·洛恩", story: MISFORTUNE_MAGE_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原报时铺后院普通出口", pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: MISFORTUNE_MAGE_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: MisfortuneMageProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MisfortuneMagePanel misfortuneMage={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: MisfortuneMageProjection, onCommand: (command: MisfortuneMageCommand) => void) {
  return <MisfortuneMagePanel misfortuneMage={value} resources={resources} busy={false} onCommand={onCommand} />;
}
function scene(id: string, status: string): MisfortuneMageProjection["cases"] {
  return cases().map(entry => entry.id === id ? { ...entry, status } : entry);
}
afterEach(cleanup);

describe("MisfortuneMage independent bottles and committed confirmations", () => {
  it("shows the actual maturity and costs while the full formula and ritual stay unknown", () => {
    const reason = "赢家晋升后11/12整周，尚未成熟。";
    const { onCommand } = panel(misfortuneMage({ digestion: reason, formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }],
      actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "厄运法师配方与成品边界" });
    for (const text of ["完整配方", "完整配方与晋升仪式细节尚未掌握。", "12真实整周", "意志难度28", "540", "6800", "5300", "1500", "下一真实周", "继续赢家生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "厄运法师成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(button(learn.label).disabled).toBe(true); fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|神话变身|灵魂契约/ })).toBeNull();
  });

  it("forwards exact independent labour and payment commands with public costs", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "misfortune-mage-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 五步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "misfortune-mage-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立厄运法师原瓶" }), "misfortune-mage-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle and restores keyboard focus on Escape without consumption", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立厄运法师原瓶" }), bottle.id);
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
    const review = screen.getByRole("region", { name: "这瓶厄运法师魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "厄运法师服用风险与四档结果" }).textContent).toContain(MISFORTUNE_MAGE_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", bodyChange, "既往代价"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before); expect(confirm.disabled).toBe(true);
  });

  it("keeps the same pending submission through save failure and defers retry to the save owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<MisfortuneMagePanel misfortuneMage={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药、投掷、积运"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶厄运法师魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale review when the original bottle has actually been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶厄运法师魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立厄运法师原瓶" }), "misfortune-mage-potion-1");
    expect(screen.getByText("已耗用，本次失败")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<MisfortuneMagePanel misfortuneMage={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Misfortune Mage candidate source and original luck", () => {
  it("shows finite practice requirements, actual costs and the inherited abilities", () => {
    panel(trained());
    const boundary = screen.getByRole("region", { name: "厄运法师能力范围" });
    for (const text of ["每项操作仍须满足当前条件", "承担实际费用与风险", "防患练习", "有限厄运", "被动幸运", "灾难感知", "精神风暴", "节制积运继续继承"]) expect(boundary.textContent).toContain(text);
    for (const ability of MISFORTUNE_MAGE_ABILITIES) expect(screen.getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.getByText("能力与使用范围").closest("details")?.open).toBe(false);
  });

  it("shows the real old ledger before and after promotion without optimistic accumulation or resource refills", () => {
    const accumulate = action({ type: "ACCUMULATE" }, "在原艾妲处安静节制积运", true, "1行动 · 0灵性");
    const initial = misfortuneMage(), { onCommand, rerender } = panel(initial);
    expect(screen.getByRole("region", { name: "同一赢家积运账" }).textContent).toContain(luck.summary);
    const value = trained({ actions: [accumulate] }), before = structuredClone(value);
    rerender(update(value, onCommand)); fireEvent.click(button(accumulate.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(accumulate.command); expect(value).toEqual(before);
    const ledger = screen.getByRole("region", { name: "同一赢家积运账" });
    for (const text of ["2 / 3", "第67周", "累计积存 − 累计花费", "不产生第二份积运", "不自动追加等额厄运债"]) expect(ledger.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "厄运法师成长下一步" }).textContent).toContain("当前灵性 0 / 120");
    rerender(update({ ...value, luck: { ...luck, stored: 3, accumulated: 6, lastAccumulateWeek: 80, summary: "原账实际又积存1份。" }, actions: [{ ...accumulate, enabled: false, reason: "本周已实际积运，且原储备已满3份。" }] }, onCommand));
    expect(button(accumulate.label).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "同一赢家积运账" }).textContent).toContain("第80周");
  });
});

describe("Misfortune Mage actual original objects and finite consent", () => {
  it("shows three distinct practices and all projected original-object facts", async () => {
    const value = trained(); panel(value);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前厄运法师生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const facts = screen.getByRole("region", { name: "厄运法师本次原物与实际收束" });
    for (const text of [practice.weight, practice.cord, practice.bag, practice.consent, practice.note, practice.route]) expect(facts.textContent).toContain(text);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
  });

  it("allows a failed warning to be secured ordinarily with the same cord before returning the same weight", () => {
    const secure = action({ type: "SECURE_WEIGHT", caseId: "uncertain-weight" }, "用原绳放下原砝码");
    const close = action({ type: "CLOSE", caseId: "uncertain-weight" }, "把原砝码与原绳交回艾妲", false, "0行动", "先用同一原绳放进原软盘。");
    const failed = "本次知识18警示失败，只能记为未能确定。已花3灵性不退。";
    const value = trained({ insideCase: true, cases: scene("uncertain-weight", "EXAMINED").map(entry => entry.id === "uncertain-weight" ? { ...entry, result: failed } : entry), actions: [secure, close] });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "厄运法师成长下一步" }).textContent).toContain(secure.label);
    expect(button(secure.label).disabled).toBe(false); expect(button(close.label).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择当前厄运法师生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(secure.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(secure.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "厄运法师实际实践结果" }).textContent).toContain(failed);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...practice, weight: "同一MM4-WEIGHT-1已由本人用原绳放入原软盘，尚未交回。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
    expect(screen.getByRole("region", { name: "厄运法师本次原物与实际收束" }).textContent).toContain("尚未交回");
  });

  it.each(["ABILITY", "ORDINARY"] as const)("forwards %s preparation without pretending the throw or payment already happened", method => {
    const prepare = action({ type: "PREPARE", caseId: "willing-throw", method }, `准备${method}一次原豆袋投掷`, true, "1行动");
    const value = trained({ cases: scene("willing-throw", "OBSERVED"), actions: [prepare] }), before = structuredClone(value);
    const { onCommand } = panel(value); fireEvent.click(button(prepare.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command); expect(value).toEqual(before);
    const facts = screen.getByRole("region", { name: "厄运法师本次原物与实际收束" });
    expect(facts.textContent).toContain("MM4-BAG-1在原主人塞拉手中");
    expect(screen.getByRole("region", { name: "同一赢家积运账" }).textContent).toContain("2 / 3");
  });

  it("keeps the original bag on the mat after paid failure and withdrawal until its real four-metre return commits", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "willing-throw" }, "塞拉撤回本次同意");
    const back = action({ type: "RETURN_BAG", caseId: "willing-throw" }, "走2米取原袋再走2米交回");
    const close = action({ type: "CLOSE", caseId: "willing-throw" }, "关闭本次豆袋接触", false, "0行动", "原豆袋仍在2米外软垫。");
    const value = trained({ insideCase: true, cases: scene("willing-throw", "EXAMINED"), actions: [withdraw, back, close],
      luck: { ...luck, stored: 1, spent: 4, summary: "本次失败已花1份原积运，实际不退。" },
      practice: { ...practice, bag: "同一MM4-BAG-1落在2米外原软垫。", consent: "塞拉只同意本次，原环保持不动。", history: ["能力失败，实付5灵性和1份原积运，实际未影响的投掷命中。"] } });
    const { onCommand, rerender } = panel(value);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByRole("region", { name: "厄运法师本次原物与实际收束" }).textContent).toContain("2米外原软垫");
    rerender(update({ ...value, actions: [back, close], practice: { ...value.practice!, consent: "塞拉已撤回，原袋仍须实际取回。" } }, onCommand));
    expect(button(back.label).disabled).toBe(false); expect(button(close.label).disabled).toBe(true); fireEvent.click(button(back.label));
    expect(onCommand.mock.calls[1]![0]).toBe(back.command);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...practice, bag: "本人亲手把同一MM4-BAG-1交回塞拉。", route: "本人实际普通去回4米。" } }, onCommand));
    expect(button(close.label).disabled).toBe(false); expect(screen.getByRole("region", { name: "厄运法师本次原物与实际收束" }).textContent).toContain("去回4米");
    expect(screen.getByRole("region", { name: "同一赢家积运账" }).textContent).toContain("1 / 3");
  });

  it("can withdraw a prepared agreement before throwing when actual luck or spirituality is insufficient", () => {
    const perform = action({ type: "PERFORM", caseId: "willing-throw" }, "实际投掷一次原袋", false, "1行动 · 5灵性 · 1份原积运", "当前灵性不足，不能实际尝试。");
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "willing-throw" }, "投掷前撤回本次同意");
    const { onCommand } = panel(trained({ cases: scene("willing-throw", "PREPARED"), actions: [perform, withdraw] }));
    expect(button(perform.label).disabled).toBe(true); expect(button(withdraw.label).disabled).toBe(false);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByRole("region", { name: "塞拉重新同意的投掷" }).textContent).toContain("投掷前撤回同意不投、不收费");
  });

  it("forwards both account claims and keeps the same rejected paper and contact open until a limited correction", () => {
    const guaranteed = action({ type: "CONFIRM_ACCOUNT", caseId: "honest-forecast", claim: "GUARANTEED" }, "宣称保证未来");
    const limited = action({ type: "CONFIRM_ACCOUNT", caseId: "honest-forecast", claim: "LIMITED" }, "如实确认有限记录");
    const close = action({ type: "CLOSE", caseId: "honest-forecast" }, "亲手交回同一原纸");
    const value = trained({ insideCase: true, cases: scene("honest-forecast", "EXAMINED"), actions: [guaranteed, limited, close],
      practice: { ...practice, note: "MM4-NOTE-1在本人手中，已写下实际失败费用。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "厄运法师成长下一步" }).textContent).toContain(limited.label);
    fireEvent.click(button(guaranteed.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(guaranteed.command); expect(value).toEqual(before);
    rerender(update({ ...value, practice: { ...value.practice!, note: "保证未来被明确拒绝；同一MM4-NOTE-1仍在本人手中。", history: ["第1次核对拒绝GUARANTEED，原纸与失败事实保留。"] } }, onCommand));
    expect(button(close.label).disabled).toBe(false); expect(screen.getByRole("region", { name: "厄运法师本次原物与实际收束" }).textContent).toContain("保证未来被明确拒绝");
    fireEvent.click(button(limited.label)); expect(onCommand.mock.calls[1]![0]).toBe(limited.command);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...value.practice!, note: "LIMITED已被接受；同一原纸尚未交回。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[2]![0]).toBe(close.command);
  });

  it("changes selected case only after a committed report, not while awaiting save", () => {
    const report = action({ type: "REPORT", caseId: "uncertain-weight" }, "提交真实原砝码报告", true, "1行动");
    const observe = action({ type: "OBSERVE", caseId: "willing-throw" }, "观察新的原豆袋许可", true, "1行动");
    const value = trained({ cases: scene("uncertain-weight", "EXAMINED"), actions: [report, observe] });
    const { onCommand, rerender } = panel(value); fireEvent.click(button(report.label));
    expect((screen.getByRole("combobox", { name: "选择当前厄运法师生活实践" }) as HTMLSelectElement).value).toBe("uncertain-weight");
    rerender(update({ ...value, cases: scene("uncertain-weight", "RESOLVED"), actions: [observe] }, onCommand));
    expect((screen.getByRole("combobox", { name: "选择当前厄运法师生活实践" }) as HTMLSelectElement).value).toBe("willing-throw");
  });
});
describe("Misfortune Mage independent actual opponent and old history", () => {
  it("requires a cancellable one-submit combat confirmation separate from any medicine", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入费里斯的原后院冲突", true, "1行动 · 真实死亡风险");
    const { onCommand } = panel(trained({ encounter: encounter(), actions: [fight] }));
    await userEvent.click(button(fight.label)); expect(onCommand).not.toHaveBeenCalled();
    const review = screen.getByRole("region", { name: "厄运法师真实迎战确认" });
    for (const text of ["费里斯·洛恩", "40点有限灵性", "原积运1份与4灵性", "知识18", "实付3灵性", "不会", "旧奥德里不复活", "真实战斗规则", "这两项新实践及序列4强化"]) expect(review.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "这瓶厄运法师魔药的服用确认" })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(button("暂不迎战")); expect(onCommand).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button(fight.label));
    await userEvent.click(button(fight.label)); const confirm = button("确认风险"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(confirm.disabled).toBe(true);
  });

  it("dismisses stale fight confirmation after a changed real opponent snapshot", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "准备迎战原费里斯", true, "1行动");
    const value = trained({ encounter: encounter(), actions: [fight] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(fight.label));
    rerender(update({ ...value, encounter: encounter({ status: "RETREATED" }), actions: [] }, onCommand));
    expect(screen.queryByRole("region", { name: "厄运法师真实迎战确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "厄运法师原费里斯与实际费用" }).textContent).toContain("本人已沿原出口离开");
  });

  it("shows actual original resources, paid attempts and composure clearing only the current pending effect", () => {
    const value = trained({ encounter: encounter({ status: "FIGHTING", enemySpirituality: 32, lastLuckRound: 2,
      luckAttempts: 2, misfortuneAttempts: 1, staggerReady: true, composureReady: false,
      powerUses: { ARC_BOLT: 1, WARD: 1, COMPOSE: 0 } }) });
    const { onCommand, rerender } = panel(value);
    const facts = screen.getByRole("region", { name: "厄运法师原费里斯与实际费用" });
    for (const text of ["MM4-FERRIS-LORNE", "32 / 40", "MM4-FERRIS-CLUB", "未传给玩家", "实际付费积运尝试 2 次", "有限厄运尝试 1 次", "只等待本轮下一次实际正向身体或弧光贡献", "当前没有定心保护", "失败仍付费"]) expect(facts.textContent).toContain(text);
    rerender(update({ ...value, encounter: encounter({ ...value.encounter!, enemySpirituality: 29,
      staggerReady: false, composureReady: true, powerUses: { ARC_BOLT: 1, WARD: 1, COMPOSE: 1 } }) }, onCommand));
    const composed = screen.getByRole("region", { name: "厄运法师原费里斯与实际费用" });
    for (const text of ["29 / 40", "当前没有待生效厄运", "当前回合抵抗新的有限厄运", "保护只到本轮末"]) expect(composed.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /抢棍|补灵|必胜|重掷/ })).toBeNull();
  });

  it("preserves the surrendered enemy's same club, actual wounds and final paid resources", () => {
    panel(trained({ encounter: encounter({ status: "RESOLVED", enemyHealth: 70, enemySpirituality: 29, enemyStatus: "SURRENDERED",
      staggerReady: false, composureReady: false, lastLuckRound: 2, luckAttempts: 2, misfortuneAttempts: 1,
      enemyInjuries: [{ id: "original-ferris-wound", severity: "HEAVY", acquiredRevision: 400, treatedRevision: null }],
      terminal: { outcome: "ENEMY_SURRENDERED", round: 2, historyIndex: 8, enemyHealth: 70, enemyMind: 100, enemySpirituality: 29, enemyStatus: "SURRENDERED" } }) }));
    const facts = screen.getByRole("region", { name: "厄运法师原费里斯与实际费用" });
    for (const text of ["原费里斯自行停止抵抗", "original-ferris-wound", "当前没有待生效厄运", "当前没有定心保护", "仍为费里斯本人的原物", "当时原敌人健康70、精神100、灵性29", "不能重新开战"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /迎战|重战|复活/ })).toBeNull();
  });

  it("shows the player's actual terminal death rather than applying medicine's recovery floor", () => {
    panel(trained({ encounter: encounter({ status: "LOST", enemyHealth: 90,
      terminal: { outcome: "PLAYER_DEAD", round: 4, historyIndex: 9, enemyHealth: 90, enemyMind: 100, enemySpirituality: 4, enemyStatus: "RESISTING" } }) }));
    const facts = screen.getByRole("region", { name: "厄运法师原费里斯与实际费用" });
    expect(facts.textContent).toContain("玩家原身体死亡"); expect(facts.textContent).toContain("本人已死亡");
    expect(screen.queryByRole("button", { name: /继续|复活|迎战/ })).toBeNull();
  });

  it("archives original Winner objects, failures and encounter without restarting them or copying its ledger", () => {
    const old: WinnerProjection = { title: "赢家旧经历", discovered: true, guidanceKnown: true, promoted: true,
      formulaKnown: false, formula: [], supplies: "第三原瓶已耗，前两瓶失败保留。", actions: [],
      bottles: [{ id: "winner-potion-1", title: "第一原瓶", source: "同一原艾妲的独立成品", status: "实际服用失败", chance: 70,
        command: { type: "CONSUME", bottleId: "winner-potion-1", confirmed: true } }],
      abilities: [{ id: "wheel.s5.luck-reserve", label: "原有限积运", mastery: 8, description: "原成功与失败均已结算。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原服药失败后果继续保留。", insideCase: false,
      cases: [{ id: "willing-aim", title: "原环的一次瞄准", story: "同一原塞拉只许可当时那次。", observations: ["原软垫实际观察"], preparation: "原付费能力", result: "保留原失败与原实际费用", status: "RESOLVED", contactOpen: "原接触已结束", closes: 2 }],
      environment: "原奥德里已有实际结局。", practice: { counter: "GUIDE", ring: "OWNER", note: "HANDED_OVER" },
      luck: { ...luck, stored: 1, spent: 4, summary: "包含后来的真实花费：累计5、花费4、剩余1。" },
      battle: { stored: 1, lastLuckRound: 2, staggerReady: false } };
    const before = structuredClone(old); render(<MisfortuneMageWinnerHistory winner={old} />);
    const history = screen.getByRole("region", { name: "赢家时期的经历" });
    for (const text of ["原艾妲·芬恩", "原成年塞拉", "WN5-COUNTER-1", "WN5-RING-1", "WN5-NOTE-1", "同一原纸已实际交回", "保留原失败", "实际服用失败", "旧回合记录不会转给新费里斯", "1 / 3", "后来的真实花费"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull(); expect(old).toEqual(before);
  });
});


describe("MisfortuneMagePanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = trained(), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["本切片新增的防患练习、有限厄运及所有序列4强化均为G延伸实践。已核低序列的被动幸运、灾难感知与精神风暴、节制积运继续继承；这不是完整原著厄运法师4。", "本阶段开放有限防患练习、有限厄运及序列4强化，具体效果以当前说明为准。低序列的被动幸运、灾难感知与精神风暴、节制积运继续继承。"],
      ["新防患练习与有限厄运的掌握从0开始；它们与本阶段加强数值均为G，不是已核原著新增能力。候选下一序列混乱行者3尚未获得。", "新防患练习与有限厄运的掌握从0开始；两项实践与本阶段加强数值以当前说明为准。下一序列混乱行者3的能力不随本阶晋升直接获得。"],
      ["原人物、物件、路线、新对手、检定、费用、有限数值与训练流程均为G。完整配方、晋升仪式、直接序列编号与完整职业技能表仍未核实，不把封印物混合表现改成普适权能。", "本场人物、物件、路线、对手、检定、费用、有限数值与训练流程以当前说明为准。当前渠道只提供独立成品，不提供完整配方；服药前仍须完成专业准备，不把封印物的混合表现当作本职业的普适能力。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
