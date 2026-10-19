/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUPPET_ABILITIES, PUPPET_CONSUMPTION_RISK } from "../../src/domain/puppet/content";
import { createPuppetEncounterState, PUPPET_ENCOUNTER_STORY, PUPPET_POWERS } from "../../src/domain/puppet/encounter";
import type { PuppetAction, PuppetCommand, PuppetProjection } from "../../src/domain/puppet/types";
import type { WraithProjection } from "../../src/domain/wraith/types";
import { PuppetPanel, PuppetWraithHistory } from "../../src/renderer/PuppetPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "身体与性别保持原状，晋升不补满灵性。";
function action(command: PuppetCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): PuppetAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取原导师的木偶指导", true, "1行动 · 540便士");
function cases(): PuppetProjection["cases"] {
  return ([
    { id: "moving-token", title: "原木片的真实往返", story: "哈伦允许移动自己同一PU4-TOKEN-1，再真实取回归还。" },
    { id: "chosen-form", title: "本人的两种形态", story: "只有同一个本人在净空工坊试验木偶与纸人。" },
    { id: "reversible-link", title: "诺兰的有限同意", story: "原成年诺兰只同意一次建立并解除联系，不同意受伤。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null,
    result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
const practice: NonNullable<PuppetProjection["practice"]> = {
  token: "同一PU4-TOKEN-1在原近端，主人仍是哈伦。", body: "同一个本人为HUMAN，原衣物仍随身体。", formState: "HUMAN",
  forms: "木偶与纸人尚未分别完成。", link: "尚未建立本次联系。", linkState: "NONE", consent: "诺兰尚未作出当次同意。",
  note: "同一PU4-NOTE-1未写，旧WF5-NOTE-1不改。", route: "本人在原门，实际走动0米。", history: [],
};
const moon: PuppetProjection["moon"] = { title: "两次有限G月圆安排", pendingWeek: null, waitedHours: 0,
  notices: [{ id: "PU4-MOON-1", week: 90, title: "第一次原告示", status: "原日期尚未到" },
    { id: "PU4-MOON-2", week: 95, title: "第二次原告示", status: "原日期尚未到" }], history: [],
  rule: "晋升后第3和第8周的两次G安排，实际延迟仍处理同一告示。" };
function puppet(patch: Partial<PuppetProjection> = {}): PuppetProjection {
  return { title: "木偶晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立原瓶，各自保留来源与去向。", bodyChange,
    inheritedTools: "原旗、原纸、原镜面与旧身体均按原结果保留。",
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "怨魂消化100，已度过12/12真实整周。",
    pollution: 3, risk: PUPPET_CONSUMPTION_RISK, cases: [], insideCase: false,
    environment: "同一原导师、原成年人和新原物，距离、期限与检定均为G。", practice: null, moon: structuredClone(moon), encounter: null, ...patch };
}
function bottled(): PuppetProjection {
  const bottles: PuppetProjection["bottles"] = [1, 2, 3].map(number => ({ id: `puppet-potion-${number}`,
    title: `第${number}瓶木偶原瓶`, source: `原导师独立封存的第${number}瓶G成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `puppet-potion-${number}`, confirmed: true } }));
  return puppet({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<PuppetProjection> = {}): PuppetProjection {
  return puppet({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: PUPPET_ABILITIES.map(ability => ({ ...ability, mastery: 0 })), ...patch });
}
function encounter(patch: Partial<NonNullable<PuppetProjection["encounter"]>> = {}): NonNullable<PuppetProjection["encounter"]> {
  return { ...createPuppetEncounterState(), name: "埃德林·维尔", story: PUPPET_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原净空工坊普通出口", pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: PUPPET_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: PuppetProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PuppetPanel puppet={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: PuppetProjection, onCommand: (command: PuppetCommand) => void) {
  return <PuppetPanel puppet={value} resources={resources} busy={false} onCommand={onCommand} />;
}
function scene(id: string, status: string): PuppetProjection["cases"] {
  return cases().map(entry => entry.id === id ? { ...entry, status } : entry);
}
afterEach(cleanup);

describe("Puppet independent bottles and committed confirmations", () => {
  it("shows the actual maturity and costs while the full formula and ritual stay unknown", () => {
    const reason = "怨魂晋升后11/12整周，尚未成熟。";
    const { onCommand } = panel(puppet({ digestion: reason, formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }],
      actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "木偶配方与成品边界" });
    for (const text of ["完整配方", "仍未知", "12真实整周", "意志难度28", "540", "6800", "5300", "1500", "下一真实周", "继续怨魂生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "木偶成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(button(learn.label).disabled).toBe(true); fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|神话变身|灵魂契约/ })).toBeNull();
  });

  it("forwards exact independent labour and payment commands with public costs", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "puppet-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 五步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "puppet-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立木偶原瓶" }), "puppet-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle and restores keyboard focus on Escape without consumption", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立木偶原瓶" }), bottle.id);
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
    const review = screen.getByRole("region", { name: "这瓶木偶魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "木偶服用风险与四档结果" }).textContent).toContain(PUPPET_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", bodyChange, "既往代价"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before); expect(confirm.disabled).toBe(true);
  });

  it("keeps the same pending submission through save failure and defers retry to the save owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<PuppetPanel puppet={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药、变形、建立联系"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶木偶魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale review when the original bottle has actually been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶木偶魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立木偶原瓶" }), "puppet-potion-1");
    expect(screen.getByText("已耗用，本次失败")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<PuppetPanel puppet={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Puppet actual original objects, body and consent", () => {
  it("separates three stories and renders public original facts without inventing mastery", async () => {
    const value = trained(); panel(value);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前木偶生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const facts = screen.getByRole("region", { name: "木偶本次原物身体与联系" });
    for (const text of [practice.token, practice.body, practice.forms, practice.link, practice.consent, practice.note, practice.route]) expect(facts.textContent).toContain(text);
    expect(screen.getByText("能力与使用范围").closest("details")?.open).toBe(false);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
    expect(screen.getByText("非生命器物影响 · 掌握 0")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "本人形态尚未实际恢复" })).toBeNull();
    expect(screen.queryByRole("region", { name: "诺兰的有限联系仍待解除" })).toBeNull();
  });

  it("forwards paid original token motion without moving or duplicating the token locally", () => {
    const perform = action({ type: "PERFORM", caseId: "moving-token" }, "尝试移动同一原木片", true, "1行动 · 3灵性 · 知识18");
    const value = trained({ cases: scene("moving-token", "PREPARED"), actions: [perform] }), before = structuredClone(value);
    const { onCommand } = panel(value); fireEvent.click(button(perform.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "木偶本次原物身体与联系" }).textContent).toContain("同一PU4-TOKEN-1在原近端");
  });

  it("offers a zero-AP real token return with no spirituality and keeps handoff blocked until committed", () => {
    const back = action({ type: "RETURN_ROUTE", caseId: "moving-token" }, "走2米取同一原物再走2米回来");
    const close = action({ type: "CLOSE", caseId: "moving-token" }, "亲手归还同一原木片", false, "0行动", "原物还在2米外，尚未走回。");
    const value = trained({ insideCase: true, cases: scene("moving-token", "EXAMINED"), actions: [back, close],
      practice: { ...practice, token: "PU4-TOKEN-1在原远端，未复制。", route: "本人仍在原近端，尚未真实走动。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "木偶成长下一步" }).textContent).toContain(back.label);
    expect(button(back.label).disabled).toBe(false); expect(button(close.label).disabled).toBe(true);
    fireEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
    expect((screen.getByRole("combobox", { name: "选择当前木偶生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(update({ ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...value.practice!, token: "同一原物已在本人手中。", route: "本人实际走完4米回到哈伦处。" } }, onCommand));
    expect(button(close.label).disabled).toBe(false); fireEvent.click(button(close.label));
    expect(onCommand.mock.calls[1]![0]).toBe(close.command);
  });

  it("shows a paid failure and next-week retry without claiming a new original token", () => {
    const retry = action({ type: "OBSERVE", caseId: "moving-token" }, "下周再观察同一原牌", false, "1行动", "本周已失败，须等下一真实周。");
    const result = "原牌仍在近端，实付的1行动与3灵性不退，尚无报告奖励。";
    panel(trained({ cases: scene("moving-token", "EXAMINED").map(entry => entry.id === "moving-token" ? { ...entry, result } : entry), actions: [retry] }));
    expect(screen.getByRole("region", { name: "木偶实际实践结果" }).textContent).toContain(result);
    expect(button(retry.label).disabled).toBe(true); expect(screen.getByText(retry.reason!)).toBeTruthy();
    expect(screen.getByRole("region", { name: "木偶本次原物身体与联系" }).textContent).toContain("同一PU4-TOKEN-1");
  });

  it("sends independent WOOD and PAPER trials and does not turn preparation into a transformation", () => {
    const wood = action({ type: "FORM_TRIAL", caseId: "chosen-form", form: "WOOD" }, "尝试自身神秘木偶形态", true, "1行动 · 3灵性");
    const paper = action({ type: "FORM_TRIAL", caseId: "chosen-form", form: "PAPER" }, "尝试自身魔法纸人形态", true, "1行动 · 3灵性");
    const value = trained({ cases: scene("chosen-form", "PREPARED"), actions: [wood, paper] }), before = structuredClone(value);
    const { onCommand } = panel(value); fireEvent.click(button(wood.label)); fireEvent.click(button(paper.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([wood.command, paper.command]); expect(value).toEqual(before);
    expect(screen.queryByRole("region", { name: "本人形态尚未实际恢复" })).toBeNull();
    expect(screen.getByRole("region", { name: "木偶本次原物身体与联系" }).textContent).toContain("两种");
  });

  it.each(["WOOD", "PAPER"] as const)("preserves the same %s body until real zero-AP route and restoration commit", form => {
    const back = action({ type: "RETURN_FORM_ROUTE", caseId: "chosen-form" }, "本人走到原垫再走回原门");
    const restore = action({ type: "RESTORE_FORM", caseId: "chosen-form" }, "恢复同一个本人", false, "0行动", "本人尚未完成原4米路线。");
    const value = trained({ insideCase: true, cases: scene("chosen-form", "PREPARED"), actions: [back, restore],
      practice: { ...practice, formState: form, body: `同一本人当前${form}，原衣物随身。` } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    const pending = screen.getByRole("region", { name: "本人形态尚未实际恢复" });
    for (const text of ["同一个身体", "0灵性", "不是分身", "实际4米"]) expect(pending.textContent).toContain(text);
    expect(button(back.label).disabled).toBe(false); expect(button(restore.label).disabled).toBe(true);
    fireEvent.click(button(back.label)); expect(value).toEqual(before); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command);
    rerender(update({ ...value, actions: [{ ...restore, enabled: true, reason: null }], practice: { ...value.practice!, route: "同一本人已走完原4米路线。" } }, onCommand));
    expect(button(restore.label).disabled).toBe(false); fireEvent.click(button(restore.label));
    expect(onCommand.mock.calls[1]![0]).toBe(restore.command);
    expect(screen.getByRole("region", { name: "本人形态尚未实际恢复" })).toBeTruthy();
  });

  it("keeps an ordinary inspection ordinary and offers close when another paid trial is unavailable", () => {
    const paper = action({ type: "FORM_TRIAL", caseId: "chosen-form", form: "PAPER" }, "继续纸人试验", false, "1行动 · 3灵性", "当前灵性不足3。");
    const close = action({ type: "CLOSE", caseId: "chosen-form" }, "结束本次本人试验");
    const value = trained({ insideCase: true, cases: scene("chosen-form", "PREPARED"), actions: [paper, close],
      practice: { ...practice, forms: "木偶已成功并恢复；纸人尚未成功。" } });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "木偶成长下一步" }).textContent).toContain(close.label);
    expect(button(paper.label).disabled).toBe(true); expect(button(close.label).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "本人的两种形态" }).textContent).toContain("普通检查只观察");
    fireEvent.click(button(close.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("forwards real consent withdrawal without changing Nolan's link or handing off paper optimistically", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "reversible-link" }, "听诺兰撤回本次同意");
    const close = action({ type: "CLOSE", caseId: "reversible-link" }, "解除联系并交回原纸");
    const value = trained({ insideCase: true, cases: scene("reversible-link", "EXAMINED"), actions: [withdraw, close],
      practice: { ...practice, linkState: "LINKED", link: "当前只有同一诺兰的有限联系。", consent: "只同意建立并解除，没有同意受伤。", note: "PU4-NOTE-1已写，尚未交回。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "诺兰的有限联系仍待解除" }).textContent).toContain("没有同意受伤");
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "诺兰的有限联系仍待解除" })).toBeTruthy();
    rerender(update({ ...value, actions: [close], practice: { ...value.practice!, linkState: "RELEASED", link: "同一联系因本人实际撤回而解除。", consent: "诺兰本人已实际撤回。" } }, onCommand));
    expect(screen.queryByRole("region", { name: "诺兰的有限联系仍待解除" })).toBeNull();
    expect(screen.getByRole("region", { name: "木偶本次原物身体与联系" }).textContent).toContain("尚未交回");
    expect(button(close.label).disabled).toBe(false); fireEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
  });

  it("advances case selection only when the real report is committed", () => {
    const report = action({ type: "REPORT", caseId: "moving-token" }, "提交真实原物报告", true, "1行动");
    const observe = action({ type: "OBSERVE", caseId: "chosen-form" }, "观察本人原试验场", true, "1行动");
    const value = trained({ cases: scene("moving-token", "EXAMINED"), actions: [report, observe] });
    const { onCommand, rerender } = panel(value); fireEvent.click(button(report.label));
    expect((screen.getByRole("combobox", { name: "选择当前木偶生活实践" }) as HTMLSelectElement).value).toBe("moving-token");
    rerender(update({ ...value, cases: scene("moving-token", "RESOLVED"), actions: [observe] }, onCommand));
    expect((screen.getByRole("combobox", { name: "选择当前木偶生活实践" }) as HTMLSelectElement).value).toBe("chosen-form");
  });
});

describe("Puppet finite G moon notices", () => {
  it("prioritizes the same pending notice and forwards a zero-AP real six-hour wait", () => {
    const guarded = action({ type: "HANDLE_MOON", method: "GUARDED" }, "由原哈伦看守并等待6小时", true, "0行动 · 至多8精神");
    const alone = action({ type: "HANDLE_MOON", method: "ALONE" }, "独自等待同一6小时", true, "0行动 · 至多16精神");
    const value = trained({ insideCase: true, moon: { ...moon, pendingWeek: 90 }, actions: [guarded, alone] }), before = structuredClone(value);
    const { onCommand } = panel(value); expect(screen.getByRole("region", { name: "木偶成长下一步" }).textContent).toContain(guarded.label);
    const facts = screen.getByRole("region", { name: "木偶有限月圆安排" });
    for (const text of ["PU4-MOON-1", "PU4-MOON-2", "第90周", "第95周", "以下仅有两次有限安排", "不是天文月相公式", "不会自动续生第三次", "实际等待 0 小时"]) expect(facts.textContent).toContain(text);
    expect(button(guarded.label).disabled).toBe(false); fireEvent.click(button(guarded.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(guarded.command); expect(value).toEqual(before);
    expect(facts.textContent).toContain("实际等待 0 小时");
  });

  it("shows absence of the original guide and retains both actual completed waits without new actions", () => {
    const guarded = action({ type: "HANDLE_MOON", method: "GUARDED" }, "请原哈伦看守", false, "0行动", "原哈伦只在贝克兰德，当前位置不在。");
    const alone = action({ type: "HANDLE_MOON", method: "ALONE" }, "独自实际等待6小时");
    const { rerender, onCommand } = panel(trained({ moon: { ...moon, pendingWeek: 90 }, actions: [guarded, alone] }));
    expect(button(guarded.label).disabled).toBe(true); expect(screen.getByText(guarded.reason!)).toBeTruthy(); expect(button(alone.label).disabled).toBe(false);
    rerender(update(trained({ moon: { ...moon, waitedHours: 12, history: ["PU4-MOON-1实际等待6小时，消耗8精神。", "PU4-MOON-2迟到后仍实际等待6小时，消耗16精神。"] } }), onCommand));
    const facts = screen.getByRole("region", { name: "木偶有限月圆安排" });
    expect(facts.textContent).toContain("实际等待 12 小时"); expect(facts.textContent).toContain("迟到后仍实际等待6小时");
    expect(within(facts).queryByRole("button")).toBeNull();
  });
});
describe("Puppet original opponent and archival boundaries", () => {
  it("requires a cancellable one-submit fight review, distinct from each potion", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原埃德林真实冲突", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [fight] }), { onCommand } = panel(value);
    await userEvent.click(button(fight.label)); expect(onCommand).not.toHaveBeenCalled();
    const review = screen.getByRole("region", { name: "木偶真实迎战确认" });
    for (const text of ["埃德林·维尔", "40点有限灵性", "3灵性", "4灵性", "默认不启用诅咒", "完整10点轻伤或30点重伤", "本人死亡优先", "原贝文不复活", "原诺兰的生活同意不适用于伤害"]) expect(review.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "这瓶木偶魔药的服用确认" })).toBeNull();
    await userEvent.click(button("暂不迎战")); expect(onCommand).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button(fight.label));
    await userEvent.click(button(fight.label)); const confirm = button("确认风险"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(confirm.disabled).toBe(true);
  });

  it("dismisses a stale fight review when original opponent resources actually change", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "准备迎战原埃德林", true, "1行动");
    const value = trained({ encounter: encounter(), actions: [fight] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(fight.label));
    rerender(update({ ...value, encounter: encounter({ status: "RETREATED" }), actions: [] }, onCommand));
    expect(screen.queryByRole("region", { name: "木偶真实迎战确认" })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "木偶原埃德林与实际联系" }).textContent).toContain("本人已沿原出口离开");
  });

  it("forwards the one actual 60p block purchase and never resets spent original objects", () => {
    const purchase = action({ type: "PURCHASE_BLOCKS" }, "买下唯一三块原木块", true, "0行动 · 60便士");
    const { onCommand, rerender } = panel(trained({ encounter: encounter(), actions: [purchase] }));
    expect(button(purchase.label).disabled).toBe(false); fireEvent.click(button(purchase.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(purchase.command);
    expect(screen.getByRole("region", { name: "木偶战斗原木块" }).textContent).toContain("尚未买下");
    rerender(update(trained({ encounter: encounter({ blocksPurchased: true, blocks: [
      { id: "PU4-BLOCK-1", status: "SPENT", location: "TARGET_GROUND", usedRound: 1 },
      { id: "PU4-BLOCK-2", status: "READY", location: "SOURCE", usedRound: null },
      { id: "PU4-BLOCK-3", status: "READY", location: "SOURCE", usedRound: null },
    ] }) }), onCommand));
    const facts = screen.getByRole("region", { name: "木偶战斗原木块" });
    for (const text of ["PU4-BLOCK-1", "TARGET_GROUND", "实际第1回合使用", "PU4-BLOCK-2", "原箱内待用", "不能再次购买补满"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /买下/ })).toBeNull();
  });

  it("shows attempts, remaining finite powers and actual wounds without fabricating reflection", () => {
    panel(trained({ encounter: encounter({ status: "FIGHTING", enemySpirituality: 24, link: "LINKED", linkRound: 2,
      contactAttempts: 2, formAttempts: 1, contactDistanceMetres: 4, breakLinkUses: 1,
      powerUses: { ARC_BOLT: 2, WARD: 1, BREAK_LINK: 1 }, form: "WOOD" }) }));
    const facts = screen.getByRole("region", { name: "木偶原埃德林与实际联系" });
    for (const text of ["24 / 40", "PU4-EDRIN-VALE", "本人当前为木偶诅咒源", "原建立回合：2", "实际接触尝试 2 次", "形态尝试 1 次", "累计 4 米", "尚无实际受伤触发的反映记录", "完整伤害与原伤势不会"]) expect(facts.textContent).toContain(text);
  });

  it("retains actual full self-damage and the differently tolerated enemy wound after terminal cleanup", () => {
    panel(trained({ encounter: encounter({ status: "RESOLVED", enemyHealth: 35, enemySpirituality: 12, enemyStatus: "SURRENDERED",
      form: "HUMAN", link: "NONE", linkRound: 2, contactAttempts: 1, formAttempts: 1, contactDistanceMetres: 2,
      reflectionHistory: [{ round: 3, severity: "HEAVY", playerDamage: 30, enemyDamage: 15, playerInjuryId: "original-player-wound", enemyInjuryId: "original-edrin-wound" }],
      enemyInjuries: [{ id: "original-edrin-wound", severity: "HEAVY", acquiredRevision: 400, treatedRevision: null }],
      terminal: { outcome: "ENEMY_SURRENDERED", round: 3, historyIndex: 8, enemyHealth: 35, enemyMind: 100, enemySpirituality: 12, enemyStatus: "SURRENDERED" } }) }));
    const facts = screen.getByRole("region", { name: "木偶原埃德林与实际联系" });
    for (const text of ["本人实际承受30点重伤", "原埃德林承受15点", "original-player-wound", "original-edrin-wound", "本人实际为人形", "当前没有有效联系", "原战斗第3回合结束", "原埃德林自行停止抵抗", "当时原敌人健康35、精神100、灵性12"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /迎战|重战|复活/ })).toBeNull();
  });

  it("preserves both original deaths when the player dies despite a reflected enemy death", () => {
    panel(trained({ encounter: encounter({ status: "LOST", enemyHealth: 0, enemyStatus: "DEAD", form: "HUMAN", link: "NONE",
      terminal: { outcome: "PLAYER_DEAD", round: 4, historyIndex: 9, enemyHealth: 0, enemyMind: 100, enemySpirituality: 4, enemyStatus: "DEAD" } }) }));
    const facts = screen.getByRole("region", { name: "木偶原埃德林与实际联系" });
    expect(facts.textContent).toContain("玩家原身体死亡"); expect(facts.textContent).toContain("同一原身体已死亡");
    expect(screen.queryByRole("button", { name: /继续|复活|迎战/ })).toBeNull();
  });

  it("archives original S5 body, host, mirrors, objects, failures and moon costs with no new actions", () => {
    const old: WraithProjection = { title: "怨魂旧经历", discovered: true, guidanceKnown: true, promoted: true,
      formulaKnown: false, formula: [], supplies: "第三原瓶已耗，前两瓶失败保留。", actions: [],
      bottles: [{ id: "wraith-potion-1", title: "第一原瓶", source: "同一原哈伦的独立成品", status: "实际服用失败", chance: 70,
        command: { type: "CONSUME", bottleId: "wraith-potion-1", confirmed: true } }],
      abilities: [{ id: "chained.s5.reflection-step", label: "原反射端点", mastery: 8, description: "原成功与失败均已结算。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原服药失败后果继续保留。", insideCase: false,
      cases: [{ id: "reflected-room", title: "原镜面往返", story: "同一原哈伦揭开原两面镜。", observations: ["原4米端点实际观察"], preparation: "原付费能力", result: "保留原第一次失败与后续真实往返", status: "RESOLVED", contactOpen: "原接触已结束", closes: 2 }],
      environment: "原贝文已有实际结局。", practice: { form: "HUMAN", node: "ROOM", mirror: "COVERED", host: "SELF", flag: "TABLE", note: "HANDED_OVER" },
      moon: { pending: false, summary: "原怨魂阶段月圆历史全部保留。", history: [{ week: 74, method: "GUARDED", mentalCost: 10 }, { week: 78, method: "ALONE", mentalCost: 18 }] },
      battle: { lastPossessionRound: 2, staggerReady: false } };
    const before = structuredClone(old); render(<PuppetWraithHistory wraith={old} />);
    const history = screen.getByRole("region", { name: "怨魂时期的经历" });
    for (const text of ["原哈伦·维斯", "原成年诺兰", "原两面镜均已盖好", "本人未附在诺兰身上", "WF5-FLAG-1", "同一原纸已实际交回", "保留原第一次失败", "实际服用失败", "第74周", "原实际精神消耗10", "第78周", "原实际精神消耗18", "不能转给新埃德林"]) expect(history.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull(); expect(old).toEqual(before);
  });
});


describe("PuppetPanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = trained(), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["木偶特有诅咒的精确原著机制仍未知；以下两次安排是本作G替代体验，不是天文月相公式，也不再自动执行怨魂吸取灵魂的旧机制。", "以下仅有两次有限安排，不是天文月相公式，也不再自动执行怨魂吸取灵魂的旧机制。"],
      ["操纵非生物器物、把自己化为神秘木偶或魔法纸人、通过建立的联系成为诅咒之源属于来源支持的类别；本作的距离、期限、费用、检定与伤害数值均为G，不是完整原著技能表。新掌握从0开始。", "当前可有限操纵非生物器物、把自身化为神秘木偶或魔法纸人，并通过已建立的联系成为诅咒之源；距离、期限、费用、检定与伤害数值以当前说明为准。新掌握从0开始。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
