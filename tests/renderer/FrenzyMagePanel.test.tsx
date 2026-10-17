/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FrenzyMagePanel, type FrenzyMagePanelProps } from "../../src/renderer/FrenzyMagePanel";
import type { FrenzyMageAction, FrenzyMageCommand, FrenzyMageProjection } from "../../src/domain/frenzy-mage/types";
import { FRENZY_MAGE_ABILITIES, FRENZY_MAGE_CONSUMPTION_RISK, FRENZY_MAGE_FORMULA_STATUS, FRENZY_MAGE_SOURCE_STATUS } from "../../src/domain/frenzy-mage/content";
import { createFrenzyMageLifeState } from "../../src/domain/frenzy-mage/life";

type Attempt = NonNullable<FrenzyMageProjection["life"]["currentAttempt"]>;
type CaseId = FrenzyMageProjection["life"]["cases"][number]["id"];
const action = (command: FrenzyMageCommand, label: string, cost = "0行动", extra: Partial<Omit<FrenzyMageAction, "command">> = {}): FrenzyMageAction =>
  ({ id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra });
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取狂乱法师专业指导", "1行动 · 500便士");
const consume = (id = "frenzy-mage-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");

// These are isolated public display fixtures, not campaign saves or claimed natural outcomes.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 123, date: { epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 12 }, method: "ABILITY", closed: false, result: "NONE",
    initialSpirituality: 48, initialMind: 90, initialKnowledge: 30, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], guideMoves: [], personMoves: [], objectMoves: [], steps: [],
    resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0, objectChecked: false, consent: "UNASKED", consentWithdrawn: false, expressedAction: null,
    abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null, inputActive: false, stopped: false, pendingRemainingSeconds: 0, modifierApplied: false, modifierCancelled: false, modifierExpired: false, waitedSeconds: 0, waitCompleted: false,
    actionExecutions: 0, actionResult: null, actionAtSecond: null, actionSourceId: null, resultRead: false, paperRead: false, objectTaken: false, limitedConfirmed: false, rejectedClaims: 0, objectsReturned: false, ordinaryChecked: false,
    evidence: [], outcomeRecorded: false, outcome: null, ...extra };
}
function cast(extra: Partial<Attempt> = {}): Attempt {
  return attempt({ objectChecked: true, paperRead: true, consent: "GRANTED", expressedAction: "WALK_A_TO_B", abilityTier: "SUCCESS", abilitySourceId: "FM3-DARIAN", abilityAtSecond: 8,
    abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: 42, tier: "SUCCESS" },
    inputActive: true, pendingRemainingSeconds: 30, resolutionPaid: true, resolutionActions: 1, spiritualitySpent: 5, mindSpent: 2, elapsedSeconds: 8, playerTravelMetres: 4,
    playerMoves: [{ from: "START", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: [] }],
    guideMoves: [{ from: "START", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: ["FM3-PARCEL", "FM3-ROUTE-PAPER"] }], ...extra });
}
function life(): FrenzyMageProjection["life"] {
  const state = createFrenzyMageLifeState();
  return { ...state, title: "三个有限既有动作试验G", story: "施术尝试与后来实际动作分别保存。", summary: "原人、原纸与原物各自保持。", environment: "START到A4米，A到B或C各4米。", nextStep: "先核对同一原人和原物。",
    inside: false, insideCase: false, currentAttempt: null, actions: [], facts: ["原纸永久写从A到B；原人与原物均须真实返回。"],
    cases: ([
      { id: "courier-route", title: "G · 原信差的一次待行路线", story: "同一42岁达里安携唯一400克原封包，亲口声明下一步A→B。" },
      { id: "withdrawn-route", title: "G · 撤回后的普通原路线", story: "同一达里安撤回能力参与，仍亲自携原包普通到B。" },
      { id: "own-throw", title: "G · 本人实际投出原布球", story: "本人亲投唯一80克FM3-PRACTICE-BALL；原球飞4米落空垫。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): FrenzyMageProjection["encounter"] {
  return { title: "阿尔登的原场冲突G", story: "原阿尔登、原棍与独立灵性。", status: "AVAILABLE", inside: false, scene: null, enemy: null, pendingKind: null, composureReady: false,
    gifts: { held: 5, given: 10, battleGround: 0, summary: "原briber.gifts共有15件：11–15仍由PLAYER持有，1–10已GIVEN，旧去向与周次保留。" }, actions: [], facts: ["2米净空原场与4米普通出口，无追逐，没有第三人在场。"] };
}
function projection(extra: Partial<FrenzyMageProjection> = {}): FrenzyMageProjection {
  return { title: "狂乱法师与有限次序", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限既有动作偏转G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；批次耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `frenzy-mage-potion-${n}`, title: `狂乱法师第${n}独立原瓶`, source: `FM3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `frenzy-mage-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对既往原记录", completedWeek: 118 }, { taskId: "CHECK_LIMITS", title: "核验有限边界", completedWeek: 119 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 120 }],
    preparedWeek: null, abilities: FRENZY_MAGE_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原堕落伯爵消化100，晋升后已满12整周。", pollution: 3,
    risk: FRENZY_MAGE_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原伊芙自主，FE4-CRATE-1与FE4-PAD-1原件已实际归还。",
    inheritedHistory: ["原马洛FE4-MARLOW-VENN永久DEAD/H0/M100/S8，一处原轻伤保持。", "原15礼物仅11–15在PLAYER，原1–10的givenWeek与destination保持。", "原六阶段能力掌握与失败保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原人与原封包都须普通实走；原球亲手投出、拾回再归还。", ...extra };
}
function activate(value: FrenzyMageProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current; value.life.facts = [];
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function atA(id: CaseId, current: Attempt, actions: FrenzyMageAction[] = []): FrenzyMageProjection {
  const value = activate(projection({ promoted: true, actions, preferredActionId: actions[0]?.id ?? null }), id, current);
  value.life.playerLocation = "A"; value.life.playerTravelMetres = 4; value.life.guide.location = "A"; value.life.guideTravelMetres = 4;
  value.life.clockSeconds = current.elapsedSeconds; value.life.paper.holder = "PLAYER"; value.life.paper.location = "A";
  if (id === "own-throw") { value.life.ball.holder = "PLAYER"; value.life.ball.location = "A"; }
  else { value.life.parcel.holder = "DARIAN"; value.life.parcel.location = "A"; }
  return value;
}
function panel(value = projection(), props: Partial<Omit<FrenzyMagePanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<FrenzyMagePanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择狂乱法师事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("FrenzyMagePanel independent originals and saved intentions", () => {
  it("leads with finite scope, unavailable recipe and one simple paid goal", () => {
    const reason = "原堕落伯爵只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "狂乱法师与有限次序" })); expect(screen.getByRole("region", { name: "狂乱法师" })).toBeTruthy(); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const summary = screen.getByRole("region", { name: "狂乱法师当前目标" });
    for (const text of [reason, "狂乱法师为序列3", "熵之公爵2", "有限既有动作偏转", "完整配方", "晋升仪式细节尚未掌握", "当前渠道仅提供独立成品", "仍须完成专业准备", "场景、成本与数值以当前说明为准"]) expect(summary.textContent).toContain(text);
    const resources = screen.getByRole("region", { name: "狂乱法师当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取狂乱法师专业指导").disabled).toBe(true); expect(button("听取狂乱法师专业指导").getAttribute("aria-describedby")).toContain("frenzy-mage-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原人物、原物与旧黑皇帝路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取狂乱法师专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("adapts direct authored formula and source paragraphs without mutating committed fixtures", async () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    await open("独立成品与晋升准备");
    const recipe = screen.getByRole("region", { name: "狂乱法师成品与配方边界" });
    expect(within(recipe).getByText("后续成长为堕落伯爵4、狂乱法师3、熵之公爵2、弑序亲王1；狂乱法师完整主辅配方、材料用量、调配顺序与晋升仪式尚未获得，仍保持未知，仍须完成服药准备。同一位原成年导师米蕾·沃德只经独立成品渠道交接本批三个独立原瓶，实际准备原契约铺旁安静原房、普通退出路线与在场支持。三项专业准备和当周房间检查仍须完成，不开放自制魔药。")).toBeTruthy();
    expect(within(recipe).queryByText(FRENZY_MAGE_FORMULA_STATUS)).toBeNull();
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "狂乱法师能力与使用范围" });
    expect(within(scope).getByText("狂乱法师为序列3，承接堕落伯爵4；后续为熵之公爵2、弑序亲王1。本阶段新增有限既有动作偏转，当前渠道只提供成品魔药，晋升仍须准备。不获得建国、异常规则、九座陵寝等黑皇帝晋升条件，也不获得船只的灵界跳跃能力。原42岁成年信差FM3-DARIAN达里安·维尔、45岁成年FM3-ALDEN阿尔登·鲁克、场地、原纸与原物、有限方向偏转、当前许可、30秒窗口、全部距离、成本、检定、数值和奖励均以当前说明为准。只能影响当前已明确而尚未执行的一个动作，不修改原纸、不追改既发事实、不传送、不替代独立心智、不授永久服从或随意命令。序列2能力尚未开放，不获得任意操控热力学的能力。六个旧阶段、原马洛永久死亡、原伊芙与原箱原垫的收束历史完整保留；只允许仍在briber.gifts中由PLAYER持有的同一旧礼物在新战实际给出，没有新礼物池、幸运池、召回或复制。")).toBeTruthy();
    expect(within(scope).queryByText(FRENZY_MAGE_SOURCE_STATUS)).toBeNull();
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("follows projected professional preparation before optional original bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "写下实际停止与返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "frenzy-mage-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "狂乱法师下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it.each(["POTION_WORK", "BUY_POTION"] as const)("selects another original and forwards its exact %s intent only once", async type => {
    const first = action({ type, bottleId: "frenzy-mage-potion-1" }, "第一原瓶实际交付", "1行动"), second = action({ type, bottleId: "frenzy-mage-potion-2" }, "第二原瓶实际交付", "0行动 · 900便士");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:frenzy-mage-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews only the selected bottle, preparation, four risks and preserved original history", async () => {
    const first = consume(), second = consume("frenzy-mage-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 121, insideCase: true });
    const { onCommand, onClose } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:frenzy-mage-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "狂乱法师原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "狂乱法师第2独立原瓶" }));
    for (const text of ["frenzy-mage-potion-2", "FM3-SEAL-2", "73%", "第121周", "140便士不退", "意志难度30", "大成功", "成功", "失败", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整配方", "独立成品渠道", "原马洛死亡不变", "原礼物库存不复制"]) expect(review.textContent).toContain(text);
    expect(within(review).getByText("后续成长为堕落伯爵4、狂乱法师3、熵之公爵2、弑序亲王1；狂乱法师完整主辅配方、材料用量、调配顺序与晋升仪式尚未获得，仍保持未知，仍须完成服药准备。同一位原成年导师米蕾·沃德只经独立成品渠道交接本批三个独立原瓶，实际准备原契约铺旁安静原房、普通退出路线与在场支持。三项专业准备和当周房间检查仍须完成，不开放自制魔药。")).toBeTruthy();
    expect(within(review).queryByText(FRENZY_MAGE_FORMULA_STATUS)).toBeNull();
    expect(review.textContent).not.toContain("FM3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "狂乱法师原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the same confirmed intent locked through save failure until committed facts change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 121 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<FrenzyMagePanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "狂乱法师原瓶服用确认" })).toBeTruthy();
    rerender(<FrenzyMagePanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<FrenzyMagePanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "狂乱法师原瓶服用确认" })).toBeNull();
    expect(button("关闭狂乱法师页面").disabled).toBe(false); expect(picker().value).toBe("case:courier-route"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { disabled: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks commands, selection and close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取狂乱法师专业指导")); fireEvent.click(button("关闭狂乱法师页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取狂乱法师专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates an unsubmitted review if saved eligibility changes", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<FrenzyMagePanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "狂乱法师原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows all real costs and future supply without exposing an invented recipe", async () => {
    panel(); await open("独立成品与晋升准备"); const boundary = screen.getByRole("region", { name: "狂乱法师成品与配方边界" });
    for (const text of ["500", "6400", "5500", "900", "12整周", "消化100", "140", "健康>20", "精神>40", "下一真实周", "服药前仍须逐项完成", "不开放自制配方"]) expect(boundary.textContent).toContain(text);
  });

  it("forwards paid preparation cancellation without refunding or consuming an original locally", () => {
    const leave = action({ type: "LEAVE_PREPARATION" }, "结束本次已付准备", "0行动 · 140便士不退"), value = projection({ preparedWeek: 121, actions: [leave], preferredActionId: leave.id }), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "狂乱法师服药准备与成本" }).textContent).toContain("未服原瓶仍保留");
  });
});

describe("FrenzyMagePanel current consent, real movement and irreversible results", () => {
  it("selects each distinct original scene locally, with details folded", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of value.life.cases) {
      await userEvent.selectOptions(picker(), `case:${entry.id}`);
      expect(screen.getByRole("region", { name: "当前狂乱法师生活情境" }).textContent).toContain(entry.story);
    }
    expect(fold("三项原案的观察与实际结果").open).toBe(false); expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["ABILITY", "ORDINARY"] as const)("forwards the %s preparation, without taking an action locally", method => {
    const entry = action({ type: "PREPARE", caseId: "courier-route", method }, `准备${method}原路线`, "1行动 · 另留实施1行动"), value = projection({ promoted: true, actions: [entry], preferredActionId: entry.id });
    value.life.cases[0]!.status = "OBSERVED"; const before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(entry.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(value).toEqual(before); expect(value.life.currentAttempt).toBeNull();
  });

  it("distinguishes paid successful preparation from a not-yet-executed adult action", () => {
    const execute = action({ type: "EXECUTE_ACTION", caseId: "courier-route" }, "达里安本人实际走出下一步", "0行动 · 4米4秒"), value = atA("courier-route", cast(), [execute]), before = structuredClone(value), { onCommand } = panel(value);
    const current = screen.getByRole("region", { name: "狂乱法师当前许可与待用偏转" });
    for (const text of ["当前仅同意这一次", "达里安本人下一步按原纸", "30 秒", "尚未实际执行", "没有应用或新掌握", "灵性 5", "精神 2", "实施行动 1"]) expect(current.textContent).toContain(text);
    const execution = screen.getByRole("region", { name: "狂乱法师后来一次真实执行" }); expect(execution.textContent).toContain("实际执行 0 次"); expect(execution.textContent).toContain("不显示想象中的结果");
    expect(picker().disabled).toBe(true); expect(button("关闭狂乱法师页面").disabled).toBe(true); fireEvent.click(button(execute.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(execute.command); expect(value).toEqual(before); expect(execution.textContent).toContain("实际执行 0 次");
  });

  it("stops only a revoked pending effect, then forwards the adult's ordinary action without inventing C", async () => {
    const stop = action({ type: "STOP_INPUT", caseId: "withdrawn-route" }, "停止未执行的偏转"), execute = action({ type: "EXECUTE_ACTION", caseId: "withdrawn-route" }, "按当前普通意愿走到B", "0行动 · 4米4秒", { enabled: false, reason: "本人已撤回，须先停止未用偏转。" });
    const value = atA("withdrawn-route", cast({ consent: "REVOKED", consentWithdrawn: true }), [stop, execute]); value.life.volunteer.willing = false;
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); await open("其它步骤与未满足条件"); expect(button(execute.label).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "狂乱法师当前许可与待用偏转" }).textContent).toContain("必须STOP_INPUT清除未用偏转");
    fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
    const stopped = structuredClone(value); Object.assign(stopped.life.currentAttempt!, { stopped: true, inputActive: false, modifierCancelled: true, pendingRemainingSeconds: 0 }); stopped.actions = [{ ...execute, enabled: true, reason: null }]; stopped.preferredActionId = execute.id;
    rerender(<FrenzyMagePanel {...defaults} value={stopped} />);
    const current = screen.getByRole("region", { name: "狂乱法师当前许可与待用偏转" }); expect(current.textContent).toContain("尚未执行的偏转已经取消"); expect(current.textContent).toContain("已付代价不退");
    expect(screen.getByRole("region", { name: "狂乱法师后来一次真实执行" }).textContent).toContain("实际执行 0 次");
    fireEvent.click(button(execute.label)); expect(onCommand.mock.calls[1]![0]).toBe(execute.command); expect(stopped.life.volunteer.location).toBe("A");
    const walked = structuredClone(stopped); Object.assign(walked.life.currentAttempt!, { actionExecutions: 1, actionResult: "B", actionSourceId: "FM3-DARIAN", elapsedSeconds: 12 }); walked.life.volunteer.location = "B"; walked.life.parcel.location = "B"; walked.actions = []; walked.preferredActionId = null;
    rerender(<FrenzyMagePanel {...defaults} value={walked} />); expect(screen.getByRole("region", { name: "狂乱法师后来一次真实执行" }).textContent).toContain("实际终点 B"); expect(walked.abilities[0]!.mastery).toBe(0);
  });

  it("never calls stopping an already applied deviation a restoration of the original route", () => {
    const stop = action({ type: "STOP_INPUT", caseId: "courier-route" }, "明确结束本次输入"), current = cast({ inputActive: false, pendingRemainingSeconds: 0, modifierApplied: true, actionExecutions: 1, actionResult: "C", actionAtSecond: 12, actionSourceId: "FM3-DARIAN", elapsedSeconds: 12 });
    const value = atA("courier-route", current, [stop]); value.life.volunteer.location = "C"; value.life.parcel.location = "C";
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
    const saved = structuredClone(value); saved.life.currentAttempt!.stopped = true; saved.actions = []; saved.preferredActionId = null;
    rerender(<FrenzyMagePanel {...defaults} value={saved} />); const facts = screen.getByRole("region", { name: "狂乱法师当前许可与待用偏转" });
    for (const text of ["已经在后来的一次实际动作中应用", "已实际停止", "不能复原已经走过的路", "已付成本"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "狂乱法师后来一次真实执行" }).textContent).toContain("实际终点 C"); expect(saved.life.paper.text).toBe("从A到B"); expect(saved.life.volunteer.location).toBe("C");
  });

  it("forwards withdrawal of this current consent without locally clearing a paid pending effect", () => {
    const withdraw = action({ type: "WITHDRAW_CONSENT", caseId: "courier-route" }, "达里安撤回当前能力参与"), value = atA("courier-route", cast(), [withdraw]), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(withdraw.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command); expect(value).toEqual(before);
    expect(value.life.currentAttempt!.pendingRemainingSeconds).toBe(30); expect(value.life.volunteer.location).toBe("A"); expect(value.life.currentAttempt!.consent).toBe("GRANTED");
  });

  it("records real expiry without refund or a fictional execution", () => {
    const wait = action({ type: "WAIT_EFFECT", caseId: "courier-route" }, "实际等待剩余30秒"), value = atA("courier-route", cast(), [wait]), { onCommand, defaults, rerender } = panel(value);
    fireEvent.click(button(wait.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(wait.command); expect(value.life.clockSeconds).toBe(8);
    const expired = structuredClone(value); Object.assign(expired.life.currentAttempt!, { pendingRemainingSeconds: 0, inputActive: false, modifierExpired: true, waitCompleted: true, waitedSeconds: 30, elapsedSeconds: 38 }); expired.life.clockSeconds = 38; expired.actions = []; expired.preferredActionId = null;
    rerender(<FrenzyMagePanel {...defaults} value={expired} />); const facts = screen.getByRole("region", { name: "狂乱法师当前许可与待用偏转" });
    for (const text of ["实际等待 30 秒", "随真实时间到期", "已付代价不退", "灵性 5", "精神 2"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "狂乱法师后来一次真实执行" }).textContent).toContain("实际执行 0 次");
  });

  it("keeps failure costs visible while later ordinary execution needs no second paid attempt", () => {
    const failed = cast({ abilityTier: "FAILURE", abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: 90, tier: "FAILURE" }, pendingRemainingSeconds: 0 });
    const execute = action({ type: "EXECUTE_ACTION", caseId: "courier-route" }, "普通执行原纸路线", "0行动 · 不追加实施行动"), value = atA("courier-route", failed, [execute]), before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true); expect(fold("本次实际尝试与已付代价").textContent).toContain("失败费用保留");
    const current = screen.getByRole("region", { name: "狂乱法师当前许可与待用偏转" }); expect(current.textContent).toContain("实际检定失败"); expect(current.textContent).toContain("实施行动 1");
    fireEvent.click(button(execute.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(execute.command); expect(value).toEqual(before);
  });

  it("offers ordinary completion when the adult declines instead of enabling the blocked ability", async () => {
    const perform = action({ type: "PERFORM", caseId: "courier-route" }, "对达里安施用一次偏转", "1行动 · 5灵性2精神", { enabled: false, reason: "达里安当前已拒绝能力参与。" });
    const ordinary = action({ type: "ORDINARY_CHECK", caseId: "courier-route" }, "保留普通原路线", "1行动 · 0灵性0精神");
    const value = atA("courier-route", attempt({ objectChecked: true, paperRead: true, consent: "DECLINED", expressedAction: "WALK_A_TO_B" }), [ordinary, perform]); value.life.volunteer.willing = false;
    const before = structuredClone(value), { onCommand } = panel(value); await open("其它步骤与未满足条件"); expect(button(perform.label).disabled).toBe(true); fireEvent.click(button(perform.label)); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "狂乱法师当前许可与待用偏转" }).textContent).toContain("当前已拒绝");
  });

  it("shows the actual adult and parcel at C while the paper remains B and the player remains A", () => {
    const walk = action({ type: "WALK_RESULT", caseId: "courier-route" }, "本人实走4米到C核结果", "0行动 · 4米4秒"), value = atA("courier-route", cast({ modifierApplied: true, inputActive: false, pendingRemainingSeconds: 0, actionExecutions: 1, actionResult: "C", actionSourceId: "FM3-DARIAN" }), [walk]);
    value.life.volunteer.location = "C"; value.life.parcel.location = "C"; const before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "狂乱法师原人原物与真实位置" }); for (const text of ["本人实际在A", "达里安·维尔", "42岁", "本人实际在C", "FM3-PARCEL", "当前在C", "FM3-ROUTE-PAPER", "仍写“从A到B”", "健康 100", "精神 100"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(walk.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(walk.command); expect(value).toEqual(before); expect(value.life.playerLocation).toBe("A");
  });

  it("shows one physical throw and its original ball, without teleporting it into the player's hand", async () => {
    const take = action({ type: "TAKE_OBJECT", caseId: "own-throw" }, "亲手拾回同一原球"), current = cast({ consent: "ORDINARY", expressedAction: "THROW_A_TO_B", abilitySourceId: "PLAYER_ORIGINAL", inputActive: false, pendingRemainingSeconds: 0, modifierApplied: true,
      actionExecutions: 1, actionResult: "C", actionSourceId: "FM3-PRACTICE-BALL", resultRead: true, elapsedSeconds: 17, objectMoves: [{ from: "A", to: "C", mode: "THROW", metres: 4, seconds: 4, itemIds: ["FM3-PRACTICE-BALL"] }] });
    const value = atA("own-throw", current, [take]); value.life.playerLocation = "C"; value.life.paper.location = "C"; value.life.ball.location = "C"; value.life.ball.holder = "PAD"; value.life.ball.throws = 1;
    const before = structuredClone(value), { onCommand } = panel(value); const facts = screen.getByRole("region", { name: "狂乱法师原人原物与真实位置" });
    for (const text of ["唯一80克软布球", "FM3-PRACTICE-BALL", "实际落在空垫上", "实际投出 1 次", "仍写“从A到B”"]) expect(facts.textContent).toContain(text);
    await open("本次实际尝试与已付代价"); expect(fold("本次实际尝试与已付代价").textContent).toContain("原物 FM3-PRACTICE-BALL 实际飞行 4 米、4 秒");
    fireEvent.click(button(take.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(take.command); expect(value).toEqual(before); expect(value.life.ball.holder).toBe("PAD");
  });

  it("requires actual original return and the ordinary START route before closing the page", () => {
    const leave = action({ type: "LEAVE_CASE", caseId: "courier-route" }, "关闭已实际退出的现场", "0行动", { enabled: false, reason: "原件未归还，本人尚未返回START。" });
    const give = action({ type: "RETURN_OBJECT", caseId: "courier-route" }, "当面交还原包与原纸"), value = atA("courier-route", cast({ stopped: true, inputActive: false, pendingRemainingSeconds: 0, actionExecutions: 1, actionResult: "C", modifierApplied: true, resultRead: true }), [give, leave]);
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value); expect(button(leave.label).disabled).toBe(true); expect(button("关闭狂乱法师页面").disabled).toBe(true);
    fireEvent.click(button(give.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(give.command); expect(value).toEqual(before); expect(value.life.parcel.holder).toBe("DARIAN");
    const returned = structuredClone(value); returned.life.currentAttempt!.objectsReturned = true; returned.life.parcel.holder = "GUIDE"; returned.life.paper.holder = "GUIDE"; returned.actions = []; returned.preferredActionId = null;
    rerender(<FrenzyMagePanel {...defaults} value={returned} />); expect(button("关闭狂乱法师页面").disabled).toBe(true);
    const atStart = structuredClone(returned); atStart.life.playerLocation = "START"; atStart.life.guide.location = "START"; atStart.life.parcel.location = "START"; atStart.life.paper.location = "START"; atStart.life.currentAttempt!.outcomeRecorded = true; atStart.actions = [{ ...leave, enabled: true, reason: null }]; atStart.preferredActionId = leave.id;
    rerender(<FrenzyMagePanel {...defaults} value={atStart} />); expect(button("关闭狂乱法师页面").disabled).toBe(true); fireEvent.click(button(leave.label)); expect(onCommand.mock.calls[1]![0]).toBe(leave.command);
    const closed = structuredClone(atStart); closed.insideCase = false; closed.life.inside = false; closed.life.insideCase = false; closed.life.activeCase = null; closed.life.currentAttempt = null; closed.life.cases[0]!.contactOpen = false; closed.life.cases[0]!.status = "EXAMINED"; closed.actions = []; closed.preferredActionId = null;
    rerender(<FrenzyMagePanel {...defaults} value={closed} />); fireEvent.click(button("关闭狂乱法师页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("keeps a paid physical command pending through save failure, without locally advancing the clock", () => {
    const execute = action({ type: "EXECUTE_ACTION", caseId: "own-throw" }, "本人实际投出原球一次", "0行动 · 4米4秒"), value = atA("own-throw", cast({ consent: "ORDINARY", expressedAction: "THROW_A_TO_B" }), [execute]), before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    fireEvent.click(button(execute.label)); rerender(<FrenzyMagePanel {...defaults} error={{ message: "原动作保存失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复付费、服药、施术、执行原动作或归还原物"); expect(button(execute.label).disabled).toBe(true); expect(picker().disabled).toBe(true);
    rerender(<FrenzyMagePanel {...defaults} value={structuredClone(value)} />); fireEvent.click(button(execute.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(execute.command); expect(value).toEqual(before); expect(value.life.ball.throws).toBe(0);
  });

  it("shows actual movement receipts separately for player, original adult, guide and original items", async () => {
    const current = cast({ personMoves: [{ from: "A", to: "C", mode: "WALK", metres: 4, seconds: 4, itemIds: ["FM3-PARCEL"] }], objectMoves: [{ from: "A", to: "C", mode: "WALK", metres: 4, seconds: 4, itemIds: ["FM3-PARCEL"] }],
      evidence: [{ sourceId: "FM3-ROUTE-PAPER", atSecond: 6, text: "亲读同一原纸，文字从A到B不变。" }] });
    panel(atA("courier-route", current)); await open("本次实际尝试与已付代价"); const receipt = fold("本次实际尝试与已付代价");
    for (const text of ["本人普通步行 4 米、4 秒", "同一达里安自主步行 4 米、4 秒", "原物 FM3-PARCEL 实际随持有人移动 4 米、4 秒", "原导师普通步行 4 米、4 秒", "第6秒 · 原来源FM3-ROUTE-PAPER"]) expect(receipt.textContent).toContain(text);
  });

  it("submits a limited conclusion without revising the first original throw result", () => {
    const limited = action({ type: "CONFIRM_LIMITED", caseId: "own-throw", claim: "LIMITED" }, "确认只有本次动作的有限结论"), value = atA("own-throw", cast({ expressedAction: "THROW_A_TO_B", inputActive: false, pendingRemainingSeconds: 0, actionExecutions: 1, actionResult: "C", modifierApplied: true, resultRead: true, objectTaken: true }), [limited]);
    value.life.ball.throws = 1; const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(limited.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(limited.command); expect(value).toEqual(before); expect(value.life.ball.throws).toBe(1);
  });
});

describe("FrenzyMagePanel known boundaries and original encounter", () => {
  it("keeps one finite action, real costs, current consent and higher-ability exclusions", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("能力范围与实际掌握");
    const boundary = screen.getByRole("region", { name: "狂乱法师能力与使用范围" });
    for (const text of ["black-emperor.s3.ordered-deviation", "取消、到期、失败不退成本、不奖掌握", "5灵性", "2精神", "知识20", "30秒", "后来实际执行不额外随机重掷", "独立成年人仍可拒绝", "不修改原纸", "只检定一次", "不强制投降", "共13行动", "只有实际应用的偏转奖新掌握8", "普通准备1行动、不耗灵性精神", "本阶段不获得船只的灵界跳跃", "九陵寝属于1→0", "不能代替本阶的晋升准备", "不获得任意操控热力学的序列2能力"]) expect(boundary.textContent).toContain(text);
    expect(FRENZY_MAGE_ABILITIES).toHaveLength(1); expect(screen.getByText(`${FRENZY_MAGE_ABILITIES[0]!.label} · 掌握 0：${FRENZY_MAGE_ABILITIES[0]!.description}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /补充礼物|积运|改写原纸|传送|熵攻击/ })).toBeNull();
  });

  it("leaves the dead original Marlow, originals and already-given gifts read only", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原人物、原物与旧黑皇帝路线记录");
    const history = screen.getByRole("region", { name: "狂乱法师继承记录" });
    for (const text of ["FE4-CRATE-1", "FE4-PAD-1", "FE4-MARLOW-VENN", "永久DEAD/H0/M100/S8", "11–15在PLAYER", "givenWeek", "destination", "不发新礼物", "已GIVEN礼物不能回收再给"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("shows only the committed same original gifts, pending K and paid enemy state", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null });
    value.encounter = { ...encounter(), status: "FIGHTING", inside: true, pendingKind: "ORDERED_DEVIATION",
      enemy: { id: "FM3-ALDEN", name: "阿尔登·鲁克", age: 45, source: "ORIGINAL_LIMITED_G", sequence: 4, health: 90, mind: 100, spirituality: 107, status: "RESISTING", weaponId: "FM3-ALDEN-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 1, WARD: 1, COMPOSE: 1 } },
      scene: { courtId: "FM3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "COURT", distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
      gifts: { held: 4, given: 11, battleGround: 1, summary: "原gift-11已实际给出，第126周留在BATTLE:FRENZY_MAGE_DISPUTE:GROUND；旧gift-1原去向保持。" } };
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value);
    expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    const enemy = screen.getByRole("region", { name: "狂乱法师原人遭遇" }); for (const text of ["阿尔登·鲁克", "45岁", "FM3-ALDEN-ROD", "107 / 120", "实际弧光 1 次", "先付自己的全部费用"]) expect(enemy.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "狂乱法师战斗当前单次偏转" }).textContent).toContain("尚未应用");
    const gifts = screen.getByRole("region", { name: "狂乱法师同一旧赠物库存" }); for (const text of ["持有 4 件", "给出 11 件", "原院 1 件", "gift-11", "第126周", "旧gift-1原去向保持"]) expect(gifts.textContent).toContain(text);
    fireEvent.click(button("关闭狂乱法师页面")); expect(onClose).not.toHaveBeenCalled(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    const composed = structuredClone(value); composed.encounter.pendingKind = null; composed.encounter.composureReady = true;
    rerender(<FrenzyMagePanel {...defaults} value={composed} />); expect(screen.getByRole("region", { name: "狂乱法师战斗当前单次偏转" }).textContent).toContain("已经应用的减半不撤销");
  });

  it("forwards the physical peace exit, keeping page close locked until committed exit", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原出口步行4米离开", "0行动 · 4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id });
    value.encounter = { ...encounter(), status: "READY", inside: true };
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value);
    fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before); expect(button("关闭狂乱法师页面").disabled).toBe(true);
    const left = structuredClone(value); left.encounter.status = "RESOLVED"; left.encounter.inside = false; left.actions = []; left.preferredActionId = null;
    rerender(<FrenzyMagePanel {...defaults} value={left} />); fireEvent.click(button("关闭狂乱法师页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("keeps a dead body read only without trapping local archive navigation", () => {
    const value = projection(); value.resources!.health = 0; value.encounter.inside = true;
    const { onCommand, onClose } = panel(value); expect(screen.getByRole("region", { name: "狂乱法师当前目标" }).textContent).toContain("本周目已经死亡");
    expect(screen.queryByRole("button", { name: /^听取狂乱法师/ })).toBeNull(); fireEvent.click(button("关闭狂乱法师页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
  });
});


describe("FrenzyMagePanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["狂乱法师3、熵之公爵2的名称编号已获原文直接支持。完整配方、晋升仪式与本阶完整能力仍未知；本次有限既有动作偏转、场景、成本与数值全部为原创G。", "狂乱法师为序列3，后续为熵之公爵2。当前渠道仅提供独立成品；完整配方、调配步骤和晋升仪式细节尚未掌握，仍须完成专业准备。本阶段只开放有限既有动作偏转，场景、成本与数值以当前说明为准。"],
      ["核对原记录、检查有限边界、标明真实退出均为专业准备G，不能代替未知的原著完整仪式。三原瓶耗尽后须申请并等下一真实周独立供货，不重置旧瓶、不开放自制配方。", "核对原记录、检查有限边界、标明真实退出是实际专业准备，服药前仍须逐项完成。三原瓶耗尽后须申请并等下一真实周独立供货，不重置旧瓶、不开放自制配方。"],
      ["纳斯特的身份推测与炮弹个例不成为本阶通用数值；黑皇帝号灵界跳跃属于船。建国、异常规则与九陵寝属于1→0，不挪为3的仪式；不因“熵”字发明序列2热力学万能能力。", "不因其他人物的个别表现提高本阶通用数值；本阶段不获得船只的灵界跳跃。建国、异常规则与九陵寝属于1→0，不能代替本阶的晋升准备；不获得任意操控热力学的序列2能力。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
  it("keeps the complete selected-bottle consequence paragraph before confirmation", async () => {
    const value = projection({ actions: [consume()] }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    const review = screen.getByRole("region", { name: "狂乱法师原瓶服用确认" });
    expect(within(review).getByText("成功四属性各+1、灵性上限120，当前灵性不补满；唯一新增的有限既有动作偏转掌握从0开始。同一原身体、年龄、性别与旧伤势保持，原马洛死亡不变，原礼物库存不复制、不补发。狂乱法师为序列3；本次新增机制、专业准备与数值以当前说明为准，下一熵之公爵2的能力不随本阶晋升直接获得。")).toBeTruthy();
    expect(review.textContent).not.toContain("成功四属性各+1、灵性上限120，当前灵性不补满；唯一新增的有限既有动作偏转掌握从0开始。同一原身体、年龄、性别与旧伤势保持，原马洛死亡不变，原礼物库存不复制、不补发。狂乱法师3与熵之公爵2名称编号已核实；本次新增机制、专业准备与数值全部为原创G，序列2能力仍未知。");
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
