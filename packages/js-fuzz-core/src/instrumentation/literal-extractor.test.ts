import { expect } from 'chai';
import { readFileSync, readdirSync } from 'fs';
import { HookManager } from './hook-manager';
import { LiteralExtractor } from './literal-extractor';

const loadInstrumentationFixtures = () => {
  const base = `${__dirname}/../test/fixture/instrument`;
  const files = readdirSync(base);
  const output: { name: string; contents: string; literals: string[] }[] = [];

  files.forEach(name => {
    const match = /^(.+)\.before\.txt$/.exec(name);
    if (!match) {
      return;
    }

    const tcase = match[1];
    const literals = readFileSync(`${base}/${tcase}.literals.txt`, 'utf8').trim();
    output.push({
      name,
      contents: readFileSync(`${base}/${tcase}.before.txt`, 'utf8').trim(),
      literals: literals.length ? literals.split(/\r?\n/g) : [],
    });
  });

  return output;
};

describe('literal-extractor', () => {
  let inst: LiteralExtractor;

  beforeEach(() => {
    inst = new LiteralExtractor(new HookManager({ exclude: [] }));
  });

  describe('fixtures', () => {
    loadInstrumentationFixtures().forEach(tcase => {
      it(`instruments ${tcase.name}`, () => {
        expect(inst.detect(tcase.contents)).to.deep.equal(tcase.literals);
      });
    });
  });
});
