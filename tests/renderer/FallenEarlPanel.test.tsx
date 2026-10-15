/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLEN_EARL_ABILITIES, FALLEN_EARL_CONSUMPTION_RISK } from "../../src/domain/fallen-earl/content";
import { createFallenEarlEncounterState, FALLEN_EARL_ENCOUNTER_STORY, FALLEN_EARL_POWERS } from "../../src/domain/fallen-earl/encounter";
import type { FallenEarlAction, FallenEarlCommand, FallenEarlProjection } from "../../src/domain/fallen-earl/types";
import type { MentorDisorderProjection } from "../../src/domain/mentor-disorder/types";
import { FallenEarlPanel, FallenEarlMentorDisorderHistory } from "../../src/renderer/FallenEarlPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "身体与性别保持原状，晋升不补满灵性。";
function action(command: FallenEarlCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): FallenEarlAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取原导师的堕落伯爵指导", true, "1行动 · 540便士");
function cases(): FallenEarlProjection["cases"] {
  return ([
    { id: "willing-pause", title: "伊芙重新同意的一次暂停", story: "同一原成年伊芙在原书桌旁只许可一次有限心理状态试验。" },
    { id: "own-push", title: "本人推动同一原轻木箱", story: "原导师的FE4-CRATE-1只受本人这一次实际推力。" },
    { id: "short-rise", title: "本人已经开始的低跳上升", story: "同一身体在原FE4-PAD-1起跳再真实落地。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null,
    result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
const practice: NonNullable<FallenEarlProjection["practice"]> = {
  clerk: "同一原伊芙仍在原书桌旁，当前没有负面心理状态。", consent: "伊芙尚未同意这一次心理状态试验。",
  crate: "同一FE4-CRATE-1在原0米处，归原导师。", pad: "同一FE4-PAD-1在原0米处，本人已经落地。",
  route: "本次实际等待0秒、普通取还0米。", history: [],
};
function fallenEarl(patch: Partial<FallenEarlProjection> = {}): FallenEarlProjection {
  return { title: "堕落伯爵 · 序列4 · 有限G实践", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立原瓶，各自保留来源与去向。", bodyChange,
    inheritedTools: "原红蓝筹、原路线、原纸与唯一原赠物库存继续保留。",
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "混乱导师消化100，已度过12/12真实整周。",
    pollution: 3, risk: FALLEN_EARL_CONSUMPTION_RISK, cases: [], insideCase: false,
    environment: "同一原导师、原成年人和新原物，距离、期限与检定均为G。", practice: null, encounter: null, gifts: { held: 5, given: 7, battleGround: 0, summary: "原贿赂者同一库存，购买三件60便士。" }, ...patch };
}
function bottled(): FallenEarlProjection {
  const bottles: FallenEarlProjection["bottles"] = [1, 2, 3].map(number => ({ id: `fallen-earl-potion-${number}`,
    title: `第${number}瓶堕落伯爵原瓶`, source: `原导师独立封存的第${number}瓶G成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `fallen-earl-potion-${number}`, confirmed: true } }));
  return fallenEarl({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<FallenEarlProjection> = {}): FallenEarlProjection {
  return fallenEarl({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: FALLEN_EARL_ABILITIES.map(ability => ({ ...ability, mastery: 0 })), ...patch });
}
function encounter(patch: Partial<NonNullable<FallenEarlProjection["encounter"]>> = {}): NonNullable<FallenEarlProjection["encounter"]> {
  return { ...createFallenEarlEncounterState(), name: "马洛·文恩", story: FALLEN_EARL_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原契约铺外院普通出口", pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: FALLEN_EARL_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: FallenEarlProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<FallenEarlPanel fallenEarl={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: FallenEarlProjection, onCommand: (command: FallenEarlCommand) => void) {
  return <FallenEarlPanel fallenEarl={value} resources={resources} busy={false} onCommand={onCommand} />;
}
function scene(id: string, status: string): FallenEarlProjection["cases"] {
  return cases().map(entry => entry.id === id ? { ...entry, status } : entry);
}
afterEach(cleanup);

describe("FallenEarl independent bottles and committed confirmations", () => {
  it("shows the actual maturity and costs while the full formula and ritual stay unknown", () => {
    const reason = "混乱导师晋升后11/12整周，尚未成熟。";
    const { onCommand } = panel(fallenEarl({ digestion: reason, formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }],
      actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "堕落伯爵配方与成品边界" });
    for (const text of ["完整配方", "完整配方与晋升仪式细节尚未掌握。", "12真实整周", "意志难度28", "540", "6800", "5300", "1500", "下一真实周", "继续混乱导师生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(button(learn.label).disabled).toBe(true); fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|神话变身|灵魂契约/ })).toBeNull();
  });

  it("forwards exact independent labour and payment commands with public costs", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "fallen-earl-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 五步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "fallen-earl-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立堕落伯爵原瓶" }), "fallen-earl-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle and restores keyboard focus on Escape without consumption", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立堕落伯爵原瓶" }), bottle.id);
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
    const review = screen.getByRole("region", { name: "这瓶堕落伯爵魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "堕落伯爵服用风险与四档结果" }).textContent).toContain(FALLEN_EARL_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", bodyChange, "既往代价"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before); expect(confirm.disabled).toBe(true);
  });

  it("keeps the same pending submission through save failure and defers retry to the save owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<FallenEarlPanel fallenEarl={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药、施用、等待"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶堕落伯爵魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale review when the original bottle has actually been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶堕落伯爵魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立堕落伯爵原瓶" }), "fallen-earl-potion-1");
    expect(screen.getByText("已耗用，本次失败")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<FallenEarlPanel fallenEarl={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Fallen Earl finite original-person and object practice", () => {
  it("shows finite S4 limits, professional preparation and three zero-mastery abilities", () => {
    panel(trained());
    const boundary = screen.getByRole("region", { name: "堕落伯爵能力范围" });
    for (const text of ["赠予负面心理状态", "放大自身行为", "利用已有状态", "晋升须取得独立成品并完成专业准备", "费用、持续时间与检定条件", "没有独立心智的死秘偶不适用", "不把对象原有负面状态设为统一施用前提", "本切片的放大限于自身行为", "利用必须针对已有状态", "任意时间停止", "免费神话形态"]) expect(boundary.textContent).toContain(text);
    for (const ability of FALLEN_EARL_ABILITIES) expect(screen.getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" }).textContent).toContain("当前灵性 0 / 120");
    expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" }).textContent).toContain("堕落伯爵4");
    expect(screen.getByRole("region", { name: "堕落伯爵能力与消化" }).textContent).toContain("下一序列狂乱法师3尚未获得");
    expect(screen.getByText("能力与使用范围").closest("details")?.open).toBe(false);
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("shows all three distinct practices and only committed original-person and object facts", async () => {
    const value = trained(); const before = structuredClone(value); const { onCommand } = panel(value);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前堕落伯爵生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const facts = screen.getByRole("region", { name: "堕落伯爵本次原人原物与实际收束" });
    for (const text of [practice.clerk, practice.consent, practice.crate, practice.pad, practice.route]) expect(facts.textContent).toContain(text);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["ABILITY", "ORDINARY"] as const)("forwards %s preparation while the original clerk remains free of a new effect", method => {
    const prepare = action({ type: "PREPARE", caseId: "willing-pause", method }, `准备${method}一次自愿暂停`, true, "1行动");
    const value = trained({ cases: scene("willing-pause", "OBSERVED"), actions: [prepare] });
    const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(prepare.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command);
    expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "堕落伯爵本次原人原物与实际收束" }).textContent).toContain("当前没有负面心理状态");
    expect((screen.getByRole("combobox", { name: "选择当前堕落伯爵生活实践" }) as HTMLSelectElement).disabled).toBe(false);
  });

  it("withdraws the clerk's current consent before performance without inventing an effect or fee", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "willing-pause" }, "伊芙撤回这一次同意");
    const perform = action({ type: "PERFORM", caseId: "willing-pause" }, "实施这一次赠予", false, "1行动 · 4灵性", "本人已撤回本次同意。");
    const value = trained({ cases: scene("willing-pause", "PREPARED"), actions: [withdraw, perform] });
    const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(button(perform.label).disabled).toBe(true); expect(value).toEqual(before);
    const details = screen.getByText("已观察的事实与本次方法边界").closest("details")!;
    expect(details.textContent).toContain("施用前撤回不施用、不收施用费");
  });

  it("does not instantly erase a paid psychological state on withdrawal and waits real remaining time before closing", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "willing-pause" }, "撤回伊芙的本次同意");
    const wait = action({ type: "WAIT_RECOVERY", caseId: "willing-pause" }, "实际等待余下30秒");
    const close = action({ type: "CLOSE", caseId: "willing-pause" }, "核实伊芙自主恢复并结束接触", false, "0行动", "原心理状态仍有30秒。");
    const value = trained({ insideCase: true, cases: scene("willing-pause", "EXAMINED"), actions: [withdraw, wait, close],
      practice: { ...practice, clerk: "原伊芙仍在原书桌旁，LACK_ENTHUSIASM剩余30秒。", consent: "仅本次同意。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" }).textContent).toContain(wait.label);
    expect((screen.getByRole("combobox", { name: "选择当前堕落伯爵生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(value).toEqual(before);
    const withdrawn = { ...value, actions: [wait, close], practice: { ...value.practice!, consent: "伊芙已撤回，不再施加新影响。" } };
    rerender(update(withdrawn, onCommand)); expect(screen.getByRole("region", { name: "堕落伯爵本次原人原物与实际收束" }).textContent).toContain("LACK_ENTHUSIASM剩余30秒");
    expect(button(close.label).disabled).toBe(true); fireEvent.click(button(wait.label));
    expect(onCommand.mock.calls[1]![0]).toBe(wait.command);
    expect(screen.getByRole("region", { name: "堕落伯爵本次原人原物与实际收束" }).textContent).toContain("剩余30秒");
    rerender(update({ ...withdrawn, actions: [{ ...close, enabled: true, reason: null }],
      practice: { ...withdrawn.practice, clerk: "实际经过30秒，原伊芙自然恢复，仍自主留在原书桌旁。", route: "本次实际等待30秒。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[2]![0]).toBe(close.command);
  });

  it("keeps resisted and ordinary outcomes distinct without treating voluntary rest as mental influence", () => {
    const close = action({ type: "CLOSE", caseId: "willing-pause" }, "确认原伊芙仍自主并关闭本次接触");
    const value = trained({ insideCase: true, cases: scene("willing-pause", "EXAMINED").map(entry => entry.id === "willing-pause"
      ? { ...entry, result: "RESISTED：本次付4灵性，未产生心理状态；失败保留。" } : entry), actions: [close] });
    const { onCommand, rerender } = panel(value); expect(button(close.label).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "堕落伯爵实际实践结果" }).textContent).toContain("RESISTED");
    rerender(update({ ...value, cases: value.cases.map(entry => entry.id === "willing-pause"
      ? { ...entry, result: "普通方法：伊芙本人自由选择暂停，0灵性，不产生魔法状态。" } : entry) }, onCommand));
    expect(screen.getByRole("region", { name: "堕落伯爵实际实践结果" }).textContent).toContain("本人自由选择暂停");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("returns the same actually moved crate over the ordinary two-metre route before closing", () => {
    const back = action({ type: "RETURN_CRATE", caseId: "own-push" }, "走1米抱原箱再走1米返回");
    const close = action({ type: "CLOSE", caseId: "own-push" }, "交回同一原轻箱", false, "0行动", "同一原箱尚在1米处。");
    const value = trained({ insideCase: true, cases: scene("own-push", "EXAMINED"), actions: [back, close],
      practice: { ...practice, crate: "同一FE4-CRATE-1已从0米推至1米，尚未实际取回。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" }).textContent).toContain(back.label);
    expect(button(close.label).disabled).toBe(true); fireEvent.click(button(back.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "堕落伯爵本次原人原物与实际收束" }).textContent).toContain("尚未实际取回");
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }],
      practice: { ...value.practice!, crate: "同一FE4-CRATE-1已抱回原0米处，待亲手交还。", route: "本人普通走去1米，再抱箱走回1米，共2米。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
    expect(screen.getByRole("region", { name: "堕落伯爵本次原人原物与实际收束" }).textContent).toContain("共2米");
  });

  it("shows a failed unmoved crate at the same origin without fabricating distance or refund", () => {
    const close = action({ type: "CLOSE", caseId: "own-push" }, "归还未移动的原箱");
    const value = trained({ insideCase: true, cases: scene("own-push", "EXAMINED").map(entry => entry.id === "own-push"
      ? { ...entry, result: "放大失败，4灵性已耗；原箱仍在0米，实际取还0米。" } : entry), actions: [close] });
    panel(value);
    expect(button(close.label).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "堕落伯爵实际实践结果" }).textContent).toContain("实际取还0米");
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")!.textContent).toContain("原箱未移动便不虚构取还距离");
  });

  it.each([{ state: "IN_AIR_EXTENDED", seconds: 4 }, { state: "IN_AIR_ORDINARY", seconds: 1 }])("lands $state only after its real $seconds seconds, even with no AP or spirituality", ({ state, seconds }) => {
    const land = action({ type: "LAND", caseId: "short-rise" }, `实际经过余下${seconds}秒并落回原垫`);
    const close = action({ type: "CLOSE", caseId: "short-rise" }, "收好并交回同一原垫", false, "0行动", "本人尚未实际落地。");
    const value = trained({ insideCase: true, cases: scene("short-rise", "EXAMINED"), actions: [land, close],
      practice: { ...practice, pad: `同一FE4-PAD-1下无高台，本人${state}，剩余${seconds}秒。` } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" }).textContent).toContain(land.label);
    expect(button(land.label).disabled).toBe(false); expect(button(close.label).disabled).toBe(true);
    fireEvent.click(button(land.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(land.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "堕落伯爵本次原人原物与实际收束" }).textContent).toContain(state);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }],
      practice: { ...value.practice!, pad: "同一身体与原鞋已落回同一0米FE4-PAD-1，原垫尚未交还。", route: `本次实际经过${seconds}秒。` } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
  });

  it("selects the next case only after its previous report has committed", () => {
    const report = action({ type: "REPORT", caseId: "willing-pause" }, "提交伊芙实际恢复后的报告", true, "1行动");
    const observe = action({ type: "OBSERVE", caseId: "own-push" }, "观察导师同一原箱", true, "1行动");
    const value = trained({ cases: scene("willing-pause", "EXAMINED"), actions: [report, observe] });
    const { onCommand, rerender } = panel(value); fireEvent.click(button(report.label));
    expect((screen.getByRole("combobox", { name: "选择当前堕落伯爵生活实践" }) as HTMLSelectElement).value).toBe("willing-pause");
    rerender(update({ ...value, cases: scene("willing-pause", "RESOLVED"), actions: [observe] }, onCommand));
    expect((screen.getByRole("combobox", { name: "选择当前堕落伯爵生活实践" }) as HTMLSelectElement).value).toBe("own-push");
  });
});

describe("Fallen Earl actual opponent and read-only original history", () => {
  it("requires one cancellable confirmation for the real fight without a winner policy or pre-spending gifts", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入马洛的原外院冲突", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [fight] }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(fight.label)); expect(onCommand).not.toHaveBeenCalled();
    const review = screen.getByRole("region", { name: "堕落伯爵真实迎战确认" });
    for (const text of ["马洛·文恩", "40点有限灵性", "知识18", "另付3灵性凝神", "从1次延长为2次", "最多延长一次", "旧里斯不复活", "真实战斗规则"]) expect(review.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "这瓶堕落伯爵魔药的服用确认" })).toBeNull(); expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(button("暂不迎战")); expect(onCommand).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button(fight.label));
    await userEvent.click(button(fight.label)); const confirm = button("确认风险"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(confirm.disabled).toBe(true); expect(value).toEqual(before);
  });

  it("purchases three original gift IDs through the exact command without optimistically refilling the old inventory", () => {
    const buy = action({ type: "BUY_GIFTS" }, "实际购买三件新编号原赠物", true, "0行动 · 60便士");
    const value = trained({ actions: [buy], gifts: { held: 2, given: 10, battleGround: 3, summary: "同一原库存：实际已给10件，其中3件留在马洛原战场。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    const facts = screen.getByRole("region", { name: "堕落伯爵同一原赠物库存" });
    for (const text of ["2 件", "10 件", "3 件", "60便士", "不自动归还"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(buy.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(buy.command); expect(value).toEqual(before);
    expect(facts.textContent).toContain("2 件");
    rerender(update({ ...value, gifts: { ...value.gifts, held: 5 } }, onCommand));
    expect(screen.getByRole("region", { name: "堕落伯爵同一原赠物库存" }).textContent).toContain("5 件");
  });

  it("dismisses a stale fight review after the same opponent snapshot changes", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "准备迎战原马洛", true, "1行动");
    const value = trained({ encounter: encounter(), actions: [fight] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(fight.label));
    rerender(update({ ...value, encounter: encounter({ status: "RETREATED" }), actions: [] }, onCommand));
    expect(screen.queryByRole("region", { name: "堕落伯爵真实迎战确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "堕落伯爵原马洛与实际费用" }).textContent).toContain("本人已沿原出口离开");
  });

  it("shows real remaining enemy resources, paid abilities and the current bounded effect", () => {
    const value = trained({ encounter: encounter({ status: "FIGHTING", enemySpirituality: 32,
      bestowAttempts: 2, magnifyUses: 3, exploitUses: 1, bestowReady: true, composureReady: false,
      powerUses: { ARC_BOLT: 1, WARD: 1, COMPOSE: 0 } }) });
    const { onCommand, rerender } = panel(value);
    const facts = screen.getByRole("region", { name: "堕落伯爵原马洛与实际费用" });
    for (const text of ["FE4-MARLOW-VENN", "32 / 40", "FE4-MARLOW-CLUB", "未传给玩家", "实际付费赠予尝试 2 次", "本人击打放大 3 次", "原赠物状态延长 1 次", "只等待本轮下一次实际正向身体或弧光贡献", "当前没有凝神保护", "未用临时状态在回合末到期"]) expect(facts.textContent).toContain(text);
    rerender(update({ ...value, encounter: encounter({ ...value.encounter!, enemySpirituality: 29,
      bestowReady: false, composureReady: true, powerUses: { ARC_BOLT: 1, WARD: 1, COMPOSE: 1 } }) }, onCommand));
    const composed = screen.getByRole("region", { name: "堕落伯爵原马洛与实际费用" });
    for (const text of ["29 / 40", "当前没有待生效赠予", "当前回合抵抗新的赠予", "保护只到本轮末"]) expect(composed.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /抢棍|补灵|必胜|重掷/ })).toBeNull();
  });

  it("keeps surrender, the same club, real wounds and the finite final resources visible", () => {
    panel(trained({ encounter: encounter({ status: "RESOLVED", enemyHealth: 70, enemySpirituality: 29, enemyStatus: "SURRENDERED",
      bestowReady: false, composureReady: false, bestowAttempts: 2, magnifyUses: 3, exploitUses: 1,
      enemyInjuries: [{ id: "original-marlow-wound", severity: "HEAVY", acquiredRevision: 400, treatedRevision: null }],
      terminal: { outcome: "ENEMY_SURRENDERED", round: 2, historyIndex: 8, enemyHealth: 70, enemyMind: 100, enemySpirituality: 29, enemyStatus: "SURRENDERED" } }) }));
    const facts = screen.getByRole("region", { name: "堕落伯爵原马洛与实际费用" });
    for (const text of ["原马洛自行停止抵抗", "original-marlow-wound", "当前没有待生效赠予", "当前没有凝神保护", "仍为马洛本人的原物", "当时原敌人健康70、精神100、灵性29", "不能重新开战"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /迎战|重战|复活/ })).toBeNull();
  });

  it("shows the player's actual death without applying medicine's recovery floor", () => {
    panel(trained({ encounter: encounter({ status: "LOST", enemyHealth: 90,
      terminal: { outcome: "PLAYER_DEAD", round: 4, historyIndex: 9, enemyHealth: 90, enemyMind: 100, enemySpirituality: 4, enemyStatus: "RESISTING" } }) }));
    const facts = screen.getByRole("region", { name: "堕落伯爵原马洛与实际费用" });
    expect(facts.textContent).toContain("玩家原身体死亡"); expect(facts.textContent).toContain("本人已死亡");
    expect(screen.queryByRole("button", { name: /继续|复活|迎战/ })).toBeNull();
  });

  it("shows original S5 stories, objects, failed bottles and one gift inventory with no replay controls", () => {
    const old: MentorDisorderProjection = { title: "混乱导师旧经历", discovered: true, guidanceKnown: true, promoted: true,
      formulaKnown: false, formula: [], supplies: "第三原瓶已耗，前两瓶失败保留。", actions: [],
      bottles: [{ id: "mentor-disorder-potion-1", title: "第一原瓶", source: "同一原米蕾的独立成品", status: "实际服用失败", chance: 70,
        command: { type: "CONSUME", bottleId: "mentor-disorder-potion-1", confirmed: true } }],
      abilities: [{ id: "black-emperor.s5.disorder", label: "原有限混乱", mastery: 8, description: "原成功与失败均已结算。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原服药失败后果继续保留。", insideCase: false,
      cases: [{ id: "paired-trays", title: "原红蓝筹的实际轨迹", story: "同一原米蕾只许可当时那次。", observations: ["原封边软盘实际观察"], preparation: "原付费能力", result: "保留原失败与原实际费用", status: "RESOLVED", contactOpen: "原接触已结束", closes: 2 }],
      environment: "原里斯冲突已有实际结局。", practice: { markers: "SORTED", route: "FREE", note: "HANDED_OVER" },
      gifts: { held: 5, given: 7, summary: "原BR7-GIFT-1至7已给出，8至12仍由本人实际持有。" } };
    const before = structuredClone(old); render(<FallenEarlMentorDisorderHistory mentorDisorder={old} />);
    const history = screen.getByRole("region", { name: "混乱导师时期的经历" });
    for (const text of ["米蕾·沃德", "原核册员伊芙", "原成年赛恩", "MD5-RED-1", "MD5-BLUE-1", "MD5-ROUTE-MARKER", "MD5-NOTE-1", "同一原纸已实际交回", "保留原失败", "实际服用失败", "没有第二份礼物", "仍持有 5 件", "已实际给出 7 件", "旧里斯"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull(); expect(old).toEqual(before);
  });
});
