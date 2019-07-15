import { randomBytes } from 'crypto';
import { pickOne, randn, maxInt32 } from '../Math';
import { interesting8Bits, interesting16Bits, interesting32Bits } from './interesting-bits';

/**
 * Chooses a random length, favoring small numbers.
 */
function chooseLength(max: number): number {
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
function dupe(buf: Buffer): Buffer {
  const output = Buffer.allocUnsafe(buf.length);
  buf.copy(output);
  return output;
}

/**
 * Rough "wrapping" function that ensure a number is in the range [0, threshold)
 */
function roughWrap(input: number, threshold: number) {
  if (input >= threshold) {
    return 0;
  }
  if (input < 0) {
    return threshold - 1;
  }

  return input;
}

const enum CharCodes {
  Zero = 48,
  Nine = 57,
  Dash = 45,
}

/**
 * Context given to the mutation algorithm.
 */
export interface IMutationContext {
  /**
   * Known string literals that can be mixed into the output.
   */
  literals: ReadonlyArray<string>;
}

export interface IMutationAlgorithm {
  /**
   * Runs the mutation on the buffer, returning a new buffer. If the
   * mutation can't be run right now, this will return null.
   */
  (input: Buffer, mutator: IMutationContext): Buffer | null;
}

/**
 * Most of the algorithms here are ports of go-fuzz's mutator:
 * https://github.com/dvyukov/go-fuzz/blob/master/go-fuzz/mutator.go
 * Many of these are more heavy on memory than Go's version, as Node's
 * buffers do not allow resizing.
 */

export function rangeRemoverMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 1) {
    return null;
  }

  const start = randn(buffer.length);
  const end = start + chooseLength(buffer.length - start);
  return Buffer.concat([buffer.slice(0, start), buffer.slice(end)]);
}

export function rangeInserterMutator(buffer: Buffer): Buffer | null {
  const start = randn(buffer.length + 1);

  return Buffer.concat([
    buffer.slice(0, start),
    randomBytes(chooseLength(10)),
    buffer.slice(start),
  ]);
}

export function rangeDuplicatorMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 2) {
    return null;
  }

  buffer = dupe(buffer);
  const src = randn(buffer.length);
  const len = chooseLength(buffer.length - src);
  let dst = randn(buffer.length);
  while (dst === src) {
    dst = randn(buffer.length);
  }

  return Buffer.concat([buffer.slice(0, src + len), buffer.slice(src, len), buffer.slice(dst)]);
}

export function rangeCopyMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 2) {
    return null;
  }

  const src = randn(buffer.length);
  const len = chooseLength(buffer.length - src);
  let dst = randn(buffer.length);
  while (dst === src) {
    dst = randn(buffer.length);
  }

  buffer = dupe(buffer);
  buffer.copy(buffer, dst, src, len);
  return buffer;
}

export function bitFlipMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 1) {
    return null;
  }

  buffer = dupe(buffer);
  buffer[randn(buffer.length)] ^= 1 << randn(8);
  return buffer;
}

export function randomByteMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 1) {
    return null;
  }

  buffer = dupe(buffer);
  buffer[randn(buffer.length)] ^= randn(255) + 1;
  return buffer;
}

export function byteSwapMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 2) {
    return null;
  }

  const src = randn(buffer.length);
  let dst = randn(buffer.length);
  while (dst === src) {
    dst = randn(buffer.length);
  }

  buffer = dupe(buffer);
  [buffer[src], buffer[dst]] = [buffer[dst], buffer[src]];
  return buffer;
}

export function uint8AddSubMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 1) {
    return null;
  }

  buffer = dupe(buffer);
  buffer[randn(buffer.length)] = Math.random() > 0.5 ? 1 : -1;
  return buffer;
}

export function uint16AddSubMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 2) {
    return null;
  }

  const index = randn(buffer.length - 2);
  const amount = Math.random() > 0.5 ? 1 : -1;
  buffer = dupe(buffer);
  if (Math.random() > 0.5) {
    buffer.writeUInt16BE(roughWrap(buffer.readUInt16BE(index) + amount, 0xffff), index);
  } else {
    buffer.writeUInt16LE(roughWrap(buffer.readUInt16LE(index) + amount, 0xffff), index);
  }

  return buffer;
}

export function uint32AddSubMutator(buffer: Buffer): Buffer | null {
  if (buffer.length < 4) {
    return null;
  }

  const index = randn(buffer.length - 4);
  const amount = Math.random() > 0.5 ? 1 : -1;
  buffer = dupe(buffer);
  if (Math.random() > 0.5) {
    buffer.writeUInt32BE(roughWrap(buffer.readUInt32BE(index) + amount, 0xffffffff), index);
  } else {
    buffer.writeUInt32LE(roughWrap(buffer.readUInt32LE(index) + amount, 0xffffffff), index);
  }

  return buffer;
}

export function asciiDigitReplace(buffer: Buffer) {
  const digitPositions: number[] = [];
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] >= CharCodes.Zero && buffer[i] <= CharCodes.Nine) {
      digitPositions.push(i);
    }
  }

  if (digitPositions.length === 0) {
    return null;
  }

  buffer = dupe(buffer);
  buffer[pickOne(digitPositions)] = randn(10) + CharCodes.Zero;
  return buffer;
}

export function asciiNumberReplace(buffer: Buffer) {
  const numberPositions: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    if (
      (buffer[i] >= CharCodes.Zero && buffer[i] <= CharCodes.Nine) ||
      (start === -1 && buffer[i] === CharCodes.Dash)
    ) {
      if (start === -1) {
        start = i;
      }
    } else if (start !== -1 && i - start > 1) {
      numberPositions.push({ start, end: i });
      start = -1;
    }
  }

  if (start > 0 && start < buffer.length - 1) {
    numberPositions.push({ start, end: buffer.length });
  }

  if (numberPositions.length === 0) {
    return null;
  }

  let value: number;
  switch (randn(4)) {
    case 0:
      value = randn(1000);
      break;
    case 1:
      value = randn(maxInt32);
      break;
    case 2:
      value = randn(maxInt32) ** 2;
      break;
    case 3:
      value = -randn(maxInt32);
      break;
    default:
      throw new Error('unreachable');
  }

  const toReplace = pickOne(numberPositions);
  if (buffer[toReplace.start] === CharCodes.Dash) {
    value *= -1;
  }

  return Buffer.concat([
    buffer.slice(0, toReplace.start),
    Buffer.from(value.toString()),
    buffer.slice(toReplace.end),
  ]);
}

export function replaceInteresting8(buffer: Buffer) {
  if (buffer.length === 0) {
    return null;
  }

  buffer = dupe(buffer);
  buffer[randn(buffer.length)] = pickOne(interesting8Bits)[0];
  return buffer;
}

export function replaceInteresting16(buffer: Buffer) {
  if (buffer.length < 2) {
    return null;
  }

  buffer = dupe(buffer);
  pickOne(interesting16Bits).copy(buffer, randn(buffer.length - 1), 0, 2);
  return buffer;
}

export function replaceInteresting32(buffer: Buffer) {
  if (buffer.length < 4) {
    return null;
  }

  buffer = dupe(buffer);
  pickOne(interesting32Bits).copy(buffer, randn(buffer.length - 3));
  return buffer;
}

export const mutators: IMutationAlgorithm[] = [
  rangeRemoverMutator,
  rangeInserterMutator,
  rangeDuplicatorMutator,
  rangeCopyMutator,
  bitFlipMutator,
  randomByteMutator,
  byteSwapMutator,
  uint8AddSubMutator,
  uint16AddSubMutator,
  uint32AddSubMutator,
  replaceInteresting8,
  replaceInteresting16,
  replaceInteresting32,
  asciiNumberReplace,
  asciiDigitReplace,
];
