/** Original finite G cove. life.site is the sole mutable environmental truth. */
export interface CatastropheSiteState {
  id: 'CT2-COVE'; boundaryMetres: 12; clockSeconds: number;
  playerPosition: 'EXIT' | 'CONTROL' | 'PLATFORM'; playerTravelMetres: number;
  keeper: { id: 'CT2-NORA'; name: '诺拉'; age: 45; alive: true; position: 'CONTROL' | 'EXIT'; energy: number; travelMetres: number };
  water: { id: 'CT2-WATER'; originalUnits: 20; bayUnits: number; channelUnits: number };
  gate: { id: 'CT2-GATE'; owner: 'CT2-NORA'; position: 'CLOSED' | 'OPEN' | 'BROKEN'; durability: number; operations: number };
  buoy: { id: 'CT2-BUOY'; owner: 'CT2-NORA'; offsetMetres: number };
  mooring: { id: 'CT2-MOORING'; owner: 'CT2-NORA'; durability: number };
  winch: { id: 'CT2-WINCH'; owner: 'CT2-NORA'; durability: number };
  wheel: { id: 'CT2-WHEEL'; owner: 'CT2-NORA'; durability: number; turns: number };
}
export function createCatastropheSiteState(): CatastropheSiteState {
  return {
    id: 'CT2-COVE', boundaryMetres: 12, clockSeconds: 0, playerPosition: 'EXIT', playerTravelMetres: 0,
    keeper: { id: 'CT2-NORA', name: '诺拉', age: 45, alive: true, position: 'CONTROL', energy: 100, travelMetres: 0 },
    water: { id: 'CT2-WATER', originalUnits: 20, bayUnits: 20, channelUnits: 0 },
    gate: { id: 'CT2-GATE', owner: 'CT2-NORA', position: 'CLOSED', durability: 100, operations: 0 },
    buoy: { id: 'CT2-BUOY', owner: 'CT2-NORA', offsetMetres: 0 },
    mooring: { id: 'CT2-MOORING', owner: 'CT2-NORA', durability: 100 },
    winch: { id: 'CT2-WINCH', owner: 'CT2-NORA', durability: 100 },
    wheel: { id: 'CT2-WHEEL', owner: 'CT2-NORA', durability: 100, turns: 0 },
  };
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
/** Shape/resource validity only; life and encounter validators additionally prove ordered provenance. */
export function validateCatastropheSiteState(v: unknown): v is CatastropheSiteState {
  if (!record(v) || !shape(v, ['id', 'boundaryMetres', 'clockSeconds', 'playerPosition', 'playerTravelMetres', 'keeper', 'water', 'gate', 'buoy', 'mooring', 'winch', 'wheel']) ||
      v.id !== 'CT2-COVE' || v.boundaryMetres !== 12 || !integer(v.clockSeconds) || !integer(v.playerTravelMetres) || !['EXIT', 'CONTROL', 'PLATFORM'].includes(String(v.playerPosition))) return false;
  const { keeper, water, gate, buoy, mooring, winch, wheel } = v;
  if (!record(keeper) || !shape(keeper, ['id', 'name', 'age', 'alive', 'position', 'energy', 'travelMetres']) || keeper.id !== 'CT2-NORA' || keeper.name !== '诺拉' || keeper.age !== 45 || keeper.alive !== true ||
      !['CONTROL', 'EXIT'].includes(String(keeper.position)) || !integer(keeper.energy, 0, 100) || !integer(keeper.travelMetres) || keeper.travelMetres % 6 !== 0 || keeper.energy !== 100 - keeper.travelMetres / 3) return false;
  if (!record(water) || !shape(water, ['id', 'originalUnits', 'bayUnits', 'channelUnits']) || water.id !== 'CT2-WATER' || water.originalUnits !== 20 ||
      !integer(water.bayUnits, 0, 20) || !integer(water.channelUnits, 0, 20) || water.bayUnits + water.channelUnits !== 20) return false;
  if (!record(gate) || !shape(gate, ['id', 'owner', 'position', 'durability', 'operations']) || gate.id !== 'CT2-GATE' || gate.owner !== 'CT2-NORA' ||
      !['CLOSED', 'OPEN', 'BROKEN'].includes(String(gate.position)) || !integer(gate.durability, 0, 100) || !integer(gate.operations, 0, 100) || gate.durability !== 100 - gate.operations || (gate.position === 'BROKEN') !== (gate.durability === 0)) return false;
  if (!record(buoy) || !shape(buoy, ['id', 'owner', 'offsetMetres']) || buoy.id !== 'CT2-BUOY' || buoy.owner !== 'CT2-NORA' || !integer(buoy.offsetMetres, 0, 8)) return false;
  for (const [object, id] of [[mooring, 'CT2-MOORING'], [winch, 'CT2-WINCH']] as const) if (!record(object) || !shape(object, ['id', 'owner', 'durability']) || object.id !== id || object.owner !== 'CT2-NORA' || !integer(object.durability, 0, 100)) return false;
  return record(wheel) && shape(wheel, ['id', 'owner', 'durability', 'turns']) && wheel.id === 'CT2-WHEEL' && wheel.owner === 'CT2-NORA' &&
    integer(wheel.durability, 0, 100) && integer(wheel.turns, 0, 100) && wheel.durability === 100 - wheel.turns;
}
