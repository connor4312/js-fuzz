import { randn } from "../../Math";

/**
 * Chooses a random length, favoring small numbers.
 */
export function chooseLength(max: number): number {
  const x = randn(100);
  if (x < 90) {
    return randn(Math.min(8, max)) + 1;
  }
  if (x < 99) {
    return randn(Math.min(32, max)) + 1;
  }

  return randn(max) + 1;
}

/**
 * Decorator that dupes a buffer.
 */
export function dupe(buf: Buffer): Buffer {
  const output = Buffer.allocUnsafe(buf.length);
  buf.copy(output);
  return output;
}

/**
 * Rough "wrapping" function that ensure a number is in the range [0, threshold)
 */
export function roughWrap(input: number, threshold: number) {
  if (input >= threshold) {
    return 0;
  }
  if (input < 0) {
    return threshold - 1;
  }

  return input;
}

export const enum CharCodes {
  Zero = 48,
  Nine = 57,
  Dash = 45,
}
