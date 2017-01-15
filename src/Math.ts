/**
 * Rounds a uint8 up to the next higher power of two, with zero remaining at
 * zero. About 5x faster than Math.* ops and we abuse this function a lot.
 *
 * From the bit twiddling hacks site:
 * http://graphics.stanford.edu/~seander/bithacks.html#RoundUpPowerOf2
 */
export function roundUint8ToNextPowerOfTwo(value: number): number {
    value -= 1;
    value |= value >>> 1;
    value |= value >>> 2;
    value |= value >>> 4;
    value += 1;
    return value;
}

/**
 * Returns a random integer in the range [0, max)
 */
export function randn(max: number): number {
  return Math.floor(Math.random() * max);
}

/**
 * Choses a random value from the array and returns it.
 */
export function pickOne<T>(arr: T[]): T {
  return arr[randn(arr.length)];
}
