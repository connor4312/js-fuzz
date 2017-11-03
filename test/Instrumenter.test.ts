import { expect } from 'chai';
import { Instrumenter } from '../src/Instrumenter';

import util = require('./util');

declare var __coverage__: Buffer;

describe('instrumenter', () => {
  let inst: Instrumenter;

  beforeEach(() => {
    inst = new Instrumenter({ deterministicKeys: true });
  });

  describe('fixtures', () => {
    util.loadInstrumentationFixtures().forEach(tcase => {
      it(`instruments ${tcase.name}`, () => {
        expect(inst.instrument(tcase.before)).to.equal(tcase.after);
      });
    });
  });
});
