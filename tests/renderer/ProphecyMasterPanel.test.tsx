/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProphecyMasterPanel, type ProphecyMasterPanelProps } from "../../src/renderer/ProphecyMasterPanel";
import type { ProphecyMasterAction, ProphecyMasterCommand, ProphecyMasterProjection } from "../../src/domain/prophecy-master/types";
import { PROPHECY_MASTER_ABILITIES, PROPHECY_MASTER_CONSUMPTION_RISK } from "../../src/domain/prophecy-master/content";
import { createProphecyMasterLifeState, validateProphecyMasterActivityCommand } from "../../src/domain/prophecy-master/life";
import { validateProphecyMasterAcquisitionCommand } from "../../src/domain/prophecy-master/index";
import { validateProphecyMasterEncounterCommand } from "../../src/domain/prophecy-master/encounter";

type Attempt = NonNullable<ProphecyMasterProjection["life"]["currentAttempt"]>;
type CaseId = ProphecyMasterProjection["life"]["cases"][number]["id"];
const action = (command: ProphecyMasterCommand, label: string, cost = "0行动", extra: Partial<Omit<ProphecyMasterAction, "command">> = {}): ProphecyMasterAction => {
  expect(validateProphecyMasterAcquisitionCommand(command) || validateProphecyMasterActivityCommand(command) || validateProphecyMasterEncounterCommand(command)).toBe(true);
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
};
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取预言大师专业指导", "1行动 · 500便士");
const consume = (id = "prophecy-master-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一独立原瓶");

// Structurally typed, isolated public fixtures test rendering and the exact public command API.
// They do not claim a valid campaign save, a natural promotion, or a successful random replay.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 114, date: { epoch: "FIFTH_EPOCH", year: 1352, month: 3, day: 12 }, method: "ABILITY", closed: false, result: "NONE", initialSpirituality: 48, initialMind: 90,
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, mindSpent: 0,
    ownerConsent: "UNASKED", keeperConsent: "UNASKED", receiverConsent: "UNASKED", withdrawn: false, stopped: false, inspected: false, recordTaken: false, recordReturned: false,
    glimpseTier: null, glimpseText: null, glimpseAtSecond: null, hypothesis: null, hypothesisAtSecond: null,
    scheduleRead: false, bellWitnessed: false, doorChecked: false, delivered: false, deliveryRead: false, warningRead: false, shutterClosed: false, ordinaryChecked: false,
    evidence: [], compared: false, correction: null, comparedAtSecond: null, ...extra };
}
function life(): ProphecyMasterProjection["life"] {
  const state = createProphecyMasterLifeState();
  return { ...state, title: "三项有限预兆实践G", story: "原不确定画面、解释与实证分开保存。", environment: "原仓库与普通路径。", nextStep: "先取得本案原主同意。",
    inside: false, insideCase: false, currentAttempt: null, actions: [], facts: ["本人在START；尚无实际行走。", "原记录页由原主保管，须本人实际借还。"],
    door: { ...state.door, locked: null }, curtain: { ...state.curtain, state: null },
    cases: ([
      { id: "bell-schedule", title: "原仓库的相似铃声", story: "两种可能解释都须实际查看原铃架与原排班册，再记录亲见事实。" },
      { id: "covered-door", title: "原封包与遮暗的门", story: "本人实际携同一800克封包，核验原门与普通侧道；预兆不代替送件。" },
      { id: "bounded-source", title: "原仪器的有限异常", story: "仅限明确G低强度封存残响教学；可停止并按已有说明核验外壳。" },
    ] as const).map(entry => ({ ...state.cases[entry.id], ...entry, observations: [], result: null })),
  };
}
function encounter(): ProphecyMasterProjection["encounter"] {
  return { title: "奥斯里克的原场冲突G", story: "原奥斯里克、原棍与独立灵性；预兆与假动作本身不致伤。", status: "AVAILABLE", inside: false, scene: null, enemy: null, actions: [],
    facts: ["4米净空原场与普通出口，无追逐，没有第三人在场。"] };
}
function projection(extra: Partial<ProphecyMasterProjection> = {}): ProphecyMasterProjection {
  return { title: "预言大师与有限预兆", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "有限预兆与实际物证G。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；批次耗尽须申请下一真实周补货。", actions: [guidance()], nextStep: "听取指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `prophecy-master-potion-${n}`, title: `预言大师第${n}独立原瓶`, source: `PM3-SEAL-${n}独立原封签`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `prophecy-master-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_RECORDS", title: "核对原观察与研究", completedWeek: 110 }, { taskId: "CHECK_LIMITS", title: "核验预兆范围", completedWeek: 111 }, { taskId: "MARK_EXIT", title: "标明实际退出顺序", completedWeek: 112 }],
    preparedWeek: null, abilities: PROPHECY_MASTER_ABILITIES.map(entry => ({ ...entry, mastery: 0 })), acting: 0, digestion: "原神秘学家消化100，晋升后已满12整周。", pollution: 3,
    risk: PROPHECY_MASTER_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    inheritedTools: "原眼镜、旧原卷SP6-IMPACT-1与原神话血归还记录保留；旧库存不补回。",
    inheritedHistory: ["窥秘人、格斗学者、巫师、卷轴教授、星象师与神秘学家六阶段原记录保持。", "原卢坎仍投降；原故事105名知情者和迟钟回声15%效力不回收。", "旧掌握0保留，不新增故事库。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "本人START至A实走6米，A至B原侧道12米；原物须本人实际带回。", ...extra };
}
function activate(value: ProphecyMasterProjection, id: CaseId, current: Attempt) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = id; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === id)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function panel(value = projection(), props: Partial<Omit<ProphecyMasterPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<ProphecyMasterPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const picker = () => screen.getByRole("combobox", { name: "选择预言大师事项" }) as HTMLSelectElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("ProphecyMasterPanel isolated public projections and exact saved commands", () => {
  it("leads with one current objective, visible resources and the public disabled reason", () => {
    const reason = "原神秘学家只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "预言大师与有限预兆" })); expect(screen.getByRole("region", { name: "预言大师" })).toBeTruthy(); expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "预言大师当前目标" }).textContent).toContain(reason);
    const resources = screen.getByRole("region", { name: "预言大师当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取预言大师专业指导").disabled).toBe(true); expect(button("听取预言大师专业指导").getAttribute("aria-describedby")).toContain("prophecy-master-reason-");
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原故事、原卷与旧隐者路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假材料")).toBeNull(); fireEvent.click(button("听取预言大师专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows the projected preparation objective ahead of optional bottle labour", () => {
    const task = action({ type: "PREPARE_TASK", taskId: "MARK_EXIT" }, "写下本人实际停止与返回顺序", "1行动"), work = action({ type: "POTION_WORK", bottleId: "prophecy-master-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, task], preferredActionId: task.id })); expect(picker().value).toBe("preparation");
    const next = screen.getByRole("group", { name: "预言大师下一步" }); expect(within(next).getAllByRole("button")).toHaveLength(1); expect(next.textContent).toContain(task.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it("selects a different original bottle locally and submits only its exact labour command once", async () => {
    const first = action({ type: "POTION_WORK", bottleId: "prophecy-master-potion-1" }, "第一原瓶实际劳务", "1行动"), second = action({ type: "POTION_WORK", bottleId: "prophecy-master-potion-2" }, "第二原瓶实际劳务", "1行动");
    const value = projection({ actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:prophecy-master-potion-2"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^第一原瓶/ })).toBeNull();
    fireEvent.click(button(second.label)); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(onCommand.mock.calls[0]![0]).toBe(second.command); expect(value).toEqual(before);
  });

  it("reviews the selected original, 140-cost preparation, unknown ritual and four risks before consumption", async () => {
    const first = consume(), second = consume("prophecy-master-potion-2"), value = projection({ actions: [first, second], preferredActionId: first.id, preparedWeek: 113 });
    const { onCommand, onClose } = panel(value);
    await userEvent.selectOptions(picker(), "bottle:prophecy-master-potion-2"); await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "预言大师原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "预言大师第2独立原瓶" }));
    for (const text of ["prophecy-master-potion-2", "PM3-SEAL-2", "73%", "第113周", "140便士不退", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "当前灵性不补满", "完整配方", "独立成品渠道", "另一滴", "不开放自制配方"]) expect(review.textContent).toContain(text);
    expect(within(review).getByText(/^预言大师为隐者途径序列3，完整配方尚未掌握，服用前需要专业准备。/).textContent).not.toMatch(/原核|原著|原创G|尚未核实/);
    expect(review.textContent).not.toContain("PM3-SEAL-1"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "预言大师原瓶服用确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the original confirmed intent locked through save failure without recharging or retrying locally", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(onCommand.mock.calls[0]![0]).toBe(entry.command); expect(value).toEqual(before);
    rerender(<ProphecyMasterPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "预言大师原瓶服用确认" })).toBeTruthy();
    rerender(<ProphecyMasterPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<ProphecyMasterPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "预言大师原瓶服用确认" })).toBeNull();
    expect(button("关闭预言大师页面").disabled).toBe(false); expect(picker().value).toBe("case:bell-schedule"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "上次保存失败" }] as const)("locks new commands, selection and local close: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取预言大师专业指导")); fireEvent.click(button("关闭预言大师页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取预言大师专业指导").disabled).toBe(true); expect(picker().disabled).toBe(true);
  });

  it("invalidates an unsubmitted bottle review when the saved resources or eligibility change", async () => {
    const entry = consume(), value = projection({ actions: [entry], preferredActionId: entry.id, preparedWeek: 113 }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<ProphecyMasterPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "预言大师原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("switches unstarted cases locally without showing three equal action walls", async () => {
    const first = action({ type: "OBSERVE", caseId: "bell-schedule" }, "观察原铃架"), second = action({ type: "OBSERVE", caseId: "bounded-source" }, "观察原仪器边界");
    const value = projection({ promoted: true, actions: [first, second], preferredActionId: first.id }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(picker(), "case:bounded-source"); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察原铃架/ })).toBeNull();
    expect(screen.getByRole("region", { name: "当前预言大师生活情境" }).textContent).toContain("低强度封存残响"); fireEvent.click(button(second.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command); expect(value).toEqual(before);
  });

  it("submits ordinary preparation without automatically requesting or resolving a glimpse", () => {
    const ordinary = action({ type: "PREPARE", caseId: "bell-schedule", method: "ORDINARY" }, "准备普通核查", "1行动"), value = projection({ promoted: true, actions: [ordinary], preferredActionId: ordinary.id });
    value.life.cases[0]!.status = "OBSERVED"; const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "当前预言大师生活情境" }).textContent).toContain("实施只进入原现场"); fireEvent.click(button(ordinary.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
    expect(screen.queryByRole("button", { name: /GLIMPSE/ })).toBeNull();
  });

  it("keeps finished medicine, professional preparation and the one new finite ability distinct", async () => {
    panel(projection({ promoted: true, actions: [], preferredActionId: null })); await open("独立成品与晋升准备"); const formula = screen.getByRole("region", { name: "预言大师成品与配方边界" });
    for (const text of ["完整配方", "独立成品渠道", "专业支持", "完整仪式均保持未知", "PM3-ELIRA", "53岁", "6400", "900便士", "140便士", "12整周", "命运之蛇血", "不开放自制配方"]) expect(formula.textContent).toContain(text);
    await open("能力范围与实际掌握"); const scope = screen.getByRole("region", { name: "预言大师能力与使用范围" });
    for (const text of ["掌握 0", "知识18", "6灵性", "2精神", "失败", "假动作", "成本不退", "序列2", "不阻止全部灾难", "不先行造成伤害"]) expect(scope.textContent).toContain(text);
    const formulaCopy = within(formula).getByText(/^预言大师为隐者途径序列3，完整配方尚未掌握，服用前需要专业准备。/);
    const sourceCopy = within(scope).getByText(/^预言大师为序列3。预言呈现模糊命运画面/);
    expect(formulaCopy.textContent).not.toMatch(/原核|原著|原创G|尚未核实/);
    expect(sourceCopy.textContent).not.toMatch(/原核|L177931|L203615|原创G|hermit\.s3/);
    for (const text of ["三项准备及当周场地检查", "不开放自制配方", "本次不再要求另一滴", "不当作预言大师通用仪式或赠送命运能力的凭据"]) expect(formulaCopy.textContent).toContain(text);
    for (const text of ["105名实际知情者", "15%效力", "公开信息不能回收", "6米和12米", "6灵性、2精神", "知识18", "下一次实际攻击贡献乘0.7", "预兆本身不造成伤害", "不改已发生的历史", "不使推测说出即成真"]) expect(sourceCopy.textContent).toContain(text);
    expect(PROPHECY_MASTER_ABILITIES).toHaveLength(1); expect(PROPHECY_MASTER_ABILITIES[0]!.id).toBe("hermit.s3.prophetic-glimpse");
  });

  it("preserves original tools, surrendered Lucan and published history read-only", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value); panel(value); await open("原故事、原卷与旧隐者路线记录"); const history = screen.getByRole("region", { name: "预言大师继承记录" });
    for (const text of ["SP6-IMPACT-1", "原神话血归还", "原卢坎仍投降", "105名知情者", "15%效力", "旧掌握0", "不凭空补库存", "不新增故事库"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before); expect(history.textContent).not.toContain("年轻外观");
  });
});

describe("ProphecyMasterPanel keeps uncertain records apart from actual observations", () => {
  it("pins the original active case and shows the one next action before physical facts and consents", () => {
    const entry = action({ type: "CONSENT_OWNER", caseId: "covered-door" }, "当面询问艾瑞丝本案许可"), value = activate(projection({ promoted: true, actions: [entry], preferredActionId: entry.id }), "covered-door", attempt());
    value.life.facts = ["PM3-WAREHOUSE本人在START，原页PM3-DOOR-RECORD和PM3-PARCEL都在原主手中。", "艾瑞丝·沃德49岁在START；内尔·肖44岁在A；托马斯·里德37岁在B。三位成年人分别回答，可以撤回。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    expect(picker().value).toBe("case:covered-door"); expect(picker().disabled).toBe(true); expect(screen.getByRole("region", { name: "预言大师当前行动" }).compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const text of ["PM3-WAREHOUSE", "PM3-DOOR-RECORD", "PM3-PARCEL", "49岁", "44岁", "37岁", "原主许可：尚未询问", "原保管人许可：尚未询问", "原接收人许可：尚未询问", "可以撤回"]) expect(facts.textContent).toContain(text);
    fireEvent.click(button(entry.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(value).toEqual(before);
  });

  it("never fills an absent glimpse, hypothesis or future event with an invented answer", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "bell-schedule", attempt()), before = structuredClone(value); panel(value);
    const facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    expect(within(facts).getByRole("region", { name: "原不确定预兆" }).textContent).toContain("尚无预兆画面");
    expect(within(facts).getByRole("region", { name: "玩家当时的解释" }).textContent).toContain("尚未选择解释");
    expect(within(facts).getByRole("region", { name: "已经取得的实际物证" }).textContent).toContain("目前没有可确认的答案");
    for (const text of ["两声回响，原架暂空", "实际发生的是HANDOVER", "本次结果为清点交接", "原门已锁", "原帘用于遮光保管"]) expect(document.body.textContent).not.toContain(text);
    expect(value.life.bell.witnessedEvent).toBeNull(); expect(value.life.door.locked).toBeNull(); expect(value.life.curtain.state).toBeNull(); expect(value).toEqual(before);
  });

  it("shows a paid uncertain picture and the chosen ALARM hypothesis without revealing the later bell result", () => {
    const current = attempt({ ownerConsent: "GRANTED", recordTaken: true, glimpseTier: "SUCCESS", glimpseText: "两声回响，原架暂空。含义不明。", glimpseAtSecond: 5, hypothesis: "ALARM", hypothesisAtSecond: 6, spiritualitySpent: 6, mindSpent: 2, elapsedSeconds: 6 });
    const next = action({ type: "GO_A", caseId: "bell-schedule" }, "本人实走6米前往A", "0行动 · 6米6秒"), value = activate(projection({ promoted: true, actions: [next], preferredActionId: next.id }), "bell-schedule", current);
    value.life.records["bell-schedule"].location = "PLAYER"; value.life.clockSeconds = 6;
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    const forecast = within(facts).getByRole("region", { name: "原不确定预兆" }), hypothesis = within(facts).getByRole("region", { name: "玩家当时的解释" }), evidence = within(facts).getByRole("region", { name: "已经取得的实际物证" });
    expect(forecast.textContent).toContain(current.glimpseText); expect(forecast.textContent).toContain("第5秒"); expect(forecast.textContent).toContain("不能据此断言未来事实");
    expect(hypothesis.textContent).toContain("警报假说（尚待实证）"); expect(hypothesis.textContent).toContain("第6秒"); expect(evidence.textContent).toContain("尚未取得实际物证");
    expect(facts.textContent).not.toContain("本次交接已确认"); expect(facts.textContent).not.toContain("实际发生的是HANDOVER"); expect(forecast.textContent).not.toContain("修正");
    fireEvent.click(button(next.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(next.command); expect(value).toEqual(before);
  });

  it("adds only subsequently projected evidence and correction while retaining the original wrong hypothesis", () => {
    const current = attempt({ ownerConsent: "GRANTED", keeperConsent: "GRANTED", recordTaken: true, glimpseTier: "SUCCESS", glimpseText: "两声回响，原架暂空。含义不明。", glimpseAtSecond: 5, hypothesis: "ALARM", hypothesisAtSecond: 6, spiritualitySpent: 6, mindSpent: 2,
      elapsedSeconds: 28, playerTravelMetres: 6, playerMoves: [{ from: "START", to: "A", mode: "WALK", metres: 6, seconds: 6, itemIds: ["PM3-BELL-RECORD"] }], scheduleRead: true, bellWitnessed: true,
      evidence: [{ sourceId: "PM3-SCHEDULE", text: "原册中警报与交接两种铃声相似。", atSecond: 14 }, { sourceId: "PM3-BELL", text: "本人真实等12秒，亲见同一原铃被取下敲两声放回；实际发生的是HANDOVER。", atSecond: 26 }],
      compared: true, correction: "保留当时ALARM假说，原警报解释后来被真实交接证据否定。", comparedAtSecond: 28 });
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "bell-schedule", current); value.life.playerLocation = "A"; value.life.playerTravelMetres = 6; value.life.clockSeconds = 28;
    value.life.bell.witnessedEvent = "HANDOVER"; value.life.bell.rings = 2; value.life.records["bell-schedule"].location = "PLAYER"; value.life.records["bell-schedule"].travelMetres = 6;
    const before = structuredClone(value); panel(value); const facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    const forecast = within(facts).getByRole("region", { name: "原不确定预兆" }), hypothesis = within(facts).getByRole("region", { name: "玩家当时的解释" }), evidence = within(facts).getByRole("region", { name: "已经取得的实际物证" });
    expect(forecast.textContent).toContain(current.glimpseText); expect(forecast.textContent).not.toContain("HANDOVER"); expect(hypothesis.textContent).toContain("警报假说"); expect(hypothesis.textContent).not.toContain("交接假说");
    const rows = within(evidence).getAllByRole("listitem"); expect(rows[0]!.textContent).toContain("第14秒 · 原件PM3-SCHEDULE"); expect(rows[1]!.textContent).toContain("第26秒 · 原件PM3-BELL");
    expect(evidence.textContent).toContain(current.correction); expect(evidence.textContent).toContain("实际比对时间：第28秒"); expect(value).toEqual(before);
  });

  it("submits the exact chosen hypothesis rather than replacing it with a supposed correct one", async () => {
    const alarm = action({ type: "STATE_HYPOTHESIS", caseId: "bell-schedule", hypothesis: "ALARM" }, "保存警报假说"), handover = action({ type: "STATE_HYPOTHESIS", caseId: "bell-schedule", hypothesis: "HANDOVER" }, "保存交接假说");
    const current = attempt({ ownerConsent: "GRANTED", recordTaken: true }), value = activate(projection({ promoted: true, actions: [alarm, handover], preferredActionId: alarm.id }), "bell-schedule", current);
    const before = structuredClone(value), { onCommand } = panel(value); await open("其它可选方法"); fireEvent.click(button(handover.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(handover.command);
    expect(current.hypothesis).toBeNull(); expect(value).toEqual(before);
  });

  it("submits GLIMPSE once and shows only the subsequently saved paid failure", () => {
    const entry = action({ type: "GLIMPSE", caseId: "covered-door" }, "独立尝试一次模糊预兆", "6灵性 · 2精神 · 知识18"), value = activate(projection({ promoted: true, actions: [entry], preferredActionId: entry.id }), "covered-door", attempt({ ownerConsent: "GRANTED", recordTaken: true }));
    const before = structuredClone(value), { defaults, rerender, onCommand } = panel(value); fireEvent.click(button(entry.label)); fireEvent.click(button(entry.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(entry.command); expect(value).toEqual(before);
    const saved = structuredClone(value), current = saved.life.currentAttempt!; current.glimpseTier = "FAILURE"; current.glimpseText = "未得到可靠画面；不形成来源或事件结论。"; current.glimpseAtSecond = 5; current.spiritualitySpent = 6; current.mindSpent = 2; current.elapsedSeconds = 5;
    saved.life.cases[1]!.attempts = [current]; saved.resources!.spirituality = 42; saved.resources!.mind = 88; saved.actions = []; saved.preferredActionId = null;
    rerender(<ProphecyMasterPanel {...defaults} value={saved} />); const facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" }); expect(fold("本次实际尝试与已付代价").open).toBe(true);
    for (const text of ["本次预兆判定：失败", "未得到可靠结论", "已付灵性 6、精神 2", "不能重骰", "普通核查和报告不算能力成功"]) expect(facts.textContent).toContain(text);
    expect(facts.textContent).not.toContain("原门已锁"); expect(facts.textContent).not.toContain("成功预兆后实际核实并完成"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it("keeps the same parcel, actual side route, receipt and two-part ordinary return in the movement record", () => {
    const back = action({ type: "RETURN_A", caseId: "covered-door" }, "本人持原页原回执走12米回A", "0行动 · 12米12秒"), close = action({ type: "CLOSE", caseId: "covered-door" }, "结束本次原送件案", "0行动", { enabled: false, reason: "本人仍在B，须普通12米回A再6米回START并归还原件。" });
    const current = attempt({ ownerConsent: "GRANTED", receiverConsent: "GRANTED", recordTaken: true, hypothesis: "ALARM", hypothesisAtSecond: 4, elapsedSeconds: 31, playerTravelMetres: 18, doorChecked: true, delivered: true, deliveryRead: true, compared: true, comparedAtSecond: 31,
      playerMoves: [{ from: "START", to: "A", mode: "WALK", metres: 6, seconds: 6, itemIds: ["PM3-DOOR-RECORD", "PM3-PARCEL"] }, { from: "A", to: "B", mode: "WALK", metres: 12, seconds: 12, itemIds: ["PM3-DOOR-RECORD", "PM3-PARCEL"] }],
      evidence: [{ sourceId: "PM3-PARCEL", text: "本人实际交付同一800克封包给PM3-TOMAS，原回执交回本人手中。", atSecond: 27 }], correction: "核实是普通交接，原帘没有变成能力通道。" });
    const value = activate(projection({ promoted: true, actions: [back, close], preferredActionId: back.id }), "covered-door", current); value.life.playerLocation = "B"; value.life.parcel.location = "RECEIVER"; value.life.parcel.travelMetres = 18; value.life.receipt.location = "PLAYER"; value.life.receipt.signed = true;
    value.life.facts = ["本人仍在B；同一PM3-PARCEL已由托马斯接收，PM3-RECEIPT与PM3-DOOR-RECORD由本人实持。", "原门已实查且保持关闭；普通侧道没有变成瞬移通道。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    for (const text of ["本人仍在B", "同一PM3-PARCEL", "PM3-RECEIPT", "A → B：本人实际行走 12 米、12 秒", "携行原物 PM3-DOOR-RECORD、PM3-PARCEL", "800克", "返程仍须按原路逐段走回"]) expect(facts.textContent).toContain(text);
    expect(button(close.label).disabled).toBe(true); expect(button(close.label).closest("details")).toBeNull(); fireEvent.click(button(close.label)); expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button(back.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(back.command); expect(value).toEqual(before);
  });

  it("keeps zero-resource stopping available and does not turn a stopped inquiry into purification", () => {
    const stop = action({ type: "STOP_INQUIRY", caseId: "bounded-source" }, "停止探查，不继续高位来源"), withdraw = action({ type: "WITHDRAW", caseId: "bounded-source" }, "撤回本案许可并按原路返还"), current = attempt({ initialSpirituality: 6, initialMind: 2, ownerConsent: "GRANTED", recordTaken: true,
      glimpseTier: "GREAT_FAILURE", glimpseText: "未得到可靠画面；不形成来源或事件结论。", glimpseAtSecond: 5, spiritualitySpent: 6, mindSpent: 2, elapsedSeconds: 5 });
    const value = activate(projection({ promoted: true, actions: [stop, withdraw], preferredActionId: stop.id }), "bounded-source", current); value.resources!.spirituality = 0; value.resources!.mind = 0; value.resources!.actionsRemaining = 0;
    value.life.facts = ["PM3-SEALED-ECHO原件仍在A，核心封存；原低强度残响仍为1，没有净化结果。", "本人仍在START并实持PM3-BOUNDARY-RECORD；停止与归还允许0行动。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    expect(button(stop.label).disabled).toBe(false); expect(button(withdraw.label).disabled).toBe(false); expect(facts.textContent).toContain("原低强度残响仍为1"); expect(facts.textContent).toContain("没有净化结果"); expect(facts.textContent).toContain("已付灵性 6、精神 2");
    fireEvent.click(button(stop.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(value).toEqual(before);
  });

  it("shows an ordinary bounded-source completion with the unknown source and paid failed glimpse intact", () => {
    const current = attempt({ ownerConsent: "CLOSED", recordTaken: true, recordReturned: true, stopped: true, inspected: true, closed: true, result: "ORDINARY", glimpseTier: "FAILURE", glimpseText: "未得到可靠画面。", glimpseAtSecond: 5,
      spiritualitySpent: 6, mindSpent: 2, elapsedSeconds: 31, playerTravelMetres: 12, warningRead: true, shutterClosed: true, ordinaryChecked: true, compared: true, comparedAtSecond: 22,
      evidence: [{ sourceId: "PM3-SEALED-ECHO", text: "关闭原遮盖并停查后普通核外壳；残响仍为1，来源未进一步查明。", atSecond: 20 }], correction: "只确认许可范围内封存状态，未驱散原残响。" });
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); value.life.cases[0]!.status = "RESOLVED"; value.life.cases[1]!.status = "RESOLVED"; value.life.cases[2]!.status = "EXAMINED"; value.life.cases[2]!.attempts = [current];
    const before = structuredClone(value); panel(value); const facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    for (const text of ["普通方法完成", "原物已实际归还", "探查已实际停止", "未驱散原残响", "来源未进一步查明", "未得到可靠画面", "已付灵性 6、精神 2"]) expect(facts.textContent).toContain(text);
    expect(facts.textContent).not.toContain("成功预兆后实际核实并完成"); expect(value.abilities[0]!.mastery).toBe(0); expect(value).toEqual(before);
  });

  it("closes only the local view without moving the original body, stopping inquiry or returning items", () => {
    const value = activate(projection({ promoted: true, actions: [], preferredActionId: null }), "covered-door", attempt({ ownerConsent: "GRANTED", recordTaken: true })); value.life.playerLocation = "B"; value.life.parcel.location = "PLAYER"; value.life.records["covered-door"].location = "PLAYER";
    const before = structuredClone(value), { onCommand, onClose } = panel(value); fireEvent.click(button("关闭预言大师页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe("ProphecyMasterPanel original optional encounter", () => {
  it("shows independent enemy resources, original weapon and a real four-metre peaceful exit", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "本人普通4米离开原场", "0行动 · 4米4秒"), value = projection({ promoted: true, actions: [leave], preferredActionId: leave.id });
    value.encounter.inside = true; value.encounter.status = "READY";
    value.encounter.scene = { courtId: "PM3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "COURT", distanceMetres: 4, exitMetres: 4, ordinaryWalkedMetres: 0 };
    value.encounter.enemy = { id: "PM3-OSRIC", name: "奥斯里克·盖尔", age: 48, source: "ORIGINAL_LIMITED_G", sequence: 3, health: 100, mind: 100, spirituality: 120, status: "RESISTING", weaponId: "PM3-OSRIC-ROD", weaponLocation: "HAND", powerUses: { ARC_BOLT: 0, WARD: 0, FEINT: 0 } };
    value.encounter.facts = ["预兆尚未发生，不能知道下一真实动作；先行假动作可消耗实际窗口，成本不退。", "原卢坎仍投降，原故事105名知情者与15%效力保留。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "预言大师原人遭遇" });
    expect(picker().value).toBe("encounter"); expect(picker().disabled).toBe(true);
    const route = within(facts).getByRole("region", { name: "预言大师原战场与真实退路" }); for (const text of ["PM3-COURT", "本人实际在原场内", "原出口实际开放", "须本人走 4 米", "场内第三人 0", "累计普通离场 0 米"]) expect(route.textContent).toContain(text);
    for (const text of ["奥斯里克·盖尔", "48岁", "PM3-OSRIC", "健康 100", "精神 100", "120 / 120", "PM3-OSRIC-ROD", "原敌本人持有", "预兆尚未发生", "成本不退", "预兆和假动作本身不致伤"]) expect(facts.textContent).toContain(text);
    expect(facts.textContent).not.toContain("原镜"); fireEvent.click(button(leave.label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
  });

  it("keeps a surrendered original opponent's paid powers and actual weapon location instead of replenishing him", async () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); value.encounter.status = "RESOLVED";
    value.encounter.scene = { courtId: "PM3-COURT", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: true, playerPosition: "EXIT", distanceMetres: 4, exitMetres: 4, ordinaryWalkedMetres: 4 };
    value.encounter.enemy = { id: "PM3-OSRIC", name: "奥斯里克·盖尔", age: 48, source: "ORIGINAL_LIMITED_G", sequence: 3, health: 70, mind: 100, spirituality: 87, status: "SURRENDERED", weaponId: "PM3-OSRIC-ROD", weaponLocation: "COURT", powerUses: { ARC_BOLT: 3, WARD: 3, FEINT: 2 } };
    value.encounter.facts = ["原奥斯里克重伤与投降记录保留；窗口已在真实回合结束清除。", "同一原卷SP6-IMPACT-1已实际用过，旧库存减少这一卷；没有补发。"];
    const before = structuredClone(value), { onCommand } = panel(value); await userEvent.selectOptions(picker(), "encounter"); const facts = screen.getByRole("region", { name: "预言大师原人遭遇" });
    for (const text of ["健康 70", "87 / 120", "已投降", "原武器 PM3-OSRIC-ROD · 留在原场", "实际弧光 3 次、屏护 3 次、付费假动作 2 次", "本人实际在出口", "累计普通离场 4 米", "没有补发"]) expect(facts.textContent).toContain(text);
    expect(within(facts).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe("ProphecyMasterPanel distinguishes stopping inquiry from abandoning the case", () => {
  it("retains a reported successful bounded glimpse after voluntary stopping without inventing a source", () => {
    const current = attempt({ ownerConsent: "CLOSED", recordTaken: true, recordReturned: true, stopped: true, withdrawn: false, inspected: true, closed: true, result: "ABILITY", glimpseTier: "SUCCESS",
      glimpseText: "过亮的边缘，未辨来源。", glimpseAtSecond: 5, spiritualitySpent: 6, mindSpent: 2, elapsedSeconds: 31, playerTravelMetres: 12, warningRead: true, shutterClosed: true, ordinaryChecked: true, compared: true, comparedAtSecond: 22,
      evidence: [{ sourceId: "PM3-SEALED-ECHO", text: "停用能力后本人普通核实外壳仍封存；残响仍1，来源未查明。", atSecond: 20 }], correction: "只核验原封存外壳，未打开核心或驱散残响。" });
    const value = projection({ promoted: true, actions: [], preferredActionId: null }); value.life.cases[0]!.status = "RESOLVED"; value.life.cases[1]!.status = "RESOLVED"; value.life.cases[2]!.status = "EXAMINED"; value.life.cases[2]!.attempts = [current];
    const before = structuredClone(value); panel(value); const facts = screen.getByRole("region", { name: "预言大师原人原物与真实位置" });
    for (const text of ["成功预兆后实际核实并完成", "探查已实际停止", "许可尚无撤回记录", "来源未查明", "未打开核心或驱散残响"]) expect(facts.textContent).toContain(text);
    expect(facts.textContent).not.toContain("普通方法完成"); expect(value).toEqual(before);
  });
});


describe("ProphecyMasterPanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["模糊命运画面需要解释，受位格限制且可能判断错误。完整配方与原著晋升仪式未知；本场人物、有限情境、范围、成本与数值均为原创G。", "模糊命运画面需要解释，受位格限制且可能判断错误。当前渠道不提供完整配方，晋升仍须完成专业准备；本场人物、有限情境、范围、成本与数值以当前说明为准。"],
      ["三项专业准备是原创G适配，不充当已核原著仪式。原三瓶耗尽后须实际申请并等下一真实周补货。命运之蛇血是嘉德丽雅原4的个别准备，不追加为本阶通用配方。", "服药前须完成三项专业准备。原三瓶耗尽后须实际申请并等下一真实周补货。命运之蛇血是嘉德丽雅原4的个别准备，不追加为本阶通用配方。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
