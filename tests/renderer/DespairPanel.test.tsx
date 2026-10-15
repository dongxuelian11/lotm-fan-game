/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESPAIR_CONSUMPTION_RISK } from "../../src/domain/despair/content";
import { createDespairEncounterState, DESPAIR_ENCOUNTER_STORY, DESPAIR_POWERS } from "../../src/domain/despair/encounter";
import type { DespairAction, DespairCommand, DespairProjection } from "../../src/domain/despair/types";
import type { PainProjection } from "../../src/domain/pain/types";
import { DespairPanel, DespairPainHistory } from "../../src/renderer/DespairPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "原身体与性别变化记录保持原样；序列4不发生第二次身体转变。";
const inheritedTools = "同一原女巫库存：小镜1面、粉末2剂，已用原物不复原。";
function action(command: DespairCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): DespairAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取原导师的绝望魔女指导", true, "1行动 · 540便士");
function cases(): DespairProjection["cases"] {
  return ([
    { id: "room-clearance", title: "附室的真实出口", story: "成年拉维妮与玛拉同意普通撤离演练，原空推车挡着另一走廊。" },
    { id: "stop-and-check", title: "停止暴露后的原记录", story: "对比三张原虚构情境卡，区别停止源头与既有症状。" },
    { id: "care-followup", title: "原案夹的跨周随访", story: "把原案夹沿3米通路交给成年照护联络人，再按约下一真实周回来。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开启本次演练", closes: 0 }));
}
const practice: NonNullable<DespairProjection["practice"]> = {
  room: "本人INNER_MARK；拉维妮与玛拉在OUTER_MARK；原板DP4-BOARD-1在真实出口，DP4-CART-1仍堵着另一走廊。",
  scenario: "原DP4-OVERLAY-1在桌面；DP4-CARD-1/2/3是纸面虚构，原记录尚未填写。",
  care: "DP4-FOLDER-1在原架，尚未交接；没有真实病人或真实诊断。",
  route: "本人仍在原内侧标记，距普通外侧标记4米；尚未实际走出。",
  cost: "本案已付1行动，尚无能力使用或掌握奖励。", history: [],
};
function despair(patch: Partial<DespairProjection> = {}): DespairProjection {
  return { title: "绝望魔女晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "三瓶独立原瓶，各自登记来源与去向。", inheritedTools, bodyChange,
    actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "痛苦魔女消化100，已度过12/12个完整序列5周。", pollution: 3, risk: DESPAIR_CONSUMPTION_RISK,
    cases: [], insideCase: false, environment: "原独立练习场的普通模拟现场。", practice: null, encounter: null, ...patch };
}
function bottled(): DespairProjection {
  const bottles: DespairProjection["bottles"] = [1, 2, 3].map(number => ({ id: `despair-potion-${number}`,
    title: `第${number}瓶绝望魔女原瓶`, source: `原导师独立封存的第${number}瓶G成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `despair-potion-${number}`, confirmed: true } }));
  return despair({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<DespairProjection> = {}): DespairProjection {
  return despair({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: [{ id: "assassin.s4.plague", label: "渐进瘟疫", mastery: 0, description: "实际场内暴露与有限干扰。" }], ...patch });
}
function encounter(patch: Partial<NonNullable<DespairProjection["encounter"]>> = {}): NonNullable<DespairProjection["encounter"]> {
  return { ...createDespairEncounterState(), name: "瓦伦·霍尔特", story: DESPAIR_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原净空院的普通出口", pursuit: false, distanceMetres: 4, fieldRadiusMetres: 10,
    noBystanders: true, careChannel: "原本地受托照护渠道，不把离开的人传送回来。",
    abilities: DESPAIR_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function panel(value: DespairProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<DespairPanel despair={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: DespairProjection, onCommand: (command: DespairCommand) => void) {
  return <DespairPanel despair={value} resources={resources} busy={false} onCommand={onCommand} />;
}
afterEach(cleanup);

describe("Despair original bottles and committed confirmations", () => {
  it("shows the real gate, costs and unknown recipe without inventing a material list", () => {
    const reason = "痛苦魔女晋升后11/12整周，尚未满足成熟条件。";
    const { onCommand } = panel(despair({ digestion: reason,
      formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }], actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "绝望魔女配方与成品边界" });
    for (const text of ["完整配方", "仍未知", "540", "6800", "五次", "5300", "1500", "继续痛苦魔女生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "绝望魔女成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(button(learn.label).disabled).toBe(true); fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|神话变身/ })).toBeNull();
  });

  it("forwards exact per-bottle labour and payment commands with public costs", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "despair-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 5/5步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "despair-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立绝望魔女原瓶" }), "despair-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews every independent bottle and restores focus on Escape without consuming", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立绝望魔女原瓶" }), bottle.id);
      const entry = value.actions.find(item => "bottleId" in item.command && item.command.bottleId === bottle.id)!;
      button(entry.label).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: bottle.title }));
      expect(screen.getByText(`原瓶：${bottle.id}`)).toBeTruthy(); expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
      await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(button(entry.label));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the Will28 four outcomes, body continuity and current resources before one zero-AP submission", async () => {
    const value = bottled(), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(value.actions[0]!.label));
    const review = screen.getByRole("region", { name: "这瓶绝望魔女魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "绝望魔女服用风险与四档结果" }).textContent).toContain(DESPAIR_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", bodyChange, "不补满灵性"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    expect(value).toEqual(before); expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("retains a submitted operation through save failure and lets the outer owner retry it", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<DespairPanel despair={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶绝望魔女魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale bottle review when the committed original has been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已消耗，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶绝望魔女魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立绝望魔女原瓶" }), "despair-potion-1");
    expect(screen.getByText("已消耗，本次失败")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks all commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<DespairPanel despair={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Despair ordinary practice uses actual positions and distinct next steps", () => {
  it("shows three distinct stories, real props and ordinary simulation boundaries with source detail folded", async () => {
    const value = trained(); panel(value);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前绝望魔女生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const facts = screen.getByRole("region", { name: "绝望魔女普通演练的原物与实际位置" });
    for (const text of [practice.room, practice.scenario, practice.care, practice.route, practice.cost]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "绝望魔女有限生活实践" }).textContent).toContain("不对志愿者施病，不增加瘟疫能力掌握");
    expect(screen.getByText("能力与使用范围").closest("details")?.open).toBe(false);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
    expect(screen.getByText("渐进瘟疫 · 掌握 0")).toBeTruthy();
  });

  it("keeps the player inside until the exact zero-cost WALK_OUT command is committed", async () => {
    const walk = action({ type: "WALK_OUT", caseId: "room-clearance" }, "本人沿净空4米通路走出", true, "0行动 · 实际4米");
    const close = action({ type: "CLOSE", caseId: "room-clearance" }, "归还原板并确认全员在外", false, "0行动", "本人尚未实际走出。");
    const value = trained({ insideCase: true, actions: [walk, close], cases: cases().map(entry => entry.id === "room-clearance" ? { ...entry, status: "ACTIVE" } : entry) });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "绝望魔女成长下一步" }).textContent).toContain(walk.label);
    expect(button(walk.label).disabled).toBe(false); expect(button(close.label).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择当前绝望魔女生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    await userEvent.click(button(walk.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(walk.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "绝望魔女普通演练的原物与实际位置" }).textContent).toContain("本人仍在原内侧标记");
  });

  it("renders the two paper-scenario choices and sends an incorrect choice without inventing success", async () => {
    const wrong = action({ type: "PERFORM", caseId: "stop-and-check", plan: "DECLARE_ALL_CURED" }, "宣布所有人已经痊愈", true, "1行动 · 会留下错误记录");
    const correct = action({ type: "PERFORM", caseId: "stop-and-check", plan: "PAUSE_EXPOSURE" }, "停止暴露并保留症状随访", true, "1行动 · 写原记录");
    const value = trained({ actions: [wrong, correct], cases: cases().map(entry => entry.id === "stop-and-check" ? { ...entry, status: "PREPARED" } : entry) });
    const before = structuredClone(value), { onCommand } = panel(value);
    const summary = screen.getByRole("region", { name: "绝望魔女成长下一步" }); expect(summary.textContent).toContain(correct.label); expect(summary.textContent).not.toContain(wrong.label);
    await userEvent.click(button(wrong.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(wrong.command); expect(value).toEqual(before);
    expect(screen.queryByRole("region", { name: "绝望魔女实际实践结果" })).toBeNull();
  });

  it("keeps safe closed waiting selectable and requires the next-week follow-up intent", async () => {
    const reason = "下周约定尚未到达；可正常休养推进一周。";
    const follow = action({ type: "FOLLOW_UP", caseId: "care-followup" }, "按约回来核对原案夹", false, "1行动 · 下一真实周", reason);
    const value = trained({ actions: [follow], cases: cases().map(entry => entry.id === "care-followup" ? { ...entry, status: "WAITING", closes: 1 } : entry) });
    const { onCommand, rerender } = panel(value); const picker = screen.getByRole("combobox", { name: "选择当前绝望魔女生活实践" }) as HTMLSelectElement;
    expect(picker.disabled).toBe(false); expect(button(follow.label).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "绝望魔女成长下一步" }).textContent).toContain(reason);
    expect(screen.getByText(/现场已安全收束，可以正常休养/)).toBeTruthy();
    const nextWeek = { ...value, actions: [{ ...follow, enabled: true, reason: null }] }; rerender(update(nextWeek, onCommand));
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.click(button(follow.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(follow.command);
  });

  it("keeps a returned care folder distinct from the player's actual three-metre return and closure", async () => {
    const back = action({ type: "RETURN_ROUTE", caseId: "care-followup" }, "本人沿原3米路线返回", true, "0行动 · 实际3米");
    const close = action({ type: "CLOSE", caseId: "care-followup" }, "归还原案夹并结束本次交接", false, "0行动", "本人仍在照护联络人门口。");
    const value = trained({ insideCase: true, actions: [back, close],
      cases: cases().map(entry => entry.id === "care-followup" ? { ...entry, status: "WAITING" } : entry),
      practice: { ...practice, care: "照护联络人已核阅并交回同一DP4-FOLDER-1，约定NEXT_WEEK。", route: "本人仍在原3米外门口，尚未返回。" } });
    const { onCommand, rerender } = panel(value); expect(button(close.label).disabled).toBe(true);
    expect(screen.queryByText(/现场已安全收束，可以正常休养/)).toBeNull();
    await userEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command);
    expect(screen.getByRole("region", { name: "绝望魔女普通演练的原物与实际位置" }).textContent).toContain("本人仍在原3米外门口");
    const returned = { ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...value.practice!, route: "本人已沿同一3米普通路线回到原桌前。" } };
    rerender(update(returned, onCommand)); expect(screen.getByRole("region", { name: "绝望魔女成长下一步" }).textContent).toContain(close.label);
    await userEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
  });

  it("keeps a paid incorrect simulation result visible without inventing disease or mastery", () => {
    const result = "本次宣布全员痊愈的判断错误，已付1行动，原纸记录保留；没有病人受到伤害。";
    const retry = action({ type: "PERFORM", caseId: "stop-and-check", plan: "PAUSE_EXPOSURE" }, "重新核对并停止暴露", false, "1行动", "需要实际下一次行动，不能免费改写记录。");
    panel(trained({ actions: [retry], cases: cases().map(entry => entry.id === "stop-and-check" ? { ...entry, status: "PREPARED", result } : entry) }));
    expect(screen.getByRole("region", { name: "绝望魔女实际实践结果" }).textContent).toContain(result);
    expect(button(retry.label).disabled).toBe(true); expect(screen.getByText("渐进瘟疫 · 掌握 0")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "当前瘟疫场与已存感染" })).toBeNull();
  });

  it("advances after a saved report and allows a deliberate look back at the old case", async () => {
    const report = action({ type: "REPORT", caseId: "room-clearance" }, "报告已实际收束的附室演练");
    const observe = action({ type: "OBSERVE", caseId: "stop-and-check" }, "观察三张原情境卡", true, "1行动");
    const value = trained({ actions: [report, observe] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(report.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(report.command);
    const saved = { ...value, actions: [observe], cases: value.cases.map(entry => entry.id === "room-clearance" ? { ...entry, status: "RESOLVED", result: "原板归架与全员离开均已记录。" } : entry) };
    rerender(update(saved, onCommand)); const picker = screen.getByRole("combobox", { name: "选择当前绝望魔女生活实践" }) as HTMLSelectElement;
    expect(picker.value).toBe("stop-and-check"); await userEvent.selectOptions(picker, "room-clearance"); expect(picker.value).toBe("room-clearance");
    expect(screen.getByRole("region", { name: "绝望魔女实际实践结果" }).textContent).toContain("原板归架与全员离开均已记录。");
  });
});

describe("Despair real encounter is separate from the ordinary rehearsals", () => {
  it("confirms actual combat independently and lets ordinary refusal pass straight through", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "普通表明不交手并离开", true, "1行动");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原废院真实战斗", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [talk, fight] }), { onCommand } = panel(value);
    await userEvent.click(button(talk.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(talk.command);
    await userEvent.click(button(fight.label)); const review = screen.getByRole("region", { name: "绝望魔女真实迎战确认" });
    for (const text of ["瓦伦·霍尔特", "4米", "40点有限灵性", "不清除既有症状", "死亡", "旧奥伦不会复活"]) expect(review.textContent).toContain(text);
    await userEvent.click(button("暂不迎战")); expect(onCommand).toHaveBeenCalledTimes(1); expect(document.activeElement).toBe(button(fight.label));
    await userEvent.click(button(fight.label)); fireEvent.click(button("确认风险，开始真实交战")); fireEvent.click(button("确认风险，开始真实交战"));
    expect(onCommand).toHaveBeenCalledTimes(2); expect(onCommand.mock.calls[1]![0]).toBe(fight.command);
  });

  it("shows actual enemy SP and interruption count while separating a stopped field from symptoms", () => {
    const original = encounter({ status: "FIGHTING", fieldActive: false, enemyDisease: 4, diseaseApplications: 1,
      enemySpirituality: 27, powerUses: { ARC_BOLT: 2, FROST_GUARD: 1, SPRINT_STRIKE: 0 }, interruptionCount: 1 });
    panel(trained({ encounter: original })); const field = screen.getByRole("region", { name: "当前瘟疫场与已存感染" });
    for (const text of ["已停止或尚未建立新增暴露", "现存感染强度 4 / 6", "已实际打断法术 1 次", "防守", "撤退", "已存感染不会因此消失"]) expect(field.textContent).toContain(text);
    expect(screen.getByText("27 / 40")).toBeTruthy(); expect(screen.getByText("原敌人能力、有限场域与工具成本").closest("details")?.open).toBe(false);
    expect(original.enemyDisease).toBe(4); expect(screen.queryByRole("button", { name: /全部痊愈|立即治愈/ })).toBeNull();
  });

  it("displays original terminal infection separately from paid later care and does not heal on click", async () => {
    const aid = action({ type: "ENCOUNTER_AID" }, "安排原瓦伦本周专业随访", true, "1行动 · 60便士 · 原强度减少2");
    const original = encounter({ status: "RETREATED", enemyDisease: 3, diseaseApplications: 1, enemyHealth: 70,
      careVisits: [{ week: 91, costPence: 60, before: 5, after: 3 }], terminal: { outcome: "RETREATED", round: 5,
        historyIndex: 4, enemyHealth: 70, enemyMind: 100, enemySpirituality: 11, enemyStatus: "RESISTING", enemyDisease: 5 } });
    const value = trained({ encounter: original, actions: [aid] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("list", { name: "实际跨周照护记录" }).textContent).toContain("第91周 · 实付60便士 · 原感染强度5 → 3");
    expect(screen.getByRole("region", { name: "当前瘟疫场与已存感染" }).textContent).toContain("现存感染强度 3 / 6");
    expect(screen.getByText(/原战斗第5回合结束/).textContent).toContain("感染强度5");
    await userEvent.click(button(aid.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(aid.command); expect(value).toEqual(before);
  });

  it("preserves a dead original and the projected no-aid reason", () => {
    const reason = "原瓦伦已经死亡，不能安排活人随访或复活。";
    const aid = action({ type: "ENCOUNTER_AID" }, "安排原瓦伦本周专业随访", false, "1行动 · 60便士", reason);
    const { onCommand } = panel(trained({ encounter: encounter({ status: "RESOLVED", enemyHealth: 0, enemyStatus: "DEAD", enemyDisease: 5 }), actions: [aid] }));
    expect(button(aid.label).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); fireEvent.click(button(aid.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "绝望魔女原敌人与持续症状" }).textContent).toContain("原身体死亡");
  });
});

describe("Despair Pain history is read-only and keeps original consequences", () => {
  it("shows old people, tools, bottles, symptoms and mastery without any playable action", () => {
    const value: PainProjection = { ...despair(), promoted: true, acting: 100, actions: [],
      bottles: [{ id: "pain-potion-1", title: "痛苦原首瓶", source: "原痛苦渠道", status: "已消耗", chance: 70,
        command: { type: "CONSUME", bottleId: "pain-potion-1", confirmed: true } }],
      cases: [{ id: "exit-markers", title: "原疏散模拟", story: "原拉维妮的自愿普通演练。", status: "RESOLVED", observations: ["已实际走过原4米通路"],
        preparation: "普通约定", result: "原标记已归架", contactOpen: "已关闭", closes: 1 }],
      practice: { position: "原拉维妮在等候点，本人在原入口。", records: "原情境表已有三行。", care: "同一原便条已交接。", history: ["实际返回原路线"] },
      diseaseState: { fieldActive: false, enemyDisease: 1, diseaseApplications: 1, care: "NONE", enemyHealth: 0, enemyStatus: "DEAD" },
      abilities: [{ id: "assassin.s5.disease", label: "原疾病能力", mastery: 7, description: "原能力记录保留。" }] };
    const before = structuredClone(value); render(<DespairPainHistory pain={value} />);
    expect(screen.getByRole("region", { name: "痛苦魔女时期的经历" }).textContent).toContain("旧经历不重新结算");
    const original = screen.getByRole("region", { name: "痛苦魔女原奥伦疾病与结局" });
    expect(original.textContent).toContain("原奥伦已死亡"); expect(original.textContent).toContain("原感染强度1 / 3");
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("原疾病能力 · 掌握 7：原能力记录保留。")).toBeTruthy();
    expect(screen.getByText(inheritedTools)).toBeTruthy(); expect(screen.getByText("原瓶：pain-potion-1")).toBeTruthy(); expect(value).toEqual(before);
  });
});
