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
