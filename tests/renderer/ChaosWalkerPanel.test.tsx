/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChaosWalkerPanel, type ChaosWalkerPanelProps } from "../../src/renderer/ChaosWalkerPanel";
import type { ChaosWalkerAction, ChaosWalkerCommand, ChaosWalkerProjection } from "../../src/domain/chaos-walker/types";
import { CHAOS_WALKER_ABILITIES, CHAOS_WALKER_CONSUMPTION_RISK, CHAOS_WALKER_FORMULA_STATUS, CHAOS_WALKER_SOURCE_STATUS } from "../../src/domain/chaos-walker/content";
import { createChaosWalkerLifeState, validateChaosWalkerActivityCommand } from "../../src/domain/chaos-walker/life";
import { validateChaosWalkerAcquisitionCommand } from "../../src/domain/chaos-walker/index";
import { validateChaosWalkerEncounterCommand } from "../../src/domain/chaos-walker/encounter";

type Attempt = NonNullable<ChaosWalkerProjection["life"]["currentAttempt"]>;
type CaseId = ChaosWalkerProjection["life"]["cases"][number]["id"];
const action = (command: ChaosWalkerCommand, label: string, cost = "0行动", extra: Partial<Omit<ChaosWalkerAction, "command">> = {}): ChaosWalkerAction => {
  expect(validateChaosWalkerAcquisitionCommand(command) || validateChaosWalkerActivityCommand(command) || validateChaosWalkerEncounterCommand(command)).toBe(true);
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
};
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取混乱行者专业指导", "1行动 · 500便士");
const consume = (id = "chaos-walker-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");
const luck = () => ({ stored: 1, capacity: 3 as const, accumulated: 7, spent: 6, lastAccumulateWeek: 87 });

// Isolated, structurally typed public projections exercise display and exact intentions.
// They are not campaign saves and do not claim natural random outcomes or promotion.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 103, date: { epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 12 }, method: "ABILITY", closed: false, result: "NONE",
    initialSpirituality: 48, initialMind: 90, initialKnowledge: 30, initialLuck: { stored: 1, accumulated: 7, spent: 6, lastAccumulateWeek: 87 },
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], guideMoves: [], objectMoves: [], steps: [], resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0, luckSpent: 0, luckBefore: null, luckAfter: null,
    objectChecked: false, consent: "UNASKED", consentWithdrawn: false, abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null,
    inputActive: false, stopped: false, pendingRemainingSeconds: 0, modifierApplied: false, modifierCancelled: false, modifierExpired: false, waitedSeconds: 0, waitCompleted: false,
    branchRoll: null, branchChance: null, branchResult: null, eventDraws: 0, eventAtSecond: null, eventSourceId: null, resultRead: false, recordRead: false, compared: false, limitedConfirmed: false, rejectedClaims: 0,
    objectsReturned: false, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null, ...extra };
}
function cast(extra: Partial<Attempt> = {}): Attempt {
  return attempt({ objectChecked: true, consent: "GRANTED", abilityTier: "SUCCESS", abilitySourceId: "CW3-CART", abilityAtSecond: 8,
    abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: 42, tier: "SUCCESS" },
    inputActive: true, pendingRemainingSeconds: 30, resolutionPaid: true, resolutionActions: 1, spiritualitySpent: 5, mindSpent: 1, luckSpent: 1,
    luckBefore: { stored: 1, accumulated: 7, spent: 6, lastAccumulateWeek: 87 }, luckAfter: { stored: 0, accumulated: 7, spent: 7, lastAccumulateWeek: 87 }, ...extra });
}
function life(): ChaosWalkerProjection["life"] {
  const state = createChaosWalkerLifeState();
  return { ...state, title: "三项有限概率实践G", story: "布置与之后实际发生的分支分别保存。", summary: "唯一旧幸运与实际原物状态。", environment: "START到A4米，A到B或C各4米。", nextStep: "先核对同一原物。",
    inside: false, insideCase: false, currentAttempt: null, actions: [], luck: luck(),
    facts: ["原车、原包、原签和原转盘分别保留真实所有者与位置。"],
    cases: ([
      { id: "cart-fork", title: "G · 原车的两个真实岔道", story: "CW3-CART携同一400克CW3-PARCEL从A实际走B或C；结果不能重掷。" },
      { id: "revoked-draw", title: "G · 撤回后的原抽签", story: "薇拉撤回能力许可后只同意亲手普通抽签。" },
      { id: "counterexample", title: "G · 原转盘的真实反例", story: "原指针与B处原预测纸分别核读；25%仍可能落A。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): ChaosWalkerProjection["encounter"] {
  return { title: "加雷斯的原场冲突G", story: "原加雷斯、原棍与独立灵性。", status: "AVAILABLE", inside: false, scene: null, enemy: null, pendingKind: null, composureReady: false,
    luck: luck(), actions: [], facts: ["2米净空原场与4米普通出口，无追逐，没有第三人在场。"] };
}
function projection(extra: Partial<ChaosWalkerProjection> = {}): ChaosWalkerProjection {
  return { title: "混乱行者与有限概率", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限概率与实际核验G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；批次耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `chaos-walker-potion-${n}`, title: `混乱行者第${n}独立原瓶`, source: `CW3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `chaos-walker-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对既往原记录", completedWeek: 99 }, { taskId: "CHECK_LIMITS", title: "核验有限边界", completedWeek: 100 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 101 }],
    preparedWeek: null, abilities: CHAOS_WALKER_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原厄运法师消化100，晋升后已满12整周。", pollution: 3,
    risk: CHAOS_WALKER_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原MM4-BAG-1仍归塞拉，效果已结束；旧原物不补回。",
    inheritedHistory: ["怪物、机器、幸运者、灾祸教士、赢家与厄运法师六阶段原记录保持。", "原费里斯仍投降H70/M100/S16，一处原重伤保持。", "旧掌握0保留，原累计积累7、支付6、余1份保持。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "本人START至A实走4米，原车分支到B或C后须实际推回。", ...extra };
}
function activate(value: ChaosWalkerProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current; value.life.facts = [];
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function panel(value = projection(), props: Partial<Omit<ChaosWalkerPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<ChaosWalkerPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择混乱行者事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("ChaosWalkerPanel independent originals and saved command boundaries", () => {
  it("leads with the candidate mapping, directly supported next names and visible paid resources", () => {
    const reason = "原厄运法师只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "混乱行者与有限概率" })); expect(screen.getByRole("region", { name: "混乱行者" })).toBeTruthy(); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const summary = screen.getByRole("region", { name: "混乱行者当前目标" });
    for (const text of [reason, "厄运法师4", "混乱行者3", "混乱行者与有限概率", "两项有限概率能力", "晋升须取得独立成品", "完成专业准备", "具体条件、成本与风险"]) expect(summary.textContent).toContain(text);
    const resources = screen.getByRole("region", { name: "混乱行者当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取混乱行者专业指导").disabled).toBe(true); expect(button("听取混乱行者专业指导").getAttribute("aria-describedby")).toContain("chaos-walker-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原人物、原物与旧命运之轮路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取混乱行者专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows the projected preparation ahead of optional bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "写下本人实际停止与返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "chaos-walker-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "混乱行者下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it("selects another original bottle locally and submits its exact command only once", async () => {
    const first = action({ type: "POTION_WORK", bottleId: "chaos-walker-potion-1" }, "第一原瓶实际劳务", "1行动"), second = action({ type: "POTION_WORK", bottleId: "chaos-walker-potion-2" }, "第二原瓶实际劳务", "1行动");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:chaos-walker-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews only the selected original, paid preparation, unknown ritual and all four risks", async () => {
    const first = consume(), second = consume("chaos-walker-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 102 });
    const { onCommand, onClose } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:chaos-walker-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "混乱行者原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "混乱行者第2独立原瓶" }));
    for (const text of ["chaos-walker-potion-2", "CW3-SEAL-2", "73%", "第102周", "140便士不退", "意志难度30", "大成功", "成功", "失败", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整配方", "服用前需要专业准备", "唯一原幸运储备不补满"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("CW3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "混乱行者原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("retains the selected confirmed intent through save failure without local resubmission", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 102 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<ChaosWalkerPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "混乱行者原瓶服用确认" })).toBeTruthy();
    rerender(<ChaosWalkerPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<ChaosWalkerPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "混乱行者原瓶服用确认" })).toBeNull();
    expect(button("关闭混乱行者页面").disabled).toBe(false); expect(picker().value).toBe("case:cart-fork"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { disabled: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks commands, selection and close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取混乱行者专业指导")); fireEvent.click(button("关闭混乱行者页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取混乱行者专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates a pending review when saved eligibility changes", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<ChaosWalkerPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "混乱行者原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("leaves inherited originals and old reserve history read only", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原人物、原物与旧命运之轮路线记录");
    const history = screen.getByRole("region", { name: "混乱行者继承记录" });
    for (const text of ["MM4-BAG-1", "仍归塞拉", "原费里斯仍投降", "H70/M100/S16", "旧掌握0", "积累7", "支付6", "不免费补血"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("keeps the death record read only while permitting local close", () => {
    const value = projection(); value.resources!.health = 0; const { onCommand, onClose } = panel(value);
    expect(screen.getByRole("region", { name: "混乱行者当前目标" }).textContent).toContain("本周目已经死亡");
    expect(button("听取混乱行者专业指导").disabled).toBe(true); fireEvent.click(button("听取混乱行者专业指导")); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("关闭混乱行者页面")); expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("ChaosWalkerPanel unique reserve, candidate boundary and local navigation", () => {
  it("shows the actual old ledger without creating a second reserve or auto recharge", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand } = panel(value);
    const reserve = screen.getByRole("region", { name: "混乱行者唯一原幸运储备" }); expect(reserve.closest("details")).toBeNull();
    for (const text of ["winner.luck", "当前 1 / 3", "实际积累 7", "实际支付 6", "第87周", "每真实周最多实际积累1次", "1行动换1份", "不治疗", "不会自动补运", "为0仍可选普通方法"]) expect(reserve.textContent).toContain(text);
    expect(within(reserve).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("selects actual weekly accumulation and submits ACCUMULATE only once", async () => {
    const accumulate = action({ type: "ACCUMULATE" }, "本周实际节制积累一份", "1行动 · 原幸运+1"), observe = action({ type: "OBSERVE", caseId: "cart-fork" }, "观察原车");
    const value = projection({ promoted: true, actions: [observe, accumulate], preferredActionId: observe.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "reserve"); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button(accumulate.label)); fireEvent.click(button(accumulate.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(accumulate.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "混乱行者唯一原幸运储备" }).textContent).toContain("当前 1 / 3");
  });

  it("retains the projected once-per-week or capacity reason without inventing a recharge", async () => {
    const accumulate = action({ type: "ACCUMULATE" }, "本周实际节制积累一份", "1行动", { enabled: false, reason: "本真实周已经积累，且原容量3已满。" });
    const value = projection({ promoted: true, actions: [accumulate], preferredActionId: accumulate.id }); value.life.luck = { ...luck(), stored: 3, accumulated: 9 };
    const before = structuredClone(value), { onCommand } = panel(value); expect(picker().value).toBe("reserve");
    expect(button(accumulate.label).disabled).toBe(true); expect(screen.getByRole("region", { name: "混乱行者当前目标" }).textContent).toContain(accumulate.reason);
    fireEvent.click(button(accumulate.label)); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("switches an unstarted case locally and submits only its current public intent", async () => {
    const first = action({ type: "OBSERVE", caseId: "cart-fork" }, "观察原车"), second = action({ type: "OBSERVE", caseId: "counterexample" }, "观察原转盘");
    const value = projection({ promoted: true, actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "case:counterexample"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察原车/ })).toBeNull();
    expect(screen.getByRole("region", { name: "当前混乱行者生活情境" }).textContent).toContain("25%仍可能落A"); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(value).toEqual(before);
  });

  it("pins a prepared original case ahead of an unrelated preferred accumulation", () => {
    const enter = action({ type: "START_CASE", caseId: "revoked-draw" }, "进入原抽签现场"), accumulate = action({ type: "ACCUMULATE" }, "积累原幸运");
    const value = projection({ promoted: true, actions: [accumulate, enter], preferredActionId: accumulate.id }); value.life.cases[1]!.status = "PREPARED";
    const { onCommand } = panel(value); expect(picker().value).toBe("case:revoked-draw"); expect(picker().disabled).toBe(true); expect(screen.queryByRole("button", { name: /^积累原幸运/ })).toBeNull();
    fireEvent.click(button(enter.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(enter.command);
  });

  it("submits ordinary preparation without locally casting or drawing a branch", () => {
    const ordinary = action({ type: "PREPARE", caseId: "cart-fork", method: "ORDINARY" }, "准备普通核验", "1行动"), value = projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id });
    value.life.cases[0]!.status = "OBSERVED"; const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "当前混乱行者生活情境" }).textContent).toContain("进入原现场不自动施术"); fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
  });

  it("distinguishes finite G future probabilities, exact one-use application and unknown recipes", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "混乱行者成品与配方边界" });
    for (const text of ["完整配方", "完整仪式", "未知", "艾妲·芬恩", "6400", "900便士", "140便士", "12整周", "下一真实周补货"]) expect(formula.textContent).toContain(text);
    await open("能力范围与实际掌握"); const scope = screen.getByRole("region", { name: "混乱行者能力与使用范围" });
    for (const text of ["知识20", "5灵性", "1精神", "1份", "30秒", "75%", "25%", "不是100%", "布置成功不等于实际应用", "不能重掷", "撤回同意", "HOLD", "SPEND_FIRST", "首个有资格B/K", "失败也照付"]) expect(scope.textContent).toContain(text);
    expect(CHAOS_WALKER_ABILITIES.map(entry => entry.id)).toEqual(["wheel.s3.deviation-buffer", "wheel.s3.future-impediment"]);
  });
});

function court(extra: Partial<ChaosWalkerProjection["encounter"]> = {}): ChaosWalkerProjection["encounter"] {
  return { ...encounter(), status: "READY", inside: true,
    enemy: { id: "CW3-GARETH", name: "加雷斯·默瑟", age: 46, sequence: 4, source: "ORIGINAL_LIMITED_G", health: 70, mind: 100, spirituality: 3,
      status: "RESISTING", weaponId: "CW3-GARETH-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 9, WARD: 16, COMPOSE: 2 } },
    scene: { courtId: "CW3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "COURT", distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
    facts: ["原储备本轮明确HOLD保留；旧被动幸运按原规则处理，不额外复制。"], ...extra };
}

describe("ChaosWalkerPanel finite combat and the distinct original opponent", () => {
  it("pins the court, real independently paid resources and original rod", () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "承担原院落真实冲突", "1行动"), value = projection({ promoted: true, actions: [fight], preferredActionId: fight.id, encounter: court() });
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "混乱行者原人遭遇" });
    expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    for (const text of ["CW3-GARETH", "加雷斯·默瑟", "46岁", "序列4", "健康 70", "3 / 120", "CW3-GARETH-ROD", "实际弧光 9", "屏护 16", "集中呼吸 2", "普通回退", "HOLD", "SPEND_FIRST"]) expect(facts.textContent).toContain(text);
    const scene = screen.getByRole("region", { name: "混乱行者原战场与真实退路" }); for (const text of ["CW3-COURT", "距离 2 米", "本人走 4 米", "第三人 0"]) expect(scene.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "混乱行者当前行动" }).compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button(fight.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(value).toEqual(before);
  });

  it.each(["DEVIATION_BUFFER", "FUTURE_IMPEDIMENT"] as const)("shows %s as one pending future reduction, never an already resolved attack", kind => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null, encounter: court({ status: "FIGHTING", pendingKind: kind }) }), before = structuredClone(value);
    const { onCommand } = panel(value), effect = screen.getByRole("region", { name: "混乱行者战斗当前单次修正" });
    for (const text of ["本轮下一次", "BODY或ARC", "减半一次", "尚未消费", "不叠加", "终局", "不退款"]) expect(effect.textContent).toContain(text);
    expect(within(effect).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("shows actual composure resistance without undoing already applied reductions", () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null, encounter: court({ composureReady: true }) }));
    const effect = screen.getByRole("region", { name: "混乱行者战斗当前单次修正" });
    for (const text of ["没有待消费", "已经实际集中呼吸", "抵抗本轮新检定", "已发生的减势不撤回"]) expect(effect.textContent).toContain(text);
  });

  it("submits only the projected ordinary exit and never starts combat by closing", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原普通出口和平离开", "0行动 · 4米4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id, encounter: court() });
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button(leave.label)); fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("holds the saved original court and command after a failed exit save", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原出口离开"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id, encounter: court() });
    const { defaults, rerender, onCommand } = panel(value); fireEvent.click(button(leave.label)); rerender(<ChaosWalkerPanel {...defaults} error={{ message: "离场保存失败", retryable: false }} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载"); expect(screen.getByRole("region", { name: "混乱行者原战场与真实退路" }).textContent).toContain("本人实际在原场内");
    expect(button(leave.label).disabled).toBe(true); expect(button("关闭混乱行者页面").disabled).toBe(true); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("renders a dead original opponent and a real terminal exit without revival or a new rod", async () => {
    const ended = court({ status: "RESOLVED", inside: false }); ended.enemy!.status = "DEAD"; ended.enemy!.health = 0; ended.enemy!.weaponLocation = "COURT"; ended.scene!.playerPosition = "EXIT"; ended.scene!.ordinaryWalkedMetres = 4;
    const value = projection({ promoted: true, actions: [], preferredActionId: null, encounter: ended }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "encounter"); const facts = screen.getByRole("region", { name: "混乱行者原人遭遇" });
    for (const text of ["原身体已死亡", "留在原场", "实际在出口", "累计普通离场 4 米", "当前没有待消费", "不搬走死亡身体"]) expect(facts.textContent).toContain(text);
    expect(within(facts).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe("ChaosWalkerPanel separates arming, later one-use probability and real original cleanup", () => {
  it("shows the uncast original scene without inventing permission, a roll or a carried parcel", () => {
    const check = action({ type: "CHECK_OBJECT", caseId: "cart-fork" }, "核对原车与两软挡"), value = activate(projection({ promoted: true, actions: [check], preferredActionId: check.id }), "cart-fork", attempt());
    value.life.playerLocation = "A"; const before = structuredClone(value), { onCommand } = panel(value);
    expect(picker().disabled).toBe(true); expect(picker().value).toBe("case:cart-fork");
    const facts = screen.getByRole("region", { name: "混乱行者原人原物与真实位置" });
    for (const text of ["CW3-MECHANICAL-WORKSHOP", "本人实际在A", "CW3-CART", "CW3-PARCEL", "400克", "CW3-STOP-B", "CW3-STOP-C", "尚无实际施术来源", "尚无实际施术检定", "尚未投放"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(check.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(check.command); expect(value).toEqual(before);
  });

  it("shows successful arming as pending rather than a guaranteed result or mastery", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "cart-fork", cast()), before = structuredClone(value), { onCommand } = panel(value);
    const pending = screen.getByRole("region", { name: "混乱行者当前许可与待生效修正" });
    for (const text of ["本次检定成功", "待用修正剩余 30 秒", "物理事件尚未发生", "此时未应用", "不算能力完成或获得掌握", "灵性 5、精神 1、原幸运 1"]) expect(pending.textContent).toContain(text);
    const event = screen.getByRole("region", { name: "混乱行者一次真实后续事件" }); expect(event.textContent).toContain("实际分支抽取 0 次"); expect(event.textContent).not.toContain("真实结果 B");
    expect(value.abilities.map(ability => ability.mastery)).toEqual([0, 0]); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("submits one physical release and waits for the saved independent 75% miss", () => {
    const release = action({ type: "RELEASE_CART", caseId: "cart-fork" }, "释放同一原车一次", "0行动 · 6秒"), stop = action({ type: "STOP_INPUT", caseId: "cart-fork" }, "实际停止输入");
    const value = activate(projection({ promoted: true, actions: [release], preferredActionId: release.id }), "cart-fork", cast()), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    fireEvent.click(button(release.label)); fireEvent.click(button(release.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(release.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "混乱行者一次真实后续事件" }).textContent).toContain("实际分支抽取 0 次");
    const saved = structuredClone(value), record = saved.life.currentAttempt!;
    Object.assign(record, { pendingRemainingSeconds: 0, modifierApplied: true, branchRoll: 91, branchChance: 75, branchResult: "C", eventDraws: 1, eventAtSecond: 14, eventSourceId: "CW3-CART" });
    saved.life.cart.location = "C"; saved.life.cart.releases = 1; saved.life.cases[0]!.attempts = [record]; saved.actions = [stop]; saved.preferredActionId = stop.id;
    rerender(<ChaosWalkerPanel {...defaults} value={saved} />);
    const event = screen.getByRole("region", { name: "混乱行者一次真实后续事件" });
    for (const text of ["实际分支抽取 1 次", "91 / 100", "B概率 75%", "真实结果 C", "目标结果仍有可能未出现", "不可重抽"]) expect(event.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "混乱行者同一原车与封包" }).textContent).toContain("当前在C"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("cancels only the unused future modifier and retains its paid original reserve receipt", () => {
    const stop = action({ type: "STOP_INPUT", caseId: "cart-fork" }, "明确取消尚未发生的输入"), release = action({ type: "RELEASE_CART", caseId: "cart-fork" }, "按普通概率释放原车");
    const value = activate(projection({ promoted: true, actions: [stop], preferredActionId: stop.id }), "cart-fork", cast()), { defaults, rerender, onCommand } = panel(value);
    fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value.life.currentAttempt!.pendingRemainingSeconds).toBe(30);
    const saved = structuredClone(value), record = saved.life.currentAttempt!; Object.assign(record, { inputActive: false, stopped: true, modifierCancelled: true, pendingRemainingSeconds: 0 });
    saved.life.cases[0]!.attempts = [record]; saved.actions = [release]; saved.preferredActionId = release.id; rerender(<ChaosWalkerPanel {...defaults} value={saved} />);
    const pending = screen.getByRole("region", { name: "混乱行者当前许可与待生效修正" });
    for (const text of ["已实际停止", "已实际取消", "已付成本不退", "不加新掌握", "原幸运 1"]) expect(pending.textContent).toContain(text);
    expect(record.luckAfter).toEqual({ stored: 0, accumulated: 7, spent: 7, lastAccumulateWeek: 87 }); expect(record.branchRoll).toBeNull();
    fireEvent.click(button(release.label)); expect(onCommand).toHaveBeenLastCalledWith(release.command); expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("waits only through the exact projected time command and renders actual expiry without a refund", () => {
    const wait = action({ type: "WAIT_EFFECT", caseId: "cart-fork" }, "实际等待剩余修正", "0行动 · 30秒"), value = activate(projection({ promoted: true, actions: [wait], preferredActionId: wait.id }), "cart-fork", cast());
    const { defaults, rerender, onCommand } = panel(value); fireEvent.click(button(wait.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(wait.command); expect(value.life.currentAttempt!.pendingRemainingSeconds).toBe(30);
    const saved = structuredClone(value), record = saved.life.currentAttempt!; Object.assign(record, { pendingRemainingSeconds: 0, waitedSeconds: 30, waitCompleted: true, modifierExpired: true }); saved.life.cases[0]!.attempts = [record]; saved.actions = []; saved.preferredActionId = null;
    rerender(<ChaosWalkerPanel {...defaults} value={saved} />); const facts = screen.getByRole("region", { name: "混乱行者当前许可与待生效修正" });
    for (const text of ["已实际等待 30 秒", "随真实时间到期", "未应用", "不退款", "原幸运 1"]) expect(facts.textContent).toContain(text);
    expect(record.eventDraws).toBe(0); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("requires the explicit current consent cancellation before Vera's ordinary draw", () => {
    const stop = action({ type: "STOP_INPUT", caseId: "revoked-draw" }, "尊重撤回并停止输入"), draw = action({ type: "DRAW_TAG", caseId: "revoked-draw" }, "由薇拉亲手普通抽原签", "0行动 · A50%", { enabled: false, reason: "她已撤回，须先STOP_INPUT。" });
    const current = cast({ consent: "REVOKED", consentWithdrawn: true, abilitySourceId: "CW3-VERA" }), value = activate(projection({ promoted: true, actions: [draw, stop], preferredActionId: stop.id }), "revoked-draw", current);
    const before = structuredClone(value), { onCommand } = panel(value), pending = screen.getByRole("region", { name: "混乱行者当前许可与待生效修正" });
    for (const text of ["已撤回同意", "必须STOP_INPUT", "由她亲手普通抽签", "A仍为50%", "不沿用旧同意"]) expect(pending.textContent).toContain(text);
    const originals = screen.getByRole("region", { name: "混乱行者薇拉与原签袋" });
    for (const text of ["薇拉·霍尔", "39岁", "CW3-VERA", "CW3-POUCH", "CW3-TAG-A", "CW3-TAG-B", "CW3-RECORD", "健康 100", "没有被能力改写意志"]) expect(originals.textContent).toContain(text);
    fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
  });

  it("renders a saved ordinary 50% draw after revocation even when the original cast succeeded", () => {
    const read = action({ type: "READ_RESULT", caseId: "revoked-draw" }, "亲读薇拉手中原签"), current = cast({ consent: "REVOKED", consentWithdrawn: true, abilitySourceId: "CW3-VERA", inputActive: false, stopped: true, pendingRemainingSeconds: 0, modifierCancelled: true,
      branchRoll: 45, branchChance: 50, branchResult: "A", eventDraws: 1, eventAtSecond: 14, eventSourceId: "CW3-POUCH" });
    const value = activate(projection({ promoted: true, actions: [read], preferredActionId: read.id }), "revoked-draw", current); value.life.tags[0]!.location = "VERA_HAND"; value.life.pouch.draws = 1;
    const before = structuredClone(value), { onCommand } = panel(value), event = screen.getByRole("region", { name: "混乱行者一次真实后续事件" });
    for (const text of ["45 / 100", "A概率 50%", "真实结果 A", "没有实际应用修正", "不增加新能力掌握"]) expect(event.textContent).toContain(text);
    expect(event.textContent).not.toContain("A概率 25%"); expect(screen.getByRole("region", { name: "混乱行者薇拉与原签袋" }).textContent).toContain("薇拉本人手中");
    fireEvent.click(button(read.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(read.command); expect(value).toEqual(before);
  });

  it.each(["FAILURE", "GREAT_FAILURE"] as const)("retains %s costs and exposes a later ordinary physical branch rather than a retry", tier => {
    const release = action({ type: "RELEASE_CART", caseId: "cart-fork" }, "失败后普通放车一次", "0行动 · 50%"), current = cast({ abilityTier: tier, pendingRemainingSeconds: 0,
      abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: tier === "FAILURE" ? 85 : 100, tier } });
    const value = activate(projection({ promoted: true, actions: [release], preferredActionId: release.id }), "cart-fork", current), before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true); const facts = screen.getByRole("region", { name: "混乱行者原人原物与真实位置" });
    for (const text of ["失败成本保留", "普通50%", "灵性 5、精神 1、原幸运 1", "支付前 1 / 3", "支付后 0 / 3", "累计支付 7"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(release.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(release.command); expect(value).toEqual(before);
  });

  it("preserves the real 25% counterexample and sends only a finite conclusion", () => {
    const limited = action({ type: "CONFIRM_LIMITED", caseId: "counterexample", claim: "LIMITED" }, "确认只是有限结论"), current = cast({ abilitySourceId: "CW3-DISC", pendingRemainingSeconds: 0, inputActive: false, stopped: true, modifierApplied: true,
      branchRoll: 12, branchChance: 25, branchResult: "A", eventDraws: 1, eventAtSecond: 14, eventSourceId: "CW3-DISC", resultRead: true, recordRead: true, compared: true, rejectedClaims: 1 });
    const value = activate(projection({ promoted: true, actions: [limited], preferredActionId: limited.id }), "counterexample", current); value.life.disc.pointer = "A"; value.life.disc.spins = 1;
    const before = structuredClone(value), { onCommand } = panel(value), event = screen.getByRole("region", { name: "混乱行者一次真实后续事件" });
    for (const text of ["12 / 100", "A概率 25%", "真实结果 A", "75%与25%都不是保证"]) expect(event.textContent).toContain(text);
    const originals = screen.getByRole("region", { name: "混乱行者原转盘与反例" }); for (const text of ["CW3-DISC", "始终在A", "原指针当前：A", "CW3-FORECAST", "不因反例重置"]) expect(originals.textContent).toContain(text);
    fireEvent.click(button(limited.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(limited.command); expect(value).toEqual(before);
  });

  it("shows a rejected guarantee as its own saved statement without creating or rerolling an event", () => {
    const guarantee = action({ type: "CONFIRM_LIMITED", caseId: "counterexample", claim: "GUARANTEED" }, "声称保证结果（当面拒绝）"), current = cast({ abilitySourceId: "CW3-DISC", pendingRemainingSeconds: 0, inputActive: false, stopped: true, modifierApplied: true,
      branchRoll: 88, branchChance: 25, branchResult: "B", eventDraws: 1, eventAtSecond: 14, eventSourceId: "CW3-DISC", resultRead: true, recordRead: true, compared: true });
    const value = activate(projection({ promoted: true, actions: [guarantee], preferredActionId: guarantee.id }), "counterexample", current), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(guarantee.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(guarantee.command); expect(value).toEqual(before); expect(current.branchRoll).toBe(88); expect(current.eventDraws).toBe(1);
  });

  it("moves only the same original cart and parcel from the actual C branch", async () => {
    const push = action({ type: "RETURN_CART", caseId: "cart-fork" }, "手推同一原车与原包回A", "0行动 · 4米4秒"), current = cast({ pendingRemainingSeconds: 0, inputActive: false, stopped: true, modifierApplied: true, branchRoll: 91, branchChance: 75, branchResult: "C", eventDraws: 1, eventAtSecond: 14, eventSourceId: "CW3-CART", resultRead: true,
      playerTravelMetres: 8, elapsedSeconds: 19, playerMoves: [{ from: "A", to: "C", mode: "WALK", metres: 4, seconds: 4, itemIds: [] }], objectMoves: [{ from: "A", to: "C", mode: "ROLL", metres: 4, seconds: 6, itemIds: ["CW3-CART", "CW3-PARCEL"] }] });
    const value = activate(projection({ promoted: true, actions: [push], preferredActionId: push.id }), "cart-fork", current); value.life.playerLocation = "C"; value.life.cart.location = "C"; value.life.cart.control = "PLAYER"; value.life.cart.releases = 1;
    const before = structuredClone(value), { onCommand } = panel(value); await open("本次实际尝试与已付代价"); const facts = screen.getByRole("region", { name: "混乱行者原人原物与真实位置" });
    for (const text of ["本人实际在C", "当前在C", "控制权在本人", "同一原物或控制权尚未真实归还", "CW3-CART、CW3-PARCEL", "沿轨滚行 4 米、6 秒", "A → C：本人普通步行 4 米"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(push.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(push.command); expect(value).toEqual(before); expect(value.life.cart.location).toBe("C");
  });

  it("requires real owner handover rather than treating the cart's return to A as ownership return", () => {
    const give = action({ type: "RETURN_OBJECT", caseId: "cart-fork" }, "在A亲交原导师"), exit = action({ type: "RETURN_START", caseId: "cart-fork" }, "本人实走回START", "0行动 · 4米4秒", { enabled: false, reason: "先真实归物并记录。" });
    const current = attempt({ method: "ORDINARY", ordinaryChecked: true, resolutionPaid: true, resolutionActions: 1, branchRoll: 40, branchChance: 50, branchResult: "B", eventDraws: 1, eventSourceId: "CW3-CART", resultRead: true });
    const value = activate(projection({ promoted: true, actions: [give, exit], preferredActionId: give.id }), "cart-fork", current); value.life.playerLocation = "A"; value.life.guide.location = "A"; value.life.cart.control = "PLAYER";
    const before = structuredClone(value), { onCommand, onClose } = panel(value); expect(screen.getByRole("region", { name: "混乱行者停止与真实返程" }).textContent).toContain("先真实归物并记录");
    fireEvent.click(button(give.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(give.command); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("closes only the view without stopping input, advancing time or moving the original objects", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "cart-fork", cast()), before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button("关闭混乱行者页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("reports a closed ordinary scene without granting mastery locally", () => {
    const report = action({ type: "REPORT_CASE", caseId: "cart-fork" }, "报告真实普通分支", "1行动 · 扮演25"), value = projection({ promoted: true, actions: [report], preferredActionId: report.id });
    value.life.cases[0]!.status = "EXAMINED"; value.life.cases[0]!.returned = true; value.life.cases[0]!.closes = 1;
    value.life.cases[0]!.attempts = [attempt({ method: "ORDINARY", result: "ORDINARY", closed: true, ordinaryChecked: true, objectsReturned: true, outcomeRecorded: true, branchRoll: 95, branchChance: 50, branchResult: "C", eventDraws: 1, eventSourceId: "CW3-CART", outcome: "同一原车实际停C，已推回归还，普通报告。" })];
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(report.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(report.command); expect(value.abilities.map(entry => entry.mastery)).toEqual([0, 0]); expect(value).toEqual(before);
  });
});


describe("ChaosWalker exact authored paragraph display", () => {
  it("adapts authored source paragraphs without mutating fixture commands or costs", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value);
    const { onCommand } = panel(value);
    await open("独立成品与晋升准备");
    await open("能力范围与实际掌握");
    expect(screen.queryByText(CHAOS_WALKER_FORMULA_STATUS)).toBeNull();
    expect(screen.getByText("混乱行者序列3承接厄运法师4；完整配方尚未掌握，服用前需要专业准备。主辅材料、用量、调配顺序和完整仪式保持未知，仍须完成服药准备。同一位原成年导师艾妲·芬恩只经独立成品渠道交接本批三个独立原瓶，实际准备安静原房、普通退出路线与在场支持。三项真实专业准备和当周原房检查不开放自制魔药。")).toBeTruthy();
    expect(screen.queryByText(CHAOS_WALKER_SOURCE_STATUS)).toBeNull();
    expect(screen.getByText("混乱行者序列3新增有限偏差缓冲与未来阻延实践，不能全面控制混乱，也不会获得封印物的整套权能。后续为先知2、水银之蛇1，本阶段不开放其能力。继承幸运者7被动幸运波动、灾祸教士6有限感知和精神风暴、赢家5节制积累与有限幸运的既有边界。39岁成年薇拉·霍尔CW3-VERA、46岁成年加雷斯·默瑟CW3-GARETH、独立净空原场、原车与封包、原签袋、原盘、原纸、当前许可及全部距离、成本、时长、概率、检定、价格、奖励与专业准备均以当前说明为准。唯一winner.luck账本容量3，失败照付，晋升不重置或补满；没有第二池、附加等量厄运债、概率之骰、天使权柄、重抽、重启、改写过去、必定成功、无限预知或意志操控。六个旧阶段、原费里斯伤势与实际结局以及原豆袋等原物状态完整保留。")).toBeTruthy();
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
