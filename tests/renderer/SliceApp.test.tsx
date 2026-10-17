import {createSliceRun,projectSliceState} from '../../src/domain/slice/index';
/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp, sliceMoney } from "../../src/renderer/SliceApp";
import { createSliceBrowserBridge } from "../../src/simulation/slice-browser-bridge";
import {
  sliceDefaultCreationSelection,
  sliceCreationCatalogue,
  previewSliceCreation,
} from "../../src/content/slice-creation";
import type {
  SliceProjection,
  SliceCombatRound,
} from "../../src/domain/slice/types";
import type {
  SliceBootstrap,
  SliceBridge,
  SliceEnvelope,
  SliceReceipt,
  SliceResult,
} from "../../src/shared/slice-contracts";

const ok = <T,>(value: T): SliceResult<T> => ({ ok: true, value });
function projection(patch: Partial<SliceProjection> = {}): SliceProjection {
  const base=projectSliceState(createSliceRun("renderer-base",sliceDefaultCreationSelection,"renderer-base"));
  return {
    ...base,
    caseArchive:base.caseArchive,progression:base.progression,seer:base.seer,clown:base.clown,hunter:base.hunter,provoker:base.provoker,audience:base.audience,mindreader:base.mindreader,town:base.town,savant:base.savant,archaeologist:base.archaeologist,apothecary:base.apothecary,tamer:base.tamer,magician:base.magician,pyromaniac:base.pyromaniac,psychologist:base.psychologist,appraiser:base.appraiser,vampire:base.vampire,sleepless:base.sleepless,midnight:base.midnight,nightmare:base.nightmare,reader:base.reader,reasoner:base.reasoner,detective:base.detective,sailor:base.sailor,rager:base.rager,navigator:base.navigator,bard:base.bard,lightprayer:base.lightprayer,sunpriest:base.sunpriest,corpsecollector:base.corpsecollector,gravedigger:base.gravedigger,spiritmedium:base.spiritmedium,apprentice:base.apprentice,trickmaster:base.trickmaster,astrologer:base.astrologer,marauder:base.marauder,swindler:base.swindler,cryptologist:base.cryptologist,warrior:base.warrior,gladiator:base.gladiator,weaponmaster:base.weaponmaster,assassin:base.assassin,instigator:base.instigator,witch:base.witch,pryer:base.pryer,combatScholar:base.combatScholar,wizard:base.wizard,secretSupplicant:base.secretSupplicant,listener:base.listener,shadowAscetic:base.shadowAscetic,criminal:base.criminal,unwinged:base.unwinged,serialKiller:base.serialKiller,prisoner:base.prisoner,madman:base.madman,werewolf:base.werewolf,monster:base.monster,machine:base.machine,lucky:base.lucky,lawyer:base.lawyer,barbarian:base.barbarian,briber:base.briber,arbiter:base.arbiter,sheriff:base.sheriff,interrogator:base.interrogator,cultivator:base.cultivator,physician:base.physician,harvestpriest:base.harvestpriest,faceless:base.faceless,conspirator:base.conspirator,hypnotist:base.hypnotist,artisan:base.artisan,potionProfessor:base.potionProfessor,soother:base.soother,polymath:base.polymath,windBlessed:base.windBlessed,notary:base.notary,spiritGuide:base.spiritGuide,recorder:base.recorder,fireThief:base.fireThief,dawnPaladin:base.dawnPaladin,pleasure:base.pleasure,scrollProfessor:base.scrollProfessor,roseBishop:base.roseBishop,demon:base.demon,zombie:base.zombie,calamityPriest:base.calamityPriest,corruptionBaron:base.corruptionBaron,judge:base.judge,biologist:base.biologist,marionettist:base.marionettist,reaper:base.reaper,dreamwalker:base.dreamwalker,astronomer:base.astronomer,crimsonScholar:base.crimsonScholar,spiritWarlock:base.spiritWarlock,mysticismMagister:base.mysticismMagister,oceanSinger:base.oceanSinger,priestOfLight:base.priestOfLight,gatekeeper:base.gatekeeper,traveler:base.traveler,dreamStealer:base.dreamStealer,guardian:base.guardian,pain:base.pain,starMystic:base.starMystic,shepherd:base.shepherd,desireApostle:base.desireApostle,wraith:base.wraith,winner:base.winner,mentorDisorder:base.mentorDisorder,punishmentKnight:base.punishmentKnight,druid:base.druid,bizarroSorcerer:base.bizarroSorcerer,ironBloodKnight:base.ironBloodKnight,manipulator:base.manipulator,alchemist:base.alchemist,witchKing:base.witchKing,nightwatcher:base.nightwatcher,prophet:base.prophet,cataclysmPriest:base.cataclysmPriest,unshadowed:base.unshadowed,undying:base.undying,secretsSorcerer:base.secretsSorcerer,parasite:base.parasite,demonHunter:base.demonHunter,despair:base.despair,mystic:base.mystic,blackKnight:base.blackKnight,devil:base.devil,puppet:base.puppet,misfortuneMage:base.misfortuneMage,fallenEarl:base.fallenEarl,imperativeMage:base.imperativeMage,ancientAlchemist:base.ancientAlchemist,longChapter:base.longChapter,ancientScholar:base.ancientScholar,warBishop:base.warBishop,dreamWeaver:base.dreamWeaver,arcaneScholar:base.arcaneScholar,summoningMaster:base.summoningMaster,fearBishop:base.fearBishop,insightScholar:base.insightScholar,seaKing:base.seaKing,justiceMentor:base.justiceMentor,ferryman:base.ferryman,wanderer:base.wanderer,deceitMentor:base.deceitMentor,silverKnight:base.silverKnight,unagingDemoness:base.unagingDemoness,prophecyMaster:base.prophecyMaster,threeHeadedTemplar:base.threeHeadedTemplar,blatherer:base.blatherer,silentDisciple:base.silentDisciple,chaosWalker:base.chaosWalker,frenzyMage:base.frenzyMage,chaosHunter:base.chaosHunter,coffinBearer:base.coffinBearer,recovery:base.recovery,
    runId: "run-one",
    revision: 1,
    status: "ACTIVE",
    character: {
      name: "艾琳",
      portraitId: "portrait-01",
      originId: "origin-lower-middle-2",
      originName: "受教育的基层职员家庭",
      professionId: "profession-company-clerk",
      professionName: "公司文员",
      age: 24,
      gender: "FEMALE",
      education: "SECONDARY_VOCATIONAL",
      learningBonus: 1,
      weeklyWage: 360,
      birthplace: { id: "birthplace-backlund", label: "贝克兰德" },
      appearanceDescription: "短发，灰色外套。",
      traits: [
        { id: "trait.diligent", label: "勤勉" },
        { id: "trait.attentive", label: "细心" },
      ],
      flaw: { id: "flaw.stubborn", label: "固执" },
      acceptedConditionIds: [],
      creationCosts: {
        professionInitialPence: 360,
        familyTransferPence: 360,
        conditionCostPence: 0,
        educationCostPence: 0,
      },
      coreStats: { physique: 15, perception: 15, will: 17, knowledge: 21 },
    },
    week: 1,
    date: { epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 },
    actionsRemaining: 3,
    weeklyBudget: 3,
    cash: 720,
    lifeTier: "ORDINARY",
    nextLifeTier: "ORDINARY",
    weeklyWage: 360,
    wagePaid: false,
    health: 100,
    mind: 100,
    spirituality: 15,
    maxHealth: 100,
    maxMind: 100,
    maxSpirituality: 15,
    pollution: 0,
    injuries: [],
    injuryRisk: 0,
    debtTotal: 0,
    debts: [],
    missedWeeks: 0,
    credit: "NORMAL",
    learnTargets: [
      { id: "reading", label: "阅读城市史", description: "知识检定，1行动" },
      { id: "bookkeeping", label: "练习记账", description: "知识检定，1行动" },
      { id: "observation", label: "观察练习", description: "感知检定，1行动" },
    ],
    investigateTargets: [
      {
        id: "notice",
        label: "街区夜班工钱告示",
        description: "核实普通告示上的夜班消息",
      },
    ],
    canAct: true,
    actionBlockedReason: null,
    activeEvent: null,
    combat: null,
    lastCombatRound: null,
    combatHistory: [],
    lastResult: null,
    lastCheck: null,
    chronicle: [
      {
        id: "r1",
        week: 1,
        title: "来到贝克兰德",
        text: "你带着自己的履历来到东区。",
      },
    ],
    knowledge: [],
    ending: null,
    nextStep: "调查告示，核实发生了什么。",
    aidCanCancel: false,
    marketUnlocked: false,
    ...patch,
  };
}
function bootstrap(
  state: SliceProjection | null = null,
  mode: "browser" | "desktop" = "browser",
): SliceBootstrap {
  return {
    mode,
    activeState: state,
    runs: state
      ? [
          {
            runId: state.runId,
            name: state.character.name,
            portraitId: state.character.portraitId,
            week: state.week,
            date: state.date,
            status: state.status,
            revision: state.revision,
            updatedAt: "2026-10-09T22:00:00Z",
          },
        ]
      : [],
  };
}
function receipt(
  state: SliceProjection,
  envelope: SliceEnvelope,
): SliceReceipt {
  return {
    intentId: envelope.intentId,
    runId: state.runId,
    previousRevision: envelope.expectedRevision,
    newRevision: state.revision,
    committedAt: "2026-10-09T22:01:00Z",
    replayed: false,
    state,
  };
}
function bridge(
  state: SliceProjection | null = null,
  mode: "browser" | "desktop" = "browser",
): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ok(bootstrap(state, mode))),
    loadRun: vi.fn(async () => ok(state ?? projection())),
    submitIntent: vi.fn(async (envelope) =>
      ok(receipt(projection({ revision: 2 }), envelope)),
    ),
  };
}
async function enter(state: SliceProjection, custom?: SliceBridge) {
  window.sliceGame = custom ?? bridge(state);
  render(<SliceApp />);
  await screen.findByRole("button", { name: /继续游戏/ });
  await userEvent.click(screen.getByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  delete window.sliceGame;
  vi.restoreAllMocks();
});
describe("readable playable slice", () => {
  it("plays a real ordinary week and noncombat case through the shared browser rules", async () => {
    const b = createSliceBrowserBridge();
    window.sliceGame = b;
    render(<SliceApp />);
    await userEvent.click(
      await screen.findByRole("button", { name: /新建角色/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: /6确认/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "确认，开始生活" }),
    );
    await screen.findByRole("heading", { name: "人物卷宗" });
    async function chooseCurrent() {
      while (screen.queryByRole("dialog")) {
        const dialog = screen.getByRole("dialog");
        const title = dialog.getAttribute("aria-label");
        const buttons = within(dialog).getAllByRole("button");
        const preferred =
          title === "消失的夜班"
            ? /核对工资与排班账/
            : title === "慈善账与工资账"
              ? /拒绝委托/
              : title === "是否提交证据"
                ? /暂不举报/
                : title === "管理方准备转移"
                  ? /现在介入/
                  : title === "沉默的锅炉房"
                    ? /先疏散工人/
                    : null;
        await userEvent.click(
          preferred
            ? within(dialog).getByRole("button", { name: preferred })
            : buttons[0]!,
        );
        await waitFor(() =>
          expect(screen.queryByRole("dialog", { name: title! })).toBeNull(),
        );
      }
    }
    await chooseCurrent();
    await userEvent.click(screen.getByRole("button", { name: /工作，1行动/ }));
    await chooseCurrent();
    await userEvent.click(screen.getByRole("button", { name: /调查，1行动/ }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "选择调查目标" })).getByRole("button", { name: /核对夜班工钱告示/ }),
    );
    await screen.findByRole("dialog", { name: "消失的夜班" });
    await chooseCurrent();
    await userEvent.click(screen.getByRole("button", { name: /休养，1行动/ }));
    await chooseCurrent();
    const afterWeek = await b.getBootstrap();
    expect(afterWeek.ok && afterWeek.value.activeState?.week).toBe(2);
    expect(afterWeek.ok && afterWeek.value.activeState?.date).toEqual({
      epoch: "FIFTH_EPOCH",
      year: 1349,
      month: 7,
      day: 5,
    });
    await userEvent.click(screen.getByRole("button", { name: /调查，1行动/ }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "选择调查目标" })).getByRole("button", { name: /调查旧锅炉房/ }));
    await chooseCurrent();
    await screen.findByRole("heading", { name: "首案收尾 · 卷宗留存" });
    const ended = await b.getBootstrap();
    expect(ended.ok && ended.value.activeState?.ending?.kind).toBe("COMPLETED");
    expect(
      ended.ok && ended.value.activeState?.chronicle.length,
    ).toBeGreaterThan(5);
  });
  it("formats exact pounds, shillings and pence", () => {
    expect(sliceMoney(251)).toBe("1镑 0苏勒 11便士");
    expect(sliceMoney(-12)).toBe("−0镑 1苏勒 0便士");
  });
  it("shows browser reset notice and preserves portrait plus name when back-editing all six steps", async () => {
    window.sliceGame = bridge();
    render(<SliceApp />);
    await screen.findByText("浏览器试玩：刷新页面会重置进度。");
    await userEvent.click(screen.getByRole("button", { name: /新建角色/ }));
    expect(screen.getAllByRole("button", { name: /^肖像/ })).toHaveLength(8);
    await userEvent.clear(screen.getByLabelText("姓名"));
    await userEvent.type(screen.getByLabelText("姓名"), "莉亚");
    await userEvent.click(screen.getByRole("button", { name: /肖像8/ }));
    await userEvent.click(screen.getByRole("button", { name: /2出身/ }));
    expect(
      sliceCreationCatalogue.origins.every((o) =>
        screen.getByRole("button", { name: new RegExp(o.label) }),
      ),
    ).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /5开局摘要/ }));
    expect(screen.getByText(/莉亚 ·/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /1基础身份/ }));
    expect((screen.getByLabelText("姓名") as HTMLInputElement).value).toBe(
      "莉亚",
    );
    expect(
      screen
        .getByRole("button", { name: /肖像8/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("requires a conditional prerequisite and never offers forbidden careers", async () => {
    window.sliceGame = bridge();
    render(<SliceApp />);
    await userEvent.click(
      await screen.findByRole("button", { name: /新建角色/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: /2出身/ }));
    await userEvent.click(screen.getByRole("button", { name: /无依街巷长大/ }));
    await userEvent.click(screen.getByRole("button", { name: /3当前职业/ }));
    expect(screen.queryByRole("button", { name: /^律师/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^公司会计/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^宅邸仆役/ }));
    expect(
      (screen.getByRole("button", { name: "下一步" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await userEvent.click(screen.getByLabelText("我接受这个前提和代价"));
    expect(
      (screen.getByRole("button", { name: "下一步" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it("creates only on final confirmation using the editable recommendation", async () => {
    const b = bridge();
    window.sliceGame = b;
    render(<SliceApp />);
    await userEvent.click(
      await screen.findByRole("button", { name: /新建角色/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: /6确认/ }));
    expect(b.submitIntent).not.toHaveBeenCalled();
    const preview = previewSliceCreation(sliceDefaultCreationSelection);
    expect(
      screen.getAllByText(sliceMoney(preview.cashBreakdown.totalPence)).length,
    ).toBeGreaterThan(0);
    await userEvent.click(
      screen.getByRole("button", { name: "确认，开始生活" }),
    );
    await screen.findByRole("heading", { name: "人物卷宗" });
    expect(b.submitIntent).toHaveBeenCalledTimes(1);
    const call = vi.mocked(b.submitIntent).mock.calls[0]![0];
    expect(call.payload.type).toBe("CREATE");
    expect(call.runId).toBeNull();
  });
  it("renders exactly four main actions, all known targets and full chronicle without truncation", async () => {
    const records = Array.from({ length: 14 }, (_, i) => ({
      id: `r${i}`,
      week: i + 1,
      title: `纪事标题${i}`,
      text: `完整经过${i}`,
    }));
    await enter(projection({ chronicle: records }));
    expect(
      within(
        screen.getByRole("group", { name: "四个主要行动" }),
      ).queryAllByRole("button"),
    ).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: /学习，1行动/ }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getAllByRole("button", { name: /检定，1行动/ }),
    ).toHaveLength(3);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "关闭选择学习主题" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /完整纪事/ }));
    for (const record of records)
      expect(
        within(screen.getByRole("dialog")).getByText(record.text),
      ).toBeTruthy();
  }, 15_000);
  it("keeps a blocking event inert, traps keyboard focus and ignores Escape", async () => {
    const event = {
      instanceId: "event-one",
      id: "FIRST_A",
      title: "消失的夜班",
      body: "梅芙的兄长没有回来。",
      facts: ["工资尚未领取"],
      choices: [
        {
          id: "ledger",
          label: "核对工资与排班",
          preview: "知识检定，不额外消耗行动",
          enabled: true,
        },
        {
          id: "workers",
          label: "询问工友",
          preview: "感知检定，不额外消耗行动",
          enabled: true,
        },
        {
          id: "foreman",
          label: "质询工头",
          preview: "意志检定，可能引起警觉",
          enabled: true,
        },
      ],
    };
    await enter(projection({ activeEvent: event, canAct: false }));
    const dialog = await screen.findByRole("dialog", { name: "消失的夜班" });
    expect((document.querySelector(".slice-shell") as HTMLElement).inert).toBe(
      true,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "消失的夜班" })).toBeTruthy();
    const buttons = within(dialog).getAllByRole("button");
    buttons[buttons.length - 1]!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0]!.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    expect(within(dialog).queryByRole("button", { name: /关闭/ })).toBeNull();
  });
  it("does not advance on save failure and retries the exact same intent", async () => {
    const s = projection();
    const b = bridge(s);
    let attempts = 0;
    vi.mocked(b.submitIntent).mockImplementation(async (envelope) => {
      attempts++;
      return attempts === 1
        ? {
            ok: false,
            error: {
              code: "SAVE_FAILED",
              message: "保存失败，请重试。",
              retryable: true,
            },
          }
        : ok(
            receipt(
              projection({
                revision: 2,
                actionsRemaining: 2,
                cash: 1080,
                wagePaid: true,
              }),
              envelope,
            ),
          );
    });
    await enter(s, b);
    await userEvent.click(screen.getByRole("button", { name: /工作，1行动/ }));
    await screen.findByRole("alert");
    expect(screen.getByText("行动 3 / 3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    await screen.findByText("行动 2 / 3");
    expect(b.submitIntent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(b.submitIntent).mock.calls[0]![0]).toEqual(
      vi.mocked(b.submitIntent).mock.calls[1]![0],
    );
  });
  it("does not replace a newer visible revision with an earlier replayed receipt", async () => {
    const current = projection({ revision: 5, cash: 960, actionsRemaining: 2 });
    const b = bridge(current);
    vi.mocked(b.submitIntent).mockImplementation(async (envelope) =>
      ok({
        ...receipt(
          projection({ revision: 4, cash: 100, actionsRemaining: 1 }),
          envelope,
        ),
        replayed: true,
      }),
    );
    await enter(current, b);
    await userEvent.click(screen.getByRole("button", { name: /工作，1行动/ }));
    await waitFor(() => expect(b.submitIntent).toHaveBeenCalledTimes(1));
    expect(screen.getByText("行动 2 / 3")).toBeTruthy();
    expect(screen.getByText("4镑 0苏勒 0便士")).toBeTruthy();
    expect(screen.queryByText("行动 1 / 3")).toBeNull();
  });
  it("shows all persisted identity and initial-cost facts in the dossier", async () => {
    await enter(projection());
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    const dialog = screen.getByRole("dialog", { name: "人物详情" });
    expect(within(dialog).getByText("贝克兰德")).toBeTruthy();
    expect(within(dialog).getByText("短发，灰色外套。")).toBeTruthy();
    expect(within(dialog).getByText(/勤勉、细心；缺陷：固执/)).toBeTruthy();
    await userEvent.click(within(dialog).getByText("查看开局资金与前提"));
    expect(within(dialog).getByText(/家庭一次性转交/)).toBeTruthy();
  });
  it("displays terminal death as archive and never offers Continue for that slot", async () => {
    const s = projection({
      status: "DEAD",
      canAct: false,
      ending: {
        kind: "DEATH",
        title: "最后一页",
        summary: "普通追击中的伤势造成最终死亡。",
        workers: "伤亡仍待确认",
        accountability: "证据未齐",
        hazard: "位置未明",
        relationship: "联系中断",
      },
    });
    window.sliceGame = bridge(s, "desktop");
    render(<SliceApp />);
    const continuation = await screen.findByRole("button", {
      name: /继续游戏/,
    });
    expect((continuation as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /查看封存/ }));
    await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
    await screen.findByRole("heading", { name: "最后一页" });
    expect(screen.getByText("只读封存卷宗")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看卷宗" }));
    await screen.findByRole("heading", { name: "人物卷宗" });
    expect(screen.queryByRole("button", { name: /工作，1行动/ })).toBeNull();
  });
  it("shows full committed combat results and fast animation never rerolls", async () => {
    const round: SliceCombatRound = {
      round: 1,
      stance: "DEFEND",
      first: "ENEMY",
      playerCount: 2,
      enemyCount: 1,
      playerCountRoll: 72,
      enemyCountRoll: 32,
      moves: [
        { actor: "ENEMY", label: "普通打击", selfGain: 10, enemyReduction: 0 },
        { actor: "PLAYER", label: "格挡护身", selfGain: 5, enemyReduction: 5 },
        { actor: "PLAYER", label: "普通打击", selfGain: 9, enemyReduction: 0 },
      ],
      playerAdvantage: 25,
      enemyAdvantage: 20,
      winChance: 56,
      winner: "PLAYER",
      consequence: "对手受到轻伤，战斗继续。",
      consequenceWeights: { light: 65, heavy: 30, death: 5 },
      retreat: "NONE",
    };
    const combat = {
      round: 2,
      enemyName: "持短棍的人",
      enemyHealth: 75,
      enemyStatus: "RESISTING",
      playerCountWheel: [
        { id: "one", label: "1次", weight: 50 },
        { id: "two", label: "2次", weight: 30 },
        { id: "three", label: "3次", weight: 20 },
      ],
      enemyCountWheel: [],
      playerAbilityWheel: [],
      enemyAbilityWheel: [],
      consequenceWeights: { light: 65, heavy: 30, death: 5 },
      stances: [
        {
          id: "ATTACK" as const,
          label: "进攻",
          description: "普通打击权重调整",
        },
        {
          id: "DEFEND" as const,
          label: "防守",
          description: "格挡护身权重调整",
        },
        {
          id: "RETREAT" as const,
          label: "尝试撤退",
          description: "失败仍可能死亡",
        },
      ],
      lastRound: round,
    };
    const s = projection({
      combat,
      lastCombatRound: round,
      combatHistory: [round],
      canAct: false,
    });
    const b = bridge(s);
    await enter(s, b);
    await screen.findByRole("heading", { name: "第 1 回合结果" });
    expect(screen.getByText("对手受到轻伤，战斗继续。")).toBeTruthy();
    expect(screen.getByText(/你的次数盘：2次/)).toBeTruthy();
    await userEvent.click(screen.getByLabelText("快速显示本回合结果"));
    expect(document.querySelectorAll(".slice-wheel.spinning")).toHaveLength(0);
    expect(b.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "进入下一回合" }));
    expect(b.submitIntent).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /^进攻/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^控制/ })).toBeNull();
  });
});
