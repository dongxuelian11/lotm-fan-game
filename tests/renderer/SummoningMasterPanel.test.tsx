/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummoningMasterPanel, type SummoningMasterPanelProps } from "../../src/renderer/SummoningMasterPanel";
import type { SummoningMasterAction, SummoningMasterCommand, SummoningMasterProjection } from "../../src/domain/summoning-master/types";
import { SUMMONING_MASTER_CONSUMPTION_RISK } from "../../src/domain/summoning-master/content";

type Attempt = NonNullable<SummoningMasterProjection["life"]["currentAttempt"]>;
type CaseId = SummoningMasterProjection["life"]["cases"][number]["id"];
function action(command: SummoningMasterCommand, label: string, cost = "0行动", extra: Partial<SummoningMasterAction> = {}): SummoningMasterAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取召唤大师专业指导", "1行动 · 500便士");
const consume = (id = "summoning-master-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶");
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 96, method: "ABILITY", closed: false, result: "NONE", elapsedSeconds: 0,
    ownerTravelMetres: 0, guestTravelMetres: 0, homeVisits: 0, consent: "UNASKED", consentWeek: null,
    ownerConsent: false, gateTier: null, cooperationTier: null, guestArrived: false, arrivalMethod: null,
    identityChecked: false, tokenTaken: false, tokenDelivered: false, tokenReturned: false, guestAtTable: false,
    interruptionObserved: false, gateInterrupted: false, guestReturned: false, inspected: false,
    spiritualitySpent: 0, guestStaminaSpent: 0, ...extra };
}
function life(): SummoningMasterProjection["life"] {
  return { title: "一位原来客与有限门", story: "三项原创G实践", environment: "原暖房和小院相距30米，有普通小径。",
    activeCase: null, inside: false, insideCase: false, reflected: false, clockSeconds: 0,
    playerLocation: "YARD", playerTravelMetres: 0,
    partner: { id: "SM3-LUMEN", name: "流灯", source: "原巫王导师格蕾丝提供可核联系方式；已有原居处的原创G成年独立来客。",
      adult: true, independentMind: true, bodyId: "SM3-LUMEN-BODY", homeId: "SM3-GLASS-ROOM", location: "HOME",
      health: 93, mind: 84, stamina: 66, status: "ALIVE", willing: true, metWeek: null, ordinaryDistanceM: 0, gateCrossings: 0,
      chime: { id: "SM3-CHIME", owner: "SM3-LUMEN" }, restHistory: [] },
    gate: { status: "CLOSED", remainingSeconds: 0, from: "HOME", to: "YARD" },
    token: { id: "SM3-TEST-TOKEN", owner: "SM3-ADA39", massGrams: 200, custodian: "SM3-ADA39", location: "OWNER" },
    ada: { id: "SM3-ADA39", name: "艾达", age: 39, alive: true, willing: true, location: "YARD" },
    shutter: { id: "SM3-SHUTTER", location: "RAISED" }, currentAttempt: null, actions: [],
    inheritedPapers: (["CONSUMED", "PREPARED", "HELD"] as const).map((status, i) => ({ id: `WK4-PAPER-1-${i + 1}`, batch: 1, source: `原巫王已购第一批第${i + 1}张`, purchasedWeek: 84, status,
      preparedWeek: status === "HELD" ? null : status === "PREPARED" ? 91 : 89, consumedWeek: status === "CONSUMED" ? 89 : null, consumedBy: status === "CONSUMED" ? "PAPER_TRIAL" : null, combatRound: null })),
    cases: ([
      { id: "source-visit", title: "原居处与一位真实来客", story: "先亲自普通行走30米，到原居处见同一流灯，再问本次邀请。" },
      { id: "original-token", title: "艾达的同一块二百克牌", story: "本次当面同意后借同一原牌，只送至三米外原桌。" },
      { id: "interrupted-door", title: "门断以后仍在场的原身体", story: "提前告知后放下原遮板，仍须普通小径送回原身体。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null,
      contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function encounter(): SummoningMasterProjection["encounter"] {
  return { title: "埃德温的独立通路争议", story: "净空原石院，双方相距2米，普通出口开放，无追逐。", status: "AVAILABLE", inside: false,
    enemy: { id: "SM3-EDWIN", name: "埃德温", age: 46, source: "ORIGINAL_STONE_COURT_ADULT", sequence: 3, health: 91, mind: 88, spirituality: 103,
      status: "RESISTING", weaponId: "SM3-EDWIN-CLUB", weaponLocation: "HAND", powerUses: { DARK_BOLT: 1, WARD: 3, DISRUPT: 2 } },
    guestPolicy: "HOME", guestPermit: null, gateOpen: false, actions: [], facts: ["普通出口开放，无追逐。"] };
}
/** Public UI fixture only. It is not a natural replay or proof of domain eligibility. */
function projection(extra: Partial<SummoningMasterProjection> = {}): SummoningMasterProjection {
  return { title: "召唤大师3 · 一位真实来客与可中断的门", discovered: true, guidanceKnown: true, promoted: false,
    formulaKnown: false, formula: [], story: "名称已核实；本场来客与有限门为原创G。", supplies: "三瓶独立原瓶6200便士，或各五次劳务后800便士。",
    actions: [guidance()], bottles: [1, 2, 3].map(n => ({ id: `summoning-master-potion-${n}`, title: `召唤大师第${n}独立原瓶`,
      source: `独立序列3渠道第${n}原瓶，封签SM3-SEAL-${n}`, status: "已取得，尚未服用", chance: 71,
      command: { type: "CONSUME" as const, bottleId: `summoning-master-potion-${n}`, confirmed: true as const } })),
    preparations: [
      { taskId: "INSPECT_SOURCE", title: "原联系来源核对", completedWeek: 93 },
      { taskId: "CHECK_RETURN", title: "普通返回路线核对", completedWeek: 94 },
      { taskId: "PLAN_WITHDRAWAL", title: "关门与撤离演练", completedWeek: 94 },
    ], preparedWeek: 95,
    abilities: [{ id: "moon.s3.bounded-summoning", label: "有限召唤之门（G）", mastery: 0, description: "仅连两原地、40秒。" },
      { id: "moon.s3.guest-cooperation", label: "来客有限合作（G）", mastery: 8, description: "同一来客本次同意后移动同一原牌。" }],
    acting: 0, digestion: "原巫王消化100，从第83周晋升已过12整周。", pollution: 3, risk: SUMMONING_MASTER_CONSUMPTION_RISK,
    resources: { health: 83, maxHealth: 100, mind: 77, maxMind: 100, spirituality: 42, maxSpirituality: 120, cash: "905便士", actionsRemaining: 1 },
    currentGender: "FEMALE", inheritedHistory: ["旧多里安WK4-DORIAN42仍活着，健康70、重伤投降，原棍WK4-DORIAN-CLUB留YARD。", "原纸WK4-PAPER-1-1已耗、WK4-PAPER-1-2仍PREPARED、WK4-PAPER-1-3仍HELD。", "原泥靶BROKEN，原伊尔玛与格蕾丝仍是原人。"],
    life: life(), encounter: encounter(), insideCase: false, environment: "原私人仪式厅旁暖房及小石院，30米实际普通小径。", ...extra };
}
function activate(value: SummoningMasterProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true;
  value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!;
  entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current];
  return value;
}
function panel(value = projection(), props: Partial<Omit<SummoningMasterPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<SummoningMasterPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("SummoningMasterPanel committed body, permission and original intent", () => {
  it("leads with actual resources and readiness, keeps rules folded and never displays invented recipe items", () => {
    const reason = "从原巫王晋升起仅11/12整周，须等下一真实周。";
    const value = projection({ digestion: reason, formula: [{ name: "不应出现的假材料", quantity: 3, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title }));
    expect(screen.getByRole("region", { name: "召唤大师当前目标" }).textContent).toContain(reason);
    expect(button("听取召唤大师专业指导").disabled).toBe(true);
    expect(button("听取召唤大师专业指导").getAttribute("aria-describedby")).toContain("summoning-master-reason-");
    const resources = screen.getByRole("region", { name: "召唤大师当前资源" });
    expect(resources.closest("details")).toBeNull();
    for (const text of ["83 / 100", "77 / 100", "42 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(resources.textContent).not.toContain("120 / 120"); expect(screen.queryByText("不应出现的假材料")).toBeNull();
    for (const title of ["独立成品与晋升准备", "原身体、旧多里安与月亮原纸", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    fireEvent.click(button("听取召唤大师专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("retains verified sequence names and unknown recipe while showing actual old Dorian and original paper history", async () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    await open("独立成品与晋升准备");
    const boundary = screen.getByRole("region", { name: "召唤大师成品与配方边界" });
    for (const text of ["月亮序列3为召唤大师", "创生者2", "当前能力范围与消耗以本页说明为准", "晋升仪式", "尚未掌握", "当周准备另需1行动及120便士", "外来加持", "物品", "6200", "800", "第93周"]) expect(boundary.textContent).toContain(text);
    await open("原身体、旧多里安与月亮原纸");
    const history = screen.getByRole("region", { name: "召唤大师继承记录" });
    for (const text of ["女性", "WK4-DORIAN42", "健康70", "重伤投降", "WK4-DORIAN-CLUB", "WK4-PAPER-1-2仍PREPARED", "BROKEN", "伊尔玛", "格蕾丝"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("selects one independent bottle and forwards its actual labour command without mutating any bottle", async () => {
    const commands: SummoningMasterCommand[] = [{ type: "POTION_WORK", bottleId: "summoning-master-potion-1" }, { type: "POTION_WORK", bottleId: "summoning-master-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}瓶劳动`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立召唤大师原瓶" }), "summoning-master-potion-2");
    expect(screen.queryByRole("button", { name: /^第1瓶劳动/ })).toBeNull(); fireEvent.click(button("第2瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("reviews exactly one original bottle, real risks and unchanged sex, then restores focus on Escape", async () => {
    const value = projection({ actions: [consume()] }), { onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用"));
    const review = screen.getByRole("region", { name: "召唤大师原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "召唤大师第1独立原瓶" }));
    for (const text of ["summoning-master-potion-1", "SM3-SEAL-1", "71%", "第95周", "成功或失败", "女性", "性别不改变", "当前灵性不补满", "普通死亡"]) expect(review.textContent).toContain(text);
    expect(review.textContent).not.toContain("SM3-SEAL-2"); expect(within(review).queryByRole("checkbox")).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "召唤大师原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("submits one reviewed consume intent, locks through failed save and never locally retries or cancels it", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand, onClose } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "summoning-master-potion-1", confirmed: true });
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command);
    rerender(<SummoningMasterPanel {...defaults} error={{ message: "原服药写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("上次已保存的记录"); expect(screen.getByRole("status").textContent).toContain("继续同一原操作");
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "召唤大师原瓶服用确认" })).toBeTruthy();
    rerender(<SummoningMasterPanel {...defaults} value={structuredClone(value)} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true); expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });

  it("invalidates an unsubmitted review when original cost or resource facts change", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    for (const changed of [{ ...value, actions: [{ ...consume(), cost: "新增实际成本" }] }, { ...value, resources: { ...value.resources!, spirituality: 41 } }]) {
      rerender(<SummoningMasterPanel {...defaults} value={value} />); await userEvent.click(button("核对并服用"));
      rerender(<SummoningMasterPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "召唤大师原瓶服用确认" })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps a newly disabled confirmation visible with its authoritative blocker", async () => {
    const value = projection({ actions: [consume()] }), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用"));
    rerender(<SummoningMasterPanel {...defaults} value={{ ...value, actions: [{ ...consume(), enabled: false, reason: "原现场未收束。" }] }} />);
    expect(button("确认服用这一原瓶").disabled).toBe(true); expect(button("确认服用这一原瓶").getAttribute("aria-describedby")).toBe("summoning-master-confirm-reason");
    expect(screen.getByRole("region", { name: "召唤大师原瓶服用确认" }).textContent).toContain("原现场未收束");
    fireEvent.click(button("确认服用这一原瓶")); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "写入失败" }, { error: { message: "版本冲突", retryable: false } }])("blocks new commands, selectors and close while busy or recovery is pending: %j", props => {
    const { onCommand, onClose } = panel(projection(), props);
    expect(button("听取召唤大师专业指导").disabled).toBe(true); expect(button("关闭召唤大师页面").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择独立召唤大师原瓶" }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(button("听取召唤大师专业指导")); fireEvent.click(button("关闭召唤大师页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (typeof props.error === "object") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载");
  });

  it("selects among three scenes without starting them and renders only the selected original intent", async () => {
    const commands: SummoningMasterCommand[] = [{ type: "OBSERVE", caseId: "source-visit" }, { type: "OBSERVE", caseId: "original-token" }, { type: "OBSERVE", caseId: "interrupted-door" }];
    const value = projection({ promoted: true, actions: commands.map((command, i) => action(command, `观察第${i + 1}案`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择召唤大师生活情境" }), "original-token");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察第1案/ })).toBeNull();
    fireEvent.click(button("观察第2案")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(value).toEqual(before);
  });

  it.each(["BROKEN", "EXPIRED"] as const)("keeps the crossed same body and chime at the original yard after %s, with zero-resource ordinary return", status => {
    const command: SummoningMasterCommand = { type: "RETURN_GUEST", caseId: "interrupted-door", method: "ORDINARY" };
    const value = activate(projection({ promoted: true, actions: [action(command, "沿原小径陪送流灯回家", "0行动 · 30米普通路")] }), "interrupted-door", attempt({ consent: "GRANTED", guestArrived: true, arrivalMethod: "GATE", gateTier: "SUCCESS", spiritualitySpent: 6, guestStaminaSpent: 6 }));
    value.resources = { ...value.resources!, actionsRemaining: 0, mind: 0, spirituality: 0 };
    value.life.gate.status = status; value.life.partner.location = "YARD"; value.life.partner.metWeek = 96;
    const before = structuredClone(value), { onCommand, onClose } = panel(value);
    const body = screen.getByRole("region", { name: "唯一流灯的当前身体" }), gate = screen.getByRole("region", { name: "召唤大师原门与普通退路" });
    for (const text of ["SM3-LUMEN-BODY", "SM3-CHIME", "93 / 100", "84 / 100", "66 / 100", "原小石院"]) expect(body.textContent).toContain(text);
    expect(gate.textContent).toContain(status === "BROKEN" ? "已被打断" : "已到期"); expect(gate.textContent).toContain("不会令已过门的身体消失");
    expect((screen.getByRole("combobox", { name: "选择召唤大师生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    expect(button("沿原小径陪送流灯回家").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "召唤大师停止与普通收束" }).contains(button("沿原小径陪送流灯回家"))).toBe(true);
    fireEvent.click(button("关闭召唤大师页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("沿原小径陪送流灯回家")); fireEvent.click(button("沿原小径陪送流灯回家"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(body.textContent).toContain("原小石院"); expect(value).toEqual(before);
  });

  it("shows actual finite gate seconds and does not close it optimistically", () => {
    const command: SummoningMasterCommand = { type: "CLOSE_GATE", caseId: "source-visit" };
    const value = activate(projection({ promoted: true, actions: [action(command, "关闭这一原门")] }), "source-visit", attempt({ gateTier: "SUCCESS", spiritualitySpent: 6 }));
    value.life.gate = { ...value.life.gate, status: "OPEN", remainingSeconds: 23 };
    const before = structuredClone(value), { onCommand } = panel(value);
    const gate = screen.getByRole("region", { name: "召唤大师原门与普通退路" });
    for (const text of ["剩余 23 秒", "40秒是窗口", "30米", "6灵性", "6精力"]) expect(gate.textContent).toContain(text);
    fireEvent.click(button("关闭这一原门")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(gate.textContent).toContain("剩余 23 秒"); expect(value).toEqual(before);
  });

  it("preserves a failed gate and paid costs while the actual ordinary path remains usable", () => {
    const command: SummoningMasterCommand = { type: "VISIT_HOME", caseId: "source-visit" };
    const value = activate(projection({ promoted: true, actions: [action(command, "本人沿原小径去暖房", "0行动 · 30米")] }), "source-visit", attempt({ gateTier: "FAILURE", spiritualitySpent: 6, elapsedSeconds: 66, ownerTravelMetres: 60, consent: "GRANTED" }));
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const cost = screen.getByRole("region", { name: "召唤大师本次尝试与代价" });
    for (const text of ["开门：失败", "没有成功开启原门", "已付灵性 6", "来客已付精力 0", "实际经过 66 秒", "尚无来客实际到院"]) expect(cost.textContent).toContain(text);
    expect(cost.textContent).not.toContain("实际能力完成"); fireEvent.click(button("本人沿原小径去暖房"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("keeps withdrawn current consent separate from willing identity and permits only the projected fallback", () => {
    const carry: SummoningMasterCommand = { type: "CARRY_TOKEN", caseId: "original-token" };
    const value = activate(projection({ promoted: true, actions: [action({ type: "COOPERATE", caseId: "original-token" }, "请求流灯协助", "3灵性 · 8精力", { enabled: false, reason: "本次许可已撤回。" }), action(carry, "本人普通搬同一原牌")] }), "original-token", attempt({ consent: "REVOKED", ownerConsent: true, tokenTaken: true, guestArrived: true, arrivalMethod: "GATE", gateTier: "SUCCESS", spiritualitySpent: 6, guestStaminaSpent: 6 }));
    value.life.partner.location = "YARD"; value.life.partner.willing = false;
    const before = structuredClone(value), { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "唯一流灯的当前身体" }).textContent).toContain("本次同意已撤回");
    expect(button("请求流灯协助").disabled).toBe(true); fireEvent.click(button("请求流灯协助")); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button("本人普通搬同一原牌")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(carry); expect(value).toEqual(before);
  });

  it("shows the unique borrowed token holder, current adult permission and failed delivery without inventing a return", () => {
    const command: SummoningMasterCommand = { type: "RETURN_TOKEN", caseId: "original-token" };
    const value = activate(projection({ promoted: true, actions: [action(command, "亲手把原牌还给艾达")] }), "original-token", attempt({ ownerConsent: true, consent: "GRANTED", tokenTaken: true, tokenDelivered: true, cooperationTier: "FAILURE", result: "ORDINARY", spiritualitySpent: 9, guestStaminaSpent: 14 }));
    value.life.token.custodian = "TABLE"; value.life.token.location = "TABLE";
    const before = structuredClone(value), { onCommand } = panel(value);
    const token = screen.getByRole("region", { name: "唯一受托原测试牌" });
    for (const text of ["SM3-TEST-TOKEN", "SM3-ADA39", "39岁", "200克", "已当面同意", "三米外原桌", "已实际送达"]) expect(token.textContent).toContain(text);
    expect(token.textContent).not.toContain("原牌已实际交回艾达");
    const cost = screen.getByRole("region", { name: "召唤大师本次尝试与代价" });
    for (const text of ["普通方法完成", "合作：失败", "已付灵性 9", "来客已付精力 14"]) expect(cost.textContent).toContain(text);
    fireEvent.click(button("亲手把原牌还给艾达")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(token.textContent).toContain("三米外原桌"); expect(value).toEqual(before);
  });

  it("shows the actual lowered shutter and no second opening action in an interrupted-door scene", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "RETURN_PLAYER", caseId: "interrupted-door" }, "本人普通返回小院"), action({ type: "OPEN_GATE", caseId: "source-visit" }, "另一案开门")] }), "interrupted-door", attempt({ ownerConsent: true, consent: "GRANTED", interruptionObserved: true, gateInterrupted: true, guestReturned: true }));
    value.life.shutter.location = "LOWERED"; value.life.gate.status = "BROKEN"; value.life.playerLocation = "HOME";
    const before = structuredClone(value), { onCommand } = panel(value);
    const scene = screen.getByRole("region", { name: "原遮板与断门撤离" });
    for (const text of ["SM3-SHUTTER", "已经放下", "已同意本次演示", "不反复开门"]) expect(scene.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /另一案开门/ })).toBeNull(); fireEvent.click(button("本人普通返回小院"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_PLAYER", caseId: "interrupted-door" }); expect(value).toEqual(before);
  });

  it("does not revive a dead original body or turn its chime into player equipment", async () => {
    const value = projection({ promoted: true, actions: [] });
    value.life.partner.health = 0; value.life.partner.status = "DEAD"; value.life.partner.location = "YARD";
    const before = structuredClone(value); panel(value);
    const body = screen.getByRole("region", { name: "唯一流灯的当前身体" });
    for (const text of ["0 / 100", "已经真实死亡", "原小石院", "SM3-CHIME", "归 SM3-LUMEN 所有", "作为其遗物"]) expect(body.textContent).toContain(text);
    expect(screen.queryByRole("button", { name: /复活|领取声片|新来客/ })).toBeNull();
    await open("流灯的来源与原居处"); expect(screen.getByRole("region", { name: "流灯的来源与有限身体" }).textContent).toContain("不是主人创造或所有"); expect(value).toEqual(before);
  });

  it("keeps real rest receipts and health loss without filling resources", async () => {
    const value = projection({ promoted: true, actions: [] });
    value.life.partner.restHistory = [{ week: 96, paidPennies: 30, staminaBefore: 36, staminaAfter: 66, mindBefore: 74, mindAfter: 84, healthUnchanged: 93 }];
    panel(value); await open("流灯的来源与原居处");
    const rest = screen.getByRole("region", { name: "流灯实际休息记录" });
    for (const text of ["已付30便士", "精力 36→66", "精神 74→84", "健康仍为 93"]) expect(rest.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "唯一流灯的当前身体" }).textContent).toContain("93 / 100");
  });

  it("defaults combat to HOME and treats paid ASK_HELP as an explicit intent, never as a summon or automatic permission", () => {
    const command: SummoningMasterCommand = { type: "SET_GUEST_POLICY", policy: "ASK_HELP" };
    const value = projection({ promoted: true, actions: [action(command, "付费请求本场帮助", "0行动 · 20便士"), action({ type: "SET_GUEST_POLICY", policy: "HOME" }, "让流灯留家")] });
    value.encounter.inside = true; value.encounter.status = "READY"; value.life.partner.metWeek = 95;
    const before = structuredClone(value), { onCommand } = panel(value);
    const policy = screen.getByRole("region", { name: "来客本场战斗政策" });
    for (const text of ["HOME · 默认", "尚未取得本场", "生活同意不沿用", "20便士", "许可本身不召唤", "没有额外回合", "原路回HOME"]) expect(policy.textContent).toContain(text);
    fireEvent.click(button("付费请求本场帮助")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(policy.textContent).toContain("尚未取得本场"); expect(screen.getByRole("region", { name: "唯一流灯的当前身体" }).textContent).toContain("原玻璃暖房"); expect(value).toEqual(before);
  });

  it("shows actual saved combat permission, enemy injury and gate facts while retaining the same guest and ordinary exit", async () => {
    const command: SummoningMasterCommand = { type: "LEAVE_ENCOUNTER" };
    const value = projection({ promoted: true, actions: [action(command, "沿开放原出口和平离开")] });
    value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.guestPolicy = "ASK_HELP";
    value.encounter.guestPermit = { partnerId: "SM3-LUMEN", approachWeek: 97, paidWeek: 97, paidPence: 20, negotiationTravelMetres: 60, negotiationSeconds: 60 };
    const before = structuredClone(value), { onCommand } = panel(value);
    await open("本场范围与战斗代价");
    const encounter = screen.getByRole("region", { name: "召唤大师原人遭遇" });
    for (const text of ["埃德温", "46岁", "SM3-EDWIN", "健康 91", "精神 88", "独立灵性 103", "SM3-EDWIN-CLUB", "仍在原人手中", "旧多里安分别保存", "普通出口开放", "第97周实付20便士", "未开启或已关闭"]) expect(encounter.textContent).toContain(text);
    expect(screen.queryByRole("region", { name: "当前召唤大师生活情境" })).toBeNull();
    fireEvent.click(button("沿开放原出口和平离开")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("uses the old paper pool and permits new preparation only when its saved public action becomes enabled", async () => {
    const command: SummoningMasterCommand = { type: "PREPARE_PAPER", paperId: "WK4-PAPER-1-3" };
    const value = projection({ promoted: true, actions: [action(command, "准备这一张旧原纸", "1行动 · 3灵性", { enabled: false, reason: "仍有原第二张已经准备，不能同时准备另一张。" })] });
    const before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await open("原月亮纸人与战前准备");
    const papers = screen.getByRole("region", { name: "继承的唯一月亮原纸" });
    for (const text of ["未准备 1 张", "已准备 1 张", "已耗用 1 张", "WK4-PAPER-1-1 · 已真实耗用", "WK4-PAPER-1-2 · 已经准备", "WK4-PAPER-1-3 · 未准备"]) expect(papers.textContent).toContain(text);
    expect((screen.getByRole("combobox", { name: "选择一张未准备原纸" }) as HTMLSelectElement).value).toBe("WK4-PAPER-1-3");
    expect(button("准备这一张旧原纸").disabled).toBe(true); fireEvent.click(button("准备这一张旧原纸"));
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    const changed = structuredClone(value);
    changed.life.inheritedPapers[1] = { ...changed.life.inheritedPapers[1]!, status: "CONSUMED", consumedWeek: 97, consumedBy: "COMBAT", combatRound: 1 };
    changed.actions = [action(command, "准备这一张旧原纸", "1行动 · 3灵性")];
    changed.inheritedHistory[1] = "原第一、第二张均已耗，第三张仍HELD。";
    const after = structuredClone(changed); rerender(<SummoningMasterPanel {...defaults} value={changed} />);
    fireEvent.click(button("准备这一张旧原纸")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(screen.getByRole("region", { name: "继承的唯一月亮原纸" }).textContent).toContain("WK4-PAPER-1-3 · 未准备"); expect(changed).toEqual(after);
  });

});

describe("SummoningMaster exact static copy", () => {
  it("states the limited guest, unknown recipe and bounded cooperation without changing the projection", async () => {
    const value = projection(), before = structuredClone(value), { onCommand } = panel(value);
    const goal = screen.getByRole("region", { name: "召唤大师当前目标" });
    expect(within(goal).getByText("召唤大师为月亮序列3。本阶段仅使用一位真实来客、有限门与有限协作；完整配方与晋升仪式细节尚未掌握。", { exact: true })).toBeTruthy();
    expect(within(goal).queryByText("召唤大师3名称已核实；本次来客、有限门与协作为本作G。完整配方与晋升仪式仍未知。", { exact: true })).toBeNull();
    await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "召唤大师成品与配方边界" });
    expect(within(formula).getByText("月亮序列3为召唤大师，下一阶为创生者2。完整配方、材料数量与晋升仪式细节尚未掌握；当前能力范围与消耗以本页说明为准，不据名称推演创生者造物。", { exact: true })).toBeTruthy();
    expect(within(formula).queryByText("月亮序列3召唤大师与下一阶2创生者的名称已核实。完整配方、材料数量、原著晋升仪式与具体能力参数仍未知，不据名称推演创生者造物。", { exact: true })).toBeNull();
    for (const text of ["12整周", "原消化100", "500便士", "三项不同准备各1行动", "1行动及120便士", "6200便士", "800便士"]) expect(formula.textContent).toContain(text);
    await open("原身体、旧多里安与月亮原纸");
    const scope = screen.getByRole("region", { name: "召唤大师能力与实际掌握" });
    expect(within(scope).getByText("有限门与有限合作的范围、持续时间和消耗以本页说明为准；有限合作不提供其它法术。每次只涉及同一位真实来客。", { exact: true })).toBeTruthy();
    expect(within(scope).queryByText("有限门与有限合作参数为本作G；合作不冒称另一项已核实原著法术。每次只涉及同一位真实来客。", { exact: true })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
