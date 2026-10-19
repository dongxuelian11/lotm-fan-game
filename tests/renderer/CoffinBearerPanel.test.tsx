/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoffinBearerPanel, type CoffinBearerPanelProps } from "../../src/renderer/CoffinBearerPanel";
import type { CoffinBearerAction, CoffinBearerCommand, CoffinBearerProjection } from "../../src/domain/coffin-bearer/types";
import { COFFIN_BEARER_ABILITIES, COFFIN_BEARER_CONSUMPTION_RISK, COFFIN_BEARER_FORMULA_STATUS, COFFIN_BEARER_SOURCE_STATUS } from "../../src/domain/coffin-bearer/content";
import { createCoffinBearerLifeState } from "../../src/domain/coffin-bearer/life";

type Attempt = NonNullable<CoffinBearerProjection["life"]["currentAttempt"]>;
type CaseId = CoffinBearerProjection["life"]["cases"][number]["id"];
const action = (command: CoffinBearerCommand, label: string, cost = "0行动", extra: Partial<Omit<CoffinBearerAction, "command">> = {}): CoffinBearerAction =>
  ({ id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra });
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取抬棺人专业指导", "1行动 · 500便士");
const consume = (id = "coffin-bearer-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");

// Isolated typed display fixtures: these do not simulate a campaign or claim natural results.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 143, date: { epoch: "FIFTH_EPOCH", year: 1352, month: 8, day: 19 }, method: "ABILITY", sampleId: "CB3-LIVE-1", closed: false, result: "NONE",
    initialSpirituality: 48, initialMind: 90, initialKnowledge: 30, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], objectMoves: [], steps: [],
    sampleChecked: false, paperRead: false, ownerConsent: "UNASKED", recipientConsent: "UNASKED", consentWithdrawn: false, checkedAlive: null, checkedVitality: null,
    resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0, padId: null, ordinaryChecked: false,
    abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null, resolutionAtSecond: null,
    effectActive: false, remainingSeconds: 0, stopped: false, effectCancelled: false, effectExpired: false,
    ordinaryExposureSeconds: 0, protectedExposureSeconds: 0, ordinaryRemainderSeconds: 0, protectedRemainderSeconds: 0, vitalityLost: 0, waitedSeconds: 0, waitCompleted: false,
    sampleTaken: false, offered: false, handedOver: false, sampleReturned: false, kitReturned: false, limitedConfirmed: false, rejectedClaims: 0,
    evidence: [], outcomeRecorded: false, outcome: null, ...extra };
}
function cast(extra: Partial<Attempt> = {}): Attempt {
  return attempt({ sampleChecked: true, paperRead: true, ownerConsent: "GRANTED", checkedAlive: true, checkedVitality: 50,
    resolutionPaid: true, resolutionActions: 1, spiritualitySpent: 5, mindSpent: 2, padId: "CB3-PAD-1", abilitySourceId: "CB3-LIVE-1", abilityAtSecond: 5, resolutionAtSecond: 5,
    abilityTier: "SUCCESS", abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: 42, tier: "SUCCESS" },
    effectActive: true, remainingSeconds: 60, elapsedSeconds: 5, playerTravelMetres: 4,
    playerMoves: [{ from: "START", to: "A", mode: "WALK", metres: 4, seconds: 4, itemIds: ["CB3-CASE", "CB3-TAG", "CB3-PAD-1", "CB3-PAD-2", "CB3-PAD-3"] }], ...extra });
}
function life(): CoffinBearerProjection["life"] {
  const state = createCoffinBearerLifeState();
  return { ...state, title: "三个有限活性保全原案G", story: "仅对仍活着的同一原样本进行有限保全。", summary: "三不同原样本、原匣和原片均保持原身份。", environment: "START到A4米，A到B4米，净空普通通路。", nextStep: "核对本案原样本、原纸和当前许可。",
    inside: false, insideCase: false, currentAttempt: null, actions: [], facts: ["正式照料后不再进行本批测试性衰减。"],
    cases: ([
      { id: "fresh-transfer", title: "G · 原活盆有限保全转运", story: "第一株活盆实等本次窗口后真实交付。" },
      { id: "withdrawn-transfer", title: "G · 撤回许可后的原样返还", story: "第二株原活盆须先停止效果再实走返回。" },
      { id: "dry-record", title: "G · 原枯样普通记录", story: "已枯原样保持0活性，普通观察后如实归还。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): CoffinBearerProjection["encounter"] {
  return { title: "诺兰的原场冲突G", story: "新诺兰、原棍与独立灵性。", status: "AVAILABLE", inside: false, scene: null, enemy: null,
    guardMode: null, guardCharges: 0, guardAttempts: 0, preservationAttempts: 0, actions: [], facts: ["2米净空原场与4米普通出口，无追逐，没有第三人在场。"] };
}
function projection(extra: Partial<CoffinBearerProjection> = {}): CoffinBearerProjection {
  return { title: "抬棺人与有限活性转运", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限活性保全G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `coffin-bearer-potion-${n}`, title: `抬棺人第${n}独立原瓶`, source: `CB3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `coffin-bearer-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对既往原记录", completedWeek: 139 }, { taskId: "CHECK_LIMITS", title: "核验有限边界", completedWeek: 140 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 141 }],
    preparedWeek: null, abilities: COFFIN_BEARER_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原古代炼金师消化100，晋升后已满12整周。", pollution: 3,
    risk: COFFIN_BEARER_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原AA4-STEM-1、原AA4护腕及原惰性基质保持原位置和状态，不移动、不补能。",
    inheritedHistory: ["旧奥斯里克AA4-OSRIC-VALE原SURRENDERED/H70/M100/S24，1重伤；2次ARC、2次WARD、guardAttempts0保留。", "六阶段原瓶、掌握、失败、原人物与原物全字段保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原匣仅容一株原样本，交付或归还后真实收束。", ...extra };
}
function activate(value: CoffinBearerProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function atA(id: CaseId, current: Attempt, actions: CoffinBearerAction[] = []): CoffinBearerProjection {
  const value = activate(projection({ promoted: true, actions, preferredActionId: actions[0]?.id ?? null }), id, current);
  value.life.playerLocation = "A"; value.life.playerTravelMetres = 4; value.life.clockSeconds = current.elapsedSeconds; value.life.owner.consent = current.ownerConsent;
  Object.assign(value.life.kit, { purchased: true, purchasedWeek: 142, costPence: 90, actionsSpent: 1 });
  Object.assign(value.life.box, { owner: "PLAYER", holder: "PLAYER", location: "A" }); Object.assign(value.life.tag, { owner: "PLAYER", holder: "PLAYER", location: "A" });
  value.life.pads.forEach(pad => Object.assign(pad, { owner: "PLAYER", holder: "PLAYER", location: "A", ...(pad.id === current.padId ? { status: "SPENT", caseId: id, spentWeek: 143 } : {}) }));
  if (current.sampleChecked) value.life.samples.find(sample => sample.id === current.sampleId)!.care = "EXPOSED";
  return value;
}
function panel(value = projection(), props: Partial<Omit<CoffinBearerPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<CoffinBearerPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择抬棺人事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("CoffinBearerPanel independent originals and saved intentions", () => {
  it("leads with verified sequence names, unknown recipe and one simple paid goal", () => {
    const reason = "原古代炼金师只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "抬棺人与有限活性转运" })); expect(screen.getByRole("region", { name: "抬棺人" })).toBeTruthy(); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const summary = screen.getByRole("region", { name: "抬棺人当前目标" });
    for (const text of [reason, "抬棺人3", "荒芜主母2", "仅开放有限活性保全", "不提供完整配方", "晋升仍须完成专业准备", "原枯样不会复活", "以当前说明为准"]) expect(summary.textContent).toContain(text);
    const resources = screen.getByRole("region", { name: "抬棺人当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取抬棺人专业指导").disabled).toBe(true); expect(button("听取抬棺人专业指导").getAttribute("aria-describedby")).toContain("coffin-bearer-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原人物、原物与旧母亲路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取抬棺人专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows projected professional preparation before optional original bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "写下实际停止与返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "coffin-bearer-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "抬棺人下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it.each(["POTION_WORK", "BUY_POTION"] as const)("selects another original and forwards its exact %s intent only once", async type => {
    const first = action({ type, bottleId: "coffin-bearer-potion-1" }, "第一原瓶实际交付", "1行动"), second = action({ type, bottleId: "coffin-bearer-potion-2" }, "第二原瓶实际交付", "0行动 · 900便士");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:coffin-bearer-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews only the selected bottle, preparation, four risks and preserved original history", async () => {
    const first = consume(), second = consume("coffin-bearer-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 121, insideCase: true });
    const { onCommand, onClose } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:coffin-bearer-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "抬棺人原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "抬棺人第2独立原瓶" }));
    for (const text of ["coffin-bearer-potion-2", "CB3-SEAL-2", "73%", "第121周", "140便士不退", "意志难度30", "大成功", "成功", "失败", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整主辅配方", "仍须完成服药准备", "旧奥斯里克原投降和原伤不变", "伙伴与原物不重开"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("CB3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "抬棺人原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the same confirmed intent locked through save failure until committed facts change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 121 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<CoffinBearerPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "抬棺人原瓶服用确认" })).toBeTruthy();
    rerender(<CoffinBearerPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<CoffinBearerPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "抬棺人原瓶服用确认" })).toBeNull();
    expect(button("关闭抬棺人页面").disabled).toBe(false); expect(picker().value).toBe("case:fresh-transfer"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { disabled: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks commands, selection and close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取抬棺人专业指导")); fireEvent.click(button("关闭抬棺人页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取抬棺人专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates an unsubmitted review if saved eligibility changes", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<CoffinBearerPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "抬棺人原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows all real costs and future supply without exposing an invented recipe", async () => {
    panel(); await open("独立成品与晋升准备"); const boundary = screen.getByRole("region", { name: "抬棺人成品与配方边界" });
    for (const text of ["500", "6400", "5500", "900", "12整周", "消化100", "140", "健康>20", "精神>40", "下一真实周", "完整主辅配方、材料用量、调配顺序与晋升仪式尚未获得，仍保持未知，仍须完成服药准备。", "核对原记录、检查有限边界、标明真实退出是实际专业准备，服药前仍须逐项完成。三原瓶耗尽后须申请并等下一真实周独立供货，不重置旧瓶、不开放自制配方。", "不开放自制配方"]) expect(boundary.textContent).toContain(text);
  });

  it("forwards paid preparation cancellation without refunding or consuming an original locally", () => {
    const leave = action({ type: "LEAVE_PREPARATION" }, "结束本次已付准备", "0行动 · 140便士不退"), value = projection({ preparedWeek: 121, actions: [leave], preferredActionId: leave.id }), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "抬棺人服药准备与成本" }).textContent).toContain("未服原瓶仍保留");
  });
});


describe("CoffinBearerPanel original samples and physical custody", () => {
  it("offers one local case choice while all three different originals remain explicit", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of value.life.cases) {
      await userEvent.selectOptions(picker(), `case:${entry.id}`);
      expect(screen.getByRole("region", { name: "当前抬棺人生活情境" }).textContent).toContain(entry.story);
    }
    const samples = screen.getByRole("region", { name: "抬棺人三株原样本" });
    for (const text of ["CB3-LIVE-1", "CB3-LIVE-2", "CB3-DRY-1", "CB3-ADA", "原初活性 50 / 100", "当前活性 0 / 100", "原自然枯萎记录", "当前已经枯萎", "原重 500 克", "原重 100 克"]) expect(samples.textContent).toContain(text);
    expect(fold("三项原案的观察与实际结果").open).toBe(false); expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("routes kit purchase to the first case and displays its actual supplier custody", () => {
    const buy = action({ type: "BUY_KIT" }, "购入原转运匣和三片衬片", "1行动 · 90便士"), value = projection({ promoted: true, actions: [buy], preferredActionId: buy.id }), before = structuredClone(value), { onCommand } = panel(value);
    expect(picker().value).toBe("case:fresh-transfer"); const kit = screen.getByRole("region", { name: "抬棺人原匣与有限耗材" });
    for (const text of ["尚未购入", "CB3-SUPPLIER", "当前由原供货者持有", "CB3-CASE", "CB3-TAG", "CB3-PAD-1", "CB3-PAD-2", "CB3-PAD-3", "承重 1000 克", "容量 1 株", "没有免伤或复活作用"]) expect(kit.textContent).toContain(text);
    fireEvent.click(button(buy.label)); fireEvent.click(button(buy.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(buy.command); expect(value).toEqual(before); expect(value.life.kit.purchased).toBe(false);
  });

  it.each(["ABILITY", "ORDINARY"] as const)("forwards %s preparation without local material or vitality mutation", method => {
    const prepare = action({ type: "PREPARE", caseId: "fresh-transfer", method }, `准备${method}方案`, "1行动");
    const value = projection({ promoted: true, actions: [prepare], preferredActionId: prepare.id }); value.life.cases[0]!.status = "OBSERVED";
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(prepare.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command); expect(value).toEqual(before);
  });

  it("shows preserved vitality as a saved limited clock and the same spent original pad", () => {
    const wait = action({ type: "WAIT_WINDOW", caseId: "fresh-transfer" }, "实等本次60秒窗口", "0行动 · 实际60秒"), value = atA("fresh-transfer", cast(), [wait]), before = structuredClone(value), { onCommand, onClose } = panel(value);
    const current = screen.getByRole("region", { name: "抬棺人当前许可与有限保全" });
    for (const text of ["CB3-LIVE-1", "当时活着、活性 50", "当前有效，剩余 60 秒", "已实际等待 0 秒", "灵性 5", "精神 2", "实施行动 1", "CB3-PAD-1", "保全不补回活性"]) expect(current.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "抬棺人原匣与有限耗材" }).textContent).toContain("CB3-PAD-1 · 来源 CB3-SUPPLIER · 已用原惰性片，仍保留同物");
    expect(picker().disabled).toBe(true); expect(button("关闭抬棺人页面").disabled).toBe(true); fireEvent.click(button(wait.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(wait.command); expect(value).toEqual(before); expect(value.life.currentAttempt!.remainingSeconds).toBe(60); expect(onClose).not.toHaveBeenCalled();
  });

  it("renders actual expiry and loss without inventing a fresh effect or restoring vitality", () => {
    const take = action({ type: "TAKE_SAMPLE", caseId: "fresh-transfer" }, "装入同一原匣"), current = cast({ effectActive: false, effectExpired: true, remainingSeconds: 0, waitedSeconds: 60, waitCompleted: true, protectedExposureSeconds: 60, vitalityLost: 3, elapsedSeconds: 65 });
    const value = atA("fresh-transfer", current, [take]); value.life.samples[0]!.vitality = 47;
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "抬棺人当前许可与有限保全" });
    for (const text of ["已实际到期", "剩余 0 秒", "实际等待 60 秒", "不能重复刷时长", "保全暴露 60 秒", "本案已损失活性 3"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "抬棺人三株原样本" }).textContent).toContain("当前活性 47 / 100");
    fireEvent.click(button(take.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(take.command); expect(value).toEqual(before); expect(value.life.box.sampleId).toBeNull();
  });

  it("shows a failed paid attempt without awarding mastery or replacing its original pad", () => {
    const current = cast({ effectActive: false, remainingSeconds: 0, abilityTier: "FAILURE", abilityCheck: { ability: "knowledge", baseAbility: 30, effectiveAbility: 30, modifiers: [], difficulty: 20, chance: 70, roll: 90, tier: "FAILURE" } });
    const value = atA("fresh-transfer", current), before = structuredClone(value); panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true); expect(fold("本次实际尝试与已付代价").textContent).toContain("失败费用保留");
    const facts = screen.getByRole("region", { name: "抬棺人当前许可与有限保全" });
    for (const text of ["实际检定失败", "灵性 5", "精神 2", "实施行动 1", "CB3-PAD-1", "当前没有有效保全"]) expect(facts.textContent).toContain(text);
    expect(value.abilities[0]!.mastery).toBe(0); expect(value.life.pads[0]!.status).toBe("SPENT"); expect(value).toEqual(before);
  });

  it("shows current withdrawal and requires saved stopping before returning the same second live sample", async () => {
    const stop = action({ type: "STOP_EFFECT", caseId: "withdrawn-transfer" }, "停止当前保全"), back = action({ type: "RETURN_A", caseId: "withdrawn-transfer" }, "带第二原活盆实走返回", "0行动 · 4米4秒", { enabled: false, reason: "须先停止未用效力。" });
    const current = cast({ sampleId: "CB3-LIVE-2", abilitySourceId: "CB3-LIVE-2", padId: "CB3-PAD-2", consentWithdrawn: true, recipientConsent: "REVOKED", remainingSeconds: 56, sampleTaken: true, offered: true, elapsedSeconds: 9, protectedExposureSeconds: 4, protectedRemainderSeconds: 4 });
    const value = atA("withdrawn-transfer", current, [stop, back]); value.life.playerLocation = "B"; value.life.recipient.consent = "REVOKED";
    Object.assign(value.life.box, { sampleId: "CB3-LIVE-2", location: "B" }); Object.assign(value.life.samples[1]!, { holder: "CASE", location: "B" });
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value);
    const facts = screen.getByRole("region", { name: "抬棺人当前许可与有限保全" });
    for (const text of ["撤回本次接收和保全许可", "必须先停止剩余效力", "同一原样本普通带回A", "剩余 56 秒"]) expect(facts.textContent).toContain(text);
    expect(button(back.label).disabled).toBe(true); fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
    const saved = structuredClone(value); Object.assign(saved.life.currentAttempt!, { effectActive: false, stopped: true, effectCancelled: true, remainingSeconds: 0 }); saved.actions = [{ ...back, enabled: true, reason: null }]; saved.preferredActionId = back.id;
    rerender(<CoffinBearerPanel {...defaults} value={saved} />); expect(screen.getByRole("region", { name: "抬棺人当前许可与有限保全" }).textContent).toContain("已实际停止");
    fireEvent.click(button(back.label)); expect(onCommand.mock.calls[1]![0]).toBe(back.command); expect(saved.life.playerLocation).toBe("B"); expect(saved.life.samples[1]!.location).toBe("B"); expect(saved.life.currentAttempt!.spiritualitySpent).toBe(5);
  });

  it("preserves dry sample zero and rejects the projected revive option without a local rewrite", async () => {
    const ordinary = action({ type: "ORDINARY_CHECK", caseId: "dry-record" }, "普通核验原枯样", "1行动 · 0灵性0精神 · 无材料检定"), impossible = action({ type: "PERFORM", caseId: "dry-record" }, "尝试枯样保全", "1行动", { enabled: false, reason: "原样本已经枯萎，不能施术。" });
    const value = atA("dry-record", attempt({ method: "ORDINARY", sampleId: "CB3-DRY-1", sampleChecked: true, checkedAlive: false, checkedVitality: 0, ownerConsent: "RECORD_ONLY", paperRead: true }), [ordinary, impossible]);
    const before = structuredClone(value), { onCommand } = panel(value); await open("其它步骤与未满足条件");
    expect(button(impossible.label).disabled).toBe(true); const scene = screen.getByRole("region", { name: "当前抬棺人生活情境" }); expect(scene.textContent).toContain("不能承诺复活");
    fireEvent.click(button(impossible.label)); expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(value.life.samples[2]!.alive).toBe(false); expect(value.life.samples[2]!.vitality).toBe(0); expect(value.life.pads.every(pad => pad.status === "UNUSED")).toBe(true); expect(value).toEqual(before);
  });

  it("forwards only the limited dry-record conclusion, retaining the original fixed paper", async () => {
    const limited = action({ type: "CONFIRM_LIMITED", caseId: "dry-record", claim: "LIMITED" }, "确认原枯样只能如实记录"), revive = action({ type: "CONFIRM_LIMITED", caseId: "dry-record", claim: "REVIVE" }, "承诺复活原枯样", "0行动", { enabled: false, reason: "不得改变原死亡状态或原纸。" });
    const value = atA("dry-record", attempt({ method: "ORDINARY", sampleId: "CB3-DRY-1", sampleChecked: true, checkedAlive: false, checkedVitality: 0, ordinaryChecked: true, resolutionPaid: true, resolutionActions: 1, offered: true, recipientConsent: "RECORD_ONLY", rejectedClaims: 1 }), [limited, revive]);
    const before = structuredClone(value), { onCommand } = panel(value); await open("其它步骤与未满足条件"); expect(button(revive.label).disabled).toBe(true);
    fireEvent.click(button(revive.label)); expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button(limited.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(limited.command); expect(value).toEqual(before);
    expect(fold("本次实际尝试与已付代价").textContent).toContain("复活声明被拒绝 1 次");
  });

  it.each(["STOP_EFFECT", "WAIT_WINDOW", "RETURN_A", "RETURN_SAMPLE", "RETURN_KIT", "RETURN_START", "LEAVE_CASE"] as const)("keeps the actual %s path available at zero AP and never moves originals locally", type => {
    const entry = action({ type, caseId: "fresh-transfer" }, `真实${type}`, "0行动"), value = atA("fresh-transfer", cast(), [entry]); value.resources!.actionsRemaining = 0;
    const before = structuredClone(value), { onCommand } = panel(value); expect(button(entry.label).disabled).toBe(false); fireEvent.click(button(entry.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(value).toEqual(before);
  });

  it("keeps an original-sample return locked through a failed save without fake custody changes", () => {
    const back = action({ type: "RETURN_SAMPLE", caseId: "withdrawn-transfer" }, "当面归还同一第二原盆", "0行动"), current = cast({ sampleId: "CB3-LIVE-2", abilitySourceId: "CB3-LIVE-2", consentWithdrawn: true, recipientConsent: "REVOKED", effectActive: false, remainingSeconds: 0, stopped: true, sampleTaken: true });
    const value = atA("withdrawn-transfer", current, [back]); Object.assign(value.life.samples[1]!, { holder: "CASE", location: "A", vitality: 49 }); value.life.box.sampleId = "CB3-LIVE-2"; value.resources!.actionsRemaining = 0;
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value); fireEvent.click(button(back.label));
    rerender(<CoffinBearerPanel {...defaults} error={{ message: "原样本交回保存失败", retryable: true }} />); fireEvent.click(button(back.label)); fireEvent.click(button("关闭抬棺人页面"));
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
    rerender(<CoffinBearerPanel {...defaults} value={structuredClone(value)} />); expect(button(back.label).disabled).toBe(true); expect(value.life.samples[1]!.holder).toBe("CASE");
    const saved = structuredClone(value); Object.assign(saved.life.samples[1]!, { holder: "OWNER", care: "OWNER_CARE", returns: 1 }); saved.life.box.sampleId = null; saved.life.currentAttempt!.sampleReturned = true;
    saved.actions = []; saved.preferredActionId = null; rerender(<CoffinBearerPanel {...defaults} value={saved} />);
    expect(screen.getByRole("region", { name: "抬棺人三株原样本" }).textContent).toContain("当前活性 49 / 100"); expect(screen.getByRole("region", { name: "抬棺人当前许可与有限保全" }).textContent).toContain("已真实交回原所有者"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("shows saved handover to the real recipient and keeps later external time from inventing sample decay", () => {
    const value = atA("fresh-transfer", cast({ handedOver: true, sampleTaken: true, offered: true, recipientConsent: "GRANTED", effectActive: false, effectExpired: true, remainingSeconds: 0, waitedSeconds: 60, waitCompleted: true, protectedExposureSeconds: 60, vitalityLost: 3 }));
    Object.assign(value.life.samples[0]!, { vitality: 47, holder: "RECIPIENT", location: "B", care: "RECIPIENT_CARE", handovers: 1 }); value.life.box.sampleId = null;
    const before = structuredClone(value), { defaults, rerender } = panel(value); const samples = screen.getByRole("region", { name: "抬棺人三株原样本" });
    for (const text of ["当前活性 47 / 100", "由接收者莉娜持有", "本批测试性衰减停止", "实际交付 1 次"]) expect(samples.textContent).toContain(text);
    const later = structuredClone(value); later.life.externalSeconds = 124; rerender(<CoffinBearerPanel {...defaults} value={later} />);
    expect(screen.getByRole("region", { name: "抬棺人三株原样本" }).textContent).toContain("当前活性 47 / 100"); expect(later.life.samples).toEqual(value.life.samples); expect(value).toEqual(before);
  });

  it("requires physical collection of the returned original kit in a later case", () => {
    const take = action({ type: "TAKE_KIT", caseId: "withdrawn-transfer" }, "在A当面领取同一原匣"), value = atA("withdrawn-transfer", attempt({ sampleId: "CB3-LIVE-2" }), [take]);
    Object.assign(value.life.box, { holder: "OWNER", location: "A", returns: 1 }); Object.assign(value.life.tag, { holder: "OWNER", location: "A", returns: 1 });
    value.life.pads.forEach(pad => Object.assign(pad, { holder: "OWNER", location: "A" }));
    const before = structuredClone(value), { onCommand } = panel(value), kit = screen.getByRole("region", { name: "抬棺人原匣与有限耗材" });
    expect(kit.textContent).toContain("当前由原所有者艾达持有、在A"); expect(kit.textContent).toContain("下案须本人先走到A实际领取"); fireEvent.click(button(take.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(take.command); expect(value).toEqual(before);
  });
});

describe("CoffinBearerPanel bounded new combat and old history", () => {
  it("keeps verified names, unknown formula and G preservation separate from unverified powers", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("能力范围与实际掌握");
    const boundary = screen.getByRole("region", { name: "抬棺人能力与使用范围" });
    for (const text of ["mother.s3.finite-preservation", "实耗一片原衬片", "5灵性", "2精神", "知识20", "60秒", "不提高活性", "枯样", "不抵死亡", "不清旧伤", "复活", "灵魂", "13行动", "90便士", "掌握8"]) expect(boundary.textContent).toContain(text);
    expect(COFFIN_BEARER_ABILITIES).toHaveLength(1); expect(screen.getByText(`${COFFIN_BEARER_ABILITIES[0]!.label} · 掌握 0：${COFFIN_BEARER_ABILITIES[0]!.description}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /创造灵魂|操纵死人|棺材免死/ })).toBeNull();
  });

  it("retains Osric's surrendered original and old matrices as read-only history", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原人物、原物与旧母亲路线记录");
    const history = screen.getByRole("region", { name: "抬棺人继承记录" });
    for (const text of ["AA4-OSRIC-VALE", "SURRENDERED/H70/M100/S24", "1重伤", "2次ARC", "2次WARD", "guardAttempts0", "AA4-STEM-1", "原惰性基质", "六阶段", "不作为新目标", "不移动、不补能"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("routes guard preparation to the optional encounter without creating the guard locally", () => {
    const prepare = action({ type: "PREPARE_GUARD" }, "实际制作独立新护腕", "1行动 · 120便士 · 4灵性"), value = projection({ promoted: true, actions: [prepare], preferredActionId: prepare.id }), before = structuredClone(value), { onCommand } = panel(value);
    expect(picker().value).toBe("encounter"); const guard = screen.getByRole("region", { name: "抬棺人新护腕与实际原段" });
    for (const text of ["CB3-GUARD-MATERIAL", "尚未制成 CB3-GUARD", "实际制作已付 0 行动、0 便士、0 灵性", "CB3-SEG1", "CB3-SEG2", "CB3-SEG3", "原材料尚未制段"]) expect(guard.textContent).toContain(text);
    fireEvent.click(button(prepare.label)); fireEvent.click(button(prepare.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command); expect(value).toEqual(before);
  });

  it.each(["MATRIX", "PRESERVE"] as const)("shows %s pending charges and real spent segments without charging or clearing them", mode => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null });
    Object.assign(value.life.guard, { prepared: true, preparedWeek: 147, owner: "PLAYER", location: "HAND", actionsSpent: 1, costPence: 120, spiritualitySpent: 4 });
    value.life.guard.segments[0]!.status = "SPENT"; value.life.guard.segments[1]!.status = "UNUSED"; value.life.guard.segments[2]!.status = "UNUSED";
    value.encounter = { ...encounter(), status: "FIGHTING", inside: true, guardMode: mode, guardCharges: mode === "MATRIX" ? 1 : 2, guardAttempts: mode === "MATRIX" ? 1 : 0, preservationAttempts: mode === "PRESERVE" ? 1 : 0,
      enemy: { id: "CB3-NOLAN", name: "诺兰·韦斯特", age: 42, source: "ORIGINAL_LIMITED_G", sequence: 4, health: 90, mind: 100, spirituality: 107, status: "RESISTING", weaponId: "CB3-NOLAN-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 1, WARD: 1, COMPOSE: 1 } },
      scene: { courtId: "CB3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "COURT", distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 } };
    const before = structuredClone(value), { onCommand, onClose } = panel(value); expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    const enemy = screen.getByRole("region", { name: "抬棺人原人遭遇" }); for (const text of ["诺兰·韦斯特", "42岁", "CB3-NOLAN-ROD", "107 / 120", "实际弧光 1 次", "先付自己的全部费用", "未发动的术法不收费"]) expect(enemy.textContent).toContain(text);
    const guard = screen.getByRole("region", { name: "抬棺人新护腕与实际原段" });
    for (const text of [mode, `剩余真实防护 ${mode === "MATRIX" ? 1 : 2} 次`, "CB3-SEG1 · SPENT", "CB3-SEG2 · 同一原段尚未使用", "120 便士、4 灵性", "不叠加、不再次收费", "敌方0动作不消耗", "已用原段不变回未用"]) expect(guard.textContent).toContain(text);
    fireEvent.click(button("关闭抬棺人页面")); expect(onClose).not.toHaveBeenCalled(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps paid spent segments after saved round expiry and allows ordinary resource fallback", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null });
    Object.assign(value.life.guard, { prepared: true, preparedWeek: 147, owner: "PLAYER", location: "HAND", actionsSpent: 1, costPence: 120, spiritualitySpent: 4 }); value.life.guard.segments.forEach(segment => { segment.status = "SPENT"; });
    value.encounter = { ...encounter(), status: "FIGHTING", inside: true, guardMode: null, guardCharges: 0, guardAttempts: 1, preservationAttempts: 2 };
    const before = structuredClone(value); panel(value); const guard = screen.getByRole("region", { name: "抬棺人新护腕与实际原段" });
    for (const text of ["当前待用模式：无", "剩余真实防护 0 次", "基质 1 次", "有限保全 2 次", "未制作或耗尽时仍可交谈和选择迎战", "均不支付不存在的资源"]) expect(guard.textContent).toContain(text);
    expect(guard.textContent!.match(/SPENT/g)).toHaveLength(3); expect(value).toEqual(before);
  });

  it("forwards a zero AP ordinary exit and waits for committed departure before local close", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原出口实走4米离开", "0行动 · 4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id }); value.resources!.actionsRemaining = 0; value.encounter = { ...encounter(), status: "READY", inside: true };
    const before = structuredClone(value), { onCommand, onClose, defaults, rerender } = panel(value); fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before); expect(button("关闭抬棺人页面").disabled).toBe(true);
    const left = structuredClone(value); left.encounter.status = "RESOLVED"; left.encounter.inside = false; left.actions = []; left.preferredActionId = null;
    rerender(<CoffinBearerPanel {...defaults} value={left} />); fireEvent.click(button("关闭抬棺人页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("preserves the new enemy's dead body and rod in court while old Osric remains surrendered", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); value.encounter = { ...encounter(), status: "RESOLVED", inside: false,
      enemy: { id: "CB3-NOLAN", name: "诺兰·韦斯特", age: 42, source: "ORIGINAL_LIMITED_G", sequence: 4, health: 0, mind: 100, spirituality: 17, status: "DEAD", weaponId: "CB3-NOLAN-ROD", weaponLocation: "COURT", powerUses: { ARC_BOLT: 7, WARD: 5, COMPOSE: 12 } },
      scene: { courtId: "CB3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "EXIT", distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 4 } };
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.change(picker(), { target: { value: "encounter" } });
    const enemy = screen.getByRole("region", { name: "抬棺人原人遭遇" }); for (const text of ["原身体已死亡", "原武器 CB3-NOLAN-ROD", "留在原场", "已真实离场 4 米", "旧奥斯里克的原投降、原伤与资源保持"]) expect(enemy.textContent).toContain(text);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a dead player read-only and allows the local archive close", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); value.resources!.health = 0; value.encounter.inside = true;
    const { onCommand, onClose } = panel(value); expect(screen.getByRole("region", { name: "抬棺人当前目标" }).textContent).toContain("本周目已经死亡");
    fireEvent.click(button("关闭抬棺人页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
  });
});


describe("CoffinBearer exact authored paragraph display", () => {
  it("adapts authored source paragraphs without mutating fixture commands or costs", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value);
    const { onCommand } = panel(value);
    await open("独立成品与晋升准备");
    await open("能力范围与实际掌握");
    expect(screen.queryByText(COFFIN_BEARER_FORMULA_STATUS)).toBeNull();
    expect(screen.getByText("母亲途径的后续为抬棺人3、荒芜主母2、自然行者1；抬棺人完整主辅配方、材料用量、调配顺序与晋升仪式尚未获得，仍保持未知，仍须完成服药准备。同一位原成年导师伊芙·莫兰只经独立成品渠道交接本批三个独立原瓶，实际准备原苗圃旁安静原房、普通退出路线与在场支持。三项专业准备和当周房间检查仍须完成，不开放自制魔药。")).toBeTruthy();
    expect(screen.queryByText(COFFIN_BEARER_SOURCE_STATUS)).toBeNull();
    expect(screen.getByText("母亲途径的后续为抬棺人3、荒芜主母2、自然行者1。本阶段新增有限活性保全，不能复活、造魂、操纵死人或免于死亡。当前渠道只提供成品魔药，晋升仍须完成专业准备。46岁成年自主所有者CB3-ADA艾达·芬恩、39岁成年自主接收照料者CB3-LENA莉娜·肖、42岁成年CB3-NOLAN诺兰·韦斯特、三不同原样本、原转运匣原牌原纸原衬片、新原护腕及所有场地、当前许可、时限、距离、成本、检定、数值和奖励均以当前说明为准。原活盆CB3-LIVE-1/2具有独立原温室培养记录，原CB3-DRY-1早已自然枯萎；它们不是旧AA4-STEM-1变出或替换的样本。仅减慢当前仍活样本本次有限暴露的衰减，不增加活性、治疗、改死亡或证明永久保全。旧耕种者至古代炼金师六个阶段全字段冻结，原AA4-OSRIC-VALE奥斯里克原伤势、资源与投降结果不重开；旧护腕、原材料、原茎原盆和原报告不移入新库。新CB3-GUARD必须以新原材料另外实际制作，其三段不自动补充。原身体与普通死亡不因本次晋升重开。")).toBeTruthy();
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
