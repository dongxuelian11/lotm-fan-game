/** Fixed world registry, authored before arrival. Include this complete record
 * in foolWorldDigest(). Reading a projection does not instantiate the accident.
 * Its actual scene clock/consent/guard-intent receipts bind START_ESCAPE. */
export const FOOL_ESCAPE_WORLD_RECORD = Object.freeze({
  id: 'FOOL0-ORIGINAL-VAULT-ACCIDENT', version: 1, location: 'base',
  registryId: 'F208-WORLD-VAULT-FAULTED-LINTEL', sourceEra: 'CONTEMPORARY',
  startsOnlyOn: 'START_ESCAPE',
  messengerA: { id: 'F208-ESCAPE-SULAI', name: '苏莱', age: 38, health: 100, place: 'DOOR', satchelId: 'F208-ESCAPE-SULAI-SATCHEL' },
  messengerB: { id: 'F208-ESCAPE-LIEN', name: '莉恩', age: 42, health: 100, place: 'DOOR', satchelId: 'F208-ESCAPE-LIEN-SATCHEL' },
  guard: { id: 'F208-ESCAPE-VICTOR', name: '维克托', age: 47, health: 100, place: 'CORRIDOR', batonId: 'F208-ESCAPE-VICTOR-BATON',
    pendingLookOnPassage: true, pendingPursuitAfterPassage: true, instinctiveStop: true },
  doorId: 'F208-ESCAPE-ORIGINAL-DOOR', sealedCrateId: 'F208-ESCAPE-ORIGINAL-POST-CRATE',
  conditionId: 'F208-ESCAPE-ORIGINAL-CLEAR-SIGHT',
} as const);

/** An optional natural-language preview. The actual private guard intentions,
 * deadlines, dice and the registry record above must not be projected. */
export const FOOL_ESCAPE_PUBLIC_PREVIEW = '封存库里有两名当代成年信使苏莱与莉恩，看守维克托也在值守。库门落物后的短撤离需要本人到场，沿原门、通廊与出口救出原人；人和邮袋都不能凭空移走。';
