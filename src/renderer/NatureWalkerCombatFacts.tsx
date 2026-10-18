import type { NatureWalkerCombatProjection, NatureWalkerPublicRoundOutcome } from '../domain/nature-walker/combat.js';
import type { SliceCombatRound, SliceProjection } from '../domain/slice/types.js';
import { playerText } from '../shared/player-text.js';

const displayNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
export function natureWalkerProse(text: string, characterName?: string): string {
  const tiers: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', GREAT_FAILURE: '严重失败', FAILURE: '失败' };
  const authored = (part: string) => playerText(part).replace(/\b(GREAT_SUCCESS|SUCCESS|GREAT_FAILURE|FAILURE)\b/g, tier => tiers[tier]!);
  return characterName ? text.split(characterName).map(authored).join(characterName) : authored(text);
}

export function NatureWalkerActionSequence({ actions, characterName }: { actions: NatureWalkerCombatProjection['lastActionSequence']; characterName?: string }) {
  const attack: Record<string, string> = { NONE: '本槽没有直接攻击', BODY: '实际身体打击', ARC: '实际弧光冲击，按身体后果处理', MIND: '实际精神压力，不生成身体伤口' };
  const fallback: Record<string, string> = {
    POLICY: '本次选择不使用此术，按普通行动处理。',
    ACTIVE_WINDOW: '同一待用作用仍有效，本次不重复施术或收费。',
    INSUFFICIENT_RESOURCES: '实际资源不足，采用普通替代，不透支或补发物品。',
    S2_RESOURCES_UNAVAILABLE: '本次条件不足，按实际资源执行继承能力。',
    PENDING_OR_RESOURCES: '已有未用影响或资源不足，本次普通观察。',
    NO_ORIGINAL_LIVING_PLANT_CARE_EVENT: '原活苗已归还并留在交战区外，本槽仅普通观察；不收费或产生身体加成。',
    FINITE_ENEMY_RESOURCES_UNAVAILABLE: '对手的有限资源不足，本次沿实际原杖作身体攻击。',
  };
  return actions.length > 0 && <ol aria-label="自然行者实际动作">{actions.map(action => <li key={`${action.actor}-${action.order}`}>
    <strong>{action.actor === 'PLAYER' ? '本人' : '对手'}第{action.order + 1}槽：{natureWalkerProse(action.label, characterName)}</strong>
    <p>实耗{action.paidCost}灵性、{action.mindCost}精神；自身优势{displayNumber(action.selfGain)}，减势{displayNumber(action.enemyReduction)}。现场第{action.atSeconds}秒开始，实际经过{action.elapsedSeconds}秒，普通移动{action.travelMetres}米。</p>
    <p>{attack[action.attackKind]}；原贡献{displayNumber(action.rawContribution)}，原减势{displayNumber(action.rawReduction)}。</p>
    {action.supportId && <p>实际消耗同一枚独立支撑片，磨损{action.supportWearPaid}；{action.succeeded ? '本次施术成功，仍须后续合格冲击才会实际应用。' : '本次施术未建立影响，已付成本保留。'}</p>}
    {action.guardSegmentId && <p>本槽实际消耗同一原护腕的一段，已经用掉的原段不会补发；它与原根纤维衬垫分别记账。</p>}
    {action.recoveredHealth > 0 && <p>继承的有限生命支持实付本槽费用，使本人健康从{action.playerHealthBefore}恢复至{action.playerHealthAfter}；实际恢复{action.recoveredHealth}，旧伤与伤势风险仍保留。</p>}
    {action.enemyChargeId && <p>对手实际消耗一枚原刻片，已经发生的攻击与费用保留。</p>}
    {action.fallbackReason && <p>{fallback[action.fallbackReason] ?? '本次按现场条件采用普通替代，已付成本保留。'}</p>}
    {action.resisted && <p>对手已经实际抵抗，本次已付灵性、精神与实物不退。</p>}
    {action.padWear > 0 && <p>这次实际冲击使同一原根纤维衬垫磨损{action.padWear}，当前完整度{action.rootPadAfter.integrity}。</p>}
    {action.windowsApplied.map((window, index) => <p key={`${window.kind}-${index}`}>{window.kind === 'ROOT_BEARING' ? `先前付费的根系承冲现已为这次身体或弧光冲击减去${displayNumber(window.amount)}贡献；没有取消原攻击与费用。` : '本人对同一原活苗的照料辅助已按实际记录应用。'}同一作用已经用尽。</p>)}
    <p>本槽后本人精神{action.playerMindAfter}、灵性{action.playerSpiritualityAfter}；对手灵性{action.enemySpiritualityAfter}。</p>
  </li>)}</ol>;
}

export function NatureWalkerRoundFacts({ outcome, consequenceDomain, characterName }: { outcome: NatureWalkerPublicRoundOutcome; consequenceDomain: SliceCombatRound['consequenceDomain']; characterName?: string }) {
  const windows = [outcome.rootBearing].filter(window => window !== null);
  return <section aria-label="自然行者本回合实际记录">
    <h3>实际冲击、原根垫与有限支撑片</h3>
    <p>回合结束：本人健康{outcome.playerHealthAfter}、精神{outcome.playerMindAfter}、灵性{outcome.playerSpiritualityAfter}；对手健康{outcome.enemyHealth}、精神{outcome.enemyMind}、灵性{outcome.enemySpirituality}。</p>
    <p>本回合实际经过{outcome.elapsedSeconds}秒；回合结算时现场时钟{outcome.siteAfter.clockSeconds}秒，本人累计普通移动{outcome.siteAfter.playerTravelMetres}米，对手累计普通移动{outcome.enemyTravelMetres}米。{outcome.continuing ? '交战仍在继续，未用作用按原截止时间保留；到期即止。' : outcome.playerHealthAfter > 0 ? '冲突已经停止，随后沿普通路实际走4米、经过4秒回到室外。' : '本人原身体已经死亡，留在原处，不能步行离场。'}</p>
    <p>独立支撑片余{outcome.supportPieces.filter(piece => piece.status === 'HELD').length}/{outcome.supportPieces.length}枚，累计实际磨损{outcome.supportPieces.reduce((total, piece) => total + piece.wear, 0)}；对手原刻片余{outcome.enemyCharges.filter(piece => piece.status === 'HELD').length}/{outcome.enemyCharges.length}枚。原根纤维衬垫当前完整度{outcome.rootPadAfter.integrity}。</p>
    <p>同一原护腕未用{outcome.siteAfter.guard.segments.filter(segment => segment.status === 'UNUSED').length}段、已耗{outcome.siteAfter.guard.segments.filter(segment => segment.status === 'SPENT').length}段；不补发原段，也不恢复根垫磨损。</p>
    <p>本人现存伤势{outcome.playerInjuriesAfter.length}处，伤势风险{outcome.playerRiskAfter}；对手伤势{outcome.enemyInjuries.length}处，伤势风险{outcome.enemyRisk}。对手{outcome.enemyStatus === 'DEAD' ? '已死亡' : outcome.enemyStatus === 'SURRENDERED' ? '已自主停止抵抗' : '仍可抵抗'}，唯一原杖{outcome.weaponLocation === 'HAND' ? '仍由对手持有' : '留在旁院原地'}。</p>
    <p>{consequenceDomain === 'BODY' ? '本回合按实际身体打击或弧光冲击结算身体伤势。' : consequenceDomain === 'MENTAL' ? '本回合只结算实际精神压力，不生成身体伤口。' : '本回合没有实际致伤来源，不掷身体伤势盘。'}根系承冲不削减精神攻击。生机辨应在本场没有原活苗照料对象，只作普通观察。</p>
    {windows.map(window => <p key={window.kind}>下一身体或弧光冲击的至多30减轻，结算时还剩{Math.max(0, window.expiresAt - outcome.siteAfter.clockSeconds)}秒，仅可应用{window.remaining}次。</p>)}
    {outcome.expiredWindows.length > 0 && <p>本回合{outcome.expiredWindows.length}份未用作用已到期，成本保留。</p>}
    {outcome.cancelledWindows.length > 0 && <p>冲突停止时撤销{outcome.cancelledWindows.length}份未用作用，已付费用与支撑片不退。</p>}
    <NatureWalkerActionSequence actions={[...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order)} {...(characterName ? { characterName } : {})}/>
  </section>;
}

export function NatureWalkerCombatFacts({ value, state }: { value: NatureWalkerCombatProjection; state: SliceProjection }) {
  const policy = state.natureWalker.encounter.policy;
  return <section className="slice-notice" aria-label="自然行者本回合实际资源">
    <h3>当前身体、原根垫与有限支撑片</h3>
    <p>本人健康{state.health}/{state.maxHealth} · 精神{state.mind}/{state.maxMind} · 灵性{state.spirituality}/{state.maxSpirituality}；{value.enemyName}健康{value.enemyHealth}/100 · 精神{value.enemyMind}/100 · 独立灵性{value.enemySpirituality}/100。</p>
    <p>本次独立支撑片余{value.supportPieces.filter(piece => piece.status === 'HELD').length}/{value.supportPieces.length}枚，累计实际磨损{value.supportPieces.reduce((total, piece) => total + piece.wear, 0)}；对手原刻片余{value.enemyCharges.filter(piece => piece.status === 'HELD').length}/{value.enemyCharges.length}枚。原根纤维衬垫当前完整度{value.rootPad?.integrity ?? 0}。</p>
    {value.oldGuard && <p>同一原护腕未用{value.oldGuard.segments.filter(segment => segment.status === 'UNUSED').length}段、已耗{value.oldGuard.segments.filter(segment => segment.status === 'SPENT').length}段；这是原根纤维衬垫以外的另一份有限实物。</p>}
    <p>双方实际相距{value.enemyDistanceMetres}米，普通出口还须步行{value.exitMetres}米；现场时钟{value.clockSeconds}秒，本人累计普通移动{value.playerTravelMetres}米，对手累计普通移动{value.enemyTravelMetres}米。原杖{value.weaponLocation === 'HAND' ? '仍由伊莱亚斯持有' : '留在旁院原地'}。</p>
    <p>艾达、莉娜与同一原活苗已在交战区外；马丁与诺兰此前投降的实际结果保留。本场双方每轮最多{value.maxActionCount}次行动，次数与能力按公开轮盘结算。</p>
    <p>本场选择：{policy === 'ALL' ? '保留两项新能力的实际适用条件' : policy === 'LIVING_RESPONSE' ? '保留生机辨应与继承能力' : policy === 'ROOT_BEARING' ? '允许根系承冲与继承能力' : '只作普通行动'}。生机辨应在这里没有照料对象，抽到时只作零超凡费用的普通观察。</p>
    <p>根系承冲实耗8灵性、2精神、一枚支撑片；失败总耗4精神。作用二十秒内仅用一次，实际应用时原根垫磨损15；不抵挡精神攻击。原护腕段是另份实物，已用段不补发。</p>
    {value.windows.map(window => <p key={window.kind}>{window.kind === 'ROOT_BEARING' ? '下一未结算身体或弧光冲击的至多30减轻' : '同一原活苗下一次照料核查的有限辅助'}还剩{window.remainingSeconds}秒，可用{window.remaining}次；期限按现场实际经过时间计算。</p>)}
    <NatureWalkerActionSequence actions={value.lastActionSequence} characterName={state.character.name}/>
    <p>{natureWalkerProse(value.summary, state.character.name)}</p>
  </section>;
}
