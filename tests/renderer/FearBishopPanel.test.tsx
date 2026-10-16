/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FearBishopPanel, type FearBishopPanelProps } from "../../src/renderer/FearBishopPanel";
import type { FearBishopAction, FearBishopCommand, FearBishopProjection } from "../../src/domain/fear-bishop/types";
import { FEAR_BISHOP_CONSUMPTION_RISK } from "../../src/domain/fear-bishop/content";

type Attempt = NonNullable<FearBishopProjection["life"]["currentAttempt"]>;
type CaseId = FearBishopProjection["life"]["cases"][number]["id"];
function action(command: FearBishopCommand, label: string, cost = "0行动", extra: Partial<FearBishopAction> = {}): FearBishopAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取恐惧主教专业指导", "1行动 · 500便士");
const consume = (id = "fear-bishop-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶");
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 86, method: "ABILITY", closed: false, result: "NONE", elapsedSeconds: 0, playerTravelMetres: 0,
    spiritualitySpent: 0, mindSpent: 0, consent: "UNASKED", consentWeek: null, ownerConsent: "UNASKED", ownerConsentWeek: null,
    abilityTier: null, sourceRead: false, residuePlaced: false, bystandersClear: false, residueSealed: false, containerReturned: false,
    stopAgreed: false, stoppedBy: null, wakeConfirmed: false, volunteerLeft: false, ordinaryStory: false,
    sideRouteChecked: false, route: null, lampTaken: false, lampReturned: false, inspected: false, ...extra };
}
function life(): FearBishopProjection["life"] {
  return { title: "有限黑暗毁灭与真实退出", story: "三项原创G实践", environment: "原库廊8米，普通侧路12米。",
    activeCase: null, inside: false, insideCase: false, reflected: false, clockSeconds: 0, playerLocation: "EXIT", playerTravelMetres: 0,
    edith: { id: "FB3-EDITH", name: "伊迪丝", age: 46, alive: true, willing: true, location: "EXIT" },
    tomas: { id: "FB3-TOMAS", name: "托马斯", age: 34, alive: true, willing: true, health: 100, mind: 100, state: "AWAKE", location: "CHAIR", effectActive: false, remainingSeconds: 0, travelMetres: 0 },
    residue: { id: "FB3-RESIDUE-1", owner: "FB3-EDITH", source: "原封存记录FB3-REGISTER-1：已结束梦术试验的唯一无意识凝片，原创G。", alive: false, conscious: false, status: "CONTAINED", location: "CONTAINER" },
    container: { id: "FB3-GLASS-1", owner: "FB3-EDITH", location: "OWNER" },
    trace: { id: "FB3-TRACE-1", source: "原库房记录FB3-REGISTER-2：唯一弱梦术痕迹，原创G。", alive: false, conscious: false, status: "PRESENT" },
    lamp: { id: "FB3-LAMP", owner: "FB3-EDITH", location: "STORE" }, shutter: { id: "FB3-SHUTTER", location: "RAISED" },
    sideRouteChecked: false, currentAttempt: null, actions: [],
    cases: ([
      { id: "contained-residue", title: "有来源凝片的有限毁弃", story: "先读原记录、问物主当次许可，放到原台并撤开旁人。" },
      { id: "stop-signal", title: "由本人说出的停止口令", story: "托马斯当次知情自愿后，先约定停止口令。" },
      { id: "corridor-exit", title: "原灯与两条可走的出口", story: "先查实际侧路，再到廊口，走原路取还原灯。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): FearBishopProjection["encounter"] {
  return { title: "原庭与独立的哈兰", story: "2米净空原庭，实际普通出口开放，无追逐。", status: "AVAILABLE", inside: false,
    enemy: { id: "FB3-HARLAN", name: "哈兰", age: 48, source: "ORIGINAL_OPEN_COURT_ADULT", sequence: 3,
      health: 90, mind: 100, spirituality: 103, status: "RESISTING", weaponId: "FB3-HARLAN-CLUB", weaponLocation: "HAND", powerUses: { DARK_BOLT: 1, WARD: 2, FOCUS: 1 } },
    actions: [], facts: ["实际普通出口开放，无追逐。", "本轮专注可以抵抗有限压力。"] };
}
/** Public renderer fixture only; it is not domain eligibility or a natural gameplay replay. */
function projection(extra: Partial<FearBishopProjection> = {}): FearBishopProjection {
  return { title: "恐惧主教3 · 有限黑暗毁灭与安眠恐惧", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "有限原凝片与睡恐压力均为G。", supplies: "三瓶独立成品各6200便士，或各五次劳务后800便士。",
    actions: [guidance()], bottles: [1, 2, 3].map(n => ({ id: `fear-bishop-potion-${n}`, title: `恐惧主教第${n}独立原瓶`,
      source: `独立序列3渠道第${n}原瓶，封签FB3-SEAL-${n}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `fear-bishop-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "CHECK_RESIDUE", title: "原残留来源核对", completedWeek: 82 },
      { taskId: "AGREE_STOP", title: "停止口令演练", completedWeek: 83 }, { taskId: "PLAN_EXIT", title: "实际普通出口核对", completedWeek: 83 }],
    preparedWeek: 84, abilities: [{ id: "darkness.s3.dark-dissolution", label: "有限黑暗毁灭（G）", mastery: 8, description: "一次只作用于已核原弱残留。" },
      { id: "darkness.s3.sleep-fear", label: "有限安眠恐惧（G）", mastery: 0, description: "本次同意后的有限压力。" }],
    acting: 0, digestion: "原守夜人消化100，从第68周晋升已过12整周。", pollution: 3, risk: FEAR_BISHOP_CONSUMPTION_RISK,
    resources: { health: 70, maxHealth: 100, mind: 85, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE", inheritedHistory: ["旧布拉姆NW4-BRAM已DEAD，健康0，原棍留YARD。", "同一SW5-LEAF-1仍SEALED，原派出10次、召回10次，释放及再邀请史保留。", "梅森和伊尔瓦当前清醒，旧原纸原车均保留。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原库房、原隔离台和实际普通出口。", ...extra };
}
function activate(value: FearBishopProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function panel(value = projection(), props: Partial<Omit<FearBishopPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<FearBishopPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("FearBishopPanel saved original objects, current consent and ordinary exit", () => {
  it("leads with real readiness and resources, folding detailed rules and hiding unknown recipe materials", () => {
    const reason = "从原守夜人晋升起仅11/12整周，须等下一真实周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应出现的假材料", quantity: 3, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "恐惧主教当前目标" }).textContent).toContain(reason);
    expect(button("听取恐惧主教专业指导").disabled).toBe(true);
    expect(button("听取恐惧主教专业指导").getAttribute("aria-describedby")).toContain("fear-bishop-reason-");
    const resources = screen.getByRole("region", { name: "恐惧主教当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["70 / 100", "85 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(screen.queryByText("不应出现的假材料")).toBeNull();
    for (const title of ["独立成品与晋升准备", "原身体、旧布拉姆与原卷叶", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    fireEvent.click(button("听取恐惧主教专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("keeps finite darkness, independent preparation, angel-scale limits and saved old deaths or leaf history", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    await open("独立成品与晋升准备");
    const boundary = screen.getByRole("region", { name: "恐惧主教成品与配方边界" });
    for (const text of ["序列3恐惧主教", "黑暗毁灭不等于隐秘权柄", "12整周", "原消化100", "初晋者不能全图必中", "仍有减缓与反制", "不提供全场即死", "6200", "800", "第82周", "指导500便士", "三项不同准备各1行动", "1行动及120便士", "五次真实劳务", "当前渠道不提供完整配方", "晋升仍须完成专业准备"]) expect(boundary.textContent).toContain(text);
    await open("原身体、旧布拉姆与原卷叶");
    const history = screen.getByRole("region", { name: "恐惧主教继承记录" });
    for (const text of ["女性", "NW4-BRAM已DEAD", "原棍留YARD", "SW5-LEAF-1仍SEALED", "原派出10次", "召回10次", "梅森和伊尔瓦当前清醒"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects one independent bottle and emits its exact original labour intent without mutating it", async () => {
    const commands: FearBishopCommand[] = [{ type: "POTION_WORK", bottleId: "fear-bishop-potion-1" }, { type: "POTION_WORK", bottleId: "fear-bishop-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}瓶劳动`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立恐惧主教原瓶" }), "fear-bishop-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶劳动/ })).toBeNull(); fireEvent.click(button("第2瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews only one original bottle, risk and actual resources, then cancels with Escape and restores focus", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用"));
    const review = screen.getByRole("region", { name: "恐惧主教原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "恐惧主教第1独立原瓶" }));
    for (const text of ["fear-bishop-potion-1", "FB3-SEAL-1", "71%", "第84周", "成功或失败", "性别不改变", "当前灵性不补满", "普通死亡", "0行动"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("FB3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "恐惧主教原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("submits one confirmed intent and keeps it locked through failed save until a changed committed projection arrives", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    rerender(<FearBishopPanel {...defaults} error={{ message: "服药写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "恐惧主教原瓶服用确认" })).toBeTruthy();
    rerender(<FearBishopPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.actions = [];
    saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<FearBishopPanel {...defaults} value={saved} />);
    expect(screen.queryByRole("region", { name: "恐惧主教原瓶服用确认" })).toBeNull();
    expect(button("关闭恐惧主教页面").disabled).toBe(false); expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });

  it("invalidates an unsubmitted review when the original cost or resource facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    for (const changed of [{ ...value, actions: [{ ...consume(), cost: "新增实际成本" }] }, { ...value, resources: { ...value.resources!, spirituality: 41 } }]) {
      rerender(<FearBishopPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用"));
      rerender(<FearBishopPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "恐惧主教原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with its authoritative blocker", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<FearBishopPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "原现场尚未收束。" }] }} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true);
    expect(button("确认服用这一原瓶").getAttribute("aria-describedby")).toBe("fear-bishop-confirm-reason");
    expect(screen.getByRole("region", { name: "恐惧主教原瓶服用确认" }).textContent).toContain("原现场尚未收束");
    fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "写入失败" }, { error: { message: "版本冲突", retryable: false } }])("locks commands, selectors and dismissal during pending recovery: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    expect(button("听取恐惧主教专业指导").disabled).toBe(true); expect(button("关闭恐惧主教页面").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择独立恐惧主教原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("听取恐惧主教专业指导")); fireEvent.click(button("关闭恐惧主教页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (typeof props.error === "object") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
  });

  it("selects a case without starting it and sends only that case's public action", async () => {
    const commands: FearBishopCommand[] = [{ type: "OBSERVE", caseId: "contained-residue" }, { type: "OBSERVE", caseId: "stop-signal" }, { type: "OBSERVE", caseId: "corridor-exit" }];
    const value = projection({ promoted: true, actions: commands.map((command, i) => action(command, `观察第${i + 1}案`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择恐惧主教生活情境" }), "stop-signal");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察第1案/ })).toBeNull();
    expect(screen.getByRole("region", { name: "托马斯本次同意与原身体" }).textContent).toContain("尚无本次已保存同意");
    fireEvent.click(button("观察第2案")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it("shows the actual residue source while requiring unread record, current permission and placement separately", () => {
    const command: FearBishopCommand = { type: "READ_SOURCE", caseId: "contained-residue" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲自读原封存记录"), action({ type: "DISSOLVE", caseId: "contained-residue" }, "有限毁弃原凝片", "6灵性", { enabled: false, reason: "须来源、本次许可、原件放置和旁人撤开。" })] }), "contained-residue");
    const before = structuredClone(value), { onCommand } = panel(value);
    const original = screen.getByRole("region", { name: "唯一原凝片与原玻璃容器" });
    for (const text of ["FB3-RESIDUE-1", "FB3-REGISTER-1", "无生命、无独立意识", "尚未亲自读取", "尚未放入", "尚未确认旁人撤开", "FB3-GLASS-1"]) expect(original.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "恐惧主教原人原物与普通退路" }).textContent).toContain("本次尚未当面询问");
    expect(button("有限毁弃原凝片").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择恐惧主教生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("亲自读原封存记录")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps a successfully dissolved original gone and the empty borrowed container pending actual return", () => {
    const command: FearBishopCommand = { type: "RETURN_CONTAINER", caseId: "contained-residue" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲手归还原空容器")] }), "contained-residue", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 86, sourceRead: true, residuePlaced: true, bystandersClear: true, abilityTier: "SUCCESS", result: "ABILITY", spiritualitySpent: 6, playerTravelMetres: 4 }));
    value.life.residue.status = "DISSOLVED"; value.life.residue.location = "NONE"; value.life.container.location = "PLAYER";
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    const original = screen.getByRole("region", { name: "唯一原凝片与原玻璃容器" });
    for (const text of ["已真实消散，不可恢复", "FB3-GLASS-1", "当前在本人手中", "归还空容器"]) expect(original.textContent).toContain(text);
    expect(original.textContent).not.toContain("本次原容器已亲手归还");
    fireEvent.click(button("关闭恐惧主教页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("亲手归还原空容器")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(original.textContent).toContain("当前在本人手中"); expect(value).toEqual(before);
  });

  it("keeps a failed attempt, its paid cost and the same residue while offering zero-resource ordinary sealing", () => {
    const command: FearBishopCommand = { type: "SEAL_RESIDUE", caseId: "contained-residue" };
    const value = activate(projection({ promoted: true, actions: [action(command, "把同一原凝片普通封回")] }), "contained-residue", attempt({ abilityTier: "FAILURE", spiritualitySpent: 6, sourceRead: true, residuePlaced: true, bystandersClear: true, ownerConsent: "GRANTED", elapsedSeconds: 21, playerTravelMetres: 2 }));
    value.life.residue.status = "ON_BENCH"; value.life.residue.location = "BENCH"; value.life.playerLocation = "BENCH"; value.life.container.location = "PLAYER";
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0, mind: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const cost = screen.getByRole("region", { name: "恐惧主教本次尝试与代价" });
    for (const text of ["唯一能力判定：失败", "不能重骰", "已付灵性 6", "实际经过 21 秒", "普通行走 2 米"]) expect(cost.textContent).toContain(text);
    expect(cost.textContent).not.toContain("实际能力完成"); expect(button("把同一原凝片普通封回").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "恐惧主教停止与普通收束" }).contains(button("把同一原凝片普通封回"))).toBe(true);
    fireEvent.click(button("把同一原凝片普通封回")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it.each(["PLAYER", "TOMAS"] as const)("preserves current consent, real M2 cost and active pressure until the %s stop intent commits", actor => {
    const command: FearBishopCommand = { type: "STOP", caseId: "stop-signal", actor };
    const value = activate(projection({ promoted: true, actions: [action(command, "现在停止本次压力")] }), "stop-signal", attempt({ consent: "GRANTED", consentWeek: 86, stopAgreed: true, abilityTier: "SUCCESS", result: "ABILITY", spiritualitySpent: 5, mindSpent: 2 }));
    value.life.tomas.mind = 98; value.life.tomas.state = "DROWSY"; value.life.tomas.effectActive = true; value.life.tomas.remainingSeconds = 4;
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const person = screen.getByRole("region", { name: "托马斯本次同意与原身体" });
    for (const text of ["FB3-TOMAS", "34岁成年人", "精神 98 / 100", "已当面同意本次有限用途", "到此为止", "剩余 4 秒", "须实际醒来", "精神不免费返还", "不默认对不知情的人练习"]) expect(person.textContent).toContain(text);
    expect(button("现在停止本次压力").disabled).toBe(false);
    fireEvent.click(button("现在停止本次压力")); fireEvent.click(button("现在停止本次压力"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(person.textContent).toContain("剩余 4 秒"); expect(value).toEqual(before);
  });

  it("shows stopped pressure separately from an unwoken body and does not refund M2 or invent an exit", () => {
    const command: FearBishopCommand = { type: "WAKE", caseId: "stop-signal" };
    const value = activate(projection({ promoted: true, actions: [action(command, "实际唤醒托马斯"), action({ type: "SLEEP_FEAR", caseId: "stop-signal" }, "再次施压", "5灵性", { enabled: false, reason: "本次同意撤回，不得再次施压。" })] }), "stop-signal", attempt({ consent: "REVOKED", consentWeek: 86, stopAgreed: true, stoppedBy: "TOMAS", abilityTier: "SUCCESS", result: "ABILITY", spiritualitySpent: 5, mindSpent: 2 }));
    value.life.tomas.mind = 98; value.life.tomas.state = "DROWSY"; value.life.tomas.willing = false;
    const before = structuredClone(value), { onCommand } = panel(value);
    const person = screen.getByRole("region", { name: "托马斯本次同意与原身体" });
    for (const text of ["本次同意已撤回", "精神 98 / 100", "原身体仍困倦", "已经停止", "托马斯本人实际叫停", "尚未当面确认清醒", "尚无本次离场完成记录"]) expect(person.textContent).toContain(text);
    expect(button("再次施压").disabled).toBe(true); fireEvent.click(button("再次施压")); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("实际唤醒托马斯")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(person.textContent).toContain("原身体仍困倦"); expect(value).toEqual(before);
  });

  it.each(["CORRIDOR", "SIDE"] as const)("shows the saved %s journey, original lamp and trace outcome while sending an actual ordinary return", route => {
    const command: FearBishopCommand = { type: "RETURN_PLAYER", caseId: "corridor-exit" };
    const success = route === "CORRIDOR";
    const value = activate(projection({ promoted: true, actions: [action(command, "携原灯沿实际来路返回")] }), "corridor-exit", attempt({ ownerConsent: "GRANTED", ownerConsentWeek: 86, sideRouteChecked: true, route, lampTaken: true, abilityTier: success ? "SUCCESS" : "FAILURE", result: "NONE", spiritualitySpent: 6, playerTravelMetres: success ? 9 : 13, elapsedSeconds: 31 }));
    value.life.playerLocation = "STORE"; value.life.lamp.location = "PLAYER"; value.life.trace.status = success ? "DISSOLVED" : "ISOLATED";
    value.life.shutter.location = success ? "RAISED" : "LOWERED"; value.life.sideRouteChecked = true;
    value.resources = { ...value.resources!, actionsRemaining: 0, spirituality: 0 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const original = screen.getByRole("region", { name: "原灯与八米十二米实际路径" });
    for (const text of ["FB3-LAMP", "FB3-EDITH", "当前在本人手中", "FB3-TRACE-1", "FB3-REGISTER-2", "原廊8米", "原普通侧路12米", "已亲自检查", "本次尚无原灯归还完成记录", "普通黑暗本身不是邪恶"]) expect(original.textContent).toContain(text);
    expect(original.textContent).toContain(success ? "本次实际路线：8米原廊" : "本次实际路线：12米普通侧路");
    expect(original.textContent).toContain(success ? "已真实消散" : "原痕迹仍在，已用原遮板隔离");
    if (!success) { expect(original.textContent).toContain("已经实际放下"); expect(fold("本次实际尝试与已付代价").open).toBe(true); }
    expect(button("携原灯沿实际来路返回").disabled).toBe(false); fireEvent.click(button("携原灯沿实际来路返回"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("shows the independent injured Harlan, original weapon and ordinary exit without reviving Bram or granting a spirit", async () => {
    const command: FearBishopCommand = { type: "LEAVE_ENCOUNTER" };
    const value = projection({ promoted: true, actions: [action(command, "沿原出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY";
    const before = structuredClone(value), { onCommand } = panel(value);
    await open("本场范围与战斗代价");
    const original = screen.getByRole("region", { name: "恐惧主教原人遭遇" });
    for (const text of ["哈兰", "48岁", "FB3-HARLAN", "健康 90", "精神 100", "独立灵性 103", "FB3-HARLAN-CLUB", "仍在原人手中", "旧布拉姆分别保存", "普通出口开放", "专注可以抵抗", "同一个原卷叶", "普通动作回退"]) expect(original.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前恐惧主教生活情境" })).toBeNull();
    fireEvent.click(button("沿原出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });
});


describe("FearBishopPanel exact authored display paragraphs", () => {
  it("renders the reviewed full copy without mutating supplied originals or dispatching", () => {
    const value = projection({ promoted: true, actions: [] }), before = structuredClone(value), { container, onCommand } = panel(value);
    const paragraphs = Array.from(container.querySelectorAll("p"), node => node.textContent ?? "");
    for (const [source, expected] of [
      ["恐惧主教3及安眠、恐惧结合的黑暗毁灭方向已核实；这里的有限场景与参数为本作G，完整配方与晋升仪式仍未知。", "恐惧主教3可将安眠与恐惧结合，产生有限黑暗毁灭效果；场景与参数以当前说明为准。当前渠道不提供完整配方，晋升仍须完成专业准备。"],
      ["黑暗序列3恐惧主教的安眠、恐惧结合与黑暗毁灭方向已核实。黑暗毁灭不等于隐秘权柄。下一阶隐秘之仆2的编号仍按人物线索推断，不展示未知完整配方或晋升仪式。", "黑暗序列3恐惧主教可将安眠与恐惧结合，产生有限黑暗毁灭效果。黑暗毁灭不等于隐秘权柄。下一阶隐秘之仆2仍须另行晋升；当前渠道不提供完整配方，晋升仍须完成专业准备。"],
      ["阿里安娜历史投影的黑潮属于天使表现，不能下放为初晋全图必中。原著存在减缓与反制；这里不据表现补出全场即死。残留凝片、短时压力与原廊痕迹均为有限原创G。", "初晋者不能全图必中；黑暗毁灭仍有减缓与反制，不提供全场即死。残留凝片、短时压力与原廊痕迹按当前有限说明结算。"],
    ] as const) {
      expect(paragraphs.some(text => text === expected || (expected.startsWith("。") && text.endsWith(expected)))).toBe(true);
      expect(paragraphs.join("\n")).not.toContain(source);
    }
    expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
