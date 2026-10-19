/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVIL_ABILITIES, DEVIL_CONSUMPTION_RISK } from "../../src/domain/devil/content";
import { createDevilEncounterState, DEVIL_ENCOUNTER_STORY, DEVIL_POWERS } from "../../src/domain/devil/encounter";
import type { DevilAction, DevilCommand, DevilProjection } from "../../src/domain/devil/types";
import type { DesireApostleProjection } from "../../src/domain/desire-apostle/types";
import { DevilPanel, DevilDesireApostleHistory } from "../../src/renderer/DevilPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "身体与性别保持原状，晋升不补满灵性。";
function action(command: DevilCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): DevilAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取原导师的魔鬼指导", true, "1行动 · 540便士");
function cases(): DevilProjection["cases"] {
  return ([
    { id: "stage-decision", title: "米蕾尔自己的节目", story: "同一成年米蕾尔自己选了新短篇，持自己的原节目单并同意一次有限试验。" },
    { id: "returned-invitation", title: "蕾娜退回的邀请", story: "同一成年蕾娜平静地核对原邀请，自由拒绝后将原纸放在1米外原架。" },
    { id: "bounded-account", title: "原导师的有限报告", story: "在原导师自己的同一便条上只写实际发生的结果，保留可能失败。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null,
    result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
const practice: NonNullable<DevilProjection["practice"]> = {
  emotion: "当次情绪尚未公开观察，不能读取隐藏思想。", seedState: "NONE", seedSummary: "没有本次原种子。",
  consent: "米蕾尔尚未作出当次同意。", program: "同一DV4-PROGRAM-1仍在米蕾尔自己手中。",
  invitation: "同一DV4-INVITATION-1仍在原导师处。", route: "本人在GUIDE原位置，实际走动0米。",
  account: "原导师自己的DV4-NOTE-1尚未填写；旧DA5-LEDGER-1不改。", history: [],
};
function devil(patch: Partial<DevilProjection> = {}): DevilProjection {
  return { title: "魔鬼晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立原瓶，各自保留来源与去向。", bodyChange,
    inheritedTools: "原旧账册与便条已收束，不赠长笛或免费契约。", strain: 2,
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "欲望使徒消化100，已度过12/12真实整周。",
    pollution: 3, risk: DEVIL_CONSUMPTION_RISK, cases: [], insideCase: false,
    environment: "同一原导师、原成年人和新原物，距离、期限与检定均为G。", practice: null, encounter: null, ...patch };
}
function bottled(): DevilProjection {
  const bottles: DevilProjection["bottles"] = [1, 2, 3].map(number => ({ id: `devil-potion-${number}`,
    title: `第${number}瓶魔鬼原瓶`, source: `原导师独立封存的第${number}瓶G成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `devil-potion-${number}`, confirmed: true } }));
  return devil({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<DevilProjection> = {}): DevilProjection {
  return devil({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: DEVIL_ABILITIES.map(ability => ({ ...ability, mastery: 0 })), ...patch });
}
function encounter(patch: Partial<NonNullable<DevilProjection["encounter"]>> = {}): NonNullable<DevilProjection["encounter"]> {
  return { ...createDevilEncounterState(), name: "奥里克·费恩", story: DEVIL_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原净空附院的普通出口", pursuit: false, distanceMetres: 4, noBystanders: true,
    abilities: DEVIL_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: DevilProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DevilPanel devil={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: DevilProjection, onCommand: (command: DevilCommand) => void) {
  return <DevilPanel devil={value} resources={resources} busy={false} onCommand={onCommand} />;
}
function scene(id: string, status: string): DevilProjection["cases"] {
  return cases().map(entry => entry.id === id ? { ...entry, status } : entry);
}
afterEach(cleanup);

describe("Devil independent bottles and committed confirmations", () => {
  it("shows the actual maturity and costs while the full formula and ritual stay unknown", () => {
    const reason = "欲望使徒晋升后11/12整周，尚未成熟。";
    const { onCommand } = panel(devil({ digestion: reason, formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }],
      actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "魔鬼配方与成品边界" });
    for (const text of ["完整配方", "仍未知", "12真实整周", "意志难度28", "540", "6800", "5300", "1500", "下一真实周", "继续欲望使徒生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "魔鬼成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(button(learn.label).disabled).toBe(true); fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|神话变身|灵魂契约/ })).toBeNull();
  });

  it("forwards exact independent labour and payment commands with public costs", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "devil-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 五步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "devil-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立魔鬼原瓶" }), "devil-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle and restores keyboard focus on Escape without consumption", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立魔鬼原瓶" }), bottle.id);
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
    const review = screen.getByRole("region", { name: "这瓶魔鬼魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "魔鬼服用风险与四档结果" }).textContent).toContain(DEVIL_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", bodyChange, "良知代价"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before); expect(confirm.disabled).toBe(true);
  });

  it("keeps the same pending submission through save failure and defers retry to the save owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<DevilPanel devil={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药、埋种、催化"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶魔鬼魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale review when the original bottle has actually been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶魔鬼魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立魔鬼原瓶" }), "devil-potion-1");
    expect(screen.getByText("已耗用，本次失败")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<DevilPanel devil={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Devil paid seed, consent and original ordinary records", () => {
  it("separates three stories and folds source detail while showing public original facts", async () => {
    const value = trained(); panel(value);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前魔鬼生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const facts = screen.getByRole("region", { name: "魔鬼本次原物与实际情绪" });
    for (const text of [practice.emotion, practice.seedSummary, practice.consent, practice.program, practice.invitation, practice.route, practice.account]) expect(facts.textContent).toContain(text);
    expect(screen.getByText("能力与使用范围").closest("details")?.open).toBe(false);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
    expect(screen.getByText("欲望聚焦（原创G） · 掌握 0")).toBeTruthy();
    const abilities = screen.getByRole("region", { name: "魔鬼能力与消化" });
    for (const text of ["新掌握从0开始", "只有实际成功的对应付费催化实践", "收束并报告后各增8一次", "本阶段没有获得更高序列或原初恶魔的能力"]) expect(abilities.textContent).toContain(text);
  });

  it("does not turn PREPARED into a planted seed or invent a catalysis button", () => {
    const perform = action({ type: "PERFORM", caseId: "stage-decision" }, "实际付费埋种", true, "1行动 · 4灵性 · 知识18");
    const value = trained({ cases: scene("stage-decision", "PREPARED"), actions: [perform] }), before = structuredClone(value);
    const { onCommand } = panel(value); expect(screen.queryByRole("region", { name: "已付费原种子仍待催化" })).toBeNull();
    expect(screen.queryByRole("button", { name: /继续催化/ })).toBeNull(); fireEvent.click(button(perform.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command); expect(value).toEqual(before);
    expect(screen.queryByRole("region", { name: "已付费原种子仍待催化" })).toBeNull();
  });

  it("marks an actual paid PLANTED seed as unfinished and sends the separate catalyst", () => {
    const catalyze = action({ type: "CATALYZE", caseId: "stage-decision" }, "继续催化同一原种子", true, "0行动 · 3灵性 · 知识18");
    const close = action({ type: "CLOSE", caseId: "stage-decision" }, "结束并等待原窗口到期");
    const value = trained({ insideCase: true, cases: scene("stage-decision", "PREPARED"), actions: [catalyze, close],
      practice: { ...practice, seedState: "PLANTED", seedSummary: "同一原种子已经实付4灵性埋下，尚未催化。", emotion: "原米蕾尔对自己选择的朗读公开兴奋。", consent: "只同意这一次有限试验。" } });
    const before = structuredClone(value), { onCommand } = panel(value);
    const pending = screen.getByRole("region", { name: "已付费原种子仍待催化" });
    for (const text of ["尚未结算催化、报告或掌握奖励", "3灵性", "无论成败", "撤回同意", "60秒"]) expect(pending.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "魔鬼成长下一步" }).textContent).toContain(catalyze.label);
    expect((screen.getByRole("combobox", { name: "选择当前魔鬼生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(catalyze.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(catalyze.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "已付费原种子仍待催化" })).toBeTruthy();
  });

  it("keeps zero-AP close available when catalysis lacks spirituality", () => {
    const catalyze = action({ type: "CATALYZE", caseId: "stage-decision" }, "继续催化原种子", false, "0行动 · 3灵性", "当前灵性不足3，不能免费催化。");
    const close = action({ type: "CLOSE", caseId: "stage-decision" }, "结束并等完原60秒窗口");
    const { onCommand } = panel(trained({ insideCase: true, cases: scene("stage-decision", "PREPARED"), actions: [catalyze, close], practice: { ...practice, seedState: "PLANTED" } }));
    expect(button(catalyze.label).disabled).toBe(true); expect(button(close.label).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "魔鬼成长下一步" }).textContent).toContain(close.label);
    fireEvent.click(button(close.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command);
  });

  it("forwards withdrawal of consent without pretending closure or mutating the original program", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "stage-decision" }, "听米蕾尔撤回当次同意");
    const close = action({ type: "CLOSE", caseId: "stage-decision" }, "实际结束原接触");
    const value = trained({ insideCase: true, cases: scene("stage-decision", "PREPARED"), actions: [withdraw, close], practice: { ...practice, seedState: "PLANTED" } });
    const { onCommand, rerender } = panel(value); fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    expect(screen.getByRole("region", { name: "已付费原种子仍待催化" })).toBeTruthy();
    rerender(update({ ...value, actions: [close], practice: { ...practice, seedState: "EXPIRED", seedSummary: "因本人实际撤回而失效。", emotion: "本人已实际平静。", consent: "当次同意已明确撤回。" } }, onCommand));
    expect(screen.queryByRole("region", { name: "已付费原种子仍待催化" })).toBeNull();
    expect(screen.getByRole("region", { name: "魔鬼本次原物与实际情绪" }).textContent).toContain("当次同意已明确撤回");
    expect(screen.getByText(practice.program)).toBeTruthy(); expect(button(close.label).disabled).toBe(false);
    expect((screen.getByRole("combobox", { name: "选择当前魔鬼生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
  });

  it("shows calm Reina's disabled ability reason and retains the real one-metre return", () => {
    const ability = action({ type: "PREPARE", caseId: "returned-invitation", method: "ABILITY" }, "查看对原蕾娜的能力入口", false, "不可施术", "原蕾娜平静，没有强烈情绪入口。");
    const back = action({ type: "RETURN_ROUTE", caseId: "returned-invitation" }, "带同一原邀请走1米返回导师");
    const close = action({ type: "CLOSE", caseId: "returned-invitation" }, "归还原邀请并结束交谈", false, "0行动", "本人仍在原架前。");
    const value = trained({ insideCase: true, cases: scene("returned-invitation", "EXAMINED"), actions: [ability, back, close],
      practice: { ...practice, invitation: "蕾娜已自行拒绝，DV4-INVITATION-1由本人在原架取回。", route: "本人在SHELF，已走1米，尚未实际返回。" } });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(button(ability.label).disabled).toBe(true); expect(screen.getByText(ability.reason!)).toBeTruthy();
    expect(screen.getByRole("region", { name: "魔鬼成长下一步" }).textContent).toContain(back.label);
    fireEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "魔鬼本次原物与实际情绪" }).textContent).toContain("尚未实际返回"); expect(button(close.label).disabled).toBe(true);
  });

  it("keeps a failed invitation's original refusal and cost instead of claiming a fresh invitation", () => {
    const observe = action({ type: "OBSERVE", caseId: "returned-invitation" }, "下周核对同一退回邀请记录", false, "1行动", "本周已经实际尝试，须等下一真实周。");
    const result = "本次检定失败，原蕾娜的拒绝与本人已走2米的事实保留。";
    panel(trained({ cases: scene("returned-invitation", "EXAMINED").map(entry => entry.id === "returned-invitation" ? { ...entry, result } : entry), actions: [observe],
      practice: { ...practice, invitation: "DV4-INVITATION-1已标记拒绝，回到原导师手中。", route: "本人已沿原1米路线走回，共实际2米。" } }));
    expect(screen.getByRole("region", { name: "魔鬼实际实践结果" }).textContent).toContain(result);
    expect(button(observe.label).disabled).toBe(true); expect(screen.getByText(observe.reason!)).toBeTruthy();
  });

  it("prefers a limited account, permits the real wrong statement, then corrects the same paper", () => {
    const wrong = action({ type: "CONFIRM_ACCOUNT", caseId: "bounded-account", claim: "GUARANTEED" }, "声称能力必然成功");
    const limited = action({ type: "CONFIRM_ACCOUNT", caseId: "bounded-account", claim: "LIMITED" }, "只确认所见与可能失败");
    const value = trained({ insideCase: true, cases: scene("bounded-account", "EXAMINED"), actions: [wrong, limited],
      practice: { ...practice, account: "原DV4-NOTE-1已实际填写，尚未交回或获认可。" } });
    const { onCommand, rerender } = panel(value);
    const summary = screen.getByRole("region", { name: "魔鬼成长下一步" }); expect(summary.textContent).toContain(limited.label); expect(summary.textContent).not.toContain(wrong.label);
    fireEvent.click(button(wrong.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(wrong.command);
    expect(screen.getByRole("region", { name: "魔鬼本次原物与实际情绪" }).textContent).toContain("尚未交回或获认可");
    rerender(update({ ...value, actions: [limited], practice: { ...practice, account: "导师明确拒绝必然成功的陈述，原DV4-NOTE-1保留原错误。" } }, onCommand));
    expect(screen.getByRole("region", { name: "魔鬼本次原物与实际情绪" }).textContent).toContain("保留原错误");
    fireEvent.click(button(limited.label)); expect(onCommand.mock.calls[1]![0]).toBe(limited.command);
    expect(screen.getByRole("region", { name: "魔鬼本次原物与实际情绪" }).textContent).toContain("保留原错误");
  });

  it("advances only after a committed report and sends COMPOSE without faking resource recovery", () => {
    const report = action({ type: "REPORT", caseId: "stage-decision" }, "提交已收束的有限报告");
    const observe = action({ type: "OBSERVE", caseId: "returned-invitation" }, "核对蕾娜手中的原邀请");
    const compose = action({ type: "COMPOSE" }, "场外普通收拢原冲动", true, "1行动 · 原张力−1");
    const value = trained({ cases: scene("stage-decision", "EXAMINED"), actions: [report, observe, compose] }), before = structuredClone(value);
    const { onCommand, rerender } = panel(value); fireEvent.click(button(compose.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(compose.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "魔鬼继承原张力" }).textContent).toContain("原冲动张力 2 / 3");
    fireEvent.click(button(report.label)); expect((screen.getByRole("combobox", { name: "选择当前魔鬼生活实践" }) as HTMLSelectElement).value).toBe("stage-decision");
    rerender(update({ ...value, cases: scene("stage-decision", "RESOLVED"), actions: [observe, compose] }, onCommand));
    expect((screen.getByRole("combobox", { name: "选择当前魔鬼生活实践" }) as HTMLSelectElement).value).toBe("returned-invitation");
    expect(screen.getByRole("region", { name: "魔鬼继承原张力" }).textContent).toContain("不会恢复健康、精神或灵性");
  });
});

describe("Devil original opponent and archival boundaries", () => {
  it("requires a cancellable one-submit fight review with actual cost and death risk", async () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原奥里克真实冲突", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [fight] }), { onCommand } = panel(value);
    await userEvent.click(button(fight.label)); expect(onCommand).not.toHaveBeenCalled();
    const review = screen.getByRole("region", { name: "魔鬼真实迎战确认" });
    for (const text of ["奥里克·费恩", "40点有限灵性", "3灵性", "自行平静", "战斗伤势", "旧费兰与旧莫顿不复活"]) expect(review.textContent).toContain(text);
    await userEvent.click(button("暂不迎战")); expect(onCommand).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button(fight.label));
    await userEvent.click(button(fight.label)); const confirm = button("确认风险"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(confirm.disabled).toBe(true);
  });

  it("shows current finite opponent resources, CALM and spent seed separately from attempts", () => {
    panel(trained({ encounter: encounter({ enemySpirituality: 24, emotion: "CALM", seedPlanted: false, lastSeedRound: 2,
      seedAttempts: 2, catalysisAttempts: 1, composeUses: 1, powerUses: { ARC_BOLT: 2, WARD: 2 } }) }));
    const facts = screen.getByRole("region", { name: "魔鬼原奥里克与实际种子" });
    for (const text of ["24 / 40", "DV4-ORRICK-FANE", "本场不重新制造入口", "当前没有可用种子", "最近实际埋种回合：2", "实际埋种尝试 2 次", "催化尝试 1 次", "随后两轮", "旧费兰的情绪和种子不进入本场"]) expect(facts.textContent).toContain(text);
  });

  it("preserves the terminal original body and does not produce a fight or revive command", () => {
    panel(trained({ encounter: encounter({ status: "RESOLVED", enemyHealth: 30, enemyStatus: "SURRENDERED", enemySpirituality: 12,
      terminal: { outcome: "ENEMY_SURRENDERED", round: 5, historyIndex: 8, enemyHealth: 30, enemyMind: 100, enemySpirituality: 12, enemyStatus: "SURRENDERED" } }) }));
    const facts = screen.getByRole("region", { name: "魔鬼原奥里克与实际种子" });
    expect(facts.textContent).toContain("原战斗第5回合结束"); expect(facts.textContent).toContain("原奥里克自行停止抵抗");
    expect(facts.textContent).toContain("当时原敌人健康30、精神100、灵性12");
    expect(screen.queryByRole("button", { name: /迎战|重战|复活/ })).toBeNull();
  });

  it("archives original S5 people, objects, failures, bottles and old seed without actions", () => {
    const old: DesireApostleProjection = { title: "欲望使徒旧经历", discovered: true, guidanceKnown: true, promoted: true,
      formulaKnown: false, formula: [], supplies: "第三原瓶已耗，前两瓶失败保留。", actions: [],
      bottles: [{ id: "desire-apostle-potion-1", title: "第一原瓶", source: "同一原导师成品", status: "实际服用失败", chance: 70,
        command: { type: "CONSUME", bottleId: "desire-apostle-potion-1", confirmed: true } }],
      abilities: [{ id: "abyss.s5.emotion-seed", label: "原情绪种子", mastery: 8, description: "当时实际成功并已结算。" }],
      acting: 100, digestion: "已消化", pollution: 3, risk: "原服药失败后果继续保留。", insideCase: false,
      cases: [{ id: "eager-rehearsal", title: "原米蕾尔排练", story: "同一原米蕾尔当时同意排练。", observations: ["当时实际观察"], preparation: "原付费能力", result: "实际催化后结束", status: "RESOLVED", contactOpen: "原接触已结束", closes: 1 }],
      environment: "原费兰已有实际结局。", practice: { emotion: "旧情绪已CALM", seed: "旧种子SPENT", records: "DA5-LEDGER-1归GUIDE；DA5-NOTE-1已HANDED_OVER", history: ["保留原第一次失败。"] },
      battle: { emotion: "CALM", seedPlanted: false, seedRound: 2, staggerReady: false } };
    const before = structuredClone(old); render(<DevilDesireApostleHistory desireApostle={old} />);
    const history = screen.getByRole("region", { name: "欲望使徒时期的经历" });
    for (const text of ["原米蕾尔", "DA5-LEDGER-1归GUIDE", "DA5-NOTE-1已HANDED_OVER", "旧种子SPENT", "保留原第一次失败", "实际服用失败", "原费兰与原莫顿的结局", "不能用于新奥里克"]) expect(history.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull(); expect(old).toEqual(before);
  });
});


describe("DevilPanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = trained(), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["两个新增训练名与具体强化机制都明确属于本作G，不冒充已经核实的魔鬼完整原著技能表。新掌握从0开始；只有实际成功的对应付费催化实践，才在收束并报告后各增8一次。", "两项训练是继承机制的有限强化。新掌握从0开始；只有实际成功的对应付费催化实践，才在收束并报告后各增8一次。"],
      ["下一序列名为呓语者；“序列3”依据原角色推断，尚不是直接核实的完整表。本阶段没有获得更高序列或原初恶魔的能力。", "下一阶段为呓语者序列3。本阶段没有获得更高序列或原初恶魔的能力。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
