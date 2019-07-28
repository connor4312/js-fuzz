import { Container } from 'inversify';
import { AsciiDigitReplaceMutator } from './ascii-digit-replace-mutator';
import { AsciiNumberReplaceMutator } from './ascii-number-replace-mutator';
import { CopyRangeMutator } from './copy-range-mutator';
import { DuplicateRangeMutator } from './duplicate-range-mutator';
import { FlipBitMutator } from './flip-bit-mutator';
import { InsertRangeMutator } from './insert-range-mutator';
import { RandomByteMutator } from './random-byte-mutator';
import { RemoveRangeMutator } from './remove-range-mutator';
import { ReplaceInteresting8Mutator } from './replace-interesting-8-mutator';
import { ReplaceInteresting16Mutator } from './replace-interesting-16-mutator';
import { ReplaceInteresting32Mutator } from './replace-interesting-32-mutator';
import { SwapByteMutator } from './swap-byte-mutator';
import { Uint8IncrementMutator } from './uint8-increment-mutator';
import { Uint32IncrementMutator } from './uint32-increment-mutator';
import { Uint16IncrementMutator } from './uint16-increment-mutator';

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
  mutate(input: Buffer, mutator: IMutationContext): Buffer | null;
}

/**
 * Creates all mutation algorithms from the container.
 */
export const createAll = (container: Container) => [
  container.resolve(AsciiDigitReplaceMutator),
  container.resolve(AsciiNumberReplaceMutator),
  container.resolve(CopyRangeMutator),
  container.resolve(DuplicateRangeMutator),
  container.resolve(FlipBitMutator),
  container.resolve(InsertRangeMutator),
  container.resolve(RandomByteMutator),
  container.resolve(RemoveRangeMutator),
  container.resolve(ReplaceInteresting8Mutator),
  container.resolve(ReplaceInteresting16Mutator),
  container.resolve(ReplaceInteresting32Mutator),
  container.resolve(SwapByteMutator),
  container.resolve(Uint8IncrementMutator),
  container.resolve(Uint16IncrementMutator),
  container.resolve(Uint32IncrementMutator),
];
