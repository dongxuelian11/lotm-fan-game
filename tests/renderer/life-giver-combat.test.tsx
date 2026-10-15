/* @vitest-environment jsdom */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import {
  PANEL, boundary, capturedCommand, savedGame, mountGame,
  actionButton, commandControl, clickCommand, settled, view,
  assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './life-giver-ui-fixture';

// Literal display expectations from the original recorded boundaries; raw state stays authoritative.
const ROUND_COPY: Record<string, { moves: readonly (readonly [string, string])[]; consequence: readonly [string, string] }> = {
  "combat-first": {
    "moves": [
      [
        "缺少当场自愿且在场的存活原来客、本人H>10、实付READY原珠或4S，未尝试新能力；本人普通避让减势10G，0灵性0原物成本，不重抽或免伤。",
        "缺少当场自愿且在场的存活原来客、本人H>10、实付READY原珠或4S，未尝试新能力；本人普通避让减势10，0灵性0原物成本，不重抽或免伤。"
      ],
      [
        "原艾德里安有限护术G实际6S，贡献0/减势60G，独立余S114/120；共同伤势盘照常。",
        "原艾德里安有限护术实际6S，贡献0/减势60，独立余S114/120；共同伤势盘照常。"
      ],
      [
        "继承血月之箭实际4S/感知16成功，45×旧掌握G优势；伤势仍由共同盘裁定。",
        "继承血月之箭实际4S/感知16成功，45×旧掌握优势；伤势仍由共同盘裁定。"
      ],
      [
        "原艾德里安持自己的唯一LG2-ADRIAN-CLUB，普通20×身体G打击、0S。来客未承接，不扣其原资源。",
        "原艾德里安持自己的唯一LG2-ADRIAN-CLUB，普通20×身体打击、0S。来客未承接，不扣其原资源。"
      ],
      [
        "继承有限召唤知识18成功，实际6S；同一流灯耗6原精力亲自从HOME过门到YARD，原声片随同体。本槽0优势，仍只有双方次数盘；门断不删除身体。",
        "继承有限召唤知识18成功，实际6S；同一流灯耗6原精力亲自从HOME过门到YARD，原声片随同体。本槽0优势，仍只有双方次数盘；门断不删除身体。"
      ],
      [
        "原艾德里安有限护术G实际6S，贡献0/减势60G，独立余S108/120；共同伤势盘照常。",
        "原艾德里安有限护术实际6S，贡献0/减势60，独立余S108/120；共同伤势盘照常。"
      ],
      [
        "有限活力知识18失败，已付6S和原珠LG2-BEAD-7照耗，原珠实物保留；没有实际恢复、代价分担或重试。",
        "有限活力知识18失败，已付6S和原珠LG2-BEAD-7照耗，原珠实物保留；没有实际恢复、代价分担或重试。"
      ],
      [
        "原艾德里安有限暗矢G实际7S，贡献105/减势0G，独立余S101/120；共同伤势盘照常。",
        "原艾德里安有限暗矢实际7S，贡献105/减势0，独立余S101/120；共同伤势盘照常。"
      ],
      [
        "分担庇护知识18失败，已付4S和原珠LG2-BEAD-8照耗，原珠实物保留；没有实际恢复、代价分担或重试。",
        "分担庇护知识18失败，已付4S和原珠LG2-BEAD-8照耗，原珠实物保留；没有实际恢复、代价分担或重试。"
      ],
      [
        "原艾德里安实际4S干扰：原门断连，无庇护窗口可断。同一已到场流灯本轮首次实际M−8；原身体及声片仍在实际YARD，活来客可走原30米路回家。",
        "原艾德里安实际4S干扰：原门断连，无庇护窗口可断。同一已到场流灯本轮首次实际M−8；原身体及声片仍在实际YARD，活来客可走原30米路回家。"
      ],
      [
        "原艾德里安·维尔本槽判断失衡，固定−22.5G，不重抽。",
        "原艾德里安·维尔本槽判断失衡，固定−22.5，不重抽。"
      ]
    ],
    "consequence": [
      "同一46岁原艾德里安·维尔在独立净空石院2米外，S120/120；同一流灯在HOME、H100/M100/精力100。候选新能力、数值和场景全G，不创造生命、灵魂或复活原身体。同一原艾德里安·维尔在共同伤势盘55/100受到轻伤，原健康实际−10；不是新能力自动杀伤，伤势保留。本轮原门与分担窗口结束；活来客按事先当场同意走原30米路回HOME，死者同体声片留YARD。原纸、原珠、本人分担H及双方成本全部保留；庇护仅成功应用时算效果，未用窗口不奖励。",
      "同一46岁原艾德里安·维尔在独立净空石院2米外，S120/120；同一流灯在HOME、H100/M100/精力100。新能力只按当前条件有限使用，不创造生命、灵魂或复活原身体。同一原艾德里安·维尔在共同伤势盘55/100受到轻伤，原健康实际−10；不是新能力自动杀伤，伤势保留。本轮原门与分担窗口结束；活来客按事先当场同意走原30米路回HOME，死者同体声片留YARD。原纸、原珠、本人分担H及双方成本全部保留；庇护仅成功应用时算效果，未用窗口不奖励。"
    ]
  },
  "combat-terminal": {
    "moves": [
      [
        "独立原灵性不足，同槽回退、不补灵；原艾德里安持自己的唯一LG2-ADRIAN-CLUB，普通20×身体G打击、0S。来客未承接，不扣其原资源。",
        "独立原灵性不足，同槽回退、不补灵；原艾德里安持自己的唯一LG2-ADRIAN-CLUB，普通20×身体打击、0S。来客未承接，不扣其原资源。"
      ]
    ],
    "consequence": [
      "同一46岁原艾德里安·维尔在独立净空石院2米外，S1/120；同一流灯在HOME、H100/M92/精力88。候选新能力、数值和场景全G，不创造生命、灵魂或复活原身体。本人亲手拾回本场全部实付原珠（含用尽实物），沿开放普通出口步行4米、4秒至返还盘，无追逐、瞬移或夺棍；原艾德里安·维尔与自己的LG2-ADRIAN-CLUB留在原外院，原伤势、实付灵性保留。本轮原门与分担窗口结束；活来客按事先当场同意走原30米路回HOME，死者同体声片留YARD。原纸、原珠、本人分担H及双方成本全部保留；庇护仅成功应用时算效果，未用窗口不奖励。",
      "同一46岁原艾德里安·维尔在独立净空石院2米外，S1/120；同一流灯在HOME、H100/M92/精力88。新能力只按当前条件有限使用，不创造生命、灵魂或复活原身体。本人亲手拾回本场全部实付原珠（含用尽实物），沿开放普通出口步行4米、4秒至返还盘，无追逐、瞬移或夺棍；原艾德里安·维尔与自己的LG2-ADRIAN-CLUB留在原外院，原伤势、实付灵性保留。本轮原门与分担窗口结束；活来客按事先当场同意走原30米路回HOME，死者同体声片留YARD。原纸、原珠、本人分担H及双方成本全部保留；庇护仅成功应用时算效果，未用窗口不奖励。"
    ]
  }
};

describe('Life Giver original Adrian, actual combat wheels and physical exits', () => {
  it.each(['adrian-actual-entry', 'new-current-battle-invitation', 'combat-start', 'combat-first', 'combat-terminal'])('renders actual %s without replacing any original body or resource', renderBoundaryProjection);

  it('explicitly prepares the same held paper without duplicating any old consumed paper', async () => {
    const captured = boundary('original-held-paper-actually-prepared'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const command = capturedCommand(captured);
    if (command.type !== 'PREPARE_PAPER') throw new Error('Expected the actual original paper preparation.');
    expect(before.witchKing.life.papers.find(p => p.id === command.paperId)?.status).toBe('HELD');
    await mountGame(game); await clickCommand(game, command);
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.spirituality).toBe(before.spirituality - 3);
    expect(game.state.witchKing.life.papers.find(p => p.id === command.paperId)?.status).toBe('PREPARED');
    expect(game.state.witchKing.life.papers.map(p => p.id)).toEqual(before.witchKing.life.papers.map(p => p.id));
    for (const paper of before.witchKing.life.papers.filter(p => p.status === 'CONSUMED')) expect(game.state.witchKing.life.papers.find(p => p.id === paper.id)).toEqual(paper);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(`${command.paperId} · 已明确准备`);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('confirms a new 20-pence permission and actual 60-metre visit without moving or restoring the guest', async () => {
    const captured = boundary('new-current-battle-invitation'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(before.lifeGiver.encounter.guestPolicy).toBe('HOME'); expect(before.lifeGiver.encounter.guestPermit).toBeNull();
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭创生者页面' })).toBeNull();
    const trigger = await commandControl(game.state, capturedCommand(captured)); await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    expect(review.textContent).toContain('20便士'); expect(review.textContent).toContain('60米/60秒');
    expect(review.textContent).toContain('旧生活许可与埃德温援助许可不延续');
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - 20); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    expect(game.state.lifeGiver.life.playerTravelMetres).toBe(before.lifeGiver.life.playerTravelMetres + 60);
    expect(game.state.lifeGiver.life.clockSeconds).toBe(before.lifeGiver.life.clockSeconds + 60);
    expect(game.state.lifeGiver.encounter.guestPermit).toMatchObject({ partnerId: 'SM3-LUMEN', encounterId: 'LIFE_GIVER_DISPUTE', paidPence: 20 });
    expect(game.state.lifeGiver.encounter.guestPermit).not.toEqual(before.summoningMaster.encounter.guestPermit);
    const facts = screen.getByRole('region', { name: '流灯本场当前许可' });
    expect(facts.textContent).toContain('第' + game.state.week + '周实付20便士');
    expect(facts.textContent).toContain('本次当面协商实走60米、60秒');
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('can withdraw the current battle invitation without refunding or restoring the original guest', async () => {
    // Deliberate branch from a real saved invitation.
    const game = savedGame(boundary('new-current-battle-invitation').final), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'SET_GUEST_POLICY', policy: 'HOME' });
    expect(game.state.lifeGiver.encounter.guestPermit).toBeNull();
    expect(game.state.lifeGiver.encounter.invitationHistory).toEqual(before.lifeGiver.encounter.invitationHistory);
    expect(game.state.lifeGiver.life.playerTravelMetres).toBe(before.lifeGiver.life.playerTravelMetres);
    expect(game.state.cash).toBe(before.cash); expect(game.state.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    expect(screen.getByRole('region', { name: '流灯本场当前许可' }).textContent).toContain('当前没有本场援助许可');
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('reviews lethal consequences, cancels safely and starts the same Adrian exactly once', async () => {
    const captured = boundary('combat-start'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game);
    const encounter = screen.getByRole('region', { name: '创生者原人遭遇' });
    for (const text of ['LG2-ADRIAN-VALE', '46岁', 'LG2-ADRIAN-CLUB', '本场序列2等效', '原身体体质24']) expect(encounter.textContent).toContain(text);
    const trigger = await commandControl(game.state, capturedCommand(captured)); await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    expect(review.textContent).toContain('真实战斗，会产生伤势、投降或不可逆死亡');
    expect(review.textContent).toContain('来客也可能受伤或死亡'); expect(review.textContent).toContain('不提供复活');
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    expect(actionButton(game.state, { type: 'LEAVE_ENCOUNTER' }).disabled).toBe(false);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByRole('dialog', { name: projectSliceState(migrateSliceState(captured.final)).combat!.title ?? "普通人追击" });
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.lifeGiver.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND' });
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['combat-first', 'combat-terminal'])('shows actual wheels/current resources and commits exact %s without rerolling reveal', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected actual COMBAT_ROUND.');
    const intent = captured.lastIntent, battle = projectSliceState(before).combat!;
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    expect(battle.lifeGiver?.targetId).toBe('LG2-ADRIAN-VALE');
    function assertCurrentResources(dialog: HTMLElement, current: typeof before) {
      const currentBeforeProjection = structuredClone(current);
      const projected = projectSliceState(current), actual = projected.combat!.lifeGiver!;
      const section = within(dialog).getByRole('region', { name: '创生者本回合实际资源' });
      expect(section.closest('details')).toBeNull();
      expect(within(section).getByRole('heading', { name: '同一原人、原物与当前成本' })).toBeTruthy();
      const text = section.textContent!.replace(/\s+/g, ' ');
      expect(text).toContain(`本人精神 ${current.mind} / ${projected.maxMind} · 灵性 ${current.spirituality} / ${projected.maxSpirituality}`);
      expect(text).toContain(`原艾德里安精神 ${current.lifeGiver.encounter.enemyMind} / 100 · 独立灵性 ${current.lifeGiver.encounter.enemySpirituality} / 120`);
      const rawPartner = current.summoningMaster.life.partner;
      expect(rawPartner.source).toBe("原创G：由原巫王导师格蕾丝提供可核联系方式、原居SM3-GLASS-ROOM的成年独立低强灵界生物流灯；其有限实体与原声片原已存在，非玩家创造或所有，不是旧动物、免费天使或可替换灵库。");
      expect(actual.partner).toEqual({ ...rawPartner, source: "由原巫王导师格蕾丝提供可核联系方式、原居SM3-GLASS-ROOM的成年独立低强灵界生物流灯；其有限实体与原声片原已存在，非玩家创造或所有，不是旧动物、免费天使或可替换灵库。" });
      expect(current).toEqual(currentBeforeProjection);
      const guest = current.summoningMaster.life.partner;
      expect(text).toContain(`原流灯 ${guest.bodyId} · ${guest.location} · ${guest.status === 'ALIVE' ? '存活' : '已经死亡'} · 健康 ${guest.health} / 100 · 精神 ${guest.mind} / 100 · 精力 ${guest.stamina} / 100`);
      expect(text).toContain(`本场许可：${actual.guestPolicy === 'ASK_HELP' && actual.guestPermit ? '当次自愿援助' : '留家，无本场援助许可'}`);
      const beads = current.lifeGiver.life.beads.filter(b => b.purpose === 'COMBAT');
      for (const bead of beads) expect(bead.source).toBe("原创G：持照商店原有的独立月光珠，每粒60便士；一次有限媒介，用后留下同一耗尽原珠，不是生命、灵魂、无限材料或原著配方。");
      expect(actual.combatBeads).toEqual(beads.map(bead => ({ ...bead, source: "持照商店原有的独立月光珠，每粒60便士；一次有限媒介，用后留下同一耗尽原珠，不是生命、灵魂、无限材料或晋升配方。" })));
      expect(text).toContain(`随身可用原珠 ${beads.filter(b => b.status === 'READY' && b.location === 'PLAYER').length} / ${beads.length}；已耗尽 ${beads.filter(b => b.status === 'SPENT').length}`);
      const encounter = current.lifeGiver.encounter;
      expect(text).toContain(`活力尝试 ${encounter.vitalityUses} / 成功 ${encounter.vitalitySuccesses}`);
      expect(text).toContain(`共担尝试 ${encounter.shelterUses} / 成功 ${encounter.shelterSuccesses} / 实际应用 ${encounter.shelterEffects}，本人累计分担健康 ${encounter.totalPlayerHealthSpent}`);
    }
    assertCurrentResources(stage, before);
    expect(battle.playerCountWheel.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(battle.enemyCountWheel.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(battle.enemyAbilityWheel.map(e => [e.id, e.weight])).toEqual([
      ['DARK_BOLT', 30], ['WARD', 20], ['JAM', 20], ['BODY_STRIKE', 25], ['ACCIDENT', 5],
    ]);
    expect(stage.textContent).toContain(battle.lifeGiver!.summary);
    expect(stage.textContent?.replace(/\s+/g, ' ')).toContain(`健康 ${before.health} / 100`);
    expect(stage.textContent?.replace(/\s+/g, ' ')).toContain(`健康 ${battle.enemyHealth} / 100`);
    expect(within(stage).getByRole('heading', { name: battle.enemyName })).toBeTruthy();
    const risk = within(stage).getByRole('region', { name: '伤势与恢复路线' });
    expect(risk.closest('details')).toBeNull();
    for (const text of [`轻伤 ${battle.consequenceWeights.light}%`, `重伤 ${battle.consequenceWeights.heavy}%`, `死亡 ${battle.consequenceWeights.death}%`]) expect(risk.textContent).toContain(text);
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const entry of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.enemyAbilityWheel) expect(within(stage).getByText(/^对手能力盘：/).textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const entry of battle.playerAbilityWheel) expect(within(stage).getByText(/^你的能力盘：/).textContent).toContain(entry.label);
    const stance = battle.stances.find(s => s.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: n => n.startsWith(stance.label) }));
    expect(game.submit).not.toHaveBeenCalled();
    const confirm = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    assertLegacyPreserved(before, game.state);
    const round = game.state.lastCombatRound!, outcome = round.lifeGiverOutcome!, result = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(outcome.source.revision).toBe(before.revision); expect(outcome.source.randomCursor).toBe(before.random.cursor);
    expect(outcome.source.randomSeed).toBe(before.random.seed); expect(outcome.randomCursorAfter).toBe(game.state.random.cursor);
    const copy = ROUND_COPY[name]!;
    expect(round.moves.map(move => move.label)).toEqual(copy.moves.map(([source]) => source));
    for (const [, display] of copy.moves) expect(result.textContent).toContain(display);
    expect(round.consequence).toBe(copy.consequence[0]);
    expect(result.textContent).toContain(copy.consequence[1]);
    const after = structuredClone(game.state);
    await userEvent.click(within(result).getByRole('checkbox', { name: '快速显示本回合结果' }));
    expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole('button', { name: '进入下一回合' }));
      const next = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
      assertCurrentResources(next, game.state);
      await userEvent.click(within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: 'summary' }));
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    } else {
      expect(game.state.lifeGiver.encounter.terminal).not.toBeNull();
      await userEvent.click(within(result).getByRole('button', { name: game.state.status === 'DEAD' ? '查看收尾卷宗' : '返回生活' }));
      expect(screen.queryByRole('dialog', { name: battle.title ?? "普通人追击" })).toBeNull();
    }
  }, 20_000);

  it('displays actual attempted/succeeded/applied counters, each original bead and independent enemy spirituality', async () => {
    const captured = boundary('combat-terminal'), state = migrateSliceState(captured.final), e = state.lifeGiver.encounter;
    // The projection assertion renders the terminal panel even if this actual run died.
    renderBoundaryProjection('combat-terminal');
    await userEvent.click(screen.getByText('艾德里安原人的可选冲突', { selector: 'summary' }));
    expect(e).toMatchObject({ vitalityUses: 1, vitalitySuccesses: 0, shelterUses: 2, shelterSuccesses: 1, shelterEffects: 0, totalPlayerHealthSpent: 0 });
    const facts = screen.getByRole('region', { name: '创生者战斗实际尝试与效果' });
    for (const text of [`活性支持实际尝试${e.vitalityUses}次，成功${e.vitalitySuccesses}次`, `实际恢复原来客精力共${e.staminaRestored}`,
      `共担实际尝试${e.shelterUses}次，成功开启${e.shelterSuccesses}次`, `其中实际应用${e.shelterEffects}次、被干扰打断${e.shelterBroken}次`,
      `本人因实际分担已耗健康${e.totalPlayerHealthSpent}`, `普通出口实走${e.exitTravelMetres}米、${e.exitSeconds}秒`]) expect(facts.textContent).toContain(text);
    expect(e.totalPlayerHealthSpent).toBe(e.shelterEffects * 5);
    expect(e.enemySpirituality).toBe(120 - e.powerUses.DARK_BOLT * 7 - e.powerUses.WARD * 6 - e.powerUses.JAM * 4);
    expect(screen.getByRole('region', { name: '创生者原人遭遇' }).textContent).toContain(`${e.enemySpirituality} / 120`);
    await userEvent.click(screen.getByText('战前独立原珠与继承原纸', { selector: 'summary' }));
    const panel = screen.getByRole('region', { name: PANEL });
    for (const bead of state.lifeGiver.life.beads.filter(b => b.purpose === 'COMBAT')) {
      expect(panel.textContent).toContain(`${bead.id} · ${bead.status === 'READY' ? '尚未消耗' : '已耗尽，仍是同一实物'}`);
      expect(bead.location).toBe(state.status === 'DEAD' ? 'YARD' : 'RETURN_TRAY');
    }
  }, 20_000);

  it('uses a separate real peaceful-exit branch, physically returning the same beads without rewarding combat', async () => {
    const game = savedGame(boundary('combat-start').beforeLast), before = structuredClone(game.state);
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭创生者页面' })).toBeNull();
    await clickCommand(game, { type: 'LEAVE_ENCOUNTER' });
    expect(game.state.combat).toBeNull(); expect(game.state.combatHistory).toEqual(before.combatHistory);
    expect(game.state.lifeGiver.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', terminal: null, exitTravelMetres: 4, exitSeconds: 4, playerLocation: 'OUTSIDE' });
    expect(game.state.cash).toBe(before.cash); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(game.state.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    expect(game.state.lifeGiver.encounter.retrievedBeadIds).toEqual(before.lifeGiver.life.beads.filter(b => b.purpose === 'COMBAT').map(b => b.id));
    for (const bead of game.state.lifeGiver.life.beads.filter(b => b.purpose === 'COMBAT')) expect(bead).toMatchObject({ status: 'READY', location: 'RETURN_TRAY' });
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('reloads the exact actual terminal resources, original people and outcome without replaying attacks', async () => {
    const captured = boundary('combat-terminal'), game = savedGame(captured.final), before = structuredClone(game.state);
    await mountGame(game); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    cleanup(); delete window.sliceGame;
    const restored = savedGame(captured.final); await mountGame(restored);
    expect(restored.state).toEqual(before); expect(restored.submit).not.toHaveBeenCalled();
    expect(restored.state.summoningMaster.encounter).toEqual(before.summoningMaster.encounter);
    expect(restored.state.witchKing.encounter).toEqual(before.witchKing.encounter);
    assertLegacyPreserved(before, restored.state);
  }, 20_000);
  it('continues actual ordinary work only after real retreat and preserves the living original Adrian', async () => {
    const captured = boundary('ordinary-life-after-actual-exit'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(before.lifeGiver.encounter.terminal?.outcome).toBe('RETREATED');
    expect(before.lifeGiver.encounter).toMatchObject({ enemyHealth: 80, enemyMind: 100, enemySpirituality: 1, enemyStatus: 'RESISTING', weaponLocation: 'HAND', exitTravelMetres: 4, exitSeconds: 4 });
    expect(captured.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' });
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state).toMatchObject({ status: 'ACTIVE', week: 131, health: 70, mind: 100, spirituality: 120 });
    expect(game.state.lifeGiver).toEqual(before.lifeGiver); expect(game.state.combatHistory).toEqual(before.combatHistory);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

});
