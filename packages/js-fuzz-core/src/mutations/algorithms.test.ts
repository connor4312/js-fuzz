import {
  asciiDigitReplace,
  IMutationAlgorithm,
  asciiNumberReplace,
  replaceInteresting8,
  replaceInteresting16,
  replaceInteresting32,
} from './algorithms';
import { expect } from 'chai';
import {
  setRandomNumberGenerator,
  createRandomNumberGenerator,
  resetRandomNumberGenerator,
} from '../Math';

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

  afterEach(() => resetRandomNumberGenerator());

  const tcases: ITestCase[] = [
    {
      alg: asciiDigitReplace,
      input: 'lorem ipsum123 dolor',
      output: 'lorem ipsum113 dolor',
    },
    {
      alg: asciiDigitReplace,
      input: 'lorem ipsum dolor',
      output: null,
    },
    {
      alg: asciiNumberReplace,
      input: 'lorem 42 ipsum123 dolor',
      output: 'lorem 42 ipsum112642223543156740 dolor',
    },
    {
      alg: asciiNumberReplace,
      input: 'lorem ipsum123',
      output: 'lorem ipsum112642223543156740',
    },
    {
      alg: asciiNumberReplace,
      input: 'lorem ipsum -123',
      output: 'lorem ipsum -112642223543156740',
    },
    {
      alg: asciiNumberReplace,
      input: 'lorem ipsum',
      output: null,
    },
    {
      alg: replaceInteresting8,
      input: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]),
      output: Buffer.from([0, 1, 2, 3, 255, 5, 6, 7]),
    },
    {
      alg: replaceInteresting8,
      input: Buffer.from([]),
      output: null,
    },
    {
      alg: replaceInteresting16,
      input: Buffer.from([3, 3, 2, 3, 4, 5, 6, 7]),
      output: Buffer.from([3, 1, 0, 3, 4, 5, 6, 7]),
    },
    {
      alg: replaceInteresting16,
      input: Buffer.from([0]),
      output: null,
    },
    {
      alg: replaceInteresting32,
      input: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]),
      output: Buffer.from([255, 255, 255, 128, 4, 5, 6, 7]),
    },
    {
      alg: replaceInteresting32,
      input: Buffer.from([0, 1, 2]),
      output: null,
    },
  ];

  for (const tcase of tcases) {
    it(`${tcase.alg.name}: ${tcase.input.toString('base64')}`, () => {
      let actual = tcase.alg(
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
