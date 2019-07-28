import { expect } from 'chai';
import { ConverageInstrumentor } from './coverage-instrumentor';
import { readFileSync, readdirSync } from 'fs';
import * as Types from '../dependencies';

const loadInstrumentationFixtures = () => {
  const base = `${__dirname}/../../test/fixture/instrument`;
  const files = readdirSync(base);
  const output: { name: string; before: string; after: string }[] = [];

  files.forEach(name => {
    const match = /^(.+)\.before\.txt$/.exec(name);
    if (!match || !files.includes(`${match[1]}.after.txt`)) {
      return;
    }

    const tcase = match[1];
    output.push({
      name,
      before: readFileSync(`${base}/${tcase}.before.txt`, 'utf8').trim(),
      after: readFileSync(`${base}/${tcase}.after.txt`, 'utf8').trim(),
    });
  });

  return output;
};

describe('coverage-instrumenter', () => {
  let inst: ConverageInstrumentor;

  before(() => {
    const container = Types.getContainerInstance();
    container.bind(Types.FuzzOptions).toConstantValue({ exclude: [] });
    inst = container.get(Types.CoverageInstrumentor);
  });

  after(() => {
    inst.detach();
  });

  describe('fixtures', () => {
    loadInstrumentationFixtures().forEach(tcase => {
      it(`instruments ${tcase.name}`, () => {
        const instrumented = inst.instrument(tcase.before);
        expect(instrumented).to.equal(tcase.after);
      });
    });
  });
});
