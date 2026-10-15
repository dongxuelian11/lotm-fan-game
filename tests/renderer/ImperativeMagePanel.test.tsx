/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IMPERATIVE_MAGE_ABILITIES, IMPERATIVE_MAGE_CONSUMPTION_RISK } from "../../src/domain/imperative-mage/content";
import { createImperativeMageEncounterState, IMPERATIVE_MAGE_ENCOUNTER_STORY, IMPERATIVE_MAGE_POWERS } from "../../src/domain/imperative-mage/encounter";
import type { ImperativeMageAction, ImperativeMageCommand, ImperativeMageProjection } from "../../src/domain/imperative-mage/types";
import type { PunishmentKnightProjection } from "../../src/domain/punishment-knight/types";
import { ImperativeMagePanel, ImperativeMagePunishmentKnightHistory } from "../../src/renderer/ImperativeMagePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "身体与性别保持原状，晋升不补满灵性。";
function action(command: ImperativeMageCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): ImperativeMageAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取原导师的律令法师指导", true, "1行动 · 540便士");
function cases(): ImperativeMageProjection["cases"] {
  return ([
    { id: "willing-attention", title: "阿伦重新同意的有限注意", story: "同一原成年阿伦在原椅与原桌旁只许可当次注意试验。" },
    { id: "one-borrowed-light", title: "同一原FLASH的暂剥与恢复", story: "原成年戏法大师埃尔登·维尔先用自己的FLASH照亮原卡。" },
    { id: "equal-line", title: "约束双方的同一条线", story: "同一原阿伦与本人接受相同有限条件，再普通取还原木牌。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null,
    result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
const practice: NonNullable<ImperativeMageProjection["practice"]> = {
  attention: "原成年阿伦在原椅旁自由注意，没有待结束影响。", consent: "原人在每次试验前重新同意。",
  partner: "原IM4-ELDEN-VALE埃尔登·维尔是成年序列8戏法大师，实际灵性12/12，原FLASH可用。",
  light: "原IM4-CARD-1和IM4-HOOD-1在1米外原桌，FLASH尚未试验。",
  line: "原IM4-LINE-1已收起，原IM4-TOKEN-1归原导师，没有存续禁令。",
  route: "本次实际等待0秒、普通取还0米。", history: [],
};
function imperativeMage(patch: Partial<ImperativeMageProjection> = {}): ImperativeMageProjection {
  return { title: "律令法师 · 序列4 · 有限G实践", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立原瓶，各自保留来源与去向。", bodyChange,
    inheritedTools: "旧软靶、旧标线与原纸继续保留。",
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "惩戒骑士消化100，已度过12/12真实整周。",
    pollution: 3, risk: IMPERATIVE_MAGE_CONSUMPTION_RISK, cases: [], insideCase: false,
    environment: "同一原导师、原成年人和新原物，距离、期限与检定均为G。", practice: null, encounter: null, ...patch };
}
function bottled(): ImperativeMageProjection {
  const bottles: ImperativeMageProjection["bottles"] = [1, 2, 3].map(number => ({ id: `imperative-mage-potion-${number}`,
    title: `第${number}瓶律令法师原瓶`, source: `原导师独立封存的第${number}瓶G成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `imperative-mage-potion-${number}`, confirmed: true } }));
  return imperativeMage({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<ImperativeMageProjection> = {}): ImperativeMageProjection {
  return imperativeMage({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: IMPERATIVE_MAGE_ABILITIES.map(ability => ({ ...ability, mastery: 0 })), ...patch });
}
function encounter(patch: Partial<NonNullable<ImperativeMageProjection["encounter"]>> = {}): NonNullable<ImperativeMageProjection["encounter"]> {
  return { ...createImperativeMageEncounterState(), name: "罗温·凯尔", story: IMPERATIVE_MAGE_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原调解处外院普通出口", pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: IMPERATIVE_MAGE_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: ImperativeMageProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ImperativeMagePanel imperativeMage={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: ImperativeMageProjection, onCommand: (command: ImperativeMageCommand) => void) {
  return <ImperativeMagePanel imperativeMage={value} resources={resources} busy={false} onCommand={onCommand} />;
}
function scene(id: string, status: string): ImperativeMageProjection["cases"] {
  return cases().map(entry => entry.id === id ? { ...entry, status } : entry);
}
afterEach(cleanup);

describe("ImperativeMage independent bottles and committed confirmations", () => {
  it("shows the actual maturity and costs while the full formula and ritual stay unknown", () => {
    const reason = "惩戒骑士晋升后11/12整周，尚未成熟。";
    const { onCommand } = panel(imperativeMage({ digestion: reason, formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }],
      actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "律令法师配方与成品边界" });
    for (const text of ["完整配方", "完整配方与晋升仪式细节尚未掌握。", "12真实整周", "意志难度28", "540", "6800", "5300", "1500", "下一真实周", "继续惩戒骑士生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(button(learn.label).disabled).toBe(true); fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|神话变身|灵魂契约/ })).toBeNull();
  });

  it("forwards exact independent labour and payment commands with public costs", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "imperative-mage-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 五步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "imperative-mage-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立律令法师原瓶" }), "imperative-mage-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle and restores keyboard focus on Escape without consumption", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立律令法师原瓶" }), bottle.id);
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
    const review = screen.getByRole("region", { name: "这瓶律令法师魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "律令法师服用风险与四档结果" }).textContent).toContain(IMPERATIVE_MAGE_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", bodyChange, "既往代价"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before); expect(confirm.disabled).toBe(true);
  });

  it("keeps the same pending submission through save failure and defers retry to the save owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<ImperativeMagePanel imperativeMage={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药、施用、等待"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶律令法师魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale review when the original bottle has actually been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶律令法师魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立律令法师原瓶" }), "imperative-mage-potion-1");
    expect(screen.getByText("已耗用，本次失败")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<ImperativeMagePanel imperativeMage={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Imperative Mage finite original-person and object practice", () => {
  it("shows bounded authority, temporary deprivation and two zero-mastery abilities", () => {
    panel(trained());
    const boundary = screen.getByRole("region", { name: "律令法师能力范围" });
    for (const text of ["威严与暂时剥夺能力不保证对任意对象成功", "晋升须取得独立成品并完成专业准备", "费用、持续时间与检定条件", "威严不是强迫供出真相或证明犯罪", "暂剥不是永久删除、复制或学会对方能力", "不能当作律令法师全职业的固定上限", "不授官方身份", "不开放一句必死、任意改写世界或免费神话形态"]) expect(boundary.textContent).toContain(text);
    expect(IMPERATIVE_MAGE_ABILITIES).toHaveLength(2);
    for (const ability of IMPERATIVE_MAGE_ABILITIES) expect(screen.getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain("当前灵性 0 / 120");
    expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain("律令法师4");
    expect(screen.getByRole("region", { name: "律令法师能力与消化" }).textContent).toContain("下一序列混乱猎手3尚未获得");
  });

  it("displays committed participant resources and original objects without inventing an action", () => {
    const value = trained(), before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "律令法师本次原人原物与实际收束" });
    for (const text of [practice.attention, practice.partner, practice.light, practice.line, practice.consent, practice.route]) expect(facts.textContent).toContain(text);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["ABILITY", "ORDINARY"] as const)("forwards exact %s preparation while the original participant remains free", method => {
    const prepare = action({ type: "PREPARE", caseId: "willing-attention", method }, `准备${method}有限注意试验`, true, "1行动");
    const value = trained({ cases: scene("willing-attention", "OBSERVED"), actions: [prepare] });
    const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(prepare.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command);
    expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "律令法师本次原人原物与实际收束" }).textContent).toContain("自由注意");
    expect((screen.getByRole("combobox", { name: "选择当前律令法师生活实践" }) as HTMLSelectElement).disabled).toBe(false);
  });

  it("keeps the original person's three-second residue after withdrawal until actual release commits", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "willing-attention" }, "阿伦撤回本次同意");
    const release = action({ type: "RELEASE_ATTENTION", caseId: "willing-attention" }, "实际经过剩余3秒并释放注意");
    const close = action({ type: "CLOSE", caseId: "willing-attention" }, "核实阿伦自由并结束原接触", false, "0行动", "原注意影响仍有3秒。");
    const value = trained({ insideCase: true, cases: scene("willing-attention", "EXAMINED"), actions: [withdraw, release, close],
      practice: { ...practice, attention: "原阿伦仍在原椅旁，ATTENTION_HELD剩余3秒。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain(release.label);
    expect((screen.getByRole("combobox", { name: "选择当前律令法师生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(value).toEqual(before);
    const withdrawn = { ...value, actions: [release, close], practice: { ...value.practice!, consent: "阿伦已撤回，只停止新增影响。" } };
    rerender(update(withdrawn, onCommand)); expect(button(close.label).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "律令法师本次原人原物与实际收束" }).textContent).toContain("剩余3秒");
    fireEvent.click(button(release.label)); expect(onCommand.mock.calls[1]![0]).toBe(release.command);
    rerender(update({ ...withdrawn, actions: [{ ...close, enabled: true, reason: null }],
      practice: { ...withdrawn.practice, attention: "实际经过3秒，原阿伦在原椅旁恢复自由注意。", route: "实际等待3秒。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[2]![0]).toBe(close.command);
  });

  it("shows resisted and voluntary attention outcomes without turning ordinary consent into magic", () => {
    const value = trained({ cases: scene("willing-attention", "EXAMINED").map(entry => entry.id === "willing-attention"
      ? { ...entry, result: "RESISTED：实付4灵性，0秒，没有注意影响。" } : entry) });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "律令法师实际实践结果" }).textContent).toContain("RESISTED");
    rerender(update({ ...value, cases: value.cases.map(entry => entry.id === "willing-attention"
      ? { ...entry, result: "普通方法0灵性，原阿伦自主ATTENTIVE，不产生魔法。" } : entry) }, onCommand));
    expect(screen.getByRole("region", { name: "律令法师实际实践结果" }).textContent).toContain("自主ATTENTIVE");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("recommends checking the same deprived FLASH before restoration and preserves real resource evidence", () => {
    const check = action({ type: "CHECK_LIGHT", caseId: "one-borrowed-light" }, "检验原FLASH是否实际受阻");
    const restore = action({ type: "RESTORE_LIGHT", caseId: "one-borrowed-light" }, "实际经过10秒并重现同一FLASH");
    const close = action({ type: "CLOSE", caseId: "one-borrowed-light" }, "普通往返2米交回原卡与原罩", false, "0行动", "原能力尚待恢复。");
    const value = trained({ insideCase: true, cases: scene("one-borrowed-light", "EXAMINED"), actions: [restore, check, close],
      practice: { ...practice, partner: "同一埃尔登原灵性10/12，基线FLASH实付2灵性。", light: "同一原FLASH暂不可用10秒，原卡与罩仍在1米处。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain(check.label);
    fireEvent.click(button(check.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(check.command); expect(value).toEqual(before);
    const checked = { ...value, actions: [restore, close], practice: { ...value.practice!, light: "原FLASH实际BLOCKED，本次检验消耗0灵性。" } };
    rerender(update(checked, onCommand)); expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain(restore.label);
    fireEvent.click(button(restore.label)); expect(onCommand.mock.calls[1]![0]).toBe(restore.command);
    rerender(update({ ...checked, actions: [{ ...close, enabled: true, reason: null }], practice: { ...checked.practice,
      partner: "同一埃尔登实际灵性8/12。", light: "实际经过10秒，原FLASH恢复可用并实付2灵性LIT同一卡。" } }, onCommand));
    expect(screen.getByRole("region", { name: "律令法师本次原人原物与实际收束" }).textContent).toContain("8/12");
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[2]![0]).toBe(close.command);
  });

  it("never calls exhaustion successful deprivation and offers ordinary rest only through its committed command", async () => {
    const rest = action({ type: "PARTNER_REST" }, "同一埃尔登普通休息6小时", true, "1行动 · 伙伴恢复6灵性，上限12");
    const value = trained({ cases: scene("one-borrowed-light", "OBSERVED"), actions: [rest],
      practice: { ...practice, partner: "同一原伙伴灵性0/12，FLASH可用，但没有施法资源。", light: "先前检验EXHAUSTED，恢复NO_RESOURCE，不是剥夺成功证据。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前律令法师生活实践" }), "one-borrowed-light");
    const facts = screen.getByRole("region", { name: "律令法师本次原人原物与实际收束" });
    expect(facts.textContent).toContain("NO_RESOURCE"); expect(facts.textContent).toContain("0/12");
    fireEvent.click(button(rest.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(rest.command); expect(value).toEqual(before);
    expect(facts.textContent).toContain("0/12");
    rerender(update({ ...value, actions: [{ ...rest, enabled: false, reason: "本真实周已经休息。" }], practice: { ...value.practice!, partner: "同一原伙伴实际休息6小时，灵性6/12，FLASH仍是本人的原能力。" } }, onCommand));
    expect(button(rest.label).disabled).toBe(true);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")!.textContent).toContain("不恢复玩家资源");
  });

  it("allows withdrawal from short-resource preparation without pretending it refills the original partner", () => {
    const withdraw = action({ type: "WITHDRAW", caseId: "one-borrowed-light" }, "撤回尚未施用的光案准备");
    const perform = action({ type: "PERFORM", caseId: "one-borrowed-light" }, "实际进行光案试验", false, "1行动 · 4灵性", "原伙伴灵性不足6。");
    const value = trained({ cases: scene("one-borrowed-light", "PREPARED"), actions: [withdraw, perform],
      practice: { ...practice, partner: "同一埃尔登原灵性4/12，原FLASH可用。" } });
    const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(button(perform.label).disabled).toBe(true); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "律令法师本次原人原物与实际收束" }).textContent).toContain("4/12");
  });

  it("removes the same bilateral rule before actual ordinary return with the same original token", () => {
    const remove = action({ type: "REMOVE_RULE", caseId: "equal-line" }, "解除双方禁令并普通取还原木牌");
    const close = action({ type: "CLOSE", caseId: "equal-line" }, "交还同一原标线与木牌", false, "0行动", "双方原禁令仍待解除。");
    const value = trained({ insideCase: true, cases: scene("equal-line", "EXAMINED"), actions: [remove, close],
      practice: { ...practice, line: "BOTH_CROSS：本人和原阿伦真实各跨2米，原IM4-TOKEN-1仍在原桌。", route: "本人2米，阿伦2米；失败实付3灵性。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain(remove.label);
    fireEvent.click(button(remove.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(remove.command); expect(value).toEqual(before);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...value.practice!,
      line: "同一原IM4-LINE-1收起，原IM4-TOKEN-1已普通带回，没有存续禁令。", route: "本人实际共4米，原阿伦实际共4米。" } }, onCommand));
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
    expect(screen.getByRole("region", { name: "律令法师本次原人原物与实际收束" }).textContent).toContain("没有存续禁令");
  });

  it("moves to the next case only after the actual previous report is committed", () => {
    const report = action({ type: "REPORT", caseId: "willing-attention" }, "提交原有限注意报告", true, "1行动");
    const observe = action({ type: "OBSERVE", caseId: "one-borrowed-light" }, "观察同一原FLASH与当次许可", true, "1行动");
    const value = trained({ cases: scene("willing-attention", "EXAMINED"), actions: [report, observe] });
    const { onCommand, rerender } = panel(value); fireEvent.click(button(report.label));
    expect((screen.getByRole("combobox", { name: "选择当前律令法师生活实践" }) as HTMLSelectElement).value).toBe("willing-attention");
    rerender(update({ ...value, cases: scene("willing-attention", "RESOLVED"), actions: [observe] }, onCommand));
    expect((screen.getByRole("combobox", { name: "选择当前律令法师生活实践" }) as HTMLSelectElement).value).toBe("one-borrowed-light");
  });
});

describe("Imperative Mage original opponent and read-only S5 history", () => {
  it("requires one cancellable confirmation for the real fight without inventing an ability or guaranteed result", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原罗温的外院冲突", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [fight] }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(fight.label)); expect(onCommand).not.toHaveBeenCalled();
    const review = screen.getByRole("region", { name: "律令法师真实迎战确认" });
    for (const text of ["罗温·凯尔", "40点有限灵性", "IM4-ROWAN-CLUB", "知识18", "原ARC恢复可用", "旧迪恩不复活", "真实战斗规则"]) expect(review.textContent).toContain(text);
    expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(button("暂不迎战")); expect(onCommand).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button(fight.label));
    await userEvent.click(button(fight.label)); const confirm = button("确认风险"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(confirm.disabled).toBe(true); expect(value).toEqual(before);
  });

  it("dismisses a stale fight review when the same original opponent's committed state changes", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "准备迎战原罗温", true, "1行动");
    const value = trained({ encounter: encounter(), actions: [fight] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(fight.label));
    rerender(update({ ...value, encounter: encounter({ status: "RETREATED" }), actions: [] }, onCommand));
    expect(screen.queryByRole("region", { name: "律令法师真实迎战确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "律令法师原罗温与实际费用" }).textContent).toContain("本人已沿原出口离开");
  });

  it("shows actual costs, deprived ARC, fallback BODY and the original actor's limited composure", () => {
    const value = trained({ encounter: encounter({ status: "FIGHTING", enemySpirituality: 32,
      intimidationAttempts: 2, deprivationAttempts: 3, punishmentUses: 1, intimidationReady: true, deprivationReady: true, composureReady: false }) });
    const { onCommand, rerender } = panel(value);
    const facts = screen.getByRole("region", { name: "律令法师原罗温与实际费用" });
    for (const text of ["IM4-ROWAN-KELL", "32 / 40", "IM4-ROWAN-CLUB", "未传给玩家", "威慑尝试 2 次", "暂剥尝试 3 次", "惩戒强化 1 次", "本轮暂不可用", "真实BODY", "当前没有凝神保护"]) expect(facts.textContent).toContain(text);
    rerender(update({ ...value, encounter: encounter({ ...value.encounter!, enemySpirituality: 29,
      intimidationReady: false, deprivationReady: false, composureReady: true }) }, onCommand));
    const composed = screen.getByRole("region", { name: "律令法师原罗温与实际费用" });
    for (const text of ["29 / 40", "当前没有待生效威慑", "未被暂剥", "当前回合抵抗新的威慑与暂剥", "保护只到本轮末"]) expect(composed.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /抢棍|补灵|必胜|重掷/ })).toBeNull();
  });

  it("retains actual surrender, original wounds, the same club and final resource costs", () => {
    panel(trained({ encounter: encounter({ status: "RESOLVED", enemyHealth: 70, enemySpirituality: 29, enemyStatus: "SURRENDERED",
      enemyInjuries: [{ id: "original-rowan-wound", severity: "HEAVY", acquiredRevision: 400, treatedRevision: null }],
      terminal: { outcome: "ENEMY_SURRENDERED", round: 2, historyIndex: 8, enemyHealth: 70, enemyMind: 100, enemySpirituality: 29, enemyStatus: "SURRENDERED" } }) }));
    const facts = screen.getByRole("region", { name: "律令法师原罗温与实际费用" });
    for (const text of ["原罗温自行停止抵抗", "original-rowan-wound", "当前没有待生效威慑", "仍为罗温本人的原物", "当时原敌人健康70、精神100、灵性29", "不能重新开战"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /迎战|重战|复活/ })).toBeNull();
  });

  it("shows original S5 cases, objects, failures and outcomes with no replay controls", () => {
    const old: PunishmentKnightProjection = { title: "惩戒骑士旧经历", discovered: true, guidanceKnown: true, promoted: true,
      formulaKnown: false, formula: [], supplies: "原瓶已耗，失败仍保留。", actions: [],
      bottles: [{ id: "punishment-knight-potion-1", title: "第一原瓶", source: "同一原薇娜的独立成品", status: "实际服用失败", chance: 70,
        command: { type: "CONSUME", bottleId: "punishment-knight-potion-1", confirmed: true } }],
      abilities: [{ id: "justiciar.s5.punishment", label: "原有限惩戒", mastery: 8, description: "原成功与失败均已结算。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原服药失败后果继续保留。", insideCase: false,
      cases: [{ id: "breach-and-pad", title: "原软靶上的有限惩戒", story: "同一原阿伦只许可当时那次。", observations: ["原地面线实际观察"], preparation: "原付费能力", result: "保留原失败与原实际费用", status: "RESOLVED", contactOpen: "原接触已结束", closes: 2 }],
      environment: "原迪恩冲突已有实际结局。", practice: { pad: "STAND", partner: "FREE", rule: "NONE", note: "HANDED_OVER" } };
    const before = structuredClone(old); render(<ImperativeMagePunishmentKnightHistory punishmentKnight={old} />);
    const history = screen.getByRole("region", { name: "惩戒骑士时期的经历" });
    for (const text of ["薇娜·贝尔", "原成年阿伦", "PK5-SOFT-PAD-1", "PK5-LINE-1", "PK5-NOTE-1", "同一原纸已实际交回", "保留原失败", "实际服用失败", "旧迪恩"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull(); expect(old).toEqual(before);
  });
});
