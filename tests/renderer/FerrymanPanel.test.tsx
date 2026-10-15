/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FerrymanPanel, type FerrymanPanelProps } from "../../src/renderer/FerrymanPanel";
import type { FerrymanAction, FerrymanCommand, FerrymanProjection } from "../../src/domain/ferryman/types";
import { FERRYMAN_CONSUMPTION_RISK } from "../../src/domain/ferryman/content";
import { createFerrymanLifeState } from "../../src/domain/ferryman/life";

type Attempt = NonNullable<FerrymanProjection["life"]["currentAttempt"]>;
type CaseId = FerrymanProjection["life"]["cases"][number]["id"];
function action(command: FerrymanCommand, label: string, cost = "0行动", extra: Partial<FerrymanAction> = {}): FerrymanAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "实际拜访当前摆渡人渠道", "1行动 · 已知指导不重复收费");
const bottleId = (n: number) => `ferryman-post-cycle-potion-${n}`;
const consume = (n = 1) => action({ type: "CONSUME", bottleId: bottleId(n), confirmed: true }, `核对并服用第${n}独立原瓶`, "0行动 · 耗用这一原瓶");
// Synthetic public-renderer fixtures only. They do not predict a future natural roll or prove domain eligibility.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 3300, method: "ABILITY", closed: false, result: "NONE", elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], spiritualitySpent: 0, abilityTier: null,
    ownerConsent: "UNASKED", ownerConsentWeek: null, spiritConsent: "UNASKED", spiritConsentWeek: null,
    siteVisited: false, recipientVisited: false, stopped: false, refused: false, inspected: false, playerReturned: false,
    endpointsChecked: false, effectActive: false, effectRemainingSeconds: 0, effectStopped: false, effectExpired: false, waitedSeconds: 0,
    materialsSpent: 0, spiritCrossed: false, passageBenefit: false, spiritTravelMetres: 0, spiritEnergySpent: 0,
    tagTaken: false, tagHanded: false, tagDelivered: false, paperRecovered: false, paperReturned: false,
    replyWritten: false, replyTaken: false, replyDelivered: false,
    jarQuieted: false, jarSealed: false, sealBenefit: false, sealSpent: 0, clampWear: 0, ...extra };
}
function life(): FerrymanProjection["life"] {
  const initial = createFerrymanLifeState();
  return { ...initial, title: "当前中转室与有限往返G", story: "三项当前实际实践。", environment: "本人沿普通干廊往返。",
    introducedWeek: 3300, introducedDate: { epoch: "FIFTH_EPOCH", year: 1412, month: 9, day: 23 }, channelId: "POST_CYCLE",
    activeCase: null, inside: false, insideCase: false, currentAttempt: null, actions: [],
    cases: ([
      { id: "passage-out", title: "同一芦羽带同一原信签出去", story: "当前自愿的芦羽带原签去FAR，本人另走普通路。" },
      { id: "quiet-jar", title: "同一原罐暂静与封存", story: "原回响暂静20秒，原盖与封条仍须真实使用。" },
      { id: "passage-return", title: "同一芦羽带独立原回信回来", story: "重新询问返程意愿，旧原签不会变成原回信。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })) };
}
function encounter(): FerrymanProjection["encounter"] {
  return { title: "当前干院与新罗温", story: "新罗温在当前时代实际持原棍到场，普通出口开放。", status: "AVAILABLE", inside: false,
    scene: { courtId: "FR3-COURT", ground: "DRY", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: false },
    enemy: { id: "FR3-ROWAN", name: "罗温·谢尔", age: 51, source: "CURRENT_CHANNEL_COURT_ADULT_G", sourceEpoch: "POST_CYCLE", sequence: 3,
      health: 90, mind: 100, spirituality: 103, status: "RESISTING", weaponId: "FR3-ROWAN-CLUB", weaponLocation: "HAND", powerUses: { ECHO_STRIKE: 1, SEAL_WARD: 2, FOCUS: 1 } },
    actions: [], facts: ["灵体干扰与屏护是本作G，不是旧欧文复活。", "独立灵性消耗不退款，普通死亡不复起。"] };
}
function era(): FerrymanProjection["era"] {
  return { available: true, location: "当前汉娜接待处", current: "当前第3300周，1412年9月23日，本人在当前接待处。",
    history: ["居所离开时1411年6月26日，第3235周；健康55、精神68、灵性104、现金194便士、行动1，原身体LC-OUTSIDE。", "后来真实步行12米、12秒到汉娜接待处。"],
    economy: "当前工作1行动收入24便士；休整1行动8便士，健康+5、精神+8、灵性+10；周结24便士推进7天，实际4行动。",
    counters: ["本章实际工作4次、休整2次，收入96便士、支出40便士。", "同周居所补劳动已经使用，不重置额外机会。"], actions: [] };
}
function projection(extra: Partial<FerrymanProjection> = {}): FerrymanProjection {
  return { title: "摆渡人·死神序列3（有限往返G）", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [],
    supplies: "本次汉娜独立原瓶1200便士，或每瓶五次实际劳务后80便士。", actions: [guidance()],
    currentChannel: { id: "POST_CYCLE", provider: "汉娜·斯托克（FR3-HANNA，实际介绍时43岁）", introduced: "后世真实介绍第3300周，1412年9月23日。", prices: { guidance: 120, potion: 1200, labourCredit: 1120, preparation: 20 } },
    channelHistory: ["原时代路易斯·赛尔FR3-LEWIS，介绍时56岁；原约定1351年离开时结束。", "ferryman-original-potion-1 CONSUMED，原失败与五次劳务保留。", "ferryman-original-potion-2 EXPIRED，1411年真实周期时失效；不得作为后世原瓶。"],
    bottles: [1, 2, 3].map(n => ({ id: bottleId(n), title: `摆渡人第${n}独立原瓶`, source: `汉娜FR3-HANNA的后世独立原瓶，封签FR3-POST-SEAL-${n}`,
      status: "已取得，尚未服用", chance: 71, command: { type: "CONSUME" as const, bottleId: bottleId(n), confirmed: true as const } })),
    preparations: [{ taskId: "CHECK_ROUTE", title: "亲自核对当前渠道与路线", completedWeek: 3299 }, { taskId: "REVIEW_IDENTITY", title: "复核本次身份与记忆边界", completedWeek: 3299 }, { taskId: "PLAN_RETURN", title: "检查停止与普通返程", completedWeek: 3299 }],
    preparedWeek: 3300, abilities: [{ id: "death.s3.bounded-ferry", label: "有限摆渡（本作G）", mastery: 0, description: "当前自愿的同一原灵和两个已核端点。" },
      { id: "death.s3.departure-ward", label: "离程屏护（本作G）", mastery: 0, description: "原回响只暂静，不净化人格。" }],
    acting: 0, digestion: "原不死者消化100，真实晋4后已经满12整周；已发生的首次周期保留。", pollution: 3, risk: FERRYMAN_CONSUMPTION_RISK,
    resources: { health: 70, maxHealth: 100, mind: 85, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE", inheritedHistory: ["旧欧文原身体DEAD，原棍YARD。", "原灰羽已释放，后世当前联系未知。", "原伊芙琳已故，两次保管交接保留。", "实际首次周期死亡、同体复起、三份原记录有限寻回与原簿PLAYER保留。"],
    life: life(), encounter: encounter(), era: era(), insideCase: false, environment: "旧时代保持关闭，当前接待与实践使用新的实际来源。", ...extra };
}
function activate(value: FerrymanProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = value.life.inside = value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function panel(value = projection(), props: Partial<Omit<FerrymanPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<FerrymanPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (label: string) => screen.getByText(label, { selector: "summary" }).closest("details")!;
const open = (label: string) => userEvent.click(screen.getByText(label, { selector: "summary" }));
afterEach(cleanup);

describe("FerrymanPanel current era, original bodies and physical continuity", () => {
  it("leads with actual resources and readiness while keeping full rules and channel history folded", () => {
    const reason = "从真实晋4起仅11/12整周。";
    const value = projection({ digestion: reason, formula: [{ name: "不能显示的未核材料", quantity: 3, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "摆渡人当前目标" }).textContent).toContain(reason);
    expect(button("实际拜访当前摆渡人渠道").disabled).toBe(true);
    expect(button("实际拜访当前摆渡人渠道").getAttribute("aria-describedby")).toContain("ferryman-reason-");
    const resources = screen.getByRole("region", { name: "摆渡人当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["70 / 100", "85 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(screen.queryByText("不能显示的未核材料")).toBeNull();
    for (const label of ["独立成品与晋升准备", "两个时代的渠道记录", "技巧与使用范围", "原身体、实际周期与旧人旧物", "离开居所时的记录与本章实际收支"]) expect(fold(label).open).toBe(false);
    fireEvent.click(button("实际拜访当前摆渡人渠道")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("uses the actual post-cycle source and its own prices without making old expired bottles selectable", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    const current = screen.getByRole("region", { name: "当前摆渡人渠道" });
    for (const text of ["首次周期后的当前渠道", "FR3-HANNA", "43岁", "第3300周", "120 便士", "1200 便士", "80 便士", "20 便士", "已学指导知识保留", "介绍仍需1行动"]) expect(current.textContent).toContain(text);
    expect(current.textContent).not.toContain("FR3-LEWIS");
    const selector = screen.getByRole("combobox", { name: "选择独立摆渡人原瓶" });
    expect(within(selector).getAllByRole("option")).toHaveLength(3); expect(selector.textContent).not.toContain("EXPIRED");
    await open("两个时代的渠道记录");
    const history = screen.getByRole("region", { name: "摆渡人历史渠道" });
    for (const text of ["FR3-LEWIS", "56岁", "CONSUMED", "EXPIRED", "原失败", "五次劳务", "莱娜"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("shows original-era prices only when an original current agreement is actually projected", () => {
    const value = projection({ currentChannel: { id: "ORIGINAL", provider: "路易斯·赛尔FR3-LEWIS，介绍时56岁", introduced: "1351年8月14日，第112周实际介绍。", prices: { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } }, era: { ...era(), available: false } });
    panel(value); const current = screen.getByRole("region", { name: "当前摆渡人渠道" });
    for (const text of ["原时代当前渠道", "FR3-LEWIS", "第112周", "500 便士", "6200 便士", "800 便士", "120 便士"]) expect(current.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前时代生活" })).toBeNull();
  });

  it("keeps guidance knowledge without claiming a provider or bottle exists before the real introduction", () => {
    const value = projection({ currentChannel: null, bottles: [], preparations: [], preparedWeek: null }); panel(value);
    expect(screen.getByRole("region", { name: "当前摆渡人渠道" }).textContent).toContain("尚未建立本时代的实际供应约定");
    expect(screen.queryByRole("combobox", { name: "选择独立摆渡人原瓶" })).toBeNull();
    expect(button("实际拜访当前摆渡人渠道").textContent).toContain("1行动 · 已知指导不重复收费");
  });

  it("shows natural ability limits and preserves the real cycle without battle revival", async () => {
    const value = projection({ promoted: true }), before = structuredClone(value); panel(value);
    const summary = screen.getByRole("region", { name: "摆渡人当前目标" });
    for (const text of ["序列3摆渡人", "序列2死亡执政官", "旧六十年周期诅咒不再触发", "普通战斗死亡不会复活"]) expect(summary.textContent).toContain(text);
    expect(summary.textContent).not.toMatch(/本作G|尚未开放|已核实/);
    await open("独立成品与晋升准备");
    const boundary = screen.getByRole("region", { name: "摆渡人成品与配方边界" });
    for (const text of ["成品魔药", "不提供完整配方", "自行调配步骤", "晋升仍需完成专业准备", "分别结算"]) expect(boundary.textContent).toContain(text);
    await open("技巧与使用范围");
    const abilities = screen.getByRole("region", { name: "摆渡人能力与使用范围" });
    for (const text of ["当前原灵", "实际端点", "当次同意", "人格净化", "20秒", "普通完成和失败不赠能力掌握"]) expect(abilities.textContent).toContain(text);
    await open("原身体、实际周期与旧人旧物");
    const history = screen.getByRole("region", { name: "摆渡人继承记录" });
    for (const text of ["女性", "DEAD", "原棍YARD", "当前联系未知", "原伊芙琳已故", "同体复起", "原簿PLAYER", "不删除已经发生"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects one current independent bottle and sends only its exact labour intent", async () => {
    const commands: FerrymanCommand[] = [{ type: "POTION_WORK", bottleId: bottleId(1) }, { type: "POTION_WORK", bottleId: bottleId(2) }];
    const value = projection({ actions: commands.map((command, n) => action(command, `第${n + 1}瓶实际劳务`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立摆渡人原瓶" }), bottleId(2));
    expect(screen.queryByRole("button", { name: /^第1瓶实际劳务/ })).toBeNull(); fireEvent.click(button("第2瓶实际劳务"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews one original bottle, current source, four outcomes and unchanged body before independent confirmation", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用第1独立原瓶"));
    const review = screen.getByRole("region", { name: "摆渡人原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "摆渡人第1独立原瓶" }));
    for (const text of [bottleId(1), "FR3-POST-SEAL-1", "FR3-HANNA", "71%", "第3300周", "0行动", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "成功或失败", "性别不改变", "当前灵性不补满", "不获得即时战斗复活"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("FR3-POST-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "摆渡人原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用第1独立原瓶")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("locks the exact submitted original intention across save failure and an unchanged clone", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用第1独立原瓶")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    rerender(<FerrymanPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "摆渡人原瓶服用确认" })).toBeTruthy();
    rerender(<FerrymanPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const committed = structuredClone(value); committed.promoted = true; committed.preparedWeek = null; committed.actions = []; committed.bottles[0]!.status = "原瓶已耗尽 · 实际晋升";
    rerender(<FerrymanPanel {...defaults} value={committed} />);
    expect(screen.queryByRole("region", { name: "摆渡人原瓶服用确认" })).toBeNull(); expect(button("关闭摆渡人页面").disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps a failed bottle consumed and offers a different real bottle without restoring resources", async () => {
    const value = projection({ actions: [consume(2)] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立摆渡人原瓶" }), bottleId(2));
    await userEvent.click(button("核对并服用第2独立原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    const committed = structuredClone(value); committed.preparedWeek = null; committed.bottles[1]!.status = "原瓶已耗尽 · 晋升失败";
    committed.resources = { ...committed.resources!, health: 55, mind: 60 }; const work: FerrymanCommand = { type: "POTION_WORK", bottleId: bottleId(3) };
    committed.actions = [action(work, "为第三原瓶实际劳务", "1行动")]; rerender(<FerrymanPanel {...defaults} value={committed} />);
    expect((screen.getByRole("combobox", { name: "选择独立摆渡人原瓶" }) as HTMLSelectElement).value).toBe(bottleId(3));
    expect(screen.getByRole("region", { name: "摆渡人当前资源" }).textContent).toContain("55 / 100");
    await open("独立成品与晋升准备"); expect(screen.getByRole("region", { name: "摆渡人成品与配方边界" }).textContent).toContain("原瓶已耗尽 · 晋升失败");
    fireEvent.click(button("为第三原瓶实际劳务")); expect(onCommand).toHaveBeenLastCalledWith(work); expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("invalidates an unsubmitted review when its actual resource, cost or current source changes", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    const changes = [{ ...value, resources: { ...value.resources!, spirituality: 41 } }, { ...value, actions: [{ ...consume(), cost: "新增实际成本" }] }, { ...value, currentChannel: null }];
    for (const changed of changes) {
      rerender(<FerrymanPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用第1独立原瓶"));
      rerender(<FerrymanPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "摆渡人原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation readable with the authoritative reason", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用第1独立原瓶"));
    rerender(<FerrymanPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "当前原现场尚未收束。" }] }} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true); expect(button("确认服用这一原瓶").getAttribute("aria-describedby")).toBe("ferryman-confirm-reason");
    expect(screen.getByRole("region", { name: "摆渡人原瓶服用确认" }).textContent).toContain("当前原现场尚未收束"); fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "写入失败" }, { error: { message: "版本冲突", retryable: false } }])("locks every action, selector and dismissal while recovery is pending: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    expect(button("实际拜访当前摆渡人渠道").disabled).toBe(true); expect(button("关闭摆渡人页面").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择独立摆渡人原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("实际拜访当前摆渡人渠道")); fireEvent.click(button("关闭摆渡人页面")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (typeof props.error === "object") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
  });

  it.each([
    [{ type: "PREPARE_TASK", taskId: "CHECK_ROUTE" }, "核对当前渠道与原路", "1行动"],
    [{ type: "PREPARE_PROMOTION" }, "实际检查当周场地", "1行动 · 20便士"],
    [{ type: "REQUEST_SUPPLY" }, "向当前汉娜渠道申请新批", "1行动 · 须跨真实周"],
    [{ type: "RECEIVE_SUPPLY" }, "接收当前渠道新原瓶", "0行动 · 独立新原瓶"],
  ] as const)("passes exact acquisition intent and its actual cost: %j", (command, label, cost) => {
    const value = projection({ actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it.each([
    [{ type: "ERA_ENTER" }, "沿原路走入当代接待处", "0行动 · 实际12米12秒"],
    [{ type: "ERA_LEAVE" }, "沿原路离开当前接待处", "0行动 · 实际12米12秒"],
    [{ type: "ERA_WORK" }, "本章实际普通工作", "1行动 · 收入24便士"],
    [{ type: "ERA_REST" }, "本章实际付费休整", "1行动 · 8便士"],
    [{ type: "ERA_NEXT_WEEK" }, "实付生活费并推进七天", "0行动 · 24便士 · 实际7天"],
    [{ type: "ERA_CARE" }, "处置当前实际重伤", "1行动 · 60便士"],
  ] as const)("keeps current-era action separate from old residence and sends its exact intent: %j", (command, label, cost) => {
    const value = projection({ actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    const current = screen.getByRole("region", { name: "当前时代生活" });
    expect(current.closest("details")).toBeNull(); expect(within(current).getByRole("button", { name: name => name.startsWith(label) })).toBe(button(label));
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("labels frozen departure balances as history and shows only the actual current date and resources as current", async () => {
    panel(); const current = screen.getByRole("region", { name: "当前时代生活" });
    expect(current.textContent).toContain("当前第3300周"); expect(current.textContent).toContain("当前实际地点：当前汉娜接待处");
    expect(fold("离开居所时的记录与本章实际收支").open).toBe(false);
    await open("离开居所时的记录与本章实际收支");
    const history = screen.getByRole("region", { name: "完成居所的历史余额" });
    for (const text of ["历史离开记录，不是当前资源", "第3235周", "健康55", "现金194便士", "LC-OUTSIDE", "12米、12秒", "额外机会", "旧时代保持关闭"]) expect(history.textContent).toContain(text);
    const resources = screen.getByRole("region", { name: "摆渡人当前资源" });
    expect(resources.textContent).toContain("70 / 100"); expect(resources.textContent).not.toContain("健康55");
    expect(within(history).queryByRole("button")).toBeNull();
  });

  it("leads with available current work when every acquisition step is blocked and folds only disabled steps", () => {
    const work = action({ type: "ERA_WORK" }, "本章实际普通工作", "1行动 · 收入24便士");
    const value = projection({ actions: [{ ...guidance(), enabled: false, reason: "当前知识已学。" }, work,
      action({ type: "ERA_NEXT_WEEK" }, "实付生活费并推进七天", "24便士", { enabled: false, reason: "先用完本周行动。" })] });
    panel(value);
    expect(screen.getByRole("region", { name: "摆渡人当前目标" }).textContent).toContain("下一步：本章实际普通工作");
    expect(button("本章实际普通工作").closest("details")).toBeNull();
    expect(button("实际拜访当前摆渡人渠道").closest("details")).toBe(fold("其它步骤与未满足条件"));
    expect(button("实付生活费并推进七天").closest("details")).toBe(fold("当前生活的未满足条件"));
    expect(button("实付生活费并推进七天").disabled).toBe(true);
  });

  it("selects a current life case locally without starting it or changing original objects", async () => {
    const commands: FerrymanCommand[] = [{ type: "OBSERVE", caseId: "passage-out" }, { type: "OBSERVE", caseId: "quiet-jar" }];
    const value = projection({ promoted: true, actions: commands.map((command, n) => action(command, n ? "观察同一原罐" : "观察同一原灵和原签", "1行动")) });
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择摆渡人生活情境" }), "quiet-jar");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察同一原灵和原签/ })).toBeNull();
    const current = screen.getByRole("region", { name: "当前摆渡人生活情境" });
    expect(current.textContent).toContain("观察、准备、实施与报告各1行动"); expect(current.textContent).toContain("现场子步0行动");
    fireEvent.click(button("观察同一原罐")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it.each([
    [{ type: "PREPARE", caseId: "passage-out", method: "ABILITY" }, "准备本次有限摆渡", "1行动 · 另留1行动实施"],
    [{ type: "PERFORM", caseId: "passage-out" }, "开始同一原签现场", "1行动"],
    [{ type: "REPORT", caseId: "passage-out" }, "报告实际原签结果", "1行动"],
  ] as const)("keeps the outer AP step distinct from zero-AP physical substeps: %j", (command, label, cost) => {
    const value = projection({ promoted: true, actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows actual local spirit source, current consent, both original papers and intact endpoints", async () => {
    const current = attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 3300 });
    const value = activate(projection({ promoted: true, actions: [action({ type: "CONSENT_SPIRIT", caseId: "passage-out" }, "当面询问芦羽本次意愿")] }), "passage-out", current);
    const before = structuredClone(value), { onCommand } = panel(value);
    const scene = screen.getByRole("region", { name: "摆渡人原灵原物与普通退路" });
    for (const text of ["FR3-MARA", "45岁", "FR3-DOOR", "实际开放", "FR3-REED", "剩余精力 100", "FR3-TAG", "FR3-REPLY", "尚未实际写成", "本次尚未当面询问", "本次尚未实际核对两原端点"]) expect(scene.textContent).toContain(text);
    expect(fold("本次来源、两端点与普通路线").open).toBe(false); await open("本次来源、两端点与普通路线");
    for (const text of ["FR3-TRANSFER-HOUSE", "首次周期后的当前渠道", "CURRENT_TRANSFER_HOUSE", "不是原灰羽", "FR3-NEAR", "FR3-FAR", "16 米", "普通4米", "不是已等候六十年的旧人"]) expect(scene.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "摆渡人当前行动" }).compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button("当面询问芦羽本次意愿")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("shows an opened window without falsely moving the original spirit or counting a benefit", () => {
    const current = attempt({ ownerConsent: "GRANTED", spiritConsent: "GRANTED", endpointsChecked: true, effectActive: true, effectRemainingSeconds: 20, abilityTier: "SUCCESS", spiritualitySpent: 6, materialsSpent: 1 });
    const value = activate(projection({ promoted: true, actions: [] }), "passage-out", current);
    value.life.playerLocation = "NEAR"; value.life.tag.location = "REED"; value.life.materials.remaining = 1;
    const before = structuredClone(value); panel(value);
    const window = screen.getByRole("region", { name: "摆渡人本次实际时间窗" });
    expect(window.textContent).toContain("剩余20秒"); expect(window.textContent).toContain("页面等待不会自行施术、移动或归还原物");
    const originals = screen.getByRole("region", { name: "同一原芦羽与两封独立原纸" });
    expect(originals.textContent).toContain("当前在原近端"); expect(originals.textContent).toContain("本次原灵尚未过路");
    expect(originals.textContent).toContain("剩余 1 份"); expect(value).toEqual(before);
  });

  it("keeps failed ability costs and a real ordinary crossing visible without granting ability success", () => {
    const current = attempt({ abilityTier: "FAILURE", spiritualitySpent: 6, materialsSpent: 1, spiritCrossed: true, spiritTravelMetres: 16, spiritEnergySpent: 6,
      playerTravelMetres: 4, elapsedSeconds: 29, playerMoves: [{ from: "START", to: "NEAR", metres: 4, seconds: 4 }] });
    const value = activate(projection({ promoted: true, actions: [action({ type: "GO_RECIPIENT", caseId: "passage-out" }, "本人独立沿6米普通路前往伊兰")] }), "passage-out", current);
    value.life.reed.location = "FAR"; value.life.reed.energy = 94; value.life.reed.travelMetres = 16; value.life.tag.location = "REED"; value.life.materials.remaining = 1;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const costs = screen.getByRole("region", { name: "摆渡人本次尝试与代价" });
    for (const text of ["失败", "不能重骰", "已付灵性 6", "原灵材实耗 1", "实际行程 16 米", "实付精力 6", "没有获得通道收益", "4米、4秒"]) expect(costs.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "同一原芦羽与两封独立原纸" }).textContent).toContain("剩余精力 94");
    fireEvent.click(button("本人独立沿6米普通路前往伊兰")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("preserves FAR and old tag custody into the return case and requires fresh spirit consent", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "CONSENT_SPIRIT", caseId: "passage-return" }, "重新询问同一芦羽返程意愿")] }), "passage-return", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 3300 }));
    value.life.reed.location = "FAR"; value.life.reed.energy = 94; value.life.tag.location = "ILAN";
    const before = structuredClone(value), { onCommand } = panel(value), originals = screen.getByRole("region", { name: "同一原芦羽与两封独立原纸" });
    for (const text of ["当前在伊兰原远端", "剩余精力 94", "FR3-TAG", "在伊兰本人处", "尚未实际写成", "本次尚未当面询问", "上次同意不沿用", "原信签不会变成原回信"]) expect(originals.textContent).toContain(text);
    fireEvent.click(button("重新询问同一芦羽返程意愿")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("shows delivered independent reply and the same spirit at its real local home without resetting energy", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "passage-return", attempt({ replyWritten: true, replyTaken: true, replyDelivered: true, spiritCrossed: true, spiritEnergySpent: 6, spiritTravelMetres: 16 }));
    value.life.reed.location = "NEAR"; value.life.reed.energy = 88; value.life.reed.travelMetres = 32; value.life.tag.location = "ILAN";
    value.life.reply.written = true; value.life.reply.location = "MARA"; value.life.reply.travelMetres = 20;
    const before = structuredClone(value); panel(value); const originals = screen.getByRole("region", { name: "同一原芦羽与两封独立原纸" });
    for (const text of ["剩余精力 88", "累计实际行程 32 米", "FR3-TAG", "在伊兰本人处", "FR3-REPLY", "已实际写成，数量1，在玛拉本人处", "芦羽只回当地栖处"]) expect(originals.textContent).toContain(text);
    expect(value).toEqual(before);
  });

  it("honours a current refusal without turning earlier consent into forced return", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "CROSS_SPIRIT", caseId: "passage-return" }, "让同一芦羽实际返程", "0行动", { enabled: false, reason: "原灵当前拒绝，不能强制返程。" }),
      action({ type: "STOP_CONTACT", caseId: "passage-return" }, "尊重拒绝并停止工作")] }), "passage-return", attempt({ refused: true, spiritConsent: "DECLINED", spiritConsentWeek: 3300 }));
    value.life.reed.location = "FAR"; value.life.reed.willing = false;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "同一原芦羽与两封独立原纸" }).textContent).toContain("可以留在实际端点，不强制召回");
    expect(button("让同一芦羽实际返程").disabled).toBe(true); fireEvent.click(button("尊重拒绝并停止工作"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command); expect(value).toEqual(before);
  });

  it("distinguishes temporary jar agitation from the original echo and actual unsealed lid", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "SEAL_JAR", caseId: "quiet-jar" }, "趁本次窗口合原盖封存", "0行动 · 2秒 · 原封条1")] }), "quiet-jar", attempt({ jarQuieted: true, abilityTier: "SUCCESS", spiritualitySpent: 6, effectActive: true, effectRemainingSeconds: 18 }));
    value.life.playerLocation = "FAR"; value.life.jar.agitation = 0;
    const before = structuredClone(value), { onCommand } = panel(value), jar = screen.getByRole("region", { name: "同一原罐与暂静后的原回响" });
    for (const text of ["FR3-JAR", "伊兰·罗", "FR3-JAR-BOX", "当前躁动 0", "原回响强度 2", "原盖尚未合上", "原罐尚未封存", "剩余 1", "耐久 100", "仍恢复为2", "不等于净化或消灭"]) expect(jar.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "摆渡人本次实际时间窗" }).textContent).toContain("剩余18秒");
    fireEvent.click(button("趁本次窗口合原盖封存")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("preserves a failed ability, ordinary clamp wear and sealed original echo after the window ends", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "quiet-jar", attempt({ abilityTier: "GREAT_FAILURE", spiritualitySpent: 6, jarSealed: true, sealSpent: 1, clampWear: 2, result: "ORDINARY", effectStopped: true }));
    value.life.jar.lidClosed = value.life.jar.sealed = true; value.life.seal.remaining = 0; value.life.clamp.durability = 98;
    panel(value); const jar = screen.getByRole("region", { name: "同一原罐与暂静后的原回响" });
    for (const text of ["当前躁动 2", "原回响强度 2", "已经合上", "已经封存", "剩余 0", "耐久 98"]) expect(jar.textContent).toContain(text);
    const costs = screen.getByRole("region", { name: "摆渡人本次尝试与代价" });
    for (const text of ["严重失败", "普通方法完成", "原封条实耗 1", "原夹具磨损 2", "不算能力实际成功", "原回响本质未消灭"]) expect(costs.textContent).toContain(text);
  });

  it("keeps an expired channel window separate from current real spirit location and ordinary retreat", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "RETURN_PLAYER", caseId: "passage-out" }, "本人普通返回START", "0行动 · 0灵性 · 10米")] }), "passage-out", attempt({ effectExpired: true, waitedSeconds: 14, spiritCrossed: true, tagDelivered: true }));
    value.life.reed.location = "FAR"; value.life.tag.location = "ILAN"; value.life.playerLocation = "FAR"; value.resources = { ...value.resources!, spirituality: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const window = screen.getByRole("region", { name: "摆渡人本次实际时间窗" });
    expect(window.textContent).toContain("20秒窗口已实际耗尽"); expect(window.textContent).toContain("不传回原灵");
    expect(button("本人普通返回START").disabled).toBe(false); fireEvent.click(button("本人普通返回START"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("shows damaged endpoints and a blocked ordinary door without pretending passage succeeded", async () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "RETURN_PLAYER", caseId: "passage-out" }, "沿原路实际返回", "0行动", { enabled: false, reason: "原普通门BLOCKED，不能走过。" })] }), "passage-out");
    value.life.endpoints.farIntact = false; value.life.door.state = "BLOCKED";
    const { onCommand } = panel(value); await open("本次来源、两端点与普通路线");
    const scene = screen.getByRole("region", { name: "摆渡人原灵原物与普通退路" });
    expect(scene.textContent).toContain("已阻塞，不能声称已走过"); expect(scene.textContent).toContain("FR3-FAR：已毁损");
    expect(button("沿原路实际返回").disabled).toBe(true); fireEvent.click(button("沿原路实际返回")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: "CHECK_ENDPOINTS", caseId: "passage-out" }, "核对原两端点"],
    [{ type: "HAND_TAG", caseId: "passage-out" }, "交同一原签给同一原灵"],
    [{ type: "OPEN_PASSAGE", caseId: "passage-out" }, "开启本案唯一能力窗口"],
    [{ type: "CROSS_SPIRIT", caseId: "passage-out" }, "原灵当前自愿实际过路"],
    [{ type: "DELIVER_TAG", caseId: "passage-out" }, "伊兰实际接同一原签"],
    [{ type: "WRITE_REPLY", caseId: "passage-return" }, "伊兰写成独立原回信"],
    [{ type: "TAKE_REPLY", caseId: "passage-return" }, "本人接回同一原回信"],
    [{ type: "DELIVER_REPLY", caseId: "passage-return" }, "玛拉实际接原回信"],
    [{ type: "QUIET_JAR", caseId: "quiet-jar" }, "短暂压低原罐躁动"],
    [{ type: "STOP_EFFECT", caseId: "quiet-jar" }, "停止本次暂静"],
    [{ type: "WAIT_WINDOW", caseId: "passage-out" }, "实际等到本次窗口结束"],
    [{ type: "RETURN_ITEMS", caseId: "passage-return" }, "同址普通取还原纸"],
    [{ type: "INSPECT", caseId: "passage-out" }, "检查当前原物与退出"],
    [{ type: "CLOSE", caseId: "passage-out" }, "关闭已经实际收束的现场"],
    [{ type: "WITHDRAW", caseId: "passage-return" }, "如实退出本次原路工作"],
  ] as const)("forwards each current physical substep once without renderer mutation: %j", (command, label) => {
    const value = activate(projection({ promoted: true, actions: [action(command, label, "0行动 · 实际成本按公开记录")] }), command.caseId), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(label)); fireEvent.click(button(label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });

  it("locks the case selector while prepared or inside an actual scene", () => {
    const value = activate(projection({ promoted: true }), "passage-out"); panel(value);
    expect((screen.getByRole("combobox", { name: "选择摆渡人生活情境" }) as HTMLSelectElement).disabled).toBe(true);
  });

  it("folds optional combat away from life and does not start it by opening its history", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "前往当前罗温处实际交谈", "1行动 · 另留开战1行动");
    const value = projection({ promoted: true, actions: [talk, action({ type: "OBSERVE", caseId: "passage-out" }, "观察当前芦羽与原签", "1行动")] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("新原人的可选冲突").open).toBe(false); expect(screen.getByRole("region", { name: "摆渡人当前目标" }).textContent).toContain("观察当前芦羽与原签");
    await open("新原人的可选冲突"); expect(onCommand).not.toHaveBeenCalled();
    expect(button("前往当前罗温处实际交谈").closest("details")).toBe(fold("新原人的可选冲突"));
    fireEvent.click(button("前往当前罗温处实际交谈")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(talk.command); expect(value).toEqual(before);
  });

  it("shows independent new Rowan and his real resource costs without reviving Owen or using a spirit companion", async () => {
    const value = projection({ promoted: true, actions: [action({ type: "LEAVE_ENCOUNTER" }, "沿普通出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.scene!.clearanceConfirmed = true;
    const before = structuredClone(value), { onCommand } = panel(value), scene = screen.getByRole("region", { name: "摆渡人原人遭遇" });
    for (const text of ["罗温·谢尔", "51岁", "FR3-ROWAN", "健康 90", "精神 100", "独立灵性 103 / 120", "FR3-ROWAN-CLUB", "仍在原人手中", "新罗温与旧欧文分别保存", "无追逐", "都不会免费参战"]) expect(scene.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前摆渡人生活情境" })).toBeNull();
    await open("本场范围与战斗代价");
    for (const text of ["有限摆渡6灵性", "离程屏护6灵性", "死者之语6灵性", "冥界封印6灵性", "不直接扣健康或精神", "普通死亡不会周期复活"]) expect(scene.textContent).toContain(text);
    fireEvent.click(button("沿普通出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("preserves a real current death as read-only and never offers a renderer revival", () => {
    const reason = "当前身体已经死亡，普通死亡不能靠旧周期或休整复活。";
    const value = projection({ promoted: true, actions: [action({ type: "OBSERVE", caseId: "passage-out" }, "观察当前原灵", "1行动", { enabled: false, reason }), action({ type: "ERA_REST" }, "当前付费休整", "1行动 · 8便士", { enabled: false, reason })] });
    value.resources = { ...value.resources!, health: 0 }; value.encounter.status = "LOST";
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "摆渡人当前目标" }).textContent).toContain(reason);
    expect(button("观察当前原灵").disabled).toBe(true); expect(button("当前付费休整").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /复活|复起/ })).toBeNull(); fireEvent.click(button("当前付费休整")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("closing the view never submits return, cleanup, travel or a residence command", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "passage-out"); value.life.reed.location = "FAR"; value.life.playerLocation = "NEAR";
    const before = structuredClone(value), { onCommand, onClose } = panel(value); fireEvent.click(button("关闭摆渡人页面"));
    expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
