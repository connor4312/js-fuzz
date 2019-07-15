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
 * Max int32 value.
 */
export const maxInt32 = 2147483647;

let rng = Math.random;

/**
 * Resets the random number generator to use. For use in testing.
 */
export function resetRandomNumberGenerator() {
  rng = Math.random;
}

/**
 * Sets the random number generator to use. For use in testing.
 */
export function setRandomNumberGenerator(generator: () => number) {
  rng = generator;
}

/**
 * Returns a random integer in the range [0, max)
 */
export function randn(max: number): number {
  return Math.floor(rng() * max);
}

/**
 * Choses a random value from the array and returns it.
 */
export function pickOne<T>(arr: ReadonlyArray<T>): T {
  return arr[randn(arr.length)];
}

/**
 * Creates an RNG. For use in testing.
 * @see https://en.wikipedia.org/wiki/Xorshift
 */
export function createRandomNumberGenerator(seed: number) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >> 7;
    seed ^= seed << 17;
    return Math.abs(seed) / maxInt32;
  };
}
