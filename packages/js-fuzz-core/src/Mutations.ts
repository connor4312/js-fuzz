import { randomBytes } from 'crypto';
import { pickOne, randn } from './Math';

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

interface IMutator {
  /**
   * Runs the mutation on the buffer, returning a new buffer. If the
   * mutation can't be run right now, this will return null.
   */
  (input: Buffer): Buffer | null;
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
  return Buffer.concat([
    buffer.slice(0, start),
    buffer.slice(end),
  ]);
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

  return Buffer.concat([
    buffer.slice(0, src + len),
    buffer.slice(src, len),
    buffer.slice(dst),
  ]);
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
    buffer.writeUInt16BE(roughWrap(buffer.readUInt16BE(index) + amount, 0xFFFF), index);
  } else {
    buffer.writeUInt16LE(roughWrap(buffer.readUInt16LE(index) + amount, 0xFFFF), index);
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
    buffer.writeUInt32BE(roughWrap(buffer.readUInt32BE(index) + amount, 0xFFFFFFFF), index);
  } else {
    buffer.writeUInt32LE(roughWrap(buffer.readUInt32LE(index) + amount, 0xFFFFFFFF), index);
  }

  return buffer;
}

const asciiDigits = '0123456789'.split('').map(str => str.charCodeAt(0));

export function asciiDigitReplace(buffer: Buffer) {
  const digitPositions: number[] = [];
  for (let i = 0; i < buffer.length; i += 1) {
    if (asciiDigits.indexOf(buffer[i]) > -1) {
      digitPositions.push(i);
    }
  }
  if (digitPositions.length === 0) {
    return null;
  }

  buffer = dupe(buffer);
  buffer[digitPositions[pickOne(digitPositions)]] = pickOne(asciiDigits);
  return buffer;
}

export function asciiNumberReplace(buffer: Buffer) {
  const numberPositions: { start: number, end: number }[] = [];
  for (let i = 0; i < buffer.length; i += 1) {
    if (asciiDigits.indexOf(buffer[i]) === -1) {
      continue;
    }

    let end = i + 1;
    while (end < buffer.length && asciiDigits.indexOf(buffer[end])) {
      end += 1;
    }

    numberPositions.push({ start: i, end });
  }

  if (numberPositions.length === 0) {
    return null;
  }

  buffer = dupe(buffer);
  const selected = pickOne(numberPositions);
  for (let i = selected.start; i < selected.end; i += 1) {
    buffer[i] = pickOne(asciiDigits);
  }

  return buffer;
}

export const mutators: IMutator[] = [
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
  // todo(connor4312): the "interesting" bit identification + associated mutators
  asciiDigitReplace,
];
