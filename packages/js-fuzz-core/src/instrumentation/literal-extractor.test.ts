import { expect } from 'chai';
import { readFileSync, readdirSync } from 'fs';
import { HookManager } from './hook-manager';
import { LiteralExtractor } from './literal-extractor';
import {
  setRandomNumberGenerator,
  createRandomNumberGenerator,
  resetRandomNumberGenerator,
} from '../Math';

const loadInstrumentationFixtures = () => {
  const base = `${__dirname}/../../test/fixture/instrument`;
  const files = readdirSync(base);
  const output: { name: string; contents: string; literals: string[] }[] = [];

  files.forEach(name => {
    const match = /^(.+)\.before\.txt$/.exec(name);
    if (!match) {
      return;
    }

    const tcase = match[1];
    output.push({
      name,
      contents: readFileSync(`${base}/${tcase}.before.txt`, 'utf8').trim(),
      literals: JSON.parse(readFileSync(`${base}/${tcase}.literals.json`, 'ucs-2')),
    });
  });

  return output;
};

describe('literal-extractor', () => {
  let inst: LiteralExtractor;

  beforeEach(() => {
    setRandomNumberGenerator(createRandomNumberGenerator(42));
    inst = new LiteralExtractor(new HookManager({ exclude: [] }));
  });

  afterEach(() => {
    resetRandomNumberGenerator();
  });

  describe('fixtures', () => {
    loadInstrumentationFixtures().forEach(tcase => {
      it(`instruments ${tcase.name}`, () => {
        expect([...inst.detect(tcase.contents)]).to.deep.equal(tcase.literals);
      });
    });
  });
});
