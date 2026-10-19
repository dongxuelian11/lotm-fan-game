/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FACELESS_ABILITIES, FACELESS_CONSUMPTION_RISK, FACELESS_FORMULA, FACELESS_FORMULA_SOURCE } from "../../src/domain/faceless/content";
import type { FacelessAction, FacelessCommand, FacelessProjection } from "../../src/domain/faceless/types";
import type { MagicianProjection } from "../../src/domain/magician/types";
import { FacelessMagicianHistory, FacelessPanel } from "../../src/renderer/FacelessPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: FacelessCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): FacelessAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_FORMULA" }, "向原指导者学习无面人配方", true, "360便士 · 1行动");
function faceless(patch: Partial<FacelessProjection> = {}): FacelessProjection {
  return {
    title: "无面人晋升", discovered: true, promoted: false, formulaKnown: false,
    formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "魔术师扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk: FACELESS_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "",
    appearance: { templateId: "SELF", label: "本人原貌", voice: "本人原声", summary: "外貌与声音均为本人，尚未采用模板。", source: "本人原有外貌", heightOffsetCm: 0, persistent: false },
    outfit: { id: "FC6-PROP-COAT-1", label: "原排练道具服", location: "原衣柜", summary: "同一原物尚未借出，借出0次，归还0次。" },
    ...patch,
  };
}
function cases(): FacelessProjection["cases"] {
  return [
    { id: "stage-double", title: "获同意的替身排练", story: "成年志愿者同意本次有限示范，原道具服仍在衣柜。" },
    { id: "familiar-manner", title: "熟悉的举止", story: "熟人可以核对行为，声线相像不等于身份相同。" },
    { id: "remember-self", title: "记住本人", story: "原姓名、经历与承诺仍属于本人。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function changedAppearance(): FacelessProjection["appearance"] {
  return { templateId: "STAGE_DOUBLE", label: "成年排练替身", voice: "获同意的成年替身示范声线", summary: "沿用原排练模板，外貌和声线持续，未取得其经历或身份。", source: "亲眼观察、亲耳听过并获同意的原创成年志愿者", heightOffsetCm: 5, persistent: true };
}
function borrowedOutfit(): FacelessProjection["outfit"] {
  return { id: "FC6-PROP-COAT-1", label: "原排练道具服", location: "本人持有", summary: "原服借出1次，归还0次；本次仍由本人持有。" };
}
function bottled(): FacelessProjection {
  return faceless({ formulaKnown: true, formula: [...FACELESS_FORMULA],
    actions: ["faceless-batch-1:bottle", "faceless-batch-2:bottle"].map((bottleId) => action(
      { type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: [
      { id: "faceless-batch-1:bottle", title: "第一瓶无面人魔药", source: "第一批六项实际原料，完成五步劳务后独立调配", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "faceless-batch-1:bottle", confirmed: true } },
      { id: "faceless-batch-2:bottle", title: "第二瓶无面人魔药", source: "第二批六项实际采购原料的调配记录", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "faceless-batch-2:bottle", confirmed: true } },
    ],
  });
}
function panel(value: FacelessProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<FacelessPanel faceless={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Faceless sequence-six committed appearance, original bottles and explicit exits", () => {
  it("uses the public sequence-seven maturity gate without exposing unknown ingredients or inventing shortcuts", () => {
    const reason = "魔术师扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const value = faceless({ digestion: reason, formula: [...FACELESS_FORMULA], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "无面人成长下一步" }).textContent).toContain(reason);
    const button = screen.getByRole("button", { name: /^向原指导者学习/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("千面狩猎者脑部异变垂体")).toBeNull();
    expect(screen.queryByRole("button", { name: /直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders exactly the six known materials and distinguishes unknown source quantities from G stock", () => {
    const supplies = "原六料仍由指导者保管；本批已完成4/5步劳务，未取得材料，也未调配。";
    const { onCommand } = panel(faceless({ formulaKnown: true, formula: [...FACELESS_FORMULA], supplies, story: FACELESS_FORMULA_SOURCE }));
    const formula = within(screen.getByLabelText("无面人已知配方"));
    expect(formula.getAllByRole("listitem", { hidden: true })).toHaveLength(6);
    for (const material of FACELESS_FORMULA) expect(formula.getByText(material.name)).toBeTruthy();
    expect(formula.getAllByText("数量原文未注明")).toHaveLength(2);
    for (const amount of ["80 mL", "5 滴", "10 g", "3 根"]) expect(formula.getByText(amount)).toBeTruthy();
    expect(formula.queryByText("纯水")).toBeNull(); expect(screen.getByText(supplies)).toBeTruthy();
    expect(screen.getByText(FACELESS_FORMULA_SOURCE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("sends public labour, material, brew and resupply commands without inventing an acquired batch or bottle", async () => {
    const commands: FacelessCommand[] = [{ type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "faceless-batch-2" },
      { type: "BUY_MATERIALS", batchId: "faceless-batch-2" }, { type: "BREW", batchId: "faceless-batch-2" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["学习已知配方", "完成本批第五步劳务", "取得原六料", "调配第二批原料", "请求下一批供货", "领取实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5", "240便士 · 0行动", "80便士 · 1行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(faceless({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels original-bottle confirmation at zero AP and returns keyboard focus without sending an intent", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶无面人魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶无面人魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶无面人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶无面人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第二瓶无面人魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows actual risk, resources and source before independently confirming exactly the selected original once", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶无面人魔药」" }));
    expect(screen.getByText("faceless-batch-2:bottle")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：第二批六项实际采购原料的调配记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "无面人服用风险与四档结果" }).textContent).toContain(FACELESS_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶无面人魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "faceless-batch-2:bottle", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the identical confirmed bottle visible through save failure and waits for the external retry receipt", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶无面人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶无面人魔药」" }));
    const error = { message: "本次保存失败，可重试同一操作。", retryable: true };
    rerender(<FacelessPanel faceless={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "这瓶无面人魔药的服用确认" })).toBeTruthy();
    expect(screen.getByText("faceless-batch-1:bottle")).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶无面人魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("faceless-batch-1:bottle")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<FacelessPanel faceless={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    const committed = { ...value, promoted: true, actions: [], bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "原瓶已耗用 · 已晋升" } : bottle) };
    rerender(<FacelessPanel faceless={committed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶无面人魔药的服用确认" })).toBeNull();
    expect(screen.getByText("原瓶已耗用 · 已晋升")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("preserves a failed consumed original only as history while independently offering the remaining bottle", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶无面人魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶无面人魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<FacelessPanel faceless={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶无面人魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶无面人魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("shows persisted appearance and voice separately from real identity even after the panel is reopened", () => {
    const value = faceless({ promoted: true, actions: [], appearance: changedAppearance(), outfit: borrowedOutfit() });
    const { unmount, onCommand } = panel(value);
    const appearance = within(screen.getByRole("region", { name: "当前持续外貌与本人身份" }));
    expect(appearance.getByText(value.appearance.label)).toBeTruthy(); expect(appearance.getByText(value.appearance.voice)).toBeTruthy();
    expect(appearance.getByText(value.appearance.source)).toBeTruthy(); expect(appearance.getByText("5 厘米")).toBeTruthy();
    expect(appearance.getByText(/本人姓名、经历、记忆与真实身份仍以人物卷宗为准/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    unmount(); panel(value, onCommand);
    expect(screen.getByText(value.appearance.summary)).toBeTruthy(); expect(screen.getByText(value.outfit.summary)).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards only fixed adult-template commands and requires a committed explicit restore before returning to self", async () => {
    const change = action({ type: "CHANGE_APPEARANCE", templateId: "STAGE_DOUBLE" }, "采用获同意的成年替身外貌", true, "0行动 · 2灵性");
    const restore = action({ type: "RESTORE_SELF" }, "明确恢复本人外貌与原声", true, "0行动 · 1灵性");
    const value = faceless({ promoted: true, actions: [change] }); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^采用获同意的成年替身外貌/ }));
    expect(onCommand).toHaveBeenLastCalledWith(change.command); expect(screen.getByText(value.appearance.summary)).toBeTruthy();
    const changed = { ...value, appearance: changedAppearance(), actions: [restore] };
    rerender(<FacelessPanel faceless={changed} resources={resources} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^明确恢复本人外貌与原声/ }));
    expect(onCommand).toHaveBeenLastCalledWith(restore.command); expect(screen.getByText(changed.appearance.summary)).toBeTruthy();
    rerender(<FacelessPanel faceless={{ ...changed, appearance: value.appearance, actions: [change] }} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("本人原声")).toBeTruthy(); expect(screen.getByText(value.appearance.summary)).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("borrows and returns the same original outfit only on explicit commands and preserves its public history", async () => {
    const borrow = action({ type: "BORROW_OUTFIT", caseId: "stage-double" }, "借入这件原排练道具服", true, "0行动 · 实际借入原服");
    const giveBack = action({ type: "RETURN_OUTFIT" }, "归还同一件原排练道具服", true, "0行动 · 实际归还原服");
    const value = faceless({ promoted: true, cases: cases(), actions: [borrow] }); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^借入这件原排练道具服/ }));
    expect(onCommand).toHaveBeenLastCalledWith(borrow.command); expect(screen.getByText(value.outfit.summary)).toBeTruthy();
    const borrowed = { ...value, outfit: borrowedOutfit(), actions: [giveBack] };
    rerender(<FacelessPanel faceless={borrowed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("FC6-PROP-COAT-1")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^归还同一件原排练道具服/ }));
    expect(onCommand).toHaveBeenLastCalledWith(giveBack.command); expect(screen.getByText(borrowed.outfit.summary)).toBeTruthy();
    const returned = { ...borrowed, outfit: { ...value.outfit, summary: "原服借出1次，归还1次；同一原物已放回衣柜。" }, actions: [borrow] };
    rerender(<FacelessPanel faceless={returned} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(returned.outfit.summary)).toBeTruthy(); expect(screen.getByText("FC6-PROP-COAT-1")).toBeTruthy();
  });

  it("separates observation, ordinary preparation and execution without faking appearance, consent or success", async () => {
    const commands: FacelessCommand[] = [{ type: "OBSERVE", caseId: "stage-double" },
      { type: "PREPARE", caseId: "stage-double", method: "ORDINARY" }, { type: "PERFORM", caseId: "stage-double" },
      { type: "REPORT", caseId: "stage-double" }];
    const labels = ["核对原示范与同意", "选择普通排练方法", "实际执行本次排练", "如实报告本次尝试"];
    const value = faceless({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) });
    const { onCommand } = panel(value);
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByText(value.appearance.summary)).toBeTruthy(); expect(screen.getByText(value.outfit.summary)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "实际结果与有限报告" })).toBeNull();
    expect(screen.getByRole("region", { name: "实际观察与同意边界" }).textContent).toContain("尚无本次实际观察记录");
  });

  it("selects the actual open contact and allows public CLOSE with zero resources without reverting voice or clothes", async () => {
    const close = action({ type: "CLOSE", caseId: "familiar-manner" }, "实际结束这次熟人接触", true, "0行动 · 0精神 · 0灵性");
    const value = faceless({ promoted: true, insideCase: true, appearance: changedAppearance(), outfit: borrowedOutfit(), cases: cases().map((entry) => entry.id === "familiar-manner" ? {
      ...entry, status: "EXAMINED", observations: ["对方同意听取示范，但认出了不同的举止。"], preparation: "已采用有限原声示范。", result: "原尝试失败，熟人没有认错本人身份。", contactOpen: "尚未实际结束本次接触",
    } : entry), actions: [close] });
    const onCommand = vi.fn(); const { rerender } = render(<FacelessPanel faceless={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("familiar-manner"); expect(selector.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际结束这次熟人接触/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
    expect(screen.getByText(value.appearance.summary)).toBeTruthy(); expect(screen.getByText(value.outfit.summary)).toBeTruthy();
    const closed = { ...value, insideCase: false, actions: [action({ type: "REPORT", caseId: "familiar-manner" }, "报告原失败与识破")] };
    rerender(<FacelessPanel faceless={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^实际结束这次熟人接触/ })).toBeNull();
    expect(screen.getByText(value.appearance.voice)).toBeTruthy(); expect(screen.getByText(value.outfit.summary)).toBeTruthy();
    expect(screen.getByText("原尝试失败，熟人没有认错本人身份。")).toBeTruthy();
  });

  it("keeps zero-AP withdrawal independent of persistent appearance, voice and actual borrowed property", async () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "stage-double" }, "撤回本次准备", true, "0行动 · 0精神 · 0灵性");
    const value = faceless({ promoted: true, appearance: changedAppearance(), outfit: borrowedOutfit(), cases: cases().map((entry) => entry.id === "stage-double"
      ? { ...entry, status: "PREPARED", preparation: "已选择普通排练，尚未实际执行。" } : entry), actions: [withdraw] });
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^撤回本次准备/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByText(value.appearance.summary)).toBeTruthy(); expect(screen.getByText(value.appearance.voice)).toBeTruthy();
    expect(screen.getByText(value.outfit.summary)).toBeTruthy(); expect(screen.queryByRole("region", { name: "实际结果与有限报告" })).toBeNull();
  });

  it("respects public disabled reasons, busy state and pending save errors without using AP as a renderer gate", () => {
    const restore = { ...action({ type: "RESTORE_SELF" }, "明确复原", false, "0行动 · 1灵性"), reason: "当前灵性不足1；可先结束接触，再休养恢复。" };
    const value = faceless({ promoted: true, appearance: changedAppearance(), actions: [restore] }); const { onCommand, rerender } = panel(value);
    const button = screen.getByRole("button", { name: /^明确复原/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(screen.getByText(restore.reason)).toBeTruthy(); fireEvent.click(button);
    const enabled = { ...value, actions: [{ ...restore, enabled: true, reason: null }] };
    rerender(<FacelessPanel faceless={enabled} resources={resources} busy={true} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^明确复原/ }));
    rerender(<FacelessPanel faceless={enabled} resources={resources} busy={false} blocked onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^明确复原/ }));
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.getByText(value.appearance.summary)).toBeTruthy();
  });

  it("renders inherited and new public ability records without granting higher-sequence controls", () => {
    const inherited = { id: "diviner.s7.paper-figurine", label: "原有纸人替身", mastery: 121, description: "只使用已准备的原纸人。" };
    const abilities = [inherited, ...FACELESS_ABILITIES.map((entry, index) => ({ ...entry, mastery: index * 20 }))];
    const { onCommand } = panel(faceless({ promoted: true, actions: [], abilities, acting: 42 }));
    const records = within(screen.getByRole("region", { name: "无面人能力与消化" }));
    for (const ability of abilities) expect(records.getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(records.getByText(inherited.description)).toBeTruthy();
    expect(records.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /灵体之线|秘偶|任意NPC/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the public dispute story and its ordinary or combat choices in the selected encounter", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "当面澄清原交接误会", true, "1行动 · 普通交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担风险面对真实冲突", true, "1行动 · 可实际撤退");
    const value = faceless({ promoted: true, actions: [talk, fight], cases: [...cases(), {
      id: "faceless-dispute", title: "后门交接误会", story: "原看门人并未因为相似声线就承认交接身份。", status: "AVAILABLE",
      observations: [], preparation: null, result: null, contactOpen: "没有进行中的后门战斗", closes: 0,
    }] });
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button", { name: /^当面澄清原交接误会/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "faceless-dispute");
    const encounter = within(screen.getByRole("region", { name: "当前无面人实践" }));
    expect(encounter.getByText("原看门人并未因为相似声线就承认交接身份。")).toBeTruthy();
    await userEvent.click(encounter.getByRole("button", { name: /^当面澄清原交接误会/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^承担风险面对真实冲突/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.getByText(value.appearance.summary)).toBeTruthy();
  });

  it("keeps magician originals, failed practices, props and abilities read-only after advancement", () => {
    const magician: MagicianProjection = {
      title: "魔术师旧卷宗", discovered: true, promoted: true, formulaKnown: true,
      formula: [{ name: "迷雾树人真实根茎", quantity: 1, unit: "块" }],
      actions: [{ id: "old-action", label: "不可重做的旧实践", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
      bottles: [{ id: "old-magician-bottle", title: "魔术师原瓶", source: "原批次六料", status: "原瓶已耗用，第一次失败保留", chance: 43, command: { type: "CONSUME", bottleId: "old-magician-bottle", confirmed: true } }],
      practices: [{ id: "old-stage", title: "原幻术排练", status: "已完成", story: "原失败与后续普通核对均有记录。" }],
      abilities: [{ id: "diviner.s7.illusion", label: "原幻术", mastery: 120, description: "原视听示范不能制造物质。" }],
      supplies: { paperSheets: 7, figurinesHeld: 2, oilHeld: 1, lanternPrepared: true },
      acting: 100, digestion: "魔术师时期已完成消化。", pollution: 3, risk: "旧服药风险", story: "原排练与原材料完整保留。",
    };
    render(<FacelessMagicianHistory magician={magician} />);
    const history = within(screen.getByRole("region", { name: "魔术师时期的经历" }));
    expect(history.getByText("魔术师扮演进度 100 · 消化：魔术师时期已完成消化。")).toBeTruthy();
    for (const text of ["原失败与后续普通核对均有记录。", "来源：原批次六料", "原瓶已耗用，第一次失败保留", "7 张", "2 个", "1 份", "已经准备"])
      expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText("原幻术 · 掌握 120：原视听示范不能制造物质。")).toBeTruthy();
    expect(history.queryAllByRole("button")).toHaveLength(0); expect(history.queryByRole("combobox")).toBeNull();
  });
});
