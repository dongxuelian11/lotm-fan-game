/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SilverKnightPanel, type SilverKnightPanelProps } from "../../src/renderer/SilverKnightPanel";
import type { SilverKnightAction, SilverKnightCommand, SilverKnightProjection } from "../../src/domain/silver-knight/types";
import { SILVER_KNIGHT_ABILITIES, SILVER_KNIGHT_CONSUMPTION_RISK, SILVER_KNIGHT_FORMULA_STATUS, SILVER_KNIGHT_SOURCE_STATUS } from "../../src/domain/silver-knight/content";
import { createSilverKnightLifeState } from "../../src/domain/silver-knight/life";
import { createSilverKnightRitualState, SILVER_KNIGHT_ALTAR_SLOTS } from "../../src/domain/silver-knight/ritual";
import { SILVER_KNIGHT_HUNTS } from "../../src/domain/silver-knight/encounter";

type Attempt = NonNullable<SilverKnightProjection["life"]["currentAttempt"]>;
type CaseId = SilverKnightProjection["life"]["cases"][number]["id"];
type SpeciesId = SilverKnightProjection["encounter"]["hunts"][number]["speciesId"];
function action(command: SilverKnightCommand, label: string, cost = "0行动", extra: Partial<SilverKnightAction> = {}): SilverKnightAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: true, reason: null, ...extra };
}
const guidance = () => action({ type: "LEARN_GUIDANCE" }, "听取银骑士专业指导", "1行动 · 500便士");
const consume = (id = "silver-knight-potion-1") => action({ type: "CONSUME", bottleId: id, confirmed: true }, `核对并服用${id}`, "0行动 · 耗用这一原瓶与本次六原遗骸");
// Explicit public component fixtures only. These do not claim natural combat victories, promotion or campaign evidence.
function attempt(extra: Partial<Attempt> = {}): Attempt {
  return { week: 115, method: "ABILITY", closed: false, result: "NONE", initialSpirituality: 48, initialMind: 90, elapsedSeconds: 0, playerTravelMetres: 0,
    playerMoves: [], steps: [], spiritualitySpent: 0, abilityTier: null, ownerConsent: "UNASKED", ownerConsentWeek: null, observerConsent: "UNASKED", observerConsentWeek: null,
    itemTaken: false, siteVisited: false, stopped: false, effectStopped: false, inspected: false, playerReturned: false, itemReturned: false,
    padWorn: false, armorFormed: false, loadApplied: false, loadReceivedBy: null, armorIntegrityAfterLoad: null, padRemoved: false,
    lampPlaced: false, lampLit: false, lampOilSpent: 0, scrutinyRequested: false, concealmentFormed: false, visibilityChecked: false, observedVisibility: null, extinguished: false, lampRecovered: false,
    targetSighted: false, wardRaised: false, thrustOutcome: "NONE", targetVisited: false, targetMarked: false, targetVerified: false, verifiedSilverMarks: null, verifiedOrdinaryMarks: null, returnedFromTarget: false, ...extra };
}
function life(): SilverKnightProjection["life"] {
  return { ...createSilverKnightLifeState(), title: "银骑士三项原物实践G", story: "同一银甲、原光位与原隔板后试验靶。", environment: "普通走廊和原训练厅。",
    nextStep: "先取得埃尔达本案许可。", inside: false, insideCase: false, currentAttempt: null, actions: [],
    facts: ["原现场SK3-TRAINING-HALL，本人在START，0秒、0米。", "埃尔达·格雷46岁SK3-ELDA在START，诺兰·派克39岁SK3-NOLAN在GALLERY；本案许可尚未取得。", "原门SK3-HALL-DOOR实际开放；关闭页面不移动身体或返还原物。"],
    cases: ([
      { id: "armor-load", title: "同一银甲与有限原负载", story: "有限12千克负载作用于同一银甲，普通4米往返。" },
      { id: "light-check", title: "原灯与借光核对", story: "携同一原灯普通6米到LIGHT，耗唯一油1，原观察员可察觉。" },
      { id: "partition-thrust", title: "同一原隔板与原试验靶", story: "先核实唯一非生命原靶，有限细剑可失手或被高位封锁抵挡。" },
    ] as const).map(entry => ({ ...entry, status: "AVAILABLE", method: null, observations: [], result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })),
  };
}
function ritual(): SilverKnightProjection["ritual"] {
  return { ...createSilverKnightRitualState(), title: "原封护礼堂与六槽祭坛G", story: "布局与本场原创天使为G，亲猎遗骸及祝福方向已核。", nextStep: "先完成原锚与六种本人亲猎。",
    inside: false, blessing: null, actions: [], facts: ["原门SK3-CHAPEL-DOOR实际开放，本人在DOOR。", "尚未写下SK3-ANCHOR-JOURNAL，不自动生成信众或免费锚。", "晨印守望者奥瑞尔SK3-AURIEL为原创G天使；当前没有实际得到的祝福。", ...SILVER_KNIGHT_ALTAR_SLOTS.map(slot => `${slot.label}：尚空。`)] };
}
function encounter(): SilverKnightProjection["encounter"] {
  return { title: "六种原亲猎与洛肯原院", story: "每种是独立原创G强生物，普通出口开放，无追逐。", status: "AVAILABLE", inside: false, activeTargetId: null, enemy: null,
    hunts: SILVER_KNIGHT_HUNTS.map(hunt => ({ speciesId: hunt.speciesId, label: hunt.label, instanceId: null, locationId: null, status: "UNSEEN", health: null, mind: null, spirituality: null,
      maxSpirituality: null, trait: null, remainsId: null, injuries: null, coatingsRemaining: null })), remains: [], actions: [],
    facts: ["每个原身体只能实际采集一份原遗骸，投降不算击杀。", "退场保留同一原身体H/M/S、伤势与涂层，旧灰烬哨卫的投降不改变。"] };
}
function projection(extra: Partial<SilverKnightProjection> = {}): SilverKnightProjection {
  return { title: "银骑士·战士序列3", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: false, formula: [], story: "六种真实亲猎与实际祝福。",
    supplies: "三个独立原瓶，每瓶6400便士或五次真实劳务后900便士；批次耗尽后须等真实下一周补货。", actions: [guidance()], nextStep: "听取专业指导。", preferredActionId: guidance().id,
    bottles: [1, 2, 3].map(n => ({ id: `silver-knight-potion-${n}`, title: `银骑士第${n}独立原瓶`, source: `独立原瓶封签SK3-SEAL-${n}`, status: "已取得，尚未服用", chance: 73,
      command: { type: "CONSUME" as const, bottleId: `silver-knight-potion-${n}`, confirmed: true as const } })),
    preparations: [{ taskId: "REVIEW_HUNT", title: "核读本人亲猎条件", completedWeek: 100 }, { taskId: "RECORD_ANCHOR", title: "亲笔记录原锚", completedWeek: 101 }, { taskId: "READ_ALTAR", title: "实读原祭坛", completedWeek: 102 }],
    preparedWeek: 114, abilities: SILVER_KNIGHT_ABILITIES.map(ability => ({ ...ability, mastery: 0 })), acting: 0, digestion: "原猎魔者消化100，实际晋升已满12整周。", pollution: 3,
    risk: SILVER_KNIGHT_CONSUMPTION_RISK, resources: { health: 80, maxHealth: 100, mind: 90, maxMind: 100, spirituality: 48, maxSpirituality: 120, cash: "905便士", actionsRemaining: 2 },
    currentGender: "FEMALE", inheritedHistory: ["旧灰烬哨卫H70/S14已投降，原剩封存涂层1。", "本人完成原奥斯温的训练与护人记录。", "原战士至猎魔者六阶段的人、物和伤势继续保留。"],
    life: life(), encounter: encounter(), ritual: ritual(), insideCase: false, environment: "原矿区、封护礼堂和训练厅均按已保存状态保留。", ...extra };
}
function reveal(value: SilverKnightProjection, speciesId: SpeciesId, extra: Partial<SilverKnightProjection["encounter"]["hunts"][number]> = {}) {
  const def = SILVER_KNIGHT_HUNTS.find(hunt => hunt.speciesId === speciesId)!, hunt = value.encounter.hunts.find(entry => entry.speciesId === speciesId)!;
  Object.assign(hunt, { instanceId: `SK3-HUNT-${speciesId}-1`, locationId: def.locationId, status: "TRACKED", health: 100, mind: 100, spirituality: def.maxSpirituality,
    maxSpirituality: def.maxSpirituality, trait: def.trait, injuries: 0, coatingsRemaining: 2, ...extra });
  return hunt;
}
function readyRitual(value: SilverKnightProjection) {
  const r = value.ritual; r.inside = true; r.playerLocation = "ALTAR"; r.travelMetres = 16;
  r.anchor = { id: "SK3-ANCHOR-JOURNAL", owner: "PLAYER", location: "PLAYER", quantity: 1, writtenWeek: 101, text: "本人亲笔留下原训练与护人的真实记忆。",
    entries: [{ root: "warrior", caseId: "staff-drill", personId: "奥斯温·布莱克特", eventWeek: 12, outcome: "ABILITY" }, { root: "guardian", caseId: "nearby-companion", personId: "奥斯温·布莱克特", eventWeek: 73, outcome: "ORDINARY" }] };
  r.blessing = { id: "SK3-AURIEL-BLESSING-1", sourceId: "SK3-AURIEL", meetingId: "SK3-AURIEL-MEETING-1", grantedWeek: 114, status: "ACTIVE", consumedWeek: null };
  value.encounter.remains = SILVER_KNIGHT_ALTAR_SLOTS.map((slot, i) => ({ id: `SK3-HUNT-${slot.speciesId}-1-REMAINS`, instanceId: `SK3-HUNT-${slot.speciesId}-1`, speciesId: slot.speciesId,
    killedBy: "PLAYER", outcome: "ENEMY_DEAD", killedWeek: 105 + i, collectedWeek: 105 + i, originLocationId: SILVER_KNIGHT_HUNTS[i]!.locationId,
    locationId: `SK3-CHAPEL:ALTAR:${slot.id}`, status: "ALTAR", slotId: slot.id, consumedWeek: null }));
  r.slots = SILVER_KNIGHT_ALTAR_SLOTS.map((slot, i) => ({ slotId: slot.id, remainsId: value.encounter.remains[i]!.id }));
  r.meetings = [{ id: "SK3-AURIEL-MEETING-1", requestedWeek: 114, visited: true, shown: true, returned: true, status: "GRANTED", decisionTier: "SUCCESS", sourceWilling: true,
    anchorId: "SK3-ANCHOR-JOURNAL", remainsIds: value.encounter.remains.map(entry => entry.id), blessing: r.blessing }];
  r.facts = ["原门SK3-CHAPEL-DOOR实际开放，本人在ALTAR。", "原锚SK3-ANCHOR-JOURNAL由本人第101周亲笔写下，关联原奥斯温训练及护人报告。", "原奥瑞尔SK3-AURIEL已在实际会见SK3-AURIEL-MEETING-1给予SK3-AURIEL-BLESSING-1，仅本场使用。",
    ...r.slots.map((slot, i) => `${SILVER_KNIGHT_ALTAR_SLOTS[i]!.label}：${slot.remainsId}。`), "本次SK3-ALTAR-KIT-1封护粉1与祭坛材料1已经实际耗用，140便士不退。"];
  value.insideCase = true; return value;
}
function activate(value: SilverKnightProjection, caseId: CaseId, current = attempt()) {
  value.insideCase = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = caseId; value.life.currentAttempt = current;
  const entry = value.life.cases.find(item => item.id === caseId)!; entry.status = "ACTIVE"; entry.contactOpen = true; entry.method = current.method; entry.attempts = [current]; return value;
}
function panel(value = projection(), props: Partial<Omit<SilverKnightPanelProps, "value">> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), defaults = { value, busy: false, onCommand, onClose, ...props };
  return { ...render(<SilverKnightPanel {...defaults} />), onCommand, onClose, defaults };
}
const button = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) }) as HTMLButtonElement;
const fold = (text: string) => screen.getByText(text, { selector: "summary" }).closest("details")!;
const open = (text: string) => userEvent.click(screen.getByText(text, { selector: "summary" }));
afterEach(cleanup);

describe("SilverKnightPanel committed original hunts, ritual and finite practice", () => {
  it("leads with the current objective and resources, and folds optional rules without leaking an unknown formula", () => {
    const reason = "原猎魔者只有11/12整周，须等下一真实周。", value = projection({ digestion: reason, formula: [{ name: "未经核实的假配方材料", quantity: 6, unit: "份" }], actions: [{ ...guidance(), enabled: false, reason }] });
    const before = structuredClone(value), { onCommand } = panel(value), goal = screen.getByRole("region", { name: "银骑士当前目标" });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.title })); expect(goal.textContent).toContain(reason);
    const resources = screen.getByRole("region", { name: "银骑士当前资源" }); expect(resources.closest("details")).toBeNull();
    for (const text of ["80 / 100", "90 / 100", "48 / 120", "905便士"]) expect(resources.textContent).toContain(text);
    expect(button("听取银骑士专业指导").disabled).toBe(true); expect(button("听取银骑士专业指导").getAttribute("aria-describedby")).toContain("silver-knight-reason-");
    for (const title of ["独立成品与晋升准备", "六份原遗骸与不可改写的击杀记录", "能力范围与实际掌握", "原身体与旧战士路线记录", "原场地与普通生活"]) expect(fold(title).open).toBe(false);
    expect(screen.queryByText("未经核实的假配方材料")).toBeNull(); fireEvent.click(button("听取银骑士专业指导")); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it("follows the projected next objective instead of prioritizing optional bottle labour", () => {
    const hunt = action({ type: "INVESTIGATE_HUNT", speciesId: "FROST_SPINE" }, "实查霜脊兽原踪", "1行动");
    const work = action({ type: "POTION_WORK", bottleId: "silver-knight-potion-1" }, "原瓶劳务", "1行动");
    panel(projection({ actions: [work, hunt], preferredActionId: hunt.id, nextStep: hunt.label }));
    expect((screen.getByRole("combobox", { name: "选择银骑士事项" }) as HTMLSelectElement).value).toBe("hunts");
    expect((screen.getByRole("combobox", { name: "选择亲猎物种" }) as HTMLSelectElement).value).toBe("FROST_SPINE");
    expect(within(screen.getByRole("group", { name: "银骑士下一步" })).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "银骑士当前目标" }).textContent).toContain(hunt.label);
    expect(screen.queryByRole("button", { name: /^原瓶劳务/ })).toBeNull();
  });

  it("keeps uninvestigated original resources and locations undisclosed", () => {
    const investigate = action({ type: "INVESTIGATE_HUNT", speciesId: "ROCK_HUSK" }, "实查岩壳兽", "1行动"), value = projection({ actions: [investigate], preferredActionId: investigate.id });
    panel(value); const facts = screen.getByRole("region", { name: "银骑士原亲猎个体" });
    expect(facts.textContent).toContain("须本人实际调查"); expect(facts.textContent).not.toContain("SK3-QUARRY-RIDGE"); expect(facts.textContent).not.toContain("独立灵性 90");
    expect(screen.getByRole("combobox", { name: "选择亲猎物种" }).querySelectorAll("option")).toHaveLength(6);
  });

  it("switches only the local selected species and forwards its exact real investigation once", async () => {
    const commands: SilverKnightCommand[] = [{ type: "INVESTIGATE_HUNT", speciesId: "ROCK_HUSK" }, { type: "INVESTIGATE_HUNT", speciesId: "EMBER_WING" }];
    const value = projection({ actions: commands.map((command, i) => action(command, i ? "实查烬翼兽" : "实查岩壳兽", "1行动")), preferredActionId: null });
    const before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择亲猎物种" }), "EMBER_WING"); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^实查岩壳兽/ })).toBeNull(); fireEvent.click(button("实查烬翼兽")); fireEvent.click(button("实查烬翼兽"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("shows the same investigated enemy's separate resources, real injuries and finite preparation", () => {
    const start = action({ type: "HUNT_FIGHT", speciesId: "EMBER_WING" }, "接近同一烬翼兽", "1行动"), value = projection({ actions: [start], preferredActionId: start.id });
    reveal(value, "EMBER_WING", { status: "RETREATED", health: 70, mind: 84, spirituality: 48, injuries: 2, coatingsRemaining: 1 });
    const before = structuredClone(value); panel(value); const facts = screen.getByRole("region", { name: "银骑士原亲猎个体" });
    for (const text of ["SK3-HUNT-EMBER_WING-1", "SK3-QUARRY-KILN", "健康 70", "精神 84", "48 / 120", "原伤势 2", "剩余涂层 1", "连续两次", "冷却", "尚未亲自采得"]) expect(facts.textContent).toContain(text);
    expect(value).toEqual(before);
  });

  it.each(["DEAD", "SURRENDERED"] as const)("does not turn %s into an already collected original remain", async status => {
    const collect = action({ type: "COLLECT_REMAINS", speciesId: "ROCK_HUSK" }, "采集这一原尸", "1行动", { enabled: status === "DEAD", reason: status === "DEAD" ? null : "投降者不能作为亲猎遗骸。" }), value = projection({ actions: [collect], preferredActionId: collect.id });
    reveal(value, "ROCK_HUSK", { status, health: status === "DEAD" ? 0 : 70, spirituality: 26, remainsId: null }); panel(value);
    const facts = screen.getByRole("region", { name: "银骑士原亲猎个体" }); expect(facts.textContent).toContain(status === "DEAD" ? "原个体已死亡" : "原个体已投降"); expect(facts.textContent).toContain("尚未亲自采得");
    await open("六份原遗骸与不可改写的击杀记录");
    expect(screen.getByRole("region", { name: "银骑士原遗骸记录" }).textContent).toContain("尚无已保存的原遗骸记录");
  });

  it("keeps consumed originals and their source deaths in a read-only record", async () => {
    const value = readyRitual(projection()), old = value.encounter.remains[0]!; old.status = "CONSUMED"; old.consumedWeek = 114;
    const before = structuredClone(value); panel(value); await open("六份原遗骸与不可改写的击杀记录"); const history = screen.getByRole("region", { name: "银骑士原遗骸记录" });
    for (const text of [old.id, old.instanceId, old.originLocationId, "本人实际击杀，第105周", "第105周实际采集", "已经耗用，不可再放置", "第114周已耗用", "投降", "不会删除原死亡历史"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("selects an independent original bottle without mutating or submitting another bottle", async () => {
    const commands: SilverKnightCommand[] = [{ type: "POTION_WORK", bottleId: "silver-knight-potion-1" }, { type: "POTION_WORK", bottleId: "silver-knight-potion-2" }];
    const value = projection({ actions: commands.map((command, i) => action(command, `第${i + 1}原瓶劳动`, "1行动")) }), before = structuredClone(value), { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立银骑士原瓶" }), "silver-knight-potion-2");
    expect(screen.queryByRole("button", { name: /^第1原瓶劳动/ })).toBeNull(); fireEvent.click(button("第2原瓶劳动")); fireEvent.click(button("第2原瓶劳动"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(commands[1]); expect(onCommand.mock.calls[0]![0]).toBe(commands[1]); expect(value).toEqual(before);
  });

  it("discloses irreversible deaths and all six consumed remains before opening independent potion review", async () => {
    const value = readyRitual(projection({ actions: [consume()] })), { onCommand, onClose } = panel(value);
    const warning = screen.getByRole("region", { name: "银骑士不可逆代价" }); expect(warning.closest("details")).toBeNull();
    for (const text of ["真实死亡不可撤销", "留在猎魔者4", "成功或失败", "六份", "祭坛耗材", "本场祝福", "不复活", "不能从旧尸复制"]) expect(warning.textContent).toContain(text);
    await userEvent.click(button("核对并服用")); const review = screen.getByRole("region", { name: "银骑士原瓶服用确认" });
    expect(document.activeElement).toBe(within(review).getByRole("heading", { name: "银骑士第1独立原瓶" }));
    for (const text of ["silver-knight-potion-1", "SK3-SEAL-1", "73%", "第114周", "意志难度30", "精神−8", "精神−15", "健康−15", "精神−25", "排异+30", "健康−25", "精神−45", "排异+60", "SK3-AURIEL-BLESSING-1", "SK3-ANCHOR-JOURNAL", "140便士不退", "性别不改变", "当前灵性不补满"]) expect(review.textContent).toContain(text);
    for (const remains of value.encounter.remains) expect(review.textContent).toContain(remains.id);
    expect(review.textContent).not.toContain("SK3-SEAL-2"); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region", { name: "银骑士原瓶服用确认" })).toBeNull();
    expect(document.activeElement).toBe(button("核对并服用")); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("sends confirmed:true once and preserves the original intent through same-envelope save retry", async () => {
    const value = readyRitual(projection({ actions: [consume()] })), before = structuredClone(value), { defaults, rerender, onCommand } = panel(value);
    await userEvent.click(button("核对并服用")); fireEvent.click(button("确认服用这一原瓶")); fireEvent.click(button("确认服用这一原瓶"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "silver-knight-potion-1", confirmed: true }); expect(onCommand.mock.calls[0]![0]).toBe(value.actions[0]!.command); expect(value).toEqual(before);
    rerender(<SilverKnightPanel {...defaults} error={{ message: "原瓶写入失败", retryable: true }} />);
    expect(screen.getByRole("status").textContent).toContain("继续同一原操作"); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    for (const control of screen.getAllByRole("button") as HTMLButtonElement[]) expect(control.disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "银骑士原瓶服用确认" })).toBeTruthy();
    rerender(<SilverKnightPanel {...defaults} value={structuredClone(value)} />); expect(button("确认服用这一原瓶").disabled).toBe(true);
    const saved = structuredClone(value); saved.promoted = true; saved.preparedWeek = null; saved.ritual.inside = false; saved.insideCase = false; saved.actions = []; saved.preferredActionId = null; saved.bottles[0]!.status = "原瓶已耗尽 · 成功晋升";
    rerender(<SilverKnightPanel {...defaults} value={saved} />); expect(screen.queryByRole("region", { name: "银骑士原瓶服用确认" })).toBeNull();
    expect(button("关闭银骑士页面").disabled).toBe(false); expect((screen.getByRole("combobox", { name: "选择银骑士事项" }) as HTMLSelectElement).value).toBe("life"); expect(onCommand).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true }, { blocked: true }, { error: "上次保存失败" }] as const)("blocks every new command and local close while locked: %j", props => {
    const { onCommand, onClose } = panel(projection(), props); fireEvent.click(button("听取银骑士专业指导")); fireEvent.click(button("关闭银骑士页面"));
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(button("听取银骑士专业指导").disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择银骑士事项" }) as HTMLSelectElement).disabled).toBe(true);
  });

  it("invalidates unsubmitted review when saved resources or original eligibility change", async () => {
    const value = readyRitual(projection({ actions: [consume()] })), { defaults, rerender, onCommand } = panel(value); await userEvent.click(button("核对并服用"));
    const changed = structuredClone(value); changed.resources!.mind = 40; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = "须精神>40。";
    rerender(<SilverKnightPanel {...defaults} value={changed} />); expect(screen.queryByRole("region", { name: "银骑士原瓶服用确认" })).toBeNull();
    expect(button("核对并服用").disabled).toBe(true); expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps an actual meeting ahead of optional activities and shows original anchor provenance", async () => {
    const command: SilverKnightCommand = { type: "RITUAL_RETURN_DOOR" }, move = action(command, "本人普通6米回原门", "0行动 · 普通6米"), value = readyRitual(projection({ actions: [guidance(), move], preferredActionId: guidance().id }));
    value.ritual.playerLocation = "MEETING"; const before = structuredClone(value), { onCommand } = panel(value);
    expect((screen.getByRole("combobox", { name: "选择银骑士事项" }) as HTMLSelectElement).value).toBe("ritual"); expect((screen.getByRole("combobox", { name: "选择银骑士事项" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /^听取银骑士专业指导/ })).toBeNull(); const scene = screen.getByRole("region", { name: "银骑士原锚祝福与祭坛" });
    expect(screen.getByRole("region", { name: "银骑士当前行动" }).compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await open("原锚册与关联经历"); for (const text of ["SK3-ANCHOR-JOURNAL", "奥斯温·布莱克特", "staff-drill", "nearby-companion", "第12周", "第73周"]) expect(scene.textContent).toContain(text);
    fireEvent.click(button("本人普通6米回原门")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("distinguishes an actual refusal from a received original blessing", async () => {
    const leave = action({ type: "RITUAL_RETURN_DOOR" }, "普通返回原门"), value = projection({ actions: [leave], preferredActionId: leave.id });
    value.ritual.inside = true; value.ritual.playerLocation = "MEETING"; value.ritual.meetings = [{ id: "SK3-AURIEL-MEETING-1", requestedWeek: 114, visited: true, shown: true, returned: false, status: "REFUSED", decisionTier: "FAILURE", sourceWilling: true, anchorId: "SK3-ANCHOR-JOURNAL", remainsIds: [], blessing: null }];
    value.ritual.facts = ["本次原奥瑞尔实际拒绝，当前没有有效祝福。本人仍在原会见点。"];
    panel(value); await open("实际会见与原祝福记录"); const facts = screen.getByRole("region", { name: "银骑士原锚祝福与祭坛" });
    expect(facts.textContent).toContain("本次实际拒绝"); expect(facts.textContent).toContain("尚未完成实际返程"); expect(facts.textContent).not.toContain("SK3-AURIEL-BLESSING-1");
  });

  it("shows one current life action before the exact saved people, originals and positions", () => {
    const command: SilverKnightCommand = { type: "CONSENT_OWNER", caseId: "armor-load" }, value = activate(projection({ promoted: true, actions: [action(command, "当面问埃尔达本案许可")] }), "armor-load");
    const before = structuredClone(value), { onCommand } = panel(value), scene = screen.getByRole("region", { name: "银骑士原人原物与真实位置" });
    expect(screen.getByRole("region", { name: "银骑士当前行动" }).compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "银骑士下一步" })).getAllByRole("button")).toHaveLength(1); expect((screen.getByRole("combobox", { name: "选择银骑士生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    for (const text of ["SK3-TRAINING-HALL", "SK3-ELDA", "46岁", "SK3-NOLAN", "39岁", "SK3-HALL-DOOR", "实际开放"]) expect(scene.textContent).toContain(text);
    fireEvent.click(button("当面问埃尔达本案许可")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(value).toEqual(before);
  });

  it("switches an unstarted case locally and exposes its own exact original command", async () => {
    const first = action({ type: "OBSERVE", caseId: "armor-load" }, "观察同一原负载", "1行动"), second = action({ type: "OBSERVE", caseId: "light-check" }, "观察同一原灯", "1行动");
    const value = projection({ promoted: true, actions: [first, second] }), { onCommand } = panel(value); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择银骑士生活情境" }), "light-check");
    expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^观察同一原负载/ })).toBeNull();
    expect(screen.getByRole("region", { name: "当前银骑士生活情境" }).textContent).toContain("共13行动"); fireEvent.click(button("观察同一原灯")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command);
  });

  it("keeps a failed ability, real elapsed time and ordinary completion distinct from mastery", async () => {
    const current = attempt({ abilityTier: "FAILURE", result: "ORDINARY", spiritualitySpent: 6, elapsedSeconds: 35, playerTravelMetres: 8,
      playerMoves: [{ from: "START", to: "LOAD", mode: "WALK", metres: 4, seconds: 4, itemId: "SK3-PAD" }, { from: "LOAD", to: "START", mode: "WALK", metres: 4, seconds: 4, itemId: "SK3-PAD" }], loadApplied: true, loadReceivedBy: "PAD", armorIntegrityAfterLoad: 0 });
    const value = activate(projection({ promoted: true, actions: [action({ type: "CLOSE", caseId: "armor-load" }, "关闭已收束原现场")] }), "armor-load", current);
    value.life.facts = ["原SK3-LOAD-RIG负载1已实际耗用，原垫SK3-PAD完整度90，原银甲未形成。", "本人已携同一原垫返回START；旧原资源不恢复。"];
    const before = structuredClone(value); panel(value); expect(fold("本次实际尝试与已付代价").open).toBe(true);
    const scene = screen.getByRole("region", { name: "银骑士原人原物与真实位置" }); for (const text of ["失败", "普通方法完成", "35 秒", "8 米", "6", "不能重骰", "完整度90", "原银甲未形成"]) expect(scene.textContent).toContain(text);
    await open("能力范围与实际掌握"); expect(screen.getByRole("region", { name: "银骑士能力与使用范围" }).textContent).toContain("掌握 0"); expect(value).toEqual(before);
  });

  it("renders saved light exhaustion and blocked thrust without predicting visibility or hit", () => {
    const value = activate(projection({ promoted: true, actions: [action({ type: "VERIFY_TARGET", caseId: "partition-thrust" }, "核对同一原靶")] }), "partition-thrust", attempt({ abilityTier: "SUCCESS", thrustOutcome: "WARD_BLOCKED", spiritualitySpent: 6 }));
    value.life.facts = ["SK3-LAMP原油0、余光0秒；借光已结束，本人在LIGHT原位置显露，观察员已实际看见。", "SK3-PARTITION仍锁闭，原SK3-COUNTER-WARD实际挡下细剑；SK3-PRACTICE-TARGET银痕0，普通痕0；本人实际在TARGET核实。"];
    const before = structuredClone(value); panel(value); const scene = screen.getByRole("region", { name: "银骑士原人原物与真实位置" });
    for (const text of ["原油0", "余光0秒", "原位置显露", "实际看见", "实际挡下细剑", "银痕0", "实际在TARGET"]) expect(scene.textContent).toContain(text);
    expect(scene.textContent).not.toContain("能力实际作用后完成"); expect(value).toEqual(before);
  });

  it("keeps the optional original Lorcan conflict and ordinary exit separate from ritual hunts", () => {
    const leave = action({ type: "LEAVE_ENCOUNTER" }, "普通离开洛肯原院"), fight = action({ type: "ENCOUNTER_FIGHT" }, "承担洛肯的实际冲突", "1行动");
    const value = projection({ promoted: true, actions: [fight, leave], preferredActionId: fight.id }); value.encounter.inside = true; value.encounter.status = "READY"; value.encounter.activeTargetId = "SK3-LORCAN";
    value.encounter.enemy = { id: "SK3-LORCAN", name: "洛肯·里德", age: 48, source: "ORIGINAL_LIMITED_G", speciesId: null, health: 70, mind: 94, spirituality: 46, maxSpirituality: 120,
      status: "RETREATED", locationId: "SK3-LORCAN-COURT", tier: 1250, powerUses: { PRIMARY: 2, DEFENSE: 1, TRAIT: 1, BODY_STRIKE: 0, ACCIDENT: 0 }, injuries: 2, coatingsRemaining: 0 };
    value.encounter.facts = ["唯一原棍SK3-LORCAN-ROD仍在洛肯手里，原灯只余60秒；冲击5灵性、屏护4灵性、辨光4灵性。普通出口实际开放，无追逐。"];
    const before = structuredClone(value), { onCommand } = panel(value), facts = screen.getByRole("region", { name: "银骑士原人遭遇" });
    for (const text of ["洛肯·里德", "48岁", "健康 70", "精神 94", "46 / 120", "原伤势 2", "SK3-LORCAN-ROD", "60秒", "普通出口实际开放"]) expect(facts.textContent).toContain(text);
    expect(screen.queryByRole("combobox", { name: "选择亲猎物种" })).toBeNull(); fireEvent.click(button("普通离开洛肯原院")); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command); expect(value).toEqual(before);
  });

  it("preserves natural old-stage history read-only without claiming a later natural victory", async () => {
    const value = projection(), before = structuredClone(value); panel(value); await open("原身体与旧战士路线记录"); const history = screen.getByRole("region", { name: "银骑士继承记录" });
    for (const text of ["女性", "普通人自然周目", "灰烬哨卫H70/S14已投降", "封存涂层1", "奥斯温", "不能把该投降者当作新猎物", "后续晋升、亲猎和生活能力成败只按本周目实际记录"]) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole("button")).toBeNull(); expect(value).toEqual(before);
  });

  it("preserves actual hunt, blessing and ability limits in player copy", async () => {
    panel(); await open("独立成品与晋升准备"); const formula = screen.getByRole("region", { name: "银骑士成品与配方边界" });
    for (const text of ["完整魔药配方", "尚未掌握", "不将六种遗骸当六味药材", "SK3-OSRIC", "58岁", "6400", "900便士", "140便士", "12整周"]) expect(formula.textContent).toContain(text);
    await open("能力范围与实际掌握"); const scope = screen.getByRole("region", { name: "银骑士能力与使用范围" });
    for (const text of ["实质银甲", "亲猎六种强大生物并取得遗骸", "生命中具有神秘意义的鲜明经历可作锚", "并非必中", "原晨曦剑继承", "不是本人传送", "水银化", "随机好运", "高位封锁", "6灵性", "知识18"]) expect(scope.textContent).toContain(text);
  });

  it("closes only the local view without cancelling a saved ritual or moving any original", () => {
    const value = readyRitual(projection({ actions: [] })), before = structuredClone(value), { onCommand, onClose } = panel(value);
    fireEvent.click(button("关闭银骑士页面")); expect(onClose).toHaveBeenCalledOnce(); expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it("adapts the authored formula and source paragraphs without mutating the projection", async () => {
    const value = projection(), before = structuredClone(value); panel(value);
    await open("独立成品与晋升准备");
    const formula = screen.getByRole("region", { name: "银骑士成品与配方边界" });
    expect(within(formula).getByText("银骑士为战士途径序列3。完整魔药配方、材料用量与祭坛精确布局尚未掌握，配方保持未知，不开放自制。晋升仪式要求复杂祭坛、本人猎杀六种强大生物的遗骸正确放位，以及神的祝福；天使也可给予祝福。本次使用六种强生物、六角布局、独立成品原瓶，并由天使奥瑞尔协助，不将六种遗骸当六味药材。")).toBeTruthy();
    expect(within(formula).queryByText(SILVER_KNIGHT_FORMULA_STATUS)).toBeNull();
    await open("能力范围与实际掌握");
    const scope = screen.getByRole("region", { name: "银骑士能力与使用范围" });
    expect(within(scope).getByText("银骑士可使用实质银甲、借光隐藏、常规维持晨曦剑，以及能传送绕过大部分屏障的银白细剑；细剑仍可闪避，并非必中或穿过全部屏障。晋升仪式须本人亲猎六种强大生物并取得遗骸，准备复杂祭坛并获得祝福。不同祝福的效果有差异，还需要高位锚；生命中具有神秘意义的鲜明经历可作锚。不自动获得科林的特殊祝福、水银化或随机好运；本阶段不开放序列2能力。具体人物、地点、消耗与操作条件见当前说明。")).toBeTruthy();
    expect(within(scope).queryByText(SILVER_KNIGHT_SOURCE_STATUS)).toBeNull();
    expect(value).toEqual(before);
  });

});

describe("SilverKnightPanel exact progression scope", () => {
  it("retains six personally hunted remains, altar and blessing while keeping S2 preparation separate", () => {
    const value = projection({ promoted: true, actions: [], preferredActionId: null }), before = structuredClone(value), { onCommand } = panel(value);
    const goal = screen.getByRole("region", { name: "银骑士当前目标" });
    expect(within(goal).getByText("晋升仍须取得本人亲猎六种强大生物的遗骸、准备复杂祭坛并获得祝福；本场生物、天使、布局和数值以当前说明为准。本页不直接授予序列2及以上能力；发现荣耀者渠道后，可查看独立晋升准备，仍须满足其实际条件。", { exact: true })).toBeTruthy();
    expect(within(goal).queryByText("六种亲猎遗骸、复杂祭坛与祝福的方向已核；本场生物、天使、布局和数值均为原创G。序列2及以上尚未开放。", { exact: true })).toBeNull();
    expect(goal.textContent).not.toContain("序列2及以上尚未开放");
    expect(onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
