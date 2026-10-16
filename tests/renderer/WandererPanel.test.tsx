/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WandererPanel, type WandererPanelProps } from "../../src/renderer/WandererPanel";
import type { WandererAction, WandererCommand, WandererProjection } from "../../src/domain/wanderer/types";
import { WANDERER_CONSUMPTION_RISK, WANDERER_FORMULA_STATUS, WANDERER_SOURCE_STATUS } from "../../src/domain/wanderer/content";
import { createWandererLifeState } from "../../src/domain/wanderer/life";

type Attempt = NonNullable<WandererProjection["life"]["currentAttempt"]>;
type CaseId = WandererProjection["life"]["cases"][number]["id"];
function action(command: WandererCommand, label: string, cost = "0行动", extra: Partial<WandererAction> = {}): WandererAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取漫游者专业指导", "1行动 · 500便士");
const consume = (id = "wanderer-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶");
const depart = () => action({ type: "DEPART", caseId: "offworld-visit", confirm: true }, "核对并前往原停泊舱", "0行动 · 8灵性 · 原片1 · 10秒");
// Explicit public component projections. These fixtures are not eligibility tests, natural RNG results or campaign replay evidence.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 120, method: "ABILITY", closed: false, result: "NONE", initialHealth: 80, initialMind: 90, initialSpirituality: 42, initialPollution: 3,
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, energySpent: 0, abilityTier: null,
    ownerConsent: "UNASKED", ownerConsentWeek: null, recipientConsent: "UNASKED", recipientConsentWeek: null,
    siteVisited: false, stopped: false, inspected: false, playerReturned: false, anchorTaken: false, anchorPlaced: false, coordinatesRead: false, anchorCalibrated: false, manualAlignment: false,
    suitBorrowed: false, suitChecked: false, departureChecked: false, departureConfirmed: false, departed: false, failedDeparture: false, returnMarkerChecked: false, packetTaken: false, returnedLocal: false, suitReturned: false,
    remoteSeconds: 0, horizonViewed: false, exposureActions: 0, healthLost: 0, mindLost: 0, pollutionAdded: 0, packetRecordsChecked: false, recordsCompared: false, manualComparison: false,
    packetHanded: false, nonreturnFiled: false, packetReturned: false, anchorRecovered: false, anchorReturned: false, ...extra };
}
function life(): WandererProjection["life"] {
  return { ...createWandererLifeState(), title: "漫游者有限原物实践G", story: "三项原创G实践", environment: "同一工坊、原锚和固定原舱。",
    activeCase: null, inside: false, insideCase: false, reflected: false, currentAttempt: null, actions: [],
    cases: ([
      { id: "anchor-check", title: "同一原航标与两原记录", story: "同一原航标4米到PAD，核对已有原记录。" },
      { id: "offworld-visit", title: "同一本体与原封包往返", story: "先核原信号、防护和回程，独立决定是否前往。" },
      { id: "original-handoff", title: "原封包交接与原航标归还", story: "实际走10米到原办公室，不伪造未取得的原包。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): WandererProjection["encounter"] {
  return { title: "原干院与独立卡西安", story: "净空原干院，双方初始相距2米，普通出口开放，无追逐。", status: "AVAILABLE", inside: false,
    scene: { courtId: "WN3-COURT", ground: "DRY", ordinaryExit: "OPEN", thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: "ORIGIN" },
    enemy: { id: "WN3-CASSIAN", name: "卡西安·格里夫", age: 49, source: "ORIGINAL_COURT_ADULT_G", sequence: 3,
      health: 90, mind: 100, spirituality: 103, status: "RESISTING", weaponId: "WN3-CASSIAN-ROD", weaponLocation: "HAND", powerUses: { VECTOR_STRIKE: 1, REFRACT_WARD: 2, PARALLAX: 1 } },
    actions: [], facts: ["实际普通出口开放，无追逐。", "本轮折光只抵下一成功定位或侧避一次。"] };
}
function projection(extra: Partial<WandererProjection> = {}): WandererProjection {
  return { title: "漫游者·门序列3（有限离世往返G）", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "本体漫游方向已核，具体端点与定量为G。", supplies: "独立原瓶6400便士，或本瓶五次劳务后900便士。",
    actions: [guidance()], bottles: [1, 2, 3].map(n => ({ id: `wanderer-potion-${n}`, title: `漫游者第${n}独立原瓶`,
      source: `独立序列3渠道第${n}原瓶，封签WN3-SEAL-${n}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `wanderer-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "VERIFY_DESTINATION", title: "核读有限目的地原记录", completedWeek: 115 },
      { taskId: "CHECK_PROTECTION", title: "防护与污染边界", completedWeek: 116 }, { taskId: "PLAN_RETURN", title: "回程预算", completedWeek: 116 }],
    preparedWeek: 120, abilities: [{ id: "door.s3.star-wandering", label: "星空漫游（有限往返G）", mastery: 0, description: "指定原锚与同一本体实际往返。" },
      { id: "door.s3.astral-positioning", label: "星界定位（本作G）", mastery: 0, description: "仅核对已经读到的有限原记录。" },
      { id: "door.s8.tricks", label: "继承戏法", mastery: 24, description: "旧实际掌握与原代价保留。" }],
    acting: 0, digestion: "原秘法师消化100，原实际晋升已满12整周。", pollution: 3, risk: WANDERER_CONSUMPTION_RISK,
    resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    currentGender: "FEMALE", inheritedHistory: ["旧原活体A仍SEALED，原框已交档案馆。", "旧原半神B仍活着，原伤势保留。", "原记录库与口袋同一原物未复制。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原工坊和普通干廊，异星回程另耗原资源。", ...extra };
}
function activate(value: WandererProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function departureReady(actions: WandererAction[] = [depart()]) {
  const value = activate(projection({ promoted: true, actions }), "offworld-visit", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 120, suitBorrowed: true, suitChecked: true, departureChecked: true }));
  value.life.playerLocation = "PAD"; value.life.anchor.location = "PAD"; value.life.anchor.status = "CALIBRATED"; value.life.suit.location = "PLAYER";
  return value;
}
function remote(actions: WandererAction[] = []) {
  const value = departureReady(actions), current = value.life.currentAttempt!;
  Object.assign(current, { departureConfirmed: true, departed: true, abilityTier: "SUCCESS", spiritualitySpent: 8, energySpent: 1 });
  value.life.playerLocation = "REMOTE"; value.life.energy.remaining = 1; value.life.energy.spent = 1; value.life.suit.offworldLegs = 1;
  return value;
}
function panel(value = projection(), props: Partial<Omit<WandererPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<WandererPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("WandererPanel public projections, independent confirmations and original-body continuity", () => {
  it("leads with actual readiness and resources, folds details, and never renders unknown formula materials", () => {
    const reason = "原秘法师只有11/12整周，须等待下一真实周。";
    const value = projection({ digestion: reason, formula: [{ name: "不得显示的猜测材料", quantity: 9, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "漫游者当前目标" }).textContent).toContain(reason);
    expect(button("听取漫游者专业指导").disabled).toBe(true);
    expect(button("听取漫游者专业指导").getAttribute("aria-describedby")).toContain("wanderer-reason-");
    const resources = screen.getByRole("region", { name: "漫游者当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(screen.queryByText("不得显示的猜测材料")).toBeNull();
    for (const title of ["独立成品与晋升准备", "能力范围与实际掌握", "原身体、旧封印与继承原物", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    fireEvent.click(button("听取漫游者专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("states S3 continuity and preparation without granting higher abilities", async () => {
    panel(); const goal = screen.getByRole("region", { name: "漫游者当前目标" });
    for (const text of ["漫游者为序列3", "下一阶段旅法师为序列2，达到条件后可查看独立晋升准备", "晋升不会复活旧死亡档", "不会改写已有原身体", "原物与实际经历"]) expect(goal.textContent).toContain(text);
    await open("独立成品与晋升准备");
    const recipe = screen.getByRole("region", { name: "漫游者成品与配方边界" });
    for (const text of ["完整配方尚未掌握，服用前需要专业准备", "完整仪式保持未知，仍须完成服药准备", "WN3-HESTER", "52岁", "6400", "900便士", "500便士", "140便士", "12整周", "第115周", "不开放自制配方", "不复用秘法师4的旧敌意半神封印仪式"]) expect(recipe.textContent).toContain(text);
    await open("能力范围与实际掌握");
    const boundaries = screen.getByRole("region", { name: "漫游者能力与使用范围" });
    for (const text of ["序列3漫游者", "进入星空、星界和异星", "天使以下仍面临星空污染危险", "须分别满足防护、供给、回程、携带与灵性条件", "真空免疫", "不是全知导航", "九处外星传说仪式", "序列0概念化", "普通方法完成", "不赠能力掌握"]) expect(boundaries.textContent).toContain(text);
  });

  it("keeps old sealed life, old enemy, original inventory and gender read-only", async () => {
    const value = projection(), before = structuredClone(value); panel(value); await open("原身体、旧封印与继承原物");
    const history = screen.getByRole("region", { name: "漫游者继承记录" });
    for (const text of ["女性", "SEALED", "档案馆", "旧原半神B仍活着", "原记录库", "口袋", "不赠记录", "旧两个死亡档"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects one independent bottle and forwards its exact labour intent only once", async () => {
    const commands: WandererCommand[] = [{ type: "POTION_WORK", bottleId: "wanderer-potion-1" }, { type: "POTION_WORK", bottleId: "wanderer-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}瓶劳动`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立漫游者原瓶" }), "wanderer-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶劳动/ })).toBeNull(); fireEvent.click(button("第2瓶劳动")); fireEvent.click(button("第2瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews only the chosen original bottle and actual risks, then cancels with Escape and restores focus", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "漫游者原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "漫游者第1独立原瓶" }));
    for (const text of ["wanderer-potion-1", "WN3-SEAL-1", "71%", "第120周", "成功或失败", "性别不改变", "当前灵性不补满", "0行动", "意志难度30", "精神−8", "精神−15", "健康−15", "排异+30", "健康−25", "精神−45", "排异+60"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("WN3-SEAL-2"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "漫游者原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps a submitted original dose locked through save failure until a changed committed projection arrives", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    rerender(<WandererPanel {...defaults} error={{ message: "服药写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull(); await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "漫游者原瓶服用确认" })).toBeTruthy();
    rerender(<WandererPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = []; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<WandererPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "漫游者原瓶服用确认" })).toBeNull(); expect(button("关闭漫游者页面").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "上一次保存失败" }] as const)("never submits or closes while the public operation is locked: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    fireEvent.click(button("听取漫游者专业指导")); fireEvent.click(button("关闭漫游者页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    expect(button("听取漫游者专业指导").disabled).toBe(true);
  });

  it("invalidates an unsubmitted dose review when its current resources change", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, defaults, rerender } = panel(value);
    await userEvent.click(button("核对并服用")); const changed = structuredClone(value); changed.resources!.mind = 40;
    changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<WandererPanel {...defaults} value={changed} />);
    expect(screen.queryByRole("region", { name: "漫游者原瓶服用确认" })).toBeNull(); expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("puts current physical actions before the original-object details and locks active-case selection", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "CONSENT_OWNER", caseId: "anchor-check" }, "当面问诺拉本案许可")] }), "anchor-check");
    const before = structuredClone(value), { onCommand } = panel(value), scene = screen.getByRole("region", { name: "漫游者原人原物与真实位置" });
    expect(screen.getByRole("region", { name: "漫游者当前行动" }).compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择漫游者生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    for (const text of ["WN3-WORKSHOP", "WN3-NORA", "41岁", "WN3-ELIAS", "37岁", "WN3-DOOR", "实际开放", "旧案同意不延续", "WN3-ANCHOR", "WN3-SUIT", "WN3-ENERGY", "剩余 2 / 2 片"]) expect(scene.textContent).toContain(text);
    fireEvent.click(button("当面问诺拉本案许可")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("allows choosing an unstarted case without treating selection as an action", async () => {
    const value = projection({ promoted: true, actions: [action({ type: "OBSERVE", caseId: "anchor-check" }, "观察同一原航标", "1行动"), action({ type: "OBSERVE", caseId: "offworld-visit" }, "观察同一原舱", "1行动")] }), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择漫游者生活情境" }), "offworld-visit");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察同一原航标/ })).toBeNull();
    const current = screen.getByRole("region", { name: "当前漫游者生活情境" });
    for (const text of ["观察、准备、实施与报告各1行动", "准备前须留足2行动", "现场子步0行动", "共13行动"]) expect(current.textContent).toContain(text);
    fireEvent.click(button("观察同一原舱")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
  });

  it("shows original calibrated anchor left at PAD without claiming its return", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "anchor-check", attempt({ anchorTaken: true, anchorPlaced: true, coordinatesRead: true, anchorCalibrated: true, playerReturned: true }));
    value.life.anchor.location = "PAD"; value.life.anchor.status = "CALIBRATED"; value.life.anchor.travelMetres = 4;
    panel(value); const facts = screen.getByRole("region", { name: "漫游者原身体与往返预算" });
    for (const text of ["本人当前在诺拉原接待处START", "在本地原锚台PAD", "已实核校准", "尚未归还诺拉", "累计普通行程 4 米"]) expect(facts.textContent).toContain(text);
  });

  it("shows actual independent preflight confirmation and permits declining without travel or return mutation", async () => {
    const value = departureReady(), before = structuredClone(value), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并前往")); const confirm = screen.getByRole("region", { name: "漫游者离世前往确认" });
    expect(document.activeElement).toBe(within(confirm).getByRole("heading", { name: "是否前往同一异星原停泊舱？" }));
    for (const text of ["不提供真空免疫", "污染危险", "灵性至少18", "两片原供给", "90秒", "出程耗8灵性及1片", "精神−5、污染+2", "身体留在PAD", "回程另耗8灵性", "不能免费重试", "WN3-REMOTE-DOCK", "防护剩余 90 / 90 秒", "剩余 2 / 2 片", "可以暂不前往"]) expect(confirm.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled(); fireEvent.click(button("暂不前往，返回现场"));
    expect(screen.queryByRole("region", { name: "漫游者离世前往确认" })).toBeNull(); expect(document.activeElement).toBe(button("核对并前往"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("submits exactly the confirmed DEPART command once and never moves the renderer projection", async () => {
    const value = departureReady(), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.click(button("核对并前往")); fireEvent.click(button("确认承担风险并前往")); fireEvent.click(button("确认承担风险并前往"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "DEPART", caseId: "offworld-visit", confirm: true });
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before); expect(value.life.playerLocation).toBe("PAD");
  });

  it("invalidates unsubmitted departure when the same original supply changes", async () => {
    const value = departureReady(), { defaults, rerender, onCommand } = panel(value); await userEvent.click(button("核对并前往"));
    const changed = structuredClone(value); changed.life.energy.remaining = 1; changed.life.energy.spent = 1;
    changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "缺少出返两片原供给。";
    rerender(<WandererPanel {...defaults} value={changed} />);
    expect(screen.queryByRole("region", { name: "漫游者离世前往确认" })).toBeNull(); expect(button("核对并前往").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows failed departure at PAD with original packet still remote and costs intact", () => {
    const value = departureReady([action({ type: "RETURN_PLAYER", caseId: "offworld-visit" }, "本人普通4米返回START", "0行动 · 0灵性 · 4米")]);
    Object.assign(value.life.currentAttempt!, { failedDeparture: true, departureConfirmed: true, abilityTier: "FAILURE", spiritualitySpent: 8, energySpent: 1, mindLost: 5, pollutionAdded: 2 });
    value.life.energy.remaining = 1; value.life.energy.spent = 1; value.resources!.spirituality = 0;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const cost = screen.getByRole("region", { name: "漫游者本次尝试与代价" });
    for (const text of ["失败", "不能重骰", "已付灵性 8", "原片实耗 1", "身体留本地PAD", "污染实增 2", "不算能力成功"]) expect(cost.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "同一原封包与实际交接" }).textContent).toContain("原包仍在REMOTE");
    expect(button("本人普通4米返回START").disabled).toBe(false); fireEvent.click(button("本人普通4米返回START"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("keeps a real remote body, remaining protection and original return budget immediately visible", () => {
    const value = remote([action({ type: "RETURN_LOCAL", caseId: "offworld-visit" }, "使用原资源实际返回PAD", "0行动 · 8灵性 · 原片1 · 10秒")]);
    value.life.currentAttempt!.returnMarkerChecked = true; value.life.suit.protectionSeconds = 82; value.life.suit.remoteSeconds = 8; value.resources!.spirituality = 10;
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "漫游者原身体与往返预算" });
    for (const text of ["本人当前在异星原停泊舱REMOTE", "不会传回", "防护剩余 82 / 90 秒", "剩余 1 / 2 片", "已耗 1 片", "已在原舱核实", "页面等待不会自行扣秒", "零灵性不创造免费退路"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "漫游者当前目标" }).textContent).toContain("使用原资源实际返回PAD");
    expect(screen.getByRole("region", { name: "漫游者停止与实际收束" }).textContent).toContain("用原资源实际回程");
    fireEvent.click(button("使用原资源实际返回PAD")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("prioritizes checking the real return marker and taking the original packet before optional exposure", () => {
    const value = remote([action({ type: "WAIT_EXPOSURE", caseId: "offworld-visit" }, "主动等待"), action({ type: "CHECK_RETURN_MARKER", caseId: "offworld-visit" }, "核原回程标记"), action({ type: "RETURN_LOCAL", caseId: "offworld-visit" }, "立即用原资源返回")]);
    const { defaults, rerender, onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "漫游者当前目标" }).textContent).toContain("核原回程标记");
    const checked = structuredClone(value); checked.life.currentAttempt!.returnMarkerChecked = true;
    checked.actions[1] = action({ type: "TAKE_PACKET", caseId: "offworld-visit" }, "取同一原封包");
    rerender(<WandererPanel {...defaults} value={checked} />);
    expect(screen.getByRole("region", { name: "漫游者当前目标" }).textContent).toContain("取同一原封包");
    expect(button("立即用原资源返回").disabled).toBe(false); expect(onCommand).not.toHaveBeenCalled();
  });

  it("never enables a free remote return at zero spirituality or recommends waiting in place of a blocked return", () => {
    const reason = "剩原片1，但回程缺少8灵性；不能普通传回或补资源。";
    const value = remote([action({ type: "WAIT_EXPOSURE", caseId: "offworld-visit" }, "主动在异星等待10秒", "0行动 · 10秒"), action({ type: "RETURN_LOCAL", caseId: "offworld-visit" }, "用原资源实际回程", "0行动 · 8灵性 · 原片1", { enabled: false, reason })]);
    value.resources!.spirituality = 0; value.life.currentAttempt!.returnMarkerChecked = true;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "漫游者当前目标" }).textContent).toContain(reason); expect(button("用原资源实际回程").disabled).toBe(true);
    fireEvent.click(button("用原资源实际回程")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("requires separate optional sky confirmation and cancelling neither observes nor returns", async () => {
    const look = action({ type: "VIEW_HORIZON", caseId: "offworld-visit", confirm: true }, "选择查看异常天际", "0行动 · 2秒 · 精神−6 · 污染+3");
    const value = remote([look]), before = structuredClone(value), { onCommand } = panel(value); await userEvent.click(button("选择查看异常天际"));
    const review = screen.getByRole("region", { name: "漫游者查看天空确认" });
    for (const text of ["实际2秒", "精神−6、污染+3", "没有额外奖励", "观察可能带来危险", "可以不看天空", "不会自动回到本地"]) expect(review.textContent).toContain(text);
    fireEvent.click(button("不看天空，返回现场")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    await userEvent.click(button("选择查看异常天际")); fireEvent.click(button("确认查看并承担污染")); fireEvent.click(button("确认查看并承担污染"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(look.command); expect(value).toEqual(before);
  });

  it("preserves exposure, pollution, body death and carried originals at REMOTE without revival controls", () => {
    const value = remote(); value.resources!.health = 0; value.life.suit.protectionSeconds = 0; value.life.suit.remoteSeconds = 160; value.life.packet.location = "PLAYER";
    Object.assign(value.life.currentAttempt!, { remoteSeconds: 160, horizonViewed: true, exposureActions: 6, healthLost: 80, mindLost: 31, pollutionAdded: 3, stopped: true });
    const before = structuredClone(value), { onCommand } = panel(value);
    const facts = screen.getByRole("region", { name: "漫游者原身体与往返预算" });
    for (const text of ["异星原停泊舱REMOTE", "原身体已真实死亡", "不提供一键恢复", "防护剩余 0 / 90 秒"]) expect(facts.textContent).toContain(text);
    const cost = screen.getByRole("region", { name: "漫游者本次尝试与代价" });
    for (const text of ["异星实际耗时 160 秒", "防护不足的损伤动作 6 次", "健康实损 80", "污染实增 3"]) expect(cost.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /复活|恢复|免费回城/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("reports real return legs separately from ordinary metres without refilling spent originals", async () => {
    const value = activate(projection({ promoted: true, actions: [] }), "offworld-visit", attempt({ departureConfirmed: true, departed: true, returnedLocal: true, suitReturned: true, abilityTier: "SUCCESS", spiritualitySpent: 16, energySpent: 2, remoteSeconds: 18, elapsedSeconds: 36,
      playerMoves: [{ from: "PAD", to: "REMOTE", mode: "STAR_WANDERING", metres: null, seconds: 10, anchorCarried: false, suitCarried: true, packetCarried: false }, { from: "REMOTE", to: "PAD", mode: "STAR_WANDERING", metres: null, seconds: 10, anchorCarried: false, suitCarried: true, packetCarried: true }, { from: "PAD", to: "START", mode: "WALK", metres: 4, seconds: 4, anchorCarried: false, suitCarried: true, packetCarried: true }] }));
    value.life.suit.protectionSeconds = 72; value.life.suit.remoteSeconds = 18; value.life.suit.offworldLegs = 2; value.life.energy.remaining = 0; value.life.energy.spent = 2; value.life.packet.location = "PLAYER";
    const before = structuredClone(value); panel(value); await open("本次实际尝试与已付代价");
    const cost = screen.getByRole("region", { name: "漫游者本次尝试与代价" });
    for (const text of ["同一本体G离世转移10秒，不虚报普通行走距离", "普通4米、4秒", "已付灵性 16", "原片实耗 2", "已实际从REMOTE回PAD"]) expect(cost.textContent).toContain(text);
    const facts = screen.getByRole("region", { name: "漫游者原身体与往返预算" });
    for (const text of ["防护剩余 72 / 90 秒", "剩余 0 / 2 片", "实际离世段数 2", "余量不自动补充"]) expect(facts.textContent).toContain(text);
    expect(value).toEqual(before);
  });

  it("distinguishes a real archived original packet from an honest nonreturn record", () => {
    const value = activate(projection({ promoted: true, actions: [] }), "original-handoff", attempt({ recipientConsent: "GRANTED", packetRecordsChecked: true, recordsCompared: true, packetHanded: true }));
    value.life.playerLocation = "OFFICE"; value.life.packet.location = "OWNER_ARCHIVE"; value.life.packet.offworldLegs = 1;
    panel(value); const packet = screen.getByRole("region", { name: "同一原封包与实际交接" });
    for (const text of ["WN3-PACKET", "数量 1", "原封条完整", "PRIOR_RECORDED_DELIVERY", "埃利亚斯已实际接收同一原包归档", "已实际检查", "已实际比对", "不是解密未知宇宙秘密"]) expect(packet.textContent).toContain(text);
  });

  it("shows a true nonreturn statement with the sole packet still at REMOTE", async () => {
    const value = activate(projection({ promoted: true, actions: [] }), "original-handoff", attempt({ method: "ORDINARY", result: "ORDINARY", nonreturnFiled: true }));
    const before = structuredClone(value); panel(value); await open("本次实际尝试与已付代价");
    expect(screen.getByRole("region", { name: "同一原封包与实际交接" }).textContent).toContain("原包仍在REMOTE");
    const cost = screen.getByRole("region", { name: "漫游者本次尝试与代价" });
    expect(cost.textContent).toContain("已如实登记未取回原包，不是假称送达"); expect(cost.textContent).toContain("普通方法或如实未前往完成"); expect(value).toEqual(before);
  });

  it("keeps refusals, original anchor recovery and plain zero-resource return distinct", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "RETURN_ANCHOR", caseId: "original-handoff" }, "当面交还同一原锚", "0行动 · 0灵性")] }), "original-handoff", attempt({ ownerConsent: "DECLINED", recipientConsent: "DECLINED", stopped: true, anchorRecovered: true }));
    value.life.nora.willing = false; value.life.elias.willing = false; value.life.anchor.location = "PLAYER"; value.resources!.spirituality = 0; value.resources!.actionsRemaining = 0;
    const before = structuredClone(value), { onCommand } = panel(value), scene = screen.getByRole("region", { name: "漫游者原人原物与真实位置" });
    for (const text of ["已拒绝本次用途", "诺拉当前不愿继续", "埃利亚斯当前不愿接收"]) expect(scene.textContent).toContain(text);
    expect(button("当面交还同一原锚").disabled).toBe(false); fireEvent.click(button("当面交还同一原锚")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it.each([
    [{ type: "PREPARE", caseId: "anchor-check", method: "ABILITY" }, "准备核对原锚", "1行动 · 另留1行动实施"],
    [{ type: "PERFORM", caseId: "anchor-check" }, "开始原锚现场", "1行动"],
    [{ type: "REPORT", caseId: "anchor-check" }, "报告原锚结果", "1行动"],
  ] as const)("keeps outer AP steps distinct and forwards exact intents: %j", (command, label, cost) => {
    const value = projection({ promoted: true, actions: [action(command, label, cost)] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(button(label).textContent).toContain(cost); fireEvent.click(button(label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it.each([
    [{ type: "TAKE_ANCHOR", caseId: "anchor-check" }, "取同一原航标"],
    [{ type: "PLACE_ANCHOR", caseId: "anchor-check" }, "放置同一原航标"],
    [{ type: "READ_COORDINATES", caseId: "anchor-check" }, "读两已有原记录"],
    [{ type: "ALIGN_ANCHOR", caseId: "anchor-check" }, "尝试一次有限定位"],
    [{ type: "MANUAL_ALIGN", caseId: "anchor-check" }, "人工校准原航标"],
    [{ type: "BORROW_SUIT", caseId: "offworld-visit" }, "借同一原护具"],
    [{ type: "CHECK_SUIT", caseId: "offworld-visit" }, "实查同一原护具"],
    [{ type: "CHECK_DEPARTURE", caseId: "offworld-visit" }, "实查当前信号与回程"],
    [{ type: "CHECK_RETURN_MARKER", caseId: "offworld-visit" }, "核原舱回程标记"],
    [{ type: "TAKE_PACKET", caseId: "offworld-visit" }, "取同一原封包"],
    [{ type: "RETURN_SUIT", caseId: "offworld-visit" }, "归还同一原护具"],
    [{ type: "WAIT_EXPOSURE", caseId: "offworld-visit" }, "主动等待10秒"],
    [{ type: "CONSENT_RECIPIENT", caseId: "original-handoff" }, "问原归档人是否受理"],
    [{ type: "CHECK_PACKET_RECORDS", caseId: "original-handoff" }, "核封条和出返记录"],
    [{ type: "COMPARE_RECORDS", caseId: "original-handoff" }, "定位比对两原记录"],
    [{ type: "MANUAL_COMPARE", caseId: "original-handoff" }, "人工比对两原记录"],
    [{ type: "HAND_PACKET", caseId: "original-handoff" }, "交同一原包归档"],
    [{ type: "FILE_NONRETURN", caseId: "original-handoff" }, "如实提交未取回说明"],
    [{ type: "GO_ANCHOR", caseId: "original-handoff" }, "实际4米去原锚处"],
    [{ type: "RECOVER_ANCHOR", caseId: "original-handoff" }, "在PAD取回原锚"],
    [{ type: "RETURN_PACKET", caseId: "original-handoff" }, "普通退还同一原包"],
    [{ type: "STOP_CONTACT", caseId: "offworld-visit" }, "停止本次工作"],
    [{ type: "INSPECT", caseId: "original-handoff" }, "检查原人原物去向"],
    [{ type: "CLOSE", caseId: "original-handoff" }, "关闭已实际收束现场"],
    [{ type: "WITHDRAW", caseId: "anchor-check" }, "如实放弃本次工作"],
  ] as const)("forwards a saved physical substep exactly once without doing it in the view: %j", (command, label) => {
    const value = activate(projection({ promoted: true, actions: [action(command, label, "0行动 · 真实成本") ] }), command.caseId), before = structuredClone(value), { onCommand } = panel(value);
    fireEvent.click(button(label)); fireEvent.click(button(label)); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(onCommand.mock.calls[0]![0]).toBe(command); expect(value).toEqual(before);
  });

  it("folds optional new combat away from life and does not start it by opening facts", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "前往原卡西安处交谈", "1行动 · 另留开战1行动");
    const value = projection({ promoted: true, actions: [talk, action({ type: "OBSERVE", caseId: "anchor-check" }, "观察原航标", "1行动")] }), before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("新原人的可选冲突").open).toBe(false); expect(screen.getByRole("region", { name: "漫游者当前目标" }).textContent).toContain("观察原航标");
    await open("新原人的可选冲突"); expect(onCommand).not.toHaveBeenCalled(); expect(button("前往原卡西安处交谈").closest("details")).toBe(fold("新原人的可选冲突"));
    fireEvent.click(button("前往原卡西安处交谈")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(talk.command); expect(value).toEqual(before);
  });

  it("shows independent Cassian, actual rod and local round-trip movement without interstellar damage", async () => {
    const value = projection({ promoted: true, actions: [action({ type: "LEAVE_ENCOUNTER" }, "沿原普通出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.scene!.clearanceConfirmed = true;
    const before = structuredClone(value), { onCommand } = panel(value), scene = screen.getByRole("region", { name: "漫游者原人遭遇" });
    for (const text of ["卡西安·格里夫", "49岁", "WN3-CASSIAN", "健康 90", "精神 100", "独立灵性 103 / 120", "WN3-CASSIAN-ROD", "仍在原人手中", "旧半神B分别保存", "本人当前仍在原位置", "无追逐"]) expect(scene.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前漫游者生活情境" })).toBeNull(); await open("本场范围与战斗代价");
    for (const text of ["实际侧移1米再回1米", "减势36", "自身优势30，不直接伤人", "只有继承小电击或普通攻击", "旧实际掌握", "不消耗或复制旧记录库", "没有任意星空打击目标"]) expect(scene.textContent).toContain(text);
    fireEvent.click(button("沿原普通出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(value).toEqual(before);
  });

  it("closing the view never returns a remote body, original packet or original suit", () => {
    const value = remote(); value.life.packet.location = "PLAYER"; const before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button("关闭漫游者页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it("adapts the authored formula and source paragraphs without mutating the projection", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "漫游者成品与配方边界" });
    expect(within(formula).getByText("漫游者为门途径序列3，本体漫游可以离开灵界；完整配方尚未掌握，服用前需要专业准备。材料、用量、调配顺序及完整仪式保持未知，仍须完成服药准备。本阶段只采用独立成品渠道与专业指导；三项准备和当次场地检查均须实际完成，不复用秘法师4的旧敌意半神封印仪式，不开放自制配方。")).toBeTruthy();
    expect(within(formula).queryByText(WANDERER_FORMULA_STATUS)).toBeNull();
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "漫游者能力与使用范围" });
    expect(within(scope).getByText("序列3漫游者可脱离灵界限制，进入星空、星界和异星，但天使以下仍面临星空污染危险；这不等于真空免疫或安全保证。当前渠道只提供独立成品与专业准备，不提供完整配方。本阶段仅开放指定原端点，须分别满足防护、供给、回程、携带与灵性条件；星界定位只辅助核对已确认的有限端点，不是全知导航、占星或凭空获得宇宙知识。下一序列2为旅法师、序列1为星之匙；序列2的三类虫与九处外星传说仪式、象征化及序列0概念化均不在3阶开放。")).toBeTruthy();
    expect(within(scope).queryByText(WANDERER_SOURCE_STATUS)).toBeNull();
    expect(value).toEqual(before);
  });

});

describe("Wanderer exact continuity copy", () => {
  it("keeps saved deaths and original identities unchanged while hiding the audit mode", () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    const goal = screen.getByRole("region", { name: "漫游者当前目标" });
    expect(within(goal).getByText("晋升不会复活旧死亡档，也不会改写已有原身体、原物与实际经历。", { exact: true })).toBeTruthy();
    expect(within(goal).queryByText("本阶段验证来源：明确定向S4前缀后继续公开命令（DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER），不是从普通人自然通关；原两个自然死亡档保留。", { exact: true })).toBeNull();
    expect(goal.textContent).not.toContain("DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER");
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
