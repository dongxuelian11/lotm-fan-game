/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChaosHunterPanel, type ChaosHunterPanelProps } from "../../src/renderer/ChaosHunterPanel";
import type { ChaosHunterAction, ChaosHunterCommand, ChaosHunterProjection } from "../../src/domain/chaos-hunter/types";
import { CHAOS_HUNTER_ABILITIES, CHAOS_HUNTER_CONSUMPTION_RISK, CHAOS_HUNTER_FORMULA_STATUS, CHAOS_HUNTER_SOURCE_STATUS } from "../../src/domain/chaos-hunter/content";
import { createChaosHunterLifeState } from "../../src/domain/chaos-hunter/life";

type Attempt = NonNullable<ChaosHunterProjection["life"]["currentAttempt"]>;
type CaseId = ChaosHunterProjection["life"]["cases"][number]["id"];
const action = (command: ChaosHunterCommand, label: string, cost = "0行动", extra: Partial<Omit<ChaosHunterAction, "command">> = {}): ChaosHunterAction =>
  ({ id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra });
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取混乱猎手专业指导", "1行动 · 500便士");
const consume = (id = "chaos-hunter-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");

// Isolated typed public display fixtures, never campaign saves or claims of natural outcomes.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 95, date: { epoch: "FIFTH_EPOCH", year: 1351, month: 8, day: 19 }, method: "ABILITY", closed: false, result: "NONE",
    initialSpirituality: 48, initialMind: 90, initialKnowledge: 30, initialWilling: true,
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], guideMoves: [], personMoves: [], objectMoves: [], steps: [],
    resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0, objectChecked: false, consent: "UNASKED", consentWithdrawn: false, selfConsent: false, expressedAction: null,
    abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null, ruleActive: false, stopped: false, pendingRemainingSeconds: 0,
    ruleCancelled: false, ruleExpired: false, waitedSeconds: 0, waitCompleted: false, playerAttempted: false, partnerAttempted: false, playerResult: null, partnerResult: null,
    playerBlocked: false, partnerBlocked: false, playerAtSecond: null, partnerAtSecond: null,
    resultRead: false, paperRead: false, objectTaken: false, limitedConfirmed: false, rejectedClaims: 0, objectsReturned: false, ordinaryChecked: false,
    evidence: [], outcomeRecorded: false, outcome: null, ...extra };
}
function cast(extra: Partial<Attempt> = {}): Attempt {
  return attempt({ objectChecked: true, paperRead: true, consent: "GRANTED", selfConsent: true, expressedAction: "WALK_A_TO_B", abilityTier: "SUCCESS", abilitySourceId: "PLAYER_AND_CH3-MIRA", abilityAtSecond: 20,
    abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: 42, tier: "SUCCESS" },
    ruleActive: true, pendingRemainingSeconds: 20, resolutionPaid: true, resolutionActions: 1, spiritualitySpent: 5, mindSpent: 2, elapsedSeconds: 20, playerTravelMetres: 4,
    playerMoves: [{ from: "START", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: [] }],
    guideMoves: [{ from: "START", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: ["CH3-PARCEL", "CH3-RULE-PAPER", "CH3-LINE"] },
      { from: "A", to: "B", mode: "WALK", metres: 4, seconds: 4, itemIds: ["CH3-PARCEL"] }, { from: "B", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: [] }], ...extra });
}
function life(): ChaosHunterProjection["life"] {
  const state = createChaosHunterLifeState();
  return { ...state, title: "三个有限双方规则试验G", story: "施术检定和双方后来实际试走分别保存。", summary: "原人、原纸、原包与原标条各自保持。", environment: "START到A4米，A到B4米，B只有原包空桌。", nextStep: "核对当前许可与同一原纸原包原标条。",
    inside: false, insideCase: false, currentAttempt: null, actions: [], facts: ["原纸永久写本次从A到B的越线；原人与原物均须真实返程。"],
    cases: ([
      { id: "paired-line", title: "G · 双方各一次同一标线", story: "本人和43岁米拉各自试走，自己的规则也约束本人。" },
      { id: "withdrawn-line", title: "G · 撤回许可后的普通越线", story: "米拉撤回本次许可，停止规则后双方各自普通走到B。" },
      { id: "own-line", title: "G · 本人同样受有限规则", story: "本人亲自试走，米拉在A自愿看守且本案不参与。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): ChaosHunterProjection["encounter"] {
  return { title: "埃德里克的原场冲突G", story: "新埃德里克、原棍与独立灵性。", status: "AVAILABLE", inside: false, scene: null, enemy: null,
    playerBodyPending: false, enemyBodyPending: false, breachReady: false, intimidationReady: false, deprivationReady: false, composureReady: false,
    actions: [], facts: ["2米净空原场与4米普通出口，无追逐，没有第三人在场。"] };
}
function projection(extra: Partial<ChaosHunterProjection> = {}): ChaosHunterProjection {
  return { title: "混乱猎手与有限规则", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限双方规则G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `chaos-hunter-potion-${n}`, title: `混乱猎手第${n}独立原瓶`, source: `CH3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `chaos-hunter-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对既往原记录", completedWeek: 90 }, { taskId: "CHECK_LIMITS", title: "核验有限边界", completedWeek: 91 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 92 }],
    preparedWeek: null, abilities: CHAOS_HUNTER_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原律令法师消化100，晋升后已满12整周。", pollution: 3,
    risk: CHAOS_HUNTER_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原埃尔登IM4-ELDEN-VALE与原卡、原罩、原标线、原令牌已实际收束，不移动、不补能。",
    inheritedHistory: ["旧罗温IM4-ROWAN-KELL原SURRENDERED/H30/M100/S0，4轻1重伤、累计风险4；原5次ARC、3次WARD、2次COMPOSE保留。", "原埃尔登旧S8/12，六阶段原瓶、掌握、失败、原人物与原物全字段保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原标条不是墙；原350g包亲取后带回A交还，与原纸原标条一起归主。", ...extra };
}
function activate(value: ChaosHunterProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current; value.life.facts = [];
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function atA(id: CaseId, current: Attempt, actions: ChaosHunterAction[] = []): ChaosHunterProjection {
  const value = activate(projection({ promoted: true, actions, preferredActionId: actions[0]?.id ?? null }), id, current);
  value.life.playerLocation = "A"; value.life.playerTravelMetres = 4; value.life.guide.location = "A"; value.life.guideTravelMetres = 12;
  value.life.clockSeconds = current.elapsedSeconds; value.life.paper.holder = "PLAYER"; value.life.paper.location = "A";
  value.life.parcel.holder = "TABLE"; value.life.parcel.location = "B"; value.life.line.holder = "FLOOR"; value.life.line.location = "A";
  return value;
}
function panel(value = projection(), props: Partial<Omit<ChaosHunterPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<ChaosHunterPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择混乱猎手事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("ChaosHunterPanel independent originals and saved intentions", () => {
  it("leads with verified sequence names, unknown recipe and one simple paid goal", () => {
    const reason = "原律令法师只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "混乱猎手与有限规则" })); expect(screen.getByRole("region", { name: "混乱猎手" })).toBeTruthy(); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const summary = screen.getByRole("region", { name: "混乱猎手当前目标" });
    for (const text of [reason, "混乱猎手为序列3", "平衡者2", "仅开放有限双方规则", "不提供完整配方", "晋升仍须完成专业准备", "成本与数值", "以当前说明为准"]) expect(summary.textContent).toContain(text);
    const resources = screen.getByRole("region", { name: "混乱猎手当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取混乱猎手专业指导").disabled).toBe(true); expect(button("听取混乱猎手专业指导").getAttribute("aria-describedby")).toContain("chaos-hunter-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原人物、原物与旧审判者路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取混乱猎手专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows projected professional preparation before optional original bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "写下实际停止与返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "chaos-hunter-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "混乱猎手下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it.each(["POTION_WORK", "BUY_POTION"] as const)("selects another original and forwards its exact %s intent only once", async type => {
    const first = action({ type, bottleId: "chaos-hunter-potion-1" }, "第一原瓶实际交付", "1行动"), second = action({ type, bottleId: "chaos-hunter-potion-2" }, "第二原瓶实际交付", "0行动 · 900便士");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:chaos-hunter-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews only the selected bottle, preparation, four risks and preserved original history", async () => {
    const first = consume(), second = consume("chaos-hunter-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 121, insideCase: true });
    const { onCommand, onClose } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:chaos-hunter-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "混乱猎手原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "混乱猎手第2独立原瓶" }));
    for (const text of ["chaos-hunter-potion-2", "CH3-SEAL-2", "73%", "第121周", "140便士不退", "意志难度30", "大成功", "成功", "失败", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整主辅配方", "仍须完成服药准备", "旧罗温原投降和原伤不变", "原伙伴与原物不重开"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("CH3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "混乱猎手原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the same confirmed intent locked through save failure until committed facts change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 121 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<ChaosHunterPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "混乱猎手原瓶服用确认" })).toBeTruthy();
    rerender(<ChaosHunterPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<ChaosHunterPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "混乱猎手原瓶服用确认" })).toBeNull();
    expect(button("关闭混乱猎手页面").disabled).toBe(false); expect(picker().value).toBe("case:paired-line"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { disabled: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks commands, selection and close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取混乱猎手专业指导")); fireEvent.click(button("关闭混乱猎手页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取混乱猎手专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates an unsubmitted review if saved eligibility changes", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<ChaosHunterPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "混乱猎手原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows all real costs and future supply without exposing an invented recipe", async () => {
    panel(); await open("独立成品与晋升准备"); const boundary = screen.getByRole("region", { name: "混乱猎手成品与配方边界" });
    for (const text of ["500", "6400", "5500", "900", "12整周", "消化100", "140", "健康>20", "精神>40", "下一真实周", "完整主辅配方、材料用量、调配顺序与晋升仪式尚未获得，仍保持未知，仍须完成服药准备。", "核对原记录、检查有限边界、标明真实退出是实际专业准备，服药前仍须逐项完成。三原瓶耗尽后须申请并等下一真实周独立供货，不重置旧瓶、不开放自制配方。", "不开放自制配方"]) expect(boundary.textContent).toContain(text);
  });

  it("forwards paid preparation cancellation without refunding or consuming an original locally", () => {
    const leave = action({ type: "LEAVE_PREPARATION" }, "结束本次已付准备", "0行动 · 140便士不退"), value = projection({ preparedWeek: 121, actions: [leave], preferredActionId: leave.id }), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "混乱猎手服药准备与成本" }).textContent).toContain("未服原瓶仍保留");
  });
});

describe("ChaosHunterPanel current consent and two real bodies", () => {
  it("selects each distinct original scene locally while keeping history folded", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of value.life.cases) {
      await userEvent.selectOptions(picker(), `case:${entry.id}`);
      expect(screen.getByRole("region", { name: "当前混乱猎手生活情境" }).textContent).toContain(entry.story);
    }
    expect(fold("三项原案的观察与实际结果").open).toBe(false); expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["ABILITY", "ORDINARY"] as const)("forwards %s preparation without local cost or rule mutation", method => {
    const entry = action({ type: "PREPARE", caseId: "paired-line", method }, `准备${method}原标线`, "1行动 · 另留实施1行动"), value = projection({ promoted: true, actions: [entry], preferredActionId: entry.id });
    value.life.cases[0]!.status = "OBSERVED"; const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(entry.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(value).toEqual(before); expect(value.life.currentAttempt).toBeNull();
  });

  it("distinguishes successful paid preparation from either actor actually attempting the line", () => {
    const step = action({ type: "TRY_PLAYER", caseId: "paired-line" }, "本人实际试走一次", "0行动 · 尝试1秒"), value = atA("paired-line", cast(), [step]), before = structuredClone(value), { onCommand } = panel(value);
    const current = screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" });
    for (const text of ["当前仅同意这一次", "自己的规则也约束本人", "没有自动豁免", "20 秒", "尚无实际拦停记录", "灵性 5", "精神 2", "实施行动 1"]) expect(current.textContent).toContain(text);
    const result = screen.getByRole("region", { name: "混乱猎手双方各一次真实试走" });
    for (const text of ["本人实际尝试 0 次", "米拉实际尝试 0 次", "不显示想象中的结果"]) expect(result.textContent).toContain(text);
    expect(picker().disabled).toBe(true); expect(button("关闭混乱猎手页面").disabled).toBe(true);
    fireEvent.click(button(step.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(step.command); expect(value).toEqual(before); expect(result.textContent).toContain("本人实际尝试 0 次");
  });

  it.each(["TRY_PLAYER", "TRY_PARTNER"] as const)("keeps the other original actor unattempted after saved %s", type => {
    const step = action({ type, caseId: "paired-line" }, type === "TRY_PLAYER" ? "本人第一次试走" : "米拉第一次试走"), value = atA("paired-line", cast(), [step]);
    const { onCommand, defaults, rerender } = panel(value); fireEvent.click(button(step.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(step.command);
    const saved = structuredClone(value), current = saved.life.currentAttempt!;
    if (type === "TRY_PLAYER") Object.assign(current, { playerAttempted: true, playerResult: "A", playerBlocked: true, playerAtSecond: 21 });
    else Object.assign(current, { partnerAttempted: true, partnerResult: "A", partnerBlocked: true, partnerAtSecond: 21 });
    current.pendingRemainingSeconds = 19; current.elapsedSeconds = 21; saved.life.clockSeconds = 21; saved.actions = []; saved.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={saved} />);
    const result = screen.getByRole("region", { name: "混乱猎手双方各一次真实试走" });
    expect(result.textContent).toContain(`本人实际尝试 ${type === "TRY_PLAYER" ? 1 : 0} 次`); expect(result.textContent).toContain(`米拉实际尝试 ${type === "TRY_PARTNER" ? 1 : 0} 次`);
    expect(result.textContent).toContain("被有限规则拦停在A，没有移动"); expect(saved.life.playerLocation).toBe("A"); expect(saved.life.volunteer.location).toBe("A"); expect(saved.life.parcel.location).toBe("B");
    expect(saved.abilities[0]!.mastery).toBe(0); expect(value.life.currentAttempt!.playerAttempted).toBe(false); expect(value.life.currentAttempt!.partnerAttempted).toBe(false);
  });

  it("requires STOP_RULE after current consent withdrawal before either ordinary crossing", async () => {
    const stop = action({ type: "STOP_RULE", caseId: "withdrawn-line" }, "停止本次未用规则");
    const player = action({ type: "TRY_PLAYER", caseId: "withdrawn-line" }, "本人按当前普通意愿越线", "0行动 · 4米5秒", { enabled: false, reason: "许可已撤回，须先STOP_RULE。" });
    const partner = action({ type: "TRY_PARTNER", caseId: "withdrawn-line" }, "米拉按当前普通意愿越线", "0行动 · 4米5秒", { enabled: false, reason: "许可已撤回，须先STOP_RULE。" });
    const value = atA("withdrawn-line", cast({ consent: "REVOKED", consentWithdrawn: true }), [stop, player, partner]); value.life.volunteer.willing = false;
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); await open("其它步骤与未满足条件");
    expect(button(player.label).disabled).toBe(true); expect(button(partner.label).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" }).textContent).toContain("必须STOP_RULE后双方才能");
    fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
    const stopped = structuredClone(value); Object.assign(stopped.life.currentAttempt!, { ruleActive: false, stopped: true, pendingRemainingSeconds: 0 }); stopped.actions = [{ ...player, enabled: true, reason: null }]; stopped.preferredActionId = player.id;
    rerender(<ChaosHunterPanel {...defaults} value={stopped} />); expect(screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" }).textContent).toContain("已实际停止");
    fireEvent.click(button(player.label)); expect(onCommand.mock.calls[1]![0]).toBe(player.command); expect(stopped.life.playerLocation).toBe("A"); expect(stopped.life.volunteer.location).toBe("A");
    const walked = structuredClone(stopped); Object.assign(walked.life.currentAttempt!, { playerAttempted: true, playerResult: "B", playerAtSecond: 26 }); walked.life.playerLocation = "B"; walked.life.paper.location = "B"; walked.actions = []; walked.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={walked} />); expect(screen.getByRole("region", { name: "混乱猎手双方各一次真实试走" }).textContent).toContain("按普通意愿从A实走4米至B");
    expect(walked.life.volunteer.location).toBe("A"); expect(walked.abilities[0]!.mastery).toBe(0); expect(walked.life.currentAttempt!.spiritualitySpent).toBe(5);
  });

  it("forwards an early consent withdrawal without locally clearing the paid rule", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "paired-line" }, "米拉撤回当前规则参与"), value = atA("paired-line", cast(), [withdraw]), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(value).toEqual(before);
    expect(value.life.currentAttempt!.pendingRemainingSeconds).toBe(20); expect(value.life.currentAttempt!.consent).toBe("GRANTED");
  });

  it("stops unspent rule effects without erasing either previously blocked physical attempt", () => {
    const stop = action({ type: "STOP_RULE", caseId: "paired-line" }, "明确停止剩余规则"), value = atA("paired-line", cast({ playerAttempted: true, partnerAttempted: true, playerResult: "A", partnerResult: "A", playerBlocked: true, partnerBlocked: true, playerAtSecond: 21, partnerAtSecond: 22, pendingRemainingSeconds: 18 }), [stop]);
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
    const stopped = structuredClone(value); Object.assign(stopped.life.currentAttempt!, { stopped: true, ruleActive: false, pendingRemainingSeconds: 0 }); stopped.actions = []; stopped.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={stopped} />); const current = screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" });
    for (const text of ["已实际停止", "既有尝试、位置与结果不回滚", "灵性 5", "精神 2"]) expect(current.textContent).toContain(text);
    const result = screen.getByRole("region", { name: "混乱猎手双方各一次真实试走" }); expect(result.textContent).toContain("本人实际尝试 1 次"); expect(result.textContent).toContain("米拉实际尝试 1 次");
    expect(stopped.life.paper.text).toBe("本次从A到B的越线"); expect(stopped.life.playerLocation).toBe("A");
  });

  it("retains failed ability costs and forwards later ordinary movement without another paid attempt", () => {
    const current = cast({ abilityTier: "FAILURE", abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: 90, tier: "FAILURE" }, ruleActive: false, pendingRemainingSeconds: 0 });
    const step = action({ type: "TRY_PARTNER", caseId: "paired-line" }, "米拉普通走到B", "0行动 · 不再收实施行动"), value = atA("paired-line", current, [step]), before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true); expect(fold("本次实际尝试与已付代价").textContent).toContain("失败费用保留");
    const facts = screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" }); expect(facts.textContent).toContain("实际检定失败"); expect(facts.textContent).toContain("实施行动 1");
    fireEvent.click(button(step.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(step.command); expect(value).toEqual(before); expect(value.abilities[0]!.mastery).toBe(0);
  });

  it("offers the public ordinary method after a decline without enabling a blocked ability", async () => {
    const ability = action({ type: "PERFORM", caseId: "paired-line" }, "施用本次双方规则", "1行动 · 5灵性2精神", { enabled: false, reason: "米拉当前拒绝规则参与。" });
    const ordinary = action({ type: "ORDINARY_CHECK", caseId: "paired-line" }, "本次采用普通核验", "1行动 · 0灵性0精神"), value = atA("paired-line", attempt({ objectChecked: true, paperRead: true, consent: "DECLINED" }), [ordinary, ability]); value.life.volunteer.willing = false;
    const before = structuredClone(value), { onCommand } = panel(value); await open("其它步骤与未满足条件"); expect(button(ability.label).disabled).toBe(true); fireEvent.click(button(ability.label)); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" }).textContent).toContain("当前已拒绝");
  });

  it("shows exact original paper, non-wall line, table parcel and independent original positions", () => {
    const value = atA("paired-line", cast()), before = structuredClone(value); value.life.volunteer.location = "B"; const { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "混乱猎手原人原物与真实位置" });
    for (const text of ["本人实际在A", "米拉·佩恩", "43岁", "CH3-MIRA", "本人实际在B", "健康 100", "精神 100", "唯一350克", "CH3-PARCEL", "真实放在空桌上", "CH3-LINE", "它不是墙", "CH3-RULE-PAPER", "永久写“本次从A到B的越线”", "薇娜·贝尔"]) expect(facts.textContent).toContain(text);
    expect(value.life.playerLocation).toBe(before.life.playerLocation); expect(value.life.parcel.holder).toBe("TABLE"); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the own-line player subject to the rule and the non-participating partner at A", async () => {
    const self = action({ type: "TRY_PLAYER", caseId: "own-line" }, "本人也受规则并实际试走"), other = action({ type: "TRY_PARTNER", caseId: "own-line" }, "米拉代替本人试走", "0行动", { enabled: false, reason: "本人案米拉不参与。" });
    const value = atA("own-line", cast(), [self, other]), before = structuredClone(value), { onCommand } = panel(value);
    const current = screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" });
    for (const text of ["自己也受同一规则", "米拉本案不参与", "不受本案规则效果"]) expect(current.textContent).toContain(text);
    await open("其它步骤与未满足条件"); expect(button(other.label).disabled).toBe(true); fireEvent.click(button(self.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(self.command); expect(value).toEqual(before);
  });

  it("keeps a physical command locked after save failure and does not advance either body or clock", () => {
    const step = action({ type: "TRY_PLAYER", caseId: "paired-line" }, "本人实际尝试越线一次"), value = atA("paired-line", cast(), [step]), before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    fireEvent.click(button(step.label)); rerender(<ChaosHunterPanel {...defaults} error={{ message: "原试走保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复付费、服药、施术、执行原动作或归还原物"); expect(button(step.label).disabled).toBe(true); expect(picker().disabled).toBe(true);
    rerender(<ChaosHunterPanel {...defaults} value={structuredClone(value)} />); fireEvent.click(button(step.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(step.command); expect(value).toEqual(before);
  });
});
describe("ChaosHunterPanel real ordinary returns and finite time", () => {
  it("waits only for the public remaining effect and renders committed expiry without imaginary attempts", () => {
    const wait = action({ type: "WAIT_EFFECT", caseId: "paired-line" }, "实际等待剩余20秒"), value = atA("paired-line", cast(), [wait]), { onCommand, defaults, rerender } = panel(value);
    fireEvent.click(button(wait.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(wait.command); expect(value.life.clockSeconds).toBe(20);
    const expired = structuredClone(value); Object.assign(expired.life.currentAttempt!, { ruleActive: false, ruleExpired: true, waitCompleted: true, waitedSeconds: 20, pendingRemainingSeconds: 0, elapsedSeconds: 40 }); expired.life.clockSeconds = 40; expired.actions = []; expired.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={expired} />); const facts = screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" });
    for (const text of ["实际等待 20 秒", "随真实时间到期", "不能重复等待推进时间", "已付代价不退", "灵性 5", "精神 2"]) expect(facts.textContent).toContain(text);
    const result = screen.getByRole("region", { name: "混乱猎手双方各一次真实试走" }); expect(result.textContent).toContain("本人实际尝试 0 次"); expect(result.textContent).toContain("米拉实际尝试 0 次"); expect(expired.abilities[0]!.mastery).toBe(0);
  });

  it("returns Mira by her own body without silently moving the player or table parcel", () => {
    const go = action({ type: "RETURN_PERSON", caseId: "paired-line" }, "米拉本人普通返回A", "0行动 · 4米4秒"), value = atA("paired-line", cast({ ruleActive: false, stopped: true, pendingRemainingSeconds: 0, playerAttempted: true, partnerAttempted: true, playerResult: "B", partnerResult: "B", resultRead: true }), [go]);
    value.life.playerLocation = "B"; value.life.paper.location = "B"; value.life.volunteer.location = "B";
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); fireEvent.click(button(go.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(go.command); expect(value).toEqual(before);
    const returned = structuredClone(value); returned.life.volunteer.location = "A"; returned.life.clockSeconds += 4; returned.actions = []; returned.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={returned} />); const facts = screen.getByRole("region", { name: "混乱猎手原人原物与真实位置" });
    expect(facts.textContent).toContain("本人实际在B"); expect(facts.textContent).toContain("玩家不会随她移动"); expect(returned.life.playerLocation).toBe("B"); expect(returned.life.parcel.holder).toBe("TABLE");
  });

  it("forwards a zero-action actual pickup at B without placing the original parcel in hand locally", () => {
    const take = action({ type: "TAKE_OBJECT", caseId: "paired-line" }, "在B亲手取同一原包", "0行动"), value = atA("paired-line", cast({ ruleActive: false, stopped: true, pendingRemainingSeconds: 0, resultRead: true }), [take]);
    value.life.playerLocation = "B"; value.life.paper.location = "B"; value.resources!.actionsRemaining = 0;
    const before = structuredClone(value), { onCommand } = panel(value); expect(button(take.label).disabled).toBe(false); fireEvent.click(button(take.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(take.command); expect(value).toEqual(before); expect(value.life.parcel.holder).toBe("TABLE");
  });

  it("requires return of all three originals and an actual START exit before local close", () => {
    const give = action({ type: "RETURN_OBJECT", caseId: "paired-line" }, "当面归还原包原纸并收起标条");
    const leave = action({ type: "LEAVE_CASE", caseId: "paired-line" }, "关闭已真实退出的原现场", "0行动", { enabled: false, reason: "原物尚未归还，本人与导师尚未到START。" });
    const value = atA("paired-line", cast({ ruleActive: false, stopped: true, pendingRemainingSeconds: 0, playerAttempted: true, partnerAttempted: true, playerResult: "B", partnerResult: "B", resultRead: true, objectTaken: true }), [give, leave]); value.life.parcel.holder = "PLAYER"; value.life.parcel.location = "A"; value.resources!.actionsRemaining = 0;
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value); expect(button(leave.label).disabled).toBe(true); expect(button("关闭混乱猎手页面").disabled).toBe(true);
    fireEvent.click(button(give.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(give.command); expect(value).toEqual(before);
    const returned = structuredClone(value); returned.life.currentAttempt!.objectsReturned = true; returned.life.parcel.holder = "GUIDE"; returned.life.paper.holder = "GUIDE"; returned.life.line.holder = "GUIDE"; returned.actions = []; returned.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={returned} />); expect(button("关闭混乱猎手页面").disabled).toBe(true);
    const atStart = structuredClone(returned); atStart.life.playerLocation = "START"; atStart.life.guide.location = "START"; atStart.life.parcel.location = "START"; atStart.life.paper.location = "START"; atStart.life.line.location = "START"; atStart.life.currentAttempt!.outcomeRecorded = true; atStart.actions = [{ ...leave, enabled: true, reason: null }]; atStart.preferredActionId = leave.id;
    rerender(<ChaosHunterPanel {...defaults} value={atStart} />); expect(button("关闭混乱猎手页面").disabled).toBe(true); fireEvent.click(button(leave.label)); expect(onCommand.mock.calls[1]![0]).toBe(leave.command);
    const closed = structuredClone(atStart); closed.insideCase = false; closed.life.inside = false; closed.life.insideCase = false; closed.life.activeCase = null; closed.life.currentAttempt = null; closed.life.cases[0]!.contactOpen = false; closed.life.cases[0]!.status = "EXAMINED"; closed.actions = []; closed.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={closed} />); fireEvent.click(button("关闭混乱猎手页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).toHaveBeenCalledTimes(2); expect(closed.life.volunteer.location).toBe("A");
  });

  it("renders each original movement receipt without replacing it with a narrative teleport", async () => {
    const current = cast({ personMoves: [{ from: "B", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: [] }], objectMoves: [{ from: "A", to: "B", mode: "WALK", metres: 4, seconds: 4, itemIds: ["CH3-PARCEL"] }],
      evidence: [{ sourceId: "CH3-RULE-PAPER", atSecond: 18, text: "亲读同一原纸，本次从A到B的越线不变。" }] });
    panel(atA("paired-line", current)); await open("本次实际尝试与已付代价"); const receipt = fold("本次实际尝试与已付代价");
    for (const text of ["本人普通步行 4 米、4 秒", "同一米拉自主步行 4 米、4 秒", "原物 CH3-PARCEL 实际随持有人移动 4 米、4 秒", "原导师普通步行 4 米、4 秒", "第18秒 · 原来源CH3-RULE-PAPER"]) expect(receipt.textContent).toContain(text);
  });

  it("does not claim the player already consented before the original check", () => {
    const value = atA("own-line", attempt()), before = structuredClone(value); panel(value);
    const current = screen.getByRole("region", { name: "混乱猎手当前许可与双方待用规则" }); expect(current.textContent).toContain("尚未确认自己参与"); expect(current.textContent).not.toContain("已经明确自己也受同一规则"); expect(value).toEqual(before);
  });

  it("forwards a limited conclusion without rerunning the player's first recorded trial", () => {
    const limited = action({ type: "CONFIRM_LIMITED", caseId: "own-line", claim: "LIMITED" }, "确认仅本次有限结论"), value = atA("own-line", cast({ ruleActive: false, stopped: true, pendingRemainingSeconds: 0, playerAttempted: true, playerResult: "A", playerBlocked: true, playerAtSecond: 21, resultRead: true, objectsReturned: true }), [limited]);
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(limited.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(limited.command); expect(value).toEqual(before); expect(value.life.currentAttempt!.partnerAttempted).toBe(false);
  });
});

describe("ChaosHunterPanel known boundaries and independent original combat", () => {
  it("keeps source-backed names separate from all new G rules and unknown formula or angel abilities", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("能力范围与实际掌握");
    const boundary = screen.getByRole("region", { name: "混乱猎手能力与使用范围" });
    for (const text of ["justiciar.s3.bounded-order", "和平施术1行动", "5灵性", "2精神", "知识20", "20秒", "不额外随机重掷", "本人同样受规则约束", "不改原纸", "0—36", "高阶灰白隔绝", "范围与次数以当前说明为准", "平衡者2", "不开放天使光领域", "不提供全知识别罪恶", "强制真话", "死亡判决", "最多16"]) expect(boundary.textContent).toContain(text);
    expect(CHAOS_HUNTER_ABILITIES).toHaveLength(1); expect(screen.getByText(`${CHAOS_HUNTER_ABILITIES[0]!.label} · 掌握 0：${CHAOS_HUNTER_ABILITIES[0]!.description}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /鉴定罪恶|强制真话|死亡判决|改写原纸|自动豁免/ })).toBeNull();
  });

  it("preserves Rowan's old surrendered original body, injuries and exhausted resource as read-only history", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原人物、原物与旧审判者路线记录");
    const history = screen.getByRole("region", { name: "混乱猎手继承记录" });
    for (const text of ["IM4-ROWAN-KELL", "SURRENDERED/H30/M100/S0", "4轻1重伤", "累计风险4", "5次ARC", "3次WARD", "2次COMPOSE", "IM4-ELDEN-VALE", "S8/12", "不移动、不补能", "六阶段", "不换皮重开"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("shows both independent pending BODY rules and never consumes the player's share for an enemy action", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null });
    value.encounter = { ...encounter(), status: "FIGHTING", inside: true, playerBodyPending: true, enemyBodyPending: true,
      enemy: { id: "CH3-EDRIC", name: "埃德里克·梅森", age: 44, source: "ORIGINAL_LIMITED_G", sequence: 4, health: 90, mind: 100, spirituality: 107, status: "RESISTING", weaponId: "CH3-EDRIC-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 1, WARD: 1, COMPOSE: 1 } },
      scene: { courtId: "CH3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "COURT", distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 } };
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value);
    expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    const enemy = screen.getByRole("region", { name: "混乱猎手原人遭遇" }); for (const text of ["埃德里克·梅森", "44岁", "CH3-EDRIC-ROD", "107 / 120", "实际弧光 1 次", "先付自己的全部费用", "未发动的术法不收费"]) expect(enemy.textContent).toContain(text);
    const rules = screen.getByRole("region", { name: "混乱猎手战斗双方独立BODY规则" });
    for (const text of ["仍待本人实际BODY动作独立抵抗", "仍待原敌实际BODY动作独立抵抗", "不能用原敌的一次动作偷耗本人的那一份", "ARC、WARD、COMPOSE与有伤J不受", "本人的抵抗不能算原敌违令"]) expect(rules.textContent).toContain(text);
    fireEvent.click(button("关闭混乱猎手页面")); expect(onClose).not.toHaveBeenCalled(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    const enemyActed = structuredClone(value); enemyActed.encounter.enemyBodyPending = false; enemyActed.encounter.breachReady = true;
    rerender(<ChaosHunterPanel {...defaults} value={enemyActed} />); const after = screen.getByRole("region", { name: "混乱猎手战斗双方独立BODY规则" });
    expect(after.textContent).toContain("本人BODY规则：仍待本人实际BODY动作独立抵抗"); expect(after.textContent).toContain("原敌BODY规则：当前没有待用约束"); expect(after.textContent).toContain("已有原敌实际正贡献BODY抵抗的真实来源");
    expect(enemyActed.encounter.playerBodyPending).toBe(true); expect(enemyActed.encounter.enemy!.spirituality).toBe(107);
  });

  it("shows paid enemy composure clearing only old intimidation and deprivation, leaving both new rules pending", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); value.encounter = { ...encounter(), status: "FIGHTING", inside: true, playerBodyPending: true, enemyBodyPending: true, composureReady: true };
    const before = structuredClone(value); panel(value); const rules = screen.getByRole("region", { name: "混乱猎手战斗双方独立BODY规则" });
    for (const text of ["原敌本轮已实际凝神", "不清双方BODY规则", "仍待本人实际BODY", "仍待原敌实际BODY", "轮末未用规则和违令来源清除", "已付费用不退"]) expect(rules.textContent).toContain(text); expect(value).toEqual(before);
  });

  it("forwards the original ordinary exit and waits for committed physical departure before local close", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原出口实走4米离开", "0行动 · 4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id }); value.encounter = { ...encounter(), status: "READY", inside: true };
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value);
    fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before); expect(button("关闭混乱猎手页面").disabled).toBe(true);
    const left = structuredClone(value); left.encounter.status = "RESOLVED"; left.encounter.inside = false; left.actions = []; left.preferredActionId = null;
    rerender(<ChaosHunterPanel {...defaults} value={left} />); fireEvent.click(button("关闭混乱猎手页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("shows the enemy's dead body and original rod left in the courtyard without resurrecting Rowan", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); value.encounter = { ...encounter(), status: "RESOLVED", inside: false,
      enemy: { id: "CH3-EDRIC", name: "埃德里克·梅森", age: 44, source: "ORIGINAL_LIMITED_G", sequence: 4, health: 0, mind: 100, spirituality: 17, status: "DEAD", weaponId: "CH3-EDRIC-ROD", weaponLocation: "COURT", powerUses: { ARC_BOLT: 7, WARD: 5, COMPOSE: 12 } },
      scene: { courtId: "CH3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "EXIT", distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 4 } };
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.change(picker(), { target: { value: "encounter" } });
    const enemy = screen.getByRole("region", { name: "混乱猎手原人遭遇" }); for (const text of ["原身体已死亡", "原武器 CH3-EDRIC-ROD", "留在原场", "已真实离场 4 米", "旧罗温的原投降、原伤与资源保持"]) expect(enemy.textContent).toContain(text);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves a dead player as read-only while allowing local archive navigation", () => {
    const value = projection(); value.resources!.health = 0; value.encounter.inside = true;
    const { onCommand, onClose } = panel(value); expect(screen.getByRole("region", { name: "混乱猎手当前目标" }).textContent).toContain("本周目已经死亡");
    expect(screen.queryByRole("button", { name: /^听取混乱猎手/ })).toBeNull(); fireEvent.click(button("关闭混乱猎手页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
  });
});


describe("ChaosHunter exact authored paragraph display", () => {
  it("adapts authored source paragraphs without mutating fixture commands or costs", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value);
    const { onCommand } = panel(value);
    await open("独立成品与晋升准备");
    await open("能力范围与实际掌握");
    expect(screen.queryByText(CHAOS_HUNTER_FORMULA_STATUS)).toBeNull();
    expect(screen.getByText("混乱猎手为序列3，下一阶段为平衡者2；混乱猎手完整主辅配方、材料用量、调配顺序与晋升仪式尚未获得，仍保持未知，仍须完成服药准备。同一位原成年导师薇娜·贝尔只经独立成品渠道交接本批三个独立原瓶，实际准备原调解处旁安静原房、普通退出路线与在场支持。三项专业准备和当周房间检查仍须完成，不开放自制魔药。")).toBeTruthy();
    expect(screen.queryByText(CHAOS_HUNTER_SOURCE_STATUS)).toBeNull();
    expect(screen.getByText("混乱猎手序列3有限继承旧禁令和剥夺，新增有限双方规则；效果可能受阻或失败，不保证对任何目标生效。当前渠道只提供成品魔药，晋升仍须专业准备，不获得神器光枪或封锁空间能力。下一阶段为平衡者2，本阶段不开放天使光领域。43岁成年自主志愿者CH3-MIRA米拉·佩恩、44岁成年CH3-EDRIC埃德里克·梅森、场地、原纸原包原标条、当前许可、20秒窗口、全部距离、成本、检定、数值和奖励均以当前说明为准。规则只管本次两人各一次尚未执行的A到B试走，双方同受约束，不改原纸、不追改过去、不传送或复位已发生动作；和平合作不等于敌人必服。没有全知识别罪恶、任意改规则、强制真话、死亡判决或永久控制。仲裁人至律令法师六个旧阶段全字段冻结，原罗温IM4-ROWAN-KELL原伤势、资源与投降结果保留；旧伙伴和原物不移动、不返能，原身体与普通死亡不因本次晋升重开。")).toBeTruthy();
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
