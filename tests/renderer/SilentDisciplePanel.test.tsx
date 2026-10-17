/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SilentDisciplePanel, type SilentDisciplePanelProps } from "../../src/renderer/SilentDisciplePanel";
import type { SilentDiscipleAction, SilentDiscipleCommand, SilentDiscipleProjection } from "../../src/domain/silent-disciple/types";
import { SILENT_DISCIPLE_ABILITIES, SILENT_DISCIPLE_CONSUMPTION_RISK } from "../../src/domain/silent-disciple/content";
import { createSilentDiscipleLifeState, validateSilentDiscipleActivityCommand } from "../../src/domain/silent-disciple/life";
import { validateSilentDiscipleAcquisitionCommand } from "../../src/domain/silent-disciple/index";
import { validateSilentDiscipleEncounterCommand } from "../../src/domain/silent-disciple/encounter";

type Attempt = NonNullable<SilentDiscipleProjection["life"]["currentAttempt"]>;
type CaseId = SilentDiscipleProjection["life"]["cases"][number]["id"];
const action = (command: SilentDiscipleCommand, label: string, cost = "0行动", extra: Partial<Omit<SilentDiscipleAction, "command">> = {}): SilentDiscipleAction => {
  expect(validateSilentDiscipleAcquisitionCommand(command) || validateSilentDiscipleActivityCommand(command) || validateSilentDiscipleEncounterCommand(command)).toBe(true);
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
};
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取沉默门徒专业指导", "1行动 · 500便士");
const consume = (id = "silent-disciple-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");

// Structurally typed, isolated public fixtures test rendering and the exact public command API.
// They do not claim a valid campaign save, a natural promotion, or a successful random replay.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 115, date: { epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 12 }, method: "ABILITY", closed: false, result: "NONE",
    initialSpirituality: 48, initialMind: 90, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [],
    spiritualitySpent: 0, mindSpent: 0, resolutionPaid: false, resolutionActions: 0, consent: "UNASKED", withdrawn: false,
    identityRead: false, noteRead: false, identityCompared: false, comparedForm: null, itemsStored: false, itemsReturned: false,
    abilityTier: null, abilitySourceId: null, abilityAtSecond: null, inputActive: false, stopped: false, formRemainingSeconds: 0,
    linkState: "NONE", linkRemainingSeconds: 0, waitedSeconds: 0, waitCompleted: false, released: false, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null, ...extra };
}
function life(): SilentDiscipleProjection["life"] {
  const state = createSilentDiscipleLifeState();
  return { ...state, title: "同一身体的三项有限实践G", story: "同一成年埃尔莎、当次许可和实际期限分别保存。", environment: "原安静房与普通路径。", nextStep: "先取得本次原志愿者同意。",
    inside: false, insideCase: false, currentAttempt: null, actions: [], facts: ["本人在START；尚无实际行走。", "原衣物与原包属于埃尔莎，须本人实际归还。"],
    cases: ([
      { id: "original-body", title: "G · 同一原身体的短时变形", story: "本人读同一原记录纸，再实际比较埃尔莎身份和原身体。" },
      { id: "revoked-form", title: "G · 撤回同意后的原身体", story: "埃尔莎在真实一次尝试后撤回同意，必须停止并真实复原归物。" },
      { id: "measured-link", title: "G · 原志愿者的非伤害联系", story: "当事人只许可30秒非伤害联系，不同意自伤、反射或身体控制。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): SilentDiscipleProjection["encounter"] {
  return { title: "卡尔德的原场冲突G", story: "原卡尔德、原棍与独立灵性；原敌保留抵抗与反制。", status: "AVAILABLE", inside: false, scene: null, enemy: null,
    blocksPurchased: false, blocks: [], form: "HUMAN", link: "NONE", linkRound: null, enemyFormUntilSeconds: null, actions: [],
    facts: ["原敌距2米，4米普通出口，无追逐、无旁人。"] };
}
function projection(extra: Partial<SilentDiscipleProjection> = {}): SilentDiscipleProjection {
  return { title: "沉默门徒与有限变形", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限变形与实际核验G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；批次耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `silent-disciple-potion-${n}`, title: `沉默门徒第${n}独立原瓶`, source: `SD3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `silent-disciple-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对既往原记录", completedWeek: 110 }, { taskId: "CHECK_LIMITS", title: "核验原房间有限范围", completedWeek: 111 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 112 }],
    preparedWeek: null, abilities: SILENT_DISCIPLE_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原木偶消化100，晋升后已满12整周。", pollution: 3,
    risk: SILENT_DISCIPLE_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原PU4-TOKEN-1和PU4-NOTE-1保持；原PU4-BLOCK-1/2为SPENT/TARGET_GROUND，PU4-BLOCK-3为READY/SOURCE；旧库存不补回。",
    inheritedHistory: ["囚犯、疯子、狼人、活尸、怨魂与木偶六阶段原记录保持。", "原埃德林仍SURRENDERED，H60/S13，一轻一重两处伤势保留。", "旧本人HUMAN/NONE；旧月相历史不叠加，旧掌握0保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "本人START至A实走4米，至B实走8米；原物须本人实际带回。", ...extra };
}
function activate(value: SilentDiscipleProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current; value.life.facts = [];
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function panel(value = projection(), props: Partial<Omit<SilentDisciplePanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<SilentDisciplePanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择沉默门徒事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("SilentDisciplePanel isolated public projections and exact saved commands", () => {
  it("leads with one current objective, visible resources and the public disabled reason", () => {
    const reason = "原木偶只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "沉默门徒与有限变形" })); expect(screen.getByRole("region", { name: "沉默门徒" })).toBeTruthy(); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "沉默门徒当前目标" }).textContent).toContain(reason);
    const resources = screen.getByRole("region", { name: "沉默门徒当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取沉默门徒专业指导").disabled).toBe(true); expect(button("听取沉默门徒专业指导").getAttribute("aria-describedby")).toContain("silent-disciple-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原人物、原物与旧被缚者路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取沉默门徒专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows the projected preparation objective ahead of optional bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "写下本人实际停止与返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "silent-disciple-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "沉默门徒下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it("selects a different original bottle locally and submits only its exact labour command once", async () => {
    const first = action({ type: "POTION_WORK", bottleId: "silent-disciple-potion-1" }, "第一原瓶实际劳务", "1行动"), second = action({ type: "POTION_WORK", bottleId: "silent-disciple-potion-2" }, "第二原瓶实际劳务", "1行动");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:silent-disciple-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews the selected original, 140-cost preparation, unknown ritual and four risks before consumption", async () => {
    const first = consume(), second = consume("silent-disciple-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 113 });
    const { onCommand, onClose } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:silent-disciple-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "沉默门徒原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "沉默门徒第2独立原瓶" }));
    for (const text of ["silent-disciple-potion-2", "SD3-SEAL-2", "73%", "第113周", "140便士不退", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整配方", "独立成品渠道", "不开放自制魔药"]) expect(review.textContent).toContain(text);
    expect(within(review).getByText(/^沉默门徒是被缚者途径序列3，古称诅咒之物；完整配方尚未掌握，服用前需要专业准备。/).textContent).not.toMatch(/原核|原著|原创G|尚未核实/);
    expect(review.textContent).not.toContain("SD3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "沉默门徒原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the original confirmed intent locked through save failure without recharging or retrying locally", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<SilentDisciplePanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "沉默门徒原瓶服用确认" })).toBeTruthy();
    rerender(<SilentDisciplePanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<SilentDisciplePanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "沉默门徒原瓶服用确认" })).toBeNull();
    expect(button("关闭沉默门徒页面").disabled).toBe(false); expect(picker().value).toBe("case:original-body"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { disabled: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks new commands, selection and local close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取沉默门徒专业指导")); fireEvent.click(button("关闭沉默门徒页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取沉默门徒专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates an unsubmitted bottle review when the saved resources or eligibility change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<SilentDisciplePanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "沉默门徒原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])("keeps original bottle %i confirmation independent and consumes its exact projected command", async number => {
    const entries = [1, 2, 3].map(n => consume(`silent-disciple-potion-${n}`)), value = projection({ actions: entries, preferredActionId: entries[0]!.id });
    const { onCommand } = panel(value); await userEvent.selectOptions(picker(), `bottle:silent-disciple-potion-${number}`); await userEvent.click(button("核对并服用"));
    const review = screen.getByRole("region", { name: "沉默门徒原瓶服用确认" }); expect(review.textContent).toContain(`SD3-SEAL-${number}`);
    for (const other of [1, 2, 3].filter(n => n !== number)) expect(review.textContent).not.toContain(`SD3-SEAL-${other}`);
    fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entries[number - 1]!.command);
  });

  it("leaves paid preparation without refunding or consuming the still-owned original bottle locally", () => {
    const leave = action({ type: "LEAVE_PREPARATION" }, "实际结束本次准备", "0行动 · 不退140便士");
    const value = projection({ actions: [leave], preferredActionId: leave.id, preparedWeek: 114 }), before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "沉默门徒服药准备与成本" }).textContent).toContain("未服原瓶仍保留"); fireEvent.click(button(leave.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
  });

  it("shows next-real-week resupply and cannot make the exhausted original bottles usable", () => {
    const receive = action({ type: "RECEIVE_SUPPLY" }, "确认新一批实际到货", "0行动 · 最早第117周", { enabled: false, reason: "本周尚未到货，须下一真实周。" });
    const value = projection({ actions: [receive], preferredActionId: receive.id }); value.bottles.forEach(bottle => { bottle.status = "原瓶已耗尽 · 排异仍保留"; });
    const { onCommand } = panel(value); expect(button(receive.label).disabled).toBe(true); fireEvent.click(button(receive.label)); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
  });

  it("keeps finished-medicine preparation, finite costs and the two new zero masteries explicit", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "沉默门徒成品与配方边界" });
    for (const text of ["完整配方", "主辅材料", "独立成品渠道", "完整仪式均保持未知", "哈伦·维斯", "6400", "5500", "900便士", "140便士", "12整周", "木乃伊", "不开放"]) expect(formula.textContent).toContain(text);
    await open("能力范围与实际掌握"); const boundary = screen.getByRole("region", { name: "沉默门徒能力与使用范围" });
    for (const text of ["诅咒之物", "古代邪物", "神孽", "目标可抵抗", "5灵性", "2精神", "知识20", "60秒", "4灵性", "1精神", "知识18", "30秒", "真实自伤", "不刷新", "掌握 0"]) expect(boundary.textContent).toContain(text);
    const formulaCopy = within(formula).getByText(/^沉默门徒是被缚者途径序列3，古称诅咒之物；完整配方尚未掌握，服用前需要专业准备。/);
    const sourceCopy = within(boundary).getByText(/^序列3沉默门徒也称诅咒之物，后续序列2为古代邪物、序列1为神孽。/);
    expect(formulaCopy.textContent).not.toMatch(/原核|原著|原创G|尚未核实/);
    expect(sourceCopy.textContent).not.toMatch(/原核|Fifthpart|Sixth86|Sixth8|原创G|chained\.s3/);
    for (const text of ["主辅材料、用量、调配顺序和完整仪式均保持未知", "安静原房、普通撤离路线与在场支持", "三项真实专业准备和当周原房检查", "不把莎伦特定木乃伊推广成通用材料", "不开放自制魔药"]) expect(formulaCopy.textContent).toContain(text);
    for (const text of ["实际联系", "真实受伤", "目标可抵抗", "不提供零自伤、无限反射、自动沉默或永久禁言", "各阶段诅咒取代旧发作，不叠加", "43岁", "47岁", "当前意愿", "实际成本", "不保证安全消化或治愈诅咒", "不赠送第二身体"]) expect(sourceCopy.textContent).toContain(text);
    expect(SILENT_DISCIPLE_ABILITIES.map(entry => entry.id)).toEqual(["chained.s3.short-transfiguration", "chained.s3.measured-curse"]);
  });

  it("preserves Edrin, all six old roots, old moon costs and original block positions as read-only history", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value);
    await open("原人物、原物与旧被缚者路线记录"); const history = screen.getByRole("region", { name: "沉默门徒继承记录" });
    for (const text of ["囚犯", "疯子", "狼人", "活尸", "怨魂", "木偶", "原埃德林", "SURRENDERED", "H60/S13", "HUMAN/NONE", "旧月相", "SPENT/TARGET_GROUND", "READY/SOURCE", "旧掌握0"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });
});

describe("SilentDisciplePanel same body, current permission and physical cleanup", () => {
  it("selects each original case locally and displays its actual original body and property readiness", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand } = panel(value);
    for (const entry of value.life.cases) {
      await userEvent.selectOptions(picker(), `case:${entry.id}`); expect(screen.getByRole("region", { name: "当前沉默门徒生活情境" }).textContent).toContain(entry.story);
      const body = screen.getByRole("region", { name: "埃尔莎同一原身体" });
      for (const text of ["埃尔莎·莫尔", "43岁", "SD3-ELSA", "HUMAN人形", "同一身份", "不另留"]) expect(body.textContent).toContain(text);
      const objects = screen.getByRole("region", { name: "沉默门徒原衣物与原包" });
      for (const text of ["SD3-CLOTHES", "SD3-BAG", "SD3-TRAY", "数量 1", "PRIVATE", "本人当前实际穿着"]) expect(objects.textContent).toContain(text);
    }
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it.each(["ABILITY", "ORDINARY"] as const)("forwards %s preparation without automatically transforming or linking", method => {
    const prepare = action({ type: "PREPARE", caseId: "original-body", method }, `准备${method}方案`, "1行动");
    const value = projection({ promoted: true, actions: [prepare], preferredActionId: prepare.id }); value.life.cases[0]!.status = "OBSERVED";
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(prepare.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(prepare.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "当前沉默门徒生活情境" }).textContent).toContain("进入原现场不自动施术");
    expect(screen.getByRole("region", { name: "埃尔莎同一原身体" }).textContent).toContain("HUMAN人形");
  });

  it("submits real PERFORM once and waits for the saved same-body form rather than changing it locally", () => {
    const perform = action({ type: "PERFORM", caseId: "original-body" }, "尝试同一原身体短时变形", "1行动 · 5灵性 · 2精神 · 知识20");
    const value = activate(projection({ promoted: true, actions: [perform], preferredActionId: perform.id }), "original-body", attempt({ consent: "GRANTED", identityRead: true, itemsStored: true }));
    value.life.playerLocation = "A"; value.life.clothing.location = "TRAY"; value.life.clothing.worn = false; value.life.bag.location = "TRAY";
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); fireEvent.click(button(perform.label)); fireEvent.click(button(perform.label));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command); expect(value).toEqual(before); expect(picker().disabled).toBe(true);
    expect(screen.getByRole("region", { name: "埃尔莎同一原身体" }).textContent).toContain("HUMAN人形");
    const saved = structuredClone(value); saved.life.volunteer.form = "RABBIT"; Object.assign(saved.life.currentAttempt!, { abilityTier: "SUCCESS", abilitySourceId: "SD3-ELSA", abilityAtSecond: 4, formRemainingSeconds: 60, spiritualitySpent: 5, mindSpent: 2, resolutionPaid: true, resolutionActions: 1 });
    saved.actions = []; saved.preferredActionId = null; rerender(<SilentDisciplePanel {...defaults} value={saved} />);
    const body = screen.getByRole("region", { name: "埃尔莎同一原身体" }); expect(body.textContent).toContain("RABBIT兔形"); expect(body.textContent).not.toContain("HUMAN人形");
    const current = screen.getByRole("region", { name: "沉默门徒当前许可与剩余期限" });
    for (const text of ["SD3-ELSA", "成功", "剩余兔形 60 秒", "已付灵性 5", "精神 2", "实施行动 1"]) expect(current.textContent).toContain(text);
  });

  it("offers actual waiting at zero AP and zero spirituality while costly release remains disabled", () => {
    const wait = action({ type: "WAIT_FORM", caseId: "original-body" }, "实际等完52秒兔形期限", "0行动 · 0灵性 · 实等52秒"), release = action({ type: "RELEASE_FORM", caseId: "original-body" }, "支付灵性有限解除", "0行动 · 2灵性", { enabled: false, reason: "当前灵性不足2，可实际等待。" });
    const value = activate(projection({ promoted: true, actions: [wait, release], preferredActionId: wait.id }), "original-body", attempt({ consent: "GRANTED", stopped: true, abilityTier: "SUCCESS", abilitySourceId: "SD3-ELSA", formRemainingSeconds: 52, itemsStored: true }));
    value.life.volunteer.form = "RABBIT"; value.life.clothing.location = "TRAY"; value.life.clothing.worn = false; value.life.bag.location = "TRAY"; value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand } = panel(value); expect(button(wait.label).disabled).toBe(false); expect(button(release.label).disabled).toBe(true);
    fireEvent.click(button(wait.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(wait.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "沉默门徒当前许可与剩余期限" }).textContent).toContain("剩余兔形 52 秒");
    expect(screen.getByRole("region", { name: "沉默门徒原衣物与原包" }).textContent).toContain("在原托盘");
  });

  it("keeps actual original clothing on the tray after reversion until a separate return commits", () => {
    const back = action({ type: "RETURN_ITEMS", caseId: "original-body" }, "当面归还原衣物并私下穿回", "0行动 · 原衣物和原包真实归还");
    const value = activate(projection({ promoted: true, actions: [back], preferredActionId: back.id }), "original-body", attempt({ consent: "GRANTED", stopped: true, abilityTier: "SUCCESS", formRemainingSeconds: 0, itemsStored: true, waitedSeconds: 52 }));
    value.life.playerLocation = "A"; value.life.clothing.location = "TRAY"; value.life.clothing.worn = false; value.life.bag.location = "TRAY";
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); const objects = screen.getByRole("region", { name: "沉默门徒原衣物与原包" });
    expect(screen.getByRole("region", { name: "埃尔莎同一原身体" }).textContent).toContain("HUMAN人形"); expect(objects.textContent).toContain("尚未实际穿回");
    fireEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before); expect(objects.textContent).toContain("在原托盘");
    const saved = structuredClone(value); saved.life.clothing.location = "ELSA"; saved.life.clothing.worn = true; saved.life.bag.location = "ELSA"; saved.life.currentAttempt!.itemsReturned = true; saved.actions = []; saved.preferredActionId = null;
    rerender(<SilentDisciplePanel {...defaults} value={saved} />); expect(screen.getByRole("region", { name: "沉默门徒原衣物与原包" }).textContent).toContain("本人当前实际穿着");
    expect(screen.getByRole("region", { name: "沉默门徒当前许可与剩余期限" }).textContent).toContain("已真实归还并穿回");
  });

  it("retains the recorded rabbit observation when the same original body is currently human again", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "original-body", attempt({ consent: "GRANTED", abilityTier: "SUCCESS", abilitySourceId: "SD3-ELSA", stopped: true, identityCompared: true, comparedForm: "RABBIT", waitCompleted: true, waitedSeconds: 47, itemsStored: true, itemsReturned: true }));
    const before = structuredClone(value), { onCommand } = panel(value);
    const currentBody = screen.getByRole("region", { name: "埃尔莎同一原身体" }); expect(currentBody.textContent).toContain("HUMAN人形"); expect(currentBody.textContent).not.toContain("RABBIT兔形");
    const facts = screen.getByRole("region", { name: "沉默门徒原身体原物与真实位置" });
    for (const text of ["当时比较的真实形态 RABBIT", "保留当时原观察", "已实际完成等待", "已真实归还并穿回"]) expect(facts.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("retains current refusal and the existing rabbit body after stopping new input", () => {
    const stop = action({ type: "STOP_INPUT", caseId: "revoked-form" }, "停止新的能力输入", "0行动"), repeat = action({ type: "PERFORM", caseId: "revoked-form" }, "再次试验", "1行动 · 5灵性 · 2精神", { enabled: false, reason: "埃尔莎已撤回本次许可，不可重施。" });
    const value = activate(projection({ promoted: true, actions: [stop, repeat], preferredActionId: stop.id }), "revoked-form", attempt({ consent: "REVOKED", abilityTier: "SUCCESS", abilitySourceId: "SD3-ELSA", inputActive: true, formRemainingSeconds: 60, itemsStored: true }));
    value.life.volunteer.form = "RABBIT"; value.life.clothing.location = "TRAY"; value.life.clothing.worn = false; value.life.bag.location = "TRAY";
    const before = structuredClone(value), { onCommand } = panel(value); const current = screen.getByRole("region", { name: "沉默门徒当前许可与剩余期限" });
    for (const text of ["已撤回同意", "不能再次输入", "剩余兔形 60 秒", "停输入不会立即变回人形"]) expect(current.textContent).toContain(text);
    fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "埃尔莎同一原身体" }).textContent).toContain("RABBIT兔形");
  });

  it("shows actual source, original note and paid failed attempt without claiming a successful form", async () => {
    const ordinary = action({ type: "ORDINARY_CHECK", caseId: "original-body" }, "用已付行动普通核验", "0行动 · 0灵性 · 已付实施不重收");
    const current = attempt({ consent: "GRANTED", stopped: true, abilityTier: "FAILURE", abilitySourceId: "SD3-ELSA", abilityAtSecond: 5, spiritualitySpent: 5, mindSpent: 2, resolutionPaid: true, resolutionActions: 1,
      identityRead: true, noteRead: true, identityCompared: true, elapsedSeconds: 13, playerTravelMetres: 12, evidence: [{ sourceId: "SD3-NOTE", text: "亲读原纸，原身体没有发生变形。", atSecond: 9 }], outcome: "实付5灵性2精神，原身体仍HUMAN。" });
    const value = activate(projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id }), "original-body", current), before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true); const facts = screen.getByRole("region", { name: "沉默门徒原身体原物与真实位置" });
    for (const text of ["SD3-NOTE", "SD3-ELSA", "失败成本保留", "不加能力掌握", "实际经过 13 秒", "实际行走 12 米"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
  });

  it("keeps an ordinary route ordinary with one actual paid action and no invented ability source", () => {
    const ordinary = action({ type: "ORDINARY_CHECK", caseId: "revoked-form" }, "尊重拒绝并普通核验", "1行动 · 0灵性 · 0精神");
    const value = activate(projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id }), "revoked-form", attempt({ method: "ORDINARY", consent: "DECLINED", identityRead: true, noteRead: true, identityCompared: true })), before = structuredClone(value), { onCommand } = panel(value);
    const current = screen.getByRole("region", { name: "沉默门徒当前许可与剩余期限" });
    for (const text of ["当前已拒绝", "尚无实际能力来源", "未实际尝试", "剩余兔形 0 秒", "当前联系 NONE"]) expect(current.textContent).toContain(text);
    fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(value).toEqual(before);
  });

  it.each(["DROP_LINK", "WAIT_LINK"] as const)("forwards %s for the same bounded noninjuring link without harming or healing the volunteer", type => {
    const cleanupLink = action({ type, caseId: "measured-link" }, type === "DROP_LINK" ? "释放本次有限联系" : "实际等待30秒联系期限", "0行动 · 0灵性");
    const value = activate(projection({ promoted: true, actions: [cleanupLink], preferredActionId: cleanupLink.id }), "measured-link", attempt({ consent: "GRANTED", abilityTier: "SUCCESS", abilitySourceId: "SD3-ELSA", linkState: "LINKED", linkRemainingSeconds: 30, spiritualitySpent: 4, mindSpent: 1, resolutionPaid: true, resolutionActions: 1 }));
    value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand } = panel(value); const current = screen.getByRole("region", { name: "沉默门徒当前许可与剩余期限" });
    for (const text of ["LINKED", "剩余 30 秒", "已付灵性 4", "精神 1", "未授权任何自伤、传伤或控制"]) expect(current.textContent).toContain(text);
    fireEvent.click(button(cleanupLink.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(cleanupLink.command); expect(value).toEqual(before);
    expect(screen.queryByRole("button", { name: /COMBAT|伤害志愿者|反伤演示/ })).toBeNull();
  });

  it("does not move the player from B, hand over objects or clear the open scene when only closing the page", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "original-body", attempt({ consent: "GRANTED", abilityTier: "SUCCESS", formRemainingSeconds: 52, itemsStored: true }));
    value.life.volunteer.form = "RABBIT"; value.life.playerLocation = "B"; value.life.clothing.location = "TRAY"; value.life.clothing.worn = false; value.life.bag.location = "TRAY";
    const before = structuredClone(value), { onCommand, onClose } = panel(value); fireEvent.click(button("关闭沉默门徒页面"));
    expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("forwards each committed ordinary leg and keeps the recorded source and actual elapsed time", () => {
    const walk = action({ type: "RETURN_A", caseId: "original-body" }, "本人从B实走4米回A", "0行动 · 实走4米4秒");
    const value = activate(projection({ promoted: true, actions: [walk], preferredActionId: walk.id }), "original-body", attempt({ noteRead: true, elapsedSeconds: 8, playerTravelMetres: 8 })); value.life.playerLocation = "B";
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(walk.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(walk.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "沉默门徒原身体原物与真实位置" }).textContent).toContain("本人实际在B");
  });

  it("locks a real cleanup after save failure and retains the original body and item facts until the same save commits", () => {
    const wait = action({ type: "WAIT_FORM", caseId: "revoked-form" }, "实际等完原兔形", "0行动 · 实等60秒");
    const value = activate(projection({ promoted: true, actions: [wait], preferredActionId: wait.id }), "revoked-form", attempt({ consent: "REVOKED", stopped: true, abilityTier: "SUCCESS", formRemainingSeconds: 60, itemsStored: true })); value.life.volunteer.form = "RABBIT";
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); fireEvent.click(button(wait.label));
    rerender(<SilentDisciplePanel {...defaults} error={{ message: "等待保存失败", retryable: true }} />); expect(screen.getByRole("status").textContent).toContain("不要重复付费、服药、变形、建立联系或归还原物");
    expect(button(wait.label).disabled).toBe(true); expect(button("关闭沉默门徒页面").disabled).toBe(true); expect(picker().disabled).toBe(true); expect(value).toEqual(before);
    rerender(<SilentDisciplePanel {...defaults} value={structuredClone(value)} />); fireEvent.click(button(wait.label)); expect(onCommand).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "沉默门徒当前许可与剩余期限" }).textContent).toContain("剩余兔形 60 秒");
  });

  it("blocks even a projected enabled cleanup when the original player body is dead", () => {
    const wait = action({ type: "WAIT_FORM", caseId: "original-body" }, "等待原兔形期限", "0行动");
    const value = activate(projection({ promoted: true, actions: [wait], preferredActionId: wait.id }), "original-body", attempt({ formRemainingSeconds: 60 })); value.resources!.health = 0;
    const before = structuredClone(value), { onCommand } = panel(value); expect(button(wait.label).disabled).toBe(true); fireEvent.click(button(wait.label));
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before); expect(screen.getByRole("region", { name: "沉默门徒当前目标" }).textContent).toContain("本周目已经死亡");
  });
});

describe("SilentDisciplePanel finite original-G moon notice", () => {
  it("shows both costs before an optional original notice is read and never starts it locally", () => {
    const read = action({ type: "READ_MOON_NOTICE" }, "亲读唯一原观测所告示", "0行动 · 读取后须真实处理"), value = projection({ promoted: true, actions: [read], preferredActionId: read.id });
    const before = structuredClone(value), { onCommand } = panel(value); expect(picker().value).toBe("moon");
    const notice = screen.getByRole("region", { name: "沉默门徒有限月相告示" }), costs = screen.getByRole("region", { name: "沉默门徒月相选择前实际成本" });
    for (const text of ["SD3-OBSERVATORY-NOTICE", "晋升满2整周", "不是每4周自动触发", "独立地方观测所公告", "这只是一次安排", "不叠加狼人、活尸、怨魂或木偶旧发作"]) expect(notice.textContent).toContain(text);
    for (const text of ["1行动", "60便士", "精神−8", "精神−18", "3600秒", "不退", "可以不读取"]) expect(costs.textContent).toContain(text);
    expect(costs.compareDocumentPosition(button(read.label)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button(read.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(read.command); expect(value).toEqual(before);
  });

  it.each(["GUIDED_REST", "ENDURE_REST"] as const)("submits %s exactly without refunding or applying a cost before commit", type => {
    const rest = action({ type }, type === "GUIDED_REST" ? "原导师守望下实际休息" : "独自承受本次原影响", type === "GUIDED_REST" ? "1行动 · 60便士 · 至多8精神" : "1行动 · 至多18精神");
    const value = projection({ promoted: true, actions: [rest], preferredActionId: rest.id }); value.life.moon.status = "ANNOUNCED"; value.life.moon.announcedWeek = 115;
    const before = structuredClone(value), { onCommand } = panel(value); expect(picker().value).toBe("moon"); expect(picker().disabled).toBe(true);
    fireEvent.click(button(rest.label)); fireEvent.click(button(rest.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(rest.command); expect(value).toEqual(before);
    expect(screen.getByRole("region", { name: "沉默门徒有限月相告示" }).textContent).toContain("尚未选择");
  });

  it("keeps the same paid hour pending at zero AP and mind until the explicit WAIT_MOON is saved", () => {
    const wait = action({ type: "WAIT_MOON" }, "实际等待本次原休息结束", "0行动 · 0灵性 · 3600秒");
    const value = projection({ promoted: true, actions: [wait], preferredActionId: wait.id }); Object.assign(value.life.moon, { status: "RESTING", announcedWeek: 115, choice: "GUIDED_REST", startedWeek: 115, initialMind: 8, initialCash: 905, mindSpent: 8, cashSpent: 60, remainingSeconds: 3600 });
    value.resources!.mind = 0; value.resources!.actionsRemaining = 0; value.resources!.spirituality = 0; value.resources!.cash = "845便士";
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); const notice = screen.getByRole("region", { name: "沉默门徒有限月相告示" });
    for (const text of ["已付精神 8", "现金 60 便士", "剩余 3600 秒", "页面停留不自行结算"]) expect(notice.textContent).toContain(text);
    expect(button(wait.label).disabled).toBe(false); fireEvent.click(button(wait.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(wait.command); expect(value).toEqual(before);
    rerender(<SilentDisciplePanel {...defaults} error={{ message: "休息写入失败", retryable: true }} />); expect(button(wait.label).disabled).toBe(true); expect(notice.textContent).toContain("剩余 3600 秒");
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("keeps the single resolved event and its real costs without allowing repeat farming", () => {
    const read = action({ type: "READ_MOON_NOTICE" }, "再次读取原告示", "0行动", { enabled: false, reason: "该唯一原事件已经完成。" });
    const value = projection({ promoted: true, actions: [read], preferredActionId: read.id }); Object.assign(value.life.moon, { status: "RESOLVED", choice: "ENDURE_REST", announcedWeek: 115, startedWeek: 115, initialMind: 90, initialCash: 905, mindSpent: 18, elapsedSeconds: 3600 });
    const before = structuredClone(value), { onCommand } = panel(value); expect(button(read.label).disabled).toBe(true); fireEvent.click(button(read.label));
    const notice = screen.getByRole("region", { name: "沉默门徒有限月相告示" });
    for (const text of ["该唯一事件已实际结束", "已付精神 18", "现金 0 便士", "已实际经过 3600 秒", "剩余 0 秒"]) expect(notice.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

function court(extra: Partial<SilentDiscipleProjection["encounter"]> = {}): SilentDiscipleProjection["encounter"] {
  return { ...encounter(), status: "READY", inside: true,
    scene: { courtId: "SD3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "COURT", distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemy: { id: "SD3-CALDER", name: "卡尔德·里德", age: 47, source: "ORIGINAL_LIMITED_G", sequence: 4, health: 100, mind: 100, spirituality: 120, status: "RESISTING", form: "HUMAN", weaponId: "SD3-CALDER-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 0, WARD: 0, BREAK_CURSE: 0 } },
    ...extra };
}

describe("SilentDisciplePanel original Calder and finite combat facts", () => {
  it("talks to the original adult without automatically fighting or buying objects", () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与卡尔德当面交谈", "1行动"), value = projection({ promoted: true, actions: [talk], preferredActionId: talk.id, encounter: court({ status: "AVAILABLE", inside: false }) });
    const before = structuredClone(value), { onCommand } = panel(value); expect(picker().value).toBe("encounter");
    const facts = screen.getByRole("region", { name: "沉默门徒原人遭遇" });
    for (const text of ["卡尔德·里德", "47岁", "SD3-CALDER", "SD3-CALDER-ROD", "健康 100", "精神 100", "120 / 120", "距离 2 米", "4 米"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(talk.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(talk.command); expect(value).toEqual(before);
  });

  it("buys only the separately sourced new blocks and displays each original spent or ready location", () => {
    const buy = action({ type: "BUY_BLOCKS" }, "购入三块新原木件", "0行动 · 80便士"), value = projection({ promoted: true, actions: [buy], preferredActionId: buy.id, encounter: court({ inside: false, blocksPurchased: false }) });
    const before = structuredClone(value), { onCommand, defaults, rerender } = panel(value); fireEvent.click(button(buy.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(buy.command); expect(value).toEqual(before);
    const saved = structuredClone(value); saved.encounter.blocksPurchased = true; saved.encounter.blocks = [
      { id: "SD3-BLOCK-1", owner: "PLAYER", status: "SPENT", location: "TARGET_GROUND", usedRound: 1 },
      { id: "SD3-BLOCK-2", owner: "PLAYER", status: "READY", location: "SOURCE", usedRound: null },
      { id: "SD3-BLOCK-3", owner: "PLAYER", status: "READY", location: "SOURCE", usedRound: null },
    ]; saved.actions = [{ ...buy, enabled: false, reason: "原三块已经购入，不补发。" }]; rerender(<SilentDisciplePanel {...defaults} value={saved} />);
    const facts = screen.getByRole("region", { name: "沉默门徒战斗当前身体与联系" });
    for (const text of ["SD3-BLOCK-1", "SD3-BLOCK-2", "SD3-BLOCK-3", "SPENT/TARGET_GROUND", "READY/SOURCE", "第1回合已实际使用", "不补旧PU4木块"]) expect(facts.textContent).toContain(text);
    expect(button(buy.label).disabled).toBe(true); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("shows same-body rabbit form and the genuinely dropped rod without healing or equipping it", () => {
    const encounterValue = court({ status: "FIGHTING", link: "LINKED", linkRound: 2, enemyFormUntilSeconds: 120 });
    encounterValue.enemy!.form = "RABBIT"; encounterValue.enemy!.weaponLocation = "COURT"; encounterValue.enemy!.health = 70; encounterValue.enemy!.mind = 92; encounterValue.enemy!.spirituality = 36;
    const value = projection({ promoted: true, actions: [], preferredActionId: null, encounter: encounterValue }), before = structuredClone(value); panel(value);
    const facts = screen.getByRole("region", { name: "沉默门徒原人遭遇" });
    for (const text of ["当前 RABBIT", "健康 70", "精神 92", "36 / 120", "原COURT地面", "仍属于卡尔德", "拾取占一个行动槽", "第120秒", "不续时、不叠加", "仍保留实际挣断"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(value).toEqual(before);
  });

  it("keeps a reverted human's original rod on the ground until a real pickup and retains explicit paid self-curse scope", () => {
    const encounterValue = court(); encounterValue.enemy!.weaponLocation = "COURT"; encounterValue.enemy!.spirituality = 0;
    panel(projection({ promoted: true, actions: [], preferredActionId: null, encounter: encounterValue })); const facts = screen.getByRole("region", { name: "沉默门徒原人遭遇" });
    for (const text of ["当前 HUMAN", "原COURT地面", "0 / 120", "不会自动取回", "新联系4灵性、1精神", "再付5灵性、2精神", "失败照付", "原敌挣断需真实4灵性", "伤己联系策略默认关闭", "不会凭新职业免除自伤"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /免费复原|补满|重新生成|自动拾取/ })).toBeNull();
  });

  it("sends only the projected fight command and leaves the shared battle policy selector to its owner", () => {
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "明确开始原卡尔德冲突", "1行动 · 自身真实伤亡风险"), value = projection({ promoted: true, actions: [fight], preferredActionId: fight.id, encounter: court() });
    const before = structuredClone(value), { onCommand } = panel(value); expect(picker().disabled).toBe(true); expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(button(fight.label)); fireEvent.click(button(fight.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(fight.command); expect(onCommand.mock.calls[0]![0]).toBe(fight.command); expect(value).toEqual(before);
  });

  it("takes the same original four-metre peaceful exit without resetting the original opponent", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "沿原4米普通出口和平离开", "0行动 · 实走4米4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id, encounter: court() });
    const before = structuredClone(value), { onCommand } = panel(value); fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
    expect(value.encounter.enemy!.weaponLocation).toBe("HAND"); expect(value.encounter.enemy!.spirituality).toBe(120);
  });

  it("keeps the actual terminal surviving body and resource totals alongside the player's death", () => {
    const encounterValue = court({ status: "LOST", inside: false }); encounterValue.enemy!.health = 60; encounterValue.enemy!.spirituality = 13; encounterValue.enemy!.weaponLocation = "COURT";
    const value = projection({ promoted: true, actions: [], preferredActionId: null, encounter: encounterValue }); value.resources!.health = 0;
    const before = structuredClone(value), { onCommand, onClose } = panel(value); fireEvent.change(picker(), { target: { value: "encounter" } });
    const facts = screen.getByRole("region", { name: "沉默门徒原人遭遇" });
    for (const text of ["健康 60", "13 / 120", "当前 HUMAN", "原COURT地面", "没有免费回复", "复活", "旧埃德林"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "沉默门徒当前目标" }).textContent).toContain("已经死亡");
    fireEvent.click(button("关闭沉默门徒页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});


describe("SilentDisciplePanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["原著支持序列3名称与变形诅咒方向，完整配方、晋升仪式和序列3具体月圆规则仍未知。本场人物、兔形、期限、抵抗、距离与费用均为原创G；职业名称不自动赋予沉默能力。", "序列3沉默门徒当前只开放有限变形诅咒，完整配方尚未掌握，服药前须完成专业准备。本场人物、兔形、期限、抵抗、距离与费用以当前说明为准，月相安排以当前独立告示为准；职业名称不自动赋予沉默能力。"],
      ["专业准备是原创G：核对旧记录、安静房间与实际来源、退出与撤回路线，不充当原著仪式。不把特定木乃伊要求当作本职业通用仪式。三瓶耗尽后须实际申请并等下一真实周补货；不开放未知配方自制。", "服药前须完成专业准备：核对旧记录、安静房间与实际来源、退出与撤回路线。不把特定木乃伊要求当作本职业通用仪式。三瓶耗尽后须实际申请并等下一真实周补货；不开放未知配方自制。"],
      ["。导师只按本场G约定协助，不是原著瞬间解咒能力。", "。导师只按本场约定协助，不能瞬间解除诅咒。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(container.textContent).toContain(`原记录纸 ${value.life.note.id} 实际在${value.life.note.location}`);
    expect(container.textContent).toContain(`原导师${value.life.guide.name}（${value.life.guide.id}）实际在${value.life.guide.location}`);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
  it("keeps the one-off notice, real waiting costs and optional read unchanged", () => {
    const read = action({ type: "READ_MOON_NOTICE" }, "亲读唯一原观测所告示", "0行动 · 读取后须真实处理");
    const value = projection({ promoted: true, actions: [read], preferredActionId: read.id }), before = structuredClone(value), { onCommand } = panel(value);
    const notice = screen.getByRole("region", { name: "沉默门徒有限月相告示" });
    expect(within(notice).getByText("晋升满2整周后可选择读取这张独立地方观测所公告；不是每4周自动触发。这只是一次安排，不叠加狼人、活尸、怨魂或木偶旧发作。")).toBeTruthy();
    expect(notice.textContent).not.toContain("晋升满2整周后可选择读取这张独立地方观测所公告；不是每4周自动触发。序列3具体原著月圆诅咒未知，这只是一次原创G安排，不叠加狼人、活尸、怨魂或木偶旧发作。");
    const costs = screen.getByRole("region", { name: "沉默门徒月相选择前实际成本" });
    for (const text of ["1行动", "60便士", "精神−8", "精神−18", "3600秒", "可以不读取", "不退已付精神或现金"]) expect(costs.textContent).toContain(text);
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
