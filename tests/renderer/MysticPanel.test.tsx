/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MYSTIC_CONSUMPTION_RISK } from "../../src/domain/mystic/content";
import { createMysticEncounterState, MYSTIC_ENCOUNTER_STORY, MYSTIC_POWERS } from "../../src/domain/mystic/encounter";
import { MYSTIC_ANALYSIS_STEPS, MYSTIC_RITUAL_BOUNDARY, MYSTIC_SAMPLE_SOURCE } from "../../src/domain/mystic/ritual";
import type { MysticAction, MysticCommand, MysticProjection } from "../../src/domain/mystic/types";
import type { StarMysticProjection } from "../../src/domain/star-mystic/types";
import { MysticPanel, MysticStarMysticHistory } from "../../src/renderer/MysticPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 120, cash: "7200便士", actionsRemaining: 0 };
const bodyChange = "原身体与性别记录保持原样，神秘学家不发生新增身体转变。";
function action(command: MysticCommand, label: string, enabled = true, cost = "0行动", reason: string | null = null): MysticAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason, command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取伊蕾的神秘学家指导", true, "1行动 · 540便士");
function cases(): MysticProjection["cases"] {
  return ([
    { id: "sealed-story", title: "迟到的钟声的原记录", story: "核对伊蕾的原保密记录MY4-STORY-1、原钟MY4-BELL-1与成年保管人的独立证言。" },
    { id: "bell-test", title: "同一原钟的有限回声", story: "成年达芙宁自愿聆听有限延迟声响，原钟保持不动。" },
    { id: "shared-eye", title: "同伴沿原走廊的眼睛", story: "成年达芙宁本次独立同意，她走过原6米走廊，玩家留在原房间。" },
  ] as const).map(entry => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null,
    contactOpen: "尚未开启本次接触", closes: 0 }));
}
const practice: NonNullable<MysticProjection["practice"]> = {
  story: "MY4-STORY-1：尚未亲自研究成功，迟钟回声尚未学会，知情者5人，尚未公开。",
  bell: "同一MY4-BELL-1在原桌面，没有被移动；当前没有声音错觉。",
  sight: "成年达芙宁尚未给出本次同意，未放置眼睛，未获得任何共享视野。",
  route: "本人ROOM，达芙宁ROOM；同一6米普通走廊尚未实际往返。",
  cost: "本次尚未付费，未增加能力掌握。", history: [],
};
function ritual(patch: Partial<NonNullable<MysticProjection["ritual"]>> = {}): NonNullable<MysticProjection["ritual"]> {
  return { title: "同一原滴的真实分析记录", source: MYSTIC_SAMPLE_SOURCE, sample: "MY4-BLOOD-1唯一原滴尚在伊蕾原安全架。",
    shield: "MY4-SHIELD-1尚未开启。", recordbook: "MY4-RECORD-1尚无实际分析。", complete: false, completedSteps: 0, totalSteps: 3,
    open: false, boundary: MYSTIC_RITUAL_BOUNDARY, steps: MYSTIC_ANALYSIS_STEPS.map(step => ({ ...step, complete: false })), history: [], ...patch };
}
function mystic(patch: Partial<MysticProjection> = {}): MysticProjection {
  return { title: "神秘学家晋升", discovered: true, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [],
    supplies: "三瓶独立G原瓶，各自记录来源与去向。", inheritedTools: "原SM5-LENS-1与全部旧卷轴、材料、授权保持原样。", bodyChange,
    actions: [learn], bottles: [], abilities: [], acting: 0, digestion: "星象师消化100，已度过12/12整周；仍需真实完成已知分析条件。",
    pollution: 3, risk: MYSTIC_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "原教学室与同一6米普通走廊。",
    practice: null, encounter: null, ritual: null, ...patch };
}
function bottled(): MysticProjection {
  const bottles: MysticProjection["bottles"] = [1, 2, 3].map(number => ({ id: `mystic-potion-${number}`,
    title: `第${number}瓶神秘学家原瓶`, source: `伊蕾原渠道的第${number}瓶独立成品`, chance: 71 - number,
    status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: `mystic-potion-${number}`, confirmed: true } }));
  return mystic({ guidanceKnown: true, bottles, actions: bottles.map(bottle => action(bottle.command,
    `查看并服用${bottle.title}`, true, "0行动 · 独立确认 · 消耗这一原瓶")) });
}
function trained(patch: Partial<MysticProjection> = {}): MysticProjection {
  return mystic({ promoted: true, cases: cases(), practice: structuredClone(practice), actions: [],
    abilities: [{ id: "hermit.s4.mystical-reenactment", label: "本人研究后的有限神秘再现", mastery: 0, description: "先亲自研究成功，才学会这一有来源的有限法术。" },
      { id: "hermit.s4.shared-sight", label: "放置眼睛并分享有限视野", mastery: 0, description: "须原成年参与者当次同意与实际移动。" }], ...patch });
}
function encounter(patch: Partial<NonNullable<MysticProjection["encounter"]>> = {}): NonNullable<MysticProjection["encounter"]> {
  return { ...createMysticEncounterState(), name: "卢坎·维伊", story: MYSTIC_ENCOUNTER_STORY, sequence: 5,
    originalExit: "原净空附院的普通出口", pursuit: false, distanceMetres: 4, noBystanders: true,
    abilities: MYSTIC_POWERS.map(power => ({ ...power, available: true })), ...patch };
}
function workshop(): NonNullable<MysticProjection["workshop"]> {
  return { summary: "同一原工坊：原两份材料已耗，另一原份仍持有，旧失败成本保留。",
    lessons: [{ id: "light-touch", label: "原有限牵引", learned: true, description: "原巫师已学会的有限法术。" },
      { id: "brief-ward", label: "原短暂护持", learned: false, description: "尚需真正学习原课程。" }],
    materials: [{ id: "SP6-MATERIAL-1", acquiredWeek: 30, status: "SPENT", spentWeek: 31 }, { id: "SP6-MATERIAL-2", acquiredWeek: 60, status: "HELD", spentWeek: null }],
    scrolls: ([6, 5, 4] as const).map((sequence, index) => ({ id: `SP-SCROLL-${sequence}`, kind: "IMPACT", makerSequence: sequence,
      inscriptionMastery: 13 + index, materialId: "SP6-MATERIAL-1", createdWeek: 31 + index, status: sequence === 6 ? "USED" : "HELD",
      usedWeek: sequence === 6 ? 40 : null, authorized: sequence === 5, title: `原序列${sequence}冲力卷`, source: `同一工坊第${index + 1}张原卷` })) };
}
function panel(value: MysticProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MysticPanel mystic={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
function button(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
}
function update(value: MysticProjection, onCommand: (command: MysticCommand) => void) {
  return <MysticPanel mystic={value} resources={resources} busy={false} onCommand={onCommand} />;
}
afterEach(cleanup);

describe("Mystic independent bottles and committed confirmations", () => {
  it("states the known one-drop part separately from the unknown full formula and real maturity gate", () => {
    const reason = "星象师晋升后11/12整周，且原样本分析仍未完成。";
    const { onCommand } = panel(mystic({ digestion: reason, formula: [{ name: "未核实材料不得显示", quantity: 99, unit: "份" }], actions: [{ ...learn, enabled: false, reason }] }));
    const boundary = screen.getByRole("region", { name: "神秘学家配方与成品边界" });
    for (const text of ["一滴", "不饮用", "其余仪式细节仍未知", "540", "6800", "五次", "5300", "1500", "继续星象师生活"]) expect(boundary.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "神秘学家成长下一步" }).textContent).toContain(reason);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull(); expect(button(learn.label).disabled).toBe(true);
    fireEvent.click(button(learn.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /饮血|直接晋升|神话变身/ })).toBeNull();
  });

  it("forwards exact independent labour and payment commands without mutating the public original", async () => {
    const value = bottled(); const work = action({ type: "POTION_WORK", bottleId: "mystic-potion-2" }, "完成第二瓶真实劳务", true, "1行动 · 5/5步抵5300便士");
    const buy = action({ type: "BUY_POTION", bottleId: "mystic-potion-2" }, "付清第二瓶余款", true, "0行动 · 1500便士");
    value.actions = [work, buy]; const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立神秘学家原瓶" }), "mystic-potion-2");
    await userEvent.click(button(work.label)); await userEvent.click(button(buy.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([work.command, buy.command]);
    expect(onCommand.mock.calls[0]![0]).toBe(work.command); expect(value).toEqual(before);
    expect(screen.getByText(work.cost)).toBeTruthy(); expect(screen.getByText(buy.cost)).toBeTruthy();
  });

  it("reviews each original bottle and restores keyboard focus after Escape", async () => {
    const value = bottled(), { onCommand } = panel(value);
    for (const bottle of value.bottles) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立神秘学家原瓶" }), bottle.id);
      const entry = value.actions.find(item => "bottleId" in item.command && item.command.bottleId === bottle.id)!;
      button(entry.label).focus(); await userEvent.keyboard("{Enter}");
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: bottle.title }));
      expect(screen.getByText(`原瓶：${bottle.id}`)).toBeTruthy(); expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
      await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(button(entry.label));
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows Will28 risks, no blood drinking and current resources before submitting one original once", async () => {
    const value = bottled(), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); const review = screen.getByRole("region", { name: "这瓶神秘学家魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "神秘学家服用风险与四档结果" }).textContent).toContain(MYSTIC_CONSUMPTION_RISK);
    for (const text of ["意志难度28", "精神−4", "精神−8", "灵性−15", "排异+30", "排异+60", "最低保留1", "血样不饮用", "不补满灵性", "其余仪式细节仍未知"]) expect(review.textContent).toContain(text);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources.cash);
    const confirm = button("确认服用"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    expect(value).toEqual(before); expect(confirm.disabled).toBe(true);
  });

  it("keeps a submitted bottle through save failure and defers retries to the outer owner", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value);
    await userEvent.click(button(value.actions[0]!.label)); fireEvent.click(button("确认服用"));
    rerender(<MysticPanel mystic={value} resources={resources} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药"); expect(button("暂不服用").disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶神秘学家魔药的服用确认" })).toBeTruthy();
    rerender(update(value, onCommand)); fireEvent.click(button("确认服用")); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("dismisses a stale review after that committed bottle has been consumed", async () => {
    const value = bottled(), { onCommand, rerender } = panel(value); await userEvent.click(button(value.actions[0]!.label));
    const committed = structuredClone(value); committed.bottles[0]!.status = "已耗用，本次失败"; committed.actions[0]!.enabled = false;
    rerender(update(committed, onCommand)); expect(screen.queryByRole("region", { name: "这瓶神秘学家魔药的服用确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks all commands and selection while %s", condition => {
    const value = bottled(), onCommand = vi.fn();
    render(<MysticPanel mystic={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const entry of screen.getAllByRole("button")) expect((entry as HTMLButtonElement).disabled).toBe(true);
    for (const entry of screen.getAllByRole("combobox")) expect((entry as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button(value.actions[0]!.label)); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Mystic one original drop and actual paid analysis", () => {
  it("renders original donor, three different steps, and actual failed cost without inventing completion", async () => {
    const retry = action({ type: "ANALYZE_SAMPLE" }, "重试同一原滴结构分析", false, "1行动 · 4灵性 · 2精神 · 知识18", "本周失败已付费，下一真实周才能重试。");
    const close = action({ type: "CLOSE_ANALYSIS" }, "安全封存同一原滴", true, "0行动 · 可安全休养");
    const original = ritual({ open: true, history: ["第83周结构分析失败，已付1行动、4灵性、2精神，没有完成步骤。"] });
    const value = mystic({ ritual: original, actions: [retry, close] }), before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "原滴分析的已保存事实" });
    for (const text of ["0 / 3", "原罩仍开启", "MY4-BLOOD-1", "MY4-SHIELD-1", "MY4-RECORD-1"]) expect(facts.textContent).toContain(text);
    await userEvent.click(screen.getByText("原捐赠者、三项分析与全部尝试"));
    expect(facts.textContent).toContain(MYSTIC_SAMPLE_SOURCE); expect(facts.textContent).toContain(original.history[0]);
    for (const step of MYSTIC_ANALYSIS_STEPS) expect(facts.textContent).toContain(step.title);
    expect(button(retry.label).disabled).toBe(true); expect(button(close.label).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "神秘学家成长下一步" }).textContent).toContain(close.label);
    await userEvent.click(button(close.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(close.command); expect(value).toEqual(before);
    expect(facts.textContent).toContain("原罩仍开启");
  });

  it("sends acquisition, opening, each analysis and return as distinct domain intents", async () => {
    const commands: MysticCommand[] = [{ type: "ACQUIRE_SAMPLE" }, { type: "OPEN_ANALYSIS" }, { type: "ANALYZE_SAMPLE" }, { type: "CLOSE_ANALYSIS" }, { type: "RETURN_SAMPLE" }];
    const actions = commands.map((command, index) => action(command, `原样本动作${index}`, true, index < 3 ? "1行动 · 原公开成本" : "0行动"));
    const value = mystic({ ritual: ritual(), actions }), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of actions) await userEvent.click(button(entry.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands); commands.forEach((command, index) => expect(onCommand.mock.calls[index]![0]).toBe(command));
    expect(value).toEqual(before);
  });

  it("retains completed and returned original records after promotion with no ritual replay buttons", async () => {
    const returned = ritual({ complete: true, completedSteps: 3, sample: "MY4-BLOOD-1同一原滴已密封归还伊蕾，没有饮用或耗用。", steps: MYSTIC_ANALYSIS_STEPS.map(step => ({ ...step, complete: true })), history: ["原三项分析成功，第85周已归还同一原样。"] });
    panel(trained({ ritual: returned })); expect(screen.getByText("晋升前同一原滴的分析与归还记录").closest("details")?.open).toBe(false);
    await userEvent.click(screen.getByText("晋升前同一原滴的分析与归还记录"));
    expect(screen.getByRole("region", { name: "原滴分析的已保存事实" }).textContent).toContain("3 / 3");
    expect(screen.queryByRole("button", { name: /分析|领取|归还/ })).toBeNull();
  });
});

describe("Mystic learned story, irreversible publicity and real shared-eye return", () => {
  it("shows distinct source-bound stories and keeps the unknown spell unlearned", async () => {
    panel(trained());
    for (const entry of cases()) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前神秘学家生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const facts = screen.getByRole("region", { name: "神秘学家原故事与共享视野" });
    for (const text of [practice.story, practice.bell, practice.sight, practice.route, practice.cost]) expect(facts.textContent).toContain(text);
    expect(screen.getByText("能力与使用范围").closest("details")?.open).toBe(false);
    expect(screen.getByText("已观察的事实与本次方法边界").closest("details")?.open).toBe(false);
    expect(screen.getByText("本人研究后的有限神秘再现 · 掌握 0")).toBeTruthy();
  });

  it("forwards paid failed research without learning the spell or moving the original bell locally", async () => {
    const perform = action({ type: "PERFORM", caseId: "sealed-story" }, "实际研究原记录", true, "1行动 · 3灵性 · 知识18");
    const value = trained({ actions: [perform], cases: cases().map(entry => entry.id === "sealed-story" ? { ...entry, status: "PREPARED", result: "上次研究失败，已经付费，尚未学会回声。" } : entry) });
    const before = structuredClone(value), { onCommand } = panel(value); await userEvent.click(button(perform.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "神秘学家实际实践结果" }).textContent).toContain("尚未学会回声");
    expect(screen.getByRole("region", { name: "神秘学家原故事与共享视野" }).textContent).toContain("原桌面，没有被移动");
  });

  it("reviews irreversible publication, cancels with focus restoration, then submits confirmed true once", async () => {
    const publish = action({ type: "PUBLISH_STORY", confirmed: true }, "公开本人已研究的原故事", true, "1行动 · 不可逆公开");
    const value = trained({ actions: [publish], practice: { ...practice, story: "本人实际研究成功，已学会迟钟回声；原知情者5人，尚未公开。" } });
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(screen.getByText("公开已研究故事 · 不可逆削弱效果")); await userEvent.click(button(publish.label));
    const review = screen.getByRole("region", { name: "神秘故事不可逆公开确认" });
    for (const text of ["北桥成年读书会", "MY4-READING-GROUP-1", "5人", "105人", "0.15", "不可逆", "不能通过收回副本", "不", "扮演"]) expect(review.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(button(publish.label));
    await userEvent.click(button(publish.label)); const confirm = button("确认不可逆公开并削弱迟钟回声"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(publish.command); expect(onCommand.mock.calls[0]![0]).toBe(publish.command); expect(value).toEqual(before);
  });

  it("keeps publication pending on save failure and closes its review only after committed disclosure", async () => {
    const publish = action({ type: "PUBLISH_STORY", confirmed: true }, "公开本人已学的原故事", true, "1行动");
    const value = trained({ actions: [publish] }), { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByText("公开已研究故事 · 不可逆削弱效果")); await userEvent.click(button(publish.label)); fireEvent.click(button("确认不可逆公开"));
    rerender(<MysticPanel mystic={value} resources={resources} busy={false} error="公开结果尚未保存" onCommand={onCommand} />);
    expect(button("保留秘密").disabled).toBe(true); await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "神秘故事不可逆公开确认" })).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(update({ ...value, actions: [], practice: { ...practice, story: "已公开给105人，效果系数0.15，无法撤回。" } }, onCommand));
    expect(screen.queryByRole("region", { name: "神秘故事不可逆公开确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "神秘学家原故事与共享视野" }).textContent).toContain("无法撤回");
  });

  it("prioritizes the original adult's real zero-AP return before closure and reporting", async () => {
    const back = action({ type: "RETURN_ROUTE", caseId: "shared-eye" }, "达芙宁沿原6米路线返回", true, "0行动 · 实际步行6米");
    const close = action({ type: "CLOSE", caseId: "shared-eye" }, "撤去眼睛并结束本次同意", false, "0行动", "达芙宁仍在原标记，须实际返回。");
    const value = trained({ insideCase: true, actions: [back, close], cases: cases().map(entry => entry.id === "shared-eye" ? { ...entry, status: "EXAMINED" } : entry),
      practice: { ...practice, sight: "成年达芙宁本次同意，自主走至原标记，当前共享视野开放。", route: "本人ROOM，达芙宁MARK；原6米返回尚未发生。" } });
    const before = structuredClone(value), { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "神秘学家成长下一步" }).textContent).toContain(back.label);
    expect((screen.getByRole("combobox", { name: "选择当前神秘学家生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    expect(button(back.label).disabled).toBe(false); expect(button(close.label).disabled).toBe(true);
    await userEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "神秘学家原故事与共享视野" }).textContent).toContain("返回尚未发生");
    const returned = { ...value, actions: [{ ...close, enabled: true, reason: null }], practice: { ...value.practice!, route: "同一达芙宁已沿原6米返回ROOM；仍须关闭接触。" } };
    rerender(update(returned, onCommand)); expect(screen.getByRole("region", { name: "神秘学家成长下一步" }).textContent).toContain(close.label);
    await userEvent.click(button(close.label)); expect(onCommand.mock.calls[1]![0]).toBe(close.command);
  });

  it("keeps a prepared zero-AP cancellation visible and prioritizes it over locked actions", async () => {
    const perform = action({ type: "PERFORM", caseId: "shared-eye" }, "实施共享眼睛", false, "1行动 · 3灵性", "剩余行动不足，尚未施术。");
    const withdraw = action({ type: "WITHDRAW", caseId: "shared-eye" }, "取消本次安全准备", true, "0行动 · 不退款不加掌握");
    const value = trained({ actions: [perform, withdraw], cases: cases().map(entry => entry.id === "shared-eye" ? { ...entry, status: "PREPARED" } : entry) });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "神秘学家成长下一步" }).textContent).toContain(withdraw.label);
    expect(button(perform.label).disabled).toBe(true); expect(button(withdraw.label).disabled).toBe(false);
    await userEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(value).toEqual(before);
  });

  it("keeps ordinary and ability preparation distinct and preserves the actual selected command", async () => {
    const ordinary = action({ type: "PREPARE", caseId: "shared-eye", method: "ORDINARY" }, "本人普通步行核对", true, "1行动 · 不增加能力掌握");
    const ability = action({ type: "PREPARE", caseId: "shared-eye", method: "ABILITY" }, "按本次同意准备共享眼睛", true, "1行动 · 尚未施术");
    const value = trained({ actions: [ordinary, ability] }), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前神秘学家生活实践" }), "shared-eye");
    await userEvent.click(button(ordinary.label)); await userEvent.click(button(ability.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([ordinary.command, ability.command]);
    expect(screen.getByRole("region", { name: "神秘学家原故事与共享视野" }).textContent).toContain("未放置眼睛");
  });

  it("advances only after a saved report and permits deliberate history review", async () => {
    const report = action({ type: "REPORT", caseId: "sealed-story" }, "提交已关闭的实际研究报告");
    const observe = action({ type: "OBSERVE", caseId: "bell-test" }, "观察同一原钟", true, "1行动");
    const value = trained({ actions: [report, observe] }), { onCommand, rerender } = panel(value);
    await userEvent.click(button(report.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(report.command);
    const saved = { ...value, actions: [observe], cases: value.cases.map(entry => entry.id === "sealed-story" ? { ...entry, status: "RESOLVED", result: "原研究与原物安全收束均已确认。" } : entry) };
    rerender(update(saved, onCommand)); const picker = screen.getByRole("combobox", { name: "选择当前神秘学家生活实践" }) as HTMLSelectElement;
    expect(picker.value).toBe("bell-test"); await userEvent.selectOptions(picker, "sealed-story"); expect(picker.value).toBe("sealed-story");
    expect(screen.getByRole("region", { name: "神秘学家实际实践结果" }).textContent).toContain("安全收束均已确认");
  });
});

describe("Mystic original inherited workshop and optional real fight", () => {
  it("shows original maker6/5/4 identity and forwards current workshop commands without reviving a used scroll", async () => {
    const learnSpell = action({ type: "LEARN_SPELL", spellId: "brief-ward" }, "真实学习原护持课", true, "1行动 · 原课程费用");
    const buy = action({ type: "BUY_KIT" }, "购买同一工坊材料", true, "1行动 · 原材料价格");
    const craft = action({ type: "CRAFT_SCROLL", kind: "IMPACT" }, "实际刻录当前序列4冲力卷", true, "1行动 · 实耗原材料");
    const used = action({ type: "AUTHORIZE_SCROLL", scrollId: "SP-SCROLL-6", authorized: true }, "授权已用旧卷");
    const held = action({ type: "AUTHORIZE_SCROLL", scrollId: "SP-SCROLL-4", authorized: true }, "授权本张实际新卷");
    const value = trained({ workshop: workshop(), actions: [learnSpell, buy, craft, used, held] }), before = structuredClone(value), { onCommand } = panel(value);
    const region = screen.getByRole("region", { name: "神秘学家继承卷轴工坊" }); expect(region.textContent).toContain("旧卷制作序列6或5不变");
    await userEvent.click(screen.getByText("原课程、材料与实际刻录"));
    await userEvent.click(button(learnSpell.label)); await userEvent.click(button(buy.label)); await userEvent.click(button(craft.label));
    await userEvent.click(screen.getByText("卷轴原件与逐件战前授权"));
    for (const sequence of [6, 5, 4]) expect(region.textContent).toContain(`制作序列 ${sequence}`);
    expect(button(used.label).disabled).toBe(true); fireEvent.click(button(used.label)); await userEvent.click(button(held.label));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([learnSpell.command, buy.command, craft.command, held.command]); expect(value).toEqual(before);
  });

  it("confirms actual fighting independently while ordinary refusal passes straight through", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "普通表明退出并离开", true, "1行动");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "进入原附院真实交战", true, "1行动 · 真实死亡风险");
    const value = trained({ encounter: encounter(), actions: [talk, fight] }), { onCommand } = panel(value);
    await userEvent.click(button(talk.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(talk.command);
    await userEvent.click(button(fight.label)); const review = screen.getByRole("region", { name: "神秘学家真实迎战确认" });
    for (const text of ["卢坎·维伊", "4米", "40点有限灵性", "必须实际学会", "死亡", "旧布莱斯不会复活"]) expect(review.textContent).toContain(text);
    await userEvent.click(button("暂不迎战")); expect(document.activeElement).toBe(button(fight.label)); expect(onCommand).toHaveBeenCalledTimes(1);
    await userEvent.click(button(fight.label)); const confirm = button("确认风险，开始真实交战"); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledTimes(2); expect(onCommand.mock.calls[1]![0]).toBe(fight.command);
  });

  it("shows actual finite enemy resources and terminal original body without refilling or replaying", async () => {
    const original = encounter({ status: "RESOLVED", enemyHealth: 60, enemySpirituality: 12, enemyStatus: "SURRENDERED", powerUses: { ARC_BOLT: 5, WARD: 1 },
      terminal: { outcome: "ENEMY_SURRENDERED", round: 2, historyIndex: 9, enemyHealth: 60, enemyMind: 100, enemySpirituality: 12, enemyStatus: "SURRENDERED" } });
    const before = structuredClone(original); panel(trained({ encounter: original })); const region = screen.getByRole("region", { name: "神秘学家原卢坎与有限资源" });
    expect(region.textContent).toContain("12 / 40"); expect(region.textContent).toContain("原卢坎自行停止抵抗");
    expect(screen.getByText("原敌人的法术、抵抗与有限效果").closest("details")?.open).toBe(false);
    await userEvent.click(screen.getByText("原敌人的法术、抵抗与有限效果"));
    expect(region.textContent).toContain("已实际使用5次"); expect(region.textContent).toContain("血样不能用于施法");
    expect(original).toEqual(before); expect(screen.queryByRole("button", { name: /复活|再次交战|补满/ })).toBeNull();
  });

  it("exports S5 original history with no executable commands or altered original records", async () => {
    const history: StarMysticProjection = { title: "原星象师阶段", discovered: true, guidanceKnown: true, promoted: true,
      formulaKnown: false, formula: [], supplies: "三瓶原星象师成品均保持原去向。", actions: [], bottles: [{ id: "SM5-POTION-1", title: "原星象师第一瓶", source: "原伊蕾交付", status: "已耗用，原失败记录保留", chance: 40, command: { type: "CONSUME", bottleId: "SM5-POTION-1", confirmed: true } }],
      abilities: [{ id: "hermit.s5.star-cage", label: "原星光囚笼", mastery: 27, description: "原实际掌握不重置。" }], acting: 100, digestion: "星象师已消化", pollution: 3, risk: "原风险记录", cases: [], insideCase: false,
      environment: "原布莱斯已死亡，原结局不会因新卢坎出现而重置。", practice: { vision: "原SM5-LENS-1已戴好，原标记实际已看见。", cage: "原达芙宁在WAITING，囚笼已结束。", position: "原本人ROOM，原天气已经实际观察。", history: ["原失败后已沿原6米路线返回。"] }, workshop: workshop() };
    const before = structuredClone(history); render(<MysticStarMysticHistory starMystic={history} />);
    const region = screen.getByRole("region", { name: "星象师时期的经历" });
    for (const text of ["SM5-LENS-1", "原达芙宁", "原天气", "原布莱斯已死亡", "掌握 27", "SM5-POTION-1", "已耗用，原失败记录保留", "SP-SCROLL-6", "SP-SCROLL-5"]) expect(region.textContent).toContain(text);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull(); expect(history).toEqual(before);
  });
});
