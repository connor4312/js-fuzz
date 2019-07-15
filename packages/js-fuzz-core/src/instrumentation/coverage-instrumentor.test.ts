import { expect } from 'chai';
import { ConverageInstrumentor } from './coverage-instrumentor';
import { readFileSync, readdirSync } from 'fs';
import { HookManager } from './hook-manager';

const loadInstrumentationFixtures = () => {
  const base = `${__dirname}/../test/fixture/instrument`;
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

  beforeEach(() => {
    inst = new ConverageInstrumentor(new HookManager({ exclude: [] }), {
      instrumentor: { deterministicKeys: true },
    });
  });

  describe('fixtures', () => {
    loadInstrumentationFixtures().forEach(tcase => {
      it(`instruments ${tcase.name}`, () => {
        expect(inst.instrument(tcase.before)).to.equal(tcase.after);
      });
    });
  });
});
