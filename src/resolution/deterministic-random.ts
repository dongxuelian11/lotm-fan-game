export interface ActionRandomStream {
  readonly seed: string;
  readonly cursor: number;
  nextInt(minimum: number, maximum: number): number;
}

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function assertBoundedRange(minimum: number, maximum: number): void {
  if (
    !Number.isSafeInteger(minimum) ||
    !Number.isSafeInteger(maximum) ||
    minimum > maximum ||
    maximum - minimum >= 0x1_0000_0000
  ) {
    throw new RangeError("random range is invalid");
  }
}

/** A recordable, browser-safe stream. It never uses wall-clock time or Math.random. */
export class DeterministicActionRandomStream implements ActionRandomStream {
  private nextCursor: number;

  public constructor(
    public readonly seed: string,
    cursor = 0,
  ) {
    if (typeof seed !== "string" || seed.length === 0 || seed.length > 256) {
      throw new TypeError("random seed is invalid");
    }
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      throw new RangeError("random cursor is invalid");
    }
    this.nextCursor = cursor;
  }

  public get cursor(): number {
    return this.nextCursor;
  }

  public nextInt(minimum: number, maximum: number): number {
    assertBoundedRange(minimum, maximum);
    const span = maximum - minimum + 1;
    const value = hashSeed(`${this.seed}\u0000${this.nextCursor}`) % span;
    if (this.nextCursor === Number.MAX_SAFE_INTEGER) {
      throw new RangeError("random cursor exhausted");
    }
    this.nextCursor += 1;
    return minimum + value;
  }
}
