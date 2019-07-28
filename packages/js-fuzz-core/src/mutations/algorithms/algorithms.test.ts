import { IMutationAlgorithm, createAll } from '../algorithms';
import { expect } from 'chai';
import {
  setRandomNumberGenerator,
  createRandomNumberGenerator,
  resetRandomNumberGenerator,
} from '../../Math';
import { AsciiDigitReplaceMutator } from './ascii-digit-replace-mutator';
import { AsciiNumberReplaceMutator } from './ascii-number-replace-mutator';
import { ReplaceInteresting8Mutator } from './replace-interesting-8-mutator';
import { ReplaceInteresting16Mutator } from './replace-interesting-16-mutator';
import { ReplaceInteresting32Mutator } from './replace-interesting-32-mutator';
import { Container } from 'inversify';

interface ITestCase {
  alg: IMutationAlgorithm;
  input: string | Buffer;
  output: string | Buffer | null;
}

describe('mutation algorithms', () => {
  const seed = 26220219121059154247048;
  beforeEach(() => {
    setRandomNumberGenerator(createRandomNumberGenerator(seed));
  });

  describe('sanity check all mutators', () => {
    for (const alg of createAll(new Container())) {
      it(alg.constructor.name, () => {
        for (let length = 0; length < 10; length++) {
          const buffer = Buffer.alloc(length);
          for (let i = 0; i < length; i++) {
            buffer[i] = i;
          }

          alg.mutate(Buffer.alloc(length));
        }
      });
    }
  });

  afterEach(() => resetRandomNumberGenerator());

  const tcases: ITestCase[] = [
    {
      alg: new AsciiDigitReplaceMutator(),
      input: 'lorem ipsum123 dolor',
      output: 'lorem ipsum113 dolor',
    },
    {
      alg: new AsciiDigitReplaceMutator(),
      input: 'lorem ipsum dolor',
      output: null,
    },
    {
      alg: new AsciiNumberReplaceMutator(),
      input: 'lorem 42 ipsum123 dolor',
      output: 'lorem 42 ipsum112642223543156740 dolor',
    },
    {
      alg: new AsciiNumberReplaceMutator(),
      input: 'lorem ipsum123',
      output: 'lorem ipsum112642223543156740',
    },
    {
      alg: new AsciiNumberReplaceMutator(),
      input: 'lorem ipsum -123',
      output: 'lorem ipsum -112642223543156740',
    },
    {
      alg: new AsciiNumberReplaceMutator(),
      input: 'lorem ipsum',
      output: null,
    },
    {
      alg: new ReplaceInteresting8Mutator(),
      input: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]),
      output: Buffer.from([0, 1, 2, 3, 255, 5, 6, 7]),
    },
    {
      alg: new ReplaceInteresting8Mutator(),
      input: Buffer.from([]),
      output: null,
    },
    {
      alg: new ReplaceInteresting16Mutator(),
      input: Buffer.from([3, 3, 2, 3, 4, 5, 6, 7]),
      output: Buffer.from([3, 1, 0, 3, 4, 5, 6, 7]),
    },
    {
      alg: new ReplaceInteresting16Mutator(),
      input: Buffer.from([0]),
      output: null,
    },
    {
      alg: new ReplaceInteresting32Mutator(),
      input: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]),
      output: Buffer.from([255, 255, 255, 128, 4, 5, 6, 7]),
    },
    {
      alg: new ReplaceInteresting32Mutator(),
      input: Buffer.from([0, 1, 2]),
      output: null,
    },
  ];

  for (const tcase of tcases) {
    it(`${tcase.alg.constructor.name}: ${tcase.input.toString('base64')}`, () => {
      let actual = tcase.alg.mutate(
        tcase.input instanceof Buffer ? tcase.input : Buffer.from(tcase.input),
        { literals: ['a', 'b', 'c'] },
      );
      if (typeof tcase.output === 'string' && actual) {
        expect(actual.toString()).to.equal(tcase.output);
      } else {
        expect(actual).to.deep.equal(tcase.output);
      }
    });
  }
});
