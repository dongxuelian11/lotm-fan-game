import { useEffect, useRef, useState } from 'react';
import type { SageAction, SageCommand, SageProjection } from '../domain/sage/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'RETURN_RECORD', 'RETURN_START', 'RETURN_BODY', 'REASSEMBLE', 'RETURN_OWNER', 'REMOVE_ANCHOR', 'RETURN_ITEMS', 'RITUAL_RETREAT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const ABILITY: Record<string, string> = { 'hermit.s2.information-form': '本人信息形态', 'hermit.s2.information-sift': '有限信息筛查' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或结束', READY: '已到场交谈', FIGHTING: '交战中', RETREATED: '已撤退', LOST: '本人已死亡' };
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const POSITION: Record<string, string> = { ENTRY: '原仓库门口（0米）', A: '原锚位（6米）', B: '原档架（10米）', OUTSIDE: '院外（门口外2米）', YARD: '独立后院（门口外4米）' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '当前已同意', WITHDRAWN: '已经撤回', CLOSED: '已经结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
type Attempt = NonNullable<SageProjection['life']['currentAttempt']>;
type Confirmation = { id: string; facts: string };
export interface SagePanelProps {
  value: SageProjection; busy: boolean; blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SageCommand) => void;
  /** Closing the page changes no saved scene, body, object or resource. */
  onClose?: () => void;
}

export function SagePanel({ value, busy, blocked = false, error = null, onCommand, onClose }: SagePanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null), [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null), [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null), returnActionId = useRef<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>()), heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const facts = JSON.stringify(value), locked = busy || blocked || error !== null || submittedId !== null || value.resources?.health === 0 || value.encounter.status === 'LOST';
  const { life, ritual, encounter } = value;
  const site = encounter.site ?? life.site;
  const selected = life.cases.find(c => c.id === life.activeCase) ?? life.cases.find(c => c.contactOpen || c.status === 'PREPARED')
    ?? life.cases.find(c => c.id === caseId) ?? life.cases.find(c => c.status !== 'RESOLVED') ?? life.cases[0];
  const bottle = value.bottles.find(b => b.id === bottleId)
    ?? value.bottles.find(b => value.actions.some(a => a.enabled && 'bottleId' in a.command && a.command.bottleId === b.id)) ?? value.bottles[0];
  const acquisition = value.actions.filter(a => ACQUISITION.has(a.command.type) && (!('bottleId' in a.command) || a.command.bottleId === bottle?.id));
  const ritualActions = value.actions.filter(a => a.command.type.startsWith('RITUAL_'));
  const battle = value.actions.filter(a => ENCOUNTER.has(a.command.type));
  const daily = value.actions.filter(a => !ACQUISITION.has(a.command.type) && !ENCOUNTER.has(a.command.type) && !a.command.type.startsWith('RITUAL_') && (!('caseId' in a.command) || a.command.caseId === selected?.id));
  const currentActions = encounter.inside ? battle : ritual.inside ? ritualActions : value.promoted ? daily : [...acquisition, ...ritualActions];
  const sceneLocked = value.insideCase || life.inside || ritual.inside || encounter.inside || value.preparedWeek !== null;
  const next = currentActions.find(a => a.id === value.preferredActionId) ?? currentActions.find(a => a.enabled) ?? currentActions[0];
  const immediate = currentActions.filter(a => a.enabled || a === next);
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command
    ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (error !== null && confirmation) { dialog.current?.close?.(); setConfirmation(null); return; }
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null); heading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) setConfirmation(null);
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) {
      if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal();
      cancel.current?.focus();
    } else if (submitted.current === null && returnActionId.current) (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
  }, [confirmation, error]);
  function choose(action: SageAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
    returnActionId.current = action.id; setConfirmation({ id: action.id, facts });
  }
  function submit(action: SageAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function actions(entries: SageAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled} aria-describedby={a.reason ? `sage-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }} onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`sage-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '贤者当前资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前身体与资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>排异</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
      {value.promoted && site.introducedWeek !== null && <div><dt>本场精力</dt><dd>{site.playerEnergy}/100</dd></div>}
    </dl><p>当前旧伤继续生效。信息形态、停止作用、晋升或普通离场均不免费治疗，也不补满精神和灵性。</p></section>;
  }
  function ritualFacts() {
    return <section className="seer-current-case" aria-label="贤者真实止灾仪式"><h3>{ritual.title}</h3><p>{ritual.story}</p>
      <p><strong>{ritual.status}</strong> · 本人在{ritual.location}。</p><p>{ritual.threat}</p>{ritual.damage && <p className="slice-notice seer-risk">{ritual.damage}</p>}
      {ritual.source && <details><summary>原名录与现场调查</summary><p>{ritual.source}</p></details>}
      {ritual.people.length > 0 && <section aria-label="贤者灾难现场原伤者"><h4>同两名成年馆员</h4><ul>{ritual.people.map((person, i) => <li key={i}>{person}</li>)}</ul></section>}
      {ritual.routes.length > 0 && <section aria-label="贤者两条真实传播路"><h4>传播路与唯一核心</h4><ul>{ritual.routes.map((route, i) => <li key={i}>{route}</li>)}</ul></section>}
      <p>{ritual.materials}</p><p>{ritual.stoppedRecord ?? '尚无本人已阻止灾难的记录。撤退、救人或只断一路均不算完成。'}</p><p>{ritual.review ?? '尚未完成阻止记录的专业复核。'}</p>
      {!value.promoted && <p className="seer-next"><strong>现场下一步：</strong>{ritual.nextStep}</p>}
      <p>切断传播路和封存核心都可能失败。每次尝试耗尽一份独立材料；失败会另损健康、精神并增加污染，同时毁损原记录与原板。损毁、原伤者和费用不会因撤退或服药恢复。</p>
    </section>;
  }
  function attemptFacts(a: Attempt, historical = false) {
    const formSucceeded = a.formTier === 'SUCCESS' || a.formTier === 'GREAT_SUCCESS';
    const siftSucceeded = a.siftTier === 'SUCCESS' || a.siftTier === 'GREAT_SUCCESS';
    return <div><p>{historical ? '已保存经历' : '当前尝试'} · 第{a.week}周 · {a.method === 'ABILITY' ? '能力方法' : '普通方法'} · {a.closed ? '已经收束' : '尚未收束'}。</p>
      <p>实耗{a.penniesSpent}便士、{a.spiritualitySpent}灵性、{a.mindSpent}精神、{a.energySpent}精力；本人实际移动{a.playerTravelMetres}米，经过{a.elapsedSeconds}秒。</p>
      <p>信息形态检定：{a.formTier ? TIER[a.formTier] : '尚未尝试'}。{formSucceeded && !a.appliedAbilityIds.includes('hermit.s2.information-form') && '检定成功，但尚无实际通行并重组的应用。'}{a.formTier && !formSucceeded && '检定失败，已付成本和同化暴露保留。'}实际导管通行{a.traversed ? '已经完成' : '尚未完成'}，本次重组{a.reassembled ? '已经完成' : '尚无记录'}。{a.expired && '本次有限窗口已经到期。'}</p>
      <p>信息筛取检定：{a.siftTier ? TIER[a.siftTier] : '尚未尝试'}。{siftSucceeded && !a.verified && '已取得有限片段，尚未独立核验，不能当作正确结论。'}{a.siftTier && !siftSucceeded && '筛取失败，实际成本不退；可普通阅读并核验。'}现场核验{a.verified ? '已经完成' : '尚未完成'}。</p>
      {a.information.length > 0 ? <><h4>实际取得的有限信息</h4><ul>{a.information.map((item, i) => <li key={i}>{item}</li>)}</ul></> : <p>当前尚未取得本案信息片段，不预先显示原档页答案。</p>}
      {a.correction && <p>现场核验后的修正：{a.correction}</p>}
      <p>实际应用：{a.appliedAbilityIds.map(id => ABILITY[id]).join('、') || '无'}。只有真正应用并如实报告的技巧才增加掌握；取消、普通方法、失败和成功未应用均不增加能力掌握。</p>
      <p>本案许可：{CONSENT[a.consent]}。{a.permissionWithdrawn && '许可已撤回，不继续施术。'}{a.stopped ? '已明确停止本次施术。' : '尚未明确停止。'}原物{a.itemsReturned ? '已当面交还' : '尚未完成交还'}；核实{a.inspected ? '已完成' : '尚未完成'}。</p>
      {a.ownerAccompanied && <p>原艾瑞丝已实际走到档架，{a.ownerReturned ? '并沿普通道路返回。' : '尚须亲自沿普通道路返回。'}</p>}
      {historical && <p>这是当次已保存经历，原身体、原人和原物的当前位置以当前现场为准。</p>}
    </div>;
  }
  function siteFacts() {
    const p = site, a = life.currentAttempt;
    return <section className="seer-current-case" aria-label="贤者原身体与实际现场"><h3>同一本体、原成人与原物</h3>
      <dl className="seer-facts"><div><dt>本人实际位置</dt><dd>{POSITION[p.playerLocation]}</dd></div><div><dt>本人当前形态</dt><dd>{p.body === 'SOLID' ? '完整实体' : '信息形态'}</dd></div>
        <div><dt>有限窗口</dt><dd>{p.form.active && p.form.expiresAt !== null ? `还余${Math.max(0, p.form.expiresAt - p.clockSeconds)}秒` : '当前没有信息形态窗口'}</dd></div>
        <div><dt>实际经过</dt><dd>{p.clockSeconds}秒 · 累计移动{p.playerTravelMetres}米</dd></div><div><dt>本场精力</dt><dd>{p.playerEnergy}/100 · 形态实耗{p.formEnergySpent}</dd></div><div><dt>同化暴露</dt><dd>{p.assimilationExposure}次，停止不会抹除</dd></div></dl>
      {p.iris ? <p>{p.iris.name}，{p.iris.age}岁，仍是原来的同一成年参与者；本人在{POSITION[p.iris.location]}，独立精力{p.iris.energy}/100，累计普通步行{p.iris.travelMetres}米；{CONSENT[p.iris.consent]}。既往同意不代替本案当前许可。</p> : <p>尚未当面核对原成人与原记录页；没有凭空复制或移动她。</p>}
      <p>原记录页：{p.record ? `${p.record.id}，${p.record.location === 'PLAYER' ? '本人实际持有' : '留在原主处'}，原页实际行程${p.record.travelMetres}米。` : '尚未当面核对。'}原档页始终在十米档架，已读{p.archive.readings}次，已独立核验{p.archive.verifications}次。</p>
      <p>有限导管只有锚位到档架的4米，已实际通行{p.conduit.traversals}次。{life.environment}</p>
      <details><summary>三份独立耗材与磨损</summary>{p.materials.map(m => <p key={m.id}>{m.id} · {({ SUPPLY: '尚未领取', PLAYER: '本人携带', INSTALLED: '已装在原锚位', RETURNED: '已经交还' })[m.status]} · 实付{m.paidPennies}便士 · 实际磨损{m.wear}。归还和换案都不恢复磨损。</p>)}</details>
      {a && <section aria-label="贤者本次尝试"><h4>本次实际经过</h4>{attemptFacts(a)}</section>}
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="贤者可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status]}</p><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}，{enemy.age}岁，序列{enemy.sequence}；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120。{enemy.status === 'DEAD' ? '已经死亡，原身体留在后院。' : enemy.status === 'SURRENDERED' ? '已经投降，停止抵抗。' : '仍有自己的判断与抵抗。'}</p>
        <p>同一原棍（{enemy.weaponId}）{enemy.weaponLocation === 'HAND' ? '仍在本人手中。' : '留在后院原交战位置。'}</p><p>弧光已用{enemy.powerUses.ARC_BOLT}次（每次5灵性）；屏护已用{enemy.powerUses.WARD}次（每次4灵性）；假动作已用{enemy.powerUses.FEINT}次（实际耗费时每次3灵性）。</p></>}
      {encounter.preparation ? <p>第{encounter.preparation.week}周已实际花{encounter.preparation.mindPaid}精神整理注意力；没有领取新卷轴，也没有补满资源。</p> : <p>尚未完成本场另行付费的注意力准备。</p>}
      <ul>{encounter.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      <p>这场冲突是额外选择，不能补做晋升前的止灾仪式。信息形态仅缓冲随后一次真实身体攻势；筛取只准备下一次真实攻击的有限加成，均不提前造成伤害。</p>
    </section>;
  }
  function operationDetails() {
    const command = liveConfirmation?.command;
    switch (command?.type) {
      case 'LEARN_GUIDANCE': return <p>本次只听取指导，按上方列明费用支付。必须亲自阻止实际灾难并完成复核；听取指导和取得药瓶不能代替止灾。</p>;
      case 'REQUEST_SUPPLY': return <p>申请后还须等下一真实周确认到货。申请不立即补瓶，后续每瓶仍须独立劳动或付费取得。</p>;
      case 'RECEIVE_SUPPLY': return <p>只接收实际到货的独立原瓶。各瓶劳动、购买、准备和饮用分别确认。</p>;
      case 'POTION_WORK': return <p>只完成这一瓶的一次真实劳动并保存进度；不会自动购买或服药。已付成本不因取消后续步骤而退还。</p>;
      case 'BUY_POTION': return <p>支付上方列明余款，只领取这一独立原瓶。领取不完成止灾，不代替本周检查或饮用。</p>;
      case 'PREPARE_PROMOTION': return <p>本次支付列明的行动和检查费，实际准备本周服药场地。退出后检查失效、费用不退；原瓶仅在另行确认饮用时耗尽。</p>;
      case 'LEAVE_PREPARATION': return <p>实际结束本次场地检查，已付检查费用不退；未饮用的原瓶保留，下次重新付费检查。</p>;
      case 'CONSUME': return <><p className="slice-notice seer-risk">{value.risk}</p><p>本瓶和当次场地检查无论成功失败都会耗尽。失败须实际恢复、另筹独立原瓶并重新检查；成功只开放两项新技巧。已有掌握、旧伤、原人和原物保留，不免费治疗、不补满当前灵性。</p></>;
      case 'RITUAL_BUY_SEALS': return <p>0行动、120便士，实际取得三份独立封缄材料。每次截路或封存尝试均耗一份，失败不返还；购买不会自动进入现场、止灾或修复旧损毁。</p>;
      case 'RITUAL_VISIT': return <p>沿普通门道实际步行6米到原门厅，经过6秒。原高层次信息洪流仍在，进入不会替你研究、疏散或止灾，原馆继续封闭。</p>;
      case 'RITUAL_STUDY': return <p>支付1行动、4灵性和2精神，亲自研究原移交卷与两条实际传播路，现场研究经过60秒。此时又一份原记录会被覆写，损毁不可撤销；研究本身不停止灾难，不提前获得贤者能力。</p>;
      case 'RITUAL_EVACUATE': return <p>支付1行动，你亲自回原门厅并护送同两名成年伤者沿6米普通通道到馆外，另经30秒照应。疏散保留他们原有的伤势和精神损耗；核心和未切断回路仍活跃，救出人员不等于止灾。</p>;
      case 'RITUAL_CUT_PLATE':
      case 'RITUAL_CUT_INDEX':
      case 'RITUAL_CONTAIN': return <><p>你沿实际通道走到{command.type === 'RITUAL_CUT_PLATE' ? '刻印板间' : command.type === 'RITUAL_CUT_INDEX' ? '索引间' : '地下核心间'}。本次支付1行动、{command.type === 'RITUAL_CONTAIN' ? '8' : '6'}灵性、2精神，经过30秒，耗尽一份未用封缄材料，按知识难度{command.type === 'RITUAL_CONTAIN' ? '25' : '20'}检定。</p>
        <p className="slice-notice seer-risk">失败另损4健康、4精神、增加4污染；严重失败另损8健康、8精神、增加8污染。原记录及原刻印板继续损毁，失败材料不退，目标保持活跃。旧伤不会被消除。</p><p>{command.type === 'RITUAL_CONTAIN' ? '只有两条路已实际截断且本次核心封存成功，才生成本人阻止灾难的真实记录；之后仍须普通退出并复核。' : '本次成功只切断这一条原路，另一路和唯一核心仍需分别处理。'}可以实际撤出恢复和补购，已完成步骤与原损毁继续保留。</p></>;
      case 'RITUAL_RETREAT': return <p>按上方实际距离沿原普通通道退出，逐米经过真实时间。没有停止的核心和传播路继续存在；撤退不构成止灾，不退灵性、精神、费用或耗材，也不治疗伤者。</p>;
      case 'RITUAL_REVIEW': return <p>须你已真实退出到馆外，并持有本人切断两路及封存唯一核心的记录，才能逐项完成专业复核。复核保留原伤者和损毁，不重复结算止灾，也不替你饮药。</p>;
      case 'PREPARE': return <p>支付20便士领取本案唯一耗材，同时借取原艾瑞丝的同一记录页。{command.method === 'ORDINARY' ? '采用普通方法，不增加未应用的新能力掌握。' : '准备本身不施术，不移动身体，也不自动核验资料。'}后续取消、失败或许可撤回均不退款，仍须实际归还。</p>;
      case 'INFORMATION_FORM': return <p>支付1行动、8灵性（包含重新凝聚的预付成本）、2精神和2精力，按知识难度20尝试。成功只在已装锚处开启20秒有限信息形态；仍须真实沿4米导管移动并原地重组。成功开窗不等于应用，失败也留下成本、耗材磨损和同化暴露。</p>;
      case 'TRAVERSE_CONDUIT': return <p>同一本体携实持原页沿已核实导管前行4米，耗4秒和4精力。不会复制身体或携带他人，也不能越过未知空间；到达后还须重新凝聚，并留10米普通返回余力。</p>;
      case 'REASSEMBLE': return <p>在当前实际位置恢复同一个实体，不移动到起点，不退预付成本，也不治疗旧伤或补充资源。</p>;
      case 'SIFT_INFORMATION': return <p>支付1行动、6灵性和2精神，按知识难度20筛取眼前原档页已存在的有限信息，并留下同化暴露。失败同样付费；成功也可能读到旧错注和缺文，必须实际核验，不自动取得正确答案。</p>;
      case 'VERIFY_INFORMATION': return <p>本人在原档架现场检查实际格位，核对已取得的片段并保存修正。缺失的正文仍然未知，不凭能力补齐；核验不取消此前错误或成本。</p>;
      case 'READ_ARCHIVE': return <p>用普通方法阅读眼前同一原档页，支付列明行动并经过6秒。旧注仍可能错误，随后须独立核验；普通阅读不增加筛取掌握。</p>;
      case 'WALK': return <p>本人沿普通道路走到{POSITION[command.to]}，每米实际花1秒和1精力，并保留取回原锚与普通返回的余力。只有实际携带的原物随行。</p>;
      case 'INSTALL_ANCHOR': return <p>本人到六米锚位后亲手安装本案唯一锚纸，经过2秒；安装不施术、不补次数，也不重置耗材磨损。</p>;
      case 'REMOVE_ANCHOR': return <p>本人须已在原锚位恢复实体，亲手取回同一耗材，经过2秒。耗材磨损保留，取下仍须携回交还。</p>;
      case 'INVITE_OWNER': return <p>在本案当前同意下，由原艾瑞丝亲自沿6米和4米普通道路到档架，实际花10秒和她自己的10精力，并留10精力返回。你不会带她信息化，也不替她决定后续许可。</p>;
      case 'RETURN_OWNER': return <p>你在门口确认后，原艾瑞丝亲自沿4米和6米普通道路返回，实际花10秒与她自己的10精力；这不是瞬移或恢复精力。</p>;
      case 'RETURN_ITEMS': return <p>你在门口将本人实持的原记录页和同一耗材当面交给已到场的原艾瑞丝。归还需实际经过2秒，不退费用或磨损。</p>;
      case 'WITHDRAW_PERMISSION': return <p>尊重艾瑞丝撤回本案许可，立即停止施术并在当前原位置重组；仍须普通返回、收回原锚和当面归还，已付成本保留。</p>;
      case 'STOP': return <p>停止新的施术并在当前原位置恢复实体，经过2秒。停止不替你步行返回、归还物品或带回原成人；已付费用、暴露与磨损保留。</p>;
      case 'WAIT_10': return <p>现场实际经过10秒，有限窗口可能到期并在当前原位置重新凝聚。等待不会延长能力、恢复成本或重开尝试。</p>;
      case 'ENCOUNTER_FIGHT': return <><p className="slice-notice seer-risk">本次真正开战，双方独立身体、原武器与有限灵性可能带来轻伤、重伤、撤退或死亡。</p><p>信息形态和筛查都是付费的有限准备。成功准备仍须等待实际攻击应用，失败、过期或被干扰的成本不退。旧卷轴仅消耗实际持有并获准使用的库存，不免费生成。</p></>;
      case 'PREPARE_ENCOUNTER': return <p>只完成列明成本的战前准备；不会恢复身心、灵性或本场精力，不赠送新卷轴，也不替本人开战。</p>;
      case 'ENCOUNTER_TALK': return <p>只按当前同意和实际路线到场交谈；成人须真实退出接触区，本人也须实际走入院落。交谈不会自动开战，已耗精力和时间保留。</p>;
      case 'LEAVE_ENCOUNTER': return <p>沿原普通出口实际离开；原对手和原武器留在现场，旧伤、灵性、步行和已耗原卷保留。</p>;
      default: return <p>只执行上方列出的这一步，按当前实际成本与条件结算。确认不会自动代办下一步，取消不提交；已完成的路程、损毁和消耗不能借关闭页面撤销。</p>;
    }
  }

  return <section className="seer-panel warrior-panel sage-panel" aria-label="贤者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="贤者当前目标"><span className="seer-seal">{value.promoted ? '贤者 · 隐者途径序列2' : '预言大师3 → 贤者2'}</span><h2 ref={heading} tabIndex={-1}>{value.title}</h2><p>{value.story ?? life.story}</p>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 || encounter.status === 'LOST' ? '本周目已经死亡，原身体、原人和原物记录只读保留。' : value.nextStep.replace(/^下一步[：:]\s*/, '') || (next ? `${next.label} · ${next.cost}` : '查看已保存经历或继续普通生活。')}</p>
      <p>{value.digestion}</p><p>已有技巧保持原掌握；本人信息形态与有限信息筛查两项新技巧按真正应用分别记录。准备成功本身不算实际应用。</p></section>
    {resources()}<p className="slice-notice seer-risk">{value.risk}</p>
    {error !== null && <p role="alert">{typeof error === 'string' ? error : error.message} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在等待同一次操作保存；重复点击、清除错误或时间经过都不会再次扣除资源。</p>}
    {blocked && <p role="status">请先处理当前阻塞事项。本页暂不能提交新操作。</p>}
    {!value.promoted && <section aria-label="贤者独立药瓶与准备"><h3>独立药瓶与服药准备</h3><p>{value.supplies}</p>
      <label className="seer-case-selector">查看药瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>{value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}</select></label>
      {bottle && <article><h4>{bottle.title}</h4><p>{bottle.source}</p><p>当前状态：{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次场地检查：{value.preparedWeek === null ? '尚未进行' : `第${value.preparedWeek}周已完成`}。止灾、复核、取得原瓶、场地检查与服药分别完成。</p></section>}
    {!value.promoted ? ritualFacts() : <details className="seer-fold"><summary>本人阻止灾难的记录</summary>{ritualFacts()}</details>}
    {value.promoted && <section aria-label="贤者两项新技巧"><h3>两项新技巧</h3>{value.abilities.filter(a => Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>}
    {value.promoted && <>{siteFacts()}{!encounter.inside && <section className="seer-current-case" aria-label="贤者当前实践"><h3>本次实践</h3>
      <label className="seer-case-selector">查看实践<select value={selected?.id ?? ''} disabled={locked || confirmation !== null || sceneLocked} onChange={e => setCaseId(e.target.value)}>{life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? '已有记录'}</option>)}</select></label>
      {selected && <><h4>{selected.title} · {STATUS[selected.status] ?? '已有记录'}</h4><p>{selected.story}</p><ul>{selected.observations.map((fact, i) => <li key={i}>{fact}</li>)}</ul>{selected.result && <p className="slice-notice">{selected.result}</p>}{!life.currentAttempt && selected.attempts.at(-1) && <section aria-label="贤者本案最近记录"><h4>最近的已保存经历</h4>{attemptFacts(selected.attempts.at(-1)!, true)}</section>}</>}
    </section>}</>}
    {value.promoted && encounter.inside && encounterFacts()}
    <section aria-label="贤者当前行动"><h3>{sceneLocked ? '当前现场的下一步' : '当前可选行动'}</h3>{actions(immediate.filter(a => !RETURN.has(a.command.type)), '贤者当前步骤')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="贤者实际停止与返回"><h4>停止、归还与普通返回</h4>{actions(immediate.filter(a => RETURN.has(a.command.type)), '贤者收尾步骤')}<p>每一步独立确认。关闭页面不等于现场收束；0行动步骤仍须支付列明的时间、精力和其它实际成本。</p></section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '贤者未满足条件的步骤')}</details>}
    </section>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>后院里的可选冲突</summary>{encounterFacts()}{actions(battle, '贤者可选遭遇行动')}</details>}
    {value.promoted && <details className="seer-fold"><summary>三案经历与实际应用</summary><p>{life.story}</p>{life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? '已有记录'}</h4><p>{c.result ?? '尚无已报告结果。'} · 已实际收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</article>)}<p>三案如实报告各记录25消化，末次反思25；普通方法和未应用的能力不增加掌握。</p></details>}
    <details className="seer-fold"><summary>身体与已有经历</summary><p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。已有掌握保持原值，旧伤和原身体继续保留。</p><p>{value.appearanceRecord}</p><ul>{value.inheritedHistory.map((fact, i) => <li key={i}>{fact}</li>)}</ul><p>{value.inheritedTools}</p>
      <section aria-label="贤者已有技巧与掌握"><h4>已有技巧与实际掌握</h4>{value.abilities.filter(a => !Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>
      <p>{value.environment}</p><p>序列1尚未开放。</p></details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || sceneLocked || confirmation !== null} onClick={() => { if (!locked && !sceneLocked && !confirmation) onClose(); }}>关闭贤者页面</button>}
    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="sage-confirm-title" aria-describedby="sage-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={e => { e.preventDefault(); if (!locked) setConfirmation(null); }} onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!locked) setConfirmation(null); }
        if (e.key === 'Tab') { const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')), first = controls[0], last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
      }}><h3 id="sage-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '当前条件已改变，请返回最新状态。'}</p><p id="sage-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {operationDetails()}{resources('贤者操作确认当前资源')}{liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button><button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交、不扣资源。提交后等待同一次保存；关闭确认或页面不能替代实际停手、归还和普通返回。</p>
    </dialog>}
  </section>;
}
